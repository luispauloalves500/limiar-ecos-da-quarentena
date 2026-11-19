// 0.12: chapter 3 (GDD §8 "Centro cirúrgico e estação hídrica") — static
// dressing for the seven new rooms plus the few dynamic pieces (water level,
// acid spit and pools, B03 bubbles, P04 gauge needles, elevator gear).
// Static meshes go through bake.ts like every other room (vertex light, a
// handful of merged draws); dynamic ones are a single small group.
import * as T from "three";
import { box, capsule, material as mat } from "./art";
import type { GameState } from "./logic";
import { PRESSURE_START } from "./logic";
import type { RoomId } from "./world";

export const CHAPTER3 = new Set<RoomId>([
  "lavabo",
  "cirurgia",
  "esterilizacao",
  "bombas",
  "drenos",
  "reservatorio",
  "elevador",
]);
type Obstacle = { x: number; z: number; w: number; d: number };
type Tex = { rust: T.Texture; wall: T.Texture };
const lampMat = (c: number) => new T.MeshBasicMaterial({ color: c });
function cyl(
  r: number,
  h: number,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  seg = 14,
) {
  const c = new T.Mesh(new T.CylinderGeometry(r, r, h, seg), m);
  c.position.set(x, y, z);
  c.castShadow = c.receiveShadow = true;
  return c;
}
function wheel(m: T.Material, r = 0.32) {
  const g = new T.Group();
  const rim = new T.Mesh(new T.TorusGeometry(r, r * 0.12, 6, 18), m);
  g.add(rim);
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const s = new T.Mesh(new T.BoxGeometry(r * 2, r * 0.12, r * 0.12), m);
    s.rotation.z = a;
    g.add(s);
  }
  g.add(
    new T.Mesh(
      new T.CylinderGeometry(r * 0.22, r * 0.22, r * 0.4, 10),
      m,
    ).rotateX(Math.PI / 2),
  );
  return g;
}
/** Furniture for one blocking footprint (replaces the generic crate). */
export function dressObstacle3(
  id: RoomId,
  o: Obstacle,
  index: number,
  addObstacle: (m: T.Mesh) => T.Mesh,
  group: T.Group,
  tex: Tex,
) {
  const steel = mat(0x8e9a98, 0.35, 0.75),
    dull = mat(0x56635f, 0.6, 0.5, tex.rust),
    concrete = mat(0x6f7872, 0.95, 0, tex.wall);
  if (id === "lavabo") {
    // Scrub trough: steel basin, tiled splashback, three knee taps.
    addObstacle(box(o.w, 0.86, o.d, mat(0x7d8b88, 0.45, 0.6), o.x, 0.43, o.z));
    group.add(box(o.w + 0.06, 0.06, o.d + 0.06, steel, o.x, 0.9, o.z));
    group.add(
      box(o.w - 0.2, 0.05, o.d - 0.25, mat(0x2b3433, 0.3, 0.6), o.x, 0.88, o.z),
    );
    group.add(
      box(
        o.w,
        0.7,
        0.06,
        mat(0xd8e6e2, 0.4, 0.1),
        o.x,
        1.28,
        o.z - o.d / 2 + 0.03,
      ),
    );
    for (let k = -1; k <= 1; k++) {
      const tap = capsule(0.025, 0.28, steel, o.x + k * 1.1, 1.18, o.z - 0.2);
      tap.rotation.x = Math.PI / 2.6;
      group.add(tap);
      group.add(
        box(0.12, 0.04, 0.12, steel, o.x + k * 1.1, 0.12, o.z + o.d / 2 + 0.06),
      );
    }
    group.add(
      box(0.3, 0.4, 0.05, lampMat(0x9fe0d8), o.x, 1.85, o.z - o.d / 2 + 0.05),
    );
    return;
  }
  if (id === "cirurgia") {
    if (index === 0) {
      // Operating table: column, split top, head rest, straps, stained sheet.
      addObstacle(box(o.w, 0.12, o.d, mat(0x5d6866, 0.4, 0.6), o.x, 0.92, o.z));
      group.add(cyl(0.18, 0.86, steel, o.x, 0.43, o.z, 12));
      group.add(box(0.9, 0.08, 1.2, dull, o.x, 0.04, o.z));
      group.add(
        box(
          o.w - 0.1,
          0.06,
          o.d - 0.3,
          mat(0x9ab4ae, 0.9, 0),
          o.x,
          1.01,
          o.z + 0.1,
        ),
      );
      group.add(
        box(
          0.5,
          0.08,
          0.32,
          mat(0x3c4644, 0.6, 0.2),
          o.x,
          1.04,
          o.z - o.d / 2 + 0.2,
        ),
      );
      for (const dz of [-0.4, 0.5])
        group.add(
          box(
            o.w + 0.06,
            0.03,
            0.08,
            mat(0x5a3b2c, 0.8, 0),
            o.x,
            1.04,
            o.z + dz,
          ),
        );
      group.add(
        box(
          0.55,
          0.012,
          0.7,
          mat(0x5a1712, 0.6, 0),
          o.x + 0.1,
          1.045,
          o.z + 0.2,
        ),
      );
      // Operating lamp: twin heads on an articulated arm, lens stays lit.
      group.add(cyl(0.04, 0.8, steel, o.x, 3.62, o.z, 8));
      const arm = box(1.3, 0.07, 0.07, steel, o.x + 0.3, 3.22, o.z);
      group.add(arm);
      for (const dx of [-0.25, 0.85]) {
        const head = cyl(
          0.42,
          0.16,
          mat(0xc7d0cc, 0.4, 0.5),
          o.x + dx,
          3.0,
          o.z,
          20,
        );
        group.add(head);
        const lens = new T.Mesh(
          new T.CircleGeometry(0.34, 20),
          lampMat(0xf2f7ff),
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.set(o.x + dx, 2.915, o.z);
        group.add(lens);
      }
      // Anaesthesia trolley and monitor at the head of the table.
      group.add(
        box(
          0.5,
          1.1,
          0.45,
          mat(0x4f5e5a, 0.6, 0.4),
          o.x + 1.25,
          0.55,
          o.z - o.d / 2 - 0.25,
        ),
      );
      group.add(
        box(
          0.46,
          0.34,
          0.05,
          mat(0x162220, 0.4, 0.3),
          o.x + 1.25,
          1.34,
          o.z - o.d / 2 - 0.3,
        ),
      );
      group.add(
        box(
          0.36,
          0.06,
          0.02,
          lampMat(0x7fe39a),
          o.x + 1.25,
          1.36,
          o.z - o.d / 2 - 0.27,
        ),
      );
      return;
    }
    // Instrument trolley: two shelves, steel trays, scattered tools.
    addObstacle(box(o.w, 0.06, o.d, steel, o.x, 0.95, o.z));
    group.add(box(o.w, 0.04, o.d, steel, o.x, 0.4, o.z));
    for (const dx of [-1, 1])
      for (const dz of [-1, 1])
        group.add(
          cyl(
            0.02,
            0.95,
            steel,
            o.x + dx * (o.w / 2 - 0.05),
            0.48,
            o.z + dz * (o.d / 2 - 0.05),
            6,
          ),
        );
    for (let k = 0; k < 5; k++)
      group.add(
        box(
          0.03,
          0.015,
          0.22,
          mat(0xc4ccc8, 0.25, 0.9),
          o.x - 0.4 + k * 0.18,
          0.99,
          o.z - 0.05 + (k % 2) * 0.1,
        ),
      );
    group.add(
      box(0.5, 0.02, 0.35, mat(0x5a1712, 0.6, 0), o.x + 0.2, 0.42, o.z),
    );
    return;
  }
  if (id === "esterilizacao") {
    // Autoclave: steel cabinet, round pressure doors, amber "warm" lamps.
    addObstacle(box(o.w, 1.7, o.d, mat(0x9aa6a2, 0.35, 0.7), o.x, 0.85, o.z));
    const doors = Math.max(1, Math.round(o.w / 1.2));
    for (let k = 0; k < doors; k++) {
      const x = o.x - o.w / 2 + (o.w / doors) * (k + 0.5);
      const door = new T.Mesh(
        new T.CircleGeometry(0.42, 22),
        mat(0x6c7875, 0.3, 0.8),
      );
      door.position.set(x, 0.95, o.z + o.d / 2 + 0.012);
      group.add(door);
      const ring = new T.Mesh(new T.TorusGeometry(0.43, 0.04, 6, 22), steel);
      ring.position.set(x, 0.95, o.z + o.d / 2 + 0.02);
      group.add(ring);
      group.add(
        box(
          0.08,
          0.05,
          0.02,
          lampMat(0xffb35a),
          x + 0.3,
          1.52,
          o.z + o.d / 2 + 0.02,
        ),
      );
    }
    group.add(box(o.w + 0.1, 0.12, o.d + 0.1, dull, o.x, 1.76, o.z));
    return;
  }
  if (id === "bombas") {
    if (index === 0) {
      // Horizontal pump: motor drum, volute, base and risers to the ceiling.
      addObstacle(box(o.w, 0.3, o.d, concrete, o.x, 0.15, o.z));
      const drum = cyl(
        0.55,
        o.d - 0.6,
        mat(0x3f6a74, 0.5, 0.6),
        o.x,
        0.85,
        o.z,
        18,
      );
      drum.rotation.x = Math.PI / 2;
      group.add(drum);
      for (const dz of [-1, 1])
        group.add(
          cyl(
            0.6,
            0.1,
            steel,
            o.x,
            0.85,
            o.z + dz * (o.d / 2 - 0.3),
            18,
          ).rotateX(Math.PI / 2),
        );
      group.add(cyl(0.13, 3, dull, o.x - 0.6, 2.4, o.z - 0.8, 10));
      group.add(cyl(0.13, 3, dull, o.x + 0.6, 2.4, o.z + 0.8, 10));
      group.add(box(0.5, 0.3, 0.3, mat(0xb08a2a, 0.5, 0.4), o.x, 1.5, o.z));
      return;
    }
    // Pressure tank on a plinth, hazard band, sight glass.
    addObstacle(box(o.w, 0.25, o.d, concrete, o.x, 0.12, o.z));
    group.add(
      cyl(
        Math.min(o.w, o.d) / 2 - 0.1,
        2.4,
        mat(0x4d6b6a, 0.45, 0.65, tex.rust),
        o.x,
        1.45,
        o.z,
        20,
      ),
    );
    group.add(
      cyl(
        Math.min(o.w, o.d) / 2 - 0.06,
        0.14,
        mat(0xc49a2a, 0.6, 0.3),
        o.x,
        1.1,
        o.z,
        20,
      ),
    );
    group.add(
      box(0.08, 1.2, 0.04, lampMat(0x6fc4c8), o.x, 1.6, o.z + o.d / 2 - 0.1),
    );
    return;
  }
  if (id === "drenos") {
    // Raw concrete pier, rusted collar, weeping pipe stub.
    addObstacle(box(o.w, 4, o.d, concrete, o.x, 2, o.z));
    group.add(box(o.w + 0.08, 0.2, o.d + 0.08, dull, o.x, 0.6, o.z));
    group.add(
      box(o.w + 0.04, 0.6, o.d + 0.04, mat(0x2f3a36, 0.9, 0), o.x, 0.3, o.z),
    );
    return;
  }
  if (id === "reservatorio") {
    addObstacle(box(o.w, 4, o.d, concrete, o.x, 2, o.z));
    for (const y of [0.55, 2.6])
      group.add(box(o.w + 0.1, 0.18, o.d + 0.1, dull, o.x, y, o.z));
    group.add(
      box(o.w + 0.02, 0.5, o.d + 0.02, mat(0x24302d, 0.9, 0), o.x, 0.25, o.z),
    );
    return;
  }
  if (id === "elevador") {
    if (index === 0) {
      // Winch housing with the empty gear slot.
      addObstacle(
        box(o.w, 1.3, o.d, mat(0x5f6a62, 0.55, 0.5, tex.rust), o.x, 0.65, o.z),
      );
      const drum = cyl(0.4, o.w - 0.3, dull, o.x, 1.55, o.z, 16);
      drum.rotation.z = Math.PI / 2;
      group.add(drum);
      group.add(
        box(
          0.12,
          0.6,
          0.6,
          mat(0x2a302c, 0.6, 0.4),
          o.x + o.w / 2 - 0.1,
          1.5,
          o.z + 0.5,
        ),
      );
      return;
    }
    // Stacked crates and a cable drum.
    addObstacle(box(o.w, 1.1, o.d, mat(0x6e5a40, 0.9, 0), o.x, 0.55, o.z));
    group.add(
      box(
        o.w - 0.3,
        0.7,
        o.d * 0.45,
        mat(0x7c6748, 0.9, 0),
        o.x,
        1.45,
        o.z - 0.6,
      ),
    );
    group.add(
      box(o.w + 0.02, 0.06, o.d + 0.02, mat(0x3e3426, 0.9, 0), o.x, 0.6, o.z),
    );
    return;
  }
}
/** Non-blocking props hugging the walls (static; baked with the room). */
export function dressRoom3(id: RoomId, tex: Tex) {
  const g = new T.Group(),
    steel = mat(0x8e9a98, 0.35, 0.75),
    dull = mat(0x56635f, 0.6, 0.5, tex.rust),
    red = mat(0x8a2a22, 0.55, 0.4),
    grate = mat(0x2c3533, 0.6, 0.6);
  const drain = (x: number, z: number, s = 0.5) =>
    g.add(box(s, 0.01, s, grate, x, 0.006, z));
  if (id === "lavabo") {
    for (const z of [-6, 2]) {
      // Hanging gowns and a mask dispenser on the side walls.
      for (let k = 0; k < 3; k++)
        g.add(
          box(
            0.06,
            1.1,
            0.42,
            mat(0x5f8f8a, 0.95, 0),
            -6.25,
            1.55,
            z + k * 0.55,
          ),
        );
      g.add(box(0.12, 0.5, 0.35, mat(0xd6dcd8, 0.5, 0.1), 6.25, 1.5, z + 0.5));
    }
    drain(0, -3);
    drain(0, 2.5);
    g.add(box(2.6, 0.4, 0.04, lampMat(0x8a2a22), 0, 3.3, 8.62)); // "CENTRO CIRÚRGICO" sign band
    g.add(box(2.4, 0.08, 0.05, lampMat(0xe6d6c0), 0, 3.3, 8.6));
  }
  if (id === "cirurgia") {
    // Wall gas outlets, X-ray viewer, kick buckets.
    for (const z of [-4, -1]) {
      g.add(box(0.06, 0.5, 0.9, mat(0xc9d2ce, 0.5, 0.2), 6.25, 1.5, z));
      for (const [k, c] of [0x2a6ad0, 0x2bb04a, 0xd8d8d0].entries())
        g.add(box(0.05, 0.08, 0.08, mat(c, 0.5, 0.2), 6.2, 1.4 + k * 0.12, z));
    }
    g.add(box(0.05, 0.9, 1.6, lampMat(0xdfe9ef), -6.27, 1.8, -3));
    g.add(box(0.03, 0.7, 0.5, mat(0x1e2626, 0.6, 0), -6.24, 1.8, -3.35));
    g.add(box(0.03, 0.7, 0.5, mat(0x1e2626, 0.6, 0), -6.24, 1.8, -2.65));
    for (const x of [-2, 2]) g.add(cyl(0.18, 0.35, steel, x, 0.18, 1.6, 12));
    drain(0, 1.5, 0.35);
  }
  if (id === "esterilizacao") {
    // Pass-through hatch, wrapped packs, a cot: the safe room reads warm.
    g.add(box(1.4, 0.9, 0.08, steel, 0, 1.4, -8.6));
    g.add(box(1.2, 0.04, 0.5, mat(0xb8a27a, 0.9, 0), 3.8, 0.45, 6.6));
    g.add(box(1.9, 0.35, 0.8, mat(0x6d5a40, 0.9, 0), -4.6, 0.25, 1.6));
    g.add(box(1.8, 0.12, 0.75, mat(0xc8b48c, 0.95, 0), -4.6, 0.48, 1.6));
    g.add(box(0.5, 0.06, 0.4, lampMat(0xffd59a), 0, 3.85, 0));
  }
  if (id === "bombas") {
    // P04 board on the back wall: three lines, three wheels, gauge faces.
    g.add(box(3.4, 2.2, 0.12, mat(0x2d4146, 0.6, 0.4), 4.0, 1.6, -8.62));
    for (let k = 0; k < 3; k++) {
      const x = 3.0 + k * 1.0;
      const face = new T.Mesh(
        new T.CircleGeometry(0.26, 20),
        mat(0xe8e4d4, 0.6, 0),
      );
      face.position.set(x, 2.15, -8.54);
      g.add(face);
      g.add(box(0.5, 0.08, 0.02, lampMat(0x6fbf5a), x, 2.15 - 0.33, -8.54));
      const w = wheel(red, 0.2);
      w.position.set(x, 1.15, -8.48);
      g.add(w);
      g.add(cyl(0.07, 2.2, dull, x, 2.9, -8.4, 10).rotateX(0.02));
    }
    g.add(cyl(0.16, 12, dull, -6.2, 3.2, 0, 12).rotateX(Math.PI / 2));
    g.add(cyl(0.12, 12, dull, 6.25, 0.6, 0, 12).rotateX(Math.PI / 2));
    for (const z of [-6, -2, 2, 6]) drain(0, z, 0.45);
  }
  if (id === "drenos") {
    // Big trunk mains along both walls, a floor channel, hanging chains.
    for (const x of [-6.1, 6.1]) {
      g.add(cyl(0.28, 16.8, dull, x, 0.6, 0, 14).rotateX(Math.PI / 2));
      g.add(cyl(0.12, 16.8, dull, x, 2.9, 0, 10).rotateX(Math.PI / 2));
    }
    g.add(box(0.9, 0.02, 16, mat(0x1d2826, 0.4, 0.3), 0, 0.012, 0));
    for (const [x, z] of [
      [-1.5, -4],
      [2.5, 1],
      [1, 5],
    ])
      g.add(cyl(0.015, 1.4, steel, x, 3.3, z, 4));
    g.add(box(1.2, 0.5, 0.05, lampMat(0x2a6a70), 0, 3.0, -8.6));
  }
  if (id === "reservatorio") {
    // Two red side valves (the drain mechanic), tank rim, sump grate, catwalk.
    for (const x of [-5.4, 5.4]) {
      g.add(
        box(1.2, 1.6, 0.2, mat(0x34403e, 0.6, 0.5, tex.rust), x, 1.2, -8.6),
      );
      g.add(cyl(0.22, 1.8, dull, x, 2.9, -8.45, 12));
      g.add(box(0.5, 0.12, 0.04, lampMat(0xe08a5a), x, 2.15, -8.48));
    }
    g.add(cyl(1.1, 0.04, grate, 0, 0.02, -1, 24));
    g.add(box(13, 0.12, 1.1, mat(0x3a4542, 0.6, 0.6, tex.rust), 0, 3.3, 7.6));
    for (let x = -6; x <= 6; x += 1.5)
      g.add(box(0.04, 0.9, 0.04, steel, x, 3.8, 7.1));
    for (const x of [-6.1, 6.1])
      g.add(box(0.12, 0.08, 16.6, mat(0xb0a060, 0.6, 0.3), x, 0.32, 0)); // high-water line
  }
  if (id === "elevador") {
    // Shaft door with hazard frame and cage bars at the back wall.
    g.add(box(3.2, 3.2, 0.1, mat(0x24282a, 0.7, 0.4), 0, 1.6, -8.66));
    for (let x = -1.3; x <= 1.31; x += 0.26)
      g.add(cyl(0.02, 2.9, steel, x, 1.5, -8.55, 6));
    for (const x of [-1.7, 1.7])
      g.add(box(0.2, 3.4, 0.16, mat(0xc49a2a, 0.6, 0.3), x, 1.7, -8.6));
    g.add(box(3.6, 0.2, 0.16, mat(0xc49a2a, 0.6, 0.3), 0, 3.4, -8.6));
    g.add(box(0.5, 0.18, 0.04, lampMat(0xff9a52), 2.3, 2.4, -8.6));
    g.add(cyl(0.03, 3.5, steel, -0.4, 2.2, -8.3, 6));
    g.add(cyl(0.03, 3.5, steel, 0.4, 2.2, -8.3, 6));
  }
  return g;
}
const WATER: Partial<Record<RoomId, number>> = {
  drenos: 0.1,
  reservatorio: 0.24,
};
export type Ch3Transient = {
  spit: { x: number; z: number; y: number }[];
  pools: { x: number; z: number; t: number }[];
  drained: number;
};
/** Dynamic chapter-3 layer: one small group, never baked. */
export class Chapter3Fx {
  root = new T.Group();
  water?: T.Mesh;
  level = 0;
  spit: T.Mesh[] = [];
  pools: T.Mesh[] = [];
  needles: T.Mesh[] = [];
  gear?: T.Mesh;
  bubbles: T.Mesh;
  constructor(public id: RoomId) {
    const h = WATER[id];
    if (h !== undefined) {
      // Opaque dark water: it occludes the floor (early-z), so it costs no
      // extra overdraw; the flashlight gives it a wet specular sheen.
      this.water = new T.Mesh(
        new T.PlaneGeometry(13.3, 17.7),
        new T.MeshStandardMaterial({
          color: 0x2a4c50,
          roughness: 0.14,
          metalness: 0.5,
          emissive: 0x10282b,
        }),
      );
      this.water.rotation.x = -Math.PI / 2;
      this.level = h;
      this.water.position.y = h;
      this.water.receiveShadow = true;
      this.water.name = "water";
      this.root.add(this.water);
    }
    if (id === "bombas")
      for (let k = 0; k < 3; k++) {
        const n = new T.Mesh(
          new T.BoxGeometry(0.03, 0.22, 0.01),
          new T.MeshBasicMaterial({ color: 0x8a1a12 }),
        );
        n.geometry.translate(0, 0.1, 0);
        n.position.set(3.0 + k, 2.15, -8.52);
        this.needles.push(n);
        this.root.add(n);
      }
    if (id === "elevador") {
      this.gear = new T.Mesh(
        new T.TorusGeometry(0.34, 0.1, 6, 16),
        new T.MeshStandardMaterial({
          color: 0xc0a050,
          roughness: 0.4,
          metalness: 0.8,
        }),
      );
      this.gear.position.set(-2.55, 1.5, -5.9);
      this.gear.rotation.y = Math.PI / 2;
      this.root.add(this.gear);
    }
    this.bubbles = new T.Mesh(
      new T.RingGeometry(0.5, 0.85, 24),
      new T.MeshBasicMaterial({
        color: 0xbfe6e8,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.bubbles.rotation.x = -Math.PI / 2;
    this.bubbles.visible = false;
    this.root.add(this.bubbles);
  }
  waterY() {
    return this.water ? this.water.position.y : 0;
  }
  update(s: GameState, fx: Ch3Transient, elapsed: number, dt: number) {
    if (this.water) {
      const target = fx.drained > 0 ? 0.035 : this.level;
      this.water.position.y +=
        (target - this.water.position.y) * (1 - Math.exp(-dt * 1.6));
    }
    const p = s.pressure ?? PRESSURE_START;
    this.needles.forEach((n, k) => {
      const want = -2.2 + (Math.min(8, p[k]) / 8) * 4.4;
      n.rotation.z += (-want - n.rotation.z) * (1 - Math.exp(-dt * 8));
    });
    if (this.gear) {
      this.gear.visible = !!s.flags.elevador;
      if (s.flags.elevador) this.gear.rotation.x = elapsed * 1.5;
    }
    const sync = (list: T.Mesh[], n: number, make: () => T.Mesh) => {
      while (list.length < n) {
        const m = make();
        list.push(m);
        this.root.add(m);
      }
      list.forEach((m, i) => (m.visible = i < n));
    };
    sync(
      this.spit,
      fx.spit.length,
      () =>
        new T.Mesh(
          new T.IcosahedronGeometry(0.11, 1),
          new T.MeshBasicMaterial({ color: 0xa6e05a }),
        ),
    );
    fx.spit.forEach((b, i) => this.spit[i].position.set(b.x, b.y, b.z));
    sync(this.pools, fx.pools.length, () => {
      const m = new T.Mesh(
        new T.CircleGeometry(0.9, 20),
        new T.MeshBasicMaterial({
          color: 0x7fb03a,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    fx.pools.forEach((q, i) => {
      const m = this.pools[i];
      m.position.set(q.x, this.waterY() + 0.02, q.z);
      (m.material as T.MeshBasicMaterial).opacity = Math.min(0.55, q.t * 0.4);
      m.scale.setScalar(0.85 + 0.08 * Math.sin(elapsed * 6 + i));
    });
  }
  /** B03 emergence / E09 ambush warning: rippling ring at the spot. */
  ripple(x: number, z: number, on: boolean, elapsed: number) {
    this.bubbles.visible = on;
    if (!on) return;
    this.bubbles.position.set(x, this.waterY() + 0.02, z);
    this.bubbles.scale.setScalar(1 + 0.25 * Math.sin(elapsed * 9));
  }
  dispose() {
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
  }
}
