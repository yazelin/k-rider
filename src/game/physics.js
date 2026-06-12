// src/game/physics.js
import Matter from 'matter-js';

export function createEngine() {
  const engine = Matter.Engine.create();
  engine.gravity.y = 0.9; // 調輕：滯空夠長才轉得完特技（落太快沒時間轉）
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

// 整台車 = 單一剛體 compound（車架/頭/兩輪都是 parts）：
// 輪胎與車身的相對位置在幾何上不可能改變——「車身卡進輪胎」類 bug 從根本上消滅。
// 代價：輪子不自轉（視覺用 bike.spin 假轉）、推進改純力驅動、懸吊感取消。
export function createBike(x, y) {
  const frame = Matter.Bodies.rectangle(x, y, 56, 14, { label: 'frame' });
  const head = Matter.Bodies.circle(x - 8, y - 27, 8, { label: 'head' });
  // 輪摩擦調低：剛體圓不會滾動，低摩擦的滑行就是「滾動」的錯覺；下坡自然加速
  const wheelB = Matter.Bodies.circle(x - 24, y + 16, 13, { label: 'wheelB', friction: 0.05, frictionStatic: 0.05 });
  const wheelF = Matter.Bodies.circle(x + 24, y + 16, 13, { label: 'wheelF', friction: 0.05, frictionStatic: 0.05 });
  const chassis = Matter.Body.create({
    parts: [frame, head, wheelB, wheelF],
    label: 'chassis',
    density: 0.003,
    restitution: 0.05,
    friction: 0.05,
    frictionStatic: 0.05,
  });
  chassis.spinVisual = 0; // 視覺輪轉角（render 用）
  return { chassis, head, wheelB, wheelF, constraints: [] };
}

export function addBike(engine, bike) {
  Matter.World.add(engine.world, bike.chassis);
}
