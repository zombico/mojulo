/**
 * game-idioms — an authoring-time library of reusable game-rule idioms that LOWER to the existing
 * event-bus `events` manifest (see game-idioms.plan.md). Each idiom is a pure function returning an
 * `events` FRAGMENT built only from the existing fixed verbs (toggle/move/spawn/emit/set/inc);
 * `compose()` merges fragments into one manifest the bus ([event-bus.js](event-bus.js)) runs
 * unchanged. No new runtime, no new verbs, no model — the idiom is gone by the time the reducer
 * sees the manifest. This is composition that happens once, at build time.
 *
 * whack-a-mole.js is the proof case: its formerly hand-inlined `events` block recomposes from these
 * idioms into a behaviorally identical manifest (same hashState across a seeded playthrough —
 * game-idioms.test.js). Idioms earn a slot by recurring across real games, not speculatively.
 */

// channels compose() merges: `vars` is an object (shallow-merge, collisions reported); the rest are
// arrays (concatenated in idiom order — the bus sorts events by content, so order is behaviorless).
// `sources`/`sequences`/`initial` are the contact-fact channels (added for the contact-policy idioms).
const ARRAY_CHANNELS = ['entities', 'timers', 'reactions', 'watches', 'inputs', 'hud', 'sources', 'sequences', 'initial'];

const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const defined = (o) => { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; };

// compose(...fragments) → one `events` manifest. A var declared by two idioms is an authoring bug
// (which idiom owns `score`?), so it throws rather than silently clobbering. Empty channels are
// dropped so a composed manifest reads like a hand-written one (the bus treats missing as empty).
export function compose(...fragments) {
  const out = { vars: {} };
  for (const ch of ARRAY_CHANNELS) out[ch] = [];
  for (const frag of fragments) {
    if (!frag) continue;
    if (frag.vars) {
      for (const k in frag.vars) {
        if (Object.prototype.hasOwnProperty.call(out.vars, k)) {
          throw new Error(`game-idioms: var "${k}" declared by more than one idiom`);
        }
        out.vars[k] = frag.vars[k];
      }
    }
    for (const ch of ARRAY_CHANNELS) if (Array.isArray(frag[ch])) out[ch].push(...frag[ch]);
  }
  for (const ch of ARRAY_CHANNELS) if (out[ch].length === 0) delete out[ch];
  if (Object.keys(out.vars).length === 0) delete out.vars;
  return out;
}

// ── the v1 catalog — every idiom extracted verbatim from what whack-a-mole hand-wired ──────────

// scoreCounter — a tracker var, shown on the HUD. The matching `inc` is attached to a deed's
// effects (the deed is where scoring is wired to an actual action).
export function scoreCounter(name = 'score', { label } = {}) {
  return { vars: { [name]: 0 }, hud: [{ var: name, label: label || name }] };
}

// countdownClock — a var counting down 1/sec, GATED by `gate` (so it stops at game-over), firing
// `onZero` the tick it reaches <= 0. `tick` is the internal event type; leave it default for a
// single clock, pass a distinct one per clock if a world has several.
export function countdownClock({ var: timeVar = 'time', from, gate = 'over', onZero = 'game-over', tick = 'tick', label = 'Time' } = {}) {
  return {
    vars: { [timeVar]: from },
    timers: [{ every: 1, emit: { type: tick }, while: { var: gate, eq: 0 } }],
    reactions: [{ on: tick, do: 'inc', var: timeVar, by: -1 }],
    watches: [{ type: onZero, when: { var: timeVar, lte: 0 } }],
    hud: [{ var: timeVar, label }],
  };
}

// gameOverFreeze — on `signal`: raise the freeze `gate` (which halts every gated timer in one move),
// optionally show a `banner` entity, and lower (toggle off) the `clear` entities. The gate var is
// the shared freeze flag every timer idiom references — so a single freeze stops them all and no
// spawner can be left un-gated by accident.
export function gameOverFreeze({ signal = 'game-over', gate = 'over', banner, clear = [] } = {}) {
  return {
    vars: { [gate]: 0 },
    reactions: [
      { on: signal, do: 'set', var: gate, to: 1 },
      ...(banner ? [{ on: signal, do: 'toggle', target: banner, to: true }] : []),
      ...arr(clear).map((id) => ({ on: signal, do: 'toggle', target: id, to: false })),
    ],
  };
}

// spawnOnHeartbeat — each target gets a gated recurring timer emitting `pop` carrying its id under
// `field`; one reaction raises (toggles on) whatever the pop names. `periods` cycles if shorter
// than `targets`, so staggered heartbeats stay one short list.
export function spawnOnHeartbeat({ targets, periods, pop = 'pop', gate = 'over', field = 'hole', rise = true } = {}) {
  const ids = arr(targets);
  const p = arr(periods);
  return {
    timers: ids.map((id, i) => ({ every: p[i % p.length], emit: { type: pop, [field]: id }, while: { var: gate, eq: 0 } })),
    reactions: rise ? [{ on: pop, do: 'toggle', target: 'event.' + field, to: true }] : [],
  };
}

