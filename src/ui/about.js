// src/ui/about.js — 關於與聲明（單頁涵蓋條款/隱私/資料來源/聯絡）
import { t, lang } from '../i18n/index.js';
import { LINKS } from '../config.js';
import { SIGNUP_HTML, wireSignup } from './settle.js';

const CONTENT = {
  'zh-TW': [
    ['這是遊戲', 'K 線騎手是免費的網頁娛樂遊戲：用真實的歷史股價資料生成賽道，騎機車衝過去。就這樣，它是一個遊戲。'],
    ['非投資建議', '本站不是金融商品。顯示的股價為歷史資料，僅用於生成遊戲地形。本站任何內容都不構成投資建議、財務指引或任何買賣建議。請勿依據本遊戲做任何金融決策。認真的。'],
    ['市場資料', '歷史價格資料來自公開的金融 API（Yahoo Finance）。我們不保證資料的正確性、完整性或即時性，價格可能延遲或與實際市場不同。'],
    ['隱私', '不需要帳號。本站沒有 cookies 追蹤、沒有廣告追蹤器、也沒有安裝任何分析工具。提交每日挑戰成績時，你自填的暱稱與分數會匿名儲存在排行榜上，14 天後自動刪除；語言與暱稱偏好只存在你自己瀏覽器的 localStorage。IP 位址僅即時用於防濫用限流，不留存。'],
    ['合理使用', '請勿濫用服務、灌爆伺服器或用自動工具洗榜。我們保留封鎖濫用流量的權利。'],
    ['智慧財產', '程式碼以 MIT 授權開源（c) 2026 林亞澤。股票代號與公司名稱屬於各自的權利人。玩法靈感來自 stonkrider.com，無程式碼或素材複製。'],
    ['責任限制', '本遊戲按「現狀」提供，不附任何形式的保證。對於使用本遊戲所生的任何損害（包括但不限於你的虛擬損益與真實心情），我們不負任何責任。'],
    ['聯絡', '問題或合作：GitHub 開 issue，或透過頁尾的 Facebook 連結找到作者。'],
  ],
  en: [
    ['The game', 'K-Rider is a free browser game: terrain generated from real historical stock prices, and you ride a motocross bike across it. That is all it is — a game.'],
    ['Not financial advice', 'This site is not a financial product. Stock data shown is historical and used solely to generate game terrain. Nothing here constitutes investment advice or a recommendation to buy or sell any security. Do not make financial decisions based on this game. Seriously.'],
    ['Market data', 'Historical price data comes from publicly available financial APIs (Yahoo Finance). We do not guarantee accuracy, completeness, or timeliness.'],
    ['Privacy', 'No account required. No tracking cookies, no ad trackers, no analytics installed at all. When you submit a daily-challenge score, the nickname you typed and your score are stored anonymously on the leaderboard and auto-deleted after 14 days. Language and nickname preferences live only in your own browser localStorage. IP addresses are used transiently for abuse rate-limiting and are not retained.'],
    ['Acceptable use', 'Do not abuse the service, overload the servers, or spam the leaderboard with automated tools. We reserve the right to block abusive traffic.'],
    ['Intellectual property', 'Source code is MIT licensed (c) 2026 Yaze Lin. Ticker symbols and company names belong to their respective owners. Gameplay inspired by stonkrider.com; no code or assets copied.'],
    ['Limitation of liability', 'The game is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of it, including your virtual P&L and your real feelings.'],
    ['Contact', 'Questions or partnership: open a GitHub issue, or reach the author via the Facebook link in the footer.'],
  ],
};

export function renderAbout(root) {
  const zh = lang() === 'zh-TW';
  root.innerHTML = `
  <div class="lux">
    <header class="lux-nav">
      <span class="lux-brand">${t('app.name')}<em>K-RIDER</em></span>
      <a class="lux-pill" href="#/">← ${t('nav.home')}</a>
    </header>
    <main class="lux-main about-main">
      <p class="lux-kicker">${zh ? '關於與聲明' : 'ABOUT AND DISCLAIMERS'}</p>
      <h1 class="about-title">${zh ? '先說好，這只是遊戲' : 'To be clear: it is just a game'}</h1>
      <div class="about-body"></div>
      ${SIGNUP_HTML('每日一條挑戰', '留個 Email,每天一條精選台股 K 線賽道寄到信箱。免費,隨時退訂。')}
      <p class="about-updated">${zh ? '最後更新' : 'Last updated'}: 2026-06-12 · <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub</a></p>
    </main>
  </div>`;
  const body = root.querySelector('.about-body');
  for (const [title, text] of CONTENT[zh ? 'zh-TW' : 'en']) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    sec.append(h, p);
    body.appendChild(sec);
  }
  wireSignup(root, 'about');
}
