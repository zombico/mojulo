/**
 * THE FLORA INDEX, drawn — the outdoor plants as doodads on one page, beside the master index: the four forms and
 * their variants, a seed's variation inside the rails, the reveal levels and what each costs, leaf density depicted by
 * porosity, one set of doodads skinned in every kit, bark as dials and patterns, mojulo's grass primitives, and the
 * jungle read as a composition. Data: era/out-flora.js and era/style/swatches.js. `outFloraHtml(opts)` is pure.
 */
import { FLORA_FORMS, FLORA_FORM_IDS, FLORA_LEVELS, FLORA_LAWS, FLORA_PARTS, FLORA_SKINS, BARK_PATTERNS, BARK_DIALS, GRASS_PRIMITIVES, COMPOSITION_ROLES, JUNGLE_COMPOSITION, designFlora, floraLaws, floraMeasures, floraSkin, floraScatter, INCONGRUITY_GAIN, RING_GAIN } from './out-flora.js';
import { SWATCHES, hexOfRgb } from './style/swatches.js';
import { CSS } from './out-index-html.js';
import { mulberry32 } from '../vegetation/grow.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v));
const SUN = (() => { const s = [-0.45, -0.6, 0.66], l = Math.hypot(...s); return s.map((x) => x / l); })();

/** A doodad's front elevation in a kit's swatches: faces sorted far to near, each its part's ramp stop, a stop up or
 *  down where it faces the sun or away. `ppm` fixes the scale (pixels a metre) so a row compares sizes. */
function drawFlora(d, kitId, { w = 150, h = 150, ppm = null, ground = true } = {}) {
  const land = SWATCHES[kitId].land, skin = floraSkin(kitId);
  const proj = (p) => [p[0], p[2]];
  let x0 = Infinity, x1 = -Infinity, z1 = 0;
  for (const f of d.faces) for (const p of f.corners) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[2]); }
  const k = ppm ?? Math.min((w - 16) / Math.max(0.01, x1 - x0), (h - 16) / Math.max(0.01, z1));
  const cx = w / 2 - ((x0 + x1) / 2) * k, base = h - 8;
  const faces = d.faces.map((f) => ({ f, y: f.corners.reduce((s, p) => s + p[1], 0) / f.corners.length })).sort((a, b) => b.y - a.y);
  const polys = faces.map(({ f }) => {
    const ramp = land[skin[f.part]] ?? land.foliage, n = ramp.length;
    const lam = f.normal[0] * SUN[0] + f.normal[1] * SUN[1] + f.normal[2] * SUN[2];
    const stop = Math.max(0, Math.min(n - 1, Math.round(f.value * (n - 1)) + (lam > 0.55 ? 1 : lam < 0.05 ? -1 : 0)));
    const col = hexOfRgb(ramp[stop]);
    return `<polygon points="${f.corners.map(proj).map(([x, z]) => `${(cx + x * k).toFixed(1)},${(base - z * k).toFixed(1)}`).join(' ')}" fill="${col}" stroke="${col}" stroke-width="0.5" stroke-linejoin="round"/>`;
  }).join('');
  const g = ground ? `<line x1="2" x2="${w - 2}" y1="${base + 0.5}" y2="${base + 0.5}" stroke="#111" stroke-width="1.2"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(`${d.dials.form} ${d.dials.variant}`)}">${g}${polys}</svg>`;
}

const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
const lawLine = (d) => { const l = floraLaws(d); return l.length ? `<span class="badge solid">${esc(l.map((x) => x.law).join(', '))}</span>` : ''; };

