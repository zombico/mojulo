/**
 * WHICH FEEL — the template a world's words or its genre point at, SUGGESTED, never laid behind the recipe's back: a
 * world plays the feel it writes (a recipe is a promise over the games already made from it), so a default is said in
 * design_game's readout for the creator (or the agent) to write, and written by the composer into a world it composes
 * from a prompt that names one.
 *
 *   FEEL_WORDS                { <pole>: [phrase] } the words a brief uses for each template (lower case, matched whole)
 *   GENRE_FEEL                { <genre id>: { pole, why } } the template a genre (intent.js GENRES) starts from; a genre
 *                             played off its feet (racing, flight, puzzles, farming) or with no template yet has none
 *   suggestFeels(text, n?)    → [{ pole, matched }] the templates whose words the text uses, most first
 *   shooterPoleFeel(p)        → the shooter pole (shooter-pole.js, 0 realistic … 1 stylized) as a feel: Conscription
 *                             toward Infinity Crisis, the same dial
 *   feelSuggestion(world)     → { feel, why, from: 'words' | 'genre' | 'shooter-pole' } or null (a world that writes its
 *                             feel, or that nothing points at)
 *
 * A heuristic over words, said to be one: the agent, the real reader of a brief, picks from it or asks. Pure.
 */
import { POLES } from './cards.js';
import { QUICK_GENRE } from '../intent.js';
import { readPole } from '../shooter-pole.js';

export const FEEL_WORDS = Object.freeze({
  'fallen-angel': ['devil may cry', 'dmc', 'bayonetta', 'character action', 'stylish action', 'hack and slash', 'hack-and-slash'],
  'ebon-spirits': ['souls', 'soulslike', 'souls-like', 'dark souls', 'elden ring', 'bloodborne', 'god of war'],
  'cogs-of-combat': ['gears of war', 'cover shooter', 'third-person shooter', 'third person shooter', 'roadie run'],
  'infinity-crisis': ['hero shooter', 'overwatch', 'movement shooter', 'apex legends', 'titanfall'],
  conscription: ['call of duty', 'battlefield', 'military shooter', 'realistic shooter', 'tactical shooter', 'modern warfare'],
  'steel-serpents': ['metal gear', 'stealth action', 'tactical espionage'],
  'vigilante-justice': ['batman', 'arkham', 'superhero', 'spider-man', 'spiderman', 'free-flow', 'free flow'],
  'mech-battle-kai': ['mech', 'mechs', 'mecha', 'gundam', 'armored core', 'mobile suit', 'giant robot'],
  'jumping-giuseppe': ['mario', 'mascot platformer', '3d platformer', 'ground pound', 'stomp on enemies'],
  'isekai-party': ['isekai', 'mmo', 'mmorpg', 'tab target', 'tab-target'],
  'mojulo-fighter': ['fighting game', 'street fighter', 'tekken', '2d fighter'],
  'galaxy-boy': ['mega man', 'megaman', 'mega man x', 'run and gun', 'run-and-gun', 'charge shot', 'arm cannon'],
  'commuter-rail-runner': ['endless runner', 'infinite runner', 'subway surfers', 'temple run', 'auto runner', 'auto-runner'],
});

export const GENRE_FEEL = Object.freeze({
  collectathon: { pole: 'jumping-giuseppe', why: 'a collectathon is the mascot platformer\'s: the springy jump, the air jump, coyote and the buffer' },
  metroidvania: { pole: 'galaxy-boy', why: 'a metroidvania moves like the side-scrolling run-and-gun: a tight run, a cut jump, no double jump until a power gives one' },
  shooter: { pole: 'conscription', why: 'a first-person shooter moves like the contemporary FPS: a soldier\'s run, a short jump' },
  'arena-shooter': { pole: 'infinity-crisis', why: 'an arena shooter is movement first: fast, a high jump and an air jump' },
  'arena-brawler': { pole: 'fallen-angel', why: 'a brawler is offense first: a quick run, a high jump with an air jump, a long string' },
  'dungeon-crawler': { pole: 'ebon-spirits', why: 'a dungeon crawl is deliberate: a slow committed jump, a heavier run' },
  stealth: { pole: 'steel-serpents', why: 'stealth moves carefully: a slow walk, a low jump' },
  jrpg: { pole: 'isekai-party', why: 'a party RPG resolves what lands: an even walk and a small jump' },
  'versus-fighter': { pole: 'mojulo-fighter', why: 'a versus fighter is versus\'s loop (a quick fight); as a hero\'s feel, its walk and its fixed jump arc' },
});

const norm = (t) => ` ${String(t ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;

/** The templates whose words the text uses, the most words first (ties: the longer phrase, then the catalog's order). */
export function suggestFeels(text, n = 3) {
  const t = norm(text);
  return Object.entries(FEEL_WORDS)
    .map(([pole, words]) => ({ pole, matched: words.filter((w) => t.includes(` ${w} `)) }))
    .filter((s) => s.matched.length)
    .sort((a, b) => b.matched.length - a.matched.length || Math.max(...b.matched.map((w) => w.length)) - Math.max(...a.matched.map((w) => w.length)))
    .slice(0, n);
}

/** The shooter pole's dial as a feel: realistic is Conscription, stylized Infinity Crisis, between them the blend. */
export function shooterPoleFeel(p) {
  const t = readPole(p);
  return t === 0 ? { pole: 'conscription' } : t === 1 ? { pole: 'infinity-crisis' } : { pole: 'conscription', toward: 'infinity-crisis', t };
}

/** The feel a world that writes none points at: its brief's words first, then a deathmatch's shooter pole, then its genre. */
export function feelSuggestion(world) {
  if (!world || (world.feel !== undefined && world.feel !== null)) return null;
  const brief = typeof world.brief === 'string' ? world.brief : world.brief?.prompt ?? world.brief?.text ?? '';
  const said = brief ? suggestFeels(brief, 1)[0] : null;
  if (said) return { feel: said.pole, why: `the brief says ${said.matched.map((w) => `"${w}"`).join(', ')}: ${POLES[said.pole].name} (after ${POLES[said.pole].after})`, from: 'words' };
  const q = world.quick;
  if (q?.goal === 'deathmatch' && q.pole !== undefined) return { feel: shooterPoleFeel(q.pole), why: 'the shooter pole\'s dial as a feel: Conscription (realistic) toward Infinity Crisis (stylized)', from: 'shooter-pole' };
  const genre = world.intent?.from ?? (q?.goal ? QUICK_GENRE[q.goal] : null), G = genre ? GENRE_FEEL[genre] : null;
  return G ? { feel: G.pole, why: G.why, from: 'genre' } : null;
}
