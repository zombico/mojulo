/**
 * THE COMIC HERO PACK'S COSTUME ERAS: three poles of the comic hero look, each a card of PRINCIPLES and a resolver that
 * dresses a ROLE SUIT (suits.js: classic, street, sleek, armored, thug) for a BODY (tiered, realistic) in that era's
 * language. An era never invents a garment: every costume is the hero door's own words (a `paint`, an outfit build and
 * its designed pieces, a chest motif worked in thread, the armored-hero hardsuit, the footwear, handwear and plating
 * libraries by word on the realistic body). The eras tie together through the look dial: each stop suggests an era
 * (ERA_OF_STOP: the golden-hour film the Silver Age, the anime field the Modern, the film the Movie Hero), and the operator
 * may name another.
 *
 *   ERAS                         { silver, modern, movie }: { name, reads, principles: [words], palette: { <group>: hex } }
 *   ERA_IDS, ERA_OF_STOP
 *   costumeOf(role, era, body)   → { palette, ...fragment } the spec fragment (SUIT_KEYS words) for that role, era and body
 */
import { SUITS, suitOf } from './suits.js';

export const ERAS = Object.freeze({
  silver: {
    name: 'Silver Age',
    reads: 'the classic hero (the golden age through the early bronze, before the dark knight): a bodysuit in two primaries, trunks and boots, a cape, one big emblem on the chest, a belt at the waist; no texture, every edge a colour change',
    principles: [
      'Primaries: a red against a blue (or a green against a yellow), the emblem gold; nothing muddy, nothing metallic.',
      'The silhouette is the body: a skin-fit suit, the trunks and boots a second colour, the cape the first.',
      'One emblem, large, worked on the chest; the belt at the natural waist under it.',
      'The cape hangs to the ankle and frames the figure (a hem at the calf ends on its widest); a sidekick wears a half-cape.',
      'Flat colour, no seams, no plates: a printed page.',
    ],
    palette: SUITS.classic.palette,
  },
  modern: {
    name: 'Modern',
    reads: 'the nineties to now: a darker suit cut in panels, one accent, a smaller emblem, bracers and kneepads, the cape short or gone',
    principles: [
      'A dark base (navy, charcoal, black) with ONE accent colour; the gold is gone.',
      'The suit is panelled: a binding along the collar and the edges reads as seams; the fit is still skin.',
      'The emblem is small and angular (a chevron), worked on the chest.',
      'Bracers and kneepads where the Silver Age had bare cloth; gloves and boots in the base, not the accent.',
      'The cape is a half-cape or none; the hood belongs to the street.',
    ],
    palette: { Top: '#1a2340', Bottom: '#111626', Shoes: '#0c0f1a', Gloves: '#0c0f1a', Trim: '#c62828', OutfitBase: '#1a2340', OutfitSecond: '#111626', OutfitTrim: '#c62828', OutfitAccent: '#c62828', Leather: '#0c0f1a' },
  },
  movie: {
    name: 'Movie Hero',
    reads: 'the film: tactical armour over an undersuit, a textured surface, muted metals and one accent, the plating suits on the realistic body, no cape',
    principles: [
      'Muted metals and matte cloth: graphite plate, a charcoal undersuit, a steel trim; the accent (red, gold) small.',
      'Armour where it protects: the chest, the shoulders, the forearms and the shins; cloth and straps between.',
      'Texture is the look: the plates worn, the cloth woven; on the realistic body the plating library, on the tiered body the hardsuit at low mass over a tactical outfit.',
      'The emblem is a plate or a light, not thread.',
      'No cape; a hood or a collar at most. Boots are combat boots, gloves tactical.',
    ],
    palette: { Plate: '#3b4452', Helm: '#2c333d', Visor: '#c62828', Lens: '#c62828', Reactor: '#c62828', Suit: '#1c2024', Trim: '#8a9099', Top: '#1c2024', Bottom: '#1c2024', Shoes: '#15181d', Gloves: '#15181d', OutfitBase: '#2c333d', OutfitSecond: '#1c2024', OutfitTrim: '#8a9099', OutfitAccent: '#c62828', Leather: '#15181d', Alloy: '#8a9099', Joint: '#15181d', Light: '#c62828' },
  },
});
export const ERA_IDS = Object.freeze(Object.keys(ERAS));
export const ERA_OF_STOP = Object.freeze({ anime: 'modern', dcau: 'silver', realistic: 'movie' });

