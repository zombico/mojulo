// hero-relational-head.test.js — the relational head worn by the realistic hero (`head: 'relational'`): under realistic
// laws 2 ONE SKIN (hero-one-skin.js) sealed to the neck on its seam ring, its lips cut and parted by the jaw bone; under
// laws 1 a cranium and a jaw that close, sealed to the neck on one ring, the face's parts over them (the visage, the nose, the eyes, the ears), bound with four influences at most, the jaw on the rig's jaw bone so the mouth
// opens, the mouth's ring shut behind its corners whatever turns the head. (Beside the slice, not in the critical tier:
// a realistic mint takes seconds.)
import { describe, it, expect } from 'vitest';

import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { poseLayered } from './hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const refused = (spec) => { try { heroRecord(spec); return null; } catch (e) { return e.message; } };

describe('the relational head on the realistic body', () => {
  it('is the realistic body\'s word: refused without it; the door\'s hair and expression it reads onto its face', () => {
    expect(refused({ cast: 'female', head: 'relational' })).toMatch(/head: the relational head is worn by the realistic body/);
    expect(refused({ cast: 'female', form: 'realistic', head: 'relational' })).toBeNull();
    // (the hair as the face's cut, the expression as its rest: layered.js scalpOfHair, layered.realistic-words.test.js)
    expect(refused({ cast: 'female', form: 'realistic', head: 'relational', hair: 'bob' })).toBeNull();
    expect(heroRecord({ cast: 'female', form: 'realistic', head: 'relational', face: { seed: 2 }, hair: 'bob' }).face.scalp).toBe('bob');
    expect(refused({ cast: 'female', form: 'realistic', head: 'relational', headPreset: 'female' })).toMatch(/headPreset: only the landmark head or the anime head/);
    expect(heroRecord({ cast: 'female', form: 'realistic', head: 'relational' })).not.toHaveProperty('face');
  });

  it('mints in pieces under laws 1: closes, binds, seals to the neck and opens its jaw', { timeout: 240000 }, () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', head: 'relational', physique: { from: 'athletic', laws: 1 } }) });
    const P = m.recipe.parts;
    // the landmark head and everything pinned on it are gone; its jaw dial with it
    expect(Object.values(P).filter((p) => p.pin && /^(cranium|jaw)$/.test(p.pin.parent))).toEqual([]);
    expect(m.recipe.dials.jawOpen).toBeUndefined();
    const mesh = compileLayered(m.recipe, m.dials), A = auditLayered(mesh);
    for (const k of ['neck', 'jaw', 'cranium', 'visage', 'nose', 'eyeR', 'eyeL', 'earR', 'earL']) expect(A[k]?.pass, k).toBe(true);
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
    // the visage opens with it: under the lips (straight down from its middle) it drops, the nose and the eyes stay
    const moved = (id) => Math.hypot(...[0, 1, 2].map((q) => open[idx[id]][q] - rest[idx[id]][q]));
    expect(moved(`visage/st${Math.round(0.6 * P.visage.stations.length)}.back`)).toBeGreaterThan(0.003);
    for (const id of ['nose/tip', 'eyeR/tip', 'eyeL/tip', `visage/st${Math.round(0.6 * P.visage.stations.length)}.front`]) expect(moved(id), id).toBeLessThan(1e-9);
    // behind the corners the ring stays shut, opened and under a head and neck turn
    for (const p of [{ jaw: 15 }, { jaw: 15, head: { yaw: 25, pitch: 10 }, neck: { yaw: -15 } }]) {
      const V = pose(p);
      for (const s of behind) expect(gap(V, s), `${JSON.stringify(p)} ${s}`).toBeLessThan(1e-5);
    }
  });

  it('mints as ONE SKIN under laws 2: sound, sealed to the neck on its seam ring, its lips parted by the jaw bone', { timeout: 240000 }, () => {
    const hero = heroRecord({ cast: 'male', form: 'realistic', head: 'relational' });
    expect(hero.physique.laws).toBeGreaterThanOrEqual(2);
    const m = expandLayeredManifest({ kind: 'layered', hero }), P = m.recipe.parts;
    // the pieces gone, the skin, the mouth and the globes in their place
    for (const k of ['cranium', 'jaw', 'visage', 'nose', 'eyeR', 'eyeL']) expect(P[k], k).toBeUndefined();
    expect(m.recipe.headFit.skin).toBe('one');
    const mesh = compileLayered(m.recipe, m.dials), A = auditLayered(mesh);
    for (const k of ['neck', 'headSkin', 'mouth', 'globeR', 'globeL', 'earR', 'earL']) expect(A[k]?.pass, k).toBe(true);
    // (its faces held to the budget: the skin's and the lips' turn-in)
    expect(Object.keys(P.headSkin.mesh.faces).length).toBeLessThan(34000);
    const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
    expect(Math.max(...skin.weights.map((w) => w.filter((x) => x > 0).length))).toBeLessThanOrEqual(4);
    // THE SEAM: every point of the neck's last ring is a point of the skin's rim
    const pts = Object.values(P.headSkin.mesh.points).map((p) => p.join());
    for (const p of Object.values(P.neck.stations.at(-1).points)) expect(pts).toContain(p.join());
    // THE LIPS: the cut's two sides, one point twice (the head's above, the jaw's below; toward the corners each half the
    // jaw's, laws 12), together at rest, apart opened
    const blend = P.headSkin.bind.blend, at = new Map(), pairs = [];
    for (const [id, p] of Object.entries(P.headSkin.mesh.points)) { const k = p.join(), j = blend[`st0.${id}`]?.jaw ?? 0; if (at.has(k) && Math.abs(at.get(k).j - j) > 1e-6) pairs.push([at.get(k).id, id]); else at.set(k, { id, j }); }
    expect(pairs.length).toBeGreaterThan(20);
    const idx = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i])), pose = (p) => poseLayered(mesh, m.recipe, p, { R, skin }).mesh.vertices;
    const open = pose({ jaw: 15 }), rest = pose({}), gap = (V, [a, b]) => { const u = V[idx[`headSkin/st0.${a}`]], w = V[idx[`headSkin/st0.${b}`]]; return Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]); };
    expect(Math.max(...pairs.map((q) => gap(rest, q)))).toBeLessThan(1e-5);
    expect(Math.max(...pairs.map((q) => gap(open, q)))).toBeGreaterThan(0.008);
    // (realistic laws 12: an almond, not a box: the corners part far less than the middle, met at their ends)
    const xOf = ([a]) => Math.abs(P.headSkin.mesh.points[a][0]), reach = Math.max(...pairs.map(xOf));
    const mid = Math.min(...pairs.filter((q) => xOf(q) < 0.25 * reach).map((q) => gap(open, q))), corner = Math.max(...pairs.filter((q) => xOf(q) > 0.9 * reach).map((q) => gap(open, q)));
    expect(corner).toBeLessThan(0.35 * mid);
    // the crown stays, the globes stay
    const crown = mesh.vertices.reduce((b, v, i) => (mesh.provenance[i].part === 'headSkin' && (b < 0 || v[2] > mesh.vertices[b][2]) ? i : b), -1);
    expect(Math.hypot(...[0, 1, 2].map((q) => open[crown][q] - rest[crown][q]))).toBeLessThan(1e-9);
    const g = idx['globeR/st0.front'];
    expect(Math.hypot(...[0, 1, 2].map((q) => open[g][q] - rest[g][q]))).toBeLessThan(1e-9);
    // THE MOUTH WITH TEETH (realistic laws 12): sound, the upper teeth on the head bone, the lower and the tongue on the
    // jaw's (still while the jaw opens, and dropped with it), every crown behind the lips' front; the cup open, facing in
    for (const k of ['teethUpper', 'teethLower', 'tongue']) expect(A[k]?.pass, k).toBe(true);
    expect(P.teethUpper.bind).toBe('head'); expect(P.teethLower.bind).toBe('jaw'); expect(P.tongue.bind).toBe('jaw');
    const move = (part) => Math.max(...mesh.vertices.map((_, i) => (mesh.provenance[i].part === part ? Math.hypot(...[0, 1, 2].map((q) => open[i][q] - rest[i][q])) : 0)));
    expect(move('teethUpper')).toBeLessThan(1e-9); expect(move('teethLower')).toBeGreaterThan(0.005); expect(move('tongue')).toBeGreaterThan(0.003);
    const lipsFront = Math.max(...pairs.map(([a]) => P.headSkin.mesh.points[a][1]));
    for (const k of ['teethUpper', 'teethLower']) expect(Math.max(...Object.values(P[k].mesh.points).map((p) => p[1]))).toBeLessThan(lipsFront);
    expect(P.mouth.closure).toBe('open');
  });
  it('closes a bag behind the lips under laws 11, as it was minted: no teeth', { timeout: 240000 }, () => {
    const P = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', head: 'relational', physique: { laws: 11 } }) }).recipe.parts;
    expect(P.mouth.closure).toBe('closed'); expect(P.teethUpper).toBeUndefined(); expect(P.tongue).toBeUndefined();
  });
});
