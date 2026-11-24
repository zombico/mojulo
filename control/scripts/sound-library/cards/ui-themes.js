/**
 * The menus' own sounds (the game UI runtime's cues, beats/ui-sounds.js), PINNED to mana-ui's sound sets: a card's `ui`
 * names the menu cues it voices and `uiSets` the sets it voices them in, so every page whose theme plays that set hears
 * them (a game's menus, the wireframe board, a preview). A game picks its set by its look, or its rail's or genre's
 * menu sound (playscape/ui/interface-look.js menuSoundSet). A cue no card records keeps the set's synthesized gesture.
 * Named as sounds only (cards/index.js): a menu cue is a cue.
 *
 *   crypt                      gothic: stone, iron, bells and heavy doors, a high cathedral echo (Fallen Angel's)
 *   robot                      Steel Serpents' clean app-like chimes, brighter and quicker (Galaxy Boy's; its first
 *                              takes, a robot's chirps and servos, are out of the set)
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
  // Galaxy Boy: Steel Serpents' clean app-like chimes, a touch brighter and quicker (upbeat)
  cue('ui-gb2-move', ROBOT, MOVE, 'a soft bright interface tick, a tiny clean click with a light sparkle, a minimal upbeat app sound effect', 0.5),
  cue('ui-gb2-accept', ROBOT, ['accept'], 'a bright clean interface chime: a quick cheerful ascending two-note tone, a minimal upbeat app sound effect', 0.6),
  cue('ui-gb2-back', ROBOT, ['back'], 'a soft clean interface tone: a quick light descending two-note tone, a minimal upbeat app sound effect', 0.6),
  cue('ui-gb2-open', ROBOT, ['open'], 'a light airy interface swoosh with a bright glassy chime, a minimal upbeat app sound effect', 0.7),
  cue('ui-gb2-close', ROBOT, ['close'], 'a light airy reversed swoosh ending in a soft click, a minimal upbeat app sound effect', 0.6),
  cue('ui-gb2-deny', ROBOT, ['deny'], 'a soft muted low interface double tone, gentle, a minimal app sound effect', 0.6),
  cue('ui-gb2-toast', ROBOT, ['toast'], 'a bright cheerful interface chime: three quick ascending clean notes, a minimal upbeat app sound effect', 1),
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
