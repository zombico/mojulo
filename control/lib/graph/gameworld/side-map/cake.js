/**
 * THE CAKE (docs/side-map-principles.md "The closed parts are painted"): every wall or floor segment of a side map is a
 * slice of cake. Its ICING is its top and its jamb (paint.js: the cap and the jamb); under it, its LAYERS are its
 * MATERIAL's, evocative of the world it is in, never bricks everywhere: a plant's machinery, a mountain's strata, the
 * snow on a cold land. A material is a row (a new look is a row):
 *
 *   kibble    techno kibble: a conduit on its brackets under the icing, panels with their vents and a status light,
 *             ribbed machinery below (a plant's, a works')
 *   plate     big bolted plates, reflective (a base's, a hangar's)
 *   masonry   the built fill's courses, as they were (a temple's, a gate's)
 *   padded    the padded fill's blocks, as they were
 *   rock      strata: soil under the icing, a band of rubble, bedrock below (a mountain's, a cave's)
 *   snow      a snowpack under its icing of snow, a band of ice, rock below (a cold cube's land, a mountain's heights)
 *
 * Each its FINISH (how the light is baked on it, light.js: rough, spec, metal, sky: a share of the sky it reflects)
 * and its TEXTURE (a procedural tile the build maps on world uvs: texture.js). Its strata hang from each slice's own top,
 * so a pit shows the same layers either side.
 *
 *   MATERIALS
 *   materialOf(family, { setting, indoor, backdrop, cold }) → a material's id: the world's (the fill and the setting, the
 *                         height an outdoor zone stands at, the cube's climate)
 *   cakeBody(r, zone, { M, mix, beds, slices, SL }) → true where the material draws the slice's body (its marks through
 *                         M, a marker clipped to the slice), false where the fill's own body stands (masonry, padded)
 *   icingOf(material, zone, mix) → the icing's tones where the material's own (snow's), else null (the zone's)
 *
 * Pure: no dice. The same slice is the same cake.
 */
export const MATERIALS = Object.freeze({
  kibble: Object.freeze({ says: 'techno kibble: a conduit on its brackets, panels with vents and a status light, ribbed machinery', finish: Object.freeze({ rough: 0.5, spec: 0.35, gloss: 24, metal: 0.4, sky: 0.12 }), texture: 'brushed' }),
  plate: Object.freeze({ says: 'big bolted plates, reflective', finish: Object.freeze({ rough: 0.25, spec: 0.7, gloss: 48, metal: 0.8, sky: 0.22 }), texture: 'brushed' }),
  masonry: Object.freeze({ says: 'the built fill\'s courses', finish: Object.freeze({ rough: 0.9, spec: 0.06, gloss: 8, metal: 0, sky: 0 }), texture: 'stone' }),
  padded: Object.freeze({ says: 'the padded fill\'s blocks', finish: Object.freeze({ rough: 0.8, spec: 0.12, gloss: 12, metal: 0, sky: 0 }), texture: 'cloth' }),
  rock: Object.freeze({ says: 'strata: soil under the icing, a band of rubble, bedrock below', finish: Object.freeze({ rough: 0.95, spec: 0.04, gloss: 6, metal: 0, sky: 0 }), texture: 'grain' }),
  snow: Object.freeze({ says: 'a snowpack under its icing of snow, a band of ice, rock below', finish: Object.freeze({ rough: 0.6, spec: 0.5, gloss: 60, metal: 0, sky: 0.18 }), texture: 'sparkle' }),
});
export const MATERIAL_IDS = Object.freeze(Object.keys(MATERIALS));

/** The material a zone's slices are made of: the world's. */
export function materialOf(family, { setting = 'plant', indoor = true, backdrop = null, cold = false } = {}) {
  if (family === 'built') return 'masonry';
  if (family === 'padded') return 'padded';
  if (family === 'machine') return setting === 'base' ? 'plate' : 'kibble';
  // rock: snow where the cube is cold and the land is open to it, or on a mountain's heights
  if (!indoor && (cold || (setting === 'mountain' && backdrop === 'sky'))) return 'snow';
  return 'rock';
}

const SNOW = '#f3f7ff', ICE = '#bfe3f5', SOIL = '#4a3526', COPPER = '#c98a4a';
const RUBBLE = [1.1, 0.7, 1.4, 0.9, 1.2, 0.8];

/** The icing's tones where the material's own: snow is iced with snow. */
export function icingOf(material, zone, mix) {
  if (material !== 'snow') return null;
  return { tone: [mix(SNOW, zone.key, 0.12), mix(SNOW, zone.key, 0.04), mix(SNOW, zone.key, 0.2)], shine: '#ffffff', joint: mix(SNOW, zone.key, 0.45) };
}

