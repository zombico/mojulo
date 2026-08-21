/**
 * Kernel colour primitives — hex ⇄ rgb and a scalar multiply. Pure, zero-dep,
 * byte-identical. Lifted here so kernel-resident consumers (the diagram
 * renderer's optional signage overlay) don't reach into the creative colour
 * stack (`lib/graph/polygonizer/vexar`), which stays where it is with its 40
 * creative importers. Diagrams are just SVGs; this is the only maths the
 * signage annotation needs. See install-capabilities.plan.md P3c.
 */

export function hexToRgb(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function rgbToHex(r) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r[0])}${c(r[1])}${c(r[2])}`;
}

export function scaleHex(hex, f) {
  return rgbToHex(hexToRgb(hex).map((v) => v * f));
}
