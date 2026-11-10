import { transitionElapsed } from "../src/presentation";
import { describe, it, expect } from "vitest";
import { transitionOpacity, minimumLighting, level } from "../src/presentation";
import {
  quickTurnRequested,
  parsePreferences,
  defaults,
} from "../src/controls";
import { rooms } from "../src/world";
describe("apresentação 0.5", () => {
  it("fade termina pelo relógio real mesmo após compilação de shaders", () => {
    expect(transitionOpacity(0, 350)).toBe(1);
    expect(transitionOpacity(175, 350)).toBe(0.5);
    expect(transitionOpacity(900, 350)).toBe(0);
  });
  it("meia volta só responde Z em tank, nunca a movimento/interação", () => {
    expect(quickTurnRequested("KeyZ", "tank")).toBe(true);
    for (const k of ["KeyW", "KeyE", "ArrowLeft", "KeyK", "KeyR"])
      expect(quickTurnRequested(k, "tank")).toBe(false);
    expect(quickTurnRequested("KeyZ", "shoulder")).toBe(false);
  });
  it("todas as salas têm piso de iluminação sem depender da lanterna", () => {
    for (const r of Object.values(rooms))
      for (const mode of ["tank", "shoulder"] as const) {
        const l = minimumLighting(r.safe, mode);
        expect(l.ambient).toBeGreaterThan(0.6);
        expect(l.practical).toBeGreaterThanOrEqual(18);
      }
  });
  it("migra preferências antigas e sanitiza volumes", () => {
    expect(parsePreferences('{"version":1}')).toMatchObject({
      master: defaults.master,
      subtitles: true,
    });
    expect(
      parsePreferences(
        '{"version":1,"master":-2,"music":6,"voices":null,"subtitles":false}',
      ),
    ).toMatchObject({ master: 0, music: 1, voices: 0.8, subtitles: false });
    expect(level(NaN, 0.5)).toBe(0.5);
  });
  it("pistas continuam em documentos de relógio e purga", () => {
    const text = Object.values(rooms)
      .flatMap((r) => r.items)
      .map((i) => i.text || "")
      .join(" ");
    expect(text).toContain("03:15");
    expect(text).toContain("3, 1, 2");
  });
});

it("RAF anterior ao input não congela porta por elapsed negativo", () => {
  expect(transitionElapsed(990, 1000)).toBe(0);
  expect(transitionElapsed(1100, 1000)).toBeCloseTo(0.1);
  expect(transitionElapsed(3600, 1000)).toBeCloseTo(2.6);
});
