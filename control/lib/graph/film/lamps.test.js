import { describe, it, expect } from 'vitest';
import { LAMP_WORDS, POST, lampsLit, lampHeads, lampPosts } from './lamps.js';

// the set's lamps by the hour: found from the world's own form (a lamp's group), lit at night, dusk and dawn
const box = (x, y, z0, z1, group, w = 0.1) => [
  { group, corners: [[x - w, y - w, z0], [x + w, y - w, z0], [x + w, y - w, z1], [x - w, y - w, z1]] },
  { group, corners: [[x - w, y - w, z1], [x + w, y - w, z1], [x + w, y + w, z1], [x - w, y + w, z1]] },
];
const word = LAMP_WORDS[0];

describe('the set\'s lamps by the hour', () => {
  it('are lit at night, at dusk and at dawn, and dark by day', () => {
    expect(['night', 'dusk', 'dawn'].every(lampsLit)).toBe(true);
    expect(['day', 'interior', null, undefined].some(lampsLit)).toBe(false);
  });

  it('are found among a world\'s faces by their group\'s last word, the faces of one lamp those that stand together', () => {
    const P = { metersPerUnit: 2, faces: [...box(5, 5, 1, 4, `town:${word}`), ...box(20, 5, 1, 3, `town:${word}`), ...box(6, 6, 1, 9, 'town:wall'), ...box(5, 30, 1, 4, `${word}:shade`)] };
    const H = lampHeads(P, { floor: 1, about: [10, 10] });
    // (two lamps, in metres over the set's floor, the nearer first; a wall is no lamp, nor a group that only starts with the word)
    expect(H).toEqual([{ at: [10, 9.933, 7], h: 6 }, { at: [40, 9.933, 5], h: 4 }]);
    expect(lampHeads(P, { about: [10, 10], reach: 5 })).toHaveLength(1);
    expect(lampHeads(P, { about: [10, 10], most: 1 })).toHaveLength(1);
    expect(lampHeads(P, {})).toEqual([]);
  });

  it('are found among what a world lays by instancing: the template\'s head through each place, scale and turn', () => {
    // (a post with an arm reaching +x: its head is the arm's end)
    const template = [...box(0, 0, 0, 5, 'kit:metal'), ...box(1.5, 0, 4.8, 5, 'kit:metal')];
    const P = { repeats: [{ group: `city:${word}`, template, transforms: [{ pos: [10, 10, 0.5] }, { pos: [20, 10, 0], yaw: Math.PI / 2, scale: 2 }, { pos: [900, 900, 0] }] }, { group: 'city:tree', template, transforms: [{ pos: [11, 11, 0] }] }] };
    const H = lampHeads(P, { about: [12, 10] });
    expect(H).toHaveLength(2);
    expect(H[0].at[2]).toBe(5.5);
    expect(H[0].at[0]).toBeGreaterThan(10.5);
    // (turned a quarter and twice the size: the arm reaches +y, the head twice as high)
    expect(H[1].at[2]).toBe(10);
    expect(H[1].at[1]).toBeGreaterThan(11);
    expect(Math.abs(H[1].at[0] - 20)).toBeLessThan(0.3);
  });

  it('stand a light under each head, the same every time', () => {
    const P = { faces: box(5, 5, 0, 6, `x:${word}`) }, [L] = lampPosts(P, { about: [5, 5] });
    expect(L).toMatchObject({ watts: POST.watts, color: POST.color, radius: POST.radius });
    expect(L.at[2]).toBe(6 - POST.drop);
    expect(JSON.stringify(lampPosts(P, { about: [5, 5] }))).toBe(JSON.stringify(lampPosts(P, { about: [5, 5] })));
    expect(lampPosts({ faces: box(5, 5, 0, 6, 'x:wall') }, { about: [5, 5] })).toEqual([]);
  });
});
