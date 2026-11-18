// A recorded line heard on the World page (a real browser, skipped when none is installed): a scene whose first line
// is recorded (a WAV bound as the world is written) and whose second is not. Built, the page carries the recording's
// bytes; in Chrome, once the page has had a press, the first line's recording plays (taken up where its take has got
// to, the scene having begun with the page) and stops as the scene goes on to the line with no voice.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { playerWorld } from '../player.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { bindSceneVoices } from '../../face-acting/recordings.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null, html = '', payload = null, dir = null, prevOut;
beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'mojulo-voice-live-'));
  prevOut = process.env.MOJULO_OUTCOMES_DIR; process.env.MOJULO_OUTCOMES_DIR = dir;
  // three seconds of a buzz, so the line is still being said when the test listens
  const rate = 16000, n = rate * 3, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin(2 * Math.PI * 150 * i / rate)), 44 + i * 2);
  writeFileSync(path.join(dir, 'gate.wav'), b);
  const W = playerWorld({ hero: { cast: 'female' }, id: 'hero', library: false });
  W.figures.hero = { hero: { cast: 'female' } };
  W.entities.push({ id: 'mayor', rule: { type: 'static' }, transform: { pos: [3, 2, 0], heading: Math.PI }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } });
  W.play = { scenes: [{ id: 'gate', when: { start: true }, beats: [
    { line: { who: 'mayor', say: 'The road has been shut since the spring.', voice: path.join(dir, 'gate.wav') } },
    { line: { who: 'mayor', say: 'Go home.' } },
  ] }] };
  ({ payload } = await resolveWorldScene({ ref: 'sk_talk_voice', title: 'voice', manifest: bindSceneVoices(W) }));
  html = emitThreeWorld({ ...payload, inline: true });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => {
  if (browser) await browser.close().catch(() => {});
  if (prevOut === undefined) delete process.env.MOJULO_OUTCOMES_DIR; else process.env.MOJULO_OUTCOMES_DIR = prevOut;
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('a recorded line on the page', () => {
  it('built: the line\'s take names its recording, and the page carries the recording\'s bytes', () => {
    const line = payload.events.scenes[0].beats.find((b) => b.kind === 'line');
    expect(line.voice).toMatchObject({ recording: expect.stringMatching(/^[0-9a-f]{16}$/) });
    expect(line.take.clip).toBe('talk:gate:0');
    expect(Object.keys(payload.events.voices)).toEqual([line.voice.recording]);
    expect(html).toContain('__voxStep(v)');
  });

  it('in Chrome: after a press, the recording plays while its line is up, past its words typed whole, and stops at the line with none', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mojBus && window.__mojScenes, { timeout: 30000 });
      await page.mouse.click(640, 200);   // (the press a browser asks before any sound)
      await page.waitForFunction(() => window.__mojVoice && window.__mojVoice.context() === 'running', { timeout: 10000 });
      // (the line began as the page did, before the press: its voice is taken up where the take has got to)
      await page.waitForFunction(() => window.__mojVoice.playing() === 'talk:gate:0', { timeout: 10000 });
      // the words typed on whole (a voice runs past them): the voice plays on
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.full, { timeout: 5000 });
      const now = await page.evaluate(() => ({ playing: window.__mojVoice.playing(), view: window.__mojScenes.view() }));
      expect(now.playing, JSON.stringify(now.view)).toBe('talk:gate:0');
      await page.keyboard.press('Space');   // the next line, unrecorded: the voice stops
      await page.waitForFunction(() => window.__mojScenes.view().line && window.__mojScenes.view().line.text.indexOf('Go') === 0, { timeout: 5000 });
      await page.waitForFunction(() => window.__mojVoice.playing() === null, { timeout: 5000 });
    } finally { await page.close(); }
  }, 120000);
});
