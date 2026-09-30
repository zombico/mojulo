import { describe, it, expect, beforeAll } from 'vitest';
import { makeLog, ageForRadius, validateLog } from './log.js';
import { TIMBERS, memberColor, finishError, timberError } from './timber.js';
import { ringFiltered, ringMean, figureAt, rayField, bakeFigure } from './figure.js';
import { cutPose, poseReach, stockSection, memberFrame } from './members.js';
import { movement } from './movement.js';
import { spanChecks, assemblyOrder } from './checks.js';
import { lowerFrame, validateFrames, frameStamps } from './frame.js';
import { resolveTimberTexture, bakeTimberKey, TIMBER_TEXTURE_PREFIX } from './textures.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { ensureExactKernel, exactFieldFaces } from '../polygonizer/field-exact.js';
import { setExactFieldRenderer } from '../polygonizer/field-faces.js';
import { manifestWantsExact } from '../polygonizer/field-exact-reach.js';
import { planWorkbench, lowerObjectFaces } from '../worlds/workbench.js';

const western = {
  id: 'western', unit: 'cm', species: 'oak',
  members: [
    { id: 'post-l', from: [0, 0, 0], to: [0, 0, 260], stock: [15, 15] },
    { id: 'post-r', from: [300, 0, 0], to: [300, 0, 260], stock: [15, 15] },
    { id: 'tie', from: [0, 0, 250], to: [300, 0, 250], stock: [15, 20] },
    { id: 'brace-l', from: [0, 0, 190], to: [60, 0, 250], stock: [10, 10] },
    { id: 'brace-r', from: [300, 0, 190], to: [240, 0, 250], stock: [10, 10] },
  ],
  joints: [
    { type: 'mortise-tenon', a: 'tie', b: 'post-l' }, { type: 'mortise-tenon', a: 'tie', b: 'post-r' },
    { type: 'mortise-tenon', a: 'brace-l', b: 'post-l' }, { type: 'mortise-tenon', a: 'brace-l', b: 'tie' },
    { type: 'mortise-tenon', a: 'brace-r', b: 'post-r' }, { type: 'mortise-tenon', a: 'brace-r', b: 'tie' },
  ],
};
const kigumi = {
  id: 'kigumi', unit: 'cm', species: 'hinoki',
  members: [
    { id: 'post-l', from: [0, 0, 0], to: [0, 0, 282], stock: '4sun' },
    { id: 'post-r', from: [300, 0, 0], to: [300, 0, 282], stock: '4sun' },
    { id: 'hari-a', from: [-30, 0, 282], to: [150, 0, 282], stock: [12, 24], species: 'sugi' },
    { id: 'hari-b', from: [150, 0, 282], to: [330, 0, 282], stock: [12, 24], species: 'sugi' },
    { id: 'nuki', from: [-15, 0, 150], to: [315, 0, 150], stock: 'nuki' },
  ],
  joints: [
    { type: 'hozo', a: 'post-l', b: 'hari-a', pin: true }, { type: 'hozo', a: 'post-r', b: 'hari-b', pin: true },
    { type: 'kanawa-tsugi', a: 'hari-a', b: 'hari-b' },
    { type: 'nuki', a: 'nuki', b: 'post-l', drive: 'from' }, { type: 'nuki', a: 'nuki', b: 'post-r', drive: 'to' },
  ],
};

describe('construction/log — the synthetic log', () => {
  const log = makeLog({ species: 'oak', age: 60, length: 4, seed: 3 });
  it('counts one ring a year at the butt', () => {
    let last = null, crossings = 0;
    for (let r = 0; r < 0.5; r += 0.0002) {
      const s = log.sample([r, 0, 0.3]);
      if (s.el === 'air' || s.el === 'bark') break;
      if (s.el !== 'trunk') continue;
      const y = Math.floor(s.t); if (last !== null && y !== last) crossings++; last = y;
    }
    // the leader passed 0.3 m in year 0.86, so 59 rings stand there: 58 boundaries between them
    expect(crossings).toBe(58);
  });
  it('tapers: its upper sections are younger', () => {
    expect(log.radiusAt(0.3)).toBeGreaterThan(log.radiusAt(2));
    expect(log.radiusAt(2)).toBeGreaterThan(log.radiusAt(4));
  });
  it('is deterministic in its spec, and a clear log has no knots', () => {
    const again = makeLog({ species: 'oak', age: 60, length: 4, seed: 3 });
    for (const p of [[0.05, 0.02, 1], [-0.1, 0.03, 2.5], [0.01, -0.12, 0.7]]) expect(again.sample(p)).toEqual(log.sample(p));
    expect(makeLog({ species: 'pine', age: 30, length: 4, knots: 'clear' }).branches).toHaveLength(0);
    expect(makeLog({ species: 'pine', age: 30, length: 4, seed: 2 }).branches.length).toBeGreaterThan(10);
  });
  it('sizes a log to the section it must yield', () => {
    const age = ageForRadius('oak', 0.15, 3);
    const big = makeLog({ species: 'oak', age, length: 3.4, seed: 1 });
    expect(big.radiusAt(3)).toBeGreaterThan(0.15);
  });
  it('validates its spec with a teaching message', () => {
    expect(validateLog({ knots: 'some' })[0]).toMatch(/knots: must be one of clear, few, normal, many/);
    expect(validateLog({ age: 2 })[0]).toMatch(/age/);
  });
});

