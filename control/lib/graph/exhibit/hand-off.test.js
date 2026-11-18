// The exhibit's hand-off: once the four are answered, the steps that make the fit, a room at a time. It proposes: nothing
// is run, and no aim, caption or claim is written for the person.
import { describe, it, expect } from 'vitest';
import { exhibitStart, exhibitHandOff } from './producer.js';
import { exhibitFit, EXHIBIT_SIZES } from './fit.js';
import { scaleReport, SCALES, SCALE_IDS, HOME_SCALE } from './scales.js';
import { readBrief, AUDIENCES } from './brief.js';
import { readTour } from './tour.js';

const above = SCALE_IDS.find((s) => SCALES[s].rung > 0), below = SCALE_IDS.find((s) => SCALES[s].rung < 0);
const answered = (more = {}) => ({ concept: 'how a dam makes electricity', people: [AUDIENCES[0]], time: 'visit', brought: 'none', ...more });
const stepsOf = (s) => exhibitStart(s).next.find((x) => x.step === 'make').steps;
const kinds = (steps) => steps.map((x) => x.step);

describe('the exhibit\'s hand-off', () => {
  it('is offered only once the four are answered, on the make step', () => {
    expect(exhibitStart({ concept: 'a dam', time: 'visit' }).next.find((x) => x.step === 'make')).toBeUndefined();
    expect(kinds(stepsOf(answered()))).toEqual(['world', 'tour', 'audit', 'sheet', 'show']);
  });

  it('one room: a world made new at its scale, then its tour and curation, the gates last', () => {
    const S = stepsOf(answered({ scales: [above] })), F = exhibitFit({ time: 'visit', people: [AUDIENCES[0]] });
    expect(S[0]).toMatchObject({ step: 'world', at: above, made: SCALES[above].made, view: SCALES[above].view, like: SCALES[above].samples });
    expect(S[0].room).toBeUndefined(); expect(S[0].says).toMatch(/make it new/);
    expect(S[1]).toMatchObject({ step: 'tour', stops: F.stops }); expect(S[1].says).toContain(`up to ${F.stops.about} stops`); expect(S[1].says).toMatch(/stands alone/);
    expect(S.find((x) => x.step === 'audit').door).toBe('get_exhibit({ ref, audit: true })'); expect(S[S.length - 1].says).toMatch(/never claimed/);
    // with no scale named yet the world is still made new
    expect(stepsOf(answered())[0].made).toMatch(/made new from the primitives/);
  });

  it('carries what was said and leaves what is theirs to them: no aim or claim is written', () => {
    const brought = [{ id: 'plan', kind: 'goals', says: 'a year 5 lesson on dams', placed: 'aims' }];
    const C = stepsOf(answered({ brought })).find((x) => x.curation).curation;
    expect(C.brought).toEqual(brought); expect(C.aims).toMatch(/^theirs/); expect(C.claims).toMatch(/^theirs/);
    // what it does carry reads as a curation once the person's aims are in
    const withAims = { aims: ['how falling water becomes electricity'], ...(C.audiences ? { audiences: C.audiences } : {}), brought: C.brought };
    expect(() => readBrief(withAims)).not.toThrow();
    const two = stepsOf(answered({ people: [AUDIENCES[0], AUDIENCES[1]] }));
    expect(two.find((x) => x.curation).curation.audiences).toEqual(exhibitFit({ time: 'visit', people: [AUDIENCES[0], AUDIENCES[1]] }).audiences);
    // each caption said again for the others
    expect(stepsOf(answered({ people: ['child'] })).find((x) => x.step === 'tour').says).toMatch(/said again for young visitors/);
    expect(stepsOf(answered({ people: ['general'] })).find((x) => x.step === 'tour').says).not.toMatch(/said again/);
  });

  it('a concept that spans rungs is a room a rung, joined, with the camera\'s move between each two', () => {
    const scales = [above, HOME_SCALE, below], S = stepsOf(answered({ scales })), R = scaleReport(scales);
    expect(kinds(S)).toEqual(['world', 'tour', 'world', 'tour', 'world', 'tour', 'gallery', 'audit', 'sheet', 'show']);
    expect(S.filter((x) => x.step === 'world').map((x) => [x.room, x.at])).toEqual(scales.map((s, i) => [i + 1, s]));
    const G = S.find((x) => x.step === 'gallery');
    expect(G.door).toBe(EXHIBIT_SIZES.gallery.door); expect(G.zoom).toEqual(R.zoom); expect(G.zoom.every((z) => typeof z.move === 'string')).toBe(true);
    expect(S.filter((x) => x.curation)).toHaveLength(1);
  });

  it('a glance has no tour; settings to compare add their step', () => {
    const view = stepsOf(answered({ time: 10 }));
    expect(kinds(view)).toEqual(['world', 'tour', 'audit', 'show']); expect(view[1].stops).toBeUndefined(); expect(view[1].says).toMatch(/no tour/);
    const cmp = stepsOf(answered({ wants: { compare: true } }));
    expect(kinds(cmp)).toEqual(['world', 'tour', 'states', 'audit', 'sheet', 'show']); expect(cmp.find((x) => x.step === 'states').door).toBe(EXHIBIT_SIZES.states.door);
  });

  it('its tour budget is one a tour can hold', () => {
    const F = exhibitFit({ time: 'visit' }), S = exhibitHandOff({ start: { brought: 'none' }, fit: F, scale: null });
    const stops = Array.from({ length: S.find((x) => x.step === 'tour').stops.max }, (_, i) => ({ caption: `stop ${i + 1}`, camera: { pos: [0, 0, 5], target: [0, 0, 0] } }));
    expect(() => readTour({ stops })).not.toThrow();
  });
});
