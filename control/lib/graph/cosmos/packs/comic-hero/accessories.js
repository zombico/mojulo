/**
 * THE COMIC HERO PACK'S ACCESSORY CARDS: what a hero wears that is neither a garment nor headgear (an emblem on crossed
 * straps, a torc, arm rings, a scarf, a clasped mantle, a quiver, goggles pushed up), each a card of the hero door's own
 * words, as the piece cards are (pieces.js). Two procedures, never new geometry:
 *   an OUTFIT PIECE   kinds the outfit catalogue already has (outfit-plan.js OUTFIT_KINDS: the `medallion` mounted on
 *                     the harness, `torc`, `bow` at the collar as a scarf's knot, `mantle` and its clasp, `armRings`,
 *                     `prayerBand`, `streamers`, `feathers`, `satchel`, `toolRoll`, `quiver`, `pack`), riding
 *                     the suit's outfit BUILD on either body (the realistic body wears an outfit build's pieces over its
 *                     envelope), each one the door wears on a person's landmarks (layered.js sortPieces); a word-list
 *                     outfit (the Movie era's plating suits on the realistic body) and an armour build take none, and
 *                     the call says so, as `withPieces` does
 *   EYEGEAR           the headgear's goggle cast (headgear/cards.js EYEGEAR, the eyegear kit's `shift`) moved up onto the
 *                     forehead, as the aviator's cap wears it; the tiered body's landmark head only (the realistic
 *                     head takes no cranium kit yet), and an armour build carries it in its `with`
 * The gaps, worn things the door has no word for yet, are ACCESSORY_GAPS: said, never approximated.
 *
 *   ACCESSORIES                        { <id>: { reads, family: 'neck' | 'shoulders' | 'arm' | 'carried' | 'eyegear',
 *                                        eras: [era ids], bodies?: [body ids] (both when absent), pieces?: [...],
 *                                        eyegear?: { word, over }, palette? } }
 *   ACCESSORY_IDS, ACCESSORY_GAPS
 *   accessoryFits(id, body)            → whether the card is worn on that body ('tiered' | 'realistic')
 *   withAccessories(frag, ids, body)   → the fragment wearing those cards; no ids ⇒ the fragment itself
 */
import { eyegearKit, withKit } from '../../../headgear/cards.js';

const BOTH = Object.freeze(['tiered', 'realistic']);
// (goggles PUSHED UP: the eyegear's cast shifted two eye-heights up onto the forehead, its strap round the crown with it)
const UP = { shift: [0, 2.0], strap: { z: 2.0, h: 0.4 } };

export const ACCESSORIES = Object.freeze({
  // ── NECK: what hangs at the throat or the chest ──
  strappedEmblem: { reads: 'the strapped emblem: two straps crossing the chest at a round emblem boss; the flier, the space hero', family: 'neck', eras: ['silver', 'modern'],
    pieces: [{ kind: 'harness', mounted: true }, { kind: 'medallion', mount: 'harness' }] },
  torc: { reads: 'the torc: a metal band round the neck, its two terminals at the front; the demigod, the barbarian king', family: 'neck', eras: ['silver', 'modern'],
    pieces: [{ kind: 'torc' }] },
  scarf: { reads: 'the scarf: knotted at the throat, two long tails flowing down the chest; the aviator, the drifter', family: 'neck', eras: ['silver', 'modern'],
    pieces: [{ kind: 'bow', at: 'collar', loops: false, tails: 0.4, width: 0.05 }] },
  // ── SHOULDERS: the cape's fastening ──
  claspedMantle: { reads: 'the clasped mantle: a short mantle over the shoulders fastened by a clasp in the trim; the noble, the sorcerer', family: 'shoulders', eras: ['silver', 'modern'],
    pieces: [{ kind: 'mantle', claspColour: 'trim' }] },
  // ── ARM: bands and tokens on the arm ──
  armRings: { reads: 'the arm rings: a metal band high on each upper arm; the demigod, the warrior', family: 'arm', eras: ['silver'],
    pieces: [{ kind: 'armRings', pair: true }] },
  runeBand: { reads: 'the rune band: a carved band on the forearm, its runes in the trim; the mystic', family: 'arm', eras: ['silver', 'modern'],
    pieces: [{ kind: 'prayerBand' }] },
  armStreamers: { reads: 'the arm streamers: two ribbons falling from a cord on the upper arm; the martial hero', family: 'arm', eras: ['silver', 'modern'],
    pieces: [{ kind: 'streamers' }] },
  featherToken: { reads: 'the feather token: a small fan of feathers tied at the upper arm; the tracker, the shaman', family: 'arm', eras: ['silver', 'modern'],
    pieces: [{ kind: 'feathers' }] },
  // ── CARRIED: what rides the hip and the back (the held items are items.js) ──
  satchel: { reads: 'the satchel: a soft bag at one hip; the reporter, the field medic', family: 'carried', eras: ['modern', 'movie'],
    pieces: [{ kind: 'satchel' }] },
  toolRoll: { reads: 'the tool roll: a bundle at the back of the hip, handles out; the gadgeteer, the mechanic', family: 'carried', eras: ['modern', 'movie'],
    pieces: [{ kind: 'toolRoll' }] },
  quiver: { reads: 'the quiver: a tall case on the back; the archer (a bow in hand is items.js)', family: 'carried', eras: ['silver', 'modern', 'movie'],
    pieces: [{ kind: 'quiver' }] },
  fieldPack: { reads: 'the field pack: a pack on the back; the explorer, the soldier', family: 'carried', eras: ['movie'],
    pieces: [{ kind: 'pack' }] },
  // ── EYEGEAR: goggles worn pushed up on the forehead (the tiered body's landmark head) ──
  gogglesUp: { reads: 'the goggles pushed up: round tinted goggles in leather cups riding on the forehead; the speedster, the pilot', family: 'eyegear', eras: ['silver', 'modern'], bodies: ['tiered'],
    eyegear: { word: 'moto', over: UP }, palette: { EyeFrame: '#5a3b22', EyeTrim: '#b08d3c', EyeLens: '#8fb9bd', EyeStrap: '#4a3020' } },
  labGogglesUp: { reads: 'the lab goggles pushed up: two clear lenses in a rubber frame on the forehead; the inventor between experiments', family: 'eyegear', eras: ['modern'], bodies: ['tiered'],
    eyegear: { word: 'lab', over: UP }, palette: { EyeFrame: '#2b6cb0', EyeLens: '#d6ecf3', EyeStrap: '#1d3f66' } },
});
export const ACCESSORY_IDS = Object.freeze(Object.keys(ACCESSORIES));

