import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export type Tone = 'positive' | 'warning' | 'negative' | 'neutral' | 'info';

const tones: Record<Tone, string> = {
  positive: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  negative: 'bg-rose-50 text-rose-700 ring-rose-200',
  neutral: 'bg-sand text-muted ring-line',
  info: 'bg-sage-50 text-sage-700 ring-sage-200'
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
