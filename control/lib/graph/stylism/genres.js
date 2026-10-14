/**
 * genres.js — a GENRE is a VOCABULARY CARD: what a character designer in that genre reaches for to make each big shape,
 * and the materials and motifs its detail is drawn in. The stylism solvers (index.js) choose by principle; a genre only
 * says which words that principle is spoken in. A new genre is a card here, never code.
 *
 *   base       the outfit card a hero starts from when it names none (`style`, with an own `language` over it)
 *   moves      per target outline (silhouette.js OUTLINES), the big masses that make it, in order: each a TECHNIQUE
 *              (silhouette.js TECHNIQUES lowers it to outfit language and catalogue pieces) and, when it depends on the
 *              register, `from` (the least register it is reached for) or `until` (the most)
 *   materials  what its metal and cloth are (the detail and surface phases spend these)
 *   motifs     the embroidery / panel motif families it draws in (station-loft-adorn.js MOTIFS)
 *   register   the two ends of its heightening, named by the works that stand at them (for the notes)
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
      hourglass: [{ technique: 'mantle', until: 0.35 }, { technique: 'pauldrons', from: 0.35 }, { technique: 'cinchedBodice' }, { technique: 'fullLongSkirt' }],
    },
    materials: { metal: ['brass', 'iron', 'gold'], cloth: ['linen', 'wool', 'leather'] },
    motifs: ['vine', 'knot', 'key', 'wave'],
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
    materials: { metal: ['zinc', 'steel', 'brass'], cloth: ['cotton', 'denim', 'nylon', 'rubber'] },
    motifs: ['dots', 'chevron', 'wave'],
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
      hourglass: [{ technique: 'shoulderPlates' }, { technique: 'cinchedBodice' }, { technique: 'longCoat' }],
    },
    materials: { metal: ['anodised alloy', 'chrome', 'gunmetal'], cloth: ['polymer', 'carbon weave', 'ballistic nylon'] },
    motifs: ['chevron', 'diamond', 'dots'],
    register: { grounded: 'The Expanse', mythic: 'Warhammer 40,000' },
  }),
});
export const GENRE_NAMES = Object.freeze(Object.keys(GENRES));
