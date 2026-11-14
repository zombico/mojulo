/**
 * rocket-parts — the builders of the launch realm's parts (rocket-odm.js), each a workbench recipe in its own frame as
 * every shelf part is (craft-parts.js says the contract): its axis +y from its tail (y = 0, its mount) to its nose, +z up
 * as it lies, +x right. A launcher's archetype stands it on its tail (craft-archetypes.js `stand: 'vertical'`).
 *
 *   ROCKET_BUILDERS   kind → builder(row, C, opts) → { lathes, extrudes, lofts, sweeps, hardpoints, joints? }
 *
 * Most of a launcher is turned: its tanks, its domes, its ogives and its bells are lathes about its axis; its fins,
 * flaps, legs, raceways and ribs are bars and plates set round it. A bell's id begins `bell` so its finish is the hot
 * section's (index.js). Pure: no seed, no clock.
 */
import { lathe, sweep, extrudeWorld, loftWorld, tone, round3 } from './craft-common.js';

const TAU = Math.PI * 2;
const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a point round the axis: radius r at angle a (0 toward +x, a quarter turn toward +z), at height y
const ring = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
// (a straight bar from a to b, its square section w wide, its faces square to `up`)
function bar(id, a, b, w, tint, up = [0, 1, 0]) {
  const d = norm(sub(b, a)), u0 = Math.abs(d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) > 0.95 ? [1, 0, 0] : up;
  const s = norm(cross(d, u0)), t = norm(cross(s, d)), h = w / 2;
  const off = [add(mul(s, -h), mul(t, -h)), add(mul(s, h), mul(t, -h)), add(mul(s, h), mul(t, h)), add(mul(s, -h), mul(t, h))];
  return extrudeWorld(id, a, b, off, tint);
}
// (a disc of radius r on a surface at p, its face along n: a window, a port)
const disc = (id, p, n, r, tint, depth = 0.04) => lathe(id, p, add(p, mul(norm(n), depth)), [[0, r], [1, r]], tint, { samples: 14, crossSections: 2 });
// (an ogive's profile from its base radius R to its tip: a tangent ogive sampled)
const ogive = (R, tip = 0.04, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [t, Math.max(R * tip, R * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.18 * t))]; });