// deed — bind an input (pick/key/drag) to a bus event plus the reactions it triggers. This is the
// one genuinely game-specific seam: the rest of the catalog is generic, the deed is where a game
// says what an action MEANS.
export function deed({ on = 'pick', emit = 'whack', effects = [] } = {}) {
  return { inputs: [{ on, emit: { type: emit } }], reactions: arr(effects) };
}

// ── contact-policy idioms — POLICY over spatial FACTS the integrator already emits ──────────────
// The integrator (physics-sim.js) emits `contact`/`rest` facts; `sources` is the allowlist of which
// to surface, and a reaction assigns MEANING. These idioms emit the source + the reaction together,
// so a physics game stops hand-pairing them (the whack-a-mole smell, in the contact channel —
// newton-cradles.js recomposes its clack policy from `onContact`). They add NO collision detection;
// that is mechanism, and stays in physics-sim.js.

// onContact — surface a contact fact (a touches b) and react to it. The general contact primitive:
// `...spec` is the verb the contact triggers (do:'emit'/'impulse'/'toggle'/…, plus its fields like
// type/scope/target/gain). The source orients so `event.a` aligns with `when.a` regardless of the
// physics pair order. Omit `a` or `b` to leave that side a wildcard.
export function onContact({ a, b, ...spec } = {}) {
  const when = defined({ a, b });
  return {
    sources: [{ type: 'contact', when }],
    reactions: [{ on: 'contact', match: when, ...spec }],
  };
}

// pickup — `item` touching `by` is collected: the item disappears (toggle off) and a tracker var
// increments. Billiards potting / coin pickup. `event.a` is the item (the source orients it there).
export function pickup({ item, by, score = 'score' } = {}) {
  const when = defined({ a: item, b: by });
  return {
    sources: [{ type: 'contact', when }],
    reactions: [
      { on: 'contact', match: when, do: 'toggle', target: 'event.a', to: false },
      { on: 'contact', match: when, do: 'inc', var: score },
    ],
  };
}

// onRest — a body coming to rest (the integrator's `rest` edge) triggers a reaction. Shuffleboard /
// curling "delivered," a settled domino. `...spec` is the verb. (chainReaction — a domino kicking
// its struck neighbor — is deferred until a real domino world pins down its impulse direction.)
export function onRest({ body, ...spec } = {}) {
  const when = defined({ body });
  return {
    sources: [{ type: 'rest', when }],
    reactions: [{ on: 'rest', match: when, ...spec }],
  };
}

// ── lifetime idiom — a target that appears, lives `ttl` seconds, then disappears ─────────────────
// ephemeralTarget — on the `on` event (e.g. spawnOnHeartbeat's 'pop'), toggle the named entity ON,
// wait `ttl`, then toggle it OFF — one independent timeline per target (scope = the target id), via
// the bus's scope-keyed sequences. Pair with spawnOnHeartbeat({ rise:false }) so the heartbeat just
// emits the pop and this idiom owns the appear/disappear lifecycle. No spawn/despawn verb: visibility
// is `toggle` over a pooled, pre-placed entity (whack-a-mole's model). A re-pop while the target is
// still up is ignored (its scope is live); once the lifetime ends the scope frees and it can pop again.
export function ephemeralTarget({ on = 'pop', ttl = 2.0, field = 'target' } = {}) {
  const ref = 'event.' + field;
  return {
    sequences: [{
      id: 'ttl-' + on,
      scope: ref,
      trigger: { on },
      steps: [
        { do: 'toggle', target: ref, to: true },
        { await: { timer: ttl } },
        { do: 'toggle', target: ref, to: false },
      ],
    }],
  };
}

// ── ray-policy idiom — POLICY over the line-of-sight `fire` FACT (scene-three.js mechanism) ──────
// hitConfirm — the laser-pointer deed: a `fire` input (LOS raycast, stamps the hit `target`;
// occluded/missed shots emit nothing) confirmed into game effects. Like the proven `deed`, but the
// target is resolved by line of sight instead of cursor pick. By default the hit target drops (toggle
// off — the whack-a-mole confirm) and a tracker var increments; an optional `marker` entity flashes on
// as a hitmarker. The raycast + occlusion live in scene-three.js, not here. `from` aims the ray from a
// CONTROLLABLE entity's own line of sight (third-person — head at `eye` height, along its heading)
// instead of camera-forward (first-person); pass the shooter entity's id.
export function hitConfirm({ on = 'fire', emit = 'shot', score = 'score', drop = true, marker, from, eye, level } = {}) {
  return {
    inputs: [{ on, emit: { type: emit }, ...(from ? { from } : {}), ...(eye != null ? { eye } : {}), ...(level ? { level: true } : {}) }],
    reactions: [
      ...(drop ? [{ on: emit, do: 'toggle', target: 'event.target', to: false }] : []),  // the hit target drops
      { on: emit, do: 'inc', var: score },                                                // score the confirmed hit
      ...(marker ? [{ on: emit, do: 'toggle', target: marker, to: true }] : []),          // optional hitmarker flash
    ],
  };
}
