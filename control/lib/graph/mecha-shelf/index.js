/**
 * mecha-shelf — legged machines a rider sits in, from the ground up, as ONE shelf: the inventory (mecha-odm.js), a
 * builder per kind (mecha-parts.js), the archetypes that lay whole frames out on the construction shelf's kinematic
 * chain (mecha-archetypes.js, construction-shelf/con-chain.js), the leg's inverse kinematics its stances are solved by
 * (mecha-ik.js) and the laws it is held to (mecha-laws.js). The craft, cycle and construction shelves' grammar: the same
 * `garage` block on every part, the same advisory BOM audit, the same colour roles.
 *
 *   resolveMechaPart(sku, opts)       one inventory row → a workbench recipe in its body's frame (metres)
 *   assembleFrame(archetype, opts)    an archetype at a pose → an assembler recipe and its readout (its stance, its
 *                                     joints and their ranges, its laws, its measures, the rider's points, the BOM)
 *   posedFrame(archetype, pose)       a pose (a stance's name, a stance, or { joints, root? }) → { joints, root, … }
 *   mechaCtx(archetype)               what the chain reads of its built parts (con-chain.js ctx)
 *   massOf(archetype, joints, root)   → { mass, com, parts }: every part's mass where it is posed, the rider aboard
 *   findMechaPart(words)              the words people say → a part number
 *
 * Every body is authored in its own frame (mecha-common.js), so a pose moves no part's geometry: it moves frames. The
 * pelvis is the chain's root, carried where its stance holds it; a ram's barrel and rod are aimed between their pins.
 *
 * Pure: no clock, no dice. An archetype row and an inventory row are compatibility promises over what is minted.
 */
import { planAssemblyBom } from '../vehicle-designer/assembly-bom.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { framesOf, isStrut, rangeOf, solveChain } from '../construction-shelf/con-chain.js';
import { G, I3, MECHA_COLOR_ROLES, MECHA_PALETTES, apply, clone, compose, eulerXYZ, resolveMechaPalette, round3, turn } from './mecha-common.js';
import { MECHA_BUILDERS } from './mecha-parts.js';
import { MECHA_KINDS, MECHA_ODM, scaleDims } from './mecha-odm.js';
import { MECHA_ARCHETYPES, MECHA_ARCHETYPE_IDS } from './mecha-archetypes.js';
import { solveStance } from './mecha-ik.js';
import { MECHA_ARM_KITS, MECHA_PACK_TASKS, MECHA_TASKS, MECHA_TOOLS } from './mecha-tools.js';
import { mechaLaws } from './mecha-laws.js';
import { MECHA_MAKERS, MECHA_MAKER_IDS, makerHand } from './mecha-gap-makers.js';

export { MECHA_ARCHETYPES, MECHA_ARCHETYPE_IDS, MECHA_COLOR_ROLES, MECHA_KINDS, MECHA_ODM, MECHA_PALETTES };
export { MECHA_MAKERS, MECHA_MAKER_IDS, makerHand } from './mecha-gap-makers.js';
export { MECHA_ARM_KITS, MECHA_PACK_TASKS, MECHA_PACK_TASK_IDS, MECHA_TASKS, MECHA_TASK_IDS, MECHA_TOOLS, MECHA_TOOL_IDS } from './mecha-tools.js';

const MONOMERS = ['lathes', 'sweeps', 'extrudes', 'lofts'];
// what each colour role is made of: the covers a satin enamel, the structure a dull sheen, a ram's rod polished chrome,
// the soles, the hoses and the cushions rubber, a lamp's glass glass
const ENAMEL = { preset: 'satin', ambient: 0.48, diffuse: 0.6, specular: 0.3, shininess: 22 };
const SHEEN = { preset: 'satin', ambient: 0.46, diffuse: 0.6, specular: 0.14, shininess: 10 };
const FINISH = { paint: ENAMEL, trim: SHEEN, chrome: { metal: 'chrome', finish: 'polished' }, rubber: 'rubber', glass: 'glass', light: SHEEN };
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** The role a tint was drawn from: its own colour, or the role whose colour it was toned from (the nearest). */
function roleOf(tint, C) {
  const exact = MECHA_COLOR_ROLES.find((r) => C[r] === tint);
  if (exact) return exact;
  const t = hexRGB(tint);
  let best = 'paint', d = Infinity;
  for (const r of MECHA_COLOR_ROLES) {
    const c = hexRGB(C[r]), e = (c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2;
    if (e < d) { d = e; best = r; }
  }
  return best;
}
const applyFinish = (monomers, C) => Object.fromEntries(Object.entries(monomers).map(([k, list]) => [k, list.map((m) => (m.material ? m : { ...m, material: clone(FINISH[roleOf(m.tint, C)]) }))]));
const roundPt = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? roundPt(x) : round3(x) + 0)) : v);
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000 + 0;

