/**
 * The effects' style floor: an attack raised by rule (anticipation, stretch, an arc, companions braiding one way in an
 * analogous hue, echoes, rings, sparks, a flash), a line and a laser left their own, an explosion swirling one way with
 * its ground ring echoed, the landing re-read, and the page drawing the new words only when an attack carries them.
 */
import { describe, expect, it } from 'vitest';

import { FX_STYLE, styleBeam, styleExplosion, styleEvents } from './effect-style.js';
import { BEAMS, beamLanding } from '../playscape/elements/beams.js';
import { EXPLOSIONS } from '../playscape/elements/explosions.js';
import { beamScript } from './channels/beam-channel.js';

describe('effect style: an attack raised to the floor', () => {
  it('gives a plain bolt anticipation, stretch, an arc, a blended ink, companions one way, echoes and its decoration', () => {
    const B = styleBeam(BEAMS.orb, 'orb'), core = B.strands[0];
    expect(B.charge).toEqual(BEAMS.orb.charge);   // it had one: kept
    expect(core.stretch).toBe(FX_STYLE.stretch);
    expect(core.arc).toBeGreaterThan(0);
    expect(core.ink).toBe(FX_STYLE.ink);
    const comp = B.strands.filter((S) => S.hue), echo = B.strands.filter((S) => S.alpha);
    expect(comp).toHaveLength(2);
    expect(new Set(comp.map((S) => Math.sign(S.twist)))).toHaveProperty('size', 1);   // one hand
    expect(comp.map((S) => S.phase)).toEqual([0, 0.5]);                                 // braided
    expect(Math.abs(comp[0].hue)).toBe(FX_STYLE.companion.hue);
    expect(echo).toHaveLength(FX_STYLE.echoes);
    expect(echo.every((S, k) => S.delay > core.delay && (k === 0 || S.width < echo[k - 1].width) && (k === 0 || S.alpha < echo[k - 1].alpha))).toBe(true);
    expect(B.sparks).toEqual(BEAMS.orb.sparks);   // it had them: kept
  });

  it('turns an attack the same way every time, and adds a charge where there is none', () => {
    expect(JSON.stringify(styleBeam(BEAMS.serpent, 'x'))).toBe(JSON.stringify(styleBeam(BEAMS.serpent, 'x')));
    const plain = { color: [1, 1, 1], strands: [{ ...BEAMS.orb.strands[0], delay: 0 }] };
    const S = styleBeam(plain, 'plain');
    expect(S.charge.time).toBe(FX_STYLE.charge.time);
    expect(S.strands[0].delay).toBe(FX_STYLE.charge.time);
    expect(S.impact).toBe('flash');
  });

  it('leaves a line alone, keeps a laser one beam, and an already braided attack its own strands', () => {
    const line = { color: [1, 1, 1], strands: [{ ...BEAMS.laser.strands[0], width: 0.01 }] };
    expect(styleBeam(line)).toBe(line);
    const L = styleBeam(BEAMS.laser, 'laser');
    expect(L.strands).toHaveLength(1);
    expect(L.rings).toBeUndefined();
    expect(styleBeam(BEAMS.braid, 'braid').strands.filter((S) => S.hue)).toHaveLength(0);
  });
});

describe('effect style: explosions and the world', () => {
  it('swirls an explosion\'s sprays one way and echoes a lone ground ring', () => {
    const X = styleExplosion(EXPLOSIONS.pop, 'pop');
    expect(new Set(X.parts.map((p) => Math.sign(p.swirl)))).toHaveProperty('size', 1);
    const one = { ...EXPLOSIONS.blast, rings: [EXPLOSIONS.blast.rings[0]] };
    expect(styleExplosion(one, 'blast').rings).toHaveLength(2);
    expect(styleExplosion(EXPLOSIONS.blast, 'blast').rings).toHaveLength(EXPLOSIONS.blast.rings.length + 1);   // its ground ring echoed, its air ring its own
    const two = { ...EXPLOSIONS.blast, rings: [EXPLOSIONS.blast.rings[0], { ...EXPLOSIONS.blast.rings[0], r: 2 }] };
    expect(styleExplosion(two, 'blast').rings).toHaveLength(2);   // two on the ground already: left
  });

  it('raises every beam in a world\'s events and re-reads its landing', () => {
    const ev = { reactions: [{ op: 'beam', name: 'orb', spec: BEAMS.orb, land: beamLanding(BEAMS.orb) }, { op: 'say' }] };
    const S = styleEvents(ev);
    expect(S.reactions[0].spec.strands.length).toBeGreaterThan(1);
    expect(S.reactions[0].land).toEqual(beamLanding(S.reactions[0].spec));
    expect(S.reactions[1]).toBe(ev.reactions[1]);
  });

  it('draws hue, opacity, stretch and a blended ink only when an attack carries them', () => {
    const plain = beamScript([BEAMS.orb]);
    for (const w of ['__bmHue', 'S.alpha', 'C.S.stretch', 'S.ink']) expect(plain).not.toContain(w);
    const styled = beamScript([styleBeam(BEAMS.orb, 'orb')]);
    for (const w of ['__bmHue', 'S.alpha', 'C.S.stretch', 'S.ink']) expect(styled).toContain(w);
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${styled}; return 1;`)).not.toThrow();
  });
});
