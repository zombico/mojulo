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
const kitPalette = (P = {}) => ({ ...P, Helm: P.Helm ?? P.OutfitSecond ?? '#2c333d', Suit: P.Suit ?? P.OutfitSecond ?? '#1c2024', Visor: P.Visor ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Lens: P.Lens ?? P.OutfitAccent ?? P.Trim ?? '#c62828', Face: P.Face ?? '#15181d', Trim: P.Trim ?? '#8a9099', Mask: P.Mask ?? '#15171c', MaskLens: P.MaskLens ?? '#e8edf1', MaskTrim: P.MaskTrim ?? P.OutfitAccent ?? P.Trim ?? '#8a9099', MaskSeam: P.MaskSeam ?? '#06070a', MaskPlate: P.MaskPlate ?? '#2a2f38', MaskDomino: P.MaskDomino ?? '#2b303a', MaskStitch: P.MaskStitch ?? P.OutfitAccent ?? P.Trim ?? '#c9b27c', MaskTeeth: P.MaskTeeth ?? '#efe9d8', MaskFitting: P.MaskFitting ?? '#7d848e', MaskFilter: P.MaskFilter ?? '#2b2f36', MaskStrap: P.MaskStrap ?? '#1d1f24', MaskMaw: P.MaskMaw ?? '#140808', MaskMouth: P.MaskMouth ?? P.Mask ?? '#15171c', EyeFrame: P.EyeFrame ?? '#1b1d22', EyeLens: P.EyeLens ?? '#9fc6c9', EyeStrap: P.EyeStrap ?? '#1b1d22', EyeTrim: P.EyeTrim ?? '#8a9099', EyeGlow: P.EyeGlow ?? '#5dff7a', Helmet: P.Helmet ?? '#d0d3d8', HelmetVisor: P.HelmetVisor ?? '#20252c', HelmetTrim: P.HelmetTrim ?? '#1b1d22', GoldVisor: P.GoldVisor ?? '#d4a73a', HelmetSeam: P.HelmetSeam ?? '#2a2e35', Faceplate: P.Faceplate ?? '#2a2f39', MaskBone: P.MaskBone ?? '#ece6d6', Plume: P.Plume ?? '#b3261e', HelmetCut: P.HelmetCut ?? '#0b0c0f', MaskBlush: P.MaskBlush ?? '#e58f9e', MaskGold: P.MaskGold ?? '#d4a73a' });
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
  owl: { brow: 1.5, notch: 0.5, wing: 4.3, wingRise: 2.3, arm: 0.95, valley: 0.2, cheek: 1.05, bridge: 1.4, round: 0.4, sweep: { from: 2.3, flare: 1.1 } },   // the owl's W: a facial disc with a V brow and a beak over the nose, its arms swept out past the head like a horned owl's tufts
  hornedOwl: { brow: 1.5, notch: 0.6, wing: 4.0, wingRise: 2.6, arm: 0.7, valley: 0.35, cheek: 1.0, bridge: 1.35, round: 0.3, sweep: { from: 2.3, flare: 0.85 } },   // the W's arms narrow and raised: a horned owl's ear tufts
  barnOwl: { brow: 1.35, notch: 0.75, wing: 3.6, wingRise: 1.35, arm: 1.15, valley: 0.1, cheek: 1.2, bridge: 1.25, round: 0.8, sweep: { from: 2.3, flare: 1.2 } },   // a heart-shaped disc, short arms laid flat out
  greatOwl: { brow: 1.45, notch: 0.45, wing: 5.0, wingRise: 1.7, arm: 1.0, valley: 0.25, cheek: 1.0, bridge: 1.45, round: 0, sweep: { from: 2.3, flare: 1.4 } },   // angular, the arms swept long and wide like wings
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
// ── THE COWL'S ORNAMENTS: spikes and lines on the face's paths (station-loft-adorn.js COWL_PATHS), each a word ──
export const COWL_ORNAMENTS = Object.freeze({
  batEars: [{ kind: 'spikes', path: 'parietal', shape: 'bat', at: 0.3, len: 0.07, w: 0.05, up: 0.9, lean: 0.06, thick: 0.009 }],         // two tall ears off the top of the sides
  batCrest: [{ kind: 'spikes', path: 'parietal', shape: 'bat', count: 4, len: 0.06, w: 0.032, profile: 'lead', up: 0.7, lean: 0.15 }],   // spikes along the top of each side, the first tallest
  finEars: [{ kind: 'spikes', path: 'temple', shape: 'fin', at: 0.85, len: 0.07, w: 0.05, up: 0.45, lean: 0.35 }],              // a fin swept back off each temple
  crest: [{ kind: 'spikes', path: 'sagittal', shape: 'cone', count: 7, len: 0.03, w: 0.016, profile: 'crown', up: 0.2 }],       // a row of points over the crown
  browStitch: [{ kind: 'lines', path: 'brow', style: 'stitch' }],                                                                 // stitches over the domino's top edge
  echoStitch: [{ kind: 'lines', path: 'echo', style: 'stitch' }],                                                                 // stitches round the domino, a step out
  templeCords: [{ kind: 'lines', path: 'temple', style: 'cord' }],                                                                // a cord from the domino's points up the sides
  crownStripe: [{ kind: 'lines', path: 'sagittal', style: 'double' }],                                                           // a double cord over the crown
  cheekStitch: [{ kind: 'lines', path: 'cheek', style: 'stitch' }],                                                               // stitches off the domino's corners to the jaw
  owlTufts: [{ kind: 'spikes', path: 'parietal', shape: 'fin', face: 'front', at: 0.06, len: 0.045, w: 0.04, up: 0.5, lean: 0.65, thick: 0.007, group: 'MaskDomino' }],   // feather tufts at the front of the top of the sides
  featherBrow: [{ kind: 'lines', path: 'brow', style: 'double', apart: 0.003 }],                                                  // a double line over the facial disc
});
// COMPOSITIONS: ornament sets read with the face as a whole (the domino's lines carried on): a word or a list of words
export const COWL_DRESS = Object.freeze({
  gothic: ['batEars', 'browStitch'],               // the ears rise where the domino's points aim, the brow echoes its top
  nocturne: ['batCrest', 'templeCords'],           // spikes along the sides, cords from the domino's points into them
  aviator: ['finEars', 'crownStripe'],             // fins swept back from the temples, a stripe over the crown
  stitched: ['echoStitch', 'cheekStitch', 'browStitch'],   // the rag doll: the domino stitched round, lines off its corners
  crowned: ['crest', 'echoStitch'],                // points over the crown, the domino outlined
  owl: ['featherBrow', 'crownStripe'],             // the disc's brow lined, a stripe over the crown
});
const FLOW = { long: 0.32, wavy: 0.3, layers: 0.3, ponytail: 0.34, braid: 0.34, curtains: 0.16, bob: 0.14, bun: 0.1 };
export function cowlKit({ hair = 'cover', mouth = 'show', domino = 'domino', eyes = null, detail = 'plain', dress = null, ornaments = null, head = 'landmark', heroHair = null, id = 'cowl' } = {}) {
  if (!['cover', 'flow'].includes(hair)) throw new Error(`comic-hero: cowl hair '${hair}' (cover, flow)`);
  if (!['show', 'cover', 'none'].includes(mouth)) throw new Error(`comic-hero: cowl mouth '${mouth}' (show, cover, none)`);
  const words = domino === false ? null : typeof domino === 'string' ? { outline: domino } : domino;
  // (the eyes the cowl and its domino share: the domino's own when it names them, else the cowl's, else the head's default)
  const mk = maskKit({ ...(words || {}), eyes: eyes ?? words?.eyes ?? null, head, id: `${id}Domino`, lift: 0.0048, group: 'MaskDomino' })[0], E = mk.signature.eyes;
  // (the domino reads on the cowl by its edge: a rim raised in shading, unless its own detail names one)
  if (!mk.signature.rim) mk.signature.rim = { w: 0.16, h: 0.0016 };
  const style = typeof heroHair === 'string' ? heroHair : heroHair?.style, len = FLOW[style] ?? 0.2;
  // (the ornaments: a composition's words (`dress`), then words or entries of their own (`ornaments`), aligned to the domino)
  const words2 = [...(dress ? (Array.isArray(dress) ? dress : [dress]).flatMap((w) => { if (!COWL_DRESS[w]) throw new Error(`comic-hero: no cowl dress '${w}' (known: ${Object.keys(COWL_DRESS).join(', ')})`); return COWL_DRESS[w]; }) : []), ...(ornaments || [])];
  const orn = words2.flatMap((w) => (typeof w === 'string' ? (COWL_ORNAMENTS[w] ?? (() => { throw new Error(`comic-hero: no cowl ornament '${w}' (known: ${Object.keys(COWL_ORNAMENTS).join(', ')})`); })()) : [w]));
  const D = typeof detail === 'object' ? detail : MASK_DETAIL[detail] ?? MASK_DETAIL.plain;
  const cowl = { id, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Mask', rigid: true, stack: false, ghost: true,
    // (close to the skin, a thin cloth: the cowl's silhouette the head's own)
    signature: { kind: 'cowl', group: 'Mask', mouth, eyes: E, lift: 0.0015, thick: 0.0025, ...D, ...(hair === 'flow' ? { hair: { len } } : {}), ...(orn.length ? { ornaments: orn, align: mk.signature.outline } : {}) } };
  return words ? [cowl, mk] : [cowl];
}
// (a cowl card may carry its own colours, over the suit's: the cowl, its domino panel, its lenses)
const COWLED = (reads, words, palette = null) => ({ reads, family: 'cowl', words, at: { tiered: (spec) => withHelm(palette ? { ...spec, palette: { ...(spec.palette || {}), ...palette } } : spec, cowlKit({ ...words, head: spec.head, heroHair: spec.hair })) } });

