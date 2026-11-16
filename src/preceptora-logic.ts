import type { Enemy } from "./logic";
import type { Vec } from "./world";

/** B02 move codes, stored in `Enemy.attack` (a finite number, so saves stay valid). */
export const MOVE = {
  NONE: 0,
  SLASH: 10,
  DASH: 11,
  SHEET: 12,
  TRIPLE: 13,
  SPIN: 14,
  CLEAVE: 15,
  ROAR: 16,
  SHOCK: 17,
} as const;
export type MoveCode = (typeof MOVE)[keyof typeof MOVE];

export type MoveSpec = {
  name: string;
  /** Telegraph time before anything can hurt. */
  windup: number;
  /** Active (dangerous) time after the windup. */
  active: number;
  damage: number;
  recover: number;
  /** Danger zone: radius for area moves, length for line moves. */
  reach: number;
  /** Half-angle (radians) of the cone in front of her; PI = all around. */
  cone: number;
};

/** GDD B02 values; windups are the readable telegraph windows. */
export const MOVES: Record<number, MoveSpec> = {
  [MOVE.SLASH]: {
    name: "Corte de bisturi",
    windup: 0.95,
    active: 0.2,
    damage: 18,
    recover: 1.3,
    reach: 2.6,
    cone: 0.9,
  },
  [MOVE.DASH]: {
    name: "Corrida de bisturi",
    windup: 1.05,
    active: 0.55,
    damage: 18,
    recover: 1.4,
    reach: 4.2,
    cone: 0.2,
  },
  [MOVE.SHEET]: {
    name: "Puxão por lençol",
    windup: 0.95,
    active: 0.25,
    damage: 16,
    recover: 1.2,
    reach: 5.6,
    cone: 0.32,
  },
  [MOVE.TRIPLE]: {
    name: "Sequência de três cortes",
    windup: 1.3,
    active: 1.2,
    damage: 14,
    recover: 1.3,
    reach: 2.5,
    cone: 1.0,
  },
  [MOVE.SPIN]: {
    name: "Giro cortante",
    windup: 1.1,
    active: 0.65,
    damage: 24,
    recover: 1.5,
    reach: 2.5,
    cone: Math.PI,
  },
  [MOVE.CLEAVE]: {
    name: "Golpe vertical",
    windup: 1.3,
    active: 0.2,
    damage: 30,
    recover: 1.7,
    reach: 3.0,
    cone: 0.42,
  },
};

export const PRECEPTORA = {
  /** Roar at each phase change; she does not attack during it. */
  roar: 1.5,
  /** Generator: shock stagger, then the armour stays open for `vulnerable`. */
  shock: 2.0,
  vulnerable: 15,
  /** Metres she is thrown away from the generator by the discharge. */
  knockback: 1.4,
  /** Pause between attacks (stalking) so the player can read and react. */
  breather: 0.75,
  /** Longer pause after a hit lands: no stun-lock chains (0.8 tank QA). */
  breatherAfterHit: 1.4,
  /** Maximum drag of the sheet pull, metres. */
  pull: 1.2,
  /** Speed multiplier while the armour is open (she limps). */
  exposedSpeed: 0.72,
  /** Range in which she starts an attack at all. */
  engage: 6,
};

export function preceptoraPhase(hp: number, max: number) {
  const r = hp / max;
  return r > 0.71 ? 1 : r > 0.31 ? 2 : 3;
}

/** Deterministic choice given an rng; never the same move three times in a row. */
export function chooseMove(
  phase: number,
  d: number,
  rng: () => number,
  last: number[] = [],
): MoveCode {
  const options: [MoveCode, number][] = [];
  if (phase === 1) {
    if (d < 2.4) options.push([MOVE.SLASH, 3]);
    if (d >= 2.2 && d < 5.2) options.push([MOVE.DASH, 3]);
    if (d >= 2.6 && d < 5.6) options.push([MOVE.SHEET, 2]);
  } else if (phase === 2) {
    if (d < 2.4) options.push([MOVE.TRIPLE, 4], [MOVE.SLASH, 1]);
    if (d >= 2.2 && d < 5.2) options.push([MOVE.DASH, 2]);
    if (d >= 2.6 && d < 5.6) options.push([MOVE.SHEET, 3]);
  } else {
    if (d < 2.4) options.push([MOVE.SPIN, 3], [MOVE.CLEAVE, 3]);
    else if (d < 2.9) options.push([MOVE.CLEAVE, 3]);
    if (d >= 2.2 && d < 5.2) options.push([MOVE.DASH, 3]);
    if (d >= 2.9 && d < 5.6) options.push([MOVE.SHEET, 1]);
  }
  const repeated =
    last.length >= 2 && last[last.length - 1] === last[last.length - 2]
      ? last[last.length - 1]
      : -1;
  const pool = options.filter(([m]) => m !== repeated);
  const list = pool.length ? pool : options;
  if (!list.length) return MOVE.NONE;
  const total = list.reduce((a, [, w]) => a + w, 0);
  let pick = rng() * total;
  for (const [m, w] of list) {
    pick -= w;
    if (pick <= 0) return m;
  }
  return list[list.length - 1][0];
}

