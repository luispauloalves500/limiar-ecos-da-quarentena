import type { CameraMode } from "./controls";
/** Presentation uses wall time, not capped simulation dt: a shader stall cannot
 * leave an already-rendered room black for more simulation frames. */
export function transitionOpacity(now: number, until: number) {
  return Math.max(0, Math.min(1, (until - now) / 350));
}
export function minimumLighting(safe: boolean | undefined, mode: CameraMode) {
  return {
    ambient: mode === "tank" ? 0.82 : safe ? 0.72 : 0.64,
    practical: safe ? 24 : 18,
  };
}
export function level(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function animationVariation(id: string) {
  const phase =
    [...id].reduce((v, c) => (v * 31 + c.charCodeAt(0)) % 997, 7) / 997;
  return { phase, speed: 0.92 + phase * 0.16 };
}

/** RAF timestamps may precede an input handler's performance.now(). Never let a
 * negative initial elapsed time disable an active transition on later frames. */
export function transitionElapsed(now: number, started: number) {
  return Math.max(0, (now - started) / 1000);
}
