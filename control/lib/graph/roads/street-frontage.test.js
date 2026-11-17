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
    for (const l of T.lots) for (const q of l.foot) expect(near(q)).toBeGreaterThan(plan.X.outer + card.parts.city.sidewalk - 0.5);
    for (const l of T.lots) expect(FRONT_KINDS).toContain(l.kind);
  });
  it('never three alike in a row, each front a colour of the family, never the one beside it', () => {
    let run = 1;
    for (let i = 1; i < T.lots.length; i++) { run = T.lots[i].row === T.lots[i - 1].row && T.lots[i].kind === T.lots[i - 1].kind ? run + 1 : 1; expect(run).toBeLessThan(3); }
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
