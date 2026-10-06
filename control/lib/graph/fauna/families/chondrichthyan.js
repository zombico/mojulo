// CHONDRICHTHYAN — sharks and rays, in a SWIM pose (`pose: 'swim'`: suspended above the floor, sized by length).
// The family's tables are a GREAT WHITE: a fusiform trunk (deepest a little ahead of mid-body) tapering to a narrow
// caudal peduncle, a CONICAL snout over an underslung mouth, a tall triangular first dorsal, a CRESCENT (lunate,
// heterocercal) tail with the upper lobe a little longer, long sickle pectorals, small pelvic / second dorsal / anal
// fins, five GILL SLITS (painted), and countershading (grey back, white belly; painted). No legs, ears or nose pad:
// the fins are thin flat closed lofts (`fin()`), the pectorals and pelvics ride the `legs` rows (mirrored by name).
// A ray is the same plan with a flat diamond trunk, wings as one loft across the midline, and a whip tail.
// Tables are authored in metres at great-white size. Worked species: greatWhiteShark, hammerhead, mantaRay.

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the squamate / crocodilian rows): reshaped per species by flat() + muzzleW / muzzleLen
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
const SKIN = {
  browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
  browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
  sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
  cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
  cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
};

/** A FIN: a thin flat closed loft from root to tip on the midline. `pts` are [x, y, z, [half-thickness, half-chord]];
 * the chord lies in the plane holding the loft's axis and +y. */
export const fin = (name, pts, tipCap, opts = {}) => ({ name, kind: 'loft', slots: 'ring12', group: opts.group || 'Coat', mirror: 'plane',
  stations: pts.map(([x, y, z, r]) => ({ at: [x, y, z], r })), caps: { back: opts.back || [pts[0][0], pts[0][1], pts[0][2] - (opts.sink ?? 0.05)], tip: tipCap } });

/** A MIDLINE FIN from size + sweep (the fish-maker vocabulary shared in spirit with teleost.js): a root chord `base`
 * centred at y `at`, rooted `bury` inside the body at z `root`, rising `height` (dir +1 up, −1 down) with its apex
 * `sweep` behind the root centre; `thick` the root half-thickness. Tall triangle with a concave trailing edge. */
export function midlineFin(name, { at, root, base, height, sweep = 0.6 * height, thick = 0.04, dir = 1, group }) {
  const p = (f, c, t) => [0, at - sweep * f, root + dir * height * f, [thick * t, base * c]];
  return fin(name, [p(0, 0.5, 1), p(0.45, 0.28, 0.7), p(0.85, 0.1, 0.45)], [0, at - sweep, root + dir * height], { sink: dir * 0.05, group });
}
/** A CAUDAL LOBE: from the peduncle [y, z] out `span` metres at `angle` degrees above (dir +1) / below (−1) the
 * body axis, root half-chord `chord` tapering to a point (a lunate sickle). */
export function caudalLobe(name, [py, pz], { span, angle, chord, thick = 0.05, dir = 1 }) {
  const a = (angle * Math.PI) / 180, P = (f, c, t) => [0, py - span * f * Math.cos(a), pz + dir * (0.04 + span * f * Math.sin(a)), [thick * t, chord * c]];
  return fin(name, [P(0, 1, 1), P(0.3, 0.8, 0.7), P(0.62, 0.45, 0.45)], P(0.8, 0, 0).slice(0, 3).map((v, i) => (i === 0 ? 0 : v + (i === 1 ? -span * 0.2 * Math.cos(a) : dir * span * 0.2 * Math.sin(a)))),
    { back: [0, py + 0.07, pz - dir * 0.04] });
}

/**
 * THE CARTILAGINOUS-FISH MAKER (species-free): every number of a shark or ray from a handful of size / shape knobs, in
 * metres at the authored size (the species' `scale` then fits its published length). Returns the parameters build.js
 * reads (joints, torso, legs = paired fins, extraSegments = midline fins and tail, head rows, markings).
 *   C          centre-line height of the swim pose
 *   profile    trunk stations [y, half-width, half-height], tail end first (a torpedo, or a flat disc for a ray)
 *   head       'conical' (a pointed snout) | 'hammer' (+ `cephalofoil: { span, chord }`) | 'disc' (a ray's flat head
 *              with `lobes`: cephalic lobes { length })
 *   snout      { len, w, scale } → muzzleLen, muzzleW, headScale; `neck` { from, to, rA, rB } the gill region
 *   dorsal     midlineFin knobs ({ at, base, height, sweep }); `dorsal2`, `anal` the same (null to omit)
 *   caudal     { upper: { span, angle, chord }, lower: { …, or a `ratio` of the upper } } (null: a ray's `whip` instead)
 *   whip       { length, r } a thin whip tail
 *   pectoral   { root: [x, y, dz], span, sweep, drop, chord, tipChord } (a shark's sickle) or `wing`: [[x, y, dz, [thick, half-chord]], …]
 *              rows out to the tip (a ray: huge pectorals as a disc); `pelvic` the small sickle form
 *   gills      count of painted slits (0 for none: a ray's are underneath)
 *   pattern    { back, belly, from } countershading colours (+ `extra` colours)
 */
