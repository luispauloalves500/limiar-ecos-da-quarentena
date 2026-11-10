import { soundPlan, type Bus, type SoundKind } from "./sound-design";
import { defaults, type Preferences } from "./controls";
import { themes } from "./environment-logic";
import type { RoomId, Vec } from "./world";
export class Audio {
  ctx: AudioContext | null = null;
  levels = {
    master: defaults.master,
    music: defaults.music,
    effects: defaults.effects,
    voices: defaults.voices,
  };
  buses = {} as Record<Bus, GainNode>;
  musicGain: GainNode | undefined;
  tension = 0;
  pulse = 0;
  creatureClock = 0;
  configure(p: Pick<Preferences, "master" | "music" | "effects" | "voices">) {
    this.levels = { ...p };
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 0.12 * p.master;
    for (const b of ["music", "effects", "voices"] as const)
      if (this.buses[b]) this.buses[b].gain.value = p[b];
  }
  gain: GainNode | null = null;
  muted = false;
  room: RoomId | undefined;
  roomGain: GainNode | undefined;
  reverb: ConvolverNode | undefined;
  roomNodes: AudioNode[] = [];
  sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  noise: AudioBuffer | undefined;
  drip = 0;
  spatialDiagnostics = { room: "", reverbSeconds: 0, sources: 0, events: 0 };
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.12 * this.levels.master;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 4;
    this.gain.connect(limiter).connect(this.ctx.destination);
    for (const b of ["music", "effects", "voices"] as const) {
      const g = this.ctx.createGain();
      g.gain.value = this.levels[b];
      g.connect(this.gain);
      this.buses[b] = g;
    }
  }
  tone(
    freq: number,
    duration = 0.15,
    volume = 0.3,
    type: OscillatorType = "sine",
    position?: Vec,
    bus: Bus = "effects",
    delay = 0,
  ) {
    if (!this.ctx || !this.gain) return;
    const t = this.ctx.currentTime + delay;
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
    o.connect(g);
    if (position) {
      const pan = this.ctx.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 2;
      pan.maxDistance = 22;
      pan.rolloffFactor = 1;
      pan.positionX.value = position.x;
      pan.positionY.value = 1.4;
      pan.positionZ.value = position.z;
      g.connect(pan).connect(this.buses[bus]);
      if (this.reverb && bus === "effects") pan.connect(this.reverb);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        pan.disconnect();
      };
    } else {
      g.connect(this.buses[bus]);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
    o.start(t);
    o.stop(t + duration);
  }
  noiseBuffer() {
    if (this.noise || !this.ctx) return this.noise;
    const b = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * 2,
      this.ctx.sampleRate,
    );
    const data = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + Math.random() * 0.2 - 0.1) * 0.97;
      data[i] = last;
    }
    this.noise = b;
    return b;
  }
  enter(room: RoomId) {
    if (!this.ctx || !this.gain) return;
    this.sources.forEach((s) => {
      s.stop();
      s.disconnect();
    });
    this.sources = [];
    this.roomNodes.forEach((n) => n.disconnect());
    this.roomNodes = [];
    this.room = room;
    this.roomGain = this.ctx.createGain();
    this.roomGain.gain.value = 0.35;
    this.roomGain.connect(this.buses.effects);
    this.roomNodes.push(this.roomGain);
    const reverb = this.ctx.createConvolver(),
      seconds =
        room === "atrio"
          ? 1.6
          : room === "escadaria"
            ? 1.3
            : room === "segura" || room === "posto"
              ? 0.4
              : 0.75;
    const ir = this.ctx.createBuffer(
      2,
      Math.floor(this.ctx.sampleRate * seconds),
      this.ctx.sampleRate,
    );
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c);
      for (let i = 0; i < data.length; i++)
        data[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.2;
    }
    reverb.buffer = ir;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;
    reverb.connect(wet).connect(this.roomGain);
    this.reverb = reverb;
    this.roomNodes.push(reverb, wet);
    for (let i = 0; i < 3; i++) {
      const src =
        i === 0 ? this.ctx.createOscillator() : this.ctx.createBufferSource();
      if (src instanceof OscillatorNode) {
        src.frequency.value = themes[room].surface === "metal" ? 59 : 48;
        src.type = "triangle";
      } else {
        src.buffer = this.noiseBuffer()!;
        src.loop = true;
      }
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = i === 2 ? 430 : 170;
      const volume = this.ctx.createGain();
      volume.gain.value = i === 0 ? 0.045 : i === 1 ? 0.065 : 0.035;
      const pan = this.ctx.createPanner();
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 2;
      pan.maxDistance = 20;
      pan.rolloffFactor = 1;
      pan.positionX.value = i === 1 ? 5 : -4;
      pan.positionY.value = 2.5;
      pan.positionZ.value = i === 2 ? 4 : -5;
      src.connect(filter).connect(volume).connect(pan);
      pan.connect(this.roomGain);
      pan.connect(reverb);
      src.start();
      this.sources.push(src);
      this.roomNodes.push(filter, volume, pan);
    }
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.025;
    this.musicGain.connect(this.buses.music);
    this.roomNodes.push(this.musicGain);
    const safe = room === "segura" || room === "posto";
    for (const freq of safe ? [110, 164.81, 220] : [48, 50.1, 72]) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(this.musicGain);
      o.start();
      this.sources.push(o);
    }
    this.drip = 1.5;
    this.spatialDiagnostics = {
      room,
      reverbSeconds: seconds,
      sources: 6,
      events: this.spatialDiagnostics.events,
    };
  }
  update(
    room: RoomId,
    p: Vec,
    yaw: number,
    dt: number,
    active: boolean,
    danger = 0,
    hp = 100,
    title = false,
  ) {
    if (!this.ctx) return;
    if (this.room !== room) this.enter(room);
    const l = this.ctx.listener;
    l.positionX.value = p.x;
    l.positionY.value = 1.6;
    l.positionZ.value = p.z;
    l.forwardX.value = Math.sin(yaw);
    l.forwardY.value = 0;
    l.forwardZ.value = Math.cos(yaw);
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
    this.roomGain?.gain.setTargetAtTime(
      active ? 0.35 : 0,
      this.ctx.currentTime,
      0.2,
    );
    this.tension += (danger - this.tension) * Math.min(1, dt * 2);
    const safe = room === "segura" || room === "posto";
    this.musicGain?.gain.setTargetAtTime(
      title ? 0.04 : active ? (safe ? 0.025 : 0.014 + this.tension * 0.045) : 0,
      this.ctx.currentTime,
      0.5,
    );
    this.pulse -= dt;
    if (active && hp <= 30 && this.pulse <= 0) {
      this.pulse = 1.4;
      this.play("breath");
      this.tone(42, 0.15, 0.17, "sine", undefined, "voices");
      this.tone(39, 0.13, 0.12, "sine", undefined, "voices", 0.2);
    }
    if (active) {
      this.drip -= dt;
      if (this.drip <= 0) {
        this.drip = 2.8;
        this.tone(1300, 0.07, 0.08, "sine", { x: 4.9, z: -2.4 });
      }
    }
  }
  step(room: RoomId, p: Vec) {
    this.play("step", p, themes[room].surface === "metal");
    if (themes[room].surface === "wet") this.burst(750, 0.12, 0.08, p);
  }
  burst(
    freq: number,
    duration: number,
    volume: number,
    position?: Vec,
    bus: Bus = "effects",
    delay = 0,
  ) {
    if (!this.ctx || !this.gain) return;
    const src = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain();
    src.buffer = this.noiseBuffer()!;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const t = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g);
    const pan = position ? this.ctx.createPanner() : undefined;
    if (pan && position) {
      pan.panningModel = "HRTF";
      pan.distanceModel = "inverse";
      pan.refDistance = 2;
      pan.maxDistance = 22;
      pan.positionX.value = position.x;
      pan.positionY.value = 1.3;
      pan.positionZ.value = position.z;
      g.connect(pan).connect(this.buses[bus]);
      if (this.reverb && bus === "effects") pan.connect(this.reverb);
    } else {
      g.connect(this.buses[bus]);
      if (this.reverb && bus === "effects") g.connect(this.reverb);
    }
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      pan?.disconnect();
    };
    src.start(t);
    src.stop(t + duration + 0.01);
  }
  play(kind: SoundKind, position?: Vec, metal = false) {
    for (const l of soundPlan(kind, metal))
      if (l.noise)
        this.burst(l.freq, l.duration, l.volume, position, l.bus, l.delay);
      else
        this.tone(
          l.freq,
          l.duration,
          l.volume,
          kind === "grunt" ? "sawtooth" : "triangle",
          position,
          l.bus,
          l.delay,
        );
  }
  environment(kind: string, x: number, z: number) {
    this.spatialDiagnostics.events++;
    const p = { x, z };
    if (kind === "telefone") {
      for (let i = 0; i < 3; i++)
        this.tone(720 + i * 125, 0.32, 0.12, "sine", p);
    } else if (kind === "radio") {
      this.tone(370, 0.7, 0.07, "sawtooth", p);
      this.tone(1700, 0.2, 0.035, "triangle", p);
    } else if (kind === "vidro" || kind === "faíscas") {
      this.tone(2900, 0.25, 0.2, "sawtooth", p);
      this.tone(820, 0.18, 0.1, "triangle", p);
    } else if (kind === "vapor") {
      this.tone(420, 0.6, 0.11, "sawtooth", p);
    } else {
      this.tone(kind === "maca" ? 230 : 72, 0.35, 0.2, "triangle", p);
      this.tone(44, 0.16, 0.12, "sine", p);
    }
  }
  shot() {
    this.play("shot");
  }
  toggle() {
    this.muted = !this.muted;
    if (this.gain)
      this.gain.gain.value = this.muted ? 0 : 0.12 * this.levels.master;
  }
}
