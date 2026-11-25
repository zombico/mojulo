/**
 * HULL KIBBLE — the miniature-maker's panel detail on a big hull, drawn by the shader, not modelled: a capital ship's
 * plating carries more detail than any polygon budget holds (the kit-bashed model kits, the plates, vents, pipes and
 * boxes that make a hull read as a kilometre of machinery), so it is painted on as PARALLAX LAYERS, each a field of
 * that kit at its own depth, seen through the recesses of the layer above and shifted by the view as a real recess
 * would shift it:
 *
 *   PLATES     the surface: plates longer along the hull than across, laid in staggered courses, each its own tone,
 *              the seams dark between them
 *   RECESSES   bays cut into the plates: what is seen inside is deeper, so it slides against the plate as the eye moves,
 *              and the wall of the recess shows where the deeper point is still under the plate
 *   KIT        boxes standing in a recess at its first depth: the miniature's greebles, lit on top
 *   FLOOR      the recess's bottom, dark, with finer kit on it (a second scale, seen only up close)
 *
 * And all of it in OCTAVES (KIBBLE.octaves): the same layers at a deck's scale, a plate's and the miniature's, each
 * faded in as its own cells resolve, so the hull shows the degrees of its detail by distance: decks and bays from far
 * off, plates nearer, the kit up close. Each block of a hull carries its LEVEL (0..1, by its role and its form: a superstructure dense, an armour belt plain,
 * a truss none). The detail fades out where a cell is smaller than a few pixels, so it never shimmers far off: a hull
 * reads as plates at a distance and as machinery up close. Pure procedure on the face's own position (its object
 * space, so a piece cut loose carries its kibble with it), no image, no texture: a recipe, not a render.
 *
 *   readKibble(payload) → the page's kibble { scale, blocks: { <block id>: level } } or null
 *   hullKibbleScript(K) → the page script: each listed block's material patched (after the meshes are built)
 *   KIBBLE              the layers' numbers (cells as shares of the scale, depths in m)
 *   KIBBLE_GLSL         the fragment's code: kbKibble() the plating's tone at a point (vKbP, vKbV, uKb, uKbS)
 */

export const KIBBLE = Object.freeze({
  octaves: Object.freeze([8, 2, 0.5]),          // the layers' scales, shares of the kibble's cell: a deck's blocks, a plate's kit, the miniature's greebles
  plate: 2, kit: 0.34,                          // within an octave: a plate twice its cell, kit a third of it
  depth: Object.freeze([0.6, 1.5]),             // the kit's tops and the floor, as shares of the octave's cell
  seam: 0.035,                                  // a seam's width, a share of a plate
  fade: Object.freeze([0.1, 0.45]),             // an octave at full under a tenth of its cell in a pixel, gone past nearly half
});

/** The page's kibble from a payload's fleet levels; null when no block carries any. */
export function readKibble(K) {
  if (!K || typeof K !== 'object' || !K.blocks) return null;
  const blocks = {};
  for (const [id, v] of Object.entries(K.blocks)) if (typeof v === 'number' && v > 0) blocks[id] = Math.round(Math.min(1, v) * 100) / 100;
  if (!Object.keys(blocks).length) return null;
  return { scale: K.scale > 0 ? K.scale : 6, blocks };
}

