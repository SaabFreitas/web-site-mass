'use strict';
/* ==========================================================================
   Desenho dos lutadores em estilo anime HD: esqueleto com proporções reais
   (~7 cabeças), sombreamento em duas tonalidades (cel shading), contorno
   colorido, cabelo e tecidos com física simples (rabo de cavalo, faixa).
   ========================================================================== */
const LIGHT = { x: .42, y: -.9 }; // luz do pôr do sol vindo de cima/à frente

function mat(col, dim = 1) {
  const f = dim === 1 ? col : shade(col, dim);
  return { f, s: shade(f, .72), l: shade(f, .34) };
}

// Membro com sombreamento de duas tonalidades
function limb(a, b, r1, r2, m, lw = 2) {
  capsulePath(a.x, a.y, b.x, b.y, r1, r2);
  ctx.fillStyle = m.f; ctx.fill();
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const side = (nx * LIGHT.x + ny * LIGHT.y) > 0 ? -1 : 1; // lado oposto à luz
  ctx.save(); ctx.clip();
  const o1 = r1 * .12, o2 = r2 * .12, e1 = r1 + 4, e2 = r2 + 4;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * side * o1 - dx / L * e1, a.y + ny * side * o1 - dy / L * e1);
  ctx.lineTo(b.x + nx * side * o2 + dx / L * e2, b.y + ny * side * o2 + dy / L * e2);
  ctx.lineTo(b.x + nx * side * e2 + dx / L * e2, b.y + ny * side * e2 + dy / L * e2);
  ctx.lineTo(a.x + nx * side * e1 - dx / L * e1, a.y + ny * side * e1 - dy / L * e1);
  ctx.fillStyle = m.s; ctx.fill();
  ctx.restore();
  capsulePath(a.x, a.y, b.x, b.y, r1, r2);
  ctx.lineWidth = lw; ctx.strokeStyle = m.l; ctx.stroke();
}

// Preenche o caminho (Path2D) com sombra no lado oposto à luz, pelo eixo dado
function shadedFill(path, m, axisA, axisB, lw = 2, bias = 0) {
  ctx.fillStyle = m.f; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  const dx = axisB.x - axisA.x, dy = axisB.y - axisA.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const side = (nx * LIGHT.x + ny * LIGHT.y) > 0 ? -1 : 1;
  const ox = nx * side, oy = ny * side, E = 400;
  ctx.beginPath();
  ctx.moveTo(axisA.x + ox * bias - dx / L * E, axisA.y + oy * bias - dy / L * E);
  ctx.lineTo(axisB.x + ox * bias + dx / L * E, axisB.y + oy * bias + dy / L * E);
  ctx.lineTo(axisB.x + ox * E + dx / L * E, axisB.y + oy * E + dy / L * E);
  ctx.lineTo(axisA.x + ox * E - dx / L * E, axisA.y + oy * E - dy / L * E);
  ctx.fillStyle = m.s; ctx.fill();
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = m.l; ctx.stroke(path);
}

/* ---------- corda (cabelo, faixas, fitas) com integração de Verlet ---------- */
class Rope {
  constructor(n, seg) { this.n = n; this.seg = seg; this.p = null; }
  reset(x, y, dir) { this.p = []; for (let i = 0; i < this.n; i++) this.p.push({ x: x - dir * i * this.seg, y: y + i * 2, px: x - dir * i * this.seg, py: y + i * 2 }); }
  update(ax, ay, dir, wind, grav = .55, stiff = 0) {
    if (!this.p) this.reset(ax, ay, dir);
    const p = this.p; p[0].x = ax; p[0].y = ay; p[0].px = ax; p[0].py = ay;
    for (let i = 1; i < this.n; i++) {
      const q = p[i], vx = (q.x - q.px) * .9, vy = (q.y - q.py) * .9;
      q.px = q.x; q.py = q.y;
      q.x += vx + wind - dir * stiff * (1 - i / this.n); q.y += vy + grav;
      if (q.y > GROUND - 2) q.y = GROUND - 2;
    }
    for (let k = 0; k < 4; k++) for (let i = 1; i < this.n; i++) {
      const a = p[i - 1], b = p[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || .001, diff = (L - this.seg) / L;
      if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
      else { a.x += dx * diff * .5; a.y += dy * diff * .5; b.x -= dx * diff * .5; b.y -= dy * diff * .5; }
    }
  }
  // Fita afunilada com gradiente
  draw(w0, w1, c0, c1, line) {
    const p = this.p; if (!p) return;
    const L = [], R = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (p.length - 1));
      L.push({ x: p[i].x - dy / l * w, y: p[i].y + dx / l * w }); R.push({ x: p[i].x + dy / l * w, y: p[i].y - dx / l * w });
    }
    ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i].x, L[i].y);
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath();
    const g = ctx.createLinearGradient(p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke();
  }
}

