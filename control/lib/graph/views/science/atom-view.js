/**
 * atom-view — a single ATOM depicted as it actually is: a nucleus wrapped in electron ORBITALS
 * (standing waves), NOT the Bohr "dots orbiting on rings" misconception. Each orbital is drawn
 * with the wave primitive that shares its wave topology:
 *
 *   • s orbital (l=0) — a spherical standing wave → a LATHE sphere (the 2D-closed wave primitive).
 *   • p orbital (l=1) — two opposite-phase lobes with a NODAL PLANE at the nucleus → a VAJRA (the
 *     mirror-symmetric two-bulb), its centre bead pinched to ~0 so the waist sits exactly on the
 *     nucleus. The two lobes are phase-coloured (+ warm / − cool) — the wavefunction's sign.
 *
 * Accuracy stance: shapes, nodes, phase and quantum-number bookkeeping are faithful; the surfaces
 * are stylized wave-primitive forms, not exact |ψ|² isosurfaces (a deliberate, on-substrate
 * choice — see atom-view.plan.md). Orbitals render translucent so the atom reads as the
 * SUPERPOSITION of occupied orbitals it actually is. Orbit-only object study; pickable.
 *
 * Stored manifest IS the recipe: { kind:'atom-view', element?|Z?, viewBox?, scene?:{bg?}, title? }.
 */

import { makeLight, shadeHex } from '../../polygonizer/vexar.js';
import { latheToFaces } from '../../polygonizer/lathe-faces.js';
import { sampleVajra } from '../../polygonizer/vajra.js';

// ── tiny vec helpers ──
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const centroid4 = (pts) => { const n = pts.length; let x = 0, y = 0, z = 0; for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; } return [x / n, y / n, z / n]; };

const ATOM_LIGHT = makeLight({ direction: norm([-0.4, -0.55, -0.72]), ambient: 0.52, diffuse: 0.9 });
const TAU = Math.PI * 2;

// ── element table + electron configuration (aufbau) ──
const ELEMENTS = { H: 1, HE: 2, LI: 3, BE: 4, B: 5, C: 6, N: 7, O: 8, F: 9, NE: 10, NA: 11, MG: 12, AL: 13, SI: 14, P: 15, S: 16, CL: 17, AR: 18, K: 19, CA: 20, SC: 21, TI: 22, V: 23, CR: 24, MN: 25, FE: 26, CO: 27, NI: 28, CU: 29, ZN: 30 };
const ELEMENT_NAME = { 1: 'Hydrogen', 2: 'Helium', 3: 'Lithium', 4: 'Beryllium', 5: 'Boron', 6: 'Carbon', 7: 'Nitrogen', 8: 'Oxygen', 9: 'Fluorine', 10: 'Neon', 11: 'Sodium', 12: 'Magnesium', 13: 'Aluminium', 14: 'Silicon', 15: 'Phosphorus', 16: 'Sulfur', 17: 'Chlorine', 18: 'Argon', 19: 'Potassium', 20: 'Calcium', 21: 'Scandium', 22: 'Titanium', 23: 'Vanadium', 24: 'Chromium', 25: 'Manganese', 26: 'Iron', 27: 'Cobalt', 28: 'Nickel', 29: 'Copper', 30: 'Zinc' };
const SUBSHELL_SYMBOL = { 0: 's', 1: 'p', 2: 'd', 3: 'f' };
// aufbau fill order (Madelung) up to the 4s/3d region.
const AUFBAU = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1]];

// occupied subshells for Z electrons → [{ label, n, l, electrons }].
export function electronConfig(Z) {
  const sub = [];
  let left = Math.max(0, Math.round(Z));
  for (const [n, l] of AUFBAU) {
    if (left <= 0) break;
    const cap = 2 * (2 * l + 1);
    const e = Math.min(cap, left);
    sub.push({ label: `${n}${SUBSHELL_SYMBOL[l]}`, n, l, electrons: e });
    left -= e;
  }
  return sub;
}

// ── shapes via the wave primitives ──
const circleProfile = (R, n = 16) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });

// the nucleus: a small solid lathe sphere (the localized dense core), pre-lit by latheToFaces.
function sphereFaces(R, tint, samples) {
  return latheToFaces(
    { axisFrom: { x: 0, y: 0, z: -R }, axisTo: { x: 0, y: 0, z: R }, profile: circleProfile(R, 16), crossSections: 22, samples },
    { light: ATOM_LIGHT, tint },
  );
}

