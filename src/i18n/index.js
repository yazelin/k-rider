// src/i18n/index.js — Task 14 會完整實作（先用 zh-TW 假字典讓 UI 可跑）
export const lang = () => 'zh-TW';
const STUB = { 'nav.home': '首頁', 'period.smooth': '平滑', 'hud.points': '分', 'hud.grounded': '貼地', 'hud.airborne': '騰空', 'notFound': '找不到這檔股票的資料' };
export const t = (k) => STUB[k] ?? k;
