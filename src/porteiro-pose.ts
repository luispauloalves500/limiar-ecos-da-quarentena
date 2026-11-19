// 0.11: pure pose math for the Porteiro (B01) GLB the user sent: a tall,
// hunched skeletal ghoul with long clawed arms and no animation clips.
// Plain numbers so it can be unit-tested; porteiro.ts turns the channels into
// bone rotations. Model space: +Z forward, +Y up. Signs: a positive X turn
// tips a bone's tip backward (a leg/arm hanging down swings back; the spine
// leans forward); negative swings a hanging limb forward.

export const PORTEIRO_SCALE = 1.5; // 1.7 m model → ~2.55 m, like the 0.10 B01
/** Hip-to-ground length of the model's leg at scale, metres. */
export const PORTEIRO_LEG = 0.83 * PORTEIRO_SCALE;
export const PORTEIRO_TIMING = {
  windup: 1.2, // B01 windup in logic.ts
  recover: 1.6,
  strike: 0.32,
  hit: 0.4,
  death: 2.2,
};
export type PorteiroState =
  | "idle"
  | "walk"
  | "slam" // windup of the close swing
  | "charge" // windup of the long dash
  | "recover"
  | "stun"
  | "dead";
export type PorteiroInput = {
  state: PorteiroState;
  /** Gait phase, radians, advanced by distance walked. */
  phase: number;
  /** 0..1 gait amplitude (walk speed / full speed). */
  gait: number;
  /** Seconds since the state started. */
  age: number;
  /** Windup progress 0..1. */
  progress: number;
  /** Last attack was the dash (recover pose differs). */
  dash: boolean;
  hitAge: number;
  hitSide: number;
  /** Armour open (generator/trap window). */
  exposed: boolean;
  clock: number;
  seed: number;
};
export const CHANNELS = [
  "hips", // whole-body pitch about the hips (+ forward)
  "hipsRoll",
  "pelvisYaw",
  "spine", // extra spine lean (+ forward)
  "chestYaw",
  "chestRoll",
  "head", // + looks down
  "headYaw",
  "headRoll",
  "jaw",
  "thighL",
  "thighR", // + back, − forward
  "kneeL",
  "kneeR", // + bends
  "footL",
  "footR",
  "armL",
  "armR", // + back, − forward/up
  "armOutL",
  "armOutR", // spread sideways
  "elbowL",
  "elbowR", // + bends (forearm forward/up)
  "claw", // finger curl
  "tremor", // electric jitter amplitude
  "lift", // vertical offset after the floor clamp, metres (model units)
  "lunge", // forward offset, metres (model units)
  "death", // 0..1 fall progress
] as const;
export type Channel = (typeof CHANNELS)[number];
export type PorteiroPose = Record<Channel, number>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const zero = (): PorteiroPose =>
  Object.fromEntries(CHANNELS.map((c) => [c, 0])) as PorteiroPose;

/** Fraction of the cycle each foot stays planted. */
export const STANCE = 0.6;
export function strideAmplitude(gait: number) {
  return 0.14 + 0.26 * clamp01(gait);
}
/** The planted foot sweeps 2·L·sin(A) while the body covers the same
 * distance during the stance fraction, so the foot does not skate. */
export function strideLength(gait: number) {
  return (2 * PORTEIRO_LEG * Math.sin(strideAmplitude(gait))) / STANCE;
}
/** Thigh angle (+ back) and lift (0..1) for one leg at gait phase `u`
 * (0..1): linear sweep while planted, eased swing forward in the air. */
export function legCycle(u: number, a: number) {
  const k = ((u % 1) + 1) % 1;
  if (k < STANCE) return { thigh: -a + (2 * a * k) / STANCE, lift: 0 };
  const v = (k - STANCE) / (1 - STANCE);
  return { thigh: a - 2 * a * ease(v), lift: Math.sin(Math.PI * v) };
}
export function advancePhase(phase: number, distance: number, gait: number) {
  return (
    (phase + (Math.min(distance, 0.25) / strideLength(gait)) * Math.PI * 2) %
    (Math.PI * 2)
  );
}

