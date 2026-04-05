/**
 * rink.js — NHL rink drawing functions
 * Official ratio: 200ft × 85ft
 * Corner radius: ~28ft
 */

const RINK = {
  // Fractional positions (0-1) based on 200x85 proportions
  W: 200, H: 85,

  // Lines as fractional x positions
  GOAL_LINE_LEFT:   11 / 200,   // 0.055
  GOAL_LINE_RIGHT:  189 / 200,  // 0.945
  BLUE_LINE_LEFT:   75 / 200,   // 0.375
  BLUE_LINE_RIGHT:  125 / 200,  // 0.625
  CENTER_X:         0.5,

  // Face-off dot positions (x, y) fractional
  FACEOFF_DOTS: [
    // Centre ice
    { x: 0.5,   y: 0.5 },
    // Left zone
    { x: 0.145, y: 0.25 },
    { x: 0.145, y: 0.75 },
    // Left neutral
    { x: 0.375, y: 0.28 },
    { x: 0.375, y: 0.72 },
    // Right neutral
    { x: 0.625, y: 0.28 },
    { x: 0.625, y: 0.72 },
    // Right zone
    { x: 0.855, y: 0.25 },
    { x: 0.855, y: 0.75 },
  ],

  // Face-off circles (large ones in each zone)
  FACEOFF_CIRCLES: [
    { x: 0.145, y: 0.25 },
    { x: 0.145, y: 0.75 },
    { x: 0.855, y: 0.25 },
    { x: 0.855, y: 0.75 },
  ],

  // Goal net dimensions in feet
  NET_W: 6,      // width (opening)
  NET_D: 4,      // depth behind goal line
  CREASE_R: 6,   // crease radius

  CORNER_R: 28,  // corner radius in feet
};

/**
 * Draw the full rink onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cw  canvas pixel width
 * @param {number} ch  canvas pixel height
 */
