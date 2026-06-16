/**
 * Motion — M3 content interpolator (the in-between generator for content-variant
 * frames). Promoted from the slide-reveal spike
 * (lite-template/integration/0609/spike-output/slide-reveal/). See
 * motion-substrate.plan.md §4.
 *
 * Given a TARGET mark and a progress p∈[0,1], return the mark at its entrance
 * in-between state. The key property (the spike's finding): interpolation is
 * channel-agnostic by GEOMETRY, not by mark kind — it drives x / y / points /
 * opacity / text-length, so it works on a rect, a line, a polygon, or text
 * without per-kind branches.
 */

import { smoother } from './easing.js';

const lerp = (a, b, t) => a + (b - a) * t;

// The entrance presets (the thin vocabulary over this mechanism).
export const ENTRANCES = ['fly-in', 'fade-up', 'type-on', 'pop', 'fade'];
export function isEntrance(name) {
  return ENTRANCES.includes(name);
}

/**
 * @param {object} mark   the target mark (final resting state)
 * @param {string} enter  one of ENTRANCES
 * @param {string} from   'left' | 'right' (fly-in direction); ignored otherwise
 * @param {number} p      progress 0..1
 * @returns {object} the mark mutated to its in-between state (reveal annotation stripped)
 */
export function applyEntrance(mark, enter = 'fade-up', from = 'right', p = 1) {
  const e = smoother(Math.max(0, Math.min(1, p)));
  const { reveal, ...m } = mark; // never emit the annotation into the SVG
  void reveal;

  switch (enter) {
    case 'fly-in': {
      const dx = (from === 'left' ? -1 : 1) * 280 * (1 - e);
      if (m.x !== undefined) m.x += dx;
      if (m.x1 !== undefined) { m.x1 += dx; m.x2 += dx; }
      if (m.cx !== undefined) m.cx += dx;
      if (Array.isArray(m.points)) m.points = m.points.map(([x, y]) => [x + dx, y]);
      m.opacity = lerp(0.1, 1, e);
      break;
    }
    case 'fade-up': {
      const dy = 26 * (1 - e); // rise into place from below
      if (m.y !== undefined) m.y += dy;
      if (m.y1 !== undefined) { m.y1 += dy; m.y2 += dy; }
      if (m.cy !== undefined) m.cy += dy;
      if (Array.isArray(m.points)) m.points = m.points.map(([x, y]) => [x, y + dy]);
      m.opacity = e;
      break;
    }
    case 'type-on': {
      // progressive text reveal; non-text marks just fade
      if (m.kind === 'text' && typeof m.value === 'string') {
        m.value = m.value.slice(0, Math.max(0, Math.ceil(m.value.length * e)));
        m.opacity = 1;
      } else {
        m.opacity = e;
      }
      break;
    }
    // 'pop' (a scale-in) needs a transform marks don't carry — that's the
    // Regime-A per-mark-CSS path (deferred). Approximate as a fade for now.
    case 'pop':
    case 'fade':
    default:
      m.opacity = e;
      break;
  }
  return m;
}
