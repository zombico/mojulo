/**
 * THE TABLETOP PAGE — a board game to play against the computer: one self-contained HTML page carrying the board (the
 * lattice record), the game (data), the kernel and the mind (their closures' source) and a small client. Two views of
 * the same board: the plan (SVG, from above) and the table (CSS 3D, a seat at the board; every cell's top is a div, so
 * it is played by clicking there too, and a piece is a token that slides from cell to cell).
 *
 *   tabletopPageHtml(G, { human?, level?, view?, seed?, title? }) → html   (a euro game: tabletop-euro-page.js; a tile
 *     game: tabletop-tile-page.js; a card game, which needs no board: tabletop-card-page.js; a round game:
 *     tabletop-round-page.js)
 *     human the player id the person plays (the first player); level 'easy' | 'fair' | 'hard' ('fair'); view 'plan' |
 *     'table' (the first shown, 'plan'); seed the computer's dice (1)
 *     G as tabletop-kernel.js reads it, with `board` a lattice spec, and for the page: players[i].colour, and each
 *     piece's glyph (one character drawn on its token)
 *
 * The page reads a clock only to measure a move's time for the game's clock rule (the kernel is handed the number), and
 * the computer thinks in a count of positions, so a replayed game is the same game.
 */

import { latticeSvg, latticeSvgFrame } from '../polygonizer/lattice-svg.js';
import { latticeFaces, latticeCameras } from '../polygonizer/lattice-css3d.js';
import { cameraMatrixFromWorldFraming, planeMatrix } from '../scene/scene-css3d.js';
import { buildTabletop } from './tabletop-kernel.js';
import { tabletopGame } from './tabletop.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { euroPageHtml } from './tabletop-euro-page.js';
import { tilePageHtml } from './tabletop-tile-page.js';
import { cardPageHtml } from './tabletop-card-page.js';
import { roundPageHtml } from './tabletop-round-page.js';
import { pieceBodies } from './tabletop-bodies.js';

const VIEWPORT = { width: 760, height: 560 };
const UNIT = 60;
const TOKEN = 0.74;
const LEVELS = ['easy', 'fair', 'hard'];

const r2 = (x) => Math.round(x * 100) / 100;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// JSON inside a <script>: no '</script>' can close it early
const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

