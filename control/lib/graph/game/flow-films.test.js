import { describe, it, expect } from 'vitest';
import { flowFilms, withFlowVideos } from './flow-films.js';
import { readFlow, defaultFlow, buildFlowKernel } from './flow.js';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';

// a game's cutscene that is a film: the flow names the film, the video is found when the game is served or exported
const BASE = { kind: 'game', title: 'Cut', shell: 'play', store: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'run-1', title: 'The Trail' }] };
const LEVELS = [{ ref: 'run-1', contract: normalizeLevelContract({ levelRef: 'run-1', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }] } }) }];
const script = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];

describe('a cinematic played as a video', () => {
  it('is a film\'s ref or a video\'s address, with no scene, stage or keep', () => {
    const flow = (step) => ({ start: 'cut', steps: { cut: { kind: 'cinematic', next: 'title', ...step }, title: { kind: 'screen', screen: 'title', on: { play: '$first' } }, play: { kind: 'level', level: '$any', on: { won: 'title', lost: 'title', left: 'title' } } } });
    const errs = (step) => readFlow(flow(step), { levels: ['run-1'] });
    expect(errs({ film: 'sk_film' })).toEqual([]);
    expect(errs({ video: 'assets/cut.mp4', skip: false })).toEqual([]);
    expect(errs({ film: 'sk_film', stage: 'run-1' }).join()).toMatch(/has no stage/);
    expect(errs({ film: 'sk_film', keep: true }).join()).toMatch(/has no keep/);
    expect(errs({ film: 7 }).join()).toMatch(/film is a film's ref/);
    // (a scene on a stage reads as it did)
    expect(errs({ scene: 'intro', stage: 'run-1' })).toEqual([]);
    expect(errs({ scene: 'intro' }).join()).toMatch(/stage is the level/);
  });

  it('the default flow places a slot\'s film where it placed its scene', () => {
    const F = defaultFlow({ levels: ['run-1'], cinematics: { opening: { film: 'sk_film' } } });
    expect(F.steps.opening).toEqual({ kind: 'cinematic', film: 'sk_film', next: 'title' });
    expect(F.start).toEqual([{ when: 'unseen', go: 'opening' }, 'title']);
    expect(readFlow(F, { levels: ['run-1'] })).toEqual([]);
    // the walk goes through it to the title
    const K = buildFlowKernel(), ctx = { resolve: () => 'run-1', guard: () => true };
    expect(K.stepFlow(F, 'opening', 'next', ctx)).toMatchObject({ step: 'title' });
  });
});

describe('a flow\'s films', () => {
  const G = normalizeGameManifest({ ...BASE, flow: defaultFlow({ levels: ['run-1'], cinematics: { opening: { film: 'sk_film' } } }) });

  it('are found, given their videos, and said when one has none', () => {
    expect(validateGameManifest(G).errors).toEqual([]);
    expect(flowFilms(G.flow)).toEqual([{ step: 'opening', film: 'sk_film' }]);
    const W = withFlowVideos(G, (film) => `/outcomes/x/${film}.mp4`);
    expect(W.manifest.flow.steps.opening).toMatchObject({ film: 'sk_film', video: '/outcomes/x/sk_film.mp4' });
    expect(W.missing).toEqual([]);
    expect(G.flow.steps.opening.video).toBeUndefined();
    expect(withFlowVideos(G, () => null).missing).toEqual([{ step: 'opening', film: 'sk_film' }]);
    // a game with no film is handed back as it was
    const plain = normalizeGameManifest(BASE);
    expect(withFlowVideos(plain, () => 'x').manifest).toBe(plain);
  });

  it('the play shell carries the player only for a game that plays a video', () => {
    const withVideo = emitPlayShell(withFlowVideos(G, () => 'assets/cutscenes/sk_film.mp4').manifest, LEVELS), plain = emitPlayShell(normalizeGameManifest(BASE), LEVELS);
    expect(script(withVideo)).toContain('__mojCine = ');
    expect(script(withVideo)).toContain('assets/cutscenes/sk_film.mp4');
    expect(script(plain)).not.toContain('__mojCine = ');
    expect(script(plain)).not.toContain('playCineRuntime');
    for (const html of [withVideo, plain]) expect(() => new Function(script(html))).not.toThrow();
  });
});
