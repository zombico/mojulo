/**
 * THE HOME'S INTAKE — what the person brought, read before they are asked anything it already says. Someone with a home
 * rarely arrives with nothing: the floor plan from the agent who sold it, a tape-measured room, a photo of the corner
 * they hate, pictures of rooms they love, the sofa they are keeping. The AGENT reads each (it can see it); this keeps
 * the record and says which of the producer's questions (producer.js) their own material already answered, so none is
 * asked twice.
 *
 * It records, it never authors: an item is what the material SAYS and where it went, or why it has no place yet.
 * Nothing brought is dropped. A budget has no place: mojulo prices nothing, and says so.
 *
 *   brought: 'none'                                   asked, and they bring nothing
 *          | [{ id, kind, says, placed | aside, answers?, basis? }]
 *     id       a short lowercase id                   kind   one of HOME_INTAKE
 *     says     what it says, in a line                basis  'stated' (it says so) | 'inferred' (read between its lines)
 *     placed   where it went: HOME_PLACES             aside  why it has no place yet (said, never dropped)
 *     answers  the producer's questions it answers (QUESTION_IDS); absent, its kind's own
 *
 *   QUESTION_IDS               the producer's questions, in order (producer.js gives each its words)
 *   HOME_PLACES                where a thing brought can go in a home's recipe
 *   HOME_INTAKE                { <kind>: { name, goes, place, answers } }: what each kind of material is taken by and the
 *                              questions it usually answers. A new kind of material is a row
 *   readHomeIntake(v)          → { none: true } | { items } checked; throws, teaching
 *   homeIntakeReport(v)        → null (not asked) | { none: true } | { items, answered, open, placed, aside?, inferred? }
 *
 * Pure: no database, no clock.
 */

export const QUESTION_IDS = Object.freeze(['what', 'place', 'living', 'look', 'brought']);

/** Where a thing brought can go in a home's recipe. */
export const HOME_PLACES = Object.freeze({
  plan: "the house's rooms, read off it by the agent to the inch: mint_building's `rooms[]` or `levels[]` (card house-layout)",
  size: "a room's size or the house's footprint: design_interior's `section.size`, mint_building's `width` / `height`",
  openings: "where the windows and doors are: `section.windows` and `section.doors`, or the plan's own",
  style: "the look: design_interior's `style` (a card and its accent) and `palette`; a house's `style` and `roof`",
  pieces: "a room's pieces by id (`pieces: [{ id, like, size }]`), or a kept piece made as itself (mint_solid kind 'furniture')",
  surface: "walls, floor and what stays as it is: design_interior's `surface`",
  reference: 'read by the agent while it composes, shown to the person at the eyes gate',
});
const row = (o) => Object.freeze({ ...o, answers: Object.freeze(o.answers) });

export const HOME_INTAKE = Object.freeze({
  'floor-plan': row({ name: 'a floor plan: a drawing, a listing\'s plan, a PDF', goes: 'the house built to it: its rooms, their sizes, the doors and windows it shows', place: 'plan', answers: ['place'] }),
  measurements: row({ name: 'measurements: a room or a house, by tape', goes: 'the room\'s or the footprint\'s size', place: 'size', answers: ['place'] }),
  'room-photo': row({ name: 'a photo of the room as it is', goes: 'where its windows and doors are (capture_reference recovers the room), and what is there now', place: 'openings', answers: ['place'] }),
  inspiration: row({ name: 'pictures of rooms they love, a board, a named look', goes: 'the style card and its accent, the palette', place: 'style', answers: ['look'] }),
  keep: row({ name: 'furniture they are keeping', goes: 'a piece by id, sized as theirs; or made as itself', place: 'pieces', answers: [] }),
  constraint: row({ name: 'what cannot change: a rental\'s walls, a step-free route, a wall that stays', goes: 'what stays as it is, and the clearances kept', place: 'surface', answers: ['living'] }),
  budget: row({ name: 'a budget, quotes or a schedule of works', goes: 'nowhere: mojulo prices nothing. Set it aside and say the furniture schedule is what they price from', place: null, answers: [] }),
});
export const HOME_INTAKE_IDS = Object.freeze(Object.keys(HOME_INTAKE));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const BASES = ['stated', 'inferred'];
const ITEM_KEYS = ['id', 'kind', 'says', 'placed', 'aside', 'answers', 'basis'];
// (a thing brought answers what it shows; `what` is the person's to say and `brought` is answered by the record itself)
const ANSWERABLE = QUESTION_IDS.filter((q) => q !== 'what' && q !== 'brought');
const fail = (m) => new Error(`home: brought${m}`);
export const INTAKE_ITEMS_MAX = 24;
const SAYS_MAX = 400;

