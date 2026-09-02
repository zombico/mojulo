/**
 * game mechanics — reusable level verbs that lower into world + contract at once
 * (game-mechanics.plan.md, M0). A mechanic is a pure function of (params, ctx) → fragments:
 *   world    — an events-manifest fragment (idiom-shaped: sources/reactions/watches/timers/
 *              entities/hud/vars), reusing the zone fact source (deriveZoneEvents) and the
 *              existing bus verbs. This is the world side a level used to hand-author.
 *   produces/on/consumes — the `game:` level-contract fragment (the wiring that used to be
 *              written by hand, synthesized here).
 *   audit    — a G4 completability recipe hint (walkto / idle / waypoints), so a mechanic that
 *              knows its win condition can be auto-verified (M3 consumes this).
 *
 * `composeMechanics(list, ctx)` merges the fragments, enforces the two rules — at least one
 * SUCCESS-capable terminal, and every required store slice present — and lowers the cross-cutting
 * `fall` policy (catch-zone → clamped penalty + respawn). It throws a teaching error listing every
 * fault, like the other game validators. Closed vocabulary: a mechanic lowers to existing primitives
 * or it doesn't ship (no runtime mechanic code, ever).
 */

const ARRAY_CHANNELS = ['entities', 'timers', 'reactions', 'watches', 'inputs', 'hud', 'sources', 'sequences', 'initial'];

// resolve the concrete slice NAME a mechanic acts on: params.<key> names it, else the first slice
// of the required kind. Returns { name } or { error }.
function resolveSlice(storeSchema, kind, named, where) {
  // No store schema (a level lowered standalone, before it's assembled into a game): trust the
  // named slice; store PRESENCE is validated later at create_game (validateLevelContract). A
  // mechanic that touches the store must then NAME its slice, since there's nothing to infer from.
  if (!storeSchema) {
    if (named) return { name: named };
    return { error: `${where}: name the ${kind} slice (e.g. into:'<sliceName>') — no store to infer it from at level-resolve time` };
  }
  const slices = storeSchema.slices || [];
  if (named) {
    const s = slices.find((x) => x.name === named);
    if (!s) return { error: `${where}: slice '${named}' is not in the store` };
    if (s.kind !== kind) return { error: `${where}: slice '${named}' is a ${s.kind}, not a ${kind}` };
    return { name: named };
  }
  const first = slices.find((x) => x.kind === kind);
  if (!first) return { error: `${where}: needs a ${kind} slice in the store (declare one, or name it)` };
  return { name: first.name };
}

// comparator keys a watch `when` predicate understands (event-bus.js cmp) — win-when validates
// its predicate against these so a typo'd comparator fails at compose, not silently at play.
const CMP_KEYS = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'];

