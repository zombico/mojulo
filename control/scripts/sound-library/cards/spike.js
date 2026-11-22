/**
 * The first spike's generation cards: one card per kind of sound the library will hold, each naming the shelf row it
 * would voice (`shelf`, a roster id) or the band piece it would play (`band`), so the spike tests the procedures
 * (one-shots, loops, instrument pieces) rather than covering the catalog.
 *
 * A card: { id, shelf? | band?, role: 'one-shot' | 'bed' | 'instrument', prompt, seconds, influence, loop, takes }.
 * The card is the recipe of record for a recorded sound: ElevenLabs takes no seed, so a take is named by its bytes'
 * hash, and the card says how it was asked for.
 */

const shot = (id, shelf, prompt, seconds = 1.5, extra = {}) => ({ id, shelf, role: 'one-shot', prompt, seconds, influence: 0.5, loop: false, takes: 3, ...extra });
const bed = (id, shelf, prompt, seconds = 8) => ({ id, shelf, role: 'bed', prompt, seconds, influence: 0.4, loop: true, takes: 2 });
const drum = (id, band, prompt, seconds = 1) => ({ id, band, role: 'instrument', prompt, seconds, influence: 0.6, loop: false, takes: 2 });

export const CARDS = [
  // movement: footsteps by surface
  shot('step-concrete', 'step-concrete', 'a single footstep of a leather boot on concrete, close mic, dry, no reverb', 0.8),
  shot('step-gravel', 'step-gravel', 'a single footstep on loose gravel, crunchy, close mic, dry', 0.8),
  shot('step-grass', 'step-grass', 'a single soft footstep on grass, close mic, dry', 0.8),
  // weapons
  shot('pistol-shot', 'pistol-shot', 'a single 9mm pistol gunshot, outdoors, sharp crack with a short tail', 1.5),
  shot('rifle-shot', 'rifle-shot', 'a single assault rifle gunshot, outdoors, punchy, with a short echo tail', 1.5),
  shot('shotgun-shot', 'shotgun-shot', 'a single pump shotgun blast, outdoors, heavy boom, short tail', 1.5),
  shot('mag-in', 'mag-in', 'a rifle magazine inserted and seated with a metallic click, close, dry', 0.8),
  // impacts
  shot('metal-impact', 'metal-impact', 'a heavy blow on a steel plate, metallic clang, close, dry', 1),
  shot('wood-impact', 'wood-impact', 'a solid hit on a thick wooden plank, woody knock, close, dry', 0.8),
  shot('flesh-impact', 'flesh-impact', 'a body punch impact, meaty thud, close, dry, no voice', 0.6),
  // melee
  shot('blade-clash', 'blade-clash', 'two steel swords clashing, bright metallic ring, close, dry', 1.2),
  shot('punch', 'punch', 'a fast punch whoosh ending in a hard hit, close, dry, no voice', 0.6),
  // explosion and breakage
  shot('explosion', 'explosion', 'a large explosion outdoors, deep boom with debris falling, rumbling tail', 4),
  shot('glass-break', 'glass-break', 'a window pane shattering, glass shards falling on a hard floor', 2),
  // world
  shot('door-creak', 'door-creak', 'an old wooden door creaking open slowly, close, dry', 2.5),
  shot('chest-open', 'chest-open', 'a heavy wooden treasure chest lid opening with a creak and iron hinges', 1.5),
  shot('coin-drop', 'coin-drop', 'a single metal coin dropped onto a stone floor, bouncing and spinning to rest', 1.5),
  // creatures
  shot('dog-bark', 'dog-bark', 'a single bark of a medium sized dog, outdoors, close', 0.8),
  shot('roar-monster', 'roar-monster', 'a large monster roar, deep and guttural, with a short tail', 3),
  shot('owl', 'owl', 'a tawny owl hooting twice at night, outdoors, distant', 2.5),
  // elements
  shot('water-splash', 'water-splash', 'a rock thrown into a pond, a single water splash, outdoors', 1.2),
  shot('thunder-far', 'thunder-far', 'distant thunder rolling across the sky, low rumble', 5),
  // beds (loops)
  bed('fire-burning', 'fire-burning', 'a campfire burning steadily, crackling wood, close, constant'),
  bed('forest-day', null, 'a forest ambience in daytime, birds chirping, light wind in leaves, constant, no voices'),
  bed('rain-steady', null, 'steady rain falling on leaves and the ground, constant, no thunder'),
  // the band's recorded rock kit (the robot band's sampler test)
  drum('kick', 'drum-kit-recorded-rock:36', 'a single rock kick drum hit, punchy, dry studio recording, one shot', 0.8),
  drum('snare', 'drum-kit-recorded-rock:38', 'a single rock snare drum hit, crisp, dry studio recording, one shot', 0.8),
  drum('hat-closed', 'drum-kit-recorded-rock:42', 'a single closed hi-hat hit, tight, dry studio recording, one shot', 0.5),
  drum('hat-open', 'drum-kit-recorded-rock:46', 'a single open hi-hat hit ringing out, dry studio recording, one shot', 1.2),
  drum('tom-low', 'drum-kit-recorded-rock:45', 'a single low floor tom hit, deep, dry studio recording, one shot', 1),
  drum('tom-high', 'drum-kit-recorded-rock:48', 'a single high rack tom hit, dry studio recording, one shot', 0.8),
  drum('crash', 'drum-kit-recorded-rock:49', 'a single crash cymbal hit ringing out, dry studio recording, one shot', 2.5),
];
