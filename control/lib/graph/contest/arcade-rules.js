/**
 * THE ARCADE RULES — the ball games distilled to the level an arcade plays them, as MODULES: a sport is a card of
 * module words (its court, its score, its serve, its rally, its ball, its body), and a family composes the card into a
 * sport the book resolves by name (sports.js) and the shape's sim plays. A variant is the same card with a word moved:
 * `{ id, from: <card>, …words }` composes through the same modules (sports.js resolveSport), so "ping pong to 21" or
 * "pickleball without the kitchen" is a word, not a rulebook. A rulebook the modules cannot say is the distilled-rulebook
 * catalyst's (lib/mcp/catalysts/distilled-rulebook.md): it writes the kernel's data out whole.
 *
 * Each card names what the full rules say that the arcade level leaves out (`omits`), the honest edge of the game.
 *
 *   ARCADE_SPORTS                { <id>: card }   the arcade cards, by family
 *   ARCADE_FAMILIES              { net: … }        what each family is, the shape it plays on, its modules
 *   composeArcade(card, id?)     → the sport (sports.js's shape: { shape, words, spec(opts), ball, …the sim's dials,
 *                                  arcade: { family, card }, omits })
 *   arcadeCard(v)                → a variant's card: { from, …words } laid over the card it names (a module's words
 *                                  replace that module's, one level deep); throws, teaching
 *
 * THE NET FAMILY (the court, match-sim.js): two ends and a net, a rally the kernel calls.
 *   court   { width, length, bed?: height (a raised bed: the table), service?: { from, to } (the service boxes, metres
 *           from the net; absent, the serve goes into the whole half), kitchen?: depth (a no-volley zone off the net) }
 *   net     { height, posts?, beyond? }  (metres over the bed; beyond: past the side lines)
 *   score   { to, by?, games? (to win the match), side?: true (only the server scores: side-out) } rally points |
 *           { tennis: true } the tennis ladder (the book's)
 *   serve   { into: 'diagonal' | 'half', faults?, let?, turns?: 'game' | n (points each) | 'winner' (the rally's winner
 *           serves), court?: 'points' | 'score' (the box by the points played or the server's own score), bounce?:
 *           'own', behind, aside, hand }   where the server stands (behind its baseline, beside the centre) and
 *           strikes it (the hand's height)
 *   receive { behind, aside }   home { behind }   (metres behind the baseline: negative, inside the court)
 *   rally   { bounces?, touches?, mustBounce? }   fouls { <kind>: cost }   noVolley: <region> (a volley struck from it
 *           is the foul of its name)
 *   players a side's players (1; volleyball's pair 2): each at its home across the side (home.aside)
 *   assist  'pass': a side's touches before its last placed for a teammate in every register (volleyball's bump and set)
 *   body    { tip?, reach?, speed?, up?, bare? }   the register's body scaled for the game's size (a table's reach, a
 *           paddle's tip), how high it reaches (a jump's), bare hands (no racquet drawn)
 *   strokes { fore?, back?, serve? }   the hit's verbs (hit.js HIT_VERBS)
 *   cpu     { slip }   the computer's unforced error: the share of balls it lets go at the regular level (its level
 *           scales it, contest-mind.js); a small court's rally otherwise never ends
 *
 * Pure data and composition: no dice, no clock. The kernel reads what a family writes (contest-kernel.js), the gate.
 */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const afail = (m) => { throw new Error(`arcade: ${m}`); };
const r4 = (v) => Math.round(v * 10000) / 10000;
const freeze = (o) => { for (const v of Object.values(o)) if (isObj(v) || Array.isArray(v)) freeze(v); return Object.freeze(o); };

// ── the net family's modules ───────────────────────────────────────────────────────────────────────────────────

/** The court: the half, the service boxes (split diagonal, or whole), the kitchen. Side a's end is y < 0. */
function netCourt(c, serve) {
  const W = r4(c.width / 2), L = r4(c.length / 2), regions = { half: { rect: [-W, -L, W, 0] } };
  if (serve.into === 'diagonal') {
    const s = c.service ?? afail('a diagonal serve needs court.service: { from, to }, the boxes\' depth from the net');
    regions['service-right'] = { rect: [0, -r4(s.to), W, -r4(s.from)] };
    regions['service-left'] = { rect: [-W, -r4(s.to), 0, -r4(s.from)] };
  }
  if (c.kitchen) regions.kitchen = { rect: [-W, -r4(c.kitchen), W, 0] };
  return { frame: [c.width, c.length], mirror: 'half-turn', regions };
}

