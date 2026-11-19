import { describe, it, expect } from "vitest";
import {
  advancePhase,
  crawlerPose,
  crawlerState,
  gaitLimb,
  blendPose,
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
    expect(r.contentVersion).toBe(6);
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
  it("quatro tempos: cada membro fica 30% do ciclo no ar, um quarto de ciclo após o anterior", () => {
    const lifted = [0, 0, 0, 0];
    let maxUp = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const p = (i / N) * Math.PI * 2;
      const up = LIMB_OFFSETS.map((o) => gaitLimb(p, o).lift > 0.01);
      up.forEach((u, n) => (lifted[n] += u ? 1 : 0));
      maxUp = Math.max(maxUp, up.filter(Boolean).length);
    }
    for (const n of lifted) expect(n / N).toBeCloseTo(0.3, 1);
    expect(maxUp).toBeLessThanOrEqual(2);
    // Swing forward while lifted, planted push back at constant speed.
    const mid = gaitLimb(0.3 * Math.PI, 0);
    expect(mid.lift).toBeCloseTo(1);
    const a = gaitLimb(Math.PI, 0).swing,
      b = gaitLimb(Math.PI + 0.2, 0).swing,
      c = gaitLimb(Math.PI + 0.4, 0).swing;
    expect(a - b).toBeCloseTo(b - c, 5);
  });
  it("transição de estado é suavizada (sem estalo)", () => {
    const crawl = crawlerPose({ ...base, state: "crawl" }),
      windup = crawlerPose({ ...base, state: "windup", age: 0.55 }),
      step = blendPose(crawl, windup, 1 / 60, 12);
    expect(Math.abs(step.pitch - crawl.pitch)).toBeLessThan(
      Math.abs(windup.pitch - crawl.pitch) * 0.25,
    );
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
