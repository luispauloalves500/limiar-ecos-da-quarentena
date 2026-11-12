import * as T from "three";
import type { RoomId } from "./world";
import { roomDoors, endpoint } from "./world";
import type { BakeLight } from "./bake";

/** Room look: wall tint, lower-wall band, damp and trim. All procedural. */
export type RoomLook = {
  tint: number;
  band: number;
  trim: number;
  damp: number;
  rail: boolean;
  curtains: boolean;
  pilasters: boolean;
  hazard: boolean;
  drains: boolean;
  tiles: boolean;
  sheets: boolean;
  stairs: boolean;
};
const base = {
  rail: false,
  curtains: false,
  pilasters: false,
  hazard: false,
  drains: false,
  tiles: false,
  sheets: false,
  stairs: false,
};
export const looks: Record<RoomId, RoomLook> = {
  recepcao: {
    ...base,
    tint: 0xe9f2ec,
    band: 0x3c5a55,
    trim: 0x8d9b8e,
    damp: 0.35,
  },
  corredor: {
    ...base,
    tint: 0xe2ece4,
    band: 0x40584a,
    trim: 0x8a9786,
    damp: 0.5,
    rail: true,
  },
  segura: {
    ...base,
    tint: 0xfff0dc,
    band: 0x6b4b33,
    trim: 0x8a6646,
    damp: 0.12,
  },
  arquivo: {
    ...base,
    tint: 0xf1ead6,
    band: 0x5d5a3e,
    trim: 0x7c7356,
    damp: 0.42,
  },
  gerador: {
    ...base,
    tint: 0xdfe6dc,
    band: 0x3a423c,
    trim: 0x6d756a,
    damp: 0.6,
    hazard: true,
    drains: true,
  },
  atrio: {
    ...base,
    tint: 0xe1e7ef,
    band: 0x2f3a45,
    trim: 0x7d8796,
    damp: 0.3,
    pilasters: true,
  },
  escadaria: {
    ...base,
    tint: 0xe0eaea,
    band: 0x37504f,
    trim: 0x84948f,
    damp: 0.45,
    rail: true,
  },
  internacao: {
    ...base,
    tint: 0xe5efe6,
    band: 0x46604e,
    trim: 0x8fa08e,
    damp: 0.4,
    rail: true,
    curtains: true,
  },
  enfermaria: {
    ...base,
    tint: 0xf0e6e6,
    band: 0x5e4446,
    trim: 0x9a8a88,
    damp: 0.38,
    curtains: true,
  },
  posto: {
    ...base,
    tint: 0xe7eee6,
    band: 0x44575f,
    trim: 0x8b989b,
    damp: 0.28,
    rail: true,
  },
  lavanderia: {
    ...base,
    tint: 0xe6f0f2,
    band: 0xa9b8b6,
    trim: 0x7d8f90,
    damp: 0.7,
    drains: true,
    tiles: true,
  },
  isolamento: {
    ...base,
    tint: 0xf2e2dc,
    band: 0x5a3832,
    trim: 0x8d6f68,
    damp: 0.5,
    hazard: true,
    sheets: true,
  },
  espera: {
    ...base,
    tint: 0xf3e4dc,
    band: 0x6a4e52,
    trim: 0xa89088,
    damp: 0.36,
  },
  recreio: {
    ...base,
    tint: 0xe4f0e6,
    band: 0x4a6a58,
    trim: 0x8faf9a,
    damp: 0.32,
    curtains: true,
  },
  bercario: {
    ...base,
    tint: 0xf4ead8,
    band: 0x7a5a48,
    trim: 0xb09878,
    damp: 0.4,
    sheets: true,
  },
  leitos: {
    ...base,
    tint: 0xe8efe6,
    band: 0x556858,
    trim: 0x8a9a88,
    damp: 0.44,
    curtains: true,
    rail: true,
  },
  abrigo: {
    ...base,
    tint: 0xfff3e0,
    band: 0x6b5038,
    trim: 0x9a7a58,
    damp: 0.14,
  },
  circulo: {
    ...base,
    tint: 0xefe4e0,
    band: 0x5a3030,
    trim: 0x8a6060,
    damp: 0.36,
    curtains: true,
    hazard: true,
  },
  visor: {
    ...base,
    tint: 0xe4eef0,
    band: 0x3a5054,
    trim: 0x7a9094,
    damp: 0.28,
    rail: true,
  },
};
export const HALF_X = 6.54,
  HALF_Z = 8.74,
  HEIGHT = 4;
