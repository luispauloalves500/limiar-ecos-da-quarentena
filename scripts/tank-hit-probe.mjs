/**
 * Probe honesto: dá para acertar a Preceptora no modo tank com entrada real?
 * Carrega a gravação real do abrigo, caminha até o círculo, segura J (ADS),
 * escolhe tronco (2) e dispara com K. Sem teleporte, HP falso ou save
 * fabricado. Registra aiming, munição, HP do chefe, aviso (#notice) e fotos.
 */
import { chromium } from "@playwright/test";
import { writeFile, mkdir, readFile } from "node:fs/promises";

const base =
  process.env.GAME_URL ||
  "http://127.0.0.1:4179/limiar-ecos-da-quarentena/";
const savePath =
  process.env.RESUME_SAVE ||
  "/workspace/limiar-v070-smoke/segments/tank/saves/save-abrigo.json";
const out =
  process.env.PROBE_OUT || "/workspace/limiar-v070-smoke/tank-probe";
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));

const state = () => page.evaluate(() => window.limiar);
const hud = () =>
  page.evaluate(() => ({
    notice: globalThis.globalThis.document.getElementById("notice")?.textContent || "",
    region: globalThis.globalThis.document.getElementById("region")?.textContent || "",
    health: globalThis.globalThis.document.getElementById("health")?.textContent || "",
    ammo: globalThis.globalThis.document.getElementById("ammo")?.textContent || "",
    objective: globalThis.globalThis.document.getElementById("objective")?.textContent || "",
    targetDisplay: globalThis.globalThis.document.getElementById("target")?.style.display || "",
  }));

async function diag(tag) {
  const s = await state();
  const h = await hud();
  const boss = s.enemies?.preceptora;
  const rec = {
    tag,
    t: Date.now(),
    room: s.room,
    mode: s.mode,
    pref: s.preferences?.mode,
    camera: s.camera,
    aiming: s.aiming,
    ammo: s.ammo,
    reserve: s.reserve,
    hp: s.hp,
    kits: s.kits,
    auxCooldown: s.auxCooldown,
    player: s.player,
    rayHit: s.rayHit,
    boss: boss
      ? {
          hp: boss.hp,
          vulnerable: boss.vulnerable,
          state: boss.state,
          x: boss.x,
          z: boss.z,
          dead: boss.dead,
          dist: Math.hypot(boss.x - s.player.x, boss.z - s.player.z),
        }
      : null,
    hud: h,
  };
  console.log("DIAG", JSON.stringify(rec));
  return rec;
}

const obstacles = {
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
};
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
  const key = (q) => `${q.x},${q.z}`;
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
async function tankFace(yaw) {
  for (let i = 0; i < 40; i++) {
    const s = await state();
    const error = angle(yaw - s.player.yaw);
    if (Math.abs(error) < 0.08) return;
    const dir = error > 0 ? "a" : "d";
    const ms = Math.min(220, Math.max(25, (Math.abs(error) / 2.1) * 850));
    await page.keyboard.down(dir);
    await page.waitForTimeout(ms);
    await page.keyboard.up(dir);
    await page.waitForTimeout(25);
  }
}
async function moveTo(x, z, tolerance = 0.6) {
  let s = await state();
  const path = route(s.player, { x, z }, s.room);
  for (const goal of path) {
    let count = 0;
    while (true) {
      s = await state();
      if (s.mode === "pause" || s.mode === "document" || s.mode === "inventory") {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        s = await state();
      }
      if (s.mode !== "play") throw Error("Not playing: " + s.mode);
      const d = Math.hypot(goal.x - s.player.x, goal.z - s.player.z);
      if (d < tolerance) break;
      if (s.hp < 55 && s.hp > 0) await page.keyboard.press("h");
      if (++count > 40) break;
      await tankFace(Math.atan2(goal.x - s.player.x, goal.z - s.player.z));
      const keys = d > 2 ? ["Shift", "w"] : ["w"];
      const ms = Math.min(
        170,
        Math.max(35, (d / 3.7) * 450),
      );
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(ms);
      for (const k of keys) await page.keyboard.up(k);
      await page.waitForTimeout(25);
    }
  }
}
async function travel(x, z, to) {
  await moveTo(x, z);
  await page.keyboard.press("e");
  try {
    await page.waitForFunction(
      (to) => window.limiar.room === to && !window.limiar.transition,
      to,
      { timeout: 30000 },
    );
  } catch {
    const s = await state();
    if (s.room === to) {
      await page.waitForTimeout(600);
    } else throw Error("travel timeout " + to + " still " + s.room);
  }
  try {
    await page.waitForFunction(() => window.limiar.fade < 0.02, {
      timeout: 15000,
    });
  } catch {
    /* jogável */
  }
  await page.waitForTimeout(400);
  console.log("door →", to, (await state()).player);
}

