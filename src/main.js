import './style.css';
import { renderHome } from './ui/home.js';
import { renderRide } from './ui/ride.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { renderAbout } from './ui/about.js';

const app = document.querySelector('#app');

function route() {
  app.cleanup?.();
  app.cleanup = null;
  app.innerHTML = '';
  const hash = location.hash || '#/';
  let m;
  if ((m = hash.match(/^#\/ride\/([^?]+)\??(.*)$/))) {
    renderRide(app, { symbol: decodeURIComponent(m[1]).toUpperCase(), params: new URLSearchParams(m[2]) });
  } else if (hash.startsWith('#/leaderboard')) {
    renderLeaderboard(app);
  } else if (hash.startsWith('#/about')) {
    renderAbout(app);
  } else {
    renderHome(app);
  }
}
addEventListener('hashchange', route);
addEventListener('langchange', route);
route();