// ── THE MOUTHPIECE: the lower face's cast (station-loft-adorn.js `mouthpiece`), the domino's counterpart; worn alone, under
// a domino, or with a cowl that shows the mouth. Its words, against the head's own heights (Z: the eyes 0, `nose`,
// `mouth`, `chin` the head's rows): the cloth's TAUT pull, its outline, a cut MOUTH with teeth, and FITTINGS
export const MOUTHPIECES = Object.freeze({
  ninja: { taut: 1, fold: true, outline: { straight: true, side: 3.1 }, hang: 0.1 },                                                   // cloth drawn flat over the nose and the mouth, a centre fold
  wraith: { taut: 0.9, fold: true, outline: { dip: 0.35, side: 3.0 }, rim: { w: 0.12, h: 0.0012 }, hang: 0.1 },                        // the ninja's cloth cut in a V over the nose, its edge raised
  bandanna: { taut: 0.85, outline: { straight: true, side: 3.2, point: 2.4 }, hang: 0.05, thick: 0.002 },                              // a kerchief, its point hanging below the chin
  oni: { taut: 0.45, outline: { top: 'nose+0.55', side: 2.45, bottom: 'chin-0.45' }, mouth: 'snarl', teeth: 8, fangs: true, wrinkles: true, thick: 0.004, rim: { w: 0.1, h: 0.0015 } },   // a lacquered plate, a snarling mouth, teeth and fangs
  gasFilter: { taut: 0.6, bulge: 0.014, outline: { top: 'nose*0.35', side: 2.5, bottom: 'chin-0.2' }, fittings: [{ kind: 'filter', at: [0, 'mouth-0.3'], r: 0.019, h: 0.02 }, ...['R', 'L'].flatMap((S) => [{ kind: 'strap', side: S, at: [2.4, 'nose*0.3'], to: [4.3, 'nose*0.1'] }, { kind: 'strap', side: S, at: [2.3, 'mouth-0.8'], to: [4.2, 'mouth-0.4'] }])] },
  twinFilter: { taut: 0.6, bulge: 0.012, outline: { top: 'nose*0.35', side: 2.6, bottom: 'chin-0.2' }, fittings: [{ kind: 'filter', at: [1.35, 'mouth'], tilt: -0.1 }, { kind: 'filter', at: [-1.35, 'mouth'], tilt: -0.1 }, { kind: 'valve', at: [0, 'mouth-0.35'] }] },
  tubes: { taut: 0.7, outline: { top: 'nose+0.2', side: 2.6, bottom: 'chin-0.3' }, fittings: [{ kind: 'grille', at: [0, 'mouth'], rows: 3, w: 0.55 }, ...[0.45, 0.85].flatMap((x) => [{ kind: 'tube', at: [x, 'mouth-0.15'], to: [x + 1.7, 'chin-0.1'] }, { kind: 'tube', at: [-x, 'mouth-0.15'], to: [-x - 1.7, 'chin-0.1'] }])] },
  slatted: { taut: 0.8, outline: { top: 'nose*0.4', side: 2.7, bottom: 'chin-0.3', straight: true }, fittings: [{ kind: 'grille', at: [0, 'mouth'], rows: 5, w: 0.95, step: 0.2, bar: 0.0026 }, { kind: 'valve', at: [0, 'chin+0.2'] }] },
  // the MECHA faceplate: crisp folded planes (a flat centre, the sides falling back: \_/ in plan), a V at the chin, two
  // vents stacked one over the other, each following the fold (\_/ across), the fold lines marked
  mecha: { fold: { centre: 0.45, angle: 0.03, tilt: 0.004 }, crisp: true, thick: 0.004, outline: { top: 'nose*0.3', straight: true, side: 1.85, bottom: 'chin-0.3', point: 0.7 },
    vents: [{ path: [[-0.88, 'mouth+0.32'], [-0.45, 'mouth+0.02'], [0.45, 'mouth+0.02'], [0.88, 'mouth+0.32']], h: 0.15 }, { path: [[-0.88, 'mouth-0.16'], [-0.45, 'mouth-0.46'], [0.45, 'mouth-0.46'], [0.88, 'mouth-0.16']], h: 0.15 }],
    rim: { w: 0.08, h: 0.0012, group: 'MaskTrim' } },
  rebreather: { taut: 0.5, bulge: { h: 0.012, r: 1.0 }, outline: { top: 'nose-0.15', side: 1.55, bottom: 'chin+0.35', straight: true }, fittings: [{ kind: 'valve', at: [0, 'mouth-0.2'] }, { kind: 'tube', at: [0.9, 'mouth-0.3'], to: [2.9, 'chin-0.6'], r: 0.006, arch: 0.016 }] },
});
// (a height word: 'nose', 'mouth', 'chin', or one of them with an offset or a share ('nose+0.55', 'chin-0.2', 'nose*0.35'),
// resolved by the cast against the head; the kit carries it as written)
// THE PANELLED MOUTHPIECE (the fighting ninja's): three panels cast tight on the face with a gap between each, a flat
// centre over the mouth and the chin, and the sides angled back, their tops climbing out to the cheekbones and their
// bottoms rising to the jaw's corners; vertical vents in the centre. Each panel its own cast (a polygon outline), so the
// gaps are clean
const PANEL = { taut: 0.55, thick: 0.0028, lift: 0.0018, rim: { w: 0.08, h: 0.0009 }, hang: 0.08 };
export const PANELLED = Object.freeze({
  kombat: {
    centre: { ...PANEL, outline: { poly: [[-0.6, 'nose*0.55'], [0.6, 'nose*0.55'], [0.62, 'chin-0.45'], [-0.62, 'chin-0.45']] },
      vents: ['mouth+0.2', 'mouth-0.05', 'mouth-0.3', 'mouth-0.55'].map((z) => ({ path: [[-0.4, z], [0.4, z]], h: 0.09 })) },   // four horizontal slits across the centre
    side: { ...PANEL, outline: { poly: [[0.72, 'nose*0.55'], [1.5, 'nose*0.25'], [2.35, 'nose*0.05'], [2.45, 'mouth-0.1'], [1.6, 'chin-0.05'], [0.74, 'chin-0.4']] } },
  },
});
/** a panelled mouthpiece's kit: its centre and its two sides (the right's outline mirrored for the left) */
export function panelledKit(word = 'kombat', { lift = null, group = 'Mask' } = {}) {
  const P = PANELLED[word]; if (!P) throw new Error(`comic-hero: no panelled mouthpiece '${word}' (known: ${Object.keys(PANELLED).join(', ')})`);
  const left = { ...P.side, outline: { poly: P.side.outline.poly.map(([x, z]) => [-x, z]) } };
  // (a thin dark BACKING under the panels, the whole piece's outline, so the gaps between them read as dark panel lines)
  const R = P.side.outline.poly, backing = { taut: P.centre.taut, thick: 0.0008, lift: 0.0012, hang: P.centre.hang, maw: false,
    outline: { poly: [...R.slice(0, 3), ...R.slice(3).map(([x, z]) => [x, z]), ...[[0.62, 'chin-0.45'], [-0.62, 'chin-0.45']], ...R.slice(3).reverse().map(([x, z]) => [-x, z]), ...R.slice(0, 3).reverse().map(([x, z]) => [-x, z])].filter(([x]) => true) } };
  return [...mouthpieceKit(backing, { id: 'mouthBacking', group: 'MaskMaw' }), ...mouthpieceKit(P.centre, { id: 'mouthCentre', lift, group }), ...mouthpieceKit(P.side, { id: 'mouthSideR', lift, group }), ...mouthpieceKit(left, { id: 'mouthSideL', lift, group })];
}
/** a mouthpiece's kit from its word (MOUTHPIECES) or its own data, `over` its words' changes; `lift` over a domino or a cowl */
export function mouthpieceKit(word = 'ninja', { over = {}, lift = null, id = 'mouthpiece', group = 'Mask' } = {}) {
  const W = typeof word === 'object' ? word : MOUTHPIECES[word];
  if (!W) throw new Error(`comic-hero: no mouthpiece '${word}' (known: ${Object.keys(MOUTHPIECES).join(', ')})`);
  return [{ id, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group, rigid: true, stack: false, ghost: true,
    signature: { kind: 'mouthpiece', group, ...W, ...over, ...(lift !== null ? { lift } : {}) } }];
}
// a FACE SET: a cowl and a mouthpiece laid over it (its own group, MaskMouth), read as one face: the cowl's words, the
// mouthpiece's word, their colours
const FACE_SET = (reads, cowl, mouth, palette = null) => ({ reads, family: 'face', words: { cowl, mouthpiece: mouth },
  at: { tiered: (spec) => withHelm(palette ? { ...spec, palette: { ...(spec.palette || {}), ...palette } } : spec, [...cowlKit({ ...cowl, head: spec.head, heroHair: spec.hair }), ...mouthpieceKit(mouth, { lift: 0.0042, group: 'MaskMouth' })]) } });
const MOUTHED = (reads, word, palette = null) => ({ reads, family: 'mouthpiece', words: { mouthpiece: word }, at: { tiered: (spec) => withKit(palette ? { ...spec, palette: { ...(spec.palette || {}), ...palette } } : spec, mouthpieceKit(word)) } });

// ── EYEGEAR: everything worn over the eyes, one family on the cast (station-loft-adorn.js `cast`): the DOMINO masks (the
// mask builder's words above), GOGGLES (two rings or one shield of lens, a strap round the head), VISORS and HEADSETS
// (a band of glass, a flat-fronted box, earpieces, antennas, scopes, lens clusters). Each word the cast's own data
const LENS = (o = {}) => ({ treat: 'lens', group: 'EyeLens', ...o });
export const EYEGEAR = Object.freeze({
  // (the ski visor a curved SHIELD standing off the face: one orange lens over the eyes and the brow, a thin frame round it)
  ski: { outline: { shape: 'shield', w: 2.55, top: 1.55, bottom: -1.15, notch: 0.4 }, eyes: LENS({ shape: 'shield', inset: [0.93, 0.86], dome: 0 }), group: 'EyeFrame', thick: 0.0035, lift: 0.003, front: { curve: true, shell: true, out: 0.022, max: 0.05 }, rim: { w: 0.1, h: 0.0015, group: 'EyeTrim' }, strap: { z: 0.2, h: 0.6 } },
  moto: { outline: { shape: 'goggles', r: 0.92, bridge: 0.28 }, eyes: LENS({ shape: 'round', size: [0.7, 0.7], dome: 0.007 }), group: 'EyeFrame', thick: 0.007, lift: 0.003, rim: { w: 0.12, h: 0.003, group: 'EyeTrim' }, strap: { z: 0, h: 0.42 } },
  lab: { outline: { shape: 'goggles', r: 0.78, bridge: 0.22 }, eyes: LENS({ shape: 'round', size: [0.62, 0.6], dome: 0.005 }), group: 'EyeFrame', thick: 0.005, lift: 0.0025, strap: { z: 0, h: 0.26 } },
  nightVision: { outline: { shape: 'goggles', r: 0.85, bridge: 0.3 }, eyes: { treat: 'none' }, group: 'EyeFrame', thick: 0.008, lift: 0.003, strap: { z: 0.2, h: 0.5 },
    fittings: [{ kind: 'scope', at: [1, 0], r: 0.014, len: 0.065, group: 'EyeFrame', lensGroup: 'EyeGlow' }, { kind: 'scope', at: [-1, 0], r: 0.014, len: 0.065, group: 'EyeFrame', lensGroup: 'EyeGlow' }] },
  quadVision: { outline: { shape: 'shield', w: 2.4, top: 0.95, bottom: -0.8, notch: 0.45 }, eyes: { treat: 'none' }, group: 'EyeFrame', thick: 0.008, lift: 0.003, strap: { z: 0.15, h: 0.5 },
    fittings: [[0.7, 0.25], [-0.7, 0.25], [1.75, 0.05], [-1.75, 0.05]].map(([x, z]) => ({ kind: 'scope', at: [x, z], r: 0.012, len: 0.07, group: 'EyeFrame', lensGroup: 'EyeGlow' })) },
  vr: { outline: { shape: 'shield', w: 2.05, top: 1.3, bottom: -1.05, notch: 0.55 }, eyes: { treat: 'none', dome: 0 }, group: 'EyeFrame', front: { out: 0.022, max: 0.065 }, rim: { w: 0.14, h: 0.0015, group: 'EyeTrim' }, strap: { z: 0.15, h: 0.75, lift: 0.007 } },
  cyber: { outline: { shape: 'visor', w: 2.75, h: 1.0, curve: 0.08 }, eyes: { treat: 'none', dome: 0 }, group: 'EyeLens', thick: 0.003, lift: 0.004, front: { curve: true, shell: true, out: 0.01, max: 0.03 }, rim: { w: 0.08, h: 0.0012, group: 'EyeFrame' }, strap: { z: 0.55, h: 0.18, group: 'EyeFrame', lift: 0.006 },
    fittings: [{ kind: 'earpiece', at: [3.25, 0.1], r: 0.024, h: 0.012, out: 0.014, group: 'EyeFrame', capGroup: 'EyeGlow' }, { kind: 'earpiece', at: [-3.25, 0.1], r: 0.024, h: 0.012, out: 0.014, group: 'EyeFrame', capGroup: 'EyeGlow' },
      ...[1, -1].flatMap((sg) => [{ kind: 'antenna', at: [sg * 3.45, 0.35], out: 0.014, len: 0.06, r: 0.0035, back: 1, up: 0.55, group: 'EyeFrame' }, { kind: 'tube', at: [sg * 3.2, -0.25], to: [sg * 2.9, 'chin-1.2'], r: 0.0022, ribs: false, arch: 0.004, group: 'EyeFrame' }])] },
  spider: { outline: { shape: 'visor', w: 2.25, h: 0.5, curve: 0.12 }, eyes: { treat: 'none' }, group: 'EyeFrame', thick: 0.004, lift: 0.004, strap: { z: 2.0, h: 0.22, lift: 0.006 },
    fittings: [...[[0.55, 0.07, 0.009], [1.05, 0.12, 0.01], [1.55, 0.04, 0.008], [0.82, -0.12, 0.0065], [1.32, -0.1, 0.0065], [1.9, -0.05, 0.005]].flatMap(([x, z, r]) => [{ kind: 'lens', at: [x, z], r, h: r * 0.8, group: 'EyeGlow' }, { kind: 'lens', at: [-x, z], r, h: r * 0.8, group: 'EyeGlow' }]),
      { kind: 'earpiece', at: [3.2, -0.1], r: 0.02, out: 0.012, group: 'EyeFrame', capGroup: 'EyeGlow' }, { kind: 'earpiece', at: [-3.2, -0.1], r: 0.02, out: 0.012, group: 'EyeFrame', capGroup: 'EyeGlow' },
      { kind: 'arm', at: [2.3, 0.05], to: [3.1, -0.05], r: 0.0028, group: 'EyeFrame' }, { kind: 'arm', at: [-2.3, 0.05], to: [-3.1, -0.05], r: 0.0028, group: 'EyeFrame' }] },
  // the ENGINEER's visor: a bright band wrapped temple to temple, standing off the face, ridged across, small connectors
  // where it meets the temples
  engineer: { outline: { shape: 'visor', w: 3.0, h: 0.62, curve: 0.04 }, eyes: { treat: 'none', dome: 0 }, group: 'EyeFrame', thick: 0.003, lift: 0.004, front: { curve: true, shell: true, out: 0.012, max: 0.03 },
    seams: [-0.2, -0.07, 0.06, 0.19].map((z) => [[-2.7, z + 0.04], [0, z + 0.04], [2.7, z + 0.04]]), seamGroup: 'EyeTrim', seamW: 0.03,
    fittings: [{ kind: 'earpiece', at: [3.05, 0.04], r: 0.011, h: 0.008, out: 0.006, group: 'EyeTrim', capGroup: 'EyeFrame' }, { kind: 'earpiece', at: [-3.05, 0.04], r: 0.011, h: 0.008, out: 0.006, group: 'EyeTrim', capGroup: 'EyeFrame' }] },
  // the OPTIC blast visor: a dark band round to the temples, one ruby lens strip across both eyes, a band round the head
  optic: { outline: { shape: 'visor', w: 2.7, h: 0.9, curve: 0.06 }, eyes: LENS({ shape: 'shield', inset: [0.9, 0.36], dome: 0, group: 'EyeGlow' }), group: 'EyeFrame', thick: 0.004, lift: 0.004, front: { curve: true, shell: true, out: 0.008, max: 0.025 }, rim: { w: 0.1, h: 0.0012, group: 'EyeTrim' }, strap: { z: 0.1, h: 0.4 } },
});
// ── HELMETS: hard shells over the whole head (the cast's `cowl` with padding under a smoothed shell), their face
// openings by the cowl's mouth words and a `window`, a visor in it by `eyes.treat`; fittings and ornaments on the shell
const VISOR = (o = {}) => ({ treat: 'lens', group: 'HelmetVisor', dome: 0.004, ...o });
const STRIPE = [{ kind: 'lines', path: 'sagittal', style: 'double', w: 0.006, apart: 0.012, group: 'HelmetTrim' }];
// THE MOTOCROSS family: one shell and its dials (a curved PEAK over the window, the WINDOW, the chin bar's VENTS, a VISOR in
// the window, a CREST over the crown, STRIPES), each variation the motocross helmet with some of them changed
const MOTO = ({ peak = {}, window = {}, vents = null, visor = false, crest = null, stripe = true, mouth = 'cover', jaw = 1.0 } = {}) => ({
  mouth, jaw, nape: 0.05, pad: 0.02, shell: 24, thick: 0.004, window: { shape: 'shield', w: 2.3, top: 1.1, bottom: -0.8, notch: 0.3, ...window },
  eyes: visor ? VISOR(typeof visor === 'object' ? visor : {}) : { treat: 'open' }, rim: { w: 0.08, h: 0.002, group: 'HelmetTrim' }, ...(crest ? { ridge: crest } : {}),
  fittings: [...(peak === false ? [] : [{ kind: 'peak', at: [0, (window.top ?? 1.1) + 0.32], span: 1.7, len: 0.055, tilt: 0.38, curl: 0.006, droop: 0.15, group: 'HelmetTrim', ...peak }]),
    ...(vents ? [{ kind: 'grille', at: [0, 'mouth-0.15'], rows: vents, w: 0.55, step: 0.2, bar: 0.0028, group: 'HelmetTrim' }] : [])],
  ...(stripe ? { ornaments: STRIPE } : {}) });
