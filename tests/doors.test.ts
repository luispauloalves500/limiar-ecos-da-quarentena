import { describe, expect, it } from "vitest";
import glbInline from "../src/assets/porta.glb?inline";
import renderSource from "../src/render.ts?raw";
import * as T from "three";
import {
  DOOR_GAP_HALF,
  HALF_X,
  HALF_Z,
  doorPlacement,
  segments,
} from "../src/architecture";
import {
  DOOR_HALF_WIDTH,
  DOOR_HEIGHT,
  DOOR_HINGE,
  DOOR_MODEL,
  DOOR_SCALE,
  doorModel,
} from "../src/door";
import { doors, endpoint, roomDoors, rooms, type RoomId } from "../src/world";

/** Solid wall boxes built by render.ts (centre, thickness 0.22). */
const WALL_T = 0.22,
  WALL_X = 6.65,
  WALL_Z = 8.85;
const all = doors.flatMap((d) =>
  [d.a, d.b].map((room) => ({ d, room, p: endpoint(d, room).position })),
);

describe("0.13 doors sit flush in their wall", () => {
  it("covers every door of chapters 1–3 from both rooms", () => {
    expect(all.length).toBe(doors.length * 2);
    for (const id of Object.keys(rooms) as RoomId[])
      expect(roomDoors(id).length).toBeGreaterThan(0);
  });
  it("wall planes match the solid wall boxes", () => {
    expect(WALL_X - WALL_T / 2).toBeCloseTo(HALF_X, 6);
    expect(WALL_Z - WALL_T / 2).toBeCloseTo(HALF_Z, 6);
  });
  it.each(all.map((a) => [a.d.id + "@" + a.room, a] as const))(
    "%s is on its wall plane, facing the room",
    (_, { p }) => {
      const at = doorPlacement(p);
      const tol = 0.01;
      if (at.wall >= 2) {
        expect(Math.abs(Math.abs(at.x) - HALF_X)).toBeLessThan(tol);
        expect(at.z).toBeCloseTo(p.z, 6);
      } else {
        expect(Math.abs(Math.abs(at.z) - HALF_Z)).toBeLessThan(tol);
        expect(at.x).toBeCloseTo(p.x, 6);
      }
      // Normal points into the room (toward the centre).
      expect(at.normal.x * -at.x + at.normal.z * -at.z).toBeGreaterThan(0);
      // Rotation maps model +Z onto that normal.
      const n = new T.Vector3(0, 0, 1).applyAxisAngle(
        new T.Vector3(0, 1, 0),
        at.rotation,
      );
      expect(n.x).toBeCloseTo(at.normal.x, 6);
      expect(n.z).toBeCloseTo(at.normal.z, 6);
      // The interaction point is still within the 1.8 m use radius.
      expect(Math.hypot(at.x - p.x, at.z - p.z)).toBeLessThan(1.8);
      // Fits the wall span and the trim gap.
      const span = at.wall >= 2 ? HALF_Z : HALF_X;
      expect(Math.abs(at.u) + DOOR_HALF_WIDTH).toBeLessThan(span - 0.2);
      for (const [a, b] of segments(-span, span, [at.u], DOOR_GAP_HALF))
        expect(b <= at.u - DOOR_HALF_WIDTH || a >= at.u + DOOR_HALF_WIDTH).toBe(
          true,
        );
    },
  );
  it("regression: the old placement (door endpoint) floated off the wall", () => {
    for (const { p } of all) {
      const at = doorPlacement(p);
      expect(Math.hypot(at.x - p.x, at.z - p.z)).toBeGreaterThan(0.5);
    }
  });
  it("frame back is embedded in the wall, leaf face just proud of it", () => {
    const back = DOOR_MODEL.back * DOOR_SCALE;
    expect(back).toBeLessThan(0); // behind the wall face
    expect(-back).toBeLessThan(WALL_T); // but not through the wall
    expect(DOOR_HEIGHT).toBeLessThan(2.86); // under the header moulding
    expect(DOOR_HALF_WIDTH * 2).toBeGreaterThan(1.3);
  });
});

describe("render uses the wall placement", () => {
  it("door groups are placed by doorPlacement, not at the endpoint", () => {
    expect(renderSource).toContain("doorPlacement(endpoint(d, id).position)");
    expect(renderSource).not.toMatch(/g\.position\.set\(p\.x, 0, p\.z\)/);
  });
});

describe("door model", () => {
  const asset = {
    frame: new T.BoxGeometry(0.866, 1.7, 0.1).translate(0, 0.85, 0),
    leaf: new T.BoxGeometry(0.75, 1.62, 0.04).translate(0, 0.83, 0),
    material: new T.MeshStandardMaterial(),
  };
  it("swings the leaf on the real hinge (-X) toward the room (+Z)", () => {
    const m = doorModel(asset);
    m.root.updateMatrixWorld(true);
    const edge = () => {
      m.root.updateMatrixWorld(true);
      return new T.Vector3(0.37, 0.8, 0).applyMatrix4(m.leaf.matrixWorld);
    };
    const closed = edge();
    expect(closed.x).toBeCloseTo(0.37 * DOOR_SCALE, 5);
    expect(closed.z).toBeCloseTo(0, 5);
    const pivot = new T.Vector3().setFromMatrixPosition(m.hinge.matrixWorld);
    expect(pivot.x).toBeCloseTo(DOOR_HINGE.x * DOOR_SCALE, 5);
    m.hinge.rotation.y = -1.2;
    const open = edge();
    expect(open.z).toBeGreaterThan(0.6);
    // The hinge side does not move.
    expect(
      new T.Vector3()
        .setFromMatrixPosition(m.hinge.matrixWorld)
        .distanceTo(pivot),
    ).toBeLessThan(1e-6);
  });
  it("shares geometry and material between doors (no clones)", () => {
    const a = doorModel(asset),
      b = doorModel(asset);
    expect(a.frame.geometry).toBe(b.frame.geometry);
    expect(a.leaf.material).toBe(b.leaf.material);
  });
  it("porta.glb is optimized: meshopt + WebP, frame/leaf split, < 600 KB", () => {
    const bin = atob(glbInline.slice(glbInline.indexOf(",") + 1)),
      buf = Uint8Array.from(bin, (c) => c.charCodeAt(0)),
      view = new DataView(buf.buffer);
    expect(buf.length).toBeLessThan(600_000);
    const len = view.getUint32(12, true),
      json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len)));
    expect(json.extensionsUsed).toEqual(
      expect.arrayContaining(["EXT_meshopt_compression", "EXT_texture_webp"]),
    );
    expect(json.meshes.map((m: { name: string }) => m.name).sort()).toEqual([
      "frame",
      "leaf",
    ]);
    expect(json.skins ?? []).toHaveLength(0);
  });
});
