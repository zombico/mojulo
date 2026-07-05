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
 *   }
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

// chiptune foley defaults for the gait bindings — overridable per world.
const DEFAULT_FOOTSTEPS = {
  step: [{ type: 'burst', decay: 0.06, vol: 0.22, highpass: 1800 }],
  jump: [{ type: 'sweep', wave: 'square', from: 'A4', to: 'E5', dur: 0.12, vol: 0.3 }],
  land: [{ type: 'thump', from: 'A2', to: 'G1', decay: 0.18, vol: 0.5 }],
};

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

  return Object.keys(out).length ? out : null;
}