/** Is `p` inside the danger zone of `move` for an attacker at `e` facing (dx, dz)? */
export function inDanger(
  e: Vec & { dx: number; dz: number },
  p: Vec,
  move: number,
) {
  const spec = MOVES[move];
  if (!spec) return false;
  const vx = p.x - e.x,
    vz = p.z - e.z,
    d = Math.hypot(vx, vz);
  if (d > spec.reach) return false;
  if (spec.cone >= Math.PI || d < 0.35) return true;
  const len = Math.hypot(e.dx, e.dz) || 1;
  const cos = (vx * e.dx + vz * e.dz) / (d * len);
  if (move === MOVE.SHEET || move === MOVE.DASH) {
    // Line attacks: lateral distance from the telegraphed lane.
    const along = (vx * e.dx + vz * e.dz) / len;
    const lateral = Math.abs((vx * e.dz - vz * e.dx) / len);
    return along > 0 && lateral < (move === MOVE.SHEET ? 0.7 : 0.85);
  }
  return cos > Math.cos(spec.cone);
}

export type PreceptoraContext = {
  player: Vec;
  maxHp: number;
  clear: (a: Vec, b: Vec) => boolean;
  /** Moves her with collision; returns nothing, position is read back. */
  move: (e: Enemy, dx: number, dz: number) => void;
  hit: (amount: number, move: MoveCode) => void;
  /** Drag the player toward her by up to `metres`. */
  pull: (metres: number) => void;
  /** Free-text cue for audio/captions ("telegraph", "roar", "strike"…). */
  cue: (name: string, move: MoveCode) => void;
  rng: () => number;
  flags: Record<string, boolean>;
  /** Pathfinding direction toward the player. */
  path: () => Vec;
};

const history = new WeakMap<Enemy, number[]>();
const struck = new WeakMap<Enemy, number>();
const landed = new WeakSet<Enemy>();