/* ---------- cabeça (coordenadas locais: centro da cabeça, olhando para a direita) ---------- */
function headToWorld(sk, lx, ly) {
  const a = sk.headAng, s = sk.headS, d = sk.d, x = lx * d * s, y = ly * s;
  return { x: sk.head.x + Math.cos(a) * x - Math.sin(a) * y, y: sk.head.y + Math.sin(a) * x + Math.cos(a) * y };
}

function facePath() {
  ctx.beginPath();
  ctx.moveTo(14, -10);
  ctx.bezierCurveTo(15, -27, -10, -31, -18, -14);
  ctx.bezierCurveTo(-22, -2, -17, 10, -9, 15);
  ctx.lineTo(-4, 15.5);
  ctx.quadraticCurveTo(2, 22.5, 8.5, 22.5);
  ctx.quadraticCurveTo(12.5, 22.5, 14.2, 17.5);
  ctx.quadraticCurveTo(15.2, 13, 15.6, 10.5);
  ctx.lineTo(16.2, 6.5);
  ctx.quadraticCurveTo(19.6, 4.8, 17.2, 2.2);
  ctx.lineTo(16, -1);
  ctx.quadraticCurveTo(15, -5, 14, -10);
  ctx.closePath();
}

function drawEye(f, C) {
  const ex = f.expr;
  if (ex === 'hurt' || ex === 'ko' || f.blink > 0) {
    ctx.strokeStyle = shade(C.hair, .6); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (ex === 'hurt') { ctx.moveTo(6, -3); ctx.lineTo(12.5, .5); ctx.lineTo(6.5, 3.5); }
    else { ctx.moveTo(6, 1.5); ctx.quadraticCurveTo(10, 3.5, 14, 1); }
    ctx.stroke(); return;
  }
  // esclera
  ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.quadraticCurveTo(10.5, -5, 14.4, -2.2);
  ctx.quadraticCurveTo(14.2, 3, 12.8, 5.2); ctx.quadraticCurveTo(9, 5.6, 6.6, 3.2); ctx.closePath();
  ctx.fillStyle = '#fbf8ff'; ctx.fill();
  ctx.save(); ctx.clip();
  // íris com degradê (mais escura em cima, como no anime)
  const g = ctx.createLinearGradient(0, -3, 0, 6);
  g.addColorStop(0, shade(C.eye, .35)); g.addColorStop(.55, C.eye); g.addColorStop(1, shade(C.eye, 1.45));
  ctx.beginPath(); ctx.ellipse(11.2, 1.2, 3.3, 4.6, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(11.8, 1.6, 1.5, 2.6, 0, 0, Math.PI * 2); ctx.fillStyle = shade(C.eye, .18); ctx.fill();
  ctx.fillStyle = 'rgba(40,30,60,.25)'; ctx.fillRect(4, -4, 12, 2.6); // sombra da pálpebra
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(12.6, -.6, 1.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10.2, 3.6, .6, 0, Math.PI * 2); ctx.fill();
  // cílios superiores grossos
  ctx.strokeStyle = '#1a1020'; ctx.lineCap = 'round'; ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(5.6, -2.6); ctx.quadraticCurveTo(10.5, -5.8, 14.8, -2.4); ctx.stroke();
  if (f.ch.fem) { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(5.8, -2.6); ctx.lineTo(3.4, -4.4); ctx.moveTo(14.6, -2.4); ctx.lineTo(16.2, -1.2); ctx.stroke(); }
  ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(8, 5.2); ctx.quadraticCurveTo(11, 5.8, 13, 4.8); ctx.stroke();
}

function drawHeadLocal(f, sk) {
  const C = f.C, fem = f.ch.fem, ex = f.expr;
  // pescoço fica por trás (desenhado antes); orelha e rosto
  facePath(); ctx.fillStyle = C.skin; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = shade(C.skin, .84);
  ctx.beginPath(); ctx.moveTo(-30, -40); ctx.lineTo(2, -40); ctx.quadraticCurveTo(-4, 6, 6, 30); ctx.lineTo(-30, 30); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -9, 14, 5, -.1, 0, Math.PI * 2); ctx.fill(); // sombra da franja
  if (fem || ex === 'hurt') { ctx.fillStyle = 'rgba(255,110,120,.28)'; ctx.beginPath(); ctx.ellipse(10.5, 8.5, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  facePath(); ctx.lineWidth = 1.6; ctx.strokeStyle = shade(C.skin, .42); ctx.stroke();
  // orelha
  ctx.beginPath(); ctx.ellipse(-3, 3, 3.4, 5.2, .15, 0, Math.PI * 2); ctx.fillStyle = shade(C.skin, .93); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = shade(C.skin, .45); ctx.stroke();
  // olho e sobrancelha
  drawEye(f, C);
  ctx.strokeStyle = C.brow; ctx.lineCap = 'round';
  if (fem) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(6, -8.3); ctx.quadraticCurveTo(10.5, -10.5, 15, -8.2); ctx.stroke(); }
  else { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(5.5, -10); ctx.lineTo(15.2, -7.2); ctx.stroke(); }
  // nariz e boca
  ctx.strokeStyle = shade(C.skin, .5); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(17.4, 3.2); ctx.lineTo(15.6, 5.2); ctx.stroke();
  if (ex === 'shout' || ex === 'hurt') {
    ctx.beginPath(); ctx.moveTo(11.6, 10.4); ctx.quadraticCurveTo(15.5, 9.2, 15.4, 11); ctx.quadraticCurveTo(14.5, 15.2, 12.4, 14); ctx.closePath();
    ctx.fillStyle = '#5a1420'; ctx.fill(); ctx.strokeStyle = shade(C.skin, .38); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#d65a6a'; ctx.beginPath(); ctx.ellipse(13.4, 13.2, 1.5, .8, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = fem ? C.lip : shade(C.skin, .45); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(12, 11.4); ctx.lineTo(15.1, 10.8); ctx.stroke();
  }
}

function hairGrad(C, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, C.hair); g.addColorStop(.7, C.hair); g.addColorStop(1, C.hairTip); return g;
}