function formCard(id, kitId, seed) {
  const F = FLORA_FORMS[id], variants = Object.keys(F.variants);
  const designs = variants.map((v) => designFlora(id, v, seed, { level: 'near' }));
  const zMax = Math.max(...designs.map((d) => floraMeasures(d).height));
  const row = designs.map((d, i) => fig(drawFlora(d, kitId, { w: 170, h: 170 }), `${esc(variants[i])} · ${n2(floraMeasures(d).height)} m ${lawLine(d)}`)).join('');
  const sweep = Array.from({ length: 7 }, (_, i) => designFlora(id, variants[1] ?? variants[0], seed + 11 * (i + 1), { level: 'mid' }));
  const span = (d) => { let a = Infinity, b = -Infinity; for (const f of d.faces) for (const p of f.corners) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); } return b - a; };
  const sh = Math.max(...sweep.map((d) => floraMeasures(d).height)), sw = Math.max(...sweep.map(span)), ppm = Math.min(108 / Math.max(0.3, sh), 100 / Math.max(0.3, sw));
  const sweepRow = sweep.map((d, i) => fig(drawFlora(d, kitId, { w: 110, h: 122, ppm }), `seed ${seed + 11 * (i + 1)}`)).join('');
  const levels = ['near', 'mid', 'far'].map((lv) => { const d = designFlora(id, variants[1] ?? variants[0], seed, { level: lv }); return fig(drawFlora(d, kitId, { w: 120, h: 120 }), `${lv} · ${d.faces.length} faces / ${FLORA_LEVELS[lv].budget}`); }).join('');
  const rails = Object.entries(F.rails).map(([k, r]) => `<tr><td><code>${esc(k)}</code></td><td>${n2(r[0])}–${n2(r[1])}</td>${variants.map((v) => { const x = F.variants[v][k]; return `<td>${x == null ? '<span class="note">·</span>' : Array.isArray(x) ? `${n2(x[0])}–${n2(x[1])}` : esc(x)}</td>`; }).join('')}</tr>`).join('');
  void zMax;
  return `<div class="card"><h3>${esc(id)}</h3><p class="note">${esc(F.read)}. Makes: ${esc(F.makes.join(', '))}.</p>
<div class="views">${row}</div>
<p class="note" style="margin-top:10px">VARIATION: seven seeds of <b>${esc(variants[1] ?? variants[0])}</b> at one scale, every dial rolled inside its rails</p><div class="views">${sweepRow}</div>
<div class="grid g2" style="margin-top:10px"><div><p class="note">LEVELS: built by reveal ring, each inside its face budget</p><div class="views">${levels}</div></div>
<div><table><tr><th>dial</th><th>rail</th>${variants.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>${rails}</table></div></div></div>`;
}

function densityCard(kitId, seed) {
  const steps = [0, 0.12, 0.24, 0.35];
  const row = steps.map((p) => { const d = designFlora('broccoli', 'broccoli', seed, { level: 'near', over: { porosity: p, masses: 8 } }); return fig(drawFlora(d, kitId, { w: 150, h: 160 }), `porosity ${p}`); }).join('');
  const pads = [0, 0.4].map((p) => { const d = designFlora('broccoli', 'pads', seed + 3, { level: 'near', over: { porosity: p } }); return fig(drawFlora(d, kitId, { w: 150, h: 160 }), `pads, porosity ${p}`); }).join('');
  return `<div class="card"><h3>Leaf density, depicted</h3><p class="note">Density is how many masses, how much they overlap, and how much dark core shows through the gaps, never a leaf count. Porosity drops masses off the shell; the core (the darkest foliage stop) reads as the depth inside. Leaf detail, where a kit wants it, is a texture or a card on the mass.</p><div class="views">${row}${pads}</div></div>`;
}

