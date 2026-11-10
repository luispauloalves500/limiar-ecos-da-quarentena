import * as T from "three";
import { View } from "./render";
import { preloadZombie, zombieDiagnostics } from "./zombie";
import { newGame, killEnemy, updateCorpses, type GameState } from "./logic";
import { defaults, type CameraMode, type Quality } from "./controls";
const view = new View(document.getElementById("scene")!),
  params = new URLSearchParams(location.search);
const input = (id: string) => document.getElementById(id) as HTMLSelectElement;
for (const id of ["model", "count", "mode", "quality", "pose"]) {
  const p = params.get(id);
  if (p) input(id).value = p;
}
let state: GameState = newGame(),
  ready = false,
  frames = 0,
  last = performance.now(),
  started = last;
const intervals: number[] = [];
function rebuild() {
  const count = Number(input("count").value),
    pose = input("pose").value;
  state = newGame();
  state.room = "isolamento";
  state.player = { x: 0, z: count === 1 ? 3.8 : 6, hp: 100, yaw: Math.PI };
  state.battery = 100;
  state.enemies = {};
  const base = newGame().enemies.errante01;
  for (let i = 0; i < count; i++) {
    const e = {
      ...base,
      id: "qa-" + i,
      room: state.room,
      x: count === 1 ? 0 : ((i % 3) - 1) * 1.7,
      z: count === 1 ? 0 : i < 3 ? -3 : 0.5,
      timer: 1,
    };
    e.state =
      pose === "AttackBite" || pose === "CrawlAttack"
        ? "windup"
        : pose === "LightStun"
          ? "stun"
          : "chase";
    e.crawl = ["Crawl", "CrawlAttack", "LegFall"].includes(pose);
    if (pose.startsWith("Death")) {
      killEnemy(e);
      e.headGone = pose === "DeathHead";
    }
    state.enemies[e.id] = e;
  }
  view.proceduralZombies = input("model").value === "procedural";
  view.animationPreview = pose;
  view.setPreferences({
    ...defaults,
    mode: input("mode").value as CameraMode,
    quality: input("quality").value as Quality,
  });
  view.load(state.room, state);
  frames = 0;
  intervals.length = 0;
  started = performance.now();
}
for (const id of ["model", "count", "mode", "quality", "pose"])
  input(id).addEventListener("change", () => {
    if (ready) rebuild();
  });
document.getElementById("lookaway")!.addEventListener("click", () => {
  view.yaw += Math.PI;
});
document.getElementById("restart")!.addEventListener("click", () => {
  if (ready) rebuild();
});
preloadZombie()
  .then(() => {
    ready = true;
    rebuild();
  })
  .catch((e) => {
    document.getElementById("status")!.textContent = String(e);
    console.error(e);
  });
function frame(now: number) {
  requestAnimationFrame(frame);
  const delta = (now - last) / 1000;
  last = now;
  if (!ready) return;
  updateCorpses(state);
  view.update(state, Math.min(0.1, delta), false, true, false);
  if (Number(input("count").value) === 1) view.player.root.visible = false;
  view.render();
  frames++;
  intervals.push(delta * 1000);
  if (intervals.length > 1200) intervals.shift();
  document.getElementById("status")!.textContent =
    `${view.worldObjects().actors.length} ativos · ${view.renderer.info.render.calls} draws · ${view.renderer.info.render.triangles} tris`;
}
Object.defineProperty(window, "zombieQA", {
  get: () => {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      skeletons = new Set<T.Skeleton>();
    let meshes = 0;
    for (const a of view.enemyMeshes.values())
      a.root.traverse((o) => {
        if (o instanceof T.SkinnedMesh) {
          meshes++;
          geometries.add(o.geometry);
          skeletons.add(o.skeleton);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
    const a = [...view.enemyMeshes.values()][0],
      head = a?.hitboxes.find((h) => h.userData.region === "head"),
      pos = head?.getWorldPosition(new T.Vector3());
    return {
      ready,
      asset: zombieDiagnostics(),
      model: input("model").value,
      count: Number(input("count").value),
      mode: input("mode").value,
      quality: input("quality").value,
      pose: input("pose").value,
      frames,
      elapsed: performance.now() - started,
      intervals: [...intervals],
      objects: view.worldObjects(),
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
      meshInstances: meshes,
      uniqueGeometries: geometries.size,
      uniqueMaterials: materials.size,
      uniqueSkeletons: skeletons.size,
      headPosition: pos?.toArray(),
      headRegion: head?.userData.region,
      renderer: view.renderer.info.memory,
    };
  },
});
requestAnimationFrame(frame);
