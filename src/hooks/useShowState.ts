import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchShowState, type ShowState } from '../api/control';

interface UseShowStateOptions {
  pollInterval?: number;
}

type ShowStateUpdater = (prev: ShowState | null) => ShowState | null;

export function useShowState(options: UseShowStateOptions = {}) {
  const { pollInterval = 0 } = options;

  const [state, setInternalState] = useState<ShowState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const isMountedRef = useRef(true);
  const pollTimerRef = useRef<number | null>(null);

  const setState = useCallback((updater: ShowState | ShowStateUpdater) => {
    setInternalState((prev) => {
      if (typeof updater === 'function') {
        return (updater as ShowStateUpdater)(prev);
      }
      return updater;
    });
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const nextState = await fetchShowState();
      if (import.meta.env.DEV) {
        console.debug('[useShowState] fetched state', {
          stage: nextState.stage,
          queueLength: nextState.queue.length,
          queueIds: nextState.queue.map((entry) => entry.image.id),
        });
      }
      if (!isMountedRef.current) {
        if (import.meta.env.DEV) {
          console.warn('[useShowState] Component unmounted, skipping setState');
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.debug('[useShowState] About to call setState', {
          isMounted: isMountedRef.current,
          queueLength: nextState.queue.length,
        });
      }
      setState((prev) => {
        if (import.meta.env.DEV) {
          console.debug('[useShowState] applying state', {
            prevQueueLength: prev?.queue.length ?? null,
            nextQueueLength: nextState.queue.length,
            sameQueueRef: prev?.queue === nextState.queue,
          });
        }
        return nextState;
      });
      setError(null);
    } catch (refreshError) {
      if (import.meta.env.DEV) {
        console.error('[useShowState] failed to fetch state', refreshError);
      }
      if (!isMountedRef.current) {
        return;
      }
      if ((refreshError as Error)?.name === 'AbortError') {
        return;
      }
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load show state.');
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [setState]);

  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);
    void refresh().finally(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (pollInterval <= 0) {
      return;
    }

    pollTimerRef.current = window.setInterval(() => {
      void refresh();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [pollInterval, refresh]);

  const memoized = useMemo(
    () => ({
      state,
      loading,
      error,
      refresh,
      isRefreshing,
      setState,
    }),
    [error, isRefreshing, loading, refresh, setState, state]
  );

  return memoized;
}
