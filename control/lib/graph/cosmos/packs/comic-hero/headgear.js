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
const kitPalette = (P = {}) => ({ ...P, Helm: P.Helm ?? P.OutfitSecond ?? '#2c333d', Suit: P.Suit ?? P.OutfitSecond ?? '#1c2024', Visor: P.Visor ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Lens: P.Lens ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Face: P.Face ?? '#15181d', Trim: P.Trim ?? '#8a9099', Mask: P.Mask ?? '#15171c', MaskLens: P.MaskLens ?? '#e8edf1', MaskTrim: P.MaskTrim ?? P.OutfitAccent ?? P.Trim ?? '#8a9099', MaskSeam: P.MaskSeam ?? '#06070a', MaskPlate: P.MaskPlate ?? '#2a2f38', MaskDomino: P.MaskDomino ?? '#2b303a' });
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
// ── THE MASK BUILDER: a mask is three words over the cast (station-loft-adorn.js `cast`): an OUTLINE, the EYES and the
// DETAIL, and an optional PLATE (a second cast over the first). Each word is data; a new look is a row.
export const MASK_OUTLINES = Object.freeze({
  domino: {},                                                                                              // the classic: curved, points at the temples
  pointed: { wing: 3.15, wingRise: 1.45, peak: 0.42, round: 0.5 },                                         // longer points swept up, a widow's peak
  raptor: { wing: 3.0, wingRise: 1.75, peak: 0.62, fang: 0.38, cheek: 0.85, round: 0 },                    // angular, a high peak, fangs down the cheeks
  technical: { brow: 1.1, notch: 0.12, wing: 2.6, wingRise: 0.55, cheek: 1.0, bridge: 0.62, round: 0 },     // angular planes, a flat brow
  hunter: { brow: 0.92, notch: 0, wing: 3.3, wingRise: 0.32, cheek: 0.68, bridge: 0.42, round: 0 },          // a narrow band swept back to the temples
});
export const MASK_EYES = Object.freeze({
  open: { shape: 'almond', treat: 'open' },                                                                // holes framing the eyes
  slit: { shape: 'slit', size: [0.66, 0.36], tilt: 0.24, treat: 'open' },                                  // narrow, slanted
  lens: { shape: 'almond', size: [0.72, 0.46], treat: 'lens', group: 'MaskLens' },                         // white covers over the eyes
  angularLens: { shape: 'angular', size: [0.74, 0.48], tilt: 0.18, treat: 'lens', group: 'MaskLens' },     // six-sided covers, the outer corner up
  roundLens: { shape: 'round', size: [0.56, 0.5], treat: 'lens', group: 'MaskLens' },                      // round goggle lenses
  blank: { treat: 'none' },                                                                                // no eyes: the mask whole
  opaque: { shape: 'almond', size: [0.8, 0.52], treat: 'lens', group: 'MaskLens' },                     // opaque covers wider than the eye: the anime head's default
});
export const MASK_DETAIL = Object.freeze({
  plain: {},
  technical: { rim: { w: 0.14, h: 0.0012, group: 'MaskTrim' }, seams: ['centre', 'temple', 'cheek'], seamGroup: 'MaskSeam' },
  ridged: { ridge: { w: 0.28, h: 0.0025 }, rim: { w: 0.12, h: 0.001 } },
});
// a PLATE: a second cast over the mask (a brow plate), its outline in the eyes' frame, lifted over the first
const MASK_PLATES = Object.freeze({
  brow: { outline: { poly: [[-2.25, 0.52], [-1.1, 0.62], [0, 0.52], [1.1, 0.62], [2.25, 0.52], [2.5, 0.95], [1.05, 1.24], [0, 1.08], [-1.05, 1.24], [-2.5, 0.95]], holes: [] } },
});
/** a mask's kit from its words: { outline, eyes, detail, plate } (each a word of the tables above, or its own data), the
 * cast carried by a ghost shell on the cranium; with a plate, a second cast over it. On the ANIME head (`head: 'anime'`)
 * the eyes are too large and too drawn to frame, so the default is OPAQUE: no eyes named, the opaque covers; open eyes
 * named, covers in their shape; open holes there only when the eyes say `anime: 'open'` */
