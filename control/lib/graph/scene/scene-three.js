/**
 * scene-three — the World renderer: emit a self-contained, TRAVERSABLE HTML page
 * that draws a baked scene with three.js (WebGL) and lets the operator move
 * through it (OrbitControls). Sibling to `emitPreserve3dScene` in scene-css3d.js;
 * both consume the SAME engine-agnostic payload from `assembleBoxCityScene`:
 *
 *   { faces, cameras, viewBox, unitScale, title, bg, sky }
 *
 * The CSS-3D emitter is the "looked at / preset-shot" Scene tier; this is the
 * "moved through" World tier (see docs split: Scene→SVG/PNG, World→live canvas).
 *
 * three.js is vendored under /public/vendor/three. Three delivery modes:
 *   • default — importmap points at the control server's /vendor/three (small page,
 *     offline-safe on the self-hosted control plane). This is how the live /world
 *     route serves it. NOT openable as a bare file:// — ES modules need an origin.
 *   • cdn:true — importmap points at a public CDN (jsdelivr) serving the SAME pinned
 *     three revision as real ES modules. Drops three's ~1MB base64 payload from the
 *     page (the rest — baked geometry + textures — stays inline, so a heavy scene is
 *     still sizeable), and opens from file:// / email / a dropped spike folder. Needs
 *     network at open time and pins to the CDN staying up. This is the mode for minted
 *     / downloadable World artifacts where file size matters.
 *   • inline:true — three.module + core + OrbitControls are read off disk and
 *     embedded as data:-URL modules in the importmap, so the page is a SELF-CONTAINED
 *     artifact that runs anywhere with NO server and NO network. Bigger (three is
 *     ~0.9MB base64). Now reserved for the headless PNG bake (renderWorldToPng feeds
 *     the page to Chromium via setContent, which has no origin to resolve /vendor or
 *     reach a CDN reliably) — kept so that bake stays fully offline.
 *
 * Lighting is already baked into the face colours, so the mesh renders UNLIT
 * (MeshBasicMaterial + vertexColors). World coords are z-up; we set camera.up=+Z
 * and feed `worldFraming` straight through with no remapping. unitScale is a
 * CSS-projection artifact and is intentionally unused here (world units are used
 * directly).
 */

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { faceListToMesh, decollideFaces, faceColorLinear, collectGlowSprites, collectShadowDecals, collectWaterMesh } from '../figures/face-mesh.js';
import { b64, safeJson, escapeHtml, VENDOR_IMPORTMAP, CDN_IMPORTMAP, inlineImportmap } from './emit-util.js';
import { CAPTURE_GLOBAL, CAPTURE_READY, CAPTURE_FRAME, CAPTURE_STEP, CAPTURE_PROBE, CAPTURE_COMPILE_WALK_TO } from './capture-contract.js';
import { expandSurfaceCards } from '../architecture/facade-card.js';
import { bakeAmbientOcclusion, instanceOccluderFaces, sampleAmbientAt } from '../effects/ao-bake.js';
import {
  actionsChannelScript, audioChannelScript, channelRuntimeSection, controllableChannelScript,
  eventsChannelScript, fxChannelScript, gameChannelScript, glowSpriteScript, inkDecalScript, mojStepCalls,
  normalizeRuntimeChannels, physicsChannelScript, pickChannelScript, shadowDecalScript,
  skyDomeScript, specularChannelScript, spriteSfxChannelScript, walkModeScript, waterMeshScript,
} from './channels.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';


// horizontal fov (deg) + aspect → vertical fov (deg) for THREE.PerspectiveCamera
export function verticalFov(hFovDeg, aspect) {
  const h = (hFovDeg || 60) * Math.PI / 180;
  const v = 2 * Math.atan(Math.tan(h / 2) / (aspect || 1));
  return v * 180 / Math.PI;
}

/**
 * Emit a traversable three.js World page.
 * @param {object} payload  { faces, cameras, viewBox, title, bg, sky, glow }
 *   glow: object-glow halos for emissive-fixture faces (the World's counterpart to the
 *   CSS path's box-shadow). `true` (default) | `false` | `{ opacity, scale }`. No-op for
 *   scenes without `glow`-tagged faces (e.g. day scenes — the sun ships `fixture:false`).
 */
