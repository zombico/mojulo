/**
 * sdf-glsl — reusable signed-distance-function GLSL snippets for the volume-raymarch scaffold
 * (volume-raymarch.js). The roadmap's "SDF / metaball" cross-cutting enabler: a transfer function
 * (volSample) builds a scalar field out of these primitives + smooth set operators, and the same field
 * re-topologizes for free as its parameters animate over `uTime` — the basis of every Category-3
 * (topology change) and Category-4 (implicit surface) entry in raymarch-science-roadmap.plan.md.
 *
 * fission-view is the first consumer (one drop → two fragments via an animated smin of two ellipsoids).
 * Siblings that reuse it next: fusion (the time-reverse), droplet coalescence, minimal surfaces.
 *
 * Functions are `sdf*`-prefixed so they never collide with the scaffold's `vr*` helpers or a consumer's
 * own globals. Distances are NOT exact for the ellipsoid (it is iq's bounded approximation), which is
 * fine for emission–absorption volume rendering where we only need the sign + a soft surface band.
 */

export const SDF_GLSL = `
// exact sphere SDF: negative inside, zero on the surface, positive outside.
float sdfSphere(vec3 p, float r){ return length(p) - r; }

// bounded ellipsoid SDF (iq) with per-axis radii r — approximate distance, exact sign.
float sdfEllipsoid(vec3 p, vec3 r){
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

// polynomial smooth-min: blends two SDFs over a width k. Large k → the two shapes fuse into one smooth
// body (a single blob / a closed neck); small k → a sharp join (the neck pinches). Animating k drives
// the topology change without any remeshing.
float sdfSmin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// smooth-max — the complement (smooth intersection / subtraction), for completeness.
float sdfSmax(float a, float b, float k){
  float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}
`;
