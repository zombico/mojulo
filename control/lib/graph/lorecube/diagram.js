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
 * Pure and deterministic: the same lore, the same manifest, byte for byte.
 */
import { resolvePolarity, relationsOf, elementHandles } from './polarity.js';
import { readReserve, carriersOf, SPENDS, CARRIERS, REFILLS, EMPTIES } from './reserve.js';

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
