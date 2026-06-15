import zhTW from './zh-TW.js';
import en from './en.js';

const DICTS = { 'zh-TW': zhTW, en };
const KEY = 'k-rider-lang';
// localStorage 在瀏覽器以外的環境(測試/SSR)不存在;取不到就退預設,不讓 module 載入時爆掉。
const store = typeof localStorage !== 'undefined' ? localStorage : null;
let current = store?.getItem(KEY) || 'zh-TW';

export const lang = () => current;
export const t = (k) => DICTS[current][k] ?? DICTS['zh-TW'][k] ?? k;
export function setLang(l) {
  if (!DICTS[l]) return;
  current = l;
  store?.setItem(KEY, l);
  dispatchEvent(new Event('langchange'));
}
export const toggleLang = () => setLang(current === 'zh-TW' ? 'en' : 'zh-TW');
