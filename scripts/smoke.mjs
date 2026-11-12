import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base =
  process.env.GAME_URL || "http://127.0.0.1:4173/limiar-ecos-da-quarentena/";
const gameMode = process.env.GAME_MODE || "shoulder";
const out = process.env.SMOKE_OUT || `/workspace/limiar-v070-smoke/${gameMode}`;
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
  espera: [
    [-3, -3, 2.2, 3],
    [3.2, -2, 1.6, 3.5],
  ],
  abrigo: [
    [-3, -4, 4, 1.4],
    [3, -3, 1.5, 3],
  ],
  recreio: [
    [-3.2, -1, 2.4, 3.2],
    [3.2, 2, 2, 2.6],
  ],
  bercario: [
    [-3, -2, 2.2, 3.4],
    [3, -2, 2.2, 3.4],
  ],
  leitos: [
    [-3.2, -2, 2.2, 3.6],
    [3.2, -2, 2.2, 3.6],
    [0, -3.6, 1.8, 1.8],
  ],
  circulo: [
    [-3.1, 1.4, 1.5, 1.5],
    [3.1, 1.4, 1.5, 1.5],
    [-3.1, -2.8, 1.5, 1.5],
    [3.1, -2.8, 1.5, 1.5],
  ],
  visor: [
    [-3, -2, 1.6, 3],
    [3, -2, 1.6, 3],
  ],
});
const clear = (p, room) =>
  Math.abs(p.x) < 5.8 &&
  Math.abs(p.z) < 8 &&
  (obstacles[room] || []).every(
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
      if (s.mode === "pause" || s.mode === "document" || s.mode === "inventory") {
        await tap("Escape");
        await page.waitForTimeout(250);
        s = await state();
      }
      if (s.mode !== "play") throw Error("Not playing: " + s.mode);
      const d = Math.hypot(goal.x - s.player.x, goal.z - s.player.z);
      if (d < tolerance) break;
      if (s.hp < 55 && s.hp > 0) await tap("h");
      if (count++ > 22) {
        await tap(" ");
        await page.waitForTimeout(80);
      }
      if (count > 40) break;
      let keys;
      if (gameMode === "tank") {
        await tankFace(Math.atan2(goal.x - s.player.x, goal.z - s.player.z));
        keys = ["w"];
      } else keys = controlsToward(s.player, goal, s.cameraYaw);
      if (!keys.length) break;
      if (s.room === "atrio" || s.room === "circulo") keys.push("Shift");
      await hold(
        keys,
        Math.min(
          170,
          Math.max(
            35,
            (d / (s.room === "atrio" || s.room === "circulo" ? 3.7 : 2.2)) *
              450,
          ),
        ),
      );
    }
  }
}
async function travel(x, z, to) {
  await moveTo(x, z);
  await tap("e");
  try {
    await page.waitForFunction(
      (to) => window.limiar.room === to && !window.limiar.transition,
      to,
      { timeout: 30000 },
    );
  } catch (err) {
    // A porta às vezes termina logo após o timeout (C6l3, C6n).
    let ok = false;
    for (let n = 0; n < 16; n++) {
      await page.waitForTimeout(400);
      const s = await state();
      if (s.room === to && !s.transition && s.mode === "play") {
        ok = true;
        break;
      }
    }
    if (!ok) {
      const s = await state();
      throw Error(
        "travel to " +
          to +
          " failed: room=" +
          s.room +
          " mode=" +
          s.mode +
          " transition=" +
          s.transition +
          " — " +
          err,
      );
    }
  }
  await page.waitForFunction(() => window.limiar.fade < 0.02, {
    timeout: 15000,
  });
  await page.waitForTimeout(600);
  await note("door → " + to);
  if (!roomImages.has(to)) {
    roomImages.add(to);
    await page.screenshot({ path: out + "/sala-" + to + ".png" });
  }
}
const PRECEPTORA_RING = [
  [5.2, -7.2],
  [-5.2, -7.2],
  [5.2, 6.2],
  [-5.2, 6.2],
  [0, -7.2],
  [-5.2, 0],
  [5.2, 0],
];
function ringPointAway(boss, player) {
  let best = PRECEPTORA_RING[0],
    bestD = -1;
  for (const pt of PRECEPTORA_RING) {
    const fromBoss = Math.hypot(pt[0] - boss.x, pt[1] - boss.z);
    const fromSelf = Math.hypot(pt[0] - player.x, pt[1] - player.z);
    const score = fromBoss + Math.min(fromSelf, 4) * 0.15;
    if (score > bestD) {
      bestD = score;
      best = pt;
    }
  }
  return best;
}
async function fleePreceptora(boss) {
  const s = await state();
  if (s.mode !== "play") return;
  const target = boss || s.enemies.preceptora;
  if (!target) return;
  const pt = ringPointAway(target, s.player);
  await moveTo(pt[0], pt[1], 1.0);
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
  let sidesteps = 0;
  for (let i = 0; i < 64; i++) {
    const s = await state();
    if (s.mode !== "play")
      throw Error("Not playing while aiming " + id + ": " + s.mode);
    if (s.hp < 65 && s.hp > 0) {
      await page.keyboard.up("j");
      await tap("h");
      await page.keyboard.down("j");
      await page.waitForTimeout(180);
    }
    if (s.enemies[id].dead) return;
    if (
      s.room === "circulo" &&
      s.enemies[id].boss &&
      (s.enemies[id].state === "windup" ||
        Math.hypot(s.enemies[id].x - s.player.x, s.enemies[id].z - s.player.z) <
          3.2)
    ) {
      await page.keyboard.up("j");
      if (s.hp < 70 && s.hp > 0 && (s.kits || 0) > 0) await tap("h");
      await fleePreceptora(s.enemies[id]);
      return;
    }
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
    try {
      await page.waitForFunction(() => window.limiar.weaponReady, {
        timeout: 8000,
      });
    } catch {
      if ((await state()).enemies[id]?.dead) break;
      await tap("r");
      await page.waitForTimeout(600);
    }
    try {
      await aimAtEnemy(id, region);
    } catch {
      await page.keyboard.up("j");
      const s = await state(),
        e = s.enemies[id];
      if (!e || e.dead) break;
      if (s.room === "circulo" && e.boss) {
        await fleePreceptora(e);
        break;
      }
      const d = Math.hypot(e.x - s.player.x, e.z - s.player.z);
      if (d > 2.2) {
        const ux = (e.x - s.player.x) / d,
          uz = (e.z - s.player.z) / d;
        await moveTo(e.x - ux * 2, e.z - uz * 2, 0.8);
      }
      if ((await state()).hp < 65) await tap("h");
      await aimAtEnemy(id, region);
    }
    const aimed = await state();
    if (aimed.mode !== "play") break;
    if (
      aimed.room === "circulo" &&
      aimed.enemies[id]?.boss &&
      (!aimed.aiming ||
        aimed.enemies[id].state === "windup" ||
        Math.hypot(
          aimed.enemies[id].x - aimed.player.x,
          aimed.enemies[id].z - aimed.player.z,
        ) < 3.4)
    ) {
      await page.keyboard.up("j");
      await fleePreceptora(aimed.enemies[id]);
      break;
    }
    if (!aimed.aiming) {
      await page.keyboard.up("j");
      break;
    }
    try {
      await page.waitForFunction(() => window.limiar.aiming, {
        timeout: 8000,
      });
    } catch {
      await page.keyboard.up("j");
      break;
    }
    const before = (await state()).ammo;
    await tap("k");
    try {
      await page.waitForFunction(
        (before) => window.limiar.ammo < before,
        before,
        { timeout: 8000 },
      );
    } catch {
      await tap("k");
      await page.waitForTimeout(400);
      if ((await state()).ammo >= before) break;
    }
    try {
      await page.waitForFunction(() => window.limiar.weaponReady, {
        timeout: 8000,
      });
    } catch {
      /* próximo ciclo tenta de novo */
    }
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
    if ((await state()).hp < 90) await tap("h");
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
    await moveTo(-4, 6);
    await tap("e");
    if ((await state()).hp < 90) await tap("h");
    await moveTo(0, 4.5);
    await shoot("enfermeiro01", "1", 4);
    assert.ok((await state()).enemies.enfermeiro01.dead);
    await page.screenshot({ path: out + "/11-internacao.png" });
    await moveTo(4, 5);
    await tap("e");
    await tap("r");
    await page.waitForFunction(() => !window.limiar.reloading);
    if ((await state()).hp < 90) await tap("h");
    await travel(5, -3, "enfermaria");
    await moveTo(4, 5);
    await tap("e");
    if ((await state()).hp < 90) await tap("h");
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
    await page.waitForFunction(
      () =>
        window.limiar.mode === "play" &&
        window.limiar.room === "posto" &&
        !window.limiar.transition &&
        window.limiar.fade < 0.02,
      null,
      { timeout: 30000 },
    );
    assert.equal((await state()).room, "posto");
    assert.ok((await state()).flags.pulseira);
    assert.ok((await state()).enemies.enfermeiro01.removed);
    assert.ok(!(await state()).worldObjects.items.includes("posto-doc"));
  }
  await travel(5, 4, "internacao");
  await travel(0, -7, "lavanderia");
  await moveTo(0, 5.5);
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
  await moveTo(0, 5.5);
  await shoot("febril02", "3", 2);
  if (!(await state()).enemies.febril02.dead) await shoot("febril02", "2", 2);
  await page.screenshot({ path: out + "/15-isolamento.png" });
  await moveTo(0, -6.5);
  await tap("e");
  assert.ok((await state()).flags.final);
  assert.equal((await state()).mode, "play");
  await page.screenshot({ path: out + "/16-porta-13.png" });
  await travel(0, -7, "espera");
  await moveTo(0, 4);
  await tap("e");
  await tap("Escape");
  await moveTo(4, 5);
  await tap("e");
  await tap("r");
  await page.waitForFunction(() => !window.limiar.reloading);
  await travel(-5, 4, "abrigo");
  await moveTo(-4, 4);
  await tap("e");
  await tap("Escape");
  await moveTo(-3, 0);
  await tap("e");
  await tap("r");
  await page.waitForFunction(() => !window.limiar.reloading);
  await moveTo(1, 1);
  await tap("e");
  if ((await state()).hp < 80) await tap("h");
  await moveTo(0, -2);
  await tap("e");
  await page.screenshot({ path: out + "/17-abrigo.png" });
  await travel(5, 4, "espera");
  await travel(5, 4, "recreio");
  await moveTo(0, 5);
  await tap("e");
  await tap("Escape");
  await shoot("rastejador01", "2", 4);
  if (!(await state()).enemies.rastejador01.dead)
    await shoot("rastejador01", "2", 3);
  if ((await state()).hp < 65) await tap("h");
  await moveTo(4, -5);
  await tap("e");
  await travel(0, -7, "bercario");
  await moveTo(0, 4);
  await tap("e");
  await tap("Escape");
  await moveTo(4, 5);
  await tap("e");
  await tap("r");
  await page.waitForFunction(() => !window.limiar.reloading);
  await moveTo(-4, 5);
  await tap("e");
  await travel(0, -7, "leitos");
  await moveTo(0, 3);
  await shoot("rastejador02", "2", 4);
  if (!(await state()).enemies.rastejador02.dead)
    await shoot("rastejador02", "2", 3);
  if ((await state()).hp < 65) await tap("h");
  await moveTo(-2, -2);
  await tap("e");
  await moveTo(0, -5.2);
  await tap("e");
  await moveTo(2, -2);
  await tap("e");
  assert.ok((await state()).flags.prontuarios);
  await page.screenshot({ path: out + "/18-leitos.png" });
  await moveTo(4, 5);
  await tap("e");
  if ((await state()).hp < 80) await tap("h");
  await moveTo(-4, 5);
  await tap("e");
  await tap("r");
  await page.waitForFunction(() => !window.limiar.reloading);
  await travel(0, -7, "circulo");
  if ((await state()).hp < 90) await tap("h");
  // Intro: corredor leste, gerador, sai imediatamente pelo sul.
  // Kit e recarga no canto mataram o C6k/C6m; recuar é a jogada honesta.
  await moveTo(5, 5.5);
  await moveTo(5, -6);
  await moveTo(4, -6);
  await tap("e");
  await moveTo(0, -7.2);
  await moveTo(-5.2, -7.2);
  await tap("r");
  try {
    await page.waitForFunction(() => !window.limiar.reloading, {
      timeout: 8000,
    });
  } catch {
    /* continua no anel se a recarga atrasar */
  }
  for (let i = 0; i < 24 && !(await state()).flags.preceptora; i++) {
    let s = await state();
    if (s.mode !== "play") break;
    if (s.hp < 70 && s.hp > 0 && (s.kits || 0) > 0) await tap("h");
    if (s.ammo === 0 && (s.reserve || 0) > 0) {
      await tap("r");
      try {
        await page.waitForFunction(() => !window.limiar.reloading, {
          timeout: 8000,
        });
      } catch {
        /* segue no anel */
      }
    }
    s = await state();
    const boss = s.enemies.preceptora;
    if (!boss || boss.dead) break;
    let d = Math.hypot(boss.x - s.player.x, boss.z - s.player.z);
    if (d < 4 || boss.state === "windup") {
      await fleePreceptora(boss);
      s = await state();
    }
    const b = (await state()).enemies.preceptora;
    if (!b || b.dead) break;
    s = await state();
    d = Math.hypot(b.x - s.player.x, b.z - s.player.z);
    if (b.vulnerable > 0.3 && d >= 3.4) {
      await shoot("preceptora", "2", 1);
    } else if (b.vulnerable <= 0.3 && (s.auxCooldown || 0) <= 0.4) {
      const genClear = Math.hypot(b.x - 4, b.z - -6.2) > 4;
      if (genClear) {
        await moveTo(5, -6);
        await moveTo(4, -6);
        await tap("e");
        await fleePreceptora((await state()).enemies.preceptora);
      } else {
        await fleePreceptora(b);
        await page.waitForTimeout(400);
      }
    } else {
      if (d < 4.5) await fleePreceptora(b);
      else await page.waitForTimeout(350);
    }
    s = await state();
    const after = s.enemies.preceptora;
    if (
      after &&
      after.hp / 700 <= 0.71 &&
      s.hp > 55 &&
      Math.hypot(after.x - s.player.x, after.z - s.player.z) >= 3.4
    ) {
      for (const hid of ["rastejador03", "rastejador04"]) {
        const wait = await state();
        const h = wait.enemies[hid];
        const waitD = h
          ? Math.hypot(h.x - wait.player.x, h.z - wait.player.z)
          : 99;
        if (h && !h.dead && wait.hp > 55 && waitD >= 3) await shoot(hid, "2", 2);
        const nowB = (await state()).enemies.preceptora;
        if (waitB) {
          const dd = Math.hypot(
            waitB.x - (await state()).player.x,
            waitB.z - (await state()).player.z,
          );
          if (dd < 3.5 || waitB.state === "windup") {
            await fleePreceptora(waitB);
            break;
          }
        }
      }
    }
    s = await state();
    if (s.enemies.preceptora)
      console.log("preceptora", {
        i,
        hp: s.enemies.preceptora.hp,
        vulnerable: s.enemies.preceptora.vulnerable,
        state: s.enemies.preceptora.state,
        helena: s.hp,
        kits: s.kits,
        auxCooldown: s.auxCooldown,
        dist: Math.hypot(
          s.enemies.preceptora.x - s.player.x,
          s.enemies.preceptora.z - s.player.z,
        ),
      });
  }
  assert.ok((await state()).flags.preceptora);
  assert.ok((await state()).flags.cracha);
  await page.screenshot({ path: out + "/19-preceptora.png" });
  await travel(0, -7, "visor");
  await moveTo(0, 4);
  await tap("e");
  await tap("Escape");
  await moveTo(0, -6.5);
  await tap("e");
  assert.equal((await state()).mode, "win");
  assert.ok((await state()).flags.cirurgia);
  await page.screenshot({ path: out + "/20-final.png" });
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
  assert.equal((await state()).room, "abrigo");
  assert.ok((await state()).flags.final);
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
