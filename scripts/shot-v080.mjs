// 0.8 — in-game shots of the Preceptora (visual review only).
// Uses a constructed save placed in the arena; NOT a campaign verification.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

const url =
  process.env.GAME_URL || "http://127.0.0.1:4190/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-v080-smoke/ingame";
const only = (process.env.SHOTS || "approach,generator,death").split(",");
await mkdir(out, { recursive: true });
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
  root: new URL("..", import.meta.url).pathname,
});
const logic = await vite.ssrLoadModule("/src/logic.ts");
await vite.close();
function save({ px, pz, yaw, bossHp = 700, bx = 0, bz = -3 }) {
  const s = logic.newGame();
  s.room = "circulo";
  s.player = { x: px, z: pz, hp: 100, yaw };
  s.reserve = 48;
  s.kits = 2;
  s.flags = {
    energia: true,
    boss: true,
    chave: true,
    fusivel: true,
    pulseira: true,
    pressao: true,
    final: true,
    prontuarios: true,
  };
  for (const e of Object.values(s.enemies))
    if (e.id !== "preceptora") {
      e.dead = true;
      e.hp = 0;
      e.removed = true;
      e.deathAt = 1;
    }
  Object.assign(s.enemies.preceptora, { hp: bossHp, x: bx, z: bz });
  logic.parseSave(JSON.stringify(s));
  return JSON.stringify(s);
}
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const report = [];
async function open(raw, mode = "shoulder") {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(
    ([raw, mode]) => {
      localStorage.setItem("limiar-save-v1", raw);
      localStorage.setItem(
        "limiar-preferences-v1",
        JSON.stringify({
          version: 1,
          mode,
          quality: "medium",
          sensitivity: 1,
          invertY: false,
          assist: true,
          shoulder: 1,
          ambience: "auto",
          master: 0.6,
          music: 0.6,
          effects: 0.6,
          voices: 0.6,
          subtitles: true,
        }),
      );
    },
    [raw, mode],
  );
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      window.limiar?.asset.status === "ready" &&
      window.limiar?.playerAsset.status === "ready",
    null,
    { timeout: 90000 },
  );
  await page.locator("#load").click();
  await page.waitForFunction(() => window.limiar.fade === 0, null, {
    timeout: 30000,
  });
  return { page, errors };
}
const boss = (page) => page.evaluate(() => window.limiar.enemies.preceptora);
async function shot(page, name, extra = {}) {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  const b = await boss(page);
  const row = {
    name,
    path,
    boss: b && {
      hp: b.hp,
      state: b.state,
      attack: b.attack,
      vuln: b.vulnerable,
    },
    draws: await page.evaluate(() => window.limiar.drawCalls),
    ...extra,
  };
  report.push(row);
  console.log(JSON.stringify(row));
}
if (only.includes("approach")) {
  const { page, errors } = await open(save({ px: 0.3, pz: 1.6, yaw: Math.PI }));
  await page.waitForTimeout(300);
  await shot(page, "01-perto");
  await page.waitForFunction(
    () => window.limiar.enemies.preceptora.state === "windup",
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(550);
  await shot(page, "02-aviso", { errors });
  await page.close();
}
if (only.includes("generator")) {
  const px = 3.6,
    pz = -5.0;
  const { page, errors } = await open(
    save({ px, pz, yaw: Math.atan2(0 - px, -1 - pz), bx: 0, bz: -1 }),
  );
  await page.keyboard.press("e");
  await page.waitForTimeout(500);
  await shot(page, "03-descarga");
  await page.waitForTimeout(1900);
  await shot(page, "04-placas-abertas", { errors });
  await page.close();
}
if (only.includes("death")) {
  const px = 3.6,
    pz = -5.0;
  const { page, errors } = await open(
    save({
      px,
      pz,
      yaw: Math.atan2(0 - px, -1 - pz),
      bx: 0,
      bz: -1,
      bossHp: 40,
    }),
    "tank",
  );
  await page.keyboard.press("e");
  await page.waitForTimeout(400);
  await page.keyboard.press("Digit2");
  await page.keyboard.down("j");
  await page.waitForTimeout(500);
  for (let i = 0; i < 4 && !(await boss(page)).dead; i++) {
    await page.keyboard.press("k");
    await page.waitForTimeout(450);
  }
  await page.keyboard.up("j");
  await page.keyboard.press("v");
  await page.waitForTimeout(700);
  await shot(page, "05-morte-a");
  await page.waitForTimeout(800);
  await shot(page, "06-morte-b", { errors });
  await page.close();
}
await browser.close();
await writeFile(out + "/shots.json", JSON.stringify(report, null, 2));
