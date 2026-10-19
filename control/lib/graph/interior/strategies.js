/**
 * interior/strategies — the functional solver graph's table: per function, its strategies in order. The shape is the
 * fabricator's (fabricator/index.js STRATEGIES), in the room's terms:
 *
 *   { id, fn, line, needs?, when?, unless?, uses, lay, suggest?, covers? }
 *
 *   needs     what the room must measure to (interior/solve.js capabilitiesOf): { span: ['s','m','l'], … }
 *   when      tags the brief must carry; `unless` tags that refuse it
 *   uses      the pieces it stands (interior/pieces.js), each under a stable id: the group's name and the piece's
 *   lay       (ctx) → places the pieces in the room, or throws Refuse(why) when the room does not take them; a strategy
 *             that refuses leaves the room as it found it, and the next one is tried
 *   suggest   functions it implies (a conversation group implies a rug under it and a reading light)
 *   covers    functions it already does (a reading chair in the group covers `read`)
 *
 * A strategy is a row; a new arrangement is a new row, not new code in the solver. The `lay` functions share the moves
 * in interior/place.js and read every distance from interior/laws.js.
 */
import { law } from './laws.js';
import { RUG_SIZES } from './pieces.js';
import { wallFrame, footprint, whyNot, put, onWall, solidSpans, rectInFrame, wayWhy, EDGES, OPPOSITE } from './place.js';

export class Refuse extends Error {}
const refuse = (why) => { throw new Refuse(why); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r10 = (v) => Math.round(v / 10) * 10;
// a plan point's place along a wall, in that wall's u
const uOf = (R, edge, x, y) => ({ N: x, E: y, S: R.W - x, W: R.D - y }[edge]);

// ── shared moves ────────────────────────────────────────────────────────────────────────────────────────────────

/** Stand one piece where `spec` says, or refuse. spec: { id, piece, x, y, w, d, h, facing, mount? }; `ignore` names placed
 * pieces it may overlap (a chair tucked under its table). */
function stand(ctx, spec, { optional = false, ignore = [] } = {}) {
  const rect = footprint(spec.x, spec.y, spec.w, spec.d, spec.facing);
  const why = whyNot(ctx.R, rect, { h: spec.h, skin: spec.mount === 'skin', ignore });
  if (why) {
    if (optional) { ctx.note(`${spec.id}: left out — ${why}`); return null; }
    refuse(`${spec.id}: ${why}`);
  }
  const placed = put(ctx.R, { mount: 'floor', ...spec });
  // an optional piece never closes a way the room had (a required one is judged with its whole group, in the solver)
  if (optional && spec.mount !== 'skin') {
    const way = wayWhy(ctx.R);
    if (way && !ctx.wayWas) { ctx.R.placed.pop(); ctx.note(`${spec.id}: left out — ${way}`); return null; }
  }
  return placed;
}

/** The smallest standard rug (either way round) that covers `need` (w × d mm) and keeps the wall margin, else one cut
 *  to fit. → [w, d] in the plan's x and y. */
function rugSize(R, needX, needY) {
  const margin = law('rug-wall-margin').min;
  const maxX = R.W - 2 * margin, maxY = R.D - 2 * margin;
  const fits = [];
  for (const [a, b] of RUG_SIZES) for (const [x, y] of [[a, b], [b, a]]) if (x >= needX && y >= needY && x <= maxX && y <= maxY) fits.push([x, y]);
  fits.sort((p, q) => p[0] * p[1] - q[0] * q[1]);
  if (fits.length) return fits[0];
  return [r10(Math.min(maxX, needX)), r10(Math.min(maxY, needY))];
}

/** A rug under a group: the coffee table (or the bed) whole, and the front of every seat on it. */
function rugUnder(ctx, id, { whole = [], fronts = [], past = 0 }) {
  const strip = law('rug-front-legs').target;
  const rects = whole.map((p) => p.rect);
  for (const p of fronts) {
    const r = p.rect;
    rects.push(p.facing === 'N' ? { ...r, y1: r.y0 + strip } : p.facing === 'S' ? { ...r, y0: r.y1 - strip } : p.facing === 'E' ? { ...r, x0: r.x1 - strip } : { ...r, x1: r.x0 + strip });
  }
  if (!rects.length) return null;
  const b = rects.reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), x1: Math.max(a.x1, r.x1), y0: Math.min(a.y0, r.y0), y1: Math.max(a.y1, r.y1) }));
  const [rw, rd] = rugSize(ctx.R, b.x1 - b.x0 + 2 * past, b.y1 - b.y0 + 2 * past);
  const margin = law('rug-wall-margin').min;
  const x = clamp((b.x0 + b.x1) / 2, margin + rw / 2, ctx.R.W - margin - rw / 2);
  const y = clamp((b.y0 + b.y1) / 2, margin + rw * 0 + rd / 2, ctx.R.D - margin - rd / 2);
  // a rug's w runs along x (it faces N), whichever way it was cut
  return stand(ctx, { id, piece: 'rug', fn: 'anchor', x, y, w: rw, d: rd, h: 12, facing: 'N', mount: 'skin' }, { optional: true });
}

