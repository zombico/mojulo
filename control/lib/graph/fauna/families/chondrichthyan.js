// CHONDRICHTHYAN — sharks and rays, in a SWIM pose (`pose: 'swim'`: suspended above the floor, sized by length).
// The family's tables are a GREAT WHITE: a fusiform trunk (deepest a little ahead of mid-body) tapering to a narrow
// caudal peduncle, a CONICAL snout over an underslung mouth, a tall triangular first dorsal, a CRESCENT (lunate,
// heterocercal) tail with the upper lobe a little longer, long sickle pectorals, small pelvic / second dorsal / anal
// fins, five GILL SLITS (painted), and countershading (grey back, white belly; painted). No legs, ears or nose pad:
// the fins are thin flat closed lofts (`fin()`), the pectorals and pelvics ride the `legs` rows (mirrored by name).
// A ray is the same plan with a flat diamond trunk, wings as one loft across the midline, and a whip tail.
// Tables are authored in metres at great-white size. Worked species: greatWhiteShark, hammerhead, mantaRay.

import { cartilageFish, fin, midlineFin, caudalLobe, CARTILAGE_SKIN as SKIN } from '../makers/fish.js';

// the generator (and its fin helpers) live in makers/fish.js; re-exported for existing callers
export { cartilageFish, fin, midlineFin, caudalLobe };

// the family: the shared head / eye / skin tables, and the great white's body as the default build
const GREAT_WHITE = {
  profile: [[-1.65, 0.15, 0.13], [-1.20, 0.25, 0.30], [-0.50, 0.40, 0.50], [0.20, 0.45, 0.55], [0.85, 0.40, 0.46], [1.20, 0.33, 0.36]],
  head: 'conical', snout: { len: 1.0, w: 1.15, scale: 2.7 }, neck: { from: 1.05, to: 1.55, rA: [0.36, 0.40], rB: [0.27, 0.27] },
  dorsal: { at: 0.45, base: 0.84, height: 0.72, sweep: 0.52, thick: 0.05 },
  dorsal2: { at: -1.25, base: 0.14, height: 0.16, sweep: 0.11, thick: 0.02 }, anal: { at: -1.30, base: 0.14, height: 0.15, sweep: 0.11, thick: 0.02 },
  caudal: { upper: { span: 1.32, angle: 53, chord: 0.20, thick: 0.06 }, lower: { ratio: 0.76, angle: 54, chord: 0.18 } },
  pectoral: { root: [0.30, 0.80, -0.30], span: 0.85, sweep: 0.60, drop: 0.40, chord: 0.34, tipChord: 0.09 },
  pelvic: { root: [0.16, -0.95, -0.25], span: 0.20, sweep: 0.27, drop: 0.13, chord: 0.12 },
  gills: 5, pattern: { back: '#6f7880', belly: '#eceae4', from: 0.6 },
  // the head: the eye well forward (~40% of the head back from the snout tip), the mouth an underslung crescent under
  // the overhanging cone, its corners just behind and below the eye
  eye: { at: 0.40, t: 2.2 }, mouth: { front: 0.30, corner: 0.04, gape: 1, recess: 0.005 },
};
export const family = {
  family: 'chondrichthyan', pose: 'swim',
  colors: { coat: '#6f7880', sock: '#6f7880', ash: '#eceae4', ashAlt: '#dcdad4', brow: '#5d656c', iris: '#0c0d0f', ink: '#08090a', sclera: '#0c0d0f', nose: '#3a3f44', teeth: '#f2efe6', mouth: '#9a6a6a', tip: '#5d656c', hoof: '#5d656c', belly: '#eceae4' },
  tail: null, tip: null, muzzleFrom: 3, skinControls: SKIN, nape: [0, -0.1, -0.02],
  orbit: { reach: [0.006, 0.007, 0.008], bulk: [0.002, 0.003], thickness: 0.004 }, pupil: 'round', irisAngle: 40, orbitFallback: true,
  browStrip: [[1.6, 1.8], [1.9, 1.7], [2.2, 1.7], [2.5, 1.8], [2.8, 1.9]], foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.4, 2.6], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [], headTiles: [], bodyTiles: [], scale: 1,
  // the family default carries the great white's BODY only: the head anatomy (eye / mouth) rides each species entry, since
  // a species' parameter objects merge one level deep over the family's (a ray must not inherit a shark's mouth bands)
  ...cartilageFish({ ...GREAT_WHITE, eye: undefined, mouth: undefined }),
};
// a species: its own body from the maker (its colours over the family's eye / mouth colours)
const make = (o) => { const p = cartilageFish(o); return { ...p, colors: p.colors }; };
// a species' own pass over the maker's legs (the maker is shared): `set` rewrites a leg's radii / group by name,
// `add` appends legs (and their joints). Absent: the plan is the maker's, byte for byte.
const tune = (p, { set = {}, add = [], joints = {} } = {}) => ({ ...p, joints: { ...p.joints, ...joints },
  legs: [...p.legs.map((l) => (set[l[0]] ? set[l[0]](l.slice()) : l)), ...add] });