// ── the mechanic registry ───────────────────────────────────────────────────────────────────────
// role: terminal | emitter | gate ; ends (terminals only): which results it can end in.
// requires: store slice KINDS. lower(params, ctx) → { world, produces?, on?, consumes?, audit? }.
// ctx = { i (index, for namespacing), player, spawn, storeSchema }.
const MECHANICS = {
  // reach a goal zone → success. The walkability audit IS its completability check.
  'reach-exit': {
    role: 'terminal', ends: ['success'], requires: [],
    lower(p, ctx) {
      const zone = `exit_${ctx.i}`;
      const at = p.at || [0, 0, 0];
      const shape = Array.isArray(p.half) ? { half: p.half } : { radius: p.radius != null ? p.radius : 2 };
      return {
        world: {
          sources: [{ type: 'zone', zone, at, ...shape, planar: p.planar !== false, watch: ctx.player }],
          reactions: [{ on: 'enter', match: { zone }, do: 'emit', type: 'goal:reached' }],
        },
        on: { 'goal:reached': { end: 'success' } },
        audit: { kind: 'walkto', target: at },
      };
    },
  },

  // survive a countdown → success (modeled on the countdownClock idiom, self-gated).
  survive: {
    role: 'terminal', ends: ['success'], requires: [],
    lower(p, ctx) {
      const secs = Number.isFinite(p.seconds) ? p.seconds : 30;
      const v = `__surv_${ctx.i}`, tick = `__surv_tick_${ctx.i}`, gate = `__surv_over_${ctx.i}`;
      return {
        world: {
          vars: { [v]: secs, [gate]: 0 },
          timers: [{ every: 1, emit: { type: tick }, while: { var: gate, eq: 0 } }],
          reactions: [
            { on: tick, do: 'inc', var: v, by: -1 },
            { on: 'time:up', do: 'set', var: gate, to: 1 },   // freeze the clock once survived
          ],
          watches: [{ type: 'time:up', when: { var: v, lte: 0 } }],
          hud: [{ var: v, label: 'Time' }],
        },
        on: { 'time:up': { end: 'success' } },
        audit: { kind: 'idle', seconds: secs },
      };
    },
  },

  // touch a pickup → grant it into inventory (emitter). Groups the contract on-map by item so the
  // static game emit carries the right item (no event templating needed).
  collect: {
    role: 'emitter', requires: ['inventory'],
    lower(p, ctx) {
      const inv = ctx.resolve('inventory', p.into, `collect[${ctx.i}]`);
      const pickups = Array.isArray(p.pickups) ? p.pickups : [];
      if (!pickups.length) throw new Error(`collect[${ctx.i}]: needs pickups: [{ item, at, radius? }]`);
      const world = { sources: [], reactions: [], entities: [] };
      const items = new Set();
      pickups.forEach((pk, j) => {
        const zone = `pk_${ctx.i}_${j}`;
        const item = pk.item || 'item';
        items.add(item);
        world.entities.push({ id: zone, on: true, position: pk.at || [0, 0, 0] });
        world.sources.push({ type: 'zone', zone, at: pk.at || [0, 0, 0], radius: pk.radius != null ? pk.radius : 1.4, planar: true, watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: 'pickup:' + item });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'toggle', target: zone, to: false });
      });
      const on = {};
      for (const item of items) on['pickup:' + item] = { emit: { type: 'grant', slice: inv, item, count: 1 } };
      return { world, produces: [{ type: 'grant', slice: inv, max: pickups.length }], on };
    },
  },

  // walk into a hazard → lose in-level hp (emitter). In-level only in M0 (feeds fail-on-death /
  // the HUD); persisting final hp to the store is a later stat-carry concern.
  'hazard-damage': {
    role: 'emitter', requires: ['character'],
    lower(p, ctx) {
      const hazards = Array.isArray(p.hazards) ? p.hazards : [];
      if (!hazards.length) throw new Error(`hazard-damage[${ctx.i}]: needs hazards: [{ at, radius?, damage? }]`);
      const world = { sources: [], reactions: [], vars: { hp: Number.isFinite(p.startHp) ? p.startHp : 100 }, hud: [{ var: 'hp', label: 'HP' }] };
      hazards.forEach((hz, j) => {
        const zone = `hz_${ctx.i}_${j}`;
        world.sources.push({ type: 'zone', zone, at: hz.at || [0, 0, 0], radius: hz.radius != null ? hz.radius : 1.5, planar: true, watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'inc', var: 'hp', by: -(Number.isFinite(hz.damage) ? hz.damage : 20) });
      });
      return { world };
    },
  },

  // hp ≤ 0 → fail (a lethality opt-in terminal, split from hazard-damage). Owns the hp var init so a
  // level can be lethal with or without hazards; the shared `hp` default dedupes with hazard-damage.
  'fail-on-death': {
    role: 'terminal', ends: ['fail'], requires: ['character'],
    lower(p) {
      return {
        world: {
          vars: { hp: Number.isFinite(p.startHp) ? p.startHp : 100 },
          watches: [{ type: 'dead', when: { var: 'hp', lte: 0 } }],
        },
        on: { dead: { end: 'fail' } },
      };
    },
  },

  // ── the mechanics-vocab V1 words (mechanics-vocab.plan.md) ────────────────────────────────────

  // generic predicate terminal: any numeric truth reaching a threshold → success. Clears the
  // "win condition lives in runtime code" flag class for every level whose victory is a number.
  // A generic predicate cannot synthesize its own completability recipe — the optional `audit`
  // param is HAND-NAMED (walkto / idle); absent it, promotion stays manual (see the card).
  'win-when': {
    role: 'terminal', ends: ['success'], requires: [],
    lower(p, ctx) {
      const w = p.when;
      if (!w || typeof w.var !== 'string' || !CMP_KEYS.some((k) => w[k] !== undefined)) {
        throw new Error(`win-when[${ctx.i}]: needs when: { var:'<name>', ${CMP_KEYS.join('|')}:<n> }`);
      }
      const event = typeof p.event === 'string' && p.event ? p.event : 'win:met';
      const world = { watches: [{ type: event, when: { ...w } }] };
      if (typeof p.hud === 'string' && p.hud) world.hud = [{ var: w.var, label: p.hud }];
      const out = { world, on: { [event]: { end: 'success' } } };
      if (p.audit) {
        const a = p.audit;
        const ok = (a.kind === 'walkto' && Array.isArray(a.target)) || (a.kind === 'idle' && Number.isFinite(a.seconds));
        if (!ok) throw new Error(`win-when[${ctx.i}]: audit must be { kind:'walkto', target:[x,y,z] } or { kind:'idle', seconds:N }`);
        out.audit = { ...a };
      }
      return out;
    },
  },

  // per-entity health (emitter): namespaced `__hp_<id>` vars, a clamped decrement on `hit:<id>`,
  // and an edge-watch that emits `enemy:down` (carrying the entity id) + toggles the entity off at
  // zero. The declarative PRODUCER that makes win-when / defeat-all honest for combat levels.
  'hp-pool': {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const ents = Array.isArray(p.entities) ? p.entities : [];
      if (!ents.length) throw new Error(`hp-pool[${ctx.i}]: needs entities: [{ id, hp?, at? }]`);
      const hpDefault = Number.isFinite(p.hp) ? p.hp : 3;
      const perHit = Number.isFinite(p.perHit) ? p.perHit : 1;
      const world = { vars: {}, reactions: [], watches: [], entities: [] };
      for (const ent of ents) {
        if (!ent || typeof ent.id !== 'string' || !ent.id) throw new Error(`hp-pool[${ctx.i}]: every entity needs an id`);
        const v = `__hp_${ent.id}`;
        world.vars[v] = Number.isFinite(ent.hp) ? ent.hp : hpDefault;
        world.reactions.push({ on: `hit:${ent.id}`, do: 'inc', var: v, by: -perHit, min: 0 });
        world.watches.push({ type: 'enemy:down', entity: ent.id, when: { var: v, lte: 0 } });
        world.reactions.push({ on: 'enemy:down', match: { entity: ent.id }, do: 'toggle', target: ent.id, to: false });
        if (Array.isArray(ent.at)) world.entities.push({ id: ent.id, type: ent.type || 'enemy', on: true, position: ent.at });
      }
      if (world.entities.length === 0) delete world.entities;
      return { world, emits: ['enemy:down'] };
    },
  },

  // success terminal: N `enemy:down` events → success. Deliberately split from HOW enemies go
  // down; `count` is explicit, or inferred from sibling hp-pool entities at compose time. No
  // auto-audit — nothing in the vocabulary can deal hits yet (melee-strike is V3), so promotion
  // stays manual (allow_unaudited or a hand-authored motion_ref); the card says so plainly.
  'defeat-all': {
    role: 'terminal', ends: ['success'], requires: [],
    lower(p, ctx) {
      const count = Number.isFinite(p.count) ? p.count : (ctx.hints && ctx.hints.enemyCount);
      if (!Number.isFinite(count) || count < 1) {
        throw new Error(`defeat-all[${ctx.i}]: needs count:N — or compose with an hp-pool to infer it from the entity list`);
      }
      const v = `__downs_${ctx.i}`;
      return {
        world: {
          vars: { [v]: 0 },
          reactions: [{ on: 'enemy:down', do: 'inc', var: v, by: 1 }],
          watches: [{ type: 'all:defeated', when: { var: v, gte: count } }],
          hud: [{ var: v, label: typeof p.label === 'string' && p.label ? p.label : 'Defeated' }],
        },
        on: { 'all:defeated': { end: 'success' } },
        needs: p.producer === 'runtime' ? [] : ['enemy:down'],
      };
    },
  },
};

