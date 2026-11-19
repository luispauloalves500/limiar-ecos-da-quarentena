// 0.9: skinned GLB characters supplied by the user (Blender "SmartRig",
// Bone_000…, no animation clips). Loaded lazily for the pediatric wing and
// posed procedurally: every frame bones start from the bind pose and receive
// rotations expressed in model space (+Z forward, +Y up).
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/** Pediatric wing (GDD chapter 2): where the GLB characters live. */
export const CHAPTER2 = new Set<string>([
  "espera",
  "abrigo",
  "recreio",
  "bercario",
  "leitos",
  "circulo",
  "visor",
]);
export type SmartName = "rastejador" | "preceptora" | "porteiro";
const urls: Record<SmartName, string> = {
  rastejador: new URL("./assets/rastejador.glb", import.meta.url).href,
  preceptora: new URL("./assets/preceptora.glb", import.meta.url).href,
  porteiro: new URL("./assets/porteiro.glb", import.meta.url).href,
};
const templates = new Map<SmartName, GLTF>();
const pendingByName = new Map<SmartName, Promise<void>>();
export const smartAsset = {
  status: "idle" as "idle" | "loading" | "ready" | "fallback",
  error: "",
  loaded: [] as string[],
};
let loader: GLTFLoader | undefined;
function loadSmart(n: SmartName) {
  const hit = pendingByName.get(n);
  if (hit) return hit;
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const p = loader.loadAsync(urls[n]).then((g) => {
    g.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) {
        o.geometry.userData.zombieShared = true;
        const m = o.material as T.MeshStandardMaterial;
        for (const v of Object.values(m))
          if (v instanceof T.Texture) v.userData.persistent = true;
      }
    });
    templates.set(n, g);
    smartAsset.loaded.push(n);
  });
  pendingByName.set(n, p);
  return p;
}
function track(p: Promise<unknown>) {
  if (smartAsset.status !== "ready") smartAsset.status = "loading";
  return p
    .then(() => {
      smartAsset.status = "ready";
    })
    .catch((e: unknown) => {
      smartAsset.status = "fallback";
      smartAsset.error = String(e);
    });
}
let pending: Promise<void> | undefined;
/** Chapter-2 characters. Safe to call many times; resolves once. */
export function preloadChapter2() {
  pending ??= track(
    Promise.all([loadSmart("rastejador"), loadSmart("preceptora")]),
  );
  return pending;
}
let porteiroPending: Promise<void> | undefined;
/** 0.11: the Porteiro (B01) GLB, fetched while Helena is still in the early
 * chapter-1 rooms so the átrio never shows the stand-in. */
export function preloadPorteiro() {
  porteiroPending ??= track(loadSmart("porteiro"));
  return porteiroPending;
}
export function smartReady(n: SmartName) {
  return templates.has(n);
}

const qa = new T.Quaternion(),
  qb = new T.Quaternion(),
  va = new T.Vector3();
/** One posable instance of a SmartRig GLB. */
export class SmartSkin {
  scene: T.Group;
  mesh!: T.SkinnedMesh;
  material: T.MeshStandardMaterial;
  bones = new Map<string, T.Bone>();
  bindQ = new Map<T.Bone, T.Quaternion>();
  bindP = new Map<T.Bone, T.Vector3>();
  /** Bind rotation of every bone relative to `scene` (model space). */
  restModel = new Map<T.Bone, T.Quaternion>();
  constructor(name: SmartName, material?: T.MeshStandardMaterial) {
    const g = templates.get(name);
    if (!g) throw Error("SmartRig não carregado: " + name);
    this.scene = clone(g.scene) as T.Group;
    let mat: T.MeshStandardMaterial | undefined;
    this.scene.traverse((o) => {
      if (o instanceof T.Bone) {
        this.bones.set(o.name, o);
        this.bindQ.set(o, o.quaternion.clone());
        this.bindP.set(o, o.position.clone());
      }
      if (o instanceof T.SkinnedMesh) {
        this.mesh = o;
        o.frustumCulled = false;
        o.receiveShadow = true;
        mat = o.material as T.MeshStandardMaterial;
      }
    });
    this.material = material || mat!;
    this.mesh.material = this.material;
    this.scene.updateMatrixWorld(true);
    for (const b of this.bones.values())
      this.restModel.set(b, this.modelQuat(b, new T.Quaternion()));
  }
  bone(name: string) {
    const b = this.bones.get(name);
    if (!b) throw Error("osso ausente " + name);
    return b;
  }
  /** Current rotation of `o` relative to the skin scene (walks parents). */
  modelQuat(o: T.Object3D, out: T.Quaternion) {
    out.identity();
    let n: T.Object3D | null = o;
    while (n && n !== this.scene) {
      out.premultiply(n.quaternion);
      n = n.parent;
    }
    return out;
  }
  reset() {
    for (const [b, q] of this.bindQ) b.quaternion.copy(q);
    for (const [b, p] of this.bindP) b.position.copy(p);
  }
  /** Rotate a bone about a model-space axis through its own pivot. */
  turn(name: string, axis: T.Vector3, angle: number) {
    if (!angle) return;
    const b = this.bone(name);
    const parent = this.modelQuat(b.parent!, qa);
    qb.setFromAxisAngle(axis, angle);
    // local' = P⁻¹ · R · P · local
    b.quaternion.premultiply(
      parent.clone().invert().multiply(qb).multiply(parent),
    );
  }
  /** Set a bone so that its model-space rotation equals `target`. */
  setModel(name: string, target: T.Quaternion) {
    const b = this.bone(name);
    const parent = this.modelQuat(b.parent!, qa);
    b.quaternion.copy(parent.invert().multiply(target));
  }
  /** Model-space position of a bone right now. */
  modelPos(name: string, out = va) {
    const b = this.bone(name);
    this.scene.updateMatrixWorld(true);
    out.setFromMatrixPosition(b.matrixWorld);
    return this.scene.worldToLocal(out);
  }
  /** Attach an object to a bone keeping a model-space bind placement. */
  pin(name: string, o: T.Object3D, modelPosition: T.Vector3) {
    this.scene.add(o);
    o.position.copy(modelPosition);
    o.quaternion.identity();
    this.scene.updateMatrixWorld(true);
    this.bone(name).attach(o);
  }
}

/** Shared PBR material per skin + quality, lit by the room probe the same
 * way as the zombies (probe × albedo into emissive). */
const matCache = new Map<string, T.MeshStandardMaterial>();
const probe = new T.Color(0, 0, 0);
export function setSmartProbe(c: T.Color) {
  probe.copy(c);
  for (const m of matCache.values()) applyProbe(m);
}
function applyProbe(m: T.MeshStandardMaterial) {
  const gain = (m.userData.probeGain as number) ?? 1;
  m.emissive.copy(probe).multiplyScalar(gain);
}
export function smartMaterial(
  name: SmartName,
  quality: "low" | "medium" | "high",
  setup?: (m: T.MeshStandardMaterial) => void,
) {
  const key = name + quality;
  const hit = matCache.get(key);
  if (hit) return hit;
  let base: T.MeshStandardMaterial | undefined;
  templates.get(name)!.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) base = o.material as T.MeshStandardMaterial;
  });
  const m = base!.clone();
  m.userData.zombieShared = true;
  m.emissiveMap = m.map;
  m.side = T.DoubleSide;
  if (quality === "low") {
    m.normalMap = null;
    m.roughnessMap = null;
    m.metalnessMap = null;
  }
  m.metalness = 0;
  m.roughness = 0.9;
  setup?.(m);
  applyProbe(m);
  matCache.set(key, m);
  return m;
}
