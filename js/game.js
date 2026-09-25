'use strict';
/* ==========================================================================
   Jogo: estados (título, seleção, round, luta, K.O., resultado, pausa),
   resolução de acertos, câmera, HUD, telas e laço principal a 60 fps.
   ========================================================================== */
const NullCtrl = { cpu: false, update() {}, held() { return false; }, pressed() { return false; } };

const Game = {
  state: 'title', stateT: 0, t: 0, mode: 'cpu', cpuLevel: 1,
  menuSel: 0, pauseSel: 0, resultSel: 0,
  sel: [0, 1], selStep: [0, 0], // 0 = escolhendo, 1 = pronto
  f: [], projectiles: [], round: 1, timer: ROUND_TIME, timerF: 0,
  hitstop: 0, shake: 0, slowmo: 0, flash: 0, flashCol: '#fff',
  cam: { x: WORLD_W / 2, z: 1 }, cutin: null, banner: null, combo: [0, 0], comboT: [0, 0], winner: null, notice: null,
  showcase: null, previews: null,

  init() {
    this.showcase = [new Fighter(0, CHARS[0], NullCtrl, false), new Fighter(1, CHARS[1], NullCtrl, false)];
    this.showcase[0].x = WORLD_W / 2 - 300; this.showcase[1].x = WORLD_W / 2 + 300;
    this.previews = CHARS.map((c, i) => [new Fighter(0, c, NullCtrl, false), new Fighter(1, c, NullCtrl, true)]);
  },
  setState(s) { this.state = s; this.stateT = 0; },

  /* ---------- partida ---------- */
  startMatch() {
    const [a, b] = this.sel;
    this.f = [new Fighter(0, CHARS[a], new HumanCtrl(0), false),
              new Fighter(1, CHARS[b], this.mode === 'cpu' ? new CpuCtrl(this.cpuLevel) : new HumanCtrl(1), a === b)];
    this.round = 1; this.startRound();
  },
  startRound() {
    this.f[0].reset(WORLD_W / 2 - 230, 1); this.f[1].reset(WORLD_W / 2 + 230, -1);
    this.projectiles = []; FX.clear(); this.timer = ROUND_TIME; this.timerF = 0; this.combo = [0, 0]; this.comboT = [0, 0];
    this.cam.x = WORLD_W / 2; this.cutin = null; this.winner = null; this.slowmo = 0;
    this.setState('intro');
  },
  startCutin(f) { this.cutin = { f, t: 0, dur: 66 }; Audio2.play('super'); Audio2.voice(f.ch.fem, true); },
  banner_(text, col, size = 120, dur = 70) { this.banner = { text, col, size, t: 0, dur }; },

  /* ---------- acertos ---------- */
  resolveHits() {
    for (let i = 0; i < 2; i++) {
      const a = this.f[i], d = this.f[1 - i];
      if (a.state !== 'attack' || a.phase !== 'active' || !a.move.hit) continue;
      const mv = a.move, multi = mv.multi || 1, interval = Math.max(4, Math.floor(mv.active / multi));
      if (a.hitCount >= multi || a.mf - a.lastHitF < interval) continue;
      const hb = a.hitboxWorld(mv), hu = d.hurtbox(); if (!hu || !overlap(hb, hu)) continue;
      a.lastHitF = a.mf; a.hitCount++; a.moveConnected = true;
      // o super reinicia a janela ativa no primeiro acerto para completar a sequência
      if (mv.stopOnHit && a.hitCount === 1) { a.mf = mv.startup + 1; a.lastHitF = a.mf; }
      this.applyHit(a, d, mv, mv.multi ? a.hitCount === multi : true, this.contact(hb, hu), null);
      if (this.state !== 'fight') return;
    }
    for (const p of this.projectiles) {
      if (p.dead) continue;
      for (const q of this.projectiles) if (q !== p && !q.dead && q.owner !== p.owner && overlap(p.box(), q.box())) { p.explode(); q.explode(); Audio2.play('hitH'); }
      if (p.dead) continue;
      const d = this.f[1 - p.owner.idx], hu = d.hurtbox();
      if (hu && overlap(p.box(), hu)) { this.applyHit(p.owner, d, p.mv, true, this.contact(p.box(), hu), p); p.explode(); if (this.state !== 'fight') return; }
    }
  },
  contact(a, b) {
    return { x: (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y: (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 };
  },
  applyHit(a, d, mv, final, pt, proj) {
    const down = d.ctrl.held('down');
    const levelOk = !(mv.low && !down) && !(mv.overhead && down);
    const blocked = d.canBlock() && d.guarding && levelOk;
    const dir = proj ? proj.dir : a.facing;
    if (blocked) {
      d.takeBlock(a, mv);
      if (mv.special) d.hp = Math.max(1, d.hp - mv.dmg * (mv.super ? .25 : .12));
      a.energy = Math.min(100, a.energy + 3); d.energy = Math.min(100, d.energy + 5);
      FX.hit(pt.x, pt.y, a.ch.fx, !!mv.heavy, true, dir, false); Audio2.play('block');
      this.hitstop = Math.max(this.hitstop, 5); d.flashT = 0;
      if ((d.x <= WALL_L + 5 || d.x >= WALL_R - 5) && a.grounded && !proj) a.vx = -a.facing * (mv.push || 4) * .9;
      return;
    }
    const wasHurt = ['hitstun', 'launch'].includes(d.state);
    this.combo[a.idx] = wasHurt ? this.combo[a.idx] + 1 : 1; this.comboT[a.idx] = 70;
    const scale = Math.max(.45, 1 - .1 * (this.combo[a.idx] - 1));
    const dmg = Math.round((final && mv.finalDmg ? mv.finalDmg : mv.dmg) * scale);
    d.takeHit(a, mv, dmg, final);
    d.flashT = 6;
    a.energy = Math.min(100, a.energy + dmg * .11 + 2); d.energy = Math.min(100, d.energy + dmg * .07);
    const heavy = !!mv.heavy, big = final && (mv.finalLaunch || mv.super);
    FX.hit(pt.x, pt.y, a.ch.fx, heavy, false, dir, !!mv.blade || (proj && proj.type === 'wind'));
    Audio2.play(mv.sfx || 'hitH'); Audio2.voice(d.ch.fem, heavy);
    this.hitstop = Math.max(this.hitstop, big ? 18 : heavy ? 9 : 6);
    this.shake = Math.max(this.shake, big ? 16 : heavy ? 8 : 3);
    if (big) { this.flash = 8; this.flashCol = a.ch.fx.light; }
    if (d.hp <= 0) this.onKO(a, d);
  },
  onKO(a, d) {
    this.winner = a; a.wins++;
    this.setState('ko'); this.slowmo = 80; this.flash = 12; this.flashCol = '#ffffff'; this.shake = 20;
    Audio2.play('ko'); this.banner_('K.O.', '#ff3a4a', 190, 120);
  },
  timeOver() {
    const [a, b] = this.f, ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    this.winner = ra > rb ? a : rb > ra ? b : null;
    if (this.winner) this.winner.wins++;
    this.setState('ko'); this.banner_('TEMPO!', '#ffd24a', 150, 110);
  },

  /* ---------- atualização por estado ---------- */
  update() {
    this.t++; this.stateT++;
    Input.pollPads();
    Stage.update();
    switch (this.state) {
      case 'title': this.updateTitle(); break;
      case 'controls': if (Input.menu('back') || Input.menu('ok')) { Audio2.play('select'); this.setState('title'); } this.idleShowcase(); break;
      case 'select': this.updateSelect(); break;
      case 'intro': case 'fight': case 'ko': case 'roundEnd': this.updateMatch(); break;
      case 'pause': this.updatePause(); break;
      case 'result': this.updateResult(); break;
    }
    if (this.banner && ++this.banner.t > this.banner.dur) this.banner = null;
    if (this.notice && --this.notice.t <= 0) this.notice = null;
    Input.endFrame();
  },
  idleShowcase() { for (const f of this.showcase) { f.t++; f.updateLook(null); } FX.update(); },

  updateTitle() {
    this.idleShowcase();
    const items = 4;
    if (Input.menu('up')) { this.menuSel = (this.menuSel + items - 1) % items; Audio2.play('select'); }
    if (Input.menu('down')) { this.menuSel = (this.menuSel + 1) % items; Audio2.play('select'); }
    if (Input.menu('ok')) {
      if (this.menuSel === 0 || this.menuSel === 1) {
        Audio2.play('confirm'); this.mode = this.menuSel === 0 ? 'cpu' : '2p';
        this.selStep = [0, 0]; this.sel = [0, 1]; this.setState('select');
      } else if (this.menuSel === 2) { Audio2.play('block'); this.notice = { text: 'O modo história está sendo escrito. Chega na próxima versão!', t: 150 }; }
      else { Audio2.play('confirm'); this.setState('controls'); }
    }
  },

  updateSelect() {
    for (const p of this.previews.flat()) { p.t++; p.updateLook(null); }
    const n = CHARS.length, cpu = this.mode === 'cpu';
    // no modo CPU o J1 escolhe o próprio lutador e depois o adversário
    const cursorOwner = cpu ? (this.selStep[0] === 0 ? 0 : 1) : null;
    const handle = (slot, keys) => {
      if (this.selStep[slot] === 1) { if (Input.hit(keys.back)) { this.selStep[slot] = 0; Audio2.play('select'); } return; }
      if (Input.hit(keys.left) || Input.hit(keys.right)) { this.sel[slot] = (this.sel[slot] + 1) % n; Audio2.play('select'); }
      if (Input.hit(keys.ok)) { this.selStep[slot] = 1; Audio2.play('confirm'); Audio2.voice(CHARS[this.sel[slot]].fem, true); }
    };
    const k1 = { left: ['KeyA', 'Pad0:left'], right: ['KeyD', 'Pad0:right'], ok: ['KeyG', 'Enter', 'Space', 'Pad0:a'], back: ['KeyH', 'Escape', 'Pad0:b'] };
    const k2 = { left: ['ArrowLeft', 'Pad1:left'], right: ['ArrowRight', 'Pad1:right'], ok: ['KeyL', 'Numpad1', 'Pad1:a'], back: ['KeyK', 'Numpad2', 'Pad1:b'] };
    if (cpu) {
      const kk = { left: [...k1.left, ...k2.left], right: [...k1.right, ...k2.right], ok: [...k1.ok, ...k2.ok], back: [...k1.back] };
      if (cursorOwner === 0) handle(0, kk);
      else {
        if (this.selStep[1] === 0 && Input.hit(kk.back)) { this.selStep[0] = 0; Audio2.play('select'); return; }
        else handle(1, { ...kk, back: [] });
        if (Input.menu('up')) { this.cpuLevel = Math.min(2, this.cpuLevel + 1); Audio2.play('select'); }
        if (Input.menu('down')) { this.cpuLevel = Math.max(0, this.cpuLevel - 1); Audio2.play('select'); }
      }
    } else { handle(0, k1); handle(1, k2); }
    if (this.selStep[0] === 0 && this.selStep[1] === 0 && Input.hit(['Escape']) && this.stateT > 5) { this.setState('title'); return; }
    if (this.selStep[0] === 1 && this.selStep[1] === 1) { if (!this.readyT) this.readyT = 40; if (--this.readyT <= 0) { this.readyT = 0; this.startMatch(); } }
    else this.readyT = 0;
  },

  updateMatch() {
    const [a, b] = this.f;
    if (this.state === 'fight' && Input.menu('pause')) { this.pauseSel = 0; this.pausedFrom = 'fight'; this.setState('pause'); Audio2.play('select'); return; }
    if (this.state === 'intro') {
      if (this.stateT === 12) { this.banner_(`ROUND ${this.round}`, '#ffffff', 120, 55); Audio2.play('round'); }
      if (this.stateT === 72) { this.banner_('LUTEM!', '#ffd24a', 150, 45); Audio2.play('fight'); }
      if (this.stateT >= 92) this.state = 'fight';
    }
    if (this.cutin) { if (++this.cutin.t >= this.cutin.dur) this.cutin = null; FX.update(); return; }
    if (this.hitstop > 0) { this.hitstop--; this.shake *= .9; return; }
    if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 3 !== 0) { FX.update(); return; } }

    const px = [a.x, b.x];
    a.update(b); b.update(a);
    for (const p of this.projectiles) p.update();
    // limite de distância (os dois sempre cabem na tela)
    const MAX = W - 150;
    if (Math.abs(a.x - b.x) > MAX) for (const [f, o, i] of [[a, b, 0], [b, a, 1]]) {
      const s = Math.sign(f.x - o.x); if (Math.sign(f.x - px[i]) === s) f.x = o.x + s * MAX;
    }
    this.pushApart(a, b);
    for (const f of this.f) { const o = this.f[1 - f.idx]; if (f.grounded && ['idle', 'walk', 'crouch'].includes(f.state)) f.facing = o.x >= f.x ? 1 : -1; }
    if (this.state === 'fight') this.resolveHits();
    this.projectiles = this.projectiles.filter(p => !p.dead);
    FX.update();
    for (let i = 0; i < 2; i++) { if (this.comboT[i] > 0 && --this.comboT[i] === 0) this.combo[i] = 0; }
    for (const f of this.f) f.dispHp = f.dispHp > f.hp ? Math.max(f.hp, f.dispHp - 4) : f.hp;

    if (this.state === 'fight' && ++this.timerF >= 60) { this.timerF = 0; if (--this.timer <= 0) { this.timer = 0; this.timeOver(); } }
    if (this.state === 'ko' && this.stateT > 150) {
      const w = this.winner; if (w && w.hp > 0) { w.state = 'win'; w.move = null; }
      this.setState('roundEnd');
      if (w) this.banner_(`${w.ch.name} VENCE`, w.ch.fx.light, 96, 110); else this.banner_('EMPATE', '#ffffff', 110, 110);
    }
    if (this.state === 'roundEnd' && this.stateT > 120) {
      if (this.f.some(f => f.wins >= WINS_NEEDED) || this.round >= 5) { this.resultSel = 0; this.setState('result'); }
      else { this.round++; this.startRound(); }
    }
    this.updateCamera();
  },
  pushApart(a, b) {
    const noPush = f => (f.state === 'attack' && f.move.pass && f.phase === 'active') || ['down', 'ko', 'launch'].includes(f.state);
    if (noPush(a) || noPush(b)) return;
    if (Math.abs(a.y - b.y) > 170) return;
    const dx = b.x - a.x, min = 84;
    if (Math.abs(dx) >= min) return;
    const s = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx), push = (min - Math.abs(dx)) / 2;
    a.x -= s * push; b.x += s * push;
    for (const [f, o] of [[a, b], [b, a]]) if (f.x < WALL_L || f.x > WALL_R) { const c = clamp(f.x, WALL_L, WALL_R); o.x += (c - f.x) * (o === b ? 1 : 1); f.x = c; }
  },
  updateCamera() {
    const [a, b] = this.f, mid = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
    this.cam.x = lerp(this.cam.x, clamp(mid, W / 2, WORLD_W - W / 2), .12);
    this.cam.z = lerp(this.cam.z, clamp(1.12 - dist / 2600, 1, 1.1), .05);
  },

  updatePause() {
    const items = 3;
    if (Input.menu('up')) { this.pauseSel = (this.pauseSel + items - 1) % items; Audio2.play('select'); }
    if (Input.menu('down')) { this.pauseSel = (this.pauseSel + 1) % items; Audio2.play('select'); }
    if (Input.menu('pause') && this.stateT > 2) { this.state = this.pausedFrom; return; }
    if (Input.menu('ok')) {
      Audio2.play('confirm');
      if (this.pauseSel === 0) this.state = this.pausedFrom;
      else if (this.pauseSel === 1) { this.f.forEach(f => { f.wins = 0; f.energy = 0; }); this.round = 1; this.startRound(); }
      else this.setState('title');
    }
  },
  updateResult() {
    for (const f of this.f) { f.t++; f.updateLook(this.f[1 - f.idx]); }
    FX.update(); this.updateCamera();
    const items = 3;
    if (Input.menu('up')) { this.resultSel = (this.resultSel + items - 1) % items; Audio2.play('select'); }
    if (Input.menu('down')) { this.resultSel = (this.resultSel + 1) % items; Audio2.play('select'); }
    if (Input.menu('ok') && this.stateT > 20) {
      Audio2.play('confirm');
      if (this.resultSel === 0) this.startMatch();
      else if (this.resultSel === 1) { this.selStep = [0, 0]; this.setState('select'); }
      else this.setState('title');
    }
  },

  /* ======================= DESENHO ======================= */
  draw() {
    fitCanvas();
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = this.state;
    if (s === 'title' || s === 'controls') this.drawTitle();
    else if (s === 'select') this.drawSelect();
    else this.drawMatch();
    if (this.notice) {
      const a = Math.min(1, this.notice.t / 20);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,6,20,.85)'; ctx.fillRect(W / 2 - 330, H - 120, 660, 50);
      uiText(this.notice.text, W / 2, H - 95, 22, '#ffe6f0', 'center'); ctx.globalAlpha = 1;
    }
  },

  worldBegin(camX, z) {
    const sx = (Math.random() - .5) * this.shake, sy = (Math.random() - .5) * this.shake;
    this.shake *= .88; if (this.shake < .3) this.shake = 0;
    ctx.save();
    ctx.translate(W / 2 + sx, 600 + sy); ctx.scale(z, z); ctx.translate(-W / 2, -600);
    Stage.drawBack(camX, this.t);
    ctx.translate(-(camX - W / 2), 0);
  },
  worldEnd() { ctx.restore(); },

  drawMatch() {
    const [a, b] = this.f;
    this.worldBegin(this.cam.x, this.cam.z);
    FX.drawGhosts();
    // quem está atacando fica na frente
    const order = (a.state === 'attack' && b.state !== 'attack') ? [b, a] : [a, b];
    for (const f of order) drawFighter(f);
    for (const p of this.projectiles) p.draw();
    FX.draw();
    this.worldEnd();
    Stage.drawPetals(true);
    if (this.slowmo > 0 || (this.cutin && this.cutin.t < this.cutin.dur)) this.speedLines(this.slowmo > 0 ? .6 : .4);
    if (this.flash > 0) { ctx.fillStyle = rgba(this.flashCol, this.flash / 14); ctx.fillRect(0, 0, W, H); this.flash--; }
    this.drawVignette();
    if (this.state !== 'result') this.drawHUD();
    if (this.cutin) this.drawCutin();
    this.drawBanner();
    if (this.state === 'pause') this.drawMenuBox('PAUSA', ['CONTINUAR', 'REINICIAR PARTIDA', 'MENU PRINCIPAL'], this.pauseSel);
    if (this.state === 'result') this.drawResult();
  },

  drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    g.addColorStop(0, 'rgba(20,6,30,0)'); g.addColorStop(1, 'rgba(20,6,30,.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  speedLines(alpha) {
    const r = mulberry32((this.t / 2) | 0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, r0 = 330 + r() * 160, r1 = 900, w = .004 + r() * .01;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0);
      ctx.lineTo(W / 2 + Math.cos(a - w) * r1, H / 2 + Math.sin(a - w) * r1);
      ctx.lineTo(W / 2 + Math.cos(a + w) * r1, H / 2 + Math.sin(a + w) * r1); ctx.fill();
    }
    ctx.restore();
  },

  /* ---------- HUD ---------- */
  drawPortrait(f, x, y, r, mirror) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, f.ch.fx.dark); g.addColorStop(1, '#140a1e');
    ctx.fillStyle = g; ctx.fill(); ctx.clip();
    ctx.translate(x + (mirror ? 4 : -4), y + r * .18); const k = r / 26; ctx.scale(k * (mirror ? -1 : 1), k);
    this.portraitHead(f);
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a0e24'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = f.ch.fx.light; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, Math.PI * 2); ctx.stroke();
  },
  portraitHead(f, expr) {
    const C = f.C, look = f.ch.look, oldE = f.expr; if (expr) f.expr = expr;
    // ombros
    ctx.beginPath(); ctx.moveTo(-40, 60); ctx.quadraticCurveTo(-30, 26, -4, 24); ctx.quadraticCurveTo(24, 26, 34, 60); ctx.closePath();
    ctx.fillStyle = C.coat; ctx.fill(); ctx.strokeStyle = shade(C.coat, .35); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 24); ctx.lineTo(4, 44); ctx.lineTo(12, 26); ctx.closePath(); ctx.fillStyle = C.shirt; ctx.fill();
    ctx.fillStyle = shade(C.skin, .85); ctx.fillRect(-7, 12, 13, 16);
    if (look.hair === 'ponytail') {
      ctx.beginPath(); ctx.moveTo(-14, -22); ctx.bezierCurveTo(-40, -20, -40, 20, -30, 60); ctx.lineTo(-20, 58); ctx.bezierCurveTo(-26, 20, -22, -6, -10, -12); ctx.closePath();
      ctx.fillStyle = hairGrad(C, -20, 60); ctx.fill(); ctx.strokeStyle = shade(C.hair, .5); ctx.stroke();
    }
    if (look.headband) { ctx.fillStyle = C.band; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-38, 4); ctx.lineTo(-34, 8); ctx.lineTo(-18, -5); ctx.fill(); }
    drawHeadLocal(f, null);
    if (look.hair === 'spiky') drawSpikyHair(f); else drawPonytailHair(f);
    if (look.headband) drawHeadband(f);
    f.expr = oldE;
  },
  drawHUD() {
    const T = this.t;
    for (let i = 0; i < 2; i++) {
      const f = this.f[i], m = i === 1, sx = x => m ? W - x : x;
      // barra de vida inclinada
      const x0 = 118, x1 = 560, y0 = 36, h = 30, sl = 14;
      const bar = (from, to, fill) => {
        const a = x0 + (x1 - x0) * from, b = x0 + (x1 - x0) * to;
        ctx.beginPath(); ctx.moveTo(sx(a), y0); ctx.lineTo(sx(b + sl), y0); ctx.lineTo(sx(b), y0 + h); ctx.lineTo(sx(a - sl), y0 + h); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      };
      bar(0, 1, '#1a0e24');
      const hp = f.hp / f.maxHp, dh = f.dispHp / f.maxHp;
      // a vida some a partir do centro da tela (lado de dentro)
      const inner = (v) => [1 - v, 1];
      const [da, db] = inner(dh); bar(da, db, '#e8e0ff');
      const [ha, hb] = inner(hp);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
      if (hp < .3 && T % 30 < 15) { g.addColorStop(0, '#ff8a8a'); g.addColorStop(1, '#c21a2a'); }
      else { g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ffc53a'); g.addColorStop(1, '#ff7a1a'); }
      if (hp > 0) bar(ha, hb, g);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(Math.min(sx(x0), sx(x1)), y0 + 3, x1 - x0, 3);
      ctx.beginPath(); ctx.moveTo(sx(x0), y0); ctx.lineTo(sx(x1 + sl), y0); ctx.lineTo(sx(x1), y0 + h); ctx.lineTo(sx(x0 - sl), y0 + h); ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = '#f6eaff'; ctx.stroke();
      this.drawPortrait(f, sx(62), 58, 46, m);
      // nome e vitórias
      titleText(f.ch.name, sx(128), 88, 30, '#ffffff', '#140a1e', m ? 'right' : 'left');
      uiText(f.ctrl.cpu ? `CPU · ${CPU_LEVELS[this.cpuLevel].name}` : `J${i + 1}`, sx(128 + ctx.measureText(f.ch.name).width + 18), 90, 18, f.ch.fx.light, m ? 'right' : 'left', 700);
      for (let k = 0; k < WINS_NEEDED; k++) {
        const cx = sx(540 - k * 26), cy = 90; ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx - 8, cy); ctx.closePath();
        ctx.fillStyle = k < f.wins ? f.ch.fx.main : '#241634'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f6eaff'; ctx.stroke();
      }
      // energia (super)
      const ex = 40, ew = 330, ey = H - 46, full = f.energy >= 100;
      ctx.save(); ctx.translate(sx(ex), ey); if (m) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(20,10,30,.8)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ew + 12, 0); ctx.lineTo(ew, 18); ctx.lineTo(-12, 18); ctx.closePath(); ctx.fill();
      const eg = ctx.createLinearGradient(0, 0, ew, 0); eg.addColorStop(0, f.ch.fx.dark); eg.addColorStop(1, full ? f.ch.fx.core : f.ch.fx.main);
      ctx.fillStyle = eg; const w = ew * f.energy / 100; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(w + 10, 2); ctx.lineTo(w, 16); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
      for (let s = 1; s < 4; s++) { ctx.fillStyle = 'rgba(20,10,30,.8)'; ctx.fillRect(ew * s / 4, 0, 3, 18); }
      ctx.strokeStyle = full ? f.ch.fx.core : '#b8a8d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ew + 12, 0); ctx.lineTo(ew, 18); ctx.lineTo(-12, 18); ctx.closePath(); ctx.stroke();
      ctx.restore();
      if (full) { ctx.globalAlpha = .7 + Math.sin(T * .25) * .3; titleText('SUPER PRONTO!  ↓ + ESPECIAL', sx(ex + 4), ey - 18, 24, f.ch.fx.light, '#140a1e', m ? 'right' : 'left'); ctx.globalAlpha = 1; }
      else uiText('ENERGIA', sx(ex + 4), ey - 12, 16, '#d8c8f0', m ? 'right' : 'left', 700);
      // combo
      if (this.combo[i] >= 2 && this.comboT[i] > 0) {
        const k = Math.min(1, (70 - this.comboT[i]) / 6);
        titleText(`${this.combo[i]}`, sx(90), 250, 70 * (1.4 - k * .4), f.ch.fx.light, '#140a1e', m ? 'right' : 'left');
        titleText('ACERTOS', sx(90), 300, 30, '#ffffff', '#140a1e', m ? 'right' : 'left');
      }
    }
    // relógio
    ctx.save(); ctx.translate(W / 2, 64);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); } ctx.closePath();
    ctx.fillStyle = '#1a0e24'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6eaff'; ctx.stroke(); ctx.restore();
    titleText(String(this.timer).padStart(2, '0'), W / 2, 66, 50, this.timer <= 10 ? '#ff5a5a' : '#ffffff');
    uiText(`ROUND ${this.round}`, W / 2, 124, 17, '#e8d8ff', 'center', 700);
  },
  drawBanner() {
    const b = this.banner; if (!b) return;
    const k = b.t / b.dur, inK = Math.min(1, b.t / 8), out = k > .85 ? 1 - (k - .85) / .15 : 1;
    ctx.save(); ctx.globalAlpha = out;
    // faixa diagonal de fundo
    ctx.fillStyle = 'rgba(10,4,18,.55)'; ctx.beginPath(); ctx.moveTo(0, H / 2 - 70 * inK); ctx.lineTo(W, H / 2 - 90 * inK); ctx.lineTo(W, H / 2 + 60 * inK); ctx.lineTo(0, H / 2 + 80 * inK); ctx.closePath(); ctx.fill();
    ctx.translate(W / 2, H / 2); ctx.rotate(-.03); const s = 1.6 - easeOut(b.t / 8) * .6; ctx.scale(s, s);
    titleText(b.text, 0, 0, b.size, b.col, '#140a1e');
    ctx.restore();
  },
  drawCutin() {
    const c = this.cutin, f = c.f, k = c.t / c.dur, fx = f.ch.fx, dir = f.idx === 0 ? 1 : -1;
    const inK = easeOut(c.t / 10), outK = k > .85 ? (k - .85) / .15 : 0;
    ctx.save();
    ctx.fillStyle = `rgba(8,2,16,${.55 * (1 - outK)})`; ctx.fillRect(0, 0, W, H);
    // faixa diagonal com o retrato
    const y0 = 190, y1 = 480, slant = 60;
    ctx.save(); ctx.globalAlpha = 1 - outK;
    ctx.beginPath(); ctx.moveTo(0, y0 + slant); ctx.lineTo(W * inK, y0 - slant * inK + slant); ctx.lineTo(W * inK, y1 - slant * inK); ctx.lineTo(0, y1); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, fx.dark); g.addColorStop(.5, fx.main); g.addColorStop(1, fx.dark);
    ctx.fillStyle = g; ctx.fill(); ctx.save(); ctx.clip();
    // linhas de velocidade horizontais
    const r = mulberry32(c.t);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, y0 - 60 + r() * (y1 - y0 + 60), 80 + r() * 300, 1 + r() * 3);
    ctx.globalAlpha = .18; ctx.font = `300px ${FONT_J}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText(f.ch.kanji, W * .72, (y0 + y1) / 2 + 10); ctx.globalAlpha = 1 - outK;
    ctx.translate(dir > 0 ? 330 - (1 - inK) * 300 : W - 330 + (1 - inK) * 300, (y0 + y1) / 2 + 20); ctx.scale(6.5 * dir, 6.5);
    this.portraitHead(f, 'shout');
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = fx.core; ctx.beginPath(); ctx.moveTo(0, y0 + slant); ctx.lineTo(W * inK, y0 - slant * inK + slant); ctx.moveTo(0, y1); ctx.lineTo(W * inK, y1 - slant * inK); ctx.stroke();
    ctx.restore();
    const tx = dir > 0 ? W - 60 : 60, ta = dir > 0 ? 'right' : 'left';
    ctx.globalAlpha = 1 - outK;
    titleText(f.ch.superName, tx + (1 - inK) * 200 * dir, 400, 72, fx.core, '#140a1e', ta);
    titleText('SUPER', tx + (1 - inK) * 300 * dir, 320, 40, fx.light, '#140a1e', ta);
    ctx.restore();
  },
  drawMenuBox(title, items, sel, y = H / 2 - 40) {
    ctx.fillStyle = 'rgba(8,4,16,.72)'; ctx.fillRect(0, 0, W, H);
    titleText(title, W / 2, y - 90, 80, '#ffffff');
    items.forEach((it, i) => {
      const yy = y + i * 58, on = i === sel;
      if (on) { ctx.fillStyle = 'rgba(255,120,140,.25)'; ctx.fillRect(W / 2 - 240, yy - 24, 480, 48); ctx.fillStyle = '#ff8aa0'; ctx.fillRect(W / 2 - 240, yy - 24, 6, 48); }
      titleText(it, W / 2, yy, on ? 40 : 34, on ? '#ffe070' : '#d8c8ec');
    });
  },
  drawResult() {
    const w = this.f.find(f => f.wins >= WINS_NEEDED) || this.winner;
    ctx.fillStyle = 'rgba(8,4,16,.55)'; ctx.fillRect(0, 0, W, H);
    if (w) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 120, W, 300); ctx.clip();
      ctx.fillStyle = rgba(w.ch.fx.dark, .8); ctx.fillRect(0, 120, W, 300);
      ctx.translate(300, 300); ctx.scale(6, 6); this.portraitHead(w); ctx.restore();
      titleText(`${w.ch.name} VENCE!`, 820, 220, 90, w.ch.fx.light);
      uiText(`“${w.ch.quote}”`, 820, 300, 30, '#ffffff', 'center', 600);
      uiText(w.ctrl.cpu ? 'A CPU levou a melhor. Tente de novo!' : `Jogador ${w.idx + 1} ganhou a partida`, 820, 350, 22, '#e8d8ff', 'center', 600);
    } else titleText('EMPATE!', W / 2, 260, 100, '#ffffff');
    const items = ['REVANCHE', 'TROCAR LUTADORES', 'MENU PRINCIPAL'];
    items.forEach((it, i) => { const on = i === this.resultSel; titleText(it, W / 2, 500 + i * 56, on ? 40 : 32, on ? '#ffe070' : '#d8c8ec'); });
  },

  /* ---------- telas ---------- */
  drawTitle() {
    const camX = WORLD_W / 2 + Math.sin(this.t * .003) * 200;
    this.worldBegin(camX, 1);
    for (const f of this.showcase) drawFighter(f);
    this.worldEnd();
    Stage.drawPetals(true);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(12,6,24,.65)'); g.addColorStop(.5, 'rgba(12,6,24,.15)'); g.addColorStop(1, 'rgba(12,6,24,.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    this.drawVignette();
    if (this.state === 'controls') { this.drawControls(); return; }
    // logotipo
    ctx.save(); ctx.translate(W / 2, 150); ctx.rotate(-.04);
    ctx.globalAlpha = .35; ctx.font = `150px ${FONT_J}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ff6a8a'; ctx.fillText('神闘', 0, -6); ctx.globalAlpha = 1;
    ctx.font = `120px ${FONT_T}`; ctx.lineWidth = 16; ctx.strokeStyle = '#140a1e'; ctx.lineJoin = 'round'; ctx.strokeText('DUELO DIVINO', 0, 0);
    const lg = ctx.createLinearGradient(0, -50, 0, 50); lg.addColorStop(0, '#fff6d0'); lg.addColorStop(.5, '#ffb04a'); lg.addColorStop(1, '#ff3a5a');
    ctx.fillStyle = lg; ctx.fillText('DUELO DIVINO', 0, 0);
    ctx.restore();
    uiText('Os irmãos do Santuário do Mestre Lagarto', W / 2, 232, 24, '#ffe0ec', 'center', 600);
    const items = ['1 JOGADOR  ·  CONTRA A CPU', '2 JOGADORES', 'MODO HISTÓRIA', 'CONTROLES'];
    items.forEach((it, i) => {
      const y = 380 + i * 60, on = i === this.menuSel, dis = i === 2;
      if (on) { const w = 460; ctx.fillStyle = 'rgba(255,110,140,.22)'; ctx.beginPath(); ctx.moveTo(W / 2 - w / 2 + 20, y - 24); ctx.lineTo(W / 2 + w / 2 + 20, y - 24); ctx.lineTo(W / 2 + w / 2 - 20, y + 24); ctx.lineTo(W / 2 - w / 2 - 20, y + 24); ctx.closePath(); ctx.fill(); }
      titleText(it, W / 2, y, on ? 40 : 34, dis ? (on ? '#b8a8c8' : '#8a7a98') : on ? '#ffe070' : '#f0e4ff');
      if (dis) uiText('EM BREVE', W / 2 + 190, y - 18, 15, '#ff8aa0', 'left', 700);
    });
    uiText('W/S ou ↑/↓ para escolher  ·  ENTER ou G para confirmar', W / 2, H - 34, 18, '#cbb8e0', 'center', 600);
  },
  drawControls() {
    titleText('CONTROLES', W / 2, 70, 70, '#ffe070');
    const col = (x, title, rows) => {
      titleText(title, x, 150, 36, '#ffffff');
      rows.forEach(([k, v], i) => { uiText(k, x - 20, 200 + i * 34, 22, '#ffd0a0', 'right', 700); uiText(v, x, 200 + i * 34, 22, '#f0e4ff', 'left', 600); });
    };
    col(330, 'JOGADOR 1', [['A / D', 'andar'], ['W', 'pular'], ['S', 'agachar'], ['G', 'golpe leve'], ['H', 'golpe forte'], ['T', 'especial'], ['Y', 'dash']]);
    col(900, 'JOGADOR 2', [['← / →', 'andar'], ['↑', 'pular'], ['↓', 'agachar'], ['L  (Num 1)', 'golpe leve'], ['K  (Num 2)', 'golpe forte'], ['O  (Num 3)', 'especial'], ['I  (Num 0)', 'dash']]);
    const tips = ['Defender: segure para trás. Agachado defende rasteiras; em pé defende ataques aéreos.',
      'Especial parado: projétil  ·  Frente + Especial: investida  ·  Trás + Especial: golpe anti-aéreo',
      'Energia cheia: Baixo + Especial solta o SUPER  ·  Leve → Forte → Especial encadeia combos',
      'Controles de videogame também funcionam (X leve, Y forte, B especial, A dash).'];
    tips.forEach((t, i) => uiText(t, W / 2, 470 + i * 36, 20, i === 2 ? '#ffe070' : '#e8dcf8', 'center', 600));
    uiText('ENTER ou ESC para voltar', W / 2, H - 40, 18, '#cbb8e0', 'center', 600);
  },
  drawSelect() {
    this.worldBegin(WORLD_W / 2, 1); this.worldEnd();
    ctx.fillStyle = 'rgba(12,6,24,.7)'; ctx.fillRect(0, 0, W, H);
    titleText('ESCOLHA SEU LUTADOR', W / 2, 60, 58, '#ffffff');
    const cpu = this.mode === 'cpu';
    const cards = CHARS.map((c, i) => ({ c, i, x: i === 0 ? 340 : 940 }));
    for (const { c, i, x } of cards) {
      const on = [0, 1].filter(s => this.sel[s] === i);
      // cartão
      ctx.save(); ctx.translate(x, 390);
      const g = ctx.createLinearGradient(0, -280, 0, 280); g.addColorStop(0, rgba(c.fx.dark, .85)); g.addColorStop(1, 'rgba(14,6,26,.9)');
      ctx.beginPath(); ctx.moveTo(-240, -280); ctx.lineTo(260, -280); ctx.lineTo(240, 280); ctx.lineTo(-260, 280); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = on.length ? 5 : 2; ctx.strokeStyle = on.length ? c.fx.light : 'rgba(255,255,255,.3)'; ctx.stroke();
      ctx.globalAlpha = .15; ctx.font = `260px ${FONT_J}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(c.kanji, 90, -60); ctx.globalAlpha = 1;
      ctx.restore();
      // lutador em pé (versão da cor alternativa quando os dois escolhem o mesmo)
      const alt = this.sel[0] === this.sel[1] && this.sel[1] === i && on.length === 2;
      const pv = this.previews[i][0], pv2 = this.previews[i][1];
      const fx0 = x - 100;
      ctx.save(); ctx.translate(fx0, 560); ctx.scale(1.05, 1.05); ctx.translate(-pv.x, -GROUND); drawFighter(pv); ctx.restore();
      if (alt) { ctx.save(); ctx.translate(fx0 + 150, 560); ctx.scale(.8, .8); ctx.translate(-pv2.x, -GROUND); drawFighter(pv2); ctx.restore(); }
      titleText(c.name, x + 120, 170, 64, c.fx.light, '#140a1e', 'center');
      uiText(c.title.toUpperCase(), x + 120, 216, 20, '#ffffff', 'center', 700);
      ctx.save(); ctx.font = `600 17px ${FONT_U}`; ctx.fillStyle = '#e8dcf8'; ctx.textAlign = 'left';
      const words = c.bio.split(' '); let line = '', ly = 262;
      for (const wd of words) { if (ctx.measureText(line + wd).width > 200) { ctx.fillText(line, x + 30, ly); line = ''; ly += 22; } line += wd + ' '; } ctx.fillText(line, x + 30, ly);
      ctx.restore();
      c.stats.forEach(([n, v], k) => {
        const yy = 388 + k * 32; uiText(n.toUpperCase(), x + 30, yy, 16, '#cbb8e0', 'left', 700);
        for (let s = 0; s < 5; s++) { ctx.fillStyle = s < v ? c.fx.main : 'rgba(255,255,255,.15)'; ctx.fillRect(x + 128 + s * 22, yy - 7, 18, 14); }
      });
      // marcadores de jogador
      on.forEach((s, k) => {
        const lab = s === 0 ? 'J1' : cpu ? 'CPU' : 'J2', col = s === 0 ? '#ff4a5a' : '#3a9aff', ready = this.selStep[s] === 1;
        const tx = x - 190 + k * 90, ty = 136;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 76, ty); ctx.lineTo(tx + 66, ty + 34); ctx.lineTo(tx - 10, ty + 34); ctx.closePath(); ctx.fill();
        titleText(lab + (ready ? ' ✓' : ''), tx + 33, ty + 18, 24, '#ffffff');
      });
    }
    // instruções
    let hint;
    if (cpu) hint = this.selStep[0] === 0 ? 'Escolha seu lutador: ←/→ e ENTER' : this.selStep[1] === 0 ? 'Agora escolha o adversário da CPU  ·  ↑/↓ muda a dificuldade  ·  ESC volta' : 'Preparar...';
    else hint = 'J1: A/D e G  ·  J2: ←/→ e L  ·  H/K cancela  ·  ESC volta ao menu';
    uiText(hint, W / 2, H - 30, 20, '#f0e4ff', 'center', 600);
    if (cpu) {
      const on = this.selStep[0] === 1;
      ctx.globalAlpha = on ? 1 : .45;
      titleText(`CPU: ${CPU_LEVELS[this.cpuLevel].name}`, W / 2, H - 66, 30, ['#8affb0', '#ffe070', '#ff6a6a'][this.cpuLevel]);
      ctx.globalAlpha = 1;
    }
  }
};

/* ---------- laço principal (passo fixo de 60 Hz) ---------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  let steps = 0;
  while (acc >= 1000 / 60 && steps < 4) { Game.update(); acc -= 1000 / 60; steps++; }
  Game.draw();
  requestAnimationFrame(frame);
}
Input.init();
Game.init();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Stage.invalidate());
requestAnimationFrame(frame);
