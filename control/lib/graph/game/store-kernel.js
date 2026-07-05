/**
 * store-kernel — the dependency-free game store kernel (game-metacontext.plan.md).
 *
 * SINGLE SOURCE OF TRUTH, same discipline as beats-kernel.js / physics-sim.js: the whole
 * kernel lives inside `buildGameStoreKernel()`, a self-contained closure referencing nothing
 * outside itself, so the game SHELL (game-shell.js) runs the SAME code by emitting
 * `buildGameStoreKernel.toString()` into the page. Node imports the live instance for tests
 * and for design-time validation (level-contract.js delegates envelope checks here — one
 * validator, shipped and design-time alike).
 *
 * Doctrine (game-metacontext.plan.md):
 *   CLOSED VOCABULARY — five slice kinds mutated ONLY by typed events. No arbitrary
 *     reducers, ever: reducers are generated from the game's declared schema at build time
 *     because there is no agent at runtime to interpret anything.
 *   ONE WRITE PER SESSION — the store only ever sees the outcome envelope at level exit.
 *     `applyOutcome` is atomic: the envelope validates against the level contract's
 *     `produces` and applies fully, or is rejected whole. Mid-session state never lands here.
 *   PURE — every reducer is (state, event) → state with no mutation of the input, no
 *     Date.now, no Math.random. Same save + same envelope stream → the same store, always.
 *   SAVES ARE VERIFIABLE — a save is { contractVersion, storeState, runLog }; runLog entries
 *     are the envelopes themselves (optionally carrying { seed, ticks }), so a claimed
 *     outcome can be replayed. Export/import round-trips byte-identically.
 */

