import { Icon } from '../../../components/ui/Icon';

const brands = {
  visa: 'visa', mastercard: 'master', americanexpress: 'american_express',
  discover: 'discover', dinersclub: 'diners_club', jcb: 'jcb',
  unionpay: 'unionpay', chinaunionpay: 'unionpay', maestro: 'maestro',
};

export function CardBrandIcon({ brand, className = '' }) {
  const key = String(brand || '').toLowerCase().replace(/[^a-z]/g, '');
  const asset = Object.hasOwn(brands, key) ? brands[key] : null;
  return <span className={`payment-brand-icon ${className}`.trim()} aria-hidden="true">
    {asset
      ? <img src={`/images/payment-brands/${asset}.svg`} alt="" width="38" height="24" />
      : <Icon name="card" />}
  </span>;
}
