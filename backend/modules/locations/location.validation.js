import { z } from 'zod';
import { httpError } from '../../shared/errors.js';

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

export function validateCoordinates(body) {
  const result = coordinatesSchema.safeParse(body);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] || 'form';
      fields[key] ??= issue.message;
    }
    throw httpError(400, 'Please provide valid coordinates.', fields);
  }
  return result.data;
}
