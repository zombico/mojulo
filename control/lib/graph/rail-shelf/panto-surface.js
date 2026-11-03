/**
 * panto-surface — the surface compiler of a current collector (panto-odm.js solves it and stands it at a pose):
 * named quads at a level of detail (rail-geom.js).
 *
 *   base   the insulators it stands on (each revolved with its sheds), the base frame's tubes, the drive at the hinge
 *          (a single arm's air bellows, a diamond's springs), a pole's sprung swivel
 *   arms   a single arm's lower arm (two tubes from the hinge converging to the knee) and its guide rod, its upper arm
 *          (a tube pair from the knee to the head); a diamond's two frames, lower and upper, and their cross tubes; a
 *          pole and its harp
 *   head   the pan's bar across, its carbon strips on top, its horns curling down at each end, the springs under it; a
 *          pole's wheel in its harp
 *
 *   compilePantoSurface(brief, { quality, pose: { raise?, wire? }, facing }) → { design, quality, pose, faces,
 *                                                                             hardpoints, joints, census }
 *     facing  +1 its knee leading (+y), −1 turned end for end
 *     hardpoints  mount (under its base's middle on the roof), contact (the strips' top over the head's middle)
 *
 * Pantograph space: the origin on the roof under its base, +y forward, +x right, z up. Pure and deterministic.
 */
import { solvePantoDesign, pantoPose } from './panto-odm.js';
import { r4, add, mul, box, cylinder, revolve, finishRailFaces } from './rail-geom.js';

export const PANTO_LODS = Object.freeze({
  game: Object.freeze({ tube: 6, round: 10, sheds: 3 }),
  studio: Object.freeze({ tube: 8, round: 14, sheds: 4 }),
  hero: Object.freeze({ tube: 12, round: 20, sheds: 6 }),
});
const COLOURS = Object.freeze({ arm: '#8d9296', frame: '#6d7276', insulator: '#c9c3b6', strip: '#2a2b2c', head: '#a7abaf', drive: '#2e3033', wheel: '#b07a45' });

