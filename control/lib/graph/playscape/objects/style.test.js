/**
 * Shape styles: the realistic recipe passed through a resizer and a warp, fitted back into its own space. The space and
 * the play never change; the outline flares by straight lines (a narrow foot, a wide shoulder, a pointed head); every
 * law still holds on the styled build; a seed makes it a recipe.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { resolveStyled, styleObject, SHAPE_STYLES } from './style.js';
import { objectMeasures, objectAdvice, frontSilhouette } from './measures.js';
import { DOOR, DOOR_FORMS } from './door.js';

const FIT = { width: 1.4, height: 2.6 };
const box = (fs) => [0, 1, 2].map((k) => [Math.min(...fs.flatMap((f) => f.corners.map((c) => c[k]))), Math.max(...fs.flatMap((f) => f.corners.map((c) => c[k])))]);

describe('the isekai shape', () => {
  it('leaves a realistic object as it is', () => {
    const o = resolveObject({ archetype: 'door', form: 'plank', fit: FIT });
    expect(styleObject(o, 'realistic')).toBe(o);
  });

  for (const form of Object.keys(DOOR_FORMS)) for (const state of DOOR.states) for (const seed of [1, 2, 3]) {
    it(`a ${form} door, ${state}, seed ${seed}: the same space, every law in band`, () => {
      const real = resolveObject({ archetype: 'door', form, fit: FIT, state });
      const st = resolveStyled({ archetype: 'door', form, fit: FIT, state }, 'isekai', { seed });
      box(real.faces).forEach((b, k) => { expect(box(st.faces)[k][0]).toBeCloseTo(b[0], 4); expect(box(st.faces)[k][1]).toBeCloseTo(b[1], 4); });
      expect(objectAdvice(objectMeasures(st.faces, st.frame, st.interest), st.interest)).toEqual([]);
    });
  }

  it('plays the same: its params, frame and states are the realistic door\'s', () => {
    const real = resolveObject({ archetype: 'door', form: 'plank', fit: FIT });
    const st = resolveStyled({ archetype: 'door', form: 'plank', fit: FIT }, 'isekai', { seed: 2 });
    expect(st.params).toEqual(real.params);
    expect(st.frame).toEqual(real.frame);
    expect(st.style).toEqual({ shape: 'isekai', seed: 2 });
  });

  it('flares by straight lines: the foot narrower than the shoulder, the head narrowing to a point', () => {
    const st = resolveStyled({ archetype: 'door', form: 'plank', fit: FIT }, 'isekai', { seed: 1 });
    const s = frontSilhouette(st.faces, st.frame, 'interactable');
    const widthAt = (t) => { const y = Math.round(1 + t * (s.H - 3)); let n = 0; for (let x = 0; x < s.W; x++) n += s.mask[y * s.W + x]; return n; };
    const foot = widthAt(0.05), shoulder = widthAt(0.62), head = widthAt(0.95);
    expect(shoulder).toBeGreaterThan(foot * 1.12);
    expect(head).toBeLessThan(shoulder * 0.6);
  });

  it('is a recipe: the same seed builds the same bytes, another seed another door', () => {
    const a = resolveStyled({ archetype: 'door', form: 'slab', fit: FIT }, 'isekai', { seed: 7 });
    const b = resolveStyled({ archetype: 'door', form: 'slab', fit: FIT }, 'isekai', { seed: 7 });
    const c = resolveStyled({ archetype: 'door', form: 'slab', fit: FIT }, 'isekai', { seed: 8 });
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
    expect(JSON.stringify(a.faces)).not.toBe(JSON.stringify(c.faces));
  });

  it('names its styles and refuses one it does not hold, naming them', () => {
    expect(Object.keys(SHAPE_STYLES)).toEqual(['realistic', 'isekai']);
    expect(() => styleObject(resolveObject({ archetype: 'door', form: 'plank', fit: FIT }), 'cubist')).toThrow(/realistic, isekai/);
  });
});
