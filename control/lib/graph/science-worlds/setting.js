/**
 * A science world stood in any world: the `science` world channel (world-scene.js grows it in every kind, as it
 * grows `structures`; compose_world takes it as `overrides.science`).
 *
 *   science = { kind: 'classical' | 'microscopic' | 'quantum' | 'relativistic', model, dress?, liberties?,
 *               at: [x, y, z], yaw?, ground?: 'from-world', setting?: 'earth' | 'moon' | 'mars', case? }
 *
 * The rule: a setting is dress. Anything a body touches is a law in the model, and the world never changes the
 * physics silently.
 *   - A classical demo drawn at one metre per unit stands 1:1 at `at` (z-up metres both). `ground: 'from-world'`
 *     makes the world's own surface under `at` a `plane` law at its height (the panel says so).
 *   - `scenery-clear` checks every body's recorded track against the world's faces near the demo, and advises
 *     where one passes through a surface no law covers.
 *   - `setting-agrees` compares the model's g with the setting's (the Moon's 1.62 m/s²), and a drag row with a
 *     setting that has no air.
 *   - Any other demo (a microscopic box, an orbital, an orbit round a black hole, a solar system drawn shrunk) is a
 *     BENCH PROP: drawn inside a glass case `case` metres across (default 1) at `at`, its true magnification on the
 *     panel. A light world fills the frame with its shader and cannot stand in a world.
 */

import { assembleClassicalScene, planClassicalWorld } from './classical/world.js';
import { assembleMicroscopicScene, planMicroscopicWorld } from './microscopic/world.js';
import { assembleQuantumScene, planQuantumWorld } from './quantum/world.js';
import { assembleRelativisticScene, planRelativisticWorld } from './relativistic/world.js';
import { quantity } from './contract.js';
import { G as G_PRESET } from '../machina/quantities.js';
import { scl, add, sub, dot, cross, len, isObj, sig, framing, bar, scaleLiberty } from './page.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const KEYS = ['kind', 'model', 'dress', 'liberties', 'at', 'yaw', 'ground', 'setting', 'case', 'title'];
const SCALES = {
  classical: { kind: 'classical-view', plan: planClassicalWorld, assemble: assembleClassicalScene },
  microscopic: { kind: 'microscopic-view', plan: planMicroscopicWorld, assemble: assembleMicroscopicScene },
  quantum: { kind: 'quantum-view', plan: planQuantumWorld, assemble: assembleQuantumScene },
  relativistic: { kind: 'relativistic-view', plan: planRelativisticWorld, assemble: assembleRelativisticScene },
};

/** The settings a world can name, with their surface gravity (machina/quantities G, NASA fact sheets) and air. */
export const SETTINGS = {
  earth: { g: G_PRESET.earth, air: true, source: 'standard gravity' },
  moon: { g: G_PRESET.moon, air: false, source: 'NASA Moon Fact Sheet' },
  mars: { g: G_PRESET.mars, air: 'thin', source: 'NASA Mars Fact Sheet (surface air about 1% of Earth\'s)' },
};
/** A theme pack's setting, for compose_world to stamp on a demo it places (a theme names where a world is). */
export const SETTING_OF_THEME = { 'mars-colony': 'mars' };
const DRAG = new Set(['drag-linear', 'drag-quadratic', 'air-resistance', 'buoyancy']);