/** A floor lamp at a seat's shoulder: beside its back half, nearer the back first, then a step further out. */
function lampBeside(ctx, seat, id, { fn = 'light-task' } = {}) {
  const [w, d, h] = ctx.size('floor-lamp', id);
  const r = seat.rect, g = 120;
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  // the seat's own axes: `fw` toward its front, `sd` to one side; its width and depth along them
  const fw = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[seat.facing];
  const sd = [-fw[1], fw[0]];
  const across = seat.facing === 'N' || seat.facing === 'S';
  const sw = across ? r.x1 - r.x0 : r.y1 - r.y0, sdp = across ? r.y1 - r.y0 : r.x1 - r.x0;
  for (const back of [-sdp / 2 + d / 2 + 60, 0, sdp / 2 - d / 2]) {
    for (const out of [sw / 2 + g + w / 2, sw / 2 + g + w / 2 + 560]) {
      for (const side of [1, -1]) {
        const x = cx + sd[0] * side * out + fw[0] * back, y = cy + sd[1] * side * out + fw[1] * back;
        if (whyNot(ctx.R, footprint(x, y, w, d, seat.facing), { h })) continue;
        const lamp = put(ctx.R, { id, piece: 'floor-lamp', fn, x, y, w, d, h, facing: seat.facing, mount: 'floor' });
        if (!wayWhy(ctx.R) || ctx.wayWas) return lamp;
        ctx.R.placed.pop();
      }
    }
  }
  ctx.note(`${id}: left out — no room at the shoulder of ${seat.id}`);
  return null;
}

/** A side table at a seat's arm, front-aligned with it. */
function tableBeside(ctx, seat, id, { prefer = 1, fn = 'converse' } = {}) {
  const [w, d, h] = ctx.size('side-table', id);
  const r = seat.rect, g = 80;
  const across = seat.facing === 'N' || seat.facing === 'S';
  for (const s of [prefer, -prefer]) {
    const x = across ? (s > 0 ? r.x1 + g + w / 2 : r.x0 - g - w / 2) : (r.x0 + r.x1) / 2;
    const y = across ? (r.y0 + r.y1) / 2 : (s > 0 ? r.y1 + g + w / 2 : r.y0 - g - w / 2);
    const spec = { id, piece: 'side-table', fn, x, y, w, d, h, facing: seat.facing };
    if (whyNot(ctx.R, footprint(x, y, w, d, seat.facing), { h })) continue;
    const t = put(ctx.R, { mount: 'floor', ...spec });
    if (!wayWhy(ctx.R) || ctx.wayWas) return t;
    ctx.R.placed.pop();
  }
  ctx.note(`${id}: left out — no room at either arm of ${seat.id}`);
  return null;
}

// ── the conversation group, laid in the focal wall's frame ──────────────────────────────────────────────────────

