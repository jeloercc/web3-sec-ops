import { logger } from '@trigger.dev/sdk/v3';
import { schedules } from '@trigger.dev/sdk/v3';
import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const transport = fallback([
  http('https://ethereum.publicnode.com'),
  http('https://1rpc.io/eth'),
  http('https://eth.drpc.org'),
  http('https://mainnet.gateway.tenderly.co'),
  http('https://rpc.mevblocker.io'),
]);

const client = createPublicClient({ chain: mainnet, transport });

/**
 * Detects failed transactions that consumed >80% of their gas limit,
 * which can indicate an exploit attempt or critical error.
 * Results are persisted to the Anomaly table.
 */
export const etherscanMonitor = schedules.task({
  id: 'etherscan-monitor',
  cron: '0 * * * *',
  run: async () => {
    logger.info('Starting Ethereum Mainnet block monitoring...');

    const blockCount = 50;
    const chunkSize = 5; // Process 5 blocks in parallel per chunk

    // Get the current block number
    const latestBlock = await client.getBlockNumber();
    logger.info(`Current latest block: ${latestBlock}`);

    let totalAnomalies = 0;

    // Process blocks in chunks of 5 in parallel
    for (let chunkStart = 0; chunkStart < blockCount; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, blockCount);
      const chunkPromises: Promise<void>[] = [];

      for (let i = chunkStart; i < chunkEnd; i++) {
        const blockNum = latestBlock - BigInt(i);

        // Exactly 2 parallel RPC calls per block (batched receipts)
        chunkPromises.push(
          (async () => {
            logger.info(`Processing block ${blockNum}...`);

            const [block, receipts] = await Promise.all([
              client.getBlock({ blockNumber: blockNum, includeTransactions: true }),
              client.getBlockReceipts({ blockNumber: blockNum }),
            ]);

            // Build a Map of receipts by transactionHash for O(1) lookup
            const receiptMap = new Map<
              string,
              { status: string; gasUsed: string; logs: Array<{ topics: string[] }> }
            >();
            for (const receipt of receipts) {
              receiptMap.set(receipt.transactionHash, {
                status: receipt.status,
                gasUsed: receipt.gasUsed.toString(),
                logs: receipt.logs ?? [],
              });
            }

            // Iterate through transactions and match receipts by hash
            for (const tx of block.transactions) {
              if (!tx.hash || !tx.blockNumber) continue;

              try {
                const receipt = receiptMap.get(tx.hash);
                if (!receipt) continue; // No receipt found for this tx

                const gasUsed = Number(receipt.gasUsed);
                const gasLimit = Number(tx.gas);

                if (receipt.status === 'reverted' && Number(receipt.gasUsed) >= 0.6 * Number(tx.gas)) {
                  // FEATURE 1: DYNAMIC SEVERITY
                  const gasPercent = Math.round((gasUsed / gasLimit) * 10000) / 100;
                  let severity = "MEDIUM";
                  if (gasPercent >= 95) severity = "CRITICAL";
                  else if (gasPercent >= 80) severity = "HIGH";

                  logger.info(
                    `Anomaly detected: Failed tx ${tx.hash?.slice(0, 10)}... in block ${blockNum} - gas usage: ${gasPercent.toFixed(2)}%`,
                  );

                  // Upsert SmartContract before creating Anomaly
                  const contractAddress = tx.to ?? tx.from;
                  const contract = await prisma.smartContract.upsert({
                    where: { address_chain: { address: contractAddress, chain: 'ethereum' } },
                    update: {},
                    create: {
                      address: contractAddress,
                      chain: 'ethereum',
                      name: 'Unknown',
                      abi: null,
                    },
                  });

                  // Deduplicate: skip if anomaly already exists
                  const exists = await prisma.anomaly.findFirst({
                    where: { transactionHash: tx.hash },
                  });
                  if (exists) continue;

                  // Save to Anomaly table
                  await prisma.anomaly.create({
                    data: {
                      type: 'failed-high-gas-transaction',
                      severity: severity,
                      title: `Failed transaction with high gas consumption (${gasPercent.toFixed(1)}%)`,
                      description: `Transaction ${tx.hash} failed (status 0) and consumed ${gasPercent.toFixed(2)}% of its gas limit (${gasUsed}/${gasLimit}). This may indicate an exploit attempt or critical error.`,
                      blockNumber: blockNum,
                      transactionHash: tx.hash!,
                      logIndex: receipt.logs ? receipt.logs.length : 0,

                      smartContract: {
                        connect: { id: contract.id },
                      },

                      metadata: {
                        gasUsed: gasUsed.toString(),
                        gasLimit: gasLimit.toString(),
                        gasUsedPercent: gasPercent,
                        from: tx.from,
                        to: tx.to,
                        input: tx.input,
                      },
                    },
                  });

                  totalAnomalies++;

                  // FEATURE 2: TELEGRAM ALERT (solo CRITICAL o HIGH)
                  const token = process.env.TELEGRAM_BOT_TOKEN;
                  const chatId = process.env.TELEGRAM_CHAT_ID;
                  if (token && chatId && (severity === "CRITICAL" || severity === "HIGH")) {
                    try {
                      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chatId,
                          text: [
                            `🚨 ${severity} ANOMALY DETECTED`,
                            `⛓ Block: ${blockNum}`,
                            `📉 Gas burned: ${gasPercent}%`,
                            `📄 Tx: https://etherscan.io/tx/${tx.hash}`,
                            `🏠 Contract: https://etherscan.io/address/${contractAddress}`,
                          ].join("\n"),
                        }),
                      });
                    } catch (e) {
                      logger.warn("Telegram alert failed", { error: String(e) });
                    }
                  }
                }
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                logger.error(
                  `Error processing transaction ${tx.hash?.slice(0, 10)}...: ${errorMessage}`,
                );
              }
            }
          })(),
        );
      }

      // Wait for all block processing in this chunk to complete
      await Promise.all(chunkPromises);
    }

    logger.info(`Scanned 50 blocks, ${totalAnomalies} anomalies saved`);

    await prisma.$disconnect();

    return { totalAnomalies, blocksProcessed: 50 };
  },
});