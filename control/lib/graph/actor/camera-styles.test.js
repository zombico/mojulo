import { describe, it, expect } from 'vitest';
import { CAMERA_STYLES, cameraStyleOf, cameraStyleErrors } from './camera-styles.js';
import { coverScene } from './coverage.js';
import { actScene } from './scene.js';
import { BASELINE } from './baseline.js';
import { directorsNotes } from './notes.js';
import { coverageCameraAt } from './scene-film.js';
import { sceneFrameRead } from './frame-read.js';
import { SIZES } from '../shoot/frame.js';

const S = actScene(BASELINE.blocked);
// one card for each thing a card can say, chosen from the cards by what they say
const by = (f) => CAMERA_STYLES.find(f);
const noEstablish = by((c) => c.establish === 'none'), frontal = by((c) => c.side === 0 && c.place === 'centre'), oner = by((c) => c.oner);
const pushes = by((c) => c.turn === 'push'), twos = by((c) => c.dialogue === 'two'), shaken = by((c) => c.shake && !c.oner), reacts = by((c) => c.react);
const sizeOfShot = (s) => SIZES.find((z) => s.name.split(' ')[1].replace(':', '') === z.id)?.id;

describe('camera styles', () => {
  it('classical is the coverage with no style, byte for byte', () => {
    expect(JSON.stringify(coverScene(S, { style: 'classical' }))).toBe(JSON.stringify(coverScene(S)));
    expect(coverScene(S).style).toBeUndefined();
  });
  it('a style is said by its id or a word for it; one it does not know is an error that names them', () => {
    expect(cameraStyleOf('hand-held').id).toBe('verite');
    expect(cameraStyleOf('Long take').id).toBe('oner');
    expect(cameraStyleOf('symmetrical').id).toBe('planimetric');
    expect(cameraStyleErrors('wobbly')[0]).toMatch(/classical \| verite/);
    expect(() => coverScene(S, { style: 'wobbly' })).toThrow(/camera style/);
  });
  it('every style covers the whole scene, shot after shot, and says its name', () => {
    for (const c of CAMERA_STYLES.filter((x) => x.id !== 'classical')) {
      const C = coverScene(S, { style: c.id });
      expect(C.style).toBe(c.id);
      expect(C.shots[0].span[0]).toBe(0);
      expect(C.shots.at(-1).span[1]).toBeCloseTo(S.seconds, 3);
      C.shots.forEach((s, i) => { if (i) expect(s.span[0]).toBeCloseTo(C.shots[i - 1].span[1], 6); });
    }
  });
  it('no establishing wide opens on the first speaker', () => {
    const C = coverScene(S, { style: noEstablish.id });
    expect(C.shots[0].camera).not.toBe('wide');
    expect(C.shots[0].camera.endsWith(S.turns[0].who)).toBe(true);
  });
  it('a framing holds the style\'s least before the next cut, but the last', () => {
    for (const c of [noEstablish, frontal, pushes]) {
      const C = coverScene(S, { style: c.id });
      C.shots.slice(0, -1).forEach((s) => expect(s.span[1] - s.span[0]).toBeGreaterThanOrEqual(c.least - 1e-3));
    }
  });
  it('a frontal style\'s singles face the lens and sit in the middle; the read says so', () => {
    const C = coverScene(S, { style: frontal.id });
    const read = sceneFrameRead(S, C);
    const singles = read.shots.filter((r, i) => sizeOfShot(C.shots[i]) === frontal.sizes.single && r.about);
    expect(singles.length).toBeGreaterThan(0);
    for (const r of singles) { expect(r.size).toBe(frontal.sizes.single); expect(r.facing).toBe('toward'); expect(r.across).toBeCloseTo(0.5, 1); }
  });
  it('a push moves in through its shot; a two holds both; a reaction cuts to the listener mid-line', () => {
    const P = coverScene(S, { style: pushes.id }), push = P.shots.find((s) => s.name.includes('push'));
    if (push) { const cam = P.cameras.find((c) => c.id === push.camera), ks = cam.keys.filter((k) => k.t >= push.span[0] - 1e-3 && k.t <= push.span[1] + 1e-3); const d = (k) => Math.hypot(k.pos[0] - k.poi[0], k.pos[1] - k.poi[1]); expect(d(ks.at(-1))).toBeLessThan(d(ks[0])); }
    expect(coverScene(S, { style: twos.id }).cameras.some((c) => c.id === 'two')).toBe(true);
    const R = coverScene(S, { style: reacts.id });
    if (S.turns.some((T) => T.end - T.at > reacts.react)) expect(R.shots.some((s) => s.name.includes('listens'))).toBe(true);
  });
  it('a oner is one camera; each glide starts where the last framing ended', () => {
    const C = coverScene(S, { style: oner.id });
    expect(C.cameras).toHaveLength(1);
    const at = (t, s) => coverageCameraAt(C, t, s).framing.cameraPosition;
    C.shots.slice(1).forEach((s, i) => {
      const a = at(s.span[0], s), b = at(C.shots[i].span[1] - 1e-4, C.shots[i]);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.25);   // (the shake moves it a little)
    });
    // its long takes are its point: the note is not raised
    expect(directorsNotes(S, C).map((n) => n.id)).not.toContain('long-take');
  });
  it('a shaken style shakes the film\'s camera; a classical camera is the keyed one', () => {
    const C = coverScene(S, { style: shaken.id }), s = C.shots[0], t = (s.span[0] + s.span[1]) / 2;
    expect(C.cameras.every((c) => c.shake?.style === shaken.shake)).toBe(true);
    const still = { ...C, cameras: C.cameras.map(({ shake, ...c }) => c) };
    expect(coverageCameraAt(C, t, s).framing.cameraPosition).not.toEqual(coverageCameraAt(still, t, s).framing.cameraPosition);
    const K = coverScene(S);
    expect(K.cameras.some((c) => c.shake)).toBe(false);
  });
  it('deterministic', () => {
    for (const c of [oner, shaken]) expect(JSON.stringify(coverScene(S, { style: c.id }))).toBe(JSON.stringify(coverScene(S, { style: c.id })));
  });
});
