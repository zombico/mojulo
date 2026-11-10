/**
 * LORE, DRAWN — the lorecube's relationships as diagram manifests, made from the same data its laws read, so a picture
 * is never kept by hand: change a polarity or a reserve and its drawing changes with it. Each is a plain diagram
 * manifest (title, viewBox, marks) that `mint_diagram` takes as it stands and lib/sketch-svg.js draws.
 *
 *   polarityDiagram(P, { title? })   the elements round a circle, each in its own tint: a ring's arrows (each beats the
 *                                    next), opposites joined by a dashed line with a head at both ends, allies by a
 *                                    thin line; under it the reasons that are said, and how many are still open
 *   reserveDiagram(R, { title? })    a reserve, what empties it, and the runtime's gauges that carry each: a spend no
 *                                    gauge carries stands alone, marked; a reserve split across meters says so
 *
 *   holdMatrixDiagram()              what each kind of holder can own of each dial, as the runtime stands: a grid, a
 *                                    cell its scope (its own, its own in one runtime, one a game, nothing)
 *   holdersDiagram(holders, { polarity?, reserves?, title? })   holders read together: each with its element, how it
 *                                    stands to the others, each difference asked for marked as its own or not, and the
 *                                    laws that do not hold
 *
 *   manualDiagram(M, { title? })     a monster manual: a column an element of its polarity, a row a role, each
 *                                    creature where it stands; under each element what it is weak to and resists
 *   treeDiagram(T, { title? })       a skill tree: a tier a step down, each technique with what it does and costs,
 *                                    learned at a rank or bought after what it requires (the arrows)
 *
 * Pure and deterministic: the same lore, the same manifest, byte for byte.
 */
import { resolvePolarity, relationsOf, elementHandles } from './polarity.js';
import { readReserve, carriersOf, SPENDS, CARRIERS, REFILLS, EMPTIES } from './reserve.js';
import { readManual, ROLE_IDS, manualLaws } from './manual.js';
import { readTree, depthsOf, treeLaws, DOES } from './tree.js';
import { affinityOf } from './polarity.js';
import { HOLDER_KIND_IDS, HOLDER_KINDS, DIAL_IDS, HOLDS, holdersReport } from './holder.js';

