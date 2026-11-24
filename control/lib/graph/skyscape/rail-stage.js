/**
 * THE RAIL STAGE — an arcade flight stage laid down a path through an airspace: what Wolf Squadron's stages are made of.
 * The craft rides the path (worlds/controllable/rules-rail.js) steering about it in a box; along the path stand its
 * hazards, its waves are woken as the craft passes their marks, and at its end, where the path stops, its boss waits.
 *
 *   ground   a canyon (map.js `canyon`: a corridor between walls along x): the path down its floor at a skim over the
 *            ground, weaving gently; the craft's box narrower than the floor, so the walls frame the way and are never
 *            reached; the ground is a FLOOR (the rule's `floor`), never a crash. Its hazards: rock pillars and arches
 *            standing in the way, met at the craft's height
 *   space    a field of rocks (space.js): the path woven through it, the rocks kept off its line (`keep`) and crowding
 *            round it; a few let into the box as the hazards to dodge
 *
 *   planRailStage(map, field, { seed?, speed?, waves?, per?, plan? }) → {   (`plan`: a stage designed whole,
 *                                campaign/stage.js: its waves at their marks in their formations, each its craft, its
 *                                ground units, its hazards' spacing, its boss's guns and armour, its score; readRailPlan
 *                                says each fault)
 *     path       [[x, y, z], …]  the way, from its start to the boss's arena
 *     length     metres
 *     rule       the rail rule's settings (worlds/controllable/rules-rail.js): path, speed, box, floor?, sway, boost, roll
 *     hazards    [{ id, at, radius, size? }]   what stands in the way (a pillar, an arch's span, a rock let in)
 *     waves      [{ along, foes: [ids] }]      woken when the craft's `along` passes each mark
 *     foes       [{ id, at, wave, station }]   each fighter's post, ahead of its mark (it is woken there and comes in),
 *                                               and its station once woken (rules-rail.js): held ahead of the craft at its
 *                                               place in the box, weaving, until it peels off
 *     units?     [{ id, kind, group, at, heading }]   a design's ground units (groundforce/: a gun emplacement, a hover
 *                                               tank, a walker) beside a ground way from each group's mark, on alternate
 *                                               sides across the box, on the ground or a roof, facing back up the way
 *     boss       { at, parts: [{ id, at, size, hp }] }   at the path's end: a core and its guns, every part shot down wins
 *     score?     a design's points and medals (its plan's), carried to the stage's goal (flight-goal.js)
 *     laws       [{ law, ok, note }]           the path clears the ground by its floor; the hazards leave a way past each;
 *                                               down a gorge (ground.js), its walls stand over the way
 *   }
 *   railPath(map, ground, { seed?, speed? }) → the way alone (a space stage's laid before its rocks)
 *   railKeep(path)         → the tubes a space stage's rocks are kept out of
 *   railPathFrame(path, s) → { p, t }   the point and the unit tangent at `s` metres along (the rule's frame, for placing)
 *
 * Pure and deterministic: the same map and seed, the same stage.
 */
import * as dmath from '../../util/dmath.js';
import { hashSeed } from '../polygonizer/landform.js';

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A stage's numbers, in seconds at the stage's speed where they are about time. */
export const RAIL = Object.freeze({
  speedOfCruise: 0.6,        // the stage's speed: this share of the craft's cruise
  skim: 45,                  // m over the ground the way runs at (a ground stage)
  floor: 14,                 // m: the lowest the craft goes over the ground
  box: Object.freeze({ hx: 90, hz: 45 }),
  stepS: 2,                  // a path point every this many seconds
  waveS: 9,                  // a wave every this many seconds of the way
  leadS: 3.5,                // a wave's fighters posted this many seconds ahead of its mark
  stationS: 2.5,             // woken, a fighter holds this many seconds ahead of the craft (rules-rail.js station),
  stationMin: 250,           // and never nearer than this (m): far enough to be brought onto the guns
  stayS: 12,                 // and peels off after this many seconds on station
  hazardS: 4,                // a hazard every this many seconds of the way, between the waves
  arenaS: 6,                 // the path's last stretch, the boss's arena, this many seconds long
  minS: 70,                  // the shortest stage (s at its speed)
  bossHp: Object.freeze({ core: 24, gun: 8 }),
  // (a design's plan: its formations, and a heavy boss's armour over a light one's)
  formations: Object.freeze(['line', 'vee', 'echelon', 'swarm']),
  heavy: 1.6,
  // (the ground force's units a design stands beside a ground way: groundforce/; this far apart along it (s of the way),
  // this share of the box across it, never on its line)
  units: Object.freeze(['turret', 'tank', 'walker']), unitS: 1.1, unitAcross: Object.freeze([0.35, 0.8]),
  // (an arcade chase: close behind and a little above the craft, looking well down the way, so the craft is large in the
  // frame and what comes at it is seen: the follow rule's dist, height, lead and lookH, metres)
  camera: Object.freeze({ dist: 30, height: 7, lead: 60, lookH: 2 }),
});

