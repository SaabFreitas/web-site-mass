/*
 * Portal do Avesso
 * Jogo de plataforma 2D em canvas, sem assets externos: toda a arte é desenhada em código.
 *
 * Mecânica central: o jogador abre portais (E) que o levam entre o Mundo Normal e o Mundo Avesso.
 * Cada mundo tem blocos, pontes, inimigos e itens próprios, então as quests só se resolvem
 * alternando entre os dois.
 */
'use strict';
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const VW = 960, VH = 540, T = 48;
  const LW = 190, LH = 16;
  const FONT = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';
  const OL = '#2b1840';
  const GRAV = 2200, RUN = 300, JUMP = 880, MAXFALL = 900, DASH_SPEED = 950, DASH_TIME = 0.16;
  const DEBUG = /[?&]debug/.test(location.search);
  const NORMAL = 0, AVESSO = 1;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------ áudio */
  const audio = (() => {
    let ac = null, master = null, muted = false, timer = null, step = 0, musicWorld = 0, boss = false;
    function unlock() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain();
          master.gain.value = 0.55;
          master.connect(ac.destination);
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
    }
    function tone(f1, f2, dur, type = 'square', vol = 0.15, delay = 0) {
      if (!ac || muted) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.03);
    }
    let noiseBuf = null;
    function noise(dur, vol = 0.2, freq = 1400, delay = 0) {
      if (!ac || muted) return;
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = ac.currentTime + delay;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.03);
    }
    const sfx = {
      shoot: () => { tone(1100, 420, 0.09, 'square', 0.045); },
      jump: () => tone(300, 620, 0.13, 'sine', 0.12),
      airjump: () => { tone(500, 900, 0.12, 'triangle', 0.1); },
      dash: () => noise(0.18, 0.18, 2600),
      portalOpen: () => { tone(180, 900, 0.35, 'sine', 0.12); tone(240, 1200, 0.35, 'triangle', 0.05, 0.05); },
      portal: () => { tone(1400, 120, 0.45, 'sine', 0.16); noise(0.35, 0.12, 900); },
      fail: () => { tone(220, 110, 0.2, 'sawtooth', 0.08); },
      hit: () => { noise(0.07, 0.15, 3000); tone(300, 160, 0.07, 'square', 0.05); },
      kill: () => { noise(0.25, 0.2, 1200); tone(520, 80, 0.25, 'square', 0.06); },
      hurt: () => { tone(240, 70, 0.35, 'sawtooth', 0.14); noise(0.2, 0.15, 800); },
      tink: () => { tone(2200, 1800, 0.08, 'triangle', 0.09); },
      pickup: () => { [0, 4, 7, 12].forEach((n, i) => tone(523 * Math.pow(2, n / 12), null, 0.12, 'triangle', 0.1, i * 0.06)); },
      rune: () => { [0, 3, 7, 10, 15].forEach((n, i) => tone(440 * Math.pow(2, n / 12), null, 0.2, 'sine', 0.13, i * 0.07)); },
      check: () => { tone(660, null, 0.12, 'triangle', 0.1); tone(990, null, 0.18, 'triangle', 0.1, 0.1); },
      gate: () => { noise(0.9, 0.2, 300); tone(90, 60, 0.9, 'sawtooth', 0.1); },
      slam: () => { noise(0.5, 0.35, 400); tone(80, 40, 0.5, 'sine', 0.25); },
      roar: () => { tone(110, 55, 0.9, 'sawtooth', 0.14); noise(0.9, 0.12, 600); },
      win: () => { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(392 * Math.pow(2, n / 12), null, 0.3, 'triangle', 0.12, i * 0.11)); },
    };
    const scales = [[0, 4, 7, 12, 9, 7, 4, 2, 0, 4, 7, 11, 12, 11, 7, 4], [0, 3, 6, 10, 12, 10, 6, 1, 0, 3, 7, 8, 13, 8, 6, 3]];
    function startMusic() {
      if (timer) return;
      timer = setInterval(() => {
        if (!ac || muted || ac.state !== 'running') return;
        const sc = scales[musicWorld];
        const base = musicWorld ? 146.8 : 196;
        const n = sc[step % 16];
        const f = base * Math.pow(2, n / 12);
        tone(f * 2, null, 0.2, musicWorld ? 'sawtooth' : 'triangle', musicWorld ? 0.018 : 0.03);
        if (step % 4 === 0) {
          const root = [0, 5, 7, 3][Math.floor(step / 16) % 4];
          tone(base / 2 * Math.pow(2, (musicWorld ? [0, 1, 6, 3] : [0, 5, 7, 9])[Math.floor(step / 16) % 4] / 12), null, 0.6, 'sine', boss ? 0.11 : 0.07);
          void root;
        }
        if (boss && step % 2 === 0) noise(0.05, 0.06, 5000);
        step++;
      }, 170);
    }
    return {
      unlock, sfx, startMusic,
      setWorld(w) { musicWorld = w; },
      setBoss(v) { boss = v; },
      toggleMute() { muted = !muted; return muted; },
      get muted() { return muted; },
    };
  })();
  const sfx = audio.sfx;

  /* ------------------------------------------------------------------ entrada */
  const keys = {}, pressed = {};
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyK: 'dash', KeyC: 'dash',
    KeyJ: 'shoot', KeyX: 'shoot',
    KeyE: 'portal', KeyQ: 'portal',
    KeyP: 'pause', Escape: 'pause', KeyM: 'mute', Enter: 'start',
  };
  const mouse = { x: 0, y: 0, down: false, active: false };
  function press(a) { if (!keys[a]) pressed[a] = true; keys[a] = true; }
  addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    audio.unlock();
    if (DEBUG) debugKey(e.code);
    if (!a) return;
    e.preventDefault();
    if (a === 'shoot') mouse.active = false;
    press(a);
    if (a === 'jump') pressed.start = true;
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) { keys[a] = false; e.preventDefault(); }
  });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH };
  }
  canvas.addEventListener('mousemove', (e) => { const p = toGame(e); mouse.x = p.x; mouse.y = p.y; mouse.active = true; });
  canvas.addEventListener('mousedown', (e) => {
    audio.unlock();
    const p = toGame(e); mouse.x = p.x; mouse.y = p.y;
    if (e.button === 2) { pressed.portal = true; return; }
    mouse.down = true; mouse.active = true; pressed.start = true; pressed.click = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // controles de toque
  const touchUI = document.getElementById('touch');
  if (touchUI && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)) {
    touchUI.classList.add('on');
    touchUI.querySelectorAll('[data-act]').forEach((b) => {
      const a = b.dataset.act;
      const down = (e) => { e.preventDefault(); audio.unlock(); mouse.active = false; press(a); pressed.start = true; b.classList.add('down'); };
      const up = (e) => { e.preventDefault(); keys[a] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
  }

  /* ------------------------------------------------------------------ fase */
  // '#' chão (os dois mundos)   'N' só no Mundo Normal (vinhas)   'I' só no Mundo Avesso (cristal)
  // '=' nuvem atravessável      '^' espinhos                        'G' portão do castelo
  let grid = [];
  const GATE_X = 158;
  function buildLevel() {
    grid = [];
    for (let y = 0; y < LH; y++) grid.push(new Array(LW).fill('.'));
    const R = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < LW && y >= 0 && y < LH) grid[y][x] = c;
    };
    const ground = (x0, x1, top = 12) => R(x0, top, x1, LH - 1, '#');

    // A. Campina inicial
    ground(0, 27);
    R(9, 9, 11, 9, '=');
    R(18, 10, 22, 11, '#');
    R(24, 8, 25, 8, '=');
    // B. Muro de espinhos (só existe no Mundo Normal)
    ground(30, 46);
    R(37, 2, 38, 11, 'N');
    // C. Ponte do Reino (só existe no Mundo Normal) sobre um abismo
    R(47, 12, 55, 12, 'N');
    ground(56, 75);
    // D. Escada de cristal até a Runa 1 (só existe no Avesso)
    R(63, 10, 64, 10, 'I'); R(66, 8, 67, 8, 'I'); R(69, 6, 71, 6, 'I');
    // Vão de espinhos que exige pulo + dash
    R(76, 14, 81, 15, '#'); R(76, 13, 81, 13, '^');
    ground(82, 118);
    // Vinhas do Normal até a rocha da Runa 2
    R(88, 10, 89, 10, 'N'); R(91, 8, 92, 8, 'N'); R(94, 6, 95, 6, 'N'); R(97, 4, 102, 4, '#');
    // E. Parkour alternado sobre espinhos
    R(119, 14, 149, 15, '#'); R(119, 13, 149, 13, '^');
    R(121, 11, 122, 11, 'N');
    R(125, 10, 126, 15, '#');
    R(129, 9, 130, 9, 'I'); R(133, 10, 134, 10, 'I');
    R(137, 10, 138, 15, '#');
    R(141, 10, 142, 10, 'N'); R(145, 10, 146, 10, 'I');
    // F. Portão do castelo e arena do chefe
    ground(150, 189);
    R(GATE_X, 1, GATE_X + 1, 11, 'G');
    R(166, 9, 169, 9, '='); R(181, 9, 184, 9, '='); R(172, 6, 178, 6, '=');
    R(189, 0, 189, 15, '#');
  }

  const SPAWNS = {
    enemies: [
      ['slime', 16, 11], ['slime', 21, 9], ['bat', 27, 6], ['slime', 44, 11], ['bat', 51, 8],
      ['shooter', 72, 11], ['slime', 86, 11], ['bat', 97, 7], ['slime', 106, 11], ['slime', 112, 11],
      ['bat', 123, 7], ['shooter', 154, 11], ['bat', 152, 6],
      ['crawler', 42, 11], ['hand', 45, 11], ['crawler', 60, 11], ['eye', 66, 4], ['crawler', 73, 11],
      ['hand', 84, 11], ['crawler', 93, 11], ['eye', 101, 6], ['guardian', 110, 11], ['eye', 116, 5],
      ['eye', 131, 5], ['hand', 153, 11], ['crawler', 156, 11],
    ],
    checkpoints: [[32, 11], [58, 11], [102, 11], [152, 11], [162, 11]],
    hearts: [[60, 10], [101, 10], [117, 10], [151, 10], [163, 10]],
    runes: [[70.5, 5], [101, 3]],
    signs: [
      [5, 11, '← → ou A D para andar.  ESPAÇO ou W para pular.'],
      [13, 11, 'J ou CLIQUE para atirar magia.  SHIFT ou K para dar DASH.'],
      [34, 11, 'Um muro de espinhos encantado! Aperte E para abrir um PORTAL e atravesse-o para o MUNDO AVESSO.'],
      [45, 11, 'A ponte do Reino só existe no Mundo Normal. Abra outro portal para voltar!'],
      [74, 11, 'Vão enorme cheio de espinhos! PULE e aperte DASH no ar.'],
      [85, 11, 'Uma runa brilha no alto da rocha, mas só no Avesso. Suba pelas vinhas do Mundo Normal e abra um portal lá em cima!'],
      [117, 11, 'Dica: dá para abrir portais no ar. Atravessar um portal recarrega seu PULO e seu DASH!'],
      [155, 11, 'Portão do Castelo Bizarro. Só abre com as 3 Runas do Avesso.'],
    ],
    sage: [61, 11],
    start: [3, 11],
  };

  /* ------------------------------------------------------------------ estado */
  let state = 'title';
  let world = NORMAL, time = 0, shake = 0, switchFx = 0, fade = 0;
  const cam = { x: 0, y: 0 };
  let P, enemies, pbul, ebul, parts, pickups, signs, checkpoints, sage, portal, boss;
  let runes, kills, deaths, portalsUsed, playTime, quest, checkpoint, toasts, gateOpen, gateLift, bossTriggered, lastSafe, winT, godMode = false;

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= LW) return '#';
    if (ty < 0 || ty >= LH) return '.';
    return grid[ty][tx];
  }
  function solidFor(c, w) {
    switch (c) {
      case '#': return true;
      case 'N': return w === NORMAL;
      case 'I': return w === AVESSO;
      case 'G': return !gateOpen;
      default: return false;
    }
  }
  function isSolid(tx, ty, w) { return ty >= 0 && solidFor(tileAt(tx, ty), w); }
  function rectSolid(x, y, w, h, wd) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tx, ty, wd)) return true;
    return false;
  }

  function moveEntity(e, dt, w) {
    let hitX = false, hitY = false;
    e.x += e.vx * dt;
    if (e.vx !== 0) {
      const dir = e.vx > 0 ? 1 : -1;
      const tx = Math.floor((dir > 0 ? e.x + e.w - 0.01 : e.x) / T);
      const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) {
        if (isSolid(tx, ty, w)) { e.x = dir > 0 ? tx * T - e.w : (tx + 1) * T; hitX = true; break; }
      }
    }
    const prevBottom = e.y + e.h;
    e.y += e.vy * dt;
    e.onGround = false;
    const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let tx = x0; tx <= x1; tx++) {
        const oneWay = tileAt(tx, ty) === '=' && prevBottom <= ty * T + 1 && !e.dropThrough;
        if (isSolid(tx, ty, w) || oneWay) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; hitY = true; break; }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(tx, ty, w)) { e.y = (ty + 1) * T; e.vy = 0; hitY = true; break; }
      }
    }
    return { hitX, hitY };
  }

  const EDEF = {
    slime: { w: 36, h: 30, hp: 2, world: NORMAL, grav: true },
    bat: { w: 38, h: 30, hp: 2, world: NORMAL },
    shooter: { w: 40, h: 46, hp: 3, world: NORMAL, grav: true },
    crawler: { w: 48, h: 26, hp: 3, world: AVESSO, grav: true },
    eye: { w: 42, h: 42, hp: 3, world: AVESSO },
    hand: { w: 42, h: 32, hp: 3, world: AVESSO, grav: true },
    guardian: { w: 96, h: 58, hp: 16, world: AVESSO, grav: true },
  };
  function makeEnemy(type, px, py, extra) {
    const d = EDEF[type];
    return Object.assign({
      type, w: d.w, h: d.h, x: px - d.w / 2, y: py - d.h, vx: 0, vy: 0, hp: d.hp, maxHp: d.hp,
      world: d.world, grav: !!d.grav, flash: 0, t: Math.random() * 10, face: -1, homeX: px, homeY: py - d.h,
      onGround: false, cd: 0.8 + Math.random(), st: 'walk', stT: 0, squash: 0,
    }, extra || {});
  }

  function newGame() {
    buildLevel();
    world = NORMAL; audio.setWorld(world); audio.setBoss(false);
    const [sx, sy] = SPAWNS.start;
    P = {
      x: sx * T + 10, y: (sy + 1) * T - 40, w: 28, h: 40, vx: 0, vy: 0, face: 1, onGround: false,
      coyote: 0, jumpBuf: 0, jumpHeld: false, dashT: 0, dashCD: 0, canDash: true, airJumps: 0,
      hp: 5, maxHp: 5, inv: 0, shootCD: 0, portalCD: 0, anim: 0, squash: 0, trail: [], aim: { x: 1, y: 0 }, muzzle: 0,
    };
    enemies = SPAWNS.enemies.map(([t, tx, ty]) => makeEnemy(t, tx * T + T / 2, (ty + 1) * T));
    pbul = []; ebul = []; parts = []; toasts = [];
    pickups = [];
    SPAWNS.hearts.forEach(([tx, ty]) => pickups.push({ type: 'heart', x: tx * T + T / 2, y: ty * T + T / 2, world: -1, t: Math.random() * 6 }));
    SPAWNS.runes.forEach(([tx, ty]) => pickups.push({ type: 'rune', x: tx * T + T / 2, y: ty * T + T / 2, world: AVESSO, t: Math.random() * 6 }));
    signs = SPAWNS.signs.map(([tx, ty, text]) => ({ x: tx * T + T / 2, y: (ty + 1) * T, text }));
    checkpoints = SPAWNS.checkpoints.map(([tx, ty]) => ({ x: tx * T + T / 2, y: (ty + 1) * T, on: false }));
    sage = { x: SPAWNS.sage[0] * T + T / 2, y: (SPAWNS.sage[1] + 1) * T, talked: false, line: 0, lineT: 0, near: false };
    portal = null;
    boss = makeBoss();
    runes = 0; kills = 0; deaths = 0; portalsUsed = 0; playTime = 0; quest = 0;
    checkpoint = { x: P.x, y: P.y, world: NORMAL };
    lastSafe = { x: P.x, y: P.y, world: NORMAL };
    gateOpen = false; gateLift = 0; bossTriggered = false; winT = 0;
    cam.x = 0; cam.y = LH * T - VH;
  }

  /* ------------------------------------------------------------------ utilidades de jogo */
  function toast(text, color = '#fff', dur = 2.6) {
    toasts.push({ text, color, t: 0, dur });
    if (toasts.length > 3) toasts.shift();
  }
  function burst(x, y, n, colors, speed = 260, size = 5, life = 0.6, grav = 600) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, color: colors[i % colors.length], size: size * (0.6 + Math.random() * 0.8), grav, kind: 'dot' });
    }
  }
  function ring(x, y, color, r = 60, life = 0.4, width = 6) {
    parts.push({ x, y, vx: 0, vy: 0, life, max: life, color, size: r, grav: 0, kind: 'ring', width });
  }
  function floatText(x, y, text, color) {
    parts.push({ x, y, vx: 0, vy: -60, life: 1.1, max: 1.1, color, size: 18, grav: 0, kind: 'text', text });
  }
  const pcenter = () => ({ x: P.x + P.w / 2, y: P.y + P.h / 2 });

  /* ------------------------------------------------------------------ jogador */
  function hurtPlayer(n, fromX, force) {
    if (!force && (P.inv > 0 || P.dashT > 0 || godMode)) return;
    P.hp -= n; P.inv = 1.1;
    P.vy = -430; P.vx = (P.x + P.w / 2 < fromX ? -1 : 1) * 300; P.dashT = 0;
    shake = 12; sfx.hurt();
    burst(P.x + P.w / 2, P.y + P.h / 2, 14, ['#ff4f6d', '#ffd1dc', '#fff'], 300, 5);
    if (P.hp <= 0) die();
  }
  function die() {
    deaths++;
    fade = 1;
    toast('Você caiu... de volta ao último checkpoint!', '#ffd1dc');
    P.hp = P.maxHp; P.inv = 1.5; P.vx = 0; P.vy = 0; P.dashT = 0;
    P.x = checkpoint.x; P.y = checkpoint.y;
    setWorld(checkpoint.world, true);
    lastSafe = { ...checkpoint };
    portal = null; pbul = []; ebul = [];
    if (boss.active && !boss.dead) resetBoss();
  }
  function setWorld(w, silent) {
    world = w; audio.setWorld(w);
    pbul = []; ebul = [];
    if (!silent) {
      switchFx = 1; shake = Math.max(shake, 6); sfx.portal(); portalsUsed++;
      const c = pcenter();
      burst(c.x, c.y, 26, w ? ['#b36bff', '#63f5ff', '#ff6ad5'] : ['#ffe066', '#7bf1a8', '#fff'], 420, 6, 0.7, 0);
      toast(w ? 'MUNDO AVESSO' : 'MUNDO NORMAL', w ? '#d9a6ff' : '#fff7b0', 1.4);
    }
  }
  function openPortal() {
    const p = P;
    const cx = p.x + p.w / 2 + p.face * 34, cy = p.y + p.h / 2;
    const other = 1 - world;
    const ok = !rectSolid(cx - p.w / 2, cy - p.h / 2, p.w, p.h, other) && cy < LH * T;
    portal = { x: cx, y: cy, t: 0, life: ok ? 3.2 : 0.6, ok };
    p.portalCD = 0.35;
    if (ok) sfx.portalOpen();
    else { sfx.fail(); floatText(cx, cy - 50, 'Bloqueado do outro lado!', '#ff8a8a'); }
  }
  function firePlayer() {
    const c = pcenter();
    let ax = P.face, ay = 0;
    if (mouse.active) {
      const dx = mouse.x + cam.x - c.x, dy = mouse.y + cam.y - (c.y - 4);
      const d = Math.hypot(dx, dy) || 1;
      ax = dx / d; ay = dy / d;
      if (Math.abs(ax) > 0.05) P.face = ax > 0 ? 1 : -1;
    }
    P.aim = { x: ax, y: ay };
    const sp = 880;
    pbul.push({ x: c.x + ax * 22, y: c.y - 4 + ay * 22, vx: ax * sp, vy: ay * sp, life: 0.75, r: 7 });
    P.shootCD = 0.17; P.muzzle = 0.08;
    sfx.shoot();
  }
  function updatePlayer(dt) {
    const p = P;
    p.inv = Math.max(0, p.inv - dt); p.shootCD -= dt; p.dashCD -= dt; p.portalCD -= dt; p.muzzle -= dt;
    p.squash = approach(p.squash, 0, dt * 4);
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const wasGround = p.onGround;

    if (pressed.dash) {
      pressed.dash = false;
      if (p.dashCD <= 0 && p.canDash) {
        if (dir) p.face = dir;
        p.dashT = DASH_TIME; p.dashCD = 0.38;
        if (!p.onGround) p.canDash = false;
        sfx.dash(); shake = Math.max(shake, 3);
        ring(p.x + p.w / 2, p.y + p.h / 2, world ? '#63f5ff' : '#fff', 30, 0.25, 4);
      }
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.face * DASH_SPEED; p.vy = 0;
      p.trail.push({ x: p.x, y: p.y, face: p.face, life: 0.25 });
      if (p.dashT <= 0) p.vx = p.face * RUN;
    } else {
      if (dir) p.face = dir;
      p.vx = approach(p.vx, dir * RUN, (p.onGround ? 2800 : 1800) * dt);
      p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);
    }

    if (p.onGround) { p.coyote = 0.1; p.canDash = true; p.airJumps = 0; } else p.coyote -= dt;
    if (pressed.jump) { p.jumpBuf = 0.13; pressed.jump = false; } else p.jumpBuf -= dt;
    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        p.vy = -JUMP; p.coyote = 0; p.jumpBuf = 0; p.jumpHeld = true; p.dashT = 0;
        p.squash = -0.35; sfx.jump();
        burst(p.x + p.w / 2, p.y + p.h, 6, world ? ['#7a5aa8'] : ['#e8d7b0'], 120, 4, 0.35, 200);
      } else if (p.airJumps > 0) {
        p.vy = -JUMP * 0.92; p.airJumps--; p.jumpBuf = 0; p.jumpHeld = true; p.dashT = 0;
        sfx.airjump(); ring(p.x + p.w / 2, p.y + p.h, world ? '#b36bff' : '#ffe066', 26, 0.3, 4);
      }
    }
    if (p.jumpHeld && !keys.jump && p.vy < -250) { p.vy *= 0.5; p.jumpHeld = false; }
    if (p.vy >= 0) p.jumpHeld = false;

    if ((keys.shoot || mouse.down) && p.shootCD <= 0) firePlayer();
    if (pressed.portal) { pressed.portal = false; if (p.portalCD <= 0) openPortal(); }

    p.dropThrough = !!keys.down;
    moveEntity(p, dt, world);
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > LW * T - p.w) { p.x = LW * T - p.w; p.vx = 0; }
    if (!wasGround && p.onGround) {
      p.squash = 0.3;
      burst(p.x + p.w / 2, p.y + p.h, 5, world ? ['#7a5aa8'] : ['#e8d7b0'], 90, 4, 0.3, 100);
    }
    p.anim += Math.abs(p.vx) * dt * 0.05;
    for (const tr of p.trail) tr.life -= dt;
    p.trail = p.trail.filter((tr) => tr.life > 0);

    // espinhos
    const fx0 = Math.floor((p.x + 5) / T), fx1 = Math.floor((p.x + p.w - 5) / T);
    const fy = Math.floor((p.y + p.h - 6) / T);
    for (let tx = fx0; tx <= fx1; tx++) if (tileAt(tx, fy) === '^' && p.y + p.h > fy * T + 20) { hurtPlayer(1, p.x + p.w / 2 + (p.vx > 0 ? 20 : -20)); p.vy = -700; }

    // queda no abismo
    if (p.y > LH * T + 80) {
      hurtPlayer(1, p.x, true);
      if (P.hp > 0) {
        p.x = lastSafe.x; p.y = lastSafe.y; p.vx = 0; p.vy = 0;
        if (world !== lastSafe.world) setWorld(lastSafe.world, true);
        portal = null;
      }
    }
    // último ponto seguro (para voltar depois de cair)
    if (p.onGround && p.inv <= 0) {
      const bx = Math.floor((p.x + p.w / 2) / T), by = Math.floor((p.y + p.h + 2) / T);
      let danger = false;
      for (let dx = -1; dx <= 1; dx++) if (tileAt(bx + dx, by - 1) === '^' || tileAt(bx + dx, by) === '^') danger = true;
      if (!danger && isSolid(bx, by, world)) lastSafe = { x: p.x, y: p.y, world };
    }

    // atravessar o portal
    if (portal) {
      portal.t += dt;
      if (portal.t > portal.life) portal = null;
      else if (portal.ok && portal.t > 0.05) {
        const pr = { x: portal.x - 26, y: portal.y - 60, w: 52, h: 120 };
        if (overlap(p, pr)) {
          const other = 1 - world;
          let can = !rectSolid(p.x, p.y, p.w, p.h, other);
          if (!can && !rectSolid(portal.x - p.w / 2, portal.y - p.h / 2, p.w, p.h, other)) {
            p.x = portal.x - p.w / 2; p.y = portal.y - p.h / 2; can = true;
          }
          if (can) {
            portal = null;
            setWorld(other);
            p.airJumps = 1; p.canDash = true; p.dashCD = 0; p.inv = Math.max(p.inv, 0.35);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------------ inimigos */
  function enemyShoot(x, y, vx, vy, kind, r, grav) {
    ebul.push({ x, y, vx, vy, kind, r, grav: grav || 0, life: 4, world, t: 0 });
  }
  function updateEnemy(e, dt) {
    e.t += dt; e.flash -= dt; e.squash = approach(e.squash, 0, dt * 3);
    const c = pcenter();
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const dx = c.x - ex, dy = c.y - ey, dist = Math.hypot(dx, dy);
    switch (e.type) {
      case 'slime': {
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        if (e.onGround) {
          e.vx = approach(e.vx, 0, 1400 * dt);
          e.cd -= dt;
          if (e.cd <= 0) {
            const near = Math.abs(dx) < 430 && Math.abs(dy) < 220;
            e.face = near ? Math.sign(dx) || 1 : (Math.random() < 0.5 ? -1 : 1);
            if (!near && Math.abs(e.x - e.homeX) > 120) e.face = e.x > e.homeX ? -1 : 1;
            e.vy = near ? -560 : -300; e.vx = e.face * (near ? 170 : 80);
            e.cd = near ? 0.8 + Math.random() * 0.5 : 1.4 + Math.random();
            e.squash = -0.4;
          }
        }
        const was = e.onGround;
        moveEntity(e, dt, e.world);
        if (!was && e.onGround) e.squash = 0.4;
        break;
      }
      case 'bat': {
        if (dist < 330) {
          e.vx = approach(e.vx, Math.sign(dx) * 150, 420 * dt);
          e.vy = approach(e.vy, Math.sign(dy) * 110 + Math.sin(e.t * 5) * 110, 520 * dt);
        } else {
          e.vx = approach(e.vx, Math.sin(e.t * 0.9) * 90, 220 * dt);
          e.vy = approach(e.vy, (e.homeY - e.y) * 2 + Math.sin(e.t * 3) * 40, 320 * dt);
        }
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (Math.abs(e.vx) > 5) e.face = Math.sign(e.vx);
        break;
      }
      case 'shooter': {
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        moveEntity(e, dt, e.world);
        e.face = Math.sign(dx) || 1;
        e.cd -= dt;
        if (e.cd <= 0 && dist < 540) {
          e.cd = 2.1; e.stT = 0.35;
          const tt = 1.0;
          enemyShoot(ex + e.face * 12, e.y + 16, clamp(dx / tt, -420, 420), dy - 20 - 450 * tt, 'spore', 10, 900);
        }
        e.stT -= dt;
        break;
      }
      case 'crawler': {
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        const near = Math.abs(dx) < 280 && Math.abs(dy) < 90;
        if (near) e.face = Math.sign(dx) || 1;
        const sp = near ? 215 : 100;
        e.vx = e.face * sp;
        if (e.onGround) {
          const fx = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
          const ftx = Math.floor(fx / T), fty = Math.floor((e.y + e.h + 4) / T);
          if (!isSolid(ftx, fty, e.world) && tileAt(ftx, fty) !== '=') { e.face *= -1; e.vx = near ? 0 : e.face * sp; }
        }
        const r = moveEntity(e, dt, e.world);
        if (r.hitX) e.face *= -1;
        break;
      }
      case 'eye': {
        const tx = clamp(c.x, e.homeX - 170, e.homeX + 170);
        e.x += (tx - ex) * dt * 0.8;
        e.y = e.homeY + Math.sin(e.t * 2) * 14;
        e.face = Math.sign(dx) || 1;
        e.cd -= dt;
        if (dist < 540 && e.cd <= 0) {
          e.cd = 1.9; e.stT = 0.3;
          const s = 250;
          enemyShoot(ex, ey, dx / dist * s, dy / dist * s, 'orb', 9, 0);
        }
        e.stT -= dt;
        break;
      }
      case 'hand': {
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        if (e.onGround) {
          e.vx = approach(e.vx, 0, 1500 * dt);
          e.cd -= dt;
          const near = Math.abs(dx) < 470 && Math.abs(dy) < 240;
          if (e.cd <= 0) {
            e.face = near ? Math.sign(dx) || 1 : (e.x > e.homeX ? -1 : 1);
            e.vy = near ? -650 : -380; e.vx = e.face * (near ? 240 : 90);
            e.cd = 1.0 + Math.random() * 0.6;
          }
        }
        moveEntity(e, dt, e.world);
        break;
      }
      case 'guardian': {
        e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
        e.cd -= dt; e.stT -= dt;
        if (e.st === 'walk') {
          e.vx = e.face * 80;
          if (e.x < e.homeX - 330) e.face = 1;
          if (e.x > e.homeX + 280) e.face = -1;
          if (e.cd <= 0 && Math.abs(dx) < 520 && Math.abs(dy) < 160) { e.st = 'wind'; e.stT = 0.6; e.face = Math.sign(dx) || 1; }
        } else if (e.st === 'wind') {
          e.vx = 0;
          if (e.stT <= 0) { e.st = 'charge'; e.stT = 1.0; sfx.roar(); }
        } else if (e.st === 'charge') {
          e.vx = e.face * 430;
          if (e.stT <= 0) { e.st = 'walk'; e.cd = 2.0; }
        }
        const r = moveEntity(e, dt, e.world);
        if (r.hitX) {
          if (e.st === 'charge') { shake = 10; e.st = 'walk'; e.cd = 2.0; sfx.slam(); }
          e.face *= -1;
        }
        break;
      }
    }
    // dano por contato
    if (world === e.world && overlap(P, { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 6 })) hurtPlayer(1, ex);
    if (e.y > LH * T + 200) e.dead = true;
  }
  function damageEnemy(e, n) {
    e.hp -= n; e.flash = 0.12;
    e.vx += Math.sign(e.x + e.w / 2 - P.x - P.w / 2) * 60;
    sfx.hit();
    if (e.hp <= 0) {
      e.dead = true; kills++;
      sfx.kill(); shake = Math.max(shake, 5);
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const cols = e.world ? ['#b36bff', '#ff6ad5', '#63f5ff', '#2b1840'] : ['#7be05a', '#ffe066', '#ff8fb1', '#fff'];
      burst(cx, cy, e.type === 'guardian' ? 50 : 22, cols, 340, 6, 0.8);
      ring(cx, cy, cols[0], e.w, 0.35, 5);
      if (e.type === 'guardian') {
        pickups.push({ type: 'rune', x: cx, y: cy - 20, world: AVESSO, t: 0, vy: -420, grav: true });
        toast('O Guardião do Avesso deixou cair uma RUNA!', '#d9a6ff', 3);
      } else if (!e.summoned && Math.random() < 0.14) {
        pickups.push({ type: 'heart', x: cx, y: cy, world: -1, t: 0, vy: -300, grav: true });
      }
    }
  }

  /* ------------------------------------------------------------------ chefe */
  const ARENA_L = 160 * T, ARENA_R = 189 * T, FLOOR_Y = 12 * T;
  function makeBoss() {
    return {
      x: 176 * T, y: 4.5 * T, r: 76, hp: 70, maxHp: 70, t: 0, atk: 2.2, active: false, dead: false, deadT: 0,
      flash: 0, shield: 0, vuln: AVESSO, flipT: 6.5, phase: 1, slam: null, mouth: 0, hintT: 0,
    };
  }
  function resetBoss() {
    const nb = makeBoss();
    Object.assign(boss, nb);
    enemies = enemies.filter((e) => !e.summoned);
    audio.setBoss(false);
  }
  function worldName(w) { return w ? 'MUNDO AVESSO' : 'MUNDO NORMAL'; }
  function updateBoss(dt) {
    const b = boss;
    if (!b.active) return;
    b.t += dt; b.flash -= dt; b.shield -= dt; b.mouth = approach(b.mouth, 0, dt * 2); b.hintT -= dt;
    if (b.dead) {
      b.deadT += dt;
      if (Math.random() < 0.5) burst(b.x + rand(-80, 80), b.y + rand(-80, 80), 8, ['#ff6ad5', '#ffe066', '#63f5ff', '#fff'], 300, 7, 0.7, 0);
      shake = Math.max(shake, 6);
      if (b.deadT > 2.6 && state === 'play') { state = 'win'; winT = 0; sfx.win(); audio.setBoss(false); }
      return;
    }
    const c = pcenter();
    const cx = (ARENA_L + ARENA_R) / 2;
    if (b.slam) {
      const s = b.slam;
      s.t += dt;
      if (s.st === 'aim') {
        b.x = lerp(b.x, clamp(c.x, ARENA_L + 100, ARENA_R - 100), dt * 3);
        b.y = lerp(b.y, 3.8 * T, dt * 3);
        if (s.t > 0.7) { s.st = 'drop'; s.t = 0; s.vy = 0; }
      } else if (s.st === 'drop') {
        s.vy += 3200 * dt; b.y += s.vy * dt;
        if (b.y + b.r * 0.8 >= FLOOR_Y) {
          b.y = FLOOR_Y - b.r * 0.8; s.st = 'rest'; s.t = 0; shake = 16; sfx.slam();
          enemyShoot(b.x - 40, FLOOR_Y - 16, -340, 0, 'wave', 16, 0);
          enemyShoot(b.x + 40, FLOOR_Y - 16, 340, 0, 'wave', 16, 0);
          burst(b.x, FLOOR_Y, 30, world ? ['#7a5aa8', '#63f5ff'] : ['#e8d7b0', '#ffe066'], 400, 7, 0.7);
        }
      } else if (s.st === 'rest' && s.t > 0.6) b.slam = null;
    } else {
      b.x = lerp(b.x, cx + Math.sin(b.t * 0.45) * 270, dt * 1.5);
      b.y = lerp(b.y, 5.1 * T + Math.sin(b.t * 1.2) * 30, dt * 2);
    }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2; b.vuln = NORMAL; b.flipT = 6.5; sfx.roar(); shake = 14;
      toast('O núcleo fugiu para o ' + worldName(b.vuln) + '!', '#ffe066', 3);
    }
    if (b.phase === 2) {
      b.flipT -= dt;
      if (b.flipT <= 0) {
        b.flipT = 6.5; b.vuln = 1 - b.vuln; sfx.roar();
        toast('O núcleo trocou de mundo: agora está no ' + worldName(b.vuln) + '!', '#ffe066', 3);
      }
    }
    b.atk -= dt;
    if (b.atk <= 0 && !b.slam) {
      b.atk = b.phase === 1 ? 2.2 : 1.6;
      const summoned = enemies.filter((e) => e.summoned && !e.dead).length;
      const opts = ['spit', 'burst', 'slam', 'spit', 'burst'];
      if (summoned < 3) opts.push('summon');
      const a = opts[Math.floor(Math.random() * opts.length)];
      b.mouth = 1;
      if (a === 'spit') {
        const tt = 1.05;
        for (let i = -1; i <= 1; i++) {
          const dx = c.x - b.x + i * 110, dy = c.y - (b.y + 30);
          enemyShoot(b.x, b.y + 30, clamp(dx / tt, -600, 600), dy - 450 * tt, 'goo', 12, 900);
        }
      } else if (a === 'burst') {
        const n = b.phase === 1 ? 12 : 16;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + b.t;
          enemyShoot(b.x, b.y, Math.cos(ang) * 210, Math.sin(ang) * 210, 'orb', 10, 0);
        }
      } else if (a === 'slam') {
        b.slam = { st: 'aim', t: 0 };
      } else if (a === 'summon') {
        for (const s of [-1, 1]) {
          const e = makeEnemy(world ? 'hand' : 'slime', b.x + s * 70, b.y + 40, { summoned: true });
          e.world = world; e.vy = -200; e.vx = s * 150;
          enemies.push(e);
        }
        floatText(b.x, b.y - 100, 'Crias bizarras!', '#ffb3e6');
      }
    }
    // contato
    const nx = clamp(b.x, P.x, P.x + P.w), ny = clamp(b.y, P.y, P.y + P.h);
    if (Math.hypot(b.x - nx, b.y - ny) < b.r * 0.82) hurtPlayer(1, b.x);
  }
  function hitBoss(bl) {
    const b = boss;
    if (world === b.vuln) {
      b.hp -= 1; b.flash = 0.08; sfx.hit();
      burst(bl.x, bl.y, 5, ['#ff4f6d', '#fff'], 200, 4, 0.3);
      if (b.hp <= 0) {
        b.dead = true; b.deadT = 0; kills++;
        enemies.forEach((e) => { if (e.summoned) e.dead = true; });
        ebul = []; sfx.roar();
        toast('O REI BIZARRO FOI DERROTADO!', '#ffe066', 3);
      }
    } else {
      b.shield = 0.25; sfx.tink();
      burst(bl.x, bl.y, 6, ['#ffe066', '#fff'], 220, 3, 0.25);
      if (b.hintT <= 0) {
        b.hintT = 2.5;
        floatText(b.x, b.y - b.r - 30, 'ESCUDO! O núcleo está no ' + worldName(b.vuln), '#ffe066');
      }
    }
  }

  /* ------------------------------------------------------------------ atualização */
  const QUESTS = [
    () => 'Siga para o leste pelo Reino Encantado',
    () => 'Atravesse o muro de espinhos: abra um PORTAL com E',
    () => 'No Avesso a ponte some! Volte ao Mundo Normal com outro portal',
    () => 'Fale com o Sábio Cogumelo',
    () => `Encontre as Runas do Avesso (${runes}/3)`,
    () => 'Leve as runas ao Portão do Castelo Bizarro',
    () => 'Entre no castelo e enfrente o Rei Bizarro',
    () => 'Derrote o Rei Bizarro Mil-Olhos!',
  ];
  function updateQuest() {
    // o objetivo é derivado do progresso, então pular uma etapa (ex.: passar pelo sábio no Avesso) nunca trava a quest
    const px = P.x / T;
    let q = 0;
    if (px > 31) q = 1;
    if (px > 39.5) q = 2;
    if (px > 56.5) q = 3;
    if (sage.talked || px > 64) q = 4;
    if (runes >= 3) q = 5;
    if (gateOpen || bossTriggered) q = 6;
    if (boss.active) q = 7;
    quest = Math.max(quest, q);
  }

  function update(dt) {
    time += dt;
    for (const t of toasts) t.t += dt;
    toasts = toasts.filter((t) => t.t < t.dur);
    shake = Math.max(0, shake - dt * 30);
    switchFx = Math.max(0, switchFx - dt * 2.2);
    fade = Math.max(0, fade - dt * 1.5);

    if (state === 'title') {
      cam.x = (Math.sin(time * 0.05) * 0.5 + 0.5) * (60 * T); cam.y = LH * T - VH;
      if (pressed.start || pressed.click) { pressed.start = pressed.click = false; newGame(); state = 'play'; audio.startMusic(); pressed.jump = false; }
      return;
    }
    if (state === 'win') {
      winT += dt;
      if (Math.random() < 0.3) burst(rand(cam.x, cam.x + VW), cam.y - 10, 1, ['#ff6ad5', '#ffe066', '#63f5ff', '#7be05a'], 60, 7, 3, 200);
      updateParticles(dt);
      if (winT > 1.5 && (pressed.start || pressed.click)) { pressed.start = pressed.click = false; newGame(); state = 'play'; }
      return;
    }
    if (pressed.pause) { pressed.pause = false; state = state === 'paused' ? 'play' : 'paused'; }
    if (state === 'paused') return;

    playTime += dt;
    updatePlayer(dt);

    // inimigos (só os do mundo atual e perto da câmera)
    for (const e of enemies) {
      if (e.dead || e.world !== world) continue;
      if (e.x + e.w < cam.x - 420 || e.x > cam.x + VW + 420) continue;
      updateEnemy(e, dt);
    }
    enemies = enemies.filter((e) => !e.dead);
    updateBoss(dt);

    // tiros do jogador
    for (const b of pbul) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (rectSolid(b.x - 2, b.y - 2, 4, 4, world)) { b.life = 0; burst(b.x, b.y, 5, world ? ['#63f5ff'] : ['#ffe066'], 120, 3, 0.25, 0); continue; }
      for (const e of enemies) {
        if (e.world !== world || e.dead) continue;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y - 4 && b.y < e.y + e.h + 4) { b.life = 0; damageEnemy(e, 1); break; }
      }
      if (b.life > 0 && boss.active && !boss.dead && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r) { b.life = 0; hitBoss(b); }
    }
    pbul = pbul.filter((b) => b.life > 0);
    enemies = enemies.filter((e) => !e.dead);

    // tiros inimigos
    for (const b of ebul) {
      b.t += dt; b.life -= dt;
      b.vy += b.grav * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.kind === 'wave') {
        if (rectSolid(b.x - 8, b.y - 8, 16, 12, world)) b.life = 0;
      } else if (rectSolid(b.x - 3, b.y - 3, 6, 6, world)) {
        b.life = 0; burst(b.x, b.y, 6, b.kind === 'goo' || b.kind === 'spore' ? ['#9be15d', '#5f9e2f'] : ['#ff6ad5', '#b36bff'], 140, 4, 0.3);
      }
      const hb = b.kind === 'wave' ? { x: b.x - 14, y: b.y - 22, w: 28, h: 38 } : { x: b.x - b.r * 0.7, y: b.y - b.r * 0.7, w: b.r * 1.4, h: b.r * 1.4 };
      if (b.life > 0 && overlap(P, hb) && P.inv <= 0 && P.dashT <= 0) { b.life = 0; hurtPlayer(1, b.x); }
    }
    ebul = ebul.filter((b) => b.life > 0 && b.y < LH * T + 100);

    // itens
    for (const it of pickups) {
      it.t += dt;
      if (it.grav) {
        it.vy += 1400 * dt; it.y += it.vy * dt;
        const ty = Math.floor((it.y + 14) / T);
        if (it.vy > 0 && isSolid(Math.floor(it.x / T), ty, it.world === -1 ? world : it.world)) { it.y = ty * T - 14; it.vy = 0; it.grav = false; }
      }
      if (it.world !== -1 && it.world !== world) continue;
      if (Math.abs(it.x - (P.x + P.w / 2)) < 30 && Math.abs(it.y - (P.y + P.h / 2)) < 38) {
        it.taken = true;
        if (it.type === 'heart') {
          P.hp = Math.min(P.maxHp, P.hp + 1); sfx.pickup(); floatText(it.x, it.y - 20, '+1 vida', '#ff8fb1');
          burst(it.x, it.y, 12, ['#ff4f6d', '#ffd1dc'], 200, 4, 0.5, 0);
        } else {
          runes++; sfx.rune(); shake = 6;
          burst(it.x, it.y, 30, ['#b36bff', '#63f5ff', '#fff'], 320, 5, 0.8, 0);
          ring(it.x, it.y, '#d9a6ff', 80, 0.5, 6);
          toast(`Runa do Avesso ${runes}/3!`, '#d9a6ff', 2.6);
          if (runes === 3) toast('Todas as runas! O Portão do Castelo vai se abrir.', '#fff7b0', 3.2);
        }
      }
    }
    pickups = pickups.filter((it) => !it.taken);

    // checkpoints
    for (const cp of checkpoints) {
      if (!cp.on && Math.abs(cp.x - (P.x + P.w / 2)) < 36 && Math.abs(cp.y - (P.y + P.h)) < 60) {
        checkpoints.forEach((o) => { if (o.x < cp.x) o.on = true; });
        cp.on = true;
        checkpoint = { x: cp.x - P.w / 2, y: cp.y - P.h, world };
        P.hp = P.maxHp;
        sfx.check(); floatText(cp.x, cp.y - 90, 'Checkpoint! Vida cheia', '#fff7b0');
        burst(cp.x, cp.y - 50, 18, ['#ffe066', '#fff'], 200, 4, 0.6, 0);
      }
    }
    // sábio cogumelo
    sage.near = Math.abs(sage.x - (P.x + P.w / 2)) < 150 && world === NORMAL;
    if (sage.near) {
      if (!sage.talked) { sage.talked = true; sage.line = 0; sage.lineT = 0; }
      sage.lineT += dt;
      if (sage.lineT > 3.6) { sage.lineT = 0; sage.line = (sage.line + 1) % SAGE_LINES.length; }
    }
    // portão
    if (!gateOpen && !bossTriggered && runes >= 3 && P.x > 150 * T) {
      gateOpen = true; sfx.gate(); shake = 10;
      toast('O Portão do Castelo se abriu!', '#fff7b0', 3);
    }
    gateLift = approach(gateLift, gateOpen ? 1 : 0, dt * (gateOpen ? 0.8 : 4));
    if (!bossTriggered && gateOpen && P.x > 164 * T) {
      bossTriggered = true;
    }
    if (bossTriggered && !boss.active && !boss.dead && P.x > 164 * T) {
      boss.active = true; gateOpen = false; sfx.gate(); sfx.roar(); shake = 18;
      audio.setBoss(true);
      toast('O REI BIZARRO MIL-OLHOS despertou!', '#ff8fb1', 3);
      toast('Dica: o núcleo dele fica exposto no ' + worldName(boss.vuln) + '.', '#ffe066', 4);
    }
    updateQuest();
    updateParticles(dt);
    updateCamera(dt);
  }
  const SAGE_LINES = [
    'Olá, viajante! O Rei Bizarro Mil-Olhos corrompeu o nosso Reino.',
    'O Portão do Castelo só se abre com as 3 RUNAS DO AVESSO.',
    'As runas só existem no Mundo Avesso. Use seus portais com sabedoria!',
    'Uma runa fica no alto da escada de cristal, outra na rocha alta...',
    '...e a última está com o Guardião do Avesso. Cuidado com as investidas dele!',
  ];
  function updateParticles(dt) {
    for (const p of parts) {
      p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dot') { p.vx *= 1 - dt * 2; }
    }
    parts = parts.filter((p) => p.life > 0);
    if (parts.length > 700) parts.splice(0, parts.length - 700);
  }
  function updateCamera(dt) {
    let tx = P.x + P.w / 2 - VW / 2 + P.face * 70;
    let ty = P.y + P.h / 2 - VH * 0.58;
    if (boss.active && !boss.dead) ty = 80;
    let minX = 0, maxX = LW * T - VW;
    if (boss.active && !boss.dead) minX = GATE_X * T - 40;
    tx = clamp(tx, minX, maxX); ty = clamp(ty, 0, LH * T - VH - 72);
    cam.x = lerp(cam.x, tx, Math.min(1, dt * 6));
    cam.y = lerp(cam.y, ty, Math.min(1, dt * 4));
  }

  /* ------------------------------------------------------------------ desenho: fundo */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function each(p, spacing, fn) {
    const o = cam.x * p;
    const i0 = Math.floor(o / spacing) - 1, i1 = Math.floor((o + VW) / spacing) + 1;
    for (let i = i0; i <= i1; i++) fn(i * spacing - o, i);
  }
  function ridge(p, base, amp, freq, color, seed, top) {
    const o = cam.x * p;
    const yo = -(cam.y - (LH * T - VH)) * p * 0.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (top) ctx.moveTo(0, 0); else ctx.moveTo(0, VH);
    for (let x = 0; x <= VW + 16; x += 16) {
      const wx = x + o;
      const h = Math.sin(wx * freq + seed) * amp + Math.sin(wx * freq * 2.3 + seed * 2) * amp * 0.45 + Math.sin(wx * freq * 0.37 + seed) * amp * 0.8;
      ctx.lineTo(x, (top ? base - h : base + h) + yo);
    }
    ctx.lineTo(VW + 16, top ? 0 : VH);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(43,24,64,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  }
  function cloud(x, y, s, color, outline) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 26 * s, y - 16 * s, 26 * s, Math.PI, Math.PI * 1.9);
    ctx.arc(x + 58 * s, y - 10 * s, 22 * s, Math.PI * 1.2, Math.PI * 2);
    ctx.arc(x + 76 * s, y + 4 * s, 18 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath(); ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.stroke(); }
  }
  function drawBgNormal() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#6ec8ff'); g.addColorStop(0.55, '#bfe8ff'); g.addColorStop(1, '#ffd6ef');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // sol sorridente
    const sx = 780 - cam.x * 0.02, sy = 95;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(time * 0.2);
    ctx.fillStyle = 'rgba(255,236,140,0.45)';
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(-10, 50); ctx.lineTo(0, 88); ctx.lineTo(10, 50); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f2a93b'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(sx - 15, sy - 6, 5, 0, Math.PI * 2); ctx.arc(sx + 15, sy - 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy + 6, 14, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#ff9fb8'; ctx.beginPath(); ctx.arc(sx - 27, sy + 8, 6, 0, Math.PI * 2); ctx.arc(sx + 27, sy + 8, 6, 0, Math.PI * 2); ctx.fill();
    // nuvens distantes
    each(0.06, 380, (x, i) => cloud(x + hash(i, 1) * 120 + ((time * 8) % 380), 70 + hash(i, 2) * 90, 0.8 + hash(i, 3) * 0.5, 'rgba(255,255,255,0.85)'));
    // montanhas lilás com neve
    ridge(0.1, 330, 40, 0.006, '#b9a3e8', 1.3);
    // ilhas flutuantes com cachoeira
    each(0.18, 620, (x, i) => {
      const y = 170 + hash(i, 5) * 80 + Math.sin(time + i) * 6 - (cam.y - (LH * T - VH)) * 0.1;
      const s = 0.7 + hash(i, 6) * 0.5;
      ctx.save(); ctx.translate(x + hash(i, 7) * 200, y); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(160,220,255,0.7)'; ctx.fillRect(38, 10, 14, 120 + Math.sin(time * 3) * 3);
      ctx.fillStyle = '#a0765a'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(10, 70); ctx.lineTo(-20, 50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#7ed36a'; roundRect(-66, -12, 132, 20, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.arc(-20, -30, 20, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-26, -38, 4, 0, 7); ctx.arc(-12, -36, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#f3e3c4'; ctx.fillRect(-24, -30, 8, 18);
      ctx.restore();
    });
    // colinas verdes
    ridge(0.3, 420, 30, 0.009, '#8fe07c', 4.1);
    // cogumelos gigantes e árvores-pirulito
    each(0.45, 260, (x, i) => {
      const h = hash(i, 9);
      const yb = 470 - (cam.y - (LH * T - VH)) * 0.3;
      const bx = x + h * 120;
      if (h < 0.5) {
        const s = 0.8 + hash(i, 10) * 0.7;
        ctx.save(); ctx.translate(bx, yb); ctx.scale(s, s);
        ctx.fillStyle = '#f7e6c9'; roundRect(-10, -90, 20, 90, 8); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = h < 0.25 ? '#ff5d73' : '#9b6bff';
        ctx.beginPath(); ctx.ellipse(0, -90, 52, 36, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        [[-25, -105, 7], [5, -115, 9], [28, -100, 6], [-5, -97, 5]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); });
        ctx.restore();
      } else {
        const s = 0.8 + hash(i, 11) * 0.6;
        ctx.save(); ctx.translate(bx, yb); ctx.scale(s, s);
        ctx.strokeStyle = OL; ctx.lineWidth = 3;
        ctx.fillStyle = '#a86b3c'; roundRect(-7, -80, 14, 80, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hash(i, 12) < 0.5 ? '#63d68a' : '#ffb347';
        ctx.beginPath(); ctx.arc(0, -100, 38, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -100, 22, time * 0.5, time * 0.5 + 4); ctx.stroke();
        ctx.restore();
      }
    });
    // vagalumes/brilhos
    for (let i = 0; i < 18; i++) {
      const x = ((hash(i, 20) * 1400 - cam.x * 0.6) % 1100 + 1100) % 1100 - 70 + Math.sin(time + i) * 20;
      const y = 120 + hash(i, 21) * 320 + Math.cos(time * 1.3 + i) * 18;
      ctx.fillStyle = `rgba(255,250,200,${0.4 + 0.4 * Math.sin(time * 3 + i)})`;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    }
  }
  function drawBgAvesso() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#12032b'); g.addColorStop(0.5, '#3a0f5e'); g.addColorStop(1, '#0d5a66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // estrelas
    for (let i = 0; i < 70; i++) {
      const x = ((hash(i, 30) * 2000 - cam.x * 0.03) % 980 + 980) % 980;
      const y = hash(i, 31) * 330;
      ctx.fillStyle = `rgba(255,220,255,${0.3 + 0.5 * Math.abs(Math.sin(time * 1.5 + i))})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // o Olho-Lua que observa o jogador
    const mx = 700 - cam.x * 0.02, my = 110;
    ctx.fillStyle = 'rgba(255,106,213,0.12)'; ctx.beginPath(); ctx.arc(mx, my, 90, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5e9ff'; ctx.beginPath(); ctx.ellipse(mx, my, 62, 40, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff6ad5'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,60,100,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(mx - 60 + i * 3, my - 10 + i * 5); ctx.quadraticCurveTo(mx - 45, my + i * 4 - 8, mx - 30, my - 4 + i * 2); ctx.stroke(); }
    const lx = clamp((P ? P.x - cam.x : VW / 2) - mx, -300, 300) / 300 * 22;
    const ly = clamp((P ? P.y - cam.y : VH / 2) - my, -300, 300) / 300 * 12;
    ctx.fillStyle = '#6a1b9a'; ctx.beginPath(); ctx.arc(mx + lx, my + ly, 22, 0, 7); ctx.fill();
    ctx.fillStyle = '#12032b'; ctx.beginPath(); ctx.ellipse(mx + lx, my + ly, 6, 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + lx + 8, my + ly - 8, 5, 0, 7); ctx.fill();
    const blink = (Math.sin(time * 0.7) > 0.985) ? 1 : 0;
    if (blink) { ctx.fillStyle = '#3a0f5e'; ctx.beginPath(); ctx.ellipse(mx, my, 64, 42, 0, 0, 7); ctx.fill(); }
    // montanhas penduradas (de cabeça pra baixo)
    ridge(0.08, 60, 35, 0.007, '#2a0d4a', 2.2, true);
    ridge(0.1, 360, 40, 0.006, '#26104a', 1.3);
    // ilhas invertidas com cristais
    each(0.2, 560, (x, i) => {
      const y = 120 + hash(i, 40) * 90 + Math.sin(time * 0.8 + i) * 8;
      const s = 0.7 + hash(i, 41) * 0.5;
      ctx.save(); ctx.translate(x + hash(i, 42) * 180, y); ctx.scale(s, -s);
      ctx.fillStyle = '#3d1d63'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(10, 70); ctx.lineTo(-20, 50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff6ad5'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#63f5ff';
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-22, -34); ctx.lineTo(-14, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -46); ctx.lineTo(30, 0); ctx.fill();
      ctx.restore();
    });
    ridge(0.3, 430, 30, 0.009, '#1b3350', 4.1);
    // árvores mortas com frutos brilhantes e cogumelos pendurados
    each(0.45, 240, (x, i) => {
      const h = hash(i, 50);
      const yb = 480 - (cam.y - (LH * T - VH)) * 0.3;
      const bx = x + h * 110;
      ctx.save(); ctx.translate(bx, yb);
      const s = 0.8 + hash(i, 51) * 0.6; ctx.scale(s, s);
      ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -60, 4, -110); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(2, -70); ctx.quadraticCurveTo(30, -90, 40, -120); ctx.moveTo(0, -90); ctx.quadraticCurveTo(-30, -100, -38, -130); ctx.stroke();
      const pulse = 0.6 + 0.4 * Math.sin(time * 2 + i);
      ctx.fillStyle = `rgba(255,106,213,${pulse})`;
      [[40, -120], [-38, -130], [4, -112]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 7, 0, 7); ctx.fill(); });
      ctx.restore();
    });
    // partículas subindo
    for (let i = 0; i < 26; i++) {
      const x = ((hash(i, 60) * 1500 - cam.x * 0.5) % 1000 + 1000) % 1000 - 20;
      const y = VH - ((time * (20 + hash(i, 61) * 30) + hash(i, 62) * VH) % (VH + 40));
      ctx.fillStyle = i % 2 ? 'rgba(99,245,255,0.6)' : 'rgba(255,106,213,0.6)';
      ctx.beginPath(); ctx.arc(x, y, 2 + hash(i, 63) * 2, 0, 7); ctx.fill();
    }
  }

  /* ------------------------------------------------------------------ desenho: blocos */
  function solidVis(tx, ty, w) {
    const c = tileAt(tx, ty);
    return c === '#' || (c === 'N' && w === NORMAL) || (c === 'I' && w === AVESSO);
  }
  function edges(x, y, up, dn, lf, rt, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath();
    if (!up) { ctx.moveTo(x, y + 1.5); ctx.lineTo(x + T, y + 1.5); }
    if (!dn) { ctx.moveTo(x, y + T - 1.5); ctx.lineTo(x + T, y + T - 1.5); }
    if (!lf) { ctx.moveTo(x + 1.5, y); ctx.lineTo(x + 1.5, y + T); }
    if (!rt) { ctx.moveTo(x + T - 1.5, y); ctx.lineTo(x + T - 1.5, y + T); }
    ctx.stroke();
  }
  function drawGroundTile(tx, ty, x, y, w) {
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w) || ty === LH - 1, lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    const h = hash(tx, ty);
    if (w === NORMAL) {
      const depth = Math.min(ty - 11, 4);
      ctx.fillStyle = ['#d0935a', '#c98a4f', '#bb7c44', '#ad6f3b', '#9f6433'][clamp(depth, 0, 4)];
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = 'rgba(90,45,20,0.25)';
      ctx.beginPath(); ctx.ellipse(x + 10 + h * 26, y + 16 + h * 18, 6, 4, 0, 0, 7); ctx.ellipse(x + 34 - h * 14, y + 36 - h * 10, 4, 3, 0, 0, 7); ctx.fill();
      edges(x, y, up, dn, lf, rt, OL);
      if (!up) {
        ctx.fillStyle = '#6fd35a';
        ctx.beginPath(); ctx.moveTo(x - (lf ? 0 : 3), y);
        ctx.lineTo(x + T + (rt ? 0 : 3), y); ctx.lineTo(x + T + (rt ? 0 : 3), y + 10);
        for (let i = 3; i >= 0; i--) ctx.arc(x + 6 + i * 12, y + 10, 6, 0, Math.PI);
        ctx.lineTo(x - (lf ? 0 : 3), y + 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - (lf ? 0 : 3), y + 1.5); ctx.lineTo(x + T + (rt ? 0 : 3), y + 1.5); ctx.stroke();
        ctx.fillStyle = '#a4f08a'; ctx.fillRect(x, y + 4, T, 3);
        if (h > 0.55) {
          // tufos e flores
          ctx.strokeStyle = '#3f9b4a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + 11, y - 8); ctx.moveTo(x + 17, y); ctx.lineTo(x + 18, y - 10); ctx.stroke();
          if (h > 0.78) {
            const fc = ['#ff6fa3', '#ffe066', '#8fd3ff', '#c38bff'][Math.floor(h * 97) % 4];
            ctx.strokeStyle = '#3f9b4a'; ctx.beginPath(); ctx.moveTo(x + 32, y); ctx.lineTo(x + 32, y - 13); ctx.stroke();
            ctx.fillStyle = fc; ctx.beginPath();
            for (let k = 0; k < 5; k++) { const a = k * 1.256 + time * 0.5; ctx.moveTo(x + 32, y - 15); ctx.arc(x + 32 + Math.cos(a) * 4, y - 15 + Math.sin(a) * 4, 3.5, 0, 7); }
            ctx.fill(); ctx.fillStyle = '#fff7b0'; ctx.beginPath(); ctx.arc(x + 32, y - 15, 2.5, 0, 7); ctx.fill();
          }
        }
      }
    } else {
      const depth = Math.min(ty - 11, 4);
      ctx.fillStyle = ['#44296b', '#3b2560', '#332055', '#2b1a4a', '#241540'][clamp(depth, 0, 4)];
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = 'rgba(99,245,255,0.12)';
      ctx.beginPath(); ctx.moveTo(x + 8 + h * 20, y + 18); ctx.lineTo(x + 16 + h * 20, y + 30); ctx.lineTo(x + 4 + h * 20, y + 32); ctx.fill();
      edges(x, y, up, dn, lf, rt, '#0b0418');
      if (!up) {
        ctx.fillStyle = 'rgba(62,240,208,0.18)'; ctx.fillRect(x, y - 8, T, 8);
        ctx.fillStyle = '#3ef0d0'; ctx.fillRect(x - (lf ? 0 : 2), y, T + (lf ? 0 : 2) + (rt ? 0 : 2), 7);
        ctx.fillStyle = '#2bc3a8';
        const d1 = 6 + h * 30, len = 6 + Math.sin(time * 2 + tx) * 3 + h * 8;
        roundRect(x + d1, y + 4, 5, len, 2.5); ctx.fill();
        if (h > 0.6) {
          ctx.fillStyle = '#ff6ad5';
          ctx.beginPath(); ctx.moveTo(x + 30, y); ctx.lineTo(x + 34, y - 14 - h * 6); ctx.lineTo(x + 38, y); ctx.fill();
          ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }
  }
  function drawVineTile(tx, ty, x, y) {
    const w = NORMAL;
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w), lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    const h = hash(tx, ty);
    ctx.fillStyle = '#3e9a4d'; ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.strokeStyle = '#2d7a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y + 12 + h * 20); ctx.bezierCurveTo(x + 16, y + h * 40, x + 30, y + 48 - h * 30, x + T, y + 20 + h * 10); ctx.stroke();
    ctx.fillStyle = '#62c46a';
    for (let k = 0; k < 3; k++) {
      const a = hash(tx + k, ty * 3) * 6;
      ctx.beginPath(); ctx.ellipse(x + 8 + k * 14, y + 10 + hash(ty, tx + k) * 28, 8, 4, a, 0, 7); ctx.fill();
    }
    if (h > 0.55) { ctx.fillStyle = '#ff8fcf'; ctx.beginPath(); ctx.arc(x + 24, y + 24, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff7b0'; ctx.beginPath(); ctx.arc(x + 24, y + 24, 1.6, 0, 7); ctx.fill(); }
    // espinhos nas bordas expostas
    ctx.fillStyle = '#f3efd8'; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    const thorn = (ax, ay, bx, by, cx, cy) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    if (!lf) for (let k = 0; k < 2; k++) thorn(x, y + 8 + k * 22, x - 8, y + 14 + k * 22, x, y + 18 + k * 22);
    if (!rt) for (let k = 0; k < 2; k++) thorn(x + T, y + 8 + k * 22, x + T + 8, y + 14 + k * 22, x + T, y + 18 + k * 22);
    edges(x, y, up, dn, lf, rt, OL);
    if (!up) { ctx.fillStyle = '#7fe08a'; ctx.fillRect(x, y + 3, T, 4); }
  }
  function drawCrystalTile(tx, ty, x, y) {
    const w = AVESSO;
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w), lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    const g = ctx.createLinearGradient(x, y, x + T, y + T);
    g.addColorStop(0, '#7df9ff'); g.addColorStop(1, '#b066ff');
    ctx.fillStyle = 'rgba(125,249,255,0.18)'; ctx.fillRect(x - 5, y - 5, T + 10, T + 10);
    ctx.fillStyle = g; ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 24, y + 22); ctx.lineTo(x + T - 4, y + 6); ctx.moveTo(x + 24, y + 22); ctx.lineTo(x + 20, y + T - 4); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(time * 3 + tx)})`;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + 18, y + 8); ctx.lineTo(x + 8, y + 18); ctx.fill();
    edges(x, y, up, dn, lf, rt, '#1b0b33');
  }
  function drawGhosts(x0, x1, y0, y1) {
    ctx.save();
    ctx.setLineDash([7, 6]); ctx.lineWidth = 2;
    ctx.globalAlpha = 0.32 + 0.1 * Math.sin(time * 3);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = grid[ty][tx];
      if ((c === 'N' && world === AVESSO) || (c === 'I' && world === NORMAL)) {
        const x = tx * T - cam.x, y = ty * T - cam.y;
        ctx.strokeStyle = c === 'I' ? '#9b4dff' : '#4ee07a';
        ctx.fillStyle = c === 'I' ? 'rgba(155,77,255,0.12)' : 'rgba(78,224,122,0.12)';
        ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
        ctx.strokeRect(x + 4, y + 4, T - 8, T - 8);
      }
    }
    ctx.restore();
  }
  function drawTiles() {
    const x0 = Math.max(0, Math.floor(cam.x / T)), x1 = Math.min(LW - 1, Math.floor((cam.x + VW) / T));
    const y0 = Math.max(0, Math.floor(cam.y / T)), y1 = Math.min(LH - 1, Math.floor((cam.y + VH) / T));
    drawCastle();
    drawGhosts(x0, x1, y0, y1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = grid[ty][tx];
      if (c === '.' || c === 'G') continue;
      const x = Math.round(tx * T - cam.x), y = Math.round(ty * T - cam.y);
      if (c === '#') drawGroundTile(tx, ty, x, y, world);
      else if (c === 'N' && world === NORMAL) drawVineTile(tx, ty, x, y);
      else if (c === 'I' && world === AVESSO) drawCrystalTile(tx, ty, x, y);
      else if (c === '=') {
        if (tileAt(tx - 1, ty) !== '=') {
          let n = 0; while (tileAt(tx + n, ty) === '=') n++;
          const wpx = n * T;
          ctx.save(); ctx.translate(x, y);
          const col = world ? '#4a2a6e' : '#ffffff', ol = world ? '#ff6ad5' : OL;
          ctx.fillStyle = col; ctx.strokeStyle = ol; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(6, 18);
          for (let k = 0; k < n * 2; k++) ctx.arc(12 + k * (wpx - 24) / Math.max(1, n * 2 - 1), 12, 12, Math.PI, 0);
          ctx.lineTo(wpx - 2, 18); ctx.quadraticCurveTo(wpx, 30, wpx - 14, 30); ctx.lineTo(14, 30); ctx.quadraticCurveTo(0, 30, 6, 18);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      } else if (c === '^') {
        ctx.fillStyle = world ? '#ff4fa3' : '#eef0fa';
        ctx.strokeStyle = world ? '#0b0418' : OL; ctx.lineWidth = 2.5;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.moveTo(x + k * 16, y + T); ctx.lineTo(x + k * 16 + 8, y + T - 30); ctx.lineTo(x + k * 16 + 16, y + T); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }
    drawGate();
  }
  function drawCastle() {
    const x0 = (GATE_X - 1) * T - cam.x, x1 = 189 * T - cam.x;
    if (x1 < 0 || x0 > VW) return;
    const top = 1 * T - cam.y, bot = 12 * T - cam.y;
    ctx.fillStyle = world ? '#1d0f33' : '#9a88c4';
    ctx.fillRect(x0 + 60, top + 20, x1 - x0 - 60, bot - top - 20);
    ctx.strokeStyle = world ? 'rgba(255,106,213,0.18)' : 'rgba(60,40,100,0.35)'; ctx.lineWidth = 2;
    for (let yy = top + 20; yy < bot; yy += 32) {
      ctx.beginPath(); ctx.moveTo(x0 + 60, yy); ctx.lineTo(x1, yy); ctx.stroke();
      const off = ((yy - top) / 32) % 2 ? 0 : 32;
      for (let xx = x0 + 60 + off; xx < x1; xx += 64) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 32); ctx.stroke(); }
    }
    ctx.fillStyle = world ? '#1d0f33' : '#9a88c4';
    for (let xx = x0 + 60; xx < x1; xx += 48) ctx.fillRect(xx, top, 28, 22);
    // vitrais
    for (let k = 0; k < 4; k++) {
      const wx = x0 + 250 + k * 330, wy = top + 90;
      ctx.fillStyle = world ? '#ff6ad5' : '#ffe9a8';
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 2 + k);
      ctx.beginPath(); ctx.moveTo(wx - 22, wy + 90); ctx.lineTo(wx - 22, wy); ctx.arc(wx, wy, 22, Math.PI, 0); ctx.lineTo(wx + 22, wy + 90); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
    }
    // bandeiras bizarras com olho
    for (let k = 0; k < 3; k++) {
      const fx = x0 + 420 + k * 380, fy = top + 30;
      ctx.fillStyle = world ? '#3ef0d0' : '#c0305a';
      ctx.beginPath(); ctx.moveTo(fx - 26, fy); ctx.lineTo(fx + 26, fy); ctx.lineTo(fx + 26, fy + 90 + Math.sin(time * 2 + k) * 4); ctx.lineTo(fx, fy + 70); ctx.lineTo(fx - 26, fy + 90); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(fx, fy + 35, 14, 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(fx + clamp(P ? (P.x - cam.x - fx) / 60 : 0, -6, 6), fy + 35, 5, 0, 7); ctx.fill();
    }
  }
  function drawGate() {
    const gx = GATE_X * T - cam.x, gy = 1 * T - cam.y, gw = 2 * T, gh = 11 * T;
    if (gx > VW + 100 || gx + gw < -100) return;
    ctx.save();
    // torres
    ctx.fillStyle = world ? '#2a1742' : '#b3a3d9'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.fillRect(gx - 34, gy - 30, 34, gh + 30); ctx.strokeRect(gx - 34, gy - 30, 34, gh + 30);
    ctx.fillRect(gx + gw, gy - 30, 34, gh + 30); ctx.strokeRect(gx + gw, gy - 30, 34, gh + 30);
    for (const tx of [gx - 34, gx + gw]) for (let k = 0; k < 3; k++) { ctx.fillRect(tx + k * 12, gy - 44, 8, 14); ctx.strokeRect(tx + k * 12, gy - 44, 8, 14); }
    // grade (sobe quando abre)
    const lift = gateLift * (gh - 20);
    ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    ctx.fillStyle = world ? 'rgba(99,245,255,0.25)' : 'rgba(40,20,60,0.25)';
    ctx.fillRect(gx, gy - lift, gw, gh);
    ctx.strokeStyle = world ? '#63f5ff' : '#4a3a5e'; ctx.lineWidth = 7;
    for (let k = 0; k < 5; k++) { const bx = gx + 10 + k * 19; ctx.beginPath(); ctx.moveTo(bx, gy - lift); ctx.lineTo(bx, gy + gh - lift); ctx.stroke(); }
    for (let k = 0; k < 6; k++) { const by = gy + 30 + k * 85 - lift; ctx.beginPath(); ctx.moveTo(gx, by); ctx.lineTo(gx + gw, by); ctx.stroke(); }
    ctx.restore();
    // lintel com os encaixes das runas
    ctx.fillStyle = world ? '#2a1742' : '#b3a3d9'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    ctx.fillRect(gx - 34, gy - 36, gw + 68, 40); ctx.strokeRect(gx - 34, gy - 36, gw + 68, 40);
    for (let k = 0; k < 3; k++) {
      const rx = gx + gw / 2 + (k - 1) * 34, ry = gy - 16;
      drawRuneShape(rx, ry, 11, k < runes, k < runes ? 1 : 0.35);
    }
  }
  function drawRuneShape(x, y, s, lit, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (lit) { ctx.fillStyle = 'rgba(179,107,255,0.35)'; ctx.beginPath(); ctx.arc(x, y, s * 1.9, 0, 7); ctx.fill(); }
    ctx.fillStyle = lit ? '#c58bff' : '#4a3a5e';
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.stroke();
    if (lit) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y + s * 0.6); ctx.moveTo(x - s * 0.4, y - s * 0.1); ctx.lineTo(x + s * 0.4, y + s * 0.3); ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ desenho: objetos */
  function wrapText(text, maxW, font) {
    ctx.font = font;
    const words = text.split(' '); const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function bubble(x, y, text, opts = {}) {
    const font = `500 15px ${FONT}`;
    const lines = wrapText(text, opts.maxW || 280, font);
    const lh = 19, pad = 12;
    let w = 0; lines.forEach((l) => { w = Math.max(w, ctx.measureText(l).width); });
    w += pad * 2; const h = lines.length * lh + pad * 2 - 4;
    const bx = clamp(x - w / 2, 8, VW - w - 8), by = y - h - 16;
    ctx.fillStyle = opts.bg || '#fffaf0'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    roundRect(bx, by, w, h, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, by + h - 1); ctx.lineTo(x, by + h + 12); ctx.lineTo(x + 8, by + h - 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 8, by + h); ctx.lineTo(x, by + h + 12); ctx.lineTo(x + 8, by + h); ctx.stroke();
    ctx.fillStyle = opts.color || OL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + i * lh));
  }
  function drawSigns() {
    for (const s of signs) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -300 || x > VW + 300) continue;
      ctx.strokeStyle = OL; ctx.lineWidth = 3;
      ctx.fillStyle = world ? '#4b2f6e' : '#a86b3c';
      ctx.fillRect(x - 4, y - 34, 8, 34); ctx.strokeRect(x - 4, y - 34, 8, 34);
      ctx.fillStyle = world ? '#6b4596' : '#e0a864';
      roundRect(x - 22, y - 58, 44, 28, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = world ? '#63f5ff' : OL; ctx.font = `700 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y - 44);
    }
    // o balão fica por cima de tudo, então é desenhado depois
  }
  function drawSignBubbles() {
    for (const s of signs) {
      if (Math.abs(s.x - (P.x + P.w / 2)) < 110 && Math.abs(s.y - (P.y + P.h)) < 140) bubble(s.x - cam.x, s.y - 62 - cam.y, s.text);
    }
  }
  function drawCheckpoints() {
    for (const cp of checkpoints) {
      const x = cp.x - cam.x, y = cp.y - cam.y;
      if (x < -60 || x > VW + 60) continue;
      ctx.strokeStyle = OL; ctx.lineWidth = 3;
      ctx.fillStyle = '#f3e3c4'; roundRect(x - 6, y - 44, 12, 44, 5); ctx.fill(); ctx.stroke();
      if (cp.on) { ctx.fillStyle = 'rgba(255,230,120,0.35)'; ctx.beginPath(); ctx.arc(x, y - 52, 34 + Math.sin(time * 4) * 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = cp.on ? '#ffe066' : (world ? '#5a3f7a' : '#a99bc0');
      ctx.beginPath(); ctx.ellipse(x, y - 46, 24, 18, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cp.on ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(x - 9, y - 54, 4, 0, 7); ctx.arc(x + 8, y - 57, 3, 0, 7); ctx.fill();
    }
  }
  function drawSage() {
    const x = sage.x - cam.x, y = sage.y - cam.y;
    if (x < -100 || x > VW + 100) return;
    const bob = Math.sin(time * 2) * 2;
    ctx.save(); ctx.translate(x, y);
    if (world === AVESSO) ctx.globalAlpha = 0.25;
    ctx.strokeStyle = OL; ctx.lineWidth = 3;
    // cajado
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(34, -70); ctx.stroke();
    ctx.fillStyle = '#63f5ff'; ctx.beginPath(); ctx.arc(34, -74, 7 + Math.sin(time * 4), 0, 7); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineWidth = 3;
    ctx.fillStyle = '#f7e6c9'; roundRect(-20, -52 + bob, 40, 52 - bob, 14); ctx.fill(); ctx.stroke();
    // barba
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-16, -34 + bob); ctx.quadraticCurveTo(0, 10, 16, -34 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    // rosto
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(-7, -40 + bob, 3, 0, 7); ctx.arc(7, -40 + bob, 3, 0, 7); ctx.fill();
    // chapéu de cogumelo
    ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.ellipse(0, -52 + bob, 42, 30, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; [[-20, -66, 6], [4, -74, 7], [24, -62, 5]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b + bob, r, 0, 7); ctx.fill(); });
    if (!sage.talked) {
      ctx.fillStyle = '#ffe066'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.strokeText('!', 0, -100 + Math.sin(time * 5) * 4); ctx.fillText('!', 0, -100 + Math.sin(time * 5) * 4);
    }
    ctx.restore();
  }
  function drawSageBubble() {
    if (sage.near) bubble(sage.x - cam.x, sage.y - 92 - cam.y, 'Sábio Cogumelo: ' + SAGE_LINES[sage.line], { bg: '#fff3fb' });
  }
  function drawHeart(x, y, s, fill, outline = OL) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8); ctx.bezierCurveTo(8, -16, 14, -4, 0, 6);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = 2.2 / s * 1.2; ctx.stroke();
    ctx.restore();
  }
  function drawPickups() {
    for (const it of pickups) {
      const x = it.x - cam.x, y = it.y - cam.y + Math.sin(it.t * 3) * 5;
      if (x < -40 || x > VW + 40) continue;
      if (it.type === 'heart') {
        drawHeart(x, y, 1.4, '#ff4f6d');
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - 5, y - 5, 2.5, 0, 7); ctx.fill();
      } else {
        const here = it.world === world;
        ctx.save();
        if (!here) ctx.globalAlpha = 0.22 + 0.1 * Math.sin(time * 4);
        ctx.translate(x, y); ctx.scale(Math.cos(it.t * 2.2), 1);
        drawRuneShape(0, 0, 14, true, 1);
        ctx.restore();
        if (here) for (let k = 0; k < 2; k++) {
          const a = it.t * 3 + k * Math.PI;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 24, y + Math.sin(a) * 12, 2.5, 0, 7); ctx.fill();
        }
      }
    }
  }
  function drawPortal() {
    if (!portal) return;
    const x = portal.x - cam.x, y = portal.y - cam.y;
    const open = Math.min(1, portal.t / 0.15);
    const closing = portal.ok ? clamp((portal.life - portal.t) / 0.4, 0, 1) : clamp(1 - portal.t / portal.life, 0, 1);
    const s = open * closing;
    const other = 1 - world;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!portal.ok) {
      ctx.strokeStyle = '#ff4f4f'; ctx.lineWidth = 5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 50, 0, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
      ctx.restore(); return;
    }
    const outer = other ? ['#b36bff', '#ff6ad5'] : ['#ffe066', '#7bf1a8'];
    ctx.fillStyle = other ? 'rgba(179,107,255,0.25)' : 'rgba(255,224,102,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 70, 0, 0, 7); ctx.fill();
    // interior mostra o outro mundo
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
    if (other) { g.addColorStop(0, '#ff6ad5'); g.addColorStop(0.5, '#3a0f5e'); g.addColorStop(1, '#12032b'); }
    else { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#8fd3ff'); g.addColorStop(1, '#7ed36a'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 28, 52, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(0, 0, 8 + k * 7, 18 + k * 12, 0, time * (4 + k) + k, time * (4 + k) + k + 2.2); ctx.stroke();
    }
    ctx.lineWidth = 7; ctx.strokeStyle = outer[0];
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 54, 0, 0, 7); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = outer[1];
    ctx.beginPath(); ctx.ellipse(0, 0, 36, 60, 0, time * 3, time * 3 + 4); ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 34, 58, 0, 0, 7); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = time * 2 + k * 1.05;
      ctx.fillStyle = k % 2 ? outer[0] : '#fff';
      ctx.beginPath(); ctx.arc(Math.cos(a) * 40, Math.sin(a) * 64, 3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayerAt(px, py, face, alpha, ghost) {
    const p = P;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(px + p.w / 2 - cam.x), Math.round(py + p.h - cam.y));
    const sq = p.squash;
    ctx.scale(face * (1 + sq * 0.35), 1 - sq * 0.35);
    const cloak = world ? '#e0479e' : '#3b82f6', cloakD = world ? '#a52a73' : '#2458b8';
    const hat = world ? '#2bc3a8' : '#7c4dff';
    if (ghost) {
      ctx.fillStyle = world ? 'rgba(99,245,255,0.8)' : 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(0, -22, 16, 22, 0, 0, 7); ctx.fill(); ctx.restore(); return;
    }
    const run = p.onGround && Math.abs(p.vx) > 20;
    const ph = p.anim * 2.2;
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    // pés
    const f1 = run ? Math.sin(ph) * 7 : 0, f2 = run ? -Math.sin(ph) * 7 : 0;
    const airUp = !p.onGround ? -4 : 0;
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath(); ctx.ellipse(-6 + f1, -4 + airUp + (run ? -Math.max(0, Math.cos(ph)) * 3 : 0), 7, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(7 + f2, -4 + airUp + (run ? -Math.max(0, -Math.cos(ph)) * 3 : 0), 7, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    // cachecol esvoaçante
    const wave = Math.sin(time * 12) * 3;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(-4, -30);
    ctx.quadraticCurveTo(-18, -30 + wave, -26 - Math.min(10, Math.abs(p.vx) / 40), -24 - wave);
    ctx.lineTo(-24 - Math.min(10, Math.abs(p.vx) / 40), -18 - wave); ctx.quadraticCurveTo(-14, -22, -4, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
    // capa/corpo
    ctx.fillStyle = cloak;
    ctx.beginPath(); ctx.moveTo(-12, -32); ctx.lineTo(12, -32); ctx.lineTo(16, -6); ctx.quadraticCurveTo(0, -1, -16, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = cloakD; ctx.beginPath(); ctx.moveTo(-3, -30); ctx.lineTo(3, -30); ctx.lineTo(4, -5); ctx.lineTo(-4, -5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-12, -31, 24, 5); ctx.strokeRect(-12, -31, 24, 5);
    // cabeça
    ctx.fillStyle = '#ffd7b0';
    ctx.beginPath(); ctx.arc(1, -44, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(5, -46, 4.5, 6, 0, 0, 7); ctx.ellipse(-3, -46, 3.5, 5.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(6.5, -45, 2.5, 0, 7); ctx.arc(-1.5, -45, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff9fb8'; ctx.beginPath(); ctx.arc(10, -39, 2.5, 0, 7); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(5, -39, 3, 0.2, Math.PI - 0.4); ctx.stroke();
    ctx.lineWidth = 3;
    // chapéu pontudo com estrela
    const flop = Math.sin(time * 6) * 2 - clamp(p.vx / 60, -5, 5);
    ctx.fillStyle = hat;
    ctx.beginPath(); ctx.moveTo(-15, -50); ctx.quadraticCurveTo(-4, -60, 2, -78); ctx.quadraticCurveTo(-8 + flop, -82, -18 + flop, -76);
    ctx.quadraticCurveTo(-6, -70, 5, -84); ctx.lineTo(16, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -51, 19, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe066'; star(4, -64, 5); ctx.fill();
    // varinha
    const aimUp = Math.abs(p.aim.x) > 0.01 ? Math.atan2(p.aim.y, Math.abs(p.aim.x)) : 0;
    ctx.save(); ctx.translate(12, -22); ctx.rotate(p.shootCD > 0 ? aimUp : 0.3);
    ctx.strokeStyle = '#6b3f1d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.fillStyle = world ? '#63f5ff' : '#ffe066'; ctx.beginPath(); ctx.arc(18, 0, p.muzzle > 0 ? 7 : 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd7b0'; ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function drawPlayer() {
    for (const tr of P.trail) drawPlayerAt(tr.x, tr.y, tr.face, tr.life * 1.6, true);
    if (P.inv > 0 && P.dashT <= 0 && Math.floor(P.inv * 16) % 2 === 0) return;
    drawPlayerAt(P.x, P.y, P.face, 1, false);
  }

  function eyeball(x, y, r, lookX, lookY, iris, fl) {
    ctx.fillStyle = fl ? '#fff' : '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    const d = Math.hypot(lookX, lookY) || 1;
    const ox = lookX / d * r * 0.4, oy = lookY / d * r * 0.4;
    ctx.fillStyle = fl ? '#fff' : iris; ctx.beginPath(); ctx.arc(x + ox, y + oy, r * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = fl ? '#fff' : '#120818'; ctx.beginPath(); ctx.arc(x + ox, y + oy, r * 0.28, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + ox + r * 0.2, y + oy - r * 0.25, r * 0.15, 0, 7); ctx.fill();
  }
  function drawEnemy(e) {
    const x = e.x + e.w / 2 - cam.x, yb = e.y + e.h - cam.y;
    if (x < -120 || x > VW + 120) return;
    const fl = e.flash > 0;
    const C = (c) => (fl ? '#ffffff' : c);
    const c = pcenter();
    const lx = c.x - (e.x + e.w / 2), ly = c.y - (e.y + e.h / 2);
    ctx.save(); ctx.translate(x, yb);
    ctx.strokeStyle = e.world ? '#0b0418' : OL; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (e.type) {
      case 'slime': {
        const sq = e.squash;
        ctx.scale(1 + sq * 0.3, 1 - sq * 0.3);
        ctx.fillStyle = C('#7be05a');
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-20, -30, 0, -32); ctx.quadraticCurveTo(20, -30, 18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C('#a8f07f'); ctx.beginPath(); ctx.ellipse(-8, -22, 4, 7, -0.4, 0, 7); ctx.fill();
        eyeball(2, -17, 9, lx, ly, '#ff5d73', fl);
        ctx.fillStyle = C('#ff7eb6'); ctx.beginPath(); ctx.ellipse(8, -4, 5, 3 + Math.sin(e.t * 8) * 1.5, 0.3, 0, 7); ctx.fill(); ctx.stroke();
        break;
      }
      case 'bat': {
        const flap = Math.sin(e.t * 18) * 0.6;
        ctx.translate(0, -15);
        ctx.fillStyle = C('#7a4fd6');
        for (const s of [-1, 1]) {
          ctx.save(); ctx.scale(s, 1); ctx.rotate(flap);
          ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(24, -20, 32, -6); ctx.quadraticCurveTo(26, -4, 26, 2); ctx.quadraticCurveTo(20, -2, 18, 6); ctx.quadraticCurveTo(12, 2, 8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        eyeball(0, 0, 14, lx, ly, '#29b6f6', fl);
        ctx.strokeStyle = 'rgba(255,60,80,0.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-13, 3); ctx.lineTo(-7, 2); ctx.lineTo(-5, 6); ctx.moveTo(12, -5); ctx.lineTo(7, -3); ctx.stroke();
        ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(-4, 19); ctx.moveTo(4, 14); ctx.lineTo(4, 19); ctx.stroke();
        break;
      }
      case 'shooter': {
        ctx.scale(e.face, 1);
        const open = e.stT > 0 ? 1 : 0.2;
        ctx.fillStyle = C('#f7e6c9'); roundRect(-14, -30, 28, 30, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C('#3b1020'); ctx.beginPath(); ctx.ellipse(6, -12, 7, 3 + open * 6, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(1 + k * 4, -15 - open * 5); ctx.lineTo(3 + k * 4, -10 - open * 3); ctx.lineTo(5 + k * 4, -15 - open * 5); ctx.fill(); }
        ctx.fillStyle = C('#ff6b3d'); ctx.beginPath(); ctx.ellipse(0, -30, 26, 20, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C('#ffe9a8'); [[-12, -38, 5], [4, -44, 6], [16, -34, 4]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); });
        ctx.fillStyle = OL; ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(8, -22); ctx.lineTo(-2, -20); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -23, 1.5, 0, 7); ctx.fill();
        break;
      }
      case 'crawler': {
        ctx.scale(-e.face, 1);
        const segs = 4;
        for (let k = segs - 1; k >= 0; k--) {
          const sx = k * 11, sy = -12 + Math.sin(e.t * 10 + k) * 2, r = 12 - k * 1.5;
          ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 2;
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + s * 5 + Math.sin(e.t * 16 + k) * 4, 0); ctx.stroke(); }
          ctx.lineWidth = 3;
          ctx.fillStyle = C(k % 2 ? '#5b2a86' : '#7a3cb8'); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = C('#63f5ff'); ctx.beginPath(); ctx.arc(sx, sy - r * 0.4, 2, 0, 7); ctx.fill();
        }
        ctx.fillStyle = C('#ff5a8a'); ctx.beginPath(); ctx.arc(-14, -14, 14, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C('#1a0010'); ctx.beginPath(); ctx.moveTo(-28, -18); ctx.quadraticCurveTo(-18, -12 + Math.sin(e.t * 12) * 4, -28, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-27, -17 + k * 4); ctx.lineTo(-22, -16 + k * 4); ctx.lineTo(-27, -15 + k * 4); ctx.fill(); }
        eyeball(-12, -22, 5, -lx * -e.face, ly, '#ffe066', fl);
        eyeball(-4, -20, 4, -lx * -e.face, ly, '#ffe066', fl);
        eyeball(-18, -26, 3.5, -lx * -e.face, ly, '#ffe066', fl);
        break;
      }
      case 'eye': {
        ctx.translate(0, -24);
        ctx.strokeStyle = C('#ff6ad5'); ctx.lineWidth = 4;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(k * 8, 14);
          ctx.bezierCurveTo(k * 10 + Math.sin(e.t * 4 + k) * 8, 26, k * 6 - Math.sin(e.t * 4 + k) * 8, 34, k * 9, 44); ctx.stroke();
        }
        ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 3;
        ctx.fillStyle = C('#1c0930'); ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); ctx.stroke();
        const d = Math.hypot(lx, ly) || 1;
        ctx.fillStyle = C(e.stT > 0 ? '#ff4f6d' : '#ffe066'); ctx.beginPath(); ctx.arc(lx / d * 7, ly / d * 7, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#0b0418'; ctx.beginPath(); ctx.ellipse(lx / d * 8, ly / d * 8, 3, 8, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#5b2a86'); ctx.beginPath(); ctx.arc(0, 0, 21, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'hand': {
        ctx.scale(e.face, 1);
        const walk = e.onGround ? Math.sin(e.t * 14) * 3 : 4;
        ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const fx = -14 + k * 9;
          ctx.beginPath(); ctx.moveTo(fx, -18); ctx.quadraticCurveTo(fx + 6, -10 + (k % 2 ? walk : -walk), fx + 2, -2); ctx.stroke();
        }
        ctx.strokeStyle = C('#b6e38a'); ctx.lineWidth = 6;
        for (let k = 0; k < 4; k++) {
          const fx = -14 + k * 9;
          ctx.beginPath(); ctx.moveTo(fx, -18); ctx.quadraticCurveTo(fx + 6, -10 + (k % 2 ? walk : -walk), fx + 2, -2); ctx.stroke();
        }
        ctx.lineWidth = 3; ctx.strokeStyle = '#0b0418';
        ctx.fillStyle = C('#b6e38a'); ctx.beginPath(); ctx.ellipse(0, -22, 20, 11, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-20, -26, 8, 5, -0.6, 0, 7); ctx.fill(); ctx.stroke();
        eyeball(2, -24, 7, lx * e.face, ly, '#ff4f6d', fl);
        ctx.fillStyle = C('#ff9fb8'); ctx.beginPath(); ctx.ellipse(14, -16, 3, 1.5, 0, 0, 7); ctx.fill();
        break;
      }
      case 'guardian': {
        ctx.scale(-e.face, 1);
        const shakeX = e.st === 'wind' ? Math.sin(time * 60) * 2 : 0;
        ctx.translate(shakeX, 0);
        for (let k = 5; k >= 0; k--) {
          const sx = k * 14, sy = -26 + Math.sin(e.t * 8 + k) * 3, r = 26 - k * 2.5;
          ctx.strokeStyle = '#0b0418'; ctx.lineWidth = 3;
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + s * 8 + Math.sin(e.t * 14 + k) * 5, 0); ctx.stroke(); }
          ctx.fillStyle = C(k % 2 ? '#3a1d63' : '#51288a'); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = C('#ff6ad5'); ctx.beginPath(); ctx.moveTo(sx - 5, sy - r + 2); ctx.lineTo(sx, sy - r - 10); ctx.lineTo(sx + 5, sy - r + 2); ctx.fill();
        }
        ctx.fillStyle = C('#ff3d7f'); ctx.beginPath(); ctx.arc(-26, -32, 26, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C('#ffe066');
        ctx.beginPath(); ctx.moveTo(-44, -52); ctx.lineTo(-40, -70); ctx.lineTo(-32, -58); ctx.lineTo(-26, -74); ctx.lineTo(-20, -58); ctx.lineTo(-12, -70); ctx.lineTo(-10, -52); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a0010'; ctx.beginPath(); ctx.moveTo(-52, -36); ctx.quadraticCurveTo(-34, -24 + (e.st === 'charge' ? 8 : 0), -52, -14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-51, -34 + k * 5); ctx.lineTo(-44, -32 + k * 5); ctx.lineTo(-50, -30 + k * 5); ctx.fill(); }
        eyeball(-26, -40, 8, lx * e.face, ly, '#ffe066', fl);
        eyeball(-12, -34, 5, lx * e.face, ly, '#ffe066', fl);
        eyeball(-36, -26, 5, lx * e.face, ly, '#ffe066', fl);
        break;
      }
    }
    ctx.restore();
    if (e.hp < e.maxHp && e.type !== 'guardian') {
      const bw = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - bw / 2, e.y - cam.y - 10, bw, 4);
      ctx.fillStyle = '#ff4f6d'; ctx.fillRect(x - bw / 2, e.y - cam.y - 10, bw * e.hp / e.maxHp, 4);
    }
    if (e.type === 'guardian') {
      const bw = 90, by = e.y - cam.y - 40;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(x - bw / 2 - 2, by - 2, bw + 4, 10, 4); ctx.fill();
      ctx.fillStyle = '#ff6ad5'; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp) / e.maxHp, 6);
      ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('Guardião do Avesso', x, by - 4);
    }
  }
  function drawBoss() {
    const b = boss;
    if (!b.active && !(b.dead)) {
      // antes da luta, o chefe dorme no fundo do castelo
      if (!bossTriggered || true) {
        const x = b.x - cam.x, y = b.y - cam.y;
        if (x < -200 || x > VW + 200) return;
        ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(x, y + Math.sin(time) * 6);
        ctx.fillStyle = world ? '#3a1d63' : '#6a4a8a'; ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('z z z', 40, -60 + Math.sin(time * 2) * 5);
        ctx.restore();
      }
      return;
    }
    if (b.dead && b.deadT > 2.4) return;
    const x = b.x - cam.x, y = b.y - cam.y;
    const vis = world === b.vuln;
    const fl = b.flash > 0;
    const C = (c) => (fl ? '#ffffff' : c);
    const body = world ? '#7a3cff' : '#ff7bc0', bodyD = world ? '#4b1fa8' : '#d94f98';
    const c = pcenter();
    ctx.save(); ctx.translate(x, y);
    if (b.dead) { ctx.rotate(Math.sin(b.deadT * 30) * 0.1); ctx.scale(1 - b.deadT * 0.3, 1 - b.deadT * 0.3); }
    ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // tentáculos
    for (let k = 0; k < 6; k++) {
      const bx = -55 + k * 22;
      ctx.strokeStyle = OL; ctx.lineWidth = 16;
      const path = () => { ctx.beginPath(); ctx.moveTo(bx, 40); ctx.bezierCurveTo(bx + Math.sin(b.t * 3 + k) * 26, 80, bx - Math.sin(b.t * 2.4 + k) * 30, 110, bx + Math.sin(b.t * 3.2 + k * 2) * 20, 140); };
      path(); ctx.stroke();
      ctx.strokeStyle = C(bodyD); ctx.lineWidth = 10; path(); ctx.stroke();
    }
    // corpo gosmento
    ctx.lineWidth = 4; ctx.strokeStyle = OL;
    ctx.fillStyle = C(body);
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const rr = b.r * (1 + 0.05 * Math.sin(a * 5 + b.t * 3) + 0.03 * Math.sin(a * 3 - b.t * 2));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.92);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-30, -38, 18, 10, -0.5, 0, 7); ctx.fill();
    // núcleo (só visível no mundo vulnerável)
    if (vis) {
      const pulse = 1 + Math.sin(time * 8) * 0.12;
      ctx.fillStyle = 'rgba(255,60,90,0.35)'; ctx.beginPath(); ctx.arc(0, 18, 30 * pulse, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(0, 22); drawHeart(0, 0, 2.4 * pulse, C('#ff2d55')); ctx.restore();
    }
    // boca
    const m = 6 + b.mouth * 22 + (b.slam && b.slam.st === 'aim' ? 14 : 0);
    ctx.fillStyle = '#2a0418';
    ctx.beginPath(); ctx.ellipse(0, 46, 40, m, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 7; k++) {
      const tx = -32 + k * 10.5;
      ctx.beginPath(); ctx.moveTo(tx, 46 - m + 2); ctx.lineTo(tx + 5, 46 - m + 12); ctx.lineTo(tx + 10, 46 - m + 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(tx, 46 + m - 2); ctx.lineTo(tx + 5, 46 + m - 12); ctx.lineTo(tx + 10, 46 + m - 2); ctx.fill();
    }
    // mil olhos
    const eyes = [[-40, -20, 14], [0, -40, 18], [38, -18, 13], [-18, -58, 9], [22, -58, 10], [-58, 8, 9], [58, 10, 10], [-24, 0, 8], [26, 2, 8]];
    const lx = c.x - b.x, ly = c.y - b.y;
    ctx.lineWidth = 3;
    eyes.forEach(([ex, ey, r], i) => {
      const blink = Math.sin(b.t * 1.7 + i * 2.1) > 0.96;
      if (blink && !b.dead) { ctx.strokeStyle = OL; ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.stroke(); return; }
      if (b.dead) { ctx.strokeStyle = OL; ctx.beginPath(); ctx.moveTo(ex - r * 0.6, ey - r * 0.6); ctx.lineTo(ex + r * 0.6, ey + r * 0.6); ctx.moveTo(ex + r * 0.6, ey - r * 0.6); ctx.lineTo(ex - r * 0.6, ey + r * 0.6); ctx.stroke(); return; }
      ctx.strokeStyle = OL;
      eyeball(ex, ey, r, lx, ly, world ? '#3ef0d0' : ['#ffe066', '#7bf1a8', '#8fd3ff'][i % 3], fl);
    });
    // coroa
    ctx.fillStyle = C('#ffd23f'); ctx.strokeStyle = OL; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-40, -66); ctx.lineTo(-46, -104); ctx.lineTo(-22, -82); ctx.lineTo(0, -116); ctx.lineTo(22, -82); ctx.lineTo(46, -104); ctx.lineTo(40, -66); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C('#63f5ff'); ctx.beginPath(); ctx.arc(0, -84, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C('#ff4f6d'); ctx.beginPath(); ctx.arc(-26, -76, 4, 0, 7); ctx.arc(26, -76, 4, 0, 7); ctx.fill();
    // escudo
    if (!vis && !b.dead) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,224,102,${0.55 + (b.shield > 0 ? 0.45 : 0)})`;
      ctx.fillStyle = `rgba(255,224,102,${0.10 + (b.shield > 0 ? 0.2 : 0)})`;
      ctx.beginPath(); ctx.arc(0, 0, b.r + 16, 0, 7); ctx.fill(); ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + time;
        ctx.beginPath(); ctx.arc(Math.cos(a) * (b.r + 16), Math.sin(a) * (b.r + 16), 5, 0, 7); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawBullets() {
    for (const b of pbul) {
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.fillStyle = world ? 'rgba(99,245,255,0.35)' : 'rgba(255,224,102,0.4)';
      ctx.beginPath(); ctx.arc(x - b.vx * 0.012, y - b.vy * 0.012, 7, 0, 7); ctx.fill();
      ctx.fillStyle = world ? '#63f5ff' : '#ffe066';
      ctx.save(); ctx.translate(x, y); ctx.rotate(time * 12); star(0, 0, 9); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    for (const b of ebul) {
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.strokeStyle = OL; ctx.lineWidth = 2.5;
      if (b.kind === 'orb') {
        ctx.fillStyle = 'rgba(255,106,213,0.35)'; ctx.beginPath(); ctx.arc(x, y, b.r + 6, 0, 7); ctx.fill();
        ctx.fillStyle = world ? '#ff6ad5' : '#ff5d73'; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 2.5, 0, 7); ctx.fill();
      } else if (b.kind === 'wave') {
        ctx.fillStyle = world ? 'rgba(99,245,255,0.8)' : 'rgba(255,200,90,0.9)';
        ctx.beginPath(); ctx.moveTo(x - 16, y + 16); ctx.quadraticCurveTo(x, y - 30, x + 16, y + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = b.kind === 'spore' ? '#c7a14a' : (world ? '#3ef0d0' : '#9be15d');
        ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, 7); ctx.fill();
      }
    }
  }
  function drawParticles() {
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.kind === 'dot') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size * (0.4 + a * 0.6), 0, 7); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a;
        ctx.beginPath(); ctx.arc(x, y, p.size * (1.4 - a * 0.9), 0, 7); ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = `700 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = OL; ctx.strokeText(p.text, clamp(x, 140, VW - 140), y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, clamp(x, 140, VW - 140), y);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ HUD */
  function text(str, x, y, size, color, align = 'left', weight = 700, stroke = OL) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function drawHUD() {
    // painel esquerdo
    ctx.fillStyle = 'rgba(43,24,64,0.55)'; roundRect(10, 10, 232, 76, 14); ctx.fill();
    for (let i = 0; i < P.maxHp; i++) drawHeart(34 + i * 30, 34, 1.5, i < P.hp ? '#ff4f6d' : 'rgba(255,255,255,0.18)', '#fff');
    for (let i = 0; i < 3; i++) drawRuneShape(30 + i * 28, 66, 8, i < runes, i < runes ? 1 : 0.5);
    text(`${runes}/3`, 112, 66, 15, '#e7d4ff', 'left', 700, null);
    // indicador de portal
    const ready = P.portalCD <= 0;
    ctx.save(); ctx.translate(208, 48);
    ctx.strokeStyle = world ? '#ffe066' : '#b36bff'; ctx.lineWidth = 5; ctx.globalAlpha = ready ? 1 : 0.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 22, 0, 0, 7); ctx.stroke();
    ctx.restore();
    text('E', 208, 49, 14, '#fff', 'center');
    // mundo atual
    const wlabel = world ? '☾ MUNDO AVESSO' : '☀ MUNDO NORMAL';
    ctx.fillStyle = world ? 'rgba(179,107,255,0.85)' : 'rgba(255,214,90,0.9)';
    roundRect(10, 92, 170, 26, 12); ctx.fill();
    text(wlabel, 95, 105, 14, world ? '#fff' : OL, 'center', 700, null);
    // objetivo (na luta contra o chefe, a barra de vida dele ocupa o lugar)
    const q = QUESTS[quest]();
    if (!(boss.active && !boss.dead)) {
    ctx.font = `600 16px ${FONT}`;
    const qw = Math.min(520, ctx.measureText(q).width + 40);
    ctx.fillStyle = 'rgba(255,250,240,0.92)'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    roundRect(VW / 2 - qw / 2, 10, qw, 44, 12); ctx.fill(); ctx.stroke();
    text('OBJETIVO', VW / 2, 22, 11, '#9b4dff', 'center', 700, null);
    text(q, VW / 2, 39, 15, OL, 'center', 600, null);
    }
    // direita: criaturas e progresso no mapa
    ctx.fillStyle = 'rgba(43,24,64,0.55)'; roundRect(VW - 200, 10, 190, 56, 14); ctx.fill();
    text(`Criaturas: ${kills}`, VW - 188, 28, 15, '#fff', 'left', 600, null);
    const bx = VW - 188, bw = 166, by = 48;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(bx, by - 3, bw, 6, 3); ctx.fill();
    ctx.fillStyle = world ? '#b36bff' : '#ffe066'; roundRect(bx, by - 3, bw * clamp(P.x / (LW * T), 0, 1), 6, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx + bw * clamp(P.x / (LW * T), 0, 1), by, 5, 0, 7); ctx.fill();
    text('☠', bx + bw + 2, by, 14, '#ff8fb1', 'center', 700, null);
    // mudo
    if (audio.muted) text('som desligado (M)', VW - 12, 78, 12, '#fff', 'right', 500, OL);
    // barra do chefe
    if (boss.active && !boss.dead) {
      const w = 440, x = VW / 2 - w / 2, y = 42;
      ctx.fillStyle = 'rgba(20,5,35,0.8)'; roundRect(x - 8, y - 26, w + 16, 52, 12); ctx.fill();
      text('REI BIZARRO MIL-OLHOS', x, y - 12, 15, '#ffd1ec', 'left', 700, null);
      const vis = world === boss.vuln;
      text(vis ? 'NÚCLEO EXPOSTO! ATIRE!' : 'Escudo: vá ao ' + worldName(boss.vuln), x + w, y - 12, 13, vis ? '#7bf1a8' : '#ffe066', 'right', 700, null);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(x, y, w, 14, 7); ctx.fill();
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ff4f6d'); g.addColorStop(1, '#b36bff');
      ctx.fillStyle = g; roundRect(x, y, Math.max(0, w * boss.hp / boss.maxHp), 14, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundRect(x, y, w, 14, 7); ctx.stroke();
      if (boss.phase === 2) {
        ctx.fillStyle = '#ffe066'; roundRect(x, y + 17, w * clamp(boss.flipT / 6.5, 0, 1), 4, 2); ctx.fill();
      }
    }
    // avisos centrais
    toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 5, (t.dur - t.t) * 3);
      ctx.globalAlpha = clamp(a, 0, 1);
      text(t.text, VW / 2, 150 + i * 34 - (1 - Math.min(1, t.t * 5)) * 10, 24, t.color, 'center', 700, OL);
    });
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ telas */
  function drawTitle() {
    ctx.fillStyle = 'rgba(30,10,60,0.35)'; ctx.fillRect(0, 0, VW, VH);
    const wob = Math.sin(time * 2) * 3;
    ctx.save(); ctx.translate(VW / 2, 130 + wob); ctx.rotate(Math.sin(time) * 0.02);
    text('PORTAL', 0, -30, 76, '#ffe066', 'center', 700, OL);
    text('DO AVESSO', 0, 42, 64, '#d9a6ff', 'center', 700, OL);
    ctx.restore();
    text('Abra portais entre o Reino Encantado e o Mundo Avesso para derrotar o Rei Bizarro', VW / 2, 226, 17, '#fff', 'center', 500, OL);
    // painel de controles
    ctx.fillStyle = 'rgba(255,250,240,0.93)'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    roundRect(VW / 2 - 250, 258, 500, 170, 16); ctx.fill(); ctx.stroke();
    const rows = [
      ['← → / A D', 'andar'], ['ESPAÇO / W', 'pular'], ['J / clique', 'atirar magia (mira com o mouse)'],
      ['SHIFT / K', 'dash'], ['E / botão direito', 'abrir PORTAL'], ['P  ·  M', 'pausar  ·  som'],
    ];
    rows.forEach(([k, v], i) => {
      text(k, VW / 2 - 30, 284 + i * 24, 16, '#7c4dff', 'right', 700, null);
      text(v, VW / 2 - 14, 284 + i * 24, 16, OL, 'left', 500, null);
    });
    const blink = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.globalAlpha = blink;
    text('Clique ou aperte ENTER para começar', VW / 2, 470, 26, '#fff', 'center', 700, OL);
    ctx.globalAlpha = 1;
    // portal decorativo
    ctx.save(); ctx.translate(120, 380);
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = ['#b36bff', '#ff6ad5', '#63f5ff'][k]; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, 36 - k * 8, 64 - k * 12, 0, time * (2 + k), time * (2 + k) + 4.5); ctx.stroke(); }
    ctx.restore();
  }
  function drawWin() {
    ctx.fillStyle = 'rgba(30,10,60,0.55)'; ctx.fillRect(0, 0, VW, VH);
    const s = Math.min(1, winT * 2);
    ctx.save(); ctx.translate(VW / 2, 140); ctx.scale(s, s);
    text('VITÓRIA!', 0, 0, 84, '#ffe066', 'center', 700, OL);
    ctx.restore();
    text('O Rei Bizarro Mil-Olhos foi derrotado e o Reino voltou a brilhar.', VW / 2, 215, 19, '#fff', 'center', 500, OL);
    const mm = Math.floor(playTime / 60), ss = Math.floor(playTime % 60).toString().padStart(2, '0');
    ctx.fillStyle = 'rgba(255,250,240,0.93)'; ctx.strokeStyle = OL; ctx.lineWidth = 3;
    roundRect(VW / 2 - 190, 250, 380, 150, 16); ctx.fill(); ctx.stroke();
    [['Tempo', `${mm}:${ss}`], ['Criaturas derrotadas', kills], ['Portais atravessados', portalsUsed], ['Quedas', deaths]].forEach(([k, v], i) => {
      text(k, VW / 2 - 160, 280 + i * 32, 18, OL, 'left', 500, null);
      text(String(v), VW / 2 + 160, 280 + i * 32, 20, '#7c4dff', 'right', 700, null);
    });
    if (winT > 1.5) text('Clique ou aperte ENTER para jogar de novo', VW / 2, 450, 22, '#fff', 'center', 700, OL);
  }

  /* ------------------------------------------------------------------ render */
  function render() {
    const k = canvas.width / VW;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
    if (world === NORMAL || state === 'title') drawBgNormal(); else drawBgAvesso();
    if (state !== 'title') {
      drawTiles();
      drawCheckpoints();
      drawSigns();
      drawSage();
      drawPickups();
      drawPortal();
      for (const e of enemies) if (e.world === world) drawEnemy(e);
      drawBoss();
      drawPlayer();
      drawBullets();
      drawParticles();
      drawSignBubbles();
      drawSageBubble();
    } else {
      drawTiles();
    }
    ctx.restore();
    if (state !== 'title' && world === AVESSO) {
      const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95);
      g.addColorStop(0, 'rgba(20,0,40,0)'); g.addColorStop(1, 'rgba(20,0,40,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    }
    if (switchFx > 0) {
      const c = pcenter();
      ctx.fillStyle = world ? `rgba(179,107,255,${switchFx * 0.45})` : `rgba(255,250,200,${switchFx * 0.55})`;
      ctx.fillRect(0, 0, VW, VH);
      ctx.strokeStyle = world ? '#ff6ad5' : '#ffe066'; ctx.lineWidth = 24 * switchFx;
      ctx.beginPath(); ctx.arc(c.x - cam.x, c.y - cam.y, (1 - switchFx) * 900, 0, 7); ctx.stroke();
    }
    if (state === 'play' || state === 'paused') drawHUD();
    if (fade > 0) { ctx.fillStyle = `rgba(20,5,35,${fade})`; ctx.fillRect(0, 0, VW, VH); }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(20,5,35,0.6)'; ctx.fillRect(0, 0, VW, VH);
      text('PAUSADO', VW / 2, VH / 2 - 10, 60, '#fff', 'center');
      text('Aperte P para continuar', VW / 2, VH / 2 + 44, 20, '#e7d4ff', 'center', 500);
    }
    if (state === 'title') drawTitle();
    if (state === 'win') drawWin();
  }

  /* ------------------------------------------------------------------ loop */
  function resize() {
    const s = Math.min(innerWidth / VW, innerHeight / VH);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = Math.floor(VW * s) + 'px';
    canvas.style.height = Math.floor(VH * s) + 'px';
    canvas.width = Math.floor(VW * s * dpr);
    canvas.height = Math.floor(VH * s * dpr);
  }
  addEventListener('resize', resize);
  resize();

  const STEP = 1 / 120;
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; acc += dt;
    if (pressed.mute) { pressed.mute = false; audio.toggleMute(); }
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    for (const k in pressed) pressed[k] = false;
    render();
    requestAnimationFrame(frame);
  }

  // Atalhos de depuração (?debug): 1-7 teleporta, G modo deus, R +1 runa, V troca de mundo.
  const DEBUG_SPOTS = [3, 33, 57, 62, 88, 118, 150, 163];
  function debugKey(code) {
    if (state !== 'play') return;
    const m = code.match(/^Digit(\d)$/);
    if (m && DEBUG_SPOTS[+m[1]] != null) { P.x = DEBUG_SPOTS[+m[1]] * T; P.y = 5 * T; P.vy = 0; cam.x = P.x - VW / 2; }
    if (code === 'KeyG') { godMode = !godMode; toast(godMode ? 'modo deus' : 'modo normal'); }
    if (code === 'KeyR') runes = Math.min(3, runes + 1);
    if (code === 'KeyV') setWorld(1 - world);
  }

  newGame();
  state = 'title';
  window.__game = {
    get state() { return state; }, set state(v) { state = v; },
    get P() { return P; }, get world() { return world; }, get boss() { return boss; }, get enemies() { return enemies; },
    get runes() { return runes; }, set runes(v) { runes = v; }, get quest() { return quest; }, get portal() { return portal; },
    get cam() { return cam; }, get gateOpen() { return gateOpen; },
    setWorld: (w) => setWorld(w, true), newGame, keys, pressed,
    tileAt, isSolid,
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))])
    .then(() => requestAnimationFrame(frame));
})();
