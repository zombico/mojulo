/**
 * THE CONTEST KERNEL — the game state of a sport as a pure function of the facts the movement layer saw: who touched
 * the ball and where, where it bounced, that it went out, that a runner pressed before the gun, that the clock ran.
 * It answers what is legal now, the phase, the score, the clock and the last call. It never integrates a body or a
 * ball (the physics property's sphere and the platform rule do that) and the agent never adjudicates: the kernel calls
 * every point.
 *
 * SINGLE SOURCE OF TRUTH, the board kernel's discipline (board/board-kernel.js): everything lives inside
 * `buildContest()`, a closure referencing nothing outside itself, so a page runs the same code by emitting
 * `buildContest.toString()`. Node imports the live instance below. Pure and seeded: no clock, no Math.random; the dice
 * are mulberry32 on the state (S.r) from the contest's seed (the toss, the gun's delay), and `apply` returns a new
 * state, so the same start and the same facts are the same contest to the byte.
 *
 * Four shapes of contest, one kernel:
 *   match   sides, a ball, possession, a court of named regions mirrored for the other side, a ladder of scoring
 *           units (points into games into sets), a serve or a kickoff as the restart, a clock with periods
 *   meet    an athletic event: lanes, a set and a gun, a false start, a measure (time, distance, height), attempts
 *   turns   a turn sport: seats played hot-seat, one shot at a time, the ball's rest the shot's end; rounds (holes,
 *           frames) each seat plays in turn; the score the strokes (the fewest win) or the pins (tenpin's marks)
 *   innings a bat-and-ball game: one side bats while the other fields, a ball at a time; outs end a side's innings
 *           (strikes make one, baseball's), overs may too (cricket's); runs round the bases or between the wickets
 *
 *   read(spec) → C   the contest compiled; throws on what it cannot read, teaching the shape
 *     spec: {
 *       shape: 'match' | 'meet' | 'turns', title?,
 *       players?: n (a side; 1), roles?: { <role>: { home: <region> } } (a side's players by role, in order),
 *       court?: { frame: [width, depth] (m; x across, y along, the centre 0,0; side a's end is y < 0), mirror: 'half-turn' |
 *                'reflect' (how side b's regions are made from side a's), regions: { <name>: { rect: [x0, y0, x1, y1] } |
 *                { circle: [cx, cy, r] }, each with shared?: true (the same for both sides) } }
 *       — a match —
 *       scoring: { points?: 'rally' (every rally scores; default) | 'serve' (only the serving side scores: side-out),
 *                  ladder: [{ unit, to?, by?, names? }, …] } the lowest unit first; winning a unit (to, ahead by `by`, 1)
 *                  resets it and adds one to the next; the top unit's win ends the match; a unit with no `to` is won by
 *                  the clock (the most at the end); names: what each count is called (tennis's 0 15 30 40)
 *       serve?: { into: <region> | [regions, cycled by the game's points], faults?: 2, let?: true, rotate?: 'game' | 'point'
 *                 | 'side-out', every?: n (points a 'point' rotation serves in a row; 1), by?: 'points' (the regions cycled
 *                 by the game's points played) | 'score' (by the server's own score: even the first, odd the second,
 *                 badminton's), bounce?: 'own' (the serve bounces on the server's own half first, then in the region:
 *                 table tennis's) }
 *       rally?: { in?: <region> ('half'), bounces?: 1 (a side may let it bounce so many times), touches?: 1 (a side may touch
 *                 it so many times before it crosses), sameTwice?: true (one player twice in a row), mustBounce?: n (the
 *                 first n returns after the serve must bounce before they are struck: pickleball's two-bounce rule) }
 *       clock?: { periods: n, seconds: n, overtime?: seconds (on a tie; absent: a draw) }
 *       fouls?: { <kind>: 'fault' | 'point' | 'free' | 'warn' }  what a reported foul costs: a serve fault, the point, a free
 *                 restart for the other side, a warning
 *       outs?: { side?: 'throw-in', end?: 'corner' }   a goal game's ball over a line: a throw-in for the other side where
 *                 it went out; over an end line, a corner for the attackers when the defenders touched it last, else a
 *                 goal kick (without `outs`, a free for the other side where it went out)
 *       carry?: { try, called?, conversion?, convertFrom?, line, start, tackles? | downs? + gain?, forward?, drop?, out? }
 *                 a carry game (rugby's, American football's): the ball carried over the other side's line (`line`, metres
 *                 from the centre) scores `try` points (called a try, a touchdown), then a conversion kicked from
 *                 `convertFrom` metres out for `conversion` more; each possession starts `start` metres from its own line
 *                 and is played in plays: a tackle ends one, the side keeps the ball for so many `tackles` (rugby league's
 *                 six) or `downs` to gain `gain` metres (football's four and ten yards), else it turns over; a pass
 *                 forward is `never` legal or legal `once` a play from behind the line; a ball dropped (`drop`) or out
 *                 (`out`) costs a `down` or a `turnover`
 *       offside?: 'ball'   a goal game's offside, read against the ball: a pass received by a teammate who stood past the
 *                 ball's line, in the other half, when it was played (a `touch` fact carries `atPass`: where the toucher
 *                 stood at its side's last touch) is a free for the other side where it was received
 *       — a meet —
 *       event: { kind, lanes: n, measure: 'time' | 'distance' | 'height', best?: 'low' | 'high' (time: low), attempts?: n
 *                (a measured event; 1), falseStart?: 'disqualify' | 'warn' (a warning, then disqualified) }
 *       — innings —
 *       innings: { innings?: n (each side bats so many times; 1), outs: n (end a side's innings), strikes?: n (bases:
 *                  so many strikes are an out, a foul never the last), overs?: n and balls: n (an innings ends after so
 *                  many overs of so many balls), runs: 'bases' (runners round the bases, home a run: baseball's) |
 *                  'runs' (runs between the wickets, a boundary's: cricket's) }   the side batting second wins the
 *                  moment it passes the first (the chase, the walk-off); a tie stands
 *       — turns —
 *       players: n (the seats, 1 to 8, played hot-seat in order: p1, p2 …)
 *       course?: { frame, regions } (no sides: every region as authored, the first that holds a point the ball's lie)
 *       rounds: n | [{ par?, course? }, …]   the holes or frames; a round with no course plays the spec's
 *       turn: { kind: 'strokes' | 'pins', shots?: n, from?: <region> (strokes: the tee; the ball starts at its centre),
 *               holed?: <region> (strokes: a rest in it ends the round), penalties?: { <region>: { strokes: n } } (a rest
 *               there costs so many and the ball is played again from its last lie), out?: { strokes: n } (a rest outside
 *               the frame, the same), pins?: n (10) }
 *               strokes: shots is the most a round before the pick-up (10); pins: 2 a frame, the last frame's bonus
 *               rolls tenpin's (a strike or a spare in it earns the fill)
 *     }
 *   start(C, seed) → S          the first state: the toss (match: who serves or kicks off), the lanes drawn (meet), the
 *                                first seat's turn at the first round (turns)
 *   legal(C, S, who) → { regions, touch, serve, may }   where `who` may stand (region names on its side), whether it may
 *                                touch the ball, whether it is the server; a meet's runner: its lane and what it may do;
 *                                a seat: whether it is its turn, where its ball lies, what it may do
 *   apply(C, S, fact) → { S, calls }   a fact the movement layer saw, the next state and the calls it made (a point, a
 *                                fault, a let, a game, a set, a gun, a false start, a finish, a mark, the end). A fact
 *                                the rules do not care about now changes nothing and calls nothing.
 *     facts (match): { kind: 'touch', who, at, atPass? } | { kind: 'bounce', at } | { kind: 'net' } (the ball on the cord) |
 *                    { kind: 'out', at? } (the ball gone past any line, where the sim knows before a bounce; a goal game's
 *                    carries where) |
 *                    { kind: 'foul', foul: <fouls key>, who, at? } | { kind: 'score', side, points? } (a goal; a basket
 *                    worth more than one, `points` of the lowest unit at once) |
 *                    { kind: 'tick', dt } | { kind: 'resume' } (the restart taken: play is live) |
 *                    a carry game's: { kind: 'tackle', who, at } (the carrier brought down) | { kind: 'pass', who, from, to }
 *                    | { kind: 'incomplete', at } (the ball down, nobody holding it) | { kind: 'try', who, at } |
 *                    { kind: 'convert', side, good }
 *     facts (meet):  { kind: 'set' } | { kind: 'tick', dt } | { kind: 'press', who } | { kind: 'finish', who } |
 *                    { kind: 'mark', who, value, foul? }
 *     facts (turns): { kind: 'shot', who } (the ball struck: a stroke, a roll) | { kind: 'rest', at } (strokes: where it
 *                    came to rest) | { kind: 'rest', standing } (pins: how many still stand)
 *     facts (innings): a ball's end: { kind: 'strike', why: missed | looking | foul } | { kind: 'dot' } | { kind: 'out',
 *                    why: caught | bowled | thrown-out | … } | { kind: 'hit', bases: 1 … 4 } (bases) | { kind: 'runs',
 *                    runs, boundary? } (runs)
 *   display(C, S) → { score: { a: [words], b: [words] }, phase, clock }   the scoreboard's words (deuce, advantage);
 *                                turns: the card, each seat's rounds and total (tenpin's marks and running totals)
 *   region(C, name, side, round?) → the shape on that side (turns: the round's course); inside(C, name, side, p);
 *                                sideOf(C, p) → 'a' | 'b' | null (the net); lieOf(C, S, p) → the region a point lies in
 *   players(C) → ['a1', 'a2', …, 'b1', …] | ['r1', …] | ['p1', …]; sideOf a player id is its first letter
 */

