/**
 * A LEVEL HELD AS A WAVE GAUNTLET (a level's `goal: { gauntlet }`, world.js): the level's last stage an arena sealed
 * until every wave is down (the wave-gauntlet mechanic, game/wave-gauntlet.js). Static: every arena in one place, back
 * to back (the elevator fight, the arena lock, a Bloody Palace). Its foes are the bestiary's, by id and count a wave; each
 * is stood dormant in a ring round the arena (gauntlet-cast.js stands them, by the same placements) and woken with its
 * wave. The arena stands on the approach to the stage's exit, which is its sealed way out.
 *
 *   goal: { gauntlet: { arenas: [{ waves: [{ <bestiary id>: <count> }], after? }], checkpoint?, pace?, every?, outlast? } }
 *   to overcome (the default: each wave when the last is down, a death the arena again) or to endure (`pace: 'timed'`,
 *   a wave each `every` seconds whatever stands; `outlast`: seconds to hold out; a death fails it)
 *
 *   GAUNTLET_LIMITS              the most arenas, waves an arena and foes a wave
 *   DEFAULT_GAUNTLET             the one a prompt's word (horde, onslaught) lays; DEFAULT_HOLDOUT the holdout's (holdout)
 *   GAUNTLET_LAWS, gauntletLaws(E)   its principles, measured (advice: escalates, breathes, varied, checkpointed)
 *   readGauntletGoal(v, room, ids) → { arenas: [{ waves: [{ <id>: n }], after? }], checkpoint?, room }   ids: the bestiary's
 *   gauntletIds(G)                the bestiary ids any level's gauntlet wakes (they are fielded, so they are made)
 *   gauntletPlacements(E, ends)   → { centre, waves: [[{ id, eid, at, heading }]] }   each foe `foe-<eid>-g<n>`
 *   gauntletMechanic(E, ends)     → the wave-gauntlet mechanic laid on a stage's ends
 *
 * Pure, no dice.
 */

export const GAUNTLET_LIMITS = Object.freeze({ arenas: 100, waves: 8, foes: 12 });
/** The holdout a prompt's word asks for (compose.js): one arena, its waves on a clock, ninety seconds to outlast. */
export const DEFAULT_HOLDOUT = Object.freeze({ arenas: [{ waves: [{ walker: 3 }, { walker: 3, charger: 1 }, { walker: 3, charger: 2 }, { walker: 4, charger: 2, brute: 1 }] }], pace: 'timed', every: 20, outlast: 90 });
/** The gauntlet a prompt's word asks for (compose.js): two arenas of the class bestiary's foes, each heavier. */
export const DEFAULT_GAUNTLET = Object.freeze({ arenas: [{ waves: [{ walker: 3 }, { walker: 2, charger: 1 }] }, { waves: [{ walker: 2, charger: 2 }, { walker: 3, brute: 1 }] }] });
const r3 = (n) => Math.round(n * 1000) / 1000;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A level goal's `gauntlet`, read (`ids`: the bestiary's ids, to check a wave's foes by). */
export function readGauntletGoal(v, room, ids) {
  const no = (m) => { throw new Error(`goal.gauntlet${m}`); };
  if (!isObj(v)) no(' is { arenas: [{ waves: [{ <foe id>: <count> }] }], checkpoint? }');
  for (const k of Object.keys(v)) if (!['arenas', 'checkpoint', 'pace', 'every', 'outlast', 'room'].includes(k)) no(`.${k} is not a gauntlet setting (arenas, checkpoint, pace, every, outlast)`);
  // to endure: timed waves (each `every` seconds, whatever stands) and a clock to outlast
  if (v.pace !== undefined && !['clear', 'timed'].includes(v.pace)) no(".pace is 'clear' (each wave when the last is down) or 'timed' (each wave on the clock)");
  if (v.every !== undefined && !(Number.isFinite(v.every) && v.every > 0)) no('.every is the seconds between timed waves, above 0');
  if (v.outlast !== undefined && !(Number.isFinite(v.outlast) && v.outlast > 0)) no('.outlast is the seconds to hold out, above 0');
  if (v.checkpoint !== undefined && (v.pace === 'timed' || v.outlast !== undefined)) no(': a gauntlet to endure fails on a death, so it has no checkpoints');
  if (v.room !== undefined && v.room !== room) no('.room is the level\'s own');
  if (!Array.isArray(v.arenas) || !v.arenas.length || v.arenas.length > GAUNTLET_LIMITS.arenas) no(`.arenas is a list of arenas, 1 to ${GAUNTLET_LIMITS.arenas}`);
  const arenas = v.arenas.map((A, a) => {
    if (!isObj(A) || Object.keys(A).some((k) => !['waves', 'after'].includes(k))) no(`.arenas[${a}] is { waves, after? }`);
    if (!Array.isArray(A.waves) || !A.waves.length || A.waves.length > GAUNTLET_LIMITS.waves) no(`.arenas[${a}].waves is a list of waves, 1 to ${GAUNTLET_LIMITS.waves}`);
    if (A.after !== undefined && !(Number.isFinite(A.after) && A.after >= 0)) no(`.arenas[${a}].after is the seconds before it, 0 or more`);
    const waves = A.waves.map((W, w) => {
      if (!isObj(W) || !Object.keys(W).length) no(`.arenas[${a}].waves[${w}] is { <foe id>: <count> }, at least one`);
      let n = 0;
      for (const [id, c] of Object.entries(W)) {
        if (ids && !ids.includes(id)) no(`.arenas[${a}].waves[${w}]: '${id}' is not in the bestiary (${ids.join(', ')})`);
        if (!(Number.isInteger(c) && c >= 1)) no(`.arenas[${a}].waves[${w}].${id} is how many, from 1`);
        n += c;
      }
      if (n > GAUNTLET_LIMITS.foes) no(`.arenas[${a}].waves[${w}] wakes ${n}: at most ${GAUNTLET_LIMITS.foes} a wave`);
      return { ...W };
    });
    return { waves, ...(A.after !== undefined ? { after: A.after } : {}) };
  });
  if (v.checkpoint !== undefined && !(Number.isInteger(v.checkpoint) && v.checkpoint >= 1)) no('.checkpoint is every how many arenas, from 1');
  return { arenas, ...(v.checkpoint !== undefined ? { checkpoint: v.checkpoint } : {}), ...(v.pace !== undefined ? { pace: v.pace } : {}), ...(v.every !== undefined ? { every: v.every } : {}), ...(v.outlast !== undefined ? { outlast: v.outlast } : {}), room };
}

