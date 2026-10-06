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
};
