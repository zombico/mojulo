// A RAIL TUNNEL (network/sections.js `rail`, `tube`; passage.js railFinish): a subway's running tunnel between two
// stations' track levels, its tracks at standard gauge on their sleepers with a third rail each, its walkway raised a
// step along its left wall, a box's columns between two tracks, a tube's vault on its rings; walked along its walkway
// from one end to the other and back, straight and round a dog-leg. One case a profile: the box and the vault.
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
