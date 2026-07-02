process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { mintControllableWorld } from './scene-controllable.js';

beforeEach(() => { closeDb(); });

const drone = { id: 'drone', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [1, 1, 0.4], color: '#ff7a59' }, transform: { pos: [0, 0, 3] } };

describe('create_controllable_world mint', () => {
  it('stores a kind:controllable recipe and returns the world URL', () => {
    const out = mintControllableWorld({ title: 'drone test', entities: [drone], camera: { rule: 'follow', target: 'drone' } });
    expect(out.ok).toBe(true);
    expect(out.recipe.kind).toBe('controllable');
    expect(out.worldUrl).toBe(`/api/sketches/${encodeURIComponent(out.ref)}/world`);
    expect(out.stats.entities).toBe(1);
    expect(out.stats.rules).toEqual(['glide']);
    expect(out.stats.camera).toBe('follow');
    expect(out.stats.nonBakeable).toBe(true);
  });

  it('keeps the manifest a recipe — no baked geometry persisted', () => {
    const out = mintControllableWorld({ entities: [drone], figures: { male: { motion: 'walk', proto: 'male' } } });
    expect(out.recipe.figures.male).toEqual({ motion: 'walk', proto: 'male' });   // spec, not frames
    expect(out.recipe.faces).toBeUndefined();   // default floor built on render, not stored
  });

  it('requires at least one entity', () => {
    expect(() => mintControllableWorld({ entities: [] })).toThrow(/non-empty/);
    expect(() => mintControllableWorld({})).toThrow(/non-empty/);
  });

  it('mints a platformer character (the platform rule)', () => {
    const out = mintControllableWorld({
      title: 'platformer',
      entities: [{ id: 'hero', rule: { type: 'platform', jumpSpeed: 9, coyote: 0.12 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.2], color: '#6cf' }, transform: { pos: [0, 0, 2] } }],
      camera: { rule: 'follow', target: 'hero' },
    });
    expect(out.ok).toBe(true);
    expect(out.recipe.kind).toBe('controllable');
    expect(out.stats.rules).toEqual(['platform']);
  });

  it('rejects an unknown rule type', () => {
    expect(() => mintControllableWorld({ entities: [{ id: 'x', rule: { type: 'teleport' } }] })).toThrow(/unknown rule/);
  });

  it('rejects a figure-frames body that references an undeclared figure', () => {
    expect(() => mintControllableWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'ghost' } }] })).toThrow(/not declared in figures/);
  });

  it('rejects a camera target that is not an entity', () => {
    expect(() => mintControllableWorld({ entities: [drone], camera: { rule: 'follow', target: 'nope' } })).toThrow(/not an entity id/);
  });
});
