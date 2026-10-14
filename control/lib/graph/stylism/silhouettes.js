/**
 * silhouettes.js — the NAMED SILHOUETTES: a character type's outline and the SIGNATURE techniques that make it read at a
 * thumbnail (silhouette.js TECHNIQUES lowers each). `stylism.silhouette` takes one of these as it takes an outline
 * letter; any cast may wear any of them. The register sizes each signature; `from` / `until` gate one by it.
 *
 *   outline   the fashion letter the WHOLE figure reads as (silhouette.js OUTLINES), checked by the read: a short full
 *             skirt over bare legs is an O (the width at the hips), not the A a longer one makes
 *   moves     its signature, in the order a designer draws them: [{ technique, from?, until? }]
 *   base      the outfit card worn under it when the hero names none (else the genre's)
 *   reads     a line for the notes: what the type is
 * A technique marked ◐ in its note is a stand-in until its own lands (collar shapes, pleats, slits, puff sleeves, frills);
 * the notes say so. A new silhouette is a card here, never code.
 */
export const NAMED = Object.freeze({
  operative: { outline: 'needle', base: 'athlete', reads: 'the spy, the operative: sleek and functional',
    moves: [{ technique: 'secondSkin' }, { technique: 'fittedCoat', from: 0.35 }, { technique: 'utilityBelt' }, { technique: 'tallBoots' }, { technique: 'highCollar', from: 0.7 }] },
  ribbon: { outline: 'barrel', base: 'blouse', reads: 'ribbons and streamers: everything that trails moves',
    moves: [{ technique: 'shortFullDress' }, { technique: 'bows' }, { technique: 'puffShoulders', from: 1 }] },
  sailor: { outline: 'bell', base: 'blouse', reads: 'the sailor uniform: a square collar, a bow, a pleated skirt',
    moves: [{ technique: 'sailorCollar' }, { technique: 'neckerchief' }, { technique: 'pleatedSkirt' }] },
  princess: { outline: 'hourglass', base: 'blouse', reads: 'the princess: a cinched bodice over a full gown',
    moves: [{ technique: 'puffShoulders' }, { technique: 'cinchedBodice' }, { technique: 'fullLongSkirt' }, { technique: 'bows', from: 0.7 }] },
  valkyrie: { outline: 'hourglass', base: 'traveler', reads: 'the battle maiden: armoured shoulders, a cinched waist, a full skirt of panels',
    moves: [{ technique: 'pauldrons' }, { technique: 'chestPlate', from: 0.35 }, { technique: 'cinchedBodice' }, { technique: 'kneeFullSkirt' }, { technique: 'tallBoots' }] },
  miko: { outline: 'bell', base: 'blouse', reads: 'the shrine maiden: wide sleeves over a hakama',
    moves: [{ technique: 'wideSleevedTop' }, { technique: 'hakama' }, { technique: 'neckerchief', from: 0.7 }] },
  qipao: { outline: 'needle', base: 'blouse', reads: 'the qipao: one fitted line from collar to ankle',
    moves: [{ technique: 'ankleDress' }, { technique: 'mandarinCollar' }] },
  lolita: { outline: 'hourglass', base: 'blouse', reads: 'the lolita dress: a full knee skirt, bows, a doll\'s proportions',
    moves: [{ technique: 'kneeFullSkirt' }, { technique: 'bows' }, { technique: 'puffShoulders' }] },
  idol: { outline: 'barrel', base: 'blouse', reads: 'the idol: a short full skirt and ribbons, made to move on a stage',
    moves: [{ technique: 'shortFullDress' }, { technique: 'bows' }, { technique: 'tallBoots' }] },
  kunoichi: { outline: 'needle', base: 'athlete', reads: 'the kunoichi: close, quiet, one long scarf for motion',
    moves: [{ technique: 'secondSkin' }, { technique: 'scarf' }, { technique: 'wraps' }] },
  knight: { outline: 'wedge', base: 'adventurer', reads: 'the knight: broad armoured shoulders over a tabard',
    moves: [{ technique: 'pauldrons' }, { technique: 'chestPlate' }, { technique: 'tabard' }, { technique: 'closeLegs' }] },
  samurai: { outline: 'wedge', base: 'adventurer', reads: 'the samurai: broad shoulders over wide falling trousers',
    moves: [{ technique: 'shoulderPlates' }, { technique: 'wideTrousers' }, { technique: 'sash' }] },
  gunslinger: { outline: 'bell', base: 'adventurer', reads: 'the gunslinger: a long duster swinging behind',
    moves: [{ technique: 'duster' }, { technique: 'utilityBelt' }, { technique: 'tallBoots' }] },
  monk: { outline: 'column', base: 'traveler', reads: 'the monk: one even robe under a cloak, a sash',
    moves: [{ technique: 'straightRobe' }, { technique: 'straightCloak' }, { technique: 'sash' }] },
  rogue: { outline: 'column', base: 'traveler', reads: 'the rogue: close-fitted under a narrow hooded cloak',
    moves: [{ technique: 'closeFit' }, { technique: 'hoodedCloak' }] },
  brawler: { outline: 'wedge', base: 'athlete', reads: 'the brawler: the arms bare, one armoured shoulder leading',
    moves: [{ technique: 'sleeveless' }, { technique: 'spaulder' }, { technique: 'wraps' }, { technique: 'closeLegs' }] },
});
export const NAMED_SILHOUETTES = Object.freeze(Object.keys(NAMED));
