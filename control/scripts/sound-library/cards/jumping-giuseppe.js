/**
 * Jumping Giuseppe's own sounds (the `jumping-giuseppe` rail, a mascot platformer: its sheet's slots, its mechanics' cues
 * and its hero's moves through the run channel): a FLAVOR, heard only by a game of that flavor. A bright cartoon world
 * and a springy hero, the jump the game; described as sounds, never as another game's.
 */

const FLAVOR = 'jumping-giuseppe';
const shot = (id, shelf, prompt, seconds = 0.6, extra = {}) => ({ id, shelf, flavor: FLAVOR, role: 'one-shot', prompt: `${prompt}, a bright cartoon platform game sound effect, clean, no music, no voice`, seconds, influence: 0.55, loop: false, takes: 3, ...extra });

export const CARDS = [
  // the hero's feet and leaps
  shot('jg-step', 'step', 'a cartoon hero\'s quick light footstep, a soft padded tap', 0.5),
  shot('jg-step-grass', 'step-grass', 'a cartoon hero\'s quick footstep on grass, a soft swish', 0.5),
  shot('jg-jump', 'jump', 'a cartoon hero jumping, a springy bouncy whoosh', 0.5),
  shot('jg-air-jump', 'air-jump', 'a cartoon hero\'s second jump in mid-air, a quick spinning twirl whoosh', 0.6),
  shot('jg-land', 'land', 'a cartoon hero landing on the ground, a soft bouncy thump', 0.5),
  shot('jg-wall-kick', 'kick', 'a cartoon hero kicking off a wall, a springy pop and a whoosh', 0.5),
  shot('jg-wall-slide', 'slide', 'a cartoon hero sliding down a wall, a squeaky rubbery scrape', 1),
  shot('jg-stomp', 'stomp', 'jumping on a cartoon creature\'s head, a squishy boing', 0.5),
  // what happens to it
  shot('jg-hurt', 'hurt', 'a cartoon hero getting bumped, a comic bonk and a wobble', 0.6),
  shot('jg-hit', 'hit', 'a cartoon hero bumped by a creature, a comic thwack', 0.5),
  shot('jg-death', 'death', 'a cartoon hero defeated, a comic falling slide whistle and a soft plop', 1.5),
  shot('jg-foe-down', 'down', 'a cartoon creature knocked out, a soft puff of smoke', 0.6),
  // what it finds and where it gets to
  shot('jg-pickup', 'pickup', 'collecting a shiny gold coin, a bright sparkling chime', 0.6),
  shot('jg-extra-life', 'chime', 'an extra life gained, a cheerful rising sparkle of chimes', 1.2),
  shot('jg-checkpoint', 'checkpoint', 'a cheerful bright bell ding with a flutter of sparkles, a checkpoint flag sound', 1, { role: 'cue' }),
  shot('jg-goal', 'goal', 'a short bright celebratory flourish of bells and sparkles, an end of level jingle', 2.5, { role: 'cue' }),
];
