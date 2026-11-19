// 0.9: E05 "rastejador" from the user's GLB (a child in a nightgown walking
// on hands and feet, arched backwards). The GLB has no clips: crawlerPose()
// gives a spider-walk gait synced to ground speed, rear-up windup, lunge,
// flinch, cower and a collapse-and-roll death; this file maps it to bones.
import * as T from "three";
import type { Actor } from "./actors";
import type { Enemy, Region } from "./logic";
import type { Quality } from "./controls";
import type { ZombieAnimator } from "./zombie";
import { SmartSkin, smartMaterial, smartReady } from "./smartrig";
import { CRAWLER_REACH } from "./logic";
import {
  advancePhase,
  blendPose,
  type CrawlerPose,
  crawlerPose,
  crawlerState,
  type CrawlerInput,
} from "./crawler-pose";

// The white nightgown blows out under the room probe: tone it down.
const crawlerMaterial = (q: Quality) =>
  smartMaterial("rastejador", q, (m) => {
    m.color.multiplyScalar(0.8);
    m.userData.probeGain = 0.6;
  });
/** Model is authored ~1.32 m tall at the arch. 0.10 (user request): 0.74 →
 * 0.58, so the arch sits at ~0.77 m, about Helena's hip, and the body is
 * ~0.6 m long: a child, not a crouching adult. Hitboxes, ground contact,
 * lunge and bob live under `body` and scale with it. */
export const CRAWLER_SCALE = 0.58;
const X = new T.Vector3(1, 0, 0),
  Y = new T.Vector3(0, 1, 0),
  Z = new T.Vector3(0, 0, 1);
// Limbs: front -x, front +x, hind -x, hind +x → [upper, lower, side].
const LIMBS: [string, string, number, boolean][] = [
  ["Bone_022", "Bone_021", -1, true],
  ["Bone_027", "Bone_026", 1, true],
  ["Bone_010", "Bone_009", -1, false],
  ["Bone_015", "Bone_014", 1, false],
];
const GROUND = ["Bone_019", "Bone_024", "Bone_007", "Bone_012", "Bone_016"];
const seedOf = (id: string) => {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h / 9973;
};