function rng(seed) {
  let s = hashSeed(`rail::${seed}`) || 1;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The point and the unit tangent `s` metres along a path. */
export function railPathFrame(P, s) {
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    if (acc + L >= s || i === P.length - 1) {
      const f = clamp((s - acc) / L, 0, 1);
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L] };
    }
    acc += L;
  }
  return { p: P[P.length - 1].slice(), t: [1, 0, 0] };
}
const lengthOf = (P) => { let L = 0; for (let i = 1; i < P.length; i++) L += dmath.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L; };

/** The way alone: down a canyon's floor at a skim over its ground (`ground`: (x, y) → its height), weaving a little
 *  across (down its gorge's line, `line`: x → y, where the ground has one: ground.js); or through a field of rocks,
 *  weaving in all three (a space map's: no ground, so it can be laid before the rocks are, and the rocks kept off it:
 *  airspace.js). → [[x, y, z], …] */
export function railPath(map, ground, { seed = 1, speed, line = null, topIn = null } = {}) {
  const c = map.craft, F = map.rings.field, space = map.form === 'void', R = rng(seed);
  const v = speed ?? c.cruise * RAIL.speedOfCruise, step = v * RAIL.stepS;
  const span = 2 * F.hx * 0.9, n = Math.max(4, Math.ceil(span / step)), x0 = -F.hx * 0.9;
  const raw = [];
  const wy = space ? F.hy * 0.25 : F.hy * 0.04, wz = space ? (F.hz ?? 400) * 0.2 : 0, ph = R() * 6.28, ph2 = R() * 6.28;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (span * i) / n, y = line ? line(x) : wy * Math.sin(ph + (i / n) * 5.2);
    let z;
    if (space) z = wz * Math.sin(ph2 + (i / n) * 4.1);
    else {
      let top = -Infinity; for (const dy of [-RAIL.box.hx, 0, RAIL.box.hx]) for (const dx of [-step / 2, 0, step / 2]) top = Math.max(top, ground(x + dx, y + dy));
      // (the buildings in the box's sweep, whatever their size: `topIn`, the ground's roofs; a spire is not missed)
      if (topIn) top = Math.max(top, topIn(x - step / 2, y - RAIL.box.hx, x + step / 2, y + RAIL.box.hx));
      z = top + RAIL.skim;
    }
    raw.push([x, y, z]);
  }
  // (a ground way smoothed so it never dips between its samples: each point the most of itself and its neighbours')
  return raw.map((p, i) => [r2(p[0]), r2(p[1]), r2(space ? p[2] : Math.max(p[2], raw[i - 1]?.[2] ?? p[2], raw[i + 1]?.[2] ?? p[2]))]);
}

/** The tubes a space stage's rocks are kept out of: its way's legs, the box's breadth about them (space.js `keep`). */
export const railKeep = (path) => path.slice(1).map((b, i) => [path[i], b, RAIL.box.hx]);

/** A stage's design as its rail lays it (`rail.plan`, campaign/stage.js compileStage): errors[] (teaching).
 *   plan = { waves?: [{ at: share of the way, count: 1–6, formation?: line | vee | echelon | swarm }], hazards?: s between
 *            (0: none), boss?: { guns?: 1–6, armour?: light | heavy }, score?: { fighter, gun, core, medals: [g, s, b] } } */
