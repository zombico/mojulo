/**
 * THE SIDE MAP IN ITS BOOK (docs/side-map-principles.md "In the book"): a side map level's page in its world's gameworld
 * bible, read off the map as its level builds it (levels.js: the level's or the world's geocube, else the side strip's;
 * the side map's hero, the world's feel), so the book and the game cannot disagree.
 *
 *   the elevation  the map as the side map draws it (drawing.js): its zones numbered, its rulers, the bot's line through
 *                  it, its checkpoints, doors, ladders and pickups, where the dress places its things, and its laws
 *   the zones      a row each: its place (indoor or out, its material), its run (across, up, down, a room), its size in
 *                  screens, what it is for (what it teaches, its beat, its climb, its drop), its spawners, pickups and
 *                  crates
 *   the laws       every law the map is held to and what each says: the machine gate, measured; the eyes gate is the
 *                  person's, who plays it
 *
 *   sideMapOfLevel(G, id)              → the level's map, built as its stage builds it (cached per world)
 *   sideMapPlanSvg(M, { width? })      → a small plan: the zones in their places' keys, the closed parts, numbered
 *   sideMapPage(G, esc)                → the section's html, '' for a world with no side map level
 *   SIDE_MAP_CSS
 *
 * Pure: the same world, the same page.
 */
import { sideMapOf, SIDE_MAP_STATURE } from './scene.js';
import { drawSideMap } from './drawing.js';
import { resolveLevel } from '../world.js';
import { SIDE_CUBE } from '../../era/geocube-side.js';

const INK = '#1d1b20', r1 = (v) => Math.round(v * 10) / 10;

const built = new WeakMap();
/** The level's map, as its stage builds it: on the level's cube (or the world's, or the side strip's), for the side
 * map's hero, in the world's feel. */
export function sideMapOfLevel(G, id) {
  const per = built.get(G) ?? built.set(G, new Map()).get(G);
  if (!per.has(id)) {
    const R = resolveLevel(G, id);
    per.set(id, sideMapOf({ kind: 'geocube', show: 'sidemap', cube: R.style?.geocube ?? G.style?.geocube ?? SIDE_CUBE, seed: R.seed, sidemap: R.sidemap, stature: SIDE_MAP_STATURE, ...(G.feel ? { feel: G.feel } : {}) }));
  }
  return per.get(id);
}

