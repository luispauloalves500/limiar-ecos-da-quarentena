import { shoulderOffset } from "../src/controls";
import { surfaceDetail } from "../src/art";
import { describe, it, expect } from "vitest";
import * as T from "three";
import {
  defaults,
  parsePreferences,
  savePreferences,
  PREF_KEY,
  lookInput,
  relativeMovement,
  tankMovement,
  wrapAngle,
  profiles,
} from "../src/controls";
import { raycastShot, cameraCollision } from "../src/aim";
import { slideMove } from "../src/world";
function mesh(x: number, y: number, z: number, region = "body") {
  const m = new T.Mesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  m.position.set(x, y, z);
  m.userData = { enemyId: "test", region };
  m.updateMatrixWorld(true);
  return m;
}
describe("preferências e modos", () => {
  it("ombro é o padrão e assistência opcional começa desligada", () => {
    expect(defaults.mode).toBe("shoulder");
    expect(defaults.assist).toBe(false);
  });
  it("preferência tank sobrevive à serialização", () => {
    let raw = "";
    savePreferences(
      { ...defaults, mode: "tank" },
      {
        setItem: (key, value) => {
          expect(key).toBe(PREF_KEY);
          raw = value;
        },
      },
    );
    expect(parsePreferences(raw).mode).toBe("tank");
  });
  it("opções de sensibilidade/inversão/qualidade persistem", () => {
    const p = {
      ...defaults,
      sensitivity: 2,
      invertY: true,
      quality: "high" as const,
      shoulder: -1 as const,
    };
    expect(parsePreferences(JSON.stringify(p))).toEqual(p);
  });
  it.each(["{", "null", "{}", '{"version":999}'])(
    "usa fallback para preferências inválidas: %s",
    (s) => expect(parsePreferences(s)).toEqual(defaults),
  );
  it("limita sensibilidade recebida do storage", () =>
    expect(
      parsePreferences('{"version":1,"sensitivity":999}').sensitivity,
    ).toBe(3));
  it("Baixo desliga pós e sombras, Alto aumenta orçamento", () => {
    expect(profiles.low.post).toBe(false);
    expect(profiles.high.shadowSize).toBeGreaterThan(
      profiles.medium.shadowSize,
    );
  });
});
describe("olhar e movimento", () => {
  it("mouse à direita gira visão à direita e respeita sensibilidade", () => {
    const a = lookInput(0, 0, 100, 0, defaults),
      b = lookInput(0, 0, 100, 0, { ...defaults, sensitivity: 2 });
    expect(a.yaw).toBeCloseTo(-0.22);
    expect(b.yaw).toBeCloseTo(-0.44);
  });
  it("pitch tem limites e inversão Y funcional", () => {
    expect(lookInput(0, 0, 0, 1e5, defaults).pitch).toBe(-1.05);
    expect(
      lookInput(0, 0, 0, 100, { ...defaults, invertY: true }).pitch,
    ).toBeGreaterThan(0);
  });
  it("W acompanha yaw da câmera, D é lateral relativo", () => {
    expect(relativeMovement(0, 1, Math.PI / 2).x).toBeCloseTo(1);
    expect(relativeMovement(1, 0, 0).x).toBeCloseTo(-1);
  });
  it("diagonais não aceleram", () => {
    const v = relativeMovement(1, 1, 1);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
  it("tank avança/recuá no corpo, não no corte de câmera", () => {
    const a = tankMovement(1, 0, Math.PI, 1 / 60),
      b = tankMovement(-1, 0, Math.PI, 1 / 60);
    expect(a.vector.z).toBeCloseTo(-1);
    expect(b.vector.z).toBeCloseTo(1);
  });
  it("A/D tank giram sem deslocar se W/S solto", () => {
    const a = tankMovement(0, 1, 0, 0.5);
    expect(a.yaw).toBeCloseTo(-1.05);
    expect(a.vector).toEqual({ x: -0, z: 0 });
  });
  it("meia volta é normalizada", () =>
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI));
});
describe("raycast físico e câmera", () => {
  it("retícula distingue cabeça, torso e pernas", () => {
    for (const [region, y] of [
      ["head", 1.7],
      ["body", 1.1],
      ["legL", 0.4],
      ["legR", 0.4],
    ] as const) {
      const h = mesh(0, y, -5, region);
      const ray = new T.Raycaster(
        new T.Vector3(0, y, 0),
        new T.Vector3(0, 0, -1),
        0,
        20,
      );
      expect(raycastShot(ray, [h], [])?.region).toBe(region);
    }
  });
  it("errando a hitbox não aplica dano automático", () =>
    expect(
      raycastShot(
        new T.Raycaster(new T.Vector3(2, 0, 0), new T.Vector3(0, 0, -1)),
        [mesh(0, 0, -5)],
        [],
      ),
    ).toBeUndefined());
  it("a primeira superfície impede tiros através de parede", () =>
    expect(
      raycastShot(
        new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1)),
        [mesh(0, 0, -5)],
        [mesh(0, 0, -2)],
      ),
    ).toBeUndefined());
  it("alvo antes da parede é atingido", () =>
    expect(
      raycastShot(
        new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1)),
        [mesh(0, 0, -2)],
        [mesh(0, 0, -5)],
      )?.id,
    ).toBe("test"));
  it("não atira através da cobertura da arma ao espiar com câmera", () => {
    const ray = new T.Raycaster(
      new T.Vector3(2, 0, 0),
      new T.Vector3(-2, 0, -5).normalize(),
    );
    const wall = mesh(0, 0, -2);
    wall.scale.set(0.6, 2, 1);
    wall.updateMatrixWorld(true);
    expect(
      raycastShot(ray, [mesh(0, 0, -5)], [wall], new T.Vector3(0, 0, 0)),
    ).toBeUndefined();
  });
  it("colisão encurta boom antes de parede sem atravessar", () => {
    const p = cameraCollision(new T.Vector3(), new T.Vector3(0, 0, -4), [
      mesh(0, 0, -2),
    ]);
    expect(p.z).toBeGreaterThan(-1.5);
    expect(p.z).toBeLessThan(-1);
  });
  it("sem parede mantém posição desejada", () =>
    expect(
      cameraCollision(new T.Vector3(), new T.Vector3(0, 1, -3), []).toArray(),
    ).toEqual([0, 1, -3]));
  it("hitboxes invisíveis ainda resolvem raycast explicitamente", () => {
    const m = mesh(0, 0, -3);
    m.visible = false;
    expect(
      raycastShot(
        new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1)),
        [m],
        [],
      )?.id,
    ).toBe("test");
  });
});

