/**
 * cellular-view — a 3D CELL with organelles suspended in superposition inside a translucent
 * "jelly" cytoplasm, rendered in the traversable three.js World. The science/educational sibling
 * of molecule-view: where that shows atoms + bonds, this shows organelles in a cell.
 *
 * "Use the workbench": organelle geometry is OUTPUT through the workbench's monomer lowering
 * (`lowerObjectFaces` from workbench.js bakes lathe specs into lit {corners, fill} faces). Each
 * organelle is authored as a workbench lathe (sphere / capsule / disc); cellular-view scatters
 * them at deterministic seeded positions and tags them for the World's translucency + pick
 * channels. No change to workbench.js — this is a sibling builder that calls its lowering seam.
 *
 * Translucency ("jelly superposition"): the cytoplasm is a big translucent sphere (≈0.22 opacity)
 * and each organelle TYPE is a lightly-translucent (≈0.7), individually-pickable sub-mesh — so
 * overlapping organelles read as superposed but stay legible. The translucency rides emitThreeWorld's
 * additive per-group `alpha`; the cytoplasm carries no pick, so a click passes THROUGH it to the
 * nearest organelle behind.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'cellular-view', cellType?, seed?, scale?, jellyAlpha?, organelleAlpha?, viewBox?,
 *     scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like workbench / molecule-view) — no walk, no CSS-3D /scene form.
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';

const TAU = Math.PI * 2;

// ── tiny vec helpers ──
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ── deterministic PRNG (mulberry32) — same seed → same cell. No Math.random (would break determinism). ──
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + (b - a) * r();
// a seeded unit vector, uniform on the sphere.
function randDir(r) {
  const z = between(r, -1, 1), th = between(r, 0, TAU), q = Math.sqrt(Math.max(0, 1 - z * z));
  return [q * Math.cos(th), q * Math.sin(th), z];
}
// a seeded point in the spherical shell [rMin, rMax] (cube-root → uniform by volume).
function randInShell(r, rMax, rMin = 0) {
  const rad = Math.cbrt(between(r, (rMin / rMax) ** 3, 1)) * rMax;
  return scl(randDir(r), rad);
}

// ── workbench lathe specs (the shapes the workbench lowers) — axes are {x,y,z} points. The lathe
// interpolates its profile LINEARLY between control points, so a round shape needs a finely-
// sampled sinusoidal profile (a 3-point [0,R,0] makes a bicone/diamond, not a sphere). `samples`
// = angular facets (smoothness ∝ face count); set low for the small/numerous organelles. ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n = 16) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const capsuleProfile = (R, n = 18, cap = 0.28) => Array.from({ length: n + 1 }, (_, k) => {
  const t = k / n;
  const r = t < cap ? R * Math.sin((Math.PI / 2) * (t / cap)) : t > 1 - cap ? R * Math.sin((Math.PI / 2) * ((1 - t) / cap)) : R;
  return { t, radius: r };
});
const sphereSpec = (center, radius, tint, samples = 18) => ({
  axisFrom: pt(add(center, [0, 0, -radius])), axisTo: pt(add(center, [0, 0, radius])),
  profile: circleProfile(radius, 16), crossSections: 22, samples, tint,
});
const capsuleSpec = (center, dir, length, radius, tint, samples = 14) => {
  const half = scl(norm(dir), length / 2);
  return { axisFrom: pt(sub(center, half)), axisTo: pt(add(center, half)), profile: capsuleProfile(radius, 18), crossSections: 24, samples, tint };
};
const discSpec = (center, dir, radius, thickness, tint, samples = 22) => {
  const half = scl(norm(dir), thickness / 2);
  return { axisFrom: pt(sub(center, half)), axisTo: pt(add(center, half)), profile: circleProfile(radius, 14), crossSections: 16, samples, tint };
};
// a wavy membranous chain (rough ER): small overlapping spheres wandering from a start point.
function wavyChainSpecs(r, start, steps, step, radius, tint, samples = 9) {
  const specs = [];
  let p = start, dir = randDir(r);
  for (let i = 0; i < steps; i++) {
    specs.push(sphereSpec(p, radius, tint, samples));
    dir = norm(add(dir, scl(randDir(r), 0.7)));   // gently wander
    p = add(p, scl(dir, step));
  }
  return specs;
}

// a rounded box (the plant cell wall / boxy cytoplasm) — a workbench EXTRUDE, axis along z.
const boxSpec = (center, half, round, tint) => ({
  profile: { rect: { w: half[0] * 2, h: half[1] * 2, r: round } },
  axisFrom: pt(add(center, [0, 0, -half[2]])), axisTo: pt(add(center, [0, 0, half[2]])),
  tint,
});

// ── organelle palette + popup facts. `alpha` overrides the default organelle opacity (the watery
// central vacuole is far more see-through than the solid organelles). ──
const ORGANELLE_INFO = {
  nucleus: { tint: '#7b6bb0', label: 'Nucleus', fields: [['role', 'control centre'], ['contains', 'DNA / chromatin'], ['count', '1']] },
  mitochondria: { tint: '#e07a5f', label: 'Mitochondria', fields: [['role', 'powerhouse'], ['makes', 'ATP (energy)'], ['structure', 'double membrane, cristae']] },
  er: { tint: '#caa46b', label: 'Endoplasmic reticulum', fields: [['role', 'synthesis & transport'], ['rough ER', 'ribosome-studded → proteins'], ['smooth ER', 'lipids']] },
  golgi: { tint: '#d98cb3', label: 'Golgi apparatus', fields: [['role', 'package & ship'], ['structure', 'stacked cisternae']] },
  lysosomes: { tint: '#81b29a', label: 'Lysosomes', fields: [['role', 'digestion / recycling'], ['contains', 'hydrolytic enzymes']] },
  ribosomes: { tint: '#9aa6c4', label: 'Ribosomes', fields: [['role', 'protein synthesis'], ['structure', 'rRNA + protein']] },
  // plant-cell organelles
  central_vacuole: { tint: '#a9c6d6', alpha: 0.3, label: 'Central vacuole', fields: [['role', 'turgor pressure / storage'], ['contains', 'cell sap (water, ions)'], ['size', 'fills most of the cell']] },
  chloroplasts: { tint: '#5fa05f', label: 'Chloroplasts', fields: [['role', 'photosynthesis'], ['contains', 'chlorophyll, thylakoids'], ['unique to', 'plants / algae']] },
};

const CYTOPLASM_TINT = '#bcd6e8';
const WALL_TINT = '#c9b68a';        // tan cellulose cell wall
const PLANT_CYTO_TINT = '#cfe0c8';  // pale green plant cytoplasm

// per-cell-type recipe — returns { organelles: {type: latheSpecs}, jelly: [{group, lathes?/extrudes?}] }.
// organelles become translucent, pickable groups; jelly layers are translucent boundary shells with
// NO pick (clicks pass through them). `R` is the cell radius; `r` the seeded PRNG.
const CELL_TYPES = {
  animal(R, r) {
    const organelles = {};
    // nucleus (off-centre a touch) + nucleolus inside it
    const nucC = randInShell(r, R * 0.16);
    const nucR = R * 0.33;
    organelles.nucleus = [sphereSpec(nucC, nucR, ORGANELLE_INFO.nucleus.tint, 32),
      sphereSpec(add(nucC, randInShell(r, nucR * 0.4)), nucR * 0.34, '#4f4377', 22)];
    organelles.mitochondria = Array.from({ length: 12 }, () =>
      capsuleSpec(randInShell(r, R * 0.92, R * 0.42), randDir(r), R * 0.30, R * 0.07, ORGANELLE_INFO.mitochondria.tint, 16));
    organelles.er = [];
    for (let i = 0; i < 3; i++) {
      const start = add(nucC, scl(randDir(r), nucR * 1.15));
      organelles.er.push(...wavyChainSpecs(r, start, 9, R * 0.10, R * 0.035, ORGANELLE_INFO.er.tint, 9));
    }
    const golC = randInShell(r, R * 0.5, R * 0.3), golDir = randDir(r);
    organelles.golgi = Array.from({ length: 5 }, (_, i) =>
      discSpec(add(golC, scl(golDir, (i - 2) * R * 0.05)), golDir, R * (0.16 - i * 0.012), R * 0.02, ORGANELLE_INFO.golgi.tint, 22));
    organelles.lysosomes = Array.from({ length: 6 }, () =>
      sphereSpec(randInShell(r, R * 0.9, R * 0.4), R * between(r, 0.045, 0.07), ORGANELLE_INFO.lysosomes.tint, 14));
    organelles.ribosomes = Array.from({ length: 64 }, () =>
      sphereSpec(randInShell(r, R * 0.95, R * 0.2), R * 0.016, ORGANELLE_INFO.ribosomes.tint, 8));
    return { organelles, jelly: [{ group: 'cytoplasm', lathes: [sphereSpec([0, 0, 0], R, CYTOPLASM_TINT, 44)] }] };
  },

  // plant cell: a boxy cellulose wall, a LARGE central vacuole that pushes the cytoplasm + organelles
  // (incl. green chloroplasts) into a thin peripheral shell. No lysosomes.
  plant(R, r) {
    const organelles = {};
    const vacR = R * 0.6;
    // the dominant central vacuole (very see-through), slightly off-centre
    organelles.central_vacuole = [sphereSpec(randInShell(r, R * 0.06), vacR, ORGANELLE_INFO.central_vacuole.tint, 40)];
    // everything else lives in the thin shell between the vacuole and the wall
    const peri = (rMax = R * 0.86, rMin = R * 0.63) => randInShell(r, rMax, rMin);
    const nucC = peri();
    const nucR = R * 0.17;
    organelles.nucleus = [sphereSpec(nucC, nucR, ORGANELLE_INFO.nucleus.tint, 30),
      sphereSpec(add(nucC, randInShell(r, nucR * 0.4)), nucR * 0.34, '#4f4377', 20)];
    // chloroplasts — green lens discs (unique to plants)
    organelles.chloroplasts = Array.from({ length: 9 }, () =>
      discSpec(peri(), randDir(r), R * between(r, 0.10, 0.14), R * 0.05, ORGANELLE_INFO.chloroplasts.tint, 20));
    organelles.mitochondria = Array.from({ length: 7 }, () =>
      capsuleSpec(peri(), randDir(r), R * 0.22, R * 0.06, ORGANELLE_INFO.mitochondria.tint, 16));
    organelles.er = [];
    for (let i = 0; i < 2; i++) organelles.er.push(...wavyChainSpecs(r, add(nucC, scl(randDir(r), nucR * 1.2)), 7, R * 0.08, R * 0.03, ORGANELLE_INFO.er.tint, 9));
    const golDir = randDir(r), golC = peri();
    organelles.golgi = Array.from({ length: 4 }, (_, i) =>
      discSpec(add(golC, scl(golDir, (i - 1.5) * R * 0.045)), golDir, R * (0.12 - i * 0.01), R * 0.018, ORGANELLE_INFO.golgi.tint, 20));
    organelles.ribosomes = Array.from({ length: 50 }, () =>
      sphereSpec(peri(R * 0.88, R * 0.6), R * 0.015, ORGANELLE_INFO.ribosomes.tint, 8));
    return {
      organelles,
      jelly: [
        { group: 'cell_wall', extrudes: [boxSpec([0, 0, 0], [R * 0.97, R * 0.97, R * 0.97], R * 0.2, WALL_TINT)] },
        { group: 'cytoplasm', extrudes: [boxSpec([0, 0, 0], [R * 0.9, R * 0.9, R * 0.9], R * 0.17, PLANT_CYTO_TINT)] },
      ],
    };
  },
};

const compactFields = (pairs, extra = {}) =>
  [...pairs, ...Object.entries(extra)].filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

/**
 * Resolve a recipe into a placed face list + pick map + render params. Pure — no DB, no HTML.
 * @returns {{ faces, picks, bounds, stats }}
 */