function layConversation(ctx, { sofa = 'sofa', chairs = 2, across = false, coffee = true }) {
  const { R, focal } = ctx;
  const F = wallFrame(R, focal.edge), u0 = focal.u;
  const media = ctx.find('media.console');
  const base = media ? media.d + 450 : (focal.depth || 0) + 300;                // what stands at the focal wall, and a step past it
  let [sw, sd, sh] = ctx.size(sofa, 'conversation.sofa');
  sw = Math.min(sw, F.len - 2 * 450);
  if (sw < ctx.band(sofa)[0]) refuse(`the ${focal.edge} wall is too short to face a ${sofa} to it`);
  // the group's axis: on the focal point, kept far enough from the side walls that the sofa stands clear of them
  const u0c = clamp(u0, sw / 2 + 50, F.len - sw / 2 - 50);
  const gap = law('coffee-gap').target;
  const cw = coffee ? clamp(r10(sw * law('coffee-length').ratio), ...ctx.band('coffee-table')) : 0;
  const [ccw, ccd, cch] = coffee ? ctx.size('coffee-table', 'conversation.coffee-table', { w: cw, d: clamp(r10(cw * 0.5), 450, 760) }) : [0, 0, 0];
  // where the sofa's front stands off the focal wall: at the screen's viewing distance, else about the room's middle
  let front = media ? Math.max(law('tv-distance').ratio * ctx.tvDiagonal - 400, base + ccd + gap) : clamp(F.depth * 0.5, base + ccd + gap, 3000);
  let back = front + sd;
  // floated only with a real path behind it; otherwise its back goes to the wall
  if (F.depth - back < law('secondary-path').target) { back = F.depth; front = back - sd; }
  if (front - (coffee ? ccd + gap : 0) < base) refuse(`the room is ${Math.round(F.depth)} mm off the ${focal.edge} wall: too shallow for the ${sofa}${coffee ? ', a coffee table and a step' : ''} facing it`);
  const [sx, sy] = F.at(u0c, front + sd / 2);
  const so = stand(ctx, { id: 'conversation.sofa', piece: sofa, fn: 'converse', x: sx, y: sy, w: sw, d: sd, h: sh, facing: F.toWall });
  // a sofa backed to a wall takes a picture over it: two thirds its width, its bottom a hand above the back
  if (back === F.depth) {
    const opp = OPPOSITE[focal.edge], aw = r10(sw * law('art-width').ratio), ah = r10(Math.min(1000, aw * 0.7));
    ctx.wall({ id: 'conversation.art', piece: 'art', fn: 'display', edge: opp, u: uOf(R, opp, sx, sy), w: aw, h: ah, centre: Math.max(sh + law('art-gap').target + ah / 2, law('art-centre').target) });
  }
  let table = null;
  if (coffee) {
    const vc = front - gap - ccd / 2;
    const [tx, ty] = F.at(u0c, vc);
    table = stand(ctx, { id: 'conversation.coffee-table', piece: 'coffee-table', fn: 'converse', x: tx, y: ty, w: ccw, d: ccd, h: cch, facing: F.toWall });
  }
  const seats = [so];
  const [aw, ad, ah] = ctx.size('lounge-chair', 'conversation.chair-1');
  const cgap = law('chair-gap').target;
  const vc = table ? front - gap - ccd / 2 : front - 900;
  const ends = [
    { id: 'conversation.chair-1', u: u0c - (ccw || sw * 0.5) / 2 - cgap - ad / 2, facing: F.plusU },
    { id: 'conversation.chair-2', u: u0c + (ccw || sw * 0.5) / 2 + cgap + ad / 2, facing: F.minusU },
  ];
  const facingSofa = [
    { id: 'conversation.chair-1', u: u0c - aw / 2 - 100, facing: F.into },
    { id: 'conversation.chair-2', u: u0c + aw / 2 + 100, facing: F.into },
  ];
  const spots = across ? facingSofa : ends;
  const vAt = across ? (table ? vc - ccd / 2 - gap - ad / 2 : front - 1800) : vc;
  // each chair tries its end, then a little toward the focal point or away; a one-chair group takes whichever end fits
  let n = 0;
  for (const s of spots) {
    if (n >= chairs) break;
    let c = null;
    for (const dv of [0, -250, 250]) {
      const [x, y] = F.at(s.u, vAt + dv);
      if (whyNot(R, footprint(x, y, aw, ad, s.facing), { h: ah })) continue;
      c = put(R, { id: `conversation.chair-${n + 1}`, piece: 'lounge-chair', fn: 'converse', x, y, w: aw, d: ad, h: ah, facing: s.facing, mount: 'floor' });
      if (!wayWhy(R) || ctx.wayWas) break;
      R.placed.pop(); c = null;
    }
    if (c) { seats.push(c); n += 1; } else ctx.note(`conversation: no chair at the ${s.u < u0c ? 'left' : 'right'} end of the group`);
  }
  if (seats.length - 1 < Math.min(chairs, 1) && chairs > 0) refuse('no chair could join the sofa');
  if (!table) seats.forEach((s, i) => tableBeside(ctx, s, `conversation.side-table-${i + 1}`));
  if (ctx.wants('anchor')) rugUnder(ctx, 'conversation.rug', { whole: table ? [table] : [], fronts: seats });
  if (ctx.wants('light-task')) lampBeside(ctx, so, 'conversation.lamp');
  return seats;
}

