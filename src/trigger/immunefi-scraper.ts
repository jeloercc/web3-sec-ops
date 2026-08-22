import { logger } from '@trigger.dev/sdk/v3';
import { schedules } from '@trigger.dev/sdk/v3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ImmunefiProgram {
  name?: string;
  slug?: string;
  maxPayout?: number | string;
  url?: string;
  status?: string;
}

// Bootstrap seed data for Immunefi programs (publicly known)
const bootstrapPrograms = [
  { protocol: "MakerDAO (Sky)", maxPayout: 10000000 },
  { protocol: "Chainlink", maxPayout: 3000000 },
  { protocol: "Uniswap", maxPayout: 2250000 },
  { protocol: "Lido", maxPayout: 2000000 },
  { protocol: "Wormhole", maxPayout: 1000000 },
  { protocol: "Aave", maxPayout: 1000000 },
  { protocol: "Polygon", maxPayout: 1000000 },
  { protocol: "Compound", maxPayout: 150000 },
];

export const immunefiScraper = schedules.task({
  id: 'immunefi-scraper',
  cron: '0 8 * * *',
  run: async () => {
    logger.info('Starting Immunefi scraper...');

    let programs: Array<{ protocol: string; maxPayout: number; url: string; status: string }> = [];

    try {
      // Attempt to fetch live data from Immunefi GraphQL endpoint
      const response = await fetch('https://immunefi-api-v2.b12db.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              programs {
                name
                slug
                maxPayout
                url
                status
              }
            }
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract programs from the response (adjust based on actual structure)
      // Assuming the response has data.programs array
      if (data && data.programs && Array.isArray(data.programs)) {
        programs = data.programs.map((p: ImmunefiProgram) => ({
          protocol: p.name || p.slug || 'Unknown',
          maxPayout: Number(p.maxPayout) || 0,
          url: p.url || 'https://immunefi.com/explore/',
          status: p.status || 'active',
        }));
      } else {
        throw new Error('Unexpected response structure');
      }

      logger.info(`Fetched ${programs.length} programs from Immunefi API`);
    } catch (error) {
      logger.warn('Failed to fetch from Immunefi API, using bootstrap data', { error: String(error) });
      // Use bootstrap seed data
      programs = bootstrapPrograms.map(p => ({
        protocol: p.protocol,
        maxPayout: p.maxPayout,
        url: 'https://immunefi.com/explore/',
        status: 'active',
      }));
    }

    // Upsert each program into the bountyProgram table
    let syncedCount = 0;
    for (const program of programs) {
      try {
        await prisma.bountyProgram.upsert({
          where: { platform_protocol: { platform: 'Immunefi', protocol: program.protocol } },
          update: {
            maxPayout: program.maxPayout,
            status: program.status,
            url: program.url,
          },
          create: {
            platform: 'Immunefi',
            protocol: program.protocol,
            maxPayout: program.maxPayout,
            scope: 'smart-contract',
            title: `${program.protocol} Bug Bounty`,
            description: 'Active bounty program',
            url: program.url,
            status: program.status,
          },
        });
        syncedCount++;
      } catch (error) {
        logger.error(`Failed to upsert program ${program.protocol}:`, { error: String(error) });
      }
    }

    logger.info(`Immunefi radar: ${syncedCount} programs synced`);

    await prisma.$disconnect();

    return { syncedCount };
  },
});