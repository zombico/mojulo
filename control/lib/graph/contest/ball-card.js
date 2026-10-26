/**
 * THE BALL CARD — the ball of a contest as the physics property's sphere (worlds/physics-sim.js: mass, radius,
 * restitution, friction, spin, its contacts emitted as facts), dressed by a REGISTER the way the feel cards dress the
 * body (gameworld/feel: realistic, action, platformer, pinball). The register ladder on the ball: at the simulation end
 * the ball is the sport's own and flies in real air (physics/flight.js's drag crisis and Magnus lift, as the sim's
 * `aero` force rule); toward the arcade the air goes, the rally grows hit by hit (the cartoon tennis), and pinball's
 * ball never stops gaining.
 *
 *   BALLS                       the sports' balls: mass (kg), radius (m), restitution (e = √(rebound height ÷ drop
 *                               height), from each sport's rebound rule), friction, and the aero constants cited for it
 *                               (soccer's are the literature's; a ball with none cited flies on soccer's curves and the
 *                               card says so)
 *   BALL_CARDS                  the registers: air (real air on), grow (the speed a clean hit adds, a share), cap (the
 *                               most a rally may grow to, a factor of the base; null: no cap), bounce (× the ball's own
 *                               restitution, clamped by the sim to 1), gravity (× g), restitutionFloor
 *   readBallCard(register)      the card checked; throws, teaching
 *   ballOf(sport | spec)        the ball resolved: a sport's, or { mass, radius, restitution?, friction?, aero? }
 *   ballBody(sport, register, { id?, position?, velocity? })   → a physics-sim body spec
 *   ballForces(sport, register, { id? })                        → the force rules the ball needs ([] without air)
 *   airDrag(sport)                                              → ½ρAC_d/m of a ball whose air is its own (0 else)
 *   ballGravity(register, g?)                                   → the sim's gravity vector for the card
 *   rallySpeed(register, hits, base)                            → the speed a clean hit leaves the ball at, after `hits`
 *                                                                 clean hits in the rally (the arcade's growing rally)
 *   ballReport(sport, register)                                 → what the card does and leaves out, in words
 *
 * Pure data and arithmetic: no dice, no clock. Absent (no ball on a world) nothing here is read.
 */
import { PROJECTILES, RHO_SEA_LEVEL } from '../physics/flight.js';

const SOCCER_AERO = PROJECTILES.soccer.aero;
const rebound = (rebound, drop) => Math.round(Math.sqrt(rebound / drop) * 1000) / 1000;

