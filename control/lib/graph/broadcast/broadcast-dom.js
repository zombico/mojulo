/**
 * THE TABLE'S BROADCAST — the broadcast package (broadcast-package.js) on a DOM page: the board games' pages
 * (tabletop/*-page.js) covered as the contest pages are, in the same package's type, glass, metal, colour and motion,
 * written as CSS rather than drawn on a canvas.
 *
 *   tableBroadcastData(players, v, fallback) → BC   the package for a table: the players' colours as the kits (kept
 *                                     apart for every eye, ramped, inked, a dark one keylined), the recipe's word read
 *   broadcastDomCss(BC) → css         the package as custom properties and the tv-* classes, its entrance as keyframes;
 *                                     still under prefers-reduced-motion
 *   broadcastDomClient(BC) → tv       (the browser; inlined by its source) the bug, the calls, the results:
 *     tv.frame({ title?, seats: [{ name, color, score?, note?, clock?, live?, you? }], tab? })   the seat plates: a
 *       score that rose pops (a flash in the seat's colour and its gain floating off), the seat to play alight
 *     tv.call({ text, sub?, tone, color?, hold? })   a plate over the board, one at a time by weight (the canvas
 *       client's rule: a weightier word takes it, an equal one once read, a lighter one waits)
 *     tv.result({ title, sub?, tone?, rows: [{ place, name, color, value, note? }], again })   the board at the end
 *       with its medals, staggered in; 'Play again' calls `again`, 'See the board' puts it aside
 *     tv.table({ players, me, scores, live, tab, over, again, title? })   a scored table in one call: the seats (you
 *       and the computers, each its points, the one acting alight), the tab, and once `over` ({ winner, reason,
 *       scores? }) the end's plate and, a beat later, the result (the places by points, ties sharing a place)
 *     tv.hit(el)                        the last move's emphasis on a cell or a token (a ring that opens once)
 *     tv.colour(i)                      the kit a player's pieces are drawn in (the chip and the piece agree)
 *     tv.clear()                        a new game: plates and the board gone, the scores forgotten
 *   END_WORDS                         an ending's reason as the board shows it
 *
 * Pure strings in Node; the client keeps no state but the DOM's and its timers. No dice.
 */
import { broadcastData, readBroadcast, colorRamp } from './broadcast-package.js';

/** The tables' materials: a board's frame of wood under its light square, a card table's felt under the card stock. */
export const TABLE_LOOKS = Object.freeze({
  wood: Object.freeze({ surface: '#5b4632', inlay: '#e8d9b8' }),
  felt: Object.freeze({ surface: '#3b4a37', inlay: '#f4f1ea' }),
});

export const END_WORDS = Object.freeze({
  mate: 'checkmate', stalemate: 'stalemate', royal: 'the crown falls', time: 'on time', repetition: 'by repetition',
  quiet: 'no progress', cap: 'the turns ran out', score: 'on points', lose: 'the last one standing', loop: 'no end in sight',
  'no-moves': 'no moves left', line: 'a line', connect: 'connected',
});

/**
 * The package for a table: the players' colours (the game's, else the page's fallback) as the kits, and the page's
 * own materials (`look`: { surface, inlay }: the board's frame or the card table's felt, the light square or the card
 * stock) as the `table` package's plates, so the graphics are the game's furniture. A recipe that names another package
 * (a TV look) gets that one instead.
 */
export function tableBroadcastData(players, v, fallback = ['#f3ede2', '#2a2420', '#c4362a', '#2f6db3'], look = TABLE_LOOKS.wood) {
  const B = readBroadcast(v, 'tabletop');
  const sides = players.map((p, s) => (B.sides && B.sides[s]) || p.colour || fallback[s % fallback.length]);
  const ramp = colorRamp(look.surface);
  return { ...broadcastData({ ...B, sides }, { register: 'realistic', count: players.length, kind: players.length === 2 ? 'sides' : 'seats', where: 'tabletop', fallback: 'table', look: { glass: [ramp.hi, ramp.lo], inlay: look.inlay } }), ends: END_WORDS };
}

