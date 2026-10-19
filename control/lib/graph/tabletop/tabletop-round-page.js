/**
 * THE ROUND PAGE — a round game (the tabletop kernel's rounds) against the computers, on a flat table: the spaces with
 * the workers on them, lit where one may go; the lot up for bids and the bids to make; the hand to pick from; each
 * seat's pools, workers and tableau; every seat's points as the game scores them now and its utilization (the share of
 * what it could spend that it spent); a log. A sealed choice shows only that it was made, until all are revealed. A
 * game of turns (a duel) adds each seat's field (summons with their power and guard, damage taken, exhausted ones
 * turned), the chain top first, the cards it can cast and the abilities it can use lit (a choice of targets as
 * buttons), and a window's question: answer, or pass.
 *
 *   roundPageHtml(G, L, K, { human, level, seed, title }) → html   (tabletopPageHtml sends a round game here)
 */

import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { shapeIcon } from './tabletop-shapes.js';

const LEVELS = ['easy', 'fair', 'hard'];

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
const r2 = (x) => Math.round(x * 100) / 100;

// a worker's side silhouette as an SVG path in a 0–24 box, from its shape (none: a disc)
function workerIcon(G) {
  const kind = G.round.workers && G.round.workers.kind, shape = kind && G.pieces[kind] && G.pieces[kind].shape;
  if (shape === undefined) return null;
  const icon = shapeIcon(shape), pts = icon.flat(), xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), z1 = Math.max(...zs), span = Math.max(Math.max(...xs) - x0, z1 - Math.min(...zs)) || 1, k = 22 / span;
  return icon.map((poly) => 'M' + poly.map(([x, z]) => r2(1 + (x - x0) * k) + ' ' + r2(1 + (z1 - z) * k)).join('L') + 'Z').join('');
}