/** The score: rally points to a count by a lead, games to the match; or the tennis ladder. */
function netScore(s, games, rally) {
  if (s.tennis) return { points: 'rally', ladder: [{ unit: 'game', to: 4, by: 2, names: ['0', '15', '30', '40'] }, { unit: 'set', to: 6, by: 2 }, { unit: 'match', to: games }] };
  return { points: rally, ladder: [{ unit: s.unit ?? 'game', to: s.to, by: s.by ?? 2 }, { unit: 'match', to: games }] };
}

/** The serve's kernel words: the regions, who serves next, the box by what, the own bounce. */
function netServe(s) {
  const rotate = s.turns === 'winner' ? { rotate: 'side-out' } : Number.isInteger(s.turns) ? { rotate: 'point', every: s.turns } : { rotate: 'game' };
  return {
    into: s.into === 'diagonal' ? ['service-right', 'service-left'] : 'half',
    faults: s.faults ?? 2, let: s.let !== false, ...rotate,
    ...(s.court === 'score' ? { by: 'score' } : {}), ...(s.bounce ? { bounce: s.bounce } : {}),
  };
}

const NET_STROKES = Object.freeze({ fore: 'forehand', back: 'backhand', serve: 'serve' });

function composeNet(card) {
  for (const k of ['court', 'net', 'score', 'serve', 'receive', 'home']) if (!isObj(card[k])) afail(`a net card names ${k}`);
  const serve = card.serve, title = card.title;
  const spec = ({ sets } = {}) => {
    const games = sets ?? card.score.games ?? 1;
    return {
      shape: 'match', title, players: card.players ?? 1,
      court: netCourt(card.court, serve),
      scoring: netScore(card.score, games, card.score.side ? 'serve' : 'rally'),
      serve: netServe(serve),
      rally: { in: 'half', bounces: card.rally?.bounces ?? 1, touches: card.rally?.touches ?? 1, ...(card.rally?.sameTwice === false ? { sameTwice: false } : {}), ...(card.rally?.mustBounce ? { mustBounce: card.rally.mustBounce } : {}) },
      ...(card.fouls ? { fouls: { ...card.fouls } } : {}),
    };
  };
  return {
    shape: 'match', words: card.words, spec, ball: card.ball, players: card.players ?? 1,
    strokes: { ...NET_STROKES, ...(card.strokes ?? {}) },
    net: { height: card.net.height, posts: card.net.posts ?? card.net.height, beyond: card.net.beyond ?? 0.914 },
    serve: { behind: serve.behind, aside: serve.aside, hand: serve.hand },
    receive: { ...card.receive }, home: { ...card.home },
    ...(card.court.bed ? { bed: { height: card.court.bed } } : {}),
    ...(card.noVolley ? { noVolley: card.noVolley } : {}),
    ...(card.body && ['tip', 'reach', 'speed'].some((k) => card.body[k] !== undefined) ? { pace: Object.fromEntries(['tip', 'reach', 'speed'].filter((k) => card.body[k] !== undefined).map((k) => [k, card.body[k]])) } : {}),
    ...(card.body?.up ? { reachUp: card.body.up } : {}),
    ...(card.body?.bare ? { bare: true } : {}),
    ...(card.assist ? { assist: card.assist } : {}),
    ...(card.cpu?.slip ? { slip: card.cpu.slip } : {}),
  };
}

// ── the goal family's modules ──────────────────────────────────────────────────────────────────────────────────

/** A goal game's court: the floor shared, each side's half, its key (the box by its goal). Side a's goal is at y < 0. */
function goalCourt(c) {
  const W = r4(c.width / 2), L = r4(c.length / 2), key = c.key ?? [4.9, 5.8];
  return { frame: [c.width, c.length], mirror: 'reflect', regions: { pitch: { rect: [-W, -L, W, L], shared: true }, half: { rect: [-W, -L, W, 0] }, box: { rect: [-r4(key[0] / 2), -L, r4(key[0] / 2), r4(-L + key[1])] } } };
}

