/**
 * historic/assets/pompeii — the Pompeii kit (79 CE), PLACEHOLDERS for now: what the layout's slots are built with
 * until the reference drawings are made (docs/historic/pompeii/README.md) and each piece is designed. Every asset
 * here is `designed: false`, so the asset call lists it as still to design. Where another culture's piece reads
 * close enough it is borrowed as it stands (the Lindos courtyard house, wall, tower, theatre, statue); the rest are
 * massing blocks in the style card's numbers (../style/pompeii.js). Same contract as the other kits (./kit.js).
 *
 * A slot's `state` (the record's state at 79 CE: ../record/pompeii.js) shows on the block: damaged stands
 * roofless (a relic lower still); unfinished stands roofless at part height with scaffolding; under repair keeps its roof, with
 * scaffolding on its front.
 */
import { house as lnHouse, wallRun, tower as lnTower, theatre as lnTheatre, statueBase, gableRoof, flame } from './lindos.js';
import { slopedFlight } from './kit.js';
import { POMPEII_STYLE } from '../style/pompeii.js';
import { scaleHex } from '../../polygonizer/vexar.js';

const KIT = POMPEII_STYLE.kit;
const PASTAS = new Set(['column', 'capital', 'abacus']);
const box = (kind, x, y, w, d, z0, z1, tint, o = {}) => ({ kind, x, y, w, d, z0, z1, tint, ...o });
const drum = (kind, cx, cy, r, z0, z1, tint, o = {}) => ({ kind, solid: 'drum', x: cx - r, y: cy - r, w: 2 * r, d: 2 * r, z0, z1, tint, ...o });

/** Another culture's designed piece, borrowed as a placeholder under a Pompeii id. */
const borrowed = (A, id, extra = {}) => ({ ...A, id, sheet: null, designed: false, borrowedFrom: A.id, ...extra });

/** A column of the order at (cx, cy): a plain drum of `h`, its diameter from the order's ratio, on a square base. */
const column = (cx, cy, z0, h, P, order = 'tuscan', tint = P.stucco) => {
  const r = h / KIT.order[order] / 2;
  return [box('column-base', cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6, z0, z0 + r * 0.6, tint), drum('column', cx, cy, r, z0 + r * 0.6, z0 + h - r * 0.8, tint, { sides: 8, taper: 0.88 }), box('capital', cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4, z0 + h - r * 0.8, z0 + h, tint)];
};
const row = (x0, x1, y, n, z0, h, P, order, tint) => { const out = []; for (let i = 0; i < n; i++) out.push(...column(n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1), y, z0, h, P, order, tint)); return out; };

/** Scaffolding on the front face (−y): poles, two plank decks, a ladder of braces. */
const scaffold = (W, h, P) => {
  const out = [], n = Math.max(2, Math.round(W / 3));
  for (let i = 0; i <= n; i++) { const x = (W * i) / n; out.push(box('scaffold', x - 0.06, -1.3, 0.12, 0.12, 0, h + 1, P.timber), box('scaffold', x - 0.06, -0.2, 0.12, 0.12, 0, h + 1, P.timber)); }
  for (const z of [h * 0.45, h * 0.9]) out.push(box('scaffold', 0, -1.3, W, 1.2, z, z + 0.06, scaleHex(P.timber, 1.15)));
  return out;
};
/** How a building's state at 79 shows: its wall height factor, whether it keeps its roof, whether it has scaffolding. */
const stateOf = (state) => ({ damaged: { h: 0.85, roof: false, scaffold: false }, relic: { h: 0.75, roof: false, scaffold: false }, unfinished: { h: 0.6, roof: false, scaffold: true }, 'under-repair': { h: 1, roof: true, scaffold: true } }[state] || { h: 1, roof: true, scaffold: false });

// ── the forum ──

/**
 * A podium temple: a high podium (the card's 2.5–3.5 m) entered by one stair at the front only, a deep porch of
 * columns, the cella behind, a low gable roof with a pediment. The Capitolium, the Temples of Apollo and Venus.
 */
