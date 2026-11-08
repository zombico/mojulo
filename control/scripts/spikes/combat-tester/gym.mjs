// SPIKE combat tester, phase 2: THE GYM. A game's seed, drawn: a graybox laid from the game's own measured numbers
// (measure.mjs), played as the game plays (its player, its camera, its guns), so what the measures say can be seen and
// tried. The meru island's flow for gameplay: the gym is the small seed at the game's scale; its levels are grown from
// the same numbers (phase 3).
//
//   node scripts/spikes/combat-tester/gym.mjs <out-dir> [game …] [--quick '<json>'] [--camera own|other|both] [--check]
//   (from control/; games as measure.mjs; writes <game>.html, <game>-<camera>.html for the other camera, and prints the
//   gym's own gate: the game's rule driven over the gym's stations headless. --check opens each page in headless
//   Chromium and drives the page's OWN runtime (window.__mojCtrl.step, frame by frame: software rendering is too slow
//   to play in real time): it loads clean, a round drops the 15 m dummy, each wall takes its matter's mark, the green
//   step is climbed and the red one is not)
//
// Three stations round a start pad (the player stands on it facing the range, +x):
//   the RANGE (ahead)     the game's own foe, standing at 5, 15 and 30 m, back on its feet a moment after it drops (the
//                         match layer, its scoreboard counting rounds and hits); distance posts every 5 m; a backstop
//   the WALL YARD (right) five walls 10 m off, brick, concrete, pine, sheet metal, steel, each marked as its own matter
//                         (rupa's scars: nothing breaks, every round leaves its mark)
//   the LANE (left)       the run's strip (a line to let go at, the stop box the measured stop long), the step (one a
//                         rise inside the rule's step, one over it), the ledge (at the measured jump's height and over
//                         it), the gap (the measured jump's length short of it and past it), half and full cover
// Green is meant to be made, red is not: the gym's gate drives the game's own rule at each and says whether it is so.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { GAMES, mint, measureGame, laws } = await import('./measure.mjs');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { composeLive } = await import('../../../lib/graph/worlds/controllable/compose.js');
const { readScarsSpec } = await import('../../../lib/graph/rupa/index.js');

const FPS = 60, DT = 1 / FPS, E = composeLive(), flat = { ground: () => 0 };
const r2 = (v) => Math.round(v * 100) / 100;

// ── the graybox: values only, a green for what is meant to be made and a red for what is not ──────────────────────────
const G = Object.freeze({ floor: ['#8d8a83', '#86837c'], line: '#6d6f74', block: '#b9b4a9', yes: '#7fa77a', no: '#b0716a', post: '#5d5f64', pad: '#a7a296' });
const WALL_FILL = Object.freeze({ brick: '#9a5c4c', concrete: '#a3a19c', pine: '#c9a46e', 'sheet-metal': '#8e9aa5', steel: '#6c757d' });
const quad = (a, b, c, d, fill, group) => ({ corners: [a, b, c, d], fill, group });
// a box on the floor (or on `z0`): its top and four sides (no bottom), and its collider
function box(x0, y0, x1, y1, h, fill, group, z0 = 0) {
  const z1 = z0 + h;
  const faces = [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group),
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group),
  ];
  return { faces, collider: { min: [x0, y0, z0], max: [x1, y1, z1] } };
}
const CHROME = { bg: 'rgba(20,22,26,0.82)', color: '#e8e6e0', border: '1px solid #4a4c50', radius: '4px', shadow: 'none', glow: 'none', font: 'ui-monospace, monospace', fontSize: 11, fontWeight: 500, padding: '3px 6px' };
// (a label always on, following its point: a toast that never times out; a tooltip shows only on hover)
const label = (id, at, text) => ({ id, variant: 'toast', anchor: { kind: 'world', world: at }, text, body: [], after: 0, ttl: 1e6, chrome: CHROME });

/**
 * The gym laid from a game's measures (`m`, measure.mjs) and its player's rule: → { faces, colliders, signs, walls,
 * dummies: [{ id, at }], spawn, stations: [{ id, kind, meant: 'made' | 'not', … }] } (the stations are what the gate drives).
 */
