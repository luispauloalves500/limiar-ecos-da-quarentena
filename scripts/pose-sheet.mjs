// Pose sheets for review: every Helena and zombie clip from the QA pages,
// captured on the same SwiftShader setup and tiled by tools/montage (PIL).
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base =
    process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/",
  out = process.env.SMOKE_OUT || "/workspace/limiar-v060-smoke/poses";
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
const errors = [];
async function sheet(file, ready, poses, prefix, extra = async () => {}) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(new URL(file, base).href, { waitUntil: "networkidle" });
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await extra(page);
  // Hide the QA chrome after controls are used, so the sheet is the
  // character. Hidden <select> is changed via the input event, not the UI.
  await page.addStyleTag({
    content: "aside,#tools{display:none!important}canvas{width:100%!important}",
  });
  for (const [pose, wait] of poses) {
    await page.evaluate((value) => {
      const el = window.document.querySelector("#pose");
      el.value = value;
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    }, pose);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${prefix}-${pose}.png` });
  }
  await page.close();
}
await sheet(
  "qa-player.html",
  () => window.playerQA?.ready,
  [
    ["PlayerIdle", 600],
    ["Walking", 600],
    ["Running", 500],
    ["Sneaky_Walk_inplace", 600],
    ["Aim", 500],
    ["WalkAim", 600],
    ["Fire", 150],
    ["Reload", 550],
    ["Flashlight", 500],
    ["Hit", 180],
    ["InjuredWalk", 600],
    ["Grabbed", 350],
    ["BreakFree", 350],
    ["QuickTurn", 300],
    ["Interact", 400],
    ["Door", 500],
    ["PlayerDeath", 1400],
  ],
  "helena",
);
await sheet(
  "qa-zombies.html",
  () => window.zombieQA?.ready,
  [
    ["Idle", 700],
    ["Walking", 700],
    ["Running", 500],
    ["AttackBite", 330],
    ["HitTorso", 200],
    ["HitHead", 200],
    ["LightStun", 500],
    ["LegFall", 500],
    ["Crawl", 700],
    ["CrawlAttack", 400],
    ["Death", 1200],
    ["DeathHead", 1200],
  ],
  "zumbi",
  async (page) => {
    await page.locator("#count").selectOption("1");
    await page.waitForTimeout(300);
  },
);
await browser.close();
if (errors.length) {
  console.error(errors);
  process.exitCode = 1;
} else console.log("POSES OK", out);
