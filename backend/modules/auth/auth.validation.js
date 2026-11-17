import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { httpError } from '../../shared/errors.js';

const name = z.string().trim().min(1, 'This field is required.').max(100)
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), 'Enter a valid name.');
const email = z.string().trim().max(254).email('Enter a valid email address.').toLowerCase();
const phone = z.string().trim().max(40).transform((value, ctx) => {
  const number = parsePhoneNumberFromString(value, { defaultCountry: 'SE', extract: false });
  if (!number || number.country !== 'SE' || !number.isValid()) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid Swedish phone number.' });
    return z.NEVER;
  }
  return number.number;
});

const schemas = {
  profile: z.object({
    email: email.optional(),
    phoneNumber: z.string().trim().max(40).transform((value, ctx) => {
      const number = value.startsWith('+') && parsePhoneNumberFromString(value, { extract: false });
      if (!number || !number.isValid()) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid international phone number, including + and country code.' });
        return z.NEVER;
      }
      return number.number;
    }).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide an email or phone number.'),
  register: z.object({
    firstName: name, lastName: name, phoneNumber: phone, email,
    password: z.string().min(15, 'Use at least 15 characters.').max(128, 'Use at most 128 characters.'),
  }).strict(),
  login: z.object({ email, password: z.string().min(1).max(128) }).strict(),
};

export function validate(kind, body) {
  const result = schemas[kind].safeParse(body);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] || 'form';
      fields[key] ??= issue.message;
    }
    throw httpError(400, 'Please check your details.', fields);
  }
  return result.data;
}
