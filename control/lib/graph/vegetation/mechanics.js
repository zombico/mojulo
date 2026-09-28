// vegetation/mechanics — the mechanics of a stem from the cell wall up. Pure math, no imports.
//
// The chain this module computes, one step feeding the next:
//   wall   : cellulose microfibrils wound as a helix (the microfibril angle, MFA) in a matrix. Lignin stiffens the
//            matrix IN SHEAR, which is what stops the helix acting as a spring. → E_wall(MFA, lignin)
//   tissue : cells are prismatic tubes; axial stiffness scales with the wall fraction (ρ/ρ_wall).  → E_tissue
//   column : a stem is a column that must carry its own weight. Greenhill's self-buckling height. → h_crit(d)
//   branch : a cantilever under its own weight. One number decides the droop: the bending number
//            B = w L³ / (E I). Holding B fixed across sizes is elastic similarity (L ∝ d^(2/3)).
// Constants are literature values (docs/vegetation.md cites them); where a value is an estimate, it says so.

export const G = 9.81;

// ── wall: a helically wound fibre composite ────────────────────────────────────────────────────────────────────
// Cellulose I crystal: axial ≈ 134 GPa, transverse ≈ 27 GPa, shear ≈ 4.4 GPa (rough values from the wood
// micromechanics literature). The matrix spans a hydrated hemicellulose/pectin gel (unlignified, tens of MPa) up to a
// lignin–hemicellulose matrix (a few GPa). Lignification is modelled as a log blend between the two.
export const CELLULOSE = { E1: 134, E2: 27, G12: 4.4, nu: 0.3 };      // GPa
export const MATRIX = { soft: 0.03, lignified: 3.0, nu: 0.35 };          // GPa
export function matrixModulus(lignin) {
  const l = Math.min(1, Math.max(0, lignin));
  return Math.exp(Math.log(MATRIX.soft) * (1 - l) + Math.log(MATRIX.lignified) * l);
}
/**
 * Axial modulus of one wall layer wound at `mfaDeg` to the cell axis (GPa). Classical lamina transformation over
 * rule-of-mixtures lamina constants (fibre fraction `phi`). The shear term (1/G12) is where the matrix enters:
 * with a soft matrix the helix extends by shearing the matrix, like a spring.
 */
