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
};
for (const id of ["pose", "mode", "quality"])
  document.getElementById(id)!.addEventListener("change", change);
preloadPlayer()
  .then(() => {
    view.installPlayer();
    view.load(s.room, s);
    change();
    ready = true;
  })
  .catch((e) => console.error(e));
Object.defineProperty(window, "playerQA", {
  get: () => ({
    ready,
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
