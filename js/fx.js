'use strict';
/* ==========================================================================
   Efeitos: faíscas de impacto estilo mangá, brasas, rajadas de vento, poeira,
   imagens residuais, textos flutuantes e projéteis.
   ========================================================================== */
const FX = {
  parts: [], impacts: [], texts: [], ghosts: [], rings: [],
  clear() { this.parts.length = 0; this.impacts.length = 0; this.texts.length = 0; this.ghosts.length = 0; this.rings.length = 0; },

  hit(x, y, fx, heavy, blocked, dir, blade) {
    const col = blocked ? '#9fd8ff' : fx.main;
    this.impacts.push({ x, y, t: 0, max: heavy ? 14 : 10, r: (heavy ? 70 : 46) * (blocked ? .7 : 1), col, core: blocked ? '#ffffff' : fx.core, rot: rand(0, 6), blade: blade && !blocked, dir });
    this.rings.push({ x, y, t: 0, max: heavy ? 18 : 12, r0: 10, r1: heavy ? 120 : 70, col: blocked ? '#bfe6ff' : fx.light, w: heavy ? 6 : 3 });
    const n = blocked ? 8 : heavy ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + rand(-1.1, 1.1), sp = rand(6, heavy ? 20 : 13);
      this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(10, 18), max: 18, col: pick([fx.core, fx.light, fx.main]), w: rand(1.5, 3.5), drag: .86, grav: .25 });
    }
    if (!blocked && fx === CHARS[0].fx) for (let i = 0; i < (heavy ? 10 : 4); i++) this.ember(x, y, fx);
    if (!blocked && fx === CHARS[1].fx) for (let i = 0; i < (heavy ? 8 : 3); i++) this.windBit(x, y, dir);
  },
  ember(x, y, fx) {
    this.parts.push({ type: 'ember', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-1.5, 1.5), vy: rand(-3.5, -.8), life: rand(20, 40), max: 40, col: pick([fx.main, fx.light, fx.dark]), r: rand(5, 12), drag: .96, grav: -.05 });
  },
  windBit(x, y, dir) {
    this.parts.push({ type: 'wind', x, y, vx: dir * rand(4, 10), vy: rand(-3, 3), life: rand(14, 24), max: 24, r: rand(14, 30), a: rand(0, 6), col: '#e8f8ff', drag: .9, grav: 0 });
  },
  dust(x, y, vx, big = 1) {
    for (let i = 0; i < 8 * big; i++) this.parts.push({ type: 'smoke', x: x + rand(-25, 25), y: y - rand(0, 6), vx: rand(-2, 2) + vx * .2, vy: rand(-1.6, -.2), life: rand(18, 30), max: 30, r: rand(8, 16) * big, col: '#d8c8b8', drag: .92, grav: -.02 });
  },
  afterimage(f) {
    // silhueta translúcida do lutador (imagem residual)
    this.ghosts.push({ sk: JSON.parse(JSON.stringify(f.sk)), f, t: 0, max: 14 });
  },
  text(str, x, y, col, size = 34) { this.texts.push({ str, x, y, col, size, t: 0, max: 60 }); },

  update() {
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav; p.life--; if (p.type === 'wind') p.a += .2; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const a of [this.impacts, this.texts, this.ghosts, this.rings]) for (const i of a) i.t++;
    this.impacts = this.impacts.filter(i => i.t < i.max);
    this.texts = this.texts.filter(i => i.t < i.max);
    this.ghosts = this.ghosts.filter(i => i.t < i.max);
    this.rings = this.rings.filter(i => i.t < i.max);
  },

  drawGhosts() {
    for (const g of this.ghosts) {
      const k = 1 - g.t / g.max, fx = g.f.ch.fx, sk = g.sk;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .5;
      ctx.strokeStyle = fx.main; ctx.lineCap = 'round';
      const seg = (a, b, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      seg(sk.hip, sk.neck, 34); seg(sk.hipF, sk.kneeF, 22); seg(sk.kneeF, sk.ankF, 16); seg(sk.hipB, sk.kneeB, 22); seg(sk.kneeB, sk.ankB, 16);
      seg(sk.shF, sk.elbF, 16); seg(sk.elbF, sk.handF, 13); seg(sk.shB, sk.elbB, 16); seg(sk.elbB, sk.handB, 13);
      ctx.beginPath(); ctx.arc(sk.head.x, sk.head.y, 22, 0, Math.PI * 2); ctx.fillStyle = fx.main; ctx.fill();
      ctx.restore();
    }
  },

  draw() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.type === 'spark') {
        ctx.strokeStyle = p.col; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.lineWidth = p.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
      } else if (p.type === 'ember') {
        ctx.globalAlpha = k; glow(p.x, p.y, p.r * (.5 + k * .5), glowColor(p.col, 1));
      } else if (p.type === 'wind') {
        ctx.globalAlpha = k * .8; ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.a, p.a + 1.8); ctx.stroke();
      }
    }
    ctx.restore();
    for (const p of this.parts) if (p.type === 'smoke') {
      const k = p.life / p.max; ctx.globalAlpha = k * .35; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * .6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // anéis de choque
    for (const r of this.rings) {
      const k = r.t / r.max, rad = lerp(r.r0, r.r1, easeOut(k));
      ctx.strokeStyle = rgba(r.col, 1 - k); ctx.lineWidth = r.w * (1 - k) + .5;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // estrela de impacto (estilo mangá)
    for (const im of this.impacts) {
      const k = im.t / im.max, s = im.r * (k < .25 ? k / .25 : 1) * (1 + k * .2), a = 1 - Math.max(0, (k - .4) / .6);
      ctx.save(); ctx.translate(im.x, im.y); ctx.rotate(im.rot); ctx.globalAlpha = a;
      if (im.blade) {
        ctx.rotate(-im.rot + (im.dir > 0 ? -.5 : .5 + Math.PI));
        ctx.beginPath(); ctx.moveTo(-s * 1.6, 0); ctx.quadraticCurveTo(0, -s * .35, s * 1.6, 0); ctx.quadraticCurveTo(0, -s * .12, -s * 1.6, 0);
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = im.col; ctx.lineWidth = 3; ctx.stroke();
      }
      const n = 12; ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? s * .32 : s * (i % 4 ? .8 : 1.15); const aa = i / (n * 2) * Math.PI * 2; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      ctx.closePath(); ctx.fillStyle = im.core; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = im.col; ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const k = t.t / t.max, a = k < .8 ? 1 : 1 - (k - .8) / .2;
      ctx.globalAlpha = a; titleText(t.str, t.x, t.y - k * 30, t.size * (k < .1 ? .6 + k * 4 : 1), t.col, '#140a1e');
    }
    ctx.globalAlpha = 1;
  }
};