// ── a stage ──────────────────────────────────────────────────────────────────────────────────
function buildStage(row, C) {
  const b = row.build, R = row.dims.diameter / 2, Lg = row.dims.length, lathes = [], extrudes = [], sweeps = [];
  const P = b.points ?? {}, hp = { mount: [0, 0, 0], top: [0, Lg, 0], engines: [0, 0, 0] };
  const S = { samples: 36 };
  if (b.family === 'core') {
    const y0 = b.adapter ? b.adapter.len : b.skirt ?? 0, yT = Lg - (b.interstage ?? b.nose ?? 0);
    // (an interstage houses the stage above's engine: that stage's tail sits a third of it down)
    if (b.interstage) hp.top = [0, Lg - b.interstage / 3, 0];
    // (an adapter's cone from the stage below's diameter; else its engine section's skirt, dark)
    if (b.adapter) lathes.push(lathe('adapter', [0, 0, 0], [0, y0, 0], [[0, b.adapter.from / 2], [1, R]], tone(C.paint, -0.06), S));
    else if (y0) lathes.push(lathe('skirt', [0, 0, 0], [0, y0, 0], [[0, R * 0.99], [1, R]], tone(C.trim, 0.18), S));
    lathes.push(lathe('tank', [0, y0, 0], [0, yT, 0], [[0, R], [1, R]], C.paint, S));
    // (its interstage over the stage above's engine, black; or a side core's nose cone)
    if (b.interstage) lathes.push(lathe('interstage', [0, yT, 0], [0, Lg, 0], [[0, R * 1.004], [1, R * 1.004]], C.trim, S));
    if (b.nose) lathes.push(lathe('nose', [0, yT, 0], [0, Lg, 0], ogive(R, 0.06), C.paint, S));
    // (a reused stage's soot band low down; a raceway up its side)
    for (const [f0, f1] of b.bands ?? []) lathes.push(lathe(`band_${f0}`, [0, y0 + f0 * Lg, 0], [0, y0 + f1 * Lg, 0], [[0, R * 1.003], [1, R * 1.003]], tone(C.trim, 0.32), S));
    if (b.raceway) extrudes.push(extrudeWorld('raceway', [0, y0 + 0.6, 0], [0, yT - 0.3, 0], [[-0.14, 0, R - 0.02], [0.14, 0, R - 0.02], [0.1, 0, R + 0.12], [-0.1, 0, R + 0.12]], tone(C.paint, -0.1)));
    if (b.side !== undefined) hp.side = [round3(2 * R + b.side), 0, 0];
  } else if (b.family === 'stainless') {
    const y0 = b.skirt ?? 0, yT = Lg - (b.nose ?? 0) - (b.hotStage ?? 0);
    lathes.push(lathe('skirt', [0, 0, 0], [0, y0, 0], [[0, R * 0.97], [1, R]], tone(C.paint, -0.25), S));
    lathes.push(lathe('hull', [0, y0, 0], [0, yT, 0], [[0, R], [1, R]], C.paint, { samples: 48 }));
    // (its weld lines: rings every 1.8 m)
    for (let y = y0 + 1.8; y < yT - 0.4; y += 1.8) lathes.push(lathe(`weld_${Math.round(y * 10)}`, [0, y - 0.02, 0], [0, y + 0.02, 0], [[0, R * 1.002], [1, R * 1.002]], tone(C.paint, -0.14), { samples: 48, crossSections: 2 }));
    // (a booster's hot-staging ring: its band, its vents round it)
    if (b.hotStage) {
      lathes.push(lathe('hotstage', [0, yT, 0], [0, yT + b.hotStage, 0], [[0, R], [1, R]], tone(C.paint, -0.08), { samples: 48 }));
      for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; extrudes.push(bar(`vent_${k}`, ring(R + 0.01, a, yT + 0.3), ring(R + 0.01, a, yT + b.hotStage - 0.3), 0.32, C.trim)); }
    }
    // (a booster's chines down two sides)
    if (b.chines) for (const s of [1, -1]) extrudes.push(extrudeWorld(`chine_${s > 0 ? 'r' : 'l'}`, [0, y0 + 2, 0], [0, yT - 3, 0], [[s * (R - 0.05), 0, -0.35], [s * (R + 0.55), 0, -0.2], [s * (R + 0.55), 0, 0.2], [s * (R - 0.05), 0, 0.35]], tone(C.paint, -0.04)));
    // (a ship's nose; its heat shield's tiles down its windward side, its belly)
    if (b.nose) lathes.push(lathe('nose', [0, Lg - b.nose, 0], [0, Lg, 0], ogive(R, 0.03, 10), C.paint, { samples: 48 }));
    if (b.tiles) {
      const n = 18, half = Array.from({ length: n + 1 }, (_, i) => Math.PI + (i / n) * Math.PI), rr = R + 0.05;
      const shield = [...half.map((a) => [Math.cos(a) * rr, 0, Math.sin(a) * rr]), ...half.slice().reverse().map((a) => [Math.cos(a) * (R - 0.02), 0, Math.sin(a) * (R - 0.02)])];
      extrudes.push(extrudeWorld('tiles', [0, y0 + 0.2, 0], [0, Lg - b.nose, 0], shield, C.trim));
      // (and over its nose, ring by ring as it narrows)
      const k = 6;
      for (let i = 0; i < k; i++) {
        const t0 = i / k, t1 = (i + 1) / k, r0 = R * Math.sqrt(1 - t0 * t0) * (1 - 0.18 * t0) + 0.05, r1 = R * Math.sqrt(1 - t1 * t1) * (1 - 0.18 * t1) + 0.05, y = Lg - b.nose + t0 * b.nose * 0.92;
        if (r1 < 0.6) break;
        const arc = (r) => half.map((a) => [Math.cos(a) * r, 0, Math.sin(a) * r]);
        extrudes.push(extrudeWorld(`tiles_nose_${i}`, [0, y, 0], [0, y + (b.nose * 0.92) / k, 0], [...arc((r0 + r1) / 2), ...arc((r0 + r1) / 2 - 0.08).reverse()], C.trim));
      }
    }
  } else if (b.family === 'tank') {
    const foam = b.foam, es = b.engineSection ?? 0, yT = Lg - (b.nose ?? 0);
    // (its aft dome, or a core's engine section; its barrel; its intertank's ribs; its ogive and spike, or a flat top)
    if (es) lathes.push(lathe('engsection', [0, 0, 0], [0, es, 0], [[0, R * 0.96], [1, R]], tone(foam, -0.08), S));
    else lathes.push(lathe('dome_aft', [0, 0, 0], [0, 1.6, 0], [[0, R * 0.55], [0.4, R * 0.86], [1, R]], foam, S));
    lathes.push(lathe('tank', [0, es || 1.6, 0], [0, yT, 0], [[0, R], [1, R]], foam, S));
    if (b.intertank) {
      const [i0, i1] = b.intertank;
      lathes.push(lathe('intertank', [0, i0, 0], [0, i1, 0], [[0, R * 1.006], [1, R * 1.006]], tone(foam, -0.12), S));
      for (let k = 0; k < 36; k++) { const a = (k / 36) * TAU; extrudes.push(bar(`rib_${k}`, ring(R + 0.02, a, i0 + 0.1), ring(R + 0.02, a, i1 - 0.1), 0.09, tone(foam, -0.2))); }
    }
    if (b.nose) {
      lathes.push(lathe('nose', [0, yT, 0], [0, Lg - (b.spike ?? 0), 0], ogive(R, 0.07, 10), foam, S));
      if (b.spike) lathes.push(lathe('spike', [0, Lg - b.spike - 0.1, 0], [0, Lg, 0], [[0, 0.35], [0.5, 0.12], [1, 0.03]], C.chrome, { samples: 12 }));
    }
    // (its feed line and its pressurisation lines up its side)
    extrudes.push(extrudeWorld('feedline', [0, 1.4, 0], [0, (b.intertank?.[0] ?? yT) - 0.2, 0], [[R * 0.32 - 0.22, 0, -(R - 0.05)], [R * 0.32 + 0.22, 0, -(R - 0.05)], [R * 0.32 + 0.22, 0, -(R + 0.42)], [R * 0.32 - 0.22, 0, -(R + 0.42)]], tone(foam, -0.06)));
    // (a strap-on's axis, its tail as far below the tank's as the stack sets it)
    if (b.side !== undefined) hp.side = [round3(b.side), b.sideAt ?? 0, 0];
    // (an orbiter's fittings: a bipod forward, the aft struts, its belly's fitting `orbiter`)
    if (b.orbiter) {
      const z = -(R + b.orbiter.gap), yA = b.orbiter.at, yF = yA + 26.0;
      for (const s of [1, -1]) {
        sweeps.push(sweep(`bipod_${s > 0 ? 'r' : 'l'}`, [[s * 1.4, yF - 1.0, -(R - 0.1)], [s * 0.35, yF, z]], 0.12, C.chrome));
        sweeps.push(sweep(`aftstrut_${s > 0 ? 'r' : 'l'}`, [[s * 1.8, yA + 0.6, -(R - 0.1)], [s * 1.6, yA, z]], 0.18, C.chrome));
      }
      hp.orbiter = [0, round3(yA), round3(z)];
    }
  } else throw new Error(`Unknown rocket-stage family '${b.family}'`);
  if (P.fins !== undefined) hp.fins = [0, P.fins, 0];
  if (P.legs !== undefined) hp.legs = [0, P.legs, 0];
  if (P.flapsFore !== undefined) hp.flapsFore = [0, P.flapsFore, 0];
  if (P.flapsAft !== undefined) hp.flapsAft = [0, P.flapsAft, 0];
  return { lathes, extrudes, sweeps, hardpoints: Object.fromEntries(Object.entries(hp).map(([k, v]) => [k, r3v(v)])) };
}

