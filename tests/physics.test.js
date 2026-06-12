// tests/physics.test.js
import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { createEngine, terrainBodies, createBike, addBike } from '../src/game/physics.js';
import { buildTerrain, SPACING } from '../src/shared/terrain.js';
import { GAS_ACCEL, GAS_MAX, GAS_ASSIST } from '../src/game/run.js';

describe('bike physics', () => {
  it('機車落在平地上 3 秒內穩定不抖動、不穿地', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ t: i, close: 100 })); // 平地
    const terrain = buildTerrain(points);
    const engine = createEngine();
    Matter.World.add(engine.world, terrainBodies(terrain.vertices));
    const bike = createBike(terrain.vertices[0].x + 50, terrain.vertices[0].y - 80);
    addBike(engine, bike);
    for (let i = 0; i < 180; i++) Matter.Engine.update(engine, 1000 / 60); // 3s settle
    const y1 = bike.chassis.position.y;
    for (let i = 0; i < 60; i++) Matter.Engine.update(engine, 1000 / 60); // 再 1s
    const y2 = bike.chassis.position.y;
    expect(Math.abs(y2 - y1)).toBeLessThan(2);            // 不抖動
    expect(bike.chassis.position.y).toBeLessThan(terrain.vertices[0].y); // 在地面上方（y 向下為正）
    expect(Math.abs(bike.chassis.angle)).toBeLessThan(0.3); // 沒翻倒
  });
  it('下坡地形滑行不穿地', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ t: i, close: 200 - i * 2 }));
    const terrain = buildTerrain(points);
    const engine = createEngine();
    Matter.World.add(engine.world, terrainBodies(terrain.vertices));
    const bike = createBike(terrain.vertices[0].x + 50, terrain.vertices[0].y - 80);
    addBike(engine, bike);
    for (let i = 0; i < 600; i++) Matter.Engine.update(engine, 1000 / 60); // 10s
    const groundYAtBike = () => {
      const idx = Math.min(Math.max(Math.round(bike.chassis.position.x / SPACING), 0), terrain.vertices.length - 1);
      return terrain.vertices[idx].y;
    };
    expect(bike.chassis.position.y).toBeLessThan(groundYAtBike() + 50); // 沒有沉到地面下太深
  });
  it('油門爬得上典型 35° 連續上坡（爬坡力回歸測試）', () => {
    // 平地起步 + 持續陡升：terrain 演算法會把它做成 ~35° 坡
    const closes = [...Array(10).fill(100), ...Array.from({ length: 40 }, (_, i) => 100 + (i + 1) * 8)];
    const terrain = buildTerrain(closes.map((close, i) => ({ t: i, close })));
    const engine = createEngine();
    Matter.World.add(engine.world, terrainBodies(terrain.vertices));
    const bike = createBike(terrain.vertices[0].x + 50, terrain.vertices[0].y - 80);
    addBike(engine, bike);
    const slopeAt = (x) => {
      const i = Math.max(0, Math.min(Math.floor(x / SPACING), terrain.vertices.length - 2));
      return Math.atan2(terrain.vertices[i + 1].y - terrain.vertices[i].y, SPACING);
    };
    for (let i = 0; i < 900; i++) { // 15s 全程油門（同 run.js 狀態機：輪速 + 沿坡推力 + 姿態控制器）
      Matter.Body.setAngularVelocity(bike.wheelB, Math.min(bike.wheelB.angularVelocity + GAS_ACCEL, GAS_MAX));
      const slope = slopeAt(bike.chassis.position.x);
      Matter.Body.applyForce(bike.chassis, bike.chassis.position, { x: Math.cos(slope) * GAS_ASSIST * bike.chassis.mass, y: Math.sin(slope) * GAS_ASSIST * bike.chassis.mass });
      const d = slope - bike.chassis.angle;
      const diff = Math.atan2(Math.sin(d), Math.cos(d));
      bike.chassis.torque += Math.max(-1, Math.min(1, diff * 1.4));
      Matter.Body.setAngularVelocity(bike.chassis, bike.chassis.angularVelocity * 0.9);
      Matter.Engine.update(engine, 1000 / 60);
    }
    expect(bike.chassis.position.x).toBeGreaterThan(30 * SPACING); // 爬過坡段中後段
  });
});