export const KIBBLE_GLSL = `
varying vec3 vKbP; varying vec3 vKbV; uniform float uKb; uniform float uKbS;
float kbH(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// a field of rectangles in cells of size s: (inside one, its tone)
vec2 kbRect(vec2 uv, float s, float seed, float share) {
  vec2 c = floor(uv / s), f = uv / s - c;
  float a = kbH(c + seed), b = kbH(c + seed + 17.31);
  vec2 lo = vec2(0.06 + 0.32 * a, 0.06 + 0.32 * b), hi = vec2(0.94 - 0.3 * b, 0.94 - 0.28 * a);
  float inR = step(lo.x, f.x) * step(f.x, hi.x) * step(lo.y, f.y) * step(f.y, hi.y);
  return vec2(inR * step(1.0 - share, kbH(c + seed + 5.17)), 0.78 + 0.44 * kbH(c + seed + 9.71));
}
// one octave at cell S: its plates and seams, a recess seen through to the kit at its depth and the floor below
float kbOctave(vec2 uv, vec2 vt, float S, float fw, float seed) {
  // (plates longer along the hull than across, laid in courses, each course a half plate on from the last)
  vec2 P = vec2(1.6, 0.8) * S * ${KIBBLE.plate.toFixed(2)};
  float row = floor(uv.y / P.y);
  vec2 pu = vec2(uv.x + 0.5 * P.x * mod(row, 2.0), uv.y), pc = floor(pu / P), pf = pu / P - pc;
  float edge = min(min(pf.x, 1.0 - pf.x) * P.x, min(pf.y, 1.0 - pf.y) * P.y);
  float tone = (0.9 + 0.2 * kbH(pc + seed + 3.7)) * (1.0 - 0.38 * (1.0 - smoothstep(${KIBBLE.seam} * P.y, ${KIBBLE.seam} * P.y + fw, edge)));
  vec2 r0 = kbRect(uv, S, seed, 0.42);
  if (r0.x > 0.5) {
    vec2 u1 = uv - vt * S * ${KIBBLE.depth[0].toFixed(2)};
    if (kbRect(u1, S, seed, 0.42).x < 0.5) tone = 0.45;                         // the recess's wall
    else {
      vec2 k1 = kbRect(u1, S * ${KIBBLE.kit}, seed + 2.0, 0.55);
      tone = k1.x > 0.5 ? 0.95 * k1.y : 0.34 + 0.1 * kbH(floor((uv - vt * S * ${KIBBLE.depth[1].toFixed(2)}) / (S * 0.2)) + seed);   // a kit box's top, else the floor
    }
  }
  return tone;
}
float kbKibble() {
  vec3 N = normalize(cross(dFdx(vKbP), dFdy(vKbP))), A = abs(N);
  // (the plating runs along the hull: its long axis x, across y on a side)
  vec3 T = A.x > A.y && A.x > A.z ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  T = normalize(T - N * dot(T, N)); vec3 B = cross(N, T);
  vec2 uv = vec2(dot(vKbP, T), dot(vKbP, B));
  vec3 V = normalize(vKbV); float vn = max(abs(dot(V, N)), 0.22); vec2 vt = vec2(dot(V, T), dot(V, B)) / vn;
  float fw = length(fwidth(uv)), k = 1.0;
  // (the octaves, each faded in as its own cell resolves: a hull reads as decks far off, plates nearer, kit up close)
  ${KIBBLE.octaves.map((o, i) => `{ float S = uKbS * ${o.toFixed(2)}, w = (1.0 - smoothstep(S * ${KIBBLE.fade[0]}, S * ${KIBBLE.fade[1]}, fw)) * uKb; if (w > 0.0) k *= mix(1.0, kbOctave(uv + ${(i * 37.1).toFixed(1)}, vt, S, fw, ${(i * 11.0 + 1).toFixed(1)}), w); }`).join('\n  ')}
  return k;
}
`;

/** The page script: every listed block's mesh (and its textured faces) patched with the kibble at its level. */
export function hullKibbleScript(K) {
  return `
// HULL KIBBLE (hull-kibble.js): the plating's kit in parallax layers, by each block's level
(function () {
  const K = ${JSON.stringify(K)}, FRAG = ${JSON.stringify(KIBBLE_GLSL)};
  const patch = (mat, lv) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uKb = { value: lv }; sh.uniforms.uKbS = { value: K.scale };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vKbP; varying vec3 vKbV;')
        .replace('#include <project_vertex>', '#include <project_vertex>\\nvKbP = transformed; vKbV = transpose(mat3(modelMatrix)) * (cameraPosition - (modelMatrix * vec4(transformed, 1.0)).xyz);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\n' + FRAG)
        .replace('#include <color_fragment>', '#include <color_fragment>\\ndiffuseColor.rgb *= kbKibble();');
    };
    mat.customProgramCacheKey = () => 'hull-kibble';
    mat.needsUpdate = true;
  };
  for (const id in K.blocks) {
    const m = meshes['break:' + id];
    if (!m) continue;
    // (a block's own material: shared ones are copied, so a level is the block's alone)
    m.material = m.material.clone(); patch(m.material, K.blocks[id]);
  }
})();
`;
}
