// historic/statues — a city's statue SLOTS, and a manifest's `statues` stood on them (opt-in; absent ⇒ the city as it
// was, byte for byte).
//
// A slot is a place the layout already set a statue: a Forum monument (`mark(id, …)`: its masses carry `building: id`,
// each stand-in figure the forum asset's `figure()`: a robe and head turned as lathes, one arm a beam) or a statue asset's
// slot (`ln-statue`, Pompeii's borrowed `pp-statue`: a base and a bronze; Sumer's `votive-row`: a bench of worshippers,
// each on its plinth; Thebes's `eg-colossus`: a seated king, his throne coming down with him), addressed `<asset>:<n>`, its nth slot. A slot may stand several figures (the Sibyls stand three,
// a votive row one per plinth): `figure` picks one, else every figure in it takes the statue.
//
// Standing a statue on a slot removes the stand-in figure's masses (its base stays) and records where the figure stood
// in metres: the base top under it, its height, its centre and the way it faced (`dir`, radians, 0 = −y, the forum
// figure's own convention). The World resolver (worlds/world-scene.js), where the store is, fits the statue's own faces
// there (`fitStatueFaces`): its base dropped, scaled to the stand-in's height (the size the record draws) or to the
// entry's `height`, turned to face the same way. An equestrian slot takes no standing statue: it refuses by name.
// Pure and deterministic.
import * as dmath from '../../util/dmath.js';

/** the masses a stand-in figure is made of (its base's are 'base') */
const FIGURE_KINDS = new Set(['statue', 'bronze']);
/** the statue assets whose slots take a statue: the kinds its stand-in figures are made of, and `row` when one slot
 * stands a row of them (each figure its own cluster, numbered along the row: by x, then y) */
const STATUE_ASSET_KINDS = Object.freeze({
  'ln-statue': { kinds: FIGURE_KINDS },
  'pp-statue': { kinds: FIGURE_KINDS },
  'votive-row': { kinds: new Set(['statue', 'statue-eye']), row: true },
  // a Theban colossus: the king, his nemes, collar and crown, and the throne too (a seated statue brings its own, at its
  // body's proportions); its height the king's to the top of the nemes (a carved statue wears no crown yet)
  'eg-colossus': { kinds: new Set(['statue', 'nemes', 'collar', 'crown', 'throne']), measure: new Set(['statue', 'nemes']) },
});
const STATUE_ASSETS = Object.freeze(Object.keys(STATUE_ASSET_KINDS));
/** the farthest a mass's centre sits from its own figure's in a row (a worshipper's legs and eyes sit within 0.2 m of
 * its axis; the row's figures stand 1.4 m or more apart) */
const ROW_GATHER = 0.5;
/** a slot facing letter as the figure's `dir` */
const FACING_DIR = Object.freeze({ n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 });
const ENTRY_FIELDS = ['ref', 'at', 'figure', 'height'];

const centre = (m) => [m.x + m.w / 2, m.y + m.d / 2];
const inRect = ([x, y], r) => x >= r.x - 1e-9 && x <= r.x + r.w + 1e-9 && y >= r.y - 1e-9 && y <= r.y + r.d + 1e-9;
const top = (m) => m.z1, bottom = (m) => m.z0;

/** Form errors for a manifest's `statues` (empty = valid) */
export function validateStatues(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return ["statues: a list of { ref, at, figure?, height? } — a stored statue (a hero with `statue`) and the slot it stands on (a Forum monument's id, or '<asset>:<n>')"];
  const errs = [];
  list.forEach((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { errs.push(`statues[${i}]: { ref, at, figure?, height? }`); return; }
    if (typeof e.ref !== 'string' || !e.ref) errs.push(`statues[${i}].ref: a stored sketch's ref (a hero carved with /hero/statue)`);
    if (typeof e.at !== 'string' || !e.at) errs.push(`statues[${i}].at: a slot — a Forum monument's id, or '<asset>:<n>' (${STATUE_ASSETS.join(', ')})`);
    if (e.figure !== undefined && !(Number.isInteger(e.figure) && e.figure >= 0)) errs.push(`statues[${i}].figure: which figure of the slot (0, 1, …)`);
    if (e.height !== undefined && !(Number.isFinite(e.height) && e.height > 0.2 && e.height <= 40)) errs.push(`statues[${i}].height: the figure's height in metres (0.2–40)`);
    for (const k of Object.keys(e)) if (!ENTRY_FIELDS.includes(k)) errs.push(`statues[${i}].${k}: not a field (${ENTRY_FIELDS.join(', ')})`);
  });
  return errs;
}

