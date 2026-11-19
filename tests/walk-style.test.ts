import { describe, it, expect } from "vitest";
import {
  aimSettle,
  gaitOffset,
  walkStyle,
  weightShift,
} from "../src/locomotion";

describe("0.11 walk style", () => {
  it("is zero at amount 0 and bounded at full style", () => {
    const z = walkStyle(1.2, 0);
    for (const v of Object.values(z)) expect(Math.abs(v)).toBeLessThan(1e-12);
    for (let p = 0; p < 7; p += 0.2) {
      const s = walkStyle(p, 5); // clamped to 1
      expect(Math.abs(s.hipsRoll)).toBeLessThanOrEqual(0.075 + 1e-9);
      expect(Math.abs(s.hipsYaw)).toBeLessThanOrEqual(0.09 + 1e-9);
      expect(Math.abs(s.shift)).toBeLessThanOrEqual(0.014 + 1e-9);
    }
  });
  it("lifts the stance hip and counters it with the shoulders", () => {
    // Left foot planted around phase π: +X (left) hip up.
    const left = walkStyle(Math.PI, 1);
    expect(left.hipsRoll).toBeGreaterThan(0);
    expect(left.shift).toBeGreaterThan(0);
    expect(left.spineRoll).toBeLessThan(0);
    const right = walkStyle(0, 1);
    expect(right.hipsRoll).toBeLessThan(0);
  });
  it("turns the chest against the pelvis", () => {
    for (const p of [0.5, 1.5, 4, 5]) {
      const s = walkStyle(p, 1);
      expect(Math.sign(s.chestYaw)).toBe(-Math.sign(s.hipsYaw));
    }
  });
  it("idle weight shift holds on each leg", () => {
    let left = 0,
      right = 0;
    for (let t = 0; t < 60; t += 0.1) {
      const w = weightShift(t);
      expect(Math.abs(w)).toBeLessThanOrEqual(1);
      if (w > 0.8) left++;
      if (w < -0.8) right++;
    }
    expect(left).toBeGreaterThan(100);
    expect(right).toBeGreaterThan(100);
  });
  it("aim settle is a short damped wobble", () => {
    expect(aimSettle(-0.1)).toBe(0);
    expect(aimSettle(0)).toBe(0);
    expect(Math.abs(aimSettle(0.09))).toBeGreaterThan(0.3);
    expect(Math.abs(aimSettle(0.6))).toBeLessThan(0.02);
    expect(aimSettle(1)).toBe(0);
  });
  it("recovers a known gait phase offset", () => {
    for (const off of [-2.5, -1, 0, 0.7, 2.9]) {
      const u = Array.from({ length: 48 }, (_, i) => i / 48);
      const f = u.map((v) => 0.3 * Math.sin(2 * Math.PI * v + off) + 0.02);
      const got = gaitOffset(u, f);
      expect(Math.cos(got - off)).toBeGreaterThan(0.999);
    }
  });
});