// sweep a thin round tube of radius r along a polyline centreline → {corners, normal} faces.
function sweepTube(cl, r, sides) {
  if (cl.length < 2) return [];
  const rings = cl.map((c, i) => {
    const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)];
    const tan = norm(sub(b, a));
    let u = cross(tan, [0, 0, 1]); if (len(u) < 1e-4) u = cross(tan, [1, 0, 0]); u = norm(u);
    const w = norm(cross(tan, u));
    const poly = [];
    for (let j = 0; j < sides; j++) { const th = (j / sides) * Math.PI * 2; poly.push(add(c, add(scl(u, Math.cos(th) * r), scl(w, Math.sin(th) * r)))); }
    return { c, poly };
  });
  const faces = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i].poly, B = rings[i + 1].poly, sc = scl(add(rings[i].c, rings[i + 1].c), 0.5);
    for (let j = 0; j < A.length; j++) { const j2 = (j + 1) % A.length; const corners = [A[j], A[j2], B[j2], B[j]]; faces.push({ corners, normal: norm(sub(centroid4(corners), sc)) }); }
  }
  return faces;
}

// a pole-to-pole loxodrome (spherical spiral) wound `turns` times around the origin at radius R.
function loxodromePath(R, turns, N, phase0 = 0) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), theta = Math.PI * t, phi = phase0 + turns * TAU * t, rad = R * Math.sin(theta);
    pts.push([rad * Math.cos(phi), rad * Math.sin(phi), R * Math.cos(theta)]);
  }
  return pts;
}
// sweep a polyline into thin lit tube faces of one tint.
function pathTubeFaces(cl, tubeR, sides, tint) {
  return sweepTube(cl, tubeR, sides).map((f) => ({ corners: f.corners, fill: shadeHex(tint, f.normal, ATOM_LIGHT) }));
}
// the 2p path: walk the vajra's cross-section rings in order — out one lobe, pinch through the node,
// out the other — so the dumbbell is traversed as a continuous spiral.
function vajraRingWalk(axis, lobeLen, lobeR) {
  const a = norm(axis);
  const v = sampleVajra({
    proximal: pt(scl(a, lobeLen)), center: pt([0, 0, 0]), distal: pt(scl(a, -lobeLen)),
    beads: { proximal: { radius: lobeR }, center: { radius: lobeR * 0.06 }, distal: { radius: lobeR } },
    blend: lobeR * 0.5, crossSections: 20, samples: 26,
  });
  const pts = [];
  for (const ring of v.rings) for (const p of ring.polyline) pts.push([p.x, p.y, p.z]);
  return pts;
}

// an s orbital as a WOUND WAVEFORM (not a solid ball): a smooth pole-to-pole loxodrome wound
// `turns` times around the nucleus, swept as a thin tube. Properly SPHERICAL (the orbital boundary
// surface), traceable, and see-through. A second strand offset half a turn fills the winding evenly.
function woundShellFaces(R, tint, turns = 15, N = 560) {
  return [...pathTubeFaces(loxodromePath(R, turns, N, 0), R * 0.02, 5, tint),
    ...pathTubeFaces(loxodromePath(R, turns, N, Math.PI), R * 0.02, 5, tint)];
}

// a p orbital as a WAVEFORM: the vajra fixes the two-lobe shape + the nodal-plane waist at the
// nucleus; its cross-section ring-loops render as thin tubes (wave contours), phase-coloured by
// the ring parameter t (the + and − lobes).
function pOrbitalWaveFaces(axis, lobeLen, lobeR) {
  const a = norm(axis);
  const v = sampleVajra({
    proximal: pt(scl(a, lobeLen)), center: pt([0, 0, 0]), distal: pt(scl(a, -lobeLen)),
    beads: { proximal: { radius: lobeR }, center: { radius: lobeR * 0.06 }, distal: { radius: lobeR } },
    blend: lobeR * 0.5, crossSections: 20, samples: 26,
  });
  const tubeR = lobeR * 0.045, faces = [];
  for (const ring of v.rings) {
    const hex = ring.t < 0.5 ? PHASE_POS : PHASE_NEG;
    for (const f of sweepTube(ring.polyline.map((p) => [p.x, p.y, p.z]), tubeR, 4)) faces.push({ corners: f.corners, fill: shadeHex(hex, f.normal, ATOM_LIGHT) });
  }
  return faces;
}

