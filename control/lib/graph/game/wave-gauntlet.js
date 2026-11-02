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
 *                `death: 'fail'` ends the level instead.
 *
 * Params:
 *   { id?: 'gauntlet', arenas: [{ waves: [{ foes: ['<entity id>' | { id, at }], after? }], after? }],
 *     at?, radius?, planar?, back?, start?, hp?, hits?, checkpoint?, death?: 'arena' | 'fail' }
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
  const death = p.death ?? 'arena';
  if (!['arena', 'fail'].includes(death)) fail("death is 'arena' (begin it again) or 'fail' (the level is lost)");
  const hp0 = Number.isFinite(p.hp) && p.hp > 0 ? p.hp : 100, hits = Number.isFinite(p.hits) && p.hits > 0 ? p.hits : 20;
  const N = gauntletNames(id), A = p.arenas.length, pre = `__wg_${id}`, at = `${pre}_arena`, waveV = (k) => `${pre}_d${k}`;
  const waveE = (k) => `gauntlet:wave:${id}:${k}`, clearedE = (k) => `${pre}:cleared:${k}`, clearE = `gauntlet:clear:${id}`;
  const world = { vars: { [at]: 0, [`${pre}_open`]: 0, hp: hp0 }, reactions: [], watches: [], sequences: [], hud: [], entities: [], sources: [], initial: [{ type: `${pre}:go` }] };
  // the first wave, after a breath
  world.sequences.push({ id: `${pre}:go`, trigger: { on: `${pre}:go` }, steps: [{ await: { timer: Number.isFinite(W[0].after) ? W[0].after : 1 } }, { do: 'emit', type: waveE(0) }] });
  W.forEach((x, k) => {
    world.vars[waveV(k)] = 0;
    // the wave: its arena said, its foes woken (where it names them), its count of downs
    world.reactions.push({ on: waveE(k), do: 'set', var: at, to: x.arena });
    world.reactions.push({ on: waveE(k), do: 'emit', type: 'wave', n: x.wave + 1, of: p.arenas[x.arena].waves.length, arena: x.arena + 1, arenas: A });
    for (const f of x.foes) {
      world.reactions.push({ on: waveE(k), do: 'ctrl', op: 'spawn', who: f.id, fresh: true, ...(f.at ? { at: f.at.slice() } : {}) });
      world.reactions.push({ on: 'down', match: { entity: f.id }, do: 'inc', var: waveV(k), by: 1 });
    }
    world.watches.push({ type: clearedE(k), when: { var: waveV(k), gte: x.foes.length } });
    // cleared: the next wave after a pause (an arena's first after the arena's), or the gauntlet's end
    const next = W[k + 1];
    if (next) {
      const pause = next.arena !== x.arena ? (Number.isFinite(next.after) ? next.after : Number.isFinite(next.arenaAfter) ? next.arenaAfter : 4) : (Number.isFinite(next.after) ? next.after : 2);
      if (next.arena !== x.arena) world.reactions.push({ on: clearedE(k), do: 'emit', type: 'gauntlet:arena', arena: x.arena + 1, of: A });
      // (after the pause, only if it is still cleared: a death in the pause zeroed it, and the arena begins again instead)
      world.sequences.push({ id: `${pre}:next:${k}`, trigger: { on: clearedE(k) }, steps: [{ await: { timer: pause } }, { do: 'emit', type: `${pre}:on:${k}` }] });
      world.reactions.push({ on: `${pre}:on:${k}`, if: { var: waveV(k), gte: x.foes.length }, do: 'emit', type: waveE(k + 1) });
    } else world.reactions.push({ on: clearedE(k), do: 'emit', type: clearE });
  });
  // death: the gauntlet's own hp, a hit's cost; at none, the arena (or its checkpoint) begins again, or the level is lost
  world.reactions.push({ on: `hit:${ctx.player}`, do: 'inc', var: 'hp', by: -hits, min: 0 });
  world.watches.push({ type: `${pre}:fell`, when: { var: 'hp', lte: 0 } });
  const out = { world, on: {}, emits: [clearE, 'wave'] };
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
      if (p.start) world.reactions.push({ on: back, do: 'move', target: ctx.player, to: p.start.slice() });
      world.sequences.push({ id: `${pre}:again:${a}`, trigger: { on: back }, steps: [{ await: { timer: 2 } }, { do: 'emit', type: waveE(first) }] });
    }
  }
  // the end: the seal on the way out lifted, or the clear the win
  if (p.at) {
    const outE = `gauntlet:out:${id}`, sealedE = `gauntlet:sealed:${id}`, open = `${pre}_open`;
    world.entities.push({ id: N.seal, type: 'seal', on: true, position: p.at.slice(), radius: 0.9, color: '#7a1f1a' });
    world.reactions.push({ on: clearE, do: 'set', var: open, to: 1 }, { on: clearE, do: 'toggle', target: N.seal, to: false });
    world.sources.push({ type: 'zone', zone: N.exit, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2, planar: p.planar !== false, watch: ctx.player });
    world.reactions.push(
      { on: 'enter', match: { zone: N.exit }, if: { var: open, gte: 1 }, do: 'emit', type: outE },
      { on: 'enter', match: { zone: N.exit }, if: { var: open, lt: 1 }, do: 'emit', type: sealedE },
      ...(p.back ? [{ on: sealedE, do: 'move', target: ctx.player, to: p.back.slice() }] : []),
    );
    world.hud.push({ on: sealedE, text: 'sealed: clear the arena', as: 'toast', ttl: 1.4 });
    out.on[outE] = { end: 'success' };
  } else out.on[clearE] = { end: 'success' };
  world.hud.push(
    { var: 'hp', label: 'HP', as: 'bar', max: hp0 },
    { on: 'wave', text: 'Arena {event.arena} of {event.arenas} · Wave {event.n} of {event.of}', ttl: 2 },
    { on: 'gauntlet:arena', text: 'Arena {event.arena} cleared', as: 'toast', ttl: 2 },
    { on: 'gauntlet:again', text: 'again: arena {event.arena}', as: 'toast', ttl: 2, color: 'harm' },
  );
  for (const ch of ['entities', 'sources']) if (!world[ch].length) delete world[ch];
  if (p.audit !== undefined) {
    if (!(p.audit && ((p.audit.kind === 'walkto' && Array.isArray(p.audit.target)) || (p.audit.kind === 'idle' && Number.isFinite(p.audit.seconds))))) fail("audit is { kind: 'walkto', target } or { kind: 'idle', seconds }: hand-named");
    out.audit = { ...p.audit };
  }
  return out;
}
