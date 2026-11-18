// ===== 11_audio.js : 効果音と音楽（すべてその場で合成） =====
const audio = {
  ctx: null, master: null, sfxG: null, musG: null, rev: null, noiseBuf: null, last: {},
  mus: { nextBar: 0, piece: null, bar: 0, restUntil: 0, mel: 4, started: false },
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxG = c.createGain(); this.sfxG.connect(this.master);
      this.musG = c.createGain(); this.musG.connect(this.master);
      const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      // 残響
      const rl = Math.floor(c.sampleRate * 2.4), ib = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const dd = ib.getChannelData(ch); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
      this.rev = c.createConvolver(); this.rev.buffer = ib;
      const rg = c.createGain(); rg.gain.value = 0.42; this.rev.connect(rg); rg.connect(this.musG);
      this.setVolumes();
      this.mus.restUntil = c.currentTime + 3;
    } catch (e) { this.ctx = null; }
  },
  setVolumes() { if (!this.ctx) return; const m = settings.master / 10; this.sfxG.gain.value = settings.sfx / 10 * 0.9 * m; this.musG.gain.value = settings.music / 10 * 0.55 * m; },
  out(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.sfxG;
    const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(this.sfxG); return p;
  },
  noise(t, dur, type, f0, f1, q, vol, dst, attack) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(Math.max(30, f0), t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  },
  tone(t, dur, type, f0, f1, vol, dst, attack, vib) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.02); }
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.02);
  },
  play(name, vol, pan) {
    const c = this.ctx; if (!c || c.state !== 'running' || vol <= 0.01 || settings.sfx <= 0 || settings.master <= 0) return;
    const now = c.currentTime;
    if (this.last[name] && now - this.last[name] < 0.035) return;
    this.last[name] = now;
    const d = this.out(pan), t = now + 0.002, N = (dur, type, f0, f1, q, v, at, dt) => this.noise(t + (dt || 0), dur, type, f0, f1, q, v * vol, d, at), T = (dur, type, f0, f1, v, at, vib, dt) => this.tone(t + (dt || 0), dur, type, f0, f1, v * vol, d, at, vib);
    const r = 0.92 + Math.random() * 0.16;
    const us = name.indexOf('_'), head = us > 0 ? name.slice(0, us) : name, mat = us > 0 ? name.slice(us + 1) : '';
    if (head === 'dig' || head === 'break' || head === 'place' || head === 'step') {
      const k = head === 'break' ? 1.6 : head === 'step' ? 0.5 : 1, L = head === 'break' ? 2.2 : head === 'place' ? 1.3 : 1, p = (head === 'place' ? 0.8 : head === 'break' ? 0.85 : 1) * r;
      switch (mat) {
        case 'wood': T(0.07 * L, 'triangle', 230 * p, 130 * p, 0.5 * k); N(0.05 * L, 'lowpass', 1400 * p, 600, 1, 0.3 * k); break;
        case 'grass': case 'leaf': N(0.08 * L, 'highpass', 2200 * p, 3200, 0.7, 0.22 * k); N(0.06 * L, 'bandpass', 700 * p, 400, 1, 0.2 * k); break;
        case 'dirt': N(0.09 * L, 'lowpass', 800 * p, 300, 0.8, 0.5 * k); break;
        case 'sand': N(0.1 * L, 'bandpass', 3200 * p, 2000, 0.6, 0.3 * k); break;
        case 'gravel': N(0.1 * L, 'bandpass', 1600 * p, 800, 0.8, 0.4 * k); N(0.03, 'highpass', 4000, 4000, 1, 0.15 * k, 0.002, 0.03); break;
        case 'glass': T(0.06 * L, 'sine', 2300 * p, 1900 * p, 0.25 * k); N(0.07 * L, 'highpass', 5200, 6000, 1, 0.25 * k); if (head === 'break') for (let i = 0; i < 5; i++) T(0.12, 'sine', 1800 + Math.random() * 2600, 0, 0.14, 0.002, null, Math.random() * 0.12); break;
        case 'cloth': N(0.08 * L, 'lowpass', 520 * p, 260, 0.8, 0.45 * k); break;
        case 'snow': N(0.08 * L, 'bandpass', 3800 * p, 2600, 0.5, 0.2 * k); break;
        case 'metal': T(0.1 * L, 'square', 880 * p, 860 * p, 0.14 * k); T(0.16 * L, 'sine', 2400 * p, 2380 * p, 0.14 * k); break;
        case 'water': N(0.2, 'bandpass', 900, 400, 1, 0.3 * k); break;
        default: N(0.07 * L, 'bandpass', 950 * p, 520, 1.2, 0.5 * k); T(0.05 * L, 'sine', 170 * p, 90, 0.35 * k);
      }
      return;
    }
    if (head === 'say' || head === 'hurt' || head === 'die') {
      const p = (head === 'hurt' ? 1.25 : head === 'die' ? 0.8 : 1) * r, L = head === 'die' ? 1.6 : head === 'hurt' ? 0.7 : 1, v = head === 'say' ? 0.5 : 0.8;
      switch (mat) {
        case 'sheep': T(0.38 * L, 'sawtooth', 430 * p, 370 * p, 0.16 * v, 0.03, [28, 26]); N(0.3 * L, 'bandpass', 1300, 1100, 2, 0.08 * v, 0.05); break;
        case 'pig': T(0.11 * L, 'square', 170 * p, 120 * p, 0.2 * v); T(0.13 * L, 'square', 190 * p, 110 * p, 0.2 * v, 0.004, null, 0.14 * L); N(0.25 * L, 'lowpass', 500, 300, 1, 0.12 * v); break;
        case 'cow': T(0.7 * L, 'sawtooth', 150 * p, 105 * p, 0.2 * v, 0.08, [6, 5]); N(0.6 * L, 'lowpass', 420, 260, 1, 0.1 * v, 0.1); break;
        case 'chicken': for (let i = 0; i < (head === 'die' ? 4 : 2); i++) T(0.06, 'square', (900 + Math.random() * 300) * p, 700 * p, 0.14 * v, 0.003, null, i * 0.11); break;
        case 'shade': T(0.55 * L, 'sawtooth', 85 * p, 58 * p, 0.3 * v, 0.1, [5, 6]); N(0.5 * L, 'bandpass', 320, 220, 3, 0.25 * v, 0.12); break;
        case 'rock': N(0.3 * L, 'lowpass', 240 * p, 90, 1, 0.8 * v, 0.02); T(0.2 * L, 'sine', 80 * p, 50, 0.4 * v); break;
        case 'wisp': T(0.3 * L, 'sine', 1400 * p, 1900 * p, 0.14 * v, 0.03, [12, 60]); break;
        case 'homurabi': N(0.35 * L, 'bandpass', 900 * p, 2400, 1.2, 0.3 * v, 0.02); T(0.3 * L, 'sawtooth', 240 * p, 420 * p, 0.12 * v, 0.03, [22, 30]); break;
        case 'kurage': T(0.7 * L, 'sine', 620 * p, 380 * p, 0.2 * v, 0.1, [7, 40]); T(0.6 * L, 'sine', 930 * p, 560 * p, 0.08 * v, 0.1, [7, 40]); break;
        case 'bone': for (let i = 0; i < 3; i++) T(0.05, 'square', (260 + i * 70) * p, 180 * p, 0.14 * v, 0.003, null, i * 0.07 * L); N(0.2 * L, 'bandpass', 1500, 900, 2, 0.12 * v); break;
        case 'magma': T(0.22 * L, 'sine', 150 * p, 70, 0.4 * v); N(0.25 * L, 'lowpass', 600 * p, 200, 1, 0.4 * v, 0.01); break;
        case 'hoshi': T(1.3 * L, 'sawtooth', 110 * p, 52 * p, 0.42 * v, 0.2, [3, 7]); T(1.1 * L, 'sine', 330 * p, 160 * p, 0.2 * v, 0.2, [5, 20]); N(1.0 * L, 'bandpass', 500, 180, 1.5, 0.35 * v, 0.25); break;
        case 'dog': T(0.09 * L, 'square', 520 * p, 330 * p, 0.22 * v, 0.004); T(0.11 * L, 'sawtooth', 430 * p, 260 * p, 0.18 * v, 0.004, null, 0.13 * L); break;
        case 'yumi': T(0.25 * L, 'triangle', 520 * p, 390 * p, 0.14 * v, 0.02, [9, 25]); N(0.3 * L, 'highpass', 2600, 1800, 0.8, 0.1 * v, 0.03); break;
        case 'dake': T(0.16 * L, 'sine', 240 * p, 150 * p, 0.3 * v, 0.01); N(0.18 * L, 'lowpass', 700, 300, 1, 0.2 * v, 0.01); break;
        case 'ito': for (let i = 0; i < 4; i++) T(0.035, 'square', (1500 + i * 180) * p, 1200 * p, 0.1 * v, 0.002, null, i * 0.05 * L); break;
        case 'king': T(1.0 * L, 'sawtooth', 62 * p, 44 * p, 0.45 * v, 0.15, [4, 4]); N(0.9 * L, 'lowpass', 260, 120, 1, 0.5 * v, 0.2); break;
      }
      return;
    }
    switch (name) {
      case 'enchant': [523, 659, 784, 1047, 1319].forEach((f, i) => T(0.5, 'sine', f, f * 1.01, 0.14, 0.01, [6, 8], i * 0.07)); N(0.9, 'bandpass', 2500, 6000, 3, 0.12, 0.3); break;
      case 'gulp': T(0.09, 'sine', 300, 180, 0.3); T(0.09, 'sine', 320, 190, 0.3, 0.004, null, 0.16); break;
      case 'potion': T(0.5, 'sine', 660, 990, 0.16, 0.02, [9, 14]); T(0.5, 'sine', 990, 1480, 0.1, 0.05, [9, 14], 0.1); N(0.4, 'highpass', 4000, 7000, 1, 0.08, 0.05); break;
      case 'xp': T(0.1, 'sine', (1100 + Math.random() * 500) * r, 1700 * r, 0.22, 0.003); break;
      case 'levelup': [784, 988, 1175, 1568].forEach((f, i) => T(0.22, 'sine', f, f, 0.22, 0.004, null, i * 0.085)); T(0.5, 'triangle', 392, 392, 0.12, 0.01, null, 0.26); break;
      case 'pop': T(0.07, 'sine', 620 * r, 1250 * r, 0.3); break;
      case 'click': T(0.025, 'square', 760, 700, 0.12); break;
      case 'deny': T(0.09, 'square', 170, 150, 0.16); break;
      case 'craft': T(0.05, 'triangle', 240, 150, 0.4); N(0.04, 'lowpass', 1500, 700, 1, 0.25); T(0.09, 'triangle', 523, 0, 0.22, 0.004, null, 0.07); T(0.09, 'triangle', 659, 0, 0.22, 0.004, null, 0.13); T(0.16, 'triangle', 784, 0, 0.25, 0.004, null, 0.19); break;
      case 'achieve': [523, 659, 784, 1047, 1319].forEach((f, i) => { T(0.5, 'triangle', f, 0, 0.26, 0.005, null, i * 0.09); T(0.6, 'sine', f * 2, 0, 0.1, 0.005, null, i * 0.09); }); T(0.9, 'sine', 1568, 0, 0.14, 0.01, null, 0.5); break;
      case 'treasure': [1319, 1568, 1976, 2637].forEach((f, i) => T(0.35, 'sine', f, 0, 0.18, 0.004, null, i * 0.07)); break;
      case 'dawn': T(1.4, 'sine', 784, 0, 0.16, 0.02); T(1.6, 'sine', 1175, 0, 0.13, 0.02, null, 0.28); T(1.9, 'sine', 1568, 0, 0.1, 0.02, null, 0.56); break;
      case 'sleep': [659, 587, 523, 392].forEach((f, i) => T(0.9, 'sine', f, 0, 0.16, 0.03, null, i * 0.32)); break;
      case 'hurt': T(0.2, 'sawtooth', 310 * r, 140, 0.3); N(0.12, 'bandpass', 700, 300, 1, 0.3); break;
      case 'death': T(1.0, 'sawtooth', 380, 70, 0.3, 0.02); T(1.2, 'sine', 190, 40, 0.3, 0.02); break;
      case 'eat': N(0.07, 'bandpass', 1100 * r, 700, 1.5, 0.5); T(0.04, 'square', 140 * r, 100, 0.1); break;
      case 'burp': T(0.28, 'sawtooth', 120, 68, 0.3, 0.02, [18, 14]); break;
      case 'hit': N(0.08, 'bandpass', 850 * r, 400, 1, 0.6); T(0.07, 'sine', 180, 80, 0.5); break;
      case 'swing': N(0.13, 'bandpass', 1900, 500, 0.7, 0.2, 0.03); break;
      case 'splash': N(0.4, 'bandpass', 1300, 300, 0.8, 0.5, 0.01); N(0.2, 'highpass', 3000, 5000, 0.7, 0.2, 0.01, 0.05); break;
      case 'swim': N(0.3, 'bandpass', 700 * r, 300, 0.8, 0.35, 0.05); break;
      case 'fizz': N(0.5, 'highpass', 3800, 6000, 0.7, 0.3, 0.01); break;
      case 'door': T(0.09, 'triangle', 170, 115, 0.5); N(0.04, 'lowpass', 900, 500, 1, 0.3, 0.002, 0.06); break;
      case 'chest': T(0.14, 'sawtooth', 210 * r, 160, 0.12, 0.03); N(0.1, 'lowpass', 700, 400, 1, 0.3); break;
      case 'ding': T(0.7, 'sine', 1320, 0, 0.22, 0.004); T(0.5, 'sine', 1980, 0, 0.12, 0.004); break;
      case 'toolbreak': T(0.13, 'square', 520, 190, 0.22); N(0.15, 'highpass', 2500, 4000, 0.8, 0.3); break;
      case 'equip': N(0.06, 'bandpass', 2600, 1800, 1, 0.25); T(0.06, 'sine', 700, 760, 0.12); break;
      case 'hop': T(0.1, 'sine', 210 * r, 400 * r, 0.25); break;
      case 'slam': T(0.6, 'sine', 95, 38, 0.9, 0.005); N(0.5, 'lowpass', 320, 80, 1, 0.9, 0.005); break;
      case 'summon': T(0.9, 'sawtooth', 70, 300, 0.25, 0.2, [9, 20]); N(0.9, 'bandpass', 300, 1800, 2, 0.3, 0.3); T(1.4, 'sine', 55, 40, 0.5, 0.05, null, 0.7); break;
      case 'shoot': T(0.22, 'sine', 950 * r, 300, 0.22); N(0.15, 'highpass', 3000, 2000, 1, 0.1); break;
      case 'ignite': N(0.12, 'highpass', 2500, 5000, 1, 0.4); T(0.5, 'sawtooth', 90, 240, 0.2, 0.1, [11, 30], 0.08); N(0.6, 'bandpass', 500, 1500, 1.5, 0.25, 0.15, 0.08); break;
      case 'spark': N(0.06, 'highpass', 3500, 6000, 1, 0.35); T(0.04, 'square', 1800 * r, 900, 0.1); break;
      case 'gatehum': T(3.4, 'sine', 62, 96, 0.3, 1.2, [5, 9]); T(3.4, 'triangle', 124, 190, 0.1, 1.5, [7, 14]); N(3.2, 'bandpass', 300, 1400, 3, 0.12, 1.6); break;
      case 'warp': T(1.1, 'sine', 180, 1300, 0.22, 0.4); T(1.3, 'triangle', 90, 660, 0.16, 0.5); N(1.2, 'bandpass', 400, 4200, 2, 0.3, 0.6); T(0.9, 'sine', 1568, 0, 0.12, 0.01, null, 1.0); break;
      case 'boom': T(0.5, 'sine', 120, 34, 0.9, 0.004); N(0.7, 'lowpass', 900, 90, 0.8, 0.9, 0.004); N(0.25, 'highpass', 2200, 800, 0.7, 0.25, 0.003); break;
      case 'crystal': [2093, 1568, 2637, 1319, 3136].forEach((f, i) => T(0.5, 'sine', f * r, 0, 0.16, 0.003, null, i * 0.045)); N(0.4, 'highpass', 4000, 7000, 1, 0.3); break;
      case 'breath': N(2.4, 'bandpass', 500, 1700, 1.2, 0.5, 0.5); T(2.4, 'sawtooth', 70, 110, 0.2, 0.6, [6, 10]); break;
      case 'roar': T(1.6, 'sawtooth', 130, 48, 0.5, 0.15, [4, 9]); T(1.5, 'sine', 390, 140, 0.22, 0.2, [6, 25]); N(1.4, 'bandpass', 700, 200, 1.2, 0.5, 0.2); break;
      case 'bowdraw': T(0.5, 'sawtooth', 90, 150, 0.12, 0.2, [14, 18]); N(0.4, 'bandpass', 900, 1500, 3, 0.08, 0.2); break;
      case 'bowshot': T(0.22, 'triangle', 300 * r, 150, 0.4, 0.003, [30, 40]); N(0.12, 'highpass', 2500, 1200, 1, 0.25, 0.002); break;
      case 'arrowhit': T(0.08, 'triangle', 210 * r, 110, 0.5); N(0.05, 'lowpass', 1600, 600, 1, 0.4); T(0.25, 'sine', 95, 80, 0.15, 0.01, [40, 12], 0.03); break;
      case 'arrowding': T(0.14, 'sine', 1250, 1250, 0.2, 0.003); T(0.2, 'sine', 1880, 1880, 0.1, 0.003, null, 0.04); break;
      case 'shieldhit': T(0.12, 'square', 420 * r, 380, 0.2); T(0.3, 'sine', 1700 * r, 1650, 0.14, 0.003); N(0.08, 'bandpass', 1200, 700, 1, 0.5); break;
      case 'fuse': N(1.5, 'highpass', 3000, 7000, 0.8, 0.3, 0.05); T(1.4, 'sawtooth', 180, 520, 0.05, 0.3); break;
      case 'spit': N(0.12, 'bandpass', 1800 * r, 3200, 2, 0.35, 0.01); T(0.1, 'sine', 700, 1100, 0.1); break;
      case 'web': N(0.3, 'bandpass', 2400, 900, 2, 0.3, 0.02); T(0.25, 'sine', 900, 400, 0.1, 0.02); break;
      case 'shear': N(0.07, 'highpass', 2800, 5200, 1, 0.4); N(0.07, 'highpass', 3200, 5600, 1, 0.35, 0.004, 0.11); break;
      case 'victory': [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { T(0.8, 'triangle', f, 0, 0.26, 0.005, null, i * 0.13); T(1.0, 'sine', f * 2, 0, 0.09, 0.005, null, i * 0.13); }); break;
    }
  },

  // ---- 音楽：ゆったりしたピアノ風の曲をその場で組み立てる ----
  piano(midi, t, vel, len) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
    const dur = Math.min(6, (len || 2.2) * (midi < 55 ? 1.5 : midi > 76 ? 0.75 : 1));
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900 + vel * 4200, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(vel * 0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mk = (type, mul, det, lv) => { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mul; o.detune.value = det; og.gain.value = lv; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); };
    mk('triangle', 1, -4, 0.8); mk('sine', 1, 5, 0.5); mk('sine', 2, 2, 0.16); mk('sine', 3, 0, 0.05);
    lp.connect(g); g.connect(this.musG); g.connect(this.rev);
  },
  tickMusic(night) {
    const c = this.ctx; if (!c || c.state !== 'running' || settings.music <= 0 || settings.master <= 0) return;
    const m = this.mus, now = c.currentTime;
    if (!m.piece) {
      if (now < m.restUntil) return;
      const pool = night ? [2, 3] : [0, 1, 4];
      m.piece = PIECES[pool[Math.floor(Math.random() * pool.length)]]; m.bar = 0; m.nextBar = now + 0.3; m.mel = 3 + Math.floor(Math.random() * 3); m.total = m.piece.ch.length * (2 + Math.floor(Math.random() * 2));
    }
    while (m.piece && m.nextBar < now + 0.5) {
      const P = m.piece, beat = 60 / P.bpm, t0 = m.nextBar, ch = P.ch[m.bar % P.ch.length], sc = P.scale, last = m.bar >= m.total;
      const hum = () => (Math.random() - 0.5) * 0.02;
      if (last) {
        [ch[0] - 12, ch[0], ch[1], ch[2], ch[3]].forEach((n, i) => this.piano(n, t0 + i * 0.09, 0.4, 5));
        m.piece = null; m.restUntil = now + 35 + Math.random() * 60; break;
      }
      // 左手：和音をほどいて弾く
      const pat = P.left[m.bar % P.left.length];
      for (let i = 0; i < pat.length; i++) { const k = pat[i]; if (k < 0 || (i > 0 && Math.random() < 0.12)) continue; this.piano(ch[k % ch.length] - 12 + (k >= ch.length ? 12 : 0), t0 + i * beat * (P.beats / pat.length) + hum(), 0.3 + Math.random() * 0.12, beat * 3); }
      // 右手：音階を歩くメロディ
      const steps = P.beats * 2;
      for (let i = 0; i < steps; i++) {
        const strong = i % 4 === 0, pr = strong ? 0.62 : (i % 2 === 0 ? 0.42 : 0.2);
        if (Math.random() > pr * P.dens) continue;
        m.mel = clamp(m.mel + Math.floor(Math.random() * 5) - 2, 0, sc.length * 2 - 1);
        let note = sc[m.mel % sc.length] + 12 * Math.floor(m.mel / sc.length) + P.melBase;
        if (strong) { let best = note, bd = 99; for (const cn of ch) for (const o of [0, 12, 24]) { const cand = cn + o; const dd = Math.abs(cand - note); if (dd < bd) { bd = dd; best = cand; } } if (bd <= 2) note = best; }
        this.piano(note, t0 + i * beat / 2 + hum(), 0.34 + Math.random() * 0.2 + (strong ? 0.08 : 0), beat * (strong ? 3 : 2));
        if (strong && Math.random() < 0.25) this.piano(note - (Math.random() < 0.5 ? 3 : 4) - 5, t0 + i * beat / 2 + 0.02, 0.22, beat * 2);
      }
      m.bar++; m.nextBar += beat * P.beats;
    }
  }
};
// 曲の材料（和音は低い方から。数字は音の高さ）
const PIECES = [
  { bpm: 64, beats: 4, dens: 0.9, melBase: 62, scale: [0, 2, 4, 7, 9], ch: [[50, 57, 61, 64, 66], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 55, 59, 64]], left: [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 4], [0, 1, 2, -1]] },
  { bpm: 58, beats: 4, dens: 0.75, melBase: 60, scale: [0, 2, 4, 7, 9], ch: [[41, 48, 52, 57, 59], [43, 50, 53, 57, 60], [40, 47, 50, 55, 59], [45, 52, 55, 59, 60]], left: [[0, -1, 1, 2], [0, 1, 2, 3], [0, -1, 2, 1], [0, 1, 3, -1]] },
  { bpm: 52, beats: 4, dens: 0.6, melBase: 57, scale: [0, 3, 5, 7, 10], ch: [[45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [38, 45, 50, 53, 57], [40, 47, 50, 52, 57]], left: [[0, 1, 2, -1], [0, -1, 2, 3], [0, 1, 3, -1], [0, 2, 1, -1]] },
  { bpm: 48, beats: 4, dens: 0.5, melBase: 62, scale: [0, 2, 3, 7, 9], ch: [[38, 45, 50, 53, 57], [43, 50, 53, 57, 62], [36, 43, 48, 52, 55], [45, 52, 55, 60, 62]], left: [[0, -1, 1, -1], [0, 2, -1, 1], [0, -1, 1, 2], [0, 1, -1, -1]] },
  { bpm: 92, beats: 3, dens: 0.8, melBase: 67, scale: [0, 2, 4, 7, 9], ch: [[43, 50, 55, 59, 62], [40, 47, 52, 55, 59], [36, 43, 48, 52, 55], [38, 45, 50, 54, 57]], left: [[0, 2, 3], [0, 1, 2], [0, 2, 1], [0, 3, 2]] }
];
function sfx(name, vol) { audio.play(name, vol === undefined ? 1 : vol, 0); }
function sfxAt(name, x, y, z) {
  if (!audio.ctx) return;
  const dx = x + 0.5 - player.x, dy = y - player.y, dz = z + 0.5 - player.z, d = Math.hypot(dx, dy, dz);
  if (d > 26) return;
  const v = Math.pow(1 - d / 26, 1.6), pan = d > 0.5 ? (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / d * 0.8 : 0;
  audio.play(name, v, pan);
}
