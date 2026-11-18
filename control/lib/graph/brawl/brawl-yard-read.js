/**
 * brawl yard read — the yard's readouts as its HUD reads them (brawl-yard.js's spec): the page's half of the yard's
 * screen, inlined on the page as it is (no imports).
 *
 *   yardHud(read, F, project, inputs?)   → the `brawl.practice` state (brawl-yard.js says what each part is)
 *   inputRun(runs, buttons)              → the input strip's runs after a frame's buttons
 *   streetHud(room, names)               → what a street's screen reads beside the clinch and the gun (brawl-yard.js
 *                                          streetSpec): `party` each player's name and health, `street` the stop they are
 *                                          at of how many, its name and the falls left, `boss` the boss while it stands
 *   streetMoments(moments, events, stops) → the moments after a frame's events: a stop's name as its wave comes in, GO
 *                                          as it clears (the street is open), the boss's name as it comes in; the last
 *                                          few kept (`stops`: each wave's name, by its order)
 *
 * Pure: no clock, no dice.
 */
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const PRESS = { fire: 'A', grenade: 'S', attack: 'A', strong: 'St', jump: 'J', special: 'S', 'attack + jump': 'A+J', 'attack + special': 'A+S', 'jump + special': 'J+S', 'attack + strong': 'A+St', 'strong + jump': 'St+J', 'strong + special': 'St+S' };
const nameOf = (slot) => (slot === 'desperate' ? 'Desperation' : slot.split('.').map(cap).join(' '));
// the strong blows by what they do (the blow's own name beside it)
const STRONG_WORDS = { strong: 'Strong', 'strong.break': 'Breaker', 'strong.out': 'Blowout', 'strong.air': 'Stomp', 'strong.dive': 'Dive kick', 'run.attack': 'Running' };
const ENDS = { finisher: 'Finisher', breaker: 'Breaker', blowout: 'Blowout' };
/** the chain's blows by name, from its style (brawl-moves.js keeps each blow's source on the move's own `id`) */
const blowName = (slot, F) => {
  const m = F.moves[slot];
  if (!m) return cap(String(slot).replace(/-/g, ' '));
  if (m && (slot.startsWith('chain.') || slot.startsWith('air.'))) return cap(String(m.id ?? 'blow').replace(/-/g, ' '));
  if (m && STRONG_WORDS[slot]) return `${STRONG_WORDS[slot]}: ${cap(String(m.id ?? 'blow').replace(/-/g, ' '))}`;
  return nameOf(slot);
};

/** The `brawl.practice` state the yard's HUD reads, from the room's readouts (yardRead), the player's fighter and the
 * page's camera. */
export function yardHud(read, F, project, inputs = []) {
  const n = read.chain.of, landed = read.chain.now.length ? read.chain.now : read.chain.last?.steps ?? [];
  const marks = read.line.filter((d) => !d.ko).map((d) => {
    const [x, y] = project(d.at[0], d.at[1], 0);
    // (on the range a round's line: on it or not, never a blow's reach)
    const on = read.gun ? 'ON THE LINE' : d.inReach ? 'LINED' : 'LINED · CLOSER';
    // (and on the range how near it is to flinching: its stagger against its poise)
    const st = read.gun && d.stagger ? ` · STAGGER ${Math.min(100, d.stagger)}%` : '';
    return { id: `d${d.id}`, x, y, text: `${d.lined ? on : `${d.dz > 0 ? '+' : '−'}${Math.round(Math.abs(d.dz) / 10)} CM`}${st}`, kind: d.lined ? 'heal' : 'miss' };
  });
  const heads = read.line.filter((d) => d.token && !d.ko).map((d) => { const [x, y] = project(d.at[0], d.at[1], 2100); return { id: `t${d.id}`, x, y }; });
  const last = read.chain.last;
  const ended = read.chain.now.length ? '' : !last ? '' : ENDS[last.end] ? `${last.open ? 'Strong opener, ' : ''}${ENDS[last.end]}` : `Dropped: ${last.why}`;
  const presses = read.log.slice(-6).map((e) => ({
    press: PRESS[e.words] ?? e.words,
    // (taken: the move, and how many frames the press waited for the body, held through a hitstop or a recovery)
    verdict: e.verdict === 'taken' ? `${e.what ? blowName(e.what, F) : 'taken'}${e.late ? ` (+${e.late}f)` : ''}${e.note ? `: ${e.note}` : ''}` : `Dropped: ${e.why}`,
    kind: e.verdict === 'taken' ? 'heal' : 'miss',
  }));
  const c = read.clinch;
  // (the range's gun: its name, its rounds left (full when never out), the grenades, how the shooting is going)
  const g = read.gun;
  const gun = g
    ? { on: true, name: g.name ?? cap(g.id.replace(/-/g, ' ')), ammo: g.ammo ?? 1, of: g.of ?? 1, grenades: g.grenades, shots: `${g.landed} of ${g.fired} landed · ${g.damage} damage · struck ${g.struck}` }
    : { on: false, name: '', ammo: 0, of: 1, grenades: 0, shots: '' };
  // (the wave tester's wave: which, its shape, how many left and its clock (or the breath before it), the last clear)
  const W = read.wave, secs = (f) => `${(f / 60).toFixed(1)} s`, lastC = W && W.cleared.length ? W.cleared[W.cleared.length - 1] : null;
  const wave = W
    ? { on: true, n: W.n, of: W.of, name: cap(W.name), shape: `${W.formation} · ${W.pattern}`, left: W.state === 'on' ? `${W.left} left · ${secs(W.frames)}` : W.state === 'wait' ? `next in ${secs(W.next)}` : 'all cleared', last: lastC ? `wave ${lastC.k + 1} cleared in ${secs(lastC.frames)} · struck ${lastC.struck}` : '' }
    : { on: false, n: 0, of: 1, name: '', shape: '', left: '', last: '' };
  return {
    marks, heads, gun, wave, melee: !g,
    beats: Array.from({ length: n }, (_, k) => ({ value: String(k + 1), variant: landed.includes(k + 1) ? 'strong' : 'muted' })),
    ended, presses, inputs,
    clinch: c ? { left: c.left, of: c.of, knees: c.knees, behind: c.back ? 'Suplex' : '', holding: true } : { left: 0, of: 1, knees: 0, behind: '', holding: false },
  };
}

