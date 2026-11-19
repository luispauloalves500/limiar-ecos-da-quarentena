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
  aimSettle,
  approach,
  breath,
  groundLift,
  hitReaction,
  leanAngle,
  moveBlend,
  recoilKick,
  strideScale,
  walkStyle,
  weightShift,
  wrap,
} from "./locomotion";
import type { Quality } from "./controls";
let gltf: GLTF | undefined,
  clips: T.AnimationClip[] = [];
const bones: BonePose[] = [];
/** Measured planted-foot speed (m/s at timeScale 1) of each locomotion clip. */
export const strideSpeeds: Record<string, number> = {};
/** 0.11: loop-time offset where each locomotion clip's left foot leads. */
export const gaitPhases: Record<string, number> = {};
/** Style weight of the feminine walk layer per base clip. */
const STYLE: Record<string, number> = {
  Walking: 1,
  Running: 0.5,
  Sneaky_Walk_inplace: 0.45,
  InjuredWalk: 0.15,
};
let ankleHeight = 0.08;
const probe = new T.Color(0, 0, 0);
export function setPlayerProbe(c: T.Color) {
  probe.copy(c);
  materials.forEach((m) => m.emissive.copy(c));
}
const LOCOMOTION = [
  "Walking",
  "Running",
  "Sneaky_Walk_inplace",
  "InjuredWalk",
  "WalkAim",
];
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
      Object.assign(gaitPhases, measured.phases);
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
/** 0.11: ponytail sway (mesh units, body frame), written by the animator. */
export const hairSway = { value: new T.Vector3() };
/** Bind-space mask of the ponytail (behind and below the crown; the GLB has
 * no hair bones), so the vertex shader can swing it before skinning. */
