/**
 * THE CASTLE, drawn — the scapeshift sheet for the lord's land drawn tight: the budget (where the fortified town spent
 * its surface, and where the castle spends it), the keep by depth in each composition, a castle from above, standing
 * and from the town below, with its laws; the other composition; one ward; a seeded one; and the town outside the
 * castle. Data: era/out-castle.js, era/out-fortress.js, era/out-town.js. `outCastleHtml(opts)` is pure.
 */
import { structureStyle } from './out-structures.js';
import { drawStructures, fig, SUN } from './out-structures-draw.js';
import { designTown, TOWN_LAWS, fortFaces } from './out-town.js';
import { structurePaint, paintStop } from './out-structures-paint.js';
import { townMapSvg, townAxonSvg, resetTownIds, castleGroundSvg, fillT, mapDefs } from './out-town-html.js';
import { CASTLE_CARD, CASTLE_LAWS, designCastle, castleFaces, castleSurface } from './out-castle.js';
import { composeFort, seedFort, build as FB } from './out-fortress.js';
import { hexOfRgb } from './style/swatches.js';
import { CSS } from './out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (v) => `${Math.round(v * 100)} %`;
const tint = (paint, group, v) => { if (!paint) { const g = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; } return hexOfRgb(paintStop(paint, group, v)); };
const area3 = (c) => { let x = 0, y = 0, z = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; x += p[1] * q[2] - p[2] * q[1]; y += p[2] * q[0] - p[0] * q[2]; z += p[0] * q[1] - p[1] * q[0]; } return Math.hypot(x, y, z) / 2; };
const lawRows = (laws) => laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</td><td>${esc(l.value)}</td><td class="note">${esc(l.want ?? '')}</td></tr>`).join('');

/** A ward's ground: the share built over a rectangle, and its largest open square, at a metre. */
function wardOf([x0, y0, x1, y1], foots) {
  const nx = Math.round(x1 - x0), ny = Math.round(y1 - y0), cells = new Uint8Array(nx * ny), sq = new Uint16Array(nx * ny);
  const inside = (q, x, y) => { let s = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  let span = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i + 0.5, y = y0 + j + 0.5, k = j * nx + i; if (foots.some((q) => inside(q, x, y))) { cells[k] = 1; continue; } sq[k] = i && j ? 1 + Math.min(sq[k - 1], sq[k - nx], sq[k - nx - 1]) : 1; span = Math.max(span, sq[k]); }
  return { area: Math.round((x1 - x0) * (y1 - y0)), built: cells.reduce((s, v) => s + v, 0) / (nx * ny), span };
}
const footOf = (l) => { const { o, ex, ey } = l.place, W0 = l.design.dims.W0, D0 = l.design.dims.D0, p = (u, v) => [o[0] + ex[0] * u + ey[0] * v, o[1] + ex[1] * u + ey[1] * v]; return [p(0, 0), p(W0, 0), p(W0, D0), p(0, D0)]; };

/** Where the surface goes: the fortified town's inmost ward against the castle's inner ward. */
function budgetCard(style, paint, seed) {
  const town = designTown(style, seed, { fortified: 1, fort: 'crenellated', anchor: 'timber-hall' }), F = town.fort, top = town.terraces[town.terraces.length - 1];
  const inmost = town.lots.filter((l) => !l.farm && l.z >= top.z1 - 1e-6), keepL = town.lots[F.keep], wardR = [F.xW + F.t / 2, top.y + 0.5, F.xE - F.t / 2, F.yN - F.t / 2];
  const tw = wardOf(wardR, inmost.map(footOf)), walls = fortFaces(town, { most: 1 }).groups.reduce((s, g) => s + g.reduce((a, f) => a + area3(f.corners), 0), 0), inside = inmost.reduce((s, l) => s + l.design.faces.reduce((a, f) => a + area3(f.corners), 0), 0);
  const c = designCastle(style, seed, { fort: 'crenellated', anchor: 'timber-hall' }), S = castleSurface(c), B = c.budget.inner;
  const curtainLen = (cs) => Math.round(cs.reduce((s, k) => s + Math.hypot(k.pts[1][0] - k.pts[0][0], k.pts[1][1] - k.pts[0][1]), 0));
  const rows = [
    ['the curtain', `${curtainLen(F.curtains)} m, ${F.towers.length} towers`, `${curtainLen(c.curtains)} m, ${c.towers.length} towers`],
    ['the lord\'s ward', `${tw.area} m² (about)`, `${Math.round(B.area)} m²`],
    ['built on it', `${pct(tw.built)} (${inmost.length} lots)`, `${pct(B.built)} (${B.ranges} ranges and the keep)`],
    ['its largest open square', `${tw.span} m`, `${B.span} m`],
    ['the keep', `${keepL.design.dims.W0} m across, ${(100 * keepL.design.dims.W0 ** 2 / tw.area).toFixed(1)} % of its ward`, `${c.keep.K} m across, ${pct((c.keep.K * c.keep.K) / B.area)} of its ward`],
    ['surface inside (the lord\'s ward) : the walls\'', `${Math.round(inside)} : ${Math.round(walls)} m² (${pct(inside / (inside + walls))})`, `${S.inside} : ${S.walls} m² (${pct(S.inside / (S.inside + S.walls))})`],
  ];
  return `<div class="card"><h3>Where the surface goes <span class="badge solid">the budget</span></h3><p class="note">The fortified town spent its surface on its walls: a curtain the length of the town round a lord's ward the breadth of the town, a keep on a lot in it. The castle takes the town's walls off and spends them on the lord's land: the keep first, a third of the ward's breadth on its back corner; ranges backed onto every curtain, wall to wall; the court what is left, a cart's turn and no field. Both at seed ${seed}, crenellated over the timber-framed language, each at depth 1.</p>
