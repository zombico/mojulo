/**
 * THE FORTIFIED TOWN, drawn — the scapeshift sheet for a town drawn tighter, the lord's land inside its wards: the dial
 * (an open town, a walled one, the lord's land, one recipe apart), the fortification's elements by depth (the bay, the
 * tower derived from it, the gatehouse), a fortified town from above, standing, and from its approach, with its laws;
 * the other authored composition, and a seeded one. Parked: the castle (era/out-castle-html.js) is the lord's land
 * drawn tight. Data: era/out-fortress.js, era/out-town.js. `outFortifiedTownHtml(opts)` is pure.
 */
import { structureStyle } from './out-structures.js';
import { drawStructures, fig } from './out-structures-draw.js';
import { designTown, TOWN_LAWS, fortFaces } from './out-town.js';
import { structurePaint } from './out-structures-paint.js';
import { townMapSvg, townAxonSvg, townFaces, resetTownIds } from './out-town-html.js';
import { FORT_KINDS, FORT_SET_IDS, TOWER_RULES, FORTIFY, RAMPART, composeFort, fortDial, build as FB } from './out-fortress.js';
import { CSS } from './out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FORT_LAWS = ['enclosed', 'flanking', 'bent-entry', 'commands', 'skyline', 'glacis', 'gates-only', 'one-way-up'];
const trisOf = (faces) => faces.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0);
const lawRows = (laws) => laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</td><td>${esc(l.value)}</td><td class="note">${esc(l.want ?? '')}</td></tr>`).join('');

/** One recipe, the dial turned: the same town open, walled, and the lord's land inside. */
function dialCard(style, paint, seed, base) {
  const steps = [0, 0.5, 1].map((f) => { const t = designTown(style, seed, { ...base, fortified: f }), bad = t.laws.filter((l) => !l.ok).length; return fig(townMapSvg(t, paint, null, { px: 2.2, labels: false }), `<b>fortified ${f}</b> · ${esc(fortDial(f).steps.join(' → '))} · ${t.lots.length} lots · ${bad ? `${bad} laws advise` : 'every law holds'}`); }).join('');
  const rows = FORTIFY.map((s) => `<tr><td><b>${esc(s.id)}</b></td><td>${s.at === 0.01 ? '> 0' : s.at}</td><td class="note">${esc(s.read)}</td></tr>`).join('');
  return `<div class="card"><h3>The dial <span class="badge solid">fortified 0 … 1</span></h3><p class="note">A fortified town is not a new kind of thing: it is the town drawn tighter. The same recipe, the dial turned: the routes come first as ever, then the curtain closes round them, the approach bends under the wall, the terraces become wards the walk climbs through gates, until one gate leads to the keep through every ward. The rampart rises with the dial (${RAMPART.join('–')} m, game-scaled) and the towers close in (46 m apart to 26).</p>
<div class="views">${steps}</div><table style="margin-top:8px"><tr><th>step</th><th>from</th><th></th></tr>${rows}</table></div>`;
}

/** A composition's elements: the bay by depth, the tower derived from it, the gatehouse. */
function elementsCard(id, paint) {
  const F = composeFort(id), H = 7;
  const params = Object.entries(FORT_KINDS).map(([k, K]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(Object.entries(F[k]).map(([p, v]) => `${p} ${v}`).join(' · '))}</td><td class="note">${esc(K.read)}</td></tr>`).join('');
  const bays = [0, 1, 2, 3].map((d) => { const o = []; FB.bay(o, 12, F, H, { depth: d, gates: [], seed: 4 }); return fig(drawStructures([o], { view: 'axon', paint, w: 210, h: 170, ppm: 11 }), `bay · depth ${d} · ${trisOf(o)} tris`); }).join('');
  const towers = [0, 1, 2].map((d) => { const o = []; FB.tower(o, F, H + 5, { depth: d }); return fig(drawStructures([o], { view: 'axon', paint, w: 170, h: 200, ppm: 10 }), `tower · depth ${d} · ${trisOf(o)} tris`); }).join('');
  const gate = [], bay2 = [];
  FB.gatehouse(gate, F, H, 4.4, { depth: 2 });
  FB.bay(bay2, 30, F, H, { depth: 2, gates: [{ u: 15, w: 4.4 }], seed: 2 });
  const passage = [...bay2.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x - 15, y, z]) })), ...gate];
  const rule = { shares: `${F.curtain.group} ${F.curtain.value}, ${F.curtain.base}`, rises: `${F.towerDims.over} m (a storey and a half) over the walk at least`, 'stands-out': `${F.towerDims.proud} m out of the face`, turns: `${F.tower.plan}, ${F.towerDims.w} m across`, crowns: F.tower.crown };
  return `<div class="card"><h3>${esc(id)} <span class="badge">elements first</span></h3><p class="note">${esc(F.read)}.</p><table>${params}</table>
<p class="note" style="margin-top:8px">THE BAY: the fortification's citizen, a length of curtain with its walk and parapet; every stretch of wall is a bay. By depth: the mass; the walk and the parapet; the laying and the loopholes in the tile; the walk's paving.</p><div class="views">${bays}</div>
<p class="note" style="margin-top:8px">THE TOWER, derived from the bay by contrast (as the town's secondary from its anchor):</p><table>${TOWER_RULES.map((r) => `<tr><td><b>${esc(r.id)}</b></td><td class="note">${esc(r.rule)}</td><td>${esc(rule[r.id])}</td></tr>`).join('')}</table><div class="views">${towers}${fig(drawStructures([passage], { view: 'axon', paint, w: 420, h: 220, ppm: 9 }), `the gatehouse (${esc(F.gate.form)}) in its curtain`)}</div></div>`;
}

