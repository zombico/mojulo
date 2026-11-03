/**
 * THE DOOR PROBES — what a person gets when they ask for a game in a sentence. One probe a kernel family, never one a
 * genre: a sentence a person says, the hillclimb genre it stands for, and the CONCEPT the made game must hold to be a game
 * of its family, read from what the run would make (the composed world and its steps, runner.js `runSteps`: each level's
 * `compose_world` order), never from a picture.
 *
 * `now` is what the sentence door makes today: 'type' (a game of its family) or 'not' (something else: the three meadow
 * walks a composed world lays, a walker with no body, nothing refused). The probe suite (door-probes.e2e.test.js) holds
 * every probe to its `now`, so a door that starts making a family's game, or stops, fails until `now` says so; the
 * hillclimb page's "from a sentence" column reads it (scripts/tool-surface.mjs).
 *
 * `reference` is the door that makes the family's game today where one does: a book world (`book`, the gameworld a
 * design_game({ world }) stores) where the book lays it, else a quick goal (`quick`, design_game({ quick }), its `world`
 * keys laid over the quick world), held to the same concept so a concept that can never hold is caught; null
 * where the concept is a refusal or a hand-off rather than a level.
 *
 * `shows` is the hillclimb column's word for a probe that holds where its right answer is not a level (a refusal, a
 * hand-off); 'yes' otherwise.
 *
 * A concept is a pure function of { world, steps }: `world` the gameworld the sentence composed (design-game.js
 * `composedWorld`), `steps` the run's steps (`refused` when composing refused the sentence, with no steps). Pure and
 * import-free, so the page builder reads the table without the runtime.
 */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** each level a run makes: its manifest (a level step's order is its compose_world args) */
const levelsOf = (steps) => (steps ?? []).filter((s) => s.key.startsWith('level-') && isObj(s.order?.manifest)).map((s) => s.order.manifest);
const pilotsOf = (m) => (m.entities ?? []).filter((e) => e && e.pilotable);
const mechanicsOf = (m) => (m.game?.mechanics ?? []).map((x) => x.kind);
const someLevel = (steps, test) => levelsOf(steps).some(test);
const armed = (e) => isObj(e.rule?.weapon) || isObj(e.weapon);
/** a hero with a body that jumps: the platform rule on a rigged figure (not the bodiless first-person walker) */
const jumper = (e) => e.rule?.type === 'platform' && e.body?.type !== 'none';
/** made nothing: the sentence was refused, or it laid no level */
const madeNothing = ({ refused, steps }) => !!refused || levelsOf(steps).length === 0;

export const DOOR_PROBES = Object.freeze([
  {
    family: 'race', genre: 'kart-racer', prompt: 'a kart racer: three laps against rival drivers',
    concept: 'a level whose hero drives a ride, won by laps',
    holds: ({ steps }) => someLevel(steps, (m) => pilotsOf(m).some((e) => e.rule?.type === 'drive') && mechanicsOf(m).includes('laps')),
    reference: { quick: { goal: 'race', ride: 'car', vehicle: 'kart', rivals: 3 } },
    now: 'not',
  },
  {
    family: 'shoot', genre: 'shooter', prompt: 'a first-person shooter: clear a warehouse of armed guards',
    concept: 'a level whose hero carries a weapon',
    holds: ({ steps }) => someLevel(steps, (m) => pilotsOf(m).some(armed)),
    reference: { quick: { goal: 'shoot' } },
    now: 'type',
  },
  {
    family: 'strike', genre: 'dungeon-crawler', prompt: 'a dungeon crawler: fight skeletons through crypt rooms',
    concept: 'a level whose hero swings what it holds (its contact window, a right-hand item), with foes to strike',
    holds: ({ steps }) => !!(steps ?? []).find((s) => s.key === 'hero-equipped')?.order?.spec?.gear?.right
      && someLevel(steps, (m) => pilotsOf(m).some((e) => Array.isArray(e.rule?.strikeContact)) && (m.entities ?? []).some((e) => !e.pilotable && e.rule?.type === 'ai')),
    reference: { book: { id: 'ref', foes: { grunt: { class: 'walker' } }, levels: { a: { walk: { nodes: { a: { trail: {} }, b: { trail: {} } } }, foes: { from: ['grunt'] } } },
      characters: { direction: { tradition: 'anime' }, hero: { motion: { vibe: ['bold'] }, actions: { none: true }, adornment: { items: [{ id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] } } } } },
    now: 'type',
  },
  {
    family: 'defend', genre: 'tower-defense', prompt: 'a tower defence game: build towers along the path to stop waves of enemies',
    concept: 'a level that carries a board (the towers, the path, the waves)',
    holds: ({ steps }) => someLevel(steps, (m) => isObj(m.board) || mechanicsOf(m).includes('board')),
    reference: { quick: { goal: 'defend', board: true } },
    now: 'not',
  },
  {
    family: 'battle', genre: 'jrpg', prompt: 'a party role-playing game with turn-based battles',
    concept: 'a level whose fights are turn-based battles (a battle, or a party\'s encounters)',
    holds: ({ steps }) => someLevel(steps, (m) => isObj(m.play?.battle) || (Array.isArray(m.play?.rpg?.encounters) && m.play.rpg.encounters.length > 0)),
    reference: { quick: { goal: 'battle' } },
    now: 'type',
  },
  {
    family: 'contest', genre: 'net-game', prompt: 'a two-player tennis match',
    concept: 'a stadium level with a court',
    holds: ({ steps }) => someLevel(steps, (m) => m.kind === 'stadium' && isObj(m.court)),
    reference: { quick: { goal: 'contest', sport: 'tennis', players: 2 } },
    now: 'not',
  },
  {
    family: 'tabletop', genre: null, prompt: 'a game of chess against the computer',
    concept: 'a level that seats a board game at its table (holo)',
    holds: ({ steps }) => someLevel(steps, (m) => isObj(m.holo)),
    reference: { quick: { goal: 'tabletop', game: 'chess' } },
    now: 'not',
  },
  {
    family: 'pixel', genre: 'match-3-saga', prompt: 'a match-3 puzzle saga',
    concept: 'no 3D walk laid for it (the pixelizer plays it)',
    holds: (r) => madeNothing(r),
    reference: null,
    shows: 'handed off',   // (the hillclimb column's word when it holds: the right answer is not a level)
    now: 'type',
  },
  {
    family: 'platform', genre: 'collectathon', prompt: 'a 3D platformer: run and jump across floating islands collecting coins',
    concept: 'a level whose hero is a body that jumps',
    holds: ({ steps }) => someLevel(steps, (m) => pilotsOf(m).some(jumper)),
    reference: { quick: { goal: 'collect', pickup: 'coin', hero: {} } },
    now: 'type',
  },
  {
    family: 'sneak', genre: 'stealth', prompt: 'a stealth game: sneak past the guards to reach the exit',
    concept: 'a level lost when seen, with a body to sneak in',
    holds: ({ steps }) => someLevel(steps, (m) => mechanicsOf(m).includes('unseen') && pilotsOf(m).some((e) => e.body?.type !== 'none')),
    reference: { quick: { goal: 'sneak', guards: 4, hero: {} } },
    now: 'type',
  },
  {
    family: 'fly', genre: 'flight-sim', prompt: 'a flight sim: take off and fly through the rings',
    concept: 'an airspace level whose hero flies',
    holds: ({ steps }) => someLevel(steps, (m) => m.kind === 'airspace' && pilotsOf(m).some((e) => e.rule?.type === 'fly')),
    reference: { book: { id: 'ref', levels: { a: { airspace: { map: { craft: 'trainer' }, course: true } } } } },
    now: 'type',
  },
  {
    family: 'seats', genre: 'co-op-platformer', prompt: 'a two-player co-op platformer to play with my friend',
    concept: 'a level with a seat for each player',
    holds: ({ steps }) => someLevel(steps, (m) => isObj(m.seats) && (m.seats.max ?? 0) >= 2),
    reference: { quick: { goal: 'collect', pickup: 'coin', camera: 'side', hero: {} }, world: { intent: { cube: { soul: { seats: 'two', frame: 'follow-all' } } } } },
    now: 'type',
  },
  {
    family: 'blocked', genre: 'co-op-kitchen', prompt: 'a co-op kitchen game: four friends cook the orders together',
    concept: 'refused with what it waits on, nothing made in its place',
    holds: (r) => madeNothing(r),
    reference: null,
    shows: 'refused',   // (the hillclimb column's word when it holds: the right answer is not a level)
    now: 'type',
  },
]);

/** The probe standing for a hillclimb genre (a cosmos fixture id), or null. */
export const probeOfGenre = (genre) => DOOR_PROBES.find((p) => p.genre === genre) ?? null;
