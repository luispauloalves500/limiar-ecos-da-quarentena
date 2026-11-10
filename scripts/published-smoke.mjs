import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const url =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-published-smoke";
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  warnings = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
let result = {};
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#new").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + "/jogando.png" });
  const before = await page.evaluate(() => window.limiar.player);
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  const after = await page.evaluate(() => window.limiar.player);
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 1.5);
  await page.mouse.move(700, 400);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(150);
  await page.mouse.click(700, 400);
  await page.mouse.up({ button: "right" });
  assert.equal(await page.evaluate(() => window.limiar.ammo), 11);
  await page.keyboard.press("m");
  assert.equal(await page.evaluate(() => window.limiar.mode), "map");
  await page.screenshot({ path: out + "/mapa.png" });
  await page.keyboard.press("m");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => window.limiar.mode), "inventory");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.limiar.mode), "pause");
  await page.locator("#sound").click();
  await page.locator("#quality").click();
  await page.locator("#resume").click();
  assert.equal(await page.evaluate(() => window.limiar.mode), "play");
  await page.waitForTimeout(500);
  result = await page.evaluate(() => window.limiar);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log("PUBLISHED/UI SMOKE PASS", url);
} catch (e) {
  errors.push(String(e));
  process.exitCode = 1;
  await page.screenshot({ path: out + "/failure.png" });
  console.error(e);
} finally {
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      { url, browser: browser.version(), errors, warnings, result },
      null,
      2,
    ),
  );
  await browser.close();
}
