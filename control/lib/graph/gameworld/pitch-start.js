/**
 * THE PITCH KEPT — a locked pitch with no level yet, given the starter first level that lets it be stored. A gameworld
 * begins with its first level (world.js), so a pitch the person agreed to would otherwise live only in the session that
 * made it. Locking is the explicit word: `rail.locked: true` on a book with no level asks for this, and nothing else
 * does. What is laid is a STARTER, said as one: the rail's own first reading, the creator's to edit or replace. Nothing
 * is built: a level is made by a run.
 *
 *   pitchStart(world, { title? }) → null | { world, laid: { by, levels, says } } | { unlaid: '<why>' }
 *     null     not a locked pitch with no level (nothing to do: the start readout answers as it always has)
 *     world    the written world with the starter under it: every key the creator wrote wins
 *     by       'platformer' (the platformer's rail: its first level and the flow that plays it, platformer-game.js),
 *              'action' (a stylish rail, style-meter.js STYLISH: the genre's first reading with its level the citadel
 *              fought room by room, action-first-level.js actionStarter, its hero in the duelist's coat, the rail's
 *              template kit, `arsenal: { from }`,
 *              and its style meter, `styleMeter: 'auto'`, the orbit camera and the starter's look) or
 *              'compose' (a first reading of the genre the rail starts from, compose.js, one level)
 *     unlaid   a rail with no starter the book lays yet, or a size that is not the designed game's: said, the pitch
 *              answered and not stored
 *
 * Pure: the same pitch lays the same starter.
 */
import { readRail, railOf, railSheet } from './rails.js';
import { platformerStart } from './platformer-game.js';
import { composeGameworld } from './compose.js';
import { GENRES, readGenre } from './intent.js';
import { actionStarter } from './action-first-level.js';
import { STYLISH } from './style-meter.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { ACTION_OUTFITS } from '../outfit/styles.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// the workflow's own keys of a composed world: the starter brings its ground, never its review or its brief
const NOT_THE_STARTERS = ['id', 'name', 'mode', 'review', 'brief', 'made'];
const SAYS = 'a starter first level, laid so the pitch is kept: the rail\'s own first reading, theirs to edit or replace. Nothing is built yet';

// the words that name a genre to the composer: the first of its words the reader takes for it alone
const genrePrompt = (genre) => (GENRES[genre]?.words ?? []).map((w) => `a ${w} game`).find((p) => readGenre(p)?.id === genre) ?? null;

export function pitchStart(world, { title } = {}) {
  if (!isObj(world) || world.levels !== undefined || !isObj(world.rail) || world.rail.locked !== true) return null;
  const P = readRail(world.rail), R = railOf(P.from), S = railSheet(P.from);
  if (P.size !== undefined && P.size !== 'designed') return { unlaid: `a ${P.size} game is made in its own call (${S.sizes.find((z) => z.size === P.size)?.door ?? 'its door'}): it needs no starter` };
  if (!R.sizes.includes('designed')) return { unlaid: `${R.name} is not laid as a designed game yet: it reaches ${R.sizes.join(', ')}` };
  const named = { ...(title && world.name === undefined ? { name: title } : {}) };
  const withFeel = { ...world, ...(world.feel === undefined && R.handles.pole ? { feel: R.handles.pole } : {}) };
  // the platformer's rail: its first level and the flow that plays it, as the words its start offers
  const plat = (() => { try { return platformerStart(withFeel); } catch { return null; } })();
  if (plat) {
    const W = { ...plat.world, ...withFeel, ...named };
    return { world: W, laid: { by: 'platformer', dimension: plat.dimension, levels: Object.keys(W.levels), says: SAYS } };
  }
  const prompt = S.starts ? genrePrompt(S.starts) : null;
  if (!prompt) return { unlaid: `${R.name} has no starter the book lays from its cube yet: write its first level (gameworld-guide), and the pitch is kept with it` };
  const name = world.name ?? title;
  const C = composeGameworld({ prompt, levels: 1, ...(typeof name === 'string' && name.trim() ? { name } : {}), ...(Number.isInteger(world.seed) ? { seed: world.seed } : {}) });
  const starter = Object.fromEntries(Object.entries(C).filter(([k]) => !NOT_THE_STARTERS.includes(k)));
  const intent = world.intent === undefined ? { intent: C.intent ?? { from: S.starts } } : {};
  // a STYLISH rail: its genre's reading, its level the citadel fought room by room, its kit, its meter, its look; the
  // composed level and what plays it (its links, its flow) left out, the citadel in their place
  if (STYLISH.includes(R.handles.pole)) {
    const A = actionStarter(), { levels: _l, links: _k, flow: _f, ...ground } = starter;
    // (its hero dressed as the character action wardrobe's duelist: the long coat that fights, styles.js ACTION_OUTFITS)
    const H = ground.characters?.hero;
    if (H?.looks) ground.characters = { ...ground.characters, hero: { ...H, looks: { ...H.looks, underlayer: { type: 'outfit', style: ACTION_OUTFITS[0] } } } };
    const W = { ...ground, camera: 'orbit', foes: A.foes, fights: A.fights, levels: { citadel: A.level }, grade: A.grade, ...(TEMPLATE_ARSENALS[R.handles.pole] ? { arsenal: { from: R.handles.pole } } : {}), styleMeter: 'auto', ...withFeel, ...named, ...intent };
    return { world: W, laid: { by: 'action', from: S.starts, levels: Object.keys(W.levels), says: SAYS } };
  }
  const W = { ...starter, ...withFeel, ...named, ...intent };
  return { world: W, laid: { by: 'compose', from: S.starts, levels: Object.keys(W.levels), says: SAYS } };
}
