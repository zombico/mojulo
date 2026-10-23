/**
 * CREASE ROLES — which faces of a resolved world are land or organic to the World's crease pass (channels/creases.js),
 * read off their groups when a world draws creases. A builder that knows its faces tags them at the source
 * (`organic`: plantBoxToFaces under a city's creases); this reads the groups the land and the plant pools already name,
 * so a cube's island and a terrain's groves take the right class without a builder threading anything. Applied only
 * when creases are on (world-scene.js): a world without them is never touched.
 *
 *   organic (true)   never inked: a plant pool's species ('<species>-L<n>', '<species>-culm-L<n>', 'city:tree-…'),
 *                    the land's sprigs, petals and spray
 *   land ('land')    inked only where something built meets it: the polygon land (isekai:*), a terrain's bake, rocks
 *   (else) null      angular: what is built, the default
 *
 *   creaseRole(group)          → true | 'land' | null
 *   tagCreaseRoles(payload)    the faces and repeats tagged `organic` by their groups (a face already tagged keeps it)
 */
import { SPECIES } from '../vegetation/species.js';

const ORGANIC_LAND = /^isekai:(sprig|petals|spray)/;
const BUILT_LAND = /^isekai:wood/;
const LAND = [/^isekai:/, /^terrain-bake$/, /^rocks?\b/];

export function creaseRole(group) {
  if (typeof group !== 'string' || !group) return null;
  if (ORGANIC_LAND.test(group)) return true;
  if (BUILT_LAND.test(group)) return null;
  if (LAND.some((r) => r.test(group))) return 'land';
  const species = group.replace(/^city:tree-/, '').replace(/-(?:culm-|foliage-)?L\d$/, '');
  return Object.prototype.hasOwnProperty.call(SPECIES, species) ? true : null;
}

const tag = (f) => {
  if (!f || f.organic) return f;
  const role = creaseRole(f.group);
  return role ? { ...f, organic: role } : f;
};

export function tagCreaseRoles(payload) {
  if (Array.isArray(payload.faces)) payload.faces = payload.faces.map(tag);
  if (Array.isArray(payload.repeats)) {
    payload.repeats = payload.repeats.map((r) => {
      if (!r || !Array.isArray(r.template)) return r;
      const role = creaseRole(r.group);
      return { ...r, template: r.template.map((f) => (role && f && !f.organic ? { ...f, organic: role } : tag(f))) };
    });
  }
  return payload;
}
