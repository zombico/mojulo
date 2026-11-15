import { describe, it, expect } from 'vitest';
import { filmErrors, readFilm, sceneScreenplay, sceneOrder, sceneStamp } from './film.js';
import { DEPARTMENTS, ADVICE_HOME, UNHOMED_NOTES, departmentWaves, departmentOfPath, departmentStates } from './departments.js';
import { filmReadout } from './readout.js';
import { filmBookHtml } from './book.js';
import { actScene } from '../actor/scene.js';
import { coverScene } from '../actor/coverage.js';
import { directorsNotes } from '../actor/notes.js';

// a film: scenes with one cast, the departments that own its recipe, the readout that advises and never refuses
const FILM = {
  title: 'Two rooms',
  cast: { ana: { hero: 'sk_ana', style: 'thespian' }, ben: { persona: 'sk_ben' } },
  sets: { kitchen: 'sk_kitchen' },
  scenes: [
    { id: 'one', set: 'kitchen', cast: { ana: { mark: 'stove' }, ben: { style: 'extra' } }, script: 'ANA: Ready?\nBEN: Ready.' },
    { id: 'two', cast: { ben: {} }, script: 'BEN: Alone at last.' },
  ],
  edit: { order: ['two', 'one'] },
};
const play = (F) => Object.fromEntries(F.scenes.map((S) => {
  const sp = sceneScreenplay(F, S.id), { world_ref: _w, ...rest } = sp, cast = Object.fromEntries(Object.entries(rest.cast).map(([w, C]) => [w, { ...(C.style ? { style: C.style } : {}) }]));
  const P = actScene({ ...rest, cast, marks: undefined }), C = coverScene(P);
  return [S.id, { plan: { S: P, coverage: C, notes: directorsNotes(P, C) } }];
}));

