/**
 * reactor-view — a CONTROLLED chain reaction: the same branching cascade as cascade-view, but with
 * CONTROL RODS that absorb neutrons. It tells the reactor-vs-bomb story — the single most important
 * "nuclear ENERGY" concept: a supercritical core that WOULD run away is held in check (or shut down)
 * by inserting neutron-absorbing rods. Mesh + the Phase-2 shared-clock mover lifetimes (a rod is a body
 * that translates over the timeline; neutrons appear and vanish), like cascade-view.
 *
 * Two scenarios share the seeded simulation (mulberry32 — same recipe → identical run):
 *   • scram   — the core ignites and the neutron population CLIMBS; then the rods drop in (a SCRAM) and
 *               absorb the neutrons, collapsing the chain and leaving most of the fuel unspent.
 *   • runaway — the rods stay withdrawn: the chain runs away and consumes the whole assembly (what the
 *               rods are there to prevent — the contrast case).
 *
 * Orbit-only object study (drag to orbit); the live HUD reads the neutron population — watch it crash
 * the instant the rods drop. Stored manifest IS the recipe:
 *   { kind:'reactor-view', scenario?, rods?, seed?, scale?, viewBox?, scene?:{ bg? }, title? }
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from './workbench.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── deterministic PRNG (mulberry32) — same seed → same reactor run. ──
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function randDir(rng) { const u = 2 * rng() - 1, th = 2 * Math.PI * rng(), r = Math.sqrt(Math.max(0, 1 - u * u)); return [r * Math.cos(th), r * Math.sin(th), u]; }

// ── workbench lathes: a sphere (nuclei/neutrons/fragments) and a cylinder (a control rod). ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, prof, cross) => ({
  axisFrom: pt([center[0], center[1], center[2] - radius]), axisTo: pt([center[0], center[1], center[2] + radius]),
  profile: circleProfile(radius, prof), crossSections: cross, samples: cross, tint,
});
const sphereFaces = (center, radius, tint, group, prof, cross) =>
  lowerObjectFaces({ lathes: [sphereSpec(center, radius, tint, prof, cross)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group }));
// a VERTICAL cylinder rod of half-height hy about its centre, lathed along the z-axis (z is up in this
// world — see the mechanics-view frame), constant radius with slightly rounded ends.
const rodFaces = (center, radius, hy, tint, group) => {
  const flat = Array.from({ length: 9 }, (_, k) => ({ t: k / 8, radius: k === 0 || k === 8 ? radius * 0.18 : radius }));
  return lowerObjectFaces({ lathes: [{
    axisFrom: pt([center[0], center[1], center[2] - hy]), axisTo: pt([center[0], center[1], center[2] + hy]),
    profile: flat, crossSections: 14, samples: 14, tint,
  }] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group }));
};

export const REACTOR_SCENARIOS = {
  scram: { label: 'SCRAM', note: 'rods drop in → the chain reaction is shut down', rods: true },
  runaway: { label: 'rods withdrawn', note: 'no control → the chain runs away (what rods prevent)', rods: false },
};
export const REACTOR_SCENARIO_NAMES = Object.keys(REACTOR_SCENARIOS);

// geometry/timing constants (world units, seconds). The core is supercritical so 'runaway' consumes it;
// V_NEUTRON / P_CAP / ROD_R are tuned (sweep over seeds) so the SCRAM visibly quenches it — the reaction
// CLIMBS, then the rods drop in and the neutron population CRASHES, leaving most of the fuel unspent.
const R_CORE = 12, R_NUC = 1.5, R_FRAG = 1.05, R_NEU = 0.42;
const NUCLEI = 54, NU = 2.8, P_CAP = 0.70, K_INIT = 3;
const V_NEUTRON = 18, R_CAPTURE = 4.0, ESCAPE_LEN = R_CORE * 1.8;
const FRAG_DUR = 0.55, FRAG_DIST = 2.6, MAX_NEUTRONS = 320, T_MAX = 9;
// control rods: VERTICAL (z-up) absorbers on a horizontal x–y grid, withdrawn ABOVE the core (centre
// z = 2·R) and dropping to centre z = 0 (fully through the core) over [SCRAM_T, SCRAM_T+SCRAM_DUR].
// ROD_R is the neutron-ABSORPTION radius (the effective cross-section, tuned for the SCRAM); the rod is
// drawn thinner (ROD_R_VIS) so the columns read cleanly without occluding the core — physically fine, a
// strong absorber (boron) has a huge neutron cross-section relative to its physical size.
const ROD_R = 2.6, ROD_R_VIS = 1.4, ROD_HY = R_CORE, ROD_TOP = 2 * R_CORE, SCRAM_T = 1.0, SCRAM_DUR = 0.5;
const ROD_OFFSETS = [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5], [0, 0]];   // (x, y) column positions

const NUC_TINT = '#7a8a72', NEU_TINT = '#cfe0ff', ROD_TINT = '#9aa3b0';
const FRAG_TINTS = ['#e0a44f', '#c9743f'];

// rod insertion fraction d(t) ∈ [0,1]: 0 = withdrawn (above the core), 1 = fully inserted.
const rodDepth = (t) => Math.max(0, Math.min(1, (t - SCRAM_T) / SCRAM_DUR));
const rodCenterZ = (t) => ROD_TOP * (1 - rodDepth(t));      // descends from +2R to 0 (z is up)

/**
 * Lay out the core, run the seeded cascade with rod absorption, and emit faces + timed movers + HUD.
 * Pure — no DB, no HTML. @returns {{ faces, picks, movers, bounds, stats }}
 */
