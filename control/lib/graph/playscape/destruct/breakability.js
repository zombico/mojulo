/**
 * breakability — what a game lets break, as a CONVENTION it picks by degree, never a default: nothing breaks until a
 * game (or a level) says how much does. The action game's convention, for one: buildings and map fixtures hold, a set
 * of destructible objects breaks.
 *
 *   DEGREES                      none · objects (the action default: crates, barrels, amphorae, pots, glass, planks,
 *                                bones, a lid) · cover (a shooter's: furniture, doors, boulders, coffins too) · world
 *                                (walls, pilasters and set pieces as well); a level's bounds always hold
 *   readDegree(v, where)         → a degree's name, checked (null for absent)
 *   classOf(anchor)              → what a thing is, by the name it already has (a corner prop's form, a part's name,
 *                                an anchor's kind)
 *   breaksUnder(degree, cls, own?) → does a thing of that class break; `own` (a thing's `breakable: true | false`)
 *                                wins over the degree
 *   breakablesOf(payload, degree, { hp? }) → { breakables, faces, colliders, things } | null
 *                                the world's breakable things: each SOLID thing that is named on its faces (`node`, its
 *                                anchor id) and has a box becomes a runtime block (worlds/controllable rules-basic.js
 *                                `breakables`) by its id, its faces move to their own render group `break:<id>` (so the
 *                                page can hide what broke), and its own collider leaves the list (the block is one).
 *                                Things not yet named on their faces (a pooled rock) or with no collider (ankle clutter:
 *                                planks, bones) stay as they are, said in `skipped`. Null when nothing breaks.
 *   piecesOf(breakables, faces)  → { [id]: { fill, tex?, cuts, pieces } }: each breakable pre-cut once per cut it can take, for
 *                                the page to swap in when it breaks. `cuts` maps how it broke (the runtime's `how`:
 *                                swing, shot, burst, fall, crush, call) to a cut's name (cuts.js cutOf: the thing's own
 *                                cut wins); `pieces[cut]` is { style, chunks: [{ at, faces: [{ pts, cut? }] }] }, each
 *                                chunk's corners about its own centre `at`. The box is what is cut (a barrel comes apart
 *                                as a box would; the flash covers the swap). Dismantle's sever has no pieces of its own
 *                                yet: it plays the chip.
 *
 * Pure: the payload is not changed; the caller takes the lists it returns.
 */
import { cleave } from './cleave.js';
import { cutOf, CUT_PRESETS as CUT_NAMES } from './cuts.js';

const CUT_IDS = Object.keys(CUT_NAMES);
const same = (a, b) => ['pattern', 'style', 'count', 'cell'].every((k) => a[k] === b[k]);

const OBJECTS = Object.freeze(['crate', 'barrel', 'amphora', 'pot', 'vase', 'glass', 'planks', 'bones', 'lid']);
const COVER = Object.freeze([...OBJECTS, 'bench', 'chair', 'rack', 'lockers', 'cart', 'door', 'boulder', 'coffin']);
const WORLD = Object.freeze([...COVER, 'wall', 'pilaster', 'set-piece']);
export const DEGREES = Object.freeze({ none: Object.freeze([]), objects: OBJECTS, cover: COVER, world: WORLD });
export const DEGREE_IDS = Object.freeze(Object.keys(DEGREES));
// how many blows a thing takes, by class (a crate one, a coffin three); absent: one
export const THING_HP = Object.freeze({ crate: 1, barrel: 2, amphora: 1, pot: 1, vase: 1, glass: 1, lid: 2, coffin: 3, door: 3, boulder: 4, 'set-piece': 6, wall: 6, pilaster: 4 });

export function readDegree(v, where = 'destruction') {
  if (v === undefined || v === null) return null;
  if (!DEGREE_IDS.includes(v)) throw new Error(`${where} is how much a game lets break: ${DEGREE_IDS.join(', ')}`);
  return v;
}

export function classOf(a) {
  if (!a) return null;
  if (a.kind === 'part') return a.name || null;
  if (a.form && (a.kind === 'doodad' || a.kind === 'prop')) return a.form;
  return a.kind || null;
}

export function breaksUnder(degree, cls, own) {
  if (own === true || own === false) return own;
  return !!(degree && cls && DEGREES[degree] && DEGREES[degree].includes(cls));
}

