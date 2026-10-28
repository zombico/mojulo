/**
 * A SPORT GAME'S CONCEPT — the player's idea laid on top of a sport's rules. A few words ("cats vs dogs at night, retro
 * TV") are READ against a lexicon of what they say about the game around the rules: who plays (the sides' names, their
 * colours, a side of mascots of an animal, chibi or mascot bodies, how they are drawn), where (the stadium's preset,
 * its time, its livery, its land, a roof), how it plays (the register) and how it is shown (the broadcast package).
 * The rules are the card's: a word about them (a number, innings, sets, points) is never read, and said back. A word
 * nothing reads is said back too. What the words decide is laid UNDER the creator's own quick words, as a sport preset
 * is: a word the creator gives always wins.
 *
 *   readSportConcept(text) → { words, tradition?, read: [{ word, decides }], unread: [word], rules: [word] }
 *   sportTeams(Q) → [{ name?, colour?, mascot? }, { … }] | null   the two sides' own words (quick.teams), checked
 *   SPORT_COLOURS                                      the colour words a side may be named in, each its shirt
 *
 * Pure: the same words, the same reading.
 */
import { readMascotBrief } from '../egocube/mascot.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => { throw new Error(`gameworld: quick${m}`); };

/** The colour words a side is named in, each a shirt that reads on grass, wood and a dark broadcast plate. */
export const SPORT_COLOURS = Object.freeze({
  red: '#d7263d', blue: '#1f6fe0', green: '#2f9e44', yellow: '#f2c230', gold: '#d4a72c', orange: '#f2711c',
  purple: '#7b3fbf', violet: '#7b3fbf', pink: '#e64980', teal: '#12a4a4', cyan: '#22b8cf', black: '#1d1f24',
  white: '#f2f2f2', silver: '#aeb6bf', navy: '#1f2f5c', maroon: '#7a1f2b', crimson: '#b0122b', brown: '#8b5a2b',
});
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * What a word says about the game around the rules. Each reading sets quick words (`venue.<key>`, `register`,
 * `athletes`, `broadcast.package`) or the drawing `tradition`; a later word over an earlier one of the same key.
 */
