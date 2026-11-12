import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-v070-smoke/review";
await mkdir(out, { recursive: true });

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
  root: "/workspace/limiar-ecos-da-quarentena",
});
const logic = await vite.ssrLoadModule("/src/logic.ts");
const world = await vite.ssrLoadModule("/src/world.ts");
await vite.close();

const rooms = Object.keys(world.rooms);
const saves = {};
for (const id of rooms) {
  const s = logic.newGame();
  const d = world.doors.find((d) => d.a === id || d.b === id);
  const p = world.inward(world.endpoint(d, id).position);
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
  s.flags = {
    energia: true,
    boss: true,
    chave: true,
    fusivel: true,
    pulseira: true,
    pressao: true,
    final: true,
    prontuarios: true,
    preceptora: true,
    cracha: true,
  };
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
  ],
});
const report = [];
for (const id of rooms) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((raw) => {
    localStorage.setItem("limiar-save-v1", raw);
    localStorage.setItem(
      "limiar-preferences-v1",
      JSON.stringify({
        version: 1,
        mode: "shoulder",
        quality: "medium",
        sensitivity: 1,
        invertY: false,
        assist: false,
        shoulder: 1,
        ambience: "auto",
        master: 0.6,
        music: 0.6,
        effects: 0.6,
        voices: 0.6,
        subtitles: true,
      }),
    );
  }, saves[id]);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      window.limiar?.asset.status === "ready" &&
      window.limiar?.playerAsset.status === "ready",
    null,
    { timeout: 90000 },
  );
  await page.locator("#load").click();
  await page.waitForFunction(
    () => window.limiar.fade === 0 && !window.limiar.transition,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(900);
  const path = `${out}/sala-${id}.png`;
  await page.screenshot({ path });
  const st = await page.evaluate(() => ({
    room: window.limiar.room,
    version: window.limiar.version,
    draws: window.limiar.drawCalls,
    tris: window.limiar.triangles,
    scene: window.limiar.scene,
    cam: window.limiar.cameraPosition,
  }));
  const row = { id, path, ...st, errors };
  report.push(row);
  console.log(JSON.stringify(row));
  await page.close();
}
await browser.close();
await writeFile(out + "/shots.json", JSON.stringify(report, null, 2));
if (report.some((r) => r.errors.length || r.room !== r.id)) {
  console.error("errors in shots");
  process.exitCode = 1;
} else console.log("SHOTS OK", report.length);
