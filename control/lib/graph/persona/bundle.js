/**
 * bundle — what a persona's export carries beside its model: per read, its captions (`captions/<id>.srt`, `.vtt`) and
 * its cue sheet (`cues/<id>.json`, cues.js), on the clock of the model's `face:<id>` clip where the face is drawn
 * (fidelity.js), else on the read's own clock for its audio and the body's gestures.
 *
 *   personaHero(persona, heroManifest) → the hero's stored manifest with the persona's reads as its `perform` takes
 *     (a read of the same name as one of the hero's own takes is the persona's); the hero as it is where it has no face
 *   personaFiles(persona, heroManifest) → [{ name, text }]
 *
 * Pure and deterministic.
 */
import { personaReads, personaTakes } from './persona.js';
import { captionCues, srt, vtt } from './captions.js';
import { cueSheet } from './cues.js';
import { speakerFidelity, FACE_ERA } from './fidelity.js';

/** does the hero carry a face its reads can move (the realistic head, in a game that draws it) */
export const personaHasFace = (heroManifest) => speakerFidelity({ era: FACE_ERA }, heroManifest?.hero) === 'face';

export function personaHero(persona, heroManifest, reads = personaReads(persona)) {
  if (!heroManifest?.hero) throw new Error("persona: its hero is a hero's record");
  if (!personaHasFace(heroManifest) || !Object.keys(reads).length) return heroManifest;
  return { ...heroManifest, hero: { ...heroManifest.hero, perform: { ...(heroManifest.hero.perform ?? {}), ...personaTakes(persona, reads) } } };
}

export function personaFiles(persona, heroManifest, reads = personaReads(persona)) {
  const face = personaHasFace(heroManifest), out = [];
  for (const [id, R] of Object.entries(reads)) {
    const cues = captionCues(R);
    out.push({ name: `captions/${id}.srt`, text: srt(cues) }, { name: `captions/${id}.vtt`, text: vtt(cues) }, { name: `cues/${id}.json`, text: `${JSON.stringify(cueSheet(id, R, { face }), null, 1)}\n` });
  }
  return out;
}
