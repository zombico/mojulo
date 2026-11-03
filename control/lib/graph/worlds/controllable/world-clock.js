/**
 * world-clock.js — THE WORLD CLOCK: a live world's time slowed, held and ramped on what happens in it, the camera keeping
 * real time. The live sibling of the time map (shoot/time.js), which a rendered film plays ahead of time: a game cannot
 * be rendered ahead or rewound, so its moments scale the world's own step as it runs.
 *
 *   spec.tempo: { moments: [{ on, scale, hold, ramp?, cooldown? }] }
 *     on        what fires it, read off the world each step:
 *                 'strike'     a melee connect (combat-melee.js stamps `lastStrike` with the step's time)
 *                 'down'       any body downed
 *                 'down:foe'   a body other than the pilot downed
 *                 'last-down'  the last hittable body other than the pilot downed (a finisher; the kill cam's moment)
 *                 'dodge'      the pilot begins a dodge (combat-hit.js counts them)
 *               or any other name, fired from outside by `tempoMoment(state, name)` (a cue, the bus, the page)
 *     scale     the world's speed while it holds, 0 … 1 (0: the world held still, a freeze)
 *     hold      real seconds at that scale
 *     ramp      real seconds easing into the scale and back out of it (a speed ramp; 0 cuts straight in and out)
 *     cooldown  real seconds from its firing before it may fire again (a multi-kill does not ping-pong the clock)
 *
 * The step: the world at `dt × scale`, the CAMERA at the real `dt` (its rule handed the real step while the world's runs),
 * so it can move through a held moment: bullet time. A freeze steps the world by a vanishing sliver (FROZEN of a step),
 * so every pass keeps its order and nothing moves to the eye. The clock's own time runs on real seconds. A moment
 * firing while another plays takes over if it is as slow or slower, eased from the scale the world is at; a weaker one
 * waits its turn (it is dropped). `state.tempo` says where it is: `{ scale, real, playing: { on, t } | null }`.
 *
 * Composed outermost (after hitstop), so a hitstop's frames run on the world's scaled clock. Import-free (the page runs
 * this source via toString(), compose.js); emitted only into a page whose world has a tempo, and a world without one
 * gets no state key: every other page and world keeps every byte.
 */

export function buildWorldClock(E) {
  const FROZEN = 1e-6;
  const ease = (u) => u * u * (3 - 2 * u);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  E.registerStateInit((state, spec) => {
    const T = spec && spec.tempo;
    const moments = (T && Array.isArray(T.moments) ? T.moments : []).filter((m) => m && typeof m.on === 'string' && m.on).map((m) => ({
      on: m.on, scale: Math.max(0, Math.min(1, num(m.scale, 0.25))), hold: Math.max(0, num(m.hold, 1)),
      ramp: Math.max(0, num(m.ramp, 0)), cooldown: Math.max(0, num(m.cooldown, 0)),
    }));
    if (!moments.length) return;
    const downed = {};
    for (const e of state.entities) if (e.downed) downed[e.id] = true;
    const pilot = state.pilotId && state.byId[state.pilotId];
    state.tempo = { moments, scale: 1, real: 0, playing: null, fired: moments.map(() => -Infinity), seen: { downed, dodges: (pilot && pilot.dodgeCount) || 0, foes: foesOf(state).length } };
  });

  // the hittable bodies other than the pilot and the camera: who a finisher finishes
  function foesOf(state) {
    return state.entities.filter((e) => !e.isCamera && e.id !== state.pilotId && e.body && e.body.hittable);
  }

  // the scale the playing moment gives at its real time t (eased in from `from`, held, eased back to 1), null once over
  function scaleOf(p) {
    const m = p.m, r = m.ramp;
    if (p.t < r) return p.from + (m.scale - p.from) * ease(p.t / r);
    if (p.t < r + m.hold) return m.scale;
    if (p.t < 2 * r + m.hold) return m.scale + (1 - m.scale) * ease((p.t - r - m.hold) / r);
    return null;
  }

  // fire the moments listening for `on`: the slowest of them, if it is as slow as what plays and off its cooldown
  function fire(state, on) {
    const T = state.tempo;
    if (!T) return false;
    let best = -1;
    T.moments.forEach((m, i) => { if (m.on === on && T.real - T.fired[i] >= m.cooldown && (best < 0 || m.scale < T.moments[best].scale)) best = i; });
    if (best < 0) return false;
    const m = T.moments[best];
    if (T.playing && m.scale > T.playing.m.scale) return false;
    T.fired[best] = T.real;
    T.playing = { on, m, t: 0, from: T.scale };
    return true;
  }

  // what happened in the step just run, as the names moments listen for
  function signals(state, t0) {
    const T = state.tempo, out = [], seen = T.seen;
    let struck = false, downs = 0, foeDowns = 0;
    for (const e of state.entities) {
      if (e.lastStrike && e.lastStrike.t === t0) struck = true;
      if (e.downed && !seen.downed[e.id]) { seen.downed[e.id] = true; downs++; if (e.id !== state.pilotId && !e.isCamera) foeDowns++; }
      else if (!e.downed && seen.downed[e.id]) delete seen.downed[e.id];   // up again (a respawn): it may go down again
    }
    if (struck) out.push('strike');
    if (downs) out.push('down');
    if (foeDowns) {
      out.push('down:foe');
      const foes = foesOf(state);
      if (foes.length && foes.every((e) => e.downed || e.gone)) out.push('last-down');
    }
    const pilot = state.pilotId && state.byId[state.pilotId], n = (pilot && pilot.dodgeCount) || 0;
    if (n > seen.dodges) out.push('dodge');
    seen.dodges = n;
    return out;
  }

  const step = E.stepWorld;
  E.stepWorld = function stepWithTempo(state, input, dt, hooks) {
    const T = state.tempo;
    if (!T) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    T.real += dt;
    if (T.playing) { T.playing.t += dt; const s = scaleOf(T.playing); if (s === null) { T.playing = null; T.scale = 1; } else T.scale = s; }
    const scale = Math.max(FROZEN, T.scale), cam = state.camera, R = E.RULES, type = cam && cam.rule && cam.rule.type, rule = type && R[type];
    // the camera keeps real time: its rule is handed the real step while the world's runs at the scale
    if (rule && scale < 1) R[type] = function cameraOnRealTime(e, inp, d, w) { return rule(e, inp, e === cam ? dt : d, w); };
    const t0 = state.time;
    try { step(state, input, dt * (scale < 1 ? scale : 1), hooks); } finally { if (rule) R[type] = rule; }
    for (const on of signals(state, t0)) fire(state, on);
    return state;
  };
  E.tempoMoment = (state, on) => fire(state, on);
  E.tempoScale = (state) => (state.tempo ? state.tempo.scale : 1);
}

