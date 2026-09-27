// The lit 5-face box every store builder shares (local unit frame, z up). Its own module so the
// fixture registry and the individual fixture files can both import it without a cycle.
import { shadeHex } from '../polygonizer/vexar.js';

/** A lit 5-face box (no bottom) in the local frame. */
export function box(out, x0, x1, y0, y1, z0, z1, hex, light, extra = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return out;
  const q = (corners, n) => out.push({ corners, fill: shadeHex(hex, n, light), normal: n, doubleSided: true, ...extra });
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  return out;
}
