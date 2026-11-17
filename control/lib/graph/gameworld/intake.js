/**
 * THE INTAKE — what the creator brought, read before the first goalpost. The producer's first step (the
 * `gameworld-producer` card): a game is started from the drawings, plans and documents a person has, where there are
 * any, and the loop runs on what is still missing. The AGENT reads each attachment (it can see it); this keeps the
 * record and says what is open. It is the equivalent of expecting attachments and knowing what to do with each, where
 * an agent would otherwise guess from the start.
 *
 * It records, it never authors: an item is what an attachment SAYS, where it was placed (the page it answered) or why
 * it has no place yet. Nothing here writes a page: the agent's own patch does, and names the item it came from.
 *
 *   intake: 'none'                                    asked, and the creator brought nothing
 *         | { items: [{ id, kind, says, placed? | aside?, answers?, basis? }] }
 *     id       a short lowercase id                    kind   one of INTAKE_KINDS
 *     says     what the attachment says, in a line     basis  'stated' (it says so) | 'inferred' (read between its lines)
 *     placed   where it went: a page of the book (a JSON pointer, '/characters/hero/looks') or a chapter's id
 *     aside    why it has no place yet (said, never dropped): one of the two, never both
 *     answers  the goalposts it answers (goalposts.js); absent, its kind's own
 *
 *   INTAKE_KINDS              { <kind>: { name, door, answers } }: what each kind of material is taken by and the
 *                             goalposts it usually answers. A new kind of material is a row
 *   readIntake(v)             → { none: true } | { items } checked; throws, teaching
 *   needsIntake(world)        → is this a book nobody has asked yet? A quick game and a composed world are one call
 *                             and are left alone; a book that has built something is past its start
 *   intakeAdvice(world)       → null | { says, next: { step: 'intake', card } }
 *   intakeReport(world)       → null | { none: true } | { items, answered: { <goalpost>: [<item id>] },
 *                             open: [<goalpost> no item answers], aside: [{ id, says, aside }], inferred: [<item id>] }
 *
 * Pure: no database, no clock.
 */
import { GOALPOSTS } from './goalposts.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// (read when asked, not at load: goalposts.js reads the rails, whose tables reach back to the world's reader and so here)
const postIds = () => GOALPOSTS.map((g) => g.id);
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const fail = (m) => new Error(`gameworld: intake${m}`);

/** What each kind of material is taken by, and the goalposts it usually answers. */
export const INTAKE_KINDS = Object.freeze({
  character: Object.freeze({ name: 'a character drawing or sheet', door: 'reference_protocol → capture_reference (a picture you can see), then the looks pages', answers: Object.freeze(['look']) }),
  map: Object.freeze({ name: 'a map or a level sketch', door: 'the level\'s own page: its walk, or a written map (gameworld-world: glyphs)', answers: Object.freeze(['first-plan']) }),
  design: Object.freeze({ name: 'a design document or a pitch', door: 'intent, the main quest, the feel and the actions, a page at a time', answers: Object.freeze(['game', 'shape', 'play']) }),
  lore: Object.freeze({ name: 'a setting\'s lore or a story', door: 'the world\'s `backdrop` (extracted, never authored), then the main quest', answers: Object.freeze(['shape']) }),
  rules: Object.freeze({ name: 'rules, stats, a bestiary or a power system', door: 'the actions, the systems, the foes; a party game\'s bestiary → battles.manual, its school of techniques → battles.tree (gameworld-battles); a power system no page takes yet is set aside', answers: Object.freeze(['play']) }),
  art: Object.freeze({ name: 'concept art or a mood board', door: 'reference_protocol → capture_reference, then the direction and the world\'s look', answers: Object.freeze(['look']) }),
  plan: Object.freeze({ name: 'a production plan or a level list', door: 'the main quest\'s beats and the levels they are played on', answers: Object.freeze(['plan']) }),
});
export const INTAKE_KIND_IDS = Object.freeze(Object.keys(INTAKE_KINDS));
const BASES = ['stated', 'inferred'];
const ITEM_KEYS = ['id', 'kind', 'says', 'placed', 'aside', 'answers', 'basis'];