/** One fixed-step tick of the Preceptora. Pure apart from the context. */
export function tickPreceptora(
  e: Enemy,
  dt: number,
  context: PreceptoraContext,
) {
  if (e.dead) return;
  const c: PreceptoraContext = {
    ...context,
    hit: (n, m) => {
      landed.add(e);
      context.hit(n, m);
    },
  };
  e.vulnerable = Math.max(0, e.vulnerable - dt);
  const vx = c.player.x - e.x,
    vz = c.player.z - e.z,
    d = Math.hypot(vx, vz);
  const phase = preceptoraPhase(e.hp, c.maxHp);
  if (e.timer > 0) e.timer -= dt;
  // Phase change: a harmless roar that slams the tray armour shut, so each
  // phase needs its own generator window (GDD: three phases, 20 s recharge).
  for (const p of [2, 3])
    if (phase >= p && !c.flags["b02-fase" + p]) {
      c.flags["b02-fase" + p] = true;
      e.state = "stun";
      e.attack = MOVE.ROAR;
      e.timer = PRECEPTORA.roar;
      e.vulnerable = 0;
      c.cue("phase" + p, MOVE.ROAR);
      return;
    }
  if (e.state === "stun") {
    if (e.timer <= 0) {
      e.state = "chase";
      e.attack = MOVE.NONE;
      e.timer = PRECEPTORA.breather;
    }
    return;
  }
  if (e.state === "recover") {
    if (e.timer <= 0) {
      e.state = "chase";
      e.attack = MOVE.NONE;
      e.timer = landed.has(e)
        ? PRECEPTORA.breatherAfterHit
        : PRECEPTORA.breather;
      landed.delete(e);
    }
    return;
  }
  const spec = MOVES[e.attack];
  if (e.state === "windup" && spec) {
    if (e.timer <= 0) {
      e.state = "charge";
      e.timer = spec.active;
      struck.set(e, 0);
      c.cue("strike", e.attack as MoveCode);
    }
    return;
  }
  if (e.state === "charge" && spec) {
    const elapsed = spec.active - e.timer;
    const already = struck.get(e) || 0;
    if (e.attack === MOVE.DASH) {
      const before = { x: e.x, z: e.z };
      c.move(e, e.dx * 7.5 * dt, e.dz * 7.5 * dt);
      if (!already && d < 1.35 && c.clear(e, c.player)) {
        c.hit(spec.damage, MOVE.DASH);
        struck.set(e, 1);
      }
      // Stopped by furniture (not by reaching Helena).
      const stuck =
        Math.hypot(e.x - before.x, e.z - before.z) < 0.001 &&
        Math.hypot(c.player.x - e.x, c.player.z - e.z) > 1.4;
      if (stuck || e.timer <= 0) {
        e.state = "recover";
        // Hitting a bed or wall leaves the blade stuck: a bigger opening.
        e.timer = spec.recover + (stuck ? 0.8 : 0);
        if (stuck) c.cue("stuck", MOVE.DASH);
      }
      return;
    }
    if (e.attack === MOVE.TRIPLE) {
      // Three cuts at 0.1 s, 0.5 s and 0.9 s, each a step forward.
      const cuts = [0.1, 0.5, 0.9].filter((t) => elapsed >= t).length;
      if (cuts > already) {
        struck.set(e, cuts);
        c.move(e, e.dx * 0.35, e.dz * 0.35);
        c.cue("cut", MOVE.TRIPLE);
        if (inDanger(e, c.player, MOVE.TRIPLE) && c.clear(e, c.player))
          c.hit(spec.damage, MOVE.TRIPLE);
      }
    } else if (!already && elapsed >= 0.05) {
      struck.set(e, 1);
      if (e.attack === MOVE.CLEAVE) c.move(e, e.dx * 0.4, e.dz * 0.4);
      if (inDanger(e, c.player, e.attack) && c.clear(e, c.player)) {
        c.hit(spec.damage, e.attack as MoveCode);
        if (e.attack === MOVE.SHEET)
          c.pull(Math.max(0, Math.min(PRECEPTORA.pull, d - 1.6)));
      }
    }
    if (e.timer <= 0) {
      e.state = "recover";
      e.timer = spec.recover;
    }
    return;
  }
  // Stalking.
  if (e.timer <= 0 && d < PRECEPTORA.engage && c.clear(e, c.player)) {
    const list = history.get(e) || [];
    const move = chooseMove(phase, d, c.rng, list);
    if (move !== MOVE.NONE) {
      list.push(move);
      if (list.length > 4) list.shift();
      history.set(e, list);
      e.state = "windup";
      e.attack = move;
      e.timer = MOVES[move].windup;
      e.dx = vx / Math.max(d, 0.01);
      e.dz = vz / Math.max(d, 0.01);
      c.cue("telegraph", move);
      return;
    }
  }
  const dir = c.path();
  const len = Math.hypot(dir.x, dir.z);
  if (len > 0.1 && d > 1.4) {
    const speed =
      (phase >= 3 ? 1.55 : phase === 2 ? 1.3 : 1.15) *
      (e.vulnerable > 0 ? PRECEPTORA.exposedSpeed : 1);
    c.move(e, (dir.x / len) * speed * dt, (dir.z / len) * speed * dt);
  }
}

/** Generator discharge: stagger, armour open, thrown away from the generator. */
export function shockPreceptora(
  e: Enemy,
  generator: Vec,
  move: (e: Enemy, dx: number, dz: number) => void,
) {
  if (e.dead) return;
  e.vulnerable = PRECEPTORA.vulnerable;
  e.state = "stun";
  e.attack = MOVE.SHOCK;
  e.timer = PRECEPTORA.shock;
  const vx = e.x - generator.x,
    vz = e.z - generator.z,
    d = Math.hypot(vx, vz) || 1;
  if (d < 7) {
    const k = PRECEPTORA.knockback * (1 - d / 7) + 0.4;
    for (let i = 0; i < 6; i++) move(e, (vx / d) * (k / 6), (vz / d) * (k / 6));
  }
}
