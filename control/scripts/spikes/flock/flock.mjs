// THE FLOCK SPIKE: can a realistic crown's puffs (form/flora-read.js REALISTIC, drawn by channels/form-flora.js) be drawn
// as a miniature maker's clump foliage, a porous sponge the light passes through, at little cost and with its shadow
// optional? It emits a gen-7 path page with `crowns: 'realistic'`, writes a twin whose puffs are the sponge
// (sponge-glsl.mjs: marched in the colour pass, the sun through its thin skin as transmission, the same field in the
// shadow pass; `leaves`, its skin carrying its species' own leaves at their true size), and shoots each from the same
// cameras, side by side. Nothing in lib/ changes: the twin is a text patch
// of the emitted page, so it breaks (loudly, on an assert) the day form-flora.js's leaf material changes shape.
//
//   node scripts/spikes/flock/flock.mjs [--out <dir>] [--look sponge,leaves] [--cube island-noon] [--shots shots.json] [--solid-shadow] [--reuse]
//
// --reuse keeps an emitted page in <dir> (the emit takes about 40 s). Cameras default to the island-noon path's first
// oak; give others as [{ name, pos, target, vfov }].
import fs from 'node:fs';
import path from 'node:path';
import { register, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spongeGlsl } from './sponge-glsl.mjs';
import { leafGlsl, LEAF } from './sponge-glsl.mjs';
import { leafShape, LEAF_SHAPES } from '../../../lib/graph/vegetation/twigs.js';
import { ARCHITECTURES } from '../../../lib/graph/vegetation/grow.js';
import { SPECIES } from '../../../lib/graph/vegetation/species.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'flock-out')), cube = arg('--cube', 'island-noon');
const shadowLook = !process.argv.includes('--solid-shadow'), looks = arg('--look', 'sponge,leaves').split(',').filter(Boolean);
const SHOTS = arg('--shots') ? JSON.parse(fs.readFileSync(arg('--shots'), 'utf8')) : [
  { name: 'oak-mid', pos: [42.1, 4.7, 2.5], target: [42.1, 24.7, 7], vfov: 50 },
  { name: 'oak-under', pos: [40.5, 21.5, 1.7], target: [43, 26, 10], vfov: 70 },
  { name: 'oak-backlit', pos: [45.5, 28, 1.7], target: [40, 22.5, 12], vfov: 70 },
  { name: 'oak-close', pos: [36, 18, 7], target: [40.5, 22.5, 9], vfov: 60 },
  { name: 'shadow-down', pos: [47, 29.5, 40], target: [47, 29.6, 0.8], vfov: 40 },
];
fs.mkdirSync(out, { recursive: true });

// 1. the page as it is (capture on, and a hook to draw the sun's map again from a shot's camera)
const basePage = path.join(out, 'base.html');
if (!(process.argv.includes('--reuse') && fs.existsSync(basePage))) {
  const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
  const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
  const t0 = Date.now();
  const { payload } = await resolveWorldScene({ ref: 'flock', title: 'flock', manifest: { kind: 'geocube', cube, show: 'path', crowns: 'realistic' } }, { live: true, era: 'gen-7' });
  let html = emitThreeWorld({ ...payload, inline: true });
  const once = (s, a, b) => { if (s.split(a).length !== 2) throw new Error(`flock: the page no longer has exactly one ${JSON.stringify(a.slice(0, 60))}`); return s.replace(a, b); };
  html = once(html, 'const _capture = false;', 'const _capture = true;');
  html = once(html, '  window.__formReady = true;', '  window.__formReady = true;\n  window.__reshadow = () => { sunLight.shadow.needsUpdate = true; };');
  fs.writeFileSync(basePage, html);
  console.log(`emitted ${basePage} (${(html.length / 1e6).toFixed(1)} MB, ${Date.now() - t0} ms)`);
}

// 2. its twins: the puffs as each look draws them (the shared part: each puff's size as an attribute, the eye and the sun)
const once = (s, a, b) => { if (s.split(a).length !== 2) throw new Error(`flock: the leaf material changed shape (no single ${JSON.stringify(a.slice(0, 70))})`); return s.replace(a, b); };
const jsStr = (g) => g.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/'/g, "\\'");
const VARY = 'varying vec3 vPosT;\\nvarying vec3 vCenT;\\nvarying float vRadT;\\nvarying float vScaleT;\\nvarying vec3 vCamT;\\nvarying vec3 vSunT;\\n';
const VX = '\\n  vPosT = position; vCenT = aSite; vRadT = length( position - aSite ); vScaleT = aPuffS.x; vCamT = ( inverse( modelMatrix * instanceMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz; vSunT = normalize( inverse( mat3( modelMatrix * instanceMatrix ) ) * uSunW );';
// (the sponge's puff, in place of the leaf cells' broken rim: the hit's depth its shade; with `leaves`, a leaf nearer
// than the sponge drawn over it, lit by its face to the sun, and thin)
const SPONGE_FRAG = [
  'if ( vMass > 0.5 ) { vec3 D = normalize( vPosT - vCamT ); float ts; float spHit = spongeMarchT( vPosT, D, vCenT, vRadT, ts );',
  '__LEAVES__',
  ' if ( spHit < 0.0 ) discard; spThin = 1.0 - smoothstep( 0.0, 0.45, spHit ); diffuseColor.rgb *= mix( 1.12, 0.38, smoothstep( 0.0, 0.6, spHit ) ) * mix( 0.85, 1.15, spH( floor( vPosT / 0.2 ) ) ); }'].join('');
