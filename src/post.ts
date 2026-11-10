import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
/** One cheap five-tap glow/grade pass, rather than a large multi-mip bloom chain. */
export class Post {
  composer: EffectComposer;
  grade: ShaderPass;
  constructor(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        resolution: { value: new T.Vector2(800, 600) },
      },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 resolution; varying vec2 vUv;
void main(){vec2 uv=vUv;vec2 delta=(uv-.5)*.0009;vec3 c=texture2D(tDiffuse,uv).rgb;c.r=texture2D(tDiffuse,uv+delta).r;c.b=texture2D(tDiffuse,uv-delta).b;vec2 stepUV=vec2(2.)/resolution;vec3 glow=vec3(0.);glow+=max(texture2D(tDiffuse,uv+vec2(stepUV.x,0.)).rgb-vec3(.85),vec3(0.));glow+=max(texture2D(tDiffuse,uv-vec2(stepUV.x,0.)).rgb-vec3(.85),vec3(0.));glow+=max(texture2D(tDiffuse,uv+vec2(0.,stepUV.y)).rgb-vec3(.85),vec3(0.));glow+=max(texture2D(tDiffuse,uv-vec2(0.,stepUV.y)).rgb-vec3(.85),vec3(0.));c+=glow*.07;float vignette=1.-.28*smoothstep(.2,.72,length(uv-.5));float grain=(fract(sin(dot(uv*resolution,vec2(12.9898,78.233))+floor(time*18.))*43758.5453)-.5)*.008;gl_FragColor=vec4(max(vec3(0.),c*vignette+grain),1.);}`,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  resize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.grade.uniforms.resolution.value.set(w * pixelRatio, h * pixelRatio);
  }
  render(time: number) {
    this.grade.uniforms.time.value = time;
    this.composer.render();
  }
}