function skinCard(seed) {
  const set = [['broccoli', 'broccoli'], ['mushroom', 'parasol'], ['mushroom', 'toadstool'], ['fungi', 'bracket'], ['fingers', 'saguaro'], ['fingers', 'coral']];
  const kits = Object.keys(FLORA_SKINS);
  const rows = kits.map((k) => `<tr><td style="white-space:nowrap"><b>${esc(k)}</b><br><span class="note">${esc(Object.entries(floraSkin(k)).map(([p, r]) => `${p}→${r}`).join(' '))}</span></td><td><div class="views">${set.map(([f, v]) => drawFlora(designFlora(f, v, seed, { level: 'mid' }), k, { w: 92, h: 92 })).join('')}</div></td></tr>`).join('');
  return `<div class="card"><h3>One set, every kit</h3><p class="note">The same six doodads at the same seed. Each kit's skin points every part at one of its swatch ramps; nothing else changes.</p><table>${rows}</table></div>`;
}

// a bark pattern as a tile, in a kit's bark ramp: the fracture model's dials drawn as strokes
function barkTileSvg(pattern, kitId, seed, dials = null) {
  const ramp = SWATCHES[kitId].land.bark, n = ramp.length, rand = mulberry32(seed * 7919 + pattern.length), W = 96, H = 128;
  const lo = hexOfRgb(ramp[0]), mid = hexOfRgb(ramp[Math.min(n - 1, 1)]), hi = hexOfRgb(ramp[n - 1]);
  const sp = dials ? 8 * dials.spacing : 12, tw = dials ? Math.min(30, dials.twist) * 1.2 : 0;
  let s = '';
  const wave = (x, y0, y1, amp, lean) => { let d = `M${x},${y0}`; for (let y = y0; y <= y1; y += 8) d += ` L${(x + Math.sin(y * 0.09 + rand() * 0.6) * amp + (y - y0) * lean).toFixed(1)},${y}`; return d; };
  if (pattern === 'smooth') for (let i = 0; i < 14; i++) s += `<ellipse cx="${rand() * W}" cy="${rand() * H}" rx="${6 + rand() * 10}" ry="${4 + rand() * 8}" fill="${mid}" opacity="0.35"/>`;
  else if (pattern === 'ringed') { for (let y = 8; y < H; y += 9 + rand() * 6) for (let x = rand() * 10; x < W; x += 16 + rand() * 10) s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(6 + rand() * 8).toFixed(1)}" height="2" rx="1" fill="${lo}"/>`; }
  else if (pattern === 'ridged' || pattern === 'spiral') { for (let x = -20; x < W + 20; x += sp + rand() * sp * 0.5) s += `<path d="${wave(x, -4, H + 4, 3 + rand() * 2, pattern === 'spiral' ? Math.tan((Math.max(12, tw) * Math.PI) / 180) : 0)}" stroke="${lo}" stroke-width="${(2 + rand() * 2.5).toFixed(1)}" fill="none" stroke-linecap="round"/>`; }
  else if (pattern === 'plated') { for (let x = 0; x < W; x += sp * 1.4) { let y = rand() * -10; while (y < H) { const ph = 12 + rand() * 18, pw = sp * 1.4 - 3; s += `<rect x="${(x + 1.5).toFixed(1)}" y="${y.toFixed(1)}" width="${pw.toFixed(1)}" height="${(ph - 3).toFixed(1)}" rx="2" fill="${mid}"/>`; y += ph; } } }
  else if (pattern === 'noded') { for (let y = 16; y < H; y += 30) s += `<rect x="0" y="${y}" width="${W}" height="3" fill="${lo}"/><rect x="0" y="${y + 3}" width="${W}" height="2" fill="${hi}"/>`; }
  else if (pattern === 'scaled') { for (let y = -6, r = 0; y < H; y += 12, r++) for (let x = (r % 2) * 9 - 9; x < W + 9; x += 18) s += `<path d="M${x},${y} q9,16 18,0" stroke="${lo}" stroke-width="2" fill="${mid}"/>`; }
  const bg = pattern === 'plated' ? lo : hexOfRgb(ramp[Math.min(n - 1, 2)] ?? ramp[n - 1]);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${s}</svg>`;
}

function barkCard(kitId, seed) {
  const pats = Object.entries(BARK_PATTERNS).map(([p, read]) => fig(barkTileSvg(p, kitId, seed), `<b>${esc(p)}</b><br><span style="text-transform:none">${esc(read)}</span>`)).join('');
  const rows = Object.entries(BARK_DIALS).map(([k, d]) => `<tr><td><b>${esc(k)}</b></td><td>${n2(d.smooth)}</td><td>${n2(d.spacing)}</td><td>${n2(d.plates)}</td><td>${n2(d.twist)}°</td><td>${n2(d.lenticels)}</td><td>${n2(d.contrast)}</td><td>${esc(d.pattern)}</td><td>${barkTileSvg(d.pattern, kitId, seed + k.length, d).replace(/width="96" height="128"/, 'width="36" height="48"')}</td></tr>`).join('');
  return `<div class="card"><h3>Bark, as dials</h3><p class="note">mojulo grows bark as fracture: a dead skin on a widening stem either keeps up with the stretch (smooth), opens its fissures, or cracks a plate down its middle when it grows too wide for its thickness; cracks lean with the grain. Those few numbers are the dials. A doodad wears the stylized pattern its dials read as, drawn in values in its kit's bark ramp, and only near: at mid the wood is a value band, far it is a single tone.</p>
<div class="views">${pats}</div>
<table style="margin-top:10px"><tr><th>preset</th><th>smooth</th><th>spacing</th><th>plates</th><th>twist</th><th>lenticels</th><th>contrast</th><th>reads as</th><th></th></tr>${rows}</table></div>`;
}

function grassCard() {
  const rows = Object.entries(GRASS_PRIMITIVES).map(([k, g]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(g.read)}</td><td>${esc(g.cost)}</td><td>${esc(g.suits.join(', '))}</td><td><code>${esc(g.where)}</code></td></tr>`).join('');
  return `<div class="card"><h3>Grass: choose, don't default</h3><p class="note">The painted blade cards are one grass among several mojulo already has. A kit names its grass by token; a composition can mix two (cards in the light gaps, a ground texture under the far ring).</p><table><tr><th>primitive</th><th>reads as</th><th>cost</th><th>suits</th><th>where</th></tr>${rows}</table></div>`;
}