const LEAF_FRAG = [
  ` float share = smoothstep( ${LEAF.px[0].toFixed(2)}, ${LEAF.px[1].toFixed(2)}, uLeafL / max( spMpp, 1e-5 ) ), lit, tone, tl = share > 0.0 && uLeafL > 0.0 ? leafMarch( vPosT, D, vCenT, vSunT, share, lit, tone ) : 1e9;`,
  ` if ( tl < 1e8 && ( spHit < 0.0 || tl < ts ) ) { spThin = 1.0; diffuseColor.rgb *= mix( ${LEAF.lit[0].toFixed(2)}, ${LEAF.lit[1].toFixed(2)}, lit ) * mix( ${LEAF.tone[0].toFixed(2)}, ${LEAF.tone[1].toFixed(2)}, tone ); } else {`].join('');
const SPONGE_LIGHT = 'if ( vMass > 0.5 ) { vec3 Ls = normalize( ( viewMatrix * vec4( uSunW, 0.0 ) ).xyz ); float back = pow( max( 0.0, dot( normalize( -vViewPosition ), Ls ) ), 3.0 ); reflectedLight.indirectDiffuse += diffuseColor.rgb * uSunC * back * spThin * 0.9; }';
const LOOKS = {
  // (sponge-glsl.mjs: a porous field marched into each puff)
  sponge: { glsl: spongeGlsl(), frag: SPONGE_FRAG.replace('__LEAVES__', ''), light: SPONGE_LIGHT },
  // (and its skin's leaves, its species' own at their true size)
  leaves: { glsl: spongeGlsl() + leafGlsl(), frag: SPONGE_FRAG.replace('__LEAVES__', LEAF_FRAG) + ' }', light: SPONGE_LIGHT, leaves: true },
};
// (each template's leaf: the grower's length, never the species' stylized scale, and its outline's half-width along the midrib)
const leafOf = (name) => {
  const S = SPECIES[name], A = S && ARCHITECTURES[S.arch], k = S && leafShape(name), sh = k && LEAF_SHAPES[k];
  if (!A || A.needles || !sh) return null;
  return { L: A.leafSize, w: Array.from({ length: LEAF.table }, (_, i) => Math.round(sh.w(i / (LEAF.table - 1)) * 1e4) / 1e4) };
};
function twin(base, look) {
  const L = LOOKS[look]; if (!L) throw new Error(`flock: no look '${look}' (${Object.keys(LOOKS).join(', ')})`);
  const G = jsStr(L.glsl); let s = base;
  // (each puff's size, the site's scale, carried by its vertices)
  s = once(s, 'out = new Float32Array(tv * 3), site = new Float32Array(tv * 3);', 'out = new Float32Array(tv * 3), site = new Float32Array(tv * 3), pscl = new Float32Array(tv * 3);');
  s = once(s, 'site.set([p.x, p.y, p.z], o * 3);', 'site.set([p.x, p.y, p.z], o * 3); pscl[o * 3] = s;');
  s = once(s, "g.setAttribute('aSite', new THREE.BufferAttribute(site, 3));", "g.setAttribute('aSite', new THREE.BufferAttribute(site, 3)); g.setAttribute('aPuffS', new THREE.BufferAttribute(pscl, 3));");
  s = once(s, "for (const k of ['position', 'color', 'aOut', 'aSite'])", "for (const k of ['position', 'color', 'aOut', 'aSite', 'aPuffS'])");
  s = once(s, 'vCell = position + instanceMatrix[3].xyz * 0.37;', `vCell = position + instanceMatrix[3].xyz * 0.37;${VX}`);
  s = once(s, "varying float vMass;\\nvarying vec3 vCell;\\n';\n      const grows", `varying float vMass;\\nvarying vec3 vCell;\\nattribute vec3 aPuffS;\\n${VARY}uniform vec3 uSunW;\\nuniform vec3 uSunC;\\n';\n      const grows`);
  s = once(s, "sh.fragmentShader = 'varying float vMass;\\nvarying vec3 vCell;\\n' + sh.fragmentShader",
    `sh.fragmentShader = 'varying float vMass;\\nvarying vec3 vCell;\\n${VARY}uniform vec3 uSunW;\\nuniform vec3 uSunC;\\n${G}' + sh.fragmentShader.replace('void main() {', 'void main() {\\n  float spThin = 0.0, spMpp = length( fwidth( vPosT ) );')`);
  // (the look's puff, in place of the leaf cells' broken rim)
  s = once(s, "'#include <normal_fragment_begin>\\n  normal *= faceDirection;' + MASS_CELLS)", `'#include <normal_fragment_begin>\\n  normal *= faceDirection;' + '${L.frag}')`);
  s = once(s, ".replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;');\n      };\n      m.customProgramCacheKey = () => 'form-leaf'",
    `.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;\\n  ${L.light}');\n      };\n      m.customProgramCacheKey = () => 'form-${look}-leaf'`);
  s = once(s, 'const U = { uEye: eye, uDetail: { value: new THREE.Vector2(detail[0], detail[1]) } };',
    `const U = { uEye: eye, uDetail: { value: new THREE.Vector2(detail[0], detail[1]) }, uSunW: { value: sunLight.position.clone().sub(sunLight.target.position).normalize() }, uSunC: { value: sunLight.color.clone().multiplyScalar(sunLight.intensity) }, uLeafL: { value: 0 }, uLeafW: { value: new Array(${LEAF.table}).fill(0) } }; m.userData.U = U;`);
  // (each template's leaf, on its crown's material)
  if (L.leaves) {
    const LEAVES = `
    { const LV = ${JSON.stringify(Object.fromEntries(['oak', 'beech', 'maple', 'cherry', 'birch', 'poplar', 'acacia', 'schefflera', 'willow'].map((n) => [n, leafOf(n)]).filter(([, v]) => v)))}; window.__flockLeaves = [];
      for (const x of T) { const lv = LV[x.t.name]; if (!lv || !x.parts || !x.parts.crown) continue; const U = x.parts.crown.im.material.userData.U; U.uLeafL.value = lv.L; U.uLeafW.value = lv.w; window.__flockLeaves.push({ name: x.t.name, length: lv.L }); } }
`;
    s = once(s, '    // THE FAR TREES (FLORA_FAR)', `${LEAVES}    // THE FAR TREES (FLORA_FAR)`);
  }
  // (the shadow: the same sponge in the crown's depth pass, or the crown's shadow as it was; the leaves cast none of their own)
  if (shadowLook) {
    const DEPTH = `
    for (const x of T) { if (!x.parts || !x.parts.crown) continue;
      const LU = x.parts.crown.im.material.userData.U, dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      dm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uSunW: LU.uSunW });
        sh.vertexShader = 'attribute vec3 aOut;\\nattribute vec3 aSite;\\nattribute vec3 aPuffS;\\nuniform vec3 uSunW;\\nvarying float vMass;\\n${VARY}' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vMass = step( 1.5, length( aOut ) );${VX}');
        sh.fragmentShader = 'varying float vMass;\\n${VARY}${jsStr(spongeGlsl())}' + sh.fragmentShader.replace('void main() {', 'void main() {\\n  if ( vMass > 0.5 && spongeMarch( vPosT, normalize( vPosT - vCamT ), vCenT, vRadT ) < 0.0 ) discard;');
      };
      dm.customProgramCacheKey = () => 'form-${look}-depth';
      x.parts.crown.im.customDepthMaterial = dm;
    }
`;
    s = once(s, '    // THE FAR TREES (FLORA_FAR)', `${DEPTH}    // THE FAR TREES (FLORA_FAR)`);
  }
  return s;
}
const base = fs.readFileSync(basePage, 'utf8');
const pages = [['base', basePage], ...looks.map((look) => { const f = path.join(out, `${look}.html`); fs.writeFileSync(f, twin(base, look)); return [look, f]; })];

