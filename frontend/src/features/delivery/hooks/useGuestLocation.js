import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '../api/delivery.api';

const storageKey = 'shoply.guest-city';

function readCity() {
  try {
    const city = sessionStorage.getItem(storageKey);
    return city && city.length <= 120 ? city : '';
  } catch { return ''; }
}

function locateDevice() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location isn’t supported by this browser. You can still sign in.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const messages = {
        1: 'Location permission was denied. You can allow it in browser settings or sign in.',
        2: 'Your device couldn’t determine your location. Please try again or sign in.',
        3: 'Finding your location took too long. Please try again or sign in.',
      };
      reject(new Error(messages[error.code] || 'Location is unavailable. Please try again or sign in.'));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
}

export function useGuestLocation() {
  const [city, setCity] = useState(readCity);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const request = useRef(null);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  function cancel() {
    request.current?.abort();
    request.current = null;
    setStatus('idle');
    setError('');
  }

  async function detect() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setStatus('locating');
    let lookupTimeout;
    try {
      const position = await locateDevice();
      // Geolocation callbacks cannot be cancelled; ignore them after dismissal.
      if (controller.signal.aborted) return;
      setStatus('resolving');
      lookupTimeout = setTimeout(() => controller.abort(), 15000);
      const resolvedCity = await reverseGeocode(position.coords, controller.signal);
      if (controller.signal.aborted) return;
      try { sessionStorage.setItem(storageKey, resolvedCity); } catch { /* Memory still works. */ }
      setCity(resolvedCity);
      setStatus('success');
    } catch (failure) {
      if (request.current !== controller) return;
      setStatus('error');
      setError(controller.signal.aborted ? 'The location lookup took too long. Please try again.'
        : failure.status === 404
          ? 'City lookup isn’t available yet. You can still sign in to your account.'
          : failure instanceof TypeError
            ? 'We couldn’t connect to the city lookup. Check your connection and try again.'
            : failure.message || 'City lookup failed. Please try again or sign in.');
    } finally {
      clearTimeout(lookupTimeout);
    }
  }

  return { city, status, error, detect, cancel };
}