/** The bestiary ids every level's gauntlet wakes. */
export function gauntletIds(G) {
  const out = new Set();
  for (const id of G.ids ?? []) for (const A of G.levels[id]?.goal?.gauntlet?.arenas ?? []) for (const W of A.waves) for (const eid of Object.keys(W)) out.add(eid);
  return [...out];
}

/** Where each foe of each wave stands: in a ring round the arena's centre (on the approach to the exit, back toward the
 * last beat), each wave turned a little from the last, every foe facing in. Ids `foe-<eid>-g<n>`, counted a bestiary id. */
export function gauntletPlacements(E, ends) {
  const exit = ends.exit, along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead').map((b) => b.at);
  const last = along.at(-1) ?? ends.spawn, dx = last[0] - exit[0], dy = last[1] - exit[1], L = Math.hypot(dx, dy) || 1;
  const back = Math.min(10, L * 0.6), cx = r3(exit[0] + (dx / L) * back), cy = r3(exit[1] + (dy / L) * back);
  const ground = (x, y, fall) => { const z = ends.ground ? ends.ground(x, y) : null; return Number.isFinite(z) ? r3(z) : fall; };
  const centre = [cx, cy, ground(cx, cy, r3(exit[2] + ((last[2] - exit[2]) * back) / L))];
  const counts = {}, waves = [];
  let k = 0;
  for (const A of E.arenas) for (const W of A.waves) {
    const foes = Object.entries(W).flatMap(([eid, c]) => Array.from({ length: c }, () => eid)), n = foes.length;
    waves.push(foes.map((eid, j) => {
      counts[eid] = (counts[eid] ?? 0) + 1;
      const a = (2 * Math.PI * j) / n + k * 0.7, x = r3(cx + 6 * Math.cos(a)), y = r3(cy + 6 * Math.sin(a));
      return { id: `foe-${eid}-g${counts[eid]}`, eid, at: [x, y, ground(x, y, centre[2])], heading: r3(Math.atan2(cy - y, cx - x)) };
    }));
    k++;
  }
  return { centre, waves };
}

/** The wave-gauntlet mechanic on a stage: its arenas' waves of the placed foes, the exit its sealed way out, a walker
 * turned away and one begun again put at the arena's centre. */
