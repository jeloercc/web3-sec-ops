'use client';

import { prisma } from '@/lib/prisma';
import AnimatedCounter from '@/components/AnimatedCounter';

interface ContractStatus {
  active: number;
  inactive: number;
  reTesting: number;
}

export default async function ContractStats() {
  const [stats] = await prisma.$transaction([
    prisma.contract.aggregate({
      _count: true,
      where: { status: 'active' }
    }),
    prisma.contract.aggregate({
      _count: true,
      where: { status: 'inactive' }
    }),
    prisma.contract.aggregate({
      _count: true,
      where: { status: 're-testing' }
    })
  ]);

  const [activeCount, inactiveCount, reTestingCount] = [
    stats[0]._count,
    stats[1]._count,
    stats[2]._count
  ];

  return (
    <div className="bg-black text-white font-technos infinite_pulsate-pulse text-xl md:text-2xl text-center py-8 animate-fadeIn">
      <div className="container mx-auto px-4 flex justify-between md:flex-col items-center pb-3">
        <div className="text-lime-500">
          <p className="font-monospace mb-1">Contracts Active</p>
          <AnimatedCounter text={activeCount} />
        </div>
        <div className="text-yellow-300">
          <p className="font-monospace mb-1">Contracts Inactive</p>
          <AnimatedCounter text={inactiveCount} />
        </div>
        <div className="text-red-300">
          <p className="font-monospace mb-1">Contracts Under Review</p>
          <AnimatedCounter text={reTestingCount} />
        </div>
      </div>
    </div>
  );
}