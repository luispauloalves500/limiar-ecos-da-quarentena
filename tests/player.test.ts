import { supportGrip } from "../src/player-clips";
import { describe, it, expect } from "vitest";
import * as T from "three";
import {
  authorPlayerClips,
  maskedClip,
  playerDurations,
  upperTrack,
} from "../src/player-clips";
import type { BonePose } from "../src/zombie-clips";
const bones: BonePose[] = [
  "Hips",
  "Spine2",
  "Head",
  "RightArm",
  "LeftArm",
  "LeftUpLeg",
  "RightUpLeg",
].map((short) => ({
  short,
  name: "mixamorig" + short,
  position: new T.Vector3(0, short === "Hips" ? 1 : 0, 0),
  quaternion: new T.Quaternion(),
  scale: new T.Vector3(1, 1, 1),
  parentRotation: new T.Quaternion(),
}));
describe("clips de Helena", () => {
  const clips = authorPlayerClips(bones);
  it.each(Object.keys(playerDurations))(
    "%s tem keyframes válidos e tempo positivo",
    (name) => {
      const c = clips.find((c) => c.name === name)!;
      expect(c.duration).toBeGreaterThan(0);
      expect(c.validate()).toBe(true);
      expect(c.tracks.length).toBe(bones.length * 3);
    },
  );
  it("máscaras de membros superiores/inferiores não se sobrepõem", () => {
    const c = clips.find((c) => c.name === "Aim")!,
      u = maskedClip(c, true),
      l = maskedClip(c, false);
    expect(u.tracks.every(upperTrack)).toBe(true);
    expect(l.tracks.some(upperTrack)).toBe(false);
    expect(u.tracks.length + l.tracks.length).toBe(c.tracks.length);
    expect(c.tracks.length).toBe(bones.length * 3);
  });
  it("morte abaixa quadril; recarga retorna à pose de mira", () => {
    const death = clips
        .find((c) => c.name === "PlayerDeath")!
        .tracks.find((t) => t.name.endsWith("Hips.position"))!,
      reload = clips
        .find((c) => c.name === "Reload")!
        .tracks.find((t) => t.name.endsWith("RightArm.quaternion"))!;
    expect(death.values.at(-2)).toBeLessThan(0.2);
    expect(Array.from(reload.values.slice(0, 4))).toEqual(
      Array.from(reload.values.slice(-4)),
    );
  });
});

it("apoio da mão esquerda converge sem mover quadril/arma direita", () => {
  const root = new T.Group(),
    arm = new T.Bone(),
    elbow = new T.Bone(),
    hand = new T.Bone(),
    right = new T.Bone();
  root.add(arm, right);
  arm.add(elbow);
  elbow.add(hand);
  elbow.position.set(0, -0.3, 0);
  hand.position.set(0, -0.3, 0);
  right.position.set(-0.25, -0.25, 0.25);
  root.updateMatrixWorld(true);
  const target = right.getWorldPosition(new T.Vector3()),
    before = hand.getWorldPosition(new T.Vector3()).distanceTo(target);
  supportGrip(root, arm, elbow, hand, target);
  expect(
    hand.getWorldPosition(new T.Vector3()).distanceTo(target),
  ).toBeLessThan(before * 0.15);
  expect(right.position.toArray()).toEqual([-0.25, -0.25, 0.25]);
  expect(root.position.length()).toBe(0);
});

describe("pose procedural estável 0.4", () => {
  it("não acumula pitch/IK quando o mixer omite tracks constantes", async () => {
    const { PoseRestore } = await import("../src/player-clips");
    const root = new T.Group(),
      bone = new T.Bone();
    bone.name = "Spine2";
    root.add(bone);
    const q = new T.Quaternion().setFromEuler(new T.Euler(0.15, 0, 0));
    const clip = new T.AnimationClip("constant", 2, [
      new T.QuaternionKeyframeTrack(
        "Spine2.quaternion",
        [0, 2],
        [...q.toArray(), ...q.toArray()],
      ),
    ]);
    const mixer = new T.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const cache = new PoseRestore([bone]);
    const delta = new T.Quaternion().setFromEuler(new T.Euler(0.06, 0, 0));
    for (let i = 0; i < 600; i++) {
      cache.restore();
      mixer.update(1 / 60);
      cache.capture();
      bone.quaternion.premultiply(delta);
    }
    expect(bone.quaternion.angleTo(delta.clone().multiply(q))).toBeLessThan(
      0.001,
    );
    cache.restore();
    expect(bone.quaternion.angleTo(q)).toBeLessThan(0.001);
  });
});
