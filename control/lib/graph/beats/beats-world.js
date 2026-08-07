/**
 * beats-world — resolve a world manifest's opt-in `audio` channel into the
 * emit-ready payload (beats.plan.md → "Wiring to worlds"). The audio sibling of
 * composeVolumeFog: called from resolveWorldScene, additive, absent ⇒ untouched.
 *
 *   manifest.audio = {
 *     soundtrack?: <inline beats-ambient|beats-composition recipe> | { beatsRef },
 *     sfx?:        { cues?: {...} | undefined, beatsRef?, on?: { '<event type glob>': '<cueId>' } },
 *     footsteps?:  true | { step?, jump?, land? (gesture lists) },
 *     wind?:       true | { level (dB), freq (Hz) },
 *     bindings?:   [{ source, entity?|point?, range: [from,to],
 *                     target: { channel, macro: tone|level|transpose, range: [a,b] } }]
 *   }
 *
 * `bindings` (B5.3) is the world-modulation seam: sim-state selectors → the
 * soundtrack's B5.2 channel macros, evaluated per frame in the audio channel,
 * read-only, one direction — depth rolls the pads' tone down, sprint raises
 * the hats' level, proximity opens the stab's filter. Sources:
 *   height    — subject's vertical position (z; subject = `entity` id, else camera)
 *   depth     — negative height (deeper = larger)
 *   speed     — the player/camera's smoothed travel speed (units/s)
 *   proximity — distance from the camera to `point: [x,y,z]` or to entity `entity`
 * The value maps through `range: [from, to]` → 0..1 (from > to inverts), then
 * onto `target.range`. Beats joins the world's atmosphere model the way the
 * lighting layer did — and stays inside "audio is presentation, not
 * simulation" because the flow never reverses.
 *
 * `beatsRef` follows the workbench wrap-texture `sketchRef` precedent: the
 * referenced beats artifact's recipe is INLINED into the payload here, so the
 * emitted page stays self-contained — the ref is authoring-time indirection
 * only. Audio is presentation, not simulation: the resolved payload is read by
 * the audio channel in emitThreeWorld and never feeds back into world state,
 * and the channel is not emitted at all on capture runs (muted bakes stay
 * byte-identical).
 */

import { SketchRepository } from '../../db/repositories/sketches.js';
import { validateBeatsManifest, normalizeBeatsManifest, isBeatsKind } from './beats-manifest.js';
import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES } from './audio-patches.js';
import { safeJson } from '../scene/emit-util.js';

// chiptune foley defaults for the gait bindings — overridable per world.
const DEFAULT_FOOTSTEPS = {
  step: [{ type: 'burst', decay: 0.06, vol: 0.22, highpass: 1800 }],
  jump: [{ type: 'sweep', wave: 'square', from: 'A4', to: 'E5', dur: 0.12, vol: 0.3 }],
  land: [{ type: 'thump', from: 'A2', to: 'G1', decay: 0.18, vol: 0.5 }],
};

const BINDING_SOURCES = new Set(['depth', 'height', 'speed', 'proximity']);
const BINDING_MACROS = new Set(['tone', 'level', 'transpose']);

