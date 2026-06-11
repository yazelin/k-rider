// src/main.js（Task 14 改為完整 router）
import './style.css';
import { renderRide } from './ui/ride.js';
const app = document.querySelector('#app');
const m = location.hash.match(/^#\/ride\/([^?]+)\??(.*)$/);
if (m) renderRide(app, { symbol: decodeURIComponent(m[1]).toUpperCase(), params: new URLSearchParams(m[2]) });
else app.innerHTML = '<a class="pill" href="#/ride/2330.TW?p=1y" style="margin:40vh auto;display:block;width:max-content">ride 2330.TW</a>';
addEventListener('hashchange', () => location.reload());
