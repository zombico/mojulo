/**
 * THE SPORTS — the contests the court plays (match-sim.js) and the turn sports the course plays (turn-sim.js), each a
 * game nobody owns written out in the contest kernel's data (contest-kernel.js) with the play's own dials: the ball
 * (ball-card.js BALLS), how many a side, the strokes (hit.js HIT_VERBS), the net, where a serve is struck from and
 * where the receiver stands; a course's holes and lies, a lane's pins. A published game asked for by name is written
 * out from the rules the person explains; these are the rules everyone knows.
 *
 *   SPORTS { tennis, golf, bowling }   each { shape, words, spec(…), ball, … } with the dials its sim reads:
 *   TEAM_SPORTS { soccer, hockey }     the team goal games (team-sim.js): { side, goal, homes, kick, ground, press }
 *     tennis   { players, strokes: { fore, back, serve }, net: { height, posts }, serve: { behind, aside, hand },
 *                receive: { behind, aside }, home: { behind } } (metres from the baseline and the centre line)
 *     golf     { holes: [{ par, length, …regions }], clubs: [{ verb, within? | on? }] (the club by the distance left or
 *                the lie), lies: { <region>: decel } (the ground's rolling resistance, m/s²), cup: { radius, capture } }
 *     bowling  { lane: { width, length, gutter, approach, deck, pit }, pins: { spots, radius, mass, height, down }, hook, swing }
 *     each turn sport's swing: { tipSpeed, charge (the meter's seconds up), spread (the aim's degrees at full stick) }
 *   MATCH_SPORT_IDS, TURN_SPORT_IDS   the book by shape
 *   sportOf(id)                one, or throws naming the sports
 *   tennis({ sets? })          singles tennis: a game four points by two named 0 15 30 40 (deuce and advantage), a set six
 *                              games by two, the match best of three; the serve diagonally into the receiver's box, the
 *                              deuce court first, two faults the point, a let off the cord; one bounce a side, one touch
 *   golf({ holes? })           stroke play over the first so many holes of the course, each hole its own course of
 *                              regions (the tee, the fairway, the green, the bunkers, the water, the cup), a rest in the
 *                              water or out of bounds a stroke and the ball played again from its last lie, the pick-up
 *                              at ten; the fewest strokes win
 *   bowling({ frames? })       tenpin: ten frames of two rolls, a strike or a spare the mark, the tenth frame's fill
 *   soccer({ periods?, seconds? })   five-a-side on a small pitch: a goal a point, the clock decides, a throw-in and a
 *                              corner for the ball over the lines, offside against the ball, a foul a free kick
 *   hockey({ periods?, seconds? })   four-a-side on a rink with boards (the puck never goes out), overtime on a tie;
 *                              the blue-line offside is not the ball rule and is left out
 *
 * The arcade cards (arcade-rules.js: ping pong, pickleball, badminton …) are the book's too, each composed from its
 * card's modules by its family; `{ id, from: <card>, …words }` is a variant composed the same way.
 *
 * The court is the singles court: 8.23 m across, 23.77 m long, the net at y = 0, side a's end at y < 0. Regions are
 * written for side a and mirrored half-turn for side b, so the box on a's right is diagonal from b's right. A course's
 * frame is the hole's: the tee at the near end (y < 0), the cup far; the lane runs along +y from the foul line.
 */
import { ARCADE_SPORTS, ARCADE_SPORT_IDS, arcadeCard, composeArcade } from './arcade-rules.js';

const HALF_W = 8.23 / 2, HALF_L = 23.77 / 2, SERVICE = 6.4;

export function tennis({ sets = 2 } = {}) {
  return {
    shape: 'match',
    title: 'Singles tennis',
    players: 1,
    court: {
      frame: [8.23, 23.77],
      mirror: 'half-turn',
      regions: {
        half: { rect: [-HALF_W, -HALF_L, HALF_W, 0] },
        'service-right': { rect: [0, -SERVICE, HALF_W, 0] },
        'service-left': { rect: [-HALF_W, -SERVICE, 0, 0] },
        backcourt: { rect: [-HALF_W, -HALF_L, HALF_W, -SERVICE] },
      },
    },
    scoring: {
      points: 'rally',
      ladder: [
        { unit: 'game', to: 4, by: 2, names: ['0', '15', '30', '40'] },
        { unit: 'set', to: 6, by: 2 },
        { unit: 'match', to: sets },
      ],
    },
    serve: { into: ['service-right', 'service-left'], faults: 2, let: true, rotate: 'game' },
    rally: { in: 'half', bounces: 1, touches: 1 },
    fouls: { 'foot-fault': 'fault', 'net-touch': 'point' },
  };
}