function partRow(sku) {
  const row = MECHA_ODM[sku];
  if (!row) throw new Error(`Unknown mecha part '${sku}'; the inventory lists ${Object.keys(MECHA_ODM).join(', ')} (or findMechaPart('<words>'))`);
  return row;
}
// (a frame the door composed, its tools or its arms swapped, under its own key: 'heavyWalker+r:breaker,l:crusher')
const COMPOSED = new Map();
function archetypeRow(id) {
  const row = MECHA_ARCHETYPES[id] ?? COMPOSED.get(id);
  if (!row) throw new Error(`Unknown mecha archetype '${id}'; expected one of: ${MECHA_ARCHETYPE_IDS.join(', ')}`);
  // (the chain caches by key: a mecha frame's never meets a construction machine's)
  return { ...row, key: `mecha:${id}`, id };
}
/** A frame's row by its key (its own, or one the door composed). */
export const frameRow = (id) => archetypeRow(id);

/**
 * A modular frame fitted for its work → its key: a `task` (mecha-tools.js MECHA_TASKS: a loadout per arm), and the
 * operator's own `tools` ({ r?, l? }: a tool per arm) and `arms` ({ r?, l? }: an arm kit per arm) over it; a frame with a
 * giant arm pack, its `packTask` (MECHA_PACK_TASKS) and `packTools` ({ r?, l? }) for its giant arms, and its `packMaker`
 * (MECHA_MAKERS: the design house whose pack and giant arms it carries, solved for its house's philosophy; its house's
 * hand in the giant hand's place); a frame with cabins to choose, its `cabin` (its archetype's `cabins`: a closed one in
 * the open one's place) and a closed cabin's `slits` ('open' | 'shut'). Each arm's
 * tool takes its claw's place on the wrist's coupler, its kit its forearm's; the laws re-read it as built (its mass, its
 * reach to the tool's working point, its lift capped by what its tools hold, its tools' flow). A tool or a kit its mount
 * does not take is refused, naming what it takes.
 */