export function cartilageFish(o) {
  const C = o.C ?? 1.0, prof = o.profile, top = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [a, , ha] = prof[i - 1], [b, , hb] = prof[i]; return ha + (hb - ha) * (y - a) / (b - a); } return prof.at(-1)[2]; };
  const joints = { neckBase: [0, o.neck.from, C], neckTop: [0, o.neck.to, C - 0.02] }, legs = [], extra = [];
  const pec = o.pectoral;
  if (pec.wing) { let prev = 'wing0'; joints.wing0 = [pec.wing[0][0], pec.wing[0][1], C + pec.wing[0][2]];
    pec.wing.slice(1).forEach(([x, y, dz, r], i) => { const j = `wing${i + 1}`; joints[j] = [x, y, C + dz];
      legs.push([`wing${i}R`, prev, j, pec.wing[i][3], r, 'Coat', [i ? 0.05 : 0.3, i === pec.wing.length - 2 ? 0.3 : 0.05]]); prev = j; }); }
  else { const [x, y, dz] = pec.root; joints.pecRoot = [x, y, C + dz]; joints.pecTip = [x + pec.span, y - pec.sweep, C + dz - pec.drop];
    legs.push(['pectoralR', 'pecRoot', 'pecTip', [0.05, pec.chord], [0.025, pec.tipChord], 'Coat', [0.2, 0.2]]); }
  if (o.pelvic) { const p = o.pelvic, [x, y, dz] = p.root; joints.pelRoot = [x, y, C + dz]; joints.pelTip = [x + p.span, y - p.sweep, C + dz - p.drop];
    legs.push(['pelvicR', 'pelRoot', 'pelTip', [0.03, p.chord], [0.015, p.chord / 3], 'Coat', [0.2, 0.2]]); }
  if (o.head === 'hammer') { const { span, chord, y, dz = -0.02 } = o.cephalofoil;   // two flat blades out of the snout, the eyes at the tips
    // a level axis has no ring side (station-loft ringPoints): each blade droops a little in z
    Object.assign(joints, { cephRoot: [0.05, y, C + dz], cephMid: [span * 0.55, y - 0.04, C + dz - 0.025], cephTip: [span, y - 0.11, C + dz - 0.05], eyeTip: [span + 0.06, y - 0.13, C + dz - 0.06] });
    legs.push(['cephInR', 'cephRoot', 'cephMid', [0.06, chord], [0.05, chord * 0.76], 'Coat', [0.3, 0.1]], ['cephOutR', 'cephMid', 'cephTip', [0.05, chord * 0.76], [0.035, chord * 0.4], 'Coat', [0.1, 0.1]],
      ['hhEyeR', 'cephTip', 'eyeTip', 0.03, 0.025, 'Gill', [0.1, 0.2]]); }
  if (o.lobes) { const { root: [x, y, dz], length } = o.lobes; joints.lobeRoot = [x, y, C + dz]; joints.lobeTip = [x + 0.02, y + length, C + dz - 0.04];
    legs.push(['lobeR', 'lobeRoot', 'lobeTip', [0.07, 0.025], [0.045, 0.015], 'Coat', [0.2, 0.2]]); }
  for (const [nm, f, dir] of [['dorsal', o.dorsal, 1], ['dorsal2', o.dorsal2, 1], ['anal', o.anal, -1]]) if (f) extra.push(midlineFin(nm, { root: C + dir * (top(f.at) - (f.bury ?? 0.1)), dir, ...f }));
  const ped = [prof[0][0] + 0.03, C];
  if (o.caudal) { const up = o.caudal.upper, lo = { ...up, ...o.caudal.lower, span: up.span * (o.caudal.lower.ratio ?? 1) };
    extra.push(caudalLobe('caudalUp', ped, { ...up, dir: 1 }), caudalLobe('caudalLow', ped, { ...lo, dir: -1, thick: (lo.thick ?? 0.05) * 0.9 })); }
  if (o.whip) { const y0 = prof[0][0], L = o.whip.length, r = o.whip.r ?? 0.04;
    extra.push(fin('tailWhip', [[0, y0, C, [r, r]], [0, y0 - L * 0.4, C, [r / 2, r / 2]], [0, y0 - L * 0.9, C, [r / 5, r / 5]]], [0, y0 - L, C], { back: [0, y0 + 0.05, C] })); }
  const pat = o.pattern || {}, marks = [{ on: 'torso', kind: 'belly', group: 'Belly', from: pat.from ?? 0.6 }, { on: 'neck', kind: 'belly', group: 'Belly', from: (pat.from ?? 0.6) + 0.02 }];
  if (o.gills) marks.push({ on: 'neck', kind: 'stripes', group: 'Gill', color: '#2c3034', count: o.gills, width: 0.3, run: [0.0, 0.75], t: [0.35, 0.62] });
  else marks.push({ on: 'neck', kind: 'band', group: 'Gill', color: '#2c3034', run: [0, 0], t: [0, 0] });   // the eye-tip colour group, no slits
  const sn = o.snout, back = pat.back || '#6f7880', belly = pat.belly || '#eceae4';
  return {
    joints, legs, extraSegments: extra, levelLegs: false,
    torso: prof.map(([y, w, h]) => ({ at: [0, y, C], r: [w, h] })),
    torsoCaps: { back: [0, prof[0][0] - 0.1, C], tip: [0, prof.at(-1)[0] + 0.1, C] },
    neckRA: o.neck.rA, neckRB: o.neck.rB, neckRMid: o.neck.rA.map((v, i) => (v + o.neck.rB[i]) / 2 + 0.01),
    craniumRows: flat(SKULL, sn.kx ?? 1, sn.kz ?? 0.95), jawRows: flatJaw(JAW, sn.kx ?? 1, sn.kz ?? 0.95),
    craniumCaps: { back: [0, -0.18, 0.0], tip: [0, sn.tip ?? 0.26, -0.02] }, jawCaps: { back: [0, -0.1, -0.05], tip: [0, 0.215, -0.045] },
    headScale: sn.scale, muzzleLen: sn.len, muzzleW: sn.w, eyeR: o.eyeR ?? 0.03, eyeAt: o.eyeAt ?? [2.6, 2.2],
    colors: { coat: back, sock: back, brow: back, tip: back, hoof: back, ash: belly, ashAlt: belly, belly, ...(pat.extra || {}) },
    headPalette: { Cheek: back, ...(o.head === 'disc' ? { Jowl: back } : {}) },
    markDensity: { torso: 2, neck: o.gills ? 10 : 2 }, markings: marks,
  };
}

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
  ...cartilageFish(GREAT_WHITE),
};
// a species: its own body from the maker (its colours over the family's eye / mouth colours)
const make = (o) => { const p = cartilageFish(o); return { ...p, colors: p.colors }; };

