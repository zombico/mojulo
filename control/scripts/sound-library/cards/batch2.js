/**
 * The second batch: the realistic sounds synthesis carries worst, one card per shelf row the first spike left out
 * (guns by cartridge, breakage, the world's mechanisms, creatures, tools, surfaces), and five beds. Same card shape as
 * spike.js; card ids are unique across the sets (cards/index.js checks).
 */

const shot = (id, shelf, prompt, seconds = 1.2, extra = {}) => ({ id, shelf, role: 'one-shot', prompt, seconds, influence: 0.5, loop: false, takes: 3, ...extra });
const bed = (id, shelf, prompt, seconds = 8) => ({ id, shelf, role: 'bed', prompt, seconds, influence: 0.4, loop: true, takes: 2 });

export const CARDS = [
  // movement: the surfaces the spike left out
  shot('step-wood', 'step-wood', 'a single boot footstep on old wooden floorboards, slight creak, close mic, dry', 0.8),
  shot('step-metal', 'step-metal', 'a single boot footstep on a steel grating catwalk, metallic, close mic, dry', 0.8),
  shot('step-snow', 'step-snow', 'a single footstep crunching into fresh snow, close mic, dry', 0.8),
  shot('step-water', 'step-water', 'a single footstep splashing into ankle-deep water, close mic', 0.8),
  // weapons
  shot('smg-shot', 'smg-shot', 'a single submachine gun shot, 9mm, indoors, tight snap with a short tail', 1),
  shot('sniper-shot', 'sniper-shot', 'a single high-caliber sniper rifle shot, outdoors, huge crack and long rolling echo', 3),
  shot('magnum-shot', 'magnum-shot', 'a single .44 magnum revolver shot, outdoors, heavy boom, short tail', 1.5),
  shot('suppressed-shot', 'suppressed-shot', 'a single suppressed pistol shot, muffled thump with the slide clacking, close', 0.8),
  shot('rack', 'rack', 'a pump shotgun being racked, two-part metallic slide, close, dry', 0.8),
  shot('dry-fire', 'dry-fire', 'an empty pistol dry fire, a single trigger and hammer click, close, dry', 0.5),
  shot('casing-drop', 'casing-drop', 'a single brass bullet casing dropping and bouncing on concrete, close', 1),
  shot('bullet-flyby', 'bullet-flyby', 'a bullet whizzing past the listener\'s head left to right, supersonic crack', 0.8),
  shot('bow-shot', 'bow-shot', 'a longbow releasing an arrow, string twang and a short whoosh, close', 1),
  shot('arrow-hit', 'arrow-hit', 'an arrow striking a wooden target with a solid thunk and a quiver', 0.8),
  // impacts
  shot('stone-impact', 'stone-impact', 'a heavy blow on a stone block, dull hard crack, close, dry', 0.8),
  shot('dirt-impact', 'dirt-impact', 'a heavy object thudding into packed dirt, earthy thump with grit falling', 0.8),
  shot('water-impact', 'water-impact', 'a body falling into deep water, a large heavy splash', 1.5),
  shot('ricochet', 'ricochet', 'a bullet ricochet off a metal surface, sharp ping and whine', 1),
  shot('car-crash', 'car-crash', 'a car crashing into a wall, crunching metal and shattering glass, debris settling', 3),
  // melee
  shot('katana-swing', 'katana-swing', 'a fast katana sword swing cutting the air, sharp whoosh, close, dry', 0.6),
  shot('katana-draw', 'katana-draw', 'a katana drawn from its wooden scabbard, a steel slide and ring, close', 1.2),
  shot('blunt-hit', 'blunt-hit', 'a wooden club hitting a body, heavy dull thwack, close, dry, no voice', 0.6),
  shot('shield-hit', 'shield-hit', 'a sword striking a wooden round shield with iron rim, heavy knock, close', 0.8),
  // explosions and breakage
  shot('grenade-blast', 'grenade-blast', 'a hand grenade explosion outdoors, sharp blast with shrapnel and debris', 2.5),
  shot('wood-break', 'wood-break', 'a wooden crate smashed apart, splintering planks falling', 1.5),
  shot('stone-break', 'stone-break', 'a stone wall crumbling, rocks cracking and tumbling down', 2.5),
  shot('metal-tear', 'metal-tear', 'a sheet of steel being torn apart, screeching metal', 2),
  // elements
  shot('fire-whoosh', 'fire-whoosh', 'a burst of flame igniting, a big fiery whoosh', 1.5),
  shot('ice-crack', 'ice-crack', 'a sheet of ice cracking under weight, sharp splintering crack', 1.5),
  shot('lightning-strike', 'lightning-strike', 'a lightning bolt striking close by, a violent crack followed by thunder', 3),
  shot('wind-gust', 'wind-gust', 'a single strong gust of wind sweeping past, rising and falling', 2.5),
  shot('sizzle', 'sizzle', 'water hitting a hot iron plate, a sharp steam sizzle', 1.5),
  // the world's mechanisms
  shot('key-unlock', 'key-unlock', 'an old iron key turning in a heavy lock, a mechanical clunk, close, dry', 1.2),
  shot('lever', 'lever', 'a heavy iron lever pulled down, grinding and a locking clunk', 1.2),
  shot('portcullis', 'portcullis', 'a heavy iron portcullis rising, chains rattling and gears grinding', 4),
  shot('metal-creak', 'metal-creak', 'a large rusty metal hinge creaking slowly', 2),
  shot('potion-drink', 'potion-drink', 'a cork popped from a glass bottle and a liquid gulped, close, no voice words', 1.5),
  // creatures
  shot('growl', 'growl', 'a large dog growling low and menacing, close', 2),
  shot('wolf-howl', 'wolf-howl', 'a single wolf howling at night, distant, outdoors', 4),
  shot('crow', 'crow', 'a crow cawing twice, outdoors', 1.5),
  shot('horse-neigh', 'horse-neigh', 'a horse neighing, outdoors, close', 2),
  shot('cat-hiss', 'cat-hiss', 'a cat hissing aggressively, close', 1),
  // machinery and sport
  shot('car-door', 'car-door', 'a car door closing with a solid thud, close', 1),
  shot('steam-hiss', 'steam-hiss', 'a high-pressure steam valve releasing, a loud hiss', 2),
  shot('ball-kick', 'ball-kick', 'a soccer ball kicked hard, a single leather thump, outdoors', 0.6),
  // work
  shot('axe-chop', 'axe-chop', 'an axe chopping into a log, a solid woody chop, close', 0.8),
  shot('pickaxe-mine', 'pickaxe-mine', 'a pickaxe striking rock, a sharp clink with stone chips falling', 0.8),
  shot('saw-wood', 'saw-wood', 'a hand saw cutting through a wooden plank, two strokes', 2),
  shot('hammer-nail', 'hammer-nail', 'a hammer driving a nail into wood, three strikes', 1.5),
  // beds (loops)
  bed('wind-howl', null, 'a cold wind howling steadily over a mountain ridge, constant, no voices'),
  bed('ocean-waves', null, 'ocean waves breaking on a sandy beach, constant, no voices, no birds'),
  bed('night-crickets', null, 'a summer night ambience, crickets and distant frogs, constant, no voices'),
  bed('cave-drips', null, 'an underground cave ambience, slow water drips and a low hollow air tone, constant'),
  bed('crowd', 'crowd', 'a large stadium crowd murmuring and cheering steadily, constant, no words'),
];
