/**
 * Magic's sounds as a KIT (sfx-shelf/magic-sounds.js): each element in its phases and tiers (the cast gathering, the
 * bolt a minor spell lands as, the burst a major one, the cataclysm an ultimate), the statuses taken and what every
 * status shares, the spells that are no element's blow, a battle's own moments, and what magic does to a world (its
 * terrain shifting, its sky turning, what it holds). For the RPG rails (Isekai Party's battles, Fable of Artesia,
 * Ebon Spirits) and any game that casts. Not a flavor: the shelf's rows, heard by every game that names them.
 *
 * Each card's `shelf` is its row; its `tags` say its axis (`magic`, and the element, `status`, `spell`, `battle`,
 * `world`, `terrain`, and the tier) for finding it again (library.js recordingsTagged). Named as sounds (cards/index.js):
 * the element's matter and motion, never a scene, never a word a voice would say.
 */

const SFX = 'a fantasy magic sound effect, no music, no voice';
const shot = (id, shelf, prompt, seconds, tags, extra = {}) => ({ id, shelf, role: 'one-shot', prompt: `${prompt}, ${SFX}`, seconds, influence: 0.6, loop: false, takes: 3, tags: ['magic', ...tags], ...extra });
const cue = (id, shelf, prompt, seconds, tags) => ({ id, shelf, role: 'cue', prompt: `${prompt}, ${SFX}`, seconds, loop: false, takes: 3, tags: ['magic', ...tags] });
const hold = (id, shelf, prompt, tags) => ({ id, shelf, role: 'loop', prompt: `${prompt}, constant and steady, ${SFX}`, seconds: 8, influence: 0.6, loop: true, takes: 2, tags: ['magic', ...tags] });

// each element: its cast, its bolt (minor), its burst (major), its cataclysm (ultimate)
const ELEMENT = {
  fire: ['flames swirling and gathering into a rising roar', 'a fireball striking: a sharp whoosh and a crackling burst of flame',
    'a wave of fire exploding over a wide area: a roaring blast and crackling flames', 'an enormous firestorm erupting: a massive roaring inferno blast, rumbling and crackling'],
  ice: ['frost crystallising and gathering: a cold shimmering hiss and tinkling crystals', 'an ice shard striking: a sharp crack and shattering crystals',
    'ice spikes erupting and shattering over a wide area with a freezing wind', 'a colossal glacier crashing down: massive ice crushing and shattering, a deep freezing boom'],
  thunder: ['electricity crackling and building: rising buzzing sparks', 'a lightning bolt striking: a sharp electric crack and sizzle',
    'several lightning bolts striking the ground: crackling thunder blasts', 'a massive thunderstorm unleashed: a huge lightning crash and long rolling thunder'],
  water: ['water swirling and gathering: a rising rushing flow and bubbling', 'a jet of water striking: a hard splash and spray',
    'a crashing wave: a huge splash and rushing water', 'a giant tidal wave crashing down: a thunderous roaring torrent'],
  wind: ['wind swirling and gathering: a rising whistling gust', 'a blade of wind slicing: a sharp swoosh and whistle',
    'a powerful whirlwind blast: a roaring gust sweeping past', 'a raging tornado unleashed: a howling roaring vortex with debris'],
  earth: ['the ground rumbling and rocks gathering: a low grinding rumble', 'a boulder hurled and smashing: a heavy rock impact and crumbling',
    'stone spikes erupting from the ground: grinding cracks and crumbling rock', 'a massive earthquake and falling meteors: a deep thunderous rumble and huge rock impacts'],
  light: ['holy light gathering: a bright shimmering hum and a rising chime', 'a beam of holy light striking: a bright radiant zap and a shimmering sparkle',
    'a burst of holy light: a radiant explosion with shimmering bells', 'a blinding radiant blast with a swelling heavenly chord and ringing bells'],
  dark: ['dark energy gathering: a deep ominous swirling hum and a low drone', 'a bolt of dark energy striking: a deep distorted impact and a hollow boom',
    'a wave of dark energy exploding: a deep distorted blast with a sucking rush', 'a vast void collapsing: a huge deep implosion and a long dark rumbling roar'],
  poison: ['toxic gas bubbling and gathering: a thick gurgling hiss', 'a glob of acid splattering: a wet splat and a sizzling hiss',
    'a cloud of poison gas bursting: a wet hissing blast and bubbling', 'a huge toxic eruption: a massive bubbling acid blast and a long sizzling hiss'],
  nature: ['leaves rustling and gathering: a rising swirl of leaves and creaking wood', 'thorny vines lashing: a sharp whip crack and rustling leaves',
    'roots bursting from the ground: cracking earth, creaking wood and rustling', 'a giant forest erupting from the ground: massive creaking trunks, cracking wood and roaring leaves'],
  arcane: ['arcane energy gathering: a shimmering magical hum rising in pitch', 'a magic missile striking: a bright zap and a shimmering pop',
    'an arcane explosion: a shimmering magical blast with sparkling echoes', 'a massive arcane nova: a huge resonant magical blast and a long shimmering roar'],
};
const elementCards = Object.entries(ELEMENT).flatMap(([el, [cast, bolt, burst, cata]]) => [
  shot(`mg-${el}-cast`, `${el}-cast`, cast, 1.5, [el, 'cast']),
  shot(`mg-${el}-bolt`, `${el}-bolt`, bolt, 1.2, [el, 'minor']),
  shot(`mg-${el}-burst`, `${el}-burst`, burst, 2.2, [el, 'major']),
  shot(`mg-${el}-cataclysm`, `${el}-cataclysm`, cata, 4, [el, 'ultimate']),
]);

