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
  | "ui";
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
  }
}
