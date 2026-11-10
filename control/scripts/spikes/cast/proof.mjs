// THE CAST MATERIAL'S PROOF (scene/channels/cast-rig.js): a test body (a capsule torso, a head, legs) drawn under the
// cast rig on real World pages, over form and over paint, lit and cel. The machine gate: the page's lights before and
// after the kit takes its key (a form page's untouched; a painted page's one key), the share of the frame that moved
// with the body in it, and its box. The look is the operator's.
//
//   node scripts/spikes/cast/proof.mjs <out dir> [island-form,island-paint,jungle-form,island-form-cel]
import fs from 'node:fs'; import path from 'node:path'; import { register } from 'node:module'; import { pathToFileURL } from 'node:url';
const C = process.cwd(); register(pathToFileURL(path.join(C, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${C}/`).href);
const { resolveWorldScene } = await import(`${C}/lib/graph/worlds/world-scene.js`);
const { emitThreeWorld } = await import(`${C}/lib/graph/scene/scene-three.js`);
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import(`${C}/lib/graph/scene/chromium.js`);
const { readGeocube } = await import(`${C}/lib/graph/era/geocube.js`);
const { castRig } = await import(`${C}/lib/graph/color-theorist/cast-rig.js`);
const { castRigInput, castKitSource } = await import(`${C}/lib/graph/scene/channels/cast-rig.js`);
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const CASES = [
  { name: 'island-form', era: 'gen-7', cube: 'island-noon', register: 'western', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 3 } },
  { name: 'island-paint', era: 'gen-6', cube: 'island-noon', register: 'western', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 3 } },
  { name: 'jungle-form', era: 'gen-7', cube: 'jungle-haze', register: 'western', manifest: { kind: 'geocube', cube: 'jungle-haze', show: 'path', seed: 2 } },
  { name: 'island-form-cel', era: 'gen-7', cube: 'island-noon', register: 'anime', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 3 } },
].filter((c) => !process.argv[3] || process.argv[3].split(',').includes(c.name));
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const T of CASES) {
  const { payload } = await resolveWorldScene({ ref: 'x', title: 'x', manifest: T.manifest }, { era: T.era, live: true });
  const rig = castRig(readGeocube(T.cube), { register: T.register }), I = castRigInput(rig);
  let html = emitThreeWorld({ ...payload, viewBox: { width: 960, height: 600 }, inline: true, capture: true, hud: false, walk: false });
  html = html.replace(/(const renderer = new THREE\.WebGLRenderer\(\{ canvas, antialias: (?:true|false), logarithmicDepthBuffer[^;]*;)/, `$1 window.__mojRenderer = renderer; window.__THREE = THREE; window.__castKit = ${castKitSource().replace(/\$/g, '$$$$')}; setTimeout(() => { window.__mojScene = scene; }, 0);`);
  const page = await browser.newPage(), errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.setViewport({ width: 960, height: 600 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready && window.__mojScene, { timeout: 240000 });
  const F = payload.cameras[payload.cameras.length - 1].worldFraming, spawn = payload.walk && payload.walk.spawn ? payload.walk.spawn : null;
  const res = await page.evaluate(async ({ I, surface, at0, toLight }) => {
    const THREE = window.__THREE, scene = window.__mojScene, kit = window.__castKit, R = window.__mojRenderer;
    // the ground under the spot: a ray down through the page's own meshes
    const ray = new THREE.Raycaster(new THREE.Vector3(at0[0], at0[1], 500), new THREE.Vector3(0, 0, -1)), solid = []; scene.traverse((o) => { if (o.isMesh && o.visible && !o.isInstancedMesh && o.geometry && o.geometry.getAttribute('position') && o.geometry.getAttribute('position').count > 30 && o.material && o.material.side !== THREE.BackSide) solid.push(o); }); const hits = ray.intersectObjects(solid, false).filter((h) => h.point.z > -5 && h.point.z < 200);
    const z = hits.length ? hits[0].point.z : at0[2] || 0, at = [at0[0], at0[1], z];
    const U = kit.uniforms(I), mat = (o) => kit.material(I, Object.assign({ surface, uniforms: U }, o));
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 8, 24), mat({ color: 0xb23a2a })); torso.rotation.x = Math.PI / 2; torso.position.z = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mat({ color: 0xd9a27e })); head.position.z = 1.85;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 8, 16), mat({ color: 0x1b1b1f })); legs.rotation.x = Math.PI / 2; legs.position.z = 0.38;
    for (const m of [torso, head, legs]) { m.castShadow = true; m.receiveShadow = true; body.add(m); }
    body.position.set(at[0], at[1], at[2]); scene.add(body);
    const before = []; scene.traverse((o) => { if (o.isLight) before.push([o.type, +o.intensity.toFixed(3)]); });
    const key = kit.key(scene, I, { sun: window.__formSun });
    const after = []; scene.traverse((o) => { if (o.isLight) after.push([o.type, +o.intensity.toFixed(3)]); });
    // the eye: square to the key's bearing, so the key side and the shade side both show
    const side = [-toLight[1], toLight[0]], n = Math.hypot(side[0], side[1]) || 1, cam = { pos: [at[0] + (side[0] / n) * 5.5, at[1] + (side[1] / n) * 5.5, at[2] + 1.5], target: [at[0], at[1], at[2] + 1.0], vfov: 40 };
    const grab = () => { const cv = document.querySelector('canvas'), c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const g = c2.getContext('2d'); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c2.width, c2.height); };
    const shot = async () => { if (window.__formSun) window.__formSun.shadow.needsUpdate = true; window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 500)); if (window.__formSun) window.__formSun.shadow.needsUpdate = true; window.__mojCapture.frame(cam); return grab(); };
    body.visible = false; const A = await shot();
    body.visible = true; const B = await shot();
    // where the body is: its box on the screen, a little wide
    let changed = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; const W = A.width, H = A.height, d = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const q = i * 4, dd = Math.abs(A.data[q] - B.data[q]) + Math.abs(A.data[q + 1] - B.data[q + 1]) + Math.abs(A.data[q + 2] - B.data[q + 2]); if (dd > 12) { d[i] = 1; changed++; const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    return { at, ground: hits.length ? hits[0].object.userData.g || hits[0].object.type : null, before, after, keyIntensity: +key.intensity.toFixed(3), changed: +(changed / (W * H)).toFixed(4), box: [x0, y0, x1, y1], size: [W, H], tone: R.toneMapping };
  }, { I, surface: T.era === 'gen-7' ? 'form' : 'paint', at0: spawn || F.lookAt, toLight: rig.key.toLight });
  await (await page.$('#wrap') || await page.$('canvas')).screenshot({ path: path.join(out, `${T.name}.png`) });
  console.log(T.name, JSON.stringify(res), 'rig', JSON.stringify({ keyGain: rig.key.gain, fill: rig.hemi.gain, form: rig.reads[0].ratio }), errors.slice(0, 2).join(' | '));
  await page.close();
}
await browser.close();
