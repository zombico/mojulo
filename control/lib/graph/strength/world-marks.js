/**
 * strength/world-marks.js — the World's pointers: authored `marks`, plus the rigidity sensor's weak spots when
 * the row stores a `strength` spec. Each pointer is sized from the part's printable bounds (so a 40 mm bracket
 * gets a millimetre-sized pointer, not a metre one) and points in from outside, away from the part's centre.
 *
 * The reading runs on the same printable soup measure_solid reads, at the recipe's declared units (mm for a scad
 * row). A spec that cannot be read leaves no pointer; measure_solid is where its error is reported.
 */

import { printSoup } from '@/lib/graph/scene/print-measure';
import { strengthReading } from './index.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-9 ? v.map((x) => x / l) : null; };

export function worldMarks(payload, manifest, { mmPerUnit = 1000 } = {}) {
  const soup = printSoup(payload, { scale: 1 });
  if (!soup) return [];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) for (let k = 0; k < 3; k++) { const v = soup[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const center = lo.map((v, k) => (v + hi[k]) / 2);
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const size = r3(diag * 0.045);
  const outward = (at) => {
    const d = unit([at[0] - center[0], at[1] - center[1], at[2] - center[2] + diag * 0.25]);   // lean up, toward the viewer's eye line
    return (d || [0, 0, 1]).map(r3);
  };
  const out = [];
  for (const m of Array.isArray(manifest.marks) ? manifest.marks : []) {
    if (!m || !Array.isArray(m.at)) continue;
    out.push({ at: m.at, dir: Array.isArray(m.dir) ? unit(m.dir)?.map(r3) || outward(m.at) : outward(m.at), size: Number.isFinite(m.size) ? m.size : size, color: m.color, label: m.label, period: m.period });
  }
  if (manifest.strength && manifest.strength.show !== false) {
    try {
      const mmSoup = mmPerUnit === 1 ? soup : printSoup(payload, { scale: mmPerUnit });
      const { marks } = strengthReading(mmSoup, manifest.strength, { scale: mmPerUnit });
      for (const m of marks) out.push({ at: m.at, dir: outward(m.at), size, color: m.color, label: m.label, ...(m.chart ? { chart: m.chart } : {}) });
    } catch { /* an unreadable spec draws no pointer; measure_solid reports why */ }
  }
  return out;
}
