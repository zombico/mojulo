/**
 * THE COMIC HERO PACK'S PIECE CARDS: superheroic variations of the costume pieces a hero wears over a role suit, each a
 * card of the hero door's own words (outfit-plan.js OUTFIT_KINDS: the belt and its dials, the pouches and the utility
 * belt, the thigh pouch, the vest rig, the harness and the baldric; outfit/styles.js: the jacket as the language's
 * `outer`). A card never invents a garment: it names pieces and language the door already reads, so it dresses either
 * body (a jacket's front words, `lapel` and `buttons`, are the realistic tailor's; the tiered body wears the jacket
 * plain). A card is worn by `withPieces(fragment, ids)` over a suit's spec fragment (suits.js, costumes.js), which only
 * dresses an outfit BUILD: a word-list outfit (the Movie era's plating suits on the realistic body) takes no pieces, and
 * the call says so.
 *
 *   PIECES                 { <id>: { reads, family: 'belt' | 'pouch' | 'jacket', eras: [era ids], pieces?: [...], outer?: {...}, palette?: { Outer } } }
 *   PIECE_IDS
 *   withPieces(frag, ids)  → the fragment dressed with those cards (its outfit build's pieces and language.outer)
 */
const BELT = (over) => ({ kind: 'belt', at: 'waist', ...over });
const OUTER = (over) => ({ family: 'woven', sleeve: 'long', ...over });

export const PIECES = Object.freeze({
  // ── BELTS ──
  emblemBelt: { reads: 'the emblem belt: a waist belt whose buckle is the emblem, large and in the trim (gold on the Silver Age suit)', family: 'belt', eras: ['silver'],
    pieces: [BELT({ buckleColour: 'trim', buckleScale: 1.7 })] },
  powerBelt: { reads: 'the power belt: a wide band at the waist, its buckle in the accent; the strongman, the brawler', family: 'belt', eras: ['silver', 'modern'],
    pieces: [BELT({ width: 1.6, buckleColour: 'accent', buckleScale: 1.3 })] },
  utilityBelt: { reads: 'the utility belt: four pouches ringing a waist belt, the buckle in the trim; the gadgeteer, the vigilante', family: 'belt', eras: ['modern', 'movie'],
    pieces: [{ kind: 'pouches', at: 'waist', count: 4, buckleColour: 'trim' }] },
  fullUtilityBelt: { reads: 'the full utility belt: six small pouches round the waist, the buckle plain; the tactical hero', family: 'belt', eras: ['movie'],
    pieces: [{ kind: 'pouches', at: 'waist', count: 6, size: 0.85 }] },
  sashBelt: { reads: 'the sash: a soft band knotted at the waist in the secondary; the acrobat, the martial hero', family: 'belt', eras: ['silver'],
    pieces: [{ kind: 'sash' }] },
  // ── POUCHES ──
  dutyBelt: { reads: 'the duty belt: a hip belt with a pouch at each hip; the street', family: 'pouch', eras: ['modern', 'movie'],
    pieces: [{ kind: 'pouches', size: 1.1 }] },
  thighRig: { reads: 'the thigh rig: a holster pouch strapped to the outer thigh, one side; the operative', family: 'pouch', eras: ['modern', 'movie'],
    pieces: [{ kind: 'thighPouch' }] },
  thighRigPair: { reads: 'the paired thigh rig: a holster pouch on each thigh; the mercenary', family: 'pouch', eras: ['movie'],
    pieces: [{ kind: 'thighPouch', pair: true }] },
  chestRig: { reads: 'the chest rig: crossing straps with four magazine pouches over the chest; the soldier', family: 'pouch', eras: ['movie'],
    pieces: [{ kind: 'vest', cut: 'rig' }] },
  harness: { reads: 'the harness: two straps crossing over the chest with a ring where they meet; the flier, the climber', family: 'pouch', eras: ['modern', 'movie'],
    pieces: [{ kind: 'harness' }] },
  bandolier: { reads: 'the bandolier: a studded strap from the shoulder to the other hip; the gunslinger', family: 'pouch', eras: ['modern', 'movie'],
    pieces: [{ kind: 'baldric' }] },
  // ── JACKETS ──
  bomber: { reads: 'the bomber: a waist-length jacket with a collar, eased, closed, no lapel; the pilot, the street hero', family: 'jacket', eras: ['modern'],
    outer: OUTER({ hem: 'waist', collar: true, fit: 'eased', open: false, lapel: 'none', buttons: 1 }) , palette: { Outer: '#2b2f38' } },
  motoJacket: { reads: 'the moto jacket: a hip-length jacket worn open, fitted, a collar, no lapel, over a waist belt; the biker, the vigilante', family: 'jacket', eras: ['modern'],
    outer: OUTER({ hem: 'hip', collar: true, fit: 'fitted', open: true, lapel: 'none', buttons: 1 }), pieces: [BELT({})] , palette: { Outer: '#15181d' } },
  duster: { reads: 'the duster: a knee-length coat worn open, loose, a collar; the drifter, the occult detective', family: 'jacket', eras: ['modern', 'movie'],
    outer: OUTER({ hem: 'knee', collar: true, fit: 'loose', open: true, lapel: 'notch', buttons: 2 }) , palette: { Outer: '#2a2320' } },
  armouredJacket: { reads: 'the armoured jacket: a hip-length jacket closed over a chest plate, padded shoulders; the tactical hero', family: 'jacket', eras: ['movie'],
    outer: OUTER({ hem: 'hip', collar: true, fit: 'fitted', open: false, lapel: 'none', buttons: 2, shoulder: 'structured' }), pieces: [{ kind: 'chestPlate', cover: 0.6 }, { kind: 'pauldron', pair: true, colour: 'base' }] , palette: { Outer: '#2c333d' } },
  hoodedJacket: { reads: 'the hooded jacket: a hip-length jacket under a short hooded half-cape; the street', family: 'jacket', eras: ['modern', 'movie'],
    outer: OUTER({ hem: 'hip', collar: false, fit: 'eased', open: false, lapel: 'none', buttons: 1 }), pieces: [{ kind: 'cloak', hood: true, wrap: 0.35, hem: 'hip' }] , palette: { Outer: '#1f232b' } },
});
export const PIECE_IDS = Object.freeze(Object.keys(PIECES));