/** The channel's spec, checked; the model itself is checked by its scale's solver when the demo is planned. */
export function readScienceSetting(spec, where = 'science') {
  if (!isObj(spec)) fail(where, `wants { kind, model, at, … } (kinds: ${Object.keys(SCALES).join(', ')})`);
  const extra = Object.keys(spec).filter((k) => !KEYS.includes(k));
  if (extra.length) fail(where, `unknown field '${extra[0]}' (it takes ${KEYS.join(', ')})`);
  if (!SCALES[spec.kind]) fail(`${where}.kind`, `is one of ${Object.keys(SCALES).join(', ')}`);
  if (!isObj(spec.model)) fail(`${where}.model`, `wants the ${spec.kind} model (get_view_vocab({ id: '${spec.kind}' }))`);
  if (spec.kind === 'relativistic' && spec.model.system === 'light') fail(`${where}.model`, 'a light world is drawn by a shader that fills the frame: it cannot stand in a world (an orbit or clocks world can)');
  if (!Array.isArray(spec.at) || spec.at.length !== 3) fail(`${where}.at`, 'wants [x, y, z] in the world (metres)');
  const at = spec.at.map((c, k) => quantity(c, 'length', `${where}.at[${k}]`));
  const yaw = spec.yaw === undefined ? 0 : quantity(spec.yaw, 'scalar', `${where}.yaw`);
  if (spec.ground !== undefined && spec.ground !== 'from-world') fail(`${where}.ground`, "is 'from-world' (the world's surface under the demo becomes a plane law)");
  if (spec.ground && spec.kind !== 'classical') fail(`${where}.ground`, 'is for a classical demo standing 1:1; a bench prop stands in its case');
  const setting = spec.setting ?? 'earth';
  if (!SETTINGS[setting]) fail(`${where}.setting`, `is one of ${Object.keys(SETTINGS).join(', ')}`);
  const caseSize = spec.case === undefined ? 1 : quantity(spec.case, 'length', `${where}.case`);
  if (!(caseSize >= 0.2 && caseSize <= 10)) fail(`${where}.case`, 'is a case 0.2 to 10 m across');
  return { kind: spec.kind, model: spec.model, dress: spec.dress, liberties: spec.liberties, title: spec.title, at, yaw, ground: spec.ground ?? null, setting, caseSize };
}

// ── the world's surfaces ──

// a face as triangles (a fan), each with its plane
const triangles = (f) => {
  const c = f.corners, out = [];
  for (let i = 1; i + 1 < c.length; i++) out.push([c[0], c[i], c[i + 1]]);
  return out;
};
const bboxOf = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);

/** The highest walkable surface of the world under (x, y), at or below z + 0.05 m: { z, face } or null. */
export function groundUnder(faces, [x, y, z]) {
  let best = null;
  for (const f of faces) {
    if (!f || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    for (const [a, b, c] of triangles(f)) {
      const n = cross(sub(b, a), sub(c, a)), nl = len(n);
      if (!(nl > 0) || Math.abs(n[2]) / nl < 0.7) continue;   // walkable: within ~45° of level
      // (x, y) inside the triangle's shadow on the ground (barycentric in xy)
      const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / d, v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / d;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
      const zh = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
      if (zh <= z + 0.05 && (!best || zh > best.z)) best = { z: zh, face: f };
    }
  }
  return best;
}

// a segment against a triangle (Möller–Trumbore): the fraction along the segment, or null
function segTri(p, q, [a, b, c]) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-14) return null;
  const f = 1 / det, s = sub(p, a), u = f * dot(s, h);
  if (u < 0 || u > 1) return null;
  const qv = cross(s, e1), v = f * dot(d, qv);
  if (v < 0 || u + v > 1) return null;
  const t = f * dot(e2, qv);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Where the bodies' tracks pass through the world's surfaces that no law covers. `tracks` are world points per body
 * (with their far-clock times), `covered(face)` says a face is a law of the model (the world's ground made a plane).
 */
export function sceneryCrossings(faces, tracks, covered) {
  const all = tracks.flatMap((tr) => tr.x);
  if (!all.length) return [];
  const box = bboxOf(all).map(([lo, hi]) => [lo - 0.05, hi + 0.05]);
  const near = faces.filter((f) => {
    if (!f || !Array.isArray(f.corners) || f.corners.length < 3 || covered(f)) return false;
    const b = bboxOf(f.corners);
    return b.every(([lo, hi], k) => hi >= box[k][0] && lo <= box[k][1]);
  });
  const hits = [];
  for (const tr of tracks) {
    let found = null;
    for (let i = 1; i < tr.x.length && !found; i++) {
      const p = tr.x[i - 1], q = tr.x[i];
      if (len(sub(q, p)) < 1e-9) continue;
      for (const f of near) {
        for (const tri of triangles(f)) {
          const t = segTri(p, q, tri);
          if (t !== null) { found = { body: tr.id, t: tr.t[i - 1] + t * (tr.t[i] - tr.t[i - 1]), at: add(p, scl(sub(q, p), t)).map((c) => sig(c, 4)), surface: f.material || f.fill || 'a surface' }; break; }
        }
        if (found) break;
      }
    }
    if (found) hits.push(found);
  }
  return hits;
}

// ── the placement ──

const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];

