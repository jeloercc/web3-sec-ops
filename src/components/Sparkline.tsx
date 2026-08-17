import * as React from 'react';

interface SparklineProps {
  data: number[];
}

export const Sparkline: React.FC<SparklineProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const W = 700;
  const H = 80;
  const MX = 20;
  const MY = 10;
  const drawW = W - 2 * MX;
  const drawH = H - 2 * MY;
  const max = Math.max(...data, 1);
  const stepX = data.length > 1 ? drawW / (data.length - 1) : 0;

  const pts = data
    .map((v, i) => {
      const x = MX + i * stepX;
      const y = H - MY - (v / max) * drawH;
      return `${x},${y}`;
    })
    .join(' ');

  const area = `${pts} ${W - MX},${H - MY} ${MX},${H - MY}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="80"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <filter id="sparkglow">
          <feGaussianBlur stdDeviation="3" result="colored" />
          <feMerge>
            <feMergeNode in="colored" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon points={area} fill="rgba(0,240,255,0.12)" />
      <polyline
        points={pts}
        stroke="#00f0ff"
        strokeWidth={2.5}
        fill="none"
        filter="url(#sparkglow)"
      />
      {data.map((v, i) => {
        const x = MX + i * stepX;
        const y = H - MY - (v / max) * drawH;
        return (
          <circle key={i} cx={x} cy={y} r={3.5} fill="#00ff9c">
            <title>{String(v)}</title>
          </circle>
        );
      })}
    </svg>
  );
};

export default Sparkline;
