import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateAddress, validateSelectedAddress, validateDefaultAddress, validateUpdateAddress, validateAddressId } from '../modules/addresses/address.validation.js';

const valid = {
  recipientName: 'Åsa Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12',
  addressLine2: '', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE',
  isDefault: false, selectForDelivery: true,
};

function invalid(body, field) {
  assert.throws(() => validateCreateAddress(body), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.message, 'Please check your address.');
    assert.equal(typeof error.fields[field], 'string');
    return true;
  });
}

test('address validation trims text and normalizes Swedish postcode and phone', () => {
  const input = { ...valid, recipientName: ' Åsa Test ', addressLine1: ' Testgatan 12 ',
    addressLine2: ' Apartment 3 ', city: ' Helsingborg ', postalCode: ' 254 38 ', phoneNumber: '070-123 45 67' };
  assert.deepEqual(validateCreateAddress(input), { ...valid, addressLine2: 'Apartment 3' });
  assert.equal(input.recipientName, ' Åsa Test ');
  assert.equal(validateCreateAddress({ ...valid, phoneNumber: '+44 20 7946 0018' }).phoneNumber, '+442079460018');
});

test('address validation permits an omitted optional second line and exact length limits', () => {
  const { addressLine2: _optional, ...body } = valid;
  assert.deepEqual(validateCreateAddress(body), valid);
  for (const [field, limit] of [['recipientName', 200], ['addressLine1', 200], ['addressLine2', 200], ['city', 100]]) {
    assert.equal(validateCreateAddress({ ...valid, [field]: 'x'.repeat(limit) })[field].length, limit);
    invalid({ ...valid, [field]: 'x'.repeat(limit + 1) }, field);
  }
});

test('address validation requires text fields, country and genuine boolean choices', () => {
  for (const field of Object.keys(valid).filter((field) => field !== 'addressLine2')) {
    const body = { ...valid };
    delete body[field];
    invalid(body, field);
  }
  for (const field of ['recipientName', 'addressLine1', 'city']) {
    for (const value of ['', '   ', null, 12, []]) invalid({ ...valid, [field]: value }, field);
  }
  for (const field of ['isDefault', 'selectForDelivery']) {
    for (const value of ['true', 'false', 0, 1, null]) invalid({ ...valid, [field]: value }, field);
  }
  for (const countryCode of ['US', 'se', '', null]) invalid({ ...valid, countryCode }, 'countryCode');
});

test('address validation rejects embedded or surrounding control characters before trimming', () => {
  for (const field of ['recipientName', 'phoneNumber', 'addressLine1', 'addressLine2', 'postalCode', 'city']) {
    for (const character of ['\n', '\t', '\u0000', '\u200b']) {
      invalid({ ...valid, [field]: `${character}${valid[field]}` }, field);
      invalid({ ...valid, [field]: `${valid[field]}${character}` }, field);
    }
  }
});

test('address validation rejects bad postcodes and phone numbers rather than extracting fragments', () => {
  for (const postalCode of ['2543', '254388', 'ABCDE', '254  38', '25 438']) invalid({ ...valid, postalCode }, 'postalCode');
  for (const phoneNumber of ['123', 'call 0701234567 please', '+00000000000', 'x'.repeat(41), null]) invalid({ ...valid, phoneNumber }, 'phoneNumber');
});

test('address validation rejects unexpected fields and malformed bodies', () => {
  for (const field of ['userId', 'id', 'role', 'defaultAddressId']) invalid({ ...valid, [field]: 'untrusted' }, 'form');
  for (const body of [null, undefined, [], 'address', 42]) invalid(body, 'form');
  assert.throws(() => validateCreateAddress({}), (error) => {
    assert.ok(error.fields.recipientName);
    assert.ok(error.fields.postalCode);
    return true;
  });
});

test('address selection requires only a valid UUID and normalizes its casing', () => {
  const addressId = '6FE9FD8A-5118-4E1B-B223-2F986E865C30';
  assert.deepEqual(validateSelectedAddress({ addressId }), { addressId: addressId.toLowerCase() });
  assert.deepEqual(validateDefaultAddress({ addressId }), { addressId: addressId.toLowerCase() });
  for (const body of [null, [], {}, { addressId: null }, { addressId: 'invalid' },
    { addressId: 123 }, { addressId, userId: 'other-user' }, { addressId, isDefault: true }]) {
    assert.throws(() => validateSelectedAddress(body), { status: 400 });
    assert.throws(() => validateDefaultAddress(body), { status: 400 });
  }
});

test('address edits accept complete details but reject ownership and preference commands', () => {
  const { isDefault: _default, selectForDelivery: _selected, ...details } = valid;
  assert.deepEqual(validateUpdateAddress(details), details);
  for (const extra of [{ userId: 'other' }, { isDefault: true }, { selectForDelivery: true }]) {
    assert.throws(() => validateUpdateAddress({ ...details, ...extra }), { status: 400 });
  }
  assert.throws(() => validateUpdateAddress({ city: 'Stockholm' }), { status: 400 });
  assert.throws(() => validateAddressId('invalid'), { status: 400 });
});
