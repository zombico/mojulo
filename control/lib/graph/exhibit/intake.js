/**
 * THE EXHIBIT'S INTAKE — what the person brought, read before they are asked anything it already says. An educator or a
 * curator rarely arrives with nothing: a lesson plan, label text, their sources, pictures, a list of topics. The AGENT
 * reads each (it can see it); this keeps the record and says which of the producer's questions (producer.js) their own
 * material already answered, so none is asked twice.
 *
 * It records, it never authors: an item is what the material SAYS and where it went, or why it has no place yet.
 * Nothing here writes an aim, a caption or a claim: the agent does, from what the item says, and whether a claim is
 * true stays the expert's (brief.js).
 *
 *   brought: 'none'                                   asked, and they bring nothing
 *          | [{ id, kind, says, placed | aside, answers?, basis? }]
 *     id       a short lowercase id                   kind   one of EXHIBIT_INTAKE
 *     says     what it says, in a line                basis  'stated' (it says so) | 'inferred' (read between its lines)
 *     placed   where it went: aims | claims | stops | rooms | reference (EXHIBIT_PLACES)
 *     aside    why it has no place yet (said, never dropped): one of the two, never both
 *     answers  the producer's questions it answers (QUESTION_IDS); absent, its kind's own
 *
 *   QUESTION_IDS               the producer's four questions, in order (producer.js gives each its words)
 *   EXHIBIT_PLACES             where a thing brought can go in an exhibit
 *   EXHIBIT_INTAKE             { <kind>: { name, goes, place, answers } }: what each kind of material is taken by and
 *                              the questions it usually answers. A new kind of material is a row
 *   readExhibitIntake(v)       → { none: true } | { items } checked; throws, teaching
 *   exhibitIntakeReport(v)     → null (not asked) | { none: true } | { items, answered: { <question>: [<item id>] },
 *                              open: [<question> no placed item answers], placed: { <place>: [<item id>] }, aside?,
 *                              inferred? }
 *
 * Pure: no database, no clock.
 */

export const QUESTION_IDS = Object.freeze(['concept', 'people', 'time', 'brought']);

/** Where a thing brought can go in an exhibit. */
export const EXHIBIT_PLACES = Object.freeze({
  aims: 'what a visitor should leave understanding (curation.aims)',
  claims: 'what the exhibit states as fact, with where it comes from (curation.claims, their cite)',
  stops: 'what a stop says (the tour\'s captions, each audience its own)',
  rooms: 'the subjects a gallery walks, a room each',
  reference: 'what the thing looks like: read by the agent when it composes the world, shown to the person at the eyes gate',
});
const row = (o) => Object.freeze({ ...o, answers: Object.freeze(o.answers) });

export const EXHIBIT_INTAKE = Object.freeze({
  goals: row({ name: 'learning goals, a curriculum or a lesson plan', goes: 'the aims; a lesson plan also says who it is for and how long', place: 'aims', answers: ['concept', 'people', 'time'] }),
  labels: row({ name: 'label or wall text they wrote', goes: 'the stops\' captions, in their words', place: 'stops', answers: ['concept'] }),
  sources: row({ name: 'sources: books, papers, a record, links', goes: 'the claims\' cite; a source is never a claim until they say what it shows', place: 'claims', answers: [] }),
  topics: row({ name: 'a list of topics or rooms', goes: 'the gallery\'s rooms, a subject each', place: 'rooms', answers: ['concept'] }),
  pictures: row({ name: 'pictures, diagrams or a model', goes: 'reference for how it looks: capture_reference, then the world is composed to it', place: 'reference', answers: [] }),
  programme: row({ name: 'a programme or a visitor profile', goes: 'who it is for and how long they have', place: 'reference', answers: ['people', 'time'] }),
});
export const EXHIBIT_INTAKE_IDS = Object.freeze(Object.keys(EXHIBIT_INTAKE));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const BASES = ['stated', 'inferred'];
const ITEM_KEYS = ['id', 'kind', 'says', 'placed', 'aside', 'answers', 'basis'];
// (a thing brought answers the first three: `brought` itself is answered by there being a record)
const ANSWERABLE = QUESTION_IDS.filter((q) => q !== 'brought');
const fail = (m) => new Error(`exhibit: brought${m}`);
export const INTAKE_ITEMS_MAX = 24;
const SAYS_MAX = 400;

export function readExhibitIntake(v) {
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
    if (!EXHIBIT_INTAKE[it.kind]) throw fail(`${at}.kind is what was brought: ${EXHIBIT_INTAKE_IDS.map((k) => `${k} (${EXHIBIT_INTAKE[k].name})`).join('; ')}`);
    if (typeof it.says !== 'string' || !it.says.trim() || it.says.trim().length > SAYS_MAX) throw fail(`${at}.says is what it says, in a line (at most ${SAYS_MAX} characters)`);
    const placed = it.placed !== undefined, aside = typeof it.aside === 'string' && !!it.aside.trim();
    if (placed === aside) throw fail(`${at} says where it went (placed: ${Object.keys(EXHIBIT_PLACES).join(' | ')}) or why it has no place yet (aside), one of the two: nothing brought is dropped`);
    if (placed && !EXHIBIT_PLACES[it.placed]) throw fail(`${at}.placed is where it went: ${Object.entries(EXHIBIT_PLACES).map(([k, w]) => `${k} (${w})`).join('; ')}`);
    if (it.answers !== undefined && (!Array.isArray(it.answers) || it.answers.some((q) => !ANSWERABLE.includes(q)))) throw fail(`${at}.answers are the questions it answers: ${ANSWERABLE.join(', ')}`);
    if (it.basis !== undefined && !BASES.includes(it.basis)) throw fail(`${at}.basis is ${BASES.join(' | ')}`);
    return { id: it.id, kind: it.kind, says: it.says.trim(), ...(placed ? { placed: it.placed } : { aside: it.aside.trim() }), answers: [...(it.answers ?? EXHIBIT_INTAKE[it.kind].answers)], basis: it.basis ?? 'stated' };
  });
  return { items };
}

export function exhibitIntakeReport(v) {
  if (v === undefined || v === null) return null;
  const R = readExhibitIntake(v);
  if (R.none) return { none: true };
  const answered = {}, placed = {};
  // (only what was placed answers a question or fills a place: a thing set aside has answered nothing yet)
  for (const it of R.items) if (it.placed) { (placed[it.placed] ||= []).push(it.id); for (const q of it.answers) (answered[q] ||= []).push(it.id); }
  const aside = R.items.filter((it) => it.aside).map(({ id, says, aside: why }) => ({ id, says, aside: why }));
  const inferred = R.items.filter((it) => it.basis === 'inferred').map((it) => it.id);
  return { items: R.items.length, answered, open: ANSWERABLE.filter((q) => !answered[q]), placed, ...(aside.length ? { aside } : {}), ...(inferred.length ? { inferred } : {}) };
}