export const BALLS = Object.freeze({
  // FIFA size 5: 0.43 kg, 0.69 m round; the FIFA Quality rebound of 1.2 to 1.65 m from 2 m on steel reads e ≈ 0.77 to 0.91
  // (mid 0.84); its aero constants are the literature's (physics/flight.js)
  soccer: { mass: 0.43, radius: 0.1098, restitution: rebound(1.4, 2), friction: 0.3, aero: SOCCER_AERO, cited: true, words: 'a soccer ball' },
  // ITF: 56.0 to 59.4 g, 6.54 to 6.86 cm across; a rebound of 135 to 147 cm from 254 cm onto concrete reads e ≈ 0.73 to 0.76
  tennis: { mass: 0.058, radius: 0.0335, restitution: rebound(141, 254), friction: 0.5, aero: null, cited: false, words: 'a tennis ball' },
  // FIVB: 260 to 280 g, 65 to 67 cm round; no rebound rule in the laws, e ≈ 0.75 as measured on a hard floor
  volleyball: { mass: 0.27, radius: 0.105, restitution: 0.75, friction: 0.3, aero: null, cited: false, words: 'a volleyball' },
  // FIBA size 7: 567 to 650 g, 74.9 to 78 cm round; a rebound of 1.2 to 1.4 m from 1.8 m reads e ≈ 0.82 to 0.88
  basketball: { mass: 0.62, radius: 0.12, restitution: rebound(1.3, 1.8), friction: 0.5, aero: null, cited: false, words: 'a basketball' },
  // R&A and USGA: at most 45.93 g, at least 42.67 mm across; e ≈ 0.8 against a hard face at low speed
  golf: { mass: 0.04593, radius: 0.021335, restitution: 0.8, friction: 0.4, aero: null, cited: false, words: 'a golf ball' },
  // USBC: at most 16 lb (7.26 kg), 8.5 to 8.595 in across (radius 0.108 m); a dead ball on the lane, e ≈ 0.3; the
  // lane's oil keeps the friction low until the dry back end
  bowling: { mass: 7.26, radius: 0.108, restitution: 0.3, friction: 0.12, aero: null, cited: false, words: 'a bowling ball' },
  // IIHF: 156 to 170 g, 76.2 mm across, 25.4 mm thick; a disc, not a sphere: it rides the card as a sphere of its own
  // radius and mass (a disc's air is not flight.js's, and the card says so), dead on the ice, nearly frictionless on it
  puck: { mass: 0.163, radius: 0.0381, restitution: 0.35, friction: 0.05, aero: null, cited: false, words: 'a puck (a disc on a sphere\'s card)' },
  // ITTF: 2.7 g, 40 mm; a rebound of 24 to 26 cm from 30.5 cm reads e ≈ 0.89 to 0.92
  pingpong: { mass: 0.0027, radius: 0.02, restitution: rebound(25, 30.5), friction: 0.3, aero: null, cited: false, words: 'a table-tennis ball' },
  // USA Pickleball: 22.1 to 26.5 g, 73.5 to 75.5 mm across; a rebound of 30 to 34 in from 78 in reads e ≈ 0.62 to 0.66;
  // its holes slow it, which the card leaves to the arcade's air (none) and to real air's soccer curves
  pickleball: { mass: 0.026, radius: 0.0372, restitution: rebound(32, 78), friction: 0.3, aero: null, cited: false, words: 'a pickleball' },
  // World Rugby: 410 to 460 g, 280 to 300 mm long, 580 to 620 mm round its belly; an oval, not a sphere: it rides the
  // card as a sphere of its belly's radius (its wobbling bounce and its spiral are not the card's, and the card says so)
  rugby: { mass: 0.435, radius: 0.095, restitution: 0.6, friction: 0.5, aero: null, cited: false, words: 'a rugby ball (an oval on a sphere\'s card)' },
  // NFL: 14 to 15 oz (397 to 425 g), 11 to 11.25 in long, 21 to 21.25 in round its belly; an oval, on a sphere's card
  football: { mass: 0.41, radius: 0.085, restitution: 0.55, friction: 0.5, aero: null, cited: false, words: 'an American football (an oval on a sphere\'s card)' },
  // BWF: 4.74 to 5.50 g, a skirt 58 to 68 mm across; a shuttle is no sphere and its air is its own in EVERY register
  // (`ownAir`: without its drag it is a ball): it rides the sphere's card at the skirt's radius with a flat drag
  // coefficient of about 0.6 and no lift, which gives a terminal speed near 6.3 m/s (the literature measures 6.5 to 7,
  // Cooke, Sports Engineering 1999), and almost no bounce: it lands dead
  shuttle: { mass: 0.0051, radius: 0.033, restitution: 0.1, friction: 0.8, aero: { cdSup: 0.6, cdSub: 0.6, crisis: false, spin: false }, ownAir: true, cited: true, words: 'a shuttlecock (a skirt on a sphere\'s card, its own drag)' },
});
export const BALL_IDS = Object.freeze(Object.keys(BALLS));

/**
 * The registers. `air` the real-air rule; `grow` the share of speed a clean hit adds to the rally's base (0.08: eight
 * per cent a hit), `cap` the factor it may reach (null: none); `bounce` scales the ball's restitution (the sim clamps at
 * 1: pinball's lossless bounce is the most the table gives; a bumper that gives back more is the hit's, not the
 * contact's); `gravity` scales g (the platformer's slow, floaty ball); `spinDecay` /s in flight.
 */
export const BALL_CARDS = Object.freeze({
  realistic: Object.freeze({ says: 'the sport\'s own ball in real air: drag with its crisis, Magnus lift, the rebound its rules allow; a rally neither grows nor shrinks by itself', air: true, grow: 0, cap: null, bounce: 1, gravity: 1, spinDecay: 0.04 }),
  action: Object.freeze({ says: 'the cartoon tennis: no air, a rally that grows eight per cent a clean hit to one and a half times, a lively bounce', air: false, grow: 0.08, cap: 1.5, bounce: 1.1, gravity: 1, spinDecay: 0 }),
  platformer: Object.freeze({ says: 'a slow, floaty ball: no air, light gravity, a soft bounce, no growth', air: false, grow: 0, cap: null, bounce: 0.9, gravity: 0.6, spinDecay: 0 }),
  pinball: Object.freeze({ says: 'the ball never stops gaining: no air, ten per cent a hit with no cap, a lossless bounce', air: false, grow: 0.1, cap: null, bounce: 2, gravity: 1, spinDecay: 0 }),
});
export const BALL_REGISTERS = Object.freeze(Object.keys(BALL_CARDS));

const ballFail = (m) => { throw new Error(`ball: ${m}`); };
const ballIsObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const br4 = (v) => Math.round(v * 1e4) / 1e4;

/** The register's card; throws naming the registers. */
export function readBallCard(register = 'realistic') {
  const c = BALL_CARDS[register];
  if (!c) ballFail(`register '${register}' is one of ${BALL_REGISTERS.join(', ')}`);
  return c;
}

