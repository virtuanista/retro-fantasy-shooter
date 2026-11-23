/* Audio procedural (WebAudio): música chiptune generada a partir de semillas
 * (composiciones originales) y efectos de sonido sintetizados.
 * En entornos sin AudioContext (pruebas en Node) todo es no-op. */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10]
  };
  const PROGS = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 2, 3, 4]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /** Genera una canción (patrones por pasos de semicorchea). */
  function compose(spec) {
    const r = RFS.util.rng(spec.seed * 7919 + 13);
    const sc = SCALES[spec.scale] || SCALES.major;
    const prog = spec.boss ? r.pick([[0, 5, 6, 4], [0, 1, 0, 6], [0, 3, 1, 4]]) : r.pick(PROGS);
    const progB = r.pick(PROGS);
    const deg = (d, oct) => { const o = Math.floor(d / 7); const i = ((d % 7) + 7) % 7; return spec.root + sc[i] + 12 * (o + (oct || 0)); };
    const steps = 128; // 8 compases de 16 semicorcheas
    const lead = new Array(steps).fill(null), bass = new Array(steps).fill(null), arp = new Array(steps).fill(null), drum = new Array(steps).fill(null);
    // motivo rítmico de 2 compases repetido con variaciones
    let cur = 7 + r.int(0, 4);
    const motif = [];
    for (let s = 0; s < 32; s++) {
      const strong = s % 4 === 0;
      const p = strong ? 0.85 : (s % 2 === 0 ? 0.45 : 0.22);
      if (r() < p) {
        const leap = r() < 0.7 ? r.int(-2, 2) : r.int(-4, 4);
        cur = Math.max(3, Math.min(13, cur + leap));
        motif.push({ s, d: cur, len: r.pick([1, 2, 2, 3, 4]) });
      }
    }
    for (let bar = 0; bar < 8; bar++) {
      const chord = (bar < 4 ? prog : progB)[bar % 4];
      // bajo
      for (let i = 0; i < 16; i++) {
        const s = bar * 16 + i;
        if (spec.boss) { if (i % 2 === 0) bass[s] = { m: deg(chord, -2) + (i % 4 === 2 ? 12 : 0), len: 1 }; }
        else if (i % 4 === 0 || (i % 4 === 2 && r() < 0.6)) bass[s] = { m: deg(chord, -2) + (i % 8 === 4 ? 12 : 0), len: 2 };
        // arpegio
        if (!spec.soft || i % 2 === 0) {
          const tones = [0, 2, 4, 7];
          if (i % 2 === 0) arp[s] = { m: deg(chord + tones[(i / 2) % 4], 0), len: 1 };
        }
        // batería
        let d = null;
        if (i % 8 === 0) d = 'k'; else if (i % 8 === 4) d = 's'; else if (i % 2 === 0 || spec.boss) d = 'h';
        if (spec.soft && d === 's') d = 'h';
        drum[s] = d;
      }
    }
    // melodía: compases 0-3 motivo, 4-7 variación transpuesta
    for (let rep = 0; rep < 4; rep++) {
      const off = rep * 32;
      const shift = rep === 1 ? 0 : rep === 2 ? 2 : rep === 3 ? (r() < 0.5 ? -1 : 4) : 0;
      for (const n of motif) {
        if (rep === 3 && n.s >= 24) continue; // cadencia
        lead[off + n.s] = { m: deg(n.d + shift, 0), len: n.len };
      }
    }
    lead[120] = { m: deg(7, 0), len: 6 };
    return { tempo: spec.tempo, steps, lead, bass, arp, drum, soft: !!spec.soft, boss: !!spec.boss };
  }

  const A = RFS.Audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    musicVol: 0.55, sfxVol: 0.7, song: null, songKey: null, step: 0, nextTime: 0, timer: null, noise: null, songs: {},
    unlock() {
      if (this.ctx || typeof root.AudioContext === 'undefined' && typeof root.webkitAudioContext === 'undefined') {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = root.AudioContext || root.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.setVolumes(this.musicVol, this.sfxVol);
      const len = this.ctx.sampleRate * 1;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const real = new Float32Array(32), imag = new Float32Array(32);
      for (let n = 1; n < 32; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
      this.pulse25 = this.ctx.createPeriodicWave(real, imag);
      this.timer = setInterval(() => this.schedule(), 25);
      if (this.pendingSong) { const k = this.pendingSong; this.pendingSong = null; this.playMusic(k.key, k.spec); }
    },
    setVolumes(m, s) {
      this.musicVol = m; this.sfxVol = s;
      if (this.musicGain) { this.musicGain.gain.value = m * 0.32; this.sfxGain.gain.value = s * 0.5; }
    },
    playMusic(key, spec) {
      if (this.songKey === key && this.song) return;
      if (!this.ctx) { this.pendingSong = { key, spec }; this.songKey = null; return; }
      this.songKey = key;
      if (!spec) { this.song = null; return; }
      this.song = this.songs[key] || (this.songs[key] = compose(spec));
      this.step = 0; this.nextTime = this.ctx.currentTime + 0.06;
    },
    stopMusic() { this.song = null; this.songKey = null; this.pendingSong = null; },
    schedule() {
      if (!this.ctx || !this.song) return;
      const song = this.song, dt = 60 / song.tempo / 4;
      // si el temporizador se retrasó (pestaña en segundo plano, pausa larga del
      // hilo), se saltan los pasos perdidos en vez de tocarlos todos de golpe
      if (this.nextTime < this.ctx.currentTime) { const miss = Math.ceil((this.ctx.currentTime - this.nextTime) / dt); this.step += miss; this.nextTime += miss * dt; }
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        const s = this.step % song.steps, t = this.nextTime;
        const L = song.lead[s], B = song.bass[s], R = song.arp[s], D = song.drum[s];
        if (L) this.tone(this.pulse25, mtof(L.m), t, dt * L.len * 0.95, 0.20, this.musicGain, true);
        if (B) this.tone('triangle', mtof(B.m), t, dt * B.len * 0.9, 0.42, this.musicGain);
        if (R) this.tone('square', mtof(R.m + 12), t, dt * 0.6, song.soft ? 0.05 : 0.06, this.musicGain);
        if (D) this.drum(D, t);
        this.nextTime += dt; this.step++;
      }
    },
    tone(type, f, t, dur, vol, dest, vib) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      o.frequency.setValueAtTime(f, t);
      if (vib && dur > 0.2) { o.frequency.setValueAtTime(f, t + 0.12); o.frequency.linearRampToValueAtTime(f * 1.012, t + dur); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.03)); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    noiseHit(t, dur, vol, freq, dest, type) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; f.type = type || 'highpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur);
    },
    drum(d, t) {
      if (d === 'h') this.noiseHit(t, 0.04, 0.10, 7000, this.musicGain);
      else if (d === 's') this.noiseHit(t, 0.12, 0.22, 1800, this.musicGain, 'bandpass');
      else if (d === 'k') {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.15);
      }
    },
    sweep(type, f0, f1, dur, vol, t0) {
      const c = this.ctx, t = t0 || c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    _last: {},
    sfx(name) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      if (this._last[name] && t - this._last[name] < 0.03) return; // evita saturación
      this._last[name] = t;
      switch (name) {
        case 'shot': this.sweep('square', 1400, 500, 0.06, 0.10); break;
        case 'laser': this.sweep('sawtooth', 2200, 900, 0.07, 0.07); break;
        case 'bomb': this.sweep('triangle', 600, 120, 0.25, 0.3); break;
        case 'missile': this.noiseHit(t, 0.25, 0.2, 900, null, 'bandpass'); break;
        case 'hit': this.sweep('square', 300, 200, 0.04, 0.08); break;
        case 'tink': this.tone('square', 2400, t, 0.03, 0.06); break;
        case 'explode': this.noiseHit(t, 0.3, 0.45, 300, null, 'lowpass'); this.sweep('square', 200, 40, 0.25, 0.15); break;
        case 'bigexplode': this.noiseHit(t, 0.9, 0.7, 500, null, 'lowpass'); this.sweep('sawtooth', 160, 30, 0.8, 0.25); break;
        case 'coin': this.tone('square', 1318, t, 0.05, 0.12); this.tone('square', 1760, t + 0.05, 0.09, 0.12); break;
        case 'bigcoin': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone('square', f, t + i * 0.045, 0.06, 0.12)); break;
        case 'shop': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone('triangle', f, t + i * 0.07, 0.08, 0.3)); break;
        case 'buy': [784, 1046, 1568].forEach((f, i) => this.tone('square', f, t + i * 0.06, 0.07, 0.14)); break;
        case 'error': this.tone('square', 140, t, 0.18, 0.2); break;
        case 'cursor': this.tone('square', 880, t, 0.025, 0.08); break;
        case 'death': this.sweep('square', 900, 60, 0.9, 0.25); this.noiseHit(t, 0.6, 0.4, 400, null, 'lowpass'); break;
        case 'warning': for (let i = 0; i < 4; i++) { this.tone('sawtooth', 440, t + i * 0.35, 0.16, 0.18); this.tone('sawtooth', 330, t + i * 0.35 + 0.17, 0.16, 0.18); } break;
        case 'power': [523, 784, 1046, 1318, 1568].forEach((f, i) => this.tone('square', f, t + i * 0.04, 0.05, 0.12)); break;
        case 'flash': this.noiseHit(t, 0.8, 0.5, 2000); this.sweep('sawtooth', 80, 1600, 0.5, 0.2); break;
        case 'shieldhit': this.sweep('triangle', 1500, 300, 0.2, 0.3); break;
        case 'enemyshot': this.sweep('triangle', 900, 600, 0.05, 0.06); break;
        case 'clear': [523, 659, 784, 1046, 0, 784, 1046].forEach((f, i) => f && this.tone('square', f, t + i * 0.12, 0.11, 0.15)); break;
        case 'gameover': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, t + i * 0.3, 0.28, 0.35)); break;
        case 'pause': this.tone('square', 660, t, 0.06, 0.1); this.tone('square', 990, t + 0.07, 0.06, 0.1); break;
        case 'transition': this.sweep('triangle', 200, 1600, 0.6, 0.25); break;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