/** A forum stand-in's figures: its lathe panels clustered about their running centre (a robe's panels ring its axis),
 * each arm beam with the nearest cluster; a figure is a cluster with an arm (a building's decorative 'statue' boxes have
 * none). Facing from the shoulder (figure(): the arm leaves the robe's centre on the figure's right, (cos dir, sin dir)). */
function forumFigures(masses) {
  const lathes = masses.filter(({ m }) => m.solid === 'panel'), beams = masses.filter(({ m }) => m.solid === 'beam'), figs = [];
  for (const L of lathes) {
    const c = centre(L.m), f = figs.find((g) => dmath.hypot(g.c[0] - c[0], g.c[1] - c[1]) < 0.8);
    if (f) { f.items.push(L); f.sum[0] += c[0]; f.sum[1] += c[1]; f.c = [f.sum[0] / f.items.length, f.sum[1] / f.items.length]; }
    else figs.push({ c, sum: [...c], items: [L], beams: [] });
  }
  for (const B of beams) {
    const a = B.m.a; let best = null, bd = Infinity;
    for (const f of figs) { const d = dmath.hypot(a[0] - f.c[0], a[1] - f.c[1]); if (d < bd) { bd = d; best = f; } }
    if (best) best.beams.push(B);
  }
  return figs.filter((f) => f.beams.length).map((f) => {
    const items = [...f.items, ...f.beams], arm = f.beams[0]?.m.a, z0 = Math.min(...items.map(({ m }) => bottom(m))), z1 = Math.max(...items.map(({ m }) => top(m)));
    return { c: f.c, z0, h: z1 - z0, dir: arm ? Math.atan2(arm[1] - f.c[1], arm[0] - f.c[0]) : 0, idx: items.map(({ i }) => i), equestrian: f.beams.length > 2 };
  });
}

/** The city plan's statue slots: `at` → { figures: [{ c, z0, h, dir, idx, equestrian }] } (metres; `idx` the stand-in's
 * masses in plan.boxes) */
export function statueSlots(plan) {
  const out = {}, boxes = plan.boxes || [];
  const forum = new Set((plan.stats?.monuments || []).map((q) => q.id)), byBuilding = new Map();
  boxes.forEach((m, i) => { if (FIGURE_KINDS.has(m.kind) && forum.has(m.building)) { if (!byBuilding.has(m.building)) byBuilding.set(m.building, []); byBuilding.get(m.building).push({ m, i }); } });
  for (const [id, ms] of byBuilding) { const figures = forumFigures(ms); if (figures.length) out[id] = { figures }; }
  const n = {};
  for (const s of plan.slots || []) {
    const A = STATUE_ASSET_KINDS[s.asset];
    if (!A) continue;
    const k = n[s.asset] = (n[s.asset] ?? -1) + 1;
    const idx = []; boxes.forEach((m, i) => { if (m.asset === s.asset && A.kinds.has(m.kind) && inRect(centre(m), s.rect)) idx.push(i); });
    if (!idx.length) continue;
    const dir = FACING_DIR[s.facing] ?? 0, span = (I) => { const all = I.map((i) => boxes[i]), ms = A.measure ? all.filter((m) => A.measure.has(m.kind)) : all, z0 = Math.min(...all.map(bottom)); return { z0, h: Math.max(...ms.map(top)) - z0 }; };
    if (!A.row) { out[`${s.asset}:${k}`] = { figures: [{ c: [s.rect.x + s.rect.w / 2, s.rect.y + s.rect.d / 2], ...span(idx), dir, idx, equestrian: false }] }; continue; }
    const groups = [];
    for (const i of idx) {
      const c = centre(boxes[i]), g = groups.find((q) => dmath.hypot(q.c[0] - c[0], q.c[1] - c[1]) < ROW_GATHER);
      if (g) g.idx.push(i); else groups.push({ c, idx: [i] });
    }
    const figures = groups.map((g) => {
      const ms = g.idx.map((i) => boxes[i]), x0 = Math.min(...ms.map((m) => m.x)), x1 = Math.max(...ms.map((m) => m.x + m.w)), y0 = Math.min(...ms.map((m) => m.y)), y1 = Math.max(...ms.map((m) => m.y + m.d));
      return { c: [(x0 + x1) / 2, (y0 + y1) / 2], ...span(g.idx), dir, idx: g.idx, equestrian: false };
    }).sort((a, b) => a.c[0] - b.c[0] || a.c[1] - b.c[1]);
    out[`${s.asset}:${k}`] = { figures };
  }
  return out;
}

