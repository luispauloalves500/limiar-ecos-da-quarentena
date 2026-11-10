import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const gameMode = process.env.GAME_MODE || "shoulder";
const out = process.env.SMOKE_OUT || `/workspace/limiar-v050-smoke/${gameMode}`;
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
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  storageState: process.env.RESUME_SAVE || undefined,
});
const errors = [],
  warnings = [],
  responses = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (m.type() === "warning") warnings.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) responses.push([r.status(), r.url()]);
});
const state = () => page.evaluate(() => window.limiar);
const log = [];
const roomImages = new Set();
const note = async (name) => {
  const s = await state();
  console.log(name, s.room, s.player, s.flags);
  log.push({ name, state: s });
};
const tap = async (key) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
};
const hold = async (keys, ms) => {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of keys) await page.keyboard.up(key);
  await page.waitForTimeout(25);
};
const obstacles = {
  recepcao: [
    [-2, -1, 5, 1.4],
    [4, -4, 1.4, 3],
  ],
  corredor: [
    [-3, -1, 2.3, 3],
    [3, 3, 1.2, 2.5],
  ],
  segura: [
    [-3, -4, 4, 1.4],
    [3, -3, 1.5, 3],
  ],
  arquivo: [
    [-3, -3, 1.2, 6],
    [3, -3, 1.2, 6],
  ],
  gerador: [
    [-3, -2, 3, 4],
    [3, 1, 2.3, 3],
  ],
  atrio: [
    [-3, -1, 1.2, 2],
    [3, -1, 1.2, 2],
  ],
};
Object.assign(obstacles, {
  escadaria: [
    [-3, -2, 2, 4],
    [3, -3, 2, 3],
  ],
  internacao: [
    [-3, -1, 2, 3],
    [3, 2, 1.4, 2.5],
  ],
  posto: [
    [-3, -4, 4, 1.4],
    [3, -3, 1.5, 3],
  ],
  enfermaria: [
    [-3, -2, 2, 4],
    [3, -2, 2, 4],
  ],
  lavanderia: [
    [-3.5, -2, 2, 5],
    [3.5, -2, 2, 5],
  ],
  isolamento: [
    [-3, -1, 1.5, 3],
    [3, -1, 1.5, 3],
  ],
});
const clear = (p, room) =>
  Math.abs(p.x) < 5.8 &&
  Math.abs(p.z) < 8 &&
  obstacles[room].every(
    ([x, z, w, d]) =>
      Math.abs(p.x - x) >= w / 2 + 0.65 || Math.abs(p.z - z) >= d / 2 + 0.65,
  );
