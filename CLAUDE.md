# Project Context: Web3 SecOps Dashboard
## Goal
Build a personal threat intelligence and monitoring dashboard for Web3 smart contracts, bug bounties (Immunefi), and on-chain anomalies.

## Tech Stack
- Framework: Next.js 14+ (App Router)
- Styling: Tailwind CSS, shadcn/ui (Dark mode default, cyberpunk/hacker aesthetic)
- Database: Neon Postgres (Serverless) via Prisma ORM
- Web3 Interaction: Viem (Etherscan API, RPC nodes)
- Background Jobs: Trigger.dev (for cron jobs and heavy scraping)

## Core Directories
- `src/app`: Next.js App router (pages and layouts)
- `src/components`: Reusable UI components
- `src/lib`: Utilities, Viem clients, Prisma client, API fetchers
- `src/jobs`: Trigger.dev background tasks (scrapers)
- `prisma/schema.prisma`: Database schema

## Rules for AI (Claude)
1. Always use TypeScript with strict typing.
2. Prefer Server Components by default, use Client Components ('use client') only when interactivity is needed.
3. When writing Web3 code, use `viem` and handle RPC errors gracefully.
4. Do not mock data unless explicitly asked; write the actual API integration logic using environment variables.
5. Keep UI minimal, dense with data, and use monospaced fonts for hashes/addresses.
