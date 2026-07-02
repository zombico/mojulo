/**
 * scene-css3d — emit mojulo world geometry as a live, dependency-free CSS
 * `preserve-3d` HTML scene (the "second backend" alongside the SVG renderers).
 *
 * The SVG renderers flatten world geometry to 2D via projectTwoPoint. This keeps
 * it 3D: every planar face becomes a positioned `<div>` (one `matrix3d`), the
 * camera becomes a `matrix3d` + `perspective`, and the browser does projection +
 * occlusion + a movable camera. Output is one self-contained HTML string — no
 * runtime dependency, plays anywhere an <img>/<iframe> goes.
 *
 * Eligibility (caller's responsibility): planar faces, non-interpenetrating,
 * separated, under a face budget. Ineligible scenes (organic/curved/inter-
 * penetrating/per-pixel-lit-while-rotating) belong on the baked forge_motion path.
 *
 * Scope today: the ROOM scene, consumed from the clean world-space planner
 * (resolveRoomSceneElementPlan / resolveRoomSurfaces), which exposes 3D corners
 * without projection. Wiring production two-point room manji-trees needs a
 * world-geometry accessor factored out of neo-rembrandt's generateTwoPointRoomMarks
 * (which projects inline) — see SCOPE notes.
 *
 * Lighting: vexar Lambert is baked per face. Correct for translating (walk-through)
 * cameras — Lambert depends on the face normal vs the world light, not the camera.
 */

