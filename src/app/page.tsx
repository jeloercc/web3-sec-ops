import { prisma } from '@/lib/prisma';

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

  return { anomalies, stats: { totalAnomalies, last24h: last24hCount, uniqueContracts } };
}

function truncateAddress(address: string) {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function getSeverityBadge(severity: string) {
  const styles = {
    critical: 'bg-red-500 text-white',
    high: 'bg-red-600 text-white',
    medium: 'bg-amber-500 text-black',
    low: 'bg-green-500 text-black',
  };
  const style = styles[severity as keyof typeof styles] || 'bg-zinc-500 text-white';
  return severity.toUpperCase();
}

export default async function HomePage() {
  const { anomalies, stats } = await getStats();

  return (
    <main className="bg-zinc-950 min-h-screen text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <h1 className="text-green-400 text-2xl font-bold tracking-wider">
          WEB3 SEC-OPS // ON-CHAIN THREAT INTELLIGENCE
        </h1>
      </header>

      {/* Stats Cards */}
      <section className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-4">
            <div className="text-zinc-500 text-sm mb-1">TOTAL ANOMALIES</div>
            <div className="text-3xl font-bold text-green-400">{stats.totalAnomalies}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-4">
            <div className="text-zinc-500 text-sm mb-1">LAST 24H</div>
            <div className="text-3xl font-bold text-amber-400">{stats.last24h}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-4">
            <div className="text-zinc-500 text-sm mb-1">CONTRACTS TRACKED</div>
            <div className="text-3xl font-bold text-blue-400">{stats.uniqueContracts}</div>
          </div>
        </div>
      </section>

      {/* Anomalies Table */}
      <section className="px-6 pb-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-300">Recent Anomalies</h2>
        {anomalies.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            No anomalies detected yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-3 text-zinc-500 text-xs uppercase tracking-wider">SEVERITY</th>
                  <th className="text-left py-3 px-3 text-zinc-500 text-xs uppercase tracking-wider">TX HASH</th>
                  <th className="text-left py-3 px-3 text-zinc-500 text-xs uppercase tracking-wider">BLOCK</th>
                  <th className="text-left py-3 px-3 text-zinc-500 text-xs uppercase tracking-wider">CONTRACT</th>
                  <th className="text-left py-3 px-3 text-zinc-500 text-xs uppercase tracking-wider">DETECTED</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anomaly) => (
                  <tr
                    key={anomaly.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase">
                        {getSeverityBadge(anomaly.severity)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <a
                        href={`https://etherscan.io/tx/${anomaly.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline font-mono text-xs"
                      >
                        {truncateAddress(anomaly.transactionHash)}
                      </a>
                    </td>
                    <td className="py-3 px-3 text-zinc-300 font-mono text-sm">
                      {anomaly.blockNumber.toString()}
                    </td>
                    <td className="py-3 px-3">
                      {anomaly.smartContract ? (
                        <a
                          href={`https://etherscan.io/address/${anomaly.smartContract.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline font-mono text-xs"
                        >
                          {truncateAddress(anomaly.smartContract.address)}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 text-xs font-mono">
                      {anomaly.detectedAt ? formatDate(new Date(anomaly.detectedAt)) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}