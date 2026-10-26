/**
 * THE CONTEST'S STATS — what a sport's broadcast counts, folded from the calls its sim keeps (`S.calls`: the kernel's
 * calls and the sim's own, each stamped with its frame). The kernel is the referee: a stat counts what it said (a point
 * and why, a serve and its faults, a ball out and its restart, a save, a mark), never a judgement of its own. Inlined
 * into each contest page (after its sim, before the broadcast client: scene/channels/contest.js) and run in Node alike,
 * so the same match counts the same everywhere.
 *
 *   contestStats(S, shape) → { shape, by, ids, rows: [{ id, words, short, unit, better, values: { <id>: n } }] }
 *     shape  match (a net game: by side) | team (a goal game: by side) | turns (by seat) | meet (by lane)
 *     by     side | seat | lane;  ids the sides, seats or lanes in order
 *     unit   n (a count) | pct (a share, 0 to 100; null with nothing to share, shown –) | kmh | s | m;  better high |
 *            low (which way the rows lean)
 *   STAT_ROWS                       each shape's rows, in the order a panel lists them
 *   statLine(stats, id, ids?)       → "Aces 3 · 1st serve 64%": a row or two for a lower third
 *   statFormat(row, v)              → the value as the broadcast shows it
 *
 * The rows by shape:
 *   match  points won, aces, double faults, 1st serve in, winners, errors, longest rally, fastest serve
 *   team   goals, shots (a kick the sim calls goalward: at the goal from the attacking half, or any goal or save), on
 *          target, possession (the time since each side's last kick, play live), passes (to a team-mate), corners,
 *          fouls, offsides, saves
 *   turns  strokes: to par, putts, fairways, greens in regulation, penalties; pins: pinfall, strikes, spares, opens,
 *          ball speed
 *   meet   time, place; hurdles: hurdles hit; a jump: best, fouls, run-up
 * A row the sport cannot have (a hurdle in a sprint) is left out. Pure: no dice, no clock; absent, nothing reads it.
 */

const ST_ROWS = {
  match: [
    ['points', 'points won', 'pts', 'n', 'high'], ['aces', 'aces', 'aces', 'n', 'high'], ['doubles', 'double faults', 'DF', 'n', 'low'],
    ['firstIn', '1st serve in', '1st in', 'pct', 'high'], ['winners', 'winners', 'win', 'n', 'high'], ['errors', 'errors', 'err', 'n', 'low'],
    ['rally', 'longest rally', 'rally', 'n', 'high'], ['serve', 'fastest serve', 'serve', 'kmh', 'high'],
  ],
  team: [
    ['goals', 'goals', 'G', 'n', 'high'], ['shots', 'shots', 'shots', 'n', 'high'], ['onTarget', 'on target', 'on tgt', 'n', 'high'],
    ['possession', 'possession', 'poss', 'pct', 'high'], ['passes', 'passes', 'pass', 'n', 'high'], ['corners', 'corners', 'cnr', 'n', 'high'],
    ['fouls', 'fouls', 'fouls', 'n', 'low'], ['offsides', 'offsides', 'off', 'n', 'low'], ['saves', 'saves', 'saves', 'n', 'high'],
  ],
  strokes: [
    ['strokes', 'strokes', 'strk', 'n', 'low'], ['toPar', 'to par', 'par', 'n', 'low'], ['putts', 'putts', 'putts', 'n', 'low'],
    ['fairways', 'fairways', 'fwy', 'n', 'high'], ['greens', 'greens in regulation', 'GIR', 'n', 'high'], ['penalties', 'penalties', 'pen', 'n', 'low'],
  ],
  pins: [
    ['pinfall', 'pinfall', 'pins', 'n', 'high'], ['strikes', 'strikes', 'X', 'n', 'high'], ['spares', 'spares', '/', 'n', 'high'],
    ['opens', 'open frames', 'open', 'n', 'low'], ['speed', 'ball speed', 'speed', 'kmh', 'high'],
  ],
  race: [['time', 'time', 'time', 's', 'low'], ['place', 'place', 'pl', 'n', 'low'], ['clips', 'hurdles hit', 'hit', 'n', 'low']],
  jump: [['best', 'best jump', 'best', 'm', 'high'], ['place', 'place', 'pl', 'n', 'low'], ['fouls', 'fouls', 'fouls', 'n', 'low'], ['runup', 'run-up speed', 'run-up', 'kmh', 'high']],
};
export const STAT_ROWS = Object.freeze(Object.fromEntries(Object.entries(ST_ROWS).map(([k, rows]) => [k, Object.freeze(rows.map(([id, words, short, unit, better]) => Object.freeze({ id, words, short, unit, better })))])));

