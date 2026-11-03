/**
 * construction-shelf — the machines that dig, push, load, haul and lift on a site, as ONE shelf: the inventory
 * (con-odm.js), a builder per kind (con-parts.js), the archetypes that lay whole machines out in layers
 * (con-archetypes.js), the kinematic chain they are posed on (con-chain.js) and the laws they are held to (con-laws.js).
 * The craft and cycle shelves' grammar: the same `garage` block on every part, the same advisory BOM audit, the same
 * colour roles.
 *
 *   resolveConPart(sku, opts)          one inventory row → a workbench recipe in its body's frame (metres)
 *   assembleMachine(archetype, opts)   an archetype at a pose → an assembler recipe and its readout (its joints and
 *                                      their ranges, its envelope, its laws, its measures, the BOM)
 *   posedJoints(archetype, pose)       a pose (a name, or joint values, or shares of each joint's range) → degrees
 *   machineCtx(archetype)              what the chain reads of its built parts (con-chain.js ctx)
 *   findConPart(words)                 the words people say → a part number
 *
 * Every body is authored in its own frame (con-common.js), so a pose moves no part's geometry: it moves frames. A ram's
 * barrel and rod and a link are aimed between their pins at the pose; nothing is drawn again.
 *
 * Pure: no clock, no dice. An archetype row and an inventory row are compatibility promises over what is minted.
 */
import { planAssemblyBom } from '../vehicle-designer/assembly-bom.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { CON_COLOR_ROLES, CON_PALETTES, apply, clone, eulerXYZ, resolveConPalette, round3 } from './con-common.js';
import { CON_BUILDERS } from './con-parts.js';
import { CON_KINDS, CON_ODM, scaleDims } from './con-odm.js';
import { CON_ARCHETYPES, CON_CARRIERS, CON_MOUNTS, toolSku, towerCraneAt } from './con-archetypes.js';
import { framesOf, isStrut, rangeOf, solveChain } from './con-chain.js';
import { conLaws } from './con-laws.js';

export { CON_ARCHETYPES, CON_CARRIERS, CON_COLOR_ROLES, CON_KINDS, CON_MOUNTS, CON_ODM, CON_PALETTES };

const MONOMERS = ['lathes', 'extrudes', 'sweeps', 'lofts'];

// what each colour role is made of: the machine's paint a gloss enamel, the castings a dull sheen, a ram's rod polished
// chrome, the tyres and hoses rubber, the cab's glazing glass
const ENAMEL = { preset: 'satin', ambient: 0.48, diffuse: 0.6, specular: 0.32, shininess: 24 };
const SHEEN = { preset: 'satin', ambient: 0.46, diffuse: 0.6, specular: 0.14, shininess: 10 };
const FINISH = { paint: ENAMEL, trim: SHEEN, chrome: { metal: 'chrome', finish: 'polished' }, rubber: 'rubber', glass: 'glass', light: SHEEN };
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** The role a tint was drawn from: its own colour, or the role whose colour it was toned from (the nearest). */
function roleOf(tint, C) {
  const exact = CON_COLOR_ROLES.find((r) => C[r] === tint);
  if (exact) return exact;
  const t = hexRGB(tint);
  let best = 'paint', d = Infinity;
  for (const r of CON_COLOR_ROLES) {
    const c = hexRGB(C[r]), e = (c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2;
    if (e < d) { d = e; best = r; }
  }
  return best;
}
const applyFinish = (monomers, C) => Object.fromEntries(Object.entries(monomers).map(([k, list]) => [k, list.map((m) => (m.material ? m : { ...m, material: clone(FINISH[roleOf(m.tint, C)]) }))]));
const roundPt = (v) => (Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? roundPt(x) : round3(x) + 0)) : v);