export function tabletopPageHtml(G, opts = {}) {
  if (!G?.board && !G?.piles && !G?.round) throw new Error('tabletop page: the game needs a board, piles of cards or rounds');
  // refuses a game the kernel cannot play, here rather than on the page; a game's `deal` is done here, the page plays it
  const { L, K, G: dealtG } = tabletopGame(G);
  G = dealtG;
  const human = opts.human ?? K.players[0].id;
  if (K.sideOf[human] === undefined) throw new Error(`tabletop page: '${human}' is not a player (${K.players.map((p) => p.id).join(', ')})`);
  const level = opts.level ?? 'fair';
  if (!LEVELS.includes(level)) throw new Error(`tabletop page: level is ${LEVELS.join(', ')}`);
  const view = opts.view ?? 'plan';
  if (K.round) return roundPageHtml(G, L, K, { human, level, seed: opts.seed ?? 1, title: opts.title });
  if (K.card) return cardPageHtml(G, L, K, { human, level, seed: opts.seed ?? 1, title: opts.title });
  if (K.euro) return euroPageHtml(G, L, K, { human, level, view, seed: opts.seed ?? 1, title: opts.title });
  if (K.tile) return tilePageHtml(G, L, K, { human, level, view, seed: opts.seed ?? 1, title: opts.title });
  const facing = K.T.ways.get(K.players[K.sideOf[human]].facing);
  // the person sits at their own side of the board: the plan and the table both turn to face their forward
  const turnRad = ((facing.angle - 90) * Math.PI) / 180;

  // the plan: the board's SVG, its frame for placing pieces
  const frame = latticeSvgFrame(L);
  // named regions tinted, each its own colour, so where a majority counts can be seen
  const REGION_TINTS = ['#d9c79a', '#a9c7a0', '#c9a7a0', '#a7b6cf', '#cfc0a0', '#b0a7c9', '#a0c9c4', '#cfb1c3'];
  const fills = {};
  Object.keys(G.regions || {}).forEach((name, k) => { for (const c of G.regions[name]) fills[c] = REGION_TINTS[k % REGION_TINTS.length]; });
  const plan = latticeSvg(L, { names: false, ids: true, fills });

  // the table: each cell's top and side as a placed div, a token's place on every cell, the cameras turned to the seat
  const turnPt = ([x, y, z]) => [x * Math.cos(turnRad) - y * Math.sin(turnRad), x * Math.sin(turnRad) + y * Math.cos(turnRad), z];
  const cams = latticeCameras(L).map((c) => {
    const wf = { ...c.worldFraming, cameraPosition: turnPt(c.worldFraming.cameraPosition), lookAt: turnPt(c.worldFraming.lookAt) };
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(wf, VIEWPORT, UNIT);
    return { name: c.name, matrix, perspective: r2(perspective), center };
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const faces = latticeFaces(L, { fills }).map((f) => {
    const c = f.corners, u = sub(c[1], c[0]), v = sub(c[3], c[0]);
    const cell = f.group.startsWith('cell:') ? K.T.byName.get(f.group.slice(5)) : -1;
    return { cell, w: r2(Math.hypot(...u) * UNIT), h: r2(Math.hypot(...v) * UNIT), fill: f.fill, clip: f.clip ?? null, t: planeMatrix(c[0], u, v, UNIT) };
  });
  // a token lies on its cell's top, its text upright for the seat
  const side = TOKEN * L.cell, ux = [Math.cos(turnRad), Math.sin(turnRad), 0], vy = [Math.sin(turnRad), -Math.cos(turnRad), 0];
  const tokens = L.cells.map((cl) => {
    const o = [cl.at[0] - (ux[0] + vy[0]) * side / 2, cl.at[1] - (ux[1] + vy[1]) * side / 2, cl.at[2] + 0.004];
    return planeMatrix(o, ux, vy, UNIT);
  });

  // a shaped piece stands on its cell as a body, turned to face its player's way
  const { bodies, icons } = pieceBodies(G, { cell: L.cell, unit: UNIT });
  const at = L.cells.map((c) => c.at.map((x) => r2(x * UNIT)));
  const turns = K.players.map((p) => r2(K.T.ways.get(p.facing).angle - 90));
  const data = {
    L, G, human, level, seed: opts.seed ?? 1, view,
    plan: { W: r2(frame.W), H: r2(frame.H), cells: L.cells.map((c) => [r2((c.at[0] - frame.x0) * frame.px + frame.pad), r2((frame.y1 - c.at[1]) * frame.px + frame.pad)]), r: r2(frame.px * L.cell * 0.36), cellPx: r2(frame.px * L.cell), turn: r2(-(facing.angle - 90)), icons },
    table: { cams, faces, tokens, size: r2(side * UNIT), bodies, at, turns },
  };
  const title = opts.title ?? G.title ?? 'mojulo board game';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:light dark;--bg:#f4f1ea;--ink:#2b2622;--mute:#7a6f63;--line:#d8cfc0;--mark:#d2452f;--go:#3a8f5a;--panel:#fffdf8}
  @media (prefers-color-scheme:dark){:root{--bg:#17191d;--ink:#e9e3d8;--mute:#9a9183;--line:#33363c;--panel:#1f2227}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
  header{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
  header h1{font-size:16px;margin:0 8px 0 0}
  header button,header select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
  header button.on{border-color:var(--ink)}
  #status{margin-left:auto;font-weight:600}
  main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start}
  #boards{flex:1 1 520px;min-width:0;display:flex;justify-content:center}
  #plan svg{max-width:100%;height:auto;display:block}
  #plan polygon{cursor:pointer}
  #plan .tok circle{stroke:#1a1512;stroke-width:1.5}
  #plan .tok text{font-size:var(--g);text-anchor:middle;dominant-baseline:central;pointer-events:none}
  #plan .tok{pointer-events:none;transition:transform .22s ease}
  #hl{pointer-events:none}
  .viewport{position:relative;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;max-width:100%;overflow:hidden;border-radius:10px;background:#1d2026}
  .view{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:0 0}
  .f{position:absolute;left:0;top:0;transform-origin:0 0;backface-visibility:visible}
  .f.cell{cursor:pointer}
  .f.cell.sel{box-shadow:inset 0 0 0 4px var(--mark)}
  .f.cell.to::after{content:"";position:absolute;inset:34%;border-radius:50%;background:var(--go);opacity:.8}
  .f.cell.cap::after{content:"";position:absolute;inset:8%;border-radius:50%;border:4px solid var(--mark)}
  .f.cell.last{filter:brightness(1.18)}
  .pc{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:0 0;transition:transform .25s ease;pointer-events:none}
  .pc .f{backface-visibility:visible}
  #plan .icon path{stroke:#1a1512;stroke-width:1.4;stroke-linejoin:round}
  .t{position:absolute;left:0;top:0;transform-origin:0 0;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:transform .25s ease;pointer-events:none;box-shadow:0 0 0 2px #1a1512 inset}
  aside{flex:0 1 240px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
  aside h2{font-size:13px;margin:0 0 6px;color:var(--mute);font-weight:600}
  #clocks{display:flex;gap:8px;margin-bottom:10px}
  #clocks div{flex:1;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-variant-numeric:tabular-nums}
  #clocks div.on{border-color:var(--ink);font-weight:600}
  #moves{margin:0;padding-left:22px;max-height:360px;overflow:auto;font-variant-numeric:tabular-nums}
  #pick{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#0006}
  #pick div{background:var(--panel);border-radius:10px;padding:12px;display:flex;gap:8px}
  #pick button{font-size:28px;width:52px;height:52px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
  @media (max-width:600px){main{padding:16px 16px}aside{flex-basis:100%}}
</style></head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <button id="v-plan">Plan</button><button id="v-table">Table</button>
  <select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button id="pass" style="display:none">Pass</button><button id="undo">Undo</button><button id="again">New game</button>
  <span id="status"></span>
</header>
<main>
  <div id="boards">
    <div id="plan"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.plan.W} ${data.plan.H}" width="${data.plan.W}" height="${data.plan.H}"><g id="board" transform="rotate(${data.plan.turn} ${r2(data.plan.W / 2)} ${r2(data.plan.H / 2)})">${plan.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}<g id="hl"></g></g><g id="toks"></g></svg></div>
    <div id="table" class="viewport"><div class="view" id="view"></div></div>
  </div>
  <aside><div id="clocks"></div><h2>Moves</h2><ol id="moves"></ol></aside>
</main>
<div id="pick"><div id="pick-row"></div></div>
<script>
const DATA = ${scriptJson(data)};
const T = (${buildTabletop.toString()})();
const M = (${buildTabletopMind.toString()})(T);
(${tabletopClient.toString()})(DATA, T, M);
</script>
</body></html>
`;
}

/* The page's own code: runs in the browser, references only its arguments and the DOM. */
export function tabletopClient(D, T, M) {
  const $ = (id) => document.getElementById(id);
  const K = T.compile(D.L, D.G), me = K.sideOf[D.human];
  const glyph = (kind) => { const g = D.G.pieces[kind] && D.G.pieces[kind].glyph; return g === undefined ? kind : g; };
  const colour = (s) => D.G.players[s].colour || ['#f3ede2', '#2a2420', '#c4362a', '#2f6db3'][s % 4];
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + c(n >> 16) + c((n >> 8) & 255) + c(n & 255); };
  const inkOn = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 140 ? '#1a1512' : '#f3ede2'; };
  let S, line, legal, sel, last, busy, level = D.level, view = D.view, turnStart = 0, tick = 0;

  // the table: the board's faces, then a token per piece
  const vw = $('view');
  vw.innerHTML = D.table.faces.map((f) => '<div class="f' + (f.cell >= 0 ? ' cell' : '') + '"' + (f.cell >= 0 ? ' data-cell="' + f.cell + '"' : '')
    + ' style="width:' + f.w + 'px;height:' + f.h + 'px;background:' + f.fill + ';' + (f.clip ? 'clip-path:' + f.clip + ';' : '') + 'transform:' + f.t + '"></div>').join('');
  const cellDivs = {};
  vw.querySelectorAll('.f.cell').forEach((d) => { cellDivs[d.dataset.cell] = d; });
  function setCam(i) {
    const c = D.table.cams[i];
    $('table').style.perspective = c.perspective + 'px';
    vw.style.transform = 'translate(' + c.center[0] + 'px,' + c.center[1] + 'px) ' + c.matrix;
  }
  setCam(0);

  function reset() {
    S = T.start(K); line = []; sel = -1; last = null; busy = false; turnStart = performance.now();
    after();
  }
  function after() {
    legal = T.legal(K, S);
    render();
    const end = S.over || T.outcome(K, S, legal);
    if (!end && S.side !== me) { busy = true; setTimeout(computer, 40); }
  }
  function play(m) {
    const ms = performance.now() - turnStart;
    S = T.apply(K, S, m, S.clock ? { ms: ms } : undefined);
    turnStart = performance.now();
    line.push({ name: m.name, side: m.p >= 0 ? K.players[S.pieces[m.p].side].id : '' });
    last = m; sel = S.chain >= 0 && S.side === me ? S.pieces[S.chain].at : -1;
    after();
  }
  function computer() {
    const r = M.think(K, S, Object.assign({}, M.LEVELS[level], { seed: D.seed + line.length }));
    busy = false;
    if (r) play(r.move);
  }
  function click(cell) {
    if (busy || S.over || S.side !== me) return;
    if (sel >= 0) {
      const to = legal.filter((m) => m.from === sel && m.to === cell);
      if (to.length === 1) return play(to[0]);
      if (to.length > 1) return pick(to);
    }
    if (S.chain >= 0) return;
    // a drop: an empty cell the player may place on (a picker when more than one kind may go there)
    const drops = legal.filter((m) => m.drop && m.to === cell);
    if (drops.length === 1) return play(drops[0]);
    if (drops.length > 1) return pick(drops);
    const p = S.board[cell];
    sel = p >= 0 && S.pieces[p].side === me && legal.some((m) => m.from === cell) ? cell : -1;
    render();
  }
  function pick(moves) {
    const row = $('pick-row'), box = $('pick');
    row.innerHTML = '';
    moves.forEach((m) => {
      const b = document.createElement('button');
      b.textContent = glyph(m.promote || m.drop || S.pieces[m.p].kind) || m.drop || m.promote;
      b.title = m.name;
      b.onclick = () => { box.style.display = 'none'; play(m); };
      row.appendChild(b);
    });
    box.style.display = 'flex';
  }

  function status() {
    const end = S.over || T.outcome(K, S, legal);
    const tally = end && end.scores ? ' ' + end.scores.map((x, s) => K.players[s].id + ' ' + x).join(' · ') : '';
    if (end) {
      if (end.winner === null) return 'Draw (' + end.reason + ')' + tally;
      return (end.winner === me ? 'You win' : 'The computer wins') + ' (' + end.reason + ')' + tally;
    }
    if (S.side !== me) return 'Thinking…';
    const royalHit = K.royal && S.pieces.some((P) => P.at >= 0 && P.side === me && K.kinds[P.kind].royal && K.players.some((_, s) => s !== me && T.attacked(K, S, P.at, s)));
    const now = K.G.end && K.G.end.score ? ' · ' + T.scores(K, S).map((x, s) => K.players[s].id + ' ' + x).join(' · ') : '';
    return (S.chain >= 0 ? 'Jump again' : 'Your move') + (royalHit ? ', check' : '') + now;
  }

  function render() {
    // where the selected piece may go
    // where the selected piece may go; or, in a drop game with few choices, where a drop may go
    const dropTo = S.side === me && !busy ? legal.filter((m) => m.drop) : [];
    const targets = sel >= 0 ? legal.filter((m) => m.from === sel) : dropTo.length && dropTo.length <= 24 ? dropTo : [];
    // the plan
    const P = D.plan, hl = [];
    const ring = (cell, stroke, w) => '<circle cx="' + P.cells[cell][0] + '" cy="' + P.cells[cell][1] + '" r="' + (P.r * 1.12) + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"/>';
    if (last && last.p >= 0) { hl.push(ring(last.from, '#e0b84a', 3)); hl.push(ring(last.to, '#e0b84a', 3)); }
    if (sel >= 0) hl.push(ring(sel, 'var(--mark)', 4));
    for (const m of targets) hl.push(m.cap.length ? ring(m.to, 'var(--mark)', 3) : '<circle cx="' + P.cells[m.to][0] + '" cy="' + P.cells[m.to][1] + '" r="' + (P.r * 0.3) + '" fill="var(--go)"/>');
    $('hl').innerHTML = hl.join('');
    const rot = P.turn, cx = P.W / 2, cy = P.H / 2, rad = rot * Math.PI / 180;
    const place = (cell) => { const x = P.cells[cell][0] - cx, y = P.cells[cell][1] - cy; return [cx + x * Math.cos(rad) - y * Math.sin(rad), cy + x * Math.sin(rad) + y * Math.cos(rad)]; };
    $('toks').innerHTML = S.pieces.map((Pc, i) => {
      if (Pc.at < 0) return '';
      const at = place(Pc.at), c = colour(Pc.side), icon = P.icons[Pc.kind];
      if (icon) {
        // its side silhouette, as a diagram draws a piece, standing in the middle of its cell
        const sc = P.cellPx * 0.95, top = Math.max.apply(null, icon.flat().map((q) => q[1]));
        const d = icon.map((poly) => 'M' + poly.map(([x, z]) => (x * sc).toFixed(1) + ' ' + ((top / 2 - z) * sc).toFixed(1)).join('L') + 'Z').join('');
        return '<g class="tok icon" data-p="' + i + '" transform="translate(' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + ')"><path d="' + d + '" fill="' + c + '"/></g>';
      }
      return '<g class="tok" data-p="' + i + '" style="--g:' + (P.r * 1.25) + 'px" transform="translate(' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + ')"><circle r="' + P.r + '" fill="' + c + '"/><text fill="' + inkOn(c) + '">' + glyph(Pc.kind) + '</text></g>';
    }).join('');
    // the table
    for (const k in cellDivs) cellDivs[k].className = 'f cell';
    if (last && last.p >= 0) { cellDivs[last.from].classList.add('last'); cellDivs[last.to].classList.add('last'); }
    if (sel >= 0) cellDivs[sel].classList.add('sel');
    for (const m of targets) cellDivs[m.to].classList.add(m.cap.length ? 'cap' : 'to');
    const size = D.table.size;
    S.pieces.forEach((Pc, i) => {
      const body = D.table.bodies[Pc.kind];
      if (body) {
        let b = vw.querySelector('.pc[data-p="' + i + '"]');
        if (Pc.at < 0) { if (b) b.remove(); return; }
        const c = colour(Pc.side), look = Pc.kind + ':' + c;
        if (!b) { b = document.createElement('div'); b.className = 'pc'; b.dataset.p = i; vw.appendChild(b); }
        if (b.dataset.look !== look) {
          b.dataset.look = look;
          b.innerHTML = body.map((f) => '<div class="f" style="width:' + f.w + 'px;height:' + f.h + 'px;background:' + shade(c, f.k) + ';' + (f.clip ? 'clip-path:' + f.clip + ';' : '') + 'transform:' + f.t + '"></div>').join('');
        }
        const a = D.table.at[Pc.at];
        b.style.transform = 'translate3d(' + a[0] + 'px,' + a[1] + 'px,' + a[2] + 'px) rotateZ(' + D.table.turns[Pc.side] + 'deg)';
        return;
      }
      let t = vw.querySelector('.t[data-p="' + i + '"]');
      if (Pc.at < 0) { if (t) t.remove(); return; }
      if (!t) { t = document.createElement('div'); t.className = 't'; t.dataset.p = i; vw.appendChild(t); }
      const c = colour(Pc.side);
      t.style.cssText = 'width:' + size + 'px;height:' + size + 'px;background:' + c + ';color:' + inkOn(c) + ';font-size:' + (size * 0.7) + 'px;transform:' + D.table.tokens[Pc.at];
      t.textContent = glyph(Pc.kind);
    });
    // the rest
    $('status').textContent = status();
    $('moves').innerHTML = line.map((x) => '<li>' + (x.side ? x.side + ' ' : '') + x.name + '</li>').join('');
    $('moves').scrollTop = 1e6;
    $('undo').disabled = busy || !line.length;
    $('pass').style.display = !S.over && S.side === me && !busy && legal.some((m) => m.p < 0 && !m.drop) ? '' : 'none';
    clocks();
  }
  function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function clocks() {
    const box = $('clocks');
    if (!S.clock) { box.style.display = 'none'; return; }
    const run = S.over ? 0 : performance.now() - turnStart;
    box.innerHTML = K.players.map((p, s) => '<div class="' + (s === S.side ? 'on' : '') + '">' + p.id + ' ' + fmt(S.clock[s] - (s === S.side ? run : 0)) + '</div>').join('');
  }

  function showView(v) {
    view = v;
    $('plan').style.display = v === 'plan' ? '' : 'none';
    $('table').style.display = v === 'table' ? '' : 'none';
    $('v-plan').classList.toggle('on', v === 'plan');
    $('v-table').classList.toggle('on', v === 'table');
  }
  $('v-plan').onclick = () => showView('plan');
  $('v-table').onclick = () => showView('table');
  $('plan').addEventListener('click', (e) => { const c = e.target.closest('[data-cell]'); if (c) click(Number(c.dataset.cell)); });
  vw.addEventListener('click', (e) => { const c = e.target.closest('[data-cell]'); if (c) click(Number(c.dataset.cell)); });
  $('level').onchange = (e) => { level = e.target.value; };
  $('again').onclick = () => reset();
  $('pass').onclick = () => { const m = legal.find((x) => x.p < 0 && !x.drop); if (m && !busy && S.side === me) play(m); };
  $('undo').onclick = () => {
    if (busy || !line.length) return;
    // replay all but the person's last turn (and the computer's answer to it)
    const names = line.map((x) => x.name), keep = [];
    let s = T.start(K), cut = names.length;
    const sides = [];
    for (const n of names) { const m = T.legal(K, s).find((x) => x.name === n); sides.push(s.side); s = T.apply(K, s, m); }
    while (cut > 0 && sides[cut - 1] !== me) cut--;
    while (cut > 0 && sides[cut - 1] === me) cut--;
    S = T.start(K);
    for (const n of names.slice(0, cut)) { const m = T.legal(K, S).find((x) => x.name === n); S = T.apply(K, S, m); keep.push({ name: n, side: K.players[sides[keep.length]].id }); last = m; }
    line = keep; sel = -1; if (!cut) last = null; turnStart = performance.now();
    after();
  };
  showView(view);
  reset();
  tick = setInterval(() => { if (S && S.clock && !S.over) clocks(); }, 250);
}