// ── a solid booster ─────────────────────────────────────────────────────────────────────
function buildBooster(row, C) {
  const b = row.build, R = row.dims.diameter / 2, Lg = row.dims.length, lathes = [];
  const S = { samples: 28 }, seam = tone(C.paint, -0.22), yN = Lg - b.nose;
  lathes.push(lathe('skirt', [0, 0, 0], [0, b.skirt, 0], [[0, b.flare / 2], [0.7, R * 1.04], [1, R]], C.paint, S));
  lathes.push(lathe('nozzle_srb', [0, 0.2, 0], [0, -2.2, 0], [[0, R * 0.36], [0.2, R * 0.42], [1, R * 0.7]], C.chrome, S));
  lathes.push(lathe('case', [0, b.skirt, 0], [0, yN, 0], [[0, R], [1, R]], C.paint, S));
  const seg = (yN - b.skirt) / b.segments;
  for (let k = 1; k < b.segments; k++) { const y = b.skirt + k * seg; lathes.push(lathe(`joint_${k}`, [0, y - 0.12, 0], [0, y + 0.12, 0], [[0, R * 1.012], [1, R * 1.012]], seam, S)); }
  // (its attach rings, fore and aft)
  for (const y of [b.skirt + 1.2, yN - 1.6]) lathes.push(lathe(`attach_${Math.round(y)}`, [0, y - 0.25, 0], [0, y + 0.25, 0], [[0, R * 1.03], [1, R * 1.03]], tone(C.paint, -0.08), S));
  lathes.push(lathe('nose', [0, yN, 0], [0, Lg, 0], [[0, R], [0.25, R * 0.97], [0.6, R * 0.68], [0.9, R * 0.28], [1, R * 0.1]], C.paint, S));
  return { lathes, hardpoints: { mount: [0, 0, 0], top: [0, Lg, 0] } };
}

