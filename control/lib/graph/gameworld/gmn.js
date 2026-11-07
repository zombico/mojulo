/**
 * THE GAME BRIEF AND ITS GMN — what a game is about, above its genre, and the orders that follow from it. The genre says
 * how a moment plays; a GAME-MOTIF-NARRATIVE says what it is about and its shape, as a mix of two lists, each a row:
 *
 *   a MOTIVATION  the why (the Time facet): the stakes and the ending, the acts' goals, the cast's relations, the flags
 *                 it needs, the palette's arc (a colour script, color-theorist/solve.js) and the light act by act
 *   a LABOUR      the how (the Space and Reality facets): the megaworld's shape, its climax (a citadel or a set piece),
 *                 what a beat is played as, the side content it brings, the genres it suits (advice, never a refusal)
 *
 * The brief is the intent chapter's, so it is a pillar: the creator accepts it. The pitch stays the creator's words in
 * `brief`; beside it:
 *
 *   gameBrief: {
 *     gmn: { motivations?: { <id>: share }, labours?: { <id>: share } },   // each mix sums to 1
 *     resolved?: { … },       // stamped at authoring (stampGameBrief), read once and kept until the gmn changes
 *     orders?: [{ id, kind, role, words, for?, mood?: { script?, at?, light? }, budget? }] | 'reroll',
 *   }
 *
 * THE MIX resolved into decisions (the composer's rule: read once, stored, never re-read): the largest LABOUR decides the
 * structure (the shape, the climax, what beats are played as); the others at SIDE_SHARE or more bring their side content,
 * and those under it are said and dropped. The largest MOTIVATION decides the stakes, the ending, the script and the light;
 * the others at SIDE_SHARE or more add their cast and their flags. Shares matter at these thresholds only.
 *
 * THE ORDERS (`layOrders`): what the director asks the scene composer for, each with the colour theorist's notes. Two are
 * always there once a labour is: the first level (`lv0`, the slice that sets the session's tone) and the climax (`citadel`,
 * or the labour's own set piece). Laid once; a list already there is the operator's, kept through a change of the mix;
 * `orders: 'reroll'` lays them again.
 *
 *   MOTIVATIONS, LABOURS, ORDER_KINDS, WORLD_SHAPES      the rows (a new trope is a row first)
 *   readGameBrief(v)        → v, read; throws, teaching
 *   resolveGmn(gmn)         → the decisions
 *   layOrders(resolved)     → the orders
 *   stampGameBrief(world)   → the world with its brief's reading and orders stamped; a world without one, itself
 * Pure.
 */
import { ROLE_IDS } from '../era/compose-roles.js';
import { MOOD_IDS } from '../era/compose-plot.js';
import { PALETTE_SCRIPT_IDS } from '../color-theorist/solve.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: gameBrief${m}`);
const row = (o) => Object.freeze(o);

/** How the maps join: each written into the links that exist (the world's topology; the mandala's lowering is its own). */
export const WORLD_SHAPES = Object.freeze({
  mandala: { topology: 'interconnected', says: 'rings of zones round a core, gated ring to ring, the climax at the centre' },
  chain: { topology: 'interconnected', says: 'map after map, one way on, the last the far shore; the way back stays open' },
  open: { topology: 'interconnected', says: 'regions joined sideways, none the only way on' },
  hub: { topology: 'interconnected', says: 'a home in the middle, every zone a way out and back' },
});