export function layGym(m, rule, R = null) {
  const faces = [], colliders = [], signs = [], stations = [];
  const put = (B) => { faces.push(...B.faces); colliders.push(B.collider); return B.collider; };
  // the floor: metre cells in two values, a darker line every 5 m (the eye reads distance off it)
  for (let i = -8; i < 56; i++) for (let j = -24; j < 20; j++) {
    const five = ((i % 5) + 5) % 5 === 0 || ((j % 5) + 5) % 5 === 0;
    faces.push(quad([i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0], five ? G.line : G.floor[(i + j) & 1], 'floor'));
  }
  faces.push(quad([-2, -2, 0.01], [2, -2, 0.01], [2, 2, 0.01], [-2, 2, 0.01], G.pad, 'pad'));
  signs.push(label('start', [0, 0, 2.2], `${m.game}: the start`));

  // THE RANGE: the foe at each band, distance posts, a backstop of concrete
  const dummies = [];
  const gun = Object.entries(m.slots).find(([, s]) => !s.skipped);
  [[5, -2.5], [15, 0], [30, 2.5]].forEach(([d, y], k) => {
    dummies.push({ id: `dummy-${d}`, at: [d, y, 0] });
    const t = gun?.[1].ttk?.[d];
    signs.push(label(`band-${d}`, [d, y, 2.4], `${d} m${t ? ` · ${gun[0]}: ${t.still.rounds} rds still, ${t.moving.rounds} moving` : ''}`));
  });
  for (let d = 5; d <= 30; d += 5) put(box(d - 0.05, -4.05, d + 0.05, -3.95, 0.4, G.post, 'post'));
  put(box(34, -6, 34.5, 6, 3, WALL_FILL.concrete, 'backstop'));

  // THE WALL YARD: five walls 10 m off to the right, each its own matter
  const walls = [];
  const MATTER = ['brick', 'concrete', 'pine', 'sheet-metal', 'steel'];
  MATTER.forEach((mt, k) => {
    const y0 = -9 - k * 2.4, c = put(box(10, y0 - 1.6, 10.3, y0, 2.5, WALL_FILL[mt], `wall:${mt}`));
    walls.push({ min: c.min, max: c.max, matter: mt });
    const W = gun?.[1].walls?.[mt];
    signs.push(label(`wall-${mt}`, [10, y0 - 0.8, 2.9], `${mt}${W ? `: ${W.kinds.join('/') || '–'} ${W.cm} cm` : ''}`));
  });
  faces.push(quad([0, -21, 0.012], [0.15, -21, 0.012], [0.15, -7, 0.012], [0, -7, 0.012], G.post, 'line'));   // the yard's firing line

  // THE LANE: along +x on the left (+y), each station its green and red side by side
  const M = m.mobility, Y = 9, step = rule.step ?? 0.35;
  // the run's strip: let go at the line (x 8), the stop box the measured stop long past it
  faces.push(quad([8, Y - 1, 0.012], [8.12, Y - 1, 0.012], [8.12, Y + 1, 0.012], [8, Y + 1, 0.012], G.post, 'line'));
  if (typeof M.stop.m === 'number') faces.push(quad([8.12, Y - 1, 0.011], [8.12 + Math.max(0.05, M.stop.m), Y - 1, 0.011], [8.12 + Math.max(0.05, M.stop.m), Y + 1, 0.011], [8.12, Y + 1, 0.011], G.yes, 'stop'));
  signs.push(label('run', [8, Y, 1.6], `run ${M.top} m/s, there in ${M.toTop} s · let go here: stops in ${M.stop.m ?? '–'} m`));
  stations.push({ id: 'stop', kind: 'stop', line: 8, y: Y, meant: 'made', want: M.stop.m });
  // the step: a rise inside the rule's step (made) and one over it (not)
  const sx = 14, rises = [[r2(step - 0.07), 'made', Y - 1.2], [r2(step + 0.12), 'not', Y + 1.2]];
  for (const [h, meant, y] of rises) { put(box(sx, y - 0.9, sx + 2, y + 0.9, h, meant === 'made' ? G.yes : G.no, `step:${meant}`)); stations.push({ id: `step-${meant}`, kind: 'climb', x: sx, y, h, meant, how: 'walk' }); }
  signs.push(label('step', [sx + 1, Y, 1.4], `step ${r2(step)} m: ${rises[0][0]} m goes, ${rises[1][0]} m does not`));
  if (M.jump) {
    // the ledge: just under what the jump reaches (its height plus the step the rule takes in the air: made) and over it
    const lx = 20, J = M.jump.height, reach = R?.ledge ?? M.jump.reach ?? J, ledges = [[r2(reach - 0.1), 'made', Y - 1.2], [r2(reach + 0.15), 'not', Y + 1.2]];
    for (const [h, meant, y] of ledges) { put(box(lx, y - 0.9, lx + 2, y + 0.9, h, meant === 'made' ? G.yes : G.no, `ledge:${meant}`)); stations.push({ id: `ledge-${meant}`, kind: 'climb', x: lx, y, h, meant, how: 'jump' }); }
    signs.push(label('ledge', [lx + 1, Y, Math.max(reach + 0.6, 1.4)], `jump ${J} m high, a ledge of ${reach} m reached: ${ledges[0][0]} m goes, ${ledges[1][0]} m does not`));
    // the gap: two platforms a stair up, the measured jump's length short of it (made) and past it (not)
    if (typeof M.jump.long === 'number') {
      // (short of its length: made; past where the arc catches a lip a step down: not)
      const P = R?.platform ?? r2(Math.min(0.9, step * 2.4)), gx = 27, far = R?.gap ?? M.jump.catch ?? M.jump.long, gaps = [[r2(Math.max(0.4, far - 0.35)), 'made', Y - 1.2], [r2(far + 0.35), 'not', Y + 1.2]];
      for (const [g, meant, y] of gaps) {
        // a stair up to the first platform (risers within the step), the platform, the gap, the far platform
        const n = Math.ceil(P / (step * 0.8)), rise = P / n;
        for (let k = 0; k < n; k++) put(box(gx - (n - k) * 0.5, y - 0.9, gx - (n - k - 1) * 0.5, y + 0.9, rise * (k + 1), G.block, 'stair'));
        put(box(gx, y - 0.9, gx + 3, y + 0.9, P, G.block, 'from'));
        put(box(gx + 3 + g, y - 0.9, gx + 6 + g, y + 0.9, P, meant === 'made' ? G.yes : G.no, `gap:${meant}`));
        stations.push({ id: `gap-${meant}`, kind: 'gap', lip: gx + 3, far: gx + 3 + g, y, h: P, g, meant });
      }
      signs.push(label('gap', [gx + 4, Y, 1.8], `jump ${M.jump.long} m long, a gap of ${far} m crossed: ${gaps[0][0]} m goes, ${gaps[1][0]} m does not`));
    }
  } else signs.push(label('nojump', [22, Y, 1.4], 'no jump: this rule does not leave the floor'));
  // cover: half (1 m, the head shows) and full (1.8 m)
  const cx = 42;
  put(box(cx, Y - 2, cx + 0.3, Y - 0.2, 1.0, G.block, 'cover:half'));
  put(box(cx, Y + 0.2, cx + 0.3, Y + 2, 1.8, G.block, 'cover:full'));
  signs.push(label('cover', [cx, Y, 2.3], 'cover: half 1 m, full 1.8 m (no crouch: the half shows the head)'));
  return { faces, colliders, signs, walls, dummies, spawn: [0, 0, 0], stations };
}