export const HELMETS = Object.freeze({
  fullFace: { mouth: 'cover', jaw: 0.95, nape: 0.05, pad: 0.018, shell: 24, thick: 0.004, window: { shape: 'shield', w: 2.35, top: 1.15, bottom: -0.95, notch: 0.15 }, eyes: VISOR(), rim: { w: 0.08, h: 0.002, group: 'HelmetTrim' }, ornaments: STRIPE },
  motocross: MOTO(),
  enduro: MOTO({ peak: { len: 0.045, span: 1.5 }, vents: 3 }),                                                     // a shorter peak, a vented chin bar
  downhill: MOTO({ peak: { span: 1.65, len: 0.05, tilt: 0.38 }, window: { w: 2.45, top: 1.2, bottom: -0.9, notch: 0.25 }, vents: 2 }),   // a wide window for big goggles, a broad peak
  adventure: MOTO({ peak: { len: 0.05, tilt: 0.45 }, visor: { group: 'HelmetVisor' }, stripe: false }),                // a smoked visor under the peak: the dual-sport
  bmx: MOTO({ peak: { len: 0.06, tilt: 0.5, curl: 0.008 }, vents: 4, window: { w: 2.2, top: 1.05, bottom: -0.75 } }),   // a steep peak, a heavily vented chin bar
  desert: MOTO({ mouth: 'open', jaw: 0.7, peak: { len: 0.05, span: 1.6, tilt: 0.3 }, stripe: false }),                // the vintage open face under a peak
  raider: MOTO({ peak: { len: 0.05, span: 1.55, tilt: 0.42 }, window: { shape: 'visor', w: 2.3, h: 0.8, curve: 0.05 }, visor: { group: 'HelmetVisor' }, crest: { w: 0.22, h: 0.006 }, vents: 2 }),   // a narrow visor slot, a crest over the crown
  jet: { mouth: 'open', opening: 1.2, brow: 1.45, jaw: 0.75, nape: 0.05, pad: 0.016, shell: 24, thick: 0.004, rim: { w: 0.08, h: 0.002, group: 'HelmetTrim' } },
  tactical: { mouth: 'open', opening: 1.25, brow: 1.55, jaw: 0.25, nape: 0.02, pad: 0.014, shell: 20, thick: 0.004, rim: { w: 0.08, h: 0.0015, group: 'HelmetTrim' },
    fittings: [{ kind: 'earpiece', at: [0, 2.35], r: 0.014, h: 0.008, group: 'HelmetTrim', capGroup: 'HelmetTrim' }, { kind: 'earpiece', at: [2.9, 0.9], r: 0.012, h: 0.006, group: 'HelmetTrim', capGroup: 'HelmetTrim' }, { kind: 'earpiece', at: [-2.9, 0.9], r: 0.012, h: 0.006, group: 'HelmetTrim', capGroup: 'HelmetTrim' }] },
  astronaut: { mouth: 'cover', jaw: 1.0, nape: 0.15, pad: 0.045, shell: 40, thick: 0.004, window: { shape: 'shield', w: 3.0, top: 2.1, bottom: -2.3, notch: 0 }, eyes: VISOR({ dome: 0 }), rim: { w: 0.1, h: 0.003, group: 'HelmetTrim' } },
});
/** a helmet's kit from its word (HELMETS) or its own data, `over` its words' changes */
export function helmetKit(word, { id = 'helmet', over = {} } = {}) {
  const W = typeof word === 'object' ? word : HELMETS[word];
  if (!W) throw new Error(`comic-hero: no helmet '${word}' (known: ${Object.keys(HELMETS).join(', ')})`);
  return [{ id, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: 'Helmet', rigid: true, stack: false, ghost: true, signature: { kind: 'cowl', group: 'Helmet', ...W, ...over } }];
}
// THE JET PILOT family: an open-face shell, a visor HOUSING standing off over the forehead, the visor DOWN over the eyes or
// UP in its housing, EARCUPS, an OXYGEN mask and its hose, a boom MIC, STRIPES; each variation some of these dials
const OXYGEN = { taut: 0.5, bulge: { h: 0.014, r: 1.1 }, outline: { top: 'nose-0.05', side: 1.65, bottom: 'chin+0.25', straight: true }, rim: { w: 0.1, h: 0.0015 }, fittings: [{ kind: 'valve', at: [0, 'mouth-0.15'], r: 0.01 }, { kind: 'tube', at: [0.8, 'mouth-0.35'], to: [1.6, 'chin-1.6'], r: 0.007, arch: 0.012 }, { kind: 'strap', at: [1.6, 'nose-0.1'], to: [3.1, 0.3], w: 0.01 }, { kind: 'strap', side: 'L', at: [1.6, 'nose-0.1'], to: [3.1, 0.3], w: 0.01 }] };
function pilotKit({ shell = {}, visor = 'down', housing = true, mask = true, earcups = 0.03, mic = false, stripes = false } = {}) {
  const fit = [...(earcups ? [1, -1].map((sg) => ({ kind: 'earpiece', at: [sg * 3.05, -0.35], r: earcups, h: 0.016, out: 0.004, group: 'Helmet', capGroup: 'HelmetTrim' })) : []),
    ...(mic ? [{ kind: 'arm', at: [2.9, -0.6], to: [0.7, 'mouth'], r: 0.0025, lift: 0.012, arch: 0.01, group: 'HelmetTrim' }, { kind: 'valve', at: [0.62, 'mouth'], r: 0.007, group: 'HelmetTrim' }] : [])];
  const helmet = helmetKit({ mouth: 'open', opening: 1.2, brow: 1.65, jaw: 0.7, nape: 0.05, pad: 0.018, shell: 24, thick: 0.004, rim: { w: 0.08, h: 0.002, group: 'HelmetTrim' }, ...(fit.length ? { fittings: fit } : {}), ...(stripes ? { ornaments: STRIPE } : {}), ...shell });
  const house = housing ? eyegearKit({ outline: { shape: 'visor', w: 2.35, h: 0.62, curve: 0.04 }, shift: [0, 1.95], eyes: { treat: visor === 'up' ? 'lens' : 'none', shape: 'shield', inset: [0.95, 0.6], dome: 0, group: 'HelmetVisor' }, group: 'HelmetTrim', thick: 0.003, front: { curve: true, shell: true, out: 0.03, max: 0.045 } }, { id: 'visorHousing' }) : [];
  const down = visor === 'down' || visor === 'display' ? eyegearKit({ outline: { shape: 'shield', w: 2.25, top: 1.5, bottom: visor === 'display' ? -1.3 : -0.45, notch: visor === 'display' ? 0 : 0.35 }, eyes: { treat: 'lens', shape: 'shield', inset: [0.97, 0.94], dome: 0, group: visor === 'display' ? 'EyeGlow' : 'HelmetVisor' }, group: 'HelmetTrim', thick: 0.003, front: { curve: true, shell: true, out: 0.032, max: 0.05 } }, { id: 'pilotVisor' }) : [];
  return [...helmet, ...house, ...down, ...(mask ? mouthpieceKit(OXYGEN, { id: 'oxygen', group: 'HelmetTrim', lift: 0.003 }) : [])];
}
// THE ASTRONAUT family: a great round padded shell, its window a wide VISOR (clear, gold, or a glowing strip), a gold
// visor SHELL standing off over it, HEADLAMPS, side VALVES, ANTENNAS, a CREST; each variation some of these dials
function astroKit({ shell = {}, window = { shape: 'shield', w: 3.0, top: 2.1, bottom: -2.3, notch: 0 }, visor = 'HelmetVisor', gold = false, lamps = false, valves = false, antennas = false, crest = null } = {}) {
  const fit = [...(lamps ? [1, -1].map((sg) => ({ kind: 'scope', at: [sg * 2.55, 2.0], r: 0.012, len: 0.03, group: 'HelmetTrim', lensGroup: 'EyeGlow' })) : []),
    ...(valves ? [1, -1].map((sg) => ({ kind: 'earpiece', at: [sg * 3.2, -1.0], r: 0.018, h: 0.012, out: 0.004, group: 'HelmetTrim', capGroup: 'EyeGlow' })) : []),
    ...(antennas ? [1, -1].map((sg) => ({ kind: 'antenna', at: [sg * 1.3, 2.6], len: 0.09, r: 0.0035, back: 0.15, up: 1.4, out: 0.002, group: 'HelmetTrim' })) : [])];
  const helmet = helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.15, pad: 0.045, shell: 40, thick: 0.004, window, eyes: { treat: 'lens', group: visor, dome: 0 }, rim: { w: 0.1, h: 0.003, group: 'HelmetTrim' }, ...(crest ? { ridge: crest } : {}), ...(fit.length ? { fittings: fit } : {}), ...shell });
  const goldShell = gold ? eyegearKit({ outline: { shape: 'shield', w: 2.9, top: 2.3, bottom: -1.2, notch: 0 }, eyes: { treat: 'lens', shape: 'shield', inset: [0.96, 0.94], dome: 0, group: 'GoldVisor' }, group: 'HelmetTrim', thick: 0.003, front: { curve: true, shell: true, out: 0.072, max: 0.09 } }, { id: 'goldVisor' }) : [];
  return [...helmet, ...goldShell];
}
// THE SEGMENTED FACELESS helmet: a full shell with no face showing, its face a closed FACEPLATE (the window kept whole, in
// its own colour, raised a little), its shell cut into SEGMENTS by panel lines (rings round the head, a line over the
// crown, lines down from the brow), with a crest, fins, a single glowing EYE, tubes: each variation some of these
const ring = (rho, from = -Math.PI, to = Math.PI, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ th: from + ((to - from) * i) / n, rho }));
export const SEGMENTS = Object.freeze({
  ribbed: [ring(0.55), ring(0.85), ring(1.15, 0.9, 2 * Math.PI - 0.9), [{ th: 0, rho: 0.05 }, { th: 0, rho: 1.0 }], [{ th: Math.PI, rho: 0.05 }, { th: Math.PI, rho: 1.9 }]],   // rings round the skull, a line over the crown
  plated: [ring(0.75, -2.5, 2.5), [{ th: 0, rho: 0.05 }, { th: Math.PI, rho: 0.05 }, { th: Math.PI, rho: 1.8 }], [{ th: 0.9, rho: 0.6 }, { th: 1.6, rho: 1.4 }], [{ th: -0.9, rho: 0.6 }, { th: -1.6, rho: 1.4 }], ring(1.35, 1.2, 2 * Math.PI - 1.2)],   // a brow plate, a crown line, temple cuts, a nape plate
  kabuto: [ring(0.4), ring(0.7), ring(1.0), ring(1.3, 1.1, 2 * Math.PI - 1.1), ring(1.6, 1.3, 2 * Math.PI - 1.3)],   // stacked lames round the head
});
// (a porcelain mask's painted STROKES, in the eyes' frame, each side's mirrored: the fox's flame over the brow and the
// whiskers on the cheek; the kabuki's sweep from the eye's corner up the temple and the red under the cheekbone)
const STROKE = (path, w = 0.0035, group = 'MaskStitch') => ({ kind: 'lines', path: path.map(([X, Z]) => ({ X, Z })), style: 'cord', w, group });
export const PAINT = Object.freeze({
  fox: [STROKE([[0.35, 1.0], [0.75, 1.55], [1.2, 1.75], [1.55, 1.6]]), STROKE([[0.7, 0.85], [1.15, 1.2], [1.6, 1.15]]), ...[-0.85, -1.15, -1.45].map((z, i) => STROKE([[0.95, z], [1.6 + 0.1 * i, z - 0.15 - 0.1 * i]], 0.0025))],
  kabuki: [STROKE([[0.35, 0.45], [1.0, 0.5], [1.55, 0.85], [1.9, 1.5]], 0.0045), STROKE([[0.3, 0.75], [0.8, 1.35], [1.35, 1.5]], 0.004), STROKE([[1.0, -0.9], [1.5, -0.6], [1.9, -0.1]], 0.005)],
});
// THE FACELESS BUILDER's words, each library optional and each word a fragment of the shell's options, so any of them
// compose on any face: PANELS (lines cut round the shell), ADORN (fins, horns, crests, ear discs: what stands off it),
// DETAILS (lenses, grilles, hoses, studs: the hardware on it), CUTS (slots and vents cut into it, dark and rimmed), PAINT
// (strokes and marks laid on it: the porcelain mask's face, a skull), SCULPT (dents and swells in it). Points are in the eyes' frame (X ±1 the eyes, Z up in half
// their spacing, a height a word: 'mouth-0.3'); a side's mark is mirrored to the other
const both = (P) => [P, P.map(([X, Z]) => [-X, Z])];
const SPIKE = (path, o) => ({ kind: 'spikes', path, group: 'HelmetTrim', ...o });
const BULB = (at, r, group, h = 0.003) => ({ kind: 'lens', at, r, h, group });
const CUT = (o) => ({ group: 'HelmetCut', rim: { group: 'HelmetTrim', w: 0.0018 }, ...o });
// (the SKULL's marks: the sockets, the nasal hole, a row of teeth on a line; a bone FACE or JAW laid under them on a dark
// mask; a higher `layer` lies over a lower)
const SOCKETS = (o = {}) => ({ shape: 'dot', at: [0.95, 0.05], w: 0.6, h: 0.52, tilt: 0.1, group: 'MaskSeam', layer: 1, ...o });
const NOSE = { shape: 'poly', at: [0, 'nose+0.2'], points: [[0, 0.42], [0.24, 0.05], [0.16, -0.25], [0, -0.08], [-0.16, -0.25], [-0.24, 0.05]], mirror: false, group: 'MaskSeam', layer: 1 };
const TEETH = (group = 'MaskSeam', layer = 1) => [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72].map((x) => ({ shape: 'slot', at: [x, 'mouth'], w: 0.045, h: 0.2, group, layer, mirror: false }));
const JAWLINE = { ...STROKE([[-0.95, 'mouth'], [0.95, 'mouth']], 0.0025, 'MaskSeam'), side: 'R' };
const BONE = (points) => ({ shape: 'poly', at: [0, 0], points, mirror: false, group: 'MaskBone', layer: 0 });
const PETALS = (cx, cz, r, n, w, group) => Array.from({ length: n }, (_, i) => ({ shape: 'dot', at: [cx + r * Math.cos((2 * Math.PI * i) / n), cz + r * Math.sin((2 * Math.PI * i) / n)], w, group, layer: 0, mirror: cx !== 0 }));
const GRILLE = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5].flatMap((x) => [0.7, 0.2, -0.3, -0.8, -1.3, -1.8].map((z) => [x, z])).filter(([x, z]) => (x / 1.75) ** 2 + ((z + 0.55) / 1.55) ** 2 < 1)
  .map(([x, z]) => ({ shape: 'dot', at: [x, z], w: 0.13, group: 'HelmetCut', mirror: false }));
