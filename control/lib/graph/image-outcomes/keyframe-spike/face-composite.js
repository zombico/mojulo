/**
 * Face keyframes as WHOLE meru-locked cels (face-subcels.plan.md, revised
 * 2026-07-12). We do NOT decal eyes onto a finished cel — that throws away the
 * primitive that locked Nera in the first place (the meru guide declares scale
 * + pose + placement; her identity reference locks the character). Instead each
 * expression state is a FULL cel render over that pose's guide, and this module
 * just SELECTS which full cel each output frame shows, on a seeded blink /
 * speech schedule. Base states (eyes-open, mouth-closed) are the cel itself.
 *
 * The zero-generation claim survives: re-blinking / re-timing re-selects over
 * the SAME rendered cels. Seeded dice only (mulberry32); no Date/random.
 */

import { resolveSubCelTracks, subCelStates } from '../pan-cel-spike/sub-cels.js';

/**
 * Build the schedule manifest. `blink`/`speech` are optional channels; omit one
 * to hold that feature on its base state. No rects — placement is the guide's
 * job, not ours. Channels are ordered eyes-first so a rare eyes+mouth overlap
 * frame prefers the blink variant (see resolveFaceFrames).
 */
export function buildFaceManifest({
  keys, fps = 12, onTwos = 2, cycles = 3,
  blink = { seed: 1, meanGapSec: 2.2 }, speech = null, flapsPerSec = 8,
}) {
  const subCels = [];
  if (blink) subCels.push({ id: 'eyes', vocab: 'blink', track: { kind: 'blink', ...blink } });
  if (speech && speech.spans && speech.spans.length) {
    subCels.push({ id: 'mouth', vocab: 'mouth', track: { kind: 'speech', spans: speech.spans, flapsPerSec } });
  }
  return { fps, onTwos, cycles, keys, subCels };
}

/** Total output frames = keys × onTwos × cycles. */
export function faceFrameCount(manifest) {
  return manifest.keys.length * manifest.onTwos * manifest.cycles;
}

/**
 * Resolve every output frame → { frame, key, keyIndex, states, celFile, combo }.
 * `celFile` is the full cel that frame shows, RELATIVE to keys/<key>/: the base
 * `cel.png`, or an expression variant `face/<vocab>-<state>.png`. Base states
 * emit no variant (the cel is the base). v1 drives the variant from the FIRST
 * active channel (eyes before mouth); a frame where both are non-base is marked
 * `combo` and still selects the eyes variant — combined-expression renders are
 * a documented follow-up, not v1.
 */
export function resolveFaceFrames(manifest) {
  const frameCount = faceFrameCount(manifest);
  const tracks = resolveSubCelTracks(manifest, frameCount);
  const base = Object.fromEntries(manifest.subCels.map((sc) => [sc.id, subCelStates(sc.vocab)[0]]));
  const frames = [];
  for (let f = 0; f < frameCount; f += 1) {
    const keyIndex = Math.floor(f / manifest.onTwos) % manifest.keys.length;
    const key = manifest.keys[keyIndex];
    const active = [];
    const states = {};
    for (const sc of manifest.subCels) {
      const state = tracks[sc.id][f];
      states[sc.id] = state;
      if (state !== base[sc.id]) active.push({ id: sc.id, vocab: sc.vocab, state });
    }
    const chosen = active[0] || null;
    frames.push({
      frame: f, key, keyIndex, states,
      celFile: chosen ? `face/${chosen.vocab}-${chosen.state}.png` : 'cel.png',
      variant: chosen ? `${chosen.vocab}-${chosen.state}.png` : null,
      combo: active.length > 1,
    });
  }
  return { frames, tracks };
}

/**
 * The expression variant cels to RENDER, per key (the non-base states of each
 * channel) — e.g. ['blink-half.png', 'blink-closed.png']. Each is a full cel of
 * that pose with the expression, meru-locked over the pose's guide.
 */
export function requiredVariants(manifest) {
  const out = new Set();
  for (const sc of manifest.subCels) {
    for (const state of subCelStates(sc.vocab).slice(1)) out.add(`${sc.vocab}-${state}.png`);
  }
  return [...out];
}
