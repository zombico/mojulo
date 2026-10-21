// plating/expand — a SUIT card (styles.js) worn on a body through its adapter (adapters/), by passes in a fixed order
// (principles.js carries the laws):
//
//   1 SUIT     the undersuit: the body's own close garment over the trunk and the limbs (none: plates on the skin)
//   1b HANDS   a handwear card (the handwear library's): the glove the hand's plates are laid on
//   2 PLATES   each card plate on its region of its segment (regions.js), split into its rows, a matched pair where the
//              region has two sides, on both limbs: a thin slab over the suit's rings (footwear/cobbler.js `panelOn`),
//              carried by the suit's weights under it
//   2b SHELLS  each layout's panels (layouts.js) cut from a segment's FAIR SHELL (shell.js) along design lines, fitted
//              across narrow seams, bevelled, stacked by layer (under, mid, over, cap, light); the feet a footwear card
//   2c MUSCLES the segments a card names cut where their grooves run (muscles.js: the body's muscle map, each plate a
//              muscle group, its edges straightened into the suit's stepped lines), an underplate under each
//   3 GLOW     the reactor on the sternum: a disc in its rim
//   4 TONE     the groups laid, the card's tones (and its skin's) over PLATING_TONES; its emissive groups
//
// Parts are layer 1, named `<id>_<segment>` (the suit), `<id><Plate><row?><R|L|Lat|Med|>_<segment>`, `<id>Reactor_torso`,
// `<id>ReactorRim_torso`. Pure and deterministic: no dice.
import { arcOf, panelOn } from '../footwear/cobbler.js';
import { bindNearest, mean, unitv } from '../footwear/parts.js';
import { ringSlots } from '../polygonizer/body-relational-resample.js';
import { PLATE_REGIONS, PLATE_SIDES, TRUNK } from './regions.js';
import { SUITS, SKINS, PLATING_TONES } from './styles.js';
import { LAYOUTS, LAYERS } from './layouts.js';
import { fairShell, shellPanel, slotOf } from './shell.js';
import { validateFootwear } from '../footwear/index.js';
import { validateHandwear } from '../handwear/index.js';
import { MUSCLE_GROUPS, muscleLayout } from './muscles.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const SEGS = ['torso', 'pelvis', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'toes', 'hand', 'thumb', 'index', 'middle', 'ring', 'little'];
/** a layout panel's segment kinds ('fingers': the four) */
const FINGERS = ['index', 'middle', 'ring', 'little'], kindsOf = (seg) => (seg === 'fingers' ? FINGERS : [seg]);
const share = (x) => typeof x === 'number' && x >= 0 && x <= 1, pair = (x) => Array.isArray(x) && x.length === 2 && x.every(share) && x[0] <= x[1];
const GROUP = /^[A-Z][A-Za-z0-9]*$/, HEX = /^#[0-9a-f]{6}$/i;

/** a word or a card → the card, resolved (`from` its kin: plates replaced where given, `platesPlus` appended, tones
 * merged; then its `skin`) */
export function suitCard(spec, depth = 0) {
  const C = typeof spec === 'string' ? SUITS[spec] : spec;
  if (!C || typeof C !== 'object' || depth > 4) return C;
  const B = C.from !== undefined ? suitCard(C.from, depth + 1) : null, { from: _f, skin, platesPlus, ...own } = C;
  const out = B ? { ...B, ...own, tones: { ...(B.tones || {}), ...(own.tones || {}) } } : { ...own };
  if (platesPlus) out.plates = [...(out.plates || []), ...platesPlus];
  if (skin !== undefined) out.tones = { ...(out.tones || {}), ...(typeof skin === 'string' ? SKINS[skin] : skin) };
  return out;
}

