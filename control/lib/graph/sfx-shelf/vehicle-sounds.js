/**
 * sfx-shelf/vehicle-sounds — what each vehicle in the registry (vehicle-registry/roster.js) sounds like, as shelf words:
 * its ENGINE (a held row, driven by its throttle), what it RUNS on (a held row driven by its speed: tracks, rails, a
 * freewheel, hooves, sails, a rotor), and the EVENTS it is known by (its start and stop, its horn, its siren, its
 * brakes, its doors, a reverse beeper, a flyby). A vehicle gets its sounds by its realm and role (a road hauler is a
 * diesel with air brakes and a reverse beeper), and a row named below is its own (a muscle car is a V8, a tram rings
 * its bell). Every word is a shelf row, so a vehicle sounds synthesized wherever the recorded library is not installed
 * and recorded where it is (resolve.js, recorded-held.js).
 *
 *   `vehicleSounds(vehicle)`  a registry id or a word for one (resolveVehicle) → { id, engine, runs?, events, silent? } or
 *                             null; `silent` the events it has none of where its kind does (an electric car's starter)
 *   `modelVehicles()`         a town's car models (as below) → the registry vehicle each is: { <model>: <vehicle id> }
 *   `modelEngines()`          a town's car models (the car shelf's cards; a traffic loft `loft:<fleet class>`) → the
 *                             engine each is heard by: { <model>: <engine row> }, through the registry's handles
 *
 * Pure data and pure functions: no clock, no dice.
 */
