import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-v060-smoke/zombie";
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
  results = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(r.status() + " " + r.url());
});
const assetRequests = [];
page.on("request", (r) => {
  if (/\.glb(?:\?|$)/.test(r.url())) assetRequests.push(r.url());
});
const state = () => page.evaluate(() => window.zombieQA);
const set = async (id, value) => {
  await page.locator("#" + id).selectOption(String(value));
  await page.waitForTimeout(120);
};
try {
  await page.goto(new URL("qa-zombies.html", base).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.zombieQA?.ready, null, {
    timeout: 60000,
  });
  assert.equal((await state()).asset.status, "ready");
  assert.equal((await state()).asset.bones, 66);
  assert.ok((await state()).asset.tracks.Walking < 140);
  assert.ok((await state()).asset.tracks.Walking >= 65);
  if (!process.env.BENCH_ONLY) {
    for (const mode of ["shoulder", "tank"]) {
      await set("count", 1);
      await set("quality", "medium");
      await set("mode", mode);
      for (const [pose, wait, label] of [
        ["Walking", 700, "andando"],
        ["Running", 500, "correndo"],
        ["AttackBite", 330, "atacando"],
        ["Crawl", 600, "rastejando"],
        ["Death", 400, "morrendo"],
      ]) {
        await set("pose", pose);
        await page.waitForTimeout(wait);
        const s = await state();
        assert.equal(s.objects.animations[0].state, pose);
        assert.equal(s.objects.actors.length, 1);
        assert.equal(s.headRegion, "head");
        await page.screenshot({ path: `${out}/${mode}-${label}.png` });
        results.push({ mode, pose, state: s });
      }
      await page.waitForFunction(
        () => window.zombieQA.objects.actors.length === 0,
        null,
        { timeout: 10000 },
      );
      await page.screenshot({ path: `${out}/${mode}-morto-removido.png` });
    }
    for (const pose of [
      "Idle",
      "HitTorso",
      "HitHead",
      "LightStun",
      "LegFall",
      "CrawlAttack",
      "DeathHead",
    ]) {
      await set("pose", pose);
      await page.waitForTimeout(180);
      assert.equal((await state()).objects.animations[0].state, pose);
    }
  }
  await set("pose", "Walking");
  await set("count", 6);
  await set("mode", "shoulder");
  await set("quality", "low");
  await page.waitForTimeout(500);
  let s = await state();
  assert.equal(s.meshInstances, 12);
  assert.equal(s.uniqueGeometries, 2);
  assert.equal(s.uniqueSkeletons, 12);
  assert.ok(s.uniqueMaterials <= 4);
  assert.equal(s.objects.actors.length, 6);
  await page.locator("#lookaway").click();
  await page.waitForTimeout(250);
  const before = (await state()).objects.animations.reduce(
    (a, b) => a + b.updates,
    0,
  );
  await page.waitForTimeout(700);
  s = await state();
  const after = s.objects.animations.reduce((a, b) => a + b.updates, 0);
  assert.ok(after - before <= 1, "Offscreen mixers should stop");
  await page.locator("#lookaway").click();
  const benchmark = [];
  for (const model of ["procedural", "asset"]) {
    await set("model", model);
    await page.waitForTimeout(3000);
    const times = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const values = [];
          let last = window.performance.now(),
            start = last;
          const tick = (now) => {
            values.push(now - last);
            last = now;
            if (now - start < 8000) window.requestAnimationFrame(tick);
            else resolve(values);
          };
          window.requestAnimationFrame(tick);
        }),
    );
    const a = [...times].sort((a, b) => a - b),
      s = await state();
    benchmark.push({
      model,
      count: 6,
      quality: "low",
      mode: "shoulder",
      samples: a.length,
      meanMs: times.reduce((a, b) => a + b, 0) / times.length,
      medianMs: a[Math.floor(a.length / 2)],
      p99Ms: a[Math.floor(a.length * 0.99)],
      over100ms: a.filter((x) => x > 100).length,
      drawCalls: s.drawCalls,
      triangles: s.triangles,
      uniqueGeometries: s.uniqueGeometries,
      uniqueMaterials: s.uniqueMaterials,
      uniqueSkeletons: s.uniqueSkeletons,
      animations: s.objects.animations,
    });
    await page.screenshot({ path: `${out}/sala-6-${model}.png` });
  }
  assert.equal(
    assetRequests.length,
    2,
    "Two LOD files load once, not once per clone",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  console.log("ZOMBIE SMOKE PASS", JSON.stringify(benchmark));
  await writeFile(
    out + "/benchmark.json",
    JSON.stringify(
      {
        browser: browser.version(),
        renderer: "SwiftShader",
        viewport: "1280x800",
        benchmark,
      },
      null,
      2,
    ),
  );
} catch (e) {
  errors.push(String(e));
  console.error(e);
  await page.screenshot({ path: out + "/failure.png" });
  process.exitCode = 1;
} finally {
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      {
        url: base,
        browser: browser.version(),
        assetRequests,
        errors,
        warnings,
        results,
        last: await state(),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