export function planCellularScene(recipe = {}) {
  const cellType = CELL_TYPES[recipe.cellType] ? recipe.cellType : 'animal';
  const seed = Number.isFinite(+recipe.seed) ? (+recipe.seed >>> 0) : 1;
  const scale = Number.isFinite(+recipe.scale) ? Math.max(0.2, +recipe.scale) : 1;
  const jellyAlpha = clamp01(recipe.jellyAlpha, 0.22);
  const organelleAlpha = clamp01(recipe.organelleAlpha, 0.7);
  const R = 10 * scale;
  const r = mulberry32(seed);

  const faces = [], picks = [];
  const tagged = (fs, group, alpha) => { for (const f of fs) faces.push({ ...f, group, alpha }); };

  // organelles — each TYPE lowered through the workbench, tagged as one translucent pick group.
  const { organelles, jelly } = CELL_TYPES[cellType](R, r);
  const stats = { cellType, organelles: {} };
  for (const [type, specs] of Object.entries(organelles)) {
    if (!specs.length) continue;
    const info = ORGANELLE_INFO[type];
    tagged(lowerObjectFaces({ lathes: specs }, WORKBENCH_LIGHT), `org:${type}`, info.alpha ?? organelleAlpha);
    picks.push({ name: `org:${type}`, kind: 'organelle', label: info.label, fields: compactFields(info.fields, { count: specs.length }) });
    stats.organelles[type] = specs.length;
  }

  // jelly boundary layers (cytoplasm; plus the plant cell wall) — translucent, NO pick, so a click
  // passes THROUGH them to the nearest organelle behind. May be lathe (sphere) or extrude (box).
  for (const layer of jelly) {
    tagged(lowerObjectFaces({ lathes: layer.lathes || [], extrudes: layer.extrudes || [] }, WORKBENCH_LIGHT), layer.group, jellyAlpha);
  }

  // bounds from the actual geometry (sphere vs box) — drives the camera framing. radius is the true
  // bounding-SPHERE radius (max corner distance from centre): R for the sphere, corner-dist for the box.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const f of faces) for (const c of f.corners) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || R;

  return { faces, picks, bounds: { center, radius }, stats };
}

/**
 * Resolve a recipe into the emitThreeWorld payload (faces + pickable metadata + framing). Orbit-only.
 */
export function assembleCellularScene(recipe = {}, { title } = {}) {
  const plan = planCellularScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 3.0;
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
    title: title || recipe.title || 'mojulo cell',
    bg,
    glow: false,
  };
}

function clamp01(v, fallback) {
  const n = +v;
  return Number.isFinite(n) ? Math.max(0.05, Math.min(1, n)) : fallback;
}
