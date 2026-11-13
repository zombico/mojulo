import { describe, expect, it } from 'vitest';
import { courseMap, courseMapHtml } from './course-map.js';
import { courseOf, playCourse, PRIMITIVES } from './roll-course.js';
import { practiceHtml } from './practice-room-page.js';
import { rhythmFaults } from '../era/wall-rhythm.js';
import { feelRule } from './feel/lower.js';
import { POLES } from './feel/cards.js';

// THE COURSE MAP: a running game's course from above, on its side, read left to right like a line of text.
const poles = Object.keys(POLES);
const MOMENTUM = poles.find((p) => POLES[p].base === 'pinball'), FOOT = poles.find((p) => !feelRule(p).airJumps && feelRule(p).jumpSpeed < 4);
const C = courseOf({ feel: MOMENTUM });
const xs = (svg, re) => [...svg.matchAll(re)].map((m) => Number(m[1]));

describe('the map', () => {
  const M = courseMap(C, { seed: 1, title: 'Dash' });
  it('draws the roll it is asked for: one ask a segment, in the order they are met, each in its role\'s colour', () => {
    expect(M.asks).toEqual(playCourse(C, { seed: 1 }).asks);
    expect(M.asks).toHaveLength(C.slots.length);
    for (const [k, id] of M.asks.entries()) expect(M.svg).toContain(`<tspan font-weight="600">${k + 1}</tspan> · ${{ hurdle: 'hurdle', block: 'block', 'posts-left': 'posts, left open', 'posts-right': 'posts, right open' }[id]}`);
    const col = C.dress.palette, count = (c) => M.svg.split(`fill="${c}" stroke="#2b2a27" stroke-width="0.8"`).length - 1;
    expect(count(col.jump)).toBe(M.asks.filter((a) => a === 'hurdle').length);
    expect(count(col.jump2)).toBe(M.asks.filter((a) => a === 'block').length);
    expect(count(col.steer)).toBe(M.asks.filter((a) => PRIMITIVES[a].ask === 'steer').length);
    // another roll, another map
    expect(courseMap(C, { seed: 2 }).asks).not.toEqual(M.asks);
    expect(courseMap(C, { seed: 1, title: 'Dash' }).svg).toBe(M.svg);
  });

  it('reads left to right, a row at a time: a few segments a row, and within a row each ask is right of the last', () => {
    expect(M.rows).toBe(Math.ceil(C.slots.length / 5));
    expect(courseMap(C, { perRow: 10 }).rows).toBe(1);
    // every row begins at the left margin, and the ruler says metres and seconds at the hero's top speed
    expect(M.svg).toContain('>0 m</text>');
    expect(M.svg).toContain(`>${Math.round((10 / C.pace.top) * 10) / 10} s</text>`);
    expect(M.svg).toMatch(/run it left to right, a row at a time/);
    expect(M.svg).toMatch(/a lane is a place to be, drawn as a guide, not a thing on the ground/);
  });

  it('its flanks are cells, one a segment a side, lettered by the walls\' rule; the two sides differ', () => {
    for (const side of ['left', 'right']) {
      expect(M.flanks[side]).toHaveLength(C.slots.length);
      expect(M.flanks[side]).toMatch(/^[AB]+$/);
      expect(rhythmFaults(M.flanks[side])).toEqual([]);
    }
    expect(M.flanks.left).not.toBe(M.flanks.right);
    expect(M.svg.split('font-weight="600" fill="#55604a"').length - 1).toBe(2 * C.slots.length);
  });

  it('a run is drawn through it: on the ground and, over each thing jumped, in the air', () => {
    expect(M.svg).toMatch(/stroke="#b0303a" stroke-width="1\.6" stroke-linejoin="round"/);
    expect(M.svg).toMatch(/stroke="#b0303a" stroke-width="1\.6" stroke-dasharray="4 4"/);
    // a course of posts alone (a hero that jumps nothing) has no air to draw
    const onFoot = courseOf({ feel: FOOT });
    const none = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => courseMap(onFoot, { seed })).find((m) => m.asks.every((a) => PRIMITIVES[a].ask === 'steer'));
    if (none) expect(none.svg).not.toMatch(/stroke-dasharray="4 4"\/>\n<line x1/);
  });
});

describe('the book\'s page', () => {
  it('a map a roll, and the roll room serves it for a hero that has a course', async () => {
    const html = courseMapHtml(C, { seeds: [1, 2, 3], title: 'Dash' });
    expect(html.split('<svg ').length - 1).toBe(3);
    expect(html).toContain('<title>Dash · course map</title>');
    const P = await practiceHtml({ id: 'g', name: 'Dash', feel: MOMENTUM, roll: true }, 'roll', { view: 'map' });
    expect(P.html).toContain('Dash: the course map');
    await expect(practiceHtml({ id: 'g', feel: FOOT, roll: true }, 'roll', { view: 'map' })).rejects.toThrow(/the course map is a running game's/);
  });
});
