/**
 * THE COMIC HERO PACK'S HEADGEAR (a spike): masks, visors and helmets from the hero door's own words, per BODY, because
 * the two heads differ. The tiered body's landmark head takes a second-skin `paint` band across the eyes (a domino), an
 * `adorn` kit on the cranium (a visor band, the armour's `helm` signature: a trooper's, a faceplate, an open face), and
 * the cloak's hood drawn close (a cowl). The realistic body's relational head takes the dermis's war paint (`skin.paint`
 * pattern `mask`, a domino per texel) and the cowl; the armour fit leaves every head piece off it (body-relational-armour.js
 * wornPieces), so a card with no realistic side says so (`fitted(id, body)`), and the spike's findings are the plan's.
 * A helmet drops the hair (the helm is sized off the head's bounds, not the hair's, which would poke through).
 *
 *   HEADGEAR                     { <id>: { reads, family: 'mask' | 'visor' | 'helmet' | 'cowl' | 'respirator', at: { tiered?: (spec) => spec, realistic?: (spec) => spec } } }
 *   HEADGEAR_IDS, fitted(id, body)
 *   withHeadgear(spec, body, id) → the spec wearing it, or throws naming the bodies it fits
 */
const MASK_GROUP = 'Mask';
// the landmark head's cranium: rows 4 the eyes, 5 the brow; a paint's t in shares of the ring half (0 the front, 1 the back): the bridge is 1 slot of 8 in, the side 6
const EYE_ROWS = [3.6, 5.3];
const HELM = (shape) => ({ id: 'cranium-helm', mode: 'shell', part: 'cranium', s: [6.6, 8], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Suit', rigid: true, stack: false,
  signature: { kind: 'helm', group: 'Helm', visorGroup: 'Visor', grilleGroup: 'Trim', ...shape } });
// (every adornment names a signature: a visor's is one quiet stud at its temple, in the trim)
const STUD = { kind: 'studs', r: 0.004, h: 0.002, count: 1, m: 6, group: 'Trim' };
// (a kit's colours: the helm in the suit's secondary, the visor, the lenses and a visor band in its accent, the face plate
// dark; the era palettes name none of these groups, and grey on grey hides a T visor)
const kitPalette = (P = {}) => ({ ...P, Helm: P.Helm ?? P.OutfitSecond ?? '#2c333d', Suit: P.Suit ?? P.OutfitSecond ?? '#1c2024', Visor: P.Visor ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Lens: P.Lens ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Face: P.Face ?? '#15181d', Trim: P.Trim ?? '#8a9099', Mask: P.Mask ?? '#15171c' });
// (a helm drops the hair; a visor keeps it)
const withKit = (spec, kit, { hair = true } = {}) => ({ ...spec, adorn: [...(Array.isArray(spec.adorn) ? spec.adorn : []), ...kit], ...(hair ? {} : { hair: 'none' }), palette: kitPalette(spec.palette) });
const withHelm = (spec, kit) => withKit(spec, kit, { hair: false });
const withPiece = (spec, piece) => { const O = spec.outfit; if (!O || O.type !== 'outfit') throw new Error('comic-hero: a cowl rides an outfit build\'s cloak'); return { ...spec, outfit: { ...O, pieces: [...(O.pieces || []).filter((p) => p.kind !== 'cloak'), piece] } }; };
const COWL_HOOD = { kind: 'cloak', hood: { open: 28 }, wrap: 0.5, hem: 'hip' };

// a COWL: the helm fitted close (a small pad, no flare), closed over the crown and the eyes, its face window turned the
// other way round by a `brow` below the eye line (the dome runs down to under the eyes, the horseshoe below it open at the
// front), so the nose, the mouth and the chin are bare and the cheeks covered; the eyes are lenses; the ears are the helm's
// `horns`, short and upright. No franchise: a cowl is named for its ears
const COWL = (over = {}, ears = null) => HELM({ n: 2.3, pad: 0.007, drop: 0, flare: 0, muzzle: 0, crown: 0.92, visor: 'lenses', lens: 0.016, visorGroup: 'Lens',
  window: { brow: -0.13, bottom: 0.05, w: 0.72, jaw: { drop: 0.04, curl: 0.3 }, hug: 0.2 }, ...(ears ? { horns: ears } : {}), ...over });
