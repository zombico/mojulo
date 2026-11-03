/**
 * THE ESCAPE ROOMS' PAGE in a world's book (bible-html.js): each level held as an escape room (a level goal's `escape`,
 * escape.js), what is locked and where its keys lie: its locks at the way out of its last stage, its keys along the way
 * (a trail's beats, a building's rooms on its route), the names its things travel by, and the door of the walled-core
 * dungeon its keys open, where one does. Drawn in the book's own variables, so a skin recolours it.
 *
 *   escapePage(G, esc) → the section's html, '' for a world with no escape room
 *
 * Pure: the same world, the same page.
 */

import { escapeNames } from '../game/escape-room.js';

/** The escape rooms' section of the book. */
export function escapePage(G, esc) {
  const ids = (G.ids ?? Object.keys(G.levels ?? {})).filter((id) => G.levels[id]?.goal?.escape);
  if (!ids.length) return '';
  const rows = ids.map((id) => {
    const L = G.levels[id], E = L.goal.escape, N = escapeNames(E.room), n = E.locks;
    const where = L.building ? `on the way through the ${esc(L.building.use ?? 'building')}'s rooms, one in each room passed` : 'along the trail\'s beats';
    const held = L.building ? 'a step short of the goal room\'s door' : 'on the approach to the trail\'s exit';
    // the walled-core dungeon's door its keys open (a keys gate leaving the space bound to this level)
    const space = G.wcd ? Object.values(G.wcd.spaces).find((s) => s.level === id) : null;
    const door = space ? G.wcd.doors.find((d) => d.from === space.id && d.gate?.keys) : null;
    const names = Array.from({ length: n }, (_, k) => `${N.key(k + 1)} → ${N.lock(k + 1)}`).join(', ');
    return `<tr><td><b>${esc(L.name ?? id)}</b></td><td class="mono">${n} lock${n === 1 ? '' : 's'}, ${held}</td><td>${n} key${n === 1 ? '' : 's'} ${where}</td>`
      + `<td class="mono">${esc(names)} · ${esc(N.seal)}</td><td class="mono">${door ? esc(`${door.via} ${door.from} → ${door.to}`) : '—'}</td></tr>`;
  }).join('');
  return `<section class="part" id="escape"><div class="part-h"><span class="eyebrow">Held until opened</span><h2>The escape rooms</h2></div>`
    + '<div class="card"><p class="muted">Each holds its last stage sealed: walking into the way out says how many locks hold and turns you back; every lock open lifts the seal, and the way out wins the level.</p>'
    + `<table class="wcd-t"><thead><tr><th>level</th><th>what is locked</th><th>where its keys lie</th><th>named</th><th>its keys open</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