export function buildContest() {
  const SIDES = ['a', 'b'];
  const SHAPES = ['match', 'meet', 'turns', 'innings'];
  const TURN_KINDS = ['strokes', 'pins'];
  const MIRRORS = ['half-turn', 'reflect'];
  const MEASURES = ['time', 'distance', 'height'];
  const ROTATES = ['game', 'point', 'side-out'];
  const FOUL_COSTS = ['fault', 'point', 'free', 'warn'];
  const FALSE_STARTS = ['disqualify', 'warn'];
  const GUN_LEAST = 1.5, GUN_SPREAD = 1.5;   // seconds after "set" the gun may fire: least, and the spread the dice add

  function rnd(S) {
    S.r = (S.r + 0x6D2B79F5) >>> 0;
    let t = S.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clone = (S) => JSON.parse(JSON.stringify(S));
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const isPos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const isCount = (v) => Number.isInteger(v) && v > 0;
  const fail = (m) => { throw new Error(`contest: ${m}`); };
  const only = (o, keys, where) => { for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`${where} has no '${k}' (one of ${keys.join(', ')})`); };
  const opp = (side) => (side === 'a' ? 'b' : 'a');
  const sideOfId = (who) => (typeof who === 'string' && SIDES.includes(who[0]) ? who[0] : null);

  // ── reading ──────────────────────────────────────────────────────────────────────────────────────────────────

  function readCourt(c) {
    if (!isObj(c)) fail('court is { frame: [width, depth], mirror?, regions: { <name>: { rect } | { circle } } }');
    only(c, ['frame', 'mirror', 'regions'], 'court');
    if (!Array.isArray(c.frame) || c.frame.length !== 2 || !c.frame.every(isPos)) fail('court.frame is [width, depth] in metres');
    const mirror = c.mirror ?? 'half-turn';
    if (!MIRRORS.includes(mirror)) fail(`court.mirror is ${MIRRORS.join(' | ')}`);
    if (!isObj(c.regions) || !Object.keys(c.regions).length) fail('court.regions names at least one region');
    const regions = {};
    for (const [name, r] of Object.entries(c.regions)) {
      if (!/^[a-z][a-z0-9-]*$/.test(name)) fail(`court.regions: '${name}' is a name of letters, digits and dashes`);
      if (!isObj(r)) fail(`court.regions.${name} is { rect: [x0, y0, x1, y1] } or { circle: [cx, cy, r] }`);
      only(r, ['rect', 'circle', 'shared'], `court.regions.${name}`);
      if (r.rect !== undefined) {
        if (!Array.isArray(r.rect) || r.rect.length !== 4 || !r.rect.every(Number.isFinite) || !(r.rect[0] < r.rect[2]) || !(r.rect[1] < r.rect[3])) fail(`court.regions.${name}.rect is [x0, y0, x1, y1], x0 < x1 and y0 < y1`);
        regions[name] = { kind: 'rect', rect: r.rect.slice(), shared: r.shared === true };
      } else if (r.circle !== undefined) {
        if (!Array.isArray(r.circle) || r.circle.length !== 3 || !r.circle.every(Number.isFinite) || !(r.circle[2] > 0)) fail(`court.regions.${name}.circle is [cx, cy, r], r > 0`);
        regions[name] = { kind: 'circle', circle: r.circle.slice(), shared: r.shared === true };
      } else fail(`court.regions.${name} is a rect or a circle`);
    }
    return { frame: c.frame.slice(), mirror, regions };
  }

  function readLadder(l) {
    if (!Array.isArray(l) || !l.length) fail('scoring.ladder is a list of units, the lowest first: [{ unit, to?, by?, names? }]');
    return l.map((u, i) => {
      if (!isObj(u) || typeof u.unit !== 'string' || !u.unit) fail(`scoring.ladder[${i}] is { unit, to?, by?, names? }`);
      only(u, ['unit', 'to', 'by', 'names'], `scoring.ladder[${i}]`);
      if (u.to !== undefined && !isCount(u.to)) fail(`scoring.ladder[${i}].to is a whole number of ${u.unit}s`);
      if (u.by !== undefined && !isCount(u.by)) fail(`scoring.ladder[${i}].by is a whole number: the lead that wins`);
      if (u.to === undefined && i < l.length - 1) fail(`scoring.ladder[${i}] (${u.unit}) has no 'to': only the top unit may be won by the clock`);
      if (u.names !== undefined && (!Array.isArray(u.names) || !u.names.every((n) => typeof n === 'string'))) fail(`scoring.ladder[${i}].names is a list of words`);
      return { unit: u.unit, to: u.to ?? null, by: u.by ?? 1, names: u.names ? u.names.slice() : null };
    });
  }

  function readMatch(spec, C) {
    only(spec, ['shape', 'title', 'players', 'roles', 'court', 'scoring', 'serve', 'rally', 'clock', 'fouls', 'outs', 'offside', 'carry'], 'a match');
    if (!spec.court) fail('a match has a court');
    C.court = readCourt(spec.court);
    if (!isObj(spec.scoring)) fail('scoring is { points?: rally | serve, ladder: [...] }');
    only(spec.scoring, ['points', 'ladder'], 'scoring');
    const points = spec.scoring.points ?? 'rally';
    if (!['rally', 'serve'].includes(points)) fail('scoring.points is rally (every rally scores) or serve (only the server scores)');
    C.scoring = { points, ladder: readLadder(spec.scoring.ladder) };
    if (spec.serve !== undefined) {
      const s = spec.serve;
      if (!isObj(s)) fail('serve is { into, faults?, let?, rotate?, every?, by?, bounce? }');
      only(s, ['into', 'faults', 'let', 'rotate', 'every', 'by', 'bounce'], 'serve');
      const into = Array.isArray(s.into) ? s.into : [s.into];
      if (!into.length || !into.every((n) => typeof n === 'string' && C.court.regions[n])) fail(`serve.into is a region of the court (${Object.keys(C.court.regions).join(', ')}), or a list of them cycled by the game's points`);
      if (s.faults !== undefined && !isCount(s.faults)) fail('serve.faults is how many faults lose the point (2)');
      if (s.rotate !== undefined && !ROTATES.includes(s.rotate)) fail(`serve.rotate is ${ROTATES.join(' | ')}`);
      if (s.every !== undefined && !isCount(s.every)) fail('serve.every is the points a server serves in a row');
      if (s.by !== undefined && !['points', 'score'].includes(s.by)) fail('serve.by is points (the regions cycled by the points played) or score (by the server\'s own score, even then odd)');
      if (s.bounce !== undefined && s.bounce !== 'own') fail('serve.bounce is own: the serve bounces on the server\'s half first');
      C.serve = { into: into.slice(), faults: s.faults ?? 2, let: s.let !== false, rotate: s.rotate ?? 'game', every: s.every ?? 1 };
      // (the arcade rules' words, on the compiled contest only when given: a contest without them reads as it always has)
      if (s.by === 'score') C.serve.by = 'score';
      if (s.bounce) C.serve.bounce = s.bounce;
    } else C.serve = null;
    if (spec.rally !== undefined) {
      const r = spec.rally;
      if (!isObj(r)) fail('rally is { in?, bounces?, touches?, sameTwice?, mustBounce? }');
      only(r, ['in', 'bounces', 'touches', 'sameTwice', 'mustBounce'], 'rally');
      const inside = r.in ?? 'half';
      if (!C.court.regions[inside]) fail(`rally.in is a region of the court (${Object.keys(C.court.regions).join(', ')}): where a bounce is in`);
      if (r.bounces !== undefined && !(Number.isInteger(r.bounces) && r.bounces >= 0)) fail('rally.bounces is 0 or more');
      if (r.touches !== undefined && !isCount(r.touches)) fail('rally.touches is 1 or more');
      C.rally = { in: inside, bounces: r.bounces ?? 1, touches: r.touches ?? 1, sameTwice: r.sameTwice !== false };
      if (r.mustBounce !== undefined) {
        if (!isCount(r.mustBounce)) fail('rally.mustBounce is 1 or more: the returns after the serve that must bounce first');
        if (C.rally.bounces < 1) fail('rally.mustBounce asks a bounce, and rally.bounces is 0');
        C.rally.mustBounce = r.mustBounce;
      }
    } else C.rally = null;
    if (C.serve && !C.rally) C.rally = { in: C.court.regions.half ? 'half' : fail('a served match names rally.in (or a region called half)'), bounces: 1, touches: 1, sameTwice: true };
    if (spec.clock !== undefined) {
      const k = spec.clock;
      if (!isObj(k) || !isCount(k.periods) || !isPos(k.seconds)) fail('clock is { periods, seconds, overtime? }');
      only(k, ['periods', 'seconds', 'overtime'], 'clock');
      if (k.overtime !== undefined && !isPos(k.overtime)) fail('clock.overtime is seconds');
      C.clock = { periods: k.periods, seconds: k.seconds, overtime: k.overtime ?? null };
    } else C.clock = null;
    if (!C.serve && !C.clock) fail('a match is restarted by a serve or run on a clock: name serve or clock');
    const top = C.scoring.ladder[C.scoring.ladder.length - 1];
    if (top.to === null && !C.clock) fail(`scoring.ladder's top unit (${top.unit}) has no 'to' and there is no clock to end it`);
    C.fouls = {};
    if (spec.fouls !== undefined) {
      if (!isObj(spec.fouls)) fail(`fouls is { <kind>: ${FOUL_COSTS.join(' | ')} }`);
      for (const [k, v] of Object.entries(spec.fouls)) {
        if (!FOUL_COSTS.includes(v)) fail(`fouls.${k} is ${FOUL_COSTS.join(' | ')}`);
        if (v === 'fault' && !C.serve) fail(`fouls.${k} costs a serve fault, and this match has no serve`);
        C.fouls[k] = v;
      }
    }
    C.outs = null;
    if (spec.outs !== undefined) {
      if (!isObj(spec.outs)) fail('outs is { side?: throw-in, end?: corner }');
      only(spec.outs, ['side', 'end'], 'outs');
      if (C.rally) fail('outs belong to a goal game: a rally\'s out is the point');
      if (spec.outs.side !== undefined && spec.outs.side !== 'throw-in') fail('outs.side is throw-in');
      if (spec.outs.end !== undefined && spec.outs.end !== 'corner') fail('outs.end is corner (a goal kick when the attackers touched it last)');
      C.outs = { side: spec.outs.side ?? null, end: spec.outs.end ?? null };
    }
    C.offside = null;
    if (spec.offside !== undefined) {
      if (spec.offside !== 'ball') fail('offside is ball: a pass received past the ball\'s line, in the other half');
      if (C.rally) fail('offside belongs to a goal game');
      C.offside = 'ball';
    }
    if (spec.carry !== undefined) readCarry(spec.carry, C);
  }

  function readCarry(k, C) {
    if (!isObj(k)) fail('carry is { try, called?, conversion?, convertFrom?, line, start, tackles? | downs? + gain?, forward?, drop?, out? }');
    only(k, ['try', 'called', 'conversion', 'convertFrom', 'line', 'start', 'tackles', 'downs', 'gain', 'forward', 'drop', 'out'], 'carry');
    if (C.rally || C.serve) fail('carry belongs to a goal game on the clock, not a net game');
    if (!C.clock) fail('a carry game runs on a clock');
    if (!isCount(k.try)) fail('carry.try is the points a ball carried over the line scores');
    if (k.conversion !== undefined && !(Number.isInteger(k.conversion) && k.conversion >= 0)) fail('carry.conversion is the points a conversion kick adds (0: none)');
    if (!isPos(k.line) || k.line > C.court.frame[1] / 2) fail('carry.line is the try line, metres from the centre, inside the court\'s frame');
    if (!isPos(k.start) || k.start >= k.line) fail('carry.start is where a possession begins, metres out from the side\'s own line, short of the centre');
    if (k.convertFrom !== undefined && !isPos(k.convertFrom)) fail('carry.convertFrom is metres out from the line');
    if ((k.tackles === undefined) === (k.downs === undefined)) fail('carry names tackles (the tackles a side keeps the ball for) or downs and gain (the plays to gain so far)');
    if (k.tackles !== undefined && !isCount(k.tackles)) fail('carry.tackles is a count');
    if (k.downs !== undefined && (!isCount(k.downs) || !isPos(k.gain))) fail('carry.downs is a count and carry.gain the metres to gain for the next first down');
    if (k.forward !== undefined && !['never', 'once'].includes(k.forward)) fail('carry.forward is never or once (a play, from behind the line)');
    for (const w of ['drop', 'out']) if (k[w] !== undefined && !['down', 'turnover'].includes(k[w])) fail(`carry.${w} is down (a down lost at the line) or turnover`);
    C.carry = { try: k.try, called: k.called ?? 'try', conversion: k.conversion ?? 0, convertFrom: k.convertFrom ?? 10, line: k.line, start: k.start, tackles: k.tackles ?? null, downs: k.downs ?? null, gain: k.gain ?? null, forward: k.forward ?? 'never', drop: k.drop ?? 'turnover', out: k.out ?? 'turnover' };
  }

  function readMeet(spec, C) {
    only(spec, ['shape', 'title', 'players', 'event'], 'a meet');
    const e = spec.event;
    if (!isObj(e)) fail('a meet has an event: { kind, lanes, measure, best?, attempts?, falseStart? }');
    only(e, ['kind', 'lanes', 'measure', 'best', 'attempts', 'falseStart'], 'event');
    if (typeof e.kind !== 'string' || !e.kind) fail('event.kind names the event (sprint, hurdles, longJump, javelin …)');
    if (!isCount(e.lanes) || e.lanes > 12) fail('event.lanes is 1 to 12');
    if (!MEASURES.includes(e.measure)) fail(`event.measure is ${MEASURES.join(' | ')}`);
    const best = e.best ?? (e.measure === 'time' ? 'low' : 'high');
    if (!['low', 'high'].includes(best)) fail('event.best is low or high');
    if (e.attempts !== undefined && !isCount(e.attempts)) fail('event.attempts is 1 or more');
    if (e.measure === 'time' && e.attempts !== undefined && e.attempts !== 1) fail('a timed event is one attempt: the race');
    if (e.falseStart !== undefined && !FALSE_STARTS.includes(e.falseStart)) fail(`event.falseStart is ${FALSE_STARTS.join(' | ')}`);
    C.event = { kind: e.kind, lanes: e.lanes, measure: e.measure, best, attempts: e.measure === 'time' ? 1 : e.attempts ?? 1, falseStart: e.falseStart ?? 'disqualify' };
    C.players = C.event.lanes;
  }

  function readTurns(spec, C) {
    only(spec, ['shape', 'title', 'players', 'course', 'rounds', 'turn'], 'a turn sport');
    if (C.players > 8) fail('players is 1 to 8 (the seats, played hot-seat)');
    const shared = spec.course !== undefined ? readCourt(spec.course) : null;
    const R = spec.rounds;
    const list = isCount(R) ? Array.from({ length: R }, () => ({})) : Array.isArray(R) && R.length ? R : fail('rounds is a count, or a list [{ par?, course? }, …] (the holes, the frames)');
    if (list.length > 36) fail('rounds is at most 36');
    C.rounds = list.map((r, i) => {
      if (!isObj(r)) fail(`rounds[${i}] is { par?, course? }`);
      only(r, ['par', 'course'], `rounds[${i}]`);
      if (r.par !== undefined && !isCount(r.par)) fail(`rounds[${i}].par is a whole number of strokes`);
      const course = r.course !== undefined ? readCourt(r.course) : shared;
      if (!course) fail(`rounds[${i}] has no course and the spec names none`);
      return { par: r.par ?? null, course };
    });
    C.court = C.rounds[0].course;
    const t = spec.turn;
    if (!isObj(t)) fail('turn is { kind: strokes | pins, shots?, from?, holed?, penalties?, out?, pins? }');
    only(t, ['kind', 'shots', 'from', 'holed', 'penalties', 'out', 'pins'], 'turn');
    if (!TURN_KINDS.includes(t.kind)) fail(`turn.kind is ${TURN_KINDS.join(' | ')}`);
    if (t.shots !== undefined && !isCount(t.shots)) fail('turn.shots is a whole number: the most shots a round');
    const everyRound = (name, what) => { for (const [i, r] of C.rounds.entries()) if (!r.course.regions[name]) fail(`turn.${what} '${name}' is not a region of round ${i + 1}'s course (${Object.keys(r.course.regions).join(', ')})`); };
    if (t.kind === 'strokes') {
      if (typeof t.from !== 'string') fail('turn.from names the tee region (the ball starts at its centre)');
      everyRound(t.from, 'from');
      if (typeof t.holed !== 'string') fail('turn.holed names the hole region (a rest in it ends the round)');
      everyRound(t.holed, 'holed');
      const penalties = {};
      if (t.penalties !== undefined) {
        if (!isObj(t.penalties)) fail('turn.penalties is { <region>: { strokes } }');
        for (const [name, pen] of Object.entries(t.penalties)) {
          everyRound(name, 'penalties');
          if (!isObj(pen) || !isCount(pen.strokes)) fail(`turn.penalties.${name} is { strokes }`);
          penalties[name] = { strokes: pen.strokes };
        }
      }
      if (t.out !== undefined && (!isObj(t.out) || !isCount(t.out.strokes))) fail('turn.out is { strokes }: a rest outside the frame');
      if (t.pins !== undefined) fail('turn.pins belongs to a pins turn');
      C.turn = { kind: 'strokes', shots: t.shots ?? 10, from: t.from, holed: t.holed, penalties, out: t.out ? { strokes: t.out.strokes } : { strokes: 1 } };
    } else {
      for (const k of ['from', 'holed', 'penalties', 'out']) if (t[k] !== undefined) fail(`turn.${k} belongs to a strokes turn`);
      if (t.pins !== undefined && !isCount(t.pins)) fail('turn.pins is how many pins stand (10)');
      if (t.shots !== undefined && t.shots !== 2) fail('turn.shots in a pins turn is 2: tenpin\'s frame (the last frame\'s fill is the rule\'s)');
      C.turn = { kind: 'pins', shots: 2, pins: t.pins ?? 10 };
    }
  }

  function readInnings(spec, C) {
    only(spec, ['shape', 'title', 'players', 'court', 'innings'], 'an innings game');
    C.court = spec.court !== undefined ? readCourt(spec.court) : null;
    const k = spec.innings;
    if (!isObj(k)) fail('innings is { innings?, outs, strikes?, overs?, balls?, runs: bases | runs }');
    only(k, ['innings', 'outs', 'strikes', 'overs', 'balls', 'runs'], 'innings');
    if (!isCount(k.outs)) fail('innings.outs is how many outs end a side\'s innings');
    if (!['bases', 'runs'].includes(k.runs)) fail('innings.runs is bases (runners round the bases, baseball\'s) or runs (run between the wickets, cricket\'s)');
    for (const w of ['innings', 'strikes', 'overs', 'balls']) if (k[w] !== undefined && !isCount(k[w])) fail(`innings.${w} is a count`);
    if (k.overs !== undefined && k.balls === undefined) fail('innings.overs needs balls: the deliveries an over is');
    if (k.runs === 'runs' && k.strikes !== undefined) fail('innings.strikes belong to a game of bases');
    C.innings = { innings: k.innings ?? 1, outs: k.outs, strikes: k.strikes ?? null, overs: k.overs ?? null, balls: k.balls ?? null, runs: k.runs };
  }

  function read(spec) {
    if (!isObj(spec)) fail('a contest is an object: { shape: match | meet | turns, … }');
    if (!SHAPES.includes(spec.shape)) fail(`shape is ${SHAPES.join(' | ')}`);
    if (spec.title !== undefined && typeof spec.title !== 'string') fail('title is a string');
    if (spec.players !== undefined && !(isCount(spec.players) && spec.players <= 12)) fail('players is 1 to 12 (a side)');
    const C = { shape: spec.shape, title: spec.title ?? spec.shape, players: spec.players ?? 1, roles: null };
    if (spec.roles !== undefined) {
      if (!isObj(spec.roles) || !Object.keys(spec.roles).length) fail('roles is { <role>: { home: <region> } }, a side\'s players in order');
      C.roles = spec.roles;   // checked against the court below
    }
    if (C.shape === 'match') readMatch(spec, C); else if (C.shape === 'meet') readMeet(spec, C); else if (C.shape === 'innings') readInnings(spec, C); else readTurns(spec, C);
    if (C.roles) {
      if (C.shape !== 'match') fail('roles belong to a match');
      for (const [role, r] of Object.entries(C.roles)) {
        if (!isObj(r) || typeof r.home !== 'string' || !C.court.regions[r.home]) fail(`roles.${role}.home is a region of the court (${Object.keys(C.court.regions).join(', ')})`);
      }
      C.roles = Object.fromEntries(Object.entries(C.roles).map(([k, r]) => [k, { home: r.home }]));
      if (Object.keys(C.roles).length !== C.players) fail(`roles names ${Object.keys(C.roles).length} roles for ${C.players} players a side: one each`);
    }
    return C;
  }

  // ── the court ────────────────────────────────────────────────────────────────────────────────────────────────

  // (`|| 0` keeps a mirrored 0 from reading as -0, so a region's JSON is the same whichever side authored it)
  const mirrorPoint = (C, p) => (C.court.mirror === 'half-turn' ? [-p[0] || 0, -p[1] || 0] : [p[0], -p[1] || 0]);
  /** The region's shape on a side: side a's as authored, side b's mirrored; a shared region the same on both. */
  function region(C, name, side, round) {
    const court = C.shape === 'turns' && round !== undefined ? (C.rounds[round] || fail(`no round ${round + 1} (${C.rounds.length} rounds)`)).course : C.court;
    const r = court && court.regions[name];
    if (!r) fail(`no region '${name}' (${court ? Object.keys(court.regions).join(', ') : 'no court'})`);
    if (!SIDES.includes(side)) fail(`side is ${SIDES.join(' or ')}`);
    if (r.shared || side === 'a') return r.kind === 'rect' ? { kind: 'rect', rect: r.rect.slice() } : { kind: 'circle', circle: r.circle.slice() };
    if (r.kind === 'circle') { const [cx, cy, rad] = r.circle; const m = mirrorPoint(C, [cx, cy]); return { kind: 'circle', circle: [m[0], m[1], rad] }; }
    const [x0, y0, x1, y1] = r.rect, a = mirrorPoint(C, [x0, y0]), b = mirrorPoint(C, [x1, y1]);
    return { kind: 'rect', rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] };
  }
  const EPS = 1e-9;
  function insideShape(sh, p) {
    if (sh.kind === 'rect') { const [x0, y0, x1, y1] = sh.rect; return p[0] >= x0 - EPS && p[0] <= x1 + EPS && p[1] >= y0 - EPS && p[1] <= y1 + EPS; }
    const [cx, cy, r] = sh.circle;
    return Math.hypot(p[0] - cx, p[1] - cy) <= r + EPS;
  }
  const inside = (C, name, side, p, round) => insideShape(region(C, name, side, round), p);
  /** Which side of the net a point is on: a is y < 0, b is y > 0, the net itself null. */
  const sideOf = (C, p) => (p[1] < 0 ? 'a' : p[1] > 0 ? 'b' : null);
  const inFrame = (course, p) => Math.abs(p[0]) <= course.frame[0] / 2 + EPS && Math.abs(p[1]) <= course.frame[1] / 2 + EPS;
  /** The region a point lies in on a turn sport's current course: the first authored that holds it; 'out' beyond the frame; null in none. */
  function lieOf(C, S, p) {
    if (C.shape !== 'turns') fail('lieOf is a turn sport\'s');
    const course = C.rounds[Math.min(S.round, C.rounds.length) - 1].course;
    if (!inFrame(course, p)) return 'out';
    for (const name of Object.keys(course.regions)) if (insideShape(course.regions[name], p)) return name;
    return null;
  }
  const players = (C) => (C.shape === 'meet' ? Array.from({ length: C.event.lanes }, (_, i) => `r${i + 1}`) : C.shape === 'turns' ? Array.from({ length: C.players }, (_, i) => `p${i + 1}`) : SIDES.flatMap((s) => Array.from({ length: C.players }, (_, i) => `${s}${i + 1}`)));
  const playerOf = (C, side, index) => `${side}${index + 1}`;
  const at = (fact) => {
    if (!Array.isArray(fact.at) || fact.at.length < 2 || !Number.isFinite(fact.at[0]) || !Number.isFinite(fact.at[1])) fail(`a ${fact.kind} fact carries at: [x, y] in the court's frame`);
    return [fact.at[0], fact.at[1]];
  };

  // ── a match ──────────────────────────────────────────────────────────────────────────────────────────────────

  function newBall() { return { side: null, lastSide: null, lastWho: null, bounces: 0, touches: 0, serving: false, netted: false, passAt: null }; }

  function startMatch(C, seed) {
    const S = { r: seed >>> 0, n: 0, phase: 'ready', score: { a: C.scoring.ladder.map(() => 0), b: C.scoring.ladder.map(() => 0) }, played: 0, server: null, serverIndex: { a: 0, b: 0 }, served: 0, faults: 0, ball: newBall(), clock: C.clock ? { period: 1, t: 0, overtime: false } : null, restart: null, winner: null, last: null, warned: {} };
    const toss = rnd(S) < 0.5 ? 'a' : 'b';
    if (C.serve) { S.server = toss; S.phase = 'serve'; S.restart = { kind: 'serve', side: toss, who: playerOf(C, toss, 0) }; }
    else if (C.carry) { S.carry = { side: toss, los: 0, toGain: null, down: 1, tackles: 0, forward: false }; possession(C, S, toss, startOf(C, toss)); }
    else { S.phase = 'dead'; S.restart = { kind: 'kickoff', side: toss }; }
    return S;
  }

  // ── a carry game ─────────────────────────────────────────────────────────────────────────────────────────────

  const dirOf = (side) => (side === 'a' ? 1 : -1);   // a plays toward +y
  /** Where a side's possession begins: `start` metres out from its own line. */
  const startOf = (C, side) => [0, -dirOf(side) * (C.carry.line - C.carry.start)];
  const clampLine = (C, y) => Math.max(-C.carry.line, Math.min(C.carry.line, y));
  // a play is never restarted on a try line: five metres out at the nearest (rugby's five-metre line)
  const clampPlay = (C, y) => Math.max(-C.carry.line + 5, Math.min(C.carry.line - 5, y));
  /** A new possession for `side` at `at`: its first play, the line of scrimmage there, its first down's line. */
  function possession(C, S, side, at) {
    const K = S.carry, y = clampLine(C, at[1]);
    K.side = side; K.down = 1; K.tackles = 0;
    K.toGain = C.carry.downs ? clampLine(C, y + dirOf(side) * C.carry.gain) : null;
    play(C, S, side, [at[0], y]);
  }
  /** The next play: the ball dead at `at`, the side in possession restarting it there. */
  function play(C, S, side, at) {
    const y = clampPlay(C, at[1]);
    S.phase = 'dead'; S.ball = newBall(); S.carry.los = y; S.carry.forward = false;
    S.restart = { kind: 'play', side, at: [at[0], y] };
  }
  function turnover(C, S, side, at, why, calls) {
    calls.push({ kind: 'turnover', side, why });
    S.last = { kind: 'turnover', side, why };
    possession(C, S, side, at);
  }
  /** A play over with the side still holding the ball (a tackle; a down lost): its count, or the ball over. */
  function playOver(C, S, at, gained, calls) {
    const K = S.carry, side = K.side;
    if (C.carry.downs) {
      if (gained && (at[1] - K.toGain) * dirOf(side) >= 0) { K.down = 1; K.toGain = clampLine(C, at[1] + dirOf(side) * C.carry.gain); calls.push({ kind: 'down', side, down: 1, first: true }); return play(C, S, side, at); }
      K.down += 1;
      if (K.down > C.carry.downs) return turnover(C, S, opp(side), at, 'downs', calls);
      calls.push({ kind: 'down', side, down: K.down, toGo: Math.round(Math.abs(K.toGain - at[1]) * 10) / 10 });
      return play(C, S, side, at);
    }
    K.tackles += 1;
    if (K.tackles >= C.carry.tackles) return turnover(C, S, opp(side), at, 'tackles', calls);
    calls.push({ kind: 'tackle', side, count: K.tackles });
    play(C, S, side, at);
  }

  /** A carry game's facts; true when the fact was the carry's (handled). */
  function applyCarry(C, S, f, calls) {
    const K = S.carry, k = f.kind;
    if (k === 'touch' && S.phase === 'live') {
      // possession is the touch: a ball the other side takes in play (an interception, a loose ball) is theirs, live
      const side = sideOfId(f.who) || fail('a touch fact names who (a1, b2 …)');
      if (side !== K.side) { const y = clampLine(C, at(f)[1]); K.side = side; K.down = 1; K.tackles = 0; K.los = y; K.toGain = C.carry.downs ? clampLine(C, y + dirOf(side) * C.carry.gain) : null; K.forward = false; calls.push({ kind: 'turnover', side, why: 'taken', live: true }); }
      S.ball.lastSide = side; S.ball.lastWho = f.who; S.ball.side = side;
      return true;
    }
    if (k === 'tackle') {
      if (S.phase !== 'live') return true;
      const p = at(f);
      calls.push({ kind: 'tackled', who: f.who, at: p });
      playOver(C, S, p, true, calls);
      return true;
    }
    if (k === 'pass') {
      if (S.phase !== 'live') return true;
      const side = sideOfId(f.who), from = Array.isArray(f.from) ? f.from : fail('a pass fact carries from: [x, y]'), to = Array.isArray(f.to) ? f.to : fail('a pass fact carries to: [x, y]');
      if ((to[1] - from[1]) * dirOf(side) <= 0.3) return true;   // flat or back: always fair
      const legal = C.carry.forward === 'once' && !K.forward && (from[1] - K.los) * dirOf(side) <= 0.5;
      if (legal) { K.forward = true; return true; }
      calls.push({ kind: 'foul', foul: 'forward-pass', who: f.who, side, cost: C.carry.downs ? 'down' : 'turnover' });
      if (C.carry.downs) playOver(C, S, [from[0], K.los], false, calls); else turnover(C, S, opp(side), from, 'forward-pass', calls);
      return true;
    }
    if (k === 'incomplete' || (k === 'out' && C.carry)) {
      if (S.phase !== 'live') return true;
      const p = Array.isArray(f.at) ? [Math.max(-C.court.frame[0] / 2, Math.min(C.court.frame[0] / 2, f.at[0])), clampLine(C, f.at[1])] : [0, K.los];
      const cost = k === 'out' ? C.carry.out : C.carry.drop;
      calls.push({ kind: k === 'out' ? 'out' : 'incomplete', side: K.side, cost, ...(k === 'out' ? { restart: { kind: 'play', side: cost === 'down' ? K.side : opp(K.side), at: p } } : {}) });
      if (cost === 'down') playOver(C, S, k === 'out' ? p : [p[0], K.los], k === 'out', calls); else turnover(C, S, opp(K.side), p, k, calls);
      return true;
    }
    if (k === 'try') {
      if (S.phase !== 'live') return true;
      const side = sideOfId(f.who) || fail('a try fact names who carried it');
      const p = at(f);
      S.last = { kind: 'score', side, points: C.carry.try, how: C.carry.called };
      calls.push({ kind: 'score', side, points: C.carry.try, how: C.carry.called });
      for (let i = 0; i < C.carry.try; i++) if (climb(C, S, side, calls)) return true;
      S.phase = 'dead'; S.ball = newBall();
      if (C.carry.conversion) S.restart = { kind: 'conversion', side, at: [0, dirOf(side) * (C.carry.line - C.carry.convertFrom)], from: [p[0], p[1]] };
      else possession(C, S, opp(side), startOf(C, opp(side)));
      return true;
    }
    if (k === 'convert') {
      if (!S.restart || S.restart.kind !== 'conversion') return true;
      const side = S.restart.side, good = f.good === true;
      calls.push({ kind: 'conversion', side, good, points: good ? C.carry.conversion : 0 });
      if (good) for (let i = 0; i < C.carry.conversion; i++) if (climb(C, S, side, calls)) return true;
      possession(C, S, opp(side), startOf(C, opp(side)));
      return true;
    }
    return false;
  }

  const serverId = (C, S) => playerOf(C, S.server, S.serverIndex[S.server] % C.players);
  const serveInto = (C, S) => C.serve.into[(C.serve.by === 'score' ? S.score[S.server][0] : S.played) % C.serve.into.length];

  function nextServe(C, S, calls) {
    S.faults = 0; S.ball = newBall(); S.phase = 'serve';
    S.restart = { kind: 'serve', side: S.server, who: serverId(C, S) };
  }

  /** The ladder climbed by one unit for `side`: the calls it makes (a game, a set …) and whether the match is over. */
  function climb(C, S, side, calls) {
    const L = C.scoring.ladder, me = S.score[side], them = S.score[opp(side)];
    let gameOver = false;
    for (let i = 0; i < L.length; i++) {
      me[i] += 1;
      if (L[i].to === null) break;   // won by the clock, never by a count
      if (!(me[i] >= L[i].to && me[i] - them[i] >= L[i].by)) break;
      if (i === L.length - 1) { S.winner = side; S.phase = 'over'; S.restart = null; calls.push({ kind: 'over', winner: side, score: clone(S.score) }); return true; }
      calls.push({ kind: L[i].unit, side, score: [me[i], them[i]] });
      me[i] = 0; them[i] = 0; gameOver = gameOver || i === 0;
      // a serve that rotates by the game changes hands as the lowest unit is won
      if (i === 0 && C.serve && C.serve.rotate === 'game') { S.server = opp(S.server); S.serverIndex[S.server] += 1; S.served = 0; }
    }
    if (gameOver) S.played = 0;
    return false;
  }

  /** The rally is decided: `side` wins it for `why`. */
  function rallyTo(C, S, side, why, calls) {
    const scores = C.scoring.points === 'rally' || !C.serve || S.server === side;
    S.last = { kind: 'point', side, why, scored: scores };
    calls.push({ kind: 'point', side, why, scored: scores });
    S.played += 1;
    if (scores && climb(C, S, side, calls)) return;
    if (C.serve) {
      if (C.serve.rotate === 'side-out' && side !== S.server) { S.server = side; S.serverIndex[side] += 1; S.served = 0; }
      else if (C.serve.rotate === 'point') { S.served += 1; if (S.served >= C.serve.every) { S.server = opp(S.server); S.serverIndex[S.server] += 1; S.served = 0; } }
      if (S.phase !== 'over') nextServe(C, S, calls);
    } else { S.phase = 'dead'; S.ball = newBall(); S.restart = { kind: 'kickoff', side: opp(side) }; }
  }

  // a ball let bounce once too often: tennis's not-up; where no bounce is let (a shuttle, a volleyball), simply down
  const downWhy = (C) => (C.rally.bounces === 0 ? 'down' : 'double-bounce');

  function fault(C, S, calls, why) {
    S.faults += 1;
    if (S.faults >= C.serve.faults) { rallyTo(C, S, opp(S.server), 'double-fault', calls); return; }
    S.last = { kind: 'fault', side: S.server, why, faults: S.faults };
    calls.push({ kind: 'fault', side: S.server, why, faults: S.faults });
    S.ball = newBall(); S.phase = 'serve'; S.restart = { kind: 'serve', side: S.server, who: serverId(C, S) };
  }

  function applyMatch(C, S, f, calls) {
    const B = S.ball, k = f.kind;
    if (k === 'tick') {
      if (!C.clock || S.phase !== 'live') return;
      if (!isPos(f.dt)) fail('a tick fact carries dt, seconds');
      const K = S.clock, span = K.overtime ? C.clock.overtime : C.clock.seconds;
      K.t = Math.min(span, K.t + f.dt);
      if (K.t < span) return;
      calls.push({ kind: 'period', period: K.period, overtime: K.overtime });
      const top = C.scoring.ladder.length - 1, a = S.score.a[top], b = S.score.b[top];
      if (K.period < C.clock.periods && !K.overtime) { K.period += 1; K.t = 0; S.phase = 'between'; S.ball = newBall(); S.restart = { kind: 'kickoff', side: K.period % 2 === 0 ? 'b' : 'a' }; if (C.carry) { const side = S.restart.side; possession(C, S, side, startOf(C, side)); S.phase = 'between'; } return; }
      if (a !== b) { S.winner = a > b ? 'a' : 'b'; S.phase = 'over'; S.restart = null; calls.push({ kind: 'over', winner: S.winner, score: clone(S.score) }); return; }
      if (C.clock.overtime && !K.overtime) { K.overtime = true; K.t = 0; S.phase = 'between'; S.ball = newBall(); S.restart = { kind: 'kickoff', side: 'a' }; if (C.carry) { possession(C, S, 'a', startOf(C, 'a')); S.phase = 'between'; } calls.push({ kind: 'overtime' }); return; }
      S.winner = null; S.phase = 'over'; S.restart = null; calls.push({ kind: 'over', winner: null, score: clone(S.score) });
      return;
    }
    if (C.carry && applyCarry(C, S, f, calls)) return;
    if (k === 'resume') {
      if (S.phase !== 'dead' && S.phase !== 'between') return;
      S.phase = 'live'; S.last = { kind: 'resume', restart: S.restart }; calls.push({ kind: 'live', restart: S.restart }); S.restart = null;
      return;
    }
    if (k === 'foul') {
      const cost = C.fouls[f.foul];
      if (!cost) fail(`no foul '${f.foul}' in this contest (${Object.keys(C.fouls).join(', ') || 'none'})`);
      const side = sideOfId(f.who) || fail('a foul fact names who');
      if (S.phase === 'over') return;
      calls.push({ kind: 'foul', foul: f.foul, who: f.who, side, cost });
      if (cost === 'warn') { S.warned[f.who] = (S.warned[f.who] || 0) + 1; S.last = { kind: 'foul', foul: f.foul, who: f.who, cost }; return; }
      if (cost === 'fault') { if (S.phase === 'serve' || (S.phase === 'live' && B.serving)) fault(C, S, calls, f.foul); return; }
      if (cost === 'point') { rallyTo(C, S, opp(side), f.foul, calls); return; }
      S.phase = 'dead'; S.ball = newBall(); S.restart = { kind: 'free', side: opp(side), at: Array.isArray(f.at) ? f.at.slice(0, 2) : null }; S.last = { kind: 'foul', foul: f.foul, who: f.who, cost };
      return;
    }
    if (k === 'score') {
      if (S.phase !== 'live' || !SIDES.includes(f.side)) return;
      if (f.points !== undefined && !(Number.isInteger(f.points) && f.points >= 1 && f.points <= 9)) fail('a score fact\'s points is 1 to 9');
      const n = f.points ?? 1;
      S.last = { kind: 'score', side: f.side, ...(f.points !== undefined ? { points: n } : {}) };
      calls.push({ kind: 'score', side: f.side, ...(f.points !== undefined ? { points: n } : {}) });
      for (let i = 0; i < n; i++) if (climb(C, S, f.side, calls)) return;
      S.phase = 'dead'; S.ball = newBall(); S.restart = { kind: 'kickoff', side: opp(f.side) };
      return;
    }
    if (k === 'touch') {
      const who = f.who, side = sideOfId(who) || fail('a touch fact names who (a1, b2 …)'), p = at(f);
      if (S.phase === 'serve') {
        if (who !== serverId(C, S)) return;   // not the server: not a serve
        S.phase = 'live'; S.restart = null;
        Object.assign(B, { side, lastSide: side, lastWho: who, bounces: 0, touches: 1, serving: true, netted: false });
        calls.push({ kind: 'serve', who, into: serveInto(C, S), faults: S.faults });
        return;
      }
      if (S.phase !== 'live') return;
      if (!C.rally) {
        // a goal game: possession is the touch. Offside against the ball: a pass received by a teammate who stood past
        // the ball's line, in the other half, when its side last played it
        if (C.offside && B.lastSide === side && B.lastWho !== who && B.passAt && Array.isArray(f.atPass)) {
          const dir = side === 'a' ? 1 : -1;
          if (f.atPass[1] * dir > B.passAt[1] * dir + EPS && f.atPass[1] * dir > EPS) {
            calls.push({ kind: 'foul', foul: 'offside', who, side, cost: 'free' });
            S.phase = 'dead'; S.ball = newBall(); S.restart = { kind: 'free', side: opp(side), at: p }; S.last = { kind: 'foul', foul: 'offside', who, cost: 'free' };
            return;
          }
        }
        B.lastSide = side; B.lastWho = who; B.side = side; B.passAt = p;
        return;
      }
      const on = sideOf(C, p);
      if (on && on !== side) { rallyTo(C, S, opp(side), 'reach-over', calls); return; }
      if (B.lastSide === side) {
        if (B.serving) { rallyTo(C, S, opp(side), 'touched-own-serve', calls); return; }
        B.touches += 1;
        if (B.touches > C.rally.touches) { rallyTo(C, S, opp(side), 'touches', calls); return; }
        if (!C.rally.sameTwice && B.lastWho === who) { rallyTo(C, S, opp(side), 'double-touch', calls); return; }
      } else {
        if (B.serving && B.bounces === 0 && C.rally.bounces > 0 && B.lastSide !== null) { rallyTo(C, S, opp(side), 'volleyed-serve', calls); return; }
        // the two-bounce rule: the first returns are struck off the bounce, never on the volley
        if (C.rally.mustBounce) {
          if ((B.returns || 0) < C.rally.mustBounce && B.bounces === 0) { rallyTo(C, S, opp(side), 'volley-before-bounce', calls); return; }
          B.returns = (B.returns || 0) + 1;
        }
        B.touches = 1; B.bounces = 0; B.serving = false; B.netted = false;
      }
      B.lastSide = side; B.lastWho = who; B.side = side;
      return;
    }
    if (k === 'net') { if (S.phase === 'live' && B.serving && B.bounces === 0) B.netted = true; return; }
    if (k === 'out') {
      if (S.phase !== 'live') return;
      if (!C.rally) {
        // a goal game: the ball over a line comes back by the restart the game names, where it went out
        const p = at(f), W = C.court.frame[0] / 2, L = C.court.frame[1] / 2, last = B.lastSide || 'a';
        const onSide = Math.abs(p[0]) >= W - EPS && Math.abs(p[1]) < L - EPS;
        let restart;
        if (onSide || !C.outs || !C.outs.end) restart = { kind: C.outs && C.outs.side ? C.outs.side : 'free', side: opp(last), at: [Math.max(-W, Math.min(W, p[0])), Math.max(-L, Math.min(L, p[1]))] };
        else {
          const end = p[1] < 0 ? 'a' : 'b', ey = end === 'a' ? -L : L;   // whose end line
          restart = last === end ? { kind: 'corner', side: opp(end), at: [p[0] < 0 ? -W : W, ey] } : { kind: 'goal-kick', side: end, at: [0, ey - Math.sign(ey) * L * 0.1] };
        }
        S.phase = 'dead'; S.ball = newBall(); S.restart = restart; S.last = { kind: 'out', restart: clone(restart) };
        calls.push({ kind: 'out', side: restart.side, restart: clone(restart) });
        return;
      }
      if (!B.lastSide) return;
      if (B.serving && B.bounces === 0) { fault(C, S, calls, 'out'); return; }
      // a ball gone after it bounced in on a side was that side's to play
      if (B.side && B.bounces >= C.rally.bounces) { rallyTo(C, S, opp(B.side), 'double-bounce', calls); return; }
      rallyTo(C, S, opp(B.lastSide), 'out', calls);
      return;
    }
    if (k === 'bounce') {
      if (S.phase !== 'live' || !C.rally || !B.lastSide) return;
      const p = at(f), on = sideOf(C, p);
      if (on === null) { rallyTo(C, S, opp(B.lastSide), 'net', calls); return; }
      if (B.serving && B.bounces === 0) {
        // a serve that bounces on its own half first (table tennis's): that bounce, then the region's
        if (C.serve.bounce === 'own' && !B.own) {
          if (on === B.lastSide && inside(C, C.rally.in, on, p)) { B.own = true; return; }
          fault(C, S, calls, on === B.lastSide ? 'out' : 'no-own-bounce'); return;
        }
        const ok = inside(C, serveInto(C, S), on, p) && on !== B.lastSide;
        if (!ok) { fault(C, S, calls, on === B.lastSide ? 'own-side' : 'out'); return; }
        if (B.netted && C.serve.let) { S.last = { kind: 'let' }; calls.push({ kind: 'let' }); S.ball = newBall(); S.phase = 'serve'; S.restart = { kind: 'serve', side: S.server, who: serverId(C, S) }; return; }
        B.serving = false; B.netted = false; B.bounces = 1; B.side = on; B.touches = 0;
        if (B.bounces > C.rally.bounces) rallyTo(C, S, opp(on), downWhy(C), calls);
        return;
      }
      if (on === B.lastSide) { rallyTo(C, S, opp(on), 'own-side', calls); return; }
      // a ball that already bounced on this side is that side's to play: its next bounce, in or out, is the point lost
      if (B.side === on && B.bounces >= C.rally.bounces) { rallyTo(C, S, opp(on), 'double-bounce', calls); return; }
      if (!inside(C, C.rally.in, on, p)) { rallyTo(C, S, opp(B.lastSide), 'out', calls); return; }
      B.side = on; B.bounces += 1; B.touches = 0;
      if (B.bounces > C.rally.bounces) rallyTo(C, S, opp(on), downWhy(C), calls);
      return;
    }
    fail(`no fact '${k}' in a match (touch, bounce, net, out, foul, score, tick, resume)`);
  }

  function legalMatch(C, S, who) {
    const side = sideOfId(who);
    if (!side) fail(`'${who}' is not a player (${players(C).join(', ')})`);
    const index = Number(who.slice(1)) - 1;
    const regions = [];
    if (C.roles) { const role = Object.keys(C.roles)[index]; if (role) regions.push(C.roles[role].home); }
    if (C.rally && C.court.regions[C.rally.in] && !regions.length) regions.push(C.rally.in);
    for (const [name, r] of Object.entries(C.court.regions)) if (r.shared && !regions.includes(name)) regions.push(name);
    if (!regions.length) regions.push(Object.keys(C.court.regions)[0]);
    const serve = S.phase === 'serve' && who === serverId(C, S);
    const touch = S.phase === 'live' && (!C.rally || S.ball.side === null || S.ball.side === side);
    const may = S.phase === 'over' ? [] : serve ? ['serve'] : touch ? ['touch'] : S.phase === 'dead' || S.phase === 'between' ? (S.restart && S.restart.side === side ? ['resume'] : ['wait']) : ['move'];
    return { side, regions, touch, serve, may };
  }

  // ── a meet ───────────────────────────────────────────────────────────────────────────────────────────────────

  function startMeet(C, seed) {
    const S = { r: seed >>> 0, n: 0, phase: 'ready', t: 0, gunAt: null, lanes: {}, placings: null, last: null };
    for (const id of players(C)) S.lanes[id] = { lane: Number(id.slice(1)), state: 'ready', t: null, marks: [], best: null, warned: 0 };
    return S;
  }

  const runners = (S) => Object.keys(S.lanes);
  const better = (C, x, y) => (y === null ? true : x === null ? false : C.event.best === 'low' ? x < y : x > y);

  function finishMeet(C, S, calls) {
    const list = runners(S).map((id) => ({ who: id, lane: S.lanes[id].lane, value: S.lanes[id].state === 'dq' ? null : C.event.measure === 'time' ? S.lanes[id].t : S.lanes[id].best, dq: S.lanes[id].state === 'dq' }));
    const ranked = list.filter((x) => x.value !== null).sort((x, y) => (better(C, x.value, y.value) ? -1 : better(C, y.value, x.value) ? 1 : x.lane - y.lane));
    const rest = list.filter((x) => x.value === null).sort((x, y) => x.lane - y.lane);
    S.placings = [...ranked, ...rest].map((x, i) => ({ ...x, place: x.value === null ? null : i + 1 }));
    S.phase = 'over';
    calls.push({ kind: 'over', placings: clone(S.placings) });
  }

  function applyMeet(C, S, f, calls) {
    const k = f.kind, E = C.event;
    const lane = (who) => S.lanes[who] || fail(`'${who}' is not a runner (${runners(S).join(', ')})`);
    if (k === 'set') {
      if (S.phase !== 'ready') return;
      S.phase = 'set'; S.gunAt = S.t + GUN_LEAST + GUN_SPREAD * rnd(S);
      for (const id of runners(S)) if (S.lanes[id].state === 'ready') S.lanes[id].state = 'set';
      calls.push({ kind: 'set' });
      return;
    }
    if (k === 'tick') {
      if (!isPos(f.dt)) fail('a tick fact carries dt, seconds');
      if (S.phase !== 'set' && S.phase !== 'live') return;
      S.t += f.dt;
      if (S.phase === 'set' && S.t >= S.gunAt) {
        S.phase = 'live'; S.t -= S.gunAt;   // the race clock runs from the gun; the tick's remainder past it counts
        for (const id of runners(S)) if (S.lanes[id].state === 'set') S.lanes[id].state = 'running';
        S.last = { kind: 'gun' }; calls.push({ kind: 'gun' });
        if (!runners(S).some((id) => S.lanes[id].state === 'running')) finishMeet(C, S, calls);
      }
      return;
    }
    if (k === 'press') {
      const L = lane(f.who);
      if (S.phase !== 'set' || L.state !== 'set') return;   // after the gun a press is the run itself
      if (E.falseStart === 'warn' && !L.warned) { L.warned = 1; S.last = { kind: 'false-start', who: f.who, warned: true }; calls.push({ kind: 'false-start', who: f.who, warned: true }); return; }
      L.state = 'dq'; S.last = { kind: 'false-start', who: f.who, warned: false }; calls.push({ kind: 'false-start', who: f.who, warned: false });
      return;
    }
    if (k === 'finish') {
      const L = lane(f.who);
      if (S.phase !== 'live' || L.state !== 'running' || E.measure !== 'time') return;
      L.state = 'done'; L.t = S.t; L.best = S.t;
      calls.push({ kind: 'finish', who: f.who, t: S.t });
      if (!runners(S).some((id) => S.lanes[id].state === 'running')) finishMeet(C, S, calls);
      return;
    }
    if (k === 'mark') {
      const L = lane(f.who);
      if (S.phase !== 'live' || L.state !== 'running' || E.measure === 'time') return;
      if (L.marks.length >= E.attempts) return;
      const foul = f.foul === true, value = foul ? null : (Number.isFinite(f.value) && f.value >= 0 ? f.value : fail('a mark fact carries value (metres), or foul: true'));
      L.marks.push(value);
      if (value !== null && better(C, value, L.best)) L.best = value;
      calls.push({ kind: 'mark', who: f.who, attempt: L.marks.length, value, foul });
      if (L.marks.length >= E.attempts) L.state = 'done';
      if (!runners(S).some((id) => S.lanes[id].state === 'running')) finishMeet(C, S, calls);
      return;
    }
    fail(`no fact '${k}' in a meet (set, tick, press, finish, mark)`);
  }

  function legalMeet(C, S, who) {
    const L = S.lanes[who];
    if (!L) fail(`'${who}' is not a runner (${runners(S).join(', ')})`);
    const may = L.state === 'dq' || L.state === 'done' || S.phase === 'over' ? [] : S.phase === 'ready' ? ['wait'] : S.phase === 'set' ? ['hold'] : C.event.measure === 'time' ? ['run', 'finish'] : ['attempt'];
    return { lane: L.lane, state: L.state, may, attemptsLeft: C.event.measure === 'time' ? null : C.event.attempts - L.marks.length };
  }

  // ── a turn sport ─────────────────────────────────────────────────────────────────────────────────────────────

  const centreOf = (sh) => (sh.kind === 'rect' ? [(sh.rect[0] + sh.rect[2]) / 2, (sh.rect[1] + sh.rect[3]) / 2] : [sh.circle[0], sh.circle[1]]);
  const roundCourse = (C, S) => C.rounds[Math.min(S.round, C.rounds.length) - 1].course;

  function startTurns(C, seed) {
    const S = { r: seed >>> 0, n: 0, phase: 'turn', round: 1, seat: 0, turn: 'p1', shots: 0, pending: false, lie: null, standing: null, fresh: false, frame: null, cards: {}, totals: null, winner: null, tied: null, restart: null, last: null };
    for (const id of players(C)) S.cards[id] = { rounds: [], total: 0 };
    beginTurn(C, S, []);
    return S;
  }

  /** The seat's turn at the round: the ball on the tee, the pins racked. */
  function beginTurn(C, S, calls) {
    const T = C.turn, course = roundCourse(C, S);
    S.turn = players(C)[S.seat]; S.shots = 0; S.pending = false;
    if (T.kind === 'strokes') { S.lie = centreOf(course.regions[T.from]); S.restart = { kind: 'tee', who: S.turn, round: S.round, at: S.lie.slice() }; }
    else { S.standing = T.pins; S.fresh = true; S.frame = []; S.restart = { kind: 'rack', who: S.turn, round: S.round, standing: T.pins }; }
    calls.push({ kind: 'turn', who: S.turn, round: S.round });
  }

  /** Tenpin's card from a seat's frames ([[down, down?, fill?], …]): each frame's mark and its running total (null while it waits on the next rolls). */
  function tenpin(frames, pins, count) {
    const rolls = [], frameAt = [];
    for (const [i, f] of frames.entries()) for (const r of f) { rolls.push(r); frameAt.push(i); }
    const out = []; let total = 0, k = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i], last = i === count - 1;
      let score = null, mark;
      if (last) {
        // the fill frame: a roll on a fresh rack that fells every pin is a strike, one that fells the rest a spare
        mark = []; let fresh = true, prev = 0;
        for (const r of f) { mark.push(fresh && r === pins ? 'X' : !fresh && prev + r === pins ? '/' : String(r)); const reset = fresh ? r === pins : prev + r === pins; prev = reset ? 0 : r; fresh = reset; }
        if (f.length === 3 || (f.length === 2 && f[0] + f[1] < pins)) score = f[0] + f[1] + (f[2] || 0);
        k += f.length;
      }
      else if (f[0] === pins) { mark = ['X']; if (rolls.length >= k + 3) score = pins + rolls[k + 1] + rolls[k + 2]; k += 1; }
      else if (f.length === 2 && f[0] + f[1] === pins) { mark = [String(f[0]), '/']; if (rolls.length >= k + 3) score = pins + rolls[k + 2]; k += 2; }
      else if (f.length === 2) { mark = [String(f[0]), String(f[1])]; score = f[0] + f[1]; k += 2; }
      else { mark = [String(f[0])]; k += 1; }
      if (score !== null) total += score;
      out.push({ frame: i + 1, rolls: f.slice(), mark, score: score === null ? null : total });
    }
    void frameAt;
    return { frames: out, total };
  }

  function finishTurns(C, S, calls) {
    const ids = players(C), low = C.turn.kind === 'strokes';
    S.totals = Object.fromEntries(ids.map((id) => [id, S.cards[id].total]));
    const best = ids.reduce((b, id) => (b === null || (low ? S.totals[id] < S.totals[b] : S.totals[id] > S.totals[b]) ? id : b), null);
    const tied = ids.filter((id) => S.totals[id] === S.totals[best]);
    S.winner = tied.length === 1 ? best : null; S.tied = tied.length > 1 ? tied : null;
    S.phase = 'over'; S.turn = null; S.restart = null;
    calls.push({ kind: 'over', winner: S.winner, tied: S.tied, totals: clone(S.totals) });
  }

  /** The seat's round is done: the next seat, or the next round, or the end. */
  function endTurn(C, S, calls) {
    S.seat += 1;
    if (S.seat >= C.players) { S.seat = 0; S.round += 1; }
    if (S.round > C.rounds.length) { finishTurns(C, S, calls); return; }
    beginTurn(C, S, calls);
  }

  function applyTurns(C, S, f, calls) {
    const k = f.kind, T = C.turn;
    if (k === 'shot') {
      if (S.phase !== 'turn' || f.who !== S.turn || S.pending) return;
      S.shots += 1; S.pending = true;
      S.last = { kind: 'shot', who: S.turn, shot: S.shots, round: S.round };
      calls.push({ kind: 'shot', who: S.turn, shot: S.shots, round: S.round });
      return;
    }
    if (k === 'rest') {
      if (S.phase !== 'turn' || !S.pending) return;
      S.pending = false;
      const who = S.turn, card = S.cards[who], round = C.rounds[S.round - 1];
      if (T.kind === 'strokes') {
        const p = at(f), lie = lieOf(C, S, p);
        const record = (why) => {
          const strokes = S.shots, par = round.par;
          card.rounds.push({ round: S.round, strokes, par, toPar: par === null ? null : strokes - par, why });
          card.total += strokes;
          calls.push({ kind: 'holed', who, round: S.round, strokes, par, toPar: par === null ? null : strokes - par, why });
          S.last = calls[calls.length - 1];
          endTurn(C, S, calls);
        };
        if (lie === T.holed) { record('holed'); return; }
        const pen = lie === 'out' ? T.out : lie && T.penalties[lie] ? T.penalties[lie] : null;
        if (pen) { S.shots += pen.strokes; S.last = { kind: 'penalty', who, region: lie, strokes: pen.strokes, from: S.lie.slice() }; calls.push({ kind: 'penalty', who, region: lie, strokes: pen.strokes, from: S.lie.slice() }); }
        else { S.lie = [p[0], p[1]]; S.last = { kind: 'lie', who, region: lie, at: S.lie.slice() }; calls.push({ kind: 'lie', who, region: lie, at: S.lie.slice() }); }
        if (S.shots >= T.shots) { record('picked-up'); return; }
        S.restart = { kind: 'lie', who, round: S.round, at: S.lie.slice(), region: lieOf(C, S, S.lie) };
        return;
      }
      const standing = f.standing;
      if (!(Number.isInteger(standing) && standing >= 0 && standing <= S.standing)) fail(`a rest fact in a pins turn carries standing: 0 to ${S.standing} (the pins still up)`);
      const down = S.standing - standing, F = S.frame, last = S.round === C.rounds.length, pins = T.pins;
      F.push(down); S.standing = standing;
      const roll = F.length;
      // every pin felled on a fresh rack is a strike, the rest felled a spare; the rack is fresh again after either
      const mark = standing === 0 ? (S.fresh ? 'strike' : 'spare') : null;
      S.fresh = standing === 0;
      calls.push({ kind: 'roll', who, round: S.round, roll, down, standing, mark });
      S.last = calls[calls.length - 1];
      let over;
      if (!last) over = standing === 0 || roll === 2;
      else {
        const fill = F[0] === pins || (roll >= 2 && F[0] + F[1] === pins);
        over = roll === 3 || (roll === 2 && !fill);
        if (!over && standing === 0) S.standing = pins;   // the rack reset for the fill
      }
      if (over) {
        card.rounds.push({ round: S.round, rolls: F.slice(), mark: mark || (roll === 2 ? 'open' : null) });
        card.total = tenpin(card.rounds.map((r) => r.rolls), pins, C.rounds.length).total;
        endTurn(C, S, calls);
      } else S.restart = { kind: 'rack', who, round: S.round, standing: S.standing };
      return;
    }
    fail(`no fact '${k}' in a turn sport (shot, rest)`);
  }

  function legalTurns(C, S, who) {
    if (!players(C).includes(who)) fail(`'${who}' is not a seat (${players(C).join(', ')})`);
    const mine = S.phase === 'turn' && S.turn === who;
    const regions = C.turn.kind === 'strokes' ? [lieOf(C, S, S.lie) || 'rough'] : [Object.keys(roundCourse(C, S).regions)[0]];
    return { turn: mine, regions, at: mine && S.lie ? S.lie.slice() : null, may: S.phase === 'over' ? [] : mine ? (S.pending ? ['wait'] : ['shot']) : ['wait'] };
  }

  function displayTurns(C, S) {
    const ids = players(C), low = C.turn.kind === 'strokes';
    const seats = ids.map((id) => {
      const card = S.cards[id];
      if (low) {
        const played = card.rounds.filter((r) => r.par !== null);
        return { id, rounds: card.rounds.map((r) => ({ round: r.round, strokes: r.strokes, par: r.par, toPar: r.toPar })), total: card.total, toPar: played.length === card.rounds.length && card.rounds.length ? card.rounds.reduce((a, r) => a + r.toPar, 0) : null };
      }
      const live = S.phase === 'turn' && S.turn === id && S.frame && S.frame.length ? [...card.rounds.map((r) => r.rolls), S.frame] : card.rounds.map((r) => r.rolls);
      const T = tenpin(live, C.turn.pins, C.rounds.length);
      return { id, frames: T.frames, total: T.total };
    });
    return { phase: S.phase, round: S.round, rounds: C.rounds.length, turn: S.turn, shots: S.shots, standing: S.standing, lie: S.lie ? S.lie.slice() : null, seats, winner: S.winner, tied: S.tied ? S.tied.slice() : null, restart: S.restart ? clone(S.restart) : null };
  }

  // ── the shared face ──────────────────────────────────────────────────────────────────────────────────────────

  function start(C, seed = 1) {
    if (!Number.isInteger(seed)) fail('seed is a whole number');
    return C.shape === 'meet' ? startMeet(C, seed) : C.shape === 'turns' ? startTurns(C, seed) : C.shape === 'innings' ? startInnings(C, seed) : startMatch(C, seed);
  }

  // ── an innings game ──────────────────────────────────────────────────────────────────────────────────────────

  function startInnings(C, seed) {
    const S = { r: seed >>> 0, n: 0, phase: 'live', first: null, batting: null, inning: 1, half: 0, outs: 0, strikes: 0, balls: 0, overs: 0, bases: [false, false, false], runs: { a: [], b: [] }, total: { a: 0, b: 0 }, winner: null, last: null };
    S.first = rnd(S) < 0.5 ? 'a' : 'b'; S.batting = S.first; S.runs[S.batting].push(0);
    return S;
  }
  const lastInning = (C, S) => S.inning === C.innings.innings;
  function inningsOver(C, S, calls) {
    S.phase = 'over'; S.winner = S.total.a === S.total.b ? null : S.total.a > S.total.b ? 'a' : 'b';
    calls.push({ kind: 'over', winner: S.winner, score: { a: [S.total.a], b: [S.total.b] } });
  }
  /** A side's innings done: the other side in, or the next inning, or the end (the second side ahead after the
   * first's last innings need not bat). */
  function sideOver(C, S, calls) {
    const second = opp(S.first);
    if (S.half === 1 && lastInning(C, S)) return inningsOver(C, S, calls);
    if (S.half === 0 && lastInning(C, S) && S.total[second] > S.total[S.first]) return inningsOver(C, S, calls);
    if (S.half === 0) { S.half = 1; S.batting = second; } else { S.half = 0; S.inning += 1; S.batting = S.first; }
    S.outs = 0; S.strikes = 0; S.balls = 0; S.overs = 0; S.bases = [false, false, false]; S.runs[S.batting].push(0);
    calls.push({ kind: 'side', batting: S.batting, inning: S.inning, half: S.half });
  }
  function scoreRuns(C, S, n) {
    S.total[S.batting] += n; S.runs[S.batting][S.runs[S.batting].length - 1] += n;
  }
  /** The ball done: an over counted (cricket's), the innings over at its overs; the chase or the walk-off ends it. */
  function ballDone(C, S, calls) {
    if (S.phase === 'over') return;
    let ended = false;
    if (C.innings.balls && ++S.balls >= C.innings.balls) {
      S.balls = 0; S.overs += 1; ended = true;
      calls.push({ kind: 'end-over', side: S.batting, overs: S.overs });
    }
    if (S.half === 1 && lastInning(C, S) && S.total[S.batting] > S.total[S.first]) return inningsOver(C, S, calls);
    if (ended && C.innings.overs && S.overs >= C.innings.overs) sideOver(C, S, calls);
  }
  function outOf(C, S, why, calls) {
    S.outs += 1; S.strikes = 0;
    calls.push({ kind: 'out', side: S.batting, why, outs: S.outs });
    S.last = { kind: 'out', why };
    if (S.outs >= C.innings.outs) { sideOver(C, S, calls); return true; }
    return false;
  }

  function applyInnings(C, S, f, calls) {
    if (S.phase === 'over') return;
    const k = f.kind, side = S.batting;
    if (k === 'strike') {
      if (!C.innings.strikes) { calls.push({ kind: 'dot', side }); return ballDone(C, S, calls); }   // a game of runs: a ball missed is a dot
      if (f.why === 'foul' && S.strikes === C.innings.strikes - 1) { calls.push({ kind: 'strike', side, why: 'foul', count: S.strikes }); return; }
      S.strikes += 1;
      calls.push({ kind: 'strike', side, why: f.why ?? 'missed', count: S.strikes });
      if (S.strikes >= C.innings.strikes) { if (!outOf(C, S, 'struck-out', calls)) ballDone(C, S, calls); return; }
      return;
    }
    if (k === 'dot') { calls.push({ kind: 'dot', side }); return ballDone(C, S, calls); }
    if (k === 'out') { if (!outOf(C, S, typeof f.why === 'string' ? f.why : 'out', calls)) ballDone(C, S, calls); return; }
    if (k === 'hit') {
      if (C.innings.runs !== 'bases') fail('a hit fact belongs to a game of bases; a game of runs takes { kind: runs, runs }');
      const b = f.bases;
      if (!(Number.isInteger(b) && b >= 1 && b <= 4)) fail('a hit fact\'s bases is 1 to 4 (4: a home run)');
      // every runner on so many bases, the batter to the base it reached; the ones home score
      let runs = 0; const next = [false, false, false];
      for (let i = 2; i >= 0; i--) if (S.bases[i]) { if (i + b >= 3) runs += 1; else next[i + b] = true; }
      if (b >= 4) runs += 1; else next[b - 1] = true;
      S.bases = next; S.strikes = 0;
      scoreRuns(C, S, runs);
      calls.push({ kind: 'base-hit', side, bases: b, runs });
      S.last = { kind: 'hit', bases: b, runs };
      return ballDone(C, S, calls);
    }
    if (k === 'runs') {
      if (C.innings.runs !== 'runs') fail('a runs fact belongs to a game of runs; a game of bases takes { kind: hit, bases }');
      if (!(Number.isInteger(f.runs) && f.runs >= 0 && f.runs <= 6)) fail('a runs fact\'s runs is 0 to 6');
      scoreRuns(C, S, f.runs);
      calls.push({ kind: 'runs', side, runs: f.runs, ...(f.boundary ? { boundary: true } : {}) });
      S.last = { kind: 'runs', runs: f.runs };
      return ballDone(C, S, calls);
    }
    fail(`no fact '${k}' in an innings game (strike, dot, out, hit, runs)`);
  }

  function displayInnings(C, S) {
    return { phase: S.phase, score: { a: [String(S.total.a)], b: [String(S.total.b)] }, innings: { inning: S.inning, of: C.innings.innings, half: S.half, batting: S.batting, first: S.first, outs: S.outs, strikes: S.strikes, balls: S.balls, overs: S.overs, bases: S.bases.slice(), runs: clone(S.runs) }, winner: S.winner };
  }

  function apply(C, S, fact) {
    if (!isObj(fact) || typeof fact.kind !== 'string') fail('a fact is { kind, … }');
    const next = clone(S), calls = [];
    next.n += 1;
    if (C.shape === 'meet') applyMeet(C, next, fact, calls); else if (C.shape === 'turns') applyTurns(C, next, fact, calls); else if (C.shape === 'innings') applyInnings(C, next, fact, calls); else applyMatch(C, next, fact, calls);
    return { S: next, calls };
  }

  const legal = (C, S, who) => (C.shape === 'meet' ? legalMeet(C, S, who) : C.shape === 'turns' ? legalTurns(C, S, who) : C.shape === 'innings' ? { side: sideOfId(who), may: S.phase === 'over' ? [] : sideOfId(who) === S.batting ? ['bat'] : ['field'] } : legalMatch(C, S, who));

  /** The scoreboard's words: the tennis game's 0 15 30 40, deuce and advantage, else the counts. */
  function display(C, S) {
    if (C.shape === 'meet') return { phase: S.phase, t: S.t, lanes: clone(S.lanes), placings: S.placings ? clone(S.placings) : null };
    if (C.shape === 'turns') return displayTurns(C, S);
    if (C.shape === 'innings') return displayInnings(C, S);
    const L = C.scoring.ladder, out = { a: [], b: [] };
    for (let i = 0; i < L.length; i++) {
      const a = S.score.a[i], b = S.score.b[i], u = L[i];
      if (u.names && u.to !== null && u.by > 1 && a >= u.to - 1 && b >= u.to - 1) {
        const w = a === b ? ['deuce', 'deuce'] : a > b ? ['advantage', '-'] : ['-', 'advantage'];
        out.a.push(w[0]); out.b.push(w[1]);
      } else { out.a.push(u.names && a < u.names.length ? u.names[a] : String(a)); out.b.push(u.names && b < u.names.length ? u.names[b] : String(b)); }
    }
    return { phase: S.phase, score: out, server: S.server, clock: S.clock ? clone(S.clock) : null, restart: S.restart ? clone(S.restart) : null, winner: S.winner, ...(S.carry ? { carry: { side: S.carry.side, ...(C.carry.downs ? { down: S.carry.down, toGo: Math.round(Math.abs(S.carry.toGain - S.carry.los) * 10) / 10 } : { tackles: S.carry.tackles, of: C.carry.tackles }) } } : {}) };
  }

  /** The region the serve the state names is aimed into (the receiver's side), or null when no serve is due. */
  const serveRegion = (C, S) => (C.serve && S.server ? serveInto(C, S) : null);

  return { read, start, legal, apply, display, region, inside, sideOf, lieOf, players, serveRegion, SIDES, SHAPES };
}

const _contest = buildContest();
export const contestRead = _contest.read;
export const contestStart = _contest.start;
export const contestLegal = _contest.legal;
export const contestApply = _contest.apply;
export const contestDisplay = _contest.display;
export const contestRegion = _contest.region;
export const contestInside = _contest.inside;
export const contestSideOf = _contest.sideOf;
export const contestLieOf = _contest.lieOf;
export const contestPlayers = _contest.players;
export const contestServeRegion = _contest.serveRegion;
