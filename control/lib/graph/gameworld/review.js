/**
 * THE REVIEW — the bible is scapeshifting's approval gate and its iteration point. A world is read in PARTS (the
 * world's shape, its natural world, its civilizations, its color key, each level), each with a FINGERPRINT of what
 * it resolves to. The creator's verdicts live in the recipe:
 *
 *   review: { '<part>': { status: 'approved' | 'revise' | 'proposed', print?, note? } }
 *
 * An approval keeps the print it was given on; when the part changes after, the approval stands stale ('changed')
 * and the part comes back for review. The eyes gate is the creator's: nothing here approves.
 *
 * A world has a MODE. 'gated' (the default): every part waits for the creator. 'autonomous': the agent decided the
 * world from a few prompts (compose.js); a part the creator has not reviewed is stamped 'auto' when its machine gate
 * holds (its laws), 'revise' when they advise, never 'approved'. The creator can still approve, or send any part back.
 */
import { readGameworld, resolveLevel } from './world.js';
import { landFor } from './nature.js';
import { CHARACTER_PART_IDS, CAST_PART } from './characters.js';
import { resolveTechDirection } from './tech-direction.js';
import { cubeOfWorld } from './intent.js';
import { concernsOf } from './concerns.js';

export const MODES = Object.freeze({
  gated: 'every part waits for the creator\'s approval before the next step builds on it',
  autonomous: 'the agent decided the world from a few prompts; what the creator has not reviewed stands on its machine gate',
});
/** What the creator can write; `changed` and `auto` are read, never written. */
export const REVIEW_STATUSES = Object.freeze(['proposed', 'approved', 'revise']);
export const STAMPS = Object.freeze({
  approved: 'approved by the creator, unchanged since',
  changed: 'approved, then changed: back for review',
  revise: 'sent back, with a note',
  proposed: 'waiting for the creator',
  auto: 'decided by the agent; its machine gate holds',
});

/** FNV-1a over a value's JSON, as 8 hex digits: the same content, the same print. */
export function fingerprint(v) {
  let h = 2166136261;
  for (const c of JSON.stringify(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** The parts a world is reviewed in, in order, each with what it resolves to. */
export function reviewParts(world) {
  const G = readGameworld(world), parts = [];
  // what game it is, first: the cube the world is laid for (written only; a world that writes none has no such part)
  if (world.intent !== undefined) { const I = cubeOfWorld(world); parts.push({ id: 'intent', name: 'What game it is', content: { from: I.from, cube: I.cube, concerns: concernsOf(I.cube).map((c) => c.id) } }); }
  parts.push({ id: 'world', name: 'The world', content: { id: G.id, name: G.name, seed: G.seed, levels: G.ids, links: G.links, start: G.start } });
  const levels = G.ids.map((id) => resolveLevel(G, id)), kits = [...new Set([G.style.kit, ...levels.map((R) => R.style.kit)])];
  parts.push({ id: 'nature', name: 'Natural world', content: { style: { kit: G.style.kit, trail: G.style.trail, meru: G.style.meru }, land: Object.fromEntries(kits.map((k) => [k, landFor(k, (levels.find((R) => R.style.kit === k)?.style.land) ?? G.style.land ?? {})])) } });
  parts.push({ id: 'civilizations', name: 'Civilizations', content: G.civilizations });
  // each civilization's technology design loop, once it crafts anything or gives its technology a direction
  for (const cid of G.civIds) {
    const D = resolveTechDirection(G, cid);
    if (D) parts.push({ id: `tech:${cid}`, name: `${G.civilizations[cid].name}: its technology`, content: { direction: D } });
  }
  parts.push({ id: 'key', name: 'Color key', content: kits });
  for (const R of levels) parts.push({ id: `level:${R.id}`, name: R.name, content: { style: R.style, built: R.built, level: R.level, town: R.town, ...(R.building ? { building: R.building } : {}) } });
  // the cast and the story (story.js), reviewed as the world's other pages; a world without them has neither part
  if (G.characters?.cast) parts.push({ id: 'cast', name: 'The cast', content: G.characters.cast });
  if (G.story) parts.push({ id: 'story', name: 'The story', content: G.story });
  if (G.quests) parts.push({ id: 'quests', name: 'The quests', content: G.quests });
  return parts.map((p) => ({ ...p, print: fingerprint(p.content) }));
}

/** One review entry's shape: the creator's verdict on a part, and what is wrong with it. */
export function checkReviewEntry(id, r) {
  if (!r || typeof r !== 'object' || !REVIEW_STATUSES.includes(r.status)) throw new Error(`gameworld: review.${id}.status is ${REVIEW_STATUSES.join(', ')}`);
  for (const k of Object.keys(r)) if (!['status', 'print', 'note'].includes(k)) throw new Error(`gameworld: review.${id}.${k} is not a review setting (status, print, note)`);
  if (r.status === 'approved' && typeof r.print !== 'string') throw new Error(`gameworld: review.${id}: an approval keeps the print it was given on (approve(world, '${id}') writes it)`);
}

/** Read a world's review and mode, and say what is wrong. The character book's parts (characters.js) are reviewed in
 * the same recipe field, and stamped by their own page (character-review.js). */
export function readReview(world, parts = reviewParts(world)) {
  const review = world.review ?? {}, ids = parts.map((p) => p.id);
  if (typeof review !== 'object' || Array.isArray(review)) throw new Error('gameworld: review is { <part>: { status, print?, note? } }');
  for (const [id, r] of Object.entries(review)) {
    if (!ids.includes(id) && !CHARACTER_PART_IDS.includes(id) && id !== CAST_PART) throw new Error(`gameworld: review.${id} is not a part (parts: ${ids.join(', ')})`);
    checkReviewEntry(id, r);
  }
  return review;
}

/** One part's stamp, from the creator's verdict `r` (if any), the part, the world's mode and the laws that advise. */
export function stampPart(p, r, mode, laws = []) {
  let status = r?.status ?? (mode === 'autonomous' ? (laws.length ? 'revise' : 'auto') : 'proposed');
  if (status === 'approved' && r.print !== p.print) status = 'changed';
  const note = r?.note ?? (!r && mode === 'autonomous' && laws.length ? `the machine gate advises: ${laws.join(', ')}` : undefined);
  return { id: p.id, name: p.name, print: p.print, status, ...(note ? { note } : {}), machine: laws };
}

/**
 * Each part's stamp: `{ id, name, print, status, note?, machine }`. `machine` is `{ <part>: [law ids that advise] }`
 * (what the builders measured); in autonomous mode it decides an unreviewed part between 'auto' and 'revise'.
 */
export function reviewState(world, { machine = {} } = {}) {
  const parts = reviewParts(world), review = readReview(world, parts), mode = world.mode ?? 'gated';
  if (!MODES[mode]) throw new Error(`gameworld: mode is ${Object.keys(MODES).join(' or ')}`);
  return parts.map((p) => stampPart(p, review[p.id], mode, machine[p.id] ?? []));
}

/** The creator's approval of a part, on what it resolves to now: the review entry to write into the recipe. */
export function approve(world, part, note) {
  const p = reviewParts(world).find((x) => x.id === part);
  if (!p) throw new Error(`gameworld: '${part}' is not a part`);
  return { ...(world.review ?? {}), [part]: { status: 'approved', print: p.print, ...(note ? { note } : {}) } };
}
