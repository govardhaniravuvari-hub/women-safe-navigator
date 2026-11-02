import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser Geolocation helper with explicit, human-readable permission errors.
 * Nothing is invented: if the browser refuses, the UI is told why.
 */
export function useGeolocation({ auto = false, watch = false } = {}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'geolocation' in navigator);
  const watchId = useRef(null);

  const onError = useCallback((err) => {
    const messages = {
      1: 'Location permission was denied. Allow location access in your browser settings and try again.',
      2: 'Your location is currently unavailable. Move to an open area and try again.',
      3: 'Getting your location took too long. Please try again.',
    };
    setError(messages[err.code] || 'Could not get your location.');
    setLoading(false);
  }, []);

  const request = useCallback(() => {
    if (!supported) {
      setError('This browser does not support location services.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setLoading(false);
      },
      onError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, [onError, supported]);

  const startWatch = useCallback(() => {
    if (!supported || watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
        setLoading(false);
      },
      onError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  }, [onError, supported]);

  const stopWatch = useCallback(() => {
    if (watchId.current != null && supported) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, [supported]);

  useEffect(() => {
    if (auto) request();
    if (watch) startWatch();
    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { position, error, loading, supported, request, startWatch, stopWatch };
}
