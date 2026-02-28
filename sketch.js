// p5.js — 12x12x12 3D Slice Snake + wireframe minimap
// Updates:
// - NEW: SnakeLines (3 axis lines through SNAKE HEAD), toggle (K)
// - Defaults set to FALSE: helper, compass, food planes, snake planes
// - Wireframe panel: removed header text (“Wireframe cube ...”) and bottom HUD text
// - Right HUD panel: smaller + moved a bit DOWN so it never overlaps the wireframe panel

const N = 20;

// ---- Speed tuning ----
let tickMs = 360;
const tickMin = 80;
const tickMax = 1200;
let speedStep = 1;

const VIEW = [
  { id: "+Z (XY)", axis: "Z", sign: +1 },
  { id: "-Z (XY)", axis: "Z", sign: -1 },
  { id: "+X (YZ)", axis: "X", sign: +1 },
  { id: "-X (YZ)", axis: "X", sign: -1 },
  { id: "+Y (XZ)", axis: "Y", sign: +1 },
  { id: "-Y (XZ)", axis: "Y", sign: -1 },
];

let viewIdx = 0;
let planeAxes = { a: "X", b: "Y" };

// Snake
let snake = [];
let dirWorld = { axis: "X", step: +1 };
let nextDirWorld = { axis: "X", step: +1 };
let food = { x: 0, y: 0, z: 0 };
let score = 0;
let alive = true;
let paused = false;

let lastTick = 0;
let pendingGrow = 0;

// UI toggles (defaults per request)
let showHelper = false;        // H
let showCompass = false;       // C
let showFoodPlanes = false;    // F
let showSnakePlanes = false;   // S
let showFoodLines = true;      // L
let showSnakeLines = true;     // K  (new)

let gameState = "menu"; // "menu" | "play" | "gameover"
let startBtn = { x: 0, y: 0, w: 0, h: 0 };

function setup() {
  createCanvas(1100, 720);
  textFont("monospace");
  resetToMenu();
}

function resetToMenu() {
  restartSnakeCore();
  gameState = "menu";
  paused = false;
}

function restartSnakeCore() {
  const c = floor(N / 2);

  snake = [
    { x: c, y: c, z: c },
    { x: c - 1, y: c, z: c },
    { x: c - 2, y: c, z: c },
  ];

  planeAxes = { a: "X", b: "Y" };
  dirWorld = { axis: "X", step: +1 };
  nextDirWorld = { axis: "X", step: +1 };

  score = 0;
  alive = true;
  paused = false;

  viewIdx = findViewIndex("Z", +1);

  tickMs = 360;
  lastTick = millis();
  pendingGrow = 0;

  placeFoodAnywhere();
}

function startGame() {
  restartSnakeCore();
  gameState = "play";
}

function gameOver() {
  gameState = "gameover";
}

function draw() {
  background(24);

  const pad = 30;
  const rightW = 330;
  const topMiniH = 260;
  const gap = 14;

  const gridArea = {
    x: pad,
    y: pad,
    w: width - pad * 2 - rightW - gap,
    h: height - pad * 2,
  };

  const miniArea = {
    x: width - pad - rightW,
    y: pad,
    w: rightW,
    h: topMiniH,
  };

  // HUD: smaller + moved down a bit
  const hudY = miniArea.y + miniArea.h + 60;
  const hudArea = {
    x: miniArea.x,
    y: hudY,
    w: miniArea.w,
    h: min(360, height - pad - hudY), // smaller height
  };

  if (gameState === "play") stepSnake();

  drawSlice2D(gridArea);
  drawWireframe(miniArea);
  drawHUDRight(hudArea);

  if (gameState === "menu") drawStartOverlay();
  if (gameState === "gameover") drawGameOverOverlay();
}

// ---------------- SNAKE LOGIC ----------------

