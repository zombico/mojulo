// The scales: the size of the thing an exhibit shows, the human point of view the base. The exhibit determines its
// scale; a concept that spans rungs is a room a rung, and the visitor zooms between them.
import { describe, it, expect } from 'vitest';
import { SCALES, SCALE_IDS, HOME_SCALE, readScales, scaleReport } from './scales.js';
import { TOUR_SHAPES } from './tour.js';
import { exhibitStart } from './producer.js';
import { exhibitFit } from './fit.js';
import { OBJECT_SIZES } from '../shoot/frame.js';
import { ANGLES } from '../shoot/framing.js';
import { MOVES } from '../shoot/moves.js';

const ladder = SCALE_IDS.filter((s) => SCALES[s].rung !== null), beside = SCALE_IDS.filter((s) => SCALES[s].rung === null), off = beside[0];
const below = ladder.find((s) => SCALES[s].rung < 0), above = ladder.find((s) => SCALES[s].rung > 0);

describe('the scales', () => {
  it('are a ladder round the human base, smallest first, its two ends conceptual; a place in history and an idea beside it', () => {
    expect(SCALES[HOME_SCALE].rung).toBe(0);
    expect(ladder.map((s) => SCALES[s].rung)).toEqual([...ladder.map((s) => SCALES[s].rung)].sort((a, b) => a - b));
    expect(new Set(ladder.map((s) => SCALES[s].rung)).size).toBe(ladder.length);
    expect(SCALES[ladder[0]].conceptual).toBe(true); expect(SCALES[ladder[ladder.length - 1]].conceptual).toBe(true); expect(SCALES[HOME_SCALE].conceptual).toBeUndefined();
    // (what has no rung comes after the ladder; the historical views' cultures are named as its primitives)
    expect(SCALE_IDS.slice(ladder.length)).toEqual(beside); expect(beside).toEqual(expect.arrayContaining(['history', 'idea']));
    expect(SCALES.history.made).toMatch(/cultures are the primitives/); expect(SCALES.history.samples.every((x) => x.startsWith('history/'))).toBe(true);
    expect(ladder.flatMap((s) => SCALES[s].samples).some((x) => x.startsWith('history/'))).toBe(false);
    for (const id of SCALE_IDS) {
      const S = SCALES[id];
      expect(S.says).toMatch(/\S/); expect(S.made).toMatch(/\S/); expect(S.samples.length).toBeGreaterThan(0);
      for (const sh of S.shows) expect(TOUR_SHAPES, `${id}: ${sh}`).toContain(sh);
      for (const x of S.samples) expect(x).toMatch(/^[a-z]+\/[a-z0-9-]+$/);
    }
  });

  it('reads the rungs as the agent names them, the home first, none twice', () => {
    expect(readScales(HOME_SCALE)).toEqual([HOME_SCALE]); expect(readScales([above, HOME_SCALE])).toEqual([above, HOME_SCALE]);
    expect(() => readScales(['cosmic'])).toThrow(/rungs the concept lives at/);
    expect(() => readScales([])).toThrow(/rungs the concept lives at/);
    expect(() => readScales([HOME_SCALE, HOME_SCALE])).toThrow(/a rung is one room/);
  });

  it('says what a rung shows and how it is made; a concept that spans rungs zooms between its rooms', () => {
    const one = scaleReport([HOME_SCALE]);
    expect(one).toMatchObject({ home: HOME_SCALE, spans: false, zoom: [] }); expect(one.rungs[0]).toMatchObject({ id: HOME_SCALE, made: SCALES[HOME_SCALE].made });
    expect(one.says).toContain(SCALES[HOME_SCALE].name);
    const R = scaleReport([above, HOME_SCALE, below, off]);
    expect(R.home).toBe(above); expect(R.spans).toBe(true); expect(R.rungs.map((r) => r.id)).toEqual([above, HOME_SCALE, below, off]);
    expect(R.zoom.map(({ move: _m, ...z }) => z)).toEqual([
      { from: above, to: HOME_SCALE, way: 'in', steps: SCALES[above].rung },
      { from: HOME_SCALE, to: below, way: 'in', steps: -SCALES[below].rung },
      { from: below, to: off, way: 'aside', steps: 0 },
    ]);
    expect(scaleReport([below, HOME_SCALE]).zoom[0].way).toBe('out');
    expect(R.says).toMatch(/spans 4 scales, a room each/);
    // a fresh read: changing it changes no table
    R.rungs[0].samples.push('x'); expect(SCALES[above].samples).not.toContain('x');
  });

  it('speaks the camera\'s own words: a rung\'s opening view, and the named move between two rooms', () => {
    const sizes = OBJECT_SIZES.map((x) => x.id), angles = ANGLES.map((x) => x.id), moves = MOVES.map((x) => x.id);
    for (const id of SCALE_IDS) { expect(sizes, `${id}: size`).toContain(SCALES[id].view.size); expect(angles, `${id}: angle`).toContain(SCALES[id].view.angle); }
    // the macro is the bigger view from above; the base is met at eye level
    expect(SCALES.macro.view.angle).not.toBe('eye'); expect(SCALES[HOME_SCALE].view.angle).toBe('eye');
    expect(sizes.indexOf(SCALES.macro.view.size)).toBeGreaterThan(sizes.indexOf(SCALES[HOME_SCALE].view.size));
    const z = (a, b) => scaleReport([a, b]).zoom[0];
    for (const [a, b] of [[HOME_SCALE, below], [below, HOME_SCALE], [HOME_SCALE, 'macro'], ['macro', HOME_SCALE]]) expect(moves, `${a}→${b}`).toContain(z(a, b).move);
    // up to a view from above is the boom, down from one too; between eye-level rooms the dolly
    expect(z(HOME_SCALE, 'macro').move).toBe('crane_up'); expect(z('macro', HOME_SCALE).move).toBe('crane_down');
    expect(z(HOME_SCALE, below).move).toBe('push_in'); expect(z(below, HOME_SCALE).move).toBe('pull_out');
    expect(z(HOME_SCALE, off).move).toBeUndefined();
    expect(scaleReport(['macro']).rungs[0].view).toEqual(SCALES.macro.view);
  });

  it('in the start: the agent names the scale, never the person; rungs become rooms and the map says the zoom', () => {
    const asked = exhibitStart({ concept: 'a dam' });
    expect(asked.next[0]).toMatchObject({ step: 'scale', rungs: SCALE_IDS }); expect(asked.next[0].ask).toBeUndefined(); expect(asked.scale).toBeUndefined();
    expect(exhibitStart({}).next.map((x) => x.step)).not.toContain('scale');
    const one = exhibitStart({ concept: 'a dam', scales: [above], time: 'visit' });
    expect(one.scale).toEqual(scaleReport([above])); expect(one.next.map((x) => x.step)).not.toContain('scale');
    expect(one.fit).toEqual(exhibitFit({ time: 'visit' }));
    expect(one.map).toMatchObject({ rooms: [{ at: above, stops: one.fit.stops.about }] }); expect(one.map.zoom).toBeUndefined(); expect(one.map.form).toMatch(/one page/);
    const span = exhibitStart({ concept: 'a dam', scales: [above, HOME_SCALE, below], time: 'visit' });
    expect(span.fit).toEqual(exhibitFit({ time: 'visit', wants: { rooms: 3 } })); expect(span.fit.size).toBe('gallery');
    expect(span.map.rooms.map((r) => r.at)).toEqual([above, HOME_SCALE, below]); expect(span.map.zoom).toEqual(span.scale.zoom); expect(span.map.form).toMatch(/spine/);
    // their own count of rooms wins over the rungs
    expect(exhibitStart({ concept: 'a dam', scales: [above, HOME_SCALE], time: 'visit', wants: { rooms: 4 } }).fit.rooms).toBe(4);
    expect(exhibitStart({ concept: 'a dam', scales: [above] }).map).toBeUndefined();
    expect(() => exhibitStart({ scales: ['cosmic'] })).toThrow(/create_exhibit: start\.scales/);
  });
});
