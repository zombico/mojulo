/**
 * THE STRUCTURES INDEX, drawn — the scapeshift sheet for a town spoken from one ANCHOR STRUCTURE: its elements first
 * (each drawn on its own, with what the street holds and what a house may vary, and how it reads by ring), the anchor
 * composed from them as a citizen standing in its slice of street, black and white and in pieces, the language
 * decompiled from it, a street of households varying inside it, the heartbeats, that language spoken on every use (by depth and by ring), the
 * town it speaks (map and axonometric), a gallery of other anchors and the towns they speak, values and paint, the
 * principles at work (one use, five lots), routes and levels, paving, the town's interceptors, the vocabulary, the
 * laws, roofs by covering, and every kit's craft and paint. Data: era/out-anchor-structure.js, era/out-structures.js,
 * era/out-town.js, era/out-structures-paint.js. `outStructuresHtml(opts)` is pure.
 */
import { STRUCTURE_TARGET, STRUCTURE_RINGS, STRUCTURE_RING_IDS, STRUCTURE_USE_IDS, STRUCTURE_LAWS, STRUCTURE_RAILS, STRUCTURE_KITS, showRail, structureStyle } from './out-structures.js';
import { ANCHOR_LAWS, PIECE_KINDS, DEPTHS, CAPS_FOR, decompileAnchor, seedAnchor, speak, roundTrip, secondaryOf } from './out-anchor-structure.js';
import { hexOfRgb } from './style/swatches.js';
import { drawStructures, fig } from './out-structures-draw.js';
import { designTown, TOWN_LAWS } from './out-town.js';
import { structurePaint, paintLaws, streetPaints, SURFACE_GROUPS } from './out-structures-paint.js';
import { dressTown } from './out-town-dress.js';
import { townMapCard, townAxonCard, townMapSvg, townFaces, routesCard, pavingCard, roofsCard, dressCard, heartbeatCard, resetTownIds } from './out-town-html.js';
import { ELEMENT_KINDS, SECONDARY_RULES, elementSwatch, sliceStreet } from './out-anchor-elements.js';
import { eyeSpot } from './out-structures.js';
import { CSS } from './out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : v === null || v === undefined ? '—' : String(v));
const all = (d) => [...d.faces, ...d.tile];
const badge = (laws) => { const b = laws.filter((l) => !l.ok && l.law !== 'programme'); return b.length ? `<span class="badge solid">${esc(b.map((l) => l.law).join(', '))}</span>` : ''; };
const lawRows = (laws) => laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</td><td>${esc(n2(l.value))}</td><td>${esc(l.want ?? '')}</td></tr>`).join('');
const LOTS = { dwelling: { w: 12, d: 18 }, shop: { w: 8, d: 16 }, workshop: { w: 12, d: 16 }, barn: { w: 14, d: 18 }, hall: { w: 18, d: 24 }, tower: { w: 7, d: 7 } };

// ── the anchor, in pieces ───────────────────────────────────────────────────────────────────────────────────────────
/** A face's piece: the role it was spoken from (mass, cap, lights, ornament, annex). */
const pieceOf = (f) => (f.mass === 'annex' ? 'annex' : ['roof', 'edge', 'cap', 'course'].includes(f.part) ? 'cap' : ['opening', 'lens', 'door', 'accent', 'sill', 'lintel'].includes(f.part) ? 'lights' : ['spike', 'chimney', 'motif', 'frame', 'shutter', 'socle', 'cornice', 'quoin'].includes(f.part) || f.mass === 'chimney' || f.mass === 'crown' ? 'ornament' : 'mass');
/** The building pulled apart along each piece's own direction: caps up, ornaments higher, lights forward, annex back. */
export function exploded(d) {
  const r = d.measures.ridge || 6, off = { mass: [0, 0, 0], cap: [0, 0, 0.45 * r], ornament: [0, -0.6 * r, 0.9 * r], lights: [0, -0.9 * r, 0], annex: [0, 0.8 * r, 0] };
  return all(d).map((f) => { const o = off[pieceOf(f)]; return { ...f, corners: f.corners.map((p) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]]) }; });
}

function anchorCard(L, style, paint, seed) {
  const A = L.anchor, rt = roundTrip(L, style, seed), b = rt.building;
  const pieces = A.pieces.map((p) => `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.role)}</td><td>${esc(p.kind)}</td><td class="note">${esc(Object.entries(p).filter(([k, v]) => !['id', 'role', 'kind', 'group', 'value', 'storeys', 'on'].includes(k) && v !== undefined).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '') : n2(v)}`).join(' · '))}</td><td>${esc(p.storeys ? p.storeys.map((s) => `${s.group} ${s.value}`).join(' / ') : p.group ? `${p.group} ${p.value}` : '')}</td></tr>`).join('');
  const V = L.vocab, P = L.proportions;
  const vocab = [['mass', V.mass], ['cap', V.cap ?? 'none (the mass is its own roof)'], ['light', V.opening], ['entry', `${V.entry} (${V.entryShape})`], ['ornaments', V.ornaments.join(', ') || 'none'], ['relation', [V.annex ? `annex (${V.annex})` : null, V.tiers ? 'tiers' : null].filter(Boolean).join(', ') || 'none']].map(([k, v]) => `<tr><td>${k}</td><td><b>${esc(v)}</b></td></tr>`).join('');
  const prop = [['plan aspect', P.aspect], ['reach (span)', `${P.reach} m`], ['cap pitch', P.pitch === null ? '—' : `${P.pitch}°`], ['rise', P.rise], ['eave / least side', P.eave], ['light', `${P.opening.w} × ${P.opening.h} m, ${P.opening.by}${P.opening.bay ? ` of ${P.opening.bay} m` : ''}${P.opening.count ? `, ${P.opening.count} to a band` : ''}`], ['entry', `${P.entry.w} × ${P.entry.h} m`], ['annex scale', P.annexScale], ['tier shrink', P.tierShrink], ['points', P.point ? `${P.point.count}, ${P.point.len} of the least side` : '—'], ['ribs', P.rib ? `${P.rib.count} × ${P.rib.w} m` : '—'], ['variation', `± ${L.variation * 100} % a household`]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(n2(v))}</td></tr>`).join('');
  const depths = Object.entries(DEPTHS).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  return `<div class="card"><h3>The anchor structure: ${esc(L.id)} <span class="badge solid">black and white, in pieces</span></h3><p class="note">${esc(A.read)}. A citizen: the ordinary house of the town, composed from the elements above at full effort; every other use is a promotion of it. The town's style is decompiled from this one structure: no house shape is stored anywhere else.</p>
