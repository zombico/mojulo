/**
 * THE FIRING RANGE, HEARD — the range's weapons voiced from the SFX shelf (sfx-shelf/, its realistic style): what each
 * weapon sounds like is a shelf word, chosen by what it is unless the game names its own. Pure.
 *
 *   rangeAudio({ slots, knife, sounds, vary? })  → { audio, sfx: { <slot name>: { shot, reload, hit, draw } } } (`vary`:
 *                                         every hit a seeded variant)
 *
 *   a gun's shot      its cartridge's (the kit's archetype, or a hitscan's rate and pellets): a pistol, a submachine gun, a
 *                     magnum, a rifle, a shotgun, a sniper rifle, suppressed when it says so; a projectile's launch
 *   its reload        one cue over the gun's own reload time: the magazine out, a fresh one in, the action racked
 *   its hit           a round landing on a body; a burst (a rocket's) sounds where it went off, by its size
 *   its draw          the switch to it: the weapon drawn
 *   the blade         its swing and its connect (the quick knife: the melee strike's slots)
 *   the feet          a person on the range's concrete
 * `sounds` ({ <weapon name>: { shot?, reload?, hit?, draw? } }, each a shelf word) is the game's own choice over these.
 * The page plays them on a mix in the open (the shelf's mixer): ducks, a voice cap, a cue placed by its distance.
 */
import { sfxSound } from '../../sfx-shelf/resolve.js';
import { resolveSoundId } from '../../sfx-shelf/roster.js';
import { ROUNDS } from '../rounds.js';

// the rounds' words (gameworld/rounds.js) onto the shelf's shots
const ROUND_SHOT = Object.freeze({ pistol: 'pistol shot', smg: 'smg shot', magnum: 'magnum shot', rifle: 'rifle shot', marksman: 'rifle shot', sniper: 'sniper shot', shotgun: 'shotgun shot' });

const cue = (word, style) => {
  const s = style ? sfxSound(word, { style }) : sfxSound(word);
  if (!s || !s.gestures) throw new Error(`firing range: '${word}' is not a one-shot on the SFX shelf`);
  return s.gestures;
};
// a cue moved later by `t` seconds (each gesture keeps its own place within it)
const later = (g, t) => g.map((x) => ({ ...x, at: Math.round(((x.at ?? 0) + t) * 1000) / 1000 }));

/** a gun's shot word: its round's class (a kit gun's round is one of rounds.js's), else by its numbers (pellets a
 * shotgun, a fast automatic a submachine gun, anything else a rifle); a launcher's round a missile away */
export function shotWordOf(slot) {
  const w = slot.weapon;
  if (w.fireClass === 'lob') return 'missile launch';
  // (a kit gun, an arm in its hands, by its round; a weapon of the game's own by its numbers)
  const cls = slot.gunplay?.arm && w.round ? Object.keys(ROUNDS).find((k) => ROUNDS[k].speed === w.round.speed && ROUNDS[k].flash === w.round.flash) : null;
  if (cls && ROUND_SHOT[cls]) return ROUND_SHOT[cls];
  if (w.pellets > 1) return 'shotgun shot';
  return w.auto && (w.rof ?? 0) >= 11 ? 'smg shot' : 'rifle shot';
}

/** the reload as one cue over the gun's reload time: out, in, racked (a launcher's: the round seated) */
export function reloadCue(slot, style) {
  const r = slot.weapon.reload ?? 2;
  if (slot.weapon.fireClass === 'lob') return later(cue('mag in', style), r * 0.6);
  return [...cue('mag out', style), ...later(cue('mag in', style), r * 0.55), ...later(cue('rack', style), r * 0.8)];
}

/**
 * Each gun's own sounds, by what it is or the game's word: { sfx: { <slot name>: { shot, reload, hit, draw } }, cues }
 * (`cues`: the same gestures by `<name>:<sound>`, for the page's book of cues). `style`: a shelf style (the shelf's
 * own, realistic, when absent). The range's and a sheet game's levels' (gameworld/sound-sheet.js gunSounds).
 */
export function gunCues({ slots = [], sounds = {}, style } = {}) {
  const sfx = {}, cues = {};
  for (const s of slots) {
    const own = sounds?.[s.name] ?? {};
    for (const [k, w] of Object.entries(own)) if (w != null && !resolveSoundId(w)) throw new Error(`sounds.${s.name}.${k}: '${w}' is not a sound on the SFX shelf`);
    const S = {
      shot: cue(own.shot ?? shotWordOf(s), style),
      reload: own.reload ? cue(own.reload, style) : reloadCue(s, style),
      hit: cue(own.hit ?? 'flesh impact', style),
      draw: cue(own.draw ?? 'weapon switch', style),
    };
    sfx[s.name] = S;
    for (const [k, g] of Object.entries(S)) cues[`${s.name}:${k}`] = g;
  }
  return { sfx, cues };
}

export function rangeAudio({ slots = [], knife = null, sounds = {}, vary = false } = {}) {
  const sfx = {}, cues = {};
  const word = (name, k, fallback) => {
    const w = sounds?.[name]?.[k];
    if (w != null && !resolveSoundId(w)) throw new Error(`firing range: sounds.${name}.${k}: '${w}' is not a sound on the SFX shelf`);
    return w ?? fallback;
  };
  for (const s of slots) {
    const own = sounds?.[s.name] ?? {};
    const S = {
      shot: cue(word(s.name, 'shot', shotWordOf(s))),
      reload: own.reload ? cue(own.reload) : reloadCue(s),
      hit: cue(word(s.name, 'hit', 'flesh impact')),
      draw: cue(word(s.name, 'draw', 'weapon switch')),
    };
    sfx[s.name] = S;
    for (const [k, g] of Object.entries(S)) cues[`${s.name}:${k}`] = g;
  }
  const blast = slots.some((s) => s.weapon.fireClass === 'lob') ? cue('explosion') : null;
  const audio = {
    mix: { space: 'open', voices: 16, distance: true },
    // (each weapon's own cues in the book of cues too, so the page's kernel carries every gesture they use)
    cues,
    weapon: { hit: cue('flesh impact'), switch: cue('weapon switch') },
    footsteps: { step: cue('step concrete'), land: cue('step concrete') },
    ...(knife ? { strike: { swing: cue(word(knife.name ?? 'knife', 'swing', 'blade swing')), hit: cue(word(knife.name ?? 'knife', 'hit', 'blade hit')) } } : {}),
    ...(blast ? { burst: blast } : {}),
    ...(vary ? { vary: true } : {}),
  };
  return { audio, sfx };
}
