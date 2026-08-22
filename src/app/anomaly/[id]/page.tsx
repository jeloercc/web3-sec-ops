import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { extractGas } from '@/lib/metadata-utils';
import MatrixRain from '@/components/MatrixRain';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500 text-white border-red-400/30',
  high: 'bg-red-600 text-white border-red-400/30',
  medium: 'bg-amber-500 text-black border-amber-400/30',
  low: 'bg-zinc-500 text-white border-zinc-400/30',
};

export default async function AnomalyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const anomaly = await prisma.anomaly.findUnique({
    where: { id: Number(id) },
    include: { smartContract: true },
  });

  if (!anomaly) {
    notFound();
  }

  const severity = anomaly.severity as 'low' | 'medium' | 'high' | 'critical';
  const severityClass = severityStyles[severity] || 'bg-zinc-500 text-white';

  const gas = extractGas(anomaly.metadata);
  const gasPercentDisplay = gas !== null ? `${gas}%` : "—";
  const gasBurnedBar = gas !== null ? (
    <div className="h-10 w-full bg-zinc-800 rounded-lg overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-green-500 to-red-500"
        style={{ width: `${gas}%` }}
      />
    </div>
  ) : (
    <span className="text-zinc-400">—</span>
  );

  const metadataJson = anomaly.metadata ? JSON.stringify(anomaly.metadata, null, 2) : 'null';

  const contractAddress = anomaly.smartContract?.address ?? '-';
  const contractLink = anomaly.smartContract?.address
    ? `https://etherscan.io/address/${anomaly.smartContract.address}`
    : '#';

  const txLink = `https://etherscan.io/tx/${anomaly.transactionHash}`;
  const detectedIso = anomaly.detectedAt ? new Date(anomaly.detectedAt).toISOString() : '';

  return (
    <main className="bg-zinc-950 min-h-screen text-zinc-100 font-mono overflow-x-auto relative">
      <MatrixRain />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="neon-cyan hover:text-cyan-300 transition-colors font-mono text-sm"
          >
            ← BACK TO DASHBOARD
          </Link>
        </div>
      </header>

      {/* Detail Card */}
      <section className="p-6">
        <div className="hud-card max-w-5xl mx-auto">
          {/* Header: severity badge + title */}
          <div className="flex items-start justify-between mb-6">
            <span
              className={`px-3 py-1 rounded text-sm font-bold ${severityClass}`}
            >
              {severity.toUpperCase()}
            </span>
            <h1 className="text-zinc-200 font-mono text-sm break-all text-right max-w-xs">
              {anomaly.title}
            </h1>
          </div>

          {/* TRANSACTION */}
          <div className="mb-6">
            <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
              TRANSACTION
            </div>
            <a
              href={txLink}
              target="_blank"
              rel="noopener noreferrer"
              className="neon-green text-sm font-mono break-all block"
            >
              {anomaly.transactionHash}
            </a>
          </div>

          {/* BLOCK + DETECTED */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
                BLOCK
              </div>
              <div className="text-zinc-300 font-mono text-sm">
                {anomaly.blockNumber?.toString() ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
                DETECTED
              </div>
              <div className="text-zinc-300 font-mono text-sm">
                <LocalTime iso={detectedIso} />
              </div>
            </div>
          </div>

          {/* GAS BURNED */}
          <div className="mb-6">
            <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-2">
              GAS BURNED <span className="text-zinc-400 ml-2">{gasPercentDisplay}</span>
            </div>
            {gasBurnedBar}
          </div>

          {/* CONTRACT */}
          <div className="mb-6">
            <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
              CONTRACT
            </div>
            <a
              href={contractLink}
              target="_blank"
              rel="noopener noreferrer"
              className="neon-cyan text-sm font-mono break-all block"
            >
              {contractAddress}
            </a>
          </div>

          {/* METADATA */}
          <div className="mb-6">
            <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
              METADATA
            </div>
            <pre className="text-xs text-zinc-400 bg-black/40 p-4 overflow-x-auto rounded">
              {metadataJson}
            </pre>
          </div>

          {/* Description */}
          <div>
            <div className="text-cyan-400/60 text-[10px] uppercase tracking-widest mb-1">
              DESCRIPTION
            </div>
            <p className="text-zinc-300 text-sm">{anomaly.description}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
