'use strict';
/* ==========================================================================
   Lutador: estados, golpes, física, esqueleto e física de cabelo/tecidos.
   ========================================================================== */
const MOVE_RANK = { light: 1, clight: 1, airL: 1, heavy: 2, sweep: 2, airH: 2, proj: 3, rush: 3, anti: 3, super: 4 };

class Fighter {
  constructor(idx, ch, ctrl, alt) {
    this.idx = idx; this.ch = ch; this.ctrl = ctrl;
    this.C = alt ? { ...ch.colors, ...ch.alt } : ch.colors;
    this.maxHp = ch.hp; this.energy = 0; this.wins = 0;
    this.ropes = { hair: new Rope(11, 15), band1: new Rope(7, 9), band2: new Rope(6, 9) };
    this.reset(idx === 0 ? WORLD_W / 2 - 230 : WORLD_W / 2 + 230, idx === 0 ? 1 : -1);
  }
  reset(x, facing) {
    Object.assign(this, { x, y: GROUND, vx: 0, vy: 0, facing, hp: this.maxHp, dispHp: this.maxHp, state: 'idle', move: null, moveKey: null, mf: 0, phase: null,
      stun: 0, t: 0, trail: [], bladeOut: false, expr: 'normal', blink: 0, flashT: 0, invuln: 0, airUsed: false, buffer: null, walkPh: 0,
      dashT: 0, dashDir: 1, hitCount: 0, lastHitF: -99, moveConnected: false, bounced: false, crouchHit: false, guarding: false, grounded: true });
    this.pose = { ...POSES[this.ch.idle] };
    for (const k in this.ropes) this.ropes[k].p = null;
    this.computeSkeleton();
  }
  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && this.move.crouch) || ((this.state === 'blockstun' || this.state === 'hitstun') && this.crouchHit);
  }
  hurtbox() {
    if (this.invuln > 0 || ['down', 'getup', 'ko', 'launch'].includes(this.state)) return null;
    let h = this.crouching ? 205 : 318;
    if (!this.grounded) h = 285;
    return { x: this.x - 36, y: this.y - h, w: 72, h };
  }
  hitboxWorld(mv) {
    const h = mv.hit; return { x: this.facing === 1 ? this.x + h.x : this.x - h.x - h.w, y: this.y + h.y, w: h.w, h: h.h };
  }
  canBlock() { return this.grounded && ['idle', 'walk', 'crouch', 'blockstun'].includes(this.state); }

  /* ---------- entrada e escolha de golpe ---------- */
  chooseMove(b, f, bk, d) {
    if (!this.grounded) {
      if (this.airUsed || this.state !== 'jump') return null;
      return b === 'light' ? 'airL' : b === 'heavy' ? 'airH' : null;
    }
    if (b === 'special') {
      if (d && this.energy >= 100) return 'super';
      if (f) return 'rush';
      if (bk) return 'anti';
      return Game.projectiles.some(p => p.owner === this) ? null : 'proj';
    }
    if (b === 'light') return d ? 'clight' : 'light';
    return d ? 'sweep' : 'heavy';
  }
  startMove(key) {
    const mv = this.ch.moves[key]; if (!mv) return;
    Object.assign(this, { move: mv, moveKey: key, mf: 0, phase: 'startup', hitCount: 0, lastHitF: -99, moveConnected: false, state: 'attack', buffer: null, trail: [] });
    this.bladeOut = !!mv.blade;
    if (mv.air) this.airUsed = true; else if (this.grounded) this.vx = 0;
    if (mv.invuln) this.invuln = mv.invuln;
    if (mv.super) { this.energy = 0; Game.startCutin(this); }
  }
  endMove() {
    this.move = null; this.moveKey = null; this.phase = null;
    this.state = this.grounded ? 'idle' : 'jump';
    if (!this.ch.look.weapon) this.bladeOut = false;
  }

  update(opp) {
    this.t++;
    const c = this.ctrl; c.update(this, opp);
    const fk = this.facing === 1 ? 'right' : 'left', bk = this.facing === 1 ? 'left' : 'right';
    const holdF = c.held(fk), holdB = c.held(bk), holdD = c.held('down'), holdU = c.held('up');
    for (const b of ['light', 'heavy', 'special']) if (c.pressed(b)) this.buffer = { b, t: 8, f: holdF, bk: holdB, d: holdD };
    if (this.buffer && --this.buffer.t <= 0) this.buffer = null;
    this.guarding = holdB && !holdF;
    if (this.invuln > 0) this.invuln--;
    if (this.flashT > 0) this.flashT--;
    if (--this.blink < -200 + rand(0, 60)) this.blink = 6;
    const fighting = Game.state === 'fight';

    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': {
        if (!fighting) { this.state = 'idle'; this.vx = 0; break; }
        if (this.buffer) { const k = this.chooseMove(this.buffer.b, this.buffer.f || holdF, this.buffer.bk || holdB, this.buffer.d || holdD); if (k) { this.startMove(k); break; } }
        if (c.pressed('dash')) { this.state = 'dash'; this.dashDir = holdB ? -1 : 1; this.dashT = this.dashDir > 0 ? 16 : 14; this.vx = this.ch.dash * this.dashDir * this.facing * (this.dashDir > 0 ? 1 : .8); Audio2.play('dash'); FX.dust(this.x, GROUND, -this.vx); break; }
        if (holdU) { this.vy = this.ch.jumpV; this.vx = holdF ? this.ch.jumpX * this.facing : holdB ? -this.ch.jumpX * this.facing : 0; this.y -= 1; this.state = 'jump'; this.airUsed = false; Audio2.play('jump'); FX.dust(this.x, GROUND, 0); break; }
        if (holdD) { this.state = 'crouch'; this.vx = 0; }
        else if (holdF) { this.state = 'walk'; this.vx = this.ch.walk * this.facing; }
        else if (holdB) { this.state = 'walk'; this.vx = -this.ch.back * this.facing; }
        else { this.state = 'idle'; this.vx = 0; }
        if (this.state === 'walk') this.walkPh += .2;
        break;
      }
      case 'jump':
        if (this.buffer && fighting) { const k = this.chooseMove(this.buffer.b, false, false, false); if (k) this.startMove(k); }
        break;
      case 'attack': this.updateMove(opp, holdF, holdB, holdD); break;
      case 'dash':
        this.vx *= .88;
        if (--this.dashT <= 0) { this.state = 'idle'; this.vx = 0; }
        break;
      case 'hitstun': case 'blockstun':
        if (this.grounded) this.vx *= .84;
        if (--this.stun <= 0) this.state = this.grounded ? (holdD ? 'crouch' : 'idle') : 'launch';
        break;
      case 'down':
        this.vx *= .8;
        if (--this.stun <= 0) { this.state = 'getup'; this.stun = 20; this.invuln = 24; }
        break;
      case 'getup': if (--this.stun <= 0) this.state = 'idle'; break;
      case 'launch': case 'ko': break;
      case 'win': this.vx = 0; break;
    }

    // física
    const wasAir = !this.grounded;
    if (this.y < GROUND || this.vy < 0) this.vy += GRAV * (this.state === 'launch' ? .85 : 1);
    this.x += this.vx; this.y += this.vy;
    if (this.y >= GROUND) {
      this.y = GROUND;
      if (wasAir) this.land();
      this.vy = 0;
    }
    this.grounded = this.y >= GROUND;
    this.x = clamp(this.x, WALL_L, WALL_R);

    this.updateLook(opp);
  }

  land() {
    if (this.state === 'launch' || this.state === 'ko') {
      if (!this.bounced && this.vy > 7) { this.bounced = true; this.vy = -this.vy * .32; this.y = GROUND - 1; this.vx *= .6; FX.dust(this.x, GROUND, 0, 1.6); Game.shake = Math.max(Game.shake, 6); Audio2.play('land'); return; }
      this.vx *= .5;
      if (this.state === 'launch') { this.state = 'down'; this.stun = 34; }
      FX.dust(this.x, GROUND, 0, 1.2);
    } else if (this.state === 'jump') { this.state = 'idle'; this.vx = 0; Audio2.play('land'); FX.dust(this.x, GROUND, 0, .7); }
    else if (this.state === 'attack' && (this.move.air || this.move.hop)) { this.endMove(); this.vx = 0; }
    else if (this.state === 'hitstun' || this.state === 'blockstun') this.vx *= .5;
  }

  updateMove(opp, holdF, holdB, holdD) {
    const mv = this.move; this.mf++;
    const s = mv.startup, a = mv.active, r = mv.recovery, f = this.mf;
    this.phase = f <= s ? 'startup' : f <= s + a ? 'active' : 'recovery';
    if (f === s) {
      Audio2.play(mv.whoosh || (mv.proj === 'fire' ? 'fire' : 'whoosh'));
      if (mv.voice || mv.heavy) Audio2.voice(this.ch.fem, !!mv.special);
      if (mv.label && !mv.super) FX.text(mv.label, this.x, this.y - 370, this.ch.fx.light, 30);
    }
    if (f === s + 1) {
      if (mv.hop) { this.vy = mv.hop; this.vx = (mv.hopVx || 0) * this.facing; this.y -= 1; }
      if (mv.proj) { Game.projectiles.push(new Projectile(this, mv.proj)); Audio2.play(mv.proj === 'fire' ? 'fire' : 'wind'); }
    }
    const blocked = !mv.pass && opp && Math.abs(opp.y - this.y) < 150 && (opp.x - this.x) * this.facing > 0 && Math.abs(opp.x - this.x) < 90;
    if (this.phase === 'active' && mv.dash && !(mv.stopOnHit && this.moveConnected)) {
      this.vx = blocked ? 0 : mv.dash * this.facing;
      if (this.t % 2 === 0) FX.afterimage(this);
    } else if (this.grounded && !mv.hop) this.vx *= .72;
    // cancelar em golpe mais forte depois de acertar
    if (mv.cancel && this.moveConnected && this.buffer && this.phase !== 'startup') {
      const k = this.chooseMove(this.buffer.b, this.buffer.f || holdF, this.buffer.bk || holdB, this.buffer.d || holdD);
      if (k && MOVE_RANK[k] > MOVE_RANK[this.moveKey]) { this.startMove(k); return; }
    }
    if (f > s + a + r) this.endMove();
  }

  takeHit(att, mv, dmg, final) {
    this.hp = Math.max(0, this.hp - dmg);
    this.crouchHit = this.crouching;
    this.move = null; this.moveKey = null; this.phase = null;
    this.bounced = false; this.trail = []; this.bladeOut = false;
    const dir = att.facing;
    if (this.hp <= 0) {
      this.state = 'ko'; this.vy = Math.min(-11, mv.launch || -11); this.vx = dir * 7; this.y -= 1; this.grounded = false; return;
    }
    const knock = (mv.knockdown && (!mv.multi || final)) || (final && mv.finalLaunch);
    if (knock || (!this.grounded && !mv.multi)) {
      this.state = 'launch'; this.vy = final && mv.finalLaunch ? mv.finalLaunch : (mv.launch || -7); this.vx = dir * ((mv.push || 4) * .7 + 3.5); this.y -= 1; this.grounded = false;
    } else {
      this.state = 'hitstun'; this.stun = mv.stun || 16; this.vx = dir * (mv.push || 4);
      if (!this.grounded) this.vy = Math.min(this.vy, -3.5);
    }
  }
  takeBlock(att, mv) {
    this.state = 'blockstun'; this.stun = mv.bstun || 12; this.crouchHit = this.crouching || this.ctrl.held('down');
    this.vx = att.facing * (mv.push || 4) * .9;
  }

  /* ---------- pose, esqueleto, cabelo e rastros ---------- */
  targetPose(opp) {
    const ch = this.ch; let key = ch.idle, k = .28;
    switch (this.state) {
      case 'attack': {
        const mv = this.move;
        if (this.phase === 'startup' && mv.pre) { key = mv.pre; k = .4; } else { key = mv.pose; k = this.phase === 'active' ? .6 : .22; }
        break;
      }
      case 'walk': return [walkPose(POSES[ch.idle], this.walkPh, this.vx * this.facing < 0), .35];
      case 'crouch': key = this.guarding && opp.state === 'attack' ? 'cblock' : 'crouch'; k = .35; break;
      case 'jump': key = 'jump'; k = .2; break;
      case 'dash': key = this.dashDir > 0 ? 'run' : 'backstep'; k = .4; break;
      case 'hitstun': key = this.crouchHit ? 'chrt' : 'hurt'; k = .55; break;
      case 'blockstun': key = this.crouchHit ? 'cblock' : 'block'; k = .55; break;
      case 'launch': case 'ko': key = this.grounded ? 'down' : 'launched'; k = this.grounded ? .25 : .18; break;
      case 'down': key = 'down'; k = .3; break;
      case 'getup': key = 'crouch'; k = .2; break;
      case 'win': key = ch.win; k = .12; break;
      case 'idle':
        if (this.guarding && opp && (opp.state === 'attack' || Game.projectiles.some(p => p.owner === opp)) && Math.abs(opp.x - this.x) < 420) { key = 'block'; k = .45; }
        else if (Game.state === 'intro' && Game.stateT < 70) { key = 'intro'; k = .1; }
        break;
    }
    return [POSES[key] || POSES.idle, k];
  }

  updateLook(opp) {
    const [tp, k] = this.targetPose(opp);
    for (const key of POSE_KEYS) this.pose[key] = lerp(this.pose[key], tp[key], k);
    if (this.state === 'idle' && Math.abs(this.pose.rot) < .05) this.pose.rot = 0;
    // expressão
    this.expr = this.state === 'ko' ? 'ko' : (this.state === 'hitstun' || this.state === 'launch' || this.state === 'down') ? 'hurt'
      : (this.state === 'attack' && this.phase !== 'recovery' && (this.move.heavy || this.move.special)) ? 'shout' : 'normal';
    if (this.ch.look.weapon) this.bladeOut = this.state === 'attack' ? !!this.move.blade || this.bladeOut : (this.state === 'win' ? false : this.bladeOut && this.state === 'dash');
    this.computeSkeleton();
    // cabelo e faixas
    const sk = this.sk, d = this.facing, wind = -this.vx * .06 - d * .04 + Math.sin(this.t * .05 + this.idx) * .06;
    if (this.ch.look.hair === 'ponytail') { const a = headToWorld(sk, -17, -19); this.ropes.hair.update(a.x, a.y, d, wind, .5, .45); }
    if (this.ch.look.headband) {
      const a = headToWorld(sk, -21, -9);
      this.ropes.band1.update(a.x, a.y, d, wind, .35, .5); this.ropes.band2.update(a.x, a.y + 2, d, wind * 1.2, .42, .35);
    }
    // rastro do golpe
    const mv = this.move;
    if (mv && this.phase === 'active' && (mv.trail || mv.heavy || mv.blade)) {
      if (mv.limb === 'blade' && sk.bladeTip) this.trail.push({ x: sk.bladeTip.x, y: sk.bladeTip.y, bx: sk.bladeBase.x, by: sk.bladeBase.y });
      else { const p = mv.limb === 'foot' ? sk.toeF : sk.handF; this.trail.push({ x: p.x, y: p.y }); }
      if (this.trail.length > 8) this.trail.shift();
      if (this.ch.element === 'fire' && this.t % 2 === 0) { const p = this.trail[this.trail.length - 1]; FX.ember(p.x, p.y, this.ch.fx); }
    } else if (this.trail.length) this.trail.shift();
  }

  computeSkeleton() {
    const B = this.ch.body, p = this.pose, d = this.facing;
    const V = (a, l) => ({ x: Math.sin(a) * l * d, y: Math.cos(a) * l });
    const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
    const breath = this.state === 'idle' ? Math.sin(this.t * .06) * .025 : 0;
    const t = p.t + breath;
    let u = { x: Math.sin(t) * d, y: -Math.cos(t) }, n = { x: Math.cos(t) * d, y: Math.sin(t) };
    const hip = { x: 0, y: 0 }, hipF = { x: d * 4, y: 2 }, hipB = { x: -d * 4, y: 0 };
    const kneeF = add(hipF, V(p.fh, B.thigh)), ankF = add(kneeF, V(p.fh + p.fk, B.shin));
    const kneeB = add(hipB, V(p.bh, B.thigh)), ankB = add(kneeB, V(p.bh + p.bk, B.shin));
    const footA = s => s + 1.57 * (1 - clamp(Math.abs(s) / 1.6, 0, 1)) * (s < -1 ? 0 : 1);
    const toeF = add(ankF, V(footA(p.fh + p.fk), 21)), toeB = add(ankB, V(footA(p.bh + p.bk), 21));
    const neck = { x: u.x * B.torso, y: u.y * B.torso };
    const shF = { x: neck.x - u.x * 14 + n.x * 5, y: neck.y - u.y * 14 + n.y * 5 };
    const shB = { x: neck.x - u.x * 14 - n.x * 9, y: neck.y - u.y * 14 - n.y * 9 };
    const aF = t + p.fs, aB = t + p.bs;
    const elbF = add(shF, V(aF, B.uarm)), handF = add(elbF, V(aF + p.fe, B.farm));
    const elbB = add(shB, V(aB, B.uarm)), handB = add(elbB, V(aB + p.be, B.farm));
    const A = t * .5 + p.h, headS = B.headR / 20;
    const head = { x: neck.x + Math.sin(A) * d * (B.neck + 14 * headS), y: neck.y - Math.cos(A) * (B.neck + 14 * headS) };
    const foreA = aF + p.fe;
    const bd = V(foreA + p.sw, 1);
    const bladeBase = add(handF, { x: bd.x * 13, y: bd.y * 13 }), bladeTip = add(bladeBase, { x: bd.x * 112, y: bd.y * 112 });
    const pts = { hip, hipF, hipB, kneeF, ankF, kneeB, ankB, toeF, toeB, neck, shF, shB, elbF, handF, elbB, handB, head, bladeBase, bladeTip };
    let headAng = A * d;
    const R = p.rot * d;
    if (Math.abs(R) > .001) {
      const c = Math.cos(R), s = Math.sin(R);
      for (const k in pts) { const q = pts[k]; pts[k] = { x: q.x * c - q.y * s, y: q.x * s + q.y * c }; }
      u = { x: u.x * c - u.y * s, y: u.x * s + u.y * c }; n = { x: n.x * c - n.y * s, y: n.x * s + n.y * c };
      headAng += R;
    }
    let low = Math.max(pts.ankF.y, pts.ankB.y, pts.toeF.y, pts.toeB.y) + 7;
    if (Math.abs(p.rot) > .25) low = Math.max(low, pts.head.y + 24 * headS, pts.handF.y + 8, pts.handB.y + 8, pts.kneeF.y + 12, pts.kneeB.y + 12, pts.hip.y + 22, pts.neck.y + 14);
    const ox = this.x, oy = this.y - low;
    for (const k in pts) { pts[k].x += ox; pts[k].y += oy; }
    this.sk = { ...pts, u, n, d, t, headAng, headS };
  }
}
