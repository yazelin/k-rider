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
export const signup = ({ email, company = '', source = 'result' }) => post('/signup', { email, company, source });
