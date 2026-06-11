// src/game/run.js
import Matter from 'matter-js';
import { SPACING } from '../shared/terrain.js';
import { score } from '../shared/scoring.js';
import { createEngine, terrainBodies, createBike, addBike } from './physics.js';
import { drawTerrain, drawBike, drawMinimap, drawEventMarks } from './render.js';

export const countFlips = (rad) => Math.floor(Math.abs(rad) / (Math.PI * 2));
export const pointIndexAt = (x) => Math.max(0, Math.floor(x / SPACING));

const NITRO_MAX_MS = 4000;

export function createRun({ canvas, minimap, terrain, redUp, input, onTick, onEnd }) {
  const engine = createEngine();
  Matter.World.add(engine.world, terrainBodies(terrain.vertices));
  const spawn = { x: terrain.vertices[0].x + 50, y: terrain.vertices[0].y - 80 };
  const bike = createBike(spawn.x, spawn.y);
  addBike(engine, bike);

  const contacts = { wheelB: 0, wheelF: 0 };
  let crashed = false;
  Matter.Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      for (const [me, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
        if (other.label !== 'ground') continue;
        if (me.label === 'wheelB') contacts.wheelB++;
        if (me.label === 'wheelF') contacts.wheelF++;
        if (me.label === 'head') crashed = true;
        if (me.label === 'frame') {
          const a = ((bike.chassis.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (a > 1.75 && a < Math.PI * 2 - 1.75) crashed = true; // 倒插觸地
        }
      }
    }
  });
  Matter.Events.on(engine, 'collisionEnd', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      for (const [me, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
        if (other.label !== 'ground') continue;
        if (me.label === 'wheelB') contacts.wheelB = Math.max(0, contacts.wheelB - 1);
        if (me.label === 'wheelF') contacts.wheelF = Math.max(0, contacts.wheelF - 1);
      }
    }
  });

  const ev = { pointsPassed: 0, nitroPointsPassed: 0, airSegmentsMs: [], flips: 0, wheelieMs: 0, finished: false, nitroLeftRatio: 0 };
  let nitroMs = NITRO_MAX_MS;
  let airStart = null, lastAngle = 0, accAngle = 0;
  let maxPoint = 0, elapsed = 0, ended = false;
  const cam = { x: 0, y: 0 };
  const ctx = canvas.getContext('2d');
  const endX = terrain.vertices.at(-1).x;

  // Precompute fall-out threshold once (O(n) at setup, not per step)
  let maxTerrainY = -Infinity;
  for (const v of terrain.vertices) { if (v.y > maxTerrainY) maxTerrainY = v.y; }
  const fallY = maxTerrainY + 800;

  let raf = 0, acc = 0, last = performance.now();

  function end(finished) {
    if (ended) return;
    ended = true;
    ev.finished = finished;
    ev.nitroLeftRatio = nitroMs / NITRO_MAX_MS;
    if (airStart !== null) { ev.airSegmentsMs.push(elapsed - airStart); airStart = null; }
    cancelAnimationFrame(raf);
    onEnd({ ev, score: score(ev), elapsed, crashedAtIndex: finished ? null : maxPoint });
  }

  function step(dt) {
    elapsed += dt;
    const s = input.state;
    const grounded = contacts.wheelB > 0 || contacts.wheelF > 0;
    const rearOnly = contacts.wheelB > 0 && contacts.wheelF === 0;

    if (s.gas) Matter.Body.setAngularVelocity(bike.wheelB, Math.min(bike.wheelB.angularVelocity + 0.06, 1.6));
    if (!grounded) {
      if (s.left) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity - 0.005);
      if (s.right) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity + 0.005);
    } else if (s.left) {
      bike.chassis.torque = -0.9; // 地面翹孤輪
    } else if (s.right) {
      bike.chassis.torque = 0.6;  // 壓車頭
    }
    if (s.jump && grounded) {
      Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: 0, y: -0.14 * bike.chassis.mass });
      input.state.jump = false; // 單發
    }
    const nitroOn = s.nitro && nitroMs > 0;
    if (nitroOn) {
      nitroMs -= dt;
      const a = bike.chassis.angle;
      Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(a) * 0.004 * bike.chassis.mass, y: Math.sin(a) * 0.004 * bike.chassis.mass });
    } else {
      nitroMs = Math.min(NITRO_MAX_MS, nitroMs + dt * 0.12); // 緩慢回充
    }

    Matter.Engine.update(engine, dt);

    // 騰空 / 空翻
    if (!grounded && airStart === null) { airStart = elapsed; lastAngle = bike.chassis.angle; accAngle = 0; }
    if (!grounded && airStart !== null) { accAngle += bike.chassis.angle - lastAngle; lastAngle = bike.chassis.angle; }
    if (grounded && airStart !== null) {
      ev.airSegmentsMs.push(elapsed - airStart);
      ev.flips += countFlips(accAngle);
      airStart = null;
    }
    if (rearOnly) ev.wheelieMs += dt;

    // 過點
    const idx = Math.min(pointIndexAt(bike.chassis.position.x), terrain.vertices.length - 1);
    while (maxPoint < idx) {
      maxPoint++;
      ev.pointsPassed++;
      if (nitroOn) ev.nitroPointsPassed++;
    }

    if (crashed) return end(false);
    if (bike.chassis.position.x >= endX) return end(true);
    if (bike.chassis.position.y > fallY) return end(false); // 掉出世界
  }

  function frame(now) {
    acc += now - last;
    last = now;
    acc = Math.min(acc, 200);
    while (acc >= 1000 / 60 && !ended) { step(1000 / 60); acc -= 1000 / 60; }
    if (ended) return;
    cam.x += (bike.chassis.position.x - canvas.width * 0.35 - cam.x) * 0.12;
    cam.y += (bike.chassis.position.y - canvas.height * 0.55 - cam.y) * 0.08;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTerrain(ctx, terrain, cam, redUp);
    drawEventMarks(ctx, terrain, cam);
    drawBike(ctx, bike, cam);
    drawMinimap(minimap, terrain, bike.chassis.position.x, redUp);
    onTick({ score: score({ ...ev, airSegmentsMs: airStart !== null ? [...ev.airSegmentsMs, elapsed - airStart] : ev.airSegmentsMs }), elapsed, nitroRatio: nitroMs / NITRO_MAX_MS, airborne: airStart !== null });
    if (input.consumeReset()) { destroy(); onEnd({ reset: true }); return; }
    raf = requestAnimationFrame(frame);
  }

  function start() { last = performance.now(); raf = requestAnimationFrame(frame); }
  function destroy() { ended = true; cancelAnimationFrame(raf); Matter.Engine.clear(engine); }
  return { start, destroy };
}
