import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  authorZombieClips,
  inPlace,
  compactRigClips,
  type BonePose,
} from "./zombie-clips";
import type { Actor } from "./actors";
import type { Enemy, Region } from "./logic";
import type { Quality } from "./controls";
type Template = {
  gltf: GLTF;
  clips: T.AnimationClip[];
  bones: BonePose[];
  material: T.MeshStandardMaterial;
};
let templates: Template[] = [];
let pending: Promise<void> | undefined;
export const zombieAsset = {
  status: "loading",
  progress: 0,
  error: "",
  templates: 0,
};
const lowTextureCache = new WeakMap<T.Texture, T.Texture>();
const materialCache = new Map<string, T.MeshStandardMaterial>(),
  ownedTextures = new Set<T.Texture>();
const short = (name: string) => name.replace(/^mixamorig[:_]?/, "");
function template(gltf: GLTF): Template {
  const source = compactRigClips(gltf.animations.map(inPlace), gltf.scene),
    reference = clone(gltf.scene),
    mixer = new T.AnimationMixer(reference);
  const walking = source.find((c) => c.name === "Walking");
  if (!walking) throw Error("Modelo sem Walking");
  mixer.clipAction(walking).play();
  mixer.update(0.12);
  reference.updateMatrixWorld(true);
  const bones: BonePose[] = [];
  let material: T.MeshStandardMaterial | undefined;
  reference.traverse((o) => {
    if (o instanceof T.Bone)
      bones.push({
        name: o.name,
        short: short(o.name),
        position: o.position.clone(),
        quaternion: o.quaternion.clone(),
        scale: o.scale.clone(),
        parentRotation: o.parent!.getWorldQuaternion(new T.Quaternion()),
      });
  });
  gltf.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) {
      o.geometry.userData.zombieShared = true;
      material = o.material as T.MeshStandardMaterial;
      material.userData.zombieShared = true;
      for (const v of Object.values(material))
        if (v instanceof T.Texture) {
          v.userData.persistent = true;
          ownedTextures.add(v);
        }
    }
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(reference);
  if (!material || bones.length < 50)
    throw Error("Esqueleto/material do zumbi inválido");
  return {
    gltf,
    clips: compactRigClips(
      [...source, ...authorZombieClips(bones)],
      gltf.scene,
    ),
    bones,
    material,
  };
}
export function preloadZombie(progress?: (n: number) => void) {
  if (pending) return pending;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const urls = [
    new URL("./assets/zumbi-base.glb", import.meta.url).href,
    new URL("./assets/zumbi-lod.glb", import.meta.url).href,
  ];
  pending = Promise.all(
    urls.map((url, i) =>
      loader.loadAsync(url, (e) => {
        zombieAsset.progress = Math.min(
          99,
          Math.round(i * 50 + (e.total ? (e.loaded / e.total) * 50 : 0)),
        );
        progress?.(zombieAsset.progress);
      }),
    ),
  )
    .then((gs) => {
      templates = gs.map(template);
      zombieAsset.status = "ready";
      zombieAsset.progress = 100;
      zombieAsset.templates = templates.length;
      progress?.(100);
    })
    .catch((e: unknown) => {
      zombieAsset.status = "fallback";
      zombieAsset.error = String(e);
      throw e;
    });
  return pending;
}
function lowTexture(map: T.Texture) {
  const cached = lowTextureCache.get(map);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  canvas
    .getContext("2d")!
    .drawImage(map.image as CanvasImageSource, 0, 0, 512, 512);
  const t = new T.CanvasTexture(canvas);
  t.flipY = map.flipY;
  t.colorSpace = map.colorSpace;
  t.userData.persistent = true;
  t.anisotropy = 1;
  ownedTextures.add(t);
  lowTextureCache.set(map, t);
  return t;
}
function sharedMaterial(index: number, kind: string, quality: Quality) {
  const key = index + kind + quality;
  if (materialCache.has(key)) return materialCache.get(key)!;
  const m = templates[index].material.clone();
  m.userData.zombieShared = true;
  if (kind === "E02") m.color.multiply(new T.Color(0xb2c9bd));
  if (kind === "E04") m.color.multiply(new T.Color(0xc8aaa0));
  if (quality === "low") {
    m.normalMap = null;
    m.roughnessMap = null;
    m.metalnessMap = null;
    m.roughness = 0.95;
    m.metalness = 0;
    if (index === 0 && m.map) m.map = lowTexture(m.map);
    m.side = T.FrontSide;
  }
  materialCache.set(key, m);
  return m;
}
const loops = new Set(["Idle", "Walking", "Running", "Crawl"]);
class Rig {
  root: T.Group;
  mesh: T.SkinnedMesh;
  head: T.Bone;
  hitboxes: T.Mesh[] = [];
  mixer: T.AnimationMixer;
  stateName = "";
  current: T.AnimationAction | undefined;
  actions = new Map<string, T.AnimationAction>();
  tremor: T.AnimationAction;
  lastCrawl: boolean;
  fallUntil = 0;
  lastHit = 0;
  elapsed = 0;
  throttle = 0;
  updated = 0;
  quality: Quality = "medium";
  constructor(
    public index: number,
    public enemy: Enemy,
  ) {
    const t = templates[index];
    this.root = clone(t.gltf.scene) as T.Group;
    const bones = new Map<string, T.Bone>();
    let mesh: T.SkinnedMesh | undefined;
    this.root.traverse((o) => {
      if (o instanceof T.Bone) bones.set(short(o.name), o);
      if (o instanceof T.SkinnedMesh) {
        mesh = o;
        o.frustumCulled = false;
        o.receiveShadow = true;
        o.material = sharedMaterial(index, enemy.kind, this.quality);
      }
    });
    this.mesh = mesh!;
    this.head = bones.get("Head")!;
    this.mixer = new T.AnimationMixer(this.root);
    this.lastCrawl = enemy.crawl;
    // Establish authored reference pose before attaching anatomical hitboxes.
    this.mixer.clipAction(t.clips.find((c) => c.name === "Walking")!).play();
    this.mixer.update(0.12);
    this.mixer.stopAllAction();
    for (const b of t.bones) {
      const bone = bones.get(b.short);
      if (bone) {
        bone.position.copy(b.position);
        bone.quaternion.copy(b.quaternion);
        bone.scale.copy(b.scale);
      }
    }
    this.root.updateMatrixWorld(true);
    const hit = (
      bone: string,
      region: Region,
      size: [number, number, number],
      offset: [number, number, number],
    ) => {
      const parent = bones.get(bone)!;
      const inverse = parent.getWorldQuaternion(new T.Quaternion()).invert();
      const h = new T.Mesh(
        new T.BoxGeometry(...size),
        new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }),
      );
      h.position.set(...offset).applyQuaternion(inverse);
      h.quaternion.copy(inverse);
      h.userData = { enemyId: enemy.id, region };
      parent.add(h);
      this.hitboxes.push(h);
    };
    hit("Head", "head", [0.29, 0.34, 0.28], [0, 0.075, 0.015]);
    hit("Spine2", "body", [0.43, 0.56, 0.3], [0, -0.07, 0]);
    for (const side of ["Left", "Right"]) {
      const region = side === "Left" ? "legL" : "legR";
      hit(side + "UpLeg", region, [0.21, 0.45, 0.25], [0, -0.2, 0]);
      hit(side + "Leg", region, [0.2, 0.43, 0.24], [0, -0.18, 0]);
    }
    if (enemy.kind === "E02") {
      const cap = new T.Mesh(
        new T.BoxGeometry(0.29, 0.06, 0.21),
        new T.MeshStandardMaterial({ color: 0xb6c3ac, roughness: 0.95 }),
      );
      cap.position.set(0, 0.22, 0);
      this.head.add(cap);
    }
    this.tremor = this.mixer.clipAction(
      t.clips.find((c) => c.name === "Tremor")!,
    );
    this.tremor.setEffectiveWeight(0.25).play();
  }
  play(name: string, restart = false) {
    if (this.stateName === name && !restart) return;
    let next = this.actions.get(name);
    if (!next) {
      next = this.mixer.clipAction(
        templates[this.index].clips.find((c) => c.name === name)!,
      );
      this.actions.set(name, next);
    }
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(
      loops.has(name) ? T.LoopRepeat : T.LoopOnce,
      loops.has(name) ? Infinity : 1,
    );
    next.clampWhenFinished = !loops.has(name);
    next.play();
    if (this.current && this.current !== next) {
      this.current.fadeOut(0.12);
      next.fadeIn(0.12);
    }
    this.current = next;
    this.stateName = name;
  }
  update(
    e: Enemy,
    dt: number,
    visible: boolean,
    distance: number,
    speed: number,
    quality: Quality,
    preview?: string,
  ) {
    if (this.quality !== quality && !e.dead) {
      this.quality = quality;
      this.mesh.material = sharedMaterial(this.index, e.kind, quality);
    }
    this.mesh.castShadow = quality === "high" && distance < 7;
    if (!visible && !e.dead) return;
    this.throttle += dt;
    if (
      distance > (quality === "low" ? 4.8 : 9) &&
      this.throttle < 1 / (quality === "low" ? 12 : 20) &&
      !e.dead &&
      (!preview || preview === "Walking" || preview === "Running")
    )
      return;
    dt = Math.min(0.25, this.throttle);
    this.throttle = 0;
    this.elapsed += dt;
    if (e.crawl && !this.lastCrawl) {
      this.fallUntil = this.elapsed + 0.8;
      this.lastCrawl = true;
    }
    const name =
      preview ||
      (e.dead
        ? e.headGone || e.lastHit === "head"
          ? "DeathHead"
          : "Death"
        : e.crawl
          ? this.elapsed < this.fallUntil
            ? "LegFall"
            : e.state === "windup"
              ? "CrawlAttack"
              : "Crawl"
          : e.state === "charge"
            ? "Running"
            : e.state === "windup"
              ? "AttackBite"
              : e.state === "stun"
                ? e.lightStunned
                  ? "LightStun"
                  : e.lastHit === "head"
                    ? "HitHead"
                    : "HitTorso"
                : speed > 0.03
                  ? speed > 1.5
                    ? "Running"
                    : "Walking"
                  : "Idle");
    const restart =
      (e.hitSerial || 0) !== this.lastHit &&
      (name === "HitHead" || name === "HitTorso");
    this.lastHit = e.hitSerial || 0;
    this.play(name, restart);
    this.tremor.setEffectiveWeight(
      e.dead || name === "LegFall" ? 0 : name === "LightStun" ? 0.1 : 0.25,
    );
    this.mixer.update(dt);
    this.updated++;
    if (e.dead && this.current) {
      this.current.time = Math.min(
        this.current.getClip().duration - 0.001,
        Math.max(0, (Date.now() - e.deathAt) / 1000),
      );
      this.mixer.update(0);
    }
    const scale = templates[this.index].bones.find(
      (b) => b.short === "Head",
    )!.scale;
    this.head.scale.copy(scale).multiplyScalar(e.headGone ? 0.001 : 1);
    this.root.updateMatrixWorld(true);
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
  }
}
export type ZombieAnimator = {
  update: (
    e: Enemy,
    dt: number,
    visible: boolean,
    distance: number,
    speed: number,
    quality: Quality,
  ) => void;
  dispose: () => void;
  stateName: string;
  lod: number;
  mixersUpdated: number;
  preview?: string;
  fade: (alpha: number) => void;
};
export function zombieActor(e: Enemy): Actor | undefined {
  if (templates.length !== 2) return undefined;
  const root = new T.Group(),
    body = new T.Group(),
    warning = new T.Group();
  root.add(body, warning);
  const rigs = templates.map((_, i) => new Rig(i, e));
  rigs.forEach((r) => body.add(r.root));
  const ring = new T.Mesh(
    new T.RingGeometry(0.9, 0.94, 32),
    new T.MeshBasicMaterial({
      color: 0xd4a16b,
      transparent: true,
      opacity: 0.65,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  warning.add(ring);
  const actor: Actor = {
    root,
    body,
    head: rigs[0].head,
    arms: [],
    elbows: [],
    legs: [],
    knees: [],
    hitboxes: rigs[0].hitboxes,
    warning,
  };
  let previous = 0,
    fadeOwned = false;
  const animation: ZombieAnimator = {
    stateName: "Idle",
    lod: 0,
    mixersUpdated: 0,
    update(enemy, dt, visible, distance, speed, quality) {
      let index = this.lod;
      if (distance > (quality === "low" ? 5.2 : quality === "high" ? 11 : 8))
        index = 1;
      else if (distance < (quality === "low" ? 4 : quality === "high" ? 8 : 6))
        index = 0;
      if (index !== previous) {
        rigs[index].lastCrawl = enemy.crawl;
        rigs[index].fallUntil = 0;
        previous = index;
      }
      this.lod = index;
      rigs.forEach((r, i) => (r.root.visible = i === index));
      const rig = rigs[index];
      const before = rig.updated;
      rig.update(enemy, dt, visible, distance, speed, quality, this.preview);
      this.mixersUpdated += rig.updated - before;
      this.stateName = rig.stateName;
      actor.hitboxes = rig.hitboxes;
      actor.head = rig.head;
    },
    fade(alpha) {
      if (alpha >= 1) return;
      if (!fadeOwned) {
        for (const r of rigs) {
          const m = (r.mesh.material as T.MeshStandardMaterial).clone();
          m.userData.zombieShared = false;
          m.transparent = true;
          r.mesh.material = m;
        }
        fadeOwned = true;
      }
      for (const r of rigs) {
        r.root.traverse((o) => {
          if (o instanceof T.Mesh && !(o instanceof T.SkinnedMesh)) {
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              m.transparent = true;
              m.opacity = alpha;
              m.depthWrite = false;
            }
          }
        });
        const m = r.mesh.material as T.MeshStandardMaterial;
        m.opacity = alpha;
        m.depthWrite = false;
      }
    },
    dispose() {
      rigs.forEach((r) => r.dispose());
    },
  };
  actor.animation = animation;
  return actor;
}
export function zombieDiagnostics() {
  return {
    ...zombieAsset,
    materialVariants: materialCache.size,
    tracks: Object.fromEntries(
      templates[0]?.clips.map((c) => [c.name, c.tracks.length]) || [],
    ),
    clips: templates[0]?.clips.map((c) => c.name) || [],
    bones: templates[0]?.bones.length || 0,
  };
}

export function disposeZombieCache() {
  for (const m of materialCache.values()) m.dispose();
  materialCache.clear();
  for (const t of ownedTextures) t.dispose();
  ownedTextures.clear();
  for (const t of templates)
    t.gltf.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) {
        o.geometry.dispose();
        o.skeleton.dispose();
        (o.material as T.Material).dispose();
      }
    });
  templates = [];
}
if (typeof window !== "undefined")
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) disposeZombieCache();
  });
