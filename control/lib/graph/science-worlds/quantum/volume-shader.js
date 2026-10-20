/**
 * The atom world's volume: each orbital ray-marched as a density, gold where ψ is positive and blue where it is
 * negative. The GLSL is generated from the orbital's own coefficients, as numbers: ψ_nlm is written as
 *
 *   ψ(x, y, z) = N · (2/n)^l · e^(−r/n) · L_{n−l−1}^{2l+1}(2r/n) · S_lm(x, y, z)
 *
 * where L is the associated Laguerre polynomial (its coefficients, by Horner) and S_lm = r^l·Y_lm the real solid
 * harmonic, a polynomial in x, y, z: Re or Im (x + iy)^|m| times a polynomial in z and r² (the m-th derivative of the
 * Legendre polynomial, homogenized). Nothing is singular at the nucleus and nothing is a hand-typed twin of atom.js:
 * the probes hold the shader's ψ against `radial · realY` (probes.js), and `psiFromConstants` is the same arithmetic
 * in JS, held to atom.js by the unit tests.
 *
 * The model is ψ. How it glows is dress: the opacity follows |ψ|² against the orbital's own brightest point, scaled by
 * its size and `exposure`; the colours mark the sign; the nucleus is drawn as a small opaque sphere.
 *
 * Frame: z-up, one scene unit = 1/s Bohr radii (s is the page's scale, scene units per a₀); the orbitals stand apart
 * on the x axis, each inside its own sphere, so one march takes ψ from whichever sphere a sample falls in.
 */

import { radial, realY, radialTable } from './atom.js';
import { shaderPage } from '../shader.js';

const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
const binom = (a, b) => (b < 0 || b > a ? 0 : fact(a) / (fact(b) * fact(a - b)));
const g = (x) => {   // a GLSL float literal, full precision
  if (!Number.isFinite(x)) throw new Error(`science-worlds: volume shader constant ${x}`);
  const s = x.toPrecision(9);
  return /[.e]/.test(s) ? s.replace(/e\+?/, 'e') : `${s}.0`;
};

/**
 * One orbital's constants: the prefactor, the Laguerre coefficients in ρ = 2r/n, the z–r² polynomial of the solid
 * harmonic ({ z: power, r2: power, c }), which part of (x + iy)^|m| it takes, and its brightest |ψ| on a grid.
 */
export function orbitalConstants(n, l, m) {
  const k = n - l - 1, alpha = 2 * l + 1, am = Math.abs(m);
  const N = Math.sqrt((2 / n) ** 3 * fact(n - l - 1) / (2 * n * fact(n + l)));
  const laguerre = Array.from({ length: k + 1 }, (_, i) => ((-1) ** i * binom(k + alpha, k - i)) / fact(i));
  // P_l(u) = 2^−l Σ_j (−1)^j C(l, j) C(2l − 2j, l) u^(l − 2j); its m-th derivative, term by term
  const terms = [];
  for (let j = 0; 2 * j <= l; j++) {
    let c = ((-1) ** j * binom(l, j) * binom(2 * l - 2 * j, l)) / 2 ** l;
    const p = l - 2 * j;
    if (p < am) continue;
    for (let d = 0; d < am; d++) c *= p - d;
    // u^(p − m) · r^(l − m) = z^(p − m) · (r²)^((l − p) / 2)
    terms.push({ z: p - am, r2: (l - p) / 2, c });
  }
  const K = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am)));
  // the Condon–Shortley phase (−1)^m of atom.js's legendre, and √2 on the cos / sin forms
  const angular = K * (am % 2 ? -1 : 1) * (m === 0 ? 1 : Math.SQRT2);
  const pref = N * (2 / n) ** l * angular;
  const c = { n, l, m, pref, laguerre, terms, part: m > 0 ? 're' : m < 0 ? 'im' : 'one', power: am };
  return { ...c, peak: peakPsi(n, l, m) };
}

