/**
 * THE EURO PAGE — a euro game (the tabletop kernel's economy) to play against the computers: the island in two views
 * (the plan in SVG, the table in CSS 3D), the corners, edges and hexes to click, the person's hand and cards, the dice,
 * the builds, the forced choices as prompts (what to give up, where the robber goes, whom to rob), the others' open
 * counts, the awards and a log. The computers play in turn, a beat apart, so their moves can be followed.
 *
 *   euroPageHtml(G, L, K, { human, level, view, seed, title }) → html   (tabletopPageHtml sends a euro game here)
 *   G.look { types: { <cell type>: colour }, resources: { <res>: colour } } the board's and the hand's colours
 */

import { latticeSvg, latticeSvgFrame } from '../polygonizer/lattice-svg.js';
import { latticeFaces, latticeCameras } from '../polygonizer/lattice-css3d.js';
import { cameraMatrixFromWorldFraming, planeMatrix } from '../scene/scene-css3d.js';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';

const VIEWPORT = { width: 760, height: 600 };
const UNIT = 70;
const LEVELS = ['easy', 'fair', 'hard'];

const r2 = (x) => Math.round(x * 100) / 100;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

export function euroPageHtml(G, L, K, opts = {}) {
  const { human, level, view, seed } = opts;
  const look = G.look ?? {};
  const fills = look.types ?? {};
  const P = K.P;

  // the plan: the board, then where each place lands on it
  const frame = latticeSvgFrame(L, { px: 64 });
  const sx = (x) => r2((x - frame.x0) * frame.px + frame.pad), sy = (y) => r2((frame.y1 - y) * frame.px + frame.pad);
  const plan = latticeSvg(L, { px: 64, names: false, ids: true, types: fills });
  const planPlaces = [];
  L.cells.forEach((c) => planPlaces.push([sx(c.at[0]), sy(c.at[1])]));
  L.corners.forEach((c) => planPlaces.push([sx(c.at[0]), sy(c.at[1])]));
  L.edges.forEach((e) => { const [a, b] = e.ends.map((k) => L.corners[k].at); planPlaces.push([sx(a[0]), sy(a[1]), sx(b[0]), sy(b[1])]); });

  // the table: faces, cameras, and a placed plane for every place (a disc on a hex, a token on a corner, a bar on an edge)
  const cams = latticeCameras(L).map((c) => {
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(c.worldFraming, VIEWPORT, UNIT);
    return { name: c.name, matrix, perspective: r2(perspective), center };
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const faces = latticeFaces(L, { types: fills }).map((f) => {
    const c = f.corners, u = sub(c[1], c[0]), v = sub(c[3], c[0]);
    const cell = f.group.startsWith('cell:') ? P.byName.get(f.group.slice(5)) : -1;
    return { cell, w: r2(Math.hypot(...u) * UNIT), h: r2(Math.hypot(...v) * UNIT), fill: f.fill, clip: f.clip ?? null, t: planeMatrix(c[0], u, v, UNIT) };
  });
  const flat = (centre, side, lift) => planeMatrix([centre[0] - side / 2, centre[1] + side / 2, centre[2] + lift], [1, 0, 0], [0, -1, 0], UNIT);
  const sizes = { cell: 0.4 * L.cell, corner: 0.3 * L.cell, edge: [0.6 * L.cell, 0.09 * L.cell] };
  const tablePlaces = [];
  L.cells.forEach((c) => tablePlaces.push(flat(c.at, sizes.cell, 0.004)));
  L.corners.forEach((c) => tablePlaces.push(flat(c.at, sizes.corner, 0.01)));
  L.edges.forEach((e) => {
    const [a, b] = e.ends.map((k) => L.corners[k].at), d = sub(b, a), len = Math.hypot(d[0], d[1]);
    const u = [d[0] / len, d[1] / len, 0], v = [u[1], -u[0], 0], [lw, lh] = sizes.edge;
    const o = [e.at[0] - u[0] * lw / 2 - v[0] * lh / 2, e.at[1] - u[1] * lw / 2 - v[1] * lh / 2, e.at[2] + 0.008];
    tablePlaces.push(planeMatrix(o, u, v, UNIT));
  });

  const data = {
    L: { ...L }, G, human, level, seed, view,
    plan: { W: r2(frame.W), H: r2(frame.H), places: planPlaces, r: r2(frame.px * L.cell * 0.17) },
    table: { cams, faces, places: tablePlaces, size: { cell: r2(sizes.cell * UNIT), corner: r2(sizes.corner * UNIT), edge: sizes.edge.map((x) => r2(x * UNIT)) } },
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
  #status{margin-left:auto;font-weight:600}
  main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start}
  #boards{flex:1 1 520px;min-width:0;display:flex;justify-content:center}
  #plan svg{max-width:100%;height:auto;display:block}
  #plan [data-place]{cursor:pointer}
  #marks,#pieces{pointer-events:none}
  #targets circle,#targets line{cursor:pointer}
  .viewport{position:relative;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;max-width:100%;overflow:hidden;border-radius:10px;background:#1b3a52}
  .view{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:0 0}
  .f,.p,.g{position:absolute;left:0;top:0;transform-origin:0 0}
  .f.cell{cursor:pointer}
  .p{display:flex;align-items:center;justify-content:center;pointer-events:none;font-weight:700}
  .p.num{border-radius:50%;background:#f3ead2;color:#2b2622;box-shadow:0 0 0 1.5px #5b4632 inset}
  .p.num.hot{color:#c4362a}
  .p.rob{border-radius:50%;background:#2a2420;color:#efe9dc}
  .p.bld{border-radius:4px;box-shadow:0 0 0 2px #1a1512 inset}
  .p.road{border-radius:3px;box-shadow:0 0 0 1px #1a1512 inset}
  .g{cursor:pointer;border-radius:50%;background:rgba(58,143,90,.85);box-shadow:0 0 0 2px #fff inset}
  .g.edge{border-radius:3px}
  .f.cell.tg{box-shadow:inset 0 0 0 5px rgba(210,69,47,.9)}
  aside{flex:0 1 300px;display:flex;flex-direction:column;gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
  .card h2{font-size:13px;margin:0 0 8px;color:var(--mute);font-weight:600}
  .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:2px 10px 2px 4px;font-variant-numeric:tabular-nums}
  .chip i{width:14px;height:14px;border-radius:50%;display:inline-block}
  #prompt{font-weight:600;min-height:1.4em}
  .seat{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}
  .seat:last-child{border-bottom:0}
  .seat b{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;box-shadow:0 0 0 1px #1a1512 inset}
  .seat.now{font-weight:600}
  #log{margin:0;padding-left:34px;max-height:220px;overflow:auto;font-size:13px}
  .sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;box-shadow:0 0 0 1px #1a1512 inset}
  #dice{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  @media (max-width:600px){aside{flex-basis:100%}}
</style></head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <button id="v-plan">Plan</button><button id="v-table">Table</button>
  <select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button id="again">New game</button>
  <span id="status"></span>
</header>
<main>
  <div id="boards">
    <div id="plan"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.plan.W} ${data.plan.H}" width="${data.plan.W}" height="${data.plan.H}">${plan.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}<g id="marks"></g><g id="pieces"></g><g id="targets"></g></svg></div>
    <div id="table" class="viewport"><div class="view" id="view"></div></div>
  </div>
  <aside>
    <div class="card"><div class="row" style="justify-content:space-between"><span id="prompt"></span><span id="dice"></span></div><div class="row" id="acts" style="margin-top:8px"></div></div>
    <div class="card"><h2>Your hand</h2><div class="row" id="hand"></div><h2 style="margin-top:10px">Your cards</h2><div class="row" id="cards"></div></div>
    <div class="card"><h2>Table</h2><div id="seats"></div></div>
    <div class="card"><h2>Log</h2><ol id="log"></ol></div>
  </aside>
</main>
<script>
const DATA = ${scriptJson(data)};
const T = (${buildTabletop.toString()})();
const M = (${buildTabletopMind.toString()})(T);
(${tabletopEuroClient.toString()})(DATA, T, M);
</script>
</body></html>
`;
}

/* The euro page's own code: runs in the browser, references only its arguments and the DOM. */
export function tabletopEuroClient(D, T, M) {
  const $ = (id) => document.getElementById(id);
  const K = T.compile(D.L, D.G), me = K.sideOf[D.human], P = K.P, look = D.G.look || {};
  const resColour = (r) => (look.resources && look.resources[r]) || '#999';
  const colour = (s) => D.G.players[s].colour || '#888';
  const sortOf = (p) => (p < P.nC ? 'cell' : p < P.nC + P.nK ? 'corner' : 'edge');
  const cardName = (c) => (D.G.cards && D.G.cards[c] && D.G.cards[c].name) || c;
  let S, legal, mode = null, busy = false, level = D.level, n = 0, log = [];

  // the table: faces once; pieces and targets drawn each time
  const vw = $('view');
  vw.innerHTML = D.table.faces.map((f) => '<div class="f' + (f.cell >= 0 ? ' cell' : '') + '"' + (f.cell >= 0 ? ' data-place="' + f.cell + '"' : '')
    + ' style="width:' + f.w + 'px;height:' + f.h + 'px;background:' + f.fill + ';' + (f.clip ? 'clip-path:' + f.clip + ';' : '') + 'transform:' + f.t + '"></div>').join('')
    + '<div id="tpieces"></div><div id="ttargets"></div>';
  const cellDivs = {};
  vw.querySelectorAll('.f.cell').forEach((d) => { cellDivs[d.dataset.place] = d; });
  const c0 = D.table.cams[0];
  $('table').style.perspective = c0.perspective + 'px';
  vw.style.transform = 'translate(' + c0.center[0] + 'px,' + c0.center[1] + 'px) ' + c0.matrix;
  // a piece's or target's div on the table
  const tdiv = (p, cls, inner, bg, extra) => {
    const s = sortOf(p), z = D.table.size, wh = s === 'edge' ? z.edge : [z[s], z[s]];
    return '<div class="' + cls + '"' + (extra || '') + ' style="width:' + wh[0] + 'px;height:' + wh[1] + 'px;' + (bg ? 'background:' + bg + ';' : '') + 'font-size:' + (wh[1] * 0.55) + 'px;transform:' + D.table.places[p] + '">' + (inner || '') + '</div>';
  };

  function reset() { S = T.start(K); mode = null; busy = false; n = 0; log = []; step(); }
  function step() {
    legal = T.legal(K, S);
    render();
    if (S.over) return;
    if (T.actor(S) !== me) {
      busy = true;
      setTimeout(() => {
        const a = T.actor(S), r = M.think(K, S, Object.assign({}, M.LEVELS[level], { seed: D.seed + a * 7919 + n }));
        note(a, r.move);
        S = T.apply(K, S, r.move); n++;
        busy = false;
        step();
      }, r_delay());
    }
  }
  function r_delay() { return S.phase === 'opening' ? 260 : 420; }
  function note(side, m) {
    if (m.type === 'end') return;
    log.push('<li><i class="sw" style="background:' + colour(side) + '"></i><b>' + K.players[side].id + '</b> ' + label(m) + '</li>');
  }
  function label(m) {
    if (m.type === 'build') return 'builds a ' + m.kind;
    if (m.type === 'roll') return 'rolls';
    if (m.type === 'play') return 'plays ' + cardName(m.card);
    if (m.type === 'buy') return 'buys a card';
    if (m.type === 'robber') return 'moves the robber';
    if (m.type === 'steal') return 'robs ' + K.players[m.from].id;
    if (m.type === 'discard') return 'gives up a card';
    return m.name;
  }
  function play(m) {
    if (busy) return;
    note(me, m);
    if (m.type === 'roll') { S = T.apply(K, S, m); n++; log[log.length - 1] = log[log.length - 1].replace('rolls', 'rolls ' + S.roll); }
    else { S = T.apply(K, S, m); n++; }
    mode = null;
    step();
  }
  // the moves that take a place now: the pending decision's, or the chosen build's
  function placeMoves() {
    const mine = T.actor(S) === me && !busy;
    if (!mine) return [];
    if (S.pending.length) return legal.filter((m) => m.at !== undefined);
    if (mode) return legal.filter((m) => m.type === 'build' && m.kind === mode);
    return [];
  }

  function render() {
    const PL = D.plan, places = placeMoves(), targetSet = {};
    for (const m of places) targetSet[m.at] = m;
    // ── plan: numbers, pieces, targets
    const marks = [];
    for (let c = 0; c < P.nC; c++) {
      const v = P.num[c];
      if (v === null) continue;
      const [x, y] = PL.places[c], hot = v === 6 || v === 8;
      marks.push('<circle cx="' + x + '" cy="' + y + '" r="' + PL.r + '" fill="#f3ead2" stroke="#5b4632"/><text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="central" font-size="' + (PL.r * 1.05) + '" font-weight="700" fill="' + (hot ? '#c4362a' : '#2b2622') + '">' + v + '</text>');
    }
    $('marks').innerHTML = marks.join('');
    const pcs = [];
    for (const x of S.pieces) {
      if (x.at < 0) continue;
      const q = PL.places[x.at], c = x.side >= 0 ? colour(x.side) : '#2a2420';
      if (sortOf(x.at) === 'edge') pcs.push('<line x1="' + q[0] + '" y1="' + q[1] + '" x2="' + q[2] + '" y2="' + q[3] + '" stroke="#1a1512" stroke-width="' + (PL.r * 0.75) + '" stroke-linecap="round"/><line x1="' + q[0] + '" y1="' + q[1] + '" x2="' + q[2] + '" y2="' + q[3] + '" stroke="' + c + '" stroke-width="' + (PL.r * 0.5) + '" stroke-linecap="round"/>');
      else if (x.kind === 'robber' || sortOf(x.at) === 'cell') pcs.push('<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (PL.r * 1.1) + '" fill="#2a2420" stroke="#efe9dc" stroke-width="2"/><text x="' + q[0] + '" y="' + q[1] + '" text-anchor="middle" dominant-baseline="central" fill="#efe9dc" font-size="' + PL.r + '">♟</text>');
      else {
        const big = x.kind === 'city', s = PL.r * (big ? 0.95 : 0.7);
        pcs.push('<rect x="' + (q[0] - s) + '" y="' + (q[1] - s) + '" width="' + (2 * s) + '" height="' + (2 * s) + '" rx="' + (big ? 2 : s * 0.4) + '" fill="' + c + '" stroke="#1a1512" stroke-width="2"/>' + (big ? '<text x="' + q[0] + '" y="' + q[1] + '" text-anchor="middle" dominant-baseline="central" font-size="' + s + '">♜</text>' : ''));
      }
    }
    $('pieces').innerHTML = pcs.join('');
    const tg = [];
    for (const m of places) {
      const q = PL.places[m.at], s = sortOf(m.at);
      if (s === 'edge') tg.push('<line data-place="' + m.at + '" x1="' + q[0] + '" y1="' + q[1] + '" x2="' + q[2] + '" y2="' + q[3] + '" stroke="#3a8f5a" stroke-opacity=".8" stroke-width="' + (PL.r * 0.6) + '" stroke-linecap="round"/>');
      else tg.push('<circle data-place="' + m.at + '" cx="' + q[0] + '" cy="' + q[1] + '" r="' + (PL.r * (s === 'cell' ? 1.3 : 0.6)) + '" fill="#3a8f5a" fill-opacity=".75" stroke="#fff" stroke-width="2"/>');
    }
    $('targets').innerHTML = tg.join('');
    // ── table
    const tp = [];
    for (let c = 0; c < P.nC; c++) if (P.num[c] !== null) tp.push(tdiv(c, 'p num' + (P.num[c] === 6 || P.num[c] === 8 ? ' hot' : ''), String(P.num[c])));
    for (const x of S.pieces) {
      if (x.at < 0) continue;
      const s = sortOf(x.at);
      if (s === 'cell') tp.push(tdiv(x.at, 'p rob', '♟'));
      else if (s === 'edge') tp.push(tdiv(x.at, 'p road', '', colour(x.side)));
      else tp.push(tdiv(x.at, 'p bld', x.kind === 'city' ? '♜' : '', colour(x.side)));
    }
    $('tpieces').innerHTML = tp.join('');
    for (const k in cellDivs) cellDivs[k].classList.remove('tg');
    $('ttargets').innerHTML = places.filter((m) => sortOf(m.at) !== 'cell').map((m) => tdiv(m.at, 'g' + (sortOf(m.at) === 'edge' ? ' edge' : ''), '', '', ' data-place="' + m.at + '"')).join('');
    for (const m of places) if (sortOf(m.at) === 'cell') cellDivs[m.at].classList.add('tg');
    panel();
  }

  function button(text, on, enabled, active) {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = !enabled;
    if (active) b.classList.add('on');
    b.onclick = on;
    return b;
  }
  function panel() {
    const acts = $('acts');
    acts.innerHTML = '';
    const mine = T.actor(S) === me && !busy && !S.over;
    let prompt = '';
    if (S.over) prompt = S.over.winner === me ? 'You win!' : S.over.winner === null ? 'A draw' : K.players[S.over.winner].id + ' wins';
    else if (!mine) prompt = K.players[T.actor(S)].id + ' is playing…';
    else if (S.pending.length) {
      const d = S.pending[0];
      prompt = { place: 'Place a ' + d.kind, free: 'Place a free ' + d.kind, discard: 'Give up ' + d.n + ' more', robber: 'Move the robber', steal: 'Rob a player', gain: 'Take ' + d.n + ' from the bank', claim: 'Name a resource to claim' }[d.do] || d.do;
      for (const m of legal) {
        if (m.res) acts.appendChild(button(m.res, () => play(m), true));
        if (m.type === 'steal') acts.appendChild(button(K.players[m.from].id, () => play(m), true));
      }
    } else if (S.phase === 'roll') {
      prompt = 'Your turn';
      acts.appendChild(button('Roll', () => play(legal.find((m) => m.type === 'roll')), true));
    } else {
      prompt = mode ? 'Choose where to build the ' + mode : 'Build, buy or end your turn';
      for (const kind of Object.keys(K.G.build || {})) {
        const any = legal.some((m) => m.type === 'build' && m.kind === kind);
        acts.appendChild(button(kind, () => { mode = mode === kind ? null : kind; render(); }, any, mode === kind));
      }
      const buy = legal.find((m) => m.type === 'buy');
      acts.appendChild(button('Buy card', () => play(buy), !!buy));
      for (const m of legal.filter((x) => x.type === 'exchange')) acts.appendChild(button(m.give + ' → ' + m.get, () => play(m), true));
      acts.appendChild(button('End turn', () => play(legal.find((m) => m.type === 'end')), true));
    }
    $('prompt').textContent = prompt;
    $('status').textContent = S.over ? prompt : 'Turn ' + (S.turn + 1);
    $('dice').textContent = S.roll ? 'rolled ' + S.roll : '';
    // the hand and the cards
    $('hand').innerHTML = K.res.map((r) => '<span class="chip"><i style="background:' + resColour(r) + '"></i>' + r + ' ' + S.hand[me][r] + '</span>').join('');
    const cards = $('cards');
    cards.innerHTML = '';
    const held = S.cards[me];
    if (!Object.keys(held).length) cards.textContent = 'none';
    for (const c of Object.keys(held)) {
      const m = legal.find((x) => x.type === 'play' && x.card === c);
      if (m && mine) cards.appendChild(button(cardName(c) + ' ×' + held[c], () => play(m), true));
      else { const s = document.createElement('span'); s.className = 'chip'; s.textContent = cardName(c) + ' ×' + held[c]; cards.appendChild(s); }
    }
    // the seats
    const awards = (K.G.score && K.G.score.awards) || {};
    $('seats').innerHTML = K.players.map((p, s) => {
      const hand = K.res.reduce((a, r) => a + S.hand[s][r], 0), dev = Object.values(S.cards[s]).reduce((a, b) => a + b, 0);
      const won = Object.keys(awards).filter((id) => S.awards[id] === s).map((id) => awards[id].name || id).join(', ');
      return '<div class="seat' + (s === S.side ? ' now' : '') + '"><span><b style="background:' + colour(s) + '"></b>' + p.id + (s === me ? ' (you)' : '') + '</span><span>' + T.score(K, S, s, s !== me) + ' pts · ' + hand + ' cards · ' + dev + ' dev' + (won ? ' · ' + won : '') + '</span></div>';
    }).join('');
    $('log').innerHTML = log.join('');
    $('log').scrollTop = 1e6;
  }

  function clickPlace(p) {
    const m = placeMoves().find((x) => x.at === p);
    if (m) play(m);
  }
  $('plan').addEventListener('click', (e) => { const t = e.target.closest('[data-place],[data-cell]'); if (t) clickPlace(Number(t.dataset.place !== undefined ? t.dataset.place : t.dataset.cell)); });
  vw.addEventListener('click', (e) => { const t = e.target.closest('[data-place]'); if (t) clickPlace(Number(t.dataset.place)); });
  function showView(v) {
    $('plan').style.display = v === 'plan' ? '' : 'none';
    $('table').style.display = v === 'table' ? '' : 'none';
    $('v-plan').classList.toggle('on', v === 'plan');
    $('v-table').classList.toggle('on', v === 'table');
  }
  $('v-plan').onclick = () => showView('plan');
  $('v-table').onclick = () => showView('table');
  $('level').onchange = (e) => { level = e.target.value; };
  $('again').onclick = () => reset();
  showView(D.view);
  reset();
}
