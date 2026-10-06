// FELINE — a long supple trunk slung between heavy forequarters and a lower back line, a short round skull with a short
// broad muzzle, small rounded ears, a long low-carried tail, big round digitigrade paws. Worked species: the African
// lion. See ../build.js for what every field does. Tables are authored at ~1.0 m withers (scale 1).

export const family = {
  family: 'feline',
  colors: {
    coat: '#b88b52', sock: '#b08450', ash: '#dcc7a2', ashAlt: '#cdb48a', brow: '#5a4128', iris: '#c8973a',
    ink: '#17130f', sclera: '#2b2116', nose: '#5a3a30', teeth: '#ece6d6', mouth: '#4e3430', tip: '#2a1f17', mane: '#7a5530',
  },
  joints: {
    neckBase: [0, 0.42, 0.78], neckTop: [0, 0.66, 0.86],
    shoulder: [0.16, 0.36, 0.72], elbow: [0.17, 0.28, 0.42], carpus: [0.15, 0.33, 0.13], forePaw: [0.15, 0.36, 0.074], foreToe: [0.15, 0.48, 0.064],
    hip: [0.13, -0.46, 0.70], stifle: [0.16, -0.28, 0.44], hock: [0.15, -0.57, 0.22], hindPaw: [0.15, -0.51, 0.074], hindToe: [0.15, -0.39, 0.064],
  },
  // a level trunk: deep chest, a moderate (not wasp) waist, the rump a little lower and narrower than the shoulders
  torso: [
    { at: [0, -0.64, 0.70], r: [0.11, 0.10] },
    { at: [0, -0.48, 0.70], r: [0.15, 0.15] },
    { at: [0, -0.24, 0.70], r: [0.13, 0.155] },
    { at: [0, 0.02, 0.70], r: [0.15, 0.19] },
    { at: [0, 0.24, 0.70], r: [0.165, 0.20] },
    { at: [0, 0.40, 0.70], r: [0.15, 0.19] },
  ],
  torsoCaps: { back: [0, -0.72, 0.70], tip: [0, 0.50, 0.68] },
  neckRA: [0.14, 0.17], neckRB: [0.10, 0.11], neckRMid: [0.12, 0.14],
  // a long thin tail: off the rump, hanging in a curve to near the hock, the end lifted
  tail: [[0, -0.64, 0.76, 0.045], [0, -0.74, 0.70, 0.04], [0, -0.80, 0.56, 0.035], [0, -0.85, 0.36, 0.032], [0, -0.90, 0.22, 0.03], [0, -0.98, 0.17, 0.028]],
  tip: [[0, -0.97, 0.17, 0.035], [0, -1.02, 0.18, 0.055], [0, -1.07, 0.20, 0.04]],
  tipCaps: { back: [0, -0.95, 0.17], tip: [0, -1.10, 0.21] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.095, 0.14], [0.065, 0.07], 'Coat', [0.6, 0.5], [0.085, 0.105]],
    ['foreArmR', 'elbow', 'carpus', [0.065, 0.07], [0.045, 0.047], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.046, 0.045, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.08, 0.052], [0.076, 0.04], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.12, 0.165], [0.065, 0.07], 'Coat', [0.2, 0.5], [0.10, 0.13]],
    ['shinR', 'stifle', 'hock', [0.06, 0.07], [0.04, 0.045], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.042, 0.04, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.074, 0.048], [0.07, 0.038], 'Sock', [0.6, 0.4]],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a domed round braincase, broad cheeks, a short
  // blunt muzzle (rows st3..st6 packed close), a deep chin
  craniumRows: [
    ['st0', -0.15, 0.05, [0.035, 0.048], [0.065, 0.02], [0.07, -0.02], [0.06, -0.05], [0.04, -0.065], -0.07],
    ['st1', -0.09, 0.115, [0.03, 0.11], [0.08, 0.06], [0.10, -0.01], [0.09, -0.05], [0.055, -0.075], -0.08],
    ['st2', -0.02, 0.11, [0.04, 0.105], [0.088, 0.05], [0.11, -0.005], [0.095, -0.05], [0.055, -0.078], -0.08],
    ['st3', 0.04, 0.055, [0.02, 0.053], [0.06, 0.03], [0.075, -0.015], [0.065, -0.05], [0.045, -0.072], -0.072],
    ['st4', 0.09, 0.03, [0.022, 0.028], [0.045, 0.008], [0.055, -0.02], [0.05, -0.05], [0.038, -0.066], -0.066],
    ['st5', 0.13, 0.018, [0.02, 0.015], [0.035, -0.002], [0.042, -0.025], [0.04, -0.05], [0.03, -0.062], -0.06],
    ['st6', 0.16, 0.006, [0.014, 0.004], [0.026, -0.004], [0.03, -0.028], [0.028, -0.046], [0.022, -0.056], -0.054],
  ],
  craniumCaps: { back: [0, -0.18, 0.01], tip: [0, 0.172, -0.025] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.078, gumR: [0.05, -0.078], jaw: [0.056, -0.105], bottom: -0.12 }],
    ['st1', 0.0, { gum: -0.078, gumR: [0.045, -0.078], jaw: [0.05, -0.102], bottom: -0.114 }],
    ['st2', 0.06, { gum: -0.068, gumR: [0.036, -0.068], jaw: [0.04, -0.09], bottom: -0.1 }],
    ['st3', 0.11, { gum: -0.06, gumR: [0.028, -0.06], jaw: [0.03, -0.08], bottom: -0.088 }],
    ['st4', 0.15, { gum: -0.054, gumR: [0.02, -0.054], jaw: [0.022, -0.07], bottom: -0.078 }],
  ],
  jawCaps: { back: [0, -0.1, -0.1], tip: [0, 0.162, -0.064] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.3, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.4], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.022, 0.018], webCranium: [1.7, 3.3, 4.97],
  // small rounded ears set wide on the skull
  earAt: [1.2, 1.8], earSpine: [[0, 0, -0.012], [0, 0, 0.012], [0, 0, 0.035], [0, 0, 0.055], [0, 0, 0.07]],
  earR: [0.04, 0.042, 0.036, 0.022], earSquash: [1, 0.4], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// ── coat patterns as data (no markings channel): a COAT SHELL is a loft a hair proud of the trunk, its bands
