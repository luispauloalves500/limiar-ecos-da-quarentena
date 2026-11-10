import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const url =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-v020-smoke/ui";
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
  warnings = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const state = () => page.evaluate(() => window.limiar);
let result = {},
  metrics = [];
const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + "/" + name + ".png" });
  const s = await state();
  metrics.push({
    name,
    preferences: s.preferences,
    fps: s.fps,
    frameMs: s.frameMs,
    drawCalls: s.drawCalls,
    triangles: s.triangles,
  });
};
try {
  await page.goto(url, { waitUntil: "networkidle" });
  assert.equal((await state()).version, "0.2.0");
  assert.equal((await state()).preferences.mode, "shoulder");
  await page.locator("#options").click();
  await page.locator("#opt-sensitivity").fill("1.4");
  await page.locator("#opt-sensitivity").dispatchEvent("input");
  await page.locator("#opt-invert").check();
  assert.equal((await state()).preferences.invertY, true);
  await page.locator("#opt-invert").uncheck();
  await page.locator("#opt-sensitivity").fill("1");
  await page.locator("#opt-sensitivity").dispatchEvent("input");
  await page.locator("#options-back").click();
  await page.locator("#new").click();
  await shot("01-ombro-medio");
  await page.keyboard.press("f");
  await shot("02-sem-lanterna");
  await page.keyboard.press("f");
  const start = (await state()).cameraYaw;
  await page.mouse.click(640, 400);
  await page.waitForFunction(() => window.limiar.pointerLocked);
  await page.mouse.move(740, 400);
  await page.mouse.move(760, 420);
  await page.waitForTimeout(200);
  assert.notEqual((await state()).cameraYaw, start);
  await page.keyboard.press("v");
  await page.waitForTimeout(200);
  assert.equal((await state()).mode, "play");
  assert.equal((await state()).preferences.mode, "tank");
  await shot("03-tank-medio");
  const yaw = (await state()).player.yaw;
  await page.keyboard.press("z");
  assert.ok(Math.abs((await state()).player.yaw - yaw) > 3);
  await page.keyboard.press("v");
  assert.equal((await state()).preferences.mode, "shoulder");
  await page.keyboard.press("c");
  assert.equal((await state()).preferences.shoulder, -1);
  await page.keyboard.press("m");
  assert.equal((await state()).mode, "map");
  await page.keyboard.press("m");
  await page.keyboard.press("Tab");
  assert.equal((await state()).mode, "inventory");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await page.locator("#quality").click();
  await page.locator("#opt-quality").selectOption("low");
  await page.locator("#options-back").click();
  await page.locator("#resume").click();
  await shot("04-ombro-baixo");
  await page.keyboard.down("j");
  await page.waitForFunction(() => window.limiar.aiming);
  await page.waitForTimeout(350);
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.limiar.ammo === 11);
  await page.keyboard.up("j");
  await page.keyboard.press("Escape");
  await page.locator("#quality").click();
  await page.locator("#opt-quality").selectOption("high");
  await page.locator("#options-back").click();
  await page.locator("#resume").click();
  await shot("05-ombro-alto");
  await page.keyboard.press("Escape");
  await page.locator("#quality").click();
  await page.locator("#opt-mode").selectOption("tank");
  await page.locator("#opt-quality").selectOption("medium");
  await page.locator("#options-back").click();
  await page.locator("#resume").click();
  await page.reload();
  await page.waitForFunction(() => !!window.limiar);
  assert.equal((await state()).preferences.mode, "tank");
  assert.equal((await state()).preferences.quality, "medium");
  assert.equal((await state()).preferences.shoulder, -1);
  result = await state();
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log("V020 UI / POINTER LOCK / PROFILES PASS", url);
} catch (e) {
  errors.push(String(e));
  process.exitCode = 1;
  await page.screenshot({ path: out + "/failure.png" });
  console.error(e);
} finally {
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      { url, browser: browser.version(), errors, warnings, result, metrics },
      null,
      2,
    ),
  );
  await browser.close();
}
