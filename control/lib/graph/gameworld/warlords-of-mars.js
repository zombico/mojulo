/**
 * WARLORDS OF MARS — the rail's starter: a single-player assault frame game (assault-frame/, the frame rule), its
 * operations fought on Mars (the Sol shelf's `mars` geocube: rust ground, a butterscotch sky, Phobos over it). A frame of
 * parts, fast and much of the time in the air: boosting, quick-boosting, climbing on its thrusters, a gun in each hand
 * and a weapon on each shoulder. The level path Wolf Squadron and Rebel Storm laid carries it: a rail row (rails.js), its
 * starter's levels, each an airspace level with a `frame` and an `operation` (frame-goal.js).
 *
 *   WARLORDS_OF_MARS            the rail's numbers: the pilot's frame, its paint, the field's size, the ground's world
 *   WARLORDS_LOOK               the game's interface's theme card
 *   OPERATIONS                  the starter's operations, in order: { id, name, brief, map, groups, tasks }
 *   operationLevel(op)          → the gameworld level: its airspace (the field, Mars's ground, the frame) and its goal
 *   warlordsOfMarsStart(world, { operations? }) → { world }: the operations under what the creator wrote
 *
 * Pure: the same pitch, the same starter.
 */

export const WARLORDS_OF_MARS = Object.freeze({ frame: 'vanguard', palette: 'federation', field: 1400, geocube: 'mars', sky: 'mars', foePalette: 'ash' });
export const WARLORDS_LOOK = 'squadron';

