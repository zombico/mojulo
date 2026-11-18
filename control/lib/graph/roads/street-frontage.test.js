import { describe, it, expect } from 'vitest';
import { designStreets, roadwayCourse } from './course.js';
import { planTrack, trackRuns } from './track.js';
import { planFrontage, FRONT_KINDS } from './street-frontage.js';
import { readLanguage, languageLaws } from './track-language.js';
import { readTrackIntent, composeTrack } from './trackscape-compose.js';

const course = { class: 'kart', length: 600, blocks: 3, seed: 2, streets: true };

describe('a street circuit: a lap round a town\'s blocks', () => {
  it('turns only at right angles round blocks of one size, closes, and is the same each time', () => {
    const C = designStreets({ class: 'kart', length: 600, blocks: 3, seed: 2 });
    expect(C.advisories).toEqual([]);
    expect(Math.abs(C.length - 600) / 600).toBeLessThan(0.05);
    expect(C.design.streets.cells).toHaveLength(3);
    // every corner turns a quarter: the headings of the straights between them are the four of a grid
    const P = planTrack({ form: 'circuit', course }), R = trackRuns(P), a = P.alignment;
    const quarter = R.straights.map((r) => { const h = a.at((r.s0 + r.s1) / 2 % a.length).heading; return Math.round((((h / (Math.PI / 2)) % 4) + 4) % 4 * 1000) / 1000 % 1; });
    for (const q of quarter) expect(Math.min(q, 1 - q)).toBeLessThan(0.02);
    expect(JSON.stringify(designStreets({ class: 'kart', length: 600, blocks: 3, seed: 2 }).design)).toBe(JSON.stringify(C.design));
    expect(roadwayCourse(course).design.form).toBe('streets');
  });
});

describe('its town', () => {
  const card = readLanguage('candy-city'), plan = planTrack({ form: 'circuit', course, language: card.id }), T = planFrontage(plan, card, { seed: 2 });
  it('fronts the way down every straight\'s sides, past the rail and the sidewalk, none standing in another', () => {
    expect(T.lots.length).toBeGreaterThan(12);
    const near = (p) => Math.min(...plan.stations.map((s) => Math.hypot(s.x - p[0], s.y - p[1])));
    // (but the underpass, whose footprint is the street's: it stands over the way)
    for (const l of T.lots.filter((x) => x.kind !== 'tunnel')) for (const q of l.foot) expect(near(q)).toBeGreaterThan(plan.X.outer + card.parts.city.sidewalk - 0.5);
    for (const l of T.lots.filter((x) => x.kind !== 'tunnel')) expect(FRONT_KINDS).toContain(l.kind);
  });
  it('never three alike in a row, each front a colour of the family, never the one beside it', () => {
    let run = 1;
    const L = T.lots;
    for (let i = 1; i < L.length; i++) { run = L[i].row === L[i - 1].row && L[i].kind === L[i - 1].kind ? run + 1 : 1; expect(run).toBeLessThan(3); }
    for (let i = 1; i < T.lots.length; i++) expect(T.lots[i].facade).not.toBe(T.lots[i - 1].facade);
    for (const l of T.lots) expect(card.parts.city.facades).toContain(l.facade);
  });
  it('rises toward its middle: the fronts nearer it stand taller', () => {
    const d = (l) => Math.hypot(l.at[0] - T.core[0], l.at[1] - T.core[1]), by = [...T.lots].sort((x, y) => d(x) - d(y)), half = Math.floor(by.length / 2);
    const mean = (L) => L.reduce((s, l) => s + l.params.h, 0) / L.length;
    expect(mean(by.slice(0, half))).toBeGreaterThan(mean(by.slice(half)));
  });
  it('a lamp down the sidewalks and a signal at every corner; a track whose language has no town has none', () => {
    expect(T.kit.signals.length).toBe(trackRuns(plan).corners.length);
    expect(T.kit.lamps.length).toBeGreaterThan(4);
    expect(planFrontage(plan, readLanguage('candy'), { seed: 2 })).toBeNull();
    expect(languageLaws(card, { cls: 'kart' })).toEqual([]);
  });
  it('is asked for in words: a kart street circuit is a town\'s, a plain kart track is not', () => {
    const M = composeTrack('a kart street circuit', { seed: 3 });
    expect(M.course.streets).toBe(true); expect(M.language).toBe('candy-city');
    expect(readTrackIntent('a kart track').track.streets).toBeUndefined();
    expect(composeTrack('a kart track', { seed: 3 }).language).toBe('candy');
  });
});

describe('its features: an alley across a corner, an underpass', async () => {
  const { surfaceAt, driveSurfaceTable } = await import('./surface.js');
  const { trackContract } = await import('./contract.js');
  const { splitGap } = await import('./street-features.js');
  const card = readLanguage('candy-city'), big = { class: 'kart', length: 700, seed: 3, streets: true };
  const plan = planTrack({ form: 'circuit', course: big, language: card.id }), F = plan.street;
  it('the way splits before a corner into an alley across its inside, which comes back to the way after it', () => {
    expect(F.split.kind).toBe('alley');
    const { s0, s1, branch, side } = F.split, a = plan.alignment, B = branch.alignment, p0 = B.at(0), p1 = B.at(B.length), q0 = a.at(s0), q1 = a.at(s1);
    expect(Math.hypot(p0.x - q0.x, p0.y - q0.y)).toBeLessThan(0.5); expect(Math.hypot(p1.x - q1.x, p1.y - q1.y)).toBeLessThan(0.5);
    // (the corner's inside: the alley's middle lies on that side of the way)
    const c = a.at(F.split.corner), m = B.at(B.length / 2), o = -(m.x - c.x) * Math.sin(c.heading) + (m.y - c.y) * Math.cos(c.heading);
    expect(Math.sign(o)).toBe(side);
    expect(splitGap(F.split, side, s0 + 5)).toBe(true); expect(splitGap(F.split, -side, s0 + 5)).toBe(false); expect(splitGap(F.split, side, F.split.corner)).toBe(false);
  });
  it('either way is the lap: no checkpoint between the mouths, and the alley is its own road under a kart', () => {
    const T = trackContract(plan), { s0, s1, branch } = F.split, a = plan.alignment, inSpan = (c) => [s0, s1].some(() => false) || (() => { let best = Infinity, bs = 0; for (let s = 0; s < a.length; s += 1) { const q = a.at(s), d = Math.hypot(q.x - c.at[0], q.y - c.at[1]); if (d < best) { best = d; bs = s; } } return bs > s0 && bs < s1; })();
    expect(T.checkpoints.some(inSpan)).toBe(false);
    const D = driveSurfaceTable(plan), mid = branch.alignment.at(branch.alignment.length / 2), road = surfaceAt(D, [mid.x, mid.y]);
    expect([road.mu, road.roll]).toEqual(D.rough);   // (road under a kart: the alley's own cobbles)
  });
  it('an underpass stands over another straight, and the town gives way to it; a language with no town has neither', () => {
    expect(F.tunnel).toBeTruthy();
    const T = planFrontage(plan, card, { seed: 3 }), tun = T.lots.filter((l) => l.kind === 'tunnel');
    expect(tun).toHaveLength(1); expect(tun[0].params.span).toBeGreaterThan(2 * plan.X.outer);
    expect(T.lots.filter((l) => l.row === 1001).length).toBeGreaterThan(0);   // (the branch's own fronts)
    expect(planTrack({ form: 'circuit', course: big, language: 'candy' }).street).toBeUndefined();
  });
});