export const MOTIVATIONS = Object.freeze({
  'save-the-princess': row({ name: 'save the princess', stakes: 'one person the hero cannot go on without', ending: 'she is free, and it was never only her in that tower', acts: ['she is taken', 'the road to where she is held', 'the door she is behind'], cast: ['captive', 'threshold-guardian', 'shadow'], flags: ['captive-seen'], script: 'dawn', light: ['even', 'drama', 'noir'] }),
  'save-the-world': row({ name: 'save the city, the kingdom, the world', stakes: 'everyone, and a clock on it', ending: 'the place still stands, changed by what it cost', acts: ['the first sign of it', 'it reaches home', 'the last stand'], cast: ['herald', 'mentor', 'mastermind'], flags: ['threat-revealed'], script: 'dusk', light: ['even', 'drama', 'drama'] }),
  'reunite-with-family': row({ name: 'reunite with family', stakes: 'the people the hero came from', ending: 'a table with every seat filled, or an honest empty one', acts: ['the separation', 'word of where they went', 'what they became'], cast: ['foil', 'ally', 'shapeshifter'], flags: ['word-of-family'], script: 'thaw', light: ['drama', 'even', 'even'] }),
  'solve-the-mystery': row({ name: 'solve the mystery', stakes: 'the truth, and who it costs', ending: 'the answer named aloud, and what it changes', acts: ['the question', 'the wrong answers', 'the right one'], cast: ['trickster', 'shapeshifter', 'mastermind'], flags: ['clue-1', 'clue-2', 'clue-3'], script: 'descent', light: ['drama', 'noir', 'noir'] }),
  'find-the-treasure': row({ name: 'find the treasure', stakes: 'a fortune, and who gets there first', ending: 'the chest opened, and what was really in it', acts: ['the map', 'the rivals on the road', 'the last lock'], cast: ['rival', 'trickster', 'ally'], flags: ['map-piece'], script: 'journey', light: ['even', 'even', 'drama'] }),
  'stop-the-virus': row({ name: 'stop the virus', stakes: 'a spreading thing, gaining every hour', ending: 'it is contained, and someone paid for the cure', acts: ['the first case', 'the spread', 'the source'], cast: ['herald', 'mentor', 'shadow'], flags: ['spread-1', 'spread-2'], script: 'fever', light: ['drama', 'noir', 'noir'] }),
});

export const LABOURS = Object.freeze({
  'storm-the-citadel': row({ name: 'storm or infiltrate the citadel', shape: 'mandala', climax: { kind: 'citadel', words: 'the walled core at the middle of the world, gated layer on layer' }, beats: 'wcd', side: 'keys and powers found out in the rings that open the way in', genres: ['dungeon-crawler', 'metroidvania', 'stealth', 'survival-horror'] }),
  'conquer-the-map': row({ name: 'conquer the map', shape: 'open', climax: { kind: 'set-piece', words: 'the last stronghold still holding out' }, beats: 'qow', side: 'strongholds taken region by region, the map turning yours', genres: ['tactics', 'rts', 'top-down-adventure'] }),
  'hundred-percent': row({ name: '100% the tasks', shape: 'open', climax: { kind: 'set-piece', words: 'what opens only when every task is done' }, beats: 'errand', side: 'a completion count over every task, chest and find', genres: ['collectathon', 'farming', 'top-down-adventure'] }),
  'be-the-best': row({ name: 'be the very best', shape: 'hub', climax: { kind: 'set-piece', words: 'the final hall, and the champion in it' }, beats: 'gauntlet', side: 'a ladder of rivals and titles, each beaten in the open', genres: ['long-rpg', 'jrpg', 'versus-fighter'] }),
  'catch-them-all': row({ name: 'catch them all', shape: 'hub', climax: { kind: 'set-piece', words: 'the rarest of them, at the end of the map' }, beats: 'level', side: 'a roster filled species by species, zone by zone', genres: ['jrpg', 'long-rpg', 'collectathon'] }),
  'cross-the-great-sea': row({ name: 'cross the great sea', shape: 'chain', climax: { kind: 'map', words: 'the far shore no one has come back from' }, beats: 'level', side: 'a crew gathered island by island', genres: ['long-rpg', 'jrpg', 'story-adventure'] }),
  'campbellian-journey': row({ name: 'the Campbellian journey', shape: 'chain', climax: { kind: 'citadel', words: 'the ordeal: the innermost cave, and the way back out of it' }, beats: 'level', side: 'mentors and threshold guardians along the road', genres: ['jrpg', 'story-adventure', 'long-rpg'] }),
});

