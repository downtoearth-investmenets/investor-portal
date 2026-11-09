export const TERRAIN_WIDTH = 10;
export const TERRAIN_HEIGHT = 10.4;
export const TERRAIN_GRID = 128;
export const TERRAIN_TEXTURE = '/login-map/terrain.webp';

export const REGIONS = [
  { name: 'Colorado', description: 'Rocky Mountain region', longitude: -105.55, latitude: 39.05 },
  { name: 'Wisconsin', description: 'Western Great Lakes region', longitude: -89.9, latitude: 44.5 },
  { name: 'Michigan', description: 'Great Lakes peninsula', longitude: -84.65, latitude: 44.35 }
] as const;

export type Region = (typeof REGIONS)[number];

export function terrainPoint(longitude: number, latitude: number) {
  return {
    x: ((longitude + 111) / 30 - 0.5) * TERRAIN_WIDTH,
    y: ((latitude - 28) / 24 - 0.5) * TERRAIN_HEIGHT
  };
}

export function overviewSpan(aspect: number) {
  return Math.max(6.1, 9.15 / aspect);
}