describe("movimento varrido e contato de atores", () => {
  it("investida rápida não atravessa obstáculo fino", () => {
    const p = { x: 0, z: 0 };
    slideMove(p, 0, 4, (q) => !(q.z > 1 && q.z < 1.3));
    expect(p.z).toBeLessThanOrEqual(1);
  });
  it("chefe não termina a investida dentro de Helena", () => {
    const e = { x: 0, z: 0 },
      player = { x: 0, z: 3 };
    slideMove(
      e,
      0,
      2.8,
      (q) => Math.hypot(q.x - player.x, q.z - player.z) > 1.05,
    );
    expect(Math.hypot(e.x - player.x, e.z - player.z)).toBeGreaterThan(1.05);
  });
});

describe("orçamento de material", () => {
  it("Baixo conserva textura de cor e restaura bump ao subir perfil", () => {
    const map = new T.Texture(),
      bump = new T.Texture();
    const m = new T.MeshStandardMaterial({ map, bumpMap: bump });
    const mesh = new T.Mesh(new T.BoxGeometry(), m);
    surfaceDetail(mesh, false);
    expect(m.map).toBe(map);
    expect(m.bumpMap).toBeNull();
    surfaceDetail(mesh, true);
    expect(m.bumpMap).toBe(bump);
  });
});

describe("enquadramento de ombro", () => {
  it("Helena fica à esquerda da retícula tanto livre quanto mirando", () => {
    for (const aim of [false, true]) {
      const camera = new T.PerspectiveCamera(aim ? 48 : 62, 1.6, 0.06, 65);
      camera.position.set(shoulderOffset(aim, 1), 1.67, aim ? 1.65 : 2.85);
      camera.lookAt(camera.position.clone().add(new T.Vector3(0, 0, -10)));
      camera.updateMatrixWorld();
      expect(new T.Vector3(0, 1.4, 0).project(camera).x).toBeLessThan(-0.25);
    }
  });
  it("trocar ombro espelha o deslocamento", () =>
    expect(shoulderOffset(true, -1)).toBe(-shoulderOffset(true, 1)));
});

describe("volume de câmera 0.4", () => {
  it("sonda lateral impede a borda da câmera de atravessar um poste", () => {
    const wall = new T.Mesh(
      new T.BoxGeometry(0.2, 2, 0.2),
      new T.MeshBasicMaterial(),
    );
    wall.position.set(0.16, 0, -2);
    wall.updateMatrixWorld(true);
    const safe = cameraCollision(new T.Vector3(), new T.Vector3(0, 0, -4), [
      wall,
    ]);
    expect(safe.z).toBeGreaterThan(-1.8);
  });
  it("ombro direito permanece limpo e à esquerda em ambas as distâncias", () => {
    for (const aim of [false, true]) {
      const c = new T.PerspectiveCamera(aim ? 52 : 62, 1.6, 0.06, 65);
      c.position.set(shoulderOffset(aim, 1), 1.67, aim ? 1.95 : 2.75);
      c.lookAt(c.position.clone().add(new T.Vector3(0, 0, -1)));
      c.updateMatrixWorld();
      const x = new T.Vector3(0, 1.4, 0).project(c).x;
      expect(x).toBeLessThan(-0.2);
      expect(x).toBeGreaterThan(-0.8);
    }
  });
});
