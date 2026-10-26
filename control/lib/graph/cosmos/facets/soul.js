/**
 * SOUL: the characters. Shape as in reality.js.
 *
 * PLAYING TOGETHER (docs/local-multiplayer-principles.md): `party` says who is in the group, the seat settings who
 * drives them. Several players at one machine, one shared screen: `seats` (how many), `contest` (who wins against
 * whom), `dependence` (side by side, in roles, or each step needing another's), `frame` (how the screen holds every
 * seat), `input` (each tick, a contest over a window, or turns), `pool` (lives and score shared or each seat's), `join`
 * (when a seat comes and goes). Each value is built once for every composition that asks for it; until then it is
 * absent, so the sweep ranks it. The law beside them: a camera that frames one body (first person) needs a view per seat.
 */
// a seat value the runtime does not run yet; no engine kernel seats a second player
const NOT_YET = { status: 'absent', godot: 'absent', roblox: 'absent' };
const TOGETHER = { godot: 'absent', roblox: 'absent' };
const VERSUS = 'lib/graph/versus/versus-core.js';
const VERSUS_ONLY = 'the versus fighter only (versus-core.js): two local players or the CPU, on one fixed stage; no other kind seats a second player';
// the seats kernel (controls/seats-kernel.js) seats up to four controllers; the versus fighter plays two on it, and a
// gameworld's hero stage lays a body per seat (gameworld/levels.js seatPart, pilots.plan.md)
const SEATS_KERNEL = 'controls/seats-kernel.js seats up to four controllers (a pad each, the keyboard one): the versus fighter plays two, and a gameworld\'s hero stages lay a hero per seat (levels.js seatPart; a ride, a flight, first person, building and city levels seat one); web only';
const LEVELS = 'lib/graph/gameworld/levels.js';
// what a pilot per seat runs (worlds/controllable/core.js spec.seats): each seat its own body, its own input, each tick
const PILOT_PER_SEAT = 'a pilot per seat in the action runtime (worlds/controllable/core.js spec.seats), laid by a gameworld\'s hero stages (levels.js seatPart); web only';
// the seats kernel's own gaps (a lobby beyond the versus fighter)
const SEATS = { pkg: 'seats', effort: 'M' };
const TWO = ['soul.seats=two'];
// the settings below `seats` mean something only for a game that seats more than one: rolled and nudged only then
const GIVEN = Object.freeze({ seats: ['two', 'four'] });