// ── the gym's own gate: the game's rule driven at each station on the gym's colliders ─────────────────────────────────
// the floor the page finds (channels/controllable __ground: the nearest surface straight below the probe), from the
// gym's boxes: the highest top under (x, y) at or below the probe, else the floor
const groundOf = (colliders) => (p) => {
  let best = p[2] + 0.05 >= 0 ? 0 : null;
  for (const c of colliders) if (p[0] >= c.min[0] && p[0] <= c.max[0] && p[1] >= c.min[1] && p[1] <= c.max[1] && c.max[2] <= p[2] + 0.05 && (best === null || c.max[2] > best)) best = c.max[2];
  return best;
};
function station(pilot, colliders, S) {
  const flat = { ground: groundOf(colliders) };
  const z0 = pilot.rule.eye ?? (pilot.rule.type === 'walk' ? 1.7 : 0);
  const fresh = (at) => {
    const w = E.createWorld({ entities: [{ ...JSON.parse(JSON.stringify(pilot)), id: 'p', pilotable: true, transform: { pos: at, heading: 0, pitch: 0 } }], colliders });
    for (let i = 0; i < 10; i++) E.stepWorld(w, {}, DT, flat);
    return { w, e: w.byId.p };
  };
  if (S.kind === 'stop') {
    // run to the line, let go there: where it comes to rest past the line
    const { w, e } = fresh([0, S.y, z0]);
    for (let f = 0; f < 600 && e.transform.pos[0] < S.line; f++) E.stepWorld(w, { forward: 1 }, DT, flat);
    for (let k = 0; k < 240; k++) E.stepWorld(w, {}, DT, flat);
    const past = r2(e.transform.pos[0] - S.line);
    return { made: S.want == null ? null : Math.abs(past - S.want) <= 0.15, saw: `${past} m past the line (the stop box ${S.want} m)` };
  }
  // one try: run at it from 4 m off (from the far end of the first platform, for a gap), the jump pressed `press` m before
  // the edge (a walk presses nothing); read over the far block's middle, or once the body is down
  const edge = S.kind === 'gap' ? S.lip : S.x, goal = S.kind === 'gap' ? S.far : S.x, top = S.h;
  const attempt = (press) => {
    const { w, e } = fresh(S.kind === 'gap' ? [S.lip - 2.8, S.y, z0 + S.h] : [S.x - 4, S.y, z0]);
    let jumped = press === null;
    for (let f = 0; f < 400 && e.transform.pos[0] < goal + 1; f++) {
      const go = !jumped && e.transform.pos[0] >= edge - press;
      if (go) jumped = true;
      E.stepWorld(w, { forward: 1, ...(go ? { jump: true, jumpHeld: true } : jumped && press !== null ? { jumpHeld: true } : {}) }, DT, flat);
      if (S.kind === 'gap' && jumped && e.grounded && e.transform.pos[2] - z0 < top - 0.05) break;   // down in the gap
    }
    for (let k = 0; k < 20; k++) E.stepWorld(w, {}, DT, flat);
    const x = e.transform.pos[0], z = e.transform.pos[2] - z0;
    return { made: x > goal + 0.2 && z >= top - 0.06, x: r2(x - goal), z: r2(z), press };
  };
  // a walk tries once; a jump at every press from the edge to 3 m before it (the best a player's timing can do)
  const tries = S.how === 'walk' ? [attempt(null)] : Array.from({ length: 31 }, (_, k) => attempt(r2(k * 0.1)));
  const best = tries.find((t) => t.made) ?? tries.reduce((a, b) => (b.z > a.z || (b.z === a.z && b.x > a.x) ? b : a));
  return {
    made: best.made,
    saw: best.made ? `${S.kind === 'gap' ? 'across' : 'on top'}${best.press !== null ? ` (pressed ${best.press} m before the edge)` : ''}` : `not at any press (best: ${best.z} m up, ${best.x} m from the far side)`,
  };
}
function gymGate(pilot, gym) {
  return gym.stations.map((S) => {
    const r = station(pilot, gym.colliders, S);
    const ok = r.made === null ? null : S.meant === 'made' ? r.made : !r.made;
    return { id: S.id, meant: S.meant, ok, saw: r.saw };
  });
}