export function breakablesOf(payload, degree, { hp = THING_HP } = {}) {
  if (!degree || degree === 'none') return null;
  const anchors = Array.isArray(payload?.anchors) ? payload.anchors : [];
  const faces = Array.isArray(payload?.faces) ? payload.faces : [];
  const colliders = Array.isArray(payload?.colliders) ? payload.colliders : [];
  const named = new Set(faces.filter((f) => f && typeof f.node === 'string').map((f) => f.node));
  const solid = new Map(colliders.filter((c) => c && typeof c.of === 'string').map((c) => [c.of, c]));
  const breakables = [], things = [], skipped = [], ids = new Set();
  for (const a of anchors) {
    const cls = classOf(a);
    if (!breaksUnder(degree, cls, a.breakable)) continue;
    const c = solid.get(a.id);
    if (!named.has(a.id)) { skipped.push({ id: a.id, class: cls, why: 'its faces are not named' }); continue; }
    if (!c) { skipped.push({ id: a.id, class: cls, why: 'it blocks nothing (no collider)' }); continue; }
    breakables.push({ id: a.id, min: [...c.min], max: [...c.max], hp: hp[cls] ?? 1, ...(a.cut !== undefined ? { cut: a.cut } : {}) });
    things.push({ id: a.id, class: cls });
    ids.add(a.id);
  }
  if (!breakables.length) return { breakables: [], faces, colliders, things, skipped };
  return {
    breakables,
    faces: faces.map((f) => (f && ids.has(f.node) ? { ...f, group: `break:${f.node}` } : f)),
    colliders: colliders.filter((c) => !(c && ids.has(c.of))),
    things, skipped,
  };
}

// how the runtime says a block broke → the blow's source in cuts.js
const HOW_SOURCE = Object.freeze({ swing: 'swing', shot: 'round', burst: 'burst', fall: 'call', crush: 'call', call: 'call' });
const r3 = (x) => Math.round(x * 1e3) / 1e3 + 0;
const seedOf = (id) => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; };

export function piecesOf(breakables, faces = []) {
  // a thing's colour: its faces' fills averaged (the baked light a textured skin multiplies its texture by); `tex` says
  // it is textured, so a page without the texture takes it darker
  const sums = new Map();
  for (const f of faces) {
    if (!f || typeof f.node !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.fill || '')) continue;
    const s = sums.get(f.node) || { rgb: [0, 0, 0], n: 0, tex: 0 };
    for (let i = 0; i < 3; i++) s.rgb[i] += parseInt(f.fill.slice(1 + 2 * i, 3 + 2 * i), 16);
    s.n++; if (f.texture) s.tex++;
    sums.set(f.node, s);
  }
  const fillOf = (id) => {
    const s = sums.get(id); if (!s) return { fill: '#8a8070' };
    return { fill: '#' + s.rgb.map((x) => Math.round(x / s.n).toString(16).padStart(2, '0')).join(''), ...(s.tex * 2 > s.n ? { tex: true } : {}) };
  };
  const out = {};
  for (const b of breakables || []) {
    const c = b.min.map((x, i) => (x + b.max[i]) / 2), h = b.min.map((x, i) => (b.max[i] - x) / 2);
    const item = { blocks: [{ c, A: [1, 0, 0], B: [0, 1, 0], C: [0, 0, 1], h, value: 0.5 }], frame: { at: c, N: [0, -1, 0], U: [1, 0, 0] } };
    const cuts = {}, pieces = {};
    for (const how of Object.keys(HOW_SOURCE)) {
      const cut = cutOf({ thing: b.cut, source: HOW_SOURCE[how] });
      const name = cut.pattern === 'dismantle' ? 'chip'
        : typeof b.cut === 'string' ? b.cut : b.cut ? 'own' : CUT_IDS.find((k) => same(CUT_NAMES[k], cut)) || 'chip';
      cuts[how] = name;
      if (pieces[name]) continue;
      const use = cut.pattern === 'dismantle' ? cutOf({ source: 'call' }) : cut;
      const cv = cleave(item, { pattern: use.pattern, count: use.count, cell: use.cell, seed: seedOf(b.id) });
      pieces[name] = {
        style: use.style,
        chunks: cv.chunks.map((k) => ({
          at: k.centroid.map(r3),
          faces: k.faces.map((f) => ({ pts: f.corners.map((p) => p.map((x, i) => r3(x - k.centroid[i]))), ...(f.cut ? { cut: true } : {}) })),
        })),
      };
    }
    out[b.id] = { ...fillOf(b.id), cuts, pieces };
  }
  return out;
}
