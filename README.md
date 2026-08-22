# web3-sec-ops

**Pipeline de inteligencia de amenazas on-chain para Ethereum mainnet.**  
Detección autónoma de comportamiento transaccional anómalo, seguimiento de programas de bug bounty y alertas en tiempo real — todo desplegado como sistema serverless.

[Dashboard en vivo](https://web3-sec-ops.vercel.app) · [Metodología](#metodología-de-detección) · [Arquitectura](#arquitectura) · [Despliegue](#despliegue-rápido)

---

## ¿Qué hace este proyecto?

web3-sec-ops monitoriza Ethereum mainnet buscando señales a nivel de transacción que son consistentes con actividad de explotación: **transacciones revertidas que consumen una porción desproporcionada de su gas limit**.

Estos eventos correlacionan con intentos de ataque fallidos — guards de reentrancy que saltan a mitad de ejecución, bucles de ataque que se agotan, o llamadas a contratos drenados/pausados.

El pipeline combina esta señal con una vista sincronizada de programas activos de bug bounty en smart contracts, convirtiendo datos crudos de la cadena en una cola de investigación priorizada para análisis manual de vulnerabilidades.

---

## Arquitectura

```
Ethereum mainnet (viem / Alchemy RPC)
             │  ventana horaria (50 bloques)
             ▼
┌────────────────────────────────────┐
│  etherscan-monitor (cron hourly)   │  filtro revert + gas-ratio
│  severity scoring                  │  CRITICAL ≥95% · HIGH ≥80% · MEDIUM ≥60%
└──────────────┬─────────────────────┘
               │  Prisma ORM
               ▼
┌────────────────────────────┐      ┌──────────────────────────┐
│  Neon Postgres (serverless)│◄─────│  immunefi-scraper        │
│  conexión pool @prisma/pg  │      │  sync diaria 8am UTC     │
└──────────────┬─────────────┘      └──────────────────────────┘
               │  SSR, revalidate=0
               ▼
┌────────────────────────────┐      ┌──────────────────────────┐
│  Next.js 16 Dashboard      │      │  Alertas Telegram        │
│  (Vercel, auto-refresh 60s)│      │  en CRITICAL / HIGH      │
└────────────────────────────┘      └──────────────────────────┘
```

**Todo es serverless**: Trigger.dev para tareas programadas, Neon para base de datos, Vercel para el frontend. No hay infraestructura persistente que mantener tras el despliegue.

---

## Modelo de datos

| Modelo | Propósito |
|--------|-----------|
| **SmartContract** | Contratos monitorizados (address + chain único) |
| **Anomaly** | Transacciones anómalas detectadas (tx hash único, blockNumber, metadata JSON) |
| **BountyProgram** | Programas de bug bounty (Immunefi, etc.) — unique (platform, protocol) |
| **Opportunity** | Hallazgos/oportunidades específicas dentro de un programa |
| **Vulnerability** | Vulnerabilidades identificadas (CVE, SWC ID, severity) |

Índices optimizados para: `severity`, `blockNumber`, `detectedAt`, `transactionHash` (único), `smartContractId`, `chain`.

---

## Metodología de detección

### Definición de la señal

Una transacción se marca como anómala cuando:

```
status == 0 (revert)  AND  gasUsed / gasLimit >= 0.60
```

### Racional

Los exploits fallidos típicamente queman la mayor parte de su gas antes de revertir: la lógica de cambio de estado se ejecuta hasta que un guard salta, una llamada interna agota el bucle, o el contrato objetivo rechaza la llamada. Un ratio alto de gas quemado en revert es un proxy barato y de alto recall para "algo adversarial se intentó aquí".

### Modelo de severidad

| Severidad | Gas quemado | Significado operacional |
|-----------|-------------|------------------------|
| **CRITICAL** | ≥ 95% | Alerta inmediata (Telegram) — probable exploit activo |
| **HIGH** | ≥ 80% | Alerta inmediata (Telegram) — comportamiento muy sospechoso |
| **MEDIUM** | ≥ 60% | Cola en dashboard para revisión manual |

### Limitaciones conocidas

La señal es **high-recall, no high-precision**: errores benignos de usuario (calldata mal configurado, reverts por slippage) también queman gas. El pipeline es un *front-end de triaje*; cada flag requiere revisión manual del contrato antes de clasificación. Reducción de falsos positivos (clustering de calldata, reputación de contratos) está en el roadmap.

---

## Estructura del repositorio

```
prisma/
  schema.prisma              # Modelos: Anomaly · SmartContract · BountyProgram · Opportunity · Vulnerability
  migrations/                # Migraciones SQL versionadas
  config.ts                  # Config Prisma + dotenv

src/
  app/
    page.tsx                 # Dashboard SSR (stats, anomalies, bounties)
    anomaly/[id]/page.tsx    # Vista forense de anomalía individual
    globals.css              # Tema HUD (grid, scanlines, glow, fonts)
    layout.tsx               # Metadata, fonts (Orbitron + JetBrains Mono)
  components/
    MatrixRain.tsx           # Fondo animado canvas
    Sparkline.tsx            # Gráfico SVG actividad 7 días
    LiveClock.tsx            # Reloj UTC en header
    LocalTime.tsx            # Formato fecha local para timestamps
    CountUp.tsx              # Animación contadores
    AutoRefresh.tsx          # Router.refresh() cada 60s
    GlitchTitle.tsx          # Título con efecto glitch CSS
  lib/
    prisma.ts                # Singleton PrismaClient + adapter-pg
    metadata-utils.ts        # Normalización gas percentage desde JSON
  trigger/
    etherscan-monitor.ts     # Tarea horaria: escaneo 50 bloques, detección anomalías
    immunefi-scraper.ts      # Tarea diaria: sync programas Immunefi
    example.ts               # Task de ejemplo Trigger.dev

trigger.config.ts            # Config proyecto Trigger.dev
next.config.ts               # Config Next.js (mínima)
tsconfig.json                # TypeScript strict, path aliases @/*
eslint.config.mjs            # ESLint 9 + next/core-web-vitals + typescript
```

---

## Despliegue rápido

### Prerrequisitos

- Node.js 20+
- Cuenta en [Neon](https://neon.tech) (Postgres serverless)
- Cuenta en [Trigger.dev](https://trigger.dev) (tareas programadas)
- API key de [Alchemy](https://alchemy.com) (RPC Ethereum)
- Bot de Telegram + Chat ID (para alertas)

### Variables de entorno

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

### Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Generar cliente Prisma + aplicar migraciones
npx prisma migrate deploy

# 3. Dashboard en http://localhost:3000
npm run dev

# 4. En otra terminal: runner local Trigger.dev
npx trigger.dev@latest dev
```

### Despliegue producción

| Componente | Plataforma | Comando |
|------------|------------|---------|
| Dashboard | Vercel | `vercel --prod` (conecta repo) |
| Tareas | Trigger.dev Cloud | `npx trigger.dev@latest deploy` |
| Base de datos | Neon | Automático via `DATABASE_URL` |

**Variables en producción**: Configura las mismas 5 variables en Vercel (Project Settings → Environment Variables) y Trigger.dev (Dashboard → Environment Variables).

---

## Scripts disponibles

```bash
npm run dev        # Next.js dev server (Turbopack)
npm run build      # Build producción + typecheck
npm run start      # Servidor producción
npm run lint       # ESLint
npm run test       # Vitest (unit tests)
npm run test:ui    # Vitest UI interactivo
npm run postinstall # prisma generate (auto en install)
```

---

## Roadmap

- [ ] **Reducción falsos positivos**: clustering de calldata por contrato
- [ ] **Workflow de triaje**: acknowledge / resolve / anotar anomalías
- [ ] **Análisis histórico por contrato**: patrones temporales, repeat offenders
- [ ] **API pública read-only**: endpoints para investigadores externos
- [ ] **Multi-chain**: Polygon, Arbitrum, Optimism, Base
- [ ] **Enriquecimiento**: decodificar calldata con ABI, etiquetas de contratos conocidos

---

## Decisiones técnicas clave

| Decisión | Razón |
|----------|-------|
| `@prisma/adapter-pg` + Neon | Pooling nativo serverless, sin connection limits |
| Trigger.dev vs cron jobs | Reintentos, observabilidad, idempotencia, maxDuration |
| Viem vs ethers v6 | Bundle size menor, tree-shaking, TypeScript-first |
| Next.js App Router + SSR | Datos siempre frescos (`revalidate=0`), SEO-friendly |
| Tailwind CSS v4 | Zero-config, CSS-first, bundle size mínimo |
| `transactionHash` unique constraint | Deduplicación a nivel DB, race-condition proof |

---

## Licencia

MIT — úsalo, modifícalo, despliégalo. Ver [LICENSE](LICENSE).

---

## Autor

Construido y operado por **jeloercc** como infraestructura independiente de investigación de seguridad Web3.

> **⚠️ Disclaimer**: El dashboard es una herramienta de triaje, **no** asesoramiento financiero ni de seguridad. Cada anomalía requiere verificación manual antes de actuar.

---

## Contribuir

1. Fork → branch → PR
2. `npm run lint && npm run test && npm run build` deben pasar
3. Commits convencionales (`feat:`, `fix:`, `chore:`, etc.)
4. Tests para nueva lógica de detección / utilidades

---

*¿Preguntas? Abre un issue o revisa la [documentación de Trigger.dev](https://trigger.dev/docs) y [Prisma](https://pris.ly/d).*