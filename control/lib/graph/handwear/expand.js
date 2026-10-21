// handwear/expand — a handwear CARD (styles.js) worn on a body through its HAND ADAPTER (adapters/), by passes in a
// fixed order (principles.js carries the laws):
//
//   1 GLOVE   the protoglove: the palm's and the digits' own rings stood off by the leather's thickness (parts.js
//             `standOff`), a digit cut at its middle joint or its knuckle where the card's fingers say, the cuff up the
//             forearm by its share (the adapter's close leather); none: the adornment on the bare hand
//   2 ADORN   per side, the card's primitives in order (ADORN_PRIMS), each on the glove (or the bare hand) under it,
//             carried by its weights: a `panel` a glover's piece (cutter.js GLOVE_REGIONS: the back, the palm, the
//             knuckles, the fingers' backs …), the points, a cuff, a strap, a flared gauntlet cuff, a knuckle guard,
//             studs, a knight's lames, rings, stones, claws, fur, hand wraps
//   4 TONE    the colours of the groups laid, the card's own over HANDWEAR_TONES, its skin's over those
//
// Parts are layer 1, named `<id>_<segment>` (the glove), `<id><Piece>_<segment>` for each adornment's pieces (`<Piece>` the
// prim's or the region's name, a count where it lays several). Pure and deterministic: no dice, fixed order.
import { standOff } from './parts.js';
import { GLOVE_REGIONS, FINGER_KINDS, kindsOf, cutPiece, shellOf, extentOf } from './cutter.js';
import { slotOf } from '../plating/shell.js';
import { bindNearest, block, strapBand, mean, unitv } from '../footwear/parts.js';
import { toeSpike, ribbon, helixOn, flareTop, furRing } from '../footwear/fantasy.js';
import { HANDWEAR, HANDWEAR_TONES, SKINS } from './styles.js';
import { readTones } from '../footwear/expand.js';