const stSide = (who) => (typeof who === 'string' ? who[0] : null);
const stKmh = (v) => Math.round(v * 3.6);
const stPct = (n, d) => (d > 0 ? Math.round((100 * n) / d) : null);   // (no attempts: no share, shown as –)

/** The rows of a shape as stats, each id's value set (a missing value is 0). */
const stTable = (kind, ids, values, keep = null) => STAT_ROWS[kind].filter((r) => !keep || keep.includes(r.id)).map((r) => ({ ...r, values: Object.fromEntries(ids.map((id) => [id, values[r.id] && id in values[r.id] ? values[r.id][id] : 0])) }));

function stMatch(S) {
  const ids = ['a', 'b'], v = {}, add = (row, id, n = 1) => { v[row] ??= {}; v[row][id] = (v[row][id] ?? 0) + n; }, max = (row, id, n) => { v[row] ??= {}; v[row][id] = Math.max(v[row][id] ?? 0, n); };
  let server = null, hits = [], firsts = { a: 0, b: 0 }, firstFaults = { a: 0, b: 0 };
  S.calls.forEach((c, i) => {
    // (the serve's own stroke is the hit just before its call, whatever the card names the stroke: it opens the rally
    // and its speed is the serve's)
    if (c.kind === 'serve') {
      server = stSide(c.who); const struck = S.calls[i - 1]?.kind === 'hit' && stSide(S.calls[i - 1].who) === server ? S.calls[i - 1] : null;
      hits = struck ? [server] : []; if (struck) max('serve', server, stKmh(struck.speed)); if (c.faults === 0) firsts[server] += 1;
    }
    else if (c.kind === 'fault') { if (c.faults === 1) firstFaults[c.side] += 1; hits = []; }
    else if (c.kind === 'hit') hits.push(stSide(c.who));
    else if (c.kind === 'point') {
      add('points', c.side);
      const loser = c.side === 'a' ? 'b' : 'a', last = hits[hits.length - 1] ?? null;
      max('rally', c.side, hits.length); max('rally', loser, hits.length);
      if (c.why === 'double-fault') add('doubles', loser);
      else if (server && c.side === server && !hits.includes(loser)) add('aces', server);
      else if (last === c.side && (c.why === 'double-bounce' || c.why === 'down' || c.why === 'own-side')) add('winners', c.side);
      else if (last === loser && (c.why === 'out' || c.why === 'net' || c.why === 'own-side')) add('errors', loser);
      hits = [];
    }
  });
  for (const id of ids) { v.firstIn ??= {}; v.firstIn[id] = stPct(firsts[id] - firstFaults[id], firsts[id]); }
  return { shape: 'match', by: 'side', ids, rows: stTable('match', ids, v) };
}

