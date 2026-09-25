'use strict';
/* ==========================================================================
   Entrada: teclado + controles (gamepad). Cada jogador tem um mapa de botões
   lógicos (left, right, up, down, light, heavy, special, dash) para códigos.
   Controles aparecem como códigos virtuais "PadN:botão".
   ========================================================================== */
const CONTROLS = [
  { left: ['KeyA', 'Pad0:left'], right: ['KeyD', 'Pad0:right'], up: ['KeyW', 'Pad0:up'], down: ['KeyS', 'Pad0:down'],
    light: ['KeyG', 'Pad0:x'], heavy: ['KeyH', 'Pad0:y'], special: ['KeyT', 'Pad0:b'], dash: ['KeyY', 'Pad0:a', 'Pad0:rb'] },
  { left: ['ArrowLeft', 'Pad1:left'], right: ['ArrowRight', 'Pad1:right'], up: ['ArrowUp', 'Pad1:up'], down: ['ArrowDown', 'Pad1:down'],
    light: ['KeyL', 'Numpad1', 'Pad1:x'], heavy: ['KeyK', 'Numpad2', 'Pad1:y'], special: ['KeyO', 'Numpad3', 'Pad1:b'], dash: ['KeyI', 'Numpad0', 'Pad1:a', 'Pad1:rb'] }
];
const MENU_KEYS = {
  up: ['KeyW', 'ArrowUp', 'Pad0:up', 'Pad1:up'], down: ['KeyS', 'ArrowDown', 'Pad0:down', 'Pad1:down'],
  left: ['KeyA', 'ArrowLeft', 'Pad0:left', 'Pad1:left'], right: ['KeyD', 'ArrowRight', 'Pad0:right', 'Pad1:right'],
  ok: ['Enter', 'Space', 'KeyG', 'KeyL', 'Pad0:a', 'Pad1:a'], back: ['Escape', 'Backspace', 'Pad0:b', 'Pad1:b'],
  pause: ['Escape', 'KeyP', 'Pad0:start', 'Pad1:start']
};
const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);

const Input = {
  down: new Set(), pressed: new Set(), padPrev: new Set(),
  init() {
    addEventListener('keydown', e => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code); Audio2.unlock();
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('pointerdown', () => Audio2.unlock());
  },
  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set();
    for (let i = 0; i < Math.min(2, pads.length); i++) {
      const p = pads[i]; if (!p) continue;
      const b = k => p.buttons[k] && p.buttons[k].pressed, ax = p.axes || [];
      const map = { a: b(0), b: b(1), x: b(2), y: b(3), rb: b(5) || b(7), start: b(9),
        up: b(12) || ax[1] < -.5, down: b(13) || ax[1] > .5, left: b(14) || ax[0] < -.5, right: b(15) || ax[0] > .5 };
      for (const k in map) if (map[k]) now.add(`Pad${i}:${k}`);
    }
    for (const c of this.padPrev) if (!now.has(c)) this.down.delete(c);
    for (const c of now) { if (!this.padPrev.has(c)) this.pressed.add(c); this.down.add(c); }
    this.padPrev = now;
  },
  isDown(codes) { return codes.some(c => this.down.has(c)); },
  hit(codes) { return codes.some(c => this.pressed.has(c)); },
  menu(k) { return this.hit(MENU_KEYS[k]); },
  endFrame() { this.pressed.clear(); }
};

/* Controle humano: lê o mapa do jogador */
class HumanCtrl {
  constructor(i) { this.map = CONTROLS[i]; this.cpu = false; }
  update() {}
  held(b) { return Input.isDown(this.map[b]); }
  pressed(b) { return Input.hit(this.map[b]); }
}
