// A RAIL TUNNEL (network/sections.js `rail`, `tube`; passage.js railFinish): a subway's running tunnel between two
// stations' track levels, its tracks at standard gauge on their sleepers with a third rail each, its walkway raised a
// step along its left wall, a box's columns between two tracks, a tube's vault on its rings; walked along its walkway
// from one end to the other and back, straight and round a dog-leg. One case a profile: the box and the vault. And OPEN
// (`open: true`): a run from under the ground up over it, a tunnel to its portal, a cut open to the sky, a stretch at
// grade and a viaduct on its columns, nothing of a tunnel's roof over what is open.
import { describe, it, expect } from 'vitest';
import { passageOf } from './passage.js';
import { readSection, SECTIONS } from './sections.js';
import { walker } from './walk-gate.js';

const over = () => ({ z: 20, under: 'ground' });
const end = (x, y, S) => ({ z0: 10, lo: [x - S.width / 2, y], hi: [x + S.width / 2, y], top: 4.2, plane: y });
const box = Object.keys(SECTIONS).find((id) => SECTIONS[id].finish === 'rail' && SECTIONS[id].profile === 'box');
const vault = Object.keys(SECTIONS).find((id) => SECTIONS[id].finish === 'rail' && SECTIONS[id].profile === 'vault');

