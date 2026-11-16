// QA gallery for B02: deterministic poses for screenshots and review.
import { View } from "./render";
import { newGame, killEnemy, type GameState } from "./logic";
import { defaults } from "./controls";
import { MOVE, MOVES } from "./preceptora-logic";
const view = new View(document.getElementById("scene")!),
  params = new URLSearchParams(location.search);
const input = (id: string) => document.getElementById(id) as HTMLSelectElement;
for (const id of ["pose", "cam", "model"]) {
  const p = params.get(id);
  if (p) input(id).value = p;
}
const progress = Number(params.get("progress") ?? 0.8);
const deathMs = Number(params.get("death") ?? 2600);
let s: GameState = newGame(),
  t0 = performance.now(),
  last = t0,
  frames = 0;
function setup() {
  s = newGame();
  s.room = "circulo";
  for (const e of Object.values(s.enemies)) {
    e.dead = true;
    e.hp = 0;
    e.removed = true;
  }
  const b = s.enemies.preceptora;
  Object.assign(b, {
    dead: false,
    removed: false,
    hp: 700,
    x: 0,
    z: -3,
    state: "chase",
    attack: 0,
    timer: 0,
    vulnerable: 0,
    dx: 0,
    dz: 1,
  });
  const cam = input("cam").value;
  const dz = cam === "close" ? 2.3 : cam === "mid" ? 3.6 : 6.5;
  s.player = { x: 0.35, z: -3 + dz, hp: 100, yaw: Math.PI };
  s.flags = { prontuarios: true };
  view.legacyPreceptora = input("model").value === "legacy";
  view.setPreferences({ ...defaults, mode: "shoulder", quality: "medium" });
  view.load(s.room, s);
  if (input("pose").value === "Death") {
    killEnemy(b, Date.now() - deathMs);
  }
  t0 = last = performance.now();
  frames = 0;
}
function drive(time: number) {
  const b = s.enemies.preceptora,
    pose = input("pose").value;
  if (pose === "Death") {
    // Frozen at `death` ms after the kill (the corpse never times out here).
    b.deathAt = Date.now() - deathMs;
    return;
  }
  const [kind, code] = pose.split("-");
  const spec = MOVES[Number(code)];
  b.state = "chase";
  b.attack = MOVE.NONE;
  b.vulnerable = 0;
  b.dx = 0;
  b.dz = 1;
  if (pose === "Stalk") b.z = -3 + Math.sin(time * 0.6) * 0.7;
  else b.z = -3;
  if (pose === "Wake") {
    b.state = "stun";
    b.timer = 5 * (1 - progress);
  } else if (pose === "Roar") {
    b.state = "stun";
    b.attack = MOVE.ROAR;
    b.timer = 1;
  } else if (pose === "Shock") {
    b.state = "stun";
    b.attack = MOVE.SHOCK;
    b.timer = 1;
    b.vulnerable = 14;
  } else if (pose === "Exposed") b.vulnerable = 10;
  else if (pose === "Hit") {
    b.vulnerable = 10;
    if (Math.floor(time * 1.5) !== Math.floor((time - 1 / 60) * 1.5))
      b.hitSerial = (b.hitSerial || 0) + 1;
  } else if (kind === "Windup" && spec) {
    b.state = "windup";
    b.attack = Number(code);
    b.timer = spec.windup * (1 - progress);
  } else if (kind === "Attack" && spec) {
    b.state = "charge";
    b.attack = Number(code);
    b.timer = spec.active * (1 - progress);
  } else if (kind === "Recover" && spec) {
    b.state = "recover";
    b.attack = Number(code);
    b.timer = spec.recover * (1 - progress);
  }
}
for (const id of ["pose", "cam", "model"])
  input(id).addEventListener("change", setup);
setup();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  drive((now - t0) / 1000);
  view.update(s, dt, false, true, false);
  if (params.get("helena") !== "1") view.player.root.visible = false;
  view.render();
  frames++;
  document.getElementById("status")!.textContent =
    `${view.renderer.info.render.calls} draws · ${view.renderer.info.render.triangles} tris`;
}
Object.defineProperty(window, "preceptoraQA", {
  get: () => {
    const a = view.enemyMeshes.get("preceptora");
    return {
      frames,
      pose: input("pose").value,
      model: input("model").value,
      state: a?.animation?.stateName,
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
    };
  },
});
requestAnimationFrame(frame);
