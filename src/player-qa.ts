import { View } from "./render";
import { newGame } from "./logic";
import { defaults, type CameraMode, type Quality } from "./controls";
import { preloadPlayer, playerDiagnostics } from "./player";
const canvas = document.querySelector<HTMLElement>("#game")!,
  view = new View(canvas),
  s = newGame();
s.player.x = 0;
s.player.z = 3;
s.player.yaw = Math.PI;
s.room = "posto";
const get = (id: string) =>
  (document.getElementById(id) as HTMLSelectElement).value;
const params = new URLSearchParams(location.search);
for (const id of ["pose", "mode", "quality"]) {
  const v = params.get(id);
  if (v) (document.getElementById(id) as HTMLSelectElement).value = v;
}
let frames = 0;
let ready = false,
  pose = "PlayerIdle",
  last = performance.now();
const change = () => {
  pose = get("pose");
  view.playerAnimationPreview = pose;
  view.playerAnimation?.trigger(pose);
  if (view.playerAnimation)
    view.playerAnimation.previewAt =
      pose === "Fire" ? 0.08 : pose === "Reload" ? 0.55 : undefined;
  view.setPreferences({
    ...defaults,
    mode: get("mode") as CameraMode,
    quality: get("quality") as Quality,
  });
  view.syncCamera(s.player);
  // 0.11 review: ?orbit=rad turns Helena under the fixed camera (side/front
  // views); locomotion poses get a real ground speed so stride sync and the
  // walk layers run as in game.
  s.player.yaw = Math.PI + Number(params.get("orbit") ?? 0);
  if (params.get("pitch")) view.pitch = Number(params.get("pitch"));
  const speeds: Record<string, number> = {
    Walking: 2.2,
    Running: 3.7,
    Sneaky_Walk_inplace: 1.43,
    InjuredWalk: 1.9,
    WalkAim: 0.88,
  };
  const v = speeds[pose];
  view.playerFrame = {
    running: pose === "Running",
    cautious: pose === "Sneaky_Walk_inplace",
    reloading: pose === "Reload",
    ...(v ? { localX: 0, localZ: v } : {}),
  } as typeof view.playerFrame;
};
for (const id of ["pose", "mode", "quality"])
  document.getElementById(id)!.addEventListener("change", change);
preloadPlayer()
  .then(() => {
    view.installPlayer();
    if (view.playerAnimation && params.get("style") === "0")
      view.playerAnimation.styleOff = true;
    view.load(s.room, s);
    change();
    ready = true;
  })
  .catch((e) => console.error(e));
Object.defineProperty(window, "playerQA", {
  get: () => ({
    ready,
    frames,
    asset: playerDiagnostics(),
    pose,
    mode: get("mode"),
    animation: view.playerAnimation?.diagnostic(),
    drawCalls: view.renderer.info.render.calls,
    triangles: view.renderer.info.render.triangles,
  }),
});
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!ready) return;
  frames++;
  const aim = ["Aim", "WalkAim", "Fire", "Reload"].includes(pose);
  view.update(
    s,
    dt,
    [
      "Walking",
      "Running",
      "WalkAim",
      "InjuredWalk",
      "Sneaky_Walk_inplace",
    ].includes(pose),
    aim,
    false,
  );
  if (pose === "Fire") view.recoil = 1;
  view.render();
  document.getElementById("status")!.textContent = JSON.stringify(
    view.playerAnimation?.diagnostic(),
    null,
    1,
  );
}
requestAnimationFrame(frame);
