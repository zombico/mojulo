/**
 * engine-audio — the music beds the engine packs (Godot, Unity, Unreal) render. A bed is a stored beats row named by
 * its ref, or a level's own soundtrack ('field:<mood>', { score }, an inline recipe, a kind's period music), which
 * world-scene has already resolved onto the payload and which ships under the level's name. Beds loop in the engine,
 * so each renders as one seamless pass to the bar line with a smpl loop chunk; an sfx stays a one-shot. Which bed a
 * level carries is engine-score.js levelSoundtrack (pure).
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';

let beatsRender = null;
/** WAV bytes for a bed: `recipe` when given, else the stored beats row `id`. */
export async function renderBed(id, { recipe = null, log = () => {} } = {}) {
  let manifest = recipe;
  if (!manifest) {
    const beats = SketchRepository.getByRef(id);
    if (!beats) throw new Error(`beats ref '${id}' not found`);
    manifest = beats.manifest;
  }
  if (!beatsRender) ({ renderBeatsOffline: beatsRender } = await import('@/lib/graph/beats/beats-render'));
  const rendered = await beatsRender(manifest, manifest.kind === 'beats-sfx' ? {} : { loop: true });
  log(`beats '${id}' rendered — ${rendered.wav.length} bytes`);
  return rendered.wav;
}