describe('construction/figure — the cut face', () => {
  it('filters the ring profile to its mean once a pixel holds a ring', () => {
    const sp = TIMBERS.oak;
    expect(ringFiltered(sp, 0.1, 1.5)).toBe(ringMean(sp));
    // a pixel narrower than the pore band averages it: the band never strobes to full dark
    expect(ringFiltered(sp, 0.05, 0.5)).toBeGreaterThan(1 - sp.pores - sp.late);
  });
  it('stays relative to the base colour (≤ 1 a channel) and shows oak’s rays on a quarter-sawn face', () => {
    const log = makeLog({ species: 'oak', age: 60, length: 2, seed: 3, knots: 'clear' });
    const rays = rayField(log);
    expect(rays).not.toBeNull();
    expect(rayField(makeLog({ species: 'pine', age: 30, length: 2 }))).toBeNull();
    const rgb = bakeFigure(log, { origin: [0.015, 0.015, 0.5], a: [1, 0, 0], b: [0, 0, 1], w: 0.2, h: 0.2, nu: 60, nv: 60 });
    expect(Math.max(...rgb)).toBeLessThanOrEqual(255);
    const c = figureAt(log, rays, [0.08, 0.015, 0.6], [0.001, 0, 0], [0, 0, 0.004]);
    expect(c.every((v) => v > 0 && v <= 1)).toBe(true);
    expect(bakeFigure(log, { origin: [0.015, 0.015, 0.5], a: [1, 0, 0], b: [0, 0, 1], w: 0.2, h: 0.2, nu: 60, nv: 60 }).equals(rgb)).toBe(true);
  });
});

describe('construction/members and movement — the cut decides the figure and the cup', () => {
  it('names stock and places cuts in the log', () => {
    expect(stockSection('2x4', 0.01)).toEqual([0.038, 0.089]);
    expect(stockSection('4sun', 0.01)).toEqual([0.12, 0.12]);
    expect(stockSection([15, 20], 0.01)).toEqual([0.15, 0.2]);
    expect(cutPose(undefined, 0.15, 0.15).name).toBe('boxed-heart');
    expect(cutPose(undefined, 0.2, 0.03).name).toBe('flat');
    expect(poseReach(cutPose('boxed-heart', 0.2, 0.2), 0.2, 0.2)).toBeCloseTo(Math.hypot(0.1, 0.1), 6);
    const F = memberFrame([0, 0, 0], [0, 0, 3]);
    expect(F.ez).toEqual([0, 1, 0]);          // a post's depth faces world +y
  });
  it('cups a flat-sawn board away from the heart and leaves a quarter-sawn one flat', () => {
    const W = 0.2, D = 0.03;
    const flat = movement('oak', cutPose('flat', W, D), W, D);
    expect(flat.cupFace).toBe('z+');           // the face farther from the pith goes concave
    expect(flat.cupMm).toBeGreaterThan(0.2);
    const quarter = movement('oak', cutPose('quarter', W, D), W, D);
    expect(quarter.cupMm).toBe(0);
    expect(flat.widthMm).toBeGreaterThan(quarter.widthMm);   // tangential shrinkage is the larger
  });
  it('says a boxed-heart post checks', () => {
    expect(movement('hinoki', cutPose('boxed-heart', 0.12, 0.12), 0.12, 0.12).checks).toBe(true);
    expect(movement('hinoki', cutPose('free-of-heart', 0.12, 0.12), 0.12, 0.12).checks).toBe(false);
  });
});

