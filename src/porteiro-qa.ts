// 0.11 QA gallery for the Porteiro (B01 GLB): looping poses for review.
import { Vector3 } from "three";
import { View } from "./render";
import { newGame, killEnemy, type GameState } from "./logic";
import { defaults } from "./controls";
import { preloadPorteiro } from "./smartrig";
import { preloadPlayer } from "./player";
const view = new View(document.getElementById("scene")!),
  params = new URLSearchParams(location.search);
const input = (id: string) => document.getElementById(id) as HTMLSelectElement;
for (const id of ["pose", "cam", "model"]) {
  const p = params.get(id);
  if (p) input(id).value = p;
}
const progress = Number(params.get("progress") ?? 0.8);
const deathMs = Number(params.get("death") ?? 2600);
const ID = "porteiro";
let s: GameState = newGame(),
  t0 = performance.now(),
  last = t0,
  frames = 0;
function setup() {
  s = newGame();
  s.room = "atrio";
  s.flags = { energia: true, chave: true, fusivel: true };
  for (const e of Object.values(s.enemies)) {
    e.dead = true;
    e.hp = 0;
    e.removed = true;
  }
  const b = s.enemies[ID];
  Object.assign(b, {
    dead: false,
    removed: false,
    hp: 560,
    x: 0,
    z: -3,
    state: "chase",
    timer: 0,
    dx: 0,
    dz: 1,
    vulnerable: 0,
  });
  const cam = input("cam").value;
  s.player =
    cam === "side"
      ? { x: 4.2, z: -3.0, hp: 100, yaw: -Math.PI / 2 }
      : cam === "back"
        ? { x: 0.2, z: -7.0, hp: 100, yaw: 0 }
        : {
            x: 0.3,
            z: -3 + Number(params.get("dist") ?? (cam === "close" ? 3.2 : 5)),
            hp: 100,
            yaw: Math.PI,
          };
  view.porteiroModel = input("model").value === "glb" ? "glb" : "procedural";
  view.setPreferences({ ...defaults, mode: "shoulder", quality: "medium" });
  view.load(s.room, s);
  if (input("pose").value === "Death") killEnemy(b, Date.now() - deathMs);
  view.yaw += Number(params.get("orbit") ?? 0);
  if (params.get("pitch")) view.pitch = Number(params.get("pitch"));
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
  b.vulnerable = 0;
  const toPlayer =
    pose === "Slam" || pose === "Dash" || pose === "Strike"
      ? 0
      : Math.atan2(s.player.x - b.x, s.player.z - b.z);
  b.dx = Math.sin(toPlayer);
  b.dz = Math.cos(toPlayer);
  b.z = -3;
  if (pose === "Walk") {
    // Walk across the hall on a loop at B01 speed (1.2 m/s, 3 m per pass).
    const k = (time % 2.5) / 2.5;
    b.z = -4.5 + k * 3;
    b.dx = 0;
    b.dz = 1;
  } else if (pose === "Slam" || pose === "Dash") {
    b.state = "windup";
    b.attack = pose === "Dash" ? 1 : 0;
    b.timer =
      1.2 * (1 - (params.get("progress") ? progress : (time % 1.6) / 1.6));
  } else if (pose === "Strike") {
    b.attack = 0;
    b.state = time % 3 < 1.2 ? "windup" : "recover";
    b.timer = Math.max(0, 1.2 - (time % 3));
  } else if (pose === "Shock") {
    b.state = "stun";
    b.vulnerable = 4;
  } else if (pose === "Exposed") b.vulnerable = 3;
  else if (pose === "Hit") {
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
await preloadPorteiro();
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
(window as unknown as { __view: unknown }).__view = view;
Object.defineProperty(window, "porteiroQA", {
  get: () => {
    const a = view.enemyMeshes.get(ID);
    return {
      frames,
      pose: input("pose").value,
      model: input("model").value,
      glb: !!a?.root.userData.glb,
      state: a?.animation?.stateName,
      // World position of both toes (foot-slide check in QA).
      feet: a
        ? ["Bone_010", "Bone_015"].map((n) => {
            const v = new Vector3();
            a.root.getObjectByName(n)?.getWorldPosition(v);
            return [v.x, v.y, v.z];
          })
        : [],
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
    };
  },
});
requestAnimationFrame(frame);