// ── the reach on boxes: the highest ledge and the widest gap the game's rule makes at its best timing ─────────────────
// (on the runtime's own boxes, as the page plays them: the step it takes in the air and a gather finished off a lip are
// the game's; the flat-floor jump of measure.mjs is a measure of the arc alone)
function reachOnBoxes(pilot, M) {
  const step = pilot.rule.step ?? 0.35, Y = 0;
  const ledge = (h) => [{ min: [6, Y - 0.9, 0], max: [8, Y + 0.9, h] }];
  const P = r2(Math.min(0.9, step * 2.4));
  const gap = (g) => [{ min: [-2, Y - 0.9, 0], max: [3, Y + 0.9, P] }, { min: [3 + g, Y - 0.9, 0], max: [6 + g, Y + 0.9, P] }];
  const climbs = (h) => station(pilot, ledge(h), { kind: 'climb', x: 6, y: Y, h, how: 'jump' }).made;
  const crosses = (g) => station(pilot, gap(g), { kind: 'gap', lip: 3, far: 3 + g, y: Y, h: P }).made;
  const bisect = (ok, lo, hi) => { if (!ok(lo)) return null; for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; } return r2(lo); };
  return M.jump ? { ledge: bisect(climbs, step + 0.02, 4), gap: bisect(crosses, 0.3, 9), platform: P } : null;
}

