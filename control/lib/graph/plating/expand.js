// plating/expand — a SUIT card (styles.js) worn on a body through its adapter (adapters/), by passes in a fixed order
// (principles.js carries the laws):
//
//   1 SUIT     the undersuit: the body's own close garment over the trunk and the limbs (none: plates on the skin)
//   2 PLATES   each card plate on its region of its segment (regions.js), split into its rows, a matched pair where the
//              region has two sides, on both limbs: a thin slab over the suit's rings (footwear/cobbler.js `panelOn`),
//              carried by the suit's weights under it
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

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const SEGS = ['torso', 'pelvis', 'upperArm', 'foreArm', 'thigh', 'shank'];
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
  for (const k of Object.keys(spec)) if (!['family', 'from', 'skin', 'suit', 'plates', 'platesPlus', 'reactor', 'tones', 'emissive'].includes(k)) errs.push(`${label}: a suit takes family, from, skin, suit, plates, platesPlus, reactor, tones, emissive, not '${k}'`);
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(SUITS, spec.from) : spec.from && typeof spec.from === 'object')) errs.push(`${label}.from: a suit (${Object.keys(SUITS).join(', ')}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object')) errs.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (errs.length) return errs;
  const C = suitCard(spec);
  if (C.family !== undefined && C.family !== 'powered') errs.push(`${label}.family: 'powered'`);
  if (C.suit !== undefined && C.suit !== false && !(C.suit && typeof C.suit === 'object' && (C.suit.ease === undefined || (C.suit.ease >= 0 && C.suit.ease <= 0.02)))) errs.push(`${label}.suit: { ease? (0 … 0.02 m) }, or false`);
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
          put(`${id}${base}${rows > 1 ? r : ''}${tag}_${seg}`, { ...pc, group: p.group ?? 'Plate', bind: bindNearest(pc, P) });
        }
      }
    }
  }
  // 3 GLOW: the reactor on the sternum, in its rim
  if (C.reactor) {
    const P = on('torso'), u = A.u('torso', C.reactor.at ?? 0.78), st = P && P.stations.reduce((b, x, i) => (Math.abs((x.u ?? i) - u) < Math.abs((b.u ?? 0) - u) ? x : b), P.stations[0]);
    if (st) {
      const m = mean(Object.values(st.points)), f = st.points[P.slots[0]], n = unitv(f.map((x, q) => x - m[q])), r = C.reactor.r ?? 0.025, lift = Math.max(...(C.plates ?? []).map((q) => q.lift ?? 0.006), 0.004);
      const rim = disc(f, n, r * 1.3, { thick: lift, proud: 0 }), core = disc(f, n, r, { thick: 0.003, proud: lift });
      put(`${id}ReactorRim_torso`, { ...rim, group: 'Rim', bind: bindNearest(rim, P) });
      put(`${id}Reactor_torso`, { ...core, group: C.reactor.group ?? 'Reactor', bind: bindNearest(core, P) });
    }
  }
  // 4 TONE
  const tones = { ...PLATING_TONES, ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g))), emissive: (C.emissive ?? []).filter((g) => used.has(g)), named: Object.keys(C.tones || {}) };
}
