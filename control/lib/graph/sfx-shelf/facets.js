/**
 * sfx-shelf/facets — what a sound is for, so the shelf can be searched by intent: what sounds (`matter`), how big
 * (`weight`), which games use it (`genres`), and whether it is one of the shelf's newest voices (`fresh`). Pure data
 * and pure functions: no clock, no dice.
 *
 * Annotate what is meant, derive the rest. A facet is set once on its family (FAMILY_FACETS), read off the dials a
 * row's family is built at (a `material: 'metal'` impact is metal, a `size: 'huge'` blast is heavy), and written on a
 * row only where neither says it (roster.js `matter`, `weight`, `genres`). A row's sound words (`say`) are the
 * roster's own.
 *
 *   MATTER, WEIGHTS, GENRE_GROUPS     the vocabularies (genres are cosmos fixture ids, gameworld/intent.js GENRES)
 *   facetsOf(id)                      → { matter, weight, genres, say, fresh } for a row
 *   soundsWith({ matter?, weight?, genre? }) → the row ids that have every facet asked, in roster order
 *   facetGaps()                       → [{ category, matter }]: a category's expected matter no row has yet
 */
import { SOUNDS, SOUND_IDS, CATEGORIES } from './roster.js';

/** What sounds. */
export const MATTER = Object.freeze({
  metal: 'struck, scraped or worked metal: a blade, a latch, a coin, a gun',
  wood: 'wood: a staff, a door, a crate, an arrow in a target',
  stone: 'stone and concrete: a block, a wall, a step on paving',
  glass: 'glass and crystal',
  earth: 'earth: dirt, grass, sand, a spade in soil',
  water: 'water: a splash, a drip, wading',
  air: 'air moved: a swing, a whoosh, a flyby, wind',
  fire: 'fire and blasts: a flame, a crackle, a shot\'s report',
  flesh: 'a body: a blow landing, a step, a stomp',
  cloth: 'cloth, leather and nets',
  paper: 'paper and card: cards dealt, a page',
  synthetic: 'made things that are not metal or wood: a ball, a dice, a game\'s chime and blip',
  electric: 'electricity: a spark, a crackle, a buzz',
  energy: 'energy: a beam, a shield, a spell',
  machine: 'a machine running: an engine, a servo, a clock',
  voice: 'a voice: breath, a hurt cry, a crowd',
  creature: 'an animal or a monster',
});

/** How big. */
export const WEIGHTS = Object.freeze({ light: 'small, quick, thin', mid: 'neither', heavy: 'big, slow, deep' });

// genres by kind of play (cosmos/fixtures.js ids): a family's genres are a group or several
const G = {
  shooting: ['shooter', 'arena-shooter', 'military-sim', 'tactical-espionage', 'run-and-gun', 'split-deathmatch', 'driver-and-gunner', 'cinematic-action'],
  melee: ['stylish-action', 'action-rpg', 'arena-brawler', 'co-op-brawler', 'versus-fighter', 'top-down-adventure', 'open-adventure', 'dungeon-crawler', 'cinematic-action'],
  adventure: ['dungeon-crawler', 'top-down-adventure', 'open-adventure', 'action-rpg', 'jrpg', 'long-rpg', 'metroidvania', 'story-adventure', 'roguelike', 'headset-adventure'],
  platform: ['collectathon', 'platformer-3d', 'co-op-platformer', 'endless-runner', 'metroidvania', 'co-op-scroller'],
  racing: ['racing', 'kart-racer', 'driver-and-gunner'],
  flight: ['flight-sim', 'space-shooter', 'air-combat'],
  puzzle: ['pixel-puzzle', 'match-3-saga', 'block-puzzle'],
  sport: ['athletics-meet', 'net-game', 'turn-sport', 'team-goal-game'],
  horror: ['survival-horror', 'stealth', 'story-adventure'],
  strategy: ['tower-defense', 'rts', 'tactics'],
  life: ['farming', 'co-op-kitchen'],
  table: ['party-mash', 'turn-sport'],
  fight: ['versus-fighter', 'arena-brawler', 'co-op-brawler', 'stylish-action', 'cinematic-action'],
  mecha: ['shooter', 'arena-shooter', 'run-and-gun'],
  rhythm: ['rhythm'],
  city: ['city-stalker', 'open-adventure', 'demolition'],
};
export const GENRE_GROUPS = Object.freeze(Object.fromEntries(Object.entries(G).map(([k, v]) => [k, Object.freeze(v)])));
const g = (...groups) => [...new Set(groups.flatMap((x) => G[x]))];
const EVERY = [...new Set(Object.values(G).flat())];

