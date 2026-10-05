/** anime-head.js — the ANIME HEAD: the Anime Form Studio's head (anime-form.js, the studio's own construction, ported
 * bit for bit) worn by the hero beside the landmark head (`head: 'anime'` at the hero door).
 *
 * The words are the studio's: a design base (`preset` female / male), its FACE controls, its HAIR (a family — bob,
 * short, long — its controls, and per-clump LOCK edits by the studio's clump names) and its EXPRESSION (poses or four
 * amounts). Here they are conversational: ratio-controls vocabularies (a move, an object or a list, composed left to
 * right), 1 = the design base, applied as the studio applies a slider (value + the base's offset); `tilt`, `sweep` and
 * `part` are OFFSETS about 0. The studio's slider ranges advise, never refuse.
 *
 * The geometry is the studio's, registered and made wearable:
 *   - registered into the hero head frame (+x right, +y front, +z up, metres about the atlas) by the fitted heads'
 *     REGISTRATION for the pole (crown-to-chin height, chin at the menton, the head's length centred), so every collar
 *     and neck clearance built around the landmark head holds; the studio's frame (Y up, forward −Z) maps by a proper
 *     rotation, so windings keep their sense;
 *   - the studio's neck and shoulder context is not worn (the hero's neck is the body's);
 *   - every part CLOSED under the layered audit: welded, oriented, outward. The face is one mesh (skin, sclera, mouth as
 *     face groups; the sclera's rim welded onto its aperture ring, anime-form `weld`); the ears are closed volumes; the
 *     iris and pupil lenses, the lash, lower-rim and brow ribbons get a back just behind their visible face; the hair cap
 *     a thickness under it; every clump is its own closed part;
 *   - one hidden L1 `cranium` (an ellipsoid core inside the skull) carries the rig binding and the pin; everything
 *     visible is pinned to it and rides the head bone rigidly. The studio opens the mouth as an aperture, so there is no
 *     jaw part, no jaw hinge and no dial.
 * `register`: `lowpoly` is the studio's coarse sampling (its construction lab's cage density), anything else its full
 * sampling.
 *
 * The GRAPHIC FACE (`sculpt`, anime-sculpt.js): by default the head wears its design base's graphic base — a face layer
 * under the face words and the sculpt (the eye level, the placed nose and its shade-side line, the lip line and mouth
 * width, the fissure's shape, the lid band, the graphic lenses with a catchlight, the brow block); `sculpt: false` is the
 * studio's own face, exactly. Under the sculpt the ink parts are named BY KEY (`lashLow*` the lower rim, `lid*` the lid
 * band, `brow*` the brow block, `noseLine`; the catchlight `catch*` a lens), so a new stroke never renames another and
 * each is one piece per side or the build refuses; every expression keeps the same vertex and face lists (the lenses stay
 * behind the lids when they shut); `register: 'lowpoly'` takes the lighter lenses (anime-form `budget: 'game'`); the brow
 * and lid parts carry `through: 'fringe'` and the fringe's parts `veil: 'fringe'` (the brows are drawn through the
 * fringe); `measures.features` is the feature-spacing table with its advice.
 *
 * The HAIR FORM (mojulo's words on the hair, anime-form `hairForm`): the mass LIFTED off the skull by region (`lift
 * { crown, temple, fringe, nape }`, construction units; the roots then emerge from the cap), the lock SECTION (`round`,
 * the studio's 8-gon, or `ridge`, a roof with a spine), a section's `ridge` and `flute` (spines along a consolidated
 * section and per member lock), the short family's `crownAccents` (`grow` | `tuck` | `none`), and the cut's words
 * (`sweepBack`, `hairline { front }`, `sweepSides`, `fringeGroups`, `backNotch`, `fringeNotch`, `flip`, `spikes`, `sideTail`, `shapes`, `sideburns`). They ride on the hair beside its
 * controls, SPARSE (a word is there only when given; `false` sets it to the studio's construction, over a base), compose
 * across a list last-wins (an object word key by key), are passed to the build as an option and are never written into
 * the studio recipe; the scalp's hairline follows `hairline`. The HAIR BASES (`ANIME_HAIR_BASE`, the anime hero's default
 * hair, applied by the hero door through anime-looks `composeAnime`): per design base a FORM (the lift, the thickness,
 * the ridge section, the crown accents off) worn under every family, and a CUT (a hair word — `swept-back` on the male,
 * `side-parted` on the female) worn when neither a look nor the operator names a family. Pure; no dice.
 */
import { earMesh } from './head-ear.js';
import { compileLayered, pinFrame } from './station-loft.js';
import { address } from './station-loft-detail.js';
import { surfaceLocalOffset } from './surface-pin.js';
import { r6 } from './station-loft-plan.js';
import { ratioControls } from './ratio-controls.js';
import { REGISTRATION } from './humanoid-head-fit.js';
import { buildAnime, animeFresh, animeFaceDefs, ANIME_FACE_DEFS, ANIME_HAIR_DEFS, ANIME_EXPRESSION_DEFS, ANIME_HAIR_STYLES as STUDIO_FAMILIES, ANIME_LOCK_RE as STUDIO_LOCK_RE, ANIME_LOCK_KEYS } from './anime-form.js';
import { rasterDepth, viewCamera } from '../scene/depth-raster.js';
import { GRAPHIC_BASE, resolveAnimeSculpt, validateAnimeSculpt, sculptBuild, sculptFeatures } from './anime-sculpt.js';
import * as dmath from '../../util/dmath.js';

/** the hair FAMILIES: the studio's three and mojulo's `hime` (hair-passes) */
export const ANIME_HAIR_STYLES = Object.freeze([...STUDIO_FAMILIES, 'hime']);
/** the clumps a lock edit may name: the studio's, the `ahoge` and the side `tail` */
export const ANIME_LOCK_RE = new RegExp(`${STUDIO_LOCK_RE.source.slice(0, -2)}|ahoge|tail)$`);

// ─── the vocabulary ───────────────────────────────────────────────────────
const rangesOf = (defs) => Object.fromEntries(defs.map(([k, , lo, hi]) => [k, [lo, hi]]));
/** FACE TRAITS (hero-looks): the designers' words as ratios about the base (`tilt` an offset). A trait composes with any
 * other by product (a trait and then a little more is more). Starting numbers, tuned on the eyes gate. */
export const ANIME_FACE_MOVES = Object.freeze({
  tsurime: { note: 'upturned outer eye corners (the lift up, the opening a little lower)', face: { tilt: 0.05, eyeHeight: 0.94 } },
  tareme: { note: 'drooping outer eye corners (the lift down, the opening a little taller)', face: { tilt: -0.05, eyeHeight: 1.04 } },
  'large-eyes': { note: 'larger eyes and irises', face: { eyeWidth: 1.05, eyeHeight: 1.08, iris: 1.04 } },
  'narrow-eyes': { note: 'a narrower, level opening and a smaller iris', face: { eyeHeight: 0.86, iris: 0.94 } },
  soft: { note: 'a rounder lower face: fuller cheeks, a broader chin set back, the jaw corner higher', face: { cheekVolume: 1.1, lowerCheekVolume: 1.1, chin: 1.1, jawAngle: 1.08, chinProjection: 0.94 } },
  sharp: { note: 'an angular lower face: flatter cheeks, a narrow chin forward, a longer lower face', face: { cheekVolume: 0.92, lowerCheekVolume: 0.9, chin: 0.88, chinProjection: 1.06, jawDepth: 0.95, lower: 1.04 } },
  youthful: { note: 'a shorter lower face, bigger eyes, a smaller nose and chin, a fuller back of the skull', face: { lower: 0.92, eyeHeight: 1.06, eyeWidth: 1.03, nose: 0.85, chinProjection: 0.94, occiput: 1.05 } },
  mature: { note: 'a longer lower face, a calmer opening, more nose and chin', face: { lower: 1.07, eyeHeight: 0.9, nose: 1.1, cheekVolume: 0.95, chinProjection: 1.06, jawDepth: 1.05 } },
  'button-nose': { note: 'a small nose', face: { nose: 0.75 } },
  'strong-chin': { note: 'a broad, forward, longer chin on a squarer jaw corner', face: { chin: 1.12, chinProjection: 1.12, chinHeight: 1.06, jawAngle: 0.9 } },
});
/** the studio's face controls under its own names; 1 = the design base. Multi-key groups are the words that move a
 * region together (never named like a control: `jaw` and `chin` are controls, so their groups are `jawline` and
 * `chinShape`); the single-key groups only name where a control sits. `tilt` (the outer-eye lift) is an offset. */
export const ANIME_FACE = ratioControls({
  label: 'face',
  groups: { skull: ['width', 'depth', 'backDepth', 'occiput', 'nape'], brow: ['foreheadDepth', 'browDepth'], cheeks: ['cheekVolume', 'lowerCheekVolume'],
    jawline: ['jaw', 'jawAngle', 'jawDepth'], chinShape: ['chin', 'chinProjection', 'chinHeight'], eyes: ['eyeWidth', 'eyeHeight'],
    length: ['lower'], profile: ['nose'], placement: ['spacing'], irises: ['iris'], lift: ['tilt'], carriage: ['headPitch'] },
  ranges: rangesOf(ANIME_FACE_DEFS),
  moves: ANIME_FACE_MOVES,
  offsets: ['tilt'],
});
/** the studio's hair controls (1 = its default; `sweep` and `part` offsets) — the family word and the locks ride beside */
export const ANIME_HAIR = ratioControls({
  label: 'hair',
  groups: { mass: ['volume', 'length', 'fringe'], clumps: ['clump', 'thickness', 'taper'], sweep: ['sweep'], part: ['part'], accent: ['ahoge'], build: ['strands'] },
  ranges: { ...rangesOf(ANIME_HAIR_DEFS), ahoge: [0, 1.5], strands: [0, 1] },
  offsets: ['sweep', 'part', 'ahoge', 'strands'],
});
/** HAIR TRAITS (hero-looks): controls and, where the word is a direction, clump LOCK edits (studio construction units).
 * Words disjoint from the family names. `messy` is authored, not dice: five clumps, fixed offsets. */
