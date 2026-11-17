import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCoordinates } from '../modules/locations/location.validation.js';

test('coordinate validation accepts decimal coordinates, zero and inclusive boundaries', () => {
  for (const body of [
    { latitude: 56.05, longitude: 12.69 },
    { latitude: 0, longitude: 0 },
    { latitude: -90, longitude: -180 },
    { latitude: 90, longitude: 180 },
  ]) {
    assert.deepEqual(validateCoordinates(body), body);
  }
});

test('coordinate validation rejects out-of-range, non-number and non-finite values', () => {
  for (const [field, values] of [
    ['latitude', [-90.001, 90.001, '56.05', null, true, NaN, Infinity, -Infinity]],
    ['longitude', [-180.001, 180.001, '12.69', null, false, NaN, Infinity, -Infinity]],
  ]) {
    for (const value of values) {
      const body = { latitude: 56.05, longitude: 12.69, [field]: value };
      assert.throws(() => validateCoordinates(body), (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.message, 'Please provide valid coordinates.');
        assert.equal(typeof error.fields[field], 'string');
        return true;
      });
    }
  }
});

test('coordinate validation requires both fields and reports both missing fields', () => {
  for (const body of [{}, { latitude: 56.05 }, { longitude: 12.69 }]) {
    assert.throws(() => validateCoordinates(body), (error) => {
      assert.equal(error.status, 400);
      for (const field of ['latitude', 'longitude']) {
        if (!(field in body)) assert.equal(typeof error.fields[field], 'string');
      }
      return true;
    });
  }
});

test('coordinate validation rejects unexpected fields and malformed request bodies', () => {
  for (const body of [
    { latitude: 56.05, longitude: 12.69, city: 'Helsingborg' },
    undefined, null, [], 'coordinates', 42,
  ]) {
    assert.throws(() => validateCoordinates(body), (error) => {
      assert.equal(error.status, 400);
      assert.equal(typeof error.fields.form, 'string');
      return true;
    });
  }
});