// B5.3: validate + normalize audio.bindings against the resolved soundtrack —
// a binding targeting a channel that doesn't exist is a manifest error, caught
// at resolve time (authoring), never at play time.
function resolveBindings(bindings, soundtrack) {
  if (!Array.isArray(bindings) || !bindings.length) {
    throw new Error('audio.bindings must be a non-empty array of { source, range, target } bindings');
  }
  const rows = soundtrack.channels || soundtrack.parts || soundtrack.tracks || [];
  const names = new Set(rows.map((r) => r.name));
  const pair = (v, where) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite)) {
      throw new Error(`${where} must be [from, to] (two numbers; from > to inverts the mapping)`);
    }
  };
  return bindings.map((b, i) => {
    const where = `audio.bindings[${i}]`;
    if (!b || typeof b !== 'object' || !BINDING_SOURCES.has(b.source)) {
      throw new Error(`${where}.source must be one of: ${[...BINDING_SOURCES].join(', ')}`);
    }
    pair(b.range, `${where}.range`);
    const t = b.target;
    if (!t || typeof t !== 'object') throw new Error(`${where}.target is required: { channel, macro, range }`);
    if (!names.has(t.channel)) {
      throw new Error(`${where}.target.channel '${t.channel}' is not a soundtrack channel (${[...names].join(', ')})`);
    }
    if (!BINDING_MACROS.has(t.macro)) throw new Error(`${where}.target.macro must be one of: ${[...BINDING_MACROS].join(', ')}`);
    pair(t.range, `${where}.target.range`);
    if (b.point !== undefined && (!Array.isArray(b.point) || b.point.length !== 3 || !b.point.every(Number.isFinite))) {
      throw new Error(`${where}.point must be [x, y, z]`);
    }
    if (b.entity !== undefined && (typeof b.entity !== 'string' || !b.entity)) {
      throw new Error(`${where}.entity must be a controllable entity id (string)`);
    }
    if (b.source === 'proximity' && b.point === undefined && b.entity === undefined) {
      throw new Error(`${where} (proximity) needs a reference: point: [x,y,z] or entity: '<id>'`);
    }
    const out = { source: b.source, range: b.range.slice(), target: { channel: t.channel, macro: t.macro, range: t.range.slice() } };
    if (b.entity !== undefined) out.entity = b.entity;
    if (b.point !== undefined) out.point = b.point.slice();
    return out;
  });
}

function resolveBeatsRef(beatsRef, expectKinds) {
  const sketch = SketchRepository.getByRef(beatsRef);
  if (!sketch || !sketch.manifest) {
    throw new Error(`audio: beats artifact '${beatsRef}' not found`);
  }
  const kind = sketch.manifest.kind;
  if (!isBeatsKind(kind) || (expectKinds && !expectKinds.includes(kind))) {
    throw new Error(`audio: '${beatsRef}' is kind '${kind}', expected ${(expectKinds || []).join(' | ')}`);
  }
  return sketch.manifest;
}

/**
 * resolveWorldAudio(audioSpec, ctx) → payload.audio | null
 * ctx carries the manifest's declarative lighting mood ({ time }) so wind
 * defaults follow the scene (night reads quieter and darker).
 */
