'use client';

import dynamic from 'next/dynamic';
import { Minus, Mountain, Plus, RotateCcw } from 'lucide-react';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { REGIONS, TERRAIN_TEXTURE, type Region } from '../model/terrain.model';
import type { TerrainControls } from './terrain-scene';

const TerrainScene = dynamic(() => import('./terrain-scene').then(module => module.TerrainScene), { ssr: false });
const DESKTOP = '(min-width: 1024px)';
const CONTROL = 'grid h-10 w-10 place-items-center rounded-xl border border-white/40 bg-forest/90 text-white hover:bg-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function TerrainMap() {
  const [desktop, setDesktop] = useState(false);
  const [status, setStatus] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const controls = useRef<TerrainControls | null>(null);
  const markers = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const sync = () => {
      setDesktop(query.matches);
      if (!query.matches) setStatus(current => current === 'fallback' ? current : 'loading');
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const live = desktop && status === 'live';
  const select = (next: Region) => {
    setRegion(next);
    controls.current?.focus(next);
  };
  const reset = () => {
    setRegion(REGIONS[0]);
    controls.current?.reset();
  };

  return (
    <aside aria-label="Explore our regions" className="relative isolate min-h-[17rem] overflow-hidden rounded-[1.5rem] bg-forest text-white lg:col-start-1 lg:row-start-1 lg:min-h-[31rem]">
      <div className="absolute inset-0 [container-type:size]" aria-hidden>
        {/* The same baked texture supplies the overview before the renderer is ready. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TERRAIN_TEXTURE} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_37%] lg:inset-auto lg:left-1/2 lg:top-1/2 lg:h-[min(113.66cqw,170.49cqh)] lg:w-[min(109.29cqw,163.93cqh)] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2 lg:object-fill" />
      </div>

      {desktop && status !== 'fallback' && (
        <div
          aria-hidden
          className={cn('absolute inset-0 touch-none transition-opacity duration-200 motion-reduce:transition-none', live ? 'cursor-grab opacity-100 active:cursor-grabbing' : 'pointer-events-none opacity-0')}
          onPointerDown={event => {
            if (!live || !event.isPrimary || event.button !== 0) return;
            controls.current?.interrupt();
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const previous = drag.current;
            if (previous?.id !== event.pointerId) return;
            controls.current?.pan(event.clientX - previous.x, event.clientY - previous.y);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onLostPointerCapture={() => { drag.current = null; }}
        >
          <SceneBoundary onFailure={() => setStatus('fallback')}>
            <TerrainScene controls={controls} markers={markers} activeRegion={region} onReady={() => setStatus('live')} onFailure={() => setStatus('fallback')} />
          </SceneBoundary>
        </div>
      )}

      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,22,.88)_0%,transparent_28%,transparent_66%,rgba(12,28,22,.94)_100%)]" />
      <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-3 lg:left-8 lg:top-8">
        <Mountain aria-hidden className="h-8 w-8 text-sage-200 lg:h-9 lg:w-9" strokeWidth={1.6} />
        <span className="text-sm font-semibold tracking-tight lg:text-base">Down to Earth Investments</span>
      </div>

      <div className="pointer-events-none absolute inset-0" hidden={!live}>
        {REGIONS.map((item, index) => (
          <div key={item.name} ref={element => { markers.current[index] = element; }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '50%' }}>
            <button
              type="button"
              aria-label={item.name}
              aria-pressed={region === item}
              onClick={() => select(item)}
              className="pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span data-terrain-pin aria-hidden className={cn('h-3 w-3 rounded-full border border-white/70 shadow-md', region === item ? 'bg-[#ffca77] shadow-[#ffca77]/50' : 'bg-sage-200 shadow-forest')} />
              {region !== item && (
                <span aria-hidden className={cn('absolute whitespace-nowrap rounded-md bg-forest/90 px-1.5 py-0.5 text-xs font-semibold', index === 2 ? 'left-1/2 top-8 -translate-x-1/2' : index === 1 ? 'right-8' : 'left-8')}>{item.name}</span>
              )}
            </button>
            {region === item && (
              <div aria-hidden className={cn('absolute bottom-10 w-max max-w-[11rem] rounded-xl border border-white/25 bg-forest/95 px-3 py-2 shadow-lg', index === 0 ? 'left-1' : 'right-1')}>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="mt-0.5 text-[11px] text-sage-200">{item.description}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 lg:p-8">
        <p className="text-[clamp(1.6rem,3.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.055em] text-white">
          Investments with<br /><span className="text-sage-200">solid ground.</span>
        </p>
        {!live && (
          <div className="mt-3">
            <div className="pointer-events-auto flex flex-wrap gap-1.5">
              {REGIONS.map(item => (
                <button key={item.name} type="button" aria-pressed={region === item} onClick={() => select(item)} className={cn('rounded-full border px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white', region === item ? 'border-sage-200 bg-sage-200 text-forest' : 'border-white/40 bg-forest/90 text-white hover:bg-sage-700')}>
                  {item.name}
                </button>
              ))}
            </div>
            <p aria-hidden className="mt-1.5 text-xs text-sage-200">{region.description}</p>
          </div>
        )}
      </div>

      {live && (
        <div role="group" aria-label="Map controls" className="absolute bottom-5 right-5 z-20 flex gap-1.5 xl:bottom-8 xl:right-8">
          <button type="button" aria-label="Zoom in" className={CONTROL} onClick={() => controls.current?.zoom(1.2)}><Plus aria-hidden size={18} /></button>
          <button type="button" aria-label="Zoom out" className={CONTROL} onClick={() => controls.current?.zoom(1 / 1.2)}><Minus aria-hidden size={18} /></button>
          <button type="button" aria-label="Reset map view" className={CONTROL} onClick={reset}><RotateCcw aria-hidden size={16} /></button>
        </div>
      )}
      <p className="sr-only" role="status">{region.name}: {region.description}</p>
    </aside>
  );
}
