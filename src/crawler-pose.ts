// 0.9: pure pose math for the berçário crawler (GLB rig without clips).
// Everything here is plain numbers so it can be unit-tested; crawler.ts turns
// it into bone rotations. Model space: +Z forward, +Y up, X to the side.

/** Limb order: front-left, front-right, hind-left, hind-right. 0.10: a
 * four-beat lateral sequence (hind-L → front-L → hind-R → front-R, a quarter
 * cycle apart) like a crawling infant, instead of the 0.9 diagonal trot. */
export const LIMB_OFFSETS = [
  Math.PI / 2,
  (3 * Math.PI) / 2,
  0,
  Math.PI,
] as const;
/** Fraction of the cycle a limb spends in the air. */
export const SWING_DUTY = 0.3;
const LIMB_SIDE = [-1, 1, -1, 1];
export const CRAWLER_STRIDE = 0.48; // metres travelled per full gait cycle
export const CRAWLER_TIMING = {
  windup: 0.55, // matches E05 windup in logic.ts
  strike: 0.22,
  hit: 0.38,
  death: 1.1,
};

export type LimbPose = {
  /** + forward, - back (fraction of the swing arc). */
  swing: number;
  /** 0 planted … 1 fully lifted. */
  lift: number;
  /** Extra joint curl (death/cower), radians. */
  curl: number;
};
export type CrawlerPose = {
  limbs: LimbPose[];
  /** Body pitch about X (+ = front goes down), radians. */
  pitch: number;
  /** Body roll about Z, radians. */
  roll: number;
  /** Spine twist about Y, radians. */
  twist: number;
  /** Vertical bob of the whole model, metres (before floor clamp). */
  bob: number;
  /** Forward lunge offset, metres. */
  lunge: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  /** 0..1 death progress (model rolls onto its side). */
  death: number;
};