// ── golf: three holes in an arena (a stadium hole, the way the short course plays); the cup is 108 mm across ──
const CUP = 0.054;
const hole = ({ par, length, frame, cupAt, green, bunkers = [], water = null, fairway, teeW = 2 }) => ({
  par, length, frame,
  regions: {
    cup: { circle: [cupAt[0], cupAt[1], CUP + 0.01] },
    ...Object.fromEntries(bunkers.map((b, i) => [`bunker${i + 1}`, { circle: b }])),
    green: { circle: [cupAt[0], cupAt[1], green] },
    ...(water ? { water: { rect: water } } : {}),
    fairway: { rect: fairway },
    tee: { rect: [-teeW, -frame[1] / 2 + 2, teeW, -frame[1] / 2 + 6] },
  },
});
export const GOLF_HOLES = Object.freeze([
  hole({ par: 3, length: 120, frame: [50, 150], cupAt: [0, 49], green: 9, bunkers: [[7, 41, 4]], water: [-24, -10, -11, 20], fairway: [-9, -66, 9, 38] }),
  hole({ par: 4, length: 300, frame: [60, 340], cupAt: [8, 134], green: 10, bunkers: [[-4, 128, 4], [16, 141, 3.5]], water: [-30, 40, -12, 80], fairway: [-10, -160, 10, 120] }),
  hole({ par: 3, length: 90, frame: [50, 120], cupAt: [0, 34], green: 8, water: [-12, 10, 12, 24], fairway: [-8, -50, 8, 8] }),
]);

export function golf({ holes = GOLF_HOLES.length } = {}) {
  if (!(Number.isInteger(holes) && holes >= 1 && holes <= GOLF_HOLES.length)) throw new Error(`contest: golf plays 1 to ${GOLF_HOLES.length} holes`);
  return {
    shape: 'turns',
    title: `Golf, ${holes} hole${holes === 1 ? '' : 's'}`,
    rounds: GOLF_HOLES.slice(0, holes).map((h) => ({ par: h.par, course: { frame: h.frame, regions: h.regions } })),
    turn: { kind: 'strokes', from: 'tee', holed: 'cup', penalties: { water: { strokes: 1 } }, out: { strokes: 1 }, shots: 10 },
  };
}

// ── bowling: the lane along +y from the foul line at y = 0, the approach behind it, the pins 18.29 m down, the pit beyond ──
const LANE_W = 1.05, LANE_L = 18.29, GUTTER = 0.24, APPROACH = 4.57, DECK = 1.0, PIT = 1.5;
const PIN_ROW = 0.3048 * Math.sqrt(3) / 2, PIN_X = 0.1524;
export const PIN_SPOTS = Object.freeze([[0, 0], [-PIN_X, PIN_ROW], [PIN_X, PIN_ROW], [-2 * PIN_X, 2 * PIN_ROW], [0, 2 * PIN_ROW], [2 * PIN_X, 2 * PIN_ROW], [-3 * PIN_X, 3 * PIN_ROW], [-PIN_X, 3 * PIN_ROW], [PIN_X, 3 * PIN_ROW], [3 * PIN_X, 3 * PIN_ROW]].map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round((LANE_L + y) * 10000) / 10000]));
const laneCourse = () => ({
  frame: [LANE_W + 2 * GUTTER + 1, 2 * (LANE_L + DECK + PIT + 1)],   // about the foul line at y = 0: deep enough both ways for the approach and the pit
  regions: {
    approach: { rect: [-LANE_W / 2, -APPROACH, LANE_W / 2, 0] },
    lane: { rect: [-LANE_W / 2, 0, LANE_W / 2, LANE_L + DECK] },
    'gutter-left': { rect: [-LANE_W / 2 - GUTTER, 0, -LANE_W / 2, LANE_L + DECK] },
    'gutter-right': { rect: [LANE_W / 2, 0, LANE_W / 2 + GUTTER, LANE_L + DECK] },
    pit: { rect: [-LANE_W / 2 - GUTTER, LANE_L + DECK, LANE_W / 2 + GUTTER, LANE_L + DECK + PIT] },
  },
});

export function bowling({ frames = 10 } = {}) {
  if (!(Number.isInteger(frames) && frames >= 1 && frames <= 10)) throw new Error('contest: bowling is 1 to 10 frames');
  return { shape: 'turns', title: `Tenpin, ${frames} frame${frames === 1 ? '' : 's'}`, course: laneCourse(), rounds: frames, turn: { kind: 'pins', pins: 10 } };
}

