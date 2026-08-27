/**
 * FASE 1: Hermes Client
 * Execute hermes CLI commands via child_process for blockchain forensics
 */

import { exec } from "child_process";
import { promisify } from "util";
import {
  getForensicAnalysisPrompt,
  getBountyRelevancePrompt,
  AnomalyData,
  HermesForensicAnalysis,
  HermesBountyAnalysis,
} from "./hermes-prompts";

const execAsync = promisify(exec);

/**
 * Execute Hermes CLI command and extract JSON from response
 */
async function executeHermes(prompt: string): Promise<string> {
  const sanitizedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, "\\$");

  try {
    const { stdout, stderr } = await execAsync(
      `hermes -z "${sanitizedPrompt}"`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
        timeout: 60000, // 60 second timeout
        shell: "/bin/bash",
      }
    );

    if (stderr && stderr.includes("error")) {
      console.error("Hermes error output:", stderr);
    }

    return stdout;
  } catch (error) {
    console.error("Hermes execution error:", error);
    throw new Error(`Hermes CLI failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract JSON from Hermes response (handles markdown code blocks and plain JSON)
 */
function extractJSON(response: string): object {
  // Try to find JSON in markdown code blocks first
  const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch {
      // Continue to next attempt
    }
  }

  // Try to find plain JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue to next attempt
    }
  }

  // If nothing works, throw error
  throw new Error("No valid JSON found in Hermes response");
}

/**
 * PHASE 1: Forensic Analysis
 * Deep analysis of transaction anomaly with risk assessment
 */
export async function analyzeAnomalyForensics(
  anomaly: AnomalyData
): Promise<HermesForensicAnalysis> {
  console.log(`🔍 Hermes: Forensic analysis for ${anomaly.txHash}...`);

  const prompt = getForensicAnalysisPrompt(anomaly);
  const response = await executeHermes(prompt);
  const json = extractJSON(response);

  const analysis = json as HermesForensicAnalysis;

  // Validate required fields
  if (!analysis.anomalyType || !analysis.riskLevel) {
    throw new Error("Invalid forensic analysis response - missing required fields");
  }

  console.log(`✅ Forensic Analysis: ${analysis.riskLevel} - ${analysis.anomalyType}`);
  return analysis;
}

/**
 * PHASE 1: Bug Bounty Relevance
 * Determine if anomaly is worth reporting to bug bounty programs
 */
export async function analyzeBountyRelevance(
  anomaly: AnomalyData,
  forensicAnalysis: HermesForensicAnalysis
): Promise<HermesBountyAnalysis> {
  console.log(`💰 Hermes: Evaluating bug bounty potential for ${anomaly.txHash}...`);

  const prompt = getBountyRelevancePrompt(anomaly, forensicAnalysis);
  const response = await executeHermes(prompt);
  const json = extractJSON(response);

  const analysis = json as HermesBountyAnalysis;

  // Validate required fields
  if (analysis.immunefiRelevant === undefined || !analysis.estimatedSeverity) {
    throw new Error("Invalid bounty analysis response - missing required fields");
  }

  if (analysis.immunefiRelevant) {
    console.log(
      `🎯 BOUNTY ALERT: ${analysis.estimatedSeverity.toUpperCase()} - ${analysis.estimatedPayout}`
    );
  }

  return analysis;
}

/**
 * PHASE 1: Complete Analysis Pipeline
 * Run both forensic and bounty analysis in sequence
 */
export async function analyzeAnomalyComplete(anomaly: AnomalyData) {
  try {
    // Step 1: Forensic analysis
    const forensicAnalysis = await analyzeAnomalyForensics(anomaly);

    // Step 2: Bounty relevance
    const bountyAnalysis = await analyzeBountyRelevance(anomaly, forensicAnalysis);

    // Return combined analysis
    return {
      forensic: forensicAnalysis,
      bounty: bountyAnalysis,
      analyzedAt: new Date().toISOString(),
      status: "completed",
    };
  } catch (error) {
    console.error("Hermes analysis failed:", error);
    throw error;
  }
}

/**
 * Health check - verify Hermes is operational
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await executeHermes("Say 'OK' if you are operational");
    return response.toLowerCase().includes("ok");
  } catch {
    return false;
  }
}

/**
 * Get Hermes version
 */
export async function getHermesVersion(): Promise<string> {
  try {
    const response = await executeHermes("What version are you?");
    return response.trim();
  } catch (error) {
    return "unknown";
  }
}
