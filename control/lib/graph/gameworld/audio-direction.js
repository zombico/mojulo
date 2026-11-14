/**
 * THE AUDIO DIRECTION — the game's taste in sound, the music department's first page (chapters.js `audio-direction`):
 * what the art direction is to the picture. One short page every audio page reads: the score's style and who plays
 * it, the identity every cue shares, the SFX style that sits with it, the space a level's sounds are heard in, the
 * interface's sound set. The music department owns the soundtrack; play owns the SFX (sound-sheet.js) and reads this,
 * as the interface reads the art direction's register.
 *
 *   gameworld.music: { direction?: { style?, identity?, cast?, sfx?, space?, ui? }, cues?: { … } }
 *     style      'field' (the orchestra, beats/field-score.js) | 'club' (electronic, beats/club-score.js): the game's
 *                default score style; a cue may still be the other
 *     identity   a non-negative integer: the seed of the game's score identity (its key, hall, motif and palette:
 *                field-score.js scoreIdentity). Absent: the game's own, from its ref, as a quick game's is
 *     cast       who plays each job across the game's cues ({ colour?, ground?, lead?, brass?, pad?, motion?, kit? },
 *                beats/casting.js): over the identity's own players
 *     sfx        the SFX shelf style the sound sheet speaks in where the game's `sound.style` says none
 *     space      the space every level's sounds are heard in (the SFX mixer's: open, interior, hangar, cavern, vacuum);
 *                absent, each level's own, from its place (sound-sheet.js levelSpace)
 *     ui         the interface's sound set (beats/ui-sounds.js), played in the identity's key
 *     cues       the score's cue sheet (the `score` chapter's): read there
 *
 *   readMusic(M)                       → M, or throws naming what it takes (the world's read)
 *   audioDirection(world, { game? })   → { style, identity, voice, cast, sfx, space, ui, why: { <field>: reason }, own }
 *                                        (`game`: the seed the run gives the game's identity when the direction names
 *                                        none; `voice`: that identity said, its key, flavour, hall and players)
 *   tasteNotes(world, sheet)           → [line]: where the sound sheet sits badly with the direction. Advice: the music
 *                                        department says it, play decides. [] when nothing clashes
 *
 * TASTE IS ADVICE: nothing here refuses a sound or changes one. Pure.
 */
import { sceneStyle, sceneFlavour } from '../beats/score-suggest.js';
import { scoreIdentity } from '../beats/field-score.js';
import { readCast, castAdvice } from '../beats/casting.js';
import { UI_SOUND_SET_IDS } from '../beats/ui-sounds.js';
import { STYLES } from '../sfx-shelf/styles.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: music${m}`);
export const SCORE_STYLES = Object.freeze(['field', 'club']);
// the SFX mixer's spaces (the kernel's SFX_SPACES; beats-sfxmix.test.js holds the two lists together)
export const MIX_SPACES = Object.freeze(['open', 'interior', 'hangar', 'cavern', 'vacuum']);
const KEYS = ['direction', 'cues'], DIRECTION_KEYS = ['style', 'identity', 'cast', 'sfx', 'space', 'ui'];
const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** A game's own `music`, checked; throws `gameworld: music…`. (Its `cues` are the cue sheet's to read.) */
export function readMusic(M) {
  if (M === undefined) return undefined;
  if (!isObj(M)) throw fail(` is { direction?, cues? } (got ${JSON.stringify(M)})`);
  for (const k of Object.keys(M)) if (!KEYS.includes(k)) throw fail(`.${k} is not one of ${KEYS.join(', ')}`);
  const D = M.direction;
  if (D !== undefined) {
    if (!isObj(D)) throw fail(`.direction is { ${DIRECTION_KEYS.join('?, ')}? }`);
    for (const k of Object.keys(D)) if (!DIRECTION_KEYS.includes(k)) throw fail(`.direction.${k} is not one of ${DIRECTION_KEYS.join(', ')}`);
    if (D.style !== undefined && !SCORE_STYLES.includes(D.style)) throw fail(`.direction.style is ${SCORE_STYLES.join(' or ')} (the orchestra, or electronic)`);
    if (D.identity !== undefined && !(Number.isInteger(D.identity) && D.identity >= 0)) throw fail('.direction.identity is a non-negative integer: the seed of the game\'s score identity (its key, hall, motif, palette)');
    if (D.cast !== undefined) { try { readCast(D.cast); } catch (e) { throw fail(`.direction.cast: ${e.message}`); } }
    if (D.sfx !== undefined && !(D.sfx in STYLES)) throw fail(`.direction.sfx '${D.sfx}' is an SFX shelf style: ${Object.keys(STYLES).join(', ')}`);
    if (D.space !== undefined && !MIX_SPACES.includes(D.space)) throw fail(`.direction.space '${D.space}' is one of ${MIX_SPACES.join(', ')}`);
    if (D.ui !== undefined && !UI_SOUND_SET_IDS.includes(D.ui)) throw fail(`.direction.ui '${D.ui}' is a UI sound set: ${UI_SOUND_SET_IDS.join(', ')}`);
  }
  if (M.cues !== undefined && !isObj(M.cues)) throw fail('.cues is { <request id>: \'<mood>\' | { mood, … } | false } (the score\'s cue sheet)');
  return M;
}