// ── d orbitals (l=2) as WAVEFORMS — vajra teardrop lobes + a smoke-ring torus ──
// a single teardrop LOBE: a vajra pinched to ~0 at the nucleus, fattening to a rounded tip along
// `tipDir`. Returns its cross-section rings (the caller renders them as wave contours).
function lobeRings(tipDir, length, lobeR) {
  const d = norm(tipDir);
  const v = sampleVajra({
    proximal: pt(scl(d, length)), center: pt(scl(d, length * 0.55)), distal: pt([0, 0, 0]),
    beads: { proximal: { radius: lobeR * 0.45 }, center: { radius: lobeR }, distal: { radius: lobeR * 0.05 } },
    blend: lobeR * 0.45, crossSections: 14, samples: 22,
  });
  return v.rings;
}
function ringTubeFaces(rings, tubeR, color) {
  const faces = [];
  for (const ring of rings) for (const f of sweepTube(ring.polyline.map((p) => [p.x, p.y, p.z]), tubeR, 4)) faces.push({ corners: f.corners, fill: shadeHex(color, f.normal, ATOM_LIGHT) });
  return faces;
}
// a toroidal coil (the d_z² smoke-ring): a tube wound `turns` times around a horizontal ring.
function toroidalCoilPath(Rmaj, Rmin, turns, N) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), th = t * TAU, ph = turns * TAU * t, rr = Rmaj + Rmin * Math.cos(ph);
    pts.push([rr * Math.cos(th), rr * Math.sin(th), Rmin * Math.sin(ph)]);
  }
  return pts;
}
// d_x²−y² cloverleaf: four teardrop lobes in the xy-plane. Opposite pairs share phase (the real
// d-orbital sign pattern), so +x/−x are one colour and +y/−y the other.
function dCloverWaveFaces(R, colorA, colorB) {
  const L = R, lr = R * 0.42, tube = R * 0.03, faces = [];
  for (const dir of [[1, 0, 0], [-1, 0, 0]]) faces.push(...ringTubeFaces(lobeRings(dir, L, lr), tube, colorA));
  for (const dir of [[0, 1, 0], [0, -1, 0]]) faces.push(...ringTubeFaces(lobeRings(dir, L, lr), tube, colorB));
  return faces;
}
// d_z²: a vertical dumbbell (both lobes one phase) threaded through a smoke-ring torus (other phase).
function dZ2WaveFaces(R, colorA, colorB) {
  const L = R * 1.05, lr = R * 0.4, tube = R * 0.03, faces = [];
  for (const dir of [[0, 0, 1], [0, 0, -1]]) faces.push(...ringTubeFaces(lobeRings(dir, L, lr), tube, colorA));
  faces.push(...pathTubeFaces(toroidalCoilPath(R * 0.62, R * 0.16, 18, 460), tube, 4, colorB));
  return faces;
}
// the d_z² tour PATH: down one lobe, the other, then wind the torus.
function dZ2Path(R) {
  const L = R * 1.05, lr = R * 0.4, pts = [];
  for (const dir of [[0, 0, 1], [0, 0, -1]]) for (const ring of lobeRings(dir, L, lr)) for (const p of ring.polyline) pts.push([p.x, p.y, p.z]);
  pts.push(...toroidalCoilPath(R * 0.62, R * 0.16, 18, 320));
  return pts;
}
// the d_x²−y² cloverleaf tour PATH: walk the four lobes in turn.
function dCloverPath(R) {
  const L = R, lr = R * 0.42, pts = [];
  for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) for (const ring of lobeRings(dir, L, lr)) for (const p of ring.polyline) pts.push([p.x, p.y, p.z]);
  return pts;
}

// ── f orbitals (l=3) as WAVEFORMS — the 8-lobe f_xyz: teardrop lobes toward the 8 cube corners,
// phase alternating by sign(x·y·z) (the real f_xyz sign pattern). One representative of the 7 f set.
const F_DIRS = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
function fOrbitalWaveFaces(R, colorA, colorB) {
  const L = R, lr = R * 0.32, tube = R * 0.028, faces = [];
  for (const dir of F_DIRS) faces.push(...ringTubeFaces(lobeRings(dir, L, lr), tube, dir[0] * dir[1] * dir[2] > 0 ? colorA : colorB));
  return faces;
}
function fXyzPath(R) {
  const L = R, lr = R * 0.32, pts = [];
  for (const dir of F_DIRS) for (const ring of lobeRings(dir, L, lr)) for (const p of ring.polyline) pts.push([p.x, p.y, p.z]);
  return pts;
}

// ── palette ──
const NUCLEUS_TINT = '#ff5a5a';
const SHELL_TINT = ['#ffd27a', '#7ad2ff', '#c79aff', '#9affc7'];   // s-cloud colour by shell n
const PHASE_POS = '#e8554e';   // + lobe (warm)
const PHASE_NEG = '#4e7fe8';   // − lobe (cool)
const P_AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];                  // px, py, pz

