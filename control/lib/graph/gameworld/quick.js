/**
 * THE QUICK PATH — a game whose LOOP is simple: one level and one goal, no hero book, no stats, no progression. Its
 * graphics are not simple: the ground is the world's (a kit, a look in words, the land), the hero is any hero the hero
 * door draws (every word of it, gear and paint included) or none at all (first person), and the goal is dressed by the
 * game's own decoration (glyph forms chosen by the pickup's word, sparkles, the exit's marker) and the shell's theme.
 *
 *   gameworld.quick: {
 *     goal: 'reach' | 'collect' | 'survive' | 'avoid',
 *     hero?: <a hero-door spec> | false,    // false or absent: first person, you are the camera
 *     climb?: true,                         // a climb after the trail, the exit at its top
 *     pickup?: '<word>',                    // collect: what lies along the way (its word picks the glyph: coin, key, star…)
 *     seconds?: n,                          // survive: how long
 *     theme?: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? },   // the game shell's skin (create_game)
 *   }
 *
 * The world around it is an ordinary gameworld: `style` (kit, look, land) and one level are written by `quickWorld`, so
 * the creator may edit any of it, and writing a hero's pages later (characters) turns the same sketch into the book.
 *
 * Pure. `readQuick` reads the shape; `quickWorld` writes the gameworld; `goalMechanics` places the goal on a stage's own
 * anchors (levels.js `stageEnds`); `quickStore` the store the goal needs.
 */
import { STAGE_KITS } from '../era/stage.js';

export const QUICK_GOALS = Object.freeze({
  reach: 'reach the stage\'s end: a trail\'s exit, or a climb\'s top',
  collect: 'collect what lies along the way (on the trail\'s beats), and reach the end',
  survive: 'stay on the stage until the clock runs out',
  avoid: 'reach the end past its hazards (the water a trail crosses), with hp to spare',
});
const KEYS = ['goal', 'hero', 'climb', 'pickup', 'seconds', 'theme'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: quick${m}`);

/** Read the quick block and say what is wrong. */
export function readQuick(Q) {
  if (!isObj(Q)) throw fail(` is { goal: ${Object.keys(QUICK_GOALS).join(' | ')}, hero?, climb?, pickup?, seconds?, theme? }`);
  for (const k of Object.keys(Q)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a quick game (${KEYS.join(', ')})`);
  if (!QUICK_GOALS[Q.goal]) throw fail(`.goal is one of ${Object.entries(QUICK_GOALS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.hero !== undefined && Q.hero !== false && !isObj(Q.hero)) throw fail('.hero is a hero-door spec (get_solid_vocab({ id: \'layered\' })), or false for first person');
  if (Q.climb !== undefined && typeof Q.climb !== 'boolean') throw fail('.climb is true or false');
  if (Q.pickup !== undefined && !(typeof Q.pickup === 'string' && /^[a-z][a-z-]{0,23}$/.test(Q.pickup))) throw fail('.pickup is one lower-case word (coin, key, star, gem, shell…)');
  if (Q.seconds !== undefined && !(Number.isInteger(Q.seconds) && Q.seconds >= 5 && Q.seconds <= 600)) throw fail('.seconds is a whole number of seconds, 5 to 600');
  if (Q.theme !== undefined && !isObj(Q.theme)) throw fail('.theme is the game shell\'s skin { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }');
  if (Q.goal !== 'collect' && Q.pickup !== undefined) throw fail('.pickup belongs to the collect goal');
  if (Q.goal !== 'survive' && Q.seconds !== undefined) throw fail('.seconds belongs to the survive goal');
  return Q;
}

/** A quick game's gameworld: the creator's own settings (id, name, seed, style …) kept, one level written. */
export function quickWorld({ quick, id, name, seed, style, ...rest } = {}) {
  readQuick(quick);
  if (typeof id !== 'string') throw fail(': the world needs an id (a short lower-case name)');
  const kit = style?.kit ?? 'trail-valley';
  if (!STAGE_KITS[kit]?.shell) throw fail(`: style.kit '${kit}' is not an outdoor stage kit (${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).join(', ')})`);
  const nodes = { path: { trail: {} }, ...(quick.climb ? { top: { meru: {} } } : {}) };
  return {
    id, name: name ?? id, ...(seed !== undefined ? { seed } : {}), mode: 'autonomous', ...rest,
    style: { ...(style ?? {}), kit },
    levels: { run: { name: name ?? id, walk: { nodes, ...(quick.climb ? { edges: [{ from: 'path', to: 'top' }] } : {}) } } },
    quick,
  };
}

/** The goal's mechanics on a stage, placed on its own anchors (`ends`: stageEnds'). The exit ends every goal but
 * survive; on a climb's stage the exit is its top (a volume, not a disc on the ground). */
export function goalMechanics(quick, ends) {
  const exit = { kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }) };
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  switch (quick.goal) {
    case 'collect': {
      const pickups = along.map((b) => ({ item: quick.pickup ?? 'gem', at: b.at, radius: 1.6 }));
      return [...(pickups.length ? [{ kind: 'collect', into: 'bag', pickups }] : []), exit];
    }
    case 'survive':
      return [{ kind: 'survive', seconds: quick.seconds ?? 45 }];
    case 'avoid': {
      const hazards = (ends.hazards ?? []).map((h) => ({ at: h.at, radius: 2.2, damage: 25 }));
      return [...(hazards.length ? [{ kind: 'hazard-damage', hazards }, { kind: 'fail-on-death' }] : []), exit];
    }
    default:
      return [exit];
  }
}

/** The store the goal needs (create_game's `store`): a campaign always; a bag to collect into; the hero's hp to lose. */
export function quickStore(quick) {
  return {
    slices: [
      ...(quick.goal === 'avoid' ? [{ name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }] : []),
      ...(quick.goal === 'collect' ? [{ name: 'bag', kind: 'inventory' }] : []),
      { name: 'campaign', kind: 'progression' },
    ],
  };
}