export function composeFrame(id, { task, tools, arms, packTask, packTools, packMaker, cabin, slits } = {}) {
  if ([task, tools, arms, packTask, packTools, packMaker, cabin, slits].every((v) => v === undefined)) return id;
  const base = MECHA_ARCHETYPES[id];
  if (!base) throw new Error(`Unknown mecha archetype '${id}'; expected one of: ${MECHA_ARCHETYPE_IDS.join(', ')}`);
  const M = base.mount, PM = base.packMount;
  if (!M && (task !== undefined || tools !== undefined || arms !== undefined)) throw new Error(`mecha ${base.label}: its arms are its own (only a modular frame takes a task, tools or arms)`);
  if (!PM && (packTask !== undefined || packTools !== undefined || packMaker !== undefined)) throw new Error(`mecha ${base.label}: it carries no giant arm pack (only a frame with one takes a packTask, packTools or packMaker)`);
  const CB = base.cabins, cab = cabin === undefined ? null : CB?.[cabin];
  if (cabin !== undefined && !CB) throw new Error(`mecha ${base.label}: its cabin is its own (only a frame with cabins to choose takes a cabin)`);
  if (cabin !== undefined && !cab) throw new Error(`mecha ${base.label}: cabin '${cabin}' is one of ${Object.keys(CB).join(', ')}`);
  if (slits !== undefined && !['open', 'shut'].includes(slits)) throw new Error(`mecha ${base.label}: its slits are 'open' or 'shut' (not '${slits}')`);
  if (slits !== undefined && !(cab && cab.sku !== CB.open?.sku)) throw new Error(`mecha ${base.label}: slits are a closed cabin's (cabin: 'armoured', slits: 'shut')`);
  const closed = cab && cab.sku !== CB.open?.sku;
  if (packMaker !== undefined && !MECHA_MAKERS[packMaker]) throw new Error(`mecha ${base.label}: packMaker '${packMaker}' is one of ${MECHA_MAKER_IDS.join(', ')}`);
  const T = task === undefined ? null : MECHA_TASKS[task], PT = packTask === undefined ? null : MECHA_PACK_TASKS[packTask];
  if (task !== undefined && !T) throw new Error(`mecha ${base.label}: task '${task}' is one of ${Object.keys(MECHA_TASKS).join(', ')}`);
  if (packTask !== undefined && !PT) throw new Error(`mecha ${base.label}: packTask '${packTask}' is one of ${Object.keys(MECHA_PACK_TASKS).join(', ')}`);
  for (const w of [tools, arms, packTools]) for (const k of Object.keys(w ?? {})) if (k !== 'r' && k !== 'l') throw new Error(`mecha ${base.label}: tools, arms and packTools are { r?, l? } (not '${k}')`);
  const hand = (S) => (S === 'r' ? 'right' : 'left');
  const side = (S) => {
    const tool = tools?.[S] ?? T?.[S].tool ?? M.loadout[S].tool, arm = arms?.[S] ?? T?.[S].arm ?? M.loadout[S].arm;
    if (!M.tools.includes(tool)) throw new Error(`mecha ${base.label}: its ${hand(S)} arm takes a tool of ${M.tools.join(', ')} (not '${tool}')`);
    if (!M.arms.includes(arm)) throw new Error(`mecha ${base.label}: its ${hand(S)} arm is one of ${M.arms.join(', ')} (not '${arm}')`);
    return { tool, arm };
  };
  const packSide = (S) => {
    const tool = packTools?.[S] ?? PT?.[S].tool ?? PM.loadout[S].tool;
    if (!PM.tools.includes(tool)) throw new Error(`mecha ${base.label}: its ${hand(S)} giant arm takes a tool of ${PM.tools.join(', ')} (not '${tool}')`);
    return { tool };
  };
  const loadout = M ? { r: side('r'), l: side('l') } : null, packLoadout = PM ? { r: packSide('r'), l: packSide('l') } : null;
  const own = (S) => !M || (loadout[S].tool === M.loadout[S].tool && loadout[S].arm === M.loadout[S].arm);
  const packOwn = (S) => !PM || packLoadout[S].tool === PM.loadout[S].tool;
  if (packMaker === undefined && !closed && ['r', 'l'].every((S) => own(S) && packOwn(S))) return id;
  const keys = [];
  if (M && !(own('r') && own('l'))) keys.push(['r', 'l'].map((S) => `${S}:${loadout[S].tool}${loadout[S].arm !== 'standard' ? `/${loadout[S].arm}` : ''}`).join(','));
  if (PM && !(packOwn('r') && packOwn('l'))) keys.push(`pack:${['r', 'l'].map((S) => `${S}:${packLoadout[S].tool}`).join(',')}`);
  if (packMaker !== undefined) keys.push(`house:${packMaker}`);
  if (closed) keys.push(`cabin:${cabin}${slits === 'shut' ? '/shut' : ''}`);
  const key = `${id}+${keys.join('+')}`;
  if (!COMPOSED.has(key)) {
    // (a house's pack: its pack and its giant arms' parts and rams in the frame's, its hand for the giant hand)
    const house = packMaker === undefined ? null : Object.fromEntries(['r', 'l'].map((S) => {
      const g = base.packArms[S], J = g.joints, ram = (j) => base.joints[J[j]].ram;
      return [S, { [g.shoulder]: `shoulder-${packMaker}`, [g.upper]: `upperarm-${packMaker}`, [g.fore]: `forearm-${packMaker}`, [g.wrist]: `wrist-${packMaker}`, [ram('pitch')]: `ram-shoulder-${packMaker}`, [ram('elbow')]: `ram-elbow-${packMaker}` }];
    }));
    const swap = (e) => {
      const S = e.side, arm = base.arms?.[S], giant = base.packArms?.[S];
      if (arm && loadout && e.id === arm.claw) return Object.freeze({ ...e, sku: MECHA_TOOLS[loadout[S].tool].sku });
      if (arm && loadout && e.id === arm.fore) return Object.freeze({ ...e, sku: MECHA_ARM_KITS[loadout[S].arm].fore });
      if (giant && packLoadout && e.id === giant.claw) return Object.freeze({ ...e, sku: house && packLoadout[S].tool === 'giantHand' ? `hand-${packMaker}` : MECHA_TOOLS[packLoadout[S].tool].sku });
      if (house && e.id === 'pack') return Object.freeze({ ...e, sku: `gap-${packMaker}` });
      // (a closed cabin in the open one's place, its lids shut when asked: the part's own state)
      if (closed && e.id === 'cage') return Object.freeze({ ...e, sku: cab.sku, ...(slits === 'shut' ? { part: 'shut' } : {}) });
      if (house && S && house[S][e.id]) return Object.freeze({ ...e, sku: house[S][e.id] });
      return e;
    };
    const layout = Object.freeze(base.layout.map(swap)), bom = {};
    for (const e of layout) { const k = partRow(e.sku).kind; bom[k] = (bom[k] ?? 0) + 1; }
    const words = [
      ...(M && !(own('r') && own('l')) ? [task !== undefined ? MECHA_TASKS[task].label.split(':')[0] : ['r', 'l'].map((S) => MECHA_TOOLS[loadout[S].tool].label).join(' and ')] : []),
      ...(PM && !(packOwn('r') && packOwn('l')) ? [packTask !== undefined ? MECHA_PACK_TASKS[packTask].label.split(':')[0] : `${['r', 'l'].map((S) => MECHA_TOOLS[packLoadout[S].tool].label).join(' and ')} on its giant arms`] : []),
      ...(packMaker !== undefined ? [`its giant arm pack the ${MECHA_MAKERS[packMaker].label}'s`] : []),
      ...(closed ? [`${cab.label}${slits === 'shut' ? ', its slits shut' : ''}`] : []),
    ];
    COMPOSED.set(key, Object.freeze({
      ...base, label: `${base.label}, ${words.join(', ')}`, layout, bom: Object.freeze(bom),
      ...(loadout ? { loadout: Object.freeze(loadout) } : {}), ...(packLoadout ? { packLoadout: Object.freeze(packLoadout) } : {}),
      ...(task !== undefined ? { task } : {}), ...(packTask !== undefined ? { packTask } : {}), ...(packMaker !== undefined ? { packMaker } : {}),
      ...(closed ? { cabin, ...(slits ? { slits } : {}), mass: base.mass + (cab.mass ?? 0), laws: Object.freeze({ ...base.laws, ...(cab.laws ?? {}) }) } : {}),
    }));
  }
  return key;
}
/** An arm's tool card on a frame: its loadout's, or its mount's own (null on a frame whose arms are its own); `set` the
 *  arms it is on ('arms', or a giant arm pack's 'packArms'). */