/** The setting's gates on the model: its gravity and its air, against where the demo stands. */
export function settingGates(spec, solvedModel) {
  if (spec.kind !== 'classical') return [];
  const S = SETTINGS[spec.setting], gates = [];
  const g0 = solvedModel.frame?.g ?? G_PRESET.earth;
  const gs = solvedModel.laws.filter((l) => l.law === 'gravity-uniform').map((l) => (l.g !== undefined ? l.g : g0));
  if (gs.length) {
    const worst = gs.reduce((w, g) => Math.max(w, Math.abs(g - S.g) / S.g), 0);
    gates.push({ id: 'setting-agrees', want: `the model's gravity is the setting's (${spec.setting}: ${sig(S.g, 3)} m/s², ${S.source})`, ok: worst <= 0.02,
      value: { expected: { g: sig(S.g, 4) }, measured: { g: sig(gs[0], 4) } }, detail: worst <= 0.02 ? 'the demo falls as things fall there' : 'the world says one place and the model another: set model.frame.g, or stand the demo elsewhere' });
  }
  const drag = solvedModel.laws.filter((l) => DRAG.has(l.law)).map((l) => l.law);
  if (drag.length && S.air === false) {
    gates.push({ id: 'setting-air', want: `nothing pushes through air where there is none (${spec.setting})`, ok: false, value: { laws: [...new Set(drag)] }, detail: `${spec.setting} has no air: drop the drag rows` });
  }
  return gates;
}

/**
 * A demo checked without its world (compose_world, at mint): its spec read, its model solved, the setting's gates
 * run. The world's own surfaces (the ground, scenery-clear) are checked when the world renders.
 */
export function checkScienceSetting(raw, where = 'science') {
  const spec = readScienceSetting(raw, where);
  const S = SCALES[spec.kind];
  const plan = S.plan({ kind: S.kind, model: spec.model, ...(spec.dress !== undefined ? { dress: spec.dress } : {}), ...(spec.liberties !== undefined ? { liberties: spec.liberties } : {}) });
  const gates = [...plan.solved.gates, ...settingGates(spec, plan.solved.model)];
  return { spec, gates: gates.map((g) => ({ id: g.id, ok: g.ok, want: g.want, value: g.value })), held: gates.every((g) => g.ok), standsAs: spec.kind === 'classical' && plan.scale === 1 ? '1:1' : 'bench prop' };
}

/**
 * Plan a demo for the world `payload`, and merge it in: its faces, bodies and readout, its camera first, its film,
 * and its gates on the page's panel. Returns { gates, notes } for the caller. Mutates `payload`.
 */
