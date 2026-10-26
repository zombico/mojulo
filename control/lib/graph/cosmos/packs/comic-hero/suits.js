/**
 * THE COMIC HERO PACK'S SUITS: what a comic hero wears, built from the hero door's own words (solid-vocab/layered.md:
 * `paint` for the bodysuit, an `outfit` build with its designed `pieces` and a chest emblem worked in thread, an armour `adorn`), and
 * resolved per BODY, because the two bodies dress differently: the tiered body takes paint, detail and armour kits on
 * its rings; the realistic body takes the tailor's outfit and the plating suits and refuses paint, detail and `girth`
 * (mcp/tools/layered.js realisticErrors). A suit is a card: a new look is a row here.
 *
 *   SUITS                { <id>: { reads, palette, at: { tiered: fragment, realistic: fragment } } }
 *   suitOf(id, body)     → { palette, ...fragment } the spec fragment for that body, or throws naming the known ids
 *   SUIT_KEYS            the spec keys a suit may write, so the compiler knows what to clear from a sheet's plan
 */
export const SUIT_KEYS = Object.freeze(['paint', 'outfit', 'adorn', 'detail']);

// the hero's primaries: a red suit, blue trunks and boots, a gold emblem and belt
// (a designed piece is coloured by its role: a cloak is `secondary`, outfit-plan.js COLOUR_GROUPS → OutfitSecond)
const PRIMARIES = Object.freeze({ Top: '#c62828', Bottom: '#1a237e', Shoes: '#1a237e', Gloves: '#1a237e', Trim: '#ffd400', OutfitBase: '#c62828', OutfitSecond: '#c62828', OutfitTrim: '#ffd400', OutfitAccent: '#ffd400' });
// the emblem: a motif worked on the chest of the suit's top (outfit/expand.js embroidery, role chest), not a field paint
// on the body's skin, which the suit covers. The closed motifs (diamond, chevron) read at a glance; the star is three
// strokes (station-loft-adorn.js MOTIFS: an asterisk) and reads as stitches, so the classic suit wears the diamond
const EMBLEM = (motif) => [{ prim: 'embroidery', role: 'chest', motif }];
const CAPE = (over = {}) => ({ kind: 'cloak', wrap: 0.55, hem: 'calf', flare: 0.16, rigidity: 'soft', ...over });
// the bodysuit as cloth: a knit top with long sleeves and a knit bottom with long skinny legs, skin-fit, so both bodies
// wear it (the layered one also takes the catsuit paint under it)
const BODYSUIT = { fit: 'skin', feet: 'boots', top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'knit', leg: 'long', cut: 'skinny' } };
const SKIN_SUIT = (style, pieces, motif, dials = {}) => ({ type: 'outfit', style, dials: { fit: 1, stylize: 0.7, coverage: 0.95, ornament: 1, ...dials }, language: BODYSUIT, pieces, ...(motif ? { detail: EMBLEM(motif) } : {}) });

export const SUITS = Object.freeze({
  classic: {
    reads: 'the classic suit: a bodysuit in two primaries, a cape from the shoulders, a gold chest emblem, a belt, boots and gloves',
    palette: PRIMARIES,
    at: {
      tiered: { paint: ['catsuit', 'gloves'], outfit: SKIN_SUIT('athlete', [CAPE(), { kind: 'belt', at: 'waist' }], 'diamond') },
      realistic: { outfit: SKIN_SUIT('athlete', [CAPE(), { kind: 'belt', at: 'waist' }], 'diamond') },
    },
  },
  street: {
    reads: 'the street suit: a hooded half-cape over streetwear, fighting gloves, no emblem; the vigilante and the sidekick',
    palette: { Top: '#263238', Bottom: '#1c2024', Shoes: '#111315', Gloves: '#111315', Trim: '#e53935', OutfitBase: '#263238', OutfitSecond: '#37474f', OutfitTrim: '#e53935' },
    at: {
      tiered: { paint: ['gloves'], outfit: { type: 'outfit', style: 'streetwear', dials: { fit: 0.7, stylize: 0.6, coverage: 0.9, ornament: 1 }, language: { feet: 'boots' }, pieces: [CAPE({ hood: true, wrap: 0.5, hem: 'hip' }), { kind: 'belt', at: 'waist' }] } },
      realistic: { outfit: { type: 'outfit', style: 'streetwear', dials: { fit: 0.7, stylize: 0.6, coverage: 0.9, ornament: 1 }, language: { feet: 'boots' }, pieces: [CAPE({ hood: true, wrap: 0.5, hem: 'hip' }), { kind: 'belt', at: 'waist' }] } },
    },
  },
  sleek: {
    reads: 'the sleek suit: a bodysuit with a chevron on the chest and no cape; the rival, the flier',
    palette: { Top: '#1a237e', Bottom: '#0d1442', Shoes: '#0d1442', Gloves: '#0d1442', Trim: '#c62828', OutfitBase: '#1a237e', OutfitSecond: '#0d1442', OutfitTrim: '#c62828' },
    at: {
      tiered: { paint: ['catsuit', 'gloves'], outfit: SKIN_SUIT('athlete', [{ kind: 'bracers' }], 'chevron', { ornament: 0 }) },
      realistic: { outfit: SKIN_SUIT('athlete', [{ kind: 'bracers' }], 'chevron', { ornament: 0 }) },
    },
  },
  armored: {
    reads: 'the armoured suit: the armored-hero hardsuit, a faceplate helm, a reactor chest; the mastermind in his shell',
    palette: { Plate: '#37474f', Helm: '#263238', Visor: '#e53935', Lens: '#e53935', Reactor: '#e53935', Suit: '#1c2024', Trim: '#b0bec5' },
    at: {
      tiered: { adorn: { type: 'armor', style: 'armored-hero', dials: { stylize: 0.6, coverage: 0.85, mass: 0.6, ornament: 1 } } },
      realistic: { adorn: { type: 'armor', style: 'armored-hero', dials: { stylize: 0.6, coverage: 0.85, mass: 0.6, ornament: 1 } } },
    },
  },
  thug: {
    reads: 'the street coat: biker leathers, no symbol; the brute and the thug',
    palette: { Top: '#2b2b2b', Bottom: '#1f1f1f', Shoes: '#141414', Leather: '#2b2b2b', Trim: '#5d4037' },
    at: {
      tiered: { outfit: { type: 'outfit', style: 'biker', dials: { fit: 0.6, stylize: 0.5, coverage: 0.9, ornament: 0 }, language: { feet: 'boots' } } },
      realistic: { outfit: { type: 'outfit', style: 'biker', dials: { fit: 0.6, stylize: 0.5, coverage: 0.9, ornament: 0 }, language: { feet: 'boots' } } },
    },
  },
});

export function suitOf(id, body) {
  const S = SUITS[id];
  if (!S) throw new Error(`comic-hero: no suit '${id}' (known: ${Object.keys(SUITS).join(', ')})`);
  if (!S.at[body]) throw new Error(`comic-hero: suit '${id}' has no fragment for body '${body}' (tiered, realistic)`);
  return { palette: S.palette, ...S.at[body] };
}