const STATUS = {
  poison: 'a sickly bubbling gurgle and a sour descending tone', burn: 'a flame flaring and clinging: a crackling whoosh that sizzles on',
  freeze: 'ice closing over something: a crackling freeze and a crystalline chime', paralysis: 'a crackling electric seize: a sharp buzz and jittering sparks',
  sleep: 'a soft drowsy shimmer: gentle slow descending chimes', silence: 'a muffled seal: a soft thump and a muted descending tone',
  confusion: 'a dizzy warbling: a wobbling, swirling pitch bend', blindness: 'a dark flash: a sharp muffled whoosh and a dull drone',
  stun: 'a ringing daze: a sharp clang and a high ringing tone', petrify: 'turning to stone: a grinding crackling crust spreading and hardening',
  doom: 'a deep bell toll and an ominous low drone', regen: 'a gentle rising glow: soft warm chimes ascending',
  haste: 'a quick rising whoosh with a bright fast ticking', slow: 'a dragging warp: a tone falling in pitch and slowing down',
  berserk: 'a red roaring surge: a deep aggressive rising rumble', barrier: 'a shimmering dome rising: a glassy hum and a bright chime',
};
const statusCards = Object.entries(STATUS).map(([s, p]) => cue(`mg-status-${s}`, `status-${s}`, p, 1.3, ['status', s]));

