export type Bus = "music" | "effects" | "voices";
export type SoundKind =
  | "shot"
  | "reload"
  | "door"
  | "flesh"
  | "head"
  | "shove"
  | "grunt"
  | "breath"
  | "step"
  | "ui"
  | "blade"
  | "sweep"
  | "scream"
  | "clank"
  | "spark";
export type Layer = {
  freq: number;
  duration: number;
  volume: number;
  delay: number;
  noise?: boolean;
  bus: Bus;
};
/** Original layered envelopes; all temporary nodes terminate and disconnect. */
export function soundPlan(kind: SoundKind, metal = false): Layer[] {
  const l = (
    freq: number,
    duration: number,
    volume: number,
    delay = 0,
    noise = false,
    bus: Bus = "effects",
  ): Layer => ({ freq, duration, volume, delay, noise, bus });
  switch (kind) {
    case "shot":
      return [
        l(2100, 0.055, 0.65, 0, true),
        l(95, 0.16, 0.75),
        l(420, 0.34, 0.2, 0.025, true),
      ];
    case "reload":
      return [
        l(1700, 0.035, 0.22, 0, true),
        l(570, 0.07, 0.2, 0.3, true),
        l(2250, 0.055, 0.25, 0.78, true),
        l(420, 0.09, 0.18, 0.94),
      ];
    case "door":
      return [
        l(520, 0.2, 0.2, 0, true),
        l(48, 0.38, 0.5, 0.12),
        l(1300, 0.08, 0.17, 0.24, true),
      ];
    case "flesh":
      return [l(220, 0.11, 0.3, 0, true), l(62, 0.14, 0.28)];
    case "head":
      return [l(900, 0.07, 0.35, 0, true), l(95, 0.17, 0.3)];
    case "shove":
      return [l(300, 0.13, 0.3, 0, true), l(75, 0.14, 0.2)];
    case "grunt":
      return [
        l(68, 0.42, 0.24, 0, false, "voices"),
        l(180, 0.35, 0.15, 0, true, "voices"),
      ];
    case "breath":
      return [
        l(620, 0.5, 0.1, 0, true, "voices"),
        l(740, 0.3, 0.08, 0.65, true, "voices"),
      ];
    case "step":
      return [
        l(metal ? 190 : 72, 0.07, 0.13),
        l(metal ? 1750 : 650, 0.08, 0.1, 0, true),
      ];
    case "ui":
      return [l(420, 0.035, 0.07)];
    // 0.8 Preceptora: blade ticks (GDD "tique de lâmina"), swing, scream,
    // armour clank and the generator arc.
    case "blade":
      return [
        l(3100, 0.03, 0.18, 0, true),
        l(2600, 0.03, 0.16, 0.16, true),
        l(3300, 0.03, 0.2, 0.32, true),
        l(1250, 0.05, 0.08, 0.32),
      ];
    case "sweep":
      return [l(900, 0.22, 0.22, 0, true), l(140, 0.18, 0.12, 0.04)];
    case "scream":
      return [
        l(230, 0.95, 0.22, 0, false, "voices"),
        l(347, 0.9, 0.12, 0.08, false, "voices"),
        l(1800, 0.8, 0.08, 0.05, true, "voices"),
      ];
    case "clank":
      return [
        l(1450, 0.06, 0.24),
        l(2900, 0.12, 0.12, 0, true),
        l(330, 0.1, 0.12),
      ];
    case "spark":
      return [
        l(5200, 0.08, 0.22, 0, true),
        l(60, 0.6, 0.35),
        l(4100, 0.06, 0.18, 0.18, true),
        l(4700, 0.05, 0.14, 0.36, true),
      ];
  }
}
