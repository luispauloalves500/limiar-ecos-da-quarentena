import * as T from "three";
import type { BonePose } from "./zombie-clips";
type Pose = {
  rot: Record<string, [number, number, number]>;
  hip: [number, number, number];
};
export const playerDurations = {
  PlayerIdle: 2.8,
  Aim: 2,
  WalkAim: 1,
  Fire: 0.22,
  Reload: 1.1,
  Flashlight: 2,
  Hit: 0.35,
  InjuredWalk: 1.4,
  Grabbed: 0.5,
  BreakFree: 0.5,
  QuickTurn: 0.35,
  Interact: 0.65,
  Door: 0.8,
  PlayerDeath: 1.2,
};
function pose(name: string, t: number): Pose {
  const p: Pose = { rot: {}, hip: [0, 0, 0] },
    w = Math.sin(t * Math.PI * 2),
    pulse = Math.sin(t * Math.PI);
  p.rot = {
    Spine: [0.01 * w, 0, 0],
    LeftArm: [0, 0, -0.04],
    RightArm: [0, 0, 0.04],
  };
  p.hip[1] = 0.004 * w;
  if (["Aim", "WalkAim", "Fire", "Reload", "Flashlight"].includes(name)) {
    p.rot = {
      Spine: [0.04, 0, -0.015],
      Spine2: [0, -0.04, 0],
      RightArm: [-1.3, 0, 0.12],
      RightForeArm: [-0.28, 0, 0],
      LeftArm: [-1.3, 0, -0.4],
      LeftForeArm: [-0.5, 0.13, 0],
      Head: [-0.025, 0, 0],
      RightHand: [0.1, 0, 0],
      LeftHand: [0.08, 0, 0],
    };
    for (const side of ["Left", "Right"])
      for (const finger of ["Index", "Middle", "Ring", "Pinky"])
        p.rot[side + "Hand" + finger + "1"] = [0.5, 0, 0];
    if (name === "Fire") {
      p.rot.Spine[0] -= 0.065 * pulse;
      p.rot.RightArm[0] -= 0.15 * pulse;
      p.rot.LeftArm[0] -= 0.12 * pulse;
    }
    if (name === "Reload") {
      p.rot.RightArm[0] += 0.45 * pulse;
      p.rot.RightForeArm[0] -= 0.4 * pulse;
      p.rot.LeftArm[0] += 0.55 * pulse;
      p.rot.LeftForeArm[0] -= 0.5 * pulse;
      p.rot.LeftHand = [0, 0.45 * pulse, 0];
      p.rot.Head = [0.12 * pulse, 0, 0];
    }
    if (name === "Flashlight") {
      p.rot.RightArm = [0.03 * w, 0, 0.04];
      p.rot.RightForeArm = [0, 0, 0];
      p.rot.LeftArm = [-0.85, 0, -0.18];
      p.rot.LeftForeArm = [-0.7, 0, 0];
    }
  }
  if (name === "Hit") {
    p.rot.Spine = [-0.2 * pulse, 0.08 * pulse, 0];
    p.rot.Head = [0.18 * pulse, 0, 0];
  }
  if (name === "InjuredWalk") {
    p.hip[1] = -0.025 + 0.015 * w;
    p.rot.Spine = [0.12, 0, 0.08];
    p.rot.LeftArm = [-0.15, 0, -0.4];
    p.rot.LeftForeArm = [-1.1, 0, 0];
    p.rot.LeftUpLeg = [0.18 * w, 0, 0];
    p.rot.RightUpLeg = [-0.28 * w, 0, 0];
    p.rot.LeftLeg = [0.15 + Math.max(0, -w) * 0.22, 0, 0];
    p.rot.RightLeg = [0.08 + Math.max(0, w) * 0.3, 0, 0];
  }
  if (name === "Grabbed") {
    p.hip[1] = -0.04 * pulse;
    p.rot = {
      Spine: [-0.18, 0, 0.04 * w],
      Head: [-0.18, 0.1 * w, 0],
      LeftArm: [-1.1, 0, -0.2],
      RightArm: [-1.1, 0, 0.2],
      LeftForeArm: [-0.4, 0, 0],
      RightForeArm: [-0.4, 0, 0],
    };
  }
  if (name === "BreakFree") {
    p.rot.Spine = [0.2 * pulse, 0.3 * pulse, 0];
    p.rot.LeftArm = [-1.5 * pulse, 0, -0.2];
    p.rot.RightArm = [-1.5 * pulse, 0, 0.2];
    p.rot.LeftForeArm = [-0.15, 0, 0];
    p.rot.RightForeArm = [-0.15, 0, 0];
  }
  if (name === "QuickTurn") {
    p.rot.Hips = [0, -Math.PI * (1 - T.MathUtils.smoothstep(t, 0, 1)), 0];
    p.rot.LeftUpLeg = [0.2 * pulse, 0, 0];
    p.rot.RightUpLeg = [-0.2 * pulse, 0, 0];
    p.hip[1] = 0.02 * pulse;
  }
  if (name === "Interact" || name === "Door") {
    p.rot.Spine = [(name === "Interact" ? 0.3 : 0.1) * pulse, 0, 0];
    p.rot.LeftArm = [-1.25 * pulse, 0, -0.1];
    p.rot.LeftForeArm = [-0.3 * pulse, 0, 0];
    p.rot.Head = [0.15 * pulse, 0, 0];
  }
  if (name === "PlayerDeath") {
    const f = T.MathUtils.smoothstep(t, 0.05, 0.95);
    p.hip = [0.04 * f, -0.9 * f, -0.12 * f];
    p.rot = {
      Hips: [1.47 * f, 0, 0.08 * f],
      Spine: [0.1 * f, 0, 0],
      Head: [-0.12 * f, 0, 0.15 * f],
      LeftArm: [-0.2 * f, 0, -0.35 * f],
      RightArm: [-0.1 * f, 0, 0.4 * f],
      LeftLeg: [0.28 * f, 0, 0],
      RightLeg: [0.38 * f, 0, 0],
    };
  }
  return p;
}
export function authorPlayerClips(bones: BonePose[]) {
  return Object.entries(playerDurations).map(([name, duration]) => {
    const times = Array.from({ length: 13 }, (_, i) => (duration * i) / 12),
      tracks: T.KeyframeTrack[] = [];
    for (const b of bones) {
      const qs: number[] = [],
        ps: number[] = [],
        ss: number[] = [];
      for (let i = 0; i <= 12; i++) {
        const p = pose(name, i / 12),
          r = p.rot[b.short] || [0, 0, 0],
          q = b.parentRotation
            .clone()
            .invert()
            .multiply(new T.Quaternion().setFromEuler(new T.Euler(...r)))
            .multiply(b.parentRotation)
            .multiply(b.quaternion),
          v = b.position.clone();
        if (b.short === "Hips") v.add(new T.Vector3(...p.hip));
        qs.push(...q.toArray());
        ps.push(...v.toArray());
        ss.push(...b.scale.toArray());
      }
      tracks.push(
        new T.QuaternionKeyframeTrack(b.name + ".quaternion", times, qs),
        new T.VectorKeyframeTrack(b.name + ".position", times, ps),
        new T.VectorKeyframeTrack(b.name + ".scale", times, ss),
      );
    }
    return new T.AnimationClip(name, duration, tracks);
  });
}
export const upperTrack = (track: T.KeyframeTrack) =>
  /(Spine|Neck|Head|Shoulder|Arm|Hand)/.test(track.name);
