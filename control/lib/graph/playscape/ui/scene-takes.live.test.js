// A script's takes played on the World page (an e2e suite: a real browser, skipped when none is installed). A scene
// written as a screenplay, between a realistic hero (its face plays on the page) and a plain one (its body alone): built
// as the page is, each figure carries its take; in Chrome, while a line plays, both actors play the script's clip at the
// line's phase, the speaker's face driven by its take; played out (held for the press) and after the scene, each is
// back on its own clips.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { playerWorld } from '../player.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { pageFigures } from '../../scene/channels/controllable/index.js';
import { RELATIONAL_FACE_TARGETS } from '../../polygonizer/relational-face-rig.js';
import { takesAdvice, TAKE_BUDGET } from './scene-takes.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

const CLIP = 'scene:warning:0';
let browser = null, payload = null, html = '';
beforeAll(async () => {
  const W = playerWorld({ hero: { cast: 'female' }, id: 'hero', library: false });
  W.figures.hero = { hero: { cast: 'female', form: 'realistic', head: 'relational' } };
  W.figures.mayor = { hero: { cast: 'male' } };
  W.entities.push({ id: 'mayor', rule: { type: 'static' }, transform: { pos: [3, 2, 0], heading: Math.PI }, body: { type: 'figure-rig', figure: 'mayor' } });
  W.play = { scenes: [{ id: 'warning', when: { start: true }, names: { mayor: 'Mayor Orlo' }, beats: [{ script: 'MAYOR: The road is *shut*, and it has been shut since the spring.\nHERO (worried): Since when?\nMAYOR: Since the bell stopped.' }] }] };
  ({ payload } = await resolveWorldScene({ ref: 'sk_scene_takes', title: 'takes', manifest: W }));
  html = emitThreeWorld({ ...payload, inline: true });
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('a script\'s takes on the page', () => {
  it('built: each actor carries its take, the realistic face its track on its own targets; its bytes within the budget', () => {
    const lines = payload.events.scenes[0].beats.filter((b) => b.kind === 'line');
    expect(lines.every((b) => b.take.clip === CLIP)).toBe(true);
    const of = lines[0].take.of, { hero, mayor } = payload.figures;
    for (const f of [hero, mayor]) expect(f.clips[CLIP]).toMatchObject({ once: true });
    expect(hero.face.targets).toEqual([...RELATIONAL_FACE_TARGETS]);
    const tr = hero.face.tracks[CLIP];
    expect(tr.w[0].length).toBe(hero.face.targets.length);
    expect(tr.t.at(-1)).toBeGreaterThan(of - 0.2);                       // the whole script, on its clock
    expect(hero.face.ambientOver ?? []).not.toContain(CLIP);              // the take drives the face, not the blink layer
    expect(mayor.face).toBeUndefined();                                   // a plain head plays its body alone
    // what the takes cost the page (packed as it ships them): within TAKE_BUDGET a scene-second an actor
    const { figs } = pageFigures(payload.figures);
    const bytes = ['hero', 'mayor'].reduce((n, k) => n + JSON.stringify(figs[k].clips[CLIP]).length + JSON.stringify(figs[k].face?.tracks?.[CLIP] ?? null).length, 0);
    expect(bytes / of / 2).toBeLessThan(TAKE_BUDGET);
    expect(takesAdvice({ bytes, seconds: of, actors: 2 })).toBeNull();
  });

  it('played: during a line both actors take the clip at its phase, the face moving; held and after, each on its own clips', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojScenes, { timeout: 60000 });
    const state = () => page.evaluate((clip) => {
      const W = window.__mojCtrl.world, v = window.__mojScenes.view();
      // (the realistic face's morph weights while it takes, as the page leaves them for a headless driver)
      return { take: W.take, hero: W.byId.hero.taking, mayor: W.byId.mayor.taking, line: v.line, on: v.on, face: W.byId.hero.takeFace ?? null, clip };
    }, CLIP);
    const frames = (n) => page.evaluate((k) => new Promise((r) => { let i = k; const f = () => (--i ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    // the hero walks to its mark, then the first line
    await page.waitForFunction(() => !!window.__mojScenes.view().line, { timeout: 60000 });
    await frames(3);
    const a = await state();
    expect(a.take).toMatchObject({ clip: CLIP });
    expect([a.hero, a.mayor]).toEqual([CLIP, CLIP]);                       // the speaker and the listener alike
    await frames(20);
    const b = await state();
    expect(b.take.u).toBeGreaterThan(a.take.u);                            // the take plays on the line's clock
    expect(a.face?.length).toBe(payload.figures.hero.face.targets.length);   // the realistic face's morphs, read off the page
    expect(b.face).not.toEqual(a.face);                                       // and the face moves with the take
    // played out: held for the press, each back on its own clips
    await page.waitForFunction(() => window.__mojScenes.view().line.take.held, { timeout: 30000 });
    await frames(3);
    const c = await state();
    expect([c.take, c.hero, c.mayor]).toEqual([null, null, null]);
    // (the words were whole by then) the press goes on: the next line's take from its own start
    await page.evaluate(() => window.__mojScenes.next()); await frames(3);
    const d = await state();
    const second = payload.events.scenes[0].beats.filter((x) => x.kind === 'line')[1].take;
    expect(d.line.name).toBe('Hero');
    expect([d.hero, d.mayor]).toEqual([CLIP, CLIP]);
    expect(d.take.u).toBeGreaterThanOrEqual(second.at / second.of - 1e-3);
    expect(d.take.u).toBeLessThan(second.at / second.of + 0.1);
    // a skip ends it: nobody takes, the scene is over
    await page.evaluate(() => window.__mojScenes.skip()); await frames(4);
    const e = await state();
    expect([e.on, e.take, e.hero, e.mayor]).toEqual([false, null, null, null]);
    expect(errors).toEqual([]);
    await page.close();
  }, 180000);
});