// ── engines ─────────────────────────────────────────────────────────────────────────────
// (each bell's centre [x, z] under the mount, its radius and its length)
function bellsOf(b, D) {
  const [r, len] = b.bell, out = [], at = (n, rr, a0 = 0, br = r, bl = len) => { for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU; out.push([rr * Math.cos(a), rr * Math.sin(a), br, bl]); } };
  if (b.pattern === 'single') out.push([0, 0, r, len]);
  else if (b.pattern === 'octaweb') { out.push([0, 0, r, len]); at(8, b.ring); }
  else if (b.pattern === 'square4') at(4, b.ring, Math.PI / 4);
  else if (b.pattern === 'rings33') { at(3, 0.9); at(10, 2.45, 0.2); at(20, 3.82, 0.1, r * 0.95); }
  else if (b.pattern === 'ship') { at(3, 1.25); at(3, 3.0, Math.PI / 3, b.vac[0], b.vac[1]); }
  else throw new Error(`Unknown rocket-engine pattern '${b.pattern}'`);
  return out.filter(([x, z, br]) => Math.hypot(x, z) + br <= D / 2 + 1e-6);
}
function buildEngine(row, C) {
  const b = row.build, D = row.dims.diameter, lathes = [];
  // (its mount: the stage's base plate, its heat shield dark)
  lathes.push(lathe('heatshield', [0, 0, 0], [0, -0.18, 0], [[0, D / 2 * 0.96], [1, D / 2 * 0.9]], tone(C.trim, 0.1), { samples: 32 }));
  bellsOf(b, D).forEach(([x, z, r, len], k) => {
    lathes.push(lathe(`bell_${k}`, [x, -0.18, z], [x, -0.18 - len, z], [[0, r * 0.32], [0.12, r * 0.38], [0.45, r * 0.72], [1, r]], C.chrome, { samples: 18 }));
    lathes.push(lathe(`turbo_${k}`, [x, 0, z], [x, -0.2, z], [[0, r * 0.4], [1, r * 0.34]], tone(C.trim, 0.2), { samples: 10, crossSections: 2 }));
  });
  return { lathes, hardpoints: { mount: [0, 0, 0] } };
}

// ── a fairing ───────────────────────────────────────────────────────────────────────────
function buildFairing(row, C) {
  const b = row.build, R = row.dims.diameter / 2, Lg = row.dims.length, rb = b.base / 2, S = { samples: 36 };
  const lathes = [
    lathe('boattail', [0, 0, 0], [0, b.tail, 0], [[0, rb], [1, R]], C.paint, S),
    lathe('barrel', [0, b.tail, 0], [0, b.tail + b.barrel, 0], [[0, R], [1, R]], C.paint, S),
    lathe('ogive', [0, b.tail + b.barrel, 0], [0, Lg, 0], ogive(R, 0.05, 10), C.paint, S),
  ];
  // (its split line, both sides)
  const sweeps = [1, -1].map((s) => sweep(`split_${s > 0 ? 'r' : 'l'}`, [[s * (rb + 0.01), 0.05, 0], [s * (R + 0.01), b.tail, 0], [s * (R + 0.01), b.tail + b.barrel, 0], [s * R * 0.62, b.tail + b.barrel + (Lg - b.tail - b.barrel) * 0.6, 0]], 0.02, tone(C.paint, -0.25), { sides: 4 }));
  return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], top: [0, Lg, 0] } };
}

