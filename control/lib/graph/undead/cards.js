/**
 * THE UNDEAD CARDS: each variation of a form as words, never code. A card names what its passes do to the creature
 * biped (./passes.js); a new variation is a new card. FORM ONLY: the palette stays the creature loop's neutral reading.
 *
 *   form    'flesh' (a zombie: the body kept and wrong) | 'bone' (a skeleton: the body gone to its frame)
 *   build   the egocube build that rolls it (a bestiary's facets.build)
 *   waste   { limbs, trunk }       the radii drawn in (1 is the living body's); a zombie's flesh shrunk to its bones
 *   bloat   { trunk, gut, limbs }  swelled: the trunk's radii ×, the belly pushed forward (m at 2 m tall), the limbs ×
 *   bones   { shaft, ends, ribs }  a skeleton's bone weights: its shafts' and its knobbed ends' radii and its ribs' ×
 *   arms    { length, reach }      the arms longer (× along the bone) and how far forward they are held at rest
 *                                  (0 hanging … 1 straight out: the zombie's reach)
 *   heavy   { side, k }            one arm swollen (side R | L, its radii × k) and the other withered (× 1 / k)
 *   lean    degrees the body is hunched forward from the hips (negative leans back)
 *   head    { drop, tilt }         the head hung (0 … 1 toward the chest) and cocked to one side (−1 … 1)
 *   jaw     degrees the jaw hangs open
 *   crouch  the knees given (0 … 0.3)
 *   gait    the walk it walks (./gaits.js: shamble, creep, waddle, drag, stumble, march, clatter, lumber, trundle), its
 *                                  hobble seeded by the walk's own odds
 *   loss    { odds, parts }        a seeded loss: with `odds`, one of `parts` is gone (its bones stay in the rig, so every
 *                                  clip still plays): 'foreArm' (the forearm and the hand on one side), 'hand'
 *   jaw     (a skeleton's) degrees its mandible hangs from the skull at rest, the separation showing
 *   shreds  { chest, back, hips, arms, length }   what its clothes left, worn under the `shreds` layer (./shreds.js):
 *                                  how much of each is still there (0 … 1) and the strips' length ×
 *   reads   what it is, in a line
 *
 *   bared   { count: [lo, hi], parts }   a zombie's parts gone to bone under the `bared` layer (./bared.js): how many,
 *                                  from which (skull, arm, foreArm, thigh, shin, ribs; halfForeArm, halfUpperArm,
 *                                  halfThigh, halfShin: the bone with a sleeve of flesh left at one end)
 *   spots   { count: [lo, hi], deep, face: [lo, hi] }   a zombie's flesh gone in patches under the `spots` layer
 *                                  (./spots.js): how many on the body, the share deep to the bone, how many on the head
 *   decay   { open, limbs, neck, scalp }    a skeleton's flesh under the `decayed` layer (./decay.js): how far its chest is
 *                                  rotted open (0 … 1), the odds a limb, its throat and its scalp keep flesh
 *
 *   armed   { right?, left?, back?, hip? }   what it carries under the `armed` layer: the hero's gear (polygonizer/
 *                                  hero-gear.js), each slot an equipment build
 *   adorned { helm, cuirass, pauldron, pauldrons, bracers, greaves }   the odds each piece of its armour is still worn
 *                                  under the `adorned` layer (./armour.js)
 *
 * The LAYERS a lineage lays over a form's card (UNDEAD_LAYERS): `bared` a corpse's parts back to bone, `decayed` gaunt
 * flesh back on the bone, `attack` the attack skeleton's segmented limbs, claws and strike, `adorned` what is left of its armour, `armed` its weapons, `shreds` its clothes in rags.
 */
