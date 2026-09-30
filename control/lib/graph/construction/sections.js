// construction/sections — rolled steel sections and reinforcing bars, by name, with the section properties the checks
// read. Dimensions in millimetres, from the producers' tables: AISC W-shapes (converted from inches), European IPE and
// HEA (EN 10365), parallel-flange channels, equal angles, square and circular hollow sections, flat bar. Properties are
// computed from the plate dimensions with the root fillets left out, so area and I run about 2–4% under the tables
// (conservative for the advisory checks; the section test pins the gap).
//
// A section's local axes match a member's: y across the flanges (width), z along the web (depth, the strong axis).
// `profile(sec)` gives the cross-section as polygons in (y, z) metres: `outer` (CCW) and, for a hollow section,
// `inner` — what the frame extrudes along the member.
import * as dmath from '../../util/dmath.js';


export const STEEL = Object.freeze({ E: 200e9, density: 7850, Fy: { S235: 235e6, S275: 275e6, S355: 355e6, A36: 250e6, A992: 345e6 } });

const W = (d, bf, tw, tf) => ({ shape: 'I', h: d, b: bf, tw, tf, grade: 'A992' });
const I = (h, b, tw, tf) => ({ shape: 'I', h, b, tw, tf, grade: 'S355' });
export const SECTIONS = Object.freeze({
  // AISC wide-flange (d, bf, tw, tf)
  W6x9: W(150, 100, 4.3, 5.5), W8x31: W(203, 203, 7.2, 11.0), W10x33: W(247, 202, 7.4, 11.0), W12x26: W(310, 165, 5.8, 9.7),
  W14x30: W(351, 171, 6.9, 9.8), W16x40: W(406, 178, 7.7, 12.8), W18x50: W(457, 190, 9.0, 14.5), W24x68: W(602, 228, 10.5, 14.9),
  // European I and H (h, b, tw, tf)
  IPE100: I(100, 55, 4.1, 5.7), IPE160: I(160, 82, 5.0, 7.4), IPE200: I(200, 100, 5.6, 8.5), IPE240: I(240, 120, 6.2, 9.8),
  IPE300: I(300, 150, 7.1, 10.7), IPE360: I(360, 170, 8.0, 12.7), IPE400: I(400, 180, 8.6, 13.5),
  HEA100: I(96, 100, 5, 8), HEA160: I(152, 160, 6, 9), HEA200: I(190, 200, 6.5, 10), HEA240: I(230, 240, 7.5, 12), HEA300: I(290, 300, 8.5, 14),
  // channels (h, b, tw, tf), angles (leg, leg, t), hollow (b | D, t), flat (b, t)
  PFC100: { shape: 'C', h: 100, b: 50, tw: 5, tf: 8.5, grade: 'S275' }, PFC150: { shape: 'C', h: 150, b: 75, tw: 5.5, tf: 10, grade: 'S275' },
  PFC200: { shape: 'C', h: 200, b: 75, tw: 6, tf: 12, grade: 'S275' },
  L50x5: { shape: 'L', h: 50, b: 50, t: 5, grade: 'S275' }, L75x6: { shape: 'L', h: 75, b: 75, t: 6, grade: 'S275' }, L100x10: { shape: 'L', h: 100, b: 100, t: 10, grade: 'S275' },
  SHS100x6: { shape: 'SHS', h: 100, b: 100, t: 6, grade: 'S355' }, SHS150x8: { shape: 'SHS', h: 150, b: 150, t: 8, grade: 'S355' },
  RHS200x100x8: { shape: 'SHS', h: 200, b: 100, t: 8, grade: 'S355' },
  CHS114x6: { shape: 'CHS', h: 114.3, b: 114.3, t: 6, grade: 'S355' }, CHS168x8: { shape: 'CHS', h: 168.3, b: 168.3, t: 8, grade: 'S355' },
  FL100x10: { shape: 'FL', h: 10, b: 100, grade: 'S275' },
});
export const SECTION_KEYS = Object.freeze(Object.keys(SECTIONS));

/** Reinforcing bar diameters, mm: metric ⌀ and US bar numbers. */
export const REBAR = Object.freeze({ 8: 8, 10: 10, 12: 12, 16: 16, 20: 20, 25: 25, 32: 32, '#3': 9.5, '#4': 12.7, '#5': 15.9, '#6': 19.1, '#8': 25.4 });
/** A bar size → its diameter in mm, or null. A plain number is a diameter. */
export function barMm(size) {
  if (REBAR[size] !== undefined) return REBAR[size];
  return Number.isFinite(size) && size >= 4 && size <= 50 ? size : null;
}

