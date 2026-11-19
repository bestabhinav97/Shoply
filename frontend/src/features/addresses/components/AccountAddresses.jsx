import { useAuth } from '../../auth';
import { AddressBook } from './AddressBook';

export function AccountAddresses() {
  const auth = useAuth();
  return <div className="account-addresses"><header><h1>Addresses</h1><p className="address-note">Save delivery details for home, work, or someone else.</p></header>
    {auth.data && <AddressBook key={auth.data.id} user={auth.data} />}</div>;
}
