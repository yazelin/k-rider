// src/game/run.js
import Matter from 'matter-js';
import { SPACING } from '../shared/terrain.js';
import { score } from '../shared/scoring.js';
import { createEngine, terrainBodies, createBike, addBike } from './physics.js';
import { drawTerrain, drawBike, drawMinimap, drawEventMarks, drawBackdrop } from './render.js';

export const countFlips = (rad) => Math.floor(Math.abs(rad) / (Math.PI * 2));
export const pointIndexAt = (x) => Math.max(0, Math.floor(x / SPACING));

const NITRO_MAX_MS = 4000;
export const GAS_ACCEL = 0.09;   // 每步後輪角速度增量（爬坡力）
export const GAS_MAX = 2.0;      // 後輪角速度上限
export const GAS_ASSIST = 0.0018; // 貼地油門輔助推力（爬坡用，< 重力分量不會飛）
const MAX_SPEED = 28;          // px/step 全域速度上限

export function createRun({ canvas, minimap, terrain, redUp, input, market = 'us', onTick, onEnd }) {
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

  const ev = { pointsPassed: 0, nitroPointsPassed: 0, airSegmentsMs: [], flips: 0, wheelieMs: 0, crashes: 0, comboBonus: 0, finished: false, nitroLeftRatio: 0 };
  let nitroMs = NITRO_MAX_MS;
  let airStart = null, lastAngle = 0, accAngle = 0;
  let maxPoint = 0, elapsed = 0, ended = false;
  let combo = 1, crashFlashUntil = 0; // 連續特技倍率（翻車歸 1）、翻車閃示
  const cam = { x: 0, y: 0 };
  const ctx = canvas.getContext('2d');
  const endX = terrain.vertices.at(-1).x;

  // Precompute fall-out threshold once (O(n) at setup, not per step)
  let maxTerrainY = -Infinity;
  for (const v of terrain.vertices) { if (v.y > maxTerrainY) maxTerrainY = v.y; }
  const fallY = maxTerrainY + 800;

  // 目前位置的地形坡度（自動配重用）
  const slopeAt = (x) => {
    const i = Math.max(0, Math.min(Math.floor(x / SPACING), terrain.vertices.length - 2));
    return Math.atan2(terrain.vertices[i + 1].y - terrain.vertices[i].y, SPACING);
  };

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

  // 翻車不結束：記一次、COMBO 歸 1、退回兩根 K 棒前重生繼續騎（原版制）
  function respawnAfterCrash() {
    ev.crashes++;
    combo = 1;
    crashFlashUntil = elapsed + 700;
    if (airStart !== null) { ev.airSegmentsMs.push(elapsed - airStart); airStart = null; } // 摔掉的騰空不給空翻
    const idx = Math.max(maxPoint - 2, 0);
    const v = terrain.vertices[Math.min(idx, terrain.vertices.length - 1)];
    const rx = v.x + 30, ry = v.y - 80;
    Matter.Body.setPosition(bike.chassis, { x: rx, y: ry });
    Matter.Body.setAngle(bike.chassis, 0);
    Matter.Body.setVelocity(bike.chassis, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(bike.chassis, 0);
    Matter.Body.setPosition(bike.wheelB, { x: rx - 24, y: ry + 16 });
    Matter.Body.setPosition(bike.wheelF, { x: rx + 24, y: ry + 16 });
    for (const w of [bike.wheelB, bike.wheelF]) {
      Matter.Body.setVelocity(w, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(w, 0);
    }
    contacts.wheelB = 0; contacts.wheelF = 0;
    crashed = false;
  }

  function step(dt) {
    elapsed += dt;
    const s = input.state;
    const grounded = contacts.wheelB > 0 || contacts.wheelF > 0;
    const rearOnly = contacts.wheelB > 0 && contacts.wheelF === 0;

    if (s.gas) {
      Matter.Body.setAngularVelocity(bike.wheelB, Math.min(bike.wheelB.angularVelocity + GAS_ACCEL, GAS_MAX));
      // 貼地引擎輔助推力（沿車身方向）：讓 35° 連續坡爬得上去；只在貼地時生效，不開飛行漏洞
      if (grounded) {
        const a = bike.chassis.angle;
        Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(a) * GAS_ASSIST * bike.chassis.mass, y: Math.sin(a) * GAS_ASSIST * bike.chassis.mass });
      }
    }
    if (!grounded) {
      if (s.left) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity - 0.005);
      if (s.right) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity + 0.005);
    } else if (s.left) {
      bike.chassis.torque = -0.9; // 地面翹孤輪
    } else if (s.right) {
      bike.chassis.torque = 0.6;  // 壓車頭
    }
    // 騎士自動配重：貼地且玩家沒主動傾斜時，把車身往坡度扶正（爬陡坡不再後空翻卡死）
    // 坡度查「前輪前方」：在坡腳就預先迎坡，不會被按平卡在 50° 陡坡腳
    if (grounded && !s.left && !s.right) {
      const d = slopeAt(bike.wheelF.position.x + 20) - bike.chassis.angle;
      const diff = Math.atan2(Math.sin(d), Math.cos(d));
      bike.chassis.torque += Math.max(-0.8, Math.min(0.8, diff * 1.2));
      Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity * 0.92);
    }
    if (s.jump && grounded) {
      // 車身+兩輪等加速度一起跳：只推車身會把懸吊瞬間拉開（輪胎車身相對位置變形）
      for (const b of [bike.chassis, bike.wheelB, bike.wheelF]) {
        Matter.Body.applyForce(b, b.position, { x: 0, y: -0.14 * b.mass });
      }
      input.state.jump = false; // 單發
    }
    const nitroOn = s.nitro && nitroMs > 0;
    if (nitroOn) {
      nitroMs -= dt;
      const a = bike.chassis.angle;
      // 空中推力 30%（低於重力）：氮氣是地面加速器，不是飛行器——封掉「跳+噴飛越全場」
      const thrust = grounded ? 0.004 : 0.0012;
      Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(a) * thrust * bike.chassis.mass, y: Math.sin(a) * thrust * bike.chassis.mass });
    } else {
      nitroMs = Math.min(NITRO_MAX_MS, nitroMs + dt * 0.12); // 緩慢回充
    }
    // 全域速度上限：防氮氣連噴無限疊速
    const vel = bike.chassis.velocity;
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > MAX_SPEED) {
      const k = MAX_SPEED / speed;
      Matter.Body.setVelocity(bike.chassis, { x: vel.x * k, y: vel.y * k });
    }

    Matter.Engine.update(engine, dt);

    // 騰空 / 空翻
    if (!grounded && airStart === null) { airStart = elapsed; lastAngle = bike.chassis.angle; accAngle = 0; }
    if (!grounded && airStart !== null) { accAngle += bike.chassis.angle - lastAngle; lastAngle = bike.chassis.angle; }
    if (grounded && airStart !== null) {
      const segMs = elapsed - airStart;
      ev.airSegmentsMs.push(segMs);
      const flips = countFlips(accAngle);
      if (flips > 0) {
        ev.flips += flips;
        ev.comboBonus += flips * 1000 * (combo - 1); // 連續特技加成
        combo = Math.min(5, combo + flips);
      } else if (segMs >= 1500) {
        ev.comboBonus += 200 * (combo - 1);          // 大騰空也續 COMBO
        combo = Math.min(5, combo + 1);
      }
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

    if (crashed || bike.chassis.position.y > fallY) respawnAfterCrash(); // 翻車/掉出世界 → 重生
    if (bike.chassis.position.x >= endX) return end(true);
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
    drawBackdrop(ctx, cam, market);
    drawTerrain(ctx, terrain, cam, redUp);
    drawEventMarks(ctx, terrain, cam);
    drawBike(ctx, bike, cam);
    drawMinimap(minimap, terrain, bike.chassis.position.x, redUp);
    onTick({
      score: score({ ...ev, airSegmentsMs: airStart !== null ? [...ev.airSegmentsMs, elapsed - airStart] : ev.airSegmentsMs }),
      elapsed, nitroRatio: nitroMs / NITRO_MAX_MS, airborne: airStart !== null,
      progress: maxPoint, total: terrain.vertices.length - 1,
      combo, crashes: ev.crashes, crashFlash: elapsed < crashFlashUntil,
    });
    if (input.consumeReset()) { destroy(); onEnd({ reset: true }); return; }
    raf = requestAnimationFrame(frame);
  }

  function start() { last = performance.now(); raf = requestAnimationFrame(frame); }
  function destroy() { ended = true; cancelAnimationFrame(raf); Matter.Engine.clear(engine); }
  return { start, destroy };
}