export const toolOf = (archetype, S, set = 'arms') => {
  const a = archetypeRow(archetype), L = set === 'packArms' ? a.packLoadout ?? a.packMount?.loadout : a.loadout ?? a.mount?.loadout;
  if (!L) return null;
  // (a house's pack takes its house's own hand for the giant hand)
  return set === 'packArms' && a.packMaker && L[S].tool === 'giantHand' ? makerHand(a.packMaker) : MECHA_TOOLS[L[S].tool];
};
/** The frame a lone part is previewed on: the first whose layout carries it, or whose mount takes it. */
const homeOf = (sku) => MECHA_ARCHETYPE_IDS.find((id) => MECHA_ARCHETYPES[id].layout.some((e) => e.sku === sku))
  // (a tool or an arm kit in no frame's own layout: the first frame whose mount takes it)
  ?? MECHA_ARCHETYPE_IDS.find((id) => { const { mount: M, packMount: PM } = MECHA_ARCHETYPES[id]; return (M && (M.tools.some((t) => MECHA_TOOLS[t].sku === sku) || M.arms.some((a) => MECHA_ARM_KITS[a].fore === sku))) || (PM && PM.tools.some((t) => MECHA_TOOLS[t].sku === sku)); })
  // (a cabin to choose: the frame that offers it)
  ?? MECHA_ARCHETYPE_IDS.find((id) => Object.values(MECHA_ARCHETYPES[id].cabins ?? {}).some((c) => c.sku === sku))
  // (a design house's part: the first frame that carries a giant arm pack)
  ?? (MECHA_ODM[sku]?.build.maker ? MECHA_ARCHETYPE_IDS.find((id) => MECHA_ARCHETYPES[id].packMount) : null)
  ?? null;

