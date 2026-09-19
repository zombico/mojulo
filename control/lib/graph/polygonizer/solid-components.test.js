/**
 * solid-components — the connectivity check the workbench never had.
 *
 * The cases are the ones that motivated it: two masses that overlap are one body; the same two
 * pulled apart are two, and each is individually CLOSED, which is exactly why closure could not
 * catch it. Built on real field solids so the test exercises the same face lists a recipe emits.
 */
import { describe, it, expect } from 'vitest';
import { solidComponents, solidComponentsStable, componentWarnings } from './solid-components.js';
import { fieldToFaces } from './field-faces.js';
import { lowerObjectFaces } from '../worlds/workbench.js';

const ball = (id, center, radius) => ({ id, op: 'add', shape: { kind: 'sphere', center, radius } });
const facesOf = (terms, cells = 40) => fieldToFaces({ terms, cells });

describe('solidComponents', () => {
  it('reads one sphere as one body', () => {
    const r = solidComponents(facesOf([ball('a', [0, 0, 0], 5)]));
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
    expect(r.leaks).toBe(0);
    expect(r.components[0].frac).toBe(1);
  });

  it('reads two OVERLAPPING masses as one body', () => {
    const r = solidComponents(facesOf([ball('a', [0, 0, 0], 5), ball('b', [7, 0, 0], 5)]));
    expect(r.count).toBe(1);
  });

  it('reads two SEPARATED masses as two bodies — the failure closure cannot see', () => {
    const faces = facesOf([ball('a', [0, 0, 0], 4), ball('b', [14, 0, 0], 4)]);
    const r = solidComponents(faces);
    expect(r.count).toBe(2);
    expect(r.leaks).toBe(0);
    // Both halves are the same size, so neither is a speck.
    expect(r.components[0].frac).toBeGreaterThan(0.4);
    expect(r.components[1].frac).toBeGreaterThan(0.4);
  });

  it('separates them along every axis, not just x (the fill direction)', () => {
    for (const axis of [0, 1, 2]) {
      const far = [0, 0, 0]; far[axis] = 14;
      const r = solidComponents(facesOf([ball('a', [0, 0, 0], 4), ball('b', far, 4)]));
      expect(r.count).toBe(2);
    }
  });

  it('locates each free piece so the warning can name where it went', () => {
    const r = solidComponents(facesOf([ball('body', [0, 0, 0], 6), ball('chip', [0, 0, 16], 3)]));
    expect(r.count).toBe(2);
    const chip = r.components[1];
    expect(chip.frac).toBeLessThan(0.3);
    expect(chip.center[2]).toBeGreaterThan(10);
  });

  it('stays silent about multi-body unless the recipe declared otherwise', () => {
    // Superposition is the house method and a loose part is normally its own solid, so a bare
    // split must NOT warn — the walkman is eight bodies and correct.
    const split = solidComponents(facesOf([ball('a', [0, 0, 0], 4), ball('b', [14, 0, 0], 4)]));
    expect(componentWarnings(split, "fields[0] 'test'", 'cm')).toEqual([]);

    // Declaring `bodies: 1` is what turns it into a defect.
    const w = componentWarnings(split, "fields[0] 'test'", 'cm', 1);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/declares `bodies: 1` but measures 2/);
    expect(w[0]).toMatch(/closure check passes/);

    const joined = solidComponents(facesOf([ball('a', [0, 0, 0], 5), ball('b', [7, 0, 0], 5)]));
    expect(componentWarnings(joined, 'x', 'cm', 1)).toEqual([]);
  });

  it('flags a declaration that expected MORE pieces than were built', () => {
    const joined = solidComponents(facesOf([ball('a', [0, 0, 0], 5), ball('b', [7, 0, 0], 5)]));
    const w = componentWarnings(joined, 'x', 'cm', 2);
    expect(w[0]).toMatch(/expected to be separate have merged/);
  });

  it('reports rather than guesses when there are no faces', () => {
    const r = solidComponents([]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no faces/);
    expect(componentWarnings(r, 'x')).toEqual([]);
  });

  it('agrees with itself at two resolutions when the parts are properly overlapped', () => {
    const r = solidComponentsStable(facesOf([ball('a', [0, 0, 0], 5), ball('b', [7, 0, 0], 5)]));
    expect(r.count).toBe(1);
    expect(r.stable).toBe(true);
  });

  it('reports a clean split as stable at both resolutions', () => {
    const r = solidComponentsStable(facesOf([ball('a', [0, 0, 0], 4), ball('b', [14, 0, 0], 4)]));
    expect(r.count).toBe(2);
    expect(r.stable).toBe(true);
    expect(componentWarnings(r, 'x', 'cm', 1).join(' ')).toMatch(/but measures 2/);
  });

  it('unions two SEPARATELY CLOSED shells that overlap — the case even-odd gets wrong', () => {
    // Superposition is the house method, so this is the ordinary case, not the exotic one. Two
    // independent closed lathes sharing a volume: parity would fill the two rinds and leave the
    // overlap hollow, then call them disconnected. Winding reads one body.
    const overlapping = {
      kind: 'workbench', units: 'cm',
      lathes: [
        { id: 'a', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] },
        { id: 'b', axisFrom: { x: 0, y: 0, z: 4 }, axisTo: { x: 0, y: 0, z: 10 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] },
      ],
    };
    const faces = lowerObjectFaces(overlapping);
    const r = solidComponents(faces, { cells: 48 });
    expect(r.ok).toBe(true);
    expect(r.leaks).toBe(0);
    expect(r.count).toBe(1);
  });

  it('still separates two closed shells that do NOT overlap', () => {
    const apart = {
      kind: 'workbench', units: 'cm',
      lathes: [
        { id: 'a', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 4 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] },
        { id: 'b', axisFrom: { x: 0, y: 0, z: 12 }, axisTo: { x: 0, y: 0, z: 16 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] },
      ],
    };
    const r = solidComponents(lowerObjectFaces(apart), { cells: 48 });
    expect(r.count).toBe(2);
  });

  it('is deterministic', () => {
    const terms = [ball('a', [0, 0, 0], 4), ball('b', [14, 0, 0], 4), ball('c', [2, 3, 1], 3)];
    expect(solidComponents(facesOf(terms))).toEqual(solidComponents(facesOf(terms)));
  });
});
