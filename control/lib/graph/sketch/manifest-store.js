/**
 * manifest-store — what a sketch row stores of its manifest. A layered manifest carries a plan and the recipe the plan
 * expands to; a plan's `include` (the anime head, ≈ 1.1 MB) lands in the recipe's parts byte for byte, so the row held
 * the head twice. The stored recipe names the include in place of a part it copied whole (`{ $include: <name> }`), and
 * the read puts the part back: derived, not stored.
 *
 * Identity is checked, never assumed: a part the expansion changed (shifted, re-bound) or one hand-edited under
 * `/recipe` is stored in full, so unpackManifest(packManifest(m)) is m, byte for byte. Anything that is not a layered
 * manifest with a plan's includes and a recipe passes through as the same object.
 */

const isMarker = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.$include === 'string' && Object.keys(v).length === 1;

/** the plan's includes by name, or null when the manifest has nothing to share */
function includesOf(manifest) {
  if (manifest?.kind !== 'layered' || !manifest.recipe?.parts || !Array.isArray(manifest.plan?.include)) return null;
  const byName = new Map();
  for (const inc of manifest.plan.include) if (inc && typeof inc.name === 'string' && inc.parts && typeof inc.parts === 'object' && !byName.has(inc.name)) byName.set(inc.name, inc.parts);
  return byName.size ? byName : null;
}

/** The recipe a row stores: every part JSON-identical to an include's part of the same name named by that include
 * (the key order kept). The recipe itself when nothing is shared. */
export function packRecipe(plan, recipe) {
  const incs = includesOf({ kind: 'layered', plan, recipe });
  if (!incs) return recipe;
  let parts = null;
  for (const [name, part] of Object.entries(recipe.parts)) {
    for (const [inc, ip] of incs) {
      if (!Object.hasOwn(ip, name)) continue;
      if (JSON.stringify(ip[name]) === JSON.stringify(part)) { parts ??= { ...recipe.parts }; parts[name] = { $include: inc }; }
      break;   // a part name is claimed once across the plan (station-loft-plan.js), so the first include carrying it is its own
    }
  }
  return parts ? { ...recipe, parts } : recipe;
}

/** The manifest a row stores (packRecipe on a layered manifest's recipe). */
export function packManifest(manifest) {
  if (!includesOf(manifest)) return manifest;
  const recipe = packRecipe(manifest.plan, manifest.recipe);
  return recipe === manifest.recipe ? manifest : { ...manifest, recipe };
}

/** The manifest a row means: every `{ $include }` part put back from the plan's include. A marker naming an include
 * or a part the plan does not carry is left as stored (the compile then refuses that part by name). */
export function unpackManifest(manifest) {
  const incs = includesOf(manifest);
  if (!incs) return manifest;
  let parts = null;
  for (const [name, part] of Object.entries(manifest.recipe.parts)) {
    if (!isMarker(part)) continue;
    const ip = incs.get(part.$include);
    if (!ip || !Object.hasOwn(ip, name)) continue;
    parts ??= { ...manifest.recipe.parts }; parts[name] = structuredClone(ip[name]);   // its own copy, as a parsed row's was: an edit to the recipe never reaches the plan
  }
  return parts ? { ...manifest, recipe: { ...manifest.recipe, parts } } : manifest;
}