export class Crawler {
  root = new T.Group();
  body = new T.Group();
  warning = new T.Group();
  skin: SmartSkin;
  hitboxes: T.Mesh[] = [];
  head: T.Bone;
  stateName = "Idle";
  quality: Quality = "medium";
  phase = 0;
  clock = 0;
  stateAt = 0;
  lastState = "";
  hitAt = -9;
  hitSide = 1;
  serial = 0;
  throttle = 0;
  updated = 0;
  ownMaterial?: T.MeshStandardMaterial;
  seed: number;
  last?: CrawlerPose;
  constructor(public enemy: Enemy) {
    this.seed = seedOf(enemy.id);
    this.skin = new SmartSkin("rastejador", crawlerMaterial("medium"));
    this.root.add(this.body, this.warning);
    this.body.add(this.skin.scene);
    this.body.scale.setScalar(CRAWLER_SCALE);
    this.head = this.skin.bone("Bone_017");
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
    hit("Bone_017", "head", [0.4, 0.46, 0.4], [-0.15, 0.62, 0.72]);
    hit("Bone_004", "body", [0.62, 0.44, 1.05], [-0.1, 1.12, -0.02]);
    hit("Bone_022", "body", [0.2, 0.95, 0.22], [-0.68, 0.58, 0.45]);
    hit("Bone_027", "body", [0.2, 0.95, 0.22], [0.54, 0.58, 0.58]);
    hit("Bone_010", "legL", [0.24, 0.7, 0.26], [-0.62, 1.02, -0.64]);
    hit("Bone_015", "legR", [0.24, 0.7, 0.26], [0.53, 1.02, -0.63]);
    const ring = new T.Mesh(
      new T.RingGeometry(CRAWLER_REACH, CRAWLER_REACH + 0.04, 32),
      new T.MeshBasicMaterial({
        color: 0xd4a16b,
        transparent: true,
        opacity: 0.65,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.warning.add(ring);
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
      this.skin.mesh.material = crawlerMaterial(quality);
    }
    this.skin.mesh.castShadow = quality === "high" && distance < 7;
    this.clock += dt;
    this.phase = advancePhase(this.phase, speed * dt);
    if (!visible && !e.dead) return;
    this.throttle += dt;
    if (
      !e.dead &&
      distance > (quality === "low" ? 4.8 : 9) &&
      this.throttle < 1 / (quality === "low" ? 12 : 20)
    )
      return;
    const step = Math.min(0.25, this.throttle);
    this.throttle = 0;
    this.pose(e, speed, step);
    this.updated++;
  }
  pose(e: Enemy, speed: number, _dt: number) {
    const state = crawlerState(e, speed);
    const key = e.dead ? "dead" : e.state;
    if (key !== this.lastState) {
      this.lastState = key;
      this.stateAt = this.clock;
    }
    if ((e.hitSerial || 0) !== this.serial) {
      this.serial = e.hitSerial || 0;
      this.hitAt = this.clock;
      this.hitSide =
        e.lastHit === "legL"
          ? -1
          : e.lastHit === "legR"
            ? 1
            : this.serial % 2
              ? 1
              : -1;
    }
    const age = e.dead
      ? Math.max(0, (Date.now() - e.deathAt) / 1000)
      : this.clock - this.stateAt;
    const input: CrawlerInput = {
      state,
      phase: this.phase,
      age,
      hitAge: e.dead ? 99 : this.clock - this.hitAt,
      hitSide: this.hitSide,
      clock: this.clock,
      seed: this.seed,
    };
    // Gait channels already move continuously with distance; blend fast
    // there and slower across state changes so nothing snaps.
    const target = crawlerPose(input),
      changed = this.clock - this.stateAt < 0.3;
    const p = (this.last = blendPose(
      this.last,
      target,
      _dt,
      state === "crawl" && !changed ? 30 : 12,
    ));
    this.stateName =
      state === "dead"
        ? "Death"
        : state === "crawl"
          ? "Crawl"
          : state === "windup"
            ? "CrawlAttack"
            : state === "recover"
              ? age < 0.25
                ? "Strike"
                : "Recover"
              : state === "stun"
                ? "Cower"
                : "Idle";
    const s = this.skin;
    s.reset();
    // Body: pitch/roll about the hips, hind legs counter-rotate to stay put.
    s.turn("Bone_000", X, p.pitch);
    s.turn("Bone_000", Z, p.roll);
    s.turn("Bone_004", Y, p.twist);
    s.turn("Bone_003", Y, p.twist * 0.6);
    s.turn("Bone_018", X, p.headPitch * 0.6);
    s.turn("Bone_017", X, p.headPitch * 0.5);
    s.turn("Bone_018", Y, p.headYaw);
    s.turn("Bone_017", Z, p.headRoll);
    LIMBS.forEach(([upper, lower, side, front], i) => {
      const l = p.limbs[i];
      if (!front) s.turn(upper, X, -p.pitch);
      else s.turn(upper, X, -p.pitch * 0.5);
      s.turn(upper, X, -l.swing * (front ? 0.38 : 0.32));
      s.turn(upper, Z, side * l.lift * (front ? 0.42 : 0.3));
      s.turn(lower, X, l.lift * (front ? 0.55 : -0.45));
      s.turn(upper, Z, -side * l.curl * 0.5);
      s.turn(lower, Z, -side * l.curl * 0.8);
    });
    this.head.scale.setScalar(e.headGone ? 0.001 : 1);
    // Death: roll onto the side; then clamp the lowest contact to the floor.
    s.scene.rotation.set(0, 0, p.death * 1.25 * (this.seed > 0.5 ? 1 : -1));
    s.scene.position.set(0, 0, p.lunge / CRAWLER_SCALE);
    s.scene.updateMatrixWorld(true);
    let low = Infinity;
    const w = new T.Vector3();
    for (const n of GROUND) {
      w.setFromMatrixPosition(s.bone(n).matrixWorld);
      this.body.worldToLocal(w);
      low = Math.min(low, w.y);
    }
    // Hands/feet bones sit a few cm above the skin contact.
    s.scene.position.y = -low + 0.03 + p.bob / CRAWLER_SCALE;
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
  }
  dispose() {
    this.ownMaterial?.dispose();
    for (const h of this.hitboxes) {
      h.geometry.dispose();
      (h.material as T.Material).dispose();
    }
    this.skin.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
  }
}

/** Actor for E05 when the chapter-2 GLB is loaded; undefined otherwise. */
export function crawlerActor(e: Enemy): Actor | undefined {
  if (e.kind !== "E05" || !smartReady("rastejador")) return undefined;
  const c = new Crawler(e);
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
  };
}
