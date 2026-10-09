import { describe, it, expect } from 'vitest';
import { readGameworld, readMotion, resolveMotion, motionOrders, heroOrders, AXES, VIBES, AXIS_SPANS, GAIT_BASE } from './index.js';
import { validateHeroMotion } from '../polygonizer/hero-motion.js';

const bad = (m, re) => expect(() => readMotion(m)).toThrow(re);
const world = (motion) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime' }, hero: { motion } } });
const at = (res, g, dial) => res.motion?.[g]?.[dial] ?? GAIT_BASE[g][dial];

describe('the hero\'s motion, by vibe', () => {
  it('says what is wrong', () => {
    bad([], /is \{ vibe\?, axes\?/);
    bad({ mood: 'sad' }, /\.mood is not part of the motion page/);
    bad({ vibe: [] }, /a word or a list of words/);
    bad({ vibe: [3] }, /a word or a list of words/);
    bad({ axes: { speed: 1 } }, /axes.speed is not an axis/);
    bad({ axes: { energy: 2 } }, /number from −1 to 1/);
    bad({ from: { ref: 'h' } }, /the base revision it branched from/);
    bad({ clips: { wave: { seconds: 1 } } }, /clips.wave is \{ seconds, keys/);
    expect(() => readGameworld(world({ axes: { energy: 9 } }))).toThrow(/hero.motion.axes.energy/);
  });

  it('a hero with no vibe and no axes has no motion: its clips are untouched', () => {
    // nothing said, or every axis stated neutral over a vibe: no gait moves, no stand is picked
    for (const M of [undefined, {}, { vibe: ['relaxed'], axes: { energy: 0, weight: 0, poise: 0, confidence: 0 } }]) {
      expect(resolveMotion(M), JSON.stringify(M)).toMatchObject({ motion: null, gesture: null });
    }
    const R = resolveMotion({});
    expect(R).toMatchObject({ motion: null, gesture: null, vibe: [], unread: [], errors: [] });
    expect(motionOrders(R)).toBeNull();
    // and a world with no motion orders none
    expect(heroOrders(readGameworld(world(undefined))).motion).toBeUndefined();
  });

  it('a word the lexicon does not know goes unread, not to an error; the words sum and clamp', () => {
    const R = resolveMotion({ vibe: ['cocky', 'bold', 'swagger', 'unhinged'] });
    expect(R.unread).toEqual(['unhinged']);
    expect(R.vibe).toEqual(['cocky', 'bold', 'swagger']);
    expect(R.axes.confidence).toBe(1);
    expect(R.reasons).toContain('cocky → confidence +0.8');
  });

  it('an axis the creator states wins over what the vibe summed, and says so', () => {
    const R = resolveMotion({ vibe: ['bold'], axes: { confidence: -0.5 } });
    expect(R.axes.confidence).toBe(-0.5);
    expect(R.reasons).toContain('confidence: stated -0.5, over the vibe\'s 0.8');
  });

  it('each axis moves its dials in the documented direction across −1 … 1 (the axis ends read as opposites)', () => {
    for (const k of Object.keys(AXES)) {
      const lo = resolveMotion({ axes: { [k]: -1 } }), hi = resolveMotion({ axes: { [k]: 1 } });
      for (const [g, spans] of Object.entries(AXIS_SPANS[k])) {
        let moved = 0;
        for (const [dial, span] of Object.entries(spans)) {
          const d = at(hi, g, dial) - at(lo, g, dial);
          expect(Math.sign(d) * Math.sign(span) >= 0, `${k} ${g}.${dial}`).toBe(true);
          if (d !== 0) moved++;
        }
        expect(moved, `${k} moves the ${g}`).toBeGreaterThan(0);
      }
    }
  });

  it('every axis end, and every corner of all four, is a motion the hero door accepts', () => {
    const ends = [-1, 0, 1];
    let n = 0;
    for (const energy of ends) for (const weight of ends) for (const poise of ends) for (const confidence of ends) {
      const R = resolveMotion({ axes: { energy, weight, poise, confidence } });
      expect(R.errors, JSON.stringify(R.axes)).toEqual([]);
      if (R.motion) expect(validateHeroMotion(R.motion)).toEqual([]);
      n++;
    }
    expect(n).toBe(81);
  });

  it('only the dials that moved are written, each in its own range, and never a pose', () => {
    const R = resolveMotion({ vibe: ['heavy'] });
    expect(Object.keys(R.motion).sort()).toEqual(['jog', 'sprint', 'walk']);
    for (const d of Object.values(R.motion)) for (const v of Object.values(d)) expect(Number.isFinite(v)).toBe(true);
    expect(R.motion.walk.stanceKnee).toBeGreaterThan(GAIT_BASE.walk.stanceKnee);
    expect(R.motion.walk.swingLift).toBeLessThan(GAIT_BASE.walk.swingLift);
    expect(R.motion.walk).not.toHaveProperty('cadence');
  });

  it('the stand is a prior with its reason: rest when sluggish, guard when spirited and bold, else relaxed; none unfelt', () => {
    expect(resolveMotion({ vibe: ['sluggish'] }).gesture).toBe('rest');
    expect(resolveMotion({ vibe: ['spirited', 'bold'] }).gesture).toBe('guard');
    expect(resolveMotion({ vibe: ['graceful'] }).gesture).toBe('relaxed');
    expect(resolveMotion({ vibe: ['graceful'] }).reasons.join('\n')).toMatch(/relaxed stand/);
    expect(resolveMotion({}).gesture).toBeNull();
  });

  it('pure: the same words resolve to the same bytes', () => {
    const M = { vibe: ['floaty', 'noble'], axes: { energy: 0.3 } };
    expect(JSON.stringify(resolveMotion(M))).toBe(JSON.stringify(resolveMotion(M)));
  });

  it('every vibe word is a vector over real axes, in range', () => {
    for (const [w, v] of Object.entries(VIBES)) for (const [k, x] of Object.entries(v)) {
      expect(AXES[k], `${w}.${k}`).toBeTruthy();
      expect(Math.abs(x), `${w}.${k}`).toBeLessThanOrEqual(1);
    }
  });

  it('orders: patches set the gaits and the stand, and each custom clip, branched from the base; a revision keeps each', () => {
    const clips = { greet: { seconds: 2, keys: [{ head: { yaw: 10 } }] } };
    const R = resolveMotion({ vibe: ['cocky'], from: { ref: 'h1', rev: 1 }, clips });
    const O = motionOrders(R, 'h1');
    expect(O).toMatchObject({ tool: 'update_sketch', part: 'hero:motion', branchedFrom: { ref: 'h1', rev: 1 }, args: { ref: 'h1' } });
    expect(O.args.patch.map((p) => p.path)).toEqual(['/hero/motion', '/hero/gesture', '/hero/clips/greet']);
    expect(O.args.patch[2]).toEqual({ op: 'set', path: '/hero/clips/greet', value: clips.greet });
    const G = readGameworld(world({ vibe: ['cocky'] }));
    expect(heroOrders(G).motion.args.patch[0].path).toBe('/hero/motion');
  });
});
