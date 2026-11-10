import { playerActor, type PlayerAnimator, type PlayerFrame } from "./player";
import { zombieActor } from "./zombie";
import { shoulderOffset } from "./controls";
import { Environment } from "./environment";
import { themes } from "./environment-logic";
import { roomDetails } from "./details";
import { corpseOpacity, isCollected } from "./logic";
import { surfaceDetail } from "./art";
import * as T from "three";
import { rooms, roomDoors, endpoint, type RoomId, type Vec } from "./world";
import type { GameState } from "./logic";
import { defaults, profiles, lookInput, type Preferences } from "./controls";
import { raycastShot, cameraCollision, type ShotHit } from "./aim";
import {
  box,
  capsule,
  label,
  material as mat,
  proceduralTexture,
  seeded,
} from "./art";
import { person, animate, type Actor } from "./actors";
import { Post } from "./post";
export class View {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, 1, 0.06, 65);
  group = new T.Group();
  environment?: Environment;
  environmentActive = true;
  player = person();
  playerAnimation?: PlayerAnimator;
  playerAnimationPreview = "";
  playerFrame: Partial<PlayerFrame> = {};
  enemyMeshes = new Map<string, Actor>();
  proceduralZombies = false;
  animationPreview: string | undefined;
  frustum = new T.Frustum();
  previousEnemyPositions = new Map<string, T.Vector3>();
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
  prefs: Preferences = { ...defaults };
  yaw = Math.PI;
  pitch = -0.06;
  post: Post;
  obstacles: T.Object3D[] = [];
  walls: T.Object3D[] = [];
  ceiling = new T.Group();
  practical: T.PointLight[] = [];
  dust: T.Points | undefined;
  flash = new T.PointLight(0xffc184, 0, 5);
  muzzle: T.Mesh;
  recoil = 0;
  hurtTime = 0;
  fx: T.Points | undefined;
  fxLife = 0;
  fxVel: number[] = [];
  lastShadow = 0;
  cameraReady = false;
  tile = proceduralTexture("tile");
  wallTex = proceduralTexture("wall");
  rust = proceduralTexture("rust");
  blood = proceduralTexture("blood");
  cookie = proceduralTexture("cookie");
  constructor(container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    container.prepend(this.renderer.domElement);
    this.scene.matrixAutoUpdate = false;
    this.scene.updateMatrix();
    this.scene.background = new T.Color(0x04090b);
    this.scene.fog = new T.FogExp2(0x071013, 0.055);
    this.scene.add(new T.HemisphereLight(0x77968d, 0x252c28, 0.48));
    this.scene.add(this.group, this.player.root);
    this.light = new T.SpotLight(0xffdfac, 65, 13, 0.5, 0.7, 1.5);
    this.light.map = this.cookie;
    this.light.shadow.camera.near = 0.15;
    this.light.shadow.camera.far = 15;
    this.light.shadow.bias = -0.00025;
    this.light.shadow.normalBias = 0.025;
    this.light.shadow.autoUpdate = false;
    this.scene.add(this.light, this.target, this.flash);
    this.light.target = this.target;
    this.muzzle = new T.Mesh(
      new T.ConeGeometry(0.09, 0.3, 5),
      new T.MeshBasicMaterial({ color: 0xffd890 }),
    );
    this.muzzle.visible = false;
    this.scene.add(this.muzzle);
    this.doorScene.background = new T.Color(0x030608);
    this.doorScene.add(new T.AmbientLight(0x8badb6, 0.6));
    const dl = new T.SpotLight(0xe2c79d, 95, 20, 1, 0.5);
    dl.position.set(-3, 5, 4);
    this.doorScene.add(dl, dl.target);
    dl.target.position.set(0, 1.5, 0);
    this.doorCamera.position.set(1, 2, 6);
    this.doorCamera.lookAt(0, 1.6, 0);
    this.hinge.position.set(-0.95, 0, 0);
    this.hinge.add(
      box(1.9, 3.3, 0.14, mat(0x4d605c, 0.5, 0.4, this.rust), 0.95, 1.65, 0),
    );
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
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.setPreferences(this.prefs);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  installPlayer() {
    const loaded = playerActor();
    if (!loaded) return;
    this.playerAnimation?.dispose();
    this.disposeGroup(this.player.root);
    this.player = loaded.actor;
    this.playerAnimation = loaded.animation;
    this.scene.add(this.player.root);
  }
  setPreferences(p: Preferences) {
    const changed = this.prefs.mode !== p.mode;
    this.prefs = { ...p };
    const q = profiles[p.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.scale));
    this.renderer.shadowMap.enabled = q.shadows;
    this.light.castShadow = q.shadows;
    this.light.map = q.shadows ? this.cookie : null;
    [this.group, this.player.root, this.doorScene].forEach((root) =>
      surfaceDetail(root, p.quality !== "low"),
    );
    this.light.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (this.light.shadow.map) {
      this.light.shadow.map.dispose();
      this.light.shadow.map = null;
    }
    this.light.shadow.needsUpdate = true;
    if (changed) this.cameraReady = false;
    this.resize();
    this.applyCutaway();
    this.dust?.geometry.setDrawRange(0, q.dust);
  }
  look(dx: number, dy: number) {
    const look = lookInput(this.yaw, this.pitch, dx, dy, this.prefs);
    this.yaw = look.yaw;
    this.pitch = look.pitch;
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.doorCamera.aspect = w / h;
    this.doorCamera.updateProjectionMatrix();
    this.post?.resize(w, h, this.renderer.getPixelRatio());
    if (this.prefs.mode === "tank") this.setCamera(this.zone);
  }
  setCamera(zone: number) {
    this.zone = zone;
    if (this.prefs.mode !== "tank") return;
    const scale = this.camera.aspect < 1.3 ? 1.45 : 1;
    this.camera.position.set(
      (zone === 0 ? 10 : -10) * scale,
      13 * scale,
      16 * scale,
    );
    this.camera.fov = 48;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 0.5, -1);
    this.applyCutaway();
  }
  applyCutaway() {
    const tank = this.prefs.mode === "tank";
    if (this.scene.fog instanceof T.FogExp2)
      this.scene.fog.density = tank ? 0.015 : themes[this.room].fog;
    const ambient = this.scene.children.find(
      (o) => o instanceof T.HemisphereLight,
    ) as T.HemisphereLight | undefined;
    if (ambient) ambient.intensity = tank ? 0.75 : 0.48;
    this.ceiling.visible = !tank;
    this.walls.forEach(
      (w, i) =>
        (w.visible = !tank || i === 0 || (this.zone === 0 ? i === 2 : i === 3)),
    );
  }
  syncCamera(player: GameState["player"]) {
    this.yaw = player.yaw;
    this.pitch = -0.06;
    this.cameraReady = false;
  }
  addObstacle(mesh: T.Mesh) {
    this.group.add(mesh);
    this.obstacles.push(mesh);
    return mesh;
  }
  load(id: RoomId, s: GameState) {
    this.disposeGroup(this.group);
    for (const a of this.enemyMeshes.values()) {
      a.animation?.dispose();
      this.disposeGroup(a.root);
    }
    this.previousEnemyPositions.clear();
    this.group = new T.Group();
    this.scene.add(this.group);
    this.enemyMeshes.clear();
    this.itemMeshes.clear();
    this.obstacles = [];
    this.walls = [];
    this.practical = [];
    this.ceiling = new T.Group();
    this.group.add(this.ceiling);
    this.room = id;
    this.cameraReady = false;
    this.zone = 0;
    this.lastCut = this.elapsed;
    const r = rooms[id];
    const floor = mat(r.safe ? 0xaaa18b : 0x71847e, 0.55, 0.08, this.tile);
    this.tile.repeat.set(6.5, 8.5);
    this.addObstacle(box(13.2, 0.18, 17.6, floor, 0, -0.12, 0));
    const wallMat = mat(r.safe ? 0xb4a98a : 0x919d92, 0.86, 0.05, this.wallTex);
    this.wallTex.repeat.set(2, 1);
    const positions: [
      [number, number, number, number, number, number],
      [number, number, number, number, number, number],
      [number, number, number, number, number, number],
      [number, number, number, number, number, number],
    ] = [
      [13.4, 4, 0.22, 0, 2, -8.85],
      [13.4, 4, 0.22, 0, 2, 8.85],
      [0.22, 4, 17.8, -6.65, 2, 0],
      [0.22, 4, 17.8, 6.65, 2, 0],
    ];
    for (const [w, h, d, x, y, z] of positions) {
      const wall = this.addObstacle(box(w, h, d, wallMat, x, y, z));
      this.walls.push(wall);
    }
    const roof = box(
      13.4,
      0.16,
      17.8,
      mat(0x535f59, 0.95, 0.1, this.wallTex),
      0,
      4.08,
      0,
    );
    this.ceiling.add(roof);
    this.obstacles.push(roof);
    for (let z = -7; z < 8; z += 3) {
      this.ceiling.add(
        box(12.8, 0.08, 0.06, mat(0x293a35, 0.8, 0.3), 0, 3.96, z),
      );
      const pipe = capsule(
        0.07,
        12.2,
        mat(0x52655b, 0.5, 0.6, this.rust),
        0,
        3.75,
        z,
      );
      pipe.rotation.z = Math.PI / 2;
      this.ceiling.add(pipe);
    }
    const sign = label(r.name.toUpperCase(), "#bdcbb2", 3.2);
    sign.position.set(0, 3.1, -8.7);
    this.group.add(sign);
    for (const o of r.obstacles) {
      const metal = mat(0x56635b, 0.58, 0.5, this.rust),
        cloth = mat(0xb4b5a0, 0.95, 0, this.wallTex);
      if (["corredor", "enfermaria", "internacao"].includes(id)) {
        this.addObstacle(box(o.w, 1.1, o.d, mat(0x48564f), o.x, 0.55, o.z));
        this.group.add(box(o.w + 0.08, 0.18, o.d, cloth, o.x, 1.05, o.z));
        this.group.add(
          box(o.w * 0.75, 0.17, 0.5, mat(0xc6c6ae), o.x, 1.2, o.z - o.d * 0.3),
        );
        for (const dx of [-o.w / 2, o.w / 2]) {
          this.group.add(box(0.06, 0.38, o.d, metal, o.x + dx, 1.35, o.z));
          for (const dz of [-o.d * 0.3, o.d * 0.3])
            this.group.add(capsule(0.07, 0.25, metal, o.x + dx, 0.2, o.z + dz));
        }
      } else if (id === "arquivo") {
        this.addObstacle(box(o.w, 2.3, o.d, metal, o.x, 1.15, o.z));
        for (let y = 0.35; y < 2.3; y += 0.45) {
          this.group.add(
            box(o.w + 0.03, 0.035, o.d, mat(0x263b31), o.x, y, o.z),
          );
          for (let j = 0; j < 6; j++) {
            this.group.add(
              box(
                o.w + 0.05,
                0.3,
                0.27,
                mat([0x847d5d, 0x6d7f6b, 0x4c5c50][j % 3]),
                o.x,
                y + 0.18,
                o.z - o.d / 2 + 0.3 + j * 0.9,
              ),
            );
          }
        }
      } else if (id === "atrio") {
        this.addObstacle(
          box(
            o.w,
            3.9,
            o.d,
            mat(0x637368, 0.6, 0.2, this.wallTex),
            o.x,
            1.95,
            o.z,
          ),
        );
        this.group.add(
          box(o.w + 0.12, 0.25, o.d + 0.12, metal, o.x, 0.16, o.z),
        );
      } else {
        this.addObstacle(box(o.w, 1.25, o.d, metal, o.x, 0.625, o.z));
        this.group.add(
          box(
            o.w + 0.07,
            0.1,
            o.d + 0.08,
            mat(0x8b8e79, 0.55, 0.2, this.rust),
            o.x,
            1.3,
            o.z,
          ),
        );
        if (id === "recepcao") {
          const screen = box(
            0.75,
            0.5,
            0.12,
            mat(0x242f29, 0.5, 0.4),
            o.x,
            1.6,
            o.z,
          );
          this.group.add(screen);
          this.group.add(
            box(
              0.58,
              0.34,
              0.01,
              new T.MeshBasicMaterial({ color: 0x476556 }),
              o.x,
              1.6,
              o.z + 0.07,
            ),
          );
          this.group.add(
            box(0.6, 0.045, 0.2, mat(0x303b30), o.x, 1.37, o.z + 0.3),
          );
        } else
          for (let k = 0; k < 3; k++)
            this.group.add(
              box(
                o.w * 0.9,
                0.12,
                0.03,
                mat(0x899981, 0.45, 0.6),
                o.x,
                0.35 + k * 0.3,
                o.z + o.d / 2 + 0.02,
              ),
            );
      }
    }
    for (const d of roomDoors(id)) {
      const p = endpoint(d, id).position,
        g = new T.Group();
      g.position.set(p.x, 0, p.z);
      if (Math.abs(p.x) > 5)
        g.rotation.y = p.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      else if (p.z > 0) g.rotation.y = Math.PI;
      g.add(
        box(1.65, 2.65, 0.13, mat(0x273d36, 0.65, 0.4, this.rust), 0, 1.325, 0),
      );
      g.add(box(0.6, 0.35, 0.04, mat(0x23332c, 0.3, 0.8), 0, 1.9, 0.1));
      g.add(box(0.12, 0.08, 0.14, mat(0xb7a773, 0.3, 0.6), 0.56, 1.2, 0.15));
      for (const x of [-0.91, 0.91])
        g.add(box(0.14, 2.8, 0.2, mat(0x9eac8c, 0.5, 0.5), x, 1.4, 0));
      const l = label(d.label.toUpperCase(), "#d5d4ae", 2);
      l.position.set(0, 2.95, 0.08);
      g.add(l);
      this.group.add(g);
      const glow = new T.PointLight(0x94b99b, 5, 4, 1.6);
      glow.position.set(p.x * 0.93, 2.6, p.z * 0.94);
      this.group.add(glow);
    }
    for (const item of r.items) {
      if (isCollected(s, item.id)) continue;
      const g = new T.Group();
      g.position.set(item.x, 0, item.z);
      const c =
        item.kind === "ammo"
          ? 0xbca261
          : item.kind === "battery"
            ? 0x8fc9b1
            : item.kind === "herb"
              ? 0xc1c4a4
              : 0xd2c399;
      if (item.kind === "document") {
        g.add(box(0.34, 0.009, 0.46, mat(0xc2c5ad), 0, 0.025, 0));
        for (let k = 0; k < 3; k++)
          g.add(
            box(0.23, 0.003, 0.012, mat(0x586a5b), 0, 0.032, -0.12 + k * 0.07),
          );
      } else if (item.kind === "key") {
        const band = new T.Mesh(
          new T.TorusGeometry(0.14, 0.035, 5, 12),
          mat(0xa99153, 0.5, 0.2),
        );
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.23;
        g.add(band);
      } else g.add(box(0.35, 0.12, 0.25, mat(c, 0.65, 0.15), 0, 0.24, 0));
      if (item.kind === "herb") {
        g.add(box(0.19, 0.035, 0.07, mat(0xb98170), 0, 0.32, 0));
        g.add(box(0.07, 0.035, 0.19, mat(0xb98170), 0, 0.32, 0));
      }
      const beacon = new T.Mesh(
        new T.OctahedronGeometry(0.07),
        new T.MeshBasicMaterial({ color: c }),
      );
      beacon.position.y = 0.65;
      beacon.name = "pickup-marker";
      g.add(beacon);
      this.group.add(g);
      this.itemMeshes.set(item.id, g);
    }
    for (const e of Object.values(s.enemies)) {
      if (e.room !== id || (e.dead && corpseOpacity(e) === 0)) continue;
      const a =
        (!e.boss && !this.proceduralZombies ? zombieActor(e) : undefined) ||
        person(true, e.boss, e.id, e.kind);
      this.scene.add(a.root);
      this.enemyMeshes.set(e.id, a);
    }
    const rand = seeded(id.length * 719);
    for (let i = 0; i < 10; i++) {
      const paper = box(
        0.18,
        0.004,
        0.24,
        mat(0xa7aa91),
        rand() * 10 - 5,
        0.008,
        rand() * 14 - 7,
      );
      paper.rotation.y = rand() * 6;
      this.group.add(paper);
    }
    for (let i = 0; i < 4; i++) {
      const decal = new T.Mesh(
        new T.PlaneGeometry(1 + rand(), 0.8 + rand()),
        new T.MeshStandardMaterial({
          map: this.blood,
          transparent: true,
          depthWrite: false,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(rand() * 10 - 5, 0.01, rand() * 12 - 6);
      if (!r.safe) this.group.add(decal);
    }
    for (const x of [-4, 4]) {
      const poster = label(
        x < 0 ? "ISOLAMENTO A-13" : "LAVE AS MÃOS",
        "#a9b6a0",
        1.55,
      );
      poster.position.set(x, 2, -8.7);
      this.group.add(poster);
      const vent = box(1.1, 0.5, 0.04, mat(0x3d4e43, 0.6, 0.6), x, 3.4, -8.69);
      this.group.add(vent);
      for (let k = 0; k < 5; k++)
        this.group.add(
          box(1, 0.02, 0.03, mat(0x8a9883), x, 3.24 + k * 0.08, -8.65),
        );
    }
    // Practical lights remain readable even with an empty flashlight.
    for (const [i, z] of [-5, 4].entries()) {
      const l = new T.PointLight(
        r.safe ? 0xffc58e : id === "isolamento" ? 0xd88769 : 0xa9c7b4,
        r.safe ? 22 : 14,
        13,
        1.5,
      );
      l.position.set(i ? -4 : 4, 3.45, z);
      l.userData.base = l.intensity;
      this.group.add(l);
      this.practical.push(l);
      const tube = box(
        1.5,
        0.08,
        0.23,
        new T.MeshBasicMaterial({ color: r.safe ? 0xe6c393 : 0xb6d5bd }),
        l.position.x,
        3.65,
        z,
      );
      this.ceiling.add(tube);
    }
    for (const x of [-6.32, 6.32]) {
      const pipe = capsule(
        0.035,
        2.5,
        mat(0x6e8171, 0.4, 0.7, this.rust),
        x,
        1.4,
        -3,
      );
      this.group.add(pipe);
      const bag = box(0.22, 0.3, 0.06, mat(0x8a9981, 0.5), x, 2.6, -3);
      this.group.add(bag);
    }
    if (r.safe) {
      this.fixture("GRAVADOR · E", 0, -3, 0xcbb97c);
      this.fixture("RÁDIO DE EMERGÊNCIA", -4, -6, 0x9eb691);
    }
    if (id === "lavanderia")
      this.fixture("VÁLVULAS · 3 / 1 / 2", 4, -6.2, 0xb9a361);
    if (id === "isolamento")
      this.fixture("TRANSMITIR E SELAR", 0, -6.5, 0xc0a177);
    if (id === "arquivo") this.fixture("RELÓGIO DE PLANTÃO", 0, -6.6, 0xd3c18d);
    if (id === "gerador") this.fixture("QUADRO ELÉTRICO", 4, -6, 0x88b5a2);
    if (id === "atrio") this.fixture("TRAVA ELÉTRICA", 0, -6.7, 0xc7a975);
    const count = 180,
      geo = new T.BufferGeometry(),
      pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand() * 12 - 6;
      pos[i * 3 + 1] = rand() * 3.5 + 0.2;
      pos[i * 3 + 2] = rand() * 16 - 8;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setDrawRange(0, profiles[this.prefs.quality].dust);
    this.dust = new T.Points(
      geo,
      new T.PointsMaterial({
        color: 0xb3b7a3,
        size: 0.025,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    this.group.add(this.dust);
    this.group.add(roomDetails(id));
    this.environment = new Environment(id, s);
    this.group.add(this.environment.root);
    this.practical.forEach((l) => l.color.setHex(themes[id].color));
    if (this.scene.fog instanceof T.FogExp2)
      this.scene.fog.color.setHex(themes[id].color).multiplyScalar(0.06);
    const dynamic = new Set<T.Object3D>([
      ...this.itemMeshes.values(),
      this.environment.root,
    ]);
    const freeze = (o: T.Object3D) => {
      if (dynamic.has(o)) return;
      o.updateMatrix();
      o.matrixAutoUpdate = false;
      o.children.forEach(freeze);
    };
    freeze(this.group);
    surfaceDetail(this.group, this.prefs.quality !== "low");
    this.syncCamera(s.player);
    this.setCamera(0);
    this.applyCutaway();
  }
  fixture(text: string, x: number, z: number, c: number) {
    this.group.add(
      box(1.3, 1.1, 0.65, mat(0x3b4a3c, 0.65, 0.4, this.rust), x, 0.55, z),
    );
    const l = label(text, "#d6cfa8", 2.4);
    l.position.set(x, 1.65, z + 0.06);
    this.group.add(l);
    this.group.add(
      box(
        0.6,
        0.18,
        0.04,
        new T.MeshBasicMaterial({ color: c }),
        x,
        1,
        z + 0.35,
      ),
    );
    for (const dx of [-0.42, 0.42])
      this.group.add(
        capsule(0.045, 0.01, mat(0xa5b29b, 0.3, 0.6), x + dx, 0.9, z + 0.36),
      );
  }
  disposeGroup(g: T.Object3D) {
    g.removeFromParent();
    g.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Points) {
        if (o instanceof T.InstancedMesh) o.dispose();
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
        if (!o.geometry.userData.zombieShared) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (
            "map" in m &&
            m.map instanceof T.Texture &&
            !m.map.userData.persistent
          )
            m.map.dispose();
          if (!m.userData.zombieShared) m.dispose();
        }
      }
    });
  }
  removePickup(id: string) {
    const g = this.itemMeshes.get(id);
    if (g) {
      this.disposeGroup(g);
      this.itemMeshes.delete(id);
    }
  }
  worldObjects() {
    return {
      items: [...this.itemMeshes.keys()],
      animations: [...this.enemyMeshes].map(([id, a]) => ({
        id,
        state: a.animation?.stateName || "procedural",
        lod: a.animation?.lod,
        updates: a.animation?.mixersUpdated,
      })),
      actors: [...this.enemyMeshes.keys()],
    };
  }
  updateCamera(s: GameState, dt: number, aiming: boolean) {
    if (this.prefs.mode === "tank") {
      const z = s.player.z < -0.8 ? 1 : s.player.z > 1.2 ? 0 : this.zone;
      if (z !== this.zone && this.elapsed - this.lastCut > 0.6) {
        this.setCamera(z);
        this.lastCut = this.elapsed;
      }
      return;
    }
    const p = s.player,
      dir = new T.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch),
      ),
      right = new T.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const pivot = new T.Vector3(p.x, 1.52, p.z);
    const desired = pivot
      .clone()
      .addScaledVector(dir, aiming ? -1.95 : -2.75)
      .addScaledVector(right, shoulderOffset(aiming, this.prefs.shoulder))
      .add(new T.Vector3(0, 0.15, 0));
    this.scene.updateMatrixWorld();
    const safe = cameraCollision(pivot, desired, this.obstacles);
    if (!this.cameraReady) {
      this.camera.position.copy(safe);
      this.cameraReady = true;
    } else {
      this.camera.position.lerp(safe, 1 - Math.exp(-dt * 14));
      this.camera.position.copy(
        cameraCollision(pivot, this.camera.position, this.obstacles),
      );
    }
    this.camera.lookAt(this.camera.position.clone().addScaledVector(dir, 10));
    const fov = aiming ? 52 : 62;
    this.camera.fov = T.MathUtils.lerp(
      this.camera.fov,
      fov,
      1 - Math.exp(-dt * 13),
    );
    this.camera.updateProjectionMatrix();
    const hide = this.camera.position.distanceTo(pivot) < 0.85;
    this.player.root.visible = !hide;
  }
  update(
    s: GameState,
    dt: number,
    moving: boolean,
    aiming: boolean,
    focus: boolean,
  ) {
    this.elapsed += dt;
    this.walk += moving ? dt * 8 : dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    const p = s.player;
    this.player.root.position.set(p.x, 0, p.z);
    this.player.root.rotation.y = p.yaw;
    this.player.root.visible = true;
    this.updateCamera(s, dt, aiming);
    this.camera.updateMatrixWorld();
    if (this.playerAnimation) {
      this.playerAnimation.preview = this.playerAnimationPreview;
      this.playerAnimation.update(
        dt,
        {
          moving,
          aiming,
          running: false,
          cautious: false,
          reloading: false,
          hp: p.hp,
          light: s.light && s.battery > 0,
          pitch: this.prefs.mode === "shoulder" ? this.pitch : 0,
          yawDelta:
            this.prefs.mode === "shoulder"
              ? Math.atan2(
                  Math.sin(this.yaw - p.yaw),
                  Math.cos(this.yaw - p.yaw),
                )
              : 0,
          aimPoint:
            this.prefs.mode === "shoulder"
              ? this.wallImpact() ||
                this.camera.position
                  .clone()
                  .addScaledVector(
                    this.camera.getWorldDirection(new T.Vector3()),
                    12,
                  )
              : new T.Vector3(
                  p.x + Math.sin(p.yaw) * 10,
                  1.43,
                  p.z + Math.cos(p.yaw) * 10,
                ),
          ...this.playerFrame,
        },
        this.prefs.quality,
      );
    } else {
      animate(this.player, moving, this.walk, aiming, this.recoil);
      this.hurtTime = Math.max(0, this.hurtTime - dt);
      this.player.body.rotation.x =
        this.hurtTime > 0 ? Math.sin(this.hurtTime * 18) * 0.12 : 0;
      if (aiming && this.prefs.mode === "shoulder")
        this.player.arms.forEach((arm) => (arm.rotation.x -= this.pitch));
      if (this.player.gun) this.player.gun.rotation.x = aiming ? 1.6 : 0;
    }
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
    );
    for (const e of Object.values(s.enemies)) {
      const a = this.enemyMeshes.get(e.id);
      if (!a) continue;
      a.root.position.set(e.x, 0, e.z);
      a.warning.visible = !e.dead && e.state === "windup";
      if (e.boss && a.warning.children[1])
        a.warning.children[1].visible = e.attack === 1;
      if (!e.dead)
        a.root.rotation.y =
          e.state === "windup"
            ? Math.atan2(e.dx, e.dz)
            : Math.atan2(p.x - e.x, p.z - e.z);
      if (a.animation) {
        const position = new T.Vector3(e.x, 0, e.z),
          previous = this.previousEnemyPositions.get(e.id) || position;
        const speed = position.distanceTo(previous) / Math.max(dt, 0.001);
        this.previousEnemyPositions.set(e.id, position);
        const visible = this.frustum.intersectsSphere(
          new T.Sphere(new T.Vector3(e.x, 0.85, e.z), 1.5),
        );
        a.root.visible = visible;
        a.animation.preview = this.animationPreview;
        a.animation.update(
          e,
          dt,
          visible,
          Math.hypot(e.x - p.x, e.z - p.z),
          speed,
          this.prefs.quality,
        );
        if (e.dead) {
          const alpha = corpseOpacity(e);
          if (alpha <= 0) {
            a.animation.dispose();
            this.disposeGroup(a.root);
            this.enemyMeshes.delete(e.id);
            continue;
          }
          a.animation.fade(alpha);
        }
        continue;
      }
      if (e.dead) {
        const alpha = corpseOpacity(e);
        if (alpha <= 0) {
          this.disposeGroup(a.root);
          this.enemyMeshes.delete(e.id);
          continue;
        }
        a.body.rotation.x = Math.min(
          Math.PI / 2,
          (Math.max(0, (Date.now() - e.deathAt) / 800) * Math.PI) / 2,
        );
        a.root.position.y = 0.1;
        a.head.visible = !e.headGone;
        if (alpha < 1)
          a.root.traverse((o) => {
            if (o instanceof T.Mesh) {
              const ms = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of ms) {
                m.transparent = true;
                m.opacity = alpha;
                m.depthWrite = false;
              }
            }
          });
        continue;
      }
      animate(a, e.state === "chase", this.elapsed * (e.crawl ? 5 : 4), false);
      a.body.rotation.x = e.crawl ? 1.3 : e.state === "stun" ? -0.16 : 0;
      a.root.position.y = e.crawl ? 0.08 : 0;
      if (e.crawl) a.body.position.y = 0;
      a.body.position.z = e.crawl ? -0.65 : 0;
      if (e.state === "windup")
        a.arms.forEach((arm) => (arm.rotation.x = -2.1));
      else if (e.state === "stun")
        a.arms.forEach((arm) => (arm.rotation.x = -1.5));
      if (a.core && a.core.material instanceof T.MeshBasicMaterial)
        a.core.material.color.set(e.vulnerable > 0 ? 0xffc77f : 0x7e9486);
      a.head.visible = !e.headGone;
    }
    this.light.visible = s.light && s.battery > 0;
    this.light.angle = focus ? 0.25 : 0.54;
    this.light.intensity = focus ? 92 : 68;
    const lyaw = aiming && this.prefs.mode === "shoulder" ? this.yaw : p.yaw,
      lpitch = aiming && this.prefs.mode === "shoulder" ? this.pitch : -0.09;
    this.light.position.set(
      p.x + Math.sin(lyaw) * 0.43 - Math.cos(lyaw) * 0.12,
      1.38,
      p.z + Math.cos(lyaw) * 0.43 + Math.sin(lyaw) * 0.12,
    );
    if (this.playerAnimation)
      this.light.position.copy(
        this.playerAnimation.lampTip.getWorldPosition(new T.Vector3()),
      );
    this.target.position.set(
      p.x + Math.sin(lyaw) * 8,
      1.38 + Math.sin(lpitch) * 8,
      p.z + Math.cos(lyaw) * 8,
    );
    if (this.elapsed - this.lastShadow > 0.07) {
      this.light.shadow.needsUpdate = true;
      this.lastShadow = this.elapsed;
    }
    for (const l of this.practical) {
      const pulse =
        this.prefs.quality === "low" || rooms[s.room].safe
          ? 1
          : 0.92 +
            0.06 * Math.sin(this.elapsed * 7.2 + l.position.z) +
            0.02 * Math.sin(this.elapsed * 21);
      l.intensity = l.userData.base * pulse;
    }
    this.environment?.update(
      s,
      dt,
      this.elapsed,
      this.camera,
      this.prefs,
      this.environmentActive,
      moving,
    );
    for (const [id, g] of this.itemMeshes) {
      if (isCollected(s, id)) {
        this.removePickup(id);
        continue;
      }
      const beacon = g.getObjectByName("pickup-marker");
      if (beacon) beacon.rotation.y += dt;
    }
    if (this.dust) {
      const arr = this.dust.geometry.attributes.position;
      for (let i = 0; i < arr.count; i++) {
        let y = arr.getY(i) + dt * 0.025;
        if (y > 3.7) y = 0.2;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
    }
    this.flash.intensity = this.recoil > 0 ? this.recoil * 45 : 0;
    this.muzzle.visible = this.recoil > 0.6;
    if (this.fx && this.fxLife > 0) {
      this.fxLife -= dt;
      const a = this.fx.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        a.setXYZ(
          i,
          a.getX(i) + this.fxVel[i * 3] * dt,
          a.getY(i) + this.fxVel[i * 3 + 1] * dt,
          a.getZ(i) + this.fxVel[i * 3 + 2] * dt,
        );
        this.fxVel[i * 3 + 1] -= dt * 4;
      }
      a.needsUpdate = true;
      (this.fx.material as T.PointsMaterial).opacity = Math.max(
        0,
        this.fxLife * 2,
      );
      if (this.fxLife <= 0) {
        this.disposeGroup(this.fx);
        this.fx = undefined;
      }
    }
  }
  illuminates(id: string, focus: boolean) {
    const point = this.hitPosition(id, "body");
    if (!point) return false;
    const direction = this.target.position
      .clone()
      .sub(this.light.position)
      .normalize();
    const delta = point.clone().sub(this.light.position),
      len = delta.length();
    if (
      len > (focus ? 8 : 9) ||
      direction.dot(delta.clone().normalize()) < Math.cos(focus ? 0.25 : 0.54)
    )
      return false;
    return (
      new T.Raycaster(
        this.light.position,
        delta.normalize(),
        0.02,
        Math.max(0.02, len - 0.05),
      ).intersectObjects(this.obstacles, false).length === 0
    );
  }
  directionImpact(origin: T.Vector3, direction: T.Vector3) {
    return new T.Raycaster(origin, direction, 0.02, 20).intersectObjects(
      this.obstacles,
      false,
    )[0]?.point;
  }
  wallImpact() {
    this.ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    return this.ray.intersectObjects(this.obstacles, false)[0]?.point;
  }
  hitPosition(id: string, region: string) {
    const a = this.enemyMeshes.get(id);
    const h = a?.hitboxes.find((h) => h.userData.region === region);
    return h?.getWorldPosition(new T.Vector3());
  }
  aimTargets(s: GameState) {
    return this.getHitboxes(s).map((h) => ({
      id: h.userData.enemyId,
      region: h.userData.region,
      position: h.getWorldPosition(new T.Vector3()).toArray(),
    }));
  }
  getHitboxes(s: GameState) {
    return Object.values(s.enemies)
      .filter((e) => e.room === s.room && !e.dead)
      .flatMap((e) => this.enemyMeshes.get(e.id)?.hitboxes || []);
  }
  shot(s: GameState, assist = this.prefs.assist): ShotHit | undefined {
    this.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld(true);
    this.ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    this.ray.far = 16;
    const boxes = this.getHitboxes(s),
      muzzle = this.playerAnimation
        ? this.playerAnimation.barrel.getWorldPosition(new T.Vector3())
        : new T.Vector3(s.player.x, 1.35, s.player.z);
    let hit = raycastShot(this.ray, boxes, this.obstacles, muzzle);
    if (!hit && assist) {
      const candidates = boxes
        .map((b) => ({ b, p: b.getWorldPosition(new T.Vector3()) }))
        .map((e) => ({ ...e, screen: e.p.clone().project(this.camera) }))
        .filter(
          (e) => Math.hypot(e.screen.x, e.screen.y) < 0.045 && e.screen.z < 1,
        )
        .sort((a, b) => a.screen.lengthSq() - b.screen.lengthSq());
      for (const e of candidates) {
        const dir = e.p.clone().sub(this.camera.position).normalize();
        hit = raycastShot(
          new T.Raycaster(this.camera.position, dir, 0.05, 16),
          boxes,
          this.obstacles,
          muzzle,
        );
        if (hit) break;
      }
    }
    return hit;
  }
  shotFx(s: GameState, point?: T.Vector3, blood = false) {
    this.recoil = 1;
    this.playerAnimation?.trigger("Fire");
    const dir = new T.Vector3(
      Math.sin(s.player.yaw),
      0,
      Math.cos(s.player.yaw),
    );
    this.flash.position.set(s.player.x, 1.35, s.player.z);
    this.flash.position.addScaledVector(dir, 0.6);
    if (this.playerAnimation)
      this.flash.position.copy(
        this.playerAnimation.barrel.getWorldPosition(new T.Vector3()),
      );
    this.muzzle.position.copy(this.flash.position);
    this.muzzle.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    if (point) {
      if (this.fx) this.disposeGroup(this.fx);
      const pos = new Float32Array(16 * 3);
      this.fxVel = [];
      for (let i = 0; i < 16; i++) {
        pos.set(point.toArray(), i * 3);
        this.fxVel.push(
          (Math.random() - 0.5) * 2,
          Math.random() * 1.5,
          (Math.random() - 0.5) * 2,
        );
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      this.fx = new T.Points(
        geo,
        new T.PointsMaterial({
          color: blood ? 0x9a382c : 0xe2c68d,
          size: blood ? 0.05 : 0.025,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      );
      this.scene.add(this.fx);
      this.fxLife = 0.5;
    }
  }
  render(doorProgress?: number) {
    this.renderer.info.reset();
    if (doorProgress !== undefined) {
      this.hinge.rotation.y =
        -Math.max(0, Math.min(1, (doorProgress - 0.2) / 0.65)) * 1.7;
      this.knob.rotation.z =
        -Math.sin(Math.min(1, doorProgress * 3) * Math.PI) * 0.5;
      this.renderer.render(this.doorScene, this.doorCamera);
    } else if (profiles[this.prefs.quality].post)
      this.post.render(this.elapsed);
    else this.renderer.render(this.scene, this.camera);
  }
  project(p: Vec, y: number) {
    return new T.Vector3(p.x, y, p.z).project(this.camera);
  }
}
