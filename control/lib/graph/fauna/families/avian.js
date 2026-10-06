// AVIAN — a biped bird: a level trunk carrying the wings (wing.js, worn at `wingRoot`, folded by default), a neck,
// a small skull whose muzzle rows are the BILL, scaly tarsi standing on three forward toes and a hallux with talons,
// a short tail. No ears. Worked species: the griffon vulture. See ../build.js for what every field does; `wings`
// is { wing: <wing data>, at: <root joint>, fold: 0 spread … 1 folded, palette }.

const lerp = (a, b, t) => a + (b - a) * t;
const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** A FEATHERED wing as data for wing.js (vanes): tertials on the humerus, secondaries on the ulna, primaries on the
 * hand (the outer ones emarginated into slots), greater and lesser covert rows over them, seeded tones. The
 * defaults are a broad soaring wing of ~2.5 m span (griffon); a second bird passes its own numbers. */
export function featherWing({ arm = [0.2, 0.29, 0.2], tertials = 3, secondaries = 16, primaries = 10, secLen = 0.44, primLen = 0.5, primReach = 0.16,
  slotFrom = 0.35, slotBy = 0.55, width = 0.085 } = {}) {
  const rays = []; const add1 = (o) => rays.push(o);
  for (let k = 0; k < tertials; k++) add1({ kind: 'tertial', bone: 0, at: 0.55 + 0.2 * k, angle: 100, foldAngle: 5, len: 0.3 + 0.03 * k, width: 0.1, layer: 0.012 - 0.002 * k, group: 'Flight' });
  const S = secondaries - 1;
  for (let k = 0; k < secondaries; k++) add1({ kind: 'secondary', bone: 1, at: 0.03 + 0.97 * k / S, angle: 98 - 3 * (k / S), foldAngle: 176, len: secLen + 0.03 * Math.sin(Math.PI * k / S), width, layer: 0.004 * (S - k) / S, group: 'Flight' });
  for (let k = 0; k < primaries; k++) { const t = k / (primaries - 1); add1({ kind: 'primary', bone: 2, at: 0.1 + 0.9 * t, angle: lerp(95, 8, t ** 0.9), foldAngle: 4, len: primLen + primReach * Math.sin(Math.PI * Math.min(1, t * 1.15)), width: lerp(width, width * 0.82, t), layer: 0.006 + 0.004 * t,
    emarg: t > slotFrom ? { from: 0.45, by: slotBy } : null, group: 'Flight' }); }
  const flight = rays.filter((r) => r.kind !== 'tertial');
  for (const [row, frac, z] of [['greater', 0.42, 0.022], ['lesser', 0.22, 0.034]]) flight.forEach((r) => add1({ ...r, kind: `${row}Covert`, len: r.len * frac, width: r.width * 1.05, emarg: null, layer: z + (r.layer ?? 0), group: row === 'greater' ? 'Covert' : 'CovertLesser' }));
  const TONES = { Flight: { tones: ['FlightA', 'FlightB', 'FlightC'], under: 'FlightUnder' }, Covert: { tones: ['CovertA', 'CovertB', 'CovertC'], under: 'CovertUnder', tipGroup: 'CovertTip', tipFrom: 0.62 },
    CovertLesser: { tones: ['LesserA', 'LesserB', 'LesserC'], under: 'CovertUnder', tipGroup: 'LesserTip', tipFrom: 0.8 } };
  rays.forEach((r, i) => { const T = TONES[r.group]; const k = (i + (hash(`${r.kind}${i}`) % 5 === 0 ? 1 : 0)) % 2 + (hash(`t${r.kind}${i}`) % 7 === 0 ? 1 : 0); Object.assign(r, { tone: T.tones[k], under: T.under, ...(T.tipGroup ? { tipGroup: T.tipGroup, tipFrom: T.tipFrom } : {}) }); });
  return { girdle: 'torso', boneGroup: 'WingBone', surface: 'vanes',
    arm: [{ id: 'humerus', len: arm[0], spread: 8, folded: -80, r: [0.035, 0.03] }, { id: 'ulna', len: arm[1], spread: -6, folded: 168, r: [0.03, 0.025] }, { id: 'hand', len: arm[2], spread: -6, folded: -165, r: [0.025, 0.015] }],
    rays, frame: { spread: { S: [1, 0, 0.14], C: [0, 1, 0] }, folded: { S: [0.2, 0, -1], C: [0, 1, 0] } } };
}