function composeGoal(card) {
  for (const k of ['court', 'goal', 'score', 'roles', 'play']) if (!isObj(card[k])) afail(`a goal card names ${k}`);
  const roles = Object.keys(card.roles), title = card.title;
  const spec = ({ periods, seconds } = {}) => ({
    shape: 'match', title, players: roles.length,
    roles: Object.fromEntries(roles.map((r) => [r, { home: 'pitch' }])),
    court: goalCourt(card.court),
    scoring: { ladder: [{ unit: card.score.unit ?? 'goal' }] },
    clock: { periods: periods ?? card.score.periods ?? 2, seconds: seconds ?? card.score.seconds ?? 120, ...(card.score.overtime ? { overtime: card.score.overtime } : {}) },
    ...(card.fouls ? { fouls: { ...card.fouls } } : {}),
    ...(card.outs ? { outs: { ...card.outs } } : {}),
  });
  const P = card.play;
  return {
    shape: 'team', words: card.words, spec, ball: card.ball, side: roles.length,
    goal: { ...card.goal, ...(card.goal.hoop ? { hoop: { ...card.goal.hoop } } : {}) },
    homes: Object.fromEntries(roles.map((r) => [r, card.roles[r].slice()])),
    kick: { verb: P.verb ?? 'kick', tipSpeed: P.tipSpeed, reach: P.reach, charge: P.charge, pass: P.pass, dribble: P.dribble },
    ground: { roll: card.ground?.roll ?? 3, boards: !!card.ground?.boards, ...(card.ground?.bounce ? { bounce: card.ground.bounce } : {}) },
    press: card.press ?? 7,
    ...(P.hands ? { hands: true } : {}),
  };
}

// ── the carry family's modules ─────────────────────────────────────────────────────────────────────────────────

function composeCarry(card) {
  for (const k of ['court', 'posts', 'carry', 'score', 'roles', 'play']) if (!isObj(card[k])) afail(`a carry card names ${k}`);
  const roles = Object.keys(card.roles), title = card.title, c = card.court, line = r4(c.length / 2), W = r4(c.width / 2), L = r4(line + c.ingoal);
  const spec = ({ periods, seconds } = {}) => ({
    shape: 'match', title, players: roles.length,
    roles: Object.fromEntries(roles.map((r) => [r, { home: 'pitch' }])),
    court: { frame: [c.width, r4(c.length + 2 * c.ingoal)], mirror: 'reflect', regions: { pitch: { rect: [-W, -L, W, L], shared: true }, half: { rect: [-W, -L, W, 0] }, 'in-goal': { rect: [-W, -L, W, -line] } } },
    scoring: { ladder: [{ unit: 'point' }] },
    clock: { periods: periods ?? card.score.periods ?? 2, seconds: seconds ?? card.score.seconds ?? 150 },
    carry: { ...card.carry, line },
  });
  const P = card.play;
  return {
    shape: 'team', words: card.words, spec, ball: card.ball, side: roles.length,
    goal: { posts: { ...card.posts, y: card.posts.at === 'end' ? L : line } },
    homes: Object.fromEntries(roles.map((r) => [r, card.roles[r].slice()])),
    kick: { verb: 'throw', tipSpeed: P.tipSpeed, reach: P.reach, charge: P.charge, pass: P.pass, dribble: P.dribble },
    ground: { roll: card.ground?.roll ?? 3, boards: false, ...(card.ground?.bounce ? { bounce: card.ground.bounce } : {}) },
    press: 0, hands: true,
    carry: { line, ingoal: c.ingoal, gap: card.gap ?? 2, lines: card.court.lines ?? 10, style: card.carry.downs ? 'downs' : 'tackles', ...(c.yards ? { yards: true } : {}) },
  };
}

