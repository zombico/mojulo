/**
 * event-bus — the pure, deterministic in-tick REACTION layer for actions-worlds
 * (see event-bus.plan.md). The physics step (physics-sim.js) emits physical FACTS
 * (contact / rest / enter / threshold-cross); this module assigns MEANING to those facts via
 * declarative reactions and scope-keyed sequences, mutating world state and recording a durable
 * event log. Physics is mechanism; this is policy; the queue is the membrane between them.
 *
 * SINGLE SOURCE OF TRUTH. The whole reducer lives inside `buildBus()`, a self-contained closure
 * referencing nothing outside itself, so the browser `/world` can run the SAME code by emitting
 * `buildBus.toString()` into the page (Phase 5). Node imports the live instance below
 * (tested in event-bus.test.js). One definition, byte-for-byte, on both sides.
 *
 * Determinism is the whole point — it is the oracle that makes the invisible-at-scale property
 * testable (hash → replay → compare). Three rules enforce it, each closing a scale-only bug:
 *   1. Events are ordered by a CONTENT-DERIVED stable key, never by arrival order — so the same
 *      event SET produces the same result no matter what order it was emitted (a break scatters
 *      contacts in float-dependent order; the bus must not care).
 *   2. emit-ted events drain SAME-TICK, recursively, DEPTH-CAPPED — causality without spiral.
 *   3. A per-tick BUDGET caps total events. Both caps are LOUD (counted + logged), never silent.
 * Plus: verbs resolve targets by failable id-lookup (stale refs after despawn are no-ops, not
 * crashes), and sequences are keyed by SCOPE (ordered within a key, concurrent across keys).
 */