function drawSpikyHair(f) {
  const C = f.C;
  const base = [], spikes = [[-.55, 8], [-.95, 15], [-1.35, 19], [-1.75, 21], [-2.15, 22], [-2.55, 20], [-2.95, 17], [2.9, 14], [2.55, 10]];
  const cx = -1, cy = -6, R = 20;
  ctx.beginPath(); ctx.moveTo(15, -8);
  for (let i = 0; i < spikes.length; i++) {
    const [a, len] = spikes[i], sway = Math.sin(f.t * .08 + i) * .04;
    const b1 = a + .18, b2 = a - .18, ta = a - .32 + sway;
    ctx.lineTo(cx + Math.cos(b1) * R, cy + Math.sin(b1) * R);
    ctx.lineTo(cx + Math.cos(ta) * (R + len), cy + Math.sin(ta) * (R + len));
    ctx.lineTo(cx + Math.cos(b2) * R, cy + Math.sin(b2) * R);
  }
  ctx.lineTo(-10, 12); ctx.quadraticCurveTo(-3, 0, -2, -4);
  ctx.quadraticCurveTo(6, -14, 15, -8); ctx.closePath();
  ctx.fillStyle = hairGrad(C, -40, 20); ctx.fill();
  ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.strokeStyle = shade(C.hair, .5); ctx.stroke();
  // franja caindo sobre a testa
  ctx.beginPath(); ctx.moveTo(3, -20); ctx.lineTo(17.5, -1.5); ctx.lineTo(12, -9); ctx.lineTo(12.5, 1.5); ctx.lineTo(7, -9); ctx.lineTo(4.5, -1); ctx.lineTo(0, -14); ctx.closePath();
  ctx.fillStyle = hairGrad(C, -20, 2); ctx.fill(); ctx.stroke();
  // brilho do cabelo
  ctx.strokeStyle = C.hairHi; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-1, -6, 17, -2.3, -1.2); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-1, -6, 13, -2.1, -1.5); ctx.stroke();
}