// ── the page: the game's own player, camera and figures over the gym ──────────────────────────────────────────────────
const SHOULDER = { rule: 'follow', dist: 2.8, height: 1.8, lookH: 1.55, lead: 10, shoulder: 0.75, lerp: 16, pitchFollow: 1 };
function otherCamera(own, pilot) {
  if (own?.rule === 'eye') return pilot.body?.type === 'figure-rig' ? { cam: { ...SHOULDER, target: pilot.id }, rule: {}, name: 'shoulder' } : null;
  return { cam: { rule: 'eye', target: pilot.id, height: 1.6, mouseLook: true, hideTarget: true }, rule: { turnMode: 'look', lookPitch: true }, name: 'eye' };
}
function readout(m, gate) {
  const M = m.mobility, A = m.asked, lines = [];
  lines.push(`rule ${m.rule} · run ${M.top} m/s in ${M.toTop} s · stop ${M.stop.s} s, ${M.stop.m ?? '–'} m · strafe reversed in ${M.strafe?.reverse ?? '–'} s`);
  if (A) lines.push(`the card (${A.template}): walk ${A.ground.walk} · run ${A.ground.run} · sprint ${A.ground.sprint} · jump ${A.jump} m`);
  for (const [k, s] of Object.entries(m.slots)) if (!s.skipped) lines.push(`${k}: cone ${s.cone.first}° · ${s.cone.moving}° moving · ${s.cone.aimed}° aimed · reload ${s.reload.asked} s`);
  if (m.switching) lines.push(`switch: ${Object.entries(m.switching).map(([k, v]) => `${k} ${v.s} s`).join(' · ')}`);
  lines.push(`the gym's gate: ${gate.filter((g) => g.ok).length} of ${gate.filter((g) => g.ok !== null).length} stations as meant`);
  const fails = m.laws.filter((l) => !l.ok).map((l) => l.name);
  if (fails.length) lines.push(`laws failing: ${fails.slice(0, 4).join('; ')}${fails.length > 4 ? ` (+${fails.length - 4})` : ''}`);
  return lines;
}
function page(minted, m, gym, gate, { cam = null, extraRule = {}, tag = '' } = {}) {
  const { pilot, foe, payload } = minted;
  const P = { ...JSON.parse(JSON.stringify(pilot)), rule: { ...pilot.rule, ...extraRule }, transform: { pos: [gym.spawn[0], gym.spawn[1], gym.spawn[2] + (pilot.rule.eye ?? 0)], heading: 0, pitch: 0 } };
  const foeFig = foe?.body?.figure;
  const dummies = gym.dummies.map((d) => ({ id: d.id, rule: { type: 'static' }, body: { ...(foe?.body ?? { type: 'none' }), hittable: true }, transform: { pos: d.at, heading: Math.PI } }));
  const figures = Object.fromEntries(Object.entries(payload.figures ?? {}).filter(([k]) => k === pilot.body?.figure || k === foeFig));
  const legend = (payload.events?.hud ?? []).filter((h) => h.text);
  const signs = [...gym.signs, { id: 'readout', variant: 'popup', anchor: { kind: 'slot', slot: 'top-right' }, text: `the gym · ${m.game}${tag ? ` · ${tag}` : ''}`, body: readout(m, gate), pageLines: 8, chrome: { ...CHROME, fontSize: 11, padding: '6px 8px' } }];
  return emitThreeWorld({
    faces: gym.faces, colliders: gym.colliders, entities: [P, ...dummies], figures, camera: cam ?? payload.camera,
    events: { hud: legend.map((h) => ({ ...h, ttl: 30 })) }, signs,
    rupa: { scars: readScarsSpec({ ground: 'loam', wall: 'concrete', walls: gym.walls }) },
    match: { killTarget: 9999, respawnDelay: 1.5 },
    sky: payload.sky ?? { zenith: [120, 140, 170], horizon: [200, 205, 210], day: 1, stars: 0, seed: 1 }, bg: payload.bg ?? '#9aa0a8',
    ...(payload.lightTier ? { lightTier: payload.lightTier } : {}), ...(payload.shadows ? { shadows: payload.shadows } : {}),
    viewBox: { width: 1120, height: 700 }, title: `gym · ${m.game}${tag ? ` · ${tag}` : ''}`, inline: true,
  });
}

