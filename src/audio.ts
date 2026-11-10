export class Audio {
  ctx: AudioContext | null = null;
  gain: GainNode | null = null;
  muted = false;
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.12;
    this.gain.connect(this.ctx.destination);
    for (const freq of [48, 72.3]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.value = 0.08;
      o.connect(g).connect(this.gain);
      o.start();
    }
  }
  tone(
    freq: number,
    duration = 0.15,
    volume = 0.3,
    type: OscillatorType = "sine",
  ) {
    if (!this.ctx || !this.gain) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * 0.4),
      t + duration,
    );
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.gain);
    o.start();
    o.stop(t + duration);
  }
  shot() {
    this.tone(130, 0.18, 0.65, "sawtooth");
    this.tone(62, 0.22, 0.8, "triangle");
  }
  toggle() {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 0.12;
  }
}