export const FACELESS = Object.freeze({
  panels: { ...SEGMENTS,
    split: [[{ th: 0, rho: 0.45 }, { th: 0, rho: 0.05 }, { th: Math.PI, rho: 0.05 }, { th: Math.PI, rho: 1.9 }]],   // one line over the crown, brow to nape
    browBand: [ring(0.62, -1.7, 1.7)],                                                                                   // a band round the front over the brow
    cheek: both([[1.75, 1.3], [2.15, -0.4], [1.55, 'mouth-0.7']]),                                                      // down each side of the face
    jawPlate: [[[2.5, 'mouth+0.7'], [1.3, 'chin+0.35'], [-1.3, 'chin+0.35'], [-2.5, 'mouth+0.7']]],
    teardrop: both([[1.95, -0.32], [2.25, -1.3], [1.7, 'mouth-0.3'], [0.8, 'chin+0.45']]),                               // a tear down each cheek from the visor's end
    sideBands: both([[1.0, 2.3], [2.6, 0.9], [2.95, -1.2]]) },                                                          // a band swept down each side                   // a plate under the jaw
  adorn: {
    templeFins: [SPIKE('temple', { shape: 'fin', face: 'along', at: 0.9, len: 0.05, w: 0.045, up: 0.35, lean: 0.25 })],
    parietalFins: [SPIKE('parietal', { shape: 'fin', face: 'along', count: 3, len: 0.04, w: 0.03, profile: 'lead', up: 0.6, lean: 0.2 })],
    horns: [SPIKE('temple', { shape: 'cone', at: 0.85, len: 0.07, w: 0.03, up: 0.85, lean: 0.35 })],
    crestFin: [SPIKE('sagittal', { shape: 'fin', face: 'along', at: 0.3, len: 0.055, w: 0.11, up: 0.9, lean: 0 })],
    crownSpikes: [SPIKE('parietal', { shape: 'cone', count: 5, len: 0.03, w: 0.014, profile: 'crown', up: 0.7, lean: 0.15 })],
    ridge: { ridge: { w: 0.2, h: 0.006 } },
    earDiscs: { fittings: [3.0, -3.0].map((x) => ({ kind: 'earpiece', at: [x, -0.2], r: 0.017, h: 0.009, out: 0.002, group: 'HelmetTrim', capGroup: 'Helmet' })) },
    antennae: { fittings: [2.8, -2.8].map((x) => ({ kind: 'antenna', at: [x, 0.6], len: 0.08, r: 0.003, back: 1.2, up: 0.9, out: 0.002, group: 'HelmetTrim' })) },
    band: [{ kind: 'crest', path: 'sagittal', len: 0.006, thick: 0.024, profile: 'even', up: 0, group: 'HelmetTrim' }],             // a raised band brow to nape
    comb: [{ kind: 'crest', path: 'sagittal', len: 0.05, thick: 0.004, group: 'HelmetTrim' }],                                  // a blade over the crown
    griffin: [{ kind: 'crest', path: 'sagittal', len: 0.065, thick: 0.005, profile: 'lead', group: 'HelmetTrim' }],             // a blade high at the brow
    plume: [{ kind: 'crest', path: 'sagittal', style: 'plume', len: 0.06, thick: 0.02, group: 'Plume' }],                      // horsehair, brow to nape
    transversePlume: [{ kind: 'crest', path: [{ th: -Math.PI / 2, rho: 0.8 }, { th: -Math.PI / 2, rho: 0.05 }, { th: Math.PI / 2, rho: 0.05 }, { th: Math.PI / 2, rho: 0.8 }], side: 'R', style: 'plume', len: 0.055, thick: 0.02, group: 'Plume' }],   // horsehair ear to ear
    brim: { fittings: [{ kind: 'brim', at: [0, 1.25], len: 0.028, tilt: 0.45, t: 0.004, lift: 0.9, drop: 0.4, group: 'HelmetTrim' }] },    // a flange all round, swept up over the face
    neckGuard: { fittings: [{ kind: 'brim', at: [0, 'nose'], th: [2.0, 2 * Math.PI - 2.0], len: 0.035, tilt: 0.5, t: 0.003, group: 'HelmetTrim' }] },   // a flange behind only
    templeFlares: [SPIKE('temple', { shape: 'fin', face: 'along', at: 0.75, len: 0.045, w: 0.07, up: 0.45, lean: 0.35 })],      // swept flares off the temples
    rangefinder: { fittings: [{ kind: 'earpiece', at: [3.1, 0.2], r: 0.016, h: 0.01, out: 0.003, group: 'HelmetTrim', capGroup: 'HelmetTrim' }, { kind: 'antenna', at: [3.15, 0.8], len: 0.07, r: 0.004, back: 0.05, up: 1.6, out: 0.003, group: 'HelmetTrim' }, { kind: 'scope', at: [2.6, 1.5], r: 0.008, len: 0.022, group: 'HelmetTrim', lensGroup: 'EyeGlow' }] } },
  details: {
    monoEye: { fittings: [BULB([-0.95, 0.15], 0.01, 'EyeGlow', 0.004)] },
    twinEyes: { fittings: [BULB([0.95, 0.1], 0.007, 'EyeGlow'), BULB([-0.95, 0.1], 0.007, 'EyeGlow')] },
    grille: { fittings: [{ kind: 'grille', at: [0, 'mouth'], rows: 3, w: 0.5, step: 0.2, bar: 0.0026, group: 'HelmetTrim' }] },
    tubes: { fittings: [0.6, -0.6].map((x) => ({ kind: 'tube', at: [x, 'mouth-0.3'], to: [x * 4.4, 'chin-0.4'], r: 0.006, arch: 0.01, group: 'HelmetTrim' })) },
    filters: { fittings: [1.55, -1.55].map((x) => ({ kind: 'filter', at: [x, 'mouth-0.2'], r: 0.013, h: 0.012, group: 'HelmetTrim', capGroup: 'HelmetCut' })) },
    studs: { fittings: [[2.3, 'mouth+0.8'], [2.1, 'mouth+0.2'], [1.7, 'mouth-0.4']].flatMap(([x, z]) => [BULB([x, z], 0.0045, 'HelmetTrim', 0.0025), BULB([-x, z], 0.0045, 'HelmetTrim', 0.0025)]) } },
  cuts: {
    mouthSlit: [CUT({ shape: 'slot', at: [0, 'mouth'], w: 0.8, h: 0.08 })],
    mouthVents: ['mouth+0.25', 'mouth', 'mouth-0.25'].map((z) => CUT({ shape: 'slot', at: [0, z], w: 0.55, h: 0.055 })),
    cheekVents: ['mouth+0.55', 'mouth+0.25', 'mouth-0.05'].map((z) => CUT({ shape: 'slot', at: [1.55, z], w: 0.3, h: 0.05, tilt: -0.35 })),
    eyeSlits: [CUT({ shape: 'slot', at: [1.0, 0.05], w: 0.62, h: 0.075, tilt: 0.12 })],
    monoSlot: [CUT({ shape: 'slot', at: [0, 0.05], w: 1.8, h: 0.17 })],
    browSlot: [CUT({ shape: 'slot', at: [0, 1.55], w: 1.2, h: 0.08 })],
    templeVents: [0.7, 1.0].map((z) => CUT({ shape: 'slot', at: [2.45, z], w: 0.28, h: 0.05, tilt: 0.5 })),
    chinVents: ['mouth+0.05', 'mouth-0.2'].map((z) => CUT({ shape: 'slot', at: [0.75, z], w: 0.2, h: 0.04 })),
    eyeHoles: [CUT({ shape: 'dot', at: [0.95, 0.05], w: 0.2, h: 0.2 })],                                                     // two small round holes
    grille: GRILLE,                                                                                                          // a face pierced all over
    teeth: TEETH('HelmetCut', 0) },
  sculpt: {
    sockets: [{ at: [0.95, 0.05], r: 0.75, h: 0.006 }], nasal: [{ at: [0, 'nose+0.25'], r: 0.32, h: 0.004 }], cheeks: [{ at: [1.55, 'mouth+0.55'], r: 0.6, h: 0.003 }],
    temples: [{ at: [2.3, 0.9], r: 0.6, h: 0.0025 }], brow: [{ at: [0.9, 1.0], r: 0.55, h: -0.002 }], chin: [{ at: [0, 'chin+0.5'], r: 0.7, h: -0.002 }] },
  paint: {
    fox: PAINT.fox, kabuki: PAINT.kabuki,
    tears: [STROKE([[1.0, -0.35], [1.02, -0.9], [0.95, -1.5]], 0.003, 'MaskStitch')],
    oni: [STROKE([[0.3, 0.5], [0.9, 0.85], [1.5, 1.2]], 0.006, 'MaskStitch'), STROKE([[0.4, 'mouth+0.3'], [0.9, 'mouth-0.1'], [1.1, 'mouth-0.5']], 0.004, 'MaskStitch')],
    stripes: [STROKE([[1.0, 1.7], [1.0, 0.35]], 0.004, 'MaskStitch'), STROKE([[1.0, -0.3], [1.0, -1.4]], 0.004, 'MaskStitch')],
    kintsugi: [{ ...STROKE([[0.15, 2.3], [0.35, 1.6], [0.1, 1.1], [0.55, 0.45], [0.4, -0.6], [0.85, -1.4], [0.7, 'mouth+0.2']], 0.0022, 'MaskGold'), side: 'R' }, { ...STROKE([[-1.9, 1.0], [-1.4, 0.75], [-1.5, 0.2], [-0.95, -0.35]], 0.0022, 'MaskGold'), side: 'R' }],
    thirdEye: { decals: [{ shape: 'dot', at: [0, 1.35], w: 0.11, h: 0.15, group: 'MaskStitch' }] },
    blush: { decals: [{ shape: 'dot', at: [1.45, 'mouth+0.7'], w: 0.32, h: 0.2, group: 'MaskBlush' }] },
    lips: { decals: [{ shape: 'slot', at: [0, 'mouth'], w: 0.22, h: 0.07, group: 'MaskStitch' }] },
    skull: { decals: [SOCKETS(), NOSE, ...TEETH()], ornaments: [JAWLINE] },                                                    // sockets, nose, teeth on the face itself
    skullFace: { decals: [BONE([[-2.1, 1.0], [-1.7, 2.2], [-0.8, 2.75], [0.8, 2.75], [1.7, 2.2], [2.1, 1.0], [2.0, -0.5], [1.55, 'mouth+0.6'], [1.25, 'chin+0.6'], [0.6, 'chin+0.25'], [-0.6, 'chin+0.25'], [-1.25, 'chin+0.6'], [-1.55, 'mouth+0.6'], [-2.0, -0.5]]), SOCKETS(), NOSE, ...TEETH()], ornaments: [JAWLINE] },   // a bone skull painted on a dark face
    skullJaw: { decals: [BONE([[-1.9, 'nose+0.15'], [1.9, 'nose+0.15'], [1.6, 'mouth+0.6'], [1.25, 'chin+0.6'], [0.6, 'chin+0.25'], [-0.6, 'chin+0.25'], [-1.25, 'chin+0.6'], [-1.6, 'mouth+0.6']]), NOSE, ...TEETH()], ornaments: [JAWLINE] },   // the bone jaw over the lower face
    sugar: { decals: [SOCKETS({ w: 0.8, h: 0.72, group: 'MaskGold', layer: 0 }), SOCKETS({ layer: 1 }), ...PETALS(0.95, 0.05, 1.0, 8, 0.12, 'MaskBlush'), ...PETALS(0, 1.95, 0.32, 6, 0.14, 'MaskBlush'), { shape: 'dot', at: [0, 1.95], w: 0.15, group: 'MaskGold', layer: 1, mirror: false }, NOSE, ...TEETH()], ornaments: [JAWLINE] },   // flowers round the sockets and on the brow
    cracks: [{ ...STROKE([[0.2, 2.4], [0.45, 1.7], [0.2, 1.2], [0.6, 0.7]], 0.0022, 'MaskSeam'), side: 'R' }, { ...STROKE([[-1.7, 1.6], [-1.3, 1.1], [-1.45, 0.7]], 0.0022, 'MaskSeam'), side: 'R' }] },
});
// a library's words as one fragment: the list words merged (spikes and strokes into ornaments, cuts into decals)
const fragment = (lib, words, as) => (words || []).map((w) => { const v = typeof w === 'string' ? FACELESS[lib][w] : w; if (v === undefined) throw new Error(`comic-hero: no ${lib} '${w}' (known: ${Object.keys(FACELESS[lib]).join(', ')})`); return Array.isArray(v) ? { [as]: v } : v; })
  .reduce((A, F) => { for (const [k, v] of Object.entries(F)) A[k] = Array.isArray(v) ? [...(A[k] || []), ...v] : v; return A; }, {});