function jungleCard(kitId, seed) {
  const J = JUNGLE_COMPOSITION, w = 40, dd = 60, px = 6;
  const pts = floraScatter(J.plan, seed, { w, d: dd, rings: J.rings });
  const fills = ['#111', '#777', '#bbb'];
  const plan = `<svg viewBox="0 0 ${w * px} ${dd * px}" width="${w * px}" height="${dd * px}">
<rect width="${w * px}" height="${dd * px}" fill="#fff" stroke="#111"/>
${[J.rings.near, J.rings.mid].map((r) => `<line x1="${(w / 2 - r) * px}" x2="${(w / 2 - r) * px}" y1="0" y2="${dd * px}" stroke="#999" stroke-dasharray="3 4"/><line x1="${(w / 2 + r) * px}" x2="${(w / 2 + r) * px}" y1="0" y2="${dd * px}" stroke="#999" stroke-dasharray="3 4"/>`).join('')}
<rect x="${(w / 2 - 1) * px}" y="0" width="${2 * px}" height="${dd * px}" fill="#eee"/>
${pts.map((p) => `<circle cx="${((p.x + w / 2) * px).toFixed(1)}" cy="${((dd - p.y) * px).toFixed(1)}" r="${(p.size * p.scale * px * 0.5).toFixed(1)}" fill="${fills[p.si]}" fill-opacity="${p.si === 0 ? 0.85 : 0.7}"/>`).join('')}</svg>`;
  const rows = J.layers.map((L) => {
    const meta = Object.entries(L).filter(([k]) => !['role', 'what', 'as', 'keeps'].includes(k)).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '') : v}`).join(' · ');
    const d = L.as && designFlora(L.as.form, L.as.variant, seed, { level: L.as.level ?? 'mid' });
    return `<tr><td><b>${esc(L.role)}</b></td><td>${esc(L.what)}<br><span class="note">${esc(meta)}</span></td><td>${L.as ? esc(`${L.as.form} / ${L.as.variant}`) : '<span class="note">no doodad</span>'}${L.keeps ? `<br><span class="note">keeps ${esc(L.keeps)}</span>` : ''}</td><td>${d ? drawFlora(d, kitId, { w: 64, h: 64 }) : ''}</td></tr>`;
  }).join('');
  const counts = J.plan.map((s, i) => `<span style="display:inline-block;width:10px;height:10px;background:${fills[i]};margin:0 4px 0 10px"></span>${esc(s.id)} ${pts.filter((p) => p.species === s.id).length}`).join('');
  return `<div class="card"><h3>The jungle, read as a composition <span class="badge">polished example</span></h3><p class="note">jungle-mgs3's card restated as layers (roles: ${esc(COMPOSITION_ROLES.join(', '))}), each with the doodad form it would be. Dominant layer: <b>${esc(J.dominant)}</b>. Rings from the trail: near ${J.rings.near} m, mid ${J.rings.mid} m. A composition's rules: every sightline crosses three layers; one layer dominates the frame; a layer holds one to three species, clumped by species and varied inside its rails; density falls by ring; the trail is the one cut.</p>
<div class="grid g2"><div><table><tr><th>layer</th><th>what (from the card)</th><th>as a doodad</th><th></th></tr>${rows}</table></div>
<div><p class="note">PLAN: the plan species scattered by <code>floraScatter</code>, clumped, thinning by ring (dashed), clear of the trail (grey).</p>${plan}<p class="note">${counts}</p></div></div></div>`;
}

// several doodads side by side on one ground line, at one scale (a run)
function drawRun(items, kitId, { w = 560, h = 150 } = {}) {
  const faces = [];
  let x = 0;
  for (const { d, gap = 0.4 } of items) {
    let a = Infinity, b = -Infinity; for (const f of d.faces) for (const p of f.corners) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); }
    for (const f of d.faces) faces.push({ ...f, corners: f.corners.map((p) => [p[0] - a + x, p[1], p[2]]) });
    x += b - a + gap;
  }
  return drawFlora({ faces, dials: { form: 'run', variant: '' } }, kitId, { w, h });
}

const INC_SET = [['broccoli', 'broccoli', 'near'], ['broccoli', 'pads', 'near'], ['broccoli', 'column', 'near'], ['mushroom', 'parasol', 'near'], ['fingers', 'saguaro', 'near'], ['fingers', 'pads', 'near'], ['fingers', 'coral', 'near'], ['fungi', 'bracket', 'near']];
function incongruityCard(kitId, seed) {
  const dials = [['base', null], ['vertical', { vertical: 1 }], ['horizontal', { horizontal: 1 }], ['both', { vertical: 1, horizontal: 1 }]];
  const rows = INC_SET.map(([f, v, lv]) => `<tr><td><b>${esc(f)}</b><br>${esc(v)}</td>${dials.map(([, inc]) => { const d = designFlora(f, v, seed, { level: lv, incongruity: inc, interest: 'focus' }); const I = d.incongruity; const note = !I ? '' : I.dropped ? 'dropped: under the eye spot' : `leads ${esc([I.leads.vertical, ...I.leads.horizontal].filter(Boolean).join(', '))} · fit ${I.fit.join('/')}`; return `<td>${drawFlora(d, kitId, { w: 120, h: 120 })}<div class="note">${note} ${lawLine(d)}</div></td>`; }).join('')}</tr>`).join('');
  const interest = Object.keys(INCONGRUITY_GAIN).map((k) => fig(drawFlora(designFlora('broccoli', 'pads', seed + 1, { level: 'near', incongruity: { vertical: 1, horizontal: 1 }, interest: k }), kitId, { w: 130, h: 130 }), `${esc(k)} × ${INCONGRUITY_GAIN[k]}`)).join('');
  const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => fig(drawFlora(designFlora('fingers', 'saguaro', seed + 2, { level: 'near', incongruity: { vertical: t, horizontal: t }, interest: 'focus' }), kitId, { w: 110, h: 140 }), `dial ${t}`)).join('');
  return `<div class="card"><h3>Incongruity <span class="badge">the distortion pass, as juxtaposition</span></h3>
<p class="note">Adjacent mismatch is interesting: the era's accent wall breaks a repeat, a run draws the eye. Incongruity is that, inside a thing. A doodad is a plan of base composition blocks (masses, caps, pads, knuckles, shelves); the pass mismatches them and then makes them stand. VERTICAL: along a stack each block answers the one under it out of step (big over small, a pinched sausage link) and one joint jogs off the line. HORIZONTAL: side by side, sizes alternate round the run, heights go jagged, one stands out. Held by the sixth-gen object principles: <b>one leads</b> (one joint and one sibling carry it, the rest answer quietly: the 33 of incongruity); <b>the 66 keeps the lead</b> (the leading shape never shrinks; an odd one out that is not it shrinks); <b>inverse interest</b> (filler quiet, a focus loud); <b>the eye spot</b> (the leading mismatch must move ${esc(String(Math.round(1000 * 12 * (2 * 4 * Math.tan(Math.PI / 6)) / 448) / 1000))} m, 12 frame px at 4 m, or it is noise and dropped); <b>stable</b> (each stack's weight brought back over what holds it, the whole over its foot, then the doodad fitted back into the bounds it had: its footprint never changes).</p>
<table><tr><th></th>${dials.map(([n]) => `<th>${esc(n)}</th>`).join('')}</tr>${rows}</table>
<div class="grid g2" style="margin-top:10px"><div><p class="note">INTEREST: the same dials (1, 1) scaled by how much the thing matters</p><div class="views">${interest}</div></div>
<div><p class="note">THE DIAL: vertical and horizontal together, 0 to 1</p><div class="views">${steps}</div></div></div></div>`;
}

function runCard(kitId, seed) {
  // toadstools too small for their own mismatch to read: their incongruity comes from their neighbours
  const pts = (inc) => floraScatter([{ id: 'toadstool', clusters: 1, perCluster: 7, spread: 1.6, size: 0.3, density: { near: 1, mid: 1, far: 1 } }], seed + 5, { w: 40, d: 60, clear: -40, rings: { near: 99, mid: 99 }, incongruity: inc }).sort((a, b) => a.x - b.x);
  const run = (inc) => pts(inc).map((p, i) => ({ d: designFlora('mushroom', 'toadstool', seed + i, { level: 'near', over: { height: 0.4 * p.scale * p.stretch, cluster: 1 } }), gap: 0.12 }));
  const plain = drawRun(run(null), kitId, { w: 520, h: 120 }), mixed = drawRun(run({ vertical: 1, horizontal: 1 }), kitId, { w: 520, h: 120 });
  const J = JUNGLE_COMPOSITION, w = 40, dd = 60, px = 5;
  const P = floraScatter(J.plan, seed, { w, d: dd, rings: J.rings, incongruity: { vertical: 1, horizontal: 1 } });
  const shade = (g) => (g >= 1 ? '#111' : g > 0 ? '#888' : '#ccc');
  const plan = `<svg viewBox="0 0 ${w * px} ${dd * px}" width="${w * px}" height="${dd * px}"><rect width="${w * px}" height="${dd * px}" fill="#fff" stroke="#111"/><rect x="${(w / 2 - 1) * px}" y="0" width="${2 * px}" height="${dd * px}" fill="#eee"/>${P.map((p) => `<circle cx="${((p.x + w / 2) * px).toFixed(1)}" cy="${((dd - p.y) * px).toFixed(1)}" r="${(p.size * p.scale * px * 0.5).toFixed(1)}" fill="${shade(p.gain)}"${p.odd ? ' stroke="#111" stroke-width="2" fill-opacity="0.35"' : ''}/>`).join('')}</svg>`;
  return `<div class="card"><h3>Incongruity at the composition's scale</h3><p class="note">Under the eye spot a doodad's own mismatch is noise, so it moves up a level: the members of a cluster answer each other the way blocks do inside a doodad (sizes alternate, one stands out; heights alternate, tall beside short). The EYE RADIUS gates it: distinct inside the radius, repetition outside it (gain ${esc(Object.entries(RING_GAIN).map(([k, v]) => `${k} ${v}`).join(', '))}); each point also carries the dials its own doodad is built with.</p>
