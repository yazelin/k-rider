// src/game/physics.js
import Matter from 'matter-js';

export function createEngine() {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1.1;
  return engine;
}

export function terrainBodies(vertices) {
  const bodies = [];
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1], b = vertices[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    // 矩形中心沿「線段垂直法向」往下偏半個厚度，路面頂緣才會貼齊發光線
    // （法向 = (-sinθ, +cosθ)；之前誤用 (+sinθ, +cosθ)，坡愈陡路面愈浮在線上方）
    bodies.push(Matter.Bodies.rectangle(
      (a.x + b.x) / 2 - Math.sin(angle) * 5,
      (a.y + b.y) / 2 + Math.cos(angle) * 5,
      len + 2, 10,
      { isStatic: true, angle, friction: 0.95, label: 'ground' },
    ));
  }
  // 起點助跑平路（3 根間距）+ 終點緩衝平路：出生與衝線都有餘裕
  const leadLen = 180, first = vertices[0], last = vertices.at(-1);
  bodies.push(Matter.Bodies.rectangle(first.x - leadLen / 2, first.y + 5, leadLen + 2, 10, { isStatic: true, friction: 0.95, label: 'ground' }));
  bodies.push(Matter.Bodies.rectangle(last.x + leadLen / 2, last.y + 5, leadLen + 2, 10, { isStatic: true, friction: 0.95, label: 'ground' }));
  // 起點左側擋牆，避免倒退出界
  bodies.push(Matter.Bodies.rectangle(first.x - leadLen - 10, first.y - 100, 20, 400, { isStatic: true, label: 'wall' }));
  return bodies;
}

export function createBike(x, y) {
  const group = Matter.Body.nextGroup(true);
  const filter = { group };
  const frame = Matter.Bodies.rectangle(x, y, 56, 14, { collisionFilter: filter, density: 0.004, label: 'frame' });
  const head = Matter.Bodies.circle(x - 8, y - 27, 8, { collisionFilter: filter, density: 0.0006, label: 'head' });
  const chassis = Matter.Body.create({ parts: [frame, head], collisionFilter: filter, label: 'chassis' });
  const wheelB = Matter.Bodies.circle(x - 24, y + 16, 13, { collisionFilter: filter, friction: 1.6, density: 0.0025, label: 'wheelB' }); // 後輪抓地強化（爬坡）
  const wheelF = Matter.Bodies.circle(x + 24, y + 16, 13, { collisionFilter: filter, friction: 0.9, density: 0.0025, label: 'wheelF' });
  // 懸吊調硬：太軟時重落地車身會沉到底「卡在輪胎上」拖地
  const sus = (wheel, ox) => [
    Matter.Constraint.create({ bodyA: chassis, pointA: { x: ox, y: 8 }, bodyB: wheel, stiffness: 0.55, damping: 0.3, length: 12 }),
    Matter.Constraint.create({ bodyA: chassis, pointA: { x: ox + (ox < 0 ? 14 : -14), y: 0 }, bodyB: wheel, stiffness: 0.5, damping: 0.28, length: 22 }),
  ];
  return { chassis, head, wheelB, wheelF, constraints: [...sus(wheelB, -24), ...sus(wheelF, 24)] };
}

export function addBike(engine, bike) {
  Matter.World.add(engine.world, [bike.chassis, bike.wheelB, bike.wheelF, ...bike.constraints]);
}