export const ANIME_HAIR_MOVES = Object.freeze({
  spiky: { note: 'thinner clumps drawn to sharper tips, a little more crown', hair: { taper: 1.25, thickness: 0.85, volume: 1.06 } },
  sleek: { note: 'a closer mass, softer tips, flatter narrower clumps', hair: { volume: 0.95, taper: 0.85, thickness: 0.8, clump: 0.95 } },
  messy: { note: 'fuller, wider clumps with a sweep and five tips pushed off the fall', hair: { volume: 1.08, clump: 1.06, sweep: 0.08,
    locks: { 'fringe-2': { tx: 0.05, ty: 0.03 }, 'fringe-5': { tx: -0.04, ty: 0.05 }, 'fringe-7': { ty: -0.04 }, 'back-3': { tx: -0.06 }, 'back-8': { tx: 0.05, tz: 0.04 } } } },
  'heavy-bangs': { note: 'a longer, fuller fringe', hair: { fringe: 1.15, clump: 1.06 } },
  'short-bangs': { note: 'a shorter fringe that opens the brow', hair: { fringe: 0.8 } },
  'swept-bangs': { note: 'the fringe swept to one side off a side part', hair: { sweep: 0.2, part: 0.1 } },
  voluminous: { note: 'a bigger crown and thicker clumps', hair: { volume: 1.12, thickness: 1.15 } },
  peekaboo: { note: 'one bang dropped over the right eye', hair: { locks: { 'fringe-3': { ty: -0.16, tx: 0.03, tz: -0.02 } } } },
  ahoge: { note: 'one upright curl at the crown', hair: { ahoge: 1 } },
  // the hair bases' CUTS (the anime hero's default hair per design base, ANIME_HAIR_BASE), words anywhere a hair word goes
  'swept-back': { note: 'the short family swept back: the fringe rises off a raised front hairline over the crown and points back, the sides swept back over the ears, no crown accents',
    hair: { style: 'short', clump: 1.12, sweepBack: { amount: 1, rise: 1.75, riseFall: 0.9, controlX: 1, spread: 1.12, controlZ: -0.45, tipY: 0.85, tipZ: 0.75 }, hairline: { front: 0.7 }, sweepSides: { amount: 1, from: 1, tipY: 0.55, tipZ: 0.62 }, crownAccents: 'none' } },
  'side-parted': { note: 'a long sheet off a side part: one dominant bang swept across the brow and clear of the eyes, sidelocks ending at the jaw, a blunt back, spines along the sections and their locks',
    hair: { style: 'long', part: 0.15, length: 1.2, fringeGroups: [[1, 2, 3, 4, 5], [5, 6, 7]], backNotch: 0.9, ridge: 0.8, flute: 0.35,
      locks: { 'fringe-1': { tx: -0.2, ty: 0.05 }, 'fringe-2': { tx: -0.24, ty: 0.02 }, 'fringe-3': { tx: -0.28, ty: 0.18 }, 'fringe-4': { tx: -0.3, ty: 0.14 }, 'fringe-5': { tx: -0.28, ty: 0.26 }, 'fringe-6': { tx: -0.1, ty: 0.24 }, 'fringe-7': { ty: 0.3 },
        'left-temple-0': { ty: 0.78 }, 'right-temple-0': { ty: 0.78 }, 'left-temple-1': { ty: 0.45 }, 'right-temple-1': { ty: 0.45 } } } },
  // the operator's sketches (2026-10-05): three female cuts and one male, each a family with its form words and clump edits
  'flipped-long': { note: 'long and parted at the middle, curtain bangs opening over the brow and framing the face to the cheek, the side and back ends kicked out and up',
    hair: { style: 'long', length: 1.25, fringeGroups: [[1, 2, 3], [5, 6, 7]], flip: { amount: 1, out: 0.6, rise: 0.45, hold: 0.9 },
      locks: { 'fringe-1': { tx: -0.18, ty: -0.5 }, 'fringe-2': { tx: -0.26, ty: -0.32 }, 'fringe-3': { tx: -0.3, ty: -0.05 }, 'fringe-4': { ty: 0.22 }, 'fringe-5': { tx: 0.3, ty: -0.05 }, 'fringe-6': { tx: 0.26, ty: -0.32 }, 'fringe-7': { tx: 0.18, ty: -0.5 } } } },
  'blunt-bob': { note: 'a bob under a blunt, level fringe split off centre, the right side at the jaw and the left side falling long past it',
    hair: { style: 'bob', fringeGroups: [[1, 2, 3, 4], [5, 6, 7]], fringeNotch: 1,
      locks: { 'fringe-2': { ty: -0.05 }, 'fringe-3': { ty: 0.13 }, 'fringe-4': { ty: -0.03 }, 'fringe-5': { ty: 0.08 }, 'fringe-6': { ty: -0.07 }, 'fringe-7': { ty: 0.02 },
        'left-temple-0': { tx: -0.05, ty: -0.8 }, 'left-temple-1': { tx: -0.08, ty: -0.85 }, 'left-temple-2': { tx: -0.1, ty: -0.8 } } } },
  'side-tail': { note: 'the side-parted sheet gathered into a low tail behind the left ear, hanging forward over the shoulder; the bangs swept across, a long sidelock framing the right of the face',
    hair: { style: 'long', part: 0.15, length: 1.2, fringeGroups: [[1, 2, 3, 4, 5], [5, 6, 7]], backNotch: 0.9, ridge: 0.8, flute: 0.35, sideTail: { amount: 1, side: 'left', width: 1.4, length: 1.15 },
      locks: { 'fringe-1': { tx: -0.2, ty: 0.05 }, 'fringe-2': { tx: -0.24, ty: 0.02 }, 'fringe-3': { tx: -0.28, ty: 0.18 }, 'fringe-4': { tx: -0.3, ty: 0.14 }, 'fringe-5': { tx: -0.28, ty: 0.26 }, 'fringe-6': { tx: -0.1, ty: 0.24 }, 'fringe-7': { ty: 0.3 },
        'right-temple-0': { ty: 0.48 }, 'right-temple-1': { ty: 0.45 }, 'left-temple-0': { ty: 0.78 } } } },
  // the SHAPES characters (anime-form): male protagonists, each in ONE vegetable family.
  // BROKU — carrots only, after Toriyama: hierarchy and mass from length and base alone (a hero, a court of three, stubby
  // mass carrots, the back a cascade to the nape point, carrot bangs), scaled up to the head's size. NO STRAIGHT-UP
  // SPIKE: every carrot that rises leans at least 30° off the vertical seen from the front AND from the side
  broku: { note: 'Broku: cut conical carrots only — a tall hero spike off centre, a long level spike to his left, stubby carrots for mass, the back cascading to a point at the nape, carrot bangs and sideburns',
    hair: { style: 'short', crownAccents: 'none', sideburns: { length: 0.4, width: 0.13 }, shapes: { replace: ['fringe', 'temple', 'back', 'crown'], scale: 1.3,
      carrots: [
        { at: [163, 80], dir: [-0.62, 0.75, 0.72], length: 1.7, base: 0.46, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [80, 50], dir: [1, -0.47, 0.45], length: 0.85, base: 0.34, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [280, 42], dir: [-1, 0.05, 0.4], length: 1.5, base: 0.4, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [180, 40], dir: [0.25, 0.3, 1], length: 1.1, base: 0.38, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [40, 70], dir: [0.85, 0.5, 0.35], length: 0.5, base: 0.36, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [320, 72], dir: [-0.85, 0.45, 0.45], length: 0.4, base: 0.34, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [130, 65], dir: [0.35, -0.65, 0.7], length: 0.75, base: 0.32, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [230, 65], dir: [-0.35, -0.65, 0.7], length: 0.65, base: 0.32, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [100, 20], dir: [0.9, -0.4, 0.4], length: 0.55, base: 0.38, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [150, 15], dir: [0.3, -0.8, 0.55], length: 0.6, base: 0.3, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [210, 15], dir: [-0.3, -0.8, 0.55], length: 0.5, base: 0.3, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [180, 5], dir: [0, -1, 0.25], length: 0.85, base: 0.32, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [345, 5], dir: [-0.1, -1, -0.35], length: 0.75, base: 0.2, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [20, 6], dir: [0.3, -1, -0.3], length: 0.55, base: 0.18, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [318, 8], dir: [-0.45, -1, -0.2], length: 0.5, base: 0.17, sink: 0.3, curve: 0.2, bend: 0.1 },
        { at: [50, 8], dir: [0.6, -0.9, -0.1], length: 0.4, base: 0.15, sink: 0.3, curve: 0.2, bend: 0.1 },
      ] } } },
  // JINTO — bananas only, cut as a hairstylist would: COMMA HAIR over a soft two-block. The whorl set back and low so the
  // crown is a smooth dome (no star, nothing rising), the sides short and laid flat, the nape tapered and rounded above the
  // collar (no point), and the story in the front: a fringe parted on his left, swept one way to the brow, and one comma
  // lock curling in over his right cheek
  jinto: { note: 'Jinto: bananas only — comma hair over a soft two-block: a smooth domed crown, a fringe parted on his left and swept to the brow, one comma lock curling in at his right cheek, flat sides, a short tapered nape, short sideburns',
    hair: { style: 'short', crownAccents: 'none', sideburns: { length: 0.3, width: 0.12 }, shapes: { replace: ['fringe', 'temple', 'back', 'crown'], scale: 1.1, whorl: [180, 45],
      layers: [
        { shape: 'banana', az: [0, 360], around: [4, 26], rows: 2, count: 12, length: 0.9, width: 0.22, droop: 0.7, lift: 0.1, vary: 0.1, bend: 0.18, sprout: 1 },
        { shape: 'banana', az: [0, 360], el: [52, 80], rows: 2, count: 14, length: 0.95, width: 0.22, droop: 0.55, lift: 0.04, vary: 0.1, bend: 0.16, swirl: 15 },
        { shape: 'banana', az: [52, 128], el: [10, 44], rows: 2, count: 6, length: 0.85, width: 0.22, droop: 1.3, lift: 0, vary: 0.1, bend: 0.12 },
        { shape: 'banana', az: [232, 308], el: [10, 44], rows: 2, count: 6, length: 0.85, width: 0.22, droop: 1.3, lift: 0, vary: 0.1, bend: 0.12 },
        { shape: 'banana', az: [128, 232], el: [6, 44], rows: 2, count: 10, length: 0.62, width: 0.22, droop: 1.1, lift: 0.02, vary: 0.08, bend: 0.12, cover: 1.5 },
        { shape: 'banana', az: [-62, 52], el: [30, 50], rows: 1, count: 6, length: 0.6, width: 0.26, droop: 0.8, lift: 0.1, vary: 0.15, bend: 0.2, swirl: 35 },
      ],
      bananas: [
        { at: [15, 26], dir: [0.45, -1, -0.3], length: 0.78, width: 0.22, bend: 0.35, sprout: 0.8 },
      ] } } },
  // KAIRO — chili peppers only, cut as a hairstylist would: a WOLF CUT. Mass before texture (a short base layer fills the
  // shape, thinner varied strands texture it), the crown the tallest, shaggiest zone, the sides stepped from the ear to the
  // jaw, the nape grown to the collar and flicking out, long wispy sideburns, a piecey off-centre middle part, all of it
  // swirling one way from the whorl and one longer flick at his right jaw: the hourglass wolf profile
  kairo: { note: 'Kairo: chili peppers only — a wolf cut: a tall shaggy crown, the sides stepped from the ear to the jaw, a long wispy nape flicking out at the collar, long sideburns, a piecey off-centre middle part, one long flick at his right jaw',
    hair: { style: 'short', crownAccents: 'none', sideburns: { length: 0.75, width: 0.055 }, shapes: { replace: ['fringe', 'temple', 'back', 'crown'], scale: 1.1, whorl: [180, 55],
      layers: [
        { shape: 'pepper', az: [0, 360], el: [18, 62], rows: 3, count: 60, length: 0.45, width: 0.06, droop: 0.6, lift: 0.05, vary: 0.2, bend: 0.12, cover: 1.2, sprout: 1 },
        { shape: 'pepper', az: [0, 360], around: [3, 26], rows: 3, count: 30, length: 0.7, width: 0.045, droop: 0.4, lift: 0.2, vary: 0.35, bend: 0.16, sprout: 1, swirl: 25 },
        { shape: 'pepper', az: [-75, 75], el: [62, 84], rows: 2, count: 16, length: 0.7, width: 0.042, droop: 0.1, lift: 0.45, vary: 0.35, bend: 0.14, sprout: 0.6, swirl: 25 },
        { shape: 'pepper', az: [0, 360], el: [55, 76], rows: 2, count: 36, length: 0.8, width: 0.042, droop: 0.45, lift: 0.18, vary: 0.35, bend: 0.14, swirl: 25 },
        { shape: 'pepper', az: [55, 130], el: [24, 46], rows: 2, count: 10, length: 0.55, width: 0.038, droop: 0.9, lift: 0.12, vary: 0.4, bend: 0.12, swirl: 25 },
        { shape: 'pepper', az: [230, 305], el: [24, 46], rows: 2, count: 10, length: 0.55, width: 0.038, droop: 0.9, lift: 0.12, vary: 0.4, bend: 0.12, swirl: 25 },
        { shape: 'pepper', az: [55, 130], el: [4, 22], rows: 1, count: 6, length: 0.8, width: 0.038, droop: 1.1, lift: 0.1, vary: 0.35, bend: 0.12, swirl: 25 },
        { shape: 'pepper', az: [230, 305], el: [4, 22], rows: 1, count: 6, length: 0.8, width: 0.038, droop: 1.1, lift: 0.1, vary: 0.35, bend: 0.12, swirl: 25 },
        { shape: 'pepper', az: [130, 230], el: [0, 30], rows: 2, count: 22, length: 0.85, width: 0.045, droop: 1.0, lift: 0.35, vary: 0.5, bend: 0.3, swirl: 25 },
        { shape: 'pepper', az: [-55, -10], el: [28, 46], rows: 1, count: 4, length: 0.5, width: 0.04, droop: 0.6, lift: 0.12, vary: 0.4, bend: 0.12, swirl: -25 },
        { shape: 'pepper', az: [-6, 55], el: [28, 46], rows: 1, count: 5, length: 0.5, width: 0.04, droop: 0.6, lift: 0.12, vary: 0.4, bend: 0.12, swirl: 20 },
      ],
      peppers: [
        { at: [100, 10], dir: [0.8, -1, 0.2], length: 0.85, width: 0.05, bend: -0.3, sprout: 0.6 },
      ] } } },
  // JINGO — Jinto's cousin: bananas only, FEW and placed with intent (29, against Jinto's 57), and every lock a CAP lock:
  // it grows from the dome, lies over it and only falls past the hairline, so the locks from the crown are the LONGEST
  // (they cross the dome to reach the hem) and fall over the shorter ones beneath, the way long hair grows; the fringe cut
  // to the brow. His face is long, so no height on top: the crown lies flat and the hem sits at the jaw
  jingo: { note: 'Jingo: bananas only, few and placed with intent, every lock grown from the dome and lying over it like a cap — the crown locks longest, falling over the sides to the jaw, a fringe cut to the brow, a flat crown for a long face, one lock curling to his left cheek',
    hair: { style: 'short', crownAccents: 'none', sideburns: { length: 0.22, width: 0.12 }, shapes: { replace: ['fringe', 'temple', 'back', 'crown'], scale: 1.16, whorl: [180, 60],
      layers: [
        { shape: 'banana', az: [0, 360], around: [3, 20], rows: 1, count: 6, length: 0.85, fringe: 0.18, width: 0.3, droop: 0.7, lift: 0.04, vary: 0.06, bend: 0.26, flat: 0.25, cap: 1 },
        { shape: 'banana', az: [70, 290], el: [58, 82], rows: 2, count: 8, length: 0.85, fringe: 0.18, width: 0.32, droop: 0.7, lift: 0.04, vary: 0.06, bend: 0.26, flat: 0.25, cap: 1 },
        { shape: 'banana', az: [-70, 70], el: [62, 84], rows: 2, count: 6, length: 0.2, width: 0.3, droop: 0.6, lift: 0.05, vary: 0.1, bend: 0.15, swirl: 20, flat: 0.25, cap: 1 },
        { shape: 'banana', az: [45, 315], el: [24, 44], rows: 1, count: 6, length: 0.6, fringe: 0.3, width: 0.32, droop: 0.8, lift: 0.02, vary: 0.05, bend: 0.08, flat: 0.25, cap: 1 },
      ],
      bananas: [
        { at: [330, 30], dir: [-0.3, -1, -0.25], length: 0.8, width: 0.3, bend: 0.45, sprout: 0.8 },
      ] } } },
});
/** The HAIR FORM words (see the header; anime-form `hairForm` in construction units, the head ≈ 2.2 tall): each word's
 * shape, its hard limits (a value past them refuses) and, for the numbers, the comfortable range the advice reads. */
