/**
 * The juice style: the effects' floor composed from the game's register (anime | western, the art direction) and its
 * game type (the animation selector's flavor, the time). The plain floor (`true`) is untouched; what stays global holds in
 * every cell (the landing, a line, a laser); the register reads apart in values and shape, the game type in time; the
 * cells are distinct; dials win; the page draws the drawings a second only when an effect carries them.
 */
import { describe, expect, it } from 'vitest';

import { JUICE_REGISTER_IDS, JUICE_FLAVOR_IDS, readJuiceStyle, juiceFloor, juiceSignature } from './juice-style.js';
import { FX_STYLE, styleBeam, styleExplosion, styleEvents, puffSpec } from './effect-style.js';
import { BEAMS, beamLanding, strandPoints } from '../playscape/elements/beams.js';
import { EXPLOSIONS } from '../playscape/elements/explosions.js';
import { readJuice } from '../playscape/rpg/juice.js';
import { beamScript } from './channels/beam-channel.js';
import { momentScript } from './channels/moment-channel.js';
import { eventsChannelScript } from './channels/events.js';
import { FLAVOR_NAMES } from '../gameworld/feel/flavor.js';
import { TRADITIONS } from '../gameworld/characters.js';

const CELLS = JUICE_REGISTER_IDS.flatMap((register) => JUICE_FLAVOR_IDS.map((flavor) => ({ register, flavor })));
const floor = (register, flavor, dials = {}) => juiceFloor({ register, flavor, ...dials });
const A = [0, 0, 1], T = [8, 0, 1];
const landAt = (B) => { const [a, b] = beamLanding(B)[0]; return a + b * 8; };
// the one plain bolt every floor raises from nothing: no charge, sparks or impact of its own
const PLAIN = { color: [0.5, 0.7, 1], strands: [{ ...BEAMS.orb.strands[0], delay: 0 }] };

describe('juice style: the cards', () => {
  it('names the two traditions and the four game types, and teaches on a bad word', () => {
    expect([...JUICE_REGISTER_IDS].sort()).toEqual(Object.keys(TRADITIONS).sort());
    expect([...JUICE_FLAVOR_IDS].sort()).toEqual([...FLAVOR_NAMES].sort());
    expect(() => readJuiceStyle({ register: 'baroque' })).toThrow(/anime \| western/);
    expect(() => readJuiceStyle({ flavor: 'opera' })).toThrow(/realistic/);
    expect(() => readJuiceStyle({ rate: 9 })).toThrow(/0.25 to 4/);
    expect(() => readJuiceStyle({ glow: 1 })).toThrow(/has no glow/);
    expect(readJuiceStyle({})).toEqual({ register: 'anime', flavor: 'action' });
  });

  it('leaves the plain floor as it was: true is FX_STYLE, byte for byte', () => {
    const ev = { reactions: [{ op: 'beam', name: 'orb', spec: BEAMS.orb, land: beamLanding(BEAMS.orb) }, { op: 'puff', is: 'sparks' }, { op: 'shake', k: 0.5 }] };
    expect(JSON.stringify(styleEvents(ev, FX_STYLE))).toBe(JSON.stringify(styleEvents(ev)));
    expect(styleEvents(ev).reactions[1]).toBe(ev.reactions[1]);
    const plain = eventsChannelScript({ cast: true, ...ev, fxStyle: true });
    expect(plain).not.toContain('I.B.fps');
    expect(plain).not.toContain('I.S.fps');
  });
});

describe('juice style: what stays global, in every cell', () => {
  it('lands every attack on its target, its landing re-read, and keeps a line a line and a laser one beam', () => {
    for (const c of CELLS) {
      const F = floor(c.register, c.flavor);
      for (const name of ['orb', 'serpent', 'ray']) {
        const B = styleBeam(BEAMS[name], name, null, F), core = B.strands[0], t = landAt(B) - 0.5 / 60;
        const R = strandPoints(core, A, T, t, 0, 24);
        expect(R.head, `${c.register}/${c.flavor}/${name}`).toBeTruthy();
        expect(Math.hypot(R.head.p[0] - T[0], R.head.p[1] - T[1]), `${c.register}/${c.flavor}/${name}`).toBeLessThan((core.speed * 0.5) / 60 + 0.05);
      }
      const line = { color: [1, 1, 1], strands: [{ ...BEAMS.laser.strands[0], width: 0.01 }] };
      expect(styleBeam(line, 'line', null, F)).toBe(line);
      expect(styleBeam(BEAMS.laser, 'laser', null, F).strands).toHaveLength(1);
    }
  });

  it('is the same composition every time', () => {
    const F = floor('anime', 'pinball');
    expect(JSON.stringify(styleBeam(BEAMS.serpent, 's', null, F))).toBe(JSON.stringify(styleBeam(BEAMS.serpent, 's', null, floor('anime', 'pinball'))));
    expect(JSON.stringify(styleExplosion(EXPLOSIONS.blast, 'b', F))).toBe(JSON.stringify(styleExplosion(EXPLOSIONS.blast, 'b', F)));
  });
});

