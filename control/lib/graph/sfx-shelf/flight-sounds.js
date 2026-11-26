/**
 * sfx-shelf/flight-sounds — a flown level's sounds as a KIT, chosen by how it is flown (its pilot's rule), so every flight
 * game hears its craft without writing a sound: a light plane on the `fly` rule is the TRAINER (its engine, the air over
 * it, its wheels, the stall warning, a touchdown, a crash, a ring flown through: Pilot School's), a fighter on the `rail`
 * rule the ARCADE fighter (its engine by its boost, its lasers, boost, brake and roll, a shield hit, what it blows apart:
 * Wolf Squadron's), and a starfighter on the `starfighter` rule the COCKPIT (its engines by the throttle, its cannon, a hit
 * on its shields and on its hull, the targeting computer, a torpedo, the incoming warning, flares, a fighter roaring past,
 * a fighter and a warship blown apart: Rebel Storm's). Each answer is a shelf word (roster.js); the new ones are `recorded`
 * rows (FLIGHT_ROWS) heard as their `standIn` until the sound library records them (one with none is silent until then).
 *
 *   FLIGHT_ROWS            the rows the kits name that the shelf had not, spread into roster.js
 *   FLIGHT_EVENTS          the events a flown level sounds (scene/channels/flight-audio.js plays them); FLIGHT_HELD the
 *                          ones held by a control (the engine by its throttle, the air by the speed, the wheels rolling)
 *   FLIGHT_KITS            kit → { why, words: { <event>: <shelf word> } }; a new kind of flying is a row
 *   flightKitOf(rule)      'trainer' | 'arcade' | 'cockpit' | null, by the rule's type
 *   flightSounds(kit, own?) → { kit, words, why }: the kit's words, a game's own (`own`: { <event>: <word> | false }) over them
 *
 * Pure data and pure functions; timeless.
 */

const row = (id, category, family, slot, label, aliases, matter, standIn) => Object.freeze({ id, category, family, slot, label, aliases, matter, ...(standIn ? { standIn } : {}) });

