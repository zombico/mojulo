/**
 * THE EGOCUBE'S FACETS: one character as age, frame, role, archetype, motivation and order (docs/egocube.md). Each
 * facet asks a question; each value reads as a line and writes NOTES (channel → lines) and DERIVES (channel → dials,
 * see channels.js). The setting (world, faction) is not a facet here: it is shared by a cast, not rolled per member.
 *
 * Everything is a first reading, to be calibrated at the eyes gate: a value whose notes no one can tell from its
 * neighbour's is cut, as hero-vibe cuts axes.
 */

/** Age bands, youngest first. `life` scales the face-of-life channels (channels.js FACE_OF_LIFE). */
export const AGES = Object.freeze({
  child: {
    life: 0.15, reads: 'a child: the life is not drawn yet',
    notes: { frame: 'the child cast: a big head on a short body', structure: 'a short lower face, big eyes, a small nose and chin', stance: 'restless; weight never quite settled' },
    derives: { frame: ['cast = child'], structure: ['trait = youthful'] },
  },
  youth: {
    life: 0.3, reads: 'young: the life shows in the posture, barely in the face',
    notes: { structure: 'the face still soft; the bones not yet come through', stance: 'energy ahead of judgement: the carriage says more than the face', hair: 'hair worn for how it looks' },
    derives: { structure: ['trait = youthful'], stance: ['axes.energy +'], hair: ['hair.volume +'] },
  },
  adult: {
    life: 0.6, reads: 'an adult: the face has begun to keep what it does',
    notes: { stance: 'settled weight; the stand is a habit now' },
    derives: {},
  },
  seasoned: {
    life: 0.85, reads: 'seasoned: the face at rest has set',
    notes: { structure: 'the bones come through: cheek and jaw read before the flesh', rest: 'the expression they wear most is the one the face keeps', wear: 'lines at the eyes and the mouth where the expression lives' },
    derives: { structure: ['trait = mature'] },
  },
  elder: {
    life: 1, reads: 'old: the whole life is on the face',
    notes: { frame: 'mass settled down and in; a little shorter than they were', structure: 'the bones under thin skin; the nose and ears the largest they have been', colouring: 'grey into the hair; the skin a step paler', stance: 'economy: no wasted movement', wear: 'deep lines; the hands show the work' },
    derives: { frame: ['tune.stature -', 'axes.energy -'], structure: ['trait = mature'], colouring: ['palette.Hair +', 'palette.Skin +'], stance: ['axes.energy -', 'axes.poise +'] },
  },
});

/** Body-type poles (body categorization only, never identity): the hero door's cast poles. */
export const POLES = Object.freeze(['male', 'female']);

/**
 * What the body pole reads as, past childhood: the silhouette cues that keep a body reading as its pole whatever its
 * build (a brute woman still has a waist and a hip line; a lithe man still has the shoulder's V). Body-type cues and how
 * garments fall on them, nothing about character. Before puberty bodies differ little: the child band takes none, the
 * youth band takes them as arriving (thread.js names the growth).
 */
export const POLE_READS = Object.freeze({
  female: {
    notes: {
      frame: 'the waist sits above a wider hip line, and the shoulders are no wider than the hips unless the build says so',
      structure: 'a longer neck; a finer jaw and brow',
      silhouette: 'the waist reads in the outline even under dress, whatever the build: broad shoulders over a defined waist, not a box',
      dress: 'garments fall from the shoulder\'s slope and the chest and are taken in at the natural waist; a square yoke or a stood-off shoulder reads as padding',
    },
    derives: { frame: ['tune.waist -', 'tune.hips +'], structure: ['tune.neck +'], dress: ['outfit.fit +'] },
  },
  male: {
    notes: {
      frame: 'the shoulders wider than the hips: a V from the shoulder to the waist',
      structure: 'a heavier jaw and brow; a thicker neck',
      silhouette: 'a straight drop from the ribs to the hip; the width is at the shoulder',
      dress: 'garments hang from a square shoulder line and drop straight past the waist',
    },
    derives: { frame: ['tune.shoulders +'], structure: ['face.jaw +'] },
  },
});