export const CONCEPT_LEXICON = Object.freeze({
  // the light the game is played in
  night: { 'venue.time': 'night' }, midnight: { 'venue.time': 'night' }, floodlit: { 'venue.time': 'night' }, floodlights: { 'venue.time': 'night' },
  neon: { 'venue.time': 'night', 'venue.livery': 'night' }, cyber: { 'venue.time': 'night', 'venue.livery': 'night' }, cyberpunk: { 'venue.time': 'night', 'venue.livery': 'night' },
  dusk: { 'venue.time': 'dusk' }, sunset: { 'venue.time': 'dusk' }, evening: { 'venue.time': 'dusk' }, twilight: { 'venue.time': 'dusk' },
  golden: { 'venue.time': 'golden' }, afternoon: { 'venue.time': 'golden' }, day: { 'venue.time': 'day' }, sunny: { 'venue.time': 'day' }, noon: { 'venue.time': 'day' }, daytime: { 'venue.time': 'day' },
  // the house it is played in
  ancient: { 'venue.preset': 'colosseum' }, roman: { 'venue.preset': 'colosseum' }, gladiator: { 'venue.preset': 'colosseum' }, gladiators: { 'venue.preset': 'colosseum' }, colosseum: { 'venue.preset': 'colosseum' }, amphitheatre: { 'venue.preset': 'colosseum' },
  arcade: { 'venue.preset': 'arcade', register: 'action', 'broadcast.package': 'arcade' }, retro: { 'venue.preset': 'arcade', 'broadcast.package': 'arcade' }, pixel: { 'venue.preset': 'arcade', 'venue.look': 'voxel' }, voxel: { 'venue.preset': 'arcade', 'venue.look': 'voxel' }, blocky: { 'venue.look': 'voxel' },
  olympic: { 'venue.preset': 'olympic' }, olympics: { 'venue.preset': 'olympic' },
  local: { 'venue.preset': 'municipal' }, town: { 'venue.preset': 'municipal' }, school: { 'venue.preset': 'municipal' }, village: { 'venue.preset': 'municipal' }, park: { 'venue.preset': 'municipal' }, backyard: { 'venue.preset': 'municipal' },
  esports: { 'venue.preset': 'patron-dome' }, futuristic: { 'venue.preset': 'patron-dome' }, future: { 'venue.preset': 'patron-dome' }, 'sci-fi': { 'venue.preset': 'patron-dome' }, scifi: { 'venue.preset': 'patron-dome' },
  indoor: { 'venue.bowl.roof': 'dome' }, indoors: { 'venue.bowl.roof': 'dome' }, dome: { 'venue.bowl.roof': 'dome' }, domed: { 'venue.bowl.roof': 'dome' },
  candy: { 'venue.livery': 'candy' }, sweet: { 'venue.livery': 'candy' }, pastel: { 'venue.livery': 'candy' },
  garden: { 'venue.livery': 'garden', 'venue.palette': 'isekai-garden' }, sakura: { 'venue.palette': 'isekai-sakura' }, blossom: { 'venue.palette': 'isekai-sakura' }, spring: { 'venue.palette': 'isekai-sakura' },
  moon: { 'venue.palette': 'airless-plain' }, lunar: { 'venue.palette': 'airless-plain' }, space: { 'venue.palette': 'alien-night', 'venue.time': 'night' }, alien: { 'venue.palette': 'alien-night' }, mars: { 'venue.palette': 'airless-plain' },
  stone: { 'venue.livery': 'stone' }, medieval: { 'venue.livery': 'stone' }, castle: { 'venue.livery': 'stone' },
  // how it is drawn (the athletes' tradition, the stadium's look with it)
  anime: { tradition: 'anime', 'venue.look': 'anime' }, manga: { tradition: 'anime', 'venue.look': 'anime' }, western: { tradition: 'western', 'venue.look': 'shaded' }, comic: { tradition: 'western' },
  // who plays
  chibi: { athletes: 'chibi' }, cute: { athletes: 'chibi' }, kids: { athletes: 'chibi' }, 'super-deformed': { athletes: 'chibi' },
  mascot: { athletes: 'mascot' }, mascots: { athletes: 'mascot' }, critters: { athletes: 'mascot' }, creatures: { athletes: 'mascot' },
  // how it plays (the register: the body's pace and the ball's)
  realistic: { register: 'realistic', 'broadcast.package': 'network' }, simulation: { register: 'realistic' }, sim: { register: 'realistic' }, serious: { register: 'realistic' },
  cartoon: { register: 'action' }, fun: { register: 'action' }, casual: { register: 'action' },
  floaty: { register: 'platformer' }, bouncy: { register: 'platformer' }, moonball: { register: 'platformer' }, 'low-gravity': { register: 'platformer' },
  pinball: { register: 'pinball' }, crazy: { register: 'pinball' }, wild: { register: 'pinball' }, chaotic: { register: 'pinball' }, hyper: { register: 'pinball' },
  // how it is shown
  tv: { 'broadcast.package': 'network' }, televised: { 'broadcast.package': 'network' }, primetime: { 'broadcast.package': 'network' }, network: { 'broadcast.package': 'network' },
  jumbotron: { 'broadcast.package': 'stadium' }, minimal: { 'broadcast.package': 'clean' }, clean: { 'broadcast.package': 'clean' },
});

