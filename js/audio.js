'use strict';
/* ==========================================================================
   Áudio sintetizado (Web Audio): golpes, defesa, poderes e vozes curtas.
   Nenhum arquivo externo; tudo gerado na hora.
   ========================================================================== */
const Audio2 = {
  ac: null, master: null, noiseBuf: null, muted: false,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = .5; this.master.connect(this.ac.destination);
    const len = this.ac.sampleRate; this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  tone(freq, dur, type = 'sine', vol = .3, slide = 0, delay = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol = .3, freq = 1200, q = 1, type = 'bandpass', delay = 0, sweep = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  },
  play(name) {
    switch (name) {
      case 'whoosh': this.noise(.12, .12, 900, 1.2, 'bandpass', 0, 3); break;
      case 'swordWhoosh': this.noise(.16, .16, 2400, 2, 'bandpass', 0, .4); this.tone(1800, .08, 'sine', .03, .5); break;
      case 'hitL': this.noise(.08, .35, 1800, .8); this.tone(180, .08, 'square', .12, .5); break;
      case 'hitH': this.noise(.18, .5, 900, .7); this.tone(110, .2, 'sawtooth', .22, .35); this.noise(.3, .2, 200, .7, 'lowpass'); break;
      case 'slash': this.noise(.14, .4, 3200, 1.5, 'highpass'); this.tone(900, .12, 'triangle', .1, .3); break;
      case 'block': this.tone(900, .06, 'square', .08, .8); this.noise(.05, .25, 3000, 3); break;
      case 'fire': this.noise(.5, .3, 500, .6, 'lowpass', 0, 3); this.tone(140, .35, 'sawtooth', .08, 2); break;
      case 'wind': this.noise(.45, .28, 1400, 2.5, 'bandpass', 0, 2.5); break;
      case 'jump': this.noise(.08, .08, 700, 1); break;
      case 'land': this.noise(.07, .12, 300, 1, 'lowpass'); break;
      case 'dash': this.noise(.18, .15, 1500, 1, 'bandpass', 0, .3); break;
      case 'super': this.tone(220, .9, 'sawtooth', .15, 3); this.tone(330, .9, 'triangle', .12, 3); this.noise(.9, .2, 400, 1, 'bandpass', 0, 8); break;
      case 'ko': this.tone(90, 1.2, 'sawtooth', .3, .3); this.noise(1.2, .4, 300, .6, 'lowpass'); break;
      case 'select': this.tone(660, .06, 'square', .08, 1.5); break;
      case 'confirm': this.tone(520, .09, 'square', .1, 1.5); this.tone(780, .12, 'square', .1, 1.5, .07); break;
      case 'round': this.tone(392, .15, 'square', .12); this.tone(523, .25, 'square', .12, 1, .12); break;
      case 'fight': this.tone(523, .12, 'square', .14); this.tone(659, .12, 'square', .14, 1, .1); this.tone(784, .35, 'square', .14, 1, .2); break;
    }
  },
  // "Voz" estilizada: uma sílaba sintética aguda (feminina) ou grave (masculina)
  voice(fem, strong = false) {
    const f = fem ? rand(420, 520) : rand(170, 220);
    this.tone(f, strong ? .22 : .12, 'triangle', strong ? .12 : .07, .75);
    this.noise(strong ? .18 : .1, .05, fem ? 2400 : 1200, 4);
  }
};
