// src/ui/api.js
import { WORKER_URL } from '../config.js';

// workers.dev 偶發連線抖動（Failed to fetch）有時持續數秒：網路層失敗重試三次、退避遞增
async function call(path, init, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`${WORKER_URL}${path}`, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // 伺服器回應錯誤不重試
      return res.json();
    } catch (e) {
      if (i >= tries || String(e).includes('HTTP ')) throw e;
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}
const post = (path, body) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const getDaily = () => call('/daily');
export const getStats = () => call('/stats');
export const postScore = (body) => post('/score', body);
export const postRoast = (body) => post('/roast', body);
export const postEvent = (type, volume) => post('/event', { type, volume });

// email 留資。回 /signup 的 JSON body(成功/already/錯誤都回 body,呼叫端用 describeSignupResult 判讀)
// 注意:call() 對非 2xx 會 throw。4xx 是「使用者輸入問題」(bad_email),要回 body 讓 describeSignupResult 判讀,
// 不能讓它被當成連線錯誤;真正的網路失敗 / 5xx 仍然 throw,由呼叫端顯示連線訊息。
export async function signup({ email, company = '', source = 'result' }) {
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, company, source }) };
  try {
    return await call('/signup', init);
  } catch (e) {
    const m = /HTTP (\d+)/.exec(String(e));
    const status = m ? Number(m[1]) : 0;
    if (status >= 400 && status < 500) {
      // 取回伺服器的錯誤 body(例如 { error: 'bad_email' });單次抓取、失敗就回最小 body
      try {
        const res = await fetch(`${WORKER_URL}/signup`, init);
        const body = await res.json();
        return body && typeof body === 'object' ? body : { error: 'bad_request' };
      } catch {
        return { error: 'bad_request' };
      }
    }
    throw e; // 連線抖動 / 5xx → 交給呼叫端顯示連線訊息
  }
}