function partRow(sku) {
  const row = CON_ODM[sku];
  if (!row) throw new Error(`Unknown construction part '${sku}'; the inventory lists ${Object.keys(CON_ODM).join(', ')} (or findConPart('<words>'))`);
  return row;
}
// (a machine the door composed, its tool or its carrier swapped, under its own key: 'crawlerExcavator+breaker')
const COMPOSED = new Map();
function archetypeRow(id) {
  const row = CON_ARCHETYPES[id] ?? COMPOSED.get(id);
  if (!row) throw new Error(`Unknown construction archetype '${id}'; expected one of: ${Object.keys(CON_ARCHETYPES).join(', ')}`);
  return { ...row, key: id };
}
// (what a bucket's envelope is measured as: a tool other than the machine's bucket reads it, never held to it)
const BUCKET_BANDS = Object.freeze(['reach', 'depth', 'dumpHeight', 'cutHeight']);
/** A machine's height under its hook, its hook hoisted all the way up (its tip at the hoist's zero). */
function hookHeight(row) {
  const ctx = machineCtx(row.key), [b, h] = row.tip.split('.');
  return apply(framesOf(row, { hoist: 0 }, ctx)[b], ctx.hp(b, h))[2];
}
/**
 * A machine with the door's swaps → its key: its carrier (one the machine lists: the machine it makes, a skid steer on
 * tracks the compact track loader) and its tool (one its mount takes, in its bucket's place on its tool joint). The laws
 * re-read it as built: a tool's mass in its lift, its outline against its cab; a bucket's envelope bands are the
 * machine's bucket's, so another tool's envelope is read, not held to them. A swap the machine does not take is refused,
 * naming what it takes.
 */
export function composeMachine(archetype, { tool, carrier, height } = {}) {
  let key = archetype;
  if (height !== undefined) {
    // (a tower crane built to the height under its hook the operator names: the nearest number of its mast's sections)
    const base = archetypeRow(key), M = base.sections;
    if (!M) throw new Error(`construction ${base.label}: its height is its own (only a machine built in sections takes a height)`);
    if (!Number.isFinite(height)) throw new Error(`construction ${base.label}: a height is metres under its hook`);
    const per = partRow(M.sku).dims.length, now = hookHeight(base), k = Math.max(M.min, Math.min(M.max, M.n + Math.round((height - now) / per)));
    if (k !== M.n) {
      const composed = `${key}@${k}`;
      if (!COMPOSED.has(composed)) COMPOSED.set(composed, Object.freeze({ ...towerCraneAt(k), label: `${base.label}, ${k} mast sections` }));
      key = composed;
    }
  }
  if (carrier) {
    const base = archetypeRow(key), C = CON_CARRIERS[carrier];
    if (!C) throw new Error(`Unknown construction carrier '${carrier}'; expected one of: ${Object.keys(CON_CARRIERS).join(', ')}`);
    if (!(base.carriers ?? []).includes(carrier) || !C.makes?.[key]) throw new Error(`construction ${base.label}: its carrier is its own${(base.carriers ?? []).length ? `, or ${base.carriers.join(', ')}` : ''} (not '${carrier}')`);
    key = C.makes[key];
  }
  if (tool) {
    const base = archetypeRow(key), sku = toolSku(base, tool), e = base.layout.find((x) => x.joint === 'tool');
    if (!e) throw new Error(`construction ${base.label}: it has no tool joint to swap`);
    partRow(sku);
    if (sku === e.sku) return key;
    const composed = `${key}+${tool}`;
    if (!COMPOSED.has(composed)) {
      const from = partRow(e.sku).kind, to = partRow(sku).kind, bom = { ...base.bom };
      bom[from] -= 1; if (!bom[from]) delete bom[from];
      bom[to] = (bom[to] ?? 0) + 1;
      const measure = Object.fromEntries(Object.entries(base.laws.measure ?? {}).filter(([, m]) => m.point.split('.')[0] !== e.id));
      // (its mass the class's with this tool in its bucket's place; its rated lift with the tool hung on read against
      // tipping alone: it lifts something, or nothing, and does not tip)
      const L = base.laws.lift, lift = L ? (Array.isArray(L) ? { band: [0, L[1]], radius: 6, height: 1.5 } : { ...L, band: [0, L.band[1]] }) : undefined;
      const laws = Object.freeze({ ...Object.fromEntries(Object.entries(base.laws).filter(([k]) => !BUCKET_BANDS.includes(k))), measure, ...(lift ? { lift } : {}), massShift: (base.laws.massShift ?? 0) + partRow(sku).mass - partRow(e.sku).mass });
      COMPOSED.set(composed, Object.freeze({ ...base, label: `${base.label} with a ${partRow(sku).label}`, layout: Object.freeze(base.layout.map((x) => (x === e ? Object.freeze({ ...x, sku }) : x))), bom: Object.freeze(bom), laws, tool }));
    }
    key = composed;
  }
  return key;
}

/** The machine a lone part is previewed on: the first whose layout carries it, or whose mount takes it. */
function homeOf(sku) {
  for (const [id, row] of Object.entries(CON_ARCHETYPES)) if (row.layout.some((x) => x.sku === sku)) return id;
  // (a tool in no machine's layout: the first machine whose mount takes it)
  for (const [id, row] of Object.entries(CON_ARCHETYPES)) if (row.mount && Object.values(CON_MOUNTS[row.mount.family].tools).some((stem) => `${stem}-${row.mount.size}` === sku)) return id;
  return null;
}