export const CARDS = [
  ...elementCards,
  ...statusCards,
  // what every status shares
  cue('mg-stat-up', 'stat-up', 'a stat raised: a bright quick rising chime', 1, ['status']),
  cue('mg-stat-down', 'stat-down', 'a stat lowered: a dull quick falling tone', 1, ['status']),
  cue('mg-status-cure', 'status-cure', 'a cleansing sparkle: a bright shimmering wash of chimes', 1.2, ['status']),
  cue('mg-status-fade', 'status-fade', 'a soft fading shimmer, short and quiet', 0.8, ['status']),
  shot('mg-poison-tick', 'poison-tick', 'a small sickly pulse: a short wet gurgle', 0.6, ['status', 'poison']),
  cue('mg-status-shift', 'status-shift', 'a short neutral magical shimmer', 0.7, ['status']),
  // the spells that are no element's blow (the shelf's own rows among them)
  shot('mg-heal', 'heal', 'a healing spell: a warm shimmering rising chime and soft sparkles', 1.5, ['spell', 'heal']),
  shot('mg-heal-major', 'heal-major', 'a great healing spell: a warm swelling chord of light and cascading sparkles', 2.5, ['spell', 'heal']),
  shot('mg-revive', 'revive', 'a resurrection spell: a rising radiant swell and a bright ringing chime', 2.5, ['spell', 'heal']),
  shot('mg-drain', 'life-drain', 'a life drain: a dark sucking pull and a deep throbbing pulse', 1.5, ['spell', 'dark']),
  shot('mg-mana', 'mana-restore', 'mana restored: a cool rising shimmer and a soft chime', 1.2, ['spell']),
  shot('mg-dispel', 'dispel', 'magic dispelled: a sharp unravelling shimmer and a glassy snap', 1.2, ['spell']),
  shot('mg-time-stop', 'time-stop', 'time stopping: a deep warping slowdown and a frozen ticking', 2.5, ['spell']),
  shot('mg-buff', 'buff', 'a strengthening spell: a bright rising surge and a ringing chime', 1.2, ['spell']),
  shot('mg-curse', 'curse', 'a curse laid: a dark descending drone and a hollow boom', 1.5, ['spell', 'dark']),
  shot('mg-teleport', 'teleport', 'a teleport: a quick shimmering whoosh vanishing and a pop reappearing', 1.2, ['spell']),
  shot('mg-summon', 'summon', 'a summoning: a swirling magical hum rising into a deep boom', 2.5, ['spell']),
  shot('mg-spell-cast', 'spell-cast', 'a magic spell cast: a shimmering whoosh and a sparkle', 1, ['spell']),
  // a battle's own moments
  shot('mg-battle-start', 'battle-start', 'a battle transition: a fast rushing swirl and a sharp impact', 1.2, ['battle']),
  shot('mg-boss-appear', 'boss-appear', 'an ominous swelling boom and a deep rumble', 2.5, ['battle']),
  shot('mg-critical', 'critical-hit', 'a critical hit: a sharp heavy crack with a bright ringing flash', 0.8, ['battle']),
  cue('mg-weakness', 'weakness-hit', 'a weak point struck: a bright ringing accent', 0.8, ['battle']),
  shot('mg-resisted', 'resisted', 'a blow resisted: a dull deflected thud', 0.6, ['battle']),
  shot('mg-dissolve', 'foe-dissolve', 'a defeated monster dissolving: a shimmering sparkling fade', 1.5, ['battle']),
  cue('mg-level-up', 'level-up-sting', 'a triumphant rising sparkle and a bright major chord', 2, ['battle']),
  cue('mg-skill-learn', 'skill-learn', 'a bright ascending chime and a sparkle', 1.2, ['battle']),
  // what magic does to a world: its terrain shifting, its sky turning
  shot('mg-earthquake', 'earthquake', 'the ground quaking: a deep long rumble and rattling rocks', 4, ['world', 'terrain', 'earth'], { takes: 2 }),
  shot('mg-ground-crack', 'ground-crack', 'the ground splitting open: a fissure tearing with cracking rock and a rumble', 2.5, ['world', 'terrain', 'earth']),
  shot('mg-stone-rise', 'stone-rise', 'a stone pillar rising from the ground: a grinding upheaval and crumbling dirt', 2.5, ['world', 'terrain', 'earth']),
  shot('mg-stone-sink', 'stone-sink', 'a stone pillar sinking into the ground: a grinding descent and a heavy thud', 2.5, ['world', 'terrain', 'earth']),
  shot('mg-lava-eruption', 'lava-eruption', 'lava erupting: a deep blast and molten spatter with a sizzling hiss', 3, ['world', 'terrain', 'fire']),
  shot('mg-flood', 'flood-surge', 'water flooding in: a powerful rushing surge', 3.5, ['world', 'terrain', 'water'], { takes: 2 }),
  shot('mg-ice-spread', 'ice-spread', 'ice spreading over the ground: a crackling creeping freeze', 2.5, ['world', 'terrain', 'ice']),
  shot('mg-vines-grow', 'vines-grow', 'vines growing fast: creaking stretching wood and rustling leaves', 3, ['world', 'terrain', 'nature']),
  shot('mg-portal-open', 'portal-open', 'a magic portal opening: a swirling rising whoosh and a deep hum', 2.5, ['world', 'arcane']),
  shot('mg-portal-close', 'portal-close', 'a magic portal closing: a collapsing swirl and a soft thump', 2, ['world', 'arcane']),
  shot('mg-ward-dome', 'ward-dome', 'a vast magical dome rising: a deep shimmering swell and a resonant hum', 3, ['world', 'light']),
  shot('mg-sky-darken', 'sky-darken', 'the sky darkening: an ominous rising swell and a distant rumble', 4, ['world', 'dark'], { takes: 2 }),
  shot('mg-dawn-swell', 'dawn-swell', 'a warm radiant swell rising and shimmering', 4, ['world', 'light'], { takes: 2 }),
  // what a world holds
  hold('mg-lava-flow', 'lava-flow', 'lava flowing: a molten bubbling and hissing', ['world', 'fire']),
  hold('mg-portal-hum', 'portal-hum', 'a magic portal held open: a deep swirling hum', ['world', 'arcane']),
  hold('mg-arcane-aura', 'arcane-aura', 'an enchanted aura: a shimmering magical drone', ['world', 'arcane']),
  hold('mg-poison-bog', 'poison-bog', 'a poison bog: a thick sickly bubbling and gurgling', ['world', 'poison']),
];