const MOTION = Object.freeze({
  expo: { curve: 'cubic-bezier(.16,1,.3,1)', from: 'clip-path:inset(0 50% 0 50%);opacity:.3', mid: '', to: 'clip-path:inset(0 0 0 0);opacity:1' },
  back: { curve: 'cubic-bezier(.34,1.7,.64,1)', from: 'transform:translateX(-90px) var(--tv-skew);opacity:0', mid: '', to: 'transform:translateX(0) var(--tv-skew);opacity:1' },
  elastic: { curve: 'linear', from: 'transform:scale(.2);opacity:0', mid: '45%{transform:scale(1.14);opacity:1}70%{transform:scale(.95)}85%{transform:scale(1.03)}', to: 'transform:scale(1);opacity:1' },
  sine: { curve: 'cubic-bezier(.39,.575,.565,1)', from: 'opacity:0', mid: '', to: 'opacity:1' },
});
const ms = (frames) => Math.round((frames / 60) * 1000);
const grad = (stops, deg = 180) => `linear-gradient(${deg}deg,${stops.map(([o, c]) => `${c} ${Math.round(o * 100)}%`).join(',')})`;

/** The package's look as CSS: custom properties from its card, a class a kit, the entrance its curve's keyframes. */
export function broadcastDomCss(BC) {
  const P = BC.card, M = MOTION[P.ease], skew = P.slant ? `skewX(${-Math.round((Math.atan(P.slant) * 180) / Math.PI)}deg)` : 'skewX(0deg)';
  // the plate's material: the gradient, and on a table the grain of its wood or the nap of its felt over it
  const grain = P.grain ? 'repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 6px) padding-box,repeating-linear-gradient(91deg,rgba(0,0,0,.07) 0 2px,transparent 2px 13px) padding-box,' : '';
  const glass = `${grain}linear-gradient(180deg,${P.glass[0]},${P.glass[1]})`;
  const rim = BC.metal.rim ? grad(BC.metal.rim) : glass;
  const gold = BC.metal.accent ? grad(BC.metal.accent) : 'linear-gradient(180deg,#3a3f4a,#2a2e36)';
  // a cel package's banded metal would cut a digit in two: a small cell (a score, a medal) takes its lit band flat
  const flat = (stops) => (P.cel ? stops[0][1] : grad(stops));
  // a score sits on the table's inlay where it has one (ivory set in the wood), else on the accent metal
  const cell = P.inlay ? P.inlay : BC.metal.accent ? flat(BC.metal.accent) : gold;
  const cellInk = P.inlay ? '#2b2118' : BC.metal.accent ? '#0b0f17' : BC.glassInk;
  const kits = BC.colors.map((c, i) => `.tv-c${i}{--c-hi:${c.hi};--c-base:${c.base};--c-lo:${c.lo};--c-ink:${c.ink}${c.key ? ';--c-key:rgba(255,255,255,.6)' : ''}}`).join('');
  const medals = BC.metal.medals.map((m, i) => `.tv-m${i + 1}{background:${flat(m)};color:#0b0f17}`).join('');
  const tones = Object.entries(BC.tones).map(([k, r]) => `.tv-plate.tv-${k}{background:linear-gradient(180deg,${r.hi},${r.base} 45%,${r.lo}) padding-box,var(--tv-rim) border-box;color:${r.ink}}`).join('');
  return `
:root{--tv-cell:${cell};--tv-cell-ink:${cellInk};--tv-face:${P.face};--tv-weight:${P.weight};--tv-track:${P.track}em;--tv-glass:${glass};--tv-alpha:${P.glassAlpha};--tv-ink:${BC.glassInk};--tv-rim:${rim};--tv-gold:${gold};--tv-gold-ink:${BC.metal.accent ? '#0b0f17' : BC.glassInk};--tv-sheen:${BC.metal.sheen};--tv-rimw:${Math.max(1, P.rim)}px;--tv-radius:${P.radius}px;--tv-skew:${skew};--tv-in:${ms(P.in)}ms;--tv-out:${ms(P.out)}ms;--tv-curve:${M.curve};--tv-sheen-t:${ms(P.sheen || 1)}ms}
${kits}${medals}
.tv-type{font-family:var(--tv-face);font-weight:var(--tv-weight);letter-spacing:var(--tv-track)${P.caps === false ? '' : ';text-transform:uppercase;font-stretch:condensed'}}
.tv-glass{background:var(--tv-glass) padding-box,var(--tv-rim) border-box;border:var(--tv-rimw) solid transparent;border-radius:var(--tv-radius);color:var(--tv-ink)${P.ink ? `;text-shadow:0 0 ${P.ink}px #120a26,0 2px 0 #120a26` : P.grain ? ';text-shadow:0 1px 0 rgba(0,0,0,.6)' : ''}}
.tv-bug{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;justify-content:center;font-variant-numeric:tabular-nums}
.tv-title{display:flex;align-items:center;padding:0 12px;font-size:12px;position:relative;overflow:hidden}
.tv-title::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--tv-gold)}
.tv-seat{display:flex;align-items:stretch;min-height:38px;overflow:hidden;position:relative}
.tv-chip{width:10px;background:linear-gradient(180deg,var(--c-hi),var(--c-base) 45%,var(--c-lo));box-shadow:inset 0 0 0 1px var(--c-key,transparent)}
.tv-name{display:flex;align-items:center;padding:0 10px;font-size:15px;white-space:nowrap}
.tv-note{display:flex;align-items:center;padding-right:8px;font-size:11px;opacity:.72;white-space:nowrap}
.tv-score{display:flex;align-items:center;justify-content:center;min-width:44px;padding:0 8px;font-size:17px;background:var(--tv-cell);color:var(--tv-cell-ink);position:relative${P.inlay ? ';box-shadow:inset 0 1px 3px rgba(0,0,0,.5);text-shadow:none' : ''}}
.tv-clock{display:flex;align-items:center;padding:0 9px;font-size:14px;border-left:1px solid rgba(255,255,255,.12)}
.tv-seat.live{box-shadow:0 0 0 2px var(--c-hi),0 0 14px -2px var(--c-base)}
.tv-seat.live .tv-chip{animation:tv-live 1.6s ease-in-out infinite}
.tv-seat.live .tv-clock{color:var(--c-hi)}
.tv-tab{display:flex;align-items:center;padding:0 12px;font-size:12px;min-height:38px}
.tv-tab.tv-new{animation:tv-tab .45s var(--tv-curve)}
.tv-pop{animation:tv-pop .7s ease-out}
.tv-gain{position:absolute;right:4px;top:-4px;font-size:13px;color:var(--c-hi);pointer-events:none;animation:tv-gain 1.1s ease-out forwards;text-shadow:0 1px 0 #000}
/* the stage hangs under the bug, over the board's top edge: a call is read without hiding the play */
.tv-stage{flex:1 1 100%;position:relative;height:0;z-index:40;pointer-events:none}
.tv-stage>.tv-hang{position:absolute;left:0;right:0;top:-2px;display:flex;flex-direction:column;align-items:center;gap:3px}
.tv-plate{position:relative;overflow:hidden;padding:7px 30px 6px;font-size:clamp(18px,3vw,30px);line-height:1.05;box-shadow:0 10px 30px -8px #000a;animation:tv-in var(--tv-in) var(--tv-curve) both}
.tv-plate.tv-neutral{background:var(--tv-glass) padding-box,var(--tv-rim) border-box}
.tv-plate.tv-gold{background:var(--tv-gold) padding-box,var(--tv-rim) border-box;color:var(--tv-gold-ink);text-shadow:none}
.tv-plate.tv-side{background:linear-gradient(180deg,var(--c-hi),var(--c-base) 45%,var(--c-lo)) padding-box,var(--tv-rim) border-box;color:var(--c-ink);box-shadow:0 10px 30px -8px #000a,inset 0 0 0 1px var(--c-key,transparent)}
${tones}
.tv-plate::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,var(--tv-sheen) 50%,transparent 70%);mix-blend-mode:screen;opacity:${P.sheen ? 0.4 : 0};transform:translateX(-120%);animation:tv-sheen var(--tv-sheen-t) ease-in-out calc(var(--tv-in) * .6) both}
.tv-sub{padding:3px 14px;font-size:12px;animation:tv-in var(--tv-in) var(--tv-curve) calc(var(--tv-in) * .35) both}
.tv-plate.out,.tv-sub.out{animation:tv-out var(--tv-out) ease-in forwards}
.tv-result{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#0008,#000c);z-index:50;animation:tv-fade .3s ease-out}
.tv-result[hidden]{display:none}
.tv-panel{width:min(520px,calc(100vw - 32px));display:flex;flex-direction:column;gap:5px}
.tv-head{padding:12px 18px;font-size:clamp(22px,4vw,34px);text-align:center;position:relative;overflow:hidden;animation:tv-in var(--tv-in) var(--tv-curve) both}
.tv-head.tv-gold{background:var(--tv-gold) padding-box,var(--tv-rim) border-box;color:var(--tv-gold-ink);text-shadow:none}
.tv-head::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,var(--tv-sheen) 50%,transparent 70%);mix-blend-mode:screen;opacity:${P.sheen ? 0.45 : 0};transform:translateX(-120%);animation:tv-sheen calc(var(--tv-sheen-t) * 1.4) ease-in-out calc(var(--tv-in) * 1.2) both}
.tv-why{align-self:center;padding:3px 14px;font-size:12px}
.tv-row{display:flex;align-items:center;gap:10px;padding:6px 12px 6px 8px;font-size:17px;animation:tv-row var(--tv-in) var(--tv-curve) both}
.tv-row .tv-chip{align-self:stretch;width:6px;border-radius:2px}
.tv-medal{flex:0 0 30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:inset 0 0 0 1px #0005,0 1px 2px #0008}
.tv-medal:not([class*="tv-m"]){background:none;color:var(--tv-ink)}
.tv-row .tv-name{flex:1;padding:0}
.tv-row .tv-note{padding:0}
.tv-row .tv-val{min-width:44px;text-align:right}
.tv-row.tv-first{box-shadow:0 0 0 1px var(--tv-sheen)}
.tv-acts{display:flex;justify-content:center;gap:8px;margin-top:8px;animation:tv-fade .4s ease-out calc(var(--tv-in) * 2) both}
.tv-acts button{font:inherit;font-size:13px;padding:8px 16px;cursor:pointer;pointer-events:auto}
.tv-acts button.tv-go{background:var(--tv-gold) padding-box,var(--tv-rim) border-box;color:var(--tv-gold-ink);text-shadow:none}
.tv-hit{animation:tv-hit .9s ease-out}
svg .tv-hit{transform-box:fill-box;transform-origin:center}
@keyframes tv-in{from{${M.from}}${M.mid}to{${M.to}}}
@keyframes tv-out{to{opacity:0;transform:translateX(60px) var(--tv-skew)}}
@keyframes tv-sheen{to{transform:translateX(120%)}}
@keyframes tv-row{from{opacity:0;transform:translateX(80px)}to{opacity:1;transform:none}}
@keyframes tv-fade{from{opacity:0}}
@keyframes tv-tab{from{transform:translateY(-70%);opacity:0}}
@keyframes tv-live{50%{filter:brightness(1.6) saturate(1.2)}}
@keyframes tv-pop{0%{background:var(--c-hi);color:var(--c-ink)}100%{}}
@keyframes tv-gain{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-26px)}}
@keyframes tv-hit{0%{filter:brightness(1.9) drop-shadow(0 0 6px var(--tv-sheen))}100%{filter:none}}
@media (prefers-reduced-motion:reduce){.tv-plate,.tv-sub,.tv-head,.tv-row,.tv-acts,.tv-result,.tv-hit,.tv-pop,.tv-tab,.tv-seat .tv-chip,.tv-gain,.tv-plate::after,.tv-head::after{animation:none!important}}
`;
}

/* The page's own code: runs in the browser, references only its argument and the DOM. */
export function broadcastDomClient(BC) {
  const P = BC.card, RANK = { gold: 3, side: 2, warn: 2, go: 2, neutral: 1 };
  const holdMs = (h) => Math.round((P.hold / 60) * 1000 * (h === undefined ? 1 : h)), inMs = Math.round((P.in / 60) * 1000), outMs = Math.round((P.out / 60) * 1000);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const kit = (i) => (BC.colors[i] ? ' tv-c' + i : '');
  const bug = el('div', 'tv-bug tv-type'), stage = el('div', 'tv-stage tv-type'), shade = el('div', 'tv-result tv-type');
  shade.hidden = true;
  const hang = el('div', 'tv-hang');
  stage.appendChild(hang);
  const main = document.querySelector('main');
  if (main) { main.insertBefore(stage, main.firstChild); main.insertBefore(bug, stage); } else { document.body.appendChild(bug); document.body.appendChild(stage); }
  document.body.appendChild(shade);
  let scores = [], tabText = null, plate = null, queued = null;

  function frame(feed) {
    const seats = feed.seats || [];
    bug.innerHTML = '';
    if (feed.title) bug.appendChild(el('div', 'tv-title tv-glass', feed.title));
    seats.forEach((s, i) => {
      const box = el('div', 'tv-seat tv-glass' + kit(s.color) + (s.live ? ' live' : ''));
      box.appendChild(el('i', 'tv-chip'));
      box.appendChild(el('span', 'tv-name', s.name));
      if (s.note) box.appendChild(el('span', 'tv-note', s.note));
      if (s.score !== undefined && s.score !== null) {
        const sc = el('span', 'tv-score', String(s.score));
        const was = scores[i];
        if (typeof s.score === 'number' && typeof was === 'number' && s.score > was) {
          sc.classList.add('tv-pop');
          box.appendChild(el('span', 'tv-gain', '+' + (s.score - was)));
        }
        box.appendChild(sc);
      }
      if (s.clock) box.appendChild(el('span', 'tv-clock', s.clock));
      bug.appendChild(box);
    });
    scores = seats.map((s) => s.score);
    if (feed.tab) {
      const tab = el('div', 'tv-tab tv-glass' + (feed.tab !== tabText ? ' tv-new' : ''), feed.tab);
      bug.appendChild(tab);
    }
    tabText = feed.tab || null;
  }

  // one plate on the stage: a generation each, so a plate replaced never takes down the one after it
  let gen = 0;
  function show(q) {
    const id = ++gen;
    hang.innerHTML = '';
    hang.appendChild(el('div', 'tv-plate tv-' + (q.tone || 'neutral') + (q.tone === 'side' ? kit(q.color) : ''), q.text));
    if (q.sub) hang.appendChild(el('div', 'tv-sub tv-glass', q.sub));
    plate = Object.assign({}, q, { at: performance.now(), rank: RANK[q.tone] || 1 });
    setTimeout(() => {
      if (id !== gen) return;
      for (const c of hang.children) c.classList.add('out');
      setTimeout(() => {
        if (id !== gen) return;
        hang.innerHTML = ''; plate = null;
        if (queued) { const n = queued; queued = null; show(n); }
      }, outMs);
    }, inMs + holdMs(q.hold));
  }
  function call(q) {
    const next = Object.assign({ rank: RANK[q.tone] || 1 }, q);
    if (plate) {
      const read = performance.now() - plate.at >= inMs + 400;
      if (next.rank < plate.rank || (next.rank === plate.rank && !read)) { if (!queued || next.rank >= queued.rank) queued = next; return; }
    }
    if (queued && queued.text === next.text) queued = null;
    show(next);
  }

  function result(q) {
    shade.innerHTML = '';
    const panel = el('div', 'tv-panel');
    panel.appendChild(el('div', 'tv-head tv-glass' + (q.tone === 'gold' ? ' tv-gold' : ''), q.title));
    if (q.sub) panel.appendChild(el('div', 'tv-why tv-glass', q.sub));
    (q.rows || []).forEach((r, k) => {
      const row = el('div', 'tv-row tv-glass' + kit(r.color) + (k === 0 && r.place === 1 ? ' tv-first' : ''));
      row.style.animationDelay = Math.round(inMs + k * 90) + 'ms';
      row.appendChild(el('span', 'tv-medal' + (r.place >= 1 && r.place <= 3 ? ' tv-m' + r.place : ''), r.place === null || r.place === undefined ? '—' : String(r.place)));
      row.appendChild(el('i', 'tv-chip'));
      row.appendChild(el('span', 'tv-name', r.name));
      if (r.note) row.appendChild(el('span', 'tv-note', r.note));
      row.appendChild(el('span', 'tv-val', r.value === undefined ? '' : String(r.value)));
      panel.appendChild(row);
    });
    const acts = el('div', 'tv-acts');
    const look = el('button', 'tv-glass tv-type', 'See the board'), again = el('button', 'tv-glass tv-type tv-go', 'Play again');
    look.onclick = () => { shade.hidden = true; };
    again.onclick = () => { shade.hidden = true; if (q.again) q.again(); };
    acts.appendChild(look); acts.appendChild(again);
    panel.appendChild(acts);
    shade.appendChild(panel);
    shade.hidden = false;
  }
  shade.addEventListener('click', (e) => { if (e.target === shade) shade.hidden = true; });

  let ended = false;
  function table(q) {
    const me = q.me, who = (s) => (BC.names && BC.names[s]) || (s === me ? 'You' : q.players[s].id);
    frame({ title: q.title, seats: q.players.map((p, s) => ({ name: who(s), note: s === me ? p.id : 'computer', color: s, score: q.scores ? q.scores[s] : undefined, live: !q.over && q.live === s })), tab: q.over ? 'Final' : q.tab });
    if (!q.over || ended) return;
    ended = true;
    const o = q.over, vals = o.scores || q.scores || q.players.map(() => 0), why = (BC.ends && BC.ends[o.reason]) || o.reason || '';
    const title = o.winner === null || o.winner === undefined ? 'Draw' : o.winner === me ? 'You win' : who(o.winner) + ' wins';
    call({ text: title, sub: why, tone: o.winner === me ? 'gold' : 'neutral' });
    const order = q.players.map((_, s) => s).sort((a, b) => (a === o.winner ? -1 : b === o.winner ? 1 : vals[b] - vals[a]));
    const rows = order.map((s) => ({ place: 1 + order.filter((t) => vals[t] > vals[s] || (t === o.winner && s !== o.winner)).length, name: who(s), note: s === me ? q.players[s].id : 'computer', color: s, value: vals[s] }));
    setTimeout(() => { if (ended) result({ title, sub: why, tone: o.winner === me ? 'gold' : 'neutral', rows, again: q.again }); }, 1400);
  }
  function hit(node) { if (!node) return; node.classList.remove('tv-hit'); void node.getBoundingClientRect(); node.classList.add('tv-hit'); }
  function clear() { ended = false; gen += 1; plate = null; queued = null; hang.innerHTML = ''; shade.hidden = true; scores = []; tabText = null; }
  const colour = (i) => (BC.colors[i] ? BC.colors[i].base : '#888888');
  return { frame, call, result, table, hit, clear, colour };
}