import { makeLight, litFactor, scaleHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import {
  resolveRoomSurfaces,
  resolveRoomSceneElementPlan,
  roomSceneRenderElements,
} from '../polygonizer/room-scene-elements.js';
import { planArchitectureMandala } from '../polygonizer/architecture-mandala-planner.js';
import { getFurnitureNet, getFurnitureFaceCard } from '../polygonizer/furniture-cards.js';
import { bakeDiffusion3d, applyDiffusion, bakeDiffusionField, applyDiffusionSoft, emissiveFixture } from '../effects/light-diffusion-3d.js';
import { makeFacade, facadeCss, facadeHtml, facadeFloors, facadeBays, buildingExtras } from '../architecture/building-facade.js';
import { buildFacadeCard } from '../architecture/facade-card.js';
import { buildTerrainWorldMesh } from '../polygonizer/painted-landscape.js';
import { skyCss } from './sky-css.js';
import { isLandmarkShape, renderLandmarkBuilding } from '../landmarks/index.js';
import { isPlantShape, plantBoxToFaces } from '../polygonizer/plant-faces.js';
import { roomFurnitureAssetFaces } from '../architecture/room-assets.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { buildRoof } from '../architecture/roof.js';

// ── vector helpers ──────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const centroid = (pts) => scale(pts.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / pts.length);

/** Face normal from 4 coplanar corners, flipped to point toward `towardPt`. */
function normalToward(corners, towardPt) {
  let n = norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (towardPt && dot(n, sub(towardPt, centroid(corners))) < 0) n = scale(n, -1);
  return n;
}

/**
 * Reorder a quad's winding so the emitter's front face (local z = U×V, where
 * U=c1-c0, V=c3-c0) points toward `towardPt`. Without this a back-wall decal's
 * front points away from the room and `backface-visibility:hidden` culls it.
 */
function windToward(corners, towardPt) {
  const n = cross(sub(corners[1], corners[0]), sub(corners[3], corners[0]));
  if (dot(n, sub(towardPt, centroid(corners))) < 0) return [corners[0], corners[3], corners[2], corners[1]];
  return corners;
}

// ── matrix3d builders ────────────────────────────────────────────────────────
const m3d = (c) => `matrix3d(${c.map((n) => n.toFixed(5)).join(',')})`;

/** A plane div placed in world: local x→u, local y→v, local z→normal, origin at c0. */
function planeMatrix(c0, uVec, vVec, unitScale) {
  const U = norm(uVec), V = norm(vVec), n = cross(U, V), o = scale(c0, unitScale);
  return m3d([U[0], U[1], U[2], 0, V[0], V[1], V[2], 0, n[0], n[1], n[2], 0, o[0], o[1], o[2], 1]);
}

/**
 * World→view camera matrix from a `worldFraming` (cameraPosition/lookAt/horizontalFov),
 * baking the perspective-prep so the ancestor `perspective:focal` does the divide.
 * z-up world. Returns { matrix, perspective, center }.
 */
export function cameraMatrixFromWorldFraming(worldFraming = {}, viewBox = {}, unitScale = 1) {
  const pos = worldFraming.cameraPosition || [0, -10, 4];
  const look = worldFraming.lookAt || [0, 0, 2];
  const fov = Number(worldFraming.horizontalFov) || 60;
  const W = Number(viewBox.width) || 1080;
  const H = Number(viewBox.height) || 720;
  // Match projectTwoPointPinhole's basis exactly: right = worldUp × forward,
  // up = forward × right (a flipped right axis mirrors the scene).
  const f = norm(sub(look, pos));
  const r = norm(cross([0, 0, 1], f));
  const u = cross(f, r);
  const focal = (W / 2) / Math.tan((fov * Math.PI / 180) / 2);
  const p = scale(pos, unitScale);
  const cols = [
    r[0], -u[0], -f[0], 0,
    r[1], -u[1], -f[1], 0,
    r[2], -u[2], -f[2], 0,
    -dot(r, p), dot(u, p), focal + dot(f, p), 1,
  ];
  const center = Array.isArray(worldFraming.pictureCenter) ? worldFraming.pictureCenter : [W / 2, H / 2];
  return { matrix: m3d(cols), perspective: focal, center };
}

/**
 * Project a world point to screen pixels for a `worldFraming`, using the SAME
 * pinhole basis as cameraMatrixFromWorldFraming / projectTwoPointPinhole — so a
 * signage overlay div lands exactly where the projected face it annotates does.
 * unitScale cancels in the ratio, so it isn't needed. Returns { x, y, behind }.
 */
export function projectWorldToScreen(worldPt, worldFraming = {}, viewBox = {}) {
  const pos = worldFraming.cameraPosition || [0, -10, 4];
  const look = worldFraming.lookAt || [0, 0, 2];
  const fov = Number(worldFraming.horizontalFov) || 60;
  const W = Number(viewBox.width) || 1080;
  const H = Number(viewBox.height) || 720;
  const f = norm(sub(look, pos));
  const r = norm(cross([0, 0, 1], f));
  const u = cross(f, r);
  const focal = (W / 2) / Math.tan((fov * Math.PI / 180) / 2);
  const center = Array.isArray(worldFraming.pictureCenter) ? worldFraming.pictureCenter : [W / 2, H / 2];
  const V = sub(worldPt, pos);
  const fwd = dot(V, f);
  if (fwd <= 1e-3) return { x: center[0], y: center[1], behind: true };
  return {
    x: center[0] + (dot(V, r) / fwd) * focal,
    y: center[1] - (dot(V, u) / fwd) * focal,
    behind: false,
  };
}

// ── adaptive-signage overlay (CSS-3D) ─────────────────────────────────────────
// Cameras here are STATIC presets switched by buttons, so a world anchor is
// projected to screen ONCE PER CAMERA at emit time (this is billboarding for a
// preset-shot scene: a flat screen overlay div always faces the viewer). setCam
// repositions the world-anchored signs; slot/xy signs are camera-independent CSS.
const escSign = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT_CLASS = new Set(['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right']);

function signCardCss(c) {
  const shadow = c.glow && c.glow !== 'none' ? c.glow : (c.shadow && c.shadow !== 'none' ? c.shadow : 'none');
  return `background:${c.bg};color:${c.color};border:${c.border};border-radius:${c.radius};box-shadow:${shadow};font-family:${c.font};font-size:${c.fontSize}px;font-weight:${c.fontWeight};padding:${c.padding};`;
}

/** Build the CSS + DOM + script + per-camera positions for a resolved signs[]. */
function buildSignageLayer(signs, cameras, viewBox) {
  const camSigns = cameras.map((cam) => {
    const out = {};
    for (const s of signs) {
      if (s.anchor.kind !== 'world') continue;
      const p = projectWorldToScreen(s.anchor.world, cam.worldFraming, viewBox);
      out[s.id] = [Math.round(p.x), Math.round(p.y), p.behind ? 1 : 0];
    }
    return out;
  });

  const dom = signs.map((s) => {
    const isWorld = s.anchor.kind === 'world';
    // object (unresolved at emit) → degrade to a top slot; xy → fixed point.
    const slot = s.anchor.kind === 'slot' ? s.anchor.slot
      : s.anchor.kind === 'object' ? 'top' : null;
    const posCls = isWorld ? 'moj-sign-world'
      : s.anchor.kind === 'xy' ? 'moj-sign-pt'
        : `moj-slot-${SLOT_CLASS.has(slot) ? slot : 'top'}`;
    const inlinePos = s.anchor.kind === 'xy' ? `left:${Math.round(s.anchor.xy[0])}px;top:${Math.round(s.anchor.xy[1])}px;` : '';
    const attrs = `data-sign-id="${escSign(s.id)}" data-variant="${s.variant}" data-after="${s.after}" data-ttl="${s.ttl}"`;

    if (s.variant === 'tooltip') {
      const accent = s.chrome.border && s.chrome.border.includes('rgba') ? s.chrome.border.replace(/^[^,]*\s/, '').replace(/;$/, '') : '#9cc4ff';
      return `<div class="moj-sign moj-sign--tooltip ${posCls}" ${attrs} tabindex="0" style="${inlinePos}"><span class="moj-dot" style="background:${accent}"></span><div class="moj-tip" style="${signCardCss(s.chrome)}">${escSign(s.text)}</div></div>`;
    }
    if (s.variant === 'popup') {
      const perPage = s.pageLines || 4;
      const pages = [];
      for (let i = 0; i < s.body.length; i += perPage) pages.push(s.body.slice(i, i + perPage));
      const pagesHtml = (pages.length ? pages : [[s.text || '']]).map(
        (pg, pi) => `<div class="moj-pg${pi === 0 ? ' on' : ''}">${pg.map((l) => `<div>${escSign(l)}</div>`).join('')}</div>`,
      ).join('');
      const footer = pages.length > 1
        ? `<button class="moj-pg-down" aria-label="more">▾ <span class="moj-pg-ind">1/${pages.length}</span></button>` : '';
      return `<div class="moj-sign moj-sign--popup ${posCls}" ${attrs} style="${signCardCss(s.chrome)}${inlinePos}"><div class="moj-pages">${pagesHtml}</div>${footer}</div>`;
    }
    // toast
    const lines = (s.body.length ? s.body : [s.text || '']).map((l) => `<div>${escSign(l)}</div>`).join('');
    return `<div class="moj-sign moj-sign--toast ${posCls}" ${attrs} style="${signCardCss(s.chrome)}${inlinePos}">${lines}</div>`;
  }).join('');

  const css = `
  .stage{position:relative;width:${viewBox.width}px;height:${viewBox.height}px;max-width:100%}
  .moj-signs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .moj-sign{position:absolute;pointer-events:auto;max-width:240px;box-sizing:border-box;line-height:1.4;transition:opacity .18s ease}
  .moj-sign--popup{width:210px}
  .moj-sign--popup.moj-sign-world,.moj-sign--toast.moj-sign-world,.moj-sign--popup.moj-sign-pt,.moj-sign--toast.moj-sign-pt{transform:translate(-50%,calc(-100% - 10px))}
  .moj-sign--tooltip.moj-sign-world,.moj-sign--tooltip.moj-sign-pt{transform:translate(-50%,-50%)}
  .moj-slot-top{left:50%;top:12px;transform:translateX(-50%)}
  .moj-slot-top-left{left:12px;top:12px}.moj-slot-top-right{right:12px;top:12px}
  .moj-slot-center{left:50%;top:50%;transform:translate(-50%,-50%)}
  .moj-slot-bottom{left:50%;bottom:12px;transform:translateX(-50%)}
  .moj-slot-bottom-left{left:12px;bottom:12px}.moj-slot-bottom-right{right:12px;bottom:12px}
  .moj-sign--toast{opacity:0;text-align:center}.moj-sign--toast.show{opacity:1}
  .moj-sign--tooltip{cursor:pointer}
  .moj-dot{display:block;width:11px;height:11px;border-radius:50%;box-shadow:0 0 8px rgba(0,0,0,.4)}
  .moj-tip{position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s ease}
  .moj-sign--tooltip:hover .moj-tip,.moj-sign--tooltip:focus .moj-tip,.moj-sign--tooltip.tapped .moj-tip{opacity:1}
  .moj-pages{overflow:hidden}.moj-pg{display:none}.moj-pg.on{display:block}
  .moj-pg-down{margin-top:6px;color:inherit;background:rgba(255,255,255,.12);border:none;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit}`;

  const script = `
  // adaptive-signage behavior
  document.querySelectorAll('.moj-sign--toast').forEach((el)=>{ const a=+el.dataset.after||0,t=+el.dataset.ttl||2.5; setTimeout(()=>{ el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), t*1000); }, a*1000); });
  document.querySelectorAll('.moj-sign--popup').forEach((el)=>{ const pages=[...el.querySelectorAll('.moj-pg')],ind=el.querySelector('.moj-pg-ind'),btn=el.querySelector('.moj-pg-down'); let i=0; if(btn) btn.addEventListener('click',()=>{ pages[i].classList.remove('on'); i=(i+1)%pages.length; pages[i].classList.add('on'); if(ind) ind.textContent=(i+1)+'/'+pages.length; }); });
  document.querySelectorAll('.moj-sign--tooltip').forEach((el)=>{ el.addEventListener('click',()=>el.classList.toggle('tapped')); });
  function placeSigns(c){ const sp=(c&&c.signs)||{}; document.querySelectorAll('.moj-sign-world').forEach((el)=>{ const p=sp[el.dataset.signId]; if(!p||p[2]){ el.style.display='none'; return; } el.style.display=''; el.style.left=p[0]+'px'; el.style.top=p[1]+'px'; }); }`;

  return { css, dom, script, camSigns };
}

// ── room scene → planar faces ─────────────────────────────────────────────────
const SURFACE_PALETTE = {
  floor: '#6f5a40', ceiling: '#9a866a', backWall: '#7d6750', leftWall: '#8a7058', rightWall: '#705a44',
  // frontWall is omitted by default (shellOmit) — the open camera side. Coloured so an
  // immersive room (shellOmit:[]) can fully enclose; the World auto-hides it when outside.
  frontWall: '#79644e',
};
const LEG_HEX = '#7a5b33';

const surfaceCorners = (s) => [s.origin, add(s.origin, s.uVector), add(s.origin, add(s.uVector, s.vVector)), add(s.origin, s.vVector)];
const bilerp = (c, u, v) => [
  c[0][0] * (1 - u) * (1 - v) + c[1][0] * u * (1 - v) + c[2][0] * u * v + c[3][0] * (1 - u) * v,
  c[0][1] * (1 - u) * (1 - v) + c[1][1] * u * (1 - v) + c[2][1] * u * v + c[3][1] * (1 - u) * v,
  c[0][2] * (1 - u) * (1 - v) + c[1][2] * u * (1 - v) + c[2][2] * u * v + c[3][2] * (1 - u) * v,
];
const isHex = (s) => /^#[0-9a-fA-F]{6}$/.test(String(s));

// Gravity contact-shadow — the world-z attenuation of the lit factor, ported
// verbatim from imperfect-cel.js's gravityLambertOffset: full GRAVITY_DARKEN_AMOUNT
// at the scene base (z=0), ramping to 0 by GRAVITY_DARKEN_HEIGHT. It depends only on
// world-z (not the camera), so baking it per face is correct for a translating
// (walk-through) camera — exactly like vexar Lambert. The renderer subtracts this
// from each face's lit factor (max(0, lambert − offset)), so a piece reads darker
// at its base. Per-part z gives tall furniture a real bottom-to-top gradient.
const GRAVITY_DARKEN_HEIGHT = 5.0, GRAVITY_DARKEN_AMOUNT = 0.20, LAMBERT_GAIN = 0.78;
function gravityOffset(z, sceneBaseZ = 0) {
  const h = z - sceneBaseZ;
  const amount = h >= GRAVITY_DARKEN_HEIGHT ? 0 : h <= 0 ? GRAVITY_DARKEN_AMOUNT : (1 - h / GRAVITY_DARKEN_HEIGHT) * GRAVITY_DARKEN_AMOUNT;
  return amount / LAMBERT_GAIN;
}
const centroidZ = (corners) => corners.reduce((a, c) => a + c[2], 0) / corners.length;

/**
 * Composited baked lighting. vexar's directional Lambert (ambient + diffuse·N·L)
 * gives each volume its DIRECTIONAL mood; `tint` colours it (warm bar / cool
 * daylight); `lamps` add POSITIONED point-lights (Lambert · inverse-square
 * falloff) — the local pools vexar deliberately omits. All terms depend on world
 * geometry only → camera-independent → bakeable, so the look stays correct as the
 * camera moves between stations (the same property that lets vexar bake at all).
 * Returns a closure shade(baseHex, corners, normal) → lit hex.
 */
function makeShade({ light, lamps = [], tint = [1, 1, 1], gravityDarken = true } = {}) {
  const L = light || makeLight({ direction: [0.32, 0.42, -0.84], ambient: 0.58, diffuse: 0.56 });
  const grav = gravityDarken ? gravityOffset : () => 0;
  return (baseHex, corners, normal) => {
    if (!isHex(baseHex)) return baseHex;
    const f = Math.max(0, litFactor(normal, L) - grav(centroidZ(corners)));
    const rgb = hexToRgb(baseHex);
    let r = rgb[0] * tint[0] * f, g = rgb[1] * tint[1] * f, b = rgb[2] * tint[2] * f;
    if (lamps.length) {
      const c = centroid(corners);
      for (const lamp of lamps) {
        const to = sub(lamp.pos, c), d2 = dot(to, to) || 1e-6;
        const at = (lamp.intensity ?? 1) * Math.max(0, dot(normal, norm(to))) / (1 + (lamp.k ?? 0.05) * d2);
        const col = lamp.color || [1, 1, 1];
        r += rgb[0] * col[0] * at; g += rgb[1] * col[1] * at; b += rgb[2] * col[2] * at;
      }
    }
    return rgbToHex([r, g, b]);
  };
}

/**
 * The unified room LIGHTING model. One declarative object carries every layered
 * term; `resolveLighting` normalizes it (and the legacy positional params) into
 * resolved pieces the bakers consume:
 *   { vexar:{direction,ambient,diffuse} | light, tint:[r,g,b], gravity:bool,
 *     lamps:[{at|pos, color, intensity, k}],            // direct, scoped point lights
 *     sources:[{at|pos, height, dir, spread, color, intensity, rays, bounces,
 *               falloff, exposure, fixture, stem, ...}], // TRACED diffusion emitters
 *     diffusion:{ gain, reflectivity } }
 * `at:[fx,fy]`/`height` are fractions of the room footprint/ceiling (explicit `pos`
 * wins), so a lamp or source is authored in the same mandala space as furniture.
 */
function resolveLighting(lighting = {}, ranges = {}) {
  const [x0, x1] = ranges.xRange || [0, 1];
  const [y0, y1] = ranges.yRange || [0, 1];
  const z1 = (ranges.zRange || [0, 1])[1];
  const toWorld = (e) => (Array.isArray(e.pos) ? e.pos : [x0 + (e.at?.[0] ?? 0.5) * (x1 - x0), y0 + (e.at?.[1] ?? 0.5) * (y1 - y0), z1 * (e.height ?? 0.965)]);
  return {
    L: lighting.light || makeLight(lighting.vexar || {}),
    tint: lighting.tint || [1, 1, 1],
    gravity: lighting.gravity ?? lighting.gravityDarken ?? true,
    lamps: (lighting.lamps || []).map((l) => ({ ...l, pos: toWorld(l) })),
    sources: (lighting.sources || []).map((s) => ({ ...s, pos: toWorld(s) })),
    diffusion: lighting.diffusion || {},
  };
}

/** Bake the traced 3D light diffusion over `faces` for `sources`, returning the lit
 *  faces plus each visible source's emissive fixture. Shared by the single-room path
 *  (local bake) and the suite (one bake across all volumes → cross-room spill).
 *  `diffusion.soft` switches the flat per-face value for a soft radial-gradient pool
 *  (blurred edges, smooth spread); `softness`/`maxAlpha` tune it. */
export function bakeSceneDiffusion(faces, sources = [], diffusion = {}) {
  if (!sources.length) return faces;
  const { reflectivity = 0.45, soft = false, softness = 1, maxAlpha = 0.9, shadows = false, shadowStrength = 0.9, shadowMaxAlpha = 0.6 } = diffusion;
  const gain = diffusion.gain ?? (soft ? 2.6 : 1.2);
  let lit;
  if (soft) {
    const field = bakeDiffusionField({ faces, sources, reflectivity, shadows });
    lit = applyDiffusionSoft(faces, field, { gain, softness, maxAlpha, shadowStrength, shadowMaxAlpha });
  } else {
    lit = applyDiffusion(faces, bakeDiffusion3d({ faces, sources, reflectivity }), { gain });
  }
  for (const s of sources) if (s.fixture !== false) lit.push(...emissiveFixture(s, { r: s.fixtureR ?? 0.18 }));
  return lit;
}

/**
 * Moonlight: a cool DIRECTIONAL fill from the moon, added to the base shading so
 * surfaces aligned with the moon (rooftops, the moon-facing sides) catch a blue
 * sheen while the rest stays dark — the cool counterpart to the warm streetlamp
 * pools. `dir` is the light's travel direction (from the moon); the moon's sky
 * position and this should agree. Applied BEFORE the diffusion bake (it's base
 * light); hex-fill faces gain colour, CSS-`bg` faces (facades) get a translucent
 * cool wash whose strength tracks the face's alignment with the moon.
 */
export function applyMoonlight(faces, { dir = [-0.4, -0.28, -0.85], color = [0.58, 0.69, 0.95], intensity = 0.6, ambient = 0.08 } = {}) {
  const toMoon = norm([-dir[0], -dir[1], -dir[2]]);
  const c255 = color.map((c) => Math.round(c * 255));
  return faces.map((f) => {
    const c = f.corners, n = norm(cross(sub(c[1], c[0]), sub(c[3] || c[2], c[0])));
    const k = ambient + intensity * Math.abs(dot(n, toMoon)); // abs → winding-agnostic; rooftops/moon-axis faces read brightest
    if (typeof f.fill === 'string' && f.fill[0] === '#') {
      const b = hexToRgb(f.fill);
      return { ...f, fill: rgbToHex([0, 1, 2].map((i) => Math.min(255, b[i] + c255[i] * k))) };
    }
    if (typeof f.bg === 'string') {
      // multiply-style cool tint: a DARK moonlit-blue layer whose opacity grows as the
      // face turns AWAY from the moon (low k). Moon-facing walls keep their facade colour
      // with a cool sheen; shadowed walls sink toward deep blue — relative hue preserved,
      // unlike a flat bright wash (which desaturated every facade toward the same grey-blue).
      const a = Math.min(0.62, 0.1 + (1 - Math.min(1, k)) * 0.62);
      const dark = `rgba(${Math.round(color[0] * 74)},${Math.round(color[1] * 88)},${Math.round(color[2] * 122)},${a.toFixed(3)})`;
      return { ...f, bg: `linear-gradient(${dark},${dark}), ${f.bg}` };
    }
    return f;
  });
}

/**
 * Contact / ambient-occlusion shadows: a soft dark radial blob laid on the floor
 * DIRECTLY UNDER each elevated piece, there regardless of any light (the seat/top
 * occludes the ambient hemisphere from the floor beneath it). One decal per object,
 * sized to its footprint and fading with height — so multiple objects keep distinct
 * under-shadows instead of blending into one pool. The complement of the directional
 * cast shadow (which lands beside/past the object).
 * @param {Array} footprints  [{ corners: <floor quad>, height }]
 */
export function contactShadowDecals(footprints = [], { strength = 0.5, expand = 1.35, maxAlpha = 0.6, fade = true } = {}) {
  return footprints.map(({ corners, height, offset, expand: ex }) => {
    const c = centroid(corners);
    const e = ex ?? expand;
    const [ox, oy] = offset || [0, 0];               // translate downstream of the light → directional cast feel
    const quad = corners.map((p) => [c[0] + (p[0] - c[0]) * e + ox, c[1] + (p[1] - c[1]) * e + oy, 0.02]);
    // `fade` (default) softens with height — right for low furniture, where a taller piece
    // lifts its ambient-occlusion blob off the floor. City buildings want the OPPOSITE
    // (a tall mass casts a strong shadow), so the city pass calls with fade:false.
    const a = Math.min(maxAlpha, fade ? strength / (1 + (height || 0) * 0.6) : strength);
    const bg = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${a.toFixed(3)}) 0%, rgba(0,0,0,${(a * 0.45).toFixed(3)}) 42%, rgba(0,0,0,0) 80%)`;
    // `decal`/`shadowAlpha` let the World realize this as a flat dark ground quad
    // (collectShadowDecals); CSS-3D ignores them and renders the `bg` gradient as before.
    return { corners: quad, bg, doubleSided: true, decal: 'shadow', shadowAlpha: a };
  });
}

/**
 * Crease seams — the vgl concave contact-shadow / AO term, baked as a face pass over an
 * axis-aligned box massing (the volumes, NOT facade detail). For each candidate box edge it
 * probes solid occupancy in a ring ⟂ to the edge: ~3/4 filled = concave inner edge → feather
 * it; convex/silhouette (~1/4) and flush (~1/2) are skipped — the not-outer-outline rule.
 * Contact shadows lie FLAT: at a wall⊓ground/roof join only the horizontal strip is kept, never
 * the wall-climber. Emits a soft "feather" band carrying BOTH a `bg` linear-gradient for the
 * CSS-3D path (hue sampled from the surface, value pinned to `seamL`) AND `decal:'ink'` for the
 * World (a neutral, gentler contact shadow). Opt-in; the general angular-form version lives in
 * the spike (lite-template/integration/.../vgl-rules), this is the axis-aligned promotion.
 * Perf: ring-sampled, so it's O(edges·samples·K·boxes) — guarded by `maxBoxes`.
 */
export function bakeCreaseSeams(boxes = [], {
  unitScale = 22, feather = 3.4, aoAlpha = 0.5,
  worldInk = [0, 0, 0], worldAlpha = 0.33, maxBoxes = 140,
} = {}) {
  const RECT = new Set([undefined, 'plain', 'box', 'building', 'anchor', 'midtower', 'townhouse']);
  const solids = boxes
    .filter((b) => RECT.has(b.shape) && b.w > 0 && b.d > 0 && b.z1 > b.z0)
    .map((b) => ({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.d, z0: b.z0, z1: b.z1, tint: b.tint || '#9aa3ad' }));
  if (solids.length < 1 || solids.length > maxBoxes) return [];

  const EPS = 1e-6, W = feather / unitScale, LIFT = 1.0 / unitScale;
  const ext = solids.reduce((a, s) => ({ x0: Math.min(a.x0, s.x0), x1: Math.max(a.x1, s.x1), y0: Math.min(a.y0, s.y0), y1: Math.max(a.y1, s.y1) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const all = [...solids, { x0: ext.x0 - 4, x1: ext.x1 + 4, y0: ext.y0 - 4, y1: ext.y1 + 4, z0: -0.5, z1: 0.0 }]; // ground slab → flat feet
  const inside = (s, p) => p[0] > s.x0 + EPS && p[0] < s.x1 - EPS && p[1] > s.y0 + EPS && p[1] < s.y1 - EPS && p[2] > s.z0 + EPS && p[2] < s.z1 - EPS;
  const occ = (p) => all.some((s) => inside(s, p));
  const occTint = (p) => { for (const s of solids) if (inside(s, p)) return s.tint; return null; };

  // candidate edges: every box edge, de-duped
  const seen = new Map(), key = (a, b) => [a, b].map((p) => p.map((v) => v.toFixed(3)).join(',')).sort().join('|');
  for (const s of solids) {
    const xs = [s.x0, s.x1], ys = [s.y0, s.y1], zs = [s.z0, s.z1], V = (i, j, k) => [xs[i], ys[j], zs[k]];
    const edges = [
      [V(0, 0, 0), V(1, 0, 0)], [V(1, 0, 0), V(1, 1, 0)], [V(1, 1, 0), V(0, 1, 0)], [V(0, 1, 0), V(0, 0, 0)],
      [V(0, 0, 1), V(1, 0, 1)], [V(1, 0, 1), V(1, 1, 1)], [V(1, 1, 1), V(0, 1, 1)], [V(0, 1, 1), V(0, 0, 1)],
      [V(0, 0, 0), V(0, 0, 1)], [V(1, 0, 0), V(1, 0, 1)], [V(1, 1, 0), V(1, 1, 1)], [V(0, 1, 0), V(0, 1, 1)],
    ];
    for (const [a, b] of edges) { const k = key(a, b); if (!seen.has(k)) seen.set(k, [a, b]); }
  }

  const K = 24, PROBE = 0.05, INSET = 0.04, STEP = 0.06;
  const longestFalseRun = (arr) => { if (arr.every((x) => x)) return null; let best = { len: 0, start: 0 }, cs = 0, cl = 0; for (let k = 0; k < 2 * K; k++) { if (!arr[k % K]) { if (cl === 0) cs = k; cl++; if (cl > best.len) best = { len: Math.min(cl, K), start: cs % K }; } else cl = 0; } return best; };
  const seams = [];
  for (const [P0, P1] of seen.values()) {
    const T = norm(sub(P1, P0)), Ln = len(sub(P1, P0));
    if (Ln < 2 * INSET + 1e-4) continue;
    const U = Math.abs(T[2]) < 0.9 ? norm(cross(T, [0, 0, 1])) : norm(cross(T, [1, 0, 0]));
    const Vb = norm(cross(T, U));
    const dirOf = (idx) => { const th = (idx / K) * 2 * Math.PI; return add(scale(U, Math.cos(th)), scale(Vb, Math.sin(th))); };
    const N = Math.max(2, Math.floor((Ln - 2 * INSET) / STEP));
    let run = null;
    const flush = () => {
      if (!run) return;
      const empty = longestFalseRun(run.filled);
      if (empty) {
        const before = (empty.start - 1 + K) % K, after = (empty.start + empty.len) % K;
        const emptyMid = dirOf((empty.start + Math.floor(empty.len / 2)) % K);
        const OV = W * 0.5;
        const t0 = run.t0 <= INSET * 1.6 ? -OV : run.t0, t1 = run.t1 >= Ln - INSET * 1.6 ? Ln + OV : run.t1;
        const S0 = add(P0, scale(T, t0)), S1 = add(P0, scale(T, t1));
        const cand = [before, after].map((fi) => {
          const r = dirOf(fi), nA = cross(T, r), n = dot(nA, emptyMid) >= 0 ? norm(nA) : norm(scale(nA, -1));
          const src = occTint(add(add(run.M, scale(r, PROBE * 0.5)), scale(n, -PROBE * 0.5))) || solids[0].tint;
          return { r, n, src, ground: n[2] > 0.6 };             // pools on an UP-facing surface = a real ground/roof contact
        });
        // Contact shadows lie flat only on a true RECEIVING surface (ground / a roof — up-facing):
        // keep just the pool, drop the wall-climber. But a DOWN-facing soffit (a wall-mounted frame
        // bar / overhang) is NOT a ground contact — keep both there so the wall-side reveal survives
        // (the window reveal under a transom). Vertical wall-to-wall creases keep both, unchanged.
        const keep = cand[0].ground !== cand[1].ground ? cand.filter((c) => c.ground) : cand;
        for (const c of keep) {
          const A = add(S0, scale(c.n, LIFT)), B = add(S1, scale(c.n, LIFT));
          const Ao = add(A, scale(c.r, W)), Bo = add(B, scale(c.r, W));
          // Wind the quad so its FRONT faces the open air (`c.n`). A pier's two sides have
          // opposite geometric normals, so without this one side's quad faces inward and the
          // CSS-3D backface shows the gradient MIRRORED (dark at the wrong edge → the reveal looks
          // absent — "each window side only has one"). The crease pair (c0,c1) stays at the
          // junction either way, so the gradient still darkens the crease.
          const corners = dot(cross(T, c.r), c.n) >= 0 ? [A, B, Bo, Ao] : [B, A, Ao, Bo];
          // OMNIDIRECTIONAL AO: a NEUTRAL dark drawn with ALPHA multiplicatively darkens whatever
          // face is behind it — identical on every face regardless of lighting, preserving that
          // surface's own hue (a darker version of it). The World decal does the same (worldInk).
          seams.push({
            corners,
            bg: `linear-gradient(to bottom, rgba(0,0,0,${aoAlpha}) 0%, rgba(0,0,0,${(aoAlpha * 0.4).toFixed(3)}) 40%, rgba(0,0,0,0) 100%)`,
            doubleSided: true,
            decal: 'ink', inkAlpha: worldAlpha, inkColor: worldInk,
          });
        }
      }
      run = null;
    };
    for (let i = 0; i <= N; i++) {
      const t = INSET + (Ln - 2 * INSET) * (i / N), M = add(P0, scale(T, t));
      const filled = Array.from({ length: K }, (_, k) => occ(add(M, scale(dirOf(k), PROBE))));
      const frac = filled.filter(Boolean).length / K;
      if (frac > 0.55 && frac < 0.97) { if (!run) run = { t0: t }; run.t1 = t; run.filled = filled; run.M = M; }
      else flush();
    }
    flush();
  }
  return seams;
}

/**
 * Render one furniture face-card (furniture-cards.js `parts[]` grammar) onto a
 * world-space quad as coplanar sub-faces — the CSS-3D twin of furniture-net.js's
 * partToMarks, but emitting world faces (the browser projects) instead of screen
 * polygons. `outward` is the face's unit normal; parts are nudged a hair along it
 * so they win the z-sort, and lit per-part by the volume's `shade` closure (so a
 * tall piece darkens toward its base and catches nearby lamps). Faces a card
 * leaves unpainted stay absent → legs show through an apron.
 */
function cardFaces(card, quad, outward, shade) {
  if (!card || !Array.isArray(card.parts)) return [];
  const out = [];
  // STAGGER each emitted layer slightly further off the surface (instead of one fixed
  // lift) so overlapping coplanar parts — e.g. a rug's field + inner-border + weft, all
  // drawn on the same plane — don't z-fight. Each face wins the depth test over the one
  // below it. Cheap (≤ a few hundredths of a foot total) and invisible at any angle.
  let layer = 0; const baseLift = 0.012, layerDz = 0.004;
  const W = (u, v) => add(bilerp(quad, u, v), scale(outward, baseLift + layer * layerDz));
  const sc = (hex, corners) => shade(hex, corners, outward);
  const uLen = len(sub(quad[1], quad[0])) || 1, vLen = len(sub(quad[3], quad[0])) || 1;
  const rect = (u0, v0, u1, v1, fill, clip) => { const c = [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)]; out.push({ corners: c, fill: sc(fill, c), doubleSided: true, ...(clip ? { clip } : {}) }); layer += 1; };
  for (const part of card.parts) {
    const fill = part.fill || part.stroke;
    if (!fill) continue;
    switch (part.kind) {
      case 'band': rect(0, part.v, 1, part.v + part.h, fill); break;
      case 'rect': rect(part.u, part.v, part.u + part.w, part.v + part.h, fill); break;
      case 'repeat': {
        const span = part.u1 - part.u0, gap = part.gap ?? 0;
        const w = part.w ?? (span - gap * (part.count - 1)) / part.count;
        const step = part.count > 1 ? (span - w) / (part.count - 1) : 0;
        for (let i = 0; i < part.count; i += 1) {
          const u0 = part.u0 + i * step;
          const f = Array.isArray(part.fills) ? part.fills[i % part.fills.length] : fill;
          rect(u0, part.v, u0 + w, part.v + part.h, f);
        }
        break;
      }
      case 'line': {                              // thin quad along the segment
        const dx = part.u1 - part.u0, dy = part.v1 - part.v0, l = Math.hypot(dx, dy) || 1;
        const hw = (part.strokeWidth || 1) * 0.004, px = (-dy / l) * hw, py = (dx / l) * hw;
        const c = [W(part.u0 + px, part.v0 + py), W(part.u1 + px, part.v1 + py), W(part.u1 - px, part.v1 - py), W(part.u0 - px, part.v0 - py)];
        out.push({ corners: c, fill: sc(part.stroke || fill, c), doubleSided: true }); layer += 1;
        break;
      }
      case 'circle': {                            // bbox quad + elliptical clip
        const du = (part.r * vLen) / uLen;
        rect(part.u - du, part.v - part.r, part.u + du, part.v + part.r, fill, 'ellipse(50% 50%)');
        break;
      }
      case 'poly': {                              // bbox quad + polygon clip
        const us = part.points.map((p) => p.u), vs = part.points.map((p) => p.v);
        const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
        const clip = `polygon(${part.points.map((p) => `${(((p.u - u0) / ((u1 - u0) || 1)) * 100).toFixed(1)}% ${(((p.v - v0) / ((v1 - v0) || 1)) * 100).toFixed(1)}%`).join(', ')})`;
        rect(u0, v0, u1, v1, fill, clip);
        break;
      }
      default: break;
    }
  }
  return out;
}

/**
 * Extract the room as a flat list of vexar-shaded planar faces in world space.
 * @returns {{ faces: Array<{corners:number[][], fill:string, doubleSided?:boolean}>, roomCenter:number[], faceCount:number }}
 */
// ── 'cave' wall surface subtype ───────────────────────────────────────────────
// A wall SUBTYPE for the room view. The interior stays box-based — displacement is
// INWARD-ONLY, so the surface bulges into the room but never leaves the box — yet
// each wall reads as one continuous, organic rock face rather than a box. The recipe
// mirrors the painted-landscape "heartbeat": a smooth low-frequency height field
// (a few rolling sine swells, no high-frequency chop) sampled on a FINE grid. Three
// things make it read as a filled membrane instead of jagged shards:
//   • finely tessellated (small cells) → the per-facet Lambert reads as a smooth
//     gradient, the way the landscape's painterly fill does;
//   • the relief is eased to zero at all four edges (smootherstep window), so every
//     wall stays flush at the corners / floor / ceiling — no jagged silhouette, and
//     neighbouring walls meet cleanly;
//   • each facet is grown slightly about its own centroid so neighbours OVERLAP and
//     the hairline seams close (the same trick as emitPreserve3dScene's `inflate`,
//     applied locally so furniture is untouched) → a fully filled surface.
// Normals are taken numerically from the displaced field (central differences), so
// the lit shading follows the real swells; the bake stays camera-independent
// (geometry-only), so the look holds as a walk-through camera translates. Mesh-only
// for now — a rock texture can later skin these same facets via surface-textures.js.
//
// The wave is authored in normalized (s,t) ∈ [0,1]², so it is geometry-agnostic: it
// needs only a SURFACE descriptor that maps (s,t) → world. A flat wall supplies the
// linear quad mapping; a curved (cylindrical) wall supplies a radial one — same
// kernel, so a round room's cave wall is the same code as a box room's. This is the
// "the mandala isn't a rectangle, only its mapping is" seam made concrete.
//   surf = { pointAt(s,t)→[x,y,z], inwardAt(s,t)→unit vec toward the room, Lu, Lv, wrapU? }
// wrapU=true means s closes on itself (a cylinder): drop the horizontal edge taper and
// force INTEGER angular wave numbers so the field is seamless at s=0≡1.
// Walls only by default — the ceiling reads edge-on from below, where the inter-facet
// grooves would show as dark dashes; keep it flat so the wave surface stays a WALL trait.
const CAVE_SURFACES = new Set(['backWall', 'frontWall', 'leftWall', 'rightWall']);
function waveCaveFaces(surf, base, shade, { id, amp, relief = 0.8, rolls = 1.7, cell = 0.6, overlap = 1.09, seed = 1, lobeWavelength = 6.5, heightField, omitCells } = {}) {
  const { pointAt, inwardAt, Lu, Lv, wrapU = false } = surf;
  const A = amp ?? Math.min(1.2, relief * 0.13 * Math.min(Lu, Lv)); // swell depth (world units) — deep enough to read, shallow enough to stay box-based
  const nu = Math.max(6, Math.min(wrapU ? 140 : 44, Math.round(Lu / cell)));
  const nv = Math.max(6, Math.min(48, Math.round(Lv / cell)));
  const TAU = Math.PI * 2, p1 = seed * 1.7, p2 = seed * 3.1;
  // gentle rolling height field in [0,1] — a couple of low-frequency sine swells (the
  // "heartbeat"), no high-frequency noise → smooth organic forms, not chop. On a
  // wrapping wall the s-frequencies are integer lobe-counts (seamless), scaled from a
  // target lobe wavelength so a big circumference gets proportionally more rock ribs.
  // `heightField(s,t)` overrides this (e.g. a golden-ratio bump field for cavern rock).
  const ka = wrapU ? Math.max(3, Math.round(Lu / lobeWavelength)) : rolls;
  const kb = wrapU ? ka + 3 : rolls * 0.6 + 1;
  const rolling = heightField || (wrapU
    ? (s, t) => 0.5 + 0.5 * (0.6 * Math.sin(TAU * (ka * s + 0.18 * t) + p1) + 0.4 * Math.sin(TAU * (kb * s - 0.12 * t) + p2))
    : (s, t) => 0.5 + 0.5 * (0.6 * Math.sin(TAU * (ka * s + 0.7 * t) + p1) + 0.4 * Math.sin(TAU * (0.8 * s + kb * t) + p2)));
  // smootherstep edge window → relief eases to 0 over the outer 14% of an axis.
  const edge = (x) => { const e = Math.min(1, Math.max(0, Math.min(x, 1 - x) / 0.14)); return e * e * e * (e * (e * 6 - 15) + 10); };
  const winU = wrapU ? () => 1 : edge;     // a wrapping wall has no left/right edge to stay flush to
  const height = (s, t) => A * winU(s) * edge(t) * rolling(s, t);
  const at = (s, t) => add(pointAt(s, t), scale(inwardAt(s, t), height(s, t)));
  const faces = [];
  for (let i = 0; i < nu; i += 1) {
    for (let j = 0; j < nv; j += 1) {
      const s0 = i / nu, s1 = (i + 1) / nu, t0 = j / nv, t1 = (j + 1) / nv;
      if (omitCells && omitCells((s0 + s1) / 2, (t0 + t1) / 2)) continue;   // carved openings (tunnel mouths)
      let corners = [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)];
      // numeric surface normal at the cell centre (central differences over the displaced field).
      const sc = (s0 + s1) / 2, tc = (t0 + t1) / 2, ds = 0.5 / nu, dt = 0.5 / nv;
      let n = norm(cross(sub(at(sc + ds, tc), at(sc - ds, tc)), sub(at(sc, tc + dt), at(sc, tc - dt))));
      if (dot(n, inwardAt(sc, tc)) < 0) n = scale(n, -1);
      // grow each facet about its centroid so neighbours overlap and the seams close.
      const ctr = centroid(corners);
      corners = corners.map((c) => add(ctr, scale(sub(c, ctr), overlap)));
      const face = { corners, fill: shade(base, corners, n), doubleSided: true, normal: n };
      if (id) face.group = 'shell:' + id;
      faces.push(face);
    }
  }
  return faces;
}

// Flat wall (box room): a quad [a,b,c,d] with a→b = +u (horizontal), a→d = +v (up).
// Thin wrapper that hands the wave kernel the linear quad→world mapping + constant inward.
function caveWallFaces(quad, base, center, shade, opts = {}) {
  const uVec = sub(quad[1], quad[0]), vVec = sub(quad[3], quad[0]);
  const inward = normalToward(quad, center);
  const surf = { Lu: len(uVec), Lv: len(vVec), wrapU: false, pointAt: (s, t) => bilerp(quad, s, t), inwardAt: () => inward };
  return waveCaveFaces(surf, base, shade, opts);
}

// ── golden-ratio relief fields ────────────────────────────────────────────────
// Instead of a regular sine stack, scatter the relief's bump centres by the GOLDEN
// low-discrepancy sequence (1/φ steps) / phyllotaxis (the 137.5° sunflower) — the
// maximally-non-repeating distribution plants use. Summed smooth bumps then read as
// organic cavern rock with no visible tiling: the same "paper over a waveform" recipe,
// but the waveform is golden-radial rather than periodic. Both return (s,t)→height in
// roughly [0, 1.5] (overlapping bumps stack into ridges), to be scaled by the caller.
const PHI_INV = 2 / (1 + Math.sqrt(5));                 // 1/φ ≈ 0.6180339887
const GOLDEN_ANGLE = 2 * Math.PI * (1 - PHI_INV);       // ≈ 137.5077°

// For a CYLINDER wall (s = angle ∈[0,1) wraps, t = height ∈[0,1]). Per-axis sigma
// keeps bumps round given s spans the whole circumference and t only the height.
function goldenWallReliefField({ count = 48, sigmaS = 0.045, sigmaT = 0.22, seed = 1 } = {}) {
  const G2 = (PHI_INV * PHI_INV), G3 = 1 - PHI_INV, C = [];
  for (let i = 0; i < count; i += 1) {
    const s = (((i + 1) * PHI_INV) + seed * 0.123) % 1;        // golden sequence around the ring
    const t = (((i + 1) * G2) + seed * 0.456) % 1;             // a second irrational up the height
    C.push({ s, t, a: 0.55 + 0.45 * (((i + 1) * G3) % 1), ss: sigmaS * (0.7 + 0.7 * ((i * 0.91) % 1)), st: sigmaT * (0.7 + 0.7 * ((i * 0.27) % 1)) });
  }
  return (s, t) => {
    let h = 0;
    for (const c of C) { let ds = s - c.s; ds -= Math.round(ds); const dt = t - c.t; h += c.a * Math.exp(-(ds * ds) / (2 * c.ss * c.ss) - (dt * dt) / (2 * c.st * c.st)); }
    return Math.min(1.5, h);
  };
}

// For a DISC floor/ceiling (s = angle ∈[0,1), t = radius ∈[0,1]). Bump centres are the
// phyllotaxis sunflower (r = R√(i/N), θ = i·goldenAngle); distance is Cartesian on the
// disc so bumps stay round everywhere (polar distance compresses near the centre).
function goldenDiscReliefField({ R = 10, count = 72, sigma = 1.5, seed = 1 } = {}) {
  const G3 = 1 - PHI_INV, C = [];
  for (let i = 0; i < count; i += 1) {
    const rr = Math.sqrt((i + 0.5) / count) * R, th = i * GOLDEN_ANGLE + seed;
    C.push({ x: rr * Math.cos(th), y: rr * Math.sin(th), a: 0.55 + 0.45 * (((i + 1) * G3) % 1), inv2: 1 / (2 * (sigma * (0.7 + 0.7 * ((i * 0.71) % 1))) ** 2) });
  }
  return (s, t) => {
    const a = 2 * Math.PI * s, r = t * R, x = r * Math.cos(a), y = r * Math.sin(a);
    let h = 0;
    for (const c of C) { const dx = x - c.x, dy = y - c.y; h += c.a * Math.exp(-(dx * dx + dy * dy) * c.inv2); }
    return Math.min(1.5, h);
  };
}

// A displaced DISC over polar coords (s = angle ∈[0,1), t = radius ∈[0,1]) — the
// floor/ceiling counterpart of waveCaveFaces, and a literal mandala (concentric rings
// × angular sectors). `heightAt(s,t)` is the signed offset from `baseZ` along world-z,
// so it serves both a bumpy floor (offset up into the room) and an inner dome ceiling
// (offset to an apex). Each cell is tiled by TWO exact triangles, not one quad — a
// polar cell is a trapezoid (outer arc longer than inner), which the emitter's
// parallelogram quad can't represent (it ignores the 4th corner) and would leave a
// wedge gap at the rim; two 3-corner faces tile it exactly. The innermost ring fans to
// the apex as single triangles. Normals are numeric, oriented toward `toward`.
function polarDiscFaces({ cx, cy, R, baseZ = 0, heightAt, toward, base, shade, group, rings = 16, segments = 64, overlap = 1.02 } = {}) {
  const TAU = Math.PI * 2;
  const wrap = (k) => (((k % segments) + segments) % segments);
  const pt = (k, t) => { const tt = Math.max(0, Math.min(1, t)), a = (TAU * wrap(k)) / segments, r = tt * R; return [cx + r * Math.cos(a), cy + r * Math.sin(a), baseZ + heightAt(wrap(k) / segments, tt)]; };
  const apex = [cx, cy, baseZ + heightAt(0, 0)];
  const faces = [];
  const push = (corners, n) => {
    if (overlap && overlap !== 1) { const ctr = centroid(corners); corners = corners.map((c) => add(ctr, scale(sub(c, ctr), overlap))); }
    const f = { corners, fill: shade(base, corners, n), doubleSided: true, normal: n };
    if (group) f.group = group;
    faces.push(f);
  };
  for (let ri = 0; ri < rings; ri += 1) {
    const t0 = ri / rings, t1 = (ri + 1) / rings, tc = (t0 + t1) / 2, dt = 0.5 * (t1 - t0);
    for (let k = 0; k < segments; k += 1) {
      const a = pt(k, t0), b = pt(k + 1, t0), c = pt(k + 1, t1), d = pt(k, t1);
      // one numeric normal per cell (flat-shaded), oriented toward the room.
      let n = norm(cross(sub(pt(k + 1, tc), pt(k, tc)), sub(pt(k + 0.5, tc + dt), pt(k + 0.5, tc - dt))));
      const cen = ri === 0 ? centroid([d, c, apex]) : centroid([a, b, c, d]);
      if (dot(n, sub(toward, cen)) < 0) n = scale(n, -1);
      if (ri === 0) { push([d, c, apex], n); }      // innermost fans to the apex
      else { push([a, b, c], n); push([a, c, d], n); }  // two triangles tile the trapezoid exactly
    }
  }
  return faces;
}

export function extractRoomSceneFaces({ elements = [], roomBasis = {}, presets, tabletop, lighting, light, lamps = [], tint = [1, 1, 1], gravityDarken = true, includeShell = true, shellOmit = ['frontWall'], wallSurface, deferDiffusion = false } = {}) {
  const plan = resolveRoomSceneElementPlan({ elements, roomBasis, presets, tabletop }, roomBasis);
  const surfaces = resolveRoomSurfaces(roomBasis);
  const { xRange, yRange, zRange } = surfaces.ranges;
  const roomCenter = [(xRange[0] + xRange[1]) / 2, (yRange[0] + yRange[1]) / 2, (zRange[0] + zRange[1]) / 2];
  const camHint = Array.isArray(roomBasis.cameraHint) ? roomBasis.cameraHint : roomCenter;
  // one unified lighting model (new `lighting` object, or the legacy positional params).
  const lit = resolveLighting(lighting || { light, tint, lamps, gravity: gravityDarken }, { xRange, yRange, zRange });
  const L = lit.L;
  let faces = [];
  // vexar directional Lambert + tint + baked point-lamps + gravity contact-shadow.
  const shade = makeShade({ light: L, lamps: lit.lamps, tint: lit.tint, gravityDarken: lit.gravity });
  const shadeT = (base, corners, toward) => shade(base, corners, normalToward(corners, toward));

  // room shell. `shellOmit` drops surfaces by id (default ['frontWall'] — the wall between a
  // looking-in camera and the room). Showcase/TV mode omits more (e.g. a side wall + ceiling);
  // immersive mode passes [] for a full shell and hides walls at render time instead. Each
  // emitted shell face carries `group: 'shell:<id>'` + an inward `normal` so the World can
  // split it into a toggleable sub-mesh and auto-hide it (scene-three.js). Omitted when
  // furnishing a volume whose shell is built separately (multi-room composition).
  // wall surface subtype: 'cave' tessellates each wall (+ ceiling) into an inward
  // wave mesh; the floor stays flat (walkable). Default (undefined) → flat shell.
  const cave = (wallSurface ?? roomBasis.wallSurface) === 'cave';
  if (includeShell) {
    for (const s of surfaces.list) {
      if (shellOmit.includes(s.id) || !SURFACE_PALETTE[s.id]) continue;
      const c = surfaceCorners(s);
      if (cave && CAVE_SURFACES.has(s.id)) {
        faces.push(...caveWallFaces(c, SURFACE_PALETTE[s.id], roomCenter, shade, { id: s.id }));
      } else {
        faces.push({ corners: c, fill: shadeT(SURFACE_PALETTE[s.id], c, roomCenter), doubleSided: true, group: 'shell:' + s.id, normal: normalToward(c, roomCenter) });
      }
    }
  }

  // furniture: every element is a box-net skinned with furniture-cards.js data
  // cards (5 faces: center=top + four cardinals), legs at the planner's support
  // pins, transparency where a card leaves a face unpainted. This is the SAME
  // furniture model the SVG path uses (buildFurnitureNet), here keeping geometry
  // 3D so the browser projects each card part.
  const boxFaceQuads = (base, top) => ({
    center: top,
    front: [base[0], base[1], top[1], top[0]],
    right: [base[1], base[2], top[2], top[1]],
    back: [base[2], base[3], top[3], top[2]],
    left: [base[3], base[0], top[0], top[3]],
  });
  const outwardNormal = (quad, boxC) => {
    let n = norm(cross(sub(quad[1], quad[0]), sub(quad[3], quad[0])));
    if (dot(n, sub(centroid(quad), boxC)) < 0) n = scale(n, -1);
    return n;
  };
  const legPost = (sup) => {
    const r = (sup.radius || 0.045) * 1.9, b = sup.bottom, t = sup.top;
    const ring = [[b[0]-r,b[1]-r],[b[0]+r,b[1]-r],[b[0]+r,b[1]+r],[b[0]-r,b[1]+r]];
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % 4];
      const lc = [[ax,ay,b[2]],[bx,by,b[2]],[bx,by,t[2]],[ax,ay,t[2]]];
      faces.push({ corners: windToward(lc, camHint), fill: shadeT(LEG_HEX, lc, [b[0],b[1],(b[2]+t[2])/2]) });
    }
  };
  const PROP_HEX = '#b9a884';                      // neutral tabletop-prop solid (props without a dedicated net)
  const contactFootprints = [];
  // authored elements followed by the placement planner's tabletop props, so
  // items anchored onto table surfaces actually reach the scene.
  for (const el of roomSceneRenderElements(plan)) {
    const manji = el.heightManji;
    const net = getFurnitureNet(el.type);
    const base = manji.basePlane.corners, top = manji.topPlane.corners;
    const onProp = el.surface === 'tabletop';
    const elevated = (el.surface === 'floor' || onProp) && manji.heightWorld > 0;
    const assetHit = (el.surface === 'floor' && elevated) ? roomFurnitureAssetFaces(el, { light: L }) : null;

    if (assetHit) {                                // workbench-authored room asset
      faces.push(...assetHit.faces);
      contactFootprints.push(assetHit.contactFootprint);
    } else if (onProp && elevated && !net) {       // tabletop prop without a dedicated net: generic shaded box
      const quads = boxFaceQuads(base, top);
      const boxC = centroid([...base, ...top]);
      for (const slot of ['front', 'right', 'back', 'left', 'center']) {
        const q = quads[slot];
        faces.push({ corners: windToward(q, camHint), fill: shadeT(PROP_HEX, q, boxC) });
      }
    } else if (net && elevated) {                  // full box-net: 5 card faces + legs
      const quads = boxFaceQuads(base, top);
      const boxC = centroid([...base, ...top]);
      for (const slot of ['front', 'right', 'back', 'left', 'center']) {
        const card = getFurnitureFaceCard(net.faces[slot]);
        if (!card) continue;
        const q = quads[slot], n = outwardNormal(q, boxC);
        faces.push(...cardFaces(card, q, n, shade));
      }
      for (const sup of manji.supports) legPost(sup);
      if (manji.heightWorld > 0.15) contactFootprints.push({ corners: base, height: manji.heightWorld });
    } else if (net) {                              // flat element (wall fixture / flush floor): one card on its plane
      const card = getFurnitureFaceCard(net.faces.front || net.faces.center);
      const n = normalToward(base, roomCenter);
      faces.push(...cardFaces(card, base, n, shade));
    } else {                                        // no net: a plain shaded top plane
      faces.push({ corners: windToward(top, roomCenter), fill: shadeT('#8a7a64', top, roomCenter) });
    }
  }
  // traced diffusion: bake locally for a standalone room; a larger scene (suite) sets
  // deferDiffusion and bakes once across all its faces so light spills between rooms.
  if (lit.sources.length && !deferDiffusion) {
    faces = bakeSceneDiffusion(faces, lit.sources, lit.diffusion);
  }
  // contact shadows under furniture (defaults on with shadows). Deferred → the suite
  // emits them after its global bake, from the returned footprints.
  const wantContact = lit.diffusion.contact ?? lit.diffusion.shadows ?? false;
  if (wantContact && !deferDiffusion) {
    faces.push(...contactShadowDecals(contactFootprints, { strength: lit.diffusion.contactStrength ?? 0.5 }));
  }
  return { faces, roomCenter, faceCount: faces.length, sources: lit.sources, contactFootprints };
}

/**
 * Build one volume's shell (floor + ceiling + 4 walls) as planar faces, with
 * optional walls omitted (open sides) and rectangular doorway openings cut in.
 * This is the multi-room primitive: compose several volumes of DIFFERENT heights,
 * each sharing a doorway, into one connected interior — all in world space, so the
 * browser projects + occludes the whole enfilade from any pinned camera.
 *
 * Walls are keyed by geometry, not room-role: 'yMin' | 'yMax' | 'xMin' | 'xMax'.
 * `doorways` are { wall, u0, u1, v0, v1 } in that wall's normalized frame
 * (u = horizontal along the wall, v = up). One doorway per wall is split cleanly
 * into left / right / lintel / sill strips; pass at most one opening per wall.
 */
export function buildRoomShellFaces({ xRange, yRange, zRange, omit = [], doorways = [], wallSurface, lighting, light, lamps = [], tint = [1, 1, 1], gravityDarken = true, palette = SURFACE_PALETTE } = {}) {
  const lit = resolveLighting(lighting || { light, tint, lamps, gravity: gravityDarken }, { xRange, yRange, zRange });
  const shade = makeShade({ light: lit.L, lamps: lit.lamps, tint: lit.tint, gravityDarken: lit.gravity });
  const [x0, x1] = xRange, [y0, y1] = yRange, [z0, z1] = zRange;
  const center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces = [];
  const cave = wallSurface === 'cave';
  const push = (corners, base) => faces.push({ corners, fill: shade(base, corners, normalToward(corners, center)), doubleSided: true });
  // a wall quad pushes either flat or as a 'cave' wave mesh; floor + ceiling stay flat.
  const pushWall = (corners, base) => (cave ? faces.push(...caveWallFaces(corners, base, center, shade)) : push(corners, base));
  push([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], palette.floor);    // floor
  push([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], palette.ceiling);  // ceiling
  // each wall as a quad [a,b,c,d]: a→b is +u (horizontal), a→d is +v (up).
  const WALLS = {
    yMin: { quad: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], base: palette.backWall },
    yMax: { quad: [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], base: palette.backWall },
    xMin: { quad: [[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]], base: palette.leftWall },
    xMax: { quad: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], base: palette.rightWall },
  };
  const doorsByWall = {};
  for (const d of doorways) (doorsByWall[d.wall] ||= []).push(d);
  for (const [id, w] of Object.entries(WALLS)) {
    if (omit.includes(id)) continue;
    const door = (doorsByWall[id] || [])[0];
    if (!door) { pushWall(w.quad, w.base); continue; }
    // split the wall around the doorway: left | right | lintel | sill (sill empty for floor doors)
    const strips = [
      [0, 0, door.u0, 1],
      [door.u1, 0, 1, 1],
      [door.u0, door.v1, door.u1, 1],
      [door.u0, 0, door.u1, door.v0],
    ];
    for (const [a, bv, c, dv] of strips) {
      if (c - a < 1e-4 || dv - bv < 1e-4) continue;
      pushWall([bilerp(w.quad, a, bv), bilerp(w.quad, c, bv), bilerp(w.quad, c, dv), bilerp(w.quad, a, dv)], w.base);
    }
  }
  return faces;
}

/**
 * Build a ROUND room's shell — the same primitive as buildRoomShellFaces, but the
 * footprint is a disc instead of a box. This is the proof that the mandala model is
 * shape-agnostic: the wall is one cylindrical surface fed through the SAME wave kernel
 * (waveCaveFaces) as a flat wall, and the floor/ceiling are triangle fans (a literal
 * mandala — concentric disc carved into angular sectors). `wallSurface:'cave'` gives a
 * wavy rock cylinder whose s-axis wraps seamlessly (no corners to taper to); otherwise
 * the wall is N flat vertical segments. Lighting is the standard baked model.
 *
 * The floor is 'flat' (a clean disc fan) or 'wave' (a consistent rolling bumpiness,
 * eased to flush at the rim so it meets the wall base). The ceiling is 'flat' or
 * 'dome' (a spherical inner cap rising to an apex over the centre — the rim stays at
 * the wall top). Furniture is intentionally out of scope here (it needs a polar anchor
 * mapping + orient-to-tangent for wall fixtures) — this builds the room itself.
 */
export function buildRoundRoomShellFaces({ center = [0, 0], radius = 12, height = 11, segments, wallSurface, floorSurface = 'flat', ceilingSurface = 'flat', relief = 'rolling', reliefSeed = 1, domeRise, floorOptions = {}, ceilingOptions = {}, wallOmitArcs = [], omit = [], caveOptions = {}, lighting, light, lamps = [], tint = [1, 1, 1], gravityDarken = true, palette = SURFACE_PALETTE } = {}) {
  const [cx, cy] = center, R = radius, Hz = height, TAU = Math.PI * 2;
  const ranges = { xRange: [cx - R, cx + R], yRange: [cy - R, cy + R], zRange: [0, Hz] };
  const lit = resolveLighting(lighting || { light, tint, lamps, gravity: gravityDarken }, ranges);
  const shade = makeShade({ light: lit.L, lamps: lit.lamps, tint: lit.tint, gravityDarken: lit.gravity });
  const roomCenter = [cx, cy, Hz / 2];
  const faces = [];
  const N = segments ?? Math.max(48, Math.round((TAU * R) / 0.8));   // rim resolution for the disc fans / flat wall
  const rim = (k, z) => { const a = (TAU * k) / N; return [cx + R * Math.cos(a), cy + R * Math.sin(a), z]; };
  const golden = relief === 'golden';
  // golden bump fields shared across surfaces so the relief feels like one continuous cavern.
  const discField = golden ? goldenDiscReliefField({ R, count: Math.max(48, Math.round(R * 5)), sigma: Math.max(1, R * 0.13), seed: reliefSeed }) : null;

  // ── floor ──
  if (!omit.includes('floor')) {
    if (floorSurface === 'wave') {
      // consistent rolling bumpiness, eased to 0 over the outer rim so it meets the wall
      // base cleanly. 'golden' → phyllotaxis bump field; 'rolling' → a few sine swells.
      const fAmp = floorOptions.amp ?? Math.min(0.5, 0.035 * R);
      const rimEase = (t) => { const e = Math.min(1, (1 - t) / 0.12); return e <= 0 ? 0 : e * e * (3 - 2 * e); };
      let floorH;
      if (golden) { floorH = (s, t) => fAmp * rimEase(t) * discField(s, t); }
      else {
        const ka = Math.max(4, Math.round(R / 2.4)), kb = ka + 2, kr = 2.3, kr2 = 1.6, sd = floorOptions.seed ?? 1, q1 = sd * 1.7, q2 = sd * 3.1;
        floorH = (s, t) => fAmp * rimEase(t) * (0.5 + 0.5 * (0.55 * Math.sin(TAU * (ka * s) + kr * TAU * t + q1) + 0.45 * Math.sin(TAU * (kb * s) - kr2 * TAU * t + q2)));
      }
      faces.push(...polarDiscFaces({ cx, cy, R, baseZ: 0, heightAt: floorH, toward: roomCenter, base: palette.floor, shade, group: 'shell:floor', rings: Math.max(8, Math.round(R / 1.7)), segments: N }));
    } else {
      for (let k = 0; k < N; k += 1) {                  // flat disc fan (rim-anchored triangles)
        const f0 = rim(k, 0), f1 = rim((k + 1) % N, 0);
        faces.push({ corners: [f0, f1, [cx, cy, 0]], fill: shade(palette.floor, [f0, f1, [cx, cy, 0]], [0, 0, 1]), doubleSided: true, group: 'shell:floor' });
      }
    }
  }

  // ── ceiling ──
  if (!omit.includes('ceiling')) {
    if (ceilingSurface === 'dome') {
      // a CAVE ROOF: a spherical vault (apex over the centre, rim at the wall top) PLUS
      // centred golden relief that hangs rocky lumps DOWN into the chamber (a bump in
      // the field → lower z = protrusion; a hollow → higher z = recess), eased flush at
      // the rim so it meets the wall top. Finer rings than a smooth dome so the lumps
      // read. 'rolling'/no-golden keeps the clean spherical cap.
      const rise = domeRise ?? R * 0.42;
      const camp = golden ? (ceilingOptions.amp ?? Math.min(2.2, R * 0.17)) : 0;
      const rimEase = (t) => { const e = Math.min(1, (1 - t) / 0.1); return e <= 0 ? 0 : e * e * (3 - 2 * e); };
      const domeH = golden
        ? (s, t) => rise * Math.sqrt(Math.max(0, 1 - t * t)) + camp * rimEase(t) * (0.5 - discField(s, t))
        : (s, t) => rise * Math.sqrt(Math.max(0, 1 - t * t));
      faces.push(...polarDiscFaces({ cx, cy, R, baseZ: Hz, heightAt: domeH, toward: roomCenter, base: palette.ceiling, shade, group: 'shell:ceiling', rings: golden ? Math.max(14, Math.round(R / 0.85)) : Math.max(10, Math.round(R / 1.3)), segments: N }));
    } else {
      for (let k = 0; k < N; k += 1) {                  // flat disc fan
        const c0 = rim(k, Hz), c1 = rim((k + 1) % N, Hz);
        faces.push({ corners: [c0, c1, [cx, cy, Hz]], fill: shade(palette.ceiling, [c0, c1, [cx, cy, Hz]], [0, 0, -1]), doubleSided: true, group: 'shell:ceiling' });
      }
    }
  }
  // cylindrical wall: one parametric surface (s = angle, t = height), inward = toward axis.
  const wallSurf = {
    Lu: TAU * R, Lv: Hz, wrapU: true,
    pointAt: (s, t) => { const a = TAU * s; return [cx + R * Math.cos(a), cy + R * Math.sin(a), t * Hz]; },
    inwardAt: (s) => { const a = TAU * s; return [-Math.cos(a), -Math.sin(a), 0]; },
  };
  if (wallSurface === 'cave') {
    const wallOpts = { id: 'wall', ...caveOptions };
    if (golden && !wallOpts.heightField) wallOpts.heightField = goldenWallReliefField({ count: caveOptions.lobeCount ?? Math.max(48, Math.round(R * 5)), seed: reliefSeed });
    // tunnel mouths: carve an angular arc (azimuth ± half) up to height fraction tMax.
    // s = angle/2π, so an arc at world azimuth `az` maps to s-distance on the ring.
    if (wallOmitArcs.length && !wallOpts.omitCells) {
      wallOpts.omitCells = (s, t) => wallOmitArcs.some((a) => { let d = Math.abs((s - a.az / TAU) % 1); d = Math.min(d, 1 - d); return d < (a.half / TAU) && t < a.tMax; });
    }
    faces.push(...waveCaveFaces(wallSurf, palette.backWall, shade, wallOpts));
  } else {
    for (let k = 0; k < N; k += 1) {
      const a0 = rim(k, 0), a1 = rim((k + 1) % N, 0), b1 = rim((k + 1) % N, Hz), b0 = rim(k, Hz);
      const mid = (TAU * (k + 0.5)) / N, n = [-Math.cos(mid), -Math.sin(mid), 0];
      faces.push({ corners: [a0, a1, b1, b0], fill: shade(palette.backWall, [a0, a1, b1, b0], n), doubleSided: true, normal: n, group: 'shell:wall' });
    }
  }
  return faces;
}

// ── emitter ───────────────────────────────────────────────────────────────────
/**
 * Emit a self-contained preserve-3d HTML scene.
 * @param {object} opts
 * @param {Array} opts.faces        {corners, fill|bg, doubleSided?, clip?, glow?, html?, card?, lit?}
 *   card+lit are the World-only mark-card realization (facade-card.js); this CSS-3D
 *   emitter ignores them and paints `bg`. They are two realizations of one facade.
 * @param {Array} opts.cameras      [{ name, worldFraming }]
 * @param {object} opts.viewBox     { width, height }
 * @param {number} opts.unitScale   px per world unit (cancels in projection; sets Z magnitude)
 */
export function emitPreserve3dScene({ faces = [], cameras = [], viewBox = { width: 1080, height: 720 }, unitScale = 30, title = 'mojulo scene', bg = '#1b1712', sky, inflate = 1, signs = [] } = {}) {
  const W = viewBox.width, H = viewBox.height;
  // `sky` (painted-landscape sky concept) → a CSS gradient backdrop; else the flat bg.
  if (sky) bg = skyCss(sky);
  // Seam fill: each face is one flat panel; on a curved/tessellated surface adjacent panels meet
  // at an angle and leave hairline gaps (the dark bg bleeds through → a "flayed" mosaic). `inflate`
  // > 1 grows every panel about its own centre (transform-origin defaults to 50% 50%, and `scale()`
  // composes after the 3D placement matrix, so it acts in the panel's own plane) → neighbours
  // overlap and the seams close. Default 1 = off (existing scenes stay byte-identical).
  const grow = inflate && inflate !== 1 ? ` scale(${inflate})` : '';
  const dom = faces.map((f) => {
    const c = f.corners;
    // A panel is a parallelogram (origin c0 + uVec + vVec). A TRIANGLE face (3 corners — e.g. a
    // relief/mesh cap) is exactly half of one: take vVec to c2 and clip to the lower-left triangle.
    const tri = c.length === 3;
    const uVec = sub(c[1], c[0]), vVec = sub(tri ? c[2] : c[3], c[0]);
    const wPx = (len(uVec) * unitScale).toFixed(2), hPx = (len(vVec) * unitScale).toFixed(2);
    const bf = f.doubleSided ? 'visible' : 'hidden';
    const clip = tri ? 'clip-path:polygon(0 0,100% 0,0 100%);' : (f.clip ? `clip-path:${f.clip};` : '');   // f.clip = polygon mask (e.g. cylinder roof cap)
    const radius = f.radius ? `border-radius:${f.radius};` : '';  // f.radius = rounded corners (e.g. arched window top)
    const glow = f.glow ? `box-shadow:${f.glow};` : '';  // f.glow = CSS bloom halo for emissive faces (light fixtures)
    // f.bg = full CSS background (facade gradient); f.html = inner content (brick arched windows).
    return `      <div class="f" style="width:${wPx}px;height:${hPx}px;background:${f.bg || f.fill};${clip}${radius}${glow}transform:${planeMatrix(c[0], uVec, vVec, unitScale)}${grow};backface-visibility:${bf}">${f.html || ''}</div>`;
  }).join('\n');

  // adaptive-signage: gated so signage-less scenes stay byte-identical.
  const hasSigns = Array.isArray(signs) && signs.length > 0;
  const sig = hasSigns ? buildSignageLayer(signs, cameras, viewBox) : null;

  const cams = cameras.map((cam, ci) => {
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(cam.worldFraming, viewBox, unitScale);
    const base = { name: cam.name || 'view', matrix, perspective, center };
    return sig ? { ...base, signs: sig.camSigns[ci] } : base;
  });
  const camJson = JSON.stringify(cams);

  const viewportBlock = hasSigns
    ? `  <div class="stage"><div class="viewport"><div class="view" id="view">
${dom}
  </div></div><div class="moj-signs" id="signs">${sig.dom}</div></div>`
    : `  <div class="viewport"><div class="view" id="view">
${dom}
  </div></div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  .viewport{width:${W}px;height:${H}px;max-width:100%;overflow:hidden;background:${bg};perspective:600px;perspective-origin:50% 50%}
  .view{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:0 0}
  .f{position:absolute;left:0;top:0;transform-origin:0 0}
  /* brick masonry windows: arched top (the face's local y is flipped, so the arch
     rounds the CSS-bottom corners → renders at the window's world-top). */
  .bw{position:absolute;background:linear-gradient(150deg,#3a4350,#1d232b 72%);box-shadow:inset 0 0 0 1.2px #c9b396;border-radius:0 0 48% 48% / 0 0 42% 42%}
  .controls{display:flex;gap:8px;margin:8px;flex-wrap:wrap}
  .controls button{color:#9cc4ff;background:none;border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .controls button.on{background:#1b2740;color:#fff}${sig ? sig.css : ''}
</style></head><body>
${viewportBlock}
  <div class="controls" id="ctrl"></div>
<script>
  const CAMS = ${camJson};
  const view = document.getElementById('view'), vp = document.querySelector('.viewport'), ctrl = document.getElementById('ctrl');${sig ? sig.script : ''}
  function setCam(i){ const c = CAMS[i]; vp.style.perspective = c.perspective.toFixed(2)+'px';
    view.style.transform = 'translate('+c.center[0]+'px,'+c.center[1]+'px) ' + c.matrix;
    [...ctrl.children].forEach((b,k)=>b.classList.toggle('on',k===i));${sig ? ' placeSigns(c);' : ''} }
  CAMS.forEach((c,i)=>{ const b=document.createElement('button'); b.textContent='cam'+i+(c.name?' · '+c.name:''); b.onclick=()=>setCam(i); ctrl.appendChild(b); });
  const q = new URLSearchParams(location.search).get('cam');
  setCam(q!==null ? Math.max(0, Math.min(CAMS.length-1, +q)) : 0);
</script>
</body></html>
`;
}

/** Convenience: room scene plan + cameras → self-contained HTML. */
export function renderRoomSceneToHtml({ elements, roomBasis, cameras, presets, viewBox, unitScale = 30, title = 'mojulo room', lighting, light, lamps, tint, gravityDarken, wallSurface } = {}) {
  const { faces } = extractRoomSceneFaces({ elements, roomBasis, presets, lighting, light, lamps, tint, gravityDarken, wallSurface });
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title });
}

// ── production manji-tree two-point room → scene (additive; no neo-rembrandt change) ──
const orderedRange = (r, fb) => {
  const raw = Array.isArray(r) && r.length >= 2 ? r : fb;
  const a = Number.isFinite(+raw[0]) ? +raw[0] : fb[0], b = Number.isFinite(+raw[1]) ? +raw[1] : fb[1];
  return a <= b ? [a, b] : [b, a];
};

/** Build a room-scene roomBasis from a stored manji-tree's `pureMandala.room`
 *  (mirrors neo-rembrandt's generateTwoPointRoomMarks range derivation). */
function roomBasisFromPureMandala(room = {}) {
  const xRange = orderedRange(room.floor?.x, [room.walls?.leftX ?? -18, room.walls?.rightX ?? 18]);
  const yRange = orderedRange(room.floor?.y, [-28, 8]);
  const ceilingZ = Number.isFinite(+room.ceilingZ) ? +room.ceilingZ : 11;
  return {
    worldExtent: { width: xRange[1] - xRange[0], depth: yRange[1] - yRange[0], height: ceilingZ },
    xRange, yRange, zRange: [0, ceilingZ],
    frontY: yRange[1], backY: yRange[0], verticalUnit: 26,
    cameraHint: [xRange[0] - 0.2 * (xRange[1] - xRange[0]), yRange[1] + 0.3 * (yRange[1] - yRange[0]), ceilingZ * 0.85],
  };
}

/** A fallback corner camera when the stored primitive has no worldFraming. */
function synthCornerCamera(rb) {
  const [x0, x1] = rb.xRange, [y0, y1] = rb.yRange, h = rb.zRange[1];
  const w = x1 - x0, d = y1 - y0;
  return { name: 'corner', worldFraming: {
    cameraPosition: [x0 - 0.25 * w, y1 + 0.45 * d, h * 0.8],
    lookAt: [(x0 + x1) / 2, y0 + 0.35 * d, h * 0.42],
    horizontalFov: 78,
  } };
}

// ── declarative scene lighting (the model-facing dials) ──────────────────────
// A manifest authors light with simple fields — a `scene.time` preset, or an
// explicit `scene.lighting` object (the full lighting model), plus `scene.sky` —
// never the engine. `time` is the intent the model reaches for; the rest defaults.
// ARTISTIC time-of-day presets (atmosphere = part of the message).
const TIME_PRESETS = {
  day:   { vexar: { direction: [0.35, 0.40, -0.84], ambient: 0.62, diffuse: 0.50 }, tint: [1.0, 1.0, 1.02], sky: { preset: 'day' } },
  dawn:  { vexar: { direction: [-0.4, 0.34, -0.82], ambient: 0.44, diffuse: 0.42 }, tint: [1.06, 0.99, 0.9 ], sky: { preset: 'dawn' } },
  dusk:  { vexar: { direction: [0.45, 0.30, -0.80], ambient: 0.42, diffuse: 0.40 }, tint: [1.08, 0.99, 0.86], sky: { preset: 'dusk' } },
  night: { vexar: { direction: [0.20, 0.30, -0.90], ambient: 0.26, diffuse: 0.22 }, tint: [0.90, 0.95, 1.08], sky: { preset: 'night', stars: true, moon: true } },
};
// NAMED lighting modes. `flat` is the TECHNICAL default: even high-ambient shade that
// reads form but carries no atmosphere — no contact shadow, no pools, no sky. The
// decision rule: technical drawings / scientific explanations → 'flat'; artistic
// depictions where the light is part of the message → a `time`.
const LIGHTING_PRESETS = {
  flat: { vexar: { direction: [0.3, 0.35, -0.86], ambient: 0.84, diffuse: 0.16 }, gravity: false },
};

/**
 * Resolve a manifest's declarative scene-lighting fields into a `lighting` object +
 * `sky` for the renderer. `scene.time` ('day'|'dawn'|'dusk'|'night') is the artistic
 * preset; `scene.lighting` is either a named mode string ('flat' — technical) or the
 * full lighting object (vexar/tint/sources/lamps/diffusion), which overrides the time
 * preset; `scene.sky` overrides the preset sky. Returns nulls when nothing is declared
 * (so the legacy default lighting is kept).
 */
export function resolveSceneLighting(manifest = {}) {
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const time = scene.time || manifest.time;
  const lightingIn = scene.lighting ?? manifest.lighting;
  const skyIn = scene.sky ?? manifest.sky;
  if (!time && lightingIn == null && skyIn === undefined) return { lighting: null, sky: null };
  // a NAMED mode ('flat' for technical) — no atmosphere, no sky unless explicitly set
  if (typeof lightingIn === 'string') {
    const mode = LIGHTING_PRESETS[lightingIn];
    return { lighting: mode ? { ...mode } : null, sky: skyIn ?? null };
  }
  const preset = (time && TIME_PRESETS[time]) || {};
  const lighting = {
    vexar: lightingIn?.vexar || preset.vexar,
    tint: lightingIn?.tint || preset.tint,
    ...(lightingIn?.sources ? { sources: lightingIn.sources } : {}),
    ...(lightingIn?.lamps ? { lamps: lightingIn.lamps } : {}),
    ...(lightingIn?.diffusion ? { diffusion: lightingIn.diffusion } : {}),
    ...(lightingIn?.gravity !== undefined ? { gravity: lightingIn.gravity } : {}),
  };
  return { lighting, sky: skyIn ?? preset.sky ?? null };
}

/**
 * Extract a stored two-point room manji-tree manifest into preserve-3d faces + cameras.
 * Honors the manifest's declarative `scene.lighting`/`scene.time`/`scene.sky`.
 * Returns null when the manifest is not an eligible two-point room.
 */
export function extractRoomFacesFromManifest(manifest = {}, { light, lighting, shellOmit } = {}) {
  const cameraPrimitive = manifest.cameraPrimitive || manifest.scene?.cameraPrimitive || {};
  const pureMandala = manifest.polygonizer?.pureMandala || manifest.pureMandala || {};
  if (cameraPrimitive.kind !== 'two-point' || !pureMandala.room) return null;

  const roomConcept = manifest.polygonizer?.roomConcept || manifest.polygonizer?.roomPlanning || {};
  const elements = Array.isArray(roomConcept.elements) ? roomConcept.elements : [];
  const roomBasis = roomBasisFromPureMandala(pureMandala.room);
  const resolved = resolveSceneLighting(manifest);
  const effLighting = lighting || resolved.lighting;          // explicit override → manifest → null (default)
  const omit = shellOmit ?? ['frontWall'];           // default: open-front room (camera side)
  // wall surface subtype ('cave' → inward wave mesh), authored on the scene or the room primitive.
  const wallSurface = manifest.scene?.wallSurface || pureMandala.room.surface;
  const base = { elements, roomBasis, shellOmit: omit, wallSurface };
  const { faces, faceCount } = extractRoomSceneFaces(effLighting ? { ...base, lighting: effLighting } : { ...base, light });

  const wf = cameraPrimitive.worldFraming;
  const hasWF = wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt);
  const cameras = hasWF
    ? [{ name: 'view', worldFraming: wf }, synthCornerCamera(roomBasis)]
    : [synthCornerCamera(roomBasis)];
  const viewBox = cameraPrimitive.viewBox || manifest.viewBox || { width: 1080, height: 720 };
  return { faces, faceCount, cameras, viewBox, sky: resolved.sky, cameraSynthesized: !hasWF };
}

/** Stored two-point room manji-tree manifest → self-contained preserve-3d HTML (or null). */
export function renderRoomManifestToHtml(manifest, { unitScale = 26, title = 'mojulo room', light, lighting, signs } = {}) {
  const extracted = extractRoomFacesFromManifest(manifest, { light, lighting });
  if (!extracted) return null;
  return emitPreserve3dScene({ faces: extracted.faces, cameras: extracted.cameras, viewBox: extracted.viewBox, unitScale, title, sky: extracted.sky || undefined, signs });
}

/**
 * Stored two-point room manifest → traversable World payload (or null when the manifest is
 * not an eligible room). Sibling of assembleBoxCityScene for the /world route: returns the
 * engine-agnostic { faces, cameras, viewBox, title, bg, sky } that emitThreeWorld consumes,
 * so a furnished room opens as a walk-through World with the same tagged-shell cutaway +
 * object-glow the renderer gives every scene.
 *
 * `scene.roomMode` picks wall handling: 'immersive' (full 4-wall shell → render-time
 * auto-cutaway hides the near walls) or 'showcase' (bake-time 2-wall + open-roof cutaway).
 * `scene.shellOmit` (array of surface ids) overrides explicitly. Default keeps the open-front
 * room (frontWall omitted) — the same shell the CSS-3D /scene path renders.
 */
export function assembleRoomScene(manifest = {}, { title = 'mojulo room', bg = '#0e1014', light, lighting } = {}) {
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const shellOmit = Array.isArray(scene.shellOmit) ? scene.shellOmit
    : scene.roomMode === 'immersive' ? []
      : scene.roomMode === 'showcase' ? ['frontWall', 'rightWall', 'ceiling']
        : undefined;
  const extracted = extractRoomFacesFromManifest(manifest, { light, lighting, shellOmit });
  if (!extracted) return null;
  return { faces: extracted.faces, cameras: extracted.cameras, viewBox: extracted.viewBox, title, bg, sky: extracted.sky || undefined };
}

// ── cityscape: architecture planner allocations → world faces (additive; the
//    glyph/fractal planner — planArchitectureMandala — is consumed, never changed) ──
//
// The planner is a 2D picture-plane allocator (normalized {u,v,w,h} slots). It has
// no 3D world model, so this resolver SYNTHESIZES one — promoting the spike's
// worldRectFromSurfaceSlot / cuboid / height-table logic into reusable geometry.

const DEFAULT_CITY_BASIS = {
  worldExtent: { width: 34, depth: 22, height: 18 },
  // surface-slot → world footprint (matches the architecture spike's mapping)
  map: { x0: 1.7, xScale: 30.5, y0: 1.5, yScale: 18.5 },
};
const DEFAULT_CITY_CAMERAS = [
  { name: 'street', worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [16, 8, 5], horizontalFov: 82, pictureCenter: [560, 390] } },
];
// prop heights (world units), lifted from the spike's street-furniture table
const PROP_HEIGHT = {
  'urban.newsstand-vendor': 0.92, 'urban.phone-booth': 1.35, 'urban.hydrant-utility': 0.72,
  'urban.traffic-signals': 1.85, 'urban.billboard-signage': 1.8, 'urban.gas-station': 1.65,
  'urban.bus-stop-shelter': 1.2, 'civic.public-realm-kit': 1.1, 'infrastructure.cell-tower': 4.8,
  'infrastructure.power-tower': 4.4,
};
const GROUND_TINT = {
  roadPlane: '#3b424c', sidewalk: '#cfcabf', plaza: '#d2cfc5', lotPad: '#c5bfb3',
  yard: '#c3bca9', field: '#bccb9a', dock: '#b0855c', transportApron: '#c2c6ce', railPlatform: '#c1b8aa',
};

const slotWorldRect = (surface, slot, m) => {
  const u = surface.rect.u + slot.u * surface.rect.w, v = surface.rect.v + slot.v * surface.rect.h;
  return { x: m.x0 + u * m.xScale, y: m.y0 + v * m.yScale, w: slot.w * surface.rect.w * m.xScale, d: slot.h * surface.rect.h * m.yScale };
};
const surfaceWorldRect = (surface, m) => ({
  x: m.x0 + surface.rect.u * m.xScale, y: m.y0 + surface.rect.v * m.yScale,
  w: surface.rect.w * m.xScale, d: surface.rect.h * m.yScale,
});
const facadeBg = (floors, bays, glass, frame = 'rgba(8,11,17,.85)') =>
  `repeating-linear-gradient(to right, ${frame} 0 1.4px, transparent 1.4px calc(100%/${bays})),`
  + `repeating-linear-gradient(to top, ${frame} 0 1.4px, transparent 1.4px calc(100%/${floors})),${glass}`;
const cityHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
// hex palettes (scaleHex is hex-only — never feed it hsl())
const GLASS_PAL = ['#8fb0cf', '#7fa3b8', '#92b6a6', '#a3aecb', '#bda28c', '#88a0c4'];
const PROP_PAL = ['#b9c2cc', '#c4b8a8', '#a8b6a0', '#c9bcae', '#b0a8c0', '#bcc6b2'];

// a flat ground quad at height z, normal up
function groundFace(r, z, fill, L) {
  const c = [[r.x, r.y, z], [r.x + r.w, r.y, z], [r.x + r.w, r.y + r.d, z], [r.x, r.y + r.d, z]];
  return { corners: c, fill: scaleHex(fill, litFactor([0, 0, 1], L)), doubleSided: true };
}
// A facade wall face carries BOTH realizations of the same facade: `bg` (the
// CSS-3D gradient, painted by the preserve-3d emitter) and `card` + `lit` (the
// mark-card, realized as window geometry by the WebGL World — see facade-card.js
// / expandSurfaceCards). Every facade wall of every building shape is born through
// this one constructor so the two renderers stay in lockstep — the first-class
// "detail-as-card" seam. `html` is the brick child-window markup (CSS-3D only).
function facadeFace(corners, facade, lit, floors, bays, html = '') {
  return { corners, bg: facadeCss(facade, lit, floors, bays), card: buildFacadeCard(facade, floors, bays), lit, html };
}

// town dwelling roof: roof.js is foot-scaled (eave ≈ 1.6, ridge/rafter trim absolute), but a
// fractal-town house is only ~2 world units. Build the roof at K× (roof.js's tuned house-feet
// regime) over a local footprint, then map every corner back DOWN by 1/K about the wall-top —
// a uniform similarity transform, so every trim proportion (overhang, ridge, coursing) is kept
// and normals/clip/uv pass through unchanged (the SAME generate-big→scale-down trick as baseScale).
const TOWN_ROOF_K = 10;
function townRoofFaces(b, L) {
  const spec = typeof b.roof === 'string' ? { style: b.roof } : (b.roof || {});
  const K = TOWN_ROOF_K;
  const { faces, textureKeys } = buildRoof({ x: 0, y: 0, w: b.w * K, d: b.d * K, z: 0 }, { ...spec, light: L });
  const out = faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [b.x + x / K, b.y + y / K, b.z1 + z / K]) }));
  return { faces: out, textureKeys };
}

// town house walls: 4 tinted wall quads (carrying a neutral facade TEXTURE for the World render —
// brick / clapboard / stucco, multiply-lit by the tint) + a flat top under the roof. The CSS-3D
// path ignores the texture and shows the flat tint, so the curated colour read is unchanged.
const WALL_TILE = 1.1;                                                // world units per facade-texture repeat
function townHouseWalls(faces, b, L, sceneTextures) {
  const texKey = b.wallTex, url = texKey ? surfaceTexture(texKey) : null;
  if (url && sceneTextures && !sceneTextures[texKey]) sceneTextures[texKey] = url;
  const tint = b.tint || '#cabfa8';
  const { x, y, w, d, z0, z1 } = b, x1 = x + w, y1 = y + d, hh = (z1 - z0) / WALL_TILE;
  const wall = (corners, n, along) => {
    const f = { corners, normal: n, fill: scaleHex(tint, litFactor(n, L)), doubleSided: true };
    if (url) { const a = along / WALL_TILE; f.texture = texKey; f.textureLit = true; f.uv = [[0, 0], [a, 0], [a, hh], [0, hh]]; }
    faces.push(f);
  };
  wall([[x, y, z0], [x1, y, z0], [x1, y, z1], [x, y, z1]], [0, -1, 0], w);          // south (y-)
  wall([[x1, y1, z0], [x, y1, z0], [x, y1, z1], [x1, y1, z1]], [0, 1, 0], w);       // north (y+)
  wall([[x, y1, z0], [x, y, z0], [x, y, z1], [x, y1, z1]], [-1, 0, 0], d);          // west (x-)
  wall([[x1, y, z0], [x1, y1, z0], [x1, y1, z1], [x1, y, z1]], [1, 0, 0], d);       // east (x+)
  faces.push({ corners: [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], normal: [0, 0, 1], fill: scaleHex(tint, 1.04), doubleSided: false });
}

// a rectangular panel proud of one wall of box b — window/door overlay primitive for town houses.
// side ∈ {y-,y+,x-,x+}; a0..a1 are the along-wall coords (x for y-walls, y for x-walls).
function wallPanel(side, b, a0, a1, z0, z1, eps) {
  if (side === 'y-') { const y = b.y - eps; return { c: [[a0, y, z0], [a1, y, z0], [a1, y, z1], [a0, y, z1]], n: [0, -1, 0] }; }
  if (side === 'y+') { const y = b.y + b.d + eps; return { c: [[a0, y, z0], [a1, y, z0], [a1, y, z1], [a0, y, z1]], n: [0, 1, 0] }; }
  if (side === 'x-') { const x = b.x - eps; return { c: [[x, a0, z0], [x, a1, z0], [x, a1, z1], [x, a0, z1]], n: [-1, 0, 0] }; }
  const x = b.x + b.w + eps; return { c: [[x, a0, z0], [x, a1, z0], [x, a1, z1], [x, a0, z1]], n: [1, 0, 0] };
}

// a horizontal ledge protruding `out` from one wall at height z, spanning along-wall a0..a1 —
// the window-sill / belt-course primitive (faces up).
function wallLedge(side, b, a0, a1, z, out) {
  if (side === 'y-') return { c: [[a0, b.y, z], [a1, b.y, z], [a1, b.y - out, z], [a0, b.y - out, z]], n: [0, 0, 1] };
  if (side === 'y+') { const y = b.y + b.d; return { c: [[a0, y, z], [a1, y, z], [a1, y + out, z], [a0, y + out, z]], n: [0, 0, 1] }; }
  if (side === 'x-') return { c: [[b.x, a0, z], [b.x, a1, z], [b.x - out, a1, z], [b.x - out, a0, z]], n: [0, 0, 1] };
  const x = b.x + b.w; return { c: [[x, a0, z], [x, a1, z], [x + out, a1, z], [x + out, a0, z]], n: [0, 0, 1] };
}

// dress a town HOUSE box with windows (a grid per storey, on all four walls) + a front door —
// the cheap residential read the city facade machinery (3-floor-min, tower-tuned) can't give a
// 1–2 storey dwelling. Walls keep the curated stucco tint; these are just overlay faces.
function dressHouseFacade(faces, b, L) {
  const H = b.z1 - b.z0; if (H < 0.5) return;
  const storeys = Math.max(1, Math.min(3, b.storeys || (H > 1.7 ? 2 : 1)));
  const glass = '#49545f', trim = '#efe9da', shutter = b.shutter;
  const panel = (side, a0, a1, z0, z1, eps, tint) => { const p = wallPanel(side, b, a0, a1, z0, z1, eps); faces.push({ corners: p.c, normal: p.n, fill: scaleHex(tint, litFactor(p.n, L)), doubleSided: true }); };
  const ledge = (side, a0, a1, z, out, tint) => { const p = wallLedge(side, b, a0, a1, z, out); faces.push({ corners: p.c, normal: p.n, fill: scaleHex(tint, litFactor(p.n, L)), doubleSided: true }); };
  for (const side of ['y-', 'y+', 'x-', 'x+']) {
    const vertical = side[0] === 'y';
    const len = vertical ? b.w : b.d, a0base = vertical ? b.x : b.y;
    const cols = Math.max(1, Math.min(4, Math.round(len / 0.62)));
    const cellW = len / cols, winW = Math.min(0.26, cellW * 0.5), winH = Math.min(0.34, (H / storeys) * 0.42);
    const gi = Math.min(0.035, winW * 0.18);                         // trim border width
    const isFront = side === b.front;
    for (let r = 0; r < storeys; r++) {
      const z0 = b.z0 + (r + 0.5) * (H / storeys) - winH / 2;
      for (let c = 0; c < cols; c++) {
        const cx = a0base + (c + 0.5) * cellW;
        if (isFront && r === 0 && Math.abs(cx - (a0base + len / 2)) < cellW * 0.5) continue;   // leave the door cell clear
        panel(side, cx - winW / 2, cx + winW / 2, z0, z0 + winH, 0.004, trim);                 // trim surround
        panel(side, cx - winW / 2 + gi, cx + winW / 2 - gi, z0 + gi, z0 + winH - gi, 0.006, glass);   // glass pane
        const my = z0 + winH / 2;
        panel(side, cx - winW / 2 + gi, cx + winW / 2 - gi, my - 0.012, my + 0.012, 0.008, trim);     // sash muntin (two-light read)
        ledge(side, cx - winW / 2 - 0.02, cx + winW / 2 + 0.02, z0 - 0.012, 0.045, trim);             // sill ledge under the window
        if (isFront && shutter) {                                                                     // shutters flank front windows
          const shw = Math.min(winW * 0.5, (cellW - winW) * 0.4);
          if (shw > 0.025) { panel(side, cx - winW / 2 - shw, cx - winW / 2, z0, z0 + winH, 0.005, shutter); panel(side, cx + winW / 2, cx + winW / 2 + shw, z0, z0 + winH, 0.005, shutter); }
        }
      }
    }
  }
  if (b.front) {                                                     // front door: trim surround + wood slab + ground stoop
    const vertical = b.front[0] === 'y';
    const len = vertical ? b.w : b.d, a0base = vertical ? b.x : b.y;
    const dw = Math.min(0.22, len * 0.2), dh = Math.min(0.55, H * 0.55), cx = a0base + len / 2;
    panel(b.front, cx - dw / 2 - 0.025, cx + dw / 2 + 0.025, b.z0, b.z0 + dh + 0.03, 0.004, trim);
    panel(b.front, cx - dw / 2, cx + dw / 2, b.z0, b.z0 + dh, 0.007, '#5b4636');
    const so = 0.14, sw = dw + 0.08, z = 0.03, n = [0, 0, 1];        // stoop pad on the ground at the threshold
    let c;
    if (b.front === 'y-') c = [[cx - sw / 2, b.y - so, z], [cx + sw / 2, b.y - so, z], [cx + sw / 2, b.y, z], [cx - sw / 2, b.y, z]];
    else if (b.front === 'y+') { const y = b.y + b.d; c = [[cx - sw / 2, y, z], [cx + sw / 2, y, z], [cx + sw / 2, y + so, z], [cx - sw / 2, y + so, z]]; }
    else if (b.front === 'x-') c = [[b.x - so, cx - sw / 2, z], [b.x, cx - sw / 2, z], [b.x, cx + sw / 2, z], [b.x - so, cx + sw / 2, z]];
    else { const x = b.x + b.w; c = [[x, cx - sw / 2, z], [x + so, cx - sw / 2, z], [x + so, cx + sw / 2, z], [x, cx + sw / 2, z]]; }
    faces.push({ corners: c, normal: n, fill: scaleHex('#b3a999', litFactor(n, L)), doubleSided: true });
  }
}

// dress a town GARAGE box with a wide sectional door (trim surround + panel + horizontal grooves)
// on its front wall — the driveway leads here. Walls are the same textured townHouseWalls.
function dressGarage(faces, b, L) {
  if (!b.front) return;
  const H = b.z1 - b.z0, vertical = b.front[0] === 'y';
  const len = vertical ? b.w : b.d, a0 = vertical ? b.x : b.y;
  const dw = Math.min(len * 0.72, len - 0.14), dh = Math.min(H * 0.78, H - 0.08), cx = a0 + len / 2;
  const panel = (p0, p1, z0, z1, eps, tint) => { const q = wallPanel(b.front, b, p0, p1, z0, z1, eps); faces.push({ corners: q.c, normal: q.n, fill: scaleHex(tint, litFactor(q.n, L)), doubleSided: true }); };
  panel(cx - dw / 2 - 0.02, cx + dw / 2 + 0.02, b.z0, b.z0 + dh + 0.02, 0.004, '#efe9da');   // trim surround
  panel(cx - dw / 2, cx + dw / 2, b.z0, b.z0 + dh, 0.006, '#d6d1c4');                          // door panel
  for (let i = 1; i < 4; i++) { const z = b.z0 + (i / 4) * dh; panel(cx - dw / 2, cx + dw / 2, z - 0.008, z + 0.008, 0.008, '#b6b0a2'); }   // sectional grooves
}

// a box: top (shaded, up) + 4 sides (single-sided, natural winding so backface-cull
// shows only camera-facing sides; local x=width, local y=up → facade grid lands right)
function cityBox(r, z0, z1, { top, side, glass, facade, floors, bays }, L, camHint) {
  const { x, y, w, d } = r, x1 = x + w, y1 = y + d;
  const faces = [];
  const topQ = [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]];
  faces.push({ corners: windToward(topQ, [(x + x1) / 2, (y + y1) / 2, 1e4]), fill: scaleHex(top, litFactor([0, 0, 1], L)) });
  const sides = [
    [[x, y, z0], [x1, y, z0], [x1, y, z1], [x, y, z1]],       // -y
    [[x1, y1, z0], [x, y1, z0], [x, y1, z1], [x1, y1, z1]],   // +y
    [[x, y1, z0], [x, y, z0], [x, y, z1], [x, y1, z1]],       // -x
    [[x1, y, z0], [x1, y1, z0], [x1, y1, z1], [x1, y, z1]],   // +x
  ];
  const html = facade && facade.material === 'brick' ? facadeHtml(facade, floors, bays) : '';
  for (const s of sides) {
    const lit = litFactor(normalToward(s, camHint), L);
    if (facade) faces.push(facadeFace(s, facade, lit, floors, bays, html));
    else if (glass) faces.push({ corners: s, bg: facadeBg(floors, bays, scaleHex(glass, lit)) });
    else faces.push({ corners: s, fill: scaleHex(side, lit) });
  }
  return faces;
}

// a cylindrical (N-gon prism) skyscraper: vertical side facades + a clipped N-gon roof cap
function cylinderBuilding(b, facade, floors, L, camHint) {
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, r = Math.min(b.w, b.d) / 2, N = 14;
  const ring = (z) => Array.from({ length: N }, (_, i) => { const a = (i / N) * 2 * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  const bot = ring(b.z0), top = ring(b.z1), faces = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, s = [bot[i], bot[j], top[j], top[i]];
    faces.push(facadeFace(s, facade, litFactor(normalToward(s, camHint), L), floors, 1));
  }
  const capPts = Array.from({ length: N }, (_, i) => { const a = (i / N) * 2 * Math.PI; return `${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`; }).join(', ');
  const cap = [[cx - r, cy - r, b.z1], [cx + r, cy - r, b.z1], [cx + r, cy + r, b.z1], [cx - r, cy + r, b.z1]];
  faces.push({ corners: windToward(cap, [cx, cy, 1e4]), fill: scaleHex(facade.glass, 0.62), clip: `polygon(${capPts})` });
  return faces;
}
// a setback (stepped) skyscraper: stacked boxes with decreasing footprint
function setbackBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, hf = [0.5, 0.3, 0.2], faces = [];
  let z = b.z0, x = b.x, y = b.y, w = b.w, d = b.d;
  for (let t = 0; t < 3; t++) {
    const th = h * hf[t], fl = Math.max(2, Math.round(th / facade.floorH)), by = Math.max(2, Math.round(w / facade.bayW));
    faces.push(...cityBox({ x, y, w, d }, z, z + th, { facade, floors: fl, bays: by, top: scaleHex(facade.glass, 0.62) }, L, camHint));
    z += th;
    if (t < 2) { const ins = Math.min(w, d) * 0.18; x += ins / 2; y += ins / 2; w -= ins; d -= ins; }
  }
  return faces;
}

// "tower on podium": a tall narrow tower (slab) rising from a WIDE LOW base. The base
// is the full footprint, 2–3 floors; the tower is inset and centred, the rest of the
// height. The exposed base roof reads as a podium terrace.
function podiumBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, faces = [];
  const baseH = Math.max(facade.floorH * 1.6, Math.min(h * 0.30, facade.floorH * 3));
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z0 + baseH,
    { facade, floors: Math.max(2, Math.round(baseH / facade.floorH)), bays: Math.max(2, Math.round(b.w / facade.bayW)), top: scaleHex(facade.glass, 0.5) }, L, camHint));
  const iw = b.w * 0.28, id = b.d * 0.34, tw = b.w - iw, td = b.d - id;
  faces.push(...cityBox({ x: b.x + iw / 2, y: b.y + id / 2, w: tw, d: td }, b.z0 + baseH, b.z1,
    { facade, floors: Math.max(3, Math.round((h - baseH) / facade.floorH)), bays: Math.max(2, Math.round(tw / facade.bayW)), top: scaleHex(facade.glass, 0.62) }, L, camHint));
  return faces;
}

// mixed-use COMPLEX: a long low retail box (shopping complex) with a taller condo
// tower (cylinder or box) at one end — either ABOVE the podium or BESIDE it (a
// full-height tower with the retail filling the remaining length). Variant + end +
// tower-form are chosen deterministically from the footprint position.
function complexBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, faces = [];
  const hsh = Math.abs(Math.sin(b.x * 12.9898 + b.y * 78.233) * 43758.5453);
  const r1 = hsh % 1, r2 = (hsh * 7.37) % 1, r3 = (hsh * 3.11) % 1;
  const long = b.w >= b.d ? 'x' : 'y', end = r2 < 0.5, cyl = r3 < 0.55;
  const baseH = Math.max(facade.floorH * 1.7, Math.min(h * 0.30, facade.floorH * 3));
  const fl = (hh) => Math.max(2, Math.round(hh / facade.floorH));
  const by = (ww) => Math.max(2, Math.round(ww / facade.bayW));
  const podium = (r, z0, z1) => cityBox(r, z0, z1, { facade, floors: fl(z1 - z0), bays: by(Math.max(r.w, r.d)), top: scaleHex(facade.glass, 0.46) }, L, camHint);
  const tower = (r, z0, z1) => (cyl
    ? cylinderBuilding({ ...r, z0, z1 }, facade, fl(z1 - z0), L, camHint)
    : cityBox(r, z0, z1, { facade, floors: fl(z1 - z0), bays: by(Math.min(r.w, r.d)), top: scaleHex(facade.glass, 0.62) }, L, camHint));

  if (r1 < 0.5) {
    // ABOVE — long retail podium (full footprint) + a point condo tower on one end
    faces.push(...podium({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z0 + baseH));
    const ts = Math.min(b.w, b.d) * 0.86, tr = long === 'x'
      ? { x: end ? b.x + b.w - ts : b.x, y: b.y + (b.d - ts) / 2, w: ts, d: ts }
      : { x: b.x + (b.w - ts) / 2, y: end ? b.y + b.d - ts : b.y, w: ts, d: ts };
    faces.push(...tower(tr, b.z0 + baseH, b.z1));
  } else {
    // BESIDE — a full-height condo tower at one end + retail podium on the remainder
    const split = 0.4 + r2 * 0.16;
    let tr, pr;
    if (long === 'x') { const tw2 = b.w * split; tr = { x: end ? b.x + b.w - tw2 : b.x, y: b.y, w: tw2, d: b.d }; pr = { x: end ? b.x : b.x + tw2, y: b.y, w: b.w - tw2, d: b.d }; }
    else { const td2 = b.d * split; tr = { x: b.x, y: end ? b.y + b.d - td2 : b.y, w: b.w, d: td2 }; pr = { x: b.x, y: end ? b.y : b.y + td2, w: b.w, d: b.d - td2 }; }
    if (pr.w > 0.6 && pr.d > 0.6) faces.push(...podium(pr, b.z0, b.z0 + baseH));
    faces.push(...tower(tr, b.z0, b.z1));
  }
  return faces;
}

// ── religious place (church) ────────────────────────────────────────────────────
// A church-class mass with an unmistakable silhouette, built from the same planar-face
// primitive as every other building. Two variants (b.churchVariant), both reusing an
// already-placed building footprint (so they're road-clear) and computing their own
// proportions from it — the incoming z1 is ignored:
//   • 'chapel'   (default) — a NAVE under a pitched GABLE roof, a front BELL TOWER, a
//                 four-sided pyramidal SPIRE, and a rooftop CROSS.
//   • 'basilica' — a grander GOTHIC-REVIVAL twin-tower front (Notre-Dame-de-Montréal):
//                 two flat-topped CRENELLATED towers with corner PINNACLES flanking a
//                 central gabled facade with three pointed PORTALS, tiers of pointed
//                 LANCET windows, and a cross. Taller; wants a bigger footprint.
// Palette is overridable via b.churchPalette (the per-locale "hatch"); defaults to warm
// stone + verdigris copper.
const CHURCH_PALETTE = { wall: '#dcd6c8', roof: '#4f7d6e', spire: '#4a7567', door: '#3a2b22', cross: '#c9a23a' };
function churchBuilding(b, L, camHint) {
  const pal = { ...CHURCH_PALETTE, ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  // a flat TRIANGLE A,B,T: the emitter only draws parallelograms, so bound it with a quad
  // [A, B, B+h, A+h] (h = apex height vector ⟂ to the base) and clip it back to the triangle.
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), baseLen = len(Uw), ub = norm(Uw);
    const Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));   // perpendicular foot→apex height vector
    if (len(Vw) < 1e-4) return;
    const apexU = dot(sub(T, A), ub) / baseLen;                  // apex position along the base (0..1)
    faces.push({
      corners: [A, B, add(B, Vw), add(A, Vw)],
      fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)),
      doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(apexU * 100).toFixed(1)}% 100%)`,
    });
  };
  const along = b.w >= b.d ? 'x' : 'y';                 // nave runs down the longer axis
  const aLen = along === 'x' ? b.w : b.d, cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x;
  const cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);   // (along, across, height) → world
  const z0 = b.z0;
  const a1 = a0 + aLen;                                  // rear of the nave (shared by both variants)

  // ── variant: GOTHIC-REVIVAL BASILICA (twin crenellated towers) ────────────────
  if (b.churchVariant === 'basilica') {
    const c1 = c0 + cLen, eps = 0.04;
    // INVERTED palette vs the chapel: a dark stone facade with PALE arched windows
    // (the cross is dropped — the twin-tower silhouette is iconic enough). Overridable
    // via b.churchPalette.
    const bpal = { wall: '#514c46', roof: '#39554c', window: '#cbd2d6', portal: '#241f1b', pinnacle: '#5b564e', ...(b.churchPalette || {}) };
    const ARCH = '0 0 50% 50% / 0 0 38% 38%';   // rounds the world-top corners → a curved arch (no triangular point)
    // an axis-aligned box in (along, across) terms, mapped to the right world rect
    const boxAC = (a, c, da, dc, zlo, zhi, tint) => {
      if (da <= 0 || dc <= 0 || zhi <= zlo) return;
      const r = along === 'x' ? { x: a, y: c, w: da, d: dc } : { x: c, y: a, w: dc, d: da };
      faces.push(...cityBox(r, zlo, zhi, { top: scaleHex(tint, 1.05), side: tint }, L, camHint));
    };
    // a small 4-sided pyramid (tower-corner pinnacle) centred at (a,c)
    const pinnacle = (a, c, s, zb, h, tint) => {
      const ring = [[a - s, c - s], [a + s, c - s], [a + s, c + s], [a - s, c + s]];
      for (let i = 0; i < 4; i++) { const [pa, pc] = ring[i], [qa, qc] = ring[(i + 1) % 4]; tri(P(pa, pc, zb), P(qa, qc, zb), P(a, c, zb + h), tint); }
    };
    // a crenellated parapet (merlons + gaps) ringing a rectangle's top edge
    const crenelRing = (aLo, aHi, cLo, cHi, zTop, mh, tint) => {
      const mw = 0.26, th = 0.16;
      for (let c = cLo; c < cHi - 1e-6; c += 2 * mw) { const w = Math.min(mw, cHi - c); boxAC(aLo, c, th, w, zTop, zTop + mh, tint); boxAC(aHi - th, c, th, w, zTop, zTop + mh, tint); }
      for (let a = aLo + th; a < aHi - th - 1e-6; a += 2 * mw) { const w = Math.min(mw, aHi - th - a); boxAC(a, cLo, w, th, zTop, zTop + mh, tint); boxAC(a, cHi - th, w, th, zTop, zTop + mh, tint); }
    };
    // an arched window/portal proud of a wall plane, drawn as a single rounded rectangle
    // (the top corners curve via border-radius — no triangular relief). `arch(corners,tint)`.
    const arch = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true, radius: ARCH });
    // on the FRONT plane (a = a0, exterior toward −A), across cA..cB, from zlo to zTop
    const archFront = (cA, cB, zlo, zTop, tint) => { const a = a0 - eps; arch([P(a, cA, zlo), P(a, cB, zlo), P(a, cB, zTop), P(a, cA, zTop)], tint); };
    // on a tower OUTER SIDE plane (c = cF, exterior toward sgn), along aA..aB
    const archSide = (cF, sgn, aA, aB, zlo, zTop, tint) => { const c = cF + sgn * eps; arch([P(aA, c, zlo), P(aB, c, zlo), P(aB, c, zTop), P(aA, c, zTop)], tint); };

    const towerW = Math.min(cLen * 0.34, aLen * 0.46), towerDepth = towerW;
    const towerTop = z0 + Math.max(4.2, cLen * 1.5);
    const tH = towerTop - z0;
    const towers = [[c0, c0 + towerW], [c1 - towerW, c1]];
    const fcL = c0 + towerW, fcR = c1 - towerW, span = Math.max(0.4, fcR - fcL);
    const facadeTop = z0 + tH * 0.6, parapet = Math.max(0.3, cLen * 0.15), facadeDepth = towerDepth * 0.5;

    // NAVE body behind the facade (lower, gabled) — only if there's depth for it
    const nb0 = a0 + towerDepth * 0.6, ncL = c0 + towerW * 0.25, ncR = c1 - towerW * 0.25;
    if (a1 > nb0 + 0.5) {
      const naveEave = z0 + Math.max(2.2, cLen * 1.1), naveRidge = naveEave + cLen * 0.5, naveMid = (ncL + ncR) / 2;
      lit([P(nb0, ncL, z0), P(a1, ncL, z0), P(a1, ncL, naveEave), P(nb0, ncL, naveEave)], bpal.wall);
      lit([P(nb0, ncR, z0), P(a1, ncR, z0), P(a1, ncR, naveEave), P(nb0, ncR, naveEave)], bpal.wall);
      lit([P(a1, ncL, z0), P(a1, ncR, z0), P(a1, ncR, naveEave), P(a1, ncL, naveEave)], bpal.wall);
      tri(P(a1, ncL, naveEave), P(a1, ncR, naveEave), P(a1, naveMid, naveRidge), bpal.wall);
      lit([P(nb0, ncL, naveEave), P(a1, ncL, naveEave), P(a1, naveMid, naveRidge), P(nb0, naveMid, naveRidge)], bpal.roof);
      lit([P(nb0, ncR, naveEave), P(a1, ncR, naveEave), P(a1, naveMid, naveRidge), P(nb0, naveMid, naveRidge)], bpal.roof);
    }

    // CENTRAL FACADE — dark screen wall with three arched portals + a tall arched window, parapet on top
    boxAC(a0, fcL, facadeDepth, fcR - fcL, z0, facadeTop, bpal.wall);
    const portalH = (facadeTop - z0) * 0.42, pw = span * 0.22;
    for (let i = 0; i < 3; i++) { const cc = fcL + span * (0.2 + 0.3 * i); archFront(cc - pw / 2, cc + pw / 2, z0 + 0.02, z0 + portalH, bpal.portal); }
    archFront(fcL + span * 0.32, fcR - span * 0.32, z0 + portalH * 1.2, facadeTop - 0.05, bpal.window);  // great arched window
    crenelRing(a0, a0 + facadeDepth, fcL, fcR, facadeTop, parapet, bpal.wall);

    // TWIN TOWERS
    for (const [tl, tr] of towers) {
      const tw2 = tr - tl;
      boxAC(a0, tl, towerDepth, tw2, z0, towerTop, bpal.wall);
      archFront(tl + tw2 * 0.22, tr - tw2 * 0.22, z0 + tH * 0.4, z0 + tH * 0.68, bpal.window);   // lower belfry window
      archFront(tl + tw2 * 0.22, tr - tw2 * 0.22, z0 + tH * 0.72, z0 + tH * 0.93, bpal.window);  // upper window
      const outerC = tl === c0 ? c0 : c1, sgn = tl === c0 ? -1 : 1;
      archSide(outerC, sgn, a0 + towerDepth * 0.22, a0 + towerDepth * 0.78, z0 + tH * 0.72, z0 + tH * 0.93, bpal.window);
      const merl = Math.max(0.34, cLen * 0.18);
      crenelRing(a0, a0 + towerDepth, tl, tr, towerTop, merl, bpal.wall);
      const ps = tw2 * 0.19, pzb = towerTop + merl, ph = cLen * 0.28;   // stubby stone corner pinnacles
      for (const [pa, pc] of [[a0 + ps, tl + ps], [a0 + towerDepth - ps, tl + ps], [a0 + ps, tr - ps], [a0 + towerDepth - ps, tr - ps]]) pinnacle(pa, pc, ps, pzb, ph, bpal.pinnacle);
    }
    return faces;
  }

  // ── variant: EASTERN-ORTHODOX (five onion domes) ──────────────────────────────
  if (b.churchVariant === 'orthodox') {
    // white walls + a gilded central dome + four blue secondary domes (a cross-in-square,
    // five-dome plan). Onion domes are surfaces of revolution, faceted as stacked rings.
    const opal = { wall: '#e7e3d7', roof: '#b7b0a0', domeMain: '#caa63f', domeSide: '#39509a', drum: '#dcd7c8', window: '#33291f', cross: '#d8b94a', ...(b.churchPalette || {}) };
    const cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 10;
    const ringPts = (r, z, ox = cx, oy = cy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
    const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
    // onion profile: [heightFrac, radiusFactor] — bulges past 1, tapers to a point
    const ONION = [[0, 1.0], [0.14, 1.14], [0.32, 1.2], [0.5, 1.05], [0.66, 0.74], [0.8, 0.42], [0.92, 0.18], [1.0, 0.0]];
    const onion = (ox, oy, baseR, baseZ, domeH, tint) => {
      let prev = null;
      for (const [hf, rf] of ONION) {
        const z = baseZ + hf * domeH, r = baseR * rf, pts = r < 1e-3 ? null : ringPts(r, z, ox, oy);
        if (prev) { if (pts) band(prev, pts, tint); else { const apex = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], apex, tint); } }
        if (pts) prev = pts;
      }
    };
    const drumCyl = (ox, oy, r, zl, zh, tint) => band(ringPts(r, zl, ox, oy), ringPts(r, zh, ox, oy), tint);
    // a slim ORTHODOX cross (one main bar + a short upper bar) on a thin post
    const finial = (ox, oy, zb, h, tint) => {
      const bar = Math.max(0.04, h * 0.09);
      faces.push(...cityBox({ x: ox - bar / 2, y: oy - bar / 2, w: bar, d: bar }, zb, zb + h, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
      faces.push(...cityBox({ x: ox - h * 0.24, y: oy - bar / 2, w: h * 0.48, d: bar }, zb + h * 0.5, zb + h * 0.5 + bar, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
      faces.push(...cityBox({ x: ox - h * 0.13, y: oy - bar / 2, w: h * 0.26, d: bar }, zb + h * 0.74, zb + h * 0.74 + bar, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    };

    // BODY — a cubic naos, with a flat roof the domes rise from; arched windows + a portal on the front
    const bodyTop = z0 + Math.max(2.6, cLen * 1.05), eps = 0.04, aF = a0 - eps;
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, bodyTop, { top: scaleHex(opal.roof, 1.0), side: opal.wall }, L, camHint));
    const archF = (cA, cB, zlo, zTop, tint) => { const cs = [P(aF, cA, zlo), P(aF, cB, zlo), P(aF, cB, zTop), P(aF, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 42% 42%' }); };
    archF(cMid - cLen * 0.11, cMid + cLen * 0.11, z0 + 0.02, z0 + (bodyTop - z0) * 0.5, opal.window);                 // central portal
    for (const cc of [c0 + cLen * 0.24, c0 + cLen * 0.76]) archF(cc - cLen * 0.07, cc + cLen * 0.07, z0 + (bodyTop - z0) * 0.42, z0 + (bodyTop - z0) * 0.82, opal.window);

    // CENTRAL drum + gilded onion dome, with tall window slits round the drum
    const rC = cLen * 0.21, drumTop = bodyTop + cLen * 0.58;
    drumCyl(cx, cy, rC, bodyTop, drumTop, opal.drum);
    for (let i = 0; i < Nr; i += 2) {                                  // drum windows
      const a = (i / Nr) * 2 * Math.PI, px = cx + Math.cos(a) * (rC + 0.02), py = cy + Math.sin(a) * (rC + 0.02);
      const tx = -Math.sin(a) * 0.06, ty = Math.cos(a) * 0.06, wz0 = bodyTop + cLen * 0.12, wz1 = bodyTop + cLen * 0.48;
      const cs = [[px - tx, py - ty, wz0], [px + tx, py + ty, wz0], [px + tx, py + ty, wz1], [px - tx, py - ty, wz1]];
      faces.push({ corners: cs, fill: scaleHex(opal.window, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 30% 30%' });
    }
    const domeH = cLen * 1.0;
    onion(cx, cy, rC * 1.06, drumTop, domeH, opal.domeMain);
    finial(cx, cy, drumTop + domeH, cLen * 0.42, opal.cross);

    // FOUR secondary drums + blue domes, set out toward the body corners and sitting low
    const dx = b.w * 0.33, dy = b.d * 0.33, rS = cLen * 0.1, sTop = bodyTop + cLen * 0.16, sH = cLen * 0.34;
    for (const [sx, sy] of [[cx - dx, cy - dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]]) {
      drumCyl(sx, sy, rS, bodyTop, sTop, opal.drum);
      onion(sx, sy, rS * 1.06, sTop, sH, opal.domeSide);    // secondary domes carry no cross — only the central dome does
    }
    return faces;
  }

  // ── variant: CHAPEL (default) — single steeple ────────────────────────────────
  // proportions from the footprint width — a nave reads ~as tall at the eave as it is wide
  const eave = z0 + Math.max(1.5, cLen * 0.95);
  const ridge = eave + Math.max(0.9, cLen * 0.6);
  const tw = Math.min(cLen * 0.62, aLen * 0.34);        // bell-tower side (square plan, at the front)
  const aBody = a0 + tw;                                 // nave body starts behind the tower
  const cl = c0, cr = c0 + cLen;

  // NAVE — two long side walls + a rear gable wall (front is occluded by the tower)
  lit([P(aBody, cl, z0), P(a1, cl, z0), P(a1, cl, eave), P(aBody, cl, eave)], pal.wall);
  lit([P(aBody, cr, z0), P(a1, cr, z0), P(a1, cr, eave), P(aBody, cr, eave)], pal.wall);
  lit([P(a1, cl, z0), P(a1, cr, z0), P(a1, cr, eave), P(a1, cl, eave)], pal.wall);
  tri(P(a1, cl, eave), P(a1, cr, eave), P(a1, cMid, ridge), pal.wall);          // rear gable triangle
  tri(P(aBody, cl, eave), P(aBody, cr, eave), P(aBody, cMid, ridge), pal.wall); // front gable (under tower roofline)
  // GABLE ROOF — two sloped planes meeting at the ridge
  lit([P(aBody, cl, eave), P(a1, cl, eave), P(a1, cMid, ridge), P(aBody, cMid, ridge)], pal.roof);
  lit([P(aBody, cr, eave), P(a1, cr, eave), P(a1, cMid, ridge), P(aBody, cMid, ridge)], pal.roof);
  // tall arched-window hint: a slim dark recess centred on each nave flank
  const wd = pal.door;
  for (const c of [cl, cr]) {
    const am = (aBody + a1) / 2, wa = Math.min(0.7, (a1 - aBody) * 0.3);
    lit([P(am - wa / 2, c, z0 + eave * 0.18), P(am + wa / 2, c, z0 + eave * 0.18), P(am + wa / 2, c, eave * 0.78), P(am - wa / 2, c, eave * 0.78)], scaleHex(wd, 1.0));
  }

  // BELL TOWER — a tall square shaft at the front, rising above the ridge
  const tc0 = cMid - tw / 2, tc1 = cMid + tw / 2, towerTop = ridge + cLen * 0.55;
  const twWalls = [
    [P(a0, tc0, z0), P(a0 + tw, tc0, z0), P(a0 + tw, tc0, towerTop), P(a0, tc0, towerTop)],
    [P(a0, tc1, z0), P(a0 + tw, tc1, z0), P(a0 + tw, tc1, towerTop), P(a0, tc1, towerTop)],
    [P(a0, tc0, z0), P(a0, tc1, z0), P(a0, tc1, towerTop), P(a0, tc0, towerTop)],          // front face
    [P(a0 + tw, tc0, z0), P(a0 + tw, tc1, z0), P(a0 + tw, tc1, towerTop), P(a0 + tw, tc0, towerTop)],
  ];
  for (const wq of twWalls) lit(wq, pal.wall);
  // belfry louvres: a darker band near the tower top on all four faces
  const bl0 = towerTop - tw * 0.55, bl1 = towerTop - tw * 0.18;
  lit([P(a0, tc0, bl0), P(a0 + tw, tc0, bl0), P(a0 + tw, tc0, bl1), P(a0, tc0, bl1)], scaleHex(pal.door, 1.0));
  lit([P(a0, tc1, bl0), P(a0 + tw, tc1, bl0), P(a0 + tw, tc1, bl1), P(a0, tc1, bl1)], scaleHex(pal.door, 1.0));
  lit([P(a0, tc0, bl0), P(a0, tc1, bl0), P(a0, tc1, bl1), P(a0, tc0, bl1)], scaleHex(pal.door, 1.0));
  // a round-topped door at the tower base (front)
  const dw = tw * 0.5, dc = cMid;
  lit([P(a0, dc - dw / 2, z0), P(a0, dc + dw / 2, z0), P(a0, dc + dw / 2, z0 + tw * 0.9), P(a0, dc - dw / 2, z0 + tw * 0.9)], pal.door);

  // SPIRE — a four-sided pyramid from the tower top to an apex
  const apexA = a0 + tw / 2, spireH = tw * 1.7, apexZ = towerTop + spireH;
  const ring = [[a0, tc0], [a0 + tw, tc0], [a0 + tw, tc1], [a0, tc1]];
  for (let i = 0; i < 4; i++) {
    const [pa, pc] = ring[i], [qa, qc] = ring[(i + 1) % 4];
    tri(P(pa, pc, towerTop), P(qa, qc, towerTop), P(apexA, cMid, apexZ), pal.spire);
  }

  // CROSS — a vertical shaft + a horizontal bar at the apex
  const bar = Math.max(0.05, tw * 0.07), armW = tw * 0.5, armZ = apexZ + spireH * 0.34;
  faces.push(...cityBox({ x: P(apexA, cMid, 0)[0] - bar / 2, y: P(apexA, cMid, 0)[1] - bar / 2, w: bar, d: bar }, apexZ, apexZ + spireH * 0.55, { top: scaleHex(pal.cross, 1.1), side: pal.cross }, L, camHint));
  const armR = { x: P(apexA, cMid, 0)[0] - (along === 'x' ? bar : armW) / 2, y: P(apexA, cMid, 0)[1] - (along === 'x' ? armW : bar) / 2, w: along === 'x' ? bar : armW, d: along === 'x' ? armW : bar };
  faces.push(...cityBox(armR, armZ, armZ + bar, { top: scaleHex(pal.cross, 1.1), side: pal.cross }, L, camHint));
  return faces;
}

// ── religious place (mosque) ─────────────────────────────────────────────────────
// A relative of the church: same planar-face primitive, but the Islamic vocabulary,
// in four regional variants (b.mosqueVariant), all over a cubic prayer hall:
//   • 'ottoman'   (default) — a big central DOME on a low drum, four slender corner
//                 MINARETS (balcony + cap), a pointed-arch ENTRANCE, CRESCENT finials.
//   • 'persian'   — a bulbous turquoise dome on a TALL drum + a grand projecting PISHTAQ
//                 (portal screen with a deep iwan recess) flanked by two front minarets.
//   • 'sahelian'  — West-African mud mosque: NO dome; an ochre adobe mass, a tapering
//                 stepped central MINARET studded with protruding TORON beam-ends, and
//                 four conical-capped corner buttress PILLARS.
//   • 'nusantara' — Javanese: NO dome; a multi-tiered pyramidal hipped ROOF (three stacked
//                 pyramids of decreasing size) topped by a finial + crescent.
// Palette is overridable via b.churchPalette (the per-locale "hatch").
const MOSQUE_PALETTE = { wall: '#e6ddc6', roof: '#cbbf9f', dome: '#2e8074', drum: '#ddd4bd', trim: '#c9bd98', window: '#2c241c', crescent: '#e8c34a' };
const MOSQUE_PALETTES = {
  ottoman: MOSQUE_PALETTE,
  persian: { wall: '#e3d7bd', roof: '#cdbf9d', dome: '#23b3ab', drum: '#dccfb4', trim: '#2f6fae', window: '#21303c', crescent: '#e8c34a' },
  sahelian: { wall: '#b9824a', roof: '#a06e3c', dome: '#b9824a', drum: '#9c6a3a', trim: '#c79a52', window: '#2a1c10', crescent: '#d8b24a', toron: '#5a3c20' },
  nusantara: { wall: '#e2dac4', roof: '#6f4329', dome: '#6f4329', drum: '#caa15f', trim: '#caa15f', window: '#241a10', crescent: '#e8c34a' },
};
// a crescent-moon clip-path (outer circle minus an offset inner circle), in face-% space
const CRESCENT_CLIP = (() => {
  const pts = [], N = 14, oc = [0.42, 0.5], oR = 0.46, ic = [0.6, 0.5], iR = 0.4, d2r = Math.PI / 180;
  for (let i = 0; i <= N; i++) { const a = (60 + 240 * (i / N)) * d2r; pts.push([oc[0] + Math.cos(a) * oR, oc[1] + Math.sin(a) * oR]); }      // outer left arc 60→300
  for (let i = 0; i <= N; i++) { const a = (300 - 240 * (i / N)) * d2r; pts.push([ic[0] + Math.cos(a) * iR, ic[1] + Math.sin(a) * iR]); }     // inner left arc 300→60 (carves)
  return `polygon(${pts.map((p) => `${(p[0] * 100).toFixed(1)}% ${(p[1] * 100).toFixed(1)}%`).join(', ')})`;
})();
function mosqueBuilding(b, L, camHint) {
  const variant = b.mosqueVariant || 'ottoman';
  const pal = { ...(MOSQUE_PALETTES[variant] || MOSQUE_PALETTE), ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const along = b.w >= b.d ? 'x' : 'y', aLen = along === 'x' ? b.w : b.d, cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x, cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);
  // an axis-aligned footprint from (along, across) spans — respects the nave orientation
  const boxAC = (aLo, aHi, cLo, cHi) => (along === 'x'
    ? { x: aLo, y: cLo, w: aHi - aLo, d: cHi - cLo }
    : { x: cLo, y: aLo, w: cHi - cLo, d: aHi - aLo });
  const z0 = b.z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 12;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const DOME = [[0, 1.0], [0.32, 0.99], [0.56, 0.9], [0.76, 0.74], [0.9, 0.46], [1.0, 0.0]];     // rounded, slightly pointed
  const BULB = [[0, 0.86], [0.12, 0.99], [0.30, 1.08], [0.5, 1.02], [0.68, 0.82], [0.85, 0.48], [1.0, 0.0]];  // bulbous (persian onion)
  const revolve = (prof, ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of prof) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  const dome = (ox, oy, baseR, baseZ, h, tint) => revolve(DOME, ox, oy, baseR, baseZ, h, tint);
  // a square/rect PYRAMID (four triangular hips to a centred apex) — the tiered-roof unit
  const pyramidRect = (x, y, w, d, zb, ph, tint) => {
    const cs = [[x, y, zb], [x + w, y, zb], [x + w, y + d, zb], [x, y + d, zb]], ap = [x + w / 2, y + d / 2, zb + ph];
    for (let i = 0; i < 4; i++) tri(cs[i], cs[(i + 1) % 4], ap, tint);
  };
  // a gilded crescent billboard standing on a thin finial, facing the camera
  const crescent = (ox, oy, zb, s, tint) => {
    const dx = camHint[0] - ox, dy = camHint[1] - oy, l = Math.hypot(dx, dy) || 1, tx = -dy / l * s / 2, ty = dx / l * s / 2;
    const post = Math.max(0.03, s * 0.12);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + s * 0.5, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    const c0c = [ox - tx, oy - ty, zb + s * 0.5], c1c = [ox + tx, oy + ty, zb + s * 0.5];
    faces.push({ corners: [c0c, c1c, [c1c[0], c1c[1], zb + s * 1.3], [c0c[0], c0c[1], zb + s * 1.3]], fill: scaleHex(tint, litFactor([0, 0, 1], L)), doubleSided: true, clip: CRESCENT_CLIP });
  };
  // arched opening proud of the FRONT plane (a = a0, exterior toward −A)
  const eps = 0.04, archF = (cA, cB, zlo, zTop, tint) => { const cs = [P(a0 - eps, cA, zlo), P(a0 - eps, cB, zlo), P(a0 - eps, cB, zTop), P(a0 - eps, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 46% 46%' }); };

  // a corner minaret (shaft + balcony ring + cap dome + crescent), reused by ottoman & persian
  const minaret = (mx, my, rM, mTop, capH) => {
    drum(mx, my, rM, z0, mTop, pal.wall);
    const balZ = z0 + (mTop - z0) * 0.74;
    drum(mx, my, rM * 1.6, balZ, balZ + cLen * 0.05, pal.trim);
    dome(mx, my, rM * 1.15, mTop, capH, pal.dome);
    crescent(mx, my, mTop + capH, cLen * 0.2, pal.crescent);
  };

  // BODY — a broad cubic prayer hall (shared by every variant)
  const bodyTop = z0 + Math.max(2.2, cLen * 0.82);
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, bodyTop, { top: scaleHex(pal.roof, 1.0), side: pal.wall }, L, camHint));
  if (variant === 'sahelian') {
    // the tower-over-entrance facade carries the door; just a modest door + slit windows here
    archF(cMid - cLen * 0.08, cMid + cLen * 0.08, z0 + 0.02, z0 + (bodyTop - z0) * 0.5, pal.window);
    for (const cc of [c0 + cLen * 0.25, c0 + cLen * 0.75]) archF(cc - 0.045, cc + 0.045, z0 + (bodyTop - z0) * 0.46, z0 + (bodyTop - z0) * 0.7, pal.window);
  } else {
    archF(cMid - cLen * 0.15, cMid + cLen * 0.15, z0 + 0.02, z0 + (bodyTop - z0) * 0.78, pal.window);                       // grand entrance (iwan)
    for (const cc of [c0 + cLen * 0.2, c0 + cLen * 0.8]) archF(cc - cLen * 0.06, cc + cLen * 0.06, z0 + (bodyTop - z0) * 0.34, z0 + (bodyTop - z0) * 0.72, pal.window);
  }

  if (variant === 'persian') {
    // bulbous turquoise dome on a TALL drum
    const rC = cLen * 0.3, drumTop = bodyTop + cLen * 0.42, domeH = cLen * 0.82;
    drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
    revolve(BULB, cx, cy, rC * 1.06, drumTop, domeH, pal.dome);
    crescent(cx, cy, drumTop + domeH, cLen * 0.3, pal.crescent);
    // PISHTAQ — a tall portal screen projecting above the roofline, with a deep iwan recess
    const pw = cLen * 0.56, pt = Math.max(0.25, cLen * 0.16), pTop = bodyTop + cLen * 0.5;
    faces.push(...cityBox(boxAC(a0, a0 + pt, cMid - pw / 2, cMid + pw / 2), z0, pTop, { top: scaleHex(pal.trim, 1.05), side: pal.wall }, L, camHint));
    archF(cMid - pw * 0.34, cMid + pw * 0.34, z0 + 0.02, pTop - cLen * 0.16, pal.window);                                   // the iwan
    // two slender minarets flanking the pishtaq at the front corners
    const rM = cLen * 0.05, mTop = z0 + Math.max(4.5, cLen * 2.1), capH = cLen * 0.34, mi = cLen * 0.1;
    for (const [mx, my] of [P(a0 + mi, c0 + mi, 0), P(a0 + mi, c0 + cLen - mi, 0)]) minaret(mx, my, rM, mTop, capH);
  } else if (variant === 'sahelian') {
    // NO dome. A tapering, stepped central MINARET at the front, studded with toron beam-ends,
    // plus four conical-capped corner buttress pillars. Earthen ochre throughout.
    const tw0 = cLen * 0.34, twTop = z0 + Math.max(4, cLen * 1.8), aTw = a0 + tw0 * 0.55, steps = 4;
    for (let i = 0; i < steps; i++) {
      const w = tw0 * (1 - 0.5 * (i / steps)), zl = z0 + (twTop - z0) * (i / steps), zh = z0 + (twTop - z0) * ((i + 1) / steps) + 0.03;
      faces.push(...cityBox(boxAC(aTw - w / 2, aTw + w / 2, cMid - w / 2, cMid + w / 2), zl, zh, { top: scaleHex(pal.roof, 1.06), side: pal.wall }, L, camHint));
    }
    const protr = Math.max(0.08, cLen * 0.05);   // toron — rows of protruding wooden beam-ends
    for (let row = 0; row < 3; row++) {
      const f = 0.28 + row * 0.2, zt = z0 + (twTop - z0) * f, w = tw0 * (1 - 0.5 * f);
      for (let k = -1; k <= 1; k++) {
        const cc = cMid + k * w * 0.32;
        faces.push(...cityBox(boxAC(aTw - w / 2 - protr, aTw - w / 2 + 0.02, cc - 0.05, cc + 0.05), zt, zt + 0.07, { top: pal.toron, side: pal.toron }, L, camHint));
      }
    }
    const twC = P(aTw, cMid, 0);
    crescent(twC[0], twC[1], twTop, cLen * 0.18, pal.crescent);
    const pin = cLen * 0.08, pinH = z0 + Math.max(2.8, cLen * 1.05), pinIn = cLen * 0.1;
    for (const [px, py] of [[b.x + pinIn, b.y + pinIn], [b.x + b.w - pinIn, b.y + pinIn], [b.x + pinIn, b.y + b.d - pinIn], [b.x + b.w - pinIn, b.y + b.d - pinIn]]) {
      faces.push(...cityBox({ x: px - pin / 2, y: py - pin / 2, w: pin, d: pin }, z0, pinH, { top: scaleHex(pal.wall, 1.05), side: pal.wall }, L, camHint));
      pyramidRect(px - pin / 2, py - pin / 2, pin, pin, pinH, cLen * 0.18, pal.trim);   // conical/pinnacle cap
    }
  } else if (variant === 'nusantara') {
    // NO dome. A multi-tiered pyramidal hipped roof (three stacked pyramids) + finial.
    // Low pitch + wide eaves + small vertical steps → a broad Javanese meru, not a fir tree.
    const roofH = cLen * 1.05;
    const tiers = [{ wf: 1.0, z: 0.0, hf: 0.32 }, { wf: 0.72, z: 0.22, hf: 0.34 }, { wf: 0.42, z: 0.46, hf: 0.5 }];
    for (const t of tiers) {
      const w = b.w * t.wf, d = b.d * t.wf;
      pyramidRect(cx - w / 2, cy - d / 2, w, d, bodyTop + roofH * t.z, roofH * t.hf, pal.roof);
    }
    const topZ = bodyTop + roofH * 0.96, fin = cLen * 0.06;
    faces.push(...cityBox({ x: cx - fin / 2, y: cy - fin / 2, w: fin, d: fin }, topZ, topZ + cLen * 0.18, { top: scaleHex(pal.trim, 1.1), side: pal.trim }, L, camHint));
    crescent(cx, cy, topZ + cLen * 0.18, cLen * 0.16, pal.crescent);
  } else {
    // OTTOMAN (default) — central dome on a low drum + four corner minarets
    const rC = cLen * 0.3, drumTop = bodyTop + cLen * 0.22, domeH = cLen * 0.62;
    drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
    dome(cx, cy, rC * 1.02, drumTop, domeH, pal.dome);
    crescent(cx, cy, drumTop + domeH, cLen * 0.34, pal.crescent);
    const inset = cLen * 0.13, rM = cLen * 0.055, mTop = z0 + Math.max(4, cLen * 1.95), capH = cLen * 0.4;
    for (const [mx, my] of [[b.x + inset, b.y + inset], [b.x + b.w - inset, b.y + inset], [b.x + inset, b.y + b.d - inset], [b.x + b.w - inset, b.y + b.d - inset]]) minaret(mx, my, rM, mTop, capH);
  }
  return faces;
}

// ── religious place (Buddhist temple) ────────────────────────────────────────────
// The third sibling under class:'religious' — the Buddhist vocabulary, in three regional
// variants (b.templeVariant), each its own mass over the same planar-face primitive:
//   • 'pagoda'  (East Asian — China/Japan/Korea) — a slender multi-storey TOWER of stacked
//               cinnabar-red bodies under wide overhanging jade-tile HIP ROOFS, on a stone
//               podium, crowned by a tall gilded SORIN finial.
//   • 'stupa'   (Theravada — Thailand/Myanmar/Sri Lanka) — a white BELL dome (anda) on a
//               stepped square base, a small harmika, and a tall tapering gilded SPIRE of
//               stacked chattra rings (hti). A surface of revolution.
//   • 'tibetan' (Himalayan — Tibet/Nepal/Bhutan) — a blocky white MONASTERY with a dark-red
//               maroon FRIEZE band near the top, trapezoidal windows, a flat roof, and a
//               central gilded DHARMACHAKRA wheel flanked by two gyaltsen banners.
// Palette per variant from TEMPLE_PALETTES; overridable via b.churchPalette.
const TEMPLE_PALETTES = {
  pagoda: { wall: '#a23b2e', roof: '#3d6b54', eave: '#2f5142', podium: '#7d6f57', trim: '#caa15f', window: '#241410', finial: '#d8b24a' },
  stupa: { base: '#e7e1d0', bell: '#efe9db', band: '#caa15f', spire: '#d8b24a', harmika: '#e2dcc9', window: '#3a2b22', finial: '#e8c34a' },
  tibetan: { wall: '#ece6d6', band: '#7a2e26', frame: '#e6dfcc', gold: '#d8b24a', roof: '#b9904a', window: '#241810' },
};
function templeBuilding(b, L, camHint) {
  const variant = b.templeVariant || 'pagoda';
  const pal = { ...(TEMPLE_PALETTES[variant] || TEMPLE_PALETTES.pagoda), ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const along = b.w >= b.d ? 'x' : 'y', cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x, cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);
  const z0 = b.z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 14;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const revolve = (prof, ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of prof) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  // a wide overhanging hip roof: four triangular hips to a centred apex (shallow pitch)
  const hipRoof = (hx, hy, half, zb, ph, tint) => {
    const cs = [[hx - half, hy - half, zb], [hx + half, hy - half, zb], [hx + half, hy + half, zb], [hx - half, hy + half, zb]], ap = [hx, hy, zb + ph];
    for (let i = 0; i < 4; i++) tri(cs[i], cs[(i + 1) % 4], ap, tint);
  };
  // a recess (door / window) proud of a front plane at along-coord aFace (exterior toward −A)
  const eps = 0.04, aCen = along === 'x' ? cx : cy;
  const openAt = (aFace, cA, cB, zlo, zTop, tint, radius) => { const cs = [P(aFace - eps, cA, zlo), P(aFace - eps, cB, zlo), P(aFace - eps, cB, zTop), P(aFace - eps, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, ...(radius ? { radius } : {}) }); };
  const openF = (cA, cB, zlo, zTop, tint, radius) => openAt(a0, cA, cB, zlo, zTop, tint, radius);   // on the box front
  // a slim gilded finial: post + stacked beads + crowning point
  const finial = (ox, oy, zb, h, tint) => {
    const post = Math.max(0.04, h * 0.06);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + h * 0.55, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    for (let k = 0; k < 3; k++) drum(ox, oy, h * (0.14 - k * 0.03), zb + h * (0.4 + k * 0.16), zb + h * (0.46 + k * 0.16), tint);
    revolve([[0, 1], [1, 0]], ox, oy, h * 0.08, zb + h * 0.88, h * 0.16, tint);
  };

  if (variant === 'stupa') {
    // stepped square base
    const s = Math.min(b.w, b.d);
    let bz = z0;
    for (let i = 0; i < 3; i++) {
      const hw = s * (0.5 - i * 0.08), th = s * 0.12;
      faces.push(...cityBox({ x: cx - hw, y: cy - hw, w: hw * 2, d: hw * 2 }, bz, bz + th, { top: scaleHex(pal.base, 1.06), side: pal.base }, L, camHint));
      bz += th;
    }
    // BELL dome (anda) — a white surface of revolution
    const BELL = [[0, 0.78], [0.16, 0.92], [0.34, 1.0], [0.54, 0.95], [0.72, 0.8], [0.86, 0.58], [1.0, 0.34]];
    const rB = s * 0.4, domeH = s * 0.78;
    drum(cx, cy, rB, bz, bz + s * 0.04, pal.band);                       // gold base ring
    revolve(BELL, cx, cy, rB, bz + s * 0.04, domeH, pal.bell);
    const domeTopZ = bz + s * 0.04 + domeH;
    // harmika — a small gold-banded box on the dome
    const hk = s * 0.12;
    faces.push(...cityBox({ x: cx - hk, y: cy - hk, w: hk * 2, d: hk * 2 }, domeTopZ, domeTopZ + s * 0.12, { top: scaleHex(pal.harmika, 1.05), side: pal.band }, L, camHint));
    // SPIRE (hti) — a tall taper of stacked gold chattra rings
    let sz = domeTopZ + s * 0.12; const rings = 7, sH = s * 0.7;
    for (let i = 0; i < rings; i++) {
      const r = s * 0.13 * (1 - i / (rings + 1)), zl = sz + (sH * 0.82) * (i / rings);
      drum(cx, cy, r, zl, zl + sH * 0.05, pal.spire);
    }
    finial(cx, cy, sz + sH * 0.82, s * 0.5, pal.finial);
  } else if (variant === 'tibetan') {
    // blocky white monastery with a battered base (a slightly wider lower box), a maroon
    // frieze band near the top, a flat roof, trapezoidal windows, and a gold roof ornament.
    const s = Math.min(b.w, b.d), top = z0 + Math.max(2.6, cLen * 1.0);
    faces.push(...cityBox({ x: b.x - s * 0.02, y: b.y - s * 0.02, w: b.w + s * 0.04, d: b.d + s * 0.04 }, z0, z0 + (top - z0) * 0.16, { top: scaleHex(pal.wall, 0.92), side: scaleHex(pal.wall, 0.92) }, L, camHint));   // battered plinth
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0 + (top - z0) * 0.16, top, { top: scaleHex(pal.roof, 1.0), side: pal.wall }, L, camHint));    // white body, flat gold-ish roof
    // maroon frieze band (benma) near the top, slightly proud
    const bandLo = z0 + (top - z0) * 0.78;
    faces.push(...cityBox({ x: b.x - s * 0.015, y: b.y - s * 0.015, w: b.w + s * 0.03, d: b.d + s * 0.03 }, bandLo, top, { top: scaleHex(pal.band, 1.05), side: pal.band }, L, camHint));
    // tall black trapezoidal windows (wider top → tibetan eyebrow) with a thin maroon lintel,
    // two rows of three. The black frame IS the motif; a white reveal sits just inside it.
    for (const zc of [0.3, 0.56]) {
      for (const cc of [c0 + cLen * 0.27, c0 + cLen * 0.5, c0 + cLen * 0.73]) {
        const ww = cLen * 0.06, zlo = z0 + (top - z0) * zc, zhi = z0 + (top - z0) * (zc + 0.2);
        openF(cc - ww * 1.3, cc + ww * 1.3, zhi, zhi + (top - z0) * 0.025, pal.band);   // maroon lintel eyebrow
        openF(cc - ww * 1.3, cc + ww * 1.3, zlo, zhi, pal.window);                       // black trapezoid frame
        openF(cc - ww * 0.55, cc + ww * 0.55, zlo + (zhi - zlo) * 0.18, zhi - (zhi - zlo) * 0.12, pal.frame);   // pale reveal
      }
    }
    openF(cMid - cLen * 0.11, cMid + cLen * 0.11, z0 + 0.02, z0 + (top - z0) * 0.34, pal.window);   // doorway
    // gold roof ornament: a central DHARMACHAKRA wheel on a short post (front-centre), flanked
    // left & right by two gyaltsen victory banners (tapered gold cylinders) — well separated.
    const wc = P(a0 + cLen * 0.34, cMid, 0), postH = cLen * 0.12, wr = cLen * 0.13;
    drum(wc[0], wc[1], cLen * 0.028, top, top + postH, pal.gold);                       // post
    faces.push({ corners: [[wc[0] - wr, wc[1], top + postH], [wc[0] + wr, wc[1], top + postH], [wc[0] + wr, wc[1], top + postH + wr * 2], [wc[0] - wr, wc[1], top + postH + wr * 2]], fill: scaleHex(pal.gold, litFactor([0, 1, 0], L)), doubleSided: true, radius: '50%' });   // the wheel disc
    drum((wc[0] + cx) / 2, (wc[1] + cy) / 2, wr * 0.28, top + postH + wr * 0.7, top + postH + wr * 1.3, scaleHex(pal.gold, 0.8));   // hub
    for (const cc of [c0 + cLen * 0.16, c0 + cLen * 0.84]) {
      const g = P(aCen, cc, 0);
      drum(g[0], g[1], cLen * 0.04, top, top + cLen * 0.4, pal.gold);
      revolve([[0, 1], [1, 0]], g[0], g[1], cLen * 0.055, top + cLen * 0.4, cLen * 0.14, pal.gold);
    }
  } else {
    // PAGODA — a slender multi-storey tower of red bodies under overhanging jade hip roofs.
    const podiumTop = z0 + cLen * 0.16;
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, podiumTop, { top: scaleHex(pal.podium, 1.06), side: pal.podium }, L, camHint));
    const lvls = 4;
    let z = podiumTop, half = cLen * 0.32;
    for (let i = 0; i < lvls; i++) {
      const bh = cLen * (0.46 - i * 0.05);                    // body segment height
      faces.push(...cityBox({ x: cx - half, y: cy - half, w: half * 2, d: half * 2 }, z, z + bh, { top: scaleHex(pal.wall, 0.85), side: pal.wall }, L, camHint));
      const aF = aCen - half;   // the inset body's own front face (NOT the box edge)
      if (i === 0) openAt(aF, cMid - half * 0.45, cMid + half * 0.45, z + 0.02, z + bh * 0.7, pal.window, '0 0 44% 44% / 0 0 40% 40%');   // arched door
      else openAt(aF, cMid - half * 0.28, cMid + half * 0.28, z + bh * 0.28, z + bh * 0.72, pal.window, '0 0 40% 40% / 0 0 36% 36%');     // a single arched window
      z += bh;
      const ov = half * 1.5;                                  // wide overhanging eaves
      drum(cx, cy, ov * 1.02, z, z + cLen * 0.03, pal.eave);  // a thin eave fascia lip (octagonal hint)
      hipRoof(cx, cy, ov, z + cLen * 0.03, cLen * 0.2, pal.roof);
      z += cLen * 0.12;                                       // next storey rises out of the roof
      half *= 0.8;
    }
    finial(cx, cy, z, cLen * 0.9, pal.finial);
  }
  return faces;
}

// ── CIVIC: neoclassical domed ROTUNDA (Pantheon / capitol / observatory) ──────────
// A secular sibling of the religious masses under `class:'civic'`: a columned drum under a
// dome, fronted by a pedimented portico. The dome reuses the same surface-of-revolution
// profiles the religious/landmark masses use, chosen by `b.domeForm`:
//   • 'hemispheric' (default) — a pale-stone dome + a small lantern/cupola (the classical read)
//   • 'onion'                 — the orthodox ONION profile, gilded
//   • 'bulbous'               — the persian BULB profile, turquoise
// No cross/crescent/wheel — this is civic, not religious. Palette overridable via
// `b.domePalette`, the dome tint alone via `b.domeTint`.
const ROTUNDA_PALETTE = { wall: '#e9e4d7', step: '#d6cfc0', column: '#efece2', cornice: '#dcd6c8', drum: '#e3ded0', window: '#33291f', pediment: '#e4dfd1', domeStone: '#c9cdc4', domeOnion: '#caa63f', domeBulbous: '#23b3ab', lantern: '#e6e1d4', finial: '#d8b94a' };
function rotundaBuilding(b, L, camHint) {
  const pal = { ...ROTUNDA_PALETTE, ...(b.domePalette || {}) };
  const domeForm = b.domeForm || 'hemispheric';
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const along = b.w >= b.d ? 'x' : 'y', cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x, cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);
  const z0 = b.z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2, fM = Math.min(b.w, b.d), Nr = 16;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const DOME = [[0, 1.0], [0.32, 0.99], [0.56, 0.9], [0.76, 0.74], [0.9, 0.46], [1.0, 0.0]];               // rounded hemisphere
  const ONION = [[0, 1.0], [0.14, 1.14], [0.32, 1.2], [0.5, 1.05], [0.66, 0.74], [0.8, 0.42], [0.92, 0.18], [1.0, 0.0]];
  const BULB = [[0, 0.86], [0.12, 0.99], [0.30, 1.08], [0.5, 1.02], [0.68, 0.82], [0.85, 0.48], [1.0, 0.0]];
  const revolve = (prof, ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of prof) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  // a ring of N square column shafts on a circle of radius r, from zb to zt
  const colonnade = (r, n, zb, zt, cs, tint) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI, ox = cx + Math.cos(a) * r, oy = cy + Math.sin(a) * r;
      faces.push(...cityBox({ x: ox - cs / 2, y: oy - cs / 2, w: cs, d: cs }, zb, zt, { top: scaleHex(tint, 1.07), side: tint }, L, camHint));
    }
  };

  // STYLOBATE — two square steps the rotunda stands on
  const sH = fM * 0.05, baseTop = z0 + sH * 2;
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, z0 + sH, { top: scaleHex(pal.step, 1.05), side: pal.step }, L, camHint));
  const in1 = fM * 0.06;
  faces.push(...cityBox({ x: b.x + in1, y: b.y + in1, w: b.w - in1 * 2, d: b.d - in1 * 2 }, z0 + sH, baseTop, { top: scaleHex(pal.step, 1.05), side: pal.step }, L, camHint));

  // DRUM — the rotunda wall, a tall faceted cylinder with tall window slits
  const rDrum = fM * 0.40, drumTop = baseTop + fM * 0.85;
  drum(cx, cy, rDrum, baseTop, drumTop, pal.wall);
  for (let i = 0; i < Nr; i += 2) {                                   // attic window slits (upper drum)
    const a = (i / Nr) * 2 * Math.PI, px = cx + Math.cos(a) * (rDrum + 0.02), py = cy + Math.sin(a) * (rDrum + 0.02);
    const tx = -Math.sin(a) * 0.06, ty = Math.cos(a) * 0.06, wz0 = baseTop + fM * 0.46, wz1 = baseTop + fM * 0.74;
    const cs = [[px - tx, py - ty, wz0], [px + tx, py + ty, wz0], [px + tx, py + ty, wz1], [px - tx, py - ty, wz1]];
    faces.push({ corners: cs, fill: scaleHex(pal.window, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 34% 34%' });
  }

  // PERISTYLE — a ring of columns proud of the wall, on a base ring, capped by a cornice band
  const rCol = rDrum * 1.18, colBot = baseTop + fM * 0.03, colTop = baseTop + fM * 0.5;
  drum(cx, cy, rCol * 1.07, baseTop, colBot, pal.cornice);            // stylobate ring under the columns
  colonnade(rCol, 18, colBot, colTop, fM * 0.055, pal.column);
  drum(cx, cy, rCol * 1.1, colTop, colTop + fM * 0.08, pal.cornice);  // entablature ring over the columns

  // PORTICO — a projecting pedimented porch on the front plane (exterior toward −A at a = a0)
  const eps = 0.04, aF = a0 - eps, porchDepth = fM * 0.2, pw = cLen * 0.6, pColR = cMid;
  const porchTop = colTop, cw = fM * 0.06, Nfront = 4;
  for (let i = 0; i < Nfront; i++) {                                  // front column row
    const cc = cMid - pw / 2 + (pw * i) / (Nfront - 1), aP = a0 - porchDepth + cw;
    const fp = along === 'x' ? { x: aP - cw / 2, y: cc - cw / 2, w: cw, d: cw } : { x: cc - cw / 2, y: aP - cw / 2, w: cw, d: cw };
    faces.push(...cityBox(fp, baseTop, porchTop, { top: scaleHex(pal.column, 1.07), side: pal.column }, L, camHint));
  }
  // entablature beam spanning the porch front, then a triangular pediment above it
  const ebZ0 = porchTop, ebZ1 = porchTop + fM * 0.09;
  lit([P(aF, cMid - pw / 2 - cw, ebZ0), P(aF, cMid + pw / 2 + cw, ebZ0), P(aF, cMid + pw / 2 + cw, ebZ1), P(aF, cMid - pw / 2 - cw, ebZ1)], pal.cornice);
  tri(P(aF, cMid - pw / 2 - cw, ebZ1), P(aF, cMid + pw / 2 + cw, ebZ1), P(aF, pColR, ebZ1 + fM * 0.18), pal.pediment);

  // DOME — profile by form, on the drum top; a lantern (hemispheric) or a finial otherwise
  const domeTint = b.domeTint || (domeForm === 'onion' ? pal.domeOnion : domeForm === 'bulbous' ? pal.domeBulbous : pal.domeStone);
  const domeBaseR = rDrum * 0.98;
  const domeH = domeForm === 'onion' ? rDrum * 1.5 : domeForm === 'bulbous' ? rDrum * 1.2 : rDrum * 0.92;
  const prof = domeForm === 'onion' ? ONION : domeForm === 'bulbous' ? BULB : DOME;
  revolve(prof, cx, cy, domeBaseR, drumTop, domeH, domeTint);
  const apex = drumTop + domeH;
  if (domeForm === 'hemispheric') {
    // a small lantern/cupola: a mini drum + mini dome + a gilded finial knob
    const rL = rDrum * 0.16, lanH = fM * 0.16;
    drum(cx, cy, rL, apex - fM * 0.02, apex + lanH, pal.lantern);
    revolve(DOME, cx, cy, rL * 1.02, apex + lanH, fM * 0.14, pal.lantern);
    const kb = fM * 0.04;
    faces.push(...cityBox({ x: cx - kb / 2, y: cy - kb / 2, w: kb, d: kb }, apex + lanH + fM * 0.14, apex + lanH + fM * 0.22, { top: scaleHex(pal.finial, 1.1), side: pal.finial }, L, camHint));
  } else {
    const kb = fM * 0.05, post = fM * 0.03;                           // gilded finial spike + knob
    faces.push(...cityBox({ x: cx - post / 2, y: cy - post / 2, w: post, d: post }, apex, apex + fM * 0.12, { top: scaleHex(pal.finial, 1.1), side: pal.finial }, L, camHint));
    faces.push(...cityBox({ x: cx - kb / 2, y: cy - kb / 2, w: kb, d: kb }, apex + fM * 0.12, apex + fM * 0.18, { top: scaleHex(pal.finial, 1.1), side: pal.finial }, L, camHint));
  }
  return faces;
}

/**
 * Resolve a planArchitectureMandala plan into world-space planar faces.
 * @returns {{ faces, faceCount }}
 */
export function extractArchitectureSceneFaces({ plan, cityBasis = DEFAULT_CITY_BASIS, cameras = DEFAULT_CITY_CAMERAS, light } = {}) {
  const L = light || makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
  const m = cityBasis.map;
  const camHint = cameras[0]?.worldFraming?.cameraPosition || [-7, 31, 9];
  const faces = [];
  const surfById = new Map(plan.surfaces.map((s) => [s.id, s]));
  const activeSurfaceIds = new Set(plan.allocations.map((a) => a.surfaceId));

  // base ground
  faces.push(groundFace({ x: m.x0, y: m.y0, w: cityBasis.worldExtent.width * 0.9, d: cityBasis.worldExtent.depth * 0.84 }, 0, '#cdd3bb', L));

  // active ground-type surfaces (roads/sidewalks/plazas/lots/fields) as tinted planes
  for (const id of activeSurfaceIds) {
    const s = surfById.get(id);
    if (!s || !GROUND_TINT[s.kind]) continue;
    faces.push(groundFace(surfaceWorldRect(s, m), 0.03, GROUND_TINT[s.kind], L));
  }

  // buildings from active facade/mass surfaces (slab footprint + facade window grid)
  for (const id of activeSurfaceIds) {
    const s = surfById.get(id);
    if (!s || !['facadeFace', 'buildingMass', 'radialBuildingMass'].includes(s.kind)) continue;
    const r0 = surfaceWorldRect(s, m);
    const r = { x: r0.x, y: r0.y, w: r0.w, d: s.id.includes('building.b') ? 1.15 : 1.35 };
    const h = s.id.includes('building.b') ? 4.4 : 5.2;
    const facade = makeFacade(cityHash(s.id), { height: h });
    const floors = facadeFloors(facade, h);
    const bays = facadeBays(facade, r.w);
    faces.push(...cityBox(r, 0, h, { facade, floors, bays, top: scaleHex(facade.glass, 0.62) }, L, camHint));
  }

  // props / street furniture / lamps (small boxes at their concept height)
  for (const a of plan.allocations) {
    const s = surfById.get(a.surfaceId);
    if (!s) continue;
    if (a.conceptId === 'urban.sidewalk-road') {
      faces.push(groundFace(slotWorldRect(s, a.slot, m), 0.05, '#333a44', L));
      continue;
    }
    if (a.family === 'urban' || a.family === 'infrastructure' || a.family === 'civic') {
      const h = PROP_HEIGHT[a.conceptId] || 0.9;
      const r0 = slotWorldRect(s, a.slot, m);
      // narrow the footprint a touch so props read as objects, not pads
      const r = { x: r0.x + r0.w * 0.2, y: r0.y + r0.d * 0.2, w: Math.max(0.3, r0.w * 0.6), d: Math.max(0.3, r0.d * 0.6) };
      const hsh = cityHash(a.id);
      const tint = PROP_PAL[hsh % PROP_PAL.length];
      faces.push(...cityBox(r, 0.06, h, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    }
  }
  return { faces, faceCount: faces.length };
}

/** Plan a city (concepts → allocations) and render it as self-contained preserve-3d HTML. */
export function renderArchitectureSceneToHtml({ conceptIds, prompt, seed, cameras = DEFAULT_CITY_CAMERAS, cityBasis = DEFAULT_CITY_BASIS, viewBox = { width: 1120, height: 780 }, unitScale = 22, title = 'mojulo city', light } = {}) {
  const plan = planArchitectureMandala({ conceptIds, prompt, seed });
  const { faces } = extractArchitectureSceneFaces({ plan, cityBasis, cameras, light });
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title, bg: '#0e1014' });
}

// A SMOOTH ribbon following a 2D path: a strip of quads (deck top) + side fascia,
// arbitrary-oriented (not axis-aligned boxes). path = [[x,y],...] in world.
function ribbonFaces(ribbon, L, camHint) {
  const { path, z0, z1, width, tint } = ribbon, hw = width / 2;
  const left = [], right = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const px = -ty, py = tx;                                  // in-plane perpendicular
    left.push([path[i][0] + px * hw, path[i][1] + py * hw]);
    right.push([path[i][0] - px * hw, path[i][1] - py * hw]);
  }
  const faces = [], topFill = scaleHex(tint, litFactor([0, 0, 1], L));
  const fasciaFill = scaleHex(tint, 0.7);
  // optional surface texture (e.g. asphalt): the World draws the deck MULTIPLY-lit (texel *
  // bakedFill) so it picks up moonlight/lamp pools baked into `fill` downstream, and tiles it
  // by world-XY so every segment, lane and intersection shares one seamless field. CSS-3D
  // ignores texture/uv/textureLit and keeps the flat `fill` — its road look is unchanged.
  const surf = ribbon.texture || null;
  const tile = ribbon.textureScale || 0.7;
  for (let i = 0; i < path.length - 1; i++) {
    const top = [[left[i][0], left[i][1], z1], [right[i][0], right[i][1], z1], [right[i + 1][0], right[i + 1][1], z1], [left[i + 1][0], left[i + 1][1], z1]];
    const wound = windToward(top, [(top[0][0] + top[2][0]) / 2, (top[0][1] + top[2][1]) / 2, 1e4]);
    const face = { corners: wound, fill: topFill };
    if (surf) { face.texture = surf; face.textureLit = true; face.uv = wound.map((c) => [c[0] / tile, c[1] / tile]); }
    faces.push(face);
    if (z1 - z0 > 0.05) {
      faces.push({ corners: [[left[i][0], left[i][1], z0], [left[i][0], left[i][1], z1], [left[i + 1][0], left[i + 1][1], z1], [left[i + 1][0], left[i + 1][1], z0]], fill: fasciaFill, doubleSided: true });
      faces.push({ corners: [[right[i][0], right[i][1], z0], [right[i][0], right[i][1], z1], [right[i + 1][0], right[i + 1][1], z1], [right[i + 1][0], right[i + 1][1], z0]], fill: fasciaFill, doubleSided: true });
    }
  }
  return faces;
}

/**
 * Assemble a world-box scene into the engine-agnostic scene payload
 * ({ faces, cameras, viewBox, unitScale, title, bg, sky }) WITHOUT emitting.
 * This is the shared seam: the CSS-3D path (renderBoxCityToHtml) and the
 * three.js World path (emitThreeWorld via the /world route) both consume the
 * same baked faces, so generators (fractal-city, transportation-hub) never
 * need to know which renderer is downstream.
 *
 * box: { x, y, w, d, z0, z1, kind?, glass?, tint? }  ground: { x, y, w, d, z?, fill? }
 * ribbon: { path:[[x,y]...], z0, z1, width, tint }
 * faces: caller-supplied raw faces appended verbatim — { corners:[[x,y,z]x4], fill?|bg?, clip?, html?, doubleSided?, card?, lit? }.
 *        Lets generators emit pre-shaded geometry with SVG/clip decals (e.g. vehicle stickers).
 */
// Reveal "wallpaper": an SVG grid of dark-edged glass cells (the mullion contact-shadow / AO
// baked as one image), tiled across a wall. The reveal-as-texture instead of thousands of
// sub-faces or floating decals — one face per wall, deduped per (bays × floors × lit-glass),
// identical in CSS-3D (`bg`) and the World (`texture`). See the vgl-rules shirt-texture spike.
function revealMullionTexture(bays, floors, litGlass, ao, band) {
  const cp = 40, W = bays * cp, Ht = floors * cp, bw = cp * band;
  const stops = `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.5" stop-color="#000" stop-opacity="${ao}"/><stop offset="1" stop-color="#000" stop-opacity="0"/>`;
  let r = '';
  for (let i = 0; i <= bays; i++) r += `<rect x="${(i * cp - bw).toFixed(1)}" y="0" width="${(2 * bw).toFixed(1)}" height="${Ht}" fill="url(#v)"/>`;
  for (let j = 0; j <= floors; j++) r += `<rect x="0" y="${(j * cp - bw).toFixed(1)}" width="${W}" height="${(2 * bw).toFixed(1)}" fill="url(#h)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}"><defs><linearGradient id="v" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient><linearGradient id="h" x1="0" x2="0" y1="0" y2="1">${stops}</linearGradient></defs><rect width="${W}" height="${Ht}" fill="${litGlass}"/>${r}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Real-mullion curtainwall (opt-in via `b.curtainwall`): proud mullion BARS as real boxes (the
 * recess geometry) + glass walls carrying the baked reveal "wallpaper" (one textured face per
 * wall). The window reveal emerges from real geometry, not a painted facade — but stored as a
 * tiled image, so it stays cheap and seam-free. Wall textures are registered into `textures`,
 * which the scene returns so emitThreeWorld receives them. `opts`: { relief, mullion, ao, band }.
 */
function curtainwallBuilding(b, L, camHint, textures, opts = {}) {
  const { relief = 0.16, mullion = 0.13, ao = 0.55, band = 0.16 } = opts;
  const facade = b.facade || makeFacade(cityHash(`${b.x.toFixed(1)},${b.y.toFixed(1)},${(b.z1 - b.z0).toFixed(1)}`), { height: b.z1 - b.z0 });
  const glassHex = b.tint || facade.glass || '#9bd0df', frameHex = facade.frame || '#54657a';
  const x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.d, z0 = b.z0, z1 = b.z1, h = z1 - z0;
  const out = [];
  // proud mullion bars (real boxes), per the facade's bay/floor grid
  const bars = [];
  const mull = (axis, sign) => {
    const wlen = axis === 'x' ? (y1 - y0) : (x1 - x0), w0 = axis === 'x' ? y0 : x0;
    const nb = facadeBays(facade, wlen), nf = facadeFloors(facade, h);
    const plane = axis === 'x' ? (sign > 0 ? x1 : x0) : (sign > 0 ? y1 : y0), o0 = sign > 0 ? plane : plane - relief;
    for (let i = 0; i <= nb; i++) { const wc = w0 + wlen * (i / nb); bars.push(axis === 'x' ? { x: o0, y: wc - mullion / 2, w: relief, d: mullion, z0, z1 } : { x: wc - mullion / 2, y: o0, w: mullion, d: relief, z0, z1 }); }
    for (let j = 0; j <= nf; j++) { const zc = z0 + h * (j / nf), za = Math.max(z0, zc - mullion / 2), zb = Math.min(z1, zc + mullion / 2); bars.push(axis === 'x' ? { x: o0, y: w0, w: relief, d: wlen, z0: za, z1: zb } : { x: w0, y: o0, w: wlen, d: relief, z0: za, z1: zb }); }
  };
  for (const [a, s] of [['x', 1], ['x', -1], ['y', 1], ['y', -1]]) mull(a, s);
  for (const e of bars) out.push(...cityBox({ x: e.x, y: e.y, w: e.w, d: e.d }, e.z0, e.z1, { top: scaleHex(frameHex, 1.06), side: frameHex }, L, camHint));
  // textured glass walls (the baked reveal), deduped per grid × lit-glass
  const wall = (o, uVec, vVec, n) => {
    const bays = facadeBays(facade, Math.hypot(...uVec)), floors = facadeFloors(facade, Math.hypot(...vVec));
    const litGlass = rgbToHex(hexToRgb(glassHex).map((v) => v * litFactor(n, L)));
    const key = `cw_${bays}x${floors}_${litGlass.slice(1)}`;
    if (!textures[key]) textures[key] = revealMullionTexture(bays, floors, litGlass, ao, band);
    out.push({ corners: [o, add(o, uVec), add(add(o, uVec), vVec), add(o, vVec)], texture: key, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], bg: `url('${textures[key]}') 0 0 / 100% 100% no-repeat`, doubleSided: true });
  };
  const X = x1 - x0, Y = y1 - y0, Z = z1 - z0;
  wall([x0, y1, z0], [X, 0, 0], [0, 0, Z], [0, 1, 0]);
  wall([x1, y0, z0], [-X, 0, 0], [0, 0, Z], [0, -1, 0]);
  wall([x1, y0, z0], [0, Y, 0], [0, 0, Z], [1, 0, 0]);
  wall([x0, y1, z0], [0, -Y, 0], [0, 0, Z], [-1, 0, 0]);
  out.push({ corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill: scaleHex(frameHex, litFactor([0, 0, 1], L)), doubleSided: true });
  return out;
}

export function assembleBoxCityScene({ boxes = [], grounds = [], ribbons = [], faces: extraFaces = [], sources = [], diffusion = {}, moonlight, cameras = DEFAULT_CITY_CAMERAS, viewBox = { width: 1120, height: 780 }, unitScale = 22, title = 'mojulo fractal city', light, bg = '#0e1014', sky, groundShadows = false, creaseSeams = false } = {}) {
  const L = light || makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
  const camHint = cameras[0]?.worldFraming?.cameraPosition || [-7, 31, 9];
  let faces = [];
  const sceneTextures = {};   // baked wall textures (curtainwall reveal) → returned for emitThreeWorld
  for (const g of grounds) faces.push(groundFace({ x: g.x, y: g.y, w: g.w, d: g.d }, g.z ?? 0.02, g.fill || '#cdd3bb', L));
  for (const rb of ribbons) {
    // a ribbon may opt into a tiled surface (asphalt) — register its data URL once so
    // emitThreeWorld receives it (same path as the curtainwall reveal wallpaper).
    if (rb.texture && !sceneTextures[rb.texture]) { const url = surfaceTexture(rb.texture); if (url) sceneTextures[rb.texture] = url; }
    faces.push(...ribbonFaces(rb, L, camHint));
  }
  for (const b of boxes) {
    const r = { x: b.x, y: b.y, w: b.w, d: b.d };
    if (b.curtainwall) { faces.push(...curtainwallBuilding(b, L, camHint, sceneTextures, b.curtainwall === true ? {} : b.curtainwall)); continue; }
    if (b.roof) {
      // town dwelling: low residential walls capped by a real pitched roof (roof.js, scaled to town size).
      const tint = b.tint || '#cabfa8';
      if (b.kind === 'house') { townHouseWalls(faces, b, L, sceneTextures); dressHouseFacade(faces, b, L); }   // textured walls + windows/sills/shutters/door
      else if (b.kind === 'garage') { townHouseWalls(faces, b, L, sceneTextures); dressGarage(faces, b, L); }   // textured walls + sectional garage door
      else faces.push(...cityBox(r, b.z0, b.z1, { top: scaleHex(tint, 1.04), side: tint }, L, camHint));
      const { faces: rf, textureKeys } = townRoofFaces(b, L);
      faces.push(...rf);
      for (const k of textureKeys) { if (!sceneTextures[k]) { const u = surfaceTexture(k); if (u) sceneTextures[k] = u; } }
      continue;
    }
    if (b.kind === 'townhouse') {
      // a rowhouse unit: skin the mass with its (generator-supplied) facade, but DON'T
      // run buildingExtras — the row generator already emits the stoop / doors / cornice
      // / bay geometry as its own annotated boxes + faces.
      const facade = b.facade || makeFacade(cityHash(`${b.x.toFixed(1)},${b.y.toFixed(1)}`), { height: b.z1 - b.z0 });
      const floors = facadeFloors(facade, b.z1 - b.z0);
      const bays = facadeBays(facade, b.w);
      faces.push(...cityBox(r, b.z0, b.z1, { facade, floors, bays, top: scaleHex(facade.glass, 0.6) }, L, camHint));
    } else if (b.shape === 'church') {
      // religious-place class: its own mass form, no window facade / rooftop extras
      faces.push(...churchBuilding(b, L, camHint));
    } else if (b.shape === 'mosque') {
      faces.push(...mosqueBuilding(b, L, camHint));
    } else if (b.shape === 'temple') {
      faces.push(...templeBuilding(b, L, camHint));
    } else if (b.shape === 'rotunda') {
      // civic class: a neoclassical domed rotunda; its own mass, no window-facade / rooftop extras
      faces.push(...rotundaBuilding(b, L, camHint));
    } else if (isLandmarkShape(b.shape)) {
      faces.push(...renderLandmarkBuilding(b, { L, camHint, cityBox }));
    } else if (isPlantShape(b.shape)) {
      // city/scene tree: a taiji plant meshed to baked faces, lit by the scene's L
      // (so day/night is correct), then dressed by moonlight/diffusion like any face.
      faces.push(...plantBoxToFaces(b, { light: L }));
    } else if (['building', 'anchor', 'midtower'].includes(b.kind)) {
      const facade = b.facade || makeFacade(cityHash(`${b.x.toFixed(1)},${b.y.toFixed(1)},${(b.z1 - b.z0).toFixed(1)}`), { height: b.z1 - b.z0, program: b.condo ? 'slab-block' : undefined });
      const floors = facadeFloors(facade, b.z1 - b.z0);
      const bays = facadeBays(facade, b.w);
      if (b.shape === 'cylinder') faces.push(...cylinderBuilding(b, facade, floors, L, camHint));
      else if (b.shape === 'setback') faces.push(...setbackBuilding(b, facade, L, camHint));
      else if (b.shape === 'podium') faces.push(...podiumBuilding(b, facade, L, camHint));
      else if (b.shape === 'complex') faces.push(...complexBuilding(b, facade, L, camHint));
      else faces.push(...cityBox(r, b.z0, b.z1, { facade, floors, bays, top: scaleHex(facade.glass, 0.62) }, L, camHint));
      // 3D ornaments: protruding balconies/awning/rooftop boxes + printed signage decals
      // (cylinders + podiums skip the +y-face balconies/escapes — the inset tower would
      // float them off the facade — keeping rooftop kit, which centres over the tower)
      const exFacade = b.shape === 'cylinder' ? { ...facade, balcony: false, loggia: false, fireEscape: false, sign: null, material: 'glass', noEntrance: true }
        : b.shape === 'podium' ? { ...facade, balcony: false, loggia: false, fireEscape: false }
        : b.shape === 'complex' ? { ...facade, balcony: false, loggia: false, fireEscape: false, rooftopKit: [] }   // off-centre tower → skip floating roof kit
        : facade;
      const extras = buildingExtras({ x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, z1: b.z1 }, exFacade, floors, bays);
      for (const e of extras.boxes) faces.push(...cityBox({ x: e.x, y: e.y, w: e.w, d: e.d }, e.z0, e.z1, { top: scaleHex(e.tint, 1.06), side: e.tint }, L, camHint));
      for (const ef of extras.faces) faces.push(ef);     // tilted equipment (satellite dish)
      for (const dc of extras.decals) {
        const yo = b.y + b.d + 0.04;
        const c = [[dc.x0, yo, dc.z0], [dc.x1, yo, dc.z0], [dc.x1, yo, dc.z1], [dc.x0, yo, dc.z1]];
        faces.push({ corners: c, fill: scaleHex(dc.fill, litFactor([0, 1, 0], L)), doubleSided: true });
      }
    } else {
      const tint = b.tint || '#9aa3ad';
      faces.push(...cityBox(r, b.z0, b.z1, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    }
  }
  faces.push(...extraFaces);
  // moonlight (cool directional base), then streetlamp diffusion (warm pools + cast
  // shadows) on top — same primitives as the room, the faces are just facades.
  if (moonlight) faces = applyMoonlight(faces, moonlight === true ? {} : moonlight);
  if (sources.length) faces = bakeSceneDiffusion(faces, sources, diffusion);
  // OPT-IN per-building ground shadows. The per-face diffusion shadow collapses every
  // building's cast pool into one centroid on the shared ground plane (useless at city
  // scale), so this is a dedicated pass: one soft decal per building footprint, offset
  // downstream of the light (`gs.dir` or the first source's dir) by a height-proportional
  // amount → directional cast feel for the day sun, a grounding blob for downward night
  // lamps. Tagged `decal:'shadow'`, so it renders in BOTH the CSS-3D path (bg pool) and the
  // World (collectShadowDecals → ground decal). `gs.max` caps the count on dense cities.
  if (groundShadows) {
    const gs = groundShadows === true ? {} : groundShadows;
    const dir = gs.dir || (sources[0] && sources[0].dir) || null;
    const lenK = gs.length ?? 0.7, cap = gs.max ?? 60;
    let fps = boxes.filter((b) => (b.z1 - b.z0) > 0.5).map((b) => {
      const h = b.z1 - b.z0;
      const corners = [[b.x, b.y, b.z0], [b.x + b.w, b.y, b.z0], [b.x + b.w, b.y + b.d, b.z0], [b.x, b.y + b.d, b.z0]];
      const offset = dir && Math.hypot(dir[0], dir[1]) > 1e-3 ? [dir[0] * h * lenK, dir[1] * h * lenK] : null;
      return { corners, height: h, offset };
    });
    if (fps.length > cap) fps = Array.from({ length: cap }, (_, i) => fps[Math.floor(i * (fps.length / cap))]);
    faces.push(...contactShadowDecals(fps, { strength: gs.strength ?? 0.5, expand: gs.expand ?? 1.35, maxAlpha: gs.maxAlpha ?? 0.55, fade: false }));
  }
  // OPT-IN crease seams: the vgl concave contact-shadow feather over the massing. Added AFTER
  // moonlight/diffusion so those passes don't re-light the shadow bands (they carry their own
  // bg gradient / decal:'ink'). Off by default — existing scenes are unchanged.
  if (creaseSeams) faces.push(...bakeCreaseSeams(boxes, { unitScale, ...(creaseSeams === true ? {} : creaseSeams) }));
  // `light` rides along so the World renderer (emitThreeWorld) can self-shade facade
  // frame-bar return cheeks with the SAME light that baked the wall faces. The CSS-3D
  // path (emitPreserve3dScene) ignores it.
  return { faces, cameras, viewBox, unitScale, title, bg, sky, light: L, textures: sceneTextures };
}

/**
 * Generic world-box renderer: world boxes + ground planes + smooth ribbons → preserve-3d HTML.
 * Used by generators (e.g. fractal-city) that produce world geometry directly.
 * box: { x, y, w, d, z0, z1, kind?, glass?, tint? }  ground: { x, y, w, d, z?, fill? }
 * ribbon: { path:[[x,y]...], z0, z1, width, tint }
 * faces: caller-supplied raw faces appended verbatim — { corners:[[x,y,z]x4], fill?|bg?, clip?, html?, doubleSided?, card?, lit? }.
 *        Lets generators emit pre-shaded geometry with SVG/clip decals (e.g. vehicle stickers).
 */
export function renderBoxCityToHtml(opts = {}) {
  return emitPreserve3dScene(assembleBoxCityScene(opts));
}

// ── painted-landscape terrain: heightfield mesh → world faces (additive) ──
//
// The terrain generator already samples a real (x, y, z) heightfield; the SVG
// renderer flattens it with the landscape's TWO-POINT (vanishing-point) camera
// cards, which are not pinhole worldFramings. So — like the room path's
// synthCornerCamera — this SYNTHESIZES pinhole cameras over the terrain's world
// bounds (z-up, camera beyond the near edge at +y looking toward the far hills
// at -y). The world mesh + per-cell shading is the reusable asset; only the
// camera is regenerated. v1: terrain + water only (see buildTerrainWorldMesh).

/** Synthesize pinhole cameras framing a terrain's world bounds (z-up). */
function synthTerrainCameras({ xRange, yRange, zRange }) {
  const [, x1] = xRange, [yFar, yNear] = yRange, [z0, z1] = zRange;
  const cx = (xRange[0] + x1) / 2, midY = (yFar + yNear) / 2, midZ = (z0 + z1) / 2;
  const ySpan = yNear - yFar, top = Math.max(z1 + 4, 6);
  return [
    { name: 'survey', worldFraming: {
      cameraPosition: [cx, yNear + 0.42 * ySpan, top],
      lookAt: [cx, midY, midZ], horizontalFov: 66 } },
    { name: 'low-angle', worldFraming: {
      cameraPosition: [cx, yNear + 0.18 * ySpan, midZ + 2.5],
      lookAt: [cx, midY - 0.2 * ySpan, midZ + 1], horizontalFov: 74 } },
    { name: 'aerial', worldFraming: {
      cameraPosition: [cx, yNear - 0.05 * ySpan, top + 0.9 * ySpan],
      lookAt: [cx, midY, z0], horizontalFov: 60 } },
  ];
}

const rgbStr = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Render a painted-landscape manifest as a live preserve-3d HTML terrain scene.
 * Returns null for manifests that aren't paintable terrain (caller falls back
 * to the baked /svg).
 */
/**
 * Assemble a painted-landscape manifest into the engine-agnostic scene payload
 * (faces + synthesized pinhole cameras + structured sky), consumed by BOTH
 * emitPreserve3dScene (/scene) and emitThreeWorld (/world) — the seam every
 * box-world rides, mirroring assembleFractalCityScene / assembleWorkbenchScene.
 * The terrain mesh is already world-space (x, y, z heightfield), so the World is a
 * pure dispatch over the same faces the CSS-3D scene draws.
 *
 * `bg` is a SOLID backdrop colour (sky horizon, else neutral) for the three.js
 * World, which sets it as a THREE.Color and can't parse a CSS gradient. The CSS-3D
 * caller below overrides bg with the zenith→horizon gradient it derives from `sky`.
 *
 * Returns null for a non-painted-landscape manifest (the caller decides the fallback).
 */
export function assemblePaintedLandscapeScene(manifest = {}, { unitScale = 22, title = 'mojulo terrain', city, cityDensity, bridges, farmland } = {}) {
  if (!manifest || manifest.kind !== 'painted-landscape') return null;
  // Aerial-map sticker/structure layers, all opt-in (render option or manifest):
  //   city      — massed mini-buildings (geometry) on buildable flats
  //   farmland  — patchwork field texture (surface sticker) on gentle dry land
  //   bridges   — span specs ({ from:[x,y], to:[x,y] }) for viaduct/causeway
  const wantCity = city ?? manifest.city === true;
  const wantFarm = farmland ?? manifest.farmland === true;
  const density = cityDensity ?? manifest.cityDensity ?? 0.6;
  const spans = bridges ?? manifest.bridges ?? [];
  const { faces, structures, extraFaces, bounds, sky, light: terrainLight, day = 1 } = buildTerrainWorldMesh(manifest, { city: wantCity, cityDensity: density, bridges: spans, farmland: wantFarm });
  const cameras = synthTerrainCameras(bounds);
  // Realize each box-spec. Tree scatter (shape ∈ conifer|tree|…) becomes real branched
  // taiji-plant geometry via plantBoxToFaces; city doodads / bridge piers / rocks extrude as
  // plain MASSED boxes (tinted roof + walls). All lit by the TERRAIN's light so a night forest
  // reads dim (ambient/diffuse scale with the day factor), not day-lit green.
  if (structures && structures.length) {
    const L = terrainLight
      ? makeLight({ direction: [terrainLight.x, terrainLight.y, terrainLight.z], ambient: 0.3 + 0.26 * day, diffuse: 0.26 + 0.3 * day })
      : makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
    const camHint = cameras[0]?.worldFraming?.cameraPosition || [0, 18, 8];
    for (const b of structures) {
      if (isPlantShape(b.shape)) faces.push(...plantBoxToFaces(b, { light: L }));
      else faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z1, { top: b.roof, side: b.wall }, L, camHint));
    }
  }
  // Bridge decks/parapets arrive pre-shaded as raw faces (per-point z → not boxes).
  if (extraFaces && extraFaces.length) faces.push(...extraFaces);
  const viewBox = manifest.viewBox && manifest.viewBox.width
    ? manifest.viewBox
    : { width: 1120, height: 760 };
  const bg = sky ? rgbStr(sky.horizon) : '#0e1014';
  return { faces, cameras, viewBox, unitScale, title, sky, bg };
}

export function renderPaintedLandscapeToHtml(manifest = {}, opts = {}) {
  const payload = assemblePaintedLandscapeScene(manifest, opts);
  if (!payload) return null;
  // zenith→horizon gradient backdrop, mirroring the SVG sky (no geometry). Drop the
  // structured `sky` + solid `bg` so this stays the exact bg-only CSS scene as before
  // (emitPreserve3dScene's `sky` handling expects the city preset shape, not terrain sky).
  const { sky, bg: _solidBg, ...rest } = payload;
  const bg = sky
    ? `linear-gradient(${rgbStr(sky.zenith)} 0%, ${rgbStr(sky.horizon)} 100%)`
    : '#0e1014';
  return emitPreserve3dScene({ ...rest, bg, signs: opts.signs });
}