function stTeam(S) {
  const ids = ['a', 'b'], v = {}, add = (row, id, n = 1) => { if (!id) return; v[row] ??= {}; v[row][id] = (v[row][id] ?? 0) + n; };
  const held = { a: 0, b: 0 };
  let side = null, since = 0, lastKick = null;
  const close = (f) => { if (side) held[side] += f - since; side = null; since = f; lastKick = null; };
  // a goal or a save is a shot on target, whatever the kick's power (counted a shot once)
  const onTarget = (shooter) => { add('onTarget', shooter); if (!(lastKick && lastKick.side === shooter && lastKick.shot)) add('shots', shooter); };
  for (const c of S.calls) {
    if (c.kind === 'kick') {
      const s = stSide(c.who), shot = c.goalward === true;
      if (side) held[side] += c.f - since;
      // a pass a team-mate receives (the ball's next kick its own side's, another player's, play still live)
      if (lastKick && !lastKick.shot && lastKick.side === s && lastKick.who !== c.who) add('passes', s);
      if (shot) add('shots', s);
      side = s; since = c.f; lastKick = { side: s, who: c.who, shot };
    } else if (c.kind === 'save') {
      const keeper = stSide(c.who); add('saves', keeper); onTarget(keeper === 'a' ? 'b' : 'a'); lastKick = null;
    } else if (c.kind === 'score') {
      add('goals', c.side); onTarget(c.side); close(c.f);
    } else if (c.kind === 'out') {
      if (c.restart?.kind === 'corner') add('corners', c.restart.side);
      close(c.f);
    } else if (c.kind === 'foul') {
      add('fouls', c.side); if (c.foul === 'offside') add('offsides', c.side); close(c.f);
    } else if (c.kind === 'period' || c.kind === 'over') close(c.f);
    else if (c.kind === 'live') { side = null; since = c.f; }
  }
  const total = held.a + held.b;
  for (const id of ids) { v.possession ??= {}; v.possession[id] = stPct(held[id], total); }
  return { shape: 'team', by: 'side', ids, rows: stTable('team', ids, v) };
}

function stTurns(S) {
  const pins = S.K?.kind === 'pins' || S.calls.some((c) => c.kind === 'roll');
  const ids = [...new Set([...Object.keys(S.K?.cards ?? S.K?.totals ?? {}), ...S.calls.filter((c) => c.who).map((c) => c.who)])].sort();
  const v = {}, add = (row, id, n = 1) => { v[row] ??= {}; v[row][id] = (v[row][id] ?? 0) + n; };
  if (pins) {
    const speeds = {}, frames = {};
    for (const c of S.calls) {
      if (c.kind === 'hit' && c.verb === 'roll') (speeds[c.who] ??= []).push(c.speed);
      if (c.kind === 'roll') {
        add('pinfall', c.who, c.down);
        if (c.mark === 'strike') add('strikes', c.who); else if (c.mark === 'spare') add('spares', c.who);
        const F = (frames[c.who] ??= {}); F[c.round] = F[c.round] || !!c.mark;
      }
    }
    for (const id of ids) {
      v.opens ??= {}; v.opens[id] = Object.values(frames[id] ?? {}).filter((m) => !m).length;
      const s = speeds[id] ?? []; v.speed ??= {}; v.speed[id] = s.length ? stKmh(s.reduce((a, b) => a + b, 0) / s.length) : 0;
    }
    return { shape: 'turns', by: 'seat', ids, rows: stTable('pins', ids, v) };
  }
  const shots = {}, hole = {};   // per seat per hole: the shots taken and the lies; the hole each seat is on (a lie names none)
  const at = (who, round) => ((shots[who] ??= {})[round] ??= { n: 0, lies: [] });
  for (const c of S.calls) {
    if (c.kind === 'hit' && c.verb === 'putt') add('putts', c.who);
    if (c.kind === 'shot') { hole[c.who] = c.round; at(c.who, c.round).n = c.shot; }
    if (c.kind === 'lie') { const H = at(c.who, hole[c.who]); H.lies.push({ region: c.region, after: H.n }); }
    if (c.kind === 'penalty') add('penalties', c.who);
    if (c.kind === 'holed') {
      add('strokes', c.who, c.strokes); add('toPar', c.who, c.toPar ?? 0);
      const H = shots[c.who]?.[c.round];
      if (H) {
        if (H.lies[0]?.region === 'fairway') add('fairways', c.who);
        // on the green in regulation: on it (or in) by the par's shots less the two putts
        const by = Math.max(1, (c.par ?? 3) - 2), green = H.lies.find((l) => l.region === 'green');
        if ((green && green.after <= by) || c.strokes <= by) add('greens', c.who);
      }
    }
  }
  return { shape: 'turns', by: 'seat', ids, rows: stTable('strokes', ids, v) };
}