// the game's words: its name, its prompt, its world's kit and weather (what sceneStyle reads a scene by)
const wordsOf = (W) => [W?.name, W?.brief?.prompt, W?.prompt, W?.style?.kit, W?.style?.weather, typeof W?.style?.geocube === 'string' ? W.style.geocube : W?.style?.geocube?.from]
  .filter((x) => typeof x === 'string').join(' ');
// the interface's set that sits with a score: by its style, and an electronic scene's kind
const UI_FOR = Object.freeze({ field: 'paper', tech: 'console', cozy: 'glass', drift: 'glass' });

/** The game's audio direction (see the header). */
export function audioDirection(world, { game = null } = {}) {
  const own = readMusic(world?.music)?.direction ?? {}, why = {};
  const context = { title: wordsOf(world) };
  const flavour = sceneFlavour(context);
  const style = own.style ?? sceneStyle(context);
  why.style = own.style ? 'the game says so' : flavour ? `its words say an electronic scene (${flavour})` : 'the orchestra: nothing in its words says electronic';
  const identity = own.identity ?? (Number.isInteger(game) ? game : null);
  why.identity = own.identity !== undefined ? 'the game says so' : identity !== null ? 'the game\'s own, from its ref' : 'the game\'s own, from its ref once it is made';
  const id = identity !== null ? scoreIdentity(identity) : null;
  const cast = own.cast ? readCast(own.cast) : null;
  const voice = id ? { key: NOTES[((id.tonic % 12) + 12) % 12], tonic: id.tonic, flavour: id.flavour, hall: id.room?.decay ?? null,
    players: { colour: id.colour, ground: id.ground, lead: id.leads, brass: id.brass, pad: id.pad, motion: id.motion, kit: id.kit, ...(cast ?? {}) } } : null;
  const sfx = own.sfx ?? 'mouth';
  why.sfx = own.sfx ? 'the game says so' : 'the newest voices first (mouth foley; what it does not voice plays realistic)';
  const ui = own.ui ?? UI_FOR[style === 'club' ? flavour ?? 'tech' : 'field'];
  why.ui = own.ui ? 'the game says so' : `sits with ${style === 'club' ? 'an electronic score' : 'the orchestra'}`;
  why.space = own.space ? 'the game says so' : 'each level\'s own, from its place';
  return { style, identity, voice, cast, sfx, space: own.space ?? null, ui, why, own };
}

// an SFX style that sits badly under a score style, and why
const CLASH = Object.freeze({
  field: { arcade: 'chiptune effects under an orchestra', synth: 'synth effects under an orchestra' },
  club: { orchestral: 'orchestral effects under an electronic score' },
});

/** Where the sound sheet sits badly with the direction (advice; see the header). `sheet`: soundSheet's. */
export function tasteNotes(world, sheet) {
  const D = audioDirection(world), out = [];
  const clash = sheet?.style ? CLASH[D.style]?.[sheet.style] : null;
  if (clash) out.push(`the sound sheet speaks ${sheet.style}: ${clash} (the direction's score is ${D.style}); realistic or mouth sits with either`);
  if (D.own.sfx && world?.sound?.style && world.sound.style !== D.own.sfx) out.push(`sound.style is '${world.sound.style}' and the direction's sfx is '${D.own.sfx}': the sheet keeps its own`);
  if (D.cast && D.voice) for (const line of castAdvice(D.cast)) out.push(`the cast: ${line}`);
  return out;
}
