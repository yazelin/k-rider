// src/i18n/roast-canned.js
const LINES = {
  'zh-TW': {
    crashEarly: ['出發三秒就摔，比開盤跳水還快。', '你連第一根 K 棒都沒騎完，主力看了都搖頭。', '這摔法，停損單都來不及掛。', '起跑就陣亡，建議改騎定存。', '這不是騎車，這是現貨梭哈。'],
    crashLate: ['騎到一半摔掉，跟抱到減半才賣一樣痛。', '差一點就完賽，跟差一點就獲利一樣可惜。', '你摔在半山腰，散戶都在那裡等你。', '中途畢業，韭菜界的老朋友。', '摔在這裡，剛好是融資斷頭價位。'],
    finishedLow: ['騎完了，但分數跟定存利率差不多。', '完賽精神可嘉，操作平淡如大盤。', '安全下莊，但一點都不刺激。', '你騎得很穩，穩到像在騎公債。', '完賽證書一張，僅供紀念。'],
    finishedHigh: ['這分數，主力都想找你操盤。', '騎得跟軋空行情一樣猛。', '高分完賽，今天你就是少年股神。', '這操作，巴菲特看了都點頭。', '滿血完賽，建議去考騎照順便考分析師。'],
  },
  en: {
    crashEarly: ['Crashed in 3 seconds. Faster than a market open dump.', 'You died before the first candle. Impressive.', 'Stop-loss could not even trigger that fast.', 'Instant liquidation. Try bonds.', 'That was not riding, that was full-port YOLO.'],
    crashLate: ['Crashed halfway — like selling at the bottom.', 'So close to the finish, so far from profit.', 'You fell where all retail traders fall.', 'Mid-ride exit. Classic paper hands.', 'Crashed right at the margin call level.'],
    finishedLow: ['Finished, but that score is basically savings-account APY.', 'Safe ride. Index-fund energy.', 'You survived. Barely bullish.', 'Steady like a government bond. Boring like one too.', 'Participation trophy earned.'],
    finishedHigh: ['Hedge funds want your number.', 'You rode that like a short squeeze.', 'Certified stonk rider. To the moon.', 'Even Buffett nodded at that run.', 'Full nitro finish. Go get a license and a CFA.'],
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
