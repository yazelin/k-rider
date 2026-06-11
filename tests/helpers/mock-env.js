// tests/helpers/mock-env.js
export function mockEnv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    KRIDER: {
      async get(k) { return store.has(k) ? store.get(k) : null; },
      async put(k, v) { store.set(k, v); },
    },
    _store: store,
  };
}
export const req = (url, init = {}) =>
  new Request(url, { ...init, headers: { Origin: 'https://yazelin.github.io', 'content-type': 'application/json', 'CF-Connecting-IP': init.ip || '1.2.3.4', ...(init.headers || {}) } });