// ── the strategies ──────────────────────────────────────────────────────────────────────────────────────────────

export const STRATEGIES = [
  // media: the screen on the focal wall over a low console
  {
    id: 'console-and-screen', fn: 'media', line: 'a low console on the focal wall, the screen over it at a seated eye',
    unless: ['no-tv'], uses: ['media-console', 'tv'],
    lay: (ctx) => {
      const F = wallFrame(ctx.R, ctx.focal.edge);
      const [w, d, h] = ctx.size('media-console', 'media.console', { w: Math.min(ctx.size('media-console', 'media.console')[0], F.len - 600) });
      const at = onWall(ctx.R, ctx.focal.edge, { w, d, h }, { target: ctx.focal.u });
      if (at.why) refuse(`media.console: ${at.why}`);
      ctx.focal.u = at.u;   // the group centres on the screen
      stand(ctx, { id: 'media.console', piece: 'media-console', fn: 'media', x: at.x, y: at.y, w, d, h, facing: at.facing });
      ctx.wall({ id: 'media.tv', piece: 'tv', fn: 'media', edge: ctx.focal.edge, u: at.u, w: ctx.tvWidth, h: ctx.tvWidth * 9 / 16, centre: law('tv-centre').target });
    },
  },
  // converse: the group facing the focal point
  {
    id: 'sofa-and-pair', fn: 'converse', line: 'a sofa facing the focal point, a chair at each end of the coffee table, a rug under the fronts of all',
    needs: { span: ['m', 'l'] }, unless: ['compact'], uses: ['sofa', 'coffee-table', 'lounge-chair', 'lounge-chair'],
    suggest: ['anchor', 'light-task'],
    lay: (ctx) => layConversation(ctx, { chairs: 2 }),
  },
  {
    id: 'sofa-facing-pair', fn: 'converse', line: 'a sofa and two chairs facing each other across the coffee table, the focal point to one side',
    needs: { span: ['m', 'l'] }, unless: ['compact'], when: ['no-tv'], uses: ['sofa', 'coffee-table', 'lounge-chair', 'lounge-chair'],
    suggest: ['anchor', 'light-task'],
    lay: (ctx) => layConversation(ctx, { chairs: 2, across: true }),
  },
  {
    id: 'sofa-and-chair', fn: 'converse', line: 'a sofa and one chair at the end of the coffee table',
    needs: { span: ['s', 'm', 'l'] }, uses: ['sofa', 'coffee-table', 'lounge-chair'],
    suggest: ['anchor', 'light-task'],
    lay: (ctx) => layConversation(ctx, { chairs: 1 }),
  },
  {
    id: 'loveseat-and-sides', fn: 'converse', line: 'a loveseat facing the focal point with a side table at its arm',
    uses: ['loveseat', 'side-table'],
    suggest: ['light-task'],
    lay: (ctx) => layConversation(ctx, { sofa: 'loveseat', chairs: 0, coffee: false }),
  },
  // read: a chair, its lamp and a table, by the light
  {
    id: 'reading-corner', fn: 'read', line: 'a lounge chair in a corner by a window, a lamp at its shoulder, a table at its arm',
    uses: ['lounge-chair', 'floor-lamp', 'side-table'], covers: ['light-task'],
    lay: (ctx) => {
      if (ctx.find('conversation.chair-1') && ctx.find('conversation.chair-2') && ctx.R.W * ctx.R.D < 22e6) refuse('the conversation group already seats a reader in a room this size');
      const [w, d, h] = ctx.size('lounge-chair', 'reading.chair');
      const walls = [...EDGES].sort((a, b) => ctx.daylight(b) - ctx.daylight(a));
      for (const edge of walls) {
        const F = wallFrame(ctx.R, edge);
        for (const t of [w / 2 + 500, F.len - w / 2 - 500]) {
          const at = onWall(ctx.R, edge, { w, d, h }, { target: t, gap: 150, step: 100 });
          if (at.why || Math.abs(at.u - t) > 900) continue;
          const chair = put(ctx.R, { id: 'reading.chair', piece: 'lounge-chair', fn: 'read', x: at.x, y: at.y, w, d, h, facing: at.facing, mount: 'floor' });
          lampBeside(ctx, chair, 'reading.lamp', { fn: 'read' });
          tableBeside(ctx, chair, 'reading.side-table', { fn: 'read' });
          return;
        }
      }
      refuse('no corner takes a chair and its lamp');
    },
  },
  // display: shelves on the longest bare wall
  {
    id: 'bookcase-pair', fn: 'display', line: 'two bookcases on the longest bare wall, the gap between them kept',
    needs: { span: ['l'] }, uses: ['bookcase', 'bookcase'],
    lay: (ctx) => layShelves(ctx, 2),
  },
  {
    id: 'bookcase', fn: 'display', line: 'a bookcase on the longest bare wall',
    uses: ['bookcase'],
    lay: (ctx) => layShelves(ctx, 1),
  },
  // sleep: the bed on the wall it is best against
  {
    id: 'bed-and-pair', fn: 'sleep', line: 'the bed’s head to a solid wall away from the door, a nightstand each side, a rug under its lower two thirds',
    uses: ['bed', 'nightstand', 'nightstand'], suggest: ['anchor'],
    lay: (ctx) => layBed(ctx, { pair: true }),
  },
  {
    id: 'bed-and-one', fn: 'sleep', line: 'the bed against a wall with one nightstand at the open side',
    uses: ['bed', 'nightstand'], suggest: ['anchor'],
    lay: (ctx) => layBed(ctx, { pair: false }),
  },
  // dress: drawers on a wall with room to stand before them
  {
    id: 'dresser', fn: 'dress', line: 'a chest of drawers on a bare wall, a step clear before it',
    uses: ['dresser'],
    lay: (ctx) => {
      const [w, d, h] = ctx.size('dresser', 'dressing.dresser');
      layOnBestWall(ctx, { id: 'dressing.dresser', piece: 'dresser', fn: 'dress', w, d, h, front: law('dresser-front').target });
    },
  },
  // dine: the table in the room's middle, its chairs round it
  {
    id: 'table-and-chairs', fn: 'dine', line: 'the table centred, a chair every 610 mm of its edge, 915 mm behind each to pull it out',
    uses: ['dining-table', 'dining-chair'], suggest: ['anchor'],
    lay: (ctx) => layDining(ctx),
  },
  // store: a sideboard along a bare wall
  {
    id: 'sideboard', fn: 'store', line: 'a sideboard on the longest bare wall',
    uses: ['sideboard'],
    lay: (ctx) => {
      const [w, d, h] = ctx.size('sideboard', 'storage.sideboard');
      layOnBestWall(ctx, { id: 'storage.sideboard', piece: 'sideboard', fn: 'store', w, d, h, front: law('walkway').min });
    },
  },
  // work: a desk on a wall, its chair before it
  {
    id: 'desk-to-window', fn: 'work', line: 'the desk side-on to a window, the light over the shoulder, its chair before it',
    uses: ['desk', 'desk-chair'],
    lay: (ctx) => layDesk(ctx),
  },
  // drop: a bench by the door
  {
    id: 'bench', fn: 'drop', line: 'a bench on the wall nearest the door, to sit and set things down',
    uses: ['bench'],
    lay: (ctx) => {
      const [w, d, h] = ctx.size('bench', 'drop.bench');
      layOnBestWall(ctx, { id: 'drop.bench', piece: 'bench', fn: 'drop', w, d, h, front: law('walkway').min });
    },
  },
  // light-task and anchor stand alone only when no group laid them
  {
    id: 'lamp-by-seat', fn: 'light-task', line: 'a floor lamp at the shoulder of the main seat',
    uses: ['floor-lamp'],
    lay: (ctx) => {
      if (ctx.find('conversation.lamp') || ctx.find('reading.lamp')) return;
      const seat = ctx.find('conversation.sofa') || ctx.find('reading.chair') || ctx.find('sleep.bed');
      if (!seat) refuse('no seat to light');
      lampBeside(ctx, seat, 'task.lamp');
    },
  },
  {
    id: 'rug-under-group', fn: 'anchor', line: 'a rug under the room’s main group',
    uses: ['rug'],
    lay: (ctx) => {
      if (ctx.R.placed.some((p) => p.piece === 'rug')) return;
      const table = ctx.find('conversation.coffee-table') || ctx.find('dining.table');
      if (!table) refuse('no group to anchor');
      rugUnder(ctx, 'anchor.rug', { whole: [table] });
    },
  },
];