export const ORDER_KINDS = Object.freeze({ map: 'a planned map, walked (level/plan.js)', 'set-piece': 'a place built to be looked at: an interior composed or a building', citadel: 'the walled core: a WCD over its spaces', hub: 'the home every way returns to' });
export const SIDE_SHARE = 0.1;
const SUM_TOL = 0.001;
const ORDER_KEYS = ['id', 'kind', 'role', 'words', 'for', 'mood', 'budget'];

function readMix(mix, rows, name) {
  if (!isObj(mix) || !Object.keys(mix).length) throw fail(`.gmn.${name} is { <id>: share }, shares summing to 1 (${Object.keys(rows).join(', ')})`);
  for (const [id, share] of Object.entries(mix)) {
    if (!rows[id]) throw fail(`.gmn.${name}.${id} is not one (${Object.keys(rows).join(', ')})`);
    if (!(Number.isFinite(share) && share > 0 && share <= 1)) throw fail(`.gmn.${name}.${id} is a share over 0, at most 1`);
  }
  const sum = Object.values(mix).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > SUM_TOL) throw fail(`.gmn.${name} sums to ${Math.round(sum * 1000) / 1000}: its shares sum to 1`);
}

/** The brief, read. Throws, teaching. */
export function readGameBrief(v) {
  if (v === undefined) return null;
  if (!isObj(v)) throw fail(' is { gmn, orders? } (the pitch stays in brief): what the game is about, and what it orders');
  for (const k of Object.keys(v)) if (!['gmn', 'resolved', 'orders'].includes(k)) throw fail(`.${k} is not part of it (gmn, orders; resolved is stamped)`);
  if (!isObj(v.gmn)) throw fail('.gmn is { motivations?, labours? }: the mix of what drives the game and what it asks of the player (get_game_vocab({ id: \'gameworld-brief\' }))');
  for (const k of Object.keys(v.gmn)) if (!['motivations', 'labours'].includes(k)) throw fail(`.gmn.${k} is not part of it (motivations, labours)`);
  if (v.gmn.motivations === undefined && v.gmn.labours === undefined) throw fail('.gmn names motivations, labours or both');
  if (v.gmn.motivations !== undefined) readMix(v.gmn.motivations, MOTIVATIONS, 'motivations');
  if (v.gmn.labours !== undefined) readMix(v.gmn.labours, LABOURS, 'labours');
  if (v.orders !== undefined && v.orders !== 'reroll') {
    if (!Array.isArray(v.orders)) throw fail('.orders is a list of orders, or \'reroll\' to lay them again');
    const seen = new Set();
    v.orders.forEach((O, i) => {
      const at = `.orders[${i}]`;
      if (!isObj(O)) throw fail(`${at} is { id, kind, role, words, for?, mood?, budget? }`);
      for (const k of Object.keys(O)) if (!ORDER_KEYS.includes(k)) throw fail(`${at}.${k} is not part of an order (${ORDER_KEYS.join(', ')})`);
      if (typeof O.id !== 'string' || !O.id) throw fail(`${at}.id names the order`);
      if (seen.has(O.id)) throw fail(`${at}.id '${O.id}' is ordered twice`);
      seen.add(O.id);
      if (!ORDER_KINDS[O.kind]) throw fail(`${at}.kind is ${Object.keys(ORDER_KINDS).join(', ')}`);
      if (!ROLE_IDS.includes(O.role)) throw fail(`${at}.role is ${ROLE_IDS.join(', ')}`);
      if (typeof O.words !== 'string' || !O.words.trim()) throw fail(`${at}.words say what is ordered, for the composer`);
      if (O.mood !== undefined) {
        if (!isObj(O.mood)) throw fail(`${at}.mood is { script?, at?, light? }: the colour theorist's notes`);
        if (O.mood.script !== undefined && !PALETTE_SCRIPT_IDS.includes(O.mood.script)) throw fail(`${at}.mood.script is ${PALETTE_SCRIPT_IDS.join(', ')}`);
        if (O.mood.at !== undefined && !(Number.isFinite(O.mood.at) && O.mood.at >= 0 && O.mood.at <= 1)) throw fail(`${at}.mood.at is how far along the script, 0 to 1`);
        if (O.mood.light !== undefined && !MOOD_IDS.includes(O.mood.light)) throw fail(`${at}.mood.light is ${MOOD_IDS.join(', ')}`);
      }
    });
  }
  return v;
}

