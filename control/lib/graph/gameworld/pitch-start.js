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
 *              'action' (a stylish rail, style-meter.js STYLISH: the genre's first reading with its level the plan its
 *              pitch's words name (action-levels.js: a cathedral, catacombs, a tower…; else the citadel) fought room by room, action-first-level.js actionStarter, its hero on the realistic body in the duelist's coat, the rail's
 *              template kit, `arsenal: { from }`,
 *              and its style meter, `styleMeter: 'auto'`, the orbit camera and the starter's look) or
 *              'hijack-city' (Hijack City's: its district, story, law and shops, hijack-city.js) or
 *              'compose' (a first reading of the genre the rail starts from, compose.js, one level; a rail's own
 *              starter words where it has them: the party RPG's round, its levels)
 *     unlaid   a rail with no starter the book lays yet, or a size that is not the designed game's: said, the pitch
 *              answered and not stored
 *
 * Pure: the same pitch lays the same starter.
 */
import { readRail, railOf, railSheet, variantOf } from './rails.js';
import { platformerStart } from './platformer-game.js';
import { hijackCityStart } from './hijack-city.js';
import { composeGameworld } from './compose.js';
import { GENRES, readGenre } from './intent.js';
import { actionStarter } from './action-first-level.js';
import { levelPlan, planOfWords } from './action-levels.js';
import { STYLISH } from './style-meter.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { ACTION_OUTFITS } from '../outfit/styles.js';
import { HAIR_STYLE_NAMES, HAIR_KEYS } from '../polygonizer/humanoid-hair.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// the workflow's own keys of a composed world: the starter brings its ground, never its review or its brief
const NOT_THE_STARTERS = ['id', 'name', 'mode', 'review', 'brief', 'made'];
const SAYS = 'a starter first level, laid so the pitch is kept: the rail\'s own first reading, theirs to edit or replace. Nothing is built yet';

// the words that name a genre to the composer: the first of its words the reader takes for it alone
const genrePrompt = (genre) => (GENRES[genre]?.words ?? []).map((w) => `a ${w} game`).find((p) => readGenre(p)?.id === genre) ?? null;

export function pitchStart(world, { title } = {}) {
  if (!isObj(world) || world.levels !== undefined || !isObj(world.rail) || world.rail.locked !== true) return null;
  const P = readRail(world.rail), R = railOf(P.from), S = railSheet(P.from, P.variant ?? null);
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
  // Hijack City's rail: its own starter, the district, the story, the law and the shops (hijack-city.js)
  if (R.id === 'hijack-city') {
    const H = hijackCityStart({ ...withFeel, ...named });
    if (H) return { world: { ...H.world, ...(world.intent === undefined ? { intent: { from: 'open-city-crime' } } : {}) }, laid: { by: 'hijack-city', levels: Object.keys(H.world.levels), says: SAYS } };
  }
  // (a rail's own starter words where its genre's one level would not be its game: the party RPG's round, rails.js)
  const prompt = R.starter?.prompt ?? (S.starts ? genrePrompt(S.starts) : null);
  if (!prompt) return { unlaid: `${R.name} has no starter the book lays from its cube yet: write its first level (gameworld-guide), and the pitch is kept with it` };
  const name = world.name ?? title;
  const C = composeGameworld({ prompt, levels: R.starter?.levels ?? 1, ...(typeof name === 'string' && name.trim() ? { name } : {}), ...(Number.isInteger(world.seed) ? { seed: world.seed } : {}) });
  const starter = Object.fromEntries(Object.entries(C).filter(([k]) => !NOT_THE_STARTERS.includes(k)));
  const intent = world.intent === undefined ? { intent: C.intent ?? { from: S.starts } } : {};
  // a STYLISH rail: its genre's reading, its level a plan fought room by room, its kit, its meter, its look; the
  // composed level and what plays it (its links, its flow) left out, the citadel in their place
  if (STYLISH.includes(R.handles.pole)) {
    // (its level the plan its pitch's words name, action-levels.js: a cathedral, catacombs, a tower; else the citadel)
    const said = [world.name, title, typeof world.brief === 'string' ? world.brief : JSON.stringify(world.brief ?? ''), JSON.stringify(world.rail?.departs ?? '')].join(' ');
    const planId = planOfWords(said) ?? 'citadel', A = { ...levelPlan(planId), foes: actionStarter().foes };
    const { levels: _l, links: _k, flow: _f, ...ground } = starter;
    // (its hero dressed as the character action wardrobe's duelist: the long coat that fights, styles.js ACTION_OUTFITS)
    const H = ground.characters?.hero;
    // (on the realistic body, where the duelist's coat is cut away and its tails set by the pose: the composer's cast,
    // hair and colours kept)
    // (and drawn in the western tradition, the realistic body's proportions; the anime head's words left off, a face the
    // realistic head does not draw; its hair the realistic library's style nearest, its own controls kept)
    if (H?.looks) {
      const { head: _h, hair, ...looks } = H.looks, own = isObj(hair?.hair) ? hair.hair : typeof hair?.hair === 'string' ? { style: hair.hair } : {};
      const style = HAIR_STYLE_NAMES.includes(own.style) ? own.style : 'long', kept = Object.fromEntries(Object.entries(own).filter(([k]) => HAIR_KEYS.includes(k)));
      ground.characters = { ...ground.characters, direction: { ...(ground.characters.direction ?? {}), tradition: 'western' },
        hero: { ...H, looks: { ...looks, body: { ...(H.looks.body ?? {}), form: 'realistic' }, hair: { ...(hair ?? {}), hair: { ...kept, style } }, underlayer: { type: 'outfit', style: ACTION_OUTFITS[0] } } } };
    }
    const W = { ...ground, camera: 'orbit', foes: A.foes, fights: A.fights, levels: { [planId]: A.level }, grade: A.grade, ...(TEMPLATE_ARSENALS[R.handles.pole] ? { arsenal: { from: R.handles.pole } } : {}), styleMeter: 'auto', ...withFeel, ...named, ...intent };
    return { world: W, laid: { by: 'action', from: S.starts, levels: Object.keys(W.levels), says: SAYS } };
  }
  const W0 = { ...starter, ...withFeel, ...named, ...intent };
  // (a VARIANT's street words on each street the starter lays: the heroes' tuning on a beat-em-up's, rails.js variants)
  const V = P.variant ? variantOf(R, P.variant) : null;
  const W = V?.street ? { ...W0, levels: Object.fromEntries(Object.entries(W0.levels).map(([k, L]) => [k, isObj(L?.street) ? { ...L, street: { ...V.street, ...L.street } } : L])) } : W0;
  return { world: W, laid: { by: 'compose', from: S.starts, ...(V ? { variant: V.id } : {}), levels: Object.keys(W.levels), says: SAYS } };
}
