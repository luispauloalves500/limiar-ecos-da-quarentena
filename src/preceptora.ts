// 0.8: B02 "A Preceptora" — procedural rig, merged per joint and material.
// Tall gaunt infected head nurse: torn uniform, apron, nurse cap with a red
// cross, surgical mask, scalpel arm, syringe arm, clipboard, steel tray
// armour that the auxiliary generator blows open over a glowing core.
import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Actor } from "./actors";
import type { Enemy, Region } from "./logic";
import type { Quality } from "./controls";
import type { ZombieAnimator } from "./zombie";
import { MOVE, MOVES, preceptoraPhase } from "./preceptora-logic";
import { enemyStats } from "./logic";
import { seeded } from "./art";
import { SmartSkin, smartMaterial, smartReady } from "./smartrig";

/** 0.9: the user's GLB (veiled woman, SmartRig, T-pose) driven by the 0.8
 * procedural rig: every procedural joint's model-space rotation is copied to
 * the matching bone, so all 0.8 animations, hitboxes and telegraphs stay. */
export const PRECEPTORA_GLB_SCALE = 1.44;
const GLB_HIP = 1.07 * PRECEPTORA_GLB_SCALE;
type Retarget = { part: () => T.Object3D; bone: string; fix: T.Quaternion };
const qz = (a: number) =>
  new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), a);
const ID = new T.Quaternion();

const probe = new T.Color(0, 0, 0);
const live = new Set<Preceptora>();
/** Same room-level light probe as the zombies, plus a small floor. */
export function setPreceptoraProbe(c: T.Color) {
  probe.copy(c);
  live.forEach((p) => p.applyProbe());
}

type Geo = T.BufferGeometry;
class Part {
  group = new T.Group();
  list = new Map<T.Material, Geo[]>();
  constructor(
    public name: string,
    parent?: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    this.group.name = name;
    this.group.position.set(x, y, z);
    parent?.add(this.group);
  }
  add(
    geo: Geo,
    m: T.Material,
    p: [number, number, number] = [0, 0, 0],
    r: [number, number, number] = [0, 0, 0],
    s: [number, number, number] = [1, 1, 1],
  ) {
    const g = geo.index ? geo : geo;
    g.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(...p),
        new T.Quaternion().setFromEuler(new T.Euler(...r)),
        new T.Vector3(...s),
      ),
    );
    if (!this.list.has(m)) this.list.set(m, []);
    this.list.get(m)!.push(g);
    return this;
  }
  build() {
    for (const [m, geos] of this.list) {
      const merged = mergeGeometries(
        geos.map((g) => (g.index ? g : g)),
        false,
      );
      geos.forEach((g) => g.dispose());
      const mesh = new T.Mesh(merged, m);
      mesh.receiveShadow = true;
      mesh.name = this.name + "-" + (m.name || "m");
      this.group.add(mesh);
    }
    this.list.clear();
    return this.group;
  }
}
/** Tapered limb hanging down from the origin along -Y. */
const limb = (r1: number, r2: number, len: number, seg = 8) =>
  new T.CylinderGeometry(r1, r2, len, seg, 2).translate(0, -len / 2, 0);
const ball = (r: number, w = 8, h = 6) => new T.SphereGeometry(r, w, h);
const cube = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d);

function stainTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const rand = seeded(8021);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(60,60,40,${rand() * 0.12})`;
    g.fillRect(rand() * 128, rand() * 128, 1 + rand() * 3, 1 + rand() * 3);
  }
  // Old grime from the hem up, then dried and fresh blood.
  const grad = g.createLinearGradient(0, 128, 0, 60);
  grad.addColorStop(0, "rgba(70,58,40,0.55)");
  grad.addColorStop(1, "rgba(70,58,40,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // Irregular dried blood: clusters of small blots with drips, not dots.
  for (let i = 0; i < 9; i++) {
    const cx = rand() * 128,
      cy = rand() * 100;
    for (let k = 0; k < 14; k++) {
      const x = cx + (rand() - 0.5) * 22,
        y = cy + (rand() - 0.5) * 14,
        r = 0.8 + rand() * 4.5;
      g.fillStyle = `rgba(${62 + rand() * 40},${12 + rand() * 10},${10},${0.25 + rand() * 0.45})`;
      g.beginPath();
      g.ellipse(x, y, r * 1.6, r, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 3; k++) {
      g.fillStyle = `rgba(70,16,12,${0.3 + rand() * 0.3})`;
      g.fillRect(
        cx + (rand() - 0.5) * 18,
        cy,
        1 + rand() * 1.5,
        10 + rand() * 34,
      );
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}

type Rim = { value: T.Color };
function standard(
  name: string,
  color: number,
  rim: Rim,
  opts: T.MeshStandardMaterialParameters = {},
) {
  const m = new T.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  m.name = name;
  m.userData.albedo = new T.Color(color);
  // Fresnel rim: keeps her silhouette readable in the dark arena and is the
  // carrier of the telegraph/hit-flash colour. One uniform, no extra lights.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = rim;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nfloat rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);\ntotalEmissiveRadiance += rimColor * rimF;",
      );
  };
  m.customProgramCacheKey = () => "preceptora-rim";
  return m;
}

type Joints = {
  body: T.Group;
  hips: T.Group;
  spine: T.Group;
  chest: T.Group;
  neck: T.Group;
  head: T.Group;
  arm: T.Group[];
  elbow: T.Group[];
  hand: T.Group[];
  leg: T.Group[];
  knee: T.Group[];
  plate: T.Group[];
  skirt: T.Group;
};
const KEYS = [
  "body.y",
  "body.x",
  "body.z",
  "hips.x",
  "hips.y",
  "spine.x",
  "spine.y",
  "spine.z",
  "chest.x",
  "neck.x",
  "head.x",
  "head.y",
  "head.z",
  "arm0.x",
  "arm0.y",
  "arm0.z",
  "arm1.x",
  "arm1.y",
  "arm1.z",
  "elbow0.x",
  "elbow1.x",
  "hand0.x",
  "hand1.x",
  "leg0.x",
  "leg0.z",
  "leg1.x",
  "leg1.z",
  "knee0.x",
  "knee1.x",
  "plate",
  "skirt.x",
  "body.pz",
] as const;
type Key = (typeof KEYS)[number];
type Pose = Record<Key, number>;
const zero = (): Pose => Object.fromEntries(KEYS.map((k) => [k, 0])) as Pose;

export class Preceptora {
  root = new T.Group();
  j: Joints;
  hitboxes: T.Mesh[] = [];
  warning = new T.Group();
  ring: T.Mesh;
  fill: T.Mesh;
  lane: T.Mesh;
  laneFill: T.Mesh;
  core: T.Mesh;
  glow: T.Mesh;
  sheet: T.Mesh;
  eyes: T.MeshBasicMaterial;
  rim: Rim = { value: new T.Color(0, 0, 0) };
  cloth: T.MeshStandardMaterial[] = [];
  materials: T.Material[] = [];
  textures: T.Texture[] = [];
  pose = zero();
  target = zero();
  t = 0;
  walk = 0;
  serial = 0;
  hitAt = -9;
  hitSide = 1;
  hitStrong = false;
  stateName = "Idle";
  spin = 0;
  stuckAt = -1;
  skin?: SmartSkin;
  retargets: Retarget[] = [];
  constructor(
    public enemy: Enemy,
    glb = false,
  ) {
    live.add(this);
    const rim = this.rim;
    const stain = stainTexture();
    this.textures.push(stain);
    const uniform = standard("uniforme", 0x56604f, rim, {
        map: stain,
        side: T.DoubleSide,
        roughness: 0.92,
      }),
      apron = standard("avental", 0x9c917a, rim, {
        map: stain,
        side: T.DoubleSide,
        roughness: 0.88,
      }),
      skin = standard("pele", 0x8f957f, rim, { roughness: 0.62 }),
      dark = standard("escuro", 0x35302d, rim, { roughness: 0.75 }),
      metal = standard("bandeja", 0x8c938c, rim, {
        roughness: 0.38,
        metalness: 0.6,
      }),
      blade = standard("lamina", 0xdde4e1, rim, {
        roughness: 0.16,
        metalness: 0.92,
        emissive: new T.Color(0x2a2620),
      }),
      wood = standard("prancheta", 0x6e5338, rim, { roughness: 0.8 });
    const red = new T.MeshBasicMaterial({ color: 0xb4322a });
    red.name = "cruz";
    this.eyes = new T.MeshBasicMaterial({ color: 0xf0dca8 });
    this.eyes.name = "olhos";
    const fluid = new T.MeshBasicMaterial({ color: 0x7fae54 });
    fluid.name = "soro";
    const coreMat = new T.MeshBasicMaterial({ color: 0x7a2a18 });
    const glowMat = new T.MeshBasicMaterial({
      color: 0xff9a4a,
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    this.cloth = [uniform, apron, skin, dark, metal, wood];
    this.materials = [
      uniform,
      apron,
      skin,
      dark,
      metal,
      blade,
      wood,
      red,
      this.eyes,
      fluid,
      coreMat,
      glowMat,
    ];

    const body = new T.Group();
    body.name = "corpo";
    this.root.add(body);
    // ---- pelvis: skirt, apron, belt, clipboard
    const hips = new Part("quadril", body, 0, 1.2, 0);
    const skirtPart = new Part("saia", hips.group, 0, 0.02, 0);
    const skirt = new T.LatheGeometry(
      [
        [0.16, 0.08],
        [0.2, -0.05],
        [0.26, -0.3],
        [0.28, -0.55],
        [0.29, -0.7],
      ].map(([r, y]) => new T.Vector2(r, y)),
      16,
    );
    {
      // Torn hem.
      const pos = skirt.attributes.position as T.BufferAttribute;
      const rand = seeded(77);
      for (let i = 0; i < pos.count; i++)
        if (pos.getY(i) < -0.6) pos.setY(i, pos.getY(i) + rand() * 0.12);
      skirt.computeVertexNormals();
    }
    skirtPart.add(skirt, uniform, [0, 0, 0], [0, 0, 0], [1, 1, 0.82]);
    skirtPart.add(
      new T.CylinderGeometry(0.215, 0.305, 0.62, 10, 1, true, -0.95, 1.9),
      apron,
      [0, -0.32, 0.005],
      [0, 0, 0],
      [1, 1, 0.86],
    );
    hips.add(
      new T.CylinderGeometry(0.175, 0.18, 0.06, 14, 1, true),
      dark,
      [0, 0.06, 0],
      [0, 0, 0],
      [1, 1, 0.82],
    );
    hips.add(cube(0.06, 0.05, 0.02), metal, [0, 0.06, 0.15]);
    // Clipboard with the shift list, hanging from the belt.
    hips.add(
      cube(0.2, 0.27, 0.014),
      wood,
      [0.23, -0.14, 0.04],
      [0.15, 1.25, 0.08],
    );
    hips.add(
      cube(0.17, 0.22, 0.004),
      apron,
      [0.235, -0.15, 0.052],
      [0.15, 1.25, 0.08],
    );
    hips.add(
      cube(0.07, 0.025, 0.03),
      metal,
      [0.232, 0.0, 0.045],
      [0.15, 1.25, 0.08],
    );
    // Key ring.
    hips.add(
      new T.TorusGeometry(0.03, 0.005, 4, 10),
      metal,
      [-0.16, 0.0, 0.1],
      [0, 0.8, 0],
    );
    const legs: T.Group[] = [],
      knees: T.Group[] = [];
    for (const side of [1, -1]) {
      const leg = new Part("coxa", hips.group, side * 0.105, -0.04, 0);
      leg.add(limb(0.07, 0.052, 0.58), dark);
      leg.add(ball(0.056), dark, [0, -0.58, 0]);
      const knee = new Part("canela", leg.group, 0, -0.58, 0);
      knee.add(limb(0.05, 0.034, 0.54), dark);
      // Shin spur: the infection pushes bone through the stocking.
      knee.add(
        new T.ConeGeometry(0.018, 0.09, 5),
        skin,
        [0, -0.12, 0.05],
        [0.6, 0, 0],
      );
      knee.add(cube(0.085, 0.06, 0.21), apron, [0, -0.56, 0.05]);
      knee.add(cube(0.08, 0.025, 0.2), dark, [0, -0.6, 0.05]);
      leg.build();
      knee.build();
      legs.push(leg.group);
      knees.push(knee.group);
    }
    // ---- spine: waist + apron bib
    const spine = new Part("cintura", hips.group, 0, 0.08, 0);
    spine.add(
      new T.LatheGeometry(
        [
          [0.0, -0.06],
          [0.155, -0.04],
          [0.145, 0.12],
          [0.16, 0.3],
          [0.17, 0.38],
        ].map(([r, y]) => new T.Vector2(r, y)),
        14,
      ),
      uniform,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 0.74],
    );
    spine.add(
      new T.CylinderGeometry(0.168, 0.16, 0.32, 8, 1, true, -0.75, 1.5),
      apron,
      [0, 0.17, 0.006],
      [0, 0, 0],
      [1, 1, 0.8],
    );
    // ---- chest: torso, pauldrons, straps, badge, back plates, core
    const chest = new Part("peito", spine.group, 0, 0.36, 0);
    chest.add(
      new T.LatheGeometry(
        [
          [0.0, -0.04],
          [0.17, -0.03],
          [0.205, 0.14],
          [0.215, 0.27],
          [0.17, 0.38],
          [0.06, 0.45],
          [0.0, 0.46],
        ].map(([r, y]) => new T.Vector2(r, y)),
        14,
      ),
      uniform,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 0.7],
    );
    // Collar.
    chest.add(
      new T.CylinderGeometry(0.075, 0.1, 0.07, 10),
      apron,
      [0, 0.43, 0],
    );
    for (const side of [1, -1]) {
      // Bedpan pauldrons.
      chest.add(
        new T.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        metal,
        [side * 0.24, 0.35, 0],
        [0, 0, -side * 0.35],
        [1, 0.75, 1],
      );
      // Apron straps crossing over the shoulders.
      chest.add(
        cube(0.035, 0.42, 0.01),
        apron,
        [side * 0.1, 0.2, 0.152],
        [0, 0, side * 0.18],
      );
      chest.add(
        cube(0.035, 0.42, 0.01),
        apron,
        [side * 0.1, 0.2, -0.152],
        [0, 0, -side * 0.18],
      );
    }
    // Badge: the surgical access card that opens the visor.
    chest.add(
      cube(0.065, 0.085, 0.006),
      apron,
      [-0.12, 0.29, 0.16],
      [0, 0, 0.12],
    );
    chest.add(
      cube(0.065, 0.016, 0.007),
      red,
      [-0.12, 0.315, 0.162],
      [0, 0, 0.12],
    );
    // Bolted back plates along the spine.
    for (let i = 0; i < 3; i++)
      chest.add(
        cube(0.2 - i * 0.03, 0.1, 0.03),
        metal,
        [0, 0.06 + i * 0.12, -0.155],
        [0.12, 0, 0],
      );
    // Ribcage cage + core behind the chest plates.
    for (let i = 0; i < 3; i++)
      chest.add(
        new T.TorusGeometry(0.11 - i * 0.012, 0.01, 4, 12, Math.PI),
        skin,
        [0, 0.08 + i * 0.08, 0.125],
        [0, 0, 0],
        [1, 1, 0.5],
      );
    const core = new T.Mesh(new T.IcosahedronGeometry(0.058, 1), coreMat);
    core.position.set(0, 0.17, 0.14);
    core.name = "nucleo";
    chest.group.add(core);
    const glow = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), glowMat);
    glow.position.copy(core.position).add(new T.Vector3(0, 0, 0.05));
    glow.name = "brilho";
    chest.group.add(glow);
    // Armour: two sterilisation-tray plates hinged at the sides.
    const plates: T.Group[] = [];
    for (const side of [1, -1]) {
      const plate = new Part("placa", chest.group, side * 0.19, 0.16, 0.08);
      plate.add(
        cube(0.19, 0.3, 0.022),
        metal,
        [-side * 0.095, 0, 0.115],
        [0, side * 0.32, 0],
      );
      for (const [x, y] of [
        [0.03, 0.12],
        [0.03, -0.12],
        [0.16, 0.12],
        [0.16, -0.12],
      ])
        plate.add(ball(0.011, 5, 4), dark, [-side * x, y, 0.128 - x * 0.3]);
      plate.add(
        cube(0.012, 0.22, 0.004),
        red,
        [-side * 0.11, 0, 0.128],
        [0, side * 0.32, 0],
      );
      plates.push(plate.group);
      plate.build();
    }
    // ---- neck & head
    const neck = new Part("pescoco", chest.group, 0, 0.42, 0.0);
    neck.add(limb(0.042, 0.05, 0.24, 8).rotateX(Math.PI), skin);
    // Cervical collar.
    neck.add(
      new T.CylinderGeometry(0.068, 0.07, 0.07, 10),
      apron,
      [0, 0.07, 0],
    );
    const head = new Part("cabeca", neck.group, 0, 0.25, 0.01);
    head.add(
      ball(0.13, 14, 10),
      skin,
      [0, 0.0, 0],
      [0, 0, 0],
      [0.84, 1.18, 0.95],
    );
    // Sunken sockets + eyes.
    for (const side of [1, -1]) {
      head.add(
        ball(0.03, 6, 5),
        dark,
        [side * 0.045, 0.03, 0.098],
        [0, 0, 0],
        [1.1, 0.8, 0.5],
      );
      head.add(ball(0.011, 5, 4), this.eyes, [side * 0.045, 0.03, 0.112]);
    }
    // Surgical mask over the jaw.
    head.add(
      new T.SphereGeometry(0.136, 12, 6, Math.PI / 2 - 1.15, 2.3, 1.62, 0.95),
      apron,
      [0, -0.005, 0.0],
      [0, 0, 0],
      [0.88, 1.2, 1.0],
    );
    head.add(
      cube(0.22, 0.008, 0.008),
      dark,
      [0, -0.0, 0.0],
      [0, 0, 0],
      [1, 1, 15],
    );
    // Hair, bun.
    head.add(
      new T.SphereGeometry(0.137, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
      dark,
      [0, 0.012, -0.012],
      [-0.55, 0, 0],
      [0.86, 1.18, 0.97],
    );
    head.add(ball(0.065, 8, 6), dark, [0, 0.03, -0.14]);
    // Nurse cap with a red cross.
    head.add(cube(0.2, 0.085, 0.12), apron, [0, 0.15, -0.01], [-0.35, 0, 0]);
    head.add(cube(0.24, 0.03, 0.12), apron, [0, 0.12, -0.03], [-0.35, 0, 0]);
    head.add(cube(0.045, 0.012, 0.004), red, [0, 0.165, 0.052], [-0.35, 0, 0]);
    head.add(cube(0.012, 0.045, 0.004), red, [0, 0.165, 0.052], [-0.35, 0, 0]);
    // ---- arms
    const arms: T.Group[] = [],
      elbows: T.Group[] = [],
      hands: T.Group[] = [];
    for (const side of [1, -1]) {
      const arm = new Part("braco", chest.group, side * 0.255, 0.34, 0);
      arm.add(limb(0.058, 0.046, 0.5), uniform);
      // Rolled sleeve and bandage turns.
      arm.add(new T.CylinderGeometry(0.06, 0.06, 0.05, 8), apron, [0, -0.3, 0]);
      if (side === 1)
        for (let i = 0; i < 3; i++)
          arm.add(
            new T.TorusGeometry(0.05, 0.008, 4, 10),
            apron,
            [0, -0.08 - i * 0.06, 0],
            [Math.PI / 2, 0, 0.25],
          );
      arm.add(ball(0.045, 6, 5), skin, [0, -0.5, 0]);
      const elbow = new Part("antebraco", arm.group, 0, -0.5, 0);
      elbow.add(limb(0.04, 0.03, 0.5), skin);
      // Bone spur at the elbow: wrong angle, wrong length.
      elbow.add(
        new T.ConeGeometry(0.02, 0.12, 5),
        skin,
        [0, 0.0, -0.05],
        [-2.4, 0, 0],
      );
      const hand = new Part("mao", elbow.group, 0, -0.5, 0);
      hand.add(cube(0.065, 0.09, 0.03), skin, [0, -0.045, 0]);
      for (let f = 0; f < 4; f++)
        hand.add(
          limb(0.009, 0.006, 0.16, 5),
          skin,
          [-0.024 + f * 0.016, -0.085, 0.005],
          [-0.2 - f * 0.05, 0, 0],
        );
      if (side === -1) {
        // Right hand: a long scalpel fused into the palm.
        hand.add(
          new T.CylinderGeometry(0.014, 0.014, 0.14, 6),
          dark,
          [0, -0.11, 0.035],
          [0.15, 0, 0],
        );
        hand.add(
          new T.ConeGeometry(0.06, 0.62, 4)
            .translate(0, -0.31, 0)
            .rotateY(Math.PI / 4),
          blade,
          [0, -0.17, 0.045],
          [Math.PI + 0.15, 0, 0],
          [0.22, 1, 1],
        );
        // Turned so the cone hangs down from the grip.
        elbow.add(cube(0.02, 0.05, 0.02), metal, [0, -0.45, 0.03]);
      } else {
        // Left forearm: a big glass syringe strapped and grown in.
        elbow.add(
          new T.CylinderGeometry(0.03, 0.03, 0.24, 8),
          fluid,
          [0, -0.25, 0.05],
        );
        elbow.add(
          new T.CylinderGeometry(0.034, 0.034, 0.02, 8),
          metal,
          [0, -0.12, 0.05],
        );
        elbow.add(
          new T.CylinderGeometry(0.034, 0.034, 0.02, 8),
          metal,
          [0, -0.38, 0.05],
        );
        elbow.add(
          new T.CylinderGeometry(0.008, 0.008, 0.12, 4),
          metal,
          [0, -0.04, 0.05],
        );
        elbow.add(
          new T.CylinderGeometry(0.004, 0.002, 0.18, 4),
          blade,
          [0, -0.49, 0.05],
        );
      }
      elbow.build();
      hand.build();
      arm.build();
      arms.push(arm.group);
      elbows.push(elbow.group);
      hands.push(hand.group);
    }
    // Sheet used by the "puxão por lençol" (left hand), hidden otherwise.
    const sheetGeo = new T.PlaneGeometry(0.55, 1, 1, 4).translate(0, -0.5, 0);
    this.sheet = new T.Mesh(sheetGeo, apron);
    this.sheet.position.set(0, -0.14, 0.02);
    this.sheet.visible = false;
    this.sheet.name = "lencol";
    hands[0].add(this.sheet);
    hips.build();
    skirtPart.build();
    spine.build();
    chest.build();
    neck.build();
    head.build();
    this.core = core;
    this.glow = glow;
    this.j = {
      body,
      hips: hips.group,
      spine: spine.group,
      chest: chest.group,
      neck: neck.group,
      head: head.group,
      arm: arms,
      elbow: elbows,
      hand: hands,
      leg: legs,
      knee: knees,
      plate: plates,
      skirt: skirtPart.group,
    };
    // ---- hitboxes (generous, anatomical)
    const hit = (
      parent: T.Object3D,
      geo: T.BufferGeometry,
      region: Region,
      p: [number, number, number],
    ) => {
      const h = new T.Mesh(
        geo,
        new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }),
      );
      h.position.set(...p);
      h.userData = { enemyId: enemy.id, region };
      parent.add(h);
      this.hitboxes.push(h);
    };
    hit(head.group, new T.SphereGeometry(0.2, 10, 8), "head", [0, 0.02, 0]);
    hit(spine.group, new T.BoxGeometry(0.62, 0.95, 0.46), "body", [0, 0.36, 0]);
    legs.forEach((l, i) =>
      hit(
        l,
        new T.BoxGeometry(0.24, 1.1, 0.3),
        i ? "legR" : "legL",
        [0, -0.5, 0],
      ),
    );
    // ---- telegraph decals
    const warnMat = (color: number, opacity: number) =>
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: T.DoubleSide,
        depthWrite: false,
      });
    this.ring = new T.Mesh(
      new T.RingGeometry(0.95, 1, 48),
      warnMat(0xe0a060, 0.55),
    );
    this.fill = new T.Mesh(new T.CircleGeometry(1, 40), warnMat(0xd06040, 0.1));
    this.lane = new T.Mesh(
      new T.PlaneGeometry(1, 1).translate(0, -0.5, 0),
      warnMat(0xe0a060, 0.1),
    );
    this.laneFill = new T.Mesh(
      new T.PlaneGeometry(1, 1).translate(0, -0.5, 0),
      warnMat(0xd06040, 0.4),
    );
    for (const m of [this.ring, this.fill, this.lane, this.laneFill]) {
      m.rotation.x = -Math.PI / 2;
      this.warning.add(m);
      this.materials.push(m.material as T.Material);
    }
    this.fill.position.y = 0.002;
    this.laneFill.position.y = 0.004;
    this.warning.position.y = 0.022;
    this.warning.visible = false;
    this.root.add(this.warning);
    const shadow = new T.Mesh(
      new T.CircleGeometry(0.55, 20),
      new T.MeshBasicMaterial({
        color: 0x030706,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.root.add(shadow);
    this.materials.push(shadow.material as T.Material);
    if (glb && smartReady("preceptora")) this.attachSkin();
    this.applyProbe();
    this.serial = enemy.hitSerial || 0;
    this.update(enemy, 0, true, 0, 0);
    this.pose = { ...this.target };
    this.apply();
  }
  attachSkin() {
    const base = smartMaterial("preceptora", "medium");
    const m = base.clone();
    m.userData.zombieShared = false;
    m.userData.albedo = new T.Color(0xb8b4ac);
    m.name = "preceptora-glb";
    const rim = this.rim;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.rimColor = rim;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 rimColor;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nfloat rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);\ntotalEmissiveRadiance += rimColor * rimF;",
        );
    };
    m.customProgramCacheKey = () => "preceptora-glb-rim";
    this.cloth.push(m);
    this.materials.push(m);
    const skin = new SmartSkin("preceptora", m);
    skin.scene.scale.setScalar(PRECEPTORA_GLB_SCALE);
    skin.scene.name = "preceptora-glb";
    this.root.add(skin.scene);
    this.skin = skin;
    const j = this.j;
    // Keep plates, core and glow (the fight mechanic) and the sheet; hide
    // the procedural body itself.
    const keep = new Set<T.Object3D>([
      ...j.plate,
      this.core,
      this.glow,
      this.sheet,
      ...this.hitboxes,
    ]);
    j.body.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      let n: T.Object3D | null = o;
      while (n && !keep.has(n)) n = n.parent;
      if (!n) o.visible = false;
    });
    // Armour anchor on the GLB sternum; children keep 0.8 chest coordinates.
    const anchor = new T.Group();
    anchor.name = "placas-glb";
    skin.pin("Bone_003", anchor, new T.Vector3(0, 1.17, 0.13));
    anchor.scale.multiplyScalar(1 / PRECEPTORA_GLB_SCALE);
    for (const o of [...j.plate, this.core, this.glow]) anchor.add(o);
    const hand = new T.Group();
    skin.pin("Bone_025", hand, new T.Vector3(0.6, 1.46, 0.13));
    hand.scale.multiplyScalar(1 / PRECEPTORA_GLB_SCALE);
    hand.add(this.sheet);
    this.sheet.position.set(0, -0.1, 0.02);
    const down = 1.32;
    this.retargets = [
      { part: () => j.hips, bone: "Bone_000", fix: ID },
      { part: () => j.spine, bone: "Bone_005", fix: ID },
      { part: () => j.chest, bone: "Bone_002", fix: ID },
      { part: () => j.neck, bone: "Bone_018", fix: ID },
      { part: () => j.head, bone: "Bone_017", fix: ID },
      { part: () => j.arm[0], bone: "Bone_027", fix: qz(-down) },
      { part: () => j.elbow[0], bone: "Bone_026", fix: qz(-down) },
      { part: () => j.hand[0], bone: "Bone_025", fix: qz(-down) },
      { part: () => j.arm[1], bone: "Bone_022", fix: qz(down) },
      { part: () => j.elbow[1], bone: "Bone_021", fix: qz(down) },
      { part: () => j.hand[1], bone: "Bone_020", fix: qz(down) },
      { part: () => j.leg[0], bone: "Bone_010", fix: ID },
      { part: () => j.knee[0], bone: "Bone_009", fix: ID },
      { part: () => j.leg[1], bone: "Bone_015", fix: ID },
      { part: () => j.knee[1], bone: "Bone_014", fix: ID },
    ];
  }
  /** Copy procedural joint rotations (relative to the actor root) onto
   * the GLB bones, plus the hips translation scaled to the GLB's legs. */
  retarget() {
    const skin = this.skin!,
      q = new T.Quaternion(),
      t = new T.Quaternion();
    skin.reset();
    const rel = (o: T.Object3D) => {
      q.identity();
      let n: T.Object3D | null = o;
      while (n && n !== this.root) {
        q.premultiply(n.quaternion);
        n = n.parent;
      }
      return q;
    };
    for (const r of this.retargets) {
      const bone = skin.bone(r.bone);
      t.copy(rel(r.part())).multiply(r.fix).multiply(skin.restModel.get(bone)!);
      skin.setModel(r.bone, t);
    }
    // Hips: procedural hips position delta (rest y 1.2) → GLB root bone.
    const hp = new T.Vector3();
    let n: T.Object3D | null = this.j.hips;
    const m = new T.Matrix4();
    const chain: T.Object3D[] = [];
    while (n && n !== this.root) {
      chain.unshift(n);
      n = n.parent;
    }
    m.identity();
    for (const c of chain) {
      c.updateMatrix();
      m.multiply(c.matrix);
    }
    hp.setFromMatrixPosition(m);
    const k = GLB_HIP / 1.2;
    const root = skin.bone("Bone_000");
    root.position
      .copy(skin.bindP.get(root)!)
      .add(
        new T.Vector3(hp.x * k, (hp.y - 1.2) * k, hp.z * k).divideScalar(
          PRECEPTORA_GLB_SCALE,
        ),
      );
    // Floor clamp so kneeling/toppled poses never sink.
    skin.scene.position.y = 0;
    skin.scene.updateMatrixWorld(true);
    let low = Infinity;
    const w = new T.Vector3();
    for (const b of [
      "Bone_007",
      "Bone_012",
      "Bone_008",
      "Bone_013",
      "Bone_016",
      "Bone_025",
      "Bone_020",
    ]) {
      w.setFromMatrixPosition(skin.bone(b).matrixWorld);
      low = Math.min(low, this.root.worldToLocal(w).y);
    }
    if (low < 0.03) {
      skin.scene.position.y = 0.03 - low;
      skin.scene.updateMatrixWorld(true);
    }
  }
  applyProbe() {
    // Fill from the room probe plus a floor, so she never reads as a void.
    // Same model as the zombies (probe × albedo), with a small floor.
    for (const m of this.cloth) {
      const base = m.userData.albedo as T.Color;
      m.emissive
        .copy(probe)
        .addScalar(0.06)
        .multiply(base)
        .multiplyScalar(0.85);
      if (m.map) m.emissiveMap = m.map;
    }
  }
  /** Main per-frame update. `speed` is ground speed in m/s. */
  update(
    e: Enemy,
    dt: number,
    visible: boolean,
    _distance: number,
    speed: number,
  ) {
    this.t += dt;
    const t = this.t,
      P = zero(),
      phase = preceptoraPhase(e.hp, enemyStats("B02").hp);
    if ((e.hitSerial || 0) !== this.serial) {
      this.serial = e.hitSerial || 0;
      this.hitAt = t;
      this.hitSide = Math.sin(t * 13.7) > 0 ? 1 : -1;
      this.hitStrong = e.vulnerable > 0 || e.dead;
    }
    const sinceHit = t - this.hitAt;
    const breath = (0.5 + phase * 0.35) * Math.sin(t * (1.6 + phase * 0.5));
    const spec = MOVES[e.attack];
    const progress =
      spec && e.state === "windup"
        ? Math.max(0, Math.min(1, 1 - e.timer / spec.windup))
        : 0;
    const activeT =
      spec && e.state === "charge" ? Math.max(0, spec.active - e.timer) : 0;
    let name: string;
    let rim = new T.Color(0.05, 0.045, 0.04);
    let rate = 9;
    // Base stance: tall, slightly hunched, head cocked.
    P["spine.x"] = 0.18;
    P["chest.x"] = 0.08 + breath * 0.025;
    P["neck.x"] = -0.12;
    P["head.z"] = 0.28 + Math.sin(t * 0.5) * 0.05;
    P["arm0.z"] = 0.12;
    P["arm1.z"] = -0.2;
    P["arm0.x"] = -0.05;
    P["arm1.x"] = -0.15;
    P["elbow0.x"] = -0.25;
    P["elbow1.x"] = -0.35;
    P["hand1.x"] = -0.3;
    P["knee0.x"] = 0.08;
    P["knee1.x"] = 0.08;
    P["leg0.x"] = -0.04;
    P["leg1.x"] = -0.04;
    // Head twitch every ~2.6 s.
    const tw = (t * 0.385) % 1;
    if (tw > 0.92) P["head.y"] = Math.sin((tw - 0.92) * 120) * 0.25;
    if (e.dead) {
      name = "Death";
      const s = Math.max(0, (Date.now() - e.deathAt) / 1000);
      const a = Math.min(1, s / 0.45),
        b = Math.max(0, Math.min(1, (s - 0.45) / 0.9)),
        c = Math.max(0, Math.min(1, (s - 1.35) / 0.85));
      const ease = (x: number) => x * x * (3 - 2 * x);
      P["spine.x"] = -0.55 * a * (1 - b) + 0.35 * b;
      P["neck.x"] = -0.5 * a * (1 - b) + 0.5 * b;
      P["head.z"] = 0.4 * b;
      // Jerk back (arms thrown back, not a T-pose), kneel, topple forward.
      P["arm0.z"] = 0.75 * a * (1 - b) + 0.15;
      P["arm1.z"] = -0.7 * a * (1 - b) - 0.15;
      P["arm0.x"] = 0.55 * a * (1 - b) - 0.9 * c;
      P["arm1.x"] = 0.35 * a * (1 - b) - 0.7 * c;
      P["elbow0.x"] = -0.9 * a * (1 - b) - 0.3;
      P["elbow1.x"] = -0.6 * a * (1 - b) - 0.3;
      P["leg0.x"] = -1.25 * ease(b);
      P["leg1.x"] = -1.1 * ease(b);
      P["knee0.x"] = 2.2 * ease(b);
      P["knee1.x"] = 0.5 * a * (1 - b) + 2.1 * ease(b);
      // Topple about the knees (pivot ~0.62 m up the body, on the floor).
      const th = 1.42 * ease(c);
      P["body.x"] = th;
      P["body.y"] = -0.6 * ease(b) + 0.62 * (1 - Math.cos(th)) * ease(b);
      P["body.pz"] = -0.62 * Math.sin(th);
      P["plate"] = 1.3;
      P["skirt.x"] = -0.3 * ease(b);
      const fade = Math.max(0, 1 - s / 1.6);
      (this.core.material as T.MeshBasicMaterial).color.setRGB(
        0.15 + 0.85 * fade,
        0.05 + 0.4 * fade,
        0.02 + 0.1 * fade,
      );
      (this.glow.material as T.MeshBasicMaterial).opacity = 0.5 * fade;
      this.eyes.color.setRGB(
        0.25 + 0.7 * fade,
        0.22 + 0.6 * fade,
        0.18 + 0.4 * fade,
      );
      rim = new T.Color(0.35, 0.12, 0.05).multiplyScalar(fade);
      rate = 10;
      this.warning.visible = false;
      this.sheet.visible = false;
      this.spin = 0;
    } else {
      if (e.state === "stun" && e.attack === MOVE.ROAR) {
        name = "Roar";
        const shake = Math.sin(t * 47) * 0.04;
        P["spine.x"] = -0.35;
        P["chest.x"] = -0.15 + shake;
        P["neck.x"] = -0.55;
        P["head.x"] = -0.45 + shake;
        P["head.z"] = shake * 2;
        P["arm0.z"] = 1.25;
        P["arm1.z"] = -1.25;
        P["arm0.x"] = -0.55;
        P["arm1.x"] = -0.55;
        P["elbow0.x"] = -0.7;
        P["elbow1.x"] = -0.7;
        P["leg0.z"] = 0.12;
        P["leg1.z"] = -0.12;
        P["body.y"] = -0.04;
        rim = new T.Color(0.5, 0.1, 0.06).multiplyScalar(
          0.7 + 0.3 * Math.sin(t * 30),
        );
      } else if (e.state === "stun" && e.attack === MOVE.SHOCK) {
        name = "Shock";
        const j = (k: number) => Math.sin(t * (61 + k * 7) + k * 1.7) * 0.16;
        P["spine.x"] = -0.25 + j(1);
        P["spine.z"] = j(2);
        P["chest.x"] = -0.2 + j(3);
        P["neck.x"] = -0.3 + j(4);
        P["head.x"] = j(5);
        P["head.z"] = 0.4 + j(6);
        P["arm0.x"] = -1.0 + j(7);
        P["arm1.x"] = -1.1 + j(8);
        P["arm0.z"] = 0.8 + j(9);
        P["arm1.z"] = -0.8 + j(10);
        P["elbow0.x"] = -1.7 + j(11);
        P["elbow1.x"] = -1.7 + j(12);
        P["knee0.x"] = 0.55;
        P["knee1.x"] = 0.55;
        P["leg0.x"] = -0.3;
        P["leg1.x"] = -0.3;
        P["body.y"] = -0.14;
        rate = 30;
        const f = Math.sin(t * 53) > 0.2 ? 1 : 0.35;
        rim = new T.Color(0.45, 0.6, 0.75).multiplyScalar(f);
      } else if (e.state === "stun") {
        // Entrance: head hanging, slowly rising; she "wakes" to equipment noise.
        name = "Wake";
        const p = Math.max(0, Math.min(1, 1 - e.timer / 5));
        P["spine.x"] = 0.55 * (1 - p) + 0.2 * p;
        P["neck.x"] = 0.9 * (1 - p) - 0.2 * p;
        P["head.z"] = 0.5 * (1 - p) + 0.25;
        P["arm0.x"] = 0.1;
        P["arm1.x"] = 0.1;
        P["arm0.z"] = 0.05;
        P["arm1.z"] = -0.05;
        P["elbow0.x"] = -0.1;
        P["elbow1.x"] = -0.1;
        P["knee0.x"] = 0.25 * (1 - p);
        P["knee1.x"] = 0.25 * (1 - p);
        P["body.y"] = -0.08 * (1 - p);
        rate = 4;
      } else if (e.state === "windup" && spec) {
        name = "Windup-" + spec.name;
        const p = progress,
          tremble = Math.sin(t * 38) * 0.03 * p;
        const heavy = e.attack === MOVE.CLEAVE || e.attack === MOVE.SPIN;
        rim = new T.Color(
          heavy ? 0.85 : 0.75,
          heavy ? 0.16 : 0.42,
          heavy ? 0.08 : 0.12,
        ).multiplyScalar(0.25 + 0.75 * p * (0.75 + 0.25 * Math.sin(t * 24)));
        if (e.attack === MOVE.SLASH) {
          P["arm1.x"] = -2.5 + tremble;
          P["arm1.z"] = -0.65;
          P["elbow1.x"] = -1.25;
          P["hand1.x"] = -0.6;
          P["spine.y"] = 0.55 * p;
          P["spine.x"] = 0.05;
          P["arm0.x"] = -0.6;
          P["arm0.z"] = 0.4;
          P["leg0.x"] = -0.3;
          P["leg1.x"] = 0.25;
          P["knee0.x"] = 0.3;
        } else if (e.attack === MOVE.DASH) {
          P["body.y"] = -0.26 * p;
          P["spine.x"] = 0.7 * p + 0.18;
          P["neck.x"] = -0.75 * p;
          P["head.z"] = 0.1;
          P["leg0.x"] = -0.7 * p;
          P["knee0.x"] = 1.2 * p;
          P["leg1.x"] = 0.35 * p;
          P["knee1.x"] = 0.9 * p;
          P["arm1.x"] = 0.95 * p + tremble;
          P["arm1.z"] = -0.3;
          P["elbow1.x"] = -0.5;
          P["hand1.x"] = -1.0 * p;
          P["arm0.x"] = -1.1 * p;
          P["arm0.z"] = 0.25;
          P["elbow0.x"] = -0.3;
        } else if (e.attack === MOVE.SHEET) {
          const whirl = t * 9;
          P["arm0.x"] = -2.5 + Math.sin(whirl) * 0.3 * p;
          P["arm0.z"] = 0.45 + Math.cos(whirl) * 0.3 * p;
          P["elbow0.x"] = -0.6;
          P["spine.y"] = -0.45 * p;
          P["spine.x"] = 0.05;
          P["arm1.x"] = -0.3;
          P["arm1.z"] = -0.4;
          P["leg0.x"] = 0.25;
          P["leg1.x"] = -0.35;
          P["knee1.x"] = 0.3;
        } else if (e.attack === MOVE.TRIPLE) {
          P["arm0.x"] = -2.25 + tremble;
          P["arm1.x"] = -2.25 - tremble;
          P["arm0.z"] = -0.45;
          P["arm1.z"] = 0.45;
          P["elbow0.x"] = -1.45;
          P["elbow1.x"] = -1.45;
          P["spine.x"] = -0.12;
          P["neck.x"] = 0.15;
          P["leg0.x"] = -0.25;
          P["knee0.x"] = 0.3;
          P["leg1.x"] = 0.15;
          // GDD: luminous warning for 1.3 s.
          rim = new T.Color(0.9, 0.2, 0.1).multiplyScalar(
            Math.sin(t * 18) > 0 ? 1 : 0.35,
          );
        } else if (e.attack === MOVE.SPIN) {
          P["arm0.z"] = 1.45;
          P["arm1.z"] = -1.45;
          P["arm0.x"] = -0.2;
          P["arm1.x"] = -0.2;
          P["elbow0.x"] = -0.15;
          P["elbow1.x"] = -0.15;
          P["spine.y"] = -1.15 * p;
          P["hips.y"] = -0.3 * p;
          P["leg0.z"] = 0.22;
          P["leg1.z"] = -0.22;
          P["knee0.x"] = 0.45 * p;
          P["knee1.x"] = 0.45 * p;
          P["body.y"] = -0.12 * p;
          P["neck.x"] = -0.2;
        } else if (e.attack === MOVE.CLEAVE) {
          P["arm0.x"] = -2.95 + tremble;
          P["arm1.x"] = -2.95 - tremble;
          P["arm0.z"] = -0.18;
          P["arm1.z"] = 0.18;
          P["elbow0.x"] = -0.55;
          P["elbow1.x"] = -0.55;
          P["spine.x"] = -0.38 * p;
          P["chest.x"] = -0.12 * p;
          P["neck.x"] = -0.2;
          P["head.x"] = -0.25 * p;
          P["body.y"] = 0.06 * p;
          P["leg0.x"] = -0.2;
          P["leg1.x"] = 0.15;
        }
      } else if (e.state === "charge" && spec) {
        name = "Attack-" + spec.name;
        rate = 22;
        rim = new T.Color(0.6, 0.18, 0.08);
        if (e.attack === MOVE.SLASH) {
          P["arm1.x"] = -0.7;
          P["arm1.z"] = 0.55;
          P["elbow1.x"] = -0.2;
          P["spine.y"] = -0.55;
          P["spine.x"] = 0.35;
          P["leg0.x"] = -0.45;
          P["knee0.x"] = 0.5;
          P["leg1.x"] = 0.35;
        } else if (e.attack === MOVE.DASH) {
          this.walk += dt * 13;
          const s = Math.sin(this.walk);
          P["spine.x"] = 0.8;
          P["neck.x"] = -0.8;
          P["arm1.x"] = -1.45;
          P["arm1.z"] = -0.1;
          P["elbow1.x"] = -0.05;
          P["hand1.x"] = -0.3;
          P["arm0.x"] = 0.6;
          P["arm0.z"] = 0.35;
          P["leg0.x"] = -0.9 * s - 0.2;
          P["leg1.x"] = 0.9 * s - 0.2;
          P["knee0.x"] = 0.4 + Math.max(0, s) * 1.1;
          P["knee1.x"] = 0.4 + Math.max(0, -s) * 1.1;
          P["body.y"] = -0.18 + Math.abs(s) * 0.05;
        } else if (e.attack === MOVE.SHEET) {
          P["arm0.x"] = -1.35;
          P["arm0.z"] = 0.1;
          P["elbow0.x"] = 0;
          P["spine.y"] = 0.35;
          P["spine.x"] = 0.3;
          P["leg0.x"] = -0.4;
          P["knee0.x"] = 0.4;
          P["leg1.x"] = 0.3;
        } else if (e.attack === MOVE.TRIPLE) {
          const cut = activeT < 0.45 ? 0 : activeT < 0.85 ? 1 : 2;
          P["spine.x"] = 0.35;
          P["leg0.x"] = cut === 1 ? 0.3 : -0.4;
          P["leg1.x"] = cut === 1 ? -0.4 : 0.3;
          P["knee0.x"] = 0.4;
          P["knee1.x"] = 0.4;
          if (cut === 0) {
            P["arm1.x"] = -0.8;
            P["arm1.z"] = 0.6;
            P["spine.y"] = -0.5;
            P["arm0.x"] = -2.0;
            P["arm0.z"] = -0.2;
            P["elbow0.x"] = -1.2;
          } else if (cut === 1) {
            P["arm0.x"] = -0.8;
            P["arm0.z"] = -0.6;
            P["spine.y"] = 0.5;
            P["arm1.x"] = -0.4;
            P["arm1.z"] = 0.3;
          } else {
            P["arm0.x"] = -0.6;
            P["arm1.x"] = -0.6;
            P["arm0.z"] = -0.1;
            P["arm1.z"] = 0.1;
            P["spine.x"] = 0.7;
            P["neck.x"] = -0.4;
          }
        } else if (e.attack === MOVE.SPIN) {
          P["arm0.z"] = 1.5;
          P["arm1.z"] = -1.5;
          P["arm0.x"] = -0.1;
          P["arm1.x"] = -0.1;
          P["spine.x"] = 0.1;
          P["leg0.z"] = 0.2;
          P["leg1.z"] = -0.2;
          P["knee0.x"] = 0.3;
          P["knee1.x"] = 0.3;
          P["body.y"] = -0.08;
          rim = new T.Color(0.8, 0.2, 0.08);
        } else if (e.attack === MOVE.CLEAVE) {
          P["arm0.x"] = -0.95;
          P["arm1.x"] = -0.95;
          P["arm0.z"] = -0.15;
          P["arm1.z"] = 0.15;
          P["elbow0.x"] = 0;
          P["elbow1.x"] = 0;
          P["spine.x"] = 0.95;
          P["chest.x"] = 0.2;
          P["neck.x"] = -0.6;
          P["leg0.x"] = -0.55;
          P["knee0.x"] = 0.8;
          P["leg1.x"] = 0.35;
          P["knee1.x"] = 0.5;
          P["body.y"] = -0.2;
          rim = new T.Color(0.9, 0.22, 0.08);
        }
      } else if (e.state === "recover") {
        name = "Recover";
        rate = 6;
        const left = Math.max(0, e.timer);
        const pull = Math.min(1, left / 0.4);
        if (e.attack === MOVE.CLEAVE || e.attack === MOVE.DASH) {
          // Blade stuck in the floor/bed: a real opening.
          P["spine.x"] = 0.35 + 0.55 * pull;
          P["neck.x"] = -0.45 * pull;
          P["arm1.x"] = -0.95 * pull - 0.3;
          P["arm0.x"] = e.attack === MOVE.CLEAVE ? -0.95 * pull : 0.2;
          P["elbow1.x"] = 0;
          P["leg0.x"] = -0.45 * pull;
          P["knee0.x"] = 0.7 * pull;
          P["knee1.x"] = 0.4 * pull;
          P["body.y"] = -0.18 * pull;
          // Tugging at the blade.
          P["chest.x"] += Math.sin(t * 9) * 0.06 * pull;
        } else if (e.attack === MOVE.SPIN) {
          // Dizzy after the spin (GDD: 1.5 s recovery).
          P["body.z"] = Math.sin(t * 4.2) * 0.09;
          P["spine.x"] = 0.4;
          P["head.z"] = 0.6 + Math.sin(t * 3) * 0.2;
          P["neck.x"] = 0.35;
          P["arm0.z"] = 0.5;
          P["arm1.z"] = -0.5;
          P["arm0.x"] = 0.05;
          P["arm1.x"] = 0.05;
          P["knee0.x"] = 0.35;
          P["knee1.x"] = 0.35;
          P["body.y"] = -0.06;
        } else {
          P["spine.x"] = 0.4;
          P["neck.x"] = 0.1;
          P["arm1.x"] = 0.1;
          P["arm0.x"] = 0.1;
          P["chest.x"] = 0.08 + breath * 0.08;
        }
      } else {
        // Stalk: long, slow, deliberate strides; faster and lower in phase 3.
        const moving = speed > 0.08;
        name = moving ? "Stalk" : "Idle";
        const stride = Math.min(1, speed / 1.2);
        this.walk += dt * Math.PI * 2 * (speed / 1.15);
        const s = Math.sin(this.walk),
          c2 = Math.cos(this.walk);
        if (moving) {
          P["leg0.x"] = -0.55 * s * stride - 0.05;
          P["leg1.x"] = 0.55 * s * stride - 0.05;
          P["knee0.x"] = 0.12 + Math.max(0, c2) * 0.9 * stride;
          P["knee1.x"] = 0.12 + Math.max(0, -c2) * 0.9 * stride;
          P["body.y"] = -0.04 - Math.abs(c2) * 0.035 * stride;
          P["body.z"] = s * 0.035;
          P["hips.y"] = s * 0.12 * stride;
          P["spine.y"] = -s * 0.1 * stride;
          P["spine.x"] = 0.28 + (phase - 1) * 0.1;
          P["neck.x"] = -0.3 - (phase - 1) * 0.08;
          P["arm0.x"] = 0.25 * s * stride - 0.1;
          P["arm1.x"] = -0.12 * s * stride - 0.25;
          P["arm1.z"] = -0.32;
          P["skirt.x"] = -0.06 * stride;
        }
      }
      // Hit reaction: armoured hits jolt, open-armour hits stagger.
      const imp = Math.exp(-sinceHit * (this.hitStrong ? 7 : 11));
      if (sinceHit < 0.8) {
        const k = this.hitStrong ? 1 : 0.45;
        P["spine.x"] -= 0.32 * imp * k;
        P["chest.x"] -= 0.2 * imp * k;
        P["neck.x"] -= 0.35 * imp * k;
        P["spine.z"] += 0.18 * imp * k * this.hitSide;
        P["head.z"] += 0.35 * imp * k * this.hitSide;
        P["arm0.z"] += 0.3 * imp * k;
        P["arm1.z"] -= 0.3 * imp * k;
        rim.lerp(
          this.hitStrong
            ? new T.Color(1.2, 0.35, 0.15)
            : new T.Color(0.75, 0.8, 0.85),
          imp,
        );
        if (sinceHit < 0.05) rate = 40;
      }
      // Armour opens with the generator; the core glows and pulses.
      const open = e.vulnerable > 0;
      P["plate"] =
        (open ? 1.25 : 0) +
        (!open && sinceHit < 0.3 ? 0.18 * imp : 0) +
        (e.state === "stun" && e.attack === MOVE.ROAR
          ? Math.sin(t * 40) * 0.05
          : 0);
      const pulse = 0.5 + 0.5 * Math.sin(t * (open ? 9 : 2.4));
      (this.core.material as T.MeshBasicMaterial).color.setRGB(
        open ? 1 : 0.45 + 0.15 * pulse,
        open ? 0.55 + 0.25 * pulse : 0.12,
        open ? 0.2 : 0.05,
      );
      (this.glow.material as T.MeshBasicMaterial).opacity = open
        ? 0.25 + 0.3 * pulse
        : 0.05 * pulse;
      this.core.scale.setScalar(open ? 1 + 0.15 * pulse : 0.9);
      const eye = 0.75 + 0.25 * Math.sin(t * 3) + (phase === 3 ? 0.2 : 0);
      this.eyes.color.setRGB(
        0.95 * eye,
        (phase === 3 ? 0.55 : 0.85) * eye,
        (phase === 3 ? 0.4 : 0.62) * eye,
      );
      if (open) rim.add(new T.Color(0.18, 0.1, 0.03).multiplyScalar(pulse));
      // Telegraph decals: outline = danger zone, fill = time left.
      const tele = e.state === "windup" && !!spec;
      this.warning.visible = tele || (e.state === "charge" && !!spec);
      if (this.warning.visible && spec) {
        const area =
          e.attack === MOVE.SPIN ||
          e.attack === MOVE.TRIPLE ||
          e.attack === MOVE.SLASH;
        const p = tele ? progress : 1;
        this.ring.visible = this.fill.visible = area;
        this.lane.visible = this.laneFill.visible = !area;
        const heavy = e.attack === MOVE.CLEAVE || e.attack === MOVE.SPIN;
        const col = heavy ? 0xff5a3a : 0xe8a860;
        (this.ring.material as T.MeshBasicMaterial).color.setHex(col);
        (this.lane.material as T.MeshBasicMaterial).color.setHex(col);
        if (area) {
          this.ring.scale.setScalar(spec.reach);
          this.fill.scale.setScalar(Math.max(0.01, spec.reach * p));
          (this.fill.material as T.MeshBasicMaterial).opacity = 0.05 + 0.17 * p;
        } else {
          const w =
            e.attack === MOVE.CLEAVE
              ? 1.1
              : e.attack === MOVE.SHEET
                ? 1.4
                : 1.7;
          this.lane.scale.set(w, spec.reach, 1);
          this.laneFill.scale.set(w, Math.max(0.01, spec.reach * p), 1);
          (this.laneFill.material as T.MeshBasicMaterial).opacity =
            0.08 + 0.2 * p;
        }
      }
      // Sheet: visible while winding up / throwing the pull.
      const sheetOn =
        e.attack === MOVE.SHEET &&
        (e.state === "windup" || e.state === "charge");
      this.sheet.visible = sheetOn;
      if (sheetOn) {
        const len = e.state === "charge" ? 3.4 : 0.9 + 0.2 * Math.sin(t * 11);
        this.sheet.scale.set(1, len, 1);
        this.sheet.rotation.x =
          e.state === "charge" ? -1.3 : -0.4 + Math.sin(t * 9) * 0.3;
      }
      // Spin attack turns the whole body (the root keeps her facing).
      if (e.state === "charge" && e.attack === MOVE.SPIN)
        this.spin = (activeT / spec!.active) * Math.PI * 2.5;
      else this.spin = 0;
    }
    this.stateName = name;
    this.rim.value.copy(rim);
    this.target = P;
    if (!visible && dt > 0) {
      this.pose = { ...P };
      return;
    }
    const k = dt > 0 ? 1 - Math.exp(-dt * rate) : 1;
    for (const key of KEYS) this.pose[key] += (P[key] - this.pose[key]) * k;
    this.apply();
  }
  apply() {
    const p = this.pose,
      j = this.j;
    j.body.position.y = p["body.y"];
    j.body.position.z = p["body.pz"];
    j.body.rotation.set(p["body.x"], this.spin, p["body.z"]);
    j.hips.rotation.set(p["hips.x"], p["hips.y"], 0);
    j.spine.rotation.set(p["spine.x"], p["spine.y"], p["spine.z"]);
    j.chest.rotation.x = p["chest.x"];
    j.neck.rotation.x = p["neck.x"];
    j.head.rotation.set(p["head.x"], p["head.y"], p["head.z"]);
    for (const i of [0, 1] as const) {
      j.arm[i].rotation.set(p[`arm${i}.x`], p[`arm${i}.y`], p[`arm${i}.z`]);
      j.elbow[i].rotation.x = p[`elbow${i}.x`];
      j.hand[i].rotation.x = p[`hand${i}.x`];
      j.leg[i].rotation.set(p[`leg${i}.x`], 0, p[`leg${i}.z`]);
      j.knee[i].rotation.x = p[`knee${i}.x`];
      j.plate[i].rotation.y = (i ? -1 : 1) * p["plate"];
    }
    j.skirt.rotation.x = p["skirt.x"];
    if (this.skin) {
      this.root.updateMatrixWorld(true);
      this.retarget();
    }
  }
  fade(alpha: number) {
    for (const m of this.materials) {
      if (!(
        m instanceof T.MeshStandardMaterial || m instanceof T.MeshBasicMaterial
      ))
        continue;
      if (m.userData.baseOpacity === undefined)
        m.userData.baseOpacity = m.opacity;
      m.transparent = true;
      m.opacity = m.userData.baseOpacity * alpha;
      m.depthWrite = alpha >= 1;
    }
  }
  dispose() {
    live.delete(this);
    this.root.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      if (o instanceof T.Mesh) {
        if (!o.geometry.userData.zombieShared) o.geometry.dispose();
        if (!this.materials.includes(o.material as T.Material))
          (o.material as T.Material).dispose();
      }
    });
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}

/** Actor wrapper with the same animator contract as the zombies. */
export function preceptoraActor(e: Enemy, glb = true): Actor {
  const p = new Preceptora(e, glb);
  p.root.userData.glb = !!p.skin;
  const animation: ZombieAnimator = {
    stateName: "Idle",
    lod: 0,
    mixersUpdated: 0,
    update(
      enemy: Enemy,
      dt: number,
      visible: boolean,
      distance: number,
      speed: number,
      _q: Quality,
    ) {
      p.update(enemy, dt, visible, distance, speed);
      this.stateName = p.stateName;
    },
    fade: (a: number) => p.fade(a),
    dispose: () => p.dispose(),
  };
  return {
    root: p.root,
    body: p.j.body,
    head: p.j.head,
    animation,
    arms: p.j.arm,
    elbows: p.j.elbow,
    legs: p.j.leg,
    knees: p.j.knee,
    hitboxes: p.hitboxes,
    warning: p.warning,
    core: p.core,
  };
}
