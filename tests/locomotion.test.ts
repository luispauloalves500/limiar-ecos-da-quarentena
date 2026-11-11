import { describe, it, expect } from "vitest";
import {
  wrap,
  ramp,
  turnToward,
  strideScale,
  plantedSpeed,
  moveBlend,
  leanAngle,
  hitReaction,
  breath,
  telegraphScale,
  gaitVariation,
  groundLift,
  approach,
  recoilKick,
} from "../src/locomotion";

describe("locomoção 0.6", () => {
  it("rampa simétrica preserva a distância de um toque", () => {
    let v = 0,
      d = 0;
    const dt = 1 / 60,
      t = 0.1 / 2.2;
    for (let i = 0; i < 60; i++) {
      v = ramp(v, 2.2, dt, t);
      d += v * dt;
    }
    for (let i = 0; i < 60; i++) {
      v = ramp(v, 0, dt, t);
      d += v * dt;
    }
    expect(v).toBe(0);
    // Instant movement would travel 2.2 m in 1 s; ramp in + ramp out cancel.
    expect(d).toBeCloseTo(2.2, 1);
  });
  it("giro limitado por taxa atravessa ±π pelo menor caminho", () => {
    expect(turnToward(3.1, -3.1, 1, 0.05)).toBeCloseTo(wrap(3.15), 5);
    expect(turnToward(0, 1, 2, 0.1)).toBeCloseTo(0.2, 5);
    expect(turnToward(0, 0.05, 2, 0.1)).toBeCloseTo(0.05, 5);
  });
  it("sincronia de passada: velocidade real / nativa, limitada", () => {
    expect(strideScale(1.1, 1.1)).toBe(1);
    expect(strideScale(0.88, 2.2)).toBeCloseTo(0.45, 5);
    expect(strideScale(10, 2)).toBe(1.7);
    expect(strideScale(1, 0)).toBe(1);
  });
  it("mede a velocidade do pé apoiado de um ciclo in-place sintético", () => {
    // Two feet, 1 m/s planted backward slide, alternating every half cycle.
    const n = 48,
      T = 1.2,
      dt = T / n,
      samples = [];
    for (let i = 0; i <= n; i++) {
      const t = i * dt,
        ph = (t / T) % 1,
        l = ph < 0.5,
        zl = l ? 0.3 - (ph / 0.5) * 0.6 : -0.3 + ((ph - 0.5) / 0.5) * 0.6,
        zr = -zl;
      samples.push({
        y: [l ? 0.08 : 0.2, l ? 0.2 : 0.08] as [number, number],
        z: [zl, zr] as [number, number],
      });
    }
    expect(plantedSpeed(samples, dt)).toBeCloseTo(1, 1);
    expect(plantedSpeed([], dt)).toBe(0);
  });
  it("mira: anda de costas, gira o quadril no passo lateral", () => {
    expect(moveBlend(0, 1, true).mode).toBe("forward");
    const back = moveBlend(0, -1, true);
    expect(back.mode).toBe("back");
    expect(back.reverse).toBe(true);
    expect(moveBlend(1, 0, true).mode).toBe("strafeL");
    expect(moveBlend(-1, 0, true).hipsYaw).toBeLessThan(0);
    expect(moveBlend(0, -1, false)).toMatchObject({ mode: "forward", reverse: false });
    expect(moveBlend(0, 0, true).mode).toBe("idle");
  });
  it("inclinação na curva, reação direcional, respiração e telegraph", () => {
    expect(Math.abs(leanAngle(20, 4))).toBe(0.13);
    expect(leanAngle(0, 3)).toBeCloseTo(0);
    const front = hitReaction(0, 0.21),
      side = hitReaction(Math.PI / 2, 0.21);
    expect(front.bend).toBeLessThan(0);
    expect(Math.abs(side.twist)).toBeGreaterThan(Math.abs(side.bend));
    expect(hitReaction(0, 1)).toEqual({ bend: 0, twist: 0 });
    expect(Math.abs(breath(1, 20).chest)).toBeGreaterThan(Math.abs(breath(1, 100).chest) - 1e-9);
    expect(telegraphScale(0.1)).toBeLessThan(1);
    expect(telegraphScale(0.8)).toBeGreaterThan(1);
    expect(recoilKick(0.04)).toBeCloseTo(1);
    expect(recoilKick(0.5)).toBe(0);
    expect(approach(0, 1, 1, 50)).toBeCloseTo(1);
  });
  it("variação de marcha/morte é estável por ID e distinta entre clones", () => {
    const a = gaitVariation("Z01"),
      b = gaitVariation("Z02");
    expect(a).toEqual(gaitVariation("Z01"));
    expect(a).not.toEqual(b);
    for (const id of ["Z01", "Z02", "Z03", "BOSS", "E02"]) {
      const g = gaitVariation(id);
      expect(Math.abs(g.lean)).toBeLessThanOrEqual(0.07);
      expect(g.hunch).toBeLessThanOrEqual(0.11);
      expect(g.deathSpeed).toBeGreaterThanOrEqual(0.85);
      expect(g.deathSpeed).toBeLessThanOrEqual(1.15);
    }
  });
  it("cadáver nunca afunda: eleva até a folga", () => {
    expect(groundLift(-0.1, 0.05)).toBeCloseTo(0.15);
    expect(groundLift(0.2, 0.05)).toBe(0);
  });
});