const ARROW = { '-1,-1': '↙', '0,-1': '↓', '1,-1': '↘', '-1,0': '←', '0,0': '•', '1,0': '→', '-1,1': '↖', '0,1': '↑', '1,1': '↗' };
/** The input strip after a frame: a run a direction and its buttons, extended while they stay the same. */
export function inputRun(runs, { x = 0, z = 0, a, h, j, s } = {}) {
  const dir = ARROW[`${Math.sign(x)},${Math.sign(z)}`], btn = [a && 'A', h && 'St', j && 'J', s && 'S'].filter(Boolean).join('+');
  const key = `${dir}${btn}`, last = runs[runs.length - 1];
  if (last && last.key === key) return [...runs.slice(0, -1), { ...last, n: last.n + 1, text: `${dir}${btn ? ` + ${btn}` : ''} (${last.n + 1}f)` }];
  if (key === '•' && !btn && last && last.key === '•') return runs;
  return [...runs, { key, n: 1, text: `${dir}${btn ? ` + ${btn}` : ''}` }].slice(-10);
}

/** What a street's screen reads from its room (a room of streetRoomOf: its sim, its mind, its stakes). */
export function streetHud(room, names = []) {
  const { s, yard, ctx, mind } = room, P = yard.players;
  const party = s.bodies.slice(0, P).map((p, i) => ({ name: names[i] ?? `P${i + 1}`, hp: Math.max(0, p.hp), hpMax: ctx.fighters[p.fi].hp }));
  const of = mind.waves.length, at = Math.min(of, mind.wave + 1);
  const bossId = Object.keys(mind.bosses ?? {}).map(Number).find((id) => !s.bodies[id].gone && !s.bodies[id].ko);
  const B = bossId === undefined ? null : s.bodies[bossId];
  return {
    party,
    street: { stop: at, of, name: mind.begun === mind.wave ? (yard.spec?.waves?.[mind.wave]?.name ?? '') : '', lives: Math.max(0, yard.stakes - yard.falls), livesMax: yard.stakes },
    boss: B ? { on: true, name: mind.bosses[bossId].name, hp: Math.max(0, B.hp), hpMax: yard.hp[bossId], phases: mind.bosses[bossId].stages ? mind.bosses[bossId].stages.length : 1, statuses: [] } : { on: false, name: '', hp: 0, hpMax: 1, phases: 1, statuses: [] },
  };
}

/** The moments after a frame's events (a street's banner): the last four kept, each its own id. */
export function streetMoments(moments, events, stops = []) {
  let out = moments, n = moments.length ? moments[moments.length - 1].n + 1 : 0;
  const add = (text, weight, sub) => { out = [...out, { id: `m${n}`, n: n++, text, weight, ...(sub ? { sub } : {}) }].slice(-4); };
  for (const e of events) {
    if (e.t === 'wave' && e.screen !== undefined) { const name = stops[e.screen]; if (name) add(name, 'minor'); }
    else if (e.t === 'boss') add(e.name, 'major');
    // (a boss's stage begun: its name, or which of how many)
    else if (e.t === 'bossStage') add(e.name ?? `STAGE ${e.k}`, 'major', `${e.k} / ${e.of}`);
    else if (e.t === 'stageClear') add('CLEAR', 'decisive');
    else if (e.t === 'cleared') add('GO', 'normal');
  }
  return out;
}
