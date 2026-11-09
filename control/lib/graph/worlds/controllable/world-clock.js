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
 * A moment may be ended early by name, `tempoEnd(state, on)` (a scene's `Real time.`): the one playing eases back out
 * at the start of its ramp out (one with no ramp is over at once). Any other moment ends on its own.
 *
 * THE IMPACT CAM: a moment knows WHO (a strike: the striker and the struck; a down: the one who downed it and the downed;
 * a dodge: the pilot), and a moment's `cam` (a frame word, or { frame, on?, side?, move?, lerp?, cut? }: the shot rule's,
 * rules-basic.js; `on` names 'a' and 'b', the two it knows) takes the camera with the shot rule on them as it fires, eased
 * in on real time while the world crawls, and hands it back as the moment ends (the follow camera lerps back from where the
 * shot left it). It never takes the camera from a scene's shot (the camera's rule held aside already) or from the tackle
 * cinematic; a moment that takes over without a cam hands the camera back.
 *
 * THE LOOK: a moment's `look` (grade dials, channels/grade.js, and `impact`: frames of the inverted impact frame as it
 * fires) is the page's to lay: `tempoWeight` is the moment's envelope (0 as it fires and ramps, 1 held, back to 0), and
 * the page eases the look over the world's grade by it, the zoom aimed at whom the moment is about.
 *
 * Composed outermost (after hitstop), so a hitstop's frames run on the world's scaled clock. Import-free (the page runs
 * this source via toString(), compose.js); emitted only into a page whose world has a tempo, and a world without one
 * gets no state key: every other page and world keeps every byte.
 */