// ── the team goal games: a small pitch and a rink in an arena, five or four a side, two local pads ──
const teamCourt = (w, l, box, area) => ({
  frame: [w, l],
  mirror: 'reflect',
  regions: {
    pitch: { rect: [-w / 2, -l / 2, w / 2, l / 2], shared: true },
    half: { rect: [-w / 2, -l / 2, w / 2, 0] },
    box: { rect: [-box[0] / 2, -l / 2, box[0] / 2, -l / 2 + box[1]] },
    'goal-area': { rect: [-area[0] / 2, -l / 2, area[0] / 2, -l / 2 + area[1]] },
  },
});

export function soccer({ periods = 2, seconds = 120 } = {}) {
  return {
    shape: 'match',
    title: 'Five-a-side',
    players: 5,
    roles: { keeper: { home: 'box' }, back: { home: 'half' }, mid: { home: 'pitch' }, wing: { home: 'pitch' }, striker: { home: 'pitch' } },
    court: teamCourt(30, 50, [14, 6], [8, 3]),
    scoring: { ladder: [{ unit: 'goal' }] },
    clock: { periods, seconds },
    fouls: { contact: 'free', handball: 'free' },
    outs: { side: 'throw-in', end: 'corner' },
    offside: 'ball',
  };
}

export function hockey({ periods = 3, seconds = 90 } = {}) {
  return {
    shape: 'match',
    title: 'Four-a-side hockey',
    players: 4,
    roles: { keeper: { home: 'goal-area' }, back: { home: 'half' }, centre: { home: 'pitch' }, wing: { home: 'pitch' } },
    court: teamCourt(30, 60, [12, 8], [6, 3]),
    scoring: { ladder: [{ unit: 'goal' }] },
    clock: { periods, seconds, overtime: 60 },
    fouls: { contact: 'free', 'high-stick': 'free' },
    // the boards keep the puck in: no outs; the blue-line offside is not the ball rule, and is left out, said so
  };
}

