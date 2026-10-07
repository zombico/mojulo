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
// Presentation rides the row (hud-widgets.js): `slot` (a corner or the centre line), `as`
// (text | counter | bar | clock), `color`. Omitted → the defaults every existing world has.
export function scoreCounter(name = 'score', { label, slot, as, color } = {}) {
  return { vars: { [name]: 0 }, hud: [{ var: name, label: label || name, ...defined({ slot, as, color }) }] };
}

// countdownClock — a var counting down 1/sec, GATED by `gate` (so it stops at game-over), firing
// `onZero` the tick it reaches <= 0. `tick` is the internal event type; leave it default for a
// single clock, pass a distinct one per clock if a world has several.
export function countdownClock({ var: timeVar = 'time', from, gate = 'over', onZero = 'game-over', tick = 'tick', label = 'Time', slot, as, color } = {}) {
  return {
    vars: { [timeVar]: from },
    timers: [{ every: 1, emit: { type: tick }, while: { var: gate, eq: 0 } }],
    reactions: [{ on: tick, do: 'inc', var: timeVar, by: -1 }],
    watches: [{ type: onZero, when: { var: timeVar, lte: 0 } }],
    hud: [{ var: timeVar, label, ...defined({ slot, as, color }) }],
  };
}

// banner — a TEXT moment on the centre line: when the bus emits `on` (a glob, as game.on / fx.on
// match), `text` shows for `ttl` seconds; `{name}` in the text reads a var ("TIME! {score}").
// The screen-space sibling of gameOverFreeze's entity banner (the gold sphere): a game says
// what happened in words, where the player is looking. Pure presentation — no state, no verbs.
export function banner({ on = 'game-over', text, slot, ttl, color } = {}) {
  if (typeof text !== 'string' || !text) throw new Error('game-idioms: banner needs text');
  return { hud: [{ on, text, ...defined({ slot, ttl, color }) }] };
}

// legend — static text in a slot: the controls hint, the "press E" prompt. `ttl` makes it a
// one-shot that fades after the opening seconds.
export function legend({ text, slot, ttl, color } = {}) {
  if (typeof text !== 'string' || !text) throw new Error('game-idioms: legend needs text');
  return { hud: [{ text, ...defined({ slot, ttl, color }) }] };
}

