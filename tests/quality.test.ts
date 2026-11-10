import { animationVariation } from "../src/presentation";
import { describe, it, expect } from "vitest";
import { newGame } from "../src/logic";
import { shove } from "../src/gameplay";
import { soundPlan, type SoundKind } from "../src/sound-design";
import { TitleScene } from "../src/title";
import { Texture } from "three";
import renderSource from "../src/render.ts?raw";
import detailsSource from "../src/details.ts?raw";
import environmentSource from "../src/environment.ts?raw";
describe("qualidade 0.5", () => {
  it.each([
    "shot",
    "reload",
    "door",
    "flesh",
    "head",
    "shove",
    "grunt",
    "breath",
    "step",
    "ui",
  ] as SoundKind[])("%s tem envelopes finitos e mix seguro", (kind) => {
    const plan = soundPlan(kind);
    expect(plan.length).toBeGreaterThan(0);
    for (const l of plan) {
      expect(l.duration).toBeGreaterThan(0);
      expect(l.duration).toBeLessThan(1);
      expect(l.volume).toBeLessThanOrEqual(1);
      expect(l.delay).toBeGreaterThanOrEqual(0);
      expect(["effects", "music", "voices"]).toContain(l.bus);
    }
  });
  it("recarga tem etapas ordenadas e voz usa canal próprio", () => {
    expect(soundPlan("reload").map((l) => l.delay)).toEqual([
      0, 0.3, 0.78, 0.94,
    ]);
    expect(soundPlan("grunt").every((l) => l.bus === "voices")).toBe(true);
  });
  it("empurrão frontal não causa dano, respeita boss, costas e cadáver", () => {
    const s = newGame(),
      e = Object.values(s.enemies)[0];
    e.room = s.room;
    e.x = 0;
    e.z = 4;
    s.player.yaw = Math.PI;
    const hp = e.hp;
    expect(shove(s)).toContain(e.id);
    expect(e.hp).toBe(hp);
    expect(e.state).toBe("stun");
    expect(e.z).toBeLessThan(4);
    e.boss = true;
    expect(shove(s)).toEqual([]);
    e.boss = false;
    e.z = 6;
    expect(shove(s)).toEqual([]);
    e.z = 4;
    e.dead = true;
    expect(shove(s)).toEqual([]);
  });
  it("título tem câmera animada e chuva com orçamento por perfil", () => {
    const t = new TitleScene(new Texture(), new Texture());
    t.update(1, 1.6, true);
    expect(t.rain.geometry.drawRange.count).toBe(60);
    expect(t.camera.aspect).toBe(1.6);
    const x = t.camera.position.x;
    t.update(2, 1.6, false);
    expect(t.camera.position.x).not.toBe(x);
    expect(t.rain.geometry.drawRange.count).toBe(180);
    expect(t.lamp.intensity).toBeGreaterThan(25);
  });
  it("só restam números pequenos nas portas; prosa não é desenhada no mundo", () => {
    const render = renderSource;
    expect(render.match(/label\(/g)?.length).toBe(1);
    expect(render).toContain("d.id.replace");
    expect(detailsSource).not.toContain("label(");
    expect(environmentSource).not.toContain("label(");
  });
});

it("ritmo dos zumbis é estável por ID e não sincroniza clones", () => {
  const a = animationVariation("Z01"),
    b = animationVariation("Z02");
  expect(a).toEqual(animationVariation("Z01"));
  expect(a.phase).not.toBe(b.phase);
  expect(a.speed).toBeGreaterThanOrEqual(0.92);
  expect(a.speed).toBeLessThan(1.08);
});
