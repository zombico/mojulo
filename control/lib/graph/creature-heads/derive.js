/**
 * HEAD DERIVATIONS: a species' head re-drawn from the nearest library skull by MOVING ITS ROWS, the way the creature
 * loop's designers draw one (a felid is the wolf's skull with the muzzle pulled in and the eyes brought to the face; a
 * beak is the wolf's muzzle drawn to a point; an insect's face is the bear's skull shortened and pitched down). The rows
 * keep their names and slots, so every region, skin map, expression and ornament addressed by station and slot still
 * lands: the eyes, brows, folds, tiles and teeth ride the rows they sit on.
 *
 *   HEAD_DERIVATIONS   id → { from, reads, head, serves, units, moves, eye?, regions?, ornaments?, palette? }
 *   deriveHead(base, D)  the base head plan (a fresh copy) re-drawn by D: a new plan, the base untouched
 *
 * moves (in order, on the cranium and the jaw; y runs back → front, z down → up, x out from the midline):
 *   { op: 'length', k, about }               every row's y (and both caps) scaled about `about`
 *   { op: 'skull', pivot, width, height, back }   rows behind `pivot`: x × width, the crown's z × height; the back cap × back
 *   { op: 'muzzle', pivot, length, width, height }  rows past `pivot`: their distance from it × length; x × width and
 *                                              z about the row's middle × height, eased in over the first 0.1
 *   { op: 'taper', from, x, z }              rows past `from` drawn to a point: x and the height above the mouth line
 *                                              shrink toward × x and × z at the tip (a beak)
 *   { op: 'drop', from, z }                  rows past `from` lowered by up to z at the tip (a face pitched down)
 *
 * eye: { shift: [ds, dt], R?, ...the head's `eye` words } moves the eye with its brow and the wrinkles round it.
 * regions: shallow over the base's (null removes one). ornaments: { drop: [name | kind], add: [...] } (`set` by name).
 * palette: the derived head's own groups (a beak, mandibles), a neutral reading the character's colours go over.
 */
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/** the slots a row carries: a scalar (z on the midline) or [x, z] */
function mapRow(S, fn) { return Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Array.isArray(v) ? fn(k, v[0], v[1]) : fn(k, null, v)[1]])); }
const MID = { cranium: ['top', 'palate'], jaw: ['gum', 'bottom'] };
const midOf = (part, S) => { const [a, b] = MID[part]; return (S[a] + S[b]) / 2; };
const lineOf = (part, S) => S[MID[part][part === 'cranium' ? 1 : 0]];

