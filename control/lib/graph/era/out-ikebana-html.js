/**
 * IKEBANA, drawn — the cards the flora index shows for the bundling aid (era/out-ikebana.js): the roles, the styles'
 * angles, arrangements clustersprouted in three kits (elevation and plan), and the zone painter's strokes. Pure.
 */
import { IKEBANA_ROLES, IKEBANA_STYLES, IKEBANA_DIALS, IKEBANA_LAWS, IKEBANA_DEFAULTS, WALK, clustersprout, ikebanaZone, crownXY } from './out-ikebana.js';
import { floraMeasures } from './out-flora.js';
import { drawFlora, fig } from './out-flora-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (Math.round(v * 100) / 100).toString();
const D = Math.PI / 180;

// every stem of an arrangement (or several) in one elevation, seen from the viewer (from −y)
// `turn` (radians) turns the scene about the vertical first, so a viewer can stand anywhere: the scene is seen from −y
function drawArrangements(As, kitId, opts = {}) {
  const faces = [], c = Math.cos(opts.turn ?? 0), sn = Math.sin(opts.turn ?? 0), T = (p) => [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
  for (const A of As) for (const s of [...(A.ground ? [A.ground] : []), ...A.stems, ...(A.cover ?? [])]) for (const f of s.design.faces) faces.push({ ...f, corners: f.corners.map((p) => T([p[0] + s.x, p[1] + s.y, p[2] + (s.z ?? 0)])), normal: T(f.normal) });
  return drawFlora({ faces, dials: { form: 'arrangement', variant: '' } }, kitId, opts);
}

// an arrangement in plan: the kenzan, the ma toward the viewer, each stem's foot and crown, the principals' triangle
function planSvg(A, { size = 200 } = {}) {
  const pts = A.stems.flatMap((s) => [[s.x, s.y], crownXY(s)]), R = Math.max(A.kenzan * 3, ...pts.map((p) => Math.hypot(p[0] - A.at[0], p[1] - A.at[1]))) * 1.15;
  const k = size / 2 / R, X = (p) => (size / 2 + (p[0] - A.at[0]) * k).toFixed(1), Y = (p) => (size / 2 - (p[1] - A.at[1]) * k).toFixed(1);
  const ma = (a) => [A.at[0] + Math.cos(A.facing + a) * R, A.at[1] + Math.sin(A.facing + a) * R];
  const tri = ['shin', 'soe', 'hikae'].map((r) => crownXY(A.stems.find((s) => s.role === r)));
  const dot = { shin: 7, soe: 6, hikae: 5, jushi: 3, ne: 4 };
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#fff"/>
<path d="M${X(A.at)},${Y(A.at)} L${X(ma(-A.ma * D))},${Y(ma(-A.ma * D))} L${X(ma(A.ma * D))},${Y(ma(A.ma * D))} Z" fill="#eee"/>
<circle cx="${X(A.at)}" cy="${Y(A.at)}" r="${(A.kenzan * k).toFixed(1)}" fill="none" stroke="#111" stroke-dasharray="2 2"/>
<polygon points="${tri.map((p) => `${X(p)},${Y(p)}`).join(' ')}" fill="none" stroke="#111" stroke-width="1.2"/>
${A.stems.map((s) => { const c = crownXY(s); return `<line x1="${X([s.x, s.y])}" y1="${Y([s.x, s.y])}" x2="${X(c)}" y2="${Y(c)}" stroke="#999"/><circle cx="${X(c)}" cy="${Y(c)}" r="${dot[s.role]}" fill="${s.role === 'jushi' ? '#999' : s.role === 'ne' ? '#fff' : '#111'}" stroke="#111"/>`; }).join('')}
<text x="${size / 2}" y="${size - 6}" text-anchor="middle" font-size="9" fill="#555">the viewer ↓ (ma shaded)</text></svg>`;
}

// the styles' angles: each principal's lean in elevation, as a vase arranger draws it
function stylesSvg() {
  const W = 150, H = 120;
  return Object.entries(IKEBANA_STYLES).map(([id, S]) => {
    const base = [W / 2, H - 14], L = { shin: 96, soe: 72, hikae: 54 };
    const lines = ['shin', 'soe', 'hikae'].map((r) => { const t = S.lean[r] * D, side = Math.sin(S.toward[r] * D) >= 0 ? -1 : 1; return `<line x1="${base[0]}" y1="${base[1]}" x2="${(base[0] + side * Math.sin(t) * L[r]).toFixed(1)}" y2="${(base[1] - Math.cos(t) * L[r]).toFixed(1)}" stroke="#111" stroke-width="${r === 'shin' ? 3 : r === 'soe' ? 2 : 1.4}" stroke-linecap="round"/>`; }).join('');
    return fig(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><line x1="10" x2="${W - 10}" y1="${H - 14}" y2="${H - 14}" stroke="#bbb"/>${lines}</svg>`, `<b>${esc(id)}</b> · shin ${S.lean.shin}° soe ${S.lean.soe}° hikae ${S.lean.hikae}°<br><span style="text-transform:none">${esc(S.read)}</span>`);
  }).join('');
}