// ── reading a world's tempo (Node only: the builder above is what the page runs) ─────────────────────────────────────

/** what a moment fires on, read off the world (any other name is fired from outside: a cue, the bus, the page) */
export const TEMPO_SIGNALS = Object.freeze(['strike', 'down', 'down:foe', 'last-down', 'dodge']);
/** the words for a world's tempo, each its moments: the finisher's slow motion, the kill cam's longer one, a heavy blow's
 * freeze and the slow after a foe falls, bullet time on a dodge */
export const TEMPO_PRESETS = Object.freeze({
  finisher: [{ on: 'last-down', scale: 0.2, hold: 1.2, ramp: 0.25 }],
  'kill-cam': [{ on: 'last-down', scale: 0.12, hold: 2, ramp: 0.3 }],
  impact: [{ on: 'strike', scale: 0, hold: 0.05, cooldown: 0.2 }, { on: 'down:foe', scale: 0.3, hold: 0.4, ramp: 0.1, cooldown: 1.5 }],
  bullet: [{ on: 'dodge', scale: 0.3, hold: 1.5, ramp: 0.2, cooldown: 3 }],
});
const LIMITS = { hold: 10, ramp: 3, cooldown: 60 };

/**
 * A world's `tempo` read into the kernel's spec, or throws naming what it takes: a preset word, a list of words, or
 * `{ moments: [{ on, scale, hold, ramp?, cooldown? }] }` (words and moments may mix in a list). Null for none.
 */
export function readTempo(raw) {
  if (raw == null || raw === false) return null;
  const items = Array.isArray(raw) ? raw : typeof raw === 'object' && Array.isArray(raw.moments) ? raw.moments : [raw];
  const moments = [];
  for (const it of items) {
    if (typeof it === 'string') {
      if (!TEMPO_PRESETS[it]) throw new Error(`tempo: '${it}' is not a tempo (words: ${Object.keys(TEMPO_PRESETS).join(', ')}; or moments: [{ on, scale, hold, ramp?, cooldown? }])`);
      moments.push(...TEMPO_PRESETS[it].map((m) => ({ ...m })));
      continue;
    }
    if (!it || typeof it !== 'object' || typeof it.on !== 'string' || !it.on.trim()) throw new Error(`tempo: a moment is { on, scale, hold, ramp?, cooldown? }, on one of ${TEMPO_SIGNALS.join(', ')} or a name fired from outside`);
    const m = { on: it.on.trim() };
    if (!(typeof it.scale === 'number' && it.scale >= 0 && it.scale <= 1)) throw new Error(`tempo: a moment's scale is the world's speed, 0 (held) to 1, not ${JSON.stringify(it.scale)}`);
    m.scale = it.scale;
    for (const k of ['hold', 'ramp', 'cooldown']) {
      if (it[k] === undefined) continue;
      if (!(typeof it[k] === 'number' && it[k] >= 0 && it[k] <= LIMITS[k])) throw new Error(`tempo: a moment's ${k} is 0 to ${LIMITS[k]} real seconds, not ${JSON.stringify(it[k])}`);
      m[k] = it[k];
    }
    if (m.hold === undefined) throw new Error('tempo: a moment says how long it holds (`hold`, real seconds)');
    moments.push(m);
  }
  return moments.length ? { moments: moments.slice(0, 8) } : null;
}
