/**
 * A LADDER of scales as one recipe and one page: rungs listed top down, each at its own scale and each saying what it
 * is, side by side in their own cases, with a breadcrumb across the top that steps the camera from one to the next.
 *
 *   manifest = { kind: 'ladder-view', rungs: [rung, …], open?: '<rung id>', title? }
 *   rung = { id, label?,
 *            simulated: { kind: 'classical' | 'microscopic' | 'quantum' | 'relativistic', model, dress? }   run and gated
 *          | depicted:  { figure: 'cell', matter }                    drawn from sourced numbers, held to them
 *          | explained: { text, source, size? }                       a cited sentence where nothing can be drawn
 *          | below:     { rung, body } }                              a body's matter ladder (ladder.js), expanded into
 *                                                                     its grains, cell, atom and nucleus rungs
 *
 * A rung's size is its own: a simulated rung's the extent of its run, a depicted cell its lattice constant, an explained
 * rung the size it gives. Each is drawn magnified to its case, and the page says by how much. Data flows up: a gelling
 * law in a classical rung may read `from: { rung: '<id>', observe: 'aggregated' }`, a microscopic rung below it.
 *
 * Gates: each simulated rung's own (its id before theirs), `ladder-depicted` for a drawn cell, `ladder-cited` (every
 * explained rung names a work and its year), `ladder-ordered` (each size under the ones above it).
 */

import { SCALES, movePlaced, unplaceable } from './setting.js';
import { ladderOf, cellAtoms, nearestNeighbour, depictedGate, latticeLabel, sizeText, rungItem } from './ladder.js';
import { resolveMatter } from '../rupa/matter.js';
import { quantity } from './contract.js';
import { add, sub, scl, bar, framing, isObj, hexRgb, esc, times, pow10, lawName, honesty as honestyOf } from './page.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const idOk = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(s);
export const MAX_RUNGS = 12;
const SLOT = 1, GAP = 0.8;                     // each case a unit across, this far apart
const TINT = { simulated: '#55e08a', depicted: '#9ad0ff', explained: '#c9b8ff' };
const ATOM_TINT = '#b9c3d3', CELL_TINT = '#f0d28a';
const CITED = /\b(1[5-9]\d\d|20\d\d)\b/;      // a source names a year: the work it cites can be found

// ── the recipe ──

function readRung(raw, i, seen) {
  const where = `rungs[${i}]`;
  if (!isObj(raw)) fail(where, 'wants { id, simulated | depicted | explained | below }');
  const forms = ['simulated', 'depicted', 'explained', 'below'].filter((k) => raw[k] !== undefined);
  if (forms.length !== 1) fail(where, 'is one of simulated, depicted, explained, or below (a body\'s matter ladder)');
  const extra = Object.keys(raw).filter((k) => !['id', 'label', ...forms].includes(k));
  if (extra.length) fail(`${where}.${extra[0]}`, 'a rung takes id, label and its one form');
  const form = forms[0];
  if (form !== 'below') {
    if (!idOk(raw.id)) fail(`${where}.id`, 'wants a short id (letters, digits, - and _)');
    if (seen.has(raw.id)) fail(`${where}.id`, `'${raw.id}' is used twice`);
    seen.add(raw.id);
  }
  const label = raw.label === undefined ? null : String(raw.label).slice(0, 48);
  const v = raw[form];
  if (!isObj(v)) fail(`${where}.${form}`, 'wants an object');
  if (form === 'simulated') {
    if (!SCALES[v.kind]) fail(`${where}.simulated.kind`, `is one of ${Object.keys(SCALES).join(', ')}`);
    if (!isObj(v.model)) fail(`${where}.simulated.model`, `wants the ${v.kind} model`);
    const no = unplaceable(v.kind, v.model, v.dress);
    if (no) fail(`${where}.simulated.${no.at}`, no.why.replace('stand in a world', 'stand in a ladder\'s case'));
    return { id: raw.id, label, status: 'simulated', kind: v.kind, model: v.model, dress: v.dress };
  }
  if (form === 'depicted') {
    if (v.figure !== 'cell') fail(`${where}.depicted.figure`, "is 'cell' (a matter's crystal cell)");
    const m = resolveMatter(v.matter, `${where}.depicted.matter`);
    const cell = ladderOf(m, 0).find((r) => r.status === 'depicted');
    if (!cell) fail(`${where}.depicted.matter`, `${m.id} has no cell that can be drawn honestly (${ladderOf(m, 0).slice(1).map((r) => `${r.label}: ${r.status}`).join('; ')})`);
    return { id: raw.id, label, status: 'depicted', rung: cell };
  }
  if (form === 'explained') {
    if (typeof v.text !== 'string' || !v.text.trim()) fail(`${where}.explained.text`, 'wants the sentence');
    if (typeof v.source !== 'string' || !v.source.trim()) fail(`${where}.explained.source`, 'wants the work it cites: an explained rung is a cited sentence');
    const size = v.size === undefined ? null : quantity(v.size, 'length', `${where}.explained.size`);
    return { id: raw.id, label, status: 'explained', text: v.text.trim().slice(0, 400), source: v.source.trim().slice(0, 240), size };
  }
  if (!isObj(v) || !idOk(v.rung) || !idOk(v.body)) fail(`${where}.below`, "wants { rung: '<a simulated classical rung>', body: '<its body>' }");
  return { below: v, label, at: i };
}

