import { describe, it, expect } from "vitest";
import * as T from "three";
import renderSource from "../src/render.ts?raw";
import bakeSource from "../src/bake.ts?raw";
import {
  bakeStatic,
  bakeVertex,
  mergeable,
  type BakeOptions,
} from "../src/bake";
import {
  architecture,
  looks,
  segments,
  HALF_X,
  HALF_Z,
} from "../src/architecture";
import { rooms } from "../src/world";

const opts: BakeOptions = {
  lights: [{ x: 0, y: 2.6, z: 0, color: 0xffffff, intensity: 1, range: 5 }],
  halfX: HALF_X,
  halfZ: HALF_Z,
  height: 4,
  damp: 0.4,
  tint: 0xffffff,
};
const box = (x: number, z: number, color: number, m?: T.Material) => {
  const mesh = new T.Mesh(
    new T.BoxGeometry(0.5, 0.5, 0.5),
    m || new T.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.set(x, 0.25, z);
  return mesh;
};

describe("cenários 0.6: bake de AO/luz e merge estático", () => {
  it("AO por vértice fica no intervalo e escurece o encontro com o piso", () => {
    const out = new T.Color(),
      light = new T.Color();
    bakeVertex(
      new T.Vector3(0, 0.02, 0),
      new T.Vector3(1, 0, 0),
      opts,
      out,
      light,
    );
    const low = out.r;
    bakeVertex(
      new T.Vector3(0, 2, 0),
      new T.Vector3(1, 0, 0),
      opts,
      out,
      light,
    );
    expect(low).toBeLessThan(out.r);
    for (const v of [low, out.r]) {
      expect(v).toBeGreaterThanOrEqual(0.2);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Baked light: faces toward the light receive it; faces away do not.
    bakeVertex(
      new T.Vector3(1, 2.6, 0),
      new T.Vector3(-1, 0, 0),
      opts,
      out,
      light,
    );
    const facing = light.r;
    expect(facing).toBeGreaterThan(0.2);
    // Faces away get only the soft wrap term (bounce), never full light.
    bakeVertex(
      new T.Vector3(1, 2.6, 0),
      new T.Vector3(1, 0, 0),
      opts,
      out,
      light,
    );
    expect(light.r).toBeLessThan(facing * 0.4);
    // Out of range: nothing.
    bakeVertex(
      new T.Vector3(6, 0.5, 8),
      new T.Vector3(0, 1, 0),
      opts,
      out,
      light,
    );
    expect(light.r).toBe(0);
  });
  it("funde estáticos por material sem mudar o volume, e preserva cores", () => {
    const g = new T.Group();
    g.add(box(-2, 0, 0xff0000), box(2, 0, 0x00ff00), box(0, 3, 0x0000ff));
    const before = new T.Box3().setFromObject(g);
    const r = bakeStatic(g, opts);
    expect(r.sources).toHaveLength(3);
    expect(r.merged).toHaveLength(1);
    const after = new T.Box3().setFromObject(g);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-5);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-5);
    const m = r.merged[0];
    expect((m.material as T.MeshStandardMaterial).vertexColors).toBe(true);
    expect(m.geometry.getAttribute("bakedLight")).toBeTruthy();
    const c = m.geometry.getAttribute("color");
    let red = 0,
      green = 0;
    for (let i = 0; i < c.count; i++) {
      if (c.getX(i) > c.getY(i) * 2) red++;
      if (c.getY(i) > c.getX(i) * 2) green++;
    }
    expect(red).toBeGreaterThan(0);
    expect(green).toBeGreaterThan(0);
  });
  it("não funde transparentes, instanciados, marcadores nem dinâmicos", () => {
    const glass = box(
      0,
      0,
      0xffffff,
      new T.MeshStandardMaterial({ transparent: true, opacity: 0.4 }),
    );
    const inst = new T.InstancedMesh(
      new T.BoxGeometry(),
      new T.MeshStandardMaterial(),
      3,
    );
    const marker = box(1, 1, 0xffffff);
    marker.name = "pickup-marker";
    const dyn = box(2, 2, 0xffffff);
    dyn.userData.dynamic = true;
    const ex = box(3, 3, 0xffffff);
    for (const o of [glass, inst, marker, dyn])
      expect(mergeable(o, new Set())).toBe(false);
    expect(mergeable(ex, new Set([ex]))).toBe(false);
    expect(mergeable(box(0, 0, 1), new Set())).toBe(true);
  });
  it("arquitetura cobre todas as salas com identidade própria e vãos de porta", () => {
    expect(Object.keys(looks).sort()).toEqual(Object.keys(rooms).sort());
    const ids = new Set(
      Object.values(looks).map((l) => `${l.tint}/${l.band}/${l.trim}`),
    );
    expect(ids.size).toBe(Object.keys(rooms).length);
    for (const id of Object.keys(rooms) as (keyof typeof rooms)[]) {
      const a = architecture(id, [
        [4, -5],
        [-4, 4],
      ]);
      expect(a.walls).toHaveLength(4);
      expect(a.walls.flat().length).toBeGreaterThan(4);
      expect(a.lights.length).toBeGreaterThanOrEqual(2);
      // Nothing procedural may carry text (v0.5 rule).
      for (const o of [...a.room, ...a.ceiling, ...a.walls.flat()])
        o.traverse((c) => expect(c.userData.worldLabel).toBeUndefined());
    }
    expect(segments(-5, 5, [0])).toEqual([
      [-5, -1.1],
      [1.1, 5],
    ]);
  });
  it("render troca luzes de porta dinâmicas por luz assada", () => {
    const src = renderSource;
    expect(src).not.toContain("PointLight(0x94b99b");
    expect(src).toContain("bakeRoom(");
    expect(src).not.toContain("TEMP-EXP");
    expect(bakeSource).not.toContain("TEMP-EXP");
  });
  it("luz assada tem teto e a parede tem desgaste, não uma laje lisa", () => {
    const out = new T.Color(),
      light = new T.Color();
    // A vertex sitting on top of a very bright lamp must still be capped.
    bakeVertex(
      new T.Vector3(0, 2.6, 0),
      new T.Vector3(0, 1, 0),
      {
        ...opts,
        lights: [
          { x: 0, y: 2.6, z: 0, color: 0xffffff, intensity: 8, range: 8 },
        ],
      },
      out,
      light,
    );
    expect(light.r).toBeLessThanOrEqual(0.78 + 1e-9);
    // Two mid-wall vertices a short distance apart are not identical.
    const a = new T.Color(),
      b = new T.Color();
    bakeVertex(new T.Vector3(2, 1.4, -3), new T.Vector3(1, 0, 0), opts, a);
    bakeVertex(new T.Vector3(-4.8, 2.2, 5.1), new T.Vector3(1, 0, 0), opts, b);
    expect(
      Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b),
    ).toBeGreaterThan(0.01);
  });
});
