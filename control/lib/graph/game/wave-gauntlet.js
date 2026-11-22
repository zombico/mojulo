/**
 * THE WAVE GAUNTLET (a terminal): sealed in until nothing is left alive. ARENAS one after another, each a sequence of
 * WAVES; a wave's foes (minted dormant, as `waves`' are) are woken by the cast's spawn, and the next wave comes only when
 * every foe of this one is down (the cast's `down`). N arenas × N waves: a static gauntlet runs its arenas back to back in
 * one place (the elevator fight, the arena lock, a Bloody Palace); a moving one sets them along the way (gameworld's).
 * Named `wave-gauntlet`, its rooms `arenas`: "gauntlet" alone is the armoured glove.
 *
 * Lowered onto the bus the other mechanics use (no runtime of its own): a counter of downs per wave and a watch on it, a
 * sequence per step on (a pause, then the next wave's spawns), the seal on the way out, its own hp for death's reset.
 *   the end      every wave of every arena down: `gauntlet:clear:<id>`. With `at` (the way out), the seal lifts and the
 *                way out wins (`gauntlet:out:<id>`; sealed, `gauntlet:sealed:<id>` and, given `back`, put back); without,
 *                the clear wins at once (the elevator: nowhere to walk to).
 *   death        the gauntlet owns the player's hp (`hp`, 100; `hits` a hit, 20): at none the arena begins again (its foes
 *                vanished, its counts zeroed, hp full, the player put at `start`, its first wave after a pause); with
 *                `checkpoint: N`, from the last arena passed that is a multiple of N (Bloody Palace's every ten);
 *                `death: 'fail'` ends the level instead (an endurance gauntlet's default).
 *
 * OVERCOME or ENDURE: the same schedule, two settings for what brings a wave and what ends it.
 *   pace         'clear' (each wave when the last is down: a blocker to overcome) or 'timed' (each wave `every` seconds,
 *                20, whatever stands: they stack, the pressure of a holdout; its death fails the level)
 *   win          'clear' (every wave down) or { outlast: <seconds> } (still standing when the clock runs out: horde mode,
 *                survive the night); the seal on the way out lifts at the win
 *   hold         '<entity id>': what must not fall (a generator, a payload, a gate): its `down` loses the level
 *
 * A FIGHT LAID IN A PLACE (gameroom/fight.js): two more settings, each absent adding nothing.
 *   an arena's `enter`   { at, radius? }: its first wave waits for the player to walk in (the fight's ring), not for a
 *                        clock; the first arena's waits from the start, a later one's from the clear before it
 *   seals                [{ at, radius?, back? }]: the other ways held while the gauntlet stands (the way back), each a
 *                        seal and a zone that turns a walker away (`gauntlet:held:<id>`, put `back`); they lift with the way out's
 *   an arena's `seals`   the same, held only while THAT arena stands: from its beginning (its `enter`, or its first
 *                        wave) to its last wave down. Fights along a level, each sealing its own room's doorways
 *   an arena's `start`   where a death in it puts the player (the gauntlet's `start` unsaid)
 *
 * Params:
 *   { id?: 'gauntlet', arenas: [{ waves: [{ foes: ['<entity id>' | { id, at }], after? }], after?, enter? }],
 *     at?, radius?, planar?, back?, start?, hp?, hits?, checkpoint?, death?: 'arena' | 'fail',
 *     pace?: 'clear' | 'timed', every?, win?: 'clear' | { outlast }, hold?, seals? }
 *   `after` (a wave's, s): its pause before its spawns (2; an arena's first wave the arena's `after`, 4; the very first 1)
 *   a foe `{ id, at }`: where it is spawned (a reset stands it there again); a bare id spawns where it stands
 *
 *   gauntletNames(id)           → { seal, exit }   the names it gives its things
 *   gauntletWaves(p)            → [{ arena, wave, foes }] the waves in order, flat
 *   lowerWaveGauntlet(p, ctx)   → { world, on, emits, audit? }   (game/mechanics.js registers it)
 *
 * The audit: none can fight (defeat-all's), so a gauntlet with no hand-named `audit` is not auto-auditable; its proof is
 * on the bus with each fall given (the gameworld's).
 *
 * Pure, no dice.
 */

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export const gauntletNames = (id) => ({ seal: `${id}-seal`, exit: `${id}-exit` });