export const SPORTS = Object.freeze({
  tennis: Object.freeze({
    shape: 'match',
    words: 'singles tennis: serve into the box, one bounce, 15 30 40, six games a set',
    spec: tennis, ball: 'tennis', players: 1,
    strokes: Object.freeze({ fore: 'forehand', back: 'backhand', serve: 'serve' }),
    net: Object.freeze({ height: 0.914, posts: 1.07, beyond: 0.914 }),
    // where the server stands (behind the baseline, aside the centre mark toward the deuce or ad court), where the
    // receiver waits (diagonal), and each player's home between points
    serve: Object.freeze({ behind: 0.4, aside: 1.0, hand: 2.8 }),   // the ball struck at the top of the reach
    receive: Object.freeze({ behind: 1.0, aside: 1.6 }),
    home: Object.freeze({ behind: 1.0 }),
  }),
  golf: Object.freeze({
    shape: 'turns',
    words: 'golf: a hole at a time, the club by the distance, a charged swing aimed with the stick, the cup; the fewest strokes',
    spec: golf, ball: 'golf', seats: 1,
    holes: GOLF_HOLES,
    // the club by what is left to the cup (the first whose reach holds it) or the lie it sits on
    clubs: Object.freeze([Object.freeze({ verb: 'putt', on: 'green' }), Object.freeze({ verb: 'iron', within: 170 }), Object.freeze({ verb: 'drive' })]),
    // the ground's rolling resistance by the lie (m/s²: a stimp-10 green stops a 1.83 m/s ball in 3.05 m), the rough's for a point in no region
    lies: Object.freeze({ tee: 1.6, fairway: 1.6, green: 0.55, bunker1: 9, bunker2: 9, rough: 3.5 }),
    cup: Object.freeze({ radius: CUP, capture: 1.6 }),   // a ball over the cup slower than this drops
    swing: Object.freeze({ tipSpeed: 45, charge: 1.2, spread: 15 }),   // the driver's head at the realistic register; the meter's seconds to full and back; the aim's degrees at the stick's full deflection
  }),
  bowling: Object.freeze({
    shape: 'turns',
    words: 'tenpin bowling: a roll aimed with the stick, hooked with its lift, ten frames, strikes and spares',
    spec: bowling, ball: 'bowling', seats: 1,
    lane: Object.freeze({ width: LANE_W, length: LANE_L, gutter: GUTTER, approach: APPROACH, deck: DECK, pit: PIT }),
    // the pin as a sphere: its sweep (a pin topples and sweeps its neighbours, which a belly of 0.06 never would), its
    // mass; a pin moved past `down` from its spot has fallen
    pins: Object.freeze({ spots: PIN_SPOTS, radius: 0.09, mass: 1.6, height: 0.38, down: 0.1 }),
    lies: Object.freeze({ lane: 0.12, pit: 20 }),   // the oiled lane's rolling resistance; the pit swallows what reaches it
    hook: Object.freeze({ rate: 4 }),   // rev/s of side roll at the stick's full lift (the lane's friction turns it into about a metre of curve)
    swing: Object.freeze({ tipSpeed: 40, charge: 1.0, spread: 3 }),   // the arm's at the release (the roll's power is a fifth of it); a narrow aim: the pocket is a hand wide
  }),
  // the arcade cards that play on the court or the course, composed from their modules
  ...Object.fromEntries(ARCADE_SPORT_IDS.filter((id) => composeArcade(ARCADE_SPORTS[id]).shape !== 'team').map((id) => [id, Object.freeze(composeArcade(ARCADE_SPORTS[id], id))])),
});
export const TEAM_SPORTS = Object.freeze({
  soccer: Object.freeze({
    shape: 'team',
    words: 'five-a-side football: two pads, pass and shoot, throw-ins and corners, offside against the ball, two halves',
    spec: soccer, ball: 'soccer', side: 5,
    goal: Object.freeze({ width: 4, height: 2 }),
    // each role's home point (side a's frame: its goal at -y), the kernel's home region round it
    homes: Object.freeze({ keeper: [0, -23], back: [-5, -14], mid: [0, -7], wing: [7, -8], striker: [2, -2] }),
    kick: Object.freeze({ verb: 'kick', tipSpeed: 20, reach: 1.1, charge: 0.8, pass: 0.45, dribble: 2.2 }),   // the leg's tip; a tap's share; the carry's speed over the body's
    ground: Object.freeze({ roll: 3, boards: false }),   // the grass's rolling resistance (m/s²); no boards: the ball goes out
    press: 7,
  }),
  hockey: Object.freeze({
    shape: 'team',
    words: 'four-a-side hockey on a rink with boards: two pads, a puck that never leaves, three periods and overtime',
    spec: hockey, ball: 'puck', side: 4,
    goal: Object.freeze({ width: 1.83, height: 1.22 }),
    homes: Object.freeze({ keeper: [0, -28], back: [-4, -18], centre: [0, -8], wing: [6, -10] }),
    kick: Object.freeze({ verb: 'kick', tipSpeed: 26, reach: 1.3, charge: 0.6, pass: 0.4, dribble: 2.6 }),
    ground: Object.freeze({ roll: 0.3, boards: true }),
    press: 8,
  }),
  // the arcade cards that play on the pitch, composed from their modules
  ...Object.fromEntries(ARCADE_SPORT_IDS.filter((id) => composeArcade(ARCADE_SPORTS[id]).shape === 'team').map((id) => [id, Object.freeze(composeArcade(ARCADE_SPORTS[id], id))])),
});
export const TEAM_SPORT_IDS = Object.freeze(Object.keys(TEAM_SPORTS));
export const SPORT_IDS = Object.freeze(Object.keys(SPORTS));
export const MATCH_SPORT_IDS = Object.freeze(SPORT_IDS.filter((id) => SPORTS[id].shape === 'match'));
export const TURN_SPORT_IDS = Object.freeze(SPORT_IDS.filter((id) => SPORTS[id].shape === 'turns'));

export function sportOf(id) {
  const s = SPORTS[id];
  if (!s) throw new Error(`contest: sport '${id}' is one of ${SPORT_IDS.join(', ')}`);
  return s;
}

// what a written-out sport must carry for its shape's sim, beside `spec` (the kernel's) and `words`
const WRITTEN_DIALS = Object.freeze({
  match: ['ball', 'players', 'strokes', 'net', 'serve', 'receive', 'home'],
  turns: ['ball', 'seats', 'clubs', 'lies', 'swing'],
  team: ['ball', 'side', 'goal', 'homes', 'kick', 'ground', 'press'],
});
const SHAPE_SIM = Object.freeze({ match: 'the court (match-sim.js)', turns: 'the course (turn-sim.js)', team: 'the pitch (team-sim.js)' });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sfail = (m) => { throw new Error(`contest: ${m}`); };

/**
 * A sport resolved: the book's by name, or one WRITTEN OUT (the distilled-rulebook catalyst's product: a rulebook
 * distilled into what the primitives can play): { id, shape: match | turns | team, words, spec (the kernel's, an
 * object), omits?: [words] (what the rulebook says that the primitives do not carry, named), …the shape's dials }.
 * The spec is checked by the kernel's own read; a written-out sport rides the sim its shape names, the dials the
 * sim reads checked for presence (their values the sim's to refuse). `shape`, when given, is the shape asked for.
 */