export const podiumTemple = {
  id: 'pp-temple', sheet: null, designed: false, patterns: ['podium-temple', 'classical-order', 'tile-roof'],
  read: 'A temple raised on a high podium, one broad stair at the front, a deep porch of columns, the cella behind, a low tiled gable with a pediment.',
  notes: ['Placeholder: podium `podium` m (slot; card 2.5–3.5), stair 40% of the depth, six columns across, 10 diameters (Corinthian).', 'State: damaged = roofless, unfinished = part-built with scaffolding.', 'Next: read off pompeii-capitolium.webp.'],
  envelope: { w: [12, 20], d: [24, 40] },
  build({ W, D, slot }, { palette: P }) {
    const S = stateOf(slot.state), ph = slot.podium || KIT.podium.h[1] - 0.5, sd = D * 0.22, out = [];
    out.push(box('podium', 0, sd, W, D - sd, 0, ph, P.tufa));
    out.push(...slopedFlight({ x: W * 0.15, y: 0, w: W * 0.7, d: sd }, 0, ph, P.tufa, 'y+', { riser: 0.25 }));
    const ch = Math.min(12, W * 0.62) * S.h, pd = (D - sd) * 0.35, cell = { x: 0.6, y: sd + pd, w: W - 1.2, d: D - sd - pd - 0.4 };
    out.push(...row(1, W - 1, sd + 0.9, 6, ph, ch, P, 'corinthian'), ...row(1, W - 1, sd + pd * 0.6, 4, ph, ch, P, 'corinthian'));
    out.push(box('cella', cell.x, cell.y, cell.w, cell.d, ph, ph + ch, P.stucco));
    if (S.roof) out.push(box('entablature', 0.3, sd + 0.3, W - 0.6, D - sd - 0.6, ph + ch, ph + ch + 1.3, P.stucco), ...gableRoof({ x: 0.3, y: sd + 0.3, w: W - 0.6, d: D - sd - 0.6 }, ph + ch + 1.3, KIT.roof.pitch, P, { axis: 'y', pediments: true, eave: 0.5 }));
    if (S.scaffold) out.push(...scaffold(W, ph + ch, P).map((b) => ({ ...b, y: b.y + sd })));
    return out;
  },
};

/** A public hall: walls of one height, a low gable without a pediment (the Basilica, the Eumachia building, the offices, baths blocks). */
export const hall = {
  id: 'pp-hall', sheet: null, designed: false, patterns: ['tile-roof'],
  read: 'A plain public hall: stuccoed walls, a broad door on the front, a low tiled gable roof; no pediment.',
  notes: ['Placeholder: walls `h` m (slot, default 9); the ridge along the long side.', '`dome` (slot): a domed round room standing out of the roof (the baths\' laconicum).'],
  envelope: { w: [10, 70], d: [10, 70] },
  build({ W, D, slot }, { palette: P }) {
    const S = stateOf(slot.state), h = (slot.h || 9) * S.h, out = [box('hall-wall', 0, 0, W, D, 0, h, P.stucco), box('socle', -0.05, -0.06, W + 0.1, 0.12, 0, KIT.wall.socle[1], P.red), box('door', W / 2 - 1.5, -0.08, 3, 0.06, 0, Math.min(h - 1, 5), P.door)];
    // the gable ends closed flush in the wall's stucco (a plain gable, no cornice: not a temple's pediment)
    if (S.roof) out.push(...gableRoof({ x: 0, y: 0, w: W, d: D }, h, KIT.roof.pitch, P, { axis: W >= D ? 'x' : 'y', pediments: true, eave: 0.6 }).map((b) => (b.kind === 'pediment' ? { ...b, kind: 'gable' } : b)));
    if (slot.dome) { const r = Math.min(W, D) * 0.18; out.push(drum('hall-wall', W * 0.75, D * 0.5, r, h, h + 1, P.stucco, { sides: 12 }), { kind: 'dome', solid: 'dome', sides: 12, x: W * 0.75 - r, y: D * 0.5 - r, w: 2 * r, d: 2 * r, z0: h + 1, z1: h + 1 + r, tint: P.stucco }); }
    if (S.scaffold) out.push(...scaffold(W, h, P));
    return out;
  },
};