function stepSnake() {
  if (!alive || paused) return;

  const now = millis();
  if (now - lastTick < tickMs) return;
  lastTick = now;

  if (!isReverse(dirWorld, nextDirWorld)) dirWorld = { ...nextDirWorld };
  if (!axisInPlane(dirWorld.axis)) dirWorld.axis = planeAxes.a;

  const head = snake[0];
  const next = { x: head.x, y: head.y, z: head.z };
  next[axisLower(dirWorld.axis)] += dirWorld.step;

  if (next.x < 0 || next.x >= N || next.y < 0 || next.y >= N || next.z < 0 || next.z >= N) {
    alive = false; gameOver(); return;
  }
  if (snake.some(s => s.x === next.x && s.y === next.y && s.z === next.z)) {
    alive = false; gameOver(); return;
  }

  snake.unshift(next);

  if (next.x === food.x && next.y === food.y && next.z === food.z) {
    score += 1;
    pendingGrow += 1;

    tickMs = max(tickMin, tickMs - speedStep);

    placeFoodAnywhere();
  }

  if (pendingGrow > 0) pendingGrow -= 1;
  else snake.pop();

  syncViewNormalToPlane();
}

function isReverse(a, b) {
  return a.axis === b.axis && a.step === -b.step;
}

function axisInPlane(axis) {
  return axis === planeAxes.a || axis === planeAxes.b;
}

function placeFoodAnywhere() {
  const empties = [];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const occ = snake.some(s => s.x === x && s.y === y && s.z === z);
    if (!occ) empties.push({ x, y, z });
  }
  if (empties.length === 0) { alive = false; gameOver(); return; }
  food = random(empties);
}

// ---------------- VIEW / PLANE ----------------

function planeNormalAxis() {
  return thirdAxis(planeAxes.a, planeAxes.b);
}

function syncViewNormalToPlane() {
  const n = planeNormalAxis();
  const curSign = VIEW[viewIdx].sign;
  viewIdx = findViewIndex(n, curSign);
}

function getPlaneInfo() {
  const head = snake[0];
  const nAxis = planeNormalAxis();
  const k = head[axisLower(nAxis)];

  const uAxis = planeAxes.a;
  const vAxis = planeAxes.b;

  const v = VIEW[viewIdx];
  const uSign = +1;
  const vSign = (v.sign === +1) ? +1 : -1;

  return { nAxis, k, uAxis, vAxis, uSign, vSign };
}

function findViewIndex(axis, preferSign) {
  let idx = VIEW.findIndex(v => v.axis === axis && v.sign === preferSign);
  if (idx >= 0) return idx;
  idx = VIEW.findIndex(v => v.axis === axis);
  return max(0, idx);
}

function thirdAxis(a, b) {
  const all = ["X", "Y", "Z"];
  for (const t of all) if (t !== a && t !== b) return t;
  return "Z";
}

// ---------------- DRAWING (2D SLICE) ----------------

