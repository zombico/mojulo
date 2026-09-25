/** A planar human head in the layered grammar. Anatomy stays in this recipe, not the compiler.
 * Horizontal landmark rings make the forehead, eye plane, nose wedge and chin one designed surface.
 * Facial accents and hair are closed lofts pinned to that surface. Expressions are baked; jawOpen is live.
 */
import { compileLayered, pinFrame } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { address, frameAt, loftParts, strip, sweep, vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
import { surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';
import { headLandmarks, HEAD_KNOB_DEFAULTS } from '../../../control/lib/graph/polygonizer/figure-head.js';
import { DIMORPH } from '../../../control/lib/graph/polygonizer/figure-rig.js';
import { r6 } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';

const { add, mul, unit } = vec;
export const HEAD_PRESETS = { male: DIMORPH.male.head, female: DIMORPH.female.head };
/** the cranium's width about the landmarks per pole: the female head is narrower than her landmarks alone make it */
export const HEAD_WIDTH = { male: 1, female: 0.92 };
export const EXPRESSIONS = {
  neutral: { browRaise: 0, browTilt: 0, mouthCorner: 0, aperture: 1, jawOpen: 0 },
  smile: { browRaise: 0.001, browTilt: 0, mouthCorner: 0.006, aperture: 0.83, jawOpen: 0 },
  determined: { browRaise: -0.002, browTilt: 0.009, mouthCorner: -0.001, aperture: 0.75, jawOpen: 0 },
  surprised: { browRaise: 0.009, browTilt: 0, mouthCorner: 0, aperture: 1.3, jawOpen: 9 },
};
export const HAIR_STYLES = ['crop', 'swept', 'bob', 'none'];
export const HEAD_REGISTERS = {
  lowpoly: { plane: 0, eyeSides: 8 }, round: { plane: 0, eyeSides: 12 },
  chamfer: { plane: 0.55, eyeSides: 8 }, box: { plane: 1, eyeSides: 8 },
};
const SLOTS = ['front', 'noseR', 'innerR', 'outerR', 'sideR', 'rearR', 'back', 'rearL', 'sideL', 'outerL', 'innerL', 'noseL'];
/** Vajra skull landmarks in the hero's metre frame, with the same atlas/menton offset as headRings.
 * Their relationships drive the planar cage; the SDF is not sampled and no core kernel changes.
 */
export function humanoidAnchors(preset = 'male', knobs = {}) {
  if (!HEAD_PRESETS[preset]) throw new Error(`humanoid: unknown head preset '${preset}'`);
  const l = headLandmarks(HEAD_PRESETS[preset], knobs);
  return Object.fromEntries(Object.entries(l).filter(([, p]) => p && typeof p === 'object').map(([k, p]) =>
    [k, [p.x * 1.8, p.y * 1.8, (p.z - 0.033) * 1.8]]));
}
function landmarkRows(a, pole, knobs) {
  const width = Math.abs(a.tragionR[0]) + 0.010;
  const cheek = Math.abs(a.zygionR[0]) + 0.022;
  const jaw = Math.abs(a.gonionR[0]) + 0.017;
  const eyeY = a.eyeR[1] - 0.003;
  const browY = eyeY + 0.008 * pole.brow * knobs.browRidge;
  // columns: z, half width, front, back, nose, ORBIT (the inner slot's y as a fraction of the front: < 1 sinks the eye
  // socket under the brow), CHEEK (the outer slot's y as a fraction of the front). The cheek column is the cheek PLANE:
  // it stands furthest forward at the eye row (the zygomatic, the cheekbone) and recedes row by row down to the
  // mouth, so in profile the face is a diagonal from cheekbone to chin, not a vertical wall meeting the jaw in an L
  return [
    [a.stomion[2] - 0.005, jaw, a.stomion[1], 0.052, 0, 1, 0.72],
    [a.subnasale[2] - 0.003, cheek * 0.98, a.subnasale[1], 0.080, 0, 1, 0.77],
    [a.noseTip[2], cheek, eyeY - 0.004, 0.082, a.noseTip[1] + 0.003 - (eyeY - 0.004), 1, 0.83],
    [a.noseBridge[2], cheek, eyeY, 0.091, a.noseBridge[1] + 0.006 - eyeY, 0.96, 0.91],
    [a.eyeR[2], width, eyeY, 0.095, a.nasion[1] - eyeY, 0.9, 0.95],
    [a.glabella[2], width, browY, 0.096, 0, 1, 0.9],
    [a.frontal[2] + 0.019, width * 0.98, a.frontal[1] + 0.079, 0.093, 0, 1, 0.87],
    [a.crown[2] - 0.022, width * 0.80, 0.068, 0.077, 0, 1, 0.87],
    [a.crown[2], width * 0.39, 0.028, 0.038, 0, 1, 0.87],
  ];
}
const tint = (hex, factor) => '#' + hex.slice(1).match(/../g).map(h => Math.min(255, Math.round(parseInt(h, 16) * factor)).toString(16).padStart(2, '0')).join('');
export function headPalette(skin = '#d9a77e', hair = '#3b291e', overrides = {}) {
  return { Skin: skin, Lid: tint(skin, 0.68), Lip: tint(skin, 0.86), Mouth: '#6b4438', Brow: hair, Hair: hair,
    HairAlt: tint(hair, 1.13), Sclera: '#f5eee2', Iris: '#426479', Pupil: '#152532',
    EarInner: tint(skin, 0.88), Nostrils: tint(skin, 0.50), ...overrides };
}
const round = p => p.map(r6);
function rings(rows, shape, register, group = 'Skin') {
  const stations = rows.map(([z, width, front, back, nose = 0, orbit = 1, cheek = 0.87], i) => {
    const lower = Math.max(0, 1 - (z + 0.02) / 0.09);
    const w = width * shape.width * (1 + (shape.jaw - 1) * lower);
    const plane = register.plane;
    // the nose wedge: the midline slot is the tip, the nose slot the ala at a tenth of the width (a narrow nose that
    // stands forward of the face), the next slot already on the face plane
    const half = [[0, front + nose * shape.nose, z], [w * 0.10, front + nose * shape.nose * 0.8, z], [w * 0.40, front * orbit, z],
      [w * (0.79 + plane * 0.13), front * (cheek + plane * 0.07), z],
      [w, 0.005, z], [w * (0.76 + plane * 0.16), -back * 0.78, z], [0, -back, z]];
    return { id: `st${i}`, points: Object.fromEntries(SLOTS.map((slot, k) => {
      const p = half[k <= 6 ? k : 12 - k]; return [slot, round([k > 6 ? -p[0] : p[0], p[1], p[2]])];
    })) };
  });
  return { layer: 1, closure: 'closed', slots: SLOTS, stations, group,
    caps: { back: [0, 0, rows[0][0] - 0.001], tip: [0, 0, rows.at(-1)[0] + 0.006] } };
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
    return add(add(origin, mul(normal, d)), add(mul(across, Math.cos(a) * rx * scale), [0, 0, Math.sin(a) * rz * scale]));
  });
  return loftParts([ring(0.88, -0.0015), ring(1, 0), ring(0.78, depth * 0.8)], add(origin, mul(normal, -0.002)), add(origin, mul(normal, depth)));
}
function hairMass(carrier, style) {
  // The perimeter follows the skull by address. The cap is continuous; large planes carry direction.
  const low = style === 'bob' ? [6.1, 6.1, 6.15, 5.8, 2.3, 0.7, 0.3] : [6.2, 6.2, 6.25, 5.8, 4.8, 4.2, 3.9];
  const sample = (fraction, lift) => SLOTS.map((_, k) => {
    const t = k <= 6 ? k : 12 - k, side = k <= 6 ? 'R' : 'L';
    const f = frameAt(carrier, 'cranium', [low[t] + (8 - low[t]) * fraction, t], side);
    return add(f.origin, mul(f.normal, lift));
  });
  const lower = sample(0, -0.014), border = sample(0, 0.006), mid = sample(0.60, 0.012), top = sample(1, 0.014);
  if (style === 'swept') { border[0][2] -= 0.010; border[0][1] += 0.012; border[1][2] -= 0.020; border[1][1] += 0.020; mid[0][2] += 0.008; }
  const mesh = loftParts([lower, border, sample(0.25, 0.016), mid, sample(0.82, 0.017), top], [0, -0.01, 0.10], [0, -0.005, 0.213]);
  return detail(carrier, 'cranium', [7.2, 5], 'R', mesh, 'Hair');
}

