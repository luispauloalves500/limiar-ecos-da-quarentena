import * as T from "three";
import { box, label, material as mat, seeded } from "./art";
import { rooms, roomDoors, endpoint, dist, type RoomId } from "./world";
/** Dense narrative dressing is instanced: repeated props cost one draw per material. */
export function roomDetails(id: RoomId) {
  const root = new T.Group(),
    r = rooms[id],
    rand = seeded([...id].reduce((a, c) => a + c.charCodeAt(0), 0));
  const sets = new Map<number, T.Matrix4[]>(),
    dummy = new T.Object3D();
  const add = (
    color: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
  ) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    if (!sets.has(color)) sets.set(color, []);
    sets.get(color)!.push(dummy.matrix.clone());
  };
  const captions: Record<RoomId, [string, string]> = {
    recepcao: ["SENHAS CANCELADAS · 03:15", "A LISTA DE MORTOS NÃO CONFERE"],
    corredor: ["TRIAGEM / AGUARDE CHAMADA", "MACAS 12–18 · NÃO TRANSPORTAR"],
    segura: ["CAIO · CANAL 03", "CAFÉ FRIO / ÚLTIMO TURNO"],
    arquivo: ["REGISTROS 0315 / ÓBITOS", "NOMES RISCADOS À MÃO"],
    gerador: ["REDE A / CATRACAS", "NILO · NÃO RELIGAR SEM FUSÍVEL"],
    atrio: ["CONTENÇÃO ADMINISTRATIVA", "INTERNAÇÃO → PULSEIRAS 200"],
    escadaria: ["PATAMAR 02 / INTERNAÇÃO", "PEGADAS SOBEM, NENHUMA DESCE"],
    internacao: ["LEITOS 201–209", "PROIBIDO VISITAS / PLANTÃO LIA"],
    enfermaria: [
      "203 · TRANSFERIDO 03:16",
      "PULSEIRA DE SERVIÇO / NÃO DESCARTAR",
    ],
    lavanderia: [
      "3 RETORNO / 1 ENTRADA / 2 DESCARGA",
      "LENÇÓIS DE ISOLAMENTO · NÃO ABRIR",
    ],
    posto: ["LIA · CANAL DE EMERGÊNCIA", "NÃO EXISTE LEITO TREZE"],
    isolamento: ["PORTA 13 / TRANSMISSOR", "SELE A BARREIRA DEPOIS DO SINAL"],
  };
  for (const [i, text] of captions[id].entries()) {
    const l = label(text, r.safe ? "#e2c797" : "#bac8b0", 3.8);
    l.position.set(i ? 3.6 : -3.6, 2.6, -8.68);
    root.add(l);
  }
  // Shelves/lockers hug the side walls, avoiding every cinematic doorway.
  for (const side of [-1, 1])
    for (const z of [-6, -2, 2, 6]) {
      const p = { x: side * 5.9, z };
      if (roomDoors(id).some((d) => dist(endpoint(d, id).position, p) < 2.2))
        continue;
      if (id === "arquivo") {
        for (let y = 0.35; y < 2.5; y += 0.42) {
          add(0x46554a, p.x, y, z, 0.55, 0.035, 1.2);
          for (let k = 0; k < 5; k++)
            add(
              k % 2 ? 0x8f8b6c : 0x747d6b,
              p.x,
              y + 0.16,
              z - 0.45 + k * 0.22,
              0.42,
              0.28,
              0.15,
            );
        }
      } else if (id === "lavanderia") {
        add(0x84948c, p.x, 0.65, z, 0.8, 1.3, 1.4);
        add(0x263e3b, p.x - side * 0.42, 0.67, z, 0.035, 0.72, 0.7);
        add(0xc3c4ad, p.x, 1.35, z, 0.65, 0.12, 1.1);
      } else if (
        id === "enfermaria" ||
        id === "internacao" ||
        id === "corredor"
      ) {
        add(0x64796b, p.x, 0.5, z, 0.65, 0.65, 1.4);
        add(0xb6b5a0, p.x, 0.89, z, 0.7, 0.13, 1.5);
        for (const dz of [-0.6, 0.6])
          add(0x374e43, p.x, 0.18, z + dz, 0.55, 0.2, 0.13);
        add(0x768478, p.x, 1.9, z, 0.03, 1.3, 0.03);
        add(0xb4bba2, p.x - side * 0.12, 2.35, z, 0.18, 0.3, 0.1);
      } else if (r.safe) {
        add(0x745b42, p.x, 0.6, z, 0.7, 1.2, 1.4);
        for (let k = 0; k < 3; k++)
          add(0xb0ad8a, p.x - side * 0.37, 0.3 + k * 0.35, z, 0.04, 0.2, 1.15);
        add(0xc9bc94, p.x, 1.26, z, 0.5, 0.07, 0.65);
      } else if (id === "gerador" || id === "isolamento") {
        add(0x475e52, p.x, 1.25, z, 0.6, 2.5, 1.3);
        for (let k = 0; k < 6; k++)
          add(0x927c4d, p.x - side * 0.32, 0.4 + k * 0.3, z, 0.03, 0.08, 0.9);
      } else {
        add(0x455d50, p.x, 0.5, z, 0.65, 0.7, 1.3);
        add(0x8d927a, p.x, 0.9, z, 0.7, 0.1, 1.4);
        add(0x526c5d, p.x, 0.6, z + 0.6, 0.65, 0.8, 0.08);
      }
    }
  // Labels, spilled charts, cable runs, wet streaks and traces of abandoned work.
  for (let i = 0; i < 24; i++) {
    const x = (rand() > 0.5 ? 1 : -1) * (4.9 + rand() * 0.6),
      z = rand() * 13 - 6.5;
    add(
      i % 3 === 0 ? 0x8e947f : 0x617467,
      x,
      0.013,
      z,
      0.12 + rand() * 0.2,
      0.006,
      0.18 + rand() * 0.2,
      rand() * 6,
    );
  }
  for (const x of [-6.35, 6.35])
    for (let k = 0; k < 3; k++)
      add(0x233f35, x, 2.9 + k * 0.07, 0, 0.025, 0.025, 15);
  for (let k = 0; k < 10; k++)
    add(
      0x405749,
      (k % 2 ? 1 : -1) * 6.52,
      1.3,
      rand() * 14 - 7,
      0.015,
      0.5 + rand() * 1.5,
      0.04 + rand() * 0.18,
    );
  if (id === "escadaria") {
    for (let k = 0; k < 7; k++)
      add(
        0x7a8371,
        -3,
        0.13 + k * 0.15,
        -3.5 + k * 0.45,
        1.8,
        0.25 + k * 0.3,
        0.45,
      );
    for (const x of [-3.9, -2.1]) add(0x3f594b, x, 1.8, -2, 0.05, 0.06, 3.5);
  }
  if (id === "recepcao") {
    add(0x4c6355, -2, 1.55, -1, 0.28, 0.35, 0.25);
    add(0xc9bc94, -2, 1.74, -0.95, 0.2, 0.02, 0.1);
  }
  if (id === "gerador")
    for (const x of [-3, 3])
      for (let k = 0; k < 6; k++)
        add(
          k % 2 ? 0x3a463d : 0xa38d54,
          x - 0.7 + k * 0.28,
          1.36,
          x < 0 ? -2 : 1,
          0.13,
          0.025,
          0.7,
        );
  if (id === "lavanderia")
    for (const x of [-3.5, 3.5]) {
      const ring = new T.Mesh(
        new T.TorusGeometry(0.46, 0.065, 5, 14),
        mat(0xa0aca1, 0.4, 0.5),
      );
      ring.position.set(x, 0.67, 0.55);
      root.add(ring);
      const door = new T.Mesh(
        new T.CircleGeometry(0.4, 14),
        mat(0x203d39, 0.3, 0.3),
      );
      door.position.set(x, 0.67, 0.54);
      root.add(door);
    }
  for (const [color, matrices] of sets) {
    const mesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      mat(color, 0.9, 0.08),
      matrices.length,
    );
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // Singular props give silhouettes without adding blocking geometry to the route.
  if (r.safe) {
    root.add(box(0.35, 0.28, 0.22, mat(0xa5a68c), -3, 1.6, -4));
  }
  return root;
}
