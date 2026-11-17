/**
 * brawl sfx — the run & gun's sounds, from the SFX shelf (sfx-shelf/resolve.js): each gun's shot and its landing (the
 * gun's own `sound` and `hit`, brawl-guns.js, so a gun passed into the range brings its voice), and the range's own: a
 * foe's round whizzing past, a gun run dry, a magazine seated, a round on a body, a round on cover (dirt, wood, stone: each
 * cover piece's own, brawl-things.js) and a body digging up out of the ground. The STREET's own, any brawl's, with
 * guns or without: a rider's mount crashing, a round or a blow on metal (a wreck). (Its engine and its tyres are held
 * voices on the shelf, not one-shots: not played yet.) Server side:
 * the page plays them by these ids (brawl-yard.client.js).
 *
 *   RANGE_SOUNDS                       the range's own sounds, by their shelf ids
 *   STREET_SOUNDS                      the street's own (the entrances' and the mounts'), by their shelf ids
 *   streetAudio({ style? })            → { sfx } the street's own voiced (a brawl without the range's)
 *   BRAWL_SOUNDS, brawlAudio({ style? }) the brawler's sound sheet: its blows thrown and landed and its bodies' voices,
 *                                        by shelf word (below)
 *   gunAudio(guns, { style? })         → { sfx: { cues, vary, mix } } (a world's audio, as versus-sfx.js fightAudio
 *                                        is): each sound the guns and the range need, voiced in `style` (realistic:
 *                                        layered); a sound the shelf has no voice for in it is left out (none plays)
 */
import { sfxSound } from '../sfx-shelf/resolve.js';
import { FIGHT_MIX } from '../versus/versus-sfx.js';

export const RANGE_SOUNDS = Object.freeze({ flyby: 'bullet-flyby', dry: 'dry-fire', reload: 'mag-in', body: 'flesh-impact', dirt: 'dirt-impact', wood: 'wood-impact', stone: 'stone-impact' });

export const STREET_SOUNDS = Object.freeze({ dirt: 'dirt-impact', wood: 'wood-impact', stone: 'stone-impact', metal: 'metal-impact', crash: 'car-crash' });

/**
 * THE BRAWLER'S SOUND SHEET: what a brawl's bodies sound like, each a row of the SFX shelf by its word, voiced in the
 * sheet's style (the newest voices first: `mouth`, which falls back to realistic where the mouth voices none, as a
 * game's sound sheet does, gameworld/sound-sheet.js). The fight's cue ids the page already plays for a blow (a fist by
 * its weight, a foot, a blade, a throw, a body landing) are voiced here by word, over the fight's own family cues; and
 * what the fight never sounded: a blow thrown (a fist's swing, a strong blow's whoosh, a blade's), a jump, and the
 * bodies' own voices (a thug's shout as it attacks, a grunt on a heavy blow, a cry as it goes down).
 */
export const BRAWL_SOUNDS = Object.freeze({
  // a blow thrown
  swing: 'swing', 'swing-heavy': 'whoosh', 'swing-blade': 'blade-swing', jump: 'jump',
  // a blow landed (the fight's cue ids: versus-sfx.js FIGHT_SFX, brawl-yard.client.js cueOf)
  'hit-light': 'punch', 'hit-medium': 'punch', 'hit-heavy': 'uppercut', 'kick-light': 'kick', 'kick-heavy': 'kick', 'blade-light': 'blade-hit', 'blade-heavy': 'blade-hit',
  grab: 'grab', throw: 'body-slam', land: 'down', ko: 'knockout-blow',
  // the bodies' voices
  shout: 'attack-shout', grunt: 'hurt-grunt', cry: 'hurt-heavy',
});
/** → { sfx } a brawl's sheet voiced: each cue id its shelf word's sound in `style` (one the shelf has no voice for is left to the fight's own). */
export function brawlAudio({ style = 'mouth' } = {}) {
  const cues = {};
  for (const [id, word] of Object.entries(BRAWL_SOUNDS)) {
    let v = null;
    try { v = sfxSound(word, { style }); } catch { v = null; }
    if (v && v.gestures) cues[id] = v.gestures;
  }
  return { sfx: { cues, vary: true, mix: { ...FIGHT_MIX, voices: 16 } } };
}

export function gunAudio(guns, { style = 'realistic' } = {}) {
  return voiced([...guns.flatMap((g) => [g.sound, g.hit]), ...Object.values(RANGE_SOUNDS), ...Object.values(STREET_SOUNDS)], style);
}
export function streetAudio({ style = 'realistic' } = {}) { return voiced(Object.values(STREET_SOUNDS), style); }
function voiced(list, style) {
  const ids = [...new Set(list.filter(Boolean))];
  const cues = {};
  for (const id of ids) {
    let v = null;
    try { v = sfxSound(id, { style }); } catch { v = null; }
    if (v && v.gestures) cues[id] = v.gestures;
  }
  // (the fight's bus, more voices at once: a stream's rounds on top of one another)
  return { sfx: { cues, vary: true, mix: { ...FIGHT_MIX, voices: 16 } } };
}