describe('juice style: the register is the look', () => {
  it('draws the anime game clean (no ink, near-hue ribbons, glints, a halo, glints drifting up, short tinted smoke), western as material', () => {
    const an = floor('anime', 'action'), we = floor('western', 'action');
    const a = styleBeam(BEAMS.orb, 'orb', null, an), w = styleBeam(BEAMS.orb, 'orb', null, we);
    for (const B of [a, w]) {
      expect(B.strands.every((S) => S.edge === 'glow' && S.ink === undefined)).toBe(true);   // no ink line in either register
      expect(B.fps).toBeUndefined();                                                        // smooth: every frame
    }
    expect(a.strands.filter((S) => S.hue)).toHaveLength(2);
    expect(w.strands.filter((S) => S.hue)).toHaveLength(0);
    expect(a.sparks.glyph).toBe('spark');
    expect(w.sparks.glyph).toBe('streak');
    const xa = styleExplosion(EXPLOSIONS.blast, 'b', an), xw = styleExplosion(EXPLOSIONS.blast, 'b', we);
    expect(xa.comic).toBeUndefined();   // no manga burst
    expect(xa.rings.filter((g) => g.air).length).toBeGreaterThanOrEqual(1);
    const motes = xa.parts.filter((p) => p.glyph === 'spark' && p.gravity < 0 && p.from === 'shell');
    expect(motes).toHaveLength(1);
    expect(xa.key).toContain(xa.parts.indexOf(motes[0]));   // a cue's colour paints them
    expect(xw.parts.some((p) => p.glyph === 'spark' && p.gravity < 0)).toBe(false);
    expect(xa.parts.some((p) => p.glyph === 'chip' || p.glyph === 'streak')).toBe(false);   // glints, no grit
    expect(xw.parts.some((p) => p.glyph === 'chip')).toBe(true);
    expect(xa.parts.filter((p) => p.glyph === 'dot').length).toBeGreaterThan(xw.parts.filter((p) => p.glyph === 'dot').length);   // its fire burns as light
    const soft = (X) => X.parts.filter((p) => p.glyph === 'soft');
    expect(Math.max(...soft(xw).map((p) => p.life))).toBeGreaterThan(Math.max(...soft(xa).map((p) => p.life)));
    const grey = (c) => Math.max(...c) - Math.min(...c) < 0.15;
    const smokeA = soft(xa).flatMap((p) => p.ramp || []), smokeW = soft(xw).flatMap((p) => p.ramp || []);
    expect(smokeA.filter(grey).length).toBeLessThan(smokeW.filter(grey).length);   // its smoke tinted its colour
    const pop = styleExplosion(EXPLOSIONS.pop, 'pop', an);
    expect(pop.rings.filter((g) => g.air)).toHaveLength(EXPLOSIONS.pop.rings.filter((g) => g.air).length);   // a ring of air of its own: no second halo
  });
});

describe('juice style: the game type is the time', () => {
  it('lands soonest at speed, snaps after the deepest charge in action, adds nothing it was not given when realistic', () => {
    const at = (flavor) => landAt(styleBeam(PLAIN, 'p', null, floor('anime', flavor)));
    expect(at('pinball')).toBeLessThan(at('platformer'));
    expect(at('platformer')).toBeLessThan(at('action'));
    const real = styleBeam(PLAIN, 'p', null, floor('western', 'realistic'));
    expect(real.charge).toBeUndefined();
    expect(real.strands[0].arc).toBeFalsy();
    expect(real.strands[0].stretch).toBeUndefined();
    const charge = (flavor) => styleBeam(PLAIN, 'p', null, floor('anime', flavor)).charge?.time ?? 0;
    expect(charge('action')).toBeGreaterThan(Math.max(charge('platformer'), charge('pinball'), charge('realistic')));
    const flight = (flavor) => { const B = styleBeam(PLAIN, 'p', null, floor('anime', flavor)); return landAt(B) - (B.charge?.time ?? 0); };
    expect(flight('action')).toBeLessThan(flight('realistic'));   // the snap after the wind-up
  });

  it('rounds a platformer\'s sparks and keeps them short, streaks and long tails at speed, and plays a blast at its rate', () => {
    const pf = styleExplosion(EXPLOSIONS.pop, 'pop', floor('anime', 'platformer'));
    expect(pf.parts.some((p) => p.glyph === 'spark' || p.glyph === 'streak')).toBe(false);
    expect(styleBeam(PLAIN, 'p', null, floor('anime', 'platformer')).sparks.life).toBeLessThan(FX_STYLE.sparks.life);
    const pin = floor('anime', 'pinball');
    expect(styleBeam(PLAIN, 'p', null, pin).strands.filter((S) => S.alpha).length).toBeGreaterThan(styleBeam(PLAIN, 'p', null, floor('anime', 'realistic')).strands.filter((S) => S.alpha).length);
    expect(styleBeam(PLAIN, 'p', null, pin).fps).toBeUndefined();   // every frame drawn at speed
    const slow = styleExplosion(EXPLOSIONS.blast, 'b', floor('western', 'realistic')), fast = styleExplosion(EXPLOSIONS.blast, 'b', floor('western', 'pinball'));
    expect(fast.dur).toBeLessThan(slow.dur);
  });
});