export const ARCADE_FAMILIES = freeze({
  net: {
    shape: 'match', sim: 'the court (match-sim.js)', says: 'two ends and a net: a serve, a rally the kernel calls, points to games',
    modules: ['players', 'court', 'net', 'score', 'serve', 'receive', 'home', 'rally', 'fouls', 'noVolley', 'assist', 'body', 'strokes', 'ball', 'cpu'],
    doc: [
      'court { width, length, bed? (a table\'s height), service? { from, to } (the boxes off the net), kitchen? (a no-volley depth) }',
      'players (a side: 1, 2 …)   net { height, posts?, beyond? }   score { to, by?, games?, unit?, side? (only the server scores) } | { tennis: true }',
      'serve { into: diagonal | half, faults?, let?, turns?: game | n | winner, court?: points | score, bounce?: own, behind, aside, hand }',
      'rally { bounces?, touches?, sameTwice?, mustBounce? }   fouls { <kind>: point | … }   noVolley: <region>   receive, home { behind, aside? }',
      'assist: pass (the touches before the last placed for a teammate)   body { tip?, reach?, speed?, up? (the reach up), bare? }',
      'strokes { fore?, back?, serve? } (hit verbs)   ball   cpu { slip }',
    ],
    compose: composeNet,
  },
  goal: {
    shape: 'team', sim: 'the pitch (team-sim.js)', says: 'two goals and a clock: the sides mix, the ball carried, passed and shot, the most scored wins',
    modules: ['court', 'goal', 'score', 'roles', 'play', 'ground', 'press', 'fouls', 'outs', 'ball'],
    doc: [
      'court { width, length, key? [width, depth] (the box by each goal) }   roles { <role>: [x, y] } (a side\'s players, side a\'s homes)',
      'goal { width, height } (a mouth) | { hoop: { height, radius, out, board: [w, h], range }, three } (a ring; three points past `three`)',
      'score { unit?, periods?, seconds?, overtime? }   fouls { contact: free }   outs { side?: throw-in, end?: corner }',
      'play { verb?, hands?, tipSpeed, reach, charge, pass, dribble } (hands: caught, held, thrown)   ground { roll, boards?, bounce? }   press',
    ],
    compose: composeGoal,
  },
  carry: {
    shape: 'team', sim: 'the pitch (team-sim.js)', says: 'carry it over their line: tackles or downs, passes back or one forward, a try and its conversion kick',
    modules: ['court', 'posts', 'carry', 'score', 'roles', 'play', 'ground', 'gap', 'ball'],
    doc: [
      'court { width, length (line to line), ingoal, lines? (every so many metres), yards? (the distance said in yards) }   posts { width, bar, height, at?: end }',
      'carry { try, called?, conversion?, convertFrom?, start, tackles? | downs? + gain?, forward?: never | once, drop?, out? } (the kernel\'s)',
      'score { periods?, seconds? }   roles { <role>: [x, behind] } (the formation round the ball; the first takes it)   gap (the defence\'s line)',
      'play { tipSpeed, reach, charge, pass, dribble } (hands: caught, carried, passed)   ground { roll, bounce? }',
    ],
    compose: composeCarry,
  },
});

// ── the cards ──────────────────────────────────────────────────────────────────────────────────────────────────