export function resolveSport(v, shape = null) {
  if (isObj(v) && v.from !== undefined) return resolveVariant(v, shape);
  if (typeof v === 'string') {
    const s = SPORTS[v] ?? TEAM_SPORTS[v];
    if (!s) sfail(`sport '${v}' is one of ${[...SPORT_IDS, ...TEAM_SPORT_IDS].join(', ')}, or a sport written out { id, shape, words, spec, … }`);
    if (shape && s.shape !== shape) sfail(`sport '${v}' is a ${s.shape === 'match' ? 'net game' : s.shape === 'turns' ? 'turn sport' : 'team goal game'}: it plays on ${SHAPE_SIM[s.shape]}`);
    return { id: v, ...s };
  }
  if (!isObj(v)) sfail('a sport is a name from the book, or one written out { id, shape, words, spec, … }');
  if (typeof v.id !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(v.id)) sfail('a written-out sport has an id: a short lower-case name');
  if (SPORTS[v.id] || TEAM_SPORTS[v.id]) sfail(`'${v.id}' is the book's: name it, or write the variant out under its own id (${v.id}-doubles, mini-${v.id})`);
  if (!WRITTEN_DIALS[v.shape]) sfail(`a written-out sport's shape is ${Object.keys(WRITTEN_DIALS).join(' | ')}`);
  if (shape && v.shape !== shape) sfail(`'${v.id}' is written as a ${v.shape}: it plays on ${SHAPE_SIM[v.shape]}`);
  if (typeof v.words !== 'string' || !v.words) sfail('a written-out sport says what it is in words');
  if (!isObj(v.spec)) sfail('a written-out sport carries spec: the contest kernel\'s data (contest-kernel.js read); the kernel teaches its shape');
  const kernelShape = v.shape === 'team' ? 'match' : v.shape;
  if (v.spec.shape !== kernelShape) sfail(`a ${v.shape} sport's spec has shape '${kernelShape}'`);
  if (v.shape === 'team' && v.spec.rally !== undefined) sfail('a team goal game\'s spec has no rally: its clock and goals decide');
  if (v.shape === 'match' && !v.spec.serve) sfail('a net game\'s spec names a serve');
  const turnKind = v.shape === 'turns' && isObj(v.spec.turn) ? v.spec.turn.kind : null;
  const need = [...WRITTEN_DIALS[v.shape], ...(turnKind === 'strokes' ? ['cup', 'holes'] : turnKind === 'pins' ? ['lane', 'pins', 'hook'] : [])];
  const missing = need.filter((k) => v[k] === undefined);
  if (missing.length) sfail(`a written-out ${v.shape} sport carries ${need.join(', ')} (missing ${missing.join(', ')}); the book's ${v.shape === 'match' ? 'tennis' : v.shape === 'turns' ? 'golf and bowling' : 'soccer and hockey'} show the dials`);
  if (v.omits !== undefined && !(Array.isArray(v.omits) && v.omits.every((o) => typeof o === 'string'))) sfail('omits is a list of words: what the rulebook says that the primitives do not carry');
  const { spec, ...rest } = v;
  return { ...rest, spec: () => JSON.parse(JSON.stringify(spec)), written: true };
}

/** An arcade variant: { id, from: <an arcade card>, …the modules' words } composed through the card's family. */
function resolveVariant(v, shape) {
  if (typeof v.id !== 'string' || !/^[a-z][a-z0-9-]{1,31}$/.test(v.id)) sfail('an arcade variant has an id: a short lower-case name');
  if (SPORTS[v.id] || TEAM_SPORTS[v.id]) sfail(`'${v.id}' is the book's: name the variant its own id (${v.id}-21, mini-${v.id})`);
  let s;
  try { s = composeArcade(arcadeCard(v), v.from); } catch (e) { sfail(e.message.replace(/^arcade: /, '')); }
  if (shape && s.shape !== shape) sfail(`'${v.id}' (from ${v.from}) is a ${s.shape === 'match' ? 'net game' : s.shape === 'turns' ? 'turn sport' : 'team goal game'}: it plays on ${SHAPE_SIM[s.shape]}`);
  return { id: v.id, ...s };
}

/** The sport's dials a page carries (its spec compiled apart): the book's by id, a written-out one whole. */
export function sportDialsOf(sport) {
  const { spec, written, ...dials } = sport; void spec;
  return written ? { ...dials, written: true } : dials;
}
/** What a page or a level stores for the sport: its name, or the written-out sport itself. */
export const sportKeyOf = (v) => (typeof v === 'string' ? v : { ...v });