<div class="grid g2"><div><p class="note">A RUN OF TOADSTOOLS: plain, then answered by their neighbours (1, 1)</p>${plain}${mixed}</div><div><p class="note">THE JUNGLE'S PLAN with the dials at (1, 1): black full gain (near), grey half (mid), pale none (far); ringed, the odd one of each cluster</p>${plan}</div></div></div>`;
}

function lawsCard(seeds = 40) {
  const rows = FLORA_LAWS.map((l) => {
    let n = 0, bad = 0;
    for (const id of FLORA_FORM_IDS) for (const v of Object.keys(FLORA_FORMS[id].variants)) for (const lv of ['near', 'mid', 'far']) for (let s = 1; s <= seeds; s++) for (const inc of [null, { vertical: 1, horizontal: 1 }]) { n++; if (floraLaws(designFlora(id, v, s, { level: lv, incongruity: inc, interest: 'focus' })).some((x) => x.law === l.id)) bad++; }
    return `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.rule)}</td><td class="${bad ? 'no' : 'ok'}">${bad ? `${bad} of ${n} advise` : `holds on ${n}`}</td></tr>`;
  }).join('');
  return `<div class="card"><h3>Read laws</h3><p class="note">A doodad answers to how it reads and what it costs, never to botany. Measured over every form, variant and ring at ${seeds} seeds, plain and with incongruity at full (a focus).</p><table>${rows}</table>
<p class="note" style="margin-top:8px">PARTS: ${Object.entries(FLORA_PARTS).map(([k, p]) => `<b>${esc(k)}</b> (${esc(p.role)}) ${esc(p.read)}`).join(' · ')}</p></div>`;
}

