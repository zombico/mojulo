/**
 * THE COMIC HERO PACK'S SUITS: what a comic hero wears, built from the hero door's own words (solid-vocab/layered.md:
 * `paint` for the bodysuit, an `outfit` build with its designed `pieces`, a field-painted emblem, an armour `adorn`), and
 * resolved per POLE, because the two bodies dress differently: the layered body (`banded`) takes paint, detail and
 * armour kits on its rings; the realistic body (`material`) takes the tailor's outfit and the plating suits and refuses
 * paint, detail and `girth` (mcp/tools/layered.js realisticErrors). A suit is a card: a new look is a row here.
 *
 *   SUITS                { <id>: { reads, palette, at: { banded: fragment, material: fragment } } }
 *   suitOf(id, pole)     → { palette, ...fragment } the spec fragment for that pole, or throws naming the known ids
 *   SUIT_KEYS            the spec keys a suit may write, so the compiler knows what to clear from a sheet's plan
 */
export const SUIT_KEYS = Object.freeze(['paint', 'outfit', 'adorn', 'detail', 'fieldPaint']);

// the hero's primaries: a red suit, blue trunks and boots, a gold emblem and belt
const PRIMARIES = Object.freeze({ Top: '#c62828', Bottom: '#1a237e', Shoes: '#1a237e', Gloves: '#1a237e', Trim: '#ffd400', Emblem: '#ffd400', Outer: '#c62828' });
const EMBLEM = (shape) => [{ part: 'torso', chart: 'front', shape, group: 'Emblem', color: '#ffd400' }];
const CAPE = (over = {}) => ({ kind: 'cloak', wrap: 0.55, hem: 'calf', flare: 0.16, rigidity: 'soft', trim: { chest: 'emblem' }, ...over });
const SKIN_SUIT = (style, pieces, dials = {}) => ({ type: 'outfit', style, dials: { fit: 1, stylize: 0.7, coverage: 0.95, ornament: 1, ...dials }, language: { fit: 'skin', feet: 'boots' }, pieces });

export const SUITS = Object.freeze({
  classic: {
    reads: 'the classic suit: a bodysuit in two primaries, a cape from the shoulders, a chest emblem, a belt, boots and gloves',
    palette: PRIMARIES,
    at: {
      banded: { paint: ['catsuit', 'gloves'], outfit: SKIN_SUIT('athlete', [CAPE(), { kind: 'belt' }]), fieldPaint: EMBLEM('star') },
      material: { outfit: SKIN_SUIT('athlete', [CAPE(), { kind: 'belt' }]), fieldPaint: EMBLEM('star') },
    },
  },
  street: {
    reads: 'the street suit: a hooded half-cape over streetwear, fighting gloves, no emblem; the vigilante and the sidekick',
    palette: { Top: '#263238', Bottom: '#1c2024', Shoes: '#111315', Gloves: '#111315', Trim: '#e53935', Outer: '#37474f' },
    at: {
      banded: { paint: ['gloves'], outfit: { type: 'outfit', style: 'streetwear', dials: { fit: 0.7, stylize: 0.6, coverage: 0.9, ornament: 1 }, language: { feet: 'boots' }, pieces: [CAPE({ hood: true, wrap: 0.5, hem: 'hip', trim: undefined }), { kind: 'belt' }] } },
      material: { outfit: { type: 'outfit', style: 'streetwear', dials: { fit: 0.7, stylize: 0.6, coverage: 0.9, ornament: 1 }, language: { feet: 'boots' }, pieces: [CAPE({ hood: true, wrap: 0.5, hem: 'hip', trim: undefined }), { kind: 'belt' }] } },
    },
  },
  sleek: {
    reads: 'the sleek suit: a bodysuit with a diamond emblem and no cape; the rival, the flier',
    palette: { Top: '#1a237e', Bottom: '#0d1442', Shoes: '#0d1442', Gloves: '#0d1442', Trim: '#c62828', Emblem: '#c62828' },
    at: {
      banded: { paint: ['catsuit', 'gloves'], outfit: SKIN_SUIT('athlete', [{ kind: 'bracers' }], { ornament: 0 }), fieldPaint: EMBLEM('diamond') },
      material: { outfit: SKIN_SUIT('athlete', [{ kind: 'bracers' }], { ornament: 0 }), fieldPaint: EMBLEM('diamond') },
    },
  },
  armored: {
    reads: 'the armoured suit: the armored-hero hardsuit, a faceplate helm, a reactor chest; the mastermind in his shell',
    palette: { Plate: '#37474f', Helm: '#263238', Visor: '#e53935', Lens: '#e53935', Reactor: '#e53935', Suit: '#1c2024', Trim: '#b0bec5' },
    at: {
      banded: { adorn: { type: 'armor', style: 'armored-hero', dials: { stylize: 0.6, coverage: 0.85, mass: 0.6, ornament: 1 } } },
      material: { adorn: { type: 'armor', style: 'armored-hero', dials: { stylize: 0.6, coverage: 0.85, mass: 0.6, ornament: 1 } } },
    },
  },
  thug: {
    reads: 'the street coat: biker leathers, no symbol; the brute and the thug',
    palette: { Top: '#2b2b2b', Bottom: '#1f1f1f', Shoes: '#141414', Leather: '#2b2b2b', Trim: '#5d4037' },
    at: {
      banded: { outfit: { type: 'outfit', style: 'biker', dials: { fit: 0.6, stylize: 0.5, coverage: 0.9, ornament: 0 }, language: { feet: 'boots' } } },
      material: { outfit: { type: 'outfit', style: 'biker', dials: { fit: 0.6, stylize: 0.5, coverage: 0.9, ornament: 0 }, language: { feet: 'boots' } } },
    },
  },
});

export function suitOf(id, pole) {
  const S = SUITS[id];
  if (!S) throw new Error(`comic-hero: no suit '${id}' (known: ${Object.keys(SUITS).join(', ')})`);
  if (!S.at[pole]) throw new Error(`comic-hero: suit '${id}' has no fragment for pole '${pole}' (banded, material)`);
  return { palette: S.palette, ...S.at[pole] };
}
