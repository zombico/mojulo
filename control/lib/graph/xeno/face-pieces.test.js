// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// THE FACE PIECES (lib/graph/xeno/face-pieces.js): the builders' solids closed and turned outward, one card per kind of
// piece placed where its feature is on a ball of a head (a transfer on the skin, a tip on the ear's top, a drop below its
// lobe, a fang down from the mouth and a tusk up, an eye's colours its groups'), the words refused where they do not
// belong, and on a hero: the ears taken off, the pieces pinned and coated.
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createCharacterHandler } from '@/lib/mcp/tools/create-character';
import { lensMesh, facePatch, FACE_CARDS } from './face-pieces.js';
import { validateXenoHeaddress } from './index.js';
import { xenoFrame } from './frame.js';

getDb();

const closed = (M) => { const n = new Map(); for (const f of M.faces) for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], k = a < b ? `${a}|${b}` : `${b}|${a}`; n.set(k, (n.get(k) || 0) + 1); } return [...n.values()].every((c) => c === 2); };
const volume = (M) => M.faces.reduce((a, [i, j, k]) => { const [p, q, r] = [M.vertices[i], M.vertices[j], M.vertices[k]];
  return a + (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6; }, 0);

/** a ball of a head (radius 0.1 round the origin, the face its +y), its features where a head has them */
const R0 = 0.1;
const onBall = (x, z) => { const y2 = R0 * R0 - x * x - z * z; if (y2 <= 0) return null; const p = [x, Math.sqrt(y2), z]; return { p, n: p.map((v) => v / R0) }; };
const F = { centre: [0, 0, 0], halfWidth: R0, frontY: R0, browZ: 0.02, chinZ: -0.09, noseTip: [0, 0.098, -0.02], height: 0.23,
  front: onBall, surfaceAt: onBall, mouth: { z: -0.05, halfWidth: 0.025 },
  ears: { R: { centre: [0.1, -0.01, 0], side: 1, top: [0.105, -0.015, 0.02], lobe: [0.102, -0.005, -0.02] }, L: { centre: [-0.1, -0.01, 0], side: -1, top: [-0.105, -0.015, 0.02], lobe: [-0.102, -0.005, -0.02] } } };
const build = (card, E = {}) => FACE_CARDS[card].build(F, 1, E);
const zs = (M) => M.vertices.map((v) => v[2]);

describe('the builders', () => {
  it('make a dome and a sculpted patch as closed solids turned outward, the patch\'s point on its outside', () => {
    const L = lensMesh([0, 0.1, 0], [0, 1, 0], [0, 0, 1], { rx: 0.01, ry: 0.006, depth: 0.004, sink: 0.002 });
    expect(closed(L)).toBe(true);
    expect(volume(L)).toBeGreaterThan(0);
    const P = facePatch(F, 1, { cx: 0, cz: -0.02, rx: 0.02, rz: 0.02, lift: () => 0.01 });
    expect(closed(P.mesh)).toBe(true);
    expect(Math.hypot(...P.pointAt(0, -0.02))).toBeGreaterThan(R0 + 0.009);          // lifted off the skin by its lift
  });
});

describe('a piece of each kind, where its feature is', () => {
  it('lays a marking flush on the skin, closed, a hair proud', () => {
    const P = build('tear-lines');
    expect(P.map((p) => p.name)).toEqual(['RLine0', 'LLine0']);
    for (const { mesh } of P) { expect(closed(mesh)).toBe(true); expect(Math.max(...mesh.vertices.map((v) => Math.hypot(...v)))).toBeLessThan(R0 + 0.002); }
  });

  it('glues a tip to the top of each ear and a drop below each lobe', () => {
    const tips = build('pointed-ears'), drops = build('lobe-drops');
    for (const { name, mesh } of tips) expect(Math.max(...zs(mesh)), name).toBeGreaterThan(F.ears[name].top[2] + 0.015);
    for (const { name, mesh } of drops) expect(Math.min(...zs(mesh)), name).toBeLessThan(F.ears[name].lobe[2] - 0.02);
    expect(build('no-ears')).toEqual([]);
    expect(FACE_CARDS['no-ears'].removes).toEqual(['ears']);
  });

  it('hangs fangs down from the mouth and raises tusks up from it, in front of the face', () => {
    for (const { mesh } of build('fangs')) { expect(closed(mesh)).toBe(true); expect(Math.min(...zs(mesh))).toBeLessThan(F.mouth.z - 0.008); }
    for (const { mesh } of build('tusks')) expect(Math.max(...zs(mesh))).toBeGreaterThan(F.mouth.z + 0.01);
  });

  it('opens nostrils as big as its word, and colours an eye by its groups', () => {
    const span = (P) => Math.max(...P.find((p) => p.name === 'RNostril').mesh.vertices.map((v) => v[0])) - Math.min(...P.find((p) => p.name === 'RNostril').mesh.vertices.map((v) => v[0]));
    expect(span(build('snout', { nostrils: 2 }))).toBeGreaterThan(1.8 * span(build('snout')));
    expect(build('third-eye').filter((p) => p.coat).map((p) => [p.name, p.coat.color])).toEqual([['EyeWhite', 'Sclera'], ['EyeIris', 'Iris'], ['EyePupil', 'Pupil']]);
  });
});

describe('the words', () => {
  it('size a nose piece\'s nostrils, and refuse the word on what is not a nose, and ears glued to no ears', () => {
    expect(validateXenoHeaddress([{ card: 'snout', nostrils: 2 }])).toEqual([]);
    expect(validateXenoHeaddress([{ card: 'fangs', nostrils: 2 }]).join(' ')).toMatch(/\[0\]\.nostrils/);
    expect(validateXenoHeaddress([{ card: 'snout', nostrils: 4 }]).join(' ')).toMatch(/0\.5 … 2\.5/);
    expect(validateXenoHeaddress(['no-ears', 'pointed-ears']).join(' ')).toMatch(/no-ears takes the ears off/);
  });
});

describe('on a hero', () => {
  it('takes the ears off, and pins the rest to the head, coated', async () => {
    const out = await createCharacterHandler({ as: 'hero', title: 'face', spec: { cast: 'female', xenoHeaddress: ['no-ears', 'third-eye', { card: 'snout', nostrils: 1.5 }, 'fangs', 'tear-lines'] } });
    const R = SketchRepository.getByRef(out.ref).manifest.recipe, F0 = xenoFrame(R);
    expect([R.parts.earR, R.parts.earL]).toEqual([undefined, undefined]);
    expect(out.hero.xeno[0]).toMatchObject({ card: 'no-ears', pieces: 0, landed: 'takes the ears off' });
    expect(out.hero.xeno.slice(1).every((x) => x.pieces > 0)).toBe(true);
    for (const [n, P] of Object.entries(R.parts).filter(([n]) => n.startsWith('xeno'))) { expect(P.pin.parent, n).toBe(F0.carrier); expect(Object.keys(P.coat.uv), n).toEqual(Object.keys(P.offsets)); }
    expect(R.parts.xenoThirdEye1EyeIris.coat.spec.color).toBe('Iris');
  }, 120_000);
});