export const FLIGHT_ROWS = Object.freeze([
  // the trainer: a light propeller plane
  row('airflow', 'machinery', null, 'hold', 'the air rushing over a small plane in flight, by its speed', ['airflow', 'canopy wind', 'wind noise'], ['air']),
  row('runway-roll', 'machinery', null, 'hold', 'a small plane\'s wheels rolling along a runway, by its speed', ['runway roll', 'takeoff roll', 'wheels on runway'], ['stone', 'machine'], 'road-roar'),
  row('stall-warning', 'machinery', 'alarm', 'on', 'a light plane\'s stall warning horn', ['stall warning', 'stall horn'], ['electric'], 'alarm'),
  row('touchdown', 'machinery', 'land', 'on', 'a small plane\'s tyres touching down: a chirp and a light thump', ['tyre chirp', 'tire chirp', 'wheels touch down'], ['stone'], 'land'),
  row('hard-landing', 'machinery', 'thud', 'on', 'a small plane landing hard: a jolt and the gear rattling', ['hard landing', 'heavy landing'], ['metal', 'stone'], 'thud'),
  row('plane-crash', 'machinery', 'death', 'on', 'a small plane crashing into the ground: crunching, tearing metal', ['plane crash', 'air crash'], ['metal'], 'big-explosion'),
  row('ring-pass', 'play', 'checkpoint', 'on', 'a ring flown through: a bright rising chime and a whoosh', ['ring pass', 'through the ring', 'flight ring'], ['energy', 'air'], 'checkpoint'),
  // the arcade fighter, down a rail
  row('arcade-fighter-engine', 'machinery', null, 'hold', 'an arcade space fighter\'s engine by its boost: a bright sci-fi jet hum', ['arcade fighter engine', 'space fighter hum'], ['air', 'machine'], 'jet-engine'),
  row('arcade-laser', 'weapon', 'shoot', 'weapon.shot', 'an arcade space fighter\'s twin lasers: a bright punchy zap', ['arcade laser', 'twin lasers', 'space fighter laser'], ['energy'], 'buster-shot'),
  row('arcade-foe-laser', 'weapon', 'shoot', 'weapon.shot', 'an enemy fighter\'s laser shot: a thinner, harsher zap', ['foe laser', 'enemy laser'], ['energy'], 'buster-shot'),
  row('arcade-boost', 'machinery', null, 'on', 'a space fighter\'s boost kicking in: a rushing whoosh and a rising roar', ['arcade boost', 'fighter boost'], ['air', 'machine'], 'afterburner'),
  row('arcade-brake', 'machinery', null, 'on', 'a space fighter braking: a falling whine and a puff of retro thrust', ['arcade brake', 'retro brake'], ['air', 'machine'], 'dodge'),
  row('barrel-roll', 'movement', null, 'on', 'a fighter\'s barrel roll: a spinning whoosh', ['barrel roll', 'do a barrel roll'], ['air'], 'dodge'),
  row('arcade-shield-hit', 'body', 'hit', 'on', 'an arcade fighter\'s shield taking a hit: a crackling zap and a hollow thud', ['arcade shield hit', 'fighter shield hit'], ['energy', 'metal'], 'shield-hit'),
  row('arcade-explode', 'explosion', 'down', 'on', 'an enemy fighter blowing apart: punchy, bright, crackling', ['arcade explosion', 'fighter down'], ['fire', 'metal'], 'explosion'),
  row('arcade-ground-explode', 'explosion', 'down', 'on', 'a gun on the ground destroyed: heavy and deep, metal flying', ['turret destroyed', 'ground target down'], ['fire', 'metal'], 'big-explosion'),
  row('arcade-boss-explode', 'explosion', 'death', 'on', 'a gunship boss blowing apart: a chain building into one massive boom', ['boss explosion', 'gunship down'], ['fire', 'metal'], 'huge-explosion'),
  // the cockpit: a starfighter, heard from its seat
  row('starfighter-engine', 'machinery', null, 'hold', 'a starfighter\'s engines from its cockpit, by its throttle: a deep rumbling roar', ['starfighter engine', 'cockpit engine'], ['machine', 'energy'], 'ion-drive'),
  row('laser-cannon', 'weapon', 'shoot', 'weapon.shot', 'a starfighter\'s laser cannon: a sharp heavy bolt with a ringing tail', ['laser cannon', 'starfighter laser', 'laser bolt'], ['energy', 'metal'], 'buster-shot'),
  row('foe-laser-cannon', 'weapon', 'shoot', 'weapon.shot', 'an enemy starfighter\'s laser cannon: a harsher, higher bolt', ['enemy laser cannon', 'foe laser bolt'], ['energy'], 'buster-shot'),
  row('deflector-hit', 'body', 'hit', 'on', 'a bolt on a starfighter\'s deflector shield: a deep crackle and an energy thump', ['deflector impact', 'starfighter shield hit'], ['energy'], 'shield-hit'),
  row('hull-hit', 'body', 'hit', 'on', 'a bolt on a starfighter\'s bare hull: a clang, sparks and a fizz', ['hull hit', 'hull damage'], ['metal', 'electric'], 'hit'),
  row('starfighter-explode', 'explosion', 'down', 'on', 'a starfighter exploding: sharp, bright, its pieces scattering', ['starfighter explosion', 'fighter explodes'], ['fire', 'metal'], 'big-explosion'),
  row('capital-explode', 'explosion', 'death', 'on', 'a warship exploding: a rumbling chain and a long rolling tail', ['capital ship explosion', 'warship explodes', 'cruiser destroyed'], ['fire', 'metal'], 'huge-explosion'),
  row('lock-seek', 'machinery', null, 'on', 'a targeting computer seeking a lock: two short rising beeps', ['lock seek', 'seeking lock', 'lock tone'], ['electric']),
  row('locked-tone', 'machinery', null, 'on', 'a targeting computer locked on: a steady high tone', ['lock solid', 'torpedo lock', 'locked beep'], ['electric'], 'lock-on'),
  row('torpedo-launch', 'weapon', 'shoot', 'weapon.shot', 'a torpedo launched: a heavy thump and a hiss streaking away', ['torpedo', 'torpedo away', 'proton torpedo'], ['fire', 'machine'], 'missile-launch'),
  row('missile-warning', 'machinery', 'alarm', 'on', 'a cockpit\'s incoming missile warning: fast urgent beeping', ['missile warning', 'incoming missile', 'missile alarm'], ['electric'], 'alarm'),
  row('fighter-flyby', 'machinery', null, 'on', 'a starfighter roaring past close: an engine howl rising and falling away', ['fighter flyby', 'starfighter pass', 'fly by close'], ['air', 'machine'], 'jet-flyby'),
  row('hull-scrape', 'impact', 'thud', 'on', 'a starfighter scraping along a warship\'s hull: a screeching grind and sparks', ['hull scrape', 'scrape the hull'], ['metal'], 'thud'),
]);

