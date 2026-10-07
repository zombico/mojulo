import { describe, it, expect } from 'vitest';
import { readBounds, boundSegments, boundLaw, BOUND_FACES } from './out-bounds.js';
import { outTrailSite, outTrailLaws } from './out-trail.js';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';
import { surfaceTexture, encodePngGrey } from '../landscape/surface-textures.js';

// the outer wall of an outdoor trail: walls with faces — wall, natural, paint, mirror (offset-wrap, stutter), penalty,
// open (era/out-bounds.js)
const ST = ISEKAI_STYLES['isekai-meadow'];
const A = { id: 'meadow', heartbeat: 0.8, bumpiness: 0.6 };
const built = new Map();
const stage = (trail, seed = 8) => { const k = JSON.stringify([trail, seed]); return built.get(k) || built.set(k, assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed, trail })).get(k); };
const PNG = `data:image/png;base64,${encodePngGrey(Buffer.alloc(4, 200), 2, 2).toString('base64')}`;

describe('out-bounds', () => {
  it('reads a side as a face, a face with settings, or segments; and says what is wrong', () => {
    expect(readBounds({ '+x': 'mirror' })).toEqual({ '+x': [{ face: 'mirror' }] });
    expect(readBounds({ '-y': [{ from: 0, to: 20, face: 'penalty' }] })['-y'][0]).toEqual({ face: 'penalty', from: 0, to: 20, severity: 'reset' });
    expect(readBounds({ '+x': { face: 'mirror', stutter: true } })['+x'][0].stutter).toBe(8);
    expect(() => readBounds({ north: 'wall' })).toThrow(/not a side/);
    expect(() => readBounds({ '+x': 'wrap' })).toThrow(/no wrap/);
    expect(() => readBounds({ '+x': [{ face: 'wall' }] })).toThrow(/from < to/);
    expect(() => readBounds({ '+x': { face: 'wall', png: PNG } })).toThrow(/on a paint face/);
    expect(() => readBounds({ '+x': { face: 'wall', severity: 'hurt' } })).toThrow(/on a penalty face/);
    expect(() => readBounds({ '+x': { face: 'paint', stutter: 9 } })).toThrow(/on a mirror face/);
    expect(BOUND_FACES).toEqual(['wall', 'natural', 'paint', 'mirror', 'penalty', 'open']);
  });

  it('walls every side by default (the cliff natural, the side after another trail open), and the law says so', () => {
    const a = outTrailSite(ST, A, 8), b = outTrailSite(ST, { id: 'ford', run: 16, after: { ...A, seed: 8 } }, 33);
    const faces = (s) => Object.fromEntries(['-x', '+x', '-y', '+y'].map((d) => [d, s.bounds.filter((q) => q.side === d).map((q) => q.face).join()]));
    expect(faces(a)).toEqual({ '-x': 'natural', '+x': 'wall', '-y': 'wall', '+y': 'wall' });
    expect(faces(b)).toEqual({ '-x': 'natural', '+x': 'wall', '-y': 'open', '+y': 'wall' });
    for (const s of [a, b]) expect(outTrailLaws(s).find((l) => l.law === 'bounded').ok).toBe(true);
    // an open side with no trail before it is a way off the world
    expect(boundLaw(a, boundSegments(a, readBounds({ '-y': 'open' })))).toContain('-y open with no trail before it');
    // a side given in segments: the gaps take its default, end to end
    const segs = boundSegments(a, readBounds({ '+x': [{ from: 10, to: 30, face: 'paint' }] })).filter((q) => q.side === '+x');
    expect(segs.map((q) => [q.face, q.from, q.to])).toEqual([['wall', 0, 10], ['paint', 10, 30], ['wall', 30, a.D]]);
  });

  it('every segment is an anchor and every wall a collider; a penalty has its trigger and puts the walker back on a beat', () => {
    const p = stage({ ...A, bounds: { '+y': { face: 'penalty', severity: 'hurt' }, '+x': 'open' } });
    const bounds = p.anchors.filter((a) => a.kind === 'bound');
    expect(bounds.map((a) => a.face).sort()).toEqual(['natural', 'open', 'penalty', 'wall']);
    expect(p.colliders.map((c) => c.of).sort()).toEqual(['bound:out-trail:meadow:+y', 'bound:out-trail:meadow:-x', 'bound:out-trail:meadow:-y']);
    const pen = bounds.find((a) => a.face === 'penalty'), beats = p.anchors.filter((a) => a.kind === 'beat');
    expect(pen).toMatchObject({ severity: 'hurt', side: '+y', N: [0, -1, 0] });
    expect(pen.trigger.max[1]).toBeGreaterThan(pen.trigger.min[1]);
    expect(beats.some((b) => b.at[0] === pen.respawn[0] && b.at[1] === pen.respawn[1])).toBe(true);
    // the open side has no collider; it is still an anchor
    expect(p.outTrail.laws.find((l) => l.law === 'bounded').ok).toBe(false);
  }, 60000);

  it('a mirror reflects the near band past the wall, unnamed; offset-wrap and stutter slide the things, never the ground', () => {
    const plain = stage({ ...A, bounds: { '+x': 'mirror' } }), wrap = stage({ ...A, bounds: { '+x': { face: 'mirror', offset: 23, stutter: 9 } } });
    const W = ST.site.w, m0 = plain.faces.filter((f) => f.mirrored), m1 = wrap.faces.filter((f) => f.mirrored);
    expect(m0.length).toBeGreaterThan(1000);
    expect(m0.every((f) => !f.node && f.corners.reduce((t, c) => t + c[0], 0) / f.corners.length >= W - 1e-6)).toBe(true);
    expect(m1.length).toBe(m0.length);
    const ground = (fs) => fs.filter((f) => /ground|cliff|trail/.test(f.group)).map((f) => f.corners);
    expect(ground(m1)).toEqual(ground(m0));
    const things = (fs) => fs.filter((f) => /crown|wood|rock/.test(f.group)).map((f) => f.corners);
    expect(things(m1)).not.toEqual(things(m0));
    // the slid things stay in the segment's run
    for (const f of m1) for (const c of f.corners) { expect(c[1]).toBeGreaterThan(-12); expect(c[1]).toBeLessThan(plain.outTrail.length + 20); }
  }, 120000);

  it('a paint face carries the recipe\'s PNG as a tile, or paints the style\'s far hills', () => {
    const p = stage({ ...A, bounds: { '+x': [{ from: 0, to: 30, face: 'paint', png: PNG }, { from: 30, to: 90, face: 'paint' }] } });
    const panel = p.faces.filter((f) => f.group === 'out:paint');
    const png = panel.find((f) => typeof f.texture === 'string');
    expect(png.texture).toMatch(/^paint:[0-9a-f]{16}$/);
    expect(surfaceTexture(png.texture)).toBe(PNG);
    expect(panel.filter((f) => !f.texture).length).toBeGreaterThan(20);
  }, 60000);
});
