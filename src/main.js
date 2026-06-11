// src/main.js — temporary render verification (replaced in Task 12/14)
import './style.css';
import Matter from 'matter-js';
import { sliceForPeriod } from './shared/candles.js';
import { buildTerrain } from './shared/terrain.js';
import { drawTerrain, drawBike } from './game/render.js';
import { createEngine, terrainBodies, createBike, addBike } from './game/physics.js';

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

  // Physics setup
  const engine = createEngine();
  Matter.World.add(engine.world, terrainBodies(terrain.vertices));
  const spawnX = terrain.vertices[0].x + 50;
  const spawnY = terrain.vertices[0].y - 80;
  const bike = createBike(spawnX, spawnY);
  addBike(engine, bike);

  function loop() {
    Matter.Engine.update(engine, 1000 / 60);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pos = bike.chassis.position;
    const cam = { x: pos.x - canvas.width * 0.35, y: pos.y - canvas.height * 0.55 };
    drawTerrain(ctx, terrain, cam, true);
    drawBike(ctx, bike, cam);
    requestAnimationFrame(loop);
  }
  loop();
}

init();