export function withPieces(frag, ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return frag;
  for (const id of list) if (!PIECES[id]) throw new Error(`comic-hero: no piece card '${id}' (known: ${PIECE_IDS.join(', ')})`);
  const O = frag.outfit;
  if (!O || typeof O !== 'object' || Array.isArray(O) || O.type !== 'outfit') throw new Error(`comic-hero: piece cards dress an outfit build; this fragment's outfit is ${Array.isArray(O) ? 'a word list (the plating suits take no designed pieces)' : 'not an outfit build'}`);
  const outfit = { ...O, language: { ...(O.language || {}) }, pieces: [...(O.pieces || [])] };
  let palette = frag.palette;
  for (const id of list) {
    const C = PIECES[id];
    if (C.outer) outfit.language.outer = { ...C.outer };
    // (a jacket in its own colour: the card's palette over the suit's, the `Outer` group the language's outer wears)
    if (C.palette) palette = { ...(palette || {}), ...C.palette };
    for (const p of C.pieces || []) {
      // (one belt at the waist: a card's waist belt replaces the suit's own, never stacks on it)
      if (p.kind === 'belt' || (p.kind === 'pouches' && p.at === 'waist')) outfit.pieces = outfit.pieces.filter((q) => !(q.kind === 'belt' && (q.at ?? 'hip') === (p.at ?? 'hip')));
      outfit.pieces.push({ ...p });
    }
  }
  return { ...frag, outfit, ...(palette ? { palette } : {}) };
}
