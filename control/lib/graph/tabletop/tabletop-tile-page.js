/**
 * THE TILE PAGE — a tile game (the tabletop kernel's tiles) against the computers: the board growing on the plan (SVG,
 * cropped to what is laid) and on the table (CSS 3D, each laid tile's art on its cell's top, claims standing as
 * bodies); the drawn tile turned by hand and laid where it fits; a claim chosen or not; every seat's points and pieces
 * in hand, the tiles left, a log. A tile's art is drawn from its segments: an area a wedge from each edge it spans, a
 * line from its edges to the middle, a centre a small building, in the game's own colours (`look.features`).
 *
 *   tilePageHtml(G, L, K, { human, level, view, seed, title }) → html   (tabletopPageHtml sends a tile game here)
 */

import { latticeSvg, latticeSvgFrame } from '../polygonizer/lattice-svg.js';
import { latticeFaces, latticeCameras } from '../polygonizer/lattice-css3d.js';
import { cameraMatrixFromWorldFraming, planeMatrix } from '../scene/scene-css3d.js';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tableBroadcastData, broadcastDomCss, broadcastDomClient } from '../broadcast/broadcast-dom.js';
import { pieceBodies } from './tabletop-bodies.js';

const VIEWPORT = { width: 760, height: 600 };
const UNIT = 40;
const LEVELS = ['easy', 'fair', 'hard'];
const TABLE = ['#3b4a37', '#364433'];

const r2 = (x) => Math.round(x * 100) / 100;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