/** the largest lock edit (construction units, either way) the door takes: the sweep fields' own bound */
export const LOCK_EDIT_MAX = 3;
export const ANIME_HAIR_FORM_WORDS = Object.freeze(['lift', 'section', 'ridge', 'flute', 'crownAccents', 'sweepBack', 'hairline', 'sweepSides', 'fringeGroups', 'backNotch', 'fringeNotch', 'flip', 'spikes', 'sideTail', 'shapes', 'sideburns']);
const LIFT_KEYS = Object.freeze(['crown', 'temple', 'fringe', 'nape']);
const SWEEP_BACK_KEYS = Object.freeze(['amount', 'keep', 'rise', 'riseFall', 'controlX', 'controlZ', 'spread', 'tipY', 'tipZ', 'stagger', 'rootY', 'rootZ']);
const SWEEP_SIDES_KEYS = Object.freeze(['amount', 'from', 'controlY', 'tipX', 'tipY', 'tipZ']);
const FLIP_KEYS = Object.freeze(['amount', 'out', 'rise', 'hold']);
const SIDE_TAIL_KEYS = Object.freeze(['amount', 'side', 'length', 'width', 'height']);
const SPIKES_KEYS = Object.freeze(['amount', 'reach', 'width', 'up']);
/** the sideburns (any style): their fields and limits; `shape` a family (the style's own by default) */
export const SIDEBURN_FIELDS = Object.freeze({ amount: [0, 1], length: [0, 1.5], width: [0.01, 0.5], forward: [-0.6, 0.6], at: [-30, 30], az: [-30, 40] });
export const HAIR_SHAPE_FAMILIES = Object.freeze(['carrot', 'banana', 'pepper']);
/** a layer's fields (anime-form `layers`): rows of one family over an azimuth and elevation range */
export const HAIR_LAYER_FIELDS = Object.freeze({ count: [1, 80], rows: [1, 8], length: [0.05, 3], width: [0.01, 0.6], droop: [-1, 2], lift: [-0.5, 1.5], cover: [0, 2], sprout: [0, 1], vary: [0, 0.8], bend: [-0.6, 0.6], curve: [0, 1], sink: [0, 1], flat: [0.15, 1], swirl: [-90, 90], cap: [0, 1], fringe: [0, 3] });
/** the SHAPES (anime-form): the clump groups a recipe may take over, and each primitive's fields with their hard limits */
export const HAIR_SHAPE_GROUPS = Object.freeze(['fringe', 'temple', 'back', 'crown']);
export const HAIR_SHAPE_FIELDS = Object.freeze({
  peppers: Object.freeze({ length: [0.05, 3], width: [0.01, 0.3], bend: [-0.6, 0.6], sprout: [0, 1] }),
  bananas: Object.freeze({ length: [0.05, 3], width: [0.02, 0.6], flat: [0.15, 1], bend: [-0.6, 0.6], sprout: [0, 1] }),
  carrots: Object.freeze({ length: [0.05, 3], base: [0.02, 0.6], sink: [0, 1], curve: [0, 1], bend: [-0.5, 0.5], sprout: [0, 1] }),
});
export const HAIR_SECTIONS = Object.freeze(['round', 'ridge']);
export const CROWN_ACCENTS = Object.freeze(['grow', 'tuck', 'none']);
/** the lift's comfortable range per region (construction units): about 3–12 % of the head's height at the crown, less
 * at the rim — past it the mass reads as a helmet */