const WINGS = { u: 0.88, a: 0.75, len: 0.075, r: 0.022, out: 0.25, up: 1, back: 0.25, squash: [1, 0.35] };   // two swept wings
const CAT_EARS = { u: 0.9, a: 0.85, len: 0.045, r: 0.02, out: 0.35, up: 1, back: 0.1, squash: [1, 0.5] };   // two short cat ears
const POINTS = { u: 0.9, a: 0.6, len: 0.06, r: 0.014, out: 0.1, up: 1, back: -0.1, squash: [1, 0.6] };   // two upright points
// a RESPIRATOR kit: the cup over the nose and the mouth, carried by a ghost shell (no plate drawn), its filters in the trim
const RESPIRATOR = (over = {}) => ({ id: 'respirator', mode: 'shell', part: 'cranium', s: [6.6, 8], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Suit', rigid: true, stack: false, ghost: true,
  signature: { kind: 'respirator', group: 'Helm', filters: { count: 2, group: 'Trim' }, grille: 3, grilleGroup: 'Trim', ...over } });
// a CAST mask kit: the outline cast from the face (station-loft-adorn.js `cast`), carried by a ghost shell on the cranium
const CAST = (outline, over = {}) => ({ id: `cast${outline[0].toUpperCase()}${outline.slice(1)}`, mode: 'shell', part: 'cranium', s: [6.6, 8], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Mask', rigid: true, stack: false, ghost: true,
  signature: { kind: 'cast', group: 'Mask', outline, ...over } });
// GOGGLES: a plate over each eye carrying a round lens (the boss)
const GOGGLES = ['R', 'L'].map((S) => ({ id: `goggle${S}`, mode: 'shell', part: 'cranium', side: S, s: EYE_ROWS, t: [0.3, 5.6], nt: 6, ns: 2, mugen: 0.01, thick: 0.004, onTop: true, rigid: true, edge: 'roll', group: 'Visor',
  signature: { kind: 'boss', r: 0.017, h: 0.008, k: 'mid', j: 'mid', group: 'Lens' } }));

