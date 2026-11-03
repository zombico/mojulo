/**
 * THE ATLAS PAGE — a gameworld's atlas (atlas.js) drawn as an illustrated map, in HTML and CSS alone: the ground an
 * SVG (the sea, the coast, each level a province in its own colour, the roads and gates between them, each level's
 * trail through its stages, the names), and its things (trees, hills, rock, peaks, towns, walls, castles) a layer of
 * sprites over it. Flat, it reads as a drawn map; on the table (a CSS-3D tilt), the ground lies back and every sprite
 * stands up off it, turned to the eye as the table is turned by drag. No WebGL, no canvas, no library.
 *
 *   gameworldAtlasHtml(world, { look? })   → one self-contained page
 *   ATLAS_LOOKS                            the looks, as cards: painted (the world's own colours), ink, night
 *
 * A look is paint only: the same world lays the same map in every look. Pure: the same world, the same page.
 */
import { designAtlas } from './atlas.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const pts = (P) => P.map((p) => p.join(',')).join(' ');
const d = (P) => `M${P.map((p) => p.join(' ')).join(' L')}`;
const smooth = (P) => { if (P.length < 3) return d(P); let s = `M${P[0][0]} ${P[0][1]}`; for (let i = 1; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; s += ` Q${P[i][0]} ${P[i][1]} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; } return `${s} L${P.at(-1)[0]} ${P.at(-1)[1]}`; };

/** The looks: each a card of paint over the same map. `painted` takes the world's own colours (C). */
export const ATLAS_LOOKS = Object.freeze({
  painted: {
    read: 'a painted atlas on warm paper: the provinces in the world\'s own greens and earths, its sea in its water, the ways in brown ink, the trails in its accent',
    paint: (C) => ({ paper: '#efe3c2', paperEdge: '#d8c49a', ink: '#3b2b1b', sea: mix(C.water, '#efe3c2', 0.45), seaLine: mix(C.water, '#3b2b1b', 0.35), land: mix(C.grass, '#efe3c2', 0.55), province: (k) => mix([C.grass, C.sand, C.soil, C.foliage][k % 4], '#efe3c2', 0.42), foliage: C.foliage, foliageDark: mix(C.foliage, '#1d2a16', 0.4), hill: mix(C.soil, '#efe3c2', 0.25), rock: C.rock, peak: mix(C.stone, '#ffffff', 0.15), peakShade: mix(C.rock, '#3b2b1b', 0.35), roof: C.accent, wall: mix(C.stone, '#efe3c2', 0.3), road: '#7a5634', trail: C.accent, label: '#3b2b1b', glow: null, stars: false }),
  },
  ink: {
    read: 'an engraved map in one ink on cream: everything outlined and hatched, nothing coloured but the paper',
    paint: () => ({ paper: '#f4ecd8', paperEdge: '#e3d5b3', ink: '#2c2218', sea: '#f4ecd8', seaLine: '#2c2218', land: '#f4ecd8', province: () => '#f4ecd8', foliage: '#f4ecd8', foliageDark: '#2c2218', hill: '#f4ecd8', rock: '#f4ecd8', peak: '#f4ecd8', peakShade: '#2c2218', roof: '#2c2218', wall: '#f4ecd8', road: '#2c2218', trail: '#2c2218', label: '#2c2218', glow: null, stars: false, mono: true }),
  },
  night: {
    read: 'a star chart of the world: the provinces dark on a midnight sea, the ways drawn in pale light, the trails glowing',
    paint: (C) => ({ paper: '#101a2e', paperEdge: '#060b16', ink: '#bcd2f0', sea: '#0b1426', seaLine: '#2c4a78', land: '#16233d', province: (k) => mix(['#1b2b48', '#1e3047', '#21304a', '#1a2a40'][k % 4], C.foliage, 0.12), foliage: '#2a4a5e', foliageDark: '#9fd0ff', hill: '#22365a', rock: '#3a4c6c', peak: '#c8dcf5', peakShade: '#4a6a94', roof: '#ffd58a', wall: '#2e4266', road: '#7f9cc8', trail: '#ffd58a', label: '#dbe8ff', glow: '#ffd58a', stars: true }),
  },
});
export const ATLAS_LOOK_IDS = Object.freeze(Object.keys(ATLAS_LOOKS));

// the sprites, each drawn standing on its foot at (0, 0) in a 40 × 40 box (feet at the bottom middle)
const SPRITES = (P) => ({
  conifer: `<path d="M20 4 L29 20 L25 20 L32 31 L8 31 L15 20 L11 20 Z" fill="${P.foliage}" stroke="${P.ink}" stroke-width="1.2" stroke-linejoin="round"/><path d="M20 4 L29 20 L25 20 L32 31 L20 31 Z" fill="${P.foliageDark}" opacity="${P.mono ? 0.0 : 0.35}"/><path d="M20 31 V38" stroke="${P.ink}" stroke-width="1.6"/>${P.mono ? '<path d="M22 12 l4 6 M23 22 l5 7 M21 24 l4 6" stroke="#2c2218" stroke-width=".8"/>' : ''}`,
  broadleaf: `<path d="M20 38 V27" stroke="${P.ink}" stroke-width="1.8"/><path d="M9 25 C3 24 4 15 10 15 C9 8 18 5 21 10 C25 5 34 8 32 15 C38 16 37 25 31 25 Z" fill="${P.foliage}" stroke="${P.ink}" stroke-width="1.2"/><path d="M24 12 C31 11 33 18 30 23" fill="none" stroke="${P.foliageDark}" stroke-width="2" opacity=".5"/>`,
  palm: `<path d="M20 38 C19 30 21 24 19 16" fill="none" stroke="${P.ink}" stroke-width="1.8"/><path d="M19 16 C12 12 7 15 5 19 M19 16 C14 9 19 5 24 6 M19 16 C25 11 31 13 34 17 M19 16 C21 20 25 22 27 26" fill="none" stroke="${P.foliage}" stroke-width="3" stroke-linecap="round"/>`,
  hill: `<path d="M4 34 C10 22 16 18 20 18 C25 18 31 24 36 34 Z" fill="${P.hill}" stroke="${P.ink}" stroke-width="1.2"/><path d="M22 21 l3 4 M26 24 l3 4 M29 28 l2 3" stroke="${P.ink}" stroke-width=".9" opacity=".7"/>`,
  rock: `<path d="M9 34 L13 24 L20 21 L27 25 L31 34 Z" fill="${P.rock}" stroke="${P.ink}" stroke-width="1.2" stroke-linejoin="round"/><path d="M20 21 L22 34" stroke="${P.ink}" stroke-width=".8" opacity=".6"/>`,
  peak: `<path d="M2 36 L16 8 L22 17 L26 12 L38 36 Z" fill="${P.peak}" stroke="${P.ink}" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 8 L19 36 L38 36 L26 12 L22 17 Z" fill="${P.peakShade}" opacity="${P.mono ? 0 : 0.45}"/>${P.mono ? '<path d="M24 20 l5 8 M22 25 l6 9 M27 17 l6 11" stroke="#2c2218" stroke-width=".8"/>' : '<path d="M13 14 L16 8 L19 13 L17 12 L15 15 Z" fill="#fbfbf6"/>'}`,
  marsh: `<path d="M8 34 h24 M12 31 v-6 M16 31 v-9 M20 31 v-5 M26 31 v-8 M30 31 v-5" stroke="${P.ink}" stroke-width="1.1"/>`,
  town: `<path d="M5 36 V24 L11 18 L17 24 V36 Z M15 36 V20 L22 13 L29 20 V36 Z M25 36 V26 L30 21 L35 26 V36 Z" fill="${P.wall}" stroke="${P.ink}" stroke-width="1.1" stroke-linejoin="round"/><path d="M4 25 L11 17.5 L18 25 M14 21 L22 12.5 L30 21 M24 27 L30 20.5 L36 27" fill="none" stroke="${P.roof}" stroke-width="3" stroke-linejoin="round"/><path d="M21 36 v-5 h2 v5" fill="${P.ink}"/>`,
  castle: `<path d="M6 36 V16 h3 v3 h3 v-3 h3 V36 Z M25 36 V16 h3 v3 h3 v-3 h3 V36 Z M13 36 V10 h3 v3 h3 v-3 h3 v3 h3 v-3 h0 V36 Z" fill="${P.wall}" stroke="${P.ink}" stroke-width="1.1" stroke-linejoin="round"/><path d="M19 36 v-6 a2 2 0 0 1 4 0 v6" fill="${P.ink}"/><path d="M20 10 V3 l6 2 -6 2" fill="${P.roof}" stroke="${P.ink}" stroke-width=".8"/>`,
  hall: `<path d="M6 36 V20 L20 10 L34 20 V36 Z" fill="${P.wall}" stroke="${P.ink}" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 21 L20 9 L36 21" fill="none" stroke="${P.roof}" stroke-width="3"/><path d="M17 36 v-8 h6 v8" fill="${P.ink}"/>`,
});