/** The waves in order, flat: each its arena's index, its own within the arena, and its foes ({ id, at? }). */
export function gauntletWaves(p) {
  const out = [];
  (p.arenas ?? []).forEach((A, a) => (A?.waves ?? []).forEach((W, w) => out.push({ arena: a, wave: w, after: W?.after, arenaAfter: A?.after, foes: (W?.foes ?? []).map((f) => (typeof f === 'string' ? { id: f } : f)) })));
  return out;
}

export function lowerWaveGauntlet(p, ctx) {
  const where = `wave-gauntlet[${ctx.i}]`, fail = (m) => { throw new Error(`${where}: ${m}`); };
  const id = p.id === undefined ? 'gauntlet' : p.id;
  if (typeof id !== 'string' || !ID.test(id)) fail('id is the gauntlet\'s name, lower-case');
  if (!Array.isArray(p.arenas) || !p.arenas.length) fail('needs arenas: [{ waves: [{ foes: [\'<id>\', …] }] }], at least one');
  p.arenas.forEach((A, a) => { if (!A || !Array.isArray(A.waves) || !A.waves.length) fail(`arenas[${a}] needs waves: [{ foes: [...] }], at least one`); });
  const W = gauntletWaves(p);
  W.forEach((x) => {
    if (!x.foes.length || x.foes.some((f) => !f || typeof f.id !== 'string' || !f.id || (f.at !== undefined && !isVec(f.at)))) fail(`arenas[${x.arena}].waves[${x.wave}].foes is ['<entity id>' | { id, at: [x, y, z] }], at least one`);
  });
  const seen = new Set();
  for (const x of W) for (const f of x.foes) { if (seen.has(f.id)) fail(`'${f.id}' stands in two waves: a foe is woken once (name another)`); seen.add(f.id); }
  if (p.at !== undefined && !isVec(p.at)) fail('at is [x, y, z]: the way out it seals (none: the clear wins at once)');
  for (const k of ['back', 'start']) if (p[k] !== undefined && !isVec(p[k])) fail(`${k} is [x, y, z]`);
  const cp = p.checkpoint === undefined ? null : p.checkpoint;
  if (cp !== null && !(Number.isInteger(cp) && cp >= 1)) fail('checkpoint is every how many arenas a checkpoint stands, from 1');
  const pace = p.pace ?? 'clear';
  if (!['clear', 'timed'].includes(pace)) fail("pace is 'clear' (each wave when the last is down) or 'timed' (each wave `every` seconds)");
  const every = p.every === undefined ? 20 : p.every;
  if (!(Number.isFinite(every) && every > 0)) fail('every is the seconds between a timed gauntlet\'s waves, above 0');
  const win = p.win ?? 'clear', outlast = win === 'clear' ? null : win?.outlast;
  if (win !== 'clear' && !(win && Object.keys(win).join() === 'outlast' && Number.isFinite(outlast) && outlast > 0)) fail("win is 'clear' (every wave down) or { outlast: <seconds> } (still standing when the clock runs out)");
  if (p.hold !== undefined && !(typeof p.hold === 'string' && p.hold)) fail("hold is the id of what must not fall (a generator, a payload)");
  // a fight laid in a place: an arena entered, the other ways sealed
  const enters = p.arenas.map((A) => A.enter ?? null), entered = enters.some(Boolean);
  enters.forEach((e, a) => { if (e !== null && !(e && isVec(e.at) && (e.radius === undefined || (Number.isFinite(e.radius) && e.radius > 0)))) fail(`arenas[${a}].enter is { at: [x, y, z], radius? }: where the player walks in to begin it`); });
  if (entered && pace === 'timed') fail('a timed gauntlet\'s waves come on the clock: no arena waits to be entered');
  const sealsOk = (L) => Array.isArray(L) && !L.some((q) => !(q && isVec(q.at) && (q.back === undefined || isVec(q.back)) && (q.radius === undefined || (Number.isFinite(q.radius) && q.radius > 0))));
  p.arenas.forEach((A, a) => {
    if (A.seals !== undefined && !sealsOk(A.seals)) fail(`arenas[${a}].seals is [{ at: [x, y, z], radius?, back? }]: the ways held while it stands`);
    if (A.start !== undefined && !isVec(A.start)) fail(`arenas[${a}].start is [x, y, z]: where a death in it puts the player`);
  });
  const seals = p.seals === undefined ? [] : p.seals;
  if (!Array.isArray(seals) || seals.some((q) => !(q && isVec(q.at) && (q.back === undefined || isVec(q.back)) && (q.radius === undefined || (Number.isFinite(q.radius) && q.radius > 0))))) fail('seals is [{ at: [x, y, z], radius?, back? }]: the other ways held while it stands');
  const endure = pace === 'timed' || outlast !== null;
  const death = p.death ?? (endure ? 'fail' : 'arena');
  if (!['arena', 'fail'].includes(death)) fail("death is 'arena' (begin it again) or 'fail' (the level is lost)");
  if (pace === 'timed' && death === 'arena') fail("a timed gauntlet's waves keep coming: its death fails the level (death: 'fail')");
  const hp0 = Number.isFinite(p.hp) && p.hp > 0 ? p.hp : 100, hits = Number.isFinite(p.hits) && p.hits > 0 ? p.hits : 20;
  const N = gauntletNames(id), A = p.arenas.length, pre = `__wg_${id}`, at = `${pre}_arena`, waveV = (k) => `${pre}_d${k}`;
  const waveE = (k) => `gauntlet:wave:${id}:${k}`, clearedE = (k) => `${pre}:cleared:${k}`, clearE = `gauntlet:clear:${id}`;
  const world = { vars: { [at]: 0, [`${pre}_open`]: 0, [`${pre}_down`]: 0, hp: hp0 }, reactions: [], watches: [], sequences: [], hud: [], entities: [], sources: [], initial: [{ type: `${pre}:go` }] };
  const first = Number.isFinite(W[0].after) ? W[0].after : 1;
  // an arena ENTERED: `arm` names the arena waiting to be walked into (-1: none); its zone, armed, begins it
  const arm = `${pre}_arm`, inE = (a) => `${pre}:in:${a}`, firstOf = (a) => W.findIndex((x) => x.arena === a);
  if (entered) {
    world.vars[arm] = enters[0] ? 0 : -1;
    enters.forEach((e, a) => {
      if (!e) return;
      const zone = `${id}-enter-${a}`;
      world.sources.push({ type: 'zone', zone, at: e.at.slice(), radius: Number.isFinite(e.radius) ? e.radius : 3, planar: true, watch: ctx.player });
      world.reactions.push({ on: 'enter', match: { zone }, if: { var: arm, eq: a }, do: 'emit', type: inE(a) }, { on: inE(a), do: 'set', var: arm, to: -1 },
        { on: inE(a), do: 'emit', type: a ? waveE(firstOf(a)) : `${pre}:go` });
    });
    if (enters[0]) delete world.initial;
  }
  // the waves' clock: cleared-paced, the first after a breath (each next on its clear, below); timed, every wave on it
  if (pace === 'clear') world.sequences.push({ id: `${pre}:go`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: first } }, { do: 'emit', type: waveE(0) }] });
  else world.sequences.push({ id: `${pre}:go`, trigger: { on: `${pre}:go` }, steps: W.flatMap((x, k) => [{ await: { timer: k ? (Number.isFinite(x.after) ? x.after : every) : first } }, { do: 'emit', type: waveE(k) }]) });
  const total = W.reduce((n, x) => n + x.foes.length, 0);
  W.forEach((x, k) => {
    world.vars[waveV(k)] = 0;
    // the wave: its arena said, its foes woken (where it names them), its count of downs
    world.reactions.push({ on: waveE(k), do: 'set', var: at, to: x.arena });
    world.reactions.push({ on: waveE(k), do: 'emit', type: 'wave', n: x.wave + 1, of: p.arenas[x.arena].waves.length, arena: x.arena + 1, arenas: A });
    for (const f of x.foes) {
      world.reactions.push({ on: waveE(k), do: 'ctrl', op: 'spawn', who: f.id, fresh: true, ...(f.at ? { at: f.at.slice() } : {}) });
      world.reactions.push({ on: 'down', match: { entity: f.id }, do: 'inc', var: waveV(k), by: 1 }, { on: 'down', match: { entity: f.id }, do: 'inc', var: `${pre}_down`, by: 1 });
    }
    world.watches.push({ type: clearedE(k), when: { var: waveV(k), gte: x.foes.length } });
    // cleared: the next wave after a pause (an arena's first after the arena's), or the gauntlet's end
    const next = W[k + 1];
    if (pace === 'timed') { if (next && next.arena !== x.arena) world.reactions.push({ on: waveE(k + 1), do: 'emit', type: 'gauntlet:arena', arena: x.arena + 1, of: A }); return; }
    if (next) {
      const pause = next.arena !== x.arena ? (Number.isFinite(next.after) ? next.after : Number.isFinite(next.arenaAfter) ? next.arenaAfter : 4) : (Number.isFinite(next.after) ? next.after : 2);
      if (next.arena !== x.arena) world.reactions.push({ on: clearedE(k), do: 'emit', type: 'gauntlet:arena', arena: x.arena + 1, of: A });
      // (after the pause, only if it is still cleared: a death in the pause zeroed it, and the arena begins again instead)
      world.sequences.push({ id: `${pre}:next:${k}`, trigger: { on: clearedE(k) }, steps: [{ await: { timer: pause } }, { do: 'emit', type: `${pre}:on:${k}` }] });
      // (the next arena entered: it is armed, and its zone brings its first wave)
      // (armed at the clear, with no pause: the walk to it is the breath, and a player already on the way is not missed)
      if (next.arena !== x.arena && enters[next.arena]) world.reactions.push({ on: clearedE(k), do: 'set', var: arm, to: next.arena });
      else world.reactions.push({ on: `${pre}:on:${k}`, if: { var: waveV(k), gte: x.foes.length }, do: 'emit', type: waveE(k + 1) });
    } else world.reactions.push({ on: clearedE(k), do: 'emit', type: clearE });
  });
  // timed: cleared when every foe of every wave is down (waves overlap; no one wave's clear is the end)
  if (pace === 'timed') world.watches.push({ type: clearE, when: { var: `${pre}_down`, gte: total } });
  // outlast: a clock down from its seconds, the win when it runs out (survive's)
  const outlastE = `gauntlet:outlasted:${id}`, left = `${pre}_left`, endE = outlast !== null ? outlastE : clearE;
  if (outlast !== null) {
    world.vars[left] = outlast;
    world.timers = [{ every: 1, emit: { type: `${pre}:tick` }, while: { var: left, gt: 0 } }];
    world.reactions.push({ on: `${pre}:tick`, do: 'inc', var: left, by: -1, min: 0 });
    world.watches.push({ type: outlastE, when: { var: left, lte: 0 } });
    world.hud.push({ var: left, label: 'Hold out', as: 'counter' });
  }
  // hold: what must not fall; its fall loses the level
  if (p.hold) world.reactions.push({ on: 'down', match: { entity: p.hold }, do: 'emit', type: `gauntlet:fallen:${id}`, what: p.hold });
  // death: the gauntlet's own hp, a hit's cost; at none, the arena (or its checkpoint) begins again, or the level is lost
  world.reactions.push({ on: `hit:${ctx.player}`, do: 'inc', var: 'hp', by: -hits, min: 0 });
  world.watches.push({ type: `${pre}:fell`, when: { var: 'hp', lte: 0 } });
  const out = { world, on: { ...(p.hold ? { [`gauntlet:fallen:${id}`]: { end: 'fail' } } : {}) }, emits: [clearE, 'wave'] };
  if (death === 'fail') out.on[`${pre}:fell`] = { end: 'fail' };
  else {
    for (let a = 0; a < A; a++) {
      const from = cp ? Math.floor(a / cp) * cp : a, first = W.findIndex((x) => x.arena === from), back = `${pre}:back:${a}`;
      world.reactions.push({ on: `${pre}:fell`, if: { var: at, eq: a }, do: 'emit', type: back });
      // every wave from the checkpoint's arena to this one: its foes put away, its count zeroed
      W.forEach((x, k) => {
        if (x.arena < from || x.arena > a) return;
        for (const f of x.foes) world.reactions.push({ on: back, do: 'ctrl', op: 'vanish', who: f.id });
        world.reactions.push({ on: back, do: 'set', var: waveV(k), to: 0 });
      });
      world.reactions.push({ on: back, do: 'set', var: 'hp', to: hp0 }, { on: back, do: 'emit', type: 'gauntlet:again', arena: from + 1 });
      const startAt = p.arenas[from].start ?? p.start;
      if (startAt) world.reactions.push({ on: back, do: 'move', target: ctx.player, to: startAt.slice() });
      world.sequences.push({ id: `${pre}:again:${a}`, trigger: { on: back }, steps: [{ await: { timer: 2 } }, { do: 'emit', type: waveE(first) }] });
    }
  }
  // the end: the seal on the way out lifted, or the clear the win
  if (p.at) {
    const outE = `gauntlet:out:${id}`, sealedE = `gauntlet:sealed:${id}`, open = `${pre}_open`;
    world.entities.push({ id: N.seal, type: 'seal', on: true, position: p.at.slice(), radius: 0.9, color: '#7a1f1a', ...(p.back ? { facing: [p.back[0] - p.at[0], p.back[1] - p.at[1]] } : {}) });
    world.reactions.push({ on: endE, do: 'set', var: open, to: 1 }, { on: endE, do: 'toggle', target: N.seal, to: false });
    world.sources.push({ type: 'zone', zone: N.exit, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2, planar: p.planar !== false, watch: ctx.player });
    world.reactions.push(
      { on: 'enter', match: { zone: N.exit }, if: { var: open, gte: 1 }, do: 'emit', type: outE },
      { on: 'enter', match: { zone: N.exit }, if: { var: open, lt: 1 }, do: 'emit', type: sealedE },
      ...(p.back ? [{ on: sealedE, do: 'move', target: ctx.player, to: p.back.slice() }] : []),
    );
    world.hud.push({ on: sealedE, text: outlast !== null ? 'sealed: hold out' : 'sealed: clear the arena', as: 'toast', ttl: 1.4 });
    out.on[outE] = { end: 'success' };
  } else out.on[endE] = { end: 'success' };
  // the other ways, sealed while it stands: a seal each, a walker turned away; lifted at the end (each seal facing back
  // into the room where its way says so, drawn as a barrier across its doorway: channels/events.js)
  seals.forEach((q, j) => {
    const sid = `${id}-seal-${j + 1}`, zone = `${id}-way-${j + 1}`, sealedE = `gauntlet:held:${id}`, open = `${pre}_open`;
    world.entities.push({ id: sid, type: 'seal', on: true, position: q.at.slice(), radius: 0.9, color: '#7a1f1a', ...(q.back ? { facing: [q.back[0] - q.at[0], q.back[1] - q.at[1]] } : {}) });
    world.sources.push({ type: 'zone', zone, at: q.at.slice(), radius: Number.isFinite(q.radius) ? q.radius : 2, planar: true, watch: ctx.player });
    world.reactions.push({ on: endE, do: 'toggle', target: sid, to: false }, { on: 'enter', match: { zone }, if: { var: open, lt: 1 }, do: 'emit', type: sealedE, way: j + 1 },
      ...(q.back ? [{ on: 'enter', match: { zone }, if: { var: open, lt: 1 }, do: 'move', target: ctx.player, to: q.back.slice() }] : []));
    if (!j) { if (!p.at) world.reactions.push({ on: endE, do: 'set', var: open, to: 1 }); world.hud.push({ on: sealedE, text: 'sealed: clear the arena', as: 'toast', ttl: 1.4 }); }
  });
  // an ARENA's own ways, sealed while it stands: up at its beginning, down at its last wave's clear
  let heldSaid = seals.length > 0;
  p.arenas.forEach((A, a) => {
    if (!A.seals || !A.seals.length) return;
    const on = `${pre}_s${a}`, lastK = W.reduce((m, x, k) => (x.arena === a ? k : m), -1), firstK = W.findIndex((x) => x.arena === a), heldE = `gauntlet:held:${id}`;
    world.vars[on] = 0;
    const begin = enters[a] ? inE(a) : waveE(firstK);
    world.reactions.push({ on: begin, do: 'set', var: on, to: 1 }, { on: clearedE(lastK), do: 'set', var: on, to: 0 });
    A.seals.forEach((q, j) => {
      const sid = `${id}-seal-${a + 1}-${j + 1}`, zone = `${id}-way-${a + 1}-${j + 1}`;
      world.entities.push({ id: sid, type: 'seal', on: false, position: q.at.slice(), radius: 0.9, color: '#7a1f1a', ...(q.back ? { facing: [q.back[0] - q.at[0], q.back[1] - q.at[1]] } : {}) });
      world.sources.push({ type: 'zone', zone, at: q.at.slice(), radius: Number.isFinite(q.radius) ? q.radius : 2, planar: true, watch: ctx.player });
      world.reactions.push({ on: begin, do: 'toggle', target: sid, to: true }, { on: clearedE(lastK), do: 'toggle', target: sid, to: false },
        { on: 'enter', match: { zone }, if: { var: on, gte: 1 }, do: 'emit', type: heldE, arena: a + 1, way: j + 1 },
        ...(q.back ? [{ on: 'enter', match: { zone }, if: { var: on, gte: 1 }, do: 'move', target: ctx.player, to: q.back.slice() }] : []));
    });
    if (!heldSaid) { heldSaid = true; world.hud.push({ on: heldE, text: 'sealed: clear the room', as: 'toast', ttl: 1.4 }); }
  });
  world.hud.push(
    { var: 'hp', label: 'HP', as: 'bar', max: hp0 },
    { on: 'wave', text: 'Arena {event.arena} of {event.arenas} · Wave {event.n} of {event.of}', ttl: 2 },
    { on: 'gauntlet:arena', text: 'Arena {event.arena} cleared', as: 'toast', ttl: 2 },
    { on: 'gauntlet:again', text: 'again: arena {event.arena}', as: 'toast', ttl: 2, color: 'harm' },
    ...(p.hold ? [{ on: `gauntlet:fallen:${id}`, text: 'it fell', as: 'toast', ttl: 2, color: 'harm' }] : []),
  );
  for (const ch of ['entities', 'sources']) if (!world[ch].length) delete world[ch];
  if (p.audit !== undefined) {
    if (!(p.audit && ((p.audit.kind === 'walkto' && Array.isArray(p.audit.target)) || (p.audit.kind === 'idle' && Number.isFinite(p.audit.seconds))))) fail("audit is { kind: 'walkto', target } or { kind: 'idle', seconds }: hand-named");
    out.audit = { ...p.audit };
  }
  return out;
}
