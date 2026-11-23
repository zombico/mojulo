/**
 * The menus' own sounds (the game UI runtime's cues, beats/ui-sounds.js), PINNED to mana-ui's sound sets: a card's `ui`
 * names the menu cues it voices and `uiSets` the sets it voices them in, so every page whose theme plays that set hears
 * them (a game's menus, the wireframe board, a preview). A game picks its set by its look, or its rail's or genre's
 * menu sound (playscape/ui/interface-look.js menuSoundSet). A cue no card records keeps the set's synthesized gesture.
 * Named as sounds only (cards/index.js): a menu cue is a cue.
 *
 *   crypt                      gothic: stone, iron, bells and heavy doors, a high cathedral echo (Fallen Angel's)
 *   robot                      a cheerful little robot: blips, chirps, servos (Galaxy Boy's)
 *   glass, terminal            subtle, app-like chimes (Steel Serpents'; the extraction chime their toast)
 *   console, chip, paper, party   lighthearted and bouncy, the fun platform game's (every other game's)
 */

const cue = (id, uiSets, ui, prompt, seconds = 0.6) => ({ id, role: 'cue', ui, uiSets, prompt, seconds, loop: false, takes: 3, tags: ['menu', ...ui] });
const MOVE = ['move', 'move-up', 'move-down'];
const CRYPT = ['crypt'], ROBOT = ['robot'], APP = ['glass', 'terminal'], FUN = ['console', 'chip', 'paper', 'party'];

export const CARDS = [
  // Fallen Angel: gothic, a high echo, heavy doors
  cue('ui-fa-move', CRYPT, MOVE, 'a soft stone tap ringing out with a long high cathedral echo, a gothic game menu sound effect', 0.6),
  cue('ui-fa-accept', CRYPT, ['accept'], 'a single deep church bell toll with a long high cathedral reverb, a gothic game menu sound effect', 1.5),
  cue('ui-fa-back', CRYPT, ['back'], 'a heavy iron latch dropping with a hollow echo in a stone hall, a gothic game menu sound effect', 1),
  cue('ui-fa-open', CRYPT, ['open'], 'a heavy wooden cathedral door creaking open, echoing in a vast stone hall, a gothic game menu sound effect', 2),
  cue('ui-fa-close', CRYPT, ['close'], 'a heavy wooden door shutting with a deep boom echoing in a stone hall, a gothic game menu sound effect', 1.5),
  cue('ui-fa-deny', CRYPT, ['deny'], 'a dull stone thud and an iron chain rattle, echoing, a gothic game menu sound effect', 0.8),
  cue('ui-fa-toast', CRYPT, ['toast'], 'a high crystalline bell chime ringing out in a vast cathedral, a gothic game menu sound effect', 2),
  // Galaxy Boy: very robot, and fun
  cue('ui-gb-move', ROBOT, MOVE, 'a tiny cheerful robot blip, one quick bright beep, a sci-fi game menu sound effect', 0.5),
  cue('ui-gb-accept', ROBOT, ['accept'], 'a happy robot chirp: two rising bright beeps and a quick servo whir, a sci-fi game menu sound effect', 0.7),
  cue('ui-gb-back', ROBOT, ['back'], 'a little robot chirp falling away: a descending double beep, a sci-fi game menu sound effect', 0.6),
  cue('ui-gb-open', ROBOT, ['open'], 'a small robot hatch sliding open with a servo whir and a chirp, a sci-fi game menu sound effect', 0.8),
  cue('ui-gb-close', ROBOT, ['close'], 'a small robot hatch sliding shut with a servo whir and a click, a sci-fi game menu sound effect', 0.7),
  cue('ui-gb-deny', ROBOT, ['deny'], 'a grumpy robot buzz: a low double bloop, a sci-fi game menu sound effect', 0.6),
  cue('ui-gb-toast', ROBOT, ['toast'], 'a cheerful robot jingle of bright rising beeps and a sparkle, a sci-fi game menu sound effect', 1.2),
  // Steel Serpents: very subtle, app-like chimes (its toast the extraction chime)
  cue('ui-ss-move', APP, MOVE, 'a very soft subtle interface tick, a tiny clean click, a minimal app sound effect', 0.5),
  cue('ui-ss-accept', APP, ['accept'], 'a soft clean interface chime: a short gentle ascending two-note tone, a minimal app sound effect', 0.6),
  cue('ui-ss-back', APP, ['back'], 'a soft clean interface tone: a short gentle descending two-note tone, a minimal app sound effect', 0.6),
  cue('ui-ss-open', APP, ['open'], 'a soft airy interface swoosh with a faint glassy chime, a minimal app sound effect', 0.7),
  cue('ui-ss-close', APP, ['close'], 'a soft airy reversed swoosh fading out, a minimal app sound effect', 0.6),
  cue('ui-ss-deny', APP, ['deny'], 'a soft muted low interface double tone, a minimal app sound effect', 0.6),
  // every other game: lighthearted, bouncy fun
  cue('ui-fun-move', FUN, MOVE, 'a light cheerful pop, a tiny bubbly blip, a cartoon game menu sound effect', 0.5),
  cue('ui-fun-accept', FUN, ['accept'], 'a bright cheerful bouncy chime, a quick happy ding, a cartoon game menu sound effect', 0.6),
  cue('ui-fun-back', FUN, ['back'], 'a soft playful boop, a quick falling tone, a cartoon game menu sound effect', 0.5),
  cue('ui-fun-open', FUN, ['open'], 'a cheerful springy whoosh with a sparkle, a cartoon game menu sound effect', 0.7),
  cue('ui-fun-close', FUN, ['close'], 'a playful reverse whoosh ending in a soft pop, a cartoon game menu sound effect', 0.6),
  cue('ui-fun-deny', FUN, ['deny'], 'a silly low buzzer bonk, a cartoon game menu sound effect', 0.6),
  cue('ui-fun-toast', FUN, ['toast'], 'a bright cheerful sparkle jingle, a cartoon game menu sound effect', 1.2),
];