export const UNDEAD_CARDS = Object.freeze({
  // ── zombies: the body kept, and wrong ──
  shambler: { form: 'flesh', build: 'canonical', gait: 'shamble', reads: 'the dead walking: wasted, hunched, the arms out before it, the head hung and cocked', waste: { limbs: 0.78, trunk: 0.86 }, arms: { length: 1.04, reach: 0.75 }, lean: 16, head: { drop: 0.35, tilt: 0.4 }, jaw: 14, crouch: 0.12, loss: { odds: 0.35, parts: ['foreArm', 'hand'] }, shreds: { chest: 0.7, back: 0.6, hips: 0.7, arms: 0.6, length: 0.9 }, bared: { count: [2, 4], parts: ['halfForeArm', 'halfUpperArm', 'foreArm', 'ribs', 'halfShin', 'shin', 'halfThigh', 'skull'] }, armed: { right: { type: 'equipment', item: 'dagger', style: 'brutal' } }, adorned: { helm: 0.3, cuirass: 0.35, pauldron: 0.3, bracers: 0.2, greaves: 0.2 }, spots: { count: [6, 10], deep: 0.35, face: [2, 4] } },
  gaunt: { form: 'flesh', build: 'lithe', gait: 'creep', reads: 'starved past death: thin to the bone, long-armed, folded forward', waste: { limbs: 0.6, trunk: 0.7 }, arms: { length: 1.12, reach: 0.35 }, lean: 26, head: { drop: 0.55, tilt: -0.2 }, jaw: 20, crouch: 0.2, loss: { odds: 0.2, parts: ['hand'] }, shreds: { chest: 0.5, back: 0.6, hips: 0.5, arms: 0.5, length: 1.2 }, bared: { count: [3, 5], parts: ['arm', 'halfForeArm', 'halfUpperArm', 'ribs', 'halfShin', 'shin', 'halfThigh', 'thigh', 'skull'] }, armed: { right: { type: 'equipment', item: 'staff', style: 'brutal' } }, adorned: { helm: 0.25, pauldron: 0.4, bracers: 0.3 }, spots: { count: [8, 12], deep: 0.45, face: [3, 4] } },
  bloated: { form: 'flesh', build: 'stout', gait: 'waddle', reads: 'swollen with rot: a great belly and trunk on thin arms, leaning back on its heels', waste: { limbs: 0.85, trunk: 1 }, bloat: { trunk: 1.32, gut: 0.16, limbs: 1 }, arms: { length: 0.98, reach: 0.15 }, lean: -6, head: { drop: 0.15, tilt: 0.25 }, jaw: 10, crouch: 0.05, shreds: { chest: 0.4, back: 0.4, hips: 0.6, arms: 0.3, length: 0.7 }, bared: { count: [2, 3], parts: ['halfForeArm', 'foreArm', 'halfShin', 'shin', 'ribs'] }, armed: { right: { type: 'equipment', item: 'dagger', style: 'historical' } }, adorned: { helm: 0.4, pauldron: 0.3, greaves: 0.3 }, spots: { count: [7, 11], deep: 0.25, face: [2, 3] } },
  hulk: { form: 'flesh', build: 'brute', gait: 'drag', reads: 'a giant\'s corpse: one arm swollen to a club, the other withered, bent double', waste: { limbs: 0.9, trunk: 0.95 }, heavy: { side: 'R', k: 1.55 }, arms: { length: 1.1, reach: 0.2 }, lean: 28, head: { drop: 0.45, tilt: 0.3 }, jaw: 16, crouch: 0.22, shreds: { chest: 0.3, back: 0.5, hips: 0.8, arms: 0.2, length: 0.9 }, bared: { count: [2, 3], parts: ['halfForeArm', 'foreArm', 'halfThigh', 'thigh', 'ribs', 'skull'] }, armed: { right: { type: 'equipment', item: 'staff', style: 'brutal' } }, adorned: { helm: 0.5, pauldron: 0.8, bracers: 0.6 }, spots: { count: [6, 9], deep: 0.3, face: [2, 3] } },
  fresh: { form: 'flesh', build: 'heroic', gait: 'stumble', reads: 'newly risen: the body nearly whole, the head cocked and the arms beginning to rise', waste: { limbs: 0.94, trunk: 0.95 }, arms: { length: 1, reach: 0.5 }, lean: 7, head: { drop: 0.15, tilt: 0.55 }, jaw: 8, crouch: 0.06, shreds: { chest: 0.9, back: 0.9, hips: 0.8, arms: 0.8, length: 1 }, bared: { count: [1, 2], parts: ['halfForeArm', 'halfShin', 'ribs'] }, armed: { right: { type: 'equipment', item: 'sword', style: 'historical' } }, adorned: { helm: 0.6, cuirass: 0.7, pauldron: 0.5, bracers: 0.5, greaves: 0.4 }, spots: { count: [3, 5], deep: 0.15, face: [1, 2] } },
  // ── skeletons: the body gone to its frame ──
  soldier: { form: 'bone', build: 'canonical', gait: 'march', reads: 'a skeleton standing as the soldier it was', bones: { shaft: 1, ends: 1, ribs: 1 }, arms: { length: 1, reach: 0.1 }, lean: 3, head: { drop: 0.05, tilt: 0 }, jaw: 10, crouch: 0.05, loss: { odds: 0.25, parts: ['foreArm', 'hand'] }, shreds: { chest: 0.55, back: 0.5, hips: 0.75, arms: 0.35, length: 1 }, decay: { open: 0.5, limbs: 0.6, neck: 0.6, scalp: 0.5 }, armed: { right: { type: 'equipment', item: 'sword', style: 'historical' }, left: { type: 'equipment', item: 'shield', style: 'historical' } }, adorned: { helm: 0.85, cuirass: 0.75, pauldron: 0.6, bracers: 0.45, greaves: 0.35 } },
  slender: { form: 'bone', build: 'lithe', gait: 'clatter', reads: 'a long, thin skeleton, its bones like reeds', bones: { shaft: 0.78, ends: 0.85, ribs: 0.85 }, arms: { length: 1.08, reach: 0.05 }, lean: 6, head: { drop: 0.1, tilt: 0.15 }, jaw: 13, crouch: 0.04, shreds: { chest: 0.35, back: 0.7, hips: 0.45, arms: 0.6, length: 1.35 }, decay: { open: 0.7, limbs: 0.45, neck: 0.5, scalp: 0.4 }, armed: { left: { type: 'equipment', item: 'bow', style: 'historical' } }, adorned: { helm: 0.6, bracers: 0.6, greaves: 0.3 } },
  squat: { form: 'bone', build: 'stout', gait: 'trundle', reads: 'a short heavy skeleton, broad in the pelvis and the ribs', bones: { shaft: 1.25, ends: 1.3, ribs: 1.2 }, arms: { length: 0.95, reach: 0.05 }, lean: 4, head: { drop: 0.05, tilt: 0 }, jaw: 8, crouch: 0.1, shreds: { chest: 0, back: 0.25, hips: 0.95, arms: 0, length: 0.8 }, decay: { open: 0.3, limbs: 0.75, neck: 0.7, scalp: 0.6 }, armed: { right: { type: 'equipment', item: 'staff', style: 'dwarven' }, left: { type: 'equipment', item: 'shield', style: 'dwarven' } }, adorned: { helm: 0.8, cuirass: 0.85, greaves: 0.6 } },
  giant: { form: 'bone', build: 'brute', gait: 'lumber', reads: 'a giant\'s skeleton: thick bones, a great skull, hunched under its own weight', bones: { shaft: 1.5, ends: 1.6, ribs: 1.35 }, arms: { length: 1.08, reach: 0.15 }, lean: 18, head: { drop: 0.25, tilt: 0 }, jaw: 15, crouch: 0.15, shreds: { chest: 0.3, back: 0.3, hips: 0.9, arms: 0.5, length: 1.1 }, decay: { open: 0.35, limbs: 0.7, neck: 0.7, scalp: 0.5 }, armed: { right: { type: 'equipment', item: 'staff', style: 'brutal' } }, adorned: { helm: 0.6, pauldron: 0.85, bracers: 0.6 } },
  knight: { form: 'bone', build: 'heroic', gait: 'march', reads: 'a broad, upright skeleton, standing as a captain stood', bones: { shaft: 1.1, ends: 1.15, ribs: 1.1 }, arms: { length: 1, reach: 0.05 }, lean: -2, head: { drop: 0, tilt: 0 }, jaw: 6, crouch: 0.02, shreds: { chest: 0.75, back: 0.85, hips: 0.85, arms: 0.2, length: 1.3 }, decay: { open: 0.45, limbs: 0.5, neck: 0.6, scalp: 0.7 }, armed: { right: { type: 'equipment', item: 'greatsword', style: 'historical' } }, adorned: { helm: 0.95, cuirass: 1, pauldrons: 0.95, bracers: 0.85, greaves: 0.85 } },
});

