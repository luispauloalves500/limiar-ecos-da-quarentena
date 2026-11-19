// Usage: node scripts/simplify-skinned.mjs in.glb out.glb ratio [permissive]
// LOCK=Bone_a,Bone_b keeps vertices weighted to those bones (face) intact.
// Needs @gltf-transform/{core,extensions,functions} and meshoptimizer; set
// GLTF_MODULES to their node_modules folder (e.g. the npx cache).
const N =
  (process.env.GLTF_MODULES ||
    "/home/box/.npm/_npx/39bd747c6932aaf5/node_modules") + "/";
const { NodeIO } = await import(N + "@gltf-transform/core/dist/index.js");
const { ALL_EXTENSIONS } = await import(
  N + "@gltf-transform/extensions/dist/index.js"
);
const fn = await import(N + "@gltf-transform/functions/dist/index.js");
const { MeshoptSimplifier } = await import(N + "meshoptimizer/index.js");
await MeshoptSimplifier.ready;
const [inp, out, ratio = "0.5", mode = "permissive"] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION").getArray(),
      nor = prim.getAttribute("NORMAL")?.getArray(),
      uv = prim.getAttribute("TEXCOORD_0")?.getArray();
    const idx = prim.getIndices().getArray();
    const n = pos.length / 3;
    const attrs = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      attrs.set(
        [
          nor[i * 3] * 0.5,
          nor[i * 3 + 1] * 0.5,
          nor[i * 3 + 2] * 0.5,
          uv[i * 2] * 1.0,
          uv[i * 2 + 1] * 1.0,
        ],
        i * 5,
      );
    }
    const skin = doc.getRoot().listSkins()[0];
    const names = skin.listJoints().map((j) => j.getName());
    const lockNames = (process.env.LOCK || "Bone_022,Bone_021,Bone_020").split(
      ",",
    );
    const lockIdx = new Set(
      names
        .map((nm, i) => (lockNames.includes(nm) ? i : -1))
        .filter((i) => i >= 0),
    );
    const J = prim.getAttribute("JOINTS_0").getArray(),
      W = prim.getAttribute("WEIGHTS_0").getArray();
    const lock = new Uint8Array(n);
    let locked = 0;
    for (let i = 0; i < n; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++)
        if (lockIdx.has(J[i * 4 + k])) w += W[i * 4 + k];
      if (w > 0.3) {
        lock[i] = 1;
        locked++;
      }
    }
    console.log("locked", locked, [...lockIdx]);
    const target = Math.floor((idx.length * Number(ratio)) / 3) * 3;
    const flags = mode === "permissive" ? ["Permissive"] : [];
    const [res, err] = MeshoptSimplifier.simplifyWithAttributes(
      new Uint32Array(idx),
      new Float32Array(pos),
      3,
      attrs,
      5,
      [0.5, 0.5, 0.5, 1, 1],
      process.env.LOCK === "none" ? null : lock,
      target,
      0.05,
      flags,
    );
    console.log("tris", idx.length / 3, "->", res.length / 3, "err", err);
    const I = prim.getIndices();
    I.setArray(n < 65536 ? new Uint16Array(res) : res);
  }
await doc.transform(
  fn.prune(),
  fn.compactPrimitive
    ? (d) => {
        for (const m of d.getRoot().listMeshes())
          for (const p of m.listPrimitives()) fn.compactPrimitive(p);
      }
    : fn.prune(),
);
await io.write(out, doc);
for (const m of doc.getRoot().listMeshes())
  for (const p of m.listPrimitives())
    console.log("verts", p.getAttribute("POSITION").getCount());