// A full-screen RAYMARCHER World: a fragment shader (e.g. a GR geodesic integrator for a black hole)
// rendered on a screen quad, with the orbit camera's position + basis fed in as uniforms each frame so
// the shader casts rays from wherever the user has dragged the camera. A separate, minimal emitter —
// the mesh pipeline (groups, picks, channels) is irrelevant here. Reuses the importmap + .moj-readout.
export function emitRaymarchWorld({ frag, customUniforms = {}, dataTextures = {}, cameraStart = [0, 3, 17], target = [0, 0, 0], fov = 46, readout = [], steps = [], viewBox = { width: 1120, height: 780 }, title = 'mojulo world', bg = '#01010a', inline = false, cdn = false, pixelRatioCap = 1.5 } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  const cu = Object.entries(customUniforms).map(([k, v]) => `${k}:{value:${Array.isArray(v) ? `new THREE.Vector3(${v.join(',')})` : (+v)}}`).join(',');
  // Float RGBA data textures (e.g. the effects-layer box field / grid index) built in-page from
  // baked arrays. Nearest-filtered, no mips — they are lookup tables, not images.
  const td = Object.entries(dataTextures).map(([k, t]) =>
    `${k}:{value:(()=>{const tx=new THREE.DataTexture(new Float32Array(${safeJson(t.data)}),${t.width},${t.height},THREE.RGBAFormat,THREE.FloatType);tx.minFilter=THREE.NearestFilter;tx.magFilter=THREE.NearestFilter;tx.needsUpdate=true;return tx;})()}`,
  ).join(',');
  const extras = [cu, td].filter(Boolean).join(',');
  const VERT = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // Optional STEPPER (gallery): a prev/next bar that swaps the shader's uniforms + readout between a
  // list of presets — one model per step (e.g. a planet gallery). Same shader, different uniform sets.
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const roHtml = hasSteps
    ? `<div class="moj-stepper"><button id="mojPrev">◀</button><span id="mojLbl"></span><button id="mojNext">▶</button></div><div class="moj-readout" id="mojRo"></div>`
    : ((Array.isArray(readout) && readout.length) ? `<div class="moj-readout">${readout.map((s, i) => i === 0 ? `<b>${s}</b>` : `<span>${s}</span>`).join('')}</div>` : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:dark} body{margin:0;background:${bg};color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
  .moj-readout{position:absolute;left:8px;bottom:8px;background:rgba(4,7,16,.74);border:1px solid #24324a;border-radius:6px;padding:7px 10px;font-size:12px;color:#cfe3ff;display:flex;flex-direction:column;gap:2px;pointer-events:none;z-index:4;max-width:60%}
  .moj-readout b{color:#fff;margin-bottom:2px}
  .moj-stepper{position:absolute;left:50%;top:8px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(4,7,16,.78);border:1px solid #24324a;border-radius:8px;padding:5px 10px;font-size:13px;color:#cfe3ff;z-index:5}
  .moj-stepper button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:3px 10px;cursor:pointer;font:inherit}
  .moj-stepper span{min-width:128px;text-align:center;font-variant-numeric:tabular-nums}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>${roHtml}<div class="hint">drag to orbit · scroll to zoom</div></div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const wrap = document.getElementById('wrap'), canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ${pixelRatioCap}));   // lower cap ⇒ fewer rays/frame (raymarch cost is per-pixel)
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(${fov}, ${W / H}, 0.1, 2000);
cam.position.set(${cameraStart[0]}, ${cameraStart[1]}, ${cameraStart[2]});
const controls = new OrbitControls(cam, canvas);
controls.target.set(${target[0]}, ${target[1]}, ${target[2]});
controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 120; controls.update();
const uniforms = { uCamPos:{value:new THREE.Vector3()}, uCamBasis:{value:new THREE.Matrix3()}, uRes:{value:new THREE.Vector2()}, uTime:{value:0}, uFov:{value:${fov} * Math.PI / 180}, ${extras} };
const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: ${safeJson(VERT)}, fragmentShader: ${safeJson(frag)} });
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
const STEPS = ${hasSteps ? safeJson(steps) : '[]'};
if (STEPS.length) {
  const roEl = document.getElementById('mojRo'), lblEl = document.getElementById('mojLbl');
  let si = 0;
  const applyStep = (i) => {
    si = ((i % STEPS.length) + STEPS.length) % STEPS.length;
    const u = STEPS[si].uniforms || {};
    for (const k in u) { if (!uniforms[k]) continue; const v = u[k]; if (Array.isArray(v)) uniforms[k].value.set(v[0], v[1], v[2]); else uniforms[k].value = v; }
    const r = STEPS[si].readout || [];
    roEl.innerHTML = r.map((s, j) => j === 0 ? '<b>' + s + '</b>' : '<span>' + s + '</span>').join('');
    lblEl.textContent = (si + 1) + ' / ' + STEPS.length + '  ·  ' + (STEPS[si].label || '');
  };
  document.getElementById('mojPrev').onclick = () => applyStep(si - 1);
  document.getElementById('mojNext').onclick = () => applyStep(si + 1);
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') applyStep(si - 1); else if (e.key === 'ArrowRight') applyStep(si + 1); });
  applyStep(0);
}
const blitCam = new THREE.Camera();
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
function resize(){ const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); const dpr = renderer.getPixelRatio(); uniforms.uRes.value.set(w * dpr, h * dpr); }
window.addEventListener('resize', resize); resize();
renderer.setAnimationLoop((t) => {
  controls.update();
  cam.getWorldDirection(_f);
  _r.crossVectors(_f, cam.up).normalize();
  _u.crossVectors(_r, _f).normalize();
  uniforms.uCamBasis.value.set(_r.x, _u.x, _f.x, _r.y, _u.y, _f.y, _r.z, _u.z, _f.z);   // columns = right, up, forward
  uniforms.uCamPos.value.copy(cam.position);
  uniforms.uTime.value = t / 1000;
  renderer.render(scene, blitCam);
});
</script>
</body></html>`;
}


export function emitThreeWorld({ faces = [], cameras = [], viewBox = { width: 1120, height: 780 }, title = 'mojulo world', bg = '#0e1014', inline = false, cdn = false, glow = true, light = null, sky = null, textures = {}, wireframe = false, walk = false, picks = [], tracers = [], planets = [], movers = [], comets = [], fields = [], surfaces = [], heatSpheres = [], starSurfaces = [], buildups = [], transports = [], deforms = [], raymarch = null, decollide = true, capture = false, signs = [], physics = null, actions = [], entities = [], camera = null, figures = {}, events = null, fog = null, ao = null, repeats = [], audio = null, fx = null, effects = [], spriteSfx = [], game = null } = {}) {
  // effects-layer fog overlay (effects-occluder.js): a transparent volumetric pass composited over
  // the rasterized world. `fog` = { frag, customUniforms, dataTextures }. Built as a fullscreen quad
  // added to the scene with depthTest off + premultiplied blending, so three's transparent pass
  // draws it last over the mesh; an onBeforeRender hook feeds it the live camera each frame.
  // A raymarch overlay LAYER is { frag, customUniforms, dataTextures } — the fog effect is the
  // first, and `effects[]` (game-ui-language.plan.md U3) stacks more (glow / wisps) over the same
  // world. overlayExtras builds the per-layer uniform declarations (custom scalars/vec3s + data
  // textures) shared by fog and every effect layer, so all overlays speak one shape.
  const overlayExtras = (layer) => {
    const cu = Object.entries(layer.customUniforms || {}).map(([k, v]) => `${k}:{value:${Array.isArray(v) ? `new THREE.Vector3(${v.join(',')})` : (+v)}}`).join(',');
    const td = Object.entries(layer.dataTextures || {}).map(([k, t]) =>
      `${k}:{value:(()=>{const tx=new THREE.DataTexture(new Float32Array(${safeJson(t.data)}),${t.width},${t.height},THREE.RGBAFormat,THREE.FloatType);tx.minFilter=THREE.NearestFilter;tx.magFilter=THREE.NearestFilter;tx.needsUpdate=true;return tx;})()}`,
    ).join(',');
    return [cu, td].filter(Boolean).join(',');
  };
  const fogExtras = fog ? overlayExtras(fog) : '';
  // effects[] — additional stacked overlay layers beside fog. Each gets its own fullscreen quad,
  // camera-fed onBeforeRender, and a renderOrder above fog so they composite last. Deterministic
  // under camera bakes because frame() now pins __mojClock (U3). Absent ⇒ no bytes.
  const effectsList = Array.isArray(effects) ? effects.filter((e) => e && typeof e.frag === 'string') : [];
  const hasOverlay = !!fog || effectsList.length > 0;
  // Raymarch mode (black-hole-view): a full-screen GR geodesic fragment shader replaces the mesh
  // pipeline entirely. The mesh channels can't bend light; this can. Same /world funnel.
  if (raymarch && raymarch.frag) return emitRaymarchWorld({ ...raymarch, viewBox, title, bg, inline, cdn });
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  // `light` lets facade frame-bars self-shade their return cheeks (concrete/brick mass);
  // null is safe — the realizer falls back to a fixed asymmetry.
  // Water faces are pulled out up front: they render in their own translucent pass (per-vertex
  // alpha), never in the opaque mesh. They're plain quads, so they skip surface-card expansion.
  const waterRaw = faces.filter((f) => f && f.water);
  // De-collide ONCE over the whole opaque face set (z-fight fix). Done here — not inside each
  // group's bake — so coincident faces that land in DIFFERENT render groups (separate draw calls,
  // the worst z-fight case) are also lifted apart. Groups below then bake with decollide:false.
  const expanded0 = expandSurfaceCards(faces.filter((f) => !(f && f.water)), { light });
  const expanded1 = decollide ? decollideFaces(expanded0) : expanded0;
  // Instanced repeats (renderer-ladder P4): repeats = [{ template: faces[], transforms:
  // [{ pos, rotZ?, scale?, tint? }], group? }]. Templates are expanded HERE, before the AO
  // bake, so (a) the bake can ingest their instance-transformed phantoms as casters and
  // (b) the packing pass below reuses the same expansion.
  const repEntries = (Array.isArray(repeats) ? repeats : [])
    .filter((r) => r && Array.isArray(r.template) && r.template.length && Array.isArray(r.transforms) && r.transforms.length)
    .map((r) => ({ r, tpl: expandSurfaceCards(r.template, { light }) }));
  const aoOpts = ao ? (typeof ao === 'object' ? ao : {}) : null;
  // Baked ambient occlusion (effects/ao-bake.js, opted in via the payload's `ao` setting). Runs
  // HERE — after card expansion and de-collision — so facade sub-faces exist and the final corner
  // positions are sampled. Adds per-corner `vao` multipliers that faceListToMesh folds into the
  // vertex colours below; the .glb export applies the same pass at the same seam.
  // AO × instancing (renderer-convergence 1a, CAST): each repeat entry's solid template faces,
  // transformed per instance, join the bake as occluder-only phantoms — a tree canopy darkens
  // the terrain under every instance without the phantoms ever entering the render payload.
  const aoPhantoms = aoOpts && repEntries.length
    ? repEntries.flatMap(({ r, tpl }) => instanceOccluderFaces(tpl, r.transforms))
    : [];
  const expanded = aoOpts
    ? bakeAmbientOcclusion(expanded1, aoPhantoms.length ? { ...aoOpts, extraOccluders: aoPhantoms } : aoOpts)
    : expanded1;
  const mesh = faceListToMesh(expanded, { decollide: false }); // global bound for the camera-framing fallback

  // Pack each repeat template ONCE (transforms ride as flat arrays; the page lowers each entry
  // to a THREE.InstancedMesh — a 500-tree block ships one tree). Instances join `solids`, so
  // walk collision, pick occlusion, and the wireframe toggle treat them as world geometry.
  // AO × instancing (1a, RECEIVE — two approximate levels, per-vertex AO being impossible
  // inside one shared InstancedMesh geometry):
  //   • template self-AO: the template bakes against ITSELF, so its own creases/undersides
  //     darken identically in every instance;
  //   • per-instance ambient: one sampleAmbientAt sample per instance (at mid-height) against
  //     the world's own faces, folded into the instanceColor tint — a tree hemmed in by towers
  //     reads dimmer than one in the open. Blind to other instances by design.
  const packed0 = repEntries
    .map(({ r }, i) => ({ r, i }))
    .map(({ r, i }) => {
      const tplFaces = aoOpts ? bakeAmbientOcclusion(repEntries[i].tpl, aoOpts) : repEntries[i].tpl;
      const gm = faceListToMesh(tplFaces);
      return gm.positions.length ? { r, gm, i } : null;
    })
    .filter(Boolean);
  let ambAll = null;
  if (aoOpts && packed0.length) {
    const pts = packed0.flatMap(({ r, gm }) => r.transforms.map((t) => {
      const p = t.pos || [0, 0, 0];
      const s = Number.isFinite(t.scale) ? t.scale : 1;
      return [p[0], p[1], p[2] + gm.radius * s * 0.5];
    }));
    ambAll = sampleAmbientAt(expanded1, pts, aoOpts);
  }
  let ambOff = 0;
  const packedRepeats = packed0.map(({ r, gm, i }) => {
    const amb = ambAll ? ambAll.slice(ambOff, (ambOff += r.transforms.length)) : null;
    const hasAmb = !!amb && amb.some((a) => a < 0.999);
    const hasTint = r.transforms.some((t) => Array.isArray(t.tint));
    return {
      name: r.group || `repeat:${i}`,
      pos: b64(gm.positions),
      col: b64(gm.colors),
      radius: gm.radius,
      t: r.transforms.map((t) => [(t.pos || [0, 0, 0])[0], (t.pos || [0, 0, 0])[1], (t.pos || [0, 0, 0])[2], t.rotZ || 0, Number.isFinite(t.scale) ? t.scale : 1]),
      tint: (hasTint || hasAmb)
        ? r.transforms.map((t, k) => {
          const base = Array.isArray(t.tint) ? t.tint : [1, 1, 1];
          const a = amb ? amb[k] : 1;
          return [base[0] * a, base[1] * a, base[2] * a];
        })
        : null,
    };
  });
  // widen the camera-framing bound so a mostly-instanced world still frames fully
  for (const r of packedRepeats) {
    for (const t of r.t) {
      const d = Math.hypot(t[0] - mesh.center[0], t[1] - mesh.center[1], t[2] - mesh.center[2]) + r.radius * t[4];
      if (d > mesh.radius) mesh.radius = d;
    }
  }

  // Render groups: faces carrying a `group` (shell walls/ceiling/floor) become individually
  // toggleable sub-meshes; everything else collapses into one 'static' mesh. This is what
  // lets the World hide walls at runtime (immersive room cutaway). City/figure scenes ship
  // no `group`, so they render as a single mesh exactly as before. A hideable group needs a
  // `normal` (inward, toward room centre) on its faces to drive camera-facing auto-hide.
  const groupMap = new Map();
  // `decal:'shadow'` faces render ONLY in the shadow-decal pass, and `water` faces ONLY in the
  // translucent water pass below — keep both out of the opaque mesh (shadows would double as flat
  // dark patches; water needs per-vertex alpha the opaque mesh can't carry).
  for (const f of expanded) { if (f.decal === 'shadow' || f.decal === 'ink' || f.water) continue; const k = f.group || 'static'; (groupMap.get(k) || groupMap.set(k, []).get(k)).push(f); }
  const groups = [...groupMap].map(([name, fs]) => {
    const gm = faceListToMesh(fs, { decollide: false }); // already de-collided globally above
    const nf = fs.find((f) => Array.isArray(f.normal));
    const hideable = name.startsWith('shell:') && !name.endsWith('floor') && !!nf;
    // a group whose faces ask for it renders as a see-through edge cage (x-ray walls)
    const wireframe = fs.some((f) => f.wireframe);
    // textured sub-groups (label wraps): one { key, pos, uv } per texture, rendered as a
    // MeshBasicMaterial({ map }). Empty for every existing scene → no behavior change.
    const tex = Object.entries(gm.textureGroups || {}).map(([key, g]) => ({ key, pos: b64(g.positions), uv: b64(g.uvs), col: b64(g.colors), lit: !!g.lit, ...(g.specs ? { spec: b64(g.specs) } : {}) }));
    // per-group translucency (cellular-view jelly + organelles): a face-level `alpha` < 1 turns
    // the whole group into a transparent mesh. null/absent → opaque, unchanged for every existing
    // scene. Stays a real group mesh (raycastable for picks, togglable to wireframe).
    const af = fs.find((f) => typeof f.alpha === 'number' && f.alpha < 1);
    const alpha = af ? af.alpha : null;
    // per-vertex specular params (faces tagged `spec` by a material) — the key is only present
    // when the group carries them, so material-free scenes serialize byte-identically.
    return { name, pos: b64(gm.positions), col: b64(gm.colors), center: gm.center, normal: nf ? nf.normal : null, hideable, wireframe, tex, alpha, ...(gm.specs ? { spec: b64(gm.specs) } : {}) };
  });
  const hasTextures = groups.some((g) => g.tex.length);

  // Object-glow: one camera-facing additive sprite per emissive-fixture face. Driven by
  // the SAME `glow` markers the baked face list already carries (see collectGlowSprites).
  const glowCfg = glow && typeof glow === 'object' ? glow : {};
  const sprites = glow ? collectGlowSprites(faces, { scale: glowCfg.scale ?? 1 }) : [];
  const glowBlock = sprites.length ? glowSpriteScript(sprites, glowCfg.opacity ?? 0.95) : '';

  // Specular channel (material-response.plan.md P2): live Blinn-Phong against the fixed baked
  // light for groups whose faces carry `spec`. One-shot setup block (glow/shadow posture) —
  // no spec faces → zero bytes, every existing World byte-for-byte unchanged. The highlight
  // direction follows the scene's own baked light when the payload carries one (a vexar
  // makeLight — the workbench studio does), so specular and diffuse agree.
  const specBlock = groups.some((g) => g.spec || (g.tex || []).some((t) => t.spec))
    ? specularChannelScript(light && Array.isArray(light.toLight) ? light.toLight : DEFAULT_LIGHT.toLight)
    : '';

  // Shadow decals: the CSS-3D cast/contact shadows, realized as flat dark ground quads.
  const decals = collectShadowDecals(faces);
  const shadowBlock = decals.length ? shadowDecalScript(decals) : '';

  // Crease "ink" feather decals: faces tagged decal:'ink' (corner order [crease0,crease1,
  // outer1,outer0]) → directional soft contact-shadow bands. No existing scene emits them.
  const inks = faces.filter((f) => f.decal === 'ink' && Array.isArray(f.corners) && f.corners.length >= 4)
    .map((f) => ({ quad: f.corners.slice(0, 4), alpha: f.inkAlpha ?? 0.85, color: f.inkColor || [0, 0, 0] }));
  const inkBlock = inks.length ? inkDecalScript(inks) : '';

  // Translucent water: a separate mesh with per-vertex alpha (shallows clear, deeps opaque).
  const waterMesh = waterRaw.length ? collectWaterMesh(waterRaw) : null;
  const waterBlock = waterMesh ? waterMeshScript(waterMesh) : '';

  // Sky dome: a world-fixed gradient sphere (+ night stars + a phase-carved moon) centred on the
  // scene, so ORBITING reveals the gradient/stars/moon from new angles (they move with the world,
  // not glued to the viewport). Only the painted-landscape terrain ships the explicit
  // { zenith, horizon } sky shape; box-world preset skies carry no zenith array and are
  // skipped (their World keeps the solid bg) — so this is additive + safe for every kind.
  // Two sky shapes funnel through skyDomeScript: the ATMOSPHERE sky (a { zenith, horizon }
  // gradient dome + upper-biased night stars — painted-landscape) and the SPACE sky
  // (`space:true` — no gradient dome, a uniform FULL-sphere starfield always on, void bg —
  // the planetary body in a celestial sphere). Box-world preset skies carry neither flag and
  // are skipped (their World keeps the solid bg) — so this stays additive + safe for every kind.
  const skyDome = sky && (sky.space || (Array.isArray(sky.zenith) && Array.isArray(sky.horizon)))
    ? { space: !!sky.space, zenith: sky.zenith || [], horizon: sky.horizon || [],
      day: Number.isFinite(sky.day) ? sky.day : (sky.space ? 0 : 1),
      stars: Number.isFinite(sky.stars) ? sky.stars : (sky.space ? 1 : 0), seed: (sky.seed >>> 0) || 1,
      // a moon makes no sense pinned on a planet's own celestial sphere → space drops it; the sun
      // rides through (space suns carry a 3D `dir`, horizon suns a front-sky { u, h }).
      moon: sky.space ? null : (sky.moon || null), sun: sky.sun || null,
      // a scene may PIN the celestial-sphere centre/radius (e.g. planetary, so a far companion
      // body can't drag the bounds centroid — and the star sphere + sun direction — off the body);
      // otherwise fall back to the geometry bounds, unchanged for every existing scene.
      center: Array.isArray(sky.center) ? sky.center : mesh.center,
      radius: Number.isFinite(sky.radius) ? sky.radius : (mesh.radius || 20) }
    : null;
  const skyBlock = skyDome ? skyDomeScript(skyDome) : '';

  // Cameras → traversal bookmarks. Fall back to a 3/4 orbit framing of the
  // geometry's bounding sphere when a world ships no worldFraming camera.
  const cams = (cameras.length ? cameras : [null]).map((cam, i) => {
    const wf = cam && cam.worldFraming;
    if (wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt)) {
      return { name: cam.name || `view ${i}`, pos: wf.cameraPosition, target: wf.lookAt, vfov: verticalFov(wf.horizontalFov, aspect) };
    }
    const [cx, cy, cz] = mesh.center;
    const r = mesh.radius || 20;
    return { name: 'orbit', pos: [cx + r * 1.1, cy - r * 1.1, cz + r * 0.8], target: [cx, cy, cz], vfov: verticalFov(55, aspect) };
  });

  // Opt-in first-person free-traverse. Defaults derive off the mesh bounds so a bare
  // `walk:true` works in ANY World; callers may pass `{ speed, spawn:[x,y,z] }` or the legacy
  // `{ eye, spawn:[x,y] }` (eye → spawn z). Speed scales with world radius (a room and a city
  // both feel right). Spawn z falls back to the centroid height — a safe see-everything vantage
  // the operator flies down from with Shift.
  const wk = walk && typeof walk === 'object' ? walk : {};
  const walkZ = Number.isFinite(wk.eye) ? wk.eye : mesh.center[2];
  const walkXY = Array.isArray(wk.spawn) ? wk.spawn : [mesh.center[0], mesh.center[1]];
  const wkSpeed = Number.isFinite(wk.speed) ? wk.speed : Math.max(6, (mesh.radius || 20) * 0.4);
  // WALK-mode physics scale off the world: player half-width for wall collision, gravity/jump off
  // speed so a room and a city both feel right, a floor under derived eye-height. All overridable.
  const wkRadius = Number.isFinite(wk.radius) ? wk.radius : Math.max(0.3, (mesh.radius || 20) * 0.012);
  const walkCfg = walk ? {
    speed: wkSpeed,
    spawn: [walkXY[0], walkXY[1], Number.isFinite(walkXY[2]) ? walkXY[2] : walkZ],
    radius: wkRadius,
    minEye: Number.isFinite(wk.minEye) ? wk.minEye : Math.max(1, wkRadius * 2.5),
    gravity: Number.isFinite(wk.gravity) ? wk.gravity : wkSpeed * 2.5,
    jump: Number.isFinite(wk.jump) ? wk.jump : wkSpeed * 1.3,
    // opt-in FPV head-bob: a baked gait-camera curve (gait-camera.js `gaitCameraCurve`)
    // riding the WALK eye. null → the rigid-eye walk, byte-for-byte unchanged.
    bob: wk.bob && Array.isArray(wk.bob.curve) ? wk.bob : null,
  } : null;
  const walkBlock = walkCfg ? walkModeScript(walkCfg, mesh.center) : '';
  const hintText = walkCfg
    ? 'drag to orbit · <b>walk</b> = gravity + walls · <b>fly</b> = free 6DOF'
    : 'drag to orbit · scroll to zoom · right-drag to pan';

  // Pick channel (opt-in, additive): a name → metadata map keyed by group name, raised as a DOM
  // popup when the operator CLICKS the matching sub-mesh (an atom/bond, etc.). Empty `picks` →
  // no PICK_META, no handler, no overlay — every existing World is byte-for-byte unchanged.
  const pickMeta = {};
  for (const p of (Array.isArray(picks) ? picks : [])) { if (p && p.name) pickMeta[p.name] = p; }
  const hasPicks = Object.keys(pickMeta).length > 0;
  const pickBlock = hasPicks ? pickChannelScript(pickMeta) : '';

  // Uniform runtime channels (tracers … signs) — normalized + scripted by the registry
  // (channels.js RUNTIME_CHANNELS): one row per channel carries the payload filter, the
  // script, the emitted header/let lines, and the __mojStep slot. All stay opt-in and
  // additive — an absent channel contributes ZERO bytes to the page. Bespoke channels
  // (walk / physics / actions / events / controllable) are normalized below and hand
  // their finished block into the same map.
  const { lists: chLists, blocks: chBlocks } = normalizeRuntimeChannels({ tracers, planets, movers, comets, fields, surfaces, heatSpheres, starSurfaces, buildups, transports, deforms, signs });
  const hasSigns = !!chLists.signs;
  chBlocks.walk = walkBlock;

  // physics channel (opt-in, LIVE): the actions-world simulated-matter substrate. Empty / absent
  // `physics.bodies` → no block, default loop unchanged. This is the only NON-deterministic channel:
  // it runs the integrator live rather than replaying a baked path (actions-world.plan.md).
  const hasPhysics = physics && Array.isArray(physics.bodies) && physics.bodies.length > 0;
  const physicsBlock = hasPhysics ? physicsChannelScript(physics) : '';

  // actions channel (opt-in, LIVE): input → impulse on a physics body. Requires the physics channel,
  // so it is gated on hasPhysics; absent / empty `actions` → no block.
  const actionList = (Array.isArray(actions) ? actions : []).filter((a) => a && a.do);
  const actionsBlock = hasPhysics && actionList.length ? actionsChannelScript(actionList) : '';

  // events channel (opt-in, LIVE): the in-world bus (event-bus.plan.md). Present when `events` carries
  // reactions or sequences — it reacts to physics FACTS (via __mojSim, when physics is live) and/or
  // timer-driven sequences, reflecting verb effects onto marker meshes. No reactions/sequences → no
  // block (a bare `sources` list with nothing listening is inert, so it is not worth emitting).
  const hasEvents = !!events && ((Array.isArray(events.reactions) && events.reactions.length > 0) || (Array.isArray(events.sequences) && events.sequences.length > 0));
  const eventsBlock = hasEvents ? eventsChannelScript(events) : '';
  // audio channel: never emitted on capture runs (headless bakes carry no sound and must stay
  // byte-identical to a muted live run); absent audio interpolates '' so no-audio worlds are
  // byte-identical to today.
  const audioBlock = audio && !capture ? audioChannelScript(audio) : '';
  // game channel: emitted in capture runs too (the bridge is inert I/O there, but the outcome
  // envelope must stay observable for completability audits); absent game interpolates '' so
  // no-game worlds are byte-identical to today.
  const gameBlock = game ? gameChannelScript(game) : '';

  // controllable channel (opt-in, LIVE): the unified control primitive. Present when the manifest
  // carries `entities` (or a `camera` spec). When it owns a camera entity it disables OrbitControls.
  const entityList = (Array.isArray(entities) ? entities : []).filter((e) => e && (e.rule || e.body || e.isCamera));
  const hasControllable = entityList.length > 0 || (camera && camera.rule);
  // pack any `figure-frames` bodies once (Uint16 corners + Uint8 colour, feet planted at z=0) into one
  // or more named locomotion CLIPS. `figures[name]` is either an array of frames (a single clip →
  // 'forward', back-compat) or a map { clipName: frames } (e.g. { forward, strafe }).
  const packedFigures = {};
  const __packClip = (frames) => {
    const pk = packFigureFrames(frames);
    const foot = [pk.center[0], pk.center[1], pk.origin[2]];
    const figH = 2 * (pk.center[2] - pk.origin[2]) || pk.radius * 1.2;
    return { pos: pk.pos, col: pk.col, origin: pk.origin, invScale: pk.invScale, foot, figH, lerp: pk.lerpMedian <= FIG_LERP_MEDIAN_MAX };
  };
  for (const [name, spec] of Object.entries(figures || {})) {
    if (Array.isArray(spec)) { if (spec.length) packedFigures[name] = { clips: { forward: __packClip(spec) } }; }
    else if (spec && spec.rig === true) packedFigures[name] = spec;   // rig-bake output (pose curves + rigid parts) — already packed
    else if (spec && typeof spec === 'object') {
      const clips = {};
      for (const [cn, frames] of Object.entries(spec)) if (Array.isArray(frames) && frames.length) clips[cn] = __packClip(frames);
      if (Object.keys(clips).length) packedFigures[name] = { clips };
    }
  }
  // fx channel (game-ui-language.plan.md, U2): standing states + one-shot gestures decorating
  // controllable entities by id. Present only when the manifest carries a non-empty `fx`; absent
  // ⇒ byte-identical (no scaffolding emitted). It reads __mojCtrl.bodies, so the controllable
  // channel exposes that map ONLY when fx is active (keeping fx-free worlds byte-identical). It is
  // driven by __mojStep(t) — deterministic in every mode, unlike audio's own rAF loop — so it is
  // NOT capture-gated: gestures/states render in bakes and audits alike (presentation-only, so
  // probes are untouched).
  const fxNorm = (fx && typeof fx === 'object'
    && ((fx.states && Object.keys(fx.states).length) || (fx.on && Object.keys(fx.on).length))) ? fx : null;
  const fxBlock = fxNorm ? fxChannelScript(fxNorm) : '';
  // sprite sfx channel (game-ui-language.plan.md §V): the game sfx VERB shelf rendered as additive
  // sprites (not a raymarch overlay). Present only when the manifest carries resolved `spriteSfx`
  // layers; absent ⇒ byte-identical. Driven by __mojStep(t) like fx, so it renders in bakes too.
  const spriteSfxList = Array.isArray(spriteSfx) ? spriteSfx.filter((L) => L && typeof L.verb === 'string' && Array.isArray(L.cc) && L.cc.length === 3) : [];
  const spriteSfxBlock = spriteSfxList.length ? spriteSfxChannelScript(spriteSfxList) : '';
  // effects[] block (U3): one fullscreen premultiplied quad per layer, each camera-fed and stacked
  // above fog (renderOrder 100001+i). Same shape as the fog quad, so fog stays byte-identical and
  // glow/wisp layers ride beside it. uTime rides window.__mojClock (pinned by frame()/step()).
  const effectsBlock = effectsList.length ? `
