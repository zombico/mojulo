// The stunt room: a cinematic action game's practice room, one set piece on greybox rooftops; offered to Lost Nomad's feel
import { describe, it, expect } from 'vitest';
import { practiceFor } from './practice.js';
import { stuntRoom, STUNT_SET_PIECE } from './stunt-room.js';
import { readCues } from '../playscape/ui/cues.js';

describe('the stunt room', () => {
  it('is offered to a world on the cinematic action feel, and to no other', () => {
    expect(practiceFor({ id: 'g', feel: 'lost-nomad' }).rooms).toContain('stunt');
    expect(practiceFor({ id: 'g', feel: 'steel-serpents' }).rooms).not.toContain('stunt');
  });

  it('lays its set piece on its roofs, held to the set piece\'s laws', () => {
    const R = stuntRoom({ id: 'g', name: 'Lost Nomad', feel: 'lost-nomad' });
    expect(R.laws.filter((l) => !l.ok)).toEqual([]);
    expect(R.manifest.chase.lines[0]).toMatchObject({ id: 'rooftops', cams: expect.any(Array), marks: expect.any(Array) });
    expect(R.manifest.prompts.map((p) => p.id)).toEqual(STUNT_SET_PIECE.prompts.map((p) => p.id));
    expect(() => readCues(R.manifest.play)).not.toThrow();
    expect(R.manifest.tempo.moments.map((m) => m.on)).toEqual(['prompt:grab']);
    expect(R.manifest.entities[0].rule.move).toBe('camera');
  });
});
