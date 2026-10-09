/**
 * THE CIVILIZATION TUNNEL: TECHNOLOGY — tools, machines, installations and automations, tunnelled from a few words
 * into a BLOCK the civilization keeps (era/blocks.js). Conceptual and visual only: a function is what the eye must find
 * (era/blocks.js FUNCTIONS), and the tunnel lays out, on a body, a part for every read each function needs:
 *
 *   below   what it stands or runs on: wheels, a track pair, legs, a pad
 *   body    the box (a drum when it holds, a dome when it keeps): the piece that leads
 *   top     what it collects, listens with, tells with, takes in: wings or a rotor, a dish, a beacon, a hopper
 *   front   what comes out and what is driven from: a belt, a boom and its hook, a cab's readout, a door
 *   beside  what it holds apart from its body: a tank
 *   arm     an automation's arm and its cycle
 *
 * Every size is a multiple of the tier's unit, so a tool and an installation are the same grammar at another scale.
 * The laws (blockLaws) and each trait's measure assess it; a tweak moves sizes and counts inside their rails; the plan
 * is the block, ready for a civilization's library.
 *
 *   TECH_TRAITS                            the traits, by the words that name them
 *   techDomain({ library })                → a tunnel domain (gameworld/tunnel.js)
 *   tunnelTech(intent, { seed, library })  → the tunnel's record; its plan { block }
 *
 * Pure; seeded dice only.
 */
import { tunnel } from './tunnel.js';
import { buildBlock, blockLaws, readBlock, FUNCTIONS, TIERS, PRIMITIVES } from '../era/blocks.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';

const r2 = (v) => Math.round(v * 100) / 100;
const clone = (v) => JSON.parse(JSON.stringify(v));
const F = (fn, words, read) => ({ words, read, fn });
const M = (words, read, set) => ({ words, read, set });

/** Function traits name what it does; modifier traits how it looks doing it. */
export const TECH_TRAITS = Object.freeze({
  power: F('power', ['power', 'generator', 'solar', 'wind', 'turbine', 'reactor', 'charger'], FUNCTIONS.power.read),
  store: F('store', ['tank', 'store', 'storage', 'silo', 'battery', 'cells', 'reservoir'], FUNCTIONS.store.read),
  move: F('move', ['hauler', 'vehicle', 'rover', 'cart', 'crawler', 'truck', 'carrier', 'mobile', 'buggy', 'transport'], FUNCTIONS.move.read),
  lift: F('lift', ['crane', 'lift', 'hoist', 'gantry', 'derrick', 'loader'], FUNCTIONS.lift.read),
  make: F('make', ['fabricator', 'factory', 'refinery', 'works', 'press', 'printer', 'processor', 'mill', 'smelter', 'extractor', 'drill'], FUNCTIONS.make.read),
  sense: F('sense', ['scanner', 'sensor', 'dish', 'radar', 'survey', 'probe', 'listening'], FUNCTIONS.sense.read),
  signal: F('signal', ['beacon', 'relay', 'transmitter', 'comms', 'signal'], FUNCTIONS.signal.read),
  keep: F('keep', ['shelter', 'pod', 'capsule', 'hab', 'refuge'], FUNCTIONS.keep.read),
  grow: F('grow', ['greenhouse', 'hydroponic', 'hydroponics', 'farm', 'garden', 'grow'], FUNCTIONS.grow.read),
  light: F('light', ['lamp', 'floodlight', 'searchlight', 'light'], FUNCTIONS.light.read),
  tracked: M(['tracked', 'crawler', 'treads', 'tracks'], 'it runs on a track pair', { running: 'track' }),
  wheeled: M(['wheeled', 'wheels'], 'it runs on wheels', { running: 'wheel' }),
  wind: M(['wind', 'turbine', 'rotor'], 'its source is a rotor', { source: 'rotor' }),
  solar: M(['solar', 'collector', 'collectors'], 'its source is collector wings', { source: 'wing' }),
  tall: M(['tall', 'tower', 'towering'], 'it stands tall', { tall: true }),
  heavy: M(['heavy', 'big', 'large', 'industrial', 'massive'], 'heavy: a size up', { scale: 1.35 }),
  small: M(['small', 'compact', 'portable', 'hand', 'handheld'], 'small: a tool, hand scale', { tier: 'tool' }),
  station: M(['station', 'plant', 'array', 'installation', 'site', 'rig'], 'an installation: it stays where it is built', { tier: 'installation' }),
  automated: M(['automated', 'robotic', 'automatic', 'autonomous', 'arm'], 'an automation: an arm that works through a cycle', { automated: true }),
  busy: M(['busy', 'cluttered', 'detailed', 'greebled', 'worn'], 'busy: many small things on it', { many: 0.85 }),
  bare: M(['bare', 'minimal', 'clean', 'sleek'], 'bare: little on it', { many: 0.15 }),
});

