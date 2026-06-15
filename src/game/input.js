// src/game/input.js

// 表單欄位(email 留資等)聚焦時,全域駕駛鍵盤監聽必須放行 —— 否則 KEYMAP 的
// preventDefault 與 M/R 捷徑會吃掉 m/a/d/n/w/r… 等字母,讓人打不出 email。
export const isEditableTarget = (el) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true);

export function createInput(root) {
  const state = { gas: false, left: false, right: false, jump: false, nitro: false, reset: false, mute: localStorage.getItem('k-rider-mute') === '1' };
  const KEYMAP = {
    ArrowUp: 'gas', KeyW: 'gas',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump',
    ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro',
  };
  const onKey = (down) => (e) => {
    if (isEditableTarget(e.target)) return; // 在 email 等輸入框打字時別攔鍵
    const k = KEYMAP[e.code];
    if (k) { state[k] = down; e.preventDefault(); }
    if (down && e.code === 'KeyR') state.reset = true;
    if (down && e.code === 'KeyM') state.mute = !state.mute;
  };
  const kd = onKey(true), ku = onKey(false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  // 觸控按鈕（桌機隱藏，CSS @media (pointer: coarse) 顯示）
  const touchBar = document.createElement('div');
  touchBar.className = 'touch-bar';
  const btn = (label, key, cls) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = `touch-btn ${cls || ''}`;
    for (const [ev, val] of [['pointerdown', true], ['pointerup', false], ['pointercancel', false], ['pointerleave', false]]) {
      b.addEventListener(ev, (e) => { state[key] = val; e.preventDefault(); });
    }
    touchBar.appendChild(b);
    return b;
  };
  btn('◀', 'left'); btn('▶', 'right'); btn('N₂O', 'nitro', 'nitro'); btn('JUMP', 'jump'); btn('GAS', 'gas', 'gas');
  root.appendChild(touchBar);

  return {
    state,
    consumeReset() { const r = state.reset; state.reset = false; return r; },
    destroy() {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      touchBar.remove();
    },
  };
}
