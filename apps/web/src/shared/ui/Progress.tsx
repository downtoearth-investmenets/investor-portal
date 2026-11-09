import { cn } from '@/shared/lib/cn';

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-2 overflow-hidden rounded-full bg-sand', className)}
    >
      <div className="h-full rounded-full bg-sage-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
