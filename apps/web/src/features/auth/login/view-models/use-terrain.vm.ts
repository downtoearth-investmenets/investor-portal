import { useEffect, useState } from 'react';
import { loadElevation } from '../data/terrain.repo';

export function useTerrainViewModel() {
  const [elevations, setElevations] = useState<Uint16Array | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!window.WebGL2RenderingContext) {
      setError(true);
      return;
    }
    const request = new AbortController();
    loadElevation(request.signal).then(setElevations).catch(() => {
      if (!request.signal.aborted) setError(true);
    });
    return () => request.abort();
  }, []);
  return { elevations, error, status: error ? 'fallback' : elevations ? 'ready' : 'loading' };
}
