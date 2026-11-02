/**
 * THE GAUNTLETS' PAGE in a world's book (bible-html.js): each level held as a wave gauntlet (gauntlet.js) drawn as its
 * grid, N arenas × N waves, each cell the wave's mix and how many it wakes, an arena's checkpoint marked; beside it the
 * laws' verdicts. Drawn in the book's own variables, so a skin recolours it.
 *
 *   gauntletPage(G, esc) → the section's html, '' for a world with no gauntlet
 *
 * Pure: the same world, the same page.
 */
import { gauntletLaws } from './gauntlet.js';

const weight = (W) => Object.values(W).reduce((n, c) => n + c, 0);

/** The gauntlets' section of the book. */
export function gauntletPage(G, esc) {
  const ids = (G.ids ?? Object.keys(G.levels ?? {})).filter((id) => G.levels[id]?.goal?.gauntlet);
  if (!ids.length) return '';
  const cards = ids.map((id) => {
    const E = G.levels[id].goal.gauntlet, cols = Math.max(...E.arenas.map((a) => a.waves.length));
    // (a timed gauntlet's cells say when each wave comes, its first a second in)
    let clock = 0;
    const when = E.pace === 'timed' ? E.arenas.map((a) => a.waves.map(() => { const t = clock ? clock + (E.every ?? 20) : 1; clock = t; return t; })) : null;
    const head = `<tr><th>arena</th>${Array.from({ length: cols }, (_, w) => `<th>wave ${w + 1}</th>`).join('')}<th>foes</th></tr>`;
    const rows = E.arenas.map((a, i) => {
      const cp = E.checkpoint && i % E.checkpoint === 0 ? ' <span class="stamp st-approved">checkpoint</span>' : '';
      const cells = Array.from({ length: cols }, (_, w) => { const W = a.waves[w]; return `<td class="mono">${W ? `${esc(Object.entries(W).map(([k, c]) => `${c} ${k}`).join(' + '))}${when ? ` <span class="muted">@${when[i][w]} s</span>` : ''}` : ''}</td>`; }).join('');
      return `<tr><td class="mono"><b>${i + 1}</b>${cp}</td>${cells}<td class="mono">${a.waves.reduce((n, W) => n + weight(W), 0)}</td></tr>`;
    }).join('');
    const laws = gauntletLaws(E).map((l) => `<li><span class="stamp ${l.holds ? 'st-approved' : 'st-changed'}">${l.holds ? 'holds' : 'advise'}</span> <b class="mono">${esc(l.law)}</b> <span class="muted">${esc(l.says)}</span></li>`).join('');
    const waves = E.arenas.reduce((n, a) => n + a.waves.length, 0);
    return `<div class="card"><div class="card-h"><span class="eyebrow">${E.arenas.length} arena${E.arenas.length === 1 ? '' : 's'} × ${waves} wave${waves === 1 ? '' : 's'}</span><h3>${esc(G.levels[id].name ?? id)}</h3></div>`
      + `<p class="muted">${E.pace === 'timed' || E.outlast ? `To endure: sealed in its last stage${E.outlast ? ` until ${E.outlast} s have passed` : ' until every wave is down'}; ${E.pace === 'timed' ? `a wave every ${E.every ?? 20} s, whatever still stands` : 'each wave when the last is cleared'}. A death fails it.` : `Sealed in its last stage until every wave is down; each wave wakes when the last is cleared. A death begins ${E.checkpoint ? `again from the last checkpoint (every ${E.checkpoint})` : 'the arena again'}.`}</p>`
      + `<table class="wcd-t"><thead>${head}</thead><tbody>${rows}</tbody></table><ul class="wcd-laws">${laws}</ul></div>`;
  }).join('');
  return `<section class="part" id="gauntlets"><div class="part-h"><span class="eyebrow">Sealed until nothing is left alive</span><h2>The wave gauntlets</h2></div>${cards}</section>`;
}
