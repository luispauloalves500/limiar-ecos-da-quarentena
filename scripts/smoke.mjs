import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const gameMode = process.env.GAME_MODE || "shoulder";
const out = process.env.SMOKE_OUT || `/workspace/limiar-v060-smoke/${gameMode}`;
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
async function lookAt(position) {
  const s = await state(),
    cam = s.cameraPosition,
    dx = position[0] - cam[0],
    dy = position[1] - cam[1],
    dz = position[2] - cam[2];
  const yaw = Math.atan2(dx, dz),
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const ye = angle(yaw - s.cameraYaw),
    pe = pitch - s.cameraPitch,
    sens = s.preferences.sensitivity;
  if (Math.abs(ye) > 0.006)
    await hold(
      [ye > 0 ? "ArrowLeft" : "ArrowRight"],
      Math.min(180, Math.max(15, (Math.abs(ye) / (1.188 * sens)) * 850)),
    );
  if (Math.abs(pe) > 0.006)
    await hold(
      [pe > 0 !== s.preferences.invertY ? "ArrowUp" : "ArrowDown"],
      Math.min(140, Math.max(15, (Math.abs(pe) / (0.792 * sens)) * 850)),
    );
  await page.waitForTimeout(60);
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
async function aimAtEnemy(id, region) {
  await page.keyboard.down("j");
  await page.waitForTimeout(180);
  if (gameMode === "tank") {
    const s = await state(),
      e = s.enemies[id];
    await page.keyboard.up("j");
    await tankFace(Math.atan2(e.x - s.player.x, e.z - s.player.z));
    await page.keyboard.down("j");
    await page.waitForTimeout(100);
    return;
  }
  const wanted = region === "3" ? "legL" : region === "2" ? "body" : "head";
  for (let i = 0; i < 64; i++) {
    const s = await state();
    if (s.enemies[id].dead) return;
    if (
      s.rayHit?.id === id &&
      (s.rayHit.region === wanted || (wanted === "body" && s.enemies[id].crawl))
    )
      return;
    const target = s.aimTargets.find((t) => t.id === id && t.region === wanted);
    assert.ok(target, "Hitbox exists");
    await lookAt(target.position);
    const after = await state();
    if (
      after.rayHit?.id === id &&
      (after.rayHit.region === wanted ||
        (wanted === "body" && after.enemies[id].crawl))
    )
      return;
  }
  const finalAim = await state();
  if (
    finalAim.rayHit?.id === id &&
    (finalAim.rayHit.region === wanted ||
      (wanted === "body" && finalAim.enemies[id].crawl))
  )
    return;
  throw Error("Could not align real reticle with " + id + " " + wanted);
}
async function shoot(id, region = "1", count = 2) {
  if ((await state()).hp < 65) await tap("h");
  await tap(region);
  for (let i = 0; i < count; i++) {
    if ((await state()).enemies[id].dead || (await state()).ammo === 0) break;
    await page.waitForFunction(() => window.limiar.weaponReady, {
      timeout: 10000,
    });
    await aimAtEnemy(id, region);
    await page.waitForFunction(() => window.limiar.aiming, { timeout: 10000 });
    const before = (await state()).ammo;
    await tap("k");
    await page.waitForFunction(
      (before) => window.limiar.ammo < before,
      before,
      { timeout: 10000 },
    );
    await page.waitForFunction(() => window.limiar.weaponReady, {
      timeout: 10000,
    });
  }
  await page.keyboard.up("j");
  await note("shoot " + id);
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.limiar?.asset.status === "ready",
    null,
    { timeout: 60000 },
  );
  if (process.env.RESUME_SAVE) {
    await page.locator("#load").click();
    assert.equal((await state()).room, "posto");
    assert.ok((await state()).flags.pulseira);
    assert.ok((await state()).flags.boss);
    await note("resume-real-gravador");
  } else {
    await page.screenshot({ path: out + "/01-menu.png" });
    assert.equal((await state()).asset.status, "ready");
    assert.equal((await state()).preferences.mode, "shoulder");
    await page.locator("#options").click();
    await page.locator("#opt-mode").selectOption(gameMode);
    await page.locator("#opt-quality").selectOption("low");
    await page.locator("#opt-sensitivity").fill("0.7");
    await page.locator("#opt-sensitivity").dispatchEvent("input");
    await page.locator("#options-back").click();
    await page.locator("#new").click();
    await page.waitForFunction(() => window.limiar.fade === 0);
    assert.equal((await state()).preferences.mode, gameMode);
    await page.screenshot({ path: out + "/00-" + gameMode + ".png" });
    await page.screenshot({ path: out + "/sala-recepcao.png" });
    roomImages.add("recepcao");
    await note("start");
    if (gameMode === "shoulder") {
      await page.keyboard.down("j");
      await page.waitForTimeout(300);
      for (let i = 0; i < 20; i++) await lookAt([5.7, 1.8, 0]);
      await page.keyboard.press("k");
      await page.waitForTimeout(300);
      await page.keyboard.up("j");
      assert.ok((await state()).environment.glassBroken);
      await page.screenshot({ path: out + "/vidro-quebrado-recepcao.png" });
    }
    await moveTo(-3, 3.4);
    await lookAt([-3, 0.25, 2]);
    assert.ok((await state()).worldObjects.items.includes("carta"));
    await page.screenshot({ path: out + "/documento-antes.png" });
    await tap("e");
    assert.equal((await state()).mode, "document");
    await page.screenshot({ path: out + "/02-documento.png" });
    await tap("Escape");
    assert.ok(!(await state()).worldObjects.items.includes("carta"));
    assert.ok((await state()).documents.includes("carta"));
    await page.screenshot({ path: out + "/documento-depois.png" });
    await moveTo(3, 2);
    await tap("e");
    assert.equal((await state()).reserve, 24);
    await tap("Tab");
    assert.equal((await state()).mode, "inventory");
    await page.screenshot({ path: out + "/03-inventario.png" });
    await tap("Tab");
    await moveTo(1, -6.6);
    if (gameMode === "tank") assert.equal((await state()).camera, 1);
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
    if (gameMode === "shoulder") await moveTo(0, 5.7);
    await shoot("errante01", "1", 2);
    assert.equal((await state()).enemies.errante01.dead, true);
    assert.ok((await state()).worldObjects.actors.includes("errante01"));
    await page.screenshot({ path: out + "/corpo-antes.png" });
    await page.waitForFunction(
      () =>
        window.limiar.enemies.errante01.removed &&
        !window.limiar.worldObjects.actors.includes("errante01"),
      { timeout: 10000 },
    );
    await page.screenshot({ path: out + "/corpo-depois.png" });
    assert.ok((await state()).worldObjects.items.includes("cor-bat"));
    await travel(-5, 4, "segura");
    await moveTo(0, -2);
    await tap("e");
    await page.waitForTimeout(150);
    assert.ok(
      await page.evaluate(() => localStorage.getItem("limiar-save-v1")),
    );
    await page.screenshot({ path: out + "/06-sala-segura.png" });
    await tap("Escape");
    await page.locator("#load").click();
    assert.equal((await state()).room, "segura");
    if (gameMode === "shoulder")
      assert.ok((await state()).ambientState.broken.includes("recepcao"));
    await travel(5, 4, "corredor");
    if (gameMode === "shoulder") {
      await travel(0, 7, "recepcao");
      assert.ok(
        (await state()).environment.glassBroken,
        "Glass remains absent after actual save/load/reentry",
      );
      assert.ok(
        (await state()).environment.decals > 0,
        "Impact restored in actual world",
      );
      await lookAt([5.7, 1.8, 0]);
      await page.screenshot({ path: out + "/vidro-persistente-reentrada.png" });
      await travel(0, -7, "corredor");
    }
    await travel(5, -3, "arquivo");
    await moveTo(0, 3);
    await shoot("errante02", "1", 2);
    if (!(await state()).enemies.errante02.dead)
      await shoot("errante02", "1", 2);
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
    if (!(await state()).enemies.errante03.dead)
      await shoot("errante03", "1", 2);
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
    await shoot("porteiro", "2", 5);
    await tap("r");
    await page.waitForFunction(() => !window.limiar.reloading, {
      timeout: 15000,
    });
    await tap("h");
    // Complete using repeated electrical traps if ammunition is low; no puzzle requires bullets.
    for (let i = 0; i < 8 && !(await state()).flags.boss; i++) {
      const before = (await state()).hp;
      await moveTo(0, -5.7);
      await tap("e");
      await shoot("porteiro", "2", 4);
      if ((await state()).ammo === 0) {
        await tap("r");
        await page.waitForFunction(() => !window.limiar.reloading, {
          timeout: 15000,
        });
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
    assert.equal((await state()).flags.boss, true);
    await page.waitForFunction(() => window.limiar.enemies.porteiro.removed, {
      timeout: 10000,
    });
    await page.screenshot({ path: out + "/09-atrio-liberado.png" });
    await travel(5, 4, "escadaria");
    await page.screenshot({ path: out + "/10-patamar.png" });
    await moveTo(3, 4);
    await tap("e");
    await tap("r");
    await page.waitForFunction(() => !window.limiar.reloading);
    await moveTo(0, 3);
    await tap("e");
    await tap("Escape");
    await travel(0, -7, "internacao");
    await moveTo(0, 4.5);
    await shoot("enfermeiro01", "1", 4);
    assert.ok((await state()).enemies.enfermeiro01.dead);
    await page.screenshot({ path: out + "/11-internacao.png" });
    await moveTo(4, 5);
    await tap("e");
    await tap("r");
    await page.waitForFunction(() => !window.limiar.reloading);
    await travel(5, -3, "enfermaria");
    await moveTo(0, 4.5);
    await shoot("enfermeiro02", "1", 4);
    await moveTo(0, 3);
    await tap("e");
    await tap("Escape");
    await moveTo(0, -5);
    await tap("e");
    assert.ok((await state()).flags.pulseira);
    await page.screenshot({ path: out + "/12-enfermaria.png" });
    await travel(-5, 4, "internacao");
    await travel(-5, 4, "posto");
    await moveTo(-4, 4);
    await tap("e");
    await tap("Escape");
    await moveTo(-3, 0);
    await tap("e");
    await tap("r");
    await page.waitForFunction(() => !window.limiar.reloading);
    await moveTo(1, 1);
    await tap("e");
    await tap("h");
    await tap("b");
    await moveTo(0, -2);
    await tap("e");
    await page.screenshot({ path: out + "/13-posto-seguro.png" });
    await page.context().storageState({ path: out + "/checkpoint-save.json" });
    await tap("Escape");
    await page.locator("#load").click();
    assert.equal((await state()).room, "posto");
    assert.ok((await state()).flags.pulseira);
    assert.ok((await state()).enemies.enfermeiro01.removed);
    assert.ok(!(await state()).worldObjects.items.includes("posto-doc"));
  }
  await travel(5, 4, "internacao");
  await travel(0, -7, "lavanderia");
  await moveTo(0, 4.5);
  await shoot("febril01", "3", 2);
  if (!(await state()).enemies.febril01.dead) await shoot("febril01", "2", 2);
  await moveTo(0, 4);
  await tap("e");
  await tap("Escape");
  await moveTo(4, 5);
  await tap("e");
  await tap("r");
  await page.waitForFunction(() => !window.limiar.reloading);
  await moveTo(0, -6);
  await moveTo(4, -6);
  await tap("e");
  assert.equal((await state()).mode, "puzzle");
  await page.locator("#valve-1").click();
  assert.ok(!(await state()).flags.valve1);
  for (const n of [3, 1, 2]) await page.locator("#valve-" + n).click();
  assert.ok((await state()).flags.pressao);
  await page.screenshot({ path: out + "/14-lavanderia.png" });
  await travel(0, -7, "isolamento");
  await moveTo(0, 4.5);
  await shoot("febril02", "3", 2);
  if (!(await state()).enemies.febril02.dead) await shoot("febril02", "2", 2);
  await page.screenshot({ path: out + "/15-isolamento.png" });
  await moveTo(0, -5.6);
  await tap("e");
  assert.equal((await state()).mode, "win");
  assert.ok((await state()).flags.final);
  await page.screenshot({ path: out + "/16-novo-final.png" });
  await note("complete");
  await page.locator("#explore").click();
  await page.keyboard.press("v");
  assert.notEqual((await state()).preferences.mode, gameMode);
  await page.keyboard.press("v");
  assert.equal((await state()).preferences.mode, gameMode);
  await page.reload();
  await page.waitForFunction(
    () => window.limiar?.asset.status === "ready",
    null,
    { timeout: 60000 },
  );
  assert.equal((await state()).preferences.mode, gameMode);
  await page.locator("#load").click();
  assert.equal((await state()).room, "posto");
  assert.equal((await state()).preferences.mode, gameMode);
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
        gameMode,
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
