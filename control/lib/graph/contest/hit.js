/**
 * THE HIT — the join of the swing and the ball. The swing system (polygonizer/hero-swing.js) puts a swing's STRIKE in one
 * segment of its clip and names the contact WINDOW round it (the cock to the end of the follow-through); a game type
 * re-times both (swingTiming). The hit is live through that window and lands on the strike frame: a ball inside the hit
 * volume then takes a velocity whose direction is the stick and the verb's arc, whose speed is the register's power over
 * the body's real tip speed (the weapon spike's law: the blow is the tip's speed), grown by the register's rally, and
 * whose spin is the verb's (a topspin forehand, a slice, a flat drive). The result is the physics property's own
 * `impulse` (a change of momentum) and a `touch` fact the contest kernel reads.
 *
 *   HIT_VERBS                   { <verb>: { arc, lift, spin, rate, power, hands, swing } }
 *                                 arc    deg: the elevation the ball leaves at with the stick at rest (+ up)
 *                                 lift   deg: how far the stick's forward and back tilt it (± at full deflection)
 *                                 spin   'top' | 'back' | 'side' | 'none': the verb's spin, about the axis each means
 *                                 rate   rev/s at the realistic register (the registers scale it)
 *                                 power  a share of the register's power
 *                                 swing  the swing-system verb that plays it (its strike frame and window), or null
 *                                        for a verb no swing clip plays yet (the hit law still holds; the clip is said)
 *   HIT_REGISTERS               { <register>: { base, gain, spread, spin } }: speed = base + gain × tipSpeed (m/s), the
 *                                 stick's sideways aim ± spread deg, the spin rates × spin
 *   hitWindow(verb, cls, register)   → { strike, window, swing } the phase the hit lands and the span it is live, on the
 *                                 game's timeline (realistic: the swing's own)
 *   hitLive(u, verb, cls, register)  → whether the swing's phase u is inside the window
 *   hitVelocity({ verb, register, facing, stick, tipSpeed, hits })  → { velocity, angularVelocity, speed, azimuth,
 *                                 elevation, spin: { kind, rate } }   facing: the heading the body faces (rad, x toward
 *                                 +x); stick: [x, y] in -1 … 1 (x right, y forward); tipSpeed m/s; hits: clean hits so
 *                                 far in the rally (the arcade grows it)
 *   hitBall({ ball, who, verb, register, facing, stick, tipSpeed, hits, at })  → { impulse, angularVelocity, velocity,
 *                                 fact }   ball: the sim body ({ mass, velocity }); impulse = m × (v' − v); fact the
 *                                 contest kernel's { kind: 'touch', who, at: [x, y] }
 *
 * Frame: the court's (contest-kernel.js), z up, metres and seconds. Pure: no dice, no clock.
 */
import { swingKeys, swingTiming, SWING_WORDS } from '../polygonizer/hero-swing.js';
import { BALL_REGISTERS, rallySpeed } from './ball-card.js';