// ── a capsule ───────────────────────────────────────────────────────────────────────────
function buildCapsule(row, C) {
  const b = row.build, R = row.dims.diameter / 2, rb = b.base / 2, lathes = [], extrudes = [], S = { samples: 36 };
  const yS = b.trunk, yH = yS + 0.28, yC = yH + b.cone;
  // (its trunk or its service module; a crew capsule's trunk's fins at its foot)
  lathes.push(lathe('trunk', [0, 0, 0], [0, yS, 0], [[0, rb], [1, b.wings ? R : rb * 1.02]], C.paint, S));
  if (!b.wings) for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4; extrudes.push(bar(`trunkfin_${k}`, ring(rb, a, 0.2), ring(rb + 0.45, a, 1.4), 0.08, C.paint)); }
  else lathes.push(lathe('trunkband', [0, yS * 0.55, 0], [0, yS * 0.62, 0], [[0, R * 1.005], [1, R * 1.005]], tone(C.paint, -0.15), S));
  // (its heat shield; its cone, its windows round it; its nose cap or its abort tower)
  lathes.push(lathe('heatshield', [0, yS, 0], [0, yH, 0], [[0, b.wings ? R : rb * 1.02], [1, R]], C.trim, S));
  const rTop = R * 0.47;
  lathes.push(lathe('cone', [0, yH, 0], [0, yC, 0], [[0, R], [1, rTop]], C.paint, S));
  const slope = (R - rTop) / b.cone, n = norm([0, slope, 1]);
  for (let k = 0; k < b.windows; k++) {
    const a = (k / b.windows) * TAU + Math.PI / 2, y = yH + b.cone * 0.55, r = R - slope * b.cone * 0.55, p = ring(r, a, y);
    lathes.push(disc(`window_${k}`, p, [Math.cos(a) * n[2], n[1], Math.sin(a) * n[2]], 0.17, C.glass));
  }
  // (its escape motors' pods round its cone's foot)
  if (b.pushers) for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4, p = ring(R * 0.93, a, yH + 0.5); lathes.push(lathe(`pusher_${k}`, p, add(p, [0, 0.9, 0]), [[0, 0.22], [1, 0.16]], tone(C.trim, 0.25), { samples: 10 })); }
  let top = yC;
  if (b.nose) { lathes.push(lathe('nosecap', [0, yC, 0], [0, yC + b.nose, 0], [[0, rTop], [0.5, rTop * 0.88], [1, rTop * 0.35]], C.paint, S)); top = yC + b.nose; }
  if (b.tower) {
    // (the boost cover's ogive over the capsule, the tower above it: its motor's nozzles near its head, its canards)
    lathes.push(lathe('cover', [0, yC, 0], [0, yC + 1.6, 0], [[0, rTop], [1, 0.55]], C.paint, S));
    const yt0 = yC + 1.6, yt1 = yt0 + b.tower;
    lathes.push(lathe('tower', [0, yt0, 0], [0, yt1 - 2.5, 0], [[0, 0.55], [0.15, 0.48], [1, 0.48]], C.paint, { samples: 18 }));
    lathes.push(lathe('tower_tip', [0, yt1 - 2.5, 0], [0, yt1, 0], [[0, 0.48], [0.6, 0.3], [1, 0.05]], C.paint, { samples: 18 }));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4, p = ring(0.5, a, yt0 + b.tower * 0.62); lathes.push(lathe(`nozzle_abort_${k}`, p, add(p, [Math.cos(a) * 0.55, -0.6, Math.sin(a) * 0.55]), [[0, 0.12], [1, 0.22]], C.chrome, { samples: 10 })); }
    top = yt1;
  }
  return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], top: [0, round3(top), 0] } };
}