/** Error strings for a suit (a word: is it one), by name */
export function validatePlating(spec, label = 'suit') {
  if (typeof spec === 'string') return Object.hasOwn(SUITS, spec) ? [] : [`${label}: '${spec}' is not a suit (${Object.keys(SUITS).join(', ')}), or give a card { suit, plates, reactor }`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a word or a card { suit, plates, reactor }`];
  const errs = [];
  const KEYS = ['family', 'from', 'skin', 'suit', 'plates', 'platesPlus', 'shells', 'muscles', 'feet', 'hands', 'reactor', 'tones', 'emissive'];
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) errs.push(`${label}: a suit takes ${KEYS.join(', ')}, not '${k}'`);
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(SUITS, spec.from) : spec.from && typeof spec.from === 'object')) errs.push(`${label}.from: a suit (${Object.keys(SUITS).join(', ')}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object')) errs.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (errs.length) return errs;
  const C = suitCard(spec);
  if (C.family !== undefined && C.family !== 'powered') errs.push(`${label}.family: 'powered'`);
  if (C.suit !== undefined && C.suit !== false && !(C.suit && typeof C.suit === 'object' && (C.suit.ease === undefined || (C.suit.ease >= 0 && C.suit.ease <= 0.02)) && (C.suit.on === undefined || (Array.isArray(C.suit.on) && C.suit.on.every((g) => SEGS.includes(g)))))) errs.push(`${label}.suit: { ease? (0 … 0.02 m), on? [${SEGS.join(', ')}] }, or false`);
  if (C.shells !== undefined) {
    if (!Array.isArray(C.shells)) errs.push(`${label}.shells: a list of layouts (${Object.keys(LAYOUTS).join(', ')}) or { layout, bulk? }`);
    else C.shells.forEach((x, i) => { const L = typeof x === 'string' ? x : x?.layout;
      if (!Object.hasOwn(LAYOUTS, L ?? '')) errs.push(`${label}.shells[${i}]: one of ${Object.keys(LAYOUTS).join(', ')}, or { layout, bulk? }`);
      else if (typeof x === 'object' && x.bulk !== undefined && !(x.bulk >= 0.5 && x.bulk <= 3)) errs.push(`${label}.shells[${i}].bulk: 0.5 … 3 (times the layers' heights)`);
      else if (typeof x === 'object' && x.on !== undefined && !(Array.isArray(x.on) && x.on.every((g) => SEGS.includes(g)))) errs.push(`${label}.shells[${i}].on: the segments it is laid on (${SEGS.join(', ')})`); });
  }
  if (C.feet !== undefined) errs.push(...validateFootwear(C.feet, `${label}.feet`));
  if (C.hands !== undefined) errs.push(...validateHandwear(C.hands, `${label}.hands`));
  if (C.muscles !== undefined) {
    const M = C.muscles, all = Object.keys(MUSCLE_GROUPS), ids = new Set(Object.values(MUSCLE_GROUPS).flatMap((gs) => gs.map((g) => g.id)));
    if (!M || typeof M !== 'object' || !Array.isArray(M.on) || !M.on.every((g) => all.includes(g))) errs.push(`${label}.muscles: { on: [${all.join(', ')}], only?: [plate groups], bulk? }`);
    else {
      if (M.only !== undefined && !(Array.isArray(M.only) && M.only.every((g) => ids.has(g)))) errs.push(`${label}.muscles.only: plate groups (${[...ids].join(', ')})`);
      if (M.bulk !== undefined && !(M.bulk >= 0.5 && M.bulk <= 3)) errs.push(`${label}.muscles.bulk: 0.5 … 3 (times the layers' heights)`);
      if (M.seam !== undefined && !(M.seam >= 0.002 && M.seam <= 0.03)) errs.push(`${label}.muscles.seam: 0.002 … 0.03 (m, the groove's width)`);
      for (const k of Object.keys(M)) if (!['on', 'only', 'bulk', 'seam'].includes(k)) errs.push(`${label}.muscles: takes on, only, bulk, seam, not '${k}'`);
    }
  }
  if (!Array.isArray(C.plates ?? [])) errs.push(`${label}.plates: a list of { region, lift?, thick?, rows?, gap?, group? }`);
  else (C.plates ?? []).forEach((p, i) => {
    const at = `${label}.plates[${i}]`;
    for (const k of Object.keys(p || {})) if (!['region', 'lift', 'thick', 'rows', 'gap', 'group'].includes(k)) errs.push(`${at}: a plate takes region, lift, thick, rows, gap, group, not '${k}'`);
    const R = p?.region;
    if (typeof R === 'string') { if (!PLATE_REGIONS[R]) errs.push(`${at}.region: one of ${Object.keys(PLATE_REGIONS).join(', ')}, or { seg, along, around, sides }`); }
    else if (!R || !SEGS.includes(R.seg) || !pair(R.along) || !pair(R.around) || !PLATE_SIDES.includes(R.sides)) errs.push(`${at}.region: a plate region's name, or { seg: ${SEGS.join(' | ')}, along: [a0, a1], around: [r0, r1], sides: ${PLATE_SIDES.join(' | ')} }`);
    for (const [k, lo, hi] of [['lift', 0, 0.05], ['thick', 0.0005, 0.02], ['gap', 0, 0.2]]) if (p?.[k] !== undefined && !(p[k] >= lo && p[k] <= hi)) errs.push(`${at}.${k}: ${lo} … ${hi}`);
    if (p?.rows !== undefined && !(Number.isInteger(p.rows) && p.rows >= 1 && p.rows <= 6)) errs.push(`${at}.rows: a whole number, 1 … 6`);
    if (p?.group !== undefined && !GROUP.test(p.group)) errs.push(`${at}.group: a group name (Plate, Trim …)`);
  });
  if (C.reactor !== undefined && C.reactor !== false && !(C.reactor && (C.reactor.at === undefined || share(C.reactor.at)) && (C.reactor.r === undefined || (C.reactor.r > 0.005 && C.reactor.r <= 0.06)))) errs.push(`${label}.reactor: { at? (a share up the torso), r? (0.005 … 0.06 m), group? }, or false`);
  for (const [g, c] of Object.entries(C.tones || {})) if (!HEX.test(c)) errs.push(`${label}.tones.${g}: '#rrggbb'`);
  if (C.emissive !== undefined && !(Array.isArray(C.emissive) && C.emissive.every((g) => GROUP.test(g)))) errs.push(`${label}.emissive: a list of group names`);
  return errs;
}

/** a DISC `r` round about `p`, square to `n`, `thick` deep (`proud` off its base) */
function disc(p, n, r, { thick = 0.003, proud = 0, k = 20 } = {}) {
  const N = unitv(n), u = unitv(Math.abs(N[2]) < 0.9 ? [N[1], -N[0], 0] : [1, 0, 0]), v = [N[1] * u[2] - N[2] * u[1], N[2] * u[0] - N[0] * u[2], N[0] * u[1] - N[1] * u[0]], names = ringSlots(k);
  const face = (off) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / k; return [nm, p.map((x, q) => r6(x + N[q] * off + r * (u[q] * Math.cos(a) + v[q] * Math.sin(a))))]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(proud) }, { id: 'st1', u: 1, points: face(proud + thick) }],
    caps: { back: p.map((x, q) => r6(x + N[q] * (proud - 0.0005))), tip: p.map((x, q) => r6(x + N[q] * (proud + thick + 0.0005))) } };
}

