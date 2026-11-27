// THE JOBS' MARKERS (job-stops.js): what stands at a route's stop and a collect's pile is the job's own (a red cross for
// an ambulance call, a fire, a parcel, a post box; a bus stop's sign where it names none), and the screen says it in the
// job's words. A job that names none is drawn and said as before.
import { describe, it, expect } from 'vitest';
import { jobStopsOf, jobStopsScript } from './job-stops.js';

const shift = (o) => ({ kind: 'shift', id: 'run', mode: 'route', cabs: ['car-1'], stops: [{ at: [0, 0, 0], riders: 1, N: [0, 1] }, { at: [30, 0, 0], riders: 0, N: [0, 1] }], ...o });

describe('a job\'s markers', () => {
  it('carries a job\'s marker and words to the page, and nothing where it names none', () => {
    const [J] = jobStopsOf({ game: { mechanics: [shift({ marker: 'call', says: { aboard: 'patient', hold: 'to load the patient', banner: 'Patient delivered' } })] } }).jobs;
    expect(J).toMatchObject({ marker: 'call', says: { aboard: 'patient', hold: 'to load the patient' } });
    expect(J.piles.map((q) => q.riders)).toEqual([1, 0]);
    const [B] = jobStopsOf({ game: { mechanics: [shift({})] } }).jobs;
    expect(B.marker).toBeUndefined();
    expect(B.says).toBeUndefined();
  });
  it('its page draws each marker and says the job\'s own words', () => {
    const src = jobStopsScript(jobStopsOf({ game: { mechanics: [shift({ marker: 'fire', says: { hold: 'to hose it down' } })] } }));
    for (const m of ['call', 'fire', 'parcel', 'mailbox']) expect(src).toContain(`'${m}'`);
    expect(src).toContain('to hose it down');
  });
});
