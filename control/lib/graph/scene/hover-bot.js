/**
 * THE HOVER BOT — a world's tester that flies rather than walks: an eye held a height over whatever surface the page
 * draws under it (the capture bridge's `ground` and `hover`, scene-three.js), sent along a path at a SPEED (a crawl to a
 * flight: the faster, the coarser its samples) or TELEPORTED to a coordinate to take a shot. Each sample says the ground
 * under it (its height, its group, how it faces), a HOLE where nothing is drawn, a STEP where the ground jumps between
 * two samples, and what the frame cost (triangles, draw calls); a shot every so many samples. It samples a world as a
 * person would see it, fast, without a body's physics: the walk with its legs (a level's completability, game/
 * auto-audit-runner.js) stays the walker's.
 *
 *   HOVER_SPEEDS                   crawl | walk | jog | cycle | drive | fly: metres a second
 *   HOVER                          its eye's height over the ground (m), its sample's interval (s), the jump that is a step
 *                                  (m), a shot's size
 *   flightPlan(path, { speed?, dt? })   → [{ at: [x, y], heading, s }]: a path of [x, y] points resampled every speed × dt
 *                                  metres, each sample its heading along the path
 *   flightReport(samples, { step? })    → { length, samples, holes, steps, steepest, groups, triangles }: what a flight saw
 *   openHoverBot(html, opts?)      → { ground(x, y), teleport(spec), fly(spec), close() } on a capture page (emitThreeWorld
 *                                  { capture: true }) in headless Chromium; teleport({ at | pos, height?, heading?,
 *                                  pitch?, look?, vfov?, shot? }) → { eye, ground, triangles, calls, shot? }; fly({ path,
 *                                  speed?, height?, pitch?, look?, render?, shots?: { every, dir, name } }) → { samples,
 *                                  report, shots }
 *
 * Metres, x east, y north, z up (the world's native frame).
 */
import { loadPuppeteer } from './puppeteer-lazy.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';
import { CAPTURE_GLOBAL, CAPTURE_READY, CAPTURE_GROUND, CAPTURE_HOVER, WORLD_HIDE_SELECTORS } from './capture-contract.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const HOVER_SPEEDS = Object.freeze({ crawl: 0.5, walk: 1.4, jog: 3.5, cycle: 6, drive: 14, fly: 40 });
// (`headroom`: a flight casts for its ground from this over its last, under a tree's crown or an awning)
export const HOVER = Object.freeze({ height: 1.7, dt: 0.5, step: 0.35, headroom: 3, width: 1280, viewHeight: 720 });

/** A speed's metres a second: a setting's name or a number. */
export function speedOf(speed = 'walk') {
  const v = typeof speed === 'number' ? speed : HOVER_SPEEDS[speed];
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`hover: speed is ${Object.keys(HOVER_SPEEDS).join(' | ')} or metres a second (got ${JSON.stringify(speed)})`);
  return v;
}

/** A path resampled at its speed: a sample every speed × dt metres along it, each its heading along the path. */
export function flightPlan(path, { speed = 'walk', dt = HOVER.dt } = {}) {
  if (!Array.isArray(path) || path.length < 2 || !path.every((p) => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite))) throw new Error('hover: path is two or more [x, y] points');
  const gap = speedOf(speed) * dt, out = [];
  let s = 0, carry = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1], len = Math.hypot(bx - ax, by - ay), heading = Math.atan2(by - ay, bx - ax);
    if (len < 1e-9) continue;
    for (let d = carry; d <= len + 1e-9; d += gap) out.push({ at: [r3(ax + ((bx - ax) * d) / len), r3(ay + ((by - ay) * d) / len)], heading: r3(heading), s: r3(s + d) });
    const last = out.length ? out[out.length - 1].s - s : 0;
    carry = gap - (len - last);
    s += len;
  }
  return out;
}

/** What a flight saw: its holes, the steps the ground took between samples, the steepest of its slopes, the groups under
 *  it and how many samples each, the frame's triangles. */
