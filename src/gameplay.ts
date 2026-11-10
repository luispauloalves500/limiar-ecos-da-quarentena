import { type GameState } from "./logic";
import { rooms, dist, lineClear, slideMove, clearPoint } from "./world";
export function shove(s: GameState) {
  const result: string[] = [];
  if (s.player.hp <= 0) return result;
  for (const e of Object.values(s.enemies)) {
    const d = dist(e, s.player);
    if (
      e.dead ||
      e.boss ||
      e.room !== s.room ||
      d > 1.65 ||
      !lineClear(e, s.player, rooms[s.room].obstacles)
    )
      continue;
    const dx = (e.x - s.player.x) / Math.max(0.01, d),
      dz = (e.z - s.player.z) / Math.max(0.01, d);
    if (dx * Math.sin(s.player.yaw) + dz * Math.cos(s.player.yaw) < 0.1)
      continue;
    slideMove(
      e,
      dx * 0.55,
      dz * 0.55,
      (q) =>
        clearPoint(q, rooms[s.room].obstacles, 0.3) && dist(q, s.player) > 0.6,
    );
    e.state = "stun";
    e.timer = 0.9;
    result.push(e.id);
  }
  return result;
}