export function porteiroPose(i: PorteiroInput): PorteiroPose {
  const p = zero(),
    t = i.clock,
    seed = i.seed * 10;
  // Base: hunched predator stance, knees soft, claws half closed.
  p.hips = 0.1;
  p.spine = 0.16;
  p.head = -0.22; // keeps the skull looking ahead over the hunch
  p.kneeL = p.kneeR = 0.12;
  p.thighL = p.thighR = -0.08;
  p.armOutL = p.armOutR = 0.08;
  p.elbowL = p.elbowR = 0.18;
  p.claw = 0.35;
  // Breathing and slow weight shift, always on unless dead.
  const breath = Math.sin(t * 1.5 + seed);
  p.spine += breath * 0.025;
  p.head -= breath * 0.02;
  p.armOutL += breath * 0.02;
  p.armOutR += breath * 0.02;
  const shift = Math.sin(t * 0.55 + seed);
  p.hipsRoll = shift * 0.03;
  p.chestRoll = -shift * 0.02;
  // Idle twitch of the skull every few seconds.
  const tw = Math.max(0, Math.sin(t * 0.9 + seed * 2)) ** 24;
  p.headYaw = tw * 0.35 * (Math.sin(seed) > 0 ? 1 : -1);
  p.headRoll = tw * 0.25;

  if (i.state === "walk" || (i.state === "idle" && i.gait > 0.05)) {
    const a = strideAmplitude(i.gait),
      s = Math.sin(i.phase),
      c = Math.cos(i.phase),
      g = clamp01(i.gait * 1.4);
    // Legs half a cycle apart; knee and toe lift only in the swing.
    const u = i.phase / (Math.PI * 2),
      L = legCycle(u, a),
      R = legCycle(u + 0.5, a);
    p.thighL += L.thigh;
    p.thighR += R.thigh;
    p.kneeL += 0.85 * L.lift * g + 0.1 * g;
    p.kneeR += 0.85 * R.lift * g + 0.1 * g;
    p.footL = -0.3 * g * L.lift;
    p.footR = -0.3 * g * R.lift;
    // Heavy stalk: leaning in, pelvis rolls over the stance leg, the chest
    // counter-rotates and the long arms swing late against the legs.
    p.hips += 0.12 * g;
    p.spine += 0.06 * g;
    p.head -= 0.12 * g;
    p.pelvisYaw = -0.1 * g * s;
    p.chestYaw = 0.16 * g * s;
    p.hipsRoll += 0.06 * g * c;
    p.chestRoll -= 0.05 * g * c;
    const lag = Math.sin(i.phase - 0.5);
    p.armL -= 0.42 * g * lag;
    p.armR += 0.42 * g * lag;
    p.elbowL += 0.25 * g * Math.max(0, lag);
    p.elbowR += 0.25 * g * Math.max(0, -lag);
    p.headYaw -= 0.05 * g * s;
    p.lift = 0.025 * g * Math.cos(i.phase * 2);
  }

  if (i.state === "slam") {
    // Both claws rise overhead, chest arches back, weight sinks.
    const k = ease(i.progress / 0.85),
      quiver = clamp01((i.progress - 0.8) * 5);
    p.armL = p.armR = -2.55 * k;
    p.armOutL = p.armOutR = 0.08 + 0.25 * k;
    p.elbowL = p.elbowR = 0.18 + 0.5 * k;
    p.spine += -0.38 * k;
    p.hips += -0.08 * k;
    p.head += -0.25 * k;
    p.jaw = 0.5 * k;
    p.claw = 0.35 - 0.3 * k;
    p.thighL -= 0.2 * k;
    p.thighR += 0.12 * k;
    p.kneeL += 0.3 * k;
    p.kneeR += 0.35 * k;
    p.tremor = 0.02 * quiver;
  }
  if (i.state === "charge") {
    // Crouch to sprint: low, chest down, claws swept back, skull up.
    const k = ease(i.progress / 0.7);
    p.hips += 0.45 * k;
    p.spine += 0.2 * k;
    p.head += -0.55 * k;
    p.thighL += -0.55 * k;
    p.thighR += -0.25 * k;
    p.kneeL += 0.9 * k;
    p.kneeR += 0.7 * k;
    p.footL += 0.3 * k;
    p.footR += 0.25 * k;
    p.armL = p.armR = 0.9 * k;
    p.armOutL = p.armOutR = 0.08 + 0.35 * k;
    p.elbowL = p.elbowR = 0.18 + 0.2 * k;
    p.jaw = 0.35 * k;
    p.lift = -0.12 * k;
    p.tremor = 0.015 * clamp01((i.progress - 0.6) * 3);
  }
  if (i.state === "recover") {
    const strike = 1 - ease(i.age / PORTEIRO_TIMING.strike),
      settle = ease((i.age - PORTEIRO_TIMING.strike) / 1.1);
    const pant = (1 - settle) * Math.sin(t * 6);
    if (i.dash) {
      // End of the dash: thrown forward over the front leg, claws out.
      p.hips += 0.55 * strike + 0.25 * (1 - settle);
      p.spine += 0.1 * strike;
      p.head += -0.4 * strike;
      p.thighL += -0.6 * strike;
      p.thighR += 0.45 * strike;
      p.kneeL += 0.5 * strike;
      p.armL = p.armR = -1.25 * strike;
      p.armOutL = p.armOutR = 0.3 * strike;
      p.lunge = 0.35 * strike;
    } else {
      // The slam lands: claws driven to the floor, then drag back up.
      const hold = 1 - settle;
      p.hips += 0.45 * Math.max(strike, hold * 0.8);
      p.spine += 0.35 * Math.max(strike, hold * 0.7);
      p.head += -0.3 * hold;
      p.armL = p.armR = -0.75 * hold;
      p.elbowL = p.elbowR = 0.05;
      p.kneeL += 0.45 * hold;
      p.kneeR += 0.4 * hold;
      p.thighL += -0.3 * hold;
      p.lift = -0.08 * hold;
      p.claw = 0.1 + 0.25 * settle;
    }
    p.spine += 0.05 * pant;
    p.head += 0.04 * pant;
  }
  if (i.state === "stun") {
    // Electric trap: locked, convulsing, skull thrown back, knees buckling.
    const k = ease(i.age / 0.25),
      fade = 1 - clamp01((i.age - 1.6) / 0.4);
    p.spine += -0.3 * k;
    p.head += -0.45 * k;
    p.jaw = 0.7 * k;
    p.armOutL = p.armOutR = 0.08 + 0.8 * k;
    p.armL = p.armR = -0.3 * k;
    p.elbowL = p.elbowR = 0.18 + 0.7 * k;
    p.claw = 0.9 * k;
    p.kneeL += 0.5 * k;
    p.kneeR += 0.45 * k;
    p.thighL += -0.25 * k;
    p.thighR += -0.2 * k;
    p.tremor = 0.09 * k * fade;
  }
  if (i.exposed && i.state !== "stun" && i.state !== "dead") {
    // Armour open: guarding the glowing ribcage, slower and hunched.
    p.spine += 0.12;
    p.armL += -0.25;
    p.armR += -0.25;
    p.elbowL += 0.4;
    p.elbowR += 0.4;
    p.tremor = Math.max(p.tremor, 0.012);
  }
  if (i.state !== "dead" && i.hitAge < PORTEIRO_TIMING.hit) {
    const h = Math.sin((i.hitAge / PORTEIRO_TIMING.hit) * Math.PI);
    p.spine -= 0.22 * h;
    p.head -= 0.18 * h;
    p.chestYaw += 0.22 * h * i.hitSide;
    p.chestRoll += 0.08 * h * i.hitSide;
    p.armOutL += 0.15 * h;
    p.armOutR += 0.15 * h;
  }
  if (i.state === "dead") {
    // Three beats: reels back, knees give, falls forward on its face.
    const reel = ease(i.age / 0.45) * (1 - ease((i.age - 0.45) / 0.5)),
      knees = ease((i.age - 0.45) / 0.6),
      fall = ease((i.age - 0.95) / 0.7);
    p.spine += -0.45 * reel + 0.25 * knees;
    p.head += -0.5 * reel + 0.3 * knees + 0.2 * fall;
    p.jaw = 0.8 * reel + 0.4 * knees;
    p.armOutL = p.armOutR = 0.08 + 0.6 * reel + 0.3 * fall;
    p.armL = p.armR = -0.6 * reel - 1.3 * fall;
    // While the body pitches forward the thighs counter the pitch and the
    // knees open a little, so it ends slumped on its knees with the shins
    // flat on the floor instead of sticking up behind it.
    p.thighL += -1.2 * knees - 0.2 * fall;
    p.thighR += -1.1 * knees - 0.3 * fall;
    p.kneeL += 1.9 * knees - 0.35 * fall;
    p.kneeR += 1.8 * knees - 0.25 * fall;
    p.footL += 0.6 * knees;
    p.footR += 0.6 * knees;
    p.claw = 0.35 + 0.5 * knees;
    p.death = fall;
    p.headYaw = 0;
    p.hipsRoll = 0;
  }
  return p;
}

/** Exponential per-channel blend so nothing snaps between states. */
export function blendPorteiro(
  from: PorteiroPose | undefined,
  to: PorteiroPose,
  dt: number,
  rate = 12,
): PorteiroPose {
  if (!from) return to;
  const k = 1 - Math.exp(-dt * rate),
    out = zero();
  for (const c of CHANNELS) out[c] = from[c] + (to[c] - from[c]) * k;
  out.death = to.death;
  return out;
}
