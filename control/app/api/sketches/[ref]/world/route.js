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
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';

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

    // The kind → assemble*Scene dispatch lives in lib/graph/world-scene.js so the live
    // World and the downloadable .glb export resolve identical geometry. `payload` is
    // null for any kind with no traversable form.
    // ?view=exterior renders the roofed, on-the-ground massing (basement hidden) as a
    // companion to the default cutaway doll-house. Threaded into the per-kind assembler.
    const view = request.nextUrl.searchParams.get('view') || undefined;
    // ?render=raymarch selects a per-pixel raymarch backend where a kind supports it (painted-landscape).
    const render = request.nextUrl.searchParams.get('render') || undefined;
    const { payload, kind } = await resolveWorldScene(sketch, { view, render });

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
    // ?decollide=0 disables the coplanar depth-stagger (z-fight de-collision) for A/B verification.
    // ON by default for every World; this is purely a debug/compare affordance like ?wire.
    const decollide = !['0', 'false'].includes(request.nextUrl.searchParams.get('decollide'));
    // ?download=1 bakes the three.js runtime itself into data: URL modules (see
    // emit-util.js inlineImportmap) instead of pointing at this server's /vendor/three,
    // so the saved file is a genuinely portable, open-anywhere page — the live iframe
    // keeps using the small server-served importmap.
    const download = ['1', 'true'].includes(request.nextUrl.searchParams.get('download'));
    const html = emitThreeWorld({ ...payload, wireframe, walk, decollide, inline: download });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': download ? `attachment; filename="${htmlFilename(sketch, ref)}"` : 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to render sketch world' },
      { status: 500 },
    );
  }
}
