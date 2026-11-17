export function httpError(status, message, fields) {
  return Object.assign(new Error(message), { status, fields });
}
