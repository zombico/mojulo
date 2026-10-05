/** humanoid-head.js — a planar human head in the layered grammar. Anatomy stays in this recipe, not the compiler.
 * Core since face-tune; docs/examples/humanoid/head.mjs re-exports it.
 * Horizontal landmark rings make the forehead, eye plane, nose wedge and chin one designed surface.
 * Facial accents and hair are closed lofts pinned to that surface. Expressions are baked; jawOpen is live.
 */
import { compileLayered, pinFrame } from './station-loft.js';
import { address, frameAt, loftParts, strip, sweep, vec } from './station-loft-detail.js';
import { surfaceLocalOffset } from './surface-pin.js';
import { headLandmarks, HEAD_KNOB_DEFAULTS } from './figure-head.js';
import { DIMORPH } from './figure-rig.js';
import { r6 } from './station-loft-plan.js';
import { fittedAnchors, fittedCage, FACE_EXTRA_DEFAULTS } from './humanoid-head-fit.js';
import { ratioControls } from './ratio-controls.js';
import { HAIR_STYLE_NAMES, resolveHair, validateHair, buildHair } from './humanoid-hair.js';
import { earMesh } from './head-ear.js';
import * as dmath from '../../util/dmath.js';

const { add, mul, unit } = vec;
export const HEAD_PRESETS = { male: DIMORPH.male.head, female: DIMORPH.female.head };
/** the landmark cage's cranium width per pole: the female's is narrower than her landmarks alone make it */
export const HEAD_WIDTH = { male: 1, female: 0.92 };
/** where each head's rings come from: a head fitted to reference images (canonical, ./head-fit.mjs), or the
 * landmark cage on the figure's own skull landmarks (kept selectable) */
export const HEAD_SOURCES = { male: 'fit', female: 'fit' };
export const EXPRESSIONS = {
  neutral: { browRaise: 0, browTilt: 0, mouthCorner: 0, aperture: 1, jawOpen: 0 },
  smile: { browRaise: 0.001, browTilt: 0, mouthCorner: 0.006, aperture: 0.83, jawOpen: 0 },
  determined: { browRaise: -0.002, browTilt: 0.009, mouthCorner: -0.001, aperture: 0.75, jawOpen: 0 },
  surprised: { browRaise: 0.009, browTilt: 0, mouthCorner: 0, aperture: 1.3, jawOpen: 9 },
};
/** the hair library's style words (humanoid-hair.js), `none` included; `hair` takes a word, `{ style, …controls }` or a list */
export const HAIR_STYLES = HAIR_STYLE_NAMES;
export const FACE_VERSION = 3;
/** every head shape knob the landmark head takes: the figure's (figure-head.js) and the fitted head's own (face-tune) */
export const HEAD_SHAPE_DEFAULTS = Object.freeze({ ...HEAD_KNOB_DEFAULTS, ...FACE_EXTRA_DEFAULTS });
/** the FACE: the face proportion lab's controls as ratios about the fitted head (1 = the fit), grouped, with the lab's
 * two moves and its comfortable ranges; `neckGirth` is the body's (`body.neck`) and `earSize` has no fitted counterpart
 * beyond the pinned ear. One resolver with the body tune (ratio-controls.js). */