// ---- effects layers (game UI language U3): stacked raymarch overlays over the world ----
${effectsList.map((layer, i) => `{
const __eU${i} = { uCamPos:{value:new THREE.Vector3()}, uCamBasis:{value:new THREE.Matrix3()}, uRes:{value:new THREE.Vector2()}, uTime:{value:0}, uFov:{value:1}, ${overlayExtras(layer)} };
const __eMat${i} = new THREE.ShaderMaterial({ uniforms: __eU${i}, vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: ${safeJson(layer.frag)}, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
const __eQuad${i} = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), __eMat${i});
__eQuad${i}.frustumCulled = false; __eQuad${i}.renderOrder = ${100001 + i};
const __efw${i} = new THREE.Vector3(), __efr${i} = new THREE.Vector3(), __efu${i} = new THREE.Vector3(), __efs${i} = new THREE.Vector2();
__eQuad${i}.onBeforeRender = (rnd, scn, cam) => {
  cam.getWorldDirection(__efw${i}); __efr${i}.crossVectors(__efw${i}, cam.up).normalize(); __efu${i}.crossVectors(__efr${i}, __efw${i}).normalize();
  __eU${i}.uCamBasis.value.set(__efr${i}.x, __efu${i}.x, __efw${i}.x, __efr${i}.y, __efu${i}.y, __efw${i}.y, __efr${i}.z, __efu${i}.z, __efw${i}.z);
  __eU${i}.uCamPos.value.copy(cam.position);
  __eU${i}.uFov.value = cam.fov * Math.PI / 180;
  rnd.getSize(__efs${i}); const __dpr = rnd.getPixelRatio(); __eU${i}.uRes.value.set(__efs${i}.x * __dpr, __efs${i}.y * __dpr);
  __eU${i}.uTime.value = (window.__mojClock != null ? window.__mojClock : (typeof performance !== 'undefined' ? performance.now() : 0)) / 1000;
};
scene.add(__eQuad${i});
}`).join('\n')}
` : '';
  const controllableBlock = hasControllable ? controllableChannelScript(entityList, camera, packedFigures, { exposeBodies: !!fxNorm }) : '';
  // bespoke channels hand their finished blocks into the registry-ordered runtime section
  chBlocks.physics = physicsBlock;
  chBlocks.actions = actionsBlock;
  chBlocks.events = eventsBlock;
  chBlocks.controllable = controllableBlock;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hud{position:absolute;left:8px;top:8px;display:flex;gap:6px;flex-wrap:wrap}
  .hud button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .hud button.on{background:#1b2740;color:#fff}
  .hud button.off{opacity:.45;text-decoration:line-through}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
  .moj-readout{position:absolute;left:8px;bottom:8px;background:rgba(11,18,32,.82);border:1px solid #24324a;border-radius:6px;padding:7px 10px;font-size:12px;color:#cfe3ff;display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums;pointer-events:none;z-index:4}
  .moj-readout b{color:#fff;margin-bottom:2px}
  .moj-readout .v{color:#7ee2a6}
  .moj-readout .a{color:#ff9b80}
  .mol-popup{position:absolute;min-width:120px;max-width:240px;background:rgba(11,18,32,.93);border:1px solid #2c3e5c;border-radius:7px;padding:8px 10px;font-size:12px;color:#cfe3ff;pointer-events:none;box-shadow:0 6px 22px rgba(0,0,0,.45);z-index:5}
  .mol-popup .pk-label{font-weight:600;color:#fff;margin-bottom:4px}
  .mol-popup .pk-row{display:flex;justify-content:space-between;gap:12px;line-height:1.5}
  .mol-popup .pk-row .pk-k{color:#7f9bc4}${hasSigns ? `
  .moj-signs{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}
  .moj-sign{position:absolute;pointer-events:auto;max-width:240px;box-sizing:border-box;line-height:1.4;transition:opacity .18s ease}
  .moj-sign--popup{width:210px}
  .moj-sign-track.moj-sign--popup,.moj-sign-track.moj-sign--toast,.moj-sign-pt.moj-sign--popup,.moj-sign-pt.moj-sign--toast{transform:translate(-50%,calc(-100% - 10px))}
  .moj-sign-track.moj-sign--tooltip,.moj-sign-pt.moj-sign--tooltip{transform:translate(-50%,-50%)}
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
  .moj-pg-down{margin-top:6px;color:inherit;background:rgba(255,255,255,.12);border:none;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit}` : ''}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="hud" id="hud"></div>
    <div class="hint">${hintText}</div>
    ${hasPicks ? '<div class="mol-popup" id="molPopup" hidden></div>' : ''}
    ${hasSigns ? '<div class="moj-signs" id="mojSigns"></div>' : ''}
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GROUPS = ${safeJson(groups)};
const CAMS = ${safeJson(cams)};
const BG = ${safeJson(bg)};
const TEXTURES = ${hasTextures ? safeJson(textures) : '{}'};
const WIREFRAME0 = ${wireframe ? 'true' : 'false'};   // start in construction-wireframe mode?
function decodeF32(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Float32Array(u.buffer); }

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c'), hud = document.getElementById('hud');
// logarithmicDepthBuffer: the world camera spans near 0.05 → far 8000 (close interiors
// up to whole cities), and proud "decal" faces (arched windows/iwans, signage, balconies)
// sit only a few cm in front of their wall. A linear depth buffer starves that gap of
// precision and the decals z-fight (shimmer). The log buffer restores precision across
// the range so the proud faces win cleanly from any orbit distance.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

// One mesh per render group. Hideable groups (walls/ceiling) get a transparent material so
// they can fade; static groups (furniture, floor, whole cities) stay opaque.
const meshes = {}, hideable = [], solids = [], xrayGroups = [];   // solids: every opaque fill mesh, for the wireframe toggle
for (const grp of GROUPS) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(grp.pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(grp.col), 3));
  geo.computeBoundingSphere();
  const translucent = typeof grp.alpha === 'number' && grp.alpha < 1;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: grp.hideable || translucent, opacity: translucent ? grp.alpha : 1, depthWrite: !translucent });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = (grp.hideable || translucent) ? 1 : 0;
  m.userData.g = grp.name;   // group name → pick lookup (PICK_META); inert when no picks emitted
  scene.add(m); meshes[grp.name] = m;
  if (grp.hideable) hideable.push(grp);
  // X-ray group (outer walls): render an EdgesGeometry cage you can see through, with
  // the solid fill hidden by default. The 'x-ray' HUD button flips between the two.
  // Kept OUT of the solids set so the global wireframe toggle manages it via xrayGroups only.
  if (grp.wireframe) {
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0x9fc0ea }));
    cage.renderOrder = 2; scene.add(cage);
    m.visible = false;
    xrayGroups.push({ name: grp.name, fill: m, cage, on: true });
  } else { solids.push(m); }
  // textured label-wrap sub-meshes: a MeshBasicMaterial({ map }) per texture key (the can/box label).
  for (const t of (grp.tex || [])) {
    const url = TEXTURES[t.key]; if (!url) continue;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(decodeF32(t.pos), 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(decodeF32(t.uv), 2));
    // MULTIPLY-lit textures (textureLit faces, e.g. asphalt roads/ground) carry the baked
    // per-vertex colour so the GPU does texel * bakedLight. lit ONLY controls that multiply;
    // biaxial RepeatWrapping is set for every textured face so a small tile repeats across a
    // large quad on both axes (label wraps keep V in [0,1], so wrapT is a no-op for them).
    if (t.lit) tg.setAttribute('color', new THREE.BufferAttribute(decodeF32(t.col), 3));
    tg.computeBoundingSphere();
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    const tm = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: tex, vertexColors: !!t.lit, side: THREE.DoubleSide }));
    tm.renderOrder = 0.6; // over the form, under additive glow
    scene.add(tm); solids.push(tm);
  }
}

// ---- instanced repeats (renderer-ladder P4): one geometry upload, N transforms ----
// Each entry is one InstancedMesh: baked template colours per vertex, per-instance matrix
// (translate + yaw about +Z + uniform scale), optional per-instance tint multiplier.
// Pushed into solids: walk collision + pick occlusion + the wireframe toggle see instances
// exactly like expanded geometry (three raycasts InstancedMesh per instance).
const REPEATS = ${safeJson(packedRepeats)};
for (const r of REPEATS) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(r.pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(r.col), 3));
  geo.computeBoundingSphere();
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), r.t.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), S = new THREE.Vector3();
  r.t.forEach((t, i) => {
    Q.setFromAxisAngle(UP, t[3]);
    P.set(t[0], t[1], t[2]); S.set(t[4], t[4], t[4]);
    M.compose(P, Q, S);
    im.setMatrixAt(i, M);
    if (r.tint) im.setColorAt(i, new THREE.Color(r.tint[i][0], r.tint[i][1], r.tint[i][2]));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.userData.g = r.name;
  scene.add(im); solids.push(im); meshes[r.name] = im;
}

const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000);
camera.up.set(0, 0, 1); // world is z-up
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

function applyCam(i){
  const c = CAMS[i];
  camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
  controls.target.set(c.target[0], c.target[1], c.target[2]);
  camera.fov = c.vfov; camera.updateProjectionMatrix();
  controls.update();
  [...hud.children].forEach((b, k) => b.classList.toggle('on', k === i));
}
CAMS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c.name; b.onclick = () => applyCam(i); hud.appendChild(b); });

// Wireframe (construction) mode: hide the lit fills, show feature-edge lines built per group with
// EdgesGeometry — coplanar quad diagonals are dropped (a clean ring/profile cage, not triangle
// soup), and interpenetration / floating monomers that flat shading hides read straight off the
// edges. The edge meshes are built lazily on first toggle (no cost / no perf hit for worlds never
// switched to wire). Available in every World; it's the workbench object study that leans on it.
let wireframeOn = false, wiresBuilt = false; const wires = [];
const wireBtn = document.createElement('button'); wireBtn.textContent = 'wireframe';
function buildWires() {
  for (const s of solids) {
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(s.geometry, 1), new THREE.LineBasicMaterial({ color: 0xa9c7ee }));
    w.renderOrder = 2; scene.add(w); wires.push(w);
  }
  wiresBuilt = true;
}
function setWireframe(on) {
  wireframeOn = on;
  if (on && !wiresBuilt) buildWires();
  for (const s of solids) s.visible = !on;
  for (const w of wires) w.visible = on;
  // x-ray fill stays hidden when EITHER global wireframe or x-ray is on; cage shows for either
  for (const g of xrayGroups) { g.fill.visible = !on && !g.on; g.cage.visible = on || g.on; }
  wireBtn.classList.toggle('on', on);
}
wireBtn.onclick = () => setWireframe(!wireframeOn);
hud.appendChild(wireBtn);

// X-ray outer walls: flip the envelope between a see-through edge cage and solid fill.
if (xrayGroups.length) {
  const xb = document.createElement('button'); xb.textContent = 'x-ray'; xb.classList.add('on');
  xb.onclick = () => {
    const on = !xrayGroups[0].on;
    for (const g of xrayGroups) { g.on = on; g.fill.visible = !on && !wireframeOn; g.cage.visible = on || wireframeOn; }
    xb.classList.toggle('on', on);
  };
  hud.appendChild(xb);
}

// Immersive room cutaway: per-wall toggles + auto-hide (hide a wall once the camera sits on
// its outward side, i.e. between camera and room). No hideable groups (city/figure) → no UI.
let autoCut = true; const manualHidden = new Set();
if (hideable.length) {
  const sep = document.createElement('span'); sep.textContent = 'walls:'; sep.style.cssText = 'align-self:center;opacity:.5;margin-left:6px'; hud.appendChild(sep);
  const ab = document.createElement('button'); ab.textContent = 'auto'; ab.classList.add('on');
  ab.onclick = () => { autoCut = !autoCut; ab.classList.toggle('on', autoCut); };
  hud.appendChild(ab);
  for (const grp of hideable) {
    const b = document.createElement('button');
    b.textContent = grp.name.replace('shell:', '').replace('Wall', '').replace('ceiling', 'roof');
    b.onclick = () => { manualHidden.has(grp.name) ? manualHidden.delete(grp.name) : manualHidden.add(grp.name); b.classList.toggle('off', manualHidden.has(grp.name)); };
    hud.appendChild(b);
  }
}
function updateCutaway() {
  for (const grp of hideable) {
    const m = meshes[grp.name], n = grp.normal;
    const dx = camera.position.x - grp.center[0], dy = camera.position.y - grp.center[1], dz = camera.position.z - grp.center[2];
    const camOutside = -(dx * n[0] + dy * n[1] + dz * n[2]) > 0; // camera on the wall's outward side
    const target = autoCut ? (camOutside ? 0 : 1) : (manualHidden.has(grp.name) ? 0 : 1);
    m.material.opacity += (target - m.material.opacity) * 0.18;
    m.visible = !wireframeOn && m.material.opacity > 0.02;   // wireframe owns fill visibility
  }
}

function resize(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
applyCam(0);
if (WIREFRAME0) setWireframe(true);   // deep-link / baked still can open straight in wire
${skyBlock}
${waterBlock}
${shadowBlock}
${inkBlock}
${glowBlock}${specBlock}
${pickBlock}
${channelRuntimeSection(chBlocks)}
// Frozen-frame deep link: ?t=<ms> renders ONE static frame at that simulation time (every animated
// channel stepped to t) instead of running the rAF loop — a deterministic still/thumbnail that doesn't
// depend on how long the page has been open (and doesn't fight headless virtual-time budgets). Orbit
// still works: the camera re-renders on control change. No ?t → the normal live loop, unchanged.
${fxNorm ? 'let stepFx = () => {};\n' : ''}${spriteSfxList.length ? 'let stepSpriteSfx = () => {};\n' : ''}function __mojStep(t) { ${mojStepCalls()}${fxNorm ? ' stepFx(t);' : ''}${spriteSfxList.length ? ' stepSpriteSfx(t);' : ''} }
${fxBlock}${spriteSfxBlock}${fog ? `
// ---- effects layer: volumetric fog composited over the rasterized world ----
const __fogU = { uCamPos:{value:new THREE.Vector3()}, uCamBasis:{value:new THREE.Matrix3()}, uRes:{value:new THREE.Vector2()}, uTime:{value:0}, uFov:{value:1}, ${fogExtras} };
const __fogMat = new THREE.ShaderMaterial({ uniforms: __fogU, vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: ${safeJson(fog.frag)}, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
const __fogQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), __fogMat);
__fogQuad.frustumCulled = false; __fogQuad.renderOrder = 100000;
const __ff = new THREE.Vector3(), __fr = new THREE.Vector3(), __fu = new THREE.Vector3(), __fsz = new THREE.Vector2();
__fogQuad.onBeforeRender = (rnd, scn, cam) => {
  cam.getWorldDirection(__ff); __fr.crossVectors(__ff, cam.up).normalize(); __fu.crossVectors(__fr, __ff).normalize();
  __fogU.uCamBasis.value.set(__fr.x, __fu.x, __ff.x, __fr.y, __fu.y, __ff.y, __fr.z, __fu.z, __ff.z);   // cols = right, up, forward
  __fogU.uCamPos.value.copy(cam.position);
  __fogU.uFov.value = cam.fov * Math.PI / 180;
  rnd.getSize(__fsz); const __dpr = rnd.getPixelRatio(); __fogU.uRes.value.set(__fsz.x * __dpr, __fsz.y * __dpr);
  // capture/traversal runs pin the clock (window.__mojClock, ms) so baked fog is reproducible;
  // live viewing keeps wall-clock drift.
  __fogU.uTime.value = (window.__mojClock != null ? window.__mojClock : (typeof performance !== 'undefined' ? performance.now() : 0)) / 1000;
};
scene.add(__fogQuad);
` : ''}${effectsBlock}${audioBlock}
const _freezeRaw = new URLSearchParams(location.search).get('t');
const _freeze = _freezeRaw !== null && Number.isFinite(+_freezeRaw) ? +_freezeRaw : null;
const _capture = ${capture ? 'true' : 'false'};${gameBlock}
if (_capture) {
  // Headless frame-capture mode (forge_motion world subjects): no rAF loop. Two drivers share
  // the one WebGL context (lib/motion/world-frames.js):
  //   frame(spec) — CAMERA-driven: set pos/target/fov + sim-time, render. A camera flying over
  //                 a world whose animation is a function of time.
  //   step(spec)  — INPUT-driven (renderer-ladder P3, traversals): advance the LIVE channels
  //                 one fixed tick with a normalized input snapshot, then render. A camera
  //                 ENTITY (follow/FPV) owns the view via stepControllable; else the camera
  //                 stays where frame()/the initial framing put it. window.__mojClock pins
  //                 every clocked visual (fog) to the traversal clock so replays are exact.
  //   probe()     — the assertion surface: entity transforms + HUD/bus vars + physics bodies.
  controls.update(); updateCutaway(); __mojStep(0); renderer.render(scene, camera);
  let __capT = 0;   // traversal clock, ms
  window.${CAPTURE_GLOBAL} = {
    ${CAPTURE_READY}: true,
    ${CAPTURE_FRAME}(spec) {
      spec = spec || {};
      if (Array.isArray(spec.pos)) camera.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      if (Array.isArray(spec.target)) controls.target.set(spec.target[0], spec.target[1], spec.target[2]);
      if (Number.isFinite(spec.vfov)) { camera.fov = spec.vfov; camera.updateProjectionMatrix(); }
      controls.update();
      ${(capture && hasOverlay) ? 'window.__mojClock = Number.isFinite(spec.t) ? spec.t : 0;   // U3: pin the overlay clock so raymarch effects (fog/glow/wisps) bake deterministically under camera frames\n      ' : ''}__mojStep(Number.isFinite(spec.t) ? spec.t : 0);
      updateCutaway();
      renderer.render(scene, camera);
    },
    ${CAPTURE_STEP}(spec) {
      spec = spec || {};
      const dt = Number.isFinite(spec.dt) && spec.dt > 0 ? spec.dt : 1 / 24;
      __capT += dt * 1000;
      window.__mojClock = __capT;
      if (__ctrlActive) stepControllable(dt, spec.input || {});   // entities + camera entity
      // camera override for worlds with no camera entity (chase shots authored per-tick)
      if (!__ctrlOwnsCamera) {
        if (Array.isArray(spec.pos)) camera.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
        if (Array.isArray(spec.target)) controls.target.set(spec.target[0], spec.target[1], spec.target[2]);
        controls.update();
      }
      __mojStep(__capT);   // clocked channels + physics + events ride the same tick clock
      updateCutaway();
      renderer.render(scene, camera);
    },
    ${CAPTURE_PROBE}() {
      const out = { t: __capT, entities: null, hud: null, bodies: null };
      if (window.__mojCtrl) {
        out.entities = {};
        for (const e of window.__mojCtrl.world.entities) {
          out.entities[e.id] = {
            pos: e.transform.pos.slice(), heading: e.transform.heading, pitch: e.transform.pitch || 0,
            vel: (e.vel || []).slice(), moving: !!e.moving, locomotion: e.locomotion || null, gaitPhase: e.gaitPhase || 0,
          };
        }
      }
      if (typeof __busState !== 'undefined' && __busState && __busState.vars) out.hud = JSON.parse(JSON.stringify(__busState.vars));
      if (window.__mojSim) out.bodies = window.__mojSim.state.bodies.map((b) => ({ id: b.id, position: b.position.slice(), velocity: (b.velocity || []).slice() }));
      // game channel outcome (game-metacontext.plan.md, G4): a level's __mojGame bridge lands its
      // ONE outcome envelope here; surfacing it in the probe makes a traversal a COMPLETABILITY
      // audit, the walkability audit's generalization. ended flips when the level calls end()
      // (goal bus mapping, or the level's own logic); result is 'success' on a beaten level.
      if (window.__mojGame) {
        const env = window.__mojGame.envelope;
        out.game = {
          levelRef: (window.__mojGame.contract && window.__mojGame.contract.levelRef) || null,
          ended: !!env,
          result: env ? env.result : null,
          events: env ? env.events.length : 0,
        };
      }
      return out;
    },
    // WAYPOINT COMPILER (renderer-convergence step 3): compile "walk to [x,y]" into the tick
    // script Phase-3 traversals replay. Greedy closed-loop steering against the LIVE rule —
    // each tick reads the entity's real heading/position, aims, steps, records the input. The
    // returned ticks ARE the recipe (replaying them from a fresh load reproduces this run
    // byte-for-byte), so every Phase-3 guarantee holds by construction. NOTE: compiling STEPS
    // the live world — replay/record on a fresh page load. No pathfinding in v1: pure seek +
    // the rule's own wall slide; a blocked target returns { stuck: true } instead of looping.
    // Deterministic: sign auto-calibration (rules disagree on turn sign) keys off the first
    // turning tick's measured response, never a random probe.
    ${CAPTURE_COMPILE_WALK_TO}(spec) {
      spec = spec || {};
      if (!window.__mojCtrl) return { ticks: [], arrived: false, stuck: true, reason: 'no controllable world' };
      const world = window.__mojCtrl.world;
      const ent = spec.id ? world.entities.find((x) => x.id === spec.id)
        : world.entities.find((x) => x.rule && (x.rule.type === 'walk' || x.rule.type === 'platform'));
      const tgt = spec.target;
      if (!ent || !Array.isArray(tgt) || tgt.length < 2) return { ticks: [], arrived: false, stuck: true, reason: 'no entity/target' };
      const dt = Number.isFinite(spec.dt) && spec.dt > 0 ? spec.dt : 1 / 24;
      const maxTicks = Number.isFinite(spec.maxTicks) ? spec.maxTicks : 600;
      const arrive = Number.isFinite(spec.arrive) ? spec.arrive : 0.6;
      const wrapA = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
      const ticks = [];
      let sign = 1, signLocked = false;
      let lastPos = ent.transform.pos.slice(), sinceMoved = 0;
      for (let k = 0; k < maxTicks; k++) {
        const p = ent.transform.pos;
        const dx = tgt[0] - p[0], dy = tgt[1] - p[1];
        // arrival = within radius ON STABLE FOOTING: a platform/walk entity that reaches the
        // XY while falling (walked off the world / unclimbable target) has NOT arrived — the
        // rules have no lateral wall collision, so footing is what "reachable" means here.
        if (Math.hypot(dx, dy) < arrive && ent.grounded !== false) return { ticks, arrived: true, at: p.slice(), ticksUsed: k };
        const diff = wrapA(Math.atan2(dy, dx) - ent.transform.heading);
        const turn = Math.max(-1, Math.min(1, diff * 2 * sign));
        const forward = Math.abs(diff) > 1.2 ? 0.15 : 1;      // face the target before committing speed
        const h0 = ent.transform.heading;
        const input = { forward, turn };
        this.${CAPTURE_STEP}({ dt, input });
        ticks.push(input);
        if (!signLocked && Math.abs(turn) > 0.05) {
          const dh = wrapA(ent.transform.heading - h0);
          if (Math.abs(dh) > 1e-7) { if (dh * (diff * sign) < 0) sign = -sign; signLocked = true; }
        }
        // stuck: a second of committed forward with no ground progress → report, don't loop
        sinceMoved += 1;
        if (Math.hypot(p[0] - lastPos[0], p[1] - lastPos[1]) > 0.05) { lastPos = p.slice(); sinceMoved = 0; }
        else if (sinceMoved >= Math.round(1 / dt) && forward === 1) {
          return { ticks, arrived: false, stuck: true, at: p.slice(), atTick: k };
        }
      }
      return { ticks, arrived: false, stuck: true, at: ent.transform.pos.slice(), atTick: maxTicks };
    },
  };
} else if (_freeze !== null) {
  controls.update();
  __mojStep(_freeze);
  updateCutaway(); renderer.render(scene, camera);
  controls.addEventListener('change', () => renderer.render(scene, camera));
} else renderer.setAnimationLoop((t) => {
  const dt = walkPrevT ? Math.min((t - walkPrevT) / 1000, 0.05) : 0; walkPrevT = t;
  if (walkOn) stepWalk(dt);
  else {
    if (__ctrlActive) stepControllable(dt);                 // step entities (clock/walk/glide/follow)
    if (!__ctrlOwnsCamera) controls.update();               // OrbitControls unless a camera entity owns the view
  }
  __mojStep(t);
  updateCutaway(); renderer.render(scene, camera);
});
</script>
</body></html>
`;
}