export function maskKit({ outline = 'domino', eyes = null, detail = 'plain', plate = null, id = 'mask', head = 'landmark', lift = null, group = 'Mask' } = {}) {
  const pick = (T, w, what) => { if (w && typeof w === 'object') return w; if (!T[w]) throw new Error(`comic-hero: no mask ${what} '${w}' (known: ${Object.keys(T).join(', ')})`); return T[w]; };
  const anime = head === 'anime', E0 = pick(MASK_EYES, eyes ?? (anime ? 'opaque' : 'open'), 'eyes');
  const E = anime && (E0.treat ?? 'open') === 'open' && E0.anime !== 'open' ? { ...E0, treat: 'lens', group: E0.group ?? 'MaskLens', size: E0.size ?? MASK_EYES.opaque.size } : E0;
  const O = pick(MASK_OUTLINES, outline, 'outline'), D = pick(MASK_DETAIL, detail, 'detail');
  // (the carrier by shares of the cranium's rings, its last fifth: a ghost that only pins the cast, on any head's rows)
  const carrier = (aid, sig) => ({ id: aid, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Mask', rigid: true, stack: false, ghost: true, signature: { kind: 'cast', group: 'Mask', ...sig } });
  const kit = [carrier(id, { outline: O, eyes: E, ...D, ...(lift !== null ? { lift } : {}), group })];
  if (plate) { const P = pick(MASK_PLATES, plate, 'plate'); kit.push(carrier(`${id}Plate`, { outline: P.outline, eyes: { treat: 'none', dome: 0 }, lift: 0.0058, thick: 0.0012, rim: { w: 0.1, h: 0.0006, group: 'MaskTrim' }, group: 'MaskPlate' })); }
  return kit;
}
// GOGGLES: a plate over each eye carrying a round lens (the boss)
const GOGGLES = ['R', 'L'].map((S) => ({ id: `goggle${S}`, mode: 'shell', part: 'cranium', side: S, s: EYE_ROWS, t: [0.3, 5.6], nt: 6, ns: 2, mugen: 0.01, thick: 0.004, onTop: true, rigid: true, edge: 'roll', group: 'Visor',
  signature: { kind: 'boss', r: 0.017, h: 0.008, k: 'mid', j: 'mid', group: 'Lens' } }));

// ── THE COWL: the cast over the whole head (station-loft-adorn.js `cowl`), usually with a domino over it. Its words:
// `hair` 'cover' (the hair under the cowl) | 'flow' (the hero's own hair flowing out of the back, in its own colour, its
// length from the hero's hair style); `mouth` 'show' (open under the nose) | 'cover' (over the lips) | 'none' (smooth: a
// mask with no mouth); `domino` a mask's words laid over it (the domino by default) or false; `eyes` shared by the cowl
// and its domino, so the holes meet (on the anime head the opaque covers by default, as a mask's); `detail` the cowl's own
const FLOW = { long: 0.32, wavy: 0.3, layers: 0.3, ponytail: 0.34, braid: 0.34, curtains: 0.16, bob: 0.14, bun: 0.1 };
export function cowlKit({ hair = 'cover', mouth = 'show', domino = 'domino', eyes = null, detail = 'plain', head = 'landmark', heroHair = null, id = 'cowl' } = {}) {
  if (!['cover', 'flow'].includes(hair)) throw new Error(`comic-hero: cowl hair '${hair}' (cover, flow)`);
  if (!['show', 'cover', 'none'].includes(mouth)) throw new Error(`comic-hero: cowl mouth '${mouth}' (show, cover, none)`);
  const words = domino === false ? null : typeof domino === 'string' ? { outline: domino } : domino;
  // (the eyes the cowl and its domino share: the domino's own when it names them, else the cowl's, else the head's default)
  const mk = maskKit({ ...(words || {}), eyes: eyes ?? words?.eyes ?? null, head, id: `${id}Domino`, lift: 0.0048, group: 'MaskDomino' })[0], E = mk.signature.eyes;
  // (the domino reads on the cowl by its edge: a rim raised in shading, unless its own detail names one)
  if (!mk.signature.rim) mk.signature.rim = { w: 0.16, h: 0.0016 };
  const style = typeof heroHair === 'string' ? heroHair : heroHair?.style, len = FLOW[style] ?? 0.2;
  const D = typeof detail === 'object' ? detail : MASK_DETAIL[detail] ?? MASK_DETAIL.plain;
  const cowl = { id, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Mask', rigid: true, stack: false, ghost: true,
    // (close to the skin, a thin cloth: the cowl's silhouette the head's own)
    signature: { kind: 'cowl', group: 'Mask', mouth, eyes: E, lift: 0.0015, thick: 0.0025, ...D, ...(hair === 'flow' ? { hair: { len } } : {}) } };
  return words ? [cowl, mk] : [cowl];
}
const COWLED = (reads, words) => ({ reads, family: 'cowl', words, at: { tiered: (spec) => withHelm(spec, cowlKit({ ...words, head: spec.head, heroHair: spec.hair })) } });

// the masks' VARIATIONS, each the builder's words (tiered: the cast rides the landmark head)
const MASK = (reads, words) => ({ reads, family: 'mask', words, at: { tiered: (spec) => withKit(spec, maskKit({ ...words, head: spec.head })) } });

export const HEADGEAR = Object.freeze({
  // ── COWLS over the whole head (the cast's `cowl`) ──
  dominoCowl: COWLED('the domino cowl: the head covered, the domino over the eyes, the mouth and the chin bare; the night vigilante', {}),
  flowingCowl: COWLED('the flowing cowl: the domino cowl with the hero\'s own hair flowing out of the back; the acrobat', { hair: 'flow' }),
  lensCowl: COWLED('the lens cowl: the head covered, a pointed domino with white lenses, the mouth shown; the detective', { domino: 'pointed', eyes: 'lens' }),
  coveredCowl: COWLED('the covered cowl: the head and the mouth covered, the lips read through the cloth, a domino over the eyes; the ninja', { mouth: 'cover' }),
  fullMask: COWLED('the full mask: the whole head covered, no mouth, white lenses, no domino; the wall-crawler', { mouth: 'none', domino: false, eyes: 'lens' }),
  facelessMask: COWLED('the faceless mask: the whole head covered, no mouth, no eyes; the blank', { mouth: 'none', domino: false, eyes: 'blank' }),
  bareCowl: COWLED('the bare cowl: the head covered, eye holes cut, no domino, the mouth shown; the thief', { domino: false }),
  technicalCowl: COWLED('the technical cowl: the head covered, a technical domino with lenses and seams, a crest over the crown; the gadgeteer', { domino: { outline: 'technical', detail: 'technical' }, eyes: 'angularLens', detail: { ridge: { w: 0.22, h: 0.002 } } }),
  pointedMask: MASK('the pointed mask: the domino swept to long points at the temples, a widow\'s peak at the brow; the aerialist', { outline: 'pointed' }),
  raptorMask: MASK('the raptor mask: angular, a high peak, fangs down the cheeks, slanted slits; the predator', { outline: 'raptor', eyes: 'slit' }),
  technicalMask: MASK('the technical mask: angular planes, panel seams and a raised rim, white lens covers; the gadgeteer', { outline: 'technical', eyes: 'lens', detail: 'technical' }),
  tacticalMask: MASK('the tactical mask: the technical cut, six-sided lenses, a brow plate over it; the operative', { outline: 'technical', eyes: 'angularLens', detail: 'technical', plate: 'brow' }),
  hunterMask: MASK('the hunter\'s band: a narrow band swept back to the temples, slit eyes, a ridge over the bridge; the tracker', { outline: 'hunter', eyes: 'slit', detail: 'ridged' }),
  lensMask: MASK('the lens mask: the domino with white covers over the eyes; the classic masked hero', { eyes: 'lens' }),
  blankMask: MASK('the blank mask: the pointed cut and no eyes at all; the faceless', { outline: 'pointed', eyes: 'blank', detail: 'ridged' }),
  goggleMask: MASK('the goggle mask: the technical cut with round lenses; the inventor', { outline: 'technical', eyes: 'roundLens', detail: 'technical' }),
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
    at: { tiered: (spec) => withKit(spec, maskKit({ head: spec.head })),
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
