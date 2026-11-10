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
  padding = 0.34,
) {
  const delta = desired.clone().sub(pivot),
    len = delta.length();
  if (len < 0.001) return desired.clone();
  const direction = delta.clone().normalize();
  const right = new T.Vector3()
    .crossVectors(direction, new T.Vector3(0, 1, 0))
    .normalize()
    .multiplyScalar(0.16);
  const up = new T.Vector3(0, 0.13, 0);
  let distance = len;
  // Five probes approximate the near-plane volume, not just the centre ray.
  for (const offset of [
    new T.Vector3(),
    right,
    right.clone().negate(),
    up,
    up.clone().negate(),
  ]) {
    const hit = new T.Raycaster(
      pivot.clone().add(offset),
      direction,
      0,
      len + padding,
    ).intersectObjects(obstacles, false)[0];
    if (hit)
      distance = Math.min(distance, Math.max(0.12, hit.distance - padding));
  }
  return pivot.clone().addScaledVector(direction, distance);
}
