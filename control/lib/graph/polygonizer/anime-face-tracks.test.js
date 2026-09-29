// anime-face-tracks.test.js — the anime hero's FACE IN TIME: each clip's facial track drawn on the 30-fps grid (the keys'
// faces held, the eyes only at knots with their in-betweens right before the next key, the mouth and brows already the
// next key's on them, keyed half a frame early, the first drawing the last), the ambient blink (2.5 … 5 s apart, none
// across a seam, seeded and deterministic, never on a shut or changing eye, over a half lid from it and back to it), the
// 12-s face-only layer and the clips it plays over, a hero drawn at its own closure, and `hero.blink: false`.
import { describe, expect, it } from 'vitest';

import { BLINK_RULE, AMBIENT_BLINK, blinkDrawings, faceSeed, placeBlinks, blinkTrack, clipFaceDrawings, heroFaceTracks } from './anime-face-tracks.js';
import { FACE_FPS, EYE_KNOTS, FIX_KNOTS, FACE_TARGETS, fixName, faceWeights, faceState, faceKnots } from './anime-face-rig.js';
import { heroClipSeconds } from './hero-gesture.js';
import { resolveAnimeExpression } from './anime-head.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';

const AUTHORED = resolveAnimeExpression(['smile', { open: 0.3 }]);   // eyes 0.12, smile 1, open 0.3, brow 0.3
const at = (w, n) => w[FACE_TARGETS.indexOf(n)];
/** a drawing's weights back to its face: the eye closures, the mouth, the brow */
const stateOf = (w) => ({ eyeL: +(at(w, 'blink') + at(w, 'blinkLeft')).toFixed(6), eyeR: +(at(w, 'blink') + at(w, 'blinkRight')).toFixed(6), smile: at(w, 'smile'), open: at(w, 'mouthOpen'), brow: +(at(w, 'browInnerLower') - at(w, 'browInnerRaise')).toFixed(6) });
/** a track's drawing at every frame 0 … N (STEP: the last key at or before the frame) */
const perFrame = (d) => { const N = d.f.at(-1); return Array.from({ length: N + 1 }, (_, f) => { let k = 0; while (k + 1 < d.f.length && d.f[k + 1] <= f) k++; return stateOf(d.w[k]); }); };
const eyesDrawn = (w) => { const F = stateOf(w); for (const e of [F.eyeL, F.eyeR]) { if (!EYE_KNOTS.includes(e)) return false; } return FIX_KNOTS.every((k) => at(w, fixName(k, 'L')) === (F.eyeL === k ? 1 : 0) && at(w, fixName(k, 'R')) === (F.eyeR === k ? 1 : 0)); };

