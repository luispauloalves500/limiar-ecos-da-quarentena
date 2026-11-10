import type { ZombieAnimator } from "./zombie";
import * as T from "three";
import { box, capsule, material as mat } from "./art";
import type { Region } from "./logic";
export type Actor = {
  root: T.Group;
  body: T.Group;
  head: T.Object3D;
  animation?: ZombieAnimator;
  arms: T.Group[];
  elbows: T.Group[];
  legs: T.Group[];
  knees: T.Group[];
  hitboxes: T.Mesh[];
  warning: T.Group;
  core?: T.Mesh;
  gun?: T.Object3D;
};
export function person(
  enemy = false,
  boss = false,
  id = "player",
  kind = "E01",
): Actor {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const cloth = mat(
      boss
        ? 0x4c514a
        : enemy
          ? kind === "E02"
            ? 0x728e8a
            : kind === "E04"
              ? 0x86554b
              : 0x9a9e8f
          : 0x946e46,
    ),
    skin = mat(enemy ? 0x828b76 : 0xbe9c80),
    dark = mat(0x202d2d),
    metal = mat(0x747c6b, 0.5, 0.65);
  const hitboxes: T.Mesh[] = [];
  const hit = (
    parent: T.Object3D,
    geo: T.BufferGeometry,
    region: Region,
    x: number,
    y: number,
    z: number,
  ) => {
    const h = new T.Mesh(
      geo,
      new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }),
    );
    h.position.set(x, y, z);
    h.userData = { enemyId: id, region };
    parent.add(h);
    hitboxes.push(h);
  };
  const torso = capsule(0.245, 0.32, cloth, 0, 1.17, 0);
  torso.scale.set(1, 0.98, 0.67);
  body.add(torso);
  body.add(capsule(0.22, 0.08, dark, 0, 0.84, 0));
  body.add(box(0.46, 0.07, 0.32, mat(0x4e4533), 0, 0.87, 0));
  const head = new T.Mesh(new T.SphereGeometry(0.215, 12, 9), skin);
  head.scale.set(0.86, 1.08, 0.85);
  head.position.set(0, 1.73, 0.015);
  head.castShadow = true;
  body.add(head);
  head.add(capsule(0.045, 0.02, skin, 0, -0.01, 0.18));
  for (const x of [-0.08, 0.08])
    head.add(
      box(0.046, 0.025, 0.025, mat(enemy ? 0x9fc68d : 0x302b22), x, 0.04, 0.18),
    );
  const hair = new T.Mesh(
    new T.SphereGeometry(0.221, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.57),
    mat(enemy ? 0x4d5545 : 0x302821),
  );
  hair.position.y = 0.035;
  head.add(hair);
  if (enemy && kind === "E02") {
    head.add(box(0.4, 0.08, 0.28, mat(0xb9c1ab), 0, 0.27, 0));
    body.add(box(0.32, 0.5, 0.04, mat(0xbac0ae), 0, 1.12, 0.24));
  }
  if (enemy && kind === "E04")
    body.add(box(0.32, 0.05, 0.05, mat(0x9d3934), 0, 1.25, 0.25));
  if (!enemy) head.add(capsule(0.08, 0.16, mat(0x302821), 0, -0.1, -0.19));
  body.add(capsule(0.09, 0.1, skin, 0, 1.53, 0));
  hit(head, new T.SphereGeometry(0.24, 10, 8), "head", 0, 0, 0);
  hit(body, new T.BoxGeometry(0.55, 0.77, 0.39), "body", 0, 1.13, 0);
  const arms: T.Group[] = [],
    elbows: T.Group[] = [],
    legs: T.Group[] = [],
    knees: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.3, 1.43, 0);
    arm.add(capsule(0.085, 0.22, cloth, 0, -0.16, 0));
    const elbow = new T.Group();
    elbow.position.y = -0.32;
    elbow.add(capsule(0.068, 0.2, enemy ? skin : cloth, 0, -0.12, 0));
    elbow.add(capsule(0.069, 0.06, skin, 0, -0.28, 0));
    arm.add(elbow);
    body.add(arm);
    arms.push(arm);
    elbows.push(elbow);
    const leg = new T.Group();
    leg.position.set(side * 0.145, 0.83, 0);
    leg.add(capsule(0.105, 0.2, enemy ? cloth : dark, 0, -0.16, 0));
    const knee = new T.Group();
    knee.position.y = -0.32;
    knee.add(capsule(0.083, 0.22, enemy ? skin : dark, 0, -0.15, 0));
    knee.add(box(0.19, 0.14, 0.32, dark, 0, -0.4, 0.05));
    leg.add(knee);
    body.add(leg);
    legs.push(leg);
    knees.push(knee);
    hit(
      leg,
      new T.BoxGeometry(0.23, 0.8, 0.3),
      side === -1 ? "legL" : "legR",
      0,
      -0.37,
      0,
    );
  }
  let gun: T.Object3D | undefined, core: T.Mesh | undefined;
  if (!enemy) {
    body.add(box(0.34, 0.38, 0.16, mat(0x4f543b), 0, 1.15, -0.24));
    body.add(box(0.46, 0.045, 0.33, mat(0xb5bea2), 0, 1.27, 0));
    for (const x of [-0.16, 0.16])
      body.add(box(0.05, 0.5, 0.05, mat(0x5e5a3e), x, 1.2, -0.29));
    gun = new T.Group();
    gun.add(box(0.09, 0.1, 0.32, mat(0x35413b, 0.35, 0.8), 0, 0, 0.11));
    gun.add(box(0.07, 0.15, 0.08, dark, 0, -0.08, 0));
    elbows[1].add(gun);
    gun.position.set(0, -0.28, 0.07);
    body.add(box(0.1, 0.1, 0.1, metal, 0.18, 1.34, 0.2));
  } else if (boss) {
    body.add(box(0.78, 0.3, 0.42, metal, 0, 1.37, 0));
    body.add(box(0.15, 0.6, 0.46, metal, -0.35, 1.05, 0));
    core = new T.Mesh(
      new T.IcosahedronGeometry(0.13, 1),
      new T.MeshBasicMaterial({ color: 0xc6a67b }),
    );
    core.position.set(0, 1.23, 0.27);
    body.add(core);
    head.add(box(0.31, 0.24, 0.08, metal, 0, 0, 0.17));
    root.scale.setScalar(1.5);
  }
  const warning = new T.Group();
  const ring = new T.Mesh(
    new T.RingGeometry(boss ? 1.5 : 0.9, boss ? 1.54 : 0.94, 40),
    new T.MeshBasicMaterial({
      color: 0xd4a16b,
      transparent: true,
      opacity: 0.65,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  warning.add(ring);
  if (boss) warning.add(box(0.07, 0.01, 3, mat(0xd4a16b), 0, 0.01, 1.8));
  warning.position.y = 0.025;
  warning.visible = false;
  root.add(warning);
  const shadow = new T.Mesh(
    new T.CircleGeometry(0.36, 20),
    new T.MeshBasicMaterial({
      color: 0x030706,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);
  return {
    root,
    body,
    head,
    arms,
    elbows,
    legs,
    knees,
    hitboxes,
    warning,
    core,
    gun,
  };
}
export function animate(
  a: Actor,
  moving: boolean,
  time: number,
  aim: boolean,
  recoil = 0,
) {
  const stride = moving ? Math.sin(time) * 0.55 : 0;
  a.legs.forEach((l, i) => (l.rotation.x = (i ? -1 : 1) * stride));
  a.knees.forEach(
    (k, i) =>
      (k.rotation.x = moving
        ? Math.max(0, Math.sin(time + i * Math.PI)) * 0.65
        : 0),
  );
  a.arms.forEach((arm, i) => {
    arm.rotation.x = aim ? -1.35 - recoil * 0.6 : (i ? 1 : -1) * stride * 0.55;
    arm.rotation.z = aim ? (i ? -0.08 : 0.25) : 0;
  });
  a.elbows.forEach(
    (e, i) => (e.rotation.x = aim ? (i ? -0.25 : -0.55) : -0.08),
  );
  a.body.position.y =
    Math.sin(time * (moving ? 2 : 0.28)) * (moving ? 0.025 : 0.012);
  a.body.rotation.z = moving ? Math.sin(time) * 0.025 : 0;
}
