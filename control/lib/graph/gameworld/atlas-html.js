/**
 * THE ATLAS PAGE — a gameworld's atlas (atlas.js) as one page, in HTML and CSS alone: the ground an SVG and the things
 * on it a layer of sprites. Flat, it reads as a map; on the table (a CSS-3D tilt), the ground lies back and every sprite
 * stands up off it, turned to the eye as the table is turned by drag. No WebGL, no canvas, no library.
 *
 * A map is DEPICTED: the same layout drawn as a kind of map, each kind with its looks.
 *   illustrated   a drawn map of a made-up world (atlas-illustrated.js): painted, ink, night
 *   tactical      a modern operations map (atlas-tactical.js): ops, nvg, command
 *
 *   gameworldAtlasHtml(world, { look? })   → one self-contained page
 *   ATLAS_DEPICTIONS, ATLAS_LOOKS, ATLAS_LOOK_IDS
 *
 * A look is a depiction's paint: every look of every depiction lays the same map. Pure: the same world, the same page.
 */
import { designAtlas } from './atlas.js';
import { ILLUSTRATED_LOOKS, illustrated } from './atlas-illustrated.js';
import { TACTICAL_LOOKS, tactical } from './atlas-tactical.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const ATLAS_DEPICTIONS = Object.freeze({
  illustrated: { read: 'a drawn map of a made-up world: provinces, woods and peaks, a walled hub, roads and gates', looks: ILLUSTRATED_LOOKS, draw: illustrated },
  tactical: { read: 'a modern operations map: contours and a grid, each level an area of operations, its trail a route of checkpoints, phase lines on the roads, the objective', looks: TACTICAL_LOOKS, draw: tactical },
});
export const ATLAS_LOOKS = Object.freeze(Object.fromEntries(Object.entries(ATLAS_DEPICTIONS).flatMap(([dep, D]) => Object.entries(D.looks).map(([id, card]) => [id, { ...card, depiction: dep }]))));
export const ATLAS_LOOK_IDS = Object.freeze(Object.keys(ATLAS_LOOKS));

export function gameworldAtlasHtml(world, { look = 'painted' } = {}) {
  if (!ATLAS_LOOKS[look]) throw new Error(`atlas: look is one of ${ATLAS_LOOK_IDS.join(', ')}`);
  const A = designAtlas(world), dep = ATLAS_LOOKS[look].depiction, D = ATLAS_DEPICTIONS[dep].draw(A, look), P = D.paint, { W, H } = A;
  const title = A.name ?? 'The world';
  const sprite = (t) => `<i class="sp" style="left:${((t.at[0] / W) * 100).toFixed(2)}%;top:${((t.at[1] / H) * 100).toFixed(2)}%;--s:${t.s}"><svg viewBox="0 0 40 40"><use href="#${t.kind}"/></svg></i>`;
  // the looks, by the depiction each draws
  const looks = Object.entries(ATLAS_DEPICTIONS).map(([d, X]) => `<span class="dep" title="${esc(X.read)}">${d}</span>${Object.keys(X.looks).map((l) => `<a href="?book=atlas&amp;look=${l}"${l === look ? ' aria-current="page"' : ''}>${l}</a>`).join('')}`).join('<span class="gap"></span>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Atlas</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${D.fonts}&display=swap">
<style>
:root{--paper:${P.paper};--edge:${P.paperEdge};--ink:${P.ink};--label:${P.label};--tilt:0deg;--turn:0deg}
*{box-sizing:border-box}body{margin:0;background:${P.paperEdge};color:var(--ink);font:15px/1.4 ${D.body}}
.bar{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between;padding:12px 16px}
.bar h1{margin:0;font:400 22px ${D.head};letter-spacing:.06em;color:var(--label)}
.ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.ctl a,.ctl button{font:inherit;font-size:14px;color:var(--label);background:transparent;border:1px solid var(--ink);border-radius:3px;padding:4px 10px;cursor:pointer;text-decoration:none}
.ctl [aria-current],.ctl [aria-pressed="true"]{background:var(--ink);color:var(--paper)}.ctl .dep{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--label);opacity:.7;margin-left:4px}.ctl .gap{width:10px}
.stage{perspective:1600px;perspective-origin:50% 30%;padding:0 16px 28px;overflow:hidden;touch-action:none}
.plane{position:relative;width:min(100%,${W}px);aspect-ratio:${W}/${H};margin:0 auto;transform-style:preserve-3d;transform:rotateX(var(--tilt)) rotateZ(var(--turn));transition:transform .9s cubic-bezier(.3,.7,.2,1);box-shadow:0 18px 40px rgba(0,0,0,.35);background:radial-gradient(ellipse at 50% 45%,var(--paper) 55%,var(--edge))}
.plane.drag{transition:none}
.ground{position:absolute;inset:0;width:100%;height:100%}
.sp{position:absolute;width:calc(${D.spriteW}% * var(--s));aspect-ratio:1;transform-origin:50% 100%;transform:translate(-50%,-100%) rotateZ(calc(-1 * var(--turn))) rotateX(calc(-1 * var(--tilt)));transition:transform .9s cubic-bezier(.3,.7,.2,1);pointer-events:none}
.plane.drag .sp{transition:none}.sp svg{width:100%;height:100%;overflow:visible;display:block}
.prov{transition:opacity .2s}.prov:hover{opacity:1;stroke-width:2.2}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;padding:0 16px 24px;font-size:14px;color:var(--label);justify-content:center}.legend span{display:inline-flex;gap:6px;align-items:center}
${D.css}
@media (max-width:700px){.bar h1{font-size:18px}}
</style></head><body>
<div class="bar"><h1>${esc(title)}</h1><div class="ctl"><button type="button" data-view="flat" aria-pressed="true">Flat</button><button type="button" data-view="table" aria-pressed="false">On the table</button><span class="gap"></span>${looks}</div></div>
<div class="stage"><div class="plane" id="plane">
<svg class="ground" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The atlas of ${esc(title)}"><defs>${D.symbols}<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>${D.defs ?? ''}</defs>${D.ground}</svg>
${D.sprites.map(sprite).join('')}${D.over ?? ''}
</div></div>
<div class="legend">${D.legend}</div>
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
