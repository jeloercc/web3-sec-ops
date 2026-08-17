# web3-sec-ops

**On-chain threat-intelligence pipeline for Ethereum mainnet.**
Autonomous detection of anomalous transaction behavior, bounty-program
tracking, and real-time alerting — deployed as a fully serverless system.

[Live dashboard](https://web3-sec-ops.vercel.app) · [Methodology](#detection-methodology) · [Architecture](#architecture)

---

## Overview

web3-sec-ops continuously monitors Ethereum mainnet for transaction-level
signals consistent with exploit activity: reverted transactions that
consume a disproportionate share of their gas limit. These events
correlate with failed attack attempts — reentrancy guards triggering
mid-execution, exhausted attack loops, or calls into drained or paused
contracts.

The pipeline pairs this signal with a synchronized view of active
smart-contract bug-bounty programs, converting raw chain data into a
prioritized research queue for manual vulnerability analysis.

## Architecture

    Ethereum mainnet (viem / Alchemy RPC)
                 │  hourly window scan
                 ▼
    ┌────────────────────────────┐
    │ etherscan-monitor (cron)   │  revert + gas-ratio filter
    │ severity scoring           │  CRITICAL ≥95 · HIGH ≥80 · MEDIUM ≥60
    └────────────┬───────────────┘
                 │  Prisma ORM
                 ▼
    ┌────────────────────────────┐      ┌──────────────────────┐
    │ Neon Postgres (serverless) │◄─────│ immunefi-scraper     │
    └────────────┬───────────────┘      │ daily bounty sync    │
                 │  SSR, revalidate=0   └──────────────────────┘
                 ▼
    ┌────────────────────────────┐      ┌──────────────────────┐
    │ Next.js dashboard (Vercel) │      │ Telegram alerting    │
    │ 60s auto-refresh           │      │ on CRITICAL / HIGH   │
    └────────────────────────────┘      └──────────────────────┘

All execution is serverless (Trigger.dev scheduled tasks, Neon, Vercel).
No persistent infrastructure is required after deployment.

## Detection methodology

**Signal definition.** A transaction is flagged when:

    status == 0 (revert)  AND  gasUsed / gasLimit >= 0.60

**Rationale.** Failed exploits typically burn most of their gas before
reverting: state-changing logic executes until a guard trips, an internal
call exhausts the loop, or the target contract rejects the call. A high
gas-burn ratio on revert is therefore a cheap, high-recall proxy for
"something adversarial was attempted here."

**Severity model.**

| Severity | Gas burned | Operational meaning              |
|----------|------------|----------------------------------|
| CRITICAL | ≥ 95%      | Page immediately (Telegram)      |
| HIGH     | ≥ 80%      | Page immediately (Telegram)      |
| MEDIUM   | ≥ 60%      | Dashboard queue for manual review|

**Known limitations.** The signal is high-recall, not high-precision:
benign user errors (misconfigured calldata, slippage reverts) also burn
gas. The pipeline is a *triage front-end*; every flag requires manual
contract review before classification. False-positive reduction
(calldata clustering, contract reputation) is tracked in the roadmap.

## Repository structure

    prisma/
      schema.prisma              # Anomaly · SmartContract · BountyProgram
      migrations/
    src/
      app/
        page.tsx                 # SSR dashboard (stats, anomalies, bounties)
        anomaly/[id]/page.tsx    # forensic detail view
        globals.css              # HUD theme (grid, scanlines, glow)
      components/                # MatrixRain · Sparkline · LiveClock · ...
      lib/                       # prisma client · metadata normalization
      trigger/
        etherscan-monitor.ts     # hourly detection task
        immunefi-scraper.ts      # daily bounty-program sync
    trigger.config.ts

## Getting started

    git clone <repo> && cd web3-sec-ops
    npm install
    cp .env.example .env         # DATABASE_URL, ETHEREUM_RPC_URL, TELEGRAM_*
    npx prisma migrate deploy
    npm run dev                  # dashboard on :3000
    npx trigger.dev@latest dev   # local task runner

## Roadmap

- [ ] False-positive reduction: calldata clustering per contract
- [ ] Triage workflow (acknowledge / resolve / annotate anomalies)
- [ ] Per-contract historical analysis
- [ ] Read-only public API

## Author

Built and operated by **jeloercc** as independent Web3 security research
infrastructure. The dashboard is a triage tool, not financial or security
advice.
