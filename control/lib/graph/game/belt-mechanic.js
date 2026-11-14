/**
 * THE BELT (a terminal): a beat 'em up's level. A way walked along and across, seen from the side, cut into SCREENS;
 * each screen HOLDS the player (and the side camera: the cast's `hold`, worlds/controllable/cast.js) between its marks
 * until its WAVES are down, then lets go as far as the next screen's end (GO), and the next screen begins when the
 * player walks into it. The last screen's clear is the win. The schedule is the wave gauntlet's (wave-gauntlet.js: foes
 * minted dormant and woken by the cast's spawn, a count of downs a wave, the next after a pause); what the belt adds is
 * the walk between: a hold a screen, and a screen begun by walking into it.
 *
 * Lowered onto the bus the other mechanics use (no runtime of its own beyond the hold).
 *   death        the belt owns the player's hp (`hp`, 100; `hits` a hit, 20): at none the screen begins again (its foes
 *                put away, its counts zeroed, hp full, the player put at the screen's start, its first wave after a
 *                pause); `death: 'fail'` ends the level instead
 *
 * Params:
 *   { id?: 'belt', axis?: [0, 1], across?: <half the way's width, 4>, screens: [{ from, to, waves: [{ foes: [{ id, at }],
 *     after? }], start?: [x, y, z] }], hp?, hits?, death?: 'screen' | 'fail' }
 *   `from`, `to`: a screen's marks along the way (metres on `axis`, +y unsaid), each screen's `from` the last one's `to`
 *   `start`: where a death puts the player back (unsaid: 1.5 m in from the screen's `from`, on the way's middle)
 *   a wave's `after` (s): its pause before its spawns (2; a screen's first wave 1.2)
 *
 *   beltWaves(p)            → [{ screen, wave, foes }] the waves in order, flat
 *   lowerBelt(p, ctx)       → { world, on, emits }   (game/mechanics.js registers it)
 *
 * What it says on the bus: `belt:screen` { n, of } a screen begun · `wave` { n, of, screen, screens } · `belt:clear`
 * { screen, of } · `belt:go` the way on is open · `belt:again` { screen } · `belt:won`. Vars: `hp`, `belt_screen` (1…),
 * `belt_left` (foes of this screen still to fall).
 *
 * The audit: none can fight, so a belt is not auto-auditable; its proof is on the bus with each fall given.
 *
 * Pure, no dice.
 */
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The waves in order, flat: each its screen's index, its own within the screen, and its foes ({ id, at }). */
export function beltWaves(p) {
  const out = [];
  (p.screens ?? []).forEach((S, s) => (S?.waves ?? []).forEach((W, w) => out.push({ screen: s, wave: w, after: W?.after, foes: (W?.foes ?? []).map((f) => (typeof f === 'string' ? { id: f } : f)) })));
  return out;
}

