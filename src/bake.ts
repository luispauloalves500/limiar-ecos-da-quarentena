import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Static light that only exists in vertex colours (no runtime light cost). */
export type BakeLight = {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  range: number;
};
export type BakeOptions = {
  lights: BakeLight[];
  /** Interior half extents of the room (walls' inner faces). */
  halfX: number;
  halfZ: number;
  height: number;
  /** 0..1 humidity/stain strength near the floor. */
  damp: number;
  tint: number;
};
const tmp = new T.Vector3(),
  col = new T.Color();

/** Cheap procedural ambient occlusion + baked light for one vertex. Pure
 * function of position/normal so it is unit-testable and deterministic. */
export function bakeVertex(
  p: T.Vector3,
  n: T.Vector3,
  o: BakeOptions,
  out: T.Color,
  light?: T.Color,
) {
  let ao = 1;
  const edgeX = o.halfX - Math.abs(p.x),
    edgeZ = o.halfZ - Math.abs(p.z),
    edge = Math.max(0, Math.min(edgeX, edgeZ));
  // Contact shadow at the base of every vertical surface.
  if (p.y < 0.45 && Math.abs(n.y) < 0.6)
    ao *= 0.55 + (0.45 * Math.max(0, p.y)) / 0.45;
  // Floor darkens toward walls and under the 0.6 m skirt of props.
  if (n.y > 0.6 && p.y < 0.15) ao *= 0.6 + 0.4 * Math.min(1, edge / 0.9);
  // Wall/ceiling and wall/wall creases.
  if (p.y > o.height - 0.6) ao *= 0.72 + (0.28 * (o.height - p.y)) / 0.6;
  if (edgeX < 0.7 && edgeZ < 0.7)
    ao *= 0.7 + (0.3 * Math.max(edgeX, edgeZ)) / 0.7;
  // Underside faces receive less bounce.
  if (n.y < -0.6) ao *= 0.78;
  ao = Math.max(0.45, Math.min(1, ao));
  out.setRGB(ao, ao, ao);
  // Damp band: deterministic noise near the floor, greenish-brown.
  if (o.damp > 0 && p.y < 1.1) {
    const noise =
      0.5 + 0.5 * Math.sin(p.x * 2.3 + Math.sin(p.z * 1.7) * 2 + p.z * 0.9);
    const k = o.damp * noise * (1 - p.y / 1.1) * 0.45;
    out.r *= 1 - k;
    out.g *= 1 - k * 0.7;
    out.b *= 1 - k * 1.1;
  }
  col.setHex(o.tint);
  out.multiply(col);
  // Baked practical/door lights (Lambert * smooth falloff). Written to a
  // separate radiance attribute and added as emission x albedo in the shader,
  // i.e. a per-vertex lightmap that costs no runtime light.
  if (light) {
    light.setRGB(0, 0, 0);
    for (const l of o.lights) {
      tmp.set(l.x - p.x, l.y - p.y, l.z - p.z);
      const d = tmp.length();
      if (d >= l.range) continue;
      const lambert = Math.max(0, tmp.dot(n) / Math.max(d, 1e-4)),
        k = (0.25 + 0.75 * lambert) * (1 - d / l.range) ** 1.5 * l.intensity;
      col.setHex(l.color);
      light.r += col.r * k;
      light.g += col.g * k;
      light.b += col.b * k;
    }
  }
  return out;
}

/** Bucket key ignores the base colour: colour is baked per vertex, so props
 * of different paint share one draw when their surface response matches. */
