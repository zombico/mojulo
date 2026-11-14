// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDb } from '@/lib/db/index';
import { BASELINE } from '@/lib/graph/actor/baseline.js';
import { resolveSceneCast, planSceneFilm, screenplayErrors, writeSceneFilm, readGrain, packTitle, houseLights } from './scene-film.js';
import { forgeMotionHandler } from './motion.js';

// the scene film's core (scene-film.js): the cast resolved from personas and heroes, the scene planned without a mint,
// a hero that cannot act refused before the first slow mint, and forge_motion's screenplay family refusing what it
// cannot film. The pack itself is actor/scene-film.js's (its own tests); the mint is the realistic hero's (minutes).

const ROWS = {
  pp_ada: { manifest: { kind: 'layered', hero: { cast: 'female', head: 'relational' } } },
  pp_box: { manifest: { kind: 'layered', hero: { cast: 'male', head: 'landmark' } } },
  pp_news: { manifest: { kind: 'persona', persona: { hero: 'pp_ada', register: 'briefing', style: 'action-star', role: { status: 'high' } } } },
};
const getRow = (r) => ROWS[r] ?? null;
const scene = (cast) => ({ ...BASELINE.blocked, cast: { ...BASELINE.blocked.cast, ...cast } });

beforeEach(() => closeDb());

describe('the cast', () => {
  it('plays a persona as itself, its hero the body, the part\'s own words winning', () => {
    const { cast, heroes, sources } = resolveSceneCast(scene({ mara: { persona: 'pp_news', mark: 'door', style: 'thespian' } }), { getRow });
    expect(cast.mara).toEqual({ register: 'briefing', style: 'thespian', role: { status: 'high' }, mark: 'door' });
    expect(heroes.mara).toEqual({ ref: 'pp_ada' });
    expect(sources.mara).toMatch(/persona pp_news/);
  });

  it('gives a style to every part without one, and none to a part that has one', () => {
    const { cast } = resolveSceneCast(scene({ mara: { persona: 'pp_news', mark: 'door' } }), { getRow, style: 'extra' });
    expect(cast.mara.style).toBe('action-star');
    expect(cast.jon.style).toBe('extra');
  });

  it('reads a hero as a ref, a spec or nothing', () => {
    const spec = { form: 'realistic', cast: 'male' };
    const { heroes } = resolveSceneCast(scene({ mara: { hero: 'pp_ada', mark: 'door' }, jon: { hero: spec, mark: 'window' } }), { getRow });
    expect(heroes).toEqual({ mara: { ref: 'pp_ada' }, jon: { spec } });
    expect(resolveSceneCast(BASELINE.blocked, { getRow }).heroes).toEqual({ mara: null, jon: null });
  });

  it('refuses a part that is not a persona, both a persona and a hero, or a word it does not take', () => {
    expect(() => resolveSceneCast(scene({ mara: { persona: 'pp_ada' } }), { getRow })).toThrow(/'pp_ada' is a layered, not a persona/);
    expect(screenplayErrors(scene({ mara: { persona: 'pp_news', hero: 'pp_ada' } })).join()).toMatch(/a persona or a hero, not both/);
    expect(screenplayErrors(scene({ mara: { voice: 'x' } })).join()).toMatch(/not voice/);
    expect(screenplayErrors({ cast: {}, script: '' })).toHaveLength(2);
    expect(screenplayErrors({ ...BASELINE.blocked, shots: [] }).join()).toMatch(/not shots/);
  });
});

describe('the plan, before any mint', () => {
  it('blocks, covers and notes the scene the persona plays', () => {
    const P = planSceneFilm(scene({ mara: { persona: 'pp_news', mark: 'door' } }), { getRow });
    expect(Object.keys(P.S.actors)).toEqual(['mara', 'jon']);
    expect(P.S.actors.mara.register).toBe('briefing');
    expect(P.coverage.shots.length).toBeGreaterThan(1);
    expect(Array.isArray(P.notes)).toBe(true);
  });

  it('keys the grain by word or number', () => {
    expect([readGrain('twos'), readGrain(3), readGrain('3'), readGrain(null)]).toEqual([2, 3, 3, null]);
    expect(() => readGrain('fours')).toThrow(/ones \| twos \| threes/);
  });

  it('names the pack as a file-safe word', () => {
    expect(packTitle('The Key — Act 1')).toBe('the-key-act-1');
    expect(packTitle('!!!')).toBe('scene');
  });

  it('refuses a hero whose face cannot act before it mints anything', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'scene-film-'));
    await expect(writeSceneFilm({ outDir, screenplay: scene({ mara: { hero: 'pp_box', mark: 'door' } }), getRow })).rejects.toThrow(/cast\.mara: hero 'pp_box' cannot act a scene/);
    expect(existsSync(path.join(outDir, 'actors'))).toBe(false);
  });
});

