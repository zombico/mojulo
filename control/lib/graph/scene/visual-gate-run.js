/**
 * THE VISUAL GATE'S DRIVERS (scene/visual-gate.js is its arithmetic and report): a level's shots rendered on the World
 * page in headless Chrome and in each engine the handoff reaches, through each adapter's own build of the level, then
 * scored and stamped. Advisory: an engine that is absent is skipped and says so, one that fails says how, and nothing
 * here refuses or fails an export.
 *
 *   renderPageShots(sketch, shots, { dir, stills, size? }) → { ran, framing: { <shot>: {...} }, stills: { <shot>: png } }
 *     The World page as the live route serves it in the form render (resolveWorldScene live, gen-7: the read the handoff
 *     takes), emitted as a capture page whose canvas is the shot's size from its first layout (emitThreeWorld's
 *     `captureSize`), steered by its capture bridge (`frame({ pos, target, vfov })`) and checked by it (`view()`: the
 *     aspect and fov the frame was drawn at). Each shot is drawn until two stills in a row agree (textures load late).
 *   renderEngineShots(engine, handoff, shots, { dir, stills, bin?, sketch? }) → { ran, stills: { <shot>: png }, ... }
 *     the adapter's pack written into `dir` (the gate's own copy: a developer's handoff folder is never touched), built by
 *     its importer and shot:
 *       godot    `--import` headless, then a window of its own: each shot through a SubViewport of the shot's size (the
 *                window's size and the display's scale never frame it), the level.tscn the developer gets
 *       blender  import_handoff.py builds level.blend; each shot a camera of the shot's vertical fov, rendered in the
 *                scene's own engine and settings (EEVEE, the page's tone)
 *       unreal   import_handoff.py (UnrealEditor-Cmd), then handoff_render.py in the editor offscreen (its `at`/`look`/
 *                `yfov` shots)
 *       unity    Mojulo.Handoff.Import.Run, then Mojulo.Handoff.Probe.Render (its `at`/`look`/`yfov` shots)
 *   runVisualGate(sketch, { engines?, out, poses?, size?, only? }) → { report, json, html }: the shots (visual-gate.js
 *     gateShots; `only` keeps the named ones), the page's stills, each engine's, the scores, the report (visual-gate.json) and the contact sheet
 *     (visual-gate.html) in `out`, with the stills under out/stills/ and each engine's project under out/engines/.
 */
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from './scene-three.js';
import { resolveHandoff, HANDOFF_ERA } from './handoff.js';
import { writeHandoffGodot } from './handoff-godot.js';
import { writeHandoffBlender, HANDOFF_BLEND } from './handoff-blender.js';
import { writeHandoffUnreal, HANDOFF_UPROJECT } from './handoff-unreal.js';
import { writeHandoffUnity } from './handoff-unity.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';
import { loadPuppeteer } from './puppeteer-lazy.js';
import { WORLD_HIDE_SELECTORS } from './capture-contract.js';
import { findGodot, findBlender, findUnreal, findUnity } from '../../workers/find.js';
import { GATE_SIZE, GATE_ENGINES, gateShots, decodeImage, compareImages, gateReport, contactSheet, heatPng, thumbPng } from './visual-gate.js';

const DEG = Math.PI / 180;
const FINDERS = { godot: findGodot, blender: findBlender, unreal: findUnreal, unity: findUnity };
const ENGINE_NAMES = { godot: 'Godot', blender: 'Blender', unreal: 'Unreal', unity: 'Unity' };
/** A still's file name for a shot (its name made a file's). */
export const stillName = (shot, who) => `${String(shot.name).replace(/[^A-Za-z0-9_-]+/g, '_')}.${who}.png`;
/** Two page stills in a row agree when no more than this share of their pixels differ. */
export const PAGE_JITTER = 0.002;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// (a program run to its end or its time, its output's tail kept)
function run(bin, args, { cwd, env = {}, timeoutMs = 1_800_000 } = {}) {
  return new Promise((resolve) => {
    let tail = '', timedOut = false;
    const keep = (d) => { tail = (tail + d).slice(-24000); };
    let child;
    try { child = spawn(bin, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ code: null, error: e.message, tail: '' }); return; }
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: null, error: e.message, tail }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, tail, ...(timedOut ? { error: `timed out after ${Math.round(timeoutMs / 1000)} s` } : {}) }); });
  });
}
const lastLines = (s, n = 12, re = null) => String(s).split(/\r?\n/).filter((l) => l.trim() && (!re || re.test(l))).slice(-n).join('\n');