describe('a clip\'s facial track', () => {
  it('the keys held on the frame grid; an eye change passes its in-betweens right before the next key, the mouth and brows already the next key\'s; keyed half a frame early', () => {
    const d = clipFaceDrawings({ faces: [null, resolveAnimeExpression(['happy', { open: 0.4 }]), resolveAnimeExpression(['smile', { open: 0.5, brow: -0.2 }]), resolveAnimeExpression(['smile', { open: 0.5, brow: -0.2 }])], seconds: 2, authored: AUTHORED, blink: false });
    // 60 frames, keys at 0, 15, 30, 45: closing 0.12 → 1 passes the half lid (f14); opening 1 → 0.12 the half lid and 0.20 (f28, f29)
    expect(d.f).toEqual([0, 14, 15, 28, 29, 30, 60]);
    expect(d.w.map(stateOf)).toEqual([
      { eyeL: 0.12, eyeR: 0.12, smile: 1, open: 0.3, brow: 0.3 },
      { eyeL: 0.5, eyeR: 0.5, smile: 1, open: 0.4, brow: -0.2 },
      { eyeL: 1, eyeR: 1, smile: 1, open: 0.4, brow: -0.2 },
      { eyeL: 0.5, eyeR: 0.5, smile: 1, open: 0.5, brow: -0.2 },
      { eyeL: 0.2, eyeR: 0.2, smile: 1, open: 0.5, brow: -0.2 },
      { eyeL: 0.12, eyeR: 0.12, smile: 1, open: 0.5, brow: -0.2 },
      { eyeL: 0.12, eyeR: 0.12, smile: 1, open: 0.3, brow: 0.3 },
    ]);
    expect(d.t).toEqual([0, 13.5 / 30, 14.5 / 30, 27.5 / 30, 28.5 / 30, 29.5 / 30, 2]);
    expect(d.w.every(eyesDrawn)).toBe(true);
    expect(d.w[0]).toEqual(d.w.at(-1)); expect(d.w[0]).toEqual(faceWeights(faceState(AUTHORED)));
    expect(d.eyesHold).toBe(false); expect(d.blinks).toEqual([]);
  });
  it('the eyes only ever at knots (a channel between them drawn at the nearest); a list longer than the frames between the keys cut from its end', () => {
    // four keys over a quarter second (8 frames, keys at 0, 2, 4, 6): opening 1 → 0.12 has one frame, the half lid (0.20 cut)
    const d = clipFaceDrawings({ faces: [{ blink: 1 }, null, { blink: 0.93 }, { blink: 0.3, smile: 0.2 }], seconds: 0.25, authored: AUTHORED, blink: false });
    const F = perFrame(d);
    expect(F.map((x) => x.eyeL)).toEqual([1, 0.5, 0.12, 0.5, 1, 0.5, 0.2, 0.5, 1]);
    expect(F[3]).toMatchObject({ smile: 0, open: 0, brow: 0 });   // the in-between before key 2 draws its mouth and brows
    expect(d.w.every(eyesDrawn)).toBe(true);
    expect(d.t.slice(1, -1).every((t, i) => Math.abs(t * FACE_FPS + 0.5 - d.f[i + 1]) < 1e-9)).toBe(true);
    expect(d.t.at(-1)).toBe(0.25);
  });
  it('a clip starting on a face that is not the authored one starts and ends on it (the loop): the victory squeeze', () => {
    const squeeze = { blink: 0.2, smile: 0.6, brow: 0.55 }, cheer = resolveAnimeExpression(['happy', { open: 0.85, brow: -0.6 }]);
    const d = clipFaceDrawings({ faces: [squeeze, cheer, cheer, cheer], seconds: 2, authored: AUTHORED, blink: false });
    expect(d.f).toEqual([0, 14, 15, 59, 60]);
    expect(stateOf(d.w[0])).toEqual({ eyeL: 0.2, eyeR: 0.2, smile: 0.6, open: 0, brow: 0.55 });
    expect(stateOf(d.w[3])).toEqual({ eyeL: 0.5, eyeR: 0.5, smile: 0.6, open: 0, brow: 0.55 });   // opening 1 → 0.2: the half lid only
    expect(d.w[0]).toEqual(d.w.at(-1));
  });
});