<table><tr><th></th><th>the fortified town</th><th>the castle</th></tr>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table></div>`;
}

/** The keep by depth, in a composition. */
function keepCard(F, title, paint) {
  const K = 16, H = 20, views = [0, 1, 2].map((d) => { const o = []; FB.keep(o, F, K, H, { depth: d, base: F.curtain.base === 'battered' ? 5 : 1.5 }); return fig(drawStructures([o], { view: 'axon', paint, w: 230, h: 260, ppm: 7 }), `depth ${d} · ${o.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0)} tris`); }).join('');
  const read = F.tower.crown === 'tiers' ? 'a battered stone base over the platform, storeys stepping in, each under its skirt of eaves, gables out of the skirts, a hipped roof over the last' : F.tower.plan === 'round' ? 'a drum, crenels round a cone, a stair turret beside it' : `a great tower, pilastered, its parapet broken by corner turrets ${F.tower.crown === 'crenel' ? 'crenellated' : 'capped'} over it${F.tower.crown === 'crenel' ? '' : ', a roof inside'}, a forebuilding on the court side holding its stair`;
  return `<div class="card"><h3>${esc(title)} <span class="badge">the keep, derived from the tower</span></h3><p class="note">The tower's plan and crown at the keep's scale: ${esc(read)}. ${K} m across, ${H} m to its ${F.tower.crown === 'tiers' ? 'top storey\'s eaves' : 'parapet'}.</p><div class="views">${views}</div></div>`;
}

/** A castle in plan, at `px` a metre: its ditch and floor, its shadows, its walls and buildings from above, labelled. */
function castleMapSvg(c, paint, opts = {}) { return mapDefs((defs) => castleMap(c, paint, opts, defs)); }
function castleMap(c, paint, { px = 5, labels = true } = {}, defs = null) {
  const m = c.ditch.d1 + 6, B = { x0: c.extent.x0 - m, x1: c.extent.x1 + m, y0: c.extent.y0 - m - 6, y1: c.extent.y1 + m }, W = Math.round((B.x1 - B.x0) * px), H = Math.round((B.y1 - B.y0) * px);
  const X = (x) => ((x - B.x0) * px).toFixed(1), Y = (y) => ((B.y1 - y) * px).toFixed(1), poly = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  const F = castleFaces(c, { most: 1 }), shade = [], k = -SUN[2], sx = (0.55 * SUN[0]) / k, sy = (0.55 * SUN[1]) / k;
  for (const g of F.groups) { const z0 = Math.min(...g.flatMap((f) => f.corners.map((p) => p[2]))); for (const f of g) if (!f.tile) shade.push(`<polygon points="${f.corners.map((p) => `${X(p[0] + sx * (p[2] - z0))},${Y(p[1] + sy * (p[2] - z0))}`).join(' ')}"/>`); }
  const under = `<rect width="${W}" height="${H}" fill="${fillT(paint, 'town:grass', 0.45)}"/>${castleGroundSvg(c, poly, paint).join('')}<g fill="${tint(paint, 'town:grass', 0)}" opacity="0.2">${shade.join('')}</g>`;
  const lab = [], tag = (x, y, t) => lab.push(`<text x="${X(x)}" y="${Y(y)}" text-anchor="middle" font-size="12" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(t)}</text>`);
  if (labels) {
    const mg = c.gates.find((g) => g.main);
    tag(mg.at[0], mg.at[1] - c.ditch.d1 - 3, 'the gate ↑'); tag(c.keep.at[0], c.keep.at[1] + c.keep.K / 2 + 3, 'the keep');
    tag(c.marks.court[0], c.marks.court[1], 'the court'); if (c.marks.fore) tag(c.marks.fore[0], c.marks.fore[1], 'forecourt');
    for (const l of c.lots.filter((x) => x.use === 'hall')) tag(l.front[0], l.front[1] + (l.island ? 0 : -1.5), l.island ? 'the chapel' : 'the hall');
  }
  return drawStructures(F.groups, { view: 'plan', paint, w: W, h: H, ppm: px, at: [-B.x0 * px, B.y1 * px], under, over: lab.join(''), defs });
}
/** A castle standing (axonometric), on its ground. */
function castleAxonSvg(c, paint, { w = 900, h = 620, most = 1 } = {}) {
  const F = castleFaces(c, { most }), m = c.ditch.d1 + 4, q = (pts) => ({ corners: pts, normal: [0, 0, 1], part: 'ground', group: 'town:grass', value: 0.3 });
  const ground = q([[c.extent.x0 - m, c.extent.y0 - m, c.z], [c.extent.x1 + m, c.extent.y0 - m, c.z], [c.extent.x1 + m, c.extent.y1 + m, c.z], [c.extent.x0 - m, c.extent.y1 + m, c.z]]);
  return drawStructures(F.groups, { view: 'axon', paint, w, h, pad: 14, floor: [ground, ...F.floor] });
}
/** A castle from the south, where the town below comes up to it. */
function castleFrontSvg(c, paint, groups = null) {
  const span = c.extent.x1 - c.extent.x0 + 30, ppm = Math.min(8, 1000 / span), sky = c.keep.top - c.z + 12, hh = Math.round(sky * ppm + 24);
  return drawStructures(groups ?? castleFaces(c, { most: 1 }).groups, { view: 'front', paint, w: Math.round(span * ppm), h: hh, ppm, at: [Math.round(-(c.extent.x0 - 15) * ppm), hh - 12 + c.z * ppm] });
}

/** A castle: plan, standing, from the south, its laws. */
function castleCard(style, paint, seed, rec, title) {
  const c = designCastle(style, seed, rec), B = c.budget, uses = {};
  for (const l of c.lots) uses[l.use] = (uses[l.use] ?? 0) + 1;
  return `<div class="card"><h3>${esc(title)} <span class="badge solid">${c.wards === 2 ? 'two wards' : 'one ward'} · ${c.W} m</span></h3><p class="note">${esc(c.set.read)}. The ranges speak ${esc(c.language)}; the style's influence: ${esc(c.influence.read.join('; '))}. The inner ward ${c.W} × ${Math.round(c.D)} m on a ${c.rise} m platform, its walls ${c.Hin} m over it${c.wards === 2 ? `; a forecourt ${Math.round(c.Df)} m deep before it, its walls ${c.Hout} m, its gate on the other hand from the inner gate` : ''}. The keep ${Math.round(c.keep.K)} m across, ${Math.round(c.keep.top - c.z)} m high; ${c.towers.length} towers; ${c.lots.length} ranges (${esc(Object.entries(uses).map(([u, n]) => `${n} ${u === 'hall' ? 'hall' : u}${n > 1 && u !== 'hall' ? 's' : ''}`).join(', '))}), backed onto the curtains; the court ${B.inner.span} m at its widest open square. North is up; the gate faces south, down to the town.</p>
