/**
 * THE FACILITY MAPS — a building's floors drawn from above as a level designer reads them: its rooms, its doorways and
 * ways out, its stairs, and every piece on its floors coloured by what it hides (a standing body, a crouch, a body
 * lying down), with its rooms' layouts and their laws beside it. The maps this kind of game is built of: a stealth or
 * action game's interiors are facilities (era/facilities.js), each a building designed to move through.
 *
 *   facilityMapSvg(P, { storey?, title?, path?, patrol? }) → one storey of a laid plan (era/stage.js planStage) as an
 *                         SVG: `path` a way across ([[x, y]…], dashed white), `patrol` a watcher's walk ([a, b], red);
 *                         its vents (era/vents.js) drawn as their ducts' floors, dashed, each hatch a bar
 *   buildingMaps(B)     → { plan, storeys: [svg…], layouts } for a building as a level names it (gameworld/levels.js
 *                         buildingStage: `use`, `facility`, `scale`, `layouts`…), `layouts` its laid rooms' laws
 *                         (compose-dress.js layoutReport) or null
 *   facilityBook(world) → { name, levels: [{ id, name, building, maps }], shelf: [{ id, …FACILITIES[id], maps }] }
 *   facilityBookHtml(world) → the page (`/api/sketches/<ref>/bible?book=facilities`)
 *   facilityMapsFor(world) → whether the book is this world's to read: a level that is a building, a walled-core
 *                         dungeon, or a rail whose level kinds are interiors (level-kinds.js): the readout's exit
 *
 * Pure: the plan is laid from the recipe on every read, the same for the same recipe. docs/facility-pieces.md.
 */
import { buildingStage } from './levels.js';
import { readGameworld } from './world.js';
import { planStage } from '../era/stage.js';
import { withProgram } from '../era/programs.js';
import { PIECES, footprintOf } from '../era/compose-dress.js';
import { FACILITIES, FACILITY_IDS } from '../era/facilities.js';
import { levelKindsOf } from './level-kinds.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (v) => +v.toFixed(2);
// what a piece hides, by its height stacked: a standing body's eye, a crouch's, a body lying down's
export const HIDES = Object.freeze([
  Object.freeze({ id: 'stand', least: 1.6, fill: '#c9553f', says: 'stops a standing gaze' }),
  Object.freeze({ id: 'crouch', least: 0.85, fill: '#d99a3c', says: 'hides a crouch' }),
  Object.freeze({ id: 'prone', least: 0, fill: '#6f8fa6', says: 'hides a body lying down' }),
]);
const hideOf = (h) => HIDES.find((x) => h >= x.least);
const DOOR = '#e8c46a', WAY = '#6ae88a', STAIR = '#8fb3d9', VENT = '#5fd6d0', GLASS = '#bfe3ff', MESH = '#a9b0b6';

