// hero-relational-head.test.js — the relational head worn by the realistic hero (`head: 'relational'`): a cranium and a
// jaw that close, sealed to the neck on one ring, the face over them (one skin through the lids, the nose and the lips) and the ears, bound with four influences at most, the jaw on the rig's jaw bone so the mouth
// opens, the mouth's ring shut behind its corners whatever turns the head. (Beside the slice, not in the critical tier:
// a realistic mint takes seconds.)
import { describe, it, expect } from 'vitest';

import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { poseLayered } from './hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const refused = (spec) => { try { heroRecord(spec); return null; } catch (e) { return e.message; } };

describe('the relational head on the realistic body', () => {
  it('is the realistic body\'s word: refused without it, and it takes no face, hair or expression', () => {
    expect(refused({ cast: 'female', head: 'relational' })).toMatch(/head: the relational head is worn by the realistic body/);
    expect(refused({ cast: 'female', form: 'realistic', head: 'relational' })).toBeNull();
    expect(refused({ cast: 'female', form: 'realistic', head: 'relational', hair: 'bob' })).toMatch(/hair: only the landmark head or the anime head/);
    expect(heroRecord({ cast: 'female', form: 'realistic', head: 'relational' })).not.toHaveProperty('face');
  });

  it('mints: closes, binds, seals to the neck and opens its jaw', { timeout: 240000 }, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', head: 'relational' }) });
    const P = m.recipe.parts;
    // the landmark head and everything pinned on it are gone; its jaw dial with it
    expect(Object.values(P).filter((p) => p.pin && /^(cranium|jaw)$/.test(p.pin.parent))).toEqual([]);
    expect(m.recipe.dials.jawOpen).toBeUndefined();
    const mesh = compileLayered(m.recipe, m.dials), A = auditLayered(mesh);
    // (the face one skin: hero-relational-head.js oneSkinFace, in place of the visage, the nose and the eyes as pieces)
    for (const k of ['neck', 'jaw', 'cranium', 'visage', 'earR', 'earL']) expect(A[k]?.pass, k).toBe(true);
    expect(P.visage.mesh).toBeTruthy(); expect(P.nose ?? P.eyeR ?? P.eyeL).toBeUndefined();
    const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
    expect(Math.max(...skin.weights.map((w) => w.filter((x) => x > 0).length))).toBeLessThanOrEqual(4);

    // THE SEAM: the neck's last ring is the jaw's first, slot for slot (every fourth head slot a neck point)
    const neck = P.neck, ring = neck.stations.at(-1), jaw0 = P.jaw.stations[0], k = P.jaw.slots.length / neck.slots.length;
    neck.slots.forEach((s, i) => expect(jaw0.points[P.jaw.slots[i * k]]).toEqual(ring.points[s]));
    // and no neck ring above it stands inside the head's shell (the neck ends where the head begins)
    expect(Math.max(...Object.values(ring.points).map((p) => p[2]))).toBeLessThan(Math.min(...Object.values(P.cranium.stations[0].points).map((p) => p[2])));

    // THE MOUTH: the jaw's last ring and the cranium's first, point for point at rest
    const idx = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i])), top = P.jaw.stations.at(-1).id;
    const pair = (s) => [idx[`jaw/${top}.${s}`], idx[`cranium/st0.${s}`]];
    const gap = (V, s) => { const [a, b] = pair(s); return Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1], V[a][2] - V[b][2]); };
    const pose = (p) => poseLayered(mesh, m.recipe, p, { R, skin }).mesh.vertices;
    const behind = P.jaw.slots.filter((s) => s === 'back' || /^s(2\d|3\d|4\d)[RL]$/.test(s));
    // the jaw opens: the lips part at the front, the chin drops, the vault stays
    const open = pose({ jaw: 15 }), rest = pose({});
    expect(gap(rest, 'front')).toBeLessThan(1e-5);
    expect(gap(open, 'front')).toBeGreaterThan(0.008);
    const chin = idx[`jaw/st${Math.round(P.jaw.stations.length / 2)}.front`], crown = idx['cranium/tip'];
    expect(rest[chin][2] - open[chin][2]).toBeGreaterThan(0.005);
    expect(Math.hypot(...[0, 1, 2].map((q) => open[crown][q] - rest[crown][q]))).toBeLessThan(1e-9);
    // the face opens with it: its midline's lowest point (the chin) drops, its foremost (the nose's tip) and its highest
    // (the brow) stay
    const moved = (i) => Math.hypot(...[0, 1, 2].map((q) => open[i][q] - rest[i][q]));
    const mid = mesh.pointIds.map((id, i) => [id, i]).filter(([id, i]) => id.startsWith('visage/') && Math.abs(rest[i][0]) < 0.003).map(([, i]) => i);
    const by = (f) => mid.reduce((b, i) => (f(rest[i]) > f(rest[b]) ? i : b), mid[0]);
    expect(moved(by((v) => -v[2]))).toBeGreaterThan(0.003);
    for (const i of [by((v) => v[1]), by((v) => v[2])]) expect(moved(i), mesh.pointIds[i]).toBeLessThan(1e-9);
    // behind the corners the ring stays shut, opened and under a head and neck turn
    for (const p of [{ jaw: 15 }, { jaw: 15, head: { yaw: 25, pitch: 10 }, neck: { yaw: -15 } }]) {
      const V = pose(p);
      for (const s of behind) expect(gap(V, s), `${JSON.stringify(p)} ${s}`).toBeLessThan(1e-5);
    }
  });
});
