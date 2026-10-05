// statue/styles — the seeded statue cards, one per period. PURE DATA: every card is plain JSON (the test round-trips each
// one), so an agent can read one, copy it, and author its own inline as `statue.style`. A card is a SAMPLE: a period's
// stance, hair, drapery, material, format and base as defaults beneath the operator's own words; a new period is a new
// card, not code.
//
// A card:
//   period    a label; years [from, to] (negative = BCE); place
//   after     the works the card is drawn after (names, for the readout and the caption: "inspired by")
//   basis     'unverified': the cards are drawn from the general record of the type, not from sources read for this
//             kernel (historic/record.js's word; the readout carries it)
//   material  a material word (principles.js STATUE_MATERIALS); crop a format word; base a base word
//   gesture   the stand (hero-gesture.js): a word, pose words, or a list of them, applied when the hero names none
//   hair      { male, female }: a landmark hair word or { style, …controls }, set at mint when the hero names none
//   drape     { male, female }: an outfit card (outfit/styles.js's shape: the drapery as garments) or null (nude),
//             worn when the hero names no outfit
//   paint     the painted material's tones over principles.js PAINT_TONES: group → '#hex', or { male, female } of them
//   note      one line on the type

const nude = null;
const linen = (language, dials = { stylize: 0.35, fit: 0.65, coverage: 1, ornament: 1 }) => ({ dials, language: { feet: 'none', tuck: false, focal: 'belt', ...language } });

export const SEEDED_STATUES = Object.freeze({
  archaic: {
    "id": "archaic", "period": "Archaic Greek", "years": [-600, -480], "place": "Attica and the Cyclades",
    "after": ["the kouroi (Kroisos, Anavyssos)", "the korai of the Athenian Acropolis (the Peplos Kore)"], "basis": "unverified",
    "material": "marble", "crop": "full", "base": "block",
    "gesture": { "legL": { "x": 0, "y": 0.25, "z": -1 }, "fingersL": "fist", "fingersR": "fist" },
    "hair": { "male": "braid", "female": "long" },
    "drape": { "male": nude, "female": linen({ "top": { "family": "woven", "sleeve": "none", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "pencil" }, "dress": true }) },
    "note": "frontal and symmetrical: the left foot forward with the weight on both, the arms at the sides, the fists closed"
  },
  classical: {
    "id": "classical", "period": "Classical Greek", "years": [-450, -400], "place": "Argos and Athens",
    "after": ["the Doryphoros of Polykleitos (Roman marble copies)", "the Riace bronzes"], "basis": "unverified",
    "material": "bronze", "crop": "full", "base": "block",
    "gesture": "relaxed",
    "hair": { "male": "crop", "female": "bun" },
    "drape": { "male": nude, "female": linen({ "top": { "family": "woven", "sleeve": "cap", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "aline" }, "dress": true }) },
    "note": "contrapposto: the weight on one leg, hips and shoulders counter-tilted; most originals were bronze, known from marble copies"
  },
  hellenistic: {
    "id": "hellenistic", "period": "Hellenistic", "years": [-323, -31], "place": "the Greek East",
    "after": ["the Aphrodite of Melos", "the Apoxyomenos type"], "basis": "unverified",
    "material": "marble", "crop": "full", "base": "attic",
    "gesture": ["relaxed", { "glance": "left", "spine": { "twist": ["left", 0.5], "sideBend": ["left", 0.3] } }],
    "hair": { "male": "curtains", "female": "bun" },
    "drape": { "male": nude, "female": linen({ "top": false, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "full" } }, { stylize: 0.5, fit: 0.8, coverage: 1, ornament: 0 }) },
    "note": "the figure turns in space: a spiral through the hips, chest and head; drapery slipping from the hips"
  },
  roman: {
    "id": "roman", "period": "Roman imperial", "years": [-27, 200], "place": "Rome",
    "after": ["the Augustus of Prima Porta", "togate portrait statues"], "basis": "unverified",
    "material": "marble", "crop": "full", "base": "attic",
    "gesture": ["relaxed", { "armR": ["forward", "up"], "elbowR": "slight", "fingersR": "open" }],
    "hair": { "male": "crop", "female": "bun" },
    "drape": {
      "male": linen({ "top": { "family": "woven", "sleeve": "short", "hem": "tunic" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "aline" } }),
      "female": linen({ "top": { "family": "woven", "sleeve": "long", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "aline" }, "dress": true })
    },
    "note": "the address (adlocutio): the right arm raised forward; tunic and a long garment as the toga's stand-in (no true toga drape yet)"
  },
  "roman-bust": {
    "id": "roman-bust", "period": "Roman portrait bust", "years": [-100, 250], "place": "Rome",
    "after": ["Republican and imperial portrait busts"], "basis": "unverified",
    "material": "marble", "crop": "bust", "base": "socle",
    "gesture": "rest",
    "hair": { "male": "crop", "female": "bun" },
    "drape": { "male": linen({ "top": { "family": "woven", "sleeve": "short", "hem": "tunic" }, "bottom": false }), "female": linen({ "top": { "family": "woven", "sleeve": "cap", "hem": "hip" }, "bottom": false }) },
    "note": "head, neck and chest on a turned socle; the portrait is the point"
  },
  egyptian: {
    "id": "egyptian", "period": "Egyptian, Old to New Kingdom", "years": [-2600, -1070], "place": "Egypt",
    "after": ["striding royal and private statues (Menkaure and his queen)"], "basis": "unverified",
    "material": "granite", "crop": "full", "base": "block",
    "gesture": { "legL": { "x": 0, "y": 0.3, "z": -1 }, "fingersL": "fist", "fingersR": "fist" },
    "hair": { "male": "bob", "female": "long" },
    "drape": {
      "male": linen({ "top": false, "bottom": { "kind": "skirt", "family": "woven", "leg": "knee", "cut": "pencil" } }),
      "female": linen({ "top": { "family": "woven", "sleeve": "none", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "pencil" }, "dress": true }, { stylize: 0, fit: 0.1, coverage: 1, ornament: 0 })
    },
    "paint": { "male": { "Skin": "#9a5b3a", "Hair": "#1b1a1a", "HairAlt": "#1b1a1a", "Bottom": "#efe9dc", "Top": "#efe9dc" }, "female": { "Skin": "#d9b07a", "Hair": "#1b1a1a", "HairAlt": "#1b1a1a", "Bottom": "#efe9dc", "Top": "#efe9dc" } },
    "note": "frontal, the left foot forward, the arms at the sides; a wig, a kilt or a sheath; painted, the men red-brown and the women yellow"
  },
  renaissance: {
    "id": "renaissance", "period": "Italian Renaissance", "years": [1490, 1560], "place": "Florence and Rome",
    "after": ["Michelangelo's David", "the antique as the Renaissance read it"], "basis": "unverified",
    "material": "marble", "crop": "full", "base": "block",
    "gesture": ["relaxed", { "glance": "left" }],
    "hair": { "male": { "style": "crop", "volume": 1.25 }, "female": "wavy" },
    "drape": { "male": nude, "female": linen({ "top": { "family": "woven", "sleeve": "cap", "hem": "hip" }, "bottom": { "kind": "skirt", "family": "woven", "leg": "maxi", "cut": "full" }, "dress": true }) },
    "note": "contrapposto after the antique, the head turned hard to one side"
  },
});
export const STATUE_STYLES = Object.freeze(Object.keys(SEEDED_STATUES));
