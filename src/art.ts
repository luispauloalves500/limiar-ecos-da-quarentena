import * as T from "three";
export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function proceduralTexture(
  kind: "tile" | "wall" | "rust" | "blood" | "cookie",
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d")!;
  const rand = seeded(kind.length * 931 + kind.charCodeAt(0));
  if (kind === "cookie") {
    const gradient = g.createRadialGradient(128, 128, 15, 128, 128, 126);
    gradient.addColorStop(0, "rgb(255,255,255)");
    gradient.addColorStop(0.45, "rgb(235,235,235)");
    gradient.addColorStop(0.7, "rgb(166,166,166)");
    gradient.addColorStop(1, "rgb(0,0,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 256, 256);
  } else if (kind === "blood") {
    g.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 65; i++) {
      const x = 128 + (rand() - 0.5) * 190,
        y = 128 + (rand() - 0.5) * 160,
        r = 3 + rand() * 23;
      g.fillStyle = `rgba(65,12,11,${0.1 + rand() * 0.6})`;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.6, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle =
      kind === "rust" ? "#58584c" : kind === "wall" ? "#a6aaa0" : "#87958b";
    g.fillRect(0, 0, 256, 256);
    if (kind !== "rust")
      for (let y = 0; y < 256; y += 64)
        for (let x = 0; x < 256; x += 64) {
          g.fillStyle = `rgba(30,46,37,${rand() * 0.12})`;
          g.fillRect(x, y, 64, 64);
          g.strokeStyle = "#354440";
          g.lineWidth = kind === "tile" ? 2 : 1;
          g.strokeRect(x, y, 64, 64);
          g.strokeStyle = "#c1c8b326";
          g.strokeRect(x + 3, y + 3, 58, 58);
        }
    for (let i = 0; i < 3500; i++) {
      const tone = rand() > 0.4 ? "20,28,20" : "180,182,155";
      g.fillStyle = `rgba(${tone},${rand() * 0.12})`;
      g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 3, 1 + rand() * 3);
    }
    for (let i = 0; i < 45; i++) {
      const x = rand() * 256,
        y = rand() * 256,
        r = 6 + rand() * 38;
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, kind === "rust" ? "#74382070" : "#182b2340");
      gradient.addColorStop(1, "#1c302900");
      g.fillStyle = gradient;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      if (kind === "wall") {
        g.strokeStyle = "#26392c22";
        g.lineWidth = 1 + rand() * 7;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rand() - 0.5) * 6, y + rand() * 65);
        g.stroke();
      }
    }
  }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = kind === "cookie" ? T.NoColorSpace : T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.userData.persistent = true;
  t.anisotropy = 4;
  return t;
}
export function material(
  color: number,
  roughness = 0.85,
  metalness = 0,
  map?: T.Texture,
) {
  return new T.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...(map ? { map, bumpMap: map, bumpScale: 0.025 } : {}),
  });
}
export function box(
  w: number,
  h: number,
  d: number,
  m: T.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const b = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}
export function capsule(
  radius: number,
  length: number,
  m: T.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const b = new T.Mesh(new T.CapsuleGeometry(radius, length, 3, 8), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}
export function label(text: string, color = "#bdd1b4", width = 2.5) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 100;
  const g = c.getContext("2d")!;
  g.fillStyle = "#142321";
  g.fillRect(0, 0, 512, 100);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.strokeRect(5, 5, 502, 90);
  g.fillStyle = color;
  g.font = "bold 27px monospace";
  g.textAlign = "center";
  if (g.measureText(text).width <= 472) g.fillText(text, 256, 60);
  else {
    g.font = "bold 21px monospace";
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (g.measureText(candidate).width > 472 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    const step = lines.length > 2 ? 25 : 29;
    lines.forEach((l, i) =>
      g.fillText(l, 256, 60 - ((lines.length - 1) * step) / 2 + i * step, 472),
    );
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(width, width / 5.12),
    new T.MeshBasicMaterial({ map: t, side: T.DoubleSide }),
  );
}

// Keep colour textures on Low, but remove per-fragment bump derivatives.
// Textures are shared/persistent; switching quality restores the original map.
export function surfaceDetail(root: T.Object3D, enabled: boolean) {
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of materials) {
      if (!(m instanceof T.MeshStandardMaterial)) continue;
      if (!("detailBump" in m.userData)) m.userData.detailBump = m.bumpMap;
      const target = enabled ? m.userData.detailBump : null;
      if (m.bumpMap !== target) {
        m.bumpMap = target;
        m.needsUpdate = true;
      }
    }
  });
}
