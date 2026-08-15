'use client';
import { useState, useEffect } from 'react';

export default function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toISOString().slice(11, 19));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return <span className="font-mono text-cyan-400">{time} UTC</span>;
}