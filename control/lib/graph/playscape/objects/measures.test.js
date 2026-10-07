/**
 * The object laws bite: a single plank door in band draws no advice, and the same door broken one way at a time draws
 * the law that catches it. Every law the advice names is a written law.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { OBJECT_LAWS } from './laws.js';

const o = resolveObject({ entry: 'door', variant: 'single', skin: 'plank', fit: { width: 1.4, height: 2.6 } });
const judge = (faces) => objectAdvice(objectMeasures(faces, o.frame, 'interactable'), 'interactable');
const laws = (faces) => judge(faces).map((a) => a.law);

describe('the object laws bite', () => {
  it('a door in band draws nothing', () => expect(judge(o.faces)).toEqual([]));

  it('a bare slab: too few segments, no 33, a flat 66, no accent', () => {
    expect(laws(o.faces.filter((f) => f.part === 'body'))).toEqual(expect.arrayContaining(['inverse-interest', 'thirty-three', 'emboss-fill', 'accent-is-use']));
  });

  it('a lock plate shrunk to a speck misses the third and the eye spot', () => {
    const plate = o.faces.filter((f) => f.part === 'detail'), cx = plate.reduce((s, f) => s + f.corners[0][0], 0) / plate.length;
    const shrunk = o.faces.map((f) => (f.part === 'detail' ? { ...f, corners: f.corners.map((c) => [cx + (c[0] - cx) * 0.1, c[1], 1.2 + (c[2] - 1.2) * 0.1]) } : f));
    expect(judge(shrunk).map((a) => a.line).join('\n')).toMatch(/eye spot/);
  });

  it('a coloured face breaks values only; a plate in the body\'s band is lost to a three-value tone', () => {
    expect(laws(o.faces.map((f, i) => (i === 0 ? { ...f, tint: [0.5, 0.3, 0.2] } : f)))).toContain('values-only');
    expect(laws(o.faces.map((f) => (f.part === 'detail' ? { ...f, value: 0.42 } : f)))).toContain('detail-holds-band');
  });

  it('every law the advice can name is written down', () => {
    const m = { ...objectMeasures(o.faces, o.frame, 'interactable'), segments: 0, third: 0.05, detailPx: 3, emboss: 0, valuesOnly: false, status: 0, bands: { 3: [1, 1] } };
    for (const a of objectAdvice(m, 'interactable')) expect(OBJECT_LAWS[a.law], a.law).toBeTruthy();
  });
});