// a part's geometry for its row, its side and its colours is pose-free: built once a process (its hardpoints, its outline)
const GEOM = new Map();
function geomOf(sku, side, C, part) {
  const key = `${sku}|${side ?? ''}|${JSON.stringify(C)}|${part ?? ''}`;
  if (!GEOM.has(key)) {
    const row = partRow(sku), k = row.dims.scale, build = MECHA_BUILDERS[row.kind];
    // (a part at another size is its design's: drawn at the design's size, then scaled, every length times k)
    GEOM.set(key, k ? scaleGeom(build({ ...row, dims: scaleDims(row.dims, 1 / k) }, C, { side, part }), k) : build(row, C, { side, part }));
  }
  return GEOM.get(key);
}
/** A builder's output scaled about its body's origin: every point, every radius, every section's offsets, times k. */
function scaleGeom(g, k) {
  const v = (p) => p.map((x) => round3(x * k) + 0), xyz = (p) => ({ x: round3(p.x * k), y: round3(p.y * k), z: round3(p.z * k) });
  const out = { ...g };
  if (g.lathes) out.lathes = g.lathes.map((m) => ({ ...m, axisFrom: xyz(m.axisFrom), axisTo: xyz(m.axisTo), profile: m.profile.map((q) => ({ t: q.t, radius: round3(q.radius * k) })) }));
  if (g.sweeps) out.sweeps = g.sweeps.map((m) => ({ ...m, path: m.path.map(v), radius: round3(m.radius * k) }));
  if (g.extrudes) out.extrudes = g.extrudes.map((m) => ({ ...m, axisFrom: xyz(m.axisFrom), axisTo: xyz(m.axisTo), profile: { ...m.profile, points: m.profile.points.map(v) } }));
  if (g.lofts) out.lofts = g.lofts.map((m) => ({ ...m, axisFrom: xyz(m.axisFrom), axisTo: xyz(m.axisTo), stations: m.stations.map((st) => ({ ...st, profile: st.profile.map(v) })) }));
  out.hardpoints = Object.fromEntries(Object.entries(g.hardpoints).map(([n, p]) => [n, v(p)]));
  if (g.outline) out.outline = g.outline.map(v);
  return out;
}

/**
 * One inventory row → a workbench recipe in metres, in its body's frame. `archetype` is the frame it is built for
 * (absent, the first that carries it); `side` a leg's hand ('r' | 'l'); `part` a ram's 'barrel' or 'rod';
 * `finish: false` keeps the bare tints.
 */
export function resolveMechaPart(sku, { archetype, side, part, palette, colors = {}, finish = true, title } = {}) {
  const row = partRow(sku), frame = archetype ?? homeOf(sku);
  if (!frame) throw new Error(`mecha part '${sku}' is on no frame yet: name an archetype to build it for`);
  if (side !== undefined && side !== 'r' && side !== 'l') throw new Error(`mecha part '${sku}': a side is 'r' or 'l'`);
  const { id: paletteId, colors: P } = resolveMechaPalette(palette, colors, archetypeRow(frame).palette);
  // (a design house's part in its house's livery over the frame's palette; the operator's own colours over both)
  const C = row.build.livery ? { ...P, ...row.build.livery, ...Object.fromEntries(Object.entries(colors || {}).map(([k, v]) => [k, v.toLowerCase()])) } : P;
  const geom = geomOf(sku, side, C, part);
  const monomers = Object.fromEntries(MONOMERS.filter((k) => geom[k] && geom[k].length).map((k) => [k, geom[k]]));
  return {
    kind: 'workbench',
    title: title || `${row.label} (${sku})${side ? `, ${side === 'l' ? 'left' : 'right'}` : ''}${part ? `, its ${part}` : ''}`,
    units: 'm',
    ...(finish ? applyFinish(monomers, C) : monomers),
    garage: {
      kind: row.kind,
      sku,
      family: row.build.family || null,
      label: row.label,
      classOf: row.classOf,
      frame,
      palette: paletteId,
      colors: clone(C),
      dims: clone(row.dims),
      mass: row.mass,
      localFrame: { forward: '+y', up: '+z', right: '+x', origin: row.kind === 'mecha-pelvis' ? 'midway between the hip yaw axes' : 'its pivot' },
      hardpoints: Object.fromEntries(Object.entries(geom.hardpoints).map(([k, v]) => [k, roundPt(v)])),
      ...(side ? { side } : {}),
      ...(part ? { part } : {}),
      finish: Boolean(finish),
    },
  };
}

// ── the chain's view of a frame's built parts ───────────────────────────────
const CTX = new Map();
/** What the chain reads: a body's hardpoints (its side's own build), a row, a body's outline. */
export function mechaCtx(archetype) {
  if (CTX.has(archetype)) return CTX.get(archetype);
  const arch = archetypeRow(archetype), { colors: C } = resolveMechaPalette(undefined, {}, arch.palette);
  const entry = (id) => { const e = arch.layout.find((x) => x.id === id); if (!e) throw new Error(`mecha ${archetype}: no body '${id}'`); return e; };
  const geom = (id) => { const e = entry(id); return geomOf(e.sku, e.side, C); };
  const ctx = {
    arch,
    row: (sku) => partRow(sku),
    entry,
    hp: (body, name) => {
      const v = geom(body).hardpoints[name];
      if (!v) throw new Error(`mecha ${archetype}: the ${body} has no hardpoint '${name}'`);
      return v;
    },
    outline: (body) => geom(body).outline ?? null,
  };
  CTX.set(archetype, ctx);
  return ctx;
}

