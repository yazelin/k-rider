// src/ui/share.js — 結算戰績分享卡（梗圖）
import { FEATURED, isTw } from '../shared/featured-list.js';
import { t, lang } from '../i18n/index.js';

const SITE = 'https://yazelin.github.io/k-rider/';
const CAPITAL = 100000; // 虛擬本金

export function profitOf(series, result) {
  const start = series[0].close;
  const endIdx = result.ev.finished
    ? series.length - 1
    : Math.min(result.crashedAtIndex ?? 0, series.length - 1);
  return { profit: Math.round(CAPITAL * (series[endIdx].close / start - 1)), endIdx };
}

const fmtMoney = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString()}`;

function displayName(symbol) {
  const f = FEATURED.find((x) => x.symbol === symbol);
  return f ? `${f.name[lang()] || f.name.en}(${symbol})` : symbol;
}

export function shareText({ symbol, series, result }) {
  const { profit } = profitOf(series, result);
  const n = result.ev.pointsPassed;
  const c = result.ev.crashes || 0;
  const link = `${SITE}#/ride/${encodeURIComponent(symbol)}`;
  if (lang() === 'zh-TW') {
    const outcome = result.ev.finished ? (c > 0 ? `翻車 ${c} 次後完賽` : '零翻車完賽') : t('share.crashed');
    return `我用「${t('app.name')}」在 ${displayName(symbol)} ${t('share.holding')} ${n} ${t('share.candles')}，${t('share.pnl')} ${fmtMoney(profit)}，${outcome}。${t('share.cta')}：${link}`;
  }
  const outcome = result.ev.finished ? (c > 0 ? `finished after flipping ${c} times` : 'finished clean, zero crashes') : t('share.crashed');
  return `I rode "${t('app.name')}" on ${displayName(symbol)} for ${n} candles, ${t('share.pnl')} ${fmtMoney(profit)} — ${outcome}. ${t('share.cta')}: ${link}`;
}

export function buildShareCard({ symbol, series, result }) {
  const { profit, endIdx } = profitOf(series, result);
  const redUp = isTw(symbol);
  const zh = lang() === 'zh-TW';
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // 賽道折線（背景，逐段漲跌染色）
  const closes = series.map((p) => p.close);
  const min = Math.min(...closes), max = Math.max(...closes), range = max - min || 1;
  const px = (i) => 80 + (i / (closes.length - 1)) * (W - 160);
  const py = (v) => 420 - ((v - min) / range) * 230;
  for (let i = 1; i < closes.length; i++) {
    const up = closes[i] >= closes[i - 1];
    ctx.strokeStyle = (up === redUp) ? '#ff5a5a' : '#36e07f';
    ctx.lineWidth = 3;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(px(i - 1), py(closes[i - 1]));
    ctx.lineTo(px(i), py(closes[i]));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 騎到哪：終點/摔車點標記
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(px(endIdx), py(closes[endIdx]), 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '28px sans-serif';
  ctx.fillText(result.ev.finished ? (zh ? '完賽' : 'FINISH') : (zh ? '摔車點' : 'CRASH'), Math.min(px(endIdx) + 16, W - 150), py(closes[endIdx]) - 14);

  // 標題列
  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(zh ? `${t('app.name')} K-RIDER` : 'K-RIDER', 80, 88);
  ctx.fillStyle = '#e6e9f0';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(displayName(symbol), 80, 160);

  // 損益大字（台股紅賺綠賠、美股反之）
  ctx.fillStyle = (profit >= 0) === redUp ? '#ff5a5a' : '#36e07f';
  ctx.font = 'bold 110px ui-monospace, monospace';
  ctx.fillText(fmtMoney(profit), 80, 290);

  // 副標
  ctx.fillStyle = '#8b93a7';
  ctx.font = '32px sans-serif';
  const sub = zh
    ? `${t('share.holding')} ${result.ev.pointsPassed} ${t('share.candles')} · ${result.score.toLocaleString()} ${t('hud.points')} · ${result.ev.finished ? t('share.finished') : t('share.crashed')}`
    : `${result.ev.pointsPassed} ${t('share.candles')} · ${result.score.toLocaleString()} ${t('hud.points')} · ${result.ev.finished ? t('share.finished') : t('share.crashed')}`;
  ctx.fillText(sub, 80, 480);
  ctx.fillStyle = '#5eead4';
  ctx.font = '30px ui-monospace, monospace';
  ctx.fillText(SITE, 80, 560);

  return c;
}

export async function shareResult(payload) {
  const canvas = buildShareCard(payload);
  const text = shareText(payload);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'k-rider.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'done';
    } catch (e) {
      if (e.name === 'AbortError') return 'done'; // 使用者自己取消，不當錯誤
    }
  }
  // 桌機 fallback：下載圖 + 複製文字
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `k-rider-${payload.symbol}.png`;
  a.click();
  URL.revokeObjectURL(a.href);
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard 可能被拒，圖已下載 */ }
  return 'saved';
}
