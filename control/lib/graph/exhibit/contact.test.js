// A tour's contact sheet: a row a stop, as a visitor meets it. The page seats and measures each stop; this lays the
// rows from the tour and the page's reading, and names how much of the view the lit part fills in the camera's words.
import { describe, it, expect } from 'vitest';
import { sizeWord, tourContactRows, MAX_STOPS } from './contact.js';
import { auditStops, FRAMED } from './page-audit.js';
import { holdSeconds } from './audit.js';
import { OBJECT_SIZES } from '../shoot/frame.js';
import { exhibitStart } from './producer.js';

const tour = { stops: [
  { id: 'whole', title: 'The whole of it', caption: 'Here is the thing, whole.', camera: 'main', highlight: ['body'] },
  { id: 'part', caption: 'And here is the part that matters most to us.', camera: { frame: 'part' }, highlight: ['part', 'gear'] },
  { id: 'free', caption: 'Look round.', camera: 'main' },
] };
// a page as the audit reads it: each stop seated, its view answered from a table
const page = (views) => { let at = 0; return async (fn, arg) => { const src = String(fn); if (src.includes('.count')) return views.length; if (src.includes('.go(')) { at = arg; return null; } return { at, ...views[at] }; }; };

describe('a tour\'s contact sheet', () => {
  it('names how much of the view a lit part fills in the camera\'s own words', () => {
    const names = OBJECT_SIZES.map((s) => s.name);
    for (const share of [0, 0.05, 0.2, 0.6, 1]) expect(names).toContain(sizeWord(share));
    expect(names.indexOf(sizeWord(0.6))).toBeLessThan(names.indexOf(sizeWord(0.05)));
    expect(sizeWord(0)).toBe(OBJECT_SIZES[OBJECT_SIZES.length - 1].name);
    expect(sizeWord(undefined)).toBeNull(); expect(sizeWord(-1)).toBeNull();
  });

  it('the audit can hand each seated stop to a caller: the frame is shot there, in order', async () => {
    const seen = [];
    const A = await auditStops(page([{ id: 'whole', onScreen: 1, share: 0.5 }, { id: 'part', onScreen: 0.4, share: 0.3 }, { id: 'free', framed: null }]), { each: async (i) => seen.push(i) });
    expect(seen).toEqual([0, 1, 2]); expect(A.stops).toHaveLength(3);
    // without it the audit is as it was
    expect((await auditStops(page([{ id: 'whole', onScreen: 1, share: 0.5 }]))).stops[0]).toMatchObject({ id: 'whole', framed: true });
  });

  it('lays a row a stop: what it is about, the size under its frame, the page\'s findings beside it, its hold', async () => {
    const A = await auditStops(page([{ id: 'whole', onScreen: 1, share: 0.5 }, { id: 'part', onScreen: FRAMED.onScreen / 2, share: 0.3 }, { id: 'free', framed: null }]));
    const R = tourContactRows(tour, A);
    expect(R).toHaveLength(3);
    expect(R[0]).toMatchObject({ shot: '1 The whole of it', about: 'body', notes: [] });
    expect(R[0].frames).toEqual([{ at: 'held', world_t: holdSeconds(tour.stops[0].caption), size: sizeWord(0.5) }]);
    expect(R[1]).toMatchObject({ shot: '2 part', about: 'part, gear', notes: ['off-frame'] });
    // a stop that lights nothing is not measured: no size, and it says so
    expect(R[2].about).toBeUndefined(); expect(R[2].frames[0].size).toBeUndefined(); expect(R[2].notes).toEqual(['lights-nothing']);
    for (const r of R) { expect(r.frames).toHaveLength(1); expect(r.shot.length).toBeLessThan(40); }
  });

  it('a long title is cut to the row\'s head, a long tour to the sheet, and a tour with no reading still lays out', () => {
    const long = { stops: [{ id: 'a', title: 'A very long title that would run off the edge of one frame', caption: 'x' }] };
    expect(tourContactRows(long, null)[0].shot).toMatch(/…$/);
    const many = { stops: Array.from({ length: MAX_STOPS + 3 }, (_, i) => ({ id: `s${i}`, caption: 'x' })) };
    expect(tourContactRows(many, null)).toHaveLength(MAX_STOPS);
    expect(tourContactRows(null, null)).toEqual([]);
  });

  it('is a step of the hand-off for a toured exhibit, before the person looks', () => {
    const steps = (s) => exhibitStart({ concept: 'a dam', people: ['general'], brought: 'none', ...s }).next.find((x) => x.step === 'make').steps.map((x) => x.step);
    const toured = steps({ time: 'visit' });
    expect(toured.indexOf('sheet')).toBe(toured.indexOf('show') - 1); expect(toured.indexOf('audit')).toBeLessThan(toured.indexOf('sheet'));
    expect(steps({ time: 10 })).not.toContain('sheet');
  });
});
