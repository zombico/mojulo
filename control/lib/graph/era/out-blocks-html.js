/**
 * THE BLOCK INDEX, drawn — the shapes blocks are made of, and a library's blocks: each block at its ring and the other
 * two (what the eye spot keeps, what goes to the tile), from little to many, an automation through its cycle, the
 * functions it reads as doing, its laws and its parts. Painted in a kit by a finish (era/blocks.js). Pure.
 */
import { PRIMITIVES, PRIMITIVE_IDS, FUNCTIONS, TIERS, FINISHES, TECH_GROUPS, buildBlock, blockLaws, blockPaint } from './blocks.js';
import { STARTER_BLOCKS } from './tech-blocks.js';
import { drawStructures } from './out-structures-draw.js';
import { STRUCTURE_RING_IDS } from './out-structures.js';
import { CSS } from './out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v));
const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
const STEPS = [0, 0.25, 0.5, 0.75, 1];

// each primitive as a one-part block, at a size that shows what it is
const DEMO = {
  box: { size: [2, 1.4, 1.6], seams: 0.5 }, drum: { r: 0.8, h: 1.8, sides: 12 }, tube: { r: 0.2, from: [0, 0, 0], to: [1.4, 0, 1.6] },
  cone: { r: 0.9, r2: 0.3, h: 1.4, sides: 10 }, dish: { r: 1.1, depth: 0.4, aim: [0.4, -0.6, 0.7] }, truss: { from: [0, 0, 0], to: [0, 0, 3], w: 0.8, member: 0.2, bays: 4 },
  panel: { size: [2, 1.2], t: 0.08, aim: [0, -0.6, 0.8], seams: 0.4 }, wheel: { r: 0.6, w: 0.4 }, track: { len: 2.6, r: 0.4, w: 0.8 },
  arm: { segs: [1.2, 1], bend: [20, 70], r: 0.15 }, fin: { l: 1.6, h: 1.1, t: 0.08 }, lamp: { r: 0.3 }, ring: { r: 0.9, tube: 0.12, axis: 'y' },
};
const demoBlock = (id) => ({ id: `demo-${id}`, read: PRIMITIVES[id].read, tier: 'part', mounts: ['ground'], parts: [{ id, prim: id, ...DEMO[id], group: id === 'lamp' ? 'str:accent' : id === 'panel' ? 'tech:glass' : 'tech:body', value: id === 'panel' ? 0.2 : 0.65 }] });

function primitivesCard(paint) {
  return `<div class="card"><h3>Primitives</h3><p class="note">The shapes a block is made of. Code lands here and only here; everything above is data.</p><div class="views">${PRIMITIVE_IDS.map((id) => {
    const b = buildBlock(demoBlock(id), { ring: 'near' });
    return fig(drawStructures([b.faces], { paint, w: 150, h: 130 }), `<b>${esc(id)}</b><br><span class="note">${esc(Object.entries(PRIMITIVES[id].rails).map(([k, r]) => `${k} ${n2(r[0])}–${n2(r[1])}`).join(' · '))}</span>`);
  }).join('')}</div></div>`;
}

const lawRows = (laws) => laws.map((l) => `<tr><td>${l.ok ? '✓' : '<b>advises</b>'}</td><td><code>${esc(l.law)}</code></td><td>${esc(l.want)}</td><td class="note">${esc(l.value)}</td></tr>`).join('');