const LIFT_COMFORT = Object.freeze({ crown: [0.04, 0.26], temple: [0, 0.14], fringe: [0, 0.12], nape: [0, 0.14] });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** Error strings for the hair form words on one hair entry (empty = valid); `null` on a word is its removal */
function hairFormErrors(entry, at) {
  const errs = [];
  const num = (k, v, lo, hi) => { if (!finite(v) || v < lo || v > hi) errs.push(`${at}.${k}: a number in [${lo}, ${hi}]`); };
  const fields = (k, v, keys, check) => { if (!isObj(v)) return false; for (const [f, x] of Object.entries(v)) { if (!keys.includes(f)) errs.push(`${at}.${k}.${f}: not a ${k} field (have ${keys.join(', ')})`); else check(f, x); } return true; };
  for (const k of ANIME_HAIR_FORM_WORDS) {
    const v = entry[k]; if (v === undefined || v === null || v === false) continue;
    if (k === 'lift') { if (!fields(k, v, LIFT_KEYS, (f, x) => num(`lift.${f}`, x, 0, 0.5))) errs.push(`${at}.lift: { ${LIFT_KEYS.join(', ')} } (construction units off the skull, the head ≈ 2.2 tall), or false`); }
    else if (k === 'section') { if (!HAIR_SECTIONS.includes(v)) errs.push(`${at}.section: ${HAIR_SECTIONS.join(' | ')}`); }
    else if (k === 'ridge') num(k, v, 0, 2);
    else if (k === 'flute') num(k, v, 0, 1);
    else if (k === 'crownAccents') { if (!CROWN_ACCENTS.includes(v)) errs.push(`${at}.crownAccents: ${CROWN_ACCENTS.join(' | ')} (the short family's six crown accents)`); }
    else if (k === 'sweepBack' || k === 'sweepSides') {
      if (finite(v)) num(k, v, 0, 1);
      else if (!fields(k, v, k === 'sweepBack' ? SWEEP_BACK_KEYS : SWEEP_SIDES_KEYS, (f, x) => {
        if (f === 'amount') num(`${k}.amount`, x, 0, 1);
        else if (f === 'keep') { if (!Array.isArray(x) || !x.every((n) => typeof n === 'string' && /^fringe-[1-7]$/.test(n))) errs.push(`${at}.sweepBack.keep: a list of fringe clumps (fringe-1…7) that still fall`); }
        else if (f === 'from') { if (!Number.isInteger(x) || x < 0 || x > 2) errs.push(`${at}.sweepSides.from: the first temple clump swept (0, 1 or 2)`); }
        else num(`${k}.${f}`, x, -3, 3);
      })) errs.push(`${at}.${k}: an amount in [0, 1], { ${(k === 'sweepBack' ? SWEEP_BACK_KEYS : SWEEP_SIDES_KEYS).join(', ')} }, or false`);
      else if (!('amount' in v)) errs.push(`${at}.${k}: needs its amount (0 … 1)`);
    }
    else if (k === 'hairline') { if (!fields(k, v, ['front'], (f, x) => num('hairline.front', x, 0.3, 1))) errs.push(`${at}.hairline: { front } (the front hairline's height, the studio's 0.53), or false`); else if (!('front' in v)) errs.push(`${at}.hairline: needs its front`); }
    else if (k === 'fringeGroups') {
      const ok = Array.isArray(v) && v.length >= 1 && v.length <= 7 && v.every((g) => Array.isArray(g) && g.length >= 2 && g.every((n, i) => Number.isInteger(n) && n >= 1 && n <= 7 && (i === 0 || n === g[i - 1] + 1)));
      if (!ok) errs.push(`${at}.fringeGroups: a list of bang sections, each two or more neighbouring fringe clumps in order (e.g. [[1, 2, 3, 4, 5], [5, 6, 7]]), or false`);
    }
    else if (k === 'shapes') {
      if (!isObj(v)) { errs.push(`${at}.shapes: { replace?: [${HAIR_SHAPE_GROUPS.join(', ')}], peppers?, bananas?, carrots? } (lists of pieces), or false`); continue; }
      for (const [f, x] of Object.entries(v)) {
        if (f === 'replace') { if (!Array.isArray(x) || !x.every((g) => HAIR_SHAPE_GROUPS.includes(g))) errs.push(`${at}.shapes.replace: a list of the clump groups taken over (${HAIR_SHAPE_GROUPS.join(', ')})`); continue; }
        if (f === 'scale') { num('shapes.scale', x, 0.5, 2); continue; }
        if (f === 'whorl') { if (!Array.isArray(x) || x.length !== 2 || !x.every(finite) || x[1] < 0 || x[1] > 90) errs.push(`${at}.shapes.whorl: [azimuth°, elevation°] (the crown point the layers flow from)`); continue; }
        if (f === 'layers') {
          if (!Array.isArray(x) || x.length > 12) { errs.push(`${at}.shapes.layers: a list of at most 12 layers`); continue; }
          x.forEach((Ly, i) => {
            const here = `${at}.shapes.layers[${i}]`;
            if (!isObj(Ly) || !HAIR_SHAPE_FAMILIES.includes(Ly.shape)) { errs.push(`${here}: { shape: ${HAIR_SHAPE_FAMILIES.join(' | ')}, az?: [from°, to°], el?: [from°, to°] | around?: [from°, to°], ${Object.keys(HAIR_LAYER_FIELDS).join(', ')} }`); return; }
            for (const g of ['az', 'el', 'around']) if (Ly[g] !== undefined && (!Array.isArray(Ly[g]) || Ly[g].length !== 2 || !Ly[g].every(finite) || (g === 'el' && Ly[g].some((e) => e < -30 || e > 90)) || (g === 'around' && Ly[g].some((e) => e < 0 || e > 90)))) errs.push(`${here}.${g}: [from°, to°]${g === 'el' ? ' (−30 … 90)' : g === 'around' ? ' (0 … 90°, the angle from the whorl)' : ''}`);
            for (const [g, y] of Object.entries(Ly)) { if (['shape', 'az', 'el', 'around'].includes(g)) continue; const lim = HAIR_LAYER_FIELDS[g]; if (!lim) errs.push(`${here}.${g}: not a layer field (have shape, az, el, ${Object.keys(HAIR_LAYER_FIELDS).join(', ')})`); else num(`shapes.layers[${i}].${g}`, y, lim[0], lim[1]); }
          });
          continue;
        }
        const fields = HAIR_SHAPE_FIELDS[f];
        if (!fields) { errs.push(`${at}.shapes.${f}: not a shapes field (have replace, scale, whorl, layers, ${Object.keys(HAIR_SHAPE_FIELDS).join(', ')})`); continue; }
        if (!Array.isArray(x) || x.length > 24) { errs.push(`${at}.shapes.${f}: a list of at most 24 pieces`); continue; }
        x.forEach((P, i) => {
          const here = `${at}.shapes.${f}[${i}]`;
          if (!isObj(P)) { errs.push(`${here}: { at: [azimuth°, elevation°], dir?: [x, y, z], ${Object.keys(fields).join(', ')} }`); return; }
          if (!Array.isArray(P.at) || P.at.length !== 2 || !P.at.every(finite) || P.at[1] < -30 || P.at[1] > 90) errs.push(`${here}.at: [azimuth°, elevation°] (elevation −30 … 90, 0 the hairline, 90 the crown)`);
          if (P.dir !== undefined && (!Array.isArray(P.dir) || P.dir.length !== 3 || !P.dir.every(finite) || Math.hypot(...P.dir) < 1e-6)) errs.push(`${here}.dir: a direction [x, y, z] (x the hero's right, y up, z back), not zero`);
          if (f === 'bananas' && P.dir === undefined) errs.push(`${here}.dir: a banana needs its direction`);
          for (const [g, y] of Object.entries(P)) { if (g === 'at' || g === 'dir') continue; const lim = fields[g]; if (!lim) errs.push(`${here}.${g}: not a ${f.slice(0, -1)} field (have at, dir, ${Object.keys(fields).join(', ')})`); else num(`shapes.${f}[${i}].${g}`, y, lim[0], lim[1]); }
        });
      }
    }
    else if (k === 'sideburns') {
      if (finite(v)) num(k, v, 0, 1);
      else if (!isObj(v)) errs.push(`${at}.sideburns: an amount in [0, 1], { shape?: ${HAIR_SHAPE_FAMILIES.join(' | ')}, ${Object.keys(SIDEBURN_FIELDS).join(', ')} }, or false`);
      else for (const [g, y] of Object.entries(v)) { if (g === 'shape') { if (!HAIR_SHAPE_FAMILIES.includes(y)) errs.push(`${at}.sideburns.shape: ${HAIR_SHAPE_FAMILIES.join(' | ')}`); continue; } const lim = SIDEBURN_FIELDS[g]; if (!lim) errs.push(`${at}.sideburns.${g}: not a sideburns field (have shape, ${Object.keys(SIDEBURN_FIELDS).join(', ')})`); else num(`sideburns.${g}`, y, lim[0], lim[1]); }
    }
    else if (k === 'backNotch' || k === 'fringeNotch') { if (!finite(v) || v <= 0 || v > 1) errs.push(`${at}.${k}: the ${k === 'backNotch' ? 'back' : 'bang'} sections' hem, a number in (0, 1] (1 is cut straight), or false`); }
    else if (k === 'flip' || k === 'sideTail' || k === 'spikes') {
      const keys = k === 'flip' ? FLIP_KEYS : k === 'spikes' ? SPIKES_KEYS : SIDE_TAIL_KEYS;
      if (finite(v)) num(k, v, 0, 1);
      else if (!fields(k, v, keys, (f, x) => {
        if (f === 'amount') num(`${k}.amount`, x, 0, 1);
        else if (f === 'side') { if (x !== 'left' && x !== 'right') errs.push(`${at}.sideTail.side: 'left' | 'right' (the hero's side the tail hangs on)`); }
        else if (f === 'length' || (f === 'width' && k === 'sideTail')) num(`${k}.${f}`, x, 0.3, 2);
        else if (f === 'width' || f === 'reach') num(`${k}.${f}`, x, 0, 3);
        else num(`${k}.${f}`, x, -1, 1);
      })) errs.push(`${at}.${k}: an amount in [0, 1], { ${keys.join(', ')} }, or false`);
      else if (!('amount' in v)) errs.push(`${at}.${k}: needs its amount (0 … 1)`);
    }
  }
  return errs;
}
/** a word composed over what the layers before said: an object word merged key by key (an amount becomes `{ amount }`),
 * anything else last-wins */
function composeFormWord(k, cur, v) {
  const obj = (x) => (['sweepBack', 'sweepSides', 'flip', 'spikes', 'sideTail', 'sideburns'].includes(k) && finite(x) ? { amount: x } : x);
  const a = obj(cur), b = obj(v);
  return isObj(a) && isObj(b) ? { ...a, ...b } : b;
}
/** The HAIR BASES: the anime hero's default hair per design base (the hero door, through anime-looks `composeAnime`). The
 * FORM rides under every family — the regional lift, sections a little thicker (the studio's `thickness` as a ratio, so
 * the traits compose on it), the ridge section, no crown accents; the CUT (a hair word) is worn only when neither a look
 * nor the operator names a family. Words and ratios, 1 = the studio's. */
export const ANIME_HAIR_BASE = Object.freeze({
  male: Object.freeze({ form: Object.freeze({ thickness: 1.5, lift: Object.freeze({ crown: 0.12, temple: 0.06, fringe: 0.06, nape: 0.05 }), section: 'ridge', crownAccents: 'none' }), cut: 'swept-back' }),
  female: Object.freeze({ form: Object.freeze({ thickness: 1.4, lift: Object.freeze({ crown: 0.13, temple: 0.06, fringe: 0.05, nape: 0.07 }), section: 'ridge', crownAccents: 'none' }), cut: 'side-parted' }),
});
/** The hair form a build reads (anime-form `hairForm`, buildAnime's units) from resolved hair words, or null when none is
 * on: the lift's regions by the studio's names (fringe → front, nape → back), draped over the dome (a clump arching over
 * the crown stays outside the lifted top; it moves nothing on a mass that does not arch there); the crown accents' word;
 * the sweeps as `{ amount, … }`. */
export function animeHairForm(H) {
  if (!H || typeof H !== 'object') return null;
  const on = (k) => H[k] !== undefined && H[k] !== null && H[k] !== false;
  const out = {};
  if (on('lift')) { const L = H.lift; out.lift = { crown: L.crown ?? 0, temple: L.temple ?? 0, front: L.fringe ?? 0, back: L.nape ?? 0 }; }
  if (on('section')) out.section = H.section;
  if (on('ridge')) out.ridge = H.ridge;
  if (on('flute')) out.flute = H.flute;
  if (on('crownAccents') && H.crownAccents !== 'grow') out.crown = H.crownAccents;
  for (const k of ['sweepBack', 'sweepSides', 'flip', 'spikes', 'sideTail']) if (on(k)) { const v = finite(H[k]) ? { amount: H[k] } : H[k]; if (v.amount) out[k] = v; }
  if (out.lift) out.dome = true;
  if (on('hairline')) out.hairline = { front: H.hairline.front };
  if (on('fringeGroups')) out.fringeGroups = H.fringeGroups;
  if (on('backNotch')) out.backNotch = H.backNotch;
  if (on('fringeNotch')) out.fringeNotch = H.fringeNotch;
  if (on('shapes')) out.shapes = H.shapes;
  if (on('sideburns')) out.sideburns = finite(H.sideburns) ? { amount: H.sideburns } : H.sideburns;
  return Object.keys(out).length ? out : null;
}
/** the studio's expression poses (its buttons) as words, and hero-looks' more; an object of amounts after a word
 * adjusts it. The studio's brow: > 0 lowers the inner ends (a set, angry V), < 0 raises them (worried). */
export const ANIME_POSES = Object.freeze({ neutral: {}, blink: { blink: 1 }, smile: { smile: 1, blink: 0.12, brow: 0.3 }, open: { open: 0.8, brow: 0.2 },
  happy: { blink: 1, smile: 1, brow: -0.2 }, determined: { brow: 0.55, blink: 0.18 }, deadpan: { blink: 0.5 },
  angry: { brow: 0.9, blink: 0.2, open: 0.15 }, worried: { brow: -0.8, blink: 0.1 }, surprised: { open: 0.55, brow: -0.5 } });
const EXPRESSION_KEYS = ANIME_EXPRESSION_DEFS.map(([k]) => k);
export const ANIME_FACE_KEYS = ANIME_FACE.KEYS, ANIME_HAIR_KEYS = ANIME_HAIR.KEYS;
/** mojulo's anime BASES: the studio's design bases with these slider offsets (the operator's call, 2026-09-28: the chin
 * set back on everyone — the studio's male base carried its chin flush with the mouth; the male head carried at 3° chin
 * up instead of 6° (the chin lowered 3° from the studio's carriage), the studio's pitch being 6° + 12° × (headPitch − 1), so the underside of the jaw sits level over
 * the neck and the back of the keel no longer drops below the chin). `1` in the face words is THIS base; the port
 * itself stays the studio's. */
export const ANIME_BASE_ADJUST = Object.freeze({ female: Object.freeze({ chinProjection: -0.2 }), male: Object.freeze({ chinProjection: -0.2, headPitch: -0.25 }) });
export const ANIME_PRESETS = Object.freeze(['female', 'male']);
/** the studio's default family per design base */
export const animeDefaultStyle = (preset) => animeFresh(preset).hair.style;

export const resolveAnimeFace = ANIME_FACE.resolve;
export const validateAnimeFace = (spec, label = 'face') => ANIME_FACE.validate(spec, label);
/** Advisory: each control against the studio's slider range for this design base (its `faceDefs`, widened by the base's
 * offset), the lift as the base's own plus the offset. Under the graphic face (any `sculpt` but `false`, the head's
 * default) the value read is the one the head builds — the graphic base's face layer times the word — and the range is
 * widened by the layer's offset the same way (the male layer sits at the studio's eye-width and eye-height floor). */
export function animeFaceWarnings(resolved, preset = 'female', { sculpt } = {}) {
  if (!resolved) return [];
  const base = animeFresh(preset).face, adjust = ANIME_BASE_ADJUST[preset] ?? {}, out = [];
  const layer = sculpt === false ? {} : GRAPHIC_BASE[preset]?.face ?? {};
  for (const [k, , lo0, hi0] of animeFaceDefs(preset)) {
    const v = resolved[k]; if (v === undefined) continue;
    const L = layer[k], lo = L !== undefined ? Math.min(lo0, lo0 + (L - 1)) : lo0, hi = L !== undefined ? Math.max(hi0, hi0 + (L - 1)) : hi0;
    const slider = (k === 'tilt' ? base.tilt + v : base[k] + ((L !== undefined ? r6(L * v) : v) - 1)) + (adjust[k] ?? 0);
    if (slider < lo - 1e-9 || slider > hi + 1e-9) out.push(`face.${k} ${v} puts the studio's slider at ${r6(slider)}, outside its range [${r6(lo)}, ${r6(hi)}] for the ${preset} base: the head still builds, but the read past this is the operator's call`);
  }
  return out;
}