function drawSlice2D(area) {
  const p = getPlaneInfo();
  const margin = 16;

  const cell = floor(min((area.w - margin * 2) / N, (area.h - margin * 2) / N));
  const gridW = cell * N;
  const gridH = cell * N;

  const gx = area.x + margin;
  const gy = area.y + margin;

  noStroke();
  fill(10, 130);
  rect(area.x, area.y, area.w, area.h, 14);

  // fill(18);
  fill(18);
  rect(gx - 6, gy - 6, gridW + 12, gridH + 12, 10);

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = gx + i * cell;
      const y = gy + j * cell;
      const c = (i + j) % 2 === 0 ? 34 : 28;
      fill(c);
      rect(x, y, cell - 1, cell - 1);
    }
  }

  const head = snake[0];
  const onSlice = (food[axisLower(p.nAxis)] === p.k);

  if (onSlice) {
    const uvf = cubeToScreen(food.x, food.y, food.z, p);
    const fx = gx + uvf.i * cell + cell / 2;
    const fy = gy + uvf.j * cell + cell / 2;
    stroke(0);
    strokeWeight(3);
    fill(120, 255, 140);
    circle(fx, fy, cell * 0.45);
  } else {
    if (showHelper) drawOffSliceHelper(gx, gy, cell, p, head, food);
    if (showCompass) drawCompass(gx, gy, cell, p, head, food);
  }

  for (let si = snake.length - 1; si >= 0; si--) {
    const s = snake[si];
    if (s[axisLower(p.nAxis)] !== p.k) continue;

    const uv = cubeToScreen(s.x, s.y, s.z, p);
    const cx = gx + uv.i * cell + cell / 2;
    const cy = gy + uv.j * cell + cell / 2;

    const isHead = (si === 0);
    stroke(0);
    strokeWeight(3);

    if (isHead) fill(255, 210, 70);
    else fill(255, 170, 70);

    circle(cx, cy, isHead ? cell * 0.58 : cell * 0.48);

    if (isHead) {
      const face = worldDirToScreenDelta(dirWorld, p);
      stroke(255, 210, 70);
      strokeWeight(4);
      line(cx, cy, cx + face.du * (cell * 0.25), cy + face.dv * (cell * 0.25));
    }
  }

  noStroke();
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(
    `Speed:${tickMs} (eat:-${speedStep})  W turn  +/- speed\n` +
      `H helper:${showHelper?"ON":"OFF"}  C compass:${showCompass?"ON":"OFF"}  F foodPlanes:${showFoodPlanes?"ON":"OFF"}  L foodLines:${showFoodLines?"ON":"OFF"}  S snakePlanes:${showSnakePlanes?"ON":"OFF"}  K snakeLines:${showSnakeLines?"ON":"OFF"}`,
    gx,
    gy + gridH + 18
  );
  textAlign(LEFT, BASELINE);
}

function drawOffSliceHelper(gx, gy, cell, p, head, food) {
  const hu = head[axisLower(p.uAxis)];
  const hv = head[axisLower(p.vAxis)];
  const fu = food[axisLower(p.uAxis)];
  const fv = food[axisLower(p.vAxis)];

  const du = fu - hu;
  const dv = fv - hv;
  const dn = food[axisLower(p.nAxis)] - head[axisLower(p.nAxis)];

  const uvh = cubeToScreen(head.x, head.y, head.z, p);
  const hx = gx + uvh.i * cell + cell / 2;
  const hy = gy + uvh.j * cell + cell / 2;

  const sdx = du * p.uSign;
  const sdy = dv * p.vSign;

  if (sdx === 0 && sdy === 0) {
    stroke(120, 255, 140);
    strokeWeight(3);
    noFill();
    circle(hx, hy, cell * 0.9);

    noStroke();
    fill(0, 160);
    rect(hx - 56, hy + cell * 0.55, 112, 26, 8);
    fill(235);
    textSize(14);
    textAlign(CENTER, CENTER);
    text(`Δ${p.nAxis}=${dn}`, hx, hy + cell * 0.68);
    textAlign(LEFT, BASELINE);
    return;
  }

  const maxSteps = max(abs(sdx), abs(sdy));
  const maxLen = cell * 2.0;
  const baseLen = cell * 0.5;
  const len = min(maxLen, baseLen * maxSteps);

  const mag = sqrt(sdx * sdx + sdy * sdy);
  const ux = sdx / mag, uy = sdy / mag;

  const tx = hx + ux * len;
  const ty = hy + uy * len;

  stroke(120, 255, 140);
  strokeWeight(3);
  drawDashedLine(hx, hy, tx, ty, 10, 7);

  const ah = cell * 0.22;
  const aw = cell * 0.14;
  const px = -uy, py = ux;

  noStroke();
  fill(120, 255, 140);
  triangle(
    tx, ty,
    tx - ux * ah + px * aw, ty - uy * ah + py * aw,
    tx - ux * ah - px * aw, ty - uy * ah - py * aw
  );
}

