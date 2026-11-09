import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface MetricItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'alert';
}

/** Figures in a row separated by hairlines. No boxes. */
export function MetricStrip({ items, className, dense = false }: { items: MetricItem[]; className?: string; dense?: boolean }) {
  return (
    <dl className={cn('grid grid-cols-2 border-y border-line sm:grid-cols-4', className)}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'min-w-0 sm:px-6 sm:first:pl-0',
            dense ? 'py-4 xlshort:py-3' : 'py-5',
            index % 2 === 1 && 'pl-5 sm:pl-6',
            index > 0 && 'sm:border-l sm:border-line',
            index % 2 === 1 && 'border-l border-line',
            index >= 2 && 'border-t border-line sm:border-t-0'
          )}
        >
          <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{item.label}</dt>
          <dd className={cn('mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums', item.tone === 'alert' ? 'text-rose-700' : 'text-ink')}>{item.value}</dd>
          {item.hint && <dd className="mt-0.5 truncate text-xs text-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function ProgressRing({ value, size = 36, stroke = 4, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(Math.max(value, 0), 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-sand" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        className="animate-draw stroke-sage-600"
      />
    </svg>
  );
}

/** Small uppercase section title with an optional trailing action. */
export function Eyebrow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