/** `'short'` | `{ style, length: 1.1, locks: { 'fringe-3': { ty: -0.05 } } }` | a list → `{ style|null, …controls, locks }`.
 * The family word is last-wins, the controls compose (ratios by product, offsets by sum), lock edits sum per key. */
export function resolveAnimeHair(spec) {
  const list = Array.isArray(spec) ? spec : [spec]; let style = null; const controls = []; const locks = {}; const form = {};
  for (const entry of list) {
    if (entry === undefined || entry === null) continue;
    let e = entry;
    if (typeof e === 'string') { if (!ANIME_HAIR_MOVES[e]) { style = e; continue; } e = ANIME_HAIR_MOVES[e].hair; }
    if (typeof e !== 'object') throw new Error('hair: an entry must be a family word, a hair trait or a control object');
    const { style: s, locks: L, ...rest } = e; if (typeof s === 'string') style = s;
    // the hair form words ride beside the controls: composed last-wins (an object word key by key); null is no word
    for (const k of ANIME_HAIR_FORM_WORDS) if (k in rest) { const v = rest[k]; delete rest[k]; if (v !== undefined && v !== null) form[k] = k in form ? composeFormWord(k, form[k], v) : composeFormWord(k, undefined, v); }
    controls.push(rest);
    for (const [name, edit] of Object.entries(L || {})) { const cur = { ...(locks[name] ?? {}) }; for (const k of ANIME_LOCK_KEYS) if (edit?.[k] !== undefined) cur[k] = r6((cur[k] ?? 0) + edit[k]); locks[name] = cur; }
  }
  if (style !== null && !ANIME_HAIR_STYLES.includes(style)) throw new Error(`hair: unknown anime family '${style}' (have ${ANIME_HAIR_STYLES.join(', ')}; traits ${Object.keys(ANIME_HAIR_MOVES).join(', ')})`);
  const { from: _f, ...resolved } = ANIME_HAIR.resolve(controls);
  // SPARSE: a form word only when some entry gave it, in the words' order
  return { style, ...resolved, locks: Object.fromEntries(Object.entries(locks).sort(([a], [b]) => (a < b ? -1 : 1))), ...Object.fromEntries(ANIME_HAIR_FORM_WORDS.filter((k) => k in form).map((k) => [k, structuredClone(form[k])])) };
}
export function validateAnimeHair(spec, label = 'hair') {
  if (spec === undefined || spec === null) return [];
  const list = Array.isArray(spec) ? spec : [spec], errs = [];
  for (const [i, entry] of list.entries()) {
    const at = list.length > 1 ? `${label}[${i}]` : label;
    if (typeof entry === 'string') { if (!ANIME_HAIR_STYLES.includes(entry) && !ANIME_HAIR_MOVES[entry]) errs.push(`${at}: unknown anime family '${entry}' (have ${ANIME_HAIR_STYLES.join(', ')}; traits ${Object.keys(ANIME_HAIR_MOVES).join(', ')})`); continue; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at}: a family word (${ANIME_HAIR_STYLES.join(', ')}), a control object ({ style?, ${ANIME_HAIR_KEYS.join(', ')}, locks? }) or a list`); continue; }
    const { style, locks, ...rest0 } = entry;
    // a null family is the stored own layer's "none of its own" (a look's or the base's family stands)
    if (style !== undefined && style !== null && !ANIME_HAIR_STYLES.includes(style)) errs.push(`${at}.style: unknown anime family '${style}' (have ${ANIME_HAIR_STYLES.join(', ')})`);
    const rest = Object.fromEntries(Object.entries(rest0).filter(([k]) => !ANIME_HAIR_FORM_WORDS.includes(k)));
    errs.push(...ANIME_HAIR.validate(rest, at), ...hairFormErrors(entry, at));
    if (locks !== undefined) {
      if (!locks || typeof locks !== 'object' || Array.isArray(locks)) errs.push(`${at}.locks: an object of clump name → { ${ANIME_LOCK_KEYS.join(', ')} } (construction units)`);
      else for (const [name, edit] of Object.entries(locks)) {
        if (!ANIME_LOCK_RE.test(name)) { errs.push(`${at}.locks.${name}: not a clump (fringe-1…7, left-temple-0…2, right-temple-0…2, back-1…11, crown-1-0…2 / crown--1-0…2 on short, ahoge, tail with a sideTail)`); continue; }
        if (!edit || typeof edit !== 'object' || Array.isArray(edit)) { errs.push(`${at}.locks.${name}: { ${ANIME_LOCK_KEYS.join(', ')} } (control point and tip moves, construction units)`); continue; }
        // a move in construction units, bounded as the sweep fields are (a runaway number is refused by name, not built)
        for (const [k, v] of Object.entries(edit)) if (!ANIME_LOCK_KEYS.includes(k)) errs.push(`${at}.locks.${name}.${k}: not a lock edit (have ${ANIME_LOCK_KEYS.join(', ')})`); else if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${at}.locks.${name}.${k}: must be a finite number`); else if (Math.abs(v) > LOCK_EDIT_MAX) errs.push(`${at}.locks.${name}.${k}: ${v} is past ±${LOCK_EDIT_MAX} construction units (the studio's own edits stay within ±0.2)`);
      }
    }
  }
  return errs;
}
/** Advisory: the controls outside the studio's ranges, lock edits past its ±0.2, clumps the family does not grow, the lift
 * past its comfortable range, and `volume` beside the lift. `words` (optional): the hair the WORDS made (the hair base
 * and a look's hair, anime-looks `composeAnime` `hairWords`) — a control's range is widened by the words' own value and a
 * lock edit read past the words' own, so only the operator's own layer is advised against (a cut's authored edits past
 * ±0.2 never warn). */
export function animeHairWarnings(resolved, { words = null } = {}) {
  if (!resolved) return [];
  const out = [];
  for (const k of ANIME_HAIR.KEYS) {
    const v = resolved[k]; if (v === undefined) continue;
    const [lo0, hi0] = ANIME_HAIR.RANGES[k], W = words?.[k], d = W === undefined ? 0 : W - ANIME_HAIR.DEFAULT[k], lo = Math.min(lo0, lo0 + d), hi = Math.max(hi0, hi0 + d);
    if (v < lo - 1e-9 || v > hi + 1e-9) out.push(`hair.${k} ${v} is outside the comfortable range [${r6(lo)}, ${r6(hi)}]: the figure still closes, but the read past this is the operator's call`);
  }
  for (const [name, edit] of Object.entries(resolved.locks || {})) {
    if (/^crown-/.test(name) && resolved.style !== 'short') out.push(`hair.locks.${name}: only the short family grows crown clumps; the edit has no effect on '${resolved.style}'`);
    for (const [k, v] of Object.entries(edit)) if (Math.abs(v - (words?.locks?.[name]?.[k] ?? 0)) > 0.2 + 1e-9) out.push(`hair.locks.${name}.${k} ${v} is past the studio's ±0.2${words?.locks?.[name]?.[k] ? ` off the words' ${words.locks[name][k]}` : ''}: the clump still builds, but its root may no longer lead it`);
  }
  if (isObj(resolved.lift)) {
    for (const k of LIFT_KEYS) { const v = resolved.lift[k]; if (v === undefined || v === words?.lift?.[k]) continue; const [lo, hi] = LIFT_COMFORT[k]; if (v < lo || v > hi) out.push(`hair.lift.${k} ${v} is outside the comfortable range [${lo}, ${hi}] (construction units; the head ≈ 2.2 tall): past it the mass reads as a helmet, or hugs the skull`); }
    if (resolved.volume !== 1 && resolved.volume !== words?.volume) out.push(`hair.volume ${resolved.volume} beside the lift: volume scales the fringe's control points forward into a visor in profile; the lift already stands the mass off the skull — keep volume at 1 and raise hair.lift instead`);
  }
  if ((resolved.crownAccents === 'tuck' || resolved.crownAccents === 'none') && resolved.crownAccents !== words?.crownAccents && resolved.style !== 'short') out.push(`hair.crownAccents '${resolved.crownAccents}': only the short family grows crown accents; the word has no effect on '${resolved.style}'`);
  return out;
}
export const describeAnimeHair = (resolved) => { const d = ANIME_HAIR.describe(resolved), n = Object.keys(resolved.locks || {}).length, form = ANIME_HAIR_FORM_WORDS.filter((k) => resolved[k] !== undefined && resolved[k] !== null && resolved[k] !== false); return `${resolved.style}${d ? ` (${d.replace(/^hair /, '')})` : ''}${n ? `, ${n} clump${n === 1 ? '' : 's'} directed` : ''}${form.length ? `; form ${form.map((k) => (typeof resolved[k] === 'string' ? `${k} ${resolved[k]}` : k)).join(', ')}` : ''}`; };

/** `'smile'` | `{ open: 0.4 }` | `['smile', { brow: -0.2 }]` → the four amounts; a pose word resets, an object adjusts */
export function resolveAnimeExpression(spec) {
  const out = Object.fromEntries(EXPRESSION_KEYS.map((k) => [k, 0]));
  for (const entry of (Array.isArray(spec) ? spec : [spec])) {
    if (entry === undefined || entry === null) continue;
    if (typeof entry === 'string') { if (!ANIME_POSES[entry]) throw new Error(`expression: unknown anime pose '${entry}' (have ${Object.keys(ANIME_POSES).join(', ')})`); for (const k of EXPRESSION_KEYS) out[k] = ANIME_POSES[entry][k] ?? 0; continue; }
    for (const k of EXPRESSION_KEYS) if (entry[k] !== undefined) out[k] = entry[k];
  }
  return out;
}
export function validateAnimeExpression(spec, label = 'expression') {
  if (spec === undefined || spec === null) return [];
  const errs = [];
  for (const [i, entry] of (Array.isArray(spec) ? spec : [spec]).entries()) {
    const at = Array.isArray(spec) ? `${label}[${i}]` : label;
    if (typeof entry === 'string') { if (!ANIME_POSES[entry]) errs.push(`${at}: unknown anime pose '${entry}' (have ${Object.keys(ANIME_POSES).join(', ')})`); continue; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at}: a pose (${Object.keys(ANIME_POSES).join(', ')}), amounts { ${EXPRESSION_KEYS.join(', ')} } or a list`); continue; }
    for (const [k, v] of Object.entries(entry)) if (!EXPRESSION_KEYS.includes(k)) errs.push(`${at}.${k}: not an expression amount (have ${EXPRESSION_KEYS.join(', ')})`); else if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${at}.${k}: must be a finite number`);
  }
  return errs;
}
export function animeExpressionWarnings(resolved) {
  const out = [];
  for (const [k, , lo, hi] of ANIME_EXPRESSION_DEFS) if (resolved?.[k] !== undefined && (resolved[k] < lo || resolved[k] > hi)) out.push(`expression.${k} ${resolved[k]} is outside the studio's [${lo}, ${hi}]`);
  return out;
}

/** The studio recipe these words make: the design base (with mojulo's base adjustments), each face value as the studio's
 * slider (base + (v − 1); the lift as base + offset), the hair family and controls, the four amounts and the lock edits
 * (missing axes 0). The result is a recipe the studio itself loads. The GRAPHIC FACE (any `sculpt` but `false`, the
 * default): the graphic base's face layer sits under the face words, and its sculpt rides as `r.sculpt` (buildAnime
 * units, anime-sculpt.js `sculptBuild`); `sculpt: false` is the studio's recipe exactly. */