// ── the lays the strategies share ───────────────────────────────────────────────────────────────────────────────

/** The walls best for a piece that stands against one: the longest solid stretch first, the focal wall last. */
function wallsByBareness(ctx) {
  return [...EDGES].map((e) => ({ e, s: solidSpans(ctx.R, e)[0]?.len || 0 }))
    .sort((a, b) => (a.e === ctx.focal?.edge) - (b.e === ctx.focal?.edge) || b.s - a.s).map((x) => x.e);
}

function layOnBestWall(ctx, { id, piece, fn, w, d, h, front = 0 }) {
  let last = null;
  for (const edge of wallsByBareness(ctx)) {
    const span = solidSpans(ctx.R, edge)[0];
    if (!span || span.len < w) continue;
    const at = onWall(ctx.R, edge, { w, d, h }, { target: (span.u0 + span.u1) / 2 });
    if (at.why) { last = at.why; continue; }
    // the step before it must be clear too
    const F = wallFrame(ctx.R, edge);
    const before = rectInFrame(F, at.u - w / 2, at.u + w / 2, d, d + front);
    if (front && whyNot(ctx.R, before, { h: 1 })) { last = `nothing clear before it on the ${edge} wall`; continue; }
    return put(ctx.R, { id, piece, fn, x: at.x, y: at.y, w, d, h, facing: at.facing, mount: 'floor' });
  }
  refuse(`${id}: no bare wall takes it${last ? ` (${last})` : ''}`);
}

