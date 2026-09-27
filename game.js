/*
 * Portal do Avesso
 * Jogo de plataforma 2D em canvas, sem assets externos: toda a arte é desenhada em código.
 * O Agente Vulto enfrenta uma invasão alienígena atravessando dois mundos.
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
  const FONT = '"Rajdhani", "Arial Narrow", "Segoe UI", sans-serif';
  const FONT_D = '"Teko", "Impact", "Arial Narrow", sans-serif';
  const OL = '#0d0a10';
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
      shoot: () => { noise(0.09, 0.22, 2200); tone(180, 60, 0.1, 'square', 0.07); },
      jump: () => { noise(0.08, 0.08, 900); tone(160, 260, 0.1, 'triangle', 0.08); },
      airjump: () => { tone(300, 700, 0.14, 'sawtooth', 0.05); noise(0.12, 0.1, 2400); },
      dash: () => { noise(0.22, 0.22, 3200); tone(400, 90, 0.2, 'sawtooth', 0.05); },
      portalOpen: () => { tone(90, 700, 0.4, 'sawtooth', 0.06); tone(45, 90, 0.5, 'sine', 0.2); },
      portal: () => { tone(900, 50, 0.6, 'sawtooth', 0.09); tone(55, 30, 0.7, 'sine', 0.35); noise(0.5, 0.2, 700); },
      fail: () => { tone(160, 80, 0.25, 'square', 0.08); },
      hit: () => { noise(0.06, 0.2, 4200); tone(220, 90, 0.06, 'square', 0.04); },
      kill: () => { noise(0.4, 0.3, 900); tone(140, 35, 0.45, 'sawtooth', 0.12); },
      hurt: () => { tone(200, 50, 0.4, 'sawtooth', 0.14); noise(0.25, 0.2, 700); },
      tink: () => { tone(2600, 1700, 0.1, 'triangle', 0.08); noise(0.05, 0.08, 6000); },
      pickup: () => { [0, 7, 12].forEach((n, i) => tone(330 * Math.pow(2, n / 12), null, 0.15, 'square', 0.05, i * 0.05)); },
      rune: () => { [0, 3, 7, 12, 15].forEach((n, i) => tone(220 * Math.pow(2, n / 12), null, 0.35, 'sawtooth', 0.06, i * 0.08)); tone(55, null, 1.2, 'sine', 0.25); },
      check: () => { tone(440, null, 0.1, 'square', 0.06); tone(660, null, 0.2, 'square', 0.06, 0.1); },
      gate: () => { noise(1.4, 0.3, 250); tone(60, 30, 1.4, 'sawtooth', 0.14); },
      slam: () => { noise(0.7, 0.45, 300); tone(70, 25, 0.7, 'sine', 0.45); },
      roar: () => { tone(90, 38, 1.1, 'sawtooth', 0.16); tone(95, 40, 1.1, 'sawtooth', 0.12); noise(1.0, 0.2, 500); },
      win: () => { [0, 7, 12, 15, 19, 24].forEach((n, i) => tone(196 * Math.pow(2, n / 12), null, 0.6, 'sawtooth', 0.06, i * 0.16)); tone(49, null, 2.5, 'sine', 0.3); },
    };
    // trilha épica: tambores graves, baixo pulsante e um motivo em tom menor
    const PROG = [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]];
    const PROG_AV = [[0, 3, 6], [1, 4, 8], [-6, -3, 0], [-1, 3, 6]];
    function startMusic() {
      if (timer) return;
      timer = setInterval(() => {
        if (!ac || muted || ac.state !== 'running') return;
        const bar = Math.floor(step / 16) % 4, s16 = step % 16;
        const chord = (musicWorld ? PROG_AV : PROG)[bar];
        const root = (musicWorld ? 73.4 : 55) * Math.pow(2, chord[0] / 12);
        // bumbo e caixa
        if (s16 === 0 || s16 === 10 || (boss && s16 % 4 === 0)) { tone(120, 40, 0.25, 'sine', 0.35); noise(0.05, 0.12, 400); }
        if (s16 === 4 || s16 === 12) noise(0.18, boss ? 0.18 : 0.12, 2500);
        if (boss && s16 % 2 === 1) noise(0.03, 0.04, 7000);
        // baixo
        if (s16 % 2 === 0) tone(root, null, 0.22, 'sawtooth', 0.05);
        // motivo
        if (s16 % 4 === 2 || (boss && s16 % 2 === 0)) {
          const n = chord[(step >> 1) % 3];
          tone(root * 4 * Math.pow(2, (n - chord[0]) / 12), null, 0.28, musicWorld ? 'sawtooth' : 'square', 0.022);
        }
        if (s16 === 0) chord.forEach((n) => tone(root * 2 * Math.pow(2, (n - chord[0]) / 12), null, 2.2, 'triangle', 0.03));
        step++;
      }, 125);
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
  // '#' chão (os dois mundos)   'N' só no Mundo Normal (aço)   'I' só no Mundo Avesso (cristal alienígena)
  // '=' laje flutuante atravessável   '^' espinhos   'G' portão da colmeia
  let grid = [];
  const GATE_X = 158;
  function buildLevel() {
    grid = [];
    for (let y = 0; y < LH; y++) grid.push(new Array(LW).fill('.'));
    const R = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && x < LW && y >= 0 && y < LH) grid[y][x] = c;
    };
    const ground = (x0, x1, top = 12) => R(x0, top, x1, LH - 1, '#');

    // A. Vale inicial
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
      [5, 11, 'A D ou ← → para mover. ESPAÇO ou W para pular.'],
      [13, 11, 'J ou CLIQUE para atirar (o mouse mira). SHIFT ou K para o DASH.'],
      [34, 11, 'Barricada blindada. Aqui ela é impenetrável, mas no Avesso ela não existe. Aperte E para abrir um PORTAL e atravesse.'],
      [45, 11, 'A ponte de aço só existe no Mundo Normal. Abra outro portal para voltar!'],
      [74, 11, 'Fosso de estacas. PULE e acione o DASH no ar para cruzar.'],
      [85, 11, 'Um Fragmento do Avesso pulsa no alto da rocha. Suba pelas plataformas de aço e abra um portal lá em cima!'],
      [117, 11, 'Dica tática: dá para abrir portais no ar. Cruzar um portal recarrega seu PULO e seu DASH.'],
      [155, 11, 'Portão da Colmeia. Selado por 3 Fragmentos do Avesso.'],
    ],
    sage: [61, 11],
    start: [3, 11],
  };

  /* ------------------------------------------------------------------ estado */
  let state = 'title';
  let world = NORMAL, time = 0, shake = 0, switchFx = 0, fade = 0, stasisT = 0, flashT = 0, bossIntroT = 0;
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
      hp: 5, maxHp: 5, inv: 0, shootCD: 0, portalCD: 0, anim: 0, squash: 0, trail: [], aim: { x: 1, y: 0 }, muzzle: 0, recoil: 0,
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
    gateOpen = false; gateLift = 0; bossTriggered = false; winT = 0; stasisT = 0; bossIntroT = 0;
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
    burst(P.x + P.w / 2, P.y + P.h / 2, 14, ['#b3001b', '#ff4f4f', '#2a0008'], 300, 4); flashT = 0.25;
    if (P.hp <= 0) die();
  }
  function die() {
    deaths++;
    fade = 1;
    toast('Agente abatido. Reiniciando no último sinalizador.', '#ff8a8a');
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
      // os inimigos do mundo de chegada ficam congelados um instante para o jogador localizá-los
      stasisT = 1.1;
      switchFx = 1; shake = Math.max(shake, 6); sfx.portal(); portalsUsed++;
      const c = pcenter();
      burst(c.x, c.y, 34, w ? ['#ff2e4d', '#ff8a5c', '#2a0010'] : ['#7fe8ff', '#ffd27a', '#fff'], 520, 5, 0.7, 0);
      toast(w ? 'MUNDO AVESSO' : 'MUNDO NORMAL', w ? '#ff5a6e' : '#9fe8ff', 1.4);
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
      const dx = mouse.x + cam.x - c.x, dy = mouse.y + cam.y - (c.y - 6);
      const d = Math.hypot(dx, dy) || 1;
      ax = dx / d; ay = dy / d;
      if (Math.abs(ax) > 0.05) P.face = ax > 0 ? 1 : -1;
    }
    P.aim = { x: ax, y: ay };
    const spread = rand(-0.03, 0.03);
    const cs = Math.cos(spread), sn = Math.sin(spread);
    const bx = ax * cs - ay * sn, by = ax * sn + ay * cs;
    const sp = 1350;
    const mx = c.x + ax * 34, my = c.y - 6 + ay * 34;
    pbul.push({ x: mx, y: my, vx: bx * sp, vy: by * sp, life: 0.5, r: 5, px: mx, py: my });
    P.shootCD = 0.13; P.muzzle = 0.06; P.recoil = 1;
    P.vx -= ax * 25;
    // cápsula ejetada
    parts.push({ x: c.x - P.face * 4, y: c.y - 10, vx: -P.face * rand(80, 160), vy: rand(-320, -220), life: 0.8, max: 0.8, color: '#e8b04a', size: 2.5, grav: 1400, kind: 'shell', rot: rand(0, 6) });
    shake = Math.max(shake, 1.5);
    sfx.shoot();
  }
  function updatePlayer(dt) {
    const p = P;
    p.inv = Math.max(0, p.inv - dt); p.shootCD -= dt; p.dashCD -= dt; p.portalCD -= dt; p.muzzle -= dt; p.recoil = approach(p.recoil, 0, dt * 10);
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
        ring(p.x + p.w / 2, p.y + p.h / 2, world ? '#ff4d6d' : '#9fe8ff', 30, 0.25, 4);
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
        burst(p.x + p.w / 2, p.y + p.h, 6, world ? ['#3a1a20'] : ['#8a7a66'], 120, 4, 0.35, 200);
      } else if (p.airJumps > 0) {
        p.vy = -JUMP * 0.92; p.airJumps--; p.jumpBuf = 0; p.jumpHeld = true; p.dashT = 0;
        sfx.airjump(); ring(p.x + p.w / 2, p.y + p.h, world ? '#ff4d6d' : '#9fe8ff', 26, 0.3, 4);
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
      burst(p.x + p.w / 2, p.y + p.h, 5, world ? ['#3a1a20'] : ['#8a7a66'], 90, 4, 0.3, 100);
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
      const cols = e.world ? ['#ff2e4d', '#5a0d1a', '#ff9a6b', '#1a0508'] : ['#9bff4a', '#3f7a1a', '#e6ff9a', '#1a2a08'];
      burst(cx, cy, e.type === 'guardian' ? 50 : 22, cols, 340, 6, 0.8);
      ring(cx, cy, cols[0], e.w, 0.35, 5);
      if (e.type === 'guardian') {
        pickups.push({ type: 'rune', x: cx, y: cy - 20, world: AVESSO, t: 0, vy: -420, grav: true });
        toast('O Guardião do Avesso deixou cair um FRAGMENTO!', '#ff8a9a', 3);
      } else if (!e.summoned && Math.random() < 0.14) {
        pickups.push({ type: 'heart', x: cx, y: cy, world: -1, t: 0, vy: -300, grav: true });
      }
    }
  }

  /* ------------------------------------------------------------------ chefe */
  const ARENA_L = 160 * T, ARENA_R = 189 * T, FLOOR_Y = 12 * T;
  function makeBoss() {
    return {
      x: 176 * T, y: 4.5 * T, r: 64, hp: 70, maxHp: 70, t: 0, atk: 2.2, active: false, dead: false, deadT: 0,
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
  const BOSS_NAME = 'O SOBERANO MIL-OLHOS';
  function updateBoss(dt) {
    const b = boss;
    if (!b.active) return;
    b.t += dt; b.flash -= dt; b.shield -= dt; b.mouth = approach(b.mouth, 0, dt * 2); b.hintT -= dt;
    if (b.dead) {
      b.deadT += dt;
      if (Math.random() < 0.5) burst(b.x + rand(-90, 90), b.y + rand(-90, 90), 10, ['#9bff4a', '#ffcf5a', '#ff5a2e', '#fff'], 360, 7, 0.8, 0);
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
          burst(b.x, FLOOR_Y, 36, world ? ['#3a1a20', '#ff2e4d'] : ['#6b5a48', '#c9a77a'], 420, 7, 0.8);
        }
      } else if (s.st === 'rest' && s.t > 0.6) b.slam = null;
    } else {
      b.x = lerp(b.x, cx + Math.sin(b.t * 0.45) * 270, dt * 1.5);
      b.y = lerp(b.y, 5.1 * T + Math.sin(b.t * 1.2) * 30, dt * 2);
    }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2; b.vuln = NORMAL; b.flipT = 6.5; sfx.roar(); shake = 14;
      toast('O coração do Soberano fugiu para o ' + worldName(b.vuln) + '!', '#ffcf5a', 3);
    }
    if (b.phase === 2) {
      b.flipT -= dt;
      if (b.flipT <= 0) {
        b.flipT = 6.5; b.vuln = 1 - b.vuln; sfx.roar();
        toast('O coração trocou de mundo: agora está no ' + worldName(b.vuln) + '!', '#ffcf5a', 3);
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
        floatText(b.x, b.y - 110, 'Crias da colmeia!', '#ff8a9a');
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
      burst(bl.x, bl.y, 6, ['#9bff4a', '#e6ff9a'], 220, 4, 0.3);
      if (b.hp <= 0) {
        b.dead = true; b.deadT = 0; kills++;
        enemies.forEach((e) => { if (e.summoned) e.dead = true; });
        ebul = []; sfx.roar();
        toast('O SOBERANO CAIU!', '#ffcf5a', 3); flashT = 0.6;
      }
    } else {
      b.shield = 0.25; sfx.tink();
      burst(bl.x, bl.y, 6, ['#9fe8ff', '#fff'], 260, 3, 0.25);
      if (b.hintT <= 0) {
        b.hintT = 2.5;
        floatText(b.x, b.y - b.r - 40, 'BLINDADO! O coração está no ' + worldName(b.vuln), '#ffcf5a');
      }
    }
  }

  /* ------------------------------------------------------------------ atualização */
  const QUESTS = [
    () => 'Avance para o leste pelo vale',
    () => 'Passe pela barricada: abra um PORTAL com E',
    () => 'A ponte some no Avesso! Volte ao Mundo Normal',
    () => 'Contate o Comandante no terminal',
    () => `Recupere os Fragmentos do Avesso (${runes}/3)`,
    () => 'Leve os fragmentos ao Portão da Colmeia',
    () => 'Entre na colmeia e encare o Soberano',
    () => 'Elimine o Soberano Mil-Olhos!',
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
    flashT = Math.max(0, flashT - dt);
    bossIntroT = Math.max(0, bossIntroT - dt);
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
    stasisT = Math.max(0, stasisT - dt);
    updatePlayer(dt);

    // inimigos (só os do mundo atual e perto da câmera)
    for (const e of enemies) {
      if (e.dead || e.world !== world) continue;
      if (e.x + e.w < cam.x - 420 || e.x > cam.x + VW + 420) continue;
      if (stasisT > 0) { e.flash -= dt; continue; }
      updateEnemy(e, dt);
    }
    enemies = enemies.filter((e) => !e.dead);
    updateBoss(dt);

    // tiros do jogador
    for (const b of pbul) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      b.px = b.x - b.vx * dt; b.py = b.y - b.vy * dt;
      if (rectSolid(b.x - 2, b.y - 2, 4, 4, world)) { b.life = 0; burst(b.x, b.y, 6, ['#ffd27a', '#fff', '#8a7a66'], 180, 2.5, 0.25, 500); continue; }
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
        b.life = 0; burst(b.x, b.y, 6, b.kind === 'goo' || b.kind === 'spore' ? ['#9bff4a', '#3f7a1a'] : ['#ff2e4d', '#ff9a6b'], 140, 4, 0.3);
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
          P.hp = Math.min(P.maxHp, P.hp + 1); sfx.pickup(); floatText(it.x, it.y - 20, '+1 VIDA', '#7dff9a');
          burst(it.x, it.y, 12, ['#7dff9a', '#fff'], 200, 3, 0.5, 0);
        } else {
          runes++; sfx.rune(); shake = 6;
          burst(it.x, it.y, 34, ['#ff2e4d', '#ff9a6b', '#fff'], 360, 4, 0.8, 0);
          ring(it.x, it.y, '#ff4d6d', 90, 0.5, 6); flashT = 0.2;
          toast(`Fragmento do Avesso ${runes}/3`, '#ff8a9a', 2.6);
          if (runes === 3) toast('Todos os fragmentos! O Portão da Colmeia vai ceder.', '#ffcf5a', 3.2);
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
        sfx.check(); floatText(cp.x, cp.y - 100, 'SINALIZADOR ATIVADO · VIDA CHEIA', '#7dff9a');
        burst(cp.x, cp.y - 60, 18, ['#7dff9a', '#fff'], 200, 3, 0.6, 0);
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
      toast('O Portão da Colmeia se abriu!', '#ffcf5a', 3);
    }
    gateLift = approach(gateLift, gateOpen ? 1 : 0, dt * (gateOpen ? 0.8 : 4));
    if (!bossTriggered && gateOpen && P.x > 164 * T) {
      bossTriggered = true;
    }
    if (bossTriggered && !boss.active && !boss.dead && P.x > 164 * T) {
      boss.active = true; gateOpen = false; sfx.gate(); sfx.roar(); shake = 18;
      audio.setBoss(true);
      bossIntroT = 3.2; boss.atk = 3.6;
      toast('Dica: o coração dele fica exposto no ' + worldName(boss.vuln) + '.', '#ffcf5a', 5);
    }
    updateQuest();
    updateParticles(dt);
    updateCamera(dt);
  }
  const SAGE_LINES = [
    'Comandante: Agente Vulto, aqui é a Central. O Soberano Mil-Olhos abriu a invasão a partir da colmeia no leste.',
    'Comandante: O Portão da Colmeia está selado por 3 FRAGMENTOS DO AVESSO.',
    'Comandante: Os fragmentos só existem no Mundo Avesso. Seu gerador de portais é a nossa única chance.',
    'Comandante: Um está no topo da escadaria de cristal, outro na rocha alta, e o terceiro com o Guardião do Avesso.',
    'Comandante: Cuidado com as investidas do Guardião. Boa caçada, agente.',
  ];
  function updateParticles(dt) {
    for (const p of parts) {
      p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dot') { p.vx *= 1 - dt * 2; }
      if (p.kind === 'shell') { p.rot += dt * 20; const ty = Math.floor(p.y / T); if (p.vy > 0 && isSolid(Math.floor(p.x / T), ty, world)) { p.y = ty * T; p.vy *= -0.35; p.vx *= 0.5; } }
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

  /* ------------------------------------------------------------------ desenho: utilidades */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // painel com cantos chanfrados, estilo tático
  function bevelRect(x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
  }
  function each(p, spacing, fn) {
    const o = cam.x * p;
    const i0 = Math.floor(o / spacing) - 1, i1 = Math.floor((o + VW) / spacing) + 1;
    for (let i = i0; i <= i1; i++) fn(i * spacing - o, i);
  }
  const camYOff = (p) => -(cam.y - (LH * T - VH - 72)) * p;
  function ridge(p, base, amp, freq, fill, seed, _top, rim) {
    const o = cam.x * p, yo = camYOff(p * 0.6);
    const pts = [];
    for (let x = -16; x <= VW + 16; x += 12) {
      const wx = x + o;
      let h = Math.sin(wx * freq + seed) * amp + Math.sin(wx * freq * 2.7 + seed * 2) * amp * 0.35 + Math.abs(Math.sin(wx * freq * 0.41 + seed)) * amp * 1.2;
      h += (hash(Math.floor(wx / 12), seed * 100 | 0) - 0.5) * amp * 0.12;
      pts.push([x, base - h + yo]);
    }
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(-16, VH);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(VW + 16, VH); ctx.closePath(); ctx.fill();
    if (rim) {
      ctx.strokeStyle = rim; ctx.lineWidth = 2;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
  }
  // brilho aditivo; cada cor vira um sprite em cache para não recriar gradientes a cada quadro
  const glowCache = new Map();
  function glowSprite(color) {
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 128;
      const g2 = c.getContext('2d');
      const g = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = g; g2.fillRect(0, 0, 128, 128);
      glowCache.set(color, c);
    }
    return c;
  }
  const RGBA = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;
  function glow(x, y, r, color, alpha = 1) {
    if (r <= 0) return;
    const m = RGBA.exec(color);
    if (m) { color = `rgb(${m[1]},${m[2]},${m[3]})`; alpha *= +m[4]; }
    const prevA = ctx.globalAlpha, prevC = ctx.globalCompositeOperation;
    ctx.globalAlpha = prevA * alpha; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevC;
  }
  function star(x, y, r, n = 5) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function groundBelow(x, y, w) {
    const tx = Math.floor(x / T);
    let ty = Math.floor(y / T);
    for (let i = 0; i < 9; i++, ty++) {
      if (ty >= LH) return null;
      if (ty >= 0 && (isSolid(tx, ty, w) || tileAt(tx, ty) === '=')) return ty * T;
    }
    return null;
  }
  // sombra projetada no chão abaixo de uma entidade
  function dropShadow(x, feetY, width, wd = world) {
    const gy = groundBelow(x, feetY + 1, wd);
    if (gy == null) return;
    const d = gy - feetY;
    const a = clamp(0.5 - d / 380, 0, 0.5);
    if (a <= 0) return;
    const sw = width * (1 - clamp(d / 420, 0, 0.6));
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(x - cam.x, gy - cam.y + 2, sw / 2, Math.max(3, sw / 7), 0, 0, 7); ctx.fill();
  }

  /* ------------------------------------------------------------------ desenho: fundo */
  let bolt = null, boltT = 3;
  function drawBgNormal() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0b1530'); g.addColorStop(0.42, '#35325c'); g.addColorStop(0.72, '#b8566a'); g.addColorStop(1, '#f39a55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 50; i++) {
      const x = ((hash(i, 3) * 3000 - cam.x * 0.01) % 980 + 980) % 980, y = hash(i, 4) * 200;
      ctx.fillStyle = `rgba(255,255,255,${(0.15 + 0.35 * Math.abs(Math.sin(time * 0.7 + i))) * (1 - y / 220)})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    // planeta anelado gigante
    const px = 250 - cam.x * 0.012, py = 128 + camYOff(0.02), pr = 96;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.32);
    ctx.strokeStyle = 'rgba(255,220,180,0.35)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.34, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,150,0.18)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 2.15, pr * 0.4, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const pg = ctx.createRadialGradient(px - 40, py - 40, 10, px, py, pr);
    pg.addColorStop(0, '#f2d3a6'); pg.addColorStop(0.6, '#b9806a'); pg.addColorStop(1, '#4a2c3c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.clip();
    ctx.globalAlpha = 0.25;
    for (let k = -4; k <= 4; k++) { ctx.fillStyle = k % 2 ? '#7a4a4a' : '#f0c79a'; ctx.fillRect(px - pr, py + k * 20 - 5 + Math.sin(k) * 4, pr * 2, 8); }
    ctx.globalAlpha = 1;
    const sh = ctx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
    sh.addColorStop(0.45, 'rgba(10,8,30,0)'); sh.addColorStop(1, 'rgba(10,8,30,0.85)');
    ctx.fillStyle = sh; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.restore();
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.32);
    ctx.strokeStyle = 'rgba(255,225,190,0.55)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.34, 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,150,0.25)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 2.15, pr * 0.4, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
    // sol poente e raios
    const sx = 780 - cam.x * 0.02, sy = 400 + camYOff(0.05);
    glow(sx, sy, 380, 'rgba(255,170,90,0.55)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(sx, sy);
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.22 + Math.sin(time * 0.2 + k) * 0.03;
      ctx.fillStyle = `rgba(255,200,140,${0.035 + 0.02 * Math.sin(time * 0.5 + k)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.05) * 900, Math.sin(a - 0.05) * 900); ctx.lineTo(Math.cos(a + 0.05) * 900, Math.sin(a + 0.05) * 900); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#ffe2b0'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
    // nave-mãe alienígena ao longe
    each(0.05, 2400, (x, i) => {
      const nx = x + 900, ny = 150 + Math.sin(time * 0.3 + i) * 6 + camYOff(0.03);
      ctx.save(); ctx.translate(nx, ny);
      ctx.fillStyle = '#1b1830';
      ctx.beginPath(); ctx.ellipse(0, 0, 150, 22, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -14, 60, 26, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-110, 10); ctx.lineTo(-40, 50); ctx.lineTo(40, 50); ctx.lineTo(110, 10); ctx.fill();
      for (let k = 0; k < 7; k++) { ctx.fillStyle = `rgba(255,70,70,${0.4 + 0.6 * (Math.sin(time * 3 + k) > 0.5 ? 1 : 0)})`; ctx.fillRect(-90 + k * 30, 4, 4, 3); }
      glow(0, 58, 70, 'rgba(120,255,160,0.25)');
      ctx.restore();
    });
    // montanhas em camadas com perspectiva atmosférica
    ridge(0.06, 360, 60, 0.004, '#7a4a66', 1.3, false, 'rgba(255,190,140,0.35)');
    const fog1 = ctx.createLinearGradient(0, 280, 0, 420);
    fog1.addColorStop(0, 'rgba(240,140,110,0)'); fog1.addColorStop(1, 'rgba(240,140,110,0.35)');
    ctx.fillStyle = fog1; ctx.fillRect(0, 280, VW, VH - 280);
    // monólitos flutuantes
    each(0.16, 520, (x, i) => {
      const bx = x + hash(i, 7) * 220, by = 200 + hash(i, 8) * 70 + Math.sin(time * 0.6 + i) * 8 + camYOff(0.1);
      const s = 0.6 + hash(i, 9) * 0.6;
      ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
      ctx.fillStyle = '#6a4a52';
      ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-10, -120); ctx.lineTo(20, -130); ctx.lineTo(44, 0); ctx.lineTo(10, 70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2838';
      ctx.beginPath(); ctx.moveTo(20, -130); ctx.lineTo(44, 0); ctx.lineTo(10, 70); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,140,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-10, -120); ctx.lineTo(20, -130); ctx.stroke();
      ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.3 * Math.sin(time * 2 + i)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -90); ctx.lineTo(4, -40); ctx.lineTo(-4, 10); ctx.stroke();
      ctx.fillStyle = 'rgba(40,20,40,0.5)';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-30 + k * 30, 90 + k * 14 + Math.sin(time + k) * 5, 5 - k, 0, 7); ctx.fill(); }
      ctx.restore();
    });
    ridge(0.14, 400, 50, 0.006, '#3f2a44', 4.2, false, 'rgba(255,160,110,0.45)');
    ridge(0.3, 450, 38, 0.009, '#241a2e', 2.8, false, 'rgba(255,150,100,0.5)');
    // árvores alienígenas em silhueta com luz de contorno
    each(0.5, 190, (x, i) => {
      const h = hash(i, 11);
      if (h < 0.35) return;
      const bx = x + h * 90, yb = 500 + camYOff(0.35);
      const s = 0.7 + hash(i, 12) * 0.8;
      ctx.save(); ctx.translate(bx, yb); ctx.scale(s, s);
      ctx.fillStyle = '#140f1c';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-2, -60, -10, -120); ctx.lineTo(6, -120); ctx.quadraticCurveTo(8, -60, 6, 0); ctx.fill();
      for (let k = 0; k < 4; k++) {
        const yy = -40 - k * 28, ww = 46 - k * 9;
        ctx.beginPath(); ctx.moveTo(-ww, yy + 10); ctx.quadraticCurveTo(0, yy - 26, ww, yy + 10); ctx.quadraticCurveTo(0, yy - 6, -ww, yy + 10); ctx.fill();
      }
      ctx.fillStyle = `rgba(160,255,200,${0.4 + 0.3 * Math.sin(time * 2 + i)})`;
      ctx.beginPath(); ctx.arc(-2, -128, 5, 0, 7); ctx.fill();
      ctx.restore();
    });
    const fog2 = ctx.createLinearGradient(0, 380, 0, VH);
    fog2.addColorStop(0, 'rgba(250,150,100,0)'); fog2.addColorStop(1, 'rgba(250,150,100,0.3)');
    ctx.fillStyle = fog2; ctx.fillRect(0, 380, VW, VH - 380);
    // brasas/poeira no ar
    for (let i = 0; i < 26; i++) {
      const x = ((hash(i, 20) * 1400 - cam.x * 0.7 + time * 18) % 1000 + 1000) % 1000 - 20;
      const y = VH - ((time * (12 + hash(i, 21) * 20) + hash(i, 22) * VH) % (VH + 20));
      ctx.fillStyle = `rgba(255,200,140,${0.25 + 0.3 * Math.sin(time * 2 + i)})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  function drawBgAvesso() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#040103'); g.addColorStop(0.4, '#1e050b'); g.addColorStop(0.8, '#4d0b17'); g.addColorStop(1, '#7a1622');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // sol negro com coroa vermelha
    const sx = 690 - cam.x * 0.015, sy = 130 + camYOff(0.02);
    glow(sx, sy, 230, 'rgba(255,40,60,0.55)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(sx, sy);
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2 + time * 0.05, len = 90 + Math.sin(time * 1.3 + k * 1.7) * 20 + hash(k, 5) * 30;
      ctx.strokeStyle = 'rgba(255,80,60,0.12)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 62, Math.sin(a) * 62); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#030001'; ctx.beginPath(); ctx.arc(sx, sy, 62, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, sy, 63, 0, 7); ctx.stroke();
    // raios vermelhos
    boltT -= 1 / 60;
    if (boltT <= 0) {
      boltT = rand(2.5, 6);
      const pts = []; let x = rand(100, 860), y = 0;
      while (y < 330) { pts.push([x, y]); x += rand(-40, 40); y += rand(20, 45); }
      bolt = { pts, t: 0.35 };
    }
    if (bolt && bolt.t > 0) {
      bolt.t -= 1 / 60;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,60,80,${bolt.t * 0.25})`; ctx.fillRect(0, 0, VW, VH);
      ctx.strokeStyle = `rgba(255,170,170,${bolt.t * 2.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.restore();
    }
    // montanhas penduradas do céu
    ctx.fillStyle = '#12040a';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = -10; x <= VW + 10; x += 12) {
      const wx = x + cam.x * 0.06;
      const h = 40 + Math.abs(Math.sin(wx * 0.005 + 1)) * 70 + Math.sin(wx * 0.013) * 18;
      ctx.lineTo(x, h + camYOff(0.03));
    }
    ctx.lineTo(VW + 10, 0); ctx.closePath(); ctx.fill();
    ridge(0.08, 380, 55, 0.004, '#2a0710', 2.2, false, 'rgba(255,60,70,0.35)');
    // destroços flutuando para cima
    each(0.18, 300, (x, i) => {
      const bx = x + hash(i, 40) * 160;
      const by = 360 - ((time * (8 + hash(i, 41) * 10) + hash(i, 42) * 400) % 420) + camYOff(0.1);
      const s = 0.5 + hash(i, 43) * 0.9;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(time * 0.2 * (hash(i, 44) - 0.5)); ctx.scale(s, s);
      ctx.fillStyle = '#1a0609';
      ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(-6, -22); ctx.lineTo(24, -12); ctx.lineTo(30, 10); ctx.lineTo(-4, 22); ctx.lineTo(-24, 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,70,70,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(-6, -22); ctx.lineTo(24, -12); ctx.stroke();
      ctx.restore();
    });
    ridge(0.3, 455, 40, 0.008, '#16050a', 4.1, false, 'rgba(255,50,60,0.5)');
    // tentáculos orgânicos
    each(0.5, 210, (x, i) => {
      const h = hash(i, 50);
      if (h < 0.3) return;
      const bx = x + h * 100, yb = 520 + camYOff(0.35);
      const s = 0.8 + hash(i, 51) * 0.8;
      ctx.save(); ctx.translate(bx, yb); ctx.scale(s, s);
      ctx.strokeStyle = '#0a0205'; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const sw = Math.sin(time * 0.8 + i + k) * 14;
        const tipX = k * 8 + sw * 0.6, tipY = -150 + k * 20;
        ctx.lineWidth = 12 - k * 3;
        ctx.beginPath(); ctx.moveTo(k * 10 - 10, 0); ctx.bezierCurveTo(k * 10 - 20 + sw, -60, k * 12 + 20 - sw, -110, tipX, tipY); ctx.stroke();
        glow(tipX, tipY, 12, 'rgba(255,50,60,0.8)');
      }
      ctx.restore();
    });
    const fog = ctx.createLinearGradient(0, 360, 0, VH);
    fog.addColorStop(0, 'rgba(160,20,40,0)'); fog.addColorStop(1, 'rgba(160,20,40,0.35)');
    ctx.fillStyle = fog; ctx.fillRect(0, 360, VW, VH - 360);
    for (let i = 0; i < 40; i++) {
      const x = ((hash(i, 60) * 1500 - cam.x * 0.6) % 1000 + 1000) % 1000 - 20 + Math.sin(time + i) * 10;
      const y = VH - ((time * (18 + hash(i, 61) * 26) + hash(i, 62) * VH) % (VH + 40));
      ctx.fillStyle = i % 3 ? 'rgba(150,140,140,0.45)' : 'rgba(255,70,60,0.7)';
      ctx.fillRect(x, y, 2 + hash(i, 63) * 2, 2 + hash(i, 63) * 2);
    }
  }

  /* ------------------------------------------------------------------ desenho: blocos */
  function solidVis(tx, ty, w) {
    const c = tileAt(tx, ty);
    return c === '#' || (c === 'N' && w === NORMAL) || (c === 'I' && w === AVESSO);
  }
  function edges(x, y, up, dn, lf, rt, color, lw = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath();
    if (!up) { ctx.moveTo(x, y + 1); ctx.lineTo(x + T, y + 1); }
    if (!dn) { ctx.moveTo(x, y + T - 1); ctx.lineTo(x + T, y + T - 1); }
    if (!lf) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + T); }
    if (!rt) { ctx.moveTo(x + T - 1, y); ctx.lineTo(x + T - 1, y + T); }
    ctx.stroke();
  }
  // luz vem de cima/esquerda: bordas expostas à direita e embaixo ficam em sombra
  function sideShade(x, y, lf, rt, dn, dark = 'rgba(0,0,0,0.35)', light = 'rgba(255,255,255,0.08)') {
    if (!rt) { const g = ctx.createLinearGradient(x + T - 14, 0, x + T, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, dark); ctx.fillStyle = g; ctx.fillRect(x + T - 14, y, 14, T); }
    if (!dn) { const g = ctx.createLinearGradient(0, y + T - 12, 0, y + T); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, dark); ctx.fillStyle = g; ctx.fillRect(x, y + T - 12, T, 12); }
    if (!lf) { ctx.fillStyle = light; ctx.fillRect(x, y, 5, T); }
  }
  function depthOf(tx, ty, w) { let d = 0; while (d < 4 && solidVis(tx, ty - d - 1, w)) d++; return d; }
  function drawGroundTile(tx, ty, x, y, w) {
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w) || ty === LH - 1, lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    const h = hash(tx, ty), d = depthOf(tx, ty, w);
    if (w === NORMAL) {
      ctx.fillStyle = ['#7a6250', '#665244', '#544439', '#45382f', '#382d26'][d];
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x, y + 10 + (h * 26 | 0), T + 0.5, 3);
      ctx.fillStyle = 'rgba(255,230,200,0.06)'; ctx.fillRect(x, y + 13 + (h * 26 | 0), T + 0.5, 2);
      // pedras incrustadas com luz e sombra
      const rx = x + 8 + h * 26, ry = y + 18 + hash(ty, tx) * 18;
      ctx.fillStyle = '#2b221c'; ctx.beginPath(); ctx.ellipse(rx + 1, ry + 2, 8, 5, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#8c7560'; ctx.beginPath(); ctx.ellipse(rx, ry, 7, 4.5, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#b39a7e'; ctx.beginPath(); ctx.ellipse(rx - 2, ry - 1.5, 3, 1.6, 0.2, 0, 7); ctx.fill();
      sideShade(x, y, lf, rt, dn);
      edges(x, y, up, dn, lf, rt, '#1a120d');
      if (!up) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + 10, T + 0.5, 6);
        ctx.fillStyle = '#3d5e29';
        ctx.beginPath(); ctx.moveTo(x - (lf ? 0 : 2), y);
        ctx.lineTo(x + T + (rt ? 0 : 2), y); ctx.lineTo(x + T + (rt ? 0 : 2), y + 8);
        for (let k = 5; k >= 0; k--) ctx.lineTo(x + k * 8 + 4, y + 8 + ((k + tx) % 2 ? 5 : 1));
        ctx.lineTo(x - (lf ? 0 : 2), y + 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6f9444'; ctx.fillRect(x, y, T + 0.5, 3);
        ctx.fillStyle = '#12200a'; ctx.fillRect(x, y - 1, T + 0.5, 1.5);
        // tufos de capim
        for (let k = 0; k < 5; k++) {
          const gx = x + 3 + k * 9 + hash(tx, k) * 5, gh = 5 + hash(k, tx) * 9;
          const sway = Math.sin(time * 2 + tx + k) * 1.5;
          ctx.fillStyle = k % 2 ? '#2e4a1f' : '#5b7f36';
          ctx.beginPath(); ctx.moveTo(gx - 2, y + 1); ctx.lineTo(gx + sway, y - gh); ctx.lineTo(gx + 2, y + 1); ctx.fill();
        }
        if (h > 0.82) {
          ctx.fillStyle = '#1b2a12'; ctx.fillRect(x + 30, y - 12, 2, 12);
          glow(x + 31, y - 14, 10, 'rgba(160,255,200,0.7)');
          ctx.fillStyle = '#d4ffe6'; ctx.beginPath(); ctx.arc(x + 31, y - 14, 2.5, 0, 7); ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = ['#2a171c', '#221216', '#1b0e12', '#150a0e', '#10070a'][d];
      ctx.fillRect(x, y, T + 0.5, T + 0.5);
      // rachaduras incandescentes
      ctx.strokeStyle = `rgba(255,50,60,${0.25 + 0.15 * Math.sin(time * 2 + tx * 0.7 + ty)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + h * 20, y + 8); ctx.lineTo(x + 14 + h * 16, y + 22); ctx.lineTo(x + 8 + h * 30, y + 38); ctx.stroke();
      sideShade(x, y, lf, rt, dn, 'rgba(0,0,0,0.45)', 'rgba(255,80,80,0.05)');
      edges(x, y, up, dn, lf, rt, '#050102');
      if (!up) {
        glow(x + T / 2, y, 30, 'rgba(255,40,50,0.18)');
        ctx.fillStyle = '#3a1d22'; ctx.fillRect(x - (lf ? 0 : 1), y, T + (lf ? 0 : 1) + (rt ? 0 : 1), 7);
        ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x, y, T + 0.5, 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y + 7, T + 0.5, 5);
        if (h > 0.55) {
          // espinhos de osso
          ctx.fillStyle = '#c9b49a';
          ctx.beginPath(); ctx.moveTo(x + 26, y + 1); ctx.lineTo(x + 30 + h * 4, y - 14 - h * 8); ctx.lineTo(x + 34, y + 1); ctx.fill();
          ctx.fillStyle = '#6a584a';
          ctx.beginPath(); ctx.moveTo(x + 30 + h * 4, y - 14 - h * 8); ctx.lineTo(x + 34, y + 1); ctx.lineTo(x + 31, y + 1); ctx.fill();
        }
      }
    }
  }
  function drawSteelTile(tx, ty, x, y) {
    const w = NORMAL;
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w), lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    const g = ctx.createLinearGradient(x, y, x, y + T);
    g.addColorStop(0, '#8793a0'); g.addColorStop(1, '#4b5561');
    ctx.fillStyle = g; ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.strokeStyle = '#323a44'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, T - 8, T - 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 5, y + T - 5); ctx.lineTo(x + 5, y + 5); ctx.lineTo(x + T - 5, y + 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,10,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + T - 8, y + T - 8); ctx.moveTo(x + T - 8, y + 8); ctx.lineTo(x + 8, y + T - 8); ctx.stroke();
    for (const [rx, ry] of [[9, 9], [T - 9, 9], [9, T - 9], [T - 9, T - 9]]) {
      ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.arc(x + rx + 0.8, y + ry + 0.8, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9d2dc'; ctx.beginPath(); ctx.arc(x + rx, y + ry, 2, 0, 7); ctx.fill();
    }
    // ferrugem
    if (hash(tx, ty) > 0.5) { ctx.fillStyle = 'rgba(140,70,30,0.35)'; ctx.beginPath(); ctx.ellipse(x + 30, y + 34, 9, 5, 0.4, 0, 7); ctx.fill(); }
    sideShade(x, y, lf, rt, dn);
    if (!up) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, T, 8); ctx.clip();
      ctx.fillStyle = '#e8b21e'; ctx.fillRect(x, y, T, 8);
      ctx.fillStyle = '#16161a';
      for (let k = -1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + k * 14 + (tx * 48 % 14), y + 8); ctx.lineTo(x + k * 14 + 7 + (tx * 48 % 14), y); ctx.lineTo(x + k * 14 + 14 + (tx * 48 % 14), y); ctx.lineTo(x + k * 14 + 7 + (tx * 48 % 14), y + 8); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x, y, T, 1.5);
    }
    edges(x, y, up, dn, lf, rt, '#12161b');
  }
  function drawCrystalTile(tx, ty, x, y) {
    const w = AVESSO;
    const up = solidVis(tx, ty - 1, w), dn = solidVis(tx, ty + 1, w), lf = solidVis(tx - 1, ty, w), rt = solidVis(tx + 1, ty, w);
    glow(x + T / 2, y + T / 2, 44, 'rgba(255,30,60,0.22)');
    const g = ctx.createLinearGradient(x, y, x + T, y + T);
    g.addColorStop(0, '#ff5a6e'); g.addColorStop(0.45, '#a3122e'); g.addColorStop(1, '#3a0010');
    ctx.fillStyle = g; ctx.fillRect(x, y, T + 0.5, T + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); ctx.lineTo(x + 20, y + T); ctx.lineTo(x + 30, y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,190,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 30, y + 20); ctx.lineTo(x + T - 3, y + 4); ctx.moveTo(x + 30, y + 20); ctx.lineTo(x + 20, y + T - 3); ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + tx * 0.9);
    ctx.fillStyle = `rgba(255,200,180,${0.25 + 0.3 * pulse})`;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 20, y + 9); ctx.lineTo(x + 9, y + 19); ctx.fill();
    edges(x, y, up, dn, lf, rt, '#1a0005');
  }
  function drawGhosts(x0, x1, y0, y1) {
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4 + 0.12 * Math.sin(time * 3);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = grid[ty][tx];
      if ((c === 'N' && world === AVESSO) || (c === 'I' && world === NORMAL)) {
        const x = tx * T - cam.x, y = ty * T - cam.y;
        ctx.strokeStyle = c === 'I' ? '#ff4d6d' : '#9fc3e8';
        ctx.fillStyle = c === 'I' ? 'rgba(255,77,109,0.08)' : 'rgba(159,195,232,0.08)';
        ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
        ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
      }
    }
    ctx.restore();
  }
  function drawSlab(x, y, n) {
    const wpx = n * T;
    const av = world === AVESSO;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(x + 4, y + 8, wpx - 4, 20, 6); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + 22);
    g.addColorStop(0, av ? '#4a2a30' : '#8a7a6a'); g.addColorStop(1, av ? '#1a0a0e' : '#3e342c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + wpx, y); ctx.lineTo(x + wpx - 8, y + 18); ctx.lineTo(x + wpx * 0.6, y + 24); ctx.lineTo(x + 10, y + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = av ? '#050102' : '#1a120d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = av ? '#ff3b3b' : '#c9b8a0'; ctx.fillRect(x + 1, y, wpx - 2, 2);
    for (let k = 0; k < n; k++) {
      const fx = x + T / 2 + k * T;
      glow(fx, y + 26, 18 + Math.sin(time * 10 + k) * 3, av ? 'rgba(255,40,60,0.7)' : 'rgba(127,232,255,0.7)');
    }
  }
  function drawTiles() {
    const x0 = Math.max(0, Math.floor(cam.x / T)), x1 = Math.min(LW - 1, Math.floor((cam.x + VW) / T));
    const y0 = Math.max(0, Math.floor(cam.y / T)), y1 = Math.min(LH - 1, Math.floor((cam.y + VH) / T));
    drawHive();
    drawGhosts(x0, x1, y0, y1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = grid[ty][tx];
      if (c === '.' || c === 'G') continue;
      const x = Math.round(tx * T - cam.x), y = Math.round(ty * T - cam.y);
      if (c === '#') drawGroundTile(tx, ty, x, y, world);
      else if (c === 'N' && world === NORMAL) drawSteelTile(tx, ty, x, y);
      else if (c === 'I' && world === AVESSO) drawCrystalTile(tx, ty, x, y);
      else if (c === '=') {
        if (tileAt(tx - 1, ty) !== '=' || tx === x0) {
          let s0 = tx; while (tileAt(s0 - 1, ty) === '=') s0--;
          let n = 0; while (tileAt(s0 + n, ty) === '=') n++;
          if (s0 === tx || tx === x0) drawSlab(Math.round(s0 * T - cam.x), y, n);
        }
      } else if (c === '^') {
        const av = world === AVESSO;
        for (let k = 0; k < 3; k++) {
          const bx = x + k * 16, tipY = y + T - 30 - (hash(tx, k) * 6);
          ctx.fillStyle = av ? '#d8c3a5' : '#9aa3ad';
          ctx.beginPath(); ctx.moveTo(bx, y + T); ctx.lineTo(bx + 8, tipY); ctx.lineTo(bx + 8, y + T); ctx.fill();
          ctx.fillStyle = av ? '#6b5646' : '#4a525c';
          ctx.beginPath(); ctx.moveTo(bx + 8, tipY); ctx.lineTo(bx + 16, y + T); ctx.lineTo(bx + 8, y + T); ctx.fill();
          ctx.fillStyle = av ? '#ff2e4d' : '#8a3a1e';
          ctx.beginPath(); ctx.moveTo(bx + 8, tipY); ctx.lineTo(bx + 5.5, tipY + 8); ctx.lineTo(bx + 10.5, tipY + 8); ctx.fill();
        }
      }
    }
    drawGate();
  }
  function drawHive() {
    const x0 = (GATE_X - 1) * T - cam.x, x1 = 189 * T - cam.x;
    if (x1 < 0 || x0 > VW) return;
    const av = world === AVESSO;
    const top = 0.4 * T - cam.y, bot = 12 * T - cam.y;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, av ? '#0c0205' : '#101a14'); g.addColorStop(1, av ? '#2a0610' : '#23301f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 + 60, bot); ctx.lineTo(x0 + 60, top + 60);
    ctx.quadraticCurveTo((x0 + x1) / 2, top - 60, x1, top + 60); ctx.lineTo(x1, bot); ctx.closePath(); ctx.fill();
    // costelas orgânicas
    for (let rx = x0 + 150; rx < x1; rx += 170) {
      ctx.strokeStyle = av ? '#3a0c16' : '#34452c'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(rx - 60, bot); ctx.quadraticCurveTo(rx - 50, top + 40, rx + 40, top + 50); ctx.stroke();
      ctx.strokeStyle = av ? 'rgba(255,90,90,0.25)' : 'rgba(200,255,170,0.18)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rx - 66, bot); ctx.quadraticCurveTo(rx - 56, top + 36, rx + 36, top + 44); ctx.stroke();
    }
    // veias pulsantes
    const vc = av ? '255,40,60' : '140,255,90';
    for (let k = 0; k < 6; k++) {
      const vy = top + 90 + k * 55, a = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(time * 3 - k));
      ctx.strokeStyle = `rgba(${vc},${a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x0 + 60, vy);
      for (let xx = x0 + 60; xx < x1; xx += 60) ctx.lineTo(xx, vy + Math.sin(xx * 0.05 + k) * 12);
      ctx.stroke();
    }
    // ovos no chão
    for (let k = 0; k < 8; k++) {
      const ex = x0 + 200 + k * 180 + hash(k, 90) * 60, ey = bot;
      const eg = ctx.createRadialGradient(ex - 5, ey - 30, 2, ex, ey - 20, 26);
      eg.addColorStop(0, av ? '#ff8a8a' : '#d9ffb0'); eg.addColorStop(1, av ? '#3a0a12' : '#2f4a1f');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(ex, ey - 20, 16, 22, 0, 0, 7); ctx.fill();
      glow(ex, ey - 22, 22, `rgba(${vc},${0.2 + 0.15 * Math.sin(time * 2 + k)})`);
    }
  }
  function drawGate() {
    const gx = GATE_X * T - cam.x, gy = 1 * T - cam.y, gw = 2 * T, gh = 11 * T;
    if (gx > VW + 100 || gx + gw < -100) return;
    const av = world === AVESSO;
    ctx.save();
    // pilares de quitina
    for (const [px, dir] of [[gx - 40, -1], [gx + gw, 1]]) {
      const g = ctx.createLinearGradient(px, 0, px + 40, 0);
      g.addColorStop(dir < 0 ? 0 : 1, av ? '#1a060a' : '#1c2418'); g.addColorStop(dir < 0 ? 1 : 0, av ? '#4a1420' : '#46583a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(px, gy + gh); ctx.lineTo(px + 6, gy - 20); ctx.lineTo(px + 34, gy - 30); ctx.lineTo(px + 40, gy + gh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#050304'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 9; k++) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.moveTo(px + 4, gy + k * 58); ctx.lineTo(px + 36, gy + k * 58 + 10); ctx.stroke(); }
    }
    // membrana/porta que sobe
    const lift = gateLift * (gh - 20);
    ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    const mg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    mg.addColorStop(0, av ? '#2a0610' : '#1f2a1a'); mg.addColorStop(0.5, av ? '#6a1424' : '#4d6a36'); mg.addColorStop(1, av ? '#2a0610' : '#1f2a1a');
    ctx.fillStyle = mg; ctx.fillRect(gx, gy - lift, gw, gh);
    ctx.strokeStyle = av ? '#12030a' : '#141c10'; ctx.lineWidth = 6;
    for (let k = 0; k < 12; k++) { const by = gy + 20 + k * 44 - lift; ctx.beginPath(); ctx.moveTo(gx, by); ctx.quadraticCurveTo(gx + gw / 2, by + 16, gx + gw, by); ctx.stroke(); }
    ctx.strokeStyle = av ? 'rgba(255,60,70,0.5)' : 'rgba(160,255,110,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx + gw / 2, gy - lift); ctx.lineTo(gx + gw / 2, gy + gh - lift); ctx.stroke();
    ctx.restore();
    // arco com os encaixes dos fragmentos
    ctx.fillStyle = av ? '#2a0a12' : '#26301f';
    ctx.beginPath(); ctx.moveTo(gx - 46, gy + 4); ctx.quadraticCurveTo(gx + gw / 2, gy - 70, gx + gw + 46, gy + 4); ctx.lineTo(gx + gw + 40, gy + 14); ctx.quadraticCurveTo(gx + gw / 2, gy - 40, gx - 40, gy + 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#050304'; ctx.lineWidth = 2; ctx.stroke();
    for (let k = 0; k < 3; k++) drawShard(gx + gw / 2 + (k - 1) * 30, gy - 20 - (k === 1 ? 8 : 0), 9, k < runes, k < runes ? 1 : 0.4);
  }
  function drawShard(x, y, s, lit, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (lit) glow(x, y, s * 3, 'rgba(255,40,70,0.9)');
    const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
    g.addColorStop(0, lit ? '#ffb0b8' : '#5a4a50'); g.addColorStop(0.5, lit ? '#ff2e4d' : '#3a2a30'); g.addColorStop(1, lit ? '#5a0018' : '#1a1014');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x + s * 0.8, y - s * 0.2); ctx.lineTo(x + s * 0.4, y + s * 1.3); ctx.lineTo(x - s * 0.5, y + s * 1.1); ctx.lineTo(x - s * 0.8, y - s * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#140308'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = lit ? 'rgba(255,230,230,0.8)' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x, y + s * 1.2); ctx.stroke();
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
  // balão de comunicação no estilo de painel tático
  function bubble(x, y, text, opts = {}) {
    const font = `600 16px ${FONT}`;
    const lines = wrapText(text, opts.maxW || 300, font);
    const lh = 19, pad = 12;
    let w = 0; lines.forEach((l) => { w = Math.max(w, ctx.measureText(l).width); });
    w += pad * 2; const h = lines.length * lh + pad * 2 - 2;
    const bx = clamp(x - w / 2, 8, VW - w - 8), by = y - h - 14;
    const acc = opts.accent || (world ? '#ff4d6d' : '#7fe8ff');
    ctx.fillStyle = 'rgba(6,10,16,0.88)'; bevelRect(bx, by, w, h, 8); ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = acc; ctx.fillRect(bx, by, 3, h - 8);
    ctx.strokeStyle = acc; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(x, by + h); ctx.lineTo(x, by + h + 12); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8f1f8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad + 2, by + pad + i * lh));
  }
  function drawSigns() {
    for (const s of signs) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < -300 || x > VW + 300) continue;
      const av = world === AVESSO, acc = av ? '#ff4d6d' : '#7fe8ff';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 16, 4, 0, 0, 7); ctx.fill();
      const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, '#6a7480'); g.addColorStop(1, '#2a3038');
      ctx.fillStyle = g; ctx.fillRect(x - 4, y - 30, 8, 30);
      ctx.fillStyle = '#20262e'; bevelRect(x - 14, y - 40, 28, 12, 3); ctx.fill();
      ctx.fillStyle = acc; ctx.fillRect(x - 9, y - 36, 18, 3);
      // holograma
      const flick = Math.random() < 0.04 ? 0.3 : 1;
      ctx.save(); ctx.globalAlpha = (0.55 + 0.15 * Math.sin(time * 6)) * flick;
      const hg = ctx.createLinearGradient(0, y - 80, 0, y - 40);
      hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, av ? 'rgba(255,77,109,0.35)' : 'rgba(127,232,255,0.35)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(x - 9, y - 40); ctx.lineTo(x - 20, y - 80); ctx.lineTo(x + 20, y - 80); ctx.lineTo(x + 9, y - 40); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 76); ctx.lineTo(x + 11, y - 56); ctx.lineTo(x - 11, y - 56); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = acc; ctx.font = `700 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y - 62);
      ctx.restore();
    }
  }
  function drawSignBubbles() {
    for (const s of signs) {
      if (Math.abs(s.x - (P.x + P.w / 2)) < 110 && Math.abs(s.y - (P.y + P.h)) < 140) bubble(s.x - cam.x, s.y - 84 - cam.y, s.text);
    }
  }
  function drawCheckpoints() {
    for (const cp of checkpoints) {
      const x = cp.x - cam.x, y = cp.y - cam.y;
      if (x < -60 || x > VW + 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 5, 0, 0, 7); ctx.fill();
      if (cp.on) {
        const bg = ctx.createLinearGradient(0, y - 200, 0, y - 60);
        bg.addColorStop(0, 'rgba(125,255,154,0)'); bg.addColorStop(1, `rgba(125,255,154,${0.25 + 0.1 * Math.sin(time * 4)})`);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bg; ctx.fillRect(x - 6, y - 220, 12, 160); ctx.restore();
      }
      ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 6, y - 16); ctx.lineTo(x + 14, y); ctx.fill();
      const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0); g.addColorStop(0, '#9aa3ad'); g.addColorStop(1, '#3a424c');
      ctx.fillStyle = g; ctx.fillRect(x - 2.5, y - 60, 5, 46);
      const lc = cp.on ? '#7dff9a' : '#ff4d4d';
      glow(x, y - 64, cp.on ? 34 : 14, cp.on ? 'rgba(125,255,154,0.8)' : 'rgba(255,60,60,0.5)', cp.on ? 1 : 0.5 + 0.5 * Math.sin(time * 5));
      ctx.fillStyle = lc; ctx.beginPath(); ctx.arc(x, y - 64, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1f25'; ctx.fillRect(x - 7, y - 58, 14, 3);
    }
  }
  function drawSage() {
    const x = sage.x - cam.x, y = sage.y - cam.y;
    if (x < -100 || x > VW + 100) return;
    ctx.save(); ctx.translate(x, y);
    if (world === AVESSO) ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 2, 34, 6, 0, 0, 7); ctx.fill();
    // console
    const g = ctx.createLinearGradient(-28, 0, 28, 0); g.addColorStop(0, '#5a646f'); g.addColorStop(1, '#262c34');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-22, -34); ctx.lineTo(22, -34); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#10161c'; ctx.fillRect(-16, -28, 32, 12);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#ff9a1f', '#7dff9a', '#7fe8ff', '#ff4d4d'][k]; ctx.fillRect(-13 + k * 7, -25, 4, 3 + (Math.sin(time * 5 + k) > 0 ? 3 : 0)); }
    ctx.strokeStyle = '#8a94a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(24, -70); ctx.stroke();
    ctx.fillStyle = Math.sin(time * 6) > 0 ? '#ff4d4d' : '#5a1010'; ctx.beginPath(); ctx.arc(24, -72, 3, 0, 7); ctx.fill();
    // holograma do Comandante
    const flick = Math.random() < 0.06 ? 0.35 : 1;
    ctx.globalAlpha *= (0.7 + 0.1 * Math.sin(time * 9)) * flick;
    const hg = ctx.createLinearGradient(0, -110, 0, -34);
    hg.addColorStop(0, 'rgba(127,232,255,0)'); hg.addColorStop(1, 'rgba(127,232,255,0.3)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(-30, -112); ctx.lineTo(30, -112); ctx.lineTo(14, -34); ctx.fill();
    ctx.fillStyle = 'rgba(127,232,255,0.55)'; ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-22, -52); ctx.quadraticCurveTo(0, -70, 22, -52); ctx.lineTo(22, -46); ctx.lineTo(-22, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -66); ctx.lineTo(-10, -88); ctx.lineTo(10, -88); ctx.lineTo(10, -70); ctx.lineTo(4, -62); ctx.lineTo(-6, -62); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13, -86); ctx.quadraticCurveTo(-4, -100, 14, -92); ctx.lineTo(12, -86); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,30,40,0.6)'; ctx.fillRect(-7, -80, 16, 3);
    ctx.strokeStyle = 'rgba(191,244,255,0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const yy = -110 + ((time * 40 + k * 10) % 76); ctx.beginPath(); ctx.moveTo(-24, yy); ctx.lineTo(24, yy); ctx.stroke(); }
    ctx.restore();
    if (!sage.talked && world === NORMAL) {
      ctx.save(); ctx.translate(x, y - 128 + Math.sin(time * 5) * 4);
      ctx.fillStyle = '#7fe8ff'; ctx.font = `700 30px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.strokeText('!', 0, 0); ctx.fillText('!', 0, 0);
      ctx.restore();
    }
  }
  function drawSageBubble() {
    if (sage.near) bubble(sage.x - cam.x, sage.y - 118 - cam.y, SAGE_LINES[sage.line], { maxW: 340 });
  }
  function drawMedkit(x, y) {
    glow(x, y, 26, 'rgba(125,255,154,0.35)');
    ctx.fillStyle = '#d9dee4'; bevelRect(x - 13, y - 9, 26, 19, 3); ctx.fill();
    ctx.fillStyle = '#9aa3ad'; ctx.fillRect(x - 13, y + 5, 26, 5);
    ctx.fillStyle = '#6a737d'; ctx.fillRect(x - 5, y - 13, 10, 4);
    ctx.fillStyle = '#e02a2a'; ctx.fillRect(x - 2.5, y - 6, 5, 12); ctx.fillRect(x - 6, y - 2.5, 12, 5);
    ctx.strokeStyle = '#1a1f25'; ctx.lineWidth = 1.5; bevelRect(x - 13, y - 9, 26, 19, 3); ctx.stroke();
  }
  function drawPickups() {
    for (const it of pickups) {
      const x = it.x - cam.x, y = it.y - cam.y + Math.sin(it.t * 3) * 4;
      if (x < -40 || x > VW + 40) continue;
      if (it.type === 'heart') {
        drawMedkit(x, y);
      } else {
        const here = it.world === world;
        ctx.save();
        if (!here) ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 4);
        ctx.translate(x, y); ctx.scale(Math.cos(it.t * 2), 1);
        drawShard(0, 0, 14, true, 1);
        ctx.restore();
        if (here) {
          ctx.strokeStyle = `rgba(255,77,109,${0.5 + 0.3 * Math.sin(time * 4)})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(time * 3) * 3, time, time + 1.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(time * 3) * 3, time + Math.PI, time + Math.PI + 1.5); ctx.stroke();
        }
      }
    }
  }
  function drawPortal() {
    if (!portal) return;
    const x = portal.x - cam.x, y = portal.y - cam.y;
    const open = Math.min(1, portal.t / 0.12);
    const closing = portal.ok ? clamp((portal.life - portal.t) / 0.4, 0, 1) : clamp(1 - portal.t / portal.life, 0, 1);
    const s = open * closing;
    const other = 1 - world;
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.01, s), 1 * Math.max(0.2, s));
    if (!portal.ok) {
      ctx.strokeStyle = '#ff4f4f'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 54, 0, 0, 7); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke();
      ctx.restore(); return;
    }
    const c1 = other ? '255,46,77' : '127,232,255', c2 = other ? '255,154,107' : '255,210,122';
    glow(0, 0, 110, `rgba(${c1},0.45)`);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 58);
    if (other) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, '#ff5a6e'); g.addColorStop(0.6, '#3a0610'); g.addColorStop(1, '#050103'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, '#ffd27a'); g.addColorStop(0.6, '#35325c'); g.addColorStop(1, '#0b1530'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 30, 58, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = `rgba(${c2},${0.35 - k * 0.06})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 6 + k * 7, 14 + k * 12, 0, time * (5 + k) + k, time * (5 + k) + k + 2.6); ctx.stroke();
    }
    // arcos elétricos no anel
    ctx.strokeStyle = `rgba(${c1},0.95)`; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, j = rand(-4, 4);
      const px = Math.cos(a) * (32 + j), py = Math.sin(a) * (60 + j);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, 31, 59, 0, 0, 7); ctx.stroke();
    for (let k = 0; k < 10; k++) {
      const a = time * 3 + k * 0.63, r = 1 - ((time * 1.5 + k * 0.1) % 1);
      ctx.fillStyle = `rgba(${c2},${r})`;
      ctx.fillRect(Math.cos(a) * 60 * r, Math.sin(a) * 90 * r, 2.5, 2.5);
    }
    ctx.restore();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ desenho: agente */
  // Agente Vulto: ombros enormes, pernas curtas, queixo quadrado e um rifle pesado.
  function drawAgent(o) {
    // o: {face, run, ph, onGround, vx, aim, recoil, muzzle, wd, ghost}
    ctx.save();
    ctx.scale(o.face, 1);
    const av = o.wd === AVESSO;
    const rim = av ? 'rgba(255,70,80,0.9)' : 'rgba(255,190,120,0.9)';
    const accent = av ? '#ff2e4d' : '#ff9a1f';
    if (o.ghost) {
      ctx.fillStyle = av ? 'rgba(255,60,80,0.45)' : 'rgba(127,232,255,0.45)';
      ctx.beginPath(); ctx.moveTo(-18, -46); ctx.lineTo(18, -46); ctx.lineTo(8, -16); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.lineTo(-8, -16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(1, -54, 9, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    const bob = o.run ? Math.abs(Math.sin(o.ph)) * -2 : 0;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // cauda do sobretudo
    const wave = Math.sin(time * 10) * 2, tail = Math.min(12, Math.abs(o.vx) / 30) + (o.onGround ? 0 : 4);
    ctx.fillStyle = '#15181f';
    ctx.beginPath(); ctx.moveTo(-10, -22 + bob); ctx.lineTo(-14 - tail, -4 + wave); ctx.lineTo(-10 - tail * 0.6, -1 - wave); ctx.lineTo(-2, -8 + bob); ctx.closePath(); ctx.fill();
    // pernas curtas
    const leg = (dx, lift, back) => {
      ctx.fillStyle = back ? '#1c2029' : '#2a303b';
      roundRect(dx - 4, -18 + bob, 8, 12 - lift, 3); ctx.fill();
      ctx.fillStyle = back ? '#0b0c10' : '#16181e';
      roundRect(dx - 5, -8 - lift, 12, 8, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(dx - 4, -8 - lift, 10, 2);
    };
    const s1 = o.run ? Math.sin(o.ph) * 6 : 0;
    const l1 = o.run ? Math.max(0, Math.cos(o.ph)) * 4 : 0, l2 = o.run ? Math.max(0, -Math.cos(o.ph)) * 4 : 0;
    const air = o.onGround ? 0 : 3;
    leg(-4 - s1, l1 + air, true);
    leg(5 + s1, l2 + air * 0.5, false);
    // torso enorme (trapézio invertido)
    const tg = ctx.createLinearGradient(-22, 0, 22, 0);
    tg.addColorStop(0, '#565f70'); tg.addColorStop(0.45, '#353c4a'); tg.addColorStop(1, '#1b1f28');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(-21, -47 + bob); ctx.lineTo(21, -47 + bob); ctx.quadraticCurveTo(22, -34 + bob, 10, -18 + bob); ctx.lineTo(-10, -18 + bob); ctx.quadraticCurveTo(-22, -34 + bob, -21, -47 + bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#08090c'; ctx.lineWidth = 2; ctx.stroke();
    // placas do colete
    ctx.fillStyle = '#434b5a'; bevelRect(-12, -43 + bob, 22, 14, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-11, -43 + bob, 20, 2);
    ctx.fillStyle = '#2a303b'; ctx.fillRect(-9, -28 + bob, 16, 5);
    // cinto
    ctx.fillStyle = '#0f1116'; ctx.fillRect(-11, -22 + bob, 22, 5);
    ctx.fillStyle = accent; ctx.fillRect(-2, -21.5 + bob, 5, 4);
    glow(0, -20 + bob, 8, av ? 'rgba(255,46,77,0.6)' : 'rgba(255,154,31,0.6)');
    // luz de contorno nas costas
    ctx.strokeStyle = rim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-21, -46 + bob); ctx.quadraticCurveTo(-22, -34 + bob, -11, -19 + bob); ctx.stroke();
    // pescoço e cabeça (queixo quadrado)
    ctx.fillStyle = '#a86a48'; ctx.fillRect(-4, -52 + bob, 10, 7);
    const hg = ctx.createLinearGradient(-8, 0, 12, 0);
    hg.addColorStop(0, '#e6ae84'); hg.addColorStop(1, '#9a5c3e');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-7, -68 + bob); ctx.lineTo(9, -68 + bob); ctx.lineTo(11, -58 + bob); ctx.lineTo(10, -51 + bob); ctx.lineTo(-3, -50 + bob); ctx.lineTo(-8, -55 + bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a140a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(40,20,10,0.35)'; ctx.fillRect(-2, -55 + bob, 12, 4);
    ctx.strokeStyle = '#3a1a0c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4, -53 + bob); ctx.lineTo(9, -53.5 + bob); ctx.stroke();
    // cabelo raspado
    ctx.fillStyle = '#16100c';
    ctx.beginPath(); ctx.moveTo(-8, -64 + bob); ctx.lineTo(-7, -71 + bob); ctx.lineTo(9, -71 + bob); ctx.lineTo(10, -67 + bob); ctx.lineTo(-2, -66 + bob); ctx.lineTo(-4, -60 + bob); ctx.lineTo(-8, -58 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b77a55'; ctx.beginPath(); ctx.ellipse(-4, -60 + bob, 2.5, 3.5, 0, 0, 7); ctx.fill();
    // óculos táticos
    ctx.fillStyle = '#07090c'; ctx.beginPath(); ctx.moveTo(-2, -63 + bob); ctx.lineTo(12, -63 + bob); ctx.lineTo(11, -58.5 + bob); ctx.lineTo(0, -59 + bob); ctx.closePath(); ctx.fill();
    const glint = (Math.sin(time * 1.5) + 1) / 2;
    ctx.fillStyle = av ? `rgba(255,90,100,${0.5 + glint * 0.5})` : `rgba(127,232,255,${0.5 + glint * 0.5})`;
    ctx.fillRect(4 + glint * 4, -62.5 + bob, 3, 1.5);
    // braço traseiro + rifle girando na mira
    const ang = clamp(Math.abs(o.aim.x) > 0.01 ? Math.atan2(o.aim.y, Math.abs(o.aim.x)) : 0, -1.2, 1.2);
    ctx.save(); ctx.translate(4, -38 + bob); ctx.rotate(ang); ctx.translate(-o.recoil * 5, 0);
    ctx.fillStyle = '#1c2029'; roundRect(-2, -3, 16, 8, 4); ctx.fill();
    // rifle
    const gg = ctx.createLinearGradient(0, -8, 0, 8);
    gg.addColorStop(0, '#5a6270'); gg.addColorStop(1, '#161a20');
    ctx.fillStyle = '#101318'; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = gg; bevelRect(0, -7, 34, 12, 3); ctx.fill();
    ctx.fillStyle = '#252a33'; ctx.fillRect(30, -4, 20, 6);
    ctx.fillStyle = '#0c0e12'; ctx.fillRect(48, -5, 5, 8);
    ctx.fillStyle = '#0c0e12'; ctx.fillRect(12, 5, 7, 10);
    ctx.fillStyle = av ? '#ff2e4d' : '#7fe8ff'; ctx.fillRect(6, -4, 18, 3);
    glow(15, -2.5, 14, av ? 'rgba(255,46,77,0.5)' : 'rgba(127,232,255,0.5)');
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(1, -7, 32, 1.5);
    ctx.fillStyle = '#2a303b'; ctx.fillRect(18, -11, 10, 4);
    // mão da frente
    ctx.fillStyle = '#16181e'; roundRect(20, 2, 8, 7, 3); ctx.fill();
    if (o.muzzle > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(58, -1, 40, 'rgba(255,200,120,0.9)');
      ctx.fillStyle = '#fff4d0'; star(58, -1, 12 + Math.random() * 6, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,80,0.9)'; ctx.beginPath(); ctx.moveTo(53, -4); ctx.lineTo(76 + Math.random() * 8, -1); ctx.lineTo(53, 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // ombreira gigante da frente
    const sg = ctx.createLinearGradient(0, -52 + bob, 0, -40 + bob);
    sg.addColorStop(0, '#7a8494'); sg.addColorStop(1, '#262c36');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(2, -44 + bob); ctx.quadraticCurveTo(4, -53 + bob, 14, -52 + bob); ctx.quadraticCurveTo(23, -50 + bob, 22, -41 + bob); ctx.lineTo(16, -40 + bob); ctx.quadraticCurveTo(10, -45 + bob, 2, -44 + bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#08090c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(8, -51 + bob, 8, 1.5);
    ctx.restore();
  }
  function drawPlayer() {
    dropShadow(P.x + P.w / 2, P.y + P.h, 40);
    for (const tr of P.trail) {
      ctx.save(); ctx.globalAlpha = tr.life * 1.6;
      ctx.translate(Math.round(tr.x + P.w / 2 - cam.x), Math.round(tr.y + P.h - cam.y));
      drawAgent({ face: tr.face, wd: world, ghost: true, aim: P.aim });
      ctx.restore();
    }
    if (P.inv > 0 && P.dashT <= 0 && Math.floor(P.inv * 16) % 2 === 0) return;
    ctx.save();
    if (world === AVESSO) glow(P.x + P.w / 2 - cam.x, P.y + P.h / 2 - 10 - cam.y, 60, 'rgba(255,120,120,0.18)');
    ctx.translate(Math.round(P.x + P.w / 2 - cam.x), Math.round(P.y + P.h - cam.y));
    const sq = P.squash;
    ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);
    drawAgent({ face: P.face, run: P.onGround && Math.abs(P.vx) > 20, ph: P.anim * 2.2, onGround: P.onGround, vx: P.vx, aim: P.aim, recoil: P.recoil, muzzle: P.muzzle, wd: world });
    ctx.restore();
  }

  /* ------------------------------------------------------------------ desenho: alienígenas */
  function alienEye(x, y, r, lx, ly, iris, fl, slit) {
    const eg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    eg.addColorStop(0, fl ? '#fff' : '#fffbe8'); eg.addColorStop(1, fl ? '#fff' : '#c9b89a');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#140608'; ctx.lineWidth = 1.5; ctx.stroke();
    const d = Math.hypot(lx, ly) || 1, ox = lx / d * r * 0.35, oy = ly / d * r * 0.35;
    ctx.fillStyle = fl ? '#fff' : iris; ctx.beginPath(); ctx.arc(x + ox, y + oy, r * 0.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#050102';
    if (slit) { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r * 0.14, r * 0.5, 0, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x + ox, y + oy, r * 0.28, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + ox - r * 0.25, y + oy - r * 0.3, r * 0.14, 0, 7); ctx.fill();
  }
  function drawEnemyBody(e, frozen) {
    const fl = e.flash > 0;
    const C = (c) => (fl ? '#ffffff' : c);
    const c = pcenter();
    const lx = c.x - (e.x + e.w / 2), ly = c.y - (e.y + e.h / 2);
    const t = frozen ? e.t : e.t;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (e.type) {
      case 'slime': {
        // Larva Ácida: gosma translúcida com órgãos visíveis e olhos em pedúnculos
        const sq = e.squash;
        ctx.scale(1 + sq * 0.3, 1 - sq * 0.3);
        for (let k = -1; k <= 1; k++) {
          const sx = k * 8, sw = Math.sin(t * 5 + k) * 3;
          ctx.strokeStyle = C('#3f7a1a'); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(sx, -24); ctx.quadraticCurveTo(sx + sw, -34, sx + sw * 1.5, -40 - (k === 0 ? 4 : 0)); ctx.stroke();
          ctx.fillStyle = C('#101a08'); ctx.beginPath(); ctx.arc(sx + sw * 1.5, -41 - (k === 0 ? 4 : 0), 3.5, 0, 7); ctx.fill();
          ctx.fillStyle = C('#ff3b3b'); ctx.beginPath(); ctx.arc(sx + sw * 1.5 + Math.sign(lx), -41 - (k === 0 ? 4 : 0), 1.5, 0, 7); ctx.fill();
        }
        const g = ctx.createRadialGradient(-6, -22, 2, 0, -12, 26);
        g.addColorStop(0, C('#d8ff8a')); g.addColorStop(0.5, C('#6fbf2a')); g.addColorStop(1, C('#1e4a0c'));
        ctx.fillStyle = g; ctx.globalAlpha *= 0.94;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.bezierCurveTo(-24, -20, -10, -30, 0, -28); ctx.bezierCurveTo(12, -30, 24, -18, 20, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C('rgba(30,60,10,0.7)'); ctx.beginPath(); ctx.ellipse(-2, -10, 8, 5, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = C('rgba(160,40,40,0.6)'); ctx.beginPath(); ctx.arc(6, -14, 3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-9, -20, 4, 2, -0.5, 0, 7); ctx.fill();
        ctx.fillStyle = C('#9bff4a'); ctx.beginPath(); ctx.ellipse(12, 2 + Math.sin(t * 3) * 2, 2, 4, 0, 0, 7); ctx.fill();
        break;
      }
      case 'bat': {
        // Drone Ocular: olho biomecânico com asas de inseto
        ctx.translate(0, -16);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const s of [-1, 1]) {
          ctx.save(); ctx.scale(s, 1); ctx.rotate(Math.sin(t * 40) * 0.5 - 0.3);
          ctx.fillStyle = 'rgba(190,230,255,0.28)';
          ctx.beginPath(); ctx.ellipse(22, -4, 20, 6, -0.2, 0, 7); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        ctx.strokeStyle = C('#2a1a18'); ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * 5, 10); ctx.quadraticCurveTo(k * 8 + Math.sin(t * 4 + k) * 5, 20, k * 4, 28); ctx.stroke(); }
        alienEye(0, 0, 13, lx, ly, '#e02a2a', fl, true);
        const sh = ctx.createLinearGradient(0, -16, 0, 0);
        sh.addColorStop(0, C('#5a4540')); sh.addColorStop(1, C('#1e1412'));
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(8, -4); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C('#5a4540'); ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI * 0.2, Math.PI * 0.8); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();
        break;
      }
      case 'shooter': {
        // Cuspidor: bolsa orgânica que infla e cospe ácido
        ctx.scale(e.face, 1);
        const inflate = e.stT > 0 ? 1.15 : 1 + Math.sin(t * 3) * 0.04;
        ctx.strokeStyle = C('#2a3a14'); ctx.lineWidth = 3;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 4, -4); ctx.quadraticCurveTo(k * 10, 0, k * 13, 0); ctx.stroke(); }
        ctx.fillStyle = C('#3d4f20'); ctx.fillRect(-4, -16, 8, 14);
        const g = ctx.createRadialGradient(-8, -36, 3, 0, -28, 24 * inflate);
        g.addColorStop(0, C('#d9e88a')); g.addColorStop(0.55, C('#7a8f2e')); g.addColorStop(1, C('#2a3510'));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -30, 18 * inflate, 20 * inflate, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = C('rgba(120,20,30,0.6)'); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-12, -40); ctx.quadraticCurveTo(-4, -30, -10, -18); ctx.moveTo(4, -46); ctx.quadraticCurveTo(0, -36, 6, -22); ctx.stroke();
        const open = e.stT > 0 ? 1 : 0.25;
        ctx.fillStyle = C('#8a2a20');
        ctx.beginPath(); ctx.moveTo(14, -36); ctx.lineTo(26, -30 - open * 8); ctx.lineTo(26, -30 + open * 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C('#1a0505'); ctx.beginPath(); ctx.ellipse(18, -30, 4, 2 + open * 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#e8e0c8');
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(15, -34 + k * 3 - open * 2); ctx.lineTo(20, -33 + k * 3 - open * 2); ctx.lineTo(15, -32 + k * 3 - open * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-8, -40, 5, 3, -0.6, 0, 7); ctx.fill();
        break;
      }
      case 'crawler': {
        // Rastejador: exoesqueleto negro brilhante, espinhos de osso e mandíbula interna
        ctx.scale(-e.face, 1);
        ctx.strokeStyle = C('#0a0406'); ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const lx2 = 2 + k * 11, sw = Math.sin(t * 18 + k * 1.3) * 5;
          ctx.beginPath(); ctx.moveTo(lx2, -10); ctx.lineTo(lx2 - 6 + sw, -18); ctx.lineTo(lx2 - 10 + sw, 0); ctx.stroke();
        }
        for (let k = 3; k >= 0; k--) {
          const sx = 6 + k * 11, sy = -12 + Math.sin(t * 10 + k) * 1.5, r = 12 - k * 1.6;
          const g = ctx.createRadialGradient(sx - 3, sy - 5, 1, sx, sy, r);
          g.addColorStop(0, C('#5a3a44')); g.addColorStop(1, C('#0d0508'));
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.85, 0, 0, 7); ctx.fill();
          ctx.fillStyle = C('#d8c3a5'); ctx.beginPath(); ctx.moveTo(sx - 3, sy - r * 0.7); ctx.lineTo(sx + 2, sy - r - 7); ctx.lineTo(sx + 4, sy - r * 0.6); ctx.fill();
          ctx.fillStyle = C('#ff2e4d'); ctx.fillRect(sx - 2, sy + 1, 4, 1.5);
        }
        const hg = ctx.createLinearGradient(-30, -24, -4, -4);
        hg.addColorStop(0, C('#4a3038')); hg.addColorStop(1, C('#0d0508'));
        ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-4, -20); ctx.quadraticCurveTo(-22, -30, -34, -16); ctx.lineTo(-28, -8); ctx.quadraticCurveTo(-16, -4, -2, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-18, -23, 8, 2, -0.2, 0, 7); ctx.fill();
        const jaw = Math.sin(t * 12) > 0 ? 3 : 0;
        ctx.fillStyle = C('#3a0a12'); ctx.beginPath(); ctx.moveTo(-30, -12); ctx.lineTo(-36 - jaw, -8); ctx.lineTo(-26, -6); ctx.fill();
        ctx.fillStyle = C('#e8dcc8'); ctx.fillRect(-34 - jaw, -11, 3, 2);
        glow(-20, -16, 10, 'rgba(255,40,60,0.8)');
        ctx.fillStyle = C('#ff2e4d'); ctx.beginPath(); ctx.ellipse(-20, -16, 3, 1.5, 0.3, 0, 7); ctx.ellipse(-13, -15, 2, 1.2, 0.3, 0, 7); ctx.fill();
        break;
      }
      case 'eye': {
        // Vigia: cérebro exposto flutuante com um olho gigante e tentáculos
        ctx.translate(0, -26);
        ctx.strokeStyle = C('#3a0c14'); ctx.lineWidth = 4;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath(); ctx.moveTo(k * 6, 12);
          ctx.bezierCurveTo(k * 9 + Math.sin(t * 3 + k) * 9, 26, k * 5 - Math.sin(t * 3 + k) * 9, 36, k * 8 + Math.sin(t * 2 + k) * 4, 48); ctx.stroke();
        }
        glow(0, 0, 40, 'rgba(255,40,60,0.35)');
        const g = ctx.createRadialGradient(-8, -14, 2, 0, -4, 24);
        g.addColorStop(0, C('#ffc2c2')); g.addColorStop(0.6, C('#b8505a')); g.addColorStop(1, C('#4a1018'));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -6, 22, 17, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = C('rgba(80,10,20,0.7)'); ctx.lineWidth = 1.8;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-18 + k * 8, -16); ctx.bezierCurveTo(-14 + k * 8, -8, -20 + k * 8, -4, -15 + k * 8, 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 6); ctx.stroke();
        alienEye(0, 8, 11, lx, ly, e.stT > 0 ? '#ff2e4d' : '#ffcf3a', fl, true);
        break;
      }
      case 'hand': {
        // Saltador: aracnídeo alienígena de pernas longas e mandíbulas
        ctx.scale(e.face, 1);
        const walk = e.onGround ? Math.sin(t * 14) * 4 : 6;
        ctx.strokeStyle = C('#0d0306'); ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
          const bx = s * (4 + k * 4), kx = s * (18 + k * 6), fx = s * (22 + k * 7);
          const lift = (k % 2 ? walk : -walk) * s;
          ctx.beginPath(); ctx.moveTo(bx, -20); ctx.lineTo(kx, -36 + lift); ctx.lineTo(fx, 0); ctx.stroke();
        }
        const g = ctx.createRadialGradient(-6, -28, 2, 0, -20, 18);
        g.addColorStop(0, C('#6a2a36')); g.addColorStop(1, C('#12040a'));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-4, -22, 15, 12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#ff2e4d'); ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-4, -30); ctx.lineTo(2, -26); ctx.lineTo(-4, -20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C('#2a0a12'); ctx.beginPath(); ctx.ellipse(12, -20, 8, 7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = C('#d8c3a5');
        ctx.beginPath(); ctx.moveTo(17, -18); ctx.quadraticCurveTo(24, -16, 20, -10); ctx.lineTo(18, -15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(17, -22); ctx.quadraticCurveTo(25, -24, 21, -28); ctx.lineTo(18, -24); ctx.fill();
        glow(14, -22, 8, 'rgba(255,40,60,0.8)');
        ctx.fillStyle = C('#ff4d4d'); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(10 + k * 3, -24 + (k % 2) * 2, 1.3, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-9, -29, 6, 2, -0.3, 0, 7); ctx.fill();
        break;
      }
      case 'guardian': {
        // Guardião do Avesso: fera blindada com crista de osso e muitos olhos
        ctx.scale(-e.face, 1);
        const shakeX = e.st === 'wind' ? Math.sin(time * 60) * 2 : 0;
        ctx.translate(shakeX, 0);
        const step = e.st === 'charge' ? Math.sin(t * 30) * 6 : Math.sin(t * 8) * 4;
        ctx.fillStyle = C('#0d0306');
        for (const [lx2, ph] of [[-30, 0], [-10, 1], [18, 0], [36, 1]]) {
          ctx.beginPath(); ctx.moveTo(lx2 - 6, -24); ctx.lineTo(lx2 + 6, -24); ctx.lineTo(lx2 + 5 + (ph ? step : -step), 0); ctx.lineTo(lx2 - 9 + (ph ? step : -step), 0); ctx.closePath(); ctx.fill();
        }
        const g = ctx.createLinearGradient(0, -64, 0, -14);
        g.addColorStop(0, C('#5a2a36')); g.addColorStop(1, C('#12040a'));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-40, -20); ctx.bezierCurveTo(-46, -60, 30, -70, 48, -30); ctx.quadraticCurveTo(50, -14, 30, -14); ctx.lineTo(-30, -14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,120,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-38, -30); ctx.bezierCurveTo(-40, -58, 26, -66, 44, -34); ctx.stroke();
        ctx.fillStyle = C('#d8c3a5');
        for (let k = 0; k < 5; k++) { const bx = -24 + k * 13; ctx.beginPath(); ctx.moveTo(bx - 5, -52 + Math.abs(k - 2) * 3); ctx.lineTo(bx + 2, -74 + Math.abs(k - 2) * 5); ctx.lineTo(bx + 6, -52 + Math.abs(k - 2) * 3); ctx.fill(); }
        // cabeça
        const hg2 = ctx.createRadialGradient(-50, -40, 2, -46, -32, 24);
        hg2.addColorStop(0, C('#7a3a44')); hg2.addColorStop(1, C('#1a060c'));
        ctx.fillStyle = hg2; ctx.beginPath(); ctx.ellipse(-48, -32, 22, 18, -0.2, 0, 7); ctx.fill();
        ctx.fillStyle = C('#e8dcc8'); ctx.beginPath(); ctx.moveTo(-66, -36); ctx.quadraticCurveTo(-84, -50, -80, -64); ctx.quadraticCurveTo(-74, -48, -60, -42); ctx.fill();
        const jaw = e.st === 'charge' || e.st === 'wind' ? 8 : 2;
        ctx.fillStyle = '#1a0005'; ctx.beginPath(); ctx.moveTo(-68, -26); ctx.lineTo(-40, -22); ctx.lineTo(-66, -20 + jaw); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8dcc8'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-64 + k * 6, -25); ctx.lineTo(-62 + k * 6, -21); ctx.lineTo(-60 + k * 6, -25); ctx.fill(); }
        glow(-50, -36, 20, 'rgba(255,40,60,0.7)');
        ctx.fillStyle = C('#ff2e4d');
        [[-56, -38, 3], [-48, -40, 2.5], [-42, -36, 2], [-52, -32, 2]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); });
        break;
      }
    }
  }
  function drawEnemy(e, ghost) {
    const x = e.x + e.w / 2 - cam.x, yb = e.y + e.h - cam.y;
    if (x < -140 || x > VW + 140) return;
    const flying = e.type === 'bat' || e.type === 'eye';
    if (!ghost) dropShadow(e.x + e.w / 2, flying ? e.y + e.h : e.y + e.h, e.w * (flying ? 0.8 : 1.1), e.world);
    if (!ghost && e.world === AVESSO) glow(x, yb - e.h / 2, Math.max(e.w, e.h) * 1.1, 'rgba(255,60,70,0.28)');
    ctx.save(); ctx.translate(x, yb);
    if (ghost) ctx.globalAlpha = 0.28;
    drawEnemyBody(e, ghost || stasisT > 0);
    ctx.restore();
    // colchetes de mira: inimigos do outro mundo e os congelados na chegada
    const frozen = !ghost && stasisT > 0;
    if (ghost || frozen) {
      const col = ghost ? (e.world ? '255,77,109' : '159,195,232') : '127,232,255';
      const a = ghost ? 0.55 : Math.min(1, stasisT * 1.5);
      const bx = e.x - cam.x - 6, by = e.y - cam.y - 8, bw = e.w + 12, bh = e.h + 12, L = 8;
      ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by + L); ctx.lineTo(bx, by); ctx.lineTo(bx + L, by);
      ctx.moveTo(bx + bw - L, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + L);
      ctx.moveTo(bx, by + bh - L); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + L, by + bh);
      ctx.moveTo(bx + bw - L, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - L);
      ctx.stroke();
      if (frozen) {
        ctx.fillStyle = `rgba(127,232,255,${a * 0.12})`; ctx.fillRect(bx, by, bw, bh);
        ctx.font = `600 11px ${FONT}`; ctx.fillStyle = `rgba(127,232,255,${a})`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('CONGELADO', bx + bw / 2, by - 2);
      }
    }
    if (!ghost && e.hp < e.maxHp && e.type !== 'guardian') {
      const bw = 32, by = e.y - cam.y - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x - bw / 2, by, bw * e.hp / e.maxHp, 3);
    }
    if (!ghost && e.type === 'guardian') {
      const bw = 110, by = e.y - cam.y - 46;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - bw / 2 - 2, by - 2, bw + 4, 9);
      ctx.fillStyle = '#ff2e4d'; ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp) / e.maxHp, 5);
      ctx.font = `500 18px ${FONT_D}`; ctx.fillStyle = '#ffd0d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('GUARDIÃO DO AVESSO', x, by - 2);
    }
  }
  function drawEnemies() {
    for (const e of enemies) if (e.world !== world) drawEnemy(e, true);
    for (const e of enemies) if (e.world === world) drawEnemy(e, false);
  }

  /* ------------------------------------------------------------------ desenho: chefe */
  function drawBoss() {
    const b = boss;
    if (!b.active && !b.dead) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (x < -250 || x > VW + 250) return;
      // antes da luta: silhueta adormecida em um casulo
      ctx.save(); ctx.translate(x, y + 30 + Math.sin(time) * 4);
      const cg = ctx.createRadialGradient(0, 0, 10, 0, 0, 90);
      cg.addColorStop(0, world ? 'rgba(255,40,60,0.35)' : 'rgba(140,255,90,0.25)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.fill();
      ctx.fillStyle = world ? '#1a0508' : '#141c10'; ctx.beginPath(); ctx.ellipse(0, 0, 50, 76, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = world ? 'rgba(255,60,70,0.5)' : 'rgba(160,255,110,0.4)'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 50 - k * 2, 76 - k * 14, 0, -0.5, 0.5); ctx.stroke(); }
      ctx.restore();
      return;
    }
    if (b.dead && b.deadT > 2.4) return;
    const x = b.x - cam.x, y = b.y - cam.y;
    const vis = world === b.vuln;
    const fl = b.flash > 0;
    const C = (c) => (fl ? '#ffffff' : c);
    const av = world === AVESSO;
    const skin0 = av ? '#8a2a3a' : '#6a7a4a', skin1 = av ? '#2a0610' : '#1a2410', skinHi = av ? '#ff9a9a' : '#d8f0a0';
    const c = pcenter();
    // sombra no chão
    const d = FLOOR_Y - (b.y + 60);
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.55 - d / 700, 0.1, 0.55)})`;
    ctx.beginPath(); ctx.ellipse(x, FLOOR_Y - cam.y + 2, 110 - d * 0.08, 16, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(0.82, 0.82);
    if (b.dead) { ctx.rotate(Math.sin(b.deadT * 30) * 0.08); const k = 1 - b.deadT * 0.3; ctx.scale(k, k); }
    glow(0, 0, 200, av ? 'rgba(255,30,50,0.25)' : 'rgba(140,255,90,0.15)');
    // braços-tentáculo com garras
    for (let k = 0; k < 4; k++) {
      const s = k < 2 ? -1 : 1, i2 = k % 2;
      const bx = s * (30 + i2 * 26);
      const sw1 = Math.sin(b.t * 2.4 + k) * 24, sw2 = Math.sin(b.t * 3 + k * 2) * 20;
      const ex = bx + s * 40 + sw2, ey = 150 + i2 * 10;
      ctx.strokeStyle = '#050102'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(bx, 40); ctx.bezierCurveTo(bx + s * 30 + sw1, 80, bx - s * 10 - sw1, 120, ex, ey); ctx.stroke();
      ctx.strokeStyle = C(skin0); ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(bx, 40); ctx.bezierCurveTo(bx + s * 30 + sw1, 80, bx - s * 10 - sw1, 120, ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx - 3, 40); ctx.bezierCurveTo(bx + s * 30 + sw1 - 3, 80, bx - s * 10 - sw1 - 3, 120, ex - 3, ey); ctx.stroke();
      ctx.fillStyle = C('#e8dcc8');
      ctx.beginPath(); ctx.moveTo(ex - 6, ey); ctx.quadraticCurveTo(ex + s * 4, ey + 22, ex + s * 16, ey + 18); ctx.quadraticCurveTo(ex + s * 6, ey + 10, ex + 6, ey); ctx.fill();
    }
    // corpo/tórax
    const bg = ctx.createRadialGradient(-30, -30, 10, 0, 10, 110);
    bg.addColorStop(0, C(skinHi)); bg.addColorStop(0.35, C(skin0)); bg.addColorStop(1, C(skin1));
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-70, 20); ctx.bezierCurveTo(-80, -40, -40, -70, 0, -70); ctx.bezierCurveTo(40, -70, 80, -40, 70, 20); ctx.bezierCurveTo(60, 60, 30, 70, 0, 72); ctx.bezierCurveTo(-30, 70, -60, 60, -70, 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#050102'; ctx.lineWidth = 3; ctx.stroke();
    // costelas externas
    ctx.strokeStyle = C(av ? '#d8a0a0' : '#c9d8a0'); ctx.lineWidth = 4; ctx.globalAlpha = 0.7;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-58 + k * 4, 10 + k * 12); ctx.quadraticCurveTo(0, 30 + k * 14, 58 - k * 4, 10 + k * 12); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // coração exposto
    if (vis) {
      const pulse = 1 + Math.sin(time * 9) * 0.12;
      glow(0, 34, 70 * pulse, 'rgba(255,60,40,0.8)');
      const hg = ctx.createRadialGradient(-4, 28, 2, 0, 34, 20 * pulse);
      hg.addColorStop(0, '#fff0c0'); hg.addColorStop(0.4, C('#ff5a2e')); hg.addColorStop(1, C('#6a0010'));
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 34, 18 * pulse, 22 * pulse, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2a0005'; ctx.lineWidth = 2; ctx.stroke();
    }
    // crânio alongado para trás com crista de osso
    const cg = ctx.createLinearGradient(-40, -150, 40, -40);
    cg.addColorStop(0, C(skinHi)); cg.addColorStop(0.4, C(skin0)); cg.addColorStop(1, C(skin1));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(-46, -40); ctx.bezierCurveTo(-60, -110, -10, -170, 50, -190); ctx.bezierCurveTo(30, -140, 56, -90, 46, -40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#050102'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-40, -50); ctx.bezierCurveTo(-52, -110, -10, -160, 44, -182); ctx.stroke();
    ctx.fillStyle = C('#e8dcc8');
    for (let k = 0; k < 6; k++) {
      const t0 = k / 6, px = lerp(-30, 44, t0), py = lerp(-100, -186, t0) + Math.sin(t0 * 3) * 10;
      ctx.beginPath(); ctx.moveTo(px - 6, py + 6); ctx.lineTo(px - 18 - k * 2, py - 22 - k * 2); ctx.lineTo(px + 4, py); ctx.fill();
    }
    // mil olhos no rosto
    const eyes = [[-22, -60, 11], [0, -72, 14], [22, -58, 10], [-34, -40, 7], [34, -40, 8], [-10, -44, 7], [12, -44, 7], [-4, -92, 8], [18, -86, 6], [-24, -82, 6]];
    const lx = c.x - b.x, ly = c.y - b.y;
    eyes.forEach(([ex, ey, r], i) => {
      const blink = Math.sin(b.t * 1.7 + i * 2.1) > 0.97;
      if (b.dead || blink) {
        ctx.strokeStyle = '#050102'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.quadraticCurveTo(ex, ey + r * 0.5, ex + r, ey); ctx.stroke();
        return;
      }
      glow(ex, ey, r * 2.2, av ? 'rgba(255,40,60,0.5)' : 'rgba(255,200,60,0.35)');
      alienEye(ex, ey, r, lx, ly, av ? '#ff2e4d' : '#ffcf3a', fl, true);
    });
    // mandíbulas
    const m = b.mouth * 20 + (b.slam && b.slam.st === 'aim' ? 14 : 0);
    ctx.fillStyle = '#12020a';
    ctx.beginPath(); ctx.ellipse(0, -20, 28, 6 + m * 0.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C('#e8dcc8');
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 26, -26); ctx.rotate(s * (0.2 + m * 0.03));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 14, 16, s * 2, 34); ctx.quadraticCurveTo(s * 4, 16, -s * 4, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#050102'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-18 + k * 7, -22 - m * 0.3); ctx.lineTo(-15 + k * 7, -14 - m * 0.3); ctx.lineTo(-12 + k * 7, -22 - m * 0.3); ctx.fill(); }
    // blindagem de energia
    if (!vis && !b.dead) {
      const a = 0.35 + (b.shield > 0 ? 0.5 : 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(127,232,255,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -40, 120, 160, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(127,232,255,${0.05 + (b.shield > 0 ? 0.12 : 0)})`; ctx.fill();
      ctx.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const a2 = k / 14 * Math.PI * 2 + time * 0.6, hx = Math.cos(a2) * 120, hy = -40 + Math.sin(a2) * 160;
        ctx.beginPath(); for (let j = 0; j < 7; j++) { const aa = j / 6 * Math.PI * 2; ctx.lineTo(hx + Math.cos(aa) * 9, hy + Math.sin(aa) * 9); } ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ desenho: projéteis e partículas */
  function drawBullets() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const b of pbul) {
      const x = b.x - cam.x, y = b.y - cam.y;
      const tx = x - b.vx * 0.03, ty = y - b.vy * 0.03;
      ctx.strokeStyle = 'rgba(255,170,80,0.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(tx + (x - tx) * 0.4, ty + (y - ty) * 0.4); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
    for (const b of ebul) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (b.kind === 'orb') {
        glow(x, y, b.r * 3, 'rgba(255,40,60,0.8)');
        ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff0f0'; ctx.beginPath(); ctx.arc(x, y, b.r * 0.45, 0, 7); ctx.fill();
      } else if (b.kind === 'wave') {
        glow(x, y, 40, world ? 'rgba(255,40,60,0.6)' : 'rgba(255,170,80,0.6)');
        ctx.fillStyle = world ? 'rgba(255,90,100,0.9)' : 'rgba(255,210,150,0.9)';
        ctx.beginPath(); ctx.moveTo(x - 18, y + 16); ctx.quadraticCurveTo(x, y - 34, x + 18, y + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 20, y + 12, 40, 4);
      } else {
        glow(x, y, b.r * 2.5, b.kind === 'spore' ? 'rgba(200,255,90,0.45)' : (world ? 'rgba(255,40,60,0.5)' : 'rgba(140,255,90,0.5)'));
        const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, b.r);
        g.addColorStop(0, '#f0ffc0'); g.addColorStop(0.5, world && b.kind === 'goo' ? '#ff4d4d' : '#9bff4a'); g.addColorStop(1, world && b.kind === 'goo' ? '#5a0010' : '#2f6a10');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
      }
    }
  }
  function drawParticles() {
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      const x = p.x - cam.x, y = p.y - cam.y;
      if (p.kind === 'dot') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        const s = p.size * (0.4 + a * 0.6);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      } else if (p.kind === 'shell') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-3, -1.2, 6, 2.4); ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a;
        ctx.beginPath(); ctx.arc(x, y, p.size * (1.4 - a * 0.9), 0, 7); ctx.stroke();
      } else if (p.kind === 'text') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = `500 ${p.size + 4}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.strokeText(p.text, clamp(x, 160, VW - 160), y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, clamp(x, 160, VW - 160), y);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ HUD */
  function text(str, x, y, size, color, align = 'left', weight = 700, stroke = OL, font = FONT) {
    ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    const mw = ctx.measureText(str).width;
    if (mw > VW - 40) { size = Math.floor(size * (VW - 40) / mw); ctx.font = `${weight} ${size}px ${font}`; }
    if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function panel(x, y, w, h, acc) {
    ctx.fillStyle = 'rgba(6,9,14,0.78)'; bevelRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = acc; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = acc; ctx.fillRect(x + 10, y, 24, 2);
  }
  function drawHUD() {
    const acc = world ? '#ff4d6d' : '#7fe8ff';
    panel(10, 10, 250, 86, acc);
    text('AGENTE VULTO', 22, 24, 12, acc, 'left', 700, null);
    // vida em segmentos
    for (let i = 0; i < P.maxHp; i++) {
      const x = 22 + i * 36, y = 36;
      const on = i < P.hp;
      const col = P.hp <= 2 ? '#ff4d4d' : '#7dff9a';
      ctx.fillStyle = on ? col : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 32, y); ctx.lineTo(x + 27, y + 12); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 5, y + 1, 25, 2); }
    }
    // fragmentos
    for (let i = 0; i < 3; i++) drawShard(30 + i * 26, 72, 7, i < runes, i < runes ? 1 : 0.5);
    text(`FRAGMENTOS ${runes}/3`, 104, 73, 13, '#ffb0b8', 'left', 700, null);
    // gerador de portal
    const ready = P.portalCD <= 0;
    ctx.save(); ctx.translate(232, 70);
    ctx.strokeStyle = world ? '#7fe8ff' : '#ff4d6d'; ctx.lineWidth = 3; ctx.globalAlpha = ready ? 1 : 0.35;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 15, 0, 0, 7); ctx.stroke();
    ctx.restore();
    text('E', 232, 71, 12, '#fff', 'center', 700, null);
    // mundo atual
    ctx.fillStyle = world ? 'rgba(160,20,40,0.85)' : 'rgba(20,70,90,0.85)';
    bevelRect(10, 100, 170, 24, 6); ctx.fill();
    text(world ? 'MUNDO AVESSO' : 'MUNDO NORMAL', 95, 113, 20, '#fff', 'center', 500, null, FONT_D);
    // objetivo
    if (!(boss.active && !boss.dead)) {
      const q = QUESTS[quest]();
      ctx.font = `600 17px ${FONT}`;
      const qw = Math.min(520, ctx.measureText(q).width + 44);
      panel(VW / 2 - qw / 2, 10, qw, 48, acc);
      text('OBJETIVO', VW / 2, 22, 11, acc, 'center', 700, null);
      text(q, VW / 2, 41, 17, '#eef4f8', 'center', 600, null);
    }
    // abates e progresso
    panel(VW - 210, 10, 200, 56, acc);
    text(`ABATES  ${kills}`, VW - 196, 28, 15, '#eef4f8', 'left', 700, null);
    const bx = VW - 196, bw = 160, by = 48;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(bx, by - 2, bw, 4);
    const pr = clamp(P.x / (LW * T), 0, 1);
    ctx.fillStyle = acc; ctx.fillRect(bx, by - 2, bw * pr, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * pr - 2, by - 5, 4, 10);
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.moveTo(bx + bw + 4, by - 6); ctx.lineTo(bx + bw + 12, by); ctx.lineTo(bx + bw + 4, by + 6); ctx.closePath(); ctx.fill();
    if (audio.muted) text('SOM DESLIGADO (M)', VW - 14, 80, 12, '#fff', 'right', 600, OL);
    // barra do chefe
    if (boss.active && !boss.dead) {
      const w = 470, x = VW / 2 - w / 2, y = 44;
      panel(x - 14, 8, w + 28, 62, '#ff4d6d');
      text(BOSS_NAME, x, 26, 26, '#ffd0d0', 'left', 500, null, FONT_D);
      const vis = world === boss.vuln;
      text(vis ? 'CORAÇÃO EXPOSTO · ATIRE!' : 'BLINDADO · VÁ AO ' + worldName(boss.vuln), x + w, 26, 13, vis ? '#7dff9a' : '#7fe8ff', 'right', 700, null);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x, y, w, 12);
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#6a0010'); g.addColorStop(1, '#ff3b3b');
      ctx.fillStyle = g; ctx.fillRect(x, y, Math.max(0, w * boss.hp / boss.maxHp), 12);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 1; k < 10; k++) ctx.fillRect(x + k * w / 10, y, 2, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, Math.max(0, w * boss.hp / boss.maxHp), 2);
      if (boss.phase === 2) { ctx.fillStyle = '#ffcf5a'; ctx.fillRect(x, y + 15, w * clamp(boss.flipT / 6.5, 0, 1), 3); }
    }
    // avisos
    if (bossIntroT <= 0) toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 5, (t.dur - t.t) * 3);
      ctx.globalAlpha = clamp(a, 0, 1);
      text(t.text.toUpperCase(), VW / 2, 158 + i * 36 - (1 - Math.min(1, t.t * 5)) * 10, 32, t.color, 'center', 500, OL, FONT_D);
    });
    ctx.globalAlpha = 1;
    // apresentação do chefe
    if (bossIntroT > 0) {
      const a = Math.min(1, bossIntroT * 2, (3.2 - bossIntroT) * 3);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, 64 * a); ctx.fillRect(0, VH - 64 * a, VW, 64 * a);
      ctx.globalAlpha = a;
      const sx = (3.2 - bossIntroT) * 12;
      text(BOSS_NAME, VW / 2 + sx - 20, VH / 2 + 60, 78, '#ffe0d0', 'center', 600, '#3a0008', FONT_D);
      text('SENHOR DA COLMEIA', VW / 2 - sx + 20, VH / 2 + 110, 22, '#ff5a6e', 'center', 700, OL);
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------ telas */
  function metalText(str, x, y, size, maxW = VW - 40) {
    ctx.font = `600 ${size}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mw = ctx.measureText(str).width;
    if (mw > maxW) { size = Math.floor(size * maxW / mw); ctx.font = `600 ${size}px ${FONT_D}`; }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10; ctx.strokeStyle = '#050608'; ctx.strokeText(str, x, y + 4);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#fff6e0'); g.addColorStop(0.45, '#ffcf7a'); g.addColorStop(0.55, '#c8651f'); g.addColorStop(1, '#6a2a10');
    ctx.fillStyle = g; ctx.fillText(str, x, y);
  }
  function drawTitle() {
    const g = ctx.createLinearGradient(0, 0, VW, 0);
    g.addColorStop(0, 'rgba(4,6,12,0.85)'); g.addColorStop(0.6, 'rgba(4,6,12,0.35)'); g.addColorStop(1, 'rgba(4,6,12,0.1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // agente em destaque
    ctx.save(); ctx.translate(780, 470); ctx.scale(3.4, 3.4);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 1, 26, 5, 0, 0, 7); ctx.fill();
    drawAgent({ face: -1, run: false, ph: 0, onGround: true, vx: 0, aim: { x: -1, y: -0.15 }, recoil: 0, muzzle: 0, wd: NORMAL });
    ctx.restore();
    const wob = Math.sin(time * 1.5) * 2;
    metalText('PORTAL', 250, 108 + wob, 124, 440);
    metalText('DO AVESSO', 250, 200 + wob, 96, 440);
    text('AGENTE VULTO  ·  A INVASÃO MIL-OLHOS', 250, 262, 18, '#ff9a6b', 'center', 700, OL);
    panel(40, 292, 420, 168, '#7fe8ff');
    const rows = [
      ['A D / ← →', 'mover'], ['ESPAÇO / W', 'pular'], ['J / CLIQUE', 'atirar (o mouse mira)'],
      ['SHIFT / K', 'dash'], ['E / BOTÃO DIREITO', 'abrir PORTAL'], ['P  ·  M', 'pausar  ·  som'],
    ];
    rows.forEach(([k, v], i) => {
      text(k, 220, 316 + i * 24, 15, '#7fe8ff', 'right', 700, null);
      text(v, 236, 316 + i * 24, 16, '#e8f1f8', 'left', 600, null);
    });
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
    text('CLIQUE OU APERTE ENTER PARA INICIAR A MISSÃO', 250, 494, 24, '#ffffff', 'center', 500, OL, FONT_D);
    ctx.globalAlpha = 1;
  }
  function drawWin() {
    ctx.fillStyle = 'rgba(4,6,12,0.65)'; ctx.fillRect(0, 0, VW, VH);
    const s = Math.min(1, winT * 2);
    ctx.save(); ctx.translate(VW / 2, 130); ctx.scale(s, s);
    metalText('MISSÃO CUMPRIDA', 0, 0, 96);
    ctx.restore();
    text('O Soberano Mil-Olhos caiu e a colmeia desabou.', VW / 2, 202, 20, '#e8f1f8', 'center', 600, OL);
    const mm = Math.floor(playTime / 60), ss = Math.floor(playTime % 60).toString().padStart(2, '0');
    panel(VW / 2 - 200, 236, 400, 160, '#ffcf7a');
    [['TEMPO', `${mm}:${ss}`], ['ABATES', kills], ['PORTAIS ATRAVESSADOS', portalsUsed], ['QUEDAS', deaths]].forEach(([k, v], i) => {
      text(k, VW / 2 - 170, 266 + i * 34, 17, '#9fb0c0', 'left', 700, null);
      text(String(v), VW / 2 + 170, 266 + i * 34, 30, '#ffcf7a', 'right', 500, null, FONT_D);
    });
    if (winT > 1.5) text('CLIQUE OU APERTE ENTER PARA JOGAR DE NOVO', VW / 2, 450, 26, '#fff', 'center', 500, OL, FONT_D);
  }

  /* ------------------------------------------------------------------ render */
  function render() {
    const k = canvas.width / VW;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.6, rand(-shake, shake) * 0.6);
    if (world === NORMAL || state === 'title') drawBgNormal(); else drawBgAvesso();
    drawTiles();
    if (state !== 'title') {
      drawCheckpoints();
      drawSigns();
      drawSage();
      drawPickups();
      drawEnemies();
      drawBoss();
      drawPortal();
      drawPlayer();
      drawBullets();
      drawParticles();
      drawSignBubbles();
      drawSageBubble();
    }
    ctx.restore();
    // gradação de cor e vinheta
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, world === AVESSO && state !== 'title' ? 'rgba(30,0,6,0.7)' : 'rgba(5,5,20,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    if (switchFx > 0) {
      const c = pcenter();
      ctx.fillStyle = world ? `rgba(255,40,60,${switchFx * 0.4})` : `rgba(200,240,255,${switchFx * 0.5})`;
      ctx.fillRect(0, 0, VW, VH);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = world ? '#ff4d6d' : '#7fe8ff'; ctx.lineWidth = 30 * switchFx;
      ctx.beginPath(); ctx.arc(c.x - cam.x, c.y - cam.y, (1 - switchFx) * 900, 0, 7); ctx.stroke();
      // linhas de distorção
      for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,255,255,${switchFx * 0.15})`; ctx.fillRect(0, rand(0, VH), VW, rand(1, 4)); }
      ctx.restore();
    }
    if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${flashT * 0.8})`; ctx.fillRect(0, 0, VW, VH); }
    if (state === 'play' || state === 'paused') drawHUD();
    if (fade > 0) { ctx.fillStyle = `rgba(4,2,6,${fade})`; ctx.fillRect(0, 0, VW, VH); }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(4,6,12,0.7)'; ctx.fillRect(0, 0, VW, VH);
      metalText('PAUSADO', VW / 2, VH / 2 - 10, 90);
      text('APERTE P PARA CONTINUAR', VW / 2, VH / 2 + 56, 24, '#9fb0c0', 'center', 500, null, FONT_D);
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

  // Atalhos de depuração (?debug): 1-7 teleporta, G modo deus, R +1 fragmento, V troca de mundo.
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
