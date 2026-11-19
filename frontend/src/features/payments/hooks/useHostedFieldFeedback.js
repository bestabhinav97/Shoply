import { useCallback, useState } from 'react';

const messages = {
  number: 'Enter a valid card number',
  expirationDate: 'Enter a valid expiry date',
  cvv: 'Enter the security code',
};

export function useHostedFieldFeedback() {
  const [feedback, setFeedback] = useState({ valid: false, errors: {}, brand: '', codeSize: 3 });

  const connect = useCallback((instance) => {
    let disposed = false;
    const touched = new Set();
    function update(event, interacted = true) {
      if (disposed) return;
      if (interacted && event.emittedBy) touched.add(event.emittedBy);
      const errors = {};
      for (const field of Object.keys(messages)) {
        const invalid = touched.has(field) && !event.fields[field]?.isValid;
        errors[field] = invalid ? messages[field] : '';
        void instance.setAttribute({ field, attribute: 'aria-invalid', value: invalid }).catch(() => {});
        instance.setMessage({ field, message: errors[field] });
      }
      setFeedback((current) => ({ ...current, errors, valid: Object.keys(messages).every((name) => event.fields[name]?.isValid) }));
    }
    function changeCard(event) {
      if (disposed) return;
      const card = event.cards.length === 1 ? event.cards[0] : null;
      const codeSize = card?.code.size === 4 ? 4 : 3;
      setFeedback((current) => ({ ...current, brand: card?.niceType || '', codeSize }));
      void instance.setAttribute({ field: 'cvv', attribute: 'placeholder', value: codeSize === 4 ? '1234' : '123' }).catch(() => {});
    }
    const onChange = (event) => update(event);
    instance.on('blur', onChange);
    instance.on('validityChange', onChange);
    instance.on('cardTypeChange', changeCard);
    update(instance.getState(), false);
    for (const field of Object.keys(messages)) {
      void instance.setAttribute({ field, attribute: 'aria-required', value: true }).catch(() => {});
    }
    return () => {
      disposed = true;
      instance.off('blur', onChange);
      instance.off('validityChange', onChange);
      instance.off('cardTypeChange', changeCard);
    };
  }, []);

  return { ...feedback, connect };
}
