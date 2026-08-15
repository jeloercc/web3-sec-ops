'use client';
import { useEffect, useState } from 'react';

interface CountUpProps {
  target: number;
  duration?: number;
}

export default function CountUp({ target, duration = 1200 }: CountUpProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <>{count.toLocaleString()}</>;
}