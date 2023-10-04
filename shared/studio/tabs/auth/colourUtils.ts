export function normaliseHexColor(hex: string) {
  if (hex.length === 3) {
    return hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return hex;
}

export function getColourVariables(bgHex: string) {
  const bgRGB = hexToRGB(bgHex);
  const bgHSL = RGBToHSL(...bgRGB);
  const luma = RGBToLuma(...bgRGB);
  const lumaDark = luma < 0.6;

  return {
    "--accent-bg-color": `#${bgHex}`,
    "--accent-bg-text-color": `#${RGBToHex(
      ...HSLToRGB(
        bgHSL[0],
        bgHSL[1],
        lumaDark ? 95 : Math.max(10, Math.min(25, luma * 100 - 60))
      )
    )}`,
    "--accent-bg-hover-color": `#${RGBToHex(
      ...HSLToRGB(bgHSL[0], bgHSL[1], bgHSL[2] + (lumaDark ? 5 : -5))
    )}`,
    "--accent-text-color": `#${RGBToHex(
      ...HSLToRGB(bgHSL[0], bgHSL[1], Math.min(lumaDark ? 90 : 35, bgHSL[2]))
    )}`,
    "--accent-text-dark-color": `#${RGBToHex(
      ...HSLToRGB(bgHSL[0], bgHSL[1], Math.max(60, bgHSL[2]))
    )}`,
  };
}

export function hexToRGB(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export function RGBToHex(r: number, g: number, b: number): string {
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

export function RGBToLuma(r: number, g: number, b: number): number {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

export function RGBToHSL(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const l = Math.max(r, g, b);
  const s = l - Math.min(r, g, b);
  const h = s
    ? l === r
      ? (g - b) / s
      : l === g
      ? 2 + (b - r) / s
      : 4 + (r - g) / s
    : 0;
  return [
    60 * h < 0 ? 60 * h + 360 : 60 * h,
    100 * (s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0),
    (100 * (2 * l - s)) / 2,
  ];
}

export function HSLToRGB(
  h: number,
  s: number,
  l: number
): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}