/** Builds, lightest mass first (the order distance is measured on). Each is a figure-cast preset by name. */
export const BUILDS = Object.freeze({
  lithe:     { reads: 'lithe: long and light', notes: { frame: 'long limbs, a narrow trunk, the weight high and quick' }, derives: { frame: ['cast = lithe'] } },
  canonical: { reads: 'an ordinary build', notes: { frame: 'nothing in the frame asks to be looked at; the rest must' }, derives: { frame: ['cast = canonical'] } },
  heroic:    { reads: 'heroic: broad, tall, the ideal', notes: { frame: 'a broad chest and long legs: the frame the poster wants' }, derives: { frame: ['cast = heroic'] } },
  stout:     { reads: 'stout: short and solid', notes: { frame: 'short-limbed and deep-chested; the centre of gravity low' }, derives: { frame: ['cast = stout'] } },
  brute:     { reads: 'brute: mass first', notes: { frame: 'shoulders wider than the head is tall twice over; no neck to speak of' }, derives: { frame: ['cast = brute'] } },
});

/**
 * Roles: how they fight, read only for what it does to the body and the kit. Ordered by engagement range (the order
 * distance is measured on); `non-combatant` sits apart.
 */
export const ROLES = Object.freeze({
  frontline: {
    reads: 'frontline: takes the hit so others do not',
    notes: { silhouette: 'column or barrel; the mass high, in the shoulders', dress: 'coverage high; the shield or the chest carries the focal', stance: 'feet planted wide; the weight forward' },
    derives: { silhouette: ['silhouette = column'], dress: ['armor.coverage +', 'armor.mass +'], stance: ['axes.weight +', 'gesture = guard'] },
  },
  flanker: {
    reads: 'flanker: arrives from the side, leaves before the answer',
    notes: { silhouette: 'needle; a low profile', dress: 'light layers and asymmetric wraps; nothing that clatters', stance: 'weight on the balls of the feet; the blade hand loose', eyes: 'the eyes do the work: always on the exits' },
    derives: { silhouette: ['silhouette = needle'], dress: ['armor.coverage -', 'outfit.fit +'], stance: ['axes.weight -', 'axes.energy +'] },
  },
  support: {
    reads: 'support: keeps the others standing',
    notes: { silhouette: 'barrel or bell: the kit makes the shape', dress: 'pouches, tools, packs: the kit is the focal', stance: 'turned toward the others even at rest' },
    derives: { silhouette: ['silhouette = barrel'], dress: ['outfit.ornament +'], stance: ['gesture = relaxed'] },
  },
  controller: {
    reads: 'controller: fights through something else (a summoner, a familiar user)',
    notes: { silhouette: 'a pair: their own shape and the familiar\'s read as one', dress: 'the bond carries the focal: a tether, an emblem the familiar shares', palette: 'the familiar wears their accent' },
    derives: { silhouette: ['silhouette = bell'], palette: ['palette.Trim +'] },
  },
  caster: {
    reads: 'caster: works at a distance, through knowledge',
    notes: { silhouette: 'bell (the robe) or needle', dress: 'the ornament carries the element; the hands and the head are the focal', stance: 'still; the hands do the moving' },
    derives: { silhouette: ['silhouette = bell'], dress: ['outfit.ornament +'], stance: ['axes.poise +', 'axes.energy -'] },
  },
  ranged: {
    reads: 'ranged: one long line from the eye to the target',
    notes: { silhouette: 'needle: one long element (the bow, the rifle) draws the shape', dress: 'layered for weather; nothing that catches', eyes: 'the gaze long and level' },
    derives: { silhouette: ['silhouette = needle'], dress: ['outfit.fit +'], eyes: ['expression.aperture -', 'sculpt.lidWeight +'] },
  },
  'non-combatant': {
    reads: 'a non-combatant: their power is not in their hands',
    notes: { silhouette: 'the dress makes the shape, not the kit', dress: 'what they wear says rank, trade or belief; nothing carried for a fight', rest: 'the face is the instrument' },
    derives: { silhouette: ['silhouette = bell'], dress: ['armor.coverage -'] },
  },
});

/** Pearson's four quadrants, round the wheel; three archetypes each, in wheel order. */
export const QUADRANTS = Object.freeze(['freedom', 'mastery', 'belonging', 'stability']);

/**
 * The twelve archetypes, in wheel order (distance is the step round the wheel over six). Each has a LIGHT reading and
 * a SHADOW reading; motivation blends between them (egocube.js). Both readings write the face at rest, the stance,
 * the silhouette, the dress and the palette.
 */
