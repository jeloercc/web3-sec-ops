# web3-sec-ops

**On-chain threat intelligence pipeline for Ethereum mainnet.**
Autonomous detection of anomalous transaction behavior, bug bounty program tracking, and real-time alerting — all deployed as a serverless system.

[Live dashboard](https://web3-sec-ops.vercel.app) · [Methodology](#detection-methodology) · [Architecture](#architecture) · [Quick deploy](#quick-deploy)

---

## What does this project do?

web3-sec-ops monitors Ethereum mainnet for transaction-level signals consistent with exploitation activity: **reverted transactions that consume a disproportionate share of their gas limit**.

These events correlate with failed attack attempts — reentrancy guards tripping mid-execution, attack loops running out of gas, or calls to drained/paused target contracts.

The pipeline combines this signal with a synced view of active smart contract bug bounty programs, turning raw on-chain data into a prioritized investigation queue for manual vulnerability analysis.

<img width="1190" height="803" alt="Screenshot 2026-08-21 at 10 27 09 PM" src="https://github.com/user-attachments/assets/f0c414c0-c0a0-437a-ba03-125f522e67ee" />
---

## Architecture

```
Ethereum mainnet (viem / Alchemy RPC)
             │  hourly window (50 blocks)
             ▼
┌────────────────────────────────────┐
│  etherscan-monitor (cron hourly)   │  revert + gas-ratio filter
│  severity scoring                  │  CRITICAL ≥95% · HIGH ≥80% · MEDIUM ≥60%
└──────────────┬─────────────────────┘
               │  Prisma ORM
               ▼
┌────────────────────────────┐      ┌──────────────────────────┐
│  Neon Postgres (serverless)│◄─────│  immunefi-scraper        │
│  pooled connection @prisma/pg│    │  daily sync 8am UTC      │
└──────────────┬─────────────┘      └──────────────────────────┘
               │  SSR, revalidate=0
               ▼
┌────────────────────────────┐      ┌──────────────────────────┐
│  Next.js 16 Dashboard      │      │  Telegram alerts          │
│  (Vercel, auto-refresh 60s)│      │  on CRITICAL / HIGH      │
└────────────────────────────┘      └──────────────────────────┘
```

**Everything is serverless**: Trigger.dev for scheduled tasks, Neon for the database, Vercel for the frontend. No persistent infrastructure to maintain after deployment.

---

## Data model

| Model | Purpose |
|--------|-----------|
| **SmartContract** | Monitored contracts (unique address + chain) |
| **Anomaly** | Detected anomalous transactions (unique tx hash, blockNumber, JSON metadata) |
| **BountyProgram** | Bug bounty programs (Immunefi, etc.) — unique (platform, protocol) |
| **Opportunity** | Specific findings/opportunities within a program |
| **Vulnerability** | Identified vulnerabilities (CVE, SWC ID, severity) |

Indexes optimized for: `severity`, `blockNumber`, `detectedAt`, `transactionHash` (unique), `smartContractId`, `chain`.

---

## Detection methodology

### Signal definition

A transaction is flagged as anomalous when:

```
status == 0 (revert)  AND  gasUsed / gasLimit >= 0.60
```

### Rationale

Failed exploits typically burn most of their gas before reverting: state-changing logic executes until a guard trips, an internal call exhausts a loop, or the target contract rejects the call. A high gas-burned-on-revert ratio is a cheap, high-recall proxy for "something adversarial was attempted here."

### Severity model

| Severity | Gas burned | Operational meaning |
|-----------|-------------|------------------------|
| **CRITICAL** | ≥ 95% | Immediate alert (Telegram) — likely active exploit |
| **HIGH** | ≥ 80% | Immediate alert (Telegram) — highly suspicious behavior |
| **MEDIUM** | ≥ 60% | Queued on dashboard for manual review |

### Known limitations

The signal is **high-recall, not high-precision**: benign user errors (misconfigured calldata, slippage reverts) also burn gas. The pipeline is a *triage front-end*; every flag requires manual contract review before classification. False-positive reduction (calldata clustering, contract reputation) is on the roadmap.

---

## Repository structure

```
prisma/
  schema.prisma              # Models: Anomaly · SmartContract · BountyProgram · Opportunity · Vulnerability
  migrations/                # Versioned SQL migrations
  config.ts                  # Prisma config + dotenv

src/
  app/
    page.tsx                 # SSR dashboard (stats, anomalies, bounties)
    anomaly/[id]/page.tsx    # Single-anomaly forensic view
    globals.css              # HUD theme (grid, scanlines, glow, fonts)
    layout.tsx               # Metadata, fonts (Orbitron + JetBrains Mono)
  components/
    MatrixRain.tsx           # Animated canvas background
    Sparkline.tsx            # 7-day activity SVG chart
    LiveClock.tsx             # UTC clock in header
    LocalTime.tsx             # Local date formatting for timestamps
    CountUp.tsx               # Counter animation
    AutoRefresh.tsx           # Router.refresh() every 60s
    GlitchTitle.tsx           # Title with CSS glitch effect
  lib/
    prisma.ts                # PrismaClient singleton + adapter-pg
    metadata-utils.ts        # Gas percentage normalization from JSON
  trigger/
    etherscan-monitor.ts     # Hourly task: 50-block scan, anomaly detection
    immunefi-scraper.ts      # Daily task: Immunefi program sync
    example.ts               # Trigger.dev example task

trigger.config.ts            # Trigger.dev project config
next.config.ts               # Next.js config (minimal)
tsconfig.json                # TypeScript strict, path aliases @/*
eslint.config.mjs            # ESLint 9 + next/core-web-vitals + typescript
```

---

## Quick deploy

### Prerequisites

- Node.js 20+
- [Neon](https://neon.tech) account (serverless Postgres)
- [Trigger.dev](https://trigger.dev) account (scheduled tasks)
- [Alchemy](https://alchemy.com) API key (Ethereum RPC)
- Telegram bot + Chat ID (for alerts)

### Environment variables

```bash
cp .env.example .env
```

```env
# Neon Postgres connection string
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Trigger.dev project secret
TRIGGER_SECRET_KEY="tr_dev_xxxxxxxxxxxxxxxx"

# Ethereum mainnet RPC (Alchemy, Infura, etc.)
ETHEREUM_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/your-key"

# Telegram alerts (CRITICAL/HIGH only)
TELEGRAM_BOT_TOKEN="123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxx"
TELEGRAM_CHAT_ID="123456789"
```

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client + apply migrations
npx prisma migrate deploy

# 3. Dashboard at http://localhost:3000
npm run dev

# 4. In another terminal: local Trigger.dev runner
npx trigger.dev@latest dev
```

### Production deployment

| Component | Platform | Command |
|------------|------------|---------|
| Dashboard | Vercel | `vercel --prod` (connects repo) |
| Tasks | Trigger.dev Cloud | `npx trigger.dev@latest deploy` |
| Database | Neon | Automatic via `DATABASE_URL` |

**Production variables**: Configure the same 5 variables in Vercel (Project Settings → Environment Variables) and Trigger.dev (Dashboard → Environment Variables).

---

## Available scripts

```bash
npm run dev        # Next.js dev server (Turbopack)
npm run build      # Production build + typecheck
npm run start      # Production server
npm run lint       # ESLint
npm run test       # Vitest (unit tests)
npm run test:ui    # Interactive Vitest UI
npm run postinstall # prisma generate (auto on install)
```

---

## Roadmap

- [ ] **False-positive reduction**: per-contract calldata clustering
- [ ] **Triage workflow**: acknowledge / resolve / annotate anomalies
- [ ] **Per-contract historical analysis**: temporal patterns, repeat offenders
- [ ] **Public read-only API**: endpoints for external researchers
- [ ] **Multi-chain**: Polygon, Arbitrum, Optimism, Base
- [ ] **Enrichment**: decode calldata with ABI, known contract labels

---

## Key technical decisions

| Decision | Reason |
|----------|-------|
| `@prisma/adapter-pg` + Neon | Native serverless pooling, no connection limits |
| Trigger.dev vs cron jobs | Retries, observability, idempotency, maxDuration |
| Viem vs ethers v6 | Smaller bundle size, tree-shaking, TypeScript-first |
| Next.js App Router + SSR | Always-fresh data (`revalidate=0`), SEO-friendly |
| Tailwind CSS v4 | Zero-config, CSS-first, minimal bundle size |
| `transactionHash` unique constraint | DB-level deduplication, race-condition proof |

---

## License

MIT — use it, modify it, deploy it. See [LICENSE](LICENSE).

---

## Author

Built and operated by **jeloercc** as independent Web3 security research infrastructure.

> **⚠️ Disclaimer**: The dashboard is a triage tool, **not** financial or security advice. Every anomaly requires manual verification before acting on it.

---

## Contributing

1. Fork → branch → PR
2. `npm run lint && npm run test && npm run build` must pass
3. Conventional commits (`feat:`, `fix:`, `chore:`, etc.)
4. Tests for new detection logic / utilities

---

*Questions? Open an issue or check the [Trigger.dev docs](https://trigger.dev/docs) and [Prisma docs](https://pris.ly/d).*