const UNIT = { part: 0.3, tool: 0.25, machine: 1, installation: 1.45, automation: 1.15 };
const BODY = { store: 'drum', keep: 'dome' };

// ── combine: the layout grammar ─────────────────────────────────────────────────────────────────────────────────────
/** A thing's block from a candidate: the body and a part for every read its functions need, in their slots. */
export function composeThing(c) {
  const u = UNIT[c.tier] * (c.scale ?? 1), fns = c.functions, has = (f) => fns.includes(f), parts = [], sig = [];
  // a piece the tunnel thickened (it was lost at its ring) carries its own factor
  const k = (id) => c.thick?.[id] ?? 1;
  const moves = has('move') && c.tier !== 'installation';
  const W = r2(c.body?.[0] ?? 3.2 * u), D = r2(c.body?.[1] ?? 2 * u), H = r2((c.body?.[2] ?? 1.4 * u) * (c.tall ? 2.2 : 1) * (fns[0] === 'keep' ? 1.4 : 1));
  const form = BODY[fns[0]] ?? 'box';
  // ── below ──
  let z0;
  if (moves && c.running === 'track') {
    const r = r2(0.42 * u * k('track-l')), tw = r2(0.5 * u);
    z0 = r2(2 * r * 0.85);
    for (const s of [-1, 1]) parts.push({ id: `track-${s < 0 ? 'l' : 'r'}`, prim: 'track', role: 'running', len: r2(W * 0.98), r, w: tw, at: [0, r2(s * (D / 2 - tw / 2 + 0.05 * u)), 0], group: 'tech:frame', value: 0.22 });
    sig.push('track-l');
  } else if (moves) {
    const r = r2(0.48 * u * k('wheels-l')), ww = r2(0.38 * u), n = W > 3.6 * u ? 3 : 2, step = r2((W - 2 * r) / (n - 1));
    z0 = r2(r * 1.15);
    for (const s of [-1, 1]) parts.push({ id: `wheels-${s < 0 ? 'l' : 'r'}`, prim: 'wheel', role: 'running', r, w: ww, at: [r2(-W / 2 + r), r2(s * (D / 2 + ww / 2 - 0.05 * u)), 0], repeat: { n, step: [step, 0, 0] }, group: 'tech:frame', value: 0.22 });
    sig.push('wheels-l');
  } else if (c.tier === 'installation') {
    z0 = r2(0.3 * u);
    parts.push({ id: 'pad', prim: 'box', role: 'mount', size: [r2(W + 1.2 * u), r2(D + 1.2 * u), z0], group: 'tech:frame', value: 0.5 });
  } else if (form !== 'box') {
    // a round body stands on legs round its foot
    z0 = r2(0.45 * u);
    parts.push({ id: 'legs', prim: 'box', role: 'frame', size: [r2(0.24 * u), r2(0.24 * u), z0], repeat: { n: 4, around: r2(Math.min(W, D) / 2 * 0.72) }, group: 'tech:frame', value: 0.35 });
  } else {
    z0 = r2(0.45 * u);
    parts.push({ id: 'legs', prim: 'box', role: 'frame', size: [r2(0.24 * u), r2(0.24 * u), z0], at: [r2(-W / 2 + 0.3 * u), r2(-D / 2 + 0.3 * u), 0], repeat: { n: 2, step: [r2(W - 0.6 * u), 0, 0] }, group: 'tech:frame', value: 0.35 });
    parts.push({ id: 'legs-b', prim: 'box', role: 'frame', size: [r2(0.24 * u), r2(0.24 * u), z0], at: [r2(-W / 2 + 0.3 * u), r2(D / 2 - 0.3 * u), 0], repeat: { n: 2, step: [r2(W - 0.6 * u), 0, 0] }, group: 'tech:frame', value: 0.35 });
  }
  // ── body ──
  const bodyRole = has('store') && fns[0] === 'store' ? 'store' : has('keep') && fns[0] === 'keep' ? 'shell' : 'body';
  if (form === 'drum') parts.push({ id: 'body', prim: 'drum', role: bodyRole, r: r2(Math.min(W, D) / 2), h: H, at: [0, 0, z0], sides: 14, group: 'tech:body', value: 0.72 });
  else if (form === 'dome') { parts.push({ id: 'body', prim: 'drum', role: 'shell', r: r2(Math.min(W, D) / 2), h: r2(H * 0.7), at: [0, 0, z0], sides: 14, group: 'tech:body', value: 0.72 }, { id: 'crown', prim: 'cone', role: 'shell', r: r2(Math.min(W, D) / 2), r2: r2(Math.min(W, D) / 6), h: r2(H * 0.3), at: [0, 0, r2(z0 + H * 0.7)], sides: 14, group: 'tech:skin', value: 0.82 }); }
  else parts.push({ id: 'body', prim: 'box', role: bodyRole, size: [W, D, H], at: [0, 0, z0], seams: r2(Math.max(0.3, 0.8 * u)), group: 'tech:body', value: 0.72 });
  sig.push('body');
  const top = r2(z0 + (form === 'dome' ? H * 0.7 : H)), round = form !== 'box', R = Math.min(W, D) / 2;
  // ── top: slots along the roof, front to back ──
  const tops = [];
  if (has('power')) tops.push(c.source === 'rotor' ? 'rotor' : 'wing');
  if (has('sense')) tops.push('dish');
  if (has('make')) tops.push('hopper');
  if (has('grow')) tops.push('glazing');
  if (has('light')) tops.push('lamp');
  const slotX = (i) => r2(round ? (tops.length > 1 ? (i - (tops.length - 1) / 2) * R * 0.9 : 0) : -W / 2 + (W * (i + 0.5)) / tops.length);
  tops.forEach((t, i) => {
    const x = slotX(i);
    if (t === 'wing') {
      parts.push({ id: 'wing', prim: 'panel', role: 'source', size: [r2(Math.max(0.5, W / tops.length) * 0.9), r2(1.1 * u)], t: r2(0.06 * u), seams: r2(Math.max(0.12, 0.4 * u)), at: [x, 0, r2(top + 0.7 * u)], aim: [0, -0.55, 0.84], group: 'tech:glass', value: 0.16 });
      parts.push({ id: 'wing-post', prim: 'box', role: 'frame', size: [r2(0.14 * u), r2(0.14 * u), r2(0.6 * u)], at: [x, 0, top], group: 'tech:frame', value: 0.4 });
      sig.push('wing');
    } else if (t === 'rotor') {
      const hub = r2(top + 2.6 * u);
      parts.push({ id: 'rotor-mast', prim: 'drum', role: 'frame', r: r2(0.16 * u), h: r2(2.6 * u), at: [x, 0, top], sides: 8, group: 'tech:frame', value: 0.45 });
      parts.push({ id: 'hub', prim: 'drum', role: 'source', r: r2(0.42 * u * k('hub')), h: r2(0.9 * u), axis: 'y', at: [x, r2(-0.6 * u), hub], sides: 10, group: 'tech:body', value: 0.7 });
      parts.push({ id: 'rotor', prim: 'fin', role: 'source', l: r2(1.6 * u), h: r2(0.32 * u), t: r2(0.05 * u), at: [x, r2(-0.7 * u), hub], repeat: { n: 3, around: 0 }, group: 'tech:skin', value: 0.85 });
      sig.push('hub');
    } else if (t === 'dish') {
      parts.push({ id: 'dish-mast', prim: 'tube', role: 'frame', r: r2(0.08 * u), from: [x, 0, top], to: [x, 0, r2(top + 1.1 * u)], group: 'tech:frame', value: 0.45 });
      parts.push({ id: 'dish', prim: 'dish', role: 'sensor', r: r2(0.62 * u), depth: r2(0.22 * u), at: [x, 0, r2(top + 1.1 * u)], aim: [0.5, -0.6, 0.62], group: 'tech:skin', value: 0.86 });
      sig.push('dish');
    } else if (t === 'hopper') {
      parts.push({ id: 'hopper', prim: 'cone', role: 'intake', r: r2(0.42 * u), r2: r2(0.85 * u), h: r2(0.8 * u), at: [x, 0, top], sides: 4, group: 'tech:skin', value: 0.8 });
      sig.push('hopper');
    } else if (t === 'glazing') {
      parts.push({ id: 'glazing', prim: 'panel', role: 'bed', size: [r2(W * 0.9 / tops.length), r2(D * 0.85)], t: r2(0.05 * u), seams: r2(Math.max(0.15, 0.5 * u)), at: [x, 0, r2(top + 0.05 * u)], aim: [0, -0.3, 0.95], group: 'tech:glass', value: 0.2 });
      sig.push('glazing');
    } else if (t === 'lamp') {
      parts.push({ id: 'lamp-post', prim: 'tube', role: 'frame', r: r2(0.06 * u), from: [x, 0, top], to: [x, 0, r2(top + 1.2 * u)], group: 'tech:frame', value: 0.4 });
      parts.push({ id: 'lamp', prim: 'lamp', role: 'lamp', r: r2(0.24 * u), at: [x, 0, r2(top + 1.2 * u)], group: 'tech:light', value: 0.9 });
    }
  });
  // what carries power away from its source: a cable down to a conduit on the ground
  if (has('power')) parts.push({ id: 'cable', prim: 'tube', role: 'carrier', r: r2(0.05 * u), from: [r2(-W / 2 - 0.1 * u), r2(-D / 2 + 0.2 * u), top], to: [r2(-W / 2 - 0.1 * u), r2(-D / 2 + 0.2 * u), 0.05], group: 'tech:cable', value: 0.3 },
    { id: 'conduit', prim: 'box', role: 'carrier', size: [r2(1.6 * u), r2(0.3 * u), r2(0.25 * u)], at: [r2(-W / 2 - 0.9 * u), r2(-D / 2 + 0.2 * u), 0], group: 'tech:cable', value: 0.32 });
  // ── front ──
  if (has('make')) { parts.push({ id: 'belt', prim: 'track', role: 'outlet', len: r2(2.6 * u), r: r2(0.4 * u * k('belt')), w: r2(0.8 * u), at: [r2(W / 2 + 1.3 * u), 0, r2(0.2 * u)], group: 'tech:frame', value: 0.3 }); sig.push('belt'); }
  if (has('lift')) {
    parts.push({ id: 'boom', prim: 'truss', role: 'boom', from: [r2(W / 2 - 0.4 * u), 0, top], to: [r2(W / 2 + 2.4 * u), 0, r2(top + 2.2 * u * (c.tall ? 1.6 : 1))], w: r2(0.7 * u * k('boom')), member: r2(0.07 * u), group: 'tech:frame', value: 0.42 });
    parts.push({ id: 'hook', prim: 'box', role: 'hook', size: [r2(0.5 * u), r2(0.5 * u), r2(0.4 * u)], at: [r2(W / 2 + 2.4 * u), 0, r2(top + 2.2 * u * (c.tall ? 1.6 : 1) - 1.4 * u)], group: 'tech:trim', value: 0.55 });
    parts.push({ id: 'hoist', prim: 'tube', role: 'frame', r: r2(0.03 * u), from: [r2(W / 2 + 2.4 * u), 0, r2(top + 2.2 * u * (c.tall ? 1.6 : 1))], to: [r2(W / 2 + 2.4 * u), 0, r2(top + 2.2 * u * (c.tall ? 1.6 : 1) - 1 * u)], group: 'tech:cable', value: 0.3 });
    sig.push('boom');
  }
  if (moves || has('keep')) parts.push({ id: moves ? 'screen' : 'door', prim: 'panel', role: moves ? 'readout' : 'door', size: [r2(Math.min(D * 0.6, 1.4 * u)), r2(moves ? Math.min(H * 0.6, 0.9 * u) * 0.7 : Math.min(H * 0.55, 2.1 * u))], t: r2(0.04 * u), at: [r2((round ? R : W / 2) + 0.03 * u), 0, r2(z0 + H * (moves ? 0.68 : 0.45))], aim: [1, 0, moves ? 0.15 : 0], group: moves ? 'tech:glass' : 'tech:skin', value: moves ? 0.12 : 0.5 });
  // what feeds a bed: water held beside it
  if (has('grow')) parts.push({ id: 'cistern', prim: 'drum', role: 'water', r: r2(0.5 * u), h: r2(Math.min(H, 1.4 * u)), at: [r2(W / 2 + 0.6 * u), r2(D / 2 - 0.5 * u), z0], sides: 12, group: 'tech:glass', value: 0.35 });
  // ── beside ──
  if (has('store') && fns[0] !== 'store') { parts.push({ id: 'tank', prim: 'drum', role: 'store', r: r2(0.55 * u), h: r2(Math.min(H, 1.6 * u)), at: [r2(-W / 2 - 0.7 * u), r2(D / 2 - 0.55 * u), z0], sides: 12, group: 'tech:body', value: 0.66 }); }
  // ── the arm: an automation's cycle ──
  if (c.automated) { parts.push({ id: 'arm', prim: 'arm', role: 'joint', segs: [r2(1.3 * u), r2(1 * u)], bend: [20, 60], turn: 'swing - 60', r: r2(0.4 * u * k('arm')), at: [r2(W / 2 + 0.6 * u), r2(-D / 2 - 0.6 * u), r2(0.42 * u)], group: 'tech:trim', value: 0.55 }); sig.push('arm'); }
  // ── what a busier one wears: vents, a rail, bands; and its status light ──
  if (!round) parts.push({ id: 'vents', prim: 'box', role: 'trim', size: [r2(0.4 * u), r2(0.4 * u), r2(0.25 * u)], at: [r2(-W / 2 + 0.4 * u), r2(D / 2 - 0.4 * u), top], repeat: { n: 'round(1 + 2 * many)', step: [r2(0.6 * u), 0, 0] }, group: 'tech:trim', value: 0.5, many: 0.4 });
  if (!round) parts.push({ id: 'rail', prim: 'box', role: 'trim', size: [r2(W * 0.85), r2(0.08 * u), r2(0.3 * u)], at: [0, r2(-D / 2 - 0.04 * u), r2(z0 + H * 0.35)], group: 'tech:trim', value: 0.5, many: 0.7 });
  if (round) parts.push({ id: 'bands', prim: 'ring', role: 'trim', r: r2(R + 0.03 * u), tube: r2(0.05 * u), at: [0, 0, r2(z0 + H * 0.3)], repeat: { n: 2, step: [0, 0, r2(H * 0.35)] }, group: 'tech:trim', value: 0.5, many: 0.5 });
  parts.push({ id: 'status', prim: 'lamp', role: has('signal') ? 'beacon' : 'status', r: r2(Math.max(0.08, (has('signal') ? 0.4 : 0.12) * u * k('status'))), at: [r2(round ? 0 : W / 2 - 0.3 * u), 0, r2(form === 'dome' ? z0 + H * 1.1 : top)], group: 'str:accent', value: 0.9 });
  if (has('signal')) sig.push('status');
  // every number inside its primitive's rail: a size the grammar reaches past its shape is held at the rail's end
  for (const p of parts) for (const [key, [lo, hi]] of Object.entries(PRIMITIVES[p.prim].rails)) {
    if (typeof p[key] === 'number') p[key] = r2(Math.min(hi, Math.max(lo, p[key])));
    else if (Array.isArray(p[key])) p[key] = p[key].map((v) => (typeof v === 'number' ? r2(Math.min(hi, Math.max(lo, v))) : v));
  }
  const tier = c.automated ? 'automation' : c.tier;
  return readBlock({
    id: c.id, read: c.read, tier, functions: fns, mounts: tier === 'tool' ? ['ground', 'socket'] : ['ground'],
    params: { ...(c.automated ? { swing: [0, 120] } : {}) }, ...(c.automated ? { cycle: 'swing' } : {}),
    parts, sig: [...new Set(sig)], lead: 'body',
  });
}

