/**
 * THE FRAME'S FIELD, HEARD — a frame level's audio (levels.js, the airspace frame branch): every frame on it heard by
 * its parts and every unit by its kind (sfx-shelf/frame-sounds.js), the recorded library's words first and the
 * synthesized where it is not installed; the objectives' stingers on the bus; the field's air (Mars's wind outside, a
 * works' furnaces under a roof); and the hangar's and the briefing's menus in the holo table's set. Played by the audio
 * channel's frame layer (scene/channels/frame-audio.js), checked by beats-world.js (`frame`).
 *
 *   frameAudio({ units?, indoor?, flavor? }) → the level's `audio`: { sfx: { cues, on, vary }, frame, wind? , ambience? }
 *     units    the unit kinds the level stands (OPERATION.units' keys); a kind the kit does not know is heard as a turret
 *     indoor   a works' field (assault-frame/field.js `indoor`): its furnaces held under it, no wind
 *     flavor   the game's own recordings (a card's `flavor`): its stingers and anything else it records, over the shelf's
 *
 * Every part's sounds are carried, not only the frame's stock build's: the hangar fits any part the save holds, and the
 * page reads the build off the frame (`e.frame.build`), so a refitted frame is heard as fitted. Pure but for the shelf's
 * read of the library's index: the same machine, the same audio.
 */
import { PARTS } from '../assault-frame/parts.js';
import { FRAME_WEIGHTS, FRAME_DRIVES, FRAME_ARMS, FRAME_UNITS, FRAME_COCKPIT, FRAME_WORLD, FRAME_UI, frameWeight, frameDrive, frameWord } from '../sfx-shelf/frame-sounds.js';
import { recordedUiSounds } from '../beats/ui-sounds.js';

// the objectives' bus events (game/objectives.js; MECHANIC_SFX's), the world's stingers they play
const ON = Object.freeze({ 'objective:begin': 'task', 'objective:done': 'done', 'objectives:done': 'won', 'objectives:failed': 'lost', dead: 'lost' });
// the field's air: Mars's thin wind (the channel's wind, by the camera's motion), a works' fire held low
export const FRAME_AIR = Object.freeze({ wind: Object.freeze({ level: -30, freq: 520, vary: true }), works: Object.freeze({ voice: 'fire-burning', level: 0.18 }) });

export function frameAudio({ units = [], indoor = false, flavor = null } = {}) {
  const cues = {}, opts = { style: 'realistic', flavor };
  // (a word list → a cue id of the level's, `fr:<word>`, its gestures once however many things play it)
  const cue = (words) => {
    const r = frameWord(words, opts);
    if (!r || !r.sound.gestures) return null;
    const id = `fr:${r.word}`;
    cues[id] ??= r.sound.gestures;
    return id;
  };
  const held = (words) => frameWord(words, opts)?.sound.sustain ?? null;
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, k === 'every' ? o.every : o[k] ? cue(o[k]) : null]).filter(([, v]) => v != null));
  const weights = Object.fromEntries(Object.entries(FRAME_WEIGHTS).map(([w, S]) => [w, pick(S, ['step', 'land'])]));
  const drives = Object.fromEntries(Object.entries(FRAME_DRIVES).map(([d, S]) => { const h = held(S.held); return [d, { ...pick(S, ['boost', 'quick']), ...(h ? { held: h } : {}) }]; }));
  const arms = Object.fromEntries(Object.entries(FRAME_ARMS).map(([k, S]) => [k, pick(S, ['shot', 'every', 'charge', 'charged', 'hit'])]));
  const kinds = [...new Set(units)].sort();
  const unitsOut = Object.fromEntries(kinds.map((k) => { const S = FRAME_UNITS[k] ?? FRAME_UNITS.turret, h = S.hum ? held(S.hum) : null; return [k, { ...pick(S, ['shot', 'every', 'missile', 'down']), ...(h ? { hum: h } : {}) }]; }));
  const cockpit = pick(FRAME_COCKPIT, Object.keys(FRAME_COCKPIT)), world = pick(FRAME_WORLD, ['struck', 'shield', 'shieldBreak', 'burst', 'blast', 'wreck']);
  const parts = {
    legs: Object.fromEntries(Object.entries(PARTS.legs).map(([id, L]) => [id, frameWeight(L)])),
    booster: Object.fromEntries(Object.entries(PARTS.booster).map(([id, B]) => [id, frameDrive(B)])),
  };
  // (the objectives' stingers, on the bus)
  const on = {};
  for (const [ev, k] of Object.entries(ON)) { const id = cue(FRAME_WORLD[k]); if (id) on[ev] = id; }
  // (the menus over the field: the holo table's set, its recordings where the library has them)
  const U = recordedUiSounds(FRAME_UI.set).cues, ui = {};
  for (const c of FRAME_UI.cues) if (U[c]) { cues[`ui:${c}`] = U[c]; ui[c] = `ui:${c}`; }
  const air = indoor ? held([FRAME_AIR.works.voice]) : null;
  return {
    sfx: { cues, on, vary: true },
    frame: { weights, drives, arms, units: unitsOut, cockpit, world, parts, ui },
    ...(indoor ? (air ? { ambience: { voice: air, level: FRAME_AIR.works.level } } : {}) : { wind: { ...FRAME_AIR.wind } }),
  };
}