export const ARCADE_SPORTS = freeze({
  pingpong: {
    family: 'net', title: 'Table tennis',
    words: 'table tennis: the serve bounces on your side first, one bounce a side, to eleven by two, two serves each',
    ball: 'pingpong',
    // ITTF: the table 2.74 × 1.525 m, its top 76 cm up; the net 15.25 cm high, its posts 15.25 cm outside the side lines
    court: { width: 1.525, length: 2.74, bed: 0.76 },
    net: { height: 0.1525, beyond: 0.1525 },
    score: { to: 11, by: 2, games: 2 },
    serve: { into: 'half', faults: 1, let: true, turns: 2, bounce: 'own', behind: 0.3, aside: 0.3, hand: 1.0 },
    receive: { behind: 0.8, aside: 0.25 }, home: { behind: 0.8 },
    rally: { bounces: 1, touches: 1 },
    strokes: { serve: 'drop' },
    body: { tip: 0.45, reach: 0.6, speed: 0.55 }, cpu: { slip: 0.1 },
    omits: ['the serve tossed 16 cm from an open palm, behind the end line and above the table', 'the serve alternating every point from ten-all', 'doubles\' alternate hitting and the right-half serve', 'the expedite system', 'the free hand on the table'],
  },
  pickleball: {
    family: 'net', title: 'Pickleball',
    words: 'pickleball: an underhand serve, the two-bounce rule, no volleys from the kitchen, to eleven by two',
    ball: 'pickleball',
    // USA Pickleball: the court 13.41 × 6.10 m, the non-volley zone 2.13 m off the net; the net 86 cm at the centre,
    // 91 cm at the posts
    court: { width: 6.1, length: 13.41, service: { from: 2.13, to: 6.705 }, kitchen: 2.13 },
    net: { height: 0.864, posts: 0.914, beyond: 0.3 },
    score: { to: 11, by: 2, games: 2 },
    serve: { into: 'diagonal', faults: 1, let: false, turns: 'winner', court: 'score', behind: 0.3, aside: 1.2, hand: 0.8 },
    receive: { behind: 0.6, aside: 1.5 }, home: { behind: 0.5 },
    rally: { bounces: 1, touches: 1, mustBounce: 2 },
    fouls: { kitchen: 'point' }, noVolley: 'kitchen',
    strokes: { serve: 'underhand' },
    body: { tip: 0.65, reach: 0.8, speed: 0.85 }, cpu: { slip: 0.08 },
    omits: ['side-out scoring (the arcade plays rally points, as the pro tour does)', 'doubles\' second server and the 0-0-2 call', 'the kitchen\'s momentum rule (a volley carrying the player into it after the strike)', 'the drop serve'],
  },
  badminton: {
    family: 'net', title: 'Badminton',
    words: 'badminton: a shuttle that never bounces, the low serve into the diagonal box, to twenty-one by two, the rally\'s winner serves',
    ball: 'shuttle',
    // BWF singles: the court 13.40 × 5.18 m, the short service line 1.98 m off the net (the singles long service line is
    // the back line); the net 1.524 m at the centre, 1.55 m at the posts
    court: { width: 5.18, length: 13.4, service: { from: 1.98, to: 6.7 } },
    net: { height: 1.524, posts: 1.55, beyond: 0.3 },
    score: { to: 21, by: 2, games: 2 },
    serve: { into: 'diagonal', faults: 1, let: false, turns: 'winner', court: 'score', behind: -3.6, aside: 0.6, hand: 0.9 },
    receive: { behind: -3.2, aside: 0.9 }, home: { behind: -3.4 },
    rally: { bounces: 0, touches: 1 },
    strokes: { fore: 'clear', back: 'clear', serve: 'underhand' },
    body: { tip: 1, reach: 1.15, speed: 0.9 }, cpu: { slip: 0.08 },
    omits: ['the cap at thirty (a game is won by two, however long)', 'the serve struck below 1.15 m and the server\'s feet still', 'the faults of a shuttle caught or slung on the racquet', 'doubles\' service courts'],
  },
  volleyball: {
    family: 'net', title: 'Beach volleyball',
    words: 'beach volleyball, two a side: three touches a side, never twice in a row, the ball never down, rally points to twenty-one',
    ball: 'volleyball', players: 2,
    // FIVB beach: the court 16 × 8 m, the net 2.43 m (men's); a set to 21 by two, the match the best of three
    court: { width: 8, length: 16 },
    net: { height: 2.43, posts: 2.55, beyond: 0.5 },
    score: { to: 21, by: 2, games: 2, unit: 'set' },
    serve: { into: 'half', faults: 1, let: false, turns: 'winner', behind: 0.6, aside: 1, hand: 2.7 },
    receive: { behind: -2.5, aside: 2 }, home: { behind: -3, aside: 2 },
    rally: { bounces: 0, touches: 3, sameTwice: false },
    assist: 'pass',
    strokes: { fore: 'spike', back: 'spike', serve: 'float' },
    body: { reach: 0.8, up: 3.1, bare: true }, cpu: { slip: 0.04 },
    omits: ['the third set to fifteen', 'changing ends every seven points', 'the block not counted as a touch', 'the open-hand tip and the double contact on a set', 'six a side, the rotation and the libero (the indoor game is a sport written out)'],
  },
  basketball: {
    family: 'goal', title: 'Basketball, three a side',
    words: 'full-court basketball, three a side: dribble, pass and shoot at the ring, two points inside the arc and three beyond it, four quarters',
    ball: 'basketball',
    // FIBA: the court 28 × 15 m; the ring 3.05 m up, 45 cm across, its centre 1.575 m out from the end line; the board
    // 1.8 × 1.05 m, its foot 2.9 m up; the three-point line 6.75 m from the ring's centre; the key 4.9 × 5.8 m
    court: { width: 15, length: 28, key: [4.9, 5.8] },
    goal: { hoop: { height: 3.05, radius: 0.225, out: 1.575, board: [1.8, 1.05], range: 7.6 }, three: 6.75 },
    score: { unit: 'point', periods: 4, seconds: 120, overtime: 60 },
    roles: { guard: [0, -2], forward: [-4, -6], center: [3, -9] },
    play: { verb: 'throw', hands: true, tipSpeed: 14, reach: 1, charge: 0.8, pass: 0.4, dribble: 3 },
    ground: { roll: 0.8, bounce: 0.85 }, press: 6,
    fouls: { contact: 'free' }, outs: { side: 'throw-in' },
    omits: ['five a side (three play the full court here)', 'the shot clock and the eight seconds to cross half way', 'travelling, the double dribble and the backcourt', 'free throws (a foul gives the ball back where it happened)', 'the inbound under the basket after a score (a check at the centre)', 'goaltending'],
  },
  rugby: {
    family: 'carry', title: 'Rugby, five a side',
    words: 'rugby five a side: run it and pass it back or flat, six tackles and the ball turns over, a try five and its conversion two',
    ball: 'rugby',
    // a short field for five (the full one is 100 × 70 m, its in-goals up to 22 m); the posts 5.6 m apart, the bar 3 m up
    court: { width: 40, length: 60, ingoal: 6, lines: 10 },
    posts: { width: 5.6, bar: 3, height: 7 },
    carry: { try: 5, called: 'try', conversion: 2, convertFrom: 15, start: 20, tackles: 6, forward: 'never', drop: 'turnover', out: 'turnover' },
    score: { periods: 2, seconds: 150 },
    roles: { half: [0, -1], forward: [-3, -2], centre: [5, -3], wing: [-10, -5], fullback: [2, -9] },
    play: { tipSpeed: 18, reach: 1, charge: 0.8, pass: 0.4, dribble: 3 }, ground: { roll: 3, bounce: 0.6 }, gap: 4,
    omits: ['fifteen (or seven) a side on the full field', 'the ruck and the maul (a tackle is rugby league\'s: the side keeps the ball, six times)', 'the scrum and the lineout (a knock-on or a ball out turns it over where it was)', 'kicking in open play, the drop goal and the penalty kick', 'the conversion taken in line with the try (the arcade kicks it from in front)'],
  },
  football: {
    family: 'carry', title: 'American football, five a side',
    words: 'American football five a side: four downs to gain ten yards, one forward pass a play from behind the line, a touchdown six and the extra point one',
    ball: 'football',
    // a short field for five (the NFL's is 100 yards between the goal lines, its end zones 10 yards deep); the posts
    // 18 ft 6 in apart on the end line, the bar 10 ft up; the ball at the 25 to start, the extra point from the 15
    court: { width: 30, length: 64, ingoal: 9.14, lines: 9.144, yards: true },
    posts: { width: 5.64, bar: 3.05, height: 9, at: 'end' },
    carry: { try: 6, called: 'touchdown', conversion: 1, convertFrom: 13.7, start: 22.9, downs: 4, gain: 9.14, forward: 'once', drop: 'down', out: 'down' },
    score: { periods: 2, seconds: 150 },
    roles: { qb: [0, -4], receiver: [-9, -0.5], wideout: [9, -0.5], tight: [-3, -1], back: [2, -6] },
    play: { tipSpeed: 18, reach: 1, charge: 0.8, pass: 0.4, dribble: 3 }, ground: { roll: 3, bounce: 0.55 }, gap: 1.5,
    omits: ['eleven a side, the snap from a center and the huddle', 'kickoffs and punts (a possession starts at the 25; after four downs the ball turns over where it lies)', 'penalties, the two-point try and the field goal', 'blocking (the line is a formation, the defence runs at the ball)'],
  },
});
export const ARCADE_SPORT_IDS = Object.freeze(Object.keys(ARCADE_SPORTS));