export const HIT_VERBS = Object.freeze({
  forehand: Object.freeze({ arc: 8, lift: 12, spin: 'top', rate: 25, power: 1, hands: 1, swing: 'forehand' }),
  backhand: Object.freeze({ arc: 8, lift: 12, spin: 'back', rate: 15, power: 0.9, hands: 1, swing: 'backhand' }),
  // the overhead verbs lift the elbow over the head, which the swing system's law forbids (hero-swing.js): no clip yet
  // (a serve struck from 2.8 m at the realistic power, about 29 m/s, clears the cord and lands in the box at −4°: the
  // stick down is the net, the stick up is long; the arcade registers aim it)
  serve: Object.freeze({ arc: -4, lift: 4, spin: 'none', rate: 0, power: 1, hands: 1, swing: null }),
  spike: Object.freeze({ arc: -15, lift: 8, spin: 'top', rate: 10, power: 1.3, hands: 1, swing: null }),
  // the volleyball's bare-handed touches (no gear in the hand: the swing door needs an item) and the leg: no clip yet
  bump: Object.freeze({ arc: 60, lift: 10, spin: 'none', rate: 0, power: 0.5, hands: 2, swing: null }),
  set: Object.freeze({ arc: 70, lift: 10, spin: 'none', rate: 0, power: 0.35, hands: 2, swing: null }),
  kick: Object.freeze({ arc: 15, lift: 20, spin: 'side', rate: 2, power: 1.2, hands: 0, swing: null }),   // a touch of curl: a side-footed ball bends a little, never a banana
  throw: Object.freeze({ arc: 30, lift: 20, spin: 'back', rate: 5, power: 0.6, hands: 1, swing: null }),
  bat: Object.freeze({ arc: 25, lift: 15, spin: 'back', rate: 30, power: 1.5, hands: 2, swing: 'bat' }),
  putt: Object.freeze({ arc: 0, lift: 0, spin: 'top', rate: 2, power: 0.1, hands: 2, swing: null }),
  // the underarm serve (pickleball's, badminton's low serve) and badminton's clear,
  // the overhead that lifts the shuttle to the back: no clip yet
  underhand: Object.freeze({ arc: 8, lift: 14, spin: 'back', rate: 6, power: 0.8, hands: 1, swing: null }),
  clear: Object.freeze({ arc: 28, lift: 22, spin: 'none', rate: 0, power: 1, hands: 1, swing: null }),
  // table tennis's short serve, struck down onto the server's own half off the open hand
  drop: Object.freeze({ arc: -16, lift: 12, spin: 'none', rate: 0, power: 0.6, hands: 1, swing: null }),
  // the turn sports' (turn-sim.js): the club's launch is the verb's arc and backspin, the charge the tip's share; the
  // bowling roll leaves the hand flat with its hook as the stick's spin
  drive: Object.freeze({ arc: 11, lift: 5, spin: 'back', rate: 45, power: 1, hands: 2, swing: null }),
  iron: Object.freeze({ arc: 20, lift: 8, spin: 'back', rate: 70, power: 0.7, hands: 2, swing: null }),
  roll: Object.freeze({ arc: 0, lift: 0, spin: 'none', rate: 0, power: 0.2, hands: 1, swing: null }),
});
export const HIT_VERB_IDS = Object.freeze(Object.keys(HIT_VERBS));

/** The registers' power: a ball leaves at base + gain × the tip's speed; the stick aims ± spread; spin rates × spin. */
export const HIT_REGISTERS = Object.freeze({
  realistic: Object.freeze({ base: 0, gain: 1.6, spread: 25, spin: 1 }),
  action: Object.freeze({ base: 12, gain: 1.2, spread: 35, spin: 0.4 }),
  platformer: Object.freeze({ base: 10, gain: 0.5, spread: 40, spin: 0.2 }),
  pinball: Object.freeze({ base: 15, gain: 1.5, spread: 30, spin: 0.1 }),
});

const hitFail = (m) => { throw new Error(`hit: ${m}`); };
const hr4 = (v) => Math.round(v * 1e4) / 1e4;
const RAD = Math.PI / 180;

function verbOf(verb) {
  const V = HIT_VERBS[verb];
  if (!V) hitFail(`verb '${verb}' is one of ${HIT_VERB_IDS.join(', ')}`);
  return V;
}
function registerOf(register) {
  const R = HIT_REGISTERS[register];
  if (!R) hitFail(`register '${register}' is one of ${Object.keys(HIT_REGISTERS).join(', ')}`);
  return R;
}

/** The hit's strike phase and live window on the game's timeline, from the swing system; a verb with no clip says so. */
export function hitWindow(verb, cls = 'normal', register = 'realistic') {
  const V = verbOf(verb);
  registerOf(register);
  if (!V.swing) return { swing: null, strike: null, window: null, says: `no swing clip plays '${verb}' yet: the hit law holds, the clip is the body's own` };
  if (!SWING_WORDS.includes(V.swing)) hitFail(`'${verb}' names a swing '${V.swing}' the swing system does not have`);
  const T = swingTiming(cls, register);
  if (T) return { swing: V.swing, cls, strike: T.strike, window: T.window.slice(), flavor: register };
  const K = swingKeys(V.swing, cls);
  return { swing: V.swing, cls, strike: K.strike, window: K.window.slice(), flavor: null };
}

/** Whether a swing at phase u (0 … 1 of its clip) is live for the hit. */
export function hitLive(u, verb, cls = 'normal', register = 'realistic') {
  const W = hitWindow(verb, cls, register);
  return !!W.window && u >= W.window[0] && u <= W.window[1];
}

/** The verb's spin as an angular velocity about its axis, for a ball leaving along the unit heading `d` (z up). */
function spinVector(kind, rate, d) {
  const w = rate * 2 * Math.PI;
  if (kind === 'none' || !(w > 0)) return [0, 0, 0];
  // topspin: the top of the ball turns forward, the axis up × d (a ball along +x spins about +y); backspin the other way
  const top = [-d[1], d[0], 0];
  if (kind === 'top') return top.map((v) => hr4(v * w));
  if (kind === 'back') return top.map((v) => hr4(-v * w));
  return [0, 0, hr4(w)];   // side: about the vertical, curling left of the aim (flight.js's curl +)
}