// a part's geometry for its row and its machine is pose-free: built once a process (its hardpoints, its outline)
const GEOM = new Map();
function geomOf(sku, machine, C, part) {
  const key = `${sku}|${machine}|${JSON.stringify(C)}|${part ?? ''}`;
  if (!GEOM.has(key)) {
    const row = partRow(sku), arch = archetypeRow(machine), k = row.dims.scale;
    // (a part at another size is its design's: drawn at the design's size, then scaled, every length times k)
    const built = k ? scaleGeom(CON_BUILDERS[row.kind]({ ...row, dims: scaleDims(row.dims, 1 / k) }, C, { physics: PHYSICS[arch.physics], machine, part }), k)
      : CON_BUILDERS[row.kind](row, C, { physics: PHYSICS[arch.physics], machine, part });
    GEOM.set(key, built);
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
 * One inventory row → a workbench recipe in metres, in its body's frame. `archetype` is the machine it is built for
 * (absent, the first that carries it); `part` a ram's 'barrel' or 'rod'; `finish: false` keeps the bare tints.
 */
export function resolveConPart(sku, { archetype, part, palette, colors = {}, finish = true, title } = {}) {
  const row = partRow(sku), machine = archetype ?? homeOf(sku);
  if (!machine) throw new Error(`construction part '${sku}' is on no machine yet: name an archetype to build it for`);
  const { id: paletteId, colors: C } = resolveConPalette(palette, colors, archetypeRow(machine).palette);
  const geom = geomOf(sku, machine, C, part);
  const monomers = Object.fromEntries(MONOMERS.filter((k) => geom[k] && geom[k].length).map((k) => [k, geom[k]]));
  return {
    kind: 'workbench',
    title: title || `${row.label} (${sku})${part ? `, its ${part}` : ''}`,
    units: 'm',
    ...(finish ? applyFinish(monomers, C) : monomers),
    garage: {
      kind: row.kind,
      sku,
      family: row.build.family || null,
      label: row.label,
      classOf: row.classOf,
      machine,
      palette: paletteId,
      colors: clone(C),
      dims: clone(row.dims),
      mass: row.mass,
      localFrame: { forward: '+y', up: '+z', right: '+x', origin: row.kind === 'con-undercarriage' ? 'the slew axis on the ground' : 'its pivot' },
      hardpoints: Object.fromEntries(Object.entries(geom.hardpoints).map(([k, v]) => [k, roundPt(v)])),
      ...(part ? { part } : {}),
      finish: Boolean(finish),
    },
  };
}

// ── the chain's view of a machine's built parts ─────────────────────────────
const CTX = new Map();
/** What the chain reads: a body's hardpoints (a pair's side its own, `hp.r`), a row, a body's outline and centroid. */
export function machineCtx(archetype) {
  if (CTX.has(archetype)) return CTX.get(archetype);
  const arch = archetypeRow(archetype), { colors: C } = resolveConPalette(undefined, {}, arch.palette);
  const entry = (id) => { const e = arch.layout.find((x) => x.id === id); if (!e) throw new Error(`construction ${archetype}: no body '${id}'`); return e; };
  const geom = (id) => geomOf(entry(id).sku, archetype, C);
  const ctx = {
    arch,
    row: (sku) => partRow(sku),
    entry,
    hp: (body, name, side) => {
      const H = geom(body).hardpoints, v = (side && H[`${name}.${side}`]) ?? H[name];
      if (!v) throw new Error(`construction ${archetype}: the ${body} has no hardpoint '${name}'`);
      return v;
    },
    outline: (body) => geom(body).outline ?? null,
  };
  CTX.set(archetype, ctx);
  return ctx;
}

/** A pose → its joint values in degrees: a named pose, or { joint: degrees }; a named pose's shares and its ground. */
export function posedJoints(archetype, pose = 'rest') {
  const ctx = machineCtx(archetype), arch = ctx.arch;
  const named = typeof pose === 'string' ? arch.poses[pose] : null;
  if (typeof pose === 'string' && !named) throw new Error(`construction ${archetype}: pose '${pose}' is one of ${Object.keys(arch.poses).join(', ')}, or joint values { ${Object.keys(arch.joints).join(', ')} }`);
  const spec = named ?? pose;
  if (!spec || typeof spec !== 'object') throw new Error(`construction ${archetype}: a pose is a name or { joint: degrees }`);
  for (const k of Object.keys(spec)) if (!arch.joints[k]) throw new Error(`construction ${archetype}: '${k}' is not one of its joints (${Object.keys(arch.joints).join(', ')})`);
  const out = {}, level = [], ground = [];
  for (const [name, J] of Object.entries(arch.joints)) {
    const r = rangeOf(arch, name, ctx), v = spec[name];
    if (v === 'ground') { ground.push(name); out[name] = r ? (r[0] + r[1]) / 2 : 0; continue; }
    if (v === 'level') { level.push(name); out[name] = 0; continue; }
    // (a named pose's joint is a share of its range; the operator's own values are degrees)
    out[name] = named && r && Number.isFinite(v) ? r[0] + v * (r[1] - r[0]) : Number.isFinite(v) ? v : r ? (r[0] + r[1]) / 2 : 0;
  }
  // (a tool held level turns back what the hinges above it turned, within its range; set again as the ground is sought)
  const levelled = (j) => { const o = { ...j }; for (const name of level) { const r = rangeOf(arch, name, ctx), v = -hingesAbove(arch, name, o); o[name] = r ? Math.max(r[0], Math.min(r[1], v)) : v; } return o; };
  // (each joint set down in turn: a backhoe's loader, its backhoe, its stabilisers)
  for (const g of ground) out[g] = groundJoint(arch, ctx, out, g, levelled);
  Object.assign(out, levelled(out));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

/** The tool's lowest point over the ground at joint values (its outline and its tip, in the machine's frame). */
export function toolLow(arch, ctx, joints) {
  const [body] = arch.tip.split('.'), F = framesOf(arch, joints, ctx)[body];
  return Math.min(...(ctx.outline(body) ?? [ctx.hp(body, arch.tip.split('.')[1])]).map((p) => apply(F, p)[2]));
}
/** The sum of the hinges' values between a joint's body and the root (what a tool held level turns back). */
function hingesAbove(arch, name, joints) {
  let e = arch.layout.find((x) => x.joint === name), sum = 0;
  for (e = e && arch.layout.find((x) => x.id === e.on.split('.')[0]); e; e = e.on ? arch.layout.find((x) => x.id === e.on.split('.')[0]) : null) {
    if (e.joint && arch.joints[e.joint].kind === 'hinge') sum += joints[e.joint] ?? 0;
  }
  return sum;
}

/** The bodies a joint carries (its own, and every body hung below them), and the lowest of their outlines' points over
 *  the ground at joint values. */
function lowBelow(arch, ctx, joints, name) {
  const under = (e) => { for (let x = e; x; x = x.on ? arch.layout.find((y) => y.id === x.on.split('.')[0]) : null) if (x.joint === name) return true; return false; };
  const bodies = arch.layout.filter((e) => !isStrut(e) && under(e) && ctx.outline(e.id));
  const F = framesOf(arch, joints, ctx);
  return Math.min(...bodies.flatMap((e) => ctx.outline(e.id).map((p) => apply(F[e.id], p)[2])));
}
/** The joint value, lowering from the end of its range that holds what it carries highest (a boom's top, a
 *  stabiliser's stowed end), at which what it carries first touches the ground. */
function groundJoint(arch, ctx, joints, name, settle = (j) => j) {
  const r = rangeOf(arch, name, ctx), at = (v) => lowBelow(arch, ctx, settle({ ...joints, [name]: v }), name);
  const [from, to] = at(r[1]) >= at(r[0]) ? [r[1], r[0]] : [r[0], r[1]], step = from > to ? -0.5 : 0.5;
  let hi = from, lo = null;
  for (let v = from; step < 0 ? v >= to : v <= to; v += step) { if (at(v) <= 0) { lo = v; break; } hi = v; }
  if (lo === null) return to;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (at(m) <= 0) lo = m; else hi = m; }
  return hi;
}

/**
 * An archetype at a pose → `{ manifest, readout }`: an assembler recipe of its bodies, each placed by its frame, and its
 * struts aimed between their pins. The readout says the pose's joints and every joint's range, the laws (read at the
 * machine's own reference poses: con-laws.js), the measures as it stands, the BOM.
 */
export function assembleMachine(archetypeIn, { pose = 'rest', palette, colors = {}, finish = true, title, tool, carrier, height } = {}) {
  const archetype = composeMachine(archetypeIn, { tool, carrier, height });
  const ctx = machineCtx(archetype), arch = ctx.arch, joints = posedJoints(archetype, pose);
  const chain = solveChain(arch, joints, ctx);
  const src = (sku, part) => resolveConPart(sku, { archetype, part, palette, colors, finish });
  const place = (id, source, T, scale) => {
    const rot = eulerXYZ(T.R).map((d) => round3(d) || 0);
    return { id, source, at: T.t.map((v) => round3(v) + 0), ...(rot.some(Boolean) ? { rotate: rot } : {}), ...(scale ? { scale } : {}) };
  };
  const items = [];
  for (const e of arch.layout) if (!isStrut(e)) items.push(place(e.id, src(e.sku), chain.frames[e.id]));
  for (const s of chain.struts) items.push(place(s.item, src(ctx.entry(s.id).sku, s.kind === 'link' || s.kind === 'rope' ? undefined : s.part ?? s.kind), s.frame, s.scale));
  const manifest = { kind: 'assembler', title: title || `${arch.label} (${arch.classOf})`, units: 'm', items };
  const laws = conLaws(arch, ctx, { corners: (sku, part) => partCorners(archetype, sku, part), physics: PHYSICS[arch.physics], posed: (name) => posedJoints(archetype, name) });
  // (a ram counts once: its rod and its stages are the barrel's; a rope once, its lengths its first's)
  const bom = planAssemblyBom(items.map((it) => ({ garage: { kind: it.source.garage.kind } })).filter((x, i) => !/\.(rod|s\d+|f\d+)$/.test(items[i].id)), arch.bom);
  return {
    manifest,
    readout: {
      archetype: archetypeIn,
      ...(archetype !== archetypeIn ? { composed: archetype } : {}),
      ...(tool ? { tool } : {}),
      ...(carrier ? { carrier } : {}),
      ...(arch.sections ? { height: Math.round(hookHeight(arch) * 100) / 100, sections: arch.layout.filter((e) => e.sku === arch.sections.sku).length } : {}),
      label: arch.label,
      classOf: arch.classOf,
      physics: arch.physics,
      pose: typeof pose === 'string' ? pose : 'joints',
      joints: chain.joints,
      ...(chain.clamped.length ? { clamped: chain.clamped } : {}),
      ranges: Object.fromEntries(Object.keys(arch.joints).map((k) => [k, rangeOf(arch, k, ctx)])),
      rams: chain.struts.filter((s) => s.kind === 'barrel').map((s) => ({ id: s.item, length: Math.round(s.length * 1000) / 1000 })),
      measures: measureMachine(manifest),
      envelope: laws.envelope,
      laws: { ok: laws.ok, laws: laws.laws },
      partsMass: laws.mass,
      audit: { ok: bom.ok && !bom.surplus.length, bom },
    },
  };
}

const r2 = (n) => Math.round(n * 100) / 100;
/** What an assembled machine measures as it stands, from its parts' bounds. */
export function measureMachine(manifest) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of resolveAssemblerPlacements(manifest)) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p.bounds.min[k]); max[k] = Math.max(max[k], p.bounds.max[k]); }
  return { length: r2(max[1] - min[1]), width: r2(max[0] - min[0]), height: r2(max[2] - min[2]) };
}

