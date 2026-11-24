// The cel body (world-scene.js heroFigure `cel`): a body's light, not its face's. The character light baked twice, every
// group stepped lit and every group in shade, each part carrying both tones on the same corners, so the page steps
// between them by the world's key. The concepts: the side scroller's own hero (the herobot rail's) in cel carries its
// shade tones on most of its parts, each differing from its lit tone on the same corners; without `cel` the body is as it
// was, one tone a corner. A boss's signal is marked on its own corners. A body fit to a height (`body.fit`) is drawn that tall by its figure's own bounds.
import { describe, it, expect } from 'vitest';
import { heroFigure, resolveWorldScene } from './world-scene.js';
import { gameBody } from '../gameworld/game-bodies.js';
import { bossSpec } from '../gameworld/boss-spec.js';

const HERO = gameBody('herobot', 'hero').spec;

describe('the cel body', () => {
  it('the herobot in cel: most parts carry a shade tone on their own corners; without it, one tone', async () => {
    const [cel, baked] = await Promise.all([heroFigure('hero', { hero: HERO }, { cel: true }), heroFigure('hero', { hero: HERO })]);
    const parts = cel.parts.filter(Boolean), stepped = parts.filter((p) => p.colS);
    expect(cel.toon).toBe(true);
    expect(stepped.length).toBeGreaterThan(parts.length * 0.8);
    for (const p of stepped) { expect(p.colS).not.toBe(p.col); expect(Buffer.from(p.colS, 'base64').length).toBe(Buffer.from(p.col, 'base64').length); }
    expect(baked.toon).toBeUndefined();
    expect(baked.parts.some((p) => p && p.colS)).toBe(false);
  }, 120000);
  // (FIT, a body's `fit: { least, from? }`: drawn at least that tall by its figure's own bounds, its egg and collider with
  // it, never shrunk under where it stood; the word gone from the page)
  it('a body fit to a height: its figure\'s bounds set its scale, egg and collider', async () => {
    const fit = (least) => resolveWorldScene({ manifest: { kind: 'controllable', faces: [{ corners: [[-2, -2, 0], [2, -2, 0], [2, 2, 0], [-2, 2, 0]], normal: [0, 0, 1], fill: '#888888' }], figures: { h: { hero: HERO } }, entities: [{ id: 'f', team: 'foes', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'static', collideHeight: 0.5 }, body: { type: 'figure-rig', figure: 'h', scale: 0.2, fit: { least, from: 0.2 } } }] } }).then((r) => r.payload.entities.find((e) => e.id === 'f'));
    const [up, held] = await Promise.all([fit(3), fit(0.1)]);
    expect(up.rule.collideHeight).toBeCloseTo(3, 2);
    expect(up.body.egg.c * 2).toBeCloseTo(3, 2);
    expect(up.body.scale).toBeGreaterThan(1.5);
    expect(up.body.fit).toBeUndefined();
    expect(held.body.scale).toBeCloseTo(0.2, 6);
  }, 120000);
  // (a MODE's own size, `body.modes[k].body.fit`: the form it becomes stood at that height by its own figure's bounds,
  // grown or shrunk, its scale its own; the word gone from the page)
  it('a mode fit to a height: its own figure\'s bounds set its own scale, the body it starts in untouched', async () => {
    const { payload } = await resolveWorldScene({ manifest: { kind: 'controllable', faces: [{ corners: [[-2, -2, 0], [2, -2, 0], [2, 2, 0], [-2, 2, 0]], normal: [0, 0, 1], fill: '#888888' }], figures: { h: { hero: HERO }, g: { hero: HERO } },
      entities: [{ id: 'f', team: 'foes', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'static' }, body: { type: 'figure-rig', figure: 'h', scale: 1.6, modes: [{ figure: 'h', hp: 10 }, { figure: 'g', hp: 10, body: { radius: 0.5, fit: { least: 0.9 } } }] } }] } });
    const e = payload.entities.find((x) => x.id === 'f'), [M1, M2] = e.body.modes;
    expect(e.body.scale).toBe(1.6);
    expect(M1.body).toBeUndefined();
    expect(M2.body.fit).toBeUndefined();
    expect(M2.body.radius).toBe(0.5);
    expect(M2.body.scale).toBeGreaterThan(0.2); expect(M2.body.scale).toBeLessThan(1);
  }, 120000);
    // (a boss's SIGNAL, its eyes and its glow: a fourth bake marks its corners, `sigM`, the page lighting them by its tell;
  // a body with no signal marks none)
  it('a boss\'s signal marked on its corners; the hero, with none, none', async () => {
    const [boss, hero] = await Promise.all([heroFigure('b', { hero: bossSpec('crucible') }, { cel: true }), heroFigure('hero', { hero: HERO }, { cel: true })]);
    const marked = boss.parts.filter((p) => p && p.sigM);
    expect(marked.length).toBeGreaterThan(0);
    const m = Buffer.from(marked[0].sigM, 'base64');
    expect(m.some((v) => v === 255)).toBe(true);
    expect(m.some((v) => v === 0)).toBe(true);
    expect(hero.parts.some((p) => p && p.sigM)).toBe(false);
  }, 240000);
});
