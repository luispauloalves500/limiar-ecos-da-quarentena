export type RoomId =
  "recepcao" | "corredor" | "segura" | "arquivo" | "gerador" | "atrio";
export type Vec = { x: number; z: number };
export type Rect = Vec & { w: number; d: number };
export type Door = {
  id: string;
  a: RoomId;
  b: RoomId;
  pa: Vec;
  pb: Vec;
  key?: string;
  label: string;
};
export type Pickup = Vec & {
  id: string;
  kind: "ammo" | "herb" | "battery" | "fuse" | "document";
  label: string;
  text?: string;
};
export type Room = {
  id: RoomId;
  name: string;
  subtitle: string;
  color: number;
  safe?: boolean;
  obstacles: Rect[];
  items: Pickup[];
  enemies: { id: string; x: number; z: number; boss?: boolean }[];
};
export const doors: Door[] = [
  {
    id: "D01",
    a: "recepcao",
    b: "corredor",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    label: "Ala leste",
  },
  {
    id: "D02",
    a: "corredor",
    b: "segura",
    pa: { x: -6, z: 4 },
    pb: { x: 6, z: 4 },
    label: "Posto de rádio",
  },
  {
    id: "D03",
    a: "corredor",
    b: "arquivo",
    pa: { x: 6, z: -3 },
    pb: { x: -6, z: 4 },
    label: "Arquivo clínico",
  },
  {
    id: "D04",
    a: "corredor",
    b: "gerador",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "chave",
    label: "Manutenção",
  },
  {
    id: "D05",
    a: "gerador",
    b: "atrio",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "energia",
    label: "Catracas / átrio",
  },
  {
    id: "D06",
    a: "atrio",
    b: "recepcao",
    pa: { x: -6, z: 4 },
    pb: { x: 6, z: 4 },
    key: "boss",
    label: "Atalho da administração",
  },
];
export const rooms: Record<RoomId, Room> = {
  recepcao: {
    id: "recepcao",
    name: "Recepção",
    subtitle: "HOSPITAL SANTA AVELINA · 03:15",
    color: 0x547879,
    obstacles: [
      { x: -2, z: -1, w: 5, d: 1.4 },
      { x: 4, z: -4, w: 1.4, d: 3 },
    ],
    items: [
      {
        id: "carta",
        kind: "document",
        label: "Bilhete de Caio",
        x: -3,
        z: 2,
        text: "Helena, se você está ouvindo o rádio, não confie na lista de mortos. O arquivo guarda a chave de manutenção. Todos os relógios pararam na hora da evacuação: 03:15. A energia das catracas foi cortada. — Caio",
      },
      { id: "rec-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 3, z: 2 },
      { id: "rec-bat", kind: "battery", label: "Bateria +35", x: 4, z: 5 },
    ],
    enemies: [],
  },
  corredor: {
    id: "corredor",
    name: "Corredor leste",
    subtitle: "ALA DE TRIAGEM · EVITE O CONTATO",
    color: 0x416c65,
    obstacles: [
      { x: -3, z: -1, w: 2.3, d: 3 },
      { x: 3, z: 3, w: 1.2, d: 2.5 },
    ],
    items: [
      { id: "cor-bat", kind: "battery", label: "Bateria +35", x: -4, z: 6 },
      { id: "cor-herb", kind: "herb", label: "Kit médico", x: 4, z: -5 },
    ],
    enemies: [{ id: "errante01", x: 1, z: -3 }],
  },
  segura: {
    id: "segura",
    name: "Posto de rádio",
    subtitle: "ÁREA SEGURA · GRAVADOR DISPONÍVEL",
    color: 0x99724b,
    safe: true,
    obstacles: [
      { x: -3, z: -4, w: 4, d: 1.4 },
      { x: 3, z: -3, w: 1.5, d: 3 },
    ],
    items: [
      { id: "seg-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: -3, z: 0 },
      { id: "seg-kit", kind: "herb", label: "Kit médico", x: 1, z: 1 },
      {
        id: "seg-doc",
        kind: "document",
        label: "Protocolo de exposição",
        x: -4,
        z: 4,
        text: "Paciente Errante: 70 de integridade. Cabeça desprotegida é vulnerável. Dois impactos na mesma perna podem inutilizá-la; a criatura continuará rastejando. Foco luminoso prolongado interrompe o ataque, mas consome carga. O gravador salva sua posição e o estado do hospital neste navegador.",
      },
    ],
    enemies: [],
  },
  arquivo: {
    id: "arquivo",
    name: "Arquivo clínico",
    subtitle: "ARQUIVOS A–13 · RELÓGIOS DE EVACUAÇÃO",
    color: 0x6b645b,
    obstacles: [
      { x: -3, z: -3, w: 1.2, d: 6 },
      { x: 3, z: -3, w: 1.2, d: 6 },
    ],
    items: [
      {
        id: "arq-doc",
        kind: "document",
        label: "Registro da evacuação",
        x: -1,
        z: 5,
        text: "Registro 0315. Às 03:15 todos os relógios foram interrompidos. Ajustar o relógio de plantão no fundo do arquivo abre o compartimento de manutenção. A chave foi escondida aqui por Nilo. O fusível está no carrinho da sala do gerador.",
      },
      { id: "arq-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 4 },
    ],
    enemies: [{ id: "errante02", x: 1, z: -1 }],
  },
  gerador: {
    id: "gerador",
    name: "Sala do gerador",
    subtitle: "MANUTENÇÃO · SISTEMA SEM ENERGIA",
    color: 0x4f626c,
    obstacles: [
      { x: -3, z: -2, w: 3, d: 4 },
      { x: 3, z: 1, w: 2.3, d: 3 },
    ],
    items: [
      { id: "fusivel", kind: "fuse", label: "Fusível cerâmico", x: -4, z: 5 },
      { id: "ger-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
      { id: "ger-kit", kind: "herb", label: "Kit médico", x: -1, z: 2 },
    ],
    enemies: [{ id: "errante03", x: 2, z: -4 }],
  },
  atrio: {
    id: "atrio",
    name: "Átrio das catracas",
    subtitle: "B01 · O PORTEIRO",
    color: 0x78524c,
    obstacles: [
      { x: -3, z: -1, w: 1.2, d: 2 },
      { x: 3, z: -1, w: 1.2, d: 2 },
    ],
    items: [
      { id: "boss-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 6 },
      { id: "boss-kit", kind: "herb", label: "Kit médico", x: -4, z: 6 },
      {
        id: "boss-doc",
        kind: "document",
        label: "Circuito de contenção",
        x: 0,
        z: 5,
        text: "O Porteiro protege o átrio. A catraca eletrificada (painel no fundo) sobrecarrega a armadura e expõe o núcleo durante quatro segundos. Não desperdice munição na carapaça fechada. O circuito recarrega: mesmo sem balas você pode vencer. Contorne as colunas quando o chão indicar uma investida.",
      },
    ],
    enemies: [{ id: "porteiro", x: 0, z: -4, boss: true }],
  },
};
export function endpoint(d: Door, room: RoomId) {
  return room === d.a
    ? { position: d.pa, to: d.b, spawn: d.pb }
    : { position: d.pb, to: d.a, spawn: d.pa };
}
export function roomDoors(id: RoomId) {
  return doors.filter((d) => d.a === id || d.b === id);
}
export function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function clearPoint(p: Vec, obstacles: Rect[], r = 0.34) {
  return (
    Math.abs(p.x) <= 6.2 - r &&
    Math.abs(p.z) <= 8.4 - r &&
    !obstacles.some(
      (o) =>
        Math.abs(p.x - o.x) < o.w / 2 + r && Math.abs(p.z - o.z) < o.d / 2 + r,
    )
  );
}
export function lineClear(a: Vec, b: Vec, obstacles: Rect[]) {
  const n = Math.ceil(dist(a, b) / 0.15);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (
      !clearPoint(
        { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        obstacles,
        0,
      )
    )
      return false;
  }
  return true;
}
export function inward(p: Vec): Vec {
  return {
    x: p.x === 6 ? 4.6 : p.x === -6 ? -4.6 : p.x,
    z: p.z === 8 ? 6.5 : p.z === -8 ? -6.5 : p.z,
  };
}

/** Swept, axis-separated movement prevents a fast charge from tunneling through furniture or actors. */
export function slideMove(
  p: Vec,
  dx: number,
  dz: number,
  canOccupy: (q: Vec) => boolean,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < steps; i++) {
    if (canOccupy({ x: p.x + dx / steps, z: p.z })) p.x += dx / steps;
    if (canOccupy({ x: p.x, z: p.z + dz / steps })) p.z += dz / steps;
  }
}
