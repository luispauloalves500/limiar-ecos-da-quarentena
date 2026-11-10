import { compactRigClips } from "../src/zombie-clips";
import { newGame, parseSave } from "../src/logic";
import { describe, it, expect } from "vitest";
import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { authorZombieClips, inPlace, type BonePose } from "../src/zombie-clips";
const bones: BonePose[] = [
  "Hips",
  "Spine",
  "Spine2",
  "Neck",
  "Head",
  "LeftArm",
  "RightArm",
  "LeftForeArm",
  "RightForeArm",
  "LeftUpLeg",
  "RightUpLeg",
  "LeftLeg",
  "RightLeg",
].map((short) => ({
  name: "mixamorig" + short,
  short,
  position: new T.Vector3(0, short === "Hips" ? 1 : 0.1, 0),
  quaternion: new T.Quaternion(),
  scale: new T.Vector3(1, 1, 1),
  parentRotation: new T.Quaternion(),
}));
describe("animações autorais do esqueleto fornecido", () => {
  const clips = authorZombieClips(bones);
  it("cria dez ações e tremor aditivo, sem alterar a pose de referência", () => {
    expect(clips).toHaveLength(11);
    expect(clips.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "Idle",
        "AttackBite",
        "HitTorso",
        "HitHead",
        "LightStun",
        "LegFall",
        "Crawl",
        "CrawlAttack",
        "Death",
        "DeathHead",
        "Tremor",
      ]),
    );
    expect(bones[0].position.y).toBe(1);
    expect(clips.find((c) => c.name === "Tremor")!.blendMode).toBe(
      T.AdditiveAnimationBlendMode,
    );
  });
  for (const clip of clips)
    it(`${clip.name}: keyframes finitos e tempos válidos`, () => {
      expect(clip.validate()).toBe(true);
      expect(clip.duration).toBeGreaterThan(0);
      for (const track of clip.tracks)
        expect([...track.values].every(Number.isFinite)).toBe(true);
    });
  it("crawling e morte baixam quadril; perna termina na pose rastejante", () => {
    const y = (name: string) => {
      const t = clips
        .find((c) => c.name === name)!
        .tracks.find((t) => t.name === "mixamorigHips.position")!;
      return [...t.values].filter((_, i) => i % 3 === 1);
    };
    expect(Math.min(...y("Crawl"))).toBeLessThan(0.4);
    expect(y("LegFall").at(-1)).toBeCloseTo(y("Crawl").at(-1)!);
    expect(y("Death").at(-1)).toBeLessThan(0.2);
  });
  it("remove deslocamento horizontal dos clips recebidos sem modificar original", () => {
    const c = new T.AnimationClip("Walking", 1, [
      new T.VectorKeyframeTrack(
        "mixamorigHips.position",
        [0, 1],
        [0.1, 1, 0.2, 4, 1.1, 5],
      ),
    ]);
    const fixed = inPlace(c);
    expect([...fixed.tracks[0].values]).toEqual(
      expect.arrayContaining([expect.closeTo(0.1), expect.closeTo(0.2)]),
    );
    expect(fixed.tracks[0].values[3]).toBeCloseTo(0.1);
    expect(c.tracks[0].values[3]).toBe(4);
  });
  it("SkeletonUtils.clone separa ossos/skeleton, mas compartilha geometria/material", () => {
    const root = new T.Group(),
      hip = new T.Bone(),
      leg = new T.Bone();
    hip.add(leg);
    root.add(hip);
    const g = new T.BoxGeometry(),
      mat = new T.MeshStandardMaterial(),
      mesh = new T.SkinnedMesh(g, mat);
    root.add(mesh);
    mesh.bind(new T.Skeleton([hip, leg]));
    const c = clone(root),
      copy = c.children.find(
        (o) => o instanceof T.SkinnedMesh,
      ) as T.SkinnedMesh;
    expect(copy.geometry).toBe(g);
    expect(copy.material).toBe(mat);
    expect(copy.skeleton).not.toBe(mesh.skeleton);
    expect(copy.skeleton.bones[0]).not.toBe(hip);
    copy.skeleton.bones[0].position.x = 4;
    expect(hip.position.x).toBe(0);
  });
});

describe("metadados de reação no save", () => {
  it("rejeita contador inválido de impactos", () => {
    const s = newGame();
    s.enemies.errante01.hitSerial = -1;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it("preserva reação de cabeça e atordoamento pela luz", () => {
    const s = newGame();
    s.enemies.errante01.lastHit = "head";
    s.enemies.errante01.lightStunned = true;
    const r = parseSave(JSON.stringify(s));
    expect(r.enemies.errante01.lastHit).toBe("head");
    expect(r.enemies.errante01.lightStunned).toBe(true);
  });
});

describe("compactação segura de tracks de rig", () => {
  const root = new T.Group(),
    hip = new T.Bone(),
    arm = new T.Bone();
  hip.name = "mixamorigHips";
  arm.name = "mixamorigRightArm";
  arm.position.set(0.2, 0.3, 0.4);
  root.add(hip, arm);
  const clip = new T.AnimationClip("walk", 1, [
    new T.VectorKeyframeTrack(
      arm.name + ".position",
      [0, 1],
      [0.2, 0.3, 0.4, 0.2, 0.3, 0.4],
    ),
    new T.VectorKeyframeTrack(arm.name + ".scale", [0, 1], [1, 1, 1, 1, 1, 1]),
    new T.VectorKeyframeTrack(
      hip.name + ".position",
      [0, 1],
      [0, 0, 0, 0, 0, 0],
    ),
  ]);
  it("descarta somente canais iguais ao bind e preserva Hips", () => {
    const c = compactRigClips([clip], root)[0];
    expect(c.tracks.map((t) => t.name)).toEqual([hip.name + ".position"]);
    expect(clip.tracks.length).toBe(3);
  });
  it("mantém offset constante real em vez de alterar anatomia", () => {
    const c = clip.clone();
    c.tracks[0].values[0] += 0.01;
    expect(compactRigClips([c], root)[0].tracks).toHaveLength(2);
  });
  it("mantém escala realmente animada", () => {
    const c = clip.clone();
    c.tracks[1].values[3] = 0.9;
    expect(compactRigClips([c], root)[0].tracks).toHaveLength(2);
  });
});
