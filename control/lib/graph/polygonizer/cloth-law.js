/**
 * cloth-law — the one cloth law's numbers as data: what a worn piece is MADE OF (a material: its rigidity and its weight)
 * and how a REGISTER draws its motion (its budget of strings, how much of the body's travel reaches the cloth, how the
 * result is sampled in time). The law itself is hero-flow.js (point masses on fixed links hung from a skinned anchor,
 * pulled to their skin, falling, feeling the air, kept out of the body's capsules); a register changes the tuning, never
 * the physics.
 *
 *   MATERIALS       a word → { rigidity (rigidity.js's 0 … 1, the same axis as docs/garment-principles.md's fabric
 *                   stiffness `k`), weight (the cloth's mass against a plain linen's: 1) }
 *   CLOTH_REGISTERS a register → { strings (round a curtain), links (along each string), travel (the share of the body's
 *                   own travel the cloth feels as headwind: 1 all of it, 0 none), hold (keys each baked pose is held for:
 *                   1 every key, 2 on twos) }
 *   materialParams(m | { material?, rigidity? })  the motion's numbers (rigidityParams, then divided by the weight)
 *
 * The rigidity words (shell, stiff, crisp, soft, flowing) stay valid; a material names its rigidity, and a piece's own
 * `rigidity` wins over its material's. The numbers are a starting tuning from published spring-bone and cloth defaults
 * (VRM springBone, KawaiiPhysics, NvCloth) and shipped games' cloth as seen; none is measured. No imports but rigidity.js.
 */
import { RIGIDITY_WORDS, rigidityOf, rigidityParams } from './rigidity.js';

/**
 * THE MATERIALS, short on purpose (a fabric not here is the nearest one by how it hangs):
 *   silk     chiffon, satin, a gown's light skirt: falls to the body in many small folds, light, catches the air
 *   linen    cotton, a tunic, a shirt: medium folds, the plain cloth the weight is measured against
 *   wool     a cloak, a robe, a heavy skirt: soft but heavy, few wide folds, late and slow
 *   leather  a coat's skirt, a tabard, a tasset's backing: holds its cut, moves as panels
 *   fur      a trim or a mantle's pelt: mass that barely moves
 *   mail     a mail skirt or hauberk's hem: limp and very heavy, hangs straight and damps fast
 * Rigidity follows the fabric stiffness `k` (drape coefficient) of docs/garment-principles.md where the cloth is there
 * (chiffon 0.1, wool suiting 0.6, leather 0.9); a heavy cloak's wool is softer than a suiting's.
 */
export const MATERIALS = Object.freeze({
  silk: Object.freeze({ rigidity: 0.15, weight: 0.5 }),
  linen: Object.freeze({ rigidity: 0.45, weight: 1 }),
  wool: Object.freeze({ rigidity: RIGIDITY_WORDS.soft, weight: 1.5 }),
  leather: Object.freeze({ rigidity: RIGIDITY_WORDS.stiff, weight: 1.2 }),
  fur: Object.freeze({ rigidity: 0.9, weight: 1.3 }),
  mail: Object.freeze({ rigidity: 0.3, weight: 2.2 }),
});
export const MATERIAL_NAMES = Object.freeze(Object.keys(MATERIALS));
/** error strings for a `material` */
export function materialErrors(m, at = 'material') { return m === undefined || MATERIALS[m] ? [] : [`${at}: ${MATERIAL_NAMES.map((w) => `'${w}'`).join(' | ')}`]; }

/** a piece's rigidity (its own, else its material's), as a number, or null when it says neither */
export function clothRigidity({ rigidity, material } = {}) { return rigidityOf(rigidity) ?? MATERIALS[material]?.rigidity ?? null; }
/** a piece's weight (its material's; 1 when it names none) */
export const clothWeight = ({ material } = {}) => MATERIALS[material]?.weight ?? 1;

/**
 * The motion's numbers for a piece: its rigidity's (rigidityParams: the pull to its skin, the damping, the air caught,
 * the gravity felt), the pull and the air divided by its weight (the forces are the same, the mass they move is not: a
 * heavy cloth answers its skin and the air late, a light one at once). A word is a material or a rigidity.
 */
export function materialParams(piece) {
  const P = typeof piece === 'string' ? (MATERIALS[piece] ? { material: piece } : { rigidity: piece }) : piece || {};
  const r = clothRigidity(P), w = clothWeight(P), base = rigidityParams(r ?? undefined);
  return w === 1 ? base : { ...base, stiffness: base.stiffness / w, sail: base.sail / w };
}

/**
 * THE REGISTERS: the hero's drawing registers (hero-form.js REGISTERS: lowpoly, round, chamfer, box) and the two body
 * lanes that draw their own (the anime hero, the realistic form). Coarser registers spend fewer strings and links and
 * let less of the body's travel reach the cloth; the box draws one or two hinged panels and holds its poses on twos.
 *   realistic  the full curtain, most of the body's travel (NvCloth's inertia near 1)
 *   anime      a few links, most of the travel cut so the cloth reads in clear shapes (KawaiiPhysics' anime defaults)
 *   lowpoly    gen-6 geoset pieces: few links, a little more travel than anime (ten strings round a skirt: at eight a
 *              striding leg showed between two of them)
 *   round      the default game body: a few links, half the travel
 *   chamfer    as round, fewer strings (its facets read as panels)
 *   box        two links, a few strings: hinged panels, held on twos
 */
export const CLOTH_REGISTERS = Object.freeze({
  realistic: Object.freeze({ strings: 12, links: 4, travel: 0.85, hold: 1 }),
  anime: Object.freeze({ strings: 10, links: 3, travel: 0.25, hold: 1 }),
  lowpoly: Object.freeze({ strings: 10, links: 3, travel: 0.6, hold: 1 }),
  round: Object.freeze({ strings: 10, links: 3, travel: 0.5, hold: 1 }),
  chamfer: Object.freeze({ strings: 8, links: 3, travel: 0.5, hold: 1 }),
  box: Object.freeze({ strings: 4, links: 2, travel: 0.5, hold: 2 }),
});
/** the register a hero's cloth is drawn in: the realistic form's, the anime head's, else its own register (round when none) */
export function clothRegisterOf(hero = {}) {
  if (hero.form === 'realistic') return 'realistic';
  if (hero.head === 'anime') return 'anime';
  return CLOTH_REGISTERS[hero.register] ? hero.register : 'round';
}