export function gameworldAtlasHtml(world, { look = 'painted' } = {}) {
  if (!ATLAS_LOOKS[look]) throw new Error(`atlas: look is one of ${ATLAS_LOOK_IDS.join(', ')}`);
  const A = designAtlas(world), P = ATLAS_LOOKS[look].paint(A.colours), S = SPRITES(P), { W, H } = A;
  const ground = [];
  // the sea, and its waves drawn in rows
  ground.push(`<rect width="${W}" height="${H}" fill="${P.sea}"/>`);
  for (let y = 30; y < H; y += 26) ground.push(`<path d="${Array.from({ length: Math.ceil(W / 60) }, (_, i) => `M${i * 60 + ((y / 26) % 2) * 30} ${y} q7 -5 14 0`).join(' ')}" fill="none" stroke="${P.seaLine}" stroke-width=".8" opacity=".35"/>`);
  // the land: each province's shore grown out into one mass; its coast stroked under its fill, so only the outer edge
  // shows, with the shallows ringed outside it
  const grown = A.regions.map((R) => R.outline.map(([x, y]) => [+(R.at[0] + (x - R.at[0]) * 1.5).toFixed(1), +(R.at[1] + (y - R.at[1]) * 1.55).toFixed(1)]));
  for (const [w, o] of [[34, 0.12], [20, 0.18], [9, 0.3]]) for (const g of grown) ground.push(`<polygon points="${pts(g)}" fill="none" stroke="${P.seaLine}" stroke-width="${w}" stroke-linejoin="round" opacity="${o}"/>`);
  for (const g of grown) ground.push(`<polygon points="${pts(g)}" fill="none" stroke="${P.ink}" stroke-width="3.2" stroke-linejoin="round"/>`);
  for (const g of grown) ground.push(`<polygon points="${pts(g)}" fill="${P.land}"/>`);
  // the provinces, each its own wash and a dotted border
  A.regions.forEach((R, k) => ground.push(`<polygon class="prov" data-level="${esc(R.id)}" points="${pts(R.outline)}" fill="${P.province(k)}" opacity="${P.mono ? 1 : 0.85}" stroke="${P.ink}" stroke-width="1.1" stroke-dasharray="2 4"><title>${esc(R.name)}</title></polygon>`));
  // the rivers, from the heights to the sea: one stroke cased in ink
  for (const R of A.regions.filter((x) => x.river)) ground.push(`<path d="${smooth(R.river)}" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round" opacity=".65"/><path d="${smooth(R.river)}" fill="none" stroke="${P.mono ? P.paper : P.sea}" stroke-width="3.6" stroke-linecap="round"/>`);
  // the ways between levels: a road a dashed track, a gate a dotted way with its arch; a locked one its key
  for (const r of A.roads) {
    const m = r.path[Math.floor(r.path.length / 2)];
    ground.push(`<path d="${smooth(r.path)}" fill="none" stroke="${P.paper}" stroke-width="5" opacity=".7"/><path d="${smooth(r.path)}" fill="none" stroke="${P.road}" stroke-width="2.2" stroke-dasharray="${r.kind === 'gate' ? '1.5 5' : '9 5'}" stroke-linecap="round"${P.glow ? ' filter="url(#glow)"' : ''}/>`);
    if (r.kind === 'gate') ground.push(`<g transform="translate(${m[0]} ${m[1]})"><path d="M-9 8 V-2 a9 9 0 0 1 18 0 V8" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/><path d="M-4 8 V0 a4 4 0 0 1 8 0 V8" fill="${P.ink}" opacity=".75"/></g>`);
    if (r.key) ground.push(`<g transform="translate(${m[0] + 14} ${m[1] - 12})"><circle r="4" fill="none" stroke="${P.trail}" stroke-width="2"/><path d="M4 0 h9 m-3 0 v4 m-3 -4 v3" stroke="${P.trail}" stroke-width="2"/></g>`);
  }
  // each level's trail through its stages: the stages marked by what they are (a trail a dot, a climb a wedge, a
  // building a square), the hub ringed by its walls
  for (const R of A.regions) {
    ground.push(`<path d="${smooth(R.trail.path)}" fill="none" stroke="${P.ink}" stroke-width="5" stroke-linecap="round" opacity="${P.mono ? 0.2 : 0.55}"/><path d="${smooth(R.trail.path)}" fill="none" stroke="${P.trail}" stroke-width="2.6" stroke-linecap="round"${P.glow ? ' filter="url(#glow)"' : ''}/>`);
    for (const s of R.trail.stops) {
      const [x, y] = s.at, mark = s.section === 'meru' ? `<path d="M${x - 6} ${y + 5} L${x} ${y - 6} L${x + 6} ${y + 5} Z"` : s.section === 'building' || s.section === 'city' ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10"` : `<circle cx="${x}" cy="${y}" r="4.5"`;
      ground.push(`${mark} fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"><title>${esc(R.name)} · ${esc(s.node)} (${esc(s.section)})</title>${s.section === 'meru' ? '</path>' : s.section === 'building' || s.section === 'city' ? '</rect>' : '</circle>'}`);
    }
    for (const p of R.places.filter((q) => q.kind === 'walls')) ground.push(`<circle cx="${p.at[0]}" cy="${p.at[1]}" r="30" fill="none" stroke="${P.ink}" stroke-width="3.4"/><circle cx="${p.at[0]}" cy="${p.at[1]}" r="30" fill="none" stroke="${P.wall}" stroke-width="1.6"/>${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<rect x="${(p.at[0] + 30 * Math.cos(a) - 3.5).toFixed(1)}" y="${(p.at[1] + 30 * Math.sin(a) - 3.5).toFixed(1)}" width="7" height="7" fill="${P.wall}" stroke="${P.ink}" stroke-width="1.2"/>`; }).join('')}`);
  }
  // the names: each level's under its province, the hub's larger, in caps; its stages' small along its trail
  for (const R of A.regions) {
    const y = R.at[1] + R.r * 0.58;
    ground.push(`<text x="${R.at[0]}" y="${y}" class="nm${R.hub ? ' hub' : ''}" text-anchor="middle">${esc(R.name)}</text>`);
    ground.push(`<text x="${R.at[0]}" y="${y + 17}" class="sub" text-anchor="middle">${esc(R.hub ? 'the hub · every way leads back' : R.start ? 'where it begins' : `${R.trail.stops.length} stage${R.trail.stops.length === 1 ? '' : 's'}`)}</text>`);
  }
  // the compass and the scale
  const [cx, cy] = A.compass;
  ground.push(`<g transform="translate(${cx} ${cy})" class="compass">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4, L = i % 2 ? 26 : 50, w = i % 2 ? 6 : 9; const tip = [L * Math.sin(a), -L * Math.cos(a)], l = [w * Math.sin(a - Math.PI / 2), -w * Math.cos(a - Math.PI / 2)]; return `<path d="M0 0 L${l[0].toFixed(1)} ${l[1].toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} Z" fill="${P.ink}"/><path d="M0 0 L${(-l[0]).toFixed(1)} ${(-l[1]).toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} Z" fill="${i % 2 ? P.paper : P.trail}" stroke="${P.ink}" stroke-width=".8"/>`; }).join('')}<circle r="14" fill="none" stroke="${P.ink}" stroke-width="1.2"/><circle r="60" fill="none" stroke="${P.ink}" stroke-width=".8" stroke-dasharray="1 3"/><text y="-64" text-anchor="middle" class="cmp">N</text></g>`);
  ground.push(`<g transform="translate(60 ${H - 52})"><path d="M0 0 h160" stroke="${P.ink}" stroke-width="5"/><path d="M0 0 h40 M80 0 h40" stroke="${P.paper}" stroke-width="3"/><text y="20" class="sub">a stage's walk</text></g>`);
  // the cartouche: the world's name in its scroll
  const title = A.name ?? 'The world';
  ground.push(`<g transform="translate(60 52)"><path d="M0 0 h${Math.max(260, title.length * 21)} v60 h-${Math.max(260, title.length * 21)} Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/><path d="M6 6 h${Math.max(260, title.length * 21) - 12} v48 h-${Math.max(260, title.length * 21) - 12} Z" fill="none" stroke="${P.ink}" stroke-width=".8"/><text x="${Math.max(260, title.length * 21) / 2}" y="36" text-anchor="middle" class="ttl">${esc(title)}</text><text x="${Math.max(260, title.length * 21) / 2}" y="50" text-anchor="middle" class="sub">an atlas of its levels</text></g>`);
  // the sprites: every glyph and place, by its foot, nearest last (they stand in front)
  const things = [...A.regions.flatMap((R) => R.glyphs.map((g) => ({ ...g, level: R.id }))), ...A.regions.flatMap((R) => R.places.flatMap((p) => (p.kind === 'walls' || (R.hub && p.kind === 'town') ? [[-12, -6, 1.3], [12, -8, 1.4], [0, 8, 1.7]].map(([dx, dy, k]) => ({ kind: 'town', at: [p.at[0] + dx, p.at[1] + dy], s: k, level: R.id })) : [{ kind: p.kind, at: p.at, s: 1.4, level: R.id }])))].sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
  const sprite = (t) => `<i class="sp" style="left:${((t.at[0] / W) * 100).toFixed(2)}%;top:${((t.at[1] / H) * 100).toFixed(2)}%;--s:${t.s}"><svg viewBox="0 0 40 40"><use href="#${t.kind}"/></svg></i>`;
  const symbols = Object.entries(S).map(([k, v]) => `<symbol id="${k}" viewBox="0 0 40 40" overflow="visible">${v}</symbol>`).join('');
  const looks = ATLAS_LOOK_IDS.map((l) => `<a href="?book=atlas&amp;look=${l}"${l === look ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Atlas</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap">
<style>
:root{--paper:${P.paper};--edge:${P.paperEdge};--ink:${P.ink};--label:${P.label};--tilt:0deg;--turn:0deg}
*{box-sizing:border-box}body{margin:0;background:${P.paperEdge};color:var(--ink);font:15px/1.4 "IM Fell English",Georgia,serif}
.bar{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between;padding:12px 16px}
.bar h1{margin:0;font:400 22px "IM Fell English SC",Georgia,serif;letter-spacing:.06em;color:var(--label)}
.ctl{display:flex;flex-wrap:wrap;gap:6px}.ctl a,.ctl button{font:inherit;font-size:14px;color:var(--label);background:transparent;border:1px solid var(--ink);border-radius:3px;padding:4px 10px;cursor:pointer;text-decoration:none}
.ctl [aria-current],.ctl [aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.stage{perspective:1600px;perspective-origin:50% 30%;padding:0 16px 28px;overflow:hidden;touch-action:none}
.plane{position:relative;width:min(100%,${W}px);aspect-ratio:${W}/${H};margin:0 auto;transform-style:preserve-3d;transform:rotateX(var(--tilt)) rotateZ(var(--turn));transition:transform .9s cubic-bezier(.3,.7,.2,1);box-shadow:0 18px 40px rgba(0,0,0,.35);background:radial-gradient(ellipse at 50% 45%,var(--paper) 55%,var(--edge))}
.plane.drag{transition:none}
.ground{position:absolute;inset:0;width:100%;height:100%}
.sp{position:absolute;width:calc(2.1% * var(--s));aspect-ratio:1;transform-origin:50% 100%;transform:translate(-50%,-100%) rotateZ(calc(-1 * var(--turn))) rotateX(calc(-1 * var(--tilt)));transition:transform .9s cubic-bezier(.3,.7,.2,1);pointer-events:none}
.plane.drag .sp{transition:none}.sp svg{width:100%;height:100%;overflow:visible;display:block}
.nm{font:400 22px "IM Fell English SC",Georgia,serif;letter-spacing:.12em;fill:var(--label);paint-order:stroke;stroke:var(--paper);stroke-width:4px}.nm.hub{font-size:30px}
.sub{font:italic 13px "IM Fell English",Georgia,serif;fill:var(--label);opacity:.85;paint-order:stroke;stroke:var(--paper);stroke-width:3px}
.ttl{font:400 28px "IM Fell English SC",Georgia,serif;letter-spacing:.1em;fill:var(--label)}.cmp{font:400 18px "IM Fell English SC",Georgia,serif;fill:var(--label)}
.prov{transition:opacity .2s}.prov:hover{opacity:1;stroke-width:2.2}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;padding:0 16px 24px;font-size:14px;color:var(--label);justify-content:center}.legend span{display:inline-flex;gap:6px;align-items:center}
@media (max-width:700px){.bar h1{font-size:18px}.nm{font-size:26px}}
</style></head><body>
<div class="bar"><h1>${esc(title)}</h1><div class="ctl"><button type="button" data-view="flat" aria-pressed="true">Flat</button><button type="button" data-view="table" aria-pressed="false">On the table</button><span style="width:10px"></span>${looks}</div></div>
<div class="stage"><div class="plane" id="plane">
<svg class="ground" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The atlas of ${esc(title)}"><defs>${symbols}<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${P.stars ? Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 137.5) % W}" cy="${(i * 89.3) % H}" r="${(i % 3) * 0.4 + 0.5}" fill="#dbe8ff" opacity="${0.25 + (i % 5) * 0.1}"/>`).join('') : ''}${ground.join('')}</svg>
${things.map(sprite).join('')}
</div></div>
<div class="legend"><span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.trail}" stroke-width="3"/></svg>a level's trail</span><span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.road}" stroke-width="2.4" stroke-dasharray="9 5"/></svg>a road</span><span><svg width="34" height="10"><path d="M2 5 h30" stroke="${P.road}" stroke-width="2.4" stroke-dasharray="1.5 5" stroke-linecap="round"/></svg>a gate</span><span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/></svg>a stage</span><span><svg width="14" height="14"><path d="M1 12 L7 1 L13 12 Z" fill="${P.paper}" stroke="${P.ink}" stroke-width="1.6"/></svg>a climb</span><span>${esc(ATLAS_LOOKS[look].read)}</span></div>
<script>
(() => {
  const plane = document.getElementById('plane'), root = document.documentElement, btn = [...document.querySelectorAll('[data-view]')];
  let tilt = 0, turn = 0;
  const set = () => { root.style.setProperty('--tilt', tilt + 'deg'); root.style.setProperty('--turn', turn + 'deg'); };
  btn.forEach((b) => b.addEventListener('click', () => { const table = b.dataset.view === 'table'; tilt = table ? 52 : 0; if (!table) turn = 0; btn.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); set(); }));
  let x0 = null;
  plane.addEventListener('pointerdown', (e) => { if (!tilt) return; x0 = e.clientX; plane.classList.add('drag'); plane.setPointerCapture(e.pointerId); });
  plane.addEventListener('pointermove', (e) => { if (x0 === null) return; turn += (e.clientX - x0) * 0.3; x0 = e.clientX; set(); });
  const up = () => { x0 = null; plane.classList.remove('drag'); };
  plane.addEventListener('pointerup', up); plane.addEventListener('pointercancel', up);
})();
</script></body></html>`;
}
