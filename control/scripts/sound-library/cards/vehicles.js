/**
 * Vehicles: engines as sets of steady loops at known revs (a held voice crossfades them by the revs a game drives, each
 * bent in pitch by the revs over its own), the tyres and the road as loops, and the car's events as one-shots. Shared by
 * every game that drives a car (the open city's car at the wheel, the racing games); each game tunes how it drives
 * them, never what was recorded.
 *
 * A loop card: { id, role: 'loop', engine: <the engine it is part of>, rpm, prompt, seconds, influence, loop: true,
 * takes }. `probe` is the first engine alone, measured for steady pitch before the rest are bought.
 */

const rev = (engine, rpm, prompt, seconds = 6) => ({ id: `${engine}-${rpm}`, engine, rpm, role: 'loop', prompt, seconds, influence: 0.7, loop: true, takes: 2 });
const revs = (engine, what, rpms) => rpms.map((r, i) => rev(engine, r,
  i === 0 ? `${what} idling, steady at ${r} rpm, recorded close to the exhaust, constant, no revving, no other sounds`
    : `${what} held at a constant ${r} rpm under steady throttle, recorded close to the exhaust, constant pitch, no gear changes, no other sounds`));
const shot = (id, shelf, prompt, seconds = 1.2, extra = {}) => ({ id, shelf, role: 'one-shot', prompt, seconds, influence: 0.5, loop: false, takes: 3, ...extra });
const loopFx = (id, shelf, prompt, seconds = 6) => ({ id, shelf, role: 'loop', prompt, seconds, influence: 0.5, loop: true, takes: 2 });

export const PROBE = revs('hatchback', 'a small four-cylinder hatchback car engine', [900, 2000, 3500, 5000, 6500]);

export const CARDS = [
  ...PROBE,
  ...revs('v8', 'a big V8 muscle car engine, deep and rumbling', [800, 2000, 3500, 5000, 6500]),
  ...revs('sportbike', 'a four-cylinder sport motorcycle engine', [1200, 4000, 7000, 10000, 13000]),
  ...revs('kart', 'a single-cylinder two-stroke racing kart engine, buzzing', [2000, 5000, 8000, 11000, 14000]),
  ...revs('diesel', 'a large turbo diesel truck engine, clattering', [700, 1200, 1700, 2200, 2600]),
  ...revs('racecar', 'a high-revving open-wheel race car engine, screaming', [3000, 6000, 9000, 12000, 15000]),
  // the tyres and the road, held by slip and by speed
  loopFx('tire-screech', 'tire-squeal', 'car tyres screeching on asphalt in a long slide, constant, no engine'),
  loopFx('road-roar-loop', 'road-roar', 'tyre and road noise inside a car at highway speed, constant rumble, no engine, no wind'),
  // the car's events
  shot('ignition-hatch', 'car-ignition', 'a small car starter motor cranking and the four-cylinder engine catching to idle', 2.5),
  shot('ignition-v8', null, 'a V8 starter motor cranking and the big engine catching with a rev blip, then idling', 3),
  shot('ignition-diesel', null, 'a diesel truck starter cranking and the engine clattering to life', 3),
  shot('ignition-bike', null, 'a motorcycle electric starter and the engine catching to a fast idle', 2),
  shot('engine-off', 'car-engine-off', 'a car engine switched off, the idle dying and a short tick of cooling', 1.5),
  shot('door-open', 'car-door-open', 'a car door handle pulled and the door opening, close', 1),
  shot('horn', 'car-horn', 'a single car horn honk, close, outdoors', 0.8),
  shot('truck-horn', 'truck-horn', 'a single air horn blast of a big truck, outdoors', 1.5),
  shot('brake-squeal', 'brake-squeal', 'a car braking hard to a stop, brakes squealing', 2),
  shot('gear-shift', 'gear-shift', 'a manual car gear lever shifted into the next gear, a mechanical clunk, close', 0.6),
  shot('backfire', 'backfire', 'a single loud car exhaust backfire pop, outdoors', 0.6),
  shot('rev-blip', 'motor-rev', 'a car engine revved once hard and falling back to idle, outdoors', 1.5),
];
