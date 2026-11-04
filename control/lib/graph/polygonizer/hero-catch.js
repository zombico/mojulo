/**
 * hero-catch — CATCHING A BALL: the throw run the other way (hero-throw.js, whose hands' kit this shares). The ball comes
 * at the catcher along a line (`incoming`: its speed and how steeply it drops), the hands go out to meet it where the
 * technique takes it, open, palms to it; at the contact they close on it (hero-ball-grip.js: the grip round its own size)
 * already moving back along its line, and GIVE with it, the ball and the hands slowing together over the give's
 * distance until both stop; then they bring it in (secure). Right-handed; the ball comes from +y.
 *
 *   THE CATCHES (CATCHES): `high` (the hands' diamond above the chest, thumbs and index fingers together, fingers up),
 *   `low` (the basket below the waist, the little fingers together, fingers down), `chest` (the ball taken into the
 *   chest, the arms closing round it: a football's, a rugby ball's, a dodgeball's), `oneHand` (a bare hand reaching for
 *   it at the shoulder: a fielder's), `skyball` (a high ball dropping steeply, taken by the eyes, the hands cupped up).
 *   Each a ball, a grip, a stance, one or two hands, the ball's incoming speed and drop, the places (ready, contact,
 *   secure), the palms, and the give's distance.
 *   THE GIVE: the hands meet the ball moving back at SOFT of its speed (at most SOFT_MAX m/s: a hand cannot match a hard
 *   throw), the rest of its speed taken at the contact (the sting: an impulse m·Δv), then both slow evenly over the give
 *   (a deceleration v²/2d, the force m·v²/2d the hands hold against).
 *   heroCatch(name, R, { ball, incoming }) → { name, clip, seconds, contact ({ t, at, palms }), give ({ distance,
 *     seconds, handSpeed, sting (N·s), force (N) }), flight (the ball before the contact: at(t)), ball ({ id, r, mass,
 *     grip, side, centreRest }), keys, checks }
 *   catchBall(C, R, u) → the ball's centre at share u: flying in before the contact, in the hand after it.
 * Pure and deterministic.
 */
