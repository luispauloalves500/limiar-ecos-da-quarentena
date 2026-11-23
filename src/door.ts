import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/** 0.13: the user's steel door (src/assets/porta.glb, see docs/MODELOS.md).
 * Two static meshes split offline by scripts/door-asset.mjs:
 *  - frame: jamb + header + both hinge barrels (fixed to the wall)
 *  - leaf:  leaf, grille, handles, lock plate (swings on the hinge)
 * Model space: pivot at bottom centre, +Z = hinge/push face, hinges on -X. */
const url = new URL("./assets/porta.glb", import.meta.url).href;

/** Uniform scale: 1.70 m model -> 2.80 m doorway under the 2.86 m header. */
export const DOOR_SCALE = 1.65;
/** Native model extents (metres) before DOOR_SCALE. */
export const DOOR_MODEL = { halfWidth: 0.433, height: 1.7, back: -0.066 };
export const DOOR_HALF_WIDTH = DOOR_MODEL.halfWidth * DOOR_SCALE;
export const DOOR_HEIGHT = DOOR_MODEL.height * DOOR_SCALE;
/** Hinge axis in model space (barrels at x -0.38..-0.35, z 0.037..0.067). */
export const DOOR_HINGE = { x: -0.365, z: 0.052 };

export type DoorAsset = {
  frame: T.BufferGeometry;
  leaf: T.BufferGeometry;
  material: T.MeshStandardMaterial;
  /** Low profile: same material with a 512² copy of the map (1/4 VRAM). */
  low?: T.MeshStandardMaterial;
};
let asset: DoorAsset | undefined;
let pending: Promise<DoorAsset> | undefined;
let failure = "";

export function preloadDoor() {
  pending ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url)
    .then((g) => {
      const parts: Partial<Record<"frame" | "leaf", T.Mesh>> = {};
      g.scene.traverse((o) => {
        if (o instanceof T.Mesh && (o.name === "frame" || o.name === "leaf"))
          parts[o.name] = o;
      });
      if (!parts.frame || !parts.leaf)
        throw new Error("porta.glb sem frame/leaf");
      const src = parts.frame.material as T.MeshStandardMaterial;
      // Doors sit in the static bake (vertex AO + baked door/practical
      // light), so the shared material only needs the albedo map.
      const material = new T.MeshStandardMaterial({
        map: src.map,
        roughness: 0.72,
        metalness: 0.35,
      });
      if (material.map) {
        material.map.anisotropy = 4;
        material.map.userData.persistent = true;
      }
      material.userData.zombieShared = true;
      src.dispose();
      g.scene.updateMatrixWorld(true);
      asset = {
        frame: unpack(parts.frame),
        leaf: unpack(parts.leaf),
        material,
      };
      return asset;
    })
    .catch((e) => {
      failure = String(e);
      throw e;
    });
  return pending;
}
/** Meshopt output is quantized (int16 positions + a dequantizing node
 * transform). The bake re-transforms and merges vertices, so expand to
 * float32 in model space once at load. */
function unpack(m: T.Mesh) {
  const g = new T.BufferGeometry();
  for (const [name, a] of Object.entries(m.geometry.attributes)) {
    if (!["position", "normal", "uv"].includes(name)) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < a.itemSize; k++)
        out[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(name, new T.BufferAttribute(out, a.itemSize));
  }
  g.setIndex(m.geometry.index);
  g.applyMatrix4(m.matrixWorld);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.userData.zombieShared = true;
  m.geometry.dispose();
  return g;
}
export function doorAsset() {
  return asset;
}
export function doorDiagnostics() {
  return { status: asset ? "ready" : failure ? "failed" : "loading", failure };
}
/** Shared door material for a quality profile. The Low copy is built once
 * from the decoded image (canvas downscale), so Low never uploads 1024². */
export function doorMaterial(a: DoorAsset, low: boolean) {
  if (!low || !a.material.map) return a.material;
  if (!a.low) {
    const src = a.material.map,
      img = src.image as CanvasImageSource,
      c = document.createElement("canvas");
    c.width = c.height = 512;
    c.getContext("2d")!.drawImage(img, 0, 0, 512, 512);
    const map = new T.CanvasTexture(c);
    map.flipY = src.flipY;
    map.colorSpace = src.colorSpace;
    map.wrapS = src.wrapS;
    map.wrapT = src.wrapT;
    map.anisotropy = 2;
    map.userData.persistent = true;
    a.low = a.material.clone();
    a.low.map = map;
    a.low.userData.zombieShared = true;
  }
  return a.low;
}
/** One door: frame + leaf on a hinge pivot. Geometry and material are the
 * shared asset objects (never cloned); the room bake merges every door of a
 * room into a single draw, the cinematic animates `hinge.rotation.y`. */
export function doorModel(a: DoorAsset, low = false) {
  const material = low ? doorMaterial(a, true) : a.material,
    root = new T.Group(),
    hinge = new T.Group(),
    frame = new T.Mesh(a.frame, material),
    leaf = new T.Mesh(a.leaf, material);
  root.name = "porta";
  root.scale.setScalar(DOOR_SCALE);
  hinge.position.set(DOOR_HINGE.x, 0, DOOR_HINGE.z);
  leaf.position.set(-DOOR_HINGE.x, 0, -DOOR_HINGE.z);
  hinge.add(leaf);
  root.add(frame, hinge);
  for (const m of [frame, leaf]) {
    m.castShadow = false;
    m.receiveShadow = true;
  }
  return { root, hinge, frame, leaf };
}