const NUC_ALPHA = 0.96, S_ALPHA = 0.5, P_ALPHA = 0.55;

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));
const shellRadius = (n) => 2.0 + 2.2 * n;   // world units; outer shells are bigger

/**
 * Resolve a recipe into a placed face list + pick map + render params. Pure — no DB, no HTML.
 * @returns {{ faces, picks, bounds, stats }}
 */
export function planAtomScene(recipe = {}) {
  const Z = resolveZ(recipe);
  const config = electronConfig(Z);
  const faces = [], picks = [];
  const tagged = (fs, group, alpha) => { for (const f of fs) faces.push({ ...f, group, alpha }); };

  // nucleus — a small bright central sphere (the stabilizing singularity).
  tagged(sphereFaces(1.1, NUCLEUS_TINT, 24), 'nucleus', NUC_ALPHA);
  picks.push({ name: 'nucleus', kind: 'nucleus', label: 'Nucleus', fields: compactFields([['protons (Z)', Z], ['neutrons', `≈ ${Z}`], ['charge', `+${Z}`], ['note', 'dense core — almost all the mass']]) });

  const stats = { Z, element: ELEMENT_NAME[Z] || `Z${Z}`, subshells: config.map((s) => `${s.label}${superscript(s.electrons)}`).join(' '), dropped: [] };

  for (const s of config) {
    const name = `orb:${s.label}`;
    if (s.l === 0) {
      // s — a wound spherical standing-wave shell, sized by n.
      tagged(woundShellFaces(shellRadius(s.n) * 0.62, SHELL_TINT[(s.n - 1) % SHELL_TINT.length]), name, S_ALPHA);
      picks.push({ name, kind: 'orbital', label: `${s.label} subshell`, fields: compactFields([['n', s.n], ['type', 's (l=0)'], ['shape', 'spherical standing wave'], ['electrons', s.electrons]]) });
    } else if (s.l === 1) {
      // p — one waveform dumbbell per OCCUPIED orbital (Hund: singly fill the 3 before pairing).
      const occ = Math.min(3, s.electrons);
      const lobeLen = shellRadius(s.n) * 0.78, lobeR = shellRadius(s.n) * 0.34;
      for (let k = 0; k < occ; k++) tagged(pOrbitalWaveFaces(P_AXES[k], lobeLen, lobeR), name, P_ALPHA);
      picks.push({ name, kind: 'orbital', label: `${s.label} subshell`, fields: compactFields([['n', s.n], ['type', 'p (l=1)'], ['shape', `${occ} dumbbell${occ > 1 ? 's' : ''} (node at nucleus)`], ['electrons', s.electrons]]) });
    } else if (s.l === 2) {
      // d — a cloverleaf (d_x²−y²), a representative of the 5-orbital d set, phase-coloured.
      tagged(dCloverWaveFaces(shellRadius(s.n) * 0.5, PHASE_POS, PHASE_NEG), name, P_ALPHA);
      picks.push({ name, kind: 'orbital', label: `${s.label} subshell`, fields: compactFields([['n', s.n], ['type', 'd (l=2)'], ['shape', 'cloverleaf (1 of 5 d orbitals)'], ['electrons', s.electrons]]) });
    } else if (s.l === 3) {
      // f — the 8-lobe f_xyz, a representative of the 7-orbital f set, phase-coloured.
      tagged(fOrbitalWaveFaces(shellRadius(s.n) * 0.46, PHASE_POS, PHASE_NEG), name, P_ALPHA);
      picks.push({ name, kind: 'orbital', label: `${s.label} subshell`, fields: compactFields([['n', s.n], ['type', 'f (l=3)'], ['shape', '8-lobe f_xyz (1 of 7 f orbitals)'], ['electrons', s.electrons]]) });
    } else {
      // l≥4 (g…) — not rendered; record so it's not silently hidden.
      stats.dropped.push(`${s.label}${superscript(s.electrons)}`);
    }
  }

  // bounds (true bounding sphere) for camera framing.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const f of faces) for (const c of f.corners) radius = Math.max(radius, len(sub(c, center)));

  return { faces, picks, bounds: { center, radius: radius || 10 }, stats };
}

