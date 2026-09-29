// armor/principles — the laws a worn armour build obeys, as arithmetic over its dials.
//
// A held item has its focal element ON the item; armour has it ON THE BODY. The wearer is the host, and a suit is one
// item whose pieces are spread over bones. The held-item laws (equipment/principles.js) re-read on a body, plus the
// worn laws:
//
//   1. HIERARCHY. One focal piece per SUIT (a pauldron, a crest), not per piece. Every piece is sized against its
//      CARRIER (a pauldron in deltoid widths, a greave in shank girths), never in centimetres, so a suit fits any cast.
//   2. STYLIZATION IS A PROPORTION LAW. `stylize` moves one curve: the focal piece grows fastest (the shoulder line is
//      armour's stone), plates stand further off the body (silhouette bulk comes from standoff, not thickness),
//      openings flare, and lames, rivets and lacing get FEWER and BIGGER.
//   3. ARMOUR FRAMES THE BODY. Plate edges land on landmarks (clavicle, deltoid, elbow, knee); a stone on a plate is set.
//   4. READABILITY FLOOR. No plate, rivet or cord thinner than `minFeature(stylize)` × the figure's height.
//   5. CONTRAST SPENDS ON THE FOCAL. Trim and accent metal go to the focal piece; the rest stays plain.
//   6. THE FOCAL SITS WHERE THE EYE ALREADY GOES: the shoulder line and the chest, near the face; a crest directly
//      above it. A signature faces where the eye comes from (the `facing` signature), not where its carrier points.
//   7. ORGANIC FORMS GROW (grown armour: bark, carapace).
//   8. A PLATE NEVER CROSSES A JOINT. Each rigid plate rides one bone. A cop (couter, poleyn) caps a joint from one
//      side. Lames shingle away from their anchor. Plate stays off where two body parts touch at rest (inner thighs,
//      the torso side under a hanging arm).
//   9. COVERAGE GROWS FROM THE FOCAL, in a fixed order per family. Plate is asymmetric until its partner arrives at 0.5
//      as a LESSER piece; the side follows function (a bracer on the bow arm).
//  10. LAYERS SEPARATE BY ONE CLEAR VALUE STEP, in either direction: plate lighter than a dark gambeson, or black
//      lacquer darker than a hitatare with the lacing brightest.
//  11. THE EDGE IS THE ORNAMENT FIELD: a rolled edge, a trim band, rivets along it; one structural line (a ridge).
//  12. CONSTRUCTION IS HONEST. Plate: halves strapped at the sides, a ridge on the seam. Lamellar: rows in a SAWTOOTH
//      (each row's top tucked at its own standoff, its bottom edge out by a row's thickness — never piled outward),
//      held by lacing that IS the ornament and covers the field (law 12 over law 11).
//
// Pure arithmetic; no dice. ARMOR_LAWS_VERSION is stamped on every minted build: a change to any curve here that moves
// a kit's bytes is a new version, and the expander keeps the old one for rows minted under it.

export const ARMOR_LAWS_VERSION = 1;

export const ARMOR_DIALS = Object.freeze({
  stylize: 'realism 0 → stylized 1: one proportion curve for the whole suit (shared with held items)',
  mass: 'heft: 0.8 slender … 1 … 1.35 heavy',
  coverage: '0 → 1: the focal piece alone … the whole harness, grown out from the focal (law 9)',
  ornament: '0–3: the edge budget (law 11), spent on the focal piece first',
});

const lerp = (a, b, t) => a + (b - a) * t;

/** law 2 (+4): every armour multiplier from stylize and mass */
export function armorProportion({ stylize: s = 0, mass = 1 } = {}) {
  return {
    focal: lerp(1, 2.2, s),               // the focal piece's growth
    standoff: mass * lerp(1, 3.2, s),     // plates stand further off the body
    flare: lerp(0.8, 3.2, s),             // openings flare
    lames: lerp(1, 0.5, s),               // fewer, bigger lames and rows
    thick: mass ** 0.8 * lerp(1, 1.5, s),
    minFeature: lerp(0.002, 0.009, s),    // × figure height
    rivet: lerp(1, 1.8, s),               // rivets and cords fewer and bigger
  };
}
