import type { GameState } from "./logic";
import { rooms, type RoomId, type Vec } from "./world";
import type { Preferences } from "./controls";
export type Impact = { x: number; y: number; z: number; wall: boolean };
export type AmbientSave = {
  impacts: Partial<Record<RoomId, Impact[]>>;
  broken: string[];
};
export const themes: Record<
  RoomId,
  {
    color: number;
    fog: number;
    event: string;
    story: string;
    surface: string;
    fauna: string;
  }
> = {
  recepcao: {
    color: 0x7faba0,
    fog: 0.038,
    event: "telefone",
    story: "TRIAGEM ENCERRADA · A ÚLTIMA CHAMADA NÃO FOI ATENDIDA",
    surface: "tile",
    fauna: "baratas",
  },
  corredor: {
    color: 0x68918c,
    fog: 0.052,
    event: "sombra",
    story: "AS RODAS PARARAM AQUI. AS MARCAS CONTINUARAM.",
    surface: "tile",
    fauna: "ratos",
  },
  segura: {
    color: 0xc4a26d,
    fog: 0.026,
    event: "radio",
    story: "SE EU NÃO VOLTAR, DEIXE O RÁDIO LIGADO. — C.",
    surface: "wood",
    fauna: "moscas",
  },
  arquivo: {
    color: 0x98956a,
    fog: 0.043,
    event: "batidas",
    story: "TRANSFERIDOS NÃO SIGNIFICA LIBERADOS · 03:16",
    surface: "paper",
    fauna: "baratas",
  },
  gerador: {
    color: 0x9f8656,
    fog: 0.055,
    event: "faíscas",
    story: "NÃO RELIGUE A VENTILAÇÃO DO SUBSOLO",
    surface: "metal",
    fauna: "ratos",
  },
  atrio: {
    color: 0x7286a4,
    fog: 0.045,
    event: "maca",
    story: "BARRICADA DO TURNO B · NINGUÉM PASSA SOZINHO",
    surface: "tile",
    fauna: "moscas",
  },
  escadaria: {
    color: 0x6d91ad,
    fog: 0.06,
    event: "porta",
    story: "DESCER FOI UMA ORDEM. SUBIR JÁ NÃO É POSSÍVEL.",
    surface: "metal",
    fauna: "ratos",
  },
  internacao: {
    color: 0x7f9d81,
    fog: 0.05,
    event: "sombra",
    story: "LEITOS 201–208 · NÃO HÁ LEITO 213",
    surface: "tile",
    fauna: "baratas",
  },
  enfermaria: {
    color: 0xaa817e,
    fog: 0.048,
    event: "batidas",
    story: "203 · ELA AINDA APERTA O BOTÃO DA CAMPAINHA",
    surface: "wet",
    fauna: "moscas",
  },
  posto: {
    color: 0xc19c73,
    fog: 0.024,
    event: "radio",
    story: "CONTAGEM DO PLANTÃO: DOZE LEITOS, TREZE PULSEIRAS",
    surface: "wood",
    fauna: "baratas",
  },
  lavanderia: {
    color: 0x7ba5ad,
    fog: 0.064,
    event: "vapor",
    story: "LENÇÓIS VERMELHOS NÃO ENTRAM NO CICLO DE LAVAGEM",
    surface: "wet",
    fauna: "ratos",
  },
  isolamento: {
    color: 0xb67d68,
    fog: 0.062,
    event: "porta",
    story: "NÃO ABRA AO OUVIR A SUA PRÓPRIA VOZ",
    surface: "metal",
    fauna: "moscas",
  },
};
export function ambientDensity(p: Preferences) {
  return p.ambience === "off"
    ? 0
    : { low: 0.3, medium: 0.65, high: 1 }[
        p.ambience === "auto" ? p.quality : p.ambience
      ];
}
export function validateAmbientSave(raw: unknown): AmbientSave {
  if (raw === undefined) return { impacts: {}, broken: [] };
  const a = raw as AmbientSave;
  if (
    !a ||
    typeof a !== "object" ||
    !a.impacts ||
    typeof a.impacts !== "object" ||
    Array.isArray(a.impacts) ||
    !Array.isArray(a.broken) ||
    a.broken.length > 12 ||
    a.broken.some((x) => !Object.hasOwn(rooms, x))
  )
    throw Error("Ambiente salvo inválido");
  for (const [room, marks] of Object.entries(a.impacts)) {
    if (
      !Object.hasOwn(rooms, room) ||
      !Array.isArray(marks) ||
      marks.length > 16 ||
      marks.some(
        (m) =>
          !m ||
          ![m.x, m.y, m.z].every(Number.isFinite) ||
          Math.abs(m.x) > 7 ||
          Math.abs(m.z) > 9 ||
          m.y < 0 ||
          m.y > 4.1 ||
          typeof m.wall !== "boolean",
      )
    )
      throw Error("Decal salvo inválido");
  }
  return {
    impacts: Object.fromEntries(
      Object.entries(a.impacts).map(([k, v]) => [k, v!.map((m) => ({ ...m }))]),
    ),
    broken: [...new Set(a.broken)],
  };
}
export function addImpact(s: GameState, mark: Impact) {
  s.ambience ??= { impacts: {}, broken: [] };
  const marks = (s.ambience.impacts[s.room] ??= []);
  marks.push({ ...mark });
  if (marks.length > 16) marks.shift();
}
export function claimAmbientEvent(
  s: GameState,
  roomTime: number,
  active: boolean,
) {
  const key = "ambient:" + s.room;
  if (!active || roomTime < 3.5 || s.flags[key]) return false;
  s.flags[key] = true;
  return true;
}
export type Body = Vec & { vx: number; vz: number; angle: number };
export function integrateBody(b: Body, dt: number) {
  const h = Math.min(Math.max(dt, 0), 0.05);
  b.x += b.vx * h;
  b.z += b.vz * h;
  if (Math.abs(b.x) > 5.8) {
    b.x = Math.sign(b.x) * 5.8;
    b.vx *= -0.35;
  }
  if (Math.abs(b.z) > 7.5) {
    b.z = Math.sign(b.z) * 7.5;
    b.vz *= -0.35;
  }
  b.angle += Math.hypot(b.vx, b.vz) * h;
  b.vx *= Math.exp(-3 * h);
  b.vz *= Math.exp(-3 * h);
}
