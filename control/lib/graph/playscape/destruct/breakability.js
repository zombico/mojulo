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
 *
 * Pure: the payload is not changed; the caller takes the lists it returns.
 */
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