// words about the rules (the card's, never the concept's), and the words that carry nothing
const RULE_WORDS = new Set(['innings', 'inning', 'overs', 'over', 'sets', 'set', 'points', 'point', 'quarters', 'quarter', 'periods', 'period', 'halves', 'half', 'minutes', 'minute', 'seconds', 'goals', 'goal', 'runs', 'wickets', 'outs', 'strikes', 'downs', 'tackles', 'tries', 'laps', 'rounds', 'holes', 'frames', 'serves', 'first', 'best', 'win', 'wins', 'rules', 'rule']);
const NUMBER = /^\d+$|^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|twenty-one)$/;
const QUIET = new Set(['a', 'an', 'the', 'at', 'in', 'on', 'of', 'with', 'and', 'by', 'for', 'to', 'under', 'into', 'from', 'game', 'games', 'match', 'matches', 'sport', 'sports', 'playing', 'play', 'plays', 'played', 'team', 'teams', 'side', 'sides', 'stadium', 'arena', 'style', 'themed', 'theme', 'version', 'like', 'ball', 'court', 'field', 'pitch',
  // the sports' own names (the sport is the quick spec's `sport`)
  'tennis', 'golf', 'bowling', 'soccer', 'football', 'hockey', 'basketball', 'volleyball', 'badminton', 'pickleball', 'pingpong', 'ping', 'pong', 'table', 'rugby', 'baseball', 'cricket', 'athletics', 'sprint', 'hurdles', 'jump', 'race']);
const VS = new Set(['vs', 'vs.', 'v', 'v.', 'versus', 'against']);
const ARTICLES = new Set(['the', 'a', 'an']);

