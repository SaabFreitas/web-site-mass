'use strict';
/* ==========================================================================
   DUELO DIVINO — utilidades, constantes e tela
   Mundo lógico em 1280×720; o canvas é criado na resolução real da tela
   (até 2×) para a arte vetorial ficar nítida, estilo anime HD.
   ========================================================================== */
const W = 1280, H = 720;
const WORLD_W = 1900, GROUND = 640, GRAV = 0.95;
const WALL_L = 70, WALL_R = WORLD_W - 70;
const ROUND_TIME = 99, WINS_NEEDED = 2;
const FONT_T = "'Bangers', 'Impact', sans-serif";
const FONT_U = "'Rajdhani', 'Segoe UI', sans-serif";
const FONT_J = "'Noto Serif JP', serif";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ---------- cores ---------- */
const colorMemo = new Map();
function memo(key, fn) { let v = colorMemo.get(key); if (v === undefined) { v = fn(); colorMemo.set(key, v); } return v; }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(r, g, b) { const c = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }
// k < 1 escurece; k > 1 clareia em direção ao branco
function shade(h, k) {
  return memo(h + '*' + k, () => {
    const [r, g, b] = hexToRgb(h);
    if (k <= 1) return toHex(r * k, g * k, b * k);
    const t = k - 1; return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  });
}
function mix(a, b, t) { return memo(a + b + t, () => { const A = hexToRgb(a), B = hexToRgb(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }); }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }

/* ---------- canvas ---------- */
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
let RS = 1; // escala de renderização (pixels reais por unidade lógica)
function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const s = clamp((r.width || W) * dpr / W, 1, 2);
  if (Math.abs(s - RS) > .01 || canvas.width !== Math.round(W * s)) {
    RS = s; canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    if (typeof Stage !== 'undefined') Stage.invalidate();
  }
}
function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RS); c.height = Math.ceil(h * RS);
  const g = c.getContext('2d'); g.scale(RS, RS);
  return { c, g, w, h };
}
// Executa fn com ctx apontando para outro contexto (camadas pré-desenhadas)
function withCtx(g, fn) { const old = ctx; ctx = g; try { fn(); } finally { ctx = old; } }

/* ---------- formas ---------- */
// Cápsula afunilada de A até B (membros do corpo)
function capsulePath(ax, ay, bx, by, r1, r2) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || .001, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const an = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(ax + nx * r1, ay + ny * r1);
  ctx.lineTo(bx + nx * r2, by + ny * r2);
  ctx.arc(bx, by, r2, an, an - Math.PI, true);
  ctx.lineTo(ax - nx * r1, ay - ny * r1);
  ctx.arc(ax, ay, r1, an + Math.PI, an, true);
  ctx.closePath();
}
/* Os caminhos abaixo são montados ao mesmo tempo no contexto e num Path2D,
   para que possam ser recortados (clip) e contornados depois do sombreamento. */
function dualPath() {
  const p = new Path2D(); ctx.beginPath();
  return {
    p,
    m(x, y) { p.moveTo(x, y); ctx.moveTo(x, y); },
    l(x, y) { p.lineTo(x, y); ctx.lineTo(x, y); },
    q(a, b, x, y) { p.quadraticCurveTo(a, b, x, y); ctx.quadraticCurveTo(a, b, x, y); },
    z() { p.closePath(); ctx.closePath(); return p; }
  };
}
// Caminho suave passando pelos pontos médios (curvas de desenho à mão)
function smoothPath(pts, closed = true) {
  const n = pts.length, d = dualPath();
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  if (!closed) {
    d.m(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) { const m = mid(pts[i], pts[i + 1]); d.q(pts[i].x, pts[i].y, m.x, m.y); }
    d.l(pts[n - 1].x, pts[n - 1].y); return d.p;
  }
  const m0 = mid(pts[n - 1], pts[0]); d.m(m0.x, m0.y);
  for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); d.q(p.x, p.y, m.x, m.y); }
  return d.z();
}
function poly(pts) { const d = dualPath(); d.m(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) d.l(pts[i].x, pts[i].y); return d.z(); }

/* ---------- brilhos pré-desenhados ---------- */
const glowMemo = new Map();
function glowSprite(stops) {
  const key = stops.join('|'); let c = glowMemo.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach((col, i) => gr.addColorStop(i / (stops.length - 1), col));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowMemo.set(key, c);
  }
  return c;
}
function glow(x, y, rx, stops, ry = rx) { ctx.drawImage(glowSprite(stops), x - rx, y - ry, rx * 2, ry * 2); }
function glowColor(col, a = 1) { return [rgba(col, a), rgba(col, a * .45), rgba(col, 0)]; }

/* ---------- texto com contorno (estilo mangá) ---------- */
function titleText(str, x, y, size, fill, stroke = '#120a1c', align = 'center', lw = 0) {
  ctx.font = `${size}px ${FONT_T}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw || Math.max(4, size * .16); ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y); ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
function uiText(str, x, y, size, fill, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT_U}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}