function drawPonytailHair(f) {
  const C = f.C;
  // calota
  ctx.beginPath(); ctx.moveTo(15.5, -7);
  ctx.bezierCurveTo(17, -30, -12, -33, -20, -14);
  ctx.bezierCurveTo(-23, -4, -19, 8, -12, 13);
  ctx.quadraticCurveTo(-6, 2, -4, -6); ctx.quadraticCurveTo(4, -15, 15.5, -7); ctx.closePath();
  ctx.fillStyle = hairGrad(C, -34, 16); ctx.fill(); ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.strokeStyle = shade(C.hair, .5); ctx.stroke();
  // franja em mechas pontudas
  ctx.beginPath(); ctx.moveTo(2, -21);
  ctx.quadraticCurveTo(12, -19, 18.5, -8); ctx.lineTo(16.8, 1.5); ctx.lineTo(14.6, -6);
  ctx.lineTo(12.8, 3); ctx.lineTo(10.4, -7); ctx.lineTo(7.6, 1); ctx.lineTo(6, -9); ctx.lineTo(1, -4);
  ctx.quadraticCurveTo(-1, -14, 2, -21); ctx.closePath();
  ctx.fillStyle = hairGrad(C, -22, 3); ctx.fill(); ctx.stroke();
  // mecha lateral na frente da orelha
  ctx.beginPath(); ctx.moveTo(-1, -8); ctx.quadraticCurveTo(4, 8, 2.5, 27); ctx.lineTo(0, 20); ctx.lineTo(-1.5, 26); ctx.quadraticCurveTo(-4, 8, -5, -6); ctx.closePath();
  ctx.fillStyle = hairGrad(C, -8, 27); ctx.fill(); ctx.stroke();
  // brilho
  ctx.strokeStyle = C.hairHi; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-1, -6, 18, -2.4, -1.35); ctx.stroke();
  // fita do rabo de cavalo
  ctx.fillStyle = C.band; ctx.strokeStyle = shade(C.band, .45); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(-16, -19, 3.4, 5, .5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawHeadband(f) {
  const C = f.C;
  ctx.beginPath(); ctx.moveTo(16.2, -12.5); ctx.quadraticCurveTo(0, -20, -20, -12); ctx.lineTo(-20.5, -5.5); ctx.quadraticCurveTo(0, -13, 16.2, -5.8); ctx.closePath();
  ctx.fillStyle = C.band; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = shade(C.band, .4); ctx.stroke();
  ctx.fillStyle = shade(C.band, 1.35); ctx.fillRect(2, -14.5, 8, 1.4);
  ctx.beginPath(); ctx.ellipse(-20, -9, 3.5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = shade(C.band, .8); ctx.fill(); ctx.stroke();
}

/* ---------- partes do corpo ---------- */
function drawFoot(ank, toe, m, r) {
  limb(ank, toe, r * .95, r * .7, m, 1.8);
}

function drawHand(p, C, look, dim, open) {
  const m = mat(C.skin, dim);
  ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fillStyle = m.f; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = m.l; ctx.stroke();
  if (look.hands === 'wraps') {
    ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = shade(C.wrap, dim); ctx.fillRect(p.x - 9, p.y - 2, 18, 11);
    ctx.strokeStyle = shade(C.wrap, dim * .7); ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(p.x - 9, p.y + i * 3.2); ctx.lineTo(p.x + 9, p.y - 2 + i * 3.2); ctx.stroke(); }
    ctx.restore(); ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.strokeStyle = m.l; ctx.lineWidth = 1.6; ctx.stroke();
  }
}

function drawArm(f, sk, front) {
  const C = f.C, look = f.ch.look, B = f.ch.body, dim = front ? 1 : .8, k = B.limb;
  const sh = front ? sk.shF : sk.shB, el = front ? sk.elbF : sk.elbB, hd = front ? sk.handF : sk.handB;
  const skin = mat(C.skin, dim), coat = mat(C.coat, dim);
  if (look.top === 'jacket') {
    limb(sh, el, 12.5 * k, 10.5 * k, coat);
    limb(el, hd, 10.5 * k, 8 * k, coat);
    // punho da manga
    const cx = lerp(el.x, hd.x, .8), cy = lerp(el.y, hd.y, .8);
    ctx.beginPath(); ctx.arc(cx, cy, 9 * k, 0, Math.PI * 2); ctx.fillStyle = shade(C.coatHi, dim); ctx.fill(); ctx.strokeStyle = coat.l; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    // manga larga do haori: parte de cima + pano pendurado
    const dx = hd.x - el.x, dy = hd.y - el.y, L = Math.hypot(dx, dy) || 1;
    limb(el, { x: lerp(el.x, hd.x, .55), y: lerp(el.y, hd.y, .55) }, 8 * k, 7.5 * k, skin);
    limb(sh, el, 11 * k, 11.5 * k, coat);
    const hang = { x: el.x + (f.vx || 0) * -2, y: el.y + 20 };
    shadedFill(poly([{ x: sh.x + (dy / L) * 6, y: sh.y - (dx / L) * 6 }, { x: el.x + dx / L * 8, y: el.y + dy / L * 8 + 4 }, hang, { x: sh.x - 6, y: sh.y + 16 }]), coat, sh, hang, 1.8);
    ctx.strokeStyle = shade(C.shirt, dim * .9); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(el.x + dx / L * 8, el.y + dy / L * 8 + 4); ctx.lineTo(hang.x, hang.y); ctx.stroke();
    limb({ x: lerp(el.x, hd.x, .5), y: lerp(el.y, hd.y, .5) }, hd, 7 * k, 6 * k, skin);
  }
  drawHand(hd, C, look, dim);
}

function drawLeg(f, sk, front) {
  const C = f.C, look = f.ch.look, B = f.ch.body, dim = front ? 1 : .8, k = B.limb;
  const hp = front ? sk.hipF : sk.hipB, kn = front ? sk.kneeF : sk.kneeB, an = front ? sk.ankF : sk.ankB, toe = front ? sk.toeF : sk.toeB;
  const pants = mat(C.pants, dim), shoe = mat(C.shoe, dim);
  drawFoot(an, toe, shoe, 7.5);
  if (look.legs === 'hakama') {
    limb(kn, an, 12.5, 16.5, pants);
    limb(hp, kn, 14, 13, pants);
    ctx.strokeStyle = pants.l; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lerp(kn.x, an.x, .15), lerp(kn.y, an.y, .15)); ctx.lineTo(lerp(kn.x, an.x, .95), lerp(kn.y, an.y, .95)); ctx.stroke();
  } else {
    limb(kn, an, 11.5 * k, 8.5 * k, pants);
    limb(hp, kn, 15 * k, 12 * k, pants);
    // dobras do tecido no joelho
    ctx.strokeStyle = pants.l; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(kn.x, kn.y, 7, 0.4, 1.6); ctx.stroke();
    // canela enfaixada
    const w0 = { x: lerp(kn.x, an.x, .72), y: lerp(kn.y, an.y, .72) };
    limb(w0, an, 9 * k, 8 * k, mat(C.wrap, dim), 1.4);
  }
}

