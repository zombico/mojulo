/**
 * THE CARD PAGE — a card game (the tabletop kernel's cards) against the computers, on a flat table: the supply's piles
 * and the market's row to buy or take from, the person's hand to play from, what they played this turn, their tableau;
 * each other seat's deck, hand and discard as counts (never their faces), and its tableau face up; the turn's actions,
 * buys and coins; every seat's points as the game scores them now; a log. A card is drawn from its type: its colour, its
 * name, its cost, what it gives (coins, points, its effects) and its tags.
 *
 *   cardPageHtml(G, L, K, { human, level, seed, title }) → html   (tabletopPageHtml sends a card game here)
 */

import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tableBroadcastData, broadcastDomCss, broadcastDomClient, TABLE_LOOKS } from '../broadcast/broadcast-dom.js';

const LEVELS = ['easy', 'fair', 'hard'];

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

export function cardPageHtml(G, L, K, opts = {}) {
  const { human, level, seed } = opts;
  const data = { tv: tableBroadcastData(G.players, opts.broadcast, ['#888888'], TABLE_LOOKS.felt), L, G, human, level, seed };
  const title = opts.title ?? G.title ?? 'mojulo card game';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:light dark;--bg:#f4f1ea;--ink:#2b2622;--mute:#7a6f63;--line:#d8cfc0;--mark:#d2452f;--go:#3a8f5a;--panel:#fffdf8;--felt:#3b4a37}
  @media (prefers-color-scheme:dark){:root{--bg:#17191d;--ink:#e9e3d8;--mute:#9a9183;--line:#33363c;--panel:#1f2227;--felt:#26302a}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
  header{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
  header h1{font-size:16px;margin:0 8px 0 0}
  button,select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
  button:disabled{opacity:.4;cursor:default}
  #status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  main{display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-items:flex-start}
  #felt{flex:1 1 560px;min-width:0;background:var(--felt);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:12px;color:#efe9dc}
  .zone h2{font-size:12px;margin:0 0 6px;font-weight:600;color:#cfc6b5;text-transform:uppercase;letter-spacing:.04em}
  .cards{display:flex;flex-wrap:wrap;gap:8px;min-height:40px}
  .cards.empty::after{content:'—';color:#9aa38f}
  .c{position:relative;width:96px;height:132px;border-radius:8px;background:#fbf7ee;color:#2b2622;box-shadow:0 2px 0 rgba(0,0,0,.35);overflow:hidden;font-size:12px;line-height:1.25;flex:none}
  .c .band{height:10px}
  .c .nm{font-weight:700;padding:4px 30px 0 6px;text-transform:capitalize}
  .c .fx{padding:2px 6px;color:#4a4036}
  .c .tg{position:absolute;left:6px;right:6px;bottom:6px;color:#7a6f63;font-size:11px;padding-right:22px}
  .c .cost{position:absolute;right:5px;top:13px;min-width:20px;height:20px;border-radius:10px;background:#e0b84a;color:#2b2622;font-weight:700;text-align:center;line-height:20px;font-size:12px;padding:0 4px}
  .c .n{position:absolute;right:5px;bottom:5px;background:#2b2622;color:#fbf7ee;border-radius:9px;padding:0 6px;font-size:11px;font-weight:700}
  .c svg{position:absolute;right:5px;top:36px;width:24px;height:24px}
  .c.small{width:64px;height:88px;font-size:10px}
  .c.small .fx,.c.small .tg{display:none}
  .c.small .nm{padding-right:4px}
  .c.small svg{top:auto;bottom:6px;right:auto;left:6px}
  .c.go{cursor:pointer;box-shadow:0 0 0 3px #6fcf8f,0 2px 0 rgba(0,0,0,.35)}
  .c.go:hover{transform:translateY(-3px)}
  .c.out{opacity:.4}
  .back{width:44px;height:60px;border-radius:6px;background:repeating-linear-gradient(45deg,#6b4a3a 0 6px,#5a3e31 6px 12px);box-shadow:0 0 0 2px #efe9dc inset;display:flex;align-items:center;justify-content:center;font-weight:700;color:#efe9dc}
  .seatrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .seatrow .who{display:flex;align-items:center;gap:6px;font-weight:600;min-width:90px}
  .pile{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:#cfc6b5}
  aside{flex:0 1 280px;display:flex;flex-direction:column;gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
  .card h2{font-size:13px;margin:0 0 8px;color:var(--mute);font-weight:600}
  .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  #prompt{font-weight:600;min-height:1.4em}
  #act{display:flex;gap:12px;margin-top:6px;color:var(--mute)}
  #act b{color:var(--ink)}
  .seat{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}
  .seat:last-child{border-bottom:0}
  .seat.now{font-weight:600}
  .sw{display:inline-block;width:10px;height:10px;border-radius:2px;box-shadow:0 0 0 1px #1a1512 inset}
  #log{margin:0;padding-left:34px;max-height:240px;overflow:auto;font-size:13px}
  @media (max-width:600px){aside{flex-basis:100%}.c{width:80px;height:116px}}
${broadcastDomCss(data.tv)}
</style></head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>
  <button id="again">New game</button>
  <span id="status" aria-live="polite"></span>
</header>
<main>
  <div id="felt">
    <div class="zone" id="others"></div>
    <div class="zone" id="market-zone"><h2>Market</h2><div class="cards" id="market"></div></div>
    <div class="zone" id="supply-zone"><h2>Supply</h2><div class="cards" id="supply"></div></div>
    <div class="zone" id="play-zone"><h2>Played this turn</h2><div class="cards" id="play"></div></div>
    <div class="zone" id="hand-zone"><h2>Your hand</h2><div class="cards" id="hand"></div></div>
    <div class="zone" id="tableau-zone"><h2>Your tableau</h2><div class="cards" id="tableau"></div></div>
    <div class="zone" id="mine"></div>
  </div>
  <aside>
    <div class="card"><div id="prompt"></div><div id="act"></div><div class="row" id="acts" style="margin-top:8px"></div></div>
    <div class="card"><h2>Points</h2><div id="seats"></div></div>
    <div class="card"><h2>Log</h2><ol id="log"></ol></div>
  </aside>
</main>
<script>
const DATA = ${scriptJson(data)};
const T = (${buildTabletop.toString()})();
const M = (${buildTabletopMind.toString()})(T);
const TV = (${broadcastDomClient.toString()})(DATA.tv);
(${tabletopCardClient.toString()})(DATA, T, M, TV);
</script>
</body></html>
`;
}

/* The card page's own code: runs in the browser, references only its arguments and the DOM. */
export function tabletopCardClient(D, T, M, TV) {
  const $ = (id) => document.getElementById(id);
  const K = T.compile(D.L, D.G), me = K.sideOf[D.human], types = K.card.types;
  const colour = (s) => TV.colour(s);   // the broadcast's kits: the seat's chip and its pieces agree
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let S, legal, busy = false, level = D.level, log = [], turns = 0;

  // what a card gives, in words
  function effects(t) {
    const out = [];
    if (t.coin) out.push('+' + t.coin + ' coin' + (t.coin > 1 ? 's' : ''));
    if (t.points) out.push(t.points + ' point' + (t.points > 1 ? 's' : ''));
    for (const e of t.play || []) {
      if (e.draw) out.push('+' + e.draw + ' card' + (e.draw > 1 ? 's' : ''));
      if (e.coin) out.push('+' + e.coin + ' coin' + (e.coin > 1 ? 's' : ''));
      if (e.actions) out.push('+' + e.actions + ' action' + (e.actions > 1 ? 's' : ''));
      if (e.buys) out.push('+' + e.buys + ' buy' + (e.buys > 1 ? 's' : ''));
      if (e.points) out.push('+' + e.points + ' point' + (e.points > 1 ? 's' : ''));
      if (e.gain) out.push('gain a card costing up to ' + e.gain);
      if (e.trash) out.push('trash up to ' + e.trash + ' from your hand');
    }
    return out;
  }
  // a tag drawn as a mark: a value's own colour from the game's look, else its first letter
  function mark(t) {
    const tags = t.tags || {}, look = (D.G.look && D.G.look.tags) || {};
    const vals = Object.keys(tags).filter((k) => typeof tags[k] === 'string');
    if (!vals.length) return '';
    const v = tags[vals[0]], fill = look[v] || t.colour || '#999';
    return '<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="' + fill + '" stroke="#2b2622" stroke-width="1.5"/><text x="13" y="17.5" text-anchor="middle" font-size="12" font-weight="700" fill="#2b2622">' + esc(String(v)[0].toUpperCase()) + '</text></svg>';
  }
  // a card drawn from its kind, or from an object (o.obj: its characteristics as derived, modifiers and all)
  const kindOf = (id) => (id === null || id === undefined ? null : S.pieces[id].kind);
  function cardHtml(id, o) {
    o = o || {};
    if (!id) return '<div class="c' + (o.small ? ' small' : '') + ' out"></div>';
    const t = o.obj !== undefined ? T.derive(K, S, o.obj) : K.defs[id], tags = t.tags || {};
    const tagText = Object.keys(tags).map((k) => k + ' ' + tags[k]).join(' · ');
    return '<div class="c' + (o.small ? ' small' : '') + (o.go ? ' go' : '') + (o.out ? ' out' : '') + '"' + (o.data ? ' ' + o.data : '') + ' title="' + esc((t.name || id) + (effects(t).length ? ': ' + effects(t).join(', ') : '')) + '">'
      + '<div class="band" style="background:' + (t.colour || '#b9ad98') + '"></div>'
      + (t.cost !== undefined && !K.card.draft ? '<div class="cost">' + t.cost + '</div>' : '')
      + '<div class="nm">' + esc(t.name || id) + '</div>'
      + '<div class="fx">' + esc(effects(t).join(', ')) + '</div>'
      + (tagText ? '<div class="tg">' + esc(tagText) + '</div>' : '')
      + mark(t)
      + (o.n !== undefined ? '<div class="n">' + o.n + '</div>' : '')
      + '</div>';
  }
  const stack = (ids) => { const by = {}; for (const id of ids) by[id] = (by[id] || 0) + 1; return Object.keys(by).sort().map((id) => [id, by[id]]); };

  function reset() { TV.clear(); S = T.start(K); busy = false; log = []; turns = 0; step(); }
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
    }, 260);
  }
  function act(m) {
    const who = S.side, card = m.card || (m.slot !== undefined ? kindOf(S.market.row[m.slot]) : null), nm = card ? (types[card].name || card) : '';
    if (m.type === 'play' && !types[card].treasure) note(who, 'plays ' + nm);
    if (m.type === 'buy') note(who, 'buys ' + nm);
    if (m.type === 'take') note(who, 'takes ' + nm);
    if (m.type === 'gain') note(who, 'gains ' + nm);
    if (m.type === 'trash') note(who, 'trashes ' + nm);
    S = T.apply(K, S, m);
    turns++;
  }
  function note(side, text) { log.push('<li><i class="sw" style="background:' + colour(side) + '"></i> <b>' + esc(K.players[side].id) + '</b> ' + esc(text) + '</li>'); }
  function play(m) { if (busy || S.over || S.side !== me || !m) return; act(m); step(); }
  const mine = () => !busy && !S.over && S.side === me;
  const find = (type, card) => legal.find((m) => m.type === type && m.card === card);

  function render() {
    const go = mine(), owed = S.pending.length ? S.pending[0].do : null, Z = S.zones[me];
    // the other seats: counts, never faces; a tableau face up
    $('others').innerHTML = K.players.map((p, s) => {
      if (s === me) return '';
      const Y = S.zones[s];
      return '<div class="seatrow" style="margin-bottom:6px"><span class="who"><i class="sw" style="background:' + colour(s) + '"></i>' + esc(p.id) + '</span>'
        + (K.card.draft ? '' : '<span class="pile"><span class="back">' + Y.deck.length + '</span>deck</span><span class="pile"><span class="back">' + Y.hand.length + '</span>hand</span><span class="pile"><span class="back">' + Y.discard.length + '</span>discard</span>')
        + (Y.play.length && s === S.side ? '<span class="cards">' + Y.play.map((id) => cardHtml(kindOf(id), { small: true, obj: id })).join('') + '</span>' : '')
        + (Y.tableau.length ? '<span class="cards">' + stack(Y.tableau.map(kindOf)).map(([id, n]) => cardHtml(id, { small: true, n: n > 1 ? n : undefined })).join('') + '</span>' : '')
        + '</div>';
    }).join('');
    // the market's row and the supply's piles: lit where a buy, a take or a gain may go
    $('market-zone').style.display = S.market ? '' : 'none';
    if (S.market) {
      $('market').innerHTML = S.market.row.map((id, slot) => {
        const m = legal.find((x) => x.slot === slot);
        return cardHtml(kindOf(id), { go: go && m, obj: id === null ? undefined : id, data: 'data-slot="' + slot + '"' });
      }).join('') + '<span class="pile"><span class="back">' + S.market.deck.length + '</span>deck</span>';
    }
    const ids = Object.keys(S.supply);
    $('supply-zone').style.display = ids.length ? '' : 'none';
    $('supply').innerHTML = ids.map((id) => {
      const m = owed === 'gain' ? find('gain', id) : !owed ? find('buy', id) : null;
      return cardHtml(id, { go: go && m, out: S.supply[id] <= 0, n: S.supply[id], data: 'data-supply="' + id + '"' });
    }).join('');
    // the person's own cards
    $('play-zone').style.display = K.card.draft ? 'none' : '';
    $('play').innerHTML = Z.play.map((id) => cardHtml(kindOf(id), { obj: id })).join('');
    $('play').classList.toggle('empty', !Z.play.length);
    $('hand-zone').style.display = K.card.draft ? 'none' : '';
    $('hand').innerHTML = Z.hand.map((id, i) => {
      const k = kindOf(id), m = owed === 'trash' ? find('trash', k) : !owed ? find('play', k) : null;
      return cardHtml(k, { go: go && m, obj: id, data: 'data-hand="' + i + '"' });
    }).join('');
    $('hand').classList.toggle('empty', !Z.hand.length);
    $('tableau-zone').style.display = Z.tableau.length || K.card.draft ? '' : 'none';
    $('tableau').innerHTML = stack(Z.tableau.map(kindOf)).map(([id, n]) => cardHtml(id, { n: n > 1 ? n : undefined })).join('');
    $('tableau').classList.toggle('empty', !Z.tableau.length);
    $('mine').innerHTML = K.card.draft ? '' : '<div class="seatrow"><span class="pile"><span class="back">' + Z.deck.length + '</span>deck</span><span class="pile"><span class="back">' + Z.discard.length + '</span>discard</span>' + (S.trash.length ? '<span class="pile"><span class="back">' + S.trash.length + '</span>trashed</span>' : '') + '</div>';
    panel(go, owed);
  }

  function button(text, on, enabled) { const b = document.createElement('button'); b.textContent = text; b.disabled = !enabled; b.onclick = on; return b; }
  function panel(go, owed) {
    const acts = $('acts');
    acts.innerHTML = '';
    let prompt;
    if (S.over) prompt = S.over.winner === me ? 'You win!' : S.over.winner === null ? 'A draw' : K.players[S.over.winner].id + ' wins';
    else if (S.side !== me) prompt = K.players[S.side].id + ' is playing…';
    else if (owed === 'gain') prompt = 'Gain a card costing up to ' + S.pending[0].upTo;
    else if (owed === 'trash') { prompt = 'Trash up to ' + S.pending[0].left + ' from your hand'; acts.appendChild(button('Done', () => play(legal.find((m) => m.type === 'done')), go)); }
    else if (K.card.draft) prompt = 'Take a card from the market';
    else {
      prompt = 'Play cards, buy, then end your turn';
      const treasures = legal.filter((m) => m.type === 'play' && types[m.card].treasure);
      acts.appendChild(button('Play treasures', () => {
        if (!mine()) return;
        let m;
        while ((m = T.legal(K, S).find((x) => x.type === 'play' && types[x.card].treasure))) act(m);
        step();
      }, go && treasures.length > 0));
      acts.appendChild(button('End turn', () => play(legal.find((m) => m.type === 'end')), go));
    }
    $('prompt').textContent = prompt;
    $('act').innerHTML = K.card.draft || S.side !== me || S.over ? '' : '<span>Actions <b>' + S.act.actions + '</b></span><span>Buys <b>' + S.act.buys + '</b></span><span>Coins <b>' + S.act.coins + '</b></span>';
    const sc = S.over ? S.over.scores : T.cardScores(K, S);
    $('status').textContent = S.over ? prompt : 'Turn ' + (Math.floor(S.turn / K.players.length) + 1);
    TV.table({ players: K.players, me, scores: sc, live: S.side, tab: (prompt ? prompt + ' · ' : '') + 'turn ' + (Math.floor(S.turn / K.players.length) + 1), over: S.over, again: reset });
    $('seats').innerHTML = K.players.map((p, s) => '<div class="seat' + (s === S.side ? ' now' : '') + '"><span><i class="sw" style="background:' + colour(s) + '"></i> ' + esc(p.id) + (s === me ? ' (you)' : '') + '</span><span>' + sc[s] + ' pts</span></div>').join('');
    $('log').innerHTML = log.join('');
    $('log').scrollTop = 1e6;
  }

  $('felt').addEventListener('click', (e) => {
    if (!mine()) return;
    const c = e.target.closest('.c');
    if (!c) return;
    const owed = S.pending.length ? S.pending[0].do : null;
    if (c.dataset.hand !== undefined) { const id = kindOf(S.zones[me].hand[+c.dataset.hand]); play(owed === 'trash' ? find('trash', id) : owed ? null : find('play', id)); }
    else if (c.dataset.supply !== undefined) { const id = c.dataset.supply; play(owed === 'gain' ? find('gain', id) : owed ? null : find('buy', id)); }
    else if (c.dataset.slot !== undefined) play(legal.find((m) => m.slot === +c.dataset.slot));
  });
  $('level').onchange = (e) => { level = e.target.value; };
  $('again').onclick = () => reset();
  reset();
}