const singular = (w) => (w.endsWith('ves') ? `${w.slice(0, -3)}f` : w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('es') && /(ch|sh|x|ss)es$/.test(w) ? w.slice(0, -2) : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const titled = (w) => w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
/** An animal a word names (the mascot sheet's species), its spoken form kept. */
function animalOf(word) {
  for (const w of [word, singular(word)]) if (readMascotBrief(w).facets.animal) return w;
  return null;
}

// a side named about a "vs": its colour word and its noun next to it (red robots, the cats)
function sideAt(tokens, at, step) {
  const side = {}, used = [];
  for (let i = at, n = 0; i >= 0 && i < tokens.length && n < 2; i += step, n++) {
    const w = tokens[i];
    if (ARTICLES.has(w)) { used.push(i); n--; continue; }   // (the cats, a team of dogs: the article read past)
    if (SPORT_COLOURS[w] && !side.colour) { side.colour = SPORT_COLOURS[w]; used.push(i); continue; }
    if (QUIET.has(w) || CONCEPT_LEXICON[w] || RULE_WORDS.has(w) || NUMBER.test(w) || VS.has(w) || side.noun) break;
    side.noun = w; used.push(i);
  }
  return { side, used };
}

/** Read a concept's words: what they decide, laid under the creator's quick words, and what they leave. */
export function readSportConcept(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 240) fail('.concept is the player\'s idea in a few words (up to 240 characters): "cats vs dogs at night", "a retro arcade game in a neon dome"');
  const tokens = text.toLowerCase().replace(/[^a-z0-9#\s'.-]/g, ' ').split(/\s+/).map((w) => w.replace(/^[.'-]+|[.'-]+$/g, '') || w).filter(Boolean);
  const read = [], unread = [], rules = [], taken = new Set(), set = {};
  let tradition = null;
  // the sides first: "X vs Y" names them, colours them and, an animal, makes them its mascots
  const vs = tokens.findIndex((w) => VS.has(w));
  let teams = null;
  if (vs > 0 && vs < tokens.length - 1) {
    const A = sideAt(tokens, vs - 1, -1), B = sideAt(tokens, vs + 1, 1);
    if (A.side.noun || A.side.colour || B.side.noun || B.side.colour) {
      teams = [A.side, B.side].map((s) => {
        const animal = s.noun ? animalOf(s.noun) : null;
        return { ...(s.noun ? { name: titled(s.noun).slice(0, 18) } : {}), ...(s.colour ? { colour: s.colour } : {}), ...(animal ? { mascot: singular(animal) } : {}) };
      });
      [...A.used, ...B.used, vs].forEach((i) => taken.add(i));
      read.push({ word: tokens.slice(Math.min(...A.used, vs), Math.max(...B.used, vs) + 1).join(' '), decides: teams.map((t, i) => `side ${'ab'[i]}: ${[t.name, t.colour, t.mascot ? `${t.mascot} mascots` : null].filter(Boolean).join(', ') || 'as rolled'}`) });
    }
  }
  // colour words outside a "vs": the sides' shirts in order
  const colours = [];
  tokens.forEach((w, i) => {
    if (taken.has(i)) return;
    if (SPORT_COLOURS[w]) { taken.add(i); colours.push([w, SPORT_COLOURS[w]]); return; }
    if (RULE_WORDS.has(w) || NUMBER.test(w)) { taken.add(i); rules.push(w); return; }
    if (QUIET.has(w)) { taken.add(i); return; }
    const R = CONCEPT_LEXICON[w];
    if (!R) return;
    taken.add(i);
    const decides = [];
    for (const [k, v] of Object.entries(R)) {
      if (k === 'tradition') { tradition = v; decides.push(`drawn ${v}`); continue; }
      set[k] = v; decides.push(`${k} ${v}`);
    }
    read.push({ word: w, decides });
  });
  if (colours.length) {
    teams = teams ?? [{}, {}];
    colours.slice(0, 2).forEach(([, hex], i) => { if (!teams[i].colour) teams[i] = { ...teams[i], colour: hex }; });
    read.push({ word: colours.map(([w]) => w).join(' '), decides: colours.slice(0, 2).map(([w], i) => `side ${'ab'[i]} in ${w}`) });
  }
  // a sport's own name, or an animal outside a "vs" (cats playing tennis: every side its mascots)
  tokens.forEach((w, i) => {
    if (taken.has(i)) return;
    const animal = animalOf(w);
    if (animal && !teams?.some((t) => t.mascot)) {
      taken.add(i);
      teams = (teams ?? [{}, {}]).map((t) => ({ ...t, mascot: t.mascot ?? singular(animal) }));
      read.push({ word: w, decides: [`both sides ${singular(animal)} mascots`] });
      return;
    }
    unread.push(w);
  });
  // the words as quick words: venue.<key> into a venue, broadcast.package, register, athletes, the teams
  const words = {};
  for (const [k, v] of Object.entries(set)) {
    const path = k.split('.');
    let at = words;
    for (const p of path.slice(0, -1)) at = at[p] = at[p] ?? {};
    at[path.at(-1)] = v;
  }
  if (teams && teams.some((t) => Object.keys(t).length)) words.teams = teams;
  return { words, ...(tradition ? { tradition } : {}), read, unread, rules };
}

const TEAM_KEYS = ['name', 'colour', 'mascot'];
/** The two sides' own words (quick.teams: a two-sided contest's), checked: [{ name?, colour?, mascot? }, { … }]. */
export function sportTeams(Q) {
  if (Q.teams === undefined) return null;
  const T = Q.teams;
  if (!Array.isArray(T) || T.length !== 2) fail('.teams is the two sides\' own words [{ name?, colour?, mascot? }, { … }]: a name (the broadcast\'s, up to 18 characters), a shirt colour (#rrggbb or a colour word), its players rolled as mascots of an animal or a brief');
  return T.map((t, i) => {
    if (!isObj(t)) fail(`.teams[${i}] is { ${TEAM_KEYS.join('?, ')}? }`);
    for (const k of Object.keys(t)) if (!TEAM_KEYS.includes(k)) fail(`.teams[${i}] has no '${k}' (${TEAM_KEYS.join(', ')})`);
    if (t.name !== undefined && !(typeof t.name === 'string' && t.name.length >= 1 && t.name.length <= 18)) fail(`.teams[${i}].name is 1 to 18 characters`);
    const colour = t.colour === undefined ? undefined : SPORT_COLOURS[String(t.colour).toLowerCase()] ?? (HEX.test(t.colour) ? t.colour.toLowerCase() : fail(`.teams[${i}].colour is a #rrggbb or a colour word (${Object.keys(SPORT_COLOURS).join(', ')})`));
    if (t.mascot !== undefined && !(typeof t.mascot === 'string' && t.mascot.trim() && t.mascot.length <= 120)) fail(`.teams[${i}].mascot is a brief in words (an animal: 'cat', 'shark'; docs/mascot.md), its side's players rolled as such mascots`);
    return { ...(t.name !== undefined ? { name: t.name } : {}), ...(colour ? { colour } : {}), ...(t.mascot !== undefined ? { mascot: t.mascot } : {}) };
  });
}