/** A family's matter and genres (a dial that names a matter overrides the family's: DIAL_MATTER). */
export const FAMILY_FACETS = Object.freeze({
  explosion: { matter: ['fire', 'earth'], genres: g('shooting', 'strategy', 'flight', 'city') },
  impact: { matter: ['flesh'], genres: g('shooting', 'melee') },
  footstep: { matter: ['flesh', 'earth'], genres: g('adventure', 'shooting', 'platform', 'horror', 'melee') },
  melee: { matter: ['air', 'flesh'], genres: g('melee', 'fight') },
  gunshot: { matter: ['metal', 'fire'], genres: g('shooting') },
  handling: { matter: ['metal', 'machine'], genres: g('shooting') },
  projectile: { matter: ['air', 'metal'], genres: g('shooting') },
  breakage: { matter: ['stone'], genres: g('shooting', 'adventure', 'city') },
  elemental: { matter: ['air'], genres: g('adventure', 'melee') },
  shield: { matter: ['energy'], genres: g('shooting', 'melee', 'mecha') },
  booster: { matter: ['machine', 'fire'], genres: g('flight', 'mecha') },
  engine: { matter: ['machine'], genres: g('racing', 'flight', 'city') },
  beam: { matter: ['energy'], genres: g('shooting', 'mecha') },
  charge: { matter: ['energy'], genres: g('shooting', 'mecha') },
  fire: { matter: ['fire', 'wood'], genres: g('adventure', 'life', 'horror') },
  ball: { matter: ['synthetic'], genres: g('sport') },
  sport: { matter: ['synthetic', 'air'], genres: g('sport') },
  crowd: { matter: ['voice'], genres: g('sport', 'fight') },
  tires: { matter: ['synthetic', 'stone'], genres: g('racing') },
  crash: { matter: ['metal', 'glass'], genres: g('racing', 'city') },
  motoring: { matter: ['machine', 'metal'], genres: g('racing', 'city') },
  servo: { matter: ['machine'], genres: g('mecha') },
  magic: { matter: ['energy'], genres: g('adventure') },
  bow: { matter: ['wood', 'air'], genres: g('adventure', 'strategy', 'melee') },
  interact: { matter: ['wood'], genres: g('adventure', 'horror', 'platform') },
  platform: { matter: ['synthetic'], genres: g('platform') },
  puzzle: { matter: ['synthetic'], genres: g('puzzle') },
  tabletop: { matter: ['wood', 'paper'], genres: g('table') },
  dice: { matter: ['synthetic', 'wood'], genres: g('table') },
  work: { matter: ['earth', 'wood'], genres: g('life') },
  cooking: { matter: ['fire', 'water'], genres: g('life') },
  heartbeat: { matter: ['flesh'], genres: g('horror') },
  breath: { matter: ['voice', 'air'], genres: g('horror', 'adventure') },
  horror: { matter: ['synthetic'], genres: g('horror') },
  build: { matter: ['stone', 'metal', 'wood'], genres: g('strategy') },
  siege: { matter: ['wood', 'metal', 'fire'], genres: g('strategy') },
  flight: { matter: ['machine', 'air'], genres: g('flight') },
  brawl: { matter: ['flesh'], genres: g('fight', 'melee') },
  katana: { matter: ['metal', 'air'], genres: g('melee', 'fight') },
  voice: { matter: ['voice', 'flesh'], genres: g('adventure', 'melee', 'platform', 'shooting', 'fight') },
  launch: { matter: ['machine'], genres: g('mecha') },
});

// what a dial value says about matter or weight (the families' own words)
const DIAL_MATTER = {
  metal: ['metal'], stone: ['stone'], wood: ['wood'], dirt: ['earth'], flesh: ['flesh'], water: ['water'], armor: ['metal'],
  energy: ['energy'], concrete: ['stone'], grass: ['earth'], gravel: ['stone'], snow: ['water', 'earth'], glass: ['glass'],
  fire: ['fire'], ice: ['water', 'glass'], lightning: ['electric'], wind: ['air'], beam: ['energy'], rocket: ['fire', 'air'],
  asphalt: ['stone'], 'blade-swing': ['air', 'metal'], 'blade-hit': ['metal'], clash: ['metal'], 'blunt-swing': ['air', 'wood'],
  'blunt-hit': ['wood'], block: ['metal'], casing: ['metal'], ricochet: ['metal', 'air'],
};
const DIAL_WEIGHT = {
  size: { small: 'light', medium: 'mid', large: 'heavy', huge: 'heavy' },
  weight: { light: 'light', medium: 'mid', heavy: 'heavy' },
  body: { light: 'light', heavy: 'heavy', giant: 'heavy' },
  severity: { light: 'light', heavy: 'heavy' },
  caliber: { pistol: 'light', smg: 'light', rifle: 'mid', magnum: 'heavy', shotgun: 'heavy', sniper: 'heavy' },
};

