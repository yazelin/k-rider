// worker/src/util.js
const ALLOWED = ['https://yazelin.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];

export const isAllowedOrigin = (o) => ALLOWED.includes(o);

export const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export const sanitizeNickname = (raw) => {
  const s = String(raw || '').replace(/<[^>]*>/g, '').replace(/[<>&"'`]/g, '').trim().slice(0, 16);
  return s || 'rider';
};

export const json = (data, origin, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...corsHeaders(origin) } });

export async function rateLimit(env, route, ip, limit, dateStr) {
  const k = `rl:${route}:${ip}:${dateStr}`;
  const n = parseInt((await env.KRIDER.get(k)) || '0', 10) + 1;
  if (n > limit) return false;
  await env.KRIDER.put(k, String(n), { expirationTtl: 86400 * 2 });
  return true; // KV 最終一致 → 限流是近似值，可接受
}
