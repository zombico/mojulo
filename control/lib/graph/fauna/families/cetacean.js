// CETACEAN — whales and dolphins, in a SWIM pose (`pose: 'swim'`: suspended above the floor, sized by total length). A
// smooth FUSIFORM trunk with no neck to speak of, a TAIL STOCK flattened side to side (deep and narrow) ending in two
// HORIZONTAL FLUKES (flat, swept back to points: the stroke is up and down, not side to side), two PECTORAL FLIPPERS
// low behind the head (thin flat paddles), a DORSAL FIN raked back on the mid-back (falcate, or a ridge, or none), a
// head with a domed MELON over a beak or a blunt front, the eye small and low near the mouth corner, no ears, no nose
// pad (the blowhole is on top), a pale belly. Tables are authored in metres at bottlenose-dolphin size. Worked species:
// the common bottlenose dolphin. See ../build.js for what every field does.

import { lobe } from '../makers/fish.js';

const Z = 1.0;   // the body axis height in the swim pose (suspended)
const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));
// the head rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] (side slots [x, z]); a domed melon (st1–st3)
// falling steeply to a short narrow BEAK (st4–st6), the mouth line long and straight
const HEAD = [
  ['st0', -0.15, 0.10, [0.07, 0.095], [0.12, 0.05], [0.13, -0.01], [0.115, -0.06], [0.08, -0.095], -0.105],
  ['st1', -0.08, 0.125, [0.07, 0.12], [0.12, 0.065], [0.13, -0.005], [0.11, -0.055], [0.075, -0.09], -0.10],
  ['st2', 0.0, 0.12, [0.06, 0.115], [0.105, 0.06], [0.115, 0.0], [0.095, -0.05], [0.065, -0.085], -0.095],
  ['st3', 0.06, 0.085, [0.045, 0.08], [0.08, 0.04], [0.085, -0.005], [0.07, -0.045], [0.05, -0.075], -0.085],
  ['st4', 0.10, 0.03, [0.03, 0.028], [0.045, 0.012], [0.05, -0.015], [0.045, -0.04], [0.035, -0.062], -0.07],
  ['st5', 0.16, 0.018, [0.022, 0.016], [0.034, 0.005], [0.038, -0.016], [0.034, -0.036], [0.026, -0.052], -0.058],
  ['st6', 0.22, 0.01, [0.014, 0.008], [0.022, -0.002], [0.025, -0.017], [0.022, -0.032], [0.017, -0.044], -0.048],
];
const JAW = [
  ['st0', -0.08, { gum: -0.095, gumR: [0.075, -0.095], jaw: [0.08, -0.115], bottom: -0.125 }],
  ['st1', 0.02, { gum: -0.088, gumR: [0.06, -0.088], jaw: [0.065, -0.108], bottom: -0.116 }],
  ['st2', 0.10, { gum: -0.068, gumR: [0.038, -0.068], jaw: [0.04, -0.085], bottom: -0.092 }],
  ['st3', 0.17, { gum: -0.054, gumR: [0.026, -0.054], jaw: [0.028, -0.068], bottom: -0.074 }],
  ['st4', 0.225, { gum: -0.047, gumR: [0.017, -0.047], jaw: [0.018, -0.058], bottom: -0.062 }],
];

/** The fin set every cetacean wears, from a few numbers (metres at the species' authored size, before `scale`):
 *   stock    the tail stock [[y, [halfWidth, halfDepth]], …] from inside the trunk's rear to the fluke root
 *   fluke    { y (root), span (half, tip out from the midline), sweep (the tip's run back), chord (root), at = Z }
 *   dorsal   [[y, z, halfWidth], …] a raked fin from its base front up to its tip (a lobe), or null (no fin)
 * Returns the extra segments and the joints the flukes hang on. */
