/**
 * ROCK FABRIC — the rock's own 3D structure, for drawing it nearer than its facets can. A rock presupposes its geometry:
 * granite breaks on two near-vertical joint sets at right angles, basalt into hexagonal columns, slate along one dipping
 * cleavage, a sedimentary stone on its beds. The landform (polygonizer/landform.js) breaks the cliff's polygons on the
 * same fabric at the metre scale; this is that fabric as planes in world space, so the page (scene/channels/fabric.js)
 * can draw where those planes cut each face: the grooves of the joints, each block's own plane, the beds' recesses, the
 * grain. A face along a joint set shows none of that set (it IS a joint face); a face across it shows its lines, their
 * spacing widened by the angle; the beds stay level round the whole cliff. Every face differs, and all agree.
 *
 *   rockFabric({ joints?, strata?, rock?, grit?, sun, ambient?, seed? }) → the page's fabric, or null
 *     joints   a landform's registered joint fabric (landform.js `s.joints`: { pattern, strike, spacing, cell, dip }), or
 *              { pattern?, strike?, spacing? } (the rock's own pattern, landform.js ROCK_JOINTS, by default)
 *     strata   a landform's registered beds (`s.strata`: { layers: [{ b, t, hard }], tanD, cx, cy }), or none
 *     sun      the direction toward the key light (world, z up); `ambient` the share the shade keeps
 *
 * The level of detail is the page's: each layer fades in once its feature spans a few pixels (`px`), and past the
 * widest groove's distance (`maxFoot` metres per pixel: where it first spans `px` pixels) the page does no work at all, so the polygons carry the far
 * view and the fabric only refines what is near, down to its finest layer, the grain.
 *
 * Pure: numbers rounded to 1e-4; no dice beyond the seed's phases.
 */
import { JOINT_PATTERNS, ROCK_JOINTS } from '../polygonizer/landform.js';
import { ROCK_PRESETS } from '../polygonizer/rock-minerals.js';
import { hash01 } from './relief.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const D2R = Math.PI / 180, cosD = (a) => Math.cos(a * D2R);
// how a joint reads, by pattern: its groove as a share of the set's spacing, and how much of its length it holds
const READ = { blocky: { width: 0.035, hold: 0.75 }, columnar: { width: 0.03, hold: 0.95 }, slabby: { width: 0.05, hold: 0.9 } };
export const FABRIC_GROUPS = Object.freeze(['isekai:cliff']);

/** The joint sets of a fabric: [{ n, s }] (unit normal, spacing in metres), from its pattern, strike, spacing, cell. */
function setsOf(J) {
  const P = JOINT_PATTERNS[J.pattern] ?? JOINT_PATTERNS.blocky, cell = J.cell ?? P.cell, c = Math.cos(J.strike * D2R), s = Math.sin(J.strike * D2R);
  if (P.lattice === 'hex') return [0, 60, 120].map((a) => ({ n: [Math.cos((J.strike + a) * D2R), Math.sin((J.strike + a) * D2R), 0], s: J.spacing * 0.866 }));
  if (P.plane === 'dip') {
    // the cleavage dips `dip` degrees across the strike; a sparse vertical set along it
    const d = (J.dip ?? 60) * D2R;
    return [{ n: [-s * Math.sin(d), c * Math.sin(d), Math.cos(d)], s: J.spacing * cell[1] }, { n: [c, s, 0], s: J.spacing * cell[0] * 2 }];
  }
  return [{ n: [c, s, 0], s: J.spacing * cell[0] }, { n: [-s, c, 0], s: J.spacing * cell[1] }];
}

export function rockFabric({ joints = null, strata = null, rock = 'granite', grit = 0.6, sun, ambient = 0.35, seed = 1 } = {}) {
  if (!sun) throw new Error('fabric: sun is the direction toward the key light');
  const pattern = joints?.pattern ?? ROCK_JOINTS[typeof rock === 'string' ? rock : ''] ?? 'blocky';
  const J = { pattern, strike: joints?.strike ?? Math.round(hash01(seed, 3, 7) * 180), spacing: joints?.spacing ?? 3, cell: joints?.cell, dip: joints?.dip };
  const R = READ[pattern] ?? READ.blocky, g = 0.4 + 0.6 * grit;
  // each set at two orders: its master joints (the landform's, on the lattice's integer lines, so a set's planes sit at
  // q = integer) and, at a third of the spacing, its minor joints, the same orientation, thinner, stopping more often
  // (a joint set keeps its bearing across scales; the minor ones read only nearer the eye)
  const masters = setsOf(J), sets = [];
  for (const [order, k, wk, hk] of [[0, 1, 1, 1], [1, 1 / 3, 0.5, 0.6]]) masters.forEach(({ n, s }, i) => {
    const sp = s * k, w = Math.max(0.02, R.width * s * wk);
    sets.push({ n: n.map(r4), s: r4(sp), w: r4(w), d: r4(w * 0.9 * g), hold: r4(R.hold * hk), phase: r4(order ? hash01(seed, i, 13) : hash01(seed, i, 11) * 0.08) });
  });
  const beds = strata && strata.layers?.length ? {
    b: strata.layers.map((L) => r4(L.b)).slice(0, 16), t: strata.layers.map((L) => r4(L.t)).slice(0, 16), hard: strata.layers.map((L) => (L.hard ? 1 : 0)).slice(0, 16),
    dip: [r4((strata.tanD ?? 0) * (strata.cx ?? 1)), r4((strata.tanD ?? 0) * (strata.cy ?? 0))],
  } : null;
  const grain = Math.max(0.004, (typeof rock === 'string' ? ROCK_PRESETS[rock]?.grain : rock?.grain) ?? 0.004);
  // the sphere's edge: where the widest groove (a joint's, or a soft bed's step) first spans `px` pixels; farther, no
  // feature can be read, so no pixel does the work
  const PX = 1.5, widest = Math.max(...sets.map((x) => x.w), beds ? 0.06 : 0);
  return {
    groups: [...FABRIC_GROUPS], sun: sun.map(r4), ambient: r4(ambient), sets,
    ...(beds ? { beds, recess: r4(0.08 * g) } : {}),
    tilt: r4(0.12 * grit), cavity: 0.35, wave: 0.12,
    // the joints read where the landform breaks the ground on them: its steep band (degrees), the gentler slopes soft
    steep: [r4(cosD((joints?.steep ?? 38) - (joints?.band ?? 12) / 2 - 6)), r4(cosD((joints?.steep ?? 38) + (joints?.band ?? 12) / 2))], grain: { size: r4(grain * 2), amount: r4(0.1 * g) },
    // the level of detail: a layer fades in from `px` pixels across; past `maxFoot` metres a pixel, none is drawn
    px: PX, maxFoot: r4(widest / PX),
  };
}
