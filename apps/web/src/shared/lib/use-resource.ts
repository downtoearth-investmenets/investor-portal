'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toErrorMessage } from './api-client';

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ResourceState<T> {
  status: ResourceStatus;
  data: T | null;
  error: string | null;
}

export interface Resource<T> extends ResourceState<T> {
  reload: () => void;
  mutate: (update: (current: T | null) => T | null) => void;
}

/**
 * Loads data for a key. Pass null as the key to stay idle.
 * Reloads keep showing the previous data; a new key starts fresh.
 */
export function useResource<T>(load: () => Promise<T>, key: string | null = 'default'): Resource<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastKey = useRef(key);

  const [state, setState] = useState<ResourceState<T>>({
    status: key === null ? 'idle' : 'loading',
    data: null,
    error: null
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const keyChanged = lastKey.current !== key;
    lastKey.current = key;

    if (key === null) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }

    let active = true;
    setState(current =>
      keyChanged || current.data === null
        ? { status: 'loading', data: null, error: null }
        : { ...current, error: null }
    );

    loadRef
      .current()
      .then(data => {
        if (active) setState({ status: 'ready', data, error: null });
      })
      .catch(error => {
        if (active) setState(current => ({ status: 'error', data: current.data, error: toErrorMessage(error) }));
      });

    return () => {
      active = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const mutate = useCallback(
    (update: (current: T | null) => T | null) => setState(current => ({ ...current, data: update(current.data) })),
    []
  );

  return { ...state, reload, mutate };
}
