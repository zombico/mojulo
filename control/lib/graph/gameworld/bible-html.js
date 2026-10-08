/**
 * THE GAMEWORLD BIBLE — a world's binder for the creator who makes it: its cover and its levels in the order they are
 * played, the world map drawn from its graph, the style (the ground), its civilizations (who builds on it, and how), a
 * page for each level (its walk, what stands on its ground and who built it, how it differs from its world) and the
 * parts of a game left open. Every plate is drawn by its builder.
 *
 * `gameworldBibleHtml(world)` is pure (the same world, the same page). Each plate is fenced `<!--plate:name-->…
 * <!--/plate-->` so a script can swap its SVG for an image (`out-sheet.mjs gameworld --raster`).
 */
import { readGameworld, resolveLevel, RESERVED } from './world.js';
import { gameworldGraph, graphOutline, graphMermaid } from './graph.js';
import { styleGuide, kitCard, civilizationCard } from './style-guide.js';
import { layLevel } from '../level/index.js';
import { outTrailPlanSvg } from '../era/out-trail-board.js';
import { localMeruPlanSvg } from '../local-meru/premap.js';
import { structureStyle } from '../era/out-structures.js';
import { structurePaint } from '../era/out-structures-paint.js';
import { designTown } from '../era/out-town.js';
import { townMapSvg, townAxonSvg, resetTownIds } from '../era/out-town-html.js';
import { designCastle, castleFaces } from '../era/out-castle.js';
import { speak } from '../era/out-anchor-structure.js';
import { drawStructures } from '../era/out-structures-draw.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plate = (name, svg) => `<!--plate:${name}-->${svg}<!--/plate-->`;
const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? esc(v.id ?? (v.seed !== undefined ? `seeded ${v.seed}` : 'its own')) : esc(v));
const SECTION_WORDS = { trail: 'trail', meru: 'climb' };

// the plates a world's parts are drawn as
function castleAxon(c, paint, w = 1000, h = 700) {
  const F = castleFaces(c, { most: 2 }), m = c.ditch.d1 + 4;
  const ground = { corners: [[c.extent.x0 - m, c.extent.y0 - m, c.z], [c.extent.x1 + m, c.extent.y0 - m, c.z], [c.extent.x1 + m, c.extent.y1 + m, c.z], [c.extent.x0 - m, c.extent.y1 + m, c.z]], normal: [0, 0, 1], part: 'ground', group: 'town:grass', value: 0.3 };
  return drawStructures(F.groups, { view: 'axon', paint, w, h, pad: 14, floor: [ground, ...F.floor] });
}
function houseRow(L, kit, seed) {
  const st = structureStyle(kit, seed), paint = structurePaint(kit);
  return [['dwelling', { w: 9, d: 13 }, {}], ['shop', { w: 8, d: 13 }, {}], ['hall', { w: 14, d: 18 }, { accent: true }], ['tower', { w: 7, d: 8 }, {}]].map(([use, lot, o], i) => {
    const d = speak(L, use, lot, st, seed + i, { ring: 'near', ...o });
    return `<figure class="house">${plate(`house-${L.id}-${use}`, drawStructures([[...d.faces, ...d.tile]], { view: 'axon', paint, w: 260, h: 240 }))}<figcaption>${esc(use)} · ${d.measures.ridge} m</figcaption></figure>`;
  }).join('');
}

// a level, built: its stages, its town, its castle, its plates
function buildLevel(G, id) {
  const R = resolveLevel(G, id), laid = layLevel(R.level), st = structureStyle(R.style.kit, R.seed), paint = structurePaint(R.style.kit);
  const town = R.town ? designTown(st, R.seed, R.town) : null;
  const walk = laid.stages.map((s) => ({ node: s.node, section: s.section, svg: s.section === 'trail' ? outTrailPlanSvg(s.manifest, 300) : localMeruPlanSvg(s.manifest.meru, 360) }));
  return { R, laid, town, paint, walk };
}

