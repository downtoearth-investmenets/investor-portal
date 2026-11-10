export type RenderMode = 'relief' | 'contours' | 'survey';

export interface LandTract {
  id: string;
  name: string;
  shortName: string;
  state: string;
  county: string;
  acreage: number;
  terrainType: string;
  fixedRate: number;
  termMonths: number;
  ltvRatio: number;
  baseElevationFt: number;
  reliefFt: number;
  defaultPrincipal: number;
  accentHex: string;
  summary: string;
}

export const LAND_TRACTS: readonly LandTract[] = [
  {
    id: 'co-sangre',
    name: 'Sangre de Cristo Ridge',
    shortName: 'Colorado',
    state: 'CO',
    county: 'Costilla County',
    acreage: 35.0,
    terrainType: 'Alpine timber benchland',
    fixedRate: 11.5,
    termMonths: 36,
    ltvRatio: 0.68,
    baseElevationFt: 8120,
    reliefFt: 640,
    defaultPrincipal: 85000,
    accentHex: '#ffca77',
    summary: 'A stylized model of a high-country ridge and meadow.'
  },
  {
    id: 'wi-northwoods',
    name: 'Northwoods Kettle Basin',
    shortName: 'Wisconsin',
    state: 'WI',
    county: 'Barron County',
    acreage: 18.5,
    terrainType: 'Hardwood lakefront reserve',
    fixedRate: 12.0,
    termMonths: 48,
    ltvRatio: 0.66,
    baseElevationFt: 1240,
    reliefFt: 310,
    defaultPrincipal: 95000,
    accentHex: '#7fd1c8',
    summary: 'A stylized model of a basin shaped by glaciers.'
  },
  {
    id: 'mi-ironrange',
    name: 'Highland Mesa & Gorge',
    shortName: 'Michigan',
    state: 'MI',
    county: 'Iron County',
    acreage: 42.0,
    terrainType: 'Stepped plateau & river valley',
    fixedRate: 12.5,
    termMonths: 60,
    ltvRatio: 0.65,
    baseElevationFt: 1580,
    reliefFt: 460,
    defaultPrincipal: 115000,
    accentHex: '#b6e2a1',
    summary: 'A stylized model of a plateau cut by a river valley.'
  }
] as const;

export const PRINCIPAL_PRESETS = [50000, 85000, 115000, 150000] as const;
export const PRINCIPAL_MIN = 35000;
export const PRINCIPAL_MAX = 175000;
export const PRINCIPAL_STEP = 5000;

export interface InstallmentSlice {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  interestShare: number;
  remainingBalance: number;
}

export interface NoteSimulation {
  principal: number;
  monthlyPayment: number;
  annualIncome: number;
  totalScheduled: number;
  totalInterest: number;
  collateralValue: number;
  coverageMultiple: number;
  equityCushion: number;
  firstYearSlices: InstallmentSlice[];
}

export interface ProbeReadout {
  elevationFt: number;
  slopeDeg: number;
  normX: number;
  normY: number;
}

/**
 * Procedural normalized elevation in [0, 1] for u, v in [-1, 1].
 * Each tract has a distinct, recognizable 3D topographical signature.
 */
export function sampleTractElevation(tractIndex: number, u: number, v: number): number {
  if (tractIndex === 0) {
    // Sangre de Cristo: Twin alpine peaks with a diagonal saddle ridge and eastern meadow bench
    const peakA = Math.exp(-((u + 0.34) ** 2 * 3.8 + (v + 0.22) ** 2 * 4.4)) * 0.92;
    const peakB = Math.exp(-((u - 0.36) ** 2 * 4.5 + (v - 0.28) ** 2 * 3.6)) * 0.78;
    const ridge = Math.exp(-((u * 0.78 - v * 0.62) ** 2 * 6.2)) * 0.36 * (1 - 0.28 * (u * u + v * v));
    const foothills = 0.08 * Math.sin(u * 4.2 + 0.5) * Math.cos(v * 3.6 - 0.3) + 0.08;
    return Math.max(0.04, Math.min(1, peakA + peakB * 0.68 + ridge + foothills));
  }
  if (tractIndex === 1) {
    // Northwoods Kettle Basin: Terraced amphitheater ridges cradling a tranquil basin with a center knoll
    const r2 = (u - 0.08) ** 2 * 1.35 + (v + 0.06) ** 2 * 1.45;
    const rim = Math.exp(-((Math.sqrt(r2) - 0.72) ** 2 * 7.8)) * 0.74;
    const westCrest = Math.exp(-((u + 0.55) ** 2 * 3.4 + (v - 0.3) ** 2 * 2.8)) * 0.42;
    const islandKnoll = Math.exp(-((u - 0.06) ** 2 * 14 + (v + 0.05) ** 2 * 14)) * 0.32;
    const ripples = 0.05 * Math.cos(u * 5.2 - v * 2.4) + 0.1;
    return Math.max(0.05, Math.min(1, rim + westCrest + islandKnoll + ripples));
  }
  // Highland Mesa & Gorge: Stepped plateau shelves divided by a winding river canyon
  const canyonCenter = 0.24 * Math.sin(v * 2.4);
  const distToCanyon = Math.abs(u - canyonCenter);
  const plateau = 0.76 / (1 + Math.exp(-(distToCanyon - 0.24) * 11));
  const upperMesa = 0.24 / (1 + Math.exp(-((u + 0.15 * v) - 0.18) * 9));
  const strata = 0.05 * Math.sin(u * 6.0) * Math.sin(v * 5.0) + 0.07;
  const falloff = Math.max(0.2, 1 - 0.18 * (u * u + v * v));
  return Math.max(0.05, Math.min(1, (plateau + upperMesa) * falloff + strata));
}

export function calculateNoteSimulation(tract: LandTract, principal: number): NoteSimulation {
  const monthlyRate = tract.fixedRate / 100 / 12;
  const n = tract.termMonths;
  const factor = Math.pow(1 + monthlyRate, n);
  const monthlyPayment = principal * ((monthlyRate * factor) / (factor - 1));
  const totalScheduled = monthlyPayment * n;
  const totalInterest = totalScheduled - principal;
  const collateralValue = Math.round(principal / tract.ltvRatio / 500) * 500;
  const coverageMultiple = collateralValue / principal;
  const equityCushion = collateralValue - principal;

  let balance = principal;
  const firstYearSlices: InstallmentSlice[] = [];
  for (let month = 1; month <= 12; month++) {
    const interest = balance * monthlyRate;
    const principalPaid = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPaid);
    firstYearSlices.push({
      month,
      payment: monthlyPayment,
      interest,
      principal: principalPaid,
      interestShare: interest / monthlyPayment,
      remainingBalance: balance
    });
  }

  return {
    principal,
    monthlyPayment,
    annualIncome: monthlyPayment * 12,
    totalScheduled,
    totalInterest,
    collateralValue,
    coverageMultiple,
    equityCushion,
    firstYearSlices
  };
}
