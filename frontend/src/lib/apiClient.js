export class ApiError extends Error {
  constructor(status, data) {
    super(data.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.fields = data.fields || {};
  }
}

async function decode(response) {
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export async function apiClient(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (method !== 'GET') {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'include', signal }).then(decode);
    headers['X-CSRF-Token'] = csrf.csrfToken;
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`/api${path}`, {
    method, headers, credentials: 'include', signal,
    ...(method !== 'GET' && { body: JSON.stringify(body || {}) }),
  }).then(decode);
}
