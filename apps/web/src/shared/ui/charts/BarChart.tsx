'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';

export type BarTone = 'primary' | 'secondary' | 'planned' | 'alert';

export interface BarSegment {
  label: string;
  value: number;
  tone: BarTone;
}

export interface BarDatum {
  key: string;
  label: string;
  /** Longer label for the tooltip. */
  title?: string;
  segments: BarSegment[];
  highlight?: boolean;
}

const TONE: Record<BarTone, string> = {
  primary: 'bg-sage-600',
  secondary: 'bg-sage-400',
  planned: 'bg-[repeating-linear-gradient(135deg,theme(colors.sage.200)_0_4px,theme(colors.sage.100)_4px_8px)]',
  alert: 'bg-rose-400'
};

export const BAR_TONE_SWATCH = TONE;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find(s => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Stacked monthly bars with a hover/focus readout. Domain-free. */
export function BarChart({
  data,
  format,
  formatAxis = format,
  height = 220,
  label
}: {
  data: BarDatum[];
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
  /** Pixel height, or 'fill' to stretch to the parent's height. */
  height?: number | 'fill';
  label: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const totals = data.map(d => d.segments.reduce((total, s) => total + s.value, 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [max, max / 2, 0];
  const focused = data.find(d => d.key === active) ?? null;

  return (
    <figure className={cn('relative', height === 'fill' && 'h-full min-h-[110px]')} style={height === 'fill' ? undefined : { height }} aria-label={label}>
      <div className="flex h-full gap-3">
        <div className="flex h-full shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted">
          {ticks.map(tick => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatAxis(tick)}
            </span>
          ))}
        </div>

        <div className="relative h-full min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between" aria-hidden>
            {ticks.map(tick => (
              <span key={tick} className="block border-t border-dashed border-line" />
            ))}
          </div>

          <ol className="relative flex h-full items-end gap-[6px] sm:gap-2" onMouseLeave={() => setActive(null)}>
            {data.map((datum, index) => {
              const total = totals[index];
              const isActive = active === datum.key;
              return (
                <li key={datum.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <button
                    type="button"
                    onMouseEnter={() => setActive(datum.key)}
                    onFocus={() => setActive(datum.key)}
                    onBlur={() => setActive(null)}
                    aria-label={`${datum.title ?? datum.label}: ${datum.segments.map(s => `${s.label} ${format(s.value)}`).join(', ')}`}
                    className="group relative flex w-full max-w-[44px] flex-1 flex-col justify-end rounded-t-lg outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
                  >
                    <span
                      className={cn(
                        'flex w-full origin-bottom animate-grow flex-col-reverse overflow-hidden rounded-[10px] transition-[opacity,filter] duration-200',
                        active && !isActive && 'opacity-40',
                        total === 0 && 'h-[3px] bg-line'
                      )}
                      style={{ height: total > 0 ? `${(total / max) * 100}%` : undefined, animationDelay: `${index * 25}ms` }}
                    >
                      {datum.segments
                        .filter(s => s.value > 0)
                        .map(segment => (
                          <span key={segment.label} className={cn('block w-full', TONE[segment.tone])} style={{ height: `${(segment.value / total) * 100}%` }} />
                        ))}
                    </span>
                  </button>
                  <span className={cn('h-4 text-[11px] leading-4', datum.highlight ? 'font-semibold text-ink' : 'text-muted')}>{datum.label}</span>
                </li>
              );
            })}
          </ol>

          {focused && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-52 animate-pop-in rounded-xl bg-ink px-3.5 py-3 text-xs text-white shadow-pop"
              style={{
                left: `clamp(0px, calc(${((data.indexOf(focused) + 0.5) / data.length) * 100}% - 104px), calc(100% - 208px))`
              }}
            >
              <p className="mb-2 font-semibold">{focused.title ?? focused.label}</p>
              {focused.segments.map(segment => (
                <p key={segment.label} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="flex items-center gap-2 text-white/70">
                    <span className={cn('h-2 w-2 rounded-full', TONE[segment.tone])} />
                    {segment.label}
                  </span>
                  <span className="tabular-nums">{format(segment.value)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

export function ChartLegend({ items }: { items: { label: string; tone: BarTone }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-[3px]', TONE[item.tone])} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