describe('a rail tunnel', () => {
  for (const id of [box, vault]) {
    const S = readSection(id), T = passageOf({ id, path: [[20, 0], [20, 100]], a: end(20, 0, S), b: end(20, 100, S), section: S, over, look: { light: 0.4 } });
    const of = (g) => T.faces.filter((f) => f.group === `network:tunnel-${g}`);

    it(`(${id}) lays its tracks at standard gauge on sleepers, a third rail each, the walkway along its left wall`, () => {
      // (a running rail's head is 7 cm wide: two a track, at 1.435 m between their middles)
      const heads = of('rail').filter((f) => f.normal[2] > 0.9).map((f) => (Math.min(...f.corners.map((c) => c[0])) + Math.max(...f.corners.map((c) => c[0]))) / 2);
      const xs = [...new Set(heads.map((x) => Math.round(x * 1000) / 1000))].sort((p, q) => p - q), tracks = S.profile === 'box' ? 2 : 1;
      expect(xs.length).toBe(2 * tracks);
      for (let t = 0; t < tracks; t++) expect(xs[2 * t + 1] - xs[2 * t]).toBeCloseTo(1.435, 3);
      // (a sleeper every 0.7 m: its top a face, a track's worth along the run)
      expect(of('sleeper').filter((f) => f.normal[2] > 0.9).length).toBeGreaterThan(tracks * 130);
      expect(of('third-rail').length).toBeGreaterThan(0);
      // (the walkway: a step up along the left wall (+v, here -x), its edge lined)
      const walk = of('walkway').filter((f) => f.normal[2] > 0.9);
      expect(Math.min(...walk.flatMap((f) => f.corners.map((c) => c[0])))).toBeCloseTo(20 - S.width / 2, 5);
      for (const f of walk) for (const c of f.corners) expect(c[2]).toBeCloseTo(T.level + 0.3, 5);
      expect(of('stripe').length).toBeGreaterThan(0);
      // (a box's columns between its two tracks, each held; a tube's rings round its vault, none)
      if (S.profile === 'box') { expect(of('column').length).toBeGreaterThan(0); expect(T.colliders.some((c) => c.of.includes(':column-'))).toBe(true); }
      else { expect(of('ring').length).toBeGreaterThan(0); expect(of('column')).toEqual([]); }
    });

    it(`(${id}) stands its ${S.profile === 'vault' ? 'arch' : 'ceiling'} at its height, and keeps its cover`, () => {
      const top = Math.max(...of('ceiling').flatMap((f) => f.corners.map((c) => c[2])));
      expect(top - T.level).toBeCloseTo(S.height, 5);
      if (S.profile === 'vault') {
        // (its walls stop at the springing: under the arch's crown by its rise)
        const wallTop = Math.max(...of('wall').filter((f) => Math.abs(f.normal[2]) < 1e-6 && Math.abs(f.normal[1]) < 1e-6).flatMap((f) => f.corners.map((c) => c[2])));
        expect(wallTop - T.level).toBeLessThan(S.height - 1);
        expect(of('ceiling').some((f) => Math.abs(f.normal[2]) < 0.99 && Math.abs(f.normal[2]) > 0.05)).toBe(true);
      }
      expect(T.cover).toBeGreaterThanOrEqual(S.cover - 1e-6);
      expect(T.findings).toEqual([]);
    });

    it(`(${id}) is walked along its walkway, on it where it is raised, end to end and back, straight and round a dog-leg`, () => {
      const mid = T.line.filter((p) => p[1] > 5 && p[1] < 95);
      for (const p of mid) { expect(p[0]).toBeCloseTo(20 - S.width / 2 + 0.5, 5); expect(p[2]).toBeCloseTo(T.level + 0.3, 5); }
      const D = passageOf({ id, path: [[20, 0], [20, 40], [50, 40], [50, 100]], a: end(20, 0, S), b: end(50, 100, S), section: S, over, look: {} });
      for (const t of [T, D]) for (const pts of [t.line, t.line.slice().reverse()]) {
        const r = walker({ faces: t.faces, colliders: t.colliders })(pts);
        expect({ steepest: r.steepest <= 0.31, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
      }
    });
  }

  it('takes a profile on a section of its own, and refuses one it does not know', () => {
    expect(readSection({ from: 'service', profile: 'vault' })).toMatchObject({ profile: 'vault', finish: 'service' });
    expect(() => readSection({ from: box, profile: 'egg' })).toThrow(/profile is box \| vault/);
  });
});

describe('an open rail run', () => {
  for (const id of [box, vault]) {
    // (from 14 m under flat ground up to 9 m over it in 720 m: under 1:30)
    const S = readSection(id), lineEnd = (y, z) => ({ z0: z, lo: [-S.width / 2, y], hi: [S.width / 2, y], top: 4.2, plane: y });
    const T = passageOf({ id, path: [[0, 0], [0, 720]], a: lineEnd(0, -14), b: lineEnd(720, 9), section: S, over: () => ({ z: 0, under: 'ground' }), look: {}, open: true });
    const zAt = (y) => -14 + (23 * y) / 720, inBand = (y0, y1) => T.faces.filter((f) => f.corners.every((c) => c[1] > y0 && c[1] < y1));
    const tunnelTo = 720 * (14 - S.height - 0.3) / 23, cutTo = 720 * 13.5 / 23, viaFrom = 720 * 14.5 / 23;

    it(`(${id}) runs a tunnel to its portal, a cut, a stretch at grade and a viaduct, by where its track lies against the ground`, () => {
      expect(Object.values(T.runs).every((v) => v > 0)).toBe(true);
      expect(Object.values(T.runs).reduce((p, q) => p + q, 0)).toBeCloseTo(720, 0);
      expect(T.runs.tunnel).toBeCloseTo(tunnelTo, -1);
      expect(T.runs.viaduct).toBeCloseTo(720 - viaFrom, -1);
      expect(T.grade).toBeLessThanOrEqual(S.grade + 1e-6);
      expect(T.cover).toBeGreaterThanOrEqual(S.cover - 1e-6);
      expect(T.findings).toEqual([]);
      for (const p of T.line.filter((q) => q[1] > 5 && q[1] < 715)) expect(p[2]).toBeCloseTo(zAt(p[1]) + 0.3, 1);
    });

    it(`(${id}) roofs only its tunnel: its cut open to the sky between retaining walls, its viaduct between parapets on columns`, () => {
      const groups = (fs) => new Set(fs.map((f) => f.group.slice('network:tunnel-'.length)));
      const tun = groups(inBand(20, tunnelTo - 20)), cut = groups(inBand(tunnelTo + 10, cutTo - 10)), via = groups(inBand(viaFrom + 20, 700));
      expect(tun.has('ceiling') && tun.has('lamp')).toBe(true);
      // (a cut's walls carry its signals; nothing of a roof over either, nor a tunnel's walls)
      for (const g of ['ceiling', 'soffit', 'ring', 'wall']) { expect(cut.has(g), `cut ${g}`).toBe(false); expect(via.has(g), `viaduct ${g}`).toBe(false); }
      for (const g of ['lamp', 'signal', 'cable']) expect(via.has(g), `viaduct ${g}`).toBe(false);
      expect(cut.has('retaining')).toBe(true);
      expect(via.has('parapet') && via.has('girder') && via.has('column')).toBe(true);
      // (nothing over the track in the cut faces down on it)
      expect(inBand(tunnelTo + 10, cutTo - 10).filter((f) => f.normal[2] < -0.5 && f.corners.every((c) => Math.abs(c[0]) < S.width / 2 - 0.01))).toEqual([]);
      // (the viaduct's columns stand on the ground under its deck, each held)
      const cols = T.colliders.filter((c) => /:column-\d+-[lr]$/.test(c.of));
      expect(cols.length).toBeGreaterThan(0);
      for (const c of cols) { expect(c.min[2]).toBe(0); expect(c.max[2] - c.min[2]).toBeGreaterThanOrEqual(1.5); expect(c.min[1]).toBeGreaterThan(viaFrom); }
    });

    it(`(${id}) is walked from its tunnel up through its cut and out along its viaduct, and back`, () => {
      for (const pts of [T.line, T.line.slice().reverse()]) {
        const r = walker({ faces: T.faces, colliders: T.colliders })(pts);
        expect({ steepest: r.steepest <= 0.31, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
      }
    });
  }

  it('is a tunnel unless asked open, and says when its ends are too far apart in height for its grade', () => {
    const S = readSection(box), e = (y, z) => ({ z0: z, lo: [-S.width / 2, y], hi: [S.width / 2, y], top: 4.2, plane: y });
    const args = { id: 'x', path: [[0, 0], [0, 100]], a: e(0, 10), b: e(100, 10), section: S, over, look: {} };
    // (a run under deep ground all the way built as the tunnel it would be shut)
    expect(passageOf({ ...args, open: true }).faces).toEqual(passageOf(args).faces);
    expect(passageOf(args).runs).toBeUndefined();
    expect(passageOf({ ...args, open: true }).runs).toMatchObject({ tunnel: 100, cut: 0, grade: 0, viaduct: 0 });
    expect(passageOf({ ...args, b: e(100, 20), open: true, over: () => ({ z: 0, under: 'ground' }) }).findings.join()).toMatch(/steeper than its section's 1:30/);
  });
});
