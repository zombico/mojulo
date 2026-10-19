/**
 * first-frame-check — render each level's opening frame and judge it (first-frame.js holds the measures). A MACHINE
 * gate: it advises and stamps, never refuses, and never claims the eyes gate (a person playing the level).
 *
 * The frame: the level's World page in capture mode (the same page forge_motion's traversals drive), loaded in the
 * headless browser the repo already uses (lib/graph/scene/chromium.js), played for its first second standing still
 * (FIRST_FRAME.settle idle ticks, the traversal tick API) so the level's own camera entity (follow, overhead, eye …)
 * has eased from where the page starts it into the view the player gets, then read off the WebGL canvas small
 * (FIRST_FRAME.width × height): the rendered world only, never the page's DOM overlays (HUD, legend, buttons). The eye is
 * read from the runtime: the capture bridge's `view()` (the camera as rendered, a follow camera's wall pull-in
 * included) and the entities' collision volumes (`window.__mojCtrl.world`). One browser serves every level of a check.
 *
 * The browser is an optional worker, never a dependency: with none installed the check answers
 * `{ status: 'skipped', skipped: 'skipped: no browser' }` and nothing else changes. It never downloads one (no
 * Chrome-for-Testing fetch: that is reserved for explicit renders). `MOJULO_GAME_BROWSER=off` keeps it off too (the
 * test environment sets it, vitest.setup.js, so a suite that runs design_game never launches Chrome by accident).
 *
 * Cheap on repeat: a verdict is kept per emitted page (its hash), so a level whose page did not change is not
 * rendered again in this process (a design_game rerun that kept everything renders nothing).
 */
import { createHash } from 'node:crypto';
import { judgeFrame, worse, FIRST_FRAME } from './first-frame.js';

const MEMO = new Map();
const MEMO_MAX = 64;
const NOTE = 'machine gate: one frame per level from its own camera; the eyes gate (a person playing it) has not run';

/**
 * The browser a level check may use: an installed one only (never a download). → { path, why }
 * @param {{ env?: object, resolve?: (o) => Promise<string> }} [opts]  injectable for tests
 */
export async function levelBrowser({ env = process.env, resolve } = {}) {
  if (env.MOJULO_GAME_BROWSER === 'off') return { path: null, why: 'no browser (MOJULO_GAME_BROWSER=off)' };
  try {
    const find = resolve ?? (await import('@/lib/graph/scene/chromium')).resolveChromium;
    return { path: await find({ allowFetch: false }), why: null };
  } catch {
    return { path: null, why: 'no browser' };
  }
}

/** A level's capture page and opening fov, or { skip } when it has no World form. */
async function levelPage(ref) {
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) return { skip: `no sketch '${ref}'` };
  const { payload } = (await resolveWorldScene(sketch)) || {};
  if (!payload) return { skip: 'no World form to render' };
  // a game made for a screen (game/screen.js) is judged in its own frame, its long side the check's
  const { payloadFrame } = await import('@/lib/graph/game/screen');
  return { html: emitThreeWorld({ ...payload, inline: true, capture: true, walk: false, decollide: true }), ...(payload.screen ? { frame: payloadFrame(payload.screen, Math.max(FIRST_FRAME.width, FIRST_FRAME.height)) } : {}) };
}

/**
 * Check the opening frame of each level.
 * @param {string[]} refs  level refs
 * @param {object} [opts]  injectable: findBrowser, page (ref → { html } | { skip }), capture (frames, { executablePath, width, height }) → [{ rgba, scene } | { error }]
 * @returns {Promise<{ gate:'machine', status:'pass'|'warn'|'failed'|'skipped', levels?, skipped?, ms?, note }>}
 */
