import { describe, it, expect } from 'vitest';
import { quickWorld } from './quick.js';
import { runSteps, readGameworld, fingerprint } from './index.js';
import { validateGameManifest } from '../game/game-manifest.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const reach = (extra = {}) => quickWorld({ id: 'tall', quick: { goal: 'reach', ...extra } });
const levels = (S) => S.filter((s) => s.key.startsWith('level-'));

describe('the screen a game is made for, carried from the world to each level and the game', () => {
  it('quick.screen moves up to the world, beside the camera', () => {
    const W = reach({ screen: 'phone' });
    expect(W.screen).toBe('phone');
    expect(W.quick.screen).toBeUndefined();
    expect(readGameworld(W).screen).toBe('phone');
    expect(() => reach({ screen: 'watch' })).toThrow(/quick\.screen is one of/);
    expect(() => readGameworld({ ...reach(), screen: { aspect: [0, 1] } })).toThrow(/gameworld: screen\.aspect/);
  });

  it('every level and the game carry it; the game manifest reads it', () => {
    const S = runSteps(reach({ screen: { pole: 'tablet', orientation: 'portrait' } }), { ref: 'gw' });
    expect(levels(S).length).toBeGreaterThan(0);
    for (const s of levels(S)) expect(s.order.manifest.screen).toEqual({ pole: 'tablet', orientation: 'portrait' });
    const game = S.find((s) => s.key === 'game').order;
    expect(game.screen).toEqual({ pole: 'tablet', orientation: 'portrait' });
    expect(validateGameManifest({ kind: 'game', ...game }).errors ?? []).toEqual([]);
    expect(validateGameManifest({ kind: 'game', ...game, screen: 'watch' }).errors.join('\n')).toMatch(/screen is one of/);
  });

  it('absent adds nothing: no key on any step, every print as it was', () => {
    const plain = runSteps(reach(), { ref: 'gw' }), nulled = runSteps({ ...reach(), screen: null }, { ref: 'gw' });
    for (const s of plain) { expect(s.order.manifest?.screen).toBeUndefined(); expect(s.order.screen).toBeUndefined(); }
    expect(fingerprint(nulled)).toBe(fingerprint(plain));
  });

  it('the level page holds the frame: the viewBox of the frame, the fit, the safe area', async () => {
    const S = runSteps(reach({ screen: 'phone' }), { ref: 'gw' }), L = levels(S)[0];
    const { payload } = await resolveWorldScene({ ref: L.ref, manifest: L.order.manifest });
    expect(payload.screen).toEqual({ pole: 'phone', aspect: 0.5625, portrait: true, reach: 1.3333 });
    expect(payload.viewBox).toEqual({ width: 630, height: 1120 });
    const html = emitThreeWorld({ ...payload, inline: true });
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('function screenFit()');
    expect(html).toContain('safe-area-inset-bottom');
    // absent: none of it
    const { payload: plain } = await resolveWorldScene({ ref: L.ref, manifest: { ...L.order.manifest, screen: undefined } });
    expect(plain.screen).toBeUndefined();
    const page = emitThreeWorld({ ...plain, inline: true });
    expect(page).not.toContain('screenFit');
    expect(page).not.toContain('viewport-fit');
  }, 60000);
});