/** The recipe read: rungs top down, `below` expanded into the body's matter ladder, handoffs pointed at their rungs. */
export function readLadder(manifest) {
  const raw = manifest.rungs;
  if (!Array.isArray(raw) || !raw.length) fail('rungs', 'wants at least one rung');
  if (raw.length > MAX_RUNGS) fail('rungs', `at most ${MAX_RUNGS}`);
  const seen = new Set(), read = raw.map((r, i) => readRung(r, i, seen));
  const rungs = [];
  for (const r of read) {
    if (!r.below) { rungs.push(r); continue; }
    const host = read.find((x) => x.id === r.below.rung);
    if (!host || host.status !== 'simulated' || host.kind !== 'classical') fail(`rungs[${r.at}].below.rung`, `names a simulated classical rung above it ('${r.below.rung}' is not one)`);
    const body = (host.model.bodies || []).find((b) => b.id === r.below.body);
    if (!body || body.matter === undefined) fail(`rungs[${r.at}].below.body`, `names a body of '${host.id}' made of a matter`);
    const m = resolveMatter(body.matter, `rungs[${r.at}].below.body`);
    const radius = body.radius === undefined ? 0 : quantity(body.radius, 'length', `rungs[${r.at}].below.body`);
    for (const x of ladderOf(m, radius).slice(1)) {
      const id = `${r.below.body}-${x.id}`;
      if (seen.has(id)) fail(`rungs[${r.at}]`, `its rung '${id}' is used twice`);
      seen.add(id);
      rungs.push(x.status === 'depicted'
        ? { id, label: x.label, status: 'depicted', rung: x }
        : { id, label: x.label, status: 'explained', text: x.what + (x.why ? ` (not drawn: ${x.why})` : ''), source: x.source ?? 'nothing sourced yet', size: x.size, gap: !!x.gap, derived: !!x.derived });
    }
  }
  if (rungs.length > MAX_RUNGS * 2) fail('rungs', 'too many once expanded');
  // a handoff names a rung below it: its model goes in its place (data flows up)
  rungs.forEach((r, i) => {
    if (r.status !== 'simulated' || !Array.isArray(r.model.laws)) return;
    r.model = { ...r.model, laws: r.model.laws.map((l, k) => {
      if (!isObj(l) || !isObj(l.from) || l.from.rung === undefined) return l;
      const j = rungs.findIndex((x) => x.id === l.from.rung);
      if (j < 0) fail(`rungs.${r.id}.model.laws[${k}].from.rung`, `no rung '${l.from.rung}'`);
      if (j <= i) fail(`rungs.${r.id}.model.laws[${k}].from.rung`, `'${l.from.rung}' is not below '${r.id}': data flows up the ladder`);
      if (rungs[j].status !== 'simulated' || rungs[j].kind !== 'microscopic') fail(`rungs.${r.id}.model.laws[${k}].from.rung`, `'${l.from.rung}' is not a simulated microscopic rung`);
      const { rung, ...rest } = l.from;
      return { ...l, from: { ...rest, microscopic: rungs[j].model } };
    }) };
  });
  const open = manifest.open === undefined ? rungs[0].id : manifest.open;
  if (!rungs.some((r) => r.id === open)) fail('open', `no rung '${open}'`);
  return { rungs, open };
}

// ── the plan: each rung drawn in its case ──

const caseEdges = (o, h, tint, group) => {
  const C = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]].map((p) => add(o, p));
  return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].flatMap(([a, b]) => bar(C[a], C[b], 0.0025, tint, group));
};

// a simulated rung's size in metres: where its bodies go (their paths and their own size), else what its page draws
function extentOf(plan) {
  const tr = plan.solved.tracks?.bodies, bodies = plan.solved.model?.bodies;
  if (tr && bodies && Object.keys(tr).length) {
    const pts = Object.values(tr).flatMap((b) => b.x), r = Math.max(0, ...bodies.map((b) => b.radius ?? 0));
    const span = Math.max(...[0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))));
    return span + 2 * r || null;
  }
  return plan.scale ? (2 * plan.bounds.radius) / plan.scale : null;
}

