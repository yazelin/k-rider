// src/game/audio.js — WebAudio 合成音效（零素材）：引擎/跳躍/落地/特技/翻車/完賽/氮氣
// AudioContext 需要使用者手勢後才能啟動：在出發（點擊/按鍵）時建立
const MUTE_KEY = 'k-rider-mute';

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return nullAudio();
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = localStorage.getItem(MUTE_KEY) === '1' ? 0 : 0.5;
  master.connect(ctx.destination);

  // 引擎：鋸齒波 + 低通，頻率跟車速
  const engOsc = ctx.createOscillator();
  engOsc.type = 'sawtooth';
  engOsc.frequency.value = 40;
  const engFilter = ctx.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 300;
  const engGain = ctx.createGain();
  engGain.gain.value = 0;
  engOsc.connect(engFilter).connect(engGain).connect(master);
  engOsc.start();

  // 氮氣：白噪音 + 帶通
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const nitroSrc = ctx.createBufferSource();
  nitroSrc.buffer = noiseBuf;
  nitroSrc.loop = true;
  const nitroFilter = ctx.createBiquadFilter();
  nitroFilter.type = 'bandpass';
  nitroFilter.frequency.value = 900;
  nitroFilter.Q.value = 0.7;
  const nitroGain = ctx.createGain();
  nitroGain.gain.value = 0;
  nitroSrc.connect(nitroFilter).connect(nitroGain).connect(master);
  nitroSrc.start();

  // 一次性音：簡短振盪音
  function blip(freq, dur = 0.12, type = 'sine', vol = 0.25, slideTo = null) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }
  function thud(vol = 0.5, dur = 0.18) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  return {
    resume() { if (ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    },
    isMuted: () => localStorage.getItem(MUTE_KEY) === '1',
    // 每 tick 呼叫：油門狀態 + 速度比（0~1）
    engine(on, speedRatio) {
      const target = on ? 0.1 + speedRatio * 0.05 : Math.max(0, speedRatio * 0.04);
      engGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engOsc.frequency.setTargetAtTime(45 + speedRatio * 130, ctx.currentTime, 0.1);
      engFilter.frequency.setTargetAtTime(280 + speedRatio * 900, ctx.currentTime, 0.1);
    },
    nitro(on) { nitroGain.gain.setTargetAtTime(on ? 0.12 : 0, ctx.currentTime, 0.05); },
    jump() { blip(220, 0.18, 'square', 0.12, 440); },
    land(intensity) { thud(Math.min(0.45, 0.15 + intensity * 0.3), 0.15); },
    trick() { blip(660, 0.1, 'sine', 0.2); setTimeout(() => blip(880, 0.14, 'sine', 0.2), 70); },
    crash() { thud(0.55, 0.3); blip(180, 0.3, 'sawtooth', 0.18, 60); },
    finish() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    destroy() { try { ctx.close(); } catch { /* already closed */ } },
  };
}

function nullAudio() {
  const noop = () => {};
  return { resume: noop, setMuted: noop, isMuted: () => true, engine: noop, nitro: noop, jump: noop, land: noop, trick: noop, crash: noop, finish: noop, destroy: noop };
}
