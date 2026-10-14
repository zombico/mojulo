/**
 * genres.js — a GENRE is a VOCABULARY CARD: what a character designer in that genre reaches for to make each big shape,
 * and the materials and motifs its detail is drawn in. The stylism solvers (index.js) choose by principle; a genre only
 * says which words that principle is spoken in. A new genre is a card here, never code.
 *
 *   base       the outfit card a hero starts from when it names none (`style`, with an own `language` over it)
 *   moves      per target outline (silhouette.js OUTLINES), the big masses that make it, in order: each a TECHNIQUE
 *              (silhouette.js TECHNIQUES lowers it to outfit language and catalogue pieces) and, when it depends on the
 *              register, `from` (the least register it is reached for) or `until` (the most)
 *   materials  what its metal and cloth are (the detail and surface phases spend these): `plate` what its armour is,
 *              `fitting` its buckles and trims plain to precious (the register chooses), `strap` its belts and straps —
 *              materials keep their own colour, outside the palette (value.js)
 *   motifs     the embroidery / panel motif families it draws in (station-loft-adorn.js MOTIFS)
 *   fittings   per detail zone (detail.js DETAIL_ZONES), the catalogue's fittings it draws that zone's detail with, when
 *              the cloth there is covered or the budget reaches past the cloth; `metalFittings` the ones that are metal
 *   warp       how its heightening exaggerates (index.js WARP): `chunk` (rigid pieces thicken by, at mythic), `flare` (cloth
 *              flares and streamers lengthen by)
 *   register   the two ends of its heightening, named by the works that stand at them (for the notes)
 *   detached   true: masses standing apart from the body are this genre's language (its plates hover, the outline may
 *              break into islands); every other genre keeps the outline ONE shape (silhouette.js `cohesive`)
 */
