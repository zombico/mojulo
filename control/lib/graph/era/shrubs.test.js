import { describe, it, expect } from 'vitest';
import { placeShrubs, validateShrubs } from './shrubs.js';
import { natureSite } from './nature.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const st = ISEKAI_MEADOW, site = natureSite(st, 1), card = st.shrubs;

describe('shrubs: bushes through the meadow, in flower, in fruit or green', () => {
  const S = placeShrubs(card, true, site, {}, 1);

  it('is opt-in: no ask, no bushes', () => {
    expect(placeShrubs(card, undefined, site, {}, 1).elements).toEqual([]);
    expect(placeShrubs(card, false, site, {}, 1).elements).toEqual([]);
  });

  it('stands them by the trail, clear of it and of each other, and is a recipe', () => {
    expect(S.elements.length).toBeGreaterThan(card.n / 2);
    for (const e of S.elements) {
      const off = site.trailDist(e.x, e.y) - site.halfWAt(e.y);
      expect(off).toBeGreaterThan(0.5); expect(off).toBeLessThan(card.band[1] + 3);
    }
    for (const a of S.elements) for (const b of S.elements) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(card.gap);
    expect(JSON.stringify(placeShrubs(card, true, site, {}, 1).anchors)).toBe(JSON.stringify(S.anchors));
  });

  it('a bush in flower carries blooms, one in fruit berries, a green one neither', () => {
    const has = (e, part) => e.design.faces.some((f) => f.part === part);
    for (const st of ['bloom', 'fruit', 'green']) expect(S.elements.some((e) => e.state === st), st).toBe(true);
    for (const e of S.elements) {
      expect(has(e, 'bloom')).toBe(e.state === 'bloom');
      expect(has(e, 'fruit')).toBe(e.state === 'fruit');
    }
    const all = placeShrubs(card, { fruit: 1, bloom: 0 }, site, {}, 1);
    expect(all.elements.every((e) => e.state === 'fruit')).toBe(true);
    expect(placeShrubs(card, { count: 3 }, site, {}, 1).elements.length).toBeLessThanOrEqual(3);
  });

  it('a bush over a step is a collider and an anchor', () => {
    expect(S.anchors).toHaveLength(S.elements.length);
    expect(S.colliders.length).toBe(S.elements.filter((e) => !e.soft).length);
  });

  it('names a bad ask', () => {
    expect(validateShrubs({ count: 4, bloom: 0.5 })).toEqual([]);
    expect(validateShrubs({ bloom: 0.8, fruit: 0.5 })[0]).toMatch(/at most 1/);
    expect(validateShrubs({ hedge: 1 })[0]).toMatch(/must be/);
  });
});