function drawRink(ctx, cw, ch) {
  ctx.clearRect(0, 0, cw, ch);

  const scale = Math.min(cw / RINK.W, ch / RINK.H);
  const ox = (cw - RINK.W * scale) / 2;
  const oy = (ch - RINK.H * scale) / 2;

  // Helper: convert rink feet → canvas pixels
  function rx(feetX) { return ox + feetX * scale; }
  function ry(feetY) { return oy + feetY * scale; }
  function rs(feet)  { return feet * scale; }

  const rW = RINK.W * scale;
  const rH = RINK.H * scale;
  const cornerR = rs(RINK.CORNER_R);

  // ── Ice surface ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, ox, oy, rW, rH, cornerR);
  ctx.fillStyle = '#d6eaf8';
  ctx.fill();
  ctx.restore();

  // ── Clip all markings inside rounded rink ────────────────────────────────
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, ox, oy, rW, rH, cornerR);
  ctx.clip();

  // Centre ice circle
  ctx.beginPath();
  ctx.arc(rx(100), ry(42.5), rs(15), 0, Math.PI * 2);
  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = rs(0.5);
  ctx.stroke();

  // Centre dot
  drawDot(ctx, rx(100), ry(42.5), rs(0.5), '#1565c0');

  // ── Red centre line (dashed) ─────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rx(100), oy);
  ctx.lineTo(rx(100), oy + rH);
  ctx.strokeStyle = '#c62828';
  ctx.lineWidth = rs(1);
  ctx.setLineDash([rs(3), rs(3)]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Blue lines ───────────────────────────────────────────────────────────
  [75, 125].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(rx(x), oy);
    ctx.lineTo(rx(x), oy + rH);
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = rs(2);
    ctx.stroke();
  });

  // ── Goal lines ───────────────────────────────────────────────────────────
  [11, 189].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(rx(x), oy);
    ctx.lineTo(rx(x), oy + rH);
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = rs(0.6);
    ctx.stroke();
  });

  // ── Goal nets + creases ──────────────────────────────────────────────────
  drawGoal(ctx, rx, ry, rs, false); // left
  drawGoal(ctx, rx, ry, rs, true);  // right

  // ── Face-off dots and circles ────────────────────────────────────────────
  RINK.FACEOFF_CIRCLES.forEach(d => {
    ctx.beginPath();
    ctx.arc(rx(d.x * RINK.W), ry(d.y * RINK.H), rs(15), 0, Math.PI * 2);
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = rs(0.5);
    ctx.stroke();
    // Hash marks
    drawHashMarks(ctx, rx(d.x * RINK.W), ry(d.y * RINK.H), rs, rs(15));
  });

  RINK.FACEOFF_DOTS.forEach(d => {
    drawDot(ctx, rx(d.x * RINK.W), ry(d.y * RINK.H), rs(1.2), '#c62828');
  });

  ctx.restore(); // end clip

  // ── Board outline ────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, ox, oy, rW, rH, cornerR);
  ctx.strokeStyle = '#90a4ae';
  ctx.lineWidth = rs(1.2);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHashMarks(ctx, cx, cy, rs, circleR) {
  const len = rs(3);
  const offset = rs(2);
  ctx.strokeStyle = '#c62828';
  ctx.lineWidth = rs(0.4);
  // Draw 4 hash marks around the circle
  [
    [cx - circleR - offset, cy - len / 2, cx - circleR - offset, cy + len / 2],
    [cx + circleR + offset, cy - len / 2, cx + circleR + offset, cy + len / 2],
    [cx - len / 2, cy - circleR - offset, cx + len / 2, cy - circleR - offset],
    [cx - len / 2, cy + circleR + offset, cx + len / 2, cy + circleR + offset],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

function drawGoal(ctx, rx, ry, rs, isRight) {
  const goalLineX = isRight ? 189 : 11;
  const netDepth = RINK.NET_D;
  const netHalf = RINK.NET_W / 2;
  const creaseR = RINK.CREASE_R;
  const cy = 42.5; // centre ice y in feet

  const gx = rx(goalLineX);
  const gy = ry(cy);

  // Crease (semi-circle, extends into the ice from goal line)
  ctx.save();
  ctx.beginPath();
  if (isRight) {
    ctx.arc(gx, gy, rs(creaseR), Math.PI * 0.5, Math.PI * 1.5, true);
    ctx.lineTo(gx, gy - rs(creaseR));
  } else {
    ctx.arc(gx, gy, rs(creaseR), Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.lineTo(gx, gy + rs(creaseR));
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(100, 181, 246, 0.3)';
  ctx.fill();
  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = rs(0.5);
  ctx.stroke();
  ctx.restore();

  // Net box
  const netX = isRight ? gx : gx - rs(netDepth);
  const netDir = isRight ? 1 : -1;
  const netTop = gy - rs(netHalf);
  const netBot = gy + rs(netHalf);
  const netBack = isRight ? gx + rs(netDepth) : gx - rs(netDepth);

  ctx.save();
  ctx.strokeStyle = '#e53935';
  ctx.lineWidth = rs(0.6);
  ctx.fillStyle = 'rgba(229, 57, 53, 0.12)';
  ctx.beginPath();
  ctx.moveTo(gx, netTop);
  ctx.lineTo(netBack, netTop);
  ctx.lineTo(netBack, netBot);
  ctx.lineTo(gx, netBot);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Convert fractional coordinates to canvas pixel coordinates.
 * @param {number} fx  0-1 fraction
 * @param {number} fy  0-1 fraction
 * @param {number} cw  canvas width
 * @param {number} ch  canvas height
 * @returns {{x: number, y: number}}
 */
function fracToCanvas(fx, fy, cw, ch) {
  const scale = Math.min(cw / RINK.W, ch / RINK.H);
  const ox = (cw - RINK.W * scale) / 2;
  const oy = (ch - RINK.H * scale) / 2;
  return {
    x: ox + fx * RINK.W * scale,
    y: oy + fy * RINK.H * scale
  };
}

/**
 * Convert canvas pixel coordinates to fractional rink coordinates.
 * @param {number} px  canvas x
 * @param {number} py  canvas y
 * @param {number} cw  canvas width
 * @param {number} ch  canvas height
 * @returns {{bx: number, by: number}}
 */
function canvasToFrac(px, py, cw, ch) {
  const scale = Math.min(cw / RINK.W, ch / RINK.H);
  const ox = (cw - RINK.W * scale) / 2;
  const oy = (ch - RINK.H * scale) / 2;
  return {
    bx: (px - ox) / (RINK.W * scale),
    by: (py - oy) / (RINK.H * scale)
  };
}
