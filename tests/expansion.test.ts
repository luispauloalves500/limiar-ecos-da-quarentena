import { describe, it, expect } from "vitest";
import {
  newGame,
  damage,
  killEnemy,
  corpseOpacity,
  updateCorpses,
  collect,
  isCollected,
  parseSave,
  Travel,
  validateGraph,
  turnValve,
  enemyStats,
  enemyPattern,
} from "../src/logic";
import { rooms, doors, endpoint, inward, clearPoint } from "../src/world";
describe("cadáveres: prazo absoluto de cinco segundos", () => {
  for (const id of ["errante01", "enfermeiro01", "febril01", "porteiro"]) {
    it(`${id}: animação/fade e remoção sem corte ou exceção`, () => {
      const s = newGame(),
        e = s.enemies[id];
      e.crawl = !e.boss;
      killEnemy(e, 10000);
      expect(corpseOpacity(e, 14000)).toBe(1);
      expect(corpseOpacity(e, 14750)).toBeCloseTo(0.5);
      updateCorpses(s, 14999);
      expect(e.removed).toBe(false);
      updateCorpses(s, 15000);
      expect(e.removed).toBe(true);
      expect(corpseOpacity(e, 15000)).toBe(0);
      expect(s.items).toEqual([]);
      expect(rooms.corredor.items.length).toBeGreaterThan(0);
    });
  }
  it("morte repetida não reinicia relógio", () => {
    const e = newGame().enemies.errante01;
    killEnemy(e, 100);
    killEnemy(e, 4000);
    expect(e.deathAt).toBe(100);
  });
  it("dano letal inicia o prazo e morto não pode receber outro impacto", () => {
    const e = newGame().enemies.errante01;
    e.hp = 1;
    damage(e, "head");
    expect(e.deathAt).toBeGreaterThan(0);
    expect(damage(e, "body").damage).toBe(0);
  });
  it("remoção persiste em save, sala distante e recarregamento", () => {
    const s = newGame();
    killEnemy(s.enemies.porteiro, 1);
    updateCorpses(s, 5001);
    const r = parseSave(JSON.stringify(s));
    expect(r.enemies.porteiro.removed).toBe(true);
    expect(r.enemies.porteiro.dead).toBe(true);
  });
});
describe("coletáveis: uma origem de verdade", () => {
  for (const kind of ["document", "ammo", "herb", "battery", "fuse", "key"]) {
    it(`${kind}: coleta única e persistência`, () => {
      const s = newGame(),
        item = Object.values(rooms)
          .flatMap((r) => r.items)
          .find((i) => i.kind === kind)!;
      expect(collect(s, item)).toBe(true);
      expect(isCollected(s, item.id)).toBe(true);
      const snapshot = JSON.stringify(s);
      expect(collect(s, item)).toBe(false);
      expect(JSON.stringify(s)).toBe(snapshot);
      const r = parseSave(snapshot);
      expect(isCollected(r, item.id)).toBe(true);
      if (kind === "document") expect(r.docs).toContain(item.id);
    });
  }
  it("migra documentos lidos na 0.2 sem respawn", () => {
    const s = newGame();
    s.docs = ["carta"];
    s.items = [];
    const r = parseSave(JSON.stringify(s));
    expect(r.items).toContain("carta");
  });
});
describe("expansão e migração", () => {
  it("12 salas, duas seguras, todas as portas com spawns válidos", () => {
    expect(Object.keys(rooms)).toHaveLength(12);
    expect(Object.values(rooms).filter((r) => r.safe)).toHaveLength(2);
    expect(validateGraph()).toBe(true);
  });
  it("todas as novas salas são alcançáveis no grafo", () => {
    const seen = new Set(["recepcao"]);
    for (let n = 0; n < 20; n++)
      for (const d of doors)
        if (seen.has(d.a) || seen.has(d.b)) {
          seen.add(d.a);
          seen.add(d.b);
        }
    expect(seen.size).toBe(12);
  });
  it("atravessa todas as portas nos dois sentidos preservando coleta/mortos", async () => {
    const s = newGame(),
      t = new Travel();
    s.flags = {
      chave: true,
      energia: true,
      boss: true,
      pulseira: true,
      pressao: true,
    };
    collect(s, rooms.recepcao.items[0]);
    killEnemy(s.enemies.errante01, 1);
    updateCorpses(s, 5001);
    for (const d of doors)
      for (const id of [d.a, d.b]) {
        s.room = id;
        s.player = { ...inward(endpoint(d, id).position), hp: 100, yaw: 0 };
        expect(await t.go(s, d, async () => {})).toBe(true);
        expect(clearPoint(s.player, rooms[s.room].obstacles)).toBe(true);
        expect(s.items).toContain("carta");
        expect(s.enemies.errante01.removed).toBe(true);
      }
  });
  it("migra save v1 anterior com apenas os quatro inimigos originais", () => {
    const s = newGame();
    delete s.contentVersion;
    for (const id of Object.keys(s.enemies))
      if (!["errante01", "errante02", "errante03", "porteiro"].includes(id))
        delete s.enemies[id];
    const r = parseSave(JSON.stringify(s));
    expect(r.enemies.enfermeiro01.kind).toBe("E02");
    expect(r.enemies.febril01.hp).toBe(65);
  });
  it("ordem 3-1-2 reinicia se errada e persiste entre etapas", () => {
    let s = newGame();
    turnValve(s, 1);
    expect(s.flags.valve1).toBe(false);
    turnValve(s, 3);
    s = parseSave(JSON.stringify(s));
    turnValve(s, 1);
    turnValve(s, 2);
    expect(s.flags.pressao).toBe(true);
  });
  it("inimigos têm padrões próprios e rastejo cancela investida", () => {
    const s = newGame(),
      n = s.enemies.enfermeiro01,
      f = s.enemies.febril01;
    expect(enemyStats(n.kind).hp).toBe(85);
    expect(enemyPattern(n, 1.5).feint).toBe(true);
    expect(enemyPattern(f, 4).charge).toBe(true);
    damage(f, "legL");
    damage(f, "legL");
    expect(f.crawl).toBe(true);
    expect(enemyPattern(f, 4).charge).toBe(false);
  });
});