/** A small plan of the map: each zone in its place's key, the closed parts over it, each zone numbered. */
export function sideMapPlanSvg(M, { width = 300 } = {}) {
  const Z = M.layout.zones, s0 = Math.min(...Z.map((z) => z.rect[0])), s1 = Math.max(...Z.map((z) => z.rect[1]));
  const z0 = Math.min(...Z.map((z) => z.rect[2])), z1 = Math.max(...Z.map((z) => z.rect[3])), k = width / (s1 - s0), h = r1((z1 - z0) * k);
  const X = (s) => r1((s - s0) * k), Y = (z) => r1((z1 - z) * k), o = [];
  const key = (i) => M.dress.zones.find((d) => d.zone === i);
  for (const z of Z) o.push(`<rect x="${X(z.rect[0])}" y="${Y(z.rect[3])}" width="${r1((z.rect[1] - z.rect[0]) * k)}" height="${r1((z.rect[3] - z.rect[2]) * k)}" fill="${key(z.i)?.void ?? '#222'}" stroke="${key(z.i)?.key ?? INK}" stroke-width="1"/>`);
  for (const s of M.layout.solids) o.push(`<rect x="${X(s.s0)}" y="${Y(s.z1)}" width="${r1(Math.max(0.6, (s.s1 - s.s0) * k))}" height="${r1(Math.max(0.6, (s.z1 - s.z0) * k))}" fill="${key(s.zone)?.key ?? '#888'}"/>`);
  for (const z of Z) o.push(`<text x="${r1(X(z.rect[0]) + 3)}" y="${r1(Y(z.rect[3]) + 10)}" font-size="9" font-family="ui-monospace,monospace" fill="#fff">${z.i}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="${width}" role="img" aria-label="the side map's plan">${o.join('')}</svg>`;
}

/** what a zone is for, in words */
function zoneFor(z, esc) {
  const w = [];
  if (z.teach) w.push(z.teach === 'boss' ? 'the boss' : `teaches: ${z.teach}`);
  if (z.beat) w.push(`beat: ${z.beat}`);
  if (z.climb) w.push(`climbed as ${z.climb}`);
  if (z.drop) w.push(`dropped as ${z.drop}`);
  return esc(w.join(' · ') || '—');
}

/** The side map levels' section of the book. */
export function sideMapPage(G, esc) {
  const ids = (G.ids ?? Object.keys(G.levels ?? {})).filter((id) => G.levels[id]?.sidemap);
  if (!ids.length) return '';
  const pages = ids.map((id) => {
    const M = sideMapOfLevel(G, id), L = M.layout, words = G.levels[id].sidemap, W = L.screen.width, H = L.screen.height;
    const count = (list, i) => list.filter((x) => x.zone === i).length;
    const across = (Math.max(...L.zones.map((z) => z.rect[1])) - Math.min(...L.zones.map((z) => z.rect[0]))) / W;
    const rows = L.zones.map((z) => {
      const d = M.dress.zones.find((x) => x.zone === z.i), sw = (z.rect[1] - z.rect[0]) / W, sh = (z.rect[3] - z.rect[2]) / H;
      const things = [count(L.spawners, z.i) ? `${count(L.spawners, z.i)} spawner${count(L.spawners, z.i) === 1 ? '' : 's'}` : '', count(L.pickups, z.i) ? `${count(L.pickups, z.i)} pickup${count(L.pickups, z.i) === 1 ? '' : 's'}` : '', L.crates ? (count(L.crates, z.i) ? `${count(L.crates, z.i)} crate${count(L.crates, z.i) === 1 ? '' : 's'}` : '') : ''].filter(Boolean).join(', ');
      return `<tr><td class="mono">${z.i}</td><td>${d ? `<span class="sw" style="background:${esc(d.key)}"></span>${esc(d.place)}` : '—'}<span class="muted">${d ? ` · ${d.indoor ? 'indoors' : 'outdoors'}${d.material ? `, ${esc(d.material)}` : ''}` : ''}</span></td>`
        + `<td>${esc(z.kind === 'room' ? 'a room' : z.run)}</td><td class="mono">${r1(sw)} × ${r1(sh)}</td><td>${zoneFor(z, esc)}</td><td>${esc(things || '—')}</td></tr>`;
    }).join('');
    const held = M.laws.filter((l) => l.holds).length, laws = M.laws.map((l) => `<li class="${l.holds ? 'ok' : 'off'}"><b>${l.holds ? '✓' : '✗'} ${esc(l.id)}</b> ${esc(l.says)}</li>`).join('');
    const cube = typeof M.cube?.id === 'string' ? M.cube.id : typeof words?.cube === 'string' ? words.cube : null;
    return `<div class="side-level" id="sidemap-${esc(id)}"><h3>${esc(G.levels[id].name ?? id)}</h3>${words.premise ? `<p class="muted">${esc(words.premise)}</p>` : ''}`
      + `<p class="mono">${L.zones.length} zones · ${r1(across)} screens across · its setting ${esc(M.dress.setting ?? '—')}${cube ? ` · on the geocube ${esc(cube)}` : ''}${words.boss ? ` · its boss ${esc(words.boss)}` : ''}</p>`
      + `<div class="canvas side-plate">${drawSideMap(M)}</div>`
      + `<table class="wcd-t"><thead><tr><th>zone</th><th>its place</th><th>run</th><th>screens</th><th>what it is for</th><th>in it</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<details><summary>Its laws · ${held} of ${M.laws.length} hold</summary><p class="muted">The machine gate: each measured on the map as built. The eyes gate is the person's, who plays it.</p><ul class="box-laws">${laws}</ul></details></div>`;
  }).join('');
  return `<section class="part" id="sidemaps"><div class="part-h"><span class="eyebrow">Level design</span><h2>The side map${ids.length === 1 ? '' : 's'}: zones, the way through and its laws</h2></div>${pages}</section>`;
}

export const SIDE_MAP_CSS = '.side-level{display:grid;gap:12px;margin-bottom:28px}.side-plate{overflow-x:auto}.side-plate svg{display:block;max-width:none}'
  + '.box-laws{margin:0;padding-left:0;list-style:none;display:grid;gap:4px;font-size:13px}.box-laws li.off b{color:#b0353a}';
