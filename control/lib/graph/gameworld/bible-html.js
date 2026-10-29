/**
 * THE GAMEWORLD BIBLE — a world's binder for the creator who makes it: its cover and its levels in the order they are
 * played, the world map drawn from its graph, the style (the ground), its civilizations (who builds on it, and how, and
 * what it makes: its machines, and the vehicles, tech-structures and weapons the crafter made of its words), a
 * page for each level (its walk, what stands on its ground and who built it, how it differs from its world) and the
 * parts of a game left open.
 *
 * The bible is the APPROVAL GATE (review.js): each part carries its stamp (approved, changed since, sent back with a
 * note, waiting, or decided by the agent in autonomous mode), the cover lists them with what to look at next, and an
 * autonomous world shows the prompt it was composed from and what each word decided.
 *
 * The natural world is the land each kit makes, designed as the buildings are: its forms (era/out-land.js: the lie of
 * the ground, rock formations, the sediment in a cliff, what a cliff's face is built of, clouds, natural landmarks)
 * drawn at the variant and the step from little to many the world chose, each step's strip beside it as guidance, and
 * the kit's card (its trees, grass, water, sky, light, air). The style and color key lays out every kit's ramps and
 * what each one paints. Every plate is drawn by its builder.
 *
 * `gameworldBibleHtml(world)` is pure (the same world, the same page). Each plate is fenced `<!--plate:name-->…
 * <!--/plate-->` so a script can swap its SVG for an image (`out-sheet.mjs gameworld --raster`).
 */
import { readGeocube, geocubeRamps } from '../era/geocube.js';
import { inferCity } from '../city/plan/card.js';
import { trackCourse } from '../roads/track.js';
import { designCity } from '../city/plan/design.js';
import { cityPlanSvg } from '../city/plan/book-html.js';
import { cubeOfWorld, intentReport, GENRES } from './intent.js';
import { engineOf } from '../scene/engines/registry.js';
import { concernsOf } from './concerns.js';
import { readGameworld, resolveLevel, OPEN_SLOTS, civLibrary } from './world.js';
import { rtsRoster } from '../board/board-rts-tech.js';
import { gameworldGraph, graphOutline, graphMermaid } from './graph.js';
import { styleGuide, civilizationCard } from './style-guide.js';
import { natureCard, colorKey, landFor } from './nature.js';
import { reviewState, MODES, STAMPS } from './review.js';
import { landLaws } from '../era/out-land.js';
import { designLand, manyStep, LAND_FORM_IDS } from '../era/out-land.js';
import { drawLand, manyStrip, landFit } from '../era/out-land-html.js';
import { withProgram, programPlanSvg } from '../era/programs.js';
import { buildingStage } from './levels.js';
import { skinHead } from './book-skin.js';
import { wcdPage, WCD_CSS } from './wcd-page.js';
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
import { buildBlock, blockPaint } from '../era/blocks.js';
import { tunnelBuilding } from './tunnel-buildings.js';
import { resolveTechDirection, MOTIFS } from './tech-direction.js';
import { ELEMENT_WORDS } from './element-words.js';
import { hasChassis } from './tech-chassis.js';
import { buildAdorned } from './tech-adornment.js';
import { CRAFTED } from './world.js';
import { weatherCardHtml } from './weather-card.js';
import { airOfKit } from './style-guide.js';
import { storyReport } from './runner.js';
import { airspaceOf } from '../skyscape/airspace.js';
import { feelReport } from './feel/lower.js';
import { feelSuggestion } from './feel/suggest.js';
import { POLES } from './feel/cards.js';
import { planCourse } from '../skyscape/course.js';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const plate = (name, svg) => `<!--plate:${name}-->${svg}<!--/plate-->`;