export const HEADGEAR = Object.freeze({
  // ── COWLS (the helm fitted close, open below the nose; the ears name them) ──
  wingedCowl: { reads: 'the winged cowl: close over the crown and the eyes, the mouth and the chin bare, white lenses, two swept wings off the temples; the clawed brawler', family: 'cowl',
    at: { tiered: (spec) => withHelm(spec, [COWL({}, WINGS)]) } },
  catCowl: { reads: 'the cat cowl: the whole head sleek and closed, short cat ears, narrow lenses; the night stalker', family: 'cowl',
    at: { tiered: (spec) => withHelm(spec, [HELM({ n: 2.2, pad: 0.007, drop: 0.01, flare: 0, muzzle: 0.006, crown: 0.92, visor: 'lenses', lens: 0.013, visorGroup: 'Lens', horns: CAT_EARS })]) } },
  pointedCowl: { reads: 'the pointed cowl: close over the crown and the eyes, the jaw bare, two upright points; the dark detective', family: 'cowl',
    at: { tiered: (spec) => withHelm(spec, [COWL({ visor: 'slits' }, POINTS)]) } },
  // ── RESPIRATORS (the cyberpunk gas mask: a cup over the nose and the mouth, composed with goggles, a cowl or a hood) ──
  respirator: { reads: 'the respirator: a cup over the nose and the mouth with two filter canisters and a grille; the street runner', family: 'respirator',
    at: { tiered: (spec) => withKit(spec, [RESPIRATOR()]) } },
  gasMask: { reads: 'the gas mask: the respirator under round goggles; the toxic-alley operative', family: 'respirator',
    at: { tiered: (spec) => withKit(spec, [RESPIRATOR(), ...GOGGLES]) } },
  cyberCowl: { reads: 'the cyber cowl: the pointed cowl over the respirator, one filter; the netrunner', family: 'respirator',
    at: { tiered: (spec) => withHelm(spec, [COWL({ visor: 'lenses' }, POINTS), RESPIRATOR({ filters: { count: 1, group: 'Trim' }, grille: 2 })]) } },
  hoodedMask: { reads: 'the hooded mask: the half-cape\'s cowl drawn close over the respirator and goggles; the smog-city vigilante', family: 'respirator',
    at: { tiered: (spec) => withPiece(withKit(spec, [RESPIRATOR(), ...GOGGLES]), COWL_HOOD), realistic: null } },
  domino: { reads: 'the domino: a mask cast from the face, over the brow, the bridge and the cheekbones, almond eye holes, points flaring at the temples; the acrobat, the sidekick', family: 'mask',
    at: { tiered: (spec) => withKit(spec, [CAST('domino')]),
      realistic: (spec) => ({ ...spec, skin: { ...(spec.skin && typeof spec.skin === 'object' ? spec.skin : {}), paint: { pattern: 'mask', colour: '#15171c', amount: 1 } } }) } },
  cowl: { reads: 'the cowl: the half-cape\'s hood drawn close round the face; the night vigilante', family: 'mask',
    at: { tiered: (spec) => withPiece(spec, COWL_HOOD), realistic: (spec) => withPiece(spec, COWL_HOOD) } },
  visorBand: { reads: 'the visor band: one band round the head across the eyes, in the accent; the energy-eyed hero', family: 'visor',
    at: { tiered: (spec) => withKit(spec, [{ id: 'visorBand', mode: 'shell', part: 'cranium', s: EYE_ROWS, t: 'wrap', nt: 10, ns: 2, mugen: 0.01, thick: 0.004, onTop: true, rigid: true, group: 'Visor', signature: STUD }]) } },
  visor: { reads: 'the visor: a plate over each eye from the bridge to the temple, in the accent; the speedster', family: 'visor',
    at: { tiered: (spec) => withKit(spec, ['R', 'L'].map((S) => ({ id: `visor${S}`, mode: 'shell', part: 'cranium', side: S, s: EYE_ROWS, t: [0.3, 5.6], nt: 6, ns: 2, mugen: 0.01, thick: 0.004, onTop: true, rigid: true, edge: 'roll', group: 'Visor', signature: STUD }))) } },
  openHelm: { reads: 'the open helm: a dome over the crown, the temples and the cheeks, the face shown; the flier', family: 'helmet',
    at: { tiered: (spec) => withHelm(spec, [HELM({ n: 2.3, pad: 0.018, flare: 0.1, muzzle: 0, crown: 0.9, window: {} })]) } },
  trooperHelm: { reads: 'the trooper helm: a closed helm with a T visor; the enforcer', family: 'helmet',
    at: { tiered: (spec) => withHelm(spec, [HELM({ n: 2.3, pad: 0.022, flare: 0.28, muzzle: 0.014, crown: 0.9, visor: 't' })]) } },
  faceplateHelm: { reads: 'the faceplate helm: a close helm with a face plate and eye slits; the armoured hero', family: 'helmet',
    at: { tiered: (spec) => withHelm(spec, [HELM({ n: 3.2, pad: 0.014, flare: 0.08, muzzle: 0.008, crown: 0.95, visor: 'slits', faceplate: 'Face' })]) } },
  bandHelm: { reads: 'the band helm: a round helm with a visor band across the eyes; the space hero', family: 'helmet',
    at: { tiered: (spec) => withHelm(spec, [HELM({ n: 2.2, pad: 0.02, flare: 0.2, muzzle: 0.01, crown: 0.9, visor: 'band' })]) } },
});
export const HEADGEAR_IDS = Object.freeze(Object.keys(HEADGEAR));
export const fitted = (id, body) => typeof HEADGEAR[id]?.at[body] === 'function';

export function withHeadgear(spec, body, id) {
  if (!id) return spec;
  const H = HEADGEAR[id];
  if (!H) throw new Error(`comic-hero: no headgear '${id}' (known: ${HEADGEAR_IDS.join(', ')})`);
  if (typeof H.at[body] !== 'function') throw new Error(`comic-hero: headgear '${id}' is not fitted to the ${body} body (fits: ${Object.keys(H.at).filter((b) => typeof H.at[b] === 'function').join(', ')})`);
  return H.at[body](spec);
}