export async function firstFrameCheck(refs, { findBrowser = levelBrowser, page = levelPage, capture = captureOpeningFrames, T = FIRST_FRAME } = {}) {
  const list = [...new Set((refs ?? []).filter((r) => typeof r === 'string' && r))];
  if (!list.length) return { gate: 'machine', status: 'skipped', skipped: 'skipped: no levels', note: NOTE };
  const browser = await findBrowser();
  if (!browser?.path) return { gate: 'machine', status: 'skipped', skipped: `skipped: ${browser?.why ?? 'no browser'}`, note: NOTE };
  const t0 = Date.now();
  const levels = [], todo = [];
  for (const ref of list) {
    let P;
    try { P = await page(ref); } catch (e) { P = { skip: `could not emit its page: ${e.message}` }; }
    if (P.skip) { levels.push({ ref, status: 'skipped', says: [P.skip] }); continue; }
    const key = createHash('sha1').update(P.html).update(JSON.stringify(T)).digest('hex');
    const kept = MEMO.get(key);
    const row = { ref, ...(kept ?? {}) };
    levels.push(row);
    if (!kept) todo.push({ row, key, html: P.html, ...(P.frame ? { frame: P.frame } : {}) });
  }
  if (todo.length) {
    let shots;
    try { shots = await capture(todo.map((x) => ({ ref: x.row.ref, html: x.html, ...(x.frame ? { frame: x.frame } : {}) })), { executablePath: browser.path, width: T.width, height: T.height }); }
    catch (e) { shots = todo.map(() => ({ error: e.message })); }
    todo.forEach((x, i) => {
      const s = shots[i] ?? { error: 'no frame' };
      if (s.error) { Object.assign(x.row, { status: 'skipped', says: [`the frame did not render: ${s.error.split('\n')[0]}`] }); return; }
      const scene = s.scene ?? {};
      const v = judgeFrame({ rgba: s.rgba, scene }, T);
      const verdict = { status: v.status, colour: v.colour, ...(v.eye_inside ? { eye_inside: v.eye_inside } : {}), ...(v.hero ? { hero: v.hero } : {}), ...(scene.camera ? { camera: scene.camera } : {}), says: v.says };
      Object.assign(x.row, verdict);
      if (MEMO.size >= MEMO_MAX) MEMO.delete(MEMO.keys().next().value);
      MEMO.set(x.key, verdict);
    });
  }
  const status = levels.reduce((s, l) => (l.status === 'skipped' ? s : worse(s, l.status)), levels.every((l) => l.status === 'skipped') ? 'skipped' : 'pass');
  return { gate: 'machine', status, levels, ms: Date.now() - t0, note: NOTE };
}

/** Forget the kept verdicts (tests). */
export function _resetFirstFrameMemo() { MEMO.clear(); }

/**
 * design_game's readout of a run: the opening frame of every level of the game it made, or nothing when the call did
 * not run. A fight (versus) plays in its own arena page, not a level world, so it has none.
 * @param {object} world  the gameworld as the run left it (its `made`)
 * @param {Array<{ key, action }>|undefined} ran  what the run did (undefined: the call did not run)
 */
export async function firstFrameReadout(world, ran, opts) {
  if (!ran || !world?.made) return {};
  // a run that kept everything changed no frame: nothing to render (a deterministic page renders as it did)
  if (ran.every((r) => r.action === 'keep' || r.action === 'waiting')) return { first_frame: { gate: 'machine', status: 'skipped', skipped: 'skipped: nothing made or remade this run', note: NOTE } };
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const game = world.made.game ? SketchRepository.getByRef(world.made.game.ref)?.manifest : null;
  if (game?.engine === 'versus') return {};
  const refs = Array.isArray(game?.levels) ? game.levels.map((l) => l?.ref)
    : Object.entries(world.made).filter(([k]) => k.startsWith('level-')).map(([, v]) => v.ref);
  if (!refs.length) return {};
  return { first_frame: await firstFrameCheck(refs, opts) };
}

/**
 * Render each page's opening frame. One browser, a page per level: load, wait for the capture bridge, size the canvas,
 * play `settle` idle ticks (the camera entity eases the camera in), read the last tick's pixels off the WebGL canvas,
 * read the rendered eye.
 * @returns {Promise<Array<{ rgba: Uint8Array, scene } | { error: string }>>}
 */
