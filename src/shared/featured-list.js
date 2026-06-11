export const FEATURED = [
  { symbol: '2330.TW', market: 'tw', name: { 'zh-TW': '台積電', en: 'TSMC' } },
  { symbol: '2317.TW', market: 'tw', name: { 'zh-TW': '鴻海', en: 'Hon Hai (Foxconn)' } },
  { symbol: '2454.TW', market: 'tw', name: { 'zh-TW': '聯發科', en: 'MediaTek' } },
  { symbol: '0050.TW', market: 'tw', name: { 'zh-TW': '元大台灣50', en: 'Yuanta Taiwan 50 ETF' } },
  { symbol: '2603.TW', market: 'tw', name: { 'zh-TW': '長榮', en: 'Evergreen Marine' } },
  { symbol: '3008.TW', market: 'tw', name: { 'zh-TW': '大立光', en: 'Largan Precision' } },
  { symbol: 'TSLA', market: 'us', name: { 'zh-TW': '特斯拉', en: 'Tesla' } },
  { symbol: 'NVDA', market: 'us', name: { 'zh-TW': '輝達', en: 'NVIDIA' } },
  { symbol: 'AAPL', market: 'us', name: { 'zh-TW': '蘋果', en: 'Apple' } },
  { symbol: 'GME', market: 'us', name: { 'zh-TW': '遊戲驛站', en: 'GameStop' } },
  { symbol: 'SPY', market: 'us', name: { 'zh-TW': '標普500 ETF', en: 'S&P 500 ETF' } },
  { symbol: 'BTC-USD', market: 'crypto', name: { 'zh-TW': '比特幣', en: 'Bitcoin' } },
];

export const isTw = (symbol) => symbol.endsWith('.TW') || symbol.endsWith('.TWO');
