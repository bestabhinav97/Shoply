import { useEffect, useRef, useState } from 'react';
import { getDeviceCoordinates } from '../../../lib/getDeviceCoordinates';
import { lookupAddress } from '../api/addressLookup.api';

export function useAddressLookup() {
  const request = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function detect() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('locating');
    setError('');
    let timer;
    try {
      const coordinates = await getDeviceCoordinates();
      if (controller.signal.aborted) return null;
      setStatus('resolving');
      timer = setTimeout(() => controller.abort(), 15000);
      const suggestion = await lookupAddress(coordinates, controller.signal);
      if (controller.signal.aborted) return null;
      setStatus('success');
      return suggestion;
    } catch (failure) {
      if (request.current !== controller) return null;
      setStatus('error');
      setError(controller.signal.aborted ? 'Address lookup took too long. Please try again.'
        : failure.status === 404 ? 'Address autofill isn’t connected yet. You can still enter and save your address manually.'
          : failure instanceof TypeError ? 'We couldn’t connect to address lookup. Please try again or enter your address manually.'
            : failure.message || 'Address lookup failed. Please enter your address manually.');
      return null;
    } finally { clearTimeout(timer); }
  }
  return { detect, status, error, busy: status === 'locating' || status === 'resolving' };
}
