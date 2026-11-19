// 0.11: B01 "Porteiro" from the user's GLB (skeletal ghoul, SmartRig, no
// clips). porteiroPose() gives stalk, slam and dash windups, strikes,
// recovery, electric-trap convulsion, open-armour guard, flinch and a
// three-beat death; this file maps those channels to bones, pins the
// hitboxes and the glowing core to the skeleton and clamps the feet to the
// floor. Fight logic, timings and damage stay in main.ts/logic.ts.
import * as T from "three";
import type { Actor } from "./actors";
import type { Enemy, Region } from "./logic";
import type { Quality } from "./controls";
import type { ZombieAnimator } from "./zombie";
import { SmartSkin, smartMaterial, smartReady } from "./smartrig";
import {
  advancePhase,
  blendPorteiro,
  PORTEIRO_SCALE,
  PORTEIRO_TIMING,
  porteiroPose,
  type PorteiroPose,
  type PorteiroState,
} from "./porteiro-pose";
import { enemyStats } from "./logic";

// Dark bone-and-leather body: lift it under the room probe so the átrio
// reads it, plus a faint cool rim in the shader for the silhouette.
const porteiroMaterial = (q: Quality) =>
  smartMaterial("porteiro", q, (m) => {
    m.userData.probeGain = 0.85;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimP = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += vec3(0.13, 0.14, 0.16) * rimP;`,
      );
    };
    m.customProgramCacheKey = () => "porteiro-glb-rim";
  });
const X = new T.Vector3(1, 0, 0),
  Y = new T.Vector3(0, 1, 0),
  Z = new T.Vector3(0, 0, 1);
// side: -1 = model -X, +1 = model +X.
const ARMS: [number, string, string, string, string][] = [
  [-1, "Bone_033", "Bone_032", "Bone_031", "Bone_029"],
  [1, "Bone_028", "Bone_027", "Bone_026", "Bone_024"],
];
const LEGS: [string, string, string, string][] = [
  ["Bone_014", "Bone_013", "Bone_012", "Bone_011"],
  ["Bone_019", "Bone_018", "Bone_017", "Bone_016"],
];
const FINGERS = [
  ["Bone_057", "Bone_056", "Bone_061", "Bone_060", "Bone_065", "Bone_064"],
  ["Bone_037", "Bone_036", "Bone_041", "Bone_040", "Bone_045", "Bone_044"],
];
const FEET = ["Bone_010", "Bone_011", "Bone_015", "Bone_016"];
const LYING = ["Bone_022", "Bone_024", "Bone_029", "Bone_002", "Bone_005"];
const seedOf = (id: string) => {
  let h = 11;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h / 9973;
};

export class Porteiro {
  root = new T.Group();
  body = new T.Group();
  warning = new T.Group();
  skin: SmartSkin;
  hitboxes: T.Mesh[] = [];
  head: T.Bone;
  core: T.Mesh;
  stateName = "Idle";
  quality: Quality = "medium";
  phase = 0;
  gait = 0;
  clock = 0;
  stateAt = 0;
  lastState = "";
  hitAt = -9;
  hitSide = 1;
  serial = 0;
  throttle = 0;
  updated = 0;
  dash = false;
  ownMaterial?: T.MeshStandardMaterial;
  seed: number;
  last?: PorteiroPose;
  constructor(public enemy: Enemy) {
    this.seed = seedOf(enemy.id);
    this.skin = new SmartSkin("porteiro", porteiroMaterial("medium"));
    this.root.add(this.body, this.warning);
    this.body.add(this.skin.scene);
    this.body.scale.setScalar(PORTEIRO_SCALE);
    this.head = this.skin.bone("Bone_022");
    const hit = (
      bone: string,
      region: Region,
      size: [number, number, number],
      at: [number, number, number],
    ) => {
      const h = new T.Mesh(
        new T.BoxGeometry(...size),
        new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }),
      );
      h.userData = { enemyId: enemy.id, region };
      this.skin.pin(bone, h, new T.Vector3(...at));
      this.hitboxes.push(h);
    };
    // Model units (×1.5 in the world). Sized like the 0.10 blocky B01.
    hit("Bone_022", "head", [0.3, 0.32, 0.32], [-0.03, 1.47, 0.11]);
    hit("Bone_002", "body", [0.52, 0.44, 0.4], [0.03, 1.2, -0.06]);
    hit("Bone_005", "body", [0.42, 0.3, 0.32], [0.05, 0.93, -0.12]);
    hit("Bone_027", "body", [0.16, 0.34, 0.16], [0.31, 1.2, -0.02]);
    hit("Bone_032", "body", [0.16, 0.34, 0.16], [-0.2, 1.17, -0.22]);
    hit("Bone_014", "legL", [0.2, 0.42, 0.22], [-0.13, 0.65, -0.14]);
    hit("Bone_013", "legL", [0.16, 0.36, 0.2], [-0.16, 0.33, -0.18]);
    hit("Bone_019", "legR", [0.2, 0.42, 0.22], [0.2, 0.65, 0.02]);
    hit("Bone_018", "legR", [0.16, 0.36, 0.2], [0.28, 0.36, 0.03]);
    // Core inside the open ribcage: dim behind the armour, bright when the
    // trap opens it (the old B01 weak point).
    this.core = new T.Mesh(
      new T.IcosahedronGeometry(0.075, 1),
      new T.MeshBasicMaterial({ color: 0x7e9486 }),
    );
    this.skin.pin("Bone_002", this.core, new T.Vector3(0.03, 1.16, 0.06));
    const ring = new T.Mesh(
      new T.RingGeometry(1.5, 1.54, 40),
      new T.MeshBasicMaterial({
        color: 0xd4a16b,
        transparent: true,
        opacity: 0.65,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.warning.add(ring);
    const lane = new T.Mesh(
      new T.BoxGeometry(0.07, 0.01, 3),
      new T.MeshBasicMaterial({ color: 0xd4a16b }),
    );
    lane.position.set(0, 0.01, 1.8);
    this.warning.add(lane);
    this.warning.position.y = 0.025;
    this.warning.visible = false;
    this.serial = enemy.hitSerial || 0;
    this.phase = this.seed * Math.PI * 2;
    this.pose(enemy, 0, 0);
  }
  update(
    e: Enemy,
    dt: number,
    visible: boolean,
    distance: number,
    speed: number,
    quality: Quality,
  ) {
    if (quality !== this.quality && !this.ownMaterial) {
      this.quality = quality;
      this.skin.mesh.material = porteiroMaterial(quality);
    }
    this.skin.mesh.castShadow = quality === "high" && distance < 9;
    this.clock += dt;
    // The dash teleports ~2.8 m in one tick: never feed that to the gait.
    const walk = e.state === "chase" ? Math.min(speed, 2.2) : 0;
    this.gait +=
      (walk / enemyStats("B01").speed - this.gait) * (1 - Math.exp(-dt * 6));
    this.phase = advancePhase(this.phase, walk * dt, this.gait);
    (this.core.material as T.MeshBasicMaterial).color.set(
      e.vulnerable > 0
        ? Math.sin(this.clock * 14) > -0.4
          ? 0xffd08a
          : 0xff9a52
        : 0x7e9486,
    );
    if (!visible && !e.dead) return;
    this.throttle += dt;
    if (
      !e.dead &&
      distance > (quality === "low" ? 6 : 11) &&
      this.throttle < 1 / (quality === "low" ? 15 : 24)
    )
      return;
    const step = Math.min(0.25, this.throttle);
    this.throttle = 0;
    this.pose(e, speed, step);
    this.updated++;
  }
  pose(e: Enemy, _speed: number, dt: number) {
    const key = e.dead
      ? "dead"
      : e.state + (e.state === "windup" ? e.attack : "");
    if (key !== this.lastState) {
      this.lastState = key;
      this.stateAt = this.clock;
      if (e.state === "windup") this.dash = e.attack === 1;
    }
    if ((e.hitSerial || 0) !== this.serial) {
      this.serial = e.hitSerial || 0;
      this.hitAt = this.clock;
      this.hitSide = this.serial % 2 ? 1 : -1;
    }
    const age = e.dead
      ? Math.max(0, (Date.now() - e.deathAt) / 1000)
      : this.clock - this.stateAt;
    const state: PorteiroState = e.dead
      ? "dead"
      : e.state === "windup"
        ? e.attack === 1
          ? "charge"
          : "slam"
        : e.state === "recover" || e.state === "charge"
          ? "recover"
          : e.state === "stun"
            ? "stun"
            : this.gait > 0.05
              ? "walk"
              : "idle";
    const target = porteiroPose({
      state,
      phase: this.phase,
      gait: this.gait,
      age,
      progress: Math.min(1, Math.max(0, 1 - e.timer / PORTEIRO_TIMING.windup)),
      dash: this.dash,
      hitAge: e.dead ? 99 : this.clock - this.hitAt,
      hitSide: this.hitSide,
      exposed: e.vulnerable > 0,
      clock: this.clock,
      seed: this.seed,
    });
    const quick = state === "recover" && age < PORTEIRO_TIMING.strike ? 30 : 0;
    const p = (this.last = blendPorteiro(
      this.last,
      target,
      dt,
      quick || (state === "walk" && age > 0.3 ? 24 : 11),
    ));
    this.stateName = {
      dead: "Death",
      walk: "Walk",
      idle: "Idle",
      slam: "SlamWindup",
      charge: "DashWindup",
      recover: age < PORTEIRO_TIMING.strike ? "Strike" : "Recover",
      stun: "Shock",
    }[state];
    this.apply(p);
  }
  private apply(p: PorteiroPose) {
    const s = this.skin,
      t = this.clock;
    s.reset();
    const jitter = (k: number) => p.tremor * Math.sin(t * 47 + k * 2.1);
    // Pelvis carries legs and spine; the upper body leans from Bone_005.
    s.turn("Bone_001", Y, p.pelvisYaw);
    s.turn("Bone_001", Z, p.hipsRoll);
    s.turn("Bone_005", X, p.hips + p.spine * 0.3 + jitter(1));
    s.turn("Bone_004", X, p.spine * 0.3);
    s.turn("Bone_003", X, p.spine * 0.2 + jitter(2));
    s.turn("Bone_003", Y, p.chestYaw * 0.5 - p.pelvisYaw);
    s.turn("Bone_002", X, p.spine * 0.2);
    s.turn("Bone_002", Y, p.chestYaw * 0.5);
    s.turn("Bone_002", Z, p.chestRoll + jitter(3));
    s.turn("Bone_023", X, p.head * 0.5);
    s.turn("Bone_023", Y, p.headYaw - p.chestYaw * 0.6);
    s.turn("Bone_022", X, p.head * 0.5 + jitter(4) * 2);
    s.turn("Bone_022", Z, p.headRoll + jitter(5));
    s.turn("Bone_021", X, p.jaw * 0.5);
    ARMS.forEach(([side, clav, up, lo], i) => {
      const swing = i ? p.armR : p.armL,
        out = i ? p.armOutR : p.armOutL,
        elbow = i ? p.elbowR : p.elbowL;
      s.turn(clav, Z, side * out * 0.25);
      s.turn(up, X, swing + jitter(6 + i));
      s.turn(up, Z, side * out * 0.8 + jitter(8 + i));
      s.turn(lo, X, -elbow + jitter(10 + i));
      for (const f of FINGERS[i]) s.turn(f, X, -p.claw * 0.45);
    });
    LEGS.forEach(([thigh, knee, ankle, foot], i) => {
      const th = i ? p.thighR : p.thighL,
        kn = i ? p.kneeR : p.kneeL,
        ft = i ? p.footR : p.footL;
      s.turn(thigh, X, th + jitter(12 + i) * 0.5);
      s.turn(knee, X, kn);
      // Digitigrade shin: counter the knee so the foot lands flat.
      s.turn(ankle, X, -kn * 0.55);
      s.turn(foot, X, ft - th * 0.4 - kn * 0.3);
    });
    this.head.scale.setScalar(this.enemy.headGone ? 0.001 : 1);
    // Death: fall forward onto the face; then clamp the lowest point.
    s.scene.rotation.set(p.death * 1.35, 0, 0);
    s.scene.position.set(0, 0, p.lunge + p.death * 0.35);
    s.scene.updateMatrixWorld(true);
    let low = Infinity;
    const w = new T.Vector3();
    for (const n of p.death > 0.05 ? [...FEET, ...LYING] : FEET) {
      w.setFromMatrixPosition(s.bone(n).matrixWorld);
      this.body.worldToLocal(w);
      low = Math.min(low, w.y);
    }
    s.scene.position.y = -low + 0.025 + p.lift;
    s.scene.updateMatrixWorld(true);
  }
  fade(alpha: number) {
    if (alpha >= 1) return;
    if (!this.ownMaterial) {
      this.ownMaterial = (
        this.skin.mesh.material as T.MeshStandardMaterial
      ).clone();
      this.ownMaterial.userData.zombieShared = false;
      this.ownMaterial.transparent = true;
      this.skin.mesh.material = this.ownMaterial;
    }
    this.ownMaterial.opacity = alpha;
    this.ownMaterial.depthWrite = false;
    this.core.visible = alpha > 0.5;
  }
  dispose() {
    this.ownMaterial?.dispose();
    for (const h of this.hitboxes) {
      h.geometry.dispose();
      (h.material as T.Material).dispose();
    }
    this.core.geometry.dispose();
    (this.core.material as T.Material).dispose();
    this.skin.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
  }
}

/** Actor for B01 once its GLB is loaded; undefined otherwise. */
export function porteiroActor(e: Enemy): Actor | undefined {
  if (e.kind !== "B01" || !smartReady("porteiro")) return undefined;
  const c = new Porteiro(e);
  c.root.userData.glb = true;
  const animation: ZombieAnimator = {
    stateName: "Idle",
    lod: 0,
    mixersUpdated: 0,
    update(enemy, dt, visible, distance, speed, quality) {
      const before = c.updated;
      c.update(enemy, dt, visible, distance, speed, quality);
      this.mixersUpdated += c.updated - before;
      this.stateName = c.stateName;
    },
    fade: (a) => c.fade(a),
    dispose: () => c.dispose(),
  };
  return {
    root: c.root,
    body: c.body,
    head: c.head,
    animation,
    arms: [],
    elbows: [],
    legs: [],
    knees: [],
    hitboxes: c.hitboxes,
    warning: c.warning,
    core: c.core,
  };
}
