/**
 * The animals' sounds, by VOICE CLASS (sfx-shelf/animal-voices.js): each class's call (its voice at rest), alert (its
 * threat, an attack), hurt (a blow taken) and death (its last), and what moves without a voice (wings, a slither, a
 * splash, a swarm). Which species is heard as which class is sfx-shelf/animal-sounds.js: every animal in the fauna
 * roster, the insects, the foe classes and the RPG's monsters land on one of these. Not a flavor: the shelf's rows.
 *
 * Two takes a card (a foe's hurt alternates them). Tags: `animal`, the class, the call. Named as sounds (cards/index.js):
 * the animal and the sound it makes, never a scene; no prompt names a human voice but to refuse it.
 */

const ANIMAL = 'a realistic animal sound effect, natural, no music, no human voice';
const MONSTER = 'a fantasy creature sound effect, no music, no human voice';
const SECONDS = Object.freeze({ call: 1.8, alert: 1.2, hurt: 0.7, death: 1.5 });
const calls = (cls, [call, alert, hurt, death], { kind = ANIMAL, long = 1 } = {}) => Object.entries({ call, alert, hurt, death }).map(([c, p]) => ({
  id: `an-${cls}-${c}`, shelf: `${cls}-${c}`, role: 'one-shot', prompt: `${p}, ${kind}`, seconds: Math.round(SECONDS[c] * long * 10) / 10, influence: 0.6,
  loop: false, takes: 2, tags: ['animal', cls, c],
}));
const M = { kind: MONSTER };

