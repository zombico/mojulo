/**
 * Composition audit for animal mascot cards (docs/animal-cartoon-pass.md). The audit is advisory: it never mutates the
 * species' anatomy or silently erases an identifier. The MOVES are the few the audit can act on without touching the
 * identity: they quiet what competes with the focal owner, never remove it.
 *
 *   auditAnimalComposition(card) → { focus, silhouetteLoad, complexity, priorities, suggestions, moves }
 *   compositionMoves(card)       → { focus, piece?, tail?, beak? }: what the body compiler acts on (mascot-form.js), stamped
 *                                  on a newly rolled sheet's card (`sheet.animal.composition`, mascot.js); a sheet rolled
 *                                  before it carries none and draws as it always did
 *   COMPOSITION_MOVES            → each move's line, what it does and why
 *
 * Pure data and pure functions.
 */
const FEATURE_WEIGHT = Object.freeze({
  ears: 1, muzzle: 1.1, tail: 1, mane: 1.5, horns: 1.35,
  shell: 1.5, fin: 1, neck: 1.5, spines: 1.2, quills: 1.2,
});
const PRIMARY_PATTERNS = new Set(['patches', 'mask', 'stripes', 'tuxedo']);
const EXTENDED_FACES = new Set(['trunk', 'long', 'bill']);
const round = (x) => Math.round(x * 100) / 100;

/** The moves the composition pass makes, by id: what changes, and the principle it serves (step 4: one focal owner;
 *  step 5: secondary contours reduced near the focus; step 7: accessories in the tertiary register). */
export const COMPOSITION_MOVES = Object.freeze({
  piece: Object.freeze({ quiet: 'the signature piece is drawn quiet, in the coat\'s own family: the focus at the face keeps the strongest contrast' }),
  tail: Object.freeze({ broad: 'the brush is drawn broader and swept back, a soft mass against the pointed ears, its direction distinct from theirs' }),
  beak: Object.freeze({ small: 'the beak is drawn smaller, so the eye discs keep their negative space' }),
});

/** What the audit reads off a card: the focal owner and the conditions its moves and suggestions follow. */
function readCard(card) {
  if (!card || !Array.isArray(card.identity) || !card.kit) throw new TypeError('animal composition requires a resolved card');
  const kit = card.kit;
  const identifiers = card.identity.filter((key) => kit[key] != null);
  const patternLed = PRIMARY_PATTERNS.has(kit.pattern);
  const eyeLed = kit.eyes === 'disc' || kit.eyes === 'top';
  const extendedFace = EXTENDED_FACES.has(kit.muzzle);
  const focus = patternLed ? 'coat' : eyeLed ? 'eyes' : identifiers[0] ?? (extendedFace ? 'face' : 'body');
  // the focus sits at the face: a coat pattern, the eyes, a mane framing it, a trunk or a long jaw out of it
  const faceOwned = patternLed || eyeLed || kit.mane === 'ring' || extendedFace;
  return { kit, identifiers, patternLed, eyeLed, extendedFace, focus, faceOwned };
}

/** The moves the body compiler acts on. `focus` is always there; a move is there only when it applies. */
export function compositionMoves(card) {
  const { kit, eyeLed, focus, faceOwned } = readCard(card);
  return {
    focus,
    ...(faceOwned ? { piece: 'quiet' } : {}),
    ...(kit.tail === 'brush' && kit.ears === 'pointed' ? { tail: 'broad' } : {}),
    ...(eyeLed && kit.muzzle === 'beak' ? { beak: 'small' } : {}),
  };
}

/**
 * @param {object} card resolved animalCard(), or any card with identity, kit, form
 * @returns {{focus:string, silhouetteLoad:number, complexity:string, priorities:string[], suggestions:string[], moves:object}}
 */
export function auditAnimalComposition(card) {
  const { kit, identifiers, patternLed, eyeLed, extendedFace, focus } = readCard(card);
  const silhouetteLoad = round(identifiers.reduce((total, key) => total + (FEATURE_WEIGHT[key] ?? 0.7), 0));
  const priorities = [focus, ...identifiers.filter((key) => key !== focus)].slice(0, 3);
  const suggestions = [];
  if (silhouetteLoad >= 3.3)
    suggestions.push('Competing large outline masses: keep the first identifier dominant; taper or simplify secondary silhouettes.');
  if (patternLed)
    suggestions.push('Reserve the highest light/dark contrast for the identifying coat pattern; keep accessories quieter.');
  if (eyeLed)
    suggestions.push('Protect the eye/disc negative space; reduce nearby brow, muzzle, and ear detailing before increasing eye size.');
  if (kit.mane === 'ring')
    suggestions.push('Treat the mane as one framing mass around the face; avoid adding equally strong ear or collar contours.');
  if (kit.neck === 'long')
    suggestions.push('Protect the long-neck rhythm: balance with a compact torso and avoid competing vertical accessories.');
  if (extendedFace)
    suggestions.push('Keep an identifying long muzzle or trunk, but simplify its joints and surrounding facial detail.');
  if (kit.tail === 'brush' && kit.ears === 'pointed')
    suggestions.push('Counterbalance pointed ears with a broad, soft tail mass; keep their directions distinct in three-quarter view.');
  if (!suggestions.length)
    suggestions.push('Maintain a clear big/medium/small shape hierarchy and one focal contrast area.');
  return { focus, silhouetteLoad, complexity: silhouetteLoad >= 3.3 ? 'crowded' : silhouetteLoad >= 2.2 ? 'layered' : 'restrained', priorities, suggestions, moves: compositionMoves(card) };
}

/** The sheet's lines for a card's moves (what was quieted and why), for the notes and the model sheet. */
export const compositionLines = (moves) => Object.entries(moves ?? {}).filter(([k]) => k !== 'focus').map(([k, v]) => COMPOSITION_MOVES[k]?.[v]).filter(Boolean);