export function buildBus() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const DIRS = {
    up: [0, 0, 1], down: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
    forward: [0, 1, 0], back: [0, -1, 0],
  };
  // verb/control keys that must NOT be copied into an emitted event's payload.
  const RESERVED = { do: 1, type: 1, source: 1, scope: 1, on: 1, match: 1, await: 1, target: 1, template: 1, at: 1, to: 1, vector: 1, dir: 1, gain: 1, var: 1, by: 1 };

  // ── deterministic stringify (sorted keys) — the basis of the content sort key + state hash ──
  function ss(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(ss).join(',') + ']';
    const ks = Object.keys(v).sort();
    return '{' + ks.map((k) => JSON.stringify(k) + ':' + ss(v[k])).join(',') + '}';
  }
  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }

  // ── glob/exact field matching (the `match` predicate). '*' anywhere is a wildcard. ──
  function glob(str, pat) {
    if (pat === undefined || pat === '*') return true;
    const p = String(pat);
    if (p.indexOf('*') < 0) return String(str) === p;
    const rx = '^' + p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
    return new RegExp(rx).test(String(str));
  }
  function matches(ev, matchObj) {
    if (!matchObj) return true;
    for (const k in matchObj) if (!glob(ev[k], matchObj[k])) return false;
    return true;
  }

  // ── reference resolution: 'event.<path>' reads from the firing/context event; else literal ──
  function resolveRef(v, ev) {
    if (typeof v === 'string' && v.indexOf('event.') === 0) {
      let cur = ev;
      const path = v.slice(6).split('.');
      for (let i = 0; i < path.length; i++) { if (cur == null) return undefined; cur = cur[path[i]]; }
      return cur;
    }
    return v;
  }
  function resolveFields(obj, ev) {
    const out = {};
    for (const k in obj) out[k] = resolveRef(obj[k], ev);
    return out;
  }
  function omit(obj, key) {
    const out = {};
    for (const k in obj) if (k !== key) out[k] = obj[k];
    return out;
  }

  function normalizeEvent(raw) {
    const e = Object.assign({}, raw);
    if (typeof e.type !== 'string') e.type = String(e.type || 'event');
    if (e.source === undefined) e.source = e.a !== undefined ? e.a : (e.id !== undefined ? e.id : '');
    if (e.scope === undefined) e.scope = null;
    return e;
  }
  // CONTENT-derived sort key — rule (1). No arrival counter, so shuffled emit order ⇒ same order.
  const sortKey = (e) => ss(e);
  function sortEvents(list) {
    return list
      .map((e) => ({ e, k: sortKey(e) }))
      .sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0))
      .map((o) => o.e);
  }

  // ── world entities (what verbs act on; a physics body plugs in here as an entity w/ pos+vel) ──
  function addEntity(state, raw) {
    const e = {
      id: raw.id,
      type: raw.type || 'entity',
      on: !!raw.on,
      position: Array.isArray(raw.position) ? raw.position.slice() : [0, 0, 0],
      velocity: Array.isArray(raw.velocity) ? raw.velocity.slice() : [0, 0, 0],
    };
    if (raw.pose !== undefined) e.pose = raw.pose;
    if (raw.color !== undefined) e.color = raw.color;      // marker tint (so conceptual entities read)
    if (Number.isFinite(raw.radius)) e.radius = raw.radius;
    state.entities.push(e);
    state.byId[e.id] = e;
    return e;
  }

  function impulseVec(spec, ev) {
    const v = resolveRef(spec.vector, ev);
    if (Array.isArray(v)) return v;
    const d = DIRS[resolveRef(spec.dir, ev)] || [0, 0, 0];
    const g0 = resolveRef(spec.gain, ev);
    const g = Number.isFinite(g0) ? g0 : 1;
    return [d[0] * g, d[1] * g, d[2] * g];
  }

  // Apply one verb (from a reaction OR a sequence step). Returns emitted events (only `emit`
  // produces any). Non-spawn verbs resolve their target by FAILABLE id lookup: a stale/missing
  // target is a recorded no-op, never a throw.
  function applyVerb(state, spec, ev) {
    const verb = spec.do;
    if (!verb) return [];
    if (verb === 'emit') {
      const out = { type: spec.type, source: resolveRef(spec.source, ev) };
      if (out.source === undefined) out.source = ev.source;
      out.scope = spec.scope !== undefined ? resolveRef(spec.scope, ev) : ev.scope;
      for (const k in spec) if (!RESERVED[k]) out[k] = resolveRef(spec[k], ev);
      state.metrics.emitted++;
      return [out];
    }
    if (verb === 'spawn') { spawnEntity(state, spec, ev); return []; }
    // CONCEPTUAL-STATE verbs (no entity target): write the `vars` bag where non-physical meaning lives.
    // Optional `min`/`max` CLAMP a numeric result (health floors, ammo caps, score ceilings) — the
    // fall-penalty-respawn case needs `{do:'inc',var:'hp',by:-20,min:1}` so a fall can never reach 0.
    if (verb === 'set') { let v = resolveRef(spec.to, ev); if (typeof v === 'number') v = clampVar(v, spec); state.vars[spec.var] = v; return []; }
    if (verb === 'inc') { const by = Number(resolveRef(spec.by, ev)); state.vars[spec.var] = clampVar((Number(state.vars[spec.var]) || 0) + (Number.isFinite(by) ? by : 1), spec); return []; }

    const tid = resolveRef(spec.target, ev);
    const target = state.byId[tid];
    if (!target) {
      // `move` to an id the bus doesn't own = a CONTROLLABLE WARP intent (respawn / teleport the
      // walking player, who lives in __mojCtrl, not as a bus entity). Applied by syncToCtrl after
      // the tick — the symmetric inverse of deriveZoneEvents' position READ. Other verbs on a
      // missing target stay no-ops.
      if (verb === 'move') { const to = resolveRef(spec.to, ev); if (Array.isArray(to)) { (state._ctrlWarps || (state._ctrlWarps = {}))[tid] = to.slice(); return []; } }
      state.metrics.noops++;
      state.log.push({ op: 'noop', verb, target: tid === undefined ? null : tid });
      return [];
    }
    if (verb === 'toggle') target.on = spec.to !== undefined ? !!resolveRef(spec.to, ev) : !target.on;
    else if (verb === 'impulse') target.velocity = add(target.velocity, impulseVec(spec, ev));
    else if (verb === 'move') {
      const to = resolveRef(spec.to, ev);
      if (Array.isArray(to)) target.position = to.slice();
      else target.pose = to;
    }
    return [];
  }
  // clamp a numeric var result to optional [min, max] (either bound may be absent).
  function clampVar(v, spec) {
    if (spec && Number.isFinite(spec.min) && v < spec.min) v = spec.min;
    if (spec && Number.isFinite(spec.max) && v > spec.max) v = spec.max;
    return v;
  }

  // spawn id is CONTENT-derived (from the spawning event), NOT a counter — so spawn order does
  // not change ids ⇒ order-invariance holds. Identical events ⇒ identical (idempotent) spawn.
  function spawnEntity(state, spec, ev) {
    const tmpl = spec.template || {};
    const at = resolveRef(spec.at, ev);
    const id = tmpl.id || ((tmpl.type || spec.type || 'spawn') + '-' + fnv(sortKey(ev)));
    const raw = {
      id,
      type: tmpl.type || spec.type || 'spawn',
      on: !!tmpl.on,
      position: Array.isArray(at) ? at : (tmpl.position || [0, 0, 0]),
      velocity: tmpl.velocity || [0, 0, 0],
    };
    if (state.byId[id]) Object.assign(state.byId[id], { type: raw.type, on: raw.on, position: raw.position.slice(), velocity: raw.velocity.slice() });
    else addEntity(state, raw);
  }

  // ── sequences (sagas): ordered steps, one independent instance per resolved SCOPE key ──
  function instantiate(state, def, ev) {
    const scope = def.scope !== undefined ? resolveRef(def.scope, ev) : null;
    const key = def.id + ' ' + ss(scope);
    if (state.sagaIndex[key]) return [];   // already live for this scope — ignore re-trigger
    // Freeze the trigger as context, stamped with the resolved scope, so every step verb and
    // emit-ted event inherits the saga's scope (its events belong to its scope, not to null).
    const ctx = Object.assign({}, ev);
    if (scope !== null && scope !== undefined) ctx.scope = scope;
    const saga = { def, key, scope, ctx, stepIndex: 0, awaiting: null, done: false };
    state.sagas.push(saga);
    state.sagaIndex[key] = saga;
    return runForward(state, saga);
  }
  // Run steps from the current index until one blocks on an await, or the saga finishes. A step's
  // verb refs resolve against the saga's FROZEN trigger context, not the event that advanced it.
  function runForward(state, saga) {
    const steps = saga.def.steps || [];
    const out = [];
    while (saga.stepIndex < steps.length) {
      const step = steps[saga.stepIndex];
      if (step.do) for (const e of applyVerb(state, step, saga.ctx)) out.push(e);
      if (step.await !== undefined) {
        const aw = step.await;
        if (aw === 'done') { saga.stepIndex++; continue; }        // immediate completion
        if (aw && aw.timer != null) { saga.awaiting = { timer: resolveRef(aw.timer, saga.ctx) }; return out; }
        saga.awaiting = { type: aw.on, match: resolveFields(omit(aw, 'on'), saga.ctx) };
        return out;
      }
      saga.stepIndex++;
    }
    saga.done = true;
    // A completed saga frees its SCOPE: prune it from sagas + sagaIndex so the same scope can trigger
    // a FRESH instance later (the ephemeral-target / repeated-popup case). A still-live saga keeps its
    // index entry, so concurrent re-triggers of a live scope are still ignored (scope isolation holds).
    // hashState excludes sagas, so pruning is determinism-neutral for the replay oracle.
    const si = state.sagas.indexOf(saga);
    if (si >= 0) state.sagas.splice(si, 1);
    if (state.sagaIndex[saga.key] === saga) delete state.sagaIndex[saga.key];
    return out;
  }
  const awaitMatchesEvent = (awaiting, ev) => awaiting.type !== undefined && ev.type === awaiting.type && matches(ev, awaiting.match);
  function advanceSaga(state, saga) {
    saga.awaiting = null;
    saga.stepIndex++;             // step past the awaited step (its verb already ran before blocking)
    return runForward(state, saga);
  }
  const sagasSorted = (state) => state.sagas.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const reactionMatch = (ev, r) => ev.type === r.on && matches(ev, r.match || {});
  const triggerMatch = (ev, s) => s.trigger && ev.type === s.trigger.on && matches(ev, omit(s.trigger, 'on'));

  function drop(state, n, reason) {
    if (n <= 0) return;
    state.metrics.dropped += n;
    state.metrics.capTrips++;
    state.log.push({ op: 'cap', reason, count: n });
  }

  function createBusState(config, initialEntities) {
    config = config || {};
    const state = {
      config: { budget: Number.isFinite(config.budget) ? config.budget : 4096, depthCap: Number.isFinite(config.depthCap) ? config.depthCap : 8 },
      reactions: Array.isArray(config.reactions) ? config.reactions : [],
      seqDefs: Array.isArray(config.sequences) ? config.sequences : [],
      watches: Array.isArray(config.watches) ? config.watches : [],
      timers: Array.isArray(config.timers) ? config.timers : [],
      vars: config.vars && typeof config.vars === 'object' ? Object.assign({}, config.vars) : {},
      entities: [], byId: {}, _linked: {},
      sagas: [], sagaIndex: {},
      log: [],
      _watchPrev: {}, _timerAcc: {},
      metrics: { processed: 0, emitted: 0, dropped: 0, capTrips: 0, noops: 0, maxDepth: 0 },
    };
    (initialEntities || []).forEach((e) => addEntity(state, e));
    return state;
  }

  // ── conceptual triggers (watches): edge-detected predicates over state, no physics required ──
  // The generalization of contact/rest: those are built-in PHYSICS predicates; a watch is any
  // predicate over vars / entities / the event log. Same edge discipline (fire once on false→true,
  // tracked in _watchPrev). The comparator keys (gte/gt/lte/lt/eq/ne) live on the `when` object.
  function cmp(v, p) {
    if (p.eq !== undefined) return v === p.eq;
    if (p.ne !== undefined) return v !== p.ne;
    let ok = true;
    if (p.gte !== undefined) ok = ok && v >= p.gte;
    if (p.gt !== undefined) ok = ok && v > p.gt;
    if (p.lte !== undefined) ok = ok && v <= p.lte;
    if (p.lt !== undefined) ok = ok && v < p.lt;
    return ok;
  }
  function fieldOf(e, field) {
    if (field === 'x') return e.position[0];
    if (field === 'y') return e.position[1];
    if (field === 'z') return e.position[2];
    return e[field];
  }
  const matchEntities = (state, pat) => state.entities.filter((e) => glob(e.id, pat));
  function evalPredicate(state, when) {
    if (!when) return false;
    if (when.var !== undefined) return cmp(state.vars[when.var], when);
    if (when.count !== undefined) return cmp(state.log.filter((r) => r.type === when.count).length, when);
    if (when.entity !== undefined) { const e = state.byId[when.entity]; return e ? cmp(fieldOf(e, when.field), when) : false; }
    if (when.all !== undefined) { const es = matchEntities(state, when.all); return es.length > 0 && es.every((e) => cmp(fieldOf(e, when.field), when)); }
    if (when.any !== undefined) { return matchEntities(state, when.any).some((e) => cmp(fieldOf(e, when.field), when)); }
    return false;
  }
  // watchEvents(state) — evaluate every watch; emit an event for each that newly became true. Call it
  // AFTER processEvents in the tick so reactions' var/entity writes are visible same-tick; loop to a
  // fixed point for deeper conceptual cascades (the caller does the loop, depth-capped).
  function watchEvents(state) {
    const out = [];
    for (let i = 0; i < state.watches.length; i++) {
      const w = state.watches[i];
      const now = !!evalPredicate(state, w.when);
      const key = 'w' + i;
      if (now && !state._watchPrev[key]) {
        const ev = { type: w.type, source: w.type, scope: w.scope !== undefined ? w.scope : null };
        for (const k in w) if (k !== 'type' && k !== 'when' && k !== 'scope') ev[k] = w[k];
        out.push(ev);
      }
      state._watchPrev[key] = now;
    }
    return out;
  }

  // processEvents(state, incoming) — drain a tick's events to a fixed point. Mutates+returns state.
  // Order per depth: stable content sort → for each event: isolated reactions, then sequence
  // triggers, then advancing any waiting saga it satisfies. emit-ted events recurse to depth+1.
  function processEvents(state, incoming) {
    const cap = state.config;
    let frontier = (incoming || []).map(normalizeEvent);
    let depth = 0;
    let stop = false;
    while (frontier.length && !stop) {
      if (depth > cap.depthCap) { drop(state, frontier.length, 'depth'); break; }
      if (depth > state.metrics.maxDepth) state.metrics.maxDepth = depth;
      frontier = sortEvents(frontier);
      const next = [];
      for (let i = 0; i < frontier.length; i++) {
        if (state.metrics.processed >= cap.budget) { drop(state, frontier.length - i, 'budget'); stop = true; break; }
        const ev = frontier[i];
        state.metrics.processed++;
        state.log.push({ type: ev.type, source: ev.source, scope: ev.scope, depth });
        for (const r of state.reactions) if (reactionMatch(ev, r)) for (const e of applyVerb(state, r, ev)) next.push(e);
        for (const s of state.seqDefs) if (triggerMatch(ev, s)) for (const e of instantiate(state, s, ev)) next.push(e);
        for (const saga of sagasSorted(state)) if (saga.awaiting && awaitMatchesEvent(saga.awaiting, ev)) for (const e of advanceSaga(state, saga)) next.push(e);
      }
      if (stop) { drop(state, next.length, 'budget'); break; }
      depth++;
      frontier = next;
    }
    return state;
  }

  // tickTimers(state, dt) — RECURRING timer sources (world heartbeats), distinct from a sequence's
  // one-shot await: each `{ every, emit, while? }` fires its event every `every` seconds, optionally
  // gated by a `while` predicate (so a spawner can stop at game-over). Returns the emitted events.
  function tickTimers(state, dt) {
    const out = [];
    for (let i = 0; i < state.timers.length; i++) {
      const t = state.timers[i];
      if (!t || !t.emit) continue;
      if (t.while && !evalPredicate(state, t.while)) continue;   // gated off — don't accumulate
      const key = 't' + i;
      const period = Number.isFinite(t.every) ? Math.max(1e-3, t.every) : 1;
      state._timerAcc[key] = (state._timerAcc[key] || 0) + dt;
      let guard = 0;
      while (state._timerAcc[key] >= period && guard++ < 64) {
        state._timerAcc[key] -= period;
        out.push(Object.assign({ source: t.emit.type, scope: null }, t.emit));
      }
    }
    return out;
  }

  // stepTime(state, dt) — advance saga timer awaits (the only time-driven source). Returns events
  // emitted by any saga whose timer expired this step, for the caller to feed back to processEvents.
  function stepTime(state, dt) {
    let emitted = [];
    for (const saga of sagasSorted(state)) {
      if (saga.awaiting && saga.awaiting.timer != null) {
        saga.awaiting.timer -= dt;
        if (saga.awaiting.timer <= 0) emitted = emitted.concat(advanceSaga(state, saga));
      }
    }
    return emitted;
  }

  // hashState — canonical, byte-exact snapshot of the parts that define "what happened": entities
  // (sorted by id), the durable event log, and the loud-cap/noop counters. The replay oracle.
  function hashState(state) {
    const entities = state.entities.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const m = state.metrics;
    return ss({ entities, vars: state.vars, log: state.log, metrics: { processed: m.processed, emitted: m.emitted, dropped: m.dropped, capTrips: m.capTrips, noops: m.noops, maxDepth: m.maxDepth } });
  }

  // ── physics → facts (Phase 2): turn the integrator's per-step detections into bus events ──
  // `sources` (from the manifest `events.sources`) is the ALLOWLIST of which physical facts
  // become events — keeps the stream intentional instead of spamming every floor contact.
  // EDGE-TRIGGERED: a contact/rest fires only on its ONSET step (carry `prev` across steps), so a
  // ball resting on the floor emits one `rest`, not one per tick. Pure — reads physState as data.
  function contactOrient(when, a, b) {
    // returns [ea, eb] oriented so event.a aligns with when.a, or null if no match (either order).
    if (!when) return [a, b];
    if (glob(a, when.a) && glob(b, when.b)) return [a, b];
    if (glob(b, when.a) && glob(a, when.b)) return [b, a]; // physics pair order ≠ authoring order
    return null;
  }
  function deriveEvents(physState, prev, sources) {
    prev = prev || { contacts: {}, resting: {} };
    sources = sources || [];
    const events = [];
    const byId = {};
    const bodies = (physState && physState.bodies) || [];
    for (const b of bodies) byId[b.id] = b;

    const curContacts = {};
    for (const c of (physState && physState.contacts) || []) {
      const key = c.a < c.b ? c.a + '|' + c.b : c.b + '|' + c.a;
      curContacts[key] = 1;
      if (prev.contacts[key]) continue;                 // already in contact last step — not an onset
      let ea = null, eb = null;
      for (const s of sources) {
        if (s.type !== 'contact') continue;
        const o = contactOrient(s.when, c.a, c.b);
        if (o) { ea = o[0]; eb = o[1]; break; }
      }
      if (ea === null) continue;
      const sphere = byId[ea] && byId[ea].collider === 'sphere' ? byId[ea] : byId[eb];
      events.push({ type: 'contact', a: ea, b: eb, source: ea, normal: c.normal, depth: c.depth, point: sphere ? sphere.position.slice() : null });
    }

    const curResting = {};
    for (const b of bodies) {
      if (!b.resting) continue;
      curResting[b.id] = 1;
      if (prev.resting[b.id]) continue;                 // already resting last step — not an onset
      let ok = false;
      for (const s of sources) { if (s.type === 'rest' && glob(b.id, s.when && s.when.body)) { ok = true; break; } }
      if (!ok) continue;
      events.push({ type: 'rest', body: b.id, source: b.id, point: b.position.slice() });
    }

    return { events, prev: { contacts: curContacts, resting: curResting } };
  }

  // ── ZONE facts (game-mechanics.plan.md M0-pre): the CONTROLLABLE analogue of deriveEvents ──────
  // The walk/platform player emits no contact facts (physics contacts are rigid-body only), yet
  // every spatial mechanic (reach-exit / collect / hazard / rescue / deliver / key) is "the player
  // enters a region". This is that missing FACT source: a per-tick, deterministic overlap test of
  // entity positions against declared `{ type:'zone' }` sources, emitting edge-triggered `enter` /
  // `exit` events into the SAME bus the reactions consume. Pure — entity positions are deterministic
  // and dt is fixed, so same run → same facts (the replay/capture guarantee holds).
  //
  // A zone source: { type:'zone', zone:<id>, at:[x,y,z], radius:R | half:[hx,hy,hz],
  //                  watch?:<entityId>|'*' (default '*'), planar?:true (ignore Z — a floor footprint) }
  // Entities may be controllable ({ id, transform:{ pos } }) or physics bodies ({ id, position }).
  function zonePos(e) { return e && (e.transform ? e.transform.pos : e.position); }
  function inZone(p, s) {
    if (!p) return false;
    const at = s.at || [0, 0, 0];
    const dims = s.planar ? 2 : 3;
    if (Array.isArray(s.half)) {
      for (let i = 0; i < dims; i++) if (Math.abs(p[i] - at[i]) > s.half[i]) return false;
      return true;
    }
    const r = Number.isFinite(s.radius) ? s.radius : 1;
    let d2 = 0;
    for (let i = 0; i < dims; i++) { const dd = p[i] - at[i]; d2 += dd * dd; }
    return d2 <= r * r;
  }
  function deriveZoneEvents(entities, prev, sources) {
    prev = prev || { inside: {} };
    sources = sources || [];
    const list = entities || [];
    const events = [];
    const curInside = {};
    for (const s of sources) {
      if (s.type !== 'zone' || !s.zone) continue;
      const watch = s.watch || '*';
      for (const e of list) {
        if (!e || !e.id) continue;
        if (!glob(e.id, watch)) continue;
        if (!inZone(zonePos(e), s)) continue;
        const key = s.zone + '|' + e.id;
        curInside[key] = 1;
        if (prev.inside[key]) continue;                 // still inside since last step — not an onset
        events.push({ type: 'enter', zone: s.zone, entity: e.id, source: s.zone, at: (zonePos(e) || []).slice() });
      }
    }
    // exits: keys present last step but not this step
    for (const key in prev.inside) {
      if (curInside[key]) continue;
      const i = key.indexOf('|');
      events.push({ type: 'exit', zone: key.slice(0, i), entity: key.slice(i + 1), source: key.slice(0, i) });
    }
    return { events, prev: { inside: curInside } };
  }

  // ── physics ← policy (Phase 5b): the BIDIRECTIONAL membrane ──────────────────────────────────
  // So a reaction can reach back INTO physics (rule feeds physics — the domino/cradle case). Each
  // physics body is registered as a bus entity PROXY; sync bodies→proxies before processEvents
  // (fresh reads), proxies→bodies after (apply the impulse/move the reaction performed). Pure, so
  // node tests and the browser channel share it. Frame order: step → linkPhysics(once) →
  // syncFromBodies → deriveEvents → processEvents → syncToBodies.
  function linkPhysics(state, physState) {
    for (const b of (physState.bodies || [])) {
      if (!state.byId[b.id]) addEntity(state, { id: b.id, type: 'body', position: b.position, velocity: b.velocity });
      state._linked[b.id] = true;
    }
  }
  function syncFromBodies(state, physState) {
    for (const b of (physState.bodies || [])) {
      const e = state.byId[b.id];
      if (e) { e.position = b.position.slice(); e.velocity = b.velocity.slice(); }
    }
  }
  function syncToBodies(state, physState) {
    for (const b of (physState.bodies || [])) {
      if (!state._linked[b.id]) continue;
      const e = state.byId[b.id];
      if (e) { b.velocity = e.velocity.slice(); b.position = e.position.slice(); }
    }
  }

  // syncToCtrl(state, ctrlEntities) — apply pending WARP intents (from a `move` reaction targeting a
  // controllable id) to the walking entities, then clear them. The bus→controllable WRITE, run once
  // per tick AFTER processEvents (the respawn/teleport path for fall-handling; game-mechanics.plan.md).
  // Conditional by construction: only ids a reaction warped this tick are touched, so the walk rule's
  // own per-tick position is never fought — a warp is an event, not a continuous sync like bodies.
  function syncToCtrl(state, ctrlEntities) {
    const warps = state._ctrlWarps;
    if (!warps) return;
    for (const e of (ctrlEntities || [])) {
      if (e && e.id && warps[e.id] && e.transform && Array.isArray(e.transform.pos)) {
        e.transform.pos = warps[e.id].slice();
        if (Array.isArray(e.vel)) e.vel = [0, 0, 0];   // a respawn kills fall velocity
      }
    }
    state._ctrlWarps = {};
  }

  return { createBusState, processEvents, stepTime, tickTimers, watchEvents, hashState, deriveEvents, deriveZoneEvents, linkPhysics, syncFromBodies, syncToBodies, syncToCtrl, normalizeEvent, sortKey, addEntity };
}

// Live node instance (tested in event-bus.test.js). The browser does NOT import these — Phase 5
// will run buildBus().toString() so its reducer is this exact source. Keep in sync via buildBus only.
const _bus = buildBus();
export const createBusState = _bus.createBusState;
export const processEvents = _bus.processEvents;
export const stepTime = _bus.stepTime;
export const tickTimers = _bus.tickTimers;
export const watchEvents = _bus.watchEvents;
export const hashState = _bus.hashState;
export const deriveEvents = _bus.deriveEvents;
export const deriveZoneEvents = _bus.deriveZoneEvents;
export const linkPhysics = _bus.linkPhysics;
export const syncFromBodies = _bus.syncFromBodies;
export const syncToBodies = _bus.syncToBodies;
export const syncToCtrl = _bus.syncToCtrl;
export const normalizeEvent = _bus.normalizeEvent;
export const sortKey = _bus.sortKey;
export const addEntity = _bus.addEntity;