/**
 * Stand a manifest's `statues` on the plan's slots → { boxes, statueRefs }: the plan's masses without the stand-ins that
 * were replaced, and a record per statue figure `{ ref, at, figure, pos: [x, y, z], height, dir }` in metres. Throws on
 * a slot the city does not have (naming those it has), a figure it does not stand, or an equestrian slot.
 */
export function standStatues(plan, statues, { culture } = {}) {
  const slots = statueSlots(plan), drop = new Set(), statueRefs = [];
  for (const e of statues) {
    const S = slots[e.at];
    if (!S) throw new Error(`historic: ${culture ?? 'this city'} has no statue slot '${e.at}' — its slots: ${Object.keys(slots).map((k) => `'${k}'`).join(', ') || 'none'}`);
    if (e.figure !== undefined && !S.figures[e.figure]) throw new Error(`historic: slot '${e.at}' stands ${S.figures.length} figure${S.figures.length === 1 ? '' : 's'} (figure 0${S.figures.length > 1 ? `–${S.figures.length - 1}` : ''})`);
    for (const [k, F] of S.figures.entries()) {
      if (e.figure !== undefined && k !== e.figure) continue;
      if (F.equestrian) throw new Error(`historic: slot '${e.at}' is an equestrian statue (a rider on a horse); a standing statue does not fit it, and the statue maker carves no horse yet — its standing slots: ${Object.keys(slots).filter((k) => slots[k].figures.some((f) => !f.equestrian)).map((k) => `'${k}'`).join(', ')}`);
      F.idx.forEach((i) => drop.add(i));
      statueRefs.push({ ref: e.ref, at: e.at, figure: k, pos: [F.c[0], F.c[1], F.z0], height: e.height ?? F.h, dir: F.dir });
    }
  }
  return { boxes: (plan.boxes || []).filter((_, i) => !drop.has(i)), statueRefs };
}

// ── the World resolver's side: the statue's faces fitted onto its slot ─────────────────────────────────────────
const r9 = (x) => Math.round(x * 1e9) / 1e9;
/** The statue's turn about z for a slot's `dir`: its own front (+y, the hero's) to the stand-in's (sin dir, −cos dir) */
export const statueTurn = (dir) => dir + Math.PI;
/** a light (vexar makeLight's shape) turned by −θ about z: the scene's sun as the statue sees it in its own frame, so
 * its faces bake as they will stand */
export function lightInto(light, theta) {
  const c = dmath.cos(-theta), s = dmath.sin(-theta), R = (v) => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]], L = { ...light };
  for (const k of ['dir', 'toLight', 'fillToLight']) if (Array.isArray(light[k])) L[k] = R(light[k]);
  return L;
}
/**
 * A statue's World faces fitted onto a slot record: its own base (group 'base') dropped, its lowest point on the slot's
 * base top, scaled to `height`, turned by `statueTurn(dir)` about its footprint's centre and set at `pos`; then into the
 * scene's units (× `s`). Normals turn with it; every other field rides as it is. `group` names the placed figure.
 */
export function fitStatueFaces(faces, rec, { s = 1, group } = {}) {
  const fig = faces.filter((f) => f.group !== 'base' && Array.isArray(f.corners) && f.corners.length >= 3);
  if (!fig.length) return [];
  let lo = Infinity, hi = -Infinity; const b = [Infinity, -Infinity, Infinity, -Infinity];
  for (const f of fig) for (const c of f.corners) { lo = Math.min(lo, c[2]); hi = Math.max(hi, c[2]); }
  for (const f of fig) for (const c of f.corners) if (c[2] <= lo + 0.03 * (hi - lo)) { b[0] = Math.min(b[0], c[0]); b[1] = Math.max(b[1], c[0]); b[2] = Math.min(b[2], c[1]); b[3] = Math.max(b[3], c[1]); }
  const cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2, k = rec.height / (hi - lo), t = statueTurn(rec.dir), C = dmath.cos(t), S = dmath.sin(t);
  const P = (p) => { const x = (p[0] - cx) * k, y = (p[1] - cy) * k; return [r9((rec.pos[0] + C * x - S * y) * s), r9((rec.pos[1] + S * x + C * y) * s), r9((rec.pos[2] + (p[2] - lo) * k) * s)]; };
  const N = (n) => [r9(C * n[0] - S * n[1]), r9(S * n[0] + C * n[1]), n[2]];
  return fig.map((f) => ({ ...f, corners: f.corners.map(P), ...(Array.isArray(f.outNormal) ? { outNormal: N(f.outNormal) } : {}), ...(group ? { group } : {}) }));
}