// what a tunnel did, in a line or two: the traits it read, the passes it took, what it tweaked, what it could not say
const tunnelLog = (T) => `<p class="muted"><b>${esc(T.intent)}</b> · read as ${esc(T.traits.join(', ') || 'nothing')}${T.unread.length ? ` · unread: ${esc(T.unread.join(', '))}` : ''} · ${T.passes} pass${T.passes === 1 ? '' : 'es'}${T.tweaks.length ? `, tweaked: ${esc(T.tweaks.join('; '))}` : ''} · ${T.complete ? 'every trait and law holds' : T.held ? 'holds, with gaps' : '<b>advises</b>'}</p>${T.gaps.map((g) => `<p class="muted">Gap · <b>${esc(g.trait)}</b>: ${esc(g.why)}. Would close it: ${esc(g.proposal)}.</p>`).join('')}`;
/** A civilization's building language as tunnelled from its words: the building it speaks, with its fittings. */
function tunnelHtml(C, cid, kit, seed, worldKit) {
  if (!C.tunnel) return '';
  const r = tunnelBuilding(C.builds.intent, { seed: C.builds.seed ?? seed, base: C.from, kitId: worldKit, library: civLibrary(C) });
  return `<div class="tunnel"><h4>Tunnelled from its words</h4><div class="fort"><div class="fort-im">${plate(`civ-tunnel-${cid}`, drawStructures([r.built.faces], { paint: blockPaint(kit, C.technology?.finish ?? 'alloy'), w: 360, h: 260 }))}</div><div>${tunnelLog(C.tunnel)}${C.fittings?.length ? `<p class="muted">Fittings: ${esc(C.fittings.map((m) => `${m.n > 1 ? `${m.n} × ` : ''}${m.block} on the ${m.on}`).join(', '))}.</p>` : ''}</div></div></div>`;
}
/** A civilization's technology: each thing it makes, drawn in its finish, and what its tunnel did. */
function techHtml(C, cid, kit, seed) {
  const T = C.technology;
  if (!T || !Object.keys(T.things).length) return '';
  const paint = blockPaint(kit, T.finish);
  return `<div class="tech"><h4>Its technology · ${esc(T.finish)}</h4><div class="things">${Object.entries(T.things).map(([id, t]) => { const b = buildBlock(t.block, { seed: t.seed ?? seed }); return `<figure>${plate(`civ-thing-${cid}-${id}`, drawStructures([b.faces], { paint, w: 240, h: 190 }))}<figcaption><b>${esc(id)}</b> · ${esc(t.block.tier)} · ${esc(t.block.functions.join(', '))}${tunnelLog(t.tunnel)}</figcaption></figure>`; }).join('')}</div></div>`;
}
/** What the crafter made of a civilization's words: its vehicles, its tech-structures, its weapons, each in its finish. */
const CRAFT_HEADS = { vehicles: 'Its vehicles', structures: 'Its tech-structures', weapons: 'Its weapons' };
function craftHtml(G, cid, kit, seed, stamp = () => '') {
  const C = G.civilizations[cid], T = C.technology;
  if (!T) return '';
  const paint = blockPaint(kit, T.finish), D = resolveTechDirection(G, cid), rank = (k, id) => D?.ranks[`${k}/${id}`];
  // the direction page: what every crafted thing it makes shares, each choice and where it came from
  const el = (w) => `<span style="display:inline-block;width:.9em;height:.9em;border-radius:2px;vertical-align:-1px;margin-right:4px;border:1px solid var(--rule);background:${esc(ELEMENT_WORDS[w].tint)}"></span>${esc(w)}`;
  const dir = D ? `<div class="tech tech-direction" id="tech-${esc(cid)}"><h4>Its technology: the direction ${stamp(`tech:${cid}`)}</h4><dl class="vocab">
<dt>style</dt><dd>${esc(D.style)} <span class="muted">(${esc(D.from.style)})</span></dd>
<dt>met through</dt><dd>${esc(D.camera)}</dd>
<dt>motif</dt><dd>${esc(D.motif)}: ${esc(MOTIFS[D.motif].read)} <span class="muted">(${esc(D.from.motif)})</span></dd>
<dt>elements</dt><dd>${D.elements.primary || D.elements.secondary ? [D.elements.primary, D.elements.secondary].filter(Boolean).map(el).join(' · ') : '—'} <span class="muted">(${esc(D.from.elements)})</span></dd>
<dt>tone</dt><dd>${esc(D.tone ?? '—')} <span class="muted">(${esc(D.from.tone)})</span></dd>
<dt>asymmetry</dt><dd>${esc(D.asymmetry)} <span class="muted">(${esc(D.from.asymmetry)}: one flank carries more, its weapon the counterweight)</span></dd>
<dt>team</dt><dd><span style="display:inline-block;width:.9em;height:.9em;border-radius:2px;vertical-align:-1px;margin-right:4px;border:1px solid var(--rule);background:${esc(D.team)}"></span>${esc(D.team)} <span class="muted">(${esc(D.from.team)}; a placement may pass its own)</span></dd>
</dl>${D.ledger.length ? `<ul class="ledger">${D.ledger.map((o) => `<li><b>${esc(o.key)}</b> ${show(o.local)} <span>default: ${show(o.world)}</span></li>`).join('')}</ul>` : ''}</div>` : '';
  return dir + Object.entries(CRAFT_HEADS).filter(([k]) => T[k] && Object.keys(T[k]).length).map(([k, head]) => `<div class="tech craft-${k}"><h4>${head} · ${esc(T.finish)}</h4><div class="things">${Object.entries(T[k]).map(([id, t]) => {
    const b = buildBlock(t.block, { seed: t.seed ?? seed });
    const r = rank(k, id);
    // a form with a chassis grammar is drawn as its chassis and its adornment (the 66 on its rig, the 33 on its sockets),
    // in the civilization's finish, read beside the hero through the camera
    if (D && hasChassis(CRAFTED[k], t.form)) {
      const c = buildAdorned(t, { kind: CRAFTED[k], direction: D, rank: r.rank, use: r.use }), R = c.readout;
      const faces = c.faces.map((f) => ({ corners: f.corners, normal: f.outNormal ?? [0, 0, 1], group: f.group ?? 'tech:body', value: f.value, mass: f.monomer }));
      const hung = [...new Set(c.picks.map((p) => p.piece))];
      return `<figure>${plate(`civ-${k}-${cid}-${id}`, drawStructures([faces], { paint, w: 240, h: 190 }))}<figcaption><b>${esc(id)}</b> · ${esc(t.variant)} · ${esc(r.rank)} · <span title="${esc(r.useWhy)}">${esc(r.use)}</span> · ${esc(c.functions.join(', '))}<p class="muted">${R.triangles} triangles (a ${esc(r.use)} ${esc(r.rank)}'s ceiling ${R.ceiling}) · facets ${R.facetPx.widest} px at ${R.distance} m, ${esc(D.camera)} · ${R.segments} silhouette segments · ${c.joints.length} joints, ${c.sockets.length} sockets · adorned with ${esc(hung.join(', '))} · ${c.held ? 'every law holds' : `<b>advises</b>: ${esc(c.laws.filter((l) => !l.ok).map((l) => l.law).join(', '))}`}${c.promised.length ? ` · promised and kept: ${esc(c.promised.join(', '))}` : ''}</p>${tunnelLog(t.tunnel)}</figcaption></figure>`;
    }
    return `<figure>${plate(`civ-${k}-${cid}-${id}`, drawStructures([b.faces], { paint, w: 240, h: 190 }))}<figcaption><b>${esc(id)}</b> · ${esc(t.variant)} · ${esc(t.block.tier)}${r ? ` · <span title="${esc(r.why)}">${esc(r.rank)}</span>` : ''} · ${esc(t.block.functions.join(', '))}${t.carries ? ` · carried as the ${esc(t.carries)} (equipment)` : ''}${tunnelLog(t.tunnel)}</figcaption></figure>`;
  }).join('')}</div></div>`).join('');
}
/** What a civilization's technology fields in a skirmish (board/board-rts-tech.js): its roster, its ladder, and why. */
function armyHtml(G, cid) {
  const T = G.civilizations[cid].technology;
  if (!T || !['vehicles', 'structures', 'weapons', 'things'].some((k) => T[k] && Object.keys(T[k]).length)) return '';
  const r = rtsRoster(G, cid), L = r.research ?? {};
  const units = Object.entries(r.units).map(([id, u]) => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.role)}${u.fly ? ', flies' : ''}</td><td>${u.tier ?? 1}</td><td>${u.hp}</td><td>${u.atk}${u.siege ? ` (× ${u.siege} on buildings)` : ''}</td><td>${u.range}</td><td>${u.speed}</td><td>${u.supply ?? ''}</td><td>${u.cost}${u.cost2 ? ` + ${u.cost2} ${esc(r.res2.toLowerCase())}` : ''}</td></tr>`).join('');
  const houses = Object.values(r.buildings).map((b) => `${esc(b.name)} (${esc(b.role)}${b.cost ? `, ${b.cost} gold` : ''})`).join(' · ');
  const ladder = (r.study ?? []).map((id) => `${esc(L[id].name)} (${L[id].cost} gold, ${L[id].time} s${L[id].gives.tier ? `: tier ${L[id].gives.tier}` : L[id].gives.buff ? `: ${L[id].gives.buff.atk ? `its fighters strike × ${L[id].gives.buff.atk}` : `its units take × ${L[id].gives.buff.ward}`}` : ': every trip pays more'})`).join(' → ');
  return `<div class="tech tech-army"><h4>What it fields in a skirmish</h4><table class="vocab"><tr><th>unit</th><th>role</th><th>tier</th><th>hp</th><th>strike</th><th>reach</th><th>pace</th><th>supply</th><th>gold</th></tr>${units}</table><p><b>Buildings</b> ${houses}</p>${ladder ? `<p><b>Its ladder</b> ${ladder}, at the ${esc(r.buildings[Object.values(L)[0].at].name)}</p>` : ''}<ul class="ledger">${r.ledger.map((l) => `<li>${esc(l.line)}</li>`).join('')}</ul></div>`;
}
const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? esc(v.id ?? (v.seed !== undefined ? `seeded ${v.seed}` : 'its own')) : esc(v));
const SECTION_WORDS = { trail: 'trail', meru: 'climb', building: 'building', roadway: 'roadway', airspace: 'airspace' };

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
  const R = resolveLevel(G, id), paint = structurePaint(R.style.kit);
  // a building level: its plan, laid from its program in its civilization's language (or the building made, by ref)
  if (R.building) {
    const B = R.building, name = B.use ?? B.ref;
    const svg = B.ref ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="300" height="80"><text x="150" y="44" text-anchor="middle" fill="currentColor" font-size="13">the building ${esc(B.ref)}, as made</text></svg>`
      : (() => { const m = withProgram(buildingStage(B)); return programPlanSvg({ use: B.use, rooms: m.rooms, links: m.links, entry: m._program.entry, goal: m._program.goal }, 300); })();
    return { R, laid: { stages: [{ node: name, section: 'building' }], order: [name] }, town: null, paint, walk: [{ node: name, section: 'building', svg }] };
  }
  // a city level: its plan sheet (the city book's), its segments and portals drawn on it
  if (R.city) {
    const d = designCity(inferCity(R.city.plan).recipe);
    return { R, laid: { stages: [{ node: 'city', section: 'city' }], order: ['city'] }, town: null, paint, walk: [{ node: 'city', section: 'city', svg: cityPlanSvg(d, { width: 460 }) }] };
  }
  // an airspace level: its field in plan, the course's line through its gates, the runway (skyscape/)
  if (R.airspace) {
    const { map, field } = airspaceOf({ kind: 'airspace', ...R.airspace, seed: R.seed });
    const C = R.airspace.course ? planCourse(map, field, { ...(R.airspace.course === true ? {} : R.airspace.course), seed: R.seed }) : null;
    const F = map.rings.field, k = 280 / (2 * Math.max(F.hx, F.hy)), X = (x) => (10 + (x + F.hx) * k).toFixed(1), Y = (y) => (10 + (F.hy - y) * k).toFixed(1);
    const line = C ? `<path d="${C.gates.map((g, i) => `${i ? 'L' : 'M'}${X(g.at[0])} ${Y(g.at[1])}`).join(' ')}${C.open ? '' : ' Z'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>${C.gates.map((g) => `<circle cx="${X(g.at[0])}" cy="${Y(g.at[1])}" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>`).join('')}` : '';
    const pads = field.pads.map((p) => `<rect x="${X(p.x0)}" y="${Y(p.y1)}" width="${((p.x1 - p.x0) * k).toFixed(1)}" height="${((p.y1 - p.y0) * k).toFixed(1)}" fill="currentColor"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(20 + 2 * F.hx * k).toFixed(0)} ${(20 + 2 * F.hy * k).toFixed(0)}" width="300"><rect x="10" y="10" width="${(2 * F.hx * k).toFixed(1)}" height="${(2 * F.hy * k).toFixed(1)}" fill="none" stroke="currentColor" stroke-opacity="0.35"/>${line}${pads}</svg>`;
    return { R, laid: { stages: [{ node: 'airspace', section: 'airspace' }], order: ['airspace'] }, town: null, paint, walk: [{ node: 'airspace', section: 'airspace', svg }] };
  }
  // a roadway level: its course in plan, its line and its corners (the track's own map comes later)
  if (R.roadway) {
    const c = trackCourse({ form: R.roadway.form, course: R.roadway.course }), pts = c.alignment.stations({ fine: 6, coarse: 12 });
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1, k = 280 / Math.max(w, h);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(10 + (p.x - x0) * k).toFixed(1)} ${(10 + (y0 + h - p.y) * k).toFixed(1)}`).join(' ') + (c.closed ? ' Z' : '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(20 + w * k).toFixed(0)} ${(20 + h * k).toFixed(0)}" width="300"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`;
    return { R, laid: { stages: [{ node: 'roadway', section: 'roadway' }], order: ['roadway'] }, town: null, paint, walk: [{ node: 'roadway', section: 'roadway', svg }] };
  }
  const laid = layLevel(R.level), st = structureStyle(R.style.kit, R.seed);
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


