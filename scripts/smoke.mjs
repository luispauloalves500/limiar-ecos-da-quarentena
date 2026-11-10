import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const out = process.env.SMOKE_OUT || "/workspace/limiar-smoke";
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
function controlsToward(p, goal, zone) {
  const cx = zone === 0 ? 10 : -10,
    cz = 16,
    len = Math.hypot(cx, cz);
  const f = { x: -cx / len, z: -cz / len },
    r = { x: -f.z, z: f.x };
  const dx = goal.x - p.x,
    dz = goal.z - p.z;
  const along = dx * f.x + dz * f.z,
    across = dx * r.x + dz * r.z;
  const keys = [];
  if (Math.abs(along) > Math.max(0.12, Math.abs(across) * 0.414))
    keys.push(along > 0 ? "w" : "s");
  if (Math.abs(across) > Math.max(0.12, Math.abs(along) * 0.414))
    keys.push(across > 0 ? "d" : "a");
  return keys;
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
      const keys = controlsToward(s.player, goal, s.camera);
      if (!keys.length) break;
      await hold(keys, Math.min(180, Math.max(55, (d / 2.2) * 450)));
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
  await page.waitForTimeout(400);
  await note("door → " + to);
}
async function aimAtEnemy(id) {
  let s = await state();
  const e = s.enemies[id];
  const k = controlsToward(s.player, e, s.camera);
  await hold(k, 80);
  await page.keyboard.down("j");
  await page.waitForTimeout(120);
}
async function shoot(id, region = "1", count = 2) {
  await tap(region);
  await aimAtEnemy(id);
  for (let i = 0; i < count; i++) {
    await tap("k");
    await page.waitForTimeout(450);
  }
  await page.keyboard.up("j");
  await note("shoot " + id);
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.limiar);
  await page.screenshot({ path: out + "/01-menu.png" });
  await page.locator("#new").click();
  await note("start");
  await moveTo(-3, 2);
  await tap("e");
  assert.equal((await state()).mode, "document");
  await page.screenshot({ path: out + "/02-documento.png" });
  await tap("Escape");
  await moveTo(3, 2);
  await tap("e");
  assert.equal((await state()).reserve, 24);
  await tap("Tab");
  assert.equal((await state()).mode, "inventory");
  await page.screenshot({ path: out + "/03-inventario.png" });
  await tap("Tab");
  await moveTo(1, -6.6);
  assert.equal((await state()).camera, 1);
  await moveTo(0, -6.9);
  await tap("e");
  await page.waitForFunction(() => window.limiar.transition);
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + "/04-porta.png" });
  await page.waitForFunction(
    () => window.limiar.room === "corredor" && !window.limiar.transition,
    { timeout: 15000 },
  );
  await note("corredor");
  // Neutralize first enemy using the actual assisted aim, not state mutation.
  await moveTo(0, 3);
  await shoot("errante01", "3", 2);
  let st = await state();
  assert.equal(st.enemies.errante01.crawl, true);
  await page.screenshot({ path: out + "/05-combate.png" });
  await shoot("errante01", "1", 2);
  assert.equal((await state()).enemies.errante01.dead, true);
  await travel(-5, 4, "segura");
  await moveTo(0, -2);
  await tap("e");
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(() => localStorage.getItem("limiar-save-v1")));
  await page.screenshot({ path: out + "/06-sala-segura.png" });
  await tap("Escape");
  await page.locator("#load").click();
  assert.equal((await state()).room, "segura");
  await travel(5, 4, "corredor");
  await travel(5, -3, "arquivo");
  await moveTo(0, 3);
  await shoot("errante02", "1", 2);
  if (!(await state()).enemies.errante02.dead) await shoot("errante02", "1", 2);
  await moveTo(0, -5.7);
  await tap("e");
  assert.equal((await state()).mode, "puzzle");
  for (let i = 0; i < 3; i++) await page.locator("#hour").click();
  await page.locator("#minute").click();
  await page.screenshot({ path: out + "/07-relogio.png" });
  await page.locator("#solve").click();
  assert.equal((await state()).flags.chave, true);
  await travel(-5, 4, "corredor");
  await travel(0, -7, "gerador");
  await moveTo(-4, 5);
  await tap("e");
  assert.equal((await state()).flags.fusivel, true);
  await moveTo(1, 4);
  await shoot("errante03", "1", 2);
  if (!(await state()).enemies.errante03.dead) await shoot("errante03", "1", 2);
  await moveTo(4, -5);
  await tap("e");
  assert.equal((await state()).flags.energia, true);
  await note("power restored");
  await travel(0, -7, "atrio");
  await page.screenshot({ path: out + "/08-chefe.png" });
  await moveTo(-4, 6);
  await tap("e");
  await moveTo(-4.8, 4);
  await moveTo(-4.8, -5.6);
  await moveTo(0, -5.5);
  await tap("e");
  await shoot("porteiro", "1", 5);
  await tap("r");
  await page.waitForTimeout(1300);
  await tap("h");
  // Complete using repeated electrical traps if ammunition is low; no puzzle requires bullets.
  for (let i = 0; i < 8 && !(await state()).flags.boss; i++) {
    const before = (await state()).hp;
    await moveTo(0, -5.7);
    await tap("e");
    await shoot("porteiro", "1", 4);
    if ((await state()).ammo === 0) {
      await tap("r");
      await page.waitForTimeout(1300);
    }
    if ((await state()).hp < 65) await tap("h");
    if ((await state()).flags.boss) break;
    await moveTo(4.8, -5.6);
    await moveTo(4.8, 5.8);
    await moveTo(-4.8, 5.8);
    await moveTo(-4.8, -5.6);
    await moveTo(0, -5.7);
    if ((await state()).hp <= 0)
      throw Error("Boss killed player from " + before);
  }
  await page.waitForTimeout(1700);
  assert.equal((await state()).flags.boss, true);
  await page.screenshot({ path: out + "/09-conclusao.png" });
  await note("complete");
  assert.deepEqual(errors, []);
  assert.deepEqual(responses, []);
  console.log("SMOKE PASS");
} catch (e) {
  errors.push(String(e));
  await page.screenshot({ path: out + "/failure.png" });
  console.error(e);
  process.exitCode = 1;
} finally {
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      {
        base,
        browser: browser.version(),
        errors,
        warnings,
        httpErrors: responses,
        log,
        last: await state(),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