// a row with no family to read (a palette cue, a set's, a channel's): its matter by its words
const ROW_MATTER = {
  jump: ['flesh', 'air'], land: ['flesh', 'earth'], step: ['flesh', 'earth'], dodge: ['air'], shoot: ['fire', 'metal'],
  reload: ['metal', 'machine'], hit: ['flesh'], thud: ['earth'], swing: ['air'], strike: ['flesh'], down: ['flesh'],
  death: ['voice'], pickup: ['synthetic'], door: ['wood'], goal: ['synthetic'], lose: ['synthetic'], alarm: ['synthetic', 'electric'],
  checkpoint: ['synthetic'], chime: ['synthetic', 'metal'], wave: ['synthetic'], 'beat-hit': ['synthetic'], 'beat-miss': ['synthetic'],
  'swell-in': ['air'],
};
const SET_FACETS = { 'mecha-layered': { matter: ['machine', 'metal', 'energy'], genres: g('mecha') } };

const uniq = (a) => [...new Set(a)];
let cache = null;

/** A row's facets: its own, else what its dials say, else its family's; `fresh` when the mouth voices it. */
export function facetsOf(id) {
  if (!cache) cache = new Map();
  if (cache.has(id)) return cache.get(id);
  const r = SOUNDS[id];
  if (!r) return null;
  const fam = r.make ? FAMILY_FACETS[r.make.family] : null;
  const set = Object.values(r.voices ?? {}).map((v) => SET_FACETS[v]).find(Boolean);
  const dials = r.make ? Object.entries(r.make.dials) : [];
  const fromDials = uniq(dials.flatMap(([, v]) => DIAL_MATTER[v] ?? []));
  // a boolean dial adds its matter to the family's (a wreck's blast is the blast's fire and earth, and metal)
  const added = dials.filter(([d, v]) => v === true && DIAL_MATTER[d]).flatMap(([d]) => DIAL_MATTER[d]);
  const base = fromDials.length ? fromDials : fam?.matter ?? set?.matter ?? ROW_MATTER[id] ?? [];
  const matter = r.matter ? [...r.matter] : uniq([...base, ...added]);
  const weight = r.weight ?? dials.map(([d, v]) => DIAL_WEIGHT[d]?.[v]).find(Boolean) ?? null;
  const genres = uniq([...(fam?.genres ?? set?.genres ?? (r.palette ? EVERY : [])), ...(r.genres ?? [])]);
  const out = Object.freeze({ matter: Object.freeze(matter), weight, genres: Object.freeze(genres), say: Object.freeze([...(r.say ?? [])]), fresh: !!r.voices?.mouth });
  cache.set(id, out);
  return out;
}

/** The rows with every facet asked, in roster order. */
export function soundsWith({ matter, weight, genre } = {}) {
  return SOUND_IDS.filter((id) => {
    const f = facetsOf(id);
    return (!matter || f.matter.includes(matter)) && (!weight || f.weight === weight) && (!genre || f.genres.includes(genre));
  });
}

/** What the shelf owes by material: each category's expected matters (OWED) that no row of it has yet. */
export function facetGaps() {
  const have = new Set(SOUND_IDS.flatMap((id) => facetsOf(id).matter.map((m) => `${SOUNDS[id].category}|${m}`)));
  return Object.keys(CATEGORIES).flatMap((category) => (OWED[category] ?? []).filter((m) => !have.has(`${category}|${m}`)).map((matter) => ({ category, matter })));
}
// the matters each category is expected to have (a gap is one of these with no row)
const OWED = {
  impact: ['metal', 'wood', 'stone', 'glass', 'earth', 'water', 'flesh', 'energy'],
  movement: ['metal', 'wood', 'stone', 'earth', 'water'],
  destruction: ['metal', 'wood', 'stone', 'glass'],
  elemental: ['fire', 'water', 'air', 'electric'],
  creature: ['creature'],
  melee: ['metal', 'wood', 'air', 'flesh', 'energy'],
  world: ['metal', 'wood', 'stone'],
};
