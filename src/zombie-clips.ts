import * as T from "three";
export type BonePose = {
  name: string;
  short: string;
  position: T.Vector3;
  quaternion: T.Quaternion;
  scale: T.Vector3;
  parentRotation: T.Quaternion;
};
type Pose = {
  rot: Record<string, [number, number, number]>;
  hip: [number, number, number];
};
const empty = (): Pose => ({ rot: {}, hip: [0, 0, 0] });
const crawl = (): Pose => ({
  hip: [0, -0.64, -0.42],
  rot: {
    Hips: [1.18, 0, 0],
    Spine: [0.08, 0, 0],
    Head: [-0.34, 0, 0],
    LeftArm: [-0.7, 0, -0.2],
    RightArm: [-0.7, 0, 0.2],
    LeftForeArm: [0.8, 0, 0],
    RightForeArm: [0.8, 0, 0],
    LeftUpLeg: [-0.35, 0, 0],
    RightUpLeg: [-0.35, 0, 0],
    LeftLeg: [1.15, 0, 0],
    RightLeg: [1.15, 0, 0],
  },
});
function sample(name: string, t: number): Pose {
  const p = empty(),
    wave = Math.sin(t * Math.PI * 2),
    pulse = Math.sin(Math.min(1, t) * Math.PI);
  if (name === "Idle") {
    p.hip[1] = 0.008 * wave;
    p.rot = {
      Spine: [0.045, 0, 0.025 * wave],
      Head: [-0.06, 0.03 * wave, 0.025 * wave],
      LeftArm: [0.05 * wave, 0, -0.05],
      RightArm: [-0.04 * wave, 0, 0.05],
    };
  }
  if (name === "AttackBite") {
    const lunge = Math.max(0, Math.sin((t - 0.12) * Math.PI * 1.25));
    p.hip = [0, -0.08 * lunge, 0.14 * lunge];
    p.rot = {
      Spine: [0.3 * lunge, 0, 0.04 * wave],
      Neck: [-0.15 * lunge, 0, 0],
      Head: [0.23 * Math.sin(t * Math.PI * 4) * lunge, 0, 0],
      LeftArm: [-1.6 * lunge, 0, -0.18 * lunge],
      RightArm: [-1.6 * lunge, 0, 0.18 * lunge],
      LeftForeArm: [-0.35 * lunge, 0, 0],
      RightForeArm: [-0.35 * lunge, 0, 0],
    };
    for (const side of ["Left", "Right"])
      for (const finger of ["Index", "Middle", "Ring", "Pinky"])
        p.rot[side + "Hand" + finger + "1"] = [0.5 * lunge, 0, 0];
  }
  if (name === "HitTorso")
    p.rot = {
      Spine: [-0.28 * pulse, 0, 0.08 * pulse],
      Head: [0.12 * pulse, 0, 0],
      LeftArm: [0.18 * pulse, 0, 0],
      RightArm: [0.18 * pulse, 0, 0],
    };
  if (name === "HitHead")
    p.rot = {
      Head: [-0.4 * pulse, 0.2 * pulse, 0.17 * pulse],
      Neck: [-0.12 * pulse, 0, 0],
      Spine: [-0.08 * pulse, 0, 0],
    };
  if (name === "LightStun") {
    p.hip[1] = -0.08 * pulse;
    p.rot = {
      Spine: [-0.16 * pulse, 0, 0.045 * wave],
      Head: [-0.28 * pulse, 0.12 * wave, 0],
      LeftArm: [-0.8 * pulse, 0, -0.38 * pulse],
      RightArm: [-0.8 * pulse, 0, 0.38 * pulse],
      LeftForeArm: [-1.15 * pulse, 0, 0],
      RightForeArm: [-1.15 * pulse, 0, 0],
    };
  }
  if (["Crawl", "CrawlAttack", "LegFall"].includes(name)) {
    const c = crawl(),
      f = name === "LegFall" ? T.MathUtils.smoothstep(t, 0.1, 0.95) : 1;
    p.hip = c.hip.map((v) => v * f) as Pose["hip"];
    for (const [b, r] of Object.entries(c.rot))
      p.rot[b] = r.map((v) => v * f) as [number, number, number];
    if (name === "Crawl") {
      p.hip[1] += 0.015 * wave;
      p.rot.LeftArm[0] += 0.22 * wave;
      p.rot.RightArm[0] -= 0.22 * wave;
      p.rot.LeftLeg[0] += 0.15 * wave;
      p.rot.RightLeg[0] -= 0.15 * wave;
      p.rot.Head[1] = 0.04 * wave;
    }
    if (name === "CrawlAttack") {
      p.hip[2] += 0.22 * pulse;
      p.rot.Spine[0] += 0.2 * pulse;
      p.rot.Head[0] += 0.25 * Math.sin(t * Math.PI * 3);
      p.rot.LeftArm[0] -= 0.45 * pulse;
      p.rot.RightArm[0] -= 0.45 * pulse;
    }
  }
  if (name === "Death" || name === "DeathHead") {
    const f = T.MathUtils.smoothstep(t, 0.05, 0.9);
    p.hip = [0.07 * f, -0.82 * f, -0.13 * f];
    p.rot = {
      Hips: [1.48 * f, 0, 0.1 * f],
      Spine: [0.08 * f, 0, -0.12 * f],
      Head: [name === "DeathHead" ? -0.65 * f : 0.15 * f, 0.1 * f, 0.12 * f],
      LeftArm: [-0.2 * f, 0, -0.35 * f],
      RightArm: [-0.32 * f, 0, 0.4 * f],
      LeftUpLeg: [-0.1 * f, 0, 0],
      RightUpLeg: [-0.13 * f, 0, 0],
      LeftLeg: [0.25 * f, 0, 0],
      RightLeg: [0.35 * f, 0, 0],
    };
  }
  return p;
}
export const authoredDurations = {
  Idle: 2.6,
  AttackBite: 0.8,
  HitTorso: 0.32,
  HitHead: 0.32,
  LightStun: 1,
  LegFall: 0.8,
  Crawl: 1.25,
  CrawlAttack: 0.75,
  Death: 0.85,
  DeathHead: 0.8,
};
/** Original keyframes in character axes, converted into the supplied Mixamo bone frames. */
export function authorZombieClips(bones: BonePose[]) {
  const clips: T.AnimationClip[] = [];
  for (const [name, duration] of Object.entries(authoredDurations)) {
    const tracks: T.KeyframeTrack[] = [],
      steps = name === "Idle" ? 12 : 10;
    const times = Array.from(
      { length: steps + 1 },
      (_, i) => (i * duration) / steps,
    );
    for (const b of bones) {
      const qs: number[] = [],
        ps: number[] = [],
        ss: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const pose = sample(name, i / steps),
          r = pose.rot[b.short] || [0, 0, 0];
        const delta = new T.Quaternion().setFromEuler(new T.Euler(...r));
        const q = b.parentRotation
          .clone()
          .invert()
          .multiply(delta)
          .multiply(b.parentRotation)
          .multiply(b.quaternion);
        qs.push(...q.toArray());
        const pos = b.position.clone();
        if (b.short === "Hips") pos.add(new T.Vector3(...pose.hip));
        ps.push(...pos.toArray());
        ss.push(...b.scale.toArray());
      }
      tracks.push(
        new T.QuaternionKeyframeTrack(b.name + ".quaternion", times, qs),
        new T.VectorKeyframeTrack(b.name + ".position", times, ps),
        new T.VectorKeyframeTrack(b.name + ".scale", times, ss),
      );
    }
    clips.push(new T.AnimationClip(name, duration, tracks));
  }
  const tremorTracks: T.KeyframeTrack[] = [];
  for (const b of bones.filter((b) =>
    ["Spine2", "Neck", "Head", "LeftForeArm", "RightForeArm"].includes(b.short),
  )) {
    const times = [0, 0.1, 0.22, 0.34, 0.48, 0.62, 0.78],
      values: number[] = [];
    times.forEach((t, i) =>
      values.push(
        ...new T.Quaternion()
          .setFromEuler(
            new T.Euler(
              i === 0 || i === 6 ? 0 : Math.sin(i * 7) * 0.018,
              0,
              i === 0 || i === 6 ? 0 : Math.cos(i * 4) * 0.014,
            ),
          )
          .toArray(),
      ),
    );
    tremorTracks.push(
      new T.QuaternionKeyframeTrack(b.name + ".quaternion", times, values),
    );
  }
  const tremor = new T.AnimationClip("Tremor", 0.78, tremorTracks);
  T.AnimationUtils.makeClipAdditive(tremor);
  clips.push(tremor);
  return clips;
}
export function inPlace(clip: T.AnimationClip) {
  const c = clip.clone();
  for (const t of c.tracks)
    if (/Hips\.position$/.test(t.name)) {
      const x = t.values[0],
        z = t.values[2];
      for (let i = 0; i < t.values.length; i += 3) {
        t.values[i] = x;
        t.values[i + 2] = z;
      }
    }
  return c;
}

/** Remove only constant position/scale channels equal to the imported bind transform.
 * Keep hips translation and real offsets (the supplied zombie's UpLeg offsets are ~1 cm).
 * Epsilon is one micrometre; animated quaternions are never removed here. */
export function compactRigClips(clips: T.AnimationClip[], root: T.Object3D) {
  const nodes = new Map<string, T.Object3D>();
  root.traverse((o) => nodes.set(o.name, o));
  return clips.map((source) => {
    const clip = source.clone();
    clip.tracks = clip.tracks.filter((track) => {
      const dot = track.name.lastIndexOf("."),
        name = track.name.slice(0, dot),
        property = track.name.slice(dot + 1),
        node = nodes.get(name);
      if (
        !node ||
        !["position", "scale"].includes(property) ||
        (/Hips$/.test(name) && property === "position")
      )
        return true;
      const bind = (
        property === "position" ? node.position : node.scale
      ).toArray();
      return Array.from(track.values).some(
        (v, i) => Math.abs(v - bind[i % 3]) > 1e-6,
      );
    });
    return clip;
  });
}