// Pack one frame's faces into a COMPACT payload: 4 quantised corners per face
// (Uint16 over a shared bound) + ONE linear colour per face (Uint8). This exploits
// the figure's flat shading + fixed topology — the naive triangle-soup encoding
// (6 Float32 verts/face, colour duplicated per vertex) is ~5× larger and, at the
// figure's real density (~17k faces), blows a 24-frame loop past 75MB (proven in
// figure-world.spike.test.js). The browser re-expands corners → two tris and
// fans the per-face colour onto all 6 verts. See figure-world.plan.md.
function packFigureFrames(frames) {
  const all = frames.map((fr) => expandSurfaceCards(fr.faces || []).filter((f) => f && f.corners && f.corners.length >= 4));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const ff of all) for (const f of ff) for (const c of f.corners) for (let k = 0; k < 3; k++) {
    if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k];
  }
  if (!Number.isFinite(mn[0])) { mn[0] = mn[1] = mn[2] = 0; mx[0] = mx[1] = mx[2] = 1; }
  const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  const scale = 65000 / ext;                 // Uint16 fixed-point over the shared bound
  // Correspondence probe (renderer-ladder P2 rung 1): the browser may LERP corner positions
  // between adjacent frames, but that is only valid when face index i is the same chip in every
  // frame. FK-posed builders keep that ordering (median inter-frame displacement ≈ 0.01 of figure
  // height — measured on mega-boy); the protoform render pipeline re-orders chips per frame
  // (median ≈ 0.2 — a mid-lerp pose shreds). The worst adjacent-pair MEDIAN displacement of
  // corner 0, relative to figure height, is the gate; the consumer snaps frames when it's high.
  let lerpMedian = 0;
  if (all.length > 1) {
    const figH = (mx[2] - mn[2]) || ext;
    for (let i = 0; i < all.length; i++) {
      const a = all[i], b = all[(i + 1) % all.length];   // wrap: the clip cycles
      const n = Math.min(a.length, b.length);
      if (!n) continue;
      const d = new Float64Array(n);
      for (let f = 0; f < n; f++) {
        const p = a[f].corners[0], q = b[f].corners[0];
        d[f] = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / figH;
      }
      d.sort();
      if (d[n >> 1] > lerpMedian) lerpMedian = d[n >> 1];
    }
  }
  const pos = [], col = [];
  for (const ff of all) {
    const p = new Uint16Array(ff.length * 4 * 3);
    const c = new Uint8Array(ff.length * 3);
    let pi = 0, ci = 0;
    for (const f of ff) {
      for (const corner of f.corners) for (let k = 0; k < 3; k++) p[pi++] = Math.round((corner[k] - mn[k]) * scale);
      const [lr, lg, lb] = faceColorLinear(f);
      c[ci++] = Math.round(lr * 255); c[ci++] = Math.round(lg * 255); c[ci++] = Math.round(lb * 255);
    }
    pos.push(b64(p)); col.push(b64(c));
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = 0.5 * Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  return { pos, col, origin: mn, invScale: 1 / scale, center, radius, lerpMedian };
}

// Gate for the in-page frame-pair lerp: FK-posed clips measure ~0.01, re-ordered protoform bakes
// ~0.2 — an order of magnitude apart, so the cut sits comfortably between them.
const FIG_LERP_MEDIAN_MAX = 0.05;