export function readRailPlan(P, at = 'airspace.rail.plan') {
  const e = [], isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(P)) return [`${at} is { waves?, ground?, hazards?, boss?, score? }: a stage's design as its rail lays it`];
  for (const k of Object.keys(P)) if (!['waves', 'ground', 'hazards', 'boss', 'score'].includes(k)) e.push(`${at}.${k} is not a stage plan's (waves, ground, hazards, boss, score)`);
  if (P.waves !== undefined && Array.isArray(P.waves) && P.waves.some((w) => isObj(w) && w.craft !== undefined && (typeof w.craft !== 'string' || !w.craft))) e.push(`${at}.waves[].craft is a craft of the shelf (its fighters' ship)`);
  if (P.ground !== undefined && !(Array.isArray(P.ground) && P.ground.length <= 10 && P.ground.every((g) => isObj(g) && RAIL.units.includes(g.kind) && Number.isInteger(g.count) && g.count >= 1 && g.count <= 6 && Number.isFinite(g.at) && g.at > 0 && g.at < 1))) e.push(`${at}.ground is up to 10 { kind: ${RAIL.units.join(' | ')}, count: 1–6, at: 0–1 }: units on the ground beside the way`);
  if (P.waves !== undefined && !(Array.isArray(P.waves) && P.waves.length <= 8 && P.waves.every((w, i) => isObj(w) && Number.isFinite(w.at) && w.at > 0 && w.at < 1 && Number.isInteger(w.count) && w.count >= 1 && w.count <= 6
    && (w.formation === undefined || RAIL.formations.includes(w.formation)) && (i === 0 || w.at > P.waves[i - 1].at)))) e.push(`${at}.waves are up to 8 { at: 0–1, count: 1–6, formation?: ${RAIL.formations.join(' | ')} }, in the order they come`);
  if (P.hazards !== undefined && !(Number.isFinite(P.hazards) && P.hazards >= 0 && P.hazards <= 20)) e.push(`${at}.hazards is the seconds of the way between hazards (0: none)`);
  if (P.boss !== undefined && !(isObj(P.boss) && (P.boss.guns === undefined || (Number.isInteger(P.boss.guns) && P.boss.guns >= 1 && P.boss.guns <= 6)) && (P.boss.armour === undefined || ['light', 'heavy'].includes(P.boss.armour)))) e.push(`${at}.boss is { guns?: 1–6, armour?: light | heavy }`);
  if (P.score !== undefined && !(isObj(P.score) && ['fighter', 'gun', 'core'].every((k) => Number.isFinite(P.score[k]) && P.score[k] > 0) && Array.isArray(P.score.medals) && P.score.medals.length === 3 && P.score.medals.every(Number.isFinite) && P.score.medals[0] >= P.score.medals[1] && P.score.medals[1] >= P.score.medals[2]
    && (P.score.ground === undefined || (isObj(P.score.ground) && Object.entries(P.score.ground).every(([k, v]) => RAIL.units.includes(k) && Number.isFinite(v) && v > 0))))) e.push(`${at}.score is { fighter, gun, core, ground?: { <unit>: points }, medals: [gold, silver, bronze] } (points; gold the most)`);
  return e;
}

