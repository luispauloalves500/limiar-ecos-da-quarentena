import { describe, it, expect } from "vitest";
import {
  themes,
  ambientDensity,
  claimAmbientEvent,
  addImpact,
  validateAmbientSave,
  integrateBody,
} from "../src/environment-logic";
import { newGame, parseSave } from "../src/logic";
import { defaults, parsePreferences } from "../src/controls";
import { rooms } from "../src/world";
describe("vida ambiental 0.4", () => {
  it("cobre todas as salas com identidade, superfície e evento", () => {
    expect(Object.keys(themes).sort()).toEqual(Object.keys(rooms).sort());
    for (const t of Object.values(themes)) {
      expect(t.story.length).toBeGreaterThan(25);
      expect(t.fog).toBeGreaterThan(0);
      expect(t.event.length).toBeGreaterThan(0);
    }
  });
  it.each(["low", "medium", "high"] as const)(
    "densidade automática acompanha %s",
    (quality) => {
      expect(ambientDensity({ ...defaults, quality })).toBe(
        { low: 0.3, medium: 0.65, high: 1 }[quality],
      );
    },
  );
  it("override e off persistem sem depender do perfil", () => {
    const p = parsePreferences(
      JSON.stringify({ ...defaults, quality: "high", ambience: "off" }),
    );
    expect(ambientDensity(p)).toBe(0);
    expect(ambientDensity({ ...p, ambience: "low" })).toBe(0.3);
    expect(
      parsePreferences(JSON.stringify({ ...defaults, ambience: "absurdo" }))
        .ambience,
    ).toBe("auto");
  });
  it("evento espera tempo e jogo ativo, ocorre uma vez por sala e save", () => {
    const s = newGame();
    expect(claimAmbientEvent(s, 4, false)).toBe(false);
    expect(claimAmbientEvent(s, 3, true)).toBe(false);
    expect(claimAmbientEvent(s, 3.5, true)).toBe(true);
    expect(claimAmbientEvent(s, 20, true)).toBe(false);
    const loaded = parseSave(JSON.stringify(s));
    expect(claimAmbientEvent(loaded, 30, true)).toBe(false);
    loaded.room = "corredor";
    expect(claimAmbientEvent(loaded, 4, true)).toBe(true);
  });
  it("decais limitados, vidro e eventos sobrevivem ao save", () => {
    const s = newGame();
    for (let i = 0; i < 30; i++)
      addImpact(s, { x: i / 10, y: 1, z: 0, wall: true });
    s.ambience!.broken.push("recepcao");
    const loaded = parseSave(JSON.stringify(s));
    expect(loaded.ambience!.impacts.recepcao).toHaveLength(16);
    expect(loaded.ambience!.impacts.recepcao![0].x).toBe(1.4);
    expect(loaded.ambience!.broken).toEqual(["recepcao"]);
  });
  it("saves antigos recebem estado ambiental vazio", () => {
    const s = newGame();
    delete s.ambience;
    expect(parseSave(JSON.stringify(s)).ambience).toEqual({
      impacts: {},
      broken: [],
    });
  });
  it.each([
    null,
    { impacts: [], broken: [] },
    { impacts: { x: [] }, broken: [] },
    { impacts: {}, broken: ["nope"] },
    { impacts: { recepcao: [{ x: NaN, y: 1, z: 0, wall: true }] }, broken: [] },
  ])("recusa ambiente corrompido %j", (a) =>
    expect(() => validateAmbientSave(a)).toThrow(),
  );
  it("não compartilha arrays com o dado parseado", () => {
    const a = {
      impacts: { recepcao: [{ x: 1, y: 1, z: 1, wall: true }] },
      broken: ["recepcao"],
    };
    const b = validateAmbientSave(a);
    b.impacts.recepcao![0].x = 2;
    expect(a.impacts.recepcao[0].x).toBe(1);
  });
  it("objetos reativos amortecem e não escapam dos limites", () => {
    const b = { x: 5.79, z: 7.49, vx: 5, vz: 5, angle: 0 };
    integrateBody(b, 1);
    expect(b.x).toBeLessThanOrEqual(5.8);
    expect(b.z).toBeLessThanOrEqual(7.5);
    expect(b.vx).toBeLessThan(0);
    for (let i = 0; i < 100; i++) integrateBody(b, 0.016);
    expect(Math.abs(b.vx)).toBeLessThan(0.03);
  });
});
