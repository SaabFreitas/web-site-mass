'use strict';
/* ==========================================================================
   Dados: poses do esqueleto e personagens.
   Ângulos em radianos, medidos a partir da vertical para baixo; positivo = para
   a frente do lutador. t = inclinação do tronco; h = cabeça; fs/fe e bs/be =
   ombro/cotovelo dos braços da frente e de trás (relativos ao tronco);
   fh/fk e bh/bk = quadril/joelho das pernas; rot gira o corpo inteiro;
   sw = ângulo da espada em relação ao antebraço.
   ========================================================================== */
const POSE_KEYS = ['t', 'h', 'fs', 'fe', 'bs', 'be', 'fh', 'fk', 'bh', 'bk', 'rot', 'sw'];
const P = (o) => { const p = { t: 0, h: 0, fs: 0, fe: 0, bs: 0, be: 0, fh: 0, fk: 0, bh: 0, bk: 0, rot: 0, sw: 0 }; return Object.assign(p, o); };

const POSES = {
  idle:     P({ t: .14, h: -.06, fs: .55, fe: 2.1, bs: .3, be: 2.3, fh: .32, fk: -.38, bh: -.3, bk: -.18 }),
  crouch:   P({ t: .45, h: -.25, fs: .7, fe: 2.0, bs: .5, be: 2.2, fh: 1.4, fk: -2.3, bh: .5, bk: -2.1 }),
  jump:     P({ t: .1, fs: 1.1, fe: 1.4, bs: .2, be: 1.6, fh: 1.1, fk: -1.9, bh: .3, bk: -1.5 }),
  jab:      P({ t: .24, h: -.1, fs: 1.36, fe: .04, bs: .3, be: 2.3, fh: .42, fk: -.35, bh: -.45, bk: -.12 }),
  jabPre:   P({ t: .1, fs: .45, fe: 2.2, bs: .3, be: 2.3, fh: .36, fk: -.4, bh: -.35, bk: -.15 }),
  cjab:     P({ t: .5, h: -.2, fs: 1.2, fe: .05, bs: .5, be: 2.2, fh: 1.4, fk: -2.3, bh: .5, bk: -2.1 }),
  kick:     P({ t: -.38, h: .2, fs: .7, fe: 1.8, bs: -.35, be: 1.2, fh: 1.72, fk: -.06, bh: -.08, bk: -.12 }),
  kickPre:  P({ t: -.1, fs: .6, fe: 2.0, bs: -.2, be: 1.6, fh: 1.3, fk: -2.0, bh: -.1, bk: -.15 }),
  sweep:    P({ t: .6, h: -.3, fs: .25, fe: .4, bs: .9, be: 1.4, fh: 1.52, fk: -.04, bh: .85, bk: -2.3 }),
  sweepPre: P({ t: .5, fs: .5, fe: 1.4, bs: .6, be: 1.8, fh: 1.1, fk: -2.1, bh: .7, bk: -2.2 }),
  airP:     P({ t: .3, fs: 1.3, fe: .08, bs: .3, be: 2.0, fh: 1.1, fk: -1.8, bh: .35, bk: -1.4 }),
  airK:     P({ t: -.25, h: .1, fs: .5, fe: 1.6, bs: -.1, be: 1.6, fh: 1.3, fk: -.05, bh: .35, bk: -1.6 }),
  cast:     P({ t: .22, h: -.05, fs: 1.45, fe: .05, bs: 1.35, be: .18, fh: .62, fk: -.5, bh: -.55, bk: -.1 }),
  castPre:  P({ t: -.05, fs: .3, fe: 2.4, bs: .2, be: 2.5, fh: .35, fk: -.45, bh: -.35, bk: -.2 }),
  rush:     P({ t: .62, h: -.1, fs: 1.45, fe: .02, bs: -.5, be: 1.2, fh: .95, fk: -.8, bh: -.85, bk: -.2 }),
  upper:    P({ t: -.12, h: .25, fs: 2.95, fe: .08, bs: .3, be: 1.8, fh: .55, fk: -.7, bh: -.35, bk: -.3 }),
  upperPre: P({ t: .55, fs: .1, fe: 1.6, bs: .4, be: 2.0, fh: 1.2, fk: -2.0, bh: .45, bk: -1.9 }),
  block:    P({ t: -.04, h: -.15, fs: 1.25, fe: 2.2, bs: 1.0, be: 2.3, fh: .3, fk: -.45, bh: -.38, bk: -.2 }),
  cblock:   P({ t: .3, h: -.3, fs: 1.25, fe: 2.2, bs: 1.0, be: 2.3, fh: 1.4, fk: -2.3, bh: .5, bk: -2.1 }),
  hurt:     P({ t: -.45, h: -.35, fs: .15, fe: .6, bs: -.35, be: .5, fh: .2, fk: -.3, bh: -.45, bk: -.25 }),
  chrt:     P({ t: .1, h: -.4, fs: .3, fe: 1.0, bs: -.2, be: .8, fh: 1.3, fk: -2.2, bh: .45, bk: -2.0 }),
  launched: P({ t: -.5, h: -.4, fs: -.5, fe: .3, bs: -.9, be: .2, fh: .6, fk: -.5, bh: .2, bk: -.4, rot: -.9 }),
  down:     P({ t: 0, h: -.2, fs: -.1, fe: .1, bs: -.4, be: .2, fh: .12, fk: -.05, bh: -.05, bk: -.02, rot: -1.56 }),
  run:      P({ t: .55, h: -.05, fs: .5, fe: 1.9, bs: -.5, be: 1.5, fh: .95, fk: -1.1, bh: -.95, bk: -.55 }),
  backstep: P({ t: -.28, h: .05, fs: .8, fe: 1.9, bs: .4, be: 2.1, fh: .15, fk: -.35, bh: -.7, bk: -.45 }),
  victory:  P({ t: .02, h: .15, fs: 2.95, fe: .15, bs: .35, be: 1.9, fh: .28, fk: -.2, bh: -.3, bk: -.1 }),
  intro:    P({ t: .05, h: .05, fs: .2, fe: .3, bs: .1, be: .3, fh: .15, fk: -.1, bh: -.15, bk: -.08 }),
  // Poses próprias da espadachim
  iaiIdle:  P({ t: .12, h: -.05, fs: .55, fe: 1.1, bs: .35, be: .95, fh: .42, fk: -.45, bh: -.42, bk: -.22 }),
  slashPre: P({ t: -.12, h: .1, fs: 2.9, fe: .35, bs: 2.6, be: .5, fh: .45, fk: -.4, bh: -.45, bk: -.15, sw: .3 }),
  slash:    P({ t: .42, h: -.2, fs: .9, fe: .1, bs: .7, be: .3, fh: .7, fk: -.6, bh: -.6, bk: -.1, sw: .25 }),
  iai:      P({ t: .5, h: -.1, fs: 1.7, fe: .05, bs: -.45, be: 1.0, fh: 1.0, fk: -.9, bh: -.9, bk: -.2, sw: .05 }),
  riseSlash:P({ t: -.15, h: .3, fs: 2.9, fe: .05, bs: .6, be: 1.4, fh: .65, fk: -.9, bh: -.3, bk: -.4, sw: .1 }),
  airSlash: P({ t: .35, fs: 1.0, fe: .1, bs: .6, be: .6, fh: 1.2, fk: -1.8, bh: .4, bk: -1.4, sw: .3 }),
  sheathe:  P({ t: .02, h: .1, fs: .45, fe: 1.3, bs: .2, be: 1.0, fh: .18, fk: -.1, bh: -.2, bk: -.05 })
};

