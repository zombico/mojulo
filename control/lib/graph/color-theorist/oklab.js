/**
 * THE COLOUR SPACE the color theorist thinks in: OKLab / OKLCH (Björn Ottosson, 2020), where a step in lightness looks
 * like the same step at every hue — HSL's lightness does not (a yellow and a blue at HSL 50 % are nowhere near one
 * value). Plus what a palette is checked by: sRGB gamut mapping (chroma taken in, never clipped), WCAG 2 contrast,
 * APCA lightness contrast (reported, not a standard yet), and colour-vision simulation (Machado, Oliveira & Fernandes
 * 2009, severity 1, in linear light).
 *
 *   hexToRgb / rgbToHex                    '#rrggbb' ↔ [r, g, b] (0–255)
 *   rgbToOklab / oklabToRgb                [r, g, b] ↔ [L, a, b] (rgb unrounded, may be out of gamut)
 *   oklch(L, C, h) → [r, g, b]             in gamut: chroma reduced at fixed L and h until it fits, then rounded
 *   lchOf(rgb) → [L, C, h]
 *   deltaE(rgbA, rgbB)                     OKLab distance (≈ 0.02 a just-noticeable step, ≈ 0.1 clearly another colour)
 *   contrast(rgbA, rgbB)                   WCAG 2 ratio, 1…21
 *   apca(text, bg)                         APCA Lc, signed (positive: dark text on light)
 *   simulate(rgb, 'protan'|'deutan'|'tritan')
 *   mixHue(a, b, t)                        along the short way round
 *
 * Pure and deterministic; every colour a palette stores is rounded to integer sRGB.
 */

export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgbToHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

const toLin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const gam = (x) => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(0, x) ** (1 / 2.4) - 0.055);

export function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
export const rgbToOklab = (c) => linToOklab(c.map(toLin));
export const oklabToRgb = (lab) => oklabToLin(lab).map(gam);

export function lchOf(rgb) {
  const [L, a, b] = rgbToOklab(rgb), C = Math.hypot(a, b);
  return [L, C, C < 1e-6 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}
const labOfLch = (L, C, h) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** A colour by lightness, chroma and hue, brought into sRGB by taking chroma in (never by clipping a channel). */
export function oklch(L, C, h) {
  const Lc = Math.max(0, Math.min(1, L));
  let lo = 0, hi = Math.max(0, C);
  if (inGamut(oklabToLin(labOfLch(Lc, hi, h)))) lo = hi;
  else for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (inGamut(oklabToLin(labOfLch(Lc, mid, h)))) lo = mid; else hi = mid; }
  return oklabToRgb(labOfLch(Lc, lo, h)).map((v) => Math.max(0, Math.min(255, Math.round(v))));
}
/** How much chroma the gamut took from a colour asked for (0 when it fit). */
export function gamutLoss(L, C, h) { const [, c] = lchOf(oklch(L, C, h)); return Math.max(0, C - c); }

export const deltaE = (x, y) => { const p = rgbToOklab(x), q = rgbToOklab(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

const relLum = (c) => { const [r, g, b] = c.map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrast(x, y) { const a = relLum(x), b = relLum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

/** APCA 0.0.98G lightness contrast of text on a background, signed: + dark on light, − light on dark. */
export function apca(text, bg) {
  const Y = (c) => { const [r, g, b] = c.map((v) => (v / 255) ** 2.4); const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y; };
  const t = Y(text), b = Y(bg);
  if (Math.abs(b - t) < 0.0005) return 0;
  if (b > t) { const S = (b ** 0.56 - t ** 0.57) * 1.14; return S < 0.1 ? 0 : (S - 0.027) * 100; }
  const S = (b ** 0.65 - t ** 0.62) * 1.14; return S > -0.1 ? 0 : (S + 0.027) * 100;
}

// Machado et al. 2009, severity 1.0, on linear RGB
const CVD = Object.freeze({
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
});
export const CVD_KINDS = Object.freeze(Object.keys(CVD));
export function simulate(rgb, kind) {
  const M = CVD[kind], v = rgb.map(toLin);
  return M.map((row) => Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))).map(gam).map((x) => Math.round(x));
}

export const wrapHue = (h) => ((h % 360) + 360) % 360;
export function mixHue(a, b, t) { const d = ((b - a + 540) % 360) - 180; return wrapHue(a + d * t); }
export const hueGap = (a, b) => Math.abs(((b - a + 540) % 360) - 180);
