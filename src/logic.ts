import { validateAmbientSave } from "./environment-logic";
import {
  rooms,
  doors,
  endpoint,
  inward,
  clearPoint,
  type RoomId,
  type Vec,
  type Door,
  type EnemyKind,
  type Pickup,
} from "./world";
export type Region = "head" | "body" | "legL" | "legR";
export type Enemy = Vec & {
  id: string;
  room: RoomId;
  hp: number;
  boss: boolean;
  kind: EnemyKind;
  deathAt: number;
  removed: boolean;
  left: number;
  right: number;
  crawl: boolean;
  dead: boolean;
  headGone: boolean;
  lastHit?: Region;
  hitSerial?: number;
  lightStunned?: boolean;
  state: "chase" | "windup" | "recover" | "stun" | "charge";
  timer: number;
  exposure: number;
  lightCooldown: number;
  vulnerable: number;
  attack: number;
  dx: number;
  dz: number;
};
export type GameState = {
  version: 1;
  contentVersion?: 3 | 4;
  room: RoomId;
  player: Vec & { hp: number; yaw: number };
  ammo: number;
  reserve: number;
  kits: number;
  batteries: number;
  battery: number;
  light: boolean;
  items: string[];
  docs: string[];
  flags: Record<string, boolean>;
  enemies: Record<string, Enemy>;
  ambience?: import("./environment-logic").AmbientSave;
  time: number;
};
export function newGame(): GameState {
  const enemies: Record<string, Enemy> = {};
  for (const r of Object.values(rooms))
    for (const e of r.enemies)
      enemies[e.id] = {
        ...e,
        room: r.id,
        hp: enemyStats(e.kind || (e.boss ? "B01" : "E01")).hp,
        kind: e.kind || (e.boss ? "B01" : "E01"),
        deathAt: 0,
        removed: false,
        boss: !!e.boss,
        left: 42,
        right: 42,
        crawl: (e.kind || "") === "E05",
        dead: false,
        headGone: false,
        state: "chase",
        timer: 0,
        exposure: 0,
        lightCooldown: 0,
        vulnerable: 0,
        attack: 0,
        dx: 0,
        dz: 1,
      };
  return {
    version: 1,
    contentVersion: 4,
    room: "recepcao",
    player: { x: 0, z: 5, hp: 100, yaw: Math.PI },
    ammo: 12,
    reserve: 12,
    kits: 1,
    batteries: 1,
    battery: 100,
    light: true,
    items: [],
    docs: [],
    flags: {},
    enemies,
    ambience: { impacts: {}, broken: [] },
    time: 0,
  };
}
export function damage(
  e: Enemy,
  region: Region,
  rng = () => Math.random(),
  lightBonus = false,
) {
  if (e.dead) return { damage: 0, critical: false };
  e.lightStunned = false;
  e.lastHit = region;
  e.hitSerial = (e.hitSerial || 0) + 1;
  const mult = region === "head" ? 1.8 : region === "body" ? 1 : 0.8;
  let amount = 22 * mult;
  let critical = false;
  if (e.boss) {
    amount = e.vulnerable > 0 ? 22 * 2.5 : 3;
  } else if (region === "head" && amount < e.hp && rng() < 0.08) {
    amount = e.hp;
    critical = true;
  }
  e.hp = Math.max(0, e.hp - amount);
  if (e.hp === 0) {
    killEnemy(e);
    e.headGone = !e.boss && region === "head" && critical;
    e.timer = 0;
    return { damage: amount, critical };
  }
  if (!e.boss && (region === "legL" || region === "legR")) {
    const key = region === "legL" ? "left" : "right";
    e[key] = Math.max(0, e[key] - 22 * (lightBonus ? 1.25 : 1));
    if (e[key] <= 10) {
      e.crawl = true;
      e.state = "stun";
      e.timer = 1.1;
    }
  } else if (!e.boss) {
    e.state = "stun";
    e.timer = 0.25;
  }
  return { damage: amount, critical };
}
export function drainBattery(
  charge: number,
  dt: number,
  on: boolean,
  focus: boolean,
) {
  return Math.max(0, charge - (on ? (focus ? 2.2 : 0.45) * dt : 0));
}
export function applyLight(e: Enemy, dt: number, lit: boolean, focus: boolean) {
  e.lightCooldown = Math.max(0, e.lightCooldown - dt);
  if (e.dead || e.boss) return false;
  e.exposure = Math.max(
    0,
    Math.min(100, e.exposure + (lit ? (focus ? 30 : 12) : -15) * dt),
  );
  if (lit) {
    e.hp = Math.max(0, e.hp - (focus ? 2 : 0.8) * dt);
    if (e.hp === 0) {
      killEnemy(e);
      e.timer = 0;
    }
    if (e.exposure >= 65 && e.lightCooldown === 0 && !e.dead) {
      e.state = "stun";
      e.timer = 1;
      e.lightCooldown = 7;
      e.lightStunned = true;
      e.exposure = 25;
      return true;
    }
  }
  return false;
}
export function canTravel(d: Door, s: GameState) {
  return !d.key || !!s.flags[d.key];
}
export class Travel {
  active = false;
  async go(s: GameState, d: Door, load: (id: RoomId) => Promise<void>) {
    if (this.active || !canTravel(d, s) || !(d.a === s.room || d.b === s.room))
      return false;
    this.active = true;
    const target = endpoint(d, s.room);
    try {
      await load(target.to);
      const spawn = inward(target.spawn);
      if (!rooms[target.to] || !clearPoint(spawn, rooms[target.to].obstacles))
        throw Error("Spawn inválido");
      s.room = target.to;
      s.player.x = spawn.x;
      s.player.z = spawn.z;
      s.player.yaw = Math.atan2(-spawn.x, -spawn.z);
      return true;
    } finally {
      this.active = false;
    }
  }
}
export const SAVE_KEY = "limiar-save-v1";
function finite(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
export function parseSave(raw: string): GameState {
  const s = JSON.parse(raw) as GameState;
  const initial = newGame();
  if (
    !s ||
    s.version !== 1 ||
    (s.contentVersion !== undefined &&
      s.contentVersion !== 3 &&
      s.contentVersion !== 4) ||
    !Object.hasOwn(rooms, s.room) ||
    !s.player ||
    !finite(s.player.hp, 1, 100) ||
    !finite(s.player.x, -6.2, 6.2) ||
    !finite(s.player.z, -8.4, 8.4) ||
    !finite(s.player.yaw, -100, 100) ||
    !clearPoint(s.player, rooms[s.room].obstacles) ||
    !finite(s.ammo, 0, 12) ||
    !finite(s.reserve, 0, 999) ||
    !finite(s.battery, 0, 100) ||
    !finite(s.kits, 0, 99) ||
    !finite(s.batteries, 0, 99) ||
    !finite(s.time, 0, 1e9) ||
    typeof s.light !== "boolean" ||
    !Array.isArray(s.items) ||
    !s.items.every((x) => typeof x === "string") ||
    !Array.isArray(s.docs) ||
    !s.docs.every((x) => typeof x === "string") ||
    !s.flags ||
    Object.values(s.flags).some((x) => typeof x !== "boolean") ||
    !s.enemies
  )
    throw Error("Save inválido ou versão incompatível");
  const legacy = s.contentVersion !== 4;
  for (const [id, base] of Object.entries(initial.enemies)) {
    if (!s.enemies[id] && legacy) s.enemies[id] = { ...base };
    const raw = s.enemies[id];
    if (raw) {
      raw.kind ??= base.kind;
      if (raw.deathAt === undefined) {
        raw.deathAt = 0;
        raw.removed = raw.dead;
      }
    }
    const e = s.enemies[id];
    if (
      !e ||
      e.id !== id ||
      e.room !== base.room ||
      e.boss !== base.boss ||
      !finite(e.hp, 0, enemyStats(base.kind).hp) ||
      e.kind !== base.kind ||
      (e.hitSerial !== undefined && !finite(e.hitSerial, 0, 1e9)) ||
      (e.lastHit !== undefined &&
        !["head", "body", "legL", "legR"].includes(e.lastHit)) ||
      (e.lightStunned !== undefined && typeof e.lightStunned !== "boolean") ||
      !finite(e.deathAt, 0, 1e15) ||
      typeof e.removed !== "boolean" ||
      (!e.dead && e.removed) ||
      !finite(e.x, -6.3, 6.3) ||
      !finite(e.z, -8.5, 8.5) ||
      !finite(e.left, 0, 42) ||
      !finite(e.right, 0, 42) ||
      typeof e.dead !== "boolean" ||
      e.dead !== (e.hp === 0) ||
      typeof e.crawl !== "boolean" ||
      typeof e.headGone !== "boolean" ||
      !["chase", "windup", "recover", "stun", "charge"].includes(e.state) ||
      ![
        e.timer,
        e.exposure,
        e.lightCooldown,
        e.vulnerable,
        e.attack,
        e.dx,
        e.dz,
      ].every((n) => finite(n, -1e5, 1e5))
    )
      throw Error("Estado de inimigo inválido");
  }
  s.ambience = validateAmbientSave(s.ambience);
  s.contentVersion = 4;
  s.items = [...new Set([...s.items, ...s.docs])];
  updateCorpses(s);
  return s;
}
export function writeSave(
  s: GameState,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const data = JSON.stringify(s);
  parseSave(data);
  const old = storage.getItem(SAVE_KEY);
  if (old) storage.setItem(SAVE_KEY + "-backup", old);
  storage.setItem(SAVE_KEY, data);
}
export function validateGraph() {
  return doors.every((d) =>
    [d.a, d.b].every((id) =>
      clearPoint(
        inward(endpoint(d, id as RoomId).position),
        rooms[id as RoomId].obstacles,
      ),
    ),
  );
}
export class InputLatch {
  key = "";
  vector: Vec = { x: 0, z: 0 };
  get(key: string, calculate: () => Vec) {
    if (key !== this.key) {
      this.key = key;
      this.vector = key ? calculate() : { x: 0, z: 0 };
    }
    return this.vector;
  }
  clear() {
    this.key = "";
    this.vector = { x: 0, z: 0 };
  }
}

export const CORPSE_LIFETIME_MS = 5000;
export function enemyStats(kind: EnemyKind) {
  return {
    E01: { hp: 70, speed: 1.05, damage: 15, windup: 0.7, recover: 1.1 },
    E02: { hp: 85, speed: 0.92, damage: 18, windup: 1, recover: 1.8 },
    E04: { hp: 65, speed: 1.15, damage: 16, windup: 0.6, recover: 1.1 },
    E05: { hp: 48, speed: 0.86, damage: 12, windup: 0.55, recover: 1.0 },
    B01: { hp: 560, speed: 1.2, damage: 20, windup: 1.2, recover: 1.6 },
    B02: { hp: 700, speed: 1.15, damage: 18, windup: 1.0, recover: 1.5 },
  }[kind];
}
export function killEnemy(e: Enemy, now = Date.now()) {
  if (e.dead) return;
  e.hp = 0;
  e.dead = true;
  e.deathAt = now;
  e.removed = false;
  e.timer = 0;
}
export function corpseOpacity(e: Enemy, now = Date.now()) {
  if (!e.dead) return 1;
  if (e.removed) return 0;
  return Math.max(
    0,
    Math.min(1, (CORPSE_LIFETIME_MS - (now - e.deathAt)) / 500),
  );
}
export function updateCorpses(s: GameState, now = Date.now()) {
  for (const e of Object.values(s.enemies))
    if (e.dead && now - e.deathAt >= CORPSE_LIFETIME_MS) e.removed = true;
}
export function isCollected(s: GameState, id: string) {
  return s.items.includes(id) || s.docs.includes(id);
}
export function collect(s: GameState, i: Pickup) {
  if (isCollected(s, i.id)) return false;
  s.items.push(i.id);
  if (i.kind === "document") s.docs.push(i.id);
  if (i.kind === "ammo") s.reserve += 12;
  if (i.kind === "battery") s.batteries++;
  if (i.kind === "herb") s.kits++;
  if (i.kind === "fuse" || i.kind === "key") s.flags[i.id] = true;
  return true;
}
export function turnValve(s: GameState, n: number) {
  if (s.flags.pressao) return true;
  const stage = s.flags.valve2 ? 2 : s.flags.valve1 ? 1 : 0;
  if (n !== [3, 1, 2][stage]) {
    s.flags.valve1 = false;
    s.flags.valve2 = false;
    return false;
  }
  if (stage === 0) s.flags.valve1 = true;
  if (stage === 1) s.flags.valve2 = true;
  if (stage === 2) s.flags.pressao = true;
  return true;
}
export function enemyPattern(e: Enemy, d: number) {
  if (e.crawl) return { charge: false, feint: false, range: 0.9 };
  return {
    charge: e.kind === "E04" && d > 1.3,
    feint: e.kind === "E02",
    range: e.kind === "E04" ? 5 : e.kind === "E02" ? 1.8 : 1.25,
  };
}

export const BED_MARKS = ["baleia", "passaro", "arvore"] as const;
export type BedMark = (typeof BED_MARKS)[number];
/** P03: confirm the three marked beds. A wrong bed never softlocks; it only
 * gives an incremental hint. Flags persist through save/load. */
export function markBed(s: GameState, mark: string) {
  if (s.flags.prontuarios)
    return { ok: true, done: true, count: 3, hint: "already" };
  if (!(BED_MARKS as readonly string[]).includes(mark)) {
    s.flags.bedHint = true;
    const found = BED_MARKS.filter((m) => s.flags["bed-" + m]).length;
    return {
      ok: false,
      done: false,
      count: found,
      hint: "wrong",
    };
  }
  s.flags["bed-" + mark] = true;
  const count = BED_MARKS.filter((m) => s.flags["bed-" + m]).length;
  if (count === 3) s.flags.prontuarios = true;
  return { ok: true, done: count === 3, count, hint: "ok" };
}
