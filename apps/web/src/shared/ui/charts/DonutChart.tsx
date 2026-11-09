import type { ReactNode } from 'react';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export const DONUT_COLORS = ['#3f7477', '#69a2a5', '#b6d4d6', '#443a26', '#a89a7c', '#d6cdb8', '#284a4c'];

/** Ring chart with a centre readout. Slices animate in on mount. */
export function DonutChart({ slices, size = 168, thickness = 18, center, label }: { slices: DonutSlice[]; size?: number; thickness?: number; center?: ReactNode; label: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-sand" />
        {total > 0 &&
          slices.map((slice, index) => {
            const length = (slice.value / total) * circumference;
            const dash = Math.max(length - gap, 0.5);
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-offset}
                className="animate-draw"
                style={{ animationDelay: `${index * 80}ms` }}
              />
            );
            offset += length;
            return element;
          })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