<div style="overflow-x:auto">${castleMapSvg(c, paint)}</div>
<div class="views" style="margin-top:6px">${fig(castleAxonSvg(c, paint), 'standing')}</div>
<div class="views" style="margin-top:6px">${fig(castleFrontSvg(c, paint), 'from the south, where the town comes up to it: the gate, the ranges\' roofs over the curtain, the keep over all')}</div>
<h3 style="margin-top:10px">The castle's laws <span class="badge">machine gate</span></h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${lawRows(c.laws)}</table></div>`;
}

/** The town outside the castle: the castle on its highest ground, the branch its approach. */
function outsideCard(style, paint, seed, rec, title) {
  const t = designTown(style, seed, rec), c = t.castle, bad = t.laws.filter((l) => !l.ok).length;
  const own = ['outside', ...CASTLE_LAWS.map((l) => l.id)], rest = t.laws.filter((l) => !own.includes(l.law));
  return `<div class="card"><h3>${esc(title)} <span class="badge solid">castle ${esc(JSON.stringify(rec.castle))}</span></h3><p class="note">The town is laid out as ever, routes first; the castle stands past the branch's end on the highest ground (+${c.z} m), its gate facing back down the branch, the branch brought to its bridge. The town's landmark is the keep. ${t.lots.length - c.lots.length} lots of the town outside, ${c.lots.length} ranges inside; ${bad ? `${bad} laws advise` : 'every law holds'}.</p>
<div style="overflow-x:auto">${townMapSvg(t, paint, null, { px: 3.4 })}</div>
<div class="views" style="margin-top:6px">${fig(townAxonSvg(t, paint, null, { w: 1100, h: 700 }), 'standing: the town below, the castle over it')}</div>
<h3 style="margin-top:10px">Outside the castle <span class="badge">machine gate</span></h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${lawRows(t.laws.filter((l) => own.includes(l.law)))}</table>
<p class="note">The town's own laws: ${rest.map((l) => `${esc(l.law)} <b class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</b>`).join(' · ')}</p></div>`;
}

