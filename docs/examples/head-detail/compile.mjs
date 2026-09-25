/** head-detail/compile.mjs — two detailed heads as DATA over the layered grammar's detail operators
 * (control/lib/graph/polygonizer/station-loft-detail.js: addresses, refinement, strips, sweeps, tiles, carriers,
 * the eye / nostril / fold / cheek-web / tongue regions, `build`, `toSource`, `bakeLayered`).
 * HEAD DATA: everything that names an anatomy — station tables, region addresses, skin maps, amplitudes,
 * ornaments, palette — for two heads that share no species code: the dragon (its layered recipe plus a
 * jaw floor) and a bear authored from its own 12-slot station table. Species-neutral EXPRESSIONS drive both.
 * Deterministic, no dice. */
import { compile, loadRecipe } from '../dragon-layered/compile.mjs';
import { build, toSource, carriers, jawFloor, bakeLayered, vec, add, address, clone, cross, ctl, frameAt, loftLabels, loftParts, mul, pinToAddress, pinned, refineSlot, refineStation, ringAt, rot, strip, sub, sweep, symmetricFrameAt, tiles, unit, volumize } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
import { mirrorFaceId, mirrorPid } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { placeSurfaceOffset, surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';

// ════════════════════════════ CORE lives in control/lib/graph/polygonizer/station-loft-detail.js ════════════════════════════

// ════════════════════════════ HEAD DATA (species lives here) ════════════════════════════
const S = 0.8, O = [0, 0, 2.05]; const W = (p) => [p[0] * S + O[0], p[1] * S + O[1], p[2] * S + O[2]];
const teethRow = (L1, name, s0, s1, t, count, sizeOf, side, down, tag = '') => { const out = {}; for (let i = 0; i < count; i++) { const s = s0 + (s1 - s0) * i / (count - 1); const f = frameAt(L1, name, [s, t], 'R');
  const len = sizeOf(i); const ax = unit(surfaceLocalOffset(f, add(f.origin, add(mul(down, len), [0, -0.2 * len, 0])))); const k = cross([0, 0, 1], ax); const ang = Math.acos(Math.max(-1, Math.min(1, ax[2])));
  const m = loftParts([[0, 0, -0.006], [0, 0, len * 0.35], [0, 0, len * 0.7]].map((p, j) => ringAt(p, [0, 0, 1], [0.011, 0.009, 0.005][j] * Math.min(1, len / 0.04 + 0.3), 4, Math.PI / 4)), [0, 0, -0.012], [0, 0, len]);
  out[`tooth${tag}${name === 'jaw' ? 'L' : 'U'}.${i}`] = pinned(L1, name, [s, t], side, { ...m, points: Object.fromEntries(Object.entries(m.points).map(([q, p]) => [q, Math.hypot(...k) > 1e-9 ? rot(p, unit(k), ang) : p])) }, 'Teeth'); } return out; };
const jawVolume = (r, amount) => { refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5); volumize(r, 'jaw', { 'chin*': 1, bottom: 0.55, 'jaw*': 0.35 }, { st0: 0.3, st1: 0.8, st2: 1, st3: 1, st4: 0.7, st5: 0.35 }, amount); };
/** author a station/slot recipe from a table (head units → metres through W); right side given, left mirrored */
function stationRecipe({ cranium, jaw, bandGroup, dials }) {
  const part = ({ slots, rows, caps, group, bands }) => { const stations = rows.map(([id, y, pts]) => { const p = {}; for (const [slot, v] of Object.entries(pts)) {
      if (typeof v === 'number') p[slot] = W([0, y, v]); else { p[`${slot}R`] = W([v[0], y, v[1]]); p[`${slot}L`] = W([-v[0], y, v[1]]); } } return { id, points: p }; });
    const bandGroups = bands ? Object.fromEntries(rows.slice(0, -1).map(([id], i) => [`${id}-${rows[i + 1][0]}`, bands(i)])) : undefined;
    return { layer: 1, closure: 'closed', slots, stations, caps: { back: W(caps.back), tip: W(caps.tip) }, group, ...(bandGroups ? { bandGroups } : {}), capGroups: { back: group, tip: caps.tipGroup || group } }; };
  return { schema: 'layered-station-head-v1', frame: { up: '+z', front: '+y' }, dials, parts: { cranium: part(cranium), jaw: part(jaw) }, creases: {} };
}
const DRAGON = clone(loadRecipe());
/** author skin maps by landmark name, compile them to ADDRESSES with a falloff radius: `st2.brow` →
 * { at: [2, t(browR)] } against the head's ORIGINAL slot list, so refinement never changes their meaning */