/** Disparo tank com entrada real: vira o corpo, segura J, 2, K. Não chama fire(). */
async function realTankShots(enemyId, shots) {
  const result = { enemyId, shots: [], aimingLatencies: [], error: null };
  const s0 = await state();
  const e0 = s0.enemies[enemyId];
  if (!e0 || e0.dead) {
    result.error = "enemy missing or dead";
    return result;
  }
  // Vira o corpo na direção (A/D), como um jogador tank.
  await tankFace(Math.atan2(e0.x - s0.player.x, e0.z - s0.player.z));
  // ADS: segura J e mede quando aiming fica true.
  const t0 = Date.now();
  await page.keyboard.down("j");
  let aimingOn = false;
  for (let i = 0; i < 25; i++) {
    const s = await state();
    const h = await hud();
    result.aimingLatencies.push({
      ms: Date.now() - t0,
      aiming: s.aiming,
      region: h.region,
      targetDisplay: h.targetDisplay,
    });
    if (s.aiming) {
      aimingOn = true;
      break;
    }
    await page.waitForTimeout(80);
  }
  console.log("ADS", enemyId, "aimingOn", aimingOn, result.aimingLatencies);
  if (!aimingOn) {
    await page.keyboard.up("j");
    result.error = "aiming nunca ficou true com J segurado";
    await page.screenshot({ path: `${out}/ads-fail-${enemyId}.png` });
    return result;
  }
  await page.keyboard.press("2");
  await page.waitForTimeout(120);
  await page.screenshot({
    path: `${out}/ads-on-${enemyId}.png`,
  });
  for (let n = 0; n < shots; n++) {
    const before = await state();
    const be = before.enemies[enemyId];
    if (!be || be.dead || before.mode !== "play") break;
    // Recua se o chefe entra em windup ou chega perto demais.
    if (
      be.boss &&
      (be.state === "windup" ||
        Math.hypot(be.x - before.player.x, be.z - before.player.z) < 3.2)
    ) {
      result.shots.push({ aborted: "windup-or-close", hp: be.hp });
      break;
    }
    const ammo0 = before.ammo;
    const hp0 = be.hp;
    try {
      await page.waitForFunction(() => window.limiar.weaponReady, {
        timeout: 5000,
      });
    } catch {
      /* tenta o tiro mesmo assim */
    }
    await page.keyboard.press("k");
    try {
      await page.waitForFunction((a) => window.limiar.ammo < a, ammo0, {
        timeout: 2500,
      });
    } catch {
      await page.keyboard.press("k");
      await page.waitForTimeout(300);
    }
    const after = await state();
    const h = await hud();
    const ae = after.enemies[enemyId];
    const rec = {
      n,
      ammoBefore: ammo0,
      ammoAfter: after.ammo,
      ammoConsumed: after.ammo < ammo0,
      hpBefore: hp0,
      hpAfter: ae?.hp,
      damage: hp0 - (ae?.hp ?? hp0),
      aiming: after.aiming,
      vulnerable: ae?.vulnerable,
      notice: h.notice,
      region: h.region,
    };
    result.shots.push(rec);
    console.log("SHOT", enemyId, JSON.stringify(rec));
    if (ae?.dead) break;
    await page.waitForTimeout(450);
  }
  await page.keyboard.up("j");
  await page.waitForTimeout(80);
  return result;
}

