// worker/src/hit.js
// 站台開啟計數。只記三件事:哪一天、哪個站、被打開幾次。
//
// 為什麼要有:亞澤有一半的作品是純靜態、沒有後端,所以「哪些作品真的有人用」
// 一直只能靠 GitHub 的 star 跟 repo 瀏覽數用猜的,而那兩個量到的是同行,不是使用者。
// 2026-08-18 掃過:143 個公開原創 repo 裡有 79 個近 14 天零訪客,但那是 repo 的訪客,
// 不是網站的。這支就是把那個問號變成一句 SQL。
//
// 刻意不做的事:不存 IP、不設 cookie、不給任何識別碼、不記 referrer。
// 所以它答得出「今天這個站被打開幾次」,答不出「幾個人」。後者要存識別,不值得。
import { corsHeaders } from './util.js';
import { taipeiDateStr } from '../../src/shared/daily-pick.js';

// 站名就是 repo 名,promo footer 裡本來就有 var REPO="..."
const SITE_RE = /^[a-z0-9][a-z0-9._-]{0,49}$/;
const SQL = 'INSERT INTO site_hits (day, site, n) VALUES (?1, ?2, 1) ON CONFLICT(day, site) DO UPDATE SET n = n + 1';

export async function handleHit(req, env, origin) {
  // sendBeacon 不看回應,回 204 就好;而且計數失敗絕不能影響任何頁面,所以一律回成功
  const done = () => new Response(null, { status: 204, headers: corsHeaders(origin) });
  const site = String(new URL(req.url).searchParams.get('s') || '').toLowerCase();
  if (!SITE_RE.test(site)) return done();
  try {
    await env.SIGNUPS.prepare(SQL).bind(taipeiDateStr(), site).run();
  } catch (e) {
    console.error('hit', site, e.message);
  }
  return done();
}