const lawCell = (A) => (A.laws.length ? `<span class="badge solid">${esc([...new Set(A.laws.map((l) => l.law))].join(', '))}</span>` : '<span class="badge">laws hold</span>');

export function ikebanaCard(seed) {
  const roles = Object.entries(IKEBANA_ROLES).map(([r, R]) => `<tr><td><b>${esc(r)}</b></td><td>${R.height[0] === R.height[1] ? n2(R.height[0]) : `${n2(R.height[0])}–${n2(R.height[1])}`} × shin</td><td>${esc(R.interest)}</td><td>${esc(R.read)}</td></tr>`).join('');
  const shows = [['grove', 'isekai-meadow', 9, 'upright'], ['fungal', 'alien-night', 5, 'slanting'], ['reef', 'isekai-sakura', 2.4, 'spreading']].map(([m, kit, scale, style]) => {
    const A = clustersprout(seed, { materials: m, scale, style, density: 0.6, variation: 0.6 });
    const H = Math.max(...A.stems.map((s) => floraMeasures(s.design).height));
    return `<tr><td><b>${esc(m)}</b><br><span class="note">${esc(kit)} · ${esc(style)} · ${A.stems.length} stems · shin ${n2(H)} m</span><br>${lawCell(A)}</td><td>${drawArrangements([A], kit, { w: 340, h: 220 })}</td><td>${planSvg(A, { size: 200 })}</td></tr>`;
  }).join('');
  return `<div class="card"><h3>Ikebana: clustersprout <span class="badge">a bundling aid</span></h3>
<p class="note">A cluster is arranged, not scattered. <code>clustersprout</code> grows one arrangement from a single root (the kenzan): three principals in scalene steps (shin, soe at three quarters, hikae at three quarters of soe), each leaning its style's angle toward its own side as far as it still stands; an odd count of fillers inside their triangle; a flowering root at the foot; and the <b>ma</b>, a sector toward the viewer left open so the eye can enter. Every stem is a flora doodad, its height pinned to its share, its own incongruity scaled by its role's interest (shin a focus, fillers filler). The scalene steps are a mismatch built in, one leading: the arrangement is incongruity at the cluster's scale, given a form.</p>
<div class="grid g2"><div><table><tr><th>role</th><th>height</th><th>interest</th><th>reads</th></tr>${roles}</table></div><div><p class="note">STYLES: each principal's lean from upright (a vase's angles; a zone's <code>bend</code> takes a share of them)</p><div class="views">${stylesSvg()}</div></div></div>
<table style="margin-top:10px"><tr><th>materials</th><th>elevation (from the viewer)</th><th>plan: crowns, the principals' triangle, the kenzan, the ma</th></tr>${shows}</table>
<p class="note" style="margin-top:6px">LAWS: ${IKEBANA_LAWS.map((l) => `<b>${esc(l.id)}</b> ${esc(l.rule)}`).join(' · ')}</p></div>`;
}