describe('juice style: compositions', () => {
  it('gives every cell its own signature and its own orb', () => {
    const sigs = CELLS.map((c) => { const s = juiceSignature(floor(c.register, c.flavor)); return `${s.look} / ${s.time}`; });
    expect(new Set(sigs).size).toBe(CELLS.length);
    const orbs = CELLS.map((c) => JSON.stringify(styleBeam(BEAMS.orb, 'orb', null, floor(c.register, c.flavor))));
    expect(new Set(orbs).size).toBe(CELLS.length);
  });

  it('lets a dial win over both cards', () => {
    const F = floor('anime', 'action', { rate: 2, comic: true, companions: false, halo: false, motes: false });
    expect(F.rate).toBe(2);
    const B = styleBeam(PLAIN, 'p', null, F);
    expect(B.strands.filter((S) => S.hue)).toHaveLength(0);
    const X = styleExplosion(EXPLOSIONS.blast, 'b', F);
    expect(X.comic).toBeTruthy();
    expect(X.parts.some((p) => p.glyph === 'spark' && p.gravity < 0)).toBe(false);
  });

  it('styles the preset puffs it can, a beam\'s preset impact, the shakes and a battle\'s juice; a bolt stays the moment\'s own', () => {
    expect(puffSpec('strike')).toBeNull();
    expect(puffSpec('sparks')).toBeTruthy();
    const F = floor('anime', 'action');
    const ev = { reactions: [{ op: 'beam', name: 'laser', spec: BEAMS.laser, land: beamLanding(BEAMS.laser) }, { op: 'puff', is: 'sparks', shake: 0.4 }, { op: 'puff', is: 'strike' }, { op: 'shake', k: 0.5 }],
      rpg: { juice: readJuice(undefined) } };
    const S = styleEvents(ev, F);
    expect(S.reactions[0].spec.impactSpec).toBeTruthy();
    expect(S.reactions[0].land).toEqual(beamLanding(S.reactions[0].spec));
    expect(S.reactions[1].spec.rings.some((g) => g.air)).toBe(true);   // the halo on a preset puff
    expect(S.reactions[1].shake).toBeCloseTo(0.4 * F.shakeK, 3);
    expect(S.reactions[2].spec).toBeUndefined();
    expect(S.reactions[3].k).toBeCloseTo(0.5 * F.shakeK, 3);
    const crit = (J) => J.on.crit.find((s) => s.hold).hold;
    expect(crit(S.rpg.juice)).toBeLessThan(crit(ev.rpg.juice));   // the hold at the game type's pace
  });

  it('draws on drawings a second only when an effect carries them (a dial asks), and the page parses', () => {
    const F = floor('anime', 'action', { fps: 12 }), B = styleBeam(BEAMS.orb, 'orb', null, F);
    expect(B.fps).toBe(12);
    expect(beamScript([BEAMS.orb])).not.toContain('I.B.fps');
    const bs = beamScript([B]);
    expect(bs).toContain('I.B.fps');
    expect(momentScript(['explosion'], { fps: true })).toContain('I.S.fps');
    expect(momentScript(['explosion'])).not.toContain('I.S.fps');
    const page = eventsChannelScript({ cast: true, reactions: [{ do: 'ctrl', op: 'beam', name: 'orb', spec: BEAMS.orb, land: beamLanding(BEAMS.orb) }, { do: 'ctrl', op: 'puff', is: 'sparks' }], fxStyle: { register: 'anime', flavor: 'action', fps: 12 } });
    expect(page).toContain('I.B.fps');
    expect(page).toContain('I.S.fps');
    expect(() => new Function('THREE', 'scene', 'camera', 'renderer', 'window', 'document', `${bs}; return 1;`)).not.toThrow();
  });
});