export function resolveWorldAudio(audioSpec, ctx = {}) {
  if (!audioSpec || typeof audioSpec !== 'object') return null;
  const out = {};

  if (audioSpec.soundtrack) {
    let recipe = audioSpec.soundtrack;
    if (recipe.beatsRef) {
      recipe = resolveBeatsRef(recipe.beatsRef, ['beats-ambient', 'beats-composition', 'beats-pattern']);
    } else {
      const { ok, errors } = validateBeatsManifest(recipe);
      if (!ok) throw new Error(`audio.soundtrack: invalid recipe:\n - ${errors.join('\n - ')}`);
      recipe = normalizeBeatsManifest(recipe);
    }
    // a world soundtrack should loop even when authored as a one-shot score
    // (ambient and pattern kinds loop by construction).
    if (recipe.kind === 'beats-composition') recipe = { ...recipe, loop: true };
    out.soundtrack = recipe;
  }

  if (audioSpec.bindings) {
    if (!out.soundtrack) {
      throw new Error('audio.bindings drive soundtrack channel macros — add audio.soundtrack first');
    }
    out.bindings = resolveBindings(audioSpec.bindings, out.soundtrack);
  }

  if (audioSpec.sfx) {
    const sfx = audioSpec.sfx;
    let cues = sfx.cues && typeof sfx.cues === 'object' ? sfx.cues : {};
    if (sfx.beatsRef) {
      cues = { ...resolveBeatsRef(sfx.beatsRef, ['beats-sfx']).cues, ...cues };
    }
    if (Object.keys(cues).length) {
      const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'world sfx', cues });
      if (!check.ok) throw new Error(`audio.sfx: invalid cues:\n - ${check.errors.join('\n - ')}`);
      out.cues = cues;
    }
    if (sfx.on && typeof sfx.on === 'object') {
      for (const [pat, cueId] of Object.entries(sfx.on)) {
        if (!out.cues || !out.cues[cueId]) {
          throw new Error(`audio.sfx.on['${pat}'] points at unknown cue '${cueId}'`);
        }
      }
      out.on = sfx.on;
    }
  }

  if (audioSpec.footsteps) {
    const f = audioSpec.footsteps === true ? {} : audioSpec.footsteps;
    out.footsteps = {
      step: f.step || DEFAULT_FOOTSTEPS.step,
      jump: f.jump || DEFAULT_FOOTSTEPS.jump,
      land: f.land || DEFAULT_FOOTSTEPS.land,
    };
  }

  if (audioSpec.wind) {
    const night = ctx.time === 'night';
    const w = audioSpec.wind === true ? {} : audioSpec.wind;
    out.wind = {
      level: w.level == null ? (night ? -34 : -30) : w.level,
      freq: w.freq == null ? (night ? 260 : 320) : w.freq,
    };
  }

  // thruster ROAR: a sustained rocket-engine voice the audio channel swells with a controllable
  // entity's e.thrust (boost). Continuous like wind, but gain-modulated by sim state instead of an
  // LFO. `level` (0..1) is the overall loudness; `true` takes the default.
  if (audioSpec.thruster) {
    const th = audioSpec.thruster === true ? {} : audioSpec.thruster;
    out.thruster = { level: Number.isFinite(th.level) ? th.level : 0.5 };
  }

  // JUMP audio: the stop-and-charge GATHER whine (sustained synth) + a RELEASE transient scaled by
  // hold-time + a metal-clang LAND cue scaled by fall speed. `charge`/`release` take `{ level }` (or
  // `true`); `land` is a beats gesture list (validated); `landRef` (world units/sec) is the fall
  // speed that maxes the clang. All read-only sim-state → SFX, absent on captures (byte-identical).
  if (audioSpec.jump) {
    const jp = audioSpec.jump, jOut = {};
    if (jp.charge) jOut.charge = { level: Number.isFinite((jp.charge || {}).level) ? jp.charge.level : 0.26 };
    if (jp.release) jOut.release = { level: Number.isFinite((jp.release || {}).level) ? jp.release.level : 0.5 };
    if (Array.isArray(jp.land) && jp.land.length) {
      const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'jump land', cues: { land: jp.land } });
      if (!check.ok) throw new Error(`audio.jump.land: invalid cue:\n - ${check.errors.join('\n - ')}`);
      jOut.land = jp.land;
      if (Number.isFinite(jp.landRef) && jp.landRef > 0) jOut.landRef = jp.landRef;
    }
    if (Object.keys(jOut).length) out.jump = jOut;
  }

  // DODGE (acrobatic roll) SFX: one beats gesture list whose `at` offsets lay out the three roll
  // beats (land / roll / stand) across the tumble. Fired once per roll on the dodgeCount edge.
  if (Array.isArray(audioSpec.dodge) && audioSpec.dodge.length) {
    const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'dodge roll', cues: { dodge: audioSpec.dodge } });
    if (!check.ok) throw new Error(`audio.dodge: invalid cue:\n - ${check.errors.join('\n - ')}`);
    out.dodge = audioSpec.dodge;
  }

  // weapon SFX (mobile-suit R6-C): a controllable entity's `weapon` firing drives cues, the same
  // read-only sim-state → SFX pattern as footsteps. `shot` plays on each round; optional `hit`
  // (a landed shot) and `reload` (magazine empties). Each is a beats gesture list, passed to playCue.
  if (audioSpec.weapon) {
    const wp = audioSpec.weapon;
    const wOut = {};
    for (const k of ['shot', 'hit', 'reload']) if (Array.isArray(wp[k]) && wp[k].length) wOut[k] = wp[k];
    if (Object.keys(wOut).length) out.weapon = wOut;
  }

  // strike (melee) SFX: the beam saber's swing + connect — the same read-only sim-state → SFX
  // pattern as weapon. `swing` plays on each swing START (the crackling-ozone whoosh); `hit`
  // plays whenever the blade CONNECTS with a target. Each is a beats gesture list for playCue.
  if (audioSpec.strike) {
    const st = audioSpec.strike;
    const sOut = {};
    for (const k of ['swing', 'hit']) if (Array.isArray(st[k]) && st[k].length) sOut[k] = st[k];
    if (Object.keys(sOut).length) out.strike = sOut;
  }

  return Object.keys(out).length ? out : null;
}

