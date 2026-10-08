/**
 * THE LAND INDEX, drawn — the natural world as designed forms on one page, beside the flora index: each form's
 * variants, a seed's variation inside the rails, its little-to-many steps, the reveal levels and what each costs, its
 * dials; and one set of forms skinned in every kit. Data: era/out-land.js and era/style/swatches.js. `outLandHtml(opts)`
 * and `drawLand(d, kit)` are pure.
 */
import { LAND_FORMS, LAND_FORM_IDS, LAND_LEVELS, LAND_LAWS, LAND_PARTS, designLand, landLaws } from './out-land.js';
import { SWATCHES, hexOfRgb } from './style/swatches.js';
import { CSS } from './out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v));
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SUN = unit([-0.45, -0.6, 0.66]);
/** The kits that carry land ramps; a kit drawn from tinted textures borrows the meadow's to be drawn at all. */
export const LAND_KITS = Object.freeze(Object.keys(SWATCHES).filter((k) => SWATCHES[k].land));
const rampsOf = (kitId) => (SWATCHES[kitId]?.land ? SWATCHES[kitId].land : SWATCHES['isekai-meadow'].land);

/**
 * A land form in a kit's swatches, seen from above and to the left (or face on, `view: 'front'`): faces culled and
 * sorted far to near, each its part's ramp stop, a stop up or down where it faces the sun or away. `ppm` fixes the
 * scale (pixels a metre) so a row compares sizes.
 */
const VIEWS = { axon: [-0.55, 0.5], front: [0, 0.12], three: [-0.42, 0.22], low: [-0.55, 0.32] };
function frame(d, view, lift) {
  const [yaw, pitch] = VIEWS[view] ?? VIEWS.axon;
  const D = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), -Math.sin(pitch)], R = unit([D[1], -D[0], 0]), U = [R[1] * D[2] - R[2] * D[1], R[2] * D[0] - R[0] * D[2], R[0] * D[1] - R[1] * D[0]];
  const P = (p) => [p[0], p[1], p[2] * lift];
  const faces = d.faces.map((f) => ({ ...f, corners: f.corners.map(P), normal: lift === 1 ? f.normal : unit([f.normal[0], f.normal[1], f.normal[2] / lift]) })).filter((f) => dot(f.normal, D) < 0.02);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of faces) for (const p of f.corners) { const sx = dot(p, R), sy = -dot(p, U); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  if (!faces.length) { x0 = y0 = 0; x1 = y1 = 1; }
  return { D, R, U, faces, x0, x1, y0, y1 };
}
/** The pixels a metre that fits `d` in w × h: rows that compare (a little-to-many strip) take the least of theirs. */
export const landFit = (d, { w = 180, h = 140, view = 'axon', lift = 1 } = {}) => { const F = frame(d, view, lift); return Math.min((w - 12) / Math.max(0.01, F.x1 - F.x0), (h - 12) / Math.max(0.01, F.y1 - F.y0)); };

export function drawLand(d, kitId, { w = 180, h = 140, ppm = null, view = 'axon', sky = false, lift = 1 } = {}) {
  const land = rampsOf(kitId), { D, R, U, faces, x0, x1, y0, y1 } = frame(d, view, lift);
  const k = ppm ?? Math.min((w - 12) / Math.max(0.01, x1 - x0), (h - 12) / Math.max(0.01, y1 - y0));
  const ox = w / 2 - ((x0 + x1) / 2) * k, oy = h / 2 - ((y0 + y1) / 2) * k;
  const depth = (f) => f.corners.reduce((s, p) => s + dot(p, D), 0) / f.corners.length;
  const polys = faces.map((f) => ({ f, z: depth(f) })).sort((a, b) => b.z - a.z).map(({ f }) => {
    const ramp = land[LAND_PARTS[f.part].role] ?? land.rock, n = ramp.length, lam = dot(f.normal, SUN);
    const stop = Math.max(0, Math.min(n - 1, Math.round(f.value * (n - 1)) + (lam > 0.55 ? 1 : lam < 0.05 ? -1 : 0)));
    const col = hexOfRgb(ramp[stop]);
    return `<polygon points="${f.corners.map((p) => `${(ox + dot(p, R) * k).toFixed(1)},${(oy - dot(p, U) * k).toFixed(1)}`).join(' ')}" fill="${col}" stroke="${col}" stroke-width="0.5" stroke-linejoin="round"/>`;
  }).join('');
  const bg = sky ? `<rect width="${w}" height="${h}" fill="${hexOfRgb((land.sky ?? land.far)[Math.min(1, (land.sky ?? land.far).length - 1)])}"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(`${d.dials.form} ${d.dials.variant}`)}">${bg}${polys}</svg>`;
}

const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
const lawLine = (d) => { const l = landLaws(d); return l.length ? ` <span class="badge solid">${esc(l.map((x) => x.law).join(', '))}</span>` : ''; };
const viewOf = (form) => (form === 'strata' ? 'front' : form === 'face' ? 'three' : form === 'landscape' ? 'low' : 'axon');
// the landscape is drawn with its heights doubled, so a swath's relief reads at a page's scale
const liftOf = (form) => (form === 'landscape' ? 2 : 1);
const opts = (form, w, h) => ({ w, h, view: viewOf(form), sky: skyOf(form), lift: liftOf(form) });
/** Draw a row of designs of one form at one scale: the least of their fits. */
const row = (form, designs, kitId, w, h) => { const o = opts(form, w, h), ppm = Math.min(...designs.map((d) => landFit(d, o))); return designs.map((d) => drawLand(d, kitId, { ...o, ppm })); };
const skyOf = (form) => form === 'cloud';
const STEPS = [0, 0.25, 0.5, 0.75, 1];

