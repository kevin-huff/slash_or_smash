import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listImages, type UploadedImage } from '../api/images';

interface UseImageLibraryOptions {
  pollInterval?: number;
}

type ImagesUpdater = (prev: UploadedImage[]) => UploadedImage[];

export function useImageLibrary(options: UseImageLibraryOptions = {}) {
  const { pollInterval = 0 } = options;

  const [images, internalSetImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const isMountedRef = useRef(true);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const setImages = useCallback(
    (updater: UploadedImage[] | ImagesUpdater) => {
      internalSetImages((prev) => {
        if (typeof updater === 'function') {
          return (updater as ImagesUpdater)(prev);
        }
        return updater;
      });
    },
    []
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await listImages();
      if (!isMountedRef.current) {
        return;
      }
      setImages(data);
      setError(null);
    } catch (refreshError) {
      if (!isMountedRef.current) {
        return;
      }
      if ((refreshError as Error)?.name === 'AbortError') {
        return;
      }
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load images.');
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [setImages]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => {
      if (isMountedRef.current) {
        setLoading(false);
      }
    });
  }, [refresh]);

  useEffect(() => {
    if (pollInterval <= 0) {
      return;
    }
    pollRef.current = window.setInterval(() => {
      void refresh();
    }, pollInterval);

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [pollInterval, refresh]);

  const state = useMemo(
    () => ({
      images,
      loading,
      error,
      refresh,
      isRefreshing,
      setImages,
    }),
    [error, images, isRefreshing, loading, refresh, setImages]
  );

  return state;
}