// (the ogre's hurt asked again in other words, takes 3 and 4: its first two said a word and are left out)
export const CARDS = [
  ...calls('big-cat', ['a lion roaring, deep and powerful', 'a big cat snarling and growling as it charges', 'a big cat yowling in pain, a short grunt', 'a big cat\'s dying groan, a fading rumble'], { long: 1.3 }),
  ...calls('house-cat', ['a house cat meowing', 'a cat hissing and spitting', 'a cat yowling in pain', 'a cat\'s weak fading mewl']),
  ...calls('canine', ['a wolf howling', 'a dog snarling and barking aggressively', 'a dog yelping in pain', 'a dog whimpering weakly, fading']),
  ...calls('fox', ['a fox\'s high scream in the night', 'a fox barking sharply and chattering', 'a fox yelping', 'a fox whining softly, fading']),
  ...calls('hyena', ['a hyena whooping and giggling', 'a hyena growling and cackling as it attacks', 'a hyena squealing in pain', 'a hyena\'s fading groan']),
  ...calls('bear', ['a bear huffing and grunting', 'a bear roaring as it charges', 'a bear bellowing in pain', 'a bear\'s deep dying groan'], { long: 1.2 }),
  ...calls('small-mammal', ['a small rodent squeaking and chittering', 'a small animal chattering and hissing in alarm', 'a small animal squealing in pain', 'a small animal\'s faint fading squeak']),
  ...calls('equine', ['a horse neighing', 'a horse snorting and squealing as it rears', 'a horse whinnying in pain', 'a horse\'s heavy dying groan and a last snort']),
  ...calls('donkey', ['a donkey braying', 'a donkey snorting and braying angrily', 'a donkey squealing', 'a donkey\'s weak fading bray']),
  ...calls('camelid', ['a camel groaning and grumbling', 'a camel bellowing and spitting', 'a camel moaning in pain', 'a camel\'s long fading moan']),
  ...calls('deer', ['an elk bugling', 'a deer snorting and stamping in alarm', 'a deer bleating in pain', 'a deer\'s weak fading bleat']),
  ...calls('cattle', ['a cow mooing', 'a bull bellowing and snorting as it charges', 'a cow bawling in pain', 'a bull\'s heavy dying groan'], { long: 1.2 }),
  ...calls('caprine', ['a goat bleating', 'a ram snorting and bleating as it butts', 'a sheep bleating in pain', 'a goat\'s faint fading bleat']),
  ...calls('pig', ['a pig grunting and oinking', 'a wild boar squealing and grunting as it charges', 'a pig squealing in pain', 'a pig\'s fading grunt']),
  ...calls('elephant', ['an elephant trumpeting', 'an elephant trumpeting loudly as it charges, a deep rumble', 'an elephant bellowing in pain', 'an elephant\'s long deep dying rumble'], { long: 1.4 }),
  ...calls('heavy-herbivore', ['a hippo grunting and honking', 'a rhino snorting and bellowing as it charges', 'a hippo bellowing in pain', 'a rhino\'s heavy dying groan'], { long: 1.2 }),
  ...calls('great-ape', ['a gorilla hooting and beating its chest', 'a chimpanzee screaming and shrieking', 'an ape screaming in pain', 'a gorilla\'s low fading groan']),
  ...calls('monkey', ['a monkey chattering and hooting', 'a monkey screeching in alarm', 'a monkey shrieking in pain', 'a monkey\'s faint fading whimper']),
  ...calls('raptor', ['a hawk screeching', 'an eagle screaming as it dives', 'a bird of prey shrieking in pain', 'a bird of prey\'s weak fading cry']),
  ...calls('owl', ['an owl hooting', 'an owl hissing and clacking its beak', 'an owl screeching in pain', 'an owl\'s faint fading hoot']),
  ...calls('corvid', ['a crow cawing', 'a crow cawing harshly and rapidly in alarm', 'a crow squawking in pain', 'a crow\'s weak fading caw']),
  ...calls('songbird', ['a songbird singing a short melodic phrase', 'a small bird chattering in alarm', 'a small bird squeaking in distress', 'a small bird\'s faint fading peep']),
  ...calls('parrot', ['a parrot squawking', 'a parrot screeching loudly', 'a parrot shrieking in pain', 'a parrot\'s weak fading squawk']),
  ...calls('waterfowl', ['a duck quacking', 'a goose honking and hissing aggressively', 'a goose honking in distress', 'a duck\'s faint fading quack']),
  ...calls('poultry', ['a rooster crowing', 'a hen squawking and clucking in alarm', 'a chicken squawking in pain', 'a hen\'s faint fading cluck']),
  ...calls('large-bird', ['an ostrich booming low', 'an ostrich hissing and hooting as it charges', 'a large bird honking in pain', 'a large bird\'s fading low boom']),
  ...calls('crocodilian', ['an alligator bellowing low', 'a crocodile hissing loudly and snapping its jaws', 'a crocodile hissing and growling in pain', 'a crocodile\'s low fading growl']),
  ...calls('reptile', ['a lizard hissing softly and clicking', 'a monitor lizard hissing loudly', 'a lizard\'s sharp hiss of pain', 'a lizard\'s faint fading hiss']),
  ...calls('snake', ['a snake hissing', 'a rattlesnake rattling and hissing as it strikes', 'a snake hissing sharply in pain', 'a snake\'s long faint fading hiss']),
  ...calls('frog', ['a frog croaking', 'a toad croaking loudly and rapidly', 'a frog squeaking in distress', 'a frog\'s faint fading croak']),
  ...calls('bat', ['bats squeaking and chittering', 'a bat screeching as it swoops', 'a bat squealing in pain', 'a bat\'s faint fading squeak']),
  ...calls('insect-buzz', ['a bee buzzing past', 'an angry wasp buzzing loudly as it attacks', 'an insect\'s sharp buzz cut short', 'an insect\'s buzz fading and stopping'], { long: 0.8 }),
  ...calls('insect-chirp', ['a cricket chirping', 'a cicada buzzing loudly', 'an insect\'s chirp cut short', 'a chirp fading to silence'], { long: 0.8 }),
  ...calls('crawler', ['a spider skittering and clicking', 'a giant spider hissing and clicking its fangs', 'a giant bug screeching and clicking in pain', 'a giant bug\'s legs twitching, a fading chitter'], { kind: 'a creature sound effect, no music, no human voice' }),
  ...calls('dolphin', ['a dolphin whistling and clicking', 'an orca\'s sharp loud call', 'a dolphin squealing', 'a dolphin\'s faint fading whistle']),
  ...calls('whale', ['a humpback whale singing a long low moan', 'a whale\'s loud low groan', 'a whale\'s deep moan of pain', 'a whale\'s long fading low moan'], { long: 1.6 }),
  ...calls('seal', ['a sea lion barking', 'a walrus bellowing and roaring', 'a seal yelping in pain', 'a seal\'s faint fading groan']),
  ...calls('dinosaur', ['a huge dinosaur roaring, deep and rumbling', 'a giant dinosaur bellowing and roaring as it charges', 'a giant dinosaur bellowing in pain', 'a giant dinosaur\'s long dying groan, a deep rumble'], { ...M, long: 1.4 }),
  ...calls('raptor-dino', ['a raptor dinosaur chirping and trilling', 'a raptor dinosaur screeching as it attacks', 'a raptor dinosaur squealing in pain', 'a raptor dinosaur\'s fading hiss'], M),
  ...calls('pterosaur', ['a pterosaur screeching high', 'a pterosaur shrieking as it dives', 'a pterosaur squawking in pain', 'a pterosaur\'s fading cry'], M),
  ...calls('sea-monster', ['a sea serpent\'s deep resonant bellow', 'a sea monster roaring and hissing as it surfaces', 'a sea monster shrieking in pain', 'a sea monster\'s long fading moan'], { ...M, long: 1.3 }),
  ...calls('dragon', ['a dragon roaring, deep and fiery', 'a dragon roaring and snarling as it attacks, a rush of breath', 'a dragon shrieking in pain', 'a dragon\'s long dying roar fading to a groan'], { ...M, long: 1.4 }),
  ...calls('slime', ['a slime blob gurgling and squelching', 'a slime splattering and burbling aggressively', 'a slime squishing and squeaking when struck', 'a slime melting into a fading gurgle'], M),
  ...calls('golem', ['a stone golem grinding and rumbling', 'a stone golem roaring with grinding rock as it attacks', 'stone cracking and a golem groaning', 'a stone golem crumbling apart, rocks tumbling'], { ...M, long: 1.2 }),
  ...calls('wisp', ['a wisp humming with an eerie airy shimmer', 'a spirit wailing with a ghostly whoosh', 'a spirit\'s sharp eerie shriek', 'a spirit fading away with a ghostly sigh'], M),
  ...calls('undead', ['bones rattling and a low hollow groan', 'a zombie snarling and groaning as it lunges', 'bones cracking and a hollow groan', 'bones clattering to the ground in a heap'], M),
  // (the castle's peoples, sfx-shelf/animal-sounds.js PEOPLE_VOICE: an ogre's bellow, a demon's snarl)
  ...calls('ogre', ['a huge ogre grunting and breathing heavily, a deep rumbling snort', 'a huge ogre bellowing a deep furious roar', 'a huge brute beast\'s deep pained snort and growl', 'a huge ogre collapsing with a long deep dying groan'], M),
  ...calls('demon', ['a demon hissing softly, a rasping inhuman breath', 'a demon snarling, a rasping shrieking hiss as it lunges', 'a demon shrieking in pain, a sharp rasping hiss', 'a demon dissolving with a fading inhuman shriek and a sizzle'], M),
  // what moves without a voice
  { id: 'an-wings-flutter', shelf: 'wings-flutter', role: 'one-shot', prompt: `small bird wings fluttering as it takes off, ${ANIMAL}`, seconds: 1, influence: 0.6, loop: false, takes: 2, tags: ['animal', 'move'] },
  { id: 'an-wings-heavy', shelf: 'wings-heavy', role: 'one-shot', prompt: `huge wings beating heavily, a few powerful flaps, ${ANIMAL}`, seconds: 2, influence: 0.6, loop: false, takes: 2, tags: ['animal', 'move'] },
  { id: 'an-slither', shelf: 'slither', role: 'one-shot', prompt: `a snake slithering over dry leaves and dirt, ${ANIMAL}`, seconds: 2, influence: 0.6, loop: false, takes: 2, tags: ['animal', 'move'] },
  { id: 'an-fish-splash', shelf: 'fish-splash', role: 'one-shot', prompt: `a fish jumping and splashing at the water's surface, ${ANIMAL}`, seconds: 1.2, influence: 0.6, loop: false, takes: 2, tags: ['animal', 'move'] },
  { id: 'an-whale-breach', shelf: 'whale-breach', role: 'one-shot', prompt: `a whale breaching and crashing back into the sea, a huge splash, ${ANIMAL}`, seconds: 3, influence: 0.6, loop: false, takes: 2, tags: ['animal', 'move'] },
  { id: 'an-insect-swarm', shelf: 'insect-swarm', role: 'loop', prompt: `a swarm of insects buzzing, constant and steady, ${ANIMAL}`, seconds: 8, influence: 0.6, loop: true, takes: 2, tags: ['animal', 'move'] },
].map((c) => (c.id === 'an-ogre-hurt' ? { ...c, takes: 4 } : c));