export function maskedClip(clip: T.AnimationClip, upper: boolean) {
  const c = clip.clone();
  c.name = clip.name + (upper ? "Upper" : "Lower");
  c.tracks = c.tracks.filter((t) => upperTrack(t) === upper);
  return c;
}

/** Bake a support-hand CCD constraint into authored keyframes, never native clips.
 * No runtime IK or mutation of the gun/right-hand/collider is introduced. */
export function supportGrip(
  root: T.Object3D,
  arm: T.Bone,
  elbow: T.Bone,
  hand: T.Bone,
  target: T.Vector3,
  iterations = 8,
) {
  for (let i = 0; i < iterations; i++)
    for (const joint of [elbow, arm]) {
      root.updateMatrixWorld(true);
      const p = joint.getWorldPosition(new T.Vector3()),
        end = hand.getWorldPosition(new T.Vector3()).sub(p),
        goal = target.clone().sub(p);
      if (end.lengthSq() < 1e-8 || goal.lengthSq() < 1e-8) continue;
      const delta = new T.Quaternion().setFromUnitVectors(
          end.normalize(),
          goal.normalize(),
        ),
        world = joint.getWorldQuaternion(new T.Quaternion()),
        parent = joint.parent!.getWorldQuaternion(new T.Quaternion());
      delta
        .identity()
        .slerp(new T.Quaternion().setFromUnitVectors(end, goal), 0.75);
      joint.quaternion.copy(parent.invert().multiply(delta.multiply(world)));
    }
  root.updateMatrixWorld(true);
}
export function bakeSupportGrip(clips: T.AnimationClip[], root: T.Object3D) {
  const bones = new Map<string, T.Bone>();
  root.traverse((o) => {
    if (o instanceof T.Bone)
      bones.set(o.name.replace(/^mixamorig[:_]?/, ""), o);
  });
  const arm = bones.get("LeftArm"),
    elbow = bones.get("LeftForeArm"),
    hand = bones.get("LeftHand"),
    right = bones.get("RightHand");
  if (!arm || !elbow || !hand || !right) return;
  const mixer = new T.AnimationMixer(root);
  for (const c of clips.filter((c) =>
    ["Aim", "WalkAim", "Fire"].includes(c.name),
  )) {
    const tracks = [arm, elbow].map((b) =>
        c.tracks.find((t) => t.name === b.name + ".quaternion")!,
      ),
      values = tracks.map(() => [] as number[]),
      action = mixer.clipAction(c).setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    for (const t of tracks[0].times) {
      action.reset().play();
      action.time = t;
      mixer.update(0);
      root.updateMatrixWorld(true);
      const target = right
        .getWorldPosition(new T.Vector3())
        .add(new T.Vector3(0.025, -0.025, 0.015));
      supportGrip(root, arm, elbow, hand, target);
      [arm, elbow].forEach((b, i) => values[i].push(...b.quaternion.toArray()));
    }
    tracks.forEach((track, i) => {
      track.values = new Float32Array(values[i]);
    });
    mixer.stopAllAction();
    mixer.uncacheClip(c);
  }
  mixer.uncacheRoot(root);
}

/** Mixer skips writes for constant tracks. Restore the pre-override pose first,
 * otherwise procedural pitch/IK accumulates and folds the actor over time. */
export class PoseRestore {
  entries: [T.Bone, T.Quaternion][];
  active = false;
  constructor(bones: T.Bone[]) {
    this.entries = bones.map((b) => [b, new T.Quaternion()]);
  }
  restore() {
    if (this.active) this.entries.forEach(([b, q]) => b.quaternion.copy(q));
    this.active = false;
  }
  capture() {
    this.entries.forEach(([b, q]) => q.copy(b.quaternion));
    this.active = true;
  }
}