/** One block: at its ring, the rings, little to many, its cycle, its reads, its laws, its parts. */
export function blockCard(B, { library = STARTER_BLOCKS, paint, seed = 1 } = {}) {
  const T = TIERS[B.tier], b = buildBlock(B, { seed, library }), laws = blockLaws(B, b);
  const at = (o) => buildBlock(B, { seed, library, ...o });
  const hero = fig(drawStructures([b.faces], { paint, w: 300, h: 230 }), `${esc(b.ring)} · ${b.counted} faces`);
  const front = fig(drawStructures([b.faces], { paint, view: 'front', w: 220, h: 230 }), 'face on');
  const rings = STRUCTURE_RING_IDS.map((rg) => { const x = at({ ring: rg }); return fig(drawStructures([x.faces.filter((f) => !f.tile)], { paint, w: 130, h: 110 }), `${rg} · ${x.counted} faces · ${x.parts.filter((p) => p.shown === 'tile').map((p) => p.id).join(', ') || 'nothing'} to the tile`); }).join('');
  const many = STEPS.map((m) => at({ many: m })), ppm = null;
  const manyRow = many.map((x, i) => fig(drawStructures([x.faces], { paint, w: 130, h: 110, ppm }), `many ${STEPS[i]} · ${x.counted}`)).join('');
  const cycle = B.cycle ? (() => { const [lo, hi] = B.params[B.cycle]; return [0, 0.5, 1].map((t) => { const v = lo + (hi - lo) * t; return fig(drawStructures([at({ params: { ...b.params, many: undefined, [B.cycle]: v } }).faces], { paint, w: 150, h: 120, view: 'plan' }), `${esc(B.cycle)} ${n2(v)}`); }).join(''); })() : '';
  const reads = (B.functions ?? []).map((f) => `<li><b>${esc(f)}</b>: ${esc(FUNCTIONS[f].read)}</li>`).join('');
  const parts = b.parts.map((p) => `<tr><td><code>${esc(p.id)}</code></td><td>${esc(p.prim ?? `▸ ${p.block}`)}</td><td>${esc(p.role ?? '')}</td><td>${n2(p.least)} m</td><td>${esc(p.shown)}${p.n > 1 ? ` × ${p.n}` : ''}</td><td>${(B.sig ?? []).includes(p.id) ? 'signature' : ''}</td></tr>`).join('');
  const params = Object.entries(b.params).map(([k, v]) => `<code>${esc(k)}</code> ${n2(v)}${B.params?.[k] ? ` <span class="note">(${esc(typeof B.params[k][0] === 'number' ? `${n2(B.params[k][0])}–${n2(B.params[k][1])}` : B.params[k].join(' | '))})</span>` : ''}`).join(' · ');
  return `<div class="card" id="block-${esc(B.id)}"><h3>${esc(B.id)} <span class="badge">${esc(B.tier)}</span>${laws.every((l) => l.ok) ? '' : ' <span class="badge solid">advises</span>'}</h3>
<p class="note">${esc(B.read)}. Mounts: ${esc(B.mounts.join(', '))}. Judged at ${esc(T.ring)} (${esc(T.read)}).</p>
<div class="views">${hero}${front}</div>
${reads ? `<p class="note" style="margin-top:8px">READS AS</p><ul>${reads}</ul>` : ''}
<p class="note" style="margin-top:8px">RINGS: what the eye spot keeps as geometry at each distance</p><div class="views">${rings}</div>
<p class="note" style="margin-top:8px">LITTLE TO MANY: the block's own dial</p><div class="views many">${manyRow}</div>
${cycle ? `<p class="note" style="margin-top:8px">CYCLE: the pose its automation sweeps, from above</p><div class="views">${cycle}</div>` : ''}
<div class="grid g2" style="margin-top:10px"><div><table><tr><th></th><th>law</th><th>wants</th><th>measured</th></tr>${lawRows(laws)}</table><p class="note">${params}</p></div>
<div><table><tr><th>part</th><th>made of</th><th>role</th><th>least</th><th>shown</th><th></th></tr>${parts}</table></div></div></div>`;
}

/** The block index as one page. */
export function outBlocksHtml({ seed = 1, kitId = 'isekai-meadow', finish = 'alloy', library = STARTER_BLOCKS } = {}) {
  const paint = blockPaint(kitId, finish);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Block Index</title><style>${CSS}svg{max-width:100%;height:auto}</style></head><body><div id="page">
<h1>BLOCK INDEX</h1>
<p class="lede">What a civilization makes things from: shapes in code, blocks in data, things from blocks. A block is a rule over its params: the parts it is made of, the functions it reads as doing, where it mounts. Every part is gated by the eye spot at its ring (what is too small to see goes to the tile), and a thing's laws say whether it reads. Look and function only. Drawn in ${esc(kitId)}, finished in ${esc(finish)} (${esc(FINISHES[finish].read)}), at seed ${seed}.</p>
<h2>Primitives</h2>${primitivesCard(paint)}
<h2>Blocks</h2>${Object.values(library).map((B) => blockCard(B, { library, paint, seed })).join('')}
<h2>Functions</h2><div class="card"><table>${Object.entries(FUNCTIONS).map(([k, f]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(f.read)}</td><td class="note">${esc(f.reads.map((r) => r.join(' or ')).join(' + '))}</td></tr>`).join('')}</table></div>
<h2>Finish</h2><div class="card"><table>${Object.keys(TECH_GROUPS).map((g) => `<tr><td><code>${esc(g)}</code></td><td>${esc(TECH_GROUPS[g])}</td><td class="note">${esc(paint.names[g])}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}
