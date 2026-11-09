import { Mountain } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-600 text-white', className)} aria-hidden>
      <Mountain className="h-[18px] w-[18px]" />
    </span>
  );
}

export function Brand({ tone = 'dark', subtitle }: { tone?: 'dark' | 'light'; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <p className={cn('text-sm font-semibold tracking-wide', tone === 'light' ? 'text-white' : 'text-ink')}>Down to Earth</p>
        {subtitle && <p className={cn('text-xs', tone === 'light' ? 'text-white/60' : 'text-muted')}>{subtitle}</p>}
      </div>
    </div>
  );
}