const INK = '#2b2f36', SOFT = '#7b8491', WARN = '#b4472f', PANEL = '#f3f1ec', LINE = '#4a5160';
const r1 = (v) => Math.round(v * 10) / 10;
const text = (x, y, value, o = {}) => ({ kind: 'text', x: r1(x), y: r1(y), value, size: o.size ?? 13, anchor: o.anchor ?? 'middle', color: o.color ?? INK, ...(o.weight ? { weight: o.weight } : {}) });
// a tint's ink: dark on a light tint, light on a dark one
const inkOn = (hex) => { const n = parseInt(hex.slice(1), 16), l = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); return l > 150 ? INK : '#ffffff'; };
// a row's words cut to their first clause, never mid-word
const brief = (says, max = 34) => { const head = says.split(/[:(,]/)[0].trim(); if (head.length <= max) return head; const cut = head.slice(0, max + 1); return cut.slice(0, cut.lastIndexOf(' ')); };
const SHAPE_SAYS = { poles: 'two poles, each the other\'s opposite', pairs: 'opposites, two by two', ring: 'a ring: each beats the next', wheel: 'a wheel: allied to its neighbours, opposed to the two across' };

/** The order round the circle: a pair's two across from each other, everything else as written. */
function seats(P) {
  if (P.shape !== 'pairs') return P.elements;
  const a = [], b = [];
  for (let i = 0; i < P.elements.length; i += 2) { a.push(P.elements[i]); b.push(P.elements[i + 1]); }
  return [...a, ...b];
}

export function polarityDiagram(v, { title } = {}) {
  // (a polarity as written, or one already resolved)
  const P = v && v.elements && v.beats ? v : resolvePolarity(v), order = seats(P), n = order.length;
  const W = 560, cx = W / 2, cy = 250, R = 150, r = 38;
  const at = Object.fromEntries(order.map((e, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n + (n === 2 ? Math.PI / 2 : 0);
    return [e, [cx + R * Math.cos(t), cy + R * Math.sin(t)]];
  }));
  // a line between two elements, stopped at each circle's edge
  const join = (a, b, o) => {
    const [x1, y1] = at[a], [x2, y2] = at[b], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, gap = r + 6;
    return { kind: 'line', x1: r1(x1 + ux * gap), y1: r1(y1 + uy * gap), x2: r1(x2 - ux * gap), y2: r1(y2 - uy * gap), stroke: o.stroke ?? LINE, strokeWidth: o.width ?? 2, ...(o.dash ? { dash: o.dash } : {}), head: o.head ?? 'none', ...(o.tail ? { tail: o.tail } : {}) };
  };
  const marks = [];
  for (const a of order) {
    for (const b of P.allies[a]) if (order.indexOf(a) < order.indexOf(b)) marks.push(join(a, b, { stroke: SOFT, width: 1.2 }));
    for (const b of P.opposes[a]) if (order.indexOf(a) < order.indexOf(b)) marks.push(join(a, b, { dash: '6 5', head: 'arrow', tail: 'arrow', stroke: WARN }));
    for (const b of P.beats[a]) marks.push(join(a, b, { head: 'arrow' }));
  }
  for (const e of order) {
    const H = elementHandles(e), [x, y] = at[e];
    marks.push({ kind: 'circle', cx: r1(x), cy: r1(y), r, fill: H.tint, stroke: INK, strokeWidth: 1.5 });
    marks.push(text(x, y + 5, e, { color: inkOn(H.tint), weight: 600 }));
  }
  marks.push(text(cx, 34, title ?? P.id ?? 'a polarity', { size: 18, weight: 700 }));
  marks.push(text(cx, 56, SHAPE_SAYS[P.shape], { color: SOFT }));
  // the reasons that are said, then what is still open
  const rels = relationsOf(P), said = rels.filter((k) => P.why[k]);
  let y = cy + R + r + 40;
  for (const k of said) { marks.push(text(40, y, `${k.replace('>', ' beats ').replace('|', ' and ')}: ${P.why[k]}`, { anchor: 'start', size: 12 })); y += 20; }
  if (said.length < rels.length) { marks.push(text(40, y, `${rels.length - said.length} of ${rels.length} relations have no reason yet`, { anchor: 'start', size: 12, color: SOFT })); y += 20; }
  // the key, only for what is drawn
  const key = [...(Object.values(P.beats).some((l) => l.length) ? ['solid arrow: beats'] : []), ...(Object.values(P.opposes).some((l) => l.length) ? ['dashed, both ways: opposes'] : []), ...(Object.values(P.allies).some((l) => l.length) ? ['thin line: allied'] : [])];
  marks.push(text(cx, y + 8, key.join('   ·   '), { size: 11, color: SOFT }));
  return { title: title ?? P.id ?? 'a polarity', viewBox: { width: W, height: Math.round(y + 30) }, marks };
}

export function reserveDiagram(v, { title } = {}) {
  const V = readReserve(v), C = carriersOf(V);
  const rows = Math.max(V.spent.length, C.carriers.length, 1), rowH = 64, top = 96, W = 860;
  const xR = 30, wR = 190, xS = 300, wS = 200, xG = 600, wG = 230, bh = 46;
  const yOf = (i, n) => top + ((rows - n) * rowH) / 2 + i * rowH;
  const box = (x, y, w, o = {}) => ({ kind: 'rect', x, y: r1(y), w, h: bh, rx: 8, fill: o.fill ?? PANEL, stroke: o.stroke ?? INK, strokeWidth: 1.4, ...(o.dash ? { dash: o.dash } : {}) });
  const marks = [];
  marks.push(text(W / 2, 34, title ?? `${V.name}: a reserve`, { size: 18, weight: 700 }));
  marks.push(text(xR + wR / 2, 72, 'the reserve', { color: SOFT, size: 12 }), text(xS + wS / 2, 72, 'what empties it', { color: SOFT, size: 12 }), text(xG + wG / 2, 72, 'the gauge that carries it', { color: SOFT, size: 12 }));
  const yR = top + ((rows - 1) * rowH) / 2;
  marks.push(box(xR, yR, wR, { fill: '#e6dcc4' }), text(xR + wR / 2, yR + 20, V.name, { weight: 700 }));
  marks.push(text(xR + wR / 2, yR + 37, V.refill ? `back by ${V.refill.join(', ')}` : 'how it returns: not said', { size: 11, color: SOFT }));
  const ySpend = {}, yGauge = {};
  C.carriers.forEach((c, i) => { yGauge[c.id] = yOf(i, C.carriers.length); });
  V.spent.forEach((s, i) => {
    const y = (ySpend[s] = yOf(i, V.spent.length)), lost = C.uncarried.some((u) => u.spend === s);
    marks.push({ kind: 'line', x1: xR + wR, y1: r1(yR + bh / 2), x2: xS, y2: r1(y + bh / 2), stroke: LINE, strokeWidth: 1.4, head: 'arrow' });
    marks.push(box(xS, y, wS, lost ? { stroke: WARN, dash: '6 4', fill: '#fbeee9' } : {}), text(xS + wS / 2, y + 20, s, { weight: 600, color: lost ? WARN : INK }));
    marks.push(text(xS + wS / 2, y + 37, lost ? 'no gauge carries it' : brief(SPENDS[s]), { size: 10, color: lost ? WARN : SOFT }));
  });
  for (const c of C.carriers) {
    const y = yGauge[c.id];
    marks.push(box(xG, y, wG, c.fits ? { fill: '#dfeadf' } : {}), text(xG + wG / 2, y + 20, c.id, { weight: 600 }));
    marks.push(text(xG + wG / 2, y + 37, c.lacks.length ? `cannot: ${c.lacks.join(', ')}` : `${CARRIERS[c.id].scope}'s · ${CARRIERS[c.id].refills.join(', ')}`, { size: 10, color: c.lacks.length ? WARN : SOFT }));
    for (const s of c.carries) marks.push({ kind: 'line', x1: xS + wS, y1: r1(ySpend[s] + bh / 2), x2: xG, y2: r1(y + bh / 2), stroke: LINE, strokeWidth: 1.4, head: 'arrow' });
  }
  let y = top + rows * rowH + 14;
  const notes = [...(C.split ? [C.split] : []), ...(V.empty ? [`at none: ${V.empty.map((e) => EMPTIES[e]).join('; ')}`] : []), ...(V.refill ? [`it returns ${V.refill.map((r) => REFILLS[r]).join('; ')}`] : [])];
  for (const line of notes) { marks.push(text(30, y, line, { anchor: 'start', size: 12, color: line === C.split ? WARN : INK })); y += 20; }
  return { title: title ?? `${V.name}: a reserve`, viewBox: { width: W, height: Math.round(y + 16) }, marks };
}

const SCOPE_FILL = { own: '#bfe0bf', part: '#f1dc9b', world: '#d9dde3', none: '#ffffff' };
const SCOPE_SAYS = { own: 'its own', part: 'its own in one runtime only', world: 'one a game: every holder the same', none: 'nothing gives it' };

export function holdMatrixDiagram({ title = 'what each kind of holder can own' } = {}) {
  const x0 = 190, y0 = 110, cw = 74, ch = 46, W = x0 + DIAL_IDS.length * cw + 30;
  const marks = [text(W / 2, 34, title, { size: 18, weight: 700 }), text(W / 2, 56, 'a slice of a power system, by who holds it: as the runtime stands', { color: SOFT })];
  DIAL_IDS.forEach((d, j) => marks.push(text(x0 + j * cw + cw / 2, y0 - 12, d, { size: 12, weight: 600 })));
  HOLDER_KIND_IDS.forEach((k, i) => {
    const y = y0 + i * ch;
    marks.push(text(x0 - 14, y + 20, k, { anchor: 'end', weight: 700 }), text(x0 - 14, y + 35, brief(HOLDER_KINDS[k].reads, 30), { anchor: 'end', size: 10, color: SOFT }));
    DIAL_IDS.forEach((d, j) => {
      const c = HOLDS[k][d];
      marks.push({ kind: 'rect', x: x0 + j * cw + 2, y: y + 2, w: cw - 4, h: ch - 4, rx: 5, fill: SCOPE_FILL[c.scope], stroke: c.scope === 'none' ? '#c9ced6' : INK, strokeWidth: c.scope === 'none' ? 1 : 1.2, ...(c.scope === 'none' ? { dash: '3 3' } : {}) });
      marks.push(text(x0 + j * cw + cw / 2, y + 27, c.scope, { size: 11, color: c.scope === 'none' ? SOFT : INK }));
    });
  });
  let y = y0 + HOLDER_KIND_IDS.length * ch + 30;
  for (const sc of Object.keys(SCOPE_FILL)) {
    marks.push({ kind: 'rect', x: x0, y: y - 12, w: 16, h: 16, rx: 3, fill: SCOPE_FILL[sc], stroke: sc === 'none' ? '#c9ced6' : INK, strokeWidth: 1 }, text(x0 + 24, y + 1, `${sc}: ${SCOPE_SAYS[sc]}`, { anchor: 'start', size: 12 }));
    y += 22;
  }
  return { title, viewBox: { width: W, height: Math.round(y + 6) }, marks };
}

const LAW_SAYS = {
  distinct: (v) => `two holders hold one element: ${v}`,
  'in-polarity': (v) => `outside the polarity: ${v}`,
  'every-difference-own': (v) => `asked to differ by what is not their own: ${v}`,
  'weakness-lands': (v) => `stands against another, and its weakness has nowhere to land: ${v}`,
  'reserve-carried': (v) => `its reserve has no gauge of its own: ${v}`,
};

export function holdersDiagram(list, { polarity, reserves, title = 'who holds what' } = {}) {
  const R = holdersReport(list, { polarity, reserves }), n = R.holders.length;
  const W = 900, top = 92, rowH = 70, xE = 40, xN = 96, xD = 330, chipW = 78, chipH = 26;
  const marks = [text(W / 2, 34, title, { size: 18, weight: 700 }), text(xN, 72, 'holder', { anchor: 'start', color: SOFT, size: 12 }), text(xD, 72, 'differs by (green: its own · amber: one runtime · grey: the whole game\'s · dashed: nothing gives it)', { anchor: 'start', color: SOFT, size: 12 })];
  R.holders.forEach((h, i) => {
    const y = top + i * rowH, H = h.element ? elementHandles(h.element) : null;
    marks.push({ kind: 'circle', cx: xE + 18, cy: y + 24, r: 18, fill: H ? H.tint : '#ffffff', stroke: INK, strokeWidth: 1.4 });
    marks.push(text(xN, y + 20, h.name ?? h.id, { anchor: 'start', weight: 700 }));
    const stands = Object.entries(h.stands ?? {}).filter(([, r]) => r !== 'neutral').map(([o, r]) => `${r} ${o}`);
    marks.push(text(xN, y + 38, [h.kind, h.element, ...(h.reserve ? [`${h.reserve.name}${h.reserve.carried ? '' : ' (no gauge)'}`] : [])].filter(Boolean).join(' · '), { anchor: 'start', size: 11, color: h.reserve && !h.reserve.carried ? WARN : SOFT }));
    if (stands.length) marks.push(text(xN, y + 53, stands.join(', '), { anchor: 'start', size: 10, color: SOFT }));
    h.differs.forEach((d, j) => {
      const x = xD + j * (chipW + 8), off = d.scope === 'world' || d.scope === 'none';
      marks.push({ kind: 'rect', x, y: y + 10, w: chipW, h: chipH, rx: 13, fill: SCOPE_FILL[d.scope], stroke: off ? WARN : INK, strokeWidth: 1.2, ...(d.scope === 'none' ? { dash: '4 3' } : {}) });
      marks.push(text(x + chipW / 2, y + 27, d.dial, { size: 11, color: off ? WARN : INK }));
    });
  });
  let y = top + n * rowH + 16;
  const broken = R.laws.filter((l) => !l.ok);
  if (!broken.length) { marks.push(text(40, y, 'every law holds', { anchor: 'start', size: 12, color: SOFT })); y += 20; }
  for (const l of broken) { marks.push(text(40, y, LAW_SAYS[l.law](l.value), { anchor: 'start', size: 12, color: WARN })); y += 20; }
  return { title, viewBox: { width: W, height: Math.round(y + 10) }, marks };
}

const title = (id) => id.replace(/(^|-)([a-z])/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());
// a tint washed toward white, for a panel a dark word can sit on
const wash = (hex, k = 0.78) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k)); return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`; };

export function manualDiagram(v, { title: said } = {}) {
  const M = readManual(v), P = resolvePolarity(M.polarity), rows = [...ROLE_IDS].reverse();
  const x0 = 110, colW = 176, y0 = 118, pad = 8, chipH = 34;
  const tall = Object.fromEntries(rows.map((r) => [r, Math.max(1, ...P.elements.map((e) => M.creatures.filter((c) => c.role === r && c.element === e).length))]));
  const yOf = {}; let y = y0;
  for (const r of rows) { yOf[r] = y; y += tall[r] * (chipH + 6) + pad * 2; }
  const W = x0 + P.elements.length * colW + 30, name = said ?? M.name ?? 'a monster manual';
  const marks = [text(W / 2, 34, name, { size: 18, weight: 700 }), text(W / 2, 56, `on ${P.id ?? 'its own polarity'}: ${SHAPE_SAYS[P.shape]}`, { color: SOFT })];
  P.elements.forEach((e, j) => {
    const H = elementHandles(e), cx = x0 + j * colW + colW / 2;
    marks.push({ kind: 'rect', x: x0 + j * colW + 4, y: y0 - 6, w: colW - 8, h: y - y0 + 6, rx: 8, fill: wash(H.tint, 0.88), stroke: '#c9ced6', strokeWidth: 1 });
    marks.push({ kind: 'circle', cx, cy: 88, r: 14, fill: H.tint, stroke: INK, strokeWidth: 1.2 }, text(cx + 22, 93, e, { anchor: 'start', weight: 700 }));
    const A = affinityOf(P, e);
    marks.push(text(cx, y + 20, A.weak.length ? `weak to ${A.weak.join(', ')}` : 'weak to nothing', { size: 11, color: A.weak.length ? INK : WARN }), text(cx, y + 36, `resists ${A.resist.join(', ')}`, { size: 11, color: SOFT }));
  });
  for (const r of rows) {
    marks.push(text(x0 - 12, yOf[r] + pad + 20, r, { anchor: 'end', weight: 700 }));
    P.elements.forEach((e, j) => {
      M.creatures.filter((c) => c.role === r && c.element === e).forEach((c, k) => {
        const x = x0 + j * colW + 14, cy = yOf[r] + pad + k * (chipH + 6);
        marks.push({ kind: 'rect', x, y: cy, w: colW - 28, h: chipH, rx: 6, fill: '#ffffff', stroke: INK, strokeWidth: r === 'boss' ? 2 : 1.2 });
        marks.push(text(x + (colW - 28) / 2, cy + 15, c.name ?? title(c.id), { size: 12, weight: 600 }));
        marks.push(text(x + (colW - 28) / 2, cy + 28, M.levels ? `level ${M.levels[c.id]}` : 'level not said', { size: 10, color: SOFT }));
      });
    });
  }
  let yy = y + 62;
  const off = M.creatures.filter((c) => !P.elements.includes(c.element));
  if (off.length) { marks.push(text(30, yy, `outside the polarity: ${off.map((c) => `${c.id} (${c.element})`).join(', ')}`, { anchor: 'start', size: 12, color: WARN })); yy += 20; }
  const SAYS = { 'every-element': (x) => `no creature of: ${x}`, 'every-role': (x) => `no ${x}`, 'every-weakness': (x) => `weak to nothing: ${x}`, ladder: (x) => `worth no more than a lesser role: ${x}` };
  for (const l of manualLaws(M).filter((x) => !x.ok && SAYS[x.law])) { marks.push(text(30, yy, SAYS[l.law](l.value), { anchor: 'start', size: 12, color: WARN })); yy += 20; }
  return { title: name, viewBox: { width: W, height: Math.round(yy + 6) }, marks };
}

export function treeDiagram(v, { title: said } = {}) {
  const T = readTree(v), D = depthsOf(T), H = elementHandles(T.element), name = said ?? T.name ?? title(T.id);
  // a tier a depth (the first the unplaced), a tier of more than four wrapped onto rows of four
  const byDepth = [];
  for (const t of T.techniques) { const d = D[t.id] ?? -1; (byDepth[d + 1] ||= []).push(t); }
  const tiers = [], labels = [];
  byDepth.forEach((row, i) => { for (let k = 0; row && k < row.length; k += 4) { tiers.push(row.slice(k, k + 4)); labels.push(k ? '' : i === 0 ? '?' : `${i - 1}`); } });
  const bw = 150, bh = 52, gapX = 26, rowH = 96, top = 96, widest = Math.max(1, ...tiers.map((r) => r.length));
  const W = Math.max(520, 150 + widest * (bw + gapX)), at = {};
  const marks = [text(W / 2, 34, name, { size: 18, weight: 700 }), text(W / 2, 56, `a school of ${T.element}${T.order ? '' : ': its techniques, in no order yet'}`, { color: SOFT })];
  tiers.forEach((row, i) => {
    const y = top + i * rowH, x0 = (W - (row.length * bw + (row.length - 1) * gapX)) / 2 + 20;
    if (labels[i]) marks.push(text(26, y + bh / 2 + 4, labels[i], { size: 12, color: SOFT, anchor: 'start' }));
    row.forEach((t, k) => { at[t.id] = [r1(x0 + k * (bw + gapX)), y]; });
  });
  let lanes = 0;
  for (const t of T.techniques) for (const r of T.order?.[t.id]?.requires ?? []) {
    if (!at[r] || !at[t.id]) continue;
    const x1 = r1(at[r][0] + bw / 2), y1 = at[r][1] + bh, x2 = r1(at[t.id][0] + bw / 2), y2 = at[t.id][1] - 4;
    // an arrow to the next tier goes straight; one that skips a tier goes round by a lane at the side, never behind a box
    if (y2 - y1 < rowH) marks.push({ kind: 'line', x1, y1, x2, y2, stroke: LINE, strokeWidth: 1.5, head: 'arrow' });
    else { const lane = W - 34 - 12 * lanes++; marks.push({ kind: 'polyline', points: [[x1 + 40, y1], [x1 + 40, y1 + 14], [lane, y1 + 14], [lane, y2 - 12], [x2 + 40, y2 - 12], [x2 + 40, y2]], stroke: LINE, strokeWidth: 1.5, head: 'arrow' }); }
  }
  for (const t of T.techniques) {
    const [x, y] = at[t.id], o = T.order?.[t.id], c = T.costs?.[t.id], lost = T.order && D[t.id] === undefined;
    marks.push({ kind: 'rect', x, y, w: bw, h: bh, rx: 8, fill: lost ? '#fbeee9' : wash(H.tint), stroke: lost ? WARN : o?.at !== undefined ? INK : H.tint, strokeWidth: o?.at !== undefined ? 1.8 : 1.4, ...(lost ? { dash: '6 4' } : {}) });
    marks.push(text(x + bw / 2, y + 19, t.name ?? title(t.id), { size: 12, weight: 700 }));
    marks.push(text(x + bw / 2, y + 33, `${t.does}${t.status ? `: ${t.status}` : ''}${c ? ` · ${c.mp} MP` : ''}`, { size: 10, color: SOFT }));
    marks.push(text(x + bw / 2, y + 46, lost ? 'cannot be reached' : !o ? brief(DOES[t.does].reads, 30) : o.at !== undefined ? `learned at rank ${o.at}` : `bought${c?.points ? `: ${c.points} point${c.points === 1 ? '' : 's'}` : ''}`, { size: 10, color: lost ? WARN : INK }));
  }
  let y = top + tiers.length * rowH;
  marks.push(text(26, 84, 'depth', { size: 10, color: SOFT, anchor: 'start' }));
  const SAYS = { rooted: () => 'nothing is learned at rank 1: a member of this class starts with no technique', 'no-cycle': (x) => `require each other: ${x}`, reachable: (x) => `cannot be reached: ${x}`, 'within-reach': (x) => `learned past the last rank a class has: ${x}`, 'costs-rise': (x) => `costs less than what it requires: ${x}` };
  const broken = treeLaws(T).filter((l) => !l.ok);
  if (T.order && !broken.length) { marks.push(text(26, y, 'dark border: learned by rank · arrows: what a bought technique requires', { anchor: 'start', size: 11, color: SOFT })); y += 20; }
  for (const l of broken) { marks.push(text(26, y, SAYS[l.law](l.value), { anchor: 'start', size: 12, color: WARN })); y += 20; }
  return { title: name, viewBox: { width: W, height: Math.round(y + 8) }, marks };
}