describe('the ambient blink', () => {
  it('2.5 … 5 s apart, none across the seam (the last ends 0.3 s before it, the gap across it 2.5 … 6 s), none under 2.5 s; seeded, deterministic', () => {
    for (const seconds of [2.5, 3, 4, 6.5, 12, 30]) {
      const N = Math.round(seconds * FACE_FPS); let placed = 0;
      for (let seed = 0; seed < 150; seed++) {
        const B = placeBlinks(seconds, seed); expect(placeBlinks(seconds, seed)).toEqual(B);
        if (!B.length) continue; placed++;
        for (let i = 1; i < B.length; i++) { const gap = (B[i].frame - B[i - 1].frame) / FACE_FPS; expect(gap).toBeGreaterThanOrEqual(BLINK_RULE.minGap - 1 / FACE_FPS); expect(gap).toBeLessThanOrEqual(BLINK_RULE.maxGap + 1 / FACE_FPS); }
        const last = Math.max(...blinkTrack(B.slice(-1)).keys());
        expect((last + 2) / FACE_FPS).toBeLessThanOrEqual(seconds - BLINK_RULE.seamGuard + 1e-9);
        const seam = (N - B.at(-1).frame + B[0].frame) / FACE_FPS; expect(seam).toBeGreaterThanOrEqual(BLINK_RULE.minGap); expect(seam).toBeLessThanOrEqual(BLINK_RULE.maxGap + 1);
        expect(B[0].frame / FACE_FPS).toBeGreaterThanOrEqual(BLINK_RULE.firstAt[0] - 1 / FACE_FPS);
        for (const b of B) { expect([1, 2]).toContain(b.hold); if (b.double) expect(b.double.gapFrames).toBeGreaterThanOrEqual(4); }
      }
      expect(placed, `${seconds} s`).toBeGreaterThan(100);
    }
    for (const seconds of [0.25, 1, 2, 2.49]) expect(placeBlinks(seconds, 7)).toEqual([]);
    expect(blinkDrawings(1)).toEqual([0.5, 1, 1, 0.5, 0.2]); expect(blinkDrawings(2)).toEqual([0.5, 1, 1, 1, 0.5, 0.2]);
    // the seed: the hero without its clips, stand and blink, and the clip — a clip edit never reshuffles another's blinks
    const hero = heroRecord({ cast: 'female', head: 'anime' });
    expect(faceSeed({ ...hero, clips: { hop: [{}] }, gesture: 'guard', blink: false }, 'idle')).toBe(faceSeed(hero, 'idle'));
    expect(faceSeed(hero, 'idle')).not.toBe(faceSeed(hero, 'idleRelaxed')); expect(faceSeed({ ...hero, cast: 'male' }, 'idle')).not.toBe(faceSeed(hero, 'idle'));
  });
  it('baked over the drawings by max per eye; never on a frame, or the frame either side, whose drawing shuts an eye or changes one; over a half lid it shuts from it', () => {
    const happy = resolveAnimeExpression('happy'), half = { blink: 0.5 };
    let dropped = 0, kept = 0, overHalf = 0;
    for (let seed = 0; seed < 60; seed++) {
      const faces = [null, happy, null, null, half, null, null, null];
      const on = clipFaceDrawings({ faces, seconds: 12, authored: AUTHORED, seed }), off = clipFaceDrawings({ faces, seconds: 12, authored: AUTHORED, seed, blink: false });
      const A = perFrame(on), B = perFrame(off);
      dropped += placeBlinks(12, seed).length - on.blinks.length; kept += on.blinks.length;
      A.forEach((x, f) => {
        if (x.eyeL === B[f].eyeL) return;
        expect(x.eyeL).toBeGreaterThan(B[f].eyeL); expect(x.eyeL).toBe(x.eyeR);   // the blink only ever closes further, both eyes
        for (const g of [f - 1, f, f + 1]) { expect(B[g].eyeL, `seed ${seed} frame ${g}`).toBeLessThan(1); if (g > f - 1) expect(B[g].eyeL).toBe(B[g - 1].eyeL); }
        if (B[f].eyeL === 0.5) overHalf++;
        expect({ smile: x.smile, open: x.open, brow: x.brow }).toEqual({ smile: B[f].smile, open: B[f].open, brow: B[f].brow });
      });
      expect(on.w.every(eyesDrawn)).toBe(true);
    }
    expect(dropped).toBeGreaterThan(0); expect(kept).toBeGreaterThan(0); expect(overHalf).toBeGreaterThan(0);
  });
  it('a hero whose authored eyes rest at the half lid blinks from it: its idle bakes blinks, the layer carries them', () => {
    const hero = heroRecord({ cast: 'female', head: 'anime', expression: 'deadpan' }), p = heroPlanOf(hero);
    const T = heroFaceTracks(hero, p.clips, heroClipSeconds(hero, p.clips), resolveAnimeExpression('deadpan'));
    expect(T.blinks.idle.length).toBeGreaterThan(0); expect(T.blinks[AMBIENT_BLINK.name].length).toBeGreaterThan(0);
    expect(T.ambientOver).toEqual(['gesture', 'walk', 'wave']);
    const eyes = T.ambient.w.map((w) => stateOf(w).eyeL);
    expect(Math.min(...eyes)).toBe(0.5); expect(eyes).toContain(1); expect(eyes.every((e) => e === 0.5 || e === 1)).toBe(true);
  });
});