function torsoPoints(sk, B) {
  const T = B.torso, at = (k, s) => ({ x: sk.hip.x + sk.u.x * k + sk.n.x * s, y: sk.hip.y + sk.u.y * k + sk.n.y * s });
  return [at(T - 3, 8), at(T - 20, B.chest * .85), at(T - 40, B.chest), at(T - 58, B.chest * .8), at(T * .32, B.waist), at(6, B.hipW),
    at(-14, 4), at(2, -B.hipW - 2), at(T * .35, -B.waist + 1), at(T * .66, -B.back), at(T - 12, -B.back - 3), at(T - 1, -6)];
}

function drawTorso(f, sk) {
  const C = f.C, look = f.ch.look, B = f.ch.body, T = B.torso;
  const at = (k, s) => ({ x: sk.hip.x + sk.u.x * k + sk.n.x * s, y: sk.hip.y + sk.u.y * k + sk.n.y * s });
  const pts = torsoPoints(sk, B), top = at(T, 0);
  const coat = mat(C.coat), shirt = mat(C.shirt), pants = mat(C.pants);
  // quadril (calça / hakama)
  if (look.legs === 'hakama') {
    shadedFill(poly([at(T * .3, B.waist + 3), at(0, B.hipW + 4), sk.kneeF, { x: sk.kneeF.x + sk.n.x * 12, y: sk.kneeF.y }, { x: sk.kneeB.x - sk.n.x * 14, y: sk.kneeB.y }, sk.kneeB, at(0, -B.hipW - 5), at(T * .3, -B.waist - 3)]), pants, sk.hip, top, 1.8);
  } else {
    shadedFill(smoothPath([at(T * .3, B.waist), at(4, B.hipW + 1), at(-16, 6), at(2, -B.hipW - 2), at(T * .3, -B.waist)]), pants, sk.hip, top, 1.8);
  }
  // camisa / kimono
  shadedFill(smoothPath(pts), shirt, sk.hip, top, 2, 2);
  if (look.top === 'jacket') {
    // casaco aberto: cobre as costas e os lados, deixa uma faixa vermelha na frente
    const jac = [at(T - 1, -2), at(T - 16, B.chest * .55), at(T - 45, B.chest * .62), at(T * .34, B.waist * .6), at(-6, B.hipW * .55), at(-26, B.hipW * .2),
      at(-22, -B.hipW - 6), at(T * .34, -B.waist - 3), at(T * .66, -B.back - 2), at(T - 12, -B.back - 4)];
    shadedFill(smoothPath(jac), coat, sk.hip, top, 2);
    // gola alta e botões dourados
    ctx.strokeStyle = shade(C.coatHi, 1.1); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    const c1 = at(T - 2, 3), c2 = at(T - 20, B.chest * .6);
    ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    ctx.fillStyle = '#e8b93c';
    for (let i = 0; i < 3; i++) { const b = at(T - 30 - i * 20, B.chest * .6 - i * 1.5); ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill(); }
    // músculo peitoral / abdômen marcado na camisa
    ctx.strokeStyle = shirt.l; ctx.lineWidth = 1.2;
    const a1 = at(T - 52, B.chest * .8), a2 = at(T - 60, B.chest * .95);
    ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke();
    // cinto
    const w1 = at(T * .3, B.waist + 1), w2 = at(T * .3, -B.waist - 1), w3 = at(T * .22, -B.waist - 1), w4 = at(T * .22, B.waist + 1);
    poly([w1, w2, w3, w4]); ctx.fillStyle = '#3a2418'; ctx.fill();
  } else {
    // haori azul por cima do kimono branco
    const har = [at(T - 1, -3), at(T - 14, B.chest * .3), at(T - 50, B.chest * .45), at(T * .3, B.waist * .5), at(-30, B.hipW * .5), at(-40, B.hipW * .1),
      at(-34, -B.hipW - 8), at(T * .34, -B.waist - 3), at(T * .66, -B.back - 2), at(T - 12, -B.back - 4)];
    shadedFill(smoothPath(har), coat, sk.hip, top, 2);
    // gola branca em V
    ctx.strokeStyle = C.shirt; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const v1 = at(T - 1, -1), v2 = at(T - 40, B.chest * .45);
    ctx.beginPath(); ctx.moveTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y); ctx.stroke();
    // padrão de ondas (seigaiha) na barra do haori
    ctx.strokeStyle = shade(C.coatHi, 1.05); ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { const p = at(-26 + i * 2, -B.hipW + 6 + i * 9); ctx.beginPath(); ctx.arc(p.x, p.y, 5, Math.PI, 0); ctx.stroke(); }
    // obi (faixa na cintura) com nó
    const o1 = at(T * .36, B.waist + 3), o2 = at(T * .36, -B.waist - 4), o3 = at(T * .2, -B.waist - 4), o4 = at(T * .2, B.waist + 3);
    poly([o1, o2, o3, o4]); ctx.fillStyle = C.obi; ctx.fill(); ctx.strokeStyle = shade(C.obi, .5); ctx.lineWidth = 1.4; ctx.stroke();
    const oc = at(T * .28, B.waist * .2); ctx.fillStyle = C.coatHi; ctx.fillRect(oc.x - 2, oc.y - 5, 4, 10);
  }
}

