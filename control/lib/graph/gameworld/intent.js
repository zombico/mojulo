/**
 * THE INTENT — what game a gameworld is, said as a cosmos cube (cosmos/cosmos.js), so the world can be laid for it.
 * The cube is the contract; a genre is only a preset cube to start from (the cosmos probes), never a lock: any value
 * may be changed and a world may mix what two genres ask.
 *
 *   intent: { from?: '<genre id>', cube?: { <facet>: { <setting>: value } }, why?: '<words>' }
 *     from   a genre (GENRES) whose cube the world starts from
 *     cube   the world's own values, laid over it value by value
 *     why    the creator's words for it
 *   A stored row may still carry `target`, an engine a retired game runtime once translated it for (RETIRED_TARGETS):
 *   accepted and inert, read as no target, so the row still resolves and re-renders as before. No engine runs a game
 *   now (a team's engine takes a handoff: export_model { engine }), so another target is refused.
 *
 * A world that names no intent still has a cube: the one it implies (its quick goal's genre, its camera, topology,
 * ride, pixel look), read and shown, never written.
 *
 *   GENRES                   { <id>: { name, why, words } } the presets, with the words a brief uses for each
 *   QUICK_GENRE              { <quick goal>: <genre id> } the genre a quick goal is
 *   suggestGenres(text, n?)  → [{ id, name, why, matched }] the presets whose words the text uses, most first: a
 *                            heuristic over words, said to be one, for the agent (the real reader of a brief) to pick
 *                            from or ask about. It suggests a starting cube and refuses nothing.
 *   readIntent(v)            → { from, cube, why } or null; throws, teaching
 *   quickGenre(quick)        → the genre id a quick goal is, or null (the `from` a quick game's cube is read from, and
 *                            the intent quickWorld writes)
 *   cubeOfWorld(world)       → { cube, from, said: [<facet.setting>] } the cube the world is: its genre's, then what the
 *                            world's own settings imply, then its intent's own values (`said`: the ones the intent wrote)
 *   intentReport(world)      → { from, written, verdict, concerns: [{ id, name, by, laid, checked }], suggest?, drift?,
 *                            latent? } (latent: the resonances a user voices that the cube is one move from, resonance.js)
 *                            the readout's: the world's cube read (cosmos dryRun's verdict), what it asks of the world,
 *                            for a world that wrote no intent the genres its brief's words suggest, for a quick game
 *                            whose goal now reads as another genre than its written one `drift: { written, goal }`
 *                            (the written one holds until the creator changes it)
 */
import { FIXTURES } from '../cosmos/fixtures.js';
import { validateCube, dryRun } from '../cosmos/cosmos.js';
import { concernsOf } from './concerns.js';
import { latentOf } from './resonance.js';
import { CRAFT } from '../skyscape/eye.js';
import { resolveSport } from '../contest/sports.js';

