// src/ui/settle.js — Task 13 會完整實作
export function showSettle(root, { result, onRetry }) {
  const el = document.createElement('div');
  el.className = 'settle';
  el.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;z-index:40;background:rgba(0,0,0,.6)';
  el.innerHTML = `<div style="text-align:center"><h2>${result.ev.finished ? 'FINISHED' : 'CRASHED'}</h2><p>${result.score} pts</p><button class="pill retry">RETRY</button></div>`;
  root.appendChild(el);
  el.querySelector('.retry').onclick = () => { el.remove(); onRetry(); };
}