/* ---------- projéteis ---------- */
class Projectile {
  constructor(owner, type) {
    this.owner = owner; this.type = type; this.dir = owner.facing;
    this.x = owner.x + owner.facing * 95; this.y = owner.y - (type === 'fire' ? 222 : 200);
    this.vx = owner.facing * (type === 'fire' ? 10.5 : 13.5); this.t = 0; this.dead = false;
    this.mv = { dmg: type === 'fire' ? 80 : 70, stun: 20, bstun: 15, push: 6, special: true, heavy: true };
    this.fx = owner.ch.fx;
  }
  box() { return this.type === 'fire' ? { x: this.x - 30, y: this.y - 30, w: 60, h: 60 } : { x: this.x - 22, y: this.y - 60, w: 44, h: 120 }; }
  update() {
    this.x += this.vx; this.t++;
    if (this.x < -100 || this.x > WORLD_W + 100 || this.t > 200) this.dead = true;
    if (this.type === 'fire' && this.t % 2 === 0) FX.ember(this.x - this.dir * 20, this.y + rand(-12, 12), this.fx);
    if (this.type === 'wind' && this.t % 3 === 0) FX.windBit(this.x, this.y + rand(-50, 50), -this.dir * .3);
  }
  explode() {
    this.dead = true; FX.hit(this.x, this.y, this.fx, true, false, this.dir, false);
  }
  draw() {
    const fx = this.fx, x = this.x, y = this.y, d = this.dir, t = this.t;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (this.type === 'fire') {
      glow(x - d * 30, y, 90, glowColor(fx.main, .45), 60);
      // línguas de fogo para trás
      for (let i = 0; i < 6; i++) {
        const ph = t * .5 + i * 1.3, len = 60 + Math.sin(ph) * 15, off = (i - 2.5) * 7;
        ctx.beginPath(); ctx.moveTo(x + d * 18, y + off - 16); ctx.quadraticCurveTo(x - d * len * .5, y + off + Math.sin(ph * 1.3) * 10, x - d * len, y + off * 1.6);
        ctx.quadraticCurveTo(x - d * len * .4, y + off + 8, x + d * 18, y + off + 16);
        ctx.fillStyle = rgba(i % 2 ? fx.main : fx.dark, .5); ctx.fill();
      }
      glow(x, y, 42, [rgba(fx.core, 1), rgba(fx.light, .9), rgba(fx.main, .5), rgba(fx.main, 0)]);
      glow(x + d * 4, y, 16, [rgba('#ffffff', 1), rgba(fx.core, 0)]);
    } else {
      // lua crescente de vento
      glow(x, y, 70, glowColor(fx.main, .35), 90);
      for (let i = 0; i < 3; i++) {
        const s = 1 - i * .22, ox = -d * i * 22;
        ctx.beginPath();
        ctx.moveTo(x + ox, y - 70 * s);
        ctx.quadraticCurveTo(x + ox + d * 52 * s, y, x + ox, y + 70 * s);
        ctx.quadraticCurveTo(x + ox + d * 22 * s, y, x + ox, y - 70 * s);
        ctx.fillStyle = i === 0 ? rgba(fx.core, .95) : rgba(fx.light, .45 - i * .1); ctx.fill();
      }
      ctx.strokeStyle = rgba(fx.main, .8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 72); ctx.quadraticCurveTo(x + d * 54, y, x, y + 72); ctx.stroke();
    }
    ctx.restore();
  }
}
