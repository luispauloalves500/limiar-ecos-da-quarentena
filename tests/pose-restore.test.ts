import { describe, expect, it } from "vitest";
import * as T from "three";
import { PoseRestore } from "../src/player-clips";

/** 0.10: the zombie torso spin. three's PropertyMixer skips writing a bone
 * whose mixed value did not change, so an additive layer applied after the
 * mixer piles up on constant channels unless the clip pose is restored. */
function run(restore: boolean) {
  const root = new T.Object3D(),
    spine = new T.Bone();
  spine.name = "Spine1";
  root.add(spine);
  const clip = new T.AnimationClip("Idle", 1, [
    new T.QuaternionKeyframeTrack(
      "Spine1.quaternion",
      [0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1],
    ),
  ]);
  const mixer = new T.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const pose = new PoseRestore([spine]);
  const hunch = new T.Quaternion().setFromEuler(new T.Euler(0.05, 0, 0));
  for (let i = 0; i < 50; i++) {
    if (restore) pose.restore();
    mixer.update(1 / 30);
    if (restore) pose.capture();
    spine.quaternion.premultiply(hunch);
  }
  return spine.quaternion.angleTo(new T.Quaternion());
}
describe("camadas aditivas sobre o mixer", () => {
  it("sem restaurar a pose, a camada acumula (bug do tronco girando)", () => {
    expect(run(false)).toBeGreaterThan(1);
  });
  it("com PoseRestore, a camada fica no valor de um quadro", () => {
    expect(run(true)).toBeCloseTo(0.05, 3);
  });
});