export const HAIR_MASK = `
  float hairY = smoothstep(0.88, 0.8, position.y) * smoothstep(0.5, 0.6, position.y);
  float hairZ = smoothstep(-0.1, -0.135, position.z);
  float hairX = 1.0 - smoothstep(0.07, 0.12, abs(position.x));
  float hairW = hairY * hairZ * hairX * clamp((0.84 - position.y) * 3.5, 0.0, 1.0);
`;
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
  // 0.6 light probe: actors are lit by baked room light through emission
  // (albedo x probe colour) instead of extra dynamic PointLights.
  m.emissiveMap = m.map;
  m.emissive.copy(probe);
  m.emissiveIntensity = 1;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.hairSway = hairSway;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 hairSway;")
      .replace(
        "#include <skinning_vertex>",
        HAIR_MASK +
          "transformed += hairSway * hairW;\n#include <skinning_vertex>",
      );
  };
  m.customProgramCacheKey = () => "helena-hair";
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
  turnUntil = -1;
  gunBind = new T.Quaternion();
  quality: Quality = "medium";
  // 0.6 procedural layers (all additive on top of the mixer, no extra mixer).
  lean = 0;
  hipsYaw = 0;
  tmpFoot = new T.Vector3();
  planted = [false, false];
  plantW = [0, 0];
  lockX = [0, 0];
  speed = 0;
  hitAngle = 0;
  hitAt = -9;
  fireAt = -9;
  lift = 0;
  timeScale = 1;
  blend = "idle";
  // 0.11 body layers: walk style, idle weight, aim settle, reload, hair.
  style = 0;
  idleWeight = 0;
  reloadBody = 0;
  aimAt = -9;
  wasAiming = false;
  hipsPos = new T.Vector3();
  /** QA: turn the 0.11 body layers off for before/after sheets. */
  styleOff = false;
  hipsCaptured = false;
  gait = 0;
  hair = new T.Vector3();
  hairV = new T.Vector3();
  lastLocal = new T.Vector2();
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
        "Neck",
        "Head",
        "LeftShoulder",
        "RightShoulder",
      ]
        .map((n) => this.bones.get(n)!)
        .filter(Boolean),
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
      b.parentRotation
        .clone()
        .invert()
        .multiply(delta)
        .multiply(b.parentRotation),
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
    const hips = this.bones.get("Hips");
    if (hips && this.hipsCaptured) hips.position.copy(this.hipsPos);
    this.gun.quaternion.copy(this.gunBind);
    this.time += dt;
    if (this.event && this.time >= this.until) {
      if (this.event === "Grabbed") this.trigger("BreakFree");
      else this.event = "";
    }
    // 0.10 turn in place: a standing yaw change (raising the gun, a mouse
    // flick) shuffles the feet for a moment instead of pivoting on them.
    if (!f.moving && f.hp > 0 && Math.abs(f.yawRate ?? 0) > 1.4)
      this.turnUntil = this.time + 0.3;
    const turning = !f.moving && this.time < this.turnUntil;
    let base =
      f.hp <= 0
        ? "PlayerDeath"
        : this.event === "QuickTurn"
          ? "QuickTurn"
          : turning && !this.event
            ? "Walking"
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
      speed =
        f.localX === undefined && f.localZ === undefined
          ? f.moving
            ? 1
            : 0
          : Math.hypot(lx, lz);
    this.speed = approach(this.speed, speed, dt, 12);
    const mb = moveBlend(lx, lz, f.aiming && f.moving && f.hp > 0);
    this.blend = f.moving ? mb.mode : "idle";
    // Aiming locomotion: legs walk the real direction (back-pedal or twisted
    // hips for a sidestep) while the chest stays on the reticle.
    this.hipsYaw = approach(
      this.hipsYaw,
      f.moving && f.hp > 0 && !this.preview ? mb.hipsYaw : 0,
      dt,
      10,
    );
    this.state = upper === "PlayerIdle" ? base : upper;
    [base, upper].forEach((name, index) => {
      const channel = this.channels[index];
      if (channel.name !== name) {
        const a = this.action(name, index === 1)
          .reset()
          .setEffectiveWeight(1)
          .play();
        // Legs blend a little longer than the arms (idle ↔ walk ↔ run).
        if (channel.action)
          a.crossFadeFrom(channel.action, index === 0 ? 0.26 : 0.18, false);
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
      const target = turning
        ? 0.55
        : f.moving && native && f.localZ !== undefined && !this.preview
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
    if (hips) {
      this.hipsPos.copy(hips.position);
      this.hipsCaptured = true;
    }
    if (f.hp > 0) this.bodyLayers(dt, f, base, upper);
    if (f.hp > 0 && !this.preview) {
      // Lean into turns, hips twist for aimed sidesteps, counter-rotated spine.
      this.lean = approach(
        this.lean,
        f.moving ? leanAngle(f.yawRate ?? 0, this.speed) : 0,
        dt,
        8,
      );
      this.rotate("Hips", 0, this.hipsYaw, this.lean);
      this.rotate("Spine", 0, -this.hipsYaw * 0.5, -this.lean * 0.4);
      this.rotate("Spine1", 0, -this.hipsYaw * 0.5, 0);
      // Breathing/micro-motion, stronger and faster when hurt.
      const b = breath(this.time, f.hp),
        still = f.moving ? 0.35 : 1;
      this.rotate(
        "Spine2",
        b.chest * still * (f.aiming ? 0.4 : 1),
        0,
        b.sway * still,
      );
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
          1.43 +
            Math.sin(f.pitch) * 0.35 +
            recoilKick(this.time - this.fireAt) * 0.045 +
            aimSettle(this.time - this.aimAt) * 0.03,
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
          // Low-ready gun hand swings with the stride (right arm forward
          // with the left leg).
          0.16 + Math.sin(this.gait) * 0.06 * this.style,
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
  /** 0.11: the body moving with the walk. Feminine pelvic list and turn,
   * counter-rotating shoulders, weight shift over the stance leg (feet
   * compensated so they do not skate), thighs drawn toward the centre line,
   * stronger arm swing, idle contrapposto, shot recoil through the spine,
   * aim settle and a reload lean. Ponytail spring drives the hair shader. */
  bodyLayers(dt: number, f: PlayerFrame, base: string, upper: string) {
    if (this.styleOff) return;
    const a = this.channels[0].action,
      clip = this.channels[0].name,
      offset = gaitPhases[clip];
    const moving = f.moving && offset !== undefined && a;
    const weight =
      moving && STYLE[clip] !== undefined
        ? STYLE[clip] *
          Math.min(1, this.speed / 1.6) *
          (f.aiming ? 0.35 : 1) *
          (this.blend === "forward" || this.blend === "idle" ? 1 : 0.4)
        : 0;
    this.style = approach(this.style, weight, dt, 6);
    if (a && offset !== undefined)
      this.gait =
        (a.time / Math.max(0.01, a.getClip().duration)) * Math.PI * 2 + offset;
    const w = walkStyle(this.gait, this.style);
    // 0.12: lateral foot lock. Remember where the clip puts each foot
    // sideways; after the pelvis layers, the thighs are rolled so each foot
    // lands there plus a constant inward offset (crossing step), which
    // cannot skate because it does not change during the stance.
    const actor = this.root.parent || this.root;
    actor.updateMatrixWorld(true);
    const footAt = (n: string) => {
      const b = this.bones.get(n);
      return b
        ? actor.worldToLocal(b.getWorldPosition(this.tmpFoot))
        : this.tmpFoot.set(0, 0, 0);
    };
    const clipFeet = ["LeftFoot", "RightFoot"].map((n) => {
      const v = footAt(n);
      return { x: v.x, y: v.y };
    });
    // Planted = the lower foot. Its sideways position is held from
    // touchdown (blended in/out), so the stance foot cannot skate sideways.
    for (let i = 0; i < 2; i++) {
      const planted = clipFeet[i].y <= clipFeet[1 - i].y + 0.005;
      if (planted && !this.planted[i])
        this.lockX[i] = clipFeet[i].x + (i ? 1 : -1) * w.adduct * 0.86 * 0.75;
      this.planted[i] = planted;
      this.plantW[i] = approach(this.plantW[i], planted ? 1 : 0, dt, 14);
    }
    // Idle: weight drifts onto one leg (contrapposto), fades in when still.
    this.idleWeight = approach(
      this.idleWeight,
      !f.moving && !f.aiming && base === "PlayerIdle" ? 1 : 0,
      dt,
      2.5,
    );
    const lean = weightShift(this.time) * this.idleWeight,
      roll = w.hipsRoll + lean * 0.07,
      shift = w.shift + lean * 0.03;
    this.rotate("Hips", 0, w.hipsYaw, roll);
    this.rotate("Spine", 0, -w.hipsYaw * 0.5, w.spineRoll - lean * 0.035);
    this.rotate("Spine1", 0, -w.hipsYaw * 0.5 + w.chestYaw * 0.5, w.chestRoll);
    this.rotate("Spine2", 0, w.chestYaw * 0.5, 0);
    this.rotate(
      "Neck",
      0,
      -w.chestYaw * 0.8,
      -(roll + w.spineRoll + w.chestRoll) * 0.5,
    );
    // Weight over the stance leg: move the pelvis, swing the thighs back so
    // the planted feet stay where they are; thighs also turn inward.
    const hips = this.bones.get("Hips");
    if (hips && shift) {
      actor.updateMatrixWorld(true);
      const world = hips.getWorldPosition(new T.Vector3()),
        dir = new T.Vector3(1, 0, 0).applyQuaternion(
          actor.getWorldQuaternion(new T.Quaternion()),
        );
      hips.position.copy(
        hips.parent!.worldToLocal(world.addScaledVector(dir, shift)),
      );
    }
    const legLen = 0.86,
      keep = -shift / legLen;
    // Legs counter the pelvic roll/turn so planted feet do not skate.
    this.rotate("LeftUpLeg", 0, -w.hipsYaw, keep - roll);
    this.rotate("RightUpLeg", 0, -w.hipsYaw, keep - roll);
    if (this.style > 0.01) {
      const inward = w.adduct * legLen * 0.75;
      for (let pass = 0; pass < 2; pass++) {
        actor.updateMatrixWorld(true);
        const goal = (i: number) => {
          const free = clipFeet[i].x + (i ? inward : -inward);
          return free + (this.lockX[i] - free) * this.plantW[i];
        };
        const l = footAt("LeftFoot").x - goal(0),
          r = footAt("RightFoot").x - goal(1);
        const ang = (d: number) =>
          -Math.asin(Math.max(-0.5, Math.min(0.5, d / legLen)));
        this.rotate("LeftUpLeg", 0, 0, ang(l));
        this.rotate("RightUpLeg", 0, 0, ang(r));
      }
    }
    // Relaxed knee on the unweighted leg in idle.
    this.rotate("LeftLeg", 0.1 * Math.max(0, -lean), 0, 0);
    this.rotate("RightLeg", 0.1 * Math.max(0, lean), 0, 0);
    if (!f.aiming && !f.light && upper !== "Reload")
      this.rotate("LeftArm", w.armSwing, 0, 0);
    // Shot recoil travels through chest, shoulders and neck.
    const kick = recoilKick(this.time - this.fireAt);
    if (kick) {
      this.rotate("Spine1", -0.03 * kick, 0, 0);
      this.rotate("Spine2", -0.07 * kick, 0.02 * kick, 0);
      this.rotate("RightShoulder", 0, 0, -0.06 * kick);
      this.rotate("Neck", 0.04 * kick, 0, 0);
    }
    // Aim settle: the gun comes up, overshoots a little and steadies.
    if (f.aiming && !this.wasAiming) this.aimAt = this.time;
    this.wasAiming = f.aiming;
    const settle = aimSettle(this.time - this.aimAt);
    if (settle) this.rotate("Spine2", 0.02 * settle, 0.015 * settle, 0);
    // Reload: lean over the gun, eyes down to the magazine well.
    this.reloadBody = approach(
      this.reloadBody,
      upper === "Reload" ? 1 : 0,
      dt,
      8,
    );
    if (this.reloadBody > 0.01) {
      const r = this.reloadBody;
      this.rotate("Spine1", 0.06 * r, -0.05 * r, 0);
      this.rotate("Neck", 0.12 * r, 0, 0);
      this.rotate("Head", 0.1 * r, 0, 0);
    }
    // Ponytail: damped spring pushed by the body's acceleration and by the
    // hips swinging under it (body-local, mesh units ≈ 0.92 m).
    const lx = f.localX ?? 0,
      lz = f.localZ ?? 0,
      ax = (lx - this.lastLocal.x) / Math.max(dt, 1e-3),
      az = (lz - this.lastLocal.y) / Math.max(dt, 1e-3);
    this.lastLocal.set(lx, lz);
    const target = new T.Vector3(
      -shift * 2.2 - (f.yawRate ?? 0) * 0.01,
      0,
      -Math.min(0.05, Math.abs(lz) * 0.012),
    );
    const force = target
      .sub(this.hair)
      .multiplyScalar(90)
      .addScaledVector(this.hairV, -9)
      .add(new T.Vector3(-ax * 0.004, 0, -az * 0.004));
    this.hairV.addScaledVector(force, Math.min(dt, 0.05));
    this.hair.addScaledVector(this.hairV, Math.min(dt, 0.05));
    this.hair.clampLength(0, 0.07);
    hairSway.value.copy(this.hair);
  }
  /** Flat-floor foot IK: a foot that the additive layers pushed below the
   * floor is pulled back to ankle height with a 2-bone CCD (UpLeg/Leg).
   * When dead, lift the whole body so the corpse never sinks. */
  groundFeet(dead: boolean) {
    this.root.updateMatrixWorld(true);
    const w = new T.Vector3();
    if (dead) {
      let low = Infinity;
      for (const n of [
        "Head",
        "Hips",
        "LeftHand",
        "RightHand",
        "LeftFoot",
        "RightFoot",
      ]) {
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
      style: this.style,
      gait: this.gait,
      feet: ["LeftFoot", "RightFoot"].map((n) => {
        const v = this.bones.get(n)?.getWorldPosition(new T.Vector3());
        return v ? [v.x, v.y, v.z] : [];
      }),
      hipsRoll: walkStyle(this.gait, this.style).hipsRoll,
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