export { readTones };
export const DIGITS = Object.freeze(['thumb', 'index', 'middle', 'ring', 'little']);
/** how far a glove's fingers reach: whole, to the middle joint (fingerless), to the knuckle (a mitt's) — the rings kept */
export const FINGERS = Object.freeze({ full: 5, half: 3, none: 2 });
/** THE ADORNMENT PRIMITIVES: each one's keys, its group, and what it is */
export const ADORN_PRIMS = Object.freeze({
  panel: { keys: ['region', 'lift', 'thick', 'group'], group: 'Overlay', what: "a glover's piece laid over the glove on a region (cutter.js GLOVE_REGIONS: back, palm, heel, knuckles, fingerBacks, fingerPads, thumb, or { seg, t: [t0, t1], s: [s0, s1] })" },
  points: { keys: ['lines', 'lift', 'group'], group: 'Stitch', what: 'the raised lines of stitching down the back of a dress glove (three, or `lines`)' },
  buttons: { keys: ['count', 'size', 'group'], group: 'Button', what: "a row of buttons at the wrist's opening: on the palm's side of the wrist, or up the inner forearm along a long cuff (an opera glove's)" },
  perf: { keys: ['region', 'rows', 'cols', 'size', 'group'], group: 'Perf', what: "perforation: a grid of small holes over a region (a driving glove's, a golfer's), `rows` along it and `cols` across, on each digit of a digits region" },
  cuff: { keys: ['width', 'lift', 'group'], group: 'Cuff', what: "a turned band at the glove's top" },
  strap: { keys: ['at', 'width', 'lift', 'buckle', 'group'], group: 'Strap', what: 'a band round the wrist (`at` 0) or up the forearm (a share of it); `buckle` true a buckle on its back, false a snap' },
  flare: { keys: ['height', 'spread', 'group'], group: 'Cuff', what: "a gauntlet cuff: a funnel from the wrist up the forearm, opening out (a cavalier's, a falconer's, a welder's)" },
  knuckles: { keys: ['lift', 'group'], group: 'Guard', what: "a hard knuckle guard: a domed bar over the knuckles, a plate over each finger's first joint (a rider's, a fighter's)" },
  studs: { keys: ['size', 'group'], group: 'Steel', what: 'a stud on each knuckle' },
  lames: { keys: ['lift', 'group'], group: 'Steel', what: "a plate a phalanx on each digit's back, articulated (a knight's gauntlet)" },
  rings: { keys: ['on', 'at', 'width', 'gem', 'group'], group: 'Gilt', what: 'a ring on each digit named (`on`), `at` a share along it, a stone set on it (`gem`: true, or { size, group })' },
  jewel: { keys: ['at', 'size', 'group'], group: 'Gem', what: 'a stone set on the back of the hand (`at` back) or on each knuckle (`at` knuckles)' },
  claws: { keys: ['on', 'length', 'curl', 'group'], group: 'Claw', what: "a claw from each digit's tip (`on`, all five by default), tapering, curled toward the palm" },
  fur: { keys: ['length', 'droop', 'seed', 'group'], group: 'Fur', what: "a shaggy ruff of fur round the glove's top" },
  wrap: { keys: ['turns', 'cross', 'w', 'lift', 'group'], group: 'Wrap', what: "a strip wound round the palm and the wrist, `cross` a second the other way (a fighter's hand wraps)" },
});
/** the families a card is annotated with (a shelf to browse, a word to ask by) */
export const HANDWEAR_FAMILIES = Object.freeze(['glove', 'gauntlet', 'dress', 'work', 'sport', 'historic', 'fantasy']);
const GROUP = /^[A-Z][A-Za-z0-9]*$/;
const share = (x) => typeof x === 'number' && x >= 0 && x <= 1;
const isTone = (c) => (typeof c === 'string' ? /^#[0-9a-f]{6}$/i.test(c) : !!c && typeof c === 'object' && GROUP.test(c.of ?? '') && c.shade >= -1 && c.shade <= 1 && Object.keys(c).length === 2);

/** a word or a card of one's own → the card, resolved: `from` its kin (its glove merged, adornment and family replaced
 * where given, `adornPlus` appended, tones merged), then its `skin` (a colourway) over the tones */
export function handwearCard(spec, depth = 0) {
  const C = typeof spec === 'string' ? HANDWEAR[spec] : spec;
  if (!C || typeof C !== 'object' || depth > 4) return C;
  const B = C.from !== undefined ? handwearCard(C.from, depth + 1) : null;
  const { from: _f, skin, adornPlus, ...own } = C;
  const out = B ? { ...B, ...own, glove: own.glove === false ? false : own.glove === undefined ? B.glove : B.glove ? { ...B.glove, ...own.glove } : own.glove,
    tones: { ...(B.tones || {}), ...(own.tones || {}) } } : { ...own };
  if (adornPlus) out.adorn = [...(out.adorn || []), ...adornPlus];
  if (skin !== undefined) out.tones = { ...(out.tones || {}), ...(typeof skin === 'string' ? SKINS[skin] : skin) };
  if (out.tones && !Object.keys(out.tones).length) delete out.tones;
  return out;
}

/** Error strings for a card (a word: is it one), by name */
export function validateHandwear(spec, label = 'handwear') {
  const words = Object.keys(HANDWEAR).join(', ');
  if (typeof spec === 'string') return Object.hasOwn(HANDWEAR, spec) ? [] : [`${label}: '${spec}' is not a handwear word (${words}), or give a card { glove, adorn }`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a word or a card { glove, adorn }`];
  const errs = [], KEYS = ['family', 'glove', 'adorn', 'adornPlus', 'tones', 'from', 'skin'];
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) errs.push(`${label}: a card takes ${KEYS.join(', ')}, not '${k}'`);
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(HANDWEAR, spec.from) : spec.from && typeof spec.from === 'object')) errs.push(`${label}.from: a handwear word (${words}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object' && !Array.isArray(spec.skin))) errs.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (spec.adornPlus !== undefined && !Array.isArray(spec.adornPlus)) errs.push(`${label}.adornPlus: a list of { prim, … }, laid after the adornment`);
  if (errs.length) return errs;
  if (typeof spec.from === 'object') { const sub = validateHandwear(spec.from, `${label}.from`); if (sub.length) return sub; }
  const C = handwearCard(spec), G = C.glove;
  if (C.family !== undefined && !HANDWEAR_FAMILIES.includes(C.family)) errs.push(`${label}.family: one of ${HANDWEAR_FAMILIES.join(', ')}`);
  if (G !== false && G !== undefined) {
    if (!G || typeof G !== 'object') errs.push(`${label}.glove: { cuff?, thick?, fingers?, thumb?, group? }, or false (the bare hand)`);
    else {
      if (G.cuff !== undefined && !share(G.cuff)) errs.push(`${label}.glove.cuff: a share of the forearm, 0 (at the wrist) to 1 (to the elbow)`);
      if (G.thick !== undefined && !(G.thick > 0 && G.thick <= 0.02)) errs.push(`${label}.glove.thick: metres, over 0 and at most 0.02`);
      for (const k of ['fingers', 'thumb']) if (G[k] !== undefined && !Object.hasOwn(FINGERS, G[k])) errs.push(`${label}.glove.${k}: one of ${Object.keys(FINGERS).join(', ')}`);
      if (G.group !== undefined && !GROUP.test(G.group)) errs.push(`${label}.glove.group: a group name`);
      for (const k of Object.keys(G)) if (!['cuff', 'thick', 'fingers', 'thumb', 'group'].includes(k)) errs.push(`${label}.glove: takes cuff, thick, fingers, thumb, group, not '${k}'`);
    }
  }
  if (C.adorn !== undefined && !Array.isArray(C.adorn)) errs.push(`${label}.adorn: a list of { prim, … }`);
  else for (const [i, a] of (C.adorn ?? []).entries()) {
    const P = ADORN_PRIMS[a?.prim], at = `${label}.adorn[${i}]`;
    if (!P) { errs.push(`${at}.prim: one of ${Object.keys(ADORN_PRIMS).join(', ')}`); continue; }
    for (const k of Object.keys(a)) if (k !== 'prim' && !P.keys.includes(k)) errs.push(`${at}: ${a.prim} takes ${P.keys.join(', ')}, not '${k}'`);
    const num = (k, lo, hi, what) => { if (a[k] !== undefined && !(typeof a[k] === 'number' && a[k] >= lo && a[k] <= hi)) errs.push(`${at}.${k}: ${what}, ${lo} … ${hi}`); };
    num('lift', 0, 0.02, 'metres'); num('thick', 0.0005, 0.01, 'metres'); num('width', 0.002, 0.08, 'metres'); num('height', 0.01, 0.25, 'metres'); num('spread', 1, 3, 'times the top');
    num('size', 0.002, 0.03, 'metres'); num('length', 0.005, 0.15, 'metres'); num('curl', 0, 180, 'degrees'); num('turns', 0.5, 12, 'turns'); num('w', 0.002, 0.04, 'metres');
    num('lines', 1, 5, 'lines'); num('droop', 0, 2, 'times its length');
    for (const [k, hi] of [['count', 8], ['rows', 8], ['cols', 6]]) if (a[k] !== undefined && !(Number.isInteger(a[k]) && a[k] >= 1 && a[k] <= hi)) errs.push(`${at}.${k}: a whole number, 1 … ${hi}`);
    if (a.seed !== undefined && !Number.isInteger(a.seed)) errs.push(`${at}.seed: a whole number`);
    if (a.group !== undefined && !GROUP.test(a.group)) errs.push(`${at}.group: a group name (Steel, Gilt …)`);
    if (a.prim === 'panel' || (a.prim === 'perf' && a.region !== undefined)) {
      const R = a.region, pair = (x, lo, hi) => Array.isArray(x) && x.length === 2 && x.every((v) => typeof v === 'number' && v >= lo && v <= hi) && x[0] < x[1];
      if (typeof R === 'string') { if (!GLOVE_REGIONS[R]) errs.push(`${at}.region: one of ${Object.keys(GLOVE_REGIONS).join(', ')}, or { seg, t, s }`); }
      else if (!R || !['hand', 'thumb', 'fingers', 'digits', ...FINGER_KINDS].includes(R.seg) || !pair(R.t, 0, 1) || !pair(R.s, -2, 2) || Object.keys(R).some((k) => !['seg', 't', 's'].includes(k))) errs.push(`${at}.region: a glover's piece by name, or { seg: hand | thumb | fingers | digits | <a finger>, t: [t0, t1] (0 … 1), s: [s0, s1] (−2 … 2, 0 the back of the hand, ±1 the palm) }`);
    }
    if (a.prim === 'strap') { if (a.at !== undefined && !share(a.at)) errs.push(`${at}.at: a share of the forearm from the wrist, 0 … 1`); if (a.buckle !== undefined && typeof a.buckle !== 'boolean') errs.push(`${at}.buckle: true (a buckle) or false (a snap)`); }
    if (a.prim === 'rings') {
      if (a.on !== undefined && !(Array.isArray(a.on) && a.on.length && a.on.every((d) => DIGITS.includes(d)))) errs.push(`${at}.on: digits (${DIGITS.join(', ')})`);
      if (a.at !== undefined && !(a.at >= 0.25 && a.at <= 0.95)) errs.push(`${at}.at: a share along the digit, 0.25 (its knuckle) … 0.95`);
      if (a.gem !== undefined && typeof a.gem !== 'boolean' && !(a.gem && typeof a.gem === 'object' && Object.keys(a.gem).every((k) => ['size', 'group'].includes(k)))) errs.push(`${at}.gem: true, or { size?, group? }`);
    }
    if (a.prim === 'claws' && a.on !== undefined && !(Array.isArray(a.on) && a.on.length && a.on.every((d) => DIGITS.includes(d)))) errs.push(`${at}.on: digits (${DIGITS.join(', ')})`);
    if (a.prim === 'jewel' && a.at !== undefined && !['back', 'knuckles'].includes(a.at)) errs.push(`${at}.at: back or knuckles`);
    if (['cuff', 'flare', 'fur', 'points', 'buttons', 'perf'].includes(a.prim) && G === false) errs.push(`${at}: a ${a.prim} is the glove's; this card wears none`);
    if (a.prim === 'strap' && (a.at ?? 0) > 0 && !((G?.cuff ?? 0) >= a.at)) errs.push(`${at}.at: up the forearm past the glove's cuff (${G?.cuff ?? 0}); a strap there wants the cuff that far`);
  }
  for (const [g, c] of Object.entries(C.tones || {})) if (!isTone(c)) errs.push(`${label}.tones.${g}: '#rrggbb', or { of: <group>, shade: −1 … 1 }`);
  return errs;
}

/** The handwear on a body (see the head of this file). */
export function wearHandwear(A, spec = 'gloves', { id = 'gloves', group = 'Gloves' } = {}) {
  const errs = validateHandwear(spec); if (errs.length) throw new Error(errs.join('; '));
  const C = handwearCard(spec), G = C.glove || null, used = new Set();
  const g0 = G?.group ?? group, parts = {};
  const put = (name, part) => { parts[name] = part; used.add(part.group); };
  // 1 GLOVE: the cuff up the forearm (the adapter's leather), the palm and the digits stood off
  if (G) {
    if ((G.cuff ?? 0) > 0 && A.cuff) for (const [name, part] of Object.entries(A.cuff(G, { id, group: g0 }))) put(name, part);
    const thick = G.thick ?? 0.0018;
    for (const S of A.sides) for (const kind of ['hand', ...DIGITS]) {
      const seg = A.seg(kind, S), P = seg && A.bare(seg); if (!P) continue;
      const keep = kind === 'hand' ? P.stations.length : FINGERS[(kind === 'thumb' ? G.thumb : null) ?? G.fingers ?? 'full'];
      put(`${id}_${seg}`, standOff(P, thick, { keep, tuck: kind === 'hand' && !parts[`${id}_${A.seg('foreArm', S)}`], group: g0 }));
    }
  }
  // 2 ADORN: per side, the card's primitives in order
  const Cap = (w) => w[0].toUpperCase() + w.slice(1);
  for (const S of A.sides) {
    // (a piece's name: its prim's or its region's, counted where the card lays it twice)
    const n = {}, name = (base) => { const k = (n[base] = (n[base] ?? -1) + 1); return k ? `${base}${k}` : base; };
    // (the surface under a piece: the glove where it covers, else the bare skin)
    const on = (kind) => { const seg = A.seg(kind, S); return seg ? [seg, (G && parts[`${id}_${seg}`]) || A.bare(seg)] : [null, null]; };
    const lay = (base, seg, P, piece, grp) => { if (piece) put(`${id}${base}_${seg}`, { ...piece, group: grp, bind: bindNearest(piece, P, { rings: true }) }); };
    // (the glove's TOP: the cuff's first ring up the forearm, or the wrist's; its surface, its kind and its `t` there)
    const [fs, cuffP] = on('foreArm'), cuffed = G && (G.cuff ?? 0) > 0 && cuffP && parts[`${id}_${fs}`];
    const top = cuffed ? { kind: 'foreArm', seg: fs, P: cuffP, t: extentOf(cuffP, 'foreArm', A)[0] } : (() => { const [hs, HP] = on('hand'); return HP ? { kind: 'hand', seg: hs, P: HP, t: 0.02 } : null; })();
    for (const a of C.adorn ?? []) {
      const grp = a.group ?? ADORN_PRIMS[a.prim].group, lift = a.lift;
      if (a.prim === 'panel') {
        const R = typeof a.region === 'string' ? GLOVE_REGIONS[a.region] : a.region, base = name(typeof a.region === 'string' ? Cap(a.region) : 'Panel');
        for (const kind of kindsOf(R.seg)) { const [seg, P] = on(kind); if (P) lay(base, seg, P, cutPiece(P, S, kind, A, R, { lift: lift ?? 0.0012, thick: a.thick ?? 0.0015 }), grp); }
      } else if (a.prim === 'points') {
        // (raised lines down the back, from over the wrist toward the knuckles, each a narrow piece)
        const [seg, P] = on('hand'), k = a.lines ?? 3, base = name('Points');
        if (P) for (let i = 0; i < k; i++) { const sc = (i - (k - 1) / 2) * 0.22; lay(`${base}${i}`, seg, P, cutPiece(P, S, 'hand', A, { t: [0.3, 0.78], s: [sc - 0.022, sc + 0.022] }, { lift: lift ?? 0.0009, thick: 0.0012 }), grp); }
      } else if (a.prim === 'buttons') {
        // (domed buttons a couple of centimetres apart: up the inner forearm from the wrist along a cuff that reaches, else
        // on the inside of the wrist toward the thumb, where a dress glove's opening is)
        const k = a.count ?? 1, r = (a.size ?? 0.006) / 2, base = name('Buttons'), up = cuffed && k > 1;
        const where = up ? { kind: 'foreArm', seg: fs, P: cuffP } : (() => { const [hs, HP] = on('hand'); return HP ? { kind: 'hand', seg: hs, P: HP } : null; })();
        if (!where?.P) continue;
        const [e0, e1] = extentOf(where.P, where.kind, A), len = (shellOf(where.P).length || 0.05) / Math.max(0.05, e1 - e0), step = 0.022 / len;
        for (let i = 0; i < k; i++) {
          const t = up ? e1 - 0.02 / len - i * step : 0.08 + i * step; if (t < e0 + 0.02 || t > e1 - 0.02) continue;
          lay(`${base}${i}`, where.seg, where.P, cutPiece(where.P, S, where.kind, A, { circle: { t, s: up ? -0.25 : 0.7, r } }, { lift: lift ?? 0.0012, thick: 0.003, dome: r * 0.6 }), grp);
        }
      } else if (a.prim === 'perf') {
        // (a grid of small dark holes inside the region, on each of its digits)
        const R = typeof a.region === 'string' ? GLOVE_REGIONS[a.region] : a.region ?? GLOVE_REGIONS.back, rows = a.rows ?? 4, cols = a.cols ?? 3, r = (a.size ?? 0.0024) / 2, base = name('Perf');
        for (const kind of kindsOf(R.seg)) { const [seg, P] = on(kind); if (!P) continue;
          for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            const t = R.t[0] + ((R.t[1] - R.t[0]) * (i + 0.5)) / rows, sc = R.s[0] + ((R.s[1] - R.s[0]) * (j + 0.5)) / cols;
            lay(`${base}${i * cols + j}`, seg, P, cutPiece(P, S, kind, A, { circle: { t, s: sc, r } }, { lift: 0.0004, thick: 0.0012 }), grp);
          } }
      } else if (a.prim === 'cuff' || a.prim === 'strap') {
        // (a band round the glove's top, or round the wrist or up the forearm, its width in metres along the segment)
        const up = a.prim === 'strap' && (a.at ?? 0) > 0, where = a.prim === 'cuff' ? top : up ? { kind: 'foreArm', seg: fs, P: cuffP, t: 1 - a.at } : (() => { const [hs, HP] = on('hand'); return HP ? { kind: 'hand', seg: hs, P: HP, t: 0.04 } : null; })();
        if (!where?.P) continue;
        const F = shellOf(where.P), len = (F.length || 0.05) / Math.max(0.05, extentOf(where.P, where.kind, A)[1] - extentOf(where.P, where.kind, A)[0]), w = (a.width ?? (a.prim === 'cuff' ? 0.02 : 0.016)) / len;
        const t0 = a.prim === 'cuff' ? where.t : Math.max(0, where.t - w / 2), base = name(Cap(a.prim));
        const band = cutPiece(where.P, S, where.kind, A, { t: [t0, t0 + w], s: [-1, 1] }, { lift: lift ?? 0.0025, thick: 0.004 });
        lay(base, where.seg, where.P, band, grp);
        if (a.prim === 'strap' && band && a.buckle !== undefined) {
          // (its snap or buckle on its back: the back of the hand at the wrist, the back of the forearm up it)
          const sc = where.kind === 'hand' ? 0 : 0.5, u = A.u(where.kind, t0 + w / 2), { p, n: nn } = F.at(u, slotOf(where.P.slots.length, S)(sc)), along = unitv(F.at(A.u(where.kind, t0 + w), slotOf(where.P.slots.length, S)(sc)).p.map((x, q) => x - p[q]));
          const b = a.buckle ? block(p.map((x, q) => x + nn[q] * (lift ?? 0.0025)), nn, along, { w: 0.016, h: w * len * 1.1, thick: 0.004 }) : block(p.map((x, q) => x + nn[q] * (lift ?? 0.0025)), nn, along, { w: 0.009, h: 0.009, thick: 0.003 });
          lay(`${base}${a.buckle ? 'Buckle' : 'Snap'}`, where.seg, where.P, b, a.buckle ? 'Brass' : 'Steel');
        }
      } else if (a.prim === 'flare') {
        // (from the wrist, opening out up the forearm: the cuff's last ring, or the palm's first)
        if (!top) continue;
        const ring = top.kind === 'foreArm' ? top.P.stations[top.P.stations.length - 1].points : top.P.stations[0].points, f = flareTop(ring, { height: a.height ?? 0.06, spread: a.spread ?? 1.4, lift: 0.003 });
        lay(name('Flare'), top.seg, top.P, f, grp);
      } else if (a.prim === 'fur') {
        if (!top) continue;
        const f = furRing(top.P.stations[0].points, { length: a.length ?? 0.025, droop: a.droop ?? 0.8, seed: (a.seed ?? 1) * 2 + (S === 'R' ? 0 : 1) });
        lay(name('Fur'), top.seg, top.P, f, grp);
      } else if (a.prim === 'knuckles') {
        const [hs, HP] = on('hand'), base = name('Knuckles'), L = lift ?? 0.004;
        if (HP) lay(`${base}Bar`, hs, HP, cutPiece(HP, S, 'hand', A, { t: [0.74, 0.99], s: [-0.56, 0.5] }, { lift: L, thick: 0.005, dome: 0.004 }), grp);
        for (const kind of FINGER_KINDS) { const [seg, P] = on(kind); if (P) lay(base, seg, P, cutPiece(P, S, kind, A, { t: [0.27, 0.47], s: [-0.42, 0.42] }, { lift: L * 0.6, thick: 0.004, dome: 0.0015 }), grp); }
      } else if (a.prim === 'lames') {
        const base = name('Lames'), L = lift ?? 0.0022;
        for (const kind of ['thumb', ...FINGER_KINDS]) { const [seg, P] = on(kind); if (!P) continue;
          (kind === 'thumb' ? [[0.22, 0.48], [0.52, 0.73], [0.77, 0.98]] : [[0.28, 0.48], [0.53, 0.73], [0.77, 0.98]]).forEach((t, i) => lay(`${base}${i}`, seg, P, cutPiece(P, S, kind, A, { t, s: [-0.5, 0.5] }, { lift: L, thick: 0.004 }), grp)); }
      } else if (a.prim === 'studs' || (a.prim === 'jewel' && a.at === 'knuckles')) {
        // (a round stud over each finger's knuckle, domed: the digit's back at its root)
        const base = name(a.prim === 'studs' ? 'Studs' : 'Jewel'), r = (a.size ?? (a.prim === 'studs' ? 0.005 : 0.006)) / 2;
        for (const kind of FINGER_KINDS) { const [seg, P] = on(kind); if (P) lay(base, seg, P, cutPiece(P, S, kind, A, { circle: { t: 0.3, s: 0, r } }, { lift: lift ?? 0.0025, thick: 0.004, dome: r * 0.7 }), grp); }
      } else if (a.prim === 'jewel') {
        const [hs, HP] = on('hand'), r = (a.size ?? 0.014) / 2;
        if (HP) lay(name('Jewel'), hs, HP, cutPiece(HP, S, 'hand', A, { circle: { t: 0.48, s: 0, r } }, { lift: lift ?? 0.003, thick: 0.004, dome: r * 0.6 }), grp);
      } else if (a.prim === 'rings') {
        const base = name('Rings'), at = a.at ?? 0.4, gem = a.gem ? (typeof a.gem === 'object' ? a.gem : {}) : null;
        for (const kind of a.on ?? ['ring']) { const [seg, P] = on(kind); if (!P) continue;
          const F = shellOf(P), w = (a.width ?? 0.005) / (F.length || 0.08);
          lay(base, seg, P, cutPiece(P, S, kind, A, { t: [at - w / 2, at + w / 2], s: [-1, 1] }, { lift: lift ?? 0.0012, thick: 0.003 }), grp);
          if (gem) { const g = gem.group ?? 'Gem'; lay(`${base}Gem`, seg, P, cutPiece(P, S, kind, A, { circle: { t: at, s: 0, r: (gem.size ?? 0.006) / 2 } }, { lift: (lift ?? 0.0012) + 0.0015, thick: 0.003, dome: 0.0015 }), g); }
        }
      } else if (a.prim === 'claws') {
        const base = name('Claws');
        for (const kind of a.on ?? DIGITS) { const [seg, P] = on(kind); if (!P || P.stations.length < 5) continue;
          // (from the pad on past the tip, curled toward the palm; rigid on the last phalanx)
          const sts = P.stations, e = sts.length - 1, m1 = mean(Object.values(sts[e].points)), m0 = mean(Object.values(sts[e - 1].points)), d = unitv(m1.map((x, q) => x - m0[q]));
          const palm = unitv(sts[e].points.back.map((x, q) => x - m1[q])), side = unitv([d[1] * palm[2] - d[2] * palm[1], d[2] * palm[0] - d[0] * palm[2], d[0] * palm[1] - d[1] * palm[0]]);
          const r = P.slots.reduce((acc, sl) => acc + Math.hypot(...sts[e].points[sl].map((x, q) => x - m1[q])), 0) / P.slots.length;
          const o = m1.map((x, q) => x - palm[q] * r * 0.25 + d[q] * r * 0.4), c = toeSpike(o, d, side, { length: a.length ?? 0.03, curl: a.curl ?? 50, r0: r * 0.62, taper: 0.06 });
          const bone = Object.keys(P.bind?.blend?.[sts[e].id] ?? {})[0] ?? P.bind.bone;
          put(`${id}${base}_${seg}`, { ...c, group: grp, bind: { bone, blend: {} } });
        }
      } else if (a.prim === 'wrap') {
        // (a ribbon spiralled round the hand from the wrist to the knuckles, a second the other way when crossed)
        const [hs, HP] = on('hand'), base = name('Wrap');
        if (HP) [1, ...(a.cross ? [-1] : [])].forEach((sign, j) => {
          const H = helixOn(HP, HP.stations, { turns: a.turns ?? 2.5, phase: j * 0.5, lift: lift ?? 0.0025, sign }), rb = ribbon(H.path, H.normals, { w: a.w ?? 0.014 });
          lay(`${base}${j || ''}`, hs, HP, rb, grp);
        });
      }
    }
  }
  // 4 TONE
  const tones = { ...HANDWEAR_TONES, ...(G ? { [g0]: HANDWEAR_TONES[g0] ?? HANDWEAR_TONES.Gloves } : {}), ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g))), named: Object.keys(C.tones || {}).filter((g) => used.has(g)) };
}
