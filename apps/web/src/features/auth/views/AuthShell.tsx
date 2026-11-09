import type { ReactNode } from 'react';
import { CalendarCheck, Landmark, MapPinned } from 'lucide-react';
import { Brand } from '@/shared/ui/Brand';

const HIGHLIGHTS = [
  { icon: MapPinned, label: 'Secured by recorded land' },
  { icon: Landmark, label: 'Fixed-rate notes' },
  { icon: CalendarCheck, label: 'Monthly payments' }
];

function ContourLines() {
  const rings = Array.from({ length: 9 }, (_, index) => index);
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="login-glow" cx="82%" cy="88%" r="65%">
          <stop offset="0%" stopColor="#69a2a5" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#69a2a5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="800" fill="url(#login-glow)" />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.08" transform="rotate(-14 480 690)">
        {rings.map(i => (
          <ellipse key={i} cx={480 + i * 6} cy={690 - i * 4} rx={60 + i * 46} ry={38 + i * 31} />
        ))}
      </g>
      <g fill="none" stroke="#ffffff" strokeOpacity="0.05" transform="rotate(12 110 120)">
        {rings.slice(0, 6).map(i => (
          <ellipse key={i} cx={110} cy={120} rx={40 + i * 36} ry={26 + i * 24} />
        ))}
      </g>
    </svg>
  );
}

function Showcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-forest text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <ContourLines />
      <div className="relative">
        <Brand tone="light" />
      </div>
      <div className="relative max-w-md">
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
          Land-backed notes,
          <br />
          <span className="text-sage-200">reported clearly.</span>
        </h2>
        <p className="mt-5 text-base text-white/70">Your notes, payments, and the land behind them in one place.</p>
      </div>
      <ul className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
        {HIGHLIGHTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col gap-3">
            <Icon className="h-5 w-5 text-sage-200" aria-hidden />
            <span className="text-sm text-white/80">{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Split-screen frame shared by sign-in, password reset, and invite pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <Showcase />
      <main className="flex flex-col overflow-y-auto px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm animate-rise py-10">{children}</div>
      </main>
    </div>
  );
}

