import { describe, it, expect } from 'vitest';
import { TRACK_LANGUAGES, LANGUAGE_OF_CLASS, readLanguage, languageLaws, railFaces, postFaces, kerbFaces } from './track-language.js';
import { planTrack } from './track.js';

const course = { class: 'kart', length: 260, twist: 0.5, seed: 2 };

describe('a track\'s design language', () => {
  it('a card keeps its own laws on a class it suits (one card a rail profile)', () => {
    const byProfile = new Map(Object.entries(TRACK_LANGUAGES).map(([id, c]) => [c.parts.rail.profile, id]));
    for (const id of byProfile.values()) {
      const card = readLanguage(id);
      expect(languageLaws(card, { cls: card.suits[0] }), id).toEqual([]);
    }
    for (const id of Object.values(LANGUAGE_OF_CLASS)) expect(TRACK_LANGUAGES[id]).toBeTruthy();
  });

  it('says what a card loses: a rail and a post of two stuffs, a tell in the rail\'s colour, a class it does not suit', () => {
    const C = readLanguage('candy');
    const odd = { ...C, materials: { ...C.materials, iron: { of: 'steel', finish: 'satin', hex: '#888888' } }, parts: { ...C.parts, rail: { ...C.parts.rail, tell: ['sky', 'cream'], post: { ...C.parts.rail.post, material: 'iron' } } } };
    const lost = languageLaws(odd, { cls: 'circuit' }).map((l) => l.law);
    expect(lost).toEqual(expect.arrayContaining(['one-metal', 'tell', 'suits']));
    expect(() => readLanguage('nougat')).toThrow(/unknown language/);
  });

  it('the parts are raw: a colour of the family, a normal, no light', () => {
    const C = readLanguage('candy'), P = (st, off, dz = 0) => [st.x, st.y + off, dz], A = { x: 0, y: 0 }, B = { x: 1, y: 0 };
    const all = [...railFaces(C, { P, A, B, side: 1, at: 9 }), ...railFaces(C, { P, A, B, side: 1, at: 9, tell: 0 }), ...postFaces(C, { P, st: A, side: 1, at: 9 }), ...kerbFaces(C, { P, A, B, side: -1, from: 4, to: 5, stripe: 1 })];
    const own = new Set(Object.values(C.materials).map((m) => m.hex));
    for (const f of all) { expect(own.has(f.hex)).toBe(true); expect(Math.hypot(...f.normal)).toBeCloseTo(1, 5); expect(f.fill).toBeUndefined(); }
    // a tube looks out of itself: its top faces up, its road side toward the road
    const rail = railFaces(C, { P, A, B, side: 1, at: 9 });
    expect(Math.max(...rail.map((f) => f.normal[2]))).toBeGreaterThan(0.9);
    expect(Math.min(...rail.map((f) => f.normal[1]))).toBeLessThan(-0.9);
  });

  it('a track drawn in a language draws only the family, keeps its walls, and without one is as it was', () => {
    const bare = planTrack({ form: 'circuit', course }), drawn = planTrack({ form: 'circuit', course, language: 'candy' });
    expect(bare.language).toBeUndefined();
    expect(drawn.language.laws).toEqual([]);
    expect(Object.keys(drawn.language.parts).sort()).toEqual(['cap', 'edge', 'kerb', 'post', 'rail']);
    expect(drawn.colliders).toEqual(bare.colliders);
    // absent, not a byte: the same manifest again is the same faces
    expect(JSON.stringify(planTrack({ form: 'circuit', course }).faces)).toBe(JSON.stringify(bare.faces));
  });

  it('the same primitive serves the realistic tuning: a circuit\'s rail in steel on its own road', () => {
    const P = planTrack({ form: 'circuit', course: { class: 'circuit', length: 700, twist: 0.4, seed: 2 }, language: 'grand-prix' });
    expect(P.language.laws).toEqual([]);
    expect(Object.keys(P.language.parts).sort()).toEqual(['post', 'rail']);
  });
});