const WALLS: [number, number, number][] = [
  [0, 2, -8.85],
  [0, 2, 8.85],
  [-6.65, 2, 0],
  [6.65, 2, 0],
];
/** Which wall a door endpoint belongs to and where along it (u). */
export function doorWall(p: { x: number; z: number }) {
  if (Math.abs(p.x) > 5) return { wall: p.x < 0 ? 2 : 3, u: p.z };
  return { wall: p.z < 0 ? 0 : 1, u: p.x };
}
/** Split [a,b] removing door gaps (2.2 m wide). */
export function segments(a: number, b: number, gaps: number[], half = 1.1) {
  const out: [number, number][] = [];
  let start = a;
  for (const g of [...gaps].sort((x, y) => x - y)) {
    if (g - half > start) out.push([start, Math.min(b, g - half)]);
    start = Math.max(start, g + half);
  }
  if (start < b) out.push([start, b]);
  return out.filter(([x, y]) => y - x > 0.05);
}
function std(c: number, r = 0.8, m = 0) {
  return new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
}
export type Architecture = {
  room: T.Object3D[];
  ceiling: T.Object3D[];
  walls: T.Object3D[][];
  lights: BakeLight[];
};
/** Build cheap architectural trim for one room. Everything is static and is
 * merged by bake.ts into a handful of draws. */