export function gauntletMechanic(E, ends) {
  const P = gauntletPlacements(E, ends);
  let k = 0;
  const arenas = E.arenas.map((A) => ({ waves: A.waves.map(() => ({ foes: P.waves[k++].map((f) => ({ id: f.id, at: f.at })) })), ...(A.after !== undefined ? { after: A.after } : {}) }));
  return { kind: 'wave-gauntlet', id: E.room, arenas, at: ends.exit.slice(), radius: 2.5, back: P.centre, start: P.centre, ...(E.checkpoint ? { checkpoint: E.checkpoint } : {}), ...(E.pace ? { pace: E.pace } : {}), ...(E.every ? { every: E.every } : {}), ...(E.outlast ? { win: { outlast: E.outlast } } : {}) };
}

export const GAUNTLET_LAWS = Object.freeze({
  escalates: 'Escalates: no wave lighter than the one before it in its arena, no arena lighter than the last.',
  breathes: 'Breathes: a pause before each arena after the first, two seconds at least.',
  varied: 'Varied: no three arenas in a row with the same mix.',
  bounded: 'Bounded: a timed gauntlet never stands more than sixteen foes woken within half a minute of each other.',
  checkpointed: 'Checkpointed: a gauntlet of more than ten arenas has checkpoints.',
});
export const GAUNTLET_ALIVE = 16;
const law = (id, holds, says) => ({ law: id, holds, says });
const weight = (W) => Object.values(W).reduce((n, c) => n + c, 0);
const mix = (A) => JSON.stringify(A.waves.map((W) => Object.entries(W).sort()));

/** The principles, measured on a read gauntlet (advice, never refusals). */
export function gauntletLaws(E) {
  const out = [], A = E.arenas;
  const light = [];
  A.forEach((a, i) => a.waves.forEach((W, w) => { if (w && weight(W) < weight(a.waves[w - 1])) light.push(`arena ${i + 1} wave ${w + 1} (${weight(W)} after ${weight(a.waves[w - 1])})`); }));
  const total = (a) => a.waves.reduce((n, W) => n + weight(W), 0);
  A.forEach((a, i) => { if (i && total(a) < total(A[i - 1])) light.push(`arena ${i + 1} (${total(a)} after ${total(A[i - 1])})`); });
  out.push(law('escalates', !light.length, light.length ? `${light.join('; ')}: lighter than before` : 'every wave and every arena at least as heavy as the last'));
  const short = A.flatMap((a, i) => (i && a.after !== undefined && a.after < 2 ? [`arena ${i + 1} (${a.after} s)`] : []));
  out.push(law('breathes', !short.length, short.length ? `${short.join(', ')}: no breath before it` : 'a pause before every arena after the first'));
  const runs = [];
  for (let i = 2; i < A.length; i++) if (mix(A[i]) === mix(A[i - 1]) && mix(A[i]) === mix(A[i - 2])) runs.push(`arenas ${i - 1} to ${i + 1}`);
  out.push(law('varied', !runs.length, runs.length ? `${runs.join('; ')}: the same mix three times` : A.length < 3 ? 'too few arenas to repeat' : 'no three arenas in a row alike'));
  // bounded: timed waves stack; the most woken within any thirty seconds (none downed: the worst case) under the cap
  if (E.pace === 'timed') {
    const t = [], every = E.every ?? 20;
    let clock = 0;
    A.forEach((a) => a.waves.forEach((W, w) => { clock += t.length ? every : 1; t.push({ at: clock, n: weight(W) }); }));
    const peak = Math.max(...t.map((x) => t.filter((y) => y.at >= x.at && y.at < x.at + 30).reduce((n, y) => n + y.n, 0)));
    out.push(law('bounded', peak <= GAUNTLET_ALIVE, peak <= GAUNTLET_ALIVE ? `at most ${peak} woken within thirty seconds` : `${peak} woken within thirty seconds, over ${GAUNTLET_ALIVE}: space the waves (every) or thin them`));
  } else out.push(law('bounded', true, 'each wave waits for the last to be down: they never stack'));
  const long = A.length > 10 && !E.checkpoint && E.pace !== 'timed' && E.outlast === undefined;
  out.push(law('checkpointed', !long, long ? `${A.length} arenas and no checkpoint: a death sends the player back to arena 1` : E.checkpoint ? `a checkpoint every ${E.checkpoint}` : `${A.length} arena${A.length === 1 ? '' : 's'}: short enough to need none`));
  return out;
}
