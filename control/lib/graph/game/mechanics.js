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
import { heldVar, itemKey } from '../playscape/ui/items.js';

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
          reactions: [{ on: 'enter', match: { zone }, do: 'emit', type: p.exit ? `goal:reached:${p.exit}` : 'goal:reached' }],
        },
        // `exit`: one of a level's several ways out, named on the envelope (a map game travels by it)
        on: p.exit ? { [`goal:reached:${p.exit}`]: { end: 'success', exit: p.exit } } : { 'goal:reached': { end: 'success' } },
        // `via`: the waypoints the audit walks first (a building level's stairs); absent, the straight walk
        audit: { kind: 'walkto', target: at, ...(Array.isArray(p.via) && p.via.length ? { via: p.via } : {}) },
      };
    },
  },

  // a DOOR to another level (scene change): walking into its zone leaves this level by it, the game shell loading
  // the level its link names, entered at the door that link pairs with. Not an end: the session carries on there.
  // `spawn`/`heading`: where a walker entering BY this door stands and faces (inside, away from the door).
  door: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const id = String(p.id ?? `door${ctx.i}`), zone = `door_${id}`, at = p.at || [0, 0, 0], type = `door:${id}`;
      const shape = Array.isArray(p.half) ? { half: p.half } : { radius: p.radius != null ? p.radius : 1.2 };
      return {
        world: {
          sources: [{ type: 'zone', zone, at, ...shape, planar: p.planar !== false, watch: ctx.player }],
          reactions: [{ on: 'enter', match: { zone }, do: 'emit', type }],
        },
        on: { [type]: { door: id } },
        doors: [{ id, at, spawn: Array.isArray(p.spawn) ? p.spawn : at, heading: Number.isFinite(p.heading) ? p.heading : 0 }],
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
      // each pickup counts into the bag on the bus too (playscape/ui/items.js: held:bag:<item>), on the HUD by name
      const world = { vars: {}, sources: [], reactions: [], entities: [], hud: [] };
      const items = new Set();
      pickups.forEach((pk, j) => {
        const zone = `pk_${ctx.i}_${j}`;
        const item = pk.item || 'item';
        items.add(item);
        world.entities.push({ id: zone, on: true, position: pk.at || [0, 0, 0] });
        // planar unless the pickup says otherwise (one raised on a ledge is reached by climbing to it, not by walking under it)
        world.sources.push({ type: 'zone', zone, at: pk.at || [0, 0, 0], radius: pk.radius != null ? pk.radius : 1.4, planar: pk.planar !== false, watch: ctx.player });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: 'pickup:' + item });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'toggle', target: zone, to: false });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'inc', var: heldVar('bag', item), by: 1 });
      });
      for (const item of items) { world.vars[heldVar('bag', item)] = 0; world.hud.push({ var: heldVar('bag', item), label: itemKey(item).replace(/-/g, ' ') }); }
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
    lower(p, ctx) {
      // `hits`: what each hit the player takes (the cast's hit:<player>: a round, a blade, a splash) costs it, on the HUD
      const hits = Number.isFinite(p.hits) && p.hits > 0 ? p.hits : null;
      if (p.hits !== undefined && !hits) throw new Error(`fail-on-death[${ctx.i}]: hits is the hp a hit on the player takes, above 0`);
      return {
        world: {
          vars: { hp: Number.isFinite(p.startHp) ? p.startHp : 100 },
          watches: [{ type: 'dead', when: { var: 'hp', lte: 0 } }],
          ...(hits ? { reactions: [{ on: `hit:${ctx.player}`, do: 'inc', var: 'hp', by: -hits, min: 0 }], hud: [{ var: 'hp', label: 'HP' }] } : {}),
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
      // `who`: a glob over the characters whose falls count (the cast's own `down`: their body.hp ran out), so the
      // world's own combat produces it, no hp-pool
      const who = typeof p.who === 'string' && p.who ? p.who : null;
      const v = `__downs_${ctx.i}`;
      return {
        world: {
          vars: { [v]: 0 },
          reactions: [who ? { on: 'down', match: { entity: who }, do: 'inc', var: v, by: 1 } : { on: 'enemy:down', do: 'inc', var: v, by: 1 }],
          watches: [{ type: 'all:defeated', when: { var: v, gte: count } }],
          hud: [{ var: v, label: typeof p.label === 'string' && p.label ? p.label : 'Defeated' }],
        },
        on: { 'all:defeated': { end: 'success' } },
        needs: p.producer === 'runtime' || who ? [] : ['enemy:down'],
      };
    },
  },

  // walk over a supply → it gives (emitter): health back into the level's hp (to `max`), or rounds for the player's
  // weapon (the cast's rearm: into its reserve, or a full magazine). Each is taken once, unless it comes back:
  //   respawn   seconds after it is taken it is there again (`p.respawn`, or a drop's own): an arena's item timing
  //   armor     `gives: 'armor'`: into the level's `armor` (to `armorMax`, 100), which takes whole rounds while it lasts
  //             (frags' `armor`)
  //   overdrive `gives: 'overdrive'`: the cast's status for `amount` seconds (10): its taker's rounds hit harder
  //   takers    a glob of the others who may take them too (`'bot-*'`): health and armor heal them (the cast's heal),
  //             rounds rearm them, overdrive drives them; whoever takes one, it is gone for everyone
  //   weapon    `gives: 'weapon', slot`: the cast's arm, a loadout slot (its name or index) carried from then on (a slot
  //             `held: false` waits for it), drawn; a gun carried already takes its rounds full
  supplies: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const drops = Array.isArray(p.drops) ? p.drops : [];
      if (!drops.length) throw new Error(`supplies[${ctx.i}]: needs drops: [{ at, gives: '${SUPPLIES.join("' | '")}', amount? }]`);
      const max = Number.isFinite(p.max) && p.max > 0 ? p.max : 100, armorMax = Number.isFinite(p.armorMax) && p.armorMax > 0 ? p.armorMax : 100;
      if (p.takers !== undefined && !(typeof p.takers === 'string' && p.takers)) throw new Error(`supplies[${ctx.i}].takers is a glob of who else may take them ('bot-*')`);
      const world = { vars: {}, sources: [], reactions: [], entities: [] };
      drops.forEach((d, j) => {
        if (!d || !(SUPPLIES.includes(d.gives) || d.gives === 'weapon')) throw new Error(`supplies[${ctx.i}].drops[${j}].gives is one of ${SUPPLIES.join(', ')}, weapon`);
        if (d.gives === 'weapon' && !((typeof d.slot === 'string' && d.slot) || Number.isInteger(d.slot))) throw new Error(`supplies[${ctx.i}].drops[${j}]: a weapon names its loadout slot (slot: its name or index)`);
        if (d.amount !== undefined && !(Number.isFinite(d.amount) && d.amount > 0)) throw new Error(`supplies[${ctx.i}].drops[${j}].amount is above 0`);
        const back = d.respawn ?? p.respawn;
        if (back !== undefined && !(Number.isFinite(back) && back > 0)) throw new Error(`supplies[${ctx.i}].drops[${j}]: respawn is the seconds it takes to come back, above 0`);
        const zone = `sp_${ctx.i}_${j}`, at = Array.isArray(d.at) ? d.at : [0, 0, 0], got = `__${zone}`, untaken = { var: got, eq: 0 };
        world.vars[got] = 0;
        world.entities.push({ id: zone, on: true, position: at });
        world.sources.push({ type: 'zone', zone, at, radius: d.radius != null ? d.radius : 1.4, planar: true, watch: ctx.player });
        const give = {
          health: { do: 'inc', var: 'hp', by: d.amount ?? 25, max },
          ammo: { do: 'ctrl', op: 'rearm', who: ctx.player, ...(d.amount !== undefined ? { by: d.amount } : {}) },
          armor: { do: 'inc', var: 'armor', by: d.amount ?? 50, max: armorMax },
          overdrive: { do: 'ctrl', op: 'status', who: ctx.player, is: 'overdrive', for: d.amount ?? 10 },
          weapon: { do: 'ctrl', op: 'arm', who: ctx.player, slot: d.slot },
        }[d.gives];
        world.reactions.push({ on: 'enter', match: { zone }, if: untaken, ...give });
        world.reactions.push({ on: 'enter', match: { zone }, if: untaken, do: 'emit', type: `supply:${d.gives}`, ...(d.gives === 'weapon' ? { slot: d.slot } : {}) });
        if (back !== undefined) world.reactions.push({ on: 'enter', match: { zone }, if: untaken, do: 'emit', type: `__${zone}_taken` });
        // the others who may take it: their own zone at the same place, the same once (or until it is back)
        if (p.takers) {
          const theirs = `${zone}_t`, them = 'event.entity';
          world.sources.push({ type: 'zone', zone: theirs, at, radius: d.radius != null ? d.radius : 1.4, planar: true, watch: p.takers });
          const giveThem = {
            health: { do: 'ctrl', op: 'heal', who: them, by: d.amount ?? 25 },
            armor: { do: 'ctrl', op: 'heal', who: them, by: d.amount ?? 50 },
            ammo: { do: 'ctrl', op: 'rearm', who: them, ...(d.amount !== undefined ? { by: d.amount } : {}) },
            overdrive: { do: 'ctrl', op: 'status', who: them, is: 'overdrive', for: d.amount ?? 10 },
            weapon: { do: 'ctrl', op: 'arm', who: them, slot: d.slot },
          }[d.gives];
          world.reactions.push(
            { on: 'enter', match: { zone: theirs }, if: untaken, ...giveThem },
            { on: 'enter', match: { zone: theirs }, if: untaken, do: 'emit', type: `supply:${d.gives}`, by: them, ...(d.gives === 'weapon' ? { slot: d.slot } : {}) },
            ...(back !== undefined ? [{ on: 'enter', match: { zone: theirs }, if: untaken, do: 'emit', type: `__${zone}_taken` }] : []),
            { on: 'enter', match: { zone: theirs }, do: 'toggle', target: zone, to: false },
            { on: 'enter', match: { zone: theirs }, do: 'set', var: got, to: 1 },
          );
        }
        world.reactions.push({ on: 'enter', match: { zone }, do: 'toggle', target: zone, to: false });
        world.reactions.push({ on: 'enter', match: { zone }, do: 'set', var: got, to: 1 });
        // back after its time: there again, to be taken again
        if (back !== undefined) {
          (world.sequences ||= []).push({ id: `__${zone}_back`, trigger: { on: `__${zone}_taken` }, steps: [{ await: { timer: back } }, { do: 'set', var: got, to: 0 }, { do: 'toggle', target: zone, to: true }, { do: 'emit', type: 'supply:back', zone }] });
        }
      });
      return { world, emits: [...SUPPLIES, ...(drops.some((d) => d.gives === 'weapon') ? ['weapon'] : [])].map((g) => `supply:${g}`) };
    },
  },

  // ── the genre snipe (10-12): stealth, racing and the kept number. Each lowers to zones, vars, guarded reactions
  // (a reaction's `if`), timers and watches; the only new fact is the cast's `seen` (a sighting, worlds/controllable).

  // seen by a watcher → fail (a terminal). A character with sight (rule.mind.perception) that newly sees its target
  // says `seen` on the bus; `alarms` sightings end the level (1: the first). `who` globs the watchers (default all).
  unseen: {
    role: 'terminal', ends: ['fail'], requires: [],
    lower(p, ctx) {
      const alarms = Number.isInteger(p.alarms) && p.alarms > 0 ? p.alarms : 1;
      const match = { entity: typeof p.who === 'string' && p.who ? p.who : '*' };
      if (alarms === 1) {
        return {
          world: { reactions: [{ on: 'seen', match, do: 'emit', type: 'spotted' }], hud: [{ on: 'spotted', text: typeof p.text === 'string' && p.text ? p.text : 'Spotted!', ttl: 2 }] },
          on: { spotted: { end: 'fail' } },
        };
      }
      const v = `__seen_${ctx.i}`;
      return {
        world: {
          vars: { [v]: 0 },
          reactions: [{ on: 'seen', match, do: 'inc', var: v, by: 1 }],
          watches: [{ type: 'spotted', when: { var: v, gte: alarms } }],
          hud: [{ var: v, label: 'Seen', as: 'counter', max: alarms }, { on: 'seen', text: 'Seen!', as: 'toast', ttl: 1.2 }],
        },
        on: { spotted: { end: 'fail' } },
      };
    },
  },

  // pass the checkpoints in order, `laps` times → success, against the clock (a terminal). The last checkpoint is the
  // finish line; one out of order does nothing. The run's time (tenths of a second) is the level's kept number: the
  // shell remembers the lowest.
  // RIVALS (`rivals: [entity id]`): each passes the same checkpoints, counted on the bus by its own zones. Per rival a
  // lead (the player's passes less its own) and an ahead flag; the place is one more than the rivals ahead (a tie goes
  // to whoever passed first). The finish is `race:won` at a place of `win` or better (1 by default), else `race:lost`;
  // the best place is kept too.
  laps: {
    role: 'terminal', ends: ['success', 'fail'], requires: [],
    lower(p, ctx) {
      const cps = Array.isArray(p.checkpoints) ? p.checkpoints : [];
      if (!cps.length || !cps.every((c) => c && Array.isArray(c.at))) throw new Error(`laps[${ctx.i}]: needs checkpoints: [{ at, radius? }, …] in order, the last the finish`);
      const laps = Number.isInteger(p.laps) && p.laps > 0 ? p.laps : 1, i = ctx.i, last = cps.length - 1;
      const next = `__cp_${i}`, lap = `__lap_${i}`, t = `__race_${i}`, ts = `__race_s_${i}`, over = `__race_over_${i}`;
      const world = {
        vars: { [next]: 0, [lap]: 0, [t]: 0, [ts]: 0, [over]: 0 },
        sources: [], reactions: [],
        timers: [
          { every: 0.1, emit: { type: `__race_tick_${i}` }, while: { var: over, eq: 0 } },
          { every: 1, emit: { type: `__race_sec_${i}` }, while: { var: over, eq: 0 } },
        ],
        watches: [{ type: 'laps:done', when: { var: lap, gte: laps } }],
        hud: [{ var: ts, label: 'Time', as: 'clock' }, ...(laps > 1 ? [{ var: lap, label: 'Lap', as: 'counter', max: laps }] : []), { on: 'checkpoint', text: 'checkpoint', as: 'toast', ttl: 1 }],
      };
      const rivals = Array.isArray(p.rivals) ? p.rivals.filter((r) => typeof r === 'string' && r) : [];
      const pass = `__pass_${i}`;
      // the rivals' zones watch what their ids share (rival-1, rival-2 … → rival-*)
      let share = rivals[0] ?? '';
      for (const r of rivals) while (!r.startsWith(share)) share = share.slice(0, -1);
      cps.forEach((c, j) => {
        const zone = `cp_${i}_${j}`;
        world.sources.push({ type: 'zone', zone, at: c.at, radius: Number.isFinite(c.radius) ? c.radius : 3, planar: c.planar !== false, watch: ctx.player });
        const due = { var: next, eq: j };
        if (j < last) {
          // the emit first: the set after it moves the guard on
          world.reactions.push({ on: 'enter', match: { zone }, if: due, do: 'emit', type: 'checkpoint', at: j });
          if (rivals.length) world.reactions.push({ on: 'enter', match: { zone }, if: due, do: 'emit', type: pass });
          world.reactions.push({ on: 'enter', match: { zone }, if: due, do: 'set', var: next, to: j + 1 });
        } else {
          if (rivals.length) world.reactions.push({ on: 'enter', match: { zone }, if: due, do: 'emit', type: pass });
          world.reactions.push({ on: 'enter', match: { zone }, if: due, do: 'emit', type: 'lap' });
        }
        // the rivals' passes: one zone for them all, each rival its own next checkpoint
        if (rivals.length) {
          const rz = `rcp_${i}_${j}`;
          world.sources.push({ type: 'zone', zone: rz, at: c.at, radius: Number.isFinite(c.radius) ? c.radius : 3, planar: c.planar !== false, watch: `${share}*` });
          rivals.forEach((r) => {
            const rnext = `__cp_${i}_${r}`, rdue = { var: rnext, eq: j };
            world.reactions.push({ on: 'enter', match: { zone: rz, entity: r }, if: rdue, do: 'emit', type: `__rpass_${i}_${r}` });
            world.reactions.push({ on: 'enter', match: { zone: rz, entity: r }, if: rdue, do: 'set', var: rnext, to: j < last ? j + 1 : 0 });
          });
        }
      });
      world.reactions.push(
        { on: 'lap', do: 'inc', var: lap, by: 1 },
        { on: 'lap', do: 'set', var: next, to: 0 },
        { on: `__race_tick_${i}`, do: 'inc', var: t, by: 1 },
        { on: `__race_sec_${i}`, do: 'inc', var: ts, by: 1 },
        { on: 'laps:done', do: 'set', var: over, to: 1 },
      );
      if (rivals.length) {
        // the place: the lead over each rival moves at every pass; crossing zero flips its ahead flag and the place
        const place = `__place_${i}`, win = Number.isInteger(p.win) && p.win >= 1 ? p.win : 1;
        world.vars[place] = 1;
        rivals.forEach((r) => {
          const lead = `__lead_${i}_${r}`, ahead = `__ahead_${i}_${r}`, gets = `__gets_${i}_${r}`, falls = `__falls_${i}_${r}`;
          Object.assign(world.vars, { [`__cp_${i}_${r}`]: 0, [lead]: 0, [ahead]: 0 });
          world.reactions.push(
            { on: `__rpass_${i}_${r}`, do: 'inc', var: lead, by: -1 },
            { on: `__rpass_${i}_${r}`, if: { var: lead, lt: 0 }, do: 'emit', type: gets },
            { on: gets, if: { var: ahead, eq: 0 }, do: 'inc', var: place, by: 1 },
            { on: gets, if: { var: ahead, eq: 0 }, do: 'set', var: ahead, to: 1 },
            { on: pass, do: 'inc', var: lead, by: 1 },
            { on: pass, if: { var: lead, gt: 0 }, do: 'emit', type: falls },
            { on: falls, if: { var: ahead, eq: 1 }, do: 'inc', var: place, by: -1 },
            { on: falls, if: { var: ahead, eq: 1 }, do: 'set', var: ahead, to: 0 },
          );
        });
        world.hud.push({ var: place, label: 'Place', as: 'counter', max: rivals.length + 1 });
        world.reactions.push(
          { on: 'laps:done', if: { var: place, lte: win }, do: 'emit', type: 'race:won' },
          { on: 'laps:done', if: { var: place, gt: win }, do: 'emit', type: 'race:lost' },
        );
        return {
          world,
          on: { 'race:won': { end: 'success' }, 'race:lost': { end: 'fail' } },
          keep: [{ var: t, label: typeof p.label === 'string' && p.label ? p.label : 'Time', best: 'low', scale: 0.1, unit: 's' }, { var: place, label: 'Place', best: 'low' }],
          audit: { kind: 'walkto', target: cps[last].at, ...(last ? { via: cps.slice(0, last).map((c) => c.at) } : {}) },
        };
      }
      return {
        world,
        on: { 'laps:done': { end: 'success' } },
        keep: [{ var: t, label: typeof p.label === 'string' && p.label ? p.label : 'Time', best: 'low', scale: 0.1, unit: 's' }],
        audit: { kind: 'walkto', target: cps[last].at, ...(last ? { via: cps.slice(0, last).map((c) => c.at) } : {}) },
      };
    },
  },

  // ON THE BEAT (an emitter): each `beat` on the bus (the music's: a level's audio.beat says them, `lead` early) opens a
  // window `window` seconds wide; a press inside it is `beat:hit` (once a beat), one outside it `beat:miss`. `misses`
  // ends the level in fail; pair with score (points on beat:hit) and a terminal. `key` is the press (Space: the jump).
  'on-beat': {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const w = Number.isFinite(p.window) && p.window > 0.02 && p.window <= 0.5 ? p.window : 0.3, i = ctx.i;
      const win = `__win_${i}`, press = `__press_${i}`, missed = `__miss_${i}`;
      const misses = Number.isInteger(p.misses) && p.misses > 0 ? p.misses : null;
      const world = {
        vars: { [win]: 0, ...(misses ? { [missed]: 0 } : {}) },
        inputs: [{ on: 'key', key: typeof p.key === 'string' && p.key ? p.key : ' ', once: true, emit: { type: press } }],
        // the window: open on the beat, shut `window` later (a saga per beat; a beat's window ends before the next)
        sequences: [{ id: `__beatwin_${i}`, trigger: { on: 'beat' }, steps: [{ do: 'set', var: win, to: 1, await: { timer: w } }, { do: 'set', var: win, to: 0 }] }],
        reactions: [
          { on: press, if: { var: win, eq: 1 }, do: 'emit', type: 'beat:hit' },
          { on: press, if: { var: win, eq: 0 }, do: 'emit', type: 'beat:miss' },
          { on: 'beat:hit', do: 'set', var: win, to: 2 },   // one hit a beat: a second press in its window is neither
          ...(misses ? [{ on: 'beat:miss', do: 'inc', var: missed, by: 1 }] : []),
        ],
        ...(misses ? { watches: [{ type: 'offbeat', when: { var: missed, gte: misses } }] } : {}),
        hud: [
          { on: 'beat', text: '♪', as: 'toast', slot: 'bottom', ttl: 0.35 },
          { on: 'beat:hit', text: 'on the beat!', as: 'toast', ttl: 0.6, color: 'goal' },
          { on: 'beat:miss', text: 'off', as: 'toast', ttl: 0.6, color: 'harm' },
          ...(misses ? [{ var: missed, label: 'Misses', as: 'counter', max: misses }] : []),
        ],
      };
      return { world, emits: ['beat:hit', 'beat:miss'], ...(misses ? { on: { offbeat: { end: 'fail' } } } : {}) };
    },
  },

  // WAVES (a terminal: success and fail). Foes minted asleep (dormant) wake in waves and walk `path` to the base; one
  // that arrives costs a life and is sent away, one that falls pays `bounty` into the purse. Every foe accounted for:
  // success; no lives left: fail. `waves`: [{ after: s, foes: [id], every?: s }], after the previous wave's last foe.
  waves: {
    role: 'terminal', ends: ['success', 'fail'], requires: [],
    lower(p, ctx) {
      const waves = Array.isArray(p.waves) ? p.waves : [];
      const path = Array.isArray(p.path) ? p.path.filter((q) => Array.isArray(q) && q.length >= 2) : [];
      if (!waves.length || !waves.every((w) => w && Array.isArray(w.foes) && w.foes.length && w.foes.every((f) => typeof f === 'string' && f))) throw new Error(`waves[${ctx.i}]: needs waves: [{ after?, foes: [id, …], every? }] (foes minted dormant)`);
      if (!path.length) throw new Error(`waves[${ctx.i}]: needs path: [[x, y], …], the foes' walk to the base`);
      const i = ctx.i, lives = Number.isInteger(p.lives) && p.lives > 0 ? p.lives : 5, total = waves.reduce((n, w) => n + w.foes.length, 0);
      const L = `__lives_${i}`, done = `__done_${i}`, who = typeof p.who === 'string' && p.who ? p.who : 'foe-*';
      const purse = p.purse && typeof p.purse.var === 'string' ? p.purse : null, bounty = Number.isFinite(p.bounty) ? p.bounty : 1;
      const speed = Number.isFinite(p.speed) && p.speed > 0 ? p.speed : 2.2;
      const steps = [];
      waves.forEach((w, k) => {
        steps.push({ await: { timer: Number.isFinite(w.after) ? w.after : k ? 8 : 4 } }, { do: 'emit', type: 'wave', n: k + 1, of: waves.length });
        w.foes.forEach((f, j) => {
          if (j) steps.push({ await: { timer: Number.isFinite(w.every) ? w.every : 1.6 } });
          steps.push({ do: 'ctrl', op: 'spawn', who: f }, { do: 'ctrl', op: 'walk', who: f, points: path.map((q) => [q[0], q[1]]), speed, then: 'stay' });
        });
      });
      const world = {
        vars: { [L]: lives, [done]: 0, ...(purse ? { [purse.var]: Number.isFinite(purse.start) ? purse.start : 0 } : {}) },
        initial: [{ type: `__waves_go_${i}` }],
        sequences: [{ id: `__waves_${i}`, trigger: { on: `__waves_go_${i}` }, steps }],
        reactions: [
          { on: 'arrive', match: { entity: who, last: 1 }, do: 'emit', type: 'leak', entity: 'event.entity' },
          { on: 'leak', do: 'inc', var: L, by: -1, min: 0 },
          { on: 'leak', do: 'inc', var: done, by: 1 },
          { on: 'leak', do: 'ctrl', op: 'vanish', who: 'event.entity' },
          { on: 'down', match: { entity: who }, do: 'inc', var: done, by: 1 },
          ...(purse ? [{ on: 'down', match: { entity: who }, do: 'inc', var: purse.var, by: bounty }] : []),
        ],
        watches: [{ type: 'base:fallen', when: { var: L, lte: 0 } }, { type: 'waves:cleared', when: { var: done, gte: total } }],
        hud: [
          { var: L, label: 'Lives', as: 'counter', max: lives },
          ...(purse ? [{ var: purse.var, label: typeof purse.label === 'string' ? purse.label : 'Gold', as: 'counter' }] : []),
          { on: 'wave', text: 'Wave {event.n} of {event.of}', ttl: 2 },
          { on: 'leak', text: 'one got through', as: 'toast', ttl: 1.2, color: 'harm' },
        ],
      };
      return { world, on: { 'waves:cleared': { end: 'success' }, 'base:fallen': { end: 'fail' } } };
    },
  },

  // PUSH (a terminal): a grid of cells (`cols` × `rows`, `cell` metres, from `origin` its corner) with boulders on some
  // and plates on others. Walking into a boulder's cell from a side pushes it one cell on, if that cell is free (in
  // the grid, no wall, no boulder); else the walker is put back. Every plate under a boulder: success. All on the bus:
  // a zone per cell, the walker's last cell a var, guarded reactions per cell and side, a marker per cell shown while
  // a boulder stands there.
  push: {
    role: 'terminal', ends: ['success'], requires: [],
    lower(p, ctx) {
      const cols = p.cols, rows = p.rows, cell = Number.isFinite(p.cell) && p.cell > 0.5 ? p.cell : 2.5, o = p.origin;
      const ok = (q) => Array.isArray(q) && Number.isInteger(q[0]) && Number.isInteger(q[1]) && q[0] >= 0 && q[1] >= 0 && q[0] < cols && q[1] < rows;
      if (!(Number.isInteger(cols) && Number.isInteger(rows) && cols >= 2 && rows >= 2 && cols * rows <= 144) || !Array.isArray(o)) throw new Error(`push[${ctx.i}]: needs origin: [x, y, z], cols and rows (2 or more, 144 cells at most), cell?`);
      for (const k of ['blocks', 'plates']) if (!Array.isArray(p[k]) || !p[k].length || !p[k].every(ok)) throw new Error(`push[${ctx.i}]: ${k} are cells [col, row] inside the grid`);
      const walls = Array.isArray(p.walls) ? p.walls.filter(ok) : [];
      if (p.plates.length > p.blocks.length) throw new Error(`push[${ctx.i}]: more plates than boulders can never all be held`);
      const i = ctx.i, key = (q) => `${q[0]}_${q[1]}`, has = (list, q) => list.some((x) => x[0] === q[0] && x[1] === q[1]);
      // `heights`: each cell's ground, row by row (a grid laid on uneven land), else the origin's
      const hz = (q) => (Array.isArray(p.heights) && Array.isArray(p.heights[q[1]]) && Number.isFinite(p.heights[q[1]][q[0]]) ? p.heights[q[1]][q[0]] : o[2] ?? 0);
      const at = (q) => [Math.round((o[0] + (q[0] + 0.5) * cell) * 1000) / 1000, Math.round((o[1] + (q[1] + 0.5) * cell) * 1000) / 1000, hz(q)];
      const occ = (q) => `__occ_${i}_${key(q)}`, blk = (q) => `__blk_${i}_${key(q)}`, last = `__pc_${i}`, held = `__held_${i}`, idx = (q) => q[0] + q[1] * cols;
      const world = { vars: { [last]: -1, [held]: p.plates.filter((q) => has(p.blocks, q)).length }, sources: [], reactions: [], entities: [], watches: [], hud: [] };
      const cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!has(walls, [c, r])) cells.push([c, r]);
      const free = (q) => ok(q) && !has(walls, q);
      for (const q of cells) {
        world.vars[occ(q)] = has(p.blocks, q) ? 1 : 0;
        world.entities.push({ id: blk(q), type: 'boulder', on: has(p.blocks, q), position: [at(q)[0], at(q)[1], at(q)[2] + cell * 0.36], radius: cell * 0.36, color: has(p.plates, q) ? '#c9a24a' : '#8a8178' });
        world.sources.push({ type: 'zone', zone: `cell_${i}_${key(q)}`, at: at(q), half: [cell / 2, cell / 2, 4], planar: true, watch: ctx.player });
      }
      for (const q of cells) {
        const zone = `cell_${i}_${key(q)}`;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const from = [q[0] - dx, q[1] - dy], to = [q[0] + dx, q[1] + dy];
          if (!free(from)) continue;
          const t1 = `__push_${i}_${key(q)}_${dx}_${dy}`, t2 = `${t1}:b`;
          world.reactions.push({ on: 'enter', match: { zone }, if: { var: last, eq: idx(from) }, do: 'emit', type: t1 });
          world.reactions.push({ on: t1, if: { var: occ(q), eq: 1 }, do: 'emit', type: t2 });
          const bump = [{ on: t2, do: 'move', target: ctx.player, to: at(from) }, { on: t2, do: 'emit', type: 'bump' }];
          if (!free(to)) { world.reactions.push(...bump); continue; }
          world.reactions.push(
            { on: t2, if: { var: occ(to), eq: 1 }, do: 'move', target: ctx.player, to: at(from) },
            { on: t2, if: { var: occ(to), eq: 1 }, do: 'emit', type: 'bump' },
            // the boulder moves on: the cell it leaves clears after its next one is taken (the guard reads the old value)
            { on: t2, if: { var: occ(to), eq: 0 }, do: 'emit', type: `${t1}:go` },
            { on: `${t1}:go`, do: 'set', var: occ(to), to: 1 },
            { on: `${t1}:go`, do: 'set', var: occ(q), to: 0 },
            { on: `${t1}:go`, do: 'toggle', target: blk(q), to: false },
            { on: `${t1}:go`, do: 'toggle', target: blk(to), to: true },
            { on: `${t1}:go`, do: 'emit', type: 'pushed' },
            ...(has(p.plates, q) ? [{ on: `${t1}:go`, do: 'inc', var: held, by: -1 }] : []),
            ...(has(p.plates, to) ? [{ on: `${t1}:go`, do: 'inc', var: held, by: 1 }] : []),
          );
        }
        // after the pushes were tried (they read where the walker came from), this is its cell
        world.reactions.push({ on: 'enter', match: { zone }, do: 'set', var: last, to: idx(q) });
      }
      // the plates, drawn flat (a marker per plate under the grid's boulders), and the count held
      p.plates.forEach((q, k) => world.entities.push({ id: `__plate_${i}_${k}`, type: 'plate', on: true, position: [at(q)[0], at(q)[1], at(q)[2] + 0.05], radius: cell * 0.18, color: '#e8c35a' }));
      world.watches.push({ type: 'plates:held', when: { var: held, gte: p.plates.length } });
      world.hud.push({ var: held, label: 'Plates', as: 'counter', max: p.plates.length }, { on: 'bump', text: 'it will not move', as: 'toast', ttl: 0.8 });
      return { world, on: { 'plates:held': { end: 'success' } }, emits: ['pushed'] };
    },
  },

  // THE CLOCK (an emitter): the world's time of day on the bus. `minute` (0 to 1439) runs `rate` game minutes a real
  // second (2: a day in twelve minutes) from `start` (an hour, 8); `hour` and `day` (from 1) follow it; `dawn` at six,
  // `dusk` at eighteen, `midnight` as a day turns. With `seasons` (days each, 4 names), `season` (0 to 3) turns with the
  // days. What reads it: the sky (a level with a clock darkens at night: the weather channel), a cue on `hour`, crops.
  clock: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const start = Number.isFinite(p.start) && p.start >= 0 && p.start < 24 ? p.start : 8, rate = Number.isFinite(p.rate) && p.rate > 0 && p.rate <= 60 ? p.rate : 2;
      const m0 = Math.round(start * 60), seasons = Number.isInteger(p.seasons) && p.seasons > 0 ? p.seasons : 0;
      const world = {
        vars: { __clock: 1, minute: m0, hour: Math.floor(start), day: 1, ...(seasons ? { season: 0 } : {}) },
        timers: [{ every: 1, emit: { type: '__tick_clock' } }],
        reactions: [{ on: '__tick_clock', do: 'inc', var: 'minute', by: rate }],
        watches: [],
        hud: [{ var: 'day', label: 'Day' }, { var: 'hour', label: 'Hour' }, { on: 'dawn', text: 'Day {day}', ttl: 2 }],
      };
      // each hour as the minutes cross it (a watch fires once a day, on its edge)
      for (let h = 1; h < 24; h++) {
        world.watches.push({ type: `__hour_${h}`, when: { var: 'minute', gte: h * 60 } });
        // (only the hour the minute is in: a clock set forward many hours at once crosses them all on one frame)
        world.reactions.push({ on: `__hour_${h}`, if: { var: 'minute', lt: (h + 1) * 60 }, do: 'set', var: 'hour', to: h });
      }
      world.watches.push({ type: 'midnight', when: { var: 'minute', gte: 1440 } });
      world.reactions.push(
        { on: 'midnight', do: 'inc', var: 'minute', by: -1440 }, { on: 'midnight', do: 'inc', var: 'day', by: 1 },
        // the hour the turned minute is in (a fast clock may run past midnight within a tick): midnight's own, then each
        // hour it has already passed, each taking only if the minute is in it
        { on: 'midnight', if: { var: 'minute', lt: 60 }, do: 'set', var: 'hour', to: 0 },
        ...Array.from({ length: 23 }, (_, k) => ({ on: 'midnight', if: { var: 'minute', gte: (k + 1) * 60 }, do: 'emit', type: `__hour_${k + 1}` })),
        { on: '__hour_6', do: 'emit', type: 'dawn' }, { on: '__hour_18', do: 'emit', type: 'dusk' },
      );
      if (seasons) {
        // the season turns every `seasons` days: a count of days into it, back to 0 at each turn
        world.vars.__sday = 0;
        world.reactions.push({ on: 'midnight', do: 'inc', var: '__sday', by: 1 });
        world.watches.push({ type: '__season_turn', when: { var: '__sday', gte: seasons } });
        world.reactions.push({ on: '__season_turn', do: 'set', var: '__sday', to: 0 });
        for (let s = 0; s < 4; s++) world.reactions.push({ on: '__season_turn', if: { var: 'season', eq: s }, do: 'emit', type: `__season_${(s + 1) % 4}` });
        for (let s = 0; s < 4; s++) world.reactions.push({ on: `__season_${s}`, do: 'set', var: 'season', to: s }, { on: `__season_${s}`, do: 'emit', type: 'season' });
      }
      return { world, emits: ['dawn', 'dusk', 'midnight'] };
    },
  },

  // CROPS (an emitter). Plots the walker uses (E): an empty one is planted for `cost` from the purse; at each dawn a
  // crop grows a stage (sprout, grown, ripe: `days` dawns to ripen, 2 at least); a ripe one is harvested for `price`
  // into the purse. `by` (a day): when it passes, fail. Needs a clock (its dawn); win it with win-when on the purse.
  // Each stage is a marker on the plot.
  crops: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const plots = Array.isArray(p.plots) ? p.plots.filter((x) => x && Array.isArray(x.at)) : [];
      if (!plots.length) throw new Error(`crops[${ctx.i}]: needs plots: [{ at }, …]`);
      const purse = p.purse && typeof p.purse.var === 'string' ? p.purse : { var: 'gold', start: 10 };
      const cost = Number.isFinite(p.cost) ? p.cost : 2, price = Number.isFinite(p.price) ? p.price : 6, days = Number.isInteger(p.days) && p.days >= 2 ? p.days : 2, i = ctx.i;
      const world = { vars: { [purse.var]: Number.isFinite(purse.start) ? purse.start : 10 }, sources: [], reactions: [], entities: [], watches: [], hud: [{ var: purse.var, label: purse.label || 'Gold', as: 'counter' }] };
      // stages: 0 empty, 1 … days-1 growing, days ripe; the growing markers grow
      plots.forEach((pl, k) => {
        const id = `plot-${i}-${k + 1}`, st = `__crop_${i}_${k}`, at = pl.at;
        world.vars[st] = 0;
        world.sources.push({ type: 'zone', zone: `use-${id}`, at, radius: 1.6, planar: true, watch: ctx.player, use: id, prompt: `plant (${cost}) · harvest` });
        world.entities.push({ id: `__soil_${i}_${k}`, type: 'soil', on: true, position: [at[0], at[1], (at[2] ?? 0) + 0.05], radius: 0.9, color: '#5a3d26' });
        for (let s = 1; s <= days; s++) world.entities.push({ id: `__sprout_${i}_${k}_${s}`, type: 'crop', on: false, position: [at[0], at[1], (at[2] ?? 0) + 0.15 + 0.2 * s], radius: 0.15 + (0.35 * s) / days, color: s === days ? '#e8b923' : '#5fae3a' });
        const use = `use-${id}`;
        world.reactions.push(
          // plant: an empty plot, the purse holding the cost
          { on: use, if: { var: st, eq: 0 }, do: 'emit', type: `__plant_${i}_${k}` },
          { on: `__plant_${i}_${k}`, if: { var: purse.var, gte: cost }, do: 'emit', type: `__planted_${i}_${k}` },
          { on: `__plant_${i}_${k}`, if: { var: purse.var, lt: cost }, do: 'emit', type: 'crops:poor' },
          { on: `__planted_${i}_${k}`, do: 'inc', var: purse.var, by: -cost },
          { on: `__planted_${i}_${k}`, do: 'set', var: st, to: 1 },
          { on: `__planted_${i}_${k}`, do: 'toggle', target: `__sprout_${i}_${k}_1`, to: true },
          { on: `__planted_${i}_${k}`, do: 'emit', type: 'planted' },
          // harvest: a ripe one
          { on: use, if: { var: st, eq: days }, do: 'emit', type: `__harvest_${i}_${k}` },
          { on: `__harvest_${i}_${k}`, do: 'set', var: st, to: 0 },
          { on: `__harvest_${i}_${k}`, do: 'toggle', target: `__sprout_${i}_${k}_${days}`, to: false },
          { on: `__harvest_${i}_${k}`, do: 'inc', var: purse.var, by: price },
          { on: `__harvest_${i}_${k}`, do: 'emit', type: 'harvested' },
        );
        // each dawn a growing crop takes its next stage (the highest stage first: one step a dawn)
        for (let s = days - 1; s >= 1; s--) {
          world.reactions.push({ on: 'dawn', if: { var: st, eq: s }, do: 'emit', type: `__grow_${i}_${k}_${s}` });
          world.reactions.push(
            { on: `__grow_${i}_${k}_${s}`, do: 'set', var: st, to: s + 1 },
            { on: `__grow_${i}_${k}_${s}`, do: 'toggle', target: `__sprout_${i}_${k}_${s}`, to: false },
            { on: `__grow_${i}_${k}_${s}`, do: 'toggle', target: `__sprout_${i}_${k}_${s + 1}`, to: true },
          );
        }
      });
      world.hud.push({ on: 'planted', text: 'planted', as: 'toast', ttl: 0.8 }, { on: 'harvested', text: '+' + price, as: 'toast', ttl: 0.8, color: 'value' }, { on: 'crops:poor', text: `seed costs ${cost}`, as: 'toast', ttl: 1 });
      const out = { world, emits: ['planted', 'harvested'], needs: ['dawn'] };
      if (Number.isInteger(p.by)) {
        world.watches.push({ type: 'crops:late', when: { var: 'day', gt: p.by } });
        out.on = { 'crops:late': { end: 'fail' } };
      }
      return out;
    },
  },

  // AFTERMATH (an emitter): what broke here stays broken. Each block that breaks (the level's destruction) is kept as a
  // flag (`broke:<id>`) in a flags slice the game carries; entering again, the level takes those blocks away at the
  // start, without the shatter. The world remembers the damage done to it.
  aftermath: {
    role: 'emitter', requires: ['flags'],
    lower(p, ctx) {
      const slice = ctx.resolve('flags', p.slice, `aftermath[${ctx.i}]`);
      return {
        world: { vars: { __broken: 0 }, reactions: [{ on: 'broke', do: 'inc', var: '__broken', by: 1 }] },
        produces: [{ type: 'setFlag', slice }],
        on: { 'broke:*': { emit: { type: 'setFlag', slice, key: '{event}', value: true } } },
        consumes: [{ slice }],
        aftermath: { slice },
      };
    },
  },

  // the BAG carried (an emitter): what the player holds goes from level to level. The level starts with the inventory
  // slice's items in its bag (held:bag:<item>, playscape/ui/items.js), and every item that comes into or leaves the
  // bag on the bus (`bag:in` / `bag:out`: a buy, a take, a give, a use) goes back to the slice as grant / consume. A
  // collect into the same slice grants its own pickups (its bag counts are the same numbers).
  // `worn`: an inventory slice what the player wears is carried in (playscape/ui/items.js equip; its on effects done
  // again as a level starts); `holders`: a flags slice what each chest and counted shop of the level still holds is kept
  // in, so a chest emptied stays empty
  bag: {
    role: 'emitter', requires: ['inventory'],
    lower(p, ctx) {
      const slice = ctx.resolve('inventory', p.slice, `bag[${ctx.i}]`);
      const worn = p.worn === undefined ? null : ctx.resolve('inventory', p.worn, `bag[${ctx.i}].worn`);
      const holders = p.holders === undefined ? null : ctx.resolve('flags', p.holders, `bag[${ctx.i}].holders`);
      if (worn && worn === slice) throw new Error(`bag[${ctx.i}]: worn is its own inventory slice, not the bag's`);
      return {
        produces: [{ type: 'grant', slice }, { type: 'consume', slice }, ...(worn ? [{ type: 'grant', slice: worn }, { type: 'consume', slice: worn }] : []), ...(holders ? [{ type: 'setFlag', slice: holders }] : [])],
        consumes: [{ slice }, ...(worn ? [{ slice: worn }] : []), ...(holders ? [{ slice: holders }] : [])],
        bag: { slice, ...(worn ? { worn } : {}), ...(holders ? { holders } : {}) },
      };
    },
  },

  // a SCORE (an emitter): a var the level counts up, shown, and kept: the shell remembers the best (`best: 'high'`, or
  // 'low' for a count to keep down). `points` scores bus events: [{ on: '<event>', by?: 1 }].
  score: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const v = typeof p.var === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(p.var) ? p.var : 'score';
      const label = typeof p.label === 'string' && p.label ? p.label : 'Score';
      const best = p.best === 'low' ? 'low' : 'high';
      const points = Array.isArray(p.points) ? p.points : [];
      if (!points.every((x) => x && typeof x.on === 'string' && x.on)) throw new Error(`score[${ctx.i}]: points are [{ on: '<bus event>', by?: n }]`);
      return {
        world: {
          vars: { [v]: 0 },
          reactions: points.map((x) => ({ on: x.on, ...(x.match ? { match: x.match } : {}), do: 'inc', var: v, by: Number.isFinite(x.by) ? x.by : 1 })),
          hud: [{ var: v, label, as: 'counter' }],
        },
        keep: [{ var: v, label, best }],
      };
    },
  },

  // FRAGS (a terminal): a deathmatch. The player and `rivals` (the others' ids, each a character with hp) are contenders;
  // a fall is credited to whoever hit the fallen last (its hit:<id>'s `by`), said on the bus as `kill { killer,
  // victim }`, and the fallen comes back `respawn` seconds later at the one of `spawns` farthest from the living (the
  // cast's `among`), guarded `guard` seconds (2; 0: none) or until it fires. The player's hp is the level's (`hp`, `hits` a hit): at 0 it falls as the others
  // do (the cast's kill holds it), back with full hp. First to `frags` wins it (the player: `frags:won`; anyone else:
  // `frags:lost`); with `seconds`, the clock ends it too and the place decides (`win` or better wins). The place is the
  // laps rivals' lead: one more than the contenders strictly ahead, a tie to whoever got there first. Its frags and
  // place are kept. Lowers to vars, guarded reactions, watches, a timer, a sequence per contender and the cast's kill
  // and spawn: every verb Godot's bus performs. `damage: true`: the player's hp takes each round's own damage (a web
  // round's: Godot's hits say none).
  // TEAMS (`teams: { <name>: [ids], <name>: [ids] }`, two of them, every contender in one): a fall counts for the
  // felling side only when it felled the other side (a teammate's hit is never credited); the first SIDE to `frags`
  // wins; at the horn the side ahead wins (a tie is lost); each side comes back at its own spawns (`spawns` keyed by
  // side) or the shared ones. Kept: the player's frags and its side's.
  frags: {
    role: 'terminal', ends: ['success', 'fail'], requires: [],
    lower(p, ctx) {
      const i = ctx.i, P = ctx.player;
      const who = Array.isArray(p.rivals) ? p.rivals.filter((w) => typeof w === 'string' && w && w !== P) : [];
      if (!who.length || new Set(who).size !== who.length) throw new Error(`frags[${i}]: needs rivals: ['<id>', …], the others in the match (characters with hp), each once`);
      const frags = Number.isInteger(p.frags) && p.frags >= 1 ? p.frags : 10;
      if (p.frags !== undefined && p.frags !== frags) throw new Error(`frags[${i}]: frags is the limit that wins, a whole number from 1`);
      const seconds = p.seconds === undefined ? null : Number.isInteger(p.seconds) && p.seconds >= 10 ? p.seconds : NaN;
      if (Number.isNaN(seconds)) throw new Error(`frags[${i}]: seconds is the time limit, a whole number from 10`);
      const respawn = p.respawn === undefined ? 3 : Number.isFinite(p.respawn) && p.respawn >= 0 ? p.respawn : NaN;
      if (Number.isNaN(respawn)) throw new Error(`frags[${i}]: respawn is the seconds the fallen lie, 0 or more`);
      // the sides (two), each contender in one
      let side = null, sides = null;
      if (p.teams !== undefined) {
        const T = p.teams, names = T && typeof T === 'object' && !Array.isArray(T) ? Object.keys(T) : [];
        const all = [P, ...who], listed = names.flatMap((k) => (Array.isArray(T[k]) ? T[k] : [null]));
        if (names.length !== 2 || listed.length !== all.length || new Set(listed).size !== listed.length || !all.every((c) => listed.includes(c))) throw new Error(`frags[${i}]: teams are two sides { <name>: ['<id>', …], <name>: […] }, the player and every rival in one, once`);
        sides = names; side = Object.fromEntries(names.flatMap((k) => T[k].map((c) => [c, k])));
      }
      const spawnList = (L) => Array.isArray(L) && L.every((s) => Array.isArray(s) && s.length >= 2 && s.every(Number.isFinite));
      const spawns = Array.isArray(p.spawns) ? p.spawns : [], spawnsOf = sides && p.spawns && !Array.isArray(p.spawns) ? p.spawns : null;
      if (spawnsOf ? !sides.every((k) => spawnList(spawnsOf[k])) : !spawnList(spawns)) throw new Error(`frags[${i}]: spawns are [[x, y, z?], …], where the fallen come back${sides ? ' (or { <side>: [[x, y, z?], …] } per side)' : ''}`);
      const guard = p.guard === undefined ? 2 : Number.isFinite(p.guard) && p.guard >= 0 ? p.guard : NaN;
      if (Number.isNaN(guard)) throw new Error(`frags[${i}]: guard is the seconds a body back on its feet is not hurt, 0 or more`);
      const hp = Number.isFinite(p.hp) && p.hp > 0 ? p.hp : 100, hits = Number.isFinite(p.hits) && p.hits > 0 ? p.hits : 10;
      const C = [P, ...who], n = C.length, win = Number.isInteger(p.win) && p.win >= 1 ? Math.min(p.win, n) : 1;
      const team = (k) => `__team_${i}_${k}`, frag = (c) => `__frag_${i}_${c}`, last = (c) => `__lh_${i}_${c}`, fell = (c) => `__fell_${i}_${c}`, rise = (c) => `__rise_${i}_${c}`;
      const tlead = `__tlead_${i}`, over = `__frags_over_${i}`, place = `__place_${i}`, clock = `__frags_t_${i}`, deaths = `__deaths_${i}`, mine = `__pf_${i}`, live = { var: over, eq: 0 };
      const world = { vars: { hp, [over]: 0, [place]: 1, [deaths]: 0 }, reactions: [], watches: [], sequences: [], timers: [], hud: [] };
      C.forEach((c) => {
        Object.assign(world.vars, { [frag(c)]: 0, [last(c)]: 0 });
        // who hit it last (0: nobody since it last came back); with sides, only the other side's hits count
        const foe = (a) => a !== c && (!side || side[a] !== side[c]);
        C.forEach((a, j) => { if (foe(a)) world.reactions.push({ on: `hit:${c}`, match: { by: a }, do: 'set', var: last(c), to: j + 1 }); });
        // its fall, credited to the last hitter, said as a kill (and counted for the hitter's side)
        C.forEach((a, j) => {
          if (!foe(a)) return;
          const got = { var: last(c), eq: j + 1 };
          world.reactions.push(
            { on: fell(c), if: got, do: 'inc', var: frag(a), by: 1 },
            { on: fell(c), if: got, do: 'emit', type: 'kill', killer: a, victim: c },
            ...(side ? [{ on: fell(c), if: got, do: 'inc', var: team(side[a]), by: 1 }, { on: fell(c), if: got, do: 'inc', var: tlead, by: side[a] === side[P] ? 1 : -1 }] : []),
            { on: fell(c), if: got, do: 'emit', type: a === P ? mine : `__bf_${i}_${a}` },
          );
        });
        world.reactions.push({ on: fell(c), do: 'set', var: last(c), to: 0 });
        // back after its time, at the spawn farthest from the living (none: where it lies), fresh (the loadout it was minted
        // with, rounds full) and guarded
        world.sequences.push({ id: `__respawn_${i}_${c}`, trigger: { on: fell(c) }, steps: [{ await: { timer: respawn } }, { do: 'emit', type: rise(c) }] });
        const own = spawnsOf ? spawnsOf[side[c]] : spawns;
        world.reactions.push({ on: rise(c), do: 'ctrl', op: 'spawn', who: c, ...(own.length ? { among: own.map((s) => s.slice(0, 3)) } : {}), fresh: true, ...(guard ? { guard } : {}) });
        // the limit (a side's, with sides)
        if (!side) {
          world.watches.push({ type: `__top_${i}_${c}`, when: { var: frag(c), gte: frags } });
          world.reactions.push({ on: `__top_${i}_${c}`, if: live, do: 'emit', type: c === P ? 'frags:won' : 'frags:lost' });
        }
      });
      if (sides) sides.forEach((k) => {
        world.vars[team(k)] = 0;
        world.watches.push({ type: `__ttop_${i}_${k}`, when: { var: team(k), gte: frags } });
        world.reactions.push({ on: `__ttop_${i}_${k}`, if: live, do: 'emit', type: k === side[P] ? 'frags:won' : 'frags:lost' });
      });
      // the others fall as the cast says (their hp ran out); the player when the level's hp does, held down by the cast
      who.forEach((c) => world.reactions.push({ on: 'down', match: { entity: c }, do: 'emit', type: fell(c) }));
      world.watches.push({ type: fell(P), when: { var: 'hp', lte: 0 } });
      // the player's hp: a flat `hits` a hit, or (`damage: true`) what each round dealt (the hit fact's `harm`, a head
      // hit's included: combat-ranged.js); a hit that says no damage then costs none
      // `armor` (with damage): the level's `armor` takes whole rounds while it lasts, then the hp does
      const armored = p.damage === true && p.armor !== undefined && p.armor !== false;
      const harm = armored
        ? [...['0', '1'].flatMap((h) => [
          { on: `hit:${P}`, match: { head: h }, if: { var: 'armor', gt: 0 }, do: 'emit', type: `__armored_${i}`, harm: 'event.harm' },
          { on: `hit:${P}`, match: { head: h }, if: { var: 'armor', lte: 0 }, do: 'emit', type: `__bare_${i}`, harm: 'event.harm' },
        ]),
        { on: `__armored_${i}`, if: live, do: 'inc', var: 'armor', by: 'event.harm', min: 0 },
        { on: `__bare_${i}`, if: live, do: 'inc', var: 'hp', by: 'event.harm', min: 0 }]
        : p.damage === true
          ? ['0', '1'].map((h) => ({ on: `hit:${P}`, match: { head: h }, if: live, do: 'inc', var: 'hp', by: 'event.harm', min: 0 }))
          : [{ on: `hit:${P}`, if: live, do: 'inc', var: 'hp', by: -hits, min: 0 }];
      if (armored) { world.vars.armor = 0; world.hud.push({ var: 'armor', label: 'Armor' }); }
      world.reactions.push(
        ...harm,
        { on: fell(P), do: 'ctrl', op: 'kill', who: P },
        { on: fell(P), do: 'inc', var: deaths, by: 1 },
        ...(armored ? [{ on: fell(P), do: 'set', var: 'armor', to: 0 }] : []),
        { on: rise(P), do: 'set', var: 'hp', to: hp },
      );
      // the place: per other, the lead (the player's frags less its own) and an ahead flag (laps' rivals); with sides,
      // the side's lead over the other (`__tlead_<i>`) decides instead
      if (side) world.vars[tlead] = 0;
      if (!side) who.forEach((c) => {
        const lead = `__lead_${i}_${c}`, ahead = `__ahead_${i}_${c}`, gets = `__gets_${i}_${c}`, falls = `__falls_${i}_${c}`;
        Object.assign(world.vars, { [lead]: 0, [ahead]: 0 });
        world.reactions.push(
          { on: `__bf_${i}_${c}`, do: 'inc', var: lead, by: -1 },
          { on: `__bf_${i}_${c}`, if: { var: lead, lt: 0 }, do: 'emit', type: gets },
          { on: gets, if: { var: ahead, eq: 0 }, do: 'inc', var: place, by: 1 },
          { on: gets, if: { var: ahead, eq: 0 }, do: 'set', var: ahead, to: 1 },
          { on: mine, do: 'inc', var: lead, by: 1 },
          { on: mine, if: { var: lead, gt: 0 }, do: 'emit', type: falls },
          { on: falls, if: { var: ahead, eq: 1 }, do: 'inc', var: place, by: -1 },
          { on: falls, if: { var: ahead, eq: 1 }, do: 'set', var: ahead, to: 0 },
        );
      });
      // the clock: at the horn the place decides
      if (seconds) {
        world.vars[clock] = seconds;
        world.timers.push({ every: 1, emit: { type: `__frags_sec_${i}` }, while: live });
        world.reactions.push({ on: `__frags_sec_${i}`, do: 'inc', var: clock, by: -1, min: 0 });
        world.watches.push({ type: `__horn_${i}`, when: { var: clock, lte: 0 } });
        world.reactions.push(...(side ? [
          { on: `__horn_${i}`, if: { var: tlead, gt: 0 }, do: 'emit', type: 'frags:won' },
          { on: `__horn_${i}`, if: { var: tlead, lte: 0 }, do: 'emit', type: 'frags:lost' },
        ] : [
          { on: `__horn_${i}`, if: { var: place, lte: win }, do: 'emit', type: 'frags:won' },
          { on: `__horn_${i}`, if: { var: place, gt: win }, do: 'emit', type: 'frags:lost' },
        ]));
        world.hud.push({ var: clock, label: 'Time', as: 'clock' });
      }
      world.reactions.push({ on: 'frags:won', do: 'set', var: over, to: 1 }, { on: 'frags:lost', do: 'set', var: over, to: 1 });
      world.hud.push(
        { var: 'hp', label: 'HP' },
        { var: frag(P), label: 'Frags', as: 'counter', ...(side ? {} : { max: frags }) },
        ...(side ? [{ var: team(side[P]), label: 'Ours', as: 'counter', max: frags }, { var: team(sides.find((k) => k !== side[P])), label: 'Theirs', as: 'counter', max: frags }]
          : [{ var: place, label: 'Place', as: 'counter', max: n }]),
        { on: mine, text: 'Frag!', as: 'toast', ttl: 1 },
        { on: fell(P), text: 'Fragged', as: 'toast', ttl: Math.max(1, respawn) },
      );
      return {
        world,
        on: { 'frags:won': { end: 'success' }, 'frags:lost': { end: 'fail' } },
        keep: [{ var: frag(P), label: 'Frags', best: 'high' }, side ? { var: team(side[P]), label: 'Side', best: 'high' } : { var: place, label: 'Place', best: 'low' }],
      };
    },
  },

  // CONTROL (a terminal): a point two sides fight over (`teams`, as frags' sides). Every second the side alone on it (a
  // ring `radius` round `at`, its standing bodies: a fallen one holds nothing) scores one; contested (both there) or
  // empty, nobody does. The first side to `hold` seconds wins it (the player's: `control:won`; the other's:
  // `control:lost`). Lowers to a zone per contender, counts and flags, a timer and watches (the web's: a Godot export
  // does not keep it yet). Kept: the player's side's seconds on the point.
  control: {
    role: 'terminal', ends: ['success', 'fail'], requires: [],
    lower(p, ctx) {
      const i = ctx.i, P = ctx.player, T = p.teams, names = T && typeof T === 'object' && !Array.isArray(T) ? Object.keys(T) : [];
      const all = names.flatMap((k) => (Array.isArray(T[k]) ? T[k] : [null]));
      if (names.length !== 2 || !all.every((c) => typeof c === 'string' && c) || new Set(all).size !== all.length || !all.includes(P)) throw new Error(`control[${i}]: teams are two sides { <name>: ['<id>', …], <name>: […] }, the player in one, each id once`);
      if (!(Array.isArray(p.at) && p.at.length >= 2 && p.at.every(Number.isFinite))) throw new Error(`control[${i}]: at is the point, [x, y, z?]`);
      const radius = p.radius === undefined ? 4 : Number.isFinite(p.radius) && p.radius > 0 ? p.radius : NaN;
      const hold = p.hold === undefined ? 60 : Number.isInteger(p.hold) && p.hold >= 5 ? p.hold : NaN;
      if (Number.isNaN(radius) || Number.isNaN(hold)) throw new Error(`control[${i}]: radius is the point's reach in metres (4), hold the seconds on it that win (60, from 5)`);
      const at = [p.at[0], p.at[1], p.at[2] ?? 0], mineSide = names.find((k) => T[k].includes(P)), other = (k) => names.find((x) => x !== k);
      const n = (k) => `__cpn_${i}_${k}`, sc = (k) => `__cps_${i}_${k}`, inn = (c) => `__cpin_${i}_${c}`, over = `__cp_over_${i}`, live = { var: over, eq: 0 }, tick = `__cp_tick_${i}`;
      const world = { vars: { [over]: 0 }, sources: [], reactions: [], watches: [], timers: [], entities: [{ id: `cp_${i}`, on: true, position: at }], hud: [] };
      names.forEach((k) => {
        Object.assign(world.vars, { [n(k)]: 0, [sc(k)]: 0 });
        T[k].forEach((c) => {
          const zone = `cp_${i}_${c}`, flag = inn(c);
          world.vars[flag] = 0;
          world.sources.push({ type: 'zone', zone, at, radius, planar: true, watch: c });
          world.reactions.push(
            { on: 'enter', match: { zone }, if: { var: flag, eq: 0 }, do: 'inc', var: n(k), by: 1 },
            { on: 'enter', match: { zone }, do: 'set', var: flag, to: 1 },
            { on: 'exit', match: { zone }, if: { var: flag, eq: 1 }, do: 'inc', var: n(k), by: -1 },
            { on: 'exit', match: { zone }, do: 'set', var: flag, to: 0 },
            { on: 'down', match: { entity: c }, if: { var: flag, eq: 1 }, do: 'inc', var: n(k), by: -1 },
            { on: 'down', match: { entity: c }, do: 'set', var: flag, to: 0 },
          );
        });
        // a second on the point: the other side none there, this side some
        world.reactions.push(
          { on: tick, if: { var: n(other(k)), eq: 0 }, do: 'emit', type: `__cpa_${i}_${k}` },
          { on: `__cpa_${i}_${k}`, if: { var: n(k), gt: 0 }, do: 'inc', var: sc(k), by: 1 },
        );
        world.watches.push({ type: `__cpw_${i}_${k}`, when: { var: sc(k), gte: hold } });
        world.reactions.push({ on: `__cpw_${i}_${k}`, if: live, do: 'emit', type: k === mineSide ? 'control:won' : 'control:lost' });
      });
      world.timers.push({ every: 1, emit: { type: tick }, while: live });
      world.reactions.push({ on: 'control:won', do: 'set', var: over, to: 1 }, { on: 'control:lost', do: 'set', var: over, to: 1 });
      world.hud.push({ var: sc(mineSide), label: 'Point (ours)', as: 'counter', max: hold }, { var: sc(other(mineSide)), label: 'Point (theirs)', as: 'counter', max: hold });
      return { world, on: { 'control:won': { end: 'success' }, 'control:lost': { end: 'fail' } }, keep: [{ var: sc(mineSide), label: 'Held', best: 'high' }] };
    },
  },

  // REGEN (an emitter): the player's hp comes back once it has gone `after` seconds unhurt, `rate` hp a second, to `max`.
  // A body at 0 does not mend (a match's fall is its own).
  regen: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const i = ctx.i, calm = `__calm_${i}`, tick = `__regen_tick_${i}`, step = 0.25;
      const after = Number.isFinite(p.after) && p.after >= 0 ? p.after : 4, rate = Number.isFinite(p.rate) && p.rate > 0 ? p.rate : 20, max = Number.isFinite(p.max) && p.max > 0 ? p.max : 100;
      return {
        world: {
          vars: { [calm]: 0 },
          timers: [{ every: step, emit: { type: tick } }],
          reactions: [
            { on: tick, do: 'inc', var: calm, by: step },
            { on: `hit:${ctx.player}`, do: 'set', var: calm, to: 0 },
            // (a reaction's guard is one predicate: the second rides an event of its own)
            { on: tick, if: { var: calm, gte: after }, do: 'emit', type: `__regen_due_${i}` },
            { on: `__regen_due_${i}`, if: { var: 'hp', gt: 0 }, do: 'inc', var: 'hp', by: rate * step, max },
          ],
        },
      };
    },
  },

  // ABILITIES (an emitter): the player's kit on its keys, each on its cooldown, on the bus.
  //   heal       { key ('q'), amount (50), cooldown (10), max (100) }   hp back, at once
  //   ultimate   { key ('x'), per (5), rivals: [ids], for (6), max }    charged by every hit the player lands on a rival
  //              (`per` a hit, to 100); spent, it puts the player in OVERDRIVE (the cast's status: its rounds hit harder,
  //              combat-ranged.js) for `for` seconds and fills its hp
  // Every key press is `ability:<name>`; a spent one is `ability:<name>:used`.
  abilities: {
    role: 'emitter', requires: [],
    lower(p, ctx) {
      const i = ctx.i, P = ctx.player, world = { vars: {}, reactions: [], timers: [], inputs: [], hud: [] };
      const tick = `__ab_tick_${i}`, step = 0.5;
      if (!p.heal && !p.ultimate) throw new Error(`abilities[${i}]: name a heal { key?, amount?, cooldown? } or an ultimate { key?, per?, rivals, for? }`);
      world.timers.push({ every: step, emit: { type: tick } });
      if (p.heal) {
        const H = p.heal === true ? {} : p.heal, cd = `__cd_heal_${i}`, key = H.key ?? 'q', amount = H.amount ?? 50, cool = H.cooldown ?? 10, max = H.max ?? 100;
        world.vars[cd] = 0;
        world.inputs.push({ on: 'key', key, once: true, emit: { type: 'ability:heal' } });
        world.reactions.push(
          { on: 'ability:heal', if: { var: cd, lte: 0 }, do: 'emit', type: `__heal_ready_${i}` },
          { on: `__heal_ready_${i}`, if: { var: 'hp', gt: 0 }, do: 'emit', type: 'ability:heal:used' },
          { on: 'ability:heal:used', do: 'inc', var: 'hp', by: amount, max },
          { on: 'ability:heal:used', do: 'set', var: cd, to: cool },
          { on: tick, do: 'inc', var: cd, by: -step, min: 0 },
        );
        world.hud.push({ var: cd, label: `Heal (${key.toUpperCase()})`, as: 'counter' });
      }
      if (p.ultimate) {
        const U = p.ultimate, ult = `__ult_${i}`, key = U.key ?? 'x', per = U.per ?? 5, dur = U.for ?? 6, max = U.max ?? 100;
        const rivals = Array.isArray(U.rivals) ? U.rivals : [];
        if (!rivals.length) throw new Error(`abilities[${i}].ultimate: rivals: ['<id>', …], whose hits charge it`);
        world.vars[ult] = 0;
        world.inputs.push({ on: 'key', key, once: true, emit: { type: 'ability:ultimate' } });
        for (const r of rivals) world.reactions.push({ on: `hit:${r}`, match: { by: P }, do: 'inc', var: ult, by: per, max: 100 });
        world.reactions.push(
          { on: 'ability:ultimate', if: { var: ult, gte: 100 }, do: 'emit', type: `__ult_ready_${i}` },
          { on: `__ult_ready_${i}`, if: { var: 'hp', gt: 0 }, do: 'emit', type: 'ability:ultimate:used' },
          { on: 'ability:ultimate:used', do: 'set', var: ult, to: 0 },
          { on: 'ability:ultimate:used', do: 'set', var: 'hp', to: max },
          { on: 'ability:ultimate:used', do: 'ctrl', op: 'status', who: P, is: 'overdrive', for: dur },
        );
        world.hud.push({ var: ult, label: `Ultimate (${key.toUpperCase()})`, as: 'bar', max: 100 }, { on: 'ability:ultimate:used', text: 'Overdrive!', as: 'toast', ttl: 1.5 });
      }
      return { world };
    },
  },
};

