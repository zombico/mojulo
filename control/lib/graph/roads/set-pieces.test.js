// Set piece laws: what fills a trackscape's slots. One case per procedure (chosen in code from the sets): a piece sized
// up its rails until it reads where its slot needs it; a span sized to the road and turned across it; a piece turned
// to face the road; the paint by the kit's pole, four corners at most; determinism.
import { describe, it, expect } from 'vitest';
import { TRACK_BLOCKS, SETS, pieceFor, buildPiece, paintPiece } from './set-pieces.js';
import { trackKit } from './track-kit.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';
import { composeLook } from '../gameworld/tunnel-land.js';

const SET = Object.keys(SETS)[0];
const FOCUS = SETS[SET].focus.built;
const slot = (beat, extra = {}) => ({ beat, ring: 'mid', at: [40, 0, 0], interest: 'focus', span: 6, form: 'built', ...extra });

describe('a slot\'s piece', () => {
  it('is sized up its rails until its least extent covers the slot\'s span', () => {
    const small = pieceFor(slot('focus', { span: 2 }), SET), big = pieceFor(slot('focus', { span: 9 }), SET);
    expect(small.block).toBe(FOCUS);
    const least = (p) => Math.min(Math.max(p.size[0], p.size[1]), p.size[2]);
    expect(least(small)).toBeGreaterThanOrEqual(2);
    expect(least(big)).toBeGreaterThanOrEqual(9);
    expect(least(big)).toBeGreaterThan(least(small));
  });
  it('a span takes the road\'s width and turns across it; any other piece turns to face the road', () => {
    const span = pieceFor(slot('gantry', { across: 20 }), SET, { heading: 0 });
    expect(span.params.span).toBeCloseTo(22, 6);
    expect(span.yaw).toBeCloseTo(Math.PI / 2, 6);
    // a piece east of the road (+x) faces west: its −y turned to −x
    const p = pieceFor(slot('pocket'), SET, { toward: [0, 0] }), b = buildPiece(p);
    const front = b.faces.filter((f) => f.normal[0] < -0.9).length, back = b.faces.filter((f) => f.normal[0] > 0.9).length;
    expect(front).toBeGreaterThan(0);
    expect(p.yaw).toBeCloseTo(Math.PI + Math.PI / 2, 6);
    expect(back).toBeGreaterThan(0);
  });
  it('is painted in the kit by its pole, four corners at most, deterministic', () => {
    const banded = trackKit(SWATCH_KITS.find((k) => poleOf(k) === 'banded')), real = trackKit(composeLook('realistic green grassland').id);
    const b = buildPiece(pieceFor(slot('focus'), SET));
    const m = paintPiece(b.faces, real), n = paintPiece(b.faces, banded);
    for (const f of [...m, ...n]) expect(f.corners.length).toBeLessThanOrEqual(4);
    expect(m.some((f) => f.textureLit)).toBe(true);
    expect(n.some((f) => f.textureLit)).toBe(false);
    expect(JSON.stringify(paintPiece(buildPiece(pieceFor(slot('focus'), SET)).faces, real))).toBe(JSON.stringify(m));
    expect(TRACK_BLOCKS[FOCUS]).toBeTruthy();
  });
});
