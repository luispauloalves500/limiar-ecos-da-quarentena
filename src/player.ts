import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { inPlace, compactRigClips, type BonePose } from "./zombie-clips";
import {
  authorPlayerClips,
  maskedClip,
  playerDurations,
  bakeSupportGrip,
  supportGrip,
  PoseRestore,
} from "./player-clips";
import type { Actor } from "./actors";
import { measureStrides } from "./stride";
import {
  approach,
  breath,
  groundLift,
  hitReaction,
  leanAngle,
  moveBlend,
  recoilKick,
  strideScale,
  wrap,
} from "./locomotion";
import type { Quality } from "./controls";
let gltf: GLTF | undefined,
  clips: T.AnimationClip[] = [];
const bones: BonePose[] = [];
/** Measured planted-foot speed (m/s at timeScale 1) of each locomotion clip. */
export const strideSpeeds: Record<string, number> = {};
let ankleHeight = 0.08;
const LOCOMOTION = ["Walking", "Running", "Sneaky_Walk_inplace", "InjuredWalk", "WalkAim"];
let pending: Promise<void> | undefined;
export const playerAsset = { status: "loading", error: "", progress: 0 };
const textures = new Set<T.Texture>(),
  materials = new Map<Quality, T.MeshStandardMaterial>();
