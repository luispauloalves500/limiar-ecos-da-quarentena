import { level } from "./presentation";
import type { Vec } from "./world";
export const VERSION = "0.6.0";
export type CameraMode = "shoulder" | "tank";
export type Quality = "low" | "medium" | "high";
export type Preferences = {
  version: 1;
  mode: CameraMode;
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  assist: boolean;
  shoulder: 1 | -1;
  ambience: "auto" | "off" | Quality;
  master: number;
  music: number;
  effects: number;
  voices: number;
  subtitles: boolean;
};
export const PREF_KEY = "limiar-preferences-v1";
export const defaults: Preferences = {
  version: 1,
  mode: "shoulder",
  quality: "medium",
  sensitivity: 1,
  invertY: false,
  assist: false,
  shoulder: 1,
  ambience: "auto",
  master: 0.8,
  music: 0.65,
  effects: 0.85,
  voices: 0.8,
  subtitles: true,
};
export function parsePreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw || "null");
    if (!p || p.version !== 1) return { ...defaults };
    return {
      version: 1,
      master: level(p.master, defaults.master),
      music: level(p.music, defaults.music),
      effects: level(p.effects, defaults.effects),
      voices: level(p.voices, defaults.voices),
      subtitles: p.subtitles !== false,
      mode: p.mode === "tank" ? "tank" : "shoulder",
      quality: ["low", "medium", "high"].includes(p.quality)
        ? p.quality
        : "medium",
      sensitivity:
        typeof p.sensitivity === "number" && Number.isFinite(p.sensitivity)
          ? Math.max(0.2, Math.min(3, p.sensitivity))
          : 1,
      invertY: p.invertY === true,
      assist: p.assist === true,
      shoulder: p.shoulder === -1 ? -1 : 1,
      ambience: ["off", "low", "medium", "high"].includes(p.ambience)
        ? p.ambience
        : "auto",
    };
  } catch {
    return { ...defaults };
  }
}
export function savePreferences(
  p: Preferences,
  store: Pick<Storage, "setItem">,
) {
  store.setItem(PREF_KEY, JSON.stringify(p));
}
export function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
export function lookInput(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  p: Preferences,
) {
  return {
    yaw: wrapAngle(yaw - dx * 0.0022 * p.sensitivity),
    pitch: Math.max(
      -1.05,
      Math.min(0.7, pitch - dy * 0.0022 * p.sensitivity * (p.invertY ? -1 : 1)),
    ),
  };
}
export function relativeMovement(x: number, z: number, yaw: number): Vec {
  const l = Math.hypot(x, z);
  if (!l) return { x: 0, z: 0 };
  return {
    x: (Math.sin(yaw) * z - Math.cos(yaw) * x) / l,
    z: (Math.cos(yaw) * z + Math.sin(yaw) * x) / l,
  };
}
export function tankMovement(
  forward: number,
  turn: number,
  yaw: number,
  dt: number,
) {
  const next = wrapAngle(yaw - turn * 2.1 * dt);
  return {
    yaw: next,
    vector: { x: Math.sin(next) * forward, z: Math.cos(next) * forward },
  };
}
export const profiles = {
  low: { scale: 0.6, shadows: false, shadowSize: 256, post: false, dust: 35 },
  medium: { scale: 0.9, shadows: true, shadowSize: 512, post: true, dust: 90 },
  high: { scale: 1.15, shadows: true, shadowSize: 1024, post: true, dust: 180 },
} as const;

export function shoulderOffset(aiming: boolean, side: number) {
  return (aiming ? 0.67 : 0.72) * side;
}

export const quickTurnRequested = (code: string, mode: CameraMode) =>
  code === "KeyZ" && mode === "tank";
