import * as T from "three";
import { rooms, roomDoors, endpoint, type RoomId, type Vec } from "./world";
import type { GameState } from "./logic";
type Actor = {
  root: T.Group;
  head: T.Mesh;
  arms: T.Group[];
  legs: T.Group[];
  body: T.Group;
  warning?: T.Group;
};
const mat = (color: number, roughness = 0.85, metalness = 0) =>
  new T.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  });
function box(
  w: number,
  h: number,
  d: number,
  m: T.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const b = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}
function label(text: string, color = "#bfe0d0", w = 3) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 100;
  const g = c.getContext("2d")!;
  g.fillStyle = "#152321";
  g.fillRect(0, 0, 512, 100);
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.strokeRect(5, 5, 502, 90);
  g.fillStyle = color;
  g.font = "bold 29px monospace";
  g.textAlign = "center";
  g.fillText(text, 256, 62);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, w / 5.12),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  );
  return mesh;
}
function person(enemy = false, boss = false): Actor {
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  const cloth = mat(boss ? 0x4a3c31 : enemy ? 0x8a9b87 : 0xc09262);
  const skin = mat(enemy ? 0x9fa99a : 0xbfa98e);
  const dark = mat(0x273638);
  body.add(box(0.53, 0.68, 0.3, cloth, 0, 1.12, 0));
  body.add(box(0.55, 0.1, 0.32, dark, 0, 0.83, 0));
  const head = new T.Mesh(new T.IcosahedronGeometry(0.23, 1), skin);
  head.position.y = 1.72;
  body.add(head);
  const hair = box(
    0.38,
    0.14,
    0.32,
    mat(enemy ? 0x565c50 : 0x302a28),
    0,
    1.91,
    -0.03,
  );
  head.add(hair);
  hair.position.y = 0.17;
  const arms: T.Group[] = [];
  const legs: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.36, 1.39, 0);
    arm.add(box(0.15, 0.56, 0.17, cloth, 0, -0.22, 0));
    arm.add(box(0.14, 0.15, 0.15, skin, 0, -0.54, 0));
    body.add(arm);
    arms.push(arm);
    const leg = new T.Group();
    leg.position.set(side * 0.16, 0.8, 0);
    leg.add(box(0.2, 0.68, 0.22, dark, 0, -0.33, 0));
    leg.add(box(0.22, 0.17, 0.36, dark, 0, -0.72, 0.06));
    body.add(leg);
    legs.push(leg);
  }
  if (!enemy) {
    body.add(box(0.38, 0.4, 0.13, mat(0x574d34), 0, 1.15, -0.22));
    const stripe = box(0.54, 0.08, 0.32, mat(0xbecdbd), 0, 1.25, 0);
    body.add(stripe);
    arms[1].add(box(0.12, 0.13, 0.35, mat(0x1c2929, 0.35, 0.7), 0, -0.4, 0.2));
    body.add(box(0.12, 0.12, 0.14, mat(0xf0daa3), 0.22, 1.32, 0.23));
  } else {
    for (const x of [-0.08, 0.08])
      head.add(
        box(
          0.045,
          0.035,
          0.045,
          new T.MeshBasicMaterial({ color: boss ? 0xffa047 : 0xbadb9a }),
          x,
          0.035,
          0.19,
        ),
      );
    if (boss) {
      body.add(box(0.9, 0.38, 0.46, mat(0x726750, 0.5, 0.7), 0, 1.35, 0));
      body.add(
        box(
          0.2,
          0.25,
          0.2,
          new T.MeshBasicMaterial({ color: 0xa9bda0 }),
          0,
          1.2,
          0.3,
        ),
      );
      root.scale.setScalar(1.55);
    }
  }
  const warning = new T.Group();
  const ring = new T.Mesh(
    new T.RingGeometry(boss ? 2.2 : 0.9, boss ? 2.3 : 1, 48),
    new T.MeshBasicMaterial({
      color: 0xd59a65,
      transparent: true,
      opacity: 0.6,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  warning.add(ring);
  if (boss)
    warning.add(
      box(
        0.08,
        0.015,
        3.1,
        new T.MeshBasicMaterial({ color: 0xdfaf7e }),
        0,
        0.015,
        1.8,
      ),
    );
  warning.position.y = 0.03;
  warning.visible = false;
  root.add(warning);
  return { root, head, arms, legs, body, warning };
}
export class View {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, 1, 0.1, 65);
  group = new T.Group();
  player = person();
  enemyMeshes = new Map<string, Actor>();
  itemMeshes = new Map<string, T.Group>();
  light: T.SpotLight;
  target = new T.Object3D();
  doorScene = new T.Scene();
  doorCamera = new T.PerspectiveCamera(43, 1, 0.1, 30);
  hinge = new T.Group();
  knob = new T.Group();
  zone = 0;
  lastCut = 0;
  room: RoomId = "recepcao";
  elapsed = 0;
  walk = 0;
  ray = new T.Raycaster();
  constructor(container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    container.prepend(this.renderer.domElement);
    this.scene.background = new T.Color(0x0c171b);
    this.scene.fog = new T.FogExp2(0x152125, 0.022);
    this.scene.add(new T.HemisphereLight(0xb9d6d2, 0x30363b, 1.8));
    const sun = new T.DirectionalLight(0xa5b6ca, 2.2);
    sun.position.set(-4, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.normalBias = 0.06;
    this.scene.add(sun);
    this.scene.add(this.group, this.player.root);
    this.light = new T.SpotLight(0xffe4b8, 34, 11, 0.55, 0.65, 1.3);
    this.scene.add(this.light, this.target);
    this.light.target = this.target;
    this.doorScene.background = new T.Color(0x030608);
    this.doorScene.add(new T.AmbientLight(0x8badb6, 0.8));
    const dl = new T.SpotLight(0xe2c79d, 95, 20, 1, 0.5);
    dl.position.set(-3, 5, 4);
    this.doorScene.add(dl, dl.target);
    dl.target.position.set(0, 1.5, 0);
    this.doorCamera.position.set(1, 2, 6);
    this.doorCamera.lookAt(0, 1.6, 0);
    this.hinge.position.set(-0.95, 0, 0);
    const wood = mat(0x4d605c, 0.5, 0.4);
    this.hinge.add(box(1.9, 3.3, 0.14, wood, 0.95, 1.65, 0));
    for (const y of [0.65, 2.4])
      this.hinge.add(
        box(1.4, 0.8, 0.06, mat(0x344743, 0.6, 0.2), 0.95, y, 0.09),
      );
    this.knob.position.set(1.65, 1.5, 0.2);
    this.knob.add(box(0.24, 0.05, 0.07, mat(0xc5ac79, 0.3, 0.8), -0.09, 0, 0));
    this.hinge.add(this.knob);
    this.doorScene.add(this.hinge);
    for (const x of [-1.08, 1.08])
      this.doorScene.add(
        box(0.17, 3.5, 0.26, mat(0x859389, 0.5, 0.5), x, 1.75, 0),
      );
    this.doorScene.add(box(2.35, 0.15, 0.26, mat(0x859389), 0, 3.5, 0));
    this.doorScene.add(box(8, 0.1, 10, mat(0x111b1c), 0, -0.06, 0));
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.doorCamera.aspect = w / h;
    this.doorCamera.updateProjectionMatrix();
    this.setCamera(this.zone);
  }
  setCamera(zone: number) {
    this.zone = zone;
    const aspect = this.camera.aspect;
    const scale = aspect < 1.3 ? 1.45 : 1;
    this.camera.position.set(
      (zone === 0 ? 10 : -10) * scale,
      13 * scale,
      16 * scale,
    );
    this.camera.lookAt(0, 0.5, -1);
  }
  load(id: RoomId, s: GameState) {
    this.disposeGroup(this.group);
    this.group = new T.Group();
    this.scene.add(this.group);
    for (const a of this.enemyMeshes.values()) this.disposeGroup(a.root);
    this.enemyMeshes.clear();
    this.itemMeshes.clear();
    this.room = id;
    this.setCamera(0);
    this.lastCut = this.elapsed;
    const r = rooms[id];
    const floor = mat(r.color);
    this.group.add(box(13, 0.18, 17.5, floor, 0, -0.15, 0));
    const seam = mat(0x334b49);
    for (let x = -6; x <= 6; x += 1)
      this.group.add(box(0.018, 0.008, 17, seam, x, -0.048, 0));
    for (let z = -8; z <= 8; z += 1)
      this.group.add(box(12, 0.008, 0.018, seam, 0, -0.045, z));
    const wall = mat(r.color);
    this.group.add(box(13, 3.6, 0.25, wall, 0, 1.7, -8.7));
    this.group.add(box(0.25, 1.3, 17.5, wall, -6.6, 0.6, 0));
    this.group.add(box(0.25, 1.3, 17.5, wall, 6.6, 0.6, 0));
    this.group.add(box(13, 0.25, 0.2, mat(0x273c3a), 0, 0.05, 8.7));
    for (let i = -5; i <= 5; i += 2) {
      this.group.add(
        box(0.6, 1.2, 0.08, mat(0x6e9491, 0.3, 0.3), i, 1.9, -8.52),
      );
      this.group.add(box(0.66, 0.07, 0.1, mat(0xb2c7bb), i, 1.9, -8.44));
    }
    const sign = label(r.name.toUpperCase());
    sign.position.set(0, 2.9, -8.5);
    this.group.add(sign);
    for (const o of r.obstacles) {
      const metallic = id === "corredor" || id === "gerador" || id === "atrio";
      const h = id === "arquivo" ? 2.1 : id === "atrio" ? 3.2 : 1.1;
      this.group.add(
        box(
          o.w,
          h,
          o.d,
          mat(metallic ? 0x5d7772 : 0x6d6250, 0.6, metallic ? 0.4 : 0),
          o.x,
          h / 2,
          o.z,
        ),
      );
      if (id === "corredor") {
        this.group.add(
          box(o.w + 0.1, 0.14, o.d + 0.1, mat(0xaeb5a5), o.x, h + 0.05, o.z),
        );
        for (const dx of [-0.7, 0.7])
          this.group.add(
            box(
              0.08,
              0.45,
              o.d,
              mat(0xaab7b3, 0.3, 0.8),
              o.x + dx,
              h + 0.25,
              o.z,
            ),
          );
      }
      if (id === "arquivo")
        for (let y = 0.3; y < 2; y += 0.4) {
          this.group.add(
            box(o.w + 0.06, 0.045, o.d, mat(0x303d39), o.x, y, o.z),
          );
          for (let j = 0; j < 4; j++)
            this.group.add(
              box(
                o.w,
                0.24,
                0.43,
                mat([0x86866c, 0x586e67, 0x9b9679, 0x6c5146][j]),
                o.x,
                y + 0.15,
                o.z - 2 + j * 1.1,
              ),
            );
        }
    }
    for (const d of roomDoors(id)) {
      const p = endpoint(d, id).position;
      const g = new T.Group();
      g.position.set(p.x, 0, p.z);
      if (Math.abs(p.x) > 5)
        g.rotation.y = p.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      else if (p.z > 0) g.rotation.y = Math.PI;
      g.add(box(1.65, 2.7, 0.16, mat(0x2d4541, 0.55, 0.5), 0, 1.35, 0));
      g.add(box(0.12, 0.13, 0.12, mat(0xc6b68a, 0.3, 0.6), 0.55, 1.25, 0.16));
      for (const x of [-0.93, 0.93])
        g.add(box(0.13, 2.85, 0.24, mat(0x9cb6a1), x, 1.42, 0));
      const name = label(d.label.toUpperCase(), "#d9e2be", 2.2);
      name.position.set(0, 3.1, 0);
      g.add(name);
      this.group.add(g);
      const glow = new T.PointLight(0xb0ddc1, 8, 4);
      glow.position.set(p.x * 0.85, 2, p.z * 0.9);
      this.group.add(glow);
    }
    for (const item of r.items) {
      if (s.items.includes(item.id) && item.kind !== "document") continue;
      const g = new T.Group();
      g.position.set(item.x, 0, item.z);
      const c =
        item.kind === "ammo"
          ? 0xc4a45b
          : item.kind === "battery"
            ? 0x8bc4b7
            : item.kind === "herb"
              ? 0xa9bfa4
              : 0xddcfa8;
      g.add(box(0.4, 0.12, 0.3, mat(c, 0.35, 0.2), 0, 0.35, 0));
      const ring = new T.Mesh(
        new T.TorusGeometry(0.3, 0.025, 4, 24),
        new T.MeshBasicMaterial({ color: c }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      g.add(ring);
      const beacon = new T.Mesh(
        new T.OctahedronGeometry(0.1),
        new T.MeshBasicMaterial({ color: c }),
      );
      beacon.position.y = 0.85;
      g.add(beacon);
      this.group.add(g);
      this.itemMeshes.set(item.id, g);
    }
    for (const e of Object.values(s.enemies)) {
      if (e.room !== id || e.dead) continue;
      const a = person(true, e.boss);
      this.scene.add(a.root);
      this.enemyMeshes.set(e.id, a);
    }
    // Original procedural fixtures, signs and environmental storytelling.
    for (let i = 0; i < 12; i++) {
      const paper = box(
        0.18,
        0.006,
        0.24,
        mat(0xb1b2a0),
        Math.sin(i * 8.4) * 5,
        0.015,
        Math.cos(i * 3.1) * 7,
      );
      paper.rotation.y = i;
      this.group.add(paper);
    }
    if (r.safe) {
      this.fixture("GRAVADOR · E", 0, -3, 0xd8bb77);
      this.fixture("RÁDIO DE EMERGÊNCIA", -4, -6, 0xc3c68b);
    }
    if (id === "arquivo") this.fixture("RELÓGIO DE PLANTÃO", 0, -6.6, 0xddcda1);
    if (id === "gerador") this.fixture("QUADRO ELÉTRICO", 4, -6, 0x80c5ae);
    if (id === "atrio") this.fixture("TRAVA ELÉTRICA", 0, -6.7, 0xdec487);
    const lamp = new T.PointLight(r.safe ? 0xffc980 : 0x91ccc0, 28, 18, 1.2);
    lamp.position.set(0, 4, -2);
    this.group.add(lamp);
    const fixture = box(
      2,
      0.08,
      0.35,
      new T.MeshBasicMaterial({ color: r.safe ? 0xfad8a0 : 0xb5d0c0 }),
      0,
      3.8,
      -3,
    );
    this.group.add(fixture);
  }
  fixture(text: string, x: number, z: number, c: number) {
    this.group.add(box(1.3, 1.1, 0.7, mat(0x3b4f4d, 0.45, 0.45), x, 0.55, z));
    const l = label(text, "#dfd5ae", 2.5);
    l.position.set(x, 1.6, z);
    this.group.add(l);
    this.group.add(
      box(
        0.6,
        0.2,
        0.06,
        new T.MeshBasicMaterial({ color: c }),
        x,
        1,
        z + 0.38,
      ),
    );
  }
  disposeGroup(g: T.Object3D) {
    g.removeFromParent();
    g.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
  update(
    s: GameState,
    dt: number,
    moving: boolean,
    aiming: boolean,
    focus: boolean,
  ) {
    this.elapsed += dt;
    this.walk += moving ? dt * 9 : 0;
    const p = s.player;
    this.player.root.position.set(p.x, 0, p.z);
    this.player.root.rotation.y = p.yaw;
    this.animate(this.player, moving, this.walk, aiming);
    const z = p.z < -0.8 ? 1 : p.z > 1.2 ? 0 : this.zone;
    if (z !== this.zone && this.elapsed - this.lastCut > 0.6) {
      this.setCamera(z);
      this.lastCut = this.elapsed;
    }
    for (const e of Object.values(s.enemies)) {
      const a = this.enemyMeshes.get(e.id);
      if (!a) continue;
      a.root.position.set(e.x, 0, e.z);
      if (!e.dead)
        a.root.rotation.y =
          e.state === "windup"
            ? Math.atan2(e.dx, e.dz)
            : Math.atan2(p.x - e.x, p.z - e.z);
      if (a.warning) {
        a.warning.visible = !e.dead && e.state === "windup";
        if (e.boss && a.warning.children[1])
          a.warning.children[1].visible = e.attack === 1;
      }
      if (e.dead) {
        a.body.rotation.x = Math.min(Math.PI / 2, a.body.rotation.x + dt * 2);
        a.root.position.y = 0.13;
        a.head.visible = !e.headGone;
        continue;
      }
      a.body.rotation.x = e.crawl ? 1.3 : 0;
      a.root.position.y = e.crawl ? 0.12 : 0;
      if (e.crawl) a.body.position.y = -0.25;
      this.animate(
        a,
        e.state === "chase",
        this.elapsed * (e.crawl ? 5 : 4),
        false,
      );
      if (e.state === "windup") {
        a.arms.forEach((arm) => (arm.rotation.x = -2.2));
      } else if (e.state === "stun") {
        a.arms.forEach((arm) => (arm.rotation.x = -1.5));
      }
      a.head.visible = !e.headGone;
    }
    this.light.visible = s.light && s.battery > 0;
    this.light.angle = focus ? 0.23 : 0.55;
    this.light.intensity = focus ? 58 : 34;
    this.light.position.set(p.x, 1.35, p.z);
    this.target.position.set(
      p.x + Math.sin(p.yaw) * 8,
      aiming ? 1.2 : 0,
      p.z + Math.cos(p.yaw) * 8,
    );
    for (const [id, g] of this.itemMeshes) {
      if (
        s.items.includes(id) &&
        !rooms[s.room].items.find((i) => i.id === id && i.kind === "document")
      )
        g.visible = false;
      else {
        g.rotation.y += dt * 0.7;
      }
    }
  }
  animate(a: Actor, move: boolean, t: number, aim: boolean) {
    a.legs.forEach(
      (l, i) => (l.rotation.x = move ? Math.sin(t + i * Math.PI) * 0.45 : 0),
    );
    a.arms.forEach(
      (l, i) =>
        (l.rotation.x = aim
          ? -1.3
          : move
            ? Math.sin(t + i * Math.PI) * 0.28
            : 0),
    );
  }
  render(doorProgress?: number) {
    if (doorProgress !== undefined) {
      this.hinge.rotation.y =
        -Math.max(0, Math.min(1, (doorProgress - 0.2) / 0.65)) * 1.7;
      this.knob.rotation.z =
        -Math.sin(Math.min(1, doorProgress * 3) * Math.PI) * 0.5;
      this.renderer.render(this.doorScene, this.doorCamera);
    } else this.renderer.render(this.scene, this.camera);
  }
  project(p: Vec, y: number) {
    return new T.Vector3(p.x, y, p.z).project(this.camera);
  }
}
