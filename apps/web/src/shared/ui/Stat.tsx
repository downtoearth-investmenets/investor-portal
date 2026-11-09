import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from './States';

export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card lg:grid-cols-4', className)}>
      {children}
    </dl>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-4 sm:px-6 sm:py-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums text-ink sm:text-2xl">{value}</dd>
      {hint && <dd className="mt-1 text-sm text-muted">{hint}</dd>}
    </div>
  );
}

export function StatGroupSkeleton({ count = 4 }: { count?: number }) {
  return (
    <StatGroup>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-surface px-5 py-5 sm:px-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
        </div>
      ))}
    </StatGroup>
  );
}