// ── grid fins and flaps ─────────────────────────────────────────────────────────────────
function buildFins(row, C, opts = {}) {
  const b = row.build, R = row.dims.diameter / 2, span = row.dims.span, chord = row.dims.chord, extrudes = [];
  if (b.family === 'grid') {
    // (each fin a lattice in a frame: out square to the stage when deployed; stowed, folded up flat against it)
    const out = Number(opts.pose?.fins ?? 0) >= 0.5, a0 = ((b.at ?? 0) * Math.PI) / 180;
    for (let k = 0; k < b.n; k++) {
      const a = a0 + (k / b.n) * TAU, rad = [Math.cos(a), 0, Math.sin(a)], tan = [-Math.sin(a), 0, Math.cos(a)], up = [0, 1, 0];
      // (a point on the fin: u out from the hinge, v across it, in its plane)
      const P = (u, v) => out ? add(add(mul(rad, R + 0.12 + u), mul(tan, v)), [0, 0, 0]) : add(add(mul(rad, R + 0.18), mul(up, -0.2 - u)), mul(tan, v));
      const w = Math.max(0.05, span * 0.035), plane = out ? up : rad;
      const edge = (id, p, q) => extrudes.push(bar(id, p, q, w, tone(C.trim, 0.15), plane));
      edge(`fin_${k}_in`, P(0, -chord / 2), P(0, chord / 2)); edge(`fin_${k}_out`, P(span, -chord / 2), P(span, chord / 2));
      edge(`fin_${k}_a`, P(0, -chord / 2), P(span, -chord / 2)); edge(`fin_${k}_b`, P(0, chord / 2), P(span, chord / 2));
      const [nu, nv] = b.cells;
      for (let i = 1; i < nu; i++) extrudes.push(bar(`fin_${k}_u${i}`, P((span * i) / nu, -chord / 2), P((span * i) / nu, chord / 2), w * 0.45, tone(C.trim, 0.25), plane));
      for (let j = 1; j < nv; j++) extrudes.push(bar(`fin_${k}_v${j}`, P(0, -chord / 2 + (chord * j) / nv), P(span, -chord / 2 + (chord * j) / nv), w * 0.45, tone(C.trim, 0.25), plane));
      extrudes.push(bar(`fin_${k}_hinge`, P(-0.1, 0), P(0.05, 0), w * 2, tone(C.trim, 0.1), plane));
    }
  } else if (b.family === 'flap') {
    // (a pair of flaps either side, each a tapered plate hinged along the hull, its tip's chord `taper` of its root's)
    for (const s of [1, -1]) {
      const pts = [[s * (R - 0.1), 0, 0], [s * (R + span), chord * (1 - b.taper) * 0.85, 0], [s * (R + span), chord * 0.85, 0], [s * (R - 0.1), chord, 0]];
      extrudes.push(extrudeWorld(`flap_${s > 0 ? 'r' : 'l'}`, [0, 0, -0.18], [0, 0, 0.18], pts, C.trim));
    }
  } else throw new Error(`Unknown rocket-fins family '${b.family}'`);
  return { extrudes, hardpoints: { mount: [0, 0, 0] } };
}

// ── landing legs ────────────────────────────────────────────────────────────────────────
function buildLegs(row, C, opts = {}) {
  const R = row.dims.diameter / 2, len = row.dims.length, n = row.build.n, extrudes = [], lathes = [];
  const splay = Math.min(1, Math.max(0, Number(opts.pose?.legs ?? 0)));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + Math.PI / 4, rad = [Math.cos(a), 0, Math.sin(a)];
    // (folded: up the stage's tail from its hinge; splayed: out and down to its foot)
    const hinge = add(mul(rad, R + 0.12), [0, 0.2, 0]), th = splay * (Math.PI * 0.62), dir = add(mul([0, 1, 0], Math.cos(th)), mul(rad, Math.sin(th)));
    const foot = add(hinge, mul(dir, len));
    extrudes.push(bar(`leg_${k}`, hinge, foot, 0.42, C.trim, rad));
    extrudes.push(bar(`leg_${k}_strut`, add(mul(rad, R), [0, 3.2, 0]), add(hinge, mul(dir, len * 0.55)), 0.16, tone(C.trim, 0.2), rad));
    lathes.push(lathe(`leg_${k}_foot`, add(foot, mul(dir, -0.15)), add(foot, mul(dir, 0.1)), [[0, 0.36], [1, 0.4]], tone(C.trim, 0.15), { samples: 12 }));
  }
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0] } };
}

