/**
 * Telegram Bot Integration
 * Send enriched security alerts and C2 commands
 */

import axios from "axios";
import {
  HermesForensicAnalysis,
  HermesBountyAnalysis,
} from "./hermes-prompts";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
}

if (!process.env.TELEGRAM_CHAT_ID) {
  throw new Error("TELEGRAM_CHAT_ID environment variable is required");
}

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send enriched anomaly alert to Telegram
 */
export async function sendAnomalyAlert(
  txHash: string,
  forensicAnalysis: HermesForensicAnalysis,
  bountyAnalysis: HermesBountyAnalysis
): Promise<void> {
  const riskEmoji = {
    CRITICAL: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
  };

  const bountyEmoji = bountyAnalysis.immunefiRelevant ? "💰" : "❌";

  const message = `${riskEmoji[forensicAnalysis.riskLevel]} **FASE 1: ANOMALY DETECTED**

**TX Hash:** \`${txHash}\`
**Anomaly Type:** ${forensicAnalysis.anomalyType}
**Risk Level:** ${forensicAnalysis.riskLevel}
**Confidence:** ${forensicAnalysis.confidence}%

**Gas Pattern:**
${forensicAnalysis.gasPattern}

**Possible Attack Vectors:**
${forensicAnalysis.possibleVectors.map((v) => `• ${v}`).join("\n")}

**Why It Matters:**
${forensicAnalysis.whyItMatters}

**Recommended Action:**
${forensicAnalysis.nextSteps}

---

${bountyEmoji} **BUG BOUNTY ASSESSMENT**
**Immunefi Relevant:** ${bountyAnalysis.immunefiRelevant ? "✅ YES" : "❌ NO"}
**Severity:** ${bountyAnalysis.estimatedSeverity.toUpperCase()}
**Est. Payout:** ${bountyAnalysis.estimatedPayout}
**Protocol:** ${bountyAnalysis.reportingProtocol}

**Analysis:**
${bountyAnalysis.reasoning}

---

**FASE 2 Commands (Coming Soon):**
/analyze ${txHash}
/audit ${txHash.slice(0, 20)}...`;

  await sendMessage(message);
}

/**
 * Send CRITICAL alert (red phone emoji + sound)
 */
export async function sendCriticalAlert(
  txHash: string,
  reason: string
): Promise<void> {
  const message = `🚨 **CRITICAL ALERT** 🚨

**TX:** \`${txHash}\`
**Reason:** ${reason}

⚠️ Immediate investigation required!`;

  await sendMessage(message, { parse_mode: "Markdown", disable_notification: false });
}

/**
 * Send C2 command response (for Phase 2)
 */
export async function sendC2Response(
  txHash: string,
  command: string,
  response: string
): Promise<void> {
  const message = `📡 **C2 RESPONSE** [PHASE 2]

**Command:** \`${command}\`
**TX:** \`${txHash}\`

**Response:**
\`\`\`
${response}
\`\`\``;

  await sendMessage(message);
}

/**
 * Send status update
 */
export async function sendStatusUpdate(status: string): Promise<void> {
  const message = `📊 **STATUS UPDATE**

${status}

Timestamp: ${new Date().toISOString()}`;

  await sendMessage(message);
}

/**
 * Core Telegram message sender
 */
async function sendMessage(
  text: string,
  options: any = {}
): Promise<void> {
  try {
    const payload = {
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown",
      ...options,
    };

    const response = await axios.post(
      `${TELEGRAM_API}/sendMessage`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }

    console.log(`✅ Telegram message sent`);
  } catch (error) {
    console.error("Telegram send error:", error);
    throw error;
  }
}

/**
 * Set up webhook for receiving Telegram commands
 * (Placeholder for Phase 2 C2 implementation)
 */
export async function setupTelegramWebhook(webhookUrl: string): Promise<void> {
  try {
    const response = await axios.post(
      `${TELEGRAM_API}/setWebhook`,
      { url: webhookUrl },
      { timeout: 10000 }
    );

    if (!response.data.ok) {
      throw new Error(`Webhook setup failed: ${response.data.description}`);
    }

    console.log(`✅ Telegram webhook configured: ${webhookUrl}`);
  } catch (error) {
    console.error("Webhook setup error:", error);
    throw error;
  }
}

/**
 * Get Telegram bot info (health check)
 */
export async function getBotInfo(): Promise<any> {
  try {
    const response = await axios.post(`${TELEGRAM_API}/getMe`, {}, { timeout: 10000 });

    if (!response.data.ok) {
      throw new Error("Bot info fetch failed");
    }

    return response.data.result;
  } catch (error) {
    console.error("Bot info error:", error);
    throw error;
  }
}
