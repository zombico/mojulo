// construction/legs — how a build's legs are DRAWN: a leg form (tapered, turned, bun, hairpin; furniture-builds.js
// LEG_SHAPES) over the square blank the build cuts. Only the faces change: a turned or tapered leg is turned from the
// blank, so the members, joints, manual and cut list stay the blank's. The facades (./facades.js) and the workbench
// (worlds/workbench.js, a frame's `legs`) both draw through here.
import { shadeHexMat } from '../polygonizer/vexar.js';
import { resolveMaterial } from '../polygonizer/materials.js';
import { boxPolys, frustumPolys, tubePolys } from './prims.js';
import { memberColor, rgbHex } from './timber.js';

// Stations [t, r]: t up the shaped length (0 at the floor), r a share of the blank's half width. A turned leg keeps its
// top fifth square, the pommel the rails tenon into; a leg taller than the piece's shortest (a chair's back leg) is
// shaped to that height and stays square above it.
const LEG_PROFILES = {
  tapered: { stations: [[0, 0.55], [1, 1]] },
  turned: { stations: [[0, 0.62], [0.05, 0.62], [0.09, 0.92], [0.14, 0.58], [0.45, 0.8], [0.7, 0.62], [0.76, 0.96], [0.8, 0.96]], pommel: 0.8 },
  bun: { stations: [[0, 0.5], [0.12, 1.05], [0.35, 1.3], [0.6, 1.3], [0.85, 1.05], [1, 0.75]] },
};
const ROD = { r: 5, plate: 4, glide: 4, hex: '#2b2e33' };   // a hairpin leg's steel rod, its mounting plate and its foot glide (mm)
const isLeg = (id) => /^leg-/.test(id);

/** Replace the build's square legs with a leg form's → the faces, in the recipe's frame and unit (`mmPerUnit`
 *  millimetres a unit: the rod, plate and glide are sized in mm). `spec` is { members, legs, tint? }: the facades pass
 *  their recipe, the workbench a frame's expanded build. */
export function shapeLegs(faces, spec, LM, mmPerUnit = 1) {
  const legs = spec.members.filter((m) => isLeg(m.id) && m.box);
  const rod = { r: ROD.r / mmPerUnit, plate: ROD.plate / mmPerUnit, glide: ROD.glide / mmPerUnit };
  if (!legs.length) return faces;
  const sample = faces.find((f) => isLeg(f.group)) || {};
  const keep = { ...(sample.spec ? { spec: sample.spec } : {}), ...(sample.pbr ? { pbr: sample.pbr } : {}) };
  const out = faces.filter((f) => !isLeg(f.group));
  const wood = resolveMaterial('wood'), steel = resolveMaterial('steel');
  const shortest = Math.min(...legs.map((m) => m.box.max[2] - m.box.min[2]));
  for (const m of legs) {
    const [x0, y0, z0] = m.box.min, [x1, y1, z1] = m.box.max;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = Math.min(x1 - x0, y1 - y0) / 2, top = z0 + shortest;
    const polys = [];
    if (spec.legs === 'hairpin') {
      // two rods in a V from a mounting plate screwed under the piece, down to a glide on the floor
      const rods = tubePolys([[cx - s * 0.8, cy, top - rod.plate], [cx, cy, z0 + rod.glide + rod.r], [cx + s * 0.8, cy, top - rod.plate]], rod.r, { sides: 6 });
      const plate = boxPolys([cx, cy, top - rod.plate / 2], [2 * s, 2 * s, rod.plate]);
      const glide = frustumPolys([cx, cy, z0], [cx, cy, z0 + rod.glide], rod.r * 1.6, rod.r * 1.2, 8);
      for (const p of [...rods, ...plate, ...glide]) out.push({ corners: p.corners, fill: shadeHexMat(ROD.hex, p.n, steel, { light: LM }), doubleSided: true, outNormal: p.n, group: m.id });
      if (z1 > top + 1e-6) polys.push(...boxPolys([cx, cy, (top + z1) / 2], [x1 - x0, y1 - y0, z1 - top]));
    } else {
      const P = LEG_PROFILES[spec.legs];
      const span = top - z0, until = P.pommel ? z0 + span * P.pommel : top;
      for (let i = 0; i + 1 < P.stations.length; i++) {
        const [t0, r0] = P.stations[i], [t1, r1] = P.stations[i + 1];
        const a = z0 + span * t0, b = z0 + span * t1;
        if (b - a > 1e-6) polys.push(...frustumPolys([cx, cy, a], [cx, cy, b], s * r0, s * r1, 12));
      }
      if (z1 > until + 1e-6) polys.push(...boxPolys([cx, cy, (until + z1) / 2], [x1 - x0, y1 - y0, z1 - until]));
    }
    const hex = rgbHex(memberColor(m.species || 'beech', { tint: spec.tint, finish: m.finish }).rgb);
    for (const p of polys) out.push({ corners: p.corners, fill: shadeHexMat(hex, p.n, wood, { light: LM }), doubleSided: true, outNormal: p.n, group: m.id, ...keep });
  }
  return out;
}
