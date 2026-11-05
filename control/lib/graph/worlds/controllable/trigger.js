/**
 * TRIGGERED BREAKS (an opt-in builder): what a world can break, set off by the game or by the player. A cue's effect
 * (playscape/ui/cast.js: a zone entered, a lever used, a timer, a boss's fall, any event) reaches the world on the bus's
 * ctrl verb, and a world's breaks come back as happenings a cue can wait on. The breaking is the world's own: a block
 * breaks as any blow breaks it (counted, or by its matter under destructible physics), a charge is a burst like a
 * grenade's, and what loses its hold falls by the world's gravity. Composed only when a world's cues use it
 * (`triggersIn`), so every other page keeps its bytes.
 *
 *   castOps (wrapped), with no one named:
 *     blast { at, radius, hurt? }        a charge at a point: a burst of that radius (its energy by cube-root scaling under
 *                                        destructible physics, one blow to each block in reach otherwise); `hurt` takes
 *                                        that much hp from each body inside it
 *     collapse { group, how?, storey?, stagger? }   a building or a group comes down: `base` (the default) breaks what
 *                                        stands within `storey` metres (3) of its foot, the rest falls on it; `whole`
 *                                        breaks every block. `stagger` seconds between blocks, from the bottom up (0: at
 *                                        once). A group is a block's id, or its building's: the id before its last `:`
 *                                        (a structure `structure:<id>` or its own id, a house's id or `house-<id>`)
 *     break { id }                       one block, or each block of a group
 *     dig { who? | at, to?, scoop? }     the shovel: a scoop (hand, bucket, excavator, or m³) out of the ground in front of
 *                                        who (1.2 m along its heading) or at a place, its loose soil thrown beside them
 *                                        (or at `to`), piled at its soil's repose; needs a physical level's ground
 *   castFacts (wrapped): breached { entity: group } when a group's first block breaks; fell { entity: group } when half of
 *     its blocks are broken, have fallen or were felled (a group of two or more: a lone block says broke:<id>; a block
 *     restored at the start counts for nothing; the first read seeds: nothing a world was minted with fires)
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; after cast.js and rules-basic.js in the list.
 */
export const TRIGGER_OPS = Object.freeze(['blast', 'collapse', 'break', 'dig']);
export const TRIGGER_WHEN = Object.freeze(['breached', 'fell']);
// does a world's lowered play use triggered breaks (its reactions or its sequences' steps)
export const triggersIn = (events) => {
  if (!events || typeof events !== 'object') return false;
  const uses = (r) => !!r && ((r.do === 'ctrl' && TRIGGER_OPS.includes(r.op)) || TRIGGER_WHEN.includes(r.on));
  return (events.reactions || []).some(uses) || (events.sequences || []).some((q) => q && (q.steps || []).some(uses));
};