/** A joint's range: its ram's (where it lies within its stroke) or its rotary drive's stops; degrees. */
export function jointRange(archetype, name) {
  const ctx = mechaCtx(archetype), arch = ctx.arch, J = arch.joints[name];
  if (!J) throw new Error(`mecha ${archetype}: '${name}' is not one of its joints (${Object.keys(arch.joints).join(', ')})`);
  if (J.drive) return [...partRow(ctx.entry(J.drive).sku).dims.stop];
  return rangeOf(arch, name, ctx);
}
export const jointRanges = (archetype) => Object.fromEntries(Object.keys(archetypeRow(archetype).joints).map((k) => [k, jointRange(archetype, k)]));

// ── mass: every part where it is posed ──────────────────────────────────────
const CENTROIDS = new Map();
/** A built part's corners and their centroid in its own frame (lowered once a process). */
export function partShape(archetype, sku, side, part) {
  const key = `${archetype}|${sku}|${side ?? ''}|${part ?? ''}`;
  if (!CENTROIDS.has(key)) {
    const pts = [];
    for (const f of lowerObjectFaces(resolveMechaPart(sku, { archetype, side, part, finish: false }))) for (const c of f.corners) pts.push(c);
    const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    CENTROIDS.set(key, { corners: pts, centroid: c });
  }
  return CENTROIDS.get(key);
}
const worldFrames = (frames, root) => Object.fromEntries(Object.entries(frames).map(([k, T]) => [k, compose(root, T)]));
/**
 * The frame's mass and centre of mass at joint values, its pelvis at `root`: each body's row mass at its centroid, a
 * ram's at its pins' midpoint, (`rider`, the default) the rated rider at the seat, and a `load` (kg) held in the claws,
 * half at each claw's tip. `parts` each { id, mass, at }.
 */
export function massOf(archetype, joints, root = { R: I3, t: [0, 0, 0] }, { rider = true, load = 0, loadOn = 'arms' } = {}) {
  const ctx = mechaCtx(archetype), arch = ctx.arch, F = worldFrames(framesOf(arch, joints, ctx), root), parts = [];
  for (const e of arch.layout) {
    const row = partRow(e.sku);
    if (isStrut(e)) {
      const [a, b] = e.ram.map((ref) => { const i = ref.indexOf('.'); return apply(F[ref.slice(0, i)], ctx.hp(ref.slice(0, i), ref.slice(i + 1))); });
      parts.push({ id: e.id, mass: row.mass, at: a.map((v, k) => (v + b[k]) / 2) });
      continue;
    }
    parts.push({ id: e.id, mass: row.mass, at: apply(F[e.id], partShape(archetype, e.sku, e.side).centroid) });
  }
  if (rider && arch.rider) {
    const sit = apply(F.seat, ctx.hp('seat', 'sit'));
    parts.push({ id: 'rider', mass: arch.rider.mass, at: sit.map((v, k) => v + arch.rider.com[k]) });
  }
  // (a load in the claws: shared by the arms whose tools hold, at each tool's working point)
  if (load > 0 && arch[loadOn]) {
    const holding = ['r', 'l'].filter((S) => (toolOf(archetype, S, loadOn)?.holds ?? 1) > 0);
    for (const S of holding) { const c = arch[loadOn][S].claw; parts.push({ id: `load.${S}`, mass: load / holding.length, at: apply(F[c], ctx.hp(c, 'tip')) }); }
  }
  const mass = parts.reduce((s, p) => s + p.mass, 0);
  const com = [0, 1, 2].map((k) => parts.reduce((s, p) => s + p.mass * p.at[k], 0) / mass);
  return { mass, com, parts, frames: F };
}

// ── poses ───────────────────────────────────────────────────────────────────
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const STANCE_KEYS = Object.freeze(['knee', 'height', 'track', 'fore', 'sway', 'feet', 'arms', 'packArms', 'load', 'loadOn']);
const POSED = new Map();
/**
 * A pose → { stance, joints (degrees), root (the pelvis's frame in the machine's), feet, legs }: a stance's name (the
 * archetype's), a stance ({ knee | height, … }: mecha-ik.js), or { joints, root? } (joint values as given, the pelvis
 * where `root` puts it, else at its standing height).
 */
