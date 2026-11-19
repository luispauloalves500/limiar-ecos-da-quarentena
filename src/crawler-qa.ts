// 0.9 QA gallery for the berçário crawler (E05 GLB): frozen poses for review.
import { View } from "./render";
import { newGame, killEnemy, type GameState } from "./logic";
import { defaults } from "./controls";
import { preloadChapter2 } from "./smartrig";
import { preloadPlayer } from "./player";
const view = new View(document.getElementById("scene")!),
  params = new URLSearchParams(location.search);
const input = (id: string) => document.getElementById(id) as HTMLSelectElement;
for (const id of ["pose", "cam", "model"]) {
  const p = params.get(id);
  if (p) input(id).value = p;
}
const progress = Number(params.get("progress") ?? 0.7);
const deathMs = Number(params.get("death") ?? 1400);
const ID = "rastejador05";
let s: GameState = newGame(),
  t0 = performance.now(),
  last = t0,
  frames = 0;
function setup() {
  s = newGame();
  s.room = "bercario";
  for (const e of Object.values(s.enemies)) {
    e.dead = true;
    e.hp = 0;
    e.removed = true;
  }
  const b = s.enemies[ID];
  Object.assign(b, {
    dead: false,
    removed: false,
    hp: 48,
    x: 0,
    z: -3.2,
    state: "chase",
    timer: 0,
    dx: 0,
    dz: 1,
  });
  const cam = input("cam").value;
  s.player =
    cam === "side"
      ? { x: 2.3, z: -3.0, hp: 100, yaw: -Math.PI / 2 }
      : {
          x: 0.3,
          z: -3.2 + Number(params.get("dist") ?? (cam === "close" ? 1.9 : 3.2)),
          hp: 100,
          yaw: Math.PI,
        };
  view.crawlerModel = input("model").value === "glb" ? "glb" : "zombie";
  view.setPreferences({ ...defaults, mode: "shoulder", quality: "medium" });
  view.load(s.room, s);
  if (input("pose").value === "Death") killEnemy(b, Date.now() - deathMs);
  // ?orbit=rad swings the shoulder camera around Helena (size comparison);
  // ?scale= overrides the body scale (0.74 = the 0.9 crawler) for before/after.
  view.yaw += Number(params.get("orbit") ?? 0);
  if (params.get("pitch")) view.pitch = Number(params.get("pitch"));
  const scale = params.get("scale");
  if (scale) view.enemyMeshes.get(ID)?.body.scale.setScalar(Number(scale));
  t0 = last = performance.now();
  frames = 0;
}
function drive(time: number) {
  const b = s.enemies[ID],
    pose = input("pose").value;
  if (pose === "Death") {
    b.deathAt = Date.now() - deathMs;
    return;
  }
  b.state = "chase";
  b.lightStunned = false;
  // Attacks aim along +Z so the "side" camera sees them in profile.
  const toPlayer =
    pose === "Windup" || pose === "Strike"
      ? 0
      : Math.atan2(s.player.x - b.x, s.player.z - b.z);
  b.dx = Math.sin(toPlayer);
  b.dz = Math.cos(toPlayer);
  b.z = -3.2;
  if (pose === "Crawl") {
    // Crawl toward the camera on a loop (sawtooth, 2.2 s per pass).
    const k = (time % 2.2) / 2.2;
    b.z = -4.4 + k * 1.8;
  } else if (pose === "Windup") {
    b.state = "windup";
    b.timer = 0.55 * (1 - progress);
  } else if (pose === "Strike") {
    // Loop: 0.6 s rear-up, then the lunge and recovery.
    b.state = time % 1.8 < 0.6 ? "windup" : "recover";
  } else if (pose === "Stun") {
    b.state = "stun";
    b.lightStunned = true;
  } else if (pose === "Hit") {
    if (Math.floor(time * 1.2) !== Math.floor((time - 1 / 60) * 1.2))
      b.hitSerial = (b.hitSerial || 0) + 1;
  }
}
for (const id of ["pose", "cam", "model"])
  input(id).addEventListener("change", setup);
if (params.get("helena") === "1") {
  await preloadPlayer();
  view.installPlayer();
}
await preloadChapter2();
setup();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  drive((now - t0) / 1000);
  view.update(s, dt, false, true, false);
  view.player.root.visible = params.get("helena") === "1";
  view.render();
  frames++;
  document.getElementById("status")!.textContent =
    `${view.renderer.info.render.calls} draws · ${view.renderer.info.render.triangles} tris`;
}
Object.defineProperty(window, "crawlerQA", {
  get: () => {
    const a = view.enemyMeshes.get(ID);
    return {
      frames,
      pose: input("pose").value,
      model: input("model").value,
      glb: !!a?.root.userData.glb,
      state: a?.animation?.stateName,
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
    };
  },
});
requestAnimationFrame(frame);
