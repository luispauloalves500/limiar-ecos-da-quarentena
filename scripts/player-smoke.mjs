import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
    process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/",
  out = process.env.SMOKE_OUT || "/workspace/limiar-v040-smoke/player";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  }),
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [],
  warnings = [],
  requests = [],
  results = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(r.status() + " " + r.url());
});
page.on("request", (r) => {
  if (/\.glb$/.test(r.url())) requests.push(r.url());
});
const state = () => page.evaluate(() => window.playerQA);
try {
  await page.goto(new URL("qa-player.html", base).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.playerQA?.ready, null, {
    timeout: 60000,
  });
  assert.equal((await state()).asset.status, "ready");
  assert.equal(await page.locator("canvas").count(), 1);
  assert.equal((await state()).asset.bones, 66);
  assert.equal((await state()).asset.clips.length, 17);
  for (const mode of ["shoulder", "tank"]) {
    await page.locator("#mode").selectOption(mode);
    for (const [pose, label] of [
      ["Walking", "andando"],
      ["Aim", "mirando"],
      ["Fire", "atirando"],
      ["Reload", "recarregando"],
    ]) {
      await page.locator("#pose").selectOption(pose);
      await page.waitForFunction(
        (p) => window.playerQA.animation.state === p,
        pose,
      );
      await page.waitForTimeout(250);
      const s = await state();
      assert.equal(s.animation.model, "supplied");
      assert.ok(s.animation.gun.every(Number.isFinite));
      assert.ok(
        Math.hypot(...s.animation.gun.map((v, i) => v - s.animation.hand[i])) <
          0.5,
      );
      await page.screenshot({ path: `${out}/${mode}-${label}.png` });
      results.push(s);
    }
  }
  for (const pose of [
    "Running",
    "Sneaky_Walk_inplace",
    "WalkAim",
    "Flashlight",
    "Hit",
    "InjuredWalk",
    "Grabbed",
    "BreakFree",
    "QuickTurn",
    "Interact",
    "Door",
    "PlayerDeath",
  ]) {
    await page.locator("#pose").selectOption(pose);
    await page.waitForFunction(
      (p) => window.playerQA.animation.state === p,
      pose,
    );
    results.push(await state());
  }
  assert.equal(requests.length, 1);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify(
      {
        url: base,
        browser: browser.version(),
        requests,
        errors,
        warnings,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ok: true,
      poses: results.length,
      requests,
      errors,
      warnings,
    }),
  );
} catch (e) {
  await page.screenshot({ path: `${out}/FAILED.png` }).catch(() => {});
  await writeFile(
    `${out}/FAILED.json`,
    JSON.stringify(
      {
        error: String(e),
        state: await state().catch(() => null),
        errors,
        warnings,
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