// the words a brief uses for each genre (lower case; a phrase is matched whole)
const WORDS = Object.freeze({
  'dungeon-crawler': ['dungeon', 'crawler', 'crypt', 'catacomb', 'rooms', 'loot'],
  collectathon: ['collect', 'collectathon', 'coins', 'gems', 'platformer', 'jump'],
  'top-down-adventure': ['top-down', 'top down', 'adventure', 'overworld', 'zelda-like', 'explore'],
  'stylish-action': ['stylish action', 'character action', 'devil may cry', 'bayonetta', 'juggle', 'launcher', 'air combo', 'style rank'],
  'open-adventure': ['open-world adventure', 'open world adventure', 'breath of the wild', 'horseback', 'ride a horse', 'open land', 'sword and shield'],
  // (11-10: narrow on purpose, the phrase a brief says only when it means the genre: "a 3D platformer" stays the
  // collectathon's door, "an rpg" the party's)
  'platformer-3d': ['mascot platformer', 'air dash', 'jetpack'],
  'action-rpg': ['action rpg', 'action-rpg', 'arpg', 'stamina gauge', 'lock on'],
  demolition: ['destruction sandbox', 'demolition', 'destructible world', 'blow up buildings', 'bring down the building'],
  'headset-adventure': ['vr', 'virtual reality', 'headset', 'webxr'],
  'military-sim': ['military sim', 'milsim', 'arma', 'battlefield', 'squad', 'tank', 'armoured vehicle', 'recoil', 'ballistics'],
  'tactical-espionage': ['tactical espionage', 'metal gear', 'cqc', 'close quarters', 'silenced pistol', 'operative', 'infiltration'],
  shooter: ['shooter', 'shoot', 'gun', 'guns', 'rifle', 'fps', 'first-person shooter', 'firefight', 'cover', 'ammo'],
  'arena-shooter': ['deathmatch', 'death match', 'arena shooter', 'frags', 'frag', 'free for all', 'free-for-all', 'bots', 'respawn', 'quake', 'unreal tournament'],
  jrpg: ['rpg', 'jrpg', 'party', 'turn-based', 'turn based', 'battle', 'battles', 'role-playing'],
  'long-rpg': ['long rpg', 'open world rpg', 'open-world rpg', 'epic', 'saga', 'main quest', 'side quests', 'chapters', 'campaign'],
  metroidvania: ['metroidvania', 'abilities unlock', 'backtrack', 'map', 'interconnected'],
  'survival-horror': ['horror', 'survival horror', 'scary', 'dread', 'fixed camera', 'mansion'],
  'story-adventure': ['story', 'narrative', 'cutscene', 'cutscenes', 'dialogue', 'characters talk'],
  'arena-brawler': ['brawler', 'arena', 'melee', 'sword fight', 'beat-em-up', 'fight'],
  'pixel-puzzle': ['pixel', 'retro', 'puzzle'],
  stealth: ['stealth', 'sneak', 'guards', 'unseen', 'spotted', 'infiltrate'],
  racing: ['race', 'racing', 'car', 'cars', 'drive', 'driving', 'laps', 'time trial', 'checkpoints'],
  'kart-racer': ['kart', 'karts', 'kart racer', 'go-kart', 'rivals', 'circuit', 'track', 'grand prix', 'podium'],
  'flight-sim': ['fly', 'flying', 'flight', 'flight sim', 'plane', 'airplane', 'aircraft', 'pilot', 'glider', 'runway', 'take off', 'landing', 'ring gates', 'rings in the sky'],
  'space-shooter': ['space', 'spaceship', 'starfighter', 'star fighter', 'space shooter', 'space combat', 'asteroid', 'asteroids', 'trench run', 'trench', 'x-wing', 'battle station', 'exhaust port'],
  'air-combat': ['dogfight', 'dogfights', 'dogfighting', 'air combat', 'ace combat', 'fighter jet', 'jet fighter', 'fighter jets', 'shoot down', 'enemy planes', 'top gun'],
  rhythm: ['rhythm', 'beat', 'music', 'dance', 'tempo'],
  'endless-runner': ['runner', 'endless', 'lanes', 'swipe', 'dash'],
  'match-3-saga': ['match-3', 'saga', 'candy', 'swap', 'stars'],
  roguelike: ['roguelike', 'roguelite', 'runs', 'permadeath', 'procedural', 'run'],
  farming: ['farm', 'farming', 'crops', 'harvest', 'plant', 'village life', 'life sim', 'seasons'],
  'tower-defense': ['tower defence', 'tower defense', 'towers', 'waves', 'defend', 'base'],
  'block-puzzle': ['boulder', 'boulders', 'push', 'sokoban', 'block puzzle', 'plates'],
  tactics: ['tactics', 'tactical', 'final fantasy tactics', 'fire emblem', 'srpg', 'strategy rpg', 'grid', 'squares', 'high ground', 'positioning'],
  rts: ['rts', 'real-time strategy', 'real time strategy', 'starcraft', 'command and conquer', 'army', 'armies', 'build orders', 'base building', 'harvesters'],
  'versus-fighter': ['fighting game', 'street fighter', 'tekken', 'versus', '1v1', 'one-on-one', 'one on one', 'combo', 'combos', 'special moves', 'fireball', 'uppercut', 'roster'],
  'cinematic-action': ['bullet time', 'slow motion', 'slow-mo', 'slowmo', 'shootdodge', 'kill cam', 'killcam', 'set pieces', 'set-pieces', 'cinematic action'],
  'co-op-kitchen': ['co-op cooking', 'cooking together', 'kitchen', 'orders', 'chefs', 'overcooked'],
  'party-mash': ['party game', 'party games', 'mash', 'button mash', 'minigames', 'mini-games', 'mario party'],
  'co-op-platformer': ['co-op platformer', 'platform together', 'with my brother', 'with friends', 'couch co-op', 'local co-op'],
  'co-op-brawler': ['beat em up', "beat 'em up", 'beat-em-up', 'brawler with friends', 'street brawler', 'final fight', 'belt scroller'],
  'co-op-scroller': ['bullet hell', 'shmup', 'shoot em up', "shoot 'em up", 'scrolling shooter'],
  'run-and-gun': ['run and gun', 'run & gun', 'run-and-gun', 'run n gun', 'side-scrolling shooter', 'contra', 'metal slug', 'guns blazing'],
  'driver-and-gunner': ['driver and gunner', 'one drives one shoots', 'turret', 'gunner'],
  'split-deathmatch': ['split screen', 'split-screen', 'splitscreen', 'goldeneye', 'couch deathmatch'],
  'city-stalker': ['web swing', 'web-swing', 'web-slinging', 'swing between', 'rooftop', 'rooftops', 'skyscraper', 'skyscrapers', 'wall crawl', 'crawl the walls', 'grappling hook', 'superhero', 'vigilante', 'open-world city'],
  // battle city (10-25): sports. A sport named is its shape's words; "football" is the team game, "race" stays the car's
  'athletics-meet': ['athletics', 'athletic', 'olympic', 'olympics', 'track and field', 'sprint', 'sprinting', '100m', 'hurdles', 'long jump', 'high jump', 'javelin', 'shot put', 'decathlon', 'relay', 'meet'],
  'net-game': ['tennis', 'volleyball', 'badminton', 'table tennis', 'ping pong', 'pong', 'pickleball', 'squash', 'rally', 'serve', 'net game', 'racket', 'racquet'],
  'turn-sport': ['golf', 'mini golf', 'minigolf', 'putting', 'bowling', 'curling', 'darts', 'billiards', 'pool table', 'snooker', 'bocce', 'petanque', 'baseball', 'softball', 'home run', 'wicket', 'innings'],
  'team-goal-game': ['soccer', 'football', 'futsal', 'hockey', 'basketball', 'handball', 'lacrosse', 'rugby', 'water polo', 'dodgeball', 'sports game', 'sports', 'goalkeeper', 'offside', 'team sport'],
});
export const GENRES = Object.freeze(Object.fromEntries(FIXTURES.map((f) => [f.id, Object.freeze({ name: f.name, why: f.why, words: WORDS[f.id] ?? [] })])));
const CUBES = Object.fromEntries(FIXTURES.map((f) => [f.id, f.cube]));
/** A genre's preset cube, as `from` starts a world on it (a copy). */
export const genreCube = (id) => (CUBES[id] ? clone(CUBES[id]) : null);
export const QUICK_GENRE = Object.freeze({
  collect: 'collectathon', race: 'racing', sneak: 'stealth', rhythm: 'rhythm', defend: 'tower-defense',
  puzzle: 'block-puzzle', farm: 'farming', battle: 'jrpg', shoot: 'shooter', deathmatch: 'arena-shooter', fly: 'flight-sim',
  fight: 'versus-fighter', conquer: 'rts', runner: 'endless-runner', meet: 'athletics-meet', contest: 'net-game',
});
/** A contest's genre is its sport's shape: a net game, a turn sport, a team goal game (a sport it cannot read: the net game's). */
export function contestGenre(sport) {
  // (a bat-and-ball game is a ball at a time, the turn sport's genre)
  try { const sp = resolveSport(sport); return sp.shape === 'turns' || sp.shape === 'innings' ? 'turn-sport' : sp.shape === 'team' ? 'team-goal-game' : 'net-game'; } catch { return 'net-game'; }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (c) => Object.fromEntries(Object.entries(c ?? {}).map(([f, s]) => [f, { ...s }]));
const fail = (m) => new Error(`gameworld: intent${m}`);
// engines a stored intent may name whose game runtime is retired: accepted, inert (read as no target)
export const RETIRED_TARGETS = Object.freeze(['roblox', 'godot']);

export function suggestGenres(text, n = 3) {
  const t = ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;
  return Object.entries(GENRES)
    .map(([id, g]) => ({ id, name: g.name, why: g.why, matched: g.words.filter((w) => t.includes(` ${w} `)) }))
    .filter((g) => g.matched.length)
    .sort((a, b) => b.matched.length - a.matched.length || a.id.localeCompare(b.id))
    .slice(0, n);
}

// the names a genre goes by (each among its words): one said is a clear read on its own, where two of its other words
// are needed ("towers" or "map" says too little; "tower defence" or "metroidvania" says it)
const NAMES = Object.freeze({
  'dungeon-crawler': ['crawler'], collectathon: ['collectathon'], shooter: ['fps', 'first-person shooter'],
  'arena-shooter': ['deathmatch', 'death match', 'arena shooter'], jrpg: ['rpg', 'jrpg', 'role-playing'], 'long-rpg': ['long rpg', 'open world rpg', 'open-world rpg'], metroidvania: ['metroidvania'],
  'survival-horror': ['survival horror'], 'arena-brawler': ['brawler', 'beat-em-up'], stealth: ['stealth'], racing: ['racing', 'time trial'],
  'kart-racer': ['kart', 'karts', 'kart racer', 'go-kart'], 'flight-sim': ['flight sim'], 'space-shooter': ['space shooter', 'starfighter'],
  'air-combat': ['dogfight', 'dogfights', 'dogfighting', 'air combat'], rhythm: ['rhythm'], 'endless-runner': ['endless'], 'match-3-saga': ['match-3'],
  roguelike: ['roguelike', 'roguelite'], farming: ['farming', 'life sim'], 'tower-defense': ['tower defence', 'tower defense'],
  'block-puzzle': ['sokoban', 'block puzzle'], tactics: ['tactics', 'srpg', 'strategy rpg', 'final fantasy tactics', 'fire emblem'],
  rts: ['rts', 'real-time strategy', 'real time strategy'], 'versus-fighter': ['fighting game', 'street fighter', 'tekken'],
  'cinematic-action': ['bullet time', 'cinematic action'],
  'co-op-kitchen': ['co-op cooking', 'overcooked'], 'party-mash': ['party game', 'party games', 'mario party'],
  'co-op-platformer': ['co-op platformer', 'couch co-op', 'local co-op'], 'co-op-brawler': ['beat em up', "beat 'em up", 'street brawler'],
  'co-op-scroller': ['bullet hell', 'shmup', 'shoot em up', "shoot 'em up", 'scrolling shooter'], 'driver-and-gunner': ['driver and gunner'],
  'run-and-gun': ['run & gun', 'run-and-gun', 'contra', 'metal slug'],
  'split-deathmatch': ['split screen', 'split-screen', 'splitscreen'], 'city-stalker': ['web swing', 'web-swing', 'web-slinging'],
  'athletics-meet': ['athletics', 'track and field', 'decathlon', 'olympics'],
  'net-game': ['tennis', 'volleyball', 'badminton', 'table tennis', 'ping pong', 'pickleball', 'squash'],
  'turn-sport': ['golf', 'mini golf', 'minigolf', 'bowling', 'curling', 'darts', 'billiards', 'snooker', 'baseball', 'softball'],
  'team-goal-game': ['soccer', 'football', 'futsal', 'hockey', 'basketball', 'handball', 'lacrosse', 'rugby', 'water polo', 'dodgeball'],
});

/** The genre a brief's words clearly name, or null: a genre's own name said once (one genre named, or the one named with
 * the most of its words), else the first genre ahead of the second on two of its words at least. `by` says which. */
export function readGenre(text) {
  const all = suggestGenres(text, Infinity);
  const named = all.filter((g) => g.matched.some((w) => (NAMES[g.id] ?? []).includes(w)));
  if (named.length === 1 || (named.length > 1 && named[0].matched.length > named[1].matched.length)) return { ...named[0], by: 'name' };
  if (named.length > 1) return null;
  const [lead, next] = all, words = new Set((lead?.matched ?? []).flatMap((w) => w.split(/[^a-z0-9-]+/)));
  return lead && words.size >= 2 && !(next && next.matched.length === lead.matched.length) ? { ...lead, by: 'words' } : null;
}

export function readIntent(v) {
  if (v === undefined) return null;
  if (!isObj(v)) throw fail(' is { from?: <genre>, cube?: { <facet>: { <setting>: value } }, why? }');
  for (const k of Object.keys(v)) if (!['from', 'cube', 'why', 'target'].includes(k)) throw fail(`.${k} is not part of an intent (from, cube, why)`);
  if (v.from !== undefined && !GENRES[v.from]) throw fail(`.from is a genre: ${Object.keys(GENRES).join(', ')}`);
  if (v.cube !== undefined) {
    if (!isObj(v.cube)) throw fail('.cube is { <facet>: { <setting>: value } } (get_game_vocab({ id: \'gameworld-intent\' }))');
    try { validateCube(v.cube); } catch (e) { throw fail(`.cube: ${e.message.replace(/^cosmos: /, '')}`); }
  }
  if (v.why !== undefined && typeof v.why !== 'string') throw fail('.why is the creator\'s words for it');
  // (a stored row's retired target reads as none; no engine runs a game, so no other target is one)
  if (v.target !== undefined && !RETIRED_TARGETS.includes(v.target)) throw fail(`.target is retired: no engine runs a game, so an intent names none (a team's engine takes a handoff: export_model { engine }); a stored ${RETIRED_TARGETS.join(' | ')} target is read as none`);
  if (v.from === undefined && v.cube === undefined && v.target === undefined) throw fail(' names a genre (from) or its own cube, or both');
  return { from: v.from ?? null, cube: clone(v.cube), why: v.why ?? null };
}

const put = (cube, f, s, v) => { (cube[f] ||= {})[s] = v; };

/** The genre a quick goal is, or null: a race against rivals is a kart race (its cube a loop's), alone a time trial; a
 * shooter with a craft is a dogfight, a space craft's a space shooter, an atmosphere craft's air combat; a contest is its
 * sport's genre. */
export function quickGenre(Q) {
  if (!Q) return null;
  return (Q.goal === 'race' && Q.rivals ? 'kart-racer' : Q.goal === 'shoot' && Q.craft ? (CRAFT[Q.craft]?.space ? 'space-shooter' : 'air-combat') : Q.goal === 'contest' ? contestGenre(Q.sport) : QUICK_GENRE[Q.goal]) ?? null;
}

export function cubeOfWorld(world) {
  const I = readIntent(world?.intent), Q = world?.quick;
  const from = I?.from ?? quickGenre(Q);
  const cube = clone(from ? CUBES[from] : {});
  // what the world's own settings imply
  if (world?.camera) put(cube, 'space', 'camera', world.camera);
  if (world?.topology) put(cube, 'space', 'topology', world.topology);
  if (Q?.ride) put(cube, 'soul', 'hero', 'vehicle');
  if (Q?.transformer) put(cube, 'soul', 'hero', 'transformer');
  if (Q?.track) put(cube, 'space', 'levelForm', Q.track === 'loop' ? 'circuit' : 'trail');
  if (Q?.run) put(cube, 'time', 'progression', 'runs');
  if (world?.style?.pixel) put(cube, 'reality', 'medium', 'pixel');
  // its main quest (main-quest.js): the arc its shape is, the periods it spans, how loose its sides are
  const MQ = world?.mainQuest && typeof world.mainQuest === 'object' ? world.mainQuest : null;
  if (MQ) {
    put(cube, 'time', 'arc', MQ.chapters !== undefined ? 'chapters' : 'acts');
    if (Array.isArray(MQ.periods) && MQ.periods.length > 1) put(cube, 'time', 'periods', MQ.periods.slice(1).some((p) => p?.passage === 'eras') ? 'same-maps' : 'new-maps');
    if (MQ.sides?.looseness) put(cube, 'time', 'sides', MQ.sides.looseness);
  }
  // the intent's own values, last
  const said = [];
  for (const [f, s] of Object.entries(I?.cube ?? {})) for (const [k, v] of Object.entries(s)) { put(cube, f, k, v); said.push(`${f}.${k}`); }
  validateCube(cube);
  return { cube, from, said };
}

const briefReadout = ({ resolved: R, orders }) => ({
  ...(R.motivation ? { motivation: R.motivation, stakes: R.stakes, script: R.script, cast: R.cast, spine: R.spine } : {}),
  ...(R.labour ? { labour: R.labour, structure: R.structure, side: R.side } : {}),
  ...(R.said ? { said: R.said } : {}),
  orders: (orders ?? []).map((O) => `${O.id}: ${O.kind}, ${O.role}: ${O.words}`),
});

export function intentReport(world) {
  const { cube, from } = cubeOfWorld(world), written = world?.intent !== undefined;
  const brief = typeof world?.brief === 'string' ? world.brief : world?.brief?.prompt ?? world?.brief?.text ?? '';
  // (a Game Brief's labours suit their genres, gmn.js: suggested first, never forced)
  const briefed = !written && !world?.quick ? (world?.gameBrief?.resolved?.genres ?? []).filter((id) => GENRES[id]).map((id) => ({ id, matched: [`the brief's ${world.gameBrief.resolved.labour}`] })) : [];
  const suggest = [...briefed, ...(!written && !world?.quick && brief ? suggestGenres(brief).filter((g) => !briefed.some((x) => x.id === g.id)) : [])];
  const I = readIntent(world?.intent), run = dryRun(cube);
  // a quick game's written genre against what its goal reads as now (a goal patched since): said, never rewritten
  const reads = quickGenre(world?.quick), drift = I?.from && reads && reads !== I.from ? { written: I.from, goal: reads } : null;
  // what the cube is one move from (gameworld/resonance.js): an outcome a user voices, the values it still lacks
  const latent = latentOf(cube);
  return {
    from, written, verdict: run.verdict,
    concerns: concernsOf(cube).map(({ asks: _, ...c }) => c),
    ...(suggest.length ? { suggest: suggest.map((g) => ({ id: g.id, matched: g.matched })) } : {}),
    ...(drift ? { drift } : {}),
    ...(latent.length ? { latent } : {}),
    // (what the Game Brief decided, gmn.js: the structure, the stakes, the orders to raise)
    ...(world?.gameBrief?.resolved ? { gameBrief: briefReadout(world.gameBrief) } : {}),
  };
}