// ── the page, driven: its own runtime stepped frame by frame in headless Chromium ─────────────────────────────────────
// (the aim set on the body; over the shoulder a round goes to the camera's crosshair, `converge`, which a script that
// turns the body does not move, so the check aims the body's own line: the gun and the dummy are tested, not the camera)
const DRIVE = `
  const C = window.__mojCtrl, w = C.world, e = Object.values(w.byId).find((x) => x.pilotable);
  const drive = (n, input) => { for (let i = 0; i < n; i++) C.step(1 / 60, typeof input === 'function' ? input(i) : input); };
  const face = (x, y, z) => { const d = [x - e.transform.pos[0], y - e.transform.pos[1]]; e.transform.heading = Math.atan2(d[1], d[0]); e.transform.pitch = Math.atan2(z - e.transform.pos[2] - (e.weapon?.eye ?? 0), Math.hypot(d[0], d[1])); };
  for (const W of e.loadoutWeapons ?? [e.weapon]) if (W) W.converge = false;
  const out = {};
  const z0 = e.transform.pos[2];
  // (the trigger as a player works it, an automatic held and a semi pulled; a full magazine before each target)
  const pull = (i) => ({ fire: e.weapon && e.weapon.auto ? true : i % 2 === 0 });
  const full = () => { const W = e.weapon; if (W) { W.ammo = W.magazine; W.reloading = false; W.reloadT = 0; } };
  full(); face(15, 0, 1.2); drive(240, pull);
  out.drops = w.match?.feed?.length ?? 0;
  out.walls = {};
  for (const q of WALLS) {
    const y = (q.min[1] + q.max[1]) / 2, before = w.rupa.scars.marks.length;
    full(); face(q.min[0], y, 1.3); drive(60, pull);
    const mine = w.rupa.scars.marks.filter((m) => m.at[1] >= q.min[1] - 0.01 && m.at[1] <= q.max[1] + 0.01 && Math.abs(m.at[0] - q.min[0]) < 0.05);
    out.walls[q.matter] = [...new Set(mine.map((m) => m.kind))].join('/') || 'none';
  }
  out.steps = {};
  for (const S of STEPS) {
    e.transform.pos = [S.x - 3, S.y, z0]; e.transform.heading = 0; e.transform.pitch = 0; e.vel = [0, 0, 0];
    drive(20, {}); let f = 0; for (; f < 240 && e.transform.pos[0] < S.x + 1; f++) drive(1, { forward: 1 }); drive(20, {});
    out.steps[S.meant] = e.transform.pos[0] > S.x + 0.2 && e.transform.pos[2] - z0 >= S.h - 0.06;
  }
  return out;`;
