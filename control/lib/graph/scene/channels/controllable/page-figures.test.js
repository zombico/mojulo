import { describe, it, expect } from 'vitest';
import { pageFigures } from './index.js';

// The figure bank as a level's page reads it (pageFigures): a layered figure (station-loft-rig packLayeredRig) leaves its
// skin's joints and weights to the exports, its parts packed as unit rigs' are and its clips on 16 bits; a figure
// byte-identical to an earlier one is named again; a bank with none of these comes back as it was.

const f32 = (a) => Buffer.from(Float32Array.from(a).buffer).toString('base64');
const u8 = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
const fromF32 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)); };
const fromU16 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)); };
const fromI16 = (s) => { const b = Buffer.from(s, 'base64'); return Array.from(new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2)); };

// two triangles sharing an edge, as a soup of six corners
const SOUP = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const COL = [200, 120, 40, 7, 64, 255, 0, 33, 180, 7, 64, 255, 90, 90, 90, 0, 33, 180];
const clip = { k: 2, b: [0, 0, 0, 1, 0.1, 0.2, 1.5, 0.7071, 0, 0, 0.7071, -0.3, 0.25, 1.4] };
const layered = (extra = {}) => ({
  rig: true, layered: true, bones: [{ id: 'pelvis', head: [0, 0, 0], tail: [0, 0, 1] }],
  parts: [{ pos: f32(SOUP), col: u8(COL), faces: 2, jnt: u8(Array(24).fill(0)), wgt: f32(Array(24).fill(0.25)), inkFaces: 2 }],
  clips: { idle: clip, wait: { ...clip } }, figH: 1.7, ...extra,
});

describe('the figure bank a level\'s page reads', () => {
  it('a bank with no layered figure and no twins comes back as it was', () => {
    const bank = { car: { rig: true, bones: [], parts: [{ pos: f32(SOUP), col: u8(COL) }], clips: { forward: clip } } };
    const P = pageFigures(bank);
    expect(P.figs).toBe(bank);
    expect(P.same).toEqual({});
  });

  it('a layered figure: no skin weights, its part indexed on a uint16 grid, the same triangles', () => {
    const { figs } = pageFigures({ hero: layered() });
    const part = figs.hero.parts[0];
    expect(part.jnt).toBeUndefined();
    expect(part.wgt).toBeUndefined();
    expect(part.pos).toBeUndefined();
    expect(part).toMatchObject({ n: 4, faces: 2, inkFaces: 2 });
    const q = fromU16(part.q), idx = fromU16(part.idx);
    const back = idx.flatMap((i) => [0, 1, 2].map((a) => part.o[a] + q[3 * i + a] * part.s[a]));
    back.forEach((v, i) => expect(v).toBeCloseTo(SOUP[i], 4));
    // its colours byte for byte, each corner's own
    const col = [...Buffer.from(part.col, 'base64')];
    expect(idx.flatMap((i) => col.slice(3 * i, 3 * i + 3))).toEqual(COL);
  });

  it('a skinned figure keeps its weights, and a part with an engine\'s tangent is left as a soup', () => {
    const skinned = pageFigures({ hero: layered({ skin: true }) }).figs.hero.parts[0];
    expect(skinned.wgt).toBeDefined();
    // (a part laid per corner with what only an export reads, a tangent: left as it came, less its skin; one with its
    // paint's place alone is welded as the rest are, below)
    const engine = pageFigures({ hero: { ...layered(), parts: [{ ...layered().parts[0], uv: f32(Array(12).fill(0)), tan: f32(Array(24).fill(0)) }] } }).figs.hero.parts[0];
    expect(engine.pos).toBeDefined();
    expect(engine.wgt).toBeUndefined();
    const painted = pageFigures({ hero: { ...layered(), parts: [{ ...layered().parts[0], uv: f32(Array(12).fill(0)) }] } }).figs.hero.parts[0];
    expect(painted.full).toBe(1);
    expect(painted.pos).toBeUndefined();
  });

  it('its clips on 16 bits, within the grain of the decimals they were written in', () => {
    const { figs } = pageFigures({ hero: layered() });
    const b = figs.hero.clips.idle.b, q = fromI16(b.q16);
    expect(q).toHaveLength(clip.b.length);
    const back = q.map((v, i) => (i % 7 < 4 ? v / 32767 : v * b.s));
    back.forEach((v, i) => expect(Math.abs(v - clip.b[i])).toBeLessThan(1e-4));
    // identical clips are identical strings: the bank's pool keeps one
    expect(figs.hero.clips.wait.b.q16).toBe(b.q16);
  });

  it('a figure byte-identical to an earlier one is named again, not written twice', () => {
    const foe = layered();
    const big = { ...foe, clips: { ...foe.clips, long: { k: 300, b: Array.from({ length: 2100 }, (_, i) => (i % 7 < 4 ? 0.5 : i / 1000)) } } };
    const P = pageFigures({ 'foe-1': big, 'foe-2': structuredClone(big), hero: layered() });
    expect(Object.keys(P.figs)).toEqual(['foe-1', 'hero']);
    expect(P.same).toEqual({ 'foe-2': 'foe-1' });
  });

  it('is deterministic', () => {
    expect(JSON.stringify(pageFigures({ hero: layered() }))).toBe(JSON.stringify(pageFigures({ hero: layered() })));
  });
});