export function posedFrame(archetype, pose) {
  const ctx = mechaCtx(archetype), arch = ctx.arch, word = pose ?? arch.rest;
  const key = `${archetype}|${JSON.stringify(word)}`;
  if (POSED.has(key)) return POSED.get(key);
  const stand = () => posedFrame(archetype, 'stand').root.t[2];
  const com = (joints, root, load = 0, loadOn) => massOf(archetype, joints, root, { load, loadOn }).com;
  let out;
  if (typeof word === 'string') {
    const st = arch.stances[word];
    if (!st) throw new Error(`mecha ${archetype}: pose '${word}' is one of ${Object.keys(arch.stances).join(', ')}, a stance { ${STANCE_KEYS.join(', ')} }, or { joints }`);
    out = { stance: word, ...solveStance(arch, ctx, st, { com, stand: word === 'stand' ? undefined : stand() }) };
  } else if (isObj(word) && word.joints) {
    for (const k of Object.keys(word.joints)) if (!arch.joints[k]) throw new Error(`mecha ${archetype}: '${k}' is not one of its joints (${Object.keys(arch.joints).join(', ')})`);
    const base = posedFrame(archetype, 'stand');
    const t = Array.isArray(word.root) ? word.root : base.root.t;
    out = { stance: 'joints', joints: { ...base.joints, ...word.joints }, root: { R: I3, t: [...t] }, feet: null, legs: null, load: 0 };
  } else if (isObj(word)) {
    for (const k of Object.keys(word)) if (!STANCE_KEYS.includes(k)) throw new Error(`mecha ${archetype}: '${k}' is not a stance's word (${STANCE_KEYS.join(', ')}, or { joints })`);
    out = { stance: 'stance', ...solveStance(arch, ctx, word, { com, stand: stand() }) };
  } else throw new Error(`mecha ${archetype}: a pose is a stance's name, a stance { ${STANCE_KEYS.join(', ')} }, or { joints }`);
  // (each joint held to its range: a stance its actuators cannot hold is clamped, and said)
  const clamped = [], joints = {};
  for (const [k, v] of Object.entries(out.joints)) {
    const r = jointRange(archetype, k);
    if (r && (v < r[0] - 1e-6 || v > r[1] + 1e-6)) clamped.push(k);
    joints[k] = Math.round((r ? Math.max(r[0], Math.min(r[1], v)) : v) * 100) / 100;
  }
  const res = Object.freeze({ ...out, joints, wanted: out.joints, clamped, reached: Object.values(out.legs ?? {}).every((l) => l.reach) });
  POSED.set(key, res);
  return res;
}

/** The rider's points at a pose, in the machine's frame: the saddle's sit point, each grip, each peg (cycle-rider.js's
 *  `seat`, `grip.l|r`, `peg.l|r`). */
export function riderPoints(archetype, pose) {
  const ctx = mechaCtx(archetype), arch = ctx.arch, P = posedFrame(archetype, pose);
  const F = worldFrames(framesOf(arch, P.joints, ctx), P.root), at = (b, h) => apply(F[b], ctx.hp(b, h)).map(r3);
  return { seat: at('seat', 'sit'), 'grip.l': at('seat', 'grip.l'), 'grip.r': at('seat', 'grip.r'), 'peg.l': at('seat', 'peg.l'), 'peg.r': at('seat', 'peg.r') };
}

/**
 * An archetype at a pose → `{ manifest, readout }`: an assembler recipe of its bodies, each placed by its frame, and its
 * rams aimed between their pins. The readout says the pose's stance, its joints and every joint's range, the laws (read
 * at the archetype's own stances: mecha-laws.js; `laws: false` skips them, for a frame drawn as scenery), the measures
 * as it stands, the rider's points, the BOM.
 */
