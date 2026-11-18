import { describe, it, expect } from "vitest";
import {
  advancePhase,
  crawlerPose,
  crawlerState,
  gaitLimb,
  CRAWLER_STRIDE,
  LIMB_OFFSETS,
  type CrawlerInput,
} from "../src/crawler-pose";
import { newGame, parseSave, ADDED_V5, enemyStats } from "../src/logic";
import { rooms, clearPoint } from "../src/world";
import { CHAPTER2 } from "../src/smartrig";

const base: CrawlerInput = {
  state: "crawl",
  phase: 0,
  age: 0,
  hitAge: 99,
  hitSide: 1,
  clock: 0,
  seed: 0.3,
};

describe("rastejador do berçário (0.9)", () => {
  it("existe no berçário, fora dos berços, com stats E05 da 0.8", () => {
    const s = newGame(),
      e = s.enemies.rastejador05;
    expect(e.kind).toBe("E05");
    expect(e.room).toBe("bercario");
    expect(e.crawl).toBe(true);
    expect(clearPoint(e, rooms.bercario.obstacles)).toBe(true);
    expect(enemyStats("E05")).toMatchObject({
      hp: 48,
      damage: 12,
      windup: 0.55,
    });
    expect(CHAPTER2.has("bercario")).toBe(true);
  });
  it("save 0.8 (contentVersion 4) recebe o rastejador novo", () => {
    const s = newGame();
    s.contentVersion = 4;
    for (const id of ADDED_V5) delete s.enemies[id];
    const r = parseSave(JSON.stringify(s));
    expect(r.contentVersion).toBe(5);
    expect(r.enemies.rastejador05.room).toBe("bercario");
  });
  it("save 0.9 sem o rastejador continua inválido (sem remendo silencioso)", () => {
    const s = newGame();
    delete s.enemies.rastejador05;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it("a fase do passo avança pela distância percorrida (sem deslizar)", () => {
    expect(advancePhase(0, CRAWLER_STRIDE / 2)).toBeCloseTo(Math.PI);
    expect(advancePhase(0, 0)).toBe(0);
    expect(advancePhase(1, CRAWLER_STRIDE)).toBeCloseTo(1);
  });
  it("pares diagonais alternam: um levanta enquanto o outro apoia", () => {
    expect(LIMB_OFFSETS[0]).toBe(LIMB_OFFSETS[3]);
    expect(LIMB_OFFSETS[1]).toBe(LIMB_OFFSETS[2]);
    for (let p = 0; p < Math.PI * 2; p += 0.3) {
      const a = gaitLimb(p, LIMB_OFFSETS[0]),
        b = gaitLimb(p, LIMB_OFFSETS[1]);
      expect(Math.min(a.lift, b.lift)).toBe(0);
    }
    // Swing forward only while lifted: forward motion at mid-swing.
    const mid = gaitLimb(Math.PI / 2, 0);
    expect(mid.lift).toBeCloseTo(1);
    expect(gaitLimb(Math.PI, 0).swing).toBeGreaterThan(0.9);
  });
  it("aviso ergue a frente; o golpe joga o corpo para frente", () => {
    const w = crawlerPose({ ...base, state: "windup", age: 0.55 });
    expect(w.pitch).toBeLessThan(-0.3);
    expect(w.limbs[0].lift).toBeGreaterThan(0.5);
    const strike = crawlerPose({ ...base, state: "recover", age: 0.22 });
    expect(strike.lunge).toBeGreaterThan(0.3);
    const settled = crawlerPose({ ...base, state: "recover", age: 1.2 });
    expect(Math.abs(settled.lunge)).toBeLessThan(0.01);
  });
  it("tiro dá um tranco que some em menos de meio segundo", () => {
    const hit = crawlerPose({ ...base, state: "idle", hitAge: 0.15 });
    const calm = crawlerPose({ ...base, state: "idle", hitAge: 0.6 });
    expect(hit.headPitch).toBeLessThan(calm.headPitch - 0.2);
  });
  it("morte: desaba e tomba de lado, progresso 0 → 1", () => {
    const a = crawlerPose({ ...base, state: "dead", age: 0 });
    const b = crawlerPose({ ...base, state: "dead", age: 2 });
    expect(a.death).toBe(0);
    expect(b.death).toBe(1);
    expect(b.limbs.every((l) => l.curl > 0.5)).toBe(true);
  });
  it("estado do jogo → estado da animação", () => {
    expect(crawlerState({ dead: true, state: "chase" }, 1)).toBe("dead");
    expect(crawlerState({ dead: false, state: "windup" }, 0)).toBe("windup");
    expect(crawlerState({ dead: false, state: "chase" }, 0.8)).toBe("crawl");
    expect(crawlerState({ dead: false, state: "chase" }, 0)).toBe("idle");
    expect(crawlerState({ dead: false, state: "stun" }, 0)).toBe("stun");
  });
});
