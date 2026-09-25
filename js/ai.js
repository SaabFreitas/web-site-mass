'use strict';
/* ==========================================================================
   CPU: aperta os mesmos botões virtuais que um jogador. Decide uma intenção a
   cada poucos quadros (aproximar, pular, zonear, defender, atacar) com tempo
   de reação e chance de defesa definidos pela dificuldade.
   ========================================================================== */
const CPU_LEVELS = [
  { name: 'FÁCIL', react: 22, block: .25, aggro: .35, combo: .2 },
  { name: 'NORMAL', react: 13, block: .55, aggro: .55, combo: .55 },
  { name: 'DIFÍCIL', react: 6, block: .85, aggro: .75, combo: .9 }
];

class CpuCtrl {
  constructor(level) { this.L = CPU_LEVELS[level]; this.cpu = true; this.h = {}; this.p = {}; this.intent = 'idle'; this.timer = 0; this.seenMove = null; this.blockThis = false; this.plan = []; }
  held(b) { return !!this.h[b]; }
  pressed(b) { return !!this.p[b]; }
  tap(b) { this.p[b] = true; }
  update(me, opp) {
    this.p = {}; this.h = {};
    if (Game.state !== 'fight' || !opp) return;
    const L = this.L, fwd = me.facing === 1 ? 'right' : 'left', back = me.facing === 1 ? 'left' : 'right';
    const dist = Math.abs(opp.x - me.x);
    // sequência planejada (combos)
    if (this.plan.length) { const s = this.plan[0]; if (--s.wait <= 0) { this.plan.shift(); for (const k of s.keys) k.startsWith('+') ? (this.h[k.slice(1)] = true) : this.tap(k); } else for (const k of s.keys) if (k.startsWith('+')) this.h[k.slice(1)] = true; return; }
    // defesa: reage ao golpe do oponente
    const threat = (opp.state === 'attack' && opp.phase !== 'recovery' && dist < 380) || Game.projectiles.some(p => p.owner === opp && Math.abs(p.x - me.x) < 320 && Math.sign(p.vx) === Math.sign(me.x - p.x));
    if (threat) {
      const id = opp.state === 'attack' ? opp.move : 'proj';
      if (this.seenMove !== id) { this.seenMove = id; this.blockThis = Math.random() < L.block; this.reactT = L.react * rand(.6, 1.2); }
      if (this.blockThis && (this.reactT -= 1) <= 0 && me.canBlock()) { this.h[back] = true; if (opp.move && opp.move.low) this.h.down = true; return; }
    } else this.seenMove = null;
    // punir: oponente se recuperando perto
    if (opp.state === 'attack' && opp.phase === 'recovery' && dist < 190 && Math.random() < L.combo * .3) { this.combo(); return; }
    // anti-aéreo
    if (!opp.grounded && opp.state === 'jump' && dist < 260 && opp.vy > -6 && Math.random() < L.block * .25) { this.h[back] = true; this.tap('special'); return; }
    // super
    if (me.energy >= 100 && dist < 360 && Math.random() < .02 * L.aggro) { this.h.down = true; this.tap('special'); return; }

    if (--this.timer <= 0) {
      this.timer = Math.round(rand(14, 34));
      const r = Math.random();
      if (dist > 520) this.intent = r < .3 ? 'zone' : r < .85 ? 'approach' : 'dash';
      else if (dist > 200) this.intent = r < .45 * L.aggro + .15 ? 'approach' : r < .6 ? 'zone' : r < .72 ? 'jumpin' : r < .8 ? 'rush' : r < .9 ? 'retreat' : 'wait';
      else this.intent = r < L.aggro ? 'attack' : r < L.aggro + .15 ? 'sweep' : r < .9 ? 'retreat' : 'wait';
    }
    switch (this.intent) {
      case 'approach': this.h[fwd] = true; if (dist < 170) this.intent = 'attack'; break;
      case 'retreat': this.h[back] = true; break;
      case 'dash': this.tap('dash'); this.intent = 'approach'; break;
      case 'zone': if (!Game.projectiles.some(p => p.owner === me)) this.tap('special'); this.intent = 'wait'; break;
      case 'jumpin': this.h.up = true; this.h[fwd] = true; this.plan = [{ wait: 22, keys: ['heavy'] }]; this.intent = 'wait'; break;
      case 'rush': this.h[fwd] = true; this.tap('special'); this.intent = 'wait'; break;
      case 'attack': if (dist < 190) { this.combo(); this.intent = 'wait'; } else this.h[fwd] = true; break;
      case 'sweep': if (dist < 200) { this.h.down = true; this.tap('heavy'); this.intent = 'wait'; } else this.h[fwd] = true; break;
    }
  }
  combo() {
    const r = Math.random(), L = this.L;
    if (r < L.combo * .5) this.plan = [{ wait: 1, keys: ['light'] }, { wait: 9, keys: ['heavy'] }, { wait: 14, keys: ['special'] }];
    else if (r < L.combo) this.plan = [{ wait: 1, keys: ['light'] }, { wait: 9, keys: ['heavy'] }];
    else this.plan = [{ wait: 1, keys: [Math.random() < .5 ? 'light' : 'heavy'] }];
  }
}
