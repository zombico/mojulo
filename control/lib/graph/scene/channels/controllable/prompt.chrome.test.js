// The quick-time prompt, drawn (the e2e tier: it launches a browser, and passes saying nothing when none is installed).
// A prompt brought up by a cue's op shows the button and its word in the middle while told, its ring lit and closing
// once open; a press inside the window answers it, the ring flashes and the hero stays where it is; no page error.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';
import { readPrompts } from '../../../worlds/controllable/prompt.js';

const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#a98' };
const pilot = { id: 'h', pilotable: true, rule: { type: 'walk', speed: 4 }, transform: { pos: [2, 3, 0], heading: 0, pitch: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the quick-time prompt, drawn', () => {
  it('told, then open and closing, then answered by a press inside its window', async () => {
    if (!browser) return;
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(emitThreeWorld({ faces: [floor], entities: [pilot], camera: { rule: 'follow', target: 'h' }, prompts: readPrompts([{ id: 'grab', says: 'Grab', lead: 0.5, window: 0.8, back: [0, 0, 0] }]), viewBox: { width: 320, height: 240 }, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojPromptMana), { timeout: 60000 });
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const look = () => page.evaluate(() => { const R = document.querySelector('.moj-pr'); return { phase: R.dataset.phase || '', u: R.style.getPropertyValue('--moj-pr-u'), text: R.textContent.replace(/\s+/g, ' ').trim() }; });
    await page.evaluate(() => { window.__mojCtrl.cast([{ op: 'prompt', id: 'grab' }]); for (let i = 0; i < 10; i++) window.__mojCtrl.step(1 / 60, {}); });
    await page.evaluate(frame);
    const told = await look();
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__mojCtrl.step(1 / 60, {}); });   // 0.67 s: open
    await page.evaluate(frame);
    const open = await look();
    await page.evaluate(() => { window.__mojCtrl.step(1 / 60, { act: 1 }); window.__mojCtrl.step(1 / 60, {}); });
    await page.evaluate(frame);
    const hit = await look();
    const after = await page.evaluate(() => ({ result: window.__mojCtrl.world.prompt.results.grab, at: window.__mojCtrl.world.byId.h.transform.pos.slice() }));
    await page.close();
    expect(errors).toEqual([]);
    expect(told.phase).toBe('told');
    expect(told.text).toContain('Grab');
    expect(open.phase).toBe('open');
    expect(Number(open.u)).toBeGreaterThan(0.5);
    expect(Number(open.u)).toBeLessThan(1);
    expect(hit.phase).toBe('hit');
    expect(after.result).toBe('hit');
    expect(after.at).toEqual([2, 3, 0]);   // a hit: the hero stays where it is
  }, 180000);
});
