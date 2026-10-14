import { describe, it, expect } from 'vitest';
import { grassContact, resolveGrassContact, validateGrassContact, GRASS_CONTACT_DEFAULTS } from './grass-contact.js';
import { bendTable } from './wind.js';

const C = resolveGrassContact(true);

describe('grass contact: what touches the grass is a load on the blade', () => {
  it('untouched grass carries no load: an empty bed packs to exactly the zero code, and no impact means no ring', () => {
    const b = grassContact(C); b.follow(10, 10);
    expect(b.live).toBe(false);
    expect(b.loadAt(10, 10, 5)).toEqual([0, 0]);
    const px = b.pack(new Uint8Array(b.N * b.N * 4));
    for (let o = 0; o < px.length; o += 4) { expect(px[o]).toBe(0); expect(px[o + 1]).toBe(127); expect(px[o + 2]).toBe(127); }
  });

  it('a full press is a load the bend table reads as laid: inside its range, the blade near the ground', () => {
    const T = bendTable();
    expect(C.flat * C.press).toBeGreaterThan(0.6 * T.R_MAX);
    expect(C.flat * C.press).toBeLessThanOrEqual(T.R_MAX);
  });

  it('a body lays the grass away from its centre, most at its centre, and along the way it moves', () => {
    const b = grassContact(C); b.follow(0, 0); b.stamp(0, 0, 0.6, 0, 0, 1);
    const [f0] = b.at(0.01, 0.01), [fe, ex] = b.at(0.4, 0.01), [fo] = b.at(0.9, 0);
    expect(f0).toBeGreaterThan(0.75); expect(fe).toBeGreaterThan(0); expect(fe).toBeLessThan(f0); expect(fo).toBe(0);
    expect(ex).toBeGreaterThan(0);   // east of the body, laid east
    const m = grassContact(C); m.follow(0, 0); m.stamp(0, 0, 0.6, 0, 2, 1);
    const [, , ny] = m.at(0.3, -0.3);   // behind and beside a body walking north: laid toward the north
    expect(ny).toBeGreaterThan(0);
  });

  it('laid grass springs back with its half-life, and `recover` 0 keeps no prints', () => {
    const b = grassContact(C); b.follow(0, 0); b.stamp(0, 0, 0.6, 0, 0, 1);
    const f0 = b.at(0.01, 0.01)[0]; b.recover(C.recover);
    expect(b.at(0.01, 0.01)[0]).toBeCloseTo(f0 / 2, 5);
    b.recover(20 * C.recover); expect(b.live).toBe(false); expect(b.at(0.01, 0.01)).toEqual([0, 0, 0]);
    const n = grassContact({ ...C, recover: 0 }); n.follow(0, 0); n.stamp(0, 0, 0.6, 0, 0, 1); n.recover(1 / 60);
    expect(n.live).toBe(false);
  });

  it('the bed slides with the camera by whole cells: a print stays where it was laid, and is forgotten once it slides out', () => {
    const b = grassContact(C); b.follow(0, 0); b.stamp(1, 1, 0.5, 0, 0, 1);
    const at = b.at(1.01, 1.01)[0];
    expect(b.follow(0.05, 0.05)).toBe(false);   // inside the same cell: no slide
    b.follow(5.3, -2.7); expect(b.at(1.01, 1.01)[0]).toBe(at);
    b.follow(5 + C.reach, 0); expect(b.at(1.01, 1.01)[0]).toBe(0);
  });

  it('an impact rings out: a load running outward at the wave speed, dying with its time constant, and a crater left in the bed', () => {
    const b = grassContact(C); b.follow(0, 0); b.impact(0, 0, 1, 10);
    expect(b.at(0.1, 0)[0]).toBeGreaterThan(0.9);   // the crater
    const W = C.wave, at = (r, t) => b.ringAt(r, 0, t)[0];
    // the ring is outward, peaks at the front, and is ahead of nothing before it arrives
    const tau = 0.5, front = W.speed * tau;
    expect(at(front, 10 + tau)).toBeGreaterThan(0);
    expect(at(front, 10 + tau)).toBeGreaterThan(at(front + 2, 10 + tau));
    expect(at(front, 10 + tau)).toBeGreaterThan(at(front - 2, 10 + tau));
    expect(at(3, 9.9)).toBe(0);   // before the impact
    // it dies: past 4.6 time constants it stops ringing
    expect(b.ringing(10 + 5 * W.decay)).toHaveLength(0);
    // the GPU keeps the last `impacts`
    const m = grassContact(C); m.follow(0, 0); for (let i = 0; i < C.impacts + 3; i++) m.impact(i, 0, 1, 1);
    expect(m.ringing(1)).toHaveLength(C.impacts);
  });

  it('a landing is a fall that stops: faster than `land`, its strength its speed / 10; a walk down a slope is none', () => {
    const b = grassContact(C);
    expect(b.landing(-8, 0)).toBeCloseTo(0.8, 6);
    expect(b.landing(-1, 0)).toBe(0);
    expect(b.landing(-8, -7)).toBe(0);   // still falling
  });

  it('the recipe: the card and the recipe over the defaults; false is none; bad values are named', () => {
    expect(resolveGrassContact(false)).toBeNull();
    const r = resolveGrassContact({ recover: 30, wave: { speed: 3 } }, { body: 0.8 });
    expect(r.recover).toBe(30); expect(r.body).toBe(0.8); expect(r.wave.speed).toBe(3); expect(r.wave.decay).toBe(GRASS_CONTACT_DEFAULTS.wave.decay);
    expect(validateGrassContact({ recover: 30, press: 0.4, wave: { decay: 1 } })).toEqual([]);
    expect(validateGrassContact({ press: 2 })[0]).toMatch(/press/);
    expect(validateGrassContact({ stomp: 1 })[0]).toMatch(/must be/);
    expect(validateGrassContact({ wave: { width: 1 } })[0]).toMatch(/wave/);
  });

  it('closes over nothing: the page runs its source', () => {
    const f = new Function(`return (${grassContact.toString()})`)();
    const b = f(C); b.follow(0, 0); b.stamp(0, 0, 0.6, 0, 0, 1);
    expect(b.at(0.01, 0.01)[0]).toBeGreaterThan(0.75);
  });
});