export const species = {
  // GREAT WHITE SHARK (Carcharodon carcharias). Thesis: a heavy FUSIFORM torpedo, deepest just behind the
  // pectorals · a CONICAL pointed snout over an underslung mouth, small black eye · a TALL TRIANGULAR first dorsal ·
  // a CRESCENT tail, upper lobe a little longer · long sickle pectorals · five gill slits · sharp countershading,
  // slate-grey back over a white belly · ~4.5 m total length (Wikipedia / Florida Museum: adult females 4.5–5 m,
  // males 3.4–4 m).
  greatWhiteShark: { family: 'chondrichthyan', name: 'a great white shark', scale: 0.9, ...make(GREAT_WHITE) },
  // GREAT HAMMERHEAD (Sphyrna mokarran). Thesis: the CEPHALOFOIL — a flat, wide, near-straight-fronted blade across
  // the head (~25% of body length) with the eyes at its tips · a slimmer torpedo than the white · a very TALL,
  // sickle-curved first dorsal · a long upper caudal lobe with a short lower lobe · grey-bronze back, pale belly ·
  // ~3.5 m total length (Wikipedia / Florida Museum: adults typically 3.5 m, up to 6.1 m).
  // kept v11 (upgrade pass 1006, blind judges both orders vs v7: v11 55% · v11 65%): thicker tapered cephalofoil,
  // eye knobs at the tips big enough to read
  hammerhead: {
    family: 'chondrichthyan', name: 'a great hammerhead', scale: 0.74,
    ...tune(make({ ...GREAT_WHITE, head: 'hammer',
      profile: [[-1.65, 0.15, 0.13], [-1.20, 0.25, 0.30], [-0.50, 0.42, 0.57], [0.20, 0.47, 0.63], [0.85, 0.41, 0.52], [1.20, 0.33, 0.36]].map(([y, w, h]) => [y, w * 0.8, h * 0.8]),
      snout: { len: 0.15, w: 1.2, scale: 1.9, kz: 0.7 }, neck: { ...GREAT_WHITE.neck, rA: [0.29, 0.32], rB: [0.23, 0.23] },
      // the eyes are the cephalofoil tips (hhEye): the skull's own eye shrinks out of sight; the mouth an underslung
      // crescent under the head's centre, behind the blade
      eyeR: 0.002, eye: { at: 0.04, t: 2.2 }, mouth: { front: 0.22, corner: 0.38, gape: 1, recess: 0.005 },
      cephalofoil: { span: 0.66, chord: 0.26, y: 2.0 },
      dorsal: { at: 0.40, base: 0.72, height: 0.86, sweep: 0.66, thick: 0.04 },
      caudal: { upper: { span: 1.15, angle: 34, chord: 0.16, thick: 0.05 }, lower: { ratio: 0.5, angle: 52, chord: 0.14 } },
      pectoral: { ...GREAT_WHITE.pectoral, drop: 0.30, chord: 0.28, tipChord: 0.07, span: 0.7 },
      pattern: { back: '#7a7a72', belly: '#e8e6dc', from: 0.6 } }), {
      // a THICKER blade in profile, and eye knobs at the tips big enough to read
      set: { cephInR: (l) => (l[3] = [0.075, l[3][1]], l[4] = [0.065, l[4][1]], l), cephOutR: (l) => (l[3] = [0.065, l[3][1]], l[4] = [0.04, l[4][1]], l),
        hhEyeR: (l) => (l[3] = 0.07, l[4] = 0.06, l) } }),
  },
  // GIANT OCEANIC MANTA RAY (Mobula birostris). Thesis: a FLAT DIAMOND disc much wider than long, the pectoral
  // WINGS tapering to swept-back pointed tips · two CEPHALIC LOBES projecting forward either side of a wide terminal
  // mouth, eyes on the sides of the head · a thin whip tail about as long as the disc, a small dorsal at its base ·
  // black back, white belly · ~4.5 m disc width (Wikipedia / Marshall et al. 2009: commonly 4.5 m, up to 7 m).
  // kept v3 (upgrade pass 1006: v7 [thicker disc, flat horn paddles, belly underlayer under the wings] split the
  // blind judges vs v3, A v3 60% · B v7 70% — a tie keeps the version with fewer changes)
  mantaRay: {
    family: 'chondrichthyan', name: 'a giant manta ray', scale: 1,
    ...make({ head: 'disc',
      profile: [[-0.75, 0.22, 0.10], [-0.35, 0.45, 0.20], [0.10, 0.52, 0.24], [0.50, 0.45, 0.18]],
      snout: { len: 0.4, w: 1.0, scale: 1.0, kx: 4.2, kz: 0.9, tip: 0.26 }, neck: { from: 0.45, to: 0.62, rA: [0.42, 0.17], rB: [0.40, 0.13] },
      eyeAt: [2.4, 3.0], eyeR: 0.03,
      lobes: { root: [0.36, 0.72, -0.02], length: 0.30 },
      dorsal: { at: -0.70, base: 0.2, height: 0.13, sweep: 0.15, thick: 0.02, bury: 0.03 },
      caudal: null, whip: { length: 1.9, r: 0.04 },
      // the wings: the pectoral disc out to swept-back pointed tips, [x, y, dz, [thickness, half-chord]]
      pectoral: { wing: [[0.25, 0.08, 0, [0.2, 0.62]], [0.95, -0.02, -0.02, [0.08, 0.48]], [1.6, -0.25, -0.05, [0.035, 0.28]], [2.25, -0.58, -0.09, [0.01, 0.05]]] },
      gills: 0, pattern: { back: '#1e2124', belly: '#eeece6', from: 0.45, extra: { mouth: '#5a5050' } } }),
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  greatWhiteShark: { common: 'shark', aliases: ['great white', 'great white shark', 'white shark'], sci: 'Carcharodon carcharias', size: '~4.5 m long', source: 'Florida Museum' },
  hammerhead: { common: 'hammerhead shark', aliases: ['hammerhead', 'great hammerhead'], sci: 'Sphyrna mokarran', size: '~3.5 m long', source: 'Florida Museum' },
  mantaRay: { common: 'manta ray', aliases: ['manta', 'ray'], sci: 'Mobula birostris', size: '~4.5 m disc width', source: 'Marshall et al. 2009' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  stingray: { near: 'mantaRay', aliases: [], note: 'a round flat disc, a long barbed whip tail, no head lobes' },
};
