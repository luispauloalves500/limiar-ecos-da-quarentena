// 0.9: pure pose math for the berçário crawler (GLB rig without clips).
// Everything here is plain numbers so it can be unit-tested; crawler.ts turns
// it into bone rotations. Model space: +Z forward, +Y up, X to the side.

/** Limb order: front-left, front-right, hind-left, hind-right. */
export const LIMB_OFFSETS = [0, Math.PI, Math.PI, 0] as const;
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

/** One limb of the spider-walk gait: swing forward while lifted, push back
 * while planted. Diagonal pairs share a phase. */
export function gaitLimb(phase: number, offset: number): LimbPose {
  const p = phase + offset,
    s = Math.sin(p);
  return { swing: -Math.cos(p), lift: Math.max(0, s), curl: 0 };
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
    pose.roll = Math.sin(i.phase) * 0.07;
    pose.twist = Math.sin(i.phase) * 0.1;
    pose.bob = Math.abs(Math.sin(i.phase)) * 0.03;
    pose.headYaw = Math.sin(i.phase + 0.6) * 0.16;
    pose.headPitch = Math.sin(i.phase * 2) * 0.05;
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