export function techDomain({ library = STARTER_BLOCKS } = {}) {
  return {
    id: 'technology', TRAITS: TECH_TRAITS,
    start: (seed, base) => ({ id: base?.id ?? 'thing', read: base?.read ?? '', functions: [], tier: 'machine', scale: 1, many: 0.5, running: 'wheel', source: 'wing', tall: false, automated: false, thick: {}, setBy: {}, ...(base ?? {}) }),
    pull(cand, T, id) {
      const c = clone(cand), changed = [];
      if (T.fn) { if (!c.functions.includes(T.fn)) { c.functions.push(T.fn); changed.push(`shows ${T.fn}`); } }
      else for (const [k, v] of Object.entries(T.set)) { if (c.setBy[k] && c.setBy[k] !== id) { changed.push(`${k}: kept from ${c.setBy[k]}`); continue; } c[k] = v; c.setBy[k] = id; changed.push(`${k} = ${v}`); }
      // running gear says it goes: a tracked or wheeled thing moves, whatever else it does
      if (T.set?.running && !c.functions.includes('move')) { c.functions.push('move'); changed.push('shows move (it runs on something)'); }
      return { candidate: c, changed };
    },
    build(cand, seed) {
      const c = clone(cand);
      if (!c.functions.length) c.functions.push('signal');
      c.read ||= `${c.functions.join(' and ')}: ${c.functions.map((f) => FUNCTIONS[f].read).join('; ')}`;
      const block = composeThing(c), b = buildBlock(block, { seed, library, many: c.many, params: c.automated ? { swing: 60 } : {} });
      return { block, b, laws: blockLaws(block, b) };
    },
    measure(T, id, built) {
      const B = built.block, parts = B.parts, prim = (p) => parts.some((x) => x.prim === p && (x.role === 'running' || x.role === 'source'));
      if (T.fn) { const l = built.laws.find((x) => x.law === 'functions-read'); const miss = !l.ok && l.value.includes(`${T.fn}:`); return { ok: B.functions.includes(T.fn) && !miss, value: miss ? l.value : `shows ${T.fn}` }; }
      if (T.set.running === 'track') return { ok: prim('track'), value: parts.filter((p) => p.role === 'running').map((p) => p.prim).join(', ') || 'stands still' };
      if (T.set.running === 'wheel') return { ok: prim('wheel'), value: parts.filter((p) => p.role === 'running').map((p) => p.prim).join(', ') || 'stands still' };
      if (T.set.source) return { ok: parts.some((x) => x.role === 'source' && x.prim === (T.set.source === 'rotor' ? 'fin' : 'panel')), value: parts.filter((p) => p.role === 'source').map((p) => p.prim).join(', ') || 'no source' };
      if (T.set.tall) return { ok: built.b.box.size[2] >= 1.6 * Math.max(built.b.box.size[0], built.b.box.size[1]) * 0.6, value: `${built.b.box.size[2]} m high` };
      if (T.set.tier) return { ok: B.tier === T.set.tier || (T.set.tier !== 'automation' && B.tier === 'automation'), value: B.tier };
      if (T.set.automated) return { ok: B.tier === 'automation' && !!B.cycle, value: B.tier };
      if (T.set.scale) return { ok: true, value: `× ${T.set.scale}` };
      if (T.set.many !== undefined) return { ok: Math.abs(built.b.params.many - T.set.many) < 1e-9, value: `many ${built.b.params.many}` };
      return { ok: true, value: '' };
    },
    laws: (built) => built.laws,
    tweak(cand, failed, pass, seed) {
      const c = clone(cand), changed = [], u = UNIT[c.automated ? 'automation' : c.tier] * (c.scale ?? 1);
      const body = c.body ?? [3.2 * u, 2 * u, 1.4 * u];
      for (const l of failed.laws) {
        if (l.law === 'one-leads') { c.body = body.map((v, i) => r2(v * (i === 2 ? 1.15 : 1.12))); changed.push(`body to ${c.body.join(' × ')} m (one leads)`); }
        else if (l.law === 'reads-at-ring') {
          // a lost signature piece is thickened, not the whole thing: unless it is the body, which takes the thing a size up
          const lost = String(l.value).replace(/^lost: /, '').split(', ').filter(Boolean);
          for (const id of lost) { if (id === 'body') { c.scale = r2((c.scale ?? 1) * 1.2); delete c.body; changed.push(`a size up, × ${c.scale} (the body reads at its ring)`); } else { c.thick = { ...(c.thick ?? {}), [id]: r2((c.thick?.[id] ?? 1) * 1.25) }; changed.push(`${id} × ${c.thick[id]} (reads at its ring)`); } }
        }
        else if (l.law === 'budget') { c.many = r2(Math.max(0, c.many - 0.3)); changed.push(`many ${c.many} (budget)`); }
      }
      return { candidate: c, changed: changed.length ? changed : [`reseed ${seed + 1}`], reseed: changed.length ? undefined : seed + 1 };
    },
    plan: (cand, built) => ({ block: built.block }),
  };
}

/** A name for a thing from its intent: its first few words, hyphenated. */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').filter((w) => !['a', 'an', 'the', 'of', 'and', 'with', 'that'].includes(w)).slice(0, 4).join('-') || 'thing';

/** Tunnel a technology intent into a block. */
export function tunnelTech(intent, { seed = 1, id, library = STARTER_BLOCKS, passes = 6 } = {}) {
  return tunnel(techDomain({ library }), { intent, seed, passes, base: { id: id ?? slug(intent), read: intent } });
}

export { TIERS };
