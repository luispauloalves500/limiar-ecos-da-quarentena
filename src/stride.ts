import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { plantedSpeed } from "./locomotion";

/** Measure, once at load, the planted-foot speed of in-place locomotion clips
 * on a throwaway clone (48 samples per clip). Used to sync playback rate to
 * real ground speed so feet do not slide. */
export function measureStrides(
  scene: T.Object3D,
  clips: T.AnimationClip[],
  names: string[],
) {
  const root = clone(scene),
    mixer = new T.AnimationMixer(root),
    feet: T.Object3D[] = [],
    speeds: Record<string, number> = {};
  root.traverse((o) => {
    if (o instanceof T.Bone && /(Left|Right)Foot$/.test(o.name)) feet.push(o);
  });
  if (feet.length !== 2) return { speeds, ankle: 0.08 };
  feet.sort((a) => (a.name.includes("Left") ? -1 : 1));
  root.updateMatrixWorld(true);
  const w = new T.Vector3(),
    ankle = Math.min(...feet.map((f) => f.getWorldPosition(w).y));
  for (const name of names) {
    const clip = clips.find((c) => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip).play(),
      n = 48,
      dt = clip.duration / n,
      samples: { y: [number, number]; z: [number, number] }[] = [];
    for (let i = 0; i <= n; i++) {
      mixer.setTime(i * dt);
      root.updateMatrixWorld(true);
      const l = feet[0].getWorldPosition(new T.Vector3()),
        r = feet[1].getWorldPosition(new T.Vector3());
      samples.push({ y: [l.y, r.y], z: [l.z, r.z] });
    }
    const v = plantedSpeed(samples, dt);
    if (v > 0.2 && v < 7) speeds[name] = v;
    a.stop();
    mixer.uncacheAction(clip);
  }
  mixer.uncacheRoot(root);
  return { speeds, ankle };
}