export function planReactorScene(recipe = {}) {
  const scenarioName = REACTOR_SCENARIOS[recipe.scenario] ? recipe.scenario : 'scram';
  const SC = REACTOR_SCENARIOS[scenarioName];
  const nRods = SC.rods ? Math.round(clampNum(recipe.rods, 1, ROD_OFFSETS.length, 5)) : 0;
  const scale = clampNum(recipe.scale, 0.2, 3, 1);
  const seed = Number.isFinite(+recipe.seed) ? (+recipe.seed >>> 0) : 3;   // a representative draw: the SCRAM climbs then cleanly crashes
  const rng = mulberry32(seed);
  const rods = ROD_OFFSETS.slice(0, nRods);

  // ── fissile core: jittered nuclei in a sphere ──
  const nuclei = [];
  let guard = 0;
  while (nuclei.length < NUCLEI && guard++ < NUCLEI * 40) {
    const p = [(2 * rng() - 1) * R_CORE, (2 * rng() - 1) * R_CORE, (2 * rng() - 1) * R_CORE];
    if (len(p) > R_CORE) continue;
    if (nuclei.some((n) => len(sub(n.pos, p)) < R_NUC * 2.4)) continue;
    nuclei.push({ pos: p, consumed: false, fissionT: null });
  }

  // true if a neutron at world point q at time tt is inside an inserted rod (→ absorbed). z is up: a rod
  // is a vertical column at (rx, ry) spanning z ∈ [cz−HY, cz+HY], where cz descends as the rods drop in.
  const inRod = (q, tt) => {
    const cz = rodCenterZ(tt);
    if (q[2] < cz - ROD_HY || q[2] > cz + ROD_HY) return false;       // outside the rod's vertical (z) span
    for (const [rx, ry] of rods) { if (Math.hypot(q[0] - rx, q[1] - ry) < ROD_R) return true; }
    return false;
  };
  // earliest distance along a neutron ray (from p0, born at t0) at which a rod absorbs it, else Infinity.
  const rodHitDist = (p0, dir, maxD, t0) => {
    if (!rods.length) return Infinity;
    for (let x = 0.3; x <= maxD; x += 0.5) {
      const q = add(p0, scl(dir, x));
      if (inRod(q, t0 + x / V_NEUTRON)) return x;
    }
    return Infinity;
  };

  // ── ignition: a K_INIT initiator burst aimed at random nuclei (gen-0 always captures). ──
  const src = [-R_CORE * 1.9, 0, 0], queue = [];
  for (let i = 0; i < K_INIT; i++) { const tgt = nuclei[Math.floor(rng() * nuclei.length)]; queue.push({ p: src, d: norm(sub(tgt.pos, src)), birth: 0, gen: 0 }); }

  const neutronRecs = [], fissionRecs = [], fragmentRecs = [];
  let maxGen = 0, absorbed = 0;

  while (queue.length && fissionRecs.length < NUCLEI && neutronRecs.length < MAX_NEUTRONS) {
    queue.sort((a, b) => a.birth - b.birth);
    const n = queue.shift();

    // find the capture point along the ray (pass-through on a failed roll), as in cascade-view.
    let cur = { p: n.p, birth: n.birth }, captured = null, gd = 0;
    while (gd++ < 12) {
      let hit = null, hitT = Infinity;
      for (const nuc of nuclei) {
        if (nuc.consumed) continue;
        const rel = sub(nuc.pos, cur.p), tProj = dot(rel, n.d);
        if (tProj <= 0.001) continue;
        if (len(sub(rel, scl(n.d, tProj))) > R_CAPTURE) continue;
        if (tProj < hitT) { hitT = tProj; hit = nuc; }
      }
      if (!hit) break;
      const tf = cur.birth + hitT / V_NEUTRON;
      if (tf >= T_MAX) break;
      if (n.gen === 0 || rng() < P_CAP) { captured = { nuc: hit, tf, dist: len(sub(hit.pos, n.p)) }; break; }
      cur = { p: add(cur.p, scl(n.d, hitT + 0.01)), birth: tf };
    }

    // a control rod may absorb the neutron BEFORE it reaches its capture (or before it escapes).
    const captureDist = captured ? captured.dist : ESCAPE_LEN;
    const rd = rodHitDist(n.p, n.d, captureDist, n.birth);
    if (rd < captureDist) {
      absorbed++;
      neutronRecs.push({ p0: n.p, p1: add(n.p, scl(n.d, rd)), t0: n.birth, t1: n.birth + rd / V_NEUTRON });
      continue;                                                       // absorbed → no fission, no progeny
    }

    if (captured) {
      const hit = captured.nuc, tf = captured.tf;
      hit.consumed = true; hit.fissionT = tf;
      neutronRecs.push({ p0: n.p, p1: hit.pos, t0: n.birth, t1: tf });
      fissionRecs.push({ pos: hit.pos, t: tf });
      maxGen = Math.max(maxGen, n.gen);
      const fd = randDir(rng);
      fragmentRecs.push({ pos: hit.pos, dir: fd, t: tf, which: 0 });
      fragmentRecs.push({ pos: hit.pos, dir: scl(fd, -1), t: tf, which: 1 });
      const k = Math.floor(NU) + (rng() < NU - Math.floor(NU) ? 1 : 0);
      for (let j = 0; j < k; j++) queue.push({ p: hit.pos, d: randDir(rng), birth: tf, gen: n.gen + 1 });
    } else {
      neutronRecs.push({ p0: n.p, p1: add(n.p, scl(n.d, ESCAPE_LEN)), t0: n.birth, t1: Math.min(n.birth + ESCAPE_LEN / V_NEUTRON, T_MAX + 0.4) });
    }
  }
  for (const n of queue) neutronRecs.push({ p0: n.p, p1: add(n.p, scl(n.d, ESCAPE_LEN)), t0: n.birth, t1: n.birth + ESCAPE_LEN / V_NEUTRON });

  // peak simultaneous neutron population (HUD bar scale) via an event sweep.
  const evs = [];
  for (const r of neutronRecs) { evs.push([r.t0, 1], [r.t1, -1]); }
  evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur2 = 0, peak = 1;
  for (const [, dlt] of evs) { cur2 += dlt; if (cur2 > peak) peak = cur2; }

  // ── faces + timed movers (everything scaled by `scale`) ──
  const S = (p) => scl(p, scale);
  const faces = [], movers = [];
  const tLast = Math.max(T_MAX, ...neutronRecs.map((r) => r.t1), SCRAM_T + SCRAM_DUR);

  movers.push({
    cascade: { regimeLabel: SC.label, note: SC.note, nuclei: nuclei.length, peak },
    label: `Reactor · ${SC.label}`, kindTag: 'carrier',
  });

  // control rods: tall cylinders, authored at the withdrawn position, descending on the SCRAM timeline.
  rods.forEach(([rx, ry], i) => {
    const c0 = S([rx, ry, ROD_TOP]), g = `rod${i}`;
    faces.push(...rodFaces(c0, ROD_R_VIS * scale, ROD_HY * scale, ROD_TINT, g));
    // path = the rod centre sampled across the whole timeline (follows d(t)); walked linearly over [0,tLast].
    const STEPS = 28, path = [];
    for (let k = 0; k <= STEPS; k++) { const tt = (k / STEPS) * tLast; path.push(S([rx, ry, rodCenterZ(tt)])); }
    movers.push({ group: g, path, basePos: c0, t0: 0, t1: tLast, vanish: false, kindTag: 'rod' });
  });

  // nuclei (a fissioning one vanishes at its fission time); flashes; fragments; neutrons — as cascade-view.
  nuclei.forEach((nuc, i) => {
    const c = S(nuc.pos), g = `nuc${i}`;
    faces.push(...sphereFaces(c, R_NUC * scale, NUC_TINT, g, 14, 16));
    if (nuc.consumed) movers.push({ group: g, path: [c, c], basePos: c, t0: 0, t1: nuc.fissionT, vanish: true, kindTag: 'nucleus' });
  });
  fissionRecs.forEach((f, i) => {
    const g = `flash${i}`;
    faces.push(...sphereFaces([0, 0, 0], R_NUC * 1.6 * scale, '#fff3c8', g, 10, 10));
    movers.push({ group: g, at: S(f.pos), basePos: [0, 0, 0], flash: { size: 1 }, t0: f.t, t1: f.t + 0.22, kindTag: 'fission' });
  });
  fragmentRecs.forEach((fr, i) => {
    const c = S(fr.pos), end = S(add(fr.pos, scl(fr.dir, FRAG_DIST))), g = `frag${i}`;
    faces.push(...sphereFaces(c, R_FRAG * scale, FRAG_TINTS[fr.which], g, 12, 14));
    movers.push({ group: g, path: [c, end], basePos: c, t0: fr.t, t1: fr.t + FRAG_DUR, vanish: false, kindTag: 'fragment' });
  });
  neutronRecs.forEach((r, i) => {
    const p0 = S(r.p0), p1 = S(r.p1), g = `neu${i}`;
    faces.push(...sphereFaces(p0, R_NEU * scale, NEU_TINT, g, 8, 8));
    movers.push({ group: g, path: [p0, p1], basePos: p0, t0: r.t0, t1: r.t1, vanish: true, kindTag: 'neutron' });
  });

  const radius = R_CORE * scale * 1.5;
  return {
    faces, picks: [], movers,
    bounds: { center: [0, 0, 0], radius },
    stats: {
      scenario: scenarioName, rods: nRods, nuclei: nuclei.length, fissions: fissionRecs.length,
      neutrons: neutronRecs.length, absorbed, peakNeutrons: peak, generations: maxGen,
    },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload (faces + timed movers + framing). Orbit-only, glow off.
 */
export function assembleReactorScene(recipe = {}, { title } = {}) {
  const plan = planReactorScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 3.3;   // pulled back so the whole core + the rods plunging from above stay in frame
  const angle = { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.5, center[1] - d * 0.82, center[2] + d * 0.42], lookAt: center, horizontalFov: 50 } };
  const side = { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.1, center[2] + d * 0.12], lookAt: center, horizontalFov: 50 } };
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#07080d';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    cameras: [angle, side],
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo reactor · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