export function planLadder(manifest) {
  const { rungs, open } = readLadder(manifest);
  const faces = [], planets = [], movers = [], picks = [], liberties = [], gates = [], cams = [];
  let primary = null;
  rungs.forEach((r, i) => {
    const o = [i * (SLOT + GAP), 0, SLOT / 2], G = (g) => (typeof g === 'string' ? `r:${r.id}:${g}` : g);
    const name = r.label ?? r.id;
    faces.push(...caseEdges(o, SLOT / 2, TINT[r.status], `r:${r.id}:case`));
    if (r.status === 'simulated') {
      const S = SCALES[r.kind], m = { kind: S.kind, model: r.model, ...(r.dress !== undefined ? { dress: r.dress } : {}) };
      let plan, placed;
      try { plan = S.plan(m); placed = S.assemble(m, { title: name, plan }); } catch (e) { fail(`rungs.${r.id}.simulated`, e.message.replace(/^science-worlds: /, '')); }
      const k = (0.8 * SLOT) / (2 * Math.max(plan.bounds.radius, 1e-12)), c0 = plan.bounds.center;
      const moved = movePlaced(placed, { T: (p) => add(o, scl(sub(p, c0), k)), k, G });
      faces.push(...moved.faces); planets.push(...moved.planets); movers.push(...moved.movers);
      for (const p of placed.picks || []) picks.push({ ...p, name: G(p.name) });
      r.size = extentOf(plan);
      r.mag = plan.scale ? plan.scale * k : null;
      r.gates = [...plan.solved.gates, ...(plan.drawnGates ?? [])];
      r.solved = plan.solved; r.placed = placed;
      r.what = `a ${r.kind} model, run here: ${[...new Set((plan.solved.model?.laws ?? []).map((l) => lawName(l.law)))].join(', ')}`;
      for (const g of r.gates) gates.push({ ...g, id: `${r.id}/${g.id}` });
      if (!primary) primary = r;
    } else if (r.status === 'depicted') {
      const cell = r.rung.cell, c = 0.6 * SLOT, per = c / cell.a;
      const atoms = cellAtoms(cell).map((p) => add(sub(o, [c / 2, c / 2, c / 2]), scl(p, per)));
      const rA = (0.4 * nearestNeighbour(cell) * per) / 2;
      atoms.forEach((p, k) => planets.push({ group: `r:${r.id}:atom:${k}`, center: p, radius: rA, tint: hexRgb(ATOM_TINT), rough: 0.35, nlat: 10, nlon: 14 }));
      const C = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((q) => add(sub(o, [c / 2, c / 2, c / 2]), scl(q, c)));
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) faces.push(...bar(C[a], C[b], 0.008, CELL_TINT, `r:${r.id}:cell`));
      r.size = cell.a; r.mag = per;
      r.what = r.rung.what; r.source = r.rung.source;
      const g = depictedGate({ label: r.rung.label, cell, atoms, edge: c, per });
      gates.push({ ...g, id: `${r.id}/${g.id}` });
      liberties.push({ what: `${name}: its atoms drawn as balls 0.4 as wide as their spacing (${latticeLabel(cell.lattice)})`, why: 'so the lattice shows; an atom has no edge' });
    } else {
      r.what = r.text; r.mag = null;
    }
    if (r.mag && Math.abs(Math.log10(r.mag)) > 0.05) liberties.push({ what: `${name}: drawn ${times(r.mag)} its size`, why: 'each rung is magnified to its own case' });
    const { cameras } = framing(caseEdges(o, SLOT / 2, '#000', 'x').flatMap((f) => f.corners), { lead: 'angle' });
    cams.push({ ...cameras[0], name });
  });

  // the steps between rungs, and the ladder's own gates
  rungs.forEach((r, i) => {
    const up = rungs.slice(0, i).reverse().find((u) => u.size);
    if (r.size && up) r.step = { power: Math.round(Math.log10(r.size / up.size)), of: up.label ?? up.id };
  });
  const sized = rungs.filter((r) => r.size);
  const unordered = sized.filter((r, i) => i > 0 && !(r.size < sized[i - 1].size)).map((r) => r.id);
  gates.push({ id: 'ladder-ordered', want: 'the rungs run top down: each one\'s size is under the size of the rung above it', ok: !unordered.length, value: { unordered },
    detail: unordered.length ? `${unordered.join(', ')} is no smaller than the rung above it` : `${sized.length} rungs with a size, each smaller than the last` });
  // a rung derived from the one above (an atom's size from its cell's spacing) cites that rung; a gap says it has nothing
  const uncited = rungs.filter((r) => r.status === 'explained' && !r.gap && !r.derived && !CITED.test(r.source)).map((r) => r.id);
  const gaps = rungs.filter((r) => r.gap).map((r) => r.id);
  gates.push({ id: 'ladder-cited', want: 'every explained rung cites a work by its year (where nothing can be drawn, the sentence is only as good as its source)', ok: !uncited.length,
    value: { uncited, ...(gaps.length ? { gaps } : {}) }, detail: uncited.length ? `${uncited.join(', ')} names no work and year` : 'every sentence is sourced' });

  // the cameras open on the rung asked for; the crumbs find their camera by index
  const openAt = rungs.findIndex((r) => r.id === open);
  const order = [openAt, ...rungs.map((r, i) => i).filter((i) => i !== openAt)];
  const cameras = order.map((i) => cams[i]);
  const camOf = (i) => order.indexOf(i);
  return { rungs, open, faces, planets, movers, picks, liberties, gates, cameras, camOf, primary, held: gates.every((g) => g.ok) };
}