let original: T.MeshStandardMaterial;
const short = (n: string) => n.replace(/^mixamorig[:_]?/, "");
export function preloadPlayer(progress?: (n: number) => void) {
  if (pending) return pending;
  pending = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(new URL("./assets/player.glb", import.meta.url).href, (e) => {
      playerAsset.progress = e.total
        ? Math.round((e.loaded / e.total) * 100)
        : 0;
      progress?.(playerAsset.progress);
    })
    .then((g) => {
      gltf = g;
      const reference = clone(g.scene),
        rest = new Map<string, { q: T.Quaternion; p: T.Vector3 }>();
      reference.traverse((o) => {
        if (o instanceof T.Bone)
          rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() });
      });
      const source = g.animations.map(inPlace),
        walk = source.find((c) => c.name === "Walking");
      if (!walk) throw Error("Player sem Walking");
      const mixer = new T.AnimationMixer(reference);
      mixer.clipAction(walk).play();
      mixer.update(0.12);
      reference.traverse((o) => {
        if (o instanceof T.Bone && /Hips|Leg|Foot|Toe/.test(o.name)) {
          const r = rest.get(o.name)!;
          o.quaternion.copy(r.q);
          o.position.copy(r.p);
        }
      });
      reference.updateMatrixWorld(true);
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
      mixer.stopAllAction();
      mixer.uncacheRoot(reference);
      g.scene.traverse((o) => {
        if (o instanceof T.SkinnedMesh) {
          o.geometry.userData.zombieShared = true;
          original = o.material as T.MeshStandardMaterial;
          original.userData.zombieShared = true;
          for (const t of Object.values(original))
            if (t instanceof T.Texture) {
              t.userData.persistent = true;
              textures.add(t);
            }
        }
      });
      const authored = authorPlayerClips(bones);
      bakeSupportGrip(authored, clone(g.scene));
      clips = compactRigClips([...source, ...authored], g.scene);
      const measured = measureStrides(g.scene, clips, LOCOMOTION);
      Object.assign(strideSpeeds, measured.speeds);
      ankleHeight = measured.ankle;
      playerAsset.status = "ready";
      playerAsset.progress = 100;
      progress?.(100);
    })
    .catch((e: unknown) => {
      playerAsset.status = "fallback";
      playerAsset.error = String(e);
      throw e;
    });
  return pending;
}
function material(quality: Quality) {
  if (materials.has(quality)) return materials.get(quality)!;
  const m = original.clone();
  m.userData.zombieShared = true;
  m.side = T.FrontSide;
  if (quality === "low") {
    m.normalMap = null;
    m.metalnessMap = null;
    m.roughnessMap = null;
    m.roughness = 0.95;
    m.metalness = 0;
    if (m.map) {
      const c = document.createElement("canvas");
      c.width = c.height = 512;
      c.getContext("2d")!.drawImage(
        m.map.image as CanvasImageSource,
        0,
        0,
        512,
        512,
      );
      const t = new T.CanvasTexture(c);
      t.colorSpace = m.map.colorSpace;
      t.flipY = m.map.flipY;
      t.userData.persistent = true;
      textures.add(t);
      m.map = t;
    }
  }
  materials.set(quality, m);
  return m;
}
export type PlayerFrame = {
  moving: boolean;
  aiming: boolean;
  running: boolean;
  cautious: boolean;
  reloading: boolean;
  hp: number;
  light: boolean;
  pitch: number;
  yawDelta: number;
  aimPoint?: T.Vector3;
  /** 0.6 locomotion: body-local velocity (m/s, +z forward) and yaw rate. */
  localX?: number;
  localZ?: number;
  yawRate?: number;
};
const looping = new Set([
  "PlayerIdle",
  "Walking",
  "Running",
  "Sneaky_Walk_inplace",
  "Aim",
  "WalkAim",
  "Flashlight",
  "InjuredWalk",
]);
export class PlayerAnimator {
  mixer: T.AnimationMixer;
  bones = new Map<string, T.Bone>();
  mesh: T.SkinnedMesh;
  gun: T.Group;
  lamp: T.Group;
  barrel = new T.Object3D();
  lampTip = new T.Object3D();
  channels: { name: string; action?: T.AnimationAction }[] = [
    { name: "" },
    { name: "" },
  ];
  actions = new Map<string, T.AnimationAction>();
  time = 0;
  event = "";
  until = 0;
  preview = "";
  previewAt: number | undefined;
  state = "PlayerIdle";
  aimPoint = new T.Vector3();
  poseRestore: PoseRestore;
  gunBind = new T.Quaternion();
  quality: Quality = "medium";
  // 0.6 procedural layers (all additive on top of the mixer, no extra mixer).
  lean = 0;
  hipsYaw = 0;
  speed = 0;
  hitAngle = 0;
  hitAt = -9;
  fireAt = -9;
  lift = 0;
  timeScale = 1;
  blend = "idle";
  constructor(public root: T.Group) {
    let mesh: T.SkinnedMesh | undefined;
    root.traverse((o) => {
      if (o instanceof T.Bone) this.bones.set(short(o.name), o);
      if (o instanceof T.SkinnedMesh) {
        mesh = o;
        o.frustumCulled = false;
        o.receiveShadow = true;
        o.material = material("medium");
      }
    });
    this.poseRestore = new PoseRestore(
      [
        "Hips",
        "Spine",
        "Spine1",
        "Spine2",
        "LeftArm",
        "RightArm",
        "LeftForeArm",
        "RightForeArm",
        "LeftUpLeg",
        "RightUpLeg",
        "LeftLeg",
        "RightLeg",
      ].map(
        (n) => this.bones.get(n)!,
      ),
    );
    this.mesh = mesh!;
    for (const b of bones) {
      const bone = this.bones.get(b.short)!;
      bone.position.copy(b.position);
      bone.quaternion.copy(b.quaternion);
    }
    root.updateMatrixWorld(true);
    this.mixer = new T.AnimationMixer(root);
    const steel = new T.MeshStandardMaterial({
        color: 0x657478,
        metalness: 0.65,
        roughness: 0.38,
      }),
      grip = new T.MeshStandardMaterial({ color: 0x202222, roughness: 0.8 });
    const box = (
      x: number,
      y: number,
      z: number,
      m: T.Material,
      px = 0,
      py = 0,
      pz = 0,
    ) => {
      const o = new T.Mesh(new T.BoxGeometry(x, y, z), m);
      o.position.set(px, py, pz);
      return o;
    };
    this.gun = new T.Group();
    this.gun.add(
      box(0.065, 0.07, 0.25, steel, 0, 0, 0.12),
      box(0.06, 0.11, 0.085, grip, 0, -0.055, 0.02),
    );
    this.barrel.position.set(0, 0, 0.26);
    this.gun.add(this.barrel);
    this.lamp = new T.Group();
    const bulb = new T.MeshStandardMaterial({
      color: 0xd9e1cc,
      emissive: 0x829a69,
      emissiveIntensity: 0.6,
      roughness: 0.5,
    });
    this.lamp.add(
      box(0.06, 0.18, 0.065, steel, 0, -0.08, 0),
      box(0.066, 0.012, 0.068, bulb, 0, -0.18, 0),
    );
    this.lampTip.position.set(0, -0.19, 0);
    this.lamp.add(this.lampTip);
    for (const [hand, item] of [
      ["RightHand", this.gun],
      ["LeftHand", this.lamp],
    ] as const) {
      const b = this.bones.get(hand)!;
      item.quaternion.copy(b.getWorldQuaternion(new T.Quaternion()).invert());
      item.position.set(0, -0.035, 0.015).applyQuaternion(item.quaternion);
      if (hand === "RightHand") item.rotateX(Math.PI / 2);
      b.add(item);
    }
    this.gunBind.copy(this.gun.quaternion);
  }
  /** Directional damage: world angle from Helena toward the attacker. */
  hitFrom(worldAngle: number) {
    this.hitAngle = worldAngle;
    this.hitAt = this.time;
  }
  /** Rotate a bone by a delta expressed in the actor's (bind-time) frame. */
  rotate(name: string, x: number, y: number, z: number) {
    if (!x && !y && !z) return;
    const bone = this.bones.get(name),
      b = bones.find((b) => b.short === name);
    if (!bone || !b) return;
    const delta = new T.Quaternion().setFromEuler(new T.Euler(x, y, z, "YXZ"));
    bone.quaternion.premultiply(
      b.parentRotation.clone().invert().multiply(delta).multiply(b.parentRotation),
    );
  }
  trigger(name: string) {
    if (name === "Fire") this.fireAt = this.time;
    this.event = name;
    this.until =
      this.time +
      (playerDurations[name as keyof typeof playerDurations] || 0.4);
  }
  action(name: string, upper: boolean) {
    const key = name + (upper ? "Upper" : "Lower");
    if (!this.actions.has(key)) {
      const c =
        clips.find((c) => c.name === name) ||
        clips.find((c) => c.name === "PlayerIdle")!;
      const a = this.mixer.clipAction(maskedClip(c, upper));
      a.setLoop(looping.has(name) ? T.LoopRepeat : T.LoopOnce, Infinity);
      a.clampWhenFinished = !looping.has(name);
      this.actions.set(key, a);
    }
    return this.actions.get(key)!;
  }
  update(dt: number, f: PlayerFrame, quality: Quality) {
    this.poseRestore.restore();
    this.gun.quaternion.copy(this.gunBind);
    this.time += dt;
    if (this.event && this.time >= this.until) {
      if (this.event === "Grabbed") this.trigger("BreakFree");
      else this.event = "";
    }
    let base =
      f.hp <= 0
        ? "PlayerDeath"
        : this.event === "QuickTurn"
          ? "QuickTurn"
          : f.moving
            ? f.hp <= 30
              ? "InjuredWalk"
              : f.cautious
                ? "Sneaky_Walk_inplace"
                : f.running && !f.aiming
                  ? "Running"
                  : "Walking"
            : "PlayerIdle";
    let upper =
      f.hp <= 0
        ? "PlayerDeath"
        : this.event ||
          (f.reloading
            ? "Reload"
            : f.aiming
              ? f.moving
                ? "WalkAim"
                : "Aim"
              : f.hp <= 30
                ? "InjuredWalk"
                : f.light
                  ? "Flashlight"
                  : "PlayerIdle");
    if (this.preview) {
      if (
        [
          "Walking",
          "Running",
          "Sneaky_Walk_inplace",
          "InjuredWalk",
          "PlayerDeath",
          "QuickTurn",
        ].includes(this.preview)
      )
        base = upper = this.preview;
      else upper = this.preview;
    }
    const lx = f.localX ?? 0,
      lz = f.localZ ?? (f.moving ? 1 : 0),
      speed = f.localX === undefined && f.localZ === undefined
        ? f.moving ? 1 : 0
        : Math.hypot(lx, lz);
    this.speed = approach(this.speed, speed, dt, 12);
    const mb = moveBlend(lx, lz, f.aiming && f.moving && f.hp > 0);
    this.blend = f.moving ? mb.mode : "idle";
    // Aiming locomotion: legs walk the real direction (back-pedal or twisted
    // hips for a sidestep) while the chest stays on the reticle.
    this.hipsYaw = approach(this.hipsYaw, f.moving && f.hp > 0 && !this.preview ? mb.hipsYaw : 0, dt, 10);
    this.state = upper === "PlayerIdle" ? base : upper;
    [base, upper].forEach((name, index) => {
      const channel = this.channels[index];
      if (channel.name !== name) {
        const a = this.action(name, index === 1)
          .reset()
          .setEffectiveWeight(1)
          .play();
        if (channel.action) a.crossFadeFrom(channel.action, 0.18, false);
        channel.action = a;
        channel.name = name;
      }
    });
    if (this.channels[0].action) {
      // Stride sync: play the cycle at the rate its planted foot matches the
      // real ground speed (no foot sliding); negative when back-pedalling.
      const native = strideSpeeds[this.channels[0].name];
      const legacy = f.moving
        ? f.aiming
          ? 0.45
          : f.cautious
            ? 0.68
            : f.running
              ? 1.12
              : 1
        : 1;
      const target =
        f.moving && native && f.localZ !== undefined && !this.preview
          ? strideScale(this.speed, native) * (mb.reverse ? -1 : 1)
          : legacy;
      this.timeScale = approach(this.timeScale, target, dt, 14);
      this.channels[0].action.setEffectiveTimeScale(this.timeScale);
    }
    this.mixer.update(dt);
    if (this.preview && this.previewAt !== undefined) {
      this.channels.forEach((c) => {
        if (c.action) c.action.time = this.previewAt!;
      });
      this.mixer.update(0);
    }
    this.poseRestore.capture();
    if (f.hp > 0 && !this.preview) {
      // Lean into turns, hips twist for aimed sidesteps, counter-rotated spine.
      this.lean = approach(this.lean, f.moving ? leanAngle(f.yawRate ?? 0, this.speed) : 0, dt, 8);
      this.rotate("Hips", 0, this.hipsYaw, this.lean);
      this.rotate("Spine", 0, -this.hipsYaw * 0.5, -this.lean * 0.4);
      this.rotate("Spine1", 0, -this.hipsYaw * 0.5, 0);
      // Breathing/micro-motion, stronger and faster when hurt.
      const b = breath(this.time, f.hp),
        still = f.moving ? 0.35 : 1;
      this.rotate("Spine2", b.chest * still * (f.aiming ? 0.4 : 1), 0, b.sway * still);
      // Directional damage: bend away from the hit, twist toward its side.
      const yaw = this.root.parent?.rotation.y ?? 0,
        h = hitReaction(wrap(this.hitAngle - yaw), this.time - this.hitAt);
      this.rotate("Spine1", h.bend, h.twist, 0);
      this.rotate("Neck", h.bend * 0.6, h.twist * 0.5, 0);
    }
    if (
      (f.aiming || ["Aim", "WalkAim", "Fire"].includes(this.preview)) &&
      f.hp > 0 &&
      upper !== "Reload"
    )
      for (const [name, factor] of [
        ["Spine2", 0.6],
        ["LeftArm", 0.4],
        ["RightArm", 0.4],
      ] as const) {
        const bone = this.bones.get(name)!,
          b = bones.find((b) => b.short === name)!,
          delta = new T.Quaternion().setFromEuler(
            new T.Euler(
              -f.pitch * factor,
              T.MathUtils.clamp(f.yawDelta, -0.4, 0.4) * factor,
              0,
            ),
          );
        bone.quaternion.premultiply(
          b.parentRotation
            .clone()
            .invert()
            .multiply(delta)
            .multiply(b.parentRotation),
        );
      }
    // Solve the real gameplay aim, not only a staged gallery pose. Keep the
    // shoulder and elbow anatomical, and converge the barrel on the reticle.
    if (
      f.aimPoint &&
      (f.aiming || upper === "Fire") &&
      upper !== "Reload" &&
      f.hp > 0
    ) {
      this.aimPoint.copy(f.aimPoint);
      const actor = this.root.parent || this.root;
      actor.updateMatrixWorld(true);
      const right = this.bones.get("RightHand")!;
      const handTarget = actor.localToWorld(
        new T.Vector3(
          -0.19,
          1.43 + Math.sin(f.pitch) * 0.35 + recoilKick(this.time - this.fireAt) * 0.045,
          0.44 - recoilKick(this.time - this.fireAt) * 0.06,
        ),
      );
      supportGrip(
        this.root,
        this.bones.get("RightArm")!,
        this.bones.get("RightForeArm")!,
        right,
        handTarget,
        3,
      );
      const handPos = right.getWorldPosition(new T.Vector3());
      const q = new T.Quaternion()
        .setFromRotationMatrix(
          new T.Matrix4().lookAt(f.aimPoint, handPos, new T.Vector3(0, 1, 0)),
        )
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(1, 0, 0),
            -recoilKick(this.time - this.fireAt) * 0.16,
          ),
        );
      this.gun.quaternion.copy(
        right.getWorldQuaternion(new T.Quaternion()).invert().multiply(q),
      );
      const support = this.gun.localToWorld(new T.Vector3(0.015, -0.03, 0.025));
      supportGrip(
        this.root,
        this.bones.get("LeftArm")!,
        this.bones.get("LeftForeArm")!,
        this.bones.get("LeftHand")!,
        support,
        3,
      );
    }
    // A held weapon never disappears during a reach/door/reload. The left hand
    // performs interactions; keep the right at a relaxed, reachable low ready.
    if (
      f.hp > 0 &&
      !f.aiming &&
      !["Fire", "Reload", "Grabbed", "BreakFree", "Hit"].includes(upper)
    ) {
      const actor = this.root.parent || this.root;
      const target = actor.localToWorld(
        new T.Vector3(
          -0.23,
          0.98 + (f.moving ? Math.sin(this.time * 7) * 0.025 : 0),
          0.16,
        ),
      );
      supportGrip(
        this.root,
        this.bones.get("RightArm")!,
        this.bones.get("RightForeArm")!,
        this.bones.get("RightHand")!,
        target,
        3,
      );
    }
    if (
      f.light &&
      !f.aiming &&
      !["Reload", "Interact", "Door", "Hit", "Grabbed", "BreakFree"].includes(
        upper,
      ) &&
      f.hp > 0
    ) {
      const actor = this.root.parent || this.root;
      supportGrip(
        this.root,
        this.bones.get("LeftArm")!,
        this.bones.get("LeftForeArm")!,
        this.bones.get("LeftHand")!,
        actor.localToWorld(new T.Vector3(0.24, 1.24, 0.35)),
        3,
      );
    }
    if (!f.aiming && upper !== "Fire") {
      const actor = this.root.parent || this.root;
      actor.updateMatrixWorld(true);
      const q = actor
        .getWorldQuaternion(new T.Quaternion())
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(1, 0, 0),
            upper === "Reload" ? 0.35 : 1.0,
          ),
        );
      this.gun.quaternion.copy(
        this.bones
          .get("RightHand")!
          .getWorldQuaternion(new T.Quaternion())
          .invert()
          .multiply(q),
      );
    }
    this.groundFeet(f.hp <= 0);
    this.gun.visible = true;
    this.lamp.visible = f.light;
    this.mesh.castShadow = quality === "high";
    if (this.quality !== quality) {
      this.quality = quality;
      this.mesh.material = material(quality);
    }
    this.root.updateMatrixWorld(true);
  }
  /** Flat-floor foot IK: a foot that the additive layers pushed below the
   * floor is pulled back to ankle height with a 2-bone CCD (UpLeg/Leg).
   * When dead, lift the whole body so the corpse never sinks. */
  groundFeet(dead: boolean) {
    this.root.updateMatrixWorld(true);
    const w = new T.Vector3();
    if (dead) {
      let low = Infinity;
      for (const n of ["Head", "Hips", "LeftHand", "RightHand", "LeftFoot", "RightFoot"]) {
        const b = this.bones.get(n);
        if (b) low = Math.min(low, b.getWorldPosition(w).y - this.lift);
      }
      this.lift = groundLift(low, 0.05);
      this.root.position.y = this.lift;
      return;
    }
    if (this.lift) this.root.position.y = this.lift = 0;
    for (const side of ["Left", "Right"]) {
      const foot = this.bones.get(side + "Foot");
      if (!foot) continue;
      const p = foot.getWorldPosition(new T.Vector3()),
        floor = (this.root.parent?.position.y ?? 0) + ankleHeight * 0.92;
      if (p.y >= floor) continue;
      p.y = floor;
      supportGrip(
        this.root,
        this.bones.get(side + "UpLeg")!,
        this.bones.get(side + "Leg")!,
        foot,
        p,
        2,
      );
    }
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
  }
  diagnostic() {
    return {
      state: this.state,
      blend: this.blend,
      timeScale: this.timeScale,
      lean: this.lean,
      hipsYaw: this.hipsYaw,
      base: this.channels[0].name,
      upper: this.channels[1].name,
      bones: this.bones.size,
      model: "supplied",
      position: this.root.getWorldPosition(new T.Vector3()).toArray(),
      gun: this.barrel.getWorldPosition(new T.Vector3()).toArray(),
      aimPoint: this.aimPoint.toArray(),
      gunDirection: new T.Vector3(0, 0, 1)
        .applyQuaternion(this.barrel.getWorldQuaternion(new T.Quaternion()))
        .toArray(),
      barrelDirection: this.barrel
        .getWorldQuaternion(new T.Quaternion())
        .toArray(),
      gunVisible: this.gun.visible,
      gunParent: this.gun.parent?.name,
      hand: this.bones
        .get("RightHand")!
        .getWorldPosition(new T.Vector3())
        .toArray(),
    };
  }
}
export function playerActor():
  { actor: Actor; animation: PlayerAnimator } | undefined {
  if (!gltf || playerAsset.status !== "ready") return;
  const root = new T.Group(),
    body = clone(gltf.scene) as T.Group;
  root.add(body);
  const animation = new PlayerAnimator(body);
  return {
    actor: {
      root,
      body,
      head: animation.bones.get("Head")!,
      arms: [],
      elbows: [],
      legs: [],
      knees: [],
      hitboxes: [],
      warning: new T.Group(),
      gun: animation.gun,
    },
    animation,
  };
}
export function playerDiagnostics() {
  return {
    ...playerAsset,
    bones: bones.length,
    tracks: Object.fromEntries(clips.map((c) => [c.name, c.tracks.length])),
    clips: clips.map((c) => c.name),
    strideSpeeds,
    ankleHeight,
  };
}
export function disposePlayerCache() {
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  gltf?.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) {
      o.geometry.dispose();
      o.skeleton.dispose();
    }
  });
  original?.dispose();
}