/** ψ from the constants, the shader's arithmetic in JS (p in Bohr radii from the nucleus). */
export function psiFromConstants(c, [x, y, z]) {
  const r2 = x * x + y * y + z * z, r = Math.sqrt(r2), rho = (2 * r) / c.n;
  let L = 0;
  for (let i = c.laguerre.length - 1; i >= 0; i--) L = L * rho + c.laguerre[i];
  let P = 0;
  for (const t of c.terms) P += t.c * z ** t.z * r2 ** t.r2;
  let wr = 1, wi = 0;
  for (let i = 0; i < c.power; i++) { const nr = wr * x - wi * y; wi = wr * y + wi * x; wr = nr; }
  const A = c.part === 're' ? wr : c.part === 'im' ? wi : 1;
  return c.pref * Math.exp(-r / c.n) * L * P * A;
}

/** The brightest |ψ| of an orbital: the largest |R| along r times the largest |Y| over the sphere, each on a grid. */
export function peakPsi(n, l, m) {
  let rMax = 0, yMax = 0;
  const T = radialTable(n, l, 2000);
  for (const r of T.r) rMax = Math.max(rMax, Math.abs(radial(n, l, r)));
  for (let i = 0; i <= 90; i++) for (let k = 0; k <= 180; k++) yMax = Math.max(yMax, Math.abs(realY(l, m, (Math.PI * i) / 90, (2 * Math.PI * k) / 180)));
  return rMax * yMax;
}

/** The peak density |ψ|² the opacity is scaled against. */
export const peakDensity = (n, l, m) => peakPsi(n, l, m) ** 2;

/** How far out an orbital's sphere is drawn (Bohr radii): where a thousandth of its probability is left outside. */
export function volumeReach(n, l) {
  const T = radialTable(n, l);
  let k = T.cdf.length - 1;
  while (k > 0 && T.cdf[k] > (1 - 1e-3) * T.total) k--;
  return T.r[Math.min(T.cdf.length - 1, k + 1)];
}

function psiGlsl(c, i) {
  let L = g(c.laguerre[c.laguerre.length - 1]);
  for (let j = c.laguerre.length - 2; j >= 0; j--) L = `${g(c.laguerre[j])} + rho * (${L})`;
  const pow = (v, e) => (e === 0 ? '1.0' : Array.from({ length: e }, () => v).join(' * '));
  const P = c.terms.map((t) => `${g(t.c)} * ${pow('p.z', t.z)} * ${pow('r2', t.r2)}`).join(' + ') || '1.0';
  const w = c.power ? `\n  vec2 w = vec2(1.0, 0.0);${' w = vec2(w.x * p.x - w.y * p.y, w.x * p.y + w.y * p.x);'.repeat(c.power)}` : '';
  const A = c.part === 're' ? 'w.x' : c.part === 'im' ? 'w.y' : '1.0';
  return `// ${c.n}, ${c.l}, ${c.m}: ψ in a₀^(−3/2) at p (Bohr radii from its nucleus)
float psi${i}(vec3 p) {
  float r2 = dot(p, p), r = sqrt(r2), rho = ${g(2 / c.n)} * r;${w}
  return ${g(c.pref)} * exp(${g(-1 / c.n)} * r) * (${L}) * (${P}) * ${A};
}`;
}

/**
 * The volume shader for an atom page. `orbitals` = [{ n, l, m, center (scene), reach (a₀) }], `s` scene units per
 * a₀, `nucleus` the drawn nucleus radius (scene units), `bg` the background ([r, g, b] 0–1), `exposure` the dress.
 */
