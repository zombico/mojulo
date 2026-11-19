/**
 * THE BOSSES: robots of the hero's own family whose faces are never a person's. The side scroller's hero robot is the one
 * with an open face (sketch-vocab/reploid.md: the face its identity centre, a window in its helm); a boss's identity is
 * its THEME, and its face one expression of it. The early bosses of a run and gun stand close to the hero (its body, a
 * themed helm); the later ones drift (the face covered, mechanical, an animal's or an object; the body swollen or changed).
 *
 *   HELD (the family)   the hero's body and its toy suit (game-bodies.js `herobot`, armor/toy.js): cylinder-cone honesty,
 *                       sphere joints, the barrel chest, the big head, armour white (`Cuff`) and frame graphite
 *   MOVED               the FACE (BOSS_FACES, a ladder from the hero: a mask, a visor, a grille … an object head), the
 *                       BUILD (the hero door's builds: a brute stands broader), the identity HUE (`hue`: its chest, its
 *                       plaques; the side map's boss-colour law's), its armour
 *   EYES, ALWAYS        every face has its eyes in the SIGNAL group (one or two points of light): the gaze is the aim, and
 *                       the signal is the TELL, what lights as it winds up an attack
 *
 * A face is the helm signature's words (polygonizer/station-loft-adorn.js `helm`) over the hero's helm with its window
 * shut: no face shows. An object head is its own shape and its own pieces (a crucible: a tapered bowl, a lip, a molten
 * pool over its rim).
 *
 *   BOSS_FACES      { <face>: { reads, helm } }
 *   BOSSES          { <id>: { name, theme, face, build, tier, class, armor, hue, signal, tell, weapon } }   the roster
 *   the spec a boss is made from: ./boss-spec.js (bossHelm, bossSpec, bossFaceFaults)
 *
 * Data only, import-free: the map's dress reads a boss's hue here (side-map/dress.js).
 */

/** The signal group: a boss's eyes, its visor, its glow (the tell). */
export const SIGNAL = 'Signal';

/**
 * THE FACES, nearest the hero first. Each the helm's words over the hero's helm with its window shut; its eyes the signal.
 */
export const BOSS_FACES = Object.freeze({
  // a closed helm, two slits for eyes: the uncanny rival, the hero's own head with its face put away
  mask: { reads: 'a closed helm, two eye slits lit: the hero\'s head with its face put away', helm: { visor: 'slits', visorGroup: SIGNAL } },
  // the face window shut by a band across the eyes, lit behind: it fills as the boss winds up
  visor: { reads: 'a closed helm, a band visor across the eyes lit behind it', helm: { visor: 'band', visorGroup: SIGNAL } },
  // a dark faceplate, two lit eyes over a vented mouth: it breathes the attack out
  grille: { reads: 'a dark faceplate, two lit eyes, a grille of vents for a mouth', helm: { visor: 'lenses', visorGroup: SIGNAL, faceplate: 'Face', grille: 4, grilleGroup: 'Cuff' } },
  // an OBJECT HEAD: a crucible, a bowl tapering to the neck, flat across its top, a white lip round its rim and the molten
  // metal domed over it (seen side on); two lit eyes on the bowl
  crucible: { reads: 'the head a crucible: a tapered bowl, a lip round its rim, molten metal domed over it, two lit eyes', helm: { crown: 0.05, flare: -0.55, n: 2.2, scale: 1.35, visor: 'lenses', visorGroup: SIGNAL, lens: 0.03, lip: { group: 'Cuff', t: 0.016 }, pool: { group: SIGNAL, rise: 0.03 } } },
});
export const BOSS_FACE_IDS = Object.freeze(Object.keys(BOSS_FACES));

/**
 * THE ROSTER (built so far). `class` the foe shelf's (how it moves and attacks; its rank the boss's), `tier` its height a
 * share of the hero's (1 a rival, 1.25 a brute, 2 a giant), `armor` the suit's own, `hue` its identity (the chest's plaques and pecs; the side map's
 * boss-colour, which takes its place in a level that holds one back: boss-spec.js), `signal` its eyes' glow; `tell` what the face does as it winds up, `weapon` what its defeat gives the hero.
 */
export const BOSSES = Object.freeze({
  // (a lobber, the foe shelf's: it keeps its place and lobs at where the hero stood)
  crucible: { name: 'Crucible', theme: 'foundry', face: 'crucible', build: 'brute', tier: 1.25, class: 'lobber', armor: '#4f545b', hue: '#e0661a', signal: '#ffb020', tell: 'the bowl tips, its metal brightening', weapon: 'a lobbed molten arc' },
});
export const BOSS_IDS = Object.freeze(Object.keys(BOSSES));
