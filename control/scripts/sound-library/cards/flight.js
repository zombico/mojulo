/**
 * The flight games' sounds (sfx-shelf/flight-sounds.js: a flown level's kit by its pilot's rule), each card's `shelf` the
 * row it voices. Three registers, one per kind of flying:
 *
 *   the trainer    a light propeller plane on the `fly` rule (Pilot School's): the air over its canopy and its wheels on
 *                  the runway held by its speed, the stall warning, a touchdown soft and hard, a crash, a ring flown
 *                  through. Its engine is the shelf's prop loops (cards/registry.js), reused.
 *   the arcade     a space fighter on the `rail` rule (Wolf Squadron's): punchy and bright, a video game's; its engine held
 *                  at cruise and on boost, its lasers, its boost, brake and roll, a shield hit, a fighter, a gun on the
 *                  ground and a gunship boss blown apart.
 *   the cockpit    a starfighter on the `starfighter` rule (Rebel Storm's), heard from its seat: heavier, a space battle's;
 *                  its engines held at three throttles, its laser cannon, a hit on its shields and on its bare hull, the
 *                  targeting computer seeking and locking, a torpedo away, an incoming warning, flares, a fighter roaring
 *                  past, a starfighter and a warship blown apart, a scrape along a hull.
 *
 * An engine is recorded at steady settings (`engine`, `rpm`: the shelf crossfades them by the throttle, as it does a car's,
 * sfx-shelf/recorded-held.js); the rest are one-shots, three or four takes, a game playing them in turn. Generic words
 * only: a register, never a film's or a game's craft.
 */

const rev = (engine, rpm, prompt, seconds = 6) => ({ id: `${engine}-${rpm}`, engine, rpm, role: 'loop', prompt, seconds, influence: 0.7, loop: true, takes: 2, tags: ['flight', engine] });
const loopFx = (id, shelf, prompt, seconds = 6) => ({ id, shelf, role: 'loop', prompt, seconds, influence: 0.55, loop: true, takes: 2, tags: ['flight'] });
const shot = (id, shelf, prompt, seconds = 1, takes = 3) => ({ id, shelf, role: 'one-shot', prompt, seconds, influence: 0.55, loop: false, takes, tags: ['flight'] });
const ARCADE = 'an arcade video game sound effect, clean and punchy, no music, no voice';
const SPACE = 'a sci-fi space combat sound effect, no music, no voice';

