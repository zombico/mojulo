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
import { house as lnHouse, wallRun, tower as lnTower, theatre as lnTheatre, statueBase, gableRoof } from './lindos.js';
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
    if (S.roof) out.push(...gableRoof({ x: 0, y: 0, w: W, d: D }, h, KIT.roof.pitch, P, { axis: W >= D ? 'x' : 'y', pediments: false, eave: 0.6 }));
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

/** A town gate: the wall thickened round two vaulted passages, a narrow one for walkers and a wide one for carts (Porta Marina). */
export const gate = {
  id: 'pp-gate', sheet: null, designed: false, patterns: ['towered-wall', 'arch'],
  read: 'A deep gate block in the wall, two vaulted passages side by side: a narrow one for walkers, a wide one for carts and animals.',
  notes: ['Placeholder: passages 2.5 and 4.5 m (snippet, record: porta-marina); block 9 m high.'],
  envelope: { w: [14, 22], d: [10, 20] },
  build({ W, D }, { palette: P }) {
    const a = 2.5, b = 4.5, x1 = W * 0.2, x2 = x1 + a + (W - a - b - 2 * x1), h = 9, out = [];
    out.push(box('gate', 0, 0, x1, D, 0, h, P.tufa), box('gate', x1 + a, 0, x2 - x1 - a, D, 0, h, P.tufa), box('gate', x2 + b, 0, W - x2 - b, D, 0, h, P.tufa));
    out.push(box('gate', x1, 0, a, D, 3.4, h, P.tufa), box('gate', x2, 0, b, D, 4.6, h, P.tufa));
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

/** The atrium house's placeholder: the Lindos courtyard house — rooms round a court, the roofs falling inward, which is the atrium's compluvium read. */
export const house = borrowed(lnHouse, 'pp-house', {
  read: 'Placeholder: rooms round an open court with roofs falling inward to it (the compluvium read), plastered walls on a dark socle, one door to the street.',
  notes: ['Borrowed from Lindos (ln-house) until pompeii-atrium-house.webp is read off: fauces, atrium with impluvium, tablinum, peristyle behind.', 'Less the Greek house\'s pastas (the three columns before its back range): an atrium has none, and they were half the town\'s faces.'],
  build(args, ctx) { const out = lnHouse.build(args, ctx); return { ...out, boxes: out.boxes.filter((b) => !PASTAS.has(b.kind)) }; },
});

/** A house with shops in its street front: the Lindos house with open shop bays either side of its door. */
export const shopHouse = {
  ...house, id: 'pp-shop-house', patterns: ['courtyard-house', 'taberna', 'tile-roof'],
  read: 'Placeholder: the courtyard house with its street rooms opened as shops: wide dark bays either side of the door.',
  notes: ['Bays 2.8 m wide, 3.2 m high, one per 5 m of frontage (no Pompeian shopfront module in the record yet).', 'Next: pompeii-street.webp.'],
  build(args, ctx) {
    const out = house.build(args, ctx), { W } = args, P = ctx.palette, n = Math.max(1, Math.floor(W / 5));
    const bays = [];
    for (let i = 0; i < n; i++) { const x = (W * (i + 0.5)) / n - 1.4; if (Math.abs(x + 1.4 - W * 0.3) > 2.2) bays.push(box('shopfront', x, -0.09, 2.8, 0.06, 0, 3.2, P.shop)); }
    return { ...out, boxes: [...out.boxes, ...bays] };
  },
};

export const wall = borrowed(wallRun, 'pp-wall', { notes: ['Borrowed from Lindos (ln-wall): 7 m of ashlar. The Pompeii walls are 2–3 m thick, mostly relic by 79 (record: walls-quadratum).'] });
export const tower = borrowed(lnTower, 'pp-tower', { notes: ['Borrowed from Lindos (ln-tower). Count and places conjecture (record: wall-towers, disputed).'] });
export const theatre = borrowed(lnTheatre, 'pp-theatre', { notes: ['Borrowed from Lindos (ln-theatre). The Large Theatre: about 5,000 seats, its diameter not found (record: large-theatre).', 'Next: pompeii-theatre.webp — a Roman semicircle and a scaenae frons.'] });
export const statue = borrowed(statueBase, 'pp-statue', { notes: ['Borrowed from Lindos (ln-statue). The forum\'s statues were not re-erected after 62 (record: forum-square): few, on their bases.'] });

export const POMPEII_ASSETS = Object.fromEntries([podiumTemple, hall, portico, court, arch, gate, fountain, house, shopHouse, wall, tower, theatre, statue].map((a) => [a.id, a]));
