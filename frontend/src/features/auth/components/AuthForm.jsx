import { useId, useState } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { useAuthSubmit } from '../hooks/useAuth';

const registrationFields = [
  { name: 'firstName', label: 'First name', autoComplete: 'given-name', maxLength: 100 },
  { name: 'lastName', label: 'Last name', autoComplete: 'family-name', maxLength: 100 },
  { name: 'phoneNumber', label: 'Phone number', type: 'tel', autoComplete: 'tel', placeholder: '070 123 45 67', maxLength: 40 },
];

export function AuthForm({ mode, onSuccess }) {
  const register = mode === 'register';
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [localErrors, setLocalErrors] = useState({});
  const mutation = useAuthSubmit(mode);
  const fields = [
    ...(register ? registrationFields : []),
    { name: 'email', label: 'Email address', type: 'email', autoComplete: 'email', placeholder: 'you@example.com', maxLength: 254 },
    { name: 'password', label: 'Password', type: visible ? 'text' : 'password', autoComplete: register ? 'new-password' : 'current-password', maxLength: 128, minLength: register ? 15 : 1 },
  ];
  const errors = { ...mutation.error?.fields, ...localErrors };

  async function handleSubmit(event) {
    event.preventDefault();
    mutation.reset();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const nextErrors = {};
    if (register) {
      for (const name of ['firstName', 'lastName']) {
        if (!values[name].trim()) nextErrors[name] = 'This field is required.';
      }
      const phone = parsePhoneNumberFromString(values.phoneNumber, { defaultCountry: 'SE', extract: false });
      if (!phone || phone.country !== 'SE' || !phone.isValid()) nextErrors.phoneNumber = 'Enter a valid Swedish phone number.';
    }
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await mutation.mutateAsync(values);
      onSuccess();
    } catch { /* The mutation exposes errors below. */ }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {mutation.error && <div className="form-error" role="alert">{mutation.error.message}</div>}
      <div className={register ? 'fields registration-fields' : 'fields'}>
        {fields.map(({ label, ...field }) => {
          const error = errors[field.name];
          const hint = register && ['phoneNumber', 'password'].includes(field.name);
          return (
            <div className={`field field-${field.name}`} key={field.name}>
              <label htmlFor={`${id}-${field.name}`}>{label}</label>
              <input {...field} id={`${id}-${field.name}`} required
                disabled={mutation.isPending} aria-invalid={!!error}
                aria-describedby={error || hint ? `${id}-${field.name}-hint` : undefined} />
              {(error || hint) && <span id={`${id}-${field.name}-hint`} className={error ? 'field-error' : 'field-hint'}>
                {error || (field.name === 'password' ? '15–128 characters. A longer passphrase works well.' : 'Swedish numbers only. +46 is also accepted.')}
              </span>}
            </div>
          );
        })}
      </div>
      <label className="show-password"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Show password</label>
      <button className="button primary w-full" disabled={mutation.isPending} type="submit">
        {mutation.isPending ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