/** A form's little-to-many strip in a kit: the five steps of its dial, `mark` the step a world chose. */
export function manyStrip(form, variant, kitId, seed, { mark = null, w = 120, h = 92, level = 'mid' } = {}) {
  const F = LAND_FORMS[form], svgs = row(form, STEPS.map((m) => designLand(form, variant, seed, { level, many: m })), kitId, w, h);
  return svgs.map((svg, i) => `<figure class="${mark === i ? 'mark' : ''}">${svg}<figcaption>${esc(F.many.words[i])}</figcaption></figure>`).join('');
}

function formCard(id, kitId, seed) {
  const F = LAND_FORMS[id], variants = Object.keys(F.variants), v1 = variants[0];
  const vd = variants.map((v) => designLand(id, v, seed, { level: 'near' }));
  const variantsRow = vd.map((d, i) => fig(drawLand(d, kitId, opts(id, 190, 150)), `${esc(variants[i])} · ${n2(Math.max(...d.elements.map((e) => e.size)))} m${lawLine(d)}`)).join('');
  const sd = Array.from({ length: 7 }, (_, i) => designLand(id, v1, seed + 11 * (i + 1), { level: 'mid' }));
  const sweep = row(id, sd, kitId, 120, 96).map((svg, i) => fig(svg, `seed ${seed + 11 * (i + 1)}`)).join('');
  const ld = ['near', 'mid', 'far'].map((lv) => designLand(id, v1, seed, { level: lv }));
  const levels = ld.map((d, i) => fig(drawLand(d, kitId, opts(id, 130, 104)), `${d.level} · ${d.faces.length} faces / ${LAND_LEVELS[d.level].budget}${lawLine(d)}`)).join('');
  const rails = Object.entries(F.rails).map(([k, r]) => `<tr><td><code>${esc(k)}</code>${k === F.many.dial ? ' <span class="badge">little → many</span>' : ''}</td><td>${n2(r[0])}–${n2(r[1])}</td>${variants.map((v) => { const x = F.variants[v][k]; return `<td>${x == null ? '<span class="note">·</span>' : `${n2(x[0])}–${n2(x[1])}`}</td>`; }).join('')}</tr>`).join('');
  return `<div class="card" id="land-${esc(id)}"><h3>${esc(id)}</h3><p class="note">${esc(F.read)}. Makes: ${esc(F.makes.join(', '))}.</p>
<div class="views">${variantsRow}</div>
<p class="note" style="margin-top:10px">LITTLE TO MANY: <b>${esc(F.many.dial)}</b> from its least to its most, in five steps a world chooses from</p><div class="views many">${manyStrip(id, v1, kitId, seed)}</div>
<p class="note" style="margin-top:10px">VARIATION: seven seeds of <b>${esc(v1)}</b>, every dial rolled inside its rails</p><div class="views">${sweep}</div>
<div class="grid g2" style="margin-top:10px"><div><p class="note">LEVELS: built by reveal ring, each inside its face budget</p><div class="views">${levels}</div></div>
<div><table><tr><th>dial</th><th>rail</th>${variants.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>${rails}</table></div></div></div>`;
}

function skinCard(seed) {
  const set = [['landscape', 'meadow'], ['rock', 'tor'], ['strata', 'folded'], ['face', 'columnar'], ['cloud', 'cumulus'], ['landmark', 'arch']];
  const rows = LAND_KITS.map((k) => `<tr><td style="white-space:nowrap"><b>${esc(k)}</b></td><td><div class="views">${set.map(([f, v]) => drawLand(designLand(f, v, seed, { level: 'mid' }), k, opts(f, 120, 92))).join('')}</div></td></tr>`).join('');
  return `<div class="card"><h3>One set, every kit</h3><p class="note">The same six forms at the same seed, each kit's ramps on its parts (${esc(Object.entries(LAND_PARTS).map(([p, v]) => `${p} → ${v.role}`).join(', '))}). Nothing else changes.</p><table>${rows}</table></div>`;
}

/** The land index as one page. */
export function outLandHtml({ seed = 8, kitId = 'isekai-meadow' } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Land Index</title><style>${CSS}.many figure.mark svg{outline:3px solid var(--ink);outline-offset:2px}</style></head><body><div id="page">
<h1>LAND INDEX</h1>
<p class="lede">The natural world as designed forms: shapes built for look, read and cost, not geology. Six forms make the land a kit needs: the lie of the ground, rock formations, the sediment in a cliff, what a cliff's face is built of, clouds, and natural landmarks. Each is a few primitives under a few dials, built in values on named parts and skinned by a kit's swatches. Each has a little-to-many dial a world chooses a step of. Drawn in ${esc(kitId)} at seed ${seed}. No creatures: what lives on the land is left open.</p>
<h2>Forms</h2>${LAND_FORM_IDS.map((id) => formCard(id, kitId, seed)).join('')}
<h2>Skins</h2>${skinCard(seed)}
<h2>Laws</h2><div class="card"><table>${LAND_LAWS.map((l) => `<tr><td><b>${esc(l.id)}</b></td><td>${esc(l.want)}</td><td class="note">${esc(l.why)}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}