export function compilePantoSurface(brief = {}, { quality = 'studio', pose = {}, facing = 1 } = {}) {
  const LOD = PANTO_LODS[quality];
  if (!LOD) throw new Error(`rail-panto: quality is ${Object.keys(PANTO_LODS).join(', ')}`);
  const d = brief.arms && brief.head ? brief : solvePantoDesign(brief);
  if (!d.valid) throw new Error(`rail-panto: the design fails its laws (${d.laws.filter((l) => !l.pass).map((l) => l.id).join(', ')})`);
  const P = pantoPose(d, pose), B = d.base, Hd = d.head, hz = B.hinge, base = [], arms = [], head = [];
  const tube = (out, a, b, r, part) => cylinder(out, a, b, r, LOD.tube, part);
  const [FL, FW] = B.frame;
  // ── the base: insulators with their sheds under the frame's corners, the frame, the drive ──
  const corners = d.kind === 'pole' ? [[0.22, 0.2], [-0.22, 0.2], [0.22, -0.2], [-0.22, -0.2]] : [[FW / 2, FL / 2], [-FW / 2, FL / 2], [FW / 2, -FL / 2], [-FW / 2, -FL / 2]];
  for (const [x, y] of corners) {
    const n = LOD.sheds, zi = B.insulator, prof = [[0, 0]];
    for (let k = 0; k < n; k += 1) { const z0 = 0.03 + ((zi - 0.06) * k) / n, z1 = 0.03 + ((zi - 0.06) * (k + 1)) / n; prof.push([z0, 0.045], [z0 + (z1 - z0) * 0.35, 0.085], [z0 + (z1 - z0) * 0.65, 0.085], [z1, 0.045]); }
    prof.push([zi - 0.02, 0.05], [zi, 0.06], [zi, 0]);
    revolve(base, prof, { axis: 'z', at: [x, y], n: LOD.round, partOf: () => 'panto.insulator' });
  }
  const zf = B.insulator, ring = (x0, x1, y0, y1, z) => { tube(base, [x0, y0, z], [x1, y0, z], 0.035, 'panto.frame'); tube(base, [x0, y1, z], [x1, y1, z], 0.035, 'panto.frame'); tube(base, [x0, y0, z], [x0, y1, z], 0.035, 'panto.frame'); tube(base, [x1, y0, z], [x1, y1, z], 0.035, 'panto.frame'); };
  if (d.kind === 'pole') box(base, [-0.25, 0.25], [-0.22, 0.22], [zf, zf + 0.08], 'panto.frame');
  else ring(-FW / 2, FW / 2, -FL / 2, FL / 2, zf + 0.035);
  // the moving parts in their own frame: y along the facing, about the hinge
  const F = (p) => [p[0], facing * p[1], p[2]];
  if (d.kind === 'arm') {
    const yh = -d.arms.lead, K = [0, yh + P.knee[0], hz + P.knee[1]], Hc = [0, yh + P.head[0], hz + P.head[1]];
    // (the drive: an air bellows at the hinge, its rod to the lower arm's foot)
    cylinder(base, F([0, yh - 0.25, zf + 0.07]), F([0, yh - 0.25, zf + 0.25]), 0.11, LOD.round, 'panto.drive');
    tube(base, F([-0.3, yh, hz]), F([0.3, yh, hz]), 0.05, 'panto.frame');
    // (the lower arm: two tubes from the hinge's ends converging to the knee, its cross tube; the guide rod under it)
    for (const sx of [1, -1]) tube(arms, F([sx * 0.28, yh, hz]), F([sx * 0.06, K[1], K[2]]), 0.04, 'panto.arm');
    const mid = mul(add([0, yh, hz], K), 0.5);
    tube(arms, F([-0.18, mid[1], mid[2]]), F([0.18, mid[1], mid[2]]), 0.025, 'panto.arm');
    tube(arms, F([0.04, yh - 0.12, hz - 0.04]), F([0.04, K[1] - 0.1, K[2] - 0.08]), 0.014, 'panto.rod');
    tube(arms, F([-0.08, K[1], K[2]]), F([0.08, K[1], K[2]]), 0.045, 'panto.arm');
    // (the upper arm: a tube pair from the knee to the head's frame, closing to it)
    for (const sx of [1, -1]) tube(arms, F([sx * 0.05, K[1], K[2]]), F([sx * 0.26, Hc[1], Hc[2] - 0.04]), 0.028, 'panto.arm');
    tube(arms, F([-0.27, Hc[1], Hc[2] - 0.04]), F([0.27, Hc[1], Hc[2] - 0.04]), 0.025, 'panto.arm');
    headAt(head, F(Hc), Hd, LOD, tube);
  } else if (d.kind === 'diamond') {
    const s = B.pivot, h = P.height, kn = P.knee[0];
    for (const sy of [1, -1]) {
      // (each frame: its lower arm from the pivot out to the knee, its upper arm back to the head's end; at both sides)
      for (const sx of [1, -1]) {
        const p0 = [sx * 0.42, sy * s, hz], k = [sx * 0.42, sy * kn, hz + h / 2], p1 = [sx * 0.42, sy * 0.2, hz + h - 0.04];
        tube(arms, p0, k, 0.032, 'panto.arm'); tube(arms, k, p1, 0.028, 'panto.arm');
      }
      tube(arms, [-0.42, sy * kn, hz + h / 2], [0.42, sy * kn, hz + h / 2], 0.025, 'panto.arm');
      tube(arms, [-0.45, sy * s, hz], [0.45, sy * s, hz], 0.04, 'panto.frame');
      cylinder(base, [0.5, sy * s, hz - 0.05], [0.5, sy * (s - 0.3), hz - 0.05], 0.05, LOD.round, 'panto.drive');
    }
    headAt(head, [0, 0, hz + h], Hd, LOD, tube);
  } else {
    // (a pole: from its sprung swivel, trailing, to its harp and its wheel on the wire)
    const a = (P.angle * Math.PI) / 180, L = d.arms.lower, tip = [0, -L * Math.cos(a), hz + L * Math.sin(a)];
    cylinder(base, [0, 0, zf + 0.08], [0, 0, hz + 0.05], 0.1, LOD.round, 'panto.drive');
    for (const sx of [1, -1]) tube(base, F([sx * 0.14, 0.1, hz]), F([sx * 0.06, -0.55, hz + 0.02]), 0.03, 'panto.drive');
    tube(arms, F([0, 0, hz]), F(tip), 0.035, 'panto.arm');
    const harp = add(tip, [0, -0.06 * Math.cos(a), 0.06 * Math.sin(a)]);
    for (const sx of [1, -1]) tube(arms, F(tip), F(add(harp, [sx * 0.045, 0, 0.02])), 0.012, 'panto.arm');
    cylinder(head, F(add(harp, [-0.025, 0, 0.03])), F(add(harp, [0.025, 0, 0.03])), 0.05, LOD.round, 'panto.wheel');
  }
  const colour = (part) => ({ 'panto.arm': COLOURS.arm, 'panto.rod': COLOURS.arm, 'panto.frame': COLOURS.frame, 'panto.insulator': COLOURS.insulator, 'panto.strip': COLOURS.strip, 'panto.head': COLOURS.head,
    'panto.horn': COLOURS.head, 'panto.drive': COLOURS.drive, 'panto.wheel': COLOURS.wheel }[part] ?? COLOURS.frame);
  const faces = {};
  for (const [k, list] of Object.entries({ base, arms, head })) faces[k] = finishRailFaces(list.map((f) => ({ ...f, fill: colour(f.part) })));
  const all = Object.values(faces).flat(), parts = {};
  for (const f of all) parts[f.part] = (parts[f.part] || 0) + 1;
  const ch = d.kind === 'pole' ? F([0, P.head[0], hz + P.head[1] + Hd.top]) : F([0, d.kind === 'arm' ? 0 : 0, P.contact]);
  return {
    design: d, quality, pose: P, faces,
    hardpoints: { mount: [0, 0, 0], contact: ch.map(r4) },
    joints: [{ name: 'raise', control: 'raise', kind: 'lift', range: [d.range.min, d.range.max], raise: P.raise, height: P.height }],
    census: { faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0), parts },
  };
}