export function animeRecipe({ preset = 'female', face = {}, hair = {}, expression = {}, sculpt } = {}) {
  if (!ANIME_PRESETS.includes(preset)) throw new Error(`anime head: unknown design base '${preset}' (have ${ANIME_PRESETS.join(', ')})`);
  const SC = sculpt === false ? false : resolveAnimeSculpt(sculpt ?? null);
  const r = animeFresh(preset), F = SC === false ? resolveAnimeFace(face) : resolveAnimeFace([GRAPHIC_BASE[preset].face, face]), H = hair && typeof hair === 'object' && !Array.isArray(hair) && 'locks' in hair && 'volume' in hair ? hair : resolveAnimeHair(hair), E = expression && typeof expression === 'object' && !Array.isArray(expression) && EXPRESSION_KEYS.every((k) => k in expression) ? expression : resolveAnimeExpression(expression);
  const adjust = ANIME_BASE_ADJUST[preset] ?? {};
  for (const k of ANIME_FACE_KEYS) r.face[k] = (k === 'tilt' ? r.face.tilt + F.tilt : r.face[k] + (F[k] - 1)) + (adjust[k] ?? 0);
  r.hair.style = H.style ?? r.hair.style;
  for (const k of ANIME_HAIR_KEYS) if (k !== 'strands' && (k !== 'ahoge' || H.ahoge)) r.hair[k] = H[k];   // the studio's recipe shape unless an ahoge grows; `strands` is how it is built, not what
  for (const k of EXPRESSION_KEYS) r.expression[k] = E[k];
  r.locks = Object.fromEntries(Object.entries(H.locks || {}).map(([name, e]) => [name, Object.fromEntries(ANIME_LOCK_KEYS.map((k) => [k, e[k] ?? 0]))]));
  if (SC !== false) r.sculpt = sculptBuild(preset, SC);
  return r;
}

// ─── the geometry ─────────────────────────────────────────────────────────
const TOL = 1e-7;   // weld tolerance, studio units
/** flat triangle soup [x,y,z × 3 …] (a range of it) → triangles */
const trisOf = (flat, start = 0, end = flat.length) => { const out = []; for (let i = start; i < end; i += 9) out.push([flat.slice(i, i + 3), flat.slice(i + 3, i + 6), flat.slice(i + 6, i + 9)]); return out; };
/** weld coincident corners (within TOL) and drop triangles that collapse; `labels` ride per triangle. The grid is keyed by
 * integers, one Map per axis (no key string built per probe); the 27 cells are visited in the same order and each keeps
 * its insertion order, so the first match (and the welded mesh) is the same as a string-keyed grid's. */
function weld(tris, labels) {
  const points = [], grid = new Map(), faces = [], groups = [];
  const cell = (v) => v.map((x) => Math.round(x / TOL / 10));
  const cellList = (c0, c1, c2, make) => {
    let a = grid.get(c0); if (!a) { if (!make) return null; grid.set(c0, a = new Map()); }
    let b = a.get(c1); if (!b) { if (!make) return null; a.set(c1, b = new Map()); }
    let l = b.get(c2); if (!l && make) b.set(c2, l = []); return l || null;
  };
  const idOf = (p) => {
    const c = cell(p);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = cellList(c[0] + dx, c[1] + dy, c[2] + dz, false); if (!l) continue;
      for (const i of l) { const q = points[i]; if (Math.abs(q[0] - p[0]) <= TOL && Math.abs(q[1] - p[1]) <= TOL && Math.abs(q[2] - p[2]) <= TOL) return i; }
    }
    cellList(c[0], c[1], c[2], true).push(points.length); points.push(p); return points.length - 1;
  };
  tris.forEach((t, n) => { const f = t.map(idOf); if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]) { faces.push(f); groups.push(labels?.[n]); } });
  return { points, faces, groups };
}
/** Zip hairline cracks: boundary corners within `tol` of another boundary corner (that is not its edge neighbour) merge at
 * their midpoint. The studio's front and back shells miss each other along the lower jaw seam by up to ~0.0015 units (a
 * front-only term — the dip around the mouth — does not vanish at the seam where the face is narrow); its renderer is
 * double-sided and never shows it. Moves nothing else. */
function zip(m, tol) {
  const count = new Map(); for (const f of m.faces) for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); }
  const bEdges = [...count].filter(([, n]) => n === 1).map(([e]) => e.split('|').map(Number));
  if (!bEdges.length) return m;
  const nbr = new Map(); for (const [a, b] of bEdges) { for (const [x, y] of [[a, b], [b, a]]) { if (!nbr.has(x)) nbr.set(x, new Set()); nbr.get(x).add(y); } }
  const verts = [...nbr.keys()], parent = new Map(verts.map((v) => [v, v])), find = (v) => { while (parent.get(v) !== v) v = parent.get(v); return v; };
  for (const a of verts) {
    let best = null, bd = tol;
    for (const b of verts) { if (b === a || nbr.get(a).has(b)) continue; const d = dmath.hypot(...vsub(m.points[a], m.points[b])); if (d <= bd) { bd = d; best = b; } }
    if (best !== null) { const ra = find(a), rb = find(best); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); }
  }
  const groupsOfRoot = new Map(); for (const v of verts) { const r = find(v); if (!groupsOfRoot.has(r)) groupsOfRoot.set(r, []); groupsOfRoot.get(r).push(v); }
  for (const [r, members] of groupsOfRoot) if (members.length > 1) m.points[r] = vmul(members.reduce((s, v) => vadd(s, m.points[v]), [0, 0, 0]), 1 / members.length);
  const faces = [], groups = [];
  m.faces.forEach((f, i) => { const g = f.map((v) => (parent.has(v) ? find(v) : v)); if (g[0] !== g[1] && g[1] !== g[2] && g[0] !== g[2]) { faces.push(g); groups.push(m.groups[i]); } });
  return { points: m.points, faces, groups };
}
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vunit = (a) => { const l = dmath.hypot(...a) || 1; return vmul(a, 1 / l); };
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** edge-connected components, each re-indexed onto its own points */
function components(mesh) {
  const byEdge = new Map(); mesh.faces.forEach((f, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); if (!byEdge.has(e)) byEdge.set(e, []); byEdge.get(e).push(i); } });
  const seen = new Array(mesh.faces.length).fill(false), out = [];
  for (let s = 0; s < mesh.faces.length; s++) {
    if (seen[s]) continue; const stack = [s], members = []; seen[s] = true;
    while (stack.length) { const i = stack.pop(); members.push(i); const f = mesh.faces[i]; for (let k = 0; k < 3; k++) for (const j of byEdge.get(edgeKey(f[k], f[(k + 1) % 3]))) if (!seen[j]) { seen[j] = true; stack.push(j); } }
    members.sort((a, b) => a - b);
    const remap = new Map(), points = [], faces = [], groups = [];
    for (const i of members) { faces.push(mesh.faces[i].map((v) => { if (!remap.has(v)) { remap.set(v, points.length); points.push(mesh.points[v]); } return remap.get(v); })); groups.push(mesh.groups[i]); }
    out.push({ points, faces, groups });
  }
  return out;
}
/** propagate one winding across shared edges (a flipped neighbour is turned) — the studio drew double-sided */
function orientConsistently(mesh) {
  const byEdge = new Map(); mesh.faces.forEach((f, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); if (!byEdge.has(e)) byEdge.set(e, []); byEdge.get(e).push(i); } });
  const done = new Array(mesh.faces.length).fill(false);
  const has = (f, a, b) => { for (let k = 0; k < 3; k++) if (f[k] === a && f[(k + 1) % 3] === b) return true; return false; };
  for (let s = 0; s < mesh.faces.length; s++) {
    if (done[s]) continue; done[s] = true; const stack = [s];
    while (stack.length) {
      const i = stack.pop(), f = mesh.faces[i];
      for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3];
        for (const j of byEdge.get(edgeKey(a, b))) { if (done[j]) continue; const g = mesh.faces[j]; if (has(g, a, b)) mesh.faces[j] = [g[0], g[2], g[1]]; done[j] = true; stack.push(j); } }
    }
  }
  return mesh;
}
const signedVolume = (m) => m.faces.reduce((s, [a, b, c]) => s + vdot(m.points[a], vcross(m.points[b], m.points[c])), 0) / 6;
const faceNormal = (m, [a, b, c]) => vcross(vsub(m.points[b], m.points[a]), vsub(m.points[c], m.points[a]));
const boundaryEdges = (m) => { const count = new Map(); for (const f of m.faces) for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); } return [...count].filter(([, n]) => n === 1).map(([e]) => e); };
const flipAll = (m) => { m.faces = m.faces.map(([a, b, c]) => [a, c, b]); return m; };
/** a closed mesh turned outward (positive volume); an open one turned so its area-weighted normal faces `outward` */
function outward(m, dir) {
  if (!boundaryEdges(m).length) { if (signedVolume(m) < 0) flipAll(m); return m; }
  const n = m.faces.reduce((s, f) => vadd(s, faceNormal(m, f)), [0, 0, 0]);
  if (vdot(n, dir) < 0) flipAll(m); return m;
}
/** An open, oriented, outward patch closed as a slab: a back sheet `depth` behind it (along −its vertex normals, or −`along`
 * when given: one direction for a lens or ribbon), reversed, and a side band along every boundary edge. */
function solidify(m, depth, along) {
  const n = m.points.length, normals = m.points.map(() => [0, 0, 0]);
  for (const f of m.faces) { const fn = faceNormal(m, f); for (const v of f) normals[v] = vadd(normals[v], fn); }
  const back = m.points.map((p, i) => vsub(p, vmul(along ? along : vunit(normals[i]), depth)));
  const faces = [...m.faces], groups = [...m.groups];
  for (const [a, b, c] of m.faces) { faces.push([c + n, b + n, a + n]); groups.push(m.groups[0]); }
  const has = (f, a, b) => { for (let k = 0; k < 3; k++) if (f[k] === a && f[(k + 1) % 3] === b) return true; return false; };
  const bset = new Set(boundaryEdges(m));
  for (const f of m.faces) for (let k = 0; k < 3; k++) {
    const a = f[k], b = f[(k + 1) % 3]; if (!bset.has(edgeKey(a, b)) || !has(f, a, b)) continue;
    faces.push([b, a, a + n], [b, a + n, b + n]); groups.push(m.groups[0], m.groups[0]);
  }
  return { points: [...m.points, ...back], faces, groups };
}
const centroid = (m) => vmul(m.points.reduce(vadd, [0, 0, 0]), 1 / m.points.length);

// The core carrier: an ellipsoid inside the skull, 16 slots mirrored by name, the rig binds it to the head bone.
const CORE_SLOTS = ['front', 'f1R', 'f2R', 'f3R', 'sideR', 'b3R', 'b2R', 'b1R', 'back', 'b1L', 'b2L', 'b3L', 'sideL', 'f3L', 'f2L', 'f1L'];
function coreCarrier(c, r) {
  const Z = [-0.8, -0.5, -0.15, 0.2, 0.55, 0.82];
  const stations = Z.map((z, i) => {
    const k = Math.sqrt(1 - z * z), points = {};
    CORE_SLOTS.forEach((slot, j) => { const a = j / CORE_SLOTS.length * 2 * Math.PI; points[slot] = [r6(c[0] + dmath.sin(a) * r[0] * k), r6(c[1] + dmath.cos(a) * r[1] * k), r6(c[2] + z * r[2])]; });
    points.front[0] = 0; points.back[0] = 0;
    return { id: `st${i}`, points };
  });
  return { layer: 1, closure: 'closed', slots: CORE_SLOTS, stations, group: 'Skin', caps: { back: [0, r6(c[1]), r6(c[2] - 0.97 * r[2])], tip: [0, r6(c[1]), r6(c[2] + 0.97 * r[2])] } };
}