/** A two-storey portico along the forum: Doric under Ionic (the upper order the card's `upper` of the lower), a lean-to roof. Its front faces the square. */
export const portico = {
  id: 'pp-portico', sheet: null, designed: false, patterns: ['colonnade', 'classical-order', 'tile-roof'],
  read: 'A long two-storey colonnade facing the square: Doric columns below, shorter Ionic above, a gallery floor between, a tiled lean-to roof against the buildings behind.',
  notes: ['Placeholder: lower order 5.2 m, upper 0.75 of it, columns about 3 m apart (heights not in the record).', 'State unfinished: the travertine replacement with scaffolding.'],
  envelope: { w: [10, 150], d: [4, 8] },
  build({ W, D, slot }, { palette: P }) {
    const S = stateOf(slot.state), h1 = 5.2, h2 = h1 * KIT.order.upper, n = Math.max(2, Math.round(W / 3) + 1), t = slot.state === 'unfinished' ? P.travertine : P.tufa, out = [];
    out.push(box('crepis', 0, 0, W, D, 0, 0.3, t), ...row(0.5, W - 0.5, 0.6, n, 0.3, h1, P, 'doric', t), box('gallery', 0, 0.1, W, D - 0.1, 0.3 + h1, 0.3 + h1 + 0.5, t));
    out.push(...row(0.5, W - 0.5, 0.6, n, 0.8 + h1, h2, P, 'ionic', t), box('portico-wall', 0, D - 0.6, W, 0.6, 0, 0.8 + h1 + h2, P.stucco));
    const top = 0.8 + h1 + h2;
    out.push({ kind: 'roof', solid: 'wedge', x: -0.3, y: -0.4, w: W + 0.6, d: D + 0.4, z0: top, z1: top + D * Math.tan((KIT.roof.pitch * Math.PI) / 180), rise: 'y+', tint: P.tile });
    if (S.scaffold) out.push(...scaffold(W, top, P));
    return out;
  },
};

/** A colonnaded court open to the sky: the Temple of Apollo's enclosure, the Triangular Forum, the Quadriporticus, a palaestra. */
export const court = {
  id: 'pp-court', sheet: null, designed: false, patterns: ['colonnade', 'peristyle', 'tile-roof'],
  read: 'An open court ringed by a single-storey colonnade under a tiled lean-to roof, a blank outer wall.',
  notes: ['Placeholder: colonnade 4.6 m, 5 m deep, columns about 3 m apart (Doric of Nocera tuff).', '`open` (slot): the side left without a colonnade.'],
  envelope: { w: [30, 120], d: [30, 120] },
  build({ W, D, slot }, { palette: P }) {
    const h = 4.6, dp = 5, out = [], grounds = [{ kind: 'court', x: dp, y: dp, w: W - 2 * dp, d: D - 2 * dp, z: 0.05, fill: P.court, surface: 'flagstone' }];
    const side = (r, along, roofRise, colAt) => {
      out.push(box('court-wall', ...(along === 'x' ? [r.x, roofRise === 'y-' ? r.y + r.d - 0.6 : r.y, r.w, 0.6] : [roofRise === 'x-' ? r.x + r.w - 0.6 : r.x, r.y, 0.6, r.d]), 0, h + 1, P.stucco));
      const n = Math.max(2, Math.round((along === 'x' ? r.w : r.d) / 3));
      for (let i = 0; i <= n; i++) { const u = (along === 'x' ? r.x + 1 + ((r.w - 2) * i) / n : r.y + 1 + ((r.d - 2) * i) / n); out.push(...column(along === 'x' ? u : colAt, along === 'x' ? colAt : u, 0, h, P, 'doric', P.tufa)); }
      out.push({ kind: 'roof', solid: 'wedge', ...r, z0: h, z1: h + 1, rise: roofRise, tint: P.tile });
    };
    const open = slot.open || null;
    if (open !== 'n') side({ x: 0, y: 0, w: W, d: dp }, 'x', 'y-', dp - 0.6);
    if (open !== 's') side({ x: 0, y: D - dp, w: W, d: dp }, 'x', 'y+', D - dp + 0.6);
    if (open !== 'w') side({ x: 0, y: dp, w: dp, d: D - 2 * dp }, 'y', 'x-', dp - 0.6);
    if (open !== 'e') side({ x: W - dp, y: dp, w: dp, d: D - 2 * dp }, 'y', 'x+', W - dp + 0.6);
    return { boxes: out, grounds };
  },
};

/** An honorary arch: two piers, one vaulted opening read as a lintel, an attic for the statue. */
export const arch = {
  id: 'pp-arch', sheet: null, designed: false, patterns: ['arch'],
  read: 'A single-bay honorary arch of stuccoed tuff faced in marble, an attic on top.',
  notes: ['Placeholder: 9 m to the attic\'s top, opening 4 m.'],
  envelope: { w: [5, 9], d: [2, 4] },
  build({ W, D }, { palette: P }) {
    const o = Math.min(4, W * 0.5), p = (W - o) / 2;
    return [box('arch', 0, 0, p, D, 0, 6, P.marble), box('arch', W - p, 0, p, D, 0, 6, P.marble), box('arch', 0, 0, W, D, 6, 7.4, P.marble), box('attic', 0.2, 0.2, W - 0.4, D - 0.4, 7.4, 9, P.marble)];
  },
};