/**
 * The ball's velocity off the hit, by the verb, the register, the stick and the tip's speed, grown by the rally.
 * `elevationDeg` and `speedCap`: the arcade's AIMED shot (the cartoon tennis lands where it aims): the sim hands the
 * elevation that lands the ball at its chosen depth, in place of the verb's arc and the stick's lift, and the speed it
 * gives up for it; the realistic register never does (its arc is the verb's and the stick's, and the court is the
 * player's to find).
 */
export function hitVelocity({ verb, register = 'realistic', facing = 0, stick = [0, 0], tipSpeed = 0, hits = 0, elevationDeg, speedCap } = {}) {
  const V = verbOf(verb), R = registerOf(register);
  if (!Array.isArray(stick) || stick.length !== 2 || !stick.every((s) => Number.isFinite(s) && s >= -1 && s <= 1)) hitFail('stick is [x, y], each -1 to 1');
  if (!(Number.isFinite(tipSpeed) && tipSpeed >= 0)) hitFail('tipSpeed is the swing\'s tip speed at the strike, m/s');
  if (!(Number.isInteger(hits) && hits >= 0)) hitFail('hits is the rally\'s clean hits so far');
  if (!BALL_REGISTERS.includes(register)) hitFail(`register '${register}' is one of ${BALL_REGISTERS.join(', ')}`);
  if (elevationDeg !== undefined) {
    if (register === 'realistic') hitFail('the realistic register takes no aimed elevation: its arc is the verb\'s and the stick\'s');
    if (!(Number.isFinite(elevationDeg) && elevationDeg > -89 && elevationDeg < 89)) hitFail('elevationDeg is degrees above the court, -89 to 89');
  }
  const azimuth = facing - stick[0] * R.spread * RAD;   // the stick right turns the aim right of the facing (clockwise)
  const elevation = (elevationDeg !== undefined ? elevationDeg : V.arc + stick[1] * V.lift) * RAD;
  const base = (R.base + R.gain * tipSpeed) * V.power;
  // the arcade's rally grows the ball by its card; an aimed shot may give speed up for its depth (speedCap)
  let speed = rallySpeed(register, hits, base);
  if (speedCap !== undefined) { if (register === 'realistic') hitFail('the realistic register takes no speed cap: the ball leaves at the tip\'s speed'); if (!(Number.isFinite(speedCap) && speedCap >= 0)) hitFail('speedCap is m/s'); speed = hr4(Math.min(speed, speedCap)); }

  const d = [Math.cos(azimuth), Math.sin(azimuth), 0];
  const velocity = [hr4(speed * Math.cos(elevation) * d[0]), hr4(speed * Math.cos(elevation) * d[1]), hr4(speed * Math.sin(elevation))];
  const rate = hr4(V.rate * R.spin);
  return { velocity, angularVelocity: spinVector(V.spin, rate, d), speed, azimuth: hr4(azimuth), elevation: hr4(elevation / RAD), spin: { kind: V.spin, rate } };
}

/**
 * THE AIMED ELEVATION — the arc that lands a shot of speed v from height h at range D on gravity g, in degrees: the low
 * arc, lifted until it clears the cord by a hand when it would not (`net`: { at, height }, the cord so far along the
 * path and so high, cleared by `margin`, a hand (0.2 m) unless said; the shot then lands longer for it), or 45 when
 * nothing reaches. A mind reads its stick from it; the
 * realistic register's player must find it. `drag` (per metre, ball-card.js airDrag): the shot flown through its own
 * air, a shuttle's, in place of the vacuum's closed form.
 */
export function aimedElevation(v, h, D, g, net = null, drag = 0) {
  const F = drag > 0 ? dragFlights(v, h, g, drag) : null;
  const range = F ? (th) => F(th).range : (th) => { const s = Math.sin(th), co = Math.cos(th); const vz = v * s, disc = vz * vz + 2 * g * h; return disc < 0 ? 0 : (v * co * (vz + Math.sqrt(disc))) / g; };
  const zAt = F ? (th, d) => F(th).zAt(d) : (th, d) => { const co = Math.cos(th); return h + d * Math.tan(th) - (g * d * d) / (2 * v * v * co * co); };
  const clears = (th) => !net || !(net.at > 0) || net.at >= range(th) || zAt(th, net.at) >= net.height + (net.margin ?? 0.2);   // a cord past the landing is no cord
  const Q = Math.PI / 4;
  if (range(Q) < D) return 45;
  let lo = -0.3, hi = Q;
  if (range(lo) >= D) hi = lo; else for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (range(mid) >= D) hi = mid; else lo = mid; }
  if (clears(hi)) return hr4((hi * 180) / Math.PI);
  let a = hi, b = Math.PI / 3;
  if (!clears(b)) return hr4((b * 180) / Math.PI);
  for (let i = 0; i < 40; i++) { const mid = (a + b) / 2; if (clears(mid)) b = mid; else a = mid; }
  return hr4((b * 180) / Math.PI);
}