function key(m: T.Material) {
  if (m instanceof T.MeshStandardMaterial)
    return [
      "std",
      (Math.round(m.roughness * 5) / 5).toFixed(1),
      (Math.round(m.metalness * 4) / 4).toFixed(2),
      m.map?.uuid || "",
      m.bumpMap?.uuid || "",
      m.emissive.getHex(),
      m.side,
    ].join(":");
  if (m instanceof T.MeshBasicMaterial)
    return ["basic", m.map?.uuid || "", m.side].join(":");
  return "";
}
export function mergeable(o: T.Object3D, exclude: Set<T.Object3D>) {
  if (
    !(o instanceof T.Mesh) ||
    o instanceof T.InstancedMesh ||
    o instanceof T.SkinnedMesh
  )
    return false;
  if (Array.isArray(o.material) || o.material.transparent || !o.visible)
    return false;
  if (
    o.name === "pickup-marker" ||
    o.userData.dynamic ||
    o.morphTargetInfluences
  )
    return false;
  for (let p: T.Object3D | null = o; p; p = p.parent)
    if (exclude.has(p)) return false;
  return key(o.material) !== "";
}
/** Re-tessellate large boxes so per-vertex AO has resolution. */
function tessellated(g: T.BufferGeometry) {
  if (!(g instanceof T.BoxGeometry)) return g.clone();
  const { width: w, height: h, depth: d } = g.parameters,
    s = (v: number) => Math.max(1, Math.min(16, Math.round(v / 0.9)));
  if (w * h + h * d + w * d < 8) return g.clone();
  return new T.BoxGeometry(w, h, d, s(w), s(h), s(d));
}
function strip(g: T.BufferGeometry, indexed: boolean) {
  let out = indexed ? g : g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes))
    if (!["position", "normal", "uv", "color", "bakedLight"].includes(name))
      out.deleteAttribute(name);
  if (!out.attributes.uv)
    out.setAttribute(
      "uv",
      new T.BufferAttribute(
        new Float32Array(out.attributes.position.count * 2),
        2,
      ),
    );
  out = out.index && !indexed ? out.toNonIndexed() : out;
  return out;
}
export function colourise(g: T.BufferGeometry, o: BakeOptions, base?: T.Color) {
  const p = g.attributes.position,
    n = g.attributes.normal,
    c = new Float32Array(p.count * 3),
    l = new Float32Array(p.count * 3),
    v = new T.Vector3(),
    nn = new T.Vector3(),
    out = new T.Color(),
    lit = new T.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nn.fromBufferAttribute(n, i);
    bakeVertex(v, nn, o, out, lit);
    if (base) out.multiply(base);
    c.set([out.r, out.g, out.b], i * 3);
    l.set([lit.r, lit.g, lit.b], i * 3);
  }
  g.setAttribute("color", new T.BufferAttribute(c, 3));
  g.setAttribute("bakedLight", new T.BufferAttribute(l, 3));
}
/** Adds the baked radiance attribute as emission (x albedo). One shared
 * program for all baked materials thanks to the fixed cache key. */
/** Shared gain for all baked light (practical flicker without real lights). */
export const bakedGain = { value: 1 };
export function useBakedLight(m: T.MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.bakedGain = bakedGain;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 bakedLight;\nvarying vec3 vBakedLight;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvBakedLight = bakedLight;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vBakedLight;\nuniform float bakedGain;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vBakedLight * diffuseColor.rgb * bakedGain;",
      );
  };
  m.customProgramCacheKey = () => "baked-light-v1";
}
export type BakeResult = { merged: T.Mesh[]; sources: T.Mesh[] };
/** Merge every static opaque mesh under `root` into one mesh per material and
 * bake AO/light into vertex colours. Sources are detached (still usable for
 * raycasts: their world matrices are frozen) and returned for disposal. */
export function bakeStatic(
  root: T.Object3D,
  o: BakeOptions,
  exclude = new Set<T.Object3D>(),
): BakeResult {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert(),
    buckets = new Map<string, T.Mesh[]>(),
    sources: T.Mesh[] = [];
  root.traverse((m) => {
    if (m === root || !mergeable(m, exclude)) return;
    const mesh = m as T.Mesh,
      // Casters and non-casters stay apart so the flashlight shadow pass
      // only redraws what cast shadows before the merge.
      k = key(mesh.material as T.Material) + (mesh.castShadow ? "|c" : "");
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(mesh);
    sources.push(mesh);
  });
  const merged: T.Mesh[] = [];
  for (const meshes of buckets.values()) {
    const indexed = meshes.every((m) => !!m.geometry.index);
    const src = meshes[0].material as
        T.MeshStandardMaterial | T.MeshBasicMaterial,
      std = src instanceof T.MeshStandardMaterial;
    const parts = meshes.map((m) => {
      const g = strip(tessellated(m.geometry), indexed);
      g.applyMatrix4(m.matrixWorld);
      // Bake AO/light in room (world) space with the mesh's own paint colour.
      const base = (m.material as T.MeshStandardMaterial).color;
      if (std) colourise(g, o, base);
      else {
        const c = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < c.length; i += 3) {
          c[i] = base.r;
          c[i + 1] = base.g;
          c[i + 2] = base.b;
        }
        g.setAttribute("color", new T.BufferAttribute(c, 3));
      }
      g.applyMatrix4(inv);
      return g;
    });
    const g = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!g) continue;
    const mat = src.clone();
    mat.color.setHex(0xffffff);
    mat.vertexColors = true;
    if (mat instanceof T.MeshStandardMaterial) useBakedLight(mat);
    if (mat instanceof T.MeshStandardMaterial)
      mat.userData.detailBump =
        src.userData.detailBump ?? (src as T.MeshStandardMaterial).bumpMap;
    const mesh = new T.Mesh(g, mat);
    mesh.castShadow = meshes[0].castShadow;
    mesh.receiveShadow = true;
    mesh.name = "baked";
    mesh.userData.bakedFrom = meshes.length;
    root.add(mesh);
    merged.push(mesh);
  }
  for (const s of sources) s.parent?.remove(s);
  return { merged, sources };
}
export function dispose(meshes: T.Mesh[]) {
  for (const m of meshes) {
    m.geometry.dispose();
    (m.material as T.Material).dispose?.();
  }
}
