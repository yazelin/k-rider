// src/i18n/roast-canned.js
const LINES = {
  'zh-TW': {
    crashEarly: ['出發三秒就摔，比開盤跳水還快。', '你連第一根 K 棒都沒騎完，主力看了都搖頭。', '這摔法，停損單都來不及掛。', '起跑就陣亡，建議改騎定存。', '這不是騎車，這是現貨梭哈。'],
    crashLate: ['騎到一半摔掉，跟抱到減半才賣一樣痛。', '差一點就完賽，跟差一點就獲利一樣可惜。', '你摔在半山腰，散戶都在那裡等你。', '中途畢業，韭菜界的老朋友。', '摔在這裡，剛好是融資斷頭價位。', '老師沒翻，你先翻了。'],
    finishedLow: ['騎完了，但分數跟定存利率差不多。', '完賽精神可嘉，操作平淡如大盤。', '安全下莊，但一點都不刺激。', '你騎得很穩，穩到像在騎公債。', '完賽證書一張，僅供紀念。'],
    finishedHigh: ['這分數，主力都想找你操盤。', '騎得跟軋空行情一樣猛。', '高分完賽，今天你就是少年股神。', '這操作，巴菲特看了都點頭。', '滿血完賽，建議去考騎照順便考分析師。'],
  },
  en: {
    crashEarly: ['Instant liquidation. Did not even see the first candle.', 'Rugged at the starting line.', 'That was not a ride, that was a market order into the void.', 'Stop-loss could not save you. Nothing could.', 'Speedrun to zero. New world record.'],
    crashLate: ['Sold the bottom. With your face.', 'So close to the finish. Classic paper hands.', 'You fell exactly where retail always falls.', 'Margin called by gravity.', 'Halfway hero, full-time bagholder.', 'The guru is still up. You are upside down.'],
    finishedLow: ['Finished. Returns roughly equal to a savings account.', 'Index fund energy. Survived, barely bullish.', 'Played it safe. Bonds called, they want their vibe back.', 'A participation trophy, but make it finance.', 'Did not beat the market, did not become a meme either.'],
    finishedHigh: ['Certified stonk rider. To the moon.', 'You rode that like a short squeeze.', 'Hedge funds want your number.', 'Full nitro finish. Absolute degen excellence.', 'So this is the alpha everyone keeps talking about.'],
  },
};

export function cannedRoast(ev, score, lang) {
  const dict = LINES[lang] || LINES['zh-TW'];
  let bucket;
  if (!ev.finished) bucket = ev.pointsPassed < 20 ? 'crashEarly' : 'crashLate';
  else bucket = score < 40000 ? 'finishedLow' : 'finishedHigh';
  const arr = dict[bucket];
  return arr[Math.floor(Math.random() * arr.length)];
}
