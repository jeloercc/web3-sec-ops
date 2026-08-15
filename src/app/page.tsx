import { prisma } from '@/lib/prisma';
import CountUp from '@/components/CountUp';
import LiveClock from '@/components/LiveClock';
import GlitchTitle from '@/components/GlitchTitle';
import MatrixRain from '@/components/MatrixRain';

export const dynamic = 'force-dynamic';

async function getStats() {
  const anomalies = await prisma.anomaly.findMany({
    orderBy: { detectedAt: 'desc' },
    include: { smartContract: true },
    take: 50,
  });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totalAnomalies = anomalies.length;
  const last24hCount = anomalies.filter((a) => a.detectedAt >= last24h).length;
  const uniqueContracts = new Set(anomalies.map((a) => a.smartContractId)).size;

  // Latest block number from anomalies
  const lastBlock = anomalies.length > 0
    ? Math.max(...anomalies.map((a) => Number(a.blockNumber ?? 0)))
    : '-';

  return { anomalies, stats: { totalAnomalies, last24h: last24hCount, uniqueContracts, lastBlock } };
}

// Helper for relative time formatting
const formatRelativeTime = (date: Date) => {
  const diffMinutes = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60));
  if (diffMinutes < 1) return 'hace <1m';
  if (diffMinutes < 60) return `hace ${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays}d`;
  return `hace ${Math.floor(diffDays / 30)}mes`;
};

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500 text-white border-red-400/30',
  high: 'bg-red-600 text-white border-red-400/30',
  medium: 'bg-amber-500 text-black border-amber-400/30',
  low: 'bg-zinc-500 text-white border-zinc-400/30',
};

export default async function HomePage() {
  const { anomalies, stats } = await getStats();

  return (
    <main className="bg-zinc-950 min-h-screen text-zinc-100 font-mono overflow-x-auto">
      {/* Header with MatrixRain background */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 relative">
        <MatrixRain className="absolute inset-0 pointer-events-none z-0" />
        <div className="flex items-center justify-between">
          <GlitchTitle text="WEB3 SEC-OPS // ON-CHAIN THREAT INTELLIGENCE" />
          <div className="flex items-center gap-2">
            <span className="neon-green text-xs font-bold uppercase tracking-wider">● LIVE</span>
            <LiveClock />
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Total Anomalies Card */}
          <div className="hud-card border-cyan-400/20">
            <div className="text-zinc-500 text-xs uppercase tracking-widest">TOTAL ANOMALIES</div>
            <CountUp target={stats.totalAnomalies} duration={1200} className="text-4xl font-bold neon-cyan" />
          </div>
          {/* Last 24h Card */}
          <div className="hud-card border-amber-400/20">
            <div className="text-zinc-500 text-xs uppercase tracking-widest">LAST 24H</div>
            <CountUp target={stats.last24h} duration={1200} className="text-4xl font-bold neon-yellow" />
          </div>
          {/* Contracts Card */}
          <div className="hud-card border-green-400/20">
            <div className="text-zinc-500 text-xs uppercase tracking-widest">CONTRACTS TRACKED</div>
            <CountUp target={stats.uniqueContracts} duration={1200} className="text-4xl font-bold neon-green" />
          </div>
        </div>
      </section>

      {/* Anomalies Table */}
      <section className="p-6">
        <h2 className="text-zinc-300 text-lg font-semibold mb-4">// RECENT ANOMALIES</h2>
        {anomalies.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">No anomalies detected yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-cyan-400/60">
                  <th className="py-3 px-3">SEVERITY</th>
                  <th className="py-3 px-3">TX HASH</th>
                  <th className="py-3 px-3">BLOCK</th>
                  <th className="py-3 px-3">CONTRACT</th>
                  <th className="py-3 px-3">GAS BURNED</th>
                  <th className="py-3 px-3">DETECTED</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anomaly) => {
                  // Severity badge
                  const severity = anomaly.severity as 'low' | 'medium' | 'high' | 'critical';
                  const severityClass = severityStyles[severity] || 'bg-zinc-500 text-white';

                  // Gas burned from metadata
                  const metadata = anomaly.metadata as
                    | { gasUsageRatio?: number }
                    | undefined;
                  const gasRatio = metadata?.gasUsageRatio
                    ? Math.round(metadata.gasUsageRatio * 100)
                    : null;
                  const gasBurned = gasRatio !== null ? (
                    <div className="h-6 w-60 bg-gradient-to-r from-green-500 to-red-500 rounded-lg overflow-hidden">
                      <div className="h-full w-full bg-green-500 transition-all duration-500" style={{ width: `${gasRatio}%` }} />
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  );

                  // Relative time
                  const detectedAt = anomaly.detectedAt
                    ? new Date(anomaly.detectedAt)
                    : new Date(0);
                  const relativeTime = formatRelativeTime(detectedAt);

                  // Contract address truncation
                  const contractAddress = anomaly.smartContract
                    ? `${anomaly.smartContract.address.slice(0, 6)}...${anomaly.smartContract.address.slice(-4)}`
                    : '-';

                  return (
                    <tr
                      key={anomaly.id}
                      className="border-b border-zinc-800 hover:bg-cyan-400/5 hover:translate-x-1 transition"
                    >
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${severityClass}`}>
                          {severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <a
                          href={`https://etherscan.io/tx/${anomaly.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {anomaly.transactionHash.slice(0, 6)}...${anomaly.transactionHash.slice(-4)}
                        </a>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 font-mono text-sm">
                        {anomaly.blockNumber?.toString() ?? '-'}
                      </td>
                      <td className="py-3 px-3">
                        <a
                          href={`https://etherscan.io/address/${anomaly.smartContract?.address ?? ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {contractAddress}
                        </a>
                      </td>
                      <td className="py-3 px-3">{gasBurned}</td>
                      <td className="py-3 px-3 text-zinc-400 text-sm font-mono">
                        {relativeTime}
                        <span title={anomaly.detectedAt?.toISOString() ?? ''} className="ml-2 text-xs opacity-60">
                          at {new Date(anomaly.detectedAt?.getTime() ?? 0).toLocaleTimeString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="p-6 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-500">
        SCANNING ETHEREUM MAINNET // LAST BLOCK: {stats.lastBlock} // UPLINK: ALCHEMY
        <span className="animate-pulse ml-2">▮</span>
      </footer>
    </main>
  );
}