export const ARCHETYPES = Object.freeze({
  innocent: {
    quadrant: 'freedom',
    light: {
      reads: 'the innocent: trusts the world to be good',
      notes: { rest: 'open: brows high at rest, the mouth soft', eyes: 'wide and lit', stance: 'open-chested, unguarded', silhouette: 'round shapes, nothing pointed', dress: 'clean and simple; little adornment', palette: 'light and clean; low contrast' },
      derives: { rest: ['expression.browRaise +', 'expression.mouthCorner +'], eyes: ['expression.aperture +', 'sculpt.catchlight +'], stance: ['axes.confidence +', 'gesture = relaxed'], palette: ['palette.Top +'] },
    },
    shadow: {
      name: 'the denier', reads: 'refuses to see what is wrong',
      notes: { rest: 'a fixed smile that does not reach the eyes', eyes: 'bright and unfocused, looking past', stance: 'too still, too upright', silhouette: 'round, but stiff', dress: 'pristine where it should be worn', palette: 'too clean for the world it stands in' },
      derives: { rest: ['expression.mouthCorner +', 'expression.browRaise -'], eyes: ['sculpt.catchlight -'], stance: ['axes.poise +', 'axes.energy -'], palette: ['palette.Top +'] },
    },
  },
  explorer: {
    quadrant: 'freedom',
    light: {
      reads: 'the explorer: needs to see what is over the hill',
      notes: { rest: 'easy, a little squint from the weather', eyes: 'the gaze off to the distance', stance: 'weight forward; ready to go', silhouette: 'layered and practical; a pack', dress: 'kit chosen for use and mended on the road', palette: 'weathered earth tones and one bright thing found far away' },
      derives: { rest: ['expression.aperture -'], eyes: ['sculpt.lidWeight +'], stance: ['axes.energy +', 'axes.weight -'], dress: ['outfit.fit -', 'outfit.ornament -'], palette: ['palette.Top -'] },
    },
    shadow: {
      name: 'the drifter', reads: 'cannot stay anywhere, so belongs nowhere',
      notes: { rest: 'detached; nothing holds the face', eyes: 'never on the person in front of them', stance: 'already half turned to leave', silhouette: 'everything worn, nothing kept', dress: 'pieces from everywhere and no one place', palette: 'faded to one dust colour' },
      derives: { rest: ['expression.mouthCorner -'], eyes: ['expression.aperture -'], stance: ['axes.confidence -', 'axes.poise -'], palette: ['palette.Top -', 'palette.Bottom -'] },
    },
  },
  sage: {
    quadrant: 'freedom',
    light: {
      reads: 'the sage: wants to understand',
      notes: { rest: 'still; the heavy lid of attention', eyes: 'level and patient', stance: 'composed; the hands visible', silhouette: 'long lines; one tool or book', dress: 'plain cloth, one mark of learning', palette: 'cool and quiet; one deep accent' },
      derives: { rest: ['sculpt.lidWeight +', 'expression.aperture -'], eyes: ['sculpt.catchlight +'], stance: ['axes.poise +', 'axes.energy -'], silhouette: ['silhouette = bell'], palette: ['palette.Top -'] },
    },
    shadow: {
      name: 'the cold judge', reads: 'knows better, and uses it',
      notes: { rest: 'lids heavy and level; the mouth thin', eyes: 'appraising: the gaze that measures', stance: 'chin up, arms folded', silhouette: 'narrow and closed', dress: 'immaculate; learning worn as rank', palette: 'cold; contrast high and controlled' },
      derives: { rest: ['sculpt.lidWeight +', 'expression.mouthCorner -'], eyes: ['sculpt.catchlight -'], stance: ['axes.confidence +', 'axes.poise +'], silhouette: ['silhouette = needle'], palette: ['palette.Ink -'] },
    },
  },
  hero: {
    quadrant: 'mastery',
    light: {
      reads: 'the hero: proves their worth by facing what others will not',
      notes: { rest: 'level brows; the jaw set but not clenched', eyes: 'direct', stance: 'square and grounded', silhouette: 'column; one focal symbol', dress: 'the symbol worn where it is seen', palette: 'clear primaries; the accent is theirs' },
      derives: { rest: ['expression.browTilt +'], eyes: ['expression.aperture +'], stance: ['axes.confidence +', 'gesture = guard'], silhouette: ['silhouette = column'], palette: ['palette.Trim +'] },
    },
    shadow: {
      name: 'the bully', reads: 'needs to win more than to be right',
      notes: { rest: 'the jaw forward; the brows down', eyes: 'hard, daring an answer', stance: 'chest out, taking more room than it needs', silhouette: 'the column swollen: the weapon oversized', dress: 'trophies; the symbol defaced into a brand', palette: 'saturated and loud; the accent turned to blood or iron' },
      derives: { rest: ['expression.browTilt +', 'expression.browRaise -', 'sculpt.browAngle +'], eyes: ['expression.aperture -'], stance: ['axes.confidence +', 'axes.weight +', 'gesture = hand-on-hip'], silhouette: ['silhouette = barrel'], dress: ['armor.mass +', 'armor.ornament +'], palette: ['palette.Trim -'] },
    },
  },
  outlaw: {
    quadrant: 'mastery',
    light: {
      reads: 'the outlaw: breaks what deserves breaking',
      notes: { rest: 'defiance in the chin', eyes: 'amused, or angry', stance: 'weight on one hip', silhouette: 'asymmetric', dress: 'patched and customised; one thing torn off a uniform', palette: 'dark with one stolen colour' },
      derives: { rest: ['expression.mouthCorner +', 'expression.browTilt +'], stance: ['gesture = hand-on-hip', 'axes.poise -'], dress: ['outfit.fit -', 'armor.coverage -'], palette: ['palette.Top -', 'palette.Trim +'] },
    },
    shadow: {
      name: 'the destroyer', reads: 'breaks things because they can',
      notes: { rest: 'contempt: one corner of the mouth up', eyes: 'flat', stance: 'loose and dangerous', silhouette: 'jagged; things hanging off', dress: 'scars worn as display; the torn insignia of what they rejected', palette: 'black and one burning colour' },
      derives: { rest: ['expression.mouthCorner -', 'sculpt.browAngle +'], eyes: ['sculpt.catchlight -'], stance: ['axes.poise -', 'axes.confidence +'], dress: ['outfit.ornament +'], palette: ['palette.Top -', 'palette.Ink -'] },
    },
  },
  magician: {
    quadrant: 'mastery',
    light: {
      reads: 'the magician: makes the world change',
      notes: { rest: 'a knowing calm', eyes: 'a catchlight that seems their own', stance: 'the hands are the focal', silhouette: 'bell or needle; something floating near', dress: 'an emblem, and cloth that moves on its own', palette: 'one impossible colour' },
      derives: { rest: ['expression.mouthCorner +'], eyes: ['sculpt.catchlight +'], stance: ['axes.poise +'], silhouette: ['silhouette = bell'], dress: ['outfit.ornament +'], palette: ['palette.Trim +'] },
    },
    shadow: {
      name: 'the corrupter', reads: 'changes others to suit themselves',
      notes: { rest: 'beauty slightly wrong: too smooth, too symmetric', eyes: 'the catchlight in the wrong place', stance: 'too graceful; never off balance', silhouette: 'elegant, with one wrong angle', dress: 'luxurious; the emblem inverted', palette: 'a colour slightly off; rich and sickly' },
      derives: { rest: ['expression.browRaise -'], eyes: ['sculpt.lidCover +'], stance: ['axes.poise +', 'axes.weight -'], silhouette: ['silhouette = needle'], dress: ['outfit.ornament +', 'outfit.stylize +'], palette: ['palette.Trim -'] },
    },
  },
  everyman: {
    quadrant: 'belonging',
    light: {
      reads: 'the everyman: one of us',
      notes: { rest: 'pleasant, unremarkable', eyes: 'friendly', stance: 'relaxed, unshowy', silhouette: 'ordinary; nothing that stands out', dress: 'plain working clothes', palette: 'warm and muted' },
      derives: { rest: ['expression.mouthCorner +'], stance: ['gesture = relaxed'], dress: ['outfit.stylize -', 'outfit.ornament -'], palette: ['palette.Top -'] },
    },
    shadow: {
      name: 'the conformist', reads: 'disappears into the crowd, and lets the crowd decide',
      notes: { rest: 'blank; waiting to be told', eyes: 'down or sideways', stance: 'shoulders in', silhouette: 'the uniform swallows the shape', dress: 'exactly what everyone wears', palette: 'grey; no accent at all' },
      derives: { rest: ['expression.aperture -'], eyes: ['expression.aperture -'], stance: ['axes.confidence -', 'tune.shoulders -'], dress: ['outfit.stylize -'], palette: ['palette.Trim -', 'palette.Top -'] },
    },
  },
  jester: {
    quadrant: 'belonging',
    light: {
      reads: 'the jester: lightens the load',
      notes: { rest: 'an elastic face; the brows mobile', eyes: 'crinkled', stance: 'loose, a little off balance on purpose', silhouette: 'playful; one exaggerated piece', dress: 'colour clash worn with confidence', palette: 'saturated and clashing' },
      derives: { rest: ['expression.mouthCorner +', 'expression.browRaise +'], eyes: ['expression.aperture -'], stance: ['axes.energy +', 'axes.poise -'], dress: ['outfit.stylize +'], palette: ['palette.Top +', 'palette.Trim +'] },
    },
    shadow: {
      name: 'the cruel prankster', reads: 'laughs at, not with',
      notes: { rest: 'the smile wider than the eyes', eyes: 'watching for the hurt', stance: 'leaning in, too close', silhouette: 'the same playful shape with harder edges', dress: 'the motley gone sharp: points, bells, teeth', palette: 'the same colours, the contrast pushed' },
      derives: { rest: ['expression.mouthCorner +', 'sculpt.browAngle +'], eyes: ['sculpt.catchlight -'], stance: ['axes.energy +', 'axes.confidence +'], dress: ['outfit.stylize +', 'outfit.ornament +'], palette: ['palette.Ink -'] },
    },
  },
  lover: {
    quadrant: 'belonging',
    light: {
      reads: 'the lover: lives for someone or something',
      notes: { rest: 'soft lids; warmth at the mouth', eyes: 'on the beloved', stance: 'open, turned toward', silhouette: 'flowing lines', dress: 'something worn for someone', palette: 'warm and saturated accents' },
      derives: { rest: ['sculpt.lidWeight +', 'expression.mouthCorner +'], stance: ['axes.poise +'], dress: ['outfit.ornament +'], palette: ['palette.Trim +'] },
    },
    shadow: {
      name: 'the obsessive', reads: 'cannot let go',
      notes: { rest: 'a fixed, hungry look', eyes: 'unblinking, always on one thing', stance: 'leaning toward it even at rest', silhouette: 'clutching: something held close', dress: 'a token kept too long; worn thin', palette: 'one colour, everywhere' },
      derives: { rest: ['expression.aperture +'], eyes: ['sculpt.catchlight +'], stance: ['axes.poise -'], palette: ['palette.Trim +', 'palette.Top -'] },
    },
  },
  caregiver: {
    quadrant: 'stability',
    light: {
      reads: 'the caregiver: protects and provides',
      notes: { rest: 'kind; the brows lifted at the centre', eyes: 'warm, checking on others', stance: 'a low centre; open hands', silhouette: 'soft and broad', dress: 'worn practical; aprons, satchels, bandages', palette: 'warm and soft' },
      derives: { rest: ['expression.browRaise +', 'expression.mouthCorner +'], stance: ['axes.weight +', 'axes.confidence -'], silhouette: ['silhouette = barrel'], palette: ['palette.Top +'] },
    },
    shadow: {
      name: 'the martyr', reads: 'gives until it becomes a debt',
      notes: { rest: 'tired; worry drawn in between the brows', eyes: 'heavy, reproachful', stance: 'stooped from carrying', silhouette: 'burdened: more carried than needed', dress: 'mended and re-mended; never for themselves', palette: 'faded; the warmth gone grey' },
      derives: { rest: ['expression.browTilt -', 'expression.mouthCorner -'], eyes: ['sculpt.lidWeight +'], stance: ['axes.energy -', 'axes.confidence -'], dress: ['outfit.fit -'], palette: ['palette.Top -'] },
    },
  },
  creator: {
    quadrant: 'stability',
    light: {
      reads: 'the creator: makes something that lasts',
      notes: { rest: 'absorbed; a slight frown of concentration', eyes: 'on the work', stance: 'leaning in over the bench', silhouette: 'tools at the belt', dress: 'tool marks and stains; one handmade object', palette: 'the colours of their material' },
      derives: { rest: ['expression.browTilt +'], eyes: ['expression.aperture -'], stance: ['axes.poise +'], dress: ['outfit.ornament +'], palette: ['palette.Trim +'] },
    },
    shadow: {
      name: 'the mad maker', reads: 'cannot stop improving, least of all themselves',
      notes: { rest: 'over-focused; the face forgotten', eyes: 'too bright, too long without sleep', stance: 'hunched, twitching', silhouette: 'the self as a project: an augmented limb, a contraption worn', dress: 'every surface over-worked', palette: 'metal and stain, one feverish accent' },
      derives: { rest: ['expression.aperture +'], eyes: ['sculpt.catchlight +'], stance: ['axes.energy +', 'axes.poise -'], dress: ['outfit.ornament +', 'armor.ornament +'], palette: ['palette.Ink -'] },
    },
  },
  ruler: {
    quadrant: 'stability',
    light: {
      reads: 'the ruler: holds order together',
      notes: { rest: 'composed; the chin level', eyes: 'steady, unhurried', stance: 'still and vertical', silhouette: 'symmetric and tall', dress: 'insignia on the centre line', palette: 'deep and rich; gold or its equal' },
      derives: { rest: ['expression.browTilt +'], stance: ['axes.poise +', 'axes.confidence +'], silhouette: ['silhouette = column'], dress: ['outfit.ornament +', 'armor.ornament +'], palette: ['palette.Trim +'] },
    },
    shadow: {
      name: 'the tyrant', reads: 'order for its own sake, and theirs',
      notes: { rest: 'heavy lids; the mouth corners down', eyes: 'bored, or cruel', stance: 'seated; others stand', silhouette: 'the mass in the robe, not the body', dress: 'the insignia grown monstrous: crowns, collars, mantles', palette: 'deep and dark; the gold gone to bronze' },
      derives: { rest: ['sculpt.lidWeight +', 'expression.mouthCorner -'], eyes: ['expression.aperture -'], stance: ['axes.energy -', 'axes.poise +'], silhouette: ['silhouette = bell'], dress: ['outfit.ornament +', 'armor.ornament +'], palette: ['palette.Top -', 'palette.Trim -'] },
    },
  },
});
export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** What motivation adds on its own, beyond the archetype's blend: three bands (selfless … self-serving). */
export const MOTIVES = Object.freeze([
  { upTo: 1 / 3, reads: 'turned outward', notes: { stance: 'open hands; the gaze goes to others first' }, derives: { stance: ['axes.confidence +'] } },
  { upTo: 2 / 3, reads: 'watching for the angle', notes: { eyes: 'eyes moving; weighing the room', stance: 'weight held back, ready to step either way' }, derives: { eyes: ['expression.aperture -'], stance: ['axes.poise -'] } },
  { upTo: 1, reads: 'turned inward', notes: { stance: 'closed hands; the gaze measures', eyes: 'they look at people as costs' }, derives: { stance: ['axes.confidence +'], eyes: ['sculpt.catchlight -'] } },
]);

