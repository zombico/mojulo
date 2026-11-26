/**
 * A boss fight on the director heard (sfx-shelf/boss-sounds.js), for every boss whatever its game: the wind-ups its
 * patterns lack and the strikes as they land, a second form rising, a great body falling, and a metroidvania's held gates
 * (a portcullis winched up, a cracked wall struck down, a secret wall broken, a grate scraped aside, a magic seal
 * shattering). Each card's `shelf` the row it voices; three takes, a fight playing them in turn. Not a flavor: any game's
 * boss is heard by them.
 */

const FX = 'a dark fantasy action game sound effect, no music, no voice';
const shot = (id, shelf, prompt, seconds = 1.2, takes = 3) => ({ id, shelf, role: 'one-shot', prompt: `${prompt}, ${FX}`, seconds, influence: 0.55, loop: false, takes, tags: ['boss'] });

export const CARDS = [
  // the wind-ups
  shot('bs-windup', 'boss-windup', 'a huge heavy weapon drawn back slowly: steel grinding and armour creaking as its weight shifts', 1.2),
  shot('bs-crouch', 'boss-crouch', 'a huge beast crouching to spring: claws scraping on stone, a heavy body coiling low', 1),
  shot('bs-gather', 'boss-gather', 'a dark power gathering: a rising ominous hum and a low swelling rumble', 1.5),
  shot('bs-venom-gather', 'venom-gather', 'a giant serpent\'s throat swelling with venom: a wet gurgling hiss', 1),
  // the strikes
  shot('bs-cleave', 'boss-cleave', 'a huge blade cleaving down and smashing into a stone floor: a heavy whoosh and a crushing impact', 1.2),
  shot('bs-great-swing', 'great-swing', 'a huge weapon swung in a wide arc: a heavy rushing whoosh through the air', 0.9),
  shot('bs-lunge', 'boss-lunge', 'a huge creature lunging forward: a rush of air and heavy feet pounding stone', 1),
  shot('bs-tail-sweep', 'tail-sweep', 'a giant scaly tail sweeping hard across a stone floor: a heavy scrape and a thud', 1),
  shot('bs-bell-toll', 'great-bell-toll', 'a great cracked bronze church bell tolling once, its deep ring sweeping out and humming', 4),
  shot('bs-shockwave', 'shockwave', 'a shockwave pulsing outward: a deep thump and a rushing ripple of air', 1.5),
  shot('bs-debris', 'falling-debris', 'stones and rubble crashing down from a high ceiling onto a stone floor', 2),
  // what every boss shares
  shot('bs-transform', 'boss-transform', 'a monster rising into its true form: a surge of dark power, bones and flesh wrenching and cracking', 3, 2),
  shot('bs-collapse', 'boss-collapse', 'a giant monster collapsing: a heavy crash to the ground and its body crumbling away to dust', 3, 2),
  // the held gates
  shot('bs-portcullis-rise', 'portcullis-rise', 'a heavy iron portcullis winched up: chains rattling and iron grinding against stone', 2),
  shot('bs-wall-crumble', 'wall-crumble', 'a cracked stone wall smashed open: stone bursting apart and blocks tumbling down', 1.5),
  shot('bs-secret-wall', 'secret-wall', 'a hidden stone wall breaking: a hollow crack and stones falling away into an empty space behind it', 1.5),
  shot('bs-grate-open', 'grate-open', 'a rusty iron grate scraped aside over stone', 1.2),
  shot('bs-seal-break', 'seal-break', 'a magic seal shattering: a bright crack like breaking glass and a falling shimmer', 1.5),
];