export function facelessKit({ face = { shape: 'shield', w: 2.4, top: 1.1, bottom: -2.2, notch: 0 }, faceGroup = 'Faceplate', faceTreat = 'lens', eyes = null, panels = ['ribbed'], adorn = [], details = [], cuts = [], sculpt = [], paint = [], pad = 0.016, blank = true, over = {} } = {}) {
  // (the face: a FACEPLATE window set in its line, or `face` null and painted EYES on the blank (a porcelain mask's), or
  // `eyes: false`, none at all; `faceTreat: 'open'` the window cut through: the face shows; `over` the shell's own dials)
  const front = face ? { window: face, windowSeam: true, eyes: { treat: faceTreat, group: faceGroup, dome: 0 } }
    : { eyes: eyes === false ? { treat: 'none', dome: 0 } : { treat: 'paint', shape: 'slit', size: [0.62, 0.2], tilt: 0.25, group: 'MaskSeam', dome: 0, ...(eyes || {}) } };
  const F = [fragment('panels', typeof panels === 'string' ? [panels] : panels, 'panels'), fragment('adorn', adorn, 'ornaments'), fragment('details', details, 'fittings'), fragment('cuts', cuts, 'decals'), fragment('sculpt', sculpt, 'dents'), fragment('paint', paint, 'ornaments')]
    .reduce((A, G) => { for (const [k, v] of Object.entries(G)) A[k] = Array.isArray(v) ? [...(A[k] || []), ...v] : v; return A; }, {});
  return helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.08, pad, shell: 24, thick: 0.004, cell: 0.04, blank, ...front, rim: { w: 0.07, h: 0.0015, group: 'HelmetTrim' }, seamGroup: 'HelmetSeam', ...F, ...over });
}
const HELMETED = (reads, kit, palette) => ({ reads, family: 'helmet', at: { tiered: (spec) => withHelm({ ...spec, palette: { ...(spec.palette || {}), ...palette } }, typeof kit === 'function' ? kit(spec) : helmetKit(kit)) } });
/** an eyegear's kit from its word (EYEGEAR) or its own data: the cast carried by a ghost shell on the cranium */
export function eyegearKit(word, { id = 'eyegear', over = {} } = {}) {
  const W = typeof word === 'object' ? word : EYEGEAR[word];
  if (!W) throw new Error(`comic-hero: no eyegear '${word}' (known: ${Object.keys(EYEGEAR).join(', ')})`);
  return [{ id, mode: 'shell', part: 'cranium', share: true, s: [0.8, 0.98], t: 'wrap', nt: 8, ns: 1, mugen: 0.002, thick: 0.004, rad: 0.01, group: W.group ?? 'Mask', rigid: true, stack: false, ghost: true, signature: { kind: 'cast', group: 'Mask', ...W, ...over } }];
}
const EYEWEAR = (reads, word, palette) => ({ reads, family: 'eyegear', words: { eyegear: word }, at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), ...palette } }, eyegearKit(word)) } });

// the masks' VARIATIONS, each the builder's words (tiered: the cast rides the landmark head): eyegear's DOMINO kind
const MASK = (reads, words) => ({ reads, family: 'eyegear', words, at: { tiered: (spec) => withKit(spec, maskKit({ ...words, head: spec.head })) } });

