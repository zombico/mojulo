// AN ACTION HERO'S PAGE in a real browser (an e2e suite: skipped when no browser is installed). The fixture matrix's
// `action-hero` (emit-fixtures.js): a moveset's hero, its lock on a foe wearing the target rim, a cast rimmed by its
// effects' light. The page comes up with no error (the target rim and the effect rim once each declared a page-level
// `__rimMat`, and such a page threw on load), and a mouse press strikes on either camera: one that does not capture the
// mouse (a press strikes at once; the beats were once bound only under mouse-look) and one that does (after the click
// that captures it).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EMIT_FIXTURES } from './emit-fixtures.js';
import { emitThreeWorld } from './scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';

const [, OPTS] = EMIT_FIXTURES.find(([n]) => n === 'action-hero');
let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

/** The page up, the mouse pressed once (after a capturing click where the camera captures), → the hero's last press. */
async function strike(opts, { capture }) {
  const p = await browser.newPage();
  await p.setViewport({ width: 960, height: 540 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.setContent(emitThreeWorld({ ...opts, inline: true }), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world, { timeout: 120000 });
  const seq = () => p.evaluate(() => { const H = window.__mojCtrl.world.entities.find((e) => e.pilotable); return H.mvPress ? H.mvPress.seq : 0; });
  if (capture) { await p.mouse.click(480, 270); await new Promise((r) => setTimeout(r, 300)); }
  const s0 = await seq();
  await p.mouse.down();
  await p.waitForFunction((s) => { const H = window.__mojCtrl.world.entities.find((e) => e.pilotable); return !!H.mvPress && H.mvPress.seq > s; }, { timeout: 30000 }, s0);
  await p.mouse.up();
  const press = await p.evaluate(() => window.__mojCtrl.world.entities.find((e) => e.pilotable).mvPress);
  await p.close();
  return { errors, press };
}

describe('an action hero\'s page in a browser', () => {
  it('comes up with both rims and no error, and a press strikes on a camera that does not capture the mouse', async () => {
    if (!browser) return;
    const { errors, press } = await strike(OPTS, { capture: false });
    expect(errors).toEqual([]);
    expect(press).toMatchObject({ beat: 'L', verdict: 'taken' });
  }, 300000);

  it('and on a mouse-look camera, once the click has captured the mouse', async () => {
    if (!browser) return;
    const { errors, press } = await strike({ ...OPTS, camera: { ...OPTS.camera, mouseLook: true } }, { capture: true });
    expect(errors).toEqual([]);
    expect(press).toMatchObject({ beat: 'L', verdict: 'taken' });
  }, 300000);
});