function drawCompass(gx, gy, cell, p, head, food) {
  const dn = food[axisLower(p.nAxis)] - head[axisLower(p.nAxis)];
  if (dn === 0) return;

  const gridW = N * cell;
  const x0 = gx + gridW + 12;
  const y0 = gy + 10;

  fill(0, 160);
  noStroke();
  rect(x0, y0, 120, 54, 10);

  fill(235);
  textSize(12);
  textAlign(LEFT, TOP);
  text(`Compass`, x0 + 10, y0 + 8);

  const midx = x0 + 95;
  const midy = y0 + 30;
  const dir = dn > 0 ? -1 : +1;
  const L = 16;

  stroke(235);
  strokeWeight(3);
  line(midx, midy, midx, midy + dir * L);

  noStroke();
  fill(235);
  const ah = 6;
  triangle(
    midx, midy + dir * L,
    midx - ah, midy + dir * L + dir * ah,
    midx + ah, midy + dir * L + dir * ah
  );

  fill(235);
  noStroke();
  textSize(12);
  textAlign(LEFT, TOP);
  text(`Δ${p.nAxis}=${dn}`, x0 + 10, y0 + 26);
  textAlign(LEFT, BASELINE);
}

function drawDashedLine(x1, y1, x2, y2, dashLen, gapLen) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = sqrt(dx * dx + dy * dy);
  if (dist <= 0.0001) return;
  const ux = dx / dist, uy = dy / dist;

  let t = 0;
  while (t < dist) {
    const t2 = min(dist, t + dashLen);
    line(x1 + ux * t, y1 + uy * t, x1 + ux * t2, y1 + uy * t2);
    t += dashLen + gapLen;
  }
}

// ---------------- DRAWING (WIREFRAME) ----------------

function drawWireframe(area) {
  noStroke();
  fill(10, 130);
  rect(area.x, area.y, area.w, area.h + 50, 14);

  const cx = area.x + area.w * 0.52;
  const cy = area.y + area.h * 0.60;
  const s = min(area.w, area.h) * 0.80;

  const rotX = -0.75;
  const rotY = 0.85;

  function proj(px, py, pz) {
    let x = px - 0.5, y = py - 0.5, z = pz - 0.5;
    {
      const c = cos(rotX), si = sin(rotX);
      const y2 = y * c - z * si;
      const z2 = y * si + z * c;
      y = y2; z = z2;
    }
    {
      const c = cos(rotY), si = sin(rotY);
      const x2 = x * c + z * si;
      const z2 = -x * si + z * c;
      x = x2; z = z2;
    }
    return { x: cx + x * s, y: cy + y * s, z };
  }

  // outer cube edges
  function idx(xx, yy, zz) { return ((zz * 2 + yy) * 2 + xx); }
  const V = [];
  for (let zz of [0, 1]) for (let yy of [0, 1]) for (let xx of [0, 1]) V.push(proj(xx, yy, zz));

  const edges = [
    [idx(0,0,0), idx(1,0,0)], [idx(0,1,0), idx(1,1,0)],
    [idx(0,0,1), idx(1,0,1)], [idx(0,1,1), idx(1,1,1)],
    [idx(0,0,0), idx(0,1,0)], [idx(1,0,0), idx(1,1,0)],
    [idx(0,0,1), idx(0,1,1)], [idx(1,0,1), idx(1,1,1)],
    [idx(0,0,0), idx(0,0,1)], [idx(1,0,0), idx(1,0,1)],
    [idx(0,1,0), idx(0,1,1)], [idx(1,1,0), idx(1,1,1)],
  ];

  stroke(210);
  strokeWeight(2);
  for (const [a, b] of edges) line(V[a].x, V[a].y, V[b].x, V[b].y);

  // FOOD planes + lines
  if (showFoodPlanes) {
    stroke(120, 255, 140, 70);
    strokeWeight(2);
    drawGuidePlanesForPoint(proj, food);
  }
  if (showFoodLines) {
    stroke(120, 255, 140, 110);
    strokeWeight(2);
    drawAxisLinesThroughPoint(proj, food);
  }

  // SNAKE(head) planes + lines
  const head = snake[0];
  if (showSnakePlanes) {
    stroke(255, 190, 90, 70);
    strokeWeight(2);
    drawGuidePlanesForPoint(proj, head);
  }
  if (showSnakeLines) {
    stroke(255, 190, 90, 110);
    strokeWeight(2);
    drawAxisLinesThroughPoint(proj, head);
  }

  // active slice quad (current movement plane slice at head)
  const p = getPlaneInfo();
  const tSlice = (p.k + 0.5) / N;
  const quad = sliceQuadUnit(p.nAxis, tSlice).map(q => proj(q.x, q.y, q.z));

  noStroke();
  fill(80, 180, 255, 70);
  beginShape();
  for (const q of quad) vertex(q.x, q.y);
  endShape(CLOSE);

  // snake polyline + dots
  stroke(255, 170, 70, 200);
  strokeWeight(3);
  noFill();
  beginShape();
  for (let i = snake.length - 1; i >= 0; i--) {
    const s3 = snake[i];
    const p3 = proj((s3.x + 0.5) / N, (s3.y + 0.5) / N, (s3.z + 0.5) / N);
    vertex(p3.x, p3.y);
  }
  endShape();

  for (let i = snake.length - 1; i >= 0; i--) {
    const s3 = snake[i];
    const p3 = proj((s3.x + 0.5) / N, (s3.y + 0.5) / N, (s3.z + 0.5) / N);
    stroke(0);
    strokeWeight(3);
    fill(i === 0 ? 255 : 255, i === 0 ? 210 : 170, 70);
    circle(p3.x, p3.y, i === 0 ? 14 : 10);
  }

  // food dot
  {
    const fp = proj((food.x + 0.5) / N, (food.y + 0.5) / N, (food.z + 0.5) / N);
    stroke(0);
    strokeWeight(3);
    fill(120, 255, 140);
    circle(fp.x, fp.y, 12);
  }
}