<div class="views">${fig(drawStructures([exploded(b)], { view: 'axon', w: 420, h: 400 }), 'in pieces: mass, cap (up), ornaments (higher), lights (forward), annex (back)')}${fig(drawStructures([all(b)], { view: 'axon', w: 300, h: 300 }), 'assembled, values')}${fig(drawStructures([all(b)], { view: 'axon', paint, w: 300, h: 300 }), `painted: ${esc(paint.kitId)}`)}</div>
<div class="grid g2" style="margin-top:8px"><div><h3>Its pieces</h3><table><tr><th>piece</th><th>role</th><th>kind</th><th></th><th>group · value</th></tr>${pieces}</table></div>
<div><h3>Decompiled: the language</h3><table>${vocab}</table><table style="margin-top:6px">${prop}</table><p class="note">Spoken by depth: ${esc(depths)}. Every proportion a household speaks moves no further than the variation.</p>
<table style="margin-top:6px">${lawRows(rt.laws)}</table></div></div></div>`;
}

function spokenCard(L, style, paint, seed) {
  const ds = STRUCTURE_USE_IDS.map((u) => speak(L, u, LOTS[u], style, seed, { accent: u === 'hall' }));
  const ROLE = { dwelling: 'the citizen', shop: 'promoted: a counter below', workshop: 'promoted: a work floor', barn: 'promoted: a cart floor', hall: 'promoted: the accent, the gable to the square', tower: 'promoted: dares height' };
  const row = ds.map((d) => fig(drawStructures([all(d)], { view: 'axon', paint, w: 210, h: 190, ppm: 8 }), `${esc(d.use)} · <i>${esc(ROLE[d.use])}</i> · ${d.dims.n} storey${d.dims.n > 1 ? 's' : ''}${d.masses.length > 1 ? ' · annex' : ''} ${badge(d.laws)}`)).join('');
  const values = ds.map((d) => fig(drawStructures([all(d)], { view: 'axon', w: 210, h: 190, ppm: 8 }), `${esc(d.use)}, values`)).join('');
  const d0 = ds[0], ladder = [0, 1, 2, 3].map((k) => { const x = speak(L, 'dwelling', LOTS.dwelling, style, seed, { depth: k }); return fig(drawStructures([all(x)], { view: 'axon', w: 200, h: 180, ppm: 11 }), `depth ${k} · ${x.measures.tris} tris`); }).join('');
  const rings = STRUCTURE_RING_IDS.map((r) => { const x = speak(L, 'dwelling', LOTS.dwelling, style, seed, { ring: r }); return fig(drawStructures([all(x)], { view: 'axon', paint, w: 200, h: 180, ppm: 11, markTile: true }), `${r} · depth ${x.depth} · ${x.measures.tris} / ${STRUCTURE_RINGS[r].budget} tris`); }).join('');
  const sweep = Array.from({ length: 7 }, (_, i) => speak(L, 'dwelling', LOTS.dwelling, style, seed + 11 * (i + 1))).map((x) => fig(drawStructures([all(x)], { view: 'axon', paint, w: 150, h: 140, ppm: 6.5 }), `household ${x.seed}`)).join('');
  return `<div class="card"><h3>The language, spoken on every use</h3><p class="note">Each building is the anchor's language spoken on a lot for a programme: the plan from the lot inside the anchor's reach, storeys from the need, the anchor's cap at its pitch, its lights in its rhythm, its ornaments at their counts; what the plan cannot hold is the language again behind (an annex, a depth shallower); a focus that must stand over the street takes a taller storey, a steeper cap, or the language once more on top.</p>