export async function captureOpeningFrames(items, { executablePath, width = FIRST_FRAME.width, height = FIRST_FRAME.height, settle = FIRST_FRAME.settle, timeoutMs = 60000 } = {}) {
  const { loadPuppeteer } = await import('@/lib/graph/scene/puppeteer-lazy');
  const { launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');
  const C = await import('@/lib/graph/scene/capture-contract');
  const B = { g: C.CAPTURE_GLOBAL, ready: C.CAPTURE_READY, step: C.CAPTURE_STEP, view: C.CAPTURE_VIEW };
  await loadPuppeteer();
  const browser = await launchChromium({ executablePath, headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs });
  const out = [];
  try {
    for (const { html, frame } of items) {
      let pg = null;
      try {
        // eslint-disable-next-line no-await-in-loop -- one level at a time, one browser
        pg = await browser.newPage();
        // eslint-disable-next-line no-await-in-loop
        out.push(await openingFrame(pg, html, { B, width: frame?.width ?? width, height: frame?.height ?? height, timeoutMs, root: C.WORLD_ROOT_SELECTOR, hide: C.WORLD_HIDE_SELECTORS, settle }));
      } catch (e) {
        out.push({ error: e.message });
      } finally {
        // eslint-disable-next-line no-await-in-loop
        if (pg) await pg.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return out;
}

async function openingFrame(pg, html, { B, width, height, timeoutMs, root, hide, settle }) {
  await pg.setViewport({ width, height, deviceScaleFactor: 1 });
  await pg.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await pg.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true, { timeout: timeoutMs }, B);
  await pg.evaluate((sels, sel, w, h) => {
    for (const s of sels) for (const el of document.querySelectorAll(s)) el.style.display = 'none';
    const el = document.querySelector(sel);
    if (el) { el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.maxWidth = 'none'; el.style.aspectRatio = 'auto'; }
    window.dispatchEvent(new Event('resize'));
  }, hide, root, width, height);
  // The first second of play, standing still (the camera entity eases the camera into the player's view), then the
  // frame read straight off the WebGL canvas in the same task as its render (no screenshot: only the rendered world
  // is judged, never the page's DOM overlays, and it is the cheap read). With it: the eye as rendered (the bridge's
  // view(): a follow camera's wall pull-in included), the hero the camera watches, and each entity's collision volume
  // as the runtime holds it.
  const got = await pg.evaluate((b, n, sel) => {
    for (let i = 0; i < n; i++) window[b.g][b.step]({ dt: 1 / 24, input: {} });
    const wrap = document.querySelector(sel) || document.body;
    let cv = null;
    for (const c of wrap.querySelectorAll('canvas')) if (!cv || c.width * c.height > cv.width * cv.height) cv = c;
    if (!cv) return { error: 'no canvas' };
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const cx = out.getContext('2d');
    cx.drawImage(cv, 0, 0);
    const d = cx.getImageData(0, 0, out.width, out.height).data;
    let bin = '';
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    const v = window[b.g][b.view] ? window[b.g][b.view]() : null;
    const W = window.__mojCtrl && window.__mojCtrl.world;
    const entities = W ? W.entities.map((e) => ({
      id: e.id, pos: e.transform.pos.slice(), eye: e.rule && e.rule.eye, collideRadius: e.rule && e.rule.collideRadius,
      collideHeight: e.rule && e.rule.collideHeight, collideVol: e.collideVol || null, bodyType: e.body && e.body.type,
      radius: e.body && e.body.radius, size: e.body && Array.isArray(e.body.size) ? e.body.size.slice() : null,
    })) : [];
    const rule = (W && W.camera && W.camera.rule) || {};
    return {
      px: btoa(bin), width: out.width, height: out.height,
      scene: {
        entities,
        ...(v ? { eye: v.eye, look: [v.eye[0] + v.dir[0], v.eye[1] + v.dir[1], v.eye[2] + v.dir[2]], vfov: v.fov, aspect: v.aspect } : {}),
        heroId: rule.target || (W && W.pilotId) || null, firstPerson: rule.type === 'eye' || !!rule.hideTarget, camera: rule.type || null,
      },
    };
  }, B, Math.max(1, settle), root);
  if (got.error) return { error: got.error };
  return { rgba: Buffer.from(got.px, 'base64'), width: got.width, height: got.height, scene: got.scene };
}
