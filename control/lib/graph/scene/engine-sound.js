/**
 * engine-sound — a level's sound for the engine packs, from the world audio channel world-scene resolved onto the
 * payload (beats-world.js resolveWorldAudio). Pure. Every one-shot (a bus cue, a footstep, a shot, a swing) becomes a
 * sound id named for what it is and what it plays (`<name>-<hash>`: two levels with the same cue share one file, two
 * keys of one game never collide); the pack renders each to `audio/sfx/<id>_<n>.wav`, n under `variants` (n = 0 is
 * the plain cue, the others the kernel's seeded variations, the web page's `vary`). A fight score (`audio.combat`)
 * ships as `<level ref>-combat` beside the soundtrack bed, with both pieces' bar lengths and the tension that brings it
 * in (adaptive-music.js), so an engine changes on the same bar lines the page does.
 *
 *   score.audio: { sounds?, variants?, on?, footsteps?, weapon?, strike?, dodge?, combat?, bar?, tension? }
 *
 * Absent a channel (or one with none of these) ⇒ null: no key in score.json, byte-identical.
 */
import { buildAdaptive } from '../beats/adaptive-music.js';

/** How many takes of each sound a pack renders when the level's sounds vary (the engine picks among them, no repeats). */
export const SFX_VARIANTS = 3;
/** The hero's own moves that sound, by the world audio key that holds them (the page reads the same sim edges). */
export const MOVE_SOUNDS = { footsteps: ['step', 'jump', 'land'], weapon: ['shot', 'hit', 'reload'], strike: ['swing', 'hit'] };

const A = buildAdaptive();
// FNV-1a 32 over the cue's JSON: a stable short name for what a sound plays
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * levelSound(resolvedAudio, ref) → { score, sounds: [{ id, gestures }], combat: { id, recipe } | null } | null.
 * `score` is what score.json carries as `audio`; `sounds` and `combat` are what the pack renders.
 */
export function levelSound(audio, ref) {
  if (!audio || typeof audio !== 'object') return null;
  const sounds = new Map();
  const name = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cue';
  const id = (n, gestures) => {
    const k = `${name(n)}-${fnv(JSON.stringify(gestures))}`;
    sounds.set(k, gestures);
    return k;
  };
  const out = {};
  if (audio.on && audio.cues) {
    const on = {};
    for (const [g, cue] of Object.entries(audio.on)) if (Array.isArray(audio.cues[cue]) && audio.cues[cue].length) on[g] = id(cue, audio.cues[cue]);
    if (Object.keys(on).length) out.on = on;
  }
  for (const [key, moves] of Object.entries(MOVE_SOUNDS)) {
    if (!audio[key]) continue;
    const m = {};
    for (const mv of moves) if (Array.isArray(audio[key][mv]) && audio[key][mv].length) m[mv] = id(`${key === 'footsteps' ? '' : `${key}-`}${mv}`, audio[key][mv]);
    if (Object.keys(m).length) out[key] = m;
  }
  if (Array.isArray(audio.dodge) && audio.dodge.length) out.dodge = id('dodge', audio.dodge);
  let combat = null;
  if (audio.combat && audio.soundtrack && ref) {
    combat = { id: `${ref}-combat`, recipe: audio.combat };
    out.combat = combat.id;
    out.bar = { explore: A.barSeconds(audio.soundtrack), combat: A.barSeconds(audio.combat) };
    if (audio.tension) out.tension = audio.tension;
  }
  if (sounds.size) {
    out.sounds = [...sounds.keys()].sort();
    out.variants = audio.vary ? SFX_VARIANTS : 1;
  }
  if (!Object.keys(out).length) return null;
  return { score: out, sounds: [...sounds].map(([k, gestures]) => ({ id: k, gestures })), combat };
}

/** The files a level's sound ships (beside its soundtrack bed): every take of every sound, and the fight score. */
export function soundFiles(score) {
  const a = score?.audio;
  if (!a) return [];
  const files = [];
  for (const s of a.sounds || []) for (let n = 0; n < (a.variants || 1); n++) files.push(`audio/sfx/${s}_${n}.wav`);
  if (a.combat) files.push(`audio/${a.combat}.wav`);
  return files;
}
