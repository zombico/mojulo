/**
 * engine-audio — the music beds the engine packs (Godot, Unity, Unreal) render. A bed is a stored beats row named by
 * its ref, or a level's own soundtrack ('field:<mood>', { score }, an inline recipe, a kind's period music), which
 * world-scene has already resolved onto the payload and which ships under the level's name. Beds loop in the engine,
 * so each renders as one seamless pass to the bar line with a smpl loop chunk; an sfx stays a one-shot. Which bed a
 * level carries is engine-score.js levelSoundtrack (pure).
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';

let beatsRender = null;
/** WAV bytes for a bed: `recipe` when given, else the stored beats row `id`. `loop: false` renders one pass with its
 * tail (a stinger, played once). */
export async function renderBed(id, { recipe = null, loop = true, log = () => {} } = {}) {
  let manifest = recipe;
  if (!manifest) {
    const beats = SketchRepository.getByRef(id);
    if (!beats) throw new Error(`beats ref '${id}' not found`);
    manifest = beats.manifest;
  }
  if (!beatsRender) ({ renderBeatsOffline: beatsRender } = await import('@/lib/graph/beats/beats-render'));
  const rendered = await beatsRender(manifest, manifest.kind === 'beats-sfx' || !loop ? {} : { loop: true });
  log(`beats '${id}' rendered — ${rendered.wav.length} bytes`);
  return rendered.wav;
}

/** WAV bytes for every take of a one-shot sound (engine-sound.js levelSound): take 0 plain, the rest the kernel's seeded
 * variations (the page's `vary`). */
export async function renderSound({ id, gestures }, variants = 1) {
  if (!beatsRender) ({ renderBeatsOffline: beatsRender } = await import('@/lib/graph/beats/beats-render'));
  const takes = [];
  for (let n = 0; n < variants; n++) {
    const r = await beatsRender({ kind: 'beats-sfx', title: id, cues: { [id]: gestures } }, { cue: id, tail: 0.5, ...(n ? { variant: n } : {}) });
    takes.push(r.wav);
  }
  return takes;
}