describe('the hero\'s tracks', () => {
  const clips = { greet: { seconds: 2, keys: [{}, { face: ['happy', { open: 0.4 }] }, { face: ['smile', { open: 0.5, brow: -0.2 }] }, {}] }, run: { seconds: 0.8, keys: [{ face: 'determined' }, {}] } };
  const tracksOf = (spec) => { const hero = heroRecord({ cast: 'female', head: 'anime', expression: ['smile', { open: 0.3 }], ...spec }); const p = heroPlanOf(hero); return { hero, p, T: heroFaceTracks(hero, p.clips, heroClipSeconds(hero, p.clips), resolveAnimeExpression(hero.expression)) }; };
  it('every clip over its designed duration; the 12-s face-only layer; it plays over the clips whose eyes hold with nothing baked', () => {
    const { p, T } = tracksOf({ clips });
    expect(Object.keys(T.tracks)).toEqual(Object.keys(p.clips));
    for (const [name, s] of Object.entries(heroClipSeconds(heroRecord({ cast: 'female', head: 'anime', clips }), p.clips))) {
      const tr = T.tracks[name]; expect(tr.t[0]).toBe(0); expect(tr.t.at(-1), name).toBe(s); expect(tr.w[0], name).toEqual(tr.w.at(-1));
      expect(tr.t.every((t, i) => i === 0 || t > tr.t[i - 1])).toBe(true); expect(tr.w.every(eyesDrawn)).toBe(true);
    }
    // the 4-s idle bakes its blink (so the layer stays off it); the short clips holding the authored eyes take the layer
    expect(T.blinks.idle.length).toBeGreaterThan(0); expect(T.ambientOver).toEqual(['gesture', 'walk', 'wave']);
    expect(T.ambient.name).toBe(AMBIENT_BLINK.name); expect(T.ambient.seconds).toBe(12); expect(T.ambient.t.at(-1)).toBe(12);
    const A = faceWeights(faceState(resolveAnimeExpression(['smile', { open: 0.3 }])));
    expect(T.ambient.w[0]).toEqual(A); expect(T.ambient.w.at(-1)).toEqual(A);
    // the layer moves the eyes only: every other target holds the authored face
    for (const w of T.ambient.w) FACE_TARGETS.forEach((n, i) => { if (!n.startsWith('blink')) expect(w[i]).toBe(A[i]); });
    expect(T.blinks[AMBIENT_BLINK.name].length).toBeGreaterThanOrEqual(2);
    // run: the determined eyes (0.18), its key without a face back on the authored ones, no blink in 0.8 s; greet: the grin
    expect(T.tracks.run.w.map((w) => stateOf(w).eyeL)).toEqual([0.18, 0.12, 0.18]); expect(T.tracks.run.t).toEqual([0, 11.5 / 30, 0.8]);
    expect(T.tracks.greet.w.map((w) => stateOf(w).eyeL)).toEqual([0.12, 0.5, 1, 0.5, 0.2, 0.12, 0.12, 0.12]);
    expect(T.tracks.greet.w.map((w) => stateOf(w).open)).toEqual([0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.3, 0.3]);   // the last key's face the authored
  });
  it('a hero whose own closure sits between the knots is drawn at it: its track keys its own corrective pair, the blinks come back to it', () => {
    const own = resolveAnimeExpression(['neutral', { blink: 0.35 }]), K = faceKnots(own);
    expect(K.own).toBe(0.35); expect(K.targets).toEqual([...FACE_TARGETS, 'blinkFix35L', 'blinkFix35R']); expect(K.eyeKnots).toEqual([0, 0.1, 0.12, 0.18, 0.2, 0.35, 0.5, 1]);
    const d = clipFaceDrawings({ faces: [null, { blink: 1 }, { blink: 0.34 }, null], seconds: 12, authored: own, seed: 3 });
    const eye = (w) => +(w[K.targets.indexOf('blink')] + w[K.targets.indexOf('blinkLeft')]).toFixed(6);
    expect(d.w.every((w) => w.length === K.targets.length && K.eyeKnots.includes(eye(w)))).toBe(true);
    for (const w of d.w) expect(w[K.targets.indexOf('blinkFix35L')]).toBe(eye(w) === 0.35 ? 1 : 0);
    expect(d.w[0]).toEqual(faceWeights(faceState(own), K)); expect(eye(d.w[0])).toBe(0.35);
    // the standard knots and a closure within the name's resolution of one add nothing
    for (const e of ['smile', ['neutral', { blink: 0.12003 }], ['neutral', { blink: 1.2 }]]) expect(faceKnots(resolveAnimeExpression(e)).own).toBeNull();
  });
  it('deterministic; a clip edit leaves another clip\'s track; blink false: nothing baked and no layer', () => {
    const a = tracksOf({ clips }).T;
    expect(tracksOf({ clips }).T).toEqual(a);
    expect(tracksOf({ clips: { ...clips, hop: [{}, {}] } }).T.tracks.idle).toEqual(a.tracks.idle);
    const off = tracksOf({ clips, blink: false }).T;
    expect(off.ambient).toBeUndefined(); expect(off.ambientOver).toEqual([]); expect(off.blinks).toEqual({});
    expect(off.tracks.idle.w.map((w) => stateOf(w).eyeL)).toEqual([0.12, 0.12]);
    expect(off.tracks.greet).toEqual(a.tracks.greet);   // the performance is the door's, not the blink's
  });
});