/**
 * The electron WAVE-TOUR (mode:'tour'): hydrogen's orbitals as faint wireframe "mazes" (1s, 2s, 2p),
 * with ONE electron tracing each orbital's wave-path in turn — ground 1s → excited 2s → 2p, the
 * leaps between shells reading as quantum jumps. The moving point traces the wave's GEOMETRY: an
 * illustrative guide, NOT a literal particle orbit (that would be the discredited Bohr model).
 */
export function assembleAtomTour(recipe = {}, { title } = {}) {
  const faces = [], picks = [];
  const tag = (fs, group, alpha) => { for (const f of fs) faces.push({ ...f, group, alpha }); };
  const MAZE = 0.26;

  tag(sphereFaces(1.0, NUCLEUS_TINT, 24), 'nucleus', NUC_ALPHA);
  picks.push({ name: 'nucleus', kind: 'nucleus', label: 'Nucleus (proton)', fields: [{ k: 'charge', v: '+1' }] });

  const R1 = shellRadius(1) * 0.62, R2 = shellRadius(2) * 0.62;
  const lobeLen = shellRadius(2) * 0.78, lobeR = shellRadius(2) * 0.34;

  // 1s maze — faint warm spiral
  const p1s = loxodromePath(R1, 9, 420);
  tag(pathTubeFaces(p1s, R1 * 0.016, 4, SHELL_TINT[0]), 'orb:1s', MAZE);
  picks.push({ name: 'orb:1s', kind: 'orbital', label: '1s (ground state)', fields: [{ k: 'n', v: '1' }, { k: 'nodes', v: '0' }, { k: 'shape', v: 'sphere' }] });

  // 2s maze — faint teal spiral + one inner node shell
  const p2s = loxodromePath(R2, 11, 480);
  tag([...pathTubeFaces(p2s, R2 * 0.016, 4, SHELL_TINT[1]), ...pathTubeFaces(loxodromePath(R2 * 0.42, 6, 240), R2 * 0.012, 4, SHELL_TINT[1])], 'orb:2s', MAZE);
  picks.push({ name: 'orb:2s', kind: 'orbital', label: '2s (excited)', fields: [{ k: 'n', v: '2' }, { k: 'nodes', v: '1 radial (inner shell)' }, { k: 'shape', v: 'sphere' }] });

  // 2p maze — faint phase-coloured dumbbell contours (pz)
  tag(pOrbitalWaveFaces([0, 0, 1], lobeLen, lobeR), 'orb:2p', MAZE + 0.05);
  picks.push({ name: 'orb:2p', kind: 'orbital', label: '2p (excited)', fields: [{ k: 'n', v: '2' }, { k: 'nodes', v: '1 plane (at nucleus)' }, { k: 'shape', v: 'dumbbell' }] });

  // ── the n=3 row (the chart's middle row): 3s, 3p, 3d ──
  const R3 = shellRadius(3) * 0.62;
  // 3s — bigger spiral + TWO inner node shells (n−1 = 2 radial nodes)
  const p3s = loxodromePath(R3, 13, 540);
  tag([...pathTubeFaces(p3s, R3 * 0.014, 4, SHELL_TINT[2]), ...pathTubeFaces(loxodromePath(R3 * 0.6, 8, 300), R3 * 0.011, 4, SHELL_TINT[2]), ...pathTubeFaces(loxodromePath(R3 * 0.28, 5, 180), R3 * 0.009, 4, SHELL_TINT[2])], 'orb:3s', MAZE);
  picks.push({ name: 'orb:3s', kind: 'orbital', label: '3s (excited)', fields: [{ k: 'n', v: '3' }, { k: 'nodes', v: '2 radial' }, { k: 'shape', v: 'sphere' }] });
  // 3p — bigger dumbbell, along x (distinct from the z orbitals)
  const lobeLen3 = shellRadius(3) * 0.78, lobeR3 = shellRadius(3) * 0.34;
  tag(pOrbitalWaveFaces([1, 0, 0], lobeLen3, lobeR3), 'orb:3p', MAZE + 0.05);
  picks.push({ name: 'orb:3p', kind: 'orbital', label: '3p (excited)', fields: [{ k: 'n', v: '3' }, { k: 'nodes', v: '1 plane + 1 radial' }, { k: 'shape', v: 'dumbbell' }] });
  // 3d — the d_z² (dumbbell threaded through a smoke-ring torus) — the chart's 3,2,0
  const R3d = shellRadius(3) * 0.52;
  tag(dZ2WaveFaces(R3d, PHASE_POS, PHASE_NEG), 'orb:3d', MAZE + 0.06);
  picks.push({ name: 'orb:3d', kind: 'orbital', label: '3d — d_z² (excited)', fields: [{ k: 'n', v: '3' }, { k: 'l', v: '2 (d)' }, { k: 'shape', v: 'dumbbell + torus' }] });

  // ── the n=4 row (the chart's bottom row): 4s, 4p, 4d, 4f ──
  const R4 = shellRadius(4) * 0.62;
  const p4s = loxodromePath(R4, 16, 580);
  tag([...pathTubeFaces(p4s, R4 * 0.013, 4, SHELL_TINT[3]),
    ...pathTubeFaces(loxodromePath(R4 * 0.68, 11, 320), R4 * 0.010, 4, SHELL_TINT[3]),
    ...pathTubeFaces(loxodromePath(R4 * 0.42, 7, 220), R4 * 0.009, 4, SHELL_TINT[3]),
    ...pathTubeFaces(loxodromePath(R4 * 0.2, 4, 140), R4 * 0.008, 4, SHELL_TINT[3])], 'orb:4s', MAZE);
  picks.push({ name: 'orb:4s', kind: 'orbital', label: '4s (excited)', fields: [{ k: 'n', v: '4' }, { k: 'nodes', v: '3 radial' }, { k: 'shape', v: 'sphere' }] });
  const lobeLen4 = shellRadius(4) * 0.78, lobeR4 = shellRadius(4) * 0.34;
  tag(pOrbitalWaveFaces([0, 1, 0], lobeLen4, lobeR4), 'orb:4p', MAZE + 0.04);
  picks.push({ name: 'orb:4p', kind: 'orbital', label: '4p (excited)', fields: [{ k: 'n', v: '4' }, { k: 'shape', v: 'dumbbell' }] });
  const R4d = shellRadius(4) * 0.5;
  tag(dCloverWaveFaces(R4d, PHASE_POS, PHASE_NEG), 'orb:4d', MAZE + 0.05);
  picks.push({ name: 'orb:4d', kind: 'orbital', label: '4d — cloverleaf (excited)', fields: [{ k: 'n', v: '4' }, { k: 'l', v: '2 (d)' }, { k: 'shape', v: 'cloverleaf' }] });
  const R4f = shellRadius(4) * 0.46;
  tag(fOrbitalWaveFaces(R4f, PHASE_POS, PHASE_NEG), 'orb:4f', MAZE + 0.06);
  picks.push({ name: 'orb:4f', kind: 'orbital', label: '4f — f_xyz (excited)', fields: [{ k: 'n', v: '4' }, { k: 'l', v: '3 (f)' }, { k: 'shape', v: '8 lobes (cube corners)' }] });

  // the tour path: descend the WHOLE chart — n=1 → n=4, s → p → d → f. The leaps between read as
  // quantum jumps; the electron walks every orbital row in turn (an illustrative trace of each
  // standing wave's geometry, not a literal Bohr orbit).
  const tourPath = [], segments = [];
  const addSeg = (group, pts) => { const start = tourPath.length; for (const p of pts) tourPath.push(p); segments.push({ group, start, end: tourPath.length }); };
  addSeg('orb:1s', p1s);
  addSeg('orb:2s', p2s);
  addSeg('orb:2p', vajraRingWalk([0, 0, 1], lobeLen, lobeR));
  addSeg('orb:3s', p3s);
  addSeg('orb:3p', vajraRingWalk([1, 0, 0], lobeLen3, lobeR3));
  addSeg('orb:3d', dZ2Path(R3d));
  addSeg('orb:4s', p4s);
  addSeg('orb:4p', vajraRingWalk([0, 1, 0], lobeLen4, lobeR4));
  addSeg('orb:4d', dCloverPath(R4d));
  addSeg('orb:4f', fXyzPath(R4f));
  // `segments` lets the World show only the orbital the electron is CURRENTLY in (Current/All toggle).
  const tracers = [{ path: tourPath, segments, color: [150, 220, 255], size: R1 * 0.5, period: 52, trail: 22, trailLag: 0.0018 }];

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const f of faces) for (const c of f.corners) radius = Math.max(radius, len(sub(c, center)));
  const d = radius * 2.8;
  const cameras = [
    { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.7, center[1] - d * 0.95, center[2] + d * 0.5], lookAt: center, horizontalFov: 46 } },
    { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2]], lookAt: center, horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070b18';
  return {
    faces, picks, tracers, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || 'hydrogen electron tour', bg, glow: false,
  };
}