// ── composing ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A variant's card: the card it names (`from`), each module's words laid over that module's. */
export function arcadeCard(v) {
  if (typeof v === 'string') return ARCADE_SPORTS[v] ?? afail(`'${v}' is not an arcade card (${ARCADE_SPORT_IDS.join(', ')})`);
  if (!isObj(v)) afail('an arcade variant is { id, from: <card>, …the modules\' words }');
  const base = ARCADE_SPORTS[v.from] ?? afail(`from names an arcade card (${ARCADE_SPORT_IDS.join(', ')})`);
  const fam = ARCADE_FAMILIES[base.family];
  const card = { ...base };
  for (const [k, w] of Object.entries(v)) {
    if (['id', 'from'].includes(k)) continue;
    if (['words', 'title', 'omits'].includes(k)) { card[k] = w; continue; }
    if (!fam.modules.includes(k)) afail(`a ${base.family} card has no '${k}' (its modules: ${fam.modules.join(', ')}; words, title, omits)`);
    card[k] = isObj(w) && isObj(base[k]) ? { ...base[k], ...w } : w;
  }
  return card;
}

/** The sport a card composes to, through its family's modules. */
export function composeArcade(card, id = null) {
  const fam = ARCADE_FAMILIES[card.family] ?? afail(`family '${card.family}' is one of ${Object.keys(ARCADE_FAMILIES).join(', ')}`);
  const sport = fam.compose(card);
  return { ...sport, arcade: { family: card.family, ...(id ? { card: id } : {}) }, omits: [...(card.omits ?? [])] };
}