/** One storey of a laid plan, from above (see the header). */
export function facilityMapSvg(P, { storey = null, title = null, path = null, patrol = null, px = 14 } = {}) {
  const s0 = storey ?? Math.min(...P.rooms.map((r) => r.storey ?? 0)), rooms = P.rooms.filter((r) => (r.storey ?? 0) === s0), ids = new Set(rooms.map((r) => r.id));
  if (!rooms.length) throw new Error(`facility map: no room stands on storey ${s0}`);
  const S = px, X0 = Math.min(...rooms.map((r) => r.x0)) - 1, X1 = Math.max(...rooms.map((r) => r.x1)) + 1, Y0 = Math.min(...rooms.map((r) => r.y0)) - (title ? 3 : 1), Y1 = Math.max(...rooms.map((r) => r.y1)) + 1;
  const x = (v) => r2((v - X0) * S), y = (v) => r2((Y1 - v) * S), W = x(X1), H = y(Y0);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace,monospace" role="img"${title ? ` aria-label="${esc(title)}"` : ''}><rect width="${W}" height="${H}" fill="#1c1f22"/>`;
  for (const r of rooms) s += `<rect x="${x(r.x0)}" y="${y(r.y1)}" width="${r2((r.x1 - r.x0) * S)}" height="${r2((r.y1 - r.y0) * S)}" fill="#3a3f44" stroke="#8a8f94" stroke-width="2"/><text x="${x(r.x0) + 4}" y="${y(r.y1) + 13}" fill="#9ab" font-size="11">${esc(r.id)}</text>`;
  for (const st of P.stairs ?? []) if (ids.has(st.lower) || ids.has(st.upper)) { const [a, b, c, d] = st.rect; s += `<rect x="${x(a)}" y="${y(d)}" width="${r2((c - a) * S)}" height="${r2((d - b) * S)}" fill="none" stroke="${STAIR}" stroke-width="1.5" stroke-dasharray="4 2"/><text x="${x(a) + 3}" y="${y(b) - 4}" fill="${STAIR}" font-size="10">stair</text>`; }
  const gap = (X, at, lo, hi, c) => (X ? `<rect x="${x(at) - 3}" y="${y(hi)}" width="6" height="${r2((hi - lo) * S)}" fill="${c}"/>` : `<rect x="${x(lo)}" y="${y(at) - 3}" width="${r2((hi - lo) * S)}" height="6" fill="${c}"/>`);
  for (const l of P.links ?? []) if (ids.has(l.from) && ids.has(l.to) && l.wall) s += gap(l.wall.endsWith('x'), l.at, l.lo, l.hi, DOOR);
  for (const w of P.ways ?? []) if (ids.has(w.room) && w.side) s += gap(w.side.endsWith('x'), w.at, w.lo, w.hi, WAY);
  // (the inner windows, era/inner-windows.js: glass in a wall, a pale bar)
  for (const w of P.windows?.windows ?? []) {
    const r = P.rooms.find((q) => q.id === w.room);
    if (!r || !ids.has(r.id)) continue;
    const at = w.side === '-x' ? r.x0 - 0.25 : w.side === '+x' ? r.x1 + 0.25 : w.side === '-y' ? r.y0 - 0.25 : r.y1 + 0.25;
    s += gap(w.side.endsWith('x'), at, w.lo, w.hi, GLASS);
  }
  const tall = new Map();
  for (const it of P.props ?? []) { if (!PIECES[it.kind]) continue; const base = it.id.replace(/@\d+$/, ''); tall.set(base, Math.max(tall.get(base) ?? 0, PIECES[it.kind].h * (it.scale ?? 1) * ((it.level ?? 0) + 1))); }
  for (const it of (P.props ?? []).filter((it) => !it.level && !it.wall && ids.has(it.room) && PIECES[it.kind])) {
    // (a see-through piece, mesh: a dashed grey line, what a gaze goes through)
    if (PIECES[it.kind].see) { const f = footprintOf(it), X = f.max[0] - f.min[0] >= f.max[1] - f.min[1], my = (f.min[1] + f.max[1]) / 2, mx = (f.min[0] + f.max[0]) / 2; s += X ? `<line x1="${x(f.min[0])}" y1="${y(my)}" x2="${x(f.max[0])}" y2="${y(my)}" stroke="${MESH}" stroke-width="2.5" stroke-dasharray="2 2"/>` : `<line x1="${x(mx)}" y1="${y(f.min[1])}" x2="${x(mx)}" y2="${y(f.max[1])}" stroke="${MESH}" stroke-width="2.5" stroke-dasharray="2 2"/>`; continue; }
    const f = footprintOf(it), c = hideOf(tall.get(it.id)).fill;
    s += `<rect x="${x(f.min[0])}" y="${y(f.max[1])}" width="${r2((f.max[0] - f.min[0]) * S)}" height="${r2((f.max[1] - f.min[1]) * S)}" fill="${c}" stroke="#111" stroke-width="0.5"/>`;
  }
  // (the vents, era/vents.js: each duct's floor along its rooms' back walls, dashed, its hatch into each room a bar, its
  // holes through the walls it shares open)
  for (const d of P.vents?.ducts ?? []) for (const g of d.segments) {
    if (!ids.has(g.room)) continue;
    const { min: a, max: b } = g.strip;
    s += `<rect x="${x(a[0])}" y="${y(b[1])}" width="${r2((b[0] - a[0]) * S)}" height="${r2((b[1] - a[1]) * S)}" fill="${VENT}" fill-opacity="0.16" stroke="${VENT}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    const [hx, hy] = g.hatch.at, X = g.hatch.side.endsWith('x');
    s += X ? `<rect x="${x(hx) - 2}" y="${y(hy + 0.7)}" width="4" height="${r2(1.4 * S)}" fill="${VENT}"/>` : `<rect x="${x(hx - 0.7)}" y="${y(hy) - 2}" width="${r2(1.4 * S)}" height="4" fill="${VENT}"/>`;
  }
  if (patrol) s += `<line x1="${x(patrol[0][0])}" y1="${y(patrol[0][1])}" x2="${x(patrol[1][0])}" y2="${y(patrol[1][1])}" stroke="#ff5a5a" stroke-width="2" opacity="0.8"/>`;
  if (path?.length) s += `<polyline points="${path.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 3"/>`;
  if (title) s += `<text x="8" y="${H - 10}" fill="#dde" font-size="13">${esc(title)}</text>`;
  return `${s}</svg>`;
}

/** A building as a level names it, laid, and each of its storeys drawn (see the header). */
export function buildingMaps(B) {
  const P = planStage(withProgram(buildingStage({ seed: 1, ...B })));
  const storeys = [...new Set(P.rooms.map((r) => r.storey ?? 0))].sort((a, b) => a - b);
  return { plan: P, storeys: storeys.map((k) => ({ storey: k, svg: facilityMapSvg(P, { storey: k }) })), layouts: P.compose?.layouts ?? null };
}

/** Whether the book is the world's to read (see the header). */
export function facilityMapsFor(world) {
  if (!world || typeof world !== 'object') return false;
  const building = Object.values(world.levels ?? {}).some((L) => L?.building && L.building.ref === undefined && L.building.complex === undefined);
  return building || !!world.wcd || levelKindsOf(world.rail?.from).length > 0;
}

/** The book: this world's building levels drawn, and the facilities shelf (see the header). */
export function facilityBook(world) {
  const G = readGameworld(world), levels = [];
  for (const [id, L] of Object.entries(world.levels ?? {})) {
    const B = L?.building;
    if (!B || B.ref !== undefined || B.complex !== undefined) continue;
    const space = Object.values(G.wcd?.spaces ?? {}).find((sp) => sp.level === id && sp.facility);
    const own = { ...B, ...(B.use === undefined && B.facility === undefined && space ? { facility: space.facility } : {}) };
    if (own.use === undefined && own.facility === undefined) continue;
    levels.push({ id, name: L.name ?? id, building: own, maps: buildingMaps(own) });
  }
  const shelf = FACILITY_IDS.map((id) => ({ id, ...FACILITIES[id], maps: buildingMaps({ facility: id }) }));
  return { name: world.name ?? world.id ?? 'the game', levels, shelf };
}

const CSS = `:root{--paper:#f6f4ee;--sheet:#fff;--ink:#1c1b19;--muted:#6b675f;--rule:#d9d4c7;--accent:#0f6b5c}
@media (prefers-color-scheme:dark){:root{--paper:#141412;--sheet:#1d1c1a;--ink:#ebe8e0;--muted:#9a958a;--rule:#34322d;--accent:#5fd0b8}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:28px 16px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px;color:var(--accent);letter-spacing:.04em;text-transform:uppercase}
h3{font-size:18px;margin:24px 0 4px}p.lede{color:var(--muted);margin:0 0 8px;max-width:75ch}code{font:13px ui-monospace,monospace}
.map{overflow-x:auto;background:#1c1f22;border-radius:8px;margin:8px 0;padding:4px}.map svg{display:block;width:100%;height:auto}
.wrap{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:560px}
td,th{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rule);vertical-align:top;font-size:14px}th{font-size:12px;color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
.ok{color:var(--accent)}.no{color:#c0543c}.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--muted);margin:6px 0}
.legend i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:-1px}`;

const legend = () => `<div class="legend">${HIDES.map((h) => `<span><i style="background:${h.fill}"></i>${esc(h.says)}</span>`).join('')}<span><i style="background:${DOOR}"></i>a doorway</span><span><i style="background:${WAY}"></i>a way out</span><span><i style="border:1.5px dashed ${STAIR}"></i>a stair</span><span><i style="border:1.5px dashed ${VENT};background:rgba(95,214,208,.2)"></i>a vent a body lies flat in, its hatch a bar</span><span><i style="background:${GLASS}"></i>a window: seen through, never walked through</span><span><i style="border-top:2.5px dashed ${MESH};height:0"></i>mesh: the same</span></div>`;
const lawsTable = (layouts) => {
  const rows = Object.entries(layouts ?? {});
  if (!rows.length) return '';
  return `<div class="wrap"><table><tr><th>room</th><th>its floor</th><th>pieces</th><th>its laws</th></tr>${rows.map(([room, L]) => `<tr><td><code>${esc(room)}</code></td><td>${esc(L.layout)}${L.stocked ? ' (could not hold it: stocked)' : ''}</td><td>${L.pieces}</td><td>${L.laws.map((l) => `<span class="${l.holds ? 'ok' : 'no'}">${l.holds ? '✓' : '✗'} ${esc(l.law)}</span>`).join(' · ')}</td></tr>`).join('')}</table></div>`;
};
const mapsOf = (M) => M.storeys.map((s) => `${M.storeys.length > 1 ? `<p class="lede">Storey ${s.storey}</p>` : ''}<div class="map">${s.svg}</div>`).join('');

/** The page (see the header). */
export function facilityBookHtml(world) {
  const B = facilityBook(world);
  const level = (L) => `<h3>${esc(L.name)}</h3><p class="lede"><code>${esc(JSON.stringify(L.building))}</code></p>${mapsOf(L.maps)}${lawsTable(L.maps.layouts)}`;
  const shelf = (F) => `<h3>${esc(F.id)}</h3><p class="lede">${esc(F.reads)}. A ${esc(F.use)} laid at scale ${F.scale}, built in ${esc(F.look.construction)} with the ${esc(F.look.palette)} palette. What a body does there: ${esc(F.moves)}.</p><p class="lede">In a recipe: <code>building: { facility: '${esc(F.id)}' }</code> on a level, or <code>wcd.spaces.&lt;id&gt;.facility: '${esc(F.id)}'</code> on a dungeon's layer.</p>${mapsOf(F.maps)}${lawsTable(F.maps.layouts)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(B.name)}: the facility maps</title><style>${CSS}</style></head><body><main>
<h1>${esc(B.name)}: the facility maps</h1>
<p class="lede">The interiors a stealth or action game is built of, drawn from above as a level designer reads them. Each is a building designed to move through: its halls laid in figures (aisles, machines, desk islands, crate clumps, chicanes, rows) and each laid room held to its laws: its doorways joined, a way round, the gaze broken, cover in reach. A law broken is advice, not a refusal.</p>
${legend()}
${B.levels.length ? `<h2>This game's buildings</h2>${B.levels.map(level).join('\n')}` : ''}
<h2>The shelf</h2>
<p class="lede">Every facility a level or a dungeon's layer can name, each in its own materials. A new one is a row of <code>era/facilities.js</code>; a new figure for a room's floor, a row of <code>era/room-layouts.js</code>.</p>
${B.shelf.map(shelf).join('\n')}
</main></body></html>`;
}