export function buildWorldClock(E) {
  const FROZEN = 1e-6;
  const ease = (u) => u * u * (3 - 2 * u);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  const camOf = (c) => (typeof c === 'string' ? { frame: c } : c && typeof c === 'object' ? c : null);
  E.registerStateInit((state, spec) => {
    const T = spec && spec.tempo;
    const moments = (T && Array.isArray(T.moments) ? T.moments : []).filter((m) => m && typeof m.on === 'string' && m.on).map((m) => ({
      on: m.on, scale: Math.max(0, Math.min(1, num(m.scale, 0.25))), hold: Math.max(0, num(m.hold, 1)),
      ramp: Math.max(0, num(m.ramp, 0)), cooldown: Math.max(0, num(m.cooldown, 0)), ...(camOf(m.cam) ? { cam: camOf(m.cam) } : {}),
      ...(m.look && typeof m.look === 'object' ? { look: m.look } : {}),
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

  // how far into its look the playing moment is: eased in over its ramp, held, eased out; 0 when none plays
  function weightOf(p) {
    const m = p.m, r = m.ramp;
    if (p.t < r) return ease(p.t / r);
    if (p.t < r + m.hold) return 1;
    if (p.t < 2 * r + m.hold) return 1 - ease((p.t - r - m.hold) / r);
    return 0;
  }

  // fire the moments listening for `on`: the slowest of them, if it is as slow as what plays and off its cooldown; `who`
  // the two it is about ({ a, b }: ids), for its camera
  function fire(state, on, who) {
    const T = state.tempo;
    if (!T) return false;
    let best = -1;
    T.moments.forEach((m, i) => { if (m.on === on && T.real - T.fired[i] >= m.cooldown && (best < 0 || m.scale < T.moments[best].scale)) best = i; });
    if (best < 0) return false;
    const m = T.moments[best];
    if (T.playing && m.scale > T.playing.m.scale) return false;
    T.fired[best] = T.real;
    T.playing = { on, m, t: 0, from: T.scale, who: who || {} };
    if (m.cam) takeCam(state, m.cam, T.playing.who); else giveCam(state);
    return true;
  }

  // the impact cam: the shot rule on the two the moment knows, unless a scene or the tackle cinematic holds the camera
  function takeCam(state, cam, who) {
    const T = state.tempo, C = state.camera;
    if (!C || state.cinematic || (C.heldRule && !T.cam)) return;
    const ids = (Array.isArray(cam.on) ? cam.on : ['a', 'b']).map((k) => (k === 'a' || k === 'b' ? who[k] : k)).filter((id, i, all) => id && state.byId[id] && all.indexOf(id) === i);
    if (!ids.length) { giveCam(state); return; }
    const { on: _on, ...rest } = cam;
    E.castOps(state, [{ op: 'shot', shot: { frame: ids.length > 1 ? 'two' : 'close', cut: false, lerp: 6, ...rest, on: ids } }]);
    T.cam = true;
  }
  function giveCam(state) {
    const T = state.tempo;
    if (!T.cam) return;
    E.castOps(state, [{ op: 'unshot' }]);
    T.cam = false;
  }

  // what happened in the step just run, as the names moments listen for
  // (each with whom it is about: { a, b })
  function signals(state, t0) {
    const T = state.tempo, out = [], seen = T.seen;
    let struck = null, down = null, foeDown = null;
    for (const e of state.entities) {
      if (e.lastStrike && e.lastStrike.t === t0 && !struck) struck = { a: e.id, b: e.lastStrike.targetId };
      if (e.downed && !seen.downed[e.id]) {
        seen.downed[e.id] = true;
        const who = { a: e.lastHitBy || null, b: e.id };
        if (!down) down = who;
        if (e.id !== state.pilotId && !e.isCamera && !foeDown) foeDown = who;
      } else if (!e.downed && seen.downed[e.id]) delete seen.downed[e.id];   // up again (a respawn): it may go down again
    }
    if (struck) out.push(['strike', struck]);
    if (down) out.push(['down', down]);
    if (foeDown) {
      out.push(['down:foe', foeDown]);
      const foes = foesOf(state);
      if (foes.length && foes.every((e) => e.downed || e.gone)) out.push(['last-down', foeDown]);
    }
    const pilot = state.pilotId && state.byId[state.pilotId], n = (pilot && pilot.dodgeCount) || 0;
    if (n > seen.dodges) out.push(['dodge', { a: state.pilotId }]);
    seen.dodges = n;
    return out;
  }

  const step = E.stepWorld;
  E.stepWorld = function stepWithTempo(state, input, dt, hooks) {
    const T = state.tempo;
    if (!T) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    T.real += dt;
    if (T.playing) { T.playing.t += dt; const s = scaleOf(T.playing); if (s === null) { T.playing = null; T.scale = 1; giveCam(state); } else T.scale = s; }
    const scale = Math.max(FROZEN, T.scale), cam = state.camera, R = E.RULES, type = cam && cam.rule && cam.rule.type, rule = type && R[type];
    // the camera keeps real time: its rule is handed the real step while the world's runs at the scale
    if (rule && scale < 1) R[type] = function cameraOnRealTime(e, inp, d, w) { return rule(e, inp, e === cam ? dt : d, w); };
    const t0 = state.time;
    try { step(state, input, dt * (scale < 1 ? scale : 1), hooks); } finally { if (rule) R[type] = rule; }
    for (const [on, who] of signals(state, t0)) fire(state, on, who);
    return state;
  };
  // end a moment early (a scene's `Real time.`): the one playing, if it is `on`, eases out from where it is
  function end(state, on) {
    const T = state.tempo, p = T && T.playing;
    if (!p || p.on !== on) return false;
    // (to the start of its ramp out; one with no ramp is over at once, so a moment fired after it plays)
    const m = p.m, out = m.ramp + m.hold;
    if (!(m.ramp > 0)) { T.playing = null; T.scale = 1; giveCam(state); return true; }
    if (p.t < out) p.t = out;
    return true;
  }
  E.tempoMoment = (state, on, who) => fire(state, on, who);
  E.tempoEnd = (state, on) => end(state, on);
  E.tempoScale = (state) => (state.tempo ? state.tempo.scale : 1);
  E.tempoWeight = (state) => (state.tempo && state.tempo.playing ? weightOf(state.tempo.playing) : 0);
}

// ── reading a world's tempo (Node only: the builder above is what the page runs) ─────────────────────────────────────
import { readGrade, GRADE_DIAL_NAMES } from '../../scene/channels/grade.js';

/** what a moment fires on, read off the world (any other name is fired from outside: a cue, the bus, the page) */
export const TEMPO_SIGNALS = Object.freeze(['strike', 'down', 'down:foe', 'last-down', 'dodge']);
/** the words for a world's tempo, each its moments: the finisher's slow motion, the kill cam's longer one, a heavy blow's
 * freeze and the slow after a foe falls, bullet time on a dodge */
export const TEMPO_PRESETS = Object.freeze({
  // (the finisher framed on the two of them; the kill cam low on the downed, pushing in)
  // (the finisher framed on the two of them, its colour drained and the bars drawn; the kill cam low on the downed,
  // pushing in, near grey and grained; a blow lands on an impact frame, a zoom toward the struck and a shake; bullet
  // time bleeds its colour and splits its channels)
  finisher: [{ on: 'last-down', scale: 0.2, hold: 1.2, ramp: 0.25, cam: 'two', look: { saturation: 0.35, contrast: 1.15, vignette: 0.45, bars: 0.1 } }],
  'kill-cam': [{ on: 'last-down', scale: 0.12, hold: 2, ramp: 0.3, cam: { frame: 'low', on: ['b', 'a'], move: 'push' }, look: { saturation: 0.2, contrast: 1.2, vignette: 0.55, bars: 0.12, grain: 0.2 } }],
  impact: [{ on: 'strike', scale: 0, hold: 0.05, cooldown: 0.2, look: { impact: 2, zoom: 0.35, shake: 0.6, flash: 0.12 } }, { on: 'down:foe', scale: 0.3, hold: 0.4, ramp: 0.1, cooldown: 1.5, look: { saturation: 0.6, vignette: 0.3 } }],
  bullet: [{ on: 'dodge', scale: 0.3, hold: 1.5, ramp: 0.2, cooldown: 3, look: { saturation: 0.45, aberration: 4, vignette: 0.35, warmth: -0.15 } }],
});
const LIMITS = { hold: 10, ramp: 3, cooldown: 60 };
/** the impact cam's frames (the shot rule's words, rules-basic.js FRAMES and `over`) and moves */
export const CAM_FRAMES = Object.freeze(['two', 'close', 'profile', 'low', 'wide', 'corner', 'overhead', 'over']);
export const CAM_MOVES = Object.freeze(['hold', 'track', 'push', 'orbit']);

// a moment's look: grade dials (channels/grade.js) and `impact`, the inverted impact frame's frames as it fires (1 to 6)
function readLook(L) {
  if (!L || typeof L !== 'object' || Array.isArray(L)) throw new Error(`tempo: a moment's look is grade dials (${GRADE_DIAL_NAMES.join(', ')}) and impact (frames of the impact frame)`);
  const { impact, ...dials } = L;
  if (impact !== undefined && !(Number.isInteger(impact) && impact >= 1 && impact <= 6)) throw new Error(`tempo: a look's impact is 1 to 6 frames of the inverted impact frame, not ${JSON.stringify(impact)}`);
  const G = Object.keys(dials).length ? readGrade(dials, 'tempo: a moment\'s look') : null;
  return { ...(G || {}), ...(impact !== undefined ? { impact } : {}) };
}

function readCam(c) {
  const C = typeof c === 'string' ? { frame: c } : c;
  if (!C || typeof C !== 'object' || Array.isArray(C)) throw new Error(`tempo: a moment's cam is a frame (${CAM_FRAMES.join(', ')}) or { frame, on?, side?, move?, lerp? }`);
  if (C.frame !== undefined && !CAM_FRAMES.includes(C.frame)) throw new Error(`tempo: a cam's frame is one of ${CAM_FRAMES.join(', ')}, not ${JSON.stringify(C.frame)}`);
  if (C.move !== undefined && !CAM_MOVES.includes(C.move)) throw new Error(`tempo: a cam's move is one of ${CAM_MOVES.join(', ')}, not ${JSON.stringify(C.move)}`);
  if (C.on !== undefined && !(Array.isArray(C.on) && C.on.length && C.on.every((x) => typeof x === 'string' && x))) throw new Error('tempo: a cam\'s on names whom it frames: \'a\' and \'b\' (the two the moment knows: the striker and the struck, the downer and the downed) or entity ids');
  if (C.side !== undefined && C.side !== 1 && C.side !== -1) throw new Error('tempo: a cam\'s side is 1 or -1');
  if (C.lerp !== undefined && !(typeof C.lerp === 'number' && C.lerp > 0 && C.lerp <= 60)) throw new Error('tempo: a cam\'s lerp is how fast it eases in, over 0 to 60');
  const out = {};
  for (const k of ['frame', 'on', 'side', 'move', 'lerp']) if (C[k] !== undefined) out[k] = Array.isArray(C[k]) ? C[k].slice() : C[k];
  return typeof c === 'string' ? c : out;
}

/**
 * A world's `tempo` read into the kernel's spec, or throws naming what it takes: a preset word, a list of words, or
 * `{ moments: [{ on, scale, hold, ramp?, cooldown?, cam?, look? }] }` (words and moments may mix in a list). Null for none.
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
    if (!it || typeof it !== 'object' || typeof it.on !== 'string' || !it.on.trim()) throw new Error(`tempo: a moment is { on, scale, hold, ramp?, cooldown?, cam? }, on one of ${TEMPO_SIGNALS.join(', ')} or a name fired from outside`);
    const m = { on: it.on.trim() };
    if (!(typeof it.scale === 'number' && it.scale >= 0 && it.scale <= 1)) throw new Error(`tempo: a moment's scale is the world's speed, 0 (held) to 1, not ${JSON.stringify(it.scale)}`);
    m.scale = it.scale;
    for (const k of ['hold', 'ramp', 'cooldown']) {
      if (it[k] === undefined) continue;
      if (!(typeof it[k] === 'number' && it[k] >= 0 && it[k] <= LIMITS[k])) throw new Error(`tempo: a moment's ${k} is 0 to ${LIMITS[k]} real seconds, not ${JSON.stringify(it[k])}`);
      m[k] = it[k];
    }
    if (m.hold === undefined) throw new Error('tempo: a moment says how long it holds (`hold`, real seconds)');
    if (it.cam !== undefined) m.cam = readCam(it.cam);
    if (it.look !== undefined) m.look = readLook(it.look);
    moments.push(m);
  }
  return moments.length ? { moments: moments.slice(0, 8) } : null;
}
