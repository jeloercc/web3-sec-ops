'use client';
export default function GlitchTitle({ text }: { text: string }) {
  return (
    <h1 className="glitch-title font-[Orbitron] text-2xl font-black tracking-wider neon-cyan">
      {text}
    </h1>
  );
}