/** The whole sheet as one HTML page. */
export function outCastleHtml({ seed = 8, kitId = 'isekai-meadow' } = {}) {
  resetTownIds();
  const style = structureStyle(kitId, seed), paint = structurePaint(kitId);
  let rs = 1; while (!(seedFort(rs).tower.plan === 'square' && seedFort(rs).tower.crown !== 'tiers') && rs < 40) rs++;
  const card = Object.entries(CASTLE_CARD).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v[0]}–${v[1]}${v[2] !== undefined ? ` (${v[2]})` : ''}`).join(' · ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Castle Index</title><style>${CSS}.views svg{border:1px solid var(--line)}</style></head><body><div id="page">
<h1>CASTLE INDEX</h1>
<p class="lede">The lord's land drawn tight. The fortified town (its own sheet, parked) kept the lord's land in its inmost ward and spent its surface on walls round the whole town: the innermost structure read bare. A castle takes the town's walls off and compresses what they kept into one structure; what was the town stands outside it. It is composed inward from its wall by a budget: the keep first, ranges backed onto every curtain, the court what is left, every law of the budget measured. No interior is designed (in a game a castle is bigger on the inside): what is designed is what is read from outside, from the walls and from the court. Settings: ${esc(card)}; the fortification's elements as the fortified town's (crenellated, battered, or seeded). Seed ${seed}, painted in ${esc(kitId)}. Placed in a world: not yet.</p>
<h2>The budget</h2>${budgetCard(style, paint, seed)}
<h2>The keep</h2>${keepCard(composeFort('crenellated'), 'crenellated', paint)}${keepCard(composeFort('battered'), 'battered', paint)}${keepCard(composeFort({ seed: rs }), `seeded ${rs} (a great tower)`, paint)}
<h2>A castle</h2>${castleCard(style, paint, seed, { fort: 'crenellated', anchor: 'timber-hall' }, 'Crenellated, its ranges timber-framed')}
<h2>The other composition</h2>${castleCard(style, paint, seed, { fort: 'battered', anchor: 'tiered' }, 'Battered, its ranges in tiers, on a high platform')}
<h2>One ward</h2>${castleCard(style, paint, seed + 1, { fort: 'battered', anchor: 'timber-hall', wards: 1, size: 40 }, 'One ward, battered, 40 m')}
<h2>A seeded one, broad</h2>${castleCard(style, paint, seed + 5, { fort: { seed: 5 }, size: 54 }, 'Seeded fortification 5, 54 m: the court takes a chapel')}
<h2>Outside the castle</h2>${outsideCard(style, paint, seed, { castle: 'crenellated', anchor: 'timber-hall' }, 'The town below its castle')}
<h2>Laws</h2><div class="card"><table>${[...CASTLE_LAWS, TOWN_LAWS.find((l) => l.id === 'outside')].map((l) => `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.want)}</td><td class="note">${esc(l.why)}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}