export const species = {
  // GREAT WHITE SHARK (Carcharodon carcharias). Thesis: a heavy FUSIFORM torpedo, deepest just behind the
  // pectorals · a CONICAL pointed snout over an underslung mouth, small black eye · a TALL TRIANGULAR first dorsal ·
  // a CRESCENT tail, upper lobe a little longer · long sickle pectorals · five gill slits · sharp countershading,
  // slate-grey back over a white belly · ~4.5 m total length (Wikipedia / Florida Museum: adult females 4.5–5 m,
  // males 3.4–4 m).
  greatWhiteShark: { family: 'chondrichthyan', name: 'a great white shark', scale: 0.9 },
  // GREAT HAMMERHEAD (Sphyrna mokarran). Thesis: the CEPHALOFOIL — a flat, wide, near-straight-fronted blade across
  // the head (~25% of body length) with the eyes at its tips · a slimmer torpedo than the white · a very TALL,
  // sickle-curved first dorsal · a long upper caudal lobe with a short lower lobe · grey-bronze back, pale belly ·
  // ~3.5 m total length (Wikipedia / Florida Museum: adults typically 3.5 m, up to 6.1 m).
  hammerhead: {
    family: 'chondrichthyan', name: 'a great hammerhead', scale: 0.74,
    ...make({ ...GREAT_WHITE, head: 'hammer',
      profile: [[-1.65, 0.15, 0.13], [-1.20, 0.25, 0.30], [-0.50, 0.42, 0.57], [0.20, 0.47, 0.63], [0.85, 0.41, 0.52], [1.20, 0.33, 0.36]].map(([y, w, h]) => [y, w * 0.8, h * 0.8]),
      snout: { len: 0.15, w: 1.2, scale: 1.9, kz: 0.7 }, neck: { ...GREAT_WHITE.neck, rA: [0.29, 0.32], rB: [0.23, 0.23] }, eyeR: 0.012,
      cephalofoil: { span: 0.66, chord: 0.26, y: 2.0 },
      dorsal: { at: 0.40, base: 0.72, height: 0.86, sweep: 0.66, thick: 0.04 },
      caudal: { upper: { span: 1.15, angle: 34, chord: 0.16, thick: 0.05 }, lower: { ratio: 0.5, angle: 52, chord: 0.14 } },
      pectoral: { ...GREAT_WHITE.pectoral, drop: 0.30, chord: 0.28, tipChord: 0.07, span: 0.7 },
      pattern: { back: '#7a7a72', belly: '#e8e6dc', from: 0.6 } }),
  },
  // GIANT OCEANIC MANTA RAY (Mobula birostris). Thesis: a FLAT DIAMOND disc much wider than long, the pectoral
  // WINGS tapering to swept-back pointed tips · two CEPHALIC LOBES projecting forward either side of a wide terminal
  // mouth, eyes on the sides of the head · a thin whip tail about as long as the disc, a small dorsal at its base ·
  // black back, white belly · ~4.5 m disc width (Wikipedia / Marshall et al. 2009: commonly 4.5 m, up to 7 m).
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
