// AN OPERATION'S CREW (frame-goal.js CREW): people off the field for its scenes, a character each from the hero door's
// words, stood at their place and raised, on a bridge set where they have one; each a speaker in the script.
import { describe, expect, it } from 'vitest';
import { readOperation, operationCast, CREW } from './frame-goal.js';

const ends = { spawn: [0, 0, 0], heading: Math.PI / 2, ground: () => 0, frame: { half: 500, centre: [0, 0], gravity: 2.47 } };
const CAPTAIN = { form: 'realistic', cast: 'male', hair: 'long', headgear: 'aviators' };
const OP = { groups: [{ id: 'w', kind: 'gnat', at: [0.5, 0.5] }], tasks: [{ down: ['w'] }],
  crew: [{ id: 'quattro', name: 'Captain Quattro', hero: CAPTAIN, at: [0.9, 0.9], raise: 1500, face: 90, set: true }],
  script: { lines: [{ id: 'l1', who: 'quattro', on: { begin: 1 }, text: 'On our six.' }] } };

describe("an operation's crew", () => {
  it('reads: a character in the hero door\'s words, a speaker under its name; or is refused', () => {
    const op = readOperation(OP);
    expect(op.crew[0]).toMatchObject({ id: 'quattro', name: 'Captain Quattro', raise: 1500, set: true });
    expect(op.script.speakers.quattro.name).toBe('Captain Quattro');
    expect(() => readOperation({ ...OP, crew: [{ ...OP.crew[0], id: 'w' }] })).toThrow(/not a group's/);
    expect(() => readOperation({ ...OP, crew: [{ ...OP.crew[0], raise: CREW.raise * 2 }] })).toThrow(/raise is metres/);
    expect(() => readOperation({ ...OP, crew: [{ ...OP.crew[0], hero: 'captain' }] })).toThrow(/hero is the character/);
  });

  it('stands each raised over its place, a character figure, on its bridge set; a spot of its own for the scenes', () => {
    const cast = operationCast(readOperation(OP), ends), Q = cast.entities.find((e) => e.id === 'quattro'), S = cast.entities.find((e) => e.id === 'quattro-set');
    expect(cast.figures['crew-quattro'].hero).toEqual(CAPTAIN);
    expect(Q.transform.pos[2]).toBe(1500);
    expect(S.transform.pos).toEqual(Q.transform.pos);
    expect(S.transform.heading).toBe(Q.transform.heading);
    expect(cast.figures['prop-bridge-set'].unit.kind).toBe('bridge-set');
    expect(cast.play.spots.some((p) => p.id === 'quattro')).toBe(true);
  });
});