export function zoneCard(seed, kitId = 'isekai-meadow') {
  // two strokes painted along the banks of a trail running up y at x = 0; every arrangement turns to the trail
  const zone = { materials: 'grove', style: 'upright', scale: 8, density: 0.7, variation: 0.6, bend: 0.35, strokes: [{ points: [[-9, 4], [-11, 22], [-8, 40]], width: 3 }, { points: [[10, 14], [12, 34]], width: 3 }], faceTo: [[0, 0], [0, 48]] };
  const As = ikebanaZone(zone, seed).arrangements;
  const W = 30, Dd = 48, px = 6, X = (x) => ((x + W / 2) * px).toFixed(1), Y = (y) => ((Dd - y) * px).toFixed(1);
  const plan = `<svg viewBox="0 0 ${W * px} ${Dd * px}" width="${W * px}" height="${Dd * px}"><rect width="${W * px}" height="${Dd * px}" fill="#fff" stroke="#111"/><rect x="${X(-1)}" y="0" width="${2 * px}" height="${Dd * px}" fill="#eee"/>
${zone.strokes.map((st) => `<polyline points="${st.points.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#ddd" stroke-width="${st.width * px}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${As.map((A) => A.stems.map((s) => { const c = crownXY(s); return `<circle cx="${X(c[0])}" cy="${Y(c[1])}" r="${s.role === 'jushi' ? 2 : s.role === 'ne' ? 2.5 : 4}" fill="${A.hand === 'left' ? '#111' : '#888'}"/>`; }).join('') + (A.odd ? `<circle cx="${X(A.at[0])}" cy="${Y(A.at[1])}" r="${(A.kenzan * px + 9).toFixed(1)}" fill="none" stroke="#111" stroke-width="1.5"/>` : '')).join('')}</svg>`;
  const left = As.filter((A) => A.stroke === 0);
  const rows = Object.entries(IKEBANA_DIALS).map(([k, d]) => `<tr><td><code>${esc(k)}</code></td><td>${n2(d.rail[0])}–${n2(d.rail[1])}</td><td>${esc(String(zone[k] ?? IKEBANA_DEFAULTS[k]))}</td><td>${esc(d.read)}</td></tr>`).join('');
  return `<div class="card"><h3>The ikebana zone painter</h3><p class="note">Paint strokes; arrangements sprout along them, a spacing apart (closer with density), jittered across the stroke's width, each turned to its view (here the trail). Neighbours alternate hands, so the run answers itself; one arrangement in each stroke is the odd one out (bigger, in another style). A grove painted this way is close and varied, with a bush in flower at the foot of each arrangement.</p>
<div class="grid g2"><div><table><tr><th>dial</th><th>rail</th><th>here</th><th>reads</th></tr>${rows}</table><p class="note" style="margin-top:8px">THE LEFT BANK'S STROKE, seen from the trail (${left.length} arrangements, ${left.reduce((n, A) => n + A.stems.length, 0)} stems; ${esc(left.map((A) => A.laws.length ? 'advice' : 'holds').join(' · '))})</p>${drawArrangements(left, kitId, { w: 560, h: 200, turn: -Math.PI / 2 })}</div>
<div><p class="note">PLAN: strokes (pale), crowns by hand (black left, grey right), the odd one ringed; the trail grey</p>${plan}</div></div></div>`;
}

