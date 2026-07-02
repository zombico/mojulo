/**
 * cascade-view — a NUCLEAR CHAIN REACTION, mesh + movers. The companion to fission-view: where that
 * ray-marches the SINGLE liquid-drop split (a topology change, raymarch's job), this depicts the
 * branching CASCADE — discrete, countable bodies (neutrons, fragments) on trajectories, which is
 * exactly where meshes win. The roadmap (raymarch-science-roadmap.plan.md) puts the cascade on the mesh
 * side explicitly: "a particle/event system; needs a new cascade animation capability, but mesh-based."
 * That capability is the shared-clock mover LIFETIMES added to scene-three.js (a mover appears at t0 and
 * vanishes/freezes at t1) — the cascade is "just" a big precomputed list of timed movers over a lattice.
 *
 * The whole branching tree is computed DETERMINISTICALLY here in the planner (seeded mulberry32 — same
 * recipe → identical cascade), then emitted as a flat event list the renderer plays back on one clock:
 *   • a lattice of fissile nuclei (static spheres; a fissioning one VANISHES at its fission time),
 *   • a seed neutron that strikes a nucleus → that nucleus fissions,
 *   • each fission → a FLASH (scale-pop), two recoiling FRAGMENTS, and ν≈2.4 fresh NEUTRONS,
 *   • each neutron travels straight to its next capture (or escapes the assembly), and recurses.
 *
 * The headline is the regime: supercritical (k>1) explodes, critical (k≈1) sustains, subcritical (k<1)
 * fizzles — tuned by capture probability (geometry/enrichment) and ν, and read live as the neutron
 * population in the HUD. Orbit-only object study (drag to orbit); stored manifest IS the recipe:
 *   { kind:'cascade-view', regime?, nuclei?, nu?, seed?, scale?, viewBox?, scene?:{ bg? }, title? }
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── deterministic PRNG (mulberry32) — same seed → same cascade. No Math.random (would break determinism). ──
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── tiny vec3 helpers ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function randDir(rng) { const u = 2 * rng() - 1, th = 2 * Math.PI * rng(), r = Math.sqrt(Math.max(0, 1 - u * u)); return [r * Math.cos(th), r * Math.sin(th), u]; }

// ── workbench lathe sphere (every body is one), tessellation scaled to the body's importance/size. ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, prof, cross) => ({
  axisFrom: pt([center[0], center[1], center[2] - radius]), axisTo: pt([center[0], center[1], center[2] + radius]),
  profile: circleProfile(radius, prof), crossSections: cross, samples: cross, tint,
});
const sphereFaces = (center, radius, tint, group, prof, cross) =>
  lowerObjectFaces({ lathes: [sphereSpec(center, radius, tint, prof, cross)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group }));

// pCap (per-encounter capture probability) is the criticality knob; with the fixed geometry below it sets
// the multiplication factor k. Tuned (reliability sweep over 20 seeds) so the regimes separate cleanly and
// the label matches the visual for ANY seed: super consumes ~all, critical a marginal ~half over many
// generations, sub fizzles. Critical's run-to-run spread is real — k≈1 is a knife's edge.
export const CASCADE_REGIMES = {
  subcritical: { nu: 2.0, pCap: 0.28, count: 42, label: 'subcritical', note: 'k < 1 — the chain dies out' },
  critical: { nu: 2.4, pCap: 0.40, count: 46, label: 'critical', note: 'k ≈ 1 — barely self-sustaining' },
  supercritical: { nu: 2.8, pCap: 0.92, count: 56, label: 'supercritical', note: 'k > 1 — runaway, consumes the assembly' },
};
export const CASCADE_REGIME_NAMES = Object.keys(CASCADE_REGIMES);

// physical/visual constants (world units, seconds). R_CLOUD / R_CAPTURE are tuned (sweep over seeds) so
// the three regimes separate cleanly: supercritical consumes ~80% of the assembly, critical sustains a
// many-generation ~half burn, subcritical fizzles in 1–3 generations.
const R_CLOUD = 12;          // assembly radius (denser packing → geometry sustains the chain)
const R_NUC = 1.5, R_FRAG = 1.05, R_NEU = 0.42, R_FLASH = 2.4;
const V_NEUTRON = 42;        // neutron speed (units/s) → crossing the assembly ≈ 0.6 s
const R_CAPTURE = 4.0;       // corridor radius around a neutron's ray within which it can strike a nucleus
const FLASH_DUR = 0.22, FRAG_DUR = 0.55, FRAG_DIST = 2.6;
const ESCAPE_LEN = R_CLOUD * 1.8;
const T_MAX = 7.5;           // simulation time cap (the loop length follows from the latest event)
const MAX_NEUTRONS = 320;
const K_INIT = 3;            // neutron initiator burst — reliable ignition (see CASCADE_REGIMES note)

const NUC_TINT = '#7a8a72';                       // uranium grey-green
const FRAG_TINTS = ['#e0a44f', '#c9743f'];        // the two daughter fragments (gold / copper)
const NEU_TINT = '#cfe0ff';                        // fast neutron (cool, near-glowing)
const FLASH_TINT = '#fff3c8';                      // fission flash (near-white)

/**
 * Lay out the assembly and run the deterministic branching cascade. Pure — no DB, no HTML.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
export function planCascadeScene(recipe = {}) {
  const regimeName = CASCADE_REGIMES[recipe.regime] ? recipe.regime : 'supercritical';
  const R = CASCADE_REGIMES[regimeName];
  const nu = clampNum(recipe.nu, 1.0, 4.0, R.nu);
  const pCap = R.pCap;
  const count = Math.round(clampNum(recipe.nuclei, 12, 80, R.count));
  const scale = clampNum(recipe.scale, 0.2, 3, 1);
  const seed = Number.isFinite(+recipe.seed) ? (+recipe.seed >>> 0) : 8;   // 8 = a representative draw where all three regimes read distinctly
  const rng = mulberry32(seed);

  // ── lay out fissile nuclei: jittered points rejection-sampled into the assembly sphere ──
  const nuclei = [];
  let guard = 0;
  while (nuclei.length < count && guard++ < count * 40) {
    const p = [(2 * rng() - 1) * R_CLOUD, (2 * rng() - 1) * R_CLOUD, (2 * rng() - 1) * R_CLOUD];
    if (len(p) > R_CLOUD) continue;                                  // clip to sphere
    if (nuclei.some((n) => len(sub(n.pos, p)) < R_NUC * 2.4)) continue;   // min spacing (no overlap)
    nuclei.push({ pos: p, consumed: false, fissionT: null });
  }

  // ── ignition: a neutron INITIATOR burst — K_INIT neutrons from an outside source, each aimed at a
  // random nucleus (gen-0 always captures). A burst, not a lone neutron, makes ignition reliable so the
  // regime LABEL matches the visual for every seed; a single seed neutron leaves a super/critical run at
  // the mercy of its first 2–3 random daughters and can fizzle out a "supercritical" assembly. ──
  const src = [-R_CLOUD * 1.9, 0, 0];
  const queue = [];
  for (let i = 0; i < K_INIT; i++) {
    const tgt = nuclei[Math.floor(rng() * nuclei.length)];
    queue.push({ p: src, d: norm(sub(tgt.pos, src)), birth: 0, gen: 0 });
  }

  const neutronRecs = [];   // { p0, p1, t0, t1 }
  const fissionRecs = [];   // { pos, t, gen }
  const fragmentRecs = [];  // { pos, dir, t, which }
  let maxGen = 0;

  while (queue.length && fissionRecs.length < count && neutronRecs.length < MAX_NEUTRONS) {
    queue.sort((a, b) => a.birth - b.birth);                         // process in causal (birth) order
    const n = queue.shift();

    // March the neutron down its straight ray: at each un-consumed nucleus ahead inside the capture
    // corridor, it either captures (→ fission) or PASSES THROUGH and continues to the next one — so a
    // failed roll near one nucleus doesn't end the neutron (it isn't absorbed just for passing close).
    let cur = { p: n.p, birth: n.birth }, captured = null, guard = 0;
    while (guard++ < 12) {
      let hit = null, hitT = Infinity;
      for (const nuc of nuclei) {
        if (nuc.consumed) continue;
        const rel = sub(nuc.pos, cur.p), tProj = dot(rel, n.d);
        if (tProj <= 0.001) continue;
        const perp = len(sub(rel, scl(n.d, tProj)));
        if (perp > R_CAPTURE) continue;
        if (tProj < hitT) { hitT = tProj; hit = nuc; }
      }
      if (!hit) break;
      const tf = cur.birth + hitT / V_NEUTRON;
      if (tf >= T_MAX) break;
      if (n.gen === 0 || rng() < pCap) { captured = { nuc: hit, tf }; break; }   // gen-0 always ignites
      cur = { p: add(cur.p, scl(n.d, hitT + 0.01)), birth: tf };     // pass through, keep going
    }

    if (captured) {
      const hit = captured.nuc, tf = captured.tf;
      hit.consumed = true; hit.fissionT = tf;
      neutronRecs.push({ p0: n.p, p1: hit.pos, t0: n.birth, t1: tf });   // travels origin → strike at constant speed
      fissionRecs.push({ pos: hit.pos, t: tf, gen: n.gen });
      maxGen = Math.max(maxGen, n.gen);
      const fd = randDir(rng);                                        // two fragments recoil back-to-back
      fragmentRecs.push({ pos: hit.pos, dir: fd, t: tf, which: 0 });
      fragmentRecs.push({ pos: hit.pos, dir: scl(fd, -1), t: tf, which: 1 });
      const k = Math.floor(nu) + (rng() < nu - Math.floor(nu) ? 1 : 0);   // ν neutrons (stochastic round)
      for (let j = 0; j < k; j++) queue.push({ p: hit.pos, d: randDir(rng), birth: tf, gen: n.gen + 1 });
    } else {
      // no capture anywhere along the ray → the neutron escapes the assembly and vanishes at the rim.
      neutronRecs.push({ p0: n.p, p1: add(n.p, scl(n.d, ESCAPE_LEN)), t0: n.birth, t1: Math.min(n.birth + ESCAPE_LEN / V_NEUTRON, T_MAX + 0.4) });
    }
  }
  // neutrons still queued when a cap was hit: render them flying out (no silent disappearance).
  const cappedNeutrons = queue.length;
  for (const n of queue) neutronRecs.push({ p0: n.p, p1: add(n.p, scl(n.d, ESCAPE_LEN)), t0: n.birth, t1: n.birth + ESCAPE_LEN / V_NEUTRON });

  // peak simultaneous neutron population (for the HUD bar scale) via an event sweep.
  const evs = [];
  for (const r of neutronRecs) { evs.push([r.t0, 1], [r.t1, -1]); }
  evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, peak = 1;
  for (const [, d] of evs) { cur += d; if (cur > peak) peak = cur; }

  // ── emit faces + the timed mover list (everything scaled uniformly by `scale`) ──
  const S = (p) => scl(p, scale);
  const faces = [], movers = [];

  // the cascade carrier (movers[0]): meshless, drives the population HUD.
  movers.push({
    cascade: { regimeLabel: R.label, note: R.note, nuclei: nuclei.length, peak },
    label: `Chain reaction · ${R.label}`, kindTag: 'carrier',
  });

  // nuclei: static spheres; a fissioning one gets a vanish-mover that removes it at its fission time.
  nuclei.forEach((nuc, i) => {
    const c = S(nuc.pos), g = `nuc${i}`;
    faces.push(...sphereFaces(c, R_NUC * scale, NUC_TINT, g, 14, 16));
    if (nuc.consumed) movers.push({ group: g, path: [c, c], basePos: c, t0: 0, t1: nuc.fissionT, vanish: true, kindTag: 'nucleus' });
  });

  // flashes: a brief scale-pop at each fission point (geometry authored centred on the ORIGIN).
  fissionRecs.forEach((f, i) => {
    const g = `flash${i}`;
    faces.push(...sphereFaces([0, 0, 0], R_FLASH * scale, FLASH_TINT, g, 10, 10));
    movers.push({ group: g, at: S(f.pos), basePos: [0, 0, 0], flash: { size: 1 }, t0: f.t, t1: f.t + FLASH_DUR, kindTag: 'fission' });
  });

  // fragments: born at the fission point, recoil a short distance, and stay (the spent-fuel residue).
  fragmentRecs.forEach((fr, i) => {
    const c = S(fr.pos), end = S(add(fr.pos, scl(fr.dir, FRAG_DIST))), g = `frag${i}`;
    faces.push(...sphereFaces(c, R_FRAG * scale, FRAG_TINTS[fr.which], g, 12, 14));
    movers.push({ group: g, path: [c, end], basePos: c, t0: fr.t, t1: fr.t + FRAG_DUR, vanish: false, kindTag: 'fragment' });
  });

  // neutrons: small fast bodies that travel their segment, then vanish (absorbed or escaped).
  neutronRecs.forEach((r, i) => {
    const p0 = S(r.p0), p1 = S(r.p1), g = `neu${i}`;
    faces.push(...sphereFaces(p0, R_NEU * scale, NEU_TINT, g, 8, 8));
    movers.push({ group: g, path: [p0, p1], basePos: p0, t0: r.t0, t1: r.t1, vanish: true, kindTag: 'neutron' });
  });

  const radius = R_CLOUD * scale * 1.35;
  return {
    faces, picks: [], movers,
    bounds: { center: [0, 0, 0], radius },
    stats: {
      regime: regimeName, nu, nuclei: nuclei.length, fissions: fissionRecs.length,
      neutrons: neutronRecs.length, peakNeutrons: peak, generations: maxGen, capped: cappedNeutrons > 0,
    },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload (faces + timed movers + framing). Orbit-only, glow
 * off (the moving bodies are the point). emitThreeWorld plays the shared-clock lifetimes.
 */
export function assembleCascadeScene(recipe = {}, { title } = {}) {
  const plan = planCascadeScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.4;
  const angle = { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.6, center[1] - d * 0.85, center[2] + d * 0.5], lookAt: center, horizontalFov: 50 } };
  const side = { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.2, center[2]], lookAt: center, horizontalFov: 50 } };
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#07080d';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    cameras: [angle, side],
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.regime} chain reaction`,
    bg,
    glow: false,
  };
}