function walkPose(base, ph, back) {
  const s = Math.sin(ph) * (back ? -1 : 1), p = { ...base };
  p.fh = .2 + s * .42; p.fk = -.32 - Math.max(0, -s) * .75;
  p.bh = -.1 - s * .42; p.bk = -.3 - Math.max(0, s) * .75;
  p.t = base.t + .04; return p;
}

/* Golpes. Frames a 60 fps. hit = hitbox relativa aos pés (x à frente do centro).
   dmg em pontos de vida (vida padrão = 1000). */
const COMMON_MOVES = {
  light:  { startup: 4, active: 3, recovery: 8, dmg: 38, hit: { x: 20, y: -292, w: 92, h: 44 }, stun: 15, bstun: 10, push: 5, pose: 'jab', pre: 'jabPre', limb: 'hand', cancel: true, sfx: 'hitL' },
  clight: { startup: 4, active: 3, recovery: 8, dmg: 30, hit: { x: 20, y: -190, w: 92, h: 42 }, stun: 14, bstun: 9, push: 4, pose: 'cjab', limb: 'hand', cancel: true, sfx: 'hitL', crouch: true },
  sweep:  { startup: 8, active: 4, recovery: 22, dmg: 70, hit: { x: 26, y: -78, w: 150, h: 70 }, push: 5, pose: 'sweep', pre: 'sweepPre', limb: 'foot', low: true, knockdown: true, launch: -5, heavy: true, sfx: 'hitH', crouch: true },
  airL:   { startup: 4, active: 9, recovery: 4, dmg: 45, hit: { x: 24, y: -250, w: 100, h: 80 }, stun: 16, bstun: 10, push: 4, pose: 'airP', limb: 'hand', air: true, overhead: true, sfx: 'hitL' },
  airH:   { startup: 6, active: 10, recovery: 4, dmg: 72, hit: { x: 30, y: -140, w: 130, h: 90 }, stun: 19, bstun: 12, push: 6, pose: 'airK', limb: 'foot', air: true, overhead: true, heavy: true, sfx: 'hitH' }
};

