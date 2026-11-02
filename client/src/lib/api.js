/** Small fetch wrapper for the SAFEPATH REST API. */

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal, formData } = {}) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: {},
    signal,
  };

  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      navigator.onLine
        ? 'Could not reach the SAFEPATH server. Please try again.'
        : 'You appear to be offline. Check your internet connection and try again.',
      0,
    );
  }

  if (res.status === 204) return null;

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.error || `Request failed (${res.status}).`;
    throw new ApiError(message, res.status, payload?.details);
  }
  return payload;
}

export const get = (path, opts) => api(path, opts);
export const post = (path, body, opts) => api(path, { ...opts, method: 'POST', body });
export const patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });
export const del = (path, opts) => api(path, { ...opts, method: 'DELETE' });

export function qs(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}
