/**
 * RELIEF STEPS — a gen-7 world's texture-map layer drawn in its palette's relief (color-theorist/solve.js `reliefOf`;
 * era/geocube.js `geocubeSteps`), so it speaks in the palette's values rather than between them, at the pixel density
 * of the polygons it stands among. Each layer knows a pixel's RELATIVE value (1 the face's own colour and light): a
 * detail tile its texel over its mean, the rock fabric its relief's light over the facet's. That value is cut into five
 * steps at `at` [deep, shade, face, lip]: the two deeper shades, the face, the two lights, each a colour ratio to the face
 * (the relief's own: darker and leaning to the shadow's hue, lighter and leaning to the light's).
 *
 *   STEPS_GLSL            the uniforms and `relStep(v)` → the colour ratio of the step v falls in
 *   stepsUniforms(S)      in-page source for the uniforms' values, from the steps S { d2, d1, l1, l2, at }
 *
 * Absent steps, a layer draws as it did.
 */
export const STEPS_GLSL = `
uniform vec3 uRelD2; uniform vec3 uRelD1; uniform vec3 uRelL1; uniform vec3 uRelL2; uniform vec4 uRelAt;
vec3 relStep(float v) { return v < uRelAt.x ? uRelD2 : v < uRelAt.y ? uRelD1 : v <= uRelAt.z ? vec3(1.0) : v < uRelAt.w ? uRelL1 : uRelL2; }
`;
export function stepsUniforms(S) {
  const v3 = (a) => `new THREE.Vector3(${a.join(', ')})`;
  return `{ uRelD2: { value: ${v3(S.d2)} }, uRelD1: { value: ${v3(S.d1)} }, uRelL1: { value: ${v3(S.l1)} }, uRelL2: { value: ${v3(S.l2)} }, uRelAt: { value: new THREE.Vector4(${S.at.join(', ')}) } }`;
}
