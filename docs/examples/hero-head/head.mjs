/** hero-head/head.mjs — a HUMAN head as HEAD DATA over the layered grammar's detail operators
 * (control/lib/graph/polygonizer/station-loft-detail.js), the way head-detail/compile.mjs carries the dragon
 * and the bear. Everything anatomical is here: the station table (a cranium lofted back → front whose last
 * bands are the face, a jaw hinged under it), skin maps by landmark, the eye / brow / nostril / fold / cheek-web
 * regions, ears and a nose as ornaments, HAIR as detail grown from the skull (a cap of tiles, a fringe of
 * leaning tiles, a tail swept from the nape), expressions, the palette. `heroHead({ hair, eye, palette })`
 * returns the head object `build` / `bakeLayered` consume; metres, +y front, +z up, the atlas at the origin,
 * so the hero plan wears the baked head at its `headBase`. Deterministic: the only dice are the tiles' seeds. */
import { build, toSource, carriers, bakeLayered, vec, frameAt, loftParts, ringAt, pinned, strip, sweep, refineStation, refineSlot, volumize, symmetricFrameAt, address, clone, rot, loftLabels } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
import { mirrorFaceId, mirrorPid } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { placeSurfaceOffset, surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';

const { sub, add, mul, cross, unit } = vec;

// ── the station table: right side given, left mirrored; a value is z on the midline or [x, z] on the right (a key may carry its R) ──
function stationRecipe({ cranium, jaw, dials }) {
  const part = ({ slots, rows, caps, group, bands }) => { const stations = rows.map(([id, y, pts]) => { const p = {}; for (const [slot, v] of Object.entries(pts)) {
      if (typeof v === 'number') p[slot] = [0, y, v]; else { const b = slot.endsWith('R') ? slot.slice(0, -1) : slot; p[`${b}R`] = [v[0], y, v[1]]; p[`${b}L`] = [-v[0], y, v[1]]; } } return { id, points: p }; });
    const bandGroups = bands ? Object.fromEntries(rows.slice(0, -1).map(([id], i) => [`${id}-${rows[i + 1][0]}`, bands(i)])) : undefined;
    return { layer: 1, closure: 'closed', slots: [...slots], stations, caps: { back: [...caps.back], tip: [...caps.tip] }, group, ...(bandGroups ? { bandGroups } : {}), capGroups: { back: group, tip: caps.tipGroup || group } }; };
  return { schema: 'layered-station-head-v1', frame: { up: '+z', front: '+y' }, dials, parts: { cranium: part(cranium), jaw: part(jaw) }, creases: {} };
}
/** skin maps by landmark name (`st4.forehead`) → addresses with a falloff radius, against the ORIGINAL slot list */
const addressMaps = (slots, skinSpec, r) => Object.fromEntries(Object.entries(skinSpec).map(([k, c]) => [k, { ...c, map: c.map.map(([pt, w, dir]) => {
  const [st, sl] = pt.split('.'); const t = slots.indexOf(`${sl}R`) >= 0 ? slots.indexOf(`${sl}R`) : slots.indexOf(sl); if (t < 0) throw new Error(`landmark ${pt}`);
  return { at: [Number(st.slice(2)), t], r, w, dir }; }) }]));

// ── the cranium: seven stations from the occiput to the upper lip; the face is the last three bands, where the
// sections converge fast so their normals face forward. Slots: top, forehead, eye, cheek, jaw, lip, palate. ──
const CRANIUM_SLOTS = ['top', 'foreheadR', 'eyeR', 'cheekR', 'jawR', 'lipR', 'palate', 'lipL', 'jawL', 'cheekL', 'eyeL', 'foreheadL'];
const CRANIUM_ROWS = [ // [station, y, { top z, forehead [x, z], eye, cheek, jaw, lip, palate z }] metres from the atlas
  // the cranium carries the CHEEKS: the `jaw` slot runs along the jawline (the mandible's lower edge), so the band from
  // the cheekbone down to it is one cheek plane and the band from it up to the lip is the cheek's underside; the
  // hinged jaw part sits inside that U and shows only its chin and underside
  ['st0', -0.095, { top: 0.105, forehead: [0.038, 0.095], eye: [0.060, 0.058], cheek: [0.064, 0.012], jaw: [0.050, -0.030], lip: [0.026, -0.034], palate: -0.038 }],
  ['st1', -0.055, { top: 0.165, forehead: [0.055, 0.152], eye: [0.083, 0.085], cheek: [0.088, 0.020], jaw: [0.078, -0.070], lip: [0.036, -0.044], palate: -0.048 }],
  ['st2',  0.000, { top: 0.190, forehead: [0.060, 0.176], eye: [0.090, 0.098], cheek: [0.094, 0.028], jaw: [0.082, -0.085], lip: [0.042, -0.050], palate: -0.055 }],
  ['st3',  0.048, { top: 0.185, forehead: [0.058, 0.172], eye: [0.088, 0.096], cheek: [0.090, 0.028], jaw: [0.078, -0.082], lip: [0.042, -0.052], palate: -0.056 }],
  ['st4',  0.076, { top: 0.165, forehead: [0.054, 0.152], eye: [0.076, 0.078], cheek: [0.078, 0.020], jaw: [0.066, -0.078], lip: [0.038, -0.052], palate: -0.056 }],
  // the face: from here the sections keep their height and lose their width, so the last bands stand nearly vertical
  ['st5',  0.090, { top: 0.140, forehead: [0.042, 0.128], eye: [0.040, 0.062], cheek: [0.044, 0.015], jaw: [0.040, -0.074], lip: [0.028, -0.040], palate: -0.056 }],
  ['st6',  0.098, { top: 0.120, forehead: [0.026, 0.110], eye: [0.012, 0.058], cheek: [0.014, 0.012], jaw: [0.014, -0.070], lip: [0.012, -0.040], palate: -0.056 }],
];
const JAW_ROWS = [ // [station, y, { gum z, gumR [x, z], jawR [x, z], bottom z }]: the mandible, narrower than the cheeks above it
  ['st0',  0.000, { gum: -0.058, gumR: [0.050, -0.058], jawR: [0.062, -0.080], bottom: -0.088 }],
  ['st1',  0.040, { gum: -0.060, gumR: [0.048, -0.060], jawR: [0.060, -0.092], bottom: -0.100 }],
  ['st2',  0.072, { gum: -0.060, gumR: [0.040, -0.060], jawR: [0.048, -0.096], bottom: -0.104 }],
  ['st3',  0.090, { gum: -0.058, gumR: [0.026, -0.058], jawR: [0.032, -0.094], bottom: -0.102 }],
];
const JAW_HINGE = { min: 0, max: 30, rest: 0, doc: 'degrees the jaw part rotates about its hinge slot (the chin goes down)', op: 'hinge', part: 'jaw', pivot: 'jaw/st0.gum', axis: 'x', sign: -1 };

// ── hair: detail grown from the skull, three styles as data; a head wears a list of them ──
export const HAIR = {
  // a cap of square tufts over the crown, leaning back, fading at the hairline: the blocky helmet-of-hair read
  cap: { tiles: [{ part: 'cranium', s: [0.15, 4.3], t: [0.0, 1.5], grid: [6, 3], brick: true, sides: 4, coverage: 1.2, inset: 0.15, height: 0.014, lean: -0.5, edgeFade: 0.12, wobble: 0.12, jitter: 0.25, group: ['Hair', 'HairAlt'] }] },
  // a fringe: tufts on the forehead band leaning forward and down over the brow
  bangs: { tiles: [{ part: 'cranium', s: [4.3, 5.0], t: [0.05, 1.2], grid: [2, 3], brick: false, sides: 4, coverage: 1.15, inset: 0.1, height: 0.018, lean: 1.4, edgeFade: 0.05, wobble: 0.1, jitter: 0.2, group: ['Hair', 'HairAlt'] }] },
  // a tail swept from the nape, curling down the back of the neck
  tail: { midline: ({ bone }) => { const at = [0.35, 0.9]; const f = symmetricFrameAt(bone, 'cranium', at);
    const spine = [[0, -0.015, 0.02], [0, -0.05, 0.0], [0, -0.075, -0.05], [0, -0.085, -0.11], [0, -0.075, -0.17]].map((p) => surfaceLocalOffset(f, add(f.origin, p)));
    const m = sweep(spine, [0.026, 0.03, 0.027, 0.018], 6, { squash: [1.3, 1] });
    const pr = address(bone, 'cranium', at[0], at[1], 'R'); const n = bone.cranium.slots.length; const pin = { ...pr, mirror: { face: mirrorFaceId(pr.face, n), tangentEdge: pr.tangentEdge.map(mirrorPid) } };
    return { hairTail: { group: 'Hair', creases: [], pin, points: Object.fromEntries(Object.entries(m.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: m.faces } }; } },
};

export const PALETTE = { Skull: '#e6b48c', Lip: '#d4917a', Palate: '#8a5b55', Jaw: '#e6b48c', Brow: '#3a2a1e', Pad: '#e6b48c', Lids: '#e2aa84', LidRim: '#6b4634', Sclera: '#f6f3ec', Limbus: '#2b4a66', Iris: '#3f77a8', Pupil: '#141414', Catchlight: '#ffffff', Nostrils: '#6b4634', Folds: '#e6b48c', Mouth: '#6e3232', Web: '#e6b48c', Ears: '#e6b48c', EarInner: '#d4917a', Nose: '#e6b48c', Hair: '#3a2a1e', HairAlt: '#4b3727' };

/**
 * @param {object} opts
 *   hair     a list of HAIR keys (default ['cap'])
 *   eye      overrides for the eye spec (mode, pupil, irisAngle, catchlight)
 *   palette  overrides for PALETTE (Hair, Skull, Iris …)
 */
export function heroHead({ hair = ['cap'], eye = {}, palette = {} } = {}) {
  const styles = hair.map((h) => { if (!HAIR[h]) throw new Error(`hero-head: unknown hair style '${h}' (have ${Object.keys(HAIR).join(', ')})`); return HAIR[h]; });
  const recipe = (() => {
    const r = stationRecipe({
      cranium: { slots: CRANIUM_SLOTS, rows: CRANIUM_ROWS, caps: { back: [0, -0.103, 0.04], tip: [0, 0.101, 0.03] }, group: 'Skull', bands: () => ['Skull', 'Skull', 'Skull', 'Skull', 'Skull', 'Skull'] },
      jaw: { slots: ['gum', 'gumR', 'jawR', 'bottom', 'jawL', 'gumL'], rows: JAW_ROWS, caps: { back: [0, -0.02, -0.075], tip: [0, 0.098, -0.082] }, group: 'Jaw', bands: (i) => (i >= 1 ? ['Lip', 'Jaw', 'Jaw'] : ['Jaw', 'Jaw', 'Jaw']) },
      dials: { jawOpen: JAW_HINGE } });
    // the chin: a slot pair between the jaw side and the bottom, then volume fullest at the chin
    refineSlot(r, 'jaw', 'jaw', 'bottom', 'chin', 0.5); volumize(r, 'jaw', { 'chin*': 1, bottom: 0.6, 'jaw*': 0.3 }, { st0: 0.2, st1: 0.6, st2: 1, st3: 1 }, 0.006);
    // density where the face moves: halve the face bands and split the eye and cheek columns
    for (const [a, b] of [['st3', 'st4'], ['st4', 'st5'], ['st5', 'st6']]) refineStation(r, 'cranium', a, b);
    refineSlot(r, 'cranium', 'forehead', 'eyeR', 'browline'); refineSlot(r, 'cranium', 'eye', 'cheekR', 'orbit');
    // the MOUTH at rest: the lip slot sits a little above the palate, so on the face stations the band between them
    // stands on the front; split it into an upper lip and a parting line (band groups by name, not by index)
    refineSlot(r, 'cranium', 'lip', 'palate', 'mouth', 0.6);
    const C = r.parts.cranium; const kLip = C.slots.indexOf('mouthR') - 1;   // band k = between slot k and k + 1 on the right half
    for (const [key, arr] of Object.entries(C.bandGroups)) { const [a] = key.split('-'); const y = C.stations.find((st) => st.id === a).points.top[1]; if (y >= 0.084) { arr[kLip] = 'Lip'; arr[kLip + 1] = 'Mouth'; } }
    return r; })();
  return {
    recipe,
    skin: addressMaps(CRANIUM_SLOTS, {
      browRaise: { amp: 0.008, map: [['st4.forehead', 0.7, [0, 0, 1]], ['st5.forehead', 1, [0, 0.2, 1]]] },
      browFurrow: { amp: 0.007, map: [['st5.forehead', 1, [-0.5, 0.1, -0.8]], ['st4.forehead', 0.4, [0, 0, -1]]] },
      browArch: { amp: 0.005, map: [['st4.forehead', 1, [0.2, 0, 1]]] },
      sneer: { amp: 0.007, map: [['st5.lip', 1, [0.2, 0, 1]], ['st6.lip', 0.6, [0.1, 0, 1]]] },
      cheekBunch: { amp: 0.008, map: [['st4.cheek', 1, [0.5, 0.2, 0.8]], ['st5.cheek', 0.7, [0.4, 0.2, 0.8]]] },
      cornerRetract: { amp: 0.010, map: [['st5.lip', 1, [0.3, -1, 0.35]], ['st4.lip', 0.5, [0.2, -1, 0.3]]] },
    }, 0.03),
    eye: { mode: 'iris', pupil: 'round', irisAngle: 40, catchlight: true, ...eye },
    regions: {
      eye: { at: [4.9, 2.0], R: 0.015 }, orbit: { open: [0.6, 0.5], reach: [0.012, 0.016, 0.018], tuck: 0.003, bulk: [0.002, 0.005], thickness: 0.004 },
      brow: { strip: [[4.0, 1.4], [4.4, 1.35], [4.8, 1.35], [5.2, 1.4], [5.6, 1.6]], w: 0.012, h: 0.008, taper: [0.5, 0.9, 1, 0.9, 0.5], facing: 'down' },
      nostril: { at: [5.9, 3.0], r: 0.004, squash: [1.4, 1], slide: 0.3 },
      fold: { strip: [[5.7, 3.3], [5.4, 3.9], [5.1, 4.5]] },
      web: { cranium: [0.3, 5.0, 4.97], jaw: [0.2, 2.5, 0.97] },
      tiles: styles.flatMap((s) => s.tiles || []),
    },
    ornaments: ({ bone, side }) => {
      // the ear: a thick disc standing off the side of the skull at the ear plane, its rim slightly back
      const ear = loftParts([[-0.004, 0.028], [0.005, 0.032], [0.011, 0.026]].map(([h, r]) => ringAt([0, 0.004, h], [0, 0, 1], r, 8, 0, [0.75, 1])), [0, 0.004, -0.008], [0, 0.004, 0.014]);
      return { ear: { ...pinned(bone, 'cranium', [2.0, 2.9], side, ear, 'Ears'), faceGroups: loftLabels(ear, () => 'Ears', ['Ears', 'EarInner']) } };
    },
    // midline parts: the nose (a short wedge at a symmetric frame at eye level, so it stays on x = 0) and any hair a style grows there
    midline: (ctx) => { const { bone } = ctx; const at = [5.85, 2.3]; const f = symmetricFrameAt(bone, 'cranium', at);
      const m = sweep([[0, 0, -0.005], [0, 0, 0.012], [0, -0.008, 0.02]], [0.012, 0.011], 6, { squash: [0.8, 1] });
      const pr = address(bone, 'cranium', at[0], at[1], 'R'); const n = bone.cranium.slots.length; const pin = { ...pr, mirror: { face: mirrorFaceId(pr.face, n), tangentEdge: pr.tangentEdge.map(mirrorPid) } };
      return Object.assign({ nose: { group: 'Nose', creases: [], pin, points: Object.fromEntries(Object.entries(m.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: m.faces } }, ...styles.map((s) => (s.midline ? s.midline(ctx) : {}))); },
    palette: { ...PALETTE, ...palette },
  };
}

// ── expressions: species-neutral controls, the same words the dragon and the bear take ──
export const EXPRESSIONS = {
  neutral: {},
  smile: { cornerRetract: 0.7, cheekBunch: 0.6, browRaise: 0.15, lidClose: 0.15 },
  determined: { browFurrow: 0.8, lidClose: 0.3, cornerRetract: -0.2 },
  surprised: { browRaise: 1, browArch: 0.8, lidClose: -0.35, jawOpen: 7 },
};
export const HEADS = { hero: heroHead(), heroTail: heroHead({ hair: ['cap', 'bangs', 'tail'], palette: { Hair: '#7a3a1e', HairAlt: '#8e4a2a' } }) };

/** the head as the INCLUDE a ring plan wears: `bakeLayered` at one expression (the expression is a cast; the jaw
 * hinge stays live) plus the two jaw joints a rig needs (`jawHinge` = the hinge pivot, `jawTip` = the chin cap),
 * in head metres from the atlas. A plan adds its `headBase` as the shift. */
export function bakeHero(opts = {}, expression = 'neutral') {
  const head = heroHead(opts); const baked = bakeLayered(head, EXPRESSIONS[expression] || expression);
  const jaw = head.recipe.parts.jaw; const hinge = jaw.stations.find((st) => st.id === 'st0').points.gum;
  return { name: 'head', ...baked, bind: { cranium: 'head', jaw: 'jaw' }, joints: { jawHinge: [...hinge], jawTip: [...jaw.caps.tip] }, expression: typeof expression === 'string' ? expression : 'custom', hair: opts.hair || ['cap'] };
}
export const bakedPath = new URL('./baked.json', import.meta.url);
export { build, toSource, carriers, bakeLayered, frameAt, clone, vec };
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  const { writeFileSync } = await import('node:fs');
  const baked = bakeHero(); writeFileSync(bakedPath, JSON.stringify(baked) + '\n');
  console.log('baked', Object.keys(baked.parts).length, 'parts', 'dials', Object.keys(baked.dials).join(','), 'joints', JSON.stringify(baked.joints));
}
