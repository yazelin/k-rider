// src/main.js — temporary render verification (replaced in Task 12/14)
import './style.css';
import { sliceForPeriod } from './shared/candles.js';
import { buildTerrain } from './shared/terrain.js';
import { drawTerrain } from './game/render.js';

async function init() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/tickers/2330.TW.json`);
  const data = await res.json();
  const points = sliceForPeriod(data.daily, '1y');
  const terrain = buildTerrain(points);

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  document.querySelector('#app').appendChild(canvas);

  const ctx = canvas.getContext('2d');
  drawTerrain(ctx, terrain, { x: 0, y: 200 }, true);
}

init();