describe('construction/timber — colour is a finish', () => {
  it('multiplies stains and named finishes, and paint covers', () => {
    expect(memberColor('oak', {})).toEqual({ mode: 'figure', rgb: TIMBERS.oak.base.map((v) => v * 1) });
    expect(memberColor('oak', { finish: { paint: '#102030' } })).toEqual({ mode: 'paint', rgb: [16, 32, 48] });
    const st = memberColor('oak', { finish: { stain: '#808080' } });
    expect(st.mode).toBe('figure'); expect(st.rgb[0]).toBeCloseTo((TIMBERS.oak.base[0] * 128) / 255, 6);
    expect(memberColor('sugi', { finish: 'gofun' }).mode).toBe('paint');
    expect(memberColor('sugi', { tint: '#ffffff' }).rgb).toEqual([255, 255, 255]);
    expect(finishError('lacquer')).toMatch(/unknown finish 'lacquer'/);
    expect(finishError({ stain: 'brown' })).toMatch(/finish must be/);
    expect(timberError('balsa')).toMatch(/unknown timber 'balsa'/);
  });
});

describe('construction/checks', () => {
  it('matches the closed-form deflection of a simply supported beam', () => {
    const M = { id: 'b', species: 'douglas-fir', W: 0.1, D: 0.3, L: 5, xMin: 0, xMax: 5, F: memberFrame([0, 0, 0], [5, 0, 0]) };
    const [r] = spanChecks([M], () => [0, 5], { liveKNm: 2 });
    const sp = TIMBERS['douglas-fir'];
    const w = sp.density * 9.81 * 0.1 * 0.3 + 2000; const I = (0.1 * 0.3 ** 3) / 12;
    expect(r.deflMm).toBeCloseTo(Math.round(((5 * w * 5 ** 4) / (384 * sp.E * 1e9 * I)) * 10000) / 10, 1);
    expect(r.limitMm).toBeCloseTo(5000 / 300, 1);
    expect(r.kind).toBe('span');
  });
  it('finds an order when the directions agree, and names the lock when they cannot', () => {
    const up = [0, 0, 1], x = [1, 0, 0], diag = [Math.SQRT1_2, 0, Math.SQRT1_2];
    expect(assemblyOrder(['a', 'b'], [{ a: 'b', b: 'a', dirs: [up] }]).order).toEqual(['a', 'b']);
    const locked = assemblyOrder(['p', 'q', 'r'], [{ a: 'q', b: 'p', dirs: [x] }, { a: 'q', b: 'r', dirs: [diag] }, { a: 'r', b: 'p', dirs: [x.map((v) => -v)] }]);
    expect(locked.order).toBeNull();
    expect(locked.lock.spreadDeg).toBeGreaterThan(8);
  });
});