export const CARDS = [
  // ── the trainer: a light propeller plane ──
  loopFx('airflow-loop', 'airflow', 'wind rushing steadily over a small airplane\'s canopy in flight, a smooth constant airflow hiss and buffet, no engine, no other sounds'),
  loopFx('runway-roll-loop', 'runway-roll', 'a small airplane\'s wheels rolling fast along a paved runway, a steady tyre rumble and patter over the seams, no engine, no other sounds'),
  shot('stall-horn', 'stall-warning', 'a light airplane\'s stall warning horn sounding: a steady reedy electronic whistle tone, no other sounds', 1.2),
  shot('tyre-chirp', 'touchdown', 'a small airplane\'s tyres touching down on a runway: a short rubber chirp and a light thump, no engine', 1),
  shot('hard-landing', 'hard-landing', 'a small airplane landing hard on a runway: a heavy jolt, a metal thump and the landing gear rattling, no engine', 1.5),
  shot('plane-crash', 'plane-crash', 'a small airplane crashing into the ground: a violent metal crunch, tearing aluminium and debris tumbling to a stop', 3),
  shot('ring-chime', 'ring-pass', 'flying through a target ring in a flight game: a clean bright rising chime with a soft whoosh, a game sound effect, no music, no voice', 1),
  // ── the arcade: a space fighter down a rail ──
  rev('arcade-fighter', 50, `an arcade space fighter's engine cruising, a smooth bright sci-fi jet hum, constant and steady, ${ARCADE}`),
  rev('arcade-fighter', 100, `an arcade space fighter's engine on full boost, a roaring bright sci-fi jet thrust, constant and steady, ${ARCADE}`),
  shot('arcade-laser', 'arcade-laser', `a space fighter's twin laser cannons firing one shot, a bright punchy sci-fi zap, ${ARCADE}`, 0.6, 4),
  shot('arcade-foe-laser', 'arcade-foe-laser', `an enemy fighter's laser shot from a distance, a thinner harsher sci-fi zap, ${ARCADE}`, 0.6),
  shot('arcade-boost', 'arcade-boost', `a space fighter kicking in its boost: a rushing whoosh and a rising jet roar, ${ARCADE}`, 1.2),
  shot('arcade-brake', 'arcade-brake', `a space fighter braking hard: a falling engine whine and a puff of retro thrusters, ${ARCADE}`, 1),
  shot('barrel-roll', 'barrel-roll', `a space fighter doing a fast barrel roll: a spinning whoosh of air around it, ${ARCADE}`, 0.8),
  shot('arcade-shield-hit', 'arcade-shield-hit', `a space fighter's energy shield taking a hit: a crackling electric zap and a hollow metallic thud, ${ARCADE}`, 0.7),
  shot('arcade-explode', 'arcade-explode', `an enemy fighter blowing apart: a punchy bright explosion with crackling debris, ${ARCADE}`, 1.5),
  shot('arcade-ground-explode', 'arcade-ground-explode', `a gun turret on the ground destroyed: a heavy deep explosion with metal debris, ${ARCADE}`, 2),
  shot('arcade-boss-explode', 'arcade-boss-explode', `a huge armored gunship blowing apart: a chain of explosions building into one massive blast, ${ARCADE}`, 4),
  // ── the cockpit: a starfighter, heard from its seat ──
  rev('starfighter', 20, `a starfighter's engines heard from inside its cockpit, throttled back, a deep smooth rumbling hum, constant and steady, ${SPACE}`),
  rev('starfighter', 60, `a starfighter's engines heard from inside its cockpit at cruising speed, a steady powerful rumbling roar, constant, ${SPACE}`),
  rev('starfighter', 100, `a starfighter's engines heard from inside its cockpit at full throttle, a loud deep roaring thrust with a high whine, constant, ${SPACE}`),
  shot('sf-laser', 'laser-cannon', `a starfighter's laser cannon firing one bolt: a sharp heavy laser blast with a ringing metallic tail, ${SPACE}`, 0.8, 4),
  shot('sf-foe-laser', 'foe-laser-cannon', `an enemy starfighter's laser cannon firing one bolt from a distance: a harsher higher laser blast, ${SPACE}`, 0.8),
  shot('sf-shield-hit', 'deflector-hit', `a laser bolt striking a starfighter's deflector shield: a deep electric crackle and a resonant energy thump, ${SPACE}`, 0.8),
  shot('sf-hull-hit', 'hull-hit', `a laser bolt striking a starfighter's bare hull: a metal clang, a burst of sparks and an electric fizz, ${SPACE}`, 0.8),
  shot('sf-explode', 'starfighter-explode', `a starfighter exploding: a sharp bright blast with metal debris scattering, ${SPACE}`, 2),
  shot('sf-capital-explode', 'capital-explode', `a large warship exploding: a deep rumbling chain of blasts building into a massive explosion with a long rolling tail, ${SPACE}`, 5),
  shot('sf-lock-seek', 'lock-seek', `a targeting computer seeking a lock: two short rising electronic beeps, a cockpit ${SPACE}`, 0.5),
  shot('sf-lock-on', 'locked-tone', `a targeting computer locked on: a steady high electronic tone held for a second, a cockpit ${SPACE}`, 1),
  shot('sf-torpedo', 'torpedo-launch', `a starfighter launching a torpedo: a heavy thump and a rushing hiss streaking away, ${SPACE}`, 1.5),
  shot('sf-missile-warning', 'missile-warning', `a cockpit warning: a fast urgent electronic beeping, an incoming missile alarm, ${SPACE}`, 1),
  shot('sf-flares', 'flares', `countermeasure flares dispensed: a rapid string of popping thumps and hisses, ${SPACE}`, 1.2),
  shot('sf-flyby', 'fighter-flyby', `a starfighter roaring past very close: a fast whooshing engine howl rising and falling away, ${SPACE}`, 2),
  shot('sf-scrape', 'hull-scrape', `a starfighter scraping along a warship's armored hull: a screeching metal grind and sparks, ${SPACE}`, 1.5),
];