export function lowerBelt(p, ctx) {
  const where = `belt[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const id = p.id === undefined ? 'belt' : p.id;
  if (typeof id !== 'string' || !ID.test(id)) fail('id is the belt\'s name, lower-case');
  const S = p.screens;
  if (!Array.isArray(S) || !S.length) fail('needs screens: [{ from, to, waves: [{ foes: [{ id, at }] }] }], at least one');
  S.forEach((x, s) => {
    if (!x || !Number.isFinite(x.from) || !Number.isFinite(x.to) || !(x.to > x.from)) fail(`screens[${s}] needs from and to, its marks along the way, to past from`);
    if (s && Math.abs(x.from - S[s - 1].to) > 1e-6) fail(`screens[${s}].from is screens[${s - 1}].to: the screens follow one another`);
    if (!Array.isArray(x.waves) || !x.waves.length) fail(`screens[${s}] needs waves: [{ foes: [...] }], at least one`);
    if (x.start !== undefined && !isVec(x.start)) fail(`screens[${s}].start is [x, y, z]`);
  });
  const W = beltWaves(p), seen = new Set();
  for (const x of W) {
    if (!x.foes.length || x.foes.some((f) => !f || typeof f.id !== 'string' || !f.id || (f.at !== undefined && !isVec(f.at)))) fail(`screens[${x.screen}].waves[${x.wave}].foes is ['<entity id>' | { id, at: [x, y, z] }], at least one`);
    for (const f of x.foes) { if (seen.has(f.id)) fail(`'${f.id}' stands in two waves: a foe is woken once (name another)`); seen.add(f.id); }
  }
  const axis = p.axis === undefined ? [0, 1] : p.axis;
  if (!Array.isArray(axis) || axis.length !== 2 || !axis.every(Number.isFinite) || !Math.hypot(axis[0], axis[1])) fail('axis is [x, y], the way the belt runs');
  const al = Math.hypot(axis[0], axis[1]), ux = axis[0] / al, uy = axis[1] / al, across = Number.isFinite(p.across) && p.across > 0 ? p.across : 4;
  const death = p.death ?? 'screen';
  if (!['screen', 'fail'].includes(death)) fail("death is 'screen' (begin it again) or 'fail' (the level is lost)");
  const hp0 = Number.isFinite(p.hp) && p.hp > 0 ? p.hp : 100, hits = Number.isFinite(p.hits) && p.hits > 0 ? p.hits : 20;
  const N = S.length, pre = `__belt_${id}`, at = `${pre}_at`, open = `${pre}_open`, waveV = (k) => `${pre}_d${k}`;
  const waveE = (k) => `belt:wave:${id}:${k}`, clearedE = (k) => `${pre}:cleared:${k}`, enterE = (s) => `${pre}:enter:${s}`, wonE = 'belt:won';
  const hold = (lo, hi) => ({ do: 'ctrl', op: 'hold', lo, hi, axis: [ux, uy] });
  const world = { vars: { [at]: -1, [open]: 0, hp: hp0, belt_screen: 1, belt_left: 0 }, reactions: [], watches: [], sequences: [], hud: [], sources: [], initial: [{ type: enterE(0) }] };
  const firstOf = (s) => W.findIndex((x) => x.screen === s), countOf = (s) => W.filter((x) => x.screen === s).reduce((n, x) => n + x.foes.length, 0);
  const startOf = (s) => (S[s].start ? S[s].start.slice() : [r3((S[s].from + 1.5) * ux), r3((S[s].from + 1.5) * uy), 0]);

  S.forEach((x, s) => {
    // the screen begun: held between its marks, its foes counted, its first wave after a breath
    world.reactions.push({ on: enterE(s), do: 'set', var: at, to: s }, { on: enterE(s), do: 'set', var: 'belt_screen', to: s + 1 }, { on: enterE(s), do: 'set', var: 'belt_left', to: countOf(s) },
      { on: enterE(s), ...hold(x.from, x.to) }, { on: enterE(s), do: 'emit', type: 'belt:screen', n: s + 1, of: N });
    world.sequences.push({ id: `${pre}:begin:${s}`, trigger: { on: enterE(s) }, steps: [{ await: { timer: Number.isFinite(W[firstOf(s)].after) ? W[firstOf(s)].after : 1.2 } }, { do: 'emit', type: waveE(firstOf(s)) }] });
    // walked into (a screen after the first): begun once, when the one before is the one played
    if (s) {
      const zone = `${id}-in-${s}`, mid = (x.from + x.to) / 2 + 0.75, half = (x.to - x.from) / 2 - 0.75;
      world.sources.push({ type: 'zone', zone, at: [r3(mid * ux), r3(mid * uy), 0], half: [r3(Math.abs(ux) * half + Math.abs(uy) * (across + 2)), r3(Math.abs(uy) * half + Math.abs(ux) * (across + 2)), 6], planar: true, watch: ctx.player });
      // (two asks, one a reaction: the screen before is the one played, and it is cleared)
      world.reactions.push({ on: 'enter', match: { zone }, if: { var: at, eq: s - 1 }, do: 'emit', type: `${pre}:try:${s}` }, { on: `${pre}:try:${s}`, if: { var: open, gte: s }, do: 'emit', type: enterE(s) });
    }
  });
  W.forEach((x, k) => {
    world.vars[waveV(k)] = 0;
    const waves = S[x.screen].waves.length;
    world.reactions.push({ on: waveE(k), do: 'emit', type: 'wave', n: x.wave + 1, of: waves, screen: x.screen + 1, screens: N });
    for (const f of x.foes) {
      world.reactions.push({ on: waveE(k), do: 'ctrl', op: 'spawn', who: f.id, fresh: true, ...(f.at ? { at: f.at.slice() } : {}) });
      world.reactions.push({ on: 'down', match: { entity: f.id }, do: 'inc', var: waveV(k), by: 1 }, { on: 'down', match: { entity: f.id }, do: 'inc', var: 'belt_left', by: -1, min: 0 });
    }
    world.watches.push({ type: clearedE(k), when: { var: waveV(k), gte: x.foes.length } });
    const next = W[k + 1];
    if (next && next.screen === x.screen) {
      // (after the pause, only if it is still cleared: a death in the pause zeroed it, and the screen begins again instead)
      world.sequences.push({ id: `${pre}:next:${k}`, trigger: { on: clearedE(k) }, steps: [{ await: { timer: Number.isFinite(next.after) ? next.after : 2 } }, { do: 'emit', type: `${pre}:on:${k}` }] });
      world.reactions.push({ on: `${pre}:on:${k}`, if: { var: waveV(k), gte: x.foes.length }, do: 'emit', type: waveE(k + 1) });
    } else {
      // the screen's last wave down: said, and the way on opened as far as the next screen's end; the last screen's, the win
      world.reactions.push({ on: clearedE(k), do: 'set', var: open, to: x.screen + 1 }, { on: clearedE(k), do: 'emit', type: 'belt:clear', screen: x.screen + 1, of: N });
      if (next) world.reactions.push({ on: clearedE(k), ...hold(S[x.screen].from, S[x.screen + 1].to) }, { on: clearedE(k), do: 'emit', type: 'belt:go' });
      else world.reactions.push({ on: clearedE(k), do: 'ctrl', op: 'hold' }, { on: clearedE(k), do: 'emit', type: wonE });
    }
  });
  // death: the belt's own hp, a hit's cost; at none, the screen begins again, or the level is lost
  world.reactions.push({ on: `hit:${ctx.player}`, do: 'inc', var: 'hp', by: -hits, min: 0 });
  world.watches.push({ type: `${pre}:fell`, when: { var: 'hp', lte: 0 } });
  const out = { world, on: { [wonE]: { end: 'success' } }, emits: [wonE, 'wave', 'belt:go', 'belt:clear', 'belt:screen'] };
  if (death === 'fail') out.on[`${pre}:fell`] = { end: 'fail' };
  else {
    for (let s = 0; s < N; s++) {
      const back = `${pre}:back:${s}`;
      world.reactions.push({ on: `${pre}:fell`, if: { var: at, eq: s }, do: 'emit', type: back });
      W.forEach((x, k) => {
        if (x.screen !== s) return;
        for (const f of x.foes) world.reactions.push({ on: back, do: 'ctrl', op: 'vanish', who: f.id });
        world.reactions.push({ on: back, do: 'set', var: waveV(k), to: 0 });
      });
      world.reactions.push({ on: back, do: 'set', var: 'hp', to: hp0 }, { on: back, do: 'set', var: 'belt_left', to: countOf(s) }, { on: back, ...hold(S[s].from, S[s].to) },
        { on: back, do: 'move', target: ctx.player, to: startOf(s) }, { on: back, do: 'emit', type: 'belt:again', screen: s + 1 });
      world.sequences.push({ id: `${pre}:again:${s}`, trigger: { on: back }, steps: [{ await: { timer: 2 } }, { do: 'emit', type: waveE(firstOf(s)) }] });
    }
  }
  world.hud.push(
    { var: 'hp', label: 'HP', as: 'bar', max: hp0 },
    ...(N > 1 ? [{ var: 'belt_screen', label: `of ${N}`, as: 'counter', slot: 'top' }] : []),
    { var: 'belt_left', label: 'left', as: 'counter', slot: 'top-right' },
    { on: 'belt:go', text: 'GO', ttl: 1.6 },
    { on: 'belt:again', text: 'again', as: 'toast', ttl: 2, color: 'harm' },
  );
  if (!world.sources.length) delete world.sources;
  return out;
}