// ── the page ──

const SIZE_LABEL = (r) => (r.size ? sizeText(r.size) : null);

function crumbsOf(plan) {
  return plan.rungs.map((r, i) => ({
    label: r.label ?? r.id, status: r.status, cam: plan.camOf(i), ...(r === plan.primary ? { readout: true } : {}),
    size: SIZE_LABEL(r), step: r.step ? `${pow10(r.step.power)} of ${r.step.of}` : null,
    what: r.what ?? '', source: r.source ?? (r.status === 'simulated' ? 'its own model, run and checked on this page' : null),
  }));
}

/** The World payload (emitThreeWorld) for a ladder-view manifest. */
export function assembleLadderScene(manifest = {}, { title } = {}) {
  const plan = planLadder(manifest);
  const name = (title && !/^(mojulo )?ladder( of scales)?$/i.test(title) ? title : null) ?? manifest.title
    ?? (() => {
      const first = plan.rungs[0].label ?? plan.rungs[0].id, last = plan.rungs.at(-1).label ?? plan.rungs.at(-1).id;
      return `${first} · down to ${/^[A-Z][a-z]/.test(last) ? last.charAt(0).toLowerCase() + last.slice(1) : last}`;
    })();
  const p = plan.primary?.placed?.science;
  // the panel: the ladder, then each simulated rung's model, the checks of every rung, what each leaves out and draws
  const items = plan.rungs.map((r) => rungItem({ label: r.label ?? r.id, status: r.status, size: r.size, what: r.what ?? '', source: r.source, ...(r.step ? { step: { power: r.step.power, label: r.step.of, text: `${pow10(r.step.power)} of the ${r.step.of}` } } : {}) }));
  const sims = plan.rungs.filter((r) => r.status === 'simulated');
  const merged = honestyOf({
    model: sims.flatMap((r) => (r.placed.science?.honesty.sections.find((s) => s.head === 'The model (real)')?.items ?? []).map((it) => `${r.label ?? r.id}: ${it.text}`)),
    gates: plan.gates,
    assumptions: [...new Set(sims.flatMap((r) => r.solved.assumptions ?? []))],
    liberties: [...plan.liberties, ...sims.flatMap((r) => (r.placed.science?.honesty.sections.find((s) => s.head === 'Drawn, not real')?.items ?? []).map((it) => ({ what: `${r.label ?? r.id}: ${it.text}`, why: it.note?.replace(/^\(|\)$/g, '') })))],
    gaps: sims.flatMap((r) => r.solved.gaps ?? []),
    held: plan.held,
  });
  merged.sections.splice(0, 0, { head: 'The ladder (simulated · depicted · explained)', color: '#f0d28a', items });
  const science = {
    ...(p ? { t: p.t, period: p.period, hold: p.hold, rows: p.rows, barWidth: p.barWidth, labelWidth: p.labelWidth, labels: (p.labels || []).map((l) => ({ ...l, group: `r:${plan.primary.id}:${l.group}` })) }
      : { t: [0, 1], period: 1, hold: 0, rows: [], noClock: true, labels: [] }),
    titleHtml: esc(name), titleText: name,
    honesty: merged,
    ladder: { crumbs: crumbsOf(plan), open: 0, readout: plan.primary ? plan.primary.label ?? plan.primary.id : null, tints: TINT },
  };
  return {
    faces: plan.faces, picks: plan.picks, movers: plan.movers, planets: plan.planets, cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg: '#0b1020', glow: false, chrome: false, science,
  };
}

export const ladderStats = (plan) => ({ rungs: plan.rungs.length, simulated: plan.rungs.filter((r) => r.status === 'simulated').length, held: plan.held });