const f = Object.freeze;
export const OPERATIONS = f([
  f({
    id: 'landfall', name: 'Landfall at Tharsis', map: 'plain',
    brief: 'Dropped onto the Tharsis plain at dawn. A line of gun emplacements covers the landing zone: break it, then the hover tanks coming up behind it.',
    groups: f([
      f({ id: 'guns', kind: 'turret', count: 3, at: f([0, 0.1]), spread: 120 }),
      f({ id: 'column', kind: 'tank', count: 4, at: f([0.35, 0.55]), spread: 90 }),
    ]),
    tasks: f([f({ down: 'guns', text: 'Break the gun line' }), f({ down: 'column', text: 'Destroy the tank column' }), f({ reach: f([0.4, 0.7]), text: 'Secure the relay' })]),
  }),
  // (THE HELLAS ROAD, its rungs up to the ace, each teaching what the next leans on: the Gnat Screen first)
  f({
    id: 'gnat-screen', name: 'Gnat Screen', map: 'plain',
    brief: 'A swarm of drones screens the road north. Small and quick, hard to hold in a lock: keep moving, keep firing on the move, and break the guns they cover.',
    groups: f([
      f({ id: 'screen', kind: 'gnat', count: 8, at: f([0, 0.15]), spread: 110 }),
      f({ id: 'guns', kind: 'turret', count: 2, at: f([0.2, 0.55]), spread: 90 }),
    ]),
    tasks: f([f({ down: 'screen', text: 'Clear the drone screen' }), f({ down: 'guns', text: 'Silence the emplacements' })]),
  }),
  // (the fliers that fly: strike drones that dive and rake, with a Gnat screen round them)
  f({
    id: 'dust-devils', name: 'Dust Devils', map: 'plain',
    brief: 'Strike drones work the road, diving out of the sun to rake anything that moves and pulling away to come round again. Side-step the run, then catch them at the bottom of the dive, slow and low.',
    groups: f([
      f({ id: 'strikers', kind: 'wasp', count: 4, at: f([0, 0.45]), spread: 160 }),
      f({ id: 'screen', kind: 'gnat', count: 4, at: f([0, 0.2]), spread: 90 }),
    ]),
    tasks: f([f({ down: 'strikers', text: 'Down the strike drones' })]),
  }),
  // (rung two: homing salvos from far back, a quick boost to slip them and an assault boost to close)
  f({
    id: 'long-guns', name: 'Long Guns', map: 'plain',
    brief: 'Missile carriers hang back behind a line of tanks, their salvos homing on anything that stands still. Quick-boost out from under each salvo, then charge through the tanks on an assault boost and break the carriers.',
    groups: f([
      f({ id: 'carriers', kind: 'hammer', count: 3, at: f([0, 0.7]), spread: 130 }),
      f({ id: 'screen', kind: 'tank', count: 3, at: f([0, 0.2]), spread: 100 }),
    ]),
    tasks: f([f({ down: 'carriers', text: 'Destroy the missile carriers' }), f({ reach: f([0, 0.85]), text: 'Take the ridge' })]),
  }),
  // (perch drones high and far, missiles down on anything that stays still; climb to reach them)
  f({
    id: 'high-watch', name: 'High Watch', map: 'basin',
    brief: 'Perch drones hang high over the crater, lobbing homing missiles down and drifting to a new perch when pressed. Climb on your thrusters to reach them, and keep moving under them.',
    groups: f([
      f({ id: 'perches', kind: 'kite', count: 3, at: f([0, 0.4]), spread: 220 }),
      f({ id: 'guns', kind: 'turret', count: 2, at: f([0, 0.15]), spread: 120 }),
    ]),
    tasks: f([f({ down: 'perches', text: 'Bring down the perch drones' }), f({ down: 'guns', text: 'Silence the guns' })]),
  }),
  // (rung three: a front that is shut; break it, flank it, or kick it aside, then punish what is behind it)
  f({
    id: 'shield-line', name: 'The Shield Line', map: 'plain',
    brief: 'A line of shield walkers holds the approach, their slabs eating every round fired at their front. Break a slab with heavy fire, go round it, or kick it aside, and punish the walker behind it before it raises the slab again.',
    groups: f([
      f({ id: 'line', kind: 'bastion', count: 3, at: f([0, 0.3]), spread: 120 }),
      f({ id: 'guns', kind: 'turret', count: 2, at: f([0, 0.62]), spread: 110 }),
    ]),
    tasks: f([f({ down: 'line', text: 'Break the shield line' }), f({ down: 'guns', text: 'Silence the guns behind it' })]),
  }),
  f({
    id: 'red-dust', name: 'Red Dust', map: 'basin',
    brief: 'A pass through the crater rim, held by walkers and emplacements. A frame of the warlord\'s guard is on its way to reinforce it.',
    groups: f([
      f({ id: 'pickets', kind: 'walker', count: 5, at: f([-0.2, 0.15]), spread: 140 }),
      f({ id: 'nest', kind: 'turret', count: 2, at: f([0.15, 0.45]), spread: 60 }),
      f({ id: 'guard', kind: 'frame', build: 'raptor', at: f([0, 0.7]) }),
    ]),
    tasks: f([f({ down: f(['pickets', 'nest']), text: 'Clear the pass' }), f({ down: 'guard', text: 'Destroy the guard frame' })]),
  }),
  // (rung four: frames before the frame; a pack of light MTs that circle in, then a heavy one whose mortar is its window)
  f({
    id: 'jackal-pack', name: 'Jackal Pack', map: 'basin',
    brief: 'Three Jackals hunt the crater road: small, quick frames that circle in close. Break them, and the Rhino behind them comes up. Its mortar hangs it in the air as it fires: that is when you hit it.',
    groups: f([
      f({ id: 'pack', kind: 'frame', mt: 'jackal', count: 3, at: f([0, 0.3]), spread: 90 }),
      f({ id: 'rhino', kind: 'frame', mt: 'rhino', at: f([0, 0.68]) }),
    ]),
    tasks: f([f({ down: 'pack', text: 'Break the Jackal pack' }), f({ down: 'rhino', text: 'Destroy the Rhino' })]),
  }),
  // (the gunship: twice a frame, circling, hanging to barrage, a Gnat escort round it)
  f({
    id: 'harrow', name: 'Harrow', map: 'plain',
    brief: 'The warlord\'s gunship hunts the plain: it circles, then stops and hangs to barrage with its chin gun and its missile pods. That hang is your window: close on it and hit it hard. It tightens its circle as it is hurt.',
    groups: f([
      f({ id: 'gunship', kind: 'harrow', at: f([0, 0.4]) }),
      f({ id: 'escort', kind: 'gnat', count: 6, at: f([0, 0.3]), spread: 120 }),
    ]),
    tasks: f([f({ down: 'gunship', text: 'Bring down the Harrow' })]),
  }),
  // (the ace the path ladders up to, assault-frame/aces.js: it duels, then rushes with its blade, its optics flaring
  // before it strikes, then, cornered, calls in the walkers held back behind it)
  f({
    id: 'vermilion', name: 'Vermilion', map: 'basin',
    brief: 'The warlord\'s ace waits on the crater floor. It duels first; wounded, it rushes with its blade, and its optics flare before it strikes: make it miss, then punish it. Cornered, it calls in its pickets.',
    groups: f([
      f({ id: 'ace', kind: 'frame', ace: 'vermilion', at: f([0, 0.45]) }),
      f({ id: 'reserve', kind: 'walker', count: 4, at: f([0, 0.8]), spread: 140, reserve: true }),
    ]),
    tasks: f([f({ down: 'ace', text: 'Destroy Vermilion' })]),
  }),
  f({
    id: 'warlord', name: 'The Warlord', map: 'basin',
    brief: 'The warlord\'s own frame, heavy and slow and hard to put down, with two of its guard. Take the guard first.',
    groups: f([
      f({ id: 'escort', kind: 'frame', build: 'raptor', count: 2, at: f([0, 0.35]), spread: 160 }),
      f({ id: 'warlord', kind: 'frame', build: 'citadel', at: f([0, 0.65]) }),
    ]),
    tasks: f([f({ down: 'escort', text: 'Destroy the escort' }), f({ down: 'warlord', text: 'Destroy the warlord' })]),
  }),
]);

const clone = (v) => JSON.parse(JSON.stringify(v));

/** An operation as a gameworld level: its field on Mars, the pilot's frame, the enemy's groups and the tasks. */
export function operationLevel(op) {
  const W = WARLORDS_OF_MARS;
  return {
    name: op.name,
    airspace: { map: { form: op.map, field: W.field, craft: 'jet' }, ground: { geocube: W.geocube }, sky: { world: W.sky }, frame: { build: W.frame, palette: W.palette } },
    goal: { operation: { groups: clone(op.groups).map((g) => (g.kind === 'frame' && !g.ace ? { ...g, palette: W.foePalette } : g)), tasks: clone(op.tasks) } },
  };
}

/** The rail's starter: its operations, under what the creator wrote (every key they wrote wins). */
export function warlordsOfMarsStart(world, { operations = OPERATIONS.length } = {}) {
  const levels = Object.fromEntries(OPERATIONS.slice(0, operations).map((op) => [op.id, operationLevel(op)]));
  return {
    world: {
      mode: 'autonomous', intent: { from: 'mech-action' }, ui: { theme: WARLORDS_LOOK }, start: OPERATIONS[0].id,
      ...world, levels,
    },
  };
}