function stMeet(S) {
  const ids = (S.r ?? []).map((r) => r.id), v = {}, add = (row, id, n = 1) => { v[row] ??= {}; v[row][id] = (v[row][id] ?? 0) + n; }, max = (row, id, n) => { v[row] ??= {}; v[row][id] = Math.max(v[row][id] ?? 0, n); };
  const jump = S.calls.some((c) => c.kind === 'mark' || c.kind === 'takeoff'), hurdles = S.calls.some((c) => c.kind === 'hop' || c.kind === 'clip');
  for (const c of S.calls) {
    if (c.kind === 'finish') { v.time ??= {}; v.time[c.who] = Math.round(c.t * 100) / 100; }
    if (c.kind === 'clip') add('clips', c.who);
    if (c.kind === 'mark') { if (c.foul) add('fouls', c.who); else max('best', c.who, Math.round(c.value * 100) / 100); }
    if (c.kind === 'takeoff') max('runup', c.who, stKmh(c.v));
    if (c.kind === 'over' && Array.isArray(c.placings)) for (const p of c.placings) if (p.place) { v.place ??= {}; v.place[p.who] = p.place; }
  }
  const kind = jump ? 'jump' : 'race', keep = jump ? null : hurdles ? null : ['time', 'place'];
  return { shape: 'meet', by: 'lane', ids, rows: stTable(kind, ids, v, keep) };
}

export function contestStats(S, shape) {
  if (shape === 'match') return stMatch(S);
  if (shape === 'team') return stTeam(S);
  if (shape === 'turns') return stTurns(S);
  if (shape === 'meet') return stMeet(S);
  throw new Error(`contest stats: no shape '${shape}' (match, team, turns, meet)`);
}

/** A value as the broadcast shows it. */
export function statFormat(row, v) {
  if (v === null || v === undefined) return '–';
  if (row.unit === 'pct') return `${v}%`;
  if (row.unit === 'kmh') return v ? `${v} km/h` : '–';
  if (row.unit === 's') return v ? v.toFixed(2) : '–';
  if (row.unit === 'm') return v ? `${v.toFixed(2)} m` : '–';
  if (row.id === 'toPar') return v === 0 ? 'E' : v > 0 ? `+${v}` : String(v);
  return String(v);
}

/** One id's rows as a lower third's line: "aces 3 · 1st serve in 64%". */
export function statLine(stats, id, rowIds) {
  const rows = rowIds ? rowIds.map((r) => stats.rows.find((x) => x.id === r)).filter(Boolean) : stats.rows.slice(0, 2);
  return rows.map((r) => `${r.words} ${statFormat(r, r.values[id] ?? 0)}`).join(' · ');
}


/** A stats panel's rows (the broadcast's tvPanel): each row asked for that the sport has, its values formatted, the lead
 * (the one best value, by the row's lean) marked; `cols` the places' { name, color } in the stats' order. */
export function statPanel(stats, rowIds, cols, title) {
  const rows = (rowIds || []).map((id) => stats.rows.find((r) => r.id === id)).filter(Boolean).map((r) => {
    const vals = stats.ids.map((id) => r.values[id]), nums = vals.filter((x) => typeof x === 'number');
    const best = r.better === 'low' ? Math.min(...nums) : Math.max(...nums);
    const lead = nums.length > 1 && nums.filter((x) => x === best).length === 1 && nums.some((x) => x !== 0) ? vals.indexOf(best) : null;
    return { words: r.words, cells: vals.map((x) => statFormat(r, x)), lead };
  });
  return { title, cols, rows };
}

/** The stats as a level's outcome carries them: { <row id>: { <id>: n } }. */
export function statCompact(stats) {
  return Object.fromEntries(stats.rows.map((r) => [r.id, { ...r.values }]));
}
