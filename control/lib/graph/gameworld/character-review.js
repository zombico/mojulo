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
 * the actions settled; the game's systems (numbers and UI) also need the motion; the equipment (the gear classes, made)
 * needs the systems' parts AND the stats settled (`mechanics:stats`). It advises; nothing refuses.
 *
 * `resolveBook(world)` resolves every page once; the parts, the machine gate and the bible all read it.
 */
import { readGameworld } from './world.js';
import { CHARACTER_PART_IDS } from './characters.js';
import { composeHero, heroLooks } from './hero-looks.js';
import { resolveActions } from './actions.js';
import { resolveMotion } from './hero-vibe.js';
import { resolveAdornment } from './adornment.js';
import { resolveEquipment } from './equipment.js';
import { resolveMechanics } from './mechanics.js';
import { verifyBase } from './hero-base.js';
import { fingerprint, checkReviewEntry, stampPart, MODES } from './review.js';

/** What a stamp must be for a later step to build on the part. */
const SETTLED = Object.freeze(['approved', 'auto']);
const NAMES = Object.freeze({
  'characters:direction': 'Direction', 'hero:body': 'Hero · body', 'hero:head': 'Hero · head', 'hero:hair': 'Hero · hair',
  'hero:colour': 'Hero · colour', 'hero:base': 'Hero · base', 'hero:motion': 'Hero · motion', 'hero:actions': 'Hero · actions',
  'hero:adornment': 'Hero · adornment', equipment: 'Equipment', 'mechanics:stats': 'Systems · stats', 'mechanics:hud': 'Systems · HUD',
});

/**
 * The character book resolved, every page once: `{ G, D, looks, composed, hero, actions, motion, adornment, equipment,
 * mechanics }` (motion, adornment and mechanics null when not laid out); null for a world without characters.
 */
export function resolveBook(world) {
  const G = readGameworld(world);
  if (!G.characters) return null;
  const looks = heroLooks(G), D = looks.direction, hero = G.characters.hero ?? {}, actions = resolveActions(hero.actions ?? {}, D);
  const adornment = hero.adornment ? resolveAdornment(hero.adornment, actions) : null, equipment = resolveEquipment(G);
  return {
    G, D, looks, composed: composeHero(G, looks), hero, actions,
    motion: hero.motion ? resolveMotion(hero.motion) : null,
    adornment, equipment, mechanics: resolveMechanics(G, { actions, equipment, adornment }),
  };
}

/** The parts the character book is reviewed in, each with what it resolves to; [] for a world without characters. */
export function characterParts(world, B = resolveBook(world)) {
  if (!B) return [];
  const { G, D, looks, composed: C, hero, adornment: A, equipment: E } = B;
  const content = {
    'characters:direction': { direction: G.characters.direction, resolved: { hero: D.hero, kit: D.kit, pole: D.pole, motif: D.motif, primary: D.primary, secondary: D.secondary, palette: D.palette, ledger: D.ledger } },
    ...Object.fromEntries(Object.entries(looks.elements).map(([k, El]) => [`hero:${k}`, { spec: El.spec, reads: El.reads }])),
    'hero:base': { spec: C.spec, underlayer: C.underlayer.build, pinned: hero.looks?.base ?? null },
    'hero:motion': B.motion,
    'hero:actions': B.actions,
    'hero:adornment': A && { items: A.items, bodily: A.bodily, open: A.open },
    equipment: { rows: E.rows, ledger: E.ledger },
    'mechanics:stats': B.mechanics && { stats: B.mechanics.play.stats, powers: B.mechanics.powers, ledger: B.mechanics.ledger },
    'mechanics:hud': B.mechanics && { parts: B.mechanics.play.parts ?? [], cues: B.mechanics.play.cues ?? [], menus: B.mechanics.play.menus ?? [], inputs: B.mechanics.inputs, ui: B.mechanics.play.ui },
  };
  return CHARACTER_PART_IDS.map((id) => ({ id, name: NAMES[id], content: content[id], print: fingerprint(content[id]) }));
}