/**
 * emitSceneSoundtrackScript(resolvedAudio) → '<script>…</script>' | '' (B4).
 *
 * The CSS3D `/scene` path's soundtrack: the dependency-free preserve-3d pages
 * have no bus, no gait, and no sim loop, so only the presence layers ride —
 * soundtrack + wind. Injected by renderSceneHtml before </body> on live views
 * only (the PNG rasterizer passes capture:true and gets byte-identical HTML to
 * a soundtrack-less page). Same posture as the three.js audio channel: the
 * kernel is emitted via .toString(), the first pointer gesture unlocks the
 * AudioContext, and a HUD speaker toggles mute.
 */
export function emitSceneSoundtrackScript(resolvedAudio) {
  if (!resolvedAudio || (!resolvedAudio.soundtrack && !resolvedAudio.wind)) return '';
  const audio = {};
  if (resolvedAudio.soundtrack) audio.soundtrack = resolvedAudio.soundtrack;
  if (resolvedAudio.wind) audio.wind = resolvedAudio.wind;
  return `<script>
// ---- beats soundtrack channel (CSS3D scene, presentation-only) ----
const __AUDIO = ${safeJson(audio)};
const __BEATS_PATCHES = ${safeJson(PATCHES)};
const __BEATS = (${buildBeatsKernel.toString()})();
let __beatsCtx = null, __beatsEng = null, __beatsMuted = false;
function __beatsUnlock() {
  if (__beatsCtx) { if (__beatsCtx.state === 'suspended' && !__beatsMuted) __beatsCtx.resume(); return; }
  __beatsCtx = new (window.AudioContext || window.webkitAudioContext)();
  __beatsEng = __BEATS.createEngine(__beatsCtx);
  if (__AUDIO.soundtrack) {
    if (__AUDIO.soundtrack.kind === 'beats-composition') __beatsEng.startComposition(__AUDIO.soundtrack, __BEATS_PATCHES);
    else if (__AUDIO.soundtrack.kind === 'beats-pattern') __beatsEng.startPattern(__AUDIO.soundtrack, __BEATS_PATCHES);
    else __beatsEng.startAmbient(__AUDIO.soundtrack, __BEATS_PATCHES);
  }
  if (__AUDIO.wind) __beatsEng.wind(__AUDIO.wind);
  __beatsBtn.textContent = '\\u{1F50A}';
}
document.addEventListener('pointerdown', __beatsUnlock);
const __beatsBtn = document.createElement('button');
__beatsBtn.textContent = '\\u{1F507}';
__beatsBtn.title = 'sound (click scene to start)';
__beatsBtn.setAttribute('aria-label', 'toggle sound');
__beatsBtn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:40;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(10,12,18,.55);color:#dfe6f2;font-size:15px;cursor:pointer';
__beatsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
__beatsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!__beatsCtx) { __beatsUnlock(); return; }
  __beatsMuted = !__beatsMuted;
  __beatsEng.setMuted(__beatsMuted);
  if (__beatsMuted) __beatsCtx.suspend(); else __beatsCtx.resume();
  __beatsBtn.textContent = __beatsMuted ? '\\u{1F507}' : '\\u{1F50A}';
});
document.body.appendChild(__beatsBtn);
</script>`;
}