function drawGuidePlanesForPoint(proj, pt) {
  const tx = (pt.x + 0.5) / N;
  const ty = (pt.y + 0.5) / N;
  const tz = (pt.z + 0.5) / N;

  drawRectOnPlane(proj, "X", tx);
  drawRectOnPlane(proj, "Y", ty);
  drawRectOnPlane(proj, "Z", tz);
}

function drawRectOnPlane(proj, axis, t) {
  let pts;
  if (axis === "X") pts = [{x:t,y:0,z:0},{x:t,y:1,z:0},{x:t,y:1,z:1},{x:t,y:0,z:1}];
  else if (axis === "Y") pts = [{x:0,y:t,z:0},{x:1,y:t,z:0},{x:1,y:t,z:1},{x:0,y:t,z:1}];
  else pts = [{x:0,y:0,z:t},{x:1,y:0,z:t},{x:1,y:1,z:t},{x:0,y:1,z:t}];

  const P = pts.map(p => proj(p.x, p.y, p.z));
  for (let i = 0; i < 4; i++) {
    const a = P[i];
    const b = P[(i + 1) % 4];
    line(a.x, a.y, b.x, b.y);
  }
}

function drawAxisLinesThroughPoint(proj, pt) {
  const tx = (pt.x + 0.5) / N;
  const ty = (pt.y + 0.5) / N;
  const tz = (pt.z + 0.5) / N;

  // X line
  let a = proj(0, ty, tz), b = proj(1, ty, tz);
  line(a.x, a.y, b.x, b.y);

  // Y line
  a = proj(tx, 0, tz); b = proj(tx, 1, tz);
  line(a.x, a.y, b.x, b.y);

  // Z line
  a = proj(tx, ty, 0); b = proj(tx, ty, 1);
  line(a.x, a.y, b.x, b.y);
}

// ---------------- HUD (RIGHT) ----------------