export function architecture(
  id: RoomId,
  practical: [number, number][],
  practicalColor = 0xd9e6d6,
  practicalGain = 1,
): Architecture {
  const L = looks[id],
    // One surface response for all trim: colour is baked per vertex, so the
    // whole set merges into a single draw per wall/ceiling.
    trim = std(L.trim, 0.6, 0.3),
    band = std(L.band, 0.6, 0.3),
    dark = std(0x1d2522, 0.6, 0.3),
    steel = std(0x75827c, 0.6, 0.3),
    lamp = new T.MeshBasicMaterial({ color: 0x9fc6ad }),
    out: Architecture = {
      room: [],
      ceiling: [],
      walls: [[], [], [], []],
      lights: [],
    };
  const gaps: number[][] = [[], [], [], []];
  for (const d of roomDoors(id)) {
    const p = endpoint(d, id).position,
      w = doorWall(p);
    gaps[w.wall].push(w.u);
    // The former per-door PointLight is now baked (vertex light) + emissive lamp.
    out.lights.push({
      x: p.x * 0.93,
      y: 2.6,
      z: p.z * 0.94,
      color: 0x94b99b,
      intensity: 0.85,
      range: 3.6,
    });
  }
  for (const [x, z] of practical)
    out.lights.push({
      x,
      y: 3.4,
      z,
      color: practicalColor,
      intensity: 2.4 * practicalGain,
      range: 12,
    });
  const piece = (
    wall: number,
    u0: number,
    u1: number,
    y: number,
    h: number,
    t: number,
    off: number,
    m: T.Material,
    toRoom = false,
  ) => {
    const len = u1 - u0,
      mid = (u0 + u1) / 2,
      side = wall >= 2,
      [wx, wy, wz] = WALLS[wall];
    const face =
        wall === 0
          ? -HALF_Z
          : wall === 1
            ? HALF_Z
            : wall === 2
              ? -HALF_X
              : HALF_X,
      sign = wall === 0 || wall === 2 ? 1 : -1,
      n = face + sign * (off + t / 2);
    const g = new T.BoxGeometry(side ? t : len, h, side ? len : t),
      mesh = new T.Mesh(g, m);
    const [ox, oy, oz] = toRoom ? [0, 0, 0] : [wx, wy, wz];
    if (side) mesh.position.set(n - ox, y - oy, mid - oz);
    else mesh.position.set(mid - ox, y - oy, n - oz);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.trim = true;
    (toRoom ? out.room : out.walls[wall]).push(mesh);
  };
  for (let w = 0; w < 4; w++) {
    const span = w >= 2 ? HALF_Z : HALF_X,
      segs = segments(-span, span, gaps[w]);
    for (const [a, b] of segs) {
      piece(w, a, b, 0.07, 0.14, 0.035, 0, trim); // baseboard
      piece(w, a, b, 0.62, 1.0, 0.012, 0, band); // lower wall band
      piece(w, a, b, 1.14, 0.05, 0.04, 0, trim); // chair rail
      if (L.tiles)
        for (let y = 0.3; y < 1.1; y += 0.3)
          piece(w, a, b, y, 0.012, 0.016, 0, trim); // grout lines
      if (L.rail && w >= 2) {
        piece(w, a, b, 0.92, 0.06, 0.06, 0.06, steel); // handrail
        for (let u = a + 0.4; u < b - 0.2; u += 1.6)
          piece(w, u, u + 0.05, 0.86, 0.12, 0.06, 0.02, steel);
      }
      if (L.pilasters)
        for (let u = a + 0.8; u < b - 0.4; u += 3)
          piece(w, u, u + 0.5, 2, 4, 0.18, 0, band);
    }
    // Conduit near the ceiling runs the full wall (doors are lower).
    piece(w, -span + 0.3, span - 0.3, 3.55, 0.06, 0.06, 0.05, steel);
    piece(w, -span + 0.3, span - 0.3, 3.3, 0.035, 0.035, 0.06, dark);
    // Worn corner guards.
    for (const u of [-span + 0.04, span - 0.08])
      piece(w, u, u + 0.04, 0.8, 1.6, 0.05, 0, steel);
  }
  for (const d of roomDoors(id)) {
    const p = endpoint(d, id).position,
      w = doorWall(p);
    piece(w.wall, w.u - 0.22, w.u + 0.22, 2.95, 0.1, 0.05, 0.02, lamp, true); // emissive door lamp
    piece(w.wall, w.u - 1.02, w.u + 1.02, 2.86, 0.09, 0.06, 0, trim, true); // header moulding
  }
  // Ceiling: cable tray with cables, plus tile grid ribs.
  const tray = (x: number) => {
    for (const dx of [-0.2, 0.2]) {
      const r = new T.Mesh(new T.BoxGeometry(0.03, 0.08, 16.8), steel);
      r.position.set(x + dx, 3.62, 0);
      out.ceiling.push(r);
    }
    for (let k = 0; k < 3; k++) {
      const c = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 16.6, 5), dark);
      c.rotation.x = Math.PI / 2;
      c.position.set(x - 0.1 + k * 0.1, 3.6, 0);
      out.ceiling.push(c);
    }
  };
  tray(id === "atrio" ? -2.6 : 2.4);
  for (let x = -6; x <= 6; x += 2) {
    const rib = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 17.2), dark);
    rib.position.set(x, 3.97, 0);
    out.ceiling.push(rib);
  }
  if (L.curtains)
    for (const z of [-4, 2]) {
      for (const [w, d, x, zz] of [
        [3, 0.04, -3.5, z - 1.5],
        [3, 0.04, -3.5, z + 1.5],
        [0.04, 3, -5, z],
        [0.04, 3, -2, z],
      ]) {
        const r = new T.Mesh(new T.BoxGeometry(w, 0.04, d), steel);
        r.position.set(x, 3.3, zz);
        out.ceiling.push(r);
      }
    }
  const floorBox = (
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const b = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.receiveShadow = true;
    out.room.push(b);
  };
  if (L.hazard) {
    const yellow = std(0x9c8a3c, 0.7),
      black = std(0x1b1d1a, 0.8);
    for (let i = 0; i < 22; i++)
      floorBox(
        0.5,
        0.006,
        0.12,
        i % 2 ? yellow : black,
        -5.25 + i * 0.5,
        0.004,
        -5.2,
      );
  }
  if (L.drains)
    for (const [x, z] of [
      [-2, 1],
      [3, -3],
    ]) {
      floorBox(0.6, 0.01, 0.6, dark, x, 0.004, z);
      for (let k = 0; k < 5; k++)
        floorBox(0.5, 0.012, 0.03, steel, x, 0.008, z - 0.22 + k * 0.11);
    }
  if (L.sheets)
    for (const x of [-6.3, 6.3])
      for (const z of [-4.5, 0, 4.5])
        floorBox(0.05, 3.3, 0.05, steel, x, 1.65, z);
  if (L.stairs)
    for (let k = 0; k < 6; k++) {
      floorBox(
        2.4,
        0.18 * (k + 1),
        0.34,
        std(0x56625c, 0.8),
        4.9,
        0.09 * (k + 1),
        -2.4 - k * 0.34,
      );
      floorBox(
        2.4,
        0.02,
        0.05,
        std(0xa58f45, 0.6),
        4.9,
        0.18 * (k + 1) + 0.005,
        -2.24 - k * 0.34,
      );
    }
  return out;
}