function route(p, goal, room) {
  const start = { x: Math.round(p.x), z: Math.round(p.z) },
    end = { x: Math.round(goal.x), z: Math.round(goal.z) };
  const key = (p) => `${p.x},${p.z}`;
  const q = [start],
    seen = new Map([[key(start), null]]);
  while (q.length) {
    const a = q.shift();
    if (Math.hypot(a.x - end.x, a.z - end.z) < 1) {
      const path = [a];
      while (seen.get(key(path[0]))) path.unshift(seen.get(key(path[0])));
      path.shift();
      return path.concat([goal]);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const b = { x: a.x + dx, z: a.z + dz };
      if (clear(b, room) && !seen.has(key(b))) {
        seen.set(key(b), a);
        q.push(b);
      }
    }
  }
  return [goal];
}
function angle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
function controlsToward(p, goal, yaw) {
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) },
    r = { x: -f.z, z: f.x };
  const dx = goal.x - p.x,
    dz = goal.z - p.z;
  const along = dx * f.x + dz * f.z,
    across = dx * r.x + dz * r.z;
  const keys = [];
  if (Math.abs(along) > Math.max(0.1, Math.abs(across) * 0.414))
    keys.push(along > 0 ? "w" : "s");
  if (Math.abs(across) > Math.max(0.1, Math.abs(along) * 0.414))
    keys.push(across > 0 ? "d" : "a");
  return keys;
}
async function tankFace(yaw) {
  for (let i = 0; i < 40; i++) {
    const s = await state(),
      error = angle(yaw - s.player.yaw);
    if (Math.abs(error) < 0.08) return;
    await hold(
      [error > 0 ? "a" : "d"],
      Math.min(220, Math.max(25, (Math.abs(error) / 2.1) * 850)),
    );
  }
}
async function moveTo(x, z, tolerance = 0.6) {
  let s = await state();
  const path = route(s.player, { x, z }, s.room);
  for (const goal of path) {
    let count = 0;
    while (true) {
      s = await state();
      if (s.mode !== "play") throw Error("Not playing: " + s.mode);
      const d = Math.hypot(goal.x - s.player.x, goal.z - s.player.z);
      if (d < tolerance) break;
      if (count++ > 50)
        throw Error(
          `Movement stuck ${JSON.stringify(s.player)} => ${JSON.stringify(goal)}`,
        );
      let keys;
      if (gameMode === "tank") {
        await tankFace(Math.atan2(goal.x - s.player.x, goal.z - s.player.z));
        keys = ["w"];
      } else keys = controlsToward(s.player, goal, s.cameraYaw);
      if (!keys.length) break;
      if (s.room === "atrio") keys.push("Shift");
      await hold(
        keys,
        Math.min(
          170,
          Math.max(35, (d / (s.room === "atrio" ? 3.7 : 2.2)) * 450),
        ),
      );
    }
  }
}
async function travel(x, z, to) {
  await moveTo(x, z);
  await tap("e");
  await page.waitForFunction(
    (to) => window.limiar.room === to && !window.limiar.transition,
    to,
    { timeout: 15000 },
  );
  await page.waitForFunction(() => window.limiar.fade < 0.02);
  await page.waitForTimeout(600);
  await note("door → " + to);
  if (!roomImages.has(to)) {
    roomImages.add(to);
    await page.screenshot({ path: out + "/sala-" + to + ".png" });
  }
}
const checks = [];
async function pose(name, keys = []) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(180);
  await page.waitForFunction(() => window.limiar.fade === 0);
  const s = await state();
  assert.equal(s.playerAnimation.gunVisible, true);
  assert.match(s.playerAnimation.gunParent, /RightHand/);
  assert.ok(
    Math.hypot(
      ...s.playerAnimation.gun.map((v, i) => v - s.playerAnimation.hand[i]),
    ) < 0.4,
    "Weapon remains attached to right hand",
  );
  await page.screenshot({ path: out + "/" + name + ".png" });
  checks.push({
    name,
    room: s.room,
    hp: s.hp,
    animation: s.playerAnimation,
    fade: s.fade,
  });
  for (const key of keys) await page.keyboard.up(key);
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.limiar?.asset.status === "ready",
    null,
    { timeout: 60000 },
  );
  const colors = await page.locator("#new").evaluate((e) => {
    const s = window.getComputedStyle(e);
    return [s.color, s.backgroundColor];
  });
  const lum = (c) => {
    const a = c
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };
  const ls = colors.map(lum).sort((a, b) => a - b);
  assert.ok(
    (ls[1] + 0.05) / (ls[0] + 0.05) > 4.5,
    "Readable title action contrast",
  );
  await page.screenshot({ path: out + "/menu-cinematico.png" });
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator(":focus").getAttribute("id"), "load");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal((await state()).mode, "options");
  await page.locator("#opt-quality").selectOption("low");
  for (const id of ["master", "music", "effects", "voices"]) {
    await page.locator("#opt-" + id).fill("0.6");
    await page.locator("#opt-" + id).dispatchEvent("input");
    assert.equal((await state()).audio.levels[id], 0.6);
  }
  await page.locator("#opt-subtitles").uncheck();
  assert.equal((await state()).preferences.subtitles, false);
  await page.locator("#opt-subtitles").check();
  await page.screenshot({ path: out + "/opcoes-audio.png" });
  await page.locator("#options-back").click();
  await page.locator("#credits").click();
  assert.equal((await state()).mode, "credits");
  await page.keyboard.press("Escape");
  await page.locator("#new").click();
  await pose("helena-parada-lanterna");
  await page.keyboard.press("f");
  await pose("helena-parada-sem-lanterna");
  await page.keyboard.press("f");
  await pose("helena-andando", ["w"]);
  await pose("helena-correndo", ["Shift", "w"]);
  await pose("helena-mirando", ["j"]);
  await page.keyboard.down("j");
  await page.waitForFunction(() => window.limiar.aiming);
  await page.keyboard.press("k");
  await pose("helena-atirando");
  await page.keyboard.up("j");
  await page.keyboard.press("r");
  await pose("helena-recarregando");
  await page.waitForFunction(() => !window.limiar.reloading);
  await page.keyboard.press("v");
  assert.equal((await state()).preferences.mode, "tank");
  await pose("tank-parada");
  await pose("tank-andando", ["w"]);
  await pose("tank-correndo", ["Shift", "w"]);
  await pose("tank-mirando", ["j"]);
  await page.keyboard.down("j");
  await page.waitForFunction(() => window.limiar.aiming);
  await page.keyboard.press("k");
  await pose("tank-atirando");
  await page.keyboard.up("j");
  await page.keyboard.press("r");
  await pose("tank-recarregando");
  await page.waitForFunction(() => !window.limiar.reloading);
  await page.keyboard.press("v");
  await moveTo(-3, 4);
  await tap("e");
  assert.equal((await state()).mode, "document");
  await tap("e");
  await pose("helena-interagindo");
  await travel(0, -7, "corredor");
  await moveTo(0, 3);
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.limiar.hp <= 30, null, {
    timeout: 60000,
  });
  await page.keyboard.press("Space");
  assert.ok((await state()).shoveCooldown > 0);
  await page.keyboard.press("f");
  await page.waitForTimeout(650);
  await pose("helena-ferida", ["s"]);
  await page.keyboard.press("v");
  await pose("tank-ferida", ["w"]);
  await page.keyboard.press("h");
  await page.keyboard.press("v");
  assert.ok((await state()).hp > 30);
  assert.ok((await state()).audio.sources === 6);
  await travel(-5, 4, "segura");
  await moveTo(0, -1.8);
  await tap("e");
  await pose("helena-gravando");
  await page.keyboard.press("v");
  await tap("e");
  await pose("tank-interagindo-gravador");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(responses, []);
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        warnings,
        responses,
        final: await state(),
      },
      null,
      2,
    ),
  );
  console.log("QUALITY REAL GAME PASS", checks.length);
} catch (e) {
  await page.screenshot({ path: out + "/failure.png" });
  await writeFile(
    out + "/failure.json",
    JSON.stringify(
      {
        error: String(e),
        state: await state(),
        checks,
        errors,
        warnings,
        responses,
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