describe('construction/frame — members cut where they meet', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('validates frames with teaching messages', () => {
    const errs = validateFrames([{ members: [{ id: 'a', from: [0, 0, 0], to: [0, 0, 100], stock: 'plank' }, { id: 'a', from: [0, 0, 0], to: [0, 0, 100], stock: [10, 10], species: 'balsa' }], joints: [{ type: 'mitre', a: 'a', b: 'z' }] }]);
    expect(errs.join('\n')).toMatch(/stock: \[width, depth\]/);
    expect(errs.join('\n')).toMatch(/'a' is used twice/);
    expect(errs.join('\n')).toMatch(/unknown timber 'balsa'/);
    expect(errs.join('\n')).toMatch(/type: one of mortise-tenon, hozo, nuki, kanawa-tsugi, lap, notch/);
    expect(errs.join('\n')).toMatch(/'z' names no member/);
    expect(validateFrames([western, kigumi])).toEqual([]);
  });

  it('is deterministic, and every textured face carries a timber key and uv', () => {
    const a = lowerFrame(western), b = lowerFrame(western);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
    const textured = a.faces.filter((f) => f.texture);
    expect(textured.length).toBeGreaterThan(100);
    expect(textured.every((f) => f.texture.startsWith(TIMBER_TEXTURE_PREFIX) && f.uv.length === 4 && f.textureLit)).toBe(true);
    // pegs are loose pieces, one per tenon
    expect(a.report.pieces.filter((p) => p.kind === 'peg')).toHaveLength(6);
  });

  it('keeps the figure’s bytes when only the finish changes, and paint carries no texture', () => {
    const keys = (f) => [...new Set(lowerFrame(f).faces.map((x) => x.texture).filter(Boolean))].sort();
    expect(keys({ ...western, finish: 'bengara' })).toEqual(keys(western));
    expect(keys({ ...western, finish: { paint: '#e0ddd0' } })).toEqual([]);
    expect(keys({ ...western, figure: 'flat' })).toEqual([]);
  });

  it('resolves a timber key through the surface-texture channel', () => {
    const key = lowerFrame(kigumi).faces.find((f) => f.texture).texture;
    const url = surfaceTexture(key);
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(resolveTimberTexture(key)).toBe(url);
    expect(surfaceTexture('timber:not-base64-json')).toBeNull();
  });

  it('bakes only a timber key frame.js could mint: a key is recipe text too (a dungeon style, an extrude wrap)', () => {
    const minted = lowerFrame(kigumi).faces.find((f) => f.texture).texture;
    const p = JSON.parse(Buffer.from(minted.slice(TIMBER_TEXTURE_PREFIX.length), 'base64url').toString('utf8'));
    const key = (q) => TIMBER_TEXTURE_PREFIX + Buffer.from(JSON.stringify({ ...p, ...q })).toString('base64url');
    expect(bakeTimberKey(key({}))).not.toBeNull();
    const t0 = performance.now();
    expect(bakeTimberKey(key({ nu: 1025 }))).toBeNull();
    expect(bakeTimberKey(key({ nv: 12.5 }))).toBeNull();
    expect(bakeTimberKey(key({ log: { ...p.log, species: 'unobtainium' } }))).toBeNull();   // threw, before
    expect(bakeTimberKey(key({ log: { ...p.log, age: 1e6 } }))).toBeNull();
    expect(bakeTimberKey(key({ log: { ...p.log, length: 1e6 } }))).toBeNull();
    expect(bakeTimberKey(key({ log: { ...p.log, heightGrowth: 1e-4 } }))).toBeNull();
    expect(bakeTimberKey(key({ o: [0, 0] }))).toBeNull();
    // last: before, this one held the event loop for minutes and asked for 1.2 GB
    expect(surfaceTexture(key({ nu: 20000, nv: 20000 }))).toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('reports the kigumi bent’s assembly order, and the braced bent’s lock', () => {
    const k = lowerFrame(kigumi).report;
    expect(k.assembly.order.slice(0, 5)).toEqual(['post-l', 'post-r', 'hari-b', 'hari-a', 'nuki']);
    expect(k.span.map((s) => s.member)).toContain('hari-a+hari-b');   // the spliced run checks as one beam
    const w = lowerFrame(western).report;
    expect(w.assembly.order).toBeNull();
    expect(w.assembly.lock.spreadDeg).toBe(45);
    expect(frameStamps(w, 'western').join('\n')).toMatch(/45° apart/);
    expect(w.joints[0].tenon).toEqual({ thickMm: 50, heightMm: 160, depthMm: 99, through: false });
  });

  it('refuses a joint whose members never meet, and names them', () => {
    const bad = { ...western, joints: [{ type: 'mortise-tenon', a: 'brace-l', b: 'post-r' }] };
    expect(() => lowerFrame(bad)).toThrow(/brace-l's centreline never reaches post-r/);
  });

  it('degrades to uncut boxes without the exact kernel, and says so', () => {
    setExactFieldRenderer(null);
    try {
      const { faces, report } = lowerFrame(western);
      expect(faces).toHaveLength(5 * 6);
      expect(report.degraded).toMatch(/manifold-3d/);
    } finally { setExactFieldRenderer(exactFieldFaces); }
  });

  it('rides the workbench: stats carry the report, and the kernel is asked for', () => {
    const manifest = { kind: 'workbench', frames: [kigumi] };
    expect(manifestWantsExact(manifest)).toBe(true);
    expect(manifestWantsExact({ kind: 'workbench', frames: [{ members: [] }] })).toBe(false);
    const { stats } = planWorkbench(manifest);
    expect(stats.frames[0].id).toBe('kigumi');
    expect(stats.parts.find((p) => p.kind === 'frame')).toBeTruthy();
    // an empty frames array adds nothing to an existing recipe
    const lathe = { kind: 'workbench', lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 10 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] }] };
    expect(JSON.stringify(lowerObjectFaces({ ...lathe, frames: [] }))).toBe(JSON.stringify(lowerObjectFaces(lathe)));
  });
});