function lineClear2d(a, b, rects) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(dist / 0.15);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    for (const [x, z, w, d] of rects) {
      if (Math.abs(p.x - x) < w / 2 && Math.abs(p.z - z) < d / 2) return false;
    }
  }
  return true;
}

const report = {
  started: new Date().toISOString(),
  save: savePath,
  url: base,
  control: null,
  boss: null,
  adsWorks: null,
  tankCanHitRegular: null,
  tankCanHitBoss: null,
  bestBossHp: null,
  notes: [],
};

try {
  const raw = await readFile(savePath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.room !== "abrigo" || parsed.contentVersion !== 4) {
    throw Error("save inesperado: " + savePath);
  }
  report.saveSnapshot = {
    room: parsed.room,
    hp: parsed.player.hp,
    kits: parsed.kits,
    ammo: parsed.ammo,
    reserve: parsed.reserve,
    flagsFinal: !!parsed.flags.final,
    pos: parsed.player,
  };
  console.log("SAVE REAL", report.saveSnapshot);

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => window.limiar?.asset.status === "ready",
    null,
    { timeout: 60000 },
  );
  await page.locator("#options").click();
  await page.locator("#opt-mode").selectOption("tank");
  await page.locator("#opt-quality").selectOption("low");
  await page.locator("#opt-sensitivity").fill("0.7");
  await page.locator("#opt-sensitivity").dispatchEvent("input");
  await page.locator("#options-back").click();
  await page.evaluate((s) => localStorage.setItem("limiar-save-v1", s), raw);
  await page.locator("#load").click();
  await page.waitForFunction(
    () =>
      window.limiar.mode === "play" &&
      window.limiar.room === "abrigo" &&
      !window.limiar.transition,
    { timeout: 30000 },
  );
  const loaded = await state();
  if (loaded.preferences?.mode !== "tank")
    throw Error("modo não é tank: " + loaded.preferences?.mode);
  if (loaded.player.hp !== parsed.player.hp)
    throw Error("HP alterado no load — aborta (não é o save real)");
  console.log("LOADED", loaded.room, loaded.player, "mode", loaded.preferences.mode);
  await page.screenshot({ path: `${out}/00-abrigo-tank.png` });

  // --- caminho real até o recreio (controle: inimigo comum) ---
  await travel(5, 4, "espera");
  await travel(5, 4, "recreio");
  await page.waitForTimeout(400);
  const rast = (await state()).enemies.rastejador01;
  console.log("rastejador01", rast);
  if (rast && !rast.dead) {
    // afasta um pouco se estiver colado
    const s = await state();
    const d = Math.hypot(rast.x - s.player.x, rast.z - s.player.z);
    if (d < 3) await moveTo(s.player.x < 0 ? 3 : -3, 5);
    report.control = await realTankShots("rastejador01", 4);
    report.tankCanHitRegular = report.control.shots.some((x) => x.damage > 0);
    report.adsWorks = report.control.aimingLatencies.some((x) => x.aiming);
    report.notes.push(
      "controle recreio: ads=" +
        report.adsWorks +
        " dano=" +
        report.tankCanHitRegular +
        " " +
        JSON.stringify(report.control.shots.map((x) => x.damage)),
    );
    // termina o rastejador se ainda vivo, para seguir
    for (let i = 0; i < 3 && !(await state()).enemies.rastejador01?.dead; i++) {
      const more = await realTankShots("rastejador01", 3);
      report.control.shots.push(...more.shots);
      if ((await state()).hp < 60) await page.keyboard.press("h");
    }
  }
  await page.screenshot({ path: `${out}/01-recreio.png` });

  // — bercario, leitos (três prontuários), círculo —
  await moveTo(4, -5);
  await page.keyboard.press("e");
  await travel(0, -7, "bercario");
  await moveTo(0, 4);
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await moveTo(4, 5);
  await page.keyboard.press("e");
  await page.keyboard.press("r");
  await page.waitForTimeout(400);
  await moveTo(-4, 5);
  await page.keyboard.press("e");
  await travel(0, -7, "leitos");
  await moveTo(0, 3);
  if ((await state()).enemies.rastejador02 && !(await state()).enemies.rastejador02.dead) {
    const s = await state();
    const e = s.enemies.rastejador02;
    const d = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    if (d < 3) await moveTo(-3, 4);
    await realTankShots("rastejador02", 5);
    for (let i = 0; i < 3 && !(await state()).enemies.rastejador02?.dead; i++) {
      await realTankShots("rastejador02", 3);
      if ((await state()).hp < 60) await page.keyboard.press("h");
    }
  }
  // três leitos marcados
  await moveTo(-2, -2);
  await page.keyboard.press("e");
  await page.waitForTimeout(250);
  await moveTo(0, -5.2);
  await page.keyboard.press("e");
  await page.waitForTimeout(250);
  await moveTo(2, -2);
  await page.keyboard.press("e");
  await page.waitForTimeout(400);
  const beds = await state();
  console.log("prontuarios", beds.flags?.prontuarios, {
    baleia: beds.flags?.["bed-baleia"],
    passaro: beds.flags?.["bed-passaro"],
    arvore: beds.flags?.["bed-arvore"],
  });
  if (!beds.flags?.prontuarios) {
    // segunda tentativa nos leitos
    for (const [x, z] of [
      [-2, -2],
      [0, -5.2],
      [2, -2],
      [-2.2, -1.5],
      [2.2, -1.5],
    ]) {
      await moveTo(x, z, 0.5);
      await page.keyboard.press("e");
      await page.waitForTimeout(300);
      if ((await state()).flags?.prontuarios) break;
    }
  }
  if (!(await state()).flags?.prontuarios) {
    report.notes.push("não confirmou prontuários — não entra no círculo");
    throw Error("prontuarios flag ausente");
  }
  await page.screenshot({ path: `${out}/02-leitos.png` });
  if ((await state()).hp < 80) await page.keyboard.press("h");
  await travel(0, -7, "circulo");
  await page.screenshot({ path: `${out}/03-circulo-entrada.png` });
  await diag("entered-circulo");

  // Prova de acerto: no stun de entrada a chefe está a ~9 m e não ataca.
  // Sem gerador a armadura está fechada: o jogo deve aplicar 3 de dano e
  // anunciar "Armadura fechada". Mesmo caminho de fire() dos rastejadores.
  {
    const before = (await state()).enemies.preceptora;
    console.log("INTRO-STUN before", before?.hp, before?.state, before?.vulnerable);
    report.introShot = await realTankShots("preceptora", 2);
    const after = (await state()).enemies.preceptora;
    const dmg = (before?.hp ?? 700) - (after?.hp ?? 700);
    report.tankCanHitBoss = dmg > 0 || report.introShot.shots.some((x) => x.damage > 0);
    report.bestBossHp = after?.hp ?? 700;
    report.notes.push(
      "tiro no stun de entrada: dano=" +
        dmg +
        " shots=" +
        JSON.stringify(report.introShot.shots) +
        " ads=" +
        JSON.stringify(report.introShot.aimingLatencies),
    );
    await page.screenshot({ path: `${out}/03b-intro-shot.png` });
    console.log("INTRO-STUN after", after?.hp, "canHit", report.tankCanHitBoss);
    await page.keyboard.up("j");
    if ((await state()).hp < 80 && (await state()).kits > 0)
      await page.keyboard.press("h");
  }

  // Intro: 5 s de stun. Vai ao gerador (entrada real: E) e sai.
  await moveTo(5, 5.5);
  await moveTo(5, -6);
  await moveTo(4, -6, 0.5);
  await page.keyboard.press("e");
  await page.waitForTimeout(300);
  await diag("after-generator-intro");
  await moveTo(-5.2, -7.2);
  await page.screenshot({ path: `${out}/04-apos-gerador.png` });

  const bossWindows = [];
  let bestHp = 700;
  const deadline = Date.now() + 180000; // 3 min de luta para a pergunta do dano
  let i = 0;
  while (Date.now() < deadline) {
    i++;
    const s = await state();
    if (s.mode !== "play") {
      report.notes.push("saiu de play: " + s.mode + " i=" + i);
      break;
    }
    const b = s.enemies.preceptora;
    if (!b || b.dead || s.flags?.preceptora) {
      report.notes.push("chefe derrotada no probe i=" + i);
      report.tankCanHitBoss = true;
      bestHp = 0;
      break;
    }
    bestHp = Math.min(bestHp, b.hp);
    const d = Math.hypot(b.x - s.player.x, b.z - s.player.z);
    const los = lineClear2d(s.player, b, obstacles.circulo);
    if (i % 2 === 1) await diag("loop-" + i + "-los=" + los);
    if (s.hp < 70 && s.kits > 0) await page.keyboard.press("h");
    if (d < 4 || b.state === "windup") {
      // foge para o anel
      const ring = [
        [5.2, -7.2],
        [-5.2, -7.2],
        [5.2, 6.2],
        [-5.2, 6.2],
      ];
      let best = ring[0],
        bestS = -1;
      for (const pt of ring) {
        const sc = Math.hypot(pt[0] - b.x, pt[1] - b.z);
        if (sc > bestS) {
          bestS = sc;
          best = pt;
        }
      }
      await moveTo(best[0], best[1]);
      continue;
    }
    if (b.vulnerable > 0.4 && d >= 3.4) {
      const before = b.hp;
      const shot = await realTankShots("preceptora", 3);
      const after = (await state()).enemies.preceptora;
      const rec = {
        i,
        before,
        after: after?.hp,
        damage: before - (after?.hp ?? before),
        los,
        aiming: shot.aimingLatencies,
        shots: shot.shots,
        notice: shot.shots.map((x) => x.notice),
      };
      bossWindows.push(rec);
      console.log("WINDOW", JSON.stringify(rec));
      if (after && after.hp < before) report.tankCanHitBoss = true;
      bestHp = Math.min(bestHp, after?.hp ?? before);
      await page.screenshot({ path: `${out}/window-${bossWindows.length}.png` });
      // após a rajada, afasta
      await moveTo(-5.2, 6.2);
      if (bossWindows.filter((w) => w.damage > 0).length >= 2) {
        report.notes.push("duas janelas com dano: prova suficiente, encerra o probe");
        break;
      }
    } else if (b.vulnerable <= 0.3 && (s.auxCooldown || 0) <= 0.4) {
      const genClear = Math.hypot(b.x - 4, b.z - -6.2) > 5.5;
      if (genClear && d > 4) {
        console.log("generator-go", { bossToGen: Math.hypot(b.x - 4, b.z + 6.2) });
        await moveTo(4, -6, 0.5);
        await page.keyboard.press("e");
        await page.waitForTimeout(200);
        await moveTo(-5.2, -7.2);
      } else {
        await moveTo(-5.2, 6.2);
        await page.waitForTimeout(400);
      }
    } else {
      await page.waitForTimeout(300);
    }
  }

  report.boss = {
    windows: bossWindows,
    bestHp,
    final: await diag("final"),
  };
  report.bestBossHp = bestHp;
  if (report.tankCanHitBoss == null)
    report.tankCanHitBoss = bossWindows.some((w) => w.damage > 0);
  if (report.adsWorks == null)
    report.adsWorks = bossWindows.some((w) =>
      w.aiming?.some((a) => a.aiming),
    );
  await page.screenshot({ path: `${out}/99-final.png` });
} catch (e) {
  report.error = String(e);
  report.stack = e.stack;
  console.log("PROBE ERROR", e);
  try {
    await page.screenshot({ path: `${out}/failure.png` });
    report.failDiag = await diag("failure");
  } catch {
    /* já morto */
  }
} finally {
  report.finished = new Date().toISOString();
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  console.log("PROBE REPORT", JSON.stringify({
    adsWorks: report.adsWorks,
    tankCanHitRegular: report.tankCanHitRegular,
    tankCanHitBoss: report.tankCanHitBoss,
    bestBossHp: report.bestBossHp,
    error: report.error,
    notes: report.notes,
  }, null, 2));
  await browser.close();
  process.exit(report.error && !report.tankCanHitBoss && !report.tankCanHitRegular ? 1 : 0);
}