/** The gate's two passages across its width W (local x, front −y): the narrow one for walkers, then the wide one for carts. */
export function gatePassages(W) { const a = 2.5, b = 4.5, x1 = W * 0.2, x2 = x1 + a + (W - a - b - 2 * x1); return [[x1, x1 + a], [x2, x2 + b]]; }

/** A town gate: the wall thickened round two vaulted passages, a narrow one for walkers and a wide one for carts (Porta Marina). */
export const gate = {
  id: 'pp-gate', sheet: null, designed: false, patterns: ['towered-wall', 'arch'],
  read: 'A deep gate block in the wall, two barrel-vaulted passages side by side under round arches: a narrow one for walkers, a wide one for carts and animals.',
  notes: ['Passages 2.5 and 4.5 m (snippet, record: porta-marina); block 10 m high with a parapet.', 'The vaults as a stepped semicircle run through the block\'s depth (six steps a side): the arch read from outside, the tunnel inside.'],
  envelope: { w: [14, 22], d: [10, 20] },
  build({ W, D }, { palette: P }) {
    const [[x1, xa], [x2, xb]] = gatePassages(W), h = 10, out = [];
    out.push(box('gate', 0, 0, x1, D, 0, h, P.tufa), box('gate', xa, 0, x2 - xa, D, 0, h, P.tufa), box('gate', xb, 0, W - xb, D, 0, h, P.tufa));
    for (const [u0, u1, spring] of [[x1, xa, 2.6], [x2, xb, 3.4]]) {
      const r = (u1 - u0) / 2, crown = spring + r, n = 6;
      // the spandrels stepped round the arch's curve, each step as deep as the block: the barrel vault's read
      for (let k = 1; k <= n; k++) {
        const z0 = spring + (r * (k - 1)) / n, z1 = spring + (r * k) / n, hw = Math.sqrt(Math.max(0, r * r - (z1 - spring) ** 2)), fillW = r - hw;
        if (fillW > 0.01) out.push(box('gate', u0, 0, fillW, D, z0, z1, P.tufa), box('gate', u1 - fillW, 0, fillW, D, z0, z1, P.tufa));
      }
      out.push(box('gate', u0, 0, u1 - u0, D, crown, h, P.tufa));
      // the archivolt: a ring of paler stone round the front of the arch
      for (let k = 0; k <= 8; k++) { const t = (Math.PI * k) / 8, cx = (u0 + u1) / 2 + Math.cos(t) * (r + 0.2), cz = spring + Math.sin(t) * (r + 0.2); out.push(box('archivolt', cx - 0.28, -0.12, 0.56, 0.14, cz - 0.28, cz + 0.28, P.limestone)); }
    }
    // the parapet along the top, its merlons a low wall-walk's screen
    for (let x = 0; x < W - 0.5; x += 1.6) out.push(box('gate', x, 0, 0.9, 0.8, h, h + 0.9, P.tufa));
    return out;
  },
};

/** A street fountain: a basin of lava slabs and a pillar with its spout. */
export const fountain = {
  id: 'pp-fountain', sheet: null, designed: false, patterns: ['street-fountain'],
  read: 'A square basin of four lava slabs at a street corner, a squat pillar at one side with a carved spout.',
  notes: ['Placeholder: basin 1.6 m, 0.9 m high; pillar 1.4 m.'],
  envelope: { w: [1.5, 2.5], d: [1.5, 2.5] },
  build({ W, D }, { palette: P }) {
    return [box('basin', 0, 0, W, D, 0, 0.9, P.lava), box('water', 0.12, 0.12, W - 0.24, D - 0.24, 0.6, 0.78, P.water), box('pillar', W / 2 - 0.3, -0.25, 0.6, 0.4, 0, 1.4, P.lava)];
  },
};

// ── borrowed as they stand ──

