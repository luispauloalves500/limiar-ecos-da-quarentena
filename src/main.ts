import "./style.css";
import { View } from "./render";
import { Audio } from "./audio";
import {
  newGame,
  damage,
  drainBattery,
  applyLight,
  Travel,
  InputLatch,
  parseSave,
  writeSave,
  SAVE_KEY,
  type Region,
  type Enemy,
} from "./logic";
import {
  rooms,
  roomDoors,
  endpoint,
  dist,
  clearPoint,
  lineClear,
  type Vec,
  type RoomId,
} from "./world";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<div id="film"></div><div id="fade"></div><div id="top"><div class="brand">L / E Q <span>PROTÓTIPO 0.1</span></div><div id="location"></div><button id="pause" aria-label="Pausar">Ⅱ</button></div><div id="hud"><div><span class="tiny">HELENA DUARTE</span><b id="health"></b><div class="meter"><i id="healthbar"></i></div></div><div id="objective"></div><div class="equipment"><span id="ammo"></span><span id="battery"></span><small id="region"></small></div></div><div id="prompt"></div><div id="notice" role="status"></div><div id="target">＋</div><div id="threat"></div><div id="doorcaption"></div><div id="overlay"></div><div id="hint">WASD mover · Shift correr · E interagir · RMB/J mirar · LMB/K atirar · 1/2/3 região · F lanterna · Q foco · Tab inventário · M mapa</div>`;
const el = (id: string) => document.getElementById(id)!;
let view: View;
try {
  view = new View(app);
} catch (err) {
  el("overlay").innerHTML =
    `<section class="panel"><h1>WebGL 2 indisponível</h1><p>Use um navegador desktop atualizado com aceleração gráfica ativada.</p><p>${String(err)}</p></section>`;
  throw err;
}
const audio = new Audio();
let s = newGame();
const travel = new Travel(),
  latch = new InputLatch();
let mode:
  | "menu"
  | "play"
  | "pause"
  | "inventory"
  | "map"
  | "document"
  | "puzzle"
  | "dead"
  | "win" = "menu";
const keys = new Set<string>();
let aiming = false;
let mouseAim = false;
let targetId = "";
let region: Region = "head";
let shotCooldown = 0,
  reloadTime = 0,
  invulnerable = 1,
  trapCooldown = 0,
  doorTime = -1,
  doorDuration = 2.6;
let noticeTime = 0;
let fadeIn = 0;
let last = performance.now(),
  acc = 0;
let moving = false;
let clockHour = 0,
  clockMin = 0;
let deaths = 0;
let fpsFrames = 0,
  fpsTime = 0,
  fps = 0;
let stepTime = 0;
const frameSamples: number[] = [];
function announce(text: string) {
  el("notice").textContent = text;
  noticeTime = 4;
}
function buttons(events: Record<string, () => void>) {
  for (const [id, fn] of Object.entries(events))
    document.getElementById(id)?.addEventListener("click", fn);
}
function panel(content: string) {
  el("overlay").innerHTML = `<section class="panel">${content}</section>`;
  el("overlay").classList.add("visible");
  keys.clear();
  latch.clear();
  mouseAim = false;
  aiming = false;
  el("target").style.display = "none";
}
function close() {
  mode = "play";
  el("overlay").classList.remove("visible");
  el("overlay").innerHTML = "";
  keys.clear();
  latch.clear();
  last = performance.now();
}
function controls() {
  return `<div class="controls"><p><b>WASD</b> mover em relação à câmera · <b>Shift</b> correr</p><p><b>E</b> interagir · <b>botão direito / J</b> segurar mira · <b>botão esquerdo / K</b> disparar</p><p><b>1 / 2 / 3</b> cabeça / tronco / perna · <b>T</b> alternar alvo · <b>R</b> recarregar</p><p><b>F</b> lanterna · <b>Q</b> foco (mirando) · <b>B</b> bateria · <b>H</b> kit médico</p><p><b>Tab</b> inventário · <b>M</b> mapa · <b>Esc</b> pausa</p></div>`;
}
function menu() {
  mode = "menu";
  panel(
    `<div class="eyebrow">SANTA AVELINA / 1998</div><h1>LIMIAR<span>ECOS DA QUARENTENA</span></h1><p class="intro">Um rádio transmite o nome de alguém que não deveria estar vivo.<br>Você veio buscar Caio. O hospital ainda está à espera.</p><div class="actions"><button id="new" class="primary">INICIAR EXPEDIÇÃO <span>→</span></button><button id="load">CONTINUAR DO GRAVADOR</button></div><div class="tag">FATIA VERTICAL EXPERIMENTAL · ARTE 3D E ÁUDIO AUTORAIS</div><p class="muted">Terror e violência estilizada. Desktop / teclado e mouse. Não é a campanha completa do GDD.</p>${controls()}`,
  );
  buttons({
    new: () => {
      s = newGame();
      view.load(s.room, s);
      audio.start();
      close();
      announce("Caio: “Helena… leia meu bilhete na recepção.”");
    },
    load: loadGame,
  });
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      announce("Nenhuma gravação encontrada neste navegador.");
      return;
    }
    const loaded = parseSave(raw);
    s = loaded;
    view.load(s.room, s);
    audio.start();
    invulnerable = 1.5;
    reloadTime = 0;
    shotCooldown = 0;
    trapCooldown = 0;
    targetId = "";
    close();
    announce("Gravação restaurada.");
  } catch {
    announce(
      "Não foi possível carregar. Save ausente, corrompido ou incompatível. Seu slot não foi alterado.",
    );
  }
}
function pause() {
  if (mode === "play") {
    mode = "pause";
    panel(
      `<div class="eyebrow">SINAL INTERROMPIDO</div><h2>Pausa</h2>${controls()}<div class="actions"><button id="resume" class="primary">VOLTAR AO HOSPITAL</button><button id="sound">${audio.muted ? "LIGAR" : "SILENCIAR"} ÁUDIO</button><button id="quality">ALTERNAR RESOLUÇÃO</button><button id="load">CARREGAR GRAVAÇÃO</button><button id="menu">MENU PRINCIPAL</button></div><p class="muted">Salve no gravador do posto de rádio. Não há autosave antes do chefe.</p>`,
    );
    buttons({
      resume: close,
      sound: () => {
        audio.toggle();
        el("sound").textContent = audio.muted
          ? "LIGAR ÁUDIO"
          : "SILENCIAR ÁUDIO";
      },
      quality: () => {
        view.renderer.setPixelRatio(
          view.renderer.getPixelRatio() > 1
            ? 1
            : Math.min(window.devicePixelRatio, 1.5),
        );
        announce("Resolução de renderização alterada.");
      },
      load: loadGame,
      menu,
    });
  }
}
function inventory() {
  mode = "inventory";
  panel(
    `<div class="eyebrow">EQUIPAMENTO DE RESGATE</div><h2>Inventário</h2><div class="inventory"><div>PISTOLA 9 MM <strong>${s.ammo} / 12</strong><small>${s.reserve} na reserva</small></div><div>LANTERNA <strong>${Math.ceil(s.battery)}%</strong><small>${s.batteries} baterias de +35</small></div><div>KIT MÉDICO <strong>${s.kits}</strong><small>Recupera 60 HP</small></div><div>MISSÃO <strong>${s.flags.chave ? "Chave de manutenção" : "—"}</strong><small>${s.flags.fusivel ? (s.flags.energia ? "Fusível instalado" : "Fusível cerâmico") : "Sem fusível"}</small></div></div><div class="actions"><button id="heal">USAR KIT [H]</button><button id="cell">TROCAR BATERIA [B]</button><button id="back" class="primary">VOLTAR</button></div><h3>Documentos recuperados</h3><div class="actions">${
      s.docs
        .map(
          (id) =>
            `<button id="doc-${id}">${
              Object.values(rooms)
                .flatMap((r) => r.items)
                .find((i) => i.id === id)?.label
            }</button>`,
        )
        .join("") || "<p>Nenhum documento.</p>"
    }</div>`,
  );
  buttons({
    back: close,
    heal: () => {
      heal();
      inventory();
    },
    cell: () => {
      battery();
      inventory();
    },
  });
  for (const id of s.docs) buttons({ ["doc-" + id]: () => documentView(id) });
}
function documentView(id: string) {
  const doc = Object.values(rooms)
    .flatMap((r) => r.items)
    .find((i) => i.id === id)!;
  if (!s.docs.includes(id)) s.docs.push(id);
  mode = "document";
  panel(
    `<div class="eyebrow">ARQUIVO / ${id.toUpperCase()}</div><h2>${doc.label}</h2><blockquote>${doc.text}</blockquote><button id="back" class="primary">GUARDAR DOCUMENTO [E / ESC]</button>`,
  );
  buttons({ back: close });
}
function map() {
  mode = "map";
  panel(
    `<div class="eyebrow">PLANTA DO SETOR A</div><h2>Rotas de evacuação</h2><div class="map"><div class="maproute">RECEPÇÃO ↔ CORREDOR LESTE ↔ MANUTENÇÃO ↔ ÁTRIO<br>         ↙  ↘<br>      POSTO DE RÁDIO  ARQUIVO</div>${Object.values(
      rooms,
    )
      .map(
        (r) =>
          `<div class="maproom ${s.room === r.id ? "here" : ""}"><b>${s.room === r.id ? "● " : ""}${r.name}</b><span>${r.safe ? "Sala segura" : r.id === "gerador" && !s.flags.chave ? "Exige chave" : r.id === "atrio" && !s.flags.energia ? "Exige energia" : "Acessível pela rota"}</span></div>`,
      )
      .join(
        "",
      )}</div><p>Encontre o bilhete → ajuste o relógio em <b>03:15</b> → pegue a chave → instale o fusível no gerador → enfrente o Porteiro.</p><button id="back" class="primary">FECHAR MAPA [M / ESC]</button>`,
  );
  buttons({ back: close });
}
function puzzle() {
  mode = "puzzle";
  panel(
    `<div class="eyebrow">P01 / EVACUAÇÃO</div><h2>Relógio de plantão</h2><p>A inscrição diz: “A chave ficou presa na hora em que todos partiram.”</p><div class="clock"><button id="hour" aria-label="Aumentar hora">${String(clockHour).padStart(2, "0")}</button><span>:</span><button id="minute" aria-label="Aumentar minutos">${String(clockMin).padStart(2, "0")}</button></div><p class="muted">Clique na hora (+1) e nos minutos (+15). Consulte o bilhete de Caio.</p><div class="actions"><button id="solve" class="primary">TESTAR MECANISMO</button><button id="back">VOLTAR</button></div>`,
  );
  buttons({
    hour: () => {
      clockHour = (clockHour + 1) % 12;
      puzzle();
    },
    minute: () => {
      clockMin = (clockMin + 15) % 60;
      puzzle();
    },
    solve: () => {
      if (clockHour === 3 && clockMin === 15) {
        s.flags.chave = true;
        close();
        audio.tone(680, 0.5);
        announce("O compartimento abre. Chave de manutenção obtida.");
      } else announce("O mecanismo permanece travado.");
    },
    back: close,
  });
}
function heal() {
  if (s.kits < 1) return announce("Nenhum kit médico.");
  if (s.player.hp >= 100) return announce("Você não precisa de cura.");
  s.kits--;
  s.player.hp = Math.min(100, s.player.hp + 60);
  audio.tone(440, 0.3);
  announce("Kit usado: +60 de saúde.");
}
function battery() {
  if (!s.batteries) return announce("Nenhuma bateria de reserva.");
  if (s.battery > 80)
    return announce("Carga acima de 80%. Use depois para evitar desperdício.");
  s.batteries--;
  s.battery = Math.min(100, s.battery + 35);
  audio.tone(800, 0.15);
  announce("Bateria trocada: +35 de carga.");
}
function save() {
  try {
    writeSave(s, localStorage);
    announce("Gravação salva neste navegador.");
    audio.tone(550, 0.4);
  } catch {
    announce("Não foi possível salvar: armazenamento indisponível ou cheio.");
  }
}
type Interaction = { label: string; position: Vec; run: () => void };
function interactions(): Interaction[] {
  const r = rooms[s.room];
  const list: Interaction[] = roomDoors(s.room).map((d) => ({
    label: d.label,
    position: endpoint(d, s.room).position,
    run: () => {
      if (d.key && !s.flags[d.key]) {
        announce(
          d.key === "chave"
            ? "Trancada. A chave está no relógio do arquivo."
            : d.key === "energia"
              ? "Catracas sem energia. Instale o fusível no quadro elétrico."
              : "O Porteiro bloqueia este atalho.",
        );
        audio.tone(80, 0.18);
        return;
      }
      void changeRoom(d.id);
    },
  }));
  for (const i of r.items) {
    if (s.items.includes(i.id) && i.kind !== "document") continue;
    list.push({
      label: i.label,
      position: i,
      run: () => {
        if (i.kind === "document") {
          documentView(i.id);
          return;
        }
        s.items.push(i.id);
        if (i.kind === "ammo") s.reserve += 12;
        if (i.kind === "battery") s.batteries++;
        if (i.kind === "herb") s.kits++;
        if (i.kind === "fuse") s.flags.fusivel = true;
        audio.tone(660, 0.2);
        announce(i.label + " coletado.");
      },
    });
  }
  if (r.safe)
    list.push({
      label: "Salvar no gravador",
      position: { x: 0, z: -3 },
      run: save,
    });
  if (s.room === "arquivo")
    list.push({
      label: s.flags.chave ? "Compartimento vazio" : "Ajustar relógio",
      position: { x: 0, z: -6.6 },
      run: () =>
        s.flags.chave ? announce("A chave já está com você.") : puzzle(),
    });
  if (s.room === "gerador")
    list.push({
      label: s.flags.energia ? "Gerador funcionando" : "Instalar fusível",
      position: { x: 4, z: -6 },
      run: () => {
        if (s.flags.energia)
          return announce("Energia restaurada. Siga para o átrio.");
        if (!s.flags.fusivel)
          return announce(
            "Falta um fusível. Procure no carrinho perto da entrada.",
          );
        s.flags.energia = true;
        audio.tone(90, 0.8);
        announce("Energia restaurada. As catracas estão livres.");
      },
    });
  if (s.room === "atrio" && !s.flags.boss)
    list.push({
      label:
        trapCooldown > 0
          ? `Trava recarregando (${Math.ceil(trapCooldown)}s)`
          : "Acionar trava elétrica",
      position: { x: 0, z: -6.7 },
      run: () => {
        if (trapCooldown > 0)
          return announce("Circuito recarregando. Contorne as colunas.");
        const b = s.enemies.porteiro;
        trapCooldown = 12;
        b.vulnerable = 4;
        b.hp = Math.max(0, b.hp - 100);
        b.state = "stun";
        b.timer = 2;
        audio.tone(110, 0.7, 0.7, "sawtooth");
        announce("Armadura aberta por 4 segundos!");
        if (b.hp === 0) {
          b.dead = true;
          bossWin();
        }
      },
    });
  return list;
}
function nearest() {
  return interactions()
    .filter((i) => dist(s.player, i.position) < 1.8)
    .sort((a, b) => dist(s.player, a.position) - dist(s.player, b.position))[0];
}
async function changeRoom(id: string) {
  const d = roomDoors(s.room).find((d) => d.id === id)!;
  if (travel.active) return;
  doorDuration = 2.6;
  doorTime = 0;
  keys.clear();
  latch.clear();
  mouseAim = false;
  aiming = false;
  targetId = "";
  el("doorcaption").textContent = "ATRAVESSANDO / " + d.label.toUpperCase();
  el("doorcaption").classList.add("on");
  try {
    const ok = await travel.go(s, d, async (id: RoomId) => {
      await new Promise<void>((resolve) => {
        const wait = () => {
          if (doorTime >= doorDuration) resolve();
          else requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
      });
      // Construct and validate the destination behind the cinematic before commit.
      view.load(id, s);
    });
    if (ok) {
      invulnerable = 1.3;
      announce(rooms[s.room].name);
      audio.tone(80, 0.25);
    }
  } catch {
    view.load(s.room, s);
    announce(
      "Falha na passagem. Você continua na sala de origem; tente novamente.",
    );
  } finally {
    doorTime = -1;
    fadeIn = 0.35;
    el("doorcaption").classList.remove("on");
    keys.clear();
    latch.clear();
    last = performance.now();
  }
}
function candidates() {
  const dir = { x: Math.sin(s.player.yaw), z: Math.cos(s.player.yaw) };
  return Object.values(s.enemies)
    .filter((e) => {
      const d = dist(e, s.player);
      const screen = view.project(e, e.crawl ? 0.4 : 1.2);
      return (
        Math.abs(screen.x) < 1 &&
        Math.abs(screen.y) < 1 &&
        screen.z < 1 &&
        e.room === s.room &&
        !e.dead &&
        d < 11 &&
        ((e.x - s.player.x) * dir.x + (e.z - s.player.z) * dir.z) /
          Math.max(d, 0.01) >
          -0.25 &&
        lineClear(s.player, e, rooms[s.room].obstacles)
      );
    })
    .sort((a, b) => dist(a, s.player) - dist(b, s.player));
}
function getTarget() {
  const list = candidates();
  if (!list.some((e) => e.id === targetId)) targetId = list[0]?.id || "";
  return list.find((e) => e.id === targetId);
}
function fire() {
  if (
    mode !== "play" ||
    travel.active ||
    !aiming ||
    shotCooldown > 0 ||
    reloadTime > 0
  )
    return;
  if (s.ammo === 0) {
    announce("Carregador vazio. Pressione R.");
    audio.tone(170, 0.05);
    shotCooldown = 0.4;
    return;
  }
  s.ammo--;
  shotCooldown = 0.42;
  audio.shot();
  const e = getTarget();
  if (e) {
    const result = damage(
      e,
      e.crawl && region === "head" ? "head" : region,
      Math.random,
      e.exposure >= 25,
    );
    announce(
      e.dead
        ? result.critical
          ? "Crítico craniano. A ameaça foi neutralizada."
          : "Ameaça neutralizada."
        : e.boss
          ? e.vulnerable > 0
            ? "Núcleo atingido!"
            : "Armadura fechada. Use a trava elétrica."
          : e.crawl
            ? "Perna inutilizada. Ele ainda se move."
            : region === "head"
              ? "Impacto na cabeça."
              : "Impacto confirmado.",
    );
    if (e.boss && e.dead) bossWin();
  } else announce("Disparo sem alvo. Alinhe Helena com uma ameaça visível.");
}
function bossWin() {
  if (s.flags.boss) return;
  s.flags.boss = true;
  audio.tone(240, 1);
  announce("O Porteiro caiu. Chave administrativa recuperada. Atalho aberto.");
  setTimeout(() => {
    if (mode === "play" && s.flags.boss) {
      mode = "win";
      panel(
        `<div class="eyebrow">TRANSMISSÃO RECUPERADA</div><h2>O limiar foi cruzado.</h2><blockquote>“Helena… eu sabia que você viria. Não desça para o subsolo.”<br>— Caio, canal 03</blockquote><p>O Porteiro foi neutralizado e o atalho administrativo está aberto. Esta é a conclusão da fatia vertical, não o fim da campanha planejada.</p><p>Tempo: ${Math.floor(s.time / 60)} min · Documentos: ${s.docs.length} · Derrotas nesta sessão: ${deaths}</p><div class="actions"><button id="explore" class="primary">CONTINUAR EXPLORANDO</button><button id="menu">MENU PRINCIPAL</button></div>`,
      );
      buttons({ explore: close, menu });
    }
  }, 1400);
}
function hitPlayer(amount: number) {
  if (invulnerable > 0 || mode !== "play" || travel.active) return;
  s.player.hp = Math.max(0, s.player.hp - amount);
  invulnerable = 1.3;
  reloadTime = 0;
  audio.tone(75, 0.4, 0.8, "triangle");
  el("film").classList.add("hurt");
  setTimeout(() => el("film").classList.remove("hurt"), 220);
  if (s.player.hp === 0) {
    deaths++;
    mode = "dead";
    panel(
      `<div class="eyebrow">FIM DA TRANSMISSÃO</div><h2>O hospital ficou em silêncio.</h2><p>Observe os sinais de ataque. Recuar e poupar munição também é sobreviver.</p><div class="actions"><button id="load" class="primary">CARREGAR GRAVAÇÃO</button><button id="restart">RECOMEÇAR EXPEDIÇÃO</button></div>`,
    );
    buttons({
      load: loadGame,
      restart: () => {
        s = newGame();
        view.load(s.room, s);
        invulnerable = 1.5;
        close();
      },
    });
  }
}
function moveBody(
  p: Vec,
  dx: number,
  dz: number,
  r: number,
  enemyCheck = false,
) {
  const obs = rooms[s.room].obstacles;
  const ok = (q: Vec) =>
    clearPoint(q, obs, r) &&
    (!enemyCheck ||
      Object.values(s.enemies).every(
        (e) =>
          e.room !== s.room ||
          e.dead ||
          dist(e, q) > (e.crawl ? 0.42 : e.boss ? 0.8 : 0.6),
      ));
  if (ok({ x: p.x + dx, z: p.z })) p.x += dx;
  if (ok({ x: p.x, z: p.z + dz })) p.z += dz;
}
// Small deterministic navigation grid; no geometry or combat tick depends on render rate.
function pathDirection(e: Vec, p: Vec): Vec {
  if (lineClear(e, p, rooms[s.room].obstacles))
    return { x: p.x - e.x, z: p.z - e.z };
  const grid = (v: Vec) => ({ x: Math.round(v.x), z: Math.round(v.z) });
  const start = grid(e),
    goal = grid(p),
    key = (v: Vec) => `${v.x},${v.z}`;
  const q = [start],
    prev = new Map<string, Vec | null>([[key(start), null]]);
  let end: Vec | undefined;
  while (q.length) {
    const a = q.shift()!;
    if (dist(a, goal) < 1.5) {
      end = a;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const b = { x: a.x + dx, z: a.z + dz };
      if (!prev.has(key(b)) && clearPoint(b, rooms[s.room].obstacles, 0.4)) {
        prev.set(key(b), a);
        q.push(b);
      }
    }
  }
  if (!end) return { x: 0, z: 0 };
  let n = end;
  while (prev.get(key(n)) && key(prev.get(key(n))!) !== key(start))
    n = prev.get(key(n))!;
  return { x: n.x - e.x, z: n.z - e.z };
}
function tickEnemy(e: Enemy, dt: number) {
  if (e.dead) {
    e.timer += dt;
    return;
  }
  e.vulnerable = Math.max(0, e.vulnerable - dt);
  const d = dist(e, s.player);
  const dot =
    ((e.x - s.player.x) * Math.sin(s.player.yaw) +
      (e.z - s.player.z) * Math.cos(s.player.yaw)) /
    Math.max(0.01, d);
  const focus = aiming && keys.has("KeyQ");
  const lit =
    s.light &&
    s.battery > 0 &&
    d < (focus ? 8 : 9) &&
    dot > (focus ? 0.94 : 0.8) &&
    lineClear(s.player, e, rooms[s.room].obstacles);
  if (applyLight(e, dt, lit, focus)) audio.tone(320, 0.2);
  if (e.dead) return;
  if (e.timer > 0) e.timer -= dt;
  if (e.state === "stun" || e.state === "recover") {
    if (e.timer <= 0) e.state = "chase";
    return;
  }
  if (e.state === "windup") {
    if (e.timer <= 0) {
      if (e.boss && e.attack === 1) {
        e.state = "recover";
        e.timer = 1.7;
        const hit =
          lineClear(e, s.player, rooms[s.room].obstacles) &&
          d < 5 &&
          (s.player.x - e.x) * e.dx + (s.player.z - e.z) * e.dz > 0;
        moveBody(e, e.dx * 2.8, e.dz * 2.8, 0.6);
        if (hit && dist(e, s.player) < 2) hitPlayer(24);
      } else {
        if (
          d < (e.boss ? 2.8 : e.crawl ? 1.1 : 1.6) &&
          lineClear(e, s.player, rooms[s.room].obstacles)
        )
          hitPlayer(e.boss ? (e.hp < 336 ? 28 : 20) : 15);
        e.state = "recover";
        e.timer = e.boss ? 1.6 : 1.1;
      }
    }
    return;
  }
  if (
    d < (e.boss ? 5.5 : e.crawl ? 0.9 : 1.25) &&
    lineClear(e, s.player, rooms[s.room].obstacles)
  ) {
    e.state = "windup";
    e.timer = e.boss ? 1.2 : 0.7;
    e.attack = e.boss && d > 2.6 ? 1 : 0;
    e.dx = (s.player.x - e.x) / Math.max(d, 0.01);
    e.dz = (s.player.z - e.z) / Math.max(d, 0.01);
    audio.tone(e.boss ? 60 : 95, 0.5, 0.4, "triangle");
    return;
  }
  if (!e.boss && d > 9 && !aiming) return;
  const dir = pathDirection(e, s.player);
  const len = Math.hypot(dir.x, dir.z);
  if (len > 0.1) {
    const speed =
      (e.boss ? (e.hp < 336 ? 1.5 : 1.2) : e.crawl ? 0.36 : 1.05) *
      (e.exposure >= 25 ? 0.8 : 1);
    moveBody(
      e,
      (dir.x / len) * speed * dt,
      (dir.z / len) * speed * dt,
      e.boss ? 0.6 : 0.3,
    );
  }
}
function tick(dt: number) {
  if (mode !== "play" || travel.active) return;
  s.time += dt;
  invulnerable = Math.max(0, invulnerable - dt);
  shotCooldown = Math.max(0, shotCooldown - dt);
  trapCooldown = Math.max(0, trapCooldown - dt);
  if (reloadTime > 0) {
    reloadTime -= dt;
    if (reloadTime <= 0) {
      const amount = Math.min(12 - s.ammo, s.reserve);
      s.ammo += amount;
      s.reserve -= amount;
      announce("Pistola recarregada.");
    }
  }
  aiming = mouseAim || keys.has("KeyJ");
  s.battery = drainBattery(s.battery, dt, s.light, aiming && keys.has("KeyQ"));
  const x = Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    z = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const key = x || z ? `${x},${z}` : "";
  const v = latch.get(key, () => {
    const cx = view.camera.position.x,
      cz = view.camera.position.z,
      len = Math.hypot(cx, cz),
      fx = -cx / len,
      fz = -cz / len;
    const vx = fx * z - fz * x,
      vz = fz * z + fx * x;
    const l = Math.hypot(vx, vz);
    return { x: vx / l, z: vz / l };
  });
  moving = !!key;
  if (moving) {
    const speed =
      (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.7 : 2.2) *
      (aiming ? 0.4 : 1) *
      (s.player.hp <= 30 ? 0.88 : 1);
    moveBody(s.player, v.x * speed * dt, v.z * speed * dt, 0.3, true);
    if (!aiming) s.player.yaw = Math.atan2(v.x, v.z);
    stepTime -= dt;
    if (stepTime <= 0) {
      audio.tone(65, 0.04, 0.09, "triangle");
      stepTime = keys.has("ShiftLeft") ? 0.25 : 0.43;
    }
  }
  if (aiming) {
    const e = getTarget();
    if (e) s.player.yaw = Math.atan2(e.x - s.player.x, e.z - s.player.z);
  } else targetId = "";
  for (const e of Object.values(s.enemies))
    if (e.room === s.room) tickEnemy(e, dt);
}
function hud() {
  el("location").innerHTML =
    `${rooms[s.room].name}<small>${rooms[s.room].subtitle}</small>`;
  el("health").textContent = `${Math.ceil(s.player.hp)} / 100`;
  el("healthbar").style.width = s.player.hp + "%";
  el("healthbar").style.background =
    s.player.hp < 31 ? "#d37b65" : s.player.hp < 61 ? "#d5bc7c" : "#b9d2b7";
  el("ammo").textContent = `9 MM  ${s.ammo} / ${s.reserve}`;
  el("battery").textContent =
    `LUZ ${s.light ? "ON" : "OFF"}  ${Math.ceil(s.battery)}%  [${s.batteries}]`;
  el("region").textContent =
    `${reloadTime > 0 ? "RECARREGANDO…" : aiming ? "MIRA: " + (region === "head" ? "CABEÇA" : region === "body" ? "TRONCO" : "PERNA ESQUERDA") : "R recarregar · H curar"}`;
  el("objective").textContent = s.flags.boss
    ? "ATALHO ADMINISTRATIVO LIBERADO"
    : s.flags.energia
      ? "Enfrente o Porteiro no átrio"
      : s.flags.chave
        ? "Restaure a energia na manutenção"
        : "Encontre a chave no arquivo · 03:15";
  const i = mode === "play" && !travel.active ? nearest() : undefined;
  el("prompt").textContent = i ? "[ E ] " + i.label : "";
  el("top").style.opacity = travel.active ? "0" : "1";
  el("hud").style.opacity = travel.active ? "0" : "1";
  el("hint").style.opacity = mode === "play" && !travel.active ? "1" : "0";
  const e =
    aiming && mode === "play" && !travel.active ? getTarget() : undefined;
  if (e) {
    const v = view.project(
      e,
      e.crawl
        ? 0.6
        : region === "head"
          ? e.boss
            ? 2.6
            : 1.75
          : region === "body"
            ? 1.1
            : 0.4,
    );
    el("target").style.display = v.z < 1 ? "block" : "none";
    el("target").style.left = (v.x * 0.5 + 0.5) * innerWidth + "px";
    el("target").style.top = (-v.y * 0.5 + 0.5) * innerHeight + "px";
  } else el("target").style.display = "none";
  const threat = Object.values(s.enemies).find(
    (e) => e.room === s.room && !e.dead && e.state === "windup",
  );
  el("threat").textContent =
    mode === "play" && threat
      ? (threat.boss
          ? threat.attack === 1
            ? "INVESTIDA — SAIA DA LINHA"
            : "BRAÇO ERGUIDO — AFASTE-SE"
          : "ROS NADO / AFASTE-SE"
        ).replace("ROS NADO", "ROSNADO")
      : "";
}
window.addEventListener("keydown", (e) => {
  if (["Tab", "Space", "ArrowUp", "ArrowDown"].includes(e.code))
    e.preventDefault();
  if (e.repeat) return;
  if (travel.active) return;
  if (mode !== "play") {
    if (
      (e.code === "Escape" ||
        (mode === "inventory" && e.code === "Tab") ||
        (mode === "map" && e.code === "KeyM") ||
        (mode === "document" && e.code === "KeyE")) &&
      !["menu", "dead", "win"].includes(mode)
    )
      close();
    return;
  }
  keys.add(e.code);
  if (e.code === "Escape") pause();
  if (e.code === "Tab") inventory();
  if (e.code === "KeyM") map();
  if (e.code === "KeyE") nearest()?.run();
  if (e.code === "KeyF") {
    s.light = !s.light;
    audio.tone(450, 0.06);
  }
  if (e.code === "KeyB") battery();
  if (e.code === "KeyH") heal();
  if (e.code === "Digit1") region = "head";
  if (e.code === "Digit2") region = "body";
  if (e.code === "Digit3") region = "legL";
  if (e.code === "KeyT") {
    const list = candidates();
    targetId =
      list[(list.findIndex((e) => e.id === targetId) + 1) % list.length]?.id ||
      "";
  }
  if (e.code === "KeyR" && reloadTime <= 0) {
    if (s.ammo < 12 && s.reserve > 0) {
      reloadTime = 1.1;
      audio.tone(190, 0.2);
    } else
      announce(
        s.ammo === 12 ? "Carregador cheio." : "Sem cartuchos na reserva.",
      );
  }
  if (e.code === "KeyK") fire();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousedown", (e) => {
  if (
    (e.target as HTMLElement).tagName !== "CANVAS" ||
    mode !== "play" ||
    travel.active
  )
    return;
  audio.start();
  if (e.button === 2) mouseAim = true;
  if (e.button === 0) fire();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 2) mouseAim = false;
});
window.addEventListener("blur", () => {
  keys.clear();
  mouseAim = false;
  latch.clear();
  if (!travel.active) pause();
});
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  acc = 0;
  if (document.hidden) {
    keys.clear();
    mouseAim = false;
    if (!travel.active) pause();
  }
});
el("pause").addEventListener("click", () => {
  if (!travel.active) pause();
});
function frame(now: number) {
  requestAnimationFrame(frame);
  const realDelta = (now - last) / 1000;
  const delta = Math.min(0.1, realDelta);
  last = now;
  if (document.hidden) return;
  if (doorTime >= 0) doorTime += delta;
  if (noticeTime > 0) {
    noticeTime -= delta;
    el("notice").style.opacity = "1";
  } else el("notice").style.opacity = "0";
  acc = Math.min(0.15, acc + delta);
  while (acc >= 1 / 60) {
    tick(1 / 60);
    acc -= 1 / 60;
  }
  view.update(
    s,
    delta,
    moving && mode === "play" && !travel.active,
    aiming,
    aiming && keys.has("KeyQ"),
  );
  hud();
  view.render(
    travel.active && doorTime > 0.25
      ? Math.min(1, doorTime / doorDuration)
      : undefined,
  );
  fadeIn = Math.max(0, fadeIn - delta);
  const fade = travel.active
    ? doorTime < 0.25
      ? doorTime / 0.25
      : doorTime < 0.55
        ? 1 - (doorTime - 0.25) / 0.3
        : doorTime > doorDuration - 0.25
          ? (doorTime - doorDuration + 0.25) / 0.25
          : 0
    : fadeIn / 0.35;
  el("fade").style.opacity = String(Math.min(1, Math.max(0, fade)));
  fpsFrames++;
  fpsTime += realDelta;
  frameSamples.push(realDelta * 1000);
  if (frameSamples.length > 600) frameSamples.shift();
  if (fpsTime >= 1) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsTime = 0;
    fpsFrames = 0;
  }
}
// Read-only diagnostics for reproducible smoke tests; no gameplay shortcuts.
Object.defineProperty(window, "limiar", {
  get: () => ({
    room: s.room,
    hp: s.player.hp,
    player: { ...s.player },
    ammo: s.ammo,
    reserve: s.reserve,
    flags: { ...s.flags },
    mode,
    transition: travel.active,
    fps,
    drawCalls: view.renderer.info.render.calls,
    triangles: view.renderer.info.render.triangles,
    frameMs: [...frameSamples],
    enemies: JSON.parse(JSON.stringify(s.enemies)),
    camera: view.zone,
  }),
});
view.load(s.room, s);
menu();
requestAnimationFrame(frame);