export function cetaceanFins({ stock, fluke, dorsal }, group = 'Coat') {
  const z = fluke.at ?? Z, { y, span, sweep, chord } = fluke;
  // the tips droop a hair below the root: a ring frame needs its axis off the level plane (and real flukes sag at rest)
  const joints = { flukeRoot: [0.02, y, z], flukeMid: [span * 0.55, y - sweep * 0.45, z - span * 0.03], flukeTip: [span, y - sweep, z - span * 0.06] };
  const last = stock[stock.length - 1][0];
  const segs = [
    { name: 'tailStock', kind: 'loft', slots: 'ring12', group, mirror: 'plane', up: true, stations: stock.map(([sy, r]) => ({ at: [0, sy, z], r })),
      caps: { back: [0, stock[0][0] + 0.03, z], tip: [0, last - 0.02, z] } },
    // each fluke a flat blade, thin along +z: broad at the root, narrowing to the swept-back point
    { name: 'flukeR', kind: 'segment', from: 'flukeRoot', to: 'flukeMid', rA: [chord, chord * 0.12], rB: [chord * 0.7, chord * 0.09], slots: 'ring12', over: [0.3, 0.2], group, mirror: 'name', up: [0, 0, 1] },
    { name: 'flukeTipR', kind: 'segment', from: 'flukeMid', to: 'flukeTip', rA: [chord * 0.7, chord * 0.09], rB: [chord * 0.12, chord * 0.04], slots: 'ring12', over: [0.2, 0.3], group, mirror: 'name', up: [0, 0, 1] },
  ];
  if (dorsal) segs.push(lobe('dorsalFin', dorsal, { t: 0.012 * (dorsal[0][2] / 0.12), group }));
  return { joints, segs };
}

const fins = cetaceanFins({
  stock: [[-0.5, [0.15, 0.2]], [-0.72, [0.1, 0.16]], [-0.92, [0.06, 0.1]], [-1.06, [0.035, 0.055]], [-1.12, [0.025, 0.035]]],
  fluke: { y: -1.1, span: 0.31, sweep: 0.2, chord: 0.08 },
  dorsal: [[0.08, Z + 0.22, 0.13], [0.0, Z + 0.3, 0.1], [-0.08, Z + 0.37, 0.065], [-0.15, Z + 0.42, 0.03], [-0.19, Z + 0.44, 0.01]],
});