export const MECHANIC_KINDS = Object.keys(MECHANICS);
// what a supply gives
export const SUPPLIES = Object.freeze(['health', 'ammo', 'armor', 'overdrive']);
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
  const doors = [];
  const keep = [];
  let aftermath = null, bag = null;
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
    if (low.aftermath) aftermath = low.aftermath;
    if (low.bag) bag = low.bag;
    for (const k of (low.keep || [])) { if (keep.some((x) => x.var === k.var)) errors.push(`mechanics[${i}] (${m.kind}): var '${k.var}' is kept twice`); else keep.push(k); }
    for (const d of (low.doors || [])) { if (doors.some((x) => x.id === d.id)) errors.push(`mechanics[${i}] (door): door id '${d.id}' is used twice`); else doors.push(d); }
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

  // two mechanics producing the same event into the same slice declare it once: unbounded when either is, else the sum
  // of their maxes (a collect's pickups and the bag's own grants into one inventory)
  const merged = [];
  for (const e of produces) {
    const had = merged.find((x) => x.type === e.type && x.slice === e.slice);
    if (!had) { merged.push({ ...e }); continue; }
    if (had.max === undefined || e.max === undefined) delete had.max; else had.max += e.max;
  }
  produces.length = 0; produces.push(...merged);

  // drop empty channels so the emitted manifest reads like a hand-written one
  for (const ch of ARRAY_CHANNELS) if (events[ch].length === 0) delete events[ch];
  if (Object.keys(events.vars).length === 0) delete events.vars;

  return { events, produces, on, consumes, requires: [...requires], audits, ...(doors.length ? { doors } : {}), ...(keep.length ? { keep } : {}), ...(aftermath ? { aftermath } : {}), ...(bag ? { bag } : {}) };
}
