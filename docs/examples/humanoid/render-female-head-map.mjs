/**
 * Female design-target head — a Meru-registered, Mandala-authored polygon map.
 *
 * The head is not three unrelated drawings. Every visible plane references named points in one
 * +x right / +y forward / +z up source. Meru owns that source's unit scale and depth register;
 * the Mandala owns its axis mundi and bilateral bars. Physical cameras derive front, 3/4 and
 * profile SVGs from the same planes.
 *
 * Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-female-head-map.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameSource, orbitCamera, projectVertices, wireRuns, WIRE_STYLES } from '../../../control/lib/graph/scene/wire-svg.js';

const HERE = fileURLToPath(import.meta.url);
const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0925/spike-output/female-head-map', import.meta.url)));
mkdirSync(OUT, { recursive: true });

const r6 = n => Math.round(n * 1e6) / 1e6;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = v => { const d = Math.hypot(...v) || 1; return v.map(n => n / d); };
const avg = ps => [0, 1, 2].map(k => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const scaleHex = (hex, factor) => `#${hex.slice(1).match(/../g).map(h => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * factor))).toString(16).padStart(2, '0')).join('')}`;
const newell = ps => {
  const n = [0, 0, 0];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit(n);
};

// The visual target is iterated through these controls. Point ids and plane ids remain stable;
// changing a control regenerates every view and the construction sheet from the same source.
export const DESIGN_CONTROLS = {
  proportions: {
    positiveHeadHeight: 0.84,
    upperSkullWidth: 1.08,
    malarWidth: 1.06,
    jawWidth: 1.04,
    neckTopWidth: 0.82,
  },
  nose: {
    rootHalfWidth: 0.013,
    bridgeHalfWidth: 0.014,
    tipHalfWidth: 0.021,
    alarHalfWidth: 0.039,
    rootY: 0.119,
    bridgeY: 0.133,
    tipY: 0.149,
    alarY: 0.142,
    columellaY: 0.147,
  },
  eyes: { width: 0.054, height: 0.027, irisRadiusX: 0.0092, irisRadiusZ: 0.0115 },
  mouth: { halfWidth: 0.043, upperHeight: 0.006, lowerHeight: 0.006 },
  presentation: { planeStrokeOpacity: 0.16, lightFloor: 0.86, lightRange: 0.14 },
};

const HEAD_Z_SCALE = DESIGN_CONTROLS.proportions.positiveHeadHeight;

const P = {
  // Axis mundi: the vertical authority for the face.
  crown: [0, -0.030, 0.421],
  crownBack: [0, -0.082, 0.407],
  topFront: [0, 0.028, 0.408],
  hairline: [0, 0.082, 0.326],
  forehead: [0, 0.102, 0.296],
  glabella: [0, 0.112, 0.260],
  nasion: [0, DESIGN_CONTROLS.nose.rootY, 0.235],
  bridge: [0, DESIGN_CONTROLS.nose.bridgeY, 0.190],
  supratip: [0, DESIGN_CONTROLS.nose.tipY - 0.004, 0.168],
  noseTip: [0, DESIGN_CONTROLS.nose.tipY, 0.151],
  columella: [0, DESIGN_CONTROLS.nose.columellaY, 0.133],
  philtrum: [0, 0.136, 0.112],
  cupid: [0, 0.134, 0.088 + DESIGN_CONTROLS.mouth.upperHeight],
  stomion: [0, 0.135, 0.088],
  lowerLip: [0, 0.132, 0.088 - DESIGN_CONTROLS.mouth.lowerHeight],
  labiomental: [0, 0.124, 0.056],
  pogonion: [0, 0.124, 0.035],
  menton: [0, 0.110, 0.012],

  // Back-of-head and ponytail points define the profile without altering the face register.
  occiputTop: [0, -0.119, 0.350],
  occiput: [0, -0.148, 0.258],
  nape: [0, -0.096, 0.112],
  tailTie: [0, -0.142, 0.198],
  tailUpper: [0, -0.174, 0.138],
  tailLower: [0, -0.174, 0.044],
  tailTip: [0, -0.132, -0.052],
  shirtFrontBase: [0, 0.035, -0.170],
  shirtBackBase: [0, -0.075, -0.170],
};

const bilateral = {
  hairlineInner: [0.036, 0.079, 0.325], hairlineOuter: [0.083, 0.042, 0.309],
  crownTop: [0.043, -0.014, 0.424], crownSide: [0.095, -0.052, 0.384], templeUpper: [0.108, 0.002, 0.286], templeLower: [0.108, 0.002, 0.242],
  bangTip: [0.049, 0.110, 0.275],
  browInner: [0.021, 0.114, 0.254], browPeak: [0.047, 0.111, 0.262], browOuter: [0.078, 0.085, 0.249],
  eyeInnerUpper: [0.019, 0.123, 0.229], eyeInnerLower: [0.019, 0.123, 0.211],
  eyeMidUpper: [0.044, 0.125, 0.234], eyeMidLower: [0.044, 0.124, 0.204],
  eyeOuterUpper: [0.071, 0.104, 0.226], eyeOuterLower: [0.071, 0.104, 0.209],
  noseRoot: [DESIGN_CONTROLS.nose.rootHalfWidth, DESIGN_CONTROLS.nose.rootY, 0.235], bridgeSide: [DESIGN_CONTROLS.nose.bridgeHalfWidth, DESIGN_CONTROLS.nose.bridgeY, 0.190],
  supratipSide: [DESIGN_CONTROLS.nose.tipHalfWidth * 0.8, DESIGN_CONTROLS.nose.tipY - 0.004, 0.168],
  tipSide: [DESIGN_CONTROLS.nose.tipHalfWidth, DESIGN_CONTROLS.nose.tipY, 0.151], alaTop: [0.028, DESIGN_CONTROLS.nose.alarY + 0.004, 0.149],
  nostrilInner: [0.016, DESIGN_CONTROLS.nose.columellaY + 0.003, 0.133], alaBase: [DESIGN_CONTROLS.nose.alarHalfWidth, DESIGN_CONTROLS.nose.alarY, 0.133],
  cheekMedialUpper: [0.039, 0.118, 0.187], cheekCrest: [0.078, 0.101, 0.184],
  zygion: [0.099, 0.048, 0.181], cheekLower: [0.063, 0.106, 0.135], buccal: [0.076, 0.068, 0.117],
  philtrumSide: [0.017, 0.135, 0.111], cupidPeak: [0.014, 0.139, 0.098],
  mouthCorner: [DESIGN_CONTROLS.mouth.halfWidth, 0.122, 0.088], lowerLipSide: [0.033, 0.130, 0.088 - DESIGN_CONTROLS.mouth.lowerHeight],
  chinSide: [0.048, 0.100, 0.020], jawFront: [0.064, 0.084, 0.054],
  jawUpper: [0.081, 0.022, 0.103], gonion: [0.071, -0.002, 0.050],
  earTop: [0.124, -0.008, 0.252], earUpperFront: [0.128, 0.008, 0.230],
  earFront: [0.130, 0.011, 0.207], earLowerFront: [0.127, 0.006, 0.178],
  earBottom: [0.121, -0.004, 0.155], earLowerBack: [0.126, -0.030, 0.178],
  earBack: [0.129, -0.036, 0.205], earUpperBack: [0.126, -0.030, 0.231],
  earInnerTop: [0.128, -0.008, 0.232], earInnerFront: [0.131, 0.003, 0.209],
  earInnerBottom: [0.127, -0.006, 0.177], earInnerBack: [0.130, -0.025, 0.204],
  skullRearUpper: [0.088, -0.126, 0.352], skullRearMid: [0.110, -0.145, 0.268], skullRearLow: [0.098, -0.112, 0.148],
  neckTop: [0.040, -0.060, 0.072], neckBase: [0.052, -0.046, -0.100], neckFront: [0.044, 0.018, -0.100],
  tailTieSide: [0.034, -0.142, 0.198], tailUpperSide: [0.054, -0.174, 0.138],
  tailLowerSide: [0.049, -0.174, 0.044], tailTipSide: [0.018, -0.132, -0.052],
  collarFront: [0.060, 0.026, -0.082], collarBack: [0.058, -0.060, -0.082],
  shoulderFront: [0.180, 0.010, -0.155], shoulderBack: [0.165, -0.075, -0.155],
};
for (const [name, [x, y, z]] of Object.entries(bilateral)) {
  P[`${name}L`] = [-x, y, z];
  P[`${name}R`] = [x, y, z];
}

// The target fringe is intentionally not mirrored: it parts high on the left and sweeps down
// across the right forehead. These overrides sit after bilateral expansion by design.
Object.assign(P, {
  hairlineInnerL: [-0.038, 0.074, 0.326], hairlineInnerR: [0.037, 0.084, 0.323],
  hairlineOuterL: [-0.083, 0.035, 0.309], hairlineOuterR: [0.084, 0.050, 0.305],
  bangTipL: [-0.060, 0.102, 0.291], bangTipR: [0.038, 0.116, 0.265],
  tailTieFront: [0, -0.112, 0.198], tailTieBack: [0, -0.166, 0.198],
  tailUpperFront: [0, -0.125, 0.138], tailUpperBack: [0, -0.224, 0.138],
  tailLowerFront: [0, -0.132, 0.044], tailLowerBack: [0, -0.216, 0.044],
  tailTipFront: [0, -0.116, -0.052], tailTipBack: [0, -0.149, -0.052],
});

const scalePointX = (pattern, factor) => {
  for (const [id, xyz] of Object.entries(P)) if (pattern.test(id)) xyz[0] = r6(xyz[0] * factor);
};
scalePointX(/crown|hairline|temple|skullRear|occiput|ear/, DESIGN_CONTROLS.proportions.upperSkullWidth);
scalePointX(/eye|brow|cheek|zygion|buccal/, DESIGN_CONTROLS.proportions.malarWidth);
scalePointX(/jaw|gonion|chinSide/, DESIGN_CONTROLS.proportions.jawWidth);
scalePointX(/neck/, DESIGN_CONTROLS.proportions.neckTopWidth);

for (const side of ['L', 'R']) {
  const sign = side === 'L' ? -1 : 1, cx = sign * 0.047;
  const innerX = cx - sign * DESIGN_CONTROLS.eyes.width / 2;
  const outerX = cx + sign * DESIGN_CONTROLS.eyes.width / 2;
  const midX = (innerX + outerX) / 2, cz = 0.219;
  P[`eyeInnerUpper${side}`][0] = innerX; P[`eyeInnerLower${side}`][0] = innerX;
  P[`eyeMidUpper${side}`][0] = midX; P[`eyeMidLower${side}`][0] = midX;
  P[`eyeOuterUpper${side}`][0] = outerX; P[`eyeOuterLower${side}`][0] = outerX;
  P[`eyeInnerUpper${side}`][2] = cz + DESIGN_CONTROLS.eyes.height * 0.32;
  P[`eyeInnerLower${side}`][2] = cz - DESIGN_CONTROLS.eyes.height * 0.32;
  P[`eyeMidUpper${side}`][2] = cz + DESIGN_CONTROLS.eyes.height / 2;
  P[`eyeMidLower${side}`][2] = cz - DESIGN_CONTROLS.eyes.height / 2;
  P[`eyeOuterUpper${side}`][2] = cz + DESIGN_CONTROLS.eyes.height * 0.25;
  P[`eyeOuterLower${side}`][2] = cz - DESIGN_CONTROLS.eyes.height * 0.32;
}

// The independent female target has a rounder, more compact craniofacial proportion than the
// original humanoid. Keep the Meru origin at the menton and compress the positive head register.
for (const xyz of Object.values(P)) if (xyz[2] > 0) xyz[2] = r6(xyz[2] * HEAD_Z_SCALE);

export const recipe = {
  schema: 'mojulo-meru-mandala-head-v2',
  title: 'Independent female design target — polygonal head map',
  reference: {
    file: 'female-silhouette-target-v1.png',
    role: 'visual target; authored spatial interpretation, not automatic reconstruction',
    observations: [
      'rounded cranium with low ponytail', 'soft tapered jaw and compact chin',
      'large almond eyes on one ocular bar', 'narrow nasal root opening into a wider alar base',
      'upper lip is constructed beneath the columella and philtrum', 'broad quiet cheek and forehead planes',
    ],
  },
  frame: { up: '+z', front: '+y', right: '+x', origin: 'menton', units: 'metres' },
  controls: DESIGN_CONTROLS,
  meru: {
    basis: 'shared-head-world', aliasFor: 'metamandala', unitScale: 1384.615385,
    sceneExtent: { width: 0.52, depth: 0.42, height: 0.52 }, boundaryPolicy: 'attribute',
    rule: 'one world ruler and one depth register for every facial region and every view',
    depthBands: [
      { id: 'rear-hair', y: [-0.18, -0.07], owns: ['occiput', 'ponytail'] },
      { id: 'lateral-shell', y: [-0.07, 0.08], owns: ['temple', 'ear', 'jaw'] },
      { id: 'face-field', y: [0.08, 0.125], owns: ['forehead', 'orbit', 'cheek', 'chin'] },
      { id: 'feature-field', y: [0.123, 0.145], owns: ['eyes', 'brows', 'mouth'] },
      { id: 'nasal-projection', y: [0.138, 0.160], owns: ['bridge', 'supratip', 'tip', 'ala', 'nostril'] },
    ],
  },
  mandala: {
    kind: 'bilateral-axis-spine',
    axisMundi: ['crown', 'hairline', 'forehead', 'glabella', 'nasion', 'bridge', 'supratip', 'noseTip', 'columella', 'philtrum', 'cupid', 'stomion', 'lowerLip', 'labiomental', 'pogonion', 'menton'],
    bars: {
      hairline: ['hairlineOuterL', 'hairline', 'hairlineOuterR'],
      brow: ['browOuterL', 'glabella', 'browOuterR'],
      eye: ['eyeOuterUpperL', 'nasion', 'eyeOuterUpperR'],
      cheek: ['zygionL', 'bridge', 'zygionR'],
      noseBase: ['alaBaseL', 'columella', 'alaBaseR'],
      mouth: ['mouthCornerL', 'stomion', 'mouthCornerR'],
      jaw: ['gonionL', 'menton', 'gonionR'],
      ear: ['earBackL', 'nasion', 'earBackR'],
    },
    relations: [
      { kind: 'o-o-o', id: 'ocular-girdle', points: ['eyeMidUpperL', 'nasion', 'eyeMidUpperR'] },
      { kind: 'o-o-o', id: 'reverse-keel-nose', points: ['noseRootL', 'noseTip', 'noseRootR'], resolvesTo: ['alaBaseL', 'columella', 'alaBaseR'], rule: 'root narrower than base' },
      { kind: 'o-o-o', id: 'mandibular-girdle', points: ['gonionL', 'menton', 'gonionR'] },
    ],
    points: P,
  },
  views: {
    front: { azimuthDegrees: 180, elevationDegrees: 1.5 },
    threeQuarter: { azimuthDegrees: 142, elevationDegrees: 2.5 },
    profile: { azimuthDegrees: 90, elevationDegrees: 1.5 },
  },
  palette: {
    Forehead: '#d9aa82', Temple: '#c9926e', Orbit: '#d2a079', NoseBridge: '#d7a079', NoseSide: '#c78f6b', NoseTip: '#dda77d',
    Nostril: '#704b3d', CheekLight: '#d8a27b', CheekSide: '#c58e6a', Muzzle: '#d4a079', Jaw: '#bd8666', Chin: '#cb9570',
    Sclera: '#f2ede4', Iris: '#4e7892', Pupil: '#182b38', Brow: '#3b291f', LipUpper: '#9b6258', LipLower: '#b97769',
    Ear: '#c99270', EarInner: '#a76f5b', Hair: '#3a281e', HairLight: '#4b3427', Neck: '#bf8967',
    Shirt: '#356fae', ShirtShade: '#2f6198',
  },
};

const PLANE_SPECS = [];
const plane = (id, ids, group, region = group, boundary = true) => PLANE_SPECS.push({ id, ids, group, region, boundary });

// The visible face is a named polygon network. These are semantic surfaces, not a generic loft.
plane('forehead-centre', ['hairlineInnerL', 'hairlineInnerR', 'browInnerR', 'glabella', 'browInnerL'], 'Forehead', 'forehead');
plane('forehead-left', ['hairlineOuterL', 'hairlineInnerL', 'browInnerL', 'browPeakL', 'browOuterL', 'templeUpperL'], 'Forehead', 'forehead');
plane('forehead-right', ['hairlineInnerR', 'hairlineOuterR', 'templeUpperR', 'browOuterR', 'browPeakR', 'browInnerR'], 'Forehead', 'forehead');
plane('temple-left', ['hairlineOuterL', 'templeUpperL', 'templeLowerL', 'browOuterL'], 'Temple', 'temple');
plane('temple-right', ['browOuterR', 'templeLowerR', 'templeUpperR', 'hairlineOuterR'], 'Temple', 'temple');
plane('glabella-root', ['browInnerL', 'glabella', 'browInnerR', 'noseRootR', 'nasion', 'noseRootL'], 'Forehead', 'interbrow');
plane('inner-orbit-left', ['browInnerL', 'noseRootL', 'eyeInnerLowerL', 'eyeInnerUpperL'], 'Orbit', 'orbit');
plane('inner-orbit-right', ['eyeInnerUpperR', 'eyeInnerLowerR', 'noseRootR', 'browInnerR'], 'Orbit', 'orbit');

for (const side of ['L', 'R']) {
  const rev = side === 'L' ? a => a : a => [...a].reverse();
  plane(`brow-plane-${side}`, rev([`browInner${side}`, `browPeak${side}`, `browOuter${side}`, `eyeOuterUpper${side}`, `eyeMidUpper${side}`, `eyeInnerUpper${side}`]), 'Orbit', 'orbit');
  plane(`lower-orbit-${side}`, rev([`eyeInnerLower${side}`, `eyeMidLower${side}`, `eyeOuterLower${side}`, `cheekCrest${side}`, `cheekMedialUpper${side}`]), 'Orbit', 'orbit');
  plane(`lateral-orbit-${side}`, rev([`eyeOuterUpper${side}`, `browOuter${side}`, `templeLower${side}`, `zygion${side}`, `cheekCrest${side}`, `eyeOuterLower${side}`]), 'Temple', 'orbit');
  plane(`medial-cheek-${side}`, rev([`eyeInnerLower${side}`, `cheekMedialUpper${side}`, `cheekLower${side}`, `alaBase${side}`, `alaTop${side}`]), 'CheekLight', 'cheek');
  plane(`cheekbone-${side}`, rev([`eyeOuterLower${side}`, `cheekCrest${side}`, `zygion${side}`, `buccal${side}`, `cheekLower${side}`, `cheekMedialUpper${side}`]), 'CheekLight', 'cheek');
  plane(`side-cheek-${side}`, rev([`zygion${side}`, `earFront${side}`, `jawUpper${side}`, `buccal${side}`]), 'CheekSide', 'cheek');
  plane(`muzzle-${side}`, rev([`alaBase${side}`, `cheekLower${side}`, `mouthCorner${side}`, `philtrumSide${side}`]), 'Muzzle', 'muzzle');
  plane(`lower-cheek-${side}`, rev([`cheekLower${side}`, `buccal${side}`, `jawUpper${side}`, `jawFront${side}`, `mouthCorner${side}`]), 'CheekSide', 'lower-face');
  plane(`jaw-side-${side}`, rev([`jawUpper${side}`, `gonion${side}`, `chinSide${side}`, `jawFront${side}`]), 'Jaw', 'jaw');
  plane(`chin-wing-${side}`, rev([`mouthCorner${side}`, `jawFront${side}`, `chinSide${side}`, 'pogonion', 'labiomental', `lowerLipSide${side}`]), 'Chin', 'chin');
}

plane('nasal-root', ['noseRootL', 'noseRootR', 'bridgeSideR', 'bridge', 'bridgeSideL'], 'NoseBridge', 'nose');
plane('nose-dorsum', ['bridgeSideL', 'bridge', 'bridgeSideR', 'supratipSideR', 'supratip', 'supratipSideL'], 'NoseBridge', 'nose');
plane('nose-supratip', ['supratipSideL', 'supratip', 'supratipSideR', 'tipSideR', 'noseTip', 'tipSideL'], 'NoseTip', 'nose');
plane('nose-side-left', ['noseRootL', 'bridgeSideL', 'supratipSideL', 'tipSideL', 'alaTopL', 'cheekMedialUpperL', 'eyeInnerLowerL'], 'NoseSide', 'nose');
plane('nose-side-right', ['eyeInnerLowerR', 'cheekMedialUpperR', 'alaTopR', 'tipSideR', 'supratipSideR', 'bridgeSideR', 'noseRootR'], 'NoseSide', 'nose');
plane('nose-tip', ['tipSideL', 'noseTip', 'tipSideR', 'alaTopR', 'nostrilInnerR', 'columella', 'nostrilInnerL', 'alaTopL'], 'NoseTip', 'nose');
plane('ala-left', ['alaTopL', 'nostrilInnerL', 'alaBaseL', 'cheekMedialUpperL'], 'NoseSide', 'nose');
plane('ala-right', ['cheekMedialUpperR', 'alaBaseR', 'nostrilInnerR', 'alaTopR'], 'NoseSide', 'nose');
plane('nostril-left', ['nostrilInnerL', 'columella', 'alaBaseL'], 'Nostril', 'nostril');
plane('nostril-right', ['alaBaseR', 'columella', 'nostrilInnerR'], 'Nostril', 'nostril');
plane('philtrum-left', ['alaBaseL', 'columella', 'philtrum', 'philtrumSideL'], 'Muzzle', 'philtrum');
plane('philtrum-right', ['philtrumSideR', 'philtrum', 'columella', 'alaBaseR'], 'Muzzle', 'philtrum');
plane('philtrum-centre', ['philtrumSideL', 'philtrum', 'philtrumSideR', 'cupidPeakR', 'cupid', 'cupidPeakL'], 'Muzzle', 'philtrum');
plane('upper-lip-left', ['mouthCornerL', 'philtrumSideL', 'cupidPeakL', 'cupid', 'stomion'], 'LipUpper', 'mouth');
plane('upper-lip-right', ['stomion', 'cupid', 'cupidPeakR', 'philtrumSideR', 'mouthCornerR'], 'LipUpper', 'mouth');
plane('lower-lip', ['mouthCornerL', 'stomion', 'mouthCornerR', 'lowerLipSideR', 'lowerLip', 'lowerLipSideL'], 'LipLower', 'mouth');
plane('chin-centre', ['lowerLipSideL', 'lowerLip', 'lowerLipSideR', 'labiomental', 'pogonion'], 'Chin', 'chin');
plane('chin-bottom-left', ['chinSideL', 'pogonion', 'menton'], 'Jaw', 'chin');
plane('chin-bottom-right', ['menton', 'pogonion', 'chinSideR'], 'Jaw', 'chin');

// Lateral shell and ears close the profile; hair is its own low-poly cap.
for (const side of ['L', 'R']) {
  const rev = side === 'L' ? a => a : a => [...a].reverse();
  plane(`side-head-upper-${side}`, rev([`templeUpper${side}`, `crownSide${side}`, `skullRearUpper${side}`, `earTop${side}`]), 'Temple', 'side-head');
  plane(`side-head-underlay-${side}`, rev([`templeUpper${side}`, `templeLower${side}`, `zygion${side}`, `jawUpper${side}`, `gonion${side}`, `skullRearLow${side}`, `skullRearMid${side}`, `skullRearUpper${side}`]), 'Temple', 'side-head', false);
  plane(`side-scalp-${side}`, rev([`crownSide${side}`, `skullRearUpper${side}`, `skullRearMid${side}`, `earTop${side}`]), 'Hair', 'hair');
  plane(`side-head-mid-${side}`, rev([`templeLower${side}`, `templeUpper${side}`, `earTop${side}`, `earFront${side}`]), 'Temple', 'side-head');
  plane(`preauricular-${side}`, rev([`templeLower${side}`, `earFront${side}`, `zygion${side}`]), 'Temple', 'side-head');
  plane(`side-head-low-${side}`, rev([`earBottom${side}`, `skullRearLow${side}`, `gonion${side}`, `jawUpper${side}`, `earFront${side}`]), 'Jaw', 'side-head');
  plane(`ear-${side}`, rev([`earTop${side}`, `earUpperBack${side}`, `earBack${side}`, `earLowerBack${side}`, `earBottom${side}`, `earLowerFront${side}`, `earFront${side}`, `earUpperFront${side}`]), 'Ear', 'ear');
  plane(`ear-inner-${side}`, rev([`earInnerTop${side}`, `earInnerBack${side}`, `earInnerBottom${side}`, `earInnerFront${side}`]), 'EarInner', 'ear-inner', false);
  plane(`neck-side-${side}`, rev([`gonion${side}`, `skullRearLow${side}`, `neckTop${side}`, `neckBase${side}`, `neckFront${side}`, `chinSide${side}`]), 'Neck', 'neck');
}
plane('neck-front', ['neckFrontL', 'neckFrontR', 'chinSideR', 'menton', 'chinSideL'], 'Neck', 'neck');
plane('neck-back', ['neckTopL', 'skullRearLowL', 'skullRearLowR', 'neckTopR', 'neckBaseR', 'neckBaseL'], 'Neck', 'neck');
plane('shirt-front-left', ['shirtFrontBase', 'shoulderFrontL', 'collarFrontL', 'neckFrontL'], 'Shirt', 'shoulder-yoke');
plane('shirt-front-right', ['neckFrontR', 'collarFrontR', 'shoulderFrontR', 'shirtFrontBase'], 'Shirt', 'shoulder-yoke');
plane('shirt-front-centre', ['shirtFrontBase', 'collarFrontL', 'collarFrontR'], 'Shirt', 'shoulder-yoke');
plane('shirt-side-left', ['shoulderFrontL', 'shoulderBackL', 'collarBackL', 'collarFrontL'], 'ShirtShade', 'shoulder-yoke');
plane('shirt-side-right', ['collarFrontR', 'collarBackR', 'shoulderBackR', 'shoulderFrontR'], 'ShirtShade', 'shoulder-yoke');
plane('shirt-back-left', ['shirtBackBase', 'collarBackL', 'shoulderBackL'], 'ShirtShade', 'shoulder-yoke');
plane('shirt-back-right', ['shoulderBackR', 'collarBackR', 'shirtBackBase'], 'ShirtShade', 'shoulder-yoke');
plane('occiput-centre', ['skullRearUpperL', 'skullRearUpperR', 'skullRearMidR', 'occiput', 'skullRearMidL'], 'Hair', 'hair');

plane('hair-crown-top', ['topFront', 'crownTopR', 'crown', 'crownTopL'], 'HairLight', 'hair');
plane('hair-front-centre', ['hairlineInnerL', 'hairline', 'hairlineInnerR', 'topFront'], 'HairLight', 'hair');
plane('hair-front-left', ['hairlineOuterL', 'hairlineInnerL', 'topFront', 'crownTopL', 'crownSideL'], 'Hair', 'hair');
plane('hair-front-right', ['crownSideR', 'crownTopR', 'topFront', 'hairlineInnerR', 'hairlineOuterR'], 'HairLight', 'hair');
plane('hair-crown-left', ['crownTopL', 'crown', 'crownBack', 'occiputTop', 'skullRearUpperL', 'crownSideL'], 'HairLight', 'hair');
plane('hair-crown-right', ['crownSideR', 'skullRearUpperR', 'occiputTop', 'crownBack', 'crown', 'crownTopR'], 'Hair', 'hair');
plane('hair-bang-sweep', ['hairlineOuterL', 'hairlineInnerL', 'hairline', 'bangTipR', 'bangTipL'], 'HairLight', 'fringe');
plane('hair-bang-right', ['bangTipR', 'hairlineOuterR', 'hairlineInnerR', 'hairline'], 'Hair', 'fringe');
plane('hair-back-left', ['skullRearUpperL', 'skullRearMidL', 'skullRearLowL', 'occiput', 'occiputTop'], 'Hair', 'hair');
plane('hair-back-right', ['occiputTop', 'occiput', 'skullRearLowR', 'skullRearMidR', 'skullRearUpperR'], 'HairLight', 'hair');
plane('hair-side-left', ['crownSideL', 'skullRearUpperL', 'skullRearMidL', 'earTopL', 'templeUpperL'], 'Hair', 'hair');
plane('hair-side-right', ['templeUpperR', 'earTopR', 'skullRearMidR', 'skullRearUpperR', 'crownSideR'], 'HairLight', 'hair');
plane('postauricular-left', ['earBackL', 'skullRearMidL', 'skullRearLowL', 'earBottomL'], 'Hair', 'hair');
plane('postauricular-right', ['earBottomR', 'skullRearLowR', 'skullRearMidR', 'earBackR'], 'HairLight', 'hair');
plane('ponytail-root-left', ['skullRearMidL', 'skullRearLowL', 'tailUpperSideL', 'tailTieSideL'], 'Hair', 'ponytail');
plane('ponytail-root-right', ['tailTieSideR', 'tailUpperSideR', 'skullRearLowR', 'skullRearMidR'], 'HairLight', 'ponytail');
plane('ponytail-root-front', ['skullRearLowL', 'skullRearLowR', 'tailTieFront', 'tailUpperFront'], 'HairLight', 'ponytail');
plane('ponytail-root-back', ['tailTieBack', 'tailUpperBack', 'skullRearMidR', 'skullRearMidL'], 'Hair', 'ponytail');
plane('hair-nape-left', ['skullRearMidL', 'skullRearLowL', 'tailTieFront', 'tailTieSideL', 'tailTieBack'], 'Hair', 'ponytail');
plane('hair-nape-right', ['tailTieBack', 'tailTieSideR', 'tailTieFront', 'skullRearLowR', 'skullRearMidR'], 'HairLight', 'ponytail');

const tailStations = ['Tie', 'Upper', 'Lower', 'Tip'];
for (let i = 0; i + 1 < tailStations.length; i++) {
  const a = tailStations[i], b = tailStations[i + 1], id = `${a.toLowerCase()}-${b.toLowerCase()}`;
  plane(`tail-${id}-front`, [`tail${a}Front`, `tail${b}Front`, `tail${b}SideR`, `tail${a}SideR`], 'HairLight', 'ponytail');
  plane(`tail-${id}-right`, [`tail${a}SideR`, `tail${b}SideR`, `tail${b}Back`, `tail${a}Back`], 'HairLight', 'ponytail');
  plane(`tail-${id}-back`, [`tail${a}Back`, `tail${b}Back`, `tail${b}SideL`, `tail${a}SideL`], 'Hair', 'ponytail');
  plane(`tail-${id}-left`, [`tail${a}SideL`, `tail${b}SideL`, `tail${b}Front`, `tail${a}Front`], 'Hair', 'ponytail');
}
plane('tail-tip-cap', ['tailTipFront', 'tailTipSideL', 'tailTipBack', 'tailTipSideR'], 'Hair', 'ponytail');

function buildSource(spec) {
  const pointIds = Object.keys(spec.mandala.points);
  const vertices = pointIds.map(id => spec.mandala.points[id].map(r6));
  const index = Object.fromEntries(pointIds.map((id, i) => [id, i]));
  const planes = [];
  const centre = [0, -0.010, 0.205];
  for (const p of PLANE_SPECS) {
    let ids = p.ids.map(id => {
      if (index[id] === undefined) throw new Error(`unknown head point ${id} in ${p.id}`);
      return index[id];
    });
    const xyz = ids.map(i => vertices[i]);
    if (dot(newell(xyz), sub(avg(xyz), centre)) < 0) ids = [...ids].reverse();
    planes.push({ ...p, vertices: ids });
  }

  const addPoint = (id, xyz) => {
    const p = [...xyz];
    if (p[2] > 0) p[2] *= HEAD_Z_SCALE;
    index[id] = vertices.length; pointIds.push(id); vertices.push(p.map(r6)); return index[id];
  };
  const addFeature = (id, ids, group, region = group) => {
    const xyz = ids.map(i => vertices[i]);
    const oriented = dot(newell(xyz), sub(avg(xyz), centre)) < 0 ? [...ids].reverse() : ids;
    planes.push({ id, vertices: oriented, group, region, boundary: true });
  };

  // Almond eyes, low-poly irises and brows are anchored to the same ocular Mandala bar.
  for (const side of ['L', 'R']) {
    const eyeIds = [`eyeInnerUpper${side}`, `eyeMidUpper${side}`, `eyeOuterUpper${side}`, `eyeOuterLower${side}`, `eyeMidLower${side}`, `eyeInnerLower${side}`].map(id => index[id]);
    addFeature(`eye-${side}`, eyeIds, 'Sclera', 'eye');
    const sign = side === 'L' ? -1 : 1, cx = sign * 0.045, cy = 0.128, cz = 0.219;
    const iris = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI * 2 / 8; return addPoint(`iris${side}/${i}`, [cx + Math.cos(a) * spec.controls.eyes.irisRadiusX, cy, cz + Math.sin(a) * spec.controls.eyes.irisRadiusZ]); });
    addFeature(`iris-${side}`, iris, 'Iris', 'iris');
    const pupil = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI * 2 / 8; return addPoint(`pupil${side}/${i}`, [cx + Math.cos(a) * spec.controls.eyes.irisRadiusX * 0.48, cy + 0.0015, cz + Math.sin(a) * spec.controls.eyes.irisRadiusZ * 0.52]); });
    addFeature(`pupil-${side}`, pupil, 'Pupil', 'pupil');
    const brow = [
      addPoint(`brow${side}/innerLow`, [sign * 0.022, 0.117, 0.259]),
      addPoint(`brow${side}/peakLow`, [sign * 0.048, 0.114, 0.267]),
      addPoint(`brow${side}/outerLow`, [sign * 0.077, 0.089, 0.254]),
      addPoint(`brow${side}/outerHigh`, [sign * 0.075, 0.088, 0.261]),
      addPoint(`brow${side}/peakHigh`, [sign * 0.047, 0.114, 0.274]),
      addPoint(`brow${side}/innerHigh`, [sign * 0.022, 0.117, 0.266]),
    ];
    addFeature(`brow-${side}`, brow, 'Brow', 'brow');
  }

  // Triangulate only for depth/hidden-line math. The SVG keeps the authored n-gons intact.
  const faces = [], groups = [], planeOfFace = [], featureEdges = [];
  for (const p of planes) {
    for (let i = 1; i + 1 < p.vertices.length; i++) {
      faces.push([p.vertices[0], p.vertices[i], p.vertices[i + 1]]);
      groups.push(p.group); planeOfFace.push(p.id);
    }
    const featureRegion = ['nose', 'nostril', 'mouth', 'eye', 'iris', 'pupil', 'brow', 'ear-inner', 'fringe'].includes(p.region);
    if (featureRegion) for (let i = 0; i < p.vertices.length; i++) featureEdges.push([p.vertices[i], p.vertices[(i + 1) % p.vertices.length]]);
  }
  return { schema: 'wire-source-v1', title: spec.title, vertices, pointIds, faces, groups, planeOfFace, featureEdges, planes };
}

const FEATURE_GROUPS = ['NoseBridge', 'NoseSide', 'NoseTip', 'Nostril', 'Sclera', 'Iris', 'Pupil', 'Brow', 'LipUpper', 'LipLower', 'EarInner'];
const FEATURE_ALWAYS = new Set(['Sclera', 'Iris', 'Pupil', 'Brow', 'LipUpper', 'LipLower', 'Nostril', 'EarInner']);
const OVERLAY_GROUPS = new Set(['Ear', 'EarInner']);
const LIGHT = unit([-0.42, 0.76, 0.72]);

function renderView(source, spec, name, cameraSpec, { construction = false } = {}) {
  const SIZE = 720, framing = frameSource(source, { focalPixels: 1200, size: SIZE, margin: 1.16 });
  const cam = orbitCamera({ ...cameraSpec, target: framing.target, distance: framing.distance, focalPixels: 1200, size: SIZE });
  const q = projectVertices(source.vertices, cam), paint = [];
  for (const p of source.planes) {
    const xyz = p.vertices.map(i => source.vertices[i]);
    const normal = newell(xyz), centre = avg(xyz), facing = dot(normal, sub(cam.position, centre));
    // Authored facial patches are thin surfaces. Paint both sides, then rely on the physical
    // camera depth order; this keeps the profile and 3/4 projections closed at shared seams.
    const light = FEATURE_ALWAYS.has(p.group)
      ? 1
      : spec.controls.presentation.lightFloor + spec.controls.presentation.lightRange * Math.max(0, dot(normal, LIGHT));
    paint.push({ ...p, depth: p.vertices.reduce((s, i) => s + q[i][2], 0) / p.vertices.length, fill: scaleHex(spec.palette[p.group], light) });
  }
  paint.sort((a, b) => Number(OVERLAY_GROUPS.has(a.group)) - Number(OVERLAY_GROUPS.has(b.group)) || b.depth - a.depth);

  const projection = { ...cam.meta, principal: cam.principal, viewBox: [0, 0, SIZE, SIZE], basis: 'physical right=forward cross world-up; SVG y down', sourceIdentity: 'shared Meru/Mandala head recipe' };
  const s = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"><title>${esc(spec.title)} — ${esc(name)}</title>`,
    `<metadata id="meru">${esc(JSON.stringify(spec.meru))}</metadata>`,
    `<metadata id="mandala">${esc(JSON.stringify(spec.mandala))}</metadata>`,
    `<metadata id="spatial-source">${esc(JSON.stringify(source))}</metadata>`,
    `<metadata id="projection">${esc(JSON.stringify(projection))}</metadata>`,
    `<rect width="${SIZE}" height="${SIZE}" fill="#f7f5ef"/>`,
    `<g id="polygonal-face" stroke="#72594a" stroke-opacity="${spec.controls.presentation.planeStrokeOpacity}" stroke-width="0.62" stroke-linejoin="round">`,
  ];
  for (const p of paint) {
    const pts = p.vertices.map(i => `${q[i][0].toFixed(2)},${q[i][1].toFixed(2)}`).join(' ');
    const pointNames = p.vertices.map(i => source.pointIds[i]).join(' ');
    s.push(`<polygon id="plane-${esc(p.id)}" data-plane-id="${esc(p.id)}" data-region="${esc(p.region)}" data-point-ids="${esc(pointNames)}" points="${pts}" fill="${p.fill}"/>`);
  }
  s.push('</g><g id="visible-spatial-edges" fill="none" stroke-linecap="round">');
  for (const run of wireRuns(source, cam, { features: FEATURE_GROUPS, creaseDegrees: 12 })) {
    if (!construction) continue;
    if (!run.visible && !construction) continue;
    const base = run.visible ? WIRE_STYLES[run.type] : ['#c5b8ad', 0.7];
    const style = run.visible ? [base[0], run.type === 'outline' ? 1.65 : 1.05] : base;
    const dash = run.visible ? '' : ' stroke-dasharray="3 5"';
    s.push(`<path data-point-ids="${run.edge.map(i => esc(source.pointIds[i])).join(' ')}" data-spatial-edge="${run.edge.join(' ')}" data-source-t="${run.xyzT.map(x => x.toFixed(10)).join(' ')}" data-edge-role="${run.type}" d="M${run.xy[0][0].toFixed(3)},${run.xy[0][1].toFixed(3)} L${run.xy[1][0].toFixed(3)},${run.xy[1][1].toFixed(3)}" stroke="${style[0]}" stroke-width="${style[1]}"${dash}/>`);
  }
  s.push('</g>');
  if (construction) {
    const anchorNames = [...new Set([...spec.mandala.axisMundi, ...Object.values(spec.mandala.bars).flat()])];
    const aq = projectVertices(anchorNames.map(id => spec.mandala.points[id]), cam);
    s.push('<g id="mandala-guides" font-family="system-ui" font-size="8.5" fill="#643f35" stroke="#f7f5ef" stroke-width="2" paint-order="stroke">');
    for (let i = 0; i < anchorNames.length; i++) {
      const [x, y] = aq[i];
      s.push(`<circle data-anchor="${anchorNames[i]}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" fill="#c45f46"/><text x="${(x + 5).toFixed(2)}" y="${(y - 4).toFixed(2)}">${anchorNames[i]}</text>`);
    }
    s.push('</g><g id="meru-legend" font-family="system-ui"><rect x="20" y="20" width="206" height="130" rx="8" fill="#fffdf8" fill-opacity="0.92" stroke="#b5a59a"/><text x="34" y="44" font-size="13" font-weight="700" fill="#413831">MERU DEPTH REGISTER (+y)</text>');
    spec.meru.depthBands.forEach((band, i) => s.push(`<rect x="34" y="${57 + i * 17}" width="12" height="10" rx="2" fill="${['#463226', '#82604b', '#bd8969', '#d4a079', '#e0a77d'][i]}"/><text x="52" y="${66 + i * 17}" font-size="10" fill="#51473f">${band.id} · ${band.y.join(' → ')}</text>`));
    s.push('</g>');
  }
  s.push('</svg>');
  return s.join('');
}

function inlineSvgData(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function mapSvg(viewSvgs) {
  const cards = [
    ['front', 'FRONT · 180°'], ['three-quarter', 'THREE-QUARTER · 142°'], ['profile', 'PROFILE · 90°'],
  ];
  const palette = Object.entries(recipe.palette).map(([k, v], i) => `<g transform="translate(${42 + (i % 8) * 132} ${739 + Math.floor(i / 8) * 25})"><rect width="15" height="15" rx="3" fill="${v}"/><text x="21" y="12">${k}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2160 820"><title>${esc(recipe.title)} — three-view map</title><metadata id="recipe-summary">${esc(JSON.stringify({ schema: recipe.schema, frame: recipe.frame, meru: recipe.meru, mandala: recipe.mandala, views: recipe.views }))}</metadata><rect width="2160" height="820" fill="#f7f5ef"/><text x="40" y="42" font-family="system-ui" font-size="28" font-weight="700" fill="#302b26">Female design target · Meru / Mandala polygonal head</text><text x="40" y="66" font-family="system-ui" font-size="13" fill="#766b62">One named 3D point field · explicit semantic facial planes · three physical-camera projections</text>${cards.map(([n, label], i) => `<text x="${i * 720 + 360}" y="93" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="650" fill="#5b5149">${label}</text><image href="${inlineSvgData(viewSvgs[n])}" x="${i * 720}" y="92" width="720" height="625" preserveAspectRatio="xMidYMid meet"/>`).join('')}<g font-family="system-ui" font-size="10.5" fill="#514942">${palette}</g></svg>`;
}

const source = buildSource(recipe);
function auditHeadMap(spec, built) {
  const unique = xs => new Set(xs).size === xs.length;
  const points = spec.mandala.points;
  const noseFlareRatio = Math.abs(points.alaBaseR[0] / points.noseRootR[0]);
  const noseProjection = points.noseTip[1] - points.nasion[1];
  const checks = {
    uniquePointIds: unique(built.pointIds),
    uniquePlaneIds: unique(built.planes.map(p => p.id)),
    everyPlaneHasArea: built.planes.every(p => p.vertices.length >= 3),
    noseBaseWiderThanRoot: noseFlareRatio >= 2.5,
    noseProjectionCompact: noseProjection > 0.02 && noseProjection <= 0.045,
    earsClearTempleSilhouette: Math.abs(points.earFrontR[0]) > Math.abs(points.templeLowerR[0]) + 0.01,
    ponytailHasProfileVolume: ['Tie', 'Upper', 'Lower', 'Tip'].every(s => points[`tail${s}Front`][1] > points[`tail${s}Back`][1]),
    requiredViewsPresent: ['front', 'threeQuarter', 'profile'].every(v => spec.views[v]),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([id]) => id);
  if (failed.length) throw new Error(`female head map audit failed: ${failed.join(', ')}`);
  return {
    schema: 'mojulo-female-head-audit-v1',
    checks,
    metrics: {
      points: built.vertices.length,
      semanticPlanes: built.planes.length,
      triangles: built.faces.length,
      noseFlareRatio: r6(noseFlareRatio),
      noseProjection: r6(noseProjection),
      upperSkullWidth: r6(Math.abs(points.templeUpperR[0] - points.templeUpperL[0])),
      jawWidth: r6(Math.abs(points.jawUpperR[0] - points.jawUpperL[0])),
    },
  };
}
const audit = auditHeadMap(recipe, source);
const viewSvgs = {};
for (const [name, viewKey] of [['front', 'front'], ['three-quarter', 'threeQuarter'], ['profile', 'profile']]) {
  viewSvgs[name] = renderView(source, recipe, name, recipe.views[viewKey]);
  writeFileSync(`${OUT}/female-head-${name}.svg`, viewSvgs[name]);
}
writeFileSync(`${OUT}/female-head-construction.svg`, renderView(source, recipe, 'three-quarter construction', recipe.views.threeQuarter, { construction: true }));
writeFileSync(`${OUT}/female-head-map.svg`, mapSvg(viewSvgs));
writeFileSync(`${OUT}/female-head-map.recipe.json`, `${JSON.stringify({ ...recipe, planes: PLANE_SPECS, source, audit }, null, 2)}\n`);
writeFileSync(`${OUT}/female-head-map.audit.json`, `${JSON.stringify(audit, null, 2)}\n`);
copyFileSync(HERE, `${OUT}/render-female-head-map.mjs`);
copyFileSync(new URL('./female-head-principles.md', import.meta.url), `${OUT}/female-head-principles.md`);
writeFileSync(`${OUT}/README.md`, `# Female target polygonal head map\n\nThis map is one Meru-registered 3D point field, authored through a bilateral Mandala and projected into front, three-quarter, and profile views. Its ${source.vertices.length} stable points build ${source.planes.length} named semantic planes. The narrow nose root, wider alar base, nostrils, philtrum, and upper lip form one continuous construction.\n\nThe first iteration surface is \`DESIGN_CONTROLS\` in \`render-female-head-map.mjs\`. It owns cranial, cheek, jaw, neck, nose, eye, mouth, lighting, and line parameters while preserving point and plane ids.\n\n- Open \`female-head-map.svg\` for the three-view sheet.\n- Open \`female-head-construction.svg\` for named anchors, hidden edges, and the Meru depth register.\n- Inspect \`female-head-map.recipe.json\` for the controls, reusable recipe, complete indexed source, and audit.\n- Read \`female-head-principles.md\` before changing topology or view-specific geometry.\n- Regenerate with \`render-female-head-map.mjs\`.\n\nThe concept image is the visual target. This is an authored spatial interpretation, not automatic image reconstruction.\n`);

console.log(JSON.stringify({ out: OUT, ...audit.metrics, files: 10 }));