describe("forge_motion's screenplay family", () => {
  const forge = (over) => forgeMotionHandler({ title: 'The key', subject: { screenplay: BASELINE.blocked }, ...over });
  it('is filmed in Blender, shot by its coverage, with its own params', async () => {
    await expect(forge({ export: 'gif' })).rejects.toThrow(/'storyboard' \(the board, the default\), 'mp4'.*not 'gif'/);
    await expect(forge({ shot: { motion: 'orbit' } })).rejects.toThrow(/shot by its coverage/);
    await expect(forge({ shot: { params: { frames: 3 } } })).rejects.toThrow(/look, style, grain, grade, hero, render \(not frames/);
    await expect(forge({ shot: { params: { look: 'noir' } } })).rejects.toThrow(/film \| anime/);
    await expect(forgeMotionHandler({ title: 't', subject: { screenplay: BASELINE.blocked, world_ref: 'sk_x' } })).rejects.toThrow(/family of its own/);
  });
  it('boards a scene by default, no actor minted: a panel a shot, its page and its data', async () => {
    const out = await forge({ subject: { screenplay: { cast: { ana: {}, ben: {} }, script: 'ANA: Ready?\nBEN (determined): *Ready*.' } } });
    expect(out.storyboard.panels).toBe(out.shots.length);
    expect(out.storyboard.page).toMatch(/index\.html$/);
    expect(out.actors).toBeUndefined();
    expect(out.blender).toBeUndefined();
    expect(out.message).toMatch(/export 'blender' makes the film from the same plan/);
  });
  it('boards a scene with its recorded lines: the voice track and the captions beside the board', async () => {
    const { mkdtempSync: mk, writeFileSync: wr } = await import('node:fs');
    const { writeWavMono } = await import('@/lib/graph/beats/beats-song-dsp.js');
    const dir = mk(path.join(tmpdir(), 'sf-voice-')), wav = path.join(dir, 'l1.wav');
    wr(wav, writeWavMono(new Float32Array(16000).map((_, i) => 0.3 * Math.sin(i / 8)), 16000));
    const out = await forge({ subject: { screenplay: { cast: { ana: {}, ben: {} }, script: 'ANA: Ready?\nBEN: Ready.', voice: { 1: wav } } } });
    expect(out.sound.voice.lines).toBe(1);
    expect(out.sound.captions).toMatch(/captions\.srt$/);
    expect(out.message).toMatch(/1 recorded line set the clock/);
  });
  it('refuses a cast ref the store does not have, before writing', async () => {
    await expect(forge({ subject: { screenplay: scene({ mara: { persona: 'sk_nobody' } }) } })).rejects.toThrow(/'sk_nobody' is no sketch, not a persona/);
  });
});

describe('a walled set with no light of its own', () => {
  it('takes house lights: a panel under each walled room’s ceiling, sized and powered by its floor', () => {
    const [L, ...rest] = houseLights([{ id: 'lounge', min: [0, 0], max: [5, 4], walled: true, h: 3 }, { id: 'hall', min: [5, 0], max: [9, 4] }]);
    expect(rest).toEqual([]);
    expect(L).toEqual({ room: 'lounge', at: [2.5, 2, 2.85], size: [3, 2.4], watts: 600 });
    expect(houseLights(null)).toEqual([]);
  });
  it('is shot from inside its rooms', () => {
    const sp = { cast: { ada: { mark: 'a' }, jon: { mark: 'b' } }, marks: { a: [1.8, 3], b: [3.2, 3] }, script: 'ADA: You kept the key.\nJON: I kept everything.' };
    const set = { rooms: [{ id: 'lounge', min: [0, 0], max: [5, 4], walled: true, h: 3 }] };
    const inside = planSceneFilm(sp, { getRow: () => null, set }).coverage.cameras.flatMap((c) => c.keys.map((k) => k.pos));
    for (const p of inside) { expect(p[1]).toBeGreaterThanOrEqual(0); expect(p[1]).toBeLessThanOrEqual(4); }
    expect(planSceneFilm(sp, { getRow: () => null }).coverage.cameras[0].keys[0].pos[1]).toBeLessThan(0);
  });
});

// the animation studio sits on everything mojulo makes: any world is a set, any thing a prop, with nothing said by
// either. Tested on real recipes of kinds that name no place to stand: an object (a table), a vehicle, a city.
describe('a scene in anything mojulo makes', () => {
  const MADE = {
    sk_table: { title: 'table', manifest: { kind: 'workbench', build: { type: 'furniture', piece: 'table', dials: { type: 'table', w: 1830, d: 975, h: 760 }, size: [1830, 975, 760] }, units: 'mm', title: 'table' } },
    sk_city: { title: 'city', manifest: { kind: 'fractal-city', seed: 1, anchor: null, depth: 2, density: 0.6, elements: { frontage: true, roundKit: true } } },
  };
  const made = (r) => MADE[r] ?? null;
  const cast = { ada: {}, jon: {} };
  const inBlock = (B, p) => p[0] > B.min[0] && p[0] < B.max[0] && p[1] > B.min[1] && p[1] < B.max[1];

  it('stands a thing in the scene: its lowest point on the floor, its middle where asked, turned and scaled', async () => {
    const { placeProp } = await import('./scene-film.js');
    const box = [{ corners: [[10, 10, 5], [12, 10, 5], [12, 11, 5], [10, 11, 5]] }, { corners: [[10, 10, 5], [12, 10, 5], [12, 10, 6], [10, 10, 6]] }];
    const P = placeProp(box, [3, 4]);
    expect(P.size).toEqual([2, 1, 1]);
    expect(P.faces[0].corners[0]).toEqual([2, 3.5, 0]);
    // a quarter turn swaps its sides
    expect(placeProp(box, [3, 4], 90).half).toEqual([0.5, 1]);
  });

  it('takes any thing as a prop: a place by its name, walked to and round, drawn on the board; the script plays without it', async () => {
    const { prepareScreenplay } = await import('./scene-film.js');
    const sp = { cast, props: { table: { ref: 'sk_table', at: [-3.5, 2.5] } }, script: 'ADA: Is that yours?\nAda crosses to the table.\nJON: It is.' };
    const P = await prepareScreenplay(sp, { getRow: made });
    expect(P.kept.props).toEqual(sp.props);
    expect(P.screenplay.props).toBeUndefined();
    expect(P.set.kind).toBe('props');
    // the table is its real size (a recipe in millimetres), without the studio floor its own page stands it on
    expect(P.set.props[0].size).toEqual([1.83, 0.975, 0.76]);
    // its name is a place on clear ground beside it; the cast stand on marks of their own, not on the prop's
    expect(P.set.blocks.length).toBeGreaterThan(0);
    expect(P.set.blocks.some((B) => inBlock(B, P.screenplay.marks.table))).toBe(false);
    expect(P.screenplay.cast.ada.mark).toBe('ada-mark');
    const plan = planSceneFilm(P.screenplay, { getRow: made, set: P.set });
    expect(plan.S.actors.ada.walks).toHaveLength(1);
    // (what the Blender film stands it by: its size before any turn, its place)
    expect(P.set.props[0].dims).toEqual([1.83, 0.975, 0.76]);
    expect(P.advice.some((A) => A.id === 'prop-board-only')).toBe(false);
  }, 60000);

  it('takes an object as the set itself: the cast is stood on the clear ground beside it, a place called ground', async () => {
    const { prepareScreenplay } = await import('./scene-film.js');
    const P = await prepareScreenplay({ cast, world_ref: 'sk_table', script: 'ADA: So this is the table.\nJON: It is.' }, { getRow: made });
    expect(P.screenplay.marks.ground).toBeDefined();
    for (const w of ['ada', 'jon']) expect(P.set.floor_plan.blocks.some((B) => inBlock(B, P.screenplay.marks[P.screenplay.cast[w].mark]))).toBe(false);
    expect(P.set.faces.every((f) => f.corners.every((c) => c[2] > -0.5))).toBe(true);
  }, 60000);

  it('takes a city as the set: the cast on open ground among its buildings, which the cameras see past and the walks go round', async () => {
    const { prepareScreenplay } = await import('./scene-film.js');
    const P = await prepareScreenplay({ cast, world_ref: 'sk_city', script: 'ADA: So this is the place.\nJON: It is.' }, { getRow: made });
    expect(P.set.kind).toBe('fractal-city');
    expect(P.set.floor_plan.blocks.length).toBeGreaterThan(0);
    for (const w of ['ada', 'jon']) expect(P.set.floor_plan.blocks.some((B) => inBlock(B, P.screenplay.marks[P.screenplay.cast[w].mark]))).toBe(false);
    // every camera sees what it looks at: nothing of the city stands between
    const { faceSight } = await import('@/lib/graph/shoot/clearance.js');
    const sight = faceSight(P.set.faces), plan = planSceneFilm(P.screenplay, { getRow: made, set: P.set });
    for (const c of plan.coverage.cameras) for (const k of c.keys) expect(sight(k.pos, [0, 1, 2].map((i) => k.pos[i] + (k.poi[i] - k.pos[i]) * 0.9))).toBe(-1);
  }, 120000);

  it('refuses a prop it cannot read, saying what a prop takes', async () => {
    const { screenplayErrors, prepareScreenplay } = await import('./scene-film.js');
    expect(screenplayErrors({ cast, script: 'ADA: Hi.', props: { 'The Car': { ref: 'sk_table', at: [0, 0] } } }).join(' ')).toMatch(/named as a mark is/);
    expect(screenplayErrors({ cast, script: 'ADA: Hi.', props: { car: { at: [0, 0], size: 2 } } }).join(' ')).toMatch(/takes ref, at, turn, scale.*props\.car\.ref/s);
    await expect(prepareScreenplay({ cast, script: 'ADA: Hi.', props: { car: { ref: 'sk_none', at: [0, 0] } } }, { getRow: made })).rejects.toThrow(/props\.car\.ref: 'sk_none' is no sketch/);
    await expect(prepareScreenplay({ cast, script: 'ADA: Hi.', props: { car: { ref: 'sk_table', at: 'porch' } } }, { getRow: made })).rejects.toThrow(/no mark 'porch'/);
  }, 60000);
});