function layShelves(ctx, n) {
  const [w, d, h] = ctx.size('bookcase', 'display.bookcase-1');
  for (const edge of wallsByBareness(ctx)) {
    const span = solidSpans(ctx.R, edge)[0];
    if (!span || span.len < n * w + (n - 1) * 200) continue;
    const mid = (span.u0 + span.u1) / 2;
    const us = n === 1 ? [mid] : [mid - w / 2 - 300, mid + w / 2 + 300];
    const mark = ctx.R.placed.length;
    const got = [];
    for (let i = 0; i < n; i += 1) {
      const at = onWall(ctx.R, edge, { w, d, h }, { target: us[i], step: 50 });
      if (at.why || Math.abs(at.u - us[i]) > 600) break;
      got.push(put(ctx.R, { id: `display.bookcase-${i + 1}`, piece: 'bookcase', fn: 'display', x: at.x, y: at.y, w, d, h, facing: at.facing, mount: 'floor' }));
    }
    if (got.length === n) return;
    ctx.R.placed.length = mark;
  }
  refuse(`no bare wall takes ${n === 1 ? 'a bookcase' : `${n} bookcases`}`);
}

function layBed(ctx, { pair }) {
  const [bw, bl, bh] = ctx.size('bed', 'sleep.bed');
  const [nw, nd, nh] = ctx.size('nightstand', 'sleep.nightstand-1');
  const need = bw + (pair ? 2 : 1) * (nw + 60);
  const doorWalls = new Set(ctx.R.openings.filter((o) => o.kind === 'door').map((o) => o.wall));
  // the head wall: long enough, not the door's, opposite the door first (the command position), a window's last; a bed
  // and its nightstands are lower than a sill, so a wall under a window still takes them (the placer's window keep)
  const ranked = [...EDGES].map((e) => {
    const len = wallFrame(ctx.R, e).len;
    const score = (len >= need ? 4 : 0) + (doorWalls.has(e) ? 0 : 2) + ([...doorWalls].some((d) => OPPOSITE[d] === e) ? 1 : 0) + (ctx.daylight(e) ? 0 : 0.5);
    return { e, span: { u0: 0, u1: len, len }, score };
  }).sort((a, b) => b.score - a.score);
  let last = null;
  for (const { e, span } of ranked) {
    if (!span || span.len < need) continue;
    const mark = ctx.R.placed.length;
    try {
      const at = onWall(ctx.R, e, { w: bw, d: bl, h: bh }, { target: (span.u0 + span.u1) / 2 });
      if (at.why) refuse(at.why);
      const bed = stand(ctx, { id: 'sleep.bed', piece: 'bed', fn: 'sleep', x: at.x, y: at.y, w: bw, d: bl, h: bh, facing: at.facing });
      const F = wallFrame(ctx.R, e);
      const sides = pair ? [-1, 1] : [1, -1];
      let placedOne = false;
      sides.forEach((s, i) => {
        if (!pair && placedOne) return;
        const [x, y] = F.at(at.u + s * (bw / 2 + 60 + nw / 2), nd / 2);
        const ns = stand(ctx, { id: `sleep.nightstand-${i + 1}`, piece: 'nightstand', fn: 'sleep', x, y, w: nw, d: nd, h: nh, facing: F.into }, { optional: !pair || i > 0 });
        if (ns) placedOne = true;
      });
      // a path down each side of the bed, and across its foot
      const side = law('bed-side').min;
      for (const s of [-1, 1]) {
        const lane = rectInFrame(F, at.u + s * (bw / 2) + (s < 0 ? -side : 0), at.u + s * (bw / 2) + (s > 0 ? side : 0), nd + 50, bl);
        const why = whyNot(ctx.R, lane, { h: 1, ignore: [] });
        if (why && !/approach|window/.test(why)) ctx.note(`sleep.bed: the path down its ${s < 0 ? 'left' : 'right'} side is narrow (${why})`);
      }
      if (ctx.wants('anchor')) {
        const [rx, ry] = F.at(at.u, bl * 0.33 + (bl * 0.67 + 600) / 2);
        const pastSide = law('rug-bed-side').target;
        const rw = bw + 2 * pastSide, rl = bl * 0.67 + 600;
        const ns = e === 'N' || e === 'S';
        const [sx, sy] = rugSize(ctx.R, ns ? rw : rl, ns ? rl : rw);
        stand(ctx, { id: 'sleep.rug', piece: 'rug', fn: 'anchor', x: clamp(rx, sx / 2 + 200, ctx.R.W - sx / 2 - 200), y: clamp(ry, sy / 2 + 200, ctx.R.D - sy / 2 - 200), w: sx, d: sy, h: 12, facing: 'N', mount: 'skin' }, { optional: true });
      }
      ctx.focal = ctx.focal || { edge: e, u: at.u };
      return;
    } catch (err) {
      if (!(err instanceof Refuse)) throw err;
      ctx.R.placed.length = mark; last = err.message;
    }
  }
  refuse(`no wall takes the bed and ${pair ? 'a nightstand each side' : 'a nightstand'}${last ? ` (${last})` : ''}`);
}