/** Move built parts by (dx, dy): boxes, panels' corners, beams' ends. */
const shift = (bs, dx, dy) => bs.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy, ...(b.pts ? { pts: b.pts.map(([x, y, z]) => [x + dx, y + dy, z]) } : {}), ...(b.a ? { a: [b.a[0] + dx, b.a[1] + dy, b.a[2]], b: [b.b[0] + dx, b.b[1] + dy, b.b[2]] } : {}) }));
const tri = (kind, pts, out, tint) => { const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), zs = pts.map((q) => q[2]); return { kind, solid: 'panel', pts, out, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(0.01, Math.max(...xs) - Math.min(...xs)), d: Math.max(0.01, Math.max(...ys) - Math.min(...ys)), z0: Math.min(...zs), z1: Math.max(...zs), tint }; };
// the Lindos house's numbers its roofs are built on (./lindos.js house): range depth, eave height, the roof's rise to its
// outer edge, the eave's reach, a small house's gable pitch
const LN = { rd: 3.2, h: 4.2, rise: 0.8, eave: 0.25, gable: 16 };
/**
 * Close the borrowed house's roofs onto its walls: its ranges' roofs rise 0.8 m above the wall top to their outer edge,
 * and a small house's gable ends are open, so from the street the roofs float. A strip of wall along each outer edge
 * up under the roof, and a triangle in each open end.
 */
function closeRoofs(boxes, W, D) {
  const walls = boxes.filter((b) => b.kind === 'house'), tone = walls[0].tint, out = [], { rd, h, rise, eave: e } = LN;
  if (Math.min(W, D) < 9) {
    const hr = ((W >= D ? D : W) / 2 + e) * Math.tan((LN.gable * Math.PI) / 180);
    if (W >= D) for (const [x, n] of [[0, -1], [W, 1]]) out.push(tri('house', [[x, 0, h], [x, D, h], [x, D / 2, h + hr]], [n, 0, 0], tone));
    else for (const [y, n] of [[0, -1], [D, 1]]) out.push(tri('house', [[0, y, h], [W, y, h], [W / 2, y, h + hr]], [0, n, 0], tone));
    return out;
  }
  const hb = Math.max(...walls.map((b) => b.z1)), at = (z0, t) => z0 + rise * (1 - (t + e) / (rd + e));   // the roof's height t m in from the outer wall
  const strip = 0.3, top = (z0) => at(z0, strip) - 0.02;
  out.push(box('house', 0, 0, W, strip, h, top(h), tone), box('house', 0, D - strip, W, strip, hb, top(hb), tone));
  out.push(box('house', 0, rd, strip, D - 2 * rd, h, top(h), tone), box('house', W - strip, rd, strip, D - 2 * rd, h, top(h), tone));
  for (const [x, n] of [[0, -1], [W, 1]]) {
    out.push(tri('house', [[x, 0, h], [x, 0, at(h, 0)], [x, rd, h]], [n, 0, 0], tone), tri('house', [[x, D, hb], [x, D, at(hb, 0)], [x, D - rd, hb]], [n, 0, 0], tone));
  }
  // the side ranges' ends, where they meet the front and back ranges
  for (const [x0, x1] of [[0, rd], [W, W - rd]]) for (const [y, n] of [[rd, 1], [D - rd, -1]]) out.push(tri('house', [[x0, y, h], [x0, y, at(h, 0)], [x1, y, h]], [0, n, 0], tone));
  return out;
}
const flat = (kind, x, y, w, d, z, tint) => ({ kind, solid: 'panel', pts: [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], out: [0, 0, 1], x, y, w, d, z0: z, z1: z, tint });
// the house fronts' colours: most a warm cream stucco, some yellow, a few red (the street fronts' fields; record: painted-plaster)
const FRONTS = [['plaster', 0.6], ['yellow', 0.25], ['red', 0.15]];

/**
 * The atrium house's placeholder: the Lindos courtyard house — rooms round a court, the roofs falling inward,
 * which is the atrium's compluvium read — with the atrium's own things added: the impluvium, a marble-rimmed
 * pool under the roof's opening, and in some houses a black-and-white mosaic floor. Its front a cream, yellow
 * or red stucco.
 */
