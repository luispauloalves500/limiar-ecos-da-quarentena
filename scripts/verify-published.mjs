import { Buffer } from "node:buffer";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base =
    process.env.PUBLIC_URL ||
    "https://luispauloalves500.github.io/limiar-ecos-da-quarentena/",
  out =
    process.env.VERIFY_OUT ||
    "/workspace/limiar-v040-smoke/http-verification.json";
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + e.name;
    if (e.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
const files = await walk("dist"),
  results = [],
  sha = (b) => createHash("sha256").update(b).digest("hex");
let version = false;
const root = await globalThis.fetch(base, {
    headers: { "Cache-Control": "no-cache" },
  }),
  rootBody = Buffer.from(await root.arrayBuffer());
assert.equal(root.status, 200, base);
assert.equal(
  sha(rootBody),
  sha(await readFile("dist/index.html")),
  "Página raiz não corresponde ao build",
);
results.push({
  url: base,
  status: root.status,
  bytes: rootBody.length,
  sha256: sha(rootBody),
  contentType: root.headers.get("content-type"),
});
for (const path of files) {
  const relative = path.slice(5),
    url = new URL(relative, base).href,
    response = await globalThis.fetch(url, {
      headers: { "Cache-Control": "no-cache" },
    }),
    local = await readFile(path),
    body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, url);
  assert.equal(sha(body), sha(local), "Diferença entre build e HTTP: " + url);
  if (
    relative.endsWith(".js") &&
    !relative.includes("QA-") &&
    body.toString().includes("0.4.0")
  )
    version = true;
  results.push({
    url,
    status: response.status,
    bytes: body.length,
    sha256: sha(body),
    contentType: response.headers.get("content-type"),
  });
}
assert.ok(
  version,
  "Versão 0.4.0 não encontrada no bundle principal/compartilhado",
);
assert.equal(results.filter((x) => x.url.endsWith(".glb")).length, 3);
await mkdir(out.slice(0, out.lastIndexOf("/")), { recursive: true });
const report = {
  base,
  checkedAtBRT: new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date()),
  version: "0.4.0",
  exactMatch: true,
  results,
};
await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
