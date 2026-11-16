import { describe, expect, it } from "vitest";
import {
  newGame,
  damage,
  enemyStats,
  killEnemy,
  corpseOpacity,
  updateCorpses,
  type Enemy,
} from "../src/logic";
import {
  MOVE,
  MOVES,
  PRECEPTORA,
  chooseMove,
  inDanger,
  preceptoraPhase,
  shockPreceptora,
  tickPreceptora,
  type PreceptoraContext,
} from "../src/preceptora-logic";

function boss() {
  const e = newGame().enemies.preceptora;
  e.state = "chase";
  e.timer = 0;
  return e;
}
function ctx(player = { x: 0, z: 0 }, over: Partial<PreceptoraContext> = {}) {
  const hits: number[] = [];
  const cues: string[] = [];
  const c: PreceptoraContext = {
    player,
    maxHp: enemyStats("B02").hp,
    clear: () => true,
    move: (e: Enemy, dx: number, dz: number) => {
      e.x += dx;
      e.z += dz;
    },
    hit: (n) => hits.push(n),
    pull: () => cues.push("pull"),
    cue: (n) => cues.push(n),
    rng: () => 0.5,
    flags: {},
    path: () => ({ x: player.x - 0, z: player.z - 0 }),
    ...over,
  };
  return { c, hits, cues };
}
describe("B02 Preceptora 0.8", () => {
  it("mantém HP 700 e fases do GDD (71 % / 31 %)", () => {
    expect(enemyStats("B02").hp).toBe(700);
    expect(preceptoraPhase(700, 700)).toBe(1);
    expect(preceptoraPhase(490, 700)).toBe(2);
    expect(preceptoraPhase(210, 700)).toBe(3);
  });
  it("cada golpe tem aviso de pelo menos 0,95 s e recuperação", () => {
    for (const m of Object.values(MOVES)) {
      expect(m.windup).toBeGreaterThanOrEqual(0.95);
      expect(m.recover).toBeGreaterThanOrEqual(1.2);
    }
    expect(MOVES[MOVE.TRIPLE].windup).toBeCloseTo(1.3);
    expect(MOVES[MOVE.SPIN].recover).toBeCloseTo(1.5);
    expect(MOVES[MOVE.SPIN].damage).toBe(24);
    expect(MOVES[MOVE.CLEAVE].damage).toBe(30);
  });
  it("escolhe padrões por fase e não repete o mesmo três vezes", () => {
    expect(chooseMove(1, 1.5, () => 0)).toBe(MOVE.SLASH);
    expect([MOVE.TRIPLE, MOVE.SLASH]).toContain(chooseMove(2, 1.5, () => 0.1));
    expect([MOVE.SPIN, MOVE.CLEAVE]).toContain(chooseMove(3, 1.5, () => 0.3));
    expect(chooseMove(3, 1.5, () => 0, [MOVE.SPIN, MOVE.SPIN])).toBe(
      MOVE.CLEAVE,
    );
    expect(chooseMove(1, 9, () => 0.5)).toBe(MOVE.NONE);
  });
  it("zona de perigo: esquiva lateral escapa do puxão e da corrida", () => {
    const e = { x: 0, z: 0, dx: 0, dz: 1 };
    expect(inDanger(e, { x: 0, z: 4 }, MOVE.SHEET)).toBe(true);
    expect(inDanger(e, { x: 1.2, z: 4 }, MOVE.SHEET)).toBe(false);
    expect(inDanger(e, { x: 0, z: -2 }, MOVE.DASH)).toBe(false);
    expect(inDanger(e, { x: -2, z: 0.5 }, MOVE.SPIN)).toBe(true);
    expect(inDanger(e, { x: 0, z: 3.3 }, MOVE.SPIN)).toBe(false);
    expect(inDanger(e, { x: 2, z: 0.2 }, MOVE.CLEAVE)).toBe(false);
  });
  it("ataca só depois do aviso e erra se o jogador saiu da zona", () => {
    const e = boss();
    const player = { x: 0, z: e.z + 2 };
    const { c, hits, cues } = ctx(player);
    tickPreceptora(e, 0.016, c);
    expect(e.state).toBe("windup");
    expect(cues).toContain("telegraph");
    const spec = MOVES[e.attack];
    for (let t = 0; t < spec.windup - 0.05; t += 0.05)
      tickPreceptora(e, 0.05, c);
    expect(hits).toEqual([]);
    player.x = 3.5; // sidestep out of every zone
    for (let t = 0; t < 2; t += 0.05) tickPreceptora(e, 0.05, c);
    expect(hits).toEqual([]);
    expect(["recover", "chase"]).toContain(e.state);
  });
  it("acerta quem fica parado na zona", () => {
    const e = boss();
    const { c, hits } = ctx({ x: 0, z: e.z + 1.6 });
    for (let t = 0; t < 2.6; t += 0.05) tickPreceptora(e, 0.05, c);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toBe(MOVES[MOVE.SLASH].damage);
  });
  it("muda de fase com grito, sem dano, uma vez só, e fecha as placas", () => {
    const e = boss();
    e.hp = 480;
    e.vulnerable = 9;
    const { c, hits, cues } = ctx({ x: 0, z: e.z + 1.5 });
    tickPreceptora(e, 0.016, c);
    expect(e.state).toBe("stun");
    expect(e.attack).toBe(MOVE.ROAR);
    expect(cues).toContain("phase2");
    expect(e.vulnerable).toBe(0);
    for (let t = 0; t < PRECEPTORA.roar - 0.1; t += 0.05)
      tickPreceptora(e, 0.05, c);
    expect(hits).toEqual([]);
    expect(cues.filter((x) => x === "phase2").length).toBe(1);
    expect(c.flags["b02-fase2"]).toBe(true);
  });
  it("gerador: atordoa, abre a armadura 15 s e empurra para longe", () => {
    const e = boss();
    e.x = 3;
    e.z = -5;
    const { c } = ctx();
    shockPreceptora(e, { x: 4, z: -6.2 }, c.move);
    expect(e.vulnerable).toBe(15);
    expect(e.state).toBe("stun");
    expect(e.attack).toBe(MOVE.SHOCK);
    expect(Math.hypot(e.x - 4, e.z + 6.2)).toBeGreaterThan(
      Math.hypot(3 - 4, -5 + 6.2) + 0.5,
    );
    const hp = e.hp;
    damage(e, "body");
    expect(hp - e.hp).toBeCloseTo(55);
    e.vulnerable = 0;
    const hp2 = e.hp;
    damage(e, "body");
    expect(hp2 - e.hp).toBe(3);
  });
  it("corrida que bate no leito deixa a lâmina presa (abertura maior)", () => {
    const e = boss();
    const player = { x: 0, z: e.z + 4 };
    const { c, cues } = ctx(player, {
      move: () => undefined,
      rng: () => 0.2,
    });
    e.state = "windup";
    e.attack = MOVE.DASH;
    e.timer = 0.01;
    e.dx = 0;
    e.dz = 1;
    tickPreceptora(e, 0.02, c);
    tickPreceptora(e, 0.02, c);
    expect(e.state).toBe("recover");
    expect(e.timer).toBeGreaterThan(MOVES[MOVE.DASH].recover);
    expect(cues).toContain("stuck");
  });
  it("cadáver da Preceptora fica 12 s (morte legível); zumbis seguem 5 s", () => {
    const s = newGame();
    const e = s.enemies.preceptora;
    killEnemy(e, 1000);
    expect(corpseOpacity(e, 6000)).toBe(1);
    updateCorpses(s, 12999);
    expect(e.removed).toBe(false);
    updateCorpses(s, 13000);
    expect(e.removed).toBe(true);
  });
  it("depois de acertar, pausa mais longa (sem encadear golpes)", () => {
    const e = boss();
    const { c, hits } = ctx({ x: 0, z: e.z + 1.6 });
    let t = 0;
    while (!hits.length && t < 4) {
      tickPreceptora(e, 0.05, c);
      t += 0.05;
    }
    expect(hits.length).toBe(1);
    while (e.state !== "chase" && t < 8) {
      tickPreceptora(e, 0.05, c);
      t += 0.05;
    }
    expect(e.timer).toBeCloseTo(PRECEPTORA.breatherAfterHit, 1);
  });
});