export const FACE_MOVES = Object.freeze({
  'broad-jaw': { note: 'a broader jaw with the chin brought forward', face: { jawWidth: 1.18, chinProjection: 1.08 } },
  'large-eyes': { note: 'larger eyes set a little wider', face: { eyeSize: 1.15, eyeSpacing: 1.05 } },
});
export const FACE = ratioControls({
  label: 'face',
  groups: { skull: ['skullWidth', 'faceWidth', 'faceLength'], brow: ['browHeight', 'browRidge', 'foreheadSlope'], eyes: ['eyeSpacing', 'eyeSize'],
    cheeks: ['cheekbone', 'cheek'], nose: ['noseWidth', 'noseSize', 'noseDroop'], mouth: ['mouthWidth'], jaw: ['jawWidth', 'chinProjection', 'chinPoint'], ears: ['earSize'] },
  moves: FACE_MOVES,
  // faceLength's floor is 0.92, not the lab's 0.9: below it the female's fitted jaw folds (winding errors), measured
  ranges: { skullWidth: [0.85, 1.15], faceWidth: [0.85, 1.15], faceLength: [0.92, 1.15], jawWidth: [0.8, 1.25], chinProjection: [0.8, 1.2], cheek: [0.8, 1.2],
    eyeSpacing: [0.85, 1.15], eyeSize: [0.85, 1.2], browHeight: [0.85, 1.15], noseWidth: [0.8, 1.25], noseSize: [0.85, 1.2], mouthWidth: [0.8, 1.2] },
});
export const { KEYS: FACE_KEYS, GROUPS: FACE_GROUPS, AGGREGATE_KEYS: FACE_AGGREGATE_KEYS, RANGES: FACE_RANGES, MOVE_NAMES: FACE_MOVE_NAMES } = FACE;
/** a face spec (a move, an object, a list) → every shape knob at its ratio, `from` when a move named it */
export const resolveFace = FACE.resolve;
export const validateFace = (spec, label = 'face') => FACE.validate(spec, label);
export const faceWarnings = FACE.warnings;
export const HEAD_REGISTERS = {
  lowpoly: { plane: 0, eyeSides: 8 }, round: { plane: 0, eyeSides: 12 },
  chamfer: { plane: 0.55, eyeSides: 8 }, box: { plane: 1, eyeSides: 8 },
};
// Three central edge pairs make the nose independent of the broad face plane.
// `bridge` bounds the dorsal plane, `nose` is the outer sidewall anchor, and
// `ala` is the nostril wing. Crucially, `inner` remains the orbit / cheek anchor
// and no longer determines whether the visible nose tapers in the right direction.
const SLOTS = ['front', 'bridgeR', 'noseR', 'alaR', 'innerR', 'outerR', 'sideR', 'rearR', 'back',
  'rearL', 'sideL', 'outerL', 'innerL', 'alaL', 'noseL', 'bridgeL'];
/** Vajra skull landmarks in the hero's metre frame, with the same atlas/menton offset as headRings.
 * Their relationships drive the planar cage; the SDF is not sampled and no core kernel changes.
 */