// worn things the door has no word for yet: each says what is missing and the nearest card, never approximated
export const ACCESSORY_GAPS = Object.freeze({
  necklace: 'no place on a person\'s chest yet for the hung necklace (the `medallion` on its cord, the `chain` of office): the door leaves it off and says so (layered.js sortPieces); strappedEmblem mounts the disc on the harness instead',
  dogTags: 'no tag on a chain: the hung necklace is the gap above',
  wristGadget: 'no worn gadget on the forearm outside armour: the hardsuit\'s `arms: \'gadget\'` is armour language (the hunter and bounty hunter ensembles)',
  capeClasp: 'no clasp on the cloak itself: the mantle carries the clasp (claspedMantle)',
  hipCharms: 'the `charms` piece throws on a person\'s tiered body (its cord finds no seat on the pelvis: "Cannot destructure property \'c\' of seatOf(...)"): a door fix, not a card',
});

export const accessoryFits = (id, body) => (ACCESSORIES[id]?.bodies ?? BOTH).includes(body);

export function withAccessories(frag, ids, body) {
  const list = ids == null ? [] : Array.isArray(ids) ? ids : [ids];
  if (!list.length) return frag;
  for (const id of list) if (!ACCESSORIES[id]) throw new Error(`comic-hero: no accessory card '${id}' (known: ${ACCESSORY_IDS.join(', ')})`);
  for (const id of list) if (!accessoryFits(id, body)) throw new Error(`comic-hero: accessory '${id}' is not fitted to the ${body} body (fits: ${ACCESSORIES[id].bodies.join(', ')})`);
  let out = frag;
  const pieces = list.flatMap((id) => ACCESSORIES[id].pieces || []);
  if (pieces.length) {
    const O = out.outfit;
    if (!O || typeof O !== 'object' || Array.isArray(O) || O.type !== 'outfit') throw new Error(`comic-hero: accessory cards of the outfit's pieces dress an outfit build; this fragment's outfit is ${Array.isArray(O) ? 'a word list (the plating suits take no designed pieces)' : 'not an outfit build'}`);
    out = { ...out, outfit: { ...O, pieces: [...(O.pieces || []), ...pieces.map((p) => ({ ...p }))] } };
  }
  for (const id of list) {
    const C = ACCESSORIES[id];
    if (!C.eyegear) continue;
    // (the goggles in their own colours over the suit's, as the headgear's eyewear cards wear them)
    out = withKit({ ...out, palette: { ...(out.palette || {}), ...C.palette } }, eyegearKit(C.eyegear.word, { id, over: C.eyegear.over }));
  }
  return out;
}
