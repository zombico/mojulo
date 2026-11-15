/**
 * The cast's response (color-theorist/cast-response.js): a body's materials told apart by how they answer the light,
 * from its palette's own groups. The concept, on one palette: each kind of group takes its class, an unknown one is
 * cloth, a metal is the only metal, and the table the page reads carries each colour once.
 */
import { describe, expect, it } from 'vitest';

import { RESPONSES, responseOf, castResponse } from './cast-response.js';

describe('the cast\'s response', () => {
  it('classes a group by what its name says, cloth where it says nothing', () => {
    expect(responseOf('Skin')).toBe('skin');
    expect(responseOf('Lid')).toBe('skin');
    expect(responseOf('HairAlt')).toBe('hair');
    expect(responseOf('Iris')).toBe('eye');
    expect(responseOf('Iron')).toBe('metal');
    expect(responseOf('Shoes')).toBe('leather');
    expect(responseOf('Top')).toBe('cloth');
    expect(responseOf(undefined)).toBe('cloth');
  });
  it('only a metal is metal, and an eye is the smoothest thing on a body', () => {
    for (const [k, R] of Object.entries(RESPONSES)) expect(R.metal, k).toBe(k === 'metal' ? 1 : 0);
    expect(Math.min(...Object.values(RESPONSES).map((R) => R.rough))).toBe(RESPONSES.eye.rough);
    expect(RESPONSES.cloth.rough).toBeGreaterThan(RESPONSES.skin.rough);
  });
  it('gives the page each colour once, with how it answers, in bytes', () => {
    const T = castResponse({ Skin: '#d9a77e', Top: '#3d6fa8', Iron: '#8d9197', Brow: '#3b291e', Hair: '#3b291e', bad: 'blue' });
    expect(T).toHaveLength(4);
    expect(T[0]).toEqual([0xd9, 0xa7, 0x7e, Math.round(RESPONSES.skin.rough * 255), 0]);
    expect(T[2].slice(3)).toEqual([Math.round(RESPONSES.metal.rough * 255), 255]);
    // (two groups of one colour: the first's class)
    expect(T[3].slice(3)).toEqual([Math.round(RESPONSES.hair.rough * 255), 0]);
    expect(castResponse(null)).toEqual([]);
  });
});
