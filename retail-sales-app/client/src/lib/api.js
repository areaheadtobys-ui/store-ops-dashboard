async function handle(res) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const api = {
  get(path) {
    return fetch(`/api${path}`, { credentials: 'include' }).then(handle);
  },
  post(path, body) {
    return fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  put(path, body) {
    return fetch(`/api${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  patch(path, body) {
    return fetch(`/api${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  del(path) {
    return fetch(`/api${path}`, { method: 'DELETE', credentials: 'include' }).then(handle);
  },
  upload(path, formData) {
    return fetch(`/api${path}`, { method: 'POST', credentials: 'include', body: formData }).then(handle);
  },
};
