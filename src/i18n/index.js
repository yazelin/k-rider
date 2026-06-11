import zhTW from './zh-TW.js';
import en from './en.js';

const DICTS = { 'zh-TW': zhTW, en };
const KEY = 'k-rider-lang';
let current = localStorage.getItem(KEY) || 'zh-TW';

export const lang = () => current;
export const t = (k) => DICTS[current][k] ?? DICTS['zh-TW'][k] ?? k;
export function setLang(l) {
  if (!DICTS[l]) return;
  current = l;
  localStorage.setItem(KEY, l);
  dispatchEvent(new Event('langchange'));
}
export const toggleLang = () => setLang(current === 'zh-TW' ? 'en' : 'zh-TW');