// 3. both from the same cameras
const { chromium } = createRequire(import.meta.url)('playwright');
const { CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const browser = await chromium.launch({ args: [...new Set([...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS])] });
for (const [name, file] of pages) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') console.log(name, 'console', m.text().slice(0, 400)); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, null, { timeout: 300000 });
  for (const shot of SHOTS) {
    await page.evaluate((c) => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud', 'header', '#hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; window.__mojCapture.frame(c); window.__reshadow(); window.__mojCapture.frame(c); }, shot);
    await page.screenshot({ path: path.join(out, `${name}-${shot.name}.png`) });
  }
  await page.close();
}
await browser.close();
// (side by side: a page that shows them, as it is on the left and the sponge on the right)
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Flock spike</title><style>body{background:#15171c;color:#e8eaee;font:13px system-ui;margin:16px}figure{margin:0 0 20px}img{width:calc(50% - 6px);margin-right:6px}</style>
<p>The realistic crown as it is, then ${looks.join(', ')} (scripts/spikes/flock).</p>
${SHOTS.map((c) => `<figure><figcaption>${c.name}</figcaption>${pages.map(([n]) => `<img src="${n}-${c.name}.png" title="${n}" style="width:calc(${(100 / pages.length).toFixed(2)}% - 6px)">`).join('')}</figure>`).join('\n')}`);
console.log(`shots → ${out}/index.html`);
