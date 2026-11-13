/**
 * mecha-military — a mecha frame dressed in the field's look: the military styling library's (car-designer: its livery
 * cut into the paint, livery-cut.js; its fittings on anchors, mil-fittings.js; its stencils; its wear, mil-wear.js; the
 * studio's bake, road-form.js), applied to the frame's faces as a field vehicle's are to its hull's. A frame takes it by
 * its archetype's `dress` ({ style: 'military', wear, kit }), its kit each fitting's anchor on a body.
 *
 *   readMechaDress(archetype, { livery?, wear? }) → { L, W } the livery and the wear read (the frame's own wear unless
 *                                    asked), or throws for a frame with no dress
 *   dressFaces({ manifest, anchors, colors }, { livery?, wear?, seed? }) → the frame's faces dressed, baked for the grid
 *
 *   livery   absent: its palette's paint as it is, its stencils on it; a word or { pattern, colours, … } (livery-cut.js):
 *            that camo cut into the paint, the structure in its base a shade down, as a field vehicle's frame is
 *   wear     pristine | used | battered | { level, soil } (mil-wear.js); absent, the frame's own (a field walker's used)
 *
 * The frame's parts are assembled unlit (their raw colours) and read back by colour: a face in the palette's paint is
 * the field's paint, its structure's its frame, a rod steel, its rubber rubber, its glass glass, its marks lamps. Pure.
 */
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';
import { fit } from '../car-designer/mil-fittings.js';
import { flatNormals } from '../car-designer/mil-hull.js';
import { liveryBase, paintLivery, readLivery, stencilMarks } from '../car-designer/livery-cut.js';
import { readWear, soilFor, weather } from '../car-designer/mil-wear.js';
import { bakeForm } from '../car-designer/road-form.js';
import { MECHA_COLOR_ROLES } from './mecha-common.js';
import { frameRow } from './index.js';

const MATERIAL = Object.freeze({ paint: 'milPaint', trim: 'milPaint', chrome: 'steel', rubber: 'rubber', glass: 'glass', light: 'lamp' });
// (the field's cans: olive, and now and then a sand one, rolled from the seed: road-military.js's)
const CAN_TONES = Object.freeze(['#4f5726', '#4f5726', '#8a7a55']);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** The role a raw colour was drawn from: its own, or the nearest role's it was toned from. */
function roleOf(fill, C) {
  const exact = MECHA_COLOR_ROLES.find((r) => C[r] === fill);
  if (exact) return exact;
  const t = rgb(fill);
  let best = 'paint', d = Infinity;
  for (const r of MECHA_COLOR_ROLES) { const c = rgb(C[r]), e = (c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2; if (e < d) { d = e; best = r; } }
  return best;
}

export function readMechaDress(archetype, { livery, wear } = {}) {
  const D = frameRow(archetype).dress;
  if (!D) {
    if (livery !== undefined || wear !== undefined) throw new Error(`mecha ${frameRow(archetype).label}: it wears no dress (only a dressed frame takes a livery or a wear)`);
    return null;
  }
  return { D, L: livery === undefined ? null : readLivery(livery), W: readWear(wear ?? D.wear) };
}

/** A posed frame's faces in its dress: `manifest` assembled unlit-ready (finish: false), `anchors` its kit's in the
 *  world (assembleFrame's readout), `colors` its palette's. */
export function dressFaces({ manifest, anchors = [], colors: C, archetype }, { livery, wear, seed = 1, form = false } = {}) {
  const { L: asked, W } = readMechaDress(archetype, { livery, wear });
  // (no livery asked: the palette's paint is its base, a mono of it, so its stencils have a colour to read against)
  const L = asked ?? readLivery({ pattern: 'mono', colours: [C.paint] });
  const body = lowerAssemblerFaces(manifest, { light: FLAT_LIGHT }).map((f) => {
    const role = roleOf(f.fill, C);
    return { corners: f.corners, outNormal: f.outNormal, part: `mecha.${role}`, material: MATERIAL[role], albedo: f.fill };
  });
  // (its kit on its anchors, each fitting's faces in vehicle space: the frame's own +y forward)
  let can = (seed * 2654435761) >>> 0;
  const fittings = [];
  for (const A of anchors.filter((a) => a.card)) {
    const ctx = { r: 0.4, tyreW: 0.3, paint: C.paint, seed, ...A.opts };
    if (A.card === 'jerryCans') ctx.tones = Array.from({ length: ctx.count ?? 1 }, () => { can = (can * 1103515245 + 12345) >>> 0; return CAN_TONES[can % CAN_TONES.length]; });
    fittings.push(...fit(A, A.card, ctx).map((f) => ({ ...f, fitting: A.card })));
  }
  let all = flatNormals([...body, ...fittings]);
  // (a livery asked: its pattern cut into the paint, fitted kit and frame alike; the structure in its base a shade down)
  if (asked) {
    const shade = hex(rgb(liveryBase(L)).map((v) => v * 0.62));
    all = paintLivery(all, L, { base: C.paint, seed, size: 1.2 }).map((f) => (f.albedo === C.trim && f.material === 'milPaint' ? { ...f, albedo: shade } : f));
  }
  const marks = flatNormals(stencilMarks(anchors.filter((a) => a.kind === 'mark'), L, { seed }));
  const worn = weather([...all, ...marks], W, { hubs: [], r: 0.4, seed, soil: W.soil ?? soilFor(asked), scale: 1.2 });
  // (asked for its form, `form: true`: the faces as dressed, their material and colour and no light, for a page that
  // lights them as its world is lit: mecha-figure.js mechaFigure)
  if (form) return worn;
  // (baked under the studio's light, each corner its own; the face's fill their mean, for a grid that reads one)
  return bakeForm(worn).map((f) => {
    const c = f.cornerFills.map(rgb), mean = hex([0, 1, 2].map((k) => c.reduce((s, x) => s + x[k], 0) / c.length));
    return { ...f, fill: mean, doubleSided: true };
  });
}