export function flightReport(samples, { step = HOVER.step } = {}) {
  const holes = [], steps = [], groups = {};
  let steepest = 0, prev = null, tmax = 0, tsum = 0, tn = 0;
  for (const S of samples) {
    if (!S.ground) { holes.push(S.at); prev = null; continue; }
    groups[S.ground.group] = (groups[S.ground.group] ?? 0) + 1;
    if (Number.isFinite(S.triangles)) { tmax = Math.max(tmax, S.triangles); tsum += S.triangles; tn++; }
    if (prev) {
      const run = Math.hypot(S.at[0] - prev.at[0], S.at[1] - prev.at[1]), dz = S.ground.z - prev.ground.z;
      if (Math.abs(dz) > step) steps.push({ at: S.at, dz: r3(dz), from: prev.ground.group, to: S.ground.group });
      else if (run > 1e-6) steepest = Math.max(steepest, Math.abs(dz) / run);
    }
    prev = S;
  }
  const length = samples.length ? samples[samples.length - 1].s ?? 0 : 0;
  return { length: r3(length), samples: samples.length, holes, steps, steepest: r3(steepest), groups, ...(tn ? { triangles: { max: tmax, mean: Math.round(tsum / tn) } } : {}) };
}

/** The bot on a capture page in headless Chromium. */
export async function openHoverBot(html, { width = HOVER.width, height = HOVER.viewHeight, scale = 1, settleMs = 1500, timeoutMs = 240000 } = {}) {
  if (!html || typeof html !== 'string') throw new Error('hover: a capture page\'s HTML (emitThreeWorld { capture: true })');
  await loadPuppeteer();
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs, protocolTimeout: timeoutMs });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true && typeof window[b.g][b.hover] === 'function', { timeout: timeoutMs }, { g: CAPTURE_GLOBAL, ready: CAPTURE_READY, hover: CAPTURE_HOVER });
  await page.evaluate((hide) => { for (const sel of hide) for (const el of document.querySelectorAll(sel)) el.style.display = 'none'; }, WORLD_HIDE_SELECTORS);
  await new Promise((r) => setTimeout(r, settleMs));
  const call = (m, ...args) => page.evaluate((g, mm, aa) => window[g][mm](...aa), CAPTURE_GLOBAL, m, args);
  const shoot = async (file) => { await page.screenshot({ path: file, ...(/\.jpe?g$/i.test(file) ? { type: 'jpeg', quality: 84 } : {}) }); return file; };
  const bot = {
    page,
    ground: (x, y) => call(CAPTURE_GROUND, x, y),
    /** The eye stood at a coordinate (over its ground, or at `pos`), looking as told; a shot taken where asked. */
    async teleport(spec = {}) {
      const res = await call(CAPTURE_HOVER, spec);
      if (spec.shot) { await new Promise((r) => setTimeout(r, spec.settleMs ?? 250)); res.shot = await shoot(spec.shot); }
      return res;
    },
    /** A flight along a path at a speed: each sample its ground, a shot every so many. */
    async fly({ path, speed = 'walk', dt = HOVER.dt, height: h = HOVER.height, pitch = 0, look = null, render = true, shots = null, step = HOVER.step } = {}) {
      const plan = flightPlan(path, { speed, dt }), samples = [], files = [];
      for (let k = 0; k < plan.length; k++) {
        const P = plan[k], want = shots && k % Math.max(1, shots.every ?? 10) === 0;
        const prev = samples.length ? samples[samples.length - 1].ground : null;
        const res = await call(CAPTURE_HOVER, { at: P.at, height: h, heading: P.heading, pitch, ...(look ? { look } : {}), ...(prev ? { from: prev.z + HOVER.headroom } : {}), render: render || want });
        if (want) files.push(await shoot(`${shots.dir}/${shots.name ?? 'fly'}-${String(k).padStart(4, '0')}.jpg`));
        samples.push({ ...P, ground: res.ground, eye: res.eye, ...(Number.isFinite(res.triangles) ? { triangles: res.triangles, calls: res.calls } : {}) });
      }
      return { samples, report: flightReport(samples, { step }), shots: files };
    },
    close: () => browser.close(),
  };
  return bot;
}
