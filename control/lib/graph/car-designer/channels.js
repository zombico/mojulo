/**
 * THE VEHICLE SHEET'S CHANNELS: where a design note lands on a vehicle, and the DIALS a note's derives may name. The
 * Egocube's grammar (egocube/channels.js), for a machine: a derive is a string, a dial and a direction or a word,
 *
 *   'proportion.wheelScale +'   raise it      'physics.CdA -'   lower it
 *   'body = coupeThree'         set the word  'adorn = pipes'   (a `many` family: several words a sheet)
 *
 * It names where a note can land, never an amount: compiling the sheet decides (the realistic pole holds its class's
 * numbers, the racer pole's exaggeration scales). The word families are the live tables of the vehicle designer
 * (vehicle-designer/veh-*.js families), the technology builder (tech-bodyplan's wheeled plans, tech-direction's motifs,
 * tech-adornment's pieces) and the driving primitives (roads/vehicles.js: the class and its physics row); the tests
 * cross-check every key against them. `proportion` and `livery` are this sheet's own dials: the compiler (V2, V3) is
 * held to read every key they name.
 */

/** Channel id → { life: born | lived, asks }, in the order a sheet prints them. Born: what the class or the driver's
 *  build gives it; lived: what was chosen for it. */
export const CHANNELS = Object.freeze({
  frame:      { life: 'born',  asks: 'its size and mass, and where the weight sits' },
  stance:     { life: 'born',  asks: 'how it sits on its wheels: ride height, track, the wheels\' size' },
  cockpit:    { life: 'born',  asks: 'where the driver sits, and how much of them shows' },
  engine:     { life: 'born',  asks: 'its power, seen or hidden' },
  handling:   { life: 'born',  asks: 'where its physics leans: launch, top speed, grip, weight' },
  silhouette: { life: 'lived', asks: 'the shape at 64 px' },
  surface:    { life: 'lived', asks: 'edges and panels: the motif the body is made in' },
  livery:     { life: 'lived', asks: 'its paint: value, a second colour, the trim, the accent' },
  ornament:   { life: 'lived', asks: 'its one focal piece and what is bolted on' },
  wear:       { life: 'lived', asks: 'what the road has done to it' },
});
export const CHANNEL_IDS = Object.freeze(Object.keys(CHANNELS));

/** The proportion dials a compiled vehicle reads (V2 holds them to the class; V3 exaggerates them for a racer). */
export const PROPORTION_KEYS = Object.freeze(['length', 'width', 'height', 'wheelbase', 'track', 'rideHeight', 'wheelScale', 'cabinScale', 'bonnet']);
/** The livery's groups (a racer's from the outfit's own hues; a realistic one's from the world's paints). */
export const LIVERY_KEYS = Object.freeze(['primary', 'secondary', 'trim', 'accent']);

/** Dial family → { kind: dir | word, keys, door, many? }. The keys below are cross-checked against the live tables. */
export const DIALS = Object.freeze({
  class:      { kind: 'word', keys: ['kart', 'compact', 'midsize', 'crossover', 'pickup', 'van', 'sports', 'rally', 'buggy', 'trophyTruck', 'atv', 'straightTruck', 'bus', 'tractorTrailer', 'tractorTrailerLoaded'], door: 'the vehicle class (roads/vehicles.js VEHICLES): its numbers and its physics' },
  chassis:    { kind: 'word', keys: ['ladderFrame', 'unibodyPan', 'sportPan', 'towedFrame'], door: 'the chassis family (vehicle-designer/veh-chassis.js)' },
  body:       { kind: 'word', keys: ['sedanThree', 'coupeThree', 'wagonTwo', 'vanOne', 'truckCab', 'fastbackEV', 'crossoverTwo', 'sleekEV'], door: 'the body family (vehicle-designer/veh-body.js)' },
  bodyplan:   { kind: 'word', keys: ['car', 'truck', 'bus', 'apc'], door: 'the wheeled body plan (gameworld/tech-bodyplan.js vehicle/wheeled): a racer\'s body' },
  wheel:      { kind: 'word', keys: ['steelie', 'fiveSpokeAlloy', 'wireVintage', 'heavyDuty'], door: 'the wheel family (vehicle-designer/veh-wheel.js)' },
  engine:     { kind: 'word', keys: ['inlineFour', 'veeEight', 'transverseFour', 'vintageStacks'], door: 'the engine family (vehicle-designer/veh-engine.js)' },
  cabin:      { kind: 'word', keys: ['benchFront', 'bucketsTwo', 'twoPlusTwo'], door: 'the cabin family (vehicle-designer/veh-cabin.js): where the driver sits' },
  lights:     { kind: 'word', keys: ['roundDuo', 'rectDuo', 'barSingle'], door: 'the lights family (vehicle-designer/veh-lights.js)' },
  drive:      { kind: 'word', keys: ['front', 'rear', 'all'], door: 'the driven wheels (roads/vehicles.js row `drive`)' },
  motif:      { kind: 'word', keys: ['smooth', 'faceted', 'riveted', 'spiked', 'organic', 'ornate'], door: 'the motif (gameworld/tech-direction.js MOTIFS)' },
  adorn:      { kind: 'word', many: true, keys: ['plate', 'panel', 'visor', 'eye', 'vents', 'pipes', 'antenna', 'spikes', 'fins', 'rivets', 'turret', 'rack', 'livery', 'dish', 'lantern', 'bands', 'crates', 'status'], door: 'an adornment piece (gameworld/tech-adornment.js ADORNMENT_PIECES)' },
  physics:    { kind: 'dir', keys: ['mass', 'power', 'CdA', 'Crr', 'grip', 'cgH', 'share'], door: 'the physics row (roads/vehicles.js): handling is derived from it, never stated' },
  proportion: { kind: 'dir', keys: PROPORTION_KEYS, door: 'the proportion dials (held to the class, or a racer\'s exaggeration)' },
  livery:     { kind: 'dir', keys: LIVERY_KEYS, door: 'the livery groups (+ lighter or more saturated, - darker or muted)' },
});

const DERIVE = /^([a-z]+)\.([A-Za-z-]+) ([+-])$|^([a-z]+) = ([A-Za-z-]+)$/;

/** Parse a derive string to { family, key, dir? , word? }, or throw naming what is known. */
export function readDerive(text) {
  const m = DERIVE.exec(text);
  if (!m) throw new Error(`car-designer: a derive is 'family.key +|-' or 'family = word' (got '${text}')`);
  const [family, key, dir] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], null];
  const dial = DIALS[family];
  if (!dial) throw new Error(`car-designer: unknown dial family '${family}' (known: ${Object.keys(DIALS).join(', ')})`);
  if ((dial.kind === 'dir') !== (dir != null)) throw new Error(`car-designer: '${family}' takes ${dial.kind === 'dir' ? 'a direction' : 'a word'} (got '${text}')`);
  if (!dial.keys.includes(key)) throw new Error(`car-designer: unknown ${family} '${key}' (known: ${dial.keys.join(', ')})`);
  return dir ? { family, key, dir } : { family, word: key };
}

/** What a derive claims on a sheet: a dial (a direction), a word family (one word), or a word of a `many` family. */
export function dialKey(r) {
  if (r.dir) return `${r.family}.${r.key}`;
  return DIALS[r.family].many ? `${r.family} = ${r.word}` : r.family;
}