export const house = borrowed(lnHouse, 'pp-house', {
  patterns: ['atrium-house', 'courtyard-house', 'blank-wall', 'tile-roof', 'mosaic-floor'],
  read: 'Placeholder: rooms round an open court with roofs falling inward to it (the compluvium read), a pool in the court under the opening, plastered walls in cream, yellow or red on a dark socle, one door to the street.',
  notes: ['Borrowed from Lindos (ln-house) until pompeii-atrium-house.webp is read off: fauces, atrium with impluvium, tablinum, peristyle behind.', 'Less the Greek house\'s pastas (the three columns before its back range): an atrium has none, and they were half the town\'s faces.', 'Impluvium a third of the court each way, its rim 0.25 m; a mosaic floor in about two houses in five (`mosaic` slot overrides).'],
  build(args, ctx) {
    const P = ctx.palette, rng = ctx.rng, roll = rng(), field = FRONTS.find((f, i) => roll < FRONTS.slice(0, i + 1).reduce((a, q) => a + q[1], 0))[0];
    const out = lnHouse.build(args, { ...ctx, palette: { ...P, plaster: P[field], socle: field === 'red' ? P.black : P.socle } });   // a red field stands on a black socle
    const mosaic = args.slot.mosaic ?? rng() < 0.4, boxes = out.boxes.filter((b) => !PASTAS.has(b.kind)), grounds = [];
    boxes.push(...closeRoofs(boxes, args.W, args.D));
    for (const g of out.grounds) {
      if (g.kind !== 'court') { grounds.push(g); continue; }
      grounds.push(mosaic ? { ...g, surface: 'tessellatum', fill: P.mosaic } : g);
      const iw = g.w / 3, id = g.d / 3, ix = g.x + iw, iy = g.y + id;
      boxes.push(box('impluvium', ix, iy, iw, id, 0, 0.25, P.marble));
      grounds.push({ kind: 'water', x: ix + 0.15, y: iy + 0.15, w: iw - 0.3, d: id - 0.3, z: 0.26, fill: P.water });
    }
    return { boxes, grounds };
  },
});

/** A house with shops in its street front: the atrium house with open shop bays either side of its door, and the election notices painted on its front. */
export const shopHouse = {
  ...house, id: 'pp-shop-house', patterns: ['atrium-house', 'taberna', 'tile-roof', 'painted-notice'],
  read: 'Placeholder: the atrium house with its street rooms opened as shops: wide dark bays either side of the door, election notices painted at head height.',
  notes: ['Bays 2.8 m wide, 3.2 m high, one per 5 m of frontage (no Pompeian shopfront module in the record yet).', 'Its walls wear the `dipinti` skin: notices in red and black on whitewashed panels, 1.5–2.6 m up.', 'Next: pompeii-street.webp.'],
  build(args, ctx) {
    const out = house.build(args, ctx), { W } = args, P = ctx.palette, n = Math.max(1, Math.floor(W / 5));
    const bays = [];
    for (let i = 0; i < n; i++) { const x = (W * (i + 0.5)) / n - 1.4; if (Math.abs(x + 1.4 - W * 0.3) > 2.2) bays.push(box('shopfront', x, -0.09, 2.8, 0.06, 0, 3.2, P.shop)); }
    return { ...out, boxes: [...out.boxes, ...bays] };
  },
};

// ── art ──

/**
 * The Dancing Faun: a bronze satyr about 0.7 m tall, dancing with both arms raised, on a pedestal in the
 * impluvium of the House of the Faun's Tuscan atrium (record: dancing-faun). Built at (cx, cy) on the floor; its
 * pedestal is conjecture (Mau: found lying on the atrium floor, the pedestal not identified).
 */
export function dancingFaun(cx, cy, P) {
  const b = P.bronze, z = 0.75, h = 0.71;
  return [box('pedestal', cx - 0.3, cy - 0.3, 0.6, 0.6, 0, z, P.marble),
    drum('bronze', cx - 0.06, cy, 0.05, z, z + h * 0.45, b, { sides: 5 }), drum('bronze', cx + 0.07, cy + 0.02, 0.05, z, z + h * 0.42, b, { sides: 5 }),
    drum('bronze', cx, cy, 0.09, z + h * 0.42, z + h * 0.8, b, { sides: 6, taper: 1.2 }),
    { kind: 'bronze', solid: 'dome', sides: 6, x: cx - 0.06, y: cy - 0.06, w: 0.12, d: 0.12, z0: z + h * 0.8, z1: z + h * 0.95, tint: b },
    box('bronze', cx - 0.2, cy - 0.025, 0.05, 0.05, z + h * 0.72, z + h * 1.05, b), box('bronze', cx + 0.15, cy - 0.025, 0.05, 0.05, z + h * 0.74, z + h * 1.08, b)];
}

