import { useCallback, useEffect, useState } from 'react';
import { DataError } from '../utils/errors.js';

const cache = new Map();

function toDataError(err) {
  return err instanceof DataError ? err : new DataError('shape', (err && err.message) || 'Unexpected data');
}

async function fetchJson(path, signal) {
  let res;
  try {
    res = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new DataError('network', 'Could not reach the server');
  }
  if (!res.ok) throw new DataError('missing', 'File not found: ' + path);
  const text = await res.text();
  if (!text.trim()) throw new DataError('empty', 'Empty file: ' + path);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html') || text.trimStart().startsWith('<')) {
    throw new DataError('missing', 'File not found: ' + path);
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new DataError('invalid', 'Invalid JSON: ' + path);
  }
}

function fromCache(path, adapt) {
  if (!path || !cache.has(path)) return { data: null, loading: true, error: null };
  const raw = cache.get(path);
  try {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.status === 'skipped') {
      throw new DataError('skipped', raw.reason || 'This part of the analysis was skipped');
    }
    return { data: adapt ? adapt(raw) : raw, loading: false, error: null };
  } catch (err) {
    return { data: null, loading: false, error: toDataError(err) };
  }
}

export function useData(path, adapt, enabled = true) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState(() => (enabled ? fromCache(path, adapt) : { data: null, loading: true, error: null }));

  useEffect(() => {
    if (!enabled) return undefined;
    if (!path) {
      setState({ data: null, loading: false, error: new DataError('missing', 'No file is configured for this section') });
      return undefined;
    }
    if (cache.has(path)) {
      setState(fromCache(path, adapt));
      return undefined;
    }
    const controller = new AbortController();
    setState(prev => (prev.loading ? prev : { data: null, loading: true, error: null }));
    fetchJson(path, controller.signal)
      .then(raw => {
        cache.set(path, raw);
        if (!controller.signal.aborted) setState(fromCache(path, adapt));
      })
      .catch(err => {
        if ((err && err.name === 'AbortError') || controller.signal.aborted) return;
        setState({ data: null, loading: false, error: toDataError(err) });
      });
    return () => controller.abort();
    // adapt is a module-level function and never changes between renders
  }, [path, enabled, tick]);

  const reload = useCallback(() => {
    cache.delete(path);
    setTick(t => t + 1);
  }, [path]);

  return { ...state, reload };
}
