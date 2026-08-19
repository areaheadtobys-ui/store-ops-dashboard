async function handle(res) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export const api = {
  get(path) {
    return fetch(`/api${path}`).then(handle);
  },
  post(path, body) {
    return fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  put(path, body) {
    return fetch(`/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  patch(path, body) {
    return fetch(`/api${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle);
  },
  del(path) {
    return fetch(`/api${path}`, { method: 'DELETE' }).then(handle);
  },
  upload(path, formData) {
    return fetch(`/api${path}`, { method: 'POST', body: formData }).then(handle);
  },
};
