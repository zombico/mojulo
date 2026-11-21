// THE HAND IN THE VIEW. The concepts: it is the figures' own hand (a palm and five digits, one mesh) carried at a run of
// curls with one topology, so the page blends between them; it closes from open to a fist (the fingertips come back
// toward the palm and out of it); it is the same hand every time; and asking the hero's hand for no curl changes nothing.
import { describe, expect, it } from 'vitest';
import { viewHand, VIEW_HAND } from './view-hand.js';
import { heroHand, DIGITS } from '../../polygonizer/hero-hand.js';

describe('the hand in the view', () => {
  const H = viewHand();
  it('is one mesh at a run of curls, every curl the same points in the same order', () => {
    expect(H.curls).toHaveLength(VIEW_HAND.curls);
    for (const c of H.curls) { expect(c).toHaveLength(H.n * 3); expect(c.every(Number.isFinite)).toBe(true); }
    expect(H.tris.length % 3).toBe(0);
    expect(Math.max(...H.tris)).toBeLessThan(H.n);
    expect(viewHand()).toBe(H);
  });
  it('closes: along the hand it shortens, and out of the palm it deepens, curl by curl', () => {
    const reach = (c) => { let y = -1, z = -1; for (let i = 0; i < c.length; i += 3) { y = Math.max(y, c[i + 1]); z = Math.max(z, c[i + 2]); } return [y, z]; };
    const R = H.curls.map(reach);
    for (let k = 1; k < R.length; k++) expect(R[k][0]).toBeLessThan(R[k - 1][0]);
    expect(R.at(-1)[1]).toBeGreaterThan(R[0][1]);
    // (open, it is a hand's length past the wrist: a palm and a middle finger)
    expect(R[0][0]).toBeGreaterThan(VIEW_HAND.len * 1.6);
  });
  it('leaves the hero\'s own hand as it was: no curl asked is the rest hand', () => {
    const at = { wrist: [0.6, 0, 1], elbow: [0.4, 0, 1.1], len: 0.1 };
    expect(heroHand({ ...at, curl: Object.fromEntries(DIGITS.map((d) => [d, 0])) })).toEqual(heroHand(at));
    expect(heroHand({ ...at, curl: { index: 40 } }).segments).not.toEqual(heroHand(at).segments);
  });
});