export function tilePageHtml(G, L, K, opts = {}) {
  const { human, level, view, seed } = opts;
  const frame = latticeSvgFrame(L, { px: 56 });
  const plan = latticeSvg(L, { px: 56, names: false, ids: true, palette: TABLE });
  // a cell's own frame: its corners and edge middles in per cent of the rectangle round it (x east, y south)
  const c0 = L.cells[0], xs = c0.k.map((k) => L.corners[k].at[0]), ys = c0.k.map((k) => L.corners[k].at[1]);
  const hw = (Math.max(...xs) - Math.min(...xs)) / 2, hh = (Math.max(...ys) - Math.min(...ys)) / 2;
  const local = ([x, y]) => [r2(((x - c0.at[0]) + hw) / (2 * hw) * 100), r2(((c0.at[1] - y) + hh) / (2 * hh) * 100)];
  const geo = { k: c0.k.map((k) => local(L.corners[k].at)), e: c0.e.map((e) => local(L.edges[e].at)) };
  const box = L.cells.map((c) => [r2((c.at[0] - hw - frame.x0) * frame.px + frame.pad), r2((frame.y1 - c.at[1] - hh) * frame.px + frame.pad)]);

  const cams = latticeCameras(L).map((c) => {
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(c.worldFraming, VIEWPORT, UNIT);
    return { name: c.name, matrix, perspective: r2(perspective), center };
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const faces = latticeFaces(L, { palette: TABLE }).map((f) => {
    const c = f.corners, u = sub(c[1], c[0]), v = sub(c[3], c[0]);
    const cell = f.group.startsWith('cell:') ? K.T.byName.get(f.group.slice(5)) : -1;
    return { cell, w: r2(Math.hypot(...u) * UNIT), h: r2(Math.hypot(...v) * UNIT), fill: f.fill, clip: f.clip ?? null, t: planeMatrix(c[0], u, v, UNIT) };
  });
  const { bodies, icons } = pieceBodies(G, { cell: L.cell, unit: UNIT });
  const data = {
    tv: tableBroadcastData(G.players, opts.broadcast, ['#888888']),
    L, G, human, level, seed, view, geo,
    plan: { W: r2(frame.W), H: r2(frame.H), box, cw: r2(2 * hw * frame.px), ch: r2(2 * hh * frame.px), icons },
    table: { cams, faces, bodies, at: L.cells.map((c) => c.at.map((x) => r2(x * UNIT))), hw: r2(hw * UNIT), hh: r2(hh * UNIT) },
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
  button,select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
  button:disabled{opacity:.4;cursor:default}
  button.on{border-color:var(--ink);font-weight:600}
  #status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start}
  #boards{flex:1 1 520px;min-width:0;display:flex;justify-content:center}
  #plan{width:100%;max-width:760px}
  #plan svg{width:100%;max-height:640px;height:auto;display:block}
  #plan [data-cell]{cursor:pointer}
  #art,#marks{pointer-events:none}
  .viewport{position:relative;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;max-width:100%;overflow:hidden;border-radius:10px;background:#1d2026}
  .view{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:0 0}
  .f,.pc{position:absolute;left:0;top:0;transform-origin:0 0}
  .f svg{width:100%;height:100%;display:block;pointer-events:none}
  .f.cell{cursor:pointer}
  .f.cell.fit{box-shadow:inset 0 0 0 4px rgba(58,143,90,.95)}
  .f.cell.last{box-shadow:inset 0 0 0 3px #e0b84a}
  .pc{transform-style:preserve-3d;pointer-events:none}
  .pc .f{backface-visibility:visible}
  #pieces{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:0 0}
  aside{flex:0 1 280px;display:flex;flex-direction:column;gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
  .card h2{font-size:13px;margin:0 0 8px;color:var(--mute);font-weight:600}
  .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  #drawn{width:110px;height:110px;border:1px solid var(--line);border-radius:6px;overflow:hidden}
  #drawn svg{width:100%;height:100%;display:block}
  #prompt{font-weight:600;min-height:1.4em}
  .seat{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}
  .seat:last-child{border-bottom:0}
  .seat b{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;box-shadow:0 0 0 1px #1a1512 inset}
  .seat.now{font-weight:600}
  #log{margin:0;padding-left:34px;max-height:220px;overflow:auto;font-size:13px}
  .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;box-shadow:0 0 0 1px #1a1512 inset}
  @media (max-width:600px){aside{flex-basis:100%}}
${broadcastDomCss(data.tv)}
</style></head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <button id="v-plan">Plan</button><button id="v-table">Table</button>
  <select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button id="again">New game</button>
  <span id="status" aria-live="polite"></span>
</header>
<main>
  <div id="boards">
    <div id="plan"><svg xmlns="http://www.w3.org/2000/svg" id="plan-svg" viewBox="0 0 ${data.plan.W} ${data.plan.H}">${plan.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}<g id="art"></g><g id="marks"></g></svg></div>
    <div id="table" class="viewport"><div class="view" id="view"></div></div>
  </div>
  <aside>
    <div class="card"><div id="prompt"></div><div class="row" style="margin-top:8px;align-items:flex-start"><div id="drawn"></div><div class="row" id="acts" style="flex-direction:column;align-items:stretch"></div></div></div>
    <div class="card"><h2>Table</h2><div id="seats"></div></div>
    <div class="card"><h2>Log</h2><ol id="log"></ol></div>
  </aside>
</main>
<script>
const DATA = ${scriptJson(data)};
const T = (${buildTabletop.toString()})();
const M = (${buildTabletopMind.toString()})(T);
const TV = (${broadcastDomClient.toString()})(DATA.tv);
(${tabletopTileClient.toString()})(DATA, T, M, TV);
</script>
</body></html>
`;
}

/* The tile page's own code: runs in the browser, references only its arguments and the DOM. */
export function tabletopTileClient(D, T, M, TV) {
  const $ = (id) => document.getElementById(id);
  const K = T.compile(D.L, D.G), me = K.sideOf[D.human], n = K.L.dirs.length, look = D.G.look || {};
  const feat = (type) => (look.features && look.features[type]) || { colour: '#999', form: 'area' };
  const colour = (s) => TV.colour(s);   // the broadcast's kits: the seat's chip and its pieces agree
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16), c = (x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, '0'); return '#' + c(v >> 16) + c((v >> 8) & 255) + c(v & 255); };
  let S, legal, rot = 0, busy = false, level = D.level, log = [], turns = 0;
  // the laid tiles and the standing claims are objects (S.pieces): a cell's tile as { t, rot }, a claim as { c, s, side }
  const laidAt = (c) => (S.tiles[c] === null ? null : { t: S.pieces[S.tiles[c]].kind, rot: S.pieces[S.tiles[c]].rot });
  const laid = () => S.tiles.map((_, c) => laidAt(c));
  const standing = () => S.claims.map((q) => ({ c: S.pieces[q].at, s: S.pieces[q].seg, side: S.pieces[q].side }));

  // ── a tile's art, in a 0–100 box: the plain ground, then areas, lines and centres
  const G0 = D.geo, mid = [50, 50];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pts = (list) => list.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const turned = (k, r) => (k + r) % n;
  function anchor(seg, r) {
    if (seg.centre) return mid;
    const es = seg.edges.map((k) => G0.e[turned(k, r)]);
    const m = es.reduce((a, p) => [a[0] + p[0] / es.length, a[1] + p[1] / es.length], [0, 0]);
    return feat(seg.type).form === 'line' ? lerp(m, mid, es.length > 1 ? 0.5 : 0.45) : lerp(m, mid, es.length > 1 ? 0.6 : 0.35);
  }
  function art(id, r) {
    const segs = (K.tile.types[id].segments || []).map((g, i) => [g, i]), out = [];
    out.push('<polygon points="' + pts(G0.k) + '" fill="' + (look.plain || '#8db36a') + '"/>');
    for (const [g] of segs.filter(([g]) => !g.centre && feat(g.type).form === 'area')) {
      const c = feat(g.type).colour, es = g.edges.map((k) => turned(k, r));
      for (const e of es) {
        const a = G0.k[(e - 1 + n) % n], b = G0.k[e], tip = es.length > 1 ? mid : lerp(G0.e[e], mid, 0.42);
        out.push('<polygon points="' + pts([a, b, tip]) + '" fill="' + c + '"/>');
      }
      if (es.length > 1) out.push('<circle cx="50" cy="50" r="' + (es.length > 2 ? 30 : 16) + '" fill="' + c + '"/>');
    }
    for (const [g] of segs.filter(([g]) => !g.centre && feat(g.type).form === 'line')) {
      const c = feat(g.type).colour, es = g.edges.map((k) => G0.e[turned(k, r)]);
      if (es.length === 2) out.push('<path d="M' + pts([es[0]]) + ' Q50,50 ' + pts([es[1]]) + '" stroke="' + c + '" stroke-width="9" fill="none" stroke-linecap="round"/>');
      else for (const p of es) { const end = lerp(p, mid, es.length === 1 ? 0.55 : 0.82); out.push('<path d="M' + pts([p]) + ' L' + pts([end]) + '" stroke="' + c + '" stroke-width="9" stroke-linecap="round"/>'); }
      if (es.length !== 2) out.push('<rect x="42" y="42" width="16" height="16" fill="#6b5a45"/>');
    }
    for (const [g] of segs.filter(([g]) => g.centre)) {
      const c = feat(g.type).colour;
      out.push('<rect x="38" y="44" width="24" height="18" fill="' + c + '" stroke="#2b2622" stroke-width="1.5"/><polygon points="35,45 50,32 65,45" fill="' + shade(c, 0.75) + '" stroke="#2b2622" stroke-width="1.5"/>');
    }
    return out.join('');
  }
  const tileSvg = (id, r) => '<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + art(id, r) + '</svg>';

  // the table
  const vw = $('view');
  vw.innerHTML = D.table.faces.map((f) => '<div class="f' + (f.cell >= 0 ? ' cell' : '') + '"' + (f.cell >= 0 ? ' data-cell="' + f.cell + '"' : '')
    + ' style="width:' + f.w + 'px;height:' + f.h + 'px;background:' + f.fill + ';' + (f.clip ? 'clip-path:' + f.clip + ';' : '') + 'transform:' + f.t + '"></div>').join('') + '<div id="pieces"></div>';
  const cellDivs = {};
  vw.querySelectorAll('.f.cell').forEach((d) => { cellDivs[d.dataset.cell] = d; });
  const cam = D.table.cams[0];
  $('table').style.perspective = cam.perspective + 'px';
  let zoom = { k: 1, dx: 0, dy: 0 };
  const placeView = () => { vw.style.transform = 'translate(' + (cam.center[0] + zoom.dx) + 'px,' + (cam.center[1] + zoom.dy) + 'px) scale(' + zoom.k + ') ' + cam.matrix; };
  placeView();
  // the table follows the play: the projected picture scaled and moved so the laid tiles (and a ring round them) fill it
  function fit() {
    if ($('table').style.display === 'none') return;
    const box = () => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      laid().forEach((tl, c) => {
        if (!tl) return;
        const r = cellDivs[c].getBoundingClientRect();
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      });
      return { x0, y0, x1, y1 };
    };
    const vp = $('table').getBoundingClientRect();
    zoom = { k: 1, dx: 0, dy: 0 };
    placeView();
    let b = box();
    const k = Math.max(1, Math.min(4, 0.7 * Math.min(vp.width / (b.x1 - b.x0 + 1), vp.height / (b.y1 - b.y0 + 1))));
    zoom.k = k;
    placeView();
    b = box();
    zoom.dx = vp.left + vp.width / 2 - (b.x0 + b.x1) / 2;
    zoom.dy = vp.top + vp.height / 2 - (b.y0 + b.y1) / 2;
    placeView();
  }

  function reset() { TV.clear(); S = T.start(K); rot = 0; busy = false; log = []; turns = 0; step(); }
  function step() {
    legal = T.legal(K, S);
    render();
    if (S.over || S.side === me) return;
    busy = true;
    setTimeout(() => {
      const r = M.think(K, S, Object.assign({}, M.LEVELS[level], { seed: D.seed + turns * 31 + S.side }));
      act(r.move);
      busy = false;
      step();
    }, 380);
  }
  function act(m) {
    const who = S.side;
    if (m.type === 'tile') note(who, 'lays a tile');
    if (m.type === 'claim') note(who, 'claims a ' + K.tile.types[laidAt(S.last).t].segments[m.seg].type);
    if (m.type === 'redraw') note(who, 'sets aside a tile that fits nowhere');
    const before = S.score.slice();
    S = T.apply(K, S, m);
    turns++;
    S.score.forEach((x, s) => { if (x > before[s]) note(s, 'scores ' + (x - before[s])); });
  }
  function note(side, text) { log.push('<li><i class="sw" style="background:' + colour(side) + '"></i><b>' + K.players[side].id + '</b> ' + text + '</li>'); }
  function play(m) { if (busy || S.over || S.side !== me) return; act(m); rot = 0; step(); }
  function clickCell(c) {
    if (busy || S.over || S.side !== me || S.phase !== 'tile') return;
    const m = legal.find((x) => x.type === 'tile' && x.at === c && x.rot === rot) || legal.find((x) => x.type === 'tile' && x.at === c);
    if (m) play(m);
  }

  function render() {
    const fits = S.side === me && S.phase === 'tile' ? legal.filter((m) => m.type === 'tile' && m.rot === rot).map((m) => m.at) : [];
    // the plan: laid tiles' art, claims, where the drawn tile fits; cropped to the laid area and a ring round it
    const P = D.plan, artOut = [], marks = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const tiles = laid(), claims = standing();
    tiles.forEach((tl, c) => {
      if (!tl) return;
      const [bx, by] = P.box[c];
      x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx + P.cw); y1 = Math.max(y1, by + P.ch);
      artOut.push('<g transform="translate(' + bx + ' ' + by + ') scale(' + (P.cw / 100) + ' ' + (P.ch / 100) + ')">' + art(tl.t, tl.rot) + (c === S.last ? '<polygon points="' + pts(G0.k) + '" fill="none" stroke="#e0b84a" stroke-width="4"/>' : '') + '</g>');
    });
    for (const c of fits) { const [bx, by] = P.box[c]; marks.push('<rect x="' + (bx + 4) + '" y="' + (by + 4) + '" width="' + (P.cw - 8) + '" height="' + (P.ch - 8) + '" fill="none" stroke="#3a8f5a" stroke-width="4" rx="4"/>'); }
    for (const q of claims) {
      const tl = tiles[q.c], [ax, ay] = anchor(K.tile.types[tl.t].segments[q.s], tl.rot), [bx, by] = P.box[q.c];
      const x = bx + ax / 100 * P.cw, y = by + ay / 100 * P.ch, icon = P.icons.meeple, sc = P.cw * 0.7;
      const d = icon ? icon.map((poly) => 'M' + poly.map(([px, pz]) => (x + px * sc).toFixed(1) + ' ' + (y + (0.25 - pz) * sc).toFixed(1)).join('L') + 'Z').join('') : '';
      marks.push(d ? '<path d="' + d + '" fill="' + colour(q.side) + '" stroke="#1a1512" stroke-width="1.5"/>' : '<circle cx="' + x + '" cy="' + y + '" r="8" fill="' + colour(q.side) + '"/>');
    }
    $('art').innerHTML = artOut.join('');
    $('marks').innerHTML = marks.join('');
    const pad = P.cw * 1.5;
    $('plan-svg').setAttribute('viewBox', (x0 - pad) + ' ' + (y0 - pad) + ' ' + (x1 - x0 + 2 * pad) + ' ' + (y1 - y0 + 2 * pad));
    // the table: the laid tiles' art on their cells, the claims as bodies
    for (const k in cellDivs) {
      const tl = tiles[k], d = cellDivs[k], look = tl ? tl.t + '/' + tl.rot : '';
      if (d.dataset.look !== look) { d.dataset.look = look; d.innerHTML = tl ? tileSvg(tl.t, tl.rot) : ''; }
      d.className = 'f cell' + (fits.indexOf(+k) >= 0 ? ' fit' : '') + (+k === S.last ? ' last' : '');
    }
    const body = D.table.bodies.meeple;
    $('pieces').innerHTML = body ? claims.map((q) => {
      const tl = tiles[q.c], [ax, ay] = anchor(K.tile.types[tl.t].segments[q.s], tl.rot), a = D.table.at[q.c];
      const x = a[0] + (ax - 50) / 50 * D.table.hw, y = a[1] - (ay - 50) / 50 * D.table.hh, c = colour(q.side);
      return '<div class="pc" style="transform:translate3d(' + x + 'px,' + y + 'px,' + a[2] + 'px) scale3d(0.7,0.7,0.7)">' + body.map((f) => '<div class="f" style="width:' + f.w + 'px;height:' + f.h + 'px;background:' + shade(c, f.k) + ';' + (f.clip ? 'clip-path:' + f.clip + ';' : '') + 'transform:' + f.t + '"></div>').join('') + '</div>';
    }).join('') : '';
    panel();
    fit();
  }

  function button(text, on, enabled) { const b = document.createElement('button'); b.textContent = text; b.disabled = !enabled; b.onclick = on; return b; }
  function panel() {
    const acts = $('acts'), mine = S.side === me && !busy && !S.over;
    acts.innerHTML = '';
    $('drawn').innerHTML = S.drawn ? tileSvg(S.drawn, rot) : '';
    let prompt;
    if (S.over) prompt = S.over.winner === me ? 'You win!' : S.over.winner === null ? 'A draw' : K.players[S.over.winner].id + ' wins';
    else if (!mine) prompt = K.players[S.side].id + ' is playing…';
    else if (S.phase === 'tile') {
      const anyHere = legal.some((m) => m.type === 'tile' && m.rot === rot);
      prompt = legal[0] && legal[0].type === 'redraw' ? 'This tile fits nowhere' : anyHere ? 'Lay your tile where it is marked' : 'Turn your tile: it fits no way up like this';
      acts.appendChild(button('⟲ turn', () => { rot = (rot + 1) % n; render(); }, true));
      acts.appendChild(button('⟳ turn', () => { rot = (rot + n - 1) % n; render(); }, true));
      const red = legal.find((m) => m.type === 'redraw');
      if (red) acts.appendChild(button('Set it aside', () => play(red), true));
    } else {
      prompt = 'Claim a feature of your tile?';
      for (const m of legal.filter((x) => x.type === 'claim')) acts.appendChild(button('Claim the ' + K.tile.types[laidAt(S.last).t].segments[m.seg].type, () => play(m), true));
      acts.appendChild(button('No claim', () => play(legal.find((x) => x.type === 'skip')), true));
    }
    $('prompt').textContent = prompt;
    $('status').textContent = S.over ? prompt : S.bag.length + ' tiles left';
    TV.table({ players: K.players, me, scores: S.over && S.over.scores ? S.over.scores : S.score, live: S.side, tab: (prompt ? prompt + ' · ' : '') + S.bag.length + ' tiles left', over: S.over, again: reset });
    $('seats').innerHTML = K.players.map((p, s) => '<div class="seat' + (s === S.side ? ' now' : '') + '"><span><b style="background:' + colour(s) + '"></b>' + p.id + (s === me ? ' (you)' : '') + '</span><span>' + S.score[s] + ' pts · ' + S.stock[s] + ' in hand</span></div>').join('');
    $('log').innerHTML = log.join('');
    $('log').scrollTop = 1e6;
  }

  $('plan').addEventListener('click', (e) => { const t = e.target.closest('[data-cell]'); if (t) clickCell(Number(t.dataset.cell)); });
  vw.addEventListener('click', (e) => { const t = e.target.closest('[data-cell]'); if (t) clickCell(Number(t.dataset.cell)); });
  function showView(v) {
    $('plan').style.display = v === 'plan' ? '' : 'none';
    $('table').style.display = v === 'table' ? '' : 'none';
    $('v-plan').classList.toggle('on', v === 'plan');
    $('v-table').classList.toggle('on', v === 'table');
  }
  $('v-plan').onclick = () => showView('plan');
  $('v-table').onclick = () => { showView('table'); fit(); };
  $('level').onchange = (e) => { level = e.target.value; };
  $('again').onclick = () => reset();
  showView(D.view);
  reset();
}