/** Why a section name is unknown, or null. */
export const sectionError = (name) => (SECTIONS[name] ? null : `unknown section '${name}' (one of ${SECTION_KEYS.join(', ')})`);

/** The section's bounding width (y) and depth (z) in metres. */
export function sectionBox(name) {
  const s = SECTIONS[name];
  return [s.b / 1000, s.h / 1000];
}

/**
 * Strong-axis properties (SI): { A (m²), I (m⁴), S (m³), mass (kg/m), Fy (Pa) }. Fillets are left out.
 */
export function sectionProps(name) {
  const s = SECTIONS[name];
  const mm = (v) => v / 1000;
  const h = mm(s.h), b = mm(s.b);
  let A, Ix, c = h / 2;
  switch (s.shape) {
    case 'I': case 'C': {
      const tw = mm(s.tw), tf = mm(s.tf);
      A = 2 * b * tf + (h - 2 * tf) * tw;
      Ix = (b * dmath.pow(h, 3) - (b - tw) * dmath.pow(h - 2 * tf, 3)) / 12;
      break;
    }
    case 'L': {
      const t = mm(s.t);
      A = t * (h + b - t);
      // about the horizontal axis through the centroid
      const yA = [h * t, (b - t) * t], yC = [h / 2, t / 2];
      const cy = (yA[0] * yC[0] + yA[1] * yC[1]) / A;
      Ix = (t * dmath.pow(h, 3)) / 12 + yA[0] * (yC[0] - cy) ** 2 + ((b - t) * dmath.pow(t, 3)) / 12 + yA[1] * (yC[1] - cy) ** 2;
      c = Math.max(cy, h - cy);                                              // the extreme fibre from the centroid
      break;
    }
    case 'SHS': { const t = mm(s.t); A = b * h - (b - 2 * t) * (h - 2 * t); Ix = (b * dmath.pow(h, 3) - (b - 2 * t) * dmath.pow(h - 2 * t, 3)) / 12; break; }
    case 'CHS': { const t = mm(s.t), D = h, d = D - 2 * t; A = (Math.PI * (D * D - d * d)) / 4; Ix = (Math.PI * (dmath.pow(D, 4) - dmath.pow(d, 4))) / 64; break; }
    default: { A = b * h; Ix = (b * dmath.pow(h, 3)) / 12; }
  }
  return { A, I: Ix, S: Ix / c, mass: A * STEEL.density, Fy: STEEL.Fy[s.grade] };
}

/**
 * The cross-section as polygons in the member's (y, z), metres, centred on the bounding box:
 * { outer: [[y, z]…], inner?: [[y, z]…] }. I and C are drawn without fillets; a round tube is a 20-gon.
 */
export function profile(name) {
  const s = SECTIONS[name];
  const mm = (v) => v / 1000;
  const h = mm(s.h), b = mm(s.b), hy = b / 2, hz = h / 2;
  switch (s.shape) {
    case 'I': {
      const tw = mm(s.tw) / 2, tf = mm(s.tf);
      return { outer: [[-hy, -hz], [hy, -hz], [hy, -hz + tf], [tw, -hz + tf], [tw, hz - tf], [hy, hz - tf], [hy, hz], [-hy, hz], [-hy, hz - tf], [-tw, hz - tf], [-tw, -hz + tf], [-hy, -hz + tf]] };
    }
    case 'C': {
      const tw = mm(s.tw), tf = mm(s.tf);
      return { outer: [[-hy, -hz], [hy, -hz], [hy, -hz + tf], [-hy + tw, -hz + tf], [-hy + tw, hz - tf], [hy, hz - tf], [hy, hz], [-hy, hz]] };
    }
    case 'L': { const t = mm(s.t); return { outer: [[-hy, -hz], [hy, -hz], [hy, -hz + t], [-hy + t, -hz + t], [-hy + t, hz], [-hy, hz]] }; }
    case 'SHS': { const t = mm(s.t); return { outer: [[-hy, -hz], [hy, -hz], [hy, hz], [-hy, hz]], inner: [[-hy + t, -hz + t], [hy - t, -hz + t], [hy - t, hz - t], [-hy + t, hz - t]] }; }
    case 'CHS': {
      const t = mm(s.t); const ring = (r) => Array.from({ length: 20 }, (_, i) => { const a = (2 * Math.PI * i) / 20; return [r * dmath.cos(a), r * dmath.sin(a)]; });
      return { outer: ring(h / 2), inner: ring(h / 2 - t) };
    }
    default: return { outer: [[-hy, -hz], [hy, -hz], [hy, hz], [-hy, hz]] };
  }
}