export function humanoidAnchors(preset = 'male', knobs = {}) {
  if (!HEAD_PRESETS[preset]) throw new Error(`humanoid: unknown head preset '${preset}'`);
  if (HEAD_SOURCES[preset] === 'fit') return fittedAnchors(preset, { ...HEAD_SHAPE_DEFAULTS, ...knobs });
  const l = headLandmarks(HEAD_PRESETS[preset], knobs);
  return Object.fromEntries(Object.entries(l).filter(([, p]) => p && typeof p === 'object').map(([k, p]) =>
    [k, [p.x * 1.8, p.y * 1.8, (p.z - 0.033) * 1.8]]));
}
function landmarkRows(a, pole, knobs) {
  const width = Math.abs(a.tragionR[0]) + 0.010;
  const cheek = Math.abs(a.zygionR[0]) + 0.022;
  const jaw = Math.abs(a.gonionR[0]) + 0.017;
  const eyeY = a.eyeR[1] - 0.003;
  const browY = eyeY + 0.0015 * pole.brow * knobs.browRidge;
  // columns: z, half width, front, back, nose projection, ORBIT (the inner slot's y as a fraction of the front:
  // < 1 sinks the eye socket under the brow), CHEEK (the outer slot's y as a fraction of the front), then the
  // widths and depths of the BRIDGE, outer NOSE SIDE and ALA edges. The two lower rows carry a small projection after the
  // nose itself ends: together they make the trapezoidal philtrum and upper-mouth planes seen in three-quarter.
  // The cheek column is the cheek PLANE:
  // it stands furthest forward at the eye row (the zygomatic, the cheekbone) and recedes row by row down to the
  // mouth, so in profile the face is a diagonal from cheekbone to chin, not a vertical wall meeting the jaw in an L
  return [
    [a.stomion[2] - 0.005, jaw, a.stomion[1] - 0.008, 0.052, 0.0015, 0.94, 0.72, 0.035, 0.05, 0.07, 0.40, 1, 0.60, 0.35],
    [a.subnasale[2] - 0.003, cheek * 0.96, a.subnasale[1] - 0.009, 0.080, 0.005, 0.92, 0.77, 0.05, 0.18, 0.28, 0.42, 1, 0.86, 0.58],
    [a.noseTip[2], cheek, eyeY - 0.004, 0.082, a.noseTip[1] + 0.003 - (eyeY - 0.004), 0.98, 0.85, 0.045, 0.14, 0.22, 0.30, 1, 0.92, 0.78],
    [a.noseBridge[2], cheek, eyeY, 0.091, a.noseBridge[1] + 0.002 - eyeY, 1, 0.94, 0.04, 0.075, 0.095, 0.20, 1, 0.86, 0.64],
    [a.eyeR[2], width, eyeY, 0.095, Math.max(0, a.nasion[1] - eyeY) + 0.006, 0.995, 0.98, 0.03, 0.045, 0.06, 0.15, 1, 0.82, 0.48],
    [a.glabella[2], width, browY, 0.096, 0, 1, 0.96],
    [a.frontal[2] + 0.019, width * 0.98, a.frontal[1] + 0.086, 0.093, 0, 1, 0.87],
    [a.crown[2] - 0.022, width * 0.80, 0.068, 0.077, 0, 1, 0.87],
    [a.crown[2], width * 0.39, 0.028, 0.038, 0, 1, 0.87],
  ];
}
const tint = (hex, factor) => '#' + hex.slice(1).match(/../g).map(h => Math.min(255, Math.round(parseInt(h, 16) * factor)).toString(16).padStart(2, '0')).join('');
export function headPalette(skin = '#d9a77e', hair = '#3b291e', overrides = {}) {
  return { Skin: skin, Lid: tint(skin, 0.68), Lip: tint(skin, 0.96), Mouth: '#6b4438', Brow: hair, Hair: hair,
    HairAlt: tint(hair, 1.13), Sclera: '#f5eee2', Iris: '#426479', Pupil: '#152532',
    EarInner: tint(skin, 0.88), Nostrils: tint(skin, 0.50), ...overrides };
}
const round = p => p.map(r6);
function rings(rows, shape, register, group = 'Skin') {
  const stations = rows.map(([z, width, front, back, nose = 0, orbit = 1, cheek = 0.87,
    bridgeWidth = 0.05, noseWidth = 0.08, alaWidth = 0.12, joinWidth = 0.40,
    bridgeDepth = 1, noseDepth = 0.82, alaDepth = 0.55], i) => {
    const lower = Math.max(0, 1 - (z + 0.02) / 0.09);
    const w = width * shape.width * (1 + (shape.jaw - 1) * lower);
    const plane = register.plane;
    // The front-to-bridge band is the dorsal plane. The bridge-to-nose band is
    // the sidewall; nose-to-ala turns under the tip; ala-to-inner returns to the
    // face. The sidewall and ala widths grow down the rows, reversing the old keel.
    const projection = nose * shape.nose;
    const half = [[0, front + projection * bridgeDepth, z],
      [w * bridgeWidth, front + projection * Math.max(0, bridgeDepth - 0.025), z],
      [w * noseWidth * shape.ala, front + projection * noseDepth, z],
      [w * alaWidth * shape.ala, front + projection * alaDepth, z], [w * joinWidth, front * orbit, z],
      [w * (0.79 + plane * 0.13), front * (cheek + plane * 0.07), z],
      [w, 0.005, z], [w * (0.76 + plane * 0.16), -back * 0.78, z], [0, -back, z]];
    return { id: `st${i}`, points: Object.fromEntries(SLOTS.map((slot, k) => {
      const n = SLOTS.length, mid = n / 2, p = half[k <= mid ? k : n - k];
      return [slot, round([k > mid ? -p[0] : p[0], p[1], p[2]])];
    })) };
  });
  return { layer: 1, closure: 'closed', slots: SLOTS, stations, group,
    caps: { back: [0, 0, rows[0][0] - 0.001], tip: [0, 0, rows.at(-1)[0] + 0.006] } };
}
/** Closed stations from ready-made ring points (a fitted surface's rows). */
function fittedRings(stationPoints, rowsZ, top) {
  const stations = stationPoints.map((points, i) => ({ id: `st${i}`, points: structuredClone(points) }));
  return { layer: 1, closure: 'closed', slots: SLOTS, stations, group: 'Skin',
    caps: { back: [0, 0, r6((rowsZ[0] ?? stationPoints[0].front[2]) - 0.001)], tip: top ? [0, top[1], r6(top[2])] : [0, 0, r6(stationPoints.at(-1).front[2] + 0.006)] } };
}
/** Bake world-space loft points into one surface pin. Only the recipe owns anatomical numbers. */
function detail(carrier, parent, at, side, mesh, group, labels) {
  const pin = address(carrier, parent, at[0], at[1], side), frame = pinFrame(carrier[parent], pin);
  return { layer: 2, closure: 'closed', pin, group,
    offsets: Object.fromEntries(Object.entries(mesh.points).map(([id, p]) => [id, round(surfaceLocalOffset(frame, p))])),
    faces: Object.fromEntries(mesh.faces.map((f, i) => [`f${i}`, f])),
    ...(labels ? { groups: Object.fromEntries(labels.map((g, i) => [`f${i}`, g])) } : {}) };
}
// A shallow almond, embedded at its border. Width/height/depth are independent; no protruding eyeball.
function oval(origin, rx, rz, depth, sides, normal = [0, 1, 0]) {
  const across = unit([normal[1], -normal[0], 0]);
  const ring = (scale, d) => Array.from({ length: sides }, (_, i) => {
    const a = i * 2 * Math.PI / sides;
    return add(add(origin, mul(normal, d)), add(mul(across, dmath.cos(a) * rx * scale), [0, 0, dmath.sin(a) * rz * scale]));
  });
  return loftParts([ring(0.88, -0.0015), ring(1, 0), ring(0.98, depth * 0.8)], add(origin, mul(normal, -0.002)), add(origin, mul(normal, depth)));
}
// A low triangular opening for the nostril seen from below. Unlike an oval
// painted on the sidewall, this reads as one of the alar underside facets.
function nostrilFacet(origin, rx, rz, depth, normal) {
  const across = unit([normal[1], -normal[0], 0]);
  const ring = (scale, d) => [[-rx, rz * 0.38], [rx, rz * 0.38], [0, -rz]].map(([x, z]) =>
    add(add(origin, mul(normal, d)), add(mul(across, x * scale), [0, 0, z * scale])));
  return loftParts([ring(0.82, -0.0005), ring(1, 0), ring(0.9, depth)],
    add(origin, mul(normal, -0.0012)), add(origin, mul(normal, depth + 0.0004)));
}
export function humanoidHead({ preset = 'male', shape = {}, register = 'lowpoly', hair = 'swept',
  scale = 1, skin = '#d9a77e', hairColor = '#3b291e', palette = {}, expression = 'neutral' } = {}) {
  if (!HEAD_PRESETS[preset]) throw new Error(`humanoid: unknown head preset '${preset}'`);
  if (!HEAD_REGISTERS[register]) throw new Error(`humanoid: unknown register '${register}'`);
  const hairErrors = validateHair(hair); if (hairErrors.length) throw new Error(`humanoid: ${hairErrors.join('; ').replace(/unknown style/g, 'unknown hair style')}`);
  if (!EXPRESSIONS[expression]) throw new Error(`humanoid: unknown expression '${expression}'`);
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error('humanoid: head scale must be positive');
  for (const [k, v] of Object.entries(shape)) if (!(k in HEAD_SHAPE_DEFAULTS) || !(Number.isFinite(v) && v > 0)) throw new Error(`humanoid: invalid head shape '${k}' (have ${Object.keys(HEAD_SHAPE_DEFAULTS).join(', ')})`);
  const knobs = { ...HEAD_SHAPE_DEFAULTS, ...shape }, pole = HEAD_PRESETS[preset];
  const fit = HEAD_SOURCES[preset] === 'fit', anchors = humanoidAnchors(preset, knobs);
  const rows = fit ? null : landmarkRows(anchors, pole, knobs);
  const sh = { width: HEAD_WIDTH[preset], jaw: 1, nose: 1.05,
    ala: pole.noseWidth * knobs.noseWidth, eye: knobs.eyeSize, brow: Math.sqrt(pole.brow) * knobs.browRidge, mouth: knobs.mouthWidth };
  const reg = HEAD_REGISTERS[register], ex = EXPRESSIONS[expression];
  // A fitted head owns its planes: its rows are read off the fitted surface, so the register only sets the eye sides.
  const cage = fit ? fittedCage(preset, knobs, SLOTS) : null;
  const rowZ = fit ? cage.rowsZ : rows.map((r) => r[0]);
  const cranium = fit ? fittedRings(cage.cranium, cage.rowsZ, cage.crown) : rings(rows, sh, reg);
  // The skull/jaw boundary follows the mandibular angle up to the condyles. It is not a
  // horizontal puppet cut: the mouth opens at the front while the hinge remains by the ear.
  for (let i = 0; i < 4; i++) {
    const st = cranium.stations[i];
    for (const side of ['R', 'L']) {
      // The fitted cheek already runs its side column up the ramus; only the landmark cage lifts it.
      if (!fit) st.points[`side${side}`][2] = Math.max(rowZ[i], anchors.gonionR[2] + 0.014 + i * 0.009);
      if (!(fit && cage.earConnected)) st.points[`rear${side}`][2] = Math.max(rowZ[i], anchors.condyleR[2] - 0.004 + i * 0.006);
    }
    st.points.back[2] = Math.max(rowZ[i], anchors.condyleR[2] - 0.004 + i * 0.006);
  }
  // Expressions displace connected flesh, not only the dark feature strips. Localized weights
  // leave the back of the skull fixed and preserve the names every pinned detail reads.
  for (const st of cranium.stations) for (const [slot, p] of Object.entries(st.points)) {
    const side = /R$|L$/.test(slot), ax = Math.abs(p[0]);
    const cheekWeight = Math.max(0, 1 - Math.abs(p[2] - anchors.cheekR[2]) / 0.065) * Math.min(1, ax / 0.045);
    if (side && ['innerR', 'innerL', 'outerR', 'outerL'].includes(slot)) {
      p[2] += ex.mouthCorner * cheekWeight * 0.75;
      p[1] += Math.max(0, ex.mouthCorner) * cheekWeight * 0.35;
      const browWeight = Math.max(0, 1 - Math.abs(p[2] - anchors.glabella[2]) / 0.038);
      p[2] += ex.browRaise * browWeight * 0.65;
    }
  }
  const chinWidth = 0.044 * Math.sqrt(pole.chinSize / (pole.chinPoint * knobs.chinPoint));
  const jaw = fit ? fittedRings([...cage.jaw, cage.cranium[0]], []) : rings([[anchors.menton[2], chinWidth, anchors.menton[1] + 0.018, 0.018],
    [anchors.menton[2] + 0.012, rows[0][1] * 0.78, anchors.stomion[1] - 0.009, 0.035],
    rows[0]], sh, reg);
  // The lower mandibular edge climbs from the chin to the ear. A horizontal
  // bottom ring otherwise leaves a rectangular block hanging behind the chin.
  // The fitted jawline already climbs; only its hinge-side points rise to the condyle.
  if (fit) for (let i = 0, n = cage.jaw.length; i < n; i++) {
    const points = jaw.stations[i].points, lift = anchors.condyleR[2] - 0.016 + i * 0.012 / n;
    // With the jaw meeting the ear, its rear column is the ramus's back edge (head-fit.mjs), never lifted here.
    if (!cage.earConnected) for (const side of ['R', 'L']) points[`rear${side}`][2] = lift;
    points.back[2] = lift;
  }
  else for (let i = 0; i < 2; i++) {
    const points = jaw.stations[i].points;
    for (const side of ['R', 'L']) {
      points[`outer${side}`][2] += 0.010;
      points[`side${side}`][2] = anchors.gonionR[2] - 0.007 + i * 0.010;
      points[`rear${side}`][2] = anchors.condyleR[2] - 0.016 + i * 0.006;
    }
    points.back[2] = anchors.condyleR[2] - 0.016 + i * 0.006;
  }
  jaw.caps.back = [0, 0.025, anchors.menton[2] + 0.020];
  // Two coincident boundary rings hide the construction seam; both parts remain individually closed.
  jaw.stations.at(-1).points = structuredClone(cranium.stations[0].points);
  jaw.caps.tip = [0, anchors.condyleR[1], anchors.condyleR[2]];
  cranium.capGroups = { back: 'Mouth', tip: 'Skin' }; jaw.capGroups = { back: 'Skin', tip: 'Mouth' };
  const dials = { jawOpen: { min: 0, max: 25, rest: ex.jawOpen, doc: 'Jaw opening in degrees',
    op: 'hinge', part: 'jaw', pivot: 'jaw/tip', axis: 'x', sign: -1 } };
  const recipe = { parts: { cranium, jaw }, dials: {}, creases: {} };
  const carrier = compileLayered(recipe).parts;
  const parts = recipe.parts;
  // V3 derives the mouth from the nose: its authored spine is 1.75 times
  // the alar half-width, while the cupid peaks sit inside those corners.
  const mouthRow = cranium.stations[0].points, alarHalf = cranium.stations[1].points.alaR[0];
  const mouthHalf = alarHalf * 1.75 * sh.mouth;
  const frontSlots = ['front', 'bridgeR', 'noseR', 'alaR', 'innerR', 'outerR'];
  const tAtX = (x) => {
    let i = 0; while (i < frontSlots.length - 2 && x > mouthRow[frontSlots[i + 1]][0]) i++;
    const a = mouthRow[frontSlots[i]][0], b = mouthRow[frontSlots[i + 1]][0];
    return i + Math.max(0, Math.min(1, (x - a) / (b - a)));
  };
  const mouthT = tAtX(mouthHalf), cupidT = tAtX(alarHalf * 0.72);
  for (const side of ['R', 'L']) {
    const sign = side === 'R' ? 1 : -1;
    const eyeRow = cranium.stations[4].points, eyeX = Math.abs(anchors.eyeR[0]);
    const eyeT = 4 + Math.max(0, Math.min(1, (eyeX - eyeRow.innerR[0]) / (eyeRow.outerR[0] - eyeRow.innerR[0])));
    const at = [4, eyeT], f = frameAt(carrier, 'cranium', at, side);
    const normal = unit([f.normal[0], f.normal[1], 0]);
    const origin = add(f.origin, mul(normal, 0.002));
    parts[`eye${side}`] = detail(carrier, 'cranium', at, side, oval(origin, 0.018 * sh.eye, 0.0105 * ex.aperture * sh.eye, 0.0009, reg.eyeSides, normal), 'Sclera');
    parts[`iris${side}`] = detail(carrier, 'cranium', at, side, oval(add(origin, mul(normal, 0.0010)), 0.0085 * sh.eye, 0.0095 * ex.aperture * sh.eye, 0.001, reg.eyeSides, normal), 'Iris');
    parts[`pupil${side}`] = detail(carrier, 'cranium', at, side, oval(add(origin, mul(normal, 0.0021)), 0.0044 * sh.eye, 0.006 * ex.aperture * sh.eye, 0.0005, 8, normal), 'Pupil');
    const across = unit([normal[1], -normal[0], 0]);
    const lidSpine = [[-0.018, 0], [-0.012, 0.0075], [0, 0.0105], [0.012, 0.0075], [0.018, 0]].map(([x, z]) =>
      add(add(origin, mul(normal, 0.0015)), add(mul(across, x * sh.eye), [0, 0, z * ex.aperture * sh.eye])));
    const lid = sweep(lidSpine, [0.0007, 0.0010, 0.0011, 0.0008], 4);
    parts[`lid${side}`] = detail(carrier, 'cranium', at, side, lid, 'Lid');
    const addrs = [[5.12, 3.8], [5.24, 4.15], [5.20, 4.65], [5.08, 4.95]];
    const brow = strip(carrier, 'cranium', addrs, side, j => {
      const w = 0.0037 * sh.brow * [0.65, 1, 0.9, 0.35][j];
      return [[-w, -0.0008], [-w, 0.0015], [w, 0.0015], [w, -0.0008]];
    });
    for (const p of Object.values(brow.points)) p[2] += ex.browRaise + ex.browTilt * (Math.abs(p[0]) / 0.065 - 0.6);
    parts[`brow${side}`] = detail(carrier, 'cranium', [4.95, 2.2], side, brow, 'Brow');
    const earAt = [3.7, 6], ef = frameAt(carrier, 'cranium', earAt, side);
    // the ear (head-ear.js): its side shape and the volume inside, the bowl in the darker EarInner
    const ear = earMesh({ origin: add(ef.origin, [0.003 * sign, 0.003, -0.004]), side: sign, height: 0.054, width: 0.97, style: 'western', lift: 0.2, inner: 'EarInner', sparse: register === 'lowpoly' });
    parts[`ear${side}`] = detail(carrier, 'cranium', earAt, side, ear, 'Skin', ear.groups);
    // Tuck each nostril into the underside band between the flat tip and the ala.
    const nostrilAt = [1.38, 2.55], nf = frameAt(carrier, 'cranium', nostrilAt, side);
    parts[`nostril${side}`] = detail(carrier, 'cranium', nostrilAt, side,
      nostrilFacet(add(nf.origin, mul(nf.normal, 0.0008)), 0.0044, 0.0022, 0.0004, nf.normal), 'Nostrils');
    const lipAddrs = [[0.18, 0.03], [0.31, cupidT], [0.24, 2.05], [0.17, mouthT]];
    const upperLip = strip(carrier, 'cranium', lipAddrs, side,
      j => { const w = [0.0014, 0.0023, 0.0021, 0.0013][j]; return [[-w, 0.0012], [-w, 0.0022], [w, 0.0022], [w, 0.0012]]; });
    for (const p of Object.values(upperLip.points)) p[2] += ex.mouthCorner * Math.min(1, Math.abs(p[0]) / mouthHalf);
    parts[`upperLip${side}`] = detail(carrier, 'cranium', [0.22, 1.5], side, upperLip, 'Lip');
    const mouth = strip(carrier, 'cranium', [[0.12, 0.03], [0.13, cupidT], [0.13, 2.05], [0.12, mouthT]], side,
      j => [[-0.0008, 0.0013], [-0.0008, 0.0023], [0.0008, 0.0023], [0.0008, 0.0013]]);
    for (const p of Object.values(mouth.points)) p[2] += ex.mouthCorner * Math.min(1, Math.abs(p[0]) / 0.031);
    parts[`mouth${side}`] = detail(carrier, 'cranium', [0.18, 1.1], side, mouth, 'Mouth');
  }
  // hair: the library's closed masses (humanoid-hair.js), each pinned at the crown; the perimeter follows the skull by address
  const H = resolveHair(hair);
  const grown = buildHair(carrier, H, { crown: anchors.crown, menton: anchors.menton, occiput: cranium.stations[7].points.back, anchors });
  for (const [name, mesh] of Object.entries(grown.meshes)) parts[name] = detail(carrier, 'cranium', [7.2, 7], 'R', mesh, 'Hair');
  // Scale all carriers, pin-local detail distances and rig anchors together, once before placement.
  for (const p of Object.values(parts)) {
    if (p.layer === 1) {
      for (const st of p.stations) for (const [k, v] of Object.entries(st.points)) st.points[k] = round(mul(v, scale));
      for (const [k, v] of Object.entries(p.caps)) p.caps[k] = round(mul(v, scale));
    } else for (const [k, v] of Object.entries(p.offsets)) p.offsets[k] = round(mul(v, scale));
  }
  return { name: 'head', parts, dials, creases: {}, palette: headPalette(skin, hairColor, palette),
    bind: { cranium: 'head', jaw: 'jaw' },
    joints: { jawHinge: [...jaw.caps.tip], jawTip: [...jaw.stations[0].points.front] },
    faceVersion: FACE_VERSION, expression, preset, register, hair: H, hairMeasures: grown.measures, scale, shape: knobs,
    landmarks: Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, round(mul(p, scale))])) };
}
