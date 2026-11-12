/**
 * Campanha 0.7.0 em segmentos encadeados por gravações reais do jogo.
 * Sem saves fabricados, teleporte ou HP falso. Até 2 tentativas por segmento.
 *
 * Segmento 1: início → (segura) → posto → abrigo. Retoma de uma gravação
 * real do próprio jogo (segura ou posto) na segunda tentativa.
 * Segmento 2: carrega a gravação real do abrigo e vai até o visor,
 * pela Preceptora.
 *
 * Uso:
 *   GAME_URL=... GAME_MODES=shoulder,tank SEGMENT_OUT=... node scripts/run-segments.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, access, writeFile, appendFile } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const gameUrl =
  process.env.GAME_URL || "http://127.0.0.1:4179/limiar-ecos-da-quarentena/";
const root = process.env.SEGMENT_OUT || "/workspace/limiar-v070-smoke/segments";
const modes = (process.env.GAME_MODES || "shoulder,tank")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const maxAttempts = Number(process.env.SEGMENT_ATTEMPTS || 2);

const exists = (p) => existsSync(p);

function log(line) {
  const row = `[${new Date().toISOString()}] ${line}`;
  console.log(row);
  return appendFile(path.join(root, "runner.log"), row + "\n").catch(() => {});
}

function runSmoke({ mode, until, resume, out, logFile }) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      GAME_URL: gameUrl,
      GAME_MODE: mode,
      SMOKE_UNTIL: until,
      SMOKE_OUT: out,
    };
    if (resume) env.RESUME_SAVE = resume;
    else delete env.RESUME_SAVE;
    const stream = createWriteStream(logFile, { flags: "a" });
    stream.write(
      `\n======= ${mode} until=${until} resume=${resume || "(novo)"} ${new Date().toISOString()} =======\n`,
    );
    const child = spawn("npm", ["run", "smoke"], {
      cwd: repo,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(stream, { end: false });
    child.stderr.pipe(stream, { end: false });
    child.stdout.on("data", (b) => process.stdout.write(b));
    child.stderr.on("data", (b) => process.stderr.write(b));
    child.on("close", (code) => {
      stream.end();
      resolve(code ?? 1);
    });
  });
}

await mkdir(root, { recursive: true });
const summary = { url: gameUrl, started: new Date().toISOString(), modes: {} };

for (const mode of modes) {
  const out = path.join(root, mode);
  const saves = path.join(out, "saves");
  await mkdir(saves, { recursive: true });
  const result = { mode, segments: {} };
  summary.modes[mode] = result;

  // --- Segmento 1 ---
  let seg1 = { attempts: [], passed: false, save: null };
  const abrigoExisting = path.join(saves, "save-abrigo.json");
  if (process.env.SKIP_SEG1 === "1") {
    if (exists(abrigoExisting)) {
      seg1.passed = true;
      seg1.save = abrigoExisting;
      seg1.skipped = "gravação real pré-existente";
      await log(
        `${mode} segmento 1 omitido (SKIP_SEG1); usa ${abrigoExisting}`,
      );
    } else {
      await log(
        `${mode} SKIP_SEG1=1 mas não há save-abrigo real em ${abrigoExisting}`,
      );
    }
  }
  for (let attempt = 1; attempt <= maxAttempts && !seg1.passed; attempt++) {
    const abrigo = path.join(saves, "save-abrigo.json");
    const posto = path.join(saves, "save-posto.json");
    const segura = path.join(saves, "save-segura.json");
    let resume = "";
    if (attempt > 1) {
      if (exists(abrigo)) {
        seg1.passed = true;
        seg1.save = abrigo;
        break;
      }
      if (exists(posto)) resume = posto;
      else if (exists(segura)) resume = segura;
    }
    const logFile = path.join(out, `seg1-a${attempt}.log`);
    await log(
      `${mode} segmento 1 tentativa ${attempt}/${maxAttempts} resume=${resume || "início"}`,
    );
    const code = await runSmoke({
      mode,
      until: "abrigo",
      resume,
      out,
      logFile,
    });
    const ok = code === 0 && exists(abrigo);
    seg1.attempts.push({
      attempt,
      resume: resume || null,
      exit: code,
      passed: ok,
      log: logFile,
      saves: {
        segura: exists(segura),
        posto: exists(posto),
        abrigo: exists(abrigo),
      },
    });
    await log(
      `${mode} segmento 1 tentativa ${attempt} exit=${code} abrigo=${exists(abrigo)}`,
    );
    if (ok) {
      seg1.passed = true;
      seg1.save = abrigo;
    }
  }
  result.segments[1] = seg1;

  if (!seg1.passed) {
    await log(`${mode} segmento 1 falhou nas ${maxAttempts} tentativas; segmento 2 não roda.`);
    result.segments[2] = { attempts: [], passed: false, skipped: true };
    continue;
  }

  // --- Segmento 2 ---
  let seg2 = { attempts: [], passed: false };
  for (let attempt = 1; attempt <= maxAttempts && !seg2.passed; attempt++) {
    const logFile = path.join(out, `seg2-a${attempt}.log`);
    await log(
      `${mode} segmento 2 tentativa ${attempt}/${maxAttempts} resume=${seg1.save}`,
    );
    const code = await runSmoke({
      mode,
      until: "end",
      resume: seg1.save,
      out,
      logFile,
    });
    const ok = code === 0;
    seg2.attempts.push({
      attempt,
      resume: seg1.save,
      exit: code,
      passed: ok,
      log: logFile,
    });
    await log(`${mode} segmento 2 tentativa ${attempt} exit=${code}`);
    if (ok) seg2.passed = true;
  }
  result.segments[2] = seg2;
}

summary.finished = new Date().toISOString();
summary.ok = modes.every(
  (m) => summary.modes[m].segments[1]?.passed && summary.modes[m].segments[2]?.passed,
);
await writeFile(path.join(root, "summary.json"), JSON.stringify(summary, null, 2));
await log("FIM " + JSON.stringify({ ok: summary.ok, modes: Object.fromEntries(Object.entries(summary.modes).map(([k, v]) => [k, { s1: v.segments[1]?.passed, s2: v.segments[2]?.passed }])) }));
process.exitCode = summary.ok ? 0 : 1;