export function planRailStage(map, field, { seed = 1, speed: speedAsk, waves: wavesAsk, per = 3, plan = null } = {}) {
  const c = map.craft, space = map.form === 'void', R = rng(`${seed}::stage`);
  if (!space && map.form !== 'canyon') throw new Error(`rail stage: a ground stage runs down a canyon (map.form 'canyon'), not ${map.form}; a space stage on a void map`);
  const speed = r2(speedAsk ?? c.cruise * RAIL.speedOfCruise), step = speed * RAIL.stepS, ground = (x, y) => (field.topAt ?? field.groundAt)(x, y);
  const path = railPath(map, ground, { seed, speed, line: field.gorge?.line ?? null, topIn: field.topIn ?? null });
  const length = lengthOf(path), seconds = length / speed;
  if (seconds < RAIL.minS) throw new Error(`rail stage: the way is ${Math.round(seconds)} s at its speed, under the ${RAIL.minS} s a stage needs (a larger map, or a slower stage)`);
  const rule = { type: 'rail', path, speed, box: { ...RAIL.box }, sway: r2(Math.max(28, speed * 0.45)), agility: 6, boost: { mul: 1.7, time: 3, recharge: 0.6 }, brake: { mul: 0.5 }, roll: { time: 0.6, side: 24, cooldown: 1.2 }, ...(space ? {} : { floor: RAIL.floor }) };
  // ── its waves: a mark every waveS s from a breath in to the arena, each wing posted ahead of its mark ──
  const arena = length - speed * RAIL.arenaS, marks = [];
  for (let s = speed * 5; s < arena - speed * RAIL.waveS * 0.5; s += speed * RAIL.waveS) marks.push(s);
  // (a design's plan says its own waves: each at its share of the way, its count, its formation; else a mark every waveS s)
  if (plan && plan.waves) { marks.length = 0; for (const pw of plan.waves) marks.push(Math.max(speed * 5, Math.min(arena - speed * 2, pw.at * length))); }
  const W = plan && plan.waves ? plan.waves.length : Math.min(marks.length, wavesAsk ?? marks.length), waves = [], foes = [];
  let k = 0;
  for (let w = 0; w < W; w++) {
    if (plan && plan.waves) { k = planWave(plan.waves[w], w, marks[w], { path, arena, speed, space, R, waves, foes, k }); continue; }
    const along = marks[w], ahead = railPathFrame(path, Math.min(arena, along + speed * RAIL.leadS)), ids = [];
    const hl = Math.hypot(ahead.t[0], ahead.t[1]) || 1, rx = ahead.t[1] / hl, ry = -ahead.t[0] / hl;
    for (let j = 0; j < per; j++) {
      const across = (j - (per - 1) / 2) * RAIL.box.hx * 0.6, up = (j % 2 ? 1 : -0.5) * RAIL.box.hz * 0.4;
      const id = `foe-${++k}`;
      ids.push(id);
      const z = up + (space ? 0 : 10);
      foes.push({ id, at: [r2(ahead.p[0] + rx * across), r2(ahead.p[1] + ry * across), r2(ahead.p[2] + z)], wave: w, station: { lead: r2(Math.max(RAIL.stationMin, speed * RAIL.stationS)), at: [r2(across), r2(z)], weave: [r2(RAIL.box.hx * 0.25), r2(RAIL.box.hz * 0.3), 5], phase: r2(j / per), stay: RAIL.stayS } });
    }
    waves.push({ along: r2(along), foes: ids });
  }
  // ── its hazards: between the waves, each a pillar (ground) or a rock let into the box (space), off the line by a
  // seeded share of the box, so there is always a way past it ──
  const hazards = [];
  const hzS = plan && plan.hazards !== undefined ? plan.hazards : RAIL.hazardS;
  for (let s = speed * 8, h = 0; hzS > 0 && s < arena - speed * 2; s += speed * hzS) {
    if (marks.some((m) => Math.abs(m - s) < speed * 1.5)) continue;
    // (never in a colony's stretch: its buildings are what stands in the way there)
    if (inColony(field, railPathFrame(path, s).p[0])) continue;
    const F2 = railPathFrame(path, s), hl = Math.hypot(F2.t[0], F2.t[1]) || 1, rx = F2.t[1] / hl, ry = -F2.t[0] / hl;
    const side = (R() < 0.5 ? -1 : 1) * (0.2 + 0.5 * R()) * RAIL.box.hx, radius = space ? r2(14 + 10 * R()) : r2(10 + 6 * R());
    const at = [r2(F2.p[0] + rx * side), r2(F2.p[1] + ry * side), r2(space ? F2.p[2] + (R() - 0.5) * RAIL.box.hz : F2.p[2])];
    // (a pillar stands from the ground to above the box: its hazard is met at any height of the way)
    hazards.push({ id: `hazard-${++h}`, at, radius, ...(space ? {} : { size: [radius * 2, radius * 2, r2(at[2] - ground(at[0], at[1]) + RAIL.box.hz + 20)], base: r2(ground(at[0], at[1])) }) });
  }
  // ── its ground units (a design's plan, a ground way only): each group from its mark on, a unit every unitS s, on
  // alternate sides across the box, standing on what is there (the ground, or a roof in a colony), facing back up the way ──
  const units = [];
  if (plan && plan.ground && !space) {
    const seq = {};
    plan.ground.forEach((g, gi) => {
      const s0 = Math.max(speed * 5, Math.min(arena - speed * 2, g.at * length));
      for (let j = 0; j < g.count; j++) {
        const s = Math.min(arena, s0 + j * speed * RAIL.unitS), F2 = railPathFrame(path, s), hl = Math.hypot(F2.t[0], F2.t[1]) || 1, rx = F2.t[1] / hl, ry = -F2.t[0] / hl;
        const side = j % 2 ? -1 : 1, across = side * RAIL.box.hx * (RAIL.unitAcross[0] + (RAIL.unitAcross[1] - RAIL.unitAcross[0]) * R());
        const x = F2.p[0] + rx * across, y = F2.p[1] + ry * across, top = field.topAt ? field.topAt(x, y) : ground(x, y);
        seq[g.kind] = (seq[g.kind] ?? 0) + 1;
        units.push({ id: `${g.kind}-${seq[g.kind]}`, kind: g.kind, group: gi, at: [r2(x), r2(y), r2(top)], heading: r2(Math.atan2(-F2.t[1], -F2.t[0])) });
      }
    });
  }
  // ── its boss: at the path's end, ahead of where the frame stops: a core and two guns ──
  const end = path[path.length - 1], last = railPathFrame(path, length), hl = Math.hypot(last.t[0], last.t[1]) || 1, ax = last.t[0] / hl, ay = last.t[1] / hl;
  const bAt = [r2(end[0] + ax * speed * 3), r2(end[1] + ay * speed * 3), r2(end[2] + (space ? 0 : 15))];
  const boss = plan && plan.boss ? planBoss(plan.boss, bAt, ax, ay) : {
    at: bAt,
    parts: [
      { id: 'boss-core', at: bAt, size: 26, hp: RAIL.bossHp.core },
      { id: 'boss-gun-1', at: [r2(bAt[0] - ay * 40), r2(bAt[1] + ax * 40), bAt[2]], size: 12, hp: RAIL.bossHp.gun },
      { id: 'boss-gun-2', at: [r2(bAt[0] + ay * 40), r2(bAt[1] - ax * 40), bAt[2]], size: 12, hp: RAIL.bossHp.gun },
    ],
  };
  // ── its laws ──
  const laws = [];
  if (!space) {
    let low = Infinity;
    for (let s = 0; s <= length; s += step / 4) { const q = railPathFrame(path, s).p; low = Math.min(low, q[2] - ground(q[0], q[1])); }
    laws.push({ law: 'skim', ok: low >= RAIL.floor - 1e-6, note: `the way runs ${r2(low)} m over the ground at its lowest (the floor is ${RAIL.floor})` });
  } else {
    const hit = field.hitAt ? path.some((q) => field.hitAt(q[0], q[1], q[2], 4)) : false;
    laws.push({ law: 'clear-line', ok: !hit, note: hit ? 'a rock stands on the way\'s line' : 'no rock stands on the way\'s line' });
  }
  const passable = hazards.every((z) => z.radius * 2 < RAIL.box.hx);
  laws.push({ law: 'a-way-past', ok: passable, note: passable ? 'each hazard leaves the box room to pass it' : 'a hazard fills the box' });
  // (down a gorge: its walls stand over the way on both sides all along it, the craft flown between them)
  if (field.gorge) {
    const G = field.gorge, off = G.half + G.slope;
    let worst = Infinity;
    // (a way in segments is walled in its canyon's stretches only, clear of their eased joins)
    const walledAt = (x) => !field.segments || field.segments.some((g) => g.kind === 'canyon' && x >= g.x0 + 600 && x <= g.x1 - 600);
    for (let s = 0; s <= length; s += step) { const q = railPathFrame(path, s).p; if (!walledAt(q[0])) continue; for (const d of [-off, off]) worst = Math.min(worst, ground(q[0], q[1] + d) - q[2]); }
    if (worst < Infinity) laws.push({ law: 'walled', ok: worst > 0, note: worst > 0 ? `the gorge's walls stand at least ${Math.round(worst)} m over the way on both sides${field.segments ? ' down its canyon' : ''}` : `a wall falls ${Math.round(-worst)} m under the way: the gorge is too shallow for its floor` });
  }
  laws.push({ law: 'length', ok: seconds >= RAIL.minS, note: `${Math.round(seconds)} s at ${Math.round(speed)} m/s, ${waves.length} waves, ${hazards.length} hazards` });
  return { path, length: r2(length), seconds: r2(seconds), rule, hazards, waves, foes, boss, laws, ...(units.length ? { units } : {}), ...(plan && plan.score ? { score: plan.score } : {}) };
}