// largest first, ties by id, so a mix reads one way whatever order its keys were written in
const ranked = (mix = {}) => Object.entries(mix).sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1));
const printOf = (gmn) => JSON.stringify({ m: ranked(gmn.motivations), l: ranked(gmn.labours) });

/** The mix resolved into decisions. */
export function resolveGmn(gmn) {
  const M = ranked(gmn.motivations), L = ranked(gmn.labours), said = [];
  const keep = (list, rows) => list.slice(1).filter(([id, s]) => { if (s >= SIDE_SHARE) return true; said.push(`${rows[id].name} at ${s} is under ${SIDE_SHARE}: dropped`); return false; });
  const out = { of: printOf(gmn) };
  if (M.length) {
    const [id] = M[0], R = MOTIVATIONS[id], rest = keep(M, MOTIVATIONS).map(([x]) => MOTIVATIONS[x]);
    Object.assign(out, { motivation: id, stakes: R.stakes, ending: R.ending, script: R.script, light: [...R.light],
      cast: [...new Set([R, ...rest].flatMap((x) => x.cast))], flags: [...new Set([R, ...rest].flatMap((x) => x.flags))],
      spine: { acts: R.acts.map((goal, i) => ({ stage: ['early', 'mid', 'late'][i], goal })), ending: { stakes: R.stakes } } });
  }
  if (L.length) {
    const [id] = L[0], R = LABOURS[id], side = keep(L, LABOURS);
    Object.assign(out, { labour: id, structure: { shape: R.shape, topology: WORLD_SHAPES[R.shape].topology, climax: R.climax.kind, beats: R.beats },
      side: [{ labour: id, share: L[0][1], brings: R.side }, ...side.map(([x, s]) => ({ labour: x, share: s, brings: LABOURS[x].side }))],
      genres: [...new Set([R, ...side.map(([x]) => LABOURS[x])].flatMap((x) => x.genres))] });
  }
  return { ...out, ...(said.length ? { said } : {}) };
}

/** The orders that follow: the first level and the climax, each with the colour theorist's notes; a hub's home. */
export function layOrders(resolved) {
  if (!resolved.labour) return [];
  const R = LABOURS[resolved.labour], script = resolved.script, light = resolved.light ?? [];
  const mood = (at, l) => ({ ...(script ? { script, at } : {}), ...(l ? { light: l } : {}) });
  const first = { id: 'lv0', kind: 'map', role: 'arrival', words: resolved.spine ? `the first level: ${resolved.spine.acts[0].goal}` : 'the first level, where the game sets its tone', for: 'the first act', mood: mood(0, light[0]) };
  const home = R.shape === 'hub' ? [{ id: 'hub', kind: 'hub', role: 'rest', words: 'the home every way returns to', mood: mood(0, light[0]) }] : [];
  const climax = { id: R.climax.kind === 'citadel' ? 'citadel' : 'climax', kind: R.climax.kind, role: 'climax', words: R.climax.words, for: 'the last act', mood: mood(1, light[2]) };
  return [first, ...home, climax];
}

/** A world with its brief's reading and orders stamped at authoring; a world without a brief is handed back as it came. */
export function stampGameBrief(world) {
  const B = world?.gameBrief;
  if (B === undefined) return world;
  readGameBrief(B);
  const of = printOf(B.gmn), resolved = B.resolved?.of === of ? B.resolved : resolveGmn(B.gmn);
  const orders = B.orders === undefined || B.orders === 'reroll' ? layOrders(resolved) : B.orders;
  return { ...world, gameBrief: { ...B, resolved, orders } };
}
