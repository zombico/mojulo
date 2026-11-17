// The fit: what a person's time and people hold, said before anything is made. Its arithmetic is the tour's own, so a
// fit's stops played as the audit plays them fit the span they were called for.
import { describe, it, expect } from 'vitest';
import { EXHIBIT_SIZES, EXHIBIT_SIZE_IDS, TIMES, TIME_IDS, STOP, ROOM_SECONDS, readTime, exhibitFit } from './fit.js';
import { auditTour, holdSeconds } from './audit.js';
import { AUDIENCES, AUDIENCE_WORDS } from './brief.js';
import { TOUR_LIMITS } from './tour.js';
import { GALLERY_LIMITS } from './gallery.js';

// a tour of n stops, each a caption of `words` words, as the audit reads one
const tourOf = (n, words) => ({ stops: Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, caption: Array.from({ length: words }, () => 'word').join(' '), camera: { frame: `g${i}` }, highlight: [`g${i}`] })) });
const played = (n, words) => (n ? auditTour(tourOf(n, words)).seconds : 0);
// the words of a usual caption: the count whose hold is STOP.usual
const usual = Array.from({ length: 80 }, (_, i) => i).find((w) => holdSeconds(Array.from({ length: w }, () => 'word').join(' ')) >= STOP.usual);

describe('the fit', () => {
  it('reads how long people have: a word a person says, seconds, or minutes', () => {
    for (const k of TIME_IDS) { const T = readTime(k); expect(T.time).toBe(k); expect(T.seconds).toBeGreaterThanOrEqual(TIMES[k].seconds[0]); expect(T.seconds).toBeLessThan(TIMES[k].seconds[1]); }
    expect(readTime(45)).toEqual({ time: 'glance', seconds: 45 });
    expect(readTime({ minutes: 3 })).toEqual({ time: 'visit', seconds: 180 });
    expect(readTime({ seconds: 2400 })).toEqual({ time: 'sitting', seconds: 2400 });
    expect(readTime({ minutes: 600 }).time).toBe(TIME_IDS[TIME_IDS.length - 1]);
    expect(() => readTime('forever')).toThrow(/how long people have/);
    expect(() => readTime(0)).toThrow(/seconds/);
    expect(() => readTime({ minutes: 3, seconds: 5 })).toThrow(/seconds/);
  });

  it('a stop is held as the page holds it: the tour\'s own arithmetic', () => {
    expect(STOP.min).toBe(holdSeconds('')); expect(STOP.max).toBe(holdSeconds(Array.from({ length: 999 }, () => 'w').join(' ')));
    expect(STOP.min).toBeLessThan(STOP.usual); expect(STOP.usual).toBeLessThan(STOP.max);
  });

  it('calls the least size the time holds: one view, a tour, then rooms', () => {
    const sizes = TIME_IDS.map((k) => exhibitFit({ time: k }).size);
    expect(sizes.map((s) => EXHIBIT_SIZE_IDS.indexOf(s))).toEqual([...sizes.map((s) => EXHIBIT_SIZE_IDS.indexOf(s))].sort((a, b) => a - b));
    expect(exhibitFit({ time: STOP.usual }).size).toBe('view');
    expect(exhibitFit({ time: STOP.usual }).stops).toEqual({ min: 0, about: 1, max: 1 });
    const tour = exhibitFit({ time: { minutes: 2 } });
    expect(tour).toMatchObject({ size: 'tour', door: EXHIBIT_SIZES.tour.door, next: { size: 'gallery' } }); expect(tour.rooms).toBeUndefined();
    const wing = exhibitFit({ time: 'sitting' });
    expect(wing.size).toBe('gallery'); expect(wing.rooms).toBeGreaterThan(1); expect(wing.seconds / wing.rooms).toBeLessThanOrEqual(ROOM_SECONDS);
    // (a room's time is the edge: at it one tour, past it rooms)
    expect(exhibitFit({ time: ROOM_SECONDS }).size).toBe('tour'); expect(exhibitFit({ time: ROOM_SECONDS + 1 }).size).toBe('gallery'); expect(wing.next).toBeUndefined();
  });

  it('a fit\'s stops, played as the audit plays them, fit the time it was called for', () => {
    for (const seconds of [exhibitFit({ time: 'glance' }).seconds, ROOM_SECONDS, ROOM_SECONDS * 3, exhibitFit({ time: 'sitting' }).seconds]) {
      const F = exhibitFit({ time: seconds }), rooms = F.rooms ?? 1;
      if (F.size === 'view') continue;
      // about that many at a usual caption fills the span without running far past it; the most fit at the shortest
      expect(played(F.stops.about, usual) * rooms, `${seconds}s about`).toBeLessThanOrEqual(seconds);
      expect(played(F.stops.about, usual) * rooms, `${seconds}s about fills`).toBeGreaterThan(seconds * 0.6);
      expect(played(F.stops.max, 0) * rooms, `${seconds}s max`).toBeLessThanOrEqual(seconds);
      expect(F.stops.min).toBeLessThanOrEqual(F.stops.about); expect(F.stops.about).toBeLessThanOrEqual(F.stops.max);
      expect(F.stops.max).toBeLessThanOrEqual(TOUR_LIMITS.stops);
    }
  });

  it('people are a caption each at every stop: words to write, no time added', () => {
    const one = exhibitFit({ time: 180 }), two = exhibitFit({ time: 180, people: ['child'] }), all = exhibitFit({ time: 180, people: AUDIENCES });
    expect(one.audiences).toEqual(['general']); expect(two.audiences).toEqual(['child', 'general'].sort((a, b) => AUDIENCES.indexOf(a) - AUDIENCES.indexOf(b)));
    expect(two.stops).toEqual(one.stops); expect(all.stops).toEqual(one.stops);
    expect(two.says).toContain(AUDIENCE_WORDS.child.toLowerCase()); expect(one.says).not.toMatch(/ways/);
    expect(all.layers.study).toMatch(/in depth/); expect(one.layers.study).not.toMatch(/in depth/);
    expect(() => exhibitFit({ time: 180, people: ['everybody'] })).toThrow(/who it is for/);
  });

  it('what they want beyond a tour: settings to compare, or several subjects', () => {
    const cmp = exhibitFit({ time: 180, wants: { compare: true } });
    expect(cmp.size).toBe('tour'); expect(cmp.states.door).toBe(EXHIBIT_SIZES.states.door); expect(cmp.layers.study).toMatch(/settings/);
    expect(exhibitFit({ time: 180 }).states).toBeUndefined();
    const rooms = exhibitFit({ time: { minutes: 6 }, wants: { rooms: 3 } });
    expect(rooms).toMatchObject({ size: 'gallery', rooms: 3 }); expect(rooms.stops.about).toBe(exhibitFit({ time: { minutes: 2 } }).stops.about);
    expect(exhibitFit({ time: 180, wants: { rooms: 1 } }).size).toBe('tour');
    expect(() => exhibitFit({ time: 180, wants: { rooms: GALLERY_LIMITS.rooms + 1 } })).toThrow(/how many subjects/);
    expect(() => exhibitFit({ time: 180, wants: { big: true } })).toThrow(/big is not one/);
  });

  it('serves three depths of attention, and says the fit in a line', () => {
    const F = exhibitFit({ time: 'visit' });
    expect(Object.keys(F.layers)).toEqual(['glance', 'visit', 'study']);
    expect(F.layers.glance).toMatch(/stand alone/); expect(F.layers.study).toMatch(/sources/);
    expect(F.says).toMatch(/holds one exhibit with up to \d+ stops\.$/); expect(F.says).not.toMatch(/\n/);
    expect(exhibitFit({ time: 'glance' }).layers.visit).toMatch(/one view|stop/);
    // the same answers, the same fit
    expect(exhibitFit({ time: 'visit' })).toEqual(F);
  });
});