// ---- the page -----------------------------------------------------------------------------------------------------

export async function renderPageShots(sketch, shots, { stills, size = GATE_SIZE, timeoutMs = 1_200_000, payload: given = null, log = () => {} } = {}) {
  const t0 = Date.now();
  try { await loadPuppeteer(); } catch (e) { return { ran: false, skipped: `puppeteer-core is not installed (${e.message})` }; }
  let exe;
  try { exe = await resolveChromium(); } catch (e) { return { ran: false, skipped: `no Chromium (${e.message})` }; }
  const payload = given ?? (await resolveWorldScene(sketch, { live: true, era: HANDOFF_ERA })).payload;
  if (!payload) return { ran: false, error: 'the sketch resolves to no World page' };
  await fs.mkdir(stills, { recursive: true });
  const file = path.join(stills, '..', 'page.html');
  await fs.writeFile(file, emitThreeWorld({ ...payload, capture: true, captureSize: { width: size.width, height: size.height }, inline: true, hud: false, walk: false }));
  let browser = null;
  const errors = [];
  try {
    browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs, protocolTimeout: timeoutMs });
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForFunction(() => !!(window.__mojCapture && window.__mojCapture.ready === true), { timeout: timeoutMs, polling: 500 });
    // (the form render's land draws once its textures have loaded: it says so)
    if (payload.form?.land) await page.waitForFunction(() => window.__formReady === true, { timeout: timeoutMs, polling: 1000 });
    await page.evaluate((hide) => { for (const s of hide) for (const el of document.querySelectorAll(s)) el.style.display = 'none'; }, WORLD_HIDE_SELECTORS);
    const framing = {}, out = {};
    for (const s of shots) {
      const spec = { pos: s.at, target: s.look, vfov: s.yfov / DEG, t: 0 };
      let prev = null, png = null, stable = false, k = 0, jitter = null;
      // (drawn until two stills in a row agree: a texture that loads late changes the next. Agree within a few pixels:
      // the software rasterizer leaves a scatter of single pixels on a busy ground differing frame to frame)
      for (; k < 12; k++) {
        await page.evaluate((sp) => window.__mojCapture.frame(sp), spec);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
        png = Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size.width, height: size.height } }));
        const img = decodeImage(png);
        if (prev && img) {
          jitter = 0;
          for (let i = 0; i < img.rgb.length; i += 3) if (img.rgb[i] !== prev.rgb[i] || img.rgb[i + 1] !== prev.rgb[i + 1] || img.rgb[i + 2] !== prev.rgb[i + 2]) jitter++;
          if (k >= 2 && jitter <= PAGE_JITTER * size.width * size.height) { stable = true; break; }
        }
        prev = img;
        await sleep(400);
      }
      const v = await page.evaluate(() => {
        const c = document.querySelector('#wrap canvas'), r = c ? c.getBoundingClientRect() : null, w = window.__mojCapture.view ? window.__mojCapture.view() : null;
        return { left: r ? r.left : null, top: r ? r.top : null, width: r ? r.width : null, height: r ? r.height : null, buffer: c ? [c.width, c.height] : null, aspect: w ? w.aspect : null, fov: w ? w.fov : null };
      });
      const exact = v.left === 0 && v.top === 0 && v.width === size.width && v.height === size.height && Math.abs(v.aspect - size.width / size.height) < 1e-9 && Math.abs(v.fov - spec.vfov) < 1e-9;
      framing[s.name] = { ...v, exact, stable, frames: k + 1, jitter };
      const p = path.join(stills, stillName(s, 'page'));
      await fs.writeFile(p, png);
      out[s.name] = p;
      log(`page ${s.name}: ${p}${exact ? '' : ' (NOT exactly framed)'}${stable ? '' : ' (not stable)'}`);
    }
    return { ran: true, ms: Date.now() - t0, framing, stills: out, ...(errors.length ? { pageErrors: errors.slice(0, 8) } : {}) };
  } catch (e) {
    return { ran: false, error: `the page did not render: ${e.message}`, ...(errors.length ? { pageErrors: errors.slice(0, 8) } : {}) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ---- the engines --------------------------------------------------------------------------------------------------

// (the gate's Godot shots: level.tscn as the developer gets it, each shot through a SubViewport of its own size)
export const GODOT_SHOTS_GD = `extends SceneTree
# mojulo's visual gate: a still per shot of level.tscn, each through a SubViewport of the shot's size (so the window's
# size and the display's scale never frame it), its camera at the shot's pose and vertical fov (mojulo's frame: z-up).
var shots := []
var i := 0
var n := 0
var vp: SubViewport
var cam: Camera3D
func zup(a) -> Vector3:
	return Vector3(float(a[0]), float(a[2]), -float(a[1]))
func _initialize():
	shots = JSON.parse_string(FileAccess.get_file_as_string(OS.get_environment("MOJULO_SHOTS")))["shots"]
	root.add_child(load("res://level.tscn").instantiate())
	vp = SubViewport.new()
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	cam = Camera3D.new()
	cam.near = 0.1
	cam.far = 8000.0
	cam.keep_aspect = Camera3D.KEEP_HEIGHT
	vp.add_child(cam)
	_pose()
func _pose():
	var S = shots[i]
	vp.size = Vector2i(int(S["w"]), int(S["h"]))
	var at := zup(S["at"])
	cam.transform = Transform3D(Basis.looking_at((zup(S["look"]) - at).normalized(), Vector3.UP), at)
	cam.fov = rad_to_deg(float(S["yfov"]))
	cam.current = true
	n = 0
func _process(_d):
	n += 1
	# (the first shot waits longer: the pipelines compile on its first frames)
	if n == (40 if i == 0 else 20):
		var S = shots[i]
		vp.get_texture().get_image().save_png(S["out"])
		print("[mojulo-visual-gate] ", S["name"], " -> ", S["out"])
		i += 1
		if i >= shots.size():
			quit()
		else:
			_pose()
	return false
`;

// (the gate's Blender shots: over the level.blend the importer built, a camera of each shot's vertical fov)
export const BLENDER_SHOTS_PY = `import bpy, json, sys
from mathutils import Vector
# mojulo's visual gate: a still per shot of the level.blend the handoff's importer built, in the scene's own engine and
# settings, its camera at the shot's pose and vertical fov (mojulo's frame is Blender's: z-up metres).
J = json.load(open(sys.argv[sys.argv.index('--') + 1]))
sc = bpy.context.scene
cd = bpy.data.cameras.new('mojulo-visual-gate')
cd.sensor_fit = 'VERTICAL'
cd.clip_start, cd.clip_end = 0.1, 8000.0
o = bpy.data.objects.new('mojulo-visual-gate', cd)
sc.collection.objects.link(o)
sc.camera = o
for s in J['shots']:
    cd.angle_y = float(s['yfov'])
    o.location = Vector(s['at'])
    o.rotation_euler = (Vector(s['look']) - Vector(s['at'])).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = int(s['w']), int(s['h']), 100
    sc.render.filepath = s['out']
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    bpy.ops.render.render(write_still=True)
    print('[mojulo-visual-gate]', s['name'], '->', s['out'], flush=True)
`;

async function engineVersion(engine, bin) {
  if (engine !== 'godot' && engine !== 'blender') return null;
  const r = await run(bin, engine === 'godot' ? ['--headless', '--version'] : ['-b', '--version'], { timeoutMs: 60000 });
  const line = String(r.tail).split(/\r?\n/).map((l) => l.trim()).find((l) => (engine === 'godot' ? /^\d+\.\d+/.test(l) : /^Blender \d/.test(l)));
  return line ?? null;
}

export async function renderEngineShots(engine, h, shots, { dir, stills, bin: given, sketch = null, log = () => {}, timeoutMs = 3_600_000 } = {}) {
  if (!GATE_ENGINES.includes(engine)) return { ran: false, error: `no engine '${engine}' (${GATE_ENGINES.join(', ')})` };
  const bin = given ?? FINDERS[engine]();
  if (!bin || !existsSync(bin)) return { ran: false, skipped: `no ${ENGINE_NAMES[engine]} on this machine${bin ? ` (${bin} is not there)` : ''}` };
  const t0 = Date.now();
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(stills, { recursive: true });
  const wanted = shots.map((s) => ({ name: s.name, out: path.join(stills, stillName(s, engine)), w: s.w, h: s.h, at: s.at, look: s.look, yfov: s.yfov }));
  for (const s of wanted) await fs.rm(s.out, { force: true });
  const shotsFile = path.join(dir, 'visual-gate-shots.json');
  await fs.writeFile(shotsFile, `${JSON.stringify({ settle: 20, shots: wanted }, null, 1)}\n`);
  const version = await engineVersion(engine, bin);
  const steps = [];
  const step = async (label, args, opts = {}) => { log(`${engine}: ${label}`); const r = await run(opts.bin ?? bin, args, { timeoutMs, ...opts }); steps.push({ label, code: r.code, ...(r.error ? { error: r.error } : {}) }); return r; };
  let last = null;
  if (engine === 'godot') {
    await writeHandoffGodot(h, dir, { title: sketch?.title ?? null });
    await fs.writeFile(path.join(dir, 'visual_gate_shots.gd'), GODOT_SHOTS_GD);
    await step('import', ['--headless', '--path', dir, '--import']);
    // (not headless: a headless Godot draws nothing. A window of its own, small: the shots are drawn off it)
    last = await step('shots', ['--path', dir, '--windowed', '--resolution', '320x180', '--script', 'res://visual_gate_shots.gd'], { env: { MOJULO_SHOTS: shotsFile }, timeoutMs: 900_000 });
  } else if (engine === 'blender') {
    await writeHandoffBlender(h, dir, { title: sketch?.title ?? null, sketch });
    await fs.writeFile(path.join(dir, 'visual_gate_shots.py'), BLENDER_SHOTS_PY);
    const imp = await step('import', ['-b', '--python', path.join(dir, 'mojulo', 'import_handoff.py')]);
    if (!existsSync(path.join(dir, HANDOFF_BLEND))) return { ran: false, error: `the importer built no ${HANDOFF_BLEND}`, bin, version, steps, log: lastLines(imp.tail, 16) };
    last = await step('shots', ['-b', path.join(dir, HANDOFF_BLEND), '--python', path.join(dir, 'visual_gate_shots.py'), '--', shotsFile]);
  } else if (engine === 'unreal') {
    await writeHandoffUnreal(h, dir, { title: sketch?.title ?? null });
    const proj = path.join(dir, HANDOFF_UPROJECT);
    await step('import', [proj, '-run=pythonscript', `-script=${path.join(dir, 'mojulo', 'import_handoff.py')}`, '-unattended', '-nosplash', '-AllowCommandletRendering', '-RenderOffscreen', `-abslog=${path.join(dir, 'visual-gate-import.log')}`]);
    // (stills come from the full editor, offscreen: a commandlet never ticks the world)
    const ed = bin.replace(/-Cmd$/, '');
    last = await step('shots', [proj, '-RenderOffscreen', '-unattended', '-nosplash', '-nosound', `-ExecCmds=py ${path.join(dir, 'mojulo', 'handoff_render.py')}`, `-abslog=${path.join(dir, 'visual-gate-render.log')}`],
      { bin: ed, env: { MOJULO_SHOTS: shotsFile } });
    const logf = path.join(dir, 'visual-gate-render.log');
    if (existsSync(logf)) last = { ...last, tail: readFileSync(logf, 'utf8').slice(-24000) };
  } else {
    await writeHandoffUnity(h, dir, { title: sketch?.title ?? null });
    await fs.mkdir(path.join(dir, 'Logs'), { recursive: true });
    const unity = (method, name, env = {}) => step(name, ['-batchmode', '-projectPath', dir, '-executeMethod', method, '-quit', '-logFile', path.join(dir, 'Logs', `visual-gate-${name}.log`)], { env });
    await unity('Mojulo.Handoff.Import.Run', 'import');
    last = await unity('Mojulo.Handoff.Probe.Render', 'shots', { MOJULO_SHOTS: shotsFile });
    const logf = path.join(dir, 'Logs', 'visual-gate-shots.log');
    if (existsSync(logf)) last = { ...last, tail: readFileSync(logf, 'utf8').slice(-24000) };
  }
  const out = {}, missing = [];
  for (const s of wanted) { if (existsSync(s.out)) out[s.name] = s.out; else missing.push(s.name); }
  const base = { bin, ...(version ? { version } : {}), ms: Date.now() - t0, steps };
  if (!Object.keys(out).length) return { ran: false, error: `${ENGINE_NAMES[engine]} drew no still`, ...base, log: lastLines(last?.tail ?? '', 16) };
  return { ran: true, ...base, stills: out, ...(missing.length ? { missing } : {}) };
}

// ---- the gate -----------------------------------------------------------------------------------------------------

export async function runVisualGate(sketch, { engines = GATE_ENGINES, out, poses = [], size = GATE_SIZE, only = null, bins = {}, log = () => {}, handoff = null } = {}) {
  if (!out) throw new Error('runVisualGate: `out` (a folder) is required');
  await fs.mkdir(out, { recursive: true });
  const stills = path.join(out, 'stills');
  const h = handoff ?? await resolveHandoff(sketch, { what: 'level' });
  const shots = gateShots(h.level, { payload: h.payload, poses, size }).filter((s) => !only || only.includes(s.name));
  log(`${shots.length} shot${shots.length === 1 ? '' : 's'}: ${shots.map((s) => `${s.name} (${s.source})`).join(', ') || 'none (no camera markers, no shoot plan, no poses)'}`);
  const page = shots.length ? await renderPageShots(sketch, shots, { stills, size, log }) : { ran: false, skipped: 'no shots' };
  if (!page.ran) log(`page: ${page.skipped ?? page.error}`);
  const ran = {};
  for (const e of engines) {
    const r = shots.length ? await renderEngineShots(e, h, shots, { dir: path.join(out, 'engines', e), stills, bin: bins[e], sketch, log }) : { ran: false, skipped: 'no shots' };
    ran[e] = r;
    log(`${e}: ${r.ran ? `${Object.keys(r.stills).length} still${Object.keys(r.stills).length === 1 ? '' : 's'} in ${Math.round(r.ms / 1000)} s` : r.skipped ? `skipped (${r.skipped})` : `failed (${r.error})${r.log ? `\n${r.log}` : ''}`}`);
  }
  // (the scores: each engine's still against the page's; the sheet's thumbnails and heat maps beside them)
  const scores = {}, images = {}, links = {}, files = {};
  const rel = (p) => path.relative(out, p);
  for (const s of shots) {
    scores[s.name] = {}; images[s.name] = {}; links[s.name] = {}; files[s.name] = {};
    const pp = page.stills?.[s.name], P = pp ? decodeImage(await fs.readFile(pp)) : null;
    if (pp) { links[s.name].page = rel(pp); files[s.name].page = rel(pp); }
    if (P) images[s.name].page = thumbPng(P);
    for (const e of engines) {
      const r = ran[e], ep = r.stills?.[s.name];
      if (!r.ran) { scores[s.name][e] = r.skipped ? { skipped: r.skipped } : { error: r.error }; continue; }
      if (!ep) { scores[s.name][e] = { error: 'no still for this shot' }; continue; }
      links[s.name][e] = rel(ep); files[s.name][e] = rel(ep);
      const E = decodeImage(await fs.readFile(ep));
      if (!E) { scores[s.name][e] = { error: 'its still is not an 8-bit PNG' }; continue; }
      images[s.name][e] = { thumb: thumbPng(E) };
      if (!P) { scores[s.name][e] = { error: 'no page still to hold it to' }; continue; }
      const sc = compareImages(P, E);
      images[s.name][e].heat = heatPng(sc.maps);
      scores[s.name][e] = { scores: sc };
    }
  }
  const engineRows = Object.fromEntries(engines.map((e) => {
    const { stills: _s, log: tail, ...r } = ran[e];
    return [e, { ...r, ...(tail && !r.ran ? { log: tail } : {}) }];
  }));
  const report = gateReport({ sketch, shots, page, engines: engineRows, scores, size, files });
  if (page.pageErrors) report.page.pageErrors = page.pageErrors;
  const json = path.join(out, 'visual-gate.json'), html = path.join(out, 'visual-gate.html');
  await fs.writeFile(json, `${JSON.stringify(report, null, 1)}\n`);
  await fs.writeFile(html, contactSheet(report, images, links));
  for (const l of report.lines) log(l);
  return { report, json, html };
}
