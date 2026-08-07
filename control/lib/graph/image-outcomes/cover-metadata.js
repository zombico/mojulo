/**
 * cover-metadata — deterministic non-text marks for the metadata slot
 * (barcode now; QR later). Text metadata (issue #, notes) is carved via
 * title-geometry like any other cover text; this module owns marks that AREN'T
 * type.
 *
 * PLACEHOLDER BARCODE: the bar field here is a deterministic, good-LOOKING bar
 * pattern derived from the value — it is NOT a scannable EAN-13/Code128 yet.
 * Phase E replaces `barField` with a real symbology; the seam (a white quiet-zone
 * rect + a bar field + the human-readable digits carved beneath) stays.
 *
 * Pure — returns SVG fragments; no fs, no sharp.
 */
import { titleSvgPath } from './title-geometry.js';

const r2 = (n) => Math.round(n * 100) / 100;

// 4-module width patterns per digit (1 = one module wide). Deterministic filler
// so the field reads as a barcode; not a real symbology.
const PATTERNS = [
  [2, 1, 1, 2], [1, 2, 2, 1], [1, 1, 3, 1], [3, 1, 1, 1], [1, 3, 1, 1],
  [2, 2, 1, 1], [1, 1, 2, 2], [2, 1, 2, 1], [1, 2, 1, 2], [3, 1, 2, 1],
];

function digitsOf(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  return d.length ? d : '000000000';
}

/** Bar rects filling `area` (px), deterministic from the value's digits. */
function barField(value, area) {
  const digits = digitsOf(value);
  const modules = [];
  for (const ch of digits) modules.push(...PATTERNS[Number(ch)]);
  const totalModules = modules.reduce((a, b) => a + b, 0) || 1;
  const mW = area.w / totalModules;
  const parts = [];
  let x = area.x;
  modules.forEach((widthMods, i) => {
    const w = widthMods * mW;
    if (i % 2 === 0) parts.push(`<rect x="${r2(x)}" y="${r2(area.y)}" width="${r2(w)}" height="${r2(area.h)}" fill="#111111"/>`);
    x += w;
  });
  return parts.join('');
}

/**
 * A barcode block filling `zone`: white quiet-zone rect + bar field + the
 * human-readable value carved beneath.
 * @returns {string} SVG fragment.
 */
export function barcodeSvg(value, zone) {
  const pad = Math.round(Math.min(zone.w, zone.h) * 0.1);
  const inner = { x: zone.x + pad, y: zone.y + pad, w: zone.w - 2 * pad, h: zone.h - 2 * pad };
  const barsH = Math.round(inner.h * 0.72);
  const bars = barField(value, { x: inner.x, y: inner.y, w: inner.w, h: barsH });
  const digitsZone = { x: inner.x, y: inner.y + barsH, w: inner.w, h: inner.h - barsH };
  const digits = titleSvgPath(digitsOf(value), { face: 'inter', fill: '#111111' }, digitsZone, { fill: 0.82, valign: 'bottom' });
  return `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" fill="#ffffff"/>${bars}${digits}`;
}