/** A slice's body by its material, drawn through M (a marker clipped to the slice). */
export function cakeBody(r, zone, { M, mix, beds, slices }) {
  const mat = zone.material, top = r.z1, k = zone.key, dark = mix(k, '#000000', 0.45), deep = mix(k, '#000000', 0.62), light = mix(k, '#ffffff', 0.2);
  const A = (s) => slices.find((x) => x.zone === r.zone && s >= x.s0 && s < x.s1)?.ab === 'A';
  if (mat === 'kibble') {
    M(r.s0, r.s1, r.z0, r.z1, mix(k, '#000000', 0.18), 1, 'cake-base');
    // the conduit under the icing, on its brackets a module apart
    M(r.s0, r.s1, top - 0.75, top - 0.5, mix(k, '#c8d2dc', 0.35), 2, 'cake-conduit');
    for (let s = Math.ceil(r.s0 / 1.2) * 1.2; s < r.s1; s += 1.2) M(s - 0.08, s + 0.08, top - 0.85, top - 0.42, dark, 2, 'cake-bracket');
    // the panels, each with its vents (an A slice's) or its status light (a B slice's)
    for (let s = Math.floor(r.s0 / 2.4) * 2.4; s < r.s1; s += 2.4) {
      const z1 = top - 1.05, z0 = top - 2.55;
      M(s + 0.1, s + 2.3, z0, z1, mix(k, '#000000', 0.08), 2, 'cake-panel');
      M(s + 0.1, s + 2.3, z1 - 0.06, z1, light, 2, 'cake-panel-lip');
      if (A(s + 1.2)) for (let v = 0; v < 4; v++) M(s + 0.5, s + 1.9, z0 + 0.35 + v * 0.26, z0 + 0.45 + v * 0.26, deep, 3, 'cake-vent');
      else { M(s + 1.6, s + 1.9, z1 - 0.45, z1 - 0.2, mix(zone.edge, '#ffffff', 0.5), 3, 'cake-light'); M(s + 0.35, s + 1.3, z1 - 0.5, z1 - 0.25, mix(k, '#ffffff', 0.35), 3, 'cake-label'); }
    }
    // ribbed machinery below
    for (let s = Math.floor(r.s0 / 0.4) * 0.4; s < r.s1; s += 0.4) M(s, s + 0.14, r.z0, top - 2.75, deep, 2, 'cake-rib');
    return true;
  }
  if (mat === 'plate') {
    for (let s = Math.floor(r.s0 / 2.4) * 2.4, i = 0; s < r.s1; s += 2.4, i++) for (let z1 = Math.floor(top / 1.6) * 1.6 + 1.6, j = 0; z1 - 1.6 < top; z1 -= 1.6, j++) {
      if (z1 - 1.6 < r.z0 - 1.6) break;
      M(s, s + 2.4, z1 - 1.6, z1, mix(k, (i + j) % 2 ? '#ffffff' : '#000000', 0.1), 1, 'cake-plate');
      M(s, s + 0.06, z1 - 1.6, z1, deep, 2, 'cake-seam'); M(s, s + 2.4, z1 - 1.6, z1 - 1.54, deep, 2, 'cake-seam');
      for (const [bs, bz] of [[0.2, 0.2], [2.1, 0.2], [0.2, 1.3], [2.1, 1.3]]) M(s + bs, s + bs + 0.1, z1 - 1.6 + bz, z1 - 1.6 + bz + 0.1, dark, 3, 'cake-bolt');
    }
    return true;
  }
  if (mat === 'rock' || mat === 'snow') {
    // the strata from the slice's own top: (snow: a snowpack and a band of ice), soil, a band of rubble, bedrock
    let d = 0.34;
    if (mat === 'snow') {
      M(r.s0, r.s1, top - 0.95, top - d, mix(SNOW, k, 0.12), 1, 'cake-snowpack');
      for (let s = Math.floor(r.s0 / 0.9) * 0.9; s < r.s1; s += 0.9) M(s + 0.15, s + 0.75, top - 1.05, top - 0.95, mix(SNOW, k, 0.2), 1, 'cake-snowpack');
      M(r.s0, r.s1, top - 1.45, top - 1.05, mix(ICE, k, 0.25), 1, 'cake-ice');
      M(r.s0, r.s1, top - 1.12, top - 1.05, '#ffffff', 2, 'cake-ice-glint');
      d = 1.45;
    }
    M(r.s0, r.s1, top - d - 0.6, top - d, mix(SOIL, k, 0.3), 1, 'cake-soil');
    // the rubble: boulders on one rhythm, their tones in turn, their gaps dark
    const sum = RUBBLE.reduce((a, b) => a + b, 0);
    for (let s = Math.floor(r.s0 / sum) * sum, i = 0; s < r.s1; s += RUBBLE[i % RUBBLE.length], i++) {
      const w = RUBBLE[i % RUBBLE.length], t = [mix(k, '#000000', 0.05), mix(k, '#ffffff', 0.08), mix(k, SOIL, 0.25)][i % 3], hz = 0.6 + 0.25 * ((i * 5) % 3);
      M(s, s + w - 0.08, top - d - 0.6 - hz, top - d - 0.6, t, 1, 'cake-rubble');
      M(s + w - 0.08, s + w, top - d - 0.6 - hz, top - d - 0.6, deep, 2, 'cake-rubble-gap');
      M(s, s + w - 0.08, top - d - 0.66, top - d - 0.6, mix(t, '#ffffff', 0.25), 2, 'cake-rubble-lit');
    }
    // bedrock below: the level's beds, every other darker, and a copper vein where the rock is a works'
    const under = top - d - 1.45;
    M(r.s0, r.s1, r.z0, under, mix(k, '#000000', 0.12), 1, 'cake-bedrock');
    for (const [b0, b1, j] of beds) if (b1 < under && b1 > r.z0 && j % 2) M(r.s0, r.s1, b0, Math.min(b1, under), mix(k, '#000000', 0.22), 1, 'cake-bed');
    if (zone.place && /works|mine|plant/.test(zone.place)) M(r.s0, r.s1, under - 0.8, under - 0.7, COPPER, 2, 'cake-vein');
    return true;
  }
  return false;
}
