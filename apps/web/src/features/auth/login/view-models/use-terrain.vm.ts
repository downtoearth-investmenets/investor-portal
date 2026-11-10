'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calculateNoteSimulation,
  LAND_TRACTS,
  PRINCIPAL_MAX,
  PRINCIPAL_MIN,
  type LandTract,
  type ProbeReadout,
  type RenderMode
} from '../model/terrain.model';

export function useTerrainViewModel() {
  const [tractIndex, setTractIndex] = useState(0);
  const [principal, setPrincipalState] = useState<number>(LAND_TRACTS[0]!.defaultPrincipal);
  const [renderMode, setRenderMode] = useState<RenderMode>('relief');
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [probe, setProbe] = useState<ProbeReadout | null>(null);

  const activeTract: LandTract = LAND_TRACTS[tractIndex] ?? LAND_TRACTS[0]!;

  const selectTract = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(LAND_TRACTS.length - 1, index));
    setTractIndex(clamped);
  }, []);

  const setPrincipal = useCallback((next: number) => {
    const clamped = Math.max(PRINCIPAL_MIN, Math.min(PRINCIPAL_MAX, Math.round(next / 1000) * 1000));
    setPrincipalState(clamped);
  }, []);

  const simulation = useMemo(
    () => calculateNoteSimulation(activeTract, principal),
    [activeTract, principal]
  );

  const activeSlice = useMemo(() => {
    if (hoveredMonth === null) return null;
    return simulation.firstYearSlices.find(slice => slice.month === hoveredMonth) ?? null;
  }, [hoveredMonth, simulation.firstYearSlices]);

  return {
    status: 'ready' as const,
    error: null as string | null,
    tracts: LAND_TRACTS,
    tractIndex,
    activeTract,
    selectTract,
    principal,
    setPrincipal,
    renderMode,
    setRenderMode,
    autoOrbit,
    toggleAutoOrbit: () => setAutoOrbit(current => !current),
    setAutoOrbit,
    hoveredMonth,
    setHoveredMonth,
    probe,
    setProbe,
    simulation,
    activeSlice
  };
}
