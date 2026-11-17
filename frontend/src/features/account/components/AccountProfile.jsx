import { useState } from 'react';
import { useAuth, useLogout } from '../../auth';
import { ProfileField } from './ProfileField';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Modal } from '../../../components/ui/Modal';

export function AccountProfile() {
  const { data: user } = useAuth();
  const logout = useLogout();
  const [dialog, setDialog] = useState(null);
  if (!user) return null;
  const showVerification = () => setDialog('verification');
  const closeDialog = () => { if (!logout.isPending) setDialog(null); };
  return <>
    <section className="account-panel profile-panel" aria-labelledby="profile-title">
      <header className="profile-heading">
        <h1 id="profile-title">Profile</h1>
        <p className="account-intro">Manage your contact details and account security.</p>
      </header>
      <div className="profile-contacts">
        <ProfileField name="email" label="Email" value={user.email} onVerify={showVerification} />
        <ProfileField name="phoneNumber" label="Phone number" value={user.phoneNumber} />
      </div>
      <aside className="profile-verification" aria-labelledby="verification-title">
        <Icon name="info" />
        <div><h2 id="verification-title">Verify your contact details</h2>
          <p>Verifying your email and phone helps secure your account and lets us send order updates.</p>
        </div>
        <Button variant="primary" onClick={showVerification}>Verify now</Button>
      </aside>
    </section>
    <section className="account-panel profile-sessions" aria-labelledby="sessions-title">
      <div className="profile-section-title"><Icon name="shield" /><h2 id="sessions-title">Sessions</h2></div>
      <p className="account-intro">Sign out of this device or all devices where you're logged in.</p>
      {logout.error && dialog !== 'sessions' && <p role="alert" className="form-error">{logout.error.message}</p>}
      <div className="account-actions profile-session-actions">
        <Button loading={logout.isPending} onClick={() => logout.mutate(false)}><Icon name="logout" />Sign out</Button>
        <Button className="account-danger-button" disabled={logout.isPending} onClick={() => { logout.reset(); setDialog('sessions'); }}>
          <Icon name="logout" />Sign out on all devices
        </Button>
      </div>
    </section>
    <Modal open={dialog !== null} onClose={closeDialog} label={dialog === 'sessions' ? 'Sign out on all devices?' : 'Contact verification'} closeLabel="Close dialog">
      <div className="account-dialog">
        {dialog === 'sessions' ? <>
          <h2>Sign out on all devices?</h2>
          <p>This ends all your Shoply sessions, including this one. You'll need to sign in again on each device.</p>
          {logout.error && <p role="alert" className="form-error">{logout.error.message}</p>}
          <div className="account-actions">
            <Button autoFocus disabled={logout.isPending} onClick={closeDialog}>Cancel</Button>
            <Button className="account-danger-button" loading={logout.isPending} onClick={() => logout.mutate(true)}>Sign out everywhere</Button>
          </div>
        </> : <>
          <h2>Contact verification</h2>
          <p>Email and phone verification aren't available yet. Your contact details remain unverified. You can still edit and save them in your profile.</p>
          <Button autoFocus onClick={closeDialog}>Got it</Button>
        </>}
      </div>
    </Modal>
  </>;
}