export function wallModulus({ mfaDeg, lignin, phi = 0.5 }) {
  const Em = matrixModulus(lignin); const Gm = Em / (2 * (1 + MATRIX.nu));
  const E1 = phi * CELLULOSE.E1 + (1 - phi) * Em;
  const E2 = 1 / (phi / CELLULOSE.E2 + (1 - phi) / Em);
  const G12 = 1 / (phi / CELLULOSE.G12 + (1 - phi) / Gm);
  const nu12 = phi * CELLULOSE.nu + (1 - phi) * MATRIX.nu;
  const t = (mfaDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const inv = (c ** 4) / E1 + (1 / G12 - (2 * nu12) / E1) * s * s * c * c + (s ** 4) / E2;
  return 1 / inv;
}
/**
 * Extension–twist coupling of a helically wound wall: the sign is the helix handedness. A cell (or a stem built from
 * cells) that is stretched or that grows axially also twists. This is the lamina's shear–extension coupling term
 * (the laminate compliance S̄16) for a single helix. Positive for a Z-helix (right-handed) at 0 < MFA < 90.
 */
export function twistCoupling({ mfaDeg, lignin, phi = 0.5, hand = +1 }) {
  const Em = matrixModulus(lignin); const Gm = Em / (2 * (1 + MATRIX.nu));
  const E1 = phi * CELLULOSE.E1 + (1 - phi) * Em, E2 = 1 / (phi / CELLULOSE.E2 + (1 - phi) / Em);
  const G12 = 1 / (phi / CELLULOSE.G12 + (1 - phi) / Gm), nu12 = phi * CELLULOSE.nu + (1 - phi) * MATRIX.nu;
  const t = (mfaDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const S11 = 1 / E1, S22 = 1 / E2, S12 = -nu12 / E1, S66 = 1 / G12;
  const S16 = (2 * S11 - 2 * S12 - S66) * s * c ** 3 - (2 * S22 - 2 * S12 - S66) * s ** 3 * c;
  // normalised: shear strain per unit axial strain under uniaxial load along the cell axis
  const Sx = c ** 4 * S11 + (2 * S12 + S66) * s * s * c * c + s ** 4 * S22;
  return hand * (-S16 / Sx);
}
/** Tissue: prismatic cells loaded along their axis; stiffness ∝ wall fraction (Gibson & Ashby, axial). */
export const WALL_DENSITY = 1500;   // kg/m³, the cell-wall substance
export function tissueModulus({ mfaDeg, lignin, density }) { return wallModulus({ mfaDeg, lignin }) * (density / WALL_DENSITY); }

// ── column: Greenhill's self-buckling height ────────────────────────────────────────────────────────────────────
// A uniform column clamped at its base buckles under its own weight when q L³ / (E I) = (9/4) j², where j is the
// first zero of the Bessel function J_{-1/3}. This module computes j from the series rather than quoting 7.837.
function besselJ(nu, x) {
  let sum = 0, term = Math.pow(x / 2, nu) / gamma(nu + 1);
  for (let k = 0; k < 80; k++) { sum += term; term *= -(x * x / 4) / ((k + 1) * (k + 1 + nu)); }
  return sum;
}
function gamma(z) {                    // Lanczos, good to ~1e-13 here
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
export function greenhillConstant() {
  let a = 1.0, b = 2.5;                // J_{-1/3} changes sign once in here
  const f = (x) => besselJ(-1 / 3, x);
  for (let i = 0; i < 100; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
  const j = (a + b) / 2; return { j, qL3overEI: 2.25 * j * j };
}
const GH = greenhillConstant();
/** Critical self-buckling height (m) for a solid round column of diameter d (m). E in GPa, ρ in kg/m³. */
export function greenhillHeight({ E, rho, d }) {
  // q = ρ g A, I/A = d²/16  →  h = (K/16)^(1/3) (E/(ρ g))^(1/3) d^(2/3)
  return Math.cbrt((GH.qL3overEI / 16) * (E * 1e9) / (rho * G)) * Math.pow(d, 2 / 3);
}
export const GREENHILL_C = Math.cbrt(GH.qL3overEI / 16);

// ── branch: a cantilever under its own weight ──────────────────────────────────────────────────────────────────
/** Bending number of a round branch: B = w L³/(E I) = 16 ρ g L³ / (E d²). */
export function bendingNumber({ E, rho, L, d }) { return (16 * rho * G * L ** 3) / (E * 1e9 * d * d); }
/**
 * The elastica of a cantilever under a uniform load along its arc, clamped at angle θ0 (radians above horizontal).
 * Solves  θ'' = +B (1 − s) cos θ  on s ∈ [0,1] with θ(0) = θ0, θ'(1) = 0  by shooting on θ'(0).
 * Returns the shape as points (units of L) and the tip drop. Small-B check: horizontal tip deflection → B/8.
 */
export function elastica({ B, theta0 = 0, n = 200 }) {
  const run = (k0) => {
    let th = theta0, k = k0; const pts = [[0, 0]]; let x = 0, y = 0; const h = 1 / n;
    for (let i = 0; i < n; i++) {          // RK4 on (θ, θ')
      const s = i * h;
      const f = (s, th, k) => [k, B * (1 - s) * Math.cos(th)];
      const [a1, b1] = f(s, th, k), [a2, b2] = f(s + h / 2, th + a1 * h / 2, k + b1 * h / 2);
      const [a3, b3] = f(s + h / 2, th + a2 * h / 2, k + b2 * h / 2), [a4, b4] = f(s + h, th + a3 * h, k + b3 * h);
      const thN = th + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4); k += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
      x += h * Math.cos((th + thN) / 2); y += h * Math.sin((th + thN) / 2); th = thN; pts.push([x, y]);
    }
    return { kEnd: k, th, pts };
  };
  // bracket the root of k(1) in k0: the root moment is between zero and the whole weight on a horizontal arm
  let lo = -B / 2 - 1e-9, hi = 1e-9;          // the weight only ever bends it down: θ'(0) ∈ [−B/2, 0]
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (run(lo).kEnd * run(m).kEnd <= 0) hi = m; else lo = m; }
  const r = run((lo + hi) / 2);
  const tip = r.pts[r.pts.length - 1];
  return { pts: r.pts, tip, tipAngle: r.th, drop: Math.sin(theta0) - tip[1] };
}
/** The droop an axis takes relative to its intended direction: the tip angle change, radians. */
export const droopAngle = (B, theta0 = 0) => theta0 - elastica({ B, theta0 }).tipAngle;

// ── the lignification dial, as the tree recipe will use it ─────────────────────────────────────────────────────
// Stem modulus across the dial: turgid parenchyma (a few MPa) → herbaceous stem with lignified bundles (~1 GPa) →
// wood (~10 GPa). A log blend: the dial is "how much of the cross-section is a locked, lignified composite".
export const STEM = { turgid: 0.005, wood: 10 };   // GPa
export const stemModulus = (L) => Math.exp(Math.log(STEM.turgid) * (1 - L) + Math.log(STEM.wood) * L);