export function outFloraHtml({ seed = 8, kitId = 'isekai-meadow' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outdoor Flora Index</title><style>${CSS}.views svg{border:1px solid var(--line)}</style></head><body><div id="page">
<h1>OUTDOOR FLORA INDEX</h1>
<p class="lede">The plants of an outdoor world as doodads: shapes built for look, read and cost, not botany. Four forms make every plant a kit needs: masses on a stick, a cap on a stalk, organic growth, sausage fingers. Each is a few primitives under a few dials, built in values on named parts, skinned by a kit's swatches and built by reveal ring. Drawn here in ${esc(kitId)} at seed ${seed}. The grown trees (vegetation/) stay for a world that wants one.</p>
<h2>Forms</h2>${FLORA_FORM_IDS.map((id) => formCard(id, kitId, seed)).join('<div style="height:14px"></div>')}
<h2>Incongruity</h2>${incongruityCard(kitId, seed)}${runCard(kitId, seed)}
<h2>Density</h2>${densityCard(kitId, seed)}
<h2>Skins</h2>${skinCard(seed)}
<h2>Bark</h2>${barkCard(kitId, seed)}
<h2>Grass</h2>${grassCard()}
<h2>Composition</h2>${jungleCard(kitId, seed)}
<h2>Laws</h2>${lawsCard()}
</div></body></html>`;
}
