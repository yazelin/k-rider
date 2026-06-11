// tests/physics.test.js
import { describe, it, expect } from 'vitest';
import Matter from 'matter-js';
import { createEngine, terrainBodies, createBike, addBike } from '../src/game/physics.js';
import { buildTerrain } from '../src/shared/terrain.js';

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
      const idx = Math.min(Math.max(Math.round(bike.chassis.position.x / 60), 0), terrain.vertices.length - 1);
      return terrain.vertices[idx].y;
    };
    expect(bike.chassis.position.y).toBeLessThan(groundYAtBike() + 50); // 沒有沉到地面下太深
  });
});