// an arrangement's colliders in plan: block solid, under dashed, walk pale, wade hatched; the way in down the ma
function walkPlan(A, { size = 220 } = {}) {
  const C = A.colliders, R = Math.max(...C.map((c) => Math.hypot(c.x - A.at[0], c.y - A.at[1]) + c.r)) * 1.08;
  const k = size / 2 / R, X = (x) => (size / 2 + (x - A.at[0]) * k).toFixed(1), Y = (y) => (size / 2 - (y - A.at[1]) * k).toFixed(1);
  const ma = (a) => [A.at[0] + Math.cos(A.facing + a) * R, A.at[1] + Math.sin(A.facing + a) * R];
  const style = { block: 'fill="#111" fill-opacity="0.75"', under: 'fill="none" stroke="#111" stroke-dasharray="3 3"', walk: 'fill="#ddd" fill-opacity="0.6"', wade: 'fill="url(#hatch)" stroke="#888"' };
  const order = { walk: 0, wade: 1, under: 2, block: 3 };
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#888" stroke-width="1.2"/></pattern></defs><rect width="${size}" height="${size}" fill="#fff"/>
${A.walk === 'open' ? `<path d="M${X(A.at[0])},${Y(A.at[1])} L${X(ma(-A.ma * D / 2)[0])},${Y(ma(-A.ma * D / 2)[1])} L${X(ma(A.ma * D / 2)[0])},${Y(ma(A.ma * D / 2)[1])} Z" fill="#f4f4f4" stroke="#bbb" stroke-dasharray="2 3"/>` : ''}
${[...C].sort((a, b) => order[a.kind] - order[b.kind]).map((c) => `<circle cx="${X(c.x)}" cy="${Y(c.y)}" r="${Math.max(1.5, c.r * k).toFixed(1)}" ${style[c.kind]}/>`).join('')}
<text x="${size / 2}" y="${size - 5}" text-anchor="middle" font-size="9" fill="#555">the viewer ↓</text></svg>`;
}

const tally = (A) => Object.entries(A.colliders.reduce((m, c) => ((m[c.kind] = (m[c.kind] ?? 0) + 1), m), {})).map(([k, n]) => `${n} ${k}`).join(' · ');

export function wideCard(seed) {
  const rows = [['garden', 'isekai-meadow', 4.5, 'upright'], ['oasis', 'isekai-bamboo', 5, 'spreading'], ['crater', 'alien-night', 5, 'slanting']].map(([m, kit, scale, style]) => {
    const A = clustersprout(seed, { materials: m, scale, style, density: 0.8, variation: 0.6, cover: 0.7 });
    const forms = [...new Set(A.stems.map((s) => `${s.form} ${s.variant}`))];
    return `<tr><td><b>${esc(m)}</b><br><span class="note">${esc(kit)} · ${esc(style)} · on a ${esc(A.ground.variant)} (slope ${A.surface.maxSlope}°${A.surface.pool ? `, a pool ${n2(A.surface.pool)} m` : ''}) · ${A.stems.length} stems, ${A.cover.length} tufts</span><br><span class="note">mixes ${forms.length}: ${esc(forms.join(', '))}</span><br><span class="note">${esc(tally(A))}</span><br>${lawCell(A)}</td><td>${drawArrangements([A], kit, { w: 360, h: 210 })}</td><td>${walkPlan(A)}</td></tr>`;
  }).join('');
  const O = clustersprout(seed + 1, { materials: 'garden', scale: 4.5, density: 1, walk: 'open' }), T = clustersprout(seed + 1, { materials: 'garden', scale: 4.5, density: 1, walk: 'thicket' });
  return `<div class="card"><h3>Wide ikebana: mixed media on its own ground</h3><p class="note">An arrangement is not one thing repeated: its fillers cycle through their list (never the same twice running) and a wide arrangement mixes flora with the terrain it is made of: stones (a boulder, a cairn of stacked courses, a standing slab, an outcrop), a ground of its own (a mound whose crown is the root; a hollow whose pool lies in front, in the ma) and ground cover (tufts, plain or in flower). Every element is a doodad under the same laws, set on the ground's surface.</p>
<p class="note"><b>Walking</b>, decided from what was built: <b>block</b> is what a walker meets at body height (${WALK.body} m): a trunk, a stalk, a stone or bush over a step (${WALK.step} m), any cactus, a mound steeper than ${WALK.climb}°; <b>walk</b> is stepped through (tufts, flowers, anything under a step); <b>under</b> is a canopy over head height (${WALK.head} m); <b>wade</b> is a pool no deeper than ${WALK.wade} m. <code>walk: 'open'</code> keeps a way in down the ma (a blocking stem that crowds it turns away from the front); <code>walk: 'thicket'</code> makes every filler block, a wall of brush. Painted along a trail, nothing that blocks stands within the clearance (${IKEBANA_DEFAULTS.clear} m): an arrangement that would is moved back whole.</p>
<table><tr><th>materials</th><th>elevation</th><th>plan: block (solid), under (dashed), walk (pale), wade (hatched), the way in</th></tr>${rows}</table>
<div class="grid g2" style="margin-top:10px"><div><p class="note">OPEN: ${esc(tally(O))}</p>${walkPlan(O, { size: 240 })}</div><div><p class="note">THICKET, the same seed: ${esc(tally(T))}</p>${walkPlan(T, { size: 240 })}</div></div></div>`;
}
