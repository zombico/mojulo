// anime-sockets: the socket library (each brow and lid drawing carries its own eye socket). The concepts, on each
// family's strongest entry (chosen in code): the table in range and keyed by brow and lid drawings; read under hero laws
// 20 on the head's form only; a neutral socket adds nothing; a brow's socket moves the brow and the face's skin, never the
// eye (its white, lenses, lid band and lashes), the brow block whole (no visor), its clearance of the eye kept; a lid's
// moves the cheek under the eye alone, forward; the skull's word squeezes the orbit (the brow's mass slid down and the
// brow with it, onto the squinting lid and never over it); the face rig's brow and lid targets carry it under laws 20, and a
// drawing the table names not never changes. Every brow over every lid on every cast: anime-drawings.deep.test.js.
import { describe, it, expect } from 'vitest';
import { SOCKETS, SOCKET_RANGES, SOCKET_LAWS, socketsOn, withSocket, socketErrors } from './anime-sockets.js';
import { DRAWINGS, DRAWING_RANGES } from './anime-drawings.js';
import { HERO_LAWS_VERSION } from './hero-form.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { heroFaceRig } from './anime-face-rig.js';
import { build, checkDrawing, moved, folds, headOf, browClearance } from './anime-drawings.fixture.js';

const size = (K) => Object.values(K).reduce((t, v) => t + Math.abs(v), 0);
const family = (layer) => Object.keys(SOCKETS).filter((n) => DRAWINGS[n].layer === layer).sort((a, b) => size(SOCKETS[b]) - size(SOCKETS[a]));
const STRONG = family('brows')[0], FORWARD = family('brows').find((n) => SOCKETS[n].ridge > 0);
const CHEEK = family('lids').find((n) => SOCKETS[n].cheek && !SOCKETS[n].rise && !SOCKETS[n].lift), SQUEEZE = Object.keys(SOCKETS).find((n) => DRAWINGS[n].layer === 'lids' && SOCKETS[n].rise < 0);
const socketed = (n) => withSocket(n, DRAWINGS[n].words, true);

