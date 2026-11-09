import { TERRAIN_GRID } from '../model/terrain.model';

export async function loadElevation(signal: AbortSignal) {
  const response = await fetch('/login-map/elevation.bin', { signal });
  if (!response.ok) throw new Error('Terrain elevation could not load.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== TERRAIN_GRID ** 2 * 2) throw new Error('Invalid terrain elevation.');
  const data = new DataView(buffer);
  return Uint16Array.from({ length: TERRAIN_GRID ** 2 }, (_, index) => data.getUint16(index * 2, true));
}