// ── SCIENTIFIC view: a volumetric |ψ|² hydrogen orbital cloud, ray-marched (the real probability
// density — fuzzy falloff, phase-coloured lobes, and the NODAL SURFACES as gaps), as opposed to the
// artistic mesh wave-primitives. Reuses emitThreeWorld's raymarch mode (same path as the black hole).
// Closed-form hydrogenic ψ_nlm in atomic units (a₀ = 1); only the SHAPE matters (display-normalised). ──
const ORBITALS = [
  { key: '1s', idx: 0, rmax: 8, dens: 0.45 }, { key: '2s', idx: 1, rmax: 16, dens: 1.4 }, { key: '2p', idx: 2, rmax: 16, dens: 1.4 },
  { key: '3s', idx: 3, rmax: 26, dens: 6 }, { key: '3p', idx: 4, rmax: 26, dens: 6 }, { key: '3dz2', idx: 5, rmax: 26, dens: 6 },
  { key: '3dx2y2', idx: 6, rmax: 26, dens: 6 }, { key: '3dxy', idx: 7, rmax: 26, dens: 6 },
  // H₂ molecular orbitals (LCAO of 1s) — the same volumetric shader, two nuclei.
  { key: 'h2_sigma', idx: 0, rmax: 9, dens: 0.5, mol: 1, sep: 1.4 },
  { key: 'h2_sigma_star', idx: 0, rmax: 9, dens: 0.5, mol: 2, sep: 1.4 },
];
export const ATOM_ORBITALS = ORBITALS.map((o) => o.key);

