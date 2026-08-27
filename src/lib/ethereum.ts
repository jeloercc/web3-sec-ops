/**
 * Ethereum Transaction Details Retrieval
 * Uses Viem + Alchemy to fetch transaction data
 */

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

if (!process.env.ETHEREUM_RPC_URL) {
  throw new Error("ETHEREUM_RPC_URL environment variable is required");
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

export interface TransactionDetails {
  from: string;
  to: string | null;
  value: string;
  data: string;
  gasUsed: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  blockNumber: bigint;
  blockTimestamp: bigint;
  status: "success" | "reverted";
  functionSig?: string;
  isContractCreation: boolean;
}

/**
 * Fetch full transaction details from Ethereum mainnet
 */
export async function getTransactionDetails(
  txHash: `0x${string}`
): Promise<TransactionDetails> {
  try {
    // Fetch transaction
    const tx = await client.getTransaction({
      hash: txHash,
    });

    // Fetch receipt
    const receipt = await client.getTransactionReceipt({
      hash: txHash,
    });

    // Fetch block for timestamp
    const block = await client.getBlock({
      blockNumber: receipt.blockNumber,
    });

    // Extract function signature from transaction data
    const functionSig = extractFunctionSignature(tx.input);

    // Determine if it's a contract creation
    const isContractCreation = !tx.to || tx.to === "0x";

    return {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      data: tx.input,
      gasUsed: receipt.gasUsed,
      gasLimit: tx.gas,
      gasPrice: tx.gasPrice || BigInt(0),
      blockNumber: receipt.blockNumber,
      blockTimestamp: block.timestamp,
      status: receipt.status === "success" ? "success" : "reverted",
      functionSig,
      isContractCreation,
    };
  } catch (error) {
    console.error(`Failed to fetch transaction ${txHash}:`, error);
    throw new Error(`Transaction fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract function signature from transaction calldata
 * First 4 bytes (8 hex chars) represent the function selector
 */
function extractFunctionSignature(data: string): string | undefined {
  if (data.length < 10) {
    return undefined; // Too short to have function selector
  }

  const selector = data.slice(0, 10); // 0x + 8 hex chars
  return selector;
}

/**
 * Decode function parameters if ABI is available
 */
export async function decodeFunctionCall(
  data: string,
  abi: any[] // Contract ABI
): Promise<{ functionName: string; args: any } | null> {
  try {
    // This is a simplified version - full implementation would require
    // proper ABI parsing and parameter decoding
    const selector = data.slice(0, 10);

    // Find matching function in ABI
    for (const item of abi) {
      if (item.type === "function") {
        // Generate selector for this function
        // This is simplified - real implementation uses signature hashing
        if (item.name) {
          return {
            functionName: item.name,
            args: item.inputs || [],
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Function decoding error:", error);
    return null;
  }
}

/**
 * Get gas ratio (gasUsed / gasLimit)
 */
export function calculateGasRatio(gasUsed: bigint, gasLimit: bigint): number {
  if (gasLimit === BigInt(0)) return 0;
  return Number(gasUsed) / Number(gasLimit);
}

/**
 * Classify gas anomaly severity
 */
export function classifyGasAnomaly(gasRatio: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (gasRatio >= 0.95) return "CRITICAL";
  if (gasRatio >= 0.85) return "HIGH";
  if (gasRatio >= 0.70) return "MEDIUM";
  return "LOW";
}

/**
 * Check if transaction reverted
 */
export function isTransactionReverted(details: TransactionDetails): boolean {
  return details.status === "reverted";
}

/**
 * Calculate transaction cost in ETH
 */
export function calculateTransactionCost(
  gasUsed: bigint,
  gasPrice: bigint
): bigint {
  return gasUsed * gasPrice;
}
