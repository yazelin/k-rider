// worker/src/index.js
import { corsHeaders, json } from './util.js';
import { handleDaily } from './daily.js';
import { handleScore } from './score.js';
import { handleQuote } from './quote.js';
import { handleRoast } from './roast.js';
import { handleStats, handleEvent } from './stats.js';
import { handleSignup, handleList } from './signup.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    try {
      if (url.pathname === '/daily' && req.method === 'GET') return await handleDaily(req, env, origin);
      if (url.pathname === '/score' && req.method === 'POST') return await handleScore(req, env, origin);
      if (url.pathname === '/quote' && req.method === 'GET') return await handleQuote(req, env, origin);
      if (url.pathname === '/roast' && req.method === 'POST') return await handleRoast(req, env, origin);
      if (url.pathname === '/stats' && req.method === 'GET') return await handleStats(req, env, origin);
      if (url.pathname === '/event' && req.method === 'POST') return await handleEvent(req, env, origin);
      if (url.pathname === '/signup' && req.method === 'POST') return await handleSignup(req, env, origin);
      if (url.pathname === '/admin/list' && req.method === 'GET') return await handleList(req, env, origin);
      return json({ error: 'not found' }, origin, 404);
    } catch (e) {
      console.error('unhandled', e); // 細節留 log，不回給 client
      return json({ error: 'internal' }, origin, 500);
    }
  },
};
