/**
 * NOISE, IN GLSL — the shader twin of noise.js's gnoise2 for the World page's effect shaders (a flame's turbulence, a
 * shield's shimmer, a sigil's runes): the same integer hash (Math.imul is a 32-bit multiply, a uint's), the same
 * eight-direction gradient table and quintic fade, so a shader's noise is the module's noise (to float precision).
 * GLSL ES 3.0 (the page's WebGL2): uint arithmetic and constant arrays.
 *
 *   nzN(vec2 p, int sd)               gradient noise, ≈ [−1, 1] (gnoise2)
 *   nzFbm(vec2 p, int sd, int oct)    octaves summed, each turned by the exact 3-4-5 rotation and doubled
 *   nzRidged(vec2 p, int sd, int oct) (1 − |n|)² summed: crests sharp, valleys smooth (lightning, crackle, veins)
 */
export const NOISE_GLSL = `
const vec2 NZ_G[8] = vec2[8](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(0.7071067811865476, 0.7071067811865476), vec2(-0.7071067811865476, 0.7071067811865476), vec2(0.7071067811865476, -0.7071067811865476), vec2(-0.7071067811865476, -0.7071067811865476));
int nzGh(int i, int j, int sd) {
  uint h = (uint(i) * 374761393u) ^ (uint(j) * 668265263u) ^ (uint(sd) * 1274126177u);
  h = (h ^ (h >> 13u)) * 1103515245u;
  return int((h ^ (h >> 16u)) & 7u);
}
float nzN(vec2 p, int sd) {
  vec2 c = floor(p), f = p - c; int i = int(c.x), j = int(c.y);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n00 = dot(NZ_G[nzGh(i, j, sd)], f), n10 = dot(NZ_G[nzGh(i + 1, j, sd)], f - vec2(1.0, 0.0));
  float n01 = dot(NZ_G[nzGh(i, j + 1, sd)], f - vec2(0.0, 1.0)), n11 = dot(NZ_G[nzGh(i + 1, j + 1, sd)], f - vec2(1.0, 1.0));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 1.4142135623730951;
}
float nzFbm(vec2 p, int sd, int oct) {
  float s = 0.0, a = 0.5, w = 0.0;
  for (int k = 0; k < 6; k++) { if (k >= oct) break; s += a * nzN(p, sd + k); w += a; p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.0 + vec2(17.31, -9.77); a *= 0.5; }
  return s / w;
}
float nzRidged(vec2 p, int sd, int oct) {
  float s = 0.0, a = 0.5, w = 0.0, prev = 1.0;
  for (int k = 0; k < 6; k++) { if (k >= oct) break; float n = 1.0 - abs(nzN(p, sd + k)); n *= n; s += a * n * prev; prev = n; w += a; p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.0 + vec2(17.31, -9.77); a *= 0.5; }
  return s / w;
}
`;