export function roundPageHtml(G, L, K, opts = {}) {
  const { human, level, seed } = opts;
  const data = { L, G, human, level, seed, icon: workerIcon(G) };
  const title = opts.title ?? G.title ?? 'mojulo round game';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:light dark;--bg:#f4f1ea;--ink:#2b2622;--mute:#7a6f63;--line:#d8cfc0;--panel:#fffdf8;--felt:#3b4a37}
  @media (prefers-color-scheme:dark){:root{--bg:#17191d;--ink:#e9e3d8;--mute:#9a9183;--line:#33363c;--panel:#1f2227;--felt:#26302a}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
  header{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
  header h1{font-size:16px;margin:0 8px 0 0}
  button,select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
  button:disabled{opacity:.4;cursor:default}
  #status{margin-left:auto;font-weight:600}
  main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start}
  #felt{flex:1 1 560px;min-width:0;background:var(--felt);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:12px;color:#efe9dc}
  .zone h2{font-size:12px;margin:0 0 6px;font-weight:600;color:#cfc6b5;text-transform:uppercase;letter-spacing:.04em}
  .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .sp{position:relative;width:132px;min-height:96px;border-radius:8px;background:#fbf7ee;color:#2b2622;padding:6px 8px;box-shadow:0 2px 0 rgba(0,0,0,.35);font-size:12px}
  .sp b{display:block;text-transform:capitalize;font-size:13px}
  .sp .cost{color:#9a4b2f}
  .sp .gv{color:#4a4036}
  .sp .slots{display:flex;gap:4px;margin-top:6px}
  .sp .slot{width:24px;height:24px;border-radius:5px;background:#e8e0cf;display:flex;align-items:center;justify-content:center}
  .sp.go{cursor:pointer;box-shadow:0 0 0 3px #6fcf8f,0 2px 0 rgba(0,0,0,.35)}
  .sp.go:hover{transform:translateY(-2px)}
  .c{position:relative;width:88px;height:120px;border-radius:8px;background:#fbf7ee;color:#2b2622;box-shadow:0 2px 0 rgba(0,0,0,.35);overflow:hidden;font-size:12px;flex:none}
  .c .band{height:10px}
  .c .nm{font-weight:700;padding:4px 6px 0;text-transform:capitalize}
  .c .fx{padding:2px 6px;color:#4a4036}
  .c .tg{position:absolute;left:6px;right:6px;bottom:6px;color:#7a6f63;font-size:11px}
  .c .n{position:absolute;right:5px;top:14px;background:#2b2622;color:#fbf7ee;border-radius:9px;padding:0 6px;font-size:11px;font-weight:700}
  .c.small{width:58px;height:80px;font-size:10px}
  .c.small .tg,.c.small .fx{display:none}
  .c.go{cursor:pointer;box-shadow:0 0 0 3px #6fcf8f,0 2px 0 rgba(0,0,0,.35)}
  .c.go:hover{transform:translateY(-3px)}
  .c.spent{opacity:.6;transform:rotate(-7deg)}
  .c.picked{box-shadow:0 0 0 3px #e0b84a,0 2px 0 rgba(0,0,0,.35)}
  .c .cc{position:absolute;right:5px;top:13px;min-width:18px;height:18px;border-radius:9px;background:#5a7ac4;color:#fff;font-weight:700;text-align:center;line-height:18px;font-size:11px;padding:0 4px}
  .c .st{position:absolute;right:5px;bottom:5px;font-weight:700;background:#2b2622;color:#fbf7ee;border-radius:8px;padding:0 6px;font-size:12px}
  .c .st.hurt{background:#c4362a}
  .c .fx{font-size:11px;line-height:1.25;max-height:62px;overflow:hidden}
  #chain{display:flex;flex-direction:column;gap:4px}
  .link{background:rgba(255,255,255,.12);border-radius:6px;padding:3px 8px;font-size:13px}
  .link:first-child{background:rgba(224,184,74,.3)}
  .chip{display:inline-block;background:rgba(255,255,255,.14);border-radius:10px;padding:0 8px;margin:0 4px 2px 0;font-size:12px}
  .seatrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px}
  .seatrow .who{display:flex;align-items:center;gap:6px;font-weight:600;min-width:90px}
  .sealed{font-size:12px;color:#e8d79a}
  aside{flex:0 1 280px;display:flex;flex-direction:column;gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
  .card h2{font-size:13px;margin:0 0 8px;color:var(--mute);font-weight:600}
  #prompt{font-weight:600;min-height:1.4em}
  #acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .seat{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}
  .seat:last-child{border-bottom:0}
  .seat.now{font-weight:600}
  .seat small{color:var(--mute);font-weight:400}
  .sw{display:inline-block;width:10px;height:10px;border-radius:2px;box-shadow:0 0 0 1px #1a1512 inset}
  #log{margin:0;padding-left:34px;max-height:260px;overflow:auto;font-size:13px}
  @media (max-width:600px){aside{flex-basis:100%}}
</style></head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button id="again">New game</button>
  <span id="status"></span>
</header>
<main>
  <div id="felt">
    <div class="zone" id="others"></div>
    <div class="zone" id="spaces-zone"><h2>Spaces</h2><div class="row" id="spaces"></div></div>
    <div class="zone" id="lot-zone"><h2>Up for bids</h2><div class="row" id="lot"></div></div>
    <div class="zone" id="chain-zone"><h2>The chain (top first)</h2><div id="chain"></div></div>
    <div class="zone" id="field-zone"><h2>Your field</h2><div class="row" id="field"></div></div>
    <div class="zone" id="hand-zone"><h2>Your hand</h2><div class="row" id="hand"></div></div>
    <div class="zone" id="tableau-zone"><h2>Your tableau</h2><div class="row" id="tableau"></div></div>
    <div class="zone" id="mine"></div>
  </div>
  <aside>
    <div class="card"><div id="prompt"></div><div id="acts"></div></div>
    <div class="card"><h2 id="seats-h">Points</h2><div id="seats"></div></div>
    <div class="card"><h2>Log</h2><ol id="log"></ol></div>
  </aside>
</main>
<script>
const DATA = ${scriptJson(data)};
const T = (${buildTabletop.toString()})();
const M = (${buildTabletopMind.toString()})(T);
(${tabletopRoundClient.toString()})(DATA, T, M);
</script>
</body></html>
`;
}

/* The round page's own code: runs in the browser, references only its arguments and the DOM. */
export function tabletopRoundClient(D, T, M) {
  const $ = (id) => document.getElementById(id);
  const K = T.compile(D.L, D.G), R = D.G.round, me = K.sideOf[D.human], wkind = R.workers && R.workers.kind;
  const colour = (s) => D.G.players[s].colour || '#888';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = (s) => K.players[s].id;
  let S, legal, busy = false, level = D.level, log = [], turns = 0, choosing = null;
  const duel = !!R.turn, L0 = R.lose && R.lose.pool;

  const pool = (o) => Object.keys(o || {}).filter((r) => o[r]).map((r) => o[r] + ' ' + r).join(', ');
  function gives(list) {
    const out = [];
    for (const e of list || []) {
      if (e.get) out.push('get ' + pool(e.get));
      if (e.points) out.push('+' + e.points + ' points');
      if (e.worker) out.push('a worker');
      if (e.first) out.push('first seat');
      if (e.card) out.push(e.card + ' card' + (e.card > 1 ? 's' : ''));
    }
    return out.join(', ');
  }
  const meeple = (s) => D.icon
    ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="' + D.icon + '" fill="' + colour(s) + '" stroke="#1a1512" stroke-width="1"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="' + colour(s) + '" stroke="#1a1512"/></svg>';
  // what a duel card does, in words, from its effects and abilities
  function effectText(list) {
    return (list || []).map((e) => {
      const to = e.to === 'target' ? (e.of === 'summon' ? 'a summon' : e.of === 'foe-summon' ? 'a foe summon' : e.of === 'player' ? 'a player' : 'any') : e.to === 'foe' ? 'foe' : e.to === 'self' ? 'you' : e.to === 'foe-summons' ? 'foe summons' : '';
      if (e.damage !== undefined) return (e.damage === 'power' ? 'power' : e.damage) + ' dmg → ' + to;
      if (e.destroy) return 'destroy ' + to;
      if (e.exhaust) return 'exhaust ' + to;
      if (e.draw) return 'draw ' + e.draw;
      if (e.get) return 'gain ' + pool(e.get);
      if (e.counter) return 'cancel a spell';
      return '';
    }).filter(Boolean).join(', ');
  }
  function duelText(t) {
    const out = [];
    if (t.fast) out.push('fast');
    if (t.do) out.push(effectText(t.do));
    for (const ab of t.abilities || []) {
      if (ab.act) out.push((ab.act.exhaust ? '⟳' : 'use') + (ab.fast ? ' fast' : '') + ': ' + effectText(ab.do));
      else out.push({ enters: 'enters', dies: 'dies', turn: 'turn start', 'foe-casts': 'foe casts' }[ab.when] + ': ' + effectText(ab.do));
    }
    return out.join('; ');
  }
  function cardHtml(id, o) {
    o = o || {};
    const t = T.derive(K, S, id), tags = t.tags || {}, ob = S.pieces[id];
    const fx = duel ? duelText(t) : [t.points ? t.points + ' point' + (t.points > 1 ? 's' : '') : ''].filter(Boolean).join(', ');
    const st = t.stats && t.stats.guard !== undefined ? '<div class="st' + (ob.damage ? ' hurt' : '') + '">' + (t.stats.power || 0) + '/' + (t.stats.guard - (ob.zone === 'field' ? ob.damage || 0 : 0)) + '</div>' : '';
    const cost = duel && t.cost ? '<div class="cc">' + Object.values(t.cost).reduce((a, b) => a + b, 0) + '</div>' : '';
    return '<div class="c' + (o.small ? ' small' : '') + (o.go ? ' go' : '') + (ob.zone === 'field' && ob.ready === false ? ' spent' : '') + (o.picked ? ' picked' : '') + '"' + (o.data ? ' ' + o.data : '') + ' title="' + esc((t.name || t.kind) + (fx ? ': ' + fx : '')) + '">'
      + '<div class="band" style="background:' + (t.colour || '#b9ad98') + '"></div><div class="nm">' + esc(t.name || t.kind) + '</div>' + cost
      + (fx ? '<div class="fx">' + esc(fx) + '</div>' : '')
      + (Object.keys(tags).length ? '<div class="tg">' + esc(Object.keys(tags).map((k) => k + ' ' + tags[k]).join(' · ')) + '</div>' : '')
      + st + (o.n > 1 ? '<div class="n">' + o.n + '</div>' : '') + '</div>';
  }
  const targetName = (t) => (t.p !== undefined ? name(t.p) : (S.pieces[t.o] ? (K.defs[S.pieces[t.o].kind].name || S.pieces[t.o].kind) : '?'));
  function linkText(l) {
    const src = S.pieces[l.src], what = K.defs[src.kind].name || src.kind;
    return name(l.side) + ': ' + what + (l.card ? '' : l.trigger ? ' (trigger)' : ' (ability)') + (l.target ? ' → ' + targetName(l.target) : '');
  }
  // a tableau shown once a kind, counted
  const stack = (ids) => { const by = {}, first = {}; for (const id of ids) { const k = S.pieces[id].kind; by[k] = (by[k] || 0) + 1; if (first[k] === undefined) first[k] = id; } return Object.keys(by).sort().map((k) => [first[k], by[k]]); };
  const crew = (s) => S.pieces.filter((o) => o.side === s && o.kind === wkind && (o.zone === 'home' || o.zone === 'space'));
  // past the last phase once the game is over: the last one stands
  const phase = () => T.phaseNow(K, S) || (R.phases || R.turn)[(R.phases || R.turn).length - 1];

  function reset() { S = T.start(K); busy = false; log = []; turns = 0; choosing = null; step(); }
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
    }, 320);
  }
  function act(m) {
    const who = S.side, before = S, P = phase();
    S = T.apply(K, S, m);
    turns++;
    if (m.type === 'place') note(who, 'sends a worker to ' + (R.spaces[m.space].name || m.space));
    if (m.type === 'pass' && !duel) note(who, 'keeps its workers home');
    if (duel) {
      if (m.type === 'cast') note(who, 'casts ' + (K.defs[m.card].name || m.card) + (m.target ? ' → ' + targetName(m.target) : ''));
      if (m.type === 'use') note(who, 'uses ' + (K.defs[before.pieces[m.id].kind].name || before.pieces[m.id].kind) + (m.target ? ' → ' + targetName(m.target) : ''));
      if (m.type === 'pass') note(who, 'lets it resolve');
      before.zones.forEach((Z, s) => { for (const id of Z.field) if (S.pieces[id].zone !== 'field') note(-1, name(s) + '\'s ' + (K.defs[S.pieces[id].kind].name || S.pieces[id].kind) + ' dies'); });
      if (L0) S.pools.forEach((p, s) => { const d = p[L0] - before.pools[s][L0]; if (d) note(-1, name(s) + ' ' + (d > 0 ? '+' : '') + d + ' ' + L0); });
    }
    if ((m.type === 'bid' || m.type === 'pick') && before.sealed.filter((c) => c === null).length === 1) {
      // the last sealed choice: all revealed
      const chose = before.sealed.map((c, s) => (s === who ? (m.type === 'bid' ? { n: m.n } : { card: m.card }) : c));
      if (P.move === 'bid') {
        const lot = T.derive(K, before, before.lots[0]), won = S.zones.findIndex((Z, s) => Z.tableau.length > before.zones[s].tableau.length);
        note(-1, 'bids: ' + chose.map((c, s) => (c ? name(s) + ' ' + c.n : '')).filter(Boolean).join(', ') + ' → ' + (won >= 0 ? name(won) + ' takes ' + (lot.name || lot.kind) : 'nobody takes ' + (lot.name || lot.kind)));
      } else note(-1, 'picks: ' + chose.map((c, s) => (c ? name(s) + ' ' + (K.defs[c.card].name || c.card) : '')).filter(Boolean).join(', '));
    } else if (m.type === 'bid' || m.type === 'pick') note(who, (m.type === 'bid' ? 'bids' : 'picks') + ', sealed');
    if (S.round > before.round && !S.over) note(-1, 'round ' + (S.round + 1));
  }
  function note(side, text) { log.push('<li>' + (side >= 0 ? '<i class="sw" style="background:' + colour(side) + '"></i> <b>' + esc(name(side)) + '</b> ' : '') + esc(text) + '</li>'); }
  const mine = () => !busy && !S.over && S.side === me;
  function play(m) { if (!mine() || !m) return; act(m); step(); }

  function render() {
    const go = mine(), P = phase(), Z = S.zones[me];
    // the other seats: pools, workers, tableau; whether a sealed choice was made, never what
    $('others').innerHTML = K.players.map((p, s) => {
      if (s === me) return '';
      const w = crew(s), Y = S.zones[s];
      return '<div class="seatrow"><span class="who"><i class="sw" style="background:' + colour(s) + '"></i>' + esc(p.id) + (S.first === s ? ' ★' : '') + '</span>'
        + Object.keys(S.pools[s]).map((r) => '<span class="chip">' + r + ' ' + S.pools[s][r] + '</span>').join('')
        + (wkind ? '<span class="chip">workers ' + w.filter((o) => o.zone === 'home' && o.ready !== false).length + '/' + w.length + '</span>' : '')
        + (Y.hand.length ? '<span class="chip">hand ' + Y.hand.length + '</span>' : '')
        + (S.sealed[s] !== null && S.sealed[s] !== undefined ? '<span class="sealed">has chosen</span>' : '')
        + (Y.tableau.length ? '<span class="row">' + stack(Y.tableau).map(([id, n]) => cardHtml(id, { small: true, n })).join('') + '</span>' : '')
        + (duel && Y.field.length ? '<span class="row">' + Y.field.map((id) => cardHtml(id, { small: true })).join('') + '</span>' : '')
        + '</div>';
    }).join('');
    // a duel's chain, the person's field and what it can do there
    $('chain-zone').style.display = duel && S.links.length ? '' : 'none';
    if (duel) $('chain').innerHTML = S.links.slice().reverse().map((l) => '<div class="link">' + esc(linkText(l)) + '</div>').join('');
    $('field-zone').style.display = duel ? '' : 'none';
    if (duel) $('field').innerHTML = Z.field.map((id) => cardHtml(id, { go: go && legal.some((m) => m.type === 'use' && m.id === id), picked: choosing && choosing[0].id === id, data: 'data-obj="' + id + '"' })).join('');
    // the spaces: their workers, lit where one of the person's may go
    const sp = R.spaces || {};
    $('spaces-zone').style.display = Object.keys(sp).length ? '' : 'none';
    $('spaces').innerHTML = Object.keys(sp).map((id) => {
      const q = sp[id], on = S.pieces.filter((o) => o.zone === 'space' && o.space === id), m = legal.find((x) => x.type === 'place' && x.space === id);
      const slots = [];
      for (let i = 0; i < (q.holds || 1); i++) slots.push('<span class="slot">' + (on[i] ? meeple(on[i].side) : '') + '</span>');
      return '<div class="sp' + (go && m ? ' go' : '') + '" data-space="' + id + '"><b>' + esc(q.name || id) + '</b>'
        + (q.cost ? '<div class="cost">pay ' + esc(pool(q.cost)) + '</div>' : '') + '<div class="gv">' + esc(gives(q.gives)) + '</div><div class="slots">' + slots.join('') + '</div></div>';
    }).join('');
    // the lot, the hand
    $('lot-zone').style.display = P.move === 'bid' && S.lots.length ? '' : 'none';
    $('lot').innerHTML = S.lots.map((id) => cardHtml(id)).join('');
    $('hand-zone').style.display = Z.hand.length ? '' : 'none';
    const castable = (id) => legal.some((m) => m.type === 'cast' && m.card === S.pieces[id].kind);
    $('hand').innerHTML = Z.hand.map((id) => cardHtml(id, { go: go && (duel ? castable(id) : P.move === 'pick'), picked: choosing && choosing[0].type === 'cast' && choosing[0].card === S.pieces[id].kind, data: 'data-card="' + id + '"' })).join('');
    $('tableau-zone').style.display = Z.tableau.length ? '' : 'none';
    $('tableau').innerHTML = stack(Z.tableau).map(([id, n]) => cardHtml(id, { n })).join('');
    const w = crew(me);
    $('mine').innerHTML = '<div class="seatrow"><span class="who">You' + (S.first === me ? ' ★' : '') + '</span>'
      + Object.keys(S.pools[me]).map((r) => '<span class="chip">' + r + ' ' + S.pools[me][r] + '</span>').join('')
      + (wkind ? '<span class="chip">workers ' + w.filter((o) => o.zone === 'home' && o.ready !== false).length + '/' + w.length + '</span>' : '') + '</div>';
    panel(go, P);
  }

  function button(text, on, enabled) { const b = document.createElement('button'); b.textContent = text; b.disabled = !enabled; b.onclick = on; return b; }
  function panel(go, P) {
    const acts = $('acts');
    acts.innerHTML = '';
    let prompt;
    if (S.over) prompt = S.over.winner === me ? 'You win!' : S.over.winner === null ? 'A draw' : name(S.over.winner) + ' wins';
    else if (S.side !== me) prompt = name(S.side) + (P.who === 'together' ? ' is choosing…' : ' is playing…');
    else if (duel && choosing) {
      prompt = 'Choose a target';
      for (const m of choosing) acts.appendChild(button('→ ' + targetName(m.target), () => { choosing = null; play(m); }, go));
      acts.appendChild(button('Cancel', () => { choosing = null; render(); }, true));
    } else if (duel && S.links.length) {
      prompt = 'Answer ' + linkText(S.links[S.links.length - 1]) + '?';
      acts.appendChild(button('Pass', () => play(legal.find((m) => m.type === 'pass')), go));
    } else if (duel) {
      prompt = 'Your turn: cast, use your summons, or end it';
      acts.appendChild(button('End turn', () => play(legal.find((m) => m.type === 'end')), go));
    } else if (P.move === 'place') {
      prompt = legal.some((m) => m.type === 'place') ? 'Send a worker to a space' : 'Nowhere left to go';
      const pass = legal.find((m) => m.type === 'pass');
      if (pass) acts.appendChild(button(legal.length > 1 ? 'Keep the rest home' : 'Pass', () => play(pass), go));
    } else if (P.move === 'bid') {
      prompt = 'Seal a bid (' + K.round.bid + ')';
      for (const m of legal) acts.appendChild(button(String(m.n), () => play(m), go));
    } else prompt = 'Pick a card to keep; the rest go on';
    $('prompt').textContent = prompt;
    const sc = S.over ? S.over.scores : T.roundScores(K, S, false);
    $('status').textContent = S.over ? prompt : 'Round ' + (S.round + 1) + ' of ' + R.rounds + ' · ' + (P.id || P.move);
    $('seats').innerHTML = K.players.map((p, s) => {
      const u = T.utilization(K, S, s);
      return '<div class="seat' + (s === S.side ? ' now' : '') + '"><span><i class="sw" style="background:' + colour(s) + '"></i> ' + esc(p.id) + (s === me ? ' (you)' : '') + '</span><span>' + (duel && L0 && !S.over ? S.pools[s][L0] + ' ' + L0 : sc[s] + ' pts') + (u ? ' <small>· used ' + Math.round(u.share * 100) + '%</small>' : '') + '</span></div>';
    }).join('');
    $('log').innerHTML = log.join('');
    $('log').scrollTop = 1e6;
  }

  $('felt').addEventListener('click', (e) => {
    if (!mine()) return;
    const sp = e.target.closest('.sp'), c = e.target.closest('.c');
    if (sp) play(legal.find((m) => m.type === 'place' && m.space === sp.dataset.space));
    else if (duel && c) {
      // a card cast, or a summon's ability used: one way, played; several (targets), chosen in the panel
      const list = c.dataset.card !== undefined ? legal.filter((m) => m.type === 'cast' && m.card === S.pieces[+c.dataset.card].kind)
        : c.dataset.obj !== undefined ? legal.filter((m) => m.type === 'use' && m.id === +c.dataset.obj) : [];
      if (list.length === 1) { choosing = null; play(list[0]); } else if (list.length) { choosing = list; render(); }
    } else if (c && c.dataset.card !== undefined) { const id = +c.dataset.card; play(legal.find((m) => m.type === 'pick' && m.id === id) || legal.find((m) => m.type === 'pick' && m.card === S.pieces[id].kind)); }
  });
  if (duel && L0) $('seats-h').textContent = L0.charAt(0).toUpperCase() + L0.slice(1);
  $('level').onchange = (e) => { level = e.target.value; };
  $('again').onclick = () => reset();
  reset();
}
