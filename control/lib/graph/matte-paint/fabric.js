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
const READ = { blocky: { width: 0.025, hold: 0.75 }, columnar: { width: 0.022, hold: 0.95 }, slabby: { width: 0.04, hold: 0.9 } };
export const FABRIC_GROUPS = Object.freeze(['isekai:cliff']);

/**
 * SKINS (`skin`, opt-in): the rock's chunks, not its lines. One field, Voronoi regions in 3D warped by Perlin noise, laid
 * in the fabric's own frame (along the joint strike, across it, up; a slate's along its cleavage), so the chunks are the
 * blocks the joints bound and every face through one agrees. Each chunk stands proud or sits back by its own dice, its
 * edge rounded into a recess (lit on its sunward wall, in its neighbour's cast shadow on the other), its skin uneven.
 *   cell      the chunk's size in the fabric's frame, metres: [along, across, up]
 *   warp      how far the outlines wander (m), over `warpScale` m;  bevel, gap, gapDepth: the rounded edge and the recess
 *   proud     how far a chunk stands out or back;  rough: its skin;  flute: [amp, across m, up m] vertical flutes
 *   beds      [height, ledge] m: courses of ledges (a stone with strata)
 * By pattern: blocky (granite) → sculpted, columnar (basalt) → fluted, slabby (slate) → slabs, strata → bedded.
 */
export const ROCK_SKINS = Object.freeze({
  fluted: Object.freeze({ cell: [0.7, 0.7, 2.4], warp: 0.25, warpScale: 1.2, bevel: 0.1, gap: 0.03, gapDepth: 0.14, proud: 0.14, rough: 0.01, flute: [0.014, 0.16, 1.4], beds: null }),
  sculpted: Object.freeze({ cell: [0.9, 0.9, 1.6], warp: 0.3, warpScale: 1.0, bevel: 0.14, gap: 0.05, gapDepth: 0.22, proud: 0.2, rough: 0.016, flute: [0.008, 0.12, 1.0], beds: null }),
  slabs: Object.freeze({ cell: [1.1, 1.1, 0.42], warp: 0.25, warpScale: 1.2, bevel: 0.12, gap: 0.035, gapDepth: 0.16, proud: 0.2, rough: 0.006, flute: [0, 1, 1], beds: null }),
  bedded: Object.freeze({ cell: [1.4, 1.4, 0.3], warp: 0.15, warpScale: 1.5, bevel: 0.08, gap: 0.015, gapDepth: 0.05, proud: 0.06, rough: 0.01, flute: [0, 1, 1], beds: [0.32, 0.09] }),
});
export const ROCK_SKIN_IDS = Object.freeze(Object.keys(ROCK_SKINS));
const SKIN_OF = { blocky: 'sculpted', columnar: 'fluted', slabby: 'slabs' };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
/** The skin's frame: rows along the fabric's strike, across it, and up (a slate's up is its cleavage's normal). */
function skinFrame(pattern, masters) {
  if (pattern === 'slabby') { const up = unit(masters[0].n), along = unit(masters[1].n); return [along, unit(cross(up, along)), up]; }
  const along = unit([masters[0].n[0], masters[0].n[1], 0]);
  return [along, unit(cross([0, 0, 1], along)), [0, 0, 1]];
}

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

export function rockFabric({ joints = null, strata = null, rock = 'granite', grit = 0.6, sun, ambient = 0.35, seed = 1, skin = undefined } = {}) {
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
    // a weathered joint is a shallow gap, not a cut: its depth about half its width
    sets.push({ n: n.map(r4), s: r4(sp), w: r4(w), d: r4(w * 0.45 * g), hold: r4(R.hold * hk), phase: r4(order ? hash01(seed, i, 13) : hash01(seed, i, 11) * 0.08) });
  });
  const beds = strata && strata.layers?.length ? {
    b: strata.layers.map((L) => r4(L.b)).slice(0, 16), t: strata.layers.map((L) => r4(L.t)).slice(0, 16), hard: strata.layers.map((L) => (L.hard ? 1 : 0)).slice(0, 16),
    dip: [r4((strata.tanD ?? 0) * (strata.cx ?? 1)), r4((strata.tanD ?? 0) * (strata.cy ?? 0))],
  } : null;
  const grain = Math.max(0.004, (typeof rock === 'string' ? ROCK_PRESETS[rock]?.grain : rock?.grain) ?? 0.004);
  // the sphere's edge: where the widest groove (a joint's, or a soft bed's step) first spans `px` pixels; farther, no
  // feature can be read, so no pixel does the work
  const PX = 1.5, widest = Math.max(...sets.map((x) => x.w), beds ? 0.06 : 0);
  // the skin (opt-in): by the pattern, or named; a stone with strata is bedded
  const skinId = skin === undefined || skin === false ? null : skin === true ? (beds ? 'bedded' : SKIN_OF[pattern] ?? 'sculpted') : skin;
  if (skinId !== null && !ROCK_SKINS[skinId]) throw new Error(`fabric: skin is true (by the rock's pattern) or one of ${ROCK_SKIN_IDS.join(', ')}`);
  const K = skinId ? ROCK_SKINS[skinId] : null;
  const skinOut = K ? { skin: { id: skinId, frame: skinFrame(pattern, masters).map((r) => r.map(r4)), cell: K.cell, warp: K.warp, warpScale: K.warpScale, bevel: K.bevel, gap: K.gap,
    gapDepth: r4(K.gapDepth * g), proud: r4(K.proud * g), rough: r4(K.rough * g), flute: [r4(K.flute[0] * g), K.flute[1], K.flute[2]], ...(K.beds ? { beds: K.beds } : {}) } } : {};
  return {
    groups: [...FABRIC_GROUPS], sun: sun.map(r4), ambient: r4(ambient), sets,
    ...(beds ? { beds, recess: r4(0.08 * g) } : {}),
    // a joint's trace wanders (`wave`, in spacings) and steps sideways segment by segment (`echelon`): never a ruled line
    tilt: r4(0.12 * grit), cavity: 0.35, wave: 0.14, echelon: 0.12,
    // the joints read where the landform breaks the ground on them: its steep band (degrees), the gentler slopes soft
    steep: [r4(cosD((joints?.steep ?? 38) - (joints?.band ?? 12) / 2 - 6)), r4(cosD((joints?.steep ?? 38) + (joints?.band ?? 12) / 2))], grain: { size: r4(grain * 2), amount: r4(0.1 * g) },
    // the level of detail: a layer fades in from `px` pixels across; past `maxFoot` metres a pixel, none is drawn
    // (a skin's chunks read from farther than any groove: from when the smallest spans four times `px`)
    px: PX, maxFoot: r4(K ? Math.max(widest / PX, Math.min(...K.cell) / (PX * 4)) : widest / PX),
    ...skinOut,
  };
}