/** The bible of a gameworld, as one page. */
/** A brief's words, however it was written: a string, the composer's { prompt }, or a creator's { text, why? }. */
export const briefText = (b) => (typeof b === 'string' ? b : b?.prompt ?? b?.text ?? '');

// what game it is (intent.js): the genre it starts from, the values it said, and what each concern asks of the world,
// laid or said only; a world that wrote no intent shows the cube it is read as, and its brief's suggestions; a world
// with a target says what that engine does not carry (advice only)
function intentHtml(world) {
  const C = cubeOfWorld(world), R = intentReport(world), cs = concernsOf(C.cube);
  if (!R.written && !cs.length && !R.suggest) return '';
  const vals = Object.entries(C.cube).flatMap(([f, st]) => Object.entries(st).map(([k, v]) => `${f}.${k} ${Array.isArray(v) ? v.join(', ') : v}`));
  return `<details class="brief" id="intent" open><summary>What game it is${R.written ? '' : ' (read from the world, not yet said)'}</summary>
<p>${C.from ? `Starts from <b>${esc(GENRES[C.from].name)}</b>: ${esc(GENRES[C.from].why)}.` : 'No genre: its own values only.'}${world.intent?.why ? ` “${esc(world.intent.why)}”` : ''}</p>
${vals.length ? `<p class="muted">${vals.map((v) => esc(v)).join(' · ')}</p>` : ''}
${cs.length ? `<ul class="decided">${cs.map((c) => `<li><b>${esc(c.name)}</b> ${esc(c.asks)} <span class="muted">(${c.laid ? 'laid by the world' : 'asked, not yet laid'}; raised by ${esc(c.by.join(', '))})</span></li>`).join('')}</ul>` : ''}
${R.suggest ? `<p class="muted">The brief's words point at: ${R.suggest.map((g) => `${esc(GENRES[g.id].name)} (${esc(g.matched.join(', '))})`).join('; ')}.</p>` : ''}
${R.target ? `<p class="muted">Meant for <b>${esc(engineOf(R.target.engine).name)}</b> (advice only): ${esc(R.target.says)}</p>` : ''}</details>`;
}

// how the hero moves (feel/): the template, its viewer and the feel book to play it (its sibling page, `?book=feel`), what
// the runtime does not carry yet; a world that writes none shows what it would be suggested
function feelHtml(world) {
  if (world.feel === undefined || world.feel === null) {
    const S = feelSuggestion(world);
    return S ? `<details class="brief" id="feel"><summary>Feel (not yet said)</summary><p class="muted">Suggested: <b>${esc(typeof S.feel === 'string' ? POLES[S.feel].name : `${POLES[S.feel.pole].name} → ${POLES[S.feel.toward]?.name ?? ''}`)}</b></p></details>` : '';
  }
  const R = feelReport(world.feel);
  return `<details class="brief" id="feel" open><summary>Feel</summary>
<p><b>${esc(R.name)}</b>${R.variant ? ` · ${esc(R.variant)}` : ''}${R.toward ? ` → ${esc(POLES[R.toward].name)} ${Math.round(R.t * 100)}%` : ''} · ${esc(R.view)} · <a href="?book=feel">Play it</a></p>
${R.lost.length ? `<p class="muted">not carried yet: ${R.lost.map((x) => esc(x.field)).join(', ')}</p>` : ''}</details>`;
}

export function gameworldBibleHtml(world) {
  resetTownIds();
  const G = readGameworld(world), order = playOrder(G), graph = gameworldGraph(G), guide = styleGuide(G);
  // (the world's book skin, book-skin.js: absent, the book's own look)
  const skin = skinHead(G.book);
  const built = Object.fromEntries(order.map((id) => [id, buildLevel(G, id)]));
  const first = built[order.find((id) => built[id].town) ?? order[0]];
  const cover = first.town ? plate('cover', townAxonSvg(first.town, first.paint, null, { w: 1500, h: 900 })) : first.walk[0].svg;

  // where each civilization builds: its places, and the kit it is first drawn in
  const builds = Object.fromEntries(G.civIds.map((c) => [c, []]));
  for (const id of order) { const B = built[id].R.built; if (B?.town) { builds[B.town].push([id, 'town']); if (B.castle) builds[B.castle].push([id, 'castle']); } if (B?.building) builds[B.building].push([id, built[id].R.building.use ?? 'building']); if (B?.city) builds[B.city].push([id, 'city']); }

  const strip = order.map((id, i) => {
    const b = built[id], thumb = b.town ? plate(`strip-${id}`, townMapSvg(b.town, b.paint, null, { px: 2, labels: false })) : b.walk[0].svg;
    const next = G.links.find((l) => l.from === id);
    return `<a class="stop" href="#level-${esc(id)}"><div class="im">${thumb}</div><div class="cap"><i>${i + 1}</i><b>${esc(b.R.name)}</b></div></a>${next && i < order.length - 1 ? `<div class="joint"><span>${esc(next.kind)}</span><svg viewBox="0 0 26 12"><path d="M1 6H22" stroke="var(--ink)" stroke-width="2" ${next.kind === 'gate' ? 'stroke-dasharray="4 3"' : ''}/><path d="M19 1L25 6L19 11" fill="none" stroke="var(--ink)" stroke-width="2"/></svg></div>` : ''}`;
  }).join('');

  // the kits the world is drawn in: its own first, then each level's in play order
  const kits = [...new Set([G.style.kit, ...order.map((id) => built[id].R.style.kit)])];
  const groundOf = (k) => order.filter((id) => built[id].R.style.kit === k).map((id) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a>`).join(', ') || 'no level yet';
  // each kit's land as the world (or the first level drawn in it) chose it
  const landOfKitHere = (k) => { const at = order.find((id) => built[id].R.style.kit === k); return landFor(k, (at ? built[at].R.style.land : G.style.land) || {}); };
  // what each form the land names became in the levels drawn in the kit (nature.js landToLevel), and each gap: a level
  // that names no land of its own says nothing
  const inLevels = (k) => {
    // (the levels that say the same of a form share one line)
    const rows = new Map();
    for (const id of order.filter((x) => built[x].R.style.kit === k && built[x].R.land)) for (const [f, o] of Object.entries(built[id].R.land)) {
      const said = `${f}\u0000${o.variant}\u0000${o.word}\u0000${o.became.join('; ')}\u0000${o.gaps.join('; ')}`;
      if (!rows.has(said)) rows.set(said, { f, o, ids: [] });
      rows.get(said).ids.push(id);
    }
    if (!rows.size) return '';
    const line = ({ f, o, ids }) => `<dt>${esc(f)} · ${esc(o.variant)} · ${esc(o.word)}</dt><dd>${ids.map((id) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a>`).join(', ')}: ${o.became.length ? esc(o.became.join('; ')) : o.gaps.length ? '' : 'drawn as the kit draws it'}${o.gaps.length ? `${o.became.length ? '<br>' : ''}<span class="muted">${esc(o.gaps.join('; '))}</span>` : ''}</dd>`;
    return `<h4>In the level</h4><dl class="vocab">${[...rows.values()].map(line).join('')}</dl>`;
  };
  const VIEW = { landscape: 'low', strata: 'front', face: 'three' }, LIFT = { landscape: 2 };
  const natureHtml = kits.map((k) => {
    const N = natureCard(k), land = landOfKitHere(k), draw = (f, w, h, level = 'near') => {
      // at the scale its most would take, so a little reads as little (a clear sky nearly empty)
      const o = { w, h, view: VIEW[f] ?? 'axon', lift: LIFT[f] ?? 1, sky: f === 'cloud' }, ppm = landFit(designLand(f, land[f].variant, G.seed, { level, many: 1 }), o);
      return drawLand(designLand(f, land[f].variant, G.seed, { level, many: land[f].many }), k, { ...o, ppm });
    };
    const cap = (f) => `${esc(f)} · ${esc(land[f].variant)} · ${esc(land[f].word)}${land[f].own ? ' <b class="own-mark">chosen</b>' : ''}`;
    const forms = LAND_FORM_IDS.filter((f) => f !== 'landscape').map((f) => `<figure class="form">${plate(`land-${k}-${f}`, draw(f, 220, 160))}<figcaption>${cap(f)}</figcaption></figure>`).join('');
    const strips = LAND_FORM_IDS.map((f) => `<div class="strip-row"><span class="eyebrow">${esc(f)} · ${esc(land[f].variant)}</span><div class="many"><div class="many-in">${manyStrip(f, land[f].variant, k, G.seed, { mark: manyStep(land[f].many), w: 112, h: 84 })}</div></div></div>`).join('');
    return `<article class="nature" id="nature-${esc(k)}"><div class="civ-h"><div><span class="eyebrow">Natural world · ${esc(N.look)}</span><h3>${esc(k)}</h3></div><p class="muted">the ground of ${groundOf(k)}</p></div>