export function buildTrigger(E) {
  const OPS = ['blast', 'collapse', 'break', 'dig'];   // (TRIGGER_OPS, here again: the page runs this function's own source)
  const groupOf = (id) => { const s = String(id), k = s.lastIndexOf(':'); return k > 0 ? s.slice(0, k) : s; };
  const inGroup = (b, name) => {
    const g = groupOf(b.id);
    return b.id === name || g === name || g === 'structure:' + name || (name.startsWith('house-') && g === name.slice(6));
  };
  const trig = (state) => state.trigger || (state.trigger = { queue: [] });
  function queue(state, blocks, stagger) {
    const T = trig(state), list = blocks.slice().sort((a, b) => a.min[2] - b.min[2] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    list.forEach((b, i) => T.queue.push({ id: b.id, t: (state.time || 0) + i * (stagger || 0) }));
  }
  const live = (state) => (state.breakables || []).filter((b) => !b.broken);

  const baseOps = E.castOps;
  E.castOps = function castOps(state, ops) {
    const rest = [];
    for (const o of ops || []) {
      // THE SHOVEL (dig): a scoop out of the ground in front of who (or at a place), its loose soil thrown beside them (or
      // where `to` says); a world without ground (no destructible physics' land) digs nothing
      if (o && o.op === 'dig') {
        const P = E.rupaPhysics, Gd = state.rupa && state.rupa.ground;
        if (!P || !Gd || !P.groundShovel) continue;
        const e = o.who ? state.byId[o.who] : null;
        if (o.who && (!e || e.gone)) continue;
        const h = e ? e.transform.heading || 0 : 0, f = [Math.cos(h), Math.sin(h)], side = [Math.sin(h), -Math.cos(h)];
        const at = Array.isArray(o.at) ? o.at : e ? [e.transform.pos[0] + 1.2 * f[0], e.transform.pos[1] + 1.2 * f[1]] : null;
        if (!at) continue;
        const to = Array.isArray(o.to) ? o.to : e ? [at[0] + 1.4 * side[0], at[1] + 1.4 * side[1]] : [at[0] + 1.5, at[1]];
        P.groundShovel(Gd, at, to, o.scoop ?? 'hand');
        continue;
      }
      if (!o || o.who || !OPS.includes(o.op)) { rest.push(o); continue; }
      if (o.op === 'blast' && Array.isArray(o.at) && o.radius > 0) {
        const at = [o.at[0], o.at[1], o.at[2] ?? 0.5];
        if (!state.bursts) state.bursts = [];
        state.burstSeq = (state.burstSeq || 0) + 1;
        state.bursts.push({ seq: state.burstSeq, pos: at, t: state.time || 0, radius: o.radius, scripted: true });
        if (o.hurt > 0) for (const e of state.entities) {
          if (e.isCamera || e.gone || e.downed || !e.body || !e.body.hittable) continue;
          const p = e.transform.pos;
          if (Math.hypot(p[0] - at[0], p[1] - at[1], (p[2] + 0.9) - at[2]) <= o.radius + (e.body.radius || 0.5)) rest.push({ op: 'hurt', who: e.id, by: o.hurt });
        }
        continue;
      }
      if (o.op === 'collapse' && typeof o.group === 'string') {
        const bs = live(state).filter((b) => inGroup(b, o.group));
        if (!bs.length) continue;
        const foot = Math.min(...bs.map((b) => b.min[2])), storey = o.storey > 0 ? o.storey : 3;
        queue(state, o.how === 'whole' ? bs : bs.filter((b) => b.min[2] < foot + storey), o.stagger);
        continue;
      }
      if (o.op === 'break' && typeof o.id === 'string') queue(state, live(state).filter((b) => inGroup(b, o.id)), 0);
    }
    if (rest.length) baseOps(state, rest);
  };

  // the queue: each block when its time comes, before the blows and gravity of this step
  E.registerWorldPass('trigger', (state) => {
    const T = state.trigger;
    if (!T || !T.queue.length) return;
    const now = state.time || 0, due = T.queue.filter((q) => q.t <= now + 1e-9);
    if (!due.length) return;
    T.queue = T.queue.filter((q) => q.t > now + 1e-9);
    for (const q of due) E.breakBlock(state, q.id, Infinity);
  }, 34.2);

  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev);
    if (!state.breakables || !state.breakables.length) return out;
    const by = new Map();
    for (const b of state.breakables) {
      // (a block restored at the start, an aftermath carried in, is no happening: it counts for nothing)
      if (b.broken && b.broken.how === 'restore') continue;
      const g = groupOf(b.id), c = by.get(g) || { n: 0, broke: 0, down: 0 };
      c.n++;
      if (b.broken) c.broke++;
      if (b.broken || (b.landed && b.landed.drop > 0.25) || b.falling || b.fell != null) c.down++;
      by.set(g, c);
    }
    const was = (prev && prev.__trigger) || null, cur = {};
    for (const [g, c] of by) {
      if (c.n < 2) continue;   // (a lone block says broke:<id>; a group of them, a building or a tree, says these)
      const s = { b: c.broke > 0, f: c.down * 2 >= c.n };
      cur[g] = s;
      const p = was && was[g];
      if (!p) continue;
      if (s.b && !p.b) out.events.push({ type: 'breached', entity: g });
      if (s.f && !p.f) out.events.push({ type: 'fell', entity: g });
    }
    out.prev.__trigger = cur;
    return out;
  };
}
