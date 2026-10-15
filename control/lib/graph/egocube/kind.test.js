// kind.test.js — the Egocube as a kind: a sheet rolled where it is written and kept by value, its nodes, the create call
// each node lowers to, and the lineup preview.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { readEgocubeKind, rollStored, egocubeNodes, egocubeCreate, egocubePrint, assembleEgocubeScene, LINEUP_GAP } from './kind.js';
import { rollEgocube } from './egocube.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const THREAD = { kind: 'egocube', roll: { seed: 3, years: 11, facets: { pole: 'female' }, chapters: [{ chapter: 'time', years: 5 }, { chapter: 'time', years: 10 }] } };

describe('the egocube kind', () => {
  it('reads its words and refuses the rest by name', () => {
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { seed: 1 }, colour: 'red' })).toThrow(/'colour' is not part of an egocube/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { seed: 1, mood: 'x' } })).toThrow(/roll\.mood is not a roll word/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { chapters: [] } })).toThrow(/give roll\.years/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: {}, dress: 'fancy' })).toThrow(/dress is 'designed' or 'kit'/);
  });

  it('rolls where it is written and keeps the sheet while the roll stands; a new roll rolls anew', () => {
    const one = rollStored({ kind: 'egocube', roll: { seed: 5 } });
    expect(one.sheet).toEqual(rollEgocube({ seed: 5 }));
    // a stored sheet is kept by value, even if the tables that rolled it later read otherwise
    const kept = rollStored({ kind: 'egocube', roll: { seed: 5 } }, { ...one, sheet: { ...one.sheet, kept: true } });
    expect(kept.sheet.kept).toBe(true);
    expect(rollStored({ kind: 'egocube', roll: { seed: 6 } }, one).sheet.seed).toBe(6);
    const T = rollStored(THREAD);
    expect(T.sheet).toBeUndefined();
    expect(egocubeNodes(T).map((n) => [n.years, n.band])).toEqual([[11, 'child'], [16, 'youth'], [26, 'adult']]);
    expect(egocubePrint(T)).toBe(egocubePrint(rollStored(THREAD)));
  });

  it('lowers a node to the create_character call its people take', () => {
    const T = rollStored(THREAD);
    const child = egocubeCreate(T), adult = egocubeCreate(T, { years: 26 });
    expect(child.create).toMatchObject({ as: 'hero', spec: { cast: { pole: 'female', build: 'child' } } });
    expect(adult.node).toEqual({ years: 26, band: 'adult' });
    expect(adult.create.spec.outfit).toMatchObject({ type: 'outfit' });   // designed by default
    expect(egocubeCreate(T, { years: 26, dress: 'kit' }).create.spec.outfit).toBeUndefined();
    expect(() => egocubeCreate(T, { years: 30 })).toThrow(/no node at 30 years \(the thread has 11, 16, 26\)/);
  });

  it('previews the character at each age, side by side, every camera holding the lineup', async () => {
    const scene = await assembleEgocubeScene(THREAD, { title: 'Wren' }, (m, c) => WORLD_KINDS.layered.resolve(m, c));
    const xs = scene.faces.filter((f) => !f.studio).flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2 * LINEUP_GAP - 0.2);
    expect(scene.figures).toBeUndefined();
    const front = scene.cameras.find((c) => c.name === 'front').worldFraming;
    const dist = Math.hypot(...front.cameraPosition.map((v, i) => v - front.lookAt[i]));
    expect(2 * dist * Math.tan((front.horizontalFov * Math.PI) / 360)).toBeGreaterThanOrEqual(Math.max(...xs) - Math.min(...xs));
  }, 300_000);

  it('previews a mascot output as its model sheet\'s turnaround: one character, four turns', async () => {
    const cube = { kind: 'egocube', roll: { brief: 'a weary paladin', seed: 3 }, output: 'mascot' };
    const scene = await assembleEgocubeScene(cube, { title: 'Paladin' }, (m, c) => WORLD_KINDS.layered.resolve(m, c));
    const body = scene.faces.filter((f) => !f.studio);
    expect(body.length % 4).toBe(0);
    // the four copies stand apart, and the last is turned to show its back (its front faces away from +y)
    const quarter = body.length / 4, ys = (i) => body.slice(i * quarter, (i + 1) * quarter).flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.max(...ys(0))).toBeCloseTo(-Math.min(...ys(3)), 2);
  }, 300_000);
});