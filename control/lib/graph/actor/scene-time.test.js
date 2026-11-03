// the scene on the time map: the screenplay's slow motion and freezes take no scene time, the coverage carries them onto
// its shots, and the film pack lays the scene on the screen's clock; a script that says none is as it was
import { describe, it, expect } from 'vitest';
import { parseScreenplay, SLOW, HOLD } from './screenplay.js';
import { actScene } from './scene.js';
import { coverScene } from './coverage.js';
import { BASELINE } from './baseline.js';
import { sceneFilmFiles, actorsPy } from './scene-film.js';
import { normalizeShoot } from '../shoot/plan.js';
import { programOf } from '../shoot/sample.js';
import { directorsNotes } from './notes.js';

const B = BASELINE.blocked, lines = B.script.split('\n');
// the baseline blocked scene with slow motion over its middle and a freeze before its last line
const timed = { ...B, script: [lines[0], 'Slow motion.', ...lines.slice(1, -1), 'Real time.', 'Freeze 1.5 seconds.', lines.at(-1)].join('\n') };

describe('the scene on the time map', () => {
  it('the screenplay reads slow motion, real time and a freeze', () => {
    const cast = { mara: {} };
    expect(parseScreenplay('MARA: Hi.\nSlow motion.\nSlow motion 0.1.\nReal time.\nFreeze.\nHold 2 seconds.', { cast }).slice(1))
      .toEqual([{ kind: 'slow', speed: SLOW }, { kind: 'slow', speed: 0.1 }, { kind: 'real' }, { kind: 'hold', seconds: HOLD }, { kind: 'hold', seconds: 2 }]);
    expect(() => parseScreenplay('MARA: Hi.\nSlow motion 2.', { cast })).toThrow(/under 1/);
  });

  it('they take no scene time: the scene plays its lines as it did, and says where its time is warped', () => {
    const S0 = actScene(B), S = actScene(timed);
    expect(S0).not.toHaveProperty('time');
    expect(S.seconds).toBe(S0.seconds);
    expect(S.turns).toEqual(S0.turns);
    const [slow, hold] = S.time;
    expect(slow).toMatchObject({ speed: SLOW });
    expect(slow.span[0]).toBeLessThanOrEqual(S.turns[1].at);
    expect(hold).toEqual({ at: slow.span[1], hold: 1.5 });
    // a slow motion never brought back runs to the scene's end
    const open = actScene({ ...B, script: `Slow motion.\n${B.script}` });
    expect(open.time).toEqual([{ span: [S0.turns[0].at, S0.seconds], speed: SLOW }]);
  });

  it('the coverage carries them onto its shots, cut at the shots\' edges, in the shoot plan\'s canonical words', () => {
    const S = actScene(timed), C = coverScene(S, { grain: 2 });
    const stretched = C.shots.filter((s) => s.time?.some((m) => m.span));
    expect(stretched.length).toBeGreaterThan(0);
    for (const s of stretched) for (const m of s.time.filter((x) => x.span)) { expect(m.span[0]).toBeGreaterThanOrEqual(s.span[0]); expect(m.span[1]).toBeLessThanOrEqual(s.span[1]); }
    expect(C.shots.flatMap((s) => s.time ?? []).filter((m) => m.at !== undefined)).toEqual([S.time[1]]);
    expect(C.shots.every((s) => s.grain === 2)).toBe(true);
    expect(normalizeShoot(C).plan.shots).toEqual(C.shots);
    // the program runs longer by the slowed stretch and the freeze
    const world = S.time[0].span[1] - S.time[0].span[0];
    expect(programOf(C).total).toBeCloseTo(S.seconds + world / SLOW - world + 1.5, 6);
    expect(coverScene(actScene(B)).shots.some((s) => s.time || s.grain)).toBe(false);
  });

  it('the film pack lays the scene on the screen\'s clock: frames, the clock, places and cameras every frame', () => {
    const S = actScene(timed), C = coverScene(S), fps = 24;
    const files = Object.fromEntries(sceneFilmFiles({ S, coverage: C, actors: { mara: { take: 'scene' }, jon: { take: 'scene' } }, fps, title: 't' }).map((f) => [f.file, f.text]));
    const J = JSON.parse(files['scene.json']);
    expect(J.frames).toBe(Math.round(programOf({ ...C, fps }).total * fps));
    expect(J.clock).toHaveLength(J.frames);
    for (let f = 1; f < J.clock.length; f++) expect(J.clock[f]).toBeGreaterThanOrEqual(J.clock[f - 1]);
    expect(J.clock.filter((t) => t === S.time[1].at).length).toBeGreaterThanOrEqual(1.5 * fps);
    expect(J.actors.mara.root).toHaveLength(J.frames);
    const shots = Object.entries(files).filter(([k]) => k.startsWith('shots/')).map(([, v]) => JSON.parse(v));
    expect(shots.reduce((n, s) => n + s.frame_count, 0)).toBe(J.frames);
    expect(files['SCENE.md']).toMatch(/time map/);
    expect(actorsPy()).toContain('use_animated_time');
    const plain = JSON.parse(Object.fromEntries(sceneFilmFiles({ S: actScene(B), coverage: coverScene(actScene(B)), actors: { mara: { take: 'scene' }, jon: { take: 'scene' } }, fps, title: 't' }).map((f) => [f.file, f.text]))['scene.json']);
    expect(plain).not.toHaveProperty('clock');
  });

  it('a line under the map draws the director\'s note; slowing only the move draws none', () => {
    const S = actScene(timed), slowed = directorsNotes(S, coverScene(S)).filter((n) => n.id === 'slowed-line');
    expect(slowed.map((n) => n.who)).toEqual(S.turns.filter((T) => T.at < S.time[0].span[1] && T.end > S.time[0].span[0]).map((T) => T.who));
    const moveOnly = { ...B, script: B.script.replace(/^(Mara crosses to the table\.)$/m, 'Slow motion.\n$1\nReal time.') };
    const M = actScene(moveOnly);
    expect(M.time).toHaveLength(1);
    expect(directorsNotes(M, coverScene(M)).filter((n) => n.id === 'slowed-line')).toEqual([]);
  });
});

describe('the film pack\'s grade', () => {
  it('scene.json carries the grade and look.py builds it as compositor nodes; a pack without one carries none', async () => {
    const { readGrade } = await import('../scene/channels/grade.js');
    const { lookPy } = await import('./scene-film.js');
    const S = actScene(B), C = coverScene(S), actors = { mara: { take: 'scene' }, jon: { take: 'scene' } };
    const files = Object.fromEntries(sceneFilmFiles({ S, coverage: C, actors, fps: 24, title: 't', grade: readGrade('noir') }).map((f) => [f.file, f.text]));
    expect(JSON.parse(files['scene.json']).grade).toEqual(readGrade('noir'));
    expect(files['SCENE.md']).toMatch(/compositor/);
    for (const node of ['CompositorNodeHueSat', 'CompositorNodeBrightContrast', 'CompositorNodeEllipseMask', 'compositing_node_group']) expect(lookPy()).toContain(node);
    const plain = Object.fromEntries(sceneFilmFiles({ S, coverage: C, actors, fps: 24, title: 't' }).map((f) => [f.file, f.text]));
    expect(JSON.parse(plain['scene.json'])).not.toHaveProperty('grade');
    expect(plain['SCENE.md']).not.toMatch(/compositor/);
  });
});