const addressMaps = (slots, skinSpec, r) => Object.fromEntries(Object.entries(skinSpec).map(([k, c]) => [k, { ...c, map: c.map.map(([pt, w, dir]) => {
  const [st, sl] = pt.split('.'); const t = slots.indexOf(`${sl}R`) >= 0 ? slots.indexOf(`${sl}R`) : slots.indexOf(sl); if (t < 0) throw new Error(`landmark ${pt}`);
  return { at: [Number(st.slice(2)), t], r, w, dir }; }) }]));
const DRAGON_SLOTS = [...DRAGON.parts.cranium.slots];
const DRAGON_L1 = compile(DRAGON, {}, { details: false, creases: false }).parts;   // the authored (unrefined) head, for migrating face pins
const JAW_HINGE = DRAGON.dials.jawOpen;
const ORBIT = { open: [0.5, 0.42], reach: [0.02, 0.024, 0.024], tuck: 0.004, bulk: [0.004, 0.006], thickness: 0.006 };

const HEADS = {
  dragon: {
    recipe: (() => { const r = clone(DRAGON);
      // the jaw FLOOR as data: two named slot pairs (jowl between gum and jaw side, chin between jaw side
      // and bottom) give the cross-section room to round, then radial volume, fullest mid-jaw, kept at the chin
      refineSlot(r, 'jaw', 'gum', 'jawR', 'jowl', 0.5); refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5);
      volumize(r, 'jaw', { 'jowl*': 0.15, 'jaw*': 0.6, 'chin*': 1, bottom: 1.15 }, { st0: 0.45, st1: 0.85, st2: 1, st3: 1, st4: 0.85, st5: 0.6 }, 0.05);   // the floor takes the volume; the gum wall stays low so teeth stay proud
      // density where the face MOVES: halve the face stations, split the temple (brow→side) and cheek (side→lip) bands
      for (const [a, b] of [['st1', 'st2'], ['st2', 'st3'], ['st3', 'st4'], ['st4', 'st5']]) refineStation(r, 'cranium', a, b);
      refineSlot(r, 'cranium', 'brow', 'sideR', 'temple'); refineSlot(r, 'cranium', 'side', 'lipR', 'cheek');
      return r; })(),
    skin: addressMaps(DRAGON_SLOTS, {
      browRaise: { amp: 0.022, map: [['st1.brow', 0.4, [0, 0, 1]], ['st2.brow', 0.9, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.022, map: [['st2.brow', 0.5, [0, 0, -1]], ['st3.brow', 1, [-0.35, 0.1, -1]], ['st4.brow', 0.3, [0, 0, -1]]] },
      browArch: { amp: 0.014, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.026, map: [['st3.lip', 0.55, [0.2, 0, 1]], ['st4.lip', 1, [0.25, 0, 1]], ['st4.side', 0.45, [0.4, 0, 1]], ['st4.brow', 0.25, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.02, map: [['st2.side', 1, [0.6, 0, 0.8]], ['st3.side', 0.7, [0.6, 0, 0.8]], ['st2.lip', 0.4, [0.3, 0, 1]]] },
      cornerRetract: { amp: 0.03, map: [['st1.lip', 0.6, [0.1, -1, 0.3]], ['st2.lip', 1, [0.2, -1, 0.4]]] },
    }, 0.11),
    eye: { mode: 'iris', pupil: 'slit', catchlight: true },
    regions: {
      eye: { at: [2.45, 1.55], R: 0.027 }, orbit: ORBIT,
      brow: { strip: [[1.25, 1.1], [1.8, 1.08], [2.35, 1.1], [2.85, 1.14], [3.3, 1.2]], w: 0.021, h: 0.014, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [4.55, 0.6], r: 0.017, squash: [1.6, 1] },
      fold: { strip: [[4.15, 1.35], [3.6, 1.75], [3.05, 2.2], [2.5, 2.55], [1.95, 2.8]] },
      web: { cranium: [0.35, 1.9, 2.97], jaw: [0.35, 1.9, 0.97] },
      tiles: [
        // shingled hex scales, leaning back so each overlaps the one behind it; they fade out at the patch edge
        { part: 'cranium', s: [1.15, 3.1], t: [2.0, 2.8], grid: [8, 3], brick: true, sides: 6, coverage: 1.25, inset: 0.35, height: 0.007, lean: -0.9, edgeFade: 0.3, wobble: 0.2, jitter: 0.3, group: ['Scales', 'ScalesAlt'] },   // cheek
        { part: 'jaw', s: [0.6, 4.4], t: [1.15, 2.35], grid: [13, 2], brick: true, sides: 6, coverage: 1.25, inset: 0.35, height: 0.008, lean: -0.9, edgeFade: 0.2, wobble: 0.2, jitter: 0.3, group: ['Scales', 'ScalesAlt'] },   // jaw side
        { part: 'cranium', s: [3.2, 4.3], t: [0.05, 0.95], grid: [4, 2], brick: true, sides: 6, coverage: 1.1, inset: 0.25, height: 0.006, lean: -0.5, edgeFade: 0.25, wobble: 0.15, group: ['Plates'] },   // snout plates
      ],
      tongue: { at: [0.9, 0.02], to: 4.3, slide: 0.08, width: 0.075, thickness: 0.028, lift: 0, seat: 0.003, groove: 0.35, tip: 'fork', forkDepth: 0.24, forkSpread: 0.32, curlMax: 2.2, swayMax: 0.9, droop: 0.9 },
    },
    ornaments: ({ bone, rest, side, x }) => {
      const at = [1.55, 0.55]; const f = frameAt(rest, 'cranium', at, 'R');
      const spine = [[0.11, -0.22, 0.20], [0.15, -0.30, 0.25], [0.19, -0.39, 0.29], [0.22, -0.48, 0.32], [0.245, -0.56, 0.35], [0.26, -0.63, 0.39], [0.265, -0.68, 0.44], [0.26, -0.71, 0.49]].map((p) => surfaceLocalOffset(f, W(p)));
      const horn = sweep(spine, [0.045, 0.043, 0.036, 0.032, 0.024, 0.019, 0.011].map((v, j) => v * (j % 2 ? 0.92 : 1.06)), 6, { curl: x.hornCurl || 0, curlAxis: cross(sub(spine[2], spine[0]), sub(spine[6], spine[2])) });
      return { horn: pinned(bone, 'cranium', at, side, horn, 'Horns', { creases: horn.rings.filter((_, j) => j % 2 === 0 && j > 0).flatMap((rr) => rr.map((a, i) => [a, rr[(i + 1) % rr.length]])) }),
        ...teethRow(bone, 'cranium', 3.05, 4.9, 3.05, 6, (i) => (i === 1 ? 0.07 : 0.042 - i * 0.003), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.1, 4.85, 0.88, 5, (i) => (i === 1 ? 0.06 : 0.036 - i * 0.002), side, [0, 0, 1]) };
    },
    midline: ({ bone }) => Object.fromEntries(['crest1', 'crest2', 'crest3'].map((c) => { const p = DRAGON.parts[c]; const { at, flip } = pinToAddress(DRAGON_L1.cranium, p.pin); const f = symmetricFrameAt(bone, 'cranium', at);
      const pr = address(bone, 'cranium', at[0], at[1], 'R'); const n = bone.cranium.slots.length; const pin = { ...pr, mirror: { face: mirrorFaceId(pr.face, n), tangentEdge: pr.tangentEdge.map(mirrorPid) } };   // the grammar's symmetric pin
      return [c, { group: 'Crest', creases: [], pin, points: Object.fromEntries(Object.entries(p.offsets).map(([k, o]) => [k, placeSurfaceOffset(f, flip ? [-o[0], -o[1], o[2]] : o)])), faces: Object.values(p.faces) }]; })),
    palette: { Skull: '#6f8a6a', Snout: '#6f8a6a', Lip: '#67805f', Palate: '#8a5b55', Jaw: '#66805f', Body: '#6f8a6a', Brow: '#566f4f', Pad: '#66805f', Lids: '#5d7a57', LidRim: '#34452f', Horns: '#d8cdb4', Teeth: '#efe8d6', Crest: '#b9ad8f', Scales: '#5f7a59', ScalesAlt: '#6c8865', Plates: '#7b9373', Nostrils: '#34422f', Folds: '#5d7757', Mouth: '#5a2f30', Web: '#67805f', Tongue: '#8e3b4a', Sclera: '#e2d6b0', Iris: '#e0a526', Limbus: '#3a2a14', Pupil: '#121212', Catchlight: '#ffffff' },
  },
  // a BEAR authored from its OWN station table: 12 cranium slots (not 8), 7 stations with a stop between
  // brow and muzzle, a short narrow muzzle whose upper lip overhangs a small set-back jaw, a nose pad,
  // round ears, canines only. Same core, same expressions.
  bear: {
    recipe: (() => { const r = stationRecipe({
      cranium: { slots: ['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate', 'lipL', 'jowlL', 'cheekL', 'browL', 'crownL'], group: 'Skull',
        rows: [ // [station, y, { top z, crown [x,z], brow, cheek, jowl, lip, palate z }] in head units
          ['st0', -0.34, { top: 0.12, crown: [0.10, 0.10], brow: [0.15, 0.04], cheek: [0.18, -0.06], jowl: [0.16, -0.16], lip: [0.10, -0.22], palate: -0.23 }],
          ['st1', -0.22, { top: 0.22, crown: [0.14, 0.19], brow: [0.21, 0.10], cheek: [0.25, -0.04], jowl: [0.23, -0.17], lip: [0.15, -0.25], palate: -0.25 }],   // deep cheeks hide the jaw hinge
          ['st2', -0.07, { top: 0.23, crown: [0.14, 0.20], brow: [0.21, 0.12], cheek: [0.25, -0.01], jowl: [0.22, -0.14], lip: [0.14, -0.21], palate: -0.21 }],
          ['st3', 0.06, { top: 0.16, crown: [0.11, 0.14], brow: [0.16, 0.08], cheek: [0.18, -0.02], jowl: [0.15, -0.10], lip: [0.11, -0.15], palate: -0.155 }],   // the stop
          ['st4', 0.12, { top: 0.08, crown: [0.075, 0.07], brow: [0.10, 0.035], cheek: [0.11, -0.03], jowl: [0.10, -0.085], lip: [0.085, -0.13], palate: -0.135 }],   // muzzle root
          ['st5', 0.21, { top: 0.065, crown: [0.065, 0.055], brow: [0.085, 0.02], cheek: [0.092, -0.035], jowl: [0.085, -0.085], lip: [0.07, -0.125], palate: -0.125 }],
          ['st6', 0.29, { top: 0.05, crown: [0.05, 0.042], brow: [0.066, 0.01], cheek: [0.072, -0.035], jowl: [0.066, -0.075], lip: [0.055, -0.11], palate: -0.11 }],
        ], caps: { back: [0, -0.40, -0.02], tip: [0, 0.325, -0.03], tipGroup: 'Snout' },
        bands: (i) => (i < 3 ? ['Skull', 'Skull', 'Skull', 'Skull', 'Jowl', 'Palate'] : ['Snout', 'Snout', 'Snout', 'Snout', 'Jowl', 'Palate']) },
      jaw: { slots: ['gum', 'gumR', 'jawR', 'bottom', 'jawL', 'gumL'], group: 'Jaw',
        rows: [
          ['st0', -0.18, { gum: -0.17, gumR: [0.10, -0.17], jawR: [0.11, -0.22], bottom: -0.245 }],
          ['st1', -0.05, { gum: -0.16, gumR: [0.09, -0.16], jawR: [0.10, -0.21], bottom: -0.235 }],
          ['st2', 0.08, { gum: -0.145, gumR: [0.07, -0.145], jawR: [0.075, -0.185], bottom: -0.205 }],
          ['st3', 0.18, { gum: -0.135, gumR: [0.055, -0.135], jawR: [0.058, -0.165], bottom: -0.18 }],
          ['st4', 0.26, { gum: -0.125, gumR: [0.042, -0.125], jawR: [0.044, -0.148], bottom: -0.16 }],
        ], caps: { back: [0, -0.24, -0.20], tip: [0, 0.29, -0.14] } },
      dials: { jawOpen: JAW_HINGE } });
      // the table's slot pairs are named without R/L; rename to the grammar's convention
      for (const P of Object.values(r.parts)) for (const st of P.stations) for (const k of Object.keys(st.points)) { const m = k.match(/^(.*)(R|L)(R|L)$/); if (m) { st.points[m[1] + m[3]] = st.points[k]; delete st.points[k]; } }
      jawVolume(r, 0.022);
      for (const [a, b] of [['st2', 'st3'], ['st3', 'st4'], ['st4', 'st5'], ['st5', 'st6']]) refineStation(r, 'cranium', a, b);
      refineSlot(r, 'cranium', 'cheek', 'jowlR', 'flank'); refineSlot(r, 'cranium', 'jowl', 'lipR', 'flew');
      return r; })(),
    skin: addressMaps(['top', 'crownR', 'browR', 'cheekR', 'jowlR', 'lipR', 'palate'], {
      browRaise: { amp: 0.02, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
      browFurrow: { amp: 0.02, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
      browArch: { amp: 0.012, map: [['st2.brow', 1, [0, 0, 1]]] },
      sneer: { amp: 0.022, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
      cheekBunch: { amp: 0.018, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
      cornerRetract: { amp: 0.025, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
    }, 0.09),
    eye: { mode: 'iris', pupil: 'round', irisAngle: 44, catchlight: true },
    regions: {
      eye: { at: [2.55, 2.45], R: 0.021 }, orbit: { ...ORBIT, open: [0.55, 0.45], reach: [0.016, 0.02, 0.024], bulk: [0.003, 0.008] },
      brow: { strip: [[1.9, 2.08], [2.2, 2.03], [2.55, 2.03], [2.85, 2.08], [3.15, 2.2]], w: 0.016, h: 0.011, taper: [0.55, 0.9, 1, 0.9, 0.6], facing: 'down' },
      nostril: { at: [5.92, 1.3], r: 0.01, squash: [1.3, 1], slide: 0.4 },
      fold: { strip: [[5.5, 1.8], [5.0, 2.6], [4.4, 3.4], [3.85, 4.1], [3.4, 4.6]] },
      web: { cranium: [1.6, 3.2, 4.97], jaw: [0.4, 2.1, 0.97] },
      tiles: [
        // pointed tufts: triangular footprints, a steep inset, leaning back; the same op as the scales
        { part: 'cranium', s: [0.4, 2.1], t: [3.05, 4.6], grid: [6, 3], brick: true, sides: 3, coverage: 1.2, inset: 0.85, height: 0.026, lean: -1.1, edgeFade: 0.25, wobble: 0.3, jitter: 0.35, group: ['Fur', 'FurAlt'] },   // cheek ruff
        { part: 'cranium', s: [0.2, 1.6], t: [0.15, 1.5], grid: [5, 3], brick: true, sides: 3, coverage: 1.2, inset: 0.85, height: 0.018, lean: -1.2, edgeFade: 0.25, wobble: 0.3, jitter: 0.35, group: ['Fur', 'FurAlt'] },   // crown tufts
      ],
      tongue: { at: [0.6, 0.02], to: 3.2, slide: 0.05, width: 0.09, thickness: 0.03, lift: 0, seat: 0.003, groove: 0.3, tip: 'round', curlMax: 1.8, swayMax: 0.8, droop: 1.3 },
    },
    ornaments: ({ bone, side, ctl }) => {
      // round ear: a thick disc standing on the crown, facing forward; earAttitude tilts it (forward +, pinned back −)
      const a = 0.8 * ctl('earAttitude'); const tilt = (p) => rot(rot(p, [0, 0, 1], -0.6), [0, 1, 0], -a);
      const ear = loftParts([[-0.009, 0.042], [0.0, 0.05], [0.008, 0.044]].map(([x0, r]) => ringAt([x0, 0, 0.036], [1, 0, 0], r, 10).map(tilt)), tilt([-0.014, 0, 0.036]), tilt([0.004, 0, 0.036]));
      const nose = sweep([[0, 0, -0.012], [0, 0, 0.012], [0, 0, 0.022]], [0.034, 0.03], 8, { squash: [1.35, 1] });
      return { ear: { ...pinned(bone, 'cranium', [1.25, 0.9], side, ear, 'Ears'), faceGroups: loftLabels(ear, () => 'Ears', ['Ears', 'EarInner']) },
        ...(side === 'R' ? { nose: pinned(bone, 'cranium', [5.75, 0.0001], 'R', nose, 'NosePad') } : {}),
        ...teethRow(bone, 'cranium', 5.1, 5.5, 5.2, 2, (i) => (i === 0 ? 0.03 : 0.012), side, [0, 0, -1]),
        ...teethRow(bone, 'jaw', 3.3, 3.7, 0.88, 2, (i) => (i === 0 ? 0.026 : 0.01), side, [0, 0, 1]) };
    },
    palette: { Skull: '#7a5a3c', Snout: '#b08e68', Jowl: '#9a7853', Palate: '#7d4a44', Jaw: '#9a7853', Body: '#7a5a3c', Brow: '#65482e', Pad: '#86664a', Lids: '#6f5235', LidRim: '#2e2016', Ears: '#6c4f34', EarInner: '#a07c5a', Fur: '#6a4c32', FurAlt: '#7d5b3d', NosePad: '#211813', Teeth: '#efe8d6', Nostrils: '#0e0a08', Folds: '#9a7853', Mouth: '#4a2a28', Web: '#8d6b4a', Tongue: '#c0626a', Sclera: '#efe9dc', Iris: '#5a3a1a', Limbus: '#1e140a', Pupil: '#0e0e0e', Catchlight: '#ffffff' },
  },
};


// ════════════════════════════ EXPRESSIONS (species-neutral) ════════════════════════════
const EXPRESSIONS = {
  neutral: {},
  pant: { jawOpen: 22, tongueOut: 1, tongueCurl: -0.5, tongueSway: 0.35, browRaise: 0.3, cornerRetract: 0.5, lidClose: 0.1, earAttitude: 0.2 },
  flick: { jawOpen: 10, tongueOut: 1, tongueCurl: 0.18, tongueSway: -0.2, browFurrow: 0.4, lidClose: 0.3, nostrilFlare: 0.6 },
  surprise: { jawOpen: 9, browRaise: 1, browArch: 1, lidClose: -0.35, nostrilFlare: 0.5, cornerRetract: -0.3, earAttitude: 0.6 },
  snarl: { tongueCurl: 0.35, jawOpen: 16, browFurrow: 1, sneer: 1, cheekBunch: 0.8, cornerRetract: 0.7, nostrilFlare: 1, lidClose: 0.45, hornCurl: 0.35, earAttitude: -1, eyeGaze: [14, -6] },
};

export { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile, refineStation, refineSlot, loadRecipe, clone, jawFloor, bakeLayered, address };
export { vec };
