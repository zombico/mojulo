import { describe, it, expect } from 'vitest';
import { MTS, readMt } from './mts.js';
import { assembleFrame } from './assemble.js';
import { frameBody } from './body.js';
import { frameEntity } from './pilot.js';

// THE MTS (mts.js): smaller frames off the same parts. One case per concept, one MT chosen in code: its build is lawful,
// its body and its entity are drawn and hit at its scale, its armour its share, and a fault is named.
const id = Object.keys(MTS)[0], T = MTS[id];
describe('the MTs', () => {
  it('is a lawful build drawn at its scale, its body, eye, hit volume and bar with it', () => {
    readMt(id);
    expect(assembleFrame(T.build).laws.filter((l) => !l.ok)).toEqual([]);
    const full = frameBody(T.build), small = frameBody(T.build, { scale: T.scale });
    expect(small.height).toBeCloseTo(full.height * T.scale, 2);
    const a = frameEntity(T.build, { id: 'a', at: [0, 0, 0] }), b = frameEntity(T.build, { id: 'b', at: [0, 0, 0], scale: T.scale, ap: T.ap });
    expect(b.body.hp).toBe(Math.round(a.body.hp * T.ap));
    expect(b.body.radius).toBeCloseTo(a.body.radius * T.scale, 1);
    expect(b.body.poise).toBeCloseTo(a.body.poise * T.scale, 1);
    expect(b.rule.eyeH).toBeLessThan(a.rule.eyeH);
    expect(() => readMt('nobody')).toThrow(/is an MT: /);
    expect(() => frameBody(T.build, { scale: 3 })).toThrow(/scale is 0.4 to 1.5/);
  });
});
