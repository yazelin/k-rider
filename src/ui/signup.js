// src/ui/signup.js
// 漏斗留資:免費價值先給(遊戲免費玩),留 email 換「每日挑戰提醒」+ 當場兌現精選賽道。
// honeypot:藏一個 name=company 欄位(CSS 移出視野),真人不填;有值 Worker 端假成功。
import { t } from '../i18n/index.js';
import { signup } from './api.js';

// 留資漏斗區塊(結算頁/about 共用結構);honeypot company 欄位靠 CSS 移出視野。
// title/sub 可不給:不給時用 i18n 預設(en.html 英文使用者也對)。
export const SIGNUP_HTML = (title, sub) => `
  <section class="signup">
    <h3 class="signup-title">${title ?? t('signup.title')}</h3>
    <p class="signup-sub">${sub ?? t('signup.sub')}</p>
    <form class="signup-form" novalidate>
      <div class="signup-fields">
        <input class="signup-email" type="email" inputmode="email" autocomplete="email" placeholder="${t('signup.placeholder')}" aria-label="Email" />
        <input class="signup-hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <button class="signup-go lux-btn gold" type="submit">${t('signup.submit')}</button>
      </div>
      <p class="signup-msg" hidden></p>
      <p class="signup-gift" hidden><a class="signup-gift-link" href="#"></a></p>
    </form>
  </section>`;

// 把表單元素湊齊接到 initSignup
export function wireSignup(scope, source) {
  const form = scope.querySelector('.signup-form');
  if (!form) return;
  initSignup({
    form,
    emailInput: form.querySelector('.signup-email'),
    companyInput: form.querySelector('.signup-hp'),
    submitBtn: form.querySelector('.signup-go'),
    msgEl: form.querySelector('.signup-msg'),
    giftEl: form.querySelector('.signup-gift'),
    giftLink: form.querySelector('.signup-gift-link'),
  }, { source });
}

// 純函式:把 /signup 回應轉成顯示「狀態」(非成功一律空殼)。
// 回傳 messageKey(i18n key,由呼叫端用 t() 解析)以利在地化;本函式不碰 i18n、保持可單測。
// badEmail:伺服器回 400 bad_email(或其他輸入錯誤)時為 true,讓呼叫端顯示格式提示而非連線錯誤。
export function describeSignupResult(body) {
  const isObj = !!body && typeof body === 'object';
  if (!isObj || body.ok !== true) {
    const badEmail = isObj && (body.error === 'bad_email' || body.error === 'bad_request');
    return { ok: false, already: false, badEmail, gift: null, messageKey: '' };
  }
  const already = body.already === true;
  const gift = body.gift && typeof body.gift.url === 'string' ? body.gift : null;
  return {
    ok: true,
    already,
    badEmail: false,
    gift,
    messageKey: already ? 'signup.okAlready' : 'signup.okFirst',
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
    if (!email) { show(t('signup.empty')); return; }
    submitBtn.disabled = true;
    show('');
    try {
      const body = await doSignup({ email, company: companyInput.value, source });
      const r = describeSignupResult(body);
      if (!r.ok) {
        show(r.badEmail ? t('signup.badEmail') : t('signup.sendFailed'));
        return;
      }
      show(t(r.messageKey), true);
      if (r.gift) {
        giftLink.href = r.gift.url;
        // worker 供的 gift.label 是 zh-TW;用在地化 fallback 讓英文使用者拿到英文標籤
        giftLink.textContent = t('signup.giftLabel');
        giftEl.hidden = false;
      }
      form.querySelector('.signup-fields')?.setAttribute('hidden', '');
    } catch {
      show(t('signup.netError'));
    } finally {
      submitBtn.disabled = false;
    }
  });
}
