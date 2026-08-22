'use client';

export default function LocalTime({ iso }: { iso: string }) {
  const formatted = iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '—';
  return <>{formatted}</>;
}