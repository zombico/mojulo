import { describe, it, expect } from 'vitest';
import { quickWorld } from './quick.js';
import { UPRIGHT, uprightCamera, uprightRow } from './cameras.js';
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
    // an upright frame: the camera table's fov rides with it (this walker frames as the eye)
    for (const s of levels(S)) expect(s.order.manifest.screen).toEqual({ pole: 'tablet', orientation: 'portrait', fov: 48 });
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
    expect(payload.screen).toEqual({ pole: 'phone', aspect: 0.5625, portrait: true, reach: 1.3333, v0: 76.7245 });
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

describe('the camera table: an upright frame framed by rule, never by genre', () => {
  const HERO = { quick: { goal: 'reach', hero: {} } };
  const hero = (camera, screen) => quickWorld({ id: 'tall', ...HERO, quick: { ...HERO.quick, ...(camera ? { camera } : {}), screen } });

  it('a chase pulled back, its look raised so the hero stands above the thumbs; the eye and the stations as they are', () => {
    const follow = { rule: 'follow', target: 'hero', dist: 5.5, height: 2.4, lookH: 1.1, lead: 1.5 };
    expect(uprightCamera(follow)).toEqual({ camera: { ...follow, dist: 7.975, height: 3.48, lead: 2.175, lookH: 2.2 }, fov: UPRIGHT.follow.fov });
    const eye = { rule: 'eye', target: 'hero', height: 1.6 };
    expect(uprightCamera(eye)).toEqual({ camera: eye, fov: UPRIGHT.eye.fov });
    expect(uprightRow({ rule: 'follow', dist: 0.05 }).rule).toBe('eye');   // a walker: you are the camera
    expect(uprightRow(null).rule).toBe('eye');
    const side = uprightCamera({ rule: 'side', target: 'hero' });
    expect(side.camera.dist).toBeCloseTo(15.4, 6);
    expect(side.lane).toBeLessThan(side.laneWide);
  });

  it('where the hero stands: about a third of the way up an upright frame, its feet clear of the bottom quarter', () => {
    const c = uprightCamera({ rule: 'follow', target: 'hero', dist: 5.5, height: 2.4, lookH: 1.1, lead: 1.5 }).camera;
    const v = 2 * Math.atan(Math.tan(UPRIGHT.follow.fov * Math.PI / 360) / (9 / 16));
    const look = Math.atan2(c.lookH - c.height, c.lead + c.dist);
    const y = (z) => Math.tan(Math.atan2(z - c.height, c.dist) - look) / Math.tan(v / 2);   // -1 the bottom, 1 the top
    const feet = (y(0) + 1) / 2, middle = (y(0.9) + 1) / 2;
    expect(feet).toBeGreaterThan(0.25);
    expect(middle).toBeGreaterThan(0.3); expect(middle).toBeLessThan(0.42);
  });

  it('an upright level carries its framed camera; one on its side keeps the camera as authored', () => {
    const tall = levels(runSteps(hero(null, 'phone'), { ref: 'gw' }))[0].order.manifest;
    const wide = levels(runSteps(hero(null, 'screen'), { ref: 'gw' }))[0].order.manifest;
    const plain = levels(runSteps(hero(null, undefined), { ref: 'gw' }))[0].order.manifest;
    expect(wide.camera).toEqual(plain.camera);
    expect(wide.screen).toBe('screen');
    expect(tall.camera.dist).toBeCloseTo(plain.camera.dist * UPRIGHT.follow.pull, 3);
    expect(tall.screen).toEqual({ pole: 'phone', fov: UPRIGHT.follow.fov });
    // the creator's fov wins over the table's
    const own = levels(runSteps(hero(null, { pole: 'phone', fov: 52 }), { ref: 'gw' }))[0].order.manifest;
    expect(own.screen.fov).toBe(52);
  });

  it('a side-scroller or a fight across an upright frame is advised, never refused; on its side nothing is said', () => {
    const says = (S) => S.flatMap((s) => (s.laws ?? []).filter((l) => l.concern === 'screen' && !l.holds).map((l) => l.says));
    expect(says(runSteps(hero('side', 'phone'), { ref: 'gw' })).join(' ')).toMatch(/side camera across an upright phone sees about \d+ m of its lane/);
    expect(says(runSteps(hero('side', 'tablet'), { ref: 'gw' }))).toEqual([]);
    expect(says(runSteps(hero('third-person', 'phone'), { ref: 'gw' }))).toEqual([]);
    const fight = (screen) => says(runSteps(quickWorld({ id: 'duel', quick: { goal: 'fight', screen } }), { ref: 'gw' }));
    expect(fight('phone').join(' ')).toMatch(/side-view fight across an upright screen/);
    expect(fight('screen')).toEqual([]);
  });
});