export const MECHANIC_KINDS = Object.keys(MECHANICS);
export const TERMINAL_KINDS = MECHANIC_KINDS.filter((k) => MECHANICS[k].role === 'terminal');

export function lowerMechanic(kind, params, ctx) {
  const def = MECHANICS[kind];
  if (!def) throw new Error(`unknown mechanic '${kind}'. Known: ${MECHANIC_KINDS.join(', ')}`);
  const errors = [];
  const cx = {
    i: ctx.i != null ? ctx.i : 0,
    player: (ctx && ctx.player) || 'player',
    spawn: (ctx && ctx.spawn) || [0, 0, 2],
    storeSchema: ctx && ctx.storeSchema,
    hints: (ctx && ctx.hints) || {},
    resolve(reqKind, named, where) {
      const r = resolveSlice(ctx && ctx.storeSchema, reqKind, named, where);
      if (r.error) { errors.push(r.error); return null; }
      return r.name;
    },
  };
  const out = def.lower(params || {}, cx);
  return { kind, role: def.role, ends: def.ends || null, requires: def.requires, errors, ...out };
}

// merge var bags with dedup: same key + same value is fine (shared level vars like hp); a genuine
// conflict (two mechanics want the same var at different values) is an authoring error.
function mergeVars(target, vars, where, errors) {
  for (const k in (vars || {})) {
    if (Object.prototype.hasOwnProperty.call(target, k) && JSON.stringify(target[k]) !== JSON.stringify(vars[k])) {
      errors.push(`${where}: var '${k}' conflicts (${JSON.stringify(target[k])} vs ${JSON.stringify(vars[k])})`);
      continue;
    }
    target[k] = vars[k];
  }
}

