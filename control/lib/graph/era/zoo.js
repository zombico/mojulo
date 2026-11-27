/**
 * A BUILDING'S PENS (a zoo's, geocity/walkins.js): an open-air enclosure in each of its rooms, a mesh fence round it that
 * is seen through and never walked through (compose-dress.js `mesh-panel`), a walk kept along the room's walls round the
 * fence, the land's animals walking loops inside it (fauna/pen.js, on the walkers channel). The museum's wings
 * (exhibits.js wingRooms): each gallery a pen, each wing's hall its big enclosure.
 *
 *   pens: [{ title?, life: ['<species>', …] }]          one collection a wing, its species the fauna roster's
 *   layPens(plan, pens) → { props, walks, wings, findings }
 *     props    the mesh panels round each pen (stage props)
 *     walks    [{ at: [x, y], half: [hx, hy], z, life: [species…], seed }]: each pen's ground, for its animals
 *   PEN      the measures (m)
 *
 * Pure: the stage's planned rooms and links in, the fences and the ground out. A building with no `pens` lays none.
 */
import { wingRooms } from './exhibits.js';
import { PIECES } from './compose-dress.js';
import { resolveAnimalName } from '../fauna/entries.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { MARINE_FAUNA } from '../marine/fauna.js';

export const PEN = Object.freeze({ walk: 1.8, least: 3, room: 0.6, panel: PIECES['mesh-panel'].w });
export const PEN_LIMITS = Object.freeze({ wings: 3, life: 8 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (says) => { throw new Error(`pens: ${says}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A building's `pens`, checked: a list of collections, one a wing, each the fauna roster's animals (by any name). */
export function readPens(T) {
  if (T === undefined) return undefined;
  if (!Array.isArray(T) || !T.length || T.length > PEN_LIMITS.wings) fail(`is a list of 1 to ${PEN_LIMITS.wings} collections, one a wing: [{ title?, life: ['<species>', …] }]`);
  return T.map((c, i) => {
    if (!isObj(c) || !Array.isArray(c.life) || !c.life.length || c.life.length > PEN_LIMITS.life) fail(`[${i}] is { title?, life: [1 to ${PEN_LIMITS.life} animals] }`);
    for (const k of Object.keys(c)) if (!['title', 'life'].includes(k)) fail(`[${i}].${k} is not a collection's key (title, life)`);
    // (a swimmer is the sea's, kept in a tank: aquarium.js)
    const life = c.life.map((w) => { const r = resolveAnimalName(w); if (!r || r.roster !== 'fauna' || MARINE_FAUNA[r.id]) fail(`[${i}]: '${w}' is not one of the land's animals (fauna/entries.js; the sea's are kept in a tank)`); return r.id; });
    return { ...(typeof c.title === 'string' && c.title.trim() ? { title: c.title.trim() } : {}), life };
  });
}

// the mesh panels along a pen's four sides, one a panel's width, each facing out from the pen
function fence(room, x0, y0, x1, y1) {
  const out = [], P = PEN.panel;
  const run = (a, b, fixed, along, facing, tag) => {
    const n = Math.max(1, Math.round((b - a) / P)), step = (b - a) / n;
    for (let k = 0; k < n; k++) { const t = a + step * (k + 0.5); out.push({ id: `${room}/pen/${tag}${k + 1}`, kind: 'mesh-panel', room, at: along === 'x' ? [r3(t), r3(fixed)] : [r3(fixed), r3(t)], facing, ...(Math.abs(step - P) > 0.01 ? { w: r3(step) } : {}) }); }
  };
  run(x0, x1, y0, 'x', '-y', 's'); run(x0, x1, y1, 'x', '+y', 'n'); run(y0, y1, x0, 'y', '-x', 'w'); run(y0, y1, x1, 'y', '+x', 'e');
  return out;
}

/** The pens and their ground (see the header). `plan`: planStage's (rooms with x0..y1, links). */
export function layPens(plan, pens) {
  const T = readPens(pens) ?? [], props = [], walks = [], wings = [], findings = [];
  const byId = new Map((plan.rooms ?? []).map((r) => [r.id, r])), W = wingRooms(plan);
  T.forEach((C, i) => {
    const wing = W[i];
    if (!wing) { findings.push({ id: 'no-wing', says: `collection ${i + 1} has no wing to stand in: the building has ${W.length}` }); return; }
    const rooms = wing.rooms.map((id) => byId.get(id)).filter(Boolean);
    const isHall = (r) => /^(hall|great-hall)/.test(r.id), hall = rooms.find(isHall) ?? null, galleries = rooms.filter((r) => r !== hall), held = [];
    const pen = (r, life, seed, big = false) => {
      const x0 = r.x0 + PEN.walk, y0 = r.y0 + PEN.walk, x1 = r.x1 - PEN.walk, y1 = r.y1 - PEN.walk;
      if (x1 - x0 < PEN.least || y1 - y0 < PEN.least) { findings.push({ id: 'small', says: `${r.id} is too small for a pen` }); return; }
      props.push(...fence(r.id, x0, y0, x1, y1));
      walks.push({ at: [r3((x0 + x1) / 2), r3((y0 + y1) / 2)], half: [r3((x1 - x0) / 2), r3((y1 - y0) / 2)], z: r3(r.z0 ?? 0), life, seed });
      held.push({ room: r.id, life, ...(big ? { big: true } : {}) });
    };
    // (each gallery a pen of two of the wing's kinds in turn, of those whose length fits its pen, `PEN.room` of it across;
    // the hall the whole collection's enclosure, a body too big for a gallery's pen kept there)
    const fits = (r) => { const span = Math.min(r.x1 - r.x0, r.y1 - r.y0) - 2 * PEN.walk; return C.life.filter((sp) => sizeClassOf(sp).extent <= span * PEN.room); };
    galleries.forEach((r, k) => { const L = fits(r); if (L.length) pen(r, [L[(2 * k) % L.length], L[(2 * k + 1) % L.length]].filter((v, j, a) => a.indexOf(v) === j), i * 31 + k + 1); });
    if (hall) pen(hall, [...C.life], i * 31 + 29, true);
    wings.push({ letter: wing.letter, ...(C.title ? { title: C.title } : {}), pens: held });
  });
  return { props, walks, wings, findings };
}
