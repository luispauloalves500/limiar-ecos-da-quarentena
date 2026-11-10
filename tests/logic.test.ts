import { describe, it, expect } from "vitest";
import {
  newGame,
  damage,
  drainBattery,
  applyLight,
  Travel,
  InputLatch,
  parseSave,
  writeSave,
  SAVE_KEY,
  validateGraph,
} from "../src/logic";
import {
  doors,
  rooms,
  endpoint,
  inward,
  clearPoint,
  lineClear,
} from "../src/world";
describe("dano localizado e morte", () => {
  it("tronco recebe exatamente 22", () => {
    const e = newGame().enemies.errante01;
    damage(e, "body", () => 1);
    expect(e.hp).toBe(48);
  });
  it("cabeça aplica 1,8× uma única vez", () => {
    const e = newGame().enemies.errante01;
    damage(e, "head", () => 1);
    expect(e.hp).toBeCloseTo(30.4);
  });
  it("dois tiros de cabeça matam sem crítico", () => {
    const e = newGame().enemies.errante01;
    damage(e, "head", () => 1);
    damage(e, "head", () => 1);
    expect(e.dead).toBe(true);
  });
  it("crítico craniano elegível mata", () => {
    const e = newGame().enemies.errante01;
    expect(damage(e, "head", () => 0).critical).toBe(true);
    expect(e.headGone).toBe(true);
  });
  it("tiro no corpo não sorteia crítico", () => {
    let calls = 0;
    damage(newGame().enemies.errante01, "body", () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(0);
  });
  it("tiro já letal não sorteia crítico", () => {
    const e = newGame().enemies.errante01;
    e.hp = 10;
    let calls = 0;
    damage(e, "head", () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(0);
  });
  it("duas balas na mesma perna convertem em rastejador", () => {
    const e = newGame().enemies.errante01;
    damage(e, "legL");
    expect(e.crawl).toBe(false);
    damage(e, "legL");
    expect(e.crawl).toBe(true);
    expect(e.hp).toBeCloseTo(34.8);
    expect(e.right).toBe(42);
  });
  it("pernas mantêm integridade independente", () => {
    const e = newGame().enemies.errante01;
    damage(e, "legL");
    damage(e, "legR");
    expect(e.crawl).toBe(false);
    expect(e.left).toBe(20);
    expect(e.right).toBe(20);
  });
  it("morte tem prioridade sobre rastejo", () => {
    const e = newGame().enemies.errante01;
    e.hp = 10;
    damage(e, "legL");
    expect(e.dead).toBe(true);
    expect(e.crawl).toBe(false);
  });
  it("inimigo morto ignora novas balas", () => {
    const e = newGame().enemies.errante01;
    e.hp = 0;
    e.dead = true;
    expect(damage(e, "head").damage).toBe(0);
  });
  it("chefe nunca recebe crítico letal nem rastejo comum", () => {
    const e = newGame().enemies.porteiro;
    damage(e, "head", () => 0);
    damage(e, "legL", () => 0);
    expect(e.hp).toBe(554);
    expect(e.crawl).toBe(false);
  });
  it("chefe exposto recebe dano de núcleo", () => {
    const e = newGame().enemies.porteiro;
    e.vulnerable = 4;
    damage(e, "head", () => 0);
    expect(e.hp).toBe(505);
  });
  it("combo luminoso aumenta estrutura, não dano de HP", () => {
    const e = newGame().enemies.errante01;
    damage(e, "legL", () => 1, true);
    expect(e.hp).toBeCloseTo(52.4);
    expect(e.left).toBe(14.5);
  });
});
describe("lanterna", () => {
  it("normal consome 0,45/s", () =>
    expect(drainBattery(100, 10, true, false)).toBe(95.5));
  it("foco consome 2,2/s", () =>
    expect(drainBattery(100, 10, true, true)).toBe(78));
  it("desligada não consome", () =>
    expect(drainBattery(100, 10, false, true)).toBe(100));
  it("não fica negativa", () =>
    expect(drainBattery(0.1, 1, true, true)).toBe(0));
  it("consumo é independente da taxa de quadros", () => {
    for (const rate of [30, 60, 120]) {
      let c = 100;
      for (let i = 0; i < rate * 10; i++)
        c = drainBattery(c, 1 / rate, true, true);
      expect(c).toBeCloseTo(78, 8);
    }
  });
  it("fora do feixe não causa dano", () => {
    const e = newGame().enemies.errante01;
    applyLight(e, 1, false, true);
    expect(e.hp).toBe(70);
    expect(e.exposure).toBe(0);
  });
  it("foco acumula exposição e interrompe", () => {
    const e = newGame().enemies.errante01;
    for (let i = 0; i < 140; i++) applyLight(e, 1 / 60, true, true);
    expect(e.state).toBe("stun");
    expect(e.lightCooldown).toBeGreaterThan(6);
  });
  it("não entra em stun infinito", () => {
    const e = newGame().enemies.errante01;
    let stuns = 0;
    for (let i = 0; i < 300; i++)
      if (applyLight(e, 1 / 60, true, true)) stuns++;
    expect(stuns).toBe(1);
  });
  it("chefes não sofrem morte pela luz", () => {
    const e = newGame().enemies.porteiro;
    applyLight(e, 1000, true, true);
    expect(e.hp).toBe(560);
  });
  it("luz letal marca morte sem crítico ou rastejo", () => {
    const e = newGame().enemies.errante01;
    e.hp = 1;
    applyLight(e, 1, true, true);
    expect(e.dead).toBe(true);
    expect(e.headGone).toBe(false);
  });
});
describe("grafo e transações de porta", () => {
  it("todas as extremidades e spawns são válidos", () =>
    expect(validateGraph()).toBe(true));
  it("porta bloqueada não carrega nem muda sala", async () => {
    const s = newGame();
    s.room = "corredor";
    let count = 0;
    expect(
      await new Travel().go(s, doors[3], async () => {
        count++;
      }),
    ).toBe(false);
    expect(count).toBe(0);
    expect(s.room).toBe("corredor");
  });
  it("100 travessias mantêm estado e posição bidirecional", async () => {
    const s = newGame();
    s.items = ["rec-ammo"];
    s.enemies.errante01.dead = true;
    s.enemies.errante01.hp = 0;
    const t = new Travel();
    for (let i = 0; i < 100; i++) {
      const expected = endpoint(doors[0], s.room);
      expect(await t.go(s, doors[0], async () => {})).toBe(true);
      expect(s.room).toBe(expected.to);
      expect(s.player.x).toBe(inward(expected.spawn).x);
      expect(s.player.z).toBe(inward(expected.spawn).z);
    }
    expect(s.room).toBe("recepcao");
    expect(s.items).toEqual(["rec-ammo"]);
    expect(s.enemies.errante01.dead).toBe(true);
  });
  it("falha no carregamento preserva origem e libera input", async () => {
    const s = newGame(),
      before = JSON.stringify(s),
      t = new Travel();
    await expect(
      t.go(s, doors[0], async () => {
        throw Error("404");
      }),
    ).rejects.toThrow("404");
    expect(JSON.stringify(s)).toBe(before);
    expect(t.active).toBe(false);
  });
  it("solicitação duplicada não faz commit duplo", async () => {
    const s = newGame(),
      t = new Travel();
    let finish = () => {};
    const p = t.go(s, doors[0], () => new Promise<void>((r) => (finish = r)));
    expect(await t.go(s, doors[0], async () => {})).toBe(false);
    expect(s.room).toBe("recepcao");
    finish();
    await p;
    expect(s.room).toBe("corredor");
  });
  it("porta de outra sala não funciona", async () => {
    expect(await new Travel().go(newGame(), doors[1], async () => {})).toBe(
      false,
    );
  });
  it("destino só muda após readiness", async () => {
    const s = newGame();
    let ready = () => {};
    const p = new Travel().go(
      s,
      doors[0],
      () => new Promise<void>((r) => (ready = r)),
    );
    expect(s.room).toBe("recepcao");
    ready();
    await p;
    expect(s.room).toBe("corredor");
  });
});
describe("save versionado", () => {
  it("roundtrip preserva munição, luz e inimigos", () => {
    const s = newGame();
    s.battery = 12.4;
    s.items = ["carta"];
    damage(s.enemies.errante01, "legL");
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it.each([null, {}, { version: 999 }, { version: 1, room: "nao-existe" }])(
    "rejeita schema inválido %j",
    (value) => expect(() => parseSave(JSON.stringify(value))).toThrow(),
  );
  it("rejeita save truncado", () => expect(() => parseSave("{")).toThrow());
  it("rejeita HP inválido sem tocar armazenamento", () => {
    const s = newGame();
    s.player.hp = -1;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it("rejeita inimigo ausente", () => {
    const s = newGame();
    delete s.enemies.errante01;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it("rejeita posição dentro de mobília", () => {
    const s = newGame();
    s.player.x = -2;
    s.player.z = -1;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it("mantém backup do slot anterior", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) || null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const s = newGame();
    writeSave(s, storage);
    const old = map.get(SAVE_KEY);
    s.battery = 5;
    writeSave(s, storage);
    expect(map.get(SAVE_KEY + "-backup")).toBe(old);
    expect(parseSave(map.get(SAVE_KEY)!).battery).toBe(5);
  });
});
describe("câmera, colisões e visibilidade", () => {
  it("input permanece no mundo durante corte", () => {
    const l = new InputLatch();
    expect(l.get("W", () => ({ x: 1, z: 0 }))).toEqual({ x: 1, z: 0 });
    expect(l.get("W", () => ({ x: -1, z: 0 }))).toEqual({ x: 1, z: 0 });
    l.get("", () => ({ x: 0, z: 0 }));
    expect(l.get("W", () => ({ x: -1, z: 0 }))).toEqual({ x: -1, z: 0 });
  });
  it("alterar direção atualiza vetor", () => {
    const l = new InputLatch();
    l.get("W", () => ({ x: 1, z: 0 }));
    expect(l.get("D", () => ({ x: 0, z: 1 }))).toEqual({ x: 0, z: 1 });
  });
  it("obstáculos barram balas e luz", () =>
    expect(
      lineClear({ x: -2, z: 3 }, { x: -2, z: -4 }, rooms.recepcao.obstacles),
    ).toBe(false));
  it("corredor livre permite visibilidade", () =>
    expect(
      lineClear({ x: 0, z: 6 }, { x: 0, z: -6 }, rooms.corredor.obstacles),
    ).toBe(true));
  it("parede externa bloqueia movimento", () =>
    expect(clearPoint({ x: 8, z: 0 }, [])).toBe(false));
});
