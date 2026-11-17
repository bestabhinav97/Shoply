import { useEffect, useRef, useState } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { useUpdateProfile } from '../../auth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Icon } from '../../../components/ui/Icon';

export function ProfileField({ name, label, value, onVerify }) {
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const action = useRef(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editing) action.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const isEmail = name === 'email';
  const errorId = `${name}-error`;
  function close() {
    setEditing(false);
  }
  async function save(event) {
    event.preventDefault();
    const next = draft.trim();
    const phone = !isEmail && next.startsWith('+') && parsePhoneNumberFromString(next, { extract: false });
    if (isEmail ? next.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next) : !phone || !phone.isValid()) {
      setError(isEmail ? 'Enter a valid email address.' : 'Enter a valid international phone number, including + and country code.');
      return;
    }
    setError('');
    try {
      await update.mutateAsync({ [name]: isEmail ? next : phone.number });
      setNotice(`${label} saved.`);
      close();
    } catch (failure) {
      setError(failure.fields?.[name] || failure.message);
    }
  }
  return <div className="profile-contact-row">
    <div className="profile-contact-summary">
      <span className="profile-field-icon"><Icon name={isEmail ? 'mail' : 'phone'} /></span>
      <dl className="profile-field-details"><dt>{isEmail ? 'Email address' : label}</dt>
        <dd><span className={value ? 'profile-field-value' : 'profile-field-empty'}>{value || 'Not added'}</span>
          {value && <span className="verification-badge"><span aria-hidden="true" />Unverified</span>}
          {value && isEmail && <Button variant="text" className="profile-verify-link" onClick={onVerify}>Verify</Button>}
        </dd>
      </dl>
      <Button ref={action} className="profile-field-action" aria-label={value ? `Edit ${label.toLowerCase()}` : undefined} hidden={editing} onClick={() => {
        setDraft(value || ''); setError(''); setNotice(''); update.reset(); setEditing(true);
      }}>{!value && <Icon name="plus" />}{value ? 'Edit' : `Add ${label.toLowerCase()}`}</Button>
    </div>
    {editing && <form className="profile-contact-form" onSubmit={save} noValidate aria-label={`Edit ${label.toLowerCase()}`}>
      <div className="field">
        <Input autoFocus label={label} type={isEmail ? 'email' : 'tel'} name={name} value={draft}
          autoComplete={isEmail ? 'email' : 'tel'} maxLength={isEmail ? 254 : 40}
          disabled={update.isPending} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
          onChange={(event) => { setDraft(event.target.value); setError(''); }} />
        {!isEmail && <p className="field-hint">Include + and your country code, for example +46 70 123 45 67.</p>}
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      </div>
      <div className="account-actions"><Button type="submit" variant="primary" loading={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</Button>
        <Button disabled={update.isPending} onClick={close}>Cancel</Button></div>
    </form>}
    <p className="profile-save-notice" role="status">{notice}</p>
  </div>;
}
