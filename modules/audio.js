// modules/audio.js
// F4 — Dźwięk silników (Web Audio API, bez assetów)
// Sygnał: sawtooth + square (detune) → lowpass → gain → destination
// Uwaga: AudioContext wymaga interakcji użytkownika (autoplay policy).

export class MotorAudio {
  constructor(opts = {}) {
    this.baseFreq = opts.baseFreq ?? 60;         // Hz przy throttle=0
    this.maxFreq = opts.maxFreq ?? 280;          // Hz przy throttle=1
    this.baseGain = opts.baseGain ?? 0.02;
    this.maxGain = opts.maxGain ?? 0.14;
    this.baseCutoff = opts.baseCutoff ?? 400;
    this.maxCutoff = opts.maxCutoff ?? 2800;

    this.ctx = null;
    this.osc1 = null;
    this.osc2 = null;
    this.noise = null;   // szum — realizm
    this.noiseGain = null;
    this.filter = null;
    this.gain = null;
    this.ready = false;
    this.muted = false;
  }

  /** Wywołaj z handlera kliknięcia (np. Start / Connect) */
  async init() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      console.warn('[audio] Web Audio API niedostępne');
      return;
    }
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) {}
    }

    // Sawtooth — baza
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = this.baseFreq;

    // Square — detune daje „metaliczny" pogłos wielu śmigieł
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.value = this.baseFreq * 1.02;
    this.osc2.detune.value = 8;

    // Szum — biały szum przez bandpass dla „świstu"
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.noise = this.ctx.createBufferSource();
    this.noise.buffer = noiseBuffer;
    this.noise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;
    noiseFilter.Q.value = 0.7;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.0;

    this.noise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);

    // Lowpass — im wyższy throttle, tym jaśniejszy dźwięk
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.baseCutoff;
    this.filter.Q.value = 0.8;

    // Główny gain
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.0;

    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.noiseGain.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    this.osc1.start();
    this.osc2.start();
    this.noise.start();
    this.ready = true;
  }

  /**
   * @param {number} throttle 0..1
   * @param {boolean} armed   czy silniki aktywne (false = cisza)
   * @param {boolean} paused  pauza = cisza
   */
  update(throttle, armed = true, paused = false) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const active = armed && !paused;

    const th = Math.max(0, Math.min(1, throttle));
    const freq = this.baseFreq + th * (this.maxFreq - this.baseFreq);
    const gainTarget = active ? (this.baseGain + th * (this.maxGain - this.baseGain)) : 0;
    const cutoff = this.baseCutoff + th * (this.maxCutoff - this.baseCutoff);
    const noiseTarget = active ? 0.005 + th * 0.035 : 0;

    this.osc1.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq * 1.02, t, 0.05);
    this.gain.gain.setTargetAtTime(gainTarget, t, 0.05);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(noiseTarget, t, 0.05);
  }

  /** Krótki „beep" przy zaliczeniu bramki / starcie */
  beep(freq = 880, duration = 0.12, gain = 0.08) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Krótki „thud" przy kolizji z obręczą */
  thud() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  setMuted(m) {
    this.muted = m;
    if (m && this.gain) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume()  { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}