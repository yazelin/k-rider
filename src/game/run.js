// src/game/run.js
import Matter from 'matter-js';
import { SPACING } from '../shared/terrain.js';
import { score } from '../shared/scoring.js';
import { createEngine, terrainBodies, createBike, addBike } from './physics.js';
import { drawTerrain, drawBike, drawMinimap, drawEventMarks, drawBackdrop, drawTrail } from './render.js';

export const countFlips = (rad) => Math.floor(Math.abs(rad) / (Math.PI * 2));
export const pointIndexAt = (x) => Math.max(0, Math.floor(x / SPACING));

const NITRO_MAX_MS = 4000;
export const GAS_FORCE = 0.0042; // 油門推力（純力驅動：35° 油門可上、50° 要氮氣）
const MAX_SPEED = 24;          // px/step 全域速度上限（配合 100px/點，全程時間約為舊版兩倍）

export function createRun({ canvas, minimap, terrain, redUp, input, market = 'us', audio = null, onTick, onEnd }) {
  const engine = createEngine();
  Matter.World.add(engine.world, terrainBodies(terrain.vertices));
  const spawn = { x: terrain.vertices[0].x - 140, y: terrain.vertices[0].y - 80 }; // 出生在助跑平路上
  const bike = createBike(spawn.x, spawn.y);
  addBike(engine, bike);

  // 碰撞事件只負責「撞頭/倒插」判摔；輪子接地改用幾何判定
  // （幾何夾制會 setPosition 輪子，碰撞事件的接地計數會卡死 → 無限空中跳的重力假象）
  let crashed = false;
  Matter.Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      for (const [me, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
        if (other.label !== 'ground') continue;
        if (me.label === 'head') crashed = true;
        if (me.label === 'frame') {
          const a = ((bike.chassis.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (a > 1.75 && a < Math.PI * 2 - 1.75) crashed = true; // 倒插觸地
        }
      }
    }
  });

  const ev = { pointsPassed: 0, nitroPointsPassed: 0, airSegmentsMs: [], flips: 0, wheelieMs: 0, crashes: 0, comboBonus: 0, trickBonus: 0, tricks: [], finished: false, nitroLeftRatio: 0 };
  let nitroMs = NITRO_MAX_MS;
  let airStart = null, lastAngle = 0, accAngle = 0, airStartY = 0, airSpun = false;
  let maxPoint = 0, elapsed = 0, ended = false;
  let combo = 1, crashFlashUntil = 0; // 連續特技倍率（翻車歸 1）、翻車閃示
  let invulnUntil = 0;                // 重生保護期：避免連環判摔
  let wheelieRunMs = 0, wheelieAwarded = false;  // 軋空行情（長孤輪）
  let stoppieRunMs = 0, stoppieAwarded = false;  // 急殺止跌（前輪平衡）
  let moonDone = false;                          // 登月：一場一次
  let lastTrick = null;                          // HUD 浮現用
  let lastMute = input.state.mute;               // M 鍵切換偵測

  // 特技入帳：分數已含 COMBO 倍率，並把 COMBO 往上推一階
  function awardTrick(key, basePts, useCombo = true) {
    const pts = useCombo ? basePts * combo : basePts;
    ev.trickBonus += pts;
    ev.tricks.push({ key, pts });
    if (useCombo) combo = Math.min(5, combo + 1);
    lastTrick = { key, pts, until: elapsed + 1400 };
    audio?.trick();
  }

  const cam = { x: 0, y: 0 };
  const trail = []; // 車尾光軌
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
  // 地形表面高度（線性內插；助跑/緩衝段回傳端點高度）
  const terrainYAt = (x) => {
    const i = Math.max(0, Math.min(Math.floor(x / SPACING), terrain.vertices.length - 2));
    const f = Math.max(0, Math.min((x - i * SPACING) / SPACING, 1));
    return terrain.vertices[i].y + (terrain.vertices[i + 1].y - terrain.vertices[i].y) * f;
  };
  // 幾何接地判定：輪心到坡面的「法向距離」≤ 半徑+容差
  // （垂直距離在陡坡會放大 1/cosθ：50° 坡貼地時垂直距離 20px 會誤判騰空 → 推力/姿態全失效卡死坡腳）
  const WHEEL_R = 13;
  const wheelGrounded = (w) => {
    const vDist = terrainYAt(w.position.x) - w.position.y;
    return vDist * Math.cos(slopeAt(w.position.x)) <= WHEEL_R + 3;
  };
  // 全賽道最高峰（登月基準：要飛得比整條賽道的山頂還高，下坡白嫖無效）
  let peakY = Infinity;
  for (const v of terrain.vertices) { if (v.y < peakY) peakY = v.y; }

  let raf = 0, acc = 0, last = performance.now();

  function end(finished) {
    if (ended) return;
    ended = true;
    ev.finished = finished;
    ev.nitroLeftRatio = nitroMs / NITRO_MAX_MS;
    if (airStart !== null) { ev.airSegmentsMs.push(elapsed - airStart); airStart = null; }
    cancelAnimationFrame(raf);
    audio?.engine(false, 0);
    audio?.nitro(false);
    if (finished) audio?.finish();
    onEnd({ ev, score: score(ev), elapsed, crashedAtIndex: finished ? null : maxPoint });
  }

  // 翻車不結束：記一次、COMBO 歸 1、退回兩根 K 棒前重生繼續騎（原版制）
  function respawnAfterCrash() {
    ev.crashes++;
    combo = 1;
    crashFlashUntil = elapsed + 700;
    invulnUntil = elapsed + 2000; // 重生 2 秒保護，避免落地連環摔
    wheelieRunMs = 0; stoppieRunMs = 0;
    trail.length = 0;
    audio?.crash();
    if (airStart !== null) { ev.airSegmentsMs.push(elapsed - airStart); airStart = null; } // 摔掉的騰空不給空翻
    // 重生點往回找最近的緩坡（≤~25°）：放在 50° 夾段中段會站不住一路倒滑「被拉回原點」
    let idx = Math.max(maxPoint - 2, 0);
    while (idx > 0 && Math.abs(slopeAt(idx * SPACING)) > 0.45) idx--;
    const v = terrain.vertices[Math.min(idx, terrain.vertices.length - 1)];
    // 單一剛體：整台車一次歸位（parts 跟著走，不存在個別輪子要對位的問題）
    Matter.Body.setPosition(bike.chassis, { x: v.x + 30, y: v.y - 60 });
    Matter.Body.setAngle(bike.chassis, 0);
    Matter.Body.setVelocity(bike.chassis, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(bike.chassis, 0);
    crashed = false;
  }

  function step(dt) {
    elapsed += dt;
    const s = input.state;
    const bGrounded = wheelGrounded(bike.wheelB);
    const fGrounded = wheelGrounded(bike.wheelF);
    const grounded = bGrounded || fGrounded;
    const rearOnly = bGrounded && !fGrounded;

    const nitroOn = s.nitro && nitroMs > 0;
    audio?.nitro(nitroOn);

    // ===== 車輛狀態機：GROUNDED / AIRBORNE 各自一套互斥的操作語意 =====
    // 視覺輪轉（剛體輪不自轉）：依水平速度推進輪輻角，油門時加打滑感
    bike.chassis.spinVisual += bike.chassis.velocity.x / 13 + (s.gas ? 0.12 : 0);
    if (grounded) {
      // --- GROUNDED：所有推力沿「坡面方向」（不是車身角度——前傾時才不會把自己往地裡推）---
      const slope = slopeAt(bike.wheelF.position.x + 20);
      // 姿態控制器（角速度導引式——剛體 compound 慣量大，扭矩式壓不住滾過 K 棒折點的旋轉）：
      // 目標姿態 = 坡度 + 玩家傾斜偏移（左=後仰 0.55、右=前傾 0.3，有界不會栽頭）
      const target = slope + (s.left ? -0.55 : s.right ? 0.3 : 0);
      const d0 = target - bike.chassis.angle;
      const attDiff = Math.atan2(Math.sin(d0), Math.cos(d0));
      const desiredAV = Math.max(-0.25, Math.min(0.25, attDiff * 0.18));
      Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity * 0.55 + desiredAV);

      if (s.gas) {
        // 純力驅動（剛體輪無摩擦傳動）：GAS_FORCE 沿坡推進，隨速度遞減
        const falloff = Math.max(0, 1 - Math.hypot(bike.chassis.velocity.x, bike.chassis.velocity.y) / MAX_SPEED);
        const f = GAS_FORCE * falloff;
        Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(slope) * f * bike.chassis.mass, y: Math.sin(slope) * f * bike.chassis.mass });
      } else if (Math.abs(bike.chassis.velocity.x) < 2 && Math.abs(slope) < 0.5) {
        // 駐車：緩坡低速不滑走（低摩擦輪的代償）
        Matter.Body.setVelocity(bike.chassis, { x: bike.chassis.velocity.x * 0.8, y: bike.chassis.velocity.y });
      }
      if (nitroOn) {
        nitroMs -= dt;
        Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(slope) * 0.004 * bike.chassis.mass, y: Math.sin(slope) * 0.004 * bike.chassis.mass });
      }
      if (s.jump) {
        input.state.jump = false; // 單發
        // 姿態接近坡面才允許跳（深翹孤輪/壓頭中亂跳是怪姿勢彈飛的來源）
        const rel = Math.atan2(Math.sin(bike.chassis.angle - slope), Math.cos(bike.chassis.angle - slope));
        if (Math.abs(rel) < 0.7) {
          Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: 0, y: -0.05 * bike.chassis.mass });
          audio?.jump();
        }
      }
    } else {
      // --- AIRBORNE：只有旋轉與微量氮氣；跳躍鍵作廢不留 buffer ---
      if (s.jump) input.state.jump = false;
      if (s.left) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity - 0.022);
      else if (s.right) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity + 0.022);
      // 被動騰空（這段空中沒按過方向鍵）強阻尼：彈跳噪音立即消旋；主動特技（airSpun）保留慣性
      else if (!airSpun) Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity * 0.9);
      if (nitroOn) {
        nitroMs -= dt;
        const a = bike.chassis.angle;
        // 空中推力須遠低於重力：氮氣是地面加速器，不是飛行器
        Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(a) * 0.0007 * bike.chassis.mass, y: Math.sin(a) * 0.0007 * bike.chassis.mass });
      }
    }
    if (!nitroOn) nitroMs = Math.min(NITRO_MAX_MS, nitroMs + dt * 0.12); // 緩慢回充
    // 全域速度上限：防氮氣連噴無限疊速
    const vel = bike.chassis.velocity;
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > MAX_SPEED) {
      const k = MAX_SPEED / speed;
      Matter.Body.setVelocity(bike.chassis, { x: vel.x * k, y: vel.y * k });
    }
    audio?.engine(s.gas, Math.min(1, speed / MAX_SPEED));
    if (s.mute !== lastMute) { lastMute = s.mute; audio?.setMuted(s.mute); dispatchEvent(new Event('kr-mute')); }

    Matter.Engine.update(engine, dt);

    // （單一剛體後，輪胎/車身相對位置在幾何上固定——舊的兩段幾何防呆已無存在必要，全部移除）

    // 騰空 / 空翻
    if (!grounded && airStart === null) { airStart = elapsed; airStartY = bike.chassis.position.y; lastAngle = bike.chassis.angle; accAngle = 0; airSpun = false; }
    if (!grounded && airStart !== null) {
      accAngle += bike.chassis.angle - lastAngle;
      lastAngle = bike.chassis.angle;
      if (s.left || s.right) airSpun = true; // 空翻只給主動旋轉（自然彈飛滾轉不送分）
    }
    if (grounded && airStart !== null) {
      const segMs = elapsed - airStart;
      ev.airSegmentsMs.push(segMs);
      audio?.land(Math.min(1, segMs / 2000));
      const flips = airSpun ? countFlips(accAngle) : 0;
      if (flips > 0) {
        ev.flips += flips;
        ev.comboBonus += flips * 1000 * (combo - 1); // 空翻連段加成
        combo = Math.min(5, combo + flips);
        lastTrick = { key: 'flip', pts: flips * 1000, until: elapsed + 1400 };
      } else if (segMs >= 3500 && Math.abs(accAngle) < Math.PI / 2) {
        awardTrick('deadSailor', 400);               // 躺平：長滯空幾乎不旋轉
      } else if (segMs >= 2000) {
        awardTrick('gap', 250);                      // 跳空缺口：大騰空
      }
      airStart = null;
    }
    // 軋空行情：連續孤輪 2.5 秒（每段孤輪只發一次）
    if (rearOnly) {
      ev.wheelieMs += dt;
      wheelieRunMs += dt;
      if (!wheelieAwarded && wheelieRunMs >= 2500) { awardTrick('wheelie', 300); wheelieAwarded = true; }
    } else { wheelieRunMs = 0; wheelieAwarded = false; }
    // 急殺止跌：前輪平衡 1.5 秒
    const frontOnly = fGrounded && !bGrounded;
    if (frontOnly) {
      stoppieRunMs += dt;
      if (!stoppieAwarded && stoppieRunMs >= 1500) { awardTrick('stoppie', 400); stoppieAwarded = true; }
    } else { stoppieRunMs = 0; stoppieAwarded = false; }
    // 登月（一場一次，不吃 COMBO）：本次騰空「實際爬升」350px+（單跳 275 構不到，
    // 墜崖是負爬升永不觸發）且飛到全賽道最高峰之上——只有乘坡道大飛躍拿得到
    if (!moonDone && airStart !== null
      && airStartY - bike.chassis.position.y > 480
      && bike.chassis.position.y < peakY - 80) {
      moonDone = true;
      awardTrick('moon', 1000, false);
    }

    // 過點
    const idx = Math.min(pointIndexAt(bike.chassis.position.x), terrain.vertices.length - 1);
    while (maxPoint < idx) {
      maxPoint++;
      ev.pointsPassed++;
      if (nitroOn) ev.nitroPointsPassed++;
    }

    // 翻車/掉出世界 → 重生；保護期內的碰撞判定不算（落地連環摔）
    if (crashed && elapsed < invulnUntil && bike.chassis.position.y <= fallY) crashed = false;
    if (crashed || bike.chassis.position.y > fallY) respawnAfterCrash();
    if (bike.chassis.position.x >= endX) return end(true);
  }

  function frame(now) {
    acc += now - last;
    last = now;
    acc = Math.min(acc, 200);
    while (acc >= 1000 / 60 && !ended) { step(1000 / 60); acc -= 1000 / 60; }
    if (ended) return;
    // 視口以 CSS px（innerWidth/innerHeight）為準：canvas.width/height 已被 DPR 放大成 backing store 像素，
    // 不能拿來當鏡頭視口，否則攝影機中心會被 dpr 倍率推偏、背景跟著飛出畫面
    // 直向螢幕較窄、前方賽道露得少 → 車身置中比例往左挪(0.35→0.25),多看到一點前方;橫向維持 0.35
    const aheadRatio = innerWidth < innerHeight ? 0.25 : 0.35;
    cam.x += (bike.chassis.position.x - innerWidth * aheadRatio - cam.x) * 0.12;
    cam.y += (bike.chassis.position.y - innerHeight * 0.55 - cam.y) * 0.08;
    trail.push({ x: bike.chassis.position.x, y: bike.chassis.position.y });
    if (trail.length > 16) trail.shift();
    // setTransform(dpr,...) 後座標空間是 CSS px，clear 整個 innerWidth×innerHeight 即覆蓋全 canvas
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drawBackdrop(ctx, cam, market, now / 1000);
    drawTerrain(ctx, terrain, cam, redUp);
    drawEventMarks(ctx, terrain, cam);
    drawTrail(ctx, trail, cam);
    drawBike(ctx, bike, cam);
    drawMinimap(minimap, terrain, bike.chassis.position.x, redUp);
    onTick({
      score: score({ ...ev, airSegmentsMs: airStart !== null ? [...ev.airSegmentsMs, elapsed - airStart] : ev.airSegmentsMs }),
      elapsed, nitroRatio: nitroMs / NITRO_MAX_MS, airborne: airStart !== null,
      progress: maxPoint, total: terrain.vertices.length - 1,
      combo, crashes: ev.crashes, crashFlash: elapsed < crashFlashUntil,
      trick: lastTrick && elapsed < lastTrick.until ? lastTrick : null,
    });
    if (input.consumeReset()) { destroy(); onEnd({ reset: true }); return; }
    raf = requestAnimationFrame(frame);
  }

  if (import.meta.env?.DEV) window.__bike = bike; // dev 偵錯用
  function start() { last = performance.now(); raf = requestAnimationFrame(frame); }
  function destroy() { ended = true; cancelAnimationFrame(raf); Matter.Engine.clear(engine); }
  return { start, destroy };
}
