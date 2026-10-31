/**
 * Composition audit for animal mascot cards. Pure advisory measurements:
 * never mutate the species' anatomy or silently erase an identifier.
 * A designer can use the findings to decide where the next visual pass belongs.
 */
const FEATURE_WEIGHT = Object.freeze({
  ears: 1, muzzle: 1.1, tail: 1, mane: 1.5, horns: 1.35,
  shell: 1.5, fin: 1, neck: 1.5, spines: 1.2, quills: 1.2,
});
const PRIMARY_PATTERNS = new Set(['patches', 'mask', 'stripes', 'tuxedo']);
const EXTENDED_FACES = new Set(['trunk', 'long', 'bill']);
const round = (x) => Math.round(x * 100) / 100;

/**
 * @param {object} card resolved animalCard(), or any card with identity, kit, form
 * @returns {{focus:string, silhouetteLoad:number, complexity:string, priorities:string[], suggestions:string[]}}
 */
export function auditAnimalComposition(card) {
  if (!card || !Array.isArray(card.identity) || !card.kit) throw new TypeError('animal composition requires a resolved card');
  const kit = card.kit;
  const identifiers = card.identity.filter((key) => kit[key] != null);
  const silhouetteLoad = round(identifiers.reduce((total, key) => total + (FEATURE_WEIGHT[key] ?? 0.7), 0));
  const patternLed = PRIMARY_PATTERNS.has(kit.pattern);
  const eyeLed = kit.eyes === 'disc' || kit.eyes === 'top';
  const faceLed = eyeLed || EXTENDED_FACES.has(kit.muzzle);
  const focus = patternLed ? 'coat' : eyeLed ? 'eyes' : identifiers[0] ?? (faceLed ? 'face' : 'body');
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
  if (EXTENDED_FACES.has(kit.muzzle))
    suggestions.push('Keep an identifying long muzzle or trunk, but simplify its joints and surrounding facial detail.');
  if (kit.tail === 'brush' && kit.ears === 'pointed')
    suggestions.push('Counterbalance pointed ears with a broad, soft tail mass; keep their directions distinct in three-quarter view.');
  if (!suggestions.length)
    suggestions.push('Maintain a clear big/medium/small shape hierarchy and one focal contrast area.');
  return { focus, silhouetteLoad, complexity: silhouetteLoad >= 3.3 ? 'crowded' : silhouetteLoad >= 2.2 ? 'layered' : 'restrained', priorities, suggestions };
}
