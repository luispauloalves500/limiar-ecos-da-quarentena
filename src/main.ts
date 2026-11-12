import { themes } from "./environment-logic";
import { ramp } from "./locomotion";
import { shove } from "./gameplay";
import { transitionOpacity, transitionElapsed } from "./presentation";
import { Vector3 } from "three";
import { preloadPlayer, playerDiagnostics, disposePlayerCache } from "./player";
import { preloadZombie, zombieDiagnostics } from "./zombie";
import {
  collect,
  isCollected,
  killEnemy,
  updateCorpses,
  turnValve,
  markBed,
  enemyStats,
  enemyPattern,
} from "./logic";
import "./style.css";
import { View } from "./render";
import { Audio } from "./audio";
import {
  VERSION,
  quickTurnRequested,
  defaults,
  PREF_KEY,
  parsePreferences,
  savePreferences,
  relativeMovement,
  tankMovement,
  wrapAngle,
  type CameraMode,
  type Quality,
} from "./controls";
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
  slideMove,
  type Vec,
  type RoomId,
} from "./world";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<div id="film"></div><div id="fade"></div><div id="top"><div class="brand">L / E Q <span>PROTÓTIPO ${VERSION}</span></div><div id="location"></div><button id="pause" aria-label="Pausar">Ⅱ</button></div><div id="hud"><div><span class="tiny">HELENA DUARTE</span><b id="health"></b><div class="meter"><i id="healthbar"></i></div></div><div id="objective"></div><div class="equipment"><span id="ammo"></span><span id="battery"></span><small id="region"></small></div></div><div id="prompt"></div><div id="notice" role="status"></div><div id="target">＋</div><div id="threat"></div><div id="doorcaption"></div><div id="overlay"></div><div id="hint">WASD mover · Shift correr · E interagir · RMB/J mirar · LMB/K atirar · 1/2/3 região · F lanterna · Q foco · Tab inventário · M mapa</div>`;
const el = (id: string) => document.getElementById(id)!;
let view: View;
try {
  view = new View(app);
} catch (err) {
  el("overlay").innerHTML =
    `<section class="panel"><h1>WebGL 2 indisponível</h1><p>Use um navegador desktop atualizado com aceleração gráfica ativada.</p><p>${String(err)}</p></section>`;
  throw err;
}
let prefs = { ...defaults };
try {
  prefs = parsePreferences(localStorage.getItem(PREF_KEY));
} catch {
  /* Local preferences are optional when browser storage is disabled. */
}
view.setPreferences(prefs);
const audio = new Audio();
audio.configure(prefs);
let s = newGame();
const travel = new Travel(),
  latch = new InputLatch();
let mode:
  | "credits"
  | "menu"
  | "play"
  | "pause"
  | "options"
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
  auxCooldown = 0,
  doorTime = -1,
  doorDuration = 2.6;
let shoveCooldown = 0,
  grappleLock = 0,
  creatureTime = 0;
let noticeTime = 0;
let fadeUntil = 0;
let doorStarted = 0;
let last = performance.now(),
  acc = 0;
let moving = false;
const velocity = { x: 0, z: 0 };
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
  if (document.pointerLockElement) document.exitPointerLock();
  el("overlay").classList.remove("title");
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
function persistPreferences() {
  view.setPreferences(prefs);
  audio.configure(prefs);
  try {
    savePreferences(prefs, localStorage);
  } catch {
    announce(
      "Preferências aplicadas nesta sessão; armazenamento indisponível.",
    );
  }
}
function switchMode(next?: CameraMode) {
  prefs.mode = next || (prefs.mode === "shoulder" ? "tank" : "shoulder");
  persistPreferences();
  view.syncCamera(s.player);
  keys.clear();
  latch.clear();
  mouseAim = false;
  targetId = "";
  if (document.pointerLockElement) document.exitPointerLock();
  announce(
    prefs.mode === "shoulder"
      ? "Câmera sobre o ombro. Clique na cena para controlar o mouse."
      : "Câmeras fixas / controles tank clássicos.",
  );
}
let optionsReturn = "menu";
function options() {
  if (mode !== "options") optionsReturn = mode;
  mode = "options";
  panel(
    `<div class="eyebrow">LIMIAR / ${VERSION}</div><h2>Opções</h2><div class="options-grid"><label>Visão principal<select id="opt-mode"><option value="shoulder" ${prefs.mode === "shoulder" ? "selected" : ""}>Sobre o ombro</option><option value="tank" ${prefs.mode === "tank" ? "selected" : ""}>Tank / câmeras fixas</option></select></label><label>Qualidade<select id="opt-quality">${[
      ["low", "Baixo"],
      ["medium", "Médio"],
      ["high", "Alto"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${prefs.quality === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Vida do ambiente<select id="opt-ambience">${[
      ["auto", "Seguir qualidade"],
      ["off", "Sem efeitos cosméticos"],
      ["low", "Baixa"],
      ["medium", "Média"],
      ["high", "Alta"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${prefs.ambience === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Sensibilidade <output id="sensitivity-value">${prefs.sensitivity.toFixed(1)}</output><input id="opt-sensitivity" type="range" min="0.2" max="3" step="0.1" value="${prefs.sensitivity}"></label><label><input id="opt-invert" type="checkbox" ${prefs.invertY ? "checked" : ""}> Inverter eixo Y</label><label><input id="opt-assist" type="checkbox" ${prefs.assist ? "checked" : ""}> Assistência leve (ombro)</label></div><div class="options-grid">${(
      [
        ["master", "Volume geral"],
        ["music", "Música"],
        ["effects", "Efeitos"],
        ["voices", "Vozes / respiração"],
      ] as const
    )
      .map(
        ([id, label]) =>
          `<label>${label}<input id="opt-${id}" aria-label="${label}" type="range" min="0" max="1" step="0.05" value="${prefs[id]}"></label>`,
      )
      .join(
        "",
      )}<label><input id="opt-subtitles" type="checkbox" ${prefs.subtitles ? "checked" : ""}> Legendas de sons e rádio</label></div><p class="muted">Baixo: resolução 60%, sem sombras/pós. Médio: 90%, sombra 512 e pós leve. Alto: 115%, sombra 1024 e mais poeira. Sem flashes obrigatórios; luzes oscilam apenas sutilmente.</p>${controls()}<button id="options-back" class="primary">VOLTAR</button>`,
  );
  for (const id of ["master", "music", "effects", "voices"] as const)
    el("opt-" + id).addEventListener("input", (e) => {
      prefs[id] = Number((e.target as HTMLInputElement).value);
      persistPreferences();
    });
  el("opt-subtitles").addEventListener("change", (e) => {
    prefs.subtitles = (e.target as HTMLInputElement).checked;
    persistPreferences();
  });
  (document.getElementById("opt-mode") as HTMLSelectElement).addEventListener(
    "change",
    (e) => {
      switchMode((e.target as HTMLSelectElement).value as CameraMode);
    },
  );
  (
    document.getElementById("opt-quality") as HTMLSelectElement
  ).addEventListener("change", (e) => {
    prefs.quality = (e.target as HTMLSelectElement).value as Quality;
    persistPreferences();
  });
  (
    document.getElementById("opt-sensitivity") as HTMLInputElement
  ).addEventListener("input", (e) => {
    prefs.sensitivity = Number((e.target as HTMLInputElement).value);
    el("sensitivity-value").textContent = prefs.sensitivity.toFixed(1);
    persistPreferences();
  });
  for (const id of ["invert", "assist"])
    document.getElementById("opt-" + id)!.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (id === "invert") prefs.invertY = checked;
      else prefs.assist = checked;
      persistPreferences();
    });
  document.getElementById("opt-ambience")?.addEventListener("change", (e) => {
    prefs.ambience = (e.target as HTMLSelectElement)
      .value as typeof prefs.ambience;
    persistPreferences();
  });
  buttons({
    "options-back": () => {
      if (optionsReturn === "menu") menu();
      else {
        mode = "play";
        pause();
      }
    },
  });
}
function controls() {
  return `<div class="controls"><p><b>V</b> ombro / tank · <b>Espaço</b> empurrão · <b>Shift</b> correr · <b>Alt</b> cautela · <b>E</b> interagir</p><p><b>Ombro:</b> clique na cena para capturar mouse; WASD relativo à câmera; mouse mira; C troca ombro; setas são alternativa ao mouse.</p><p><b>Tank:</b> W/S avança/recua, A/D gira; Z meia-volta; 1/2/3 escolhe cabeça/tronco/perna; T alterna alvo.</p><p><b>RMB / J</b> mirar · <b>LMB / K</b> disparar · <b>R</b> recarregar · <b>F / Q</b> lanterna / foco</p><p><b>B / H</b> bateria / cura · <b>Tab / M / Esc</b> inventário / mapa / pausa</p></div>`;
}
function menu() {
  mode = "menu";
  panel(
    `<div class="eyebrow">SANTA AVELINA · 03:15</div><h1>LIMIAR<span>ECOS DA QUARENTENA</span></h1><p class="intro">O sinal ainda está vivo.</p><div class="actions title-actions"><button id="new" class="primary">NOVA EXPEDIÇÃO <span>→</span></button><button id="load">CONTINUAR DO GRAVADOR</button><button id="options">OPÇÕES</button><button id="credits">CRÉDITOS</button></div><p class="muted">${VERSION} · Terror e violência estilizada · Desktop<br>↑ ↓ navegar · Enter escolher · Clique ou tecle para ativar áudio</p>`,
  );
  el("overlay").classList.add("title");
  el("new").focus();
  buttons({
    credits: () => {
      mode = "credits";
      panel(
        `<div class="eyebrow">LIMIAR</div><h2>Créditos</h2><p>Cenários, animações adicionais e áudio procedural originais. Modelos de Helena e zumbi fornecidos pelo usuário; autoria/licença original não verificadas.</p><p>Three.js · Vite · TypeScript. Sem áudio ou arte extraídos de outros jogos.</p><button id="back" class="primary">VOLTAR</button>`,
      );
      buttons({ back: menu });
    },
    new: () => {
      s = newGame();
      shoveCooldown = 0;
      grappleLock = 0;
      shotCooldown = 0;
      reloadTime = 0;
      invulnerable = 1.5;
      moving = false;
      velocity.x = velocity.z = 0;
      aiming = false;
      view.load(s.room, s);
      fadeUntil = performance.now() + 350;
      audio.start();
      close();
      announce("Caio: “Helena… leia meu bilhete na recepção.”");
    },
    options,
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
    shoveCooldown = 0;
    grappleLock = 0;
    view.load(s.room, s);
    audio.start();
    invulnerable = 1.5;
    reloadTime = 0;
    shotCooldown = 0;
    trapCooldown = 0;
    auxCooldown = 0;
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
      `<div class="eyebrow">SINAL INTERROMPIDO</div><h2>Pausa</h2>${controls()}<div class="actions"><button id="resume" class="primary">VOLTAR AO HOSPITAL</button><button id="sound">${audio.muted ? "LIGAR" : "SILENCIAR"} ÁUDIO</button><button id="quality">OPÇÕES / CÂMERA / GRÁFICOS</button><button id="load">CARREGAR GRAVAÇÃO</button><button id="menu">MENU PRINCIPAL</button></div><p class="muted">Salve nos gravadores dos dois postos seguros. Não há autosave antes do chefe.</p>`,
    );
    buttons({
      resume: close,
      sound: () => {
        audio.toggle();
        el("sound").textContent = audio.muted
          ? "LIGAR ÁUDIO"
          : "SILENCIAR ÁUDIO";
      },
      quality: options,
      load: loadGame,
      menu,
    });
  }
}
function inventory() {
  mode = "inventory";
  panel(
    `<div class="eyebrow">EQUIPAMENTO DE RESGATE</div><h2>Inventário</h2><div class="inventory"><div>PISTOLA 9 MM <strong>${s.ammo} / 12</strong><small>${s.reserve} na reserva</small></div><div>LANTERNA <strong>${Math.ceil(s.battery)}%</strong><small>${s.batteries} baterias de +35</small></div><div>KIT MÉDICO <strong>${s.kits}</strong><small>Recupera 60 HP</small></div><div>MISSÃO <strong>${s.flags.chave ? "Chave de manutenção" : "—"}</strong><small>${s.flags.fusivel ? (s.flags.energia ? "Fusível instalado" : "Fusível cerâmico") : "Sem fusível"}</small><small>${s.flags.pulseira ? "Pulseira de serviço 203" : "Sem pulseira de serviço"}</small><small>${s.flags.cracha ? "Crachá cirúrgico da Preceptora" : "Sem crachá cirúrgico"}</small></div></div><div class="actions"><button id="heal">USAR KIT [H]</button><button id="cell">TROCAR BATERIA [B]</button><button id="back" class="primary">VOLTAR</button></div><h3>Documentos recuperados</h3><div class="actions">${
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
    }</div><h3>Diário de campo</h3><div class="fieldnotes">${Object.values(
      rooms,
    )
      .filter((r) => r.id === s.room || s.flags["ambient:" + r.id])
      .map(
        (r) =>
          `<details><summary>${r.name}</summary><p>${themes[r.id].story}</p></details>`,
      )
      .join("")}</div>`,
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
  if (!s.items.includes(id)) s.items.push(id);
  view.removePickup(id);
  mode = "document";
  panel(
    `<div class="eyebrow">ARQUIVO / ${id.toUpperCase()}</div><h2>${doc.label}</h2><blockquote>${doc.text}</blockquote><button id="back" class="primary">GUARDAR DOCUMENTO [E / ESC]</button>`,
  );
  buttons({ back: close });
}
function map() {
  mode = "map";
  panel(
    `<div class="eyebrow">PLANTA DOS SETORES A / INTERNAÇÃO / PEDIATRIA</div><h2>Rotas de evacuação</h2><div class="map"><div class="maproute">RECEPÇÃO ↔ CORREDOR LESTE ↔ MANUTENÇÃO ↔ ÁTRIO<br>         ↙  ↘<br>      POSTO DE RÁDIO  ARQUIVO<br>ÁTRIO → PATAMAR → INTERNAÇÃO ↔ POSTO DE ENFERMAGEM<br>INTERNAÇÃO ↔ ENFERMARIA 203<br>INTERNAÇÃO → LAVANDERIA → ISOLAMENTO → PORTA 13 → ESPERA<br>ESPERA ↔ PLANTÃO (SEGURO) · ESPERA → BRINQUEDOTECA → BERÇÁRIO → LEITOS → CIRCULAR → VISOR</div>${Object.values(
      rooms,
    )
      .map(
        (r) =>
          `<div class="maproom ${s.room === r.id ? "here" : ""}"><b>${s.room === r.id ? "● " : ""}${r.name}</b><span>${r.safe ? "Sala segura" : r.id === "gerador" && !s.flags.chave ? "Exige chave" : r.id === "atrio" && !s.flags.energia ? "Exige energia" : r.id === "escadaria" && !s.flags.boss ? "Exige Porteiro neutralizado" : r.id === "lavanderia" && !s.flags.pulseira ? "Exige pulseira 203" : r.id === "isolamento" && !s.flags.pressao ? "Exige purga de pressão" : r.id === "espera" && !s.flags.final ? "Exige transmissão da Porta 13" : r.id === "circulo" && !s.flags.prontuarios ? "Exige os três prontuários" : r.id === "visor" && !s.flags.preceptora ? "Exige a Preceptora neutralizada" : "Acessível pela rota"}</span></div>`,
      )
      .join(
        "",
      )}</div><p>Encontre o bilhete → relógio <b>03:15</b> → fusível → Porteiro → pulseira 203 → válvulas 3–1–2 → Porta 13 → três prontuários da pediatria → Preceptora (gerador auxiliar) → visor / crachá.</p><button id="back" class="primary">FECHAR MAPA [M / ESC]</button>`,
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
              : d.key === "pulseira"
                ? "Falta a pulseira de serviço do leito 203."
                : d.key === "pressao"
                  ? "Barreira pressurizada. Regule as válvulas na lavanderia."
                  : d.key === "final"
                    ? "A Porta 13 só abre depois da transmissão no terminal."
                    : d.key === "prontuarios"
                      ? "A enfermaria circular pede os três prontuários marcados."
                      : d.key === "preceptora"
                        ? "O visor só abre com o crachá da Preceptora."
                        : "O Porteiro bloqueia este acesso.",
        );
        audio.tone(80, 0.18);
        return;
      }
      void changeRoom(d.id);
    },
  }));
  for (const i of r.items) {
    if (isCollected(s, i.id)) continue;
    list.push({
      label: i.label,
      position: i,
      run: () => {
        if (!collect(s, i)) return;
        view.removePickup(i.id);
        el("prompt").textContent = "";
        if (i.kind === "document") {
          documentView(i.id);
          return;
        }
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
          killEnemy(b);
          bossWin();
        }
      },
    });
  if (s.room === "lavanderia" && !s.flags.pressao)
    list.push({
      label: s.flags.pressao
        ? "Pressão estabilizada"
        : "Regular válvulas de pressão",
      position: { x: 4, z: -6.2 },
      run: pressurePuzzle,
    });
  if (s.room === "isolamento" && !s.flags.final)
    list.push({
      label: "Transmitir fita e abrir a Porta 13",
      position: { x: 0, z: -6.5 },
      run: () => {
        if (!s.enemies.febril02.dead)
          return announce(
            "Movimento detectado. Neutralize o Febril antes de abrir a Porta 13.",
          );
        s.flags.final = true;
        audio.tone(240, 1);
        announce(
          "Fita transmitida. A Porta 13 cedeu. Três batidas respondem do lado da pediatria.",
        );
      },
    });
  if (s.room === "leitos" && !s.flags.prontuarios) {
    for (const [mark, x, z, label] of [
      ["baleia", -2, -2, "Leito da baleia azul"],
      ["passaro", 0, -5.2, "Leito do pássaro vermelho"],
      ["arvore", 2, -2, "Leito da árvore verde"],
      ["errante", 0, 3.2, "Leito sem marca"],
    ] as const)
      list.push({
        label,
        position: { x, z },
        run: () => {
          const r = markBed(s, mark);
          audio.tone(r.ok ? 420 : 90, 0.2);
          if (r.done)
            announce(
              "Três prontuários confirmados. A enfermaria circular se abre.",
            );
          else if (!r.ok)
            announce(
              r.count
                ? "Este prontuário é isca. Lia falou da que nada, da que voa e da que enraíza."
                : "Prontuário incompleto. Procure as três marcas no plantão: baleia, pássaro, árvore.",
            );
          else announce(r.count + "/3 leitos confirmados.");
        },
      });
  }
  if (s.room === "circulo" && !s.flags.preceptora)
    list.push({
      label:
        auxCooldown > 0
          ? `Gerador auxiliar recarregando (${Math.ceil(auxCooldown)}s)`
          : "Ligar gerador auxiliar",
      position: { x: 4, z: -6.2 },
      run: () => {
        if (auxCooldown > 0)
          return announce("O circuito ainda recarrega. Contorne os leitos.");
        const b = s.enemies.preceptora;
        if (!b || b.dead) return announce("O gerador não responde mais.");
        auxCooldown = 20;
        b.vulnerable = 15;
        b.state = "stun";
        b.timer = 1.2;
        view.dim = 1;
        audio.tone(90, 0.8);
        announce("Quinze segundos de claridade. A Preceptora está exposta.");
      },
    });
  if (s.room === "visor")
    list.push({
      label: s.flags.cirurgia
        ? "Registro concluído"
        : "Registrar o crachá no visor",
      position: { x: 0, z: -6.5 },
      run: () => {
        if (!s.flags.preceptora)
          return announce("O visor exige o crachá da Preceptora.");
        if (s.flags.cirurgia) return announce("O registro já foi feito.");
        s.flags.cirurgia = true;
        pediatricWin();
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
  view.playerAnimation?.trigger("Door");
  doorDuration = 2.6;
  audio.play("door", s.player);
  doorTime = 0;
  doorStarted = performance.now();
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
          if (transitionElapsed(performance.now(), doorStarted) >= doorDuration)
            resolve();
          else requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
      });
      // Construct and validate the destination behind the cinematic before commit.
      view.load(id, s);
    });
    if (ok) {
      view.syncCamera(s.player);
      invulnerable = 1.3;
      if (s.room === "isolamento" && !s.flags.alerta) {
        s.flags.alerta = true;
        announce(
          "ALARME DE ISOLAMENTO · Neutralize o movimento e sele a Porta 13.",
        );
        audio.tone(180, 1, 0.4, "sawtooth");
      } else announce(rooms[s.room].name);
      audio.tone(80, 0.25);
    }
  } catch {
    view.load(s.room, s);
    announce(
      "Falha na passagem. Você continua na sala de origem; tente novamente.",
    );
  } finally {
    doorTime = -1;
    fadeUntil = performance.now() + 350;
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
  const shot = prefs.mode === "shoulder" ? view.shot(s) : undefined;
  const e =
    prefs.mode === "shoulder"
      ? shot
        ? s.enemies[shot.id]
        : undefined
      : getTarget();
  const hitRegion = shot?.region || region;
  const origin =
    prefs.mode === "shoulder"
      ? view.camera.position
      : view.playerAnimation?.barrel.getWorldPosition(new Vector3()) ||
        new Vector3(s.player.x, 1.35, s.player.z);
  const direction =
    prefs.mode === "shoulder"
      ? view.camera.getWorldDirection(new Vector3())
      : new Vector3(Math.sin(s.player.yaw), 0, Math.cos(s.player.yaw));
  const impact =
    shot?.point ||
    (e
      ? view.hitPosition(e.id, hitRegion)
      : prefs.mode === "shoulder"
        ? view.wallImpact()
        : view.directionImpact(origin, direction));
  if (prefs.mode === "tank" && impact)
    direction.copy(impact).sub(origin).normalize();
  view.environment?.shot(s, origin, direction, impact, !e);
  view.shotFx(s, impact, !!e);
  if (e) {
    const result = damage(e, hitRegion, Math.random, e.exposure >= 25);
    audio.play(hitRegion === "head" ? "head" : "flesh", e);
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
            : hitRegion === "head"
              ? "Impacto na cabeça."
              : "Impacto confirmado.",
    );
    if (e.boss && e.dead) {
      if (e.kind === "B02") preceptoraWin();
      else bossWin();
    }
  } else announce("Impacto no cenário. A munição foi consumida.");
}
function bossWin() {
  if (s.flags.boss) return;
  s.flags.boss = true;
  audio.tone(240, 1);
  announce(
    "Porteiro neutralizado. Acesso à internação aberto à direita. Caio ainda transmite.",
  );
}
function pressurePuzzle() {
  mode = "puzzle";
  panel(
    `<div class="eyebrow">P02 / LAVANDERIA</div><h2>Circuito de pressão</h2><p>Ordem de purga: consulte os registros de Lia. Uma sequência incorreta reinicia as válvulas.</p><p>Etapas corretas: ${s.flags.valve2 ? 2 : s.flags.valve1 ? 1 : 0}/3</p><div class="actions"><button id="valve-1">1 · ENTRADA</button><button id="valve-2">2 · DESCARGA</button><button id="valve-3">3 · RETORNO</button></div><button id="back">VOLTAR</button>`,
  );
  buttons({ back: close });
  for (const n of [1, 2, 3])
    buttons({
      ["valve-" + n]: () => {
        const ok = turnValve(s, n);
        audio.tone(ok ? 420 : 90, 0.2);
        if (s.flags.pressao) {
          close();
          announce("Pressão estabilizada. Barreira de isolamento liberada.");
        } else {
          pressurePuzzle();
          announce(
            ok
              ? "Válvula confirmada."
              : "Sequência incorreta. Circuito reiniciado.",
          );
        }
      },
    });
}
function preceptoraWin() {
  if (s.flags.preceptora) return;
  s.flags.preceptora = true;
  s.flags.cracha = true;
  view.dim = 1;
  audio.tone(240, 1);
  announce(
    "Preceptora neutralizada. O crachá cirúrgico abre o visor ao fundo.",
  );
}
function pediatricWin() {
  mode = "win";
  audio.tone(240, 1);
  panel(
    `<div class="eyebrow">CRACHÁ CIRÚRGICO / VISOR</div><h2>Água do outro lado.</h2><blockquote>“Se você chegou até aqui, não desça sem gravar o que viu. O Mergulhador não é uma metáfora.” — Caio</blockquote><p>O crachá da Preceptora abre o visor, não a porta de cirurgia. Do outro lado, a água chega ao tornozelo e uma válvula grande demais para este andar bate em ritmo lento. A Porta 13 era só o começo da lista.</p><p>Conclusão da ala de pediatria. O centro cirúrgico e a estação hídrica continuam à frente, ainda não construídos.</p><p>Derrotas nesta sessão: ${deaths} · Documentos: ${s.docs.length} · Tempo: ${Math.floor(s.time / 60)} min</p><div class="actions"><button id="explore" class="primary">CONTINUAR EXPLORANDO</button><button id="menu">MENU PRINCIPAL</button></div>`,
  );
  buttons({ explore: close, menu });
}
function hitPlayer(amount: number, grapple = false, attacker?: Enemy) {
  if (invulnerable > 0 || mode !== "play" || travel.active) return;
  s.player.hp = Math.max(0, s.player.hp - amount);
  view.hurtTime = 0.35;
  view.playerAnimation?.trigger(grapple ? "Grabbed" : "Hit");
  if (attacker)
    view.playerAnimation?.hitFrom(
      Math.atan2(attacker.x - s.player.x, attacker.z - s.player.z),
    );
  if (grapple && attacker) {
    grappleLock = 0.5;
    s.player.yaw = Math.atan2(attacker.x - s.player.x, attacker.z - s.player.z);
    attacker.dx =
      (s.player.x - attacker.x) / Math.max(0.1, dist(attacker, s.player));
    attacker.dz =
      (s.player.z - attacker.z) / Math.max(0.1, dist(attacker, s.player));
    announce("AGARRÃO · Espaço para empurrar e abrir distância.");
  }
  invulnerable = 1.3;
  reloadTime = 0;
  audio.play("flesh", s.player);
  el("film").classList.add("hurt");
  setTimeout(() => el("film").classList.remove("hurt"), 220);
  if (s.player.hp === 0) {
    deaths++;
    mode = "dead";
    panel(
      `<div class="eyebrow">FIM DA TRANSMISSÃO</div><h2>O hospital ficou em silêncio.</h2><p>Observe os sinais de ataque. Recuar e poupar munição também é sobreviver.</p><div class="actions"><button id="load" class="primary">CARREGAR GRAVAÇÃO</button><button id="restart">RECOMEÇAR EXPEDIÇÃO</button></div>`,
    );
    buttons({
      options,
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
  avoidPlayer = false,
) {
  const obs = rooms[s.room].obstacles;
  const ok = (q: Vec) =>
    clearPoint(q, obs, r) &&
    (!avoidPlayer || dist(q, s.player) > (r > 0.5 ? 1.05 : 0.55)) &&
    (!enemyCheck ||
      Object.values(s.enemies).every(
        (e) =>
          e.room !== s.room ||
          e.dead ||
          dist(e, q) > (e.crawl ? 0.42 : e.boss ? 0.8 : 0.6),
      ));
  slideMove(p, dx, dz, ok);
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
function bossPhase(e: Enemy) {
  const r = e.hp / enemyStats(e.kind).hp;
  return r > 0.71 ? 1 : r > 0.31 ? 2 : 3;
}
function tickEnemy(e: Enemy, dt: number) {
  if (e.dead) return;
  // B02 helpers stay under the beds until phase 2.
  if (
    (e.id === "rastejador03" || e.id === "rastejador04") &&
    s.enemies.preceptora &&
    !s.enemies.preceptora.dead &&
    bossPhase(s.enemies.preceptora) === 1
  )
    return;
  e.vulnerable = Math.max(0, e.vulnerable - dt);
  const d = dist(e, s.player);
  const stats = enemyStats(e.kind),
    pattern = enemyPattern(e, d);
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
    lineClear(s.player, e, rooms[s.room].obstacles) &&
    view.illuminates(e.id, focus);
  if (applyLight(e, dt, lit, focus)) audio.tone(320, 0.2);
  if (e.dead) return;
  if (e.timer > 0) e.timer -= dt;
  if (e.state === "stun" || e.state === "recover") {
    if (e.timer <= 0) e.state = "chase";
    return;
  }
  if (e.state === "charge") {
    if (e.crawl) {
      e.state = "recover";
      e.timer = 1.1;
      return;
    }
    const old = { x: e.x, z: e.z };
    moveBody(e, e.dx * 7 * dt, e.dz * 7 * dt, 0.3, false, true);
    if (
      e.attack === 1 &&
      dist(e, s.player) < 1.5 &&
      lineClear(e, s.player, rooms[s.room].obstacles)
    ) {
      hitPlayer(stats.damage, e.kind === "E02" && !e.crawl, e);
      e.attack = 2;
    }
    if (e.timer <= 0 || dist(e, old) < 0.001) {
      e.state = "recover";
      e.timer = stats.recover;
    }
    return;
  }
  if (e.state === "windup") {
    if (e.timer <= 0) {
      if (e.kind === "E04" && e.attack === 1 && !e.crawl) {
        e.state = "charge";
        e.timer = 0.5;
      } else if (e.kind === "E02" && !e.crawl) {
        moveBody(e, e.dx * 0.65, e.dz * 0.65, 0.3, false, true);
        if (
          dist(e, s.player) < 1.9 &&
          lineClear(e, s.player, rooms[s.room].obstacles)
        )
          hitPlayer(stats.damage, e.kind === "E02" && !e.crawl, e);
        e.state = "recover";
        e.timer = stats.recover;
      } else if (e.boss && e.attack === 1) {
        e.state = "recover";
        e.timer = 1.7;
        const hit =
          lineClear(e, s.player, rooms[s.room].obstacles) &&
          d < 5 &&
          (s.player.x - e.x) * e.dx + (s.player.z - e.z) * e.dz > 0;
        moveBody(e, e.dx * 2.8, e.dz * 2.8, 0.6, false, true);
        if (hit && dist(e, s.player) < 2) hitPlayer(24);
      } else {
        if (
          d < (e.boss ? 2.8 : e.crawl ? 1.1 : 1.6) &&
          lineClear(e, s.player, rooms[s.room].obstacles)
        )
          hitPlayer(
            e.boss
              ? bossPhase(e) >= 3
                ? 28
                : e.kind === "B02"
                  ? 18
                  : 20
              : stats.damage,
            e.kind === "E02" && !e.crawl,
            e,
          );
        e.state = "recover";
        e.timer = stats.recover;
      }
    }
    return;
  }
  if (
    d < (e.boss ? 5.5 : pattern.range) &&
    lineClear(e, s.player, rooms[s.room].obstacles)
  ) {
    e.state = "windup";
    e.timer = stats.windup;
    e.attack = (e.boss && d > 2.6) || pattern.charge ? 1 : 0;
    e.dx = (s.player.x - e.x) / Math.max(d, 0.01);
    e.dz = (s.player.z - e.z) / Math.max(d, 0.01);
    if (pattern.feint)
      moveBody(e, -e.dx * 0.45, -e.dz * 0.45, 0.3, false, true);
    audio.play("grunt", e);
    return;
  }
  if (!e.boss && d > 9 && !aiming) return;
  const dir = pathDirection(e, s.player);
  const len = Math.hypot(dir.x, dir.z);
  if (len > 0.1) {
    const speed =
      (e.boss
        ? bossPhase(e) >= 3
          ? 1.55
          : 1.2
        : e.crawl
          ? e.kind === "E05"
            ? 0.82
            : 0.36
          : stats.speed) * (e.exposure >= 25 ? 0.8 : 1);
    moveBody(
      e,
      (dir.x / len) * speed * dt,
      (dir.z / len) * speed * dt,
      e.boss ? 0.6 : 0.3,
      false,
      true,
    );
  }
}
function tick(dt: number) {
  if (mode !== "play" || travel.active) return;
  s.time += dt;
  shoveCooldown = Math.max(0, shoveCooldown - dt);
  grappleLock = Math.max(0, grappleLock - dt);
  invulnerable = Math.max(0, invulnerable - dt);
  shotCooldown = Math.max(0, shotCooldown - dt);
  trapCooldown = Math.max(0, trapCooldown - dt);
  auxCooldown = Math.max(0, auxCooldown - dt);
  const pre = s.enemies.preceptora;
  view.dim =
    s.room === "circulo" &&
    pre &&
    !pre.dead &&
    bossPhase(pre) >= 2 &&
    pre.vulnerable <= 0
      ? 0.32
      : 1;
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
  if (prefs.mode === "shoulder") {
    const lookX =
      Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    const lookY = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
    if (lookX || lookY) view.look(lookX * dt * 540, lookY * dt * 360);
  }
  let v: Vec;
  if (prefs.mode === "tank") {
    const tank = tankMovement(z, x, s.player.yaw, dt);
    s.player.yaw = tank.yaw;
    v = tank.vector;
  } else v = relativeMovement(x, z, view.yaw);
  if (grappleLock > 0) v = { x: 0, z: 0 };
  const speed =
    (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 3.7 : 2.2) *
    (aiming ? 0.4 : 1) *
    (s.player.hp <= 30 ? 0.88 : 1) *
    (keys.has("AltLeft") ? 0.65 : 1);
  // 0.6: short symmetric accel/decel ramp (≈0.1 s) instead of instant
  // velocity, so starts/stops read physically; grabs still stop at once.
  const tx = v.x * speed,
    tz = v.z * speed;
  if (grappleLock > 0) velocity.x = velocity.z = 0;
  velocity.x = ramp(velocity.x, tx, dt, 0.1 / Math.max(1, speed));
  velocity.z = ramp(velocity.z, tz, dt, 0.1 / Math.max(1, speed));
  moving = Math.hypot(velocity.x, velocity.z) > 0.12;
  if (moving) {
    moveBody(s.player, velocity.x * dt, velocity.z * dt, 0.3, true);
    if (prefs.mode === "shoulder" && !aiming && (v.x || v.z)) {
      const desired = Math.atan2(v.x, v.z);
      s.player.yaw = wrapAngle(
        s.player.yaw +
          wrapAngle(desired - s.player.yaw) * (1 - Math.exp(-dt * 15)),
      );
    }
    stepTime -= dt;
    if (stepTime <= 0) {
      audio.step(s.room, s.player);
      stepTime = keys.has("ShiftLeft") ? 0.25 : 0.43;
    }
  }
  if (aiming && prefs.mode === "shoulder") s.player.yaw = view.yaw;
  else if (aiming && prefs.mode === "tank" && !x) {
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
    `${reloadTime > 0 ? "RECARREGANDO…" : aiming ? (prefs.mode === "shoulder" ? "MIRA LIVRE / RETÍCULA" : "MIRA: " + (region === "head" ? "CABEÇA" : region === "body" ? "TRONCO" : "PERNA ESQUERDA")) : "R recarregar · H curar"}`;
  el("objective").textContent = s.flags.cirurgia
    ? "CRACHÁ REGISTRADO / O CENTRO CIRÚRGICO ESPERA"
    : s.flags.preceptora
      ? "Registre o crachá no visor da ante-sala"
      : s.flags.prontuarios
        ? "Enfrente a Preceptora · gerador auxiliar à direita"
        : s.flags.final
          ? "Pediatria: confirme os três leitos marcados"
          : s.flags.pressao
            ? "Transmita a fita e abra a Porta 13"
            : s.flags.pulseira
              ? "Lavanderia: purgue na ordem 3 → 1 → 2"
              : s.flags.boss
                ? "Acesso à internação → leito 203"
                : s.flags.energia
                  ? "Neutralize o Porteiro no átrio"
                  : s.flags.chave
                    ? "Instale o fusível no gerador"
                    : "Encontre a chave no arquivo · 03:15";
  const i = mode === "play" && !travel.active ? nearest() : undefined;
  el("prompt").textContent = i ? "[ E ] " + i.label : "";
  el("top").style.opacity = travel.active ? "0" : "1";
  el("hud").style.opacity = travel.active ? "0" : "1";
  el("hint").style.opacity = mode === "play" && !travel.active ? "1" : "0";
  if (prefs.mode === "shoulder") {
    const show = mode === "play" && !travel.active;
    el("target").style.display = show ? "block" : "none";
    el("target").style.left = "50%";
    el("target").style.top = "50%";
    el("target").classList.toggle("hip", !aiming);
    el("target").style.color =
      aiming && view.shot(s, false) ? "#deb68d" : "#c7d1ba";
  } else {
    el("target").classList.remove("hip");
    const e =
      aiming && mode === "play" && !travel.active ? getTarget() : undefined;
    if (e) {
      const pos = view.hitPosition(e.id, region);
      const v = pos?.project(view.camera);
      el("target").style.display = v && v.z < 1 ? "block" : "none";
      if (v) {
        el("target").style.left = (v.x * 0.5 + 0.5) * innerWidth + "px";
        el("target").style.top = (-v.y * 0.5 + 0.5) * innerHeight + "px";
      }
    } else el("target").style.display = "none";
  }
  el("hint").textContent =
    prefs.mode === "shoulder"
      ? "OMBRO · Clique para capturar mouse · WASD / Shift / Alt cauteloso · RMB/J mirar · LMB/K atirar · E interagir · Espaço empurrar · C ombro · V tank · Esc pausa"
      : "TANK · W/S avançar/recuar · A/D girar · Z meia-volta · 1/2/3 região · E interagir · Espaço empurrar · V ombro · Esc pausa";
  const threat = Object.values(s.enemies).find(
    (e) => e.room === s.room && !e.dead && e.state === "windup",
  );
  el("threat").textContent =
    mode === "play" && threat
      ? (threat.boss
          ? threat.attack === 1
            ? "INVESTIDA — SAIA DA LINHA"
            : "BRAÇO ERGUIDO — AFASTE-SE"
          : shoveCooldown > 0
            ? "RECUPERANDO FÔLEGO / RECUAR"
            : "ROSNADO / ESPAÇO EMPURRAR OU RECUAR"
        ).replace("ROS NADO", "ROSNADO")
      : "";
}
window.addEventListener("keydown", (e) => {
  if (mode === "menu" && !audio.ctx) audio.start();
  if (mode === "menu" && ["ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
    const b = [
      ...document.querySelectorAll<HTMLButtonElement>(
        "#overlay button:not(:disabled)",
      ),
    ];
    let i = b.indexOf(document.activeElement as HTMLButtonElement);
    i = (i + (e.code === "ArrowDown" ? 1 : -1) + b.length) % b.length;
    b[i]?.focus();
    return;
  }
  if (mode === "credits" && e.code === "Escape") {
    menu();
    return;
  }
  if (mode === "play" && e.altKey) e.preventDefault();
  if (
    (mode === "play" || (mode === "inventory" && e.code === "Tab")) &&
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (travel.active) return;
  if (mode !== "play") {
    if (mode === "options" && e.code === "Escape") {
      document.getElementById("options-back")?.click();
      return;
    }
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
  if (e.code === "Space" && shoveCooldown <= 0) {
    const ids = shove(s);
    if (ids.length) {
      shoveCooldown = 3;
      grappleLock = 0;
      view.playerAnimation?.trigger("BreakFree");
      audio.play("shove");
      announce("Empurrão · abra distância. Recuperação: 3 s.");
    } else announce("Nenhuma ameaça ao alcance do empurrão.");
  }
  if (e.code === "KeyV") switchMode();
  if (e.code === "KeyC") {
    prefs.shoulder = prefs.shoulder === 1 ? -1 : 1;
    persistPreferences();
  }
  if (quickTurnRequested(e.code, prefs.mode)) {
    s.player.yaw = wrapAngle(s.player.yaw + Math.PI);
    view.playerAnimation?.trigger("QuickTurn");
  }
  if (e.code === "Tab") inventory();
  if (e.code === "KeyM") map();
  if (e.code === "KeyE") {
    const n = nearest();
    if (n) {
      view.playerAnimation?.trigger("Interact");
      n.run();
    }
  }
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
      audio.play("reload");
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
  if (
    prefs.mode === "shoulder" &&
    !document.pointerLockElement &&
    e.button === 0
  ) {
    try {
      const lock = view.renderer.domElement.requestPointerLock();
      lock?.catch(() =>
        announce(
          "Mouse não capturado. Use setas para olhar ou arraste com botão direito.",
        ),
      );
    } catch {
      announce("Use setas para olhar ou arraste com botão direito.");
    }
    return;
  }
  if (e.button === 2) mouseAim = true;
  if (e.button === 0) fire();
});
window.addEventListener("mousemove", (e) => {
  if (
    mode === "play" &&
    !travel.active &&
    prefs.mode === "shoulder" &&
    (document.pointerLockElement || e.buttons === 2)
  )
    view.look(e.movementX, e.movementY);
});
document.addEventListener("pointerlockchange", () => {
  if (
    !document.pointerLockElement &&
    mode === "play" &&
    !travel.active &&
    prefs.mode === "shoulder"
  )
    pause();
});
document.addEventListener("pointerlockerror", () =>
  announce("Captura de mouse indisponível. As setas continuam disponíveis."),
);
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
  const realDelta = Math.max(0, (now - last) / 1000);
  const delta = Math.min(0.1, realDelta);
  last = now;
  updateCorpses(s);
  if (document.hidden) return;
  if (travel.active)
    doorTime = transitionElapsed(performance.now(), doorStarted);
  if (noticeTime > 0) {
    noticeTime -= delta;
    el("notice").style.opacity = "1";
  } else el("notice").style.opacity = "0";
  acc = Math.min(0.15, acc + delta);
  while (acc >= 1 / 60) {
    tick(1 / 60);
    acc -= 1 / 60;
  }
  view.playerFrame = {
    running: keys.has("ShiftLeft") || keys.has("ShiftRight"),
    cautious: keys.has("AltLeft"),
    reloading: reloadTime > 0,
  };
  view.environmentActive = mode === "play" && !travel.active;
  view.update(
    s,
    delta,
    moving && mode === "play" && !travel.active,
    aiming,
    aiming && keys.has("KeyQ"),
  );
  audio.update(
    s.room,
    s.player,
    view.yaw,
    delta,
    mode === "play" && !travel.active,
    Math.max(
      0,
      ...Object.values(s.enemies)
        .filter((e) => e.room === s.room && !e.dead)
        .map((e) => Math.max(0, 1 - dist(e, s.player) / 9)),
    ),
    s.player.hp,
    mode === "menu" ||
      mode === "credits" ||
      (mode === "options" && optionsReturn === "menu"),
  );
  creatureTime -= delta;
  if (mode === "play" && !travel.active && creatureTime <= 0) {
    creatureTime = 2.8;
    const e = Object.values(s.enemies).find(
      (e) => e.room === s.room && !e.dead && dist(e, s.player) < 8,
    );
    if (e) {
      audio.play("grunt", e);
      audio.burst(180, 0.23, 0.08, e);
    }
  }
  for (const cue of view.environment?.sounds.splice(0) || []) {
    audio.environment(cue.kind, cue.x, cue.z);
    const caption: Record<string, string> = {
      telefone: "O telefone toca. A linha não deveria funcionar.",
      sombra: "Uma sombra atravessa o corredor.",
      radio: "Rádio: ...03:16... deixe o canal aberto...",
      batidas: "Batidas atrás da parede. Ninguém responde.",
      maca: "Rodas de maca deslizam na penumbra.",
      porta: "Uma porta bate ao fundo.",
      vapor: "A tubulação libera um sopro de vapor.",
      faíscas: "Faíscas escapam de um fio solto.",
    };
    if (prefs.subtitles && caption[cue.kind] && noticeTime <= 0)
      announce(caption[cue.kind]);
  }
  app.dataset.screen = mode;
  hud();
  view.render(
    travel.active && doorTime > 0.25
      ? Math.min(1, doorTime / doorDuration)
      : undefined,
    mode === "menu" ||
      mode === "credits" ||
      (mode === "options" && optionsReturn === "menu"),
  );
  const fade = travel.active
    ? doorTime < 0.25
      ? doorTime / 0.25
      : doorTime < 0.55
        ? 1 - (doorTime - 0.25) / 0.3
        : doorTime > doorDuration - 0.25
          ? (doorTime - doorDuration + 0.25) / 0.25
          : 0
    : transitionOpacity(performance.now(), fadeUntil);
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
    fade: Number(el("fade").style.opacity || 0),
    shoveCooldown,
    weaponReady: shotCooldown <= 0 && reloadTime <= 0,
    reloading: reloadTime > 0,
    aiming,
    version: VERSION,
    asset: zombieDiagnostics(),
    playerAsset: playerDiagnostics(),
    playerAnimation: view.playerAnimation?.diagnostic(),
    environment: view.environment?.diagnostics(),
    ambientState: JSON.parse(
      JSON.stringify(s.ambience || { impacts: {}, broken: [] }),
    ),
    audio: { ...audio.spatialDiagnostics, levels: { ...audio.levels } },
    playerScreen: view.project(s.player, 1.3).toArray(),
    preferences: { ...prefs },
    cameraYaw: view.yaw,
    cameraPitch: view.pitch,
    cameraPosition: view.camera.position.toArray(),
    aimTargets: view.aimTargets(s),
    rayHit: view.shot(s, false),
    pointerLocked: !!document.pointerLockElement,
    worldObjects: view.worldObjects(),
    worldLabels: view.worldLabels(),
    collected: [...s.items],
    documents: [...s.docs],
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
    scene: view.sceneStats(),
    triangles: view.renderer.info.render.triangles,
    frameMs: [...frameSamples],
    enemies: JSON.parse(JSON.stringify(s.enemies)),
    camera: view.zone,
  }),
});
panel(
  `<div class="eyebrow">PREPARANDO O HOSPITAL</div><h2>Carregando personagens e animações</h2><p id="assetprogress">0%</p><p>Helena, zumbi e LOD são carregados uma vez.</p>`,
);
Promise.allSettled([
  preloadZombie((n) => {
    const p = document.getElementById("assetprogress");
    if (p) p.textContent = "Zumbi: " + n + "%";
  }),
  preloadPlayer(),
]).then((results) => {
  for (const r of results)
    if (r.status === "rejected")
      console.warn("Modelo indisponível; fallback procedural:", r.reason);
  view.installPlayer();
  view.load(s.room, s);
  menu();
  if (
    zombieDiagnostics().status !== "ready" ||
    playerDiagnostics().status !== "ready"
  )
    announce("Falha no modelo. Fallback procedural de segurança ativo.");
});
window.addEventListener("pagehide", (e) => {
  if (!e.persisted) {
    view.playerAnimation?.dispose();
    disposePlayerCache();
  }
});
requestAnimationFrame(frame);

window.addEventListener(
  "pointerdown",
  () => {
    if (!audio.ctx) audio.start();
  },
  { capture: true },
);
el("overlay").addEventListener("focusin", (e) => {
  if ((e.target as HTMLElement).tagName === "BUTTON") audio.play("ui");
});
