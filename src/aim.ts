import * as T from "three";
import type { Region } from "./logic";
export type ShotHit = {
  id: string;
  region: Region;
  point: T.Vector3;
  distance: number;
};
/** Resolve the actual reticle ray, nearest physical surface first. Also prevent camera-peeking shots through muzzle cover. */
export function raycastShot(
  ray: T.Raycaster,
  hitboxes: T.Object3D[],
  obstacles: T.Object3D[],
  muzzle?: T.Vector3,
): ShotHit | undefined {
  const hits = ray.intersectObjects(hitboxes, false);
  const walls = ray.intersectObjects(obstacles, false);
  const hit = hits[0];
  if (!hit || (walls[0] && walls[0].distance < hit.distance - 0.025)) return;
  if (muzzle) {
    const delta = hit.point.clone().sub(muzzle),
      length = delta.length();
    const block = new T.Raycaster(
      muzzle,
      delta.normalize(),
      0.02,
      Math.max(0.02, length - 0.04),
    ).intersectObjects(obstacles, false);
    if (block.length) return;
  }
  return {
    id: hit.object.userData.enemyId as string,
    region: hit.object.userData.region as Region,
    point: hit.point.clone(),
    distance: hit.distance,
  };
}
export function cameraCollision(
  pivot: T.Vector3,
  desired: T.Vector3,
  obstacles: T.Object3D[],
  padding = 0.22,
) {
  const delta = desired.clone().sub(pivot),
    len = delta.length();
  if (len < 0.001) return desired.clone();
  const ray = new T.Raycaster(
    pivot,
    delta.clone().normalize(),
    0,
    len + padding,
  );
  const hit = ray.intersectObjects(obstacles, false)[0];
  if (!hit) return desired.clone();
  return pivot
    .clone()
    .addScaledVector(
      delta.normalize(),
      Math.max(0.12, Math.min(len, hit.distance - padding)),
    );
}