// toast — the damage number: a banner that STACKS, one rising + fading element per firing. Two
// forms, exactly one of `on` / `var`: `on` fires on a bus event and `text` may read the event's
// fields (`-{event.damage}` off hitConfirm({ damage })); `var` fires when a bus var CHANGES and
// `text` (default '{delta}') may read `{delta}` (signed) and `{value}` — damage taken off the
// hazard mechanic's own `inc hp`, no new event. Pure presentation, like banner / legend.
export function toast({ on, var: v, text, slot, ttl, color } = {}) {
  const hasOn = typeof on === 'string' && on.length > 0, hasVar = typeof v === 'string' && v.length > 0;
  if (hasOn === hasVar) throw new Error('game-idioms: toast needs exactly one of on (an event) or var (a bus var)');
  if (on && (typeof text !== 'string' || !text)) throw new Error('game-idioms: an event toast needs text');
  if (text !== undefined && typeof text !== 'string') throw new Error('game-idioms: toast text must be a string');
  return { hud: [{ ...(on ? { on } : { var: v }), as: 'toast', ...defined({ text, slot, ttl, color }) }] };
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
// `damage` rides the emitted event as a field (`{ type: 'shot', damage: 12, target }`) so a
// `toast({ on: 'shot', text: '-{event.damage}' })` can show the number; it is DATA on the event,
// no reaction reads it — a world that wants hp arithmetic wires its own `inc` off the same event.
export function hitConfirm({ on = 'fire', emit = 'shot', score = 'score', drop = true, marker, from, eye, level, damage } = {}) {
  return {
    inputs: [{ on, emit: { type: emit, ...(Number.isFinite(damage) ? { damage } : {}) }, ...(from ? { from } : {}), ...(eye != null ? { eye } : {}), ...(level ? { level: true } : {}) }],
    reactions: [
      ...(drop ? [{ on: emit, do: 'toggle', target: 'event.target', to: false }] : []),  // the hit target drops
      { on: emit, do: 'inc', var: score },                                                // score the confirmed hit
      ...(marker ? [{ on: emit, do: 'toggle', target: marker, to: true }] : []),          // optional hitmarker flash
    ],
  };
}

// ── the shelf — one lowering map and one about row per idiom ──────────────────────────────────────
// IDIOM_LOWERING is the single kind → fragment map every declarative caller lowers through (compose_world's
// action base, the playscape builder). Every idiom takes one params object except scoreCounter (positional
// name), which gets a thin adapter; onContact / onRest forward their extra fields as the `...spec` verb.
export const IDIOM_LOWERING = {
  scoreCounter: (p = {}) => scoreCounter(p.name ?? p.var ?? 'score', { label: p.label, slot: p.slot, as: p.as, color: p.color }),
  countdownClock: (p) => countdownClock(p),
  banner: (p) => banner(p),
  legend: (p) => legend(p),
  toast: (p) => toast(p),
  gameOverFreeze: (p) => gameOverFreeze(p),
  spawnOnHeartbeat: (p) => spawnOnHeartbeat(p),
  deed: (p) => deed(p),
  onContact: (p) => onContact(p),
  pickup: (p) => pickup(p),
  onRest: (p) => onRest(p),
  ephemeralTarget: (p) => ephemeralTarget(p),
  hitConfirm: (p) => hitConfirm(p),
};
export const IDIOM_KINDS = Object.keys(IDIOM_LOWERING);

// lowerIdioms([{ kind, ...params }]) → the fragments, in order; an unknown kind names the shelf.
export function lowerIdioms(recipe, where = 'idioms') {
  return (Array.isArray(recipe) ? recipe : []).map((entry, i) => {
    if (!entry || typeof entry !== 'object') throw new Error(`${where}[${i}] must be an object { kind, ...params }`);
    const { kind, ...params } = entry;
    const make = IDIOM_LOWERING[kind];
    if (!make) throw new Error(`${where}[${i}] has unknown kind '${kind}' (known: ${IDIOM_KINDS.join(', ')})`);
    return make(params);
  });
}

// The rungs of interactivity, lowest first. An idiom's `tier` is the lowest rung it is useful on: a click demo
// (things you press that answer), a walk demo (a body you drive through the world), a level (one place with a
// goal), a game (levels that carry state between them).
export const PLAY_TIERS = ['click', 'walk', 'level', 'game'];

// One row per idiom, kept beside the functions so a new idiom cannot ship without its card. `example` is a real
// recipe row: the card lowers it and prints what it becomes, so the card cannot drift from the function.
// `needs` names what the world must already hold for the idiom to do anything.
export const IDIOM_ABOUT = {
  scoreCounter: {
    name: 'Score counter', tier: 'level',
    summary: 'A tracker var shown on the HUD. Something else increments it: a deed, a pickup or a confirmed hit.',
    when: 'keep score, a points counter, count the hits, a tally on screen',
    params: { name: 'the var (default score)', label: 'HUD label', slot: 'HUD slot', as: 'text | counter | bar | clock', color: 'HUD colour' },
    example: { name: 'score', label: 'Score' },
  },
  countdownClock: {
    name: 'Countdown clock', tier: 'level',
    summary: 'A var counting down once a second, stopped by the freeze gate, that fires an event when it reaches zero.',
    when: 'a timed round, a countdown, beat the clock, 30 seconds to score',
    params: { var: 'the var (default time)', from: 'starting seconds', onZero: 'event fired at zero (default game-over)', gate: 'freeze var (default over)', tick: 'a distinct tick event per clock if a world has several', label: 'HUD label' },
    example: { var: 'time', from: 30, label: 'Time' },
  },
  banner: {
    name: 'Banner', tier: 'level',
    summary: 'Words on the centre line when an event fires, for a few seconds; {name} reads a var.',
    when: 'game over text, show TIME!, a you win message, announce what happened',
    params: { on: 'event glob (default game-over)', text: 'the words; {score} reads a var', slot: 'HUD slot', ttl: 'seconds shown', color: 'colour' },
    example: { on: 'game-over', text: 'TIME! {score}' },
  },
  legend: {
    name: 'Legend', tier: 'click',
    summary: 'Static text in a slot: the controls hint or a press-E prompt. A ttl makes it fade after the opening seconds.',
    when: 'controls hint, press E to open, click the lever, an instruction on screen',
    params: { text: 'the words', slot: 'HUD slot', ttl: 'seconds before it fades', color: 'colour' },
    example: { text: 'Click the lever', slot: 'bottom', ttl: 6 },
  },
  toast: {
    name: 'Toast', tier: 'level',
    summary: 'A rising, fading number that stacks: one per event, or one each time a var changes.',
    when: 'damage numbers, +1 popping up, show points gained, hit feedback',
    params: { on: 'an event (text may read {event.<field>})', var: 'or a var (text may read {delta} and {value})', text: 'the words', slot: 'HUD slot', ttl: 'seconds', color: 'colour' },
    example: { var: 'score', text: '+{delta}' },
  },
  gameOverFreeze: {
    name: 'Game-over freeze', tier: 'level',
    summary: 'On a signal, raise the freeze gate (every gated timer stops), optionally show a banner entity and lower the listed entities.',
    when: 'end the round, stop everything at game over, freeze when time runs out',
    params: { signal: 'event (default game-over)', gate: 'freeze var (default over)', banner: 'entity id to show', clear: 'entity ids to hide' },
    example: { signal: 'game-over', clear: ['mole-0', 'mole-1'] },
    needs: 'the entities it names',
  },
  spawnOnHeartbeat: {
    name: 'Spawn on heartbeat', tier: 'level',
    summary: 'Each target pops on its own cadence while the gate is down; periods cycle when shorter than targets.',
    when: 'moles pop up, targets appear on a rhythm, things spawn every few seconds',
    params: { targets: 'entity ids', periods: 'seconds, cycled', pop: 'event (default pop)', field: 'event field naming the target', rise: 'false to only emit, pairing with ephemeralTarget', gate: 'freeze var' },
    example: { targets: ['mole-0', 'mole-1'], periods: [1.2, 0.9], field: 'hole' },
    needs: 'the entities it names',
  },
  deed: {
    name: 'Deed', tier: 'click',
    summary: 'Bind an input (pick, key or drag) to an event and the reactions it triggers: where a world says what an action means.',
    when: 'click a thing and it reacts, press a button, a switch, whack it, tap to toggle',
    params: { on: 'pick | key | drag', emit: 'event type', effects: 'reaction rows ({ on, do, target | var, … })' },
    example: { on: 'pick', emit: 'flip', effects: [{ on: 'flip', do: 'toggle', target: 'lamp' }] },
    needs: 'the entities its effects name',
  },
  onContact: {
    name: 'On contact', tier: 'walk',
    summary: 'When a touches b, run a verb. Omit a or b for a wildcard. Policy over the physics contact facts.',
    when: 'when it hits, bump into it, touch to trigger, a collision does something',
    params: { a: 'entity id', b: 'entity id', '…verb': 'do: emit | impulse | toggle | …, plus its fields' },
    example: { a: 'ball', b: 'bell', do: 'emit', type: 'ring' },
    needs: 'a physics world',
  },
  pickup: {
    name: 'Pickup', tier: 'walk',
    summary: 'An item touching a collector disappears and a tracker var counts it.',
    when: 'collect coins, pot the ball, grab it by touching it',
    params: { item: 'entity id', by: 'collector entity id', score: 'var (default score)' },
    example: { item: 'coin-0', by: 'player', score: 'coins' },
    needs: 'a physics world and the var it counts into',
  },
  onRest: {
    name: 'On rest', tier: 'walk',
    summary: 'A body coming to rest runs a verb: delivered, settled, landed.',
    when: 'when it stops, the stone settles, after it lands',
    params: { body: 'entity id', '…verb': 'do: emit | toggle | …, plus its fields' },
    example: { body: 'stone', do: 'emit', type: 'delivered' },
    needs: 'a physics world',
  },
  ephemeralTarget: {
    name: 'Ephemeral target', tier: 'level',
    summary: 'On an event, a target appears, lives ttl seconds and disappears; one timeline per target.',
    when: 'targets that vanish, appear then disappear, a short window to hit it',
    params: { on: 'event (default pop)', ttl: 'seconds alive', field: 'event field naming the target' },
    example: { on: 'pop', ttl: 2, field: 'target' },
    needs: 'a heartbeat or other event naming the target',
  },
  hitConfirm: {
    name: 'Hit confirm', tier: 'level',
    summary: 'A fire input raycasts by line of sight; a hit drops the target, scores, and can flash a marker.',
    when: 'shoot targets, a laser range, aim and fire, a shooting gallery',
    params: { on: 'input (default fire)', emit: 'event (default shot)', score: 'var', drop: 'hide the hit target', marker: 'entity id flashed on a hit', from: 'shooter entity for third person', damage: 'number carried on the event' },
    example: { score: 'score', marker: 'hitmarker' },
    needs: 'the var it scores into; a marker entity if named',
  },
};
