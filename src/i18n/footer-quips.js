// src/i18n/footer-quips.js — 頁尾隨機梗句（每次載入抽一句）
const QUIPS = {
  'zh-TW': [
    '我已迷路，請勿跟單',
    '股票市場有賺有賠，騎車前請詳閱公開說明書',
    '過去績效不代表未來摔法',
    '本遊戲唯一保證：摔得比大盤快',
    '老師只教騎車，不報明牌',
    '長期持有，短期摔倒',
    '騎得好不代表買得對',
    '你摔車的樣子，很像我去年的對帳單',
    '撐得過熊市，撐不過這個彎',
    '融資自摔，盈虧自負',
    '逢低騎進，逢高噴飛',
    '不是投資建議，是物理教訓',
  ],
  en: [
    'Lost rider. Do not follow my trades.',
    'Past performance does not guarantee future crashes.',
    'Only guarantee: crashing faster than the index.',
    'Hold long term, fall short term.',
    'Your coach teaches riding, not stock picks.',
    'Riding well does not mean buying right.',
    'You crash like my portfolio did last year.',
    'Survived the bear market, not this corner.',
    'Buy the dip, fly off the rip.',
    'Not financial advice. Physical advice.',
  ],
};

export const randomQuip = (lang) => {
  const arr = QUIPS[lang] || QUIPS['zh-TW'];
  return arr[Math.floor(Math.random() * arr.length)];
};