export const FLIGHT_EVENTS = Object.freeze(['engine', 'air', 'wheels', 'shot', 'foeShot', 'hit', 'hull', 'down', 'bigDown', 'groundDown', 'bossDown', 'boost', 'brake', 'roll',
  'stall', 'touchdown', 'hardLanding', 'crash', 'gate', 'lockSeek', 'locked', 'missile', 'incoming', 'flare', 'flyby', 'scrape']);
export const FLIGHT_HELD = Object.freeze(['engine', 'air', 'wheels']);

const kit = (why, words) => Object.freeze({ why, words: Object.freeze(words) });
export const FLIGHT_KITS = Object.freeze({
  trainer: kit('a light propeller plane (the fly rule): its engine by the throttle, the air by its speed, its wheels on the runway, the stall warning, a touchdown, a crash, a ring flown through', {
    engine: 'prop-engine', air: 'airflow', wheels: 'runway-roll', stall: 'stall-warning', touchdown: 'touchdown', hardLanding: 'hard-landing', crash: 'plane-crash', gate: 'ring-pass',
    roll: 'barrel-roll', shot: 'machine-gun-shot', missile: 'missile-launch', locked: 'lock-on', flare: 'flares', down: 'explosion',
  }),
  arcade: kit('an arcade space fighter down a rail (the rail rule): punchy and bright, its engine by its boost, its lasers, its boost, brake and roll, a shield hit, what it blows apart', {
    engine: 'arcade-fighter-engine', shot: 'arcade-laser', foeShot: 'arcade-foe-laser', hit: 'arcade-shield-hit', down: 'arcade-explode', bigDown: 'arcade-boss-explode',
    groundDown: 'arcade-ground-explode', bossDown: 'arcade-boss-explode', boost: 'arcade-boost', brake: 'arcade-brake', roll: 'barrel-roll', missile: 'missile-launch', locked: 'lock-on', gate: 'ring-pass',
  }),
  cockpit: kit('a starfighter heard from its seat (the starfighter rule): its engines by the throttle, its cannon, its shields and its hull hit, the targeting computer, a torpedo, the incoming warning, flares, a fighter past, a fighter and a warship blown apart', {
    engine: 'starfighter-engine', shot: 'laser-cannon', foeShot: 'foe-laser-cannon', hit: 'deflector-hit', hull: 'hull-hit', down: 'starfighter-explode', bigDown: 'capital-explode',
    lockSeek: 'lock-seek', locked: 'locked-tone', missile: 'torpedo-launch', incoming: 'missile-warning', flare: 'flares', flyby: 'fighter-flyby', scrape: 'hull-scrape',
  }),
});
export const FLIGHT_KIT_IDS = Object.freeze(Object.keys(FLIGHT_KITS));

const RULE_KIT = Object.freeze({ fly: 'trainer', rail: 'arcade', starfighter: 'cockpit' });
/** The kit a pilot's rule is flown with, or null (a rule that does not fly). */
export function flightKitOf(rule) {
  const t = rule && typeof rule === 'object' ? rule.type : rule;
  return RULE_KIT[t] ?? null;
}

/** A kit's words, a game's own over them (`own`: { <event>: <shelf word> | false }, false silencing one). */
export function flightSounds(kitId, own = null) {
  const K = FLIGHT_KITS[kitId];
  if (!K) throw new Error(`flight kit '${kitId}': one of ${FLIGHT_KIT_IDS.join(', ')}`);
  const words = { ...K.words };
  if (own !== null && own !== undefined) {
    if (typeof own !== 'object' || Array.isArray(own)) throw new Error('a flight\'s own sounds are { <event>: <shelf word> | false }');
    for (const [ev, w] of Object.entries(own)) {
      if (!FLIGHT_EVENTS.includes(ev)) throw new Error(`'${ev}' is not a flight's event (${FLIGHT_EVENTS.join(', ')})`);
      if (w === false) delete words[ev];
      else if (typeof w === 'string' && w) words[ev] = w;
      else throw new Error(`a flight's ${ev} is a shelf word or false`);
    }
  }
  return { kit: kitId, words, why: K.why };
}
