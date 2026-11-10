import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, material, seeded } from "./art";
import {
  ambientDensity,
  addImpact,
  claimAmbientEvent,
  integrateBody,
  themes,
  type Body,
} from "./environment-logic";
import type { GameState } from "./logic";
import type { Preferences } from "./controls";
import type { RoomId } from "./world";

/** One room-owned, bounded ambience system. No remote assets or physics engine. */
export class Environment {
  root = new T.Group();
  time = 0;
  eventTime = -1;
  lastEvent = "";
  sounds: { kind: string; x: number; z: number }[] = [];
  reactors: (Body & { kind: string; mesh: T.Object3D })[] = [];
  fauna: (Body & { mesh: T.Object3D })[] = [];
  fans: T.Group[] = [];
  cloth: T.Mesh[] = [];
  wind = { value: 0 };
  particles: T.Points;
  particleMat: T.ShaderMaterial;
  crt: T.Mesh;
  screenCanvas: HTMLCanvasElement;
  screenTexture: T.CanvasTexture;
  screenTime = 0;
  glass: T.Mesh;
  shards = 0;
  impacts: T.InstancedMesh;
  decalCount = -1;
  lastImpact: object | undefined;
  eventProp = new T.Group();
  shadow: T.Mesh;
  eventDoor = new T.Group();
  phone = new T.Group();
  flyingPaper: T.Mesh;
  beams = new T.Group();
  frustum = new T.Frustum();
  reactiveHits = 0;
  faunaFlees = 0;
  seed: number;
  litter: T.InstancedMesh;
  animals: T.InstancedMesh;
  constructor(
    public room: RoomId,
    s: GameState,
  ) {
    const theme = themes[room];
    this.root.name = "room-life:" + room;
    this.seed = [...room].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = seeded(this.seed),
      steel = material(0x4e6460, 0.8, 0.35);
    // Repeated static pipe brackets, barricade wood, litter: a single draw.
    const fixtures = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), steel, 42);
    const dummy = new T.Object3D();
    for (let i = 0; i < 42; i++) {
      const side = i % 2 ? 1 : -1;
      dummy.position.set(
        side * (i < 24 ? 6.35 : 5.55),
        i < 24 ? 2.4 + (i % 3) * 0.25 : 0.02,
        -7 + (i % 12) * 1.2,
      );
      dummy.scale.set(
        i < 24 ? 0.18 : 0.34,
        i < 24 ? 0.05 : 0.015,
        i < 24 ? 0.12 : 0.21,
      );
      dummy.rotation.y = i < 24 ? 0 : rand() * 6;
      dummy.updateMatrix();
      fixtures.setMatrixAt(i, dummy.matrix);
      fixtures.setColorAt(i, new T.Color(i < 24 ? 0x6c7869 : 0x8a866b));
    }
    for (let i = 0; i < 2; i++) {
      dummy.position.set(5.7, 1.8, i ? 0.9 : -0.9);
      dummy.scale.set(0.06, 1.9, 0.04);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      fixtures.setMatrixAt(42 + i, dummy.matrix);
      fixtures.setColorAt(42 + i, new T.Color(0x4e6460));
    }
    this.root.add(fixtures);

    // Distinct diagonal drag trail: one merged mesh, no new collision wall.
    const streaks: T.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new T.PlaneGeometry(0.06 + rand() * 0.09, 1.1);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-0.4);
      g.translate(-3.7 + i * 0.24, 0.006, -2 + i * 0.85);
      streaks.push(g);
    }
    this.root.add(
      new T.Mesh(
        mergeGeometries(streaks),
        new T.MeshBasicMaterial({
          color: 0x351e1b,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      ),
    );
    streaks.forEach((g) => g.dispose());
    for (const side of [-1, 1]) {
      const fan = new T.Group();
      fan.position.set(side * 5.9, 2.9, side * -4.7);
      fan.rotation.y = (side * Math.PI) / 2;
      const ring = new T.Mesh(new T.TorusGeometry(0.39, 0.035, 5, 12), steel);
      fan.add(ring);
      const rotor = new T.Group();
      const blades = new T.InstancedMesh(
        new T.BoxGeometry(0.55, 0.11, 0.025),
        steel,
        3,
      );
      for (let i = 0; i < 3; i++) {
        dummy.position.set(
          Math.cos(i * 2.094) * 0.15,
          Math.sin(i * 2.094) * 0.15,
          0,
        );
        dummy.rotation.set(0, 0, i * 2.094);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        blades.setMatrixAt(i, dummy.matrix);
      }
      const mergedFanParts: T.BufferGeometry[] = [ring.geometry.clone()];
      for (let i = 0; i < 3; i++) {
        const matrix = new T.Matrix4();
        blades.getMatrixAt(i, matrix);
        mergedFanParts.push(blades.geometry.clone().applyMatrix4(matrix));
      }
      rotor.add(new T.Mesh(mergeGeometries(mergedFanParts), steel));
      mergedFanParts.forEach((g) => g.dispose());
      fan.remove(ring);
      ring.geometry.dispose();
      blades.geometry.dispose();
      blades.dispose();
      fan.add(rotor);
      this.fans.push(rotor);
      this.root.add(fan);
    }
    const clothMat = new T.MeshStandardMaterial({
      color: room === "lavanderia" ? 0x9caeaa : 0x657d72,
      roughness: 0.95,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    clothMat.forceSinglePass = true;
    clothMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = "uniform float uWind;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed.z += sin(position.y*3.1+uWind*1.4+position.x)*0.06*(1.0-(position.y+1.0)/2.0);",
      );
    };
    const clothGeo = new T.PlaneGeometry(1.45, 2, 3, 5);
    for (const side of [-1, 1]) {
      const c = new T.Mesh(clothGeo, clothMat);
      c.position.set(side * 5.4, 2.0, side * 2.7);
      c.rotation.y = (side * Math.PI) / 2;
      this.cloth.push(c);
      this.root.add(c);
    }
    const puddle = new T.Mesh(
      new T.CircleGeometry(0.8, 12),
      new T.MeshStandardMaterial({
        color: theme.color,
        metalness: 0.65,
        roughness: 0.13,
        transparent: true,
        opacity: 0.5,
      }),
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1, 0.55, 1);
    puddle.position.set(4.9, 0.008, -2.4);
    this.root.add(puddle);
    for (let i = 0; i < 2; i++) {
      const ripple = new T.Mesh(
        new T.RingGeometry(0.17, 0.19, 14),
        new T.MeshBasicMaterial({
          color: 0x8daba4,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(4.9, 0.012 + i * 0.001, -2.4);
      ripple.name = "ripple";
      ripple.userData.phase = i * 0.5;
      this.root.add(ripple);
    }
    // Cheap spatial columns under practical lights, no extra shadow pass.
    for (const side of [-1, 1]) {
      const beam = new T.Mesh(
        new T.ConeGeometry(0.85, 2.7, 8, 1, true),
        new T.MeshBasicMaterial({
          color: theme.color,
          transparent: true,
          opacity: 0.024,
          depthWrite: false,
          side: T.DoubleSide,
          blending: T.AdditiveBlending,
        }),
      );
      beam.position.set(side * 4, 2, side * -4.5);
      this.beams.add(beam);
    }
    this.root.add(this.beams);
    this.screenCanvas = document.createElement("canvas");
    this.screenCanvas.width = 128;
    this.screenCanvas.height = 64;
    this.screenTexture = new T.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = T.SRGBColorSpace;
    this.crt = new T.Mesh(
      new T.PlaneGeometry(0.6, 0.34),
      new T.MeshBasicMaterial({ map: this.screenTexture, color: theme.color }),
    );
    this.crt.position.set(-5.65, 1.4, -1.7);
    this.crt.rotation.y = Math.PI / 2;
    this.root.add(box(0.42, 0.54, 0.8, steel, -5.95, 1.4, -1.7), this.crt);
    this.glass = new T.Mesh(
      new T.PlaneGeometry(1.7, 1.7),
      new T.MeshStandardMaterial({
        color: 0x8fb3ad,
        transparent: true,
        opacity: 0.23,
        roughness: 0.14,
        metalness: 0.25,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    (this.glass.material as T.Material).forceSinglePass = true;
    this.glass.position.set(5.7, 1.8, 0);
    this.glass.rotation.y = -Math.PI / 2;
    this.glass.visible = !s.ambience?.broken.includes(room);
    this.glass.name = "vidro-quebravel";
    this.root.add(this.glass);

    const wheelParts: T.BufferGeometry[] = [];
    const part = (g: T.BufferGeometry, x: number, y: number, z: number) => {
      g.translate(x, y, z);
      wheelParts.push(g);
    };
    part(new T.BoxGeometry(0.48, 0.08, 0.45), 0, 0.45, 0);
    part(new T.BoxGeometry(0.48, 0.5, 0.07), 0, 0.72, -0.2);
    for (const x of [-0.32, 0.32]) {
      const g = new T.TorusGeometry(0.32, 0.03, 4, 10);
      g.rotateY(Math.PI / 2);
      part(g, x, 0.33, 0);
    }
    const chair = new T.Mesh(mergeGeometries(wheelParts), steel);
    wheelParts.forEach((g) => g.dispose());
    this.addBody(chair, "cadeira", -4.65, 4.1);
    this.litter = new T.InstancedMesh(
      new T.CylinderGeometry(1, 1, 1, 6),
      material(0x7a8a76, 0.7, 0.2),
      4,
    );
    this.root.add(this.litter);
    for (let i = 0; i < 4; i++) {
      const proxy = new T.Object3D();
      proxy.scale.set(0.065, i % 2 ? 0.27 : 0.15, 0.065);
      this.addBody(
        proxy,
        i % 2 ? "garrafa" : "lata",
        i < 2 ? 0.7 + i * 0.2 : 4.5,
        3.5 - i * 0.8,
      );
      this.litter.setColorAt(i, new T.Color(i % 2 ? 0x496a58 : 0x8c8273));
    }
    const paper = new T.Mesh(
      new T.PlaneGeometry(0.23, 0.32),
      new T.MeshBasicMaterial({ color: 0xb4ad8a, side: T.DoubleSide }),
    );
    paper.rotation.x = -Math.PI / 2;
    this.addBody(paper, "papel", -0.7, 4.1);
    const animalParts: T.BufferGeometry[] = [];
    const animalBody = new T.SphereGeometry(1, 6, 4);
    animalBody.scale(0.09, 0.035, 0.17);
    animalParts.push(animalBody);
    const animalHead = new T.SphereGeometry(0.05, 5, 3);
    animalHead.translate(0, 0.01, 0.16);
    animalParts.push(animalHead);
    if (theme.fauna === "ratos") {
      const tail = new T.CylinderGeometry(0.007, 0.003, 0.23, 4);
      tail.rotateX(Math.PI / 2);
      tail.translate(0, 0, -0.23);
      animalParts.push(tail);
    } else
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++) {
          const leg = new T.BoxGeometry(0.12, 0.008, 0.01);
          leg.translate(side * 0.075, 0, -0.08 + j * 0.07);
          animalParts.push(leg);
        }
    this.animals = new T.InstancedMesh(
      mergeGeometries(animalParts),
      material(0x252c25, 0.95),
      3,
    );
    animalParts.forEach((g) => g.dispose());
    this.root.add(this.animals);
    for (let i = 0; i < 3; i++) {
      const a = new T.Object3D();
      a.scale.setScalar(theme.fauna === "ratos" ? 1 : 0.4);
      a.position.set((i % 2 ? 1 : -1) * 5.1, 0.05, -3 + i * 3);
      this.root.add(a);
      this.fauna.push({
        x: a.position.x,
        z: a.position.z,
        vx: 0,
        vz: 0,
        angle: 0,
        mesh: a,
      });
    }
    this.impacts = new T.InstancedMesh(
      new T.PlaneGeometry(0.085, 0.085),
      new T.MeshBasicMaterial({
        color: 0x161d1c,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
      16,
    );
    this.impacts.count = 0;
    this.root.add(this.impacts);
    const silhouette = new T.Shape();
    silhouette.moveTo(-0.12, 0);
    silhouette.lineTo(-0.26, 0.05);
    silhouette.lineTo(-0.18, 0.65);
    silhouette.lineTo(-0.38, 0.82);
    silhouette.lineTo(-0.3, 0.95);
    silhouette.lineTo(-0.14, 1.2);
    silhouette.lineTo(0.14, 1.2);
    silhouette.lineTo(0.3, 0.95);
    silhouette.lineTo(0.38, 0.82);
    silhouette.lineTo(0.18, 0.65);
    silhouette.lineTo(0.26, 0.05);
    silhouette.lineTo(0.12, 0);
    silhouette.lineTo(0, 0.5);
    silhouette.closePath();
    const head = new T.CircleGeometry(0.15, 10);
    head.translate(0, 1.38, 0);
    const torso = new T.ShapeGeometry(silhouette);
    const shadowGeo = mergeGeometries([head, torso]);
    head.dispose();
    torso.dispose();
    this.shadow = new T.Mesh(
      shadowGeo,
      new T.MeshBasicMaterial({
        color: 0x020707,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.shadow.position.set(-4, 0.1, -8.65);
    this.shadow.visible = false;
    this.root.add(this.shadow);
    // Scripted cot/door panel only becomes visible during the one-shot event.
    this.eventProp.add(
      box(1.8, 0.14, 0.6, steel, 0, 0.7, 0),
      box(1.7, 0.12, 0.55, material(0x909a87), 0, 0.84, 0),
    );
    for (const x of [-0.7, 0.7])
      this.eventProp.add(box(0.06, 0.6, 0.5, steel, x, 0.35, 0));
    this.eventProp.position.set(-4, 0, -4);
    this.eventProp.visible = false;
    this.root.add(this.eventProp);
    this.eventDoor.position.set(-5.9, 0, -6.3);
    this.eventDoor.add(
      box(1.35, 2.6, 0.09, material(0x4a5d52), 0.675, 1.3, 0),
      box(0.15, 0.05, 0.05, steel, 1.2, 1.2, 0.07),
    );
    this.eventDoor.visible = theme.event === "porta";
    this.root.add(this.eventDoor);
    if (room === "recepcao") {
      const phoneParts: T.BufferGeometry[] = [];
      for (const [w, h, d, x, y, z] of [
        [0.4, 0.09, 0.28, 0, 0, 0],
        [0.38, 0.055, 0.07, 0, 0.09, -0.06],
        [0.09, 0.08, 0.14, -0.15, 0.06, -0.06],
        [0.09, 0.08, 0.14, 0.15, 0.06, -0.06],
      ]) {
        const g = new T.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        phoneParts.push(g);
      }
      this.phone.add(
        new T.Mesh(mergeGeometries(phoneParts), material(0x192d29, 0.6, 0.2)),
      );
      phoneParts.forEach((g) => g.dispose());
      this.phone.position.set(-1.4, 1.4, -0.6);
      this.root.add(this.phone);
    }
    this.flyingPaper = new T.Mesh(
      new T.PlaneGeometry(0.24, 0.32),
      new T.MeshBasicMaterial({ color: 0xaaa68c, side: T.DoubleSide }),
    );
    this.root.add(this.flyingPaper);
    const pos = new Float32Array(160 * 3),
      seeds = new Float32Array(160);
    for (let i = 0; i < 160; i++) {
      pos[i * 3] = rand() * 11 - 5.5;
      pos[i * 3 + 1] = rand() * 3.5;
      pos[i * 3 + 2] = rand() * 15 - 7.5;
      seeds[i] = rand();
    }
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    pg.setAttribute("aSeed", new T.BufferAttribute(seeds, 1));
    pg.boundingSphere = new T.Sphere(new T.Vector3(), 11);
    this.particleMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new T.Color(theme.color) },
        uLight: { value: 1 },
        uPlayer: { value: new T.Vector3() },
        uDirection: { value: new T.Vector3(0, 0, -1) },
        uShards: { value: 0 },
      },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uLight; uniform vec3 uPlayer; uniform vec3 uDirection; uniform float uShards; varying float vAlpha; varying float vKind;
    void main(){vec3 p=position;float k=mod(floor(aSeed*1000.0),5.0);vKind=k;vAlpha=0.32;
    if(k<0.5){p.y=mod(p.y+uTime*0.025,3.6);p.x+=sin(uTime*.3+aSeed*30.0)*.15;}
    else if(k<1.5){p=vec3(4.9,3.4-fract(uTime*.7+aSeed)*3.4,-2.4);vAlpha=.5;}
    else if(k<2.5){float t=fract(uTime*.13+aSeed);p=vec3(5.7+sin(aSeed*40.0+t*4.0)*.2,1.0+t*2.0,1.0+cos(aSeed*32.0+t*3.0)*.25);vAlpha=(1.0-t)*.16;}
    else if(k<3.5){p=vec3(-5.8,2.5,-3.0)+vec3(sin(aSeed*20.0)*.3,-fract(uTime+aSeed)*.5,cos(aSeed*18.0)*.3);vAlpha=step(.96,sin(uTime*1.7))*0.75;}
    else {p+=vec3(sin(uTime*2.0+aSeed*40.0)*.3,cos(uTime*3.0+aSeed*30.0)*.12,cos(uTime+aSeed*50.0)*.3);vec3 away=p-uPlayer;float d=length(away);if(uLight>.5&&d<6.0&&dot(normalize(away+vec3(.001)),uDirection)>.7)p+=normalize(away+vec3(.001))*1.2;vAlpha=.5;}
    if(uShards>0.0 && k>2.5){p=vec3(5.6-uShards*(1.0+aSeed),max(.02,1.8-uShards*uShards*2.0),aSeed*1.6-.8);vAlpha=.7;}
    if(k<.5)vAlpha*=.3+.7*step(.75,dot(normalize(p-uPlayer+vec3(.001)),uDirection))*uLight;
    vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((k>1.5&&k<2.5?90.0:12.0)/max(1.0,-mv.z),1.0,14.0);}`,
      fragmentShader: `uniform vec3 uColor;varying float vAlpha;varying float vKind;void main(){float a=1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));vec3 c=vKind>2.5&&vKind<3.5?vec3(1.,.5,.13):vKind>3.5?vec3(.06,.07,.06):uColor;gl_FragColor=vec4(c,a*vAlpha);}`,
    });
    this.particles = new T.Points(pg, this.particleMat);
    this.root.add(this.particles);
    this.batchBodies();
    this.drawImpacts(s);
    // Freeze room-owned static transforms. GPU wind/Points need uniforms, not
    // per-frame world-matrix traversal. Moving subtrees explicitly opt out.
    const dynamic = new Set<T.Object3D>([
      ...this.reactors.map((b) => b.mesh),
      ...this.fauna.map((a) => a.mesh),
      ...this.fans,
      this.eventProp,
      this.eventDoor,
      this.phone,
      this.shadow,
      this.flyingPaper,
      ...this.root.children.filter((o) => o.name === "ripple"),
    ]);
    const freeze = (o: T.Object3D) => {
      if (dynamic.has(o)) return;
      o.updateMatrix();
      o.matrixAutoUpdate = false;
      o.children.forEach(freeze);
    };
    freeze(this.root);
  }
  batchBodies() {
    this.reactors
      .filter((b) => b.kind === "lata" || b.kind === "garrafa")
      .forEach((b, i) => {
        b.mesh.updateMatrix();
        this.litter.setMatrixAt(i, b.mesh.matrix);
      });
    this.litter.instanceMatrix.needsUpdate = true;
    this.fauna.forEach((a, i) => {
      a.mesh.updateMatrix();
      this.animals.setMatrixAt(i, a.mesh.matrix);
    });
    this.animals.instanceMatrix.needsUpdate = true;
  }
  addBody(mesh: T.Object3D, kind: string, x: number, z: number) {
    mesh.position.set(
      x,
      kind === "cadeira" ? 0 : kind === "papel" ? 0.025 : 0.12,
      z,
    );
    this.root.add(mesh);
    this.reactors.push({ x, z, vx: 0, vz: 0, angle: 0, kind, mesh });
  }
  drawImpacts(s: GameState) {
    const marks = s.ambience?.impacts[this.room] || [];
    if (this.decalCount === marks.length && this.lastImpact === marks.at(-1))
      return;
    const dummy = new T.Object3D();
    marks.forEach((m, i) => {
      dummy.position.set(m.x, m.y, m.z);
      dummy.rotation.set(0, 0, 0);
      if (!m.wall) {
        dummy.rotation.x = -Math.PI / 2;
        dummy.position.y = 0.017;
      } else if (Math.abs(m.x) > 6) {
        dummy.rotation.y = m.x > 0 ? -Math.PI / 2 : Math.PI / 2;
        dummy.position.x += m.x > 0 ? -0.015 : 0.015;
      } else {
        dummy.rotation.y = m.z < 0 ? 0 : Math.PI;
        dummy.position.z += m.z < 0 ? 0.015 : -0.015;
      }
      dummy.updateMatrix();
      this.impacts.setMatrixAt(i, dummy.matrix);
    });
    this.impacts.count = marks.length;
    this.impacts.instanceMatrix.needsUpdate = true;
    this.decalCount = marks.length;
    this.lastImpact = marks.at(-1);
  }
  shot(
    s: GameState,
    origin: T.Vector3,
    direction: T.Vector3,
    point?: T.Vector3,
    surfaceImpact = true,
  ) {
    const ray = new T.Ray(origin, direction),
      endpoint = point?.distanceTo(origin) ?? 16;
    for (const b of this.reactors) {
      const p = new T.Vector3(b.x, 0.15, b.z);
      if (
        ray.distanceToPoint(p) < 0.45 &&
        p.distanceTo(origin) < endpoint + 0.3
      ) {
        b.vx += direction.x * (b.kind === "cadeira" ? 1 : 3);
        b.vz += direction.z * (b.kind === "cadeira" ? 1 : 3);
        this.reactiveHits++;
        this.sounds.push({ kind: "impacto", x: b.x, z: b.z });
      }
    }
    const glass = this.glass.visible
      ? new T.Raycaster(origin, direction, 0, endpoint + 0.05).intersectObject(
          this.glass,
        )[0]
      : undefined;
    if (glass) {
      s.ambience ??= { impacts: {}, broken: [] };
      if (!s.ambience.broken.includes(this.room))
        s.ambience.broken.push(this.room);
      this.glass.visible = false;
      this.shards = 0.01;
      this.sounds.push({ kind: "vidro", x: 5.7, z: 0 });
    }
    if (point && surfaceImpact) {
      addImpact(s, {
        x: point.x,
        y: Math.max(0, point.y),
        z: point.z,
        wall: point.y > 0.12,
      });
      this.decalCount = -1;
      this.drawImpacts(s);
    }
  }
  update(
    s: GameState,
    dt: number,
    elapsed: number,
    camera: T.Camera,
    prefs: Preferences,
    active: boolean,
    moving: boolean,
  ) {
    const density = ambientDensity(prefs),
      theme = themes[this.room];
    this.time += active ? dt : 0;
    this.wind.value = density ? elapsed : 0;
    this.frustum.setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    this.fans.forEach((f) => {
      if (density && this.frustum.containsPoint(f.parent!.position))
        f.rotation.z += dt * 3.5;
    });
    this.beams.visible = density >= 0.65;
    this.fans.forEach(
      (f, i) => (f.parent!.visible = density >= 0.65 || i === 0),
    );
    this.cloth.forEach((c, i) => (c.visible = density >= 0.65 || i === 0));
    this.flyingPaper.visible = density > 0;
    this.flyingPaper.position.set(
      4.6 + Math.sin(elapsed * 0.3) * 0.7,
      0.7 + Math.sin(elapsed * 0.8) * 0.3,
      2 + Math.sin(elapsed * 0.4),
    );
    this.flyingPaper.rotation.set(
      elapsed * 0.4,
      Math.sin(elapsed * 0.5),
      elapsed * 0.25,
    );
    this.particles.visible = density > 0;
    this.particles.geometry.setDrawRange(0, Math.round(160 * density));
    this.particleMat.uniforms.uTime.value = elapsed;
    this.particleMat.uniforms.uLight.value = s.light && s.battery > 0 ? 1 : 0;
    this.particleMat.uniforms.uPlayer.value.set(s.player.x, 1.3, s.player.z);
    this.particleMat.uniforms.uDirection.value.set(
      Math.sin(s.player.yaw),
      0,
      Math.cos(s.player.yaw),
    );
    this.shards = this.shards > 0 ? this.shards + dt : 0;
    if (this.shards > 1.4) this.shards = 0;
    this.particleMat.uniforms.uShards.value = this.shards;
    for (const o of this.root.children)
      if (o.name === "ripple") {
        const phase = (elapsed * 0.65 + o.userData.phase) % 1;
        o.scale.setScalar(0.2 + phase * 2);
        (o as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>).material.opacity =
          density * (1 - phase) * 0.32;
        o.visible = density > 0;
      }
    this.screenTime += dt;
    if (
      this.screenTime > 0.15 &&
      density &&
      this.frustum.containsPoint(this.crt.position)
    ) {
      this.screenTime = 0;
      const ctx = this.screenCanvas.getContext("2d")!;
      ctx.fillStyle = "#091f1c";
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = "#538d6b";
      for (let y = 0; y < 64; y += 4)
        ctx.fillRect(0, y + Math.sin(elapsed * 3) * 2, 128, 1);
      ctx.fillStyle = "#30533f";
      for (let i = 0; i < 20; i++)
        ctx.fillRect(
          (i * 29 + Math.floor(elapsed * 30)) % 128,
          (i * 17) % 64,
          2,
          1,
        );
      ctx.fillStyle = "#7baa85";
      ctx.font = "10px monospace";
      ctx.fillText(
        this.room === "posto" ? "LEITOS: 12 / 13" : "SEM SINAL · 03:16",
        4,
        26,
      );
      ctx.fillRect((elapsed * 25) % 128, 0, 2, 64);
      this.screenTexture.needsUpdate = true;
    }
    if (active) {
      for (const b of this.reactors) {
        const dx = b.x - s.player.x,
          dz = b.z - s.player.z,
          d = Math.hypot(dx, dz);
        if (moving && d < 0.8) {
          b.vx += (dx / (d || 1)) * dt * 12;
          b.vz += (dz / (d || 1)) * dt * 12;
          this.reactiveHits++;
        }
        integrateBody(b, dt);
        b.mesh.position.x = b.x;
        b.mesh.position.z = b.z;
        if (b.kind !== "cadeira")
          b.mesh.rotation.z = Math.min(0.6, b.angle * 0.1);
        else b.mesh.rotation.y = b.angle * 0.13;
      }
      const dir = new T.Vector3(
        Math.sin(s.player.yaw),
        0,
        Math.cos(s.player.yaw),
      );
      this.animals.visible = density > 0 && theme.fauna !== "moscas";
      for (const a of this.fauna) {
        a.mesh.visible = density > 0 && theme.fauna !== "moscas";
        const dx = a.x - s.player.x,
          dz = a.z - s.player.z,
          d = Math.hypot(dx, dz);
        if (s.light && d < 7 && (dx * dir.x + dz * dir.z) / (d || 1) > 0.7) {
          a.vx = (dx / (d || 1)) * (theme.fauna === "ratos" ? 2 : 1.3);
          a.vz = (dz / (d || 1)) * 2;
          this.faunaFlees++;
        }
        integrateBody(a, dt);
        a.mesh.position.set(a.x, 0.05, a.z);
        a.mesh.rotation.y = Math.atan2(a.vx, a.vz);
      }
      if (claimAmbientEvent(s, this.time, active)) {
        this.lastEvent = theme.event;
        this.eventTime = 0;
        this.sounds.push({ kind: theme.event, x: -4, z: -4 });
      }
    }
    if (this.eventTime >= 0) {
      this.eventTime += active ? dt : 0;
      const t = this.eventTime;
      if (theme.event === "telefone")
        this.phone.rotation.z = t < 2.8 ? Math.sin(t * 50) * 0.012 : 0;
      this.shadow.visible = density > 0 && theme.event === "sombra" && t < 2.2;
      this.shadow.position.x = -4 + t * 3.5;
      this.eventProp.visible = density > 0 && theme.event === "maca" && t < 3.5;
      this.eventProp.position.z = -4 + t * 1.1;
      if (theme.event === "porta" && t < 1)
        this.eventDoor.rotation.y = -Math.sin(t * Math.PI) * 0.7;
      if (t > 4) this.eventTime = -1;
    }
    if (active) this.batchBodies();
    this.drawImpacts(s);
  }
  diagnostics() {
    return {
      room: this.room,
      time: this.time,
      lastEvent: this.lastEvent,
      eventTime: this.eventTime,
      glassBroken: !this.glass.visible,
      decals: this.impacts.count,
      reactiveHits: this.reactiveHits,
      faunaFlees: this.faunaFlees,
      bodies: this.reactors.map((b) => ({
        kind: b.kind,
        x: b.x,
        z: b.z,
        vx: b.vx,
        vz: b.vz,
      })),
      gpuParticles: this.particles.geometry.drawRange.count,
    };
  }
}
