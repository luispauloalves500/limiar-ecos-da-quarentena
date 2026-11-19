import { describe, expect, it } from "vitest";
import {
  ADDED_V6,
  damage,
  enemyStats,
  newGame,
  parseSave,
  PRESSURE_START,
  turnPressure,
  canTravel,
} from "../src/logic";
import { doors, rooms, clearPoint } from "../src/world";
import { CHAPTER3 } from "../src/chapter3-art";

describe("capítulo 3 · centro cirúrgico e estação hídrica (0.12)", () => {
  it("sete salas novas, ligadas ao visor e em cadeia até o elevador", () => {
    expect(CHAPTER3.size).toBe(7);
    for (const id of CHAPTER3) expect(rooms[id], id).toBeTruthy();
    const keys = doors
      .filter((d) => CHAPTER3.has(d.a) || CHAPTER3.has(d.b))
      .map((d) => d.key)
      .filter(Boolean);
    expect(keys).toEqual([
      "cirurgia",
      "chave-bombas",
      "equalizado",
      "mergulhador",
    ]);
    expect(rooms.esterilizacao.safe).toBe(true);
  });
  it("cada fechadura do capítulo tem a chave dentro do próprio capítulo", () => {
    const s = newGame();
    const d = (id: string) => doors.find((x) => x.id === id)!;
    expect(canTravel(d("D20"), s)).toBe(false);
    s.flags.cirurgia = true;
    expect(canTravel(d("D20"), s)).toBe(true);
    expect(rooms.cirurgia.items.some((i) => i.id === "chave-bombas")).toBe(
      true,
    );
  });
  it("estatísticas do GDD: E06 145, E09 40, E14 95, B03 1050", () => {
    expect(enemyStats("E06").hp).toBe(145);
    expect(enemyStats("E06").damage).toBe(23);
    expect(enemyStats("E09").hp).toBe(40);
    expect(enemyStats("E14").hp).toBe(95);
    expect(enemyStats("B03").hp).toBe(1050);
  });
  it("inimigos do capítulo nascem livres de obstáculos; sanguessugas começam submersas", () => {
    const s = newGame();
    for (const id of ADDED_V6) {
      const e = s.enemies[id];
      expect(e, id).toBeTruthy();
      expect(clearPoint(e, rooms[e.room].obstacles, 0.4), id).toBe(true);
      if (e.kind === "E09") expect(e.hidden).toBe(true);
    }
    expect(s.enemies.mergulhador.boss).toBe(true);
  });
  it("submerso não recebe dano", () => {
    const s = newGame();
    const e = s.enemies.sanguessuga01;
    expect(damage(e, "body").damage).toBe(0);
    e.hidden = false;
    expect(damage(e, "body").damage).toBeGreaterThan(0);
  });
  it("P04: a sequência C, C, A, B iguala as três linhas em 4 bar", () => {
    const s = newGame();
    for (const v of [2, 2, 0, 1]) turnPressure(s, v);
    expect(s.pressure).toEqual([4, 4, 4]);
    expect(s.flags.equalizado).toBe(true);
    // Persists through save/load.
    expect(parseSave(JSON.stringify(s)).flags.equalizado).toBe(true);
  });
  it("P04: sobrepressão dispara o alívio e restaura sem travar", () => {
    const s = newGame();
    turnPressure(s, 0); // A 6
    const r = turnPressure(s, 0); // A 8 → alívio
    expect(r.relief).toBe(true);
    expect(s.pressure).toEqual(PRESSURE_START);
    expect(s.flags.equalizado).toBeFalsy();
  });
  it("save 0.11 (contentVersion 5) recebe os inimigos do capítulo 3", () => {
    const s = newGame();
    s.contentVersion = 5;
    for (const id of ADDED_V6) delete s.enemies[id];
    const r = parseSave(JSON.stringify(s));
    expect(r.contentVersion).toBe(6);
    for (const id of ADDED_V6) expect(r.enemies[id], id).toBeTruthy();
  });
  it("rejeita pressão adulterada", () => {
    const s = newGame();
    s.pressure = [4, 4, 99];
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
});
