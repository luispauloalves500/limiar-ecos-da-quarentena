/* global WebGLRenderingContext, WebGL2RenderingContext, performance, requestAnimationFrame, HTMLCanvasElement */
// Benchmark por sala, idêntico para versões diferentes: carrega um save de
// fixture (mesmo formato v1), sem inimigos vivos, câmera de ombro parada
// apontando para o centro. Mede frametime, draws, triângulos, memória de
// textura estimada (hook WebGL) e carregamento. Não é gameplay.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
// GAME_URLS="label=url,label=url" benchmarks several builds interleaved
// (ABBA order per room) so background load on the box hits both equally.
const targets = (
  process.env.GAME_URLS ||
  "dev=" +
    (process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/")
)
  .split(",")
  .map((t) => {
    const i = t.indexOf("=");
    return { label: t.slice(0, i), url: t.slice(i + 1) };
  });
const base = targets.map((t) => t.url).join(",");
const REPEAT = Number(process.env.REPEAT || 1);
const out = process.env.SMOKE_OUT || "/workspace/limiar-v060-smoke/bench";
const profiles = (process.env.PROFILES || "low,medium,high").split(",");
const onlyRooms = process.env.ROOMS ? process.env.ROOMS.split(",") : null;
const warm = Number(process.env.WARM_MS || 1500),
  sample = Number(process.env.SAMPLE_MS || 4000);
await mkdir(out, { recursive: true });
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
const logic = await vite.ssrLoadModule("/src/logic.ts"),
  world = await vite.ssrLoadModule("/src/world.ts");
await vite.close();
const saves = {};
for (const id of Object.keys(world.rooms)) {
  if (onlyRooms && !onlyRooms.includes(id)) continue;
  const s = logic.newGame(),
    d = world.doors.find((d) => d.a === id || d.b === id),
    p = world.inward(world.endpoint(d, id).position);
  s.room = id;
  s.player.x = p.x;
  s.player.z = p.z;
  s.player.yaw = Math.atan2(-p.x, -p.z);
  for (const e of Object.values(s.enemies)) {
    e.dead = true;
    e.hp = 0;
    e.removed = true;
    e.deathAt = 1;
  }
  s.flags = { energia: true, boss: true, chave: true, fusivel: true };
  logic.parseSave(JSON.stringify(s));
  saves[id] = JSON.stringify(s);
}
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    // BENCH_UNTHROTTLED=1 removes vsync pacing (saturates SwiftShader).
    ...(process.env.BENCH_UNTHROTTLED
      ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"]
      : []),
  ],
});
const stats = (a) => {
  const s = [...a].sort((x, y) => x - y),
    q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return {
    samples: s.length,
    meanMs: a.reduce((x, y) => x + y, 0) / a.length,
    medianMs: q(0.5),
    p95Ms: q(0.95),
    p99Ms: q(0.99),
  };
};
const rows = [],
  errors = [];
let flip = 0;
for (let rep = 0; rep < REPEAT; rep++)
  for (const quality of profiles)
    for (const [room, save] of Object.entries(saves))
      for (const target of flip++ % 2 ? [...targets].reverse() : targets) {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 800 },
        });
        page.on("pageerror", (e) => errors.push(room + " " + e));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(room + " " + m.text());
        });
        await page.addInitScript(
          ([save, quality]) => {
            localStorage.setItem("limiar-save-v1", save);
            localStorage.setItem(
              "limiar-preferences-v1",
              JSON.stringify({ version: 1, mode: "shoulder", quality }),
            );
            // Frame work = JS + GPU (gl.finish) per RAF callback, excluding vsync
            // idle; much less sensitive to the compositor than RAF intervals.
            let gl;
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
              const c = getContext.call(this, type, ...rest);
              if (c && /webgl/.test(type)) gl = c;
              return c;
            };
            window.__work = [];
            const px = new Uint8Array(4);
            const raf = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (cb) =>
              raf((ts) => {
                const t0 = performance.now();
                cb(ts);
                // 1-pixel readback forces the GPU process to finish this frame.
                if (gl)
                  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                window.__work.push(performance.now() - t0);
              });
            const tex = new Map();
            let bytes = 0;
            window.__texBytes = () => bytes;
            for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
              const p = C.prototype,
                orig = p.texImage2D,
                orig3 = p.texStorage2D;
              p.texImage2D = function (...a) {
                const w = a.length >= 9 ? a[3] : a[5]?.width || 0,
                  h = a.length >= 9 ? a[4] : a[5]?.height || 0;
                if (a[1] === 0) {
                  const t = this.getParameter(this.TEXTURE_BINDING_2D),
                    b = w * h * 4;
                  bytes += b - (tex.get(t) || 0);
                  tex.set(t, b);
                }
                return orig.apply(this, a);
              };
              if (orig3)
                p.texStorage2D = function (t0, levels, f, w, h) {
                  bytes += w * h * 4 * (levels > 1 ? 1.33 : 1);
                  return orig3.apply(this, [t0, levels, f, w, h]);
                };
            }
          },
          [save, quality],
        );
        const t0 = Date.now();
        await page.goto(target.url, { waitUntil: "load" });
        await page.waitForFunction(
          () =>
            window.limiar?.asset.status === "ready" &&
            window.limiar?.playerAsset.status === "ready",
          null,
          { timeout: 90000 },
        );
        const loadMs = Date.now() - t0;
        const transfer = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .reduce((a, e) => a + (e.encodedBodySize || 0), 0),
        );
        await page.locator("#load").click();
        await page.waitForFunction(
          () => window.limiar.fade === 0 && !window.limiar.transition,
          null,
          { timeout: 30000 },
        );
        const enterMs = Date.now() - t0;
        await page.waitForTimeout(warm);
        await page.evaluate(() => (window.__work.length = 0));
        const times = await page.evaluate(
          (ms) =>
            new Promise((resolve) => {
              const v = [];
              let last = performance.now();
              const start = last;
              const tick = (now) => {
                v.push(now - last);
                last = now;
                if (now - start < ms) requestAnimationFrame(tick);
                else resolve(v);
              };
              requestAnimationFrame(tick);
            }),
          sample,
        );
        const work = stats(await page.evaluate(() => window.__work.slice()));
        const d = await page.evaluate(() => ({
          drawCalls: window.limiar.drawCalls,
          triangles: window.limiar.triangles,
          texMB: window.__texBytes() / 1048576,
          room: window.limiar.room,
          version: window.limiar.version,
          scene: window.limiar.scene,
        }));
        if (d.room !== room)
          errors.push("room mismatch " + room + " " + d.room);
        await page.screenshot({
          path: `${out}/${target.label}-${quality}-${room}.png`,
        });
        const row = {
          target: target.label,
          rep,
          quality,
          room,
          ...stats(times),
          workMeanMs: work.meanMs,
          workMedianMs: work.medianMs,
          workP95Ms: work.p95Ms,
          workP99Ms: work.p99Ms,
          ...d,
          loadMs,
          enterMs,
          transferKB: transfer / 1024,
        };
        rows.push(row);
        console.log(JSON.stringify(row));
        await page.close();
      }
await browser.close();
await writeFile(
  out + "/rooms.json",
  JSON.stringify({ base, warm, sample, rows, errors }, null, 2),
);
if (errors.length) {
  console.error(errors);
  process.exitCode = 1;
}