export function assembleFrame(archetypeIn, { pose, palette, colors = {}, finish = true, title, laws: read = true, task, tools, arms, packTask, packTools, packMaker, cabin, slits } = {}) {
  const archetype = composeFrame(archetypeIn, { task, tools, arms, packTask, packTools, packMaker, cabin, slits });
  const ctx = mechaCtx(archetype), arch = ctx.arch, P = posedFrame(archetype, pose);
  const chain = solveChain(arch, P.joints, ctx), root = P.root;
  const src = (e, part) => resolveMechaPart(e.sku, { archetype, side: e.side, part: part ?? e.part, palette, colors, finish });
  const place = (id, source, T0) => {
    const T = compose(root, T0), rot = eulerXYZ(T.R).map((d) => round3(d) || 0);
    return { id, source, at: T.t.map((v) => round3(v) + 0), ...(rot.some(Boolean) ? { rotate: rot } : {}) };
  };
  const items = [];
  for (const e of arch.layout) if (!isStrut(e)) items.push(place(e.id, src(e), chain.frames[e.id]));
  for (const s of chain.struts) items.push(place(s.item, src(ctx.entry(s.id), s.kind), s.frame));
  const manifest = { kind: 'assembler', title: title || `${arch.label} (${arch.classOf})`, units: 'm', items };
  const laws = read ? lawsOf(archetype) : null;
  // (a ram counts once: its rod is its barrel's)
  const bom = planAssemblyBom(items.filter((it) => !/\.rod$/.test(it.id)).map((it) => ({ garage: { kind: it.source.garage.kind } })), arch.bom);
  const M = massOf(archetype, P.joints, root, { load: P.load, loadOn: P.loadOn });
  return {
    manifest,
    readout: {
      archetype: archetypeIn,
      ...(archetype !== archetypeIn ? { composed: archetype } : {}),
      ...(arch.loadout ?? arch.mount?.loadout ? { loadout: arch.loadout ?? arch.mount.loadout } : {}),
      ...(arch.packLoadout ?? arch.packMount?.loadout ? { packLoadout: arch.packLoadout ?? arch.packMount.loadout } : {}),
      ...(arch.packMaker ? { packMaker: arch.packMaker } : {}),
      ...(arch.cabin ? { cabin: arch.cabin, ...(arch.slits ? { slits: arch.slits } : {}) } : {}),
      label: arch.label,
      classOf: arch.classOf,
      pose: typeof pose === 'string' ? pose : pose ? P.stance : arch.rest,
      joints: P.joints,
      ...(P.clamped.length ? { clamped: P.clamped } : {}),
      root: P.root.t.map(r3),
      ranges: jointRanges(archetype),
      rams: chain.struts.filter((s) => s.kind === 'barrel').map((s) => ({ id: s.item, length: r3(s.length) })),
      measures: measureFrame(manifest),
      rider: riderPoints(archetype, pose),
      // (a dressed frame's kit: each fitting's anchor where its body stands, mecha-military.js fits it there)
      ...(arch.dress ? { anchors: arch.dress.kit.map((k) => {
        const T = compose(root, chain.frames[k.body]);
        return { id: k.id, kind: k.kind, card: k.card, opts: k.opts, at: apply(T, ctx.hp(k.body, k.id)).map(r3), out: turn(T, k.out).map(r3), up: turn(T, k.up).map(r3), ...(k.opts.role ? { role: k.opts.role, h: k.opts.h } : {}) };
      }) } : {}),
      mass: { parts: Math.round(M.mass - (arch.rider?.mass ?? 0) - (P.load ?? 0)), gross: Math.round(M.mass), ...(P.load ? { load: P.load } : {}), com: M.com.map(r3) },
      ...(laws ? { laws: { ok: laws.ok, laws: laws.laws } } : {}),
      audit: { ok: bom.ok && !bom.surplus.length, bom },
    },
  };
}

/** The laws a frame is held to (mecha-laws.js), read once a process at its own stances. */
export function lawsOf(archetype) {
  const ctx = mechaCtx(archetype);
  return mechaLaws(ctx.arch.key, {
    ctx,
    posed: (pose) => posedFrame(archetype, pose),
    massOf: (joints, root, opts) => massOf(archetype, joints, root, opts),
    range: (name) => jointRange(archetype, name),
    shape: (sku, side, part) => partShape(archetype, sku, side, part),
    frames: (joints, root) => worldFrames(framesOf(ctx.arch, joints, ctx), root),
    tool: (S, set) => toolOf(archetype, S, set),
  });
}

/** What an assembled frame measures as it stands, from its parts' bounds. */
export function measureFrame(manifest) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of resolveAssemblerPlacements(manifest)) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p.bounds.min[k]); max[k] = Math.max(max[k], p.bounds.max[k]); }
  return { length: r2(max[1] - min[1]), width: r2(max[0] - min[0]), height: r2(max[2] - min[2]), ground: r3(min[2]) };
}

export { G };

// ── words ───────────────────────────────────────────────────────────────────
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let INDEX = null;
/** Every word that names a part → its sku. One word, one part: a collision throws. */
export function mechaNameIndex() {
  if (INDEX) return INDEX;
  const index = new Map();
  for (const [sku, row] of Object.entries(MECHA_ODM)) {
    for (const word of [sku, row.label, ...(row.aliases || [])]) {
      const key = norm(word);
      if (index.has(key) && index.get(key) !== sku) throw new Error(`mecha word '${key}' names both ${index.get(key)} and ${sku}`);
      index.set(key, sku);
    }
  }
  INDEX = index;
  return index;
}
/** The words people say ('knee ram', 'roll cage') → the part number, or null. */
export const findMechaPart = (words) => mechaNameIndex().get(norm(words)) || null;
