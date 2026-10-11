import { describe, it, expect } from 'vitest';
import { DEGREES, readDegree, classOf, breaksUnder, breakablesOf } from './breakability.js';
import { assembleStageScene } from '../../era/stage.js';
import { starter } from '../../era/entries.js';
import { composeLive } from '../../worlds/controllable/compose.js';

const gothic = assembleStageScene({ ...starter('gothic-stone') });

describe('breakability: a convention by degree, never a default', () => {
  it('reads a degree, and nothing breaks without one', () => {
    expect(readDegree(undefined)).toBeNull();
    expect(readDegree('objects')).toBe('objects');
    expect(() => readDegree('lots')).toThrow(/none, objects, cover, world/);
    expect(breakablesOf(gothic, null)).toBeNull();
    expect(breakablesOf(gothic, 'none')).toBeNull();
    // each degree breaks what the one below it does, and more
    expect(DEGREES.objects.every((c) => DEGREES.cover.includes(c))).toBe(true);
    expect(DEGREES.cover.every((c) => DEGREES.world.includes(c))).toBe(true);
  });

  it('a thing\'s class is the name it already has; its own word wins over the degree', () => {
    expect(classOf({ kind: 'doodad', form: 'crate' })).toBe('crate');
    expect(classOf({ kind: 'part', name: 'lid', of: 'set-piece' })).toBe('lid');
    expect(classOf({ kind: 'set-piece', form: 'tomb' })).toBe('set-piece');
    expect(breaksUnder('objects', 'crate')).toBe(true);
    expect(breaksUnder('objects', 'boulder')).toBe(false);
    expect(breaksUnder('cover', 'boulder')).toBe(true);
    expect(breaksUnder('objects', 'crate', false)).toBe(false);
    expect(breaksUnder('none', 'set-piece', true)).toBe(true);
  });

  it('the action default on a gothic stage: crates, barrels and the lid break; the tomb, the boulders and the walls hold', () => {
    const r = breakablesOf(gothic, 'objects');
    const classes = new Set(r.things.map((t) => t.class));
    expect([...classes].sort()).toEqual(['barrel', 'crate', 'lid']);
    // each became a block with its collider's box, and left the collider list
    for (const b of r.breakables) {
      expect(gothic.colliders.some((c) => c.of === b.id && c.min.join() === b.min.join())).toBe(true);
      expect(r.colliders.some((c) => c.of === b.id)).toBe(false);
    }
    expect(r.colliders.filter((c) => c.of.startsWith('wall:')).length).toBe(gothic.colliders.filter((c) => c.of.startsWith('wall:')).length);
    // its faces are their own render group, so the page can hide what broke; nothing else moved
    const crate = r.breakables.find((b) => b.id.startsWith('crate'));
    expect(r.faces.filter((f) => f.node === crate.id).every((f) => f.group === `break:${crate.id}`)).toBe(true);
    const ids = new Set(r.things.map((t) => t.id));
    expect(r.faces.length).toBe(gothic.faces.length);
    expect(r.faces.every((f, i) => (f && ids.has(f.node)) || f === gothic.faces[i])).toBe(true);
    // ankle clutter blocks nothing and stays as it is, said
    expect(r.skipped.some((s) => s.class === 'planks' && /no collider/.test(s.why))).toBe(true);
    expect(gothic.faces.filter((f) => f.node === crate.id).every((f) => !f.group.startsWith('break:'))).toBe(true);   // pure
    // the cover degree adds the tomb's neighbours that are named; a pooled rock is not named on its faces yet
    const cover = breakablesOf(gothic, 'cover');
    expect(cover.skipped.some((s) => s.class === 'boulder' && /not named/.test(s.why))).toBe(true);
  });

  it('a sword breaks a crate in the runtime, and the crate no longer blocks', () => {
    const r = breakablesOf(gothic, 'objects'), crate = r.breakables.find((b) => b.id.startsWith('crate'));
    const cx = (crate.min[0] + crate.max[0]) / 2, cy = (crate.min[1] + crate.max[1]) / 2, half = (crate.max[0] - crate.min[0]) / 2;
    const CW = composeLive();
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee', strikeReach: 1.2, strikeDur: 0.3 }, transform: { pos: [cx - half - 0.8, cy, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const w = CW.createWorld({ entities: [hero], colliders: r.colliders, breakables: r.breakables });
    expect(w.colliders.some((c) => c.of === crate.id)).toBe(true);
    for (let i = 0; i < 40; i++) CW.stepWorld(w, { fire: i < 2 }, 1 / 60, { ground: () => 0 });
    expect(w.breaks.map((b) => [b.id, b.how])).toContainEqual([crate.id, 'swing']);
    expect(w.colliders.some((c) => c.of === crate.id)).toBe(false);
  });
});

describe('a level that lets things break, end to end', () => {
  const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, strike: 'melee' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
  const level = (extra) => ({ manifest: { ...starter('gothic-stone'), entities: [hero], ...extra }, title: 'crypt' });

  it('a degree on the level hands the page its breakable things; without one the page is as it was', async () => {
    const { resolveWorldScene } = await import('../../worlds/world-scene.js');
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    const plain = (await resolveWorldScene(level({}))).payload;
    expect(plain.breakables).toBeUndefined();
    expect(emitThreeWorld(plain)).not.toContain('__updateBreaks');
    for (const extra of [{ destruction: 'objects' }, { destruction: 'cover' }]) {
      const { payload } = await resolveWorldScene(level(extra));
      expect(payload.breakables.length, JSON.stringify(extra)).toBeGreaterThan(0);
      const html = emitThreeWorld(payload);
      expect(html).toContain('breakables: [{"id":"');
      expect(html).toContain('__updateBreaks();');
      expect(html).toMatch(/"name":"break:crate-1"/);
    }
    expect((await resolveWorldScene(level({ destruction: 'none' }))).payload.breakables).toBeUndefined();
    await expect(resolveWorldScene(level({ destruction: 'lots' }))).rejects.toThrow(/none, objects, cover, world/);
  }, 120000);
});
