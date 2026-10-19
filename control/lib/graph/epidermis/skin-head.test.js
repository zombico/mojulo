/**
 * skin-head — the skin on a relational head: the zoom decides what shows (a whole-head view untouched, the keratin
 * from a close-up, the micro in a macro); the regions come from the relations; no creases; the layer is
 * deterministic.
 */
import { describe, expect, it } from 'vitest';

import { skinOnHead } from './skin-head.js';
import { skinZoomWeights } from './skin-relief.js';
import { readEpidermis } from './epidermis.js';
import { relationalHead } from '../polygonizer/head-relational.js';

const head = relationalHead({ sex: 'male' });
const skin = readEpidermis({ skin: { age: 0.6 } }).skin;
const S = skinOnHead(head, skin), sc = head.relational.V, P = head.relational.points;
const at = (k, d = {}) => ({ x: (P[k].x + (d.x || 0)) * sc, y: (P[k].y + (d.y || 0)) * sc, z: (P[k].z + (d.z || 0)) * sc });
const N = [0.6, 0.78, 0.17].map((x) => x / Math.hypot(0.6, 0.78, 0.17));

describe('the skin on the head', () => {
  it('shows each layer at its zoom: creases from a portrait, keratin close, micro in a macro', () => {
    expect(skinZoomWeights(2)).toEqual({ creases: 0, keratin: 0, micro: 0 });
    expect(skinZoomWeights(0.5)).toMatchObject({ creases: 1, keratin: 0, micro: 0 });
    expect(skinZoomWeights(0.1)).toMatchObject({ creases: 1, keratin: 1, micro: 0 });
    expect(skinZoomWeights(0.02)).toEqual({ creases: 1, keratin: 1, micro: 1 });
  });
  it('leaves a whole-head view untouched, and moves the normal close up', () => {
    const pts = Array.from({ length: 40 }, (_, i) => at('exR', { x: 0.01 + 0.002 * (i % 8), z: -0.01 + 0.005 * Math.floor(i / 8) }));
    for (const p of pts) expect(S.normal(p, N, 2)).toBe(N);
    expect(pts.filter((p) => Math.abs(S.normal(p, N, 0.05)[2] - N[2]) > 1e-4).length).toBeGreaterThan(20);
    expect(S.normal(pts[3], N, 0.05)).toEqual(S.normal(pts[3], N, 0.05));
  });
  it('takes its regions from the relations', () => {
    const top = (p) => S.regions(p)[0].name;
    expect(top(at('prn'))).toBe('nose');
    expect(top(at('eyeR'))).toBe('eyelid');
    expect(top(at('pg'))).toBe('chin');
    expect(top(at('g', { z: 0.12 }))).toBe('forehead');
    expect(top(at('zyR'))).toBe('cheek');
  });
  it('lays no creases: no crow\'s feet, no wrinkles, whatever the face does', () => {
    expect(S.tethers).toHaveLength(0);
    expect(skinOnHead(relationalHead({ sex: 'male', actions: { smile: 1, browRaise: 1 } }), skin).tethers).toHaveLength(0);
  });
});