function drawHUDRight(area) {
  noStroke();
  fill(0, 150);
  rect(area.x, area.y, area.w, area.h, 14);

  const v = VIEW[viewIdx];
  const p = getPlaneInfo();
  const head = snake[0];

  const status =
    gameState === "menu" ? "MENU" :
    gameState === "gameover" ? "GAME OVER" :
    (!alive ? "GAME OVER" : paused ? "PAUSED" : "RUNNING");

  const lines = [
    `Status: ${status}`,
    `Score: ${score}`,
    `Speed: ${tickMs}ms  (eat:-${speedStep})`,
    ``,
    `Plane: ${p.uAxis}${p.vAxis}  normal:${p.nAxis}`,
    `Slice: ${p.nAxis}=${p.k}  View:${v.id}`,
    ``,
    `Head: (${head.x},${head.y},${head.z})`,
    `Dir: ${dirWorld.axis}${dirWorld.step > 0 ? "+" : "-"}`,
    `Food: (${food.x},${food.y},${food.z})`,
    ``,
    `H helper:${onoff(showHelper)}  C compass:${onoff(showCompass)}`,
    `F foodPlanes:${onoff(showFoodPlanes)}  L foodLines:${onoff(showFoodLines)}`,
    `S snakePlanes:${onoff(showSnakePlanes)} K snakeLines:${onoff(showSnakeLines)}`,
  ];

  fill(235);
  textSize(13);
  textAlign(LEFT, TOP);

  const x = area.x + 14;
  let y = area.y + 14;
  for (const line of lines) {
    text(line, x, y);
    y += 15;
  }

  fill(235, 180);
  textSize(12);
  textAlign(LEFT, BOTTOM);
  text(`Keys: arrows steer, W turn, Q/E view`, area.x + 14, area.y + area.h - 10);
  text(`SPACE pause, ENTER start/restart`, area.x + 14, area.y + area.h - 24);
  
  textAlign(LEFT, BASELINE);
}

function onoff(v){ return v ? "ON" : "OFF"; }

// ---------------- OVERLAYS ----------------

function drawStartOverlay() {
  drawOverlayPanel(
    "3D Slice Snake — 20×20×20",
    [
      "Arrows = steer on current plane",
      "W = rotate movement plane (go 3D)",
      "",
      "Toggles:",
      "  H helper (default OFF)",
      "  C compass (default OFF)",
      "  F food planes (default OFF)",
      "  L food lines (default ON)",
      "  S snake planes (default OFF)",
      "  K snake lines (default ON)",
      "",
      "+/- speed, SPACE pause",
    ],
    "ENTER to Start"
  );
}

function drawGameOverOverlay() {
  drawOverlayPanel(
    "Game Over",
    [`Score: ${score}`, "", "ENTER to restart"],
    "ENTER to Restart"
  );
}

function drawOverlayPanel(title, lines, actionText) {
  noStroke();
  fill(0, 150);
  rect(0, 0, width, height);

  const w = 560;
  const h = 360;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;

  fill(20, 210);
  rect(x, y, w, h, 16);

  fill(255);
  textAlign(CENTER, TOP);
  textSize(26);
  text(title, width / 2, y + 22);

  textSize(14);
  textAlign(LEFT, TOP);
  let ty = y + 70;
  const lx = x + 28;
  for (const line of lines) {
    text(line, lx, ty);
    ty += 18;
  }

  const bw = 220, bh = 44;
  const bx = width / 2 - bw / 2;
  const by = y + h - 78;

  startBtn = { x: bx, y: by, w: bw, h: bh };

  const hover = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;
  fill(hover ? 40 : 30);
  rect(bx, by, bw, bh, 12);

  fill(255, 210, 70);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(actionText, bx + bw / 2, by + bh / 2);

  textAlign(LEFT, BASELINE);
}

// ---------------- INPUT ----------------

