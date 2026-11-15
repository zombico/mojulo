/**
 * THE CAST'S RESPONSE — how each of a body's materials answers the light, told from what the body already says of
 * itself: its palette's groups (a hero's `Skin`, `Top`, `Hair`, `Iron`, `Leather`: polygonizer/hero-form.js and its
 * dress). A body under the cast rig (cast-rig.js) was one material from scalp to boot; with this its skin, its cloth,
 * its hair, its eyes, its leather and its metal are told apart by how they reflect (the gen-7 cast's
 * `material-by-response` convention, era/eras.js), with no map and no new geometry: a class a colour group.
 *
 *   RESPONSES              class → { rough, metal }: skin, hair, eye, cloth, leather, metal
 *   responseOf(group)      → the class a palette group's name is of ('cloth' where its name says nothing)
 *   castResponse(palette)  → [[r, g, b, rough, metal]] (bytes, 0 to 255): each colour of the palette and how it answers,
 *                            for the page to read a corner's class off its own colour (a corner is its group's colour
 *                            under no light: the lit read). Two groups of one colour take the first's class
 * Pure: names and colours in, numbers out.
 */
export const RESPONSES = Object.freeze({
  // (skin: a soft, broad highlight; hair: tighter, it is combed fibre; an eye: wet; cloth: none to speak of; leather:
  // a worn sheen; metal: the highlight is the surface, in its own colour)
  skin: Object.freeze({ rough: 0.52, metal: 0 }),
  hair: Object.freeze({ rough: 0.4, metal: 0 }),
  eye: Object.freeze({ rough: 0.1, metal: 0 }),
  cloth: Object.freeze({ rough: 0.9, metal: 0 }),
  leather: Object.freeze({ rough: 0.55, metal: 0 }),
  metal: Object.freeze({ rough: 0.34, metal: 1 }),
});

// a group's class by its name: the words a palette uses (a new group of a known kind needs no row; an unknown is cloth)
const NAMES = Object.freeze([
  ['eye', /^(sclera|iris|pupil)/i],
  ['hair', /^(hair|brow|lash|beard)/i],
  ['skin', /^(skin|lid|lip|ear|nostril|mouth|tongue|gum)/i],
  ['metal', /(iron|steel|bronze|brass|gold|silver|copper|chrome|metal|plate|mail|blade|buckle|rivet)/i],
  ['leather', /(leather|shoe|boot|belt|strap|sole|glove|holster)/i],
]);

export function responseOf(group) {
  const hit = NAMES.find(([, re]) => re.test(String(group ?? '')));
  return hit ? hit[0] : 'cloth';
}

const HEX = /^#([0-9a-f]{6})$/i;

export function castResponse(palette) {
  if (!palette || typeof palette !== 'object') return [];
  const seen = new Set(), out = [];
  for (const [group, hex] of Object.entries(palette)) {
    const m = typeof hex === 'string' && HEX.exec(hex);
    if (!m || seen.has(m[1].toLowerCase())) continue;
    seen.add(m[1].toLowerCase());
    const R = RESPONSES[responseOf(group)], n = parseInt(m[1], 16);
    out.push([(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(R.rough * 255), Math.round(R.metal * 255)]);
  }
  return out;
}
