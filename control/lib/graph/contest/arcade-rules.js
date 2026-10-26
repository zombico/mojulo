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
 *   body    { tip?, reach?, speed? }   the register's body scaled for the game's size (a table's reach, a paddle's tip)
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
  return { points: rally, ladder: [{ unit: 'game', to: s.to, by: s.by ?? 2 }, { unit: 'match', to: games }] };
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
  // a no-volley zone: a region the court lays, its foul costing the point (the one cost the match restarts from: a free
  // ball or a warning would leave the rally dead, a fault would swallow the volley)
  if (card.noVolley !== undefined) {
    const regions = netCourt(card.court, card.serve).regions;
    if (typeof card.noVolley !== 'string' || !regions[card.noVolley]) afail(`noVolley names a region the court lays (${Object.keys(regions).join(', ')}; a kitchen needs court.kitchen)`);
    if (card.fouls?.[card.noVolley] !== 'point') afail(`fouls.${card.noVolley} is 'point': a volley from the ${card.noVolley} costs the point (the match restarts from a point, not from a free ball, a warning or a fault)`);
  }
  const serve = card.serve, title = card.title;
  const spec = ({ sets } = {}) => {
    const games = sets ?? card.score.games ?? 1;
    return {
      shape: 'match', title, players: 1,
      court: netCourt(card.court, serve),
      scoring: netScore(card.score, games, card.score.side ? 'serve' : 'rally'),
      serve: netServe(serve),
      rally: { in: 'half', bounces: card.rally?.bounces ?? 1, touches: card.rally?.touches ?? 1, ...(card.rally?.mustBounce ? { mustBounce: card.rally.mustBounce } : {}) },
      ...(card.fouls ? { fouls: { ...card.fouls } } : {}),
    };
  };
  return {
    shape: 'match', words: card.words, spec, ball: card.ball, players: 1,
    strokes: { ...NET_STROKES, ...(card.strokes ?? {}) },
    net: { height: card.net.height, posts: card.net.posts ?? card.net.height, beyond: card.net.beyond ?? 0.914 },
    serve: { behind: serve.behind, aside: serve.aside, hand: serve.hand },
    receive: { ...card.receive }, home: { ...card.home },
    ...(card.court.bed ? { bed: { height: card.court.bed } } : {}),
    ...(card.noVolley ? { noVolley: card.noVolley } : {}),
    ...(card.body ? { pace: { ...card.body } } : {}),
    ...(card.cpu?.slip ? { slip: card.cpu.slip } : {}),
  };
}

export const ARCADE_FAMILIES = freeze({
  net: {
    shape: 'match', sim: 'the court (match-sim.js)', says: 'two ends and a net: a serve, a rally the kernel calls, points to games',
    modules: ['court', 'net', 'score', 'serve', 'receive', 'home', 'rally', 'fouls', 'noVolley', 'body', 'strokes', 'ball', 'cpu'],
    doc: [
      'court { width, length, bed? (a table\'s height), service? { from, to } (the boxes off the net), kitchen? (a no-volley depth) }',
      'net { height, posts?, beyond? }   score { to, by?, games?, side? (only the server scores) } | { tennis: true }',
      'serve { into: diagonal | half, faults?, let?, turns?: game | n | winner, court?: points | score, bounce?: own, behind, aside, hand }',
      'rally { bounces?, touches?, mustBounce? }   fouls { <kind>: point | … }   noVolley: <region>   receive, home { behind, aside? }',
      'body { tip?, reach?, speed? } (the body scaled)   strokes { fore?, back?, serve? } (hit verbs)   ball   cpu { slip }',
    ],
    compose: composeNet,
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

/** The arcade rules' card, served by get_game_vocab({ id: 'contest-arcade' }): the families, their modules, the cards. */
export function arcadeRulesCard() {
  const body = [
    'THE ARCADE RULES — the ball games at the level an arcade plays them, each a card of modules its family composes',
    '(contest/arcade-rules.js). Play one by name: design_game({ quick: { goal: \'contest\', sport: \'<card>\' } }).',
    'A VARIANT moves a word: sport: { id, from: <card>, …a module\'s words } (laid over that module\'s, one level deep;',
    'words, title and omits replace), e.g. { id: \'pong-21\', from: \'pingpong\', score: { to: 21 } }. A rulebook the modules',
    'cannot say is written out whole: get_catalyst({ id: \'distilled-rulebook\' }).',
    '',
    ...Object.entries(ARCADE_FAMILIES).flatMap(([id, f]) => [`${id} (${f.sim}): ${f.says}`, ...f.doc.map((d) => `  ${d}`)]),
    '',
    'the cards, each with what the full rules say that the arcade leaves out:',
    ...ARCADE_SPORT_IDS.flatMap((id) => { const c = ARCADE_SPORTS[id]; return [`  ${id} (${c.family}): ${c.words}`, `    omits: ${c.omits.join('; ')}`]; }),
  ].join('\n');
  return { id: 'contest-arcade', name: 'The arcade rules', summary: 'the ball games distilled to modules: a card per sport, a variant a word', when: 'an arcade sport or a variant of one', scope: 'rail', body };
}