export function humanoidHead({ preset = 'male', shape = {}, register = 'lowpoly', hair = 'swept',
  scale = 1, skin = '#d9a77e', hairColor = '#3b291e', palette = {}, expression = 'neutral' } = {}) {
  if (!HEAD_PRESETS[preset]) throw new Error(`humanoid: unknown head preset '${preset}'`);
  if (!HEAD_REGISTERS[register]) throw new Error(`humanoid: unknown register '${register}'`);
  if (!HAIR_STYLES.includes(hair)) throw new Error(`humanoid: unknown hair '${hair}'`);
  if (!EXPRESSIONS[expression]) throw new Error(`humanoid: unknown expression '${expression}'`);
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error('humanoid: head scale must be positive');
  for (const [k, v] of Object.entries(shape)) if (!(k in HEAD_KNOB_DEFAULTS) || !(Number.isFinite(v) && v > 0)) throw new Error(`humanoid: invalid head shape '${k}'`);
  const knobs = { ...HEAD_KNOB_DEFAULTS, ...shape }, pole = HEAD_PRESETS[preset];
  const anchors = humanoidAnchors(preset, knobs), rows = landmarkRows(anchors, pole, knobs);
  const sh = { width: HEAD_WIDTH[preset], jaw: 1, nose: 1.3, eye: knobs.eyeSize, brow: Math.sqrt(pole.brow) * knobs.browRidge };
  const reg = HEAD_REGISTERS[register], ex = EXPRESSIONS[expression];
  const cranium = rings(rows, sh, reg);
  // The skull/jaw boundary follows the mandibular angle up to the condyles. It is not a
  // horizontal puppet cut: the mouth opens at the front while the hinge remains by the ear.
  for (let i = 0; i < 4; i++) {
    const st = cranium.stations[i];
    for (const side of ['R', 'L']) {
      st.points[`side${side}`][2] = Math.max(rows[i][0], anchors.gonionR[2] + 0.014 + i * 0.009);
      st.points[`rear${side}`][2] = Math.max(rows[i][0], anchors.condyleR[2] - 0.004 + i * 0.006);
    }
    st.points.back[2] = Math.max(rows[i][0], anchors.condyleR[2] - 0.004 + i * 0.006);
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
  const chinWidth = 0.051 * Math.sqrt(pole.chinSize / (pole.chinPoint * knobs.chinPoint));
  const jaw = rings([[anchors.menton[2] - 0.008, chinWidth, anchors.menton[1] + 0.009, 0.018],
    [anchors.menton[2] + 0.005, rows[0][1] * 0.91, anchors.stomion[1] - 0.010, 0.035],
    rows[0]], sh, reg);
  // Two coincident boundary rings hide the construction seam; both parts remain individually closed.
  jaw.stations.at(-1).points = structuredClone(cranium.stations[0].points);
  jaw.caps.tip = [0, anchors.condyleR[1], anchors.condyleR[2]];
  cranium.capGroups = { back: 'Mouth', tip: 'Skin' }; jaw.capGroups = { back: 'Skin', tip: 'Mouth' };
  const dials = { jawOpen: { min: 0, max: 25, rest: ex.jawOpen, doc: 'Jaw opening in degrees',
    op: 'hinge', part: 'jaw', pivot: 'jaw/tip', axis: 'x', sign: -1 } };
  const recipe = { parts: { cranium, jaw }, dials: {}, creases: {} };
  const carrier = compileLayered(recipe).parts;
  const parts = recipe.parts;
  for (const side of ['R', 'L']) {
    const sign = side === 'R' ? 1 : -1;
    const eyeT = 2 + (Math.abs(anchors.eyeR[0]) / rows[4][1] - 0.40) / (0.39 + reg.plane * 0.13);
    const at = [4, eyeT], f = frameAt(carrier, 'cranium', at, side);
    const normal = unit([f.normal[0], f.normal[1], 0]);
    const origin = add(f.origin, mul(normal, 0.002));
    parts[`eye${side}`] = detail(carrier, 'cranium', at, side, oval(origin, 0.021 * sh.eye, 0.012 * ex.aperture * sh.eye, 0.0009, reg.eyeSides, normal), 'Sclera');
    parts[`iris${side}`] = detail(carrier, 'cranium', at, side, oval(add(origin, mul(normal, 0.0010)), 0.0075 * sh.eye, 0.0085 * ex.aperture * sh.eye, 0.001, reg.eyeSides, normal), 'Iris');
    parts[`pupil${side}`] = detail(carrier, 'cranium', at, side, oval(add(origin, mul(normal, 0.0021)), 0.0036 * sh.eye, 0.005 * ex.aperture * sh.eye, 0.0005, 8, normal), 'Pupil');
    const across = unit([normal[1], -normal[0], 0]);
    const lidSpine = [[-0.020, 0], [-0.013, 0.0085], [0, 0.0115], [0.013, 0.0085], [0.020, 0]].map(([x, z]) =>
      add(add(origin, mul(normal, 0.0015)), add(mul(across, x * sh.eye), [0, 0, z * ex.aperture * sh.eye])));
    const lid = sweep(lidSpine, [0.0007, 0.0010, 0.0011, 0.0008], 4);
    parts[`lid${side}`] = detail(carrier, 'cranium', at, side, lid, 'Lid');
    const addrs = [[4.9, 1.6], [5.02, 2.1], [4.94, 2.65], [4.80, 2.9]];
    const brow = strip(carrier, 'cranium', addrs, side, j => {
      const w = 0.003 * sh.brow * [0.65, 1, 0.9, 0.35][j];
      return [[-w, -0.0008], [-w, 0.0015], [w, 0.0015], [w, -0.0008]];
    });
    for (const p of Object.values(brow.points)) p[2] += ex.browRaise + ex.browTilt * (Math.abs(p[0]) / 0.065 - 0.6);
    parts[`brow${side}`] = detail(carrier, 'cranium', [4.95, 2.2], side, brow, 'Brow');
    const earAt = [3.7, 4], ef = frameAt(carrier, 'cranium', earAt, side);
    parts[`ear${side}`] = detail(carrier, 'cranium', earAt, side, oval(add(ef.origin, [0.003 * sign, 0, -0.004]), 0.011, 0.024, 0.01, 8, [sign, 0, 0]), 'Skin');
    // The dark accent is on the underside of the integrated nose, not floating on the cheek.
    const nf = frameAt(carrier, 'cranium', [2.01, 0.85], side);
    parts[`nostril${side}`] = detail(carrier, 'cranium', [2.01, 0.85], side, oval(add(nf.origin, [0, 0.001, 0]), 0.0026, 0.0012, 0.0006, 6), 'Nostrils');
    const mouth = strip(carrier, 'cranium', [[0.17, 0.02], [0.18, 1.1], [0.20, 1.85]], side,
      j => [[-0.0012, -0.0005], [-0.0012, 0.001], [0.0012, 0.001], [0.0012, -0.0005]]);
    for (const p of Object.values(mouth.points)) p[2] += ex.mouthCorner * Math.min(1, Math.abs(p[0]) / 0.031);
    parts[`mouth${side}`] = detail(carrier, 'cranium', [0.18, 1.1], side, mouth, 'Mouth');
  }
  if (hair !== 'none') parts.hairCap = hairMass(carrier, hair);
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
    expression, preset, register, hair, scale, landmarks: Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, round(mul(p, scale))])) };
}