// ── the winged orbiter ──────────────────────────────────────────────────────────────────
// (a rounded box's section: w wide, h high, its corners rounded r, centred on zc)
const box = (w, h, zc, rr = 0.35, n = 3) => {
  const pts = [], hw = w / 2, hh = h / 2, r = Math.min(rr * Math.min(w, h), hw, hh);
  for (const [cx, cz, a0] of [[hw - r, -hh + r, -Math.PI / 2], [hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI]]) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), 0, zc + cz + r * Math.sin(a)]); }
  return pts;
};
function buildOrbiter(row, C, opts = {}) {
  // (its body from its tail to its nose; its bells and its body flap past its tail, the class's length over all)
  const Lg = row.dims.length - 2.2, half = row.dims.span / 2, lathes = [], extrudes = [], lofts = [], sweeps = [];
  const W = row.build.fuselage.width, H = row.build.fuselage.height, zB = -2.7, zTop = zB + H, white = C.paint, black = C.trim;
  const zc = (zB + zTop) / 2;
  // (the fuselage: its aft body, its payload bay, its crew cabin raised, its nose falling to its cap)
  const ST = [[0, W * 0.96, H * 0.92, zc - 0.1], [0.08, W, H, zc], [0.7, W, H, zc], [0.8, W * 0.98, H * 1.02, zc + 0.08], [0.88, W * 0.86, H * 0.9, zc - 0.05], [0.94, W * 0.66, H * 0.66, zc - 0.55], [0.98, W * 0.4, H * 0.38, zc - 1.0], [1, W * 0.12, H * 0.12, zc - 1.25]];
  lofts.push(loftWorld('fuselage', [0, 0, 0], [0, Lg, 0], ST.map(([t, w, h, z]) => ({ t, points: box(w, h, z) })), white));
  // (its belly black under its tiles; its nose cap; its chine lines)
  extrudes.push(extrudeWorld('belly', [0, 0.3, 0], [0, Lg * 0.93, 0], [[-W * 0.46, 0, zB - 0.02], [W * 0.46, 0, zB - 0.02], [W * 0.5, 0, zB + 0.35], [-W * 0.5, 0, zB + 0.35]], black));
  lathes.push(lathe('nosecap', [0, Lg * 0.975, zc - 1.1], [0, Lg + 0.05, zc - 1.25], [[0, 0.75], [0.6, 0.55], [1, 0.12]], black, { samples: 16 }));
  // (the flight deck's windows: six across the crown, two over them)
  for (let k = 0; k < 6; k++) { const x = (k - 2.5) * 0.48, p = [x, Lg * 0.905, zTop - 0.55 + Math.abs(x) * -0.08]; extrudes.push(extrudeWorld(`window_${k}`, p, add(p, [0, 0.05, 0.06]), [[-0.2, 0, -0.22], [0.2, 0, -0.22], [0.2, 0, 0.22], [-0.2, 0, 0.22]], C.glass)); }
  // (the payload bay's doors: their hinge lines and their centre seam)
  for (const x of [-W * 0.45, 0, W * 0.45]) sweeps.push(sweep(`bayline_${x.toFixed(1)}`, [[x, Lg * 0.09, zTop + 0.01], [x, Lg * 0.72, zTop + 0.01]], 0.03, tone(white, -0.25), { sides: 4 }));
  // (the double-delta wing: its glove at 81°, its main panel at 45°, flat under, white over, its elevons dark)
  const tz = 0.7, plan = [[W / 2 - 0.2, 1.6], [half, 1.6], [half, 4.2], [W / 2 + 3.6, 15.2], [W / 2 - 0.2, 25.0]];
  for (const s of [1, -1]) {
    const P = plan.map(([x, y]) => [s * x, y, 0]);
    extrudes.push(extrudeWorld(`wing_${s > 0 ? 'r' : 'l'}`, [0, 0, zB + 0.05], [0, 0, zB + 0.05 + tz], P, white));
    extrudes.push(extrudeWorld(`wing_under_${s > 0 ? 'r' : 'l'}`, [0, 0, zB - 0.01], [0, 0, zB + 0.05], P, black));
    // (its leading edge's reinforced carbon, grey)
    sweeps.push(sweep(`wingle_${s > 0 ? 'r' : 'l'}`, [[s * (W / 2 - 0.1), 24.8, zB + 0.35], [s * (W / 2 + 3.6), 15.2, zB + 0.35], [s * half, 4.2, zB + 0.35]], 0.36, tone(black, 0.35), { sides: 6 }));
    extrudes.push(extrudeWorld(`elevon_${s > 0 ? 'r' : 'l'}`, [0, 0, zB + 0.04], [0, 0, zB + 0.12 + tz], [[s * (W / 2 + 0.4), 1.55, 0], [s * (half - 0.3), 1.55, 0], [s * (half - 0.3), 2.9, 0], [s * (W / 2 + 0.4), 2.9, 0]], tone(white, -0.18)));
  }
  // (the fin and its split rudder, its leading edge dark)
  // (its fin's tip the class's height over the ground its gear stands it on)
  const zG = -4.7, finTop = zG + row.dims.height;
  extrudes.push(extrudeWorld('fin', [-0.32, 0, 0], [0.32, 0, 0], [[0, 0.4, zTop - 0.1], [0, 10.6, zTop - 0.1], [0, 5.6, finTop], [0, 3.0, finTop], [0, 0.4, zTop + 1.2]], white));
  extrudes.push(extrudeWorld('rudder', [-0.34, 0, 0], [0.34, 0, 0], [[0, 0.3, zTop + 0.6], [0, 1.6, zTop + 0.6], [0, 3.4, finTop - 0.5], [0, 2.4, finTop - 0.5]], tone(white, -0.12)));
  sweeps.push(sweep('fin_le', [[0, 10.5, zTop], [0, 5.6, finTop]], 0.3, tone(black, 0.35), { sides: 6 }));
  // (its manoeuvring pods either side of the fin, their nozzles; the three main engines; the body flap)
  for (const s of [1, -1]) {
    lathes.push(lathe(`pod_${s > 0 ? 'r' : 'l'}`, [s * 1.65, 0.2, zTop - 0.2], [s * 1.65, 9.8, zTop - 0.6], [[0, 0.95], [0.5, 1.0], [0.85, 0.75], [1, 0.15]], white, { samples: 16 }));
    lathes.push(lathe(`bell_oms_${s > 0 ? 'r' : 'l'}`, [s * 1.65, 0.3, zTop - 0.2], [s * 1.65, -1.4, zTop - 0.2], [[0, 0.22], [1, 0.48]], C.chrome, { samples: 14 }));
  }
  for (const [x, z] of [[0, zTop - 1.5], [1.35, zc - 0.9], [-1.35, zc - 0.9]]) lathes.push(lathe(`bell_main_${x}`, [x, 0.4, z], [x, -2.2, z], [[0, 0.42], [0.12, 0.5], [0.5, 0.86], [1, 1.15]], C.chrome, { samples: 20 }));
  extrudes.push(extrudeWorld('bodyflap', [0, 0, zB - 0.02], [0, 0, zB + 0.42], [[-3.0, -2.1, 0], [3.0, -2.1, 0], [3.0, 0.6, 0], [-3.0, 0.6, 0]], black));
  // (its gear when it is down: the nose leg and two mains, each two wheels)
  // (on its tank its gear is stowed, whatever the craft's pose)
  const gearUp = row.build.stacked || Number(opts.pose?.gear ?? 0) >= 1, rw = 0.56;
  if (!gearUp) for (const [x, y, nose] of [[0, Lg * 0.84, true], [3.45, 9.4, false], [-3.45, 9.4, false]]) {
    const hub = [x, y, zG + rw];
    sweeps.push(sweep(`gear_${x}_strut`, [[x, y + (nose ? 0.4 : 0.6), zB], hub], nose ? 0.12 : 0.18, C.chrome));
    for (const dx of [-0.32, 0.32]) lathes.push(lathe(`gear_${x}_tyre_${dx}`, [x + dx - 0.14, y, zG + rw], [x + dx + 0.14, y, zG + rw], [[0, rw * 0.6], [0.2, rw], [0.8, rw], [1, rw * 0.6]], C.rubber, { samples: 16 }));
  }
  return { lathes, extrudes, lofts, sweeps, hardpoints: { mount: [0, 4.4, round3(zB)] } };
}

export const ROCKET_BUILDERS = Object.freeze({
  'rocket-stage': buildStage,
  'rocket-booster': buildBooster,
  'rocket-engine': buildEngine,
  'rocket-fairing': buildFairing,
  'rocket-capsule': buildCapsule,
  'rocket-fins': buildFins,
  'rocket-legs': buildLegs,
  'rocket-orbiter': buildOrbiter,
});