/** the layers a lineage can lay over a form's card, and what each does */
export const UNDEAD_LAYERS = Object.freeze({
  bared: 'a gaunt corpse with parts gone back to bone: its skull, an arm or a forearm, a thigh or a shin, one side\'s ribs through the chest (./bared.js; over flesh only)',
  decayed: 'gaunt rotted flesh back on the bone: the ribs through a shrunken chest rotted open, sinew on the limbs, a throat, a scalp (./decay.js; over bone only)',
  attack: 'the attack skeleton: every long bone a column of ridged segments as the spine is (the forearm\'s and the shin\'s two side by side), clawed fingers, standing to strike (./hero-bones.js; over bone only)',
  adorned: 'what is left of its armour, sized to the body it was made for: a helm, a cuirass, pauldrons, bracers, greaves (./armour.js)',
  armed: 'its weapons in its hands: the card\'s sword and shield, greatsword, club, bow or dagger, as the hero\'s gear',
  spots: 'its flesh gone in patches as a cow\'s spots are: meat where the skin went, bone in the deep ones, bone through the face or flesh left on the skull (./spots.js; over flesh only)',
  shreds: 'its clothes in rags: torn strips from the shoulders, the hips and the arms (./shreds.js)',
});

/** the forms and their variations, by the build that rolls each */
export const UNDEAD_FORMS = Object.freeze({
  zombie: { form: 'flesh', variants: ['shambler', 'gaunt', 'bloated', 'hulk', 'fresh'] },
  skeleton: { form: 'bone', variants: ['soldier', 'slender', 'squat', 'giant', 'knight'] },
});