/** The suit on a body (see the head of this file). */
export function wearPlating(A, spec = 'powerSuit', { id = 'suit', group = 'Suit' } = {}) {
  const errs = validatePlating(spec); if (errs.length) throw new Error(errs.join('; '));
  const C = suitCard(spec), used = new Set();
  // 1 SUIT
  const parts = C.suit === false ? {} : A.suit(C.suit ?? {}, { id, group });
  if (C.suit !== false) used.add(group);
  const on = (seg) => (C.suit === false ? A.part(seg) : parts[`${id}_${seg}`] ?? A.part(seg));
  const put = (name, part) => { parts[name] = part; used.add(part.group); };
  // (the HANDS: a handwear card, the handwear library's glove, in the suit's group, under the plates laid on it)
  if (C.hands && A.hands) { const W = A.hands(C.hands, { id, group }); for (const [name, part] of Object.entries(W.parts)) put(name, part); }
  // 2 PLATES
  for (const p of C.plates ?? []) {
    const named = typeof p.region === 'string', R = named ? PLATE_REGIONS[p.region] : p.region, base = named ? p.region[0].toUpperCase() + p.region.slice(1) : 'Plate';
    const trunk = TRUNK.includes(R.seg), rows = p.rows ?? R.rows ?? 1, gap = p.gap ?? R.gap ?? 0.025, span = (R.along[1] - R.along[0] - gap * (rows - 1)) / rows;
    if (!(span > 0)) continue;
    for (const S of trunk ? ['R'] : A.sides) {
      const seg = trunk ? R.seg : `${R.seg}${S}`, P = on(seg); if (!P) continue;
      // (a pair: the trunk's right and left, a limb's lateral and medial)
      const sides = R.sides === 'both' ? (trunk ? [['lateral', 'R'], ['medial', 'L']] : [['lateral', 'Lat'], ['medial', 'Med']]) : [[R.sides, R.sides === 'centre' ? '' : trunk ? (R.sides === 'lateral' ? 'R' : 'L') : R.sides === 'lateral' ? 'Lat' : 'Med']];
      for (let r = 0; r < rows; r++) {
        const a0 = R.along[0] + r * (span + gap), a1 = a0 + span, u0 = A.u(R.seg, a0), u1 = A.u(R.seg, a1);
        const sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= u0 - 1e-9 && u <= u1 + 1e-9; });
        for (const [side, tag] of sides) {
          const pc = panelOn(P, sts, arcOf(P.slots, R, side, S), { lift: p.lift ?? 0.006, thick: p.thick ?? 0.003 }); if (!pc) continue;
          put(`${id}${base}${rows > 1 ? r : ''}${tag}_${seg}`, { ...pc, group: p.group ?? 'Plate', bind: bindNearest(pc, P, { rings: true }) });
        }
      }
    }
  }
  // 2b SHELLS: each layout's panels cut from the fair shell of their segment (shell.js), on both limbs, a mirrored panel's
  // copy on the other side; stacked by their layers, so an overplate's window shows the underplate
  const fair = {}, underlaid = new Set();
  // (each segment's SHOWING stretch: its rings most of whose points no other part's skin covers, `t` shares; a segment's
  // underplate and joint bands kept to it, so the inner of two overlapping skins does not poke through the outer)
  const shows = {};
  const showing = (seg, kind, P) => (shows[seg] ??= (() => {
    if (!A.hidden) return [0, 1];
    const vis = P.stations.map((st) => P.slots.filter((sl) => !A.hidden(seg, st.id, sl)).length > P.slots.length / 2), U = P.stations.map((st, i) => (st.u ?? i) / A.u(kind, 1));
    const i0 = vis.indexOf(true), i1 = vis.lastIndexOf(true); return i0 < 0 ? null : [U[i0], U[i1]];
  })());
  for (const x of C.shells ?? []) {
    const name = typeof x === 'string' ? x : x.layout, bulk = (typeof x === 'object' && x.bulk) || 1, Name = name[0].toUpperCase() + name.slice(1);
    const only = typeof x === 'object' && x.on ? new Set(x.on) : null;
    for (const pn of LAYOUTS[name]) for (const kind of kindsOf(pn.seg).filter((k) => !only || only.has(k))) for (const S of TRUNK.includes(kind) ? ['R'] : A.sides) {
      const seg = TRUNK.includes(kind) ? kind : `${kind}${S}`, P = on(seg); if (!P) continue;
      if (pn.layer === 'under') underlaid.add(seg);
      const F = (fair[seg] ??= fairShell(P)), fOf = slotOf(P.slots.length, S), uOf = (t) => A.u(kind, t), Ly = LAYERS[pn.layer];
      // (an underplate or a joint band kept to the stretch of its segment that shows)
      let t = pn.t;
      if (pn.layer === 'under' || pn.layer === 'joint') { const v = showing(seg, kind, P); if (!v) continue; t = [Math.max(t[0], v[0]), Math.min(t[1], v[1])]; if (t[1] - t[0] < 0.02) continue; }
      // (a CIRCLE: its edges the circle's, in the segment's t and s, sized in metres by the segment's length and girth there)
      let edges = [pn.left, pn.right];
      if (pn.circle) {
        const { t: tc, s: sc, r } = pn.circle, rt = r / (F.length || 0.3), rs = (2 * r) / (F.perimeter(uOf(tc)) || 0.3), K = 8;
        const half = (t) => rs * Math.sqrt(Math.max(0, 1 - ((t - tc) / rt) ** 2)), ts = Array.from({ length: K + 1 }, (_, i) => tc - rt + (2 * rt * i) / K);
        edges = [ts.map((tt) => [tt, sc - Math.max(half(tt), rs * 0.15)]), ts.map((tt) => [tt, sc + Math.max(half(tt), rs * 0.15)])];
        t = [tc - rt, tc + rt];
      }
      const copies = pn.mirror ? [['Lat', edges[0], edges[1]], ['Med', edges[1].map(([tt, v]) => [tt, -v]), edges[0].map(([tt, v]) => [tt, -v])]] : [['', edges[0], edges[1]]];
      for (const [tag, left, right] of copies) {
        // (a low panel's bevel no deeper than most of its lift: a finger's lame)
        const lift = (pn.lift ?? Ly.lift) * bulk, pc = shellPanel(F, { t0: t[0], t1: t[1], left, right, lift, thick: Ly.thick, bevel: Math.min(Ly.bevel, 0.6 * lift), dome: pn.dome ?? 0, uOf, fOf }); if (!pc) continue;
        put(`${id}${Name}${pn.id}${tag}_${seg}`, { ...pc, group: pn.role ?? Ly.role, bind: bindNearest(pc, P, { rings: true }) });
      }
    }
  }
  // 2c MUSCLES: each named segment cut where its grooves run (muscles.js), an underplate under all
  if (C.muscles && A.muscle) {
    const M = C.muscles, bulk = M.bulk ?? 1, only = M.only ? new Set(M.only) : null;
    for (const kind of M.on) {
      const trunk = TRUNK.includes(kind), uMax = A.u(kind, 1), groups = MUSCLE_GROUPS[kind].filter((g) => !only || only.has(g.id));
      for (const S of trunk ? ['R'] : A.sides) {
        const seg = trunk ? kind : `${kind}${S}`, P = on(seg); if (!P) continue;
        const F = (fair[seg] ??= fairShell(P)), fOf = slotOf(P.slots.length, S), uOf = (t) => A.u(kind, t), Name = kind[0].toUpperCase() + kind.slice(1);
        // (an underplate, unless a designed shell already lays the segment's)
        const v = showing(seg, kind, P); if (!v) continue;
        const panels = [...(underlaid.has(seg) ? [] : [{ id: 'Under', layer: 'under', t: [Math.max(0.02, v[0]), Math.min(0.98, v[1])], left: [[0, -0.995], [1, -0.995]], right: [[0, 0.995], [1, 0.995]] }]),
          ...muscleLayout(P, (st, sl) => A.muscle(seg, st, sl), S, { groups, uMax, trunk })];
        for (const pn of panels) {
          const Ly = LAYERS[pn.layer], pc = shellPanel(F, { t0: pn.t[0], t1: pn.t[1], left: pn.left, right: pn.right, lift: Ly.lift * bulk, thick: Ly.thick, bevel: Ly.bevel, seam: pn.layer === 'under' ? 0.004 : M.seam ?? 0.014, uOf, fOf });
          if (pc) put(`${id}${Name}${pn.id}_${seg}`, { ...pc, group: pn.role ?? Ly.role, bind: bindNearest(pc, P, { rings: true }) });
        }
      }
    }
  }
  // (the FEET: a footwear card, the footwear library's: its sole, its toe cap)
  if (C.feet && A.feet) { const W = A.feet(C.feet, { id }); for (const [name, part] of Object.entries(W.parts)) put(name, part); }
  // 3 GLOW: the reactor on the sternum, in its rim
  if (C.reactor) {
    const P = on('torso'), u = A.u('torso', C.reactor.at ?? 0.78), st = P && P.stations.reduce((b, x, i) => (Math.abs((x.u ?? i) - u) < Math.abs((b.u ?? 0) - u) ? x : b), P.stations[0]);
    if (st) {
      const m = mean(Object.values(st.points)), f = st.points[P.slots[0]], n = unitv(f.map((x, q) => x - m[q])), r = C.reactor.r ?? 0.025, lift = Math.max(...(C.plates ?? []).map((q) => q.lift ?? 0.006), C.muscles ? LAYERS.cap.lift * (C.muscles.bulk ?? 1) : 0, 0.004);
      const rim = disc(f, n, r * 1.3, { thick: lift, proud: 0 }), core = disc(f, n, r, { thick: 0.003, proud: lift });
      put(`${id}ReactorRim_torso`, { ...rim, group: 'Rim', bind: bindNearest(rim, P) });
      put(`${id}Reactor_torso`, { ...core, group: C.reactor.group ?? 'Reactor', bind: bindNearest(core, P) });
    }
  }
  // 4 TONE
  const tones = { ...PLATING_TONES, ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g))), emissive: (C.emissive ?? []).filter((g) => used.has(g)), named: Object.keys(C.tones || {}) };
}