describe('the socket library', () => {
  it('holds the table inside its ranges, each entry a brow or lid drawing\'s; the ranges are the drawing word\'s', () => {
    expect(socketErrors(SOCKETS, DRAWINGS)).toEqual([]);
    expect(SOCKET_RANGES).toBe(DRAWING_RANGES.socket);
    expect(socketErrors({ 'mouth.a': { ridge: 0.01 } })[0]).toMatch(/a brow or lid drawing's/);
    expect(socketErrors({ 'brows.angry': { ridge: 1 } })[0]).toMatch(/a number in/);
  });
  it('is read under hero laws 20 on the anime head\'s form only', () => {
    expect(HERO_LAWS_VERSION).toBeGreaterThanOrEqual(SOCKET_LAWS);
    expect(socketsOn(heroRecord({ cast: 'male', head: 'anime' }))).toBe(true);
    expect(socketsOn(heroRecord({ cast: 'male', head: 'anime', laws: 19 }))).toBe(false);
    expect(socketsOn(heroRecord({ cast: { pole: 'male', build: 'child' }, head: 'anime' }))).toBe(false);   // (the child's own face)
    expect(socketsOn(heroRecord({ cast: 'male' }))).toBe(false);
    expect(withSocket(STRONG, DRAWINGS[STRONG].words, false)).toBe(DRAWINGS[STRONG].words);
    expect(withSocket('brows.rest', {}, true)).toEqual({});   // (a drawing the table names not keeps the head's own socket)
  });
  it('adds nothing at its neutral', () => {
    const w = DRAWINGS[STRONG].words, zero = Object.fromEntries(Object.keys(SOCKET_RANGES).map((k) => [k, 0]));
    expect(build({ ...w, socket: zero })).toEqual(build(w));
  });
  it('moves the brow and the face\'s skin, never the eye; the topology kept, nothing folded', () => {
    checkDrawing(`${STRONG} socketed`, 'brows', socketed(STRONG));
    const M = moved(build(socketed(STRONG)), build(DRAWINGS[STRONG].words));
    expect(Object.keys(M).sort()).toEqual(['browL', 'browR', 'face']);
  });
  it('the lid\'s family: the cheek under the eye alone, never the eye, the lid band or the lashes; nothing folded', () => {
    const A = build(socketed(CHEEK)), P = build(DRAWINGS[CHEEK].words), M = moved(A, P);
    expect(Object.keys(M)).toEqual(['face']);
    for (const n of Object.keys(A)) expect(A[n].faces, n).toEqual(P[n].faces);
    expect(folds(A, P)).toEqual([]);
    // (forward, the head frame's +y, and under the eye: every face vertex it moves sits below the eye's lowest white)
    const spec = { cast: 'male', animeStyle: 'shonen-high' }, H = headOf(spec, DRAWINGS[CHEEK].words), S = headOf(spec, socketed(CHEEK));
    let white = Infinity; H.faces.forEach((f, i) => { if (H.groups[i] === 'Sclera') for (const v of f) white = Math.min(white, H.vertices[v][2]); });
    const pushed = H.vertices.flatMap((p, i) => (Math.hypot(...p.map((x, c) => S.vertices[i][c] - x)) > 1e-7 ? [[p, S.vertices[i]]] : []));
    expect(pushed.length).toBeGreaterThan(0);
    for (const [p, q] of pushed) { expect(p[2]).toBeLessThan(white); expect(q[1]).toBeGreaterThan(p[1] - 1e-9); }
  });
  it('squeezes the orbit (the skull\'s word, a squint\'s): the brow\'s mass slid down onto the eye and the brow with it, still clear of the eye; never the eye or its lashes; nothing folded', () => {
    const A = build(socketed(SQUEEZE)), P = build(DRAWINGS[SQUEEZE].words), M = moved(A, P);
    expect(Object.keys(M).sort()).toEqual(['browL', 'browR', 'face']);
    for (const n of Object.keys(A)) expect(A[n].faces, n).toEqual(P[n].faces);
    expect(folds(A, P)).toEqual([]);
    // (the brow brought down onto the squinting lid, the head frame's +z up, and held clear of it as drawn: the squint's
    // brow moves with the eye by design, never over it)
    const spec = { cast: 'male', animeStyle: 'shonen-high' }, H = headOf(spec, DRAWINGS[SQUEEZE].words), S = headOf(spec, socketed(SQUEEZE));
    const browZ = (m) => { const zs = m.vertices.filter((_, i) => m.provenance[i].part === 'browL').map((p) => p[2]); return zs.reduce((a, b) => a + b, 0) / zs.length; };
    expect(browZ(S)).toBeLessThan(browZ(H) - 0.001);
    expect(browClearance(S)).toBeGreaterThan(0); expect(browClearance(S)).toBeLessThan(browClearance(H));
  });
  it('moves the brow block whole (its bottom row with its top), and keeps its clearance of the eye', () => {
    const spec = { cast: 'male', animeStyle: 'shonen-high' }, w = DRAWINGS[FORWARD].words;
    const A = headOf(spec, w), B = headOf(spec, socketed(FORWARD));
    // (forward is the head frame's +y: over the brow's middle third, short of its tips where the socket fades to the
    // temple, every brow vertex brought forward, its bottom row's least at least half its top row's most)
    const brow = A.vertices.flatMap((p, i) => (A.provenance[i].part === 'browL' ? [[p, B.vertices[i]]] : [])), xs = brow.map(([p]) => p[0]);
    const lo = Math.min(...xs), hi = Math.max(...xs), mid = brow.filter(([p]) => p[0] > lo + (hi - lo) / 3 && p[0] < hi - (hi - lo) / 3);
    const zs = mid.map(([p]) => p[2]), zMid = (Math.min(...zs) + Math.max(...zs)) / 2, fwd = (rows) => rows.map(([p, q]) => q[1] - p[1]);
    const bottom = fwd(mid.filter(([p]) => p[2] < zMid)), top = fwd(mid.filter(([p]) => p[2] >= zMid));
    expect(Math.min(...bottom)).toBeGreaterThan(0.5 * Math.max(...top));
    // (the push is forward in the head's own frame; the head stands at its carriage, chin a little up, so the brow can
    // gain a hair of height over the eye from it, never lose any)
    expect(browClearance(B)).toBeGreaterThanOrEqual(browClearance(A) - 1e-9);
  });
  it('rides in the face rig\'s brow and lid targets under laws 20; a drawing the table names not as before', () => {
    const rig = (laws) => { const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', acting: 'full', register: 'lowpoly', ...(laws ? { laws } : {}) }) }); return heroFaceRig(M, compileLayered(M.recipe, M.dials)); };
    const A = rig(19), B = rig(), col = (R, n) => { const i = R.targets.indexOf(n), W = (1 + R.targets.length) * 3; return Array.from({ length: R.rows.length / W }, (_, r) => [0, 1, 2].map((c) => R.rows[r * W + 3 + i * 3 + c])).flat(); };
    const target = (n) => `draw${n.split('.').map((s) => s[0].toUpperCase() + s.slice(1)).join('')}L`;
    const plainLid = Object.keys(DRAWINGS).find((n) => DRAWINGS[n].layer === 'lids' && DRAWINGS[n].words && !SOCKETS[n]);
    expect(col(B, target(STRONG))).not.toEqual(col(A, target(STRONG)));
    expect(col(B, target(CHEEK))).not.toEqual(col(A, target(CHEEK)));
    expect(col(B, target(plainLid))).toEqual(col(A, target(plainLid)));
  });
}, 300000);
