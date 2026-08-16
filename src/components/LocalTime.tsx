'use client';
import { useEffect, useState } from 'react';

export default function LocalTime({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState('');
  useEffect(() => {
    setFormatted(
      new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    );
  }, [iso]);
  return <>{formatted || '—'}</>;
}