import { VEHICLES, resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { CAR_CARD_IDS } from '../car-shelf/car-library.js';
import { FLEET } from '../roads/fleet.js';

// a car's events, a truck's, an aircraft's: the events a vehicle of that kind is known by
const CAR = Object.freeze({ start: 'car-ignition', stop: 'car-engine-off', open: 'car-door-open', door: 'car-door', horn: 'car-horn', brake: 'brake-squeal', shift: 'gear-shift', lock: 'lock-chirp', alarm: 'car-alarm' });
const TRUCK = Object.freeze({ start: 'diesel-ignition', stop: 'car-engine-off', door: 'car-door', horn: 'truck-horn', brake: 'air-brakes', reverse: 'reverse-beeper' });
const BIKE = Object.freeze({ start: 'bike-ignition', stop: 'car-engine-off', horn: 'car-horn', shift: 'gear-shift' });
const PLANE = Object.freeze({ start: 'prop-start', flyby: 'prop-flyby' });
const JET = Object.freeze({ start: 'jet-spool', flyby: 'jet-flyby' });
const ROTOR = Object.freeze({ flyby: 'heli-flyby' });
const BOAT = Object.freeze({ horn: 'ship-horn' });
const RAIL = Object.freeze({ horn: 'train-horn', brake: 'train-brakes' });

// by realm and role (realm/role, then realm/*): the engine, what it runs on, its events
const BY_KIND = Object.freeze({
  'road/commuter': { engine: 'car-engine', events: CAR },
  'road/hire': { engine: 'car-engine', events: CAR },
  'road/sport': { engine: 'car-engine', events: CAR },
  'road/racer': { engine: 'race-engine', events: { shift: 'gear-shift' } },
  'road/patrol': { engine: 'v8-engine', events: { ...CAR, start: 'v8-ignition', siren: 'police-siren', yelp: 'police-yelp' } },
  'road/hauler': { engine: 'diesel-engine', events: TRUCK },
  'road/transit': { engine: 'diesel-engine', events: { ...TRUCK, doors: 'bus-door' } },
  'road/service': { engine: 'diesel-engine', events: TRUCK },
  'road/construction': { engine: 'diesel-engine', runs: 'walker-hydraulics', events: TRUCK },
  'road/ground-crew': { engine: 'diesel-engine', events: TRUCK },
  'road/work': { engine: 'electric-motor', events: { reverse: 'reverse-beeper', horn: 'car-horn' } },
  'offroad/armour': { engine: 'tank-engine', runs: 'tank-tracks', events: { turret: 'turret-traverse' } },
  'offroad/construction': { engine: 'diesel-engine', runs: 'walker-hydraulics', events: TRUCK },
  'offroad/racer': { engine: 'car-engine', events: { shift: 'gear-shift', backfire: 'backfire' } },
  'offroad/scout': { engine: 'diesel-engine', events: CAR },
  'offroad/strike': { engine: 'diesel-engine', events: TRUCK },
  'offroad/trail': { engine: 'car-engine', events: CAR },
  'offroad/transport': { engine: 'diesel-engine', events: TRUCK },
  'offroad/work': { engine: 'diesel-engine', events: TRUCK },
  'rail/*': { engine: 'locomotive-engine', runs: 'rail-wheels', events: RAIL },
  'water/*': { engine: 'boat-engine', events: BOAT },
  'air/*': { engine: 'prop-engine', events: PLANE },
  'space/*': { engine: 'rocket-booster', events: {} },
});

// a vehicle that is not its kind's: its own engine, what it runs on, and its own `events` (its whole set) or `more`
// (over its kind's; a `null` takes one away: an electric car has no starter to crank)
const OWN = Object.freeze({
  // road
  'electric-car': { engine: 'electric-motor', more: { start: null, stop: null, shift: null } },
  'e-bike': { engine: 'electric-motor', events: { horn: 'bicycle-bell' } },
  'luxury-sedan': { engine: 'supercar-engine' },
  'muscle-car': { engine: 'v8-engine', more: { start: 'v8-ignition', backfire: 'backfire' } },
  'classic-car': { engine: 'v8-engine', more: { start: 'v8-ignition' } },
  'sports-car': { engine: 'supercar-engine' },
  supercar: { engine: 'supercar-engine' },
  'hot-hatch': { more: { backfire: 'backfire' } },
  'large-suv': { engine: 'v8-engine', more: { start: 'v8-ignition' } },
  'camper-van': { engine: 'diesel-engine' },
  pickup: { more: { horn: 'car-horn', brake: 'brake-squeal', reverse: null } },
  'cargo-van': { more: { horn: 'car-horn', brake: 'brake-squeal' } },
  motorcycle: { engine: 'motorbike-engine', events: BIKE },
  'sport-bike': { engine: 'motorbike-engine', events: BIKE },
  'race-bike': { engine: 'motorbike-engine', events: { shift: 'gear-shift' } },
  'cruiser-bike': { engine: 'vtwin-engine', events: BIKE },
  'sidecar-outfit': { engine: 'vtwin-engine', events: BIKE },
  'motor-trike': { engine: 'vtwin-engine', events: BIKE },
  scooter: { engine: 'scooter-engine', events: { horn: 'car-horn' } },
  moped: { engine: 'scooter-engine', events: { horn: 'car-horn' } },
  'tuk-tuk': { engine: 'scooter-engine', events: { horn: 'car-horn' } },
  bicycle: { engine: null, runs: 'bicycle-freewheel', events: { horn: 'bicycle-bell' } },
  'cycle-rickshaw': { engine: null, runs: 'bicycle-freewheel', events: { horn: 'bicycle-bell' } },
  tricycle: { engine: null, runs: 'bicycle-freewheel', events: { horn: 'bicycle-bell' } },
  cart: { engine: null, runs: 'hooves', events: {} },
  wagon: { engine: null, runs: 'hooves', events: {} },
  chariot: { engine: null, runs: 'hooves', events: {} },
  trailer: { engine: null, events: {} },
  'baggage-cart': { engine: null, events: {} },
  kart: { engine: 'kart-engine', events: {} },
  ambulance: { more: { siren: 'hilo-siren' } },
  'paramedic-van': { more: { siren: 'hilo-siren' } },
  'fire-engine': { more: { siren: 'police-siren', horn: 'fire-horn' } },
  'ladder-truck': { more: { siren: 'police-siren', horn: 'fire-horn' } },
  taxi: { more: { horn: 'car-horn' } },
  limousine: { engine: 'v8-engine', more: { start: 'v8-ignition' } },
  // offroad
  'trophy-truck': { engine: 'v8-engine', more: { start: 'v8-ignition' } },
  'rally-car': { engine: 'car-engine' },
  'dirt-bike': { engine: 'scooter-engine', events: BIKE },
  atv: { engine: 'scooter-engine', events: BIKE },
  buggy: { engine: 'kart-engine' },
  apc: { engine: 'diesel-engine', runs: null },
  hovercraft: { engine: 'prop-engine', events: {} },
  mech: { engine: null, runs: 'walker-hydraulics', events: {} },
  // rail
  tram: { engine: 'electric-motor', events: { horn: 'tram-bell', brake: 'train-brakes' } },
  // water
  'sailing-ship': { engine: null, runs: 'sail-wind' },
  ship: { engine: 'diesel-engine' },
  destroyer: { engine: 'diesel-engine' },
  'aircraft-carrier': { engine: 'diesel-engine' },
  submarine: { engine: 'diesel-engine', events: {} },
  'landing-craft': { engine: 'diesel-engine' },
  // air
  glider: { engine: null, events: {} },
  airship: { engine: 'prop-engine', events: {} },
  'light-helicopter': { engine: 'helicopter', events: ROTOR },
  helicopter: { engine: 'helicopter', events: ROTOR },
  'tandem-helicopter': { engine: 'helicopter', events: ROTOR },
  'attack-helicopter': { engine: 'helicopter', events: ROTOR },
  // space
  rocket: { engine: 'rocket-booster', events: { start: 'rocket-liftoff' } },
});

// the air's jets and drones by their names (a role holds both: the strike role is a jet and a loitering drone)
const JETS = /jet|fighter|interceptor|airliner|widebody|regional|bizjet|stealth|strike|trainer|corsair|transport/;
const DRONES = /drone|quadplane|munition/;
const ROCKETS = /rocket|orbiter|shuttle|capsule|stack/;

/** → { id, engine, runs?, events } for a registry vehicle (its id or a word for it), or null */
export function vehicleSounds(vehicle) {
  const id = VEHICLES[vehicle] ? vehicle : resolveVehicle(vehicle);
  const row = id && VEHICLES[id];
  if (!row) return null;
  let kind = BY_KIND[`${row.realm}/${row.role}`] || BY_KIND[`${row.realm}/*`] || {};
  if (row.realm === 'air' && !OWN[id]) kind = DRONES.test(id) ? { engine: 'drone-motors', events: {} } : JETS.test(id) ? { engine: 'jet-engine', events: JET } : kind;
  if (row.realm === 'space' && ROCKETS.test(id) && !OWN[id]) kind = { engine: 'rocket-booster', events: { start: 'rocket-liftoff' } };
  const own = OWN[id] || {};
  const engine = 'engine' in own ? own.engine : kind.engine ?? null;
  const runs = 'runs' in own ? own.runs : kind.runs ?? null;
  const events = Object.fromEntries(Object.entries({ ...(own.events || kind.events || {}), ...(own.more || {}) }).filter(([, w]) => w));
  // (the events it takes away, said: a page that plays a car's events silences these, where it would play its own)
  const silent = Object.entries(own.more || {}).filter(([, w]) => w === null).map(([e]) => e);
  return { id, engine, ...(runs ? { runs } : {}), events, ...(silent.length ? { silent } : {}) };
}

let models = null, engines = null;
export function modelVehicles() {
  if (models) return models;
  const out = {};
  for (const k of CAR_CARD_IDS) { const id = rowOfHandle('car', k); if (id) out[k] = id; }
  for (const k of Object.keys(FLEET)) { const id = rowOfHandle('fleet', k); if (id) out[`loft:${k}`] = id; }
  return (models = Object.freeze(out));
}
export function modelEngines() {
  if (engines) return engines;
  const out = {};
  for (const [k, id] of Object.entries(modelVehicles())) { const v = vehicleSounds(id); if (v && v.engine) out[k] = v.engine; }
  return (engines = Object.freeze(out));
}

/** every word the table names (a guard test holds each to a shelf row) */
export function vehicleSoundWords() {
  const out = new Set();
  const add = (x) => { if (x && typeof x === 'object') for (const v of Object.values(x)) add(v); else if (typeof x === 'string') out.add(x); };
  add(BY_KIND); add(OWN); add({ CAR, TRUCK, BIKE, PLANE, JET, ROTOR, BOAT, RAIL });
  for (const k of ['drone-motors', 'jet-engine', 'rocket-booster', 'rocket-liftoff']) out.add(k);
  return [...out].sort();
}