/** The COVERAGE ledger (hair-passes): how much of the scalp — the skin above the studio's hairline — still shows through
 * the hair, per view (back, lateral, the rear three-quarter, top): the scalp's pixels with the hair on over its pixels
 * bald, through one camera per view. 0 is covered. Advice, never a refusal. `parts` the head's parts, `scalp` the face
 * part's scalp face ids. */
export const COVERAGE_VIEWS = Object.freeze({ back: [0, 8], lateral: [90, 8], 'rear-three-quarter': [45, 12], top: [0, 70] });
export function animeHairCoverage(parts, scalp, { res = 160 } = {}) {
  const withHair = compileLayered({ parts, dials: {}, creases: {} });
  const baldParts = Object.fromEntries(Object.entries(parts).filter(([k]) => !k.startsWith('hair')));
  const bald = compileLayered({ parts: baldParts, dials: {}, creases: {} });
  const scalpSet = (m) => { const want = new Set(scalp.map((f) => `face/${f}`)); return new Set(m.faceIds.flatMap((id, i) => (want.has(id) ? [i] : []))); };
  const A = scalpSet(withHair), B = scalpSet(bald), views = {};
  for (const [view, [az, el]] of Object.entries(COVERAGE_VIEWS)) {
    const cam = viewCamera(withHair, az, { elevationDegrees: el, size: res });
    const count = (m, set) => { const f = rasterDepth(m, cam, res).face; let n = 0; for (let i = 0; i < f.length; i++) if (f[i] >= 0 && set.has(f[i])) n++; return n; };
    const shown = count(withHair, A), total = count(bald, B);
    views[view] = total ? Math.round(shown / total * 1000) / 1000 : 0;
  }
  const worst = Object.entries(views).sort((a, b) => b[1] - a[1])[0];
  return { views, worst: { view: worst[0], share: worst[1] } };
}
/** the ledger's advice: a view where more than `threshold` of the scalp shows */
export const animeCoverageWarnings = (cov, threshold = 0.05) => (cov ? Object.entries(cov.views).filter(([, v]) => v > threshold).map(([view, v]) => `hair: the scalp shows from the ${view} (${Math.round(v * 100)} % of it): raise hair.volume, lengthen the family, or direct a clump over it`) : []);

/** the studio's colours (its inspection palette), the operator's skin and hair over them */
export function animePalette(skin = '#dbd1bd', hair = '#424f59', overrides = {}) {
  return { Skin: skin, Sclera: '#faf7eb', Iris: '#4d6b6e', Pupil: '#12171a', Ink: '#292e33', Mouth: '#3d2124', Hair: hair, ...overrides };
}
const LOCK_PART = (name) => {
  let m = name.match(/^fringe-(\d+)$/); if (m) return `hairFringe${m[1]}`;
  m = name.match(/^(left|right)-temple-(\d)$/); if (m) return `hairTemple${m[1] === 'left' ? 'L' : 'R'}${m[2]}`;
  m = name.match(/^back-(\d+)$/); if (m) return `hairBack${m[1]}`;
  m = name.match(/^crown-(-?1)-(\d)$/); if (m) return `hairCrown${m[1] === '-1' ? 'L' : 'R'}${m[2]}`;
  if (name === 'ahoge') return 'hairAhoge';
  if (name === 'tail') return 'hairTail';
  m = name.match(/^(pepper|banana|carrot)-(\d+)$/); if (m) return `hair${m[1][0].toUpperCase()}${m[1].slice(1)}${m[2]}`;   // the shapes: pepper-0 → hairPepper0
  if (/^form[A-Z]/.test(name)) return `hair${name[0].toUpperCase()}${name.slice(1)}`;   // a consolidated section: formBackC → hairFormBackC
  throw new Error(`anime head: unknown clump '${name}'`);
};
/** the part a studio clump becomes (`fringe-3` → `hairFringe3`, `left-temple-0` → `hairTempleL0`, `crown--1-2` → `hairCrownL2`) */
export const animeLockPart = LOCK_PART;
/** the graphic face's draw-order flags: the brows and the lid bands are drawn THROUGH the fringe (`through`), the fringe's
 * parts VEIL them (`veil`) — never the side locks or the back, whose lid tails would smudge in profile */
const layerFlag = (name) => (/^(brow|lid)[RL]$/.test(name) ? { through: 'fringe' } : /^hair(Form)?Fringe/.test(name) ? { veil: 'fringe' } : {});

/**
 * The anime head, ready to wear.
 * @param {object} o
 *   preset      'female' | 'male' — the studio's design base
 *   face        the FACE words (a move, a ratio object over the studio's controls, a list); 1 = the base
 *   hair        a family word, a hair trait, `{ style, …controls, locks, …hair form words }` or a list; `'none'` wears no
 *               hair (the hair form rides to the build as its own option, never into the studio recipe)
 *   expression  a pose word, amounts `{ blink, smile, open, brow }` or a list
 *   register    'lowpoly' (the studio's coarse sampling) | anything else (its full sampling)
 *   scale       the head's uniform scale (its core, pin-local offsets and anchors together)
 *   skin, hairColor, palette  colours (`Skin`, `Hair` and the studio's groups)
 *   sculpt      the GRAPHIC FACE's words (anime-sculpt.js: a move, an object, a list); absent is the graphic base, `false`
 *               the studio's own face
 *   only        a list of part names: just those parts, in the head's order and at its scale, as `{ parts }` — nothing
 *               measured (no coverage, landmarks or feature table); absent (the default) is the whole head
 * @returns the landmark head's include shape: { name, parts, dials, creases, palette, bind, joints, chinZ, hair,
 *   hairMeasures, face, expression, preset, register, scale, landmarks, recipe, measures }
 */
/** The feature table of a head's NEUTRAL TWIN (the same base, face and sculpt at rest, bald and unfitted), for a head at
 * another expression. animeHead is pure, so the table is kept by its inputs (a few recent ones): a door that generates
 * the same hero twice (an edit's hand-edit check, then its plan) builds the twin once. A copy is handed out. */
const FEATURE_TWINS = new Map(), FEATURE_TWINS_MAX = 16;
function neutralTwinFeatures({ preset, face, register, sculpt }) {
  const key = JSON.stringify([preset, face, register, sculpt === undefined ? null : sculpt]);
  let f = FEATURE_TWINS.get(key);
  if (f === undefined) {
    f = animeHead({ preset, face, hair: 'none', expression: 'neutral', register, sculpt, hairFit: false }).measures.features;
    if (FEATURE_TWINS.size >= FEATURE_TWINS_MAX) FEATURE_TWINS.delete(FEATURE_TWINS.keys().next().value);
    FEATURE_TWINS.set(key, f);
  }
  return structuredClone(f);
}
/** the head's scale over its parts, in place: the core's stations and caps, every pinned part's pin-local offsets */
function scaleParts(parts, scale) {
  if (scale !== 1) for (const p of Object.values(parts)) {
    if (p.layer === 1) { for (const st of p.stations) for (const [k, v] of Object.entries(st.points)) st.points[k] = v.map((x) => r6(x * scale)); for (const [k, v] of Object.entries(p.caps)) p.caps[k] = v.map((x) => r6(x * scale)); }
    else for (const [k, v] of Object.entries(p.offsets)) p.offsets[k] = v.map((x) => r6(x * scale));
  }
  return parts;
}
/** The graphic face's EAR (head-ear.js, the anime style: the rim, one fold and the bowl) in the studio ellipsoid's box,
 * read at the studio's carriage (the head's pitch undone about its pivot) and pitched back with the head, so the ear turns
 * with it: its root at the ellipsoid's centre (on the head's surface), its height and depth the ellipsoid's. The
 * studio-exact face (`sculpt: false`) keeps the ellipsoid. */