function moveRows(plan, M) {
  for (const part of ['cranium', 'jaw']) {
    const P = plan.parts[part]; if (!P) continue;
    const tipY = P.caps?.tip?.[1] ?? P.rows[P.rows.length - 1][1];
    P.rows = P.rows.map(([n, y, S]) => {
      let y2 = y, S2 = S;
      if (M.op === 'length') y2 = M.about + (y - M.about) * M.k;
      else if (M.op === 'skull' && y <= M.pivot + 0.1) {
        const e = 1 - ease((y - M.pivot) / 0.1);
        S2 = mapRow(S, (k, x, z) => [x === null ? null : r4(x * (1 + ((M.width ?? 1) - 1) * e)), z > 0 ? r4(z * (1 + ((M.height ?? 1) - 1) * e)) : z]);
      } else if (M.op === 'muzzle' && y > M.pivot) {
        const e = ease((y - M.pivot) / 0.1), mid = midOf(part, S);
        y2 = M.pivot + (y - M.pivot) * (M.length ?? 1);
        S2 = mapRow(S, (k, x, z) => [x === null ? null : r4(x * (1 + ((M.width ?? 1) - 1) * e)), r4(mid + (z - mid) * (1 + ((M.height ?? 1) - 1) * e))]);
      } else if (M.op === 'taper' && y > M.from) {
        const f = clamp01((y - M.from) / (tipY - M.from)), line = lineOf(part, S);
        const sx = 1 + (M.x - 1) * f, sz = 1 + (M.z - 1) * f;
        S2 = mapRow(S, (k, x, z) => [x === null ? null : r4(x * sx), r4(line + (z - line) * sz)]);
      } else if (M.op === 'drop' && y > M.from) {
        const f = clamp01((y - M.from) / (tipY - M.from));
        S2 = mapRow(S, (k, x, z) => [x, r4(z - M.z * f)]);
      }
      return [n, r4(y2), S2];
    });
    const caps = P.caps && { ...P.caps };
    if (caps?.tip) {
      const [cx, cy, cz] = caps.tip;
      if (M.op === 'length') caps.tip = [cx, r4(M.about + (cy - M.about) * M.k), cz];
      else if (M.op === 'muzzle') caps.tip = [cx, r4(M.pivot + (cy - M.pivot) * (M.length ?? 1)), cz];
      else if (M.op === 'taper') { const last = P.rows[P.rows.length - 1][2]; caps.tip = [cx, cy, r4(lineOf(part, last) + (cz - lineOf(part, last)) * M.z)]; }
      else if (M.op === 'drop') caps.tip = [cx, cy, r4(cz - M.z)];
    }
    if (caps?.back) {
      const [bx, by, bz] = caps.back;
      if (M.op === 'length') caps.back = [bx, r4(M.about + (by - M.about) * M.k), bz];
      else if (M.op === 'skull' && M.back) caps.back = [bx, r4(by * M.back), bz];
    }
    if (caps) P.caps = caps;
  }
  if (M.op === 'length' && plan.landmarks?.nape) plan.landmarks.nape = [plan.landmarks.nape[0], r4(M.about + (plan.landmarks.nape[1] - M.about) * M.k), plan.landmarks.nape[2]];
}

const near = (p, at, d) => Math.abs(p[0] - at[0]) <= d && Math.abs(p[1] - at[1]) <= d;
const shifted = (strip, [ds, dt]) => strip.map(([s, t]) => [r4(s + ds), r4(t + dt)]);

/** Re-draw a head plan by a derivation. → a new plan (the base is not touched) */
export function deriveHead(base, D) {
  const plan = structuredClone(base);
  plan.name = D.name ?? plan.name;
  if (D.units) plan.units = { ...plan.units, ...D.units };
  for (const M of D.moves || []) moveRows(plan, M);
  if (D.eye) {
    const { shift = [0, 0], R, ...words } = D.eye, at0 = plan.regions.eye.at;
    plan.regions.eye = { ...plan.regions.eye, at: shifted([at0], shift)[0], ...(R ? { R } : {}) };
    if (plan.regions.brow?.strip) plan.regions.brow = { ...plan.regions.brow, strip: shifted(plan.regions.brow.strip, shift) };
    // the wrinkles round the eye (the frown, the crow's feet) move with it; the muzzle's stay
    if (Array.isArray(plan.regions.wrinkles)) plan.regions.wrinkles = plan.regions.wrinkles.map((w) => (w.strip.some((p) => near(p, at0, 1.1)) ? { ...w, strip: shifted(w.strip, shift) } : w));
    plan.eye = { ...plan.eye, ...words };
  }
  for (const [k, v] of Object.entries(D.regions || {})) {
    if (v === null) delete plan.regions[k];
    else plan.regions[k] = Array.isArray(v) || typeof v !== 'object' || !plan.regions[k] || Array.isArray(plan.regions[k]) ? v : { ...plan.regions[k], ...v };
  }
  if (D.ornaments) {
    const { drop = [], add = [], set = {}, teeth } = D.ornaments;
    plan.ornaments = (plan.ornaments || []).filter((o) => !drop.includes(o.name) && !drop.includes(o.kind))
      .map((o) => (o.name && set[o.name] ? { ...o, ...set[o.name] } : o))
      .map((o) => (o.kind === 'teeth' && teeth ? { ...o, sizes: o.sizes.map((s) => r4(s * teeth)) } : o));
    plan.ornaments.push(...add);
  }
  if (D.palette) plan.palette = { ...plan.palette, ...D.palette };
  return plan;
}

