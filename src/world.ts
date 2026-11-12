export type RoomId =
  | "recepcao"
  | "corredor"
  | "segura"
  | "arquivo"
  | "gerador"
  | "atrio"
  | "escadaria"
  | "internacao"
  | "enfermaria"
  | "lavanderia"
  | "posto"
  | "isolamento"
  | "espera"
  | "recreio"
  | "bercario"
  | "leitos"
  | "abrigo"
  | "circulo"
  | "visor";
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
  kind: "ammo" | "herb" | "battery" | "fuse" | "document" | "key";
  label: string;
  text?: string;
};
export type EnemyKind = "E01" | "E02" | "E04" | "E05" | "B01" | "B02";
export type Room = {
  id: RoomId;
  name: string;
  subtitle: string;
  color: number;
  safe?: boolean;
  obstacles: Rect[];
  items: Pickup[];
  enemies: {
    id: string;
    x: number;
    z: number;
    boss?: boolean;
    kind?: EnemyKind;
  }[];
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
  {
    id: "D07",
    a: "atrio",
    b: "escadaria",
    pa: { x: 6, z: 4 },
    pb: { x: -6, z: 4 },
    key: "boss",
    label: "Acesso à internação",
  },
  {
    id: "D08",
    a: "escadaria",
    b: "internacao",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    label: "Ala de internação",
  },
  {
    id: "D09",
    a: "internacao",
    b: "posto",
    pa: { x: -6, z: 4 },
    pb: { x: 6, z: 4 },
    label: "Posto de enfermagem",
  },
  {
    id: "D10",
    a: "internacao",
    b: "enfermaria",
    pa: { x: 6, z: -3 },
    pb: { x: -6, z: 4 },
    label: "Enfermaria 203",
  },
  {
    id: "D11",
    a: "internacao",
    b: "lavanderia",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "pulseira",
    label: "Serviço / lavanderia",
  },
  {
    id: "D12",
    a: "lavanderia",
    b: "isolamento",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "pressao",
    label: "Barreira de isolamento",
  },
  {
    id: "D13",
    a: "isolamento",
    b: "espera",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "final",
    label: "Porta 13 / pediatria",
  },
  {
    id: "D14",
    a: "espera",
    b: "abrigo",
    pa: { x: -6, z: 4 },
    pb: { x: 6, z: 4 },
    label: "Plantão da pediatria",
  },
  {
    id: "D15",
    a: "espera",
    b: "recreio",
    pa: { x: 6, z: 4 },
    pb: { x: -6, z: 4 },
    label: "Brinquedoteca",
  },
  {
    id: "D16",
    a: "recreio",
    b: "bercario",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    label: "Berçário",
  },
  {
    id: "D17",
    a: "bercario",
    b: "leitos",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    label: "Ala de leitos infantis",
  },
  {
    id: "D18",
    a: "leitos",
    b: "circulo",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "prontuarios",
    label: "Enfermaria circular",
  },
  {
    id: "D19",
    a: "circulo",
    b: "visor",
    pa: { x: 0, z: -8 },
    pb: { x: 0, z: 8 },
    key: "preceptora",
    label: "Acesso ao centro cirúrgico",
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
  escadaria: {
    id: "escadaria",
    name: "Patamar da internação",
    subtitle: "CAPÍTULO 2 · AS CAMAS VAZIAS",
    color: 0x616856,
    obstacles: [
      { x: -3, z: -2, w: 2, d: 4 },
      { x: 3, z: -3, w: 2, d: 3 },
    ],
    items: [
      {
        id: "esc-doc",
        kind: "document",
        label: "Planta de serviço",
        x: 0,
        z: 3,
        text: "Caio não desceu. Foi levado à internação. A pulseira de serviço está no leito 203; abre a lavanderia. Despressurize o circuito antes de cruzar a barreira de isolamento. Um rádio ainda transmite no posto de enfermagem.",
      },
      { id: "esc-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 3, z: 4 },
      { id: "esc-bat", kind: "battery", label: "Bateria +35", x: -3, z: 4 },
    ],
    enemies: [],
  },
  internacao: {
    id: "internacao",
    name: "Corredor de internação",
    subtitle: "ALA 200 · NÃO SIGA OS PASSOS",
    color: 0x60756f,
    obstacles: [
      { x: -3, z: -1, w: 2, d: 3 },
      { x: 3, z: 2, w: 1.4, d: 2.5 },
    ],
    items: [
      { id: "int-kit", kind: "herb", label: "Kit médico", x: -4, z: 6 },
      { id: "int-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
      {
        id: "int-doc",
        kind: "document",
        label: "Aviso do plantão",
        x: 1,
        z: 5,
        text: "O enfermeiro recua antes de agarrar. Não confunda o passo para trás com fuga: afaste-se ou ilumine para interromper. A criatura de pulseira vermelha corre em linha reta; saia da trajetória e ataque enquanto ela se recompõe.",
      },
    ],
    enemies: [{ id: "enfermeiro01", kind: "E02", x: 1, z: -3 }],
  },
  posto: {
    id: "posto",
    name: "Posto de enfermagem",
    subtitle: "REFÚGIO · GRAVAÇÃO E RÁDIO",
    color: 0x9b7955,
    safe: true,
    obstacles: [
      { x: -3, z: -4, w: 4, d: 1.4 },
      { x: 3, z: -3, w: 1.5, d: 3 },
    ],
    items: [
      { id: "posto-kit", kind: "herb", label: "Kit médico", x: 1, z: 1 },
      {
        id: "posto-ammo",
        kind: "ammo",
        label: "12 cartuchos 9 mm",
        x: -3,
        z: 0,
      },
      { id: "posto-bat", kind: "battery", label: "Bateria +35", x: 3, z: 4 },
      {
        id: "posto-doc",
        kind: "document",
        label: "Último plantão de Lia",
        x: -4,
        z: 4,
        text: "Eu deixei água e um gravador. A pulseira foi presa à cama 203, não a um paciente. O sistema deve ser purgado na ordem RETORNO, ENTRADA, DESCARGA — 3, 1, 2. Se a luz de isolamento ficar âmbar, espere: há alguém vivo do outro lado. — Lia",
      },
    ],
    enemies: [],
  },
  enfermaria: {
    id: "enfermaria",
    name: "Enfermaria 203",
    subtitle: "LEITOS INTERDITADOS · O QUE FICOU",
    color: 0x76867b,
    obstacles: [
      { x: -3, z: -2, w: 2, d: 4 },
      { x: 3, z: -2, w: 2, d: 4 },
    ],
    items: [
      {
        id: "pulseira",
        kind: "key",
        label: "Pulseira de serviço 203",
        x: 0,
        z: -5,
      },
      { id: "enf-kit", kind: "herb", label: "Kit médico", x: 4, z: 5 },
      { id: "enf-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: -2, z: 5 },
      {
        id: "enf-doc",
        kind: "document",
        label: "Prontuário sem nome",
        x: 0,
        z: 3,
        text: "Leito 203. O campo ÓBITO foi apagado três vezes. Caio assinou a transferência para isolamento às 03:16 — um minuto depois do horário oficial de evacuação. Ao fundo da gravação há uma criança contando portas.",
      },
    ],
    enemies: [{ id: "enfermeiro02", kind: "E02", x: 1, z: -2 }],
  },
  lavanderia: {
    id: "lavanderia",
    name: "Lavanderia de serviço",
    subtitle: "P02 · CIRCUITO DE PRESSÃO",
    color: 0x637879,
    obstacles: [
      { x: -3.5, z: -2, w: 2, d: 5 },
      { x: 3.5, z: -2, w: 2, d: 5 },
    ],
    items: [
      {
        id: "lav-doc",
        kind: "document",
        label: "Manômetro de emergência",
        x: 0,
        z: 4,
        text: "Antes de abrir a barreira: 3 RETORNO → 1 ENTRADA → 2 DESCARGA. Ordem incorreta fecha todas as válvulas; repita. O circuito mantém a pressão liberada depois do procedimento. Nunca procure a saída correndo em linha reta diante de um Febril.",
      },
      { id: "lav-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
      { id: "lav-bat", kind: "battery", label: "Bateria +35", x: -4, z: 5 },
    ],
    enemies: [{ id: "febril01", kind: "E04", x: 0, z: -4 }],
  },
  isolamento: {
    id: "isolamento",
    name: "Galeria de isolamento",
    subtitle: "PORTA 13 · A PEDIATRIA RESPONDE",
    color: 0x6f534e,
    obstacles: [
      { x: -3, z: -1, w: 1.5, d: 3 },
      { x: 3, z: -1, w: 1.5, d: 3 },
    ],
    items: [
      { id: "iso-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 6 },
      { id: "iso-kit", kind: "herb", label: "Kit médico", x: -4, z: 6 },
      {
        id: "iso-doc",
        kind: "document",
        label: "Protocolo de selagem",
        x: 0,
        z: 5,
        text: "Terminal no fundo: transmita a fita e sele a barreira. O circuito só aceita a operação quando o movimento no setor cessa. Caio repete: NÃO EXISTE LEITO TREZE. A fita registra uma respiração do lado de dentro.",
      },
    ],
    enemies: [{ id: "febril02", kind: "E04", x: 0, z: -3 }],
  },
  espera: {
    id: "espera",
    name: "Espera da pediatria",
    subtitle: "TRANSFERÊNCIAS · CADEIRAS BAIXAS",
    color: 0xb48a7c,
    obstacles: [
      { x: -3, z: -3, w: 2.2, d: 3 },
      { x: 3.2, z: -2, w: 1.6, d: 3.5 },
    ],
    items: [
      {
        id: "esp-doc",
        kind: "document",
        label: "Lista de transferência — pediatria",
        x: 0,
        z: 4,
        text: "Os nomes da lista de 03:16 não são óbitos. São transferências para a pediatria, assinadas pela Preceptora. Caio deixou um risco ao lado de três marcas: um animal que nada, um que voa, um que enraíza. A Porta 13 abre para baixo — e não fecha igual.",
      },
      { id: "esp-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
    ],
    enemies: [],
  },
  abrigo: {
    id: "abrigo",
    name: "Plantão da pediatria",
    subtitle: "ÁREA SEGURA · TERCEIRO GRAVADOR",
    color: 0xc4a07a,
    safe: true,
    obstacles: [
      { x: -3, z: -4, w: 4, d: 1.4 },
      { x: 3, z: -3, w: 1.5, d: 3 },
    ],
    items: [
      { id: "abr-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: -3, z: 0 },
      { id: "abr-kit", kind: "herb", label: "Kit médico", x: 1, z: 1 },
      { id: "abr-bat", kind: "battery", label: "Bateria +35", x: 3, z: 4 },
      {
        id: "abr-doc",
        kind: "document",
        label: "Prontuários — três leitos",
        x: -4,
        z: 4,
        text: "Confirme somente os leitos com as marcas da lista: a baleia azul no pé da cama, o pássaro vermelho pendurado, a árvore verde na cabeceira. Qualquer outro prontuário é isca. Depois da confirmação, a enfermaria circular aceita o crachá — e ela ouve o gerador auxiliar. — Lia",
      },
    ],
    enemies: [],
  },
  recreio: {
    id: "recreio",
    name: "Brinquedoteca",
    subtitle: "PEÇAS NO CHÃO · ALGO SE ARRASTA",
    color: 0x7a9b86,
    obstacles: [
      { x: -3.2, z: -1, w: 2.4, d: 3.2 },
      { x: 3.2, z: 2, w: 2, d: 2.6 },
    ],
    items: [
      {
        id: "rec-doc2",
        kind: "document",
        label: "Relato da brinquedoteca",
        x: 0,
        z: 5,
        text: "As crianças deixaram os blocos empilhados à altura do joelho. De manhã o chão estava limpo; à noite, as peças voltam a formar um corredor baixo. Ouve-se metal raspando debaixo da mesa. Não aponte a lanterna na altura dos olhos — aponte para o chão.",
      },
      { id: "rec2-herb", kind: "herb", label: "Kit médico", x: 4, z: -5 },
    ],
    enemies: [{ id: "rastejador01", kind: "E05", x: -3, z: -1 }],
  },
  bercario: {
    id: "bercario",
    name: "Berçário",
    subtitle: "BERÇOS VAZIOS · MÓBILE PARADO",
    color: 0xc4a888,
    obstacles: [
      { x: -3, z: -2, w: 2.2, d: 3.4 },
      { x: 3, z: -2, w: 2.2, d: 3.4 },
    ],
    items: [
      {
        id: "ber-doc",
        kind: "document",
        label: "Plantão do berçário",
        x: 0,
        z: 4,
        text: "Todos os berços foram esvaziados no mesmo minuto em que os relógios pararam. Um móbile ainda gira quando ninguém encosta. A Preceptora passou aqui cantando baixo, a mesma canção três vezes, e pediu que ninguém visse o teto. O corredor dos leitos está no fundo.",
      },
      { id: "ber-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
      { id: "ber-bat", kind: "battery", label: "Bateria +35", x: -4, z: 5 },
    ],
    enemies: [],
  },
  leitos: {
    id: "leitos",
    name: "Leitos infantis",
    subtitle: "P03 · TRÊS PRONTUÁRIOS",
    color: 0x7d917e,
    obstacles: [
      { x: -3.2, z: -2, w: 2.2, d: 3.6 },
      { x: 3.2, z: -2, w: 2.2, d: 3.6 },
      { x: 0, z: -3.6, w: 1.8, d: 1.8 },
    ],
    items: [
      { id: "lei-herb", kind: "herb", label: "Kit médico", x: 4, z: 5 },
      { id: "lei-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: -4, z: 5 },
    ],
    enemies: [{ id: "rastejador02", kind: "E05", x: 3, z: -2 }],
  },
  circulo: {
    id: "circulo",
    name: "Enfermaria circular",
    subtitle: "B02 · A PRECEPTORA",
    color: 0x8a5a58,
    obstacles: [
      { x: -3.6, z: 1.5, w: 2.2, d: 2.2 },
      { x: 3.6, z: 1.5, w: 2.2, d: 2.2 },
      { x: -3.6, z: -3.2, w: 2.2, d: 2.2 },
      { x: 3.6, z: -3.2, w: 2.2, d: 2.2 },
    ],
    items: [
      { id: "cir-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 6 },
      { id: "cir-kit", kind: "herb", label: "Kit médico", x: -4, z: 6 },
      {
        id: "cir-doc",
        kind: "document",
        label: "Turno da Preceptora",
        x: 0,
        z: 5,
        text: "Quando as luzes da fileira se apagam, ligue o gerador auxiliar no fundo à direita. Quinze segundos de claridade; depois o circuito pede vinte para recarregar. Ela reage ao som do equipamento. Não desperdice tiro na escuridão. Dois rastejadores, no máximo, saem das camas no segundo movimento. — Circuito de contenção, adendo B.",
      },
    ],
    enemies: [
      { id: "preceptora", x: 0, z: -3, boss: true, kind: "B02" },
      { id: "rastejador03", kind: "E05", x: -3.5, z: -3 },
      { id: "rastejador04", kind: "E05", x: 3.5, z: -3 },
    ],
  },
  visor: {
    id: "visor",
    name: "Ante-sala cirúrgica",
    subtitle: "CRACHÁ · O CENTRO AINDA RESPIRA",
    color: 0x6a858c,
    obstacles: [
      { x: -3, z: -2, w: 1.6, d: 3 },
      { x: 3, z: -2, w: 1.6, d: 3 },
    ],
    items: [
      {
        id: "vis-doc",
        kind: "document",
        label: "Memorando do centro cirúrgico",
        x: 0,
        z: 4,
        text: "O crachá da Preceptora abre o visor, não a porta de cirurgia. Do outro lado há água até o tornozelo e um ruído de válvula grande demais para este andar. Caio: se você chegou até aqui, não desça sem gravar o que viu. O Mergulhador não é uma metáfora.",
      },
      { id: "vis-ammo", kind: "ammo", label: "12 cartuchos 9 mm", x: 4, z: 5 },
    ],
    enemies: [],
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
    // Side-door entries used to spawn at ±4.6, which left the 2.75 m
    // shoulder boom inside the wall. A deeper inward spawn plus
    // roomCameraClearance keeps the near wall out of the face.
    x: p.x === 6 ? 3.8 : p.x === -6 ? -3.8 : p.x,
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
