/**
 * The isolation proof (field-splats.plan.md phase 4).
 *
 * A coat is PRESENTATION. It declares no surface, so adding one must not move a single
 * byte of what mojulo fabricates or promises: not the mesh, not the print file, not the
 * GLB, not the world-contract tier. These are the tests that make "a coat cannot break a
 * print" a fact rather than an intention — if a later change lets splats leak into the
 * printable set or the tier ladder, this is what fails.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { assembleAnimalScene } from '../figures/figure-world.js';
import { facesToStl } from '../scene/scene-stl.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { assessWorldTier } from '../worlds/world-contract.js';

const BASE = { kind: 'animal', archetype: 'canine', view: 'three-quarter' };
const PAINT = { ...BASE, opts: { skin: 'watertight', coat: { color: '#a8825f' } } };
const FUR = { ...BASE, opts: { skin: 'watertight', coat: { color: '#a8825f', fur: { depth: 0.055, layers: 4, tipColor: '#5e3f24' } } } };

const sha = (b) => createHash('sha256').update(Buffer.isBuffer(b) ? b : JSON.stringify(b)).digest('hex');

describe('a coat changes nothing mojulo fabricates', () => {
  const paint = assembleAnimalScene(PAINT, {});
  const fur = assembleAnimalScene(FUR, {});

  it('the coat is actually present (else every test below is vacuous)', () => {
    expect(paint.splats).toBeUndefined();
    expect(Array.isArray(fur.splats)).toBe(true);
    expect(fur.splats.length).toBeGreaterThan(1000);
  });

  it('the FACES are byte-identical', () => {
    expect(fur.faces.length).toBe(paint.faces.length);
    expect(sha(fur.faces)).toBe(sha(paint.faces));
  });

  it('the STL printable set is byte-identical', () => {
    const a = facesToStl(paint, { scale: 1 }), b = facesToStl(fur, { scale: 1 });
    expect(a).toBeTruthy();
    expect(sha(b.buffer ?? b.stl ?? b)).toBe(sha(a.buffer ?? a.stl ?? a));
    expect(b.bounds).toEqual(a.bounds);
  });

  it('the GLB is byte-identical', () => {
    expect(sha(facesToGlb(fur))).toBe(sha(facesToGlb(paint)));
  });

  it('the world-contract tier is unmoved', () => {
    const a = assessWorldTier(paint), b = assessWorldTier(fur);
    expect(b.tier).toBe(a.tier);
    expect(b.next).toBe(a.next);
    expect(b.missing_for_next).toEqual(a.missing_for_next);
  });

  it('every other payload key is untouched — only `splats` is added', () => {
    const added = Object.keys(fur).filter((k) => !(k in paint));
    const removed = Object.keys(paint).filter((k) => !(k in fur));
    expect(added).toEqual(['splats']);
    expect(removed).toEqual([]);
  });
});