function layDining(ctx) {
  const R = ctx.R;
  const per = law('dining-per-diner').target, pull = law('dining-pullout').target;
  const [cw, cd, ch] = ctx.size('dining-chair', 'dining.chair-1');
  const long = R.W >= R.D;
  const room = long ? [R.W, R.D] : [R.D, R.W];
  // the longest table the room takes with a chair pulled out on every side
  const maxLen = room[0] - 2 * pull, maxWid = room[1] - 2 * pull;
  let [tw, td, th] = ctx.size('dining-table', 'dining.table');
  const seats = ctx.seats || 6;
  const want = Math.max(900, Math.ceil(seats / 2) * per + 300);
  tw = Math.min(Math.max(tw, want), maxLen, ctx.band('dining-table')[1]);
  td = Math.min(td, maxWid);
  if (tw < 900 || td < 750) refuse(`the room leaves ${Math.round(maxLen)} × ${Math.round(maxWid)} mm for a table with 915 mm to pull a chair out all round`);
  const x = R.W / 2, y = R.D / 2, facing = long ? 'N' : 'E';
  const table = stand(ctx, { id: 'dining.table', piece: 'dining-table', fn: 'dine', x, y, w: tw, d: td, h: th, facing });
  const n = Math.max(1, Math.floor((tw - 200) / per));
  let k = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i += 1) {
      const along = -tw / 2 + 100 + (i + 0.5) * ((tw - 200) / n);   // evenly along the edge, clear of the legs
      const off = td / 2 + cd / 2 - 120;   // tucked a little under the table's edge
      const [cx, cy] = long ? [x + along, y + side * off] : [x + side * off, y + along];
      const f = long ? (side < 0 ? 'S' : 'N') : (side < 0 ? 'E' : 'W');
      k += 1;
      // a chair tucks under its own table, so the table is not in its way
      stand(ctx, { id: `dining.chair-${k}`, piece: 'dining-chair', fn: 'dine', x: cx, y: cy, w: cw, d: cd, h: ch, facing: f }, { optional: true, ignore: ['dining.table'] });
    }
  }
  if (ctx.wants('anchor')) {
    const past = law('rug-dining-past').target;
    const [rx, ry] = rugSize(R, (long ? tw : td) + 2 * past, (long ? td : tw) + 2 * past);
    stand(ctx, { id: 'dining.rug', piece: 'rug', fn: 'anchor', x, y, w: rx, d: ry, h: 12, facing: 'N', mount: 'skin' }, { optional: true });
  }
  ctx.focal = ctx.focal || { edge: long ? 'N' : 'W', u: long ? x : R.D - y };
  return table;
}