// the world map, drawn from the graph: the levels in the order they lead on, each its sections and its places
function worldMapSvg(g, order) {
  const by = Object.fromEntries(g.nodes.map((n) => [n.id, n])), colW = 250, gap = 70, pad = 24;
  const inside = (id) => g.edges.filter((e) => e.from === id && e.kind === 'contains').map((e) => e.to);
  const cols = order.map((id) => {
    const lv = `level:${id}`, secs = inside(lv).filter((x) => by[x].kind === 'section'), places = [];
    const add = (x) => { for (const y of inside(x)) if (by[y].kind === 'place') { places.push(y); add(y); } };
    add(lv);
    const local = g.edges.filter((e) => e.kind === 'overrides' && (e.from === lv || e.from.startsWith(`section:${id}/`) || e.from.startsWith(`place:${id}/`)));
    return { id, lv, secs, places, local };
  });
  const rows = Math.max(...cols.map((c) => c.secs.length + c.places.length + (c.local.length ? 1 : 0)));
  const W = pad * 2 + cols.length * colW + (cols.length - 1) * gap, H = pad * 2 + 54 + rows * 40 + 10, o = [];
  const x0 = (i) => pad + i * (colW + gap);
  cols.forEach((c, i) => {
    const x = x0(i), n = by[c.lv];
    o.push(`<rect x="${x}" y="${pad}" width="${colW}" height="${H - pad * 2}" rx="6" fill="var(--sheet)" stroke="var(--ink)" stroke-width="1.5"/>`);
    const settled = by[g.edges.find((e) => e.from === c.lv && e.kind === 'settled-by').to].label;
    o.push(`<text x="${x + 14}" y="${pad + 26}" class="wm-h">${esc(n.label)}</text><text x="${x + 14}" y="${pad + 44}" class="wm-s">${esc(n.kit)} · ${esc(settled)}${n.start ? ' · start' : ''}</text>`);
    let y = pad + 62;
    c.secs.forEach((s, k) => {
      const S = by[s];
      o.push(`<rect x="${x + 14}" y="${y}" width="${colW - 28}" height="28" rx="3" fill="var(--c-${S.section})" opacity=".16"/><rect x="${x + 14}" y="${y}" width="4" height="28" fill="var(--c-${S.section})"/><text x="${x + 26}" y="${y + 19}" class="wm-n">${esc(S.label)}</text><text x="${x + colW - 20}" y="${y + 19}" text-anchor="end" class="wm-s">${SECTION_WORDS[S.section]}</text>`);
      if (k < c.secs.length - 1) o.push(`<path d="M${x + 30} ${y + 28} v12" stroke="var(--ink)" stroke-width="1.5" marker-end="url(#wm-a)"/>`);
      y += 40;
    });
    for (const p of c.places) { o.push(`<rect x="${x + 14}" y="${y}" width="${colW - 28}" height="28" rx="14" fill="none" stroke="var(--c-place)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${x + 30}" y="${y + 19}" class="wm-n">${esc(by[p].label)}</text><text x="${x + colW - 20}" y="${y + 19}" text-anchor="end" class="wm-s">by ${esc(by[g.edges.find((e) => e.from === p && e.kind === 'built-by').to].label)}</text>`); y += 40; }
    if (c.local.length) o.push(`<text x="${x + 14}" y="${y + 18}" class="wm-l">its own: ${esc([...new Set(c.local.map((e) => e.key))].join(', '))}</text>`);
  });
  for (const e of g.edges.filter((x) => x.kind === 'leads')) {
    const a = order.indexOf(e.from.slice(6)), b = order.indexOf(e.to.slice(6)); if (a < 0 || b < 0) continue;
    const ya = pad + 30, xa = a < b ? x0(a) + colW : x0(a), xb = a < b ? x0(b) : x0(b) + colW;
    o.push(`<path d="M${xa} ${ya} C ${(xa + xb) / 2} ${ya - 14}, ${(xa + xb) / 2} ${ya - 14}, ${xb - (a < b ? 6 : -6)} ${ya}" fill="none" stroke="var(--ink)" stroke-width="2" ${e.via === 'gate' ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#wm-a)"/><text x="${(xa + xb) / 2}" y="${ya - 16}" text-anchor="middle" class="wm-s">${esc(e.via)}</text>`);
  }
  return `<svg class="worldmap" viewBox="0 0 ${W} ${H}" width="${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The world map"><defs><marker id="wm-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker></defs>${o.join('')}</svg>`;
}

// the levels in the order they are played: from the start, along its links, then any left
function playOrder(G) {
  const order = [G.start];
  for (let more = true; more;) { more = false; for (const l of G.links) if (order.includes(l.from) && !order.includes(l.to)) { order.push(l.to); more = true; } }
  return [...order, ...G.ids.filter((id) => !order.includes(id))];
}

