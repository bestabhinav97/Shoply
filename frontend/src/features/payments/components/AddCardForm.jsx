import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { useClientToken } from '../hooks/useClientToken';
import { useSavePaymentMethod } from '../hooks/usePaymentMethods';
import { useHostedFieldFeedback } from '../hooks/useHostedFieldFeedback';
import { Icon } from '../../../components/ui/Icon';
import { CardBrandIcon } from './CardBrandIcon';

const labels = { number: 'Card number', expirationDate: 'Expiry date', cvv: 'Security code (CVV)' };

export function AddCardForm({ userId, onClose, onSaved, onSavingChange }) {
  const { mutateAsync: requestToken, reset } = useClientToken();
  const { mutateAsync: saveCard, reset: resetSave } = useSavePaymentMethod(userId);
  const number = useRef(null);
  const expirationDate = useRef(null);
  const cvv = useRef(null);
  const hostedFields = useRef(null);
  const active = useRef(false);
  const submitting = useRef(false);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { valid, errors, brand, codeSize, connect: connectFeedback } = useHostedFieldFeedback();

  useEffect(() => {
    let cancelled = false;
    let instance;
    let disconnectFeedback;
    active.current = true;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 15000);

    async function initialize() {
      try {
        const [authorization, clientModule, fieldsModule] = await Promise.all([
          requestToken({ signal: controller.signal }),
          import('braintree-web/client'),
          import('braintree-web/hosted-fields'),
        ]);
        clearTimeout(deadline);
        reset(); // Do not retain the client token in the mutation cache.
        if (cancelled) return;
        const client = await clientModule.default.create({ authorization });
        if (cancelled) return;
        // Hosted Fields owns these containers; card data never enters React state.
        instance = await fieldsModule.default.create({
          client,
          styles: {
            input: {
              'font-size': '16px', 'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
              'line-height': '1.5', color: getComputedStyle(number.current).color,
            },
            '::placeholder': { color: getComputedStyle(number.current).getPropertyValue('--color-muted').trim() },
          },
          fields: {
            number: { container: number.current, internalLabel: labels.number, placeholder: '1234 1234 1234 1234' },
            expirationDate: { container: expirationDate.current, internalLabel: labels.expirationDate, placeholder: 'MM / YY' },
            cvv: { container: cvv.current, internalLabel: labels.cvv, placeholder: '123', type: 'password' },
          },
        });
        if (cancelled) {
          await instance.teardown();
          return;
        }
        hostedFields.current = instance;
        disconnectFeedback = connectFeedback(instance);
        setState('ready');
        void instance.focus('number').catch(() => {});
      } catch {
        if (!cancelled) {
          setMessage('Couldn’t open secure card fields. Please try again.');
          setState('error');
        }
      } finally {
        clearTimeout(deadline);
        reset();
      }
    }
    initialize();

    return () => {
      cancelled = true;
      active.current = false;
      controller.abort();
      clearTimeout(deadline);
      hostedFields.current = null;
      disconnectFeedback?.();
      if (instance) void instance.teardown().catch(() => {});
    };
  }, [attempt, requestToken, reset, connectFeedback]);

  async function submit(event) {
    event.preventDefault();
    if (!hostedFields.current || submitting.current || state !== 'ready') return;
    submitting.current = true;
    onSavingChange(true);
    setMessage('');
    setState('submitting');
    try {
      // Raw card details go to Braintree; only the nonce goes to Shoply's backend.
      const result = await hostedFields.current.tokenize({ vault: false });
      if (!active.current) return;
      if (typeof result?.nonce !== 'string' || !result.nonce) throw new Error('No nonce returned.');
      let savedCard;
      try {
        savedCard = await saveCard(result.nonce);
      } catch (error) {
        if (!active.current) return;
        setMessage(error.status === 422
          ? 'The card could not be verified or saved. Enter the card details again or try another test card.'
          : error.status === 401
            ? 'Your session has expired. Sign in again before saving a card.'
            : error.status === 429
              ? 'Too many attempts. Please wait a minute before trying again.'
              : 'Couldn’t confirm that the card was saved. Do not immediately submit it again; it may have reached Braintree.');
        // The nonce may already be consumed. A retry always tokenizes again.
        setState('ready');
        return;
      }
      if (active.current) onSaved(savedCard);
    } catch (error) {
      if (!active.current) return;
      setMessage({
        HOSTED_FIELDS_FIELDS_EMPTY: 'Enter the card details.',
        HOSTED_FIELDS_FIELDS_INVALID: 'Check the highlighted card details.',
        HOSTED_FIELDS_FAILED_TOKENIZATION: 'Couldn’t process this card. Try another test card.',
        HOSTED_FIELDS_TOKENIZATION_NETWORK_ERROR: 'Connection interrupted. Please try again.',
      }[error?.code] || 'Couldn’t process the test card. Please try again.');
      setState('ready');
    } finally {
      submitting.current = false;
      resetSave(); // Remove the single-use nonce from mutation variables after settling.
      onSavingChange(false);
    }
  }

  return <div className="account-dialog payment-add-dialog">
    <h2>Add a card</h2>
    <p className="payment-dialog-description" id="payment-dialog-description">Sandbox: enter a test card, not a real one. No purchase will be made.</p>
    <p className="payment-test-number">Test Visa: 4111 1111 1111 1111</p>
    <form onSubmit={submit} aria-label="Test card setup">
      <div className="payment-form-feedback">
        {state === 'loading' && <p role="status">Opening secure card fields…</p>}
        <p role={message ? 'alert' : undefined}>{message}</p>
      </div>
      <div className="payment-hosted-fields" hidden={state === 'error'} aria-busy={state === 'loading'}>
        <div className="payment-hosted-field payment-number-field">
          <span id="payment-number-label">{labels.number}</span>
          <div className="payment-number-wrap">
            <div className={`payment-hosted-input${brand ? ' has-brand' : ''}`} ref={number} role="group" aria-labelledby="payment-number-label" aria-describedby="payment-number-error" aria-invalid={Boolean(errors.number)} />
            {brand && <span className="payment-detected-brand" aria-label={`Detected card: ${brand}`}><CardBrandIcon brand={brand} /></span>}
          </div>
          <span id="payment-number-error" className="payment-field-error">{errors.number}</span>
        </div>
        <div className="payment-hosted-field">
          <span id="payment-expiry-label">{labels.expirationDate}</span>
          <div className="payment-hosted-input" ref={expirationDate} role="group" aria-labelledby="payment-expiry-label" aria-describedby="payment-expiry-error" aria-invalid={Boolean(errors.expirationDate)} />
          <span id="payment-expiry-error" className="payment-field-error">{errors.expirationDate}</span>
        </div>
        <div className="payment-hosted-field">
          <span id="payment-cvv-label">{codeSize === 4 ? 'Security code (4 digits)' : labels.cvv}</span>
          <div className="payment-hosted-input" ref={cvv} role="group" aria-labelledby="payment-cvv-label" aria-describedby="payment-cvv-error" aria-invalid={Boolean(errors.cvv)} />
          <span id="payment-cvv-error" className="payment-field-error">{errors.cvv}</span>
        </div>
      </div>
      <p className="payment-security-note"><Icon name="lock" />Card details go directly to Braintree. Shoply keeps only the brand, last four digits and expiry.</p>
      <div className="account-actions payment-form-actions">
        <Button variant="ghost" disabled={state === 'submitting'} onClick={onClose}>Cancel</Button>
        {state === 'error'
          ? <Button onClick={() => { setMessage(''); setState('loading'); setAttempt((value) => value + 1); }}>Try again</Button>
          : <Button type="submit" variant="primary" disabled={state === 'loading' || !valid} loading={state === 'submitting'}>{state === 'submitting' ? 'Saving...' : 'Save card'}</Button>}
      </div>
    </form>
  </div>;
}
