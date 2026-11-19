import { describe, it, expect } from "vitest";
import {
  CHANNELS,
  PORTEIRO_LEG,
  PORTEIRO_TIMING,
  STANCE,
  advancePhase,
  blendPorteiro,
  legCycle,
  porteiroPose,
  strideAmplitude,
  strideLength,
  type PorteiroInput,
  type PorteiroState,
} from "../src/porteiro-pose";

const base: PorteiroInput = {
  state: "idle",
  phase: 0,
  gait: 0,
  age: 0,
  progress: 0,
  dash: false,
  hitAge: 9,
  hitSide: 1,
  exposed: false,
  clock: 0,
  seed: 0.3,
};
const pose = (o: Partial<PorteiroInput>) => porteiroPose({ ...base, ...o });

describe("Porteiro gait", () => {
  it("sweeps the planted thigh linearly and swings it back eased", () => {
    const a = 0.3;
    expect(legCycle(0, a).thigh).toBeCloseTo(-a);
    expect(legCycle(STANCE / 2, a).thigh).toBeCloseTo(0);
    expect(legCycle(STANCE - 1e-6, a).thigh).toBeCloseTo(a);
    expect(legCycle(0.3, a).lift).toBe(0);
    expect(legCycle(STANCE + (1 - STANCE) / 2, a).lift).toBeCloseTo(1);
    expect(legCycle(1.25, a).thigh).toBeCloseTo(legCycle(0.25, a).thigh);
    expect(legCycle(-0.75, a).thigh).toBeCloseTo(legCycle(0.25, a).thigh);
  });
  it("matches stride length to the planted foot sweep (no skating)", () => {
    for (const g of [0, 0.5, 1]) {
      const sweep = 2 * PORTEIRO_LEG * Math.sin(strideAmplitude(g));
      expect(strideLength(g) * STANCE).toBeCloseTo(sweep);
    }
    // A full stride of travel advances one full cycle.
    const L = strideLength(1);
    let ph = 0;
    for (let i = 0; i < 40; i++) ph = advancePhase(ph, L / 40, 1);
    expect(Math.abs(Math.sin(ph))).toBeLessThan(1e-6);
    // Teleports (dash) never advance more than a capped amount.
    expect(advancePhase(0, 50, 1)).toBeCloseTo(advancePhase(0, 0.25, 1));
  });
});

describe("Porteiro poses", () => {
  const states: PorteiroState[] = [
    "idle",
    "walk",
    "slam",
    "charge",
    "recover",
    "stun",
    "dead",
  ];
  it("every state gives finite channels across its timeline", () => {
    for (const state of states)
      for (let t = 0; t <= 3; t += 0.1) {
        const p = pose({
          state,
          age: t,
          progress: Math.min(1, t / PORTEIRO_TIMING.windup),
          phase: t * 4,
          gait: 0.7,
          clock: t,
          hitAge: t,
          exposed: t > 1.5,
        });
        for (const c of CHANNELS) expect(Number.isFinite(p[c])).toBe(true);
      }
  });
  it("slam raises the arms overhead as the windup grows", () => {
    const early = pose({ state: "slam", progress: 0.1 });
    const late = pose({ state: "slam", progress: 0.95 });
    expect(late.armL).toBeLessThan(early.armL - 0.5);
    expect(late.armR).toBeLessThan(early.armR - 0.5);
  });
  it("charge crouches lower than idle", () => {
    const idle = pose({ state: "idle" });
    const charge = pose({ state: "charge", progress: 0.9 });
    expect(charge.hips + charge.spine).toBeGreaterThan(idle.hips + idle.spine);
  });
  it("stun shakes, death falls forward", () => {
    expect(pose({ state: "stun", age: 0.5 }).tremor).toBeGreaterThan(0);
    expect(pose({ state: "dead", age: 0.2 }).death).toBe(0);
    expect(pose({ state: "dead", age: PORTEIRO_TIMING.death }).death).toBe(1);
  });
  it("a hit flinches the spine back briefly", () => {
    const calm = pose({});
    const hit = pose({ hitAge: PORTEIRO_TIMING.hit / 2 });
    expect(hit.spine).toBeLessThan(calm.spine);
  });
  it("blending moves channels toward the target without overshoot", () => {
    const a = pose({ state: "idle" });
    const b = pose({ state: "slam", progress: 1 });
    const m = blendPorteiro(a, b, 0.05);
    for (const c of CHANNELS) {
      const lo = Math.min(a[c], b[c]) - 1e-9,
        hi = Math.max(a[c], b[c]) + 1e-9;
      expect(m[c]).toBeGreaterThanOrEqual(lo);
      expect(m[c]).toBeLessThanOrEqual(hi);
    }
    expect(blendPorteiro(undefined, b, 0.05)).toEqual(b);
  });
});