export function buildGameStoreKernel() {
  // bumped only when the shell↔level wire shape or the envelope shape changes incompatibly.
  const CONTRACT_VERSION = 1;

  const SLICE_KINDS = ['character', 'inventory', 'party', 'progression', 'flags'];

  // typed event vocabulary: which event types a slice KIND accepts. This map IS the
  // reducer registry — extending the vocabulary means a new entry here plus a slice card,
  // never user code.
  const EVENTS_BY_KIND = {
    character: ['setStat', 'levelUp'],
    inventory: ['grant', 'consume'],
    party: ['recruit', 'dismiss', 'setStat', 'levelUp'],
    progression: ['promote'],
    flags: ['setFlag'],
  };
  const EVENT_TYPES = ['grant', 'consume', 'setStat', 'levelUp', 'setFlag', 'promote', 'recruit', 'dismiss'];

  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  function initSlice(kind, init) {
    const s = init || {};
    if (kind === 'character') return { level: s.level != null ? s.level : 1, xp: s.xp || 0, stats: clone(s.stats) || {} };
    if (kind === 'inventory') return { items: clone(s.items) || {} };
    if (kind === 'party') {
      const roster = {};
      for (const id in (s.roster || {})) {
        const m = s.roster[id] || {};
        roster[id] = { name: m.name || id, level: m.level != null ? m.level : 1, xp: m.xp || 0, stats: clone(m.stats) || {}, tags: clone(m.tags) || [] };
      }
      return { roster: roster };
    }
    if (kind === 'progression') return { completed: clone(s.completed) || {}, unlocked: clone(s.unlocked) || [] };
    if (kind === 'flags') return { flags: clone(s.flags) || {} };
    throw new Error('game-store: unknown slice kind "' + kind + '" (kinds: ' + SLICE_KINDS.join(', ') + ')');
  }

  // schema: { slices: [{ name, kind, init? }] } (validated for real by game-manifest.js;
  // the kernel re-checks just enough to fail loudly if handed garbage at runtime).
  function createStore(schema) {
    const slices = (schema && schema.slices) || [];
    const state = {};
    for (const sl of slices) {
      if (!sl || !sl.name) throw new Error('game-store: bad slice declaration ' + JSON.stringify(sl));
      if (state[sl.name]) throw new Error('game-store: duplicate slice name "' + sl.name + '"');
      state[sl.name] = initSlice(sl.kind, sl.init);
    }
    return state;
  }

  function sliceKind(schema, name) {
    const slices = (schema && schema.slices) || [];
    for (const sl of slices) if (sl.name === name) return sl.kind;
    return null;
  }
  function firstSliceOfKind(schema, kind) {
    const slices = (schema && schema.slices) || [];
    for (const sl of slices) if (sl.kind === kind) return sl.name;
    return null;
  }

  // ── reducers — each returns an error string, or null and fills `next` ────────
  function applyToMember(target, ev, where, errors) {
    if (ev.type === 'setStat') {
      if (!ev.stat || typeof ev.stat !== 'string') { errors.push(where + ': setStat needs a stat name'); return; }
      const cur = target.stats[ev.stat] || 0;
      if (ev.delta !== undefined && typeof ev.delta === 'number') target.stats[ev.stat] = cur + ev.delta;
      else if (ev.value !== undefined && typeof ev.value === 'number') target.stats[ev.stat] = ev.value;
      else errors.push(where + ': setStat needs numeric value or delta');
    }
    if (ev.type === 'levelUp') {
      const by = ev.by === undefined ? 1 : ev.by;
      if (!(typeof by === 'number' && isFinite(by) && by > 0 && Math.floor(by) === by)) { errors.push(where + ': levelUp.by must be a positive integer'); return; }
      target.level += by;
      if (typeof ev.xp === 'number') target.xp += ev.xp;
    }
  }

  /**
   * Apply typed events ATOMICALLY: validates every event against the schema first and
   * returns { ok:false, errors } touching nothing if ANY fails; otherwise returns
   * { ok:true, state } with a fresh state (input never mutated).
   */
  function applyEvents(schema, state, events) {
    const errors = [];
    if (!Array.isArray(events)) return { ok: false, errors: ['events must be an array'] };
    const next = clone(state);
    events.forEach((ev, i) => {
      const where = 'events[' + i + ']';
      if (!ev || typeof ev !== 'object') { errors.push(where + ' must be an object'); return; }
      if (EVENT_TYPES.indexOf(ev.type) < 0) { errors.push(where + '.type "' + ev.type + '" is not a typed event (' + EVENT_TYPES.join(', ') + ')'); return; }
      const kind = sliceKind(schema, ev.slice);
      if (!kind) { errors.push(where + '.slice "' + ev.slice + '" is not a declared slice'); return; }
      if (EVENTS_BY_KIND[kind].indexOf(ev.type) < 0) { errors.push(where + ': slice "' + ev.slice + '" (' + kind + ') does not accept "' + ev.type + '" (accepts: ' + EVENTS_BY_KIND[kind].join(', ') + ')'); return; }
      const s = next[ev.slice];

      if (kind === 'inventory') {
        const count = ev.count === undefined ? 1 : ev.count;
        if (!ev.item || typeof ev.item !== 'string') { errors.push(where + ': needs an item id'); return; }
        if (!(typeof count === 'number' && isFinite(count) && count > 0 && Math.floor(count) === count)) { errors.push(where + ': count must be a positive integer'); return; }
        if (ev.type === 'grant') s.items[ev.item] = (s.items[ev.item] || 0) + count;
        else {
          const have = s.items[ev.item] || 0;
          if (have < count) { errors.push(where + ': cannot consume ' + count + ' × "' + ev.item + '" (have ' + have + ')'); return; }
          if (have === count) delete s.items[ev.item]; else s.items[ev.item] = have - count;
        }
      }

      if (kind === 'character') applyToMember(s, ev, where, errors);

      if (kind === 'party') {
        if (ev.type === 'recruit') {
          const m = ev.member;
          if (!m || typeof m !== 'object' || !m.id || typeof m.id !== 'string') { errors.push(where + ': recruit needs member: { id, name?, stats?, ... }'); return; }
          if (s.roster[m.id]) { errors.push(where + ': member "' + m.id + '" is already in the roster'); return; }
          s.roster[m.id] = { name: m.name || m.id, level: m.level != null ? m.level : 1, xp: m.xp || 0, stats: clone(m.stats) || {}, tags: clone(m.tags) || [] };
        } else if (ev.type === 'dismiss') {
          if (!ev.id || !s.roster[ev.id]) { errors.push(where + ': dismiss — no member "' + ev.id + '" in the roster'); return; }
          delete s.roster[ev.id];
        } else {
          if (!ev.id || !s.roster[ev.id]) { errors.push(where + ': ' + ev.type + ' on a party needs id of a roster member (no "' + ev.id + '")'); return; }
          applyToMember(s.roster[ev.id], ev, where, errors);
        }
      }

      if (kind === 'progression' && ev.type === 'promote') {
        if (!ev.ref || typeof ev.ref !== 'string') { errors.push(where + ': promote needs the level ref'); return; }
        const result = ev.result === undefined ? 'success' : ev.result;
        if (result !== 'success' && result !== 'fail') { errors.push(where + ': promote.result must be success | fail'); return; }
        s.completed[ev.ref] = result;
        if (result === 'success' && s.unlocked.indexOf(ev.ref) < 0) s.unlocked.push(ev.ref);
      }

      if (kind === 'flags' && ev.type === 'setFlag') {
        if (!ev.key || typeof ev.key !== 'string') { errors.push(where + ': setFlag needs a key'); return; }
        const t = typeof ev.value;
        if (ev.value !== undefined && t !== 'boolean' && t !== 'number' && t !== 'string') { errors.push(where + ': setFlag.value must be boolean | number | string'); return; }
        s.flags[ev.key] = ev.value === undefined ? true : ev.value;
      }
    });
    return errors.length ? { ok: false, errors: errors } : { ok: true, state: next };
  }

  // ── outcome envelopes ─────────────────────────────────────────────────────────
  // envelope: { contractVersion, levelRef, seed, result: success|fail|abort,
  //             events: [typed events], ticks? }
  // contract.produces: { results?: [allowed results], events: [{ type, slice, max? }] }
  function validateEnvelope(contract, envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object') return { ok: false, errors: ['envelope must be an object'] };
    if (envelope.contractVersion !== CONTRACT_VERSION) {
      errors.push('envelope.contractVersion ' + envelope.contractVersion + ' ≠ shell contract version ' + CONTRACT_VERSION);
    }
    const results = (contract && contract.produces && contract.produces.results) || ['success', 'fail', 'abort'];
    if (results.indexOf(envelope.result) < 0) errors.push('envelope.result "' + envelope.result + '" not allowed (allowed: ' + results.join(', ') + ')');
    const allowed = (contract && contract.produces && contract.produces.events) || [];
    const events = Array.isArray(envelope.events) ? envelope.events : [];
    if (!Array.isArray(envelope.events)) errors.push('envelope.events must be an array (may be empty)');
    const counts = new Map();
    events.forEach(function (ev, i) {
      const rule = allowed.find(function (r) { return r.type === (ev && ev.type) && r.slice === (ev && ev.slice); });
      if (!rule) { errors.push('events[' + i + '] (' + (ev && ev.type) + ' → ' + (ev && ev.slice) + ') is not declared in the level contract’s produces.events'); return; }
      const key = rule.type + '→' + rule.slice;
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      if (rule.max !== undefined && n > rule.max) errors.push('events[' + i + '] exceeds produces max for ' + key + ' (max ' + rule.max + ')');
    });
    return errors.length ? { ok: false, errors: errors } : { ok: true };
  }

  /** The one write per session: validate the envelope against the contract, then apply atomically. */
  function applyOutcome(schema, state, contract, envelope) {
    const v = validateEnvelope(contract, envelope);
    if (!v.ok) return { ok: false, errors: v.errors };
    return applyEvents(schema, state, envelope.events || []);
  }

  // ── gates — declarative unlock predicates on the game manifest's level list ──
  // gate: { flag: key, equals?, slice? } | { completed: ref, slice? }. No gate → open.
  function evalGate(schema, state, gate) {
    if (!gate) return true;
    if (gate.flag !== undefined) {
      const name = gate.slice || firstSliceOfKind(schema, 'flags');
      const s = name && state[name];
      if (!s) return false;
      const v = s.flags[gate.flag];
      return gate.equals === undefined ? !!v : v === gate.equals;
    }
    if (gate.completed !== undefined) {
      const name = gate.slice || firstSliceOfKind(schema, 'progression');
      const s = name && state[name];
      return !!(s && s.completed[gate.completed] === 'success');
    }
    return false;
  }

  // ── saves — { contractVersion, storeState, runLog } as canonical JSON ─────────
  function makeSave(state, runLog) {
    return JSON.stringify({ contractVersion: CONTRACT_VERSION, storeState: state, runLog: runLog || [] });
  }
  function parseSave(text) {
    let save;
    try { save = JSON.parse(text); } catch (e) { return { ok: false, errors: ['save is not valid JSON: ' + e.message] }; }
    const errors = [];
    if (!save || typeof save !== 'object') errors.push('save must be an object');
    else {
      if (save.contractVersion !== CONTRACT_VERSION) errors.push('save.contractVersion ' + save.contractVersion + ' ≠ shell contract version ' + CONTRACT_VERSION);
      if (!save.storeState || typeof save.storeState !== 'object') errors.push('save.storeState missing');
      if (!Array.isArray(save.runLog)) errors.push('save.runLog must be an array');
    }
    return errors.length ? { ok: false, errors: errors } : { ok: true, save: save };
  }

  return {
    CONTRACT_VERSION: CONTRACT_VERSION,
    SLICE_KINDS: SLICE_KINDS,
    EVENT_TYPES: EVENT_TYPES,
    EVENTS_BY_KIND: EVENTS_BY_KIND,
    createStore: createStore,
    applyEvents: applyEvents,
    validateEnvelope: validateEnvelope,
    applyOutcome: applyOutcome,
    evalGate: evalGate,
    makeSave: makeSave,
    parseSave: parseSave,
  };
}