// the pan head at its centre c: its bar across, the strips on it, the horns curling down at its ends, its springs
function headAt(out, c, Hd, LOD, tube) {
  const w = Hd.width / 2, hb = w - Hd.horn, zt = c[2] + Hd.top;
  for (const sy of Hd.strips === 2 ? [1, -1] : [0]) {
    const y = c[1] + sy * Hd.spacing / 2;
    box(out, [-hb, hb], [y - 0.03, y + 0.03], [zt - 0.06, zt], 'panto.strip');
    box(out, [-hb - 0.02, hb + 0.02], [y - 0.04, y + 0.04], [zt - 0.1, zt - 0.06], 'panto.head');
    // (the horns: from each end of the strip's carrier, out and down in a curl)
    for (const sx of [1, -1]) {
      let p = [sx * hb, y, zt - 0.08];
      for (let k = 1; k <= 4; k += 1) { const a = (k / 4) * (Math.PI / 2), q = [sx * (hb + Hd.horn * Math.sin(a)), y, zt - 0.08 - Hd.horn * 0.8 * (1 - Math.cos(a))]; tube(out, p, q, 0.016, 'panto.horn'); p = q; }
    }
  }
  tube(out, [-0.3, c[1] - Hd.spacing / 2, c[2] - 0.02], [0.3, c[1] + Hd.spacing / 2, c[2] - 0.02], 0.02, 'panto.head');
  for (const sx of [1, -1]) cylinder(out, [sx * 0.25, c[1], c[2] - 0.05], [sx * 0.25, c[1], zt - 0.1], 0.03, LOD.tube, 'panto.drive');
}