/**
 * What the builders measure of each part, as the laws that advise (the unread words, a base not pinned or drifted,
 * an actions page with things open, motion not yet laid out). `lookup(ref, rev)` reads the manifest of a pinned
 * revision (hero-base.js); without it a pinned base is taken as it stands.
 */
function characterMachine(B, lookup) {
  const out = {};
  out['hero:colour'] = B.looks.unread.map((u) => `unread ${u.key}: ${u.word}`);
  const base = B.hero.looks?.base, pinned = base && lookup ? verifyBase(base, lookup).status : 'pinned';
  out['hero:base'] = !base ? ['no base is pinned'] : pinned !== 'pinned' ? [`the pinned base ${pinned}`] : [];
  out['hero:motion'] = !B.motion ? ['no motion is laid out yet'] : [...B.motion.unread.map((w) => `unread vibe: ${w}`), ...B.motion.errors];
  out['hero:actions'] = B.actions.open;
  out['hero:adornment'] = B.adornment ? B.adornment.open : ['no adornment is laid out yet'];
  // an empty class is the creator's task, not a fault; a table with no template at all is
  out.equipment = B.equipment.rows.some((r) => r.status !== 'empty') ? [] : ['no class has a template yet'];
  out['mechanics:stats'] = B.mechanics ? B.mechanics.open : ['no systems are laid out yet (mechanics)'];
  out['mechanics:hud'] = !B.mechanics ? ['no systems are laid out yet (mechanics)'] : B.mechanics.play.parts?.length ? [] : ['the systems show nothing on the HUD'];
  return out;
}

/** Each part's stamp: `{ id, name, print, status, note?, machine }`, as reviewState's. `book` is resolveBook's, if at hand. */
export function characterState(world, { machine = {}, lookup, book } = {}) {
  const B = book ?? resolveBook(world), parts = characterParts(world, B);
  if (!parts.length) return [];
  // the world's own parts share the field and are read by its page; these are the character book's
  const review = world.review ?? {}, mode = world.mode ?? 'gated';
  for (const id of CHARACTER_PART_IDS) if (review[id] !== undefined) checkReviewEntry(id, review[id]);
  if (!MODES[mode]) throw new Error(`gameworld: mode is ${Object.keys(MODES).join(' or ')}`);
  const measured = characterMachine(B, lookup);
  return parts.map((p) => stampPart(p, review[p.id], mode, [...(measured[p.id] ?? []), ...(machine[p.id] ?? [])]));
}

/** The creator's approval of a character part, on what it resolves to now: the review entry to write. */
export function approveCharacter(world, part, note) {
  const p = characterParts(world).find((x) => x.id === part);
  if (!p) throw new Error(`gameworld: '${part}' is not a character part (${CHARACTER_PART_IDS.join(', ')})`);
  return { ...(world.review ?? {}), [part]: { status: 'approved', print: p.print, ...(note ? { note } : {}) } };
}

/**
 * Which later steps may start: `{ adornment, systems, equipment }`, each `{ ready, waiting: [{ id, status }] }`.
 * Adornment needs `hero:base` and `hero:actions` settled (approved, or auto); the systems need `hero:motion` as well;
 * the equipment needs the systems' parts and the stats settled (`mechanics:stats`), since gear matters only once they
 * exist.
 * `state` is characterState's, if at hand.
 */
export function characterReady(world, { state: given, ...opts } = {}) {
  const state = given ?? characterState(world, opts), at = (id) => state.find((s) => s.id === id);
  const step = (ids) => {
    const waiting = ids.map((id) => ({ id, status: at(id)?.status ?? 'proposed' })).filter((x) => !SETTLED.includes(x.status));
    return { ready: state.length > 0 && !waiting.length, waiting };
  };
  const systems = ['hero:base', 'hero:actions', 'hero:motion'];
  return { adornment: step(['hero:base', 'hero:actions']), systems: step(systems), equipment: step([...systems, 'mechanics:stats']) };
}