export type CrawlerInput = {
  state: "idle" | "crawl" | "windup" | "strike" | "recover" | "stun" | "dead";
  /** Gait phase in radians (advanced by distance travelled). */
  phase: number;
  /** Seconds since the current state started. */
  age: number;
  /** Seconds since the last hit (large if none). */
  hitAge: number;
  /** -1 / +1 side the hit came from. */
  hitSide: number;
  /** Free-running clock for idle twitches. */
  clock: number;
  /** Per-instance seed 0..1. */
  seed: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Advance the gait phase from distance actually moved (no foot skating). */
export function advancePhase(phase: number, distance: number) {
  return (phase + (distance / CRAWLER_STRIDE) * Math.PI * 2) % (Math.PI * 2);
}

/** One limb of the gait: a short lifted swing forward (SWING_DUTY of the
 * cycle, eased), then a long planted push back at constant speed, so the
 * planted hand/foot moves with the ground instead of skating. */
export function gaitLimb(phase: number, offset: number): LimbPose {
  const tau = Math.PI * 2,
    u = ((((phase + offset) % tau) + tau) % tau) / tau;
  if (u < SWING_DUTY) {
    const k = u / SWING_DUTY;
    return {
      swing: -Math.cos(k * Math.PI),
      lift: Math.sin(k * Math.PI),
      curl: 0,
    };
  }
  return {
    swing: 1 - (2 * (u - SWING_DUTY)) / (1 - SWING_DUTY),
    lift: 0,
    curl: 0,
  };
}

export function crawlerPose(i: CrawlerInput): CrawlerPose {
  const twitch =
    Math.sin(i.clock * 1.7 + i.seed * 9) > 0.92
      ? Math.sin(i.clock * 31) * 0.25
      : 0;
  const pose: CrawlerPose = {
    limbs: LIMB_OFFSETS.map(() => ({ swing: 0, lift: 0, curl: 0 })),
    pitch: 0,
    roll: 0,
    twist: 0,
    bob: 0,
    lunge: 0,
    headPitch: 0,
    headYaw: Math.sin(i.clock * 0.6 + i.seed * 5) * 0.12,
    headRoll: twitch,
    death: 0,
  };
  if (i.state === "dead") {
    const k = smooth(i.age / CRAWLER_TIMING.death);
    // Arms give out first, then the arch collapses sideways and limbs curl.
    const arms = smooth(i.age / (CRAWLER_TIMING.death * 0.45));
    pose.limbs = pose.limbs.map((_, n) => ({
      swing: n < 2 ? 0.6 * arms : -0.3 * k,
      lift: 0,
      curl: (n < 2 ? 0.9 : 0.7) * k,
    }));
    pose.pitch = 0.45 * arms - 0.15 * k;
    pose.death = k;
    pose.headPitch = 0.5 * k;
    pose.headYaw = 0;
    // Post-mortem spasm, fading out.
    const spasm = i.age > CRAWLER_TIMING.death && i.age < 2.4;
    pose.headRoll = spasm ? Math.sin(i.age * 40) * 0.08 * (2.4 - i.age) : 0;
    return pose;
  }
  if (i.state === "crawl") {
    pose.limbs = LIMB_OFFSETS.map((o) => gaitLimb(i.phase, o));
    // Weight shifts away from the lifted limb; the spine twists with the
    // front reach and the head follows a beat later (secondary motion).
    pose.roll = pose.limbs.reduce(
      (r, l, n) => r - l.lift * LIMB_SIDE[n] * 0.06,
      0,
    );
    const reach = pose.limbs[0].swing - pose.limbs[1].swing;
    pose.twist = reach * 0.06;
    pose.bob = pose.limbs.reduce((b, l) => b + l.lift, 0) * 0.014;
    pose.pitch = (pose.limbs[0].lift + pose.limbs[1].lift) * -0.03;
    pose.headYaw = Math.sin(i.phase - 0.9) * 0.14;
    pose.headPitch = Math.sin(i.phase * 2 - 0.5) * 0.05;
  } else if (i.state === "idle") {
    const breath = Math.sin(i.clock * 2.1 + i.seed * 3);
    pose.bob = breath * 0.012;
    pose.pitch = breath * 0.02;
    // Fingers drum: one front limb lifts a little now and then.
    const tap = Math.max(0, Math.sin(i.clock * 1.3 + i.seed * 7) - 0.8) * 1.5;
    pose.limbs[i.seed > 0.5 ? 0 : 1].lift = tap;
  } else if (i.state === "windup") {
    // Rear up: the front lifts, both hands rise like claws, head cocks.
    const k = smooth(i.age / CRAWLER_TIMING.windup);
    pose.pitch = -0.42 * k;
    pose.limbs[0] = { swing: 0.55 * k, lift: 0.9 * k, curl: 0.2 * k };
    pose.limbs[1] = { swing: 0.55 * k, lift: 0.9 * k, curl: 0.2 * k };
    pose.limbs[2] = { swing: -0.25 * k, lift: 0, curl: 0 };
    pose.limbs[3] = { swing: -0.25 * k, lift: 0, curl: 0 };
    pose.headPitch = -0.3 * k;
    pose.headRoll = 0.35 * k + twitch;
    pose.bob = 0.05 * k;
    pose.lunge = -0.08 * k;
  } else if (i.state === "strike" || i.state === "recover") {
    // Slam forward, then settle back over ~0.6 s of recovery.
    const hit = smooth(i.age / CRAWLER_TIMING.strike),
      back = i.state === "recover" ? smooth((i.age - 0.25) / 0.6) : 0,
      k = hit * (1 - back),
      rear = 1 - hit;
    pose.pitch = -0.42 * rear + 0.22 * k;
    pose.lunge = 0.38 * k - 0.08 * rear;
    pose.limbs[0] = { swing: 0.55 * rear + 0.9 * k, lift: 0.9 * rear, curl: 0 };
    pose.limbs[1] = { swing: 0.55 * rear + 0.9 * k, lift: 0.9 * rear, curl: 0 };
    pose.limbs[2] = { swing: -0.4 * k, lift: 0, curl: 0 };
    pose.limbs[3] = { swing: -0.4 * k, lift: 0, curl: 0 };
    pose.headPitch = 0.3 * k - 0.3 * rear;
    pose.headRoll = twitch;
  } else if (i.state === "stun") {
    // Cower: flatten, head turns away, whole body shivers.
    const k = smooth(i.age / 0.25);
    pose.pitch = 0.18 * k;
    pose.bob = -0.08 * k;
    pose.roll = Math.sin(i.clock * 38) * 0.03 * k;
    pose.headYaw = 0.6 * k;
    pose.headPitch = 0.25 * k;
    pose.limbs = pose.limbs.map(() => ({ swing: 0, lift: 0, curl: 0.35 * k }));
  }
  // Additive hit flinch: snap away from the shot and back.
  if (i.hitAge >= 0 && i.hitAge < CRAWLER_TIMING.hit) {
    const t = i.hitAge / CRAWLER_TIMING.hit,
      f = Math.sin(t * Math.PI) * (1 - t * 0.5);
    pose.pitch -= 0.28 * f;
    pose.roll += 0.22 * f * i.hitSide;
    pose.headPitch -= 0.45 * f;
    pose.headRoll += 0.3 * f * i.hitSide;
    pose.lunge -= 0.1 * f;
  }
  return pose;
}

/** Map game enemy state to the crawler animation state. "recover" starts
 * with the strike (first CRAWLER_TIMING.strike seconds), then settles. */
export function crawlerState(
  e: { dead: boolean; state: string },
  speed: number,
): CrawlerInput["state"] {
  if (e.dead) return "dead";
  if (e.state === "windup") return "windup";
  if (e.state === "recover") return "recover";
  if (e.state === "stun") return "stun";
  return speed > 0.05 ? "crawl" : "idle";
}

/** 0.10: ease every channel toward the new target (no snapping when the
 * state changes crawl → windup → strike → recover). `rate` per second. */
export function blendPose(
  from: CrawlerPose | undefined,
  to: CrawlerPose,
  dt: number,
  rate = 14,
): CrawlerPose {
  if (!from) return to;
  const k = 1 - Math.exp(-dt * rate),
    mix = (a: number, b: number) => a + (b - a) * k;
  return {
    limbs: to.limbs.map((l, n) => ({
      swing: mix(from.limbs[n].swing, l.swing),
      lift: mix(from.limbs[n].lift, l.lift),
      curl: mix(from.limbs[n].curl, l.curl),
    })),
    pitch: mix(from.pitch, to.pitch),
    roll: mix(from.roll, to.roll),
    twist: mix(from.twist, to.twist),
    bob: mix(from.bob, to.bob),
    lunge: mix(from.lunge, to.lunge),
    headPitch: mix(from.headPitch, to.headPitch),
    headYaw: mix(from.headYaw, to.headYaw),
    headRoll: mix(from.headRoll, to.headRoll),
    death: to.death,
  };
}
