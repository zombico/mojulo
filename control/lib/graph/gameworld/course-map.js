/**
 * THE COURSE MAP — the diagram a game design book draws a running game's course with (roll-course.js), and no other
 * kind of game: the course seen from straight above and turned on its side, so it runs from LEFT to RIGHT as a line of
 * text does. Many segments are read one after another, a row at a time, and the whole course is seen without running
 * it. It is also where the assets a course is dressed with are placed from: each segment's ask, its tell, and the two
 * flanks beside it are cells of this map.
 *
 * READING IT
 *   along      left to right is the way the hero runs; a ruler under each row says metres and, at the hero's top
 *              speed, seconds. A row holds a few segments; rows follow one another downward.
 *   across     up the page is the hero's LEFT. The way is the band in the middle. Its lanes are drawn as faint guides:
 *              a lane is a place to be, not a thing on the ground (a theme may draw rails there, or nothing).
 *   a segment  one slot of the course: the stretch before an ask, and the ask at its end. Numbered at its head.
 *   an ask     what stands across the way, in its role's colour: a hurdle or a block to go over (the whole way), posts
 *              to go round (two lanes, the open one clear). Its tell is drawn before it: a jump's window as a pale
 *              strip, posts' arrows toward the open lane.
 *   the line   where a player runs it: the reaction bot's own run (a 0.4 s reaction, the course's sight), drawn solid
 *              on the ground and dashed in the air
 *   the flanks the bands either side of the way: the course's own walls (course-scenery.js), a cell a slice, lettered
 *              A (the complex slice) or B (the plain one) and named. That is the PATTERN the sides are dressed in
 *              (era/wall-rhythm.js: never three alike, never a pair repeated), and each cell is
 *              where a designed slice of that kind is placed.
 *
 * To scale: a metre across is a metre along.
 *
 *   courseMap(course, { seed?, perRow?, flank?, scale?, title? }) → { svg, width, height, rows, asks, flanks: { left, right } }
 *     seed     which of the course's rolls is drawn (1: the reference roll)
 *     perRow   segments a row (5)        flank  metres of each side drawn (6)        scale  pixels a metre (9)
 *   courseMapHtml(course, { seeds?, title? }) → a page of maps, one a seed (the book's page)
 *
 * Pure and deterministic: the roll's own dice, the bot's own run.
 */
import { playCourse, PRIMITIVES, LANES } from './roll-course.js';

const HALF = 3.3;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (v) => Math.round(v * 10) / 10;
const INK = '#2b2a27', FAINT = '#b9b3a6', PAPER = '#f6f3ec', WAY = '#e4dfd3', FLANK = { A: '#cfd8c6', B: '#e6e9dc' };
const NAMES = { hurdle: 'hurdle', block: 'block', 'posts-left': 'posts, left open', 'posts-right': 'posts, right open' };