function drawKatana(f, sk, drawn) {
  const C = f.C, d = sk.d;
  let base, dir;
  if (drawn) {
    base = sk.handF; const L = Math.hypot(sk.bladeTip.x - sk.bladeBase.x, sk.bladeTip.y - sk.bladeBase.y) || 1;
    dir = { x: (sk.bladeTip.x - sk.bladeBase.x) / L, y: (sk.bladeTip.y - sk.bladeBase.y) / L };
  } else {
    // bainha na cintura, apontando para trás e para baixo
    const w = { x: sk.hip.x + sk.u.x * 28 + sk.n.x * 6, y: sk.hip.y + sk.u.y * 28 + sk.n.y * 6 };
    base = w; const a = -1.3 + sk.t * .5; dir = { x: Math.sin(a) * d, y: Math.cos(a) };
  }
  const nx = -dir.y, ny = dir.x, hL = 24, bL = 112;
  const hEnd = { x: base.x - dir.x * hL * .45, y: base.y - dir.y * hL * .45 };
  const hStart = { x: base.x + dir.x * hL * .55, y: base.y + dir.y * hL * .55 };
  if (drawn) {
    const tip = { x: hStart.x + dir.x * bL, y: hStart.y + dir.y * bL };
    const bend = -d * 6; // curvatura da lâmina
    ctx.beginPath(); ctx.moveTo(hStart.x + nx * 2.6, hStart.y + ny * 2.6);
    ctx.quadraticCurveTo(hStart.x + dir.x * bL * .55 + nx * (2 + bend), hStart.y + dir.y * bL * .55 + ny * (2 + bend), tip.x, tip.y);
    ctx.quadraticCurveTo(hStart.x + dir.x * bL * .5 + nx * (-2.6 + bend), hStart.y + dir.y * bL * .5 + ny * (-2.6 + bend), hStart.x - nx * 2.6, hStart.y - ny * 2.6);
    ctx.closePath();
    const g = ctx.createLinearGradient(hStart.x + nx * 3, hStart.y + ny * 3, hStart.x - nx * 3, hStart.y - ny * 3);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.5, C.blade); g.addColorStop(1, '#8c9ab4');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#3a4460'; ctx.stroke();
    glow(tip.x, tip.y, 10, glowColor(f.ch.fx.light, .6));
  } else {
    const end = { x: hStart.x + dir.x * (bL + 6), y: hStart.y + dir.y * (bL + 6) };
    limb(hStart, end, 4, 3.4, mat('#1c1a2a'), 1.4);
    ctx.strokeStyle = C.guard; ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) { const p = { x: lerp(hStart.x, end.x, i * .3), y: lerp(hStart.y, end.y, i * .3) }; ctx.beginPath(); ctx.moveTo(p.x + nx * 4, p.y + ny * 4); ctx.lineTo(p.x - nx * 4, p.y - ny * 4); ctx.stroke(); }
  }
  // cabo com amarração em losangos e tsuba dourada
  limb(hEnd, hStart, 3.4, 3.4, mat(C.hilt), 1.2);
  ctx.strokeStyle = '#d8d4e8'; ctx.lineWidth = .9;
  for (let i = 0; i < 4; i++) { const p = { x: lerp(hEnd.x, hStart.x, .15 + i * .22), y: lerp(hEnd.y, hStart.y, .15 + i * .22) }; ctx.beginPath(); ctx.moveTo(p.x + nx * 3, p.y + ny * 3); ctx.lineTo(p.x - nx * 3 + dir.x * 3, p.y - ny * 3 + dir.y * 3); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(hStart.x, hStart.y, 6.5, 2.6, Math.atan2(ny, nx), 0, Math.PI * 2); ctx.fillStyle = C.guard; ctx.fill(); ctx.strokeStyle = shade(C.guard, .45); ctx.lineWidth = 1; ctx.stroke();
}