export const SOUL = Object.freeze({
  id: 'soul',
  asks: 'who?',
  settings: {
    hero: {
      values: {
        hero: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/mcp/tools/create-character.js' },
        // makeable and rigged, not yet a game's pilot: a world's figure takes a hero alone (heroRef, world-scene.js)
        creature: { status: 'partial', godot: 'absent', effort: 'M', lowers: 'lib/mcp/tools/create-character.js', note: 'made and rigged through create_character; not pilotable: a world figure takes a hero (heroRef), no creatureRef' },
        animal: { status: 'partial', godot: 'absent', effort: 'M', lowers: 'lib/mcp/tools/create-character.js', note: 'made and rigged through create_character; not pilotable: a world figure takes a hero (heroRef), no animalRef' },
        // built 10-12: a quick game's `ride` (car, coupe, van) mints its build and pilots every stage on the drive rule,
        // its feel derived from the build's parts. Godot has no drive rule.
        vehicle: { status: 'built', godot: 'built', roblox: 'absent', lowers: 'lib/graph/gameworld/ride.js', note: 'a quick game\'s ride: a car, coupe or van built by the vehicle designer and driven (rules-drive.js); quick games only, no fly rule yet' },
        // built 10-14 (skyscape): a flight's aircraft, a class's envelope on the fly rule (a glider, a trainer, a jet).
        // Its body is a placeholder slab until the aircraft roster; Godot has no fly rule.
        aircraft: { status: 'built', godot: 'absent', lowers: 'lib/graph/skyscape/craft.js', note: 'a quick flight\'s craft (glider, trainer, jet, and the space fighter): its class on the fly rule (rules-fly.js), seated on its runway, launched aloft or flying in space; its body a slab until the aircraft roster' },
        // built 10-19 (more than meets): a hero in two forms, one body (transformation/), B to change; Godot and Roblox
        // have no forms
        transformer: { status: 'built', godot: 'absent', roblox: 'absent', lowers: 'lib/graph/transformation/index.js', note: 'a quick game\'s transformer: a variable suit folding into its waverider, or a car or jet standing up into a robot (controllable/forms.js: the rule of each form, the beat between them); a car\'s goals are a trail\'s, a flier\'s the fly goal' },
      },
    },
    // proportions and a vibe are baked into the figure and its clips; gear rides it (scene/godot-marks.js)
    cast: { source: { module: 'lib/graph/polygonizer/figure-cast.js', table: 'CAST_PRESETS', godot: { all: 'built' } } },
    vibe: { source: { module: 'lib/graph/gameworld/hero-vibe.js', table: 'VIBES', godot: { all: 'built' } } },
    // the suit plays its idle and walk; a jump or a stop happens without its clip; nothing plays a pose (gaitMark)
    gaits: { multi: true, source: { module: 'lib/graph/polygonizer/hero-motion.js', table: 'MOTION_GAITS', marks: 'gaitMarks' } },
    equipment: {
      multi: true,
      source: { module: 'lib/graph/equipment/expand.js', table: 'EQUIPMENT_ITEMS', godot: { all: 'built' }, roblox: { all: 'approximated' } },
      // priced 10-25 (the comic hero pack): a cape is a garment that moves, not a held item; the tailor has no cloth that trails
      planned: {
        cape: { status: 'absent', godot: 'absent', roblox: 'absent', effort: 'M', pkg: 'cape', note: 'a garment hung from the shoulders that trails the gait and lifts in a leap or a flight; a few bones on the hero\'s rig, no cloth simulation' },
      },
    },
    // a creature's body and clips ride the GLB; how it behaves is a mind's, and the kernel has none
    species: { multi: true, source: { module: 'lib/graph/fauna/species.js', table: 'SPECIES', godot: { all: 'approximated' } } },
    party: {
      values: {
        solo: { status: 'built', godot: 'built', roblox: 'built', lowers: 'lib/graph/playscape/player.js' },
        party: { status: 'built', lowers: 'lib/graph/playscape/ui/party.js', godot: 'absent', note: 'a cast member who joins on a flag (cast.<id>.joins) escorts the hero in every level after; no party roster stats or menus yet; web only' },
        // built 10-25 (battle city): a side of a contest, local players and the positional mind's teammates alike
        team: { status: 'built', lowers: 'lib/graph/contest/team-sim.js', godot: 'absent', note: 'a side of a team goal game (team-sim.js): its roles and their home regions the contest kernel\'s, the player nearest the ball at the pad, the rest played by the positional mind, the keeper on its line; two pads on one screen. On the contest page\'s own bodies: the controllable runtime still has one pilot, so the hero body is not on the pitch yet' },
      },
    },
    seats: {
      values: {
        one: { status: 'built', godot: 'built', roblox: 'built', lowers: 'lib/graph/worlds/controllable/core.js', note: 'one pilot (state.pilotId); every other pilotable body runs its AI rule' },
        two: { status: 'built', ...TOGETHER, lowers: LEVELS, note: SEATS_KERNEL },
        four: { status: 'built', ...TOGETHER, lowers: LEVELS, note: SEATS_KERNEL },
      },
    },
    contest: {
      given: GIVEN,
      values: {
        'co-op': { status: 'built', ...TOGETHER, lowers: LEVELS, note: `${PILOT_PER_SEAT}: every seat on the hero's side, an empty seat's hero following the hero`, requires: TWO },
        versus: { status: 'partial', ...TOGETHER, effort: 'S', lowers: VERSUS, note: VERSUS_ONLY, requires: TWO },
        teams: { ...NOT_YET, effort: 'S', requires: ['soul.seats=four'] },
        'free-for-all': { ...NOT_YET, effort: 'S', requires: TWO },
      },
    },
    dependence: {
      given: GIVEN,
      values: {
        parallel: { status: 'built', ...TOGETHER, lowers: LEVELS, note: PILOT_PER_SEAT, requires: TWO },
        roles: { ...NOT_YET, effort: 'M', requires: TWO },
        handoff: { ...NOT_YET, effort: 'L', requires: TWO },
      },
    },
    frame: {
      given: GIVEN,
      values: {
        'follow-all': { status: 'built', ...TOGETHER, lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'the side and top-down cameras hold every playing seat (rules-basic.js groupFrame, the group leash); a third-person camera follows seat 1 only', requires: TWO },
        fixed: { status: 'partial', ...TOGETHER, effort: 'S', lowers: VERSUS, note: VERSUS_ONLY, requires: TWO },
        scroll: { ...NOT_YET, effort: 'M', requires: TWO },
        split: { ...NOT_YET, effort: 'L', requires: TWO },
      },
    },
    input: {
      given: GIVEN,
      values: {
        'real-time': { status: 'built', ...TOGETHER, lowers: LEVELS, note: `${PILOT_PER_SEAT}; the versus fighter too`, requires: TWO },
        window: { ...NOT_YET, effort: 'M', requires: TWO },
        turns: { ...NOT_YET, effort: 'S', requires: TWO },
      },
    },
    pool: {
      given: GIVEN,
      values: {
        shared: { status: 'built', ...TOGETHER, lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'one count of lives the seats share (three a seat), a fall costing one; at none the level is lost (rules-basic.js seat-falls); falls only, a hit is seat 1\'s hp; web only', requires: TWO },
        own: { status: 'built', ...TOGETHER, lowers: 'lib/graph/worlds/controllable/rules-basic.js', note: 'each seat three lives of its own, a fall costing one; a seat with none sits out, and the level is lost when no seat is left (rules-basic.js seat-falls); falls only, a hit is seat 1\'s hp; scores stay one count; web only', requires: TWO },
      },
    },
    join: {
      given: GIVEN,
      values: {
        lobby: { status: 'partial', ...TOGETHER, ...SEATS, lowers: 'lib/graph/versus/versus-play.client.js', note: 'the versus select screen seats its two players before a fight; no other kind has a lobby' },
        'drop-in': { status: 'built', ...TOGETHER, lowers: 'lib/graph/controls/seats-kernel.js', note: 'a player sits down at any time on their own controller (seats-kernel.js): start or light in the versus fighter, any press on a gameworld\'s level' },
      },
    },
  },
  // the cube's laws over these settings: advice, never a refusal (cosmos.js dryRun `advice`)
  laws: [
    {
      id: 'seats-first',
      advice: (cube) => {
        const S = cube.soul || {}, set = ['contest', 'dependence', 'frame', 'input', 'pool', 'join'].filter((k) => S[k] !== undefined);
        return set.length && !GIVEN.seats.includes(S.seats) ? `soul.${set.join(', soul.')} ${set.length === 1 ? 'means' : 'mean'} something only with soul.seats two or four` : null;
      },
    },
    {
      id: 'one-view-per-seat',
      advice: (cube) => (cube.space?.camera === 'first-person' && cube.soul?.frame && cube.soul.frame !== 'split' && cube.soul.seats && cube.soul.seats !== 'one'
        ? `a first-person camera frames one body: ${cube.soul.seats} seats need soul.frame=split (a view each), not ${cube.soul.frame}` : null),
    },
  ],
});
