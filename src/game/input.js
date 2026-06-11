// src/game/input.js
export function createInput(root) {
  const state = { gas: false, left: false, right: false, jump: false, nitro: false, reset: false, mute: false };
  const KEYMAP = {
    ArrowUp: 'gas', KeyW: 'gas',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump',
    ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro',
  };
  const onKey = (down) => (e) => {
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