function keyPressed() {
  // toggles anywhere
  if (key === "h" || key === "H") showHelper = !showHelper;
  if (key === "c" || key === "C") showCompass = !showCompass;
  if (key === "f" || key === "F") showFoodPlanes = !showFoodPlanes;
  if (key === "l" || key === "L") showFoodLines = !showFoodLines;
  if (key === "s" || key === "S") showSnakePlanes = !showSnakePlanes;
  if (key === "k" || key === "K") showSnakeLines = !showSnakeLines;

  // speed anywhere
  if (key === "+" || key === "=") tickMs = max(tickMin, tickMs - 20);
  if (key === "-" || key === "_") tickMs = min(tickMax, tickMs + 20);

  // start/restart
  if (keyCode === ENTER || keyCode === RETURN) {
    if (gameState === "menu" || gameState === "gameover") startGame();
    return;
  }

  // pause only in play
  if (key === " " && gameState === "play") paused = !paused;

  // view flip
  if (key === "q" || key === "Q") viewIdx = (viewIdx - 1 + VIEW.length) % VIEW.length;
  if (key === "e" || key === "E") viewIdx = (viewIdx + 1) % VIEW.length;
  syncViewNormalToPlane();

  if (gameState !== "play") return;

  // arrows -> next dir
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
    const p = getPlaneInfo();
    const d = screenArrowToWorldDir(keyCode, p);
    if (axisInPlane(d.axis)) nextDirWorld = d;
    return false;
  }

  // W = turn plane around movement axis
  if (key === "w" || key === "W") {
    turnPlaneAroundDirection();
    syncViewNormalToPlane();
  }
}

function mousePressed() {
  const inside =
    mouseX >= startBtn.x && mouseX <= startBtn.x + startBtn.w &&
    mouseY >= startBtn.y && mouseY <= startBtn.y + startBtn.h;

  if (!inside) return;
  if (gameState === "menu" || gameState === "gameover") startGame();
}

// ---------------- TURNING / DIR MAPPING ----------------

function turnPlaneAroundDirection() {
  const a = planeAxes.a, b = planeAxes.b;
  const n = thirdAxis(a, b);

  if (dirWorld.axis === a) planeAxes = { a: a, b: n };
  else if (dirWorld.axis === b) planeAxes = { a: n, b: b };
  else {
    planeAxes = { a: a, b: n };
    dirWorld = { axis: a, step: dirWorld.step };
    nextDirWorld = { ...dirWorld };
  }

  if (!axisInPlane(nextDirWorld.axis)) nextDirWorld = { ...dirWorld };
}

function screenArrowToWorldDir(kc, p) {
  if (kc === LEFT_ARROW)  return { axis: p.uAxis, step: -1 * p.uSign };
  if (kc === RIGHT_ARROW) return { axis: p.uAxis, step: +1 * p.uSign };
  if (kc === UP_ARROW)    return { axis: p.vAxis, step: -1 * p.vSign };
  return { axis: p.vAxis, step: +1 * p.vSign };
}

function worldDirToScreenDelta(dw, p) {
  if (dw.axis === p.uAxis) return { du: (dw.step > 0 ? +1 : -1) * p.uSign, dv: 0 };
  if (dw.axis === p.vAxis) return { du: 0, dv: (dw.step > 0 ? +1 : -1) * p.vSign };
  return { du: 0, dv: 0 };
}

// ---------------- COORD HELPERS ----------------

function cubeToScreen(x, y, z, p) {
  const u = getAxisVal({ x, y, z }, p.uAxis);
  const v = getAxisVal({ x, y, z }, p.vAxis);
  const i = p.uSign > 0 ? u : (N - 1 - u);
  const j = p.vSign > 0 ? v : (N - 1 - v);
  return { i, j };
}

function sliceQuadUnit(nAxis, t) {
  if (nAxis === "X") return [{ x: t, y: 0, z: 0 }, { x: t, y: 1, z: 0 }, { x: t, y: 1, z: 1 }, { x: t, y: 0, z: 1 }];
  if (nAxis === "Y") return [{ x: 0, y: t, z: 0 }, { x: 1, y: t, z: 0 }, { x: 1, y: t, z: 1 }, { x: 0, y: t, z: 1 }];
  return [{ x: 0, y: 0, z: t }, { x: 1, y: 0, z: t }, { x: 1, y: 1, z: t }, { x: 0, y: 1, z: t }];
}

function axisLower(A) { return A.toLowerCase(); }
function getAxisVal(p, A) { return A === "X" ? p.x : (A === "Y" ? p.y : p.z); }