export const GENRES = Object.freeze({
  fantasy: Object.freeze({
    base: { style: 'traveler' },
    moves: {
      wedge: [{ technique: 'mantle', until: 0.35 }, { technique: 'pauldrons', from: 0.35 }, { technique: 'closeLegs' }],
      bell: [{ technique: 'robe' }, { technique: 'cloak', from: 0.35 }],
      column: [{ technique: 'straightRobe' }, { technique: 'straightCloak' }],
      needle: [{ technique: 'closeFit' }],
      barrel: [{ technique: 'gambeson' }, { technique: 'tassets' }, { technique: 'sash' }],
      hourglass: [{ technique: 'mantle', until: 0.35 }, { technique: 'pauldrons', from: 0.35 }, { technique: 'cinchedBodice' }, { technique: 'longSkirt' }],
    },
    materials: { metal: ['brass', 'iron', 'gold'], cloth: ['linen', 'wool', 'leather'], plate: 'iron', fitting: ['iron', 'brass', 'gold'], strap: 'leather' },
    motifs: ['vine', 'knot', 'key', 'wave'],
    fittings: { neck: ['torc', 'medallion'], chest: ['medallion', 'chain'], waist: ['sash'], arms: ['armRings'], wrists: ['bracers', 'wraps'], hem: ['anklets'] },
    metalFittings: ['armRings', 'torc', 'anklets'],
    warp: { chunk: 1.7, flare: 1.4 },
    register: { grounded: "Frieren's cast", mythic: 'Warcraft' },
  }),
  modern: Object.freeze({
    base: { style: 'casual' },
    moves: {
      wedge: [{ technique: 'boxyJacket' }, { technique: 'shoulderPads' }, { technique: 'closeLegs' }],
      bell: [{ technique: 'longCoat' }],
      column: [{ technique: 'straightCoat' }],
      needle: [{ technique: 'closeFit' }],
      barrel: [{ technique: 'parka' }, { technique: 'oversizedTop' }],
      hourglass: [{ technique: 'shoulderPads' }, { technique: 'cinchedBodice' }, { technique: 'kneeFullSkirt' }],
    },
    materials: { metal: ['zinc', 'steel', 'brass'], cloth: ['cotton', 'denim', 'nylon', 'rubber'], plate: 'steel', fitting: ['zinc', 'steel', 'brass'], strap: 'leather' },
    motifs: ['dots', 'chevron', 'wave'],
    fittings: { neck: ['chain'], chest: ['chain'], waist: ['sash'], arms: ['armRings'], wrists: ['wraps'], hem: ['anklets'] },
    metalFittings: ['armRings', 'chain'],
    warp: { chunk: 1.3, flare: 1.5 },
    register: { grounded: 'a slice-of-life cast', mythic: 'JoJo' },
  }),
  scifi: Object.freeze({
    base: { style: 'athlete', language: { top: { family: 'knit', sleeve: 'long', hem: 'hip', fit: 'skin' }, bottom: { family: 'knit', leg: 'long', fit: 'skin' }, feet: 'boots' } },
    moves: {
      wedge: [{ technique: 'shoulderPlates' }, { technique: 'collarRing', from: 0.35 }],
      bell: [{ technique: 'longCoat' }],
      column: [{ technique: 'straightCoat' }, { technique: 'collarRing', from: 0.35 }],
      needle: [{ technique: 'closeFit' }, { technique: 'collarRing' }],
      barrel: [{ technique: 'parka' }, { technique: 'tassets' }, { technique: 'harness' }],
      hourglass: [{ technique: 'shoulderPlates' }, { technique: 'cinchedBodice' }, { technique: 'longSkirt' }],
    },
    materials: { metal: ['anodised alloy', 'chrome', 'gunmetal'], cloth: ['polymer', 'carbon weave', 'ballistic nylon'], plate: 'gunmetal', fitting: ['gunmetal', 'anodised alloy', 'chrome'], strap: 'ballistic nylon' },
    motifs: ['chevron', 'diamond', 'dots'],
    fittings: { neck: ['torc', 'medallion'], chest: ['harness', 'medallion'], waist: ['harness', 'sash'], arms: ['armRings'], wrists: ['bracers'], hem: ['anklets'] },
    metalFittings: ['torc', 'armRings'],
    warp: { chunk: 1.8, flare: 1.2 },
    register: { grounded: 'The Expanse', mythic: 'Warhammer 40,000' },
  }),
  alien: Object.freeze({
    base: { style: 'athlete', language: { top: { family: 'knit', sleeve: 'long', hem: 'hip', fit: 'skin' }, bottom: { family: 'knit', leg: 'long', fit: 'skin' } } },
    moves: {
      wedge: [{ technique: 'pauldrons' }, { technique: 'closeFit' }],
      bell: [{ technique: 'robe' }, { technique: 'collarRing', from: 0.35 }],
      column: [{ technique: 'straightRobe' }, { technique: 'straightCloak' }],
      needle: [{ technique: 'closeFit' }, { technique: 'collarRing' }],
      barrel: [{ technique: 'parka' }, { technique: 'tassets' }, { technique: 'harness' }],
      hourglass: [{ technique: 'pauldrons' }, { technique: 'cinchedBodice' }, { technique: 'longSkirt' }],
    },
    materials: { metal: ['nacre', 'chitin', 'iridescent alloy'], cloth: ['membrane', 'spun filament', 'resin weave'], plate: 'chitin', fitting: ['chitin', 'iridescent alloy', 'nacre'], strap: 'resin weave' },
    motifs: ['wave', 'diamond', 'dots'],
    fittings: { neck: ['torc', 'medallion'], chest: ['medallion'], waist: ['sash'], arms: ['armRings'], wrists: ['wraps'], hem: ['anklets'] },
    metalFittings: ['torc', 'armRings', 'anklets'],
    warp: { chunk: 1.4, flare: 1.6 },
    register: { grounded: 'Arrival', mythic: "Evangelion's Angels" },
    detached: true,
  }),
});
export const GENRE_NAMES = Object.freeze(Object.keys(GENRES));
