import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { httpError } from '../../shared/errors.js';

const text = (maxLength, required = true) => z.string()
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), 'Control characters are not allowed.')
  .transform((value) => value.trim())
  .pipe(z.string().min(required ? 1 : 0, 'This field is required.').max(maxLength));

const phone = text(40).transform((value, ctx) => {
  const number = parsePhoneNumberFromString(value, { defaultCountry: 'SE', extract: false });
  if (!number?.isValid() || !/^\+[1-9][0-9]{7,14}$/.test(number.number)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number, including a country code for numbers outside Sweden.' });
    return z.NEVER;
  }
  return number.number;
});

const createAddressSchema = z.object({
  recipientName: text(200),
  phoneNumber: phone,
  addressLine1: text(200),
  addressLine2: text(200, false).default(''),
  postalCode: text(6)
    .pipe(z.string().regex(/^[0-9]{3} ?[0-9]{2}$/, 'Enter a valid Swedish postcode, for example 254 38.'))
    .transform((value) => value.replace(' ', '')),
  city: text(100),
  countryCode: z.literal('SE'),
  isDefault: z.boolean(),
  selectForDelivery: z.boolean(),
}).strict();

const addressReferenceSchema = z.object({
  addressId: z.uuid().transform((value) => value.toLowerCase()),
}).strict();
const updateAddressSchema = createAddressSchema.omit({ isDefault: true, selectForDelivery: true });

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] || 'form';
      fields[key] ??= issue.message;
    }
    throw httpError(400, 'Please check your address.', fields);
  }
  return result.data;
}

export const validateCreateAddress = (body) => parse(createAddressSchema, body);
export const validateSelectedAddress = (body) => parse(addressReferenceSchema, body);
export const validateDefaultAddress = (body) => parse(addressReferenceSchema, body);
export const validateUpdateAddress = (body) => parse(updateAddressSchema, body);
export const validateAddressId = (id) => parse(z.uuid().transform((value) => value.toLowerCase()), id);