const CHARS = [
{
  key: 'taiga', name: 'TAIGA', title: 'O Punho de Brasa', kanji: '炎', fem: false, element: 'fire',
  bio: 'Irmão mais velho. Luta de punhos nus e transforma a raiva em chamas.',
  stats: [['Vida', 5], ['Força', 4], ['Velocidade', 3], ['Alcance', 2]],
  quote: 'Ninguém apaga a minha chama!',
  superName: 'ERUPÇÃO CARMESIM',
  look: { hair: 'spiky', top: 'jacket', legs: 'pants', hands: 'wraps', headband: true },
  colors: { skin: '#f0c19c', hair: '#2b1714', hairHi: '#7a3222', hairTip: '#b8321e', eye: '#f0a020', brow: '#2b1714',
    coat: '#1f1d2a', coatHi: '#3c3a52', shirt: '#cf2230', pants: '#2c2b3a', wrap: '#f1e9d8', band: '#d8222e', shoe: '#6a4430', lip: '#c47a6a' },
  alt: { coat: '#eee8dc', coatHi: '#ffffff', shirt: '#ff8a1c', pants: '#c8c2b4', band: '#ff8a1c', hairTip: '#e0901e' },
  fx: { main: '#ff6a1c', light: '#ffd27a', core: '#fff6d8', dark: '#c2141e' },
  body: { thigh: 76, shin: 74, torso: 108, neck: 14, uarm: 60, farm: 55, headR: 21, chest: 25, back: 17, waist: 17, hipW: 20, limb: 1.08 },
  hp: 1000, walk: 4.6, back: 3.7, jumpV: -19.5, jumpX: 5.4, dash: 13,
  idle: 'idle', win: 'victory',
  moves: { ...COMMON_MOVES,
    heavy:   { startup: 9, active: 4, recovery: 17, dmg: 88, hit: { x: 40, y: -240, w: 135, h: 85 }, stun: 21, bstun: 14, push: 9, pose: 'kick', pre: 'kickPre', limb: 'foot', heavy: true, cancel: true, fx: 'fire', sfx: 'hitH' },
    proj:    { startup: 13, active: 1, recovery: 24, pose: 'cast', pre: 'castPre', limb: 'hand', proj: 'fire', label: 'BOLA DE BRASA', voice: true },
    rush:    { startup: 8, active: 14, recovery: 18, dmg: 95, hit: { x: 10, y: -290, w: 95, h: 120 }, push: 8, pose: 'rush', pre: 'castPre', limb: 'hand', dash: 14, knockdown: true, launch: -8, heavy: true, fx: 'fire', trail: true, special: true, sfx: 'hitH', label: 'INVESTIDA FLAMEJANTE', voice: true },
    anti:    { startup: 5, active: 10, recovery: 22, dmg: 100, hit: { x: 0, y: -380, w: 90, h: 260 }, push: 4, pose: 'upper', pre: 'upperPre', limb: 'hand', hop: -16, hopVx: 3, invuln: 8, knockdown: true, launch: -15, heavy: true, fx: 'fire', trail: true, special: true, sfx: 'hitH', label: 'FÊNIX ASCENDENTE', voice: true },
    super:   { startup: 12, active: 46, recovery: 26, dmg: 42, multi: 6, hit: { x: 0, y: -310, w: 120, h: 300 }, stun: 30, push: 1, pose: 'rush', limb: 'hand', dash: 17, stopOnHit: true, finalLaunch: -17, finalDmg: 110, heavy: true, fx: 'fire', trail: true, special: true, super: true, invuln: 14, sfx: 'hitH', label: 'ERUPÇÃO CARMESIM' }
  }
},
{
  key: 'yukine', name: 'YUKINE', title: 'A Lâmina do Vento', kanji: '風', fem: true, element: 'wind',
  bio: 'Irmã caçula. Espadachim veloz que corta o próprio vento.',
  stats: [['Vida', 4], ['Força', 3], ['Velocidade', 5], ['Alcance', 5]],
  quote: 'O vento não erra o corte.',
  superName: 'CÉU PARTIDO',
  look: { hair: 'ponytail', top: 'haori', legs: 'hakama', hands: 'bare', weapon: 'katana' },
  colors: { skin: '#f6d2b6', hair: '#171524', hairHi: '#3e4d92', hairTip: '#2c63e8', eye: '#27bfe0', brow: '#1d1a2c',
    coat: '#2f5fc4', coatHi: '#6d9ae8', shirt: '#f4f1ea', pants: '#2e2c52', wrap: '#e9e6df', band: '#f4f1ea', shoe: '#2a2030', lip: '#d27d86',
    blade: '#e6eef8', hilt: '#1e1b2c', guard: '#d4a640', obi: '#f4f1ea' },
  alt: { coat: '#9e2a44', coatHi: '#d8607a', hairTip: '#b0405a', pants: '#2a1a24', guard: '#c0c0d0' },
  fx: { main: '#4cc0ff', light: '#c8f0ff', core: '#ffffff', dark: '#1a5cd8' },
  body: { thigh: 78, shin: 76, torso: 100, neck: 14, uarm: 56, farm: 50, headR: 20, chest: 21, back: 14, waist: 13, hipW: 19, limb: .88 },
  hp: 950, walk: 4.9, back: 4.1, jumpV: -19.5, jumpX: 5.8, dash: 15,
  idle: 'iaiIdle', win: 'sheathe',
  moves: { ...COMMON_MOVES,
    heavy:   { startup: 10, active: 5, recovery: 17, dmg: 82, hit: { x: 10, y: -350, w: 175, h: 230 }, stun: 20, bstun: 14, push: 8, pose: 'slash', pre: 'slashPre', limb: 'blade', blade: true, heavy: true, cancel: true, fx: 'wind', sfx: 'slash', whoosh: 'swordWhoosh' },
    airH:    { ...COMMON_MOVES.airH, pose: 'airSlash', limb: 'blade', blade: true, hit: { x: 10, y: -230, w: 160, h: 170 }, fx: 'wind', sfx: 'slash', whoosh: 'swordWhoosh' },
    proj:    { startup: 11, active: 1, recovery: 20, pose: 'slash', pre: 'slashPre', limb: 'blade', blade: true, proj: 'wind', label: 'CORTE DE VENTO', voice: true, whoosh: 'swordWhoosh' },
    rush:    { startup: 7, active: 12, recovery: 20, dmg: 90, hit: { x: -30, y: -300, w: 130, h: 200 }, push: 5, pose: 'iai', pre: 'iaiIdle', limb: 'blade', blade: true, dash: 21, pass: true, knockdown: true, launch: -7, heavy: true, fx: 'wind', trail: true, special: true, sfx: 'slash', label: 'PASSO DO VENTO', voice: true },
    anti:    { startup: 5, active: 12, recovery: 22, dmg: 95, hit: { x: -10, y: -420, w: 150, h: 300 }, push: 4, pose: 'riseSlash', pre: 'crouch', limb: 'blade', blade: true, hop: -15, hopVx: 2, invuln: 8, knockdown: true, launch: -15, heavy: true, fx: 'wind', trail: true, special: true, sfx: 'slash', label: 'LÂMINA DA LUA', voice: true },
    super:   { startup: 12, active: 48, recovery: 26, dmg: 36, multi: 7, hit: { x: -20, y: -330, w: 170, h: 320 }, stun: 30, push: 1, pose: 'iai', limb: 'blade', blade: true, dash: 20, stopOnHit: true, finalLaunch: -16, finalDmg: 105, heavy: true, fx: 'wind', trail: true, special: true, super: true, invuln: 14, sfx: 'slash', label: 'CÉU PARTIDO' }
  }
}];