describe('the encounter\'s backdrop', () => {
  it('is drawn only on a page whose fights ask for it, and not one byte of it otherwise', async () => {
    const { controllableChannelScript } = await import('./index.js');
    const ENT = [{ id: 'hero', body: { type: 'box' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const asked = controllableChannelScript(ENT, null, {}, { backdrop: true }), not = controllableChannelScript(ENT, null, {}, {});
    expect(asked).toContain('function __mojBackdrop(from, look, shift)');
    expect(asked).toContain('backdrop: __mojBackdrop,');
    expect(not).not.toContain('__mojBackdrop');
  });
});

describe('the arena\'s clearing', () => {
  it('is on a page whose fights are solved onto the map, and only there', async () => {
    const { emitThreeWorld } = await import('../../scene-three.js');
    const ENT = [{ id: 'hero', body: { type: 'box' }, rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const page = (stage) => emitThreeWorld({ faces: [], entities: ENT, events: { reactions: [{ on: 'rpg-won', do: 'emit', type: 'cheer' }], rpg: { party: [{ id: 'hero', class: 'fighter' }], rules: { stage } } } });
    expect(page('arena')).toContain('window.__mojClip = {');
    // (and the page's module still parses: its shader strings escaped in the emitted script)
    const { spawnSync } = await import('node:child_process');
    const html = page('arena'), mod = html.slice(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));
    const check = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: mod, encoding: 'utf8' });
    expect(check.stderr).toBe('');
    expect(page('live')).not.toContain('window.__mojClip = {');
  });

  // A PART WITH ITS PAINT, ITS NORMALS AND ITS FACE (a realistic hero's): welded and on a grid as a plain part is, its
  // paint's places and normals with it, its face's rows named by the welded corners; one with a tangent stays as it came
  it('a part with its paint, normals and face rows is welded and gridded, and reads back as it was', async () => {
    const { quantMorph, sparseMorph, denseMorph } = await import('../../../figures/morph-sparse.js');
    // (the two triangles, one colour, smooth: the shared edge's corners are the same corner)
    const col = Array(18).fill(120), uv = [0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1], nrm = Array.from({ length: 6 }, () => [0, 0, 1]).flat();
    // a face of one target: the rebase nowhere, the target lifting the corners at (1,0,0) and (0,1,0)
    const rows = [0, 1, 2, 3, 4, 5].map((c) => { const x = SOUP[c * 3], y = SOUP[c * 3 + 1]; return [0, 0, 0, 0, 0, (x + y === 1) ? 0.01 : 0]; }).flat();
    const morph = sparseMorph(quantMorph({ i: Buffer.from(Uint32Array.from([0, 1, 2, 3, 4, 5]).buffer).toString('base64'), d: f32(rows) }));
    const part = { pos: f32(SOUP), col: u8(col), faces: 2, jnt: u8(Array(24).fill(0)), wgt: f32(Array(24).fill(0.25)), uv: f32(uv), nrm: f32(nrm), morph };
    const fig = { rig: true, layered: true, bones: [{ id: 'head', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part], clips: { idle: clip }, figH: 1.7 };
    const [P] = pageFigures({ hero: fig }).figs.hero.parts;
    expect(P.full).toBe(1);
    expect(P.n).toBe(4);
    for (const k of ['pos', 'uv', 'nrm', 'jnt', 'wgt']) expect(P[k], k).toBeUndefined();
    const idx = fromU16(P.idx), q = fromU16(P.q), uq = fromU16(P.uq), nq = Array.from(new Int8Array(Buffer.from(P.nq, 'base64')));
    expect(idx).toHaveLength(6);
    // (each corner reads back to its place and its paint's place, within a grid step; its normal within a byte's)
    for (let c = 0; c < 6; c++) {
      const u = idx[c];
      for (let k = 0; k < 3; k++) expect(P.o[k] + q[u * 3 + k] * P.s[k]).toBeCloseTo(SOUP[c * 3 + k], 4);
      for (let k = 0; k < 2; k++) expect(P.uo[k] + uq[u * 2 + k] * P.us[k]).toBeCloseTo(uv[c * 2 + k], 4);
      expect(nq[u * 3 + 2]).toBe(127);
    }
    // (the face: the two welded corners the target lifts, and no other, with their rows as they were)
    const ab = Buffer.from(P.morph.i, 'base64'), at = Array.from(new Uint32Array(ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.length)));
    expect(P.morph.z.r).toBe(at.length);
    const D = fromI16(denseMorph(P.morph).q), lifted = at.filter((u, r) => D[r * 6 + 5] !== 0);
    expect(lifted.map((u) => [P.o[0] + q[u * 3] * P.s[0], P.o[1] + q[u * 3 + 1] * P.s[1]].map((v) => Math.round(v))).sort()).toEqual([[0, 1], [1, 0]]);
    // (a part with a tangent is an engine's: left as it came, less its skin)
    const [T] = pageFigures({ hero: { ...fig, parts: [{ ...part, tan: f32(Array(24).fill(0)) }] } }).figs.hero.parts;
    expect(T.full).toBeUndefined();
    expect(T.pos).toBe(part.pos);
  });
});
