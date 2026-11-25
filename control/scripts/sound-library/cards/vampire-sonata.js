/**
 * Vampire Sonata's own sounds (the castle's FLAVOR, `vampire-sonata`: gameworld/metroidvania/vampire-sonata.js
 * VAMPIRE_SONATA_SOUND), voicing the rows they name only for that game: Erina, a monster hunter with a longsword in a
 * gothic castle, her boots on its flagstones; her blade cutting the air, cutting into the dead and ringing off plate. Each
 * card's `shelf` the row it voices for her game.
 */

const FLAVOR = 'vampire-sonata';
const FX = 'a gothic action game sound effect, no music, no voice';
const shot = (id, shelf, prompt, seconds = 0.8, takes = 3) => ({ id, shelf, flavor: FLAVOR, role: 'one-shot', prompt: `${prompt}, ${FX}`, seconds, influence: 0.55, loop: false, takes, tags: ['vampire-sonata'] });

export const CARDS = [
  shot('vs-swing', 'blade-swing', 'a longsword swung fast through the air: a sharp clean steel whoosh', 0.5, 4),
  shot('vs-hit', 'blade-hit', 'a longsword cutting into a monster: a sharp slash and a wet thud', 0.6, 4),
  shot('vs-clash', 'blade-clash', 'a longsword striking a suit of steel armour and glancing off: a ringing metal clang', 0.8),
  shot('vs-step', 'step-concrete', 'a single footstep of a leather boot on a stone flagstone floor in a castle hall', 0.5, 4),
  shot('vs-jump', 'jump', 'a woman in a long coat leaping: a quick rush of cloth and a boot pushing off stone', 0.5),
  shot('vs-land', 'land', 'boots landing on a stone floor after a jump: a firm thud and a swish of a long coat', 0.5),
  shot('vs-dodge', 'dodge', 'a quick backstep dodge: a sharp swish of a long coat and boots skidding on stone', 0.5),
  shot('vs-hurt', 'hurt', 'a hunter struck by a monster\'s blow: a heavy impact on leather armour and a cloth rustle', 0.6),
];