async function checkPage(browser, file, gym) {
  const page = await browser.newPage({ viewport: { width: 1120, height: 700 } }), errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  await page.goto('file://' + path.resolve(file));
  await page.waitForFunction(() => !!window.__mojCtrl, null, { timeout: 120000 });
  const STEPS = gym.stations.filter((S) => S.kind === 'climb' && S.how === 'walk');
  const got = await page.evaluate(`(() => { const WALLS = ${JSON.stringify(gym.walls)}, STEPS = ${JSON.stringify(STEPS)};${DRIVE} })()`);
  await page.close();
  const kind = (mt) => (mt === 'steel' || mt === 'sheet-metal' ? 'dent' : 'chip');
  return [
    { name: 'loads without a page error', ok: errors.length === 0, info: errors.slice(0, 2) },
    { name: 'a round drops the 15 m dummy (the match counts it)', ok: got.drops >= 1, info: { drops: got.drops } },
    { name: 'each wall takes its own matter\'s mark', ok: Object.entries(got.walls).every(([mt, k]) => k === kind(mt)), info: got.walls },
    { name: 'the green step is climbed, the red one is not', ok: got.steps.made === true && got.steps.not === false, info: got.steps },
  ];
}

// ── the command line ─────────────────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2), out = args.shift();
if (!out) { console.error('usage: gym.mjs <out-dir> [game …] [--quick json] [--camera own|other|both]'); process.exit(2); }
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const quickArg = opt('--quick'), camArg = opt('--camera') ?? 'both';
const ci = args.indexOf('--check'), check = ci >= 0; if (check) args.splice(ci, 1);
let browser = null;
if (check) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
const report = async (file, gym) => { if (!browser) return; for (const l of await checkPage(browser, file, gym)) console.log(`   ${l.ok ? 'PASS' : 'FAIL'} page ${path.basename(file)}: ${l.name}  ${JSON.stringify(l.info)}`); };
const chosen = quickArg ? { mine: { says: 'a recipe of your own', quick: JSON.parse(quickArg) } } : Object.fromEntries((args.length ? args : ['conscription-hero', 'infinity-crisis', 'cogs-of-combat', 'steel-serpents']).map((k) => { if (!GAMES[k]) throw new Error(`no game '${k}'`); return [k, GAMES[k]]; }));
mkdirSync(out, { recursive: true });
for (const [name, Gm] of Object.entries(chosen)) {
  const minted = await mint(name, Gm.quick), m = await measureGame(name, Gm, minted);
  m.laws = laws(m);
  const R = reachOnBoxes(minted.pilot, m.mobility);
  m.reach = R;
  const gym = layGym(m, minted.pilot.rule, R), gate = gymGate(minted.pilot, gym);
  console.log(`\n━━ ${name}: the gym`);
  const J = m.mobility.jump;
  if (R) console.log(`   reach on boxes  a ledge of ${R.ledge} m (the jump ${J.height} m, plus the step ${minted.pilot.rule.step ?? 0.35} m: ${J.reach} m) · a gap of ${R.gap} m (the arc ${J.long} m, ${J.catch} m to a lip a step down)`);
  for (const g of gate) console.log(`   ${g.ok === null ? '  · ' : g.ok ? 'PASS' : 'FAIL'} ${g.id} (meant ${g.meant === 'made' ? 'to be made' : 'not to be'}): ${g.saw}`);
  if (camArg !== 'other') { const f = `${out}/${name}.html`; writeFileSync(f, page(minted, m, gym, gate, { tag: 'its own camera' })); console.log(`   wrote ${f}`); await report(f, gym); }
  const O = camArg === 'own' ? null : otherCamera(minted.payload.camera, minted.pilot);
  if (O) { const f = `${out}/${name}-${O.name}.html`; writeFileSync(f, page(minted, m, gym, gate, { cam: O.cam, extraRule: O.rule, tag: `seen from the ${O.name}` })); console.log(`   wrote ${f}`); await report(f, gym); }
}
if (browser) await browser.close();
process.exit(0);
