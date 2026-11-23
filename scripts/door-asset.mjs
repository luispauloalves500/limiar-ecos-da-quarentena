// Usage: node scripts/door-asset.mjs porta-recebida.glb out-split.glb
// 0.13: the received door is ONE auto-rigged skinned mesh (SmartRig, 10
// junk bones, no clips). This drops the skin (bind pose == rest pose) and
// splits the primitive by connected component into two static meshes:
//   "frame" = jamb/header + the two hinge barrels (stays on the wall)
//   "leaf"  = leaf, grille, both handles, lock plate (swings on the hinge)
// Then run `gltf-transform optimize` (see docs/MODELOS.md).
const N =
  (process.env.GLTF_MODULES ||
    "/home/box/.npm/_npx/39bd747c6932aaf5/node_modules") + "/";
const { NodeIO } = await import(N + "@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await import(
  N + "@gltf-transform/extensions/dist/index.js"
);
const fn = await import(N + "@gltf-transform/functions/dist/index.js");
const [inp, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot(),
  scene = root.listScenes()[0];
const src = root.listMeshes()[0],
  prim = src.listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray(),
  idx = prim.getIndices().getArray(),
  n = pos.length / 3;
// Union-find over triangles + coincident positions (UV seams split verts).
const par = Int32Array.from({ length: n }, (_, i) => i);
const f = (x) => {
  while (par[x] !== x) x = par[x] = par[par[x]];
  return x;
};
const seen = new Map();
for (let i = 0; i < n; i++) {
  const k = [0, 1, 2].map((a) => pos[i * 3 + a].toFixed(4)).join();
  if (seen.has(k)) par[f(i)] = f(seen.get(k));
  else seen.set(k, i);
}
for (let t = 0; t < idx.length; t += 3)
  for (const v of [idx[t + 1], idx[t + 2]]) par[f(v)] = f(idx[t]);
const box = new Map();
for (let i = 0; i < n; i++) {
  const r = f(i),
    b = box.get(r) || { min: [9, 9, 9], max: [-9, -9, -9] };
  for (let a = 0; a < 3; a++) {
    b.min[a] = Math.min(b.min[a], pos[i * 3 + a]);
    b.max[a] = Math.max(b.max[a], pos[i * 3 + a]);
  }
  box.set(r, b);
}
const isFrame = (b) =>
  b.max[1] - b.min[1] > 1.65 && b.max[0] - b.min[0] > 0.84 // jamb + header
    ? true
    : b.max[0] < -0.34 && b.max[1] - b.min[1] < 0.2; // hinge barrels
const tris = { frame: [], leaf: [] };
for (let t = 0; t < idx.length; t += 3)
  tris[isFrame(box.get(f(idx[t]))) ? "frame" : "leaf"].push(
    idx[t],
    idx[t + 1],
    idx[t + 2],
  );
for (const name of ["frame", "leaf"]) {
  const p = prim.clone();
  p.setAttribute("JOINTS_0", null).setAttribute("WEIGHTS_0", null);
  const ind = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array(tris[name]))
    .setBuffer(root.listBuffers()[0]);
  p.setIndices(ind);
  const m = doc.createMesh(name).addPrimitive(p);
  scene.addChild(doc.createNode(name).setMesh(m));
  console.log(name, tris[name].length / 3, "tris");
}
for (const s of root.listSkins()) s.dispose();
for (const node of root.listNodes())
  if (!["frame", "leaf"].includes(node.getName())) node.dispose();
src.dispose();
// Each mesh keeps only the vertices its triangles use.
for (const m of root.listMeshes())
  for (const p of m.listPrimitives()) fn.compactPrimitive(p);
await doc.transform(fn.prune(), fn.dedup());
await io.write(out, doc);