// (a point down a way in segments is in a colony's stretch)
const inColony = (field, x) => !!field.segments && field.segments.some((g) => g.kind === 'colony' && x >= g.x0 && x <= g.x1);

// a design's wave (its plan's): its fighters posted ahead of its mark in its formation, each held on station there once
// woken: abreast (line), trailing back from its leader (vee), stepped back and up across the way (echelon), or loose and
// weaving wide (swarm). → the next fighter's number
function planWave(pw, w, along, { path, arena, speed, space, R, waves, foes, k }) {
  const ahead = railPathFrame(path, Math.min(arena, along + speed * RAIL.leadS)), ids = [];
  const hl = Math.hypot(ahead.t[0], ahead.t[1]) || 1, rx = ahead.t[1] / hl, ry = -ahead.t[0] / hl;
  const n = pw.count, f = pw.formation ?? 'line', mid = (n - 1) / 2, spread = n > 1 ? (RAIL.box.hx * 1.3) / (n - 1) : 0;
  const lead = Math.max(RAIL.stationMin, speed * RAIL.stationS);
  for (let j = 0; j < n; j++) {
    let across = (j - mid) * spread, up = (j % 2 ? 1 : -0.5) * RAIL.box.hz * 0.4, back = 0, wide = 0.25, phase = n ? j / n : 0;
    if (f === 'vee') { back = Math.abs(j - mid) * 45; up = RAIL.box.hz * 0.15; }
    else if (f === 'echelon') { back = j * 40; up = n > 1 ? (j / (n - 1) - 0.5) * RAIL.box.hz * 0.6 : 0; }
    else if (f === 'swarm') { across = (R() * 2 - 1) * RAIL.box.hx * 0.65; up = (R() * 2 - 1) * RAIL.box.hz * 0.45; back = R() * 80; wide = 0.4; phase = R(); }
    const id = `foe-${++k}`, z = up + (space ? 0 : 10);
    ids.push(id);
    foes.push({ id, at: [r2(ahead.p[0] + rx * across), r2(ahead.p[1] + ry * across), r2(ahead.p[2] + z)], wave: w, ...(pw.craft ? { craft: pw.craft } : {}),
      station: { lead: r2(lead + back), at: [r2(across), r2(z)], weave: [r2(RAIL.box.hx * wide), r2(RAIL.box.hz * 0.3), 5], phase: r2(phase), stay: RAIL.stayS } });
  }
  waves.push({ along: r2(along), foes: ids });
  return k;
}

// a design's boss (its plan's): its core, and its guns on a ring round it across the way; heavy armour takes more
function planBoss(B, at, ax, ay) {
  const n = B.guns ?? 2, mul = B.armour === 'heavy' ? RAIL.heavy : 1, parts = [{ id: 'boss-core', at, size: 26, hp: Math.round(RAIL.bossHp.core * mul) }];
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n, side = Math.cos(th) * 40, up = Math.sin(th) * 24;
    parts.push({ id: `boss-gun-${i + 1}`, at: [r2(at[0] - ay * side), r2(at[1] + ax * side), r2(at[2] + up)], size: 12, hp: Math.round(RAIL.bossHp.gun * mul) });
  }
  return { at, parts };
}