/** the cat's ear: a broad flat triangle high on the skull (the wolf's leaf ear is edge-on from the front and reads as a horn) */
const CAT_EAR = { kind: 'sweep', name: 'ear', at: [1.35, 0.85], space: 'local', spine: [[0, 0, -0.01], [0, -0.005, 0.04], [0, -0.012, 0.085], [0, -0.02, 0.125]], radii: [0.072, 0.052, 0.022], m: 8, squash: [0.28, 1], group: 'Ears' };

/** a person's ear, small and close to the head (a dead face keeps its ears; a skull has none) */
const HUMAN_EAR = { kind: 'sweep', name: 'ear', at: [1.3, 2.7], space: 'local', spine: [[0, 0, -0.008], [0, -0.004, 0.018], [0, -0.008, 0.04]], radii: [0.03, 0.026, 0.012], m: 8, squash: [0.3, 1], group: 'Ears' };
// a person's skull from the bear's: the face drawn back flat under a tall dome, the eyes brought round to the front
const HUMAN_SKULL_MOVES = [
  { op: 'length', k: 0.78, about: -0.04 },
  { op: 'skull', pivot: -0.02, width: 0.76, height: 1.0, back: 0.95 },
  { op: 'muzzle', pivot: -0.02, length: 0.16, width: 0.85, height: 1.2 },
];

