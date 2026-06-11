// src/ui/api.js
import { WORKER_URL } from '../config.js';

const j = async (res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); };

export const getDaily = () => fetch(`${WORKER_URL}/daily`).then(j);
export const getStats = () => fetch(`${WORKER_URL}/stats`).then(j);
export const postScore = (body) =>
  fetch(`${WORKER_URL}/score`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j);
export const postRoast = (body) =>
  fetch(`${WORKER_URL}/roast`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j);
export const postEvent = (type) =>
  fetch(`${WORKER_URL}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }) }).then(j);