// the Alexander Mosaic as a big read: a 16 × 9 grid of its masses (border, the ochre ground, Alexander's horse at the
// left under the dead tree, Darius's chariot and horses at the right under a thicket of spears)
const ALEXANDER = [
  'kkkkkkkkkkkkkkkk',
  'kgdooooo/o/o/o/k',
  'kgdoobooo/o/o/ok',
  'kodobbwoobbrddok',
  'kobbbwboobbrrdok',
  'kobbbbooobbbddok',
  'kodobdooodbdbdok',
  'kooooooooooooook',
  'kkkkkkkkkkkkkkkk',
];
// its four colours (record: alexander-mosaic): white, yellow, red and blue-black, mixed for the browns
const ALEX_COL = { k: '#23242a', o: '#c9a86a', g: '#4a4c52', d: '#33302e', b: '#8a4a2c', w: '#e8e0cc', r: '#9b2f22', '/': '#23242a' };
/** The Alexander Mosaic laid flat at (x, y), 5.82 × 3.13 m (record: alexander-mosaic), its top edge toward −y. */
export function alexanderMosaic(x, y, z = 0.07) {
  const W = 5.82, D = 3.13, cw = W / 16, cd = D / 9, out = [];
  ALEXANDER.forEach((row, j) => [...row].forEach((ch, i) => out.push(flat('mosaic', x + i * cw, y + j * cd, cw + 0.01, cd + 0.01, z, ALEX_COL[ch]))));
  return out;
}

/**
 * The House of the Faun, the largest house in the town (about 3,000 m², record: house-of-the-faun): two atria on
 * the street, the first with the Dancing Faun in its impluvium; a first peristyle; the exedra between the two
 * peristyles with the Alexander Mosaic on its floor; the great second peristyle behind.
 */
export const faunHouse = {
  id: 'pp-faun-house', sheet: null, designed: false, patterns: ['atrium-house', 'peristyle', 'mosaic-floor', 'statue-base', 'tile-roof'],
  read: 'Placeholder: a great house on its street: two atria side by side, the bronze faun dancing in the first one\'s pool, a colonnaded garden behind, an open exedra with the Alexander Mosaic on its floor, a second, larger colonnaded garden at the back.',
  notes: ['The atria 35% of the depth, the first peristyle 25%, the exedra 6 m, the second peristyle the rest (proportions conjecture; the plan sheet will set them).', 'The exedra stands roofless here so the mosaic shows from the air.'],
  envelope: { w: [30, 40], d: [75, 95] },
  build({ W, D, slot }, ctx) {
    const P = ctx.palette, fd = Math.round(D * 0.35), p1 = Math.round(D * 0.25), ex = 6, out = [], grounds = [];
    const atrium = (x, w, faun) => {
      const a = house.build({ W: w, D: fd, slot: { mosaic: true } }, { ...ctx, rng: () => 0.1 });
      out.push(...shift(a.boxes, x, 0)); grounds.push(...shift(a.grounds, x, 0));
      const c = a.grounds.find((g) => g.kind === 'court');
      if (faun && c) out.push(...dancingFaun(x + c.x + c.w / 2, c.y + c.d / 2, P));
    };
    atrium(0, W * 0.56, true); atrium(W * 0.56, W * 0.44, false);
    // each garden open on its side toward the exedra (the exedra opens to them between columns)
    const peri = (y, d, open) => { const c = court.build({ W, D: d, slot: { open } }, ctx); out.push(...shift(c.boxes, 0, y)); grounds.push(...shift(c.grounds, 0, y)); };
    peri(fd, p1, 's');
    const ey = fd + p1;
    out.push(box('hall-wall', 0, ey, 2, ex, 0, 5, P.stucco), box('hall-wall', W - 2, ey, 2, ex, 0, 5, P.stucco));
    grounds.push({ kind: 'court', x: 2, y: ey, w: W - 4, d: ex, z: 0.05, fill: P.mosaic, surface: 'tessellatum' });
    out.push(...alexanderMosaic(W / 2 - 2.91, ey + (ex - 3.13) / 2));
    peri(ey + ex, D - ey - ex, 'n');
    return { boxes: out, grounds };
  },
};

/**
 * An equestrian statue on its base, or the base alone (`empty`): the forum's bases outnumber its statues, which
 * were not set back up after 62 (record: forum-square).
 */