// (the skull and the gaunt face are the SIXTH GENERATION's: drawn for the undead on the creature door, which stand on the
// tiered body now, lib/graph/undead, with their own skull and the landmark face; kept for the rows minted with them)
export const HEAD_DERIVATIONS = Object.freeze({
  skull: {
    from: 'bear', reads: 'a human skull: a tall dome, a flat face, empty sockets, the teeth bared', family: 'mammal', head: 'skull', serves: ['skeleton'],
    units: { scale: 0.66 },
    moves: HUMAN_SKULL_MOVES,
    // the sockets: a solid eye, dark, set deep in a wide orbit
    // (the lids pulled clear: an open orbit round a dark ball reads as the socket's hole)
    eye: { shift: [2.85, -0.85], R: 0.024, mode: 'solid', catchlight: false },
    regions: { orbit: { open: [0.97, 0.97], reach: [0.012, 0.016, 0.018], tuck: 0.004, bulk: [0.002, 0.004], thickness: 0.005 }, whiskers: null, tongue: null, tiles: [] },
    ornaments: { drop: ['ear', 'nose', 'ruff', 'cheekRuff'], teeth: 0.45 },
    palette: { Sclera: '#1e1b19', Iris: '#1e1b19', Pupil: '#1e1b19', Limbus: '#1e1b19', Teeth: '#e6e0cc' },
  },
  gaunt: {
    from: 'bear', reads: 'a dead face: the skull\'s shape under drawn flesh, sunken eyes, a nose and ears still on it, the jaw slack', family: 'mammal', head: 'gaunt face', serves: ['zombie'],
    units: { scale: 0.62 },
    moves: HUMAN_SKULL_MOVES,
    eye: { shift: [2.85, -0.85], R: 0.02 },
    regions: { orbit: { open: [0.55, 0.5], reach: [0.016, 0.02, 0.024], tuck: 0.006, bulk: [0.003, 0.008], thickness: 0.006 }, whiskers: null, tongue: null, tiles: [] },
    ornaments: { drop: ['ear', 'ruff', 'cheekRuff'], add: [HUMAN_EAR], set: { nose: { spine: [[0, 0, -0.004], [0, 0.006, 0.008], [0, 0.008, 0.014]], radii: [0.011, 0.008] } }, teeth: 0.4 },
  },
  felid: {
    from: 'wolf', reads: 'a cat: a round skull, a short muzzle, eyes brought to the face, broad ears high on the head', family: 'mammal', head: 'short muzzle', serves: ['feline'],
    units: { scale: 0.7 },
    moves: [
      { op: 'skull', pivot: -0.02, width: 1.09, height: 1.12, back: 0.98 },
      { op: 'muzzle', pivot: 0, length: 0.42, width: 1.4, height: 1.2 },
    ],
    eye: { shift: [0.2, -0.8], R: 0.026, pupil: 'slit' },
    regions: { orbit: { open: [0.45, 0.42] }, whiskers: { len: 0.085, droop: 0.15 }, tongue: { width: 0.06, thickness: 0.02 } },
    ornaments: { drop: ['ear'], add: [CAT_EAR], set: { nose: { spine: [[0, 0, -0.009], [0, 0, 0.009], [0, 0, 0.016]], radii: [0.017, 0.014] } }, teeth: 0.45 },
  },
  beaked: {
    from: 'wolf', reads: 'a bird: a small round skull, the muzzle drawn to a beak, round eyes set to the side', family: 'avian', head: 'beak', serves: ['avian'],
    units: { scale: 0.74 },
    moves: [
      { op: 'skull', pivot: -0.02, width: 0.8, height: 0.97, back: 0.9 },
      { op: 'muzzle', pivot: 0.05, length: 1.15, width: 0.9 },
      { op: 'taper', from: 0.05, x: 0.25, z: 0.25 },
    ],
    eye: { shift: [-0.2, 0.15], R: 0.024, irisAngle: 40 },
    regions: { orbit: { open: [0.42, 0.5] }, whiskers: null, tongue: null, nostril: { at: [3.55, 2.7], r: 0.006, squash: [2.4, 1], slide: 0.4 } },
    ornaments: { drop: ['ear', 'nose', 'teeth'] },
    // the beak in horn over the skin, its ridge darker (the snout bands are the beak)
    palette: { Snout: '#c9a650', Jowl: '#b8953f', Palate: '#7a6230', Jaw: '#b8953f', NosePad: '#3a3026' },
    keep: ['Snout', 'Jowl', 'Palate', 'Jaw'],
  },
  mandibled: {
    from: 'bear', reads: 'an insect: a short face pitched down, compound eyes, mandibles where the mouth is, short antennae', family: 'insect', head: 'mandibles', serves: ['insectoid'],
    units: { scale: 0.72 },
    moves: [
      { op: 'length', k: 0.6, about: 0.01 },
      { op: 'skull', pivot: -0.02, width: 0.92, height: 0.85 },
      { op: 'muzzle', pivot: 0.05, width: 0.85 },
      { op: 'drop', from: 0.02, z: 0.09 },
    ],
    eye: { shift: [0.45, -0.35], R: 0.048, mode: 'solid', catchlight: true },
    regions: { orbit: { open: [0.95, 0.95], reach: [0.006, 0.008, 0.008], tuck: 0.002, bulk: [0.002, 0.004], thickness: 0.005 }, whiskers: null, tongue: null, tiles: [], nostril: { r: 0.0025, squash: [1, 1], slide: 0.2 } },
    ornaments: {
      drop: ['ear', 'nose', 'teeth', 'ruff', 'cheekRuff'],
      add: [
        { kind: 'sweep', name: 'antenna', at: [3.6, 0.8], space: 'local', spine: [[0, 0, -0.004], [0, 0.012, 0.03], [0, 0.03, 0.055], [0, 0.045, 0.07], [0, 0.055, 0.078], [0, 0.062, 0.08]], radii: [0.007, 0.006, 0.006, 0.017, 0.015], m: 7, group: 'Antenna' },
        { kind: 'sweep', name: 'mandible', at: [5.4, 4.6], space: 'head', spine: [[0.05, 0.14, -0.18], [0.13, 0.19, -0.205], [0.12, 0.27, -0.22], [0.04, 0.31, -0.215]], radii: [0.02, 0.016, 0.008], m: 7, squash: [1.5, 0.7], group: 'Mandible' },
      ],
    },
    // a compound eye is one colour (the `solid` eye paints the ball in Sclera): the face's one hot accent
    palette: { Antenna: '#3a3428', Mandible: '#9a6a20', Sclera: '#e0761c', Catchlight: '#ffd27a' },
    keep: ['Mandible'],
  },
});