export function volumeShader({ orbitals, s, nucleus, bg = [0.043, 0.063, 0.125], exposure = 1, steps = 112 }) {
  if (!orbitals.length || orbitals.length > 6) throw new Error('science-worlds: a volume draws one to six orbitals');
  const consts = orbitals.map((o) => orbitalConstants(o.n, o.l, o.m));
  const uniforms = { uS: s, uExposure: exposure, uNucleus: nucleus, uBg: bg };
  orbitals.forEach((o, i) => { uniforms[`uC${i}`] = o.center; uniforms[`uReach${i}`] = o.reach * s; });
  const N = orbitals.length;
  // per orbital: its ψ, its brightest |ψ| (opacity against it) and its size (opacity per its own length)
  const psiFns = consts.map(psiGlsl).join('\n');
  const pick = (expr) => consts.map((c, i) => `if (k == ${i}) return ${expr(c, i)};`).join(' ');
  const glsl = `
const int STEPS = ${steps};
const vec3 GOLD = vec3(0.878, 0.694, 0.373), BLUE = vec3(0.373, 0.663, 0.878), NUC = vec3(1.0, 0.478, 0.349);
${psiFns}
float psiOf(int k, vec3 p) { ${consts.map((c, i) => `if (k == ${i}) return psi${i}(p);`).join(' ')} return 0.0; }
float peakOf(int k) { ${pick((c) => g(c.peak))} return 1.0; }
float sizeOf(int k) { ${pick((c) => g(0.5 * (3 * c.n * c.n - c.l * (c.l + 1))))} return 1.0; }
vec3 centreOf(int k) { ${orbitals.map((o, i) => `if (k == ${i}) return uC${i};`).join(' ')} return vec3(0.0); }
float reachOf(int k) { ${orbitals.map((o, i) => `if (k == ${i}) return uReach${i};`).join(' ')} return 0.0; }
// a ray against a sphere: (near, far), or (1, 0) when it misses
vec2 sphere(vec3 ro, vec3 rd, vec3 c, float R) {
  vec3 oc = ro - c; float b = dot(oc, rd), q = dot(oc, oc) - R * R, h = b * b - q;
  if (h < 0.0) return vec2(1.0, 0.0);
  h = sqrt(h); return vec2(max(-b - h, 0.0), -b - h > 0.0 || -b + h > 0.0 ? -b + h : 0.0);
}
vec4 sciImage(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0); float T = 1.0;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float done = -1.0;   // the far end of the last sphere marched: the spheres are taken nearest first
  for (int pass = 0; pass < ${N}; pass++) {
    int k = -1; vec2 seg = vec2(1.0, 0.0); float best = 1e30;
    for (int j = 0; j < ${N}; j++) {
      vec2 s = sphere(ro, rd, centreOf(j), reachOf(j));
      if (s.y > s.x && s.x > done && s.x < best) { best = s.x; k = j; seg = s; }
    }
    if (k < 0) break;
    done = seg.y;
    vec3 c = centreOf(k);
    vec2 nu = sphere(ro, rd, c, uNucleus);
    float t1 = nu.y > nu.x ? nu.x : seg.y;
    float dt = (seg.y - seg.x) / float(STEPS), kappa = 12.0 * uExposure / sizeOf(k), pk = peakOf(k);
    for (int i = 0; i < STEPS; i++) {
      float t = seg.x + (float(i) + jitter) * dt;
      if (t > t1) break;
      float v = psiOf(k, (ro + rd * t - c) / uS) / pk;
      float a = 1.0 - exp(-kappa * v * v * dt / uS);
      col += T * a * (v >= 0.0 ? GOLD : BLUE) * 1.15;
      T *= 1.0 - a;
    }
    if (nu.y > nu.x) { col += T * NUC * (0.55 + 0.45 * max(0.0, -dot(rd, normalize(ro + rd * nu.x - c)))); T = 0.0; }
    if (T < 0.004) break;
  }
  return vec4(col + T * uBg, 1.0);
}
// the model quantity, for the conformance gate: ψ of orbital a.w at a.xyz (Bohr radii from its nucleus)
vec4 sciValue(vec4 a, vec4 b) {
  return vec4(psiOf(int(a.w + 0.5), a.xyz), 0.0, 0.0, 0.0);
}
`;
  return { ...shaderPage({ glsl, uniforms }), constants: consts };
}