export function readHomeIntake(v) {
  if (v === 'none') return { none: true };
  if (!Array.isArray(v) || !v.length) throw fail(` is 'none' (asked, they bring nothing) or [{ id, kind, says, placed | aside, answers?, basis? }]: each thing brought, what it says and where it went`);
  if (v.length > INTAKE_ITEMS_MAX) throw fail(` has ${v.length} items; at most ${INTAKE_ITEMS_MAX}`);
  const seen = new Set();
  const items = v.map((it, i) => {
    const at = `[${i}]`;
    if (!isObj(it)) throw fail(`${at} is { id, kind, says, placed | aside, answers?, basis? }`);
    for (const k of Object.keys(it)) if (!ITEM_KEYS.includes(k)) throw fail(`${at}.${k} is not part of an item (${ITEM_KEYS.join(', ')})`);
    if (typeof it.id !== 'string' || !ID.test(it.id)) throw fail(`${at}.id is a short lowercase id`);
    if (seen.has(it.id)) throw fail(`${at}.id '${it.id}' is said twice`);
    seen.add(it.id);
    const K = HOME_INTAKE[it.kind];
    if (!K) throw fail(`${at}.kind is what was brought: ${HOME_INTAKE_IDS.map((k) => `${k} (${HOME_INTAKE[k].name})`).join('; ')}`);
    if (typeof it.says !== 'string' || !it.says.trim() || it.says.trim().length > SAYS_MAX) throw fail(`${at}.says is what it says, in a line (at most ${SAYS_MAX} characters)`);
    const placed = it.placed !== undefined, aside = typeof it.aside === 'string' && !!it.aside.trim();
    if (placed === aside) throw fail(`${at} says where it went (placed: ${Object.keys(HOME_PLACES).join(' | ')}) or why it has no place yet (aside), one of the two: nothing brought is dropped`);
    if (placed && !HOME_PLACES[it.placed]) throw fail(`${at}.placed is where it went: ${Object.entries(HOME_PLACES).map(([k, w]) => `${k} (${w})`).join('; ')}`);
    if (placed && K.place === null) throw fail(`${at} is ${K.name}: ${K.goes}`);
    if (it.answers !== undefined && (!Array.isArray(it.answers) || it.answers.some((q) => !ANSWERABLE.includes(q)))) throw fail(`${at}.answers are the questions it answers: ${ANSWERABLE.join(', ')}`);
    if (it.basis !== undefined && !BASES.includes(it.basis)) throw fail(`${at}.basis is ${BASES.join(' | ')}`);
    return { id: it.id, kind: it.kind, says: it.says.trim(), ...(placed ? { placed: it.placed } : { aside: it.aside.trim() }), answers: [...(it.answers ?? K.answers)], basis: it.basis ?? 'stated' };
  });
  return { items };
}

export function homeIntakeReport(v) {
  if (v === undefined || v === null) return null;
  const R = readHomeIntake(v);
  if (R.none) return { none: true };
  const answered = {}, placed = {};
  // (only what was placed answers a question or fills a place: a thing set aside has answered nothing yet)
  for (const it of R.items) if (it.placed) { (placed[it.placed] ||= []).push(it.id); for (const q of it.answers) (answered[q] ||= []).push(it.id); }
  const aside = R.items.filter((it) => it.aside).map(({ id, says, aside: why }) => ({ id, says, aside: why }));
  const inferred = R.items.filter((it) => it.basis === 'inferred').map((it) => it.id);
  return { items: R.items.length, answered, open: ANSWERABLE.filter((q) => !answered[q]), placed, ...(aside.length ? { aside } : {}), ...(inferred.length ? { inferred } : {}) };
}
