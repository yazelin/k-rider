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
    bodies.push(Matter.Bodies.rectangle(
      (a.x + b.x) / 2 + Math.sin(angle) * 5,
      (a.y + b.y) / 2 + Math.cos(angle) * 5,
      len + 2, 10,
      { isStatic: true, angle, friction: 0.95, label: 'ground' },
    ));
  }
  // 起點左側擋牆，避免倒退出界
  bodies.push(Matter.Bodies.rectangle(vertices[0].x - 60, vertices[0].y - 100, 20, 400, { isStatic: true, label: 'wall' }));
  return bodies;
}

export function createBike(x, y) {
  const group = Matter.Body.nextGroup(true);
  const filter = { group };
  const frame = Matter.Bodies.rectangle(x, y, 56, 14, { collisionFilter: filter, density: 0.004, label: 'frame' });
  const head = Matter.Bodies.circle(x - 8, y - 27, 8, { collisionFilter: filter, density: 0.0006, label: 'head' });
  const chassis = Matter.Body.create({ parts: [frame, head], collisionFilter: filter, label: 'chassis' });
  const wheelB = Matter.Bodies.circle(x - 24, y + 16, 13, { collisionFilter: filter, friction: 1.0, density: 0.0025, label: 'wheelB' });
  const wheelF = Matter.Bodies.circle(x + 24, y + 16, 13, { collisionFilter: filter, friction: 0.9, density: 0.0025, label: 'wheelF' });
  const sus = (wheel, ox) => [
    Matter.Constraint.create({ bodyA: chassis, pointA: { x: ox, y: 8 }, bodyB: wheel, stiffness: 0.32, damping: 0.22, length: 12 }),
    Matter.Constraint.create({ bodyA: chassis, pointA: { x: ox + (ox < 0 ? 14 : -14), y: 0 }, bodyB: wheel, stiffness: 0.28, damping: 0.2, length: 22 }),
  ];
  return { chassis, head, wheelB, wheelF, constraints: [...sus(wheelB, -24), ...sus(wheelF, 24)] };
}

export function addBike(engine, bike) {
  Matter.World.add(engine.world, [bike.chassis, bike.wheelB, bike.wheelF, ...bike.constraints]);
}