export function readIntake(v) {
  if (v === 'none') return { none: true };
  if (!isObj(v) || !Array.isArray(v.items) || !v.items.length) throw fail(` is 'none' (asked, nothing brought) or { items: [{ id, kind, says, placed | aside, answers?, basis? }] } (get_game_vocab({ id: 'gameworld-producer' }))`);
  for (const k of Object.keys(v)) if (k !== 'items') throw fail(`.${k} is not part of an intake (items)`);
  const seen = new Set();
  const items = v.items.map((it, i) => {
    const at = `.items[${i}]`;
    if (!isObj(it)) throw fail(`${at} is { id, kind, says, placed | aside, answers?, basis? }`);
    for (const k of Object.keys(it)) if (!ITEM_KEYS.includes(k)) throw fail(`${at}.${k} is not part of an item (${ITEM_KEYS.join(', ')})`);
    if (typeof it.id !== 'string' || !ID.test(it.id)) throw fail(`${at}.id is a short lowercase id`);
    if (seen.has(it.id)) throw fail(`${at}.id '${it.id}' is said twice`);
    seen.add(it.id);
    if (!INTAKE_KINDS[it.kind]) throw fail(`${at}.kind is what was brought: ${INTAKE_KIND_IDS.join(', ')}`);
    if (typeof it.says !== 'string' || !it.says.trim()) throw fail(`${at}.says is what the attachment says, in a line`);
    const placed = typeof it.placed === 'string' && it.placed.trim(), aside = typeof it.aside === 'string' && it.aside.trim();
    if (!!placed === !!aside) throw fail(`${at} says where it went (placed: a page or a chapter) or why it has no place yet (aside), one of the two: nothing brought is dropped`);
    if (it.answers !== undefined && (!Array.isArray(it.answers) || it.answers.some((g) => !postIds().includes(g)))) throw fail(`${at}.answers are goalposts: ${postIds().join(', ')}`);
    if (it.basis !== undefined && !BASES.includes(it.basis)) throw fail(`${at}.basis is ${BASES.join(' | ')}`);
    return { id: it.id, kind: it.kind, says: it.says.trim(), ...(placed ? { placed: it.placed.trim() } : { aside: it.aside.trim() }), answers: [...(it.answers ?? INTAKE_KINDS[it.kind].answers)], basis: it.basis ?? 'stated' };
  });
  return { items };
}

export function needsIntake(world) {
  if (!isObj(world) || world.quick || world.intake !== undefined) return false;
  if (Array.isArray(world.brief?.read)) return false;
  // (a book that has built something is past its start: the question is asked once, before the first goalpost)
  return !(isObj(world.made) && Object.keys(world.made).length);
}

export const INTAKE_SAYS = 'not asked yet: does the creator have drawings, plans or documents for this game? read each, place what it says, set aside what has no place, then write `intake` (\'none\' when they brought nothing)';

export function intakeAdvice(world) {
  return needsIntake(world) ? { says: INTAKE_SAYS, next: { step: 'intake', card: 'gameworld-producer' } } : null;
}

export function intakeReport(world) {
  if (!isObj(world) || world.intake === undefined) return null;
  const R = readIntake(world.intake);
  if (R.none) return { none: true };
  const answered = {};
  // (only what was placed answers a goalpost: a thing set aside has answered nothing yet)
  for (const it of R.items) if (it.placed) for (const g of it.answers) (answered[g] ||= []).push(it.id);
  const aside = R.items.filter((it) => it.aside).map(({ id, says, aside: why }) => ({ id, says, aside: why }));
  const inferred = R.items.filter((it) => it.basis === 'inferred').map((it) => it.id);
  return { items: R.items.length, answered, open: postIds().filter((g) => !answered[g]), ...(aside.length ? { aside } : {}), ...(inferred.length ? { inferred } : {}) };
}