/**
 * Compose a level's mechanics (+ optional `fall` policy) into one world events fragment and one
 * contract fragment. ctx: { storeSchema, player?, spawn?, fallZ?, fallHalf? }.
 * @returns {{ events, produces, on, consumes, requires, audits }}
 * @throws with every fault listed (unknown mechanic, missing slice, no success terminal, var/on conflict).
 */
export function composeMechanics(mechanics, ctx = {}) {
  const list = Array.isArray(mechanics) ? mechanics : [];
  const errors = [];
  const events = { vars: {} };
  for (const ch of ARRAY_CHANNELS) events[ch] = [];
  const produces = [];
  const on = {};
  const consumes = [];
  const requires = new Set();
  const audits = [];
  let successTerminals = 0;

  const player = ctx.player || 'player';
  const spawn = ctx.spawn || [0, 0, 2];

  // compose-time hints, from a prepass over the RAW list (params are data): lets defeat-all
  // infer its count from sibling hp-pool entities without coupling the lowering functions.
  const enemyCount = list.reduce((n, m) => n + (m && m.kind === 'hp-pool' && Array.isArray(m.entities) ? m.entities.length : 0), 0);
  const hints = enemyCount > 0 ? { enemyCount } : {};

  const emitted = new Set();      // event types some mechanic declaratively produces (hp-pool → enemy:down)
  const needed = [];              // { event, where } a mechanic requires a producer for (defeat-all)

  list.forEach((m, i) => {
    if (!m || !m.kind) { errors.push(`mechanics[${i}] must be { kind, ... }`); return; }
    let low;
    try { low = lowerMechanic(m.kind, m, { i, player, spawn, storeSchema: ctx.storeSchema, hints }); }
    catch (e) { errors.push(e.message); return; }
    low.errors.forEach((e) => errors.push(e));
    (low.emits || []).forEach((e) => emitted.add(e));
    (low.needs || []).forEach((e) => needed.push({ event: e, where: `mechanics[${i}] (${m.kind})` }));
    (low.requires || []).forEach((r) => requires.add(r));
    if (low.role === 'terminal' && low.ends && low.ends.includes('success')) successTerminals++;
    if (low.world) {
      mergeVars(events.vars, low.world.vars, `mechanics[${i}] (${m.kind})`, errors);
      for (const ch of ARRAY_CHANNELS) if (Array.isArray(low.world[ch])) events[ch].push(...low.world[ch]);
    }
    for (const e of (low.produces || [])) produces.push(e);
    for (const k in (low.on || {})) {
      if (Object.prototype.hasOwnProperty.call(on, k)) errors.push(`mechanics[${i}] (${m.kind}): on-map key '${k}' already mapped by another mechanic`);
      else on[k] = low.on[k];
    }
    for (const c of (low.consumes || [])) consumes.push(c);
    if (low.audit && low.role === 'terminal' && low.ends && low.ends.includes('success')) audits.push({ mechanic: m.kind, ...low.audit });
  });

  // the fall POLICY (cross-cutting, not a mechanic): a catch-box below the world → respawn + a
  // clamped penalty that can never reach 0. Default respawn/penalty-0; opt-in penalty floors hp at 1.
  const fall = ctx.fall !== undefined ? ctx.fall : { mode: 'respawn' };
  if (fall && fall !== 'none') {
    const mode = typeof fall === 'string' ? fall : (fall.mode || 'respawn');
    const fallZ = Number.isFinite(ctx.fallZ) ? ctx.fallZ : -20;
    const half = Number.isFinite(ctx.fallHalf) ? ctx.fallHalf : 400;
    const depth = 200;
    events.sources.push({ type: 'zone', zone: '__catch__', at: [spawn[0], spawn[1], fallZ - depth / 2], half: [half, half, depth / 2], watch: player });
    if (mode === 'lethal') {
      events.reactions.push({ on: 'enter', match: { zone: '__catch__' }, do: 'set', var: 'hp', to: 0 });   // → fail-on-death if present
    } else {   // respawn (default)
      const penalty = typeof fall === 'object' && Number.isFinite(fall.penalty) ? fall.penalty : 0;
      const to = (typeof fall === 'object' && Array.isArray(fall.to)) ? fall.to : spawn;
      if (penalty > 0) {
        requires.add('character');
        const floor = typeof fall === 'object' && Number.isFinite(fall.floor) ? fall.floor : 1;
        events.reactions.push({ on: 'enter', match: { zone: '__catch__' }, do: 'inc', var: 'hp', by: -penalty, min: floor });
      }
      events.reactions.push({ on: 'enter', match: { zone: '__catch__' }, do: 'move', target: player, to });
    }
  }

  if (!successTerminals) {
    const successKinds = MECHANIC_KINDS.filter((k) => MECHANICS[k].role === 'terminal' && (MECHANICS[k].ends || []).includes('success'));
    errors.push(`a level needs at least one SUCCESS-capable terminal mechanic (${successKinds.join(' / ')}) — as declared it can never be won`);
  }
  // a terminal that counts events nothing produces would assess clean and never be winnable —
  // the V0 correctness warning, enforced. `producer:'runtime'` is the explicit acknowledgment
  // that hand-authored world reactions (outside this list) emit the event.
  for (const n of needed) {
    if (!emitted.has(n.event)) {
      errors.push(`${n.where}: no mechanic in this level emits '${n.event}' — add an hp-pool, or declare producer:'runtime' if hand-authored reactions emit it`);
    }
  }
  // every required slice kind must be present in the store — only when a store is in hand (at
  // level-resolve there's none; create_game re-checks the synthesized contract against the store).
  if (ctx.storeSchema) {
    for (const kind of requires) {
      const has = (ctx.storeSchema.slices || []).some((s) => s.kind === kind);
      if (!has) errors.push(`the store has no ${kind} slice, but a mechanic requires one`);
    }
  }

  if (errors.length) throw new Error(`cannot compose mechanics:\n- ${errors.join('\n- ')}`);

  // drop empty channels so the emitted manifest reads like a hand-written one
  for (const ch of ARRAY_CHANNELS) if (events[ch].length === 0) delete events[ch];
  if (Object.keys(events.vars).length === 0) delete events.vars;

  return { events, produces, on, consumes, requires: [...requires], audits };
}
