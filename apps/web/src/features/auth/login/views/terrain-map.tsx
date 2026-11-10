'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Compass, Layers, Mountain, Orbit, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/format';
import {
  PRINCIPAL_MAX,
  PRINCIPAL_MIN,
  PRINCIPAL_PRESETS,
  PRINCIPAL_STEP,
  type RenderMode
} from '../model/terrain.model';
import { useTerrainViewModel } from '../view-models/use-terrain.vm';
import { TerrainScene } from './terrain-scene';

const RENDER_MODES: { id: RenderMode; label: string }[] = [
  { id: 'relief', label: '3D Relief' },
  { id: 'contours', label: 'Strata' },
  { id: 'survey', label: 'CAD Grid' }
];

export function TerrainMap() {
  const vm = useTerrainViewModel();
  const [resetToken, setResetToken] = useState(0);
  const reducedMotion = useReducedMotion();
  const { activeTract, simulation, probe, activeSlice } = vm;

  return (
    <aside
      aria-label="Interactive land-backed note studio"
      className="relative isolate flex min-h-[32rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101c17] p-5 text-white shadow-pop sm:p-6 lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0 lg:p-7 xlshort:p-5"
    >
      {/* Ambient architectural background glow & fine survey grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(110% 80% at 18% 12%, rgba(105, 162, 165, 0.20) 0%, transparent 58%), radial-gradient(90% 75% at 86% 88%, rgba(255, 202, 119, 0.12) 0%, transparent 62%), linear-gradient(180deg, #13231d 0%, #0d1713 100%)'
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #eef5f5 1px, transparent 1px), linear-gradient(to bottom, #eef5f5 1px, transparent 1px)',
          backgroundSize: '36px 36px'
        }}
      />

      {/* Top Header: Brand + Interactive View Mode Switcher */}
      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-sage-200 shadow-inner backdrop-blur-md">
            <Mountain aria-hidden className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Down to Earth Investments</p>
            <p className="text-[11px] text-sage-200/75">Illustrative terrain &amp; payment examples</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="3D parcel display mode"
            className="flex items-center rounded-xl border border-white/10 bg-black/25 p-1 backdrop-blur-md"
          >
            {RENDER_MODES.map(mode => {
              const active = vm.renderMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => vm.setRenderMode(mode.id)}
                  aria-pressed={active}
                  className={cn(
                    'relative rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white',
                    active ? 'text-forest' : 'text-white/70 hover:text-white'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={reducedMotion ? undefined : 'login-render-mode-pill'}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-sage-200"
                    />
                  )}
                  <span className="relative z-10">{mode.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={vm.toggleAutoOrbit}
            disabled={!!reducedMotion}
            aria-pressed={vm.autoOrbit}
            title={vm.autoOrbit ? 'Pause 3D orbit' : 'Resume 3D orbit'}
            aria-label={vm.autoOrbit ? 'Pause 3D orbit' : 'Resume 3D orbit'}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white',
              vm.autoOrbit
                ? 'border-sage-200/50 bg-sage-200/15 text-sage-200'
                : 'border-white/10 bg-black/25 text-white/60 hover:text-white'
            )}
          >
            <Orbit aria-hidden className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setResetToken(token => token + 1);
              vm.setAutoOrbit(false);
            }}
            title="Reset 3D parcel angle"
            aria-label="Reset 3D parcel angle"
            className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Center Stage: Interactive 3D Sculpted Parcel Canvas */}
      <div className="relative z-10 my-2 min-h-[13.5rem] flex-1 select-none lg:min-h-[12rem]">
        <TerrainScene
          tractIndex={vm.tractIndex}
          tract={activeTract}
          renderMode={vm.renderMode}
          autoOrbit={vm.autoOrbit && !reducedMotion}
          resetToken={resetToken}
          onProbeChange={vm.setProbe}
          onManualOrbit={() => vm.setAutoOrbit(false)}
        />

        {/* Top-left floating parcel survey badge */}
        <div className="pointer-events-none absolute left-0 top-1 flex flex-wrap items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTract.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0d1814]/80 px-3 py-1.5 backdrop-blur-md"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeTract.accentHex, boxShadow: '0 0 10px ' + activeTract.accentHex }}
              />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold text-white">{activeTract.name}</span>
                <span className="mx-1.5 text-white/30">·</span>
                <span className="text-sage-200">{activeTract.county}, {activeTract.state}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Top-right live cursor elevation & slope telemetry */}
        <div className="pointer-events-none absolute right-0 top-1 hidden sm:block">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1814]/80 px-3 py-1.5 text-[11px] tabular-nums text-white/80 backdrop-blur-md">
            <Compass aria-hidden className="h-3.5 w-3.5 text-sage-200" />
            {probe ? (
              <span>
                Elev <strong className="font-semibold text-white">{probe.elevationFt.toLocaleString()} ft</strong>
                <span className="mx-1 text-white/30">·</span>
                Slope <strong className="font-semibold text-sage-200">{probe.slopeDeg}°</strong>
              </span>
            ) : (
              <span>
                Datum <strong className="font-semibold text-white">{activeTract.baseElevationFt.toLocaleString()} ft</strong>
                <span className="mx-1 text-white/30">·</span>
                <span className="text-sage-200">+{activeTract.reliefFt} ft relief</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom-left interaction prompt */}
        <div className="pointer-events-none absolute bottom-1 left-0 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] text-white/65 backdrop-blur-sm">
          <Layers aria-hidden className="h-3 w-3 text-sage-200" />
          <span>Drag 3D parcel to orbit · Click terrain to pulse survey</span>
        </div>
      </div>

      {/* Bottom Interactive Deck: Headline + Tract Selector + Note & Yield Scrubber */}
      <div className="relative z-20 shrink-0 space-y-3.5 xlshort:space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[clamp(1.55rem,2.6vw,2.35rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-white xlshort:text-[1.6rem]">
              Investments with <span className="text-sage-200">solid ground.</span>
            </p>
            <p className="mt-1 text-xs text-white/65 xlshort:hidden">{activeTract.summary}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-sage-200/25 bg-sage-200/10 px-3 py-1 text-xs font-medium text-sage-100">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-sage-200" />
            <span>{simulation.coverageMultiple.toFixed(2)}× Example Collateral</span>
          </div>
        </div>

        {/* Interactive Tract Switcher Tabs */}
        <div
          role="group"
          aria-label="Select an example terrain profile"
          className="grid grid-cols-3 gap-2"
        >
          {vm.tracts.map((tract, idx) => {
            const selected = idx === vm.tractIndex;
            return (
              <button
                key={tract.id}
                type="button"
                aria-pressed={selected}
                onClick={() => vm.selectTract(idx)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white xlshort:py-2',
                  selected
                    ? 'border-white/30 bg-white/[0.11] shadow-md'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                )}
              >
                {selected && (
                  <motion.div
                    layoutId={reducedMotion ? undefined : 'active-tract-card-glow'}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="pointer-events-none absolute inset-0 rounded-2xl border border-sage-200/45 bg-gradient-to-br from-white/[0.08] to-transparent"
                  />
                )}
                <div className="relative z-10 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-white">{tract.shortName}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-forest"
                    style={{ backgroundColor: tract.accentHex }}
                  >
                    {tract.fixedRate}%
                  </span>
                </div>
                <p className="relative z-10 mt-0.5 truncate text-[11px] text-white/65">
                  {tract.acreage} acres · {tract.termMonths}m
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Note Principal & 12-Month Cashflow Simulator Card */}
        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-3.5 backdrop-blur-md xlshort:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="h-3.5 w-3.5 text-[#ffca77]" />
              <label htmlFor="login-note-principal-slider" className="text-xs font-medium text-white/80">
                Example note principal
              </label>
            </div>
            <div className="flex items-center gap-1">
              {PRINCIPAL_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => vm.setPrincipal(preset)}
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white',
                    vm.principal === preset
                      ? 'bg-sage-200 text-forest font-semibold'
                      : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.14] hover:text-white'
                  )}
                >
                  ${preset / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Smooth range slider */}
          <div className="mt-2.5 flex items-center gap-3">
            <input
              id="login-note-principal-slider"
              type="range"
              min={PRINCIPAL_MIN}
              max={PRINCIPAL_MAX}
              step={PRINCIPAL_STEP}
              value={vm.principal}
              onChange={event => vm.setPrincipal(Number(event.target.value))}
              aria-label="Simulated note principal amount"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#ffca77] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            />
            <span className="min-w-[5.25rem] text-right text-sm font-semibold tabular-nums text-white">
              {formatMoney(vm.principal)}
            </span>
          </div>

          {/* Live 3-column note figures */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Monthly payment</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#ffca77] sm:text-base">
                {formatMoney(Math.round(simulation.monthlyPayment))}
                <span className="text-[11px] font-normal text-white/60">/mo</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Year 1 payments</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white sm:text-base">
                {formatMoney(Math.round(simulation.annualIncome))}
                <span className="text-[11px] font-normal text-white/60">/yr</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Example land value</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-sage-200 sm:text-base">
                {formatMoney(simulation.collateralValue)}
              </p>
            </div>
          </div>

          {/* Interactive 12-Month Installment Schedule Scrubber */}
          <div className="mt-2.5 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-white/60">
                {activeSlice
                  ? 'Month #' + activeSlice.month + ' installment split'
                  : 'Year 1 monthly schedule (hover bars to inspect)'}
              </span>
              <span className="tabular-nums text-sage-200">
                {activeSlice
                  ? formatMoney(Math.round(activeSlice.interest)) + ' interest · ' + formatMoney(Math.round(activeSlice.principal)) + ' principal'
                  : Math.round(activeTract.ltvRatio * 100) + '% loan-to-value'}
              </span>
            </div>

            <div
              className="mt-1.5 grid h-7 grid-cols-12 items-end gap-1"
              onMouseLeave={() => vm.setHoveredMonth(null)}
            >
              {simulation.firstYearSlices.map(slice => {
                const isHovered = vm.hoveredMonth === slice.month;
                const interestPct = Math.round(slice.interestShare * 100);
                return (
                  <button
                    key={slice.month}
                    type="button"
                    onMouseEnter={() => vm.setHoveredMonth(slice.month)}
                    onFocus={() => vm.setHoveredMonth(slice.month)}
                    onClick={() => vm.setHoveredMonth(slice.month)}
                    onBlur={() => vm.setHoveredMonth(null)}
                    aria-label={'Month ' + slice.month + ': ' + formatMoney(Math.round(slice.interest)) + ' interest, ' + formatMoney(Math.round(slice.principal)) + ' principal'}
                    className="group relative flex h-full w-full items-end rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                  >
                    <span
                      className={cn(
                        'flex h-full w-full flex-col overflow-hidden rounded-sm transition-all duration-150 motion-reduce:transition-none',
                        isHovered ? 'scale-y-105 ring-1 ring-[#ffca77]' : 'opacity-85 group-hover:opacity-100'
                      )}
                    >
                      <span
                        className={cn('w-full transition-colors', isHovered ? 'bg-[#ffca77]' : 'bg-[#ffca77]/75')}
                        style={{ height: interestPct + '%' }}
                      />
                      <span
                        className={cn('w-full flex-1 transition-colors', isHovered ? 'bg-sage-200' : 'bg-sage-400/75')}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status">
        {activeTract.name}, {activeTract.acreage} acres in {activeTract.county}, {activeTract.state}. Fixed rate {activeTract.fixedRate} percent.
      </p>
    </aside>
  );
}