/** A fortified town, from above, standing and from its approach, with its laws. */
function fortifiedCard(style, paint, seed, rec, title) {
  const t = designTown(style, seed, rec), F = fortFaces(t, { most: 2 }), fortL = t.laws.filter((l) => FORT_LAWS.includes(l.law)), rest = t.laws.filter((l) => !FORT_LAWS.includes(l.law));
  // from the approach: looking east at the west front, everything standing
  // from the south, where the approach comes up under the west wall: the curtain, its towers, the wards climbing behind
  const xs = t.fort.poly.map((p) => p[0]), span = Math.max(...xs) - Math.min(...xs) + 40, ppm = Math.min(5, 1100 / span), sky = Math.max(...t.fort.towers.map((x) => x.top), ...t.lots.map((l) => l.crown ?? 0)) + 4, hh = Math.round(sky * ppm + 30);
  const front = drawStructures([...F.groups, ...townFaces(t, paint, () => true, { tile: () => false })], { view: 'front', paint, w: Math.round(span * ppm), h: hh, ppm, at: [Math.round(-(Math.min(...xs) - 20) * ppm), hh - 14] });
  return `<div class="card"><h3>${esc(title)} <span class="badge solid">fortified ${rec.fortified}</span></h3><p class="note">${esc(t.fort.set.read)}. The town's anchor: ${esc(t.language.id)}. ${t.fort.curtains.length} lengths of curtain (${t.fort.curtains.filter((c) => c.ward).length} of them wards' walls), ${t.fort.towers.length} towers, ${t.fort.gates.length} gates, ${t.lots.length} lots inside. North is up; the approach comes up the west side, outside the ditch, and turns into the gate.</p>
<div style="overflow-x:auto">${townMapSvg(t, paint, null, { px: 4.2 })}</div>
<div class="views" style="margin-top:6px">${fig(townAxonSvg(t, paint, null, { w: 1100, h: 700 }), 'standing')}</div>
<div class="views" style="margin-top:6px">${fig(front, 'from the south, where the approach comes up: the curtain and its towers, the wards climbing behind, the keep over all')}</div>
<h3 style="margin-top:10px">The fortified town's laws <span class="badge">machine gate</span></h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${lawRows(fortL)}</table>
<p class="note">The town's own laws: ${rest.map((l) => `${esc(l.law)} <b class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'ADVISES'}</b>`).join(' · ')}</p></div>`;
}

/** The whole sheet as one HTML page. */
export function outFortifiedTownHtml({ seed = 8, kitId = 'isekai-meadow' } = {}) {
  resetTownIds();
  const style = structureStyle(kitId, seed), paint = structurePaint(kitId);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fortified Town Index</title><style>${CSS}.views svg{border:1px solid var(--line)}</style></head><body><div id="page">
<h1>FORTIFIED TOWN INDEX</h1>
<p class="lede">A town drawn tighter: the fortified town, the lord's land inside its wards. Parked here as a structure of its own; its walls take the surface from what they keep (the castle, on its own sheet, is the lord's land drawn tight). No interior is designed here (in a game a fortification is bigger on the inside): what is designed is what is read from outside and from the walls, the approach, the gates, the skyline in its layers. The town's machinery does the work (routes first, terraces climbed by stairs, lots, boundaries by role, the landmark), and one dial closes it. The fortification is designed like the town: elements first, the bay as its citizen, the tower derived from the bay by contrast, the keep the town's landmark spoken over everything. Two compositions to strive for, neither a preset; seed ${seed}, painted in ${esc(kitId)}. Placed in a world: not yet.</p>
<h2>The dial</h2>${dialCard(style, paint, seed, { fort: 'crenellated' })}
<h2>The elements</h2>${FORT_SET_IDS.map((id) => elementsCard(id, paint)).join('')}
<h2>The lord's land inside</h2>${fortifiedCard(style, paint, seed, { fortified: 1, fort: 'crenellated', anchor: 'timber-hall' }, 'Crenellated, over a timber-framed town')}
<h2>The other composition</h2>${fortifiedCard(style, paint, seed, { fortified: 1, fort: 'battered', anchor: 'tiered' }, 'Battered, over a town of tiered houses')}
<h2>A seeded one, half closed</h2>${fortifiedCard(style, paint, seed + 5, { fortified: 0.65, fort: { seed: 5 } }, 'Seeded fortified town 5')}
<h2>Laws</h2><div class="card"><table>${TOWN_LAWS.filter((l) => FORT_LAWS.includes(l.id)).map((l) => `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.want)}</td><td class="note">${esc(l.why)}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}

