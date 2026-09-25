'use strict';
/* ==========================================================================
   Cenário: "Santuário do Mestre Lagarto" ao pôr do sol. Pintado uma vez em
   camadas (céu, montanhas, templo, pátio) com paralaxe; pétalas de cerejeira,
   raios de sol e lanternas são animados a cada quadro.
   ========================================================================== */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const Stage = {
  layers: null, petals: [], SUN: { x: 900, y: 395 }, HORIZON: 450, FLOOR: 560,
  PAR: { far: .12, mid: .4, near: 1 },
  invalidate() { this.layers = null; },
  build() {
    const span = WORLD_W - W;
    this.layers = {
      sky: makeLayer(W, H),
      far: makeLayer(W + span * this.PAR.far, H),
      mid: makeLayer(W + span * this.PAR.mid, H),
      near: makeLayer(WORLD_W, H)
    };
    withCtx(this.layers.sky.g, () => this.paintSky());
    withCtx(this.layers.far.g, () => this.paintFar(this.layers.far.w));
    withCtx(this.layers.mid.g, () => this.paintMid(this.layers.mid.w));
    withCtx(this.layers.near.g, () => this.paintNear(this.layers.near.w));
    if (!this.petals.length) for (let i = 0; i < 46; i++) this.petals.push(this.newPetal(true));
  },

  paintSky() {
    const g = ctx.createLinearGradient(0, 0, 0, this.HORIZON + 40);
    g.addColorStop(0, '#1a1642'); g.addColorStop(.3, '#4a2a6c'); g.addColorStop(.58, '#c4577c'); g.addColorStop(.8, '#ff9a6a'); g.addColorStop(1, '#ffd49a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // estrelas no topo
    const r = mulberry32(7);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,240,255,${r() * .6 * (1 - i / 90)})`; ctx.fillRect(r() * W, r() * 150, 1.5, 1.5); }
    // sol
    glow(this.SUN.x, this.SUN.y, 420, ['rgba(255,220,160,.55)', 'rgba(255,150,110,.25)', 'rgba(255,120,120,0)']);
    glow(this.SUN.x, this.SUN.y, 120, ['rgba(255,250,220,1)', 'rgba(255,220,150,.8)', 'rgba(255,170,110,0)']);
    ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(this.SUN.x, this.SUN.y, 52, 0, Math.PI * 2); ctx.fill();
    // nuvens de anime (cúmulos iluminados por baixo)
    const clouds = [[180, 170, 1.3], [560, 110, 1], [1100, 200, 1.4], [760, 290, .8], [330, 330, .9], [1180, 340, .7]];
    for (const [x, y, s] of clouds) this.cloud(x, y, s, r);
    // faixas finas perto do horizonte
    for (let i = 0; i < 8; i++) {
      const y = 300 + i * 18 + r() * 10, x = r() * W, w = 200 + r() * 300;
      ctx.fillStyle = `rgba(255,${200 + i * 5},${170 + i * 6},${.25 + r() * .2})`;
      ctx.beginPath(); ctx.ellipse(x, y, w, 3 + r() * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  cloud(x, y, s, r) {
    const blobs = [];
    for (let i = 0; i < 9; i++) blobs.push([x + (i - 4) * 32 * s + (r() - .5) * 20 * s, y - Math.sin(i / 8 * Math.PI) * 40 * s + (r() - .5) * 10, (26 + r() * 26) * s * (1 - Math.abs(i - 4) / 10)]);
    const path = () => { ctx.beginPath(); for (const [bx, by, br] of blobs) { ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2); } ctx.rect(x - 150 * s, y - 4, 300 * s, 22 * s); };
    ctx.save();
    path(); ctx.fillStyle = '#9a4a7c'; ctx.fill();
    path(); ctx.clip();
    const g = ctx.createLinearGradient(0, y - 90 * s, 0, y + 20 * s);
    g.addColorStop(0, '#ffe6d0'); g.addColorStop(.5, '#ffb08a'); g.addColorStop(1, 'rgba(255,140,120,0)');
    ctx.fillStyle = g;
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx + 6 * s, by - 8 * s, br * .92, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  ridge(w, base, amp, seed, rough) {
    const r = mulberry32(seed), pts = [];
    let n = 64; for (let i = 0; i <= n; i++) pts.push(0);
    for (let step = n / 2, a = amp; step >= 1; step /= 2, a *= rough) for (let i = step; i < n; i += step * 2) pts[i] = (pts[i - step] + pts[i + step]) / 2 + (r() - .5) * a;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let i = 0; i <= n; i++) ctx.lineTo(i / n * w, base - Math.abs(pts[i]) - amp * .2);
    ctx.lineTo(w, H); ctx.closePath();
  },
  paintFar(w) {
    const cols = ['#8e5a8c', '#6e4478', '#523364'];
    for (let i = 0; i < 3; i++) {
      this.ridge(w, 420 + i * 30, 220 - i * 50, 11 + i * 7, .55);
      const g = ctx.createLinearGradient(0, 200, 0, 520); g.addColorStop(0, shade(cols[i], 1.12)); g.addColorStop(1, cols[i]);
      ctx.fillStyle = g; ctx.fill();
      // luz do sol nas encostas
      ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      glow(this.SUN.x * (w / W), this.SUN.y, 500, ['rgba(255,150,110,.18)', 'rgba(255,120,120,0)'], 260); ctx.restore();
      // névoa
      const m = ctx.createLinearGradient(0, 430 + i * 30, 0, 520 + i * 30); m.addColorStop(0, 'rgba(255,190,190,0)'); m.addColorStop(1, 'rgba(255,190,200,.35)');
      ctx.fillStyle = m; ctx.fillRect(0, 380, w, 200);
    }
  },
  tree(x, y, s, r) {
    // tronco
    ctx.strokeStyle = '#2a1a2c'; ctx.lineCap = 'round';
    const branch = (x0, y0, a, len, wdt, depth) => {
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - .5) * 12, (y0 + y1) / 2, x1, y1); ctx.stroke();
      if (depth > 0) { branch(x1, y1, a - .45 - r() * .3, len * .72, wdt * .65, depth - 1); branch(x1, y1, a + .4 + r() * .3, len * .7, wdt * .62, depth - 1); }
      else blossoms.push([x1, y1]);
    };
    const blossoms = [];
    branch(x, y, -Math.PI / 2 + (r() - .5) * .3, 70 * s, 14 * s, 3);
    for (const [bx, by] of blossoms) {
      for (let i = 0; i < 5; i++) {
        const cx = bx + (r() - .5) * 60 * s, cy = by + (r() - .5) * 40 * s, rr = (18 + r() * 20) * s;
        ctx.fillStyle = '#b84f86'; ctx.beginPath(); ctx.arc(cx, cy + 4, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f08cb4'; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, rr * .85, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd0e2'; ctx.beginPath(); ctx.arc(cx + 3, cy - 6, rr * .45, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  pagoda(x, y, s) {
    const roof = (cy, w) => {
      ctx.beginPath(); ctx.moveTo(x - w * 1.25, cy + 6 * s); ctx.quadraticCurveTo(x - w * .6, cy - 2 * s, x - w * .45, cy - 22 * s);
      ctx.lineTo(x + w * .45, cy - 22 * s); ctx.quadraticCurveTo(x + w * .6, cy - 2 * s, x + w * 1.25, cy + 6 * s); ctx.closePath();
      ctx.fillStyle = '#2c1c36'; ctx.fill();
      ctx.strokeStyle = '#ff9c7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * .45, cy - 22 * s); ctx.quadraticCurveTo(x + w * .6, cy - 2 * s, x + w * 1.25, cy + 6 * s); ctx.stroke();
    };
    let cy = y, w = 70 * s;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#6a2a3a'; ctx.fillRect(x - w * .55, cy - 34 * s, w * 1.1, 34 * s);
      ctx.fillStyle = 'rgba(255,190,120,.8)'; for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * w * .3 - 4 * s, cy - 26 * s, 8 * s, 14 * s);
      roof(cy - 34 * s, w); cy -= 52 * s; w *= .84;
    }
    ctx.strokeStyle = '#2c1c36'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(x, cy + 20 * s); ctx.lineTo(x, cy - 50 * s); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x, cy + 10 * s - i * 10 * s, 5 * s, 0, Math.PI * 2); ctx.stroke(); }
  },
  torii(x, y, s, col = '#c8283a') {
    const dark = shade(col, .55);
    ctx.fillStyle = col;
    ctx.fillRect(x - 110 * s, y - 250 * s, 20 * s, 250 * s); ctx.fillRect(x + 90 * s, y - 250 * s, 20 * s, 250 * s);
    ctx.fillStyle = dark; ctx.fillRect(x - 100 * s, y - 250 * s, 10 * s, 250 * s); ctx.fillRect(x + 100 * s, y - 250 * s, 10 * s, 250 * s);
    ctx.fillStyle = col; ctx.fillRect(x - 135 * s, y - 210 * s, 270 * s, 16 * s);
    ctx.beginPath(); ctx.moveTo(x - 170 * s, y - 262 * s); ctx.quadraticCurveTo(x, y - 250 * s, x + 170 * s, y - 262 * s); ctx.lineTo(x + 160 * s, y - 280 * s); ctx.quadraticCurveTo(x, y - 272 * s, x - 160 * s, y - 280 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1e1426'; ctx.beginPath(); ctx.moveTo(x - 175 * s, y - 280 * s); ctx.quadraticCurveTo(x, y - 268 * s, x + 175 * s, y - 280 * s); ctx.lineTo(x + 180 * s, y - 292 * s); ctx.quadraticCurveTo(x, y - 282 * s, x - 180 * s, y - 292 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - 22 * s, y - 250 * s, 44 * s, 40 * s);
    ctx.fillStyle = '#f0c060'; ctx.font = `${22 * s}px ${FONT_J}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('竜', x, y - 230 * s);
  },
  paintMid(w) {
    const r = mulberry32(21);
    // colina
    ctx.beginPath(); ctx.moveTo(0, 520);
    ctx.bezierCurveTo(w * .15, 430, w * .3, 380, w * .42, 400); ctx.bezierCurveTo(w * .55, 420, w * .7, 470, w, 450); ctx.lineTo(w, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, 380, 0, 560); g.addColorStop(0, '#4a2c56'); g.addColorStop(1, '#321e3e'); ctx.fillStyle = g; ctx.fill();
    this.pagoda(w * .32, 410, 1);
    for (let i = 0; i < 7; i++) this.tree(r() * w, 470 + r() * 50, .7 + r() * .35, r);
    // escadaria de pedra até o santuário
    ctx.fillStyle = 'rgba(255,190,170,.12)';
    for (let i = 0; i < 12; i++) ctx.fillRect(w * .32 - 40 - i * 6, 420 + i * 11, 80 + i * 12, 4);
  },
  lantern(x, y, s) {
    ctx.fillStyle = '#5a4a58'; ctx.fillRect(x - 8 * s, y - 70 * s, 16 * s, 70 * s);
    ctx.fillStyle = '#6c5c6a'; ctx.fillRect(x - 22 * s, y - 12 * s, 44 * s, 12 * s);
    ctx.fillRect(x - 18 * s, y - 100 * s, 36 * s, 32 * s);
    ctx.fillStyle = '#3a2c3a'; ctx.fillRect(x - 12 * s, y - 94 * s, 24 * s, 20 * s);
    ctx.beginPath(); ctx.moveTo(x - 32 * s, y - 100 * s); ctx.lineTo(x, y - 124 * s); ctx.lineTo(x + 32 * s, y - 100 * s); ctx.closePath(); ctx.fillStyle = '#4a3c4a'; ctx.fill();
    ctx.fillStyle = '#8a7a88'; ctx.fillRect(x - 32 * s, y - 102 * s, 64 * s, 4 * s);
  },
  paintNear(w) {
    const F = this.FLOOR;
    // muro de madeira ao fundo do pátio
    ctx.fillStyle = '#3a2434'; ctx.fillRect(0, F - 70, w, 70);
    ctx.fillStyle = '#5a3444'; for (let x = 0; x < w; x += 48) ctx.fillRect(x, F - 70, 6, 70);
    ctx.fillStyle = '#2a1826'; ctx.fillRect(0, F - 80, w, 12);
    ctx.fillStyle = 'rgba(255,170,130,.35)'; ctx.fillRect(0, F - 80, w, 2);
    // torii grande no centro do mundo
    this.torii(w / 2, F - 10, 1.35);
    for (const x of [260, 700, 1200, 1640]) this.lantern(x, F, 1);
    // chão de pedra com perspectiva
    const g = ctx.createLinearGradient(0, F, 0, H);
    g.addColorStop(0, '#9a6a7a'); g.addColorStop(.25, '#7a5064'); g.addColorStop(1, '#3a2438');
    ctx.fillStyle = g; ctx.fillRect(0, F, w, H - F);
    ctx.strokeStyle = 'rgba(40,20,40,.35)'; ctx.lineWidth = 1.5;
    let y = F + 6, step = 8; while (y < H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); step *= 1.35; y += step; }
    const vx = w / 2, vy = F - 300;
    for (let x = -1200; x < w + 1200; x += 110) { ctx.beginPath(); ctx.moveTo(lerp(vx, x, (F - vy) / (H - vy)), F); ctx.lineTo(x, H); ctx.stroke(); }
    // reflexo quente do pôr do sol no chão
    ctx.globalCompositeOperation = 'lighter';
    glow(w / 2 + 300, F + 30, 700, ['rgba(255,150,120,.22)', 'rgba(255,120,120,0)'], 80);
    ctx.globalCompositeOperation = 'source-over';
    const e = ctx.createLinearGradient(0, F, 0, F + 14); e.addColorStop(0, 'rgba(255,200,170,.4)'); e.addColorStop(1, 'rgba(255,200,170,0)');
    ctx.fillStyle = e; ctx.fillRect(0, F, w, 14);
  },

  newPetal(anywhere) {
    return { x: rand(-100, W + 100), y: anywhere ? rand(-50, H) : rand(-60, -10), vx: rand(-1.6, -.4), vy: rand(.6, 1.6), a: rand(0, 6), va: rand(-.08, .08), s: rand(3, 7), front: Math.random() < .3, ph: rand(0, 6) };
  },
  update() {
    for (const p of this.petals) {
      p.ph += .03; p.x += p.vx + Math.sin(p.ph) * .6; p.y += p.vy; p.a += p.va;
      if (p.y > H + 20 || p.x < -120) Object.assign(p, this.newPetal(false));
    }
  },
  drawPetals(front) {
    for (const p of this.petals) {
      if (p.front !== front) continue;
      const s = p.s * (front ? 1.7 : 1);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.abs(Math.sin(p.ph * 2)) * .7 + .3);
      ctx.fillStyle = front ? 'rgba(255,180,210,.9)' : 'rgba(255,200,220,.75)';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s, 0, 0, s); ctx.quadraticCurveTo(-s, 0, 0, -s); ctx.fill();
      ctx.restore();
    }
  },
  // desenha céu e camadas conforme a câmera
  drawBack(camX, t) {
    if (!this.layers) this.build();
    const L = this.layers, off = camX - W / 2;
    const blit = (l, k) => ctx.drawImage(l.c, -off * k, 0, l.w, l.h);
    blit(L.sky, 0);
    // raios de sol
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = 2.2 + i * .28 + Math.sin(t * .004 + i) * .05, len = 1100;
      ctx.fillStyle = `rgba(255,200,160,${.035 + Math.sin(t * .01 + i * 2) * .015})`;
      ctx.beginPath(); ctx.moveTo(this.SUN.x, this.SUN.y);
      ctx.lineTo(this.SUN.x + Math.cos(a - .05) * len, this.SUN.y + Math.sin(a - .05) * len);
      ctx.lineTo(this.SUN.x + Math.cos(a + .05) * len, this.SUN.y + Math.sin(a + .05) * len); ctx.fill();
    }
    ctx.restore();
    blit(L.far, this.PAR.far);
    blit(L.mid, this.PAR.mid);
    this.drawPetals(false);
    blit(L.near, 1);
    // chamas das lanternas
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const x of [260, 700, 1200, 1640]) { const fl = 1 + Math.sin(t * .3 + x) * .08 + Math.sin(t * .77 + x) * .05; glow(x - off, this.FLOOR - 84, 34 * fl, ['rgba(255,220,140,.9)', 'rgba(255,150,80,.4)', 'rgba(255,120,60,0)']); }
    ctx.restore();
  }
};
