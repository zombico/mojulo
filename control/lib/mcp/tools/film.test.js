// Isolate to an in-memory SQLite and a scratch outcomes folder — before any import that pulls in db/index.js.
import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const DIR = mkdtempSync(path.join(tmpdir(), 'film-door-'));
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = path.join(DIR, 'outcomes');

import { describe, it, expect } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import { forgeMotionHandler } from './motion.js';
import { filmBook, filmVideoOf, FILM_RUNS } from './film.js';
import { orderStamp } from '@/lib/graph/film/readout.js';
import { SCREENPLAY_EXPORTS } from './scene-film.js';

// the animation studio's door: a film written, read, patched, approved and boarded through forge_motion's `film`
const film = (arg) => forgeMotionHandler({ film: arg });
const WRITE = {
  title: 'Two scenes',
  cast: { ana: {}, ben: {} },
  scenes: [
    { id: 'meet', cast: { ana: {}, ben: {} }, script: 'ANA: Ready?\nBEN: Ready.' },
    { id: 'after', cast: { ben: {} }, script: 'BEN: Done.' },
  ],
};

describe("forge_motion's film", () => {
  it('writes a film row, read as its book, and answers with its readout', async () => {
    const out = await film({ write: WRITE });
    const row = SketchRepository.getByRef(out.ref);
    expect(row.manifest.kind).toBe('film');
    expect(sketchRenderMode(row.manifest)).toBe('bible');
    expect(out.did).toEqual(['written']);
    expect(out.scenes.map((s) => [s.id, s.lines])).toEqual([['meet', 2], ['after', 1]]);
    expect(out.departments.map((D) => D.id)).toContain('render');
    expect(out.advice.filter((a) => a.id === 'no-body').map((a) => a.part)).toEqual(['ana', 'ben']);
    expect(out.next.at(-1).try).toMatch(/run: 'storyboard'/);
  });

  it('refuses what is not a film, a ref the store does not have, and a film call with other arguments', async () => {
    await expect(film({ write: { ...WRITE, scenes: [] } })).rejects.toThrow(/scenes: \[/);
    await expect(film({ write: { ...WRITE, cast: { ana: { persona: 'sk_nobody' }, ben: {} } } })).rejects.toThrow(/not a persona/);
    await expect(film({ write: { ...WRITE, sets: { attic: 'sk_nowhere' }, scenes: [{ ...WRITE.scenes[0], set: 'attic' }] } })).rejects.toThrow(/no stored world/);
    await expect(film({ ref: 'sk_nothing' })).rejects.toThrow(/no sketch, not a film/);
    await expect(forgeMotionHandler({ film: { write: WRITE }, title: 'x' })).rejects.toThrow(/a call of its own/);
  });

  it('boards every scene, approves one, and reads a changed scene as stale', async () => {
    const { ref } = await film({ write: WRITE });
    const ran = await film({ ref, run: 'storyboard' });
    expect(Object.keys(ran.ran.scenes)).toEqual(['meet', 'after']);
    const row = SketchRepository.getByRef(ref);
    expect(row.manifest.made.storyboard.scenes.meet.panels).toBeGreaterThan(0);
    const dir = path.join(DIR, 'outcomes', ran.ran.motion_ref);
    expect(existsSync(path.join(dir, 'index.html'))).toBe(true);
    expect(existsSync(path.join(dir, 'scenes', 'meet', 'panels', '01.svg'))).toBe(true);
    const ok = await film({ ref, approve: { meet: 'board' } });
    expect(ok.scenes.find((s) => s.id === 'meet').board).toBe('approved');
    expect(ok.advice.filter((a) => a.id === 'unapproved').map((a) => a.scene)).toEqual(['after']);
    const edited = await film({ ref, patch: [{ op: 'set', path: '/scenes/0/script', value: 'ANA: Ready now?\nBEN: Ready.' }] });
    expect(edited.scenes.find((s) => s.id === 'meet').board).toBe('stale');
    const book = await filmBook(SketchRepository.getByRef(ref));
    expect(book).toContain('changed since approved');
    expect(book).toContain(`${ran.ran.motion_ref}/scenes/meet/panels/01.svg`);
  });

  it('says a scene that does not play and reads the rest', async () => {
    const out = await film({ write: { ...WRITE, scenes: [WRITE.scenes[0], { id: 'bad', cast: { ben: {} }, script: 'Ben crosses to the moon.' }] } });
    expect(out.scenes.find((s) => s.id === 'bad').error).toMatch(/moon/);
    expect(out.scenes.find((s) => s.id === 'meet').lines).toBe(2);
  });

  it('takes an order, hands the cutscene back as it stands, and lists what a client ordered', async () => {
    const ordered = await film({ order: { title: 'Ordered', from: 'sk_client', for: 'the opening', cast: { ana: {}, ben: {} }, events: [{ id: 'one', notes: 'Ana greets Ben.', script: 'ANA: Hello.\nBEN: Hello.' }, { id: 'two', notes: 'Ben is left alone.' }] } });
    expect(ordered.order).toMatchObject({ from: 'sk_client', for: 'the opening', deliver: 'animatic', ready: false, waiting: ['one', 'two'] });
    expect(ordered.order.events.map((e) => e.state)).toEqual(['written', 'unwritten']);
    expect(ordered.advice.filter((a) => a.id === 'unwritten').map((a) => a.scene)).toEqual(['two']);
    expect(String(await filmBook(SketchRepository.getByRef(ordered.ref)))).toMatch(/The order[\s\S]*Ordered by sk_client[\s\S]*Ben is left alone\./);
    // written from the notes, then handed back before it is cut: said as it stands, never refused
    const written = await film({ ref: ordered.ref, patch: [{ op: 'set', path: '/scenes/1/script', value: 'BEN: So.' }], deliver: true });
    expect(written.did).toEqual(['patched', 'delivered as it stands']);
    expect(written.delivery).toMatchObject({ to: 'sk_client', for: 'the opening', asked: 'animatic', film: ordered.ref, ready: false, waiting: ['one', 'two'] });
    expect(written.order.delivered.current).toBe(true);
    // a change after the hand-back reads as not current
    expect((await film({ ref: ordered.ref, patch: [{ op: 'set', path: '/scenes/1/script', value: 'BEN: So it goes.' }] })).order.delivered.current).toBe(false);
    const mine = await film({ ordered_by: 'sk_client' });
    expect(mine.films.map((f) => f.ref)).toEqual([ordered.ref]);
    expect((await film({ ordered_by: 'sk_nobody' })).films).toEqual([]);
    // a film nobody ordered has nothing to hand back
    await expect(film({ ref: (await film({ write: WRITE })).ref, deliver: true })).rejects.toThrow(/not made to an order/);
    await expect(film({ order: { cast: { ana: {} } } })).rejects.toThrow(/order refused/);
  });
  it('serves the film shot in mojulo over the animatic, until the film is changed', async () => {
    expect(FILM_RUNS).toContain('film');
    expect(SCREENPLAY_EXPORTS).toContain('film');
    const out = await film({ write: WRITE });
    const put = (ref) => { const d = path.join(DIR, 'outcomes', ref); mkdirSync(d, { recursive: true }); writeFileSync(path.join(d, 'motion.mp4'), 'x'); };
    put('mo_anim'); put('mo_shot');
    const row = SketchRepository.getByRef(out.ref), F = row.manifest.film;
    const withMade = (made) => ({ ...row, manifest: { ...row.manifest, made } });
    expect(await filmVideoOf(withMade({ animatic: { motion_ref: 'mo_anim' } }))).toMatchObject({ what: 'animatic' });
    const shot = { animatic: { motion_ref: 'mo_anim' }, native: { motion_ref: 'mo_shot', scenes: {}, cut: { stamp: orderStamp(F) } } };
    expect(await filmVideoOf(withMade(shot))).toMatchObject({ what: 'film', url: expect.stringContaining('mo_shot') });
    // (a cut of the film as it was is not the film's video: the animatic is served until it is shot again)
    expect(await filmVideoOf(withMade({ ...shot, native: { ...shot.native, cut: { stamp: 'old' } } }))).toMatchObject({ what: 'animatic' });
    // (and the run is refused by name where it is not a run)
    await expect(film({ ref: out.ref, run: 'cinema' })).rejects.toThrow(/storyboard \| animatic \| film \| blender/);
  });
});
