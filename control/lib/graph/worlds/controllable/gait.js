/**
 * gait.js — figure delivery math (controllable-split.plan.md, S1). The gait rules WRITE
 * gaitPhase/locomotion/moving; these two pure helpers are how a figure-frames body READS them
 * smoothly (frame-pair lerp within a clip + crossfade between locomotion modes). Pure math, no
 * engine state — the renderer calls them off the composed namespace (__CW.gaitFramePair).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildGait(E) {
  // ── figure delivery math (renderer-ladder.plan.md, Phase 2 rung 1) ────────────────────────────
  // The gait rules above WRITE gaitPhase/locomotion/moving; these two pure helpers are how a
  // figure-frames body READS them smoothly. Baked figure clips have fixed topology (same corner
  // list every frame — the invariant packFigureFrames relies on), so the renderer can lerp corner
  // positions between a frame PAIR instead of snapping to floor(phase·N), and crossfade between
  // locomotion modes (forward↔strafe↔idle) instead of hard-switching geometry.

  // gaitFramePair(N, phase) → { i0, i1, t }: the two frames bracketing a continuous, wrapping
  // phase (negative phases wrap too — strafe left runs the same clip backwards) and the lerp
  // weight between them. N=1 degenerates to a static frame.
  function gaitFramePair(N, phase) {
    if (!(N > 1)) return { i0: 0, i1: 0, t: 0 };
    const ph = ((phase % 1) + 1) % 1;
    const x = ph * N;
    const i0 = Math.min(N - 1, Math.floor(x));
    return { i0, i1: (i0 + 1) % N, t: x - i0 };
  }

  // advanceGaitMix(mix, mode, phase, dt, blendTime) — crossfade bookkeeping between locomotion
  // modes. `mix` is per-body state the renderer owns ({} initially): { mode, phase, prevMode,
  // prevPhase, w }. On a mode switch the OUTGOING pose is frozen at its last phase and faded out
  // over `blendTime` seconds (default 0.18). w ∈ [0,1] is the incoming mode's weight; prevMode is
  // null once the fade completes. dt-driven, so fixed-step replay reproduces it exactly.
  function advanceGaitMix(mix, mode, phase, dt, blendTime) {
    const bt = blendTime > 0 ? blendTime : 0.18;
    if (!mix.mode) { mix.mode = mode; mix.phase = phase; mix.w = 1; mix.prevMode = null; return mix; }
    if (mode !== mix.mode) {
      mix.prevMode = mix.mode;
      mix.prevPhase = mix.phase;
      mix.mode = mode;
      mix.w = 0;
    }
    mix.phase = phase;
    if (mix.w < 1) {
      mix.w = Math.min(1, mix.w + (dt || 0) / bt);
      if (mix.w >= 1) mix.prevMode = null;
    }
    return mix;
  }

  Object.assign(E, { gaitFramePair, advanceGaitMix });
}
