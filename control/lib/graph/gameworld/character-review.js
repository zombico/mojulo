/**
 * THE CHARACTER BOOK'S REVIEW — the same gate as the world's (review.js), over the character book's parts. The parts
 * are read off the composed hero: the direction, each looks page, the pinned base, the motion, the actions. Each has a
 * FINGERPRINT of what it resolves to and the creator's verdict lives in the recipe's `review` field beside the
 * world's own:
 *
 *   review: { 'hero:body': { status: 'approved', print }, 'hero:actions': { status: 'revise', note } }
 *
 * An approval goes stale when its part changes. In an autonomous world a part nobody has reviewed is stamped 'auto'
 * when its machine gate holds and 'revise' when it advises; never 'approved'. The eyes gate is the creator's.
 *
 * `characterReady` says which later steps may start: adornment (equipment shaped to the main loop) needs the base and
 * the actions settled; the game's systems (numbers and UI) also need the motion. It advises; nothing refuses.
 */
import { readGameworld } from './world.js';
import { resolveDirection, CHARACTER_PART_IDS } from './characters.js';
import { composeHero, heroLooks } from './hero-looks.js';
import { resolveActions } from './actions.js';
import { resolveMotion } from './hero-vibe.js';
import { verifyBase } from './hero-base.js';
import { fingerprint, checkReviewEntry, stampPart, MODES } from './review.js';

/** What a stamp must be for a later step to build on the part. */
const SETTLED = Object.freeze(['approved', 'auto']);
const NAMES = Object.freeze({
  'characters:direction': 'Direction', 'hero:body': 'Hero · body', 'hero:head': 'Hero · head', 'hero:hair': 'Hero · hair',
  'hero:colour': 'Hero · colour', 'hero:base': 'Hero · base', 'hero:motion': 'Hero · motion', 'hero:actions': 'Hero · actions',
});

/** The parts the character book is reviewed in, each with what it resolves to; [] for a world without characters. */
export function characterParts(world) {
  const G = readGameworld(world);
  if (!G.characters) return [];
  const D = resolveDirection(G), looks = heroLooks(G), C = composeHero(G), hero = G.characters.hero ?? {};
  const content = {
    'characters:direction': { direction: G.characters.direction, resolved: { hero: D.hero, kit: D.kit, pole: D.pole, motif: D.motif, primary: D.primary, secondary: D.secondary, palette: D.palette, ledger: D.ledger } },
    ...Object.fromEntries(Object.entries(looks.elements).map(([k, E]) => [`hero:${k}`, { spec: E.spec, reads: E.reads }])),
    'hero:base': { spec: C.spec, underlayer: C.underlayer.build, pinned: hero.looks?.base ?? null },
    'hero:motion': hero.motion ? resolveMotion(hero.motion) : null,
    'hero:actions': resolveActions(hero.actions ?? {}, D),
  };
  return CHARACTER_PART_IDS.map((id) => ({ id, name: NAMES[id], content: content[id], print: fingerprint(content[id]) }));
}

/**
 * What the builders measure of each part, as the laws that advise (the unread words, a base not pinned or drifted,
 * an actions page with things open, motion not yet laid out). `lookup(ref, rev)` reads the manifest of a pinned
 * revision (hero-base.js); without it a pinned base is taken as it stands.
 */
function characterMachine(world, parts, lookup) {
  const G = readGameworld(world), hero = G.characters.hero ?? {}, looks = heroLooks(G), out = {};
  const unread = looks.unread.map((u) => `unread ${u.key}: ${u.word}`);
  out['hero:colour'] = unread;
  const base = hero.looks?.base;
  out['hero:base'] = !base ? ['no base is pinned'] : lookup && verifyBase(base, lookup).status !== 'pinned' ? [`the pinned base ${verifyBase(base, lookup).status}`] : [];
  const M = parts.find((p) => p.id === 'hero:motion').content;
  out['hero:motion'] = !M ? ['no motion is laid out yet'] : [...M.unread.map((w) => `unread vibe: ${w}`), ...M.errors];
  out['hero:actions'] = parts.find((p) => p.id === 'hero:actions').content.open;
  return out;
}

/** Each part's stamp: `{ id, name, print, status, note?, machine }`, as reviewState's. */
export function characterState(world, { machine = {}, lookup } = {}) {
  const parts = characterParts(world);
  if (!parts.length) return [];
  // the world's own parts share the field and are read by its page; these are the character book's
  const review = world.review ?? {}, mode = world.mode ?? 'gated';
  for (const id of CHARACTER_PART_IDS) if (review[id] !== undefined) checkReviewEntry(id, review[id]);
  if (!MODES[mode]) throw new Error(`gameworld: mode is ${Object.keys(MODES).join(' or ')}`);
  const measured = characterMachine(world, parts, lookup);
  return parts.map((p) => stampPart(p, review[p.id], mode, [...(measured[p.id] ?? []), ...(machine[p.id] ?? [])]));
}

/** The creator's approval of a character part, on what it resolves to now: the review entry to write. */
export function approveCharacter(world, part, note) {
  const p = characterParts(world).find((x) => x.id === part);
  if (!p) throw new Error(`gameworld: '${part}' is not a character part (${CHARACTER_PART_IDS.join(', ')})`);
  return { ...(world.review ?? {}), [part]: { status: 'approved', print: p.print, ...(note ? { note } : {}) } };
}

/**
 * Which later steps may start: `{ adornment, systems }`, each `{ ready, waiting: [{ id, status }] }`. Adornment needs
 * `hero:base` and `hero:actions` settled (approved, or auto); the systems need `hero:motion` as well.
 */
export function characterReady(world, opts) {
  const state = characterState(world, opts), at = (id) => state.find((s) => s.id === id);
  const step = (ids) => {
    const waiting = ids.map((id) => ({ id, status: at(id)?.status ?? 'proposed' })).filter((x) => !SETTLED.includes(x.status));
    return { ready: state.length > 0 && !waiting.length, waiting };
  };
  return { adornment: step(['hero:base', 'hero:actions']), systems: step(['hero:base', 'hero:actions', 'hero:motion']) };
}