export const HEADGEAR = Object.freeze({
  // ── HELMETS ──
  bikerHelmet: HELMETED('the biker helmet: a full-face shell, a smoked visor, a double racing stripe over the crown; the rider', 'fullFace', { Helmet: '#c62828', HelmetVisor: '#20252c', HelmetTrim: '#f2f2f2' }),
  motocrossHelmet: HELMETED('the motocross helmet: a full-face shell with an open window for goggles, a peak over the brow, a stripe; the dirt racer', 'motocross', { Helmet: '#f2c230', HelmetTrim: '#1b1d22' }),
  enduroHelmet: HELMETED('the enduro helmet: the motocross shell with a shorter peak and a vented chin bar; the trail rider', 'enduro', { Helmet: '#ff6a13', HelmetTrim: '#1b1d22' }),
  downhillHelmet: HELMETED('the downhill helmet: a wide window for big goggles, a broad peak, a vented chin bar; the mountain racer', 'downhill', { Helmet: '#2b6cb0', HelmetTrim: '#f2f2f2' }),
  adventureHelmet: HELMETED('the adventure helmet: a smoked visor under a short peak; the dual-sport traveller', 'adventure', { Helmet: '#d9d6cc', HelmetTrim: '#3a3d43', HelmetVisor: '#23282f' }),
  bmxHelmet: HELMETED('the BMX helmet: a steep peak, a heavily vented chin bar, a stripe; the street rider', 'bmx', { Helmet: '#1f9e5a', HelmetTrim: '#101215' }),
  desertHelmet: HELMETED('the desert helmet: a vintage open face under a peak; the rally rider', 'desert', { Helmet: '#c9b48a', HelmetTrim: '#5a3b22' }),
  raiderHelmet: HELMETED('the raider helmet: a narrow visor slot, a crest over the crown, a peak, a vented chin; the wasteland raider', 'raider', { Helmet: '#3a3530', HelmetTrim: '#b3261e', HelmetVisor: '#151719' }),
  jetHelmet: HELMETED('the jet helmet: an open-face shell, the whole face shown, a rim round the opening; the scooter rider', 'jet', { Helmet: '#e8e2d4', HelmetTrim: '#6b4a2b' }),
  pilotHelmet: HELMETED('the pilot helmet: an open-face shell, a dark visor standing off over the eyes, an oxygen mask with its hose; the ace', () => [...helmetKit('jet', { over: { brow: 1.6 } }),
    ...eyegearKit({ outline: { shape: 'shield', w: 2.2, top: 1.25, bottom: -0.5, notch: 0.35 }, eyes: { treat: 'lens', shape: 'shield', inset: [0.96, 0.9], dome: 0, group: 'HelmetVisor' }, group: 'HelmetTrim', thick: 0.003, front: { curve: true, shell: true, out: 0.026, max: 0.045 } }, { id: 'pilotVisor' }),
    ...mouthpieceKit('rebreather', { id: 'oxygen', group: 'HelmetTrim' })], { Helmet: '#7d8b6a', HelmetTrim: '#3b4030', HelmetVisor: '#3a2a12', MaskFitting: '#2b2f36' }),
  tacticalHelmet: HELMETED('the tactical helmet: a cut-high bump shell, the ears and the face shown, mounts at the front and the sides; the operator', 'tactical', { Helmet: '#6b6a4a', HelmetTrim: '#2f2f26' }),
  // ── JET PILOTS ──
  fighterPilot: HELMETED('the fighter pilot: a grey shell, a smoked visor down over the eyes from its housing, the oxygen mask and its hose; the ace', () => pilotKit(), { Helmet: '#8a9099', HelmetTrim: '#3a3f47', HelmetVisor: '#2a2f36', MaskFitting: '#2b2f36' }),
  topPilot: HELMETED('the top pilot: a white shell with stripes, the visor up in its housing, the mask on; the hotshot', () => pilotKit({ visor: 'up', stripes: true }), { Helmet: '#f2f2f2', HelmetTrim: '#b3261e', HelmetVisor: '#23282f', MaskFitting: '#2b2f36' }),
  testPilot: HELMETED('the test pilot: a white shell, a gold visor down, the mask on; the right stuff', () => pilotKit(), { Helmet: '#f4f5f7', HelmetTrim: '#9aa1ab', HelmetVisor: '#d4a73a', MaskFitting: '#2b2f36' }),
  heliPilot: HELMETED('the helicopter pilot: a bulky shell, big earcups, a boom mic before the mouth, the visor up; the rotor jockey', () => pilotKit({ visor: 'up', mask: false, mic: true, earcups: 0.04, shell: { pad: 0.024 } }), { Helmet: '#5f6b4e', HelmetTrim: '#22261c', HelmetVisor: '#2a2f36' }),
  aviatorCap: HELMETED('the aviator\'s cap: a leather cap close on the head with ear flaps, moto goggles pushed up on the forehead; the barnstormer', () => [...helmetKit({ mouth: 'open', opening: 1.15, brow: 1.4, jaw: 0.9, nape: 0.1, pad: 0.004, shell: 6, thick: 0.003, rim: { w: 0.1, h: 0.0015, group: 'HelmetTrim' } }), ...eyegearKit('moto', { over: { shift: [0, 2.0], strap: { z: 2.0, h: 0.4 } } })], { Helmet: '#6b4426', HelmetTrim: '#4a2e18', EyeFrame: '#5a3b22', EyeTrim: '#b08d3c', EyeLens: '#8fb9bd', EyeStrap: '#4a3020' }),
  displayPilot: HELMETED('the display pilot: a dark shell, a great display visor glowing over the whole face; the drone pilot', () => pilotKit({ visor: 'display', mask: false, housing: false }), { Helmet: '#22252b', HelmetTrim: '#3a3f47', EyeGlow: '#58e1ff' }),
  // ── ASTRONAUTS ──
  apolloHelmet: HELMETED('the moon helmet: a white bubble, a gold visor shell standing off over it; the moonwalker', () => astroKit({ gold: true, visor: 'HelmetVisor' }), { Helmet: '#f4f5f7', HelmetVisor: '#b9d4e0', HelmetTrim: '#c9ccd2', GoldVisor: '#d4a73a' }),
  evaHelmet: HELMETED('the spacewalk helmet: a white shell, a gold visor, headlamps at its temples; the station engineer', () => astroKit({ visor: 'GoldVisor', lamps: true }), { Helmet: '#f4f5f7', HelmetTrim: '#9aa1ab', GoldVisor: '#d4a73a', EyeGlow: '#fff4c2' }),
  softSpaceHelmet: HELMETED('the soft space helmet: a cloth hood, a hinged clear visor, valves at its sides; the cosmonaut', () => astroKit({ shell: { pad: 0.012, shell: 10 }, window: { shape: 'shield', w: 2.6, top: 1.7, bottom: -1.9, notch: 0 }, valves: true }), { Helmet: '#e9e6dc', HelmetVisor: '#b9d4e0', HelmetTrim: '#3b5b8c', EyeGlow: '#c62828' }),
  fishbowlHelmet: HELMETED('the fishbowl helmet: a great clear bubble standing far off the head, two antennas over it; the rocket ranger', () => astroKit({ shell: { pad: 0.065 }, window: { shape: 'shield', w: 3.2, top: 2.3, bottom: -2.6, notch: 0 }, antennas: true }), { Helmet: '#cfd8dc', HelmetVisor: '#bfe3ef', HelmetTrim: '#c62828' }),
  scifiSpaceHelmet: HELMETED('the sci-fi space helmet: a sleek dark shell, a glowing visor strip across the eyes, a crest over the crown; the void marine', () => astroKit({ shell: { pad: 0.026 }, window: { shape: 'visor', w: 2.7, h: 0.75, curve: 0.04 }, visor: 'EyeGlow', crest: { w: 0.22, h: 0.006 } }), { Helmet: '#26292f', HelmetTrim: '#58e1ff', EyeGlow: '#58e1ff' }),
  // ── SCI-FI ── (the full-face shell's dials: a window of any shape, a visor in it, a crest, fittings)
  hunterHelmet: HELMETED('the hunter\'s helmet: a gunmetal shell, a T-shaped visor, a rangefinder stalk at the side; the bounty hunter', () => helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.08, pad: 0.016, shell: 24, thick: 0.004, cell: 0.04,
    window: { poly: [[-1.9, 0.3], [1.9, 0.3], [1.9, -0.25], [0.32, -0.25], [0.32, -2.0], [-0.32, -2.0], [-0.32, -0.25], [-1.9, -0.25]] }, eyes: { treat: 'lens', group: 'HelmetVisor', dome: 0 }, rim: { w: 0.06, h: 0.0015, group: 'HelmetTrim' },
    fittings: [{ kind: 'earpiece', at: [3.1, 0.2], r: 0.016, h: 0.01, out: 0.003, group: 'HelmetTrim', capGroup: 'HelmetTrim' }, { kind: 'antenna', at: [3.15, 0.8], len: 0.07, r: 0.004, back: 0.05, up: 1.6, out: 0.003, group: 'HelmetTrim' }, { kind: 'scope', at: [2.6, 1.5], r: 0.008, len: 0.022, group: 'HelmetTrim', lensGroup: 'EyeGlow' }] }), { Helmet: '#6f7680', HelmetTrim: '#8e2a22', HelmetVisor: '#111316', EyeGlow: '#e0202a' }),
  trooperHelmet: HELMETED('the trooper\'s helmet: a white shell, angled dark eye lenses, a breathing grille at the mouth, discs at the sides; the imperial trooper', () => helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.08, pad: 0.018, shell: 24, thick: 0.004,
    eyes: { shape: 'angular', size: [0.85, 0.48], tilt: -0.28, treat: 'lens', group: 'HelmetVisor', dome: 0 }, rim: { w: 0.06, h: 0.0015, group: 'HelmetTrim' },
    fittings: [{ kind: 'grille', at: [0, 'mouth-0.2'], rows: 4, w: 0.5, step: 0.15, bar: 0.0024, group: 'HelmetTrim' }, { kind: 'earpiece', at: [3.0, -0.4], r: 0.02, h: 0.008, out: 0.003, group: 'Helmet', capGroup: 'HelmetTrim' }, { kind: 'earpiece', at: [-3.0, -0.4], r: 0.02, h: 0.008, out: 0.003, group: 'Helmet', capGroup: 'HelmetTrim' }] }), { Helmet: '#f2f3f5', HelmetTrim: '#1b1d22', HelmetVisor: '#111316' }),
  spartanHelmet: HELMETED('the spartan helmet: an olive full-face shell, a wide gold visor, a crest over the crown, a vented chin; the super soldier', () => helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.08, pad: 0.02, shell: 24, thick: 0.004, ridge: { w: 0.24, h: 0.007 },
    window: { shape: 'shield', w: 2.5, top: 0.95, bottom: -0.95, notch: 0.1 }, eyes: { treat: 'lens', group: 'GoldVisor', dome: 0.003 }, rim: { w: 0.08, h: 0.002, group: 'HelmetTrim' },
    fittings: [{ kind: 'grille', at: [0, 'mouth-0.35'], rows: 2, w: 0.45, step: 0.2, bar: 0.0028, group: 'HelmetTrim' }, { kind: 'earpiece', at: [3.0, -0.2], r: 0.018, h: 0.01, out: 0.003, group: 'HelmetTrim', capGroup: 'Helmet' }, { kind: 'earpiece', at: [-3.0, -0.2], r: 0.018, h: 0.01, out: 0.003, group: 'HelmetTrim', capGroup: 'Helmet' }] }), { Helmet: '#4f5a3c', HelmetTrim: '#2b2f25', GoldVisor: '#d4a73a' }),
  synthHelmet: HELMETED('the synth helmet: a sleek white shell, a glowing strip across the eyes, cords along the jaw; the android', () => helmetKit({ mouth: 'cover', jaw: 1.0, nape: 0.08, pad: 0.014, shell: 30, thick: 0.004,
    window: { shape: 'visor', w: 2.6, h: 0.5, curve: 0.04 }, eyes: { treat: 'lens', group: 'EyeGlow', dome: 0 }, rim: { w: 0.06, h: 0.0012, group: 'HelmetTrim' }, ornaments: [{ kind: 'lines', path: 'jaw', style: 'cord', w: 0.004, group: 'HelmetTrim' }] }), { Helmet: '#f4f5f7', HelmetTrim: '#9aa1ab', EyeGlow: '#ff4fd8' }),
  // ── SEGMENTED FACELESS ──
  cyborgNinja: HELMETED('the cyborg ninja: a silver shell ribbed round the skull, a smooth faceplate split by a centre ridge, one red eye aglow; the stealth cyborg', () => facelessKit({ face: { shape: 'shield', w: 2.3, top: 1.25, bottom: -2.3, notch: 0 }, panels: ['ribbed'], adorn: [{ ridge: { w: 0.16, h: 0.004 } }], details: ['monoEye'] }), { Helmet: '#b9bec6', HelmetSeam: '#2a2e35', HelmetTrim: '#5b616b', Faceplate: '#9ba2ac', EyeGlow: '#ff2a2a' }),
  ventedNinja: HELMETED('the vented ninja: a dark shell split over the crown, no face but three vents cut across the mouth and the cheeks, ear discs, two small eyes aglow; the shadow cyborg', () => facelessKit({ face: null, eyes: false, panels: ['split', 'cheek', 'jawPlate'], adorn: ['earDiscs'], details: ['twinEyes'], cuts: ['mouthVents', 'cheekVents'] }), { Helmet: '#2b2f36', HelmetSeam: '#0e1013', HelmetTrim: '#6b7280', HelmetCut: '#07080a', EyeGlow: '#34e0ff' }),
  hunterGuardian: HELMETED('the hunter guardian: a dark faceplate sharp as a V, a plated shell, a fin swept back off each temple; the space hunter', () => facelessKit({ face: { poly: [[-2.3, 1.0], [2.3, 1.0], [2.0, -0.6], [0.7, -1.6], [0, -2.3], [-0.7, -1.6], [-2.0, -0.6]] }, panels: ['plated'], adorn: ['templeFins'], cuts: ['templeVents'] }), { Helmet: '#4a5240', HelmetSeam: '#1b1e17', HelmetTrim: '#c9a227', Faceplate: '#1b1f26' }),
  titanGuardian: HELMETED('the titan guardian: a bulky plated shell, a narrow faceplate, a crest over the crown, bolts down the jaw; the space knight', () => facelessKit({ face: { shape: 'shield', w: 1.9, top: 0.7, bottom: -2.2, notch: 0 }, panels: ['plated', 'jawPlate'], adorn: [{ ridge: { w: 0.3, h: 0.009 } }], details: ['studs'], pad: 0.026 }), { Helmet: '#8a8f99', HelmetSeam: '#2a2e35', HelmetTrim: '#b3261e', Faceplate: '#2a2f39' }),
  warlockGuardian: HELMETED('the warlock guardian: a sleek shell, a gold faceplate, a crown of fins along the top of its sides; the space mage', () => facelessKit({ face: { shape: 'shield', w: 2.2, top: 1.4, bottom: -2.2, notch: 0 }, panels: ['ribbed'], adorn: ['parietalFins'] }), { Helmet: '#e9e4d8', HelmetSeam: '#7a6a45', HelmetTrim: '#c9a227', Faceplate: '#d4a73a' }),
  roninHelmet: HELMETED('the ronin: a dark lacquered shell in stacked lames, a red faceplate, a crest fin over the crown; the cyber samurai', () => facelessKit({ face: { shape: 'shield', w: 2.2, top: 1.0, bottom: -2.3, notch: 0 }, panels: ['kabuto'], adorn: ['crestFin'] }), { Helmet: '#1f1d22', HelmetSeam: '#c9a227', HelmetTrim: '#c9a227', Faceplate: '#8e1a15' }),
  monoEye: HELMETED('the mono-eye: a plated shell, a dark slot cut across the face with one pink eye in it, hoses from the mouth to the sides; the war machine', () => facelessKit({ face: null, eyes: false, panels: ['plated'], cuts: ['monoSlot'], details: [{ fittings: [{ kind: 'lens', at: [0.35, 0.05], r: 0.011, h: 0.004, group: 'EyeGlow' }] }, 'tubes'] }), { Helmet: '#4f6b3a', HelmetSeam: '#22301a', HelmetTrim: '#2b2f36', HelmetCut: '#0d120a', EyeGlow: '#ff4fd8' }),
  // ── PORCELAIN: the blank face as a mask, no plate, eyes and strokes painted on ──
  foxPorcelain: HELMETED('the porcelain fox: a white blank face, slanted painted eyes, red flame over the brow and whiskers on the cheeks; the shrine ninja', () => facelessKit({ face: null, panels: [], eyes: { size: [0.75, 0.26] }, paint: ['fox'] }), { Helmet: '#f3efe8', HelmetTrim: '#d8d2c7', MaskSeam: '#111216', MaskStitch: '#c4231c' }),
  kabukiPorcelain: HELMETED('the kabuki: a white blank face, narrow dark eyes, bold strokes swept up from the eyes to the temples, painted lips; the stage demon', () => facelessKit({ face: null, panels: [], eyes: { shape: 'almond', size: [0.6, 0.16], tilt: 0.35 }, paint: ['kabuki', 'lips'] }), { Helmet: '#f5f3ee', HelmetTrim: '#1b1d22', MaskSeam: '#111216', MaskStitch: '#b3261e' }),
  nohPorcelain: HELMETED('the noh: a pale blank face, two small dark eyes, a faint blush; the silent one', () => facelessKit({ face: null, panels: [], eyes: { shape: 'round', size: [0.2, 0.14], tilt: 0 }, paint: ['blush'] }), { Helmet: '#efe6d6', HelmetTrim: '#cfc3ad', MaskSeam: '#101114', MaskBlush: '#efc2bd' }),
  oniPorcelain: HELMETED('the oni: a red blank face, angry painted brows and fangs of paint, horns off the temples, a slot of a mouth cut in it; the demon mask', () => facelessKit({ face: null, panels: [], eyes: { shape: 'angular', size: [0.6, 0.3], tilt: 0.3 }, paint: ['oni'], adorn: ['horns'], cuts: ['mouthSlit'] }), { Helmet: '#a3221b', HelmetTrim: '#e9e0cf', MaskSeam: '#121010', MaskStitch: '#131212', HelmetCut: '#0a0606' }),
  kintsugiMask: HELMETED('the kintsugi: a white blank face mended in gold, cracks running across it, slit eyes cut in, a third eye painted on the brow; the broken saint', () => facelessKit({ face: null, eyes: false, panels: [], cuts: ['eyeSlits'], paint: ['kintsugi', 'thirdEye'] }), { Helmet: '#f2efe9', HelmetTrim: '#d4a73a', HelmetCut: '#101114', MaskStitch: '#d4a73a', MaskGold: '#d4a73a' }),
  // ── SKULLS: the skull's marks painted or sculpted on the blank, or a bone skull painted on a dark face ──
  boneSkull: HELMETED('the bone skull: a bone-white face sculpted into sockets, a nasal hollow and sunken cheeks, the sockets dark, a row of teeth; the death mask', () => facelessKit({ face: null, eyes: false, panels: [], sculpt: ['sockets', 'nasal', 'cheeks', 'temples'], paint: ['skull'] }), { Helmet: '#ece6d6', HelmetTrim: '#cfc6b0', MaskSeam: '#16120e' }),
  paintedSkull: HELMETED('the painted skull: a black face with a bone skull painted on it, dark sockets, the teeth; the vigilante', () => facelessKit({ face: null, eyes: false, panels: [], paint: ['skullFace'] }), { Helmet: '#15161a', HelmetTrim: '#2a2c31', MaskBone: '#f1ede4', MaskSeam: '#0d0d10' }),
  skullBalaclava: HELMETED('the skull balaclava: a dark hood close on the head, the eyes open, a bone jaw printed over the mouth; the ghost operator', () => facelessKit({ face: { shape: 'visor', w: 2.2, h: 0.62, curve: 0 }, faceTreat: 'open', blank: false, pad: 0.004, panels: [], paint: ['skullJaw'], over: { shell: 16, thick: 0.003, decalLift: 0.0025, rim: { w: 0.05, h: 0.001, group: 'HelmetTrim' } } }), { Helmet: '#2a2d27', HelmetTrim: '#22241f', MaskBone: '#e8e2d2', MaskSeam: '#121310' }),
  sugarSkull: HELMETED('the sugar skull: a white face, sockets ringed in gold and petals, a flower on the brow, the teeth stitched; the day of the dead', () => facelessKit({ face: null, eyes: false, panels: [], sculpt: ['sockets'], paint: ['sugar'] }), { Helmet: '#f6f2ea', HelmetTrim: '#e2d9c6', MaskSeam: '#141218', MaskGold: '#e0a526', MaskBlush: '#e0457b' }),
  skullKnight: HELMETED('the skull knight: a dark iron helm sculpted as a skull, red eyes deep in its sockets, teeth cut through, horns; the death knight', () => facelessKit({ face: null, eyes: false, panels: ['split'], sculpt: ['sockets', 'nasal', 'cheeks', 'brow'], cuts: ['teeth'], details: ['twinEyes'], adorn: ['horns'], paint: [{ decals: [SOCKETS({ group: 'HelmetCut', layer: 0 }), { ...NOSE, group: 'HelmetCut', layer: 0 }] }] }), { Helmet: '#3a3d44', HelmetSeam: '#1c1e22', HelmetTrim: '#7d838d', HelmetCut: '#0a0a0c', EyeGlow: '#ff2a1a' }),
  // ── GLADIATORS: brims, crests and plumes, grilles and eyeholes ──
  fishGladiator: HELMETED('the fish gladiator: a bronze helm, a wide brim all round, a face grille pierced all over, a blade crest over the crown; the arena heavy', () => facelessKit({ face: { shape: 'shield', w: 2.1, top: 1.2, bottom: -2.5, notch: 0 }, faceGroup: 'Faceplate', panels: [], cuts: ['grille'], adorn: ['brim', 'comb'] }), { Helmet: '#a8743a', Faceplate: '#c08f4f', HelmetSeam: '#5e3f1c', HelmetTrim: '#7a5326', HelmetCut: '#0d0907' }),
  griffinGladiator: HELMETED('the griffin gladiator: a steel helm, a brim swept up at the front, a grille, a tall crest rising high at the brow, a plume behind it; the arena duellist', () => facelessKit({ face: { shape: 'shield', w: 2.0, top: 1.1, bottom: -2.5, notch: 0 }, faceGroup: 'Faceplate', panels: [], cuts: ['grille'], adorn: ['brim', 'griffin', 'plume'] }), { Helmet: '#9aa0a8', Faceplate: '#b2b7be', HelmetSeam: '#3c4047', HelmetTrim: '#b08440', HelmetCut: '#0b0c0e', Plume: '#c9b07a' }),
  chaserGladiator: HELMETED('the chaser gladiator: a smooth egg of a helm, two small round eyeholes, a low fin over the crown; the arena hunter', () => facelessKit({ face: null, eyes: false, panels: [], cuts: ['eyeHoles'], adorn: [{ ornaments: [{ kind: 'crest', path: 'sagittal', len: 0.022, thick: 0.004, profile: 'even', group: 'Helmet' }] }, 'neckGuard'] }), { Helmet: '#b9bdc4', HelmetTrim: '#868b93', HelmetCut: '#0b0c0e' }),
  hopliteHelm: HELMETED('the hoplite helm: a bronze helm closed round the face but for a Y opening, a red horsehair plume brow to nape; the spartan warrior', () => facelessKit({ face: { poly: [[-1.75, 0.45], [-0.35, 0.3], [-0.2, -0.4], [-0.2, -2.6], [0.2, -2.6], [0.2, -0.4], [0.35, 0.3], [1.75, 0.45], [1.6, -0.25], [0.55, -0.4], [0.5, -1.0], [0.75, -2.4], [-0.75, -2.4], [-0.5, -1.0], [-0.55, -0.4], [-1.6, -0.25]] }, faceTreat: 'open', panels: [], sculpt: ['brow'], adorn: ['plume'] }), { Helmet: '#b07a3a', HelmetSeam: '#5e3f1c', HelmetTrim: '#7a5326', Plume: '#b3261e' }),
  legionHelm: HELMETED('the legion helm: a steel open-face helm, a neck guard, a red horsehair crest ear to ear; the centurion', () => facelessKit({ face: null, eyes: false, blank: false, pad: 0.012, panels: ['browBand'], adorn: ['transversePlume', 'neckGuard'], over: { mouth: 'open', opening: 0.85 } }), { Helmet: '#a7adb5', HelmetSeam: '#4a4f57', HelmetTrim: '#b08440', Plume: '#b3261e' }),
  // ── PEAKED HELMS: open face, the edge dipping to a point over the nose, a ridge, flares at the temples ──
  peakedHelm: HELMETED('the peaked helm: a red open-face helm, its edge dipping to a point over the nose, a raised band over the crown, flares swept off the temples, purple trim; the master of metals', () => facelessKit({ face: null, eyes: false, blank: false, pad: 0.012, panels: ['sideBands'], adorn: ['band', 'templeFlares'], over: { mouth: 'open', opening: 0.72, openCurve: 3, jaw: 0.95, peak: { depth: 1.1, w: 0.4 }, rim: { w: 0.09, h: 0.002, group: 'HelmetTrim' } } }), { Helmet: '#b0202a', HelmetSeam: '#4b2266', HelmetTrim: '#5b2a7a' }),
  ironPeaked: HELMETED('the iron peaked helm: the peaked helm in black and silver, horns rising off the temples; the dark master', () => facelessKit({ face: null, eyes: false, blank: false, pad: 0.012, panels: ['sideBands', 'split'], adorn: ['band', 'horns'], over: { mouth: 'open', opening: 0.72, openCurve: 3, jaw: 0.95, peak: { depth: 1.2, w: 0.35 }, rim: { w: 0.09, h: 0.002, group: 'HelmetTrim' } } }), { Helmet: '#1e2026', HelmetSeam: '#8a9099', HelmetTrim: '#b9bec6' }),
  crownPeaked: HELMETED('the crowned peaked helm: a gold peaked helm, a crown of spikes along the top of its sides, a deep point over the nose; the sovereign', () => facelessKit({ face: null, eyes: false, blank: false, pad: 0.012, panels: ['sideBands'], adorn: ['band', 'crownSpikes', 'templeFlares'], over: { mouth: 'open', opening: 0.75, openCurve: 3, jaw: 0.95, peak: { depth: 1.5, w: 0.3 }, rim: { w: 0.09, h: 0.002, group: 'HelmetTrim' } } }), { Helmet: '#c9a227', HelmetSeam: '#7a5d12', HelmetTrim: '#6e1414' }),
  // ── T-VISORS: the blank face cut by a T-shaped visor, a tear down each cheek, a rangefinder ──
  tVisorHelm: HELMETED('the T-visor helm: a silver blank-faced helm, a black T visor, a tear down each cheek, vents under the visor, a rangefinder at the side; the bounty hunter', () => facelessKit({ face: { poly: [[-1.9, 0.35], [1.9, 0.35], [1.9, -0.3], [0.34, -0.3], [0.34, -2.0], [-0.34, -2.0], [-0.34, -0.3], [-1.9, -0.3]] }, faceGroup: 'HelmetVisor', panels: ['teardrop'], cuts: ['chinVents'], adorn: ['rangefinder'] }), { Helmet: '#a3a9b1', HelmetSeam: '#3d4249', HelmetTrim: '#5b616b', HelmetVisor: '#0e1013', HelmetCut: '#0b0c0e', EyeGlow: '#e0202a' }),
  bronzeTVisor: HELMETED('the bronze T-visor: the T-visor helm in burnished bronze, a crest fin over the crown, no rangefinder; the armorer', () => facelessKit({ face: { poly: [[-1.9, 0.35], [1.9, 0.35], [1.9, -0.3], [0.34, -0.3], [0.34, -2.0], [-0.34, -2.0], [-0.34, -0.3], [-1.9, -0.3]] }, faceGroup: 'HelmetVisor', panels: ['teardrop', 'split'], adorn: ['crestFin'] }), { Helmet: '#a8743a', HelmetSeam: '#5e3f1c', HelmetTrim: '#c9a227', HelmetVisor: '#120d09' }),
  nightTVisor: HELMETED('the night T-visor: a black T-visor helm, red trim, ear discs, cracks across its face; the night owl', () => facelessKit({ face: { poly: [[-1.9, 0.35], [1.9, 0.35], [1.9, -0.3], [0.34, -0.3], [0.34, -2.0], [-0.34, -2.0], [-0.34, -0.3], [-1.9, -0.3]] }, faceGroup: 'HelmetVisor', panels: ['teardrop', 'browBand'], adorn: ['earDiscs'], cuts: ['chinVents'], paint: ['cracks'] }), { Helmet: '#1d1f24', HelmetSeam: '#7a1d1d', HelmetTrim: '#a32020', HelmetVisor: '#08090b', HelmetCut: '#050506', MaskSeam: '#5a5f68' }),
  heavyTVisor: HELMETED('the heavy T-visor: a green T-visor helm, a plated shell, vents on the cheeks and under the visor, antennae; the veteran', () => facelessKit({ face: { poly: [[-1.9, 0.35], [1.9, 0.35], [1.9, -0.3], [0.34, -0.3], [0.34, -2.0], [-0.34, -2.0], [-0.34, -0.3], [-1.9, -0.3]] }, faceGroup: 'HelmetVisor', panels: ['plated', 'teardrop'], cuts: ['chinVents', 'cheekVents'], adorn: ['antennae', 'rangefinder'] }), { Helmet: '#5d6b4a', HelmetSeam: '#2a3120', HelmetTrim: '#a3402a', HelmetVisor: '#0e1013', HelmetCut: '#0b0c0e', EyeGlow: '#e0202a' }),
  spaceHelmet: HELMETED('the space helmet: a great round shell standing off the head, a wide clear visor over the whole face; the astronaut', 'astronaut', { Helmet: '#f4f5f7', HelmetVisor: '#9ec3d6', HelmetTrim: '#c9a227' }),
  // ── EYEGEAR: goggles, visors and headsets ──
  skiGoggles: EYEWEAR('the ski goggles: one wide mirrored lens across both eyes in a white frame, a broad strap round the head; the snow runner', 'ski', { EyeFrame: '#f2f2f2', EyeTrim: '#1b1b1f', EyeLens: '#f08a24', EyeStrap: '#1b1b1f' }),
  motoGoggles: EYEWEAR('the moto goggles: two round tinted lenses in leather cups with brass rims, a leather strap; the rider', 'moto', { EyeFrame: '#5a3b22', EyeTrim: '#b08d3c', EyeLens: '#8fb9bd', EyeStrap: '#4a3020' }),
  labGoggles: EYEWEAR('the lab goggles: two clear lenses in a blue rubber frame, a thin strap; the scientist', 'lab', { EyeFrame: '#2b6cb0', EyeLens: '#d6ecf3', EyeStrap: '#1d3f66' }),
  nightVision: EYEWEAR('the night vision: a black goggle with two scopes standing forward, green lenses aglow; the infiltrator', 'nightVision', { EyeFrame: '#17191d', EyeGlow: '#5dff7a', EyeStrap: '#17191d' }),
  quadVision: EYEWEAR('the quad vision: a goggle with four scopes, the outer two splayed, green lenses aglow; the special operator', 'quadVision', { EyeFrame: '#17191d', EyeGlow: '#5dff7a', EyeStrap: '#17191d' }),
  vrHeadset: EYEWEAR('the VR headset: a white box over the eyes, its front flat, a dark gasket, a broad strap; the netrunner', 'vr', { EyeFrame: '#f4f5f7', EyeTrim: '#22252b', EyeStrap: '#2a2d33' }),
  cyberVisor: EYEWEAR('the cyber visor: a band of dark glass over the eyes, a silver band round the head, earpieces with cyan lights, antennas and cables; the cyborg agent', 'cyber', { EyeFrame: '#c7ccd4', EyeLens: '#14202a', EyeGlow: '#58e1ff', EyeStrap: '#c7ccd4' }),
  engineerVisor: EYEWEAR('the engineer\'s visor: a gold band wrapped from temple to temple, standing off the face, ridged across, small connectors at the temples; the blind engineer', 'engineer', { EyeFrame: '#d9b45a', EyeTrim: '#7a6230' }),
  opticVisor: EYEWEAR('the optic visor: a dark band round to the temples with one ruby lens strip across both eyes, a band round the head; the optic blaster', 'optic', { EyeFrame: '#2a2a33', EyeTrim: '#c9a227', EyeGlow: '#e0202a', EyeStrap: '#2a2a33' }),
  spiderVisor: EYEWEAR('the spider visor: a dark visor with a cluster of small glowing lenses, earpieces and the arms that hold it, a band over the crown; the sniper', 'spider', { EyeFrame: '#2c1f3d', EyeGlow: '#ff5ca8', EyeStrap: '#2c1f3d' }),
  // ── MOUTHPIECES (the lower face) ──
  // ── FACE SETS: a cowl with a mouthpiece over it ──
  shinobi: FACE_SET('the shinobi: a black cowl with slit eyes, the black wrap drawn over the nose and the mouth; the assassin', { domino: false, eyes: 'slit' }, 'ninja', { Mask: '#16171b', MaskMouth: '#0f1013' }),
  revenant: FACE_SET('the revenant: a black cowl, a bold wrap cut in a V over the nose; the vengeful spirit', { domino: false, eyes: 'slit' }, 'wraith', { Mask: '#141518', MaskMouth: '#c9a227' }),
  oniWarrior: FACE_SET('the oni warrior: a dark cowl and domino, the red lacquered oni mouth over the jaw; the demon samurai', { domino: 'pointed' }, 'oni', { Mask: '#1b1a1d', MaskDomino: '#2c2a30', MaskMouth: '#8e1a15', MaskTeeth: '#efe9d8' }),
  wastelander: FACE_SET('the wastelander: a cowl with white lenses, a gas filter over the nose and the mouth; the scavenger', { domino: 'technical', eyes: 'lens' }, 'gasFilter', { Mask: '#3b3529', MaskDomino: '#4d4536', MaskMouth: '#2a2d33', MaskFilter: '#c9a227' }),
  ninjaWrap: MOUTHED('the ninja wrap: black cloth drawn flat over the nose and the mouth, a centre fold, to the neck; the shadow', 'ninja', { Mask: '#16171b' }),
  wraithWrap: MOUTHED('the wraith wrap: the ninja\'s cloth cut in a V over the nose, its edge raised, in a bold colour; the revenant', 'wraith', { Mask: '#c9a227' }),
  bandanna: MOUTHED('the bandanna: a red kerchief over the nose and the mouth, its point hanging below the chin; the outlaw', 'bandanna', { Mask: '#a8231c' }),
  oniMouth: MOUTHED('the oni mouth: a red lacquered plate over the nose and the jaw, a snarling mouth, white teeth and fangs, wrinkled cheeks; the demon', 'oni', { Mask: '#8e1a15', MaskTeeth: '#efe9d8' }),
  gasFilter: MOUTHED('the gas filter: a cup over the nose and the mouth, one canister at the front, straps behind; the toxic-alley runner', 'gasFilter', { Mask: '#2a2d33', MaskFitting: '#7d848e', MaskFilter: '#c9a227' }),
  twinFilter: MOUTHED('the twin filter: a cup with a canister at each side, a valve at the chin; the hazmat operative', 'twinFilter', { Mask: '#33363d', MaskFitting: '#5d636c', MaskFilter: '#b3261e' }),
  tubeMask: MOUTHED('the tube mask: a plate over the mouth, a grille, ribbed tubes running back to the jaw; the brute', 'tubes', { Mask: '#3a3a36', MaskFitting: '#7a7a72' }),
  slattedMask: MOUTHED('the slatted mask: a flat plate over the lower face, five vent slats, a valve at the chin; the enforcer', 'slatted', { Mask: '#26292f', MaskFitting: '#9aa1ab' }),
  // the panelled ninja's mouthpiece in four colourways
  ninjaPanels: { reads: 'the ninja panels: three panels tight on the face, a flat centre with vertical vents, the sides angled back to the cheekbones and the jaw; the frost ninja', family: 'mouthpiece', words: { panelled: 'kombat' }, at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), Mask: '#2f6fb0', MaskMaw: '#0b1622' } }, panelledKit('kombat')) } },
  venomPanels: { reads: 'the venom panels: the ninja panels in yellow; the spectre ninja', family: 'mouthpiece', words: { panelled: 'kombat' }, at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), Mask: '#d4a017', MaskMaw: '#1c1505' } }, panelledKit('kombat')) } },
  emberPanels: { reads: 'the ember panels: the ninja panels in red; the fire ninja', family: 'mouthpiece', words: { panelled: 'kombat' }, at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), Mask: '#a51f1a', MaskMaw: '#1a0605' } }, panelledKit('kombat')) } },
  jadePanels: { reads: 'the jade panels: the ninja panels in green; the jade ninja', family: 'mouthpiece', words: { panelled: 'kombat' }, at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), Mask: '#2f8a4a', MaskMaw: '#06170c' } }, panelledKit('kombat')) } },
  rebreather: MOUTHED('the rebreather: a small cup over the mouth, a valve, a hose to the side; the diver', 'rebreather', { Mask: '#1f2a33', MaskFitting: '#c9a227' }),
  // ── COWLS over the whole head (the cast's `cowl`) ──
  dominoCowl: COWLED('the domino cowl: the head covered, the domino over the eyes, the mouth and the chin bare; the night vigilante', {}),
  flowingCowl: COWLED('the flowing cowl: the domino cowl with the hero\'s own hair flowing out of the back; the acrobat', { hair: 'flow' }),
  lensCowl: COWLED('the lens cowl: the head covered, a pointed domino with white lenses, the mouth shown; the detective', { domino: 'pointed', eyes: 'lens' }),
  coveredCowl: COWLED('the covered cowl: the head and the mouth covered, the lips read through the cloth, a domino over the eyes; the ninja', { mouth: 'cover' }),
  fullMask: COWLED('the full mask: the whole head covered, no mouth, white lenses, no domino; the wall-crawler', { mouth: 'none', domino: false, eyes: 'lens' }),
  facelessMask: COWLED('the faceless mask: the whole head covered, no mouth, no eyes; the blank', { mouth: 'none', domino: false, eyes: 'blank' }),
  bareCowl: COWLED('the bare cowl: the head covered, eye holes cut, no domino, the mouth shown; the thief', { domino: false }),
  gothicCowl: COWLED('the gothic cowl: the domino cowl with bat ears rising where the domino aims, stitches over the brow; the dark knight', { dress: 'gothic' }),
  nocturneCowl: COWLED('the nocturne cowl: spikes along the top of each side, cords from the domino\'s points into them; the night stalker', { dress: 'nocturne', domino: 'pointed' }),
  aviatorCowl: COWLED('the aviator cowl: fins swept back off the temples, a double stripe over the crown, lens eyes; the flier', { dress: 'aviator', eyes: 'lens' }),
  stitchedCowl: COWLED('the stitched cowl: the domino stitched round, lines off its corners to the jaw, the brow stitched; the rag-doll vigilante', { dress: 'stitched' }),
  crownedCowl: COWLED('the crowned cowl: points over the crown, the domino outlined, the hair flowing; the prince of thieves', { dress: 'crowned', hair: 'flow' }),
  owlCowl: COWLED('the owl cowl: a dark cowl, the domino an owl\'s W, a facial disc with a V brow and a beak over the nose, its arms swept out past the head, round lenses; the night owl', { domino: 'owl', eyes: 'roundLens', dress: 'owl' }, { Mask: '#2b2a27', MaskDomino: '#57524a', MaskLens: '#f0e6c8', MaskStitch: '#a89a7a' }),
  hornedOwlCowl: COWLED('the horned owl cowl: the W\'s arms narrow and raised like ear tufts, slanted slits, points over the crown; the hunter of the night', { domino: 'hornedOwl', eyes: 'slit', ornaments: ['crest'] }, { Mask: '#26231f', MaskDomino: '#4a4238', MaskStitch: '#8f7f62' }),
  barnOwlCowl: COWLED('the barn owl cowl: a pale heart-shaped disc, its short arms laid flat out, round dark lenses, a tan cowl; the white ghost', { domino: 'barnOwl', eyes: 'roundLens', ornaments: ['echoStitch'] }, { Mask: '#b48a5a', MaskDomino: '#efe6d6', MaskLens: '#1d1a17', MaskStitch: '#8c6a43' }),
  greatOwlCowl: COWLED('the great owl cowl: angular, the W\'s arms swept long and wide like wings, six-sided lenses, cords from its points; the strategist', { domino: 'greatOwl', eyes: 'angularLens', ornaments: ['templeCords'] }, { Mask: '#1f2126', MaskDomino: '#3a3f4a', MaskLens: '#f2d88a', MaskStitch: '#c9a64a' }),
  nightOwlCowl: COWLED('the night owl cowl: the owl\'s W stitched round in gold, the brow lined, the hair flowing; the duelist', { domino: 'owl', eyes: 'roundLens', hair: 'flow', ornaments: ['echoStitch', 'featherBrow'] }, { Mask: '#1a1b20', MaskDomino: '#2c2e36', MaskLens: '#f0e6c8', MaskStitch: '#d1b062' }),
  owlFullMask: COWLED('the owl full mask: the whole head covered, no mouth, the owl\'s W over round lenses; the silent', { domino: 'owl', eyes: 'roundLens', mouth: 'none', dress: 'owl' }, { Mask: '#2b2a27', MaskDomino: '#57524a', MaskLens: '#f0e6c8', MaskStitch: '#a89a7a' }),
  owlMask: { reads: 'the owl mask: the owl\'s W alone, no cowl, its arms sweeping past the head, round lenses; the masked owl', family: 'mask', words: { outline: 'owl', eyes: 'roundLens' },
    at: { tiered: (spec) => withKit({ ...spec, palette: { ...(spec.palette || {}), Mask: '#3b372f', MaskLens: '#f0e6c8' } }, maskKit({ outline: 'owl', eyes: 'roundLens', head: spec.head })) } },
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