/**
 * THE AIMED SHOT — the arcade's (the cartoon tennis lands where it aims): the fastest speed up to `v` whose arc clears
 * the cord and still lands at D, and that arc. A shot too fast to land in gives up speed for its depth; nothing is ever
 * aimed into the net or past the line on purpose. `slack`: how far past D a landing still fits (half a metre; a
 * table's game less).  → { speed, elevationDeg }
 */
export function aimedShot(v, h, D, g, net = null, drag = 0, slack = 0.5) {
  const landsAt = drag > 0 ? (u) => dragFlights(u, h, g, drag)((aimedElevation(u, h, D, g, net, drag) * Math.PI) / 180).range
    : (u) => { const th = (aimedElevation(u, h, D, g, net) * Math.PI) / 180, s = Math.sin(th), co = Math.cos(th); const vz = u * s, disc = vz * vz + 2 * g * h; return disc < 0 ? 0 : (u * co * (vz + Math.sqrt(disc))) / g; };
  const fits = (u) => landsAt(u) <= D + slack;
  if (fits(v)) return { speed: hr4(v), elevationDeg: aimedElevation(v, h, D, g, net, drag) };
  let lo = 4, hi = v;
  if (!fits(lo)) return { speed: hr4(lo), elevationDeg: aimedElevation(lo, h, D, g, net, drag) };
  for (let i = 0; i < (drag > 0 ? 20 : 40); i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return { speed: hr4(lo), elevationDeg: aimedElevation(lo, h, D, g, net, drag) };
}

/**
 * A shot's flights through its own air (`drag`, per metre: the quadratic drag's ½ρAC_d/m, a shuttle's), flown as a point
 * at 120 Hz by the midpoint rule from height h at speed v: → th ↦ { range, zAt(d) } (memoised by the elevation). The aim through the air the
 * vacuum's closed form cannot say.
 */
function dragFlights(v, h, g, k) {
  const memo = new Map(), dt = 1 / 120;
  return (th) => {
    if (memo.has(th)) return memo.get(th);
    let x = 0, z = h, vx = v * Math.cos(th), vz = v * Math.sin(th), range = 0;
    const xs = [0], zs = [h];
    for (let i = 0; i < 1200; i++) {
      // the midpoint rule: the drag read half a step on, so the coarse step keeps the landing to a few centimetres
      const s0 = Math.hypot(vx, vz), mx = vx - k * s0 * vx * dt / 2, mz = vz - (g + k * s0 * vz) * dt / 2, sm = Math.hypot(mx, mz);
      const px = x, pz = z;
      x += mx * dt; z += mz * dt; vx -= k * sm * mx * dt; vz -= (g + k * sm * mz) * dt;
      xs.push(x); zs.push(z);
      if (z <= 0) { range = px + (x - px) * (pz / (pz - z)); break; }
      range = x;
    }
    const zAt = (d) => { for (let i = 1; i < xs.length; i++) if (xs[i] >= d) { const f = (d - xs[i - 1]) / Math.max(1e-9, xs[i] - xs[i - 1]); return zs[i - 1] + (zs[i] - zs[i - 1]) * f; } return -Infinity; };
    const out = { range, zAt };
    memo.set(th, out);
    return out;
  };
}

/** The hit on a sim body: the impulse that takes it from its velocity to the hit's, its new spin, and the kernel's fact. */
export function hitBall({ ball, who, at, ...rest }) {
  if (!ball || !(ball.mass > 0) || !Array.isArray(ball.velocity)) hitFail('ball is the sim body: { mass, velocity }');
  if (typeof who !== 'string' || !who) hitFail('who is the player that hit it (a1, b2 …)');
  if (!Array.isArray(at) || at.length < 2) hitFail('at is where the ball was hit, [x, y] in the court frame');
  const H = hitVelocity(rest);
  const impulse = H.velocity.map((v, i) => hr4(ball.mass * (v - (ball.velocity[i] || 0))));
  return { impulse, velocity: H.velocity, angularVelocity: H.angularVelocity, speed: H.speed, spin: H.spin, fact: { kind: 'touch', who, at: [at[0], at[1]] } };
}
