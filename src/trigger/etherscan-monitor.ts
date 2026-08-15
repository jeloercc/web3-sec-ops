import { task, logger } from '@trigger.dev/sdk/v3';
import { schedules } from '@trigger.dev/sdk/v3';
import { createPublicClient, fallback, http, type Chain } from 'viem';
import { mainnet } from 'viem/chains';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
  // Run every hour
  cron: '0 * * * *',
  run: async (_, { ctx }) => {
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
                gasUsed: receipt.gasUsed,
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
                  const gasUsageRatio = gasUsed / gasLimit;

                  logger.info(
                    `Anomaly detected: Failed tx ${tx.hash?.slice(0, 10)}... in block ${blockNum} - gas usage: ${(
                      gasUsageRatio * 100
                    ).toFixed(2)}%`,
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
                      severity: 'critical',
                      title: `Failed transaction with high gas consumption (${(gasUsageRatio * 100).toFixed(1)}%)`,
                      description: `Transaction ${tx.hash} failed (status 0) and consumed ${(
                        gasUsageRatio * 100
                      ).toFixed(2)}% of its gas limit (${gasUsed}/${gasLimit}). This may indicate an exploit attempt or critical error.`,
                      blockNumber: blockNum,
                      transactionHash: tx.hash!,
                      logIndex: receipt.logs ? receipt.logs.length : 0,

                      smartContract: {
                        connect: { id: contract.id },
                      },

                      metadata: {
                        gasUsed: gasUsed.toString(),
                        gasLimit: gasLimit.toString(),
                        gasUsageRatio: gasUsageRatio,
                        from: tx.from,
                        to: tx.to,
                        input: tx.input,
                      },
                    },
                  });

                  totalAnomalies++;
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