describe('a film', () => {
  it('is checked whole: a scene\'s part the film\'s, a set the film\'s, the edit\'s scenes the film\'s', () => {
    expect(filmErrors(FILM)).toEqual([]);
    const bad = { ...FILM, scenes: [{ id: 'one', set: 'attic', cast: { cara: {} }, script: 'CARA: Hi.' }], edit: { order: ['nine'] } };
    const errs = filmErrors(bad).join('\n');
    expect(errs).toMatch(/cast\.cara: not a part of the film's cast/);
    expect(errs).toMatch(/set: 'attic' is not one of the film's sets/);
    expect(errs).toMatch(/edit\.order/);
    expect(() => readFilm({ ...FILM, cast: { ana: { hero: 'x', persona: 'y' } } })).toThrow(/a persona or a hero, not both/);
    expect(filmErrors({ ...FILM, scenes: [{ ...FILM.scenes[0], cast: { ana: { persona: 'p' } } }] }).join()).toMatch(/its body is the film's/);
  });

  it('gives each scene the screenplay one forge plays: the film\'s parts under the scene\'s words, its set the world', () => {
    const sp = sceneScreenplay(FILM, 'one');
    expect(sp.cast.ana).toEqual({ hero: 'sk_ana', style: 'thespian', mark: 'stove' });
    expect(sp.cast.ben).toEqual({ persona: 'sk_ben', style: 'extra' });
    expect(sp.world_ref).toBe('sk_kitchen');
    expect(Object.keys(sceneScreenplay(FILM, 'two').cast)).toEqual(['ben']);
    expect(sceneOrder(FILM)).toEqual(['two', 'one']);
  });

  it('stamps a scene by what its board is drawn from: an edit moves it, another scene\'s does not', () => {
    const a = sceneStamp(FILM, 'one');
    expect(sceneStamp({ ...FILM, scenes: [{ ...FILM.scenes[0], script: 'ANA: Ready now?\nBEN: Ready.' }, FILM.scenes[1]] }, 'one')).not.toBe(a);
    expect(sceneStamp({ ...FILM, scenes: [FILM.scenes[0], { ...FILM.scenes[1], script: 'BEN: Hm.' }] }, 'one')).toBe(a);
    expect(sceneStamp({ ...FILM, style: 'action-star' }, 'one')).not.toBe(a);
  });
});

describe('the departments', () => {
  it('give every piece of advice, every director\'s note among it, exactly one home', () => {
    expect(UNHOMED_NOTES).toEqual([]);
    const all = DEPARTMENTS.flatMap((D) => D.advice);
    expect(new Set(all).size).toBe(all.length);
    expect(Object.keys(ADVICE_HOME).length).toBe(all.length);
  });
  it('are made in waves, each after all it reads, the render last', () => {
    const waves = departmentWaves(), at = (id) => waves.findIndex((w) => w.includes(id));
    for (const D of DEPARTMENTS) for (const r of D.reads) expect(at(r)).toBeLessThan(at(D.id));
    expect(waves.at(-1)).toEqual(['render']);
  });
  it('own the recipe\'s paths, the most specific pattern first', () => {
    expect(departmentOfPath('/scenes/0/cast/ana/mark')).toBe('set');
    expect(departmentOfPath('/scenes/0/cast/ana/style')).toBe('performance');
    expect(departmentOfPath('/scenes/1/voice')).toBe('voice');
    expect(departmentOfPath('/edit/order')).toBe('edit');
  });
  it('read open where nothing is written, advised where advice stands', () => {
    const S = departmentStates({ ...FILM, sets: undefined, scenes: [{ id: 'two', cast: { ben: {} }, script: 'BEN: Hm.' }] }, [{ id: 'no-close' }]);
    expect(S.set).toBe('open');
    expect(S.camera).toBe('advised');
    expect(S.casting).toBe('written');
  });
});

describe('the readout', () => {
  it('says each scene, the departments\' states and what to do next; approved boards settle, a changed scene is stale', () => {
    const R = filmReadout(FILM, play(FILM), { ref: 'sk_film' });
    expect(R.scenes.map((s) => s.id)).toEqual(['two', 'one']);
    expect(R.advice.find((a) => a.id === 'extra-speaks')?.department).toBe('performance');
    expect(R.next.at(-1).try).toMatch(/run: 'storyboard'/);
    const approvals = { one: { board: sceneStamp(FILM, 'one') }, two: { board: 'old' } };
    const R2 = filmReadout(FILM, play(FILM), { approvals, made: { storyboard: { motion_ref: 'mo_x' } } });
    expect(R2.scenes.map((s) => s.board)).toEqual(['stale', 'approved']);
    expect(R2.advice.map((a) => a.id)).toContain('stale');
    expect(R2.approved).toBe(false);
  });
  it('says a scene that does not play, by name, and reads the rest', () => {
    const P = play(FILM);
    const R = filmReadout(FILM, { ...P, two: { error: "line 1: 'Cara' is not in the cast" } });
    expect(R.scenes.find((s) => s.id === 'two').error).toMatch(/Cara/);
    expect(R.advice[0]).toMatchObject({ id: 'scene-refused', scene: 'two', department: 'script' });
    expect(R.scenes.find((s) => s.id === 'one').lines).toBe(2);
  });
  it('is the book: one self-contained page, every department and every scene, its boards by URL', () => {
    const R = filmReadout(FILM, play(FILM), { ref: 'sk_film' });
    const html = filmBookHtml({ film: FILM, readout: R, boards: { one: { page: '/outcomes/mo_x/scenes/one/index.html', panels: ['/outcomes/mo_x/scenes/one/panels/01.svg'] } } });
    expect(html).not.toMatch(/<script/);
    for (const D of DEPARTMENTS) expect(html).toContain(D.name.replace('&', '&amp;'));
    expect(html).toContain('id="scene-one"');
    expect(html).toContain('panels/01.svg');
  });
});

describe('a scene\'s hour', () => {
  it('rides the scene into its screenplay, and belongs to the look and light department', async () => {
    const { departmentOfPath, ADVICE_HOME } = await import('./departments.js');
    const F = { ...FILM, scenes: FILM.scenes.map((S, i) => (i ? S : { ...S, hour: 'dusk' })) };
    expect(filmErrors(F)).toEqual([]);
    expect(sceneScreenplay(F, F.scenes[0].id).hour).toBe('dusk');
    expect(sceneScreenplay(FILM, FILM.scenes[0].id).hour).toBeUndefined();
    // (a change of hour is a change of the scene: its board's approval reads as stale)
    expect(sceneStamp(F, F.scenes[0].id)).not.toBe(sceneStamp(FILM, FILM.scenes[0].id));
    expect(departmentOfPath('/scenes/0/hour')).toBe('look');
    expect(ADVICE_HOME['hour-unused']).toBe('look');
  });
});