export const family = {
  family: 'cetacean', pose: 'swim',
  colors: {
    coat: '#6a747c', sock: '#5f6971', ash: '#c9cdd0', ashAlt: '#b9bec2', brow: '#5f6971', iris: '#2a2420',
    ink: '#0d0e10', sclera: '#2a2c30', nose: '#5f6971', teeth: '#e8e4da', mouth: '#7a5458', tip: '#5f6971',
    hoof: '#5f6971', belly: '#e3e6e7', snout: '#6a747c',
  },
  joints: {
    neckBase: [0, 0.7, Z + 0.01], neckTop: [0, 0.86, Z + 0.035],
    // the pectoral flippers: low on the flank behind the head, swept back and down, lying nearly flat
    foreRoot: [0.15, 0.55, Z - 0.13], foreMid: [0.27, 0.42, Z - 0.2], foreTip: [0.36, 0.28, Z - 0.25],
    ...fins.joints,
  },
  torso: [
    { at: [0, -0.62, Z], r: [0.12, 0.17] },
    { at: [0, -0.35, Z], r: [0.19, 0.24] },
    { at: [0, 0.0, Z], r: [0.235, 0.27] },
    { at: [0, 0.35, Z], r: [0.23, 0.255] },
    { at: [0, 0.62, Z], r: [0.19, 0.21] },
    { at: [0, 0.8, Z], r: [0.15, 0.165] },
  ],
  torsoCaps: { back: [0, -0.7, Z], tip: [0, 0.9, Z] },
  neckRA: [0.15, 0.165], neckRB: [0.13, 0.14], neckRMid: [0.14, 0.155],
  tail: null, tip: null,
  legs: [
    ['foreFlipR', 'foreRoot', 'foreMid', [0.075, 0.02], [0.06, 0.015], 'Coat', [0.3, 0.2]],
    ['foreTipR', 'foreMid', 'foreTip', [0.06, 0.015], [0.015, 0.006], 'Coat', [0.2, 0.4]],
  ],
  levelLegs: true,
  craniumRows: HEAD, craniumCaps: { back: [0, -0.19, 0.0], tip: [0, 0.235, -0.02] }, muzzleFrom: 3,
  jawRows: JAW, jawCaps: { back: [0, -0.12, -0.11], tip: [0, 0.235, -0.052] },
  craniumBandGroups: { 'st4-st5': ['Snout', 'Snout', 'Snout', 'Cheek', 'Jowl', 'Palate'], 'st5-st6': ['Snout', 'Snout', 'Snout', 'Cheek', 'Jowl', 'Palate'] },
  muzzleW: 1.0, muzzleLen: 1.35,
  skinControls: {
    browRaise: { amp: 0.008, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    cornerRetract: { amp: 0.012, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.32, nape: [0, -0.16, 0.0],
  // the eye small and low, just behind and above the mouth corner
  eyeAt: [2.8, 3.4], eyeR: 0.011, orbit: { reach: [0.003, 0.004, 0.005], bulk: [0.001, 0.0015], thickness: 0.002 }, pupil: 'round', irisAngle: 40, orbitFallback: true,
  browStrip: [[2.4, 2.9], [2.7, 2.8], [3.0, 2.8], [3.3, 2.9], [3.6, 3.0]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [1.2, 0.3], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headTiles: [], bodyTiles: [],
  markDensity: { torso: 2 },
  markings: [{ on: 'torso', kind: 'belly', group: 'Belly', from: 0.56 }],
  scale: 1,
};
family.extraSegments = fins.segs;

// species helpers: the family trunk re-radiused (kx across, kz deep), a head with the melon pressed flat under a line
// falling from the crown to the snout (a baleen whale's flat rostrum), and fins built per species
const trunk = (kx, kz, rows = family.torso) => rows.map((st) => ({ ...st, r: [st.r[0] * kx, st.r[1] * kz] }));
const flatHead = (rows, z0, z1) => rows.map(([id, y, top, crown, ...rest]) => { const t = (y + 0.15) / 0.37, cap = z0 + (z1 - z0) * Math.max(0, Math.min(1, t));
  return [id, y, Math.min(top, cap), [crown[0], Math.min(crown[1], cap - 0.004)], ...rest]; });
const orcaFins = cetaceanFins({
  stock: [[-0.5, [0.19, 0.25]], [-0.72, [0.13, 0.2]], [-0.92, [0.075, 0.12]], [-1.06, [0.042, 0.065]], [-1.12, [0.03, 0.04]]],
  fluke: { y: -1.1, span: 0.36, sweep: 0.16, chord: 0.1 },
  // the bull's TALL, near-upright triangular dorsal
  dorsal: [[0.12, Z + 0.25, 0.17], [0.06, Z + 0.4, 0.12], [0.02, Z + 0.55, 0.075], [-0.01, Z + 0.68, 0.035], [-0.02, Z + 0.74, 0.01]],
});
const humpFins = cetaceanFins({
  stock: [[-0.5, [0.16, 0.22]], [-0.72, [0.11, 0.18]], [-0.92, [0.065, 0.12]], [-1.06, [0.038, 0.06]], [-1.12, [0.028, 0.038]]],
  fluke: { y: -1.1, span: 0.4, sweep: 0.15, chord: 0.11 },
  // a small stubby dorsal hump far back
  dorsal: [[-0.3, Z + 0.15, 0.07], [-0.36, Z + 0.19, 0.045], [-0.41, Z + 0.215, 0.02]],
});
const ridgeFins = (kz = 1) => cetaceanFins({
  stock: [[-0.5, [0.16, 0.21 * kz]], [-0.72, [0.11, 0.16 * kz]], [-0.92, [0.065, 0.1 * kz]], [-1.06, [0.038, 0.055]], [-1.12, [0.026, 0.036]]],
  fluke: { y: -1.1, span: 0.33, sweep: 0.13, chord: 0.09 },
  // no dorsal fin: a low ridge along the back
  dorsal: [[0.05, Z + 0.24, 0.12], [-0.1, Z + 0.255, 0.1], [-0.25, Z + 0.235, 0.08], [-0.38, Z + 0.2, 0.05]],
});

export const species = {
  // COMMON BOTTLENOSE DOLPHIN (Tursiops truncatus). Thesis: a smooth grey torpedo · a domed MELON over a short stubby
  // BEAK, the mouth line curving up into a "smile" · a tall FALCATE dorsal fin mid-back, raked back · pointed flippers ·
  // broad swept-back flukes notched in the middle · dark grey back over a pale grey-white belly · ~2.6 m long
  // (NOAA Fisheries: adults 2–4 m; Wells & Scott 2009, Encyclopedia of Marine Mammals).
  bottlenoseDolphin: { family: 'cetacean', name: 'a bottlenose dolphin', scale: 0.94 },
  // ORCA / KILLER WHALE, adult male (Orcinus orca). Thesis: a big STOCKY torpedo · a blunt rounded head, no beak · the
  // bull's TALL upright triangular dorsal (to ~1.8 m) · big rounded PADDLE flippers · THE PATTERN: jet black, a white
  // oval EYE PATCH behind and above the eye, a white chin and belly running up into a white lobe on the flank behind
  // the dorsal, a grey SADDLE behind the fin · ~7 m long (NOAA Fisheries: males 6–8 m; Ford 2009, Encyclopedia of
  // Marine Mammals).
  orca: {
    family: 'cetacean', name: 'an orca', scale: 2.45,
    colors: { coat: '#141517', sock: '#141517', ash: '#141517', ashAlt: '#1c1d20', brow: '#141517', snout: '#141517', belly: '#f1f1ec', tip: '#141517', hoof: '#141517', mouth: '#5a3c40' },
    torso: trunk(1.22, 1.15), torsoCaps: { back: [0, -0.7, Z], tip: [0, 0.92, Z] },
    neckRA: [0.18, 0.19], neckRB: [0.16, 0.165], neckRMid: [0.17, 0.18],
    joints: { foreRoot: [0.18, 0.55, Z - 0.15], foreMid: [0.31, 0.45, Z - 0.24], foreTip: [0.4, 0.34, Z - 0.29], ...orcaFins.joints },
    legs: [
      ['foreFlipR', 'foreRoot', 'foreMid', [0.1, 0.022], [0.11, 0.018], 'Coat', [0.3, 0.2]],
      ['foreTipR', 'foreMid', 'foreTip', [0.11, 0.018], [0.05, 0.01], 'Coat', [0.2, 0.5]],
    ],
    extraSegments: orcaFins.segs,
    headScale: 1.5, muzzleW: 1.25, muzzleLen: 0.42,
    craniumRows: flatHead(HEAD, 0.12, 0.07),
    // the eye patch on the brow band behind the eye, the white chin and throat
    craniumBandGroups: { 'st0-st1': ['Skull', 'Skull', 'Patch', 'Skull', 'Jowl', 'Palate'], 'st1-st2': ['Skull', 'Skull', 'Patch', 'Skull', 'Jowl', 'Palate'] },
    headPalette: { Patch: '#f1f1ec', Jowl: '#f1f1ec', Palate: '#f1f1ec', Jaw: '#f1f1ec', Cheek: '#141517', Snout: '#141517' },
    markings: [
      { on: 'torso', kind: 'belly', group: 'Belly', from: 0.62 },
      { on: 'torso', kind: 'band', run: [0.06, 0.32], t: [0.42, 1], group: 'Belly' },
      { on: 'torso', kind: 'band', run: [0.3, 0.46], t: [0, 0.16], group: 'Saddle', color: '#8c9296' },
    ],
  },
  // HUMPBACK WHALE (Megaptera novaeangliae). Thesis: a robust baleen whale · a broad FLAT-topped head about a third of
  // the body, a long lower jaw · ONE signature: the very LONG white-edged PECTORAL FLIPPERS, nearly a third of the body
  // length · a small stubby dorsal hump far back · broad flukes · black above, white throat and belly · ~14 m long
  // (NOAA Fisheries: adults 12–16 m, flippers up to ~4.6 m; Clapham 2009, Encyclopedia of Marine Mammals).
  humpbackWhale: {
    family: 'cetacean', name: 'a humpback whale', scale: 4.7,
    colors: { coat: '#24272b', sock: '#24272b', ash: '#24272b', ashAlt: '#2c3034', brow: '#24272b', snout: '#24272b', belly: '#e8e8e3', tip: '#24272b', hoof: '#24272b', mouth: '#4a3a3a' },
    torso: trunk(1.2, 1.1, [
      { at: [0, -0.62, Z], r: [0.12, 0.17] }, { at: [0, -0.35, Z], r: [0.18, 0.23] }, { at: [0, 0.0, Z], r: [0.23, 0.27] },
      { at: [0, 0.3, Z], r: [0.24, 0.27] }, { at: [0, 0.55, Z], r: [0.22, 0.25] }, { at: [0, 0.72, Z], r: [0.2, 0.22] }]),
    torsoCaps: { back: [0, -0.7, Z], tip: [0, 0.8, Z] },
    neckRA: [0.22, 0.23], neckRB: [0.2, 0.2], neckRMid: [0.21, 0.22],
    joints: { neckBase: [0, 0.64, Z], neckTop: [0, 0.76, Z],
      // the LONG flippers, root low behind the head, sweeping back and down
      foreRoot: [0.22, 0.42, Z - 0.17], foreMid: [0.48, 0.2, Z - 0.3], foreTip: [0.72, -0.02, Z - 0.4], ...humpFins.joints },
    legs: [
      ['foreFlipR', 'foreRoot', 'foreMid', [0.1, 0.022], [0.095, 0.018], 'Fin', [0.3, 0.2]],
      ['foreTipR', 'foreMid', 'foreTip', [0.095, 0.018], [0.035, 0.008], 'Fin', [0.2, 0.4]],
    ],
    extraSegments: humpFins.segs,
    headScale: 1.9, muzzleW: 1.3, muzzleLen: 1.3,
    craniumRows: flatHead(HEAD, 0.075, 0.025),
    headPalette: { Jowl: '#e8e8e3', Palate: '#e8e8e3', Jaw: '#e8e8e3', Cheek: '#24272b', Snout: '#24272b', Fin: '#d9dad5' },
    palette: { Fin: '#d9dad5' },
    markings: [{ on: 'torso', kind: 'belly', group: 'Belly', from: 0.64 }],
  },
  // BELUGA (Delphinapterus leucas). Thesis: an ALL-WHITE small whale · a big round bulging MELON over a very short beak ·
  // a visible flexible NECK (a crease behind the head) · NO dorsal fin, a low ridge instead · short broad paddle
  // flippers · ~4 m long (NOAA Fisheries: adults 3.5–5.5 m; O'Corry-Crowe 2009, Encyclopedia of Marine Mammals).
  belugaWhale: (() => { const F = ridgeFins(); return {
    family: 'cetacean', name: 'a beluga whale', scale: 1.45,
    colors: { coat: '#e9e9e2', sock: '#e9e9e2', ash: '#e9e9e2', ashAlt: '#dededa', brow: '#d8d8d0', snout: '#e9e9e2', belly: '#f2f2ec', tip: '#d8d8d0', hoof: '#d8d8d0', mouth: '#9a7a78' },
    torso: trunk(1.15, 1.08), joints: { neckBase: [0, 0.68, Z + 0.01], neckTop: [0, 0.88, Z + 0.04],
      foreRoot: [0.16, 0.55, Z - 0.14], foreMid: [0.27, 0.46, Z - 0.21], foreTip: [0.34, 0.37, Z - 0.25], ...F.joints },
    neckRA: [0.17, 0.18], neckRB: [0.15, 0.16], neckRMid: [0.14, 0.15],
    legs: [
      ['foreFlipR', 'foreRoot', 'foreMid', [0.08, 0.02], [0.08, 0.016], 'Coat', [0.3, 0.2]],
      ['foreTipR', 'foreMid', 'foreTip', [0.08, 0.016], [0.03, 0.008], 'Coat', [0.2, 0.5]],
    ],
    extraSegments: F.segs,
    // the big round melon: the crown rows raised
    craniumRows: HEAD.map(([id, y, top, crown, ...rest]) => { const k = { st0: 0.02, st1: 0.04, st2: 0.045, st3: 0.03 }[id] || 0; return [id, y, top + k, [crown[0] * 1.08, crown[1] + k], ...rest]; }),
    headScale: 1.4, muzzleW: 1.1, muzzleLen: 0.6,
    markings: [],
  }; })(),
  // NARWHAL, adult male (Monodon monoceros). Thesis: a stout mottled whale · a small blunt rounded head, no beak · ONE
  // signature: the long straight TUSK (a spiralled left tooth) reaching forward from the upper lip, ~2 m · NO dorsal
  // fin, a low ridge · short upturned flippers · grey mottled with dark spots on a paler belly · ~4.5 m long without
  // the tusk (NOAA Fisheries: 4–5.5 m, tusk to 3 m; Heide-Jørgensen 2009, Encyclopedia of Marine Mammals).
  narwhal: (() => { const F = ridgeFins(); return {
    family: 'cetacean', name: 'a narwhal', scale: 1.62,
    colors: { coat: '#6e7378', sock: '#6e7378', ash: '#9a9ea2', ashAlt: '#8e9296', brow: '#4a4e52', snout: '#6e7378', belly: '#d6d8d6', tip: '#4a4e52', hoof: '#4a4e52', horn: '#e8e0c8' },
    torso: trunk(1.15, 1.1), joints: { foreRoot: [0.16, 0.55, Z - 0.14], foreMid: [0.26, 0.46, Z - 0.19], foreTip: [0.33, 0.38, Z - 0.2], ...F.joints },
    legs: [
      ['foreFlipR', 'foreRoot', 'foreMid', [0.07, 0.02], [0.06, 0.015], 'Coat', [0.3, 0.2]],
      ['foreTipR', 'foreMid', 'foreTip', [0.06, 0.015], [0.02, 0.008], 'Coat', [0.2, 0.5]],
    ],
    extraSegments: F.segs,
    headScale: 1.3, muzzleW: 1.2, muzzleLen: 0.42,
    craniumRows: flatHead(HEAD, 0.115, 0.06),
    // the TUSK: a long straight ivory cone forward out of the upper lip, a little to the left
    headOrnaments: [{ kind: 'sweep', name: 'tusk', at: [5.6, 0.0001], side: 'R', space: 'head', spine: [[-0.025, 0.12, -0.05], [-0.03, 0.45, -0.04], [-0.035, 0.8, -0.03], [-0.04, 1.08, -0.02]], radii: [0.022, 0.017, 0.01, 0.003], m: 8, group: 'Horn' }],
    markDensity: { torso: 3 },
    markings: [
      { on: 'torso', kind: 'belly', group: 'Belly', from: 0.62 },
      { on: 'torso', kind: 'spots', count: 16, size: [0.03, 0.05], seed: 9, group: 'Spot', color: '#4c5155' },
    ],
  }; })(),
};

export const about = {
  orca: { common: 'orca', aliases: ['killer whale'], sci: 'Orcinus orca', size: '~7 m long (adult male)', source: 'NOAA Fisheries; Ford 2009, Encyclopedia of Marine Mammals' },
  humpbackWhale: { common: 'humpback whale', aliases: ['whale', 'humpback'], sci: 'Megaptera novaeangliae', size: '~14 m long, flippers to ~4.6 m', source: 'NOAA Fisheries; Clapham 2009, Encyclopedia of Marine Mammals' },
  belugaWhale: { common: 'beluga', aliases: ['beluga whale', 'white whale'], sci: 'Delphinapterus leucas', size: '~4 m long', source: "NOAA Fisheries; O'Corry-Crowe 2009, Encyclopedia of Marine Mammals" },
  narwhal: { common: 'narwhal', aliases: ['narwhale'], sci: 'Monodon monoceros', size: '~4.5 m long without the tusk; tusk ~2 m', source: 'NOAA Fisheries; Heide-Jørgensen 2009, Encyclopedia of Marine Mammals' },
  bottlenoseDolphin: { common: 'dolphin', aliases: ['bottlenose dolphin', 'common bottlenose dolphin', 'porpoise'], sci: 'Tursiops truncatus', size: '~2.6 m long', source: 'NOAA Fisheries; Wells & Scott 2009, Encyclopedia of Marine Mammals' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in.
export const wanted = {};