/** A sport's ball, or a ball written out ({ mass, radius, restitution?, friction?, aero? }); throws, teaching. */
export function ballOf(spec = 'soccer') {
  if (typeof spec === 'string') {
    const b = BALLS[spec];
    if (!b) ballFail(`'${spec}' is not a ball here (${BALL_IDS.join(', ')}); or write one out: { mass, radius, restitution?, friction?, aero? }`);
    return { id: spec, ...b };
  }
  if (!ballIsObj(spec) || !(spec.mass > 0) || !(spec.radius > 0)) ballFail('a ball written out is { mass (kg), radius (m), restitution?, friction?, aero? }');
  for (const k of Object.keys(spec)) if (!['mass', 'radius', 'restitution', 'friction', 'aero', 'words'].includes(k)) ballFail(`a ball has no '${k}' (mass, radius, restitution, friction, aero, words)`);
  if (spec.restitution !== undefined && !(spec.restitution >= 0 && spec.restitution <= 1)) ballFail('restitution is 0 to 1');
  if (spec.friction !== undefined && !(spec.friction >= 0 && spec.friction <= 1)) ballFail('friction is 0 to 1');
  if (spec.aero !== undefined && spec.aero !== null && !ballIsObj(spec.aero)) ballFail('aero is the curve constants { cdSup, cdSub, vCrit, vWidth, clMax, s0 } or null');
  return { id: 'custom', mass: spec.mass, radius: spec.radius, restitution: spec.restitution ?? 0.7, friction: spec.friction ?? 0.3, aero: spec.aero ?? null, cited: !!spec.aero, words: spec.words ?? 'a ball' };
}

/** The ball as a physics-sim body: the sport's mass and size, its restitution by the card (clamped by the sim). */
export function ballBody(sport, register = 'realistic', { id = 'ball', position = [0, 0, 1], velocity = [0, 0, 0] } = {}) {
  const b = ballOf(sport), c = readBallCard(register);
  return {
    id, collider: 'sphere', mass: b.mass, radius: b.radius,
    restitution: br4(Math.min(1, b.restitution * c.bounce)), friction: b.friction,
    position: position.slice(), velocity: velocity.slice(),
  };
}

/** The force rules the ball needs: the real-air rule on it (its cited aero, or soccer's), or none; a ball whose air is
 * its own (the shuttle's) carries it in every register. */
export function ballForces(sport, register = 'realistic', { id = 'ball' } = {}) {
  const b = ballOf(sport), c = readBallCard(register);
  if (!c.air && !b.ownAir) return [];
  return [{ kind: 'aero', on: [id], rho: RHO_SEA_LEVEL, ...(b.aero ?? SOCCER_AERO), ...(c.spinDecay ? { spinDecay: c.spinDecay } : {}) }];
}

/** A ball's own air as the aim reads it: ½ρAC_d/m per metre for a ball whose air is its own (the shuttle's), else 0. */
export function airDrag(sport) {
  const b = ballOf(sport);
  if (!b.ownAir) return 0;
  return br4((0.5 * RHO_SEA_LEVEL * Math.PI * b.radius * b.radius * b.aero.cdSup) / b.mass);
}

/** The sim's gravity for the card (the platformer's ball falls slower). */
export const ballGravity = (register = 'realistic', g = 9.81) => [0, 0, -br4(g * readBallCard(register).gravity)];

/** The arcade's growing rally: the speed a clean hit leaves the ball at, after `hits` clean hits, from `base` m/s. */
export function rallySpeed(register, hits, base) {
  const c = readBallCard(register);
  if (!(Number.isInteger(hits) && hits >= 0)) ballFail('hits is a count of the rally\'s clean hits so far');
  const factor = 1 + c.grow * hits;
  return br4(base * (c.cap === null ? factor : Math.min(c.cap, factor)));
}

/** What the card does to this ball, and what it leaves out, said. */
export function ballReport(sport, register = 'realistic') {
  const b = ballOf(sport), c = readBallCard(register);
  const notes = [];
  if (c.air && !b.cited) notes.push(`${b.words} has no cited aero curve: it flies on the soccer ball's (physics/flight.js), the drag crisis and lift of a larger, heavier ball`);
  if (c.bounce > 1 && b.restitution * c.bounce > 1) notes.push('the table keeps a bounce lossless at most (restitution 1); a bounce that gives back more than it got is the hit\'s to add, not the contact\'s');
  if (!c.air && register === 'realistic') notes.push('no air');
  return { ball: b.id, words: b.words, register, says: c.says, body: ballBody(sport, register), forces: ballForces(sport, register), gravity: ballGravity(register), notes };
}
