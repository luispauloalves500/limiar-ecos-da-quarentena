// Pure, testable helpers for 0.6 locomotion/animation polish. No Three deps.
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Linear ramp toward a target; symmetric up/down keeps travelled distance of
 * a tap identical to the old instant movement (lost at start = gained at stop). */
export function ramp(current: number, target: number, dt: number, time = 0.12) {
  const step = dt / Math.max(1e-4, time);
  return target > current
    ? Math.min(target, current + step)
    : Math.max(target, current - step);
}

/** Rate-limited yaw so bodies turn instead of snapping/skating. */
export function turnToward(
  current: number,
  target: number,
  maxRate: number,
  dt: number,
) {
  const d = wrap(target - current),
    m = maxRate * dt;
  return wrap(current + Math.max(-m, Math.min(m, d)));
}

/** Stride sync: playback rate that makes an in-place clip's planted foot move
 * at the actual ground speed. native = metres/second at timeScale 1. */
export function strideScale(
  speed: number,
  native: number,
  min = 0.45,
  max = 1.7,
) {
  if (!(native > 0.05) || !(speed > 0.01)) return 1;
  return Math.max(min, Math.min(max, speed / native));
}

/** Native ground speed of an in-place clip: the planted (lowest) foot slides
 * backwards relative to the body at exactly the speed the body must travel.
 * Median of that backward velocity over the cycle; robust to swing frames. */
export function plantedSpeed(
  feet: { y: [number, number]; z: [number, number] }[],
  dt: number,
) {
  const v: number[] = [];
  for (let i = 1; i < feet.length; i++) {
    const a = feet[i - 1],
      b = feet[i],
      f = b.y[0] <= b.y[1] ? 0 : 1;
    if (a.y[f] > Math.min(a.y[0], a.y[1]) + 0.04) continue; // contact switch
    const back = -(b.z[f] - a.z[f]) / dt;
    if (back > 0) v.push(back);
  }
  if (v.length < 3) return 0;
  v.sort((x, y) => x - y);
  return v[Math.floor(v.length / 2)];
}

/** Exponential smoothing that is frame-rate independent. */
export const approach = (
  current: number,
  target: number,
  dt: number,
  rate: number,
) => current + (target - current) * (1 - Math.exp(-dt * rate));

/** Recoil kick envelope for a shot fired `age` seconds ago (fast in, slow out). */
export function recoilKick(age: number) {
  if (age < 0 || age > 0.28) return 0;
  return age < 0.04 ? age / 0.04 : Math.exp(-(age - 0.04) * 14);
}

export type MoveBlend = {
  mode: "idle" | "forward" | "back" | "strafeL" | "strafeR";
  hipsYaw: number;
  reverse: boolean;
};
/** Classify local move direction (x = Helena's left, i.e. Three's +X at
 * yaw 0; z forward relative to body). When
 * aiming, the upper body is locked, so the lower body walks backwards or
 * twists the hips toward a sidestep instead of moonwalking. */
export function moveBlend(
  localX: number,
  localZ: number,
  aiming: boolean,
): MoveBlend {
  const len = Math.hypot(localX, localZ);
  if (len < 0.05) return { mode: "idle", hipsYaw: 0, reverse: false };
  const x = localX / len,
    z = localZ / len;
  if (!aiming || z > 0.7)
    return {
      mode: "forward",
      hipsYaw: aiming ? Math.atan2(x, z) * 0.6 : 0,
      reverse: false,
    };
  if (z < -0.55)
    return { mode: "back", hipsYaw: Math.atan2(-x, -z) * 0.5, reverse: true };
  return {
    mode: x > 0 ? "strafeL" : "strafeR",
    hipsYaw: Math.sign(x) * 0.75,
    reverse: false,
  };
}

/** Lean into turns, proportional to angular velocity and speed, clamped. */
export function leanAngle(yawRate: number, speed: number, max = 0.13) {
  return Math.max(-max, Math.min(max, -yawRate * speed * 0.035));
}

/** Directional hit reaction: returns bend (forward/back) and twist from the
 * hit source angle relative to the body facing; decays to zero. */
export function hitReaction(
  relativeAngle: number,
  age: number,
  strength = 0.32,
  length = 0.42,
) {
  if (age < 0 || age > length) return { bend: 0, twist: 0 };
  const k = Math.sin((age / length) * Math.PI) * strength;
  return {
    bend: -Math.cos(relativeAngle) * k,
    twist: -Math.sin(relativeAngle) * k * 0.8,
  };
}

/** Breathing / micro-motion for idle; amplitude grows with low HP. */
export function breath(t: number, hp: number) {
  const tired = hp <= 30 ? 1.8 : 1;
  return {
    chest: Math.sin(t * 1.7 * (hp <= 30 ? 1.5 : 1)) * 0.022 * tired,
    sway: Math.sin(t * 0.43 + 1.1) * 0.012,
  };
}

/** Attack anticipation: slow the first 38% of an attack clip so the windup
 * reads clearly, then snap through the strike. */
export function telegraphScale(progress: number) {
  return progress < 0.38 ? 0.55 : 1.25;
}

/** Deterministic per-instance gait/death variety from an id. */
export function gaitVariation(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = (n: number) => ((h >>> n) & 1023) / 1023;
  return {
    lean: (r(0) - 0.5) * 0.14,
    hunch: 0.03 + r(10) * 0.08,
    limp: r(20) * 0.5,
    deathYaw: (r(5) - 0.5) * 1.4,
    deathSpeed: 0.85 + r(15) * 0.3,
  };
}

/** Lift needed so the lowest sampled point never sinks below the floor. */
export function groundLift(lowestY: number, clearance = 0.03) {
  return lowestY < clearance ? clearance - lowestY : 0;
}