import { rigNodesAt, boneFrames, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { liteOf, wristFor, anatomicalForearm, WRIST_RANGE } from './hero-grip.js';
import { handFrame } from './hero-servo.js';
import { keyedClip } from './hero-jump.js';
import { comOf, hull, margin } from './hero-stance.js';
import { ballGrip, ballOf, openFingers } from './hero-ball-grip.js';
import { handsKit, heldBall, throwParts, WOBBLE, DRIVE_NEAR } from './hero-throw.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const r1 = (x) => Math.round(x * 10) / 10 + 0, r3 = (x) => Math.round(x * 1000) / 1000 + 0, r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const DEG = 180 / Math.PI, G_ACC = 9.81;
import { at, mix, UP, FWD, BACK, DOWN, RIGHT, LEFT } from './hero-throw-words.js';

/** the hands meet the ball moving back at this share of its speed, at most SOFT_MAX m/s */
export const SOFT = 0.35, SOFT_MAX = 4;
/** a palm at the touch within this of the technique's (degrees) */
export const PALM_OFF = 35;
/** the hands are on the ball's line this long before the contact (s) */
const EARLY = 0.04;

export const CATCHES = Object.freeze({
  high: {
    says: 'the diamond: the hands up before the chest, thumbs and index fingers together behind the ball, fingers up; it is met out front and given with, then brought in',
    ball: 'basketball', grip: 'spread', stance: 'square', hands: 2, incoming: { speed: 10, drop: 5 }, give: 0.2, faces: true,
    sports: ['basketball (a pass above the waist)', 'handball', 'American football (a ball above the chest)', 'netball'],
    keys: {
      ready: { body: { bow: 0.05, sink: 0.04 }, ball: at('chest', [0, 0.3, 0.1]), palms: mix(FWD, mul(LEFT, 0.5)) },
      contact: { body: { bow: 0.08, sink: 0.04 }, ball: at('chest', [0, 0.44, 0.16]), palms: mix(FWD, mul(LEFT, 0.5)) },
      secure: { body: { bow: 0.05, sink: 0.02 }, ball: at('chest', [0, 0.22, 0.02]), palms: mix(LEFT, mul(FWD, 0.3)), along: mix(UP, FWD) },
    },
  },
  low: {
    says: 'the basket: the hands low before the waist, the little fingers together, fingers down and forward, palms up to the ball; it is scooped and given with up to the waist',
    ball: 'basketball', grip: 'spread', stance: 'square', hands: 2, incoming: { speed: 9, drop: 15 }, give: 0.22, faces: true,
    sports: ['basketball (a bounce pass, a low pass)', 'American football (a ball below the waist)', 'cricket (a low catch)'],
    keys: {
      ready: { body: { bow: 0.25, sink: 0.1 }, ball: at('chest', [0, 0.36, -0.36]), palms: mix(UP, mul(FWD, 0.6), mul(LEFT, 0.5)), along: mix(DOWN, FWD) },
      contact: { body: { bow: 0.32, sink: 0.12 }, ball: at('chest', [0, 0.44, -0.44]), palms: mix(UP, mul(FWD, 0.8), mul(LEFT, 0.5)), along: mix(DOWN, FWD) },
      secure: { body: { bow: 0.1, sink: 0.04 }, ball: at('chest', [0, 0.24, -0.14]), palms: mix(LEFT, mul(UP, 0.3)), along: mix(FWD, UP) },
    },
  },
  chest: {
    says: 'the ball taken into the chest: the arms out low before it, the elbows in, the hands closing round it as it lands against the body, the shoulders curling over it',
    ball: 'football', grip: 'spread', stance: 'square', hands: 2, incoming: { speed: 15, drop: 3 }, give: 0.24, faces: false,
    sports: ['American football (a pass into the body)', 'rugby (a pass, a high ball into the chest)', 'dodgeball'],
    keys: {
      ready: { body: { bow: 0.1, sink: 0.06 }, ball: at('chest', [0, 0.38, -0.08]), palms: mix(LEFT, mul(FWD, 0.5), mul(UP, 0.3)), along: mix(FWD, mul(UP, 0.4)) },
      contact: { body: { bow: 0.1, sink: 0.06 }, ball: at('chest', [0, 0.36, -0.06]), palms: mix(LEFT, mul(FWD, 0.4), mul(UP, 0.3)), along: mix(FWD, mul(UP, 0.4)) },
      secure: { body: { bow: 0.3, sink: 0.08 }, ball: at('chest', [0, 0.18, -0.06]), palms: mix(LEFT, mul(BACK, 0.2)), along: mix(FWD, mul(UP, 0.4)) },
    },
  },
  oneHand: {
    says: 'a bare hand to the ball at the shoulder: the palm to it, the fingers up and spread; the hand closes as it lands and rides back with it, the other arm out for balance',
    ball: 'cricket', grip: 'power', stance: 'side', hands: 1, incoming: { speed: 16, drop: 2 }, give: 0.24, faces: true,
    sports: ['cricket (a fielder\'s catch)', 'baseball (a bare-handed pick)', 'rounders', 'a game of catch'],
    keys: {
      ready: { body: { face: 20, turn: 0.2 }, R: { at: at('shoulderR', [0.1, 0.3, -0.05]), along: UP, palm: FWD }, L: { at: at('shoulderL', [-0.12, 0.25, -0.12]), along: UP, palm: RIGHT } },
      contact: { body: { face: 30, turn: 0.3 }, R: { at: at('shoulderR', [0.08, 0.42, 0.06]), along: UP, palm: FWD }, L: { at: at('shoulderL', [-0.25, 0.15, -0.18]), along: UP, palm: RIGHT } },
      secure: { body: { face: 25, turn: 0.25 }, R: { at: at('chest', [0.12, 0.22, -0.02]), along: UP, palm: LEFT }, L: { at: at('shoulderL', [-0.2, 0.12, -0.25]), along: DOWN, palm: RIGHT } },
    },
  },
  skyball: {
    says: 'a high ball dropping steeply: the eyes on it, the hands up before the face, palms to it, fingers up, the ball taken by the eyes and given with down to the chest',
    ball: 'rugby', grip: 'spread', stance: 'square', hands: 2, incoming: { speed: 14, drop: 65 }, give: 0.24, faces: true,
    sports: ['rugby (an up-and-under)', 'Australian football (a mark)', 'cricket (a skied catch)', 'soccer (a goalkeeper\'s high catch)'],
    keys: {
      ready: { body: { bow: -0.05, sink: 0.04 }, ball: at('headTop', [0, 0.3, -0.16]), palms: mix(FWD, mul(UP, 0.5), mul(LEFT, 0.5)), along: UP },
      contact: { body: { bow: -0.08, sink: 0.04 }, ball: at('headTop', [0, 0.32, -0.12]), palms: mix(FWD, mul(UP, 0.5), mul(LEFT, 0.5)), along: UP },
      secure: { body: { bow: 0.15, sink: 0.08 }, ball: at('chest', [0, 0.2, 0]), palms: mix(LEFT, mul(UP, 0.3)) },
    },
  },
});
export const CATCH_NAMES = Object.freeze(Object.keys(CATCHES));

/** the ball's velocity coming in (+y is where it comes from): `speed` m/s, dropping `drop` degrees below level */
const incomingOf = ({ speed, drop = 0 }) => { const d = drop / DEG; return [0, -speed * Math.cos(d), -speed * Math.sin(d)]; };

/**
 * A catch solved on a rig (see the head). `name` a CATCHES name or the technique's words; `ball` and `incoming` ({ speed,
 * drop }) override the technique's.
 */
export function heroCatch(name, R, { ball, incoming } = {}) {
  const K = typeof name === 'object' ? name : CATCHES[name];
  if (!K) throw new Error(`hero-catch: no catch '${name}' (have ${CATCH_NAMES.join(', ')})`);
  // (the throw's parts read at the call: this module may load while hero-throw's import chain is still evaluating)
  const { stanceOf, bodyOf, placeOf, handTurn, ARM_KEYS, without } = throwParts;
  const S = K.side ?? 'R', O = S === 'R' ? 'L' : 'R', two = K.hands === 2;
  const B = ballOf(ball ?? K.ball), ref = B.id === 'own' ? B : B.id;
  const G = ballGrip(R, S, ref, K.grip), G2 = two ? ballGrip(R, O, ref, K.grip) : null;
  const st = stanceOf(R, K.stance), base = without(st.hold, ARM_KEYS), lite = liteOf(R);
  const kit = handsKit(R, { S, two, lite }), { inReach, withMids, solveKey, unwrapAll } = kit;
  const IN = { ...K.incoming, ...(incoming || {}) }, vIn = incomingOf(IN), speed = len(vIn), vHat = unit(vIn);
  // THE PLAN: the ready, the contact and the secure from the technique's words (both palms on the ball for two hands)
  const alongOf = (p) => { const a = sub(UP, mul(unit(p), dot(UP, unit(p)))); return len(a) < 1e-6 ? FWD : unit(a); };
  const planOf = (name, w) => {
    const body = bodyOf(base, w.body), n = rigNodesAt(lite, elbowsDown(R, body)).nodes, hands = {};
    if (two) {
      const P = placeOf(n, w.ball), pR = unit(w.palms), pL = [-pR[0], pR[1], pR[2]], aR = w.along ? unit(sub(w.along, mul(pR, dot(w.along, pR)))) : alongOf(pR), aL = [-aR[0], aR[1], aR[2]];
      hands.R = { P, along: aR, palm: pR, m: handTurn(R, 'R', aR, pR), g: S === 'R' ? G : G2 };
      hands.L = { P, along: aL, palm: pL, m: handTurn(R, 'L', aL, pL), g: S === 'L' ? G : G2 };
    } else {
      hands[S] = { P: placeOf(n, w[S].at), along: w[S].along, palm: w[S].palm, m: handTurn(R, S, w[S].along, w[S].palm), g: G };
      if (w[O]) hands[O] = { P: placeOf(n, w[O].at), along: w[O].along, palm: w[O].palm, m: handTurn(R, O, w[O].along, w[O].palm), g: null };
    }
    return { name, body, hands: inReach(n, hands) };
  };
  const ready = planOf('ready', K.keys.ready), contact = planOf('contact', K.keys.contact), secure = planOf('secure', K.keys.secure);
  // THE GIVE: the hands meet the ball moving back along its line at their own speed, the ball's slowed to it at the touch,
  // then both slowed evenly to rest over the give's distance (half the time gone: three quarters of the way)
  const vh = Math.min(SOFT * speed, SOFT_MAX), d = K.give, Tg = (2 * d) / vh;
  const moved = (k, by, name, body = k.body) => ({ ...k, name, body, hands: Object.fromEntries(Object.entries(k.hands).map(([sd, h]) => [sd, { ...h, P: sd === S || two ? add(h.P, by) : h.P }])) });
  const pre = moved(contact, mul(vHat, -vh * EARLY), 'contact-in');
  // (as the hands come back with the ball they turn toward how they will hold it: their palms and their fingers a third,
  // then two thirds of the way from the touch's to the secure's, the ball's centre kept on its line)
  const turned = (k, t) => ({ ...k, hands: Object.fromEntries(Object.entries(k.hands).map(([sd, h]) => {
    const to = secure.hands[sd]; if (!to || !h.g) return [sd, h];
    const palm = unit(add(mul(h.palm, 1 - t), mul(to.palm, t))), along0 = unit(add(mul(h.along, 1 - t), mul(to.along, t))), along = unit(sub(along0, mul(palm, dot(along0, palm))));
    return [sd, { ...h, palm, along, m: handTurn(R, sd, along, palm) }];
  })) });
  const give1 = turned(moved(contact, mul(vHat, 0.75 * d), 'give'), 1 / 3), give2 = turned(moved(contact, mul(vHat, d), 'give-end'), 2 / 3);
  for (const k of [pre, give1, give2]) k.hands = inReach(rigNodesAt(lite, elbowsDown(R, k.body)).nodes, k.hands);
  const seq = [...withMids([ready, pre]), contact, give1, ...withMids([give2, secure])];
  // THE TIMING: the hands out to the line by REACH_T, waiting; on it EARLY before the touch; the give; the bringing in
  const tPre = 0.32, tC = tPre + EARLY, tSecure = tC + Tg + 0.42;
  const times = [0, tPre / 2, tPre, tC, tC + Tg / 2, tC + Tg, (tC + Tg + tSecure) / 2, tSecure];
  // THE ARMS: solved in order, each key seeded by the one before; the fingers open until the touch, closed round it after
  // (the touch and the give are one motion, as a throw's drive is: their keys held hard each to the one before)
  const solved = [], drive = new Set([pre, contact, give1, give2]);
  for (const k of seq) { const before = solved.at(-1); solved.push(solveKey(k, before?.rolls ?? {}, before ?? null, drive.has(k) && before ? DRIVE_NEAR : undefined)); }
  unwrapAll(solved);
  const iC = seq.indexOf(contact);
  for (let j = 0; j < iC - 1; j++) for (const sd of Object.keys(seq[j].hands)) if (seq[j].hands[sd].g) solved[j].pose = { ...solved[j].pose, [`fingers${sd}`]: openFingers(R, sd) };
  const seconds = times.at(-1), stand = st.keys.at(-1);
  const clip = keyedClip({ seconds, keys: solved.map((k, j) => ({ ...stand, t: times[j] / seconds, pose: k.pose, sink: k.pose.sink ?? stand.sink })) }, R);
  // the ball: in flight to the touch (its line ending where the hands take it, the drop of its own fall), in the hand after
  const uC = tC / seconds, Pc = heldBall(R, clip, uC, S, G.centre);
  const flightAt = (t) => { const tau = t - tC; return [Pc[0] + vIn[0] * tau, Pc[1] + vIn[1] * tau, Pc[2] + vIn[2] * tau - 0.5 * G_ACC * tau * tau]; };
  const out = {
    name: typeof name === 'string' ? name : 'own', says: K.says, side: S, hands: K.hands, clip, seconds: r3(seconds), incoming: { speed: r1(speed), drop: IN.drop ?? 0, velocity: vIn.map(r3) },
    keys: solved.map((k, j) => ({ name: k.name, ...(seq[j].mid ? { mid: true } : {}), t: r4(times[j] / seconds), wrist: k.wristOk, err: Object.fromEntries(Object.entries(k.err).map(([sd, e]) => [sd, r4(e)])) })),
    contact: { t: r4(uC), at: Pc.map(r4) },
    give: { distance: d, seconds: r3(Tg), handSpeed: r3(vh), sting: r3(B.mass * (speed - vh)), force: r1((B.mass * vh * vh) / (2 * d)) },
    flight: { at: flightAt },
    ball: { id: B.id, r: B.radius, mass: B.mass, grip: G.grip, side: S, centreRest: G.centre, held: G.laws.held },
  };
  out.checks = catchChecks(R, out, solved, seq, K, G, G2, { vHat, vh, uC, uG: (tC + Tg) / seconds, contactPlan: contact });
  return out;
}

/** the ball's centre at share u: flying in before the contact, in the catching hand after */
export function catchBall(C, R, u) {
  return u < C.contact.t ? C.flight.at(u * C.seconds) : heldBall(R, C.clip, u, C.ball.side, C.ball.centreRest);
}

/**
 * The machine gate: the holding hands on their places at every key (under 6 mm), the grip round the ball, the wrists in
 * range at every key, the palms to the ball at the touch (within PALM_OFF of the technique's, which faces it; the angle to the
 * ball itself read), the
 * hands moving back along the ball's line at the touch (their speed within a third of the give's, their way within 30°
 * of the ball's), the give on its line (the ball within WOBBLE of it), the body over its feet at the ready and at the end.
 */
function catchChecks(R, C, solved, seq, K, G, G2, { vHat, vh, uC, uG, contactPlan }) {
  const miss = Math.max(...solved.flatMap((k) => Object.entries(k.err).filter(([sd]) => k.holds?.[sd]).map(([, e]) => e)));
  const wrist = solved.every((k) => k.wristOk);
  // the palms at the touch, against the ball's way back to where it came from
  const n = rigNodesAt(R, C.clip.fn(uC)).nodes, fr = boneFrames(R, R.joints, n), toBall = mul(vHat, -1);
  // (the palm's way at the touch: off the ball's way back to where it came from (read), and off the technique's palm, which
  // faces it as the technique holds it (held: a hand may roll about its fingers' way as little as its wrist needs))
  const angleTo = (sd, v) => r1(Math.acos(Math.max(-1, Math.min(1, dot(unit(mv(fr[R.boneIndex[`hand${sd}`]].m, handFrame(R, sd).N)), unit(v))))) * DEG);
  const holding = Object.keys(contactPlan.hands).filter((sd) => contactPlan.hands[sd].g);
  const palms = Object.fromEntries(holding.map((sd) => [sd, angleTo(sd, toBall)])), palmsOff = Object.fromEntries(holding.map((sd) => [sd, angleTo(sd, contactPlan.hands[sd].palm)]));
  // the hands' motion at the touch, read off the clip (a hundredth of a second either side)
  const du = 0.01 / C.seconds, a = heldBall(R, C.clip, uC - du, C.side, C.ball.centreRest), b = heldBall(R, C.clip, uC + du, C.side, C.ball.centreRest), v = mul(sub(b, a), 1 / (2 * du * C.seconds));
  const hand = { speed: r3(len(v)), off: r1(Math.acos(Math.max(-1, Math.min(1, dot(unit(v), vHat)))) * DEG) };
  // the give on its line: the played ball off the line from the touch to the give's end
  const P0 = heldBall(R, C.clip, uC, C.side, C.ball.centreRest), P1 = heldBall(R, C.clip, uG, C.side, C.ball.centreRest), dl = unit(sub(P1, P0));
  let wobble = 0; for (let i = 1; i < 12; i++) { const q = sub(heldBall(R, C.clip, uC + ((uG - uC) * i) / 12, C.side, C.ball.centreRest), P0); wobble = Math.max(wobble, len(sub(q, mul(dl, dot(q, dl))))); }
  const bal = (u) => { const m = rigNodesAt(R, C.clip.fn(u)).nodes, pts = []; for (const S of ['L', 'R']) { const L = R.legs[S]; pts.push(m[L.toeBase], m[L.toeTip], m[L.hock]); } return r4(margin(hull(pts.map((p) => [p[0], p[1]])), comOf(m))); };
  const balance = { ready: bal(0), end: bal(1) };
  const laws = {
    hands: miss < 0.006, grip: G.laws.held && G.laws.clear && (!G2 || (G2.laws.held && G2.laws.clear)), wrist,
    ...(K.faces ? { palms: Object.values(palmsOff).every((x) => x < PALM_OFF) } : {}),
    soft: Math.abs(hand.speed - vh) < vh / 3 && hand.off < 30, give: wobble < WOBBLE, balance: balance.ready > 0 && balance.end > 0,
  };
  return { miss: r4(miss), palms, palmsOff, hand, giveWobble: r4(wobble), balance, laws };
}