// ── a part's own corners and centroid, lowered once (the laws place its mass and measure its swing) ─────────────
const CORNERS = new Map();
/** A built part's face corners in its own frame (lowered once a process). */
export function partCorners(archetype, sku, part) {
  const key = `${archetype}|${sku}|${part ?? ''}`;
  if (!CORNERS.has(key)) {
    const faces = lowerObjectFaces(resolveConPart(sku, { archetype, part, finish: false }));
    const pts = [];
    for (const f of faces) for (const c of f.corners) pts.push(c);
    CORNERS.set(key, pts);
  }
  return CORNERS.get(key);
}

// ── words ───────────────────────────────────────────────────────────────────
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let INDEX = null;
/** Every word that names a part → its sku. One word, one part: a collision throws. */
export function conNameIndex() {
  if (INDEX) return INDEX;
  const index = new Map();
  for (const [sku, row] of Object.entries(CON_ODM)) {
    for (const word of [sku, row.label, ...(row.aliases || [])]) {
      const key = norm(word);
      if (index.has(key) && index.get(key) !== sku) throw new Error(`construction word '${key}' names both ${index.get(key)} and ${sku}`);
      index.set(key, sku);
    }
  }
  INDEX = index;
  return index;
}
/** The words people say ('bucket ram', 'dipper') → the part number, or null. */
export const findConPart = (words) => conNameIndex().get(norm(words)) || null;