<div class="views">${row}</div><div class="views" style="margin-top:6px">${values}</div>
<div class="grid g2" style="margin-top:10px"><div><p class="note">THE TREE, PRUNED: the dwelling spoken at depth 0 (masses and cap), 1 (lights and entry), 2 (ornaments), 3 (the fine)</p><div class="views">${ladder}</div></div>
<div><p class="note">BY RING: the ring sets the depth, the eye spot gates each piece (tile dashed)</p><div class="views">${rings}</div></div></div>
<p class="note" style="margin-top:10px">SEVEN HOUSEHOLDS on one lot, each inside the language's variation</p><div class="views">${sweep}</div>
<div class="grid g2" style="margin-top:10px"><div><h3>How the dwelling was spoken</h3><ol class="note" style="margin:4px 0 0 18px;padding:0">${d0.why.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div><div><h3>Its laws</h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${lawRows(d0.laws)}</table></div></div></div>`;
}

const MATRIX_LOTS = [['narrow', { w: 6, d: 18 }], ['square', { w: 11, d: 13 }], ['wide', { w: 16, d: 11 }], ['deep', { w: 14, d: 24 }], ['big', { w: 22, d: 22 }]];
function matrixCard(L, style, paint, seed) {
  const uses = ['dwelling', 'shop', 'workshop', 'barn'];
  const rows = uses.map((u) => `<tr><td><b>${esc(u)}</b></td>${MATRIX_LOTS.map(([, lot]) => {
    let d; try { d = speak(L, u, lot, style, seed); } catch (e) { return `<td class="note">${esc(e.message.replace('structures: ', ''))}</td>`; }
    return `<td>${drawStructures([all(d)], { view: 'axon', paint, w: 190, h: 160, ppm: 6.2 })}<div class="note">${esc(d.why.slice(0, 2).join(' · '))} ${badge(d.laws)}</div></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="card"><h3>Principles at work: one use, five lots</h3><p class="note">One language, one seed; only the lot changes. A narrow lot builds wall to wall; a plan the anchor cannot reach across breaks into an annex; area over footprint picks the storeys; a lot too small for its programme says so. One scale (6.2 px a metre).</p>
<div style="overflow-x:auto"><table><tr><th></th>${MATRIX_LOTS.map(([k, l]) => `<th>${esc(k)} · ${l.w} × ${l.d} m</th>`).join('')}</tr>${rows}</table></div></div>`;
}

// ── one anchor, one town ────────────────────────────────────────────────────────────────────────────────────────────
const GALLERY = [['shell', 'alien-night'], ['tiered', 'isekai-sakura'], [{ seed: 2 }, 'isekai-bamboo'], [{ seed: 16 }, 'isekai-garden'], [{ seed: 32 }, 'nature-trail']];
function galleryCard(seed) {
  return GALLERY.map(([a, kit]) => {
    const st = structureStyle(kit, seed), P = structurePaint(kit), L = a.seed ? decompileAnchor(seedAnchor(a.seed)) : decompileAnchor(a), b = roundTrip(L, st, seed).building;
    const town = designTown(st, seed, { anchor: a }), dressed = dressTown(town, st, undefined, seed);
    const sq = town.places.find((p) => p.id === 'square'), near = (at) => Math.hypot(at[0] - sq.centre[0], at[1] - sq.centre[1]) < 26;
    const crop = [...townFaces(town, P, (l) => near(l.front)), ...dressed.items.filter((x) => near(x.at)).map((x) => x.faces)];
    const L2 = secondaryOf(L), sec = L2 ? fig(drawStructures([all(speak(L2, 'dwelling', LOTS.dwelling, st, seed, { band: [L.storeys + 1, L.storeys + 2] }))], { view: 'axon', paint: P, w: 150, h: 140, ppm: 6.5 }), 'its secondary') : '';
    const uses = ['dwelling', 'shop', 'barn', 'tower'].map((u) => fig(drawStructures([all(speak(L, u, LOTS[u], st, seed))], { view: 'axon', paint: P, w: 150, h: 140, ppm: 6.5 }), esc(u))).join('') + sec;
    const bad = town.laws.filter((l) => !l.ok);
    return `<div class="card"><h3>${esc(L.id)} <span class="badge">${esc(kit)} paint</span></h3><p class="note">${esc(L.read)}. ${esc(Object.entries(L.vocab).filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('+') : v}`).join(' · '))}</p>
<div class="views">${fig(drawStructures([exploded(b)], { view: 'axon', w: 260, h: 240 }), 'the anchor, in pieces')}${uses}</div>
<div class="views" style="margin-top:6px">${fig(drawStructures(crop, { view: 'axon', paint: P, w: 520, h: 360 }), `its town at the square: ${town.lots.length} lots, ${bad.length ? `advises ${bad.map((l) => l.law).join(', ')}` : 'every town law holds'}`)}</div></div>`;
  }).join('<div style="height:14px"></div>');
}

// ── laws, kits, the hierarchy ───────────────────────────────────────────────────────────────────────────────────────
function lawsCard() {
  const block = (title, laws) => `<tr><td colspan="3" style="padding-top:8px"><b>${esc(title)}</b></td></tr>${laws.map((l) => `<tr><td><b>${esc(l.id)}</b>${l.era ? `<br><span class="note">${esc(l.era)}</span>` : ''}</td><td>${esc(l.want)}</td><td class="note">${esc(l.why)}</td></tr>`).join('')}`;
  return `<div class="card"><h3>The laws <span class="badge">machine gate</span></h3><p class="note">Scale and street laws hold for every town whatever its anchor; the anchor's laws hold a building to its language; the town's laws hold the map; the paint's law holds the colour. Gates advise; none refuse.</p>
<table><tr><th>law</th><th>want</th><th>why</th></tr>${block('scale (every building)', STRUCTURE_LAWS.filter((l) => l.layer !== 'street'))}${block('the anchor\'s language', ANCHOR_LAWS)}${block('the street', STRUCTURE_LAWS.filter((l) => l.layer === 'street'))}${block('the town', TOWN_LAWS)}${block('the paint', [{ id: 'paint-keeps-values', want: 'the paint keeps the anchor\'s value order: walls over cap (or lights) over openings', why: 'values are the asset\'s; the paint may colour them, never reorder them' }, { id: 'roofs-hold', want: 'a street\'s roofs are one: every citizen\'s cap on the anchor\'s ramp and stop', why: 'the roofscape is what a town is read by from above and afar' }, { id: 'neighbours-differ', want: 'no two neighbours on a frontage painted alike', why: 'households, not a repeat: the walls are theirs' }, { id: 'variants-keep-values', want: 'every household\'s paint keeps the value order', why: 'variation never reorders the values' }])}</table></div>`;
}

function kitCard(kitId, seed) {
  const st = structureStyle(kitId, seed), P = structurePaint(kitId), L = decompileAnchor(STRUCTURE_RAILS[kitId].anchor);
  const ds = ['dwelling', 'shop', 'barn'].map((u) => speak(L, u, LOTS[u], st, seed));
  const groups = Object.keys(SURFACE_GROUPS).filter((g) => g.startsWith('str:')).map((g) => `<tr><td>${esc(g)}</td><td>${esc(P.names[g] ?? '')}${P.from[g].includes('rule') ? ` <span class="note">(${esc(P.from[g].split(' · ')[1])})</span>` : ''}</td><td><span style="display:inline-flex">${P.ramps[g].map((c) => `<i style="width:14px;height:14px;display:inline-block;background:${hexOfRgb(c)}"></i>`).join('')}</span></td></tr>`).join('');
  const law = paintLaws(P)[0];
  return `<div class="card"><h3>${esc(kitId)}</h3><div class="views">${ds.map((x) => fig(drawStructures([all(x)], { view: 'axon', paint: P, w: 170, h: 160, ppm: 5.4 }), esc(x.use))).join('')}</div>
<p class="note">Craft: chunk ${esc(showRail(STRUCTURE_RAILS[kitId].chunk))} (seed ${seed}: ${n2(st.tokens.chunk)}) · its towns speak <b>${esc(L.id)}</b> unless a recipe names another anchor.</p>
<h3>Paint <span class="badge">the style guide</span></h3><table>${groups}</table><p class="note">${law.ok ? 'holds' : 'ADVISES'}: ${esc(law.want)} (${esc(law.value)})</p></div>`;
}

function grammarCard() {
  const rows = Object.entries(PIECE_KINDS).map(([role, kinds]) => `<tr><td><b>${esc(role)}</b></td><td>${Object.entries(kinds).map(([k, r]) => `<b>${esc(k)}</b> ${esc(r)}`).join('<br>')}</td></tr>`).join('');
  const caps = Object.entries(CAPS_FOR).map(([m, c]) => `${m}: ${c.map((x) => x ?? 'no cap').join(', ')}`).join(' · ');
  return `<div class="card"><h3>The vocabulary an anchor is built from</h3><p class="note">Generic pieces, no house among them. What can carry what: ${esc(caps)}; a curved mass is entered by a tunnel. A seeded anchor is drawn from this grammar by a number.</p><table>${rows}</table></div>`;
}

function cascadeSvg() {
  const box = (y, t, s, solid) => `<rect x="150" y="${y}" width="380" height="46" fill="${solid ? '#111' : '#fff'}" stroke="#111" stroke-width="1.5"/><text x="166" y="${y + 20}" font-weight="700" font-size="13" fill="${solid ? '#fff' : '#111'}">${t}</text><text x="166" y="${y + 36}" font-size="11" fill="${solid ? '#ddd' : '#555'}">${s}</text>`;
  const arrow = (y) => `<path d="M340 ${y} v14 m-5 -6 l5 6 l5 -6" stroke="#111" fill="none" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="330" viewBox="0 0 560 330">
${box(6, '1 · ELEMENTS → THE ANCHOR', 'rules first (street holds · house varies · reads by ring), composed as a citizen in its slice', true)}${arrow(52)}
${box(68, '2 · DECOMPILE → THE LANGUAGE', 'vocabulary · proportions · rhythm · values · depths', false)}${arrow(114)}
${box(130, '3 · LOT  use · w × d · ring · corner · heartbeat', 'a programme behind a footway, its band of storeys, read from a distance', false)}${arrow(176)}
${box(192, '4 · SPEAK', 'the language on the lot; annex and tiers: the language again', false)}${arrow(238)}
${box(254, '5 · PAINT', 'the style guide colours the values; households by the street\'s rules', false)}
<rect x="6" y="130" width="120" height="46" fill="#fff" stroke="#111" stroke-dasharray="4 3"/><text x="16" y="150" font-weight="700" font-size="12">THE ROUTES</text><text x="16" y="166" font-size="10" fill="#555">cut the lots</text><path d="M126 153 h22 m-6 -5 l6 5 l-6 5" stroke="#111" fill="none"/>
<rect x="6" y="192" width="120" height="46" fill="#fff" stroke="#111" stroke-dasharray="4 3"/><text x="16" y="212" font-weight="700" font-size="12">LAWS · EYE SPOT</text><text x="16" y="228" font-size="10" fill="#555">scale, street, ring</text><path d="M126 215 h22 m-6 -5 l6 5 l-6 5" stroke="#111" fill="none"/>
<text x="150" y="320" font-size="11" fill="#555">no layer stores a house: the town is its elements, composed once and spoken</text></svg>`;
}

function paintCard(town, dressed) {
  const sq = town.places.find((p) => p.id === 'square'), near = (at) => Math.hypot(at[0] - sq.centre[0], at[1] - sq.centre[1]) < 24;
  const dress = dressed.items.filter((x) => near(x.at)).map((x) => x.faces), faces = [...townFaces(town, null, (l) => near(l.front)), ...dress];
  const kits = ['isekai-meadow', 'isekai-sakura', 'nature-trail', 'alien-night'].map((k) => { const P = structurePaint(k); return fig(drawStructures([...townFaces(town, P, (l) => near(l.front)), ...dress], { view: 'axon', paint: P, w: 300, h: 230 }), `painted: ${esc(k)}`); }).join('');
  return `<div class="card"><h3>Values first, paint second <span class="badge solid">separate concerns</span></h3><p class="note">Every piece is a value on a surface group; the style guide paints it. Below: the town as built, then its square as built and in four kits' paint. Nothing about the asset changes between them.</p>
<div class="grid g2"><div>${townMapSvg(town, null, dressed, { px: 3.4, labels: false })}</div><div class="views">${fig(drawStructures(faces, { view: 'axon', w: 300, h: 230 }), 'as built: values')}${kits}</div></div></div>`;
}

// ── the elements ────────────────────────────────────────────────────────────────────────────────────────────────────
const holdOf = (spec) => (spec.hold === 'street' ? 'the street holds' : spec.hold === 'share' ? 'a household\'s choice' : `a house ± ${spec.hold.house < 1 ? `${Math.round(spec.hold.house * 100)} %` : spec.hold.house}`);
const showP = (v) => (Array.isArray(v) ? v.map((s) => `${s.group} ${s.value}${s.bond && s.bond !== 'none' ? ` (${s.bond})` : ''}`).join(' / ') : typeof v === 'number' ? n2(v) : String(v));
/** The least span an element shows (m), to read it against each ring's eye spot; null for what reads by its run. */
const spanOf = (el, ch, E) => ({ light: Math.min(el.w, el.h ?? el.w), door: el.w, socle: el.h, cornice: el.h * ch, sill: el.h * ch, lintel: el.h * ch, quoins: el.course, chimney: el.w * ch, point: 2 * el.base * ch, rib: el.w * ch, band: el.w * ch, frame: el.member * ch, shutters: (Object.values(E).find((x) => x.kind === 'light')?.w ?? 1) / 2, lamp: 0.32, post: 0.22, kerb: el.w, wall: { coursed: 0.45, ashlar: 0.5, brick: 0.3, rubble: 0.4, boards: 0.28 }[el.storeys?.[0]?.bond] ?? null }[el.kind] ?? null);
function elementsCard(L, style, paint) {
  const E = L.elements, ch = style.tokens.chunk, A = L.anchor;
  if (!E) return '<p class="note">This anchor was given as pieces: it names no elements.</p>';
  const RINGS = { near: 3, mid: 2, far: 0 }, street = (el) => ELEMENT_KINDS[el.kind].family === 'street', furniture = (el) => ['lamp', 'post', 'fence'].includes(el.kind);
  const card = ([id, el]) => {
    const K = ELEMENT_KINDS[el.kind], faces = elementSwatch(A, id, ch), span = spanOf(el, ch, E);
    const params = Object.entries(K.params).filter(([p]) => el[p] !== undefined).map(([p, spec]) => `<tr><td>${esc(p)}</td><td><b>${esc(showP(el[p]))}</b></td><td class="note">${esc(holdOf(spec))}</td><td class="note">${esc(Array.isArray(spec.rail) && typeof spec.rail[0] === 'number' ? `${spec.rail[0]}–${spec.rail[1]}` : spec.rail.length > 4 ? `${spec.rail.length} forms` : spec.rail.join(' | '))}</td></tr>`).join('') + (el.storeys ? `<tr><td>storeys</td><td colspan="3"><b>${esc(showP(el.storeys))}</b> <span class="note">the street holds</span></td></tr>` : '') + (el.group ? `<tr><td>group</td><td colspan="3">${esc(el.group)} ${el.value}</td></tr>` : '');
    const reads = Object.entries(RINGS).map(([r, dep]) => { const shown = furniture(el) ? r === 'near' : dep >= K.depth; const how = !shown ? '—' : span === null ? 'geometry' : el.kind === 'wall' ? (span >= eyeSpot(r) ? 'marks' : 'a value') : span >= eyeSpot(r) ? 'geometry' : 'tile'; return `${r} <b>${how}</b>`; }).join(' · ');
    return `<div class="card"><h3>${esc(id)} <span class="badge">${esc(el.kind)}</span></h3>${faces.length ? `<div class="views">${drawStructures([faces], { view: 'axon', w: 170, h: 150 })}${drawStructures([faces], { view: 'axon', paint, w: 170, h: 150 })}</div>` : ''}<p class="note">${esc(K.read)}</p><table>${params}</table><p class="note">depth ${K.depth} · reads: ${reads}</p></div>`;
  };
  const building = Object.entries(E).filter(([, el]) => !street(el)), streetEls = Object.entries(E).filter(([, el]) => street(el));
  return `<p class="note">Designed before anything is composed: each element is rules, never a shape. Its params have rails; each says whether the street holds it (every citizen on a frontage shares it) or a house may vary it, and by how much; each reads at a ring as geometry, a mark in the tile, or not at all, by the eye spot (${STRUCTURE_RING_IDS.map((r) => `${r} ${eyeSpot(r)} m`).join(', ')}). Drawn on its own: values, then painted.</p>
<h3>The building's</h3><div class="grid g3">${building.map(card).join('')}</div><h3 style="margin-top:10px">The street's</h3><div class="grid g3">${streetEls.map(card).join('')}</div>`;
}

/** The citizen in its slice of street: footway, kerb and road in front of its lot, its lamp and posts on the walk. */
function sliceCard(L, style, paint, seed) {
  const b = roundTrip(L, style, seed).building, A = L.anchor, ch = style.tokens.chunk, len = Math.max(A.lot.w, b.dims.W0 + 2);
  const S = sliceStreet(A, len, ch), dy = S.foot + 0.4 + b.dims.front, dx = (len - b.dims.W0) / 2;
  const house = all(b).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x + dx, y + dy, z + S.top]) }));
  const lot = [{ corners: [[0, S.foot, S.top], [len, S.foot, S.top], [len, S.foot + A.lot.d, S.top], [0, S.foot + A.lot.d, S.top]], normal: [0, 0, 1], part: 'ground', group: 'town:grass', value: 0.45 }];
  const X = L.street, row = [['road', `${X.road.paving}: the lane's; a branch takes the kit's flags, a back lane earth`], ['kerb', `${X.kerb.h} m high, ${X.kerb.w} m wide`], ['footway', `${X.footway.w} m in ${X.footway.paving}; ${Math.round(0.6 * 100)} % of it on a branch, none on a back lane`], ['lamp', `${X.lamp.head} on a ${X.lamp.arm === 'post' ? 'post' : X.lamp.arm}, ${X.lamp.h} m, every ${X.lamp.stride} m by the kerb`], ['post', `${X.post.form}, ${X.post.h} m, every ${X.post.stride} m where the walk meets the square and at stairs`], ['fence', `${X.fence.form}, ${X.fence.h} m, along the lots' backs`]].map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join('');
  return `<div class="card"><h3>The slice <span class="badge solid">a house and its street</span></h3><p class="note">The anchor is more than a house: it is the citizen standing on its lot behind the street it gives the town. Its road, kerb, footway, lamp and posts are designed with it, and every route in the town is laid in this section, stepped down the ranks.</p>
<div class="views">${fig(drawStructures([S.faces, house], { view: 'axon', w: 440, h: 360, floor: lot }), 'the slice, values')}${fig(drawStructures([S.faces, house], { view: 'axon', paint, w: 440, h: 360, floor: lot }), `painted: ${esc(paint.kitId)}`)}${fig(drawStructures([S.faces, house], { view: 'side', w: 360, h: 200, ppm: 13 }), `in section: road · kerb ${X.kerb.h} m · footway ${X.footway.w} m · setback ${n2(b.dims.front)} m · the house`)}</div>
<table style="margin-top:8px">${row}</table></div>`;
}

/** A frontage of citizens: one language, six households on six lots; what the street holds drawn across them. */
function variationCard(L, style, paint, seed) {
  const widths = [8.5, 10.5, 9, 11.5, 8, 10], lots = [];
  let x = 0;
  widths.forEach((w, k) => { const d = speak(L, 'dwelling', { w, d: 18 }, style, seed + 101 * (k + 1), { band: [L.storeys, L.storeys] }); lots.push({ route: 'lane', side: 'left', s: x, w, d: 18, design: d, x }); x += w; });
  const P = streetPaints(paint, { lots, language: L, seed });
  const faces = (painted) => lots.map((l, i) => all(l.design).map((f) => ({ ...f, corners: f.corners.map(([u, v, z]) => [u + l.x + (l.w - l.design.dims.W0) / 2, v + l.design.dims.front, z]), ...(painted ? { paint: P.paints[i] } : {}) })));
  const k = 7.2, w = Math.ceil(x * k + 20), h = 170, at = [10, h - 14], sh = lots[0].design.dims.storeyH;
  const lines = Array.from({ length: L.storeys }, (_, i) => `<line x1="4" x2="${w - 4}" y1="${(at[1] - (i + 1) * sh * k).toFixed(1)}" y2="${(at[1] - (i + 1) * sh * k).toFixed(1)}" stroke="#c00" stroke-dasharray="5 4" stroke-width="1"/>`).join('');
  const H = L.holds, held = H.street.map((x2) => `<b>${esc(x2)}</b>`).join(', '), house = Object.entries(H.house).map(([k2, v]) => `${esc(k2)} ± ${v < 1 ? `${Math.round(v * 100)} %` : v}`).join(', '), share = Object.entries(H.share).map(([k2, v]) => `${esc(k2)} ${Math.round(v * 100)} % of households`).join(', ');
  return `<div class="card"><h3>One frontage, six households <span class="badge">the street holds · a house varies</span></h3><p class="note">Variation within reason: what makes the street read as one does not move (the dashed lines: every storey at ${sh} m, so the eaves and the lights' heads line up); what is a household's does (its bays, its door's bay and hand, its lights, whether it hangs shutters or carries ribs); its paint is a ruled variation of the anchor's (the roofs hold, the walls step or swap, neighbours differ).</p>
<div class="views">${fig(drawStructures(faces(false), { view: 'front', w, h, ppm: k, at, over: lines }), 'values, in elevation')}${fig(drawStructures(faces(true), { view: 'front', paint, w, h, ppm: k, at, over: lines }), 'each household in its paint')}</div>
<div class="views" style="margin-top:6px">${fig(drawStructures(faces(true), { view: 'axon', paint, w: 640, h: 300 }), 'standing')}</div>
<table style="margin-top:8px"><tr><td>the street holds</td><td>${held}</td></tr><tr><td>a house may move</td><td>${house}</td></tr><tr><td>a household's choice</td><td>${share || '—'}</td></tr><tr><td>the paint</td><td>${P.laws.map((l) => `${esc(l.law)} <b class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</b> (${esc(l.value)})`).join(' · ')}</td></tr></table></div>`;
}

// ── the secondary ───────────────────────────────────────────────────────────────────────────────────────────────────
/** A frontage of lots along x, each { w, design, secondary }, as face groups (painted per lot when `paints` is given). */
const frontage = (lots, paints) => lots.map((l, i) => all(l.design).map((f) => ({ ...f, corners: f.corners.map(([u, v, z]) => [u + l.x + (l.w - l.design.dims.W0) / 2, v + l.design.dims.front, z]), ...(paints ? { paint: paints[i] } : {}) })));
function secondaryCard(L, style, paint, seed) {
  const L2 = secondaryOf(L);
  if (!L2) return '<p class="note">This anchor was given as pieces: it has no elements to derive a secondary from.</p>';
  const a = roundTrip(L, style, seed).building, b = speak(L2, 'dwelling', { w: 9, d: 16 }, style, seed, { band: [L.storeys + 1, L.storeys + 2] });
  const P = (x) => x?.toString?.() ?? '—', E = L.elements, E2 = L2.elements, cap = (X) => Object.values(X).find((e) => e.kind === 'cap'), li = (X) => Object.values(X).find((e) => e.kind === 'light'), wall = (X) => Object.values(X).find((e) => e.kind === 'wall');
  const did = { shares: `storey ${L2.proportions.storeyH} m, the ${L2.vocab.entryShape} door, ${L2.vocab.opening} lights, the ${wall(E2).storeys[0].group.replace('str:', '')} ground${wall(E2).storeys[0].bond !== 'none' ? ` (${wall(E2).storeys[0].bond})` : ''}, ${L2.vocab.ornaments.filter((k) => !['point', 'band'].includes(k)).join(', ') || 'no details'}, the street`, rises: `${n2(b.dims.W0)} m square, ${b.dims.n} storeys, crowning ${n2(b.measures.ridge)} m (the anchor ${n2(a.measures.ridge)} m)`, steepens: `${cap(E).form}${cap(E).pitch ? ` ${cap(E).pitch}°` : ''} → ${cap(E2).form}${cap(E2).pitch ? ` ${cap(E2).pitch}°` : cap(E2).rise ? ` rise ${cap(E2).rise}` : ''}`, 'turns-the-tone': `walls ${wall(E).storeys.map((x) => `${x.group.replace('str:', '')} ${x.value}`).join(' / ')} → ${wall(E2).storeys.map((x) => `${x.group.replace('str:', '')} ${x.value}`).join(' / ')}; cap ${P(cap(E).group?.replace('str:', ''))} ${P(cap(E).value)} → ${cap(E2).group.replace('str:', '')} ${cap(E2).value}`, crowns: `a finial; bands at ${E2.bands.value}`, 'upright-lights': `${li(E).w} × ${li(E).h ?? li(E).w} → ${li(E2).w} × ${li(E2).h ?? li(E2).w} m`, drops: [L.vocab.annex ? 'the annex' : null, L.vocab.tiers ? 'the tiers' : null].filter(Boolean).join(', ') || 'nothing to drop' };
  const rules = SECONDARY_RULES.map((r) => `<tr><td><b>${esc(r.id)}</b></td><td class="note">${esc(r.rule)}</td><td>${esc(did[r.id] ?? '')}</td></tr>`).join('');
  // a frontage of eight with two secondaries set in it, as the town sets them: a run's end, and a rhythm
  const widths = [8.5, 9.5, 10, 8, 11, 9, 8.5, 10], lots = [];
  let x = 0;
  widths.forEach((w, k) => { const sec = k === 2 || k === 6, d = sec ? speak(L2, 'dwelling', { w, d: 18 }, style, seed + 31 * k, { band: [L.storeys + 1, L.storeys + 1 + (k % 2)] }) : speak(L, 'dwelling', { w, d: 18 }, style, seed + 101 * (k + 1), { band: [L.storeys, L.storeys] }); lots.push({ route: 'lane', side: 'left', s: x, w, d: 18, design: d, x, secondary: sec }); x += w; });
  const S = streetPaints(paint, { lots, language: L, secondary: L2, seed }), k = 6.2, w = Math.ceil(x * k + 20), h = 200, at = [10, h - 14];
  const sil = frontage(lots).map((g) => g.map((f) => ({ ...f, value: 0.12, tile: false }))).map((g) => g.filter((f) => !['opening', 'lens', 'door', 'bond', 'course', 'quoin'].includes(f.part)));
  return `<div class="card"><h3>The secondary <span class="badge solid">derived, not authored</span></h3><p class="note">The anchor's counterpoint, derived from its elements by contrast rules, so every anchor (authored or seeded) has one: it shares what makes the town one place and turns what gives a skyline its rhythm. The town sets it among the citizens as punctuation (a corner or a run's end first, then a rhythm along each frontage, never two together), the lowest band that rises a metre over both its neighbours, and under the hall round the square; where none fits, the lot stays a citizen. ${esc(L2.read)}.</p>
<div class="views">${fig(drawStructures([all(a)], { view: 'axon', w: 230, h: 260, ppm: 9 }), 'the anchor')}${fig(drawStructures([all(b)], { view: 'axon', w: 230, h: 260, ppm: 9 }), 'its secondary')}${fig(drawStructures([all(a)], { view: 'axon', paint, w: 230, h: 260, ppm: 9 }), 'painted')}${fig(drawStructures([all(b)], { view: 'axon', paint: S.paints[2], w: 230, h: 260, ppm: 9 }), 'painted: one voice, fitted')}</div>
<table style="margin-top:8px"><tr><th>rule</th><th></th><th>here</th></tr>${rules}</table>
<p class="note" style="margin-top:10px">A FRONTAGE OF EIGHT, TWO SECONDARIES SET IN IT: as a silhouette (the height it adds), in values (the tone it turns), and painted</p>
<div class="views">${fig(drawStructures(sil, { view: 'front', w, h, ppm: k, at }), 'the skyline')}${fig(drawStructures(frontage(lots), { view: 'front', w, h, ppm: k, at }), 'in values')}${fig(drawStructures(frontage(lots, S.paints), { view: 'front', paint, w, h, ppm: k, at }), 'painted')}</div>
<div class="views" style="margin-top:6px">${fig(drawStructures(frontage(lots, S.paints), { view: 'axon', paint, w: 760, h: 340 }), 'standing')}</div>
<p class="note">${S.laws.map((l) => `${esc(l.law)} <b class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</b>`).join(' · ')}</p></div>`;
}

/** The whole index as one HTML page. `town` is the town's recipe, its `anchor` an anchor id, pieces, or { seed }. */
export function outStructuresHtml({ seed = 8, kitId = 'isekai-meadow', town: recipe = {} } = {}) {
  resetTownIds();
  const style = structureStyle(kitId, seed), paint = structurePaint(kitId, recipe.paint), town = designTown(style, seed, recipe), dressed = dressTown(town, style, recipe.dress, seed), L = town.language;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outdoor Structures Index</title><style>${CSS}.views svg{border:1px solid var(--line)}ol li{margin:2px 0}</style></head><body><div id="page">
<h1>OUTDOOR STRUCTURES INDEX</h1>
<p class="lede">A town spoken from one anchor structure. Its elements are designed first, each a set of rules (what the street holds, what a house may vary, how it reads by ring); the anchor is composed from them as a citizen, the ordinary house at full effort, standing in its slice of street (footway, kerb, road, lamp, posts). It is built in pieces, in values only; decompiled, it gives the town its language (vocabulary, proportions, rhythm, values, depths); every building is that language spoken on a lot cut from a route, pruned by its ring and gated by the eye spot, and an annex or a tier is the language spoken again. The style guide paints it as a separate concern. Here: <b>${esc(L.id)}</b>, painted in ${esc(kitId)}, seed ${seed}. Placed in a world: not yet.</p>
<div class="card"><h3>The town this is tuned toward <span class="badge solid">${esc(STRUCTURE_TARGET.kit)}</span></h3><p class="note">${esc(STRUCTURE_TARGET.read)}. <b>Scale:</b> ${esc(STRUCTURE_TARGET.scale)}. <b>Materials:</b> ${esc(STRUCTURE_TARGET.materials)}.</p></div>
<h2>The elements</h2>${elementsCard(L, style, paint)}
<h2>The anchor: a citizen in its slice of street</h2>${sliceCard(L, style, paint, seed)}${anchorCard(L, style, paint, seed)}
<h2>Spoken</h2>${spokenCard(L, style, paint, seed)}
<h2>Variation within reason</h2>${variationCard(L, style, paint, seed)}
<h2>The secondary</h2>${secondaryCard(L, style, paint, seed)}
<h2>The town</h2>${townMapCard(town, paint, dressed)}${townAxonCard(town, paint, dressed)}
<h2>Heartbeats</h2>${heartbeatCard(style, paint, seed, { ...recipe, heartbeat: undefined })}
<h2>One anchor, one town</h2><p class="note">The same code, other anchors: two authored, three seeded from the vocabulary by a number. Each is shown in pieces, spoken on four uses, and as the square of the town it speaks.</p>${galleryCard(seed)}
<h2>Values and paint</h2>${paintCard(town, dressed)}
<h2>Principles at work</h2>${matrixCard(L, style, paint, seed)}
<h2>Routes and levels</h2>${routesCard(town)}
<h2>Paving</h2>${pavingCard(paint)}
<h2>Town interceptors</h2>${dressCard(town, style, paint, seed)}
<h2>The hierarchy</h2><div class="grid g2"><div>${cascadeSvg()}</div>${grammarCard()}</div>
<h2>Laws</h2>${lawsCard()}
<h2>Roofs</h2>${roofsCard(L, style, paint, seed)}
<h2>Kits</h2><div class="grid g3">${STRUCTURE_KITS.map((k) => kitCard(k, seed)).join('')}</div>
</div></body></html>`;
}