const WING_PALETTE = { WingBone: '#7d5f40', FlightA: '#33271f', FlightB: '#43342a', FlightC: '#54433a', FlightUnder: '#8d8680',
  CovertA: '#9a7a52', CovertB: '#a98a60', CovertC: '#8b6c47', CovertTip: '#efe6d2', CovertUnder: '#e6dccb',
  LesserA: '#b0916a', LesserB: '#bd9f77', LesserC: '#a3855d', LesserTip: '#e3d5bc' };
const band = (g) => [g, g, g, g, g, g];

export const family = {
  family: 'avian',
  colors: {
    coat: '#7d5f40', sock: '#9b958a', ash: '#ece2cf', ashAlt: '#dccfb6', belly: '#cfc7ba', ears: '#d6cfc3', snout: '#cbbf9f',
    brow: '#bdb3a2', iris: '#6b3f1c', ink: '#17130f', sclera: '#2b2116', nose: '#9a8f7a', teeth: '#cbbf9f', mouth: '#5a3a30', tip: '#3a2c22', hoof: '#2b2521',
  },
  joints: {
    neckBase: [0, 0.18, 0.64], neckTop: [0, 0.33, 0.77], wingRoot: [0.12, 0.14, 0.70],
    hip: [0.09, -0.04, 0.46], knee: [0.11, 0.05, 0.26], ankle: [0.10, 0.07, 0.07],
    toeF: [0.10, 0.20, 0.02], toeI: [0.05, 0.17, 0.02], toeO: [0.16, 0.15, 0.02], toeB: [0.10, -0.05, 0.02],
    clawF: [0.10, 0.24, 0.006], clawI: [0.045, 0.205, 0.006], clawO: [0.18, 0.18, 0.006], clawB: [0.10, -0.085, 0.006],
  },
  torso: [
    { at: [0, -0.30, 0.52], r: [0.09, 0.07] },
    { at: [0, -0.18, 0.52], r: [0.16, 0.13] },
    { at: [0, -0.02, 0.52], r: [0.19, 0.16] },
    { at: [0, 0.12, 0.52], r: [0.18, 0.17] },
    { at: [0, 0.22, 0.52], r: [0.13, 0.13] },
  ],
  torsoCaps: { back: [0, -0.36, 0.52], tip: [0, 0.28, 0.53] },
  neckRA: [0.08, 0.08], neckRB: [0.03, 0.03], neckRMid: [0.036, 0.036], neckGroup: 'Belly',
  tail: [[0, -0.30, 0.53, [0.07, 0.03]], [0, -0.38, 0.47, [0.1, 0.025]], [0, -0.45, 0.42, [0.11, 0.02]]],
  tip: [[0, -0.44, 0.425, [0.1, 0.018]], [0, -0.49, 0.39, [0.1, 0.015]], [0, -0.52, 0.37, [0.08, 0.01]]],
  tipCaps: { back: [0, -0.42, 0.44], tip: [0, -0.54, 0.36] },
  legs: [
    ['thighR', 'hip', 'knee', [0.085, 0.095], [0.06, 0.06], 'Coat', [0.4, 0.4]],
    ['tarsusR', 'knee', 'ankle', 0.026, 0.024, 'Sock', [0.4, 0.4]],
    ['toeFR', 'ankle', 'toeF', 0.02, 0.014, 'Sock', [0.4, 0.4]],
    ['toeIR', 'ankle', 'toeI', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['toeOR', 'ankle', 'toeO', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['toeBR', 'ankle', 'toeB', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['clawFR', 'toeF', 'clawF', 0.011, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawIR', 'toeI', 'clawI', 0.01, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawOR', 'toeO', 'clawO', 0.01, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawBR', 'toeB', 'clawB', 0.011, 0.004, 'Hoof', [0.3, 0.3]],
  ],
  // skull rows (metres, the head's own frame): st0–st2 the bare skull, st3–st6 the bill, the tip cap the hook
  craniumRows: [
    ['st0', -0.05, 0.03, [0.015, 0.028], [0.03, 0.012], [0.033, -0.005], [0.028, -0.02], [0.02, -0.027], -0.03],
    ['st1', -0.02, 0.04, [0.02, 0.038], [0.036, 0.018], [0.038, -0.002], [0.032, -0.018], [0.022, -0.026], -0.028],
    ['st2', 0.01, 0.036, [0.018, 0.034], [0.033, 0.015], [0.034, -0.004], [0.028, -0.017], [0.02, -0.024], -0.026],
    ['st3', 0.04, 0.026, [0.012, 0.024], [0.02, 0.012], [0.022, -0.004], [0.019, -0.014], [0.015, -0.02], -0.022],
    ['st4', 0.07, 0.024, [0.008, 0.022], [0.013, 0.01], [0.014, -0.003], [0.012, -0.012], [0.01, -0.017], -0.019],
    ['st5', 0.095, 0.017, [0.006, 0.015], [0.009, 0.005], [0.01, -0.005], [0.009, -0.013], [0.007, -0.018], -0.02],
    ['st6', 0.11, 0.004, [0.004, 0.002], [0.006, -0.006], [0.006, -0.014], [0.005, -0.022], [0.004, -0.026], -0.028],
  ],
  craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.112, -0.04] },
  craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': band('Ears'), 'st2-st3': band('Ears'), 'st3-st4': band('Snout'), 'st4-st5': band('Snout'), 'st5-st6': band('Snout') },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.03, { gum: -0.028, gumR: [0.022, -0.028], jaw: [0.022, -0.035], bottom: -0.04 }],
    ['st1', 0.02, { gum: -0.024, gumR: [0.016, -0.024], jaw: [0.016, -0.03], bottom: -0.034 }],
    ['st2', 0.06, { gum: -0.02, gumR: [0.011, -0.02], jaw: [0.011, -0.025], bottom: -0.028 }],
    ['st3', 0.09, { gum: -0.021, gumR: [0.007, -0.021], jaw: [0.007, -0.025], bottom: -0.027 }],
  ],
  jawCaps: { back: [0, -0.045, -0.034], tip: [0, 0.098, -0.025] },
  skinControls: {
    browRaise: { amp: 0.004, map: [['st2.brow', 0.8, [0, 0, 1]], ['st1.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.004, map: [['st2.brow', 1, [-0.3, 0.2, -1]]] },
  },
  headScale: 0.85, nape: [0, -0.05, -0.02],
  eyeAt: [2.3, 2.3], eyeR: 0.008, pupil: 'round', irisAngle: 40,
  orbit: { reach: [0.004, 0.005, 0.006], bulk: [0.001, 0.0015], thickness: 0.002 },
  browStrip: [[1.0, 1.95], [1.25, 1.95], [1.5, 2.0], [1.75, 2.1], [2.0, 2.25]],
  foldStrip: [[3.6, 3.9], [3.5, 4.0], [3.4, 4.1], [3.3, 4.2], [3.2, 4.3]],
  nostrilAt: [3.3, 1.6], noseAt: [3.3, 1.6], noseR: [0.003, 0.003], webCranium: [1.7, 3.3, 4.97],
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01, 0.01, 0.01], earSquash: [1, 0.4],
  bodyTiles: [
    { id: 'ruff', parts: ['neck'], s: [0.3, 1.3], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: 0.09, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
  ],
  wings: { wing: featherWing(), at: 'wingRoot', fold: 1, palette: WING_PALETTE },
  scale: 1,
};

export const species = {
  // GRIFFON VULTURE (Gyps fulvus) — the avian family's worked species. Thesis: a big hunched soaring bird standing
  // on the ground, wings folded long down the back past a short dark tail · a small BARE pale head on a long bare
  // neck rising from a cream RUFF · a heavy HOOKED bill · grey scaly tarsi, three toes forward with blunt talons ·
  // sandy-brown coverts, dark flight feathers. ~1.0 m standing (published length 93–122 cm, span 2.3–2.8 m;
  // Wikipedia / BirdLife); hunched: head top ~0.95 m, top of the back ~0.8 m. `wings.fold` 0 spreads them (span ~2.5 m).
  vulture: { family: 'avian', name: 'a griffon vulture', scale: 1.15 },

  // BALD EAGLE (Haliaeetus leucocephalus). Thesis: an UPRIGHT perched raptor, trunk tilted ~40°, long broad dark wings
  // folded down the sides to the tail · a WHITE head on a short thick white neck with a heavy brow over a pale eye ·
  // a big deep YELLOW HOOKED bill · a WHITE wedge tail hanging below the wingtips · feathered dark thighs, bare
  // YELLOW tarsi and toes, black talons · dark-brown body. Size: published length 70–102 cm, span 1.8–2.3 m
  // (Wikipedia, "Bald eagle"); perched upright: head top ~0.80 m (height target).
  baldEagle: {
    family: 'avian', name: 'a bald eagle', torsoUp: true, scale: 0.885,
    colors: { coat: '#3a2a1d', sock: '#e2b32c', ash: '#e3b12a', ashAlt: '#f1efe8', belly: '#f3f1ea', ears: '#f3f1ea', snout: '#e8b425',
      brow: '#f3f1ea', iris: '#e9d36a', sclera: '#e9d36a', nose: '#e8b425', tip: '#f3f1ea', mane: '#f3f1ea', hoof: '#151210' },
    joints: { neckBase: [0, 0.13, 0.70], neckTop: [0, 0.17, 0.84], wingRoot: [0.13, 0.08, 0.68],
      hip: [0.09, -0.06, 0.40], knee: [0.11, 0.05, 0.24], ankle: [0.10, 0.04, 0.07] },
    torso: [
      { at: [0, -0.24, 0.36], r: [0.09, 0.07] },
      { at: [0, -0.15, 0.44], r: [0.15, 0.13] },
      { at: [0, -0.04, 0.53], r: [0.19, 0.16] },
      { at: [0, 0.06, 0.62], r: [0.18, 0.16] },
      { at: [0, 0.13, 0.69], r: [0.11, 0.11] },
    ],
    torsoCaps: { back: [0, -0.29, 0.32], tip: [0, 0.17, 0.73] },
    neckRA: [0.1, 0.1], neckRB: [0.06, 0.06], neckRMid: [0.07, 0.07],
    tail: [[0, -0.25, 0.34, [0.08, 0.035]], [0, -0.31, 0.26, [0.11, 0.03]], [0, -0.36, 0.19, [0.12, 0.025]]],
    tip: [[0, -0.35, 0.2, [0.13, 0.03]], [0, -0.41, 0.11, [0.16, 0.026]], [0, -0.45, 0.05, [0.13, 0.015]]],
    tipCaps: { back: [0, -0.33, 0.23], tip: [0, -0.465, 0.03] },
    legs: [
      ['thighR', 'hip', 'knee', [0.09, 0.1], [0.065, 0.065], 'Coat', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.03, 0.028, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.024, 0.017, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.014, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.013, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.013, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.014, 0.004, 'Hoof', [0.3, 0.3]],
    ],
    // a flatter, broader skull and a DEEP bill (st3–st6) ending in a long hook (tip cap well below the culmen)
    craniumRows: [
      ['st0', -0.05, 0.034, [0.02, 0.032], [0.036, 0.014], [0.038, -0.006], [0.032, -0.024], [0.022, -0.032], -0.035],
      ['st1', -0.02, 0.042, [0.024, 0.04], [0.042, 0.02], [0.044, -0.002], [0.036, -0.02], [0.025, -0.03], -0.032],
      ['st2', 0.01, 0.04, [0.022, 0.038], [0.04, 0.022], [0.04, -0.004], [0.032, -0.02], [0.022, -0.028], -0.03],
      ['st3', 0.04, 0.034, [0.016, 0.032], [0.024, 0.016], [0.026, -0.006], [0.022, -0.02], [0.017, -0.027], -0.028],
      ['st4', 0.07, 0.03, [0.011, 0.028], [0.017, 0.012], [0.018, -0.006], [0.015, -0.018], [0.012, -0.024], -0.025],
      ['st5', 0.095, 0.022, [0.008, 0.02], [0.012, 0.006], [0.012, -0.008], [0.011, -0.018], [0.008, -0.024], -0.026],
      ['st6', 0.113, 0.008, [0.005, 0.006], [0.007, -0.006], [0.007, -0.018], [0.006, -0.028], [0.004, -0.033], -0.036],
    ],
    craniumCaps: { back: [0, -0.058, 0.0], tip: [0, 0.122, -0.05] },
    browStrip: [[1.2, 1.9], [1.45, 1.9], [1.7, 1.95], [1.95, 2.05], [2.2, 2.2]],
    headScale: 1.05, eyeAt: [2.2, 2.2], eyeR: 0.009,
    bodyTiles: [
      { id: 'ruff', parts: ['neck'], s: [0.1, 1.2], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: 0.05, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Belly', 'Mane'] },
    ],
    // the folded wing plane pitched 40° nose-up with the trunk, so the folded wing runs down the back to the tail
    wings: { wing: { ...featherWing({ arm: [0.17, 0.25, 0.17], secLen: 0.38, primLen: 0.42, primReach: 0.13 }),
      frame: { spread: { S: [1, 0, 0.14], C: [0, 1, 0] }, folded: { S: [0.2, 0.643, -0.766], C: [0, 0.766, 0.643] } } },
      palette: { WingBone: '#3a2a1d', FlightA: '#231a13', FlightB: '#2c2118', FlightC: '#35281d', FlightUnder: '#3e3128',
        CovertA: '#3d2c1f', CovertB: '#46332a', CovertC: '#352619', CovertTip: '#4a3626', CovertUnder: '#3e3128',
        LesserA: '#4a3725', LesserB: '#523d2a', LesserC: '#433121', LesserTip: '#4e3a28' } },
  },

  // GREAT HORNED OWL (Bubo virginianus). Thesis: a COMPACT near-vertical barrel, wings folded flat down the sides, a
  // short tail · a BIG ROUND head as wide as the shoulders with a flat rufous FACIAL DISC and two upright EAR TUFTS ·
  // LARGE forward-facing YELLOW eyes under pale brows · a tiny dark hooked bill · a pale throat bib · thick
  // FEATHERED buff legs and toes, dark talons · mottled grey-brown. Size: published length 43–64 cm, span 101–153 cm
  // (Wikipedia, "Great horned owl"); perched upright: head top with tufts ~0.52 m (height target). Authored at size.
  greatHornedOwl: {
    family: 'avian', name: 'a great horned owl', torsoUp: true, scale: 1,
    colors: { coat: '#6e5c47', sock: '#c8b89a', ash: '#c47f45', ashAlt: '#d9cfbd', belly: '#e8e2d4', ears: '#5a4a3a', snout: '#3b3734',
      brow: '#ece6da', iris: '#f5c518', sclera: '#f5c518', nose: '#3b3734', tip: '#6e5c47', hoof: '#1e1a17', mane: '#e8e2d4' },
    joints: { neckBase: [0, 0.0, 0.36], neckTop: [0, 0.015, 0.40], wingRoot: [0.08, -0.02, 0.37],
      hip: [0.06, -0.04, 0.17], knee: [0.07, 0.03, 0.10], ankle: [0.065, 0.03, 0.035],
      toeF: [0.065, 0.10, 0.012], toeI: [0.035, 0.085, 0.012], toeO: [0.1, 0.075, 0.012], toeB: [0.065, -0.015, 0.012],
      clawF: [0.065, 0.12, 0.004], clawI: [0.03, 0.10, 0.004], clawO: [0.115, 0.09, 0.004], clawB: [0.065, -0.035, 0.004] },
    torso: [
      { at: [0, -0.06, 0.10], r: [0.09, 0.07] },
      { at: [0, -0.05, 0.18], r: [0.125, 0.115] },
      { at: [0, -0.03, 0.27], r: [0.13, 0.12] },
      { at: [0, -0.015, 0.33], r: [0.12, 0.11] },
      { at: [0, 0.0, 0.37], r: [0.09, 0.08] },
    ],
    torsoCaps: { back: [0, -0.075, 0.065], tip: [0, 0.01, 0.40] },
    neckRA: [0.08, 0.08], neckRB: [0.07, 0.07], neckRMid: [0.075, 0.075],
    tail: [[0, -0.10, 0.14, [0.05, 0.02]], [0, -0.12, 0.10, [0.065, 0.018]], [0, -0.135, 0.07, [0.07, 0.015]]],
    tip: [[0, -0.13, 0.075, [0.07, 0.014]], [0, -0.14, 0.055, [0.065, 0.012]], [0, -0.145, 0.045, [0.05, 0.008]]],
    tipCaps: { back: [0, -0.125, 0.09], tip: [0, -0.147, 0.04] },
    legs: [
      ['thighR', 'hip', 'knee', [0.05, 0.055], [0.04, 0.04], 'Sock', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.026, 0.024, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.015, 0.011, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
    ],
    // a round skull (st0–st3) whose front band st3→st4 is the near-flat FACIAL DISC; st4–st6 a tiny hooked bill
    craniumRows: [
      ['st0', -0.05, 0.035, [0.03, 0.03], [0.045, 0.01], [0.045, -0.015], [0.035, -0.035], [0.02, -0.045], -0.048],
      ['st1', -0.02, 0.055, [0.045, 0.045], [0.064, 0.015], [0.066, -0.02], [0.05, -0.045], [0.028, -0.058], -0.062],
      ['st2', 0.015, 0.055, [0.046, 0.046], [0.066, 0.012], [0.066, -0.02], [0.05, -0.046], [0.028, -0.058], -0.062],
      ['st3', 0.035, 0.045, [0.04, 0.04], [0.058, 0.01], [0.058, -0.02], [0.044, -0.04], [0.024, -0.05], -0.054],
      ['st4', 0.045, 0.0, [0.006, -0.002], [0.009, -0.008], [0.009, -0.016], [0.007, -0.022], [0.004, -0.026], -0.028],
      ['st5', 0.058, -0.004, [0.004, -0.006], [0.006, -0.011], [0.006, -0.018], [0.005, -0.023], [0.003, -0.026], -0.028],
      ['st6', 0.066, -0.014, [0.002, -0.015], [0.003, -0.018], [0.003, -0.022], [0.002, -0.026], [0.002, -0.029], -0.031],
    ],
    craniumCaps: { back: [0, -0.062, -0.005], tip: [0, 0.071, -0.034] },
    craniumBandGroups: { 'st3-st4': ['Cheek', 'Cheek', 'Cheek', 'Cheek', 'Cheek', 'Cheek'] },
    jawRows: [
      ['st0', 0.04, { gum: -0.026, gumR: [0.006, -0.026], jaw: [0.006, -0.03], bottom: -0.033 }],
      ['st1', 0.05, { gum: -0.026, gumR: [0.005, -0.026], jaw: [0.005, -0.029], bottom: -0.031 }],
      ['st2', 0.058, { gum: -0.027, gumR: [0.003, -0.027], jaw: [0.003, -0.029], bottom: -0.03 }],
      ['st3', 0.064, { gum: -0.029, gumR: [0.002, -0.029], jaw: [0.002, -0.03], bottom: -0.031 }],
    ],
    jawCaps: { back: [0, 0.035, -0.03], tip: [0, 0.066, -0.031] },
    headScale: 1, nape: [0, -0.03, -0.03],
    eyeAt: [3.3, 1.7], eyeR: 0.022, orbit: { open: [1, 1] },
    browStrip: [[3.05, 1.0], [3.1, 1.25], [3.15, 1.5], [3.2, 1.8], [3.25, 2.1]],
    nostrilAt: [4.3, 1.4], noseAt: [4.3, 1.4], noseR: [0.002, 0.002],
    ears: true, earAt: [1.7, 1.2], earSpine: [[0, 0, 0], [0.008, -0.006, 0.03], [0.018, -0.012, 0.062]],
    earR: [0.011, 0.009, 0.005, 0.0015], earSquash: [1, 0.45],
    bodyTiles: [],
    // a small rounded wing (bones and tertials thinned to its size, a small hidden core), folded plane pitched 60°
    wings: { core: 0.015, wing: ((w) => ({ ...w, arm: w.arm.map((b) => ({ ...b, r: b.r.map((r) => r * 0.5) })),
      rays: w.rays.map((r) => (r.kind === 'tertial' ? { ...r, len: r.len * 0.45, width: r.width * 0.5 } : r)),
      frame: { spread: { S: [1, 0, 0.14], C: [0, 1, 0] }, folded: { S: [0.2, 0.866, -0.5], C: [0, 0.5, 0.866] } } }))(
      featherWing({ arm: [0.09, 0.13, 0.09], secondaries: 14, secLen: 0.19, primLen: 0.2, primReach: 0.06, slotFrom: 0.6, slotBy: 0.3, width: 0.05 })),
      palette: { WingBone: '#6e5c47', FlightA: '#5b4a38', FlightB: '#6a5743', FlightC: '#4e3f30', FlightUnder: '#c2b49a',
        CovertA: '#7a6650', CovertB: '#86715a', CovertC: '#6b5845', CovertTip: '#c9b99c', CovertUnder: '#c2b49a',
        LesserA: '#7d6a55', LesserB: '#8a765f', LesserC: '#6f5c48', LesserTip: '#b9a98d' } },
  },
};