function layDesk(ctx) {
  const [w, d, h] = ctx.size('desk', 'work.desk');
  const [cw, cd, ch] = ctx.size('desk-chair', 'work.chair');
  // side-on to the window: on a wall beside the window wall, near the window's end
  const lit = [...EDGES].filter((e) => ctx.daylight(e));
  const walls = [...EDGES].sort((a, b) => (lit.includes(b) ? 0 : 1) - (lit.includes(a) ? 0 : 1));
  for (const edge of walls) {
    const span = solidSpans(ctx.R, edge)[0];
    if (!span || span.len < w) continue;
    const at = onWall(ctx.R, edge, { w, d, h }, { target: (span.u0 + span.u1) / 2 });
    if (at.why) continue;
    const F = wallFrame(ctx.R, edge);
    const [cx, cy] = F.at(at.u, d + cd / 2 - 150);
    if (whyNot(ctx.R, footprint(cx, cy, cw, cd, F.toWall), { h: ch })) continue;
    put(ctx.R, { id: 'work.desk', piece: 'desk', fn: 'work', x: at.x, y: at.y, w, d, h, facing: at.facing, mount: 'floor' });
    put(ctx.R, { id: 'work.chair', piece: 'desk-chair', fn: 'work', x: cx, y: cy, w: cw, d: cd, h: ch, facing: F.toWall, mount: 'floor' });
    return;
  }
  refuse('no wall takes a desk with its chair pulled out');
}

/** The table's strategies for one function, in order. */
export const strategiesFor = (fn) => STRATEGIES.filter((s) => s.fn === fn);

export { rugSize };
