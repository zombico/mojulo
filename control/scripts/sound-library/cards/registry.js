/**
 * The vehicle registry's own sounds (vehicle-registry/roster.js): the engines the road cars set left out (an electric
 * motor, a scooter, a V-twin, a V12, a locomotive, an outboard, a propeller plane, a jet), the loops a vehicle runs on
 * (tracks, rails, rotors, a freewheel, hooves, sails), and the events a vehicle is known by (sirens, horns, bells, air
 * brakes, a reverse beeper, a car's alarm and its lock, flybys, a launch). Same card shapes as vehicles.js; each card's
 * `shelf` is the row it voices, an engine's loops its `engine` and `rpm`.
 */

const rev = (engine, rpm, prompt, seconds = 6) => ({ id: `${engine}-${rpm}`, engine, rpm, role: 'loop', prompt, seconds, influence: 0.7, loop: true, takes: 2 });
const revs = (engine, rpms, at) => rpms.map((r, i) => rev(engine, r, at(r, i)));
const steady = (what) => (r, i) => (i === 0 ? `${what} idling, steady at ${r} rpm, constant, no revving, no other sounds`
  : `${what} held at a constant ${r} rpm under steady load, constant pitch, no gear changes, no other sounds`);
const loopFx = (id, shelf, prompt, seconds = 6) => ({ id, shelf, role: 'loop', prompt, seconds, influence: 0.5, loop: true, takes: 2 });
const shot = (id, shelf, prompt, seconds = 1.5, extra = {}) => ({ id, shelf, role: 'one-shot', prompt, seconds, influence: 0.5, loop: false, takes: 3, ...extra });

export const CARDS = [
  // engines (a held voice crossfades each set by the revs its row is tuned to)
  ...revs('electric', [1000, 4000, 8000, 12000, 16000], (r, i) => (i === 0 ? 'an electric car standing still, a faint motor and inverter hum, constant, no other sounds'
    : `an electric car motor whining steadily at ${r} rpm, the inverter's high whine and tyre hum, constant pitch, no other sounds`)),
  ...revs('scooter', [1800, 4000, 6500, 8500, 10500], steady('a small 50cc two-stroke scooter engine, buzzy and thin')),
  ...revs('vtwin', [900, 2000, 3000, 4000, 5200], steady('a big V-twin cruiser motorcycle engine, a loose uneven lope')),
  ...revs('v12', [1000, 3000, 5000, 7000, 9000], steady('a high-revving V12 supercar engine, smooth and shrieking at the top')),
  ...revs('locomotive', [300, 450, 600, 750, 900], steady('a big diesel-electric railway locomotive engine, a deep throbbing prime mover')),
  ...revs('outboard', [800, 2000, 3500, 5000, 6000], steady('a boat\'s outboard motor, heard from the boat, a little water splash')),
  ...revs('prop', [700, 1200, 1800, 2300, 2700], steady('a single-engine propeller airplane, its piston engine and propeller, heard from outside')),
  ...revs('jet', [20, 40, 60, 80, 100], (r, i) => (i === 0 ? 'a jet airliner engine at ground idle, a steady turbine whine, constant, no other sounds'
    : `a jet turbofan engine held steady at ${r} percent thrust, a constant roar and whine, no other sounds`)),
  // what a vehicle runs on (held by its speed)
  loopFx('tank-tracks', 'tank-tracks', 'a tank\'s steel tracks clanking and squealing as it rolls steadily, no engine'),
  loopFx('rail-clack', 'rail-wheels', 'train wheels rolling over rail joints at a steady speed, a rhythmic clickety-clack, no horn'),
  loopFx('rotor-wash', 'helicopter', 'a helicopter\'s main rotor beating steadily overhead, constant, no other sounds'),
  loopFx('quadcopter', 'drone-motors', 'a small quadcopter drone hovering, four propellers buzzing steadily, close'),
  loopFx('freewheel', 'bicycle-freewheel', 'a bicycle coasting, its rear freewheel ticking steadily, tyres on asphalt'),
  loopFx('hooves', 'hooves', 'a horse trotting steadily on a cobbled street, hooves in a constant rhythm, no voice'),
  loopFx('hydraulic-whine', 'walker-hydraulics', 'a heavy machine\'s hydraulic pump whining steadily under load, constant'),
  loopFx('sails', 'sail-wind', 'a sailing boat under way, wind in the sails, ropes creaking, water along the hull, constant'),
  // what a vehicle is known by
  shot('police-wail', 'police-siren', 'a police car siren wailing, rising and falling, passing close', 4),
  shot('police-yelp', 'police-yelp', 'a police car siren in fast yelp mode, close', 3),
  shot('ambulance-hilo', 'hilo-siren', 'an ambulance two-tone hi-lo siren, close', 4),
  shot('fire-horn', 'fire-horn', 'a fire engine air horn blasting twice', 2),
  shot('reverse-beeper', 'reverse-beeper', 'a truck backing up, its reverse warning beeper beeping steadily', 3),
  shot('air-brakes', 'air-brakes', 'a bus or truck air brake releasing with a sharp pneumatic hiss', 1.5),
  shot('bus-door', 'bus-door', 'a city bus door folding open with a pneumatic hiss and clunk', 2),
  shot('bicycle-bell', 'bicycle-bell', 'a bicycle bell rung twice, close', 1),
  shot('train-horn', 'train-horn', 'a diesel train horn blowing one long blast, outdoors', 3),
  shot('tram-bell', 'tram-bell', 'a tram\'s bell clanging twice', 1.5),
  shot('ship-horn', 'ship-horn', 'a big ship\'s deep foghorn blast, over water', 4),
  shot('train-brakes', 'train-brakes', 'a train braking to a stop, steel wheels squealing on the rails', 2.5),
  shot('car-alarm', 'car-alarm', 'a car alarm going off, its siren pattern cycling, outdoors', 4),
  shot('lock-chirp', 'lock-chirp', 'a car locked with a remote key, a double chirp and the locks clunking', 1),
  shot('jet-flyby', 'jet-flyby', 'a fighter jet flying low overhead, roaring past left to right', 5),
  shot('prop-flyby', 'prop-flyby', 'a propeller plane flying low overhead, droning past', 5),
  shot('heli-flyby', 'heli-flyby', 'a helicopter flying low overhead, its rotor thudding past', 5),
  shot('turret-traverse', 'turret-traverse', 'a tank turret traversing, an electric motor whine and heavy gear grind', 2.5),
  shot('jet-spool', 'jet-spool', 'a jet engine starting up, spooling up from silence to idle', 6, { takes: 2 }),
  shot('prop-start', 'prop-start', 'a propeller plane engine cranking, coughing and catching to a rough idle', 4),
  shot('rocket-launch', 'rocket-liftoff', 'a large rocket launching, ignition and a long thundering roar receding', 8, { takes: 2 }),
];
