import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const url =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-v060-smoke/environment";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [],
  warnings = [],
  checks = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const state = () => page.evaluate(() => window.limiar);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
async function lookAt(point) {
  for (let i = 0; i < 45; i++) {
    const s = await state(),
      [cx, cy, cz] = s.cameraPosition;
    const dx = point[0] - cx,
      dz = point[2] - cz;
    const yaw = Math.atan2(dx, dz),
      pitch = Math.atan2(point[1] - cy, Math.hypot(dx, dz));
    const a = wrap(yaw - s.cameraYaw),
      b = pitch - s.cameraPitch;
    if (Math.abs(a) < 0.013 && Math.abs(b) < 0.013) return;
    const key =
      Math.abs(a) > 0.013
        ? a > 0
          ? "ArrowLeft"
          : "ArrowRight"
        : b > 0
          ? "ArrowUp"
          : "ArrowDown";
    const delta = Math.abs(a) > 0.013 ? Math.abs(a) : Math.abs(b),
      speed = Math.abs(a) > 0.013 ? 1.188 : 0.792;
    await page.keyboard.down(key);
    await page.waitForTimeout(
      Math.max(12, Math.min(140, (delta / speed) * 750)),
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(70);
  }
}
let result;
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#new").click();
  assert.equal((await state()).version, "0.7.0");
  await page.waitForFunction(
    () => window.limiar.environment.lastEvent === "telefone",
  );
  await page.screenshot({ path: out + "/evento-telefone.png" });
  checks.push("one-shot reception phone");
  const before = (await state()).environment.bodies;
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  await page.waitForTimeout(300);
  assert.ok(
    (await state()).environment.reactiveHits > 0,
    "footsteps push actual litter",
  );
  checks.push("reactive footsteps");
  await page.screenshot({ path: out + "/passos-latas.png" });
  await page.keyboard.down("j");
  await page.waitForTimeout(300);
  await lookAt([5.7, 1.8, 0]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + "/vidro-antes.png" });
  await page.keyboard.press("k");
  await page.waitForTimeout(350);
  assert.ok(
    (await state()).environment.glassBroken,
    "real reticle shot breaks pane",
  );
  assert.ok((await state()).environment.decals > 0);
  await page.screenshot({ path: out + "/vidro-depois.png" });
  checks.push("real glass shot and persistent-impact source");
  await page.keyboard.up("j");
  await page.keyboard.press("Escape");
  await page.locator("#quality").click();
  await page.locator("#opt-ambience").selectOption("off");
  await page.locator("#options-back").click();
  await page.locator("#resume").click();
  await page.waitForTimeout(200);
  assert.equal((await state()).environment.gpuParticles, 0);
  checks.push("density off");
  await page.keyboard.press("Escape");
  await page.locator("#quality").click();
  await page.locator("#opt-ambience").selectOption("high");
  await page.locator("#options-back").click();
  await page.locator("#resume").click();
  await page.waitForTimeout(200);
  assert.equal((await state()).environment.gpuParticles, 160);
  await page.keyboard.press("v");
  await page.waitForTimeout(300);
  assert.equal((await state()).preferences.mode, "tank");
  assert.ok((await state()).environment.glassBroken);
  await page.screenshot({ path: out + "/ambiente-tank.png" });
  checks.push("tank same broken glass/effects");
  await page.reload();
  await page.waitForFunction(
    () => window.limiar?.playerAsset.status === "ready",
  );
  assert.equal((await state()).preferences.ambience, "high");
  checks.push("density persisted");
  result = { before, after: (await state()).environment, checks };
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log("ENVIRONMENT REAL INPUT PASS", checks);
} catch (e) {
  errors.push(String(e));
  process.exitCode = 1;
  await page.screenshot({ path: out + "/failure.png" });
  console.error(e);
} finally {
  await writeFile(
    out + "/report.json",
    JSON.stringify({ url, errors, warnings, result, checks }, null, 2),
  );
  await browser.close();
}
