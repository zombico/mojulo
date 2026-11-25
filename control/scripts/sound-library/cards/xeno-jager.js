/**
 * XenoJager's own sounds (the planet's FLAVOR, `xeno-jager`: gameworld/metroidvania/xeno-jager.js XENOJAGER_SOUND),
 * voicing the rows they name only for that game: an explorer in a sealed power suit, her right arm a cannon, on a
 * dangerous alien planet of rock and crystal. Each card's `shelf` the row it voices for her game.
 */

const FLAVOR = 'xeno-jager';
const FX = 'a sci-fi exploration game sound effect, no music, no voice';
const shot = (id, shelf, prompt, seconds = 0.8, takes = 3) => ({ id, shelf, flavor: FLAVOR, role: 'one-shot', prompt: `${prompt}, ${FX}`, seconds, influence: 0.55, loop: false, takes, tags: ['xeno-jager'] });

export const CARDS = [
  shot('xj-tap', 'buster-shot', 'a power suit\'s arm cannon firing one plasma shot: a deep punchy energy blast', 0.5, 4),
  shot('xj-charged', 'buster-charged-shot', 'a power suit\'s arm cannon firing a half charged plasma shot: a heavier blast with a rushing tail', 0.8),
  shot('xj-full', 'buster-full-shot', 'a power suit\'s arm cannon firing a fully charged plasma blast: a huge deep burst and a long rushing tail', 1.2),
  shot('xj-step', 'step-concrete', 'a single heavy armoured boot step on alien rock: a solid metallic thud', 0.5, 4),
  shot('xj-jump', 'jump', 'a power suit jumping: hydraulic servos and a short boost of thrusters', 0.6),
  shot('xj-land', 'land', 'a power suit landing on rock: a heavy armoured thud and servos settling', 0.6),
  shot('xj-dash', 'dodge', 'a power suit dashing: a sharp burst of thrusters and a whoosh', 0.6),
  shot('xj-hurt', 'hurt', 'a power suit\'s armour struck: a heavy metallic impact and an electric crackle', 0.6),
  shot('xj-kick', 'kick', 'a power suit kicking off a rock wall: a metallic clank and a thruster puff', 0.5),
  shot('xj-slide', 'slide', 'a power suit\'s armoured boots sliding down a rock wall: a gritty scrape', 1),
  shot('xj-break', 'stone-break', 'alien crystal rock shattering: a sharp crack and glassy shards scattering', 1.2),
];