// grouped per slot (`bandGroups`, six right-half bands from the back line down to the belly), so stripes / spots /
// a pale belly are band colours on the trunk's own outline. `pick(i, j)` names the group of band i (back→front),
// slot j (0 back line … 5 belly).
const coatShell = (name, torso, { bulk = 1, proud = 1.035, ys, pick, z }) => {
  const rAt = (y) => { const T = torso; if (y <= T[0].at[1]) return T[0].r; for (let i = 1; i < T.length; i++) if (y <= T[i].at[1]) { const t = (y - T[i - 1].at[1]) / (T[i].at[1] - T[i - 1].at[1]); return T[i - 1].r.map((r, c) => r + (T[i].r[c] - r) * t); } return T[T.length - 1].r; };
  const zc = z ?? torso[0].at[2];
  return { name, kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
    stations: ys.map((y) => ({ at: [0, y, zc], r: rAt(y).map((r) => r * bulk * proud) })),
    bandGroups: Object.fromEntries(ys.slice(1).map((_, i) => [`st${i}-st${i + 1}`, Array.from({ length: 6 }, (_, j) => pick(i, j))])),
    caps: { back: [0, ys[0] - 0.02, zc], tip: [0, ys[ys.length - 1] + 0.02, zc] }, capGroups: { back: 'Coat', tip: 'Coat' } };
};
// a sparse, irregular spot field (deterministic): band i, slot j dark when the hash falls under `d`
const spotty = (d, seed = 0) => (i, j) => (j >= 5 ? 'Belly' : ((i * 7 + j * 13 + seed) * 37) % 100 < d * 100 ? 'Mane' : 'Coat');
const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
// a tail as a loft with dark rings (bandGroups), the tip cap dark
const ringedTail = (pts, ringFrom, caps) => ({ name: 'tailRinged', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
  stations: pts.map(([x, y, z, r]) => ({ at: [x, y, z], r })),
  bandGroups: Object.fromEntries(pts.slice(1).map((_, i) => [`st${i}-st${i + 1}`, Array(6).fill(i >= ringFrom && (i - ringFrom) % 2 === 1 ? 'Mane' : 'Coat')])),
  caps, capGroups: { back: 'Coat', tip: 'Mane' }, up: [0, 1, 1] });   // a stable ring frame: no twist as it hangs and hooks

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // AFRICAN LION, adult male (Panthera leo). Thesis: long low supple trunk behind heavy forequarters, level back ·
  // digitigrade, big round paws · round skull, short broad muzzle, small round ears · THE MANE framing the head over
  // neck and shoulders, and the long tail with a dark terminal tuft · 1.20 m at the shoulder (males ~1.2 m,
  // Haas, Hayssen & Krausman 2005, Mammalian Species 762).
  lion: {
    family: 'feline', name: 'an African lion', scale: 1.21,
        joints: { maneBack: [0, 0.24, 0.82], maneFront: [0, 0.57, 0.92] },
    extraSegments: [
      { name: 'mane', kind: 'segment', from: 'maneBack', to: 'maneFront', rA: [0.17, 0.17], rB: [0.24, 0.30], rMid: [0.22, 0.26], slots: 'ring12', over: [0.3, 0.4], group: 'Mane', mirror: 'plane' },
    ],
    headScale: 1.55, muzzleW: 1.25, muzzleLen: 0.65, earH: 1.3, bulk: 1.38, legBulk: 1.5,
  },
  // COUGAR / PUMA, adult (Puma concolor). Thesis: long lithe trunk, small tuck-up, rump set HIGHER than the shoulders
  // on long hind legs · digitigrade, round paws · small round head, short muzzle, small round ears, NO mane · the long
  // thick tail, nearly body-length, carried low in a J (hangs, then hooks up) · plain tawny coat · 0.70 m at the
  // shoulder (60-90 cm, Nowell & Jackson 1996, Wild Cats: Status Survey, IUCN).
  cougar: {
    family: 'feline', name: 'a cougar', scale: 0.74,
    colors: { coat: '#b5875a', sock: '#a87c52', tip: '#3a2a1e' },
    // the back rise: trunk centres climb from the shoulders to the rump on a stable ring frame, and the rump rings'
    // upper halves lift further (`top`), so the back line runs uphill to the croup while the belly keeps its tuck
    torso: [
      { at: [0, -0.64, 0.79], r: [0.11, 0.10], top: 0.035 },
      { at: [0, -0.48, 0.79], r: [0.15, 0.15], top: 0.045 },
      { at: [0, -0.24, 0.75], r: [0.13, 0.155], top: 0.03 },
      { at: [0, 0.02, 0.70], r: [0.15, 0.19] },
      { at: [0, 0.24, 0.68], r: [0.165, 0.20] },
      { at: [0, 0.40, 0.68], r: [0.15, 0.19] },
    ],
    torsoCaps: { back: [0, -0.72, 0.81], tip: [0, 0.50, 0.66] },
    joints: { hip: [0.13, -0.46, 0.84], stifle: [0.16, -0.26, 0.47], hock: [0.15, -0.60, 0.25], rumpA: [0, -0.62, 0.82], rumpB: [0, -0.30, 0.79] },
    extraSegments: [
      { name: 'rump', kind: 'segment', from: 'rumpA', to: 'rumpB', rA: [0.11, 0.10], rB: [0.13, 0.14], rMid: [0.145, 0.15], slots: 'ring12', over: [0.3, 0.4], group: 'Coat', mirror: 'plane' },
    ],
    tail: [[0, -0.64, 0.80, 0.062], [0, -0.76, 0.64, 0.06], [0, -0.86, 0.48, 0.058], [0, -0.94, 0.32, 0.056], [0, -1.02, 0.21, 0.053], [0, -1.12, 0.16, 0.05]],
    tip: [[0, -1.11, 0.16, 0.05], [0, -1.20, 0.19, 0.048], [0, -1.27, 0.26, 0.038]],
    tipCaps: { back: [0, -1.09, 0.155], tip: [0, -1.30, 0.30] },
    headScale: 1.15, muzzleW: 1.15, muzzleLen: 0.68, earH: 0.95, bulk: 1.2, legBulk: 1.15,
  },
  // DOMESTIC CAT, shorthair (Felis catus). Thesis: small, compact supple trunk, level back, fine legs · digitigrade
  // small round paws · a LARGE round head for the body, short muzzle · UPRIGHT TRIANGULAR pointed ears, big for the
  // head · the long thin tail carried UP · 0.25 m at the shoulder (Sunquist & Sunquist 2002, Wild Cats of the World:
  // domestic cat shoulder height ~23-25 cm, head-body ~46 cm, tail ~30 cm).
  houseCat: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'feline', name: 'a house cat', scale: 0.27,
    colors: { coat: '#8a8178', sock: '#8a8178', ash: '#d8d2c8', ashAlt: '#c8c0b4', brow: '#4a443e', tip: '#3e3832', iris: '#b8a83a', nose: '#c08080' },
    joints: { neckBase: [0, 0.42, 0.80], neckTop: [0, 0.62, 0.94] },
    tail: [[0, -0.64, 0.76, 0.045], [0, -0.74, 0.86, 0.042], [0, -0.80, 1.02, 0.04], [0, -0.82, 1.20, 0.038], [0, -0.80, 1.36, 0.036], [0, -0.74, 1.48, 0.034]],
    tip: [[0, -0.745, 1.475, 0.034], [0, -0.69, 1.53, 0.03], [0, -0.63, 1.55, 0.022]],
    tipCaps: { back: [0, -0.77, 1.45], tip: [0, -0.60, 1.555] },
    headScale: 2.3, muzzleW: 1.0, muzzleLen: 0.6, noseR: [0.012, 0.01],
    earAt: [1.2, 1.6], earSpine: [[0, 0, -0.012], [0, 0, 0.015], [0, 0, 0.04], [0, 0, 0.065], [0, 0, 0.09]],
    earR: [0.046, 0.04, 0.025, 0.005], earSquash: [1, 0.35], earH: 0.78,
    bulk: 1.1, legBulk: 1.05, tailBush: 0.85,
  },
  // BENGAL TIGER, adult male (Panthera tigris tigris). Thesis: the lion's long low supple trunk but LONGER and with
  // no mane, a level back, heavy forequarters · digitigrade, big round paws · a big round head with white cheek ruffs,
  // short broad muzzle, small round ears · THE STRIPES: dark vertical bars on an orange coat over a white belly, and a
  // dark-ringed tail · ≈1.0 m at the shoulder (0.9–1.1 m, Mazák 1981, Mammalian Species 152 "Panthera tigris").
  tiger: (() => {
    const BULK = 1.35;
    // stripes: alternate dark bars on the back and flanks, the lowest slot (belly) pale throughout
    const ys = steps(-0.62, 0.38, 20);
    return {
      family: 'feline', name: 'a Bengal tiger', scale: 1.03, bulk: BULK, legBulk: 1.45,
      colors: { coat: '#c8752c', sock: '#c8752c', ash: '#ece4d4', ashAlt: '#e0d6c2', brow: '#1d1612', tip: '#1d1612', mane: '#1d1612' },
      tail: null, tip: null,
      extraSegments: [
        coatShell('stripes', family.torso, { bulk: BULK, ys, pick: (i, j) => (j >= 5 ? 'Belly' : j >= 4 ? (i % 3 === 1 ? 'Mane' : 'Belly') : i % 3 === 1 ? 'Mane' : 'Coat') }),
        ringedTail([[0, -0.64, 0.76, 0.055], [0, -0.74, 0.70, 0.05], [0, -0.80, 0.56, 0.045], [0, -0.85, 0.42, 0.042], [0, -0.88, 0.32, 0.04], [0, -0.92, 0.24, 0.038], [0, -0.98, 0.18, 0.036], [0, -1.05, 0.17, 0.034], [0, -1.11, 0.20, 0.03]], 1,
          { back: [0, -0.60, 0.79], tip: [0, -1.14, 0.22] }),
      ],
      headScale: 1.6, muzzleW: 1.3, muzzleLen: 0.6, earH: 1.0,
    };
  })(),
  // LEOPARD, adult (Panthera pardus). Thesis: a long LOW lithe trunk on SHORT stout legs (lower-slung than a lion or
  // cheetah), level back · digitigrade, broad round paws · a broad head, short muzzle, small round ears · THE ROSETTES:
  // dark spots all over a golden coat, a pale belly · a long tail carried low with an up-turned end · ≈0.65 m at the
  // shoulder (0.45–0.80 m, Nowell & Jackson 1996, Wild Cats: Status Survey and Conservation Action Plan, IUCN).
  leopard: (() => {
    const BULK = 1.2, Z = 0.62;
    const torso = family.torso.map((s) => ({ ...s, at: [0, s.at[1], Z] }));
    const ys = steps(-0.62, 0.38, 22);
    return {
      family: 'feline', name: 'a leopard', scale: 0.72, bulk: BULK, legBulk: 1.2,
      colors: { coat: '#c9a050', sock: '#c9a050', ash: '#ece0c4', ashAlt: '#dccfae', brow: '#2a1f15', tip: '#1f1810', mane: '#2a1f15' },
      torso, torsoCaps: { back: [0, -0.72, Z], tip: [0, 0.50, Z - 0.02] },
      joints: {
        neckBase: [0, 0.42, 0.70], neckTop: [0, 0.64, 0.80],
        shoulder: [0.16, 0.36, 0.64], elbow: [0.17, 0.28, 0.37], carpus: [0.15, 0.33, 0.12], hip: [0.13, -0.46, 0.62], stifle: [0.16, -0.28, 0.38], hock: [0.15, -0.57, 0.19],
      },
      tail: null, tip: null,
      extraSegments: [
        // spots: a checker of dark and gold patches on the back and flanks, the belly pale
        coatShell('rosettes', torso, { bulk: BULK, ys, pick: spotty(0.24, 3) }),
        ringedTail([[0, -0.64, 0.66, 0.05], [0, -0.76, 0.56, 0.047], [0, -0.86, 0.42, 0.045], [0, -0.94, 0.28, 0.043], [0, -1.02, 0.18, 0.04], [0, -1.12, 0.14, 0.038], [0, -1.20, 0.17, 0.035], [0, -1.26, 0.24, 0.03]], 3,
          { back: [0, -0.60, 0.69], tip: [0, -1.29, 0.28] }),
      ],
      headScale: 1.35, muzzleW: 1.15, muzzleLen: 0.65, earH: 0.95,
    };
  })(),
  // CHEETAH, adult (Acinonyx jubatus). Thesis: a SLIM sprinter: a DEEP narrow chest over a wasp-waisted tuck-up, a
  // slightly arched back, very LONG thin legs · digitigrade, narrow paws · a SMALL round head on a long neck, short
  // muzzle, small ears set low · THE TEAR MARKS (black lines from the inner eye down to the mouth corners), solid dark
  // spots, a long tail ringed dark toward the end · ≈0.80 m at the shoulder (0.70–0.90 m, Krausman & Morales 2005,
  // Mammalian Species 771 "Acinonyx jubatus").
  cheetah: (() => {
    const Z = 0.84;
    const torso = [
      { at: [0, -0.62, Z], r: [0.085, 0.085] },
      { at: [0, -0.48, Z], r: [0.11, 0.11] },
      { at: [0, -0.24, Z], r: [0.07, 0.07] },
      { at: [0, 0.02, Z], r: [0.11, 0.16] },
      { at: [0, 0.24, Z], r: [0.12, 0.19] },
      { at: [0, 0.40, Z], r: [0.11, 0.16] },
    ];
    const ys = steps(-0.60, 0.38, 26);
    return {
      eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
      family: 'feline', name: 'a cheetah', scale: 0.78, bulk: 1, legBulk: 0.8,
      colors: { coat: '#d4a75c', sock: '#d4a75c', ash: '#eee2c8', ashAlt: '#e0d2b2', brow: '#14100c', tip: '#14100c', mane: '#1d1712' },
      torso, torsoCaps: { back: [0, -0.70, Z], tip: [0, 0.50, Z - 0.02] },
      joints: {
        neckBase: [0, 0.40, 0.90], neckTop: [0, 0.64, 1.00],
        shoulder: [0.12, 0.34, 0.86], elbow: [0.13, 0.28, 0.52], carpus: [0.12, 0.33, 0.14], forePaw: [0.12, 0.35, 0.06], foreToe: [0.12, 0.45, 0.05],
        hip: [0.10, -0.46, 0.86], stifle: [0.13, -0.26, 0.54], hock: [0.12, -0.58, 0.24], hindPaw: [0.12, -0.53, 0.06], hindToe: [0.12, -0.43, 0.05],
      },
      neckRA: [0.11, 0.15], neckRB: [0.075, 0.085], neckRMid: [0.09, 0.11],
      tail: null, tip: null,
      extraSegments: [
        coatShell('spots', torso, { ys, pick: spotty(0.3, 5) }),
        ringedTail([[0, -0.60, 0.88, 0.04], [0, -0.74, 0.78, 0.038], [0, -0.80, 0.60, 0.036], [0, -0.86, 0.44, 0.034], [0, -0.90, 0.32, 0.032], [0, -0.95, 0.22, 0.031], [0, -1.02, 0.17, 0.03], [0, -1.09, 0.17, 0.03], [0, -1.15, 0.20, 0.03], [0, -1.20, 0.25, 0.028]], 4,
          { back: [0, -0.56, 0.90], tip: [0, -1.23, 0.29] }),
      ],
      // the TEAR MARKS: the brow-cheek and cheek-jowl slots dark from the eye band down to the muzzle
      craniumBandGroups: {
        'st3-st4': ['Snout', 'Snout', 'Brow', 'Cheek', 'Jowl', 'Palate'],
        'st4-st5': ['Snout', 'Snout', 'Snout', 'Brow', 'Jowl', 'Palate'],
      },
      headScale: 0.9, muzzleW: 1.05, muzzleLen: 0.6, earH: 0.75, earR: [0.034, 0.036, 0.03, 0.018],
    };
  })(),
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  lion: { common: 'lion', aliases: ['african lion'], sci: 'Panthera leo', size: '1.20 m at the shoulder (adult male)', source: 'Haas, Hayssen & Krausman 2005, Mammalian Species 762' },
  cougar: { common: 'cougar', aliases: ['puma', 'mountain lion', 'catamount'], sci: 'Puma concolor', size: '0.70 m at the shoulder', source: 'Nowell & Jackson 1996, Wild Cats (IUCN)' },
  houseCat: { common: 'cat', aliases: ['house cat', 'domestic cat', 'kitty', 'kitten', 'tabby'], sci: 'Felis catus', size: '0.25 m at the shoulder; head-body ~0.46 m', source: 'Sunquist & Sunquist 2002, Wild Cats of the World' },
  tiger: { common: 'tiger', aliases: ['bengal tiger'], sci: 'Panthera tigris tigris', size: '~1.0 m at the shoulder (adult male)', source: 'Mazák 1981, Mammalian Species 152' },
  leopard: { common: 'leopard', aliases: ['panther'], sci: 'Panthera pardus', size: '~0.65 m at the shoulder', source: 'Nowell & Jackson 1996, Wild Cats (IUCN)' },
  cheetah: { common: 'cheetah', aliases: [], sci: 'Acinonyx jubatus', size: '~0.80 m at the shoulder', source: 'Krausman & Morales 2005, Mammalian Species 771' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  jaguar: { near: 'leopard', aliases: [], note: 'stockier than the leopard, a bigger head, rosettes with a centre spot' },
  lynx: { near: 'cougar', aliases: ['bobcat'], note: 'a short bobbed tail, ear tufts, a facial ruff' },
};
