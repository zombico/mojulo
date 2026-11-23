/**
 * Galaxy Boy's own sounds (the `galaxy-boy` rail, a sci-fi run and gun: gameworld/sound-sheet.js RUN_SOUNDS and its
 * sheet's slots): a FLAVOR, so they voice the rows they name only for a game of that flavor and never the realistic
 * rows every other game hears. Its hero is a small robot with an arm cannon, its foes robots, its bosses giants that
 * blow apart; game sound effects, recorded, not chiptune. Each card's `shelf` is the row it voices for that game.
 */

const FLAVOR = 'galaxy-boy';
const shot = (id, shelf, prompt, seconds = 0.8, extra = {}) => ({ id, shelf, flavor: FLAVOR, role: 'one-shot', prompt: `${prompt}, a sci-fi video game sound effect, clean, punchy, no music, no voice`, seconds, influence: 0.55, loop: false, takes: 3, ...extra });
const hold = (id, shelf, prompt, seconds = 6) => ({ id, shelf, flavor: FLAVOR, role: 'loop', prompt: `${prompt}, a sci-fi video game sound effect, constant, no music`, seconds, influence: 0.5, loop: true, takes: 2 });

export const CARDS = [
  // the buster: a tap, its first charged round, the full charge, and the charge held as it builds
  shot('gb-buster-tap', 'buster-shot', 'a small arm cannon firing a single energy pellet, a bright quick zap', 0.5),
  shot('gb-buster-charged', 'buster-charged-shot', 'an arm cannon firing a half-charged energy shot, a fuller zap with a short whoosh', 0.8),
  shot('gb-buster-full', 'buster-full-shot', 'an arm cannon firing a fully charged energy blast, a big bright burst with a rushing tail', 1.2),
  hold('gb-charge', 'charge-hum', 'an arm cannon charging up, a bright electric energy hum'),
  // the hero: a small robot
  shot('gb-dash', 'dodge', 'a small robot hero dashing, a short thruster burst and a whoosh', 0.6),
  shot('gb-kick', 'kick', 'a small robot hero kicking off a metal wall, a sharp metal clank and a leap', 0.5),
  shot('gb-cling', 'slide', 'a small robot\'s metal boots sliding down a metal wall, a gritty scrape', 1),
  shot('gb-hurt', 'hurt', 'a small robot hero taking a hit, an electric zap and a metallic clang', 0.6),
  shot('gb-jump', 'jump', 'a small robot hero jumping, a quick servo whir and a soft thrust', 0.5),
  shot('gb-land', 'land', 'a small robot hero landing on a metal floor, a solid metallic clunk', 0.5),
  // its foes
  shot('gb-foe-shot', 'shoot', 'a small enemy robot firing an energy pellet, a low buzzing zap', 0.5),
  shot('gb-foe-hit', 'metal-impact', 'an energy shot hitting a small robot, a metallic ping with sparks', 0.5),
  shot('gb-armour', 'ricochet', 'an energy shot glancing off heavy armour plating, a sharp ping and a whine', 0.7),
  shot('gb-wreck', 'wreck-explosion', 'a small robot exploding, a crunchy electric blast and metal debris', 1.5),
  shot('gb-boss', 'big-explosion', 'a giant robot boss blowing apart, a chain of explosions and a huge final blast with debris', 4, { takes: 2 }),
  shot('gb-wake', 'spark', 'a robot powering on, an electric spark crackle and a rising whir', 0.8),
  shot('gb-stomp', 'stomp', 'landing on a small robot enemy\'s head, a springy metallic bop', 0.5),
  // a thrower's rock and the boss room
  shot('gb-lift', 'metal-creak', 'a big robot lifting a boulder, hydraulics straining and stone grinding', 1.2),
  shot('gb-throw', 'throw', 'a heavy boulder hurled, a strained heave and a rushing whoosh', 0.8),
  shot('gb-shut', 'portcullis', 'a heavy sci-fi blast door slamming shut, a hydraulic hiss and a deep metal boom', 2),
];
