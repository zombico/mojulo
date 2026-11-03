/**
 * THE ERRANDS' PAGE in a world's book (bible-html.js): each errand (errand.js) drawn as its route, out from the giver
 * through its legs in the order they can be had and home again, then a row a leg: what is had, where, how (a shelf, a shop
 * and its price, a bounty and its foe), what state its cargo travels in, and what the giver asks of it; the reward; the
 * laws' verdicts. Drawn in the book's own variables (`var(--ink)`, `var(--c-trail)`, …), so a skin recolours it.
 *
 *   errandPage(G, esc) → the section's html, '' for a world with no errand
 *
 * Pure: the same world, the same page.
 */

const W = 640, H = 120, PAD = 46;

// the route: the giver, each leg in order, the giver again; a stop a circle, the way out in the accent, the way home dashed
function route(E, G, esc) {
  const stops = [{ level: E.giver, label: 'giver' }, ...E.order.map((item) => ({ level: E.list.find((x) => x.item === item).at, label: item })), { level: E.giver, label: 'home' }];
  const step = (W - 2 * PAD) / (stops.length - 1), x = (i) => Math.round(PAD + i * step), y = H / 2;
  const name = (lv) => G.levels[lv]?.name ?? lv;
  const lines = stops.slice(1).map((_, i) => `<line x1="${x(i)}" y1="${y}" x2="${x(i + 1)}" y2="${y}" style="stroke:${i === stops.length - 2 ? 'var(--muted)' : 'var(--c-trail)'}" stroke-width="${i === stops.length - 2 ? 1.5 : 3}"${i === stops.length - 2 ? ' stroke-dasharray="5 4"' : ''}/>`).join('');
  const dots = stops.map((s, i) => {
    const end = i === 0 || i === stops.length - 1;
    return `<g><circle cx="${x(i)}" cy="${y}" r="${end ? 11 : 8}" style="fill:var(--sheet);stroke:${end ? 'var(--local)' : 'var(--c-trail)'}" stroke-width="2.5"/>`
      + `<text x="${x(i)}" y="${y - 18}" text-anchor="middle" class="er-k">${esc(s.label)}</text>`
      + `<text x="${x(i)}" y="${y + 28}" text-anchor="middle" class="er-n">${esc(name(s.level))}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The errand's route: out from the giver through its legs and home">${lines}${dots}</svg>`;
}

const how = (N, E) => (N.from ? `bounty: a ${N.from.foe}'s fall` : N.needs.length ? `shop: for ${N.needs.map((n) => `${E.list.find((x) => x.item === n).count} ${n}`).join(', ')}` : 'shelf');
const state = (N) => (N.cargo ? [N.cargo.fragile ? 'fragile' : null, N.cargo.perishable ? `perishable, a unit each ${N.cargo.perishable} s` : null].filter(Boolean).join(', ') : '—');

/** The errands' section of the book. */
export function errandPage(G, esc) {
  if (!G.errands?.length) return '';
  const cards = G.errands.map((E) => {
    const rows = E.order.map((item) => {
      const N = E.list.find((x) => x.item === item), asked = E.roots.includes(item);
      return `<tr><td><b>${esc(item)}</b> ×${N.count}</td><td>${esc(G.levels[N.at]?.name ?? N.at)}</td><td class="mono">${esc(how(N, E))}</td><td class="mono">${esc(state(N))}</td><td class="mono">${asked ? `${N.min} to the giver` : 'spent on the way'}</td></tr>`;
    }).join('');
    const laws = E.laws.map((l) => `<li><span class="stamp ${l.holds ? 'st-approved' : 'st-changed'}">${l.holds ? 'holds' : 'advise'}</span> <b class="mono">${esc(l.law)}</b> <span class="muted">${esc(l.says)}</span></li>`).join('');
    const reward = E.reward.length ? E.reward.map((r) => `${r.n} ${r.item}`).join(', ') : 'nothing yet';
    return `<div class="card er"><div class="card-h"><span class="eyebrow">Errand · for ${esc(G.levels[E.giver]?.name ?? E.giver)}</span><h3>${esc(E.id)}</h3></div>`
      + `<figure class="canvas er-route">${route(E, G, esc)}</figure>`
      + `<table class="wcd-t"><thead><tr><th>item</th><th>where</th><th>how it is had</th><th>its cargo</th><th>asked</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<p class="muted">Reward: ${esc(reward)}.</p><ul class="wcd-laws">${laws}</ul></div>`;
  }).join('');
  return `<section class="part" id="errands"><div class="part-h"><span class="eyebrow">Sent out, brought home</span><h2>The errands</h2></div>${cards}</section>`;
}

/** The page's rules, laid with the book's own (beside the dungeon's table and laws). */
export const ERRAND_CSS = '.er{margin-bottom:18px}.er-route{padding:6px 8px}.er-k{font:600 11px var(--mono);fill:var(--ink);text-transform:uppercase;letter-spacing:.06em}'
  + '.er-n{font:10.5px var(--mono);fill:var(--muted)}';
