import * as T from "three";
import { box, capsule, material as mat, seeded } from "./art";
export class TitleScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, 1, 0.1, 40);
  rain: T.Points<T.BufferGeometry, T.ShaderMaterial>;
  lamp: T.PointLight;
  constructor(wall: T.Texture, floor: T.Texture) {
    this.scene.background = new T.Color(0x040a0c);
    this.scene.fog = new T.FogExp2(0x071519, 0.045);
    this.scene.add(new T.HemisphereLight(0x7d9f9b, 0x18251e, 0.8));
    const plaster = mat(0x596b62, 0.94, 0, wall),
      tiles = mat(0x485e58, 0.25, 0.15, floor),
      steel = mat(0x334640, 0.6, 0.3);
    this.scene.add(
      box(7, 0.1, 27, tiles, 0, -0.06, -5),
      box(0.2, 4, 27, plaster, -3.6, 2, -5),
      box(0.2, 4, 27, plaster, 3.6, 2, -5),
      box(7, 4, 0.15, plaster, 0, 2, -18),
    );
    for (const z of [-2, -7, -12])
      for (const x of [-3.48, 3.48])
        this.scene.add(
          box(0.08, 2.7, 1.5, steel, x, 1.35, z),
          box(
            0.12,
            0.18,
            0.12,
            mat(0xa28e64, 0.5, 0.5),
            x * 0.98,
            1.2,
            z + 0.45,
          ),
        );
    this.lamp = new T.PointLight(0xc6dec2, 40, 19, 1.7);
    this.lamp.position.set(1, 3.4, -6);
    this.scene.add(this.lamp);
    const rim = new T.PointLight(0x9d5946, 30, 13, 1.5);
    rim.position.set(-2, 2, -13);
    this.scene.add(rim);
    for (const z of [-4, -10])
      this.scene.add(
        box(
          1.8,
          0.07,
          0.2,
          new T.MeshBasicMaterial({ color: 0xabc5b8 }),
          0,
          3.7,
          z,
        ),
      );
    const silhouette = new T.Group(),
      dark = new T.MeshStandardMaterial({ color: 0x172325, roughness: 1 });
    silhouette.add(
      capsule(0.2, 0.7, dark, 0, 1.1, 0),
      new T.Mesh(new T.SphereGeometry(0.14, 10, 8), dark),
    );
    silhouette.children[1].position.y = 1.7;
    for (const x of [-0.13, 0.13])
      silhouette.add(capsule(0.07, 0.65, dark, x, 0.42, 0));
    silhouette.position.set(1, 0, -11);
    this.scene.add(silhouette);
    const rand = seeded(516),
      pos = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++)
      pos.set([rand() * 7 - 3.5, rand() * 4, rand() * 24 - 16], i * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.rain = new T.Points(
      geo,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `uniform float uTime;void main(){vec3 p=position;p.y=mod(p.y-uTime*2.4,4.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.;}`,
        fragmentShader: `void main(){gl_FragColor=vec4(.55,.72,.72,.32);}`,
      }),
    );
    this.scene.add(this.rain);
  }
  update(time: number, aspect: number, low: boolean) {
    this.camera.aspect = aspect;
    this.camera.position.set(1.6 + Math.sin(time * 0.09) * 0.18, 1.7, 6.5);
    this.camera.lookAt(0.1, 1.5, -7);
    this.camera.updateProjectionMatrix();
    this.lamp.intensity = 34 + Math.sin(time * 7) * 3 + Math.sin(time * 21) * 2;
    this.rain.material.uniforms.uTime.value = time;
    this.rain.geometry.setDrawRange(0, low ? 60 : 180);
  }
}