export const equestrian = {
  id: 'pp-equestrian', sheet: null, designed: false, patterns: ['statue-base', 'colossus'],
  read: 'A tall stuccoed base; on it a bronze horseman, the horse walking, the rider\'s arm raised — or the base standing empty.',
  notes: ['Base 1.8 m high (conjecture); horse and rider about life size and a quarter.'],
  envelope: { w: [3, 4], d: [1.2, 1.8] },
  build({ W, D, slot }, { palette: P }) {
    const zb = 1.8, out = [box('base', 0, 0, W, D, 0, 0.3, P.tufa), box('base', 0.12, 0.12, W - 0.24, D - 0.24, 0.3, zb - 0.2, P.stucco), box('base', 0, 0, W, D, zb - 0.2, zb, P.tufa)];
    if (slot.empty) return out;
    const b = P.bronze, cx = W / 2, cy = D / 2, L = Math.min(2.6, W * 0.75);
    for (const [dx, dy] of [[-0.4, -0.25], [-0.4, 0.25], [0.4, -0.25], [0.4, 0.25]]) out.push(box('bronze', cx + dx * L - 0.06, cy + dy - 0.06, 0.12, 0.12, zb, zb + 1.05, b));
    out.push(box('bronze', cx - L / 2, cy - 0.32, L, 0.64, zb + 1.0, zb + 1.65, b));                       // the body
    out.push(box('bronze', cx + L / 2 - 0.15, cy - 0.16, 0.45, 0.32, zb + 1.5, zb + 2.25, b));             // the neck and head
    out.push(drum('bronze', cx - 0.05, cy, 0.22, zb + 1.65, zb + 2.5, b, { sides: 6, taper: 0.85 }));     // the rider
    out.push({ kind: 'bronze', solid: 'dome', sides: 6, x: cx - 0.16, y: cy - 0.16, w: 0.32, d: 0.32, z0: zb + 2.5, z1: zb + 2.85, tint: b });
    out.push(box('bronze', cx + 0.1, cy - 0.05, 0.1, 0.1, zb + 2.3, zb + 2.95, b));                        // the raised arm
    return out;
  },
};

/** An altar before a temple: a stone block on a step, its top burning with the sacrifice (`fire` slot). Roman sacrifice was burnt (record: burnt-sacrifice). */
export const altar = {
  id: 'pp-altar', sheet: null, designed: false, patterns: ['altar'],
  read: 'A rectangular stone altar on a low step, moulded at top and foot; a fire burning on it.',
  notes: ['Block 1.1 m high on a 0.25 m step (sizes conjecture; the Apollo altar is travertine faced with marble).', '`fire` (slot): a flame on its top; the fire channel takes it on the World page.'],
  envelope: { w: [1.6, 4], d: [1.2, 3] },
  build({ W, D, slot }, { palette: P }) {
    const out = [box('crepis', 0, 0, W, D, 0, 0.25, P.tufa), box('altar', 0.25, 0.25, W - 0.5, D - 0.5, 0.25, 1.35, P.limestone), box('altar', 0.15, 0.15, W - 0.3, D - 0.3, 1.35, 1.5, P.limestone)];
    if (slot.fire) out.push(...flame(W / 2, D / 2, 1.5, 0.9));
    return out;
  },
};

export const wall = borrowed(wallRun, 'pp-wall', { notes: ['Borrowed from Lindos (ln-wall): 7 m of ashlar. The Pompeii walls are 2–3 m thick, mostly relic by 79 (record: walls-quadratum).'] });
export const tower = borrowed(lnTower, 'pp-tower', { notes: ['Borrowed from Lindos (ln-tower). Count and places conjecture (record: wall-towers, disputed).'] });
export const theatre = borrowed(lnTheatre, 'pp-theatre', { notes: ['Borrowed from Lindos (ln-theatre). The Large Theatre: about 5,000 seats, its diameter not found (record: large-theatre).', 'Next: pompeii-theatre.webp — a Roman semicircle and a scaenae frons.'] });
export const statue = borrowed(statueBase, 'pp-statue', { notes: ['Borrowed from Lindos (ln-statue). The forum\'s statues were not re-erected after 62 (record: forum-square): few, on their bases.'] });

export const POMPEII_ASSETS = Object.fromEntries([podiumTemple, hall, portico, court, arch, gate, fountain, house, shopHouse, faunHouse, equestrian, altar, wall, tower, theatre, statue].map((a) => [a.id, a]));
