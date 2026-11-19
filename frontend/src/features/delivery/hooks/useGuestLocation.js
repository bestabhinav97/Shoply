import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '../api/delivery.api';
import { getDeviceCoordinates } from '../../../lib/getDeviceCoordinates';

const storageKey = 'shoply.guest-city';

function readCity() {
  try {
    const city = sessionStorage.getItem(storageKey);
    return city && city.length <= 120 ? city : '';
  } catch { return ''; }
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
      const coordinates = await getDeviceCoordinates();
      // Geolocation callbacks cannot be cancelled; ignore them after dismissal.
      if (controller.signal.aborted) return;
      setStatus('resolving');
      lookupTimeout = setTimeout(() => controller.abort(), 15000);
      const resolvedCity = await reverseGeocode(coordinates, controller.signal);
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
