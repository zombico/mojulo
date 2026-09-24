/**
 * GET /api/sketches/[ref]/world — serve a stored sketch as a live, TRAVERSABLE
 * three.js (WebGL) World (the third backend alongside /svg and /scene).
 *
 *   • /svg   — server-rasterized still (the "looked at" Scene tier)
 *   • /scene — preserve-3d HTML, preset camera shots ("worlds-lite")
 *   • /world — three.js canvas, free orbit/zoom/pan ("moved through")
 *
 * Like /scene, the stored manifest is a tiny RECIPE; the full world geometry is
 * regenerated deterministically here via the shared `assemble*Scene` seam, so
 * nothing heavy is ever stored. World-eligible kinds (cities, hubs) funnel their
 * baked faces through `emitThreeWorld`; everything else points back at /scene or
 * /svg, which can render it as a still.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { etagFor, pickFlags, renderCacheKey } from '@/lib/graph/sketch/render-etag';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { resolveCityInsets } from '@/lib/graph/worlds/city-insets';
import { cityStreamPayload, cityStreamRecipe, streamDropped, streamStandDown } from '@/lib/graph/city/city-tiles';

// ── server-side WORLD-HTML cache ──────────────────────────────────────────────
// A /world response is a PURE function of (manifest recipe, query flags): the same
// inputs bake byte-identical HTML (deterministic recipes, seeded dice). But that bake
// is heavy — a suit-roster level takes tens of seconds to resolve + emit + serialize
// a tens-of-MB page, EVERY request. So memoize the finished HTML keyed on a hash of the
// manifest JSON + the flags that change the output + the code version (below). Process-
// scoped (a plain Map): it survives across requests but is dropped on server restart /
// dev HMR, so a renderer code change invalidates it for free. `?nocache=1` forces a fresh
// bake. Single-user, self-hosted (the golden rule) — no per-tenant keying, no shared
// store. LRU-evicted under a byte budget so a fleet of big worlds can't grow the heap
// unbounded.
const WORLD_CACHE = new Map();          // key → { html, bytes }
let WORLD_CACHE_BYTES = 0;
// ~1GB of baked pages held at most (was 512MB — the arena's 35 mode×map levels evicted each other
// three pages deep). Env-tunable for small hosts: MOJULO_WORLD_CACHE_MB=256 etc. The browser-side
// ETag tier (below) is the real capacity fix; this budget just keeps warm levels server-resident.
const WORLD_CACHE_BUDGET = (Number(process.env.MOJULO_WORLD_CACHE_MB) > 0
  ? Number(process.env.MOJULO_WORLD_CACHE_MB) : 1024) * 1024 * 1024;

// The browser-side ETag tier (below) OUTLIVES a server restart, so unlike the Map it does
// not invalidate for free when the emitter changes: without a code salt, an upgrade that
// changed the world emitter still matched the browser's If-None-Match and got a 304 over
// stale HTML. The key therefore folds in this constant AND the package version
// (render-etag.js). Bump WORLD_CACHE_VERSION when the emitter's output changes inside a
// release and browsers should drop the pages they hold; a release bump does it on its own.
const WORLD_CACHE_VERSION = 'v1';
// `stream` (world streaming, fractal-city): a streamed page and the whole page are different bakes.
const WORLD_FLAGS = ['view', 'render', 'wire', 'walk', 'spin', 'decollide', 'download', 'hud', 'livery', 'xr', 'stream'];

function worldCacheKey(ref, manifest, search) {
  return renderCacheKey({ ref, manifest, flags: pickFlags(search, WORLD_FLAGS), version: WORLD_CACHE_VERSION });
}
function worldCacheGet(key) {
  const hit = WORLD_CACHE.get(key);
  if (!hit) return null;
  WORLD_CACHE.delete(key); WORLD_CACHE.set(key, hit);   // LRU touch (re-insert = most-recent)
  return hit.html;
}
function worldCacheSet(key, html) {
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > WORLD_CACHE_BUDGET) return;               // a single page bigger than the whole budget → don't cache
  const prev = WORLD_CACHE.get(key);
  if (prev) { WORLD_CACHE_BYTES -= prev.bytes; WORLD_CACHE.delete(key); }
  WORLD_CACHE.set(key, { html, bytes }); WORLD_CACHE_BYTES += bytes;
  while (WORLD_CACHE_BYTES > WORLD_CACHE_BUDGET && WORLD_CACHE.size > 1) {
    const oldest = WORLD_CACHE.keys().next().value;     // Map preserves insertion order → oldest first
    WORLD_CACHE_BYTES -= WORLD_CACHE.get(oldest).bytes; WORLD_CACHE.delete(oldest);
  }
}

// A filesystem-safe download name derived from the sketch title (falls back to the ref).
function htmlFilename(sketch, ref) {
  const base = (sketch.title || sketch.manifest?.title || ref || 'world')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'world'}.html`;
}

function escapedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

// the shared /world HTML response (cache HIT and MISS build the identical response, only the
// X-Mojulo-World-Cache header differs). The BROWSER cache is a second tier over the server one:
// the response carries an ETag derived from the same (manifest, flags, code version) hash the
// server cache keys on, under `no-cache` (store, but REVALIDATE every use — a re-minted recipe or
// an upgrade changes the hash, so staleness is impossible). A matching If-None-Match short-circuits to 304 in GET before any
// resolve work runs, so a replayed level skips the bake AND the tens-of-MB transfer/parse even
// across server restarts. `?nocache=1` responses stay `no-store` (cacheKey null ⇒ no etag).
function worldHtmlResponse(html, sketch, ref, download, cacheState, etag = null, extra = null) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': download ? `attachment; filename="${htmlFilename(sketch, ref)}"` : 'inline',
      'Cache-Control': etag ? 'no-cache' : 'no-store',
      ...(etag ? { ETag: etag } : {}),
      'X-Mojulo-World-Cache': cacheState,
      ...(extra || {}),
    },
  });
}

// ?stream=1 (world streaming): the fractal city's streamed page, or the reason it stood down. Pure
// over the manifest + flags, so the cached and fresh responses carry the same header. Returns
// { on, header } — header null when the flag was not asked for (the response is unchanged).
function streamDecision(sketch, search) {
  if (!['1', 'true'].includes(search.get('stream'))) return { on: false, header: null };
  const download = ['1', 'true'].includes(search.get('download'));
  const reason = streamStandDown(sketch.manifest, { download });
  if (reason) return { on: false, header: { 'X-Mojulo-World-Stream': `stood-down: ${reason}` } };
  const dropped = streamDropped(sketch.manifest);
  return { on: true, header: { 'X-Mojulo-World-Stream': dropped.length ? `on; dropped: ${dropped.join(', ')}` : 'on' } };
}

function glbViewerHtml({ ref, title }) {
  const modelUrl = `/api/sketches/${encodeURIComponent(ref)}/model.glb`;
  const safeTitle = title || ref;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #f7f5ef; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "/vendor/three/three.module.min.js",
        "three/addons/": "/vendor/three/addons/"
      }
    }
  </script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const modelUrl = ${escapedJson(modelUrl)};
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf7f5ef, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd4cab8, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(3, 6, 4);
scene.add(key);

function parseGlb(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file');
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).trim());
    } else if (type === 0x004e4942) {
      bin = buffer.slice(start, start + length);
    }
    offset = start + length;
  }
  return { json, bin };
}

function components(type) {
  return type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : 0;
}

function accessorArray(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  if (accessor.componentType !== 5126) throw new Error('Only float attributes are supported');
  const comps = components(accessor.type);
  const source = new DataView(bin, (view.byteOffset || 0) + (accessor.byteOffset || 0), view.byteLength);
  const stride = view.byteStride || comps * 4;
  const out = new Float32Array(accessor.count * comps);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < comps; c++) out[i * comps + c] = source.getFloat32(i * stride + c * 4, true);
  }
  return { array: out, comps, count: accessor.count };
}

const { json, bin } = parseGlb(await (await fetch(modelUrl, { cache: 'no-store' })).arrayBuffer());
const group = new THREE.Group();
group.rotation.x = -Math.PI / 2;
scene.add(group);

for (const mesh of json.meshes || []) {
  for (const primitive of mesh.primitives || []) {
    const attrs = primitive.attributes || {};
    if (attrs.POSITION == null) continue;
    const pos = accessorArray(json, bin, attrs.POSITION);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos.array, 3));
    if (attrs.COLOR_0 != null) {
      const color = accessorArray(json, bin, attrs.COLOR_0);
      geometry.setAttribute('color', new THREE.BufferAttribute(color.array, color.comps));
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ vertexColors: attrs.COLOR_0 != null, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(geometry, material));
  }
}

const box = new THREE.Box3().setFromObject(group);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3()).length() || 5;
controls.target.copy(center);
camera.position.copy(center).add(new THREE.Vector3(size * 0.35, size * 0.2, size * 0.9));
camera.near = Math.max(0.01, size / 1000);
camera.far = size * 10;
camera.updateProjectionMatrix();
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
</script>
</body>
</html>`;
}

export async function GET(request, { params }) {
  try {
    const { ref } = await params;
    const sketch = SketchRepository.getByRef(ref);
    if (!sketch) {
      return NextResponse.json({ error: `Sketch '${ref}' not found` }, { status: 404 });
    }
    if (!sketch.manifest) {
      return NextResponse.json({ error: `Sketch '${ref}' has no manifest` }, { status: 400 });
    }

    const coloredOverridePath = path.join(process.cwd(), 'data', 'exports', `${ref}_vertex_colored.glb`);
    if (fs.existsSync(coloredOverridePath)) {
      const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
      return new Response(glbViewerHtml({ ref, title: sketch.title || sketch.manifest?.title }), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': download ? `attachment; filename="${htmlFilename(sketch, ref)}"` : 'inline',
          'Cache-Control': 'no-store',
          'X-Mojulo-World-Override': 'vertex-colored-glb',
        },
      });
    }

    // Served-HTML cache (see WORLD_CACHE): a repeat load of the same recipe+flags skips the
    // whole resolve → emit → serialize bake. Keyed before any of that work runs, so a hit is
    // near-instant. `?nocache=1` forces a rebake.
    const search = request.nextUrl.searchParams;
    const cacheKey = ['1', 'true'].includes(search.get('nocache'))
      ? null : worldCacheKey(ref, sketch.manifest, search);
    const etag = cacheKey ? etagFor('w', cacheKey) : null;
    if (etag && request.headers.get('if-none-match') === etag) {
      // browser already holds THIS bake (same manifest + flags) — revalidate without resolving.
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-cache', 'X-Mojulo-World-Cache': 'BROWSER' } });
    }
    const streamed = streamDecision(sketch, search);
    if (cacheKey) {
      const cached = worldCacheGet(cacheKey);
      if (cached) return worldHtmlResponse(cached, sketch, ref, ['1', 'true'].includes(search.get('download')), 'HIT', etag, streamed.header);
    }

    // The kind → assemble*Scene dispatch lives in lib/graph/world-scene.js so the live
    // World and the downloadable .glb export resolve identical geometry. `payload` is
    // null for any kind with no traversable form.
    // ?view=exterior renders the roofed, on-the-ground massing (basement hidden) as a
    // companion to the default cutaway doll-house. Threaded into the per-kind assembler.
    const view = request.nextUrl.searchParams.get('view') || undefined;
    // ?render=raymarch selects a per-pixel raymarch backend where a kind supports it (painted-landscape).
    const render = request.nextUrl.searchParams.get('render') || undefined;
    // ?livery=<shelf name> repaints a z-series assembler unit onto another livery (hangar swatches).
    const livery = request.nextUrl.searchParams.get('livery') || undefined;
    // ?stream=1 on a fractal city that can stream: the horizon page (city-tiles.js) — nothing at
    // full fidelity is inlined; the page fetches it from the tile route. walk / xr ride the manifest
    // exactly as resolveWorldScene carries them.
    let payload, kind;
    if (streamed.on) {
      kind = 'fractal-city';
      payload = cityStreamPayload(cityStreamRecipe(sketch.manifest, resolveCityInsets(sketch.manifest)), {
        url: `/api/sketches/${encodeURIComponent(ref)}/world/tile`,
        title: sketch.title || sketch.manifest.title || 'mojulo city',
      });
      if (sketch.manifest.walk) payload.walk = sketch.manifest.walk;
      if (sketch.manifest.xr) payload.xr = sketch.manifest.xr;
    } else {
      ({ payload, kind } = await resolveWorldScene(sketch, { view, render, livery }));
    }

    if (!payload) {
      return NextResponse.json({
        eligible: false,
        reason:
          'Traversable Worlds currently render box-world kinds (fractal-city, transportation-hub), '
          + 'the open-fronted subway-station interior, the workbench object study, painted-landscape '
          + 'terrain, the planetary body, and furnished two-point rooms. Other forms render as '
          + 'preset-shot scenes or baked stills.',
        scene: `/api/sketches/${ref}/scene`,
        svg: `/api/sketches/${ref}/svg`,
      }, { status: 422 });
    }

    // ?wire=1 opens the World straight in construction-wireframe mode (deep-link / baked still);
    // the HUD toggle is always present regardless. A live HUD-only affordance for every World.
    const wireframe = ['1', 'true'].includes(request.nextUrl.searchParams.get('wire'));
    // First-person free-traverse (WASD + Space/Shift) — ON by default for the SPATIAL ("moved
    // through") kinds, where walking the interior/streets is the point. The object-study kinds
    // (workbench, vehicle-instance) and the orbit-only planetary stay free-orbit — walking a
    // celestial sphere or around a single specimen is nonsense. A payload may carry its own
    // `walk` (tuned spawn/speed) to override; ?walk=0 forces orbit, ?walk=1 force-enables anywhere.
    const walkParam = request.nextUrl.searchParams.get('walk');
    // exterior view is an outside massing read → orbit, not walk (unless ?walk=1 forces it).
    const exteriorView = (view ?? sketch.manifest?.view) === 'exterior';
    const walk = ['0', 'false'].includes(walkParam) ? false
      : (['1', 'true'].includes(walkParam) || (!exteriorView && (payload.walk || WALK_KINDS.has(kind))));
    // ?spin=1 — auto-rotate the orbit camera (the showcase turntable read, e.g. a suit preview
    // panel). Purely presentational; the first user grab stops the spin. Orbit scenes only —
    // a camera-entity world ignores it (the entity owns the view).
    const spin = ['1', 'true'].includes(request.nextUrl.searchParams.get('spin'));
    // ?decollide=0 disables the coplanar depth-stagger (z-fight de-collision) for A/B verification.
    // ON by default for every World; this is purely a debug/compare affordance like ?wire.
    const decollide = !['0', 'false'].includes(request.nextUrl.searchParams.get('decollide'));
    // ?hud=0 hides the top-left dev-chrome button strip (view cams, wireframe, fly/walk,
    // reverse view, AI attack). The game shell requests its level/menu iframes with it so
    // play screens present clean; keyboard twins keep working. ON by default everywhere else.
    const hud = !['0', 'false'].includes(request.nextUrl.searchParams.get('hud'));
    // ?download=1 bakes the three.js runtime itself into data: URL modules (see
    // emit-util.js inlineImportmap) instead of pointing at this server's /vendor/three,
    // so the saved file is a genuinely portable, open-anywhere page — the live iframe
    // keeps using the small server-served importmap.
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    // ?xr=1 adds the WebXR entry (a headset walks the world); ?xr=0 drops a manifest's own `xr`.
    // Off unless the manifest or the flag asks — the page stays byte-identical otherwise.
    const xrParam = request.nextUrl.searchParams.get('xr');
    const xr = ['0', 'false'].includes(xrParam) ? null : (['1', 'true'].includes(xrParam) ? (payload.xr || true) : (payload.xr || null));
    const html = emitThreeWorld({ ...payload, wireframe, walk, spin, decollide, hud, inline: download, xr });
    if (cacheKey) worldCacheSet(cacheKey, html);
    return worldHtmlResponse(html, sketch, ref, download, 'MISS', etag, streamed.header);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to render sketch world' },
      { status: 500 },
    );
  }
}
