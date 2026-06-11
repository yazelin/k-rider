// src/i18n/index.js — Task 14 會完整實作（先用 zh-TW 假字典讓 UI 可跑）
export const lang = () => 'zh-TW';
const STUB = {
  'nav.home': '首頁',
  'period.smooth': '平滑',
  'hud.points': '分',
  'hud.grounded': '貼地',
  'hud.airborne': '騰空',
  'notFound': '找不到這檔股票的資料',
  'settle.finished': '完賽！',
  'settle.crashed': '摔車了',
  'settle.distance': '里程',
  'settle.airtime': '滯空',
  'settle.flips': '空翻',
  'settle.time': '耗時',
  'settle.retry': '再騎一次',
  'settle.nickname': '暱稱',
  'settle.submit': '提交成績',
  'settle.submitted': '已上榜！',
  'settle.submitFailed': '提交失敗，再試一次',
};
export const t = (k) => STUB[k] ?? k;