function animeEar(studio, register, pivot, pitch) {
  // the studio's pitch about x in hero metres (studio y up → hero z, studio z back → hero −y): (y, z) turned by `a`
  const turn = (a) => { const c = dmath.cos(a), sn = dmath.sin(a); return (p) => { const y = p[1] - pivot[1], z = p[2] - pivot[2]; return [p[0], pivot[1] + c * y - sn * z, pivot[2] + sn * y + c * z]; }; };
  const flat = studio.points.map(turn(-pitch)), back = turn(pitch);
  const lo = [0, 1, 2].map((k) => Math.min(...flat.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...flat.map((p) => p[k])));
  const side = lo[0] + hi[0] > 0 ? 1 : -1, height = hi[2] - lo[2];
  const e = earMesh({ origin: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], side, height, width: (hi[1] - lo[1]) / (height * 0.61), style: 'anime', sparse: register === 'lowpoly' });
  const ids = Object.keys(e.points), at = Object.fromEntries(ids.map((id, i) => [id, i]));
  return { points: ids.map((id) => back(e.points[id])), faces: e.faces.map((f) => f.map((id) => at[id])), groups: e.groups };
}
export function animeHead({ preset = 'female', face = {}, hair, expression = 'neutral', register = 'round', scale = 1, skin, hairColor, palette = {}, hairFit = true, sculpt, only = null, body = null } = {}) {
  if (!ANIME_PRESETS.includes(preset)) throw new Error(`anime head: unknown design base '${preset}' (have ${ANIME_PRESETS.join(', ')})`);
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error('anime head: scale must be positive');
  const bald = hair === 'none';
  for (const [spec, errs] of [[face, validateAnimeFace(face)], [bald ? null : hair, validateAnimeHair(bald ? null : hair)], [expression, validateAnimeExpression(expression)], [sculpt, validateAnimeSculpt(sculpt)]]) if (errs.length) throw new Error(`anime head: ${errs.join('; ')}`);
  const F = resolveAnimeFace(face), H = resolveAnimeHair(bald ? null : hair ?? null), E = resolveAnimeExpression(expression);
  if (H.style === null) H.style = animeDefaultStyle(preset);
  const recipe = animeRecipe({ preset, face: F, hair: H, expression: E, sculpt });
  const SCULPT = !!recipe.sculpt;
  // the hair seats on the head it grows on (anime-form `fitHair`); `hairFit: false` is the studio's own cap and clumps
  // the bob, long and hime families consolidate their clumps into sections (anime-form `forms`); `strands: 1` keeps the
  // studio's separate clumps; the graphic face's lenses take the game budget on the lowpoly register
  // the hair form (the lift, the section, the cut's words) rides as its own option, never in the studio recipe
  const HAIR_FORM = bald ? null : animeHairForm(H);
  const model = buildAnime(recipe, { coarse: register === 'lowpoly', weld: true, fitHair: hairFit, forms: !(H.strands > 0), ...(SCULPT ? { sculpt: recipe.sculpt, ...(register === 'lowpoly' ? { budget: 'game' } : {}) } : {}), ...(HAIR_FORM ? { hairForm: HAIR_FORM } : {}), ...(body && HAIR_FORM ? { body: { registration: REGISTRATION[preset], rings: body } } : {}) });

  // registration: the studio's pitched head → hero metres, by the fitted heads' numbers for this pole
  const skinFlat = model.parts.skin, faceEnd = model.ears.start;
  let yLo = Infinity, yHi = -Infinity, zLo = Infinity, zHi = -Infinity;
  for (let i = 0; i < faceEnd; i += 3) { const y = skinFlat[i + 1], z = skinFlat[i + 2]; if (y < yLo) yLo = y; if (y > yHi) yHi = y; if (z < zLo) zLo = z; if (z > zHi) zHi = z; }
  const R = REGISTRATION[preset], S = R.height / (yHi - yLo), TZ = R.menton - S * yLo, TY = R.midY - S * (-zLo + -zHi) / 2;
  const toM = (p) => [p[0] * S, -p[2] * S + TY, p[1] * S + TZ];
  const meshOf = (tris, labels) => { const m = weld(tris, labels); m.points = m.points.map(toM); return m; };

  // the parts, each closed and outward, in hero metres (before the head's scale)
  const meshes = {}, H0 = [0, R.midY, R.menton + R.height * 0.55];   // a point inside the skull, for "outward" on open patches
  const faceTris = [...trisOf(skinFlat, 0, faceEnd), ...trisOf(model.parts.sclera), ...trisOf(model.parts.mouth)];
  const faceLabels = [...trisOf(skinFlat, 0, faceEnd).map(() => 'Skin'), ...trisOf(model.parts.sclera).map(() => 'Sclera'), ...trisOf(model.parts.mouth).map(() => 'Mouth')];
  const welded = weld(faceTris, faceLabels);
  meshes.face = zip(welded, 0.003);
  // the SCALP: skin faces above the studio's hairline (measured unpitched), for the coverage ledger
  const unpitch = (p) => { const c = dmath.cos(-model.pitch), sn = dmath.sin(-model.pitch), y = p[1] - model.pivot[1], z = p[2] - model.pivot[2]; return [p[0], model.pivot[1] + c * y - sn * z, model.pivot[2] + sn * y + c * z]; };
  // (the hair form's `hairline` raises its front edge, so a swept-back cut's forehead is not counted as scalp)
  const hairlineY = HAIR_FORM?.hairline ? (a) => 0.10 + (HAIR_FORM.hairline.front - 0.10) * Math.max(0, dmath.cos(a)) - 0.48 * Math.max(0, -dmath.cos(a)) : (a) => 0.10 + 0.43 * Math.max(0, dmath.cos(a)) - 0.48 * Math.max(0, -dmath.cos(a));
  const scalp = meshes.face.faces.flatMap((f, i) => { if (meshes.face.groups[i] !== 'Skin') return []; const c = unpitch(vmul(f.reduce((acc, v) => vadd(acc, meshes.face.points[v]), [0, 0, 0]), 1 / 3)); return c[1] > hairlineY(dmath.atan2(c[0], -(c[2] - 0.07))) + 0.02 ? [`f${i}`] : []; });
  meshes.face.points = meshes.face.points.map(toM);
  meshes.face = outward(orientConsistently(meshes.face), [0, 1, 0]);
  for (const ear of components(meshOf(trisOf(skinFlat, model.ears.start, model.ears.end), null))) { const m = outward(orientConsistently(ear)); m.groups = m.groups.map(() => 'Skin'); meshes[centroid(m)[0] > 0 ? 'earR' : 'earL'] = SCULPT ? animeEar(m, register, toM(model.pivot), model.pitch) : m; }
  const lens = (part, group, depth) => {
    for (const c of components(meshOf(trisOf(model.parts[part]), null))) {
      const o = orientConsistently(c); o.groups = o.groups.map(() => group);
      const out = vunit(vsub(centroid(o), H0)); outward(o, out);
      const n = vunit(o.faces.reduce((s, f) => vadd(s, faceNormal(o, f)), [0, 0, 0]));
      const name = `${part}${centroid(o)[0] > 0 ? 'R' : 'L'}`; if (SCULPT && meshes[name]) throw new Error(`anime head: ${name} split into more than one piece`);
      meshes[name] = solidify(o, depth, n);
    }
  };
  lens('iris', 'Iris', 0.0015 * S); lens('pupil', 'Pupil', 0.0012 * S);
  // the ink: per side the brow (highest), the upper lash and the lower rim (lowest), each a slab behind its ribbon
  const inkOf = (part) => components(meshOf(trisOf(model.parts[part]), null)).map((c) => { const o = orientConsistently(c); o.groups = o.groups.map(() => 'Ink'); outward(o, vunit(vsub(centroid(o), H0))); return o; });
  const ink = inkOf('ink');
  if (!SCULPT) for (const side of ['R', 'L']) {
    const mine = ink.filter((m) => (centroid(m)[0] > 0) === (side === 'R')).sort((a, b) => centroid(b)[2] - centroid(a)[2]);
    mine.forEach((m, i) => { const n = vunit(m.faces.reduce((s, f) => vadd(s, faceNormal(m, f)), [0, 0, 0])); meshes[`${['brow', 'lash', 'lashLow'][i] ?? `ink${i}`}${side}`] = solidify(m, 0.004 * S, n); });
  }
  else {
    // the graphic face's ink parts BY KEY (a new stroke never renames another): the lower rim stays in `ink` (lashLow),
    // the lid band (lid), the brow block (brow), the nose line (noseLine, one part); the catchlight a Sclera-group lens.
    // One piece per key and side, or the build refuses.
    const slab = (key, list, sided = true) => { for (const m of list) { const n = vunit(m.faces.reduce((s, f) => vadd(s, faceNormal(m, f)), [0, 0, 0])); const name = sided ? `${key}${centroid(m)[0] > 0 ? 'R' : 'L'}` : key; if (meshes[name]) throw new Error(`anime head: ${name} split into more than one piece`); meshes[name] = solidify(m, 0.004 * S, n); } };
    slab('lashLow', ink);
    for (const key of ['lid', 'brow']) if (model.parts[key]?.length) slab(key, inkOf(key));
    if (model.parts.nose?.length) slab('noseLine', inkOf('nose'), false);
    if (model.parts.catch?.length) lens('catch', 'Sclera', 0.001 * S);
  }
  if (!bald) {
    const cap = orientConsistently(meshOf(trisOf(model.parts.hair, model.cap.start, model.cap.end), null)); cap.groups = cap.groups.map(() => 'Hair');
    outward(cap, [0, 0, 1]); meshes.hairCap = solidify(cap, 0.03 * S);
    for (const lk of model.locks) { if (!lk.count) continue; const m = outward(orientConsistently(meshOf(trisOf(model.parts.hair, lk.start, lk.start + lk.count), null))); m.groups = m.groups.map(() => 'Hair'); meshes[LOCK_PART(lk.name)] = m; }
  }

  // the core carrier: inside the skull (the face's box, shrunk well inside the cranium), bound to the head bone
  const fp = meshes.face.points, lo = [0, 1, 2].map((k) => Math.min(...fp.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...fp.map((p) => p[k])));
  const core = coreCarrier([0, (lo[1] + hi[1]) / 2 - 0.08 * (hi[1] - lo[1]), lo[2] + 0.62 * (hi[2] - lo[2])], [0.26 * (hi[0] - lo[0]), 0.22 * (hi[1] - lo[1]), 0.2 * (hi[2] - lo[2])]);
  const parts = { cranium: core };
  const carrier = compileLayered({ parts: { cranium: core }, dials: {}, creases: {} }).parts;
  const pin = address(carrier, 'cranium', 3.5, 4, 'R'), frame = pinFrame(carrier.cranium, pin);
  const groupsOf = (m) => { const g = m.groups.map((x) => x ?? 'Skin'); return g.every((x) => x === g[0]) ? { group: g[0] } : { group: g[0], groups: Object.fromEntries(g.map((x, i) => [`f${i}`, x])) }; };
  for (const [name, m] of Object.entries(meshes)) {
    if (only && !only.includes(name)) continue;
    const { group, groups } = groupsOf(m);
    parts[name] = { layer: 2, closure: 'closed', pin, group,
      offsets: Object.fromEntries(m.points.map((p, i) => [`v${i}`, surfaceLocalOffset(frame, p).map(r6)])),
      faces: Object.fromEntries(m.faces.map((f, i) => [`f${i}`, f.map((v) => `v${v}`)])), ...(groups ? { groups } : {}), ...(SCULPT ? layerFlag(name) : {}) };
  }
  // `only`: just those parts, at the head's scale, and nothing measured (no coverage, no landmarks, no neutral twin) — the
  // face rig's head builds (anime-face-rig.js), which need the parts an expression moves and nothing else
  if (only) return { parts: scaleParts(Object.fromEntries(Object.entries(parts).filter(([n]) => only.includes(n))), scale) };

  // anchors and measures, off the built parts (hero metres, before the scale)
  const all = (m) => m.points, bboxOf = (pts) => ({ lo: [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi: [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k]))) });
  const skinPts = meshes.face.points, crown = skinPts.reduce((b, p) => (p[2] > b[2] ? p : b)), menton = skinPts.reduce((b, p) => (p[2] < b[2] ? p : b));
  const noseTip = skinPts.filter((p) => Math.abs(p[0]) < 0.004).reduce((b, p) => (p[1] > b[1] ? p : b)), occiput = skinPts.reduce((b, p) => (p[1] < b[1] ? p : b));
  const groupPts = (g) => meshes.face.faces.flatMap((f, i) => (meshes.face.groups[i] === g ? f.map((v) => skinPts[v]) : []));
  const scleraR = groupPts('Sclera').filter((p) => p[0] > 0), mouthPts = groupPts('Mouth');
  const eyeR = meshes.irisR ? centroid(meshes.irisR) : centroid({ points: scleraR }), eyeL = [-eyeR[0], eyeR[1], eyeR[2]];
  const eyeBox = bboxOf(scleraR), faceBox = bboxOf(skinPts);
  const landmarks = { crown, menton, noseTip, occiput, stomion: centroid({ points: mouthPts }), eyeR, eyeL, ...(meshes.browR ? { browR: centroid(meshes.browR), browL: centroid(meshes.browL) } : {}), ...(meshes.earR ? { earR: centroid(meshes.earR), earL: centroid(meshes.earL) } : {}) };
  let hairMeasures = null;
  if (!bald) {
    const hp = Object.entries(meshes).filter(([k]) => k.startsWith('hair')).flatMap(([, m]) => all(m)), r3 = (x) => Math.round(x * scale * 1000) / 1000;
    hairMeasures = { top_m: r3(Math.max(...hp.map((p) => p[2])) - crown[2]), hem_m: r3(Math.min(...hp.map((p) => p[2])) - menton[2]), back_m: r3(occiput[1] - Math.min(...hp.map((p) => p[1]))), parts: Object.keys(meshes).filter((k) => k.startsWith('hair')).length };
  }
  const hairCoverage = bald ? null : animeHairCoverage(parts, scalp);
  const r3 = (x) => Math.round(x * scale * 1000) / 1000;
  const measures = { head_m: r3(crown[2] - menton[2]), crown_z: r3(crown[2]), face_m: r3(faceBox.hi[0] - faceBox.lo[0]), depth_m: r3(faceBox.hi[1] - faceBox.lo[1]), pupils_m: r3(2 * eyeR[0]), eye_m: r3(eyeBox.hi[2] - eyeBox.lo[2]), eyeWidth_m: r3(eyeBox.hi[0] - eyeBox.lo[0]),
    // the feature spacing: ratios (the scale never moves them), always of the face at rest (an expression's closed lids or
    // open mouth would read as a design): a head at another expression measures its neutral twin, bald and unfitted; read
    // at the studio's carriage, so a base's rest carriage or a headPitch word never moves it
    ...(SCULPT ? { features: EXPRESSION_KEYS.every((k) => !E[k]) ? sculptFeatures(meshes, preset, { carriage: model.pitch }) : neutralTwinFeatures({ preset, face: F, register, sculpt }) } : {}) };

  // the head's scale, once: the core, the pin-local offsets and the anchors together
  scaleParts(parts, scale);
  const sc = (p) => p.map((x) => r6(x * scale));
  return { name: 'head', parts, dials: {}, creases: {}, palette: animePalette(skin, hairColor, palette), bind: { cranium: 'head' }, joints: {},
    chinZ: r6(menton[2] * scale), preset, register, scale, face: F, hair: bald ? { style: 'none' } : H, hairMeasures, hairCoverage, scalp, expression: E, recipe,
    landmarks: Object.fromEntries(Object.entries(landmarks).map(([k, p]) => [k, sc(p)])), measures };
}
