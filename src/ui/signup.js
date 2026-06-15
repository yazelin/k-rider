// src/ui/signup.js
// 漏斗留資:免費價值先給(遊戲免費玩),留 email 換「每日挑戰提醒」+ 當場兌現精選賽道。
// honeypot:藏一個 name=company 欄位(CSS 移出視野),真人不填;有值 Worker 端假成功。
import { signup } from './api.js';

// 純函式:把 /signup 回應轉成顯示內容(非成功一律空殼)
export function describeSignupResult(body) {
  if (!body || typeof body !== 'object' || body.ok !== true) {
    return { ok: false, already: false, gift: null, message: '' };
  }
  const already = body.already === true;
  const gift = body.gift && typeof body.gift.url === 'string' ? body.gift : null;
  return {
    ok: true,
    already,
    gift,
    message: already
      ? '你已經在每日挑戰名單上了 —— 賽道連結照樣再給你一次:'
      : 'Email 已登記,每日挑戰提醒收到囉。先給你一條:',
  };
}

// DOM 接線。els:{ form, emailInput, companyInput, submitBtn, msgEl, giftEl, giftLink }
// source:'result' | 'about'。deps.signup 可注入以利測試,預設用 api.signup。
export function initSignup(els, { source = 'result' } = {}, deps = {}) {
  const doSignup = deps.signup || signup;
  const { form, emailInput, companyInput, submitBtn, msgEl, giftEl, giftLink } = els;

  const show = (text, ok = false) => {
    msgEl.textContent = text || '';
    msgEl.hidden = !text;
    msgEl.classList.toggle('is-ok', ok);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) { show('先填 Email,挑戰提醒馬上開始。'); return; }
    submitBtn.disabled = true;
    show('');
    try {
      const body = await doSignup({ email, company: companyInput.value, source });
      const r = describeSignupResult(body);
      if (!r.ok) { show('送出失敗,稍後再試。'); return; }
      show(r.message, true);
      if (r.gift) {
        giftLink.href = r.gift.url;
        giftLink.textContent = r.gift.label;
        giftEl.hidden = false;
      }
      form.querySelector('.signup-fields')?.setAttribute('hidden', '');
    } catch {
      show('連線出了點問題,稍後再試。');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
