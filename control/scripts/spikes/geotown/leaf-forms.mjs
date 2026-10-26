#!/usr/bin/env node
/**
 * SPIKE: a gritty tree's crown as leaf branches (era/leaf-forms.js) — one meadow-sized tree in each form, against
 * today's chipped crown (era/leaf-chips.js): close with the sun in front and to the side, at mid distance, and far as
 * its cores alone, each with its face count.
 *
 *   cd control && node scripts/spikes/geotown/leaf-forms.mjs [name] [form …]
 *     → ../lite-template/integration/1021/spike-output/geotown/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
await import('../../../lib/graph/era/stage.js');
const { ISEKAI_STYLES, hollowed } = await import('../../../lib/graph/era/isekai.js');
const { leafChips, chipCore } = await import('../../../lib/graph/era/leaf-chips.js');
const { LEAF_FORMS, LEAF_FORM_IDS, leafForm, formCore, formChips } = await import('../../../lib/graph/era/leaf-forms.js');
const { tube } = await import('../../../lib/graph/era/nature.js');
const { hash3 } = await import('../../../lib/graph/era/dirt.js');
const { makeSunShadow } = await import('../../../lib/graph/era/sun.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'leaf-forms', ...forms] = process.argv.slice(2);
const FORMS = forms.length ? forms : LEAF_FORM_IDS;
const st = ISEKAI_STYLES['isekai-meadow'], C = st.trees.crown, ramp = st.palette.foliage, mix = (a, b, t) => a + (b - a) * t;
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`, bark = hex(st.palette.bark[1]);
const h = 9, Rc = C.radius * h, c = [0, 0, C.height * h], crown = { c, Rc, squash: C.squash };
const wood = (pts, radii, sides = 6) => { const o = []; tube(o, pts, radii, sides, null, 'isekai:wood'); return o.map((f) => ({ ...f, fill: bark })); };
const ground = { corners: [[-60, -60, -0.01], [60, -60, -0.01], [60, 60, -0.01], [-60, 60, -0.01]], normal: [0, 0, 1], fill: hex(st.palette.grass[2]) };
const unitv = (v) => { const L = Math.hypot(...v); return v.map((x) => x / L); };
const FRONT = unitv([0.35, -0.8, 0.6]), SIDE = unitv([1, -0.1, 0.5]);
const tris = (fs) => fs.reduce((a, f) => a + f.corners.length - 2, 0);

// today's crown (era/isekai.js treeFaces): a heart and shoulder masses, two limbs
const today = () => {
  const k = 77, masses = [{ at: [c[0], c[1], c[2] + 0.38 * Rc], r: 0.6 * Rc }];
  const n = C.masses[0] + Math.floor(hash3(k, 5, 957) * (C.masses[1] - C.masses[0] + 1)), yaw = 2 * Math.PI * hash3(k, 6, 959);
  for (let i = 0; i < n; i++) {
    const a = yaw + (2 * Math.PI * (i + 0.3 * hash3(k, 10 + i, 961))) / n, e = mix(-0.25, 0.45, hash3(k, 30 + i, 967)), d = Rc * mix(0.55, 0.72, hash3(k, 50 + i, 971));
    masses.push({ at: [c[0] + Math.cos(a) * Math.cos(e) * d, c[1] + Math.sin(a) * Math.cos(e) * d, c[2] + Math.sin(e) * d * 0.8], r: Rc * mix(0.4, 0.55, hash3(k, 70 + i, 977)) });
  }
  const trunk = wood([[0, 0, 0], [0, 0, c[2] * 0.6], c], [C.trunk * h, C.trunk * h * 0.7, C.trunk * h * 0.5]);
  return (toSun, far) => {
    const core0 = chipCore(masses, { crown, ramp }), shadow = makeSunShadow([...core0, ...trunk], toSun, { cell: 0.3 });
    const core = chipCore(masses, { crown, ramp, toSun, shadow }).map((f) => ({ ...f, group: 'isekai:core' }));
    return far ? [...trunk, ...core] : [...trunk, ...core, ...leafChips(masses, { crown, toSun, shadow, ramp, seed: 3 })];
  };
};
// a form's tree: the trunk to the fork, its limbs and twigs, its lobes cored and chipped
const formed = (form) => {
  const T = leafForm(form, { base: [0, 0, 0], h, c, Rc, seed: 7 }), F = LEAF_FORMS[form];
  const trunk = wood([[0, 0, 0], [0, 0, c[2] * 0.35], [0, 0, c[2] - 0.45 * Rc]], [C.trunk * h, C.trunk * h * 0.8, C.trunk * h * 0.65]);
  const limbs = T.limbs.flatMap((l) => wood(l.pts, l.radii, 5)), twigs = T.twigs.flatMap((t) => wood(t.pts, t.radii, 4));
  return (toSun, far) => {
    const W = [...trunk, ...limbs, ...(far ? [] : twigs)], detail = far ? 0 : 1, C0 = formCore(T.lobes, { crown, ramp, detail });
    const shadow = makeSunShadow([...C0.faces, ...W], toSun, { cell: 0.3 }), K = formCore(T.lobes, { crown, ramp, toSun, shadow, detail });
    const core = hollowed(K.faces, K.lobes);
    return far ? [...W, ...core] : [...W, ...core, ...formChips(T.lobes, { crown, toSun, shadow, ramp, seed: 3, grain: F.grain, lean: F.lean })];
  };
};
const VIEWS = [
  { cap: 'close, sun in front', sun: FRONT, cam: [2, -11, 5] },
  { cap: 'close, sun to the side', sun: SIDE, cam: [2, -11, 5] },
  { cap: 'mid (25 m)', sun: FRONT, cam: [5, -24, 6], fov: 30 },
  { cap: 'far (45 m): its cores alone', sun: FRONT, cam: [8, -45, 7], fov: 18, far: true },
];
const W = 400, H = 400, rows = [];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (faces, v) => {
  const html = emitThreeWorld({ faces: [ground, ...faces], bg: '#9cc3e6', inline: true, cameras: [{ name: 'c', worldFraming: { cameraPosition: v.cam, lookAt: [0, 0, c[2] - 0.6], horizontalFov: v.fov ?? 44, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H } });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
try {
  for (const [label, make] of [["today's crown", today()], ...FORMS.map((f) => [f, formed(f)])]) {
    const cells = [];
    for (const v of VIEWS) { const fs = make(v.sun, v.far); cells.push({ cap: `${v.cap} — ${tris(fs)} triangles${v.far ? '' : `, ${fs.filter((f) => f.group === 'isekai:chips').length} chips`}`, src: await shoot(fs, v) }); }
    rows.push({ cap: label, cells }); console.log(label, '|', cells[0].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(${VIEWS.length},${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}figcaption{font-size:11px;color:#aaa}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c2) => `<figure><img src="${c2.src}"><figcaption>${c2.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: VIEWS.length * W + 60, height: 600 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