/**
 * The arcade rules' cards, served by get_game_vocab: `contest-arcade` the index (how a card is played and varied, each
 * family and its cards), `contest-arcade-<family>` a family's modules and its cards with what each leaves out. → the
 * card, or null for an id that is not one
 */
export function arcadeRulesCard(id = 'contest-arcade') {
  const cardsOf = (fam) => ARCADE_SPORT_IDS.filter((c) => ARCADE_SPORTS[c].family === fam);
  if (id === 'contest-arcade') {
    const body = [
      'THE ARCADE RULES — the ball games at the level an arcade plays them, each a card of modules its family composes',
      '(contest/arcade-rules.js). Play one by name: design_game({ quick: { goal: \'contest\', sport: \'<card>\' } }).',
      'A VARIANT moves a word: sport: { id, from: <card>, …a module\'s words } (laid over that module\'s, one level deep;',
      'words, title and omits replace), e.g. { id: \'pong-21\', from: \'pingpong\', score: { to: 21 } }. A rulebook the modules',
      'cannot say is written out whole: get_catalyst({ id: \'distilled-rulebook\' }).',
      '',
      ...Object.entries(ARCADE_FAMILIES).flatMap(([fam, f]) => [`${fam} (${f.sim}): ${f.says}`, `  cards: ${cardsOf(fam).join(', ')}   modules and omissions: get_game_vocab({ id: 'contest-arcade-${fam}' })`]),
    ].join('\n');
    return { id, name: 'The arcade rules', summary: 'the ball games distilled to modules: a card per sport, a variant a word', when: 'an arcade sport or a variant of one', scope: 'rail', body };
  }
  const fam = typeof id === 'string' && id.startsWith('contest-arcade-') ? id.slice('contest-arcade-'.length) : null, f = ARCADE_FAMILIES[fam];
  if (!f) return null;
  const body = [
    `THE ARCADE RULES, the ${fam} family (${f.sim}): ${f.says}. Its modules, a card's words:`,
    ...f.doc.map((d) => `  ${d}`),
    '',
    'its cards, each with what the full rules say that the arcade leaves out:',
    ...cardsOf(fam).flatMap((c) => [`  ${c}: ${ARCADE_SPORTS[c].words}`, `    omits: ${ARCADE_SPORTS[c].omits.join('; ')}`]),
  ].join('\n');
  return { id, name: `The arcade rules: ${fam}`, summary: `the ${fam} family's modules and cards`, when: `an arcade ${fam} game`, scope: 'rail', body };
}