export const ATOM_VOLUME_FRAG = `
precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime;
uniform float uFov, uRmax, uDens, uSep; uniform int uOrbital, uMol;
// signed hydrogen wavefunction ψ (shape only, atomic units). Sign = phase; ψ=0 ⇒ a nodal surface.
// uMol 1 = H₂ σ bonding (1sₐ + 1s_b, constructive); uMol 2 = σ* antibonding (1sₐ − 1s_b, destructive).
float psi(vec3 p){
  if (uMol > 0) {
    float a = exp(-length(p - vec3(-uSep * 0.5, 0.0, 0.0)));
    float b = exp(-length(p - vec3(uSep * 0.5, 0.0, 0.0)));
    return uMol == 1 ? (a + b) : (a - b);
  }
  float r = length(p), x = p.x, y = p.y, z = p.z;
  if (uOrbital == 0) return exp(-r);                                  // 1s
  if (uOrbital == 1) return (2.0 - r) * exp(-r * 0.5);               // 2s (1 radial node)
  if (uOrbital == 2) return z * exp(-r * 0.5);                       // 2p_z (nodal plane z=0)
  if (uOrbital == 3) return (27.0 - 18.0 * r + 2.0 * r * r) * exp(-r / 3.0);   // 3s (2 radial nodes)
  if (uOrbital == 4) return z * (6.0 - r) * exp(-r / 3.0);           // 3p_z
  if (uOrbital == 5) return (3.0 * z * z - r * r) * exp(-r / 3.0);   // 3d_z² (dumbbell + torus)
  if (uOrbital == 6) return (x * x - y * y) * exp(-r / 3.0);         // 3d_x²−y²
  return x * y * exp(-r / 3.0);                                      // 3d_xy
}
float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.11, 0.42)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 starbg(vec3 d){ vec3 c = vec3(0.015, 0.017, 0.028); float s = hash(floor(d * 160.0)); if (s > 0.994) c += vec3(0.8, 0.86, 1.0) * (s - 0.994) / 0.006; return c; }
// ray vs bounding sphere (radius uRmax): returns near/far t (or none).
vec2 sphereT(vec3 ro, vec3 rd, float R){ float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c; if (h < 0.0) return vec2(1.0, -1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rd = normalize(uCamBasis * vec3(uv.x * tan(uFov * 0.5), uv.y * tan(uFov * 0.5), 1.0));
  vec3 ro = uCamPos;
  vec3 col = starbg(rd);
  vec2 tt = sphereT(ro, rd, uRmax);
  if (tt.y > tt.x) {
    float t = max(tt.x, 0.0), tEnd = tt.y, dt = (tEnd - t) / 110.0;
    vec3 acc = vec3(0.0); float T = 1.0;
    for (int i = 0; i < 110; i++) {
      if (t > tEnd || T < 0.02) break;
      vec3 p = ro + rd * t;
      float ps = psi(p), d = ps * ps * uDens;                        // |ψ|² density
      if (d > 0.0008) {
        vec3 tint = ps > 0.0 ? vec3(1.0, 0.5, 0.28) : vec3(0.3, 0.62, 1.0);   // +ψ warm, −ψ cool (phase)
        float a = 1.0 - exp(-d * dt * 5.0);
        acc += T * a * tint * (0.7 + min(d, 2.0) * 0.5);
        T *= (1.0 - a);
      }
      t += dt;
    }
    col = col * T + acc;
  }
  // bright nuclei: two protons for a molecule, one otherwise.
  if (uMol > 0) {
    vec2 na = sphereT(ro - vec3(-uSep * 0.5, 0.0, 0.0), rd, 0.42); if (na.y > na.x && na.x > 0.0) col += vec3(1.0, 0.95, 0.8) * 0.9;
    vec2 nb = sphereT(ro - vec3(uSep * 0.5, 0.0, 0.0), rd, 0.42); if (nb.y > nb.x && nb.x > 0.0) col += vec3(1.0, 0.95, 0.8) * 0.9;
  } else {
    vec2 nt = sphereT(ro, rd, 0.6); if (nt.y > nt.x && nt.x > 0.0) col += vec3(1.0, 0.95, 0.8) * 0.9;
  }
  col = col / (col + vec3(1.0)); col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

const ORBITAL_FACTS = {
  '1s': 'spherical · no nodes', '2s': 'spherical · 1 radial node (shell)', '2p': 'dumbbell · 1 nodal plane',
  '3s': 'spherical · 2 radial nodes', '3p': 'dumbbell + node', '3dz2': 'dumbbell + torus · conical nodes',
  '3dx2y2': 'cloverleaf · 2 nodal planes', '3dxy': 'cloverleaf · 2 nodal planes',
};

const MOL_READOUT = {
  1: ['H₂ molecular orbital — σ (bonding)', '|ψ|² from 1sₐ + 1s_b (constructive overlap)', 'density piles up BETWEEN the nuclei → the bond', 'no node between the atoms → lower energy'],
  2: ['H₂ molecular orbital — σ* (antibonding)', '|ψ|² from 1sₐ − 1s_b (destructive overlap)', 'a NODAL PLANE between the nuclei (warm | cool)', 'density pushed outward → higher energy'],
};

export function assembleAtomVolume(recipe = {}, { title } = {}) {
  const o = ORBITALS.find((x) => x.key === recipe.orbital) || ORBITALS.find((x) => x.key === '3dz2');
  const dist = o.rmax * 2.1;
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#04050d';
  const readout = o.mol ? MOL_READOUT[o.mol]
    : [`Hydrogen orbital — ${o.key}`, '|ψ|² electron probability cloud (ray-marched)', 'warm = +ψ · cool = −ψ (phase)', `gaps = nodal surfaces · ${ORBITAL_FACTS[o.key] || ''}`];
  return {
    raymarch: {
      frag: ATOM_VOLUME_FRAG,
      customUniforms: { uRmax: o.rmax, uDens: o.dens, uOrbital: o.idx, uMol: o.mol || 0, uSep: o.sep || 0 },
      cameraStart: [0, dist * 0.32, dist * 0.92], target: [0, 0, 0], fov: 42, readout,
    },
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || (o.mol ? `H₂ ${o.mol === 1 ? 'σ' : 'σ*'} orbital` : `hydrogen ${o.key} orbital`),
    bg,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only. `style:'scientific'` → the volumetric
 * ray-marched |ψ|² orbital cloud; otherwise the artistic mesh view (`mode:'tour'` → the animated
 * wave-tour; default → the static orbital set).
 */
export function assembleAtomScene(recipe = {}, { title } = {}) {
  if (recipe.style === 'scientific') return assembleAtomVolume(recipe, { title });
  if (recipe.mode === 'tour') return assembleAtomTour(recipe, { title });
  const plan = planAtomScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.8;
  const cameras = [
    { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.8, center[1] - d * 0.9, center[2] + d * 0.5], lookAt: center, horizontalFov: 46 } },
    { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2]], lookAt: center, horizontalFov: 46 } },
    { name: 'top', worldFraming: { cameraPosition: [center[0], center[1], center[2] + d * 1.3], lookAt: center, horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || plan.stats.element || 'mojulo atom',
    bg,
    glow: false,
  };
}

function resolveZ(recipe) {
  if (Number.isFinite(+recipe.Z)) return Math.max(1, Math.min(30, Math.round(+recipe.Z)));
  const key = String(recipe.element || '').trim().toUpperCase();
  return ELEMENTS[key] || 10;   // default neon
}
const SUPERS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const superscript = (n) => String(n).split('').map((d) => SUPERS[d] || d).join('');
