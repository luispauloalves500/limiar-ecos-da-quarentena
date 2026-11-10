import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const cases = [
  {
    name: "base-publicada",
    url: "https://luispauloalves500.github.io/limiar-ecos-da-quarentena/",
    quality: null,
  },
  {
    name: "0.2-baixo",
    url: "http://127.0.0.1:4173/limiar-ecos-da-quarentena/",
    quality: "low",
  },
  {
    name: "0.2-medio",
    url: "http://127.0.0.1:4173/limiar-ecos-da-quarentena/",
    quality: "medium",
  },
];
const results = [];
try {
  for (const c of cases) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.goto(c.url, { waitUntil: "networkidle" });
    if (c.quality) {
      await page.locator("#options").click();
      await page.locator("#opt-quality").selectOption(c.quality);
      await page.locator("#options-back").click();
    }
    await page.locator("#new").click();
    await page.waitForTimeout(3000);
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let previous = window.performance.now();
          const start = previous;
          const frame = (now) => {
            times.push(now - previous);
            previous = now;
            if (now - start < 6000) window.requestAnimationFrame(frame);
            else resolve(times);
          };
          window.requestAnimationFrame(frame);
        }),
    );
    const a = frames.sort((a, b) => a - b);
    const median = a[Math.floor(a.length / 2)],
      p99 = a[Math.floor(a.length * 0.99)];
    const s = await page.evaluate(() => window.limiar);
    const r = {
      ...c,
      reportedVersion: s.version || "legado sem campo de versão",
      samples: a.length,
      medianMs: median,
      p99Ms: p99,
      over100ms: a.filter((x) => x > 100).length,
      drawCalls: s.drawCalls,
      triangles: s.triangles,
    };
    results.push(r);
    console.log(r);
    await page.close();
  }
} finally {
  await writeFile(
    "/workspace/limiar-v020-smoke/benchmark.json",
    JSON.stringify(
      {
        browser: browser.version(),
        viewport: "1280x800",
        renderer: "SwiftShader",
        results,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