const SKIN = { fit: 'skin', feet: 'boots', top: { family: 'knit', sleeve: 'long', hem: 'hip' }, bottom: { family: 'knit', leg: 'long', cut: 'skinny' } };
const TACTICAL = { fit: 'fitted', feet: 'boots', top: { family: 'woven', sleeve: 'long', hem: 'hip' }, bottom: { family: 'woven', leg: 'long', cut: 'tapered' } };
const build = (style, language, pieces, detail, dials = {}) => ({ type: 'outfit', style, dials: { fit: 1, stylize: 0.5, coverage: 0.95, ornament: 0, ...dials }, language, pieces, ...(detail ? { detail } : {}) });
const HARDSUIT = (dials, language = {}) => ({ type: 'armor', style: 'armored-hero', dials: { stylize: 0.5, coverage: 0.85, mass: 0.6, ornament: 1, ...dials }, ...(Object.keys(language).length ? { language } : {}) });

// MODERN: the role suits re-cut in panels, dark with one accent, the cape short or gone
const MODERN = {
  classic: (body) => ({ ...(body === 'tiered' ? { paint: ['catsuit', 'gloves'] } : {}), outfit: build('athlete', SKIN, [{ kind: 'bracers' }, { kind: 'kneepads' }, { kind: 'belt', at: 'waist' }], [{ prim: 'binding', role: 'collar' }, { prim: 'embroidery', role: 'chest', motif: 'chevron' }]) }),
  street: (body) => ({ ...(body === 'tiered' ? { paint: ['gloves'] } : {}), outfit: build('streetwear', { feet: 'boots' }, [{ kind: 'cloak', hood: true, wrap: 0.5, hem: 'hip' }, { kind: 'belt', at: 'waist' }], [{ prim: 'binding', role: 'collar' }], { fit: 0.7, coverage: 0.9 }) }),
  sleek: (body) => ({ ...(body === 'tiered' ? { paint: ['catsuit', 'gloves'] } : {}), outfit: build('athlete', SKIN, [{ kind: 'bracers' }], [{ prim: 'binding', role: 'collar' }]) }),
  armored: () => ({ adorn: HARDSUIT({ mass: 0.5, ornament: 0 }) }),
  thug: () => ({ outfit: build('biker', { feet: 'boots' }, [], null, { fit: 0.6, coverage: 0.9 }) }),
};
// (the tiered body's pouches ring the waist: a pair at the hip sits inside the thighs and does not read)
const UTILITY = { kind: 'pouches', at: 'waist', count: 4 };
// MOVIE HERO: armour over an undersuit. The tiered body wears the hardsuit at low mass over a tactical outfit; the
// realistic body wears the plating library by word (a suit word, combat boots, tactical gloves), which is that body's own
const MOVIE = {
  classic: (body) => (body === 'realistic' ? { outfit: ['sleekSuit', 'combatBoots', 'tacticalGloves'] } : { outfit: build('tactical', TACTICAL, [{ kind: 'harness' }, { kind: 'kneepads' }, { kind: 'bracers' }], null, { stylize: 0.4 }), adorn: HARDSUIT({ mass: 0.5, coverage: 0.5, ornament: 0 }, { helm: 'none', chest: 'plain', pack: 'none' }) }),
  street: (body) => (body === 'realistic' ? { outfit: ['tee', 'trousers', 'combatBoots', 'tacticalGloves'] } : { outfit: build('tactical', TACTICAL, [{ kind: 'cloak', hood: true, wrap: 0.5, hem: 'hip' }, UTILITY, { kind: 'kneepads' }], null, { stylize: 0.4 }) }),
  sleek: (body) => (body === 'realistic' ? { outfit: ['stealthSuit', 'combatBoots', 'tacticalGloves'] } : { outfit: build('operative', SKIN, [{ kind: 'bracers' }, { kind: 'kneepads' }], null, { stylize: 0.4 }), adorn: HARDSUIT({ mass: 0.5, coverage: 0.4, ornament: 0 }, { helm: 'none', chest: 'plain', pack: 'none' }) }),
  armored: (body) => (body === 'realistic' ? { outfit: ['powerSuit', 'markBoots', 'heavyGauntlets'] } : { adorn: HARDSUIT({ mass: 0.7, coverage: 0.95, ornament: 1 }, { helm: 'faceplate', chest: 'reactor', pack: 'power' }) }),
  thug: (body) => (body === 'realistic' ? { outfit: ['tee', 'trousers', 'combatBoots', 'fightGloves'] } : { outfit: build('fatigues', TACTICAL, [UTILITY], null, { fit: 0.6, stylize: 0.4 }) }),
};

export function costumeOf(role, era, body) {
  if (!ERAS[era]) throw new Error(`comic-hero: no era '${era}' (known: ${ERA_IDS.join(', ')})`);
  if (!SUITS[role]) throw new Error(`comic-hero: no suit '${role}' (known: ${Object.keys(SUITS).join(', ')})`);
  if (era === 'silver') return suitOf(role, body);
  const frag = (era === 'modern' ? MODERN : MOVIE)[role](body);
  return { palette: { ...SUITS[role].palette, ...ERAS[era].palette }, ...frag };
}