const ramps = (card) => `<div class="ramps">${card.ramps.map((r) => `<div><div class="ramp">${r.stops.map((h) => `<i style="background:${h}"></i>`).join('')}</div><div class="ramp-l">${esc(r.name)}</div></div>`).join('')}</div>`;

/** The bible of a gameworld, as one page. */
export function gameworldBibleHtml(world) {
  resetTownIds();
  const G = readGameworld(world), order = playOrder(G), graph = gameworldGraph(G), guide = styleGuide(G);
  const built = Object.fromEntries(order.map((id) => [id, buildLevel(G, id)]));
  const first = built[order.find((id) => built[id].town) ?? order[0]];
  const cover = first.town ? plate('cover', townAxonSvg(first.town, first.paint, null, { w: 1500, h: 900 })) : first.walk[0].svg;

  // where each civilization builds: its places, and the kit it is first drawn in
  const builds = Object.fromEntries(G.civIds.map((c) => [c, []]));
  for (const id of order) { const B = built[id].R.built; if (B) { builds[B.town].push([id, 'town']); if (B.castle) builds[B.castle].push([id, 'castle']); } }

  const strip = order.map((id, i) => {
    const b = built[id], thumb = b.town ? plate(`strip-${id}`, townMapSvg(b.town, b.paint, null, { px: 2, labels: false })) : b.walk[0].svg;
    const next = G.links.find((l) => l.from === id);
    return `<a class="stop" href="#level-${esc(id)}"><div class="im">${thumb}</div><div class="cap"><i>${i + 1}</i><b>${esc(b.R.name)}</b></div></a>${next && i < order.length - 1 ? `<div class="joint"><span>${esc(next.kind)}</span><svg viewBox="0 0 26 12"><path d="M1 6H22" stroke="var(--ink)" stroke-width="2" ${next.kind === 'gate' ? 'stroke-dasharray="4 3"' : ''}/><path d="M19 1L25 6L19 11" fill="none" stroke="var(--ink)" stroke-width="2"/></svg></div>` : ''}`;
  }).join('');

  const kitHtml = `<article class="card" id="guide-kit"><div class="card-h"><span class="eyebrow">Kit</span><h3>${esc(guide.kit.id)}</h3></div>${ramps(guide.kit)}<ul class="principles">${guide.kit.principles.slice(0, 6).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></article>`;
  const gr = guide.ground, row = (o) => Object.entries(o).map(([k, v]) => `${esc(k)} ${show(v)}`).join(' · ') || 'its card\'s own';
  const groundHtml = `<article class="card" id="guide-ground"><div class="card-h"><span class="eyebrow">The ground's character</span><h3>Handed down</h3></div><dl class="vocab"><dt>trails</dt><dd>${row(gr.trail)}</dd><dt>climbs</dt><dd>${row(gr.meru)}</dd><dt>builds</dt><dd>${esc(G.civilizations[G.style.civilization].name)}, unless a level or a place names another</dd></dl></article>`;

  // each civilization, drawn in the kit it is first found in: its houses, its castle, how it lays out a town
  const civHtml = G.civIds.map((cid) => {
    const C = G.civilizations[cid], at = builds[cid][0], kit = at ? built[at[0]].R.style.kit : G.style.kit, card = civilizationCard(C, kit, G.seed), V = card.language.vocab, I = card.fort.influence;
    const castle = designCastle(structureStyle(kit, G.seed), G.seed, { fort: C.fort, ...(C.anchor !== undefined ? { anchor: C.anchor } : {}), ...(C.castle || {}) });
    const where = builds[cid].length ? builds[cid].map(([id, what]) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a> · ${what}`).join('<br>') : 'nowhere yet';
    return `<article class="civ" id="civ-${esc(cid)}"><div class="civ-h"><div><span class="eyebrow">Civilization · ${esc(cid)}</span><h3>${esc(C.name)}</h3></div><p class="muted mono">${esc(card.language.id)} · ${esc(card.fort.id)} · drawn in ${esc(kit)}</p></div>
<p class="read">${esc(card.language.read)}</p><div class="houses">${houseRow(card.language.language, kit, G.seed)}</div>
<div class="fort"><div class="fort-im">${plate(`civ-castle-${cid}`, castleAxon(castle, structurePaint(kit)))}</div><div><p class="read">${esc(card.fort.read)}</p><h4>What its language makes of a castle</h4><dl class="vocab"><dt>wall</dt><dd>${esc(I.read[0])}</dd><dt>towers</dt><dd>${esc(I.read[1])}</dd><dt>keep</dt><dd>${esc(I.read[2])}</dd></dl>
<h4>Its houses</h4><dl class="vocab">${[['mass', V.mass], ['cap', V.cap], ['lights', V.opening], ['entry', V.entry], ['tiers', V.tiers ? 'yes' : 'no'], ['ornaments', V.ornaments.join(', ') || 'none']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>towns</dt><dd>${row(card.town)}</dd><dt>castles</dt><dd>${row(card.castle)}</dd><dt>builds in</dt><dd>${where}</dd></dl></div></div></article>`;
  }).join('');

  const levels = order.map((id, i) => {
    const b = built[id], R = b.R, own = R.ledger;
    const ledger = own.length ? `<ul class="ledger">${own.map((o) => `<li><b>${esc(o.key)}</b> ${show(o.local)} <span>world: ${show(o.world)}</span>${o.scope !== 'level' ? ` <em>${esc(o.at.split('/')[1])}</em>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Follows its world in everything.</p>';
    const ownStyle = [];
    if (R.style.kit !== G.style.kit) ownStyle.push(`<div class="own"><span class="eyebrow">Its own kit · ${esc(R.style.kit)}</span>${ramps(kitCard(R.style.kit))}</div>`);
    const by = R.built ? [['town', R.built.town], ...(R.built.castle ? [['castle', R.built.castle]] : [])] : [];
    if (by.length) ownStyle.unshift(`<div class="own"><span class="eyebrow">Built by</span><ul class="ledger">${by.map(([what, c]) => `<li><b>${what}</b> <a href="#civ-${esc(c)}">${esc(G.civilizations[c].name)}</a></li>`).join('')}</ul></div>`);
    const walk = b.walk.map((w, k) => `<figure class="sec"><div class="sec-im">${plate(`walk-${id}-${w.node}`, w.svg)}</div><figcaption><i>${k + 1}</i> ${esc(w.node)} · ${SECTION_WORDS[w.section]}</figcaption></figure>${k < b.walk.length - 1 ? '<div class="seam" aria-hidden="true">→</div>' : ''}`).join('');
    const places = b.town ? `<div class="places"><figure>${plate(`town-${id}`, townMapSvg(b.town, b.paint, null, { px: 3, labels: true }))}<figcaption>The town${b.town.castle ? ' and its castle' : ''}, by ${esc(G.civilizations[R.built.town].name)}${R.built.castle && R.built.castle !== R.built.town ? ` and ${esc(G.civilizations[R.built.castle].name)}` : ''} · ${b.town.laws.filter((l) => !l.ok).length ? `${b.town.laws.filter((l) => !l.ok).length} laws advise` : 'every law holds'}</figcaption></figure>${b.town.castle ? `<figure>${plate(`castle-${id}`, castleAxon(b.town.castle, b.paint))}<figcaption>The castle standing, by ${esc(G.civilizations[R.built.castle].name)}</figcaption></figure>` : ''}</div>` : '';
    return `<section class="part level" id="level-${esc(id)}"><div class="level-h"><span class="eyebrow">Level ${i + 1}${id === G.start ? ' · start' : ''}</span><h2>${esc(R.name)}</h2><p class="muted mono">${esc(R.style.kit)} · seed ${R.seed} · ${b.laid.order.length} section${b.laid.order.length === 1 ? '' : 's'}</p></div>
<div class="level-grid"><div><h4>The walk</h4><div class="walk">${walk}</div>${places ? `<h4>On its ground</h4>${places}` : ''}</div><aside class="local"><h4>Local</h4>${ledger}${ownStyle.join('')}</aside></div></section>`;
  }).join('\n');

  const open = RESERVED.map((k) => `<article class="card open"><div class="card-h"><span class="eyebrow">Open</span><h3>${esc(k[0].toUpperCase() + k.slice(1))}</h3></div><p class="muted">Not on the ground. The world leaves room for them${k === 'characters' ? ', and for the people of its civilizations' : ''}.</p></article>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(G.name)} · Gameworld bible</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">
<style>${CSS}</style></head><body><div class="wrap">
<div class="mast"><div class="t">Gameworld bible</div><div class="eyebrow">${esc(G.id)} · seed ${G.seed}</div></div>
<nav class="tabs" aria-label="Sections"><a href="#cover">World</a><a href="#map">World map</a><a href="#guide">Style</a><a href="#civilizations">Civilizations</a>${order.map((id) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a>`).join('')}<a href="#open">Open</a></nav>
<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">${order.length} level${order.length === 1 ? '' : 's'} · ${esc(G.style.kit)} · ${G.civIds.length} civilization${G.civIds.length === 1 ? '' : 's'}</p></div><figure class="hero">${cover}</figure></div>
<div class="eyebrow">The levels, in the order they are played</div><div class="strip">${strip}</div></section>
<section class="part" id="map"><div class="part-h"><span class="eyebrow">World map</span><h2>The world, drawn from its graph</h2></div><div class="canvas">${worldMapSvg(graph, order)}</div>
<details><summary>The graph as an outline</summary><pre>${esc(graphOutline(graph))}</pre></details>
<details><summary>The graph as a flowchart (Mermaid)</summary><pre>${esc(graphMermaid(graph))}</pre></details>
<script type="application/json" id="gameworld-graph">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script></section>
<section class="part" id="guide"><div class="part-h"><span class="eyebrow">Style</span><h2>The ground every level inherits</h2></div><div class="cards">${kitHtml}${groundHtml}</div></section>
<section class="part" id="civilizations"><div class="part-h"><span class="eyebrow">Civilizations</span><h2>Who builds on it</h2></div>${civHtml}</section>
${levels}
<section class="part" id="open"><div class="part-h"><span class="eyebrow">Open</span><h2>Beyond the ground</h2></div><div class="cards">${open}</div></section>
<footer><span class="eyebrow">Every plate drawn from its recipe</span><span class="eyebrow">Scapeshift</span></footer>
</div></body></html>`;
}

const CSS = `
:root{--paper:#eef1f4;--sheet:#fff;--ink:#17202e;--muted:#5b6676;--rule:#d3d9e0;--dot:#c3cad3;--c-trail:#3a8a57;--c-meru:#b9822a;--c-place:#b14f39;--local:#b14f39;
--display:"Big Shoulders Display","Arial Narrow",sans-serif;--body:"Public Sans","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--paper:#0f141b;--sheet:#171e28;--ink:#e6eaf0;--muted:#99a4b3;--rule:#2b3543;--dot:#2b3543;--c-trail:#5cb57c;--c-meru:#dba44a;--c-place:#dd7a62;--local:#dd7a62;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 var(--body)}
.wrap{max-width:1240px;margin-inline:auto;padding-inline:20px;padding-block:0 64px}
h1,h2,h3{font-family:var(--display);font-weight:800;letter-spacing:.01em;line-height:1;margin:0;text-transform:uppercase;text-wrap:balance}
h4{margin:18px 0 8px;font:500 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
p{margin:0}.mono{font-family:var(--mono)}.muted{color:var(--muted);font-size:13.5px}
.eyebrow{font:400 11.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
svg,img{max-width:100%;height:auto;display:block}figure{margin:0}
.mast{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 24px;padding-block:22px 14px;border-bottom:2px solid var(--ink)}
.mast .t{font:800 22px var(--display);letter-spacing:.06em;text-transform:uppercase}
.tabs{position:sticky;top:0;z-index:5;background:var(--paper);display:flex;gap:4px;overflow-x:auto;padding-top:10px;border-bottom:1px solid var(--rule)}
.tabs a{flex:none;font:400 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:var(--muted);padding:8px 14px 9px;border:1px solid var(--rule);border-bottom:0;border-radius:6px 6px 0 0;background:var(--sheet)}
.tabs a:hover{color:var(--ink);box-shadow:inset 0 3px 0 var(--ink)}
.part{padding-top:56px;scroll-margin-top:48px;display:grid;gap:18px}
.part-h{display:grid;gap:6px}.part-h h2,.level-h h2{font-size:clamp(34px,5vw,52px)}
.cover{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:32px;align-items:end;padding-top:20px}
.cover h1{font-size:clamp(44px,6.4vw,84px);line-height:.92;overflow-wrap:anywhere}.cover .lede{margin-top:16px;font:400 13px var(--mono);color:var(--muted)}
.hero{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:10px}
.strip{display:flex;overflow-x:auto;padding-bottom:6px}
.stop{flex:none;width:220px;display:grid;gap:6px;text-decoration:none;color:inherit}
.stop .im{height:150px;border:1.5px solid var(--ink);border-radius:3px;overflow:hidden;background:var(--sheet);display:grid;place-items:center}
.stop .im svg,.stop .im img{width:100%;height:100%;max-width:none;object-fit:cover}
.stop .cap{display:flex;gap:8px;align-items:baseline}.stop .cap i{font:normal 11px var(--mono);color:var(--muted)}.stop .cap b{font:800 19px var(--display);text-transform:uppercase}
.stop:hover b{text-decoration:underline}
.joint{flex:none;width:64px;display:grid;place-items:center;align-content:center;gap:2px;height:150px}.joint span{font:10px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.joint svg{width:26px}
.canvas{background-color:var(--sheet);background-image:radial-gradient(var(--dot) 1px,transparent 1.2px);background-size:18px 18px;border:1px solid var(--rule);border-radius:6px;overflow-x:auto;padding:8px}
.worldmap{max-width:none;width:auto}.wm-h{font:800 20px var(--display);fill:var(--ink);text-transform:uppercase}.wm-n{font:500 13px var(--body);fill:var(--ink)}.wm-s{font:10.5px var(--mono);fill:var(--muted)}.wm-l{font:500 11px var(--mono);fill:var(--local)}
details{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:10px 14px}summary{cursor:pointer;font:12px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
pre{font:12px/1.5 var(--mono);white-space:pre;overflow-x:auto;margin:10px 0 0}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.card{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:16px;display:grid;gap:12px;align-content:start;min-width:0}
.card.wide{grid-column:1/-1}.card-h{display:grid;gap:4px}.card-h h3{font-size:28px}
.read{font-size:14.5px;max-width:80ch}
.ramps{display:flex;gap:8px;flex-wrap:wrap}.ramp{display:flex;height:26px;border-radius:3px;overflow:hidden;border:1px solid var(--rule)}.ramp i{width:16px}
.ramp-l{font:9.5px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.principles{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13.5px}
.vocab{display:grid;grid-template-columns:max-content 1fr;margin:0;border-top:1px solid var(--rule);font-size:13.5px}
.vocab dt,.vocab dd{margin:0;padding:6px 10px;border-bottom:1px solid var(--rule)}.vocab dt{font:10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding-top:8px}
.houses{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.house figcaption,.sec figcaption,.places figcaption{font:11px var(--mono);color:var(--muted);margin-top:4px}
.fort{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px;align-items:start}
.level-h{display:grid;gap:6px;border-top:2px solid var(--ink);padding-top:16px}
.level-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:24px;align-items:start}
.walk{display:flex;gap:6px;align-items:center;overflow-x:auto;padding-bottom:6px}
.sec{flex:none;width:240px}.sec-im{height:280px;border:1px solid var(--rule);border-radius:3px;background:#fff;display:grid;place-items:center;overflow:hidden}
.sec-im svg,.sec-im img{width:100%;height:100%;object-fit:contain}.sec figcaption i{font-style:normal;color:var(--ink)}
.seam{flex:none;font:18px var(--mono);color:var(--muted)}
.places{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.places svg,.places img{border:1px solid var(--rule);background:#fff;width:100%;height:auto}
.local{background:var(--sheet);border:1px solid var(--rule);border-top:3px solid var(--local);border-radius:4px;padding:4px 16px 16px;display:grid;gap:12px}
.ledger{margin:0;padding:0;list-style:none;display:grid;gap:8px;font-size:14px}.ledger b{font:500 12px var(--mono);color:var(--local)}.ledger span{color:var(--muted);font-size:12.5px}.ledger em{font:normal 11px var(--mono);color:var(--muted)}
.own{display:grid;gap:8px;border-top:1px dashed var(--rule);padding-top:12px}
.card.open{border-style:dashed;background:transparent}
.civ{background:var(--sheet);border:1px solid var(--rule);border-top:3px solid var(--ink);border-radius:4px;padding:16px;display:grid;gap:14px}.civ-h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:8px}.civ-h h3{font-size:34px}.vocab a,.ledger a{color:inherit}
footer{margin-top:56px;padding-top:14px;border-top:2px solid var(--ink);display:flex;justify-content:space-between;gap:8px 24px;flex-wrap:wrap}
@media (max-width:860px){.cover,.level-grid,.fort,.cards,.places{grid-template-columns:1fr}.houses{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
