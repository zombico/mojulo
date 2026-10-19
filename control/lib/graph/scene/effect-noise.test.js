/**
 * The noise effects: a strand's new words (fan, jag, flicker, forks, fire) and a charge's spell circle read only when
 * given; a fanned copy launched its own way and landing on the line; the material a colour asks for; the beam and status
 * pages drawing lightning, flame, sigils and the hex shield only when an attack or a look carries them, compiling; and
 * the page's noise the module's noise.
 */
import { describe, expect, it } from 'vitest';

import { BEAMS, readBeam, readStrand, strandPoints, beamSignature } from '../playscape/elements/beams.js';
import { LOOKS, readLook } from '../playscape/elements/elements.js';
import { GNOISE2_PAGE_SRC, gnoise2 } from '../noise/noise.js';
import { NOISE_GLSL } from '../noise/noise-glsl.js';
import { FX_STYLE, materialOf, styleBeam } from './effect-style.js';
import { beamScript } from './channels/beam-channel.js';
import { statusScript } from './channels/status-channel.js';

const compiles = (src) => expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${src}; return 1;`)).not.toThrow();

describe('effects noise: the words', () => {
  it('reads fan, jag, flicker, forks and fire only when given, and teaches a bad one', () => {
    const plain = readStrand({ form: 'ray' }, 's');
    for (const k of ['fan', 'jag', 'flicker', 'forks', 'fire']) expect(plain).not.toHaveProperty(k);
    expect(readStrand({ form: 'ray', jag: 0.4, flicker: 10, forks: 2.4 }, 's')).toMatchObject({ jag: 0.4, flicker: 10, forks: 2 });
    expect(readStrand({ fire: false }, 's')).not.toHaveProperty('fire');
    expect(() => readStrand({ fire: 'yes' }, 's')).toThrow(/fire is true/);
    expect(() => readStrand({ jag: 9 }, 's')).toThrow(/lightning/);
  });

  it('opens a spell circle only when the charge names one', () => {
    expect(readBeam({ charge: { time: 1 }, strands: { form: 'ray' } }, 'b').charge).not.toHaveProperty('form');
    expect(readBeam({ charge: { time: 1, form: 'circle' }, strands: { form: 'ray' } }, 'b').charge.form).toBe('circle');
    expect(() => readBeam({ charge: { form: 'square' }, strands: { form: 'ray' } }, 'b')).toThrow(/orb or circle/);
    expect(beamSignature(BEAMS.sigil)).not.toBe(beamSignature({ ...BEAMS.sigil, charge: { ...BEAMS.sigil.charge, form: undefined } }));
  });

  it('launches each fanned copy its own way, smoothly, and lands it on the line', () => {
    const S = BEAMS['itano-laser'].strands[0], A = [0, 0, 1], T = [10, 0, 1], N = 40;
    const at = (j) => strandPoints(S, A, T, 0.75, j, N).spine.map((q) => q.p);
    const a = at(0), b = at(1), mid = (P) => P[P.length >> 2];
    expect(mid(a)).not.toEqual(mid(b));                                   // its own way
    for (const P of [a, b]) {
      expect(Math.hypot(...P.at(-1).map((x, i) => x - T[i]))).toBeLessThan(0.05);   // home on the target
      // smooth: no fold (the turn between neighbouring steps stays gentle the whole way)
      const turn = (i) => { const u = P[i].map((x, k) => x - P[i - 1][k]), v = P[i + 1].map((x, k) => x - P[i][k]); return Math.acos(Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1))); };
      for (let i = 3; i < P.length - 2; i++) expect(turn(i)).toBeLessThan(0.6);
    }
  });
});

describe('effects noise: material by colour', () => {
  it('burns a warm bolt, crackles a pale ray, leaves the rest energy', () => {
    const bolt = { strands: [{ form: 'bolt', width: 0.3 }] }, ray = { strands: [{ form: 'ray', width: 0.1 }] };
    expect(materialOf(bolt, '#ff7a1a')).toBe('fire');
    expect(materialOf(bolt, '#3a8cff')).toBeNull();
    expect(materialOf(ray, [0.85, 0.9, 1])).toBe('lightning');
    expect(materialOf(ray, '#ff3a4a')).toBeNull();
    const F = styleBeam({ color: [1, 0.5, 0.15], strands: [{ ...BEAMS.orb.strands[0] }] }, 'f');
    expect(F.strands[0].fire).toBe(true);
    expect(F.strands.filter((S) => S.hue).every((S) => !S.fire)).toBe(true);      // companions plain
    expect(F.strands.filter((S) => S.alpha).every((S) => S.fire)).toBe(true);     // echoes burn: a trail of flames
    const L = styleBeam({ color: [0.85, 0.9, 1], strands: [{ ...BEAMS.ray.strands[0] }] }, 'l');
    expect(L.strands[0].jag).toBeGreaterThan(0);
    expect(L.strands.slice(1).every((S) => !S.jag && !S.forks)).toBe(true);       // one bolt of lightning
    expect(FX_STYLE.burn.hue).toHaveLength(2);
  });
});

describe('effects noise: the pages', () => {
  it('draws lightning, flame and a sigil only when an attack carries them, and compiles with all of them', () => {
    const plain = beamScript([BEAMS.orb, BEAMS.laser]);
    for (const w of ['__bmJag', '__bmFlame', '__bmSigil', 'nzFbm', '__nzN']) expect(plain).not.toContain(w);
    const all = beamScript([BEAMS.lightning, BEAMS.fireball, BEAMS.sigil, BEAMS.itano, BEAMS['itano-laser']], { fx: true });
    for (const w of ['__bmJag', '__bmFlame', '__bmSigil', 'nzFbm', 'logdepthbuf_fragment']) expect(all).toContain(w);
    compiles(all);
    compiles(beamScript([styleBeam(BEAMS.fireball, 'fireball'), styleBeam(BEAMS.lightning, 'lightning')]));
  });

  it('raises the hex shield only on a look that carries one, and compiles with it', () => {
    expect(readLook({ color: 'copper' }, 'x')).not.toHaveProperty('shield');
    expect(readLook({ shield: { r: 2 } }, 'x').shield).toMatchObject({ r: 2, cells: 6 });
    expect(statusScript({ hot: LOOKS.fire })).not.toContain('__elShield');
    const on = statusScript({ warded: LOOKS.ward });
    expect(on).toContain('__elShield');
    compiles(on);
  });

  it('carries the module\'s noise to the page, the same numbers, and its shader twin the same hash', () => {
    const g = new Function(`return ${GNOISE2_PAGE_SRC};`)();
    for (const [x, y, sd] of [[0.3, 1.7, 1], [-4.2, 9.1, 7], [12.5, -3.25, 3]]) expect(g(x, y, sd)).toBe(gnoise2(x, y, sd));
    expect(NOISE_GLSL).toMatch(/374761393u/);
    expect(NOISE_GLSL).toMatch(/float nzRidged\(/);
  });
});