<div class="land-hero"><figure class="form">${plate(`land-${k}-landscape`, draw('landscape', 620, 300))}<figcaption>${cap('landscape')}</figcaption></figure><div class="forms">${forms}</div></div>
<h4>From little to many</h4><div class="strips">${strips}</div>${inLevels(k)}
<dl class="vocab">${[['trees', N.trees], ['grass', N.grass], ['water', N.water.read], ['sky', N.sky.read], ['light', N.light], ['air', N.air], ['far', N.far]].map(([t, v]) => `<dt>${t}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<details><summary>Its principles</summary><ul class="principles">${N.principles.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details></article>`;
  }).join('');
  // the cubes the levels stand on (era/geocube.js): each its key colours and its sky, and where its colours came from
  const cubes = [...new Map(order.filter((id) => built[id].R.level?.geocube !== undefined).map((id) => readGeocube(built[id].R.level.geocube)).map((c) => [c.palette?.id ?? c.id, c])).values()];
  const ramp = (stops) => `<div class="ramp">${stops.map((h) => `<i style="background:${h}" title="${h}"></i>`).join('')}</div>`;
  const cubeHtml = cubes.map((c) => `<article class="card" id="cube-${esc(c.palette?.id ?? c.id)}"><div class="card-h"><span class="eyebrow">Geocube</span><h3>${esc(c.title)}</h3><p class="muted">${c.palette?.id ? `solved by the color theorist: ${esc(c.palette.id)}, ${esc(c.palette.reads)}` : 'its own colours'}</p></div><div class="key">${Object.entries(geocubeRamps(c)).map(([name, stops]) => `<div class="key-row">${ramp(stops)}<div><b>${esc(name)}</b></div></div>`).join('')}${c.light.sky ? `<div class="key-row">${ramp([c.light.sky.zenith, c.light.sky.horizon, ...(c.light.sky.fog ? [c.light.sky.fog] : [])])}<div><b>sky</b><p class="muted">zenith, horizon${c.light.sky.fog ? ', fog' : ''}</p></div></div>` : ''}</div></article>`).join('');
  const keyHtml = cubeHtml + kits.map((k) => { const K = colorKey(k); return `<article class="card" id="key-${esc(k)}"><div class="card-h"><span class="eyebrow">Color key</span><h3>${esc(k)}</h3></div><div class="key">${K.ramps.map((r) => `<div class="key-row"><div class="ramp">${r.stops.map((h) => `<i style="background:${h}" title="${h}"></i>`).join('')}</div><div><b>${esc(r.name)}</b>${r.shared ? ` <span class="muted">(its ${esc(r.shared)})</span>` : ''}<p class="muted">${esc(r.paints)}</p></div></div>`).join('')}</div></article>`; }).join('');
  const gr = guide.ground, row = (o) => Object.entries(o).map(([k, v]) => `${esc(k)} ${show(v)}`).join(' · ') || 'its card\'s own';
  const groundHtml = `<article class="card" id="guide-ground"><div class="card-h"><span class="eyebrow">The ground's character</span><h3>Handed down</h3><p class="muted">How every level's ground rises, falls and is climbed, unless it says otherwise.</p></div><dl class="vocab"><dt>trails</dt><dd>${row(gr.trail)}</dd><dt>climbs</dt><dd>${row(gr.meru)}</dd></dl></article>`;

  // each civilization, drawn in the kit it is first found in: its houses, its castle, how it lays out a town
  // a part's stamp is known once the gate is read, below: the cards leave a mark where it goes
  const civStamp = (id) => `<!--stamp:${id}-->`;
  const civHtml = G.civIds.map((cid) => {
    const C = G.civilizations[cid], at = builds[cid][0], kit = at ? built[at[0]].R.style.kit : G.style.kit, card = civilizationCard(C, kit, G.seed), V = card.language.vocab, I = card.fort.influence;
    const castle = designCastle(structureStyle(kit, G.seed), G.seed, { fort: C.fort, ...(C.anchor !== undefined ? { anchor: C.anchor } : {}), ...(C.castle || {}) });
    const where = builds[cid].length ? builds[cid].map(([id, what]) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a> · ${what}`).join('<br>') : 'nowhere yet';
    return `<article class="civ" id="civ-${esc(cid)}"><div class="civ-h"><div><span class="eyebrow">Civilization · ${esc(cid)}</span><h3>${esc(C.name)}</h3></div><p class="muted mono">${esc(card.language.id)} · ${esc(card.fort.id)} · drawn in ${esc(kit)}</p></div>
<p class="read">${esc(card.language.read)}</p><div class="houses">${houseRow(card.language.language, kit, G.seed)}</div>
<div class="fort"><div class="fort-im">${plate(`civ-castle-${cid}`, castleAxon(castle, structurePaint(kit)))}</div><div><p class="read">${esc(card.fort.read)}</p><h4>What its language makes of a castle</h4><dl class="vocab"><dt>wall</dt><dd>${esc(I.read[0])}</dd><dt>towers</dt><dd>${esc(I.read[1])}</dd><dt>keep</dt><dd>${esc(I.read[2])}</dd></dl>
<h4>Its houses</h4><dl class="vocab">${[['mass', V.mass], ['cap', V.cap], ['lights', V.opening], ['entry', V.entry], ['tiers', V.tiers ? 'yes' : 'no'], ['ornaments', V.ornaments.join(', ') || 'none']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}<dt>towns</dt><dd>${row(card.town)}</dd><dt>castles</dt><dd>${row(card.castle)}</dd><dt>builds in</dt><dd>${where}</dd></dl></div></div>${tunnelHtml(C, cid, kit, G.seed, G.style.kit)}${techHtml(C, cid, kit, G.seed)}${craftHtml(G, cid, kit, G.seed, civStamp)}${armyHtml(G, cid)}</article>`;
  }).join('');

  // the gate: each part's stamp, its machine gate measured by the builders that drew it
  const machine = {};
  for (const id of order) { const t = built[id].town; if (t) machine[`level:${id}`] = t.laws.filter((l) => !l.ok).map((l) => l.law); }
  machine.nature = kits.flatMap((k) => { const land = landOfKitHere(k); return Object.keys(land).flatMap((f) => landLaws(designLand(f, land[f].variant, G.seed, { level: 'near', many: land[f].many })).map((l) => `${f} ${l.law}`)); });
  const stamps = reviewState(world, { machine }), stampOf = (id) => stamps.find((x) => x.id === id);
  const anchorOf = (id) => (id === 'intent' ? '#intent' : id === 'world' ? '#map' : id === 'nature' ? '#nature' : id === 'civilizations' ? '#civilizations' : id === 'key' ? '#key' : id.startsWith('tech:') ? `#tech-${id.slice(5)}` : `#level-${id.slice(6)}`);
  const stamp = (id) => { const x = stampOf(id); return x ? `<span class="stamp st-${x.status}" title="${esc(STAMPS[x.status])}">${esc(x.status)}</span>` : ''; };
  const civCards = civHtml.replace(/<!--stamp:([^>]*)-->/g, (_, id) => stamp(id));
  const mode = world.mode ?? 'gated', waiting = stamps.filter((x) => ['changed', 'revise', 'proposed'].includes(x.status));
  const gateHtml = `<div class="gate" id="gate"><div class="gate-h"><span class="eyebrow">The gate</span><span class="mode mode-${esc(mode)}">${esc(mode)}</span><p class="muted">${esc(MODES[mode])}.</p></div>
<ol class="parts">${stamps.map((x) => `<li><a href="${anchorOf(x.id)}">${esc(x.name)}</a>${stamp(x.id)}<code>${esc(x.print)}</code>${x.note ? `<p class="muted">${esc(x.note)}</p>` : ''}</li>`).join('')}</ol>
<p class="muted">${waiting.length ? `Next to look at: ${waiting.map((x) => `<a href="${anchorOf(x.id)}">${esc(x.name)}</a>`).join(', ')}.` : 'Nothing is waiting on you.'}</p>
${briefText(world.brief) ? `<details class="brief" open><summary>${Array.isArray(world.brief.read) ? 'The prompt it was composed from' : 'The brief'}</summary><p class="prompt">“${esc(briefText(world.brief))}”</p><ul class="decided">${(world.brief.read ?? []).map((r) => `<li><b>${esc(r.word)}</b> decided ${esc(r.decides.join(', '))}</li>`).join('')}${world.brief.unread?.length ? `<li class="muted">not read: ${esc(world.brief.unread.join(', '))}; the seed decided what they might have</li>` : ''}${(world.brief.levels || []).map((l) => `<li class="muted">${esc(l.level)} laid on seed ${l.seed}${l.tries > 1 ? `, after ${l.tries - 1} tr${l.tries === 2 ? 'y' : 'ies'} its laws advised` : ''}${l.laws.length ? `; still advising: ${esc(l.laws.join(', '))}` : ''}</li>`).join('')}</ul></details>` : ''}${intentHtml(world)}${feelHtml(world)}</div>`;

  const levels = order.map((id, i) => {
    const b = built[id], R = b.R, own = R.ledger;
    const ledger = own.length ? `<ul class="ledger">${own.map((o) => `<li><b>${esc(o.key)}</b> ${show(o.local)} <span>world: ${show(o.world)}</span>${o.scope !== 'level' ? ` <em>${esc(o.at.split('/')[1])}</em>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Follows its world in everything.</p>';
    const ownStyle = [];
    if (R.style.kit !== G.style.kit) ownStyle.push(`<div class="own"><span class="eyebrow">Its own ground</span><p><a href="#nature-${esc(R.style.kit)}">${esc(R.style.kit)}</a>, its natural world</p></div>`);
    const by = R.built?.building ? [[R.building.use ?? 'building', R.built.building]] : R.built?.city ? [['city', R.built.city]] : R.built ? [['town', R.built.town], ...(R.built.castle ? [['castle', R.built.castle]] : [])] : [];
    if (by.length) ownStyle.unshift(`<div class="own"><span class="eyebrow">Built by</span><ul class="ledger">${by.map(([what, c]) => `<li><b>${what}</b> <a href="#civ-${esc(c)}">${esc(G.civilizations[c].name)}</a></li>`).join('')}</ul></div>`);
    const walk = b.walk.map((w, k) => `<figure class="sec"><div class="sec-im">${plate(`walk-${id}-${w.node}`, w.svg)}</div><figcaption><i>${k + 1}</i> ${esc(w.node)} · ${SECTION_WORDS[w.section]}</figcaption></figure>${k < b.walk.length - 1 ? '<div class="seam" aria-hidden="true">→</div>' : ''}`).join('');
    const places = b.town ? `<div class="places"><figure>${plate(`town-${id}`, townMapSvg(b.town, b.paint, null, { px: 3, labels: true }))}<figcaption>The town${b.town.castle ? ' and its castle' : ''}, by ${esc(G.civilizations[R.built.town].name)}${R.built.castle && R.built.castle !== R.built.town ? ` and ${esc(G.civilizations[R.built.castle].name)}` : ''} · ${b.town.laws.filter((l) => !l.ok).length ? `${b.town.laws.filter((l) => !l.ok).length} laws advise` : 'every law holds'}</figcaption></figure>${b.town.castle ? `<figure>${plate(`castle-${id}`, castleAxon(b.town.castle, b.paint))}<figcaption>The castle standing, by ${esc(G.civilizations[R.built.castle].name)}</figcaption></figure>` : ''}</div>` : '';
    return `<section class="part level" id="level-${esc(id)}"><div class="level-h"><span class="eyebrow">Level ${i + 1}${id === G.start ? ' · start' : ''} ${stamp(`level:${id}`)}</span><h2>${esc(R.name)}</h2><p class="muted mono">${esc(R.style.kit)} · seed ${R.seed} · ${b.laid.order.length} section${b.laid.order.length === 1 ? '' : 's'}</p></div>
<div class="level-grid"><div><h4>${R.building ? 'The building' : R.city ? 'The city' : R.roadway ? 'The roadway' : R.airspace ? 'The airspace' : 'The walk'}</h4><div class="walk">${walk}</div>${places ? `<h4>On its ground</h4>${places}` : ''}</div><aside class="local">${stampOf(`level:${id}`)?.note ? `<div class="review-note"><span class="eyebrow">Sent back</span><p>${esc(stampOf(`level:${id}`).note)}</p></div>` : ''}<h4>Local</h4>${ledger}${ownStyle.join('')}</aside></div></section>`;
  }).join('\n');

  // THE CAST AND THE STORY (story.js): who else is in the world, and each moment with where it bound, or why it could not
  const cast = G.characters?.cast ?? null, told = G.story || G.quests ? storyReport(world) : null;
  const words = (looks) => Object.entries(looks ?? {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? Object.values(v).flat().map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ') : v}`).join(' · ');
  const castHtml = cast ? Object.entries(cast).map(([id, m]) => `<article class="card"><div class="card-h"><span class="eyebrow">Cast · ${esc(id)}</span><h3>${esc(m.name ?? id)}</h3></div><p class="muted">${esc(words(m.looks) || 'the direction alone')}</p></article>`).join('') : '';
  const where = (b) => `${b.level} · ${b.node}${b.place ? ` · ${b.place}` : ''}`;
  const momentHtml = told ? (G.story ?? []).map((m) => {
    const b = told.bound.find((x) => x.id === m.id), u = told.unplaced.find((x) => x.id === m.id);
    return `<article class="card${u ? ' open' : ''}"><div class="card-h"><span class="eyebrow">${u ? 'Unplaced' : `Bound · ${esc(where(b))}`}</span><h3>${esc(m.id)}</h3></div><p class="muted">${esc((m.who ?? []).map((w) => cast?.[w]?.name ?? w).join(', ') || 'the hero')}${m.sets?.length ? ` · sets ${esc(m.sets.join(', '))}` : ''}</p>${u ? `<p class="muted">${esc(u.why)}</p>` : ''}</article>`;
  }).join('') : '';
  // the quests: each step, the moments that wait on the one before, and a step whose flag nothing in the story sets
  const questHtml = (G.quests ?? []).map((q) => `<article class="card"><div class="card-h"><span class="eyebrow">Quest · ${esc(q.id)}${q.starts ? ` · begins on ${esc(q.starts)}` : ''}</span><h3>${esc(q.name ?? q.id)}</h3></div><ol class="muted">${q.steps.map((st, j) => {
    const loose = told?.unset?.some((u) => u.quest === q.id && u.step === j + 1);
    return `<li>${esc(st.log ?? `step ${j + 1}`)} · done on ${esc(st.done)}${st.moments?.length ? ` · ${esc(st.moments.join(', '))}` : ''}${loose ? ' · nothing in the story sets it' : ''}</li>`;
  }).join('')}</ol></article>`).join('');
  const storyPart = cast || told ? `<section class="part" id="story"><div class="part-h"><span class="eyebrow">The cast ${cast ? stamp('cast') : ''} · The story ${G.story ? stamp('story') : ''}${G.quests ? ` · The quests ${stamp('quests')}` : ''}</span><h2>Who else, and what happens where</h2></div><div class="cards">${castHtml}${momentHtml}${questHtml}</div></section>\n` : '';
  const open = OPEN_SLOTS.filter((k) => !G[k]).map((k) => `<article class="card open"><div class="card-h"><span class="eyebrow">Open</span><h3>${esc(k[0].toUpperCase() + k.slice(1))}</h3></div><p class="muted">Not on the ground. The world leaves room for them${k === 'characters' ? ', and for the people of its civilizations' : ''}.</p></article>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(G.name)} · Gameworld bible</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">${skin.link}
<style>${CSS}${G.wcd ? `\n${WCD_CSS}` : ''}${skin.css ? `\n${skin.css}` : ''}</style></head><body><div class="wrap">
<div class="mast"><div class="t">Gameworld bible</div><div class="eyebrow">${esc(G.id)} · seed ${G.seed}</div></div>
<nav class="tabs" aria-label="Sections"><a href="#cover">World</a><a href="#gate">Gate</a><a href="#map">World map</a>${G.wcd ? '<a href="#wcd">To the core</a>' : ''}<a href="#nature">Natural world</a><a href="#civilizations">Civilizations</a><a href="#key">Color key</a>${order.map((id) => `<a href="#level-${esc(id)}">${esc(built[id].R.name)}</a>`).join('')}${storyPart ? '<a href="#story">Story</a>' : ''}<a href="#open">Open</a></nav>
<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">${order.length} level${order.length === 1 ? '' : 's'} · ${esc(G.style.kit)} · ${G.civIds.length} civilization${G.civIds.length === 1 ? '' : 's'}</p></div><figure class="hero">${cover}</figure></div>
${gateHtml}<div class="eyebrow">The levels, in the order they are played</div><div class="strip">${strip}</div></section>
<section class="part" id="map"><div class="part-h"><span class="eyebrow">World map ${stamp('world')}</span><h2>The world, drawn from its graph</h2></div><div class="canvas">${worldMapSvg(graph, order)}</div>
<details><summary>The graph as an outline</summary><pre>${esc(graphOutline(graph))}</pre></details>
<details><summary>The graph as a flowchart (Mermaid)</summary><pre>${esc(graphMermaid(graph))}</pre></details>
<script type="application/json" id="gameworld-graph">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script></section>
${wcdPage(G, esc)}<section class="part" id="nature"><div class="part-h"><span class="eyebrow">Natural world ${stamp('nature')}</span><h2>The land, before anyone builds on it</h2></div>${natureHtml}<div class="cards">${groundHtml}${G.style.weather ? weatherCardHtml(G.style.weather, G.seed, airOfKit(G.style.kit, G.style.weather.air)) : ''}</div></section>
<section class="part" id="civilizations"><div class="part-h"><span class="eyebrow">Civilizations ${stamp('civilizations')}</span><h2>Who builds on it</h2></div>${civCards}</section>
<section class="part" id="key"><div class="part-h"><span class="eyebrow">Style and color key ${stamp('key')}</span><h2>Every ramp, and what it paints</h2></div><div class="cards">${keyHtml}</div></section>
${levels}
${storyPart}<section class="part" id="open"><div class="part-h"><span class="eyebrow">Open</span><h2>Beyond the ground</h2></div><div class="cards">${open}</div></section>
<footer><span class="eyebrow">Every plate drawn from its recipe</span><span class="eyebrow">Scapeshift</span></footer>
</div></body></html>`;
}

/** The binder's stylesheet, shared by the character book's bible (character-bible-html.js). */
export const CSS = `
:root{--paper:#eef1f4;--sheet:#fff;--ink:#17202e;--muted:#5b6676;--rule:#d3d9e0;--dot:#c3cad3;--c-trail:#3a8a57;--c-meru:#b9822a;--c-building:#6a58a8;--c-place:#b14f39;--local:#b14f39;
--display:"Big Shoulders Display","Arial Narrow",sans-serif;--body:"Public Sans","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--paper:#0f141b;--sheet:#171e28;--ink:#e6eaf0;--muted:#99a4b3;--rule:#2b3543;--dot:#2b3543;--c-trail:#5cb57c;--c-meru:#dba44a;--c-building:#9c8ad8;--c-place:#dd7a62;--local:#dd7a62;color-scheme:dark}}
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
.sw{display:inline-block;width:11px;height:11px;border:1px solid var(--rule);margin:0 4px -1px 2px}.wxs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.wx{margin:0;display:grid;gap:6px;font-size:13px}.wx svg{width:100%;display:block;border:1px solid var(--rule)}
.gate{background:var(--sheet);border:1px solid var(--rule);border-top:3px solid var(--ink);border-radius:4px;padding:14px 16px;display:grid;gap:10px}.gate-h{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:baseline}
.mode{font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1.5px solid var(--ink)}.mode-autonomous{background:var(--ink);color:var(--sheet)}
.parts{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:6px 18px}.parts li{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;padding:6px 0;border-bottom:1px dashed var(--rule)}.parts a{color:inherit;font-weight:500}.parts code{font:10px var(--mono);color:var(--muted);margin-left:auto}.parts p{flex-basis:100%;font-size:12.5px}
.stamp{display:inline-block;font:500 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:1px 6px;border-radius:3px;border:1.5px solid currentColor;transform:rotate(-2deg);vertical-align:1px}
.st-approved{color:var(--c-trail)}.st-changed{color:var(--c-meru)}.st-revise{color:var(--local)}.st-proposed{color:var(--muted)}.st-auto{color:#4f7fd0}
.brief .prompt{font:500 16px var(--body);margin:8px 0}.decided{margin:0;padding-left:18px;display:grid;gap:3px;font-size:13.5px}.review-note{border-left:3px solid var(--local);padding:4px 10px;margin-top:10px}
.nature{background:var(--sheet);border:1px solid var(--rule);border-top:3px solid var(--c-trail);border-radius:4px;padding:16px;display:grid;gap:14px}
.land-hero{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;align-items:start}.forms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.form svg,.form img{width:100%;height:auto;border:1px solid var(--rule);border-radius:3px;background:#fff}.form figcaption{font:10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:4px}.own-mark{color:var(--local);font-weight:500}
.strips{display:grid;gap:10px}.strip-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center}.many{overflow-x:auto}.many-in{display:flex;gap:8px}.many-in figure{margin:0;flex:none}.many-in svg{border:1px solid var(--rule);border-radius:3px;background:#fff}.many-in figure.mark svg{outline:3px solid var(--local);outline-offset:1px}.many-in figcaption{font:10px var(--mono);text-transform:uppercase;color:var(--muted);margin-top:3px}.many-in figure.mark figcaption{color:var(--local);font-weight:500}.many img{width:100%;height:auto;border-radius:3px}
@media (max-width:860px){.land-hero{grid-template-columns:1fr}.strip-row{grid-template-columns:1fr}}
.things{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.things figure{margin:0}.tech h4,.tunnel h4{margin:6px 0}
.civ{background:var(--sheet);border:1px solid var(--rule);border-top:3px solid var(--ink);border-radius:4px;padding:16px;display:grid;gap:14px}.civ-h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:8px}.civ-h h3{font-size:34px}.vocab a,.ledger a{color:inherit}
footer{margin-top:56px;padding-top:14px;border-top:2px solid var(--ink);display:flex;justify-content:space-between;gap:8px 24px;flex-wrap:wrap}
@media (max-width:860px){.cover,.level-grid,.fort,.cards,.places{grid-template-columns:1fr}.houses{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
