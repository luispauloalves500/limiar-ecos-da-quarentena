import { themes } from "./environment-logic";
import type { RoomId, Vec } from "./world";
export class Audio {
  ctx: AudioContext | null = null;
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
    this.gain.gain.value = 0.12;
    this.gain.connect(this.ctx.destination);
  }
  tone(
    freq: number,
    duration = 0.15,
    volume = 0.3,
    type: OscillatorType = "sine",
    position?: Vec,
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
      g.connect(pan).connect(this.gain);
      if (this.reverb) pan.connect(this.reverb);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
        pan.disconnect();
      };
    } else {
      g.connect(this.gain);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
    o.start();
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
    this.roomGain.connect(this.gain);
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
    this.drip = 1.5;
    this.spatialDiagnostics = {
      room,
      reverbSeconds: seconds,
      sources: 3,
      events: this.spatialDiagnostics.events,
    };
  }
  update(room: RoomId, p: Vec, yaw: number, dt: number, active: boolean) {
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
    if (active) {
      this.drip -= dt;
      if (this.drip <= 0) {
        this.drip = 2.8;
        this.tone(1300, 0.07, 0.08, "sine", { x: 4.9, z: -2.4 });
      }
    }
  }
  step(room: RoomId, p: Vec) {
    const surface = themes[room].surface;
    this.tone(
      surface === "metal"
        ? 180
        : surface === "wet"
          ? 95
          : surface === "paper"
            ? 240
            : 65,
      0.045,
      0.12,
      surface === "metal" ? "triangle" : "sine",
      p,
    );
    if (surface === "wet" || surface === "paper")
      this.tone(650, 0.045, 0.035, "sawtooth", p);
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
    this.tone(130, 0.18, 0.65, "sawtooth");
    this.tone(62, 0.22, 0.8, "triangle");
  }
  toggle() {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 0.12;
  }
}
