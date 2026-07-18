import { describe, expect, it } from 'vitest';

import { buildLocalRenderParams } from './local-render-params.js';
import { cityBlockoutFixture, mangaSignalPageFixture } from './fixtures.js';

describe('buildLocalRenderParams', () => {
  it('is deterministic: same manifest + target → same params', () => {
    const a = buildLocalRenderParams(mangaSignalPageFixture(), 'p1');
    const b = buildLocalRenderParams(mangaSignalPageFixture(), 'p1');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('rejects a target the manifest does not expand to', () => {
    expect(() => buildLocalRenderParams(mangaSignalPageFixture(), 'nope')).toThrow(/not a render target/);
  });

  it('sizes a panel target from its bounds at ~1MP, snapped to 64', () => {
    const manifest = mangaSignalPageFixture();
    const p = buildLocalRenderParams(manifest, 'p1');
    expect(p.size.width % 64).toBe(0);
    expect(p.size.height % 64).toBe(0);
    expect(p.size.width * p.size.height).toBeGreaterThan(512 * 512);
    expect(p.size.width * p.size.height).toBeLessThanOrEqual(2048 * 2048);
  });

  it('derives strength from preserve levels: strict forms pin hard', () => {
    const shot = cityBlockoutFixture();
    const p = buildLocalRenderParams(shot, 'page');
    // the city blockout carries strict forms
    expect(p.controlnet.strength).toBe(0.6);
    expect(p.controlnet.kind).toBe('scribble');
  });

  it('figures imply at least guided strength on a panel with no strict forms', () => {
    const manifest = mangaSignalPageFixture();
    const panel = manifest.panels.find((pn) => (pn.figures || []).length > 0);
    expect(panel).toBeTruthy();
    for (const form of panel.forms || []) form.preserve = 'loose';
    const p = buildLocalRenderParams(manifest, panel.id);
    expect(p.controlnet.strength).toBe(0.5);
  });

  it('camera phrasing lands in the prompt fragments for a panel target', () => {
    const manifest = mangaSignalPageFixture();
    const panel = manifest.panels[0];
    const p = buildLocalRenderParams(manifest, panel.id);
    expect(p.promptFragments.join(' ')).toMatch(/shot|close-up|over-the-shoulder/i);
  });

  it('always carries the scaffold-echo and no-text negatives', () => {
    for (const [manifest, target] of [
      [cityBlockoutFixture(), 'page'],
      [mangaSignalPageFixture(), 'p1'],
    ]) {
      const p = buildLocalRenderParams(manifest, target);
      const joined = p.negative.join(' ');
      expect(joined).toMatch(/wireframe/);
      expect(joined).toMatch(/watermark/);
    }
  });

  it('never leaks lettering into prompt or negative', () => {
    const manifest = mangaSignalPageFixture();
    const lettering = manifest.panels.flatMap((pn) => (pn.bubbleZones || []).map((z) => z.lettering)).filter(Boolean);
    expect(lettering.length).toBeGreaterThan(0);
    for (const target of ['p1', 'p2', 'p3', 'p4']) {
      const p = buildLocalRenderParams(manifest, target);
      const all = [...p.promptFragments, ...p.negative].join(' ');
      for (const line of lettering) expect(all).not.toContain(line);
    }
  });

  it('defaults to the first target when none is given', () => {
    const p = buildLocalRenderParams(mangaSignalPageFixture());
    expect(p.target).toBe('p1');
  });
});
