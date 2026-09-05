// worker/src/index.js
import { corsHeaders, json } from './util.js';
import { handleDaily } from './daily.js';
import { handleScore } from './score.js';
import { handleQuote } from './quote.js';
import { handleRoast } from './roast.js';
import { handleStats, handleEvent } from './stats.js';
import { handleHit } from './hit.js';
import { handleHitsPage } from './hits-page.js';
import { handleSignup, handleList } from './signup.js';
import { handleRegister, handleRegList } from './register.js';
import { handleVoteGet, handleVotePost } from './vote.js';
import { handleNote, handleNotesList } from './notes.js';
import { handleLiveGet, handleLivePost, handleLiveAdmin } from './live.js';

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
      // 站台開啟計數(promo footer 打過來的)。POST=sendBeacon、GET=手動驗證用
      if (url.pathname === '/hit' && (req.method === 'POST' || req.method === 'GET')) return await handleHit(req, env, origin);
      // 公開儀表板(HTML),看 site_hits
      if (url.pathname === '/hits' && req.method === 'GET') return await handleHitsPage(req, env);
      if (url.pathname === '/signup' && req.method === 'POST') return await handleSignup(req, env, origin);
      if (url.pathname === '/register' && req.method === 'POST') return await handleRegister(req, env, origin);
      // 週三直播主題投票。一人一列,改答案是覆寫
      if (url.pathname === '/vote' && req.method === 'GET') return await handleVoteGet(req, env, origin);
      if (url.pathname === '/vote' && req.method === 'POST') return await handleVotePost(req, env, origin);
      // 現場共同創作的即時投票:講者推題、大家投、當場關票
      if (url.pathname === '/live' && req.method === 'GET') return await handleLiveGet(req, env, origin);
      if (url.pathname === '/live' && req.method === 'POST') return await handleLivePost(req, env, origin);
      if (url.pathname === '/live/admin' && req.method === 'POST') return await handleLiveAdmin(req, env, origin);
      // 投票頁的文字回饋:想聽的不在上面 / 想來講 / 某一場的心得。一律不公開,讀取走 /admin/notes
      if (url.pathname === '/note' && req.method === 'POST') return await handleNote(req, env, origin);
      if (url.pathname === '/admin/notes' && req.method === 'GET') return await handleNotesList(req, env, origin);
      if (url.pathname === '/admin/list' && req.method === 'GET') return await handleList(req, env, origin);
      if (url.pathname === '/admin/registrations' && req.method === 'GET') return await handleRegList(req, env, origin);
      return json({ error: 'not found' }, origin, 404);
    } catch (e) {
      console.error('unhandled', e); // 細節留 log，不回給 client
      return json({ error: 'internal' }, origin, 500);
    }
  },
};