function drawTrail(f) {
  const tr = f.trail; if (tr.length < 2) return;
  const fx = f.ch.fx;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1], b = tr[i], al = (i / tr.length) * .55;
    if (a.bx !== undefined) {
      // rastro da lâmina: faixa entre base e ponta
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.bx, b.by); ctx.lineTo(a.bx, a.by); ctx.closePath();
      ctx.fillStyle = rgba(fx.main, al * .55); ctx.fill();
      ctx.strokeStyle = rgba(fx.core, al); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(fx.main, al); ctx.lineCap = 'round'; ctx.lineWidth = 4 + i * 2.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = rgba(fx.core, al); ctx.lineWidth = 2 + i;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFighter(f) {
  const sk = f.sk; if (!sk) return;
  const C = f.C, look = f.ch.look;
  // sombra no chão
  const hgt = clamp((GROUND - f.y) / 300, 0, 1);
  ctx.fillStyle = `rgba(20,8,30,${.38 * (1 - hgt * .6)})`;
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 4, 62 * (1 - hgt * .4), 11 * (1 - hgt * .4), 0, 0, Math.PI * 2); ctx.fill();

  // aura de energia cheia
  if (f.energy >= 100 && f.state !== 'ko') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + Math.sin(f.t * .2) * .1;
    glow(f.x, sk.hip.y - 30, 120, glowColor(f.ch.fx.main, .5), 190); ctx.restore();
  }
  if (f.flashT > 0) ctx.globalAlpha = .6 + (f.flashT % 4 < 2 ? .4 : 0);

  // camadas de trás: cabelo longo, faixa, bainha
  if (look.hair === 'ponytail') f.ropes.hair.draw(9, 2, C.hair, C.hairTip, shade(C.hair, .5));
  if (look.headband) { f.ropes.band1.draw(3.2, 1.6, C.band, shade(C.band, .75), shade(C.band, .4)); f.ropes.band2.draw(2.8, 1.4, C.band, shade(C.band, .7), shade(C.band, .4)); }
  if (look.weapon === 'katana' && !f.bladeOut) drawKatana(f, sk, false);

  drawArm(f, sk, false);
  drawLeg(f, sk, false);
  drawLeg(f, sk, true);
  drawTorso(f, sk);
  // pescoço
  const nb = sk.neck, ht = headToWorld(sk, -2, 14);
  limb(nb, ht, 7.5, 7, mat(C.skin, .92), 1.5);
  // cabeça
  ctx.save(); ctx.translate(sk.head.x, sk.head.y); ctx.rotate(sk.headAng); ctx.scale(sk.d * sk.headS, sk.headS);
  drawHeadLocal(f, sk);
  if (look.hair === 'spiky') drawSpikyHair(f); else drawPonytailHair(f);
  if (look.headband) drawHeadband(f);
  ctx.restore();
  drawArm(f, sk, true);
  if (look.weapon === 'katana' && f.bladeOut) drawKatana(f, sk, true);
  ctx.globalAlpha = 1;
  drawTrail(f);
}