export function placeScience(payload, raw, { where = 'science' } = {}) {
  const spec = readScienceSetting(raw, where);
  const S = SCALES[spec.kind];
  const worldFaces = Array.isArray(payload.faces) ? payload.faces : [];
  const extraLiberties = [], assumptions = [];
  let model = spec.model, ground = null;
  if (spec.ground) {
    ground = groundUnder(worldFaces, spec.at);
    if (!ground) fail(`${where}.ground`, `no surface of the world lies under (${spec.at.slice(0, 2).map((c) => sig(c, 4)).join(', ')}): move the demo over the ground, or give the model its own plane`);
    const floors = (model.laws || []).filter((l) => l && l.law === 'plane' && l.normal === undefined && l.tilt === undefined);
    if (floors.length) fail(`${where}.ground`, "the model has its own floor: drop it, or drop ground: 'from-world'");
    model = { ...model, laws: [...model.laws, { law: 'plane', point: [0, 0, ground.z - spec.at[2]] }] };
    assumptions.push(`The ground is the world's own surface under the demo (${ground.face.material || ground.face.fill || 'its ground'}), taken as a flat plane at ${sig(ground.z, 4)} m; its slope and edges beyond the demo are not in the model.`);
  }
  const manifest = { kind: S.kind, model, ...(spec.dress !== undefined ? { dress: spec.dress } : {}), liberties: [...(spec.liberties || [])] };
  // plan once: the drawing scale decides how the demo stands, and the placement's own liberties join the plan's
  const plan = S.plan(manifest);
  const oneToOne = spec.kind === 'classical' && plan.scale === 1;
  const k = oneToOne ? 1 : (0.8 * spec.caseSize) / (2 * Math.max(plan.bounds.radius, 1e-12));
  const c0 = oneToOne ? [0, 0, 0] : plan.bounds.center;
  const origin = oneToOne ? spec.at : add(spec.at, [0, 0, spec.caseSize / 2]);
  if (!oneToOne) {
    const total = plan.scale ? plan.scale * k : null;
    const note = total ? scaleLiberty(total) : null;
    extraLiberties.push({ what: `drawn inside a glass case ${sig(spec.caseSize, 3)} m across${note ? `: ${note.what}` : ', the drawing\'s own scale kept'}`, why: 'a bench prop: the demo is a model on the world\'s table, not part of it' });
  }
  if (spec.yaw) extraLiberties.push({ what: `turned ${sig((spec.yaw * 180) / Math.PI, 3)}° about the vertical`, why: 'to face the world' });
  plan.solved.liberties = [...plan.solved.liberties, ...extraLiberties];
  const placed = S.assemble(manifest, { title: spec.title ?? `${spec.kind} demo`, plan });
  const T = (p) => add(origin, rotZ(scl(sub(p, c0), k), spec.yaw));
  const R = (v) => rotZ(v, spec.yaw);
  const G = (g) => (typeof g === 'string' ? `sci:${g}` : g);

  // the demo's tracks in the world, for the scenery check (a classical demo standing 1:1 moves through the world)
  const gates = settingGates(spec, plan.solved.model);
  if (oneToOne) {
    const tr = plan.solved.tracks;
    const tracks = Object.entries(tr.bodies).filter(([id]) => !plan.solved.model.bodies.find((b) => b.id === id)?.fixed)
      .map(([id, b]) => ({ id, x: b.x.map(T), t: tr.t }));
    // a face lying in one of the model's planes is that law's surface (the world's ground made a plane)
    const planes = plan.solved.model.laws.filter((l) => l.law === 'plane').map((l) => ({ p: T(l.point ?? [0, 0, 0]), n: R(l.normal ? (() => { const L = len(l.normal); return l.normal.map((c) => c / L); })() : [0, 0, 1]) }));
    const covered = (f) => planes.some(({ p, n }) => f.corners.every((q) => Math.abs(dot(sub(q, p), n)) < 0.02));
    const hits = sceneryCrossings(worldFaces, tracks, covered);
    gates.push({
      id: 'scenery-clear', want: 'no body passes through the world\'s surfaces unless a law of the model says what happens there', ok: !hits.length,
      value: hits.length ? { crossings: hits.map((h) => `${h.body} through ${h.surface} at t = ${sig(h.t, 3)} s`) } : { surfaces: 'clear' },
      detail: hits.length ? (spec.ground ? 'give the model the surface as a plane law, or move the demo' : "add ground: 'from-world', give the model a plane, or move the demo") : 'the demo moves only where the model says',
    });
  }

  // drop the world-ground plane's own drawn patch (the world draws that surface already)
  const faces = (placed.faces || []).filter((f) => !(spec.ground && f.group === 'scene' && f.corners.every((q) => Math.abs(q[2] - (ground.z - spec.at[2])) < 1e-6)));
  const moving = new Set((placed.movers || []).map((m) => m.group));
  const moved = {
    faces: faces.map((f) => ({ ...f, corners: f.corners.map(T), group: G(f.group) })),
    // a planet a mover carries sits at an offset from the mover's point (turned and scaled); a still one, in the world
    planets: (placed.planets || []).map((p) => ({ ...p, group: G(p.group), center: moving.has(p.group) ? R(scl(p.center, k)) : T(p.center), radius: p.radius * k })),
    movers: (placed.movers || []).map((m) => ({
      ...m, group: G(m.group),
      ...(m.path ? { path: m.path.map(T) } : {}),
      ...(Array.isArray(m.from) ? { from: m.from.map(T) } : {}), ...(Array.isArray(m.to) ? { to: m.to.map(T) } : {}),
      ...(m.vdir ? { vdir: m.vdir.map(R) } : {}), ...(m.avec ? { avec: m.avec.map(R) } : {}),
      ...(m.arrowLen ? { arrowLen: m.arrowLen * k } : {}),
    })),
  };
  // a case round a bench prop: its twelve edges
  if (!oneToOne) {
    const h = spec.caseSize / 2, e = 0.006 * spec.caseSize;
    const C = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]].map((p) => add(origin, rotZ(p, spec.yaw)));
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) moved.faces.push(...bar(C[a], C[b], e, '#9fb7c9', 'sci:case'));
  }
  payload.faces = [...worldFaces, ...moved.faces];
  payload.planets = [...(payload.planets || []), ...moved.planets];
  payload.movers = [...(payload.movers || []), ...moved.movers];

  // the camera that looks at the demo opens the page; the world's own follow
  const pts = moved.faces.flatMap((f) => f.corners).concat(moved.movers.flatMap((m) => m.path || []));
  if (pts.length) {
    const { cameras } = framing(pts, { viewBox: payload.viewBox, lead: 'angle' });
    payload.cameras = [{ ...cameras[0], name: 'demo' }, ...(payload.cameras || [])];
  }

  // the readout and the panel ride the world page; the placement's gates and the ground join the panel
  if (placed.science) {
    const sci = placed.science;
    const sections = sci.honesty.sections.map((s) => ({ ...s, items: s.items.slice() }));
    const checks = sections.find((s) => s.head === 'Checked by the solver');
    if (checks) checks.items.push(...gates.map((g) => ({ mark: true, ok: g.ok, text: g.want, note: g.ok ? '' : g.detail })));
    const left = sections.find((s) => s.head === 'Left out (assumptions)');
    if (left) left.items.push(...assumptions.map((text) => ({ text })));
    if (!oneToOne && plan.scaleNote) {
      const drawn = sections.find((s) => s.head === 'Drawn, not real');
      if (drawn) drawn.items = drawn.items.filter((it) => it.text !== plan.scaleNote.what);   // the case's own magnification says it instead
    }
    const held = sci.honesty.checks ? { held: sci.honesty.checks.held + gates.filter((g) => g.ok).length, of: sci.honesty.checks.of + gates.length } : undefined;
    payload.science = {
      ...sci, labels: (sci.labels || []).map((l) => ({ ...l, group: G(l.group), lift: l.lift * k })),
      honesty: { ...sci.honesty, ...(held ? { checks: held } : {}), sections },
      ...(sci.film ? { film: { ...sci.film, callouts: (sci.film.callouts || []).map((c) => (c.group ? { ...c, group: G(c.group) } : c)) } } : {}),
    };
  }
  // the demo's proposed film, its cameras moved into the world
  if (placed.defaultShoot) {
    const shoot = placed.defaultShoot;
    payload.defaultShoot = { ...shoot, cameras: shoot.cameras.map((c) => ({ ...c, keys: c.keys.map((q) => ({ ...q, pos: T(q.pos).map((x) => +x.toFixed(4)), poi: T(q.poi).map((x) => +x.toFixed(4)) })) })) };
  }
  return { gates, solverGates: plan.solved.gates, held: plan.solved.held && gates.every((g) => g.ok), oneToOne, magnification: oneToOne ? 1 : (plan.scale ? plan.scale * k : null) };
}