export function courseMap(course, { seed = 1, perRow = 5, flank = 6, scale = 9, title = 'Course' } = {}) {
  const run = playCourse(course, { seed, trace: true }), asks = run.asks, col = course.dress.palette, n = course.slots.length, top = course.pace.top;
  // the sides' pattern: the course's own (course-scenery.js), a slice a segment's length, each side in its own order
  const left = [...course.scenery.left], right = [...course.scenery.right];
  // a segment: from the end of the ask before it (the start, for the first) to the end of its own
  const ends = course.slots.map((s, k) => s.y + PRIMITIVES[asks[k]].len), seg = course.slots.map((s, k) => ({ k, from: k ? ends[k - 1] : 0, to: k === n - 1 ? course.exit[1] : ends[k], y: s.y, id: asks[k] }));
  const rows = []; for (let i = 0; i < n; i += perRow) rows.push(seg.slice(i, i + perRow));
  const across = 2 * (HALF + flank), rowH = across * scale + 84, padX = 34, head = 80;
  const width = Math.round(Math.max(...rows.map((R) => R[R.length - 1].to - R[0].from)) * scale + 2 * padX), height = Math.round(head + rows.length * rowH + 76);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${INK}">`);
  out.push(`<rect width="${width}" height="${height}" fill="${PAPER}"/>`);
  out.push(`<text x="${padX}" y="26" font-size="17" font-weight="600">${esc(title)}</text>`);
  out.push(`<text x="${padX}" y="44" fill="#6b675e">roll ${seed} of ${course.ways} · top speed ${r1(top)} m/s · a segment ${course.gap} m (${r1(course.gap / top)} s) · sight ${course.sight} m · the reaction begins ${course.reactAt} m before an ask · run it left to right, a row at a time</text>`);
  rows.forEach((R, ri) => {
    const x0 = R[0].from, X = (y) => padX + (y - x0) * scale, y0 = head + ri * rowH, cy = y0 + (across / 2) * scale, Y = (x) => cy + x * scale;
    const xa = X(R[0].from), xb = X(R[R.length - 1].to);
    // the flanks: the course's own slices (course-scenery.js), a cell each, lettered A or B and named
    const [ra, rb] = [R[0].from, R[R.length - 1].to];
    for (const c of course.scenery.cells) {
      const a = Math.max(ra, c.y0), b = Math.min(rb, c.y1);
      if (b - a < 0.5) continue;
      const [ya, yb] = c.side === 'left' ? [Y(-HALF - flank), Y(-HALF)] : [Y(HALF), Y(HALF + flank)];
      out.push(`<rect x="${r1(X(a))}" y="${r1(ya)}" width="${r1(X(b) - X(a))}" height="${r1(yb - ya)}" fill="${FLANK[c.kind]}" stroke="${PAPER}" stroke-width="2"/>`);
      if (b - a > 4) out.push(`<text x="${r1(X(a) + 7)}" y="${r1(c.side === 'left' ? ya + 15 : yb - 7)}" fill="#55604a"><tspan font-weight="600">${c.kind}</tspan>${b - a > 12 ? ` · ${esc((c.kind === 'A' ? course.dress.walls.a : course.dress.walls.b).name)}` : ''}</text>`);
    }
    out.push(`<text x="${r1(xa - 6)}" y="${r1(Y(-HALF - flank / 2))}" fill="#6b675e" font-size="10" text-anchor="middle" transform="rotate(-90 ${r1(xa - 6)} ${r1(Y(-HALF - flank / 2))})">left</text><text x="${r1(xa - 6)}" y="${r1(Y(HALF + flank / 2))}" fill="#6b675e" font-size="10" text-anchor="middle" transform="rotate(-90 ${r1(xa - 6)} ${r1(Y(HALF + flank / 2))})">right</text>`);
    // the way, its kerbs, its lanes as guides
    out.push(`<rect x="${r1(xa)}" y="${r1(Y(-HALF))}" width="${r1(xb - xa)}" height="${r1(2 * HALF * scale)}" fill="${WAY}"/>`);
    for (const k of [-HALF, HALF]) out.push(`<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(Y(k))}" y2="${r1(Y(k))}" stroke="${INK}" stroke-width="1.4"/>`);
    for (const k of [-1, 1]) out.push(`<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(Y(k))}" y2="${r1(Y(k))}" stroke="${FAINT}" stroke-width="1" stroke-dasharray="6 6"/>`);
    for (const s of R) {
      const P = PRIMITIVES[s.id], role = P.ask === 'jump' ? (s.id === 'block' ? 'jump2' : 'jump') : 'steer';
      // the segment's head, and its edge
      out.push(`<line x1="${r1(X(s.to))}" x2="${r1(X(s.to))}" y1="${r1(Y(-HALF - flank))}" y2="${r1(Y(HALF + flank))}" stroke="${FAINT}" stroke-width="1"/>`);
      out.push(`<text x="${r1(X(s.from) + 4)}" y="${r1(Y(-HALF - flank) - 6)}" fill="${INK}"><tspan font-weight="600">${s.k + 1}</tspan> · ${NAMES[s.id]}</text>`);
      // its tell
      if (P.ask === 'jump') {
        const L = course.pace.lead[s.id], a = s.y - L.early * top, b = s.y - L.late * top;
        out.push(`<rect x="${r1(X(a))}" y="${r1(Y(-HALF))}" width="${r1(X(b) - X(a))}" height="${r1(2 * HALF * scale)}" fill="${col['tell-jump']}" opacity="0.75"/>`);
      } else {
        const to = Math.sign(LANES[P.open]), from = s.y - top * course.pace.laneTime[2];
        for (const lane of LANES.filter((_, i) => i !== P.open)) for (const ay of [from, (from + s.y) / 2]) {
          const px = X(ay), py = Y(lane), d = to * scale;
          out.push(`<path d="M${r1(px - 3)} ${r1(py - 0.5 * d)} L${r1(px + 3)} ${r1(py - 0.5 * d)} L${r1(px + 3)} ${r1(py + 0.2 * d)} L${r1(px + 6)} ${r1(py + 0.2 * d)} L${r1(px)} ${r1(py + 0.85 * d)} L${r1(px - 6)} ${r1(py + 0.2 * d)} L${r1(px - 3)} ${r1(py + 0.2 * d)} Z" fill="${col['tell-steer']}" stroke="#4a86bf" stroke-width="0.6"/>`);
        }
      }
      // the ask itself
      const xa0 = P.ask === 'steer' ? P.x - 2 : -HALF, xa1 = P.ask === 'steer' ? P.x + 2 : HALF;
      out.push(`<rect x="${r1(X(s.y))}" y="${r1(Y(xa0))}" width="${r1(Math.max(3, P.len * scale))}" height="${r1((xa1 - xa0) * scale)}" fill="${col[role]}" stroke="${INK}" stroke-width="0.8"/>`);
    }
    // the start, the exit
    if (ri === 0) out.push(`<path d="M${r1(X(0) - 2)} ${r1(Y(-0.7))} L${r1(X(0) + 10)} ${r1(Y(0))} L${r1(X(0) - 2)} ${r1(Y(0.7))} Z" fill="${INK}"/><text x="${r1(X(0) + 13)}" y="${r1(Y(0) + 4)}" font-size="10">start</text>`);
    if (ri === rows.length - 1) { const ex = X(course.exit[1]); out.push(`<line x1="${r1(ex)}" x2="${r1(ex)}" y1="${r1(Y(-HALF))}" y2="${r1(Y(HALF))}" stroke="${col.exit}" stroke-width="5"/><text x="${r1(ex - 28)}" y="${r1(Y(-HALF) - 4)}" font-size="10">exit</text>`); }
    // the line a player runs: solid on the ground, dashed in the air
    const pts = run.line.filter(([y]) => y >= R[0].from - 0.5 && y <= R[R.length - 1].to + 0.5);
    // (runs of ground and of air, each begun where the last one ended so the line is unbroken)
    const paths = { 0: '', 1: '' };
    let was = null, last = null;
    for (const [y, x, up] of pts) {
      const p = `${r1(X(y))} ${r1(Y(x))}`;
      paths[up] += (was === up ? ' L' : ` M${last ?? p} L`) + p;
      was = up; last = p;
    }
    if (paths[0]) out.push(`<path d="${paths[0].trim()}" fill="none" stroke="#b0303a" stroke-width="1.6" stroke-linejoin="round"/>`);
    if (paths[1]) out.push(`<path d="${paths[1].trim()}" fill="none" stroke="#b0303a" stroke-width="1.6" stroke-dasharray="4 4"/>`);
    // the ruler: metres, and seconds at top speed
    const ry = Y(HALF + flank) + 14;
    out.push(`<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(ry)}" y2="${r1(ry)}" stroke="${INK}" stroke-width="1"/>`);
    for (let m = Math.ceil(R[0].from / 10) * 10; m <= R[R.length - 1].to; m += 10) out.push(`<line x1="${r1(X(m))}" x2="${r1(X(m))}" y1="${r1(ry)}" y2="${r1(ry + 5)}" stroke="${INK}"/><text x="${r1(X(m))}" y="${r1(ry + 17)}" text-anchor="middle" font-size="10">${m} m</text><text x="${r1(X(m))}" y="${r1(ry + 29)}" text-anchor="middle" font-size="10" fill="#8a857a">${r1(m / top)} s</text>`);
  });
  // the key
  const ky = height - 50, key = [[col.jump, 'go over: a hurdle'], [col.jump2, 'go over: a block'], [col.steer, 'go round: posts'], [col['tell-jump'], 'the jump\'s window'], [col['tell-steer'], 'toward the open lane'], [FLANK.A, 'a flank cell, slice A'], [FLANK.B, 'slice B']];
  let kx = padX;
  for (const [c, label] of key) { out.push(`<rect x="${kx}" y="${ky}" width="14" height="14" fill="${c}" stroke="${INK}" stroke-width="0.6"/><text x="${kx + 19}" y="${ky + 11}">${esc(label)}</text>`); kx += 34 + label.length * 6.1; }
  out.push(`<line x1="${kx}" x2="${kx + 26}" y1="${ky + 7}" y2="${ky + 7}" stroke="#b0303a" stroke-width="1.6"/><text x="${kx + 31}" y="${ky + 11}">a run (dashed: in the air)</text>`);
  out.push(`<text x="${padX}" y="${ky + 34}" fill="#6b675e">up the page is the hero's left · a lane is a place to be, drawn as a guide, not a thing on the ground · to scale: a metre across is a metre along</text>`);
  out.push('</svg>');
  return { svg: out.join('\n'), width, height, rows: rows.length, asks, flanks: { left: left.join(''), right: right.join('') } };
}

export function courseMapHtml(course, { seeds = [1, 2, 3], title = 'Course' } = {}) {
  const maps = seeds.map((seed) => courseMap(course, { seed, title: `${title} · roll ${seed}` }).svg);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · course map</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#ebe7dd;color:#2b2a27;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1180px;margin:0 auto;padding:24px 16px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#6b675e}svg{display:block;width:100%;height:auto;margin:0 0 22px;border:1px solid #d6d0c2}</style></head><body><main><h1>${esc(title)}: the course map</h1><p>The course from straight above, turned on its side: it runs from left to right, a row at a time. One map a roll.</p>${maps.join('\n')}</main></body></html>`;
}