/** Order, bound (0) … free (1): what survives of law and chaos, kept for being visual. The middle third says nothing. */
export const ORDERS = Object.freeze({
  bound: {
    reads: 'bound: lives by a code',
    notes: { silhouette: 'symmetric', dress: 'a uniform, kept; insignia on the centre line', hair: 'kept to a rule' },
    derives: { dress: ['outfit.fit +'], hair: ['hair.length -', 'hair.volume -'] },
  },
  free: {
    reads: 'free: answers to no one',
    notes: { silhouette: 'asymmetric: one pauldron, one sleeve', dress: 'personal marks: a charm, a hand-sewn repair', hair: 'as it falls' },
    derives: { dress: ['outfit.fit -', 'outfit.stylize +'], hair: ['hair.length +', 'hair.wave +'] },
  },
});

/** The facet questions, in sheet order. */
export const FACETS = Object.freeze({
  age: { asks: 'how much life is on them?', values: Object.keys(AGES) },
  frame: { asks: 'what body were they given?', values: { pole: POLES, build: Object.keys(BUILDS) } },
  role: { asks: 'how do they fight, and what does it do to the body and the kit?', values: Object.keys(ROLES) },
  archetype: { asks: 'what do they want from life?', values: ARCHETYPE_IDS },
  motivation: { asks: 'for whom? 0 selfless … 0.5 opportunistic … 1 self-serving', values: [0, 1] },
  order: { asks: 'by what rule? 0 bound … 1 free', values: [0, 1] },
});
