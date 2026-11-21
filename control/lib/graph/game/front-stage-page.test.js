import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { stageConfig, stageCss, stageImportmap } from './front-stage-page.js';
import { emitPlayShell } from './play-shell.js';
import { shellManaSpec } from './play-shell-mana.js';
import { normalizeGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';
import { FRONT_CARDS, FRONT_CARD_IDS } from '../playscape/ui/front-cards/loader.js';

// THE START SCREEN'S STAGE IN THE SHELL: only a front with a stage, on a page an export baked one for, carries any of it;
// such a page draws its name and its plates behind the screens, moves the menu into the card's box, and shows the stage
// whenever no level is up.
const card = FRONT_CARDS[FRONT_CARD_IDS[0]];
const CONTRACT = normalizeLevelContract({ levelRef: 'k-1', consumes: [], produces: { events: [] } });
const LEVELS = [{ ref: 'k-1', contract: CONTRACT }];
const game = (front, more = {}) => normalizeGameManifest({ kind: 'game', title: 'Sky Runner', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'k-1', title: 'One' }], ...(front ? { front } : {}), ...more });
const STAGE = { composition: card.id, subjects: ['hero-ref'] };
const BAKED = { plates: card.slots.map((_, i) => ({ src: `assets/front/subject-${i + 1}.png`, width: 300, height: 900 })) };

describe('the stage in the shell', () => {
  it('a stage no export baked is not drawn: none of its sheet or code, the front\'s cover and title as they were', () => {
    const html = emitPlayShell(game({ tagline: 'go', stage: STAGE }), LEVELS);
    expect(html).not.toContain('#stage{');
    expect(html).not.toContain('const __mojStage = (');
    expect(html).not.toContain('"stage":{"card"');
    expect(emitPlayShell(game({ tagline: 'go', stage: STAGE }), LEVELS, { frontStage: BAKED })).toContain('const __mojStage = (');
  });

  it('a baked stage carries its frames, its beats and its plates, and its sheet places them', () => {
    const cfg = stageConfig(card, BAKED.plates, { title: 'Sky Runner' });
    expect(cfg).toMatchObject({ card: card.id, title: 'Sky Runner', ground: card.ground, anchors: card.slots.map((s) => s.anchor) });
    expect(cfg.plates[0].src).toBe('assets/front/subject-1.png');
    expect(stageConfig(card, [null], { title: 'x' }).plates).toEqual([null]);
    const css = stageCss(card);
    const [x, y] = card.frames.wide.title.box;
    expect(css).toContain(`#stage .st-title{left:${x}%;top:${y}%`);
    expect(css).toContain('#front .fx-col{left:');
    expect(css).toMatch(/prefers-reduced-motion:reduce/);
    expect(stageCss(card, { mana: true })).toContain('#mana .mana-screen>.mana-stack');
  });

  it('a card of two subjects slides each in from its own side, the second a beat after; a split ground cuts the screen', () => {
    const F = FRONT_CARDS['face-off'], css = stageCss(F), at = F.motion.find((m) => m.part === 'subject').at;
    expect(css).toMatch(/#stage \.st-subj\[data-i="0"\]\{[^}]*--st-dx:-1[^}]*\}/);
    expect(css).toMatch(new RegExp(`#stage \\.st-subj\\[data-i="1"\\]\\{[^}]*--st-dx:1;animation-delay:${at + 160}ms`));
    expect(css).toMatch(/\.st-ground\{[^}]*linear-gradient\(104deg/);
    expect(stageCss(FRONT_CARDS['hero-pose'])).not.toContain('--st-dx:');
  });

  it('drawn in a page: the name behind, the plates, shown on the title', () => {
    const html = emitPlayShell(game({ tagline: 'go', stage: STAGE }), LEVELS, { frontStage: BAKED });
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
    const d = dom.window.document, stage = d.getElementById('stage');
    expect(stage).not.toBeNull();
    expect(stage.classList.contains('on')).toBe(true);
    expect(d.body.dataset.screen).toBe('title');
    expect(stage.querySelector('.st-title').textContent.replace(/ /g, ' ')).toBe('SKY RUNNER');
    expect([...stage.querySelectorAll('.st-subj img')].map((i) => i.getAttribute('src'))).toEqual(BAKED.plates.map((p) => p.src));
    // the front's own name is still there to be read, and no cover is drawn under the stage
    expect(d.querySelector('#front h1').textContent).toBe('Sky Runner');
    expect(d.querySelector('#front .fx-stage.cover')).toBeNull();
  });
});

describe('the title in mana-ui', () => {
  it('every mana title enters by letters, in its look\'s way; a staged one leaves the name to the stage and its menu bare', () => {
    const title = (ui, opts) => shellManaSpec(ui, opts).screens.title.props;
    expect(title({ theme: 'modern' }).letters).toBe('rise');
    expect(title({ theme: { from: 'modern', title: 'wipe' } }).letters).toBe('wipe');
    expect(title({ theme: { from: 'modern', title: 'still' } }).letters).toBeUndefined();
    expect(title({ theme: 'modern' }, { staged: true })).toMatchObject({ bare: true });
    expect(title({ theme: 'modern' }, { staged: true }).letters).toBeUndefined();
    expect(shellManaSpec({ theme: 'modern' }).screens.attract.props.letters).toBe('rise');
    const page = emitPlayShell(game({ tagline: 'go' }, { ui: { theme: 'modern' } }), LEVELS);
    expect(page).toContain('[data-letters] .mana-letter');
    const staged = emitPlayShell(game({ tagline: 'go', stage: STAGE }, { ui: { theme: 'modern' } }), LEVELS, { frontStage: BAKED });
    expect(staged).toContain('"bare":true');
  });
});

describe('the live stage', () => {
  const frame = { shot: { pos: [1, 2, 3], target: [0, 0.5, 1], vfov: 28 }, capture: { width: 900, height: 1100 }, crop: { x: 10, y: 20, w: 300, h: 900 }, poseMs: 900 };
  const LIVE = { plates: [{ src: 'assets/front/subject-1.png', width: 300, height: 900, frame, live: { glb: 'assets/front/subject-1.glb', clip: 'idle' } }], three: { module: 'assets/front/three/three.module.min.js', loader: 'assets/front/three/addons/loaders/GLTFLoader.js' } };

  it('carries each model with the camera its picture was cut from, turned to the model\'s y-up, and the loader said from the page', () => {
    const cfg = stageConfig(card, LIVE.plates, { title: 'x', three: LIVE.three });
    expect(cfg.plates[0].live).toEqual({ glb: 'assets/front/subject-1.glb', clip: 'idle', pos: [1, 3, -2], target: [0, 1, -0.5], vfov: 28, capture: [900, 1100], crop: [10, 20, 300, 900], t: 0.9 });
    expect(cfg.three).toEqual({ loader: './assets/front/three/addons/loaders/GLTFLoader.js' });
    expect(JSON.parse(stageImportmap(LIVE.three))).toEqual({ imports: { three: './assets/front/three/three.module.min.js' } });
    expect(JSON.parse(stageImportmap({ module: 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js' })).imports.three).toMatch(/^https:/);
  });

  it('a stage with no model, or no three, is drawn in pictures alone', () => {
    const still = stageConfig(card, [{ ...LIVE.plates[0], live: undefined }], { title: 'x', three: LIVE.three });
    expect(still.three).toBeUndefined();
    expect(still.plates[0].live).toBeUndefined();
    expect(stageConfig(card, LIVE.plates, { title: 'x' }).plates[0].live).toBeUndefined();
  });

  it('its page carries the importmap and the canvas\'s sheet; a still stage carries neither', () => {
    const live = emitPlayShell(game({ stage: { ...STAGE, mode: '3d' } }), LEVELS, { frontStage: LIVE });
    expect(live).toContain('<script type="importmap">{"imports":{"three":"./assets/front/three/three.module.min.js"}}</script>');
    expect(live).toContain('#stage .st-subj canvas{position:absolute');
    expect(live).toContain('drop-shadow(4px 0 0 var(--accent))');
    const still = emitPlayShell(game({ stage: STAGE }), LEVELS, { frontStage: BAKED });
    expect(still).not.toContain('type="importmap"');
    expect(still).not.toContain('#stage .st-subj canvas');
  });
});

describe('the ramp', () => {
  const WARM = { ...BAKED, warm: ['levels/k-1.html', 'assets/geometry/groups-1.json'] };
  it('warms the first level from the page, said from it', () => {
    expect(stageConfig(card, BAKED.plates, { title: 'x', warm: WARM.warm }).warm).toEqual(['./levels/k-1.html', './assets/geometry/groups-1.json']);
    expect(stageConfig(card, BAKED.plates, { title: 'x' }).warm).toBeUndefined();
  });

  it('play turns the start screen into the loading screen, and the level\'s first frame lifts it', async () => {
    const html = emitPlayShell(game({ tagline: 'go', stage: STAGE }), LEVELS, { frontStage: WARM });
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
    const d = dom.window.document, stage = d.getElementById('stage');
    const play = [...d.querySelectorAll('#front .fx-menu button')].find((b) => /start|play/i.test(b.textContent));
    play.click();
    expect(stage.classList.contains('loading')).toBe(true);
    expect(stage.classList.contains('on')).toBe(true);
    expect(stage.querySelector('.st-place').textContent).toBe('One');
    expect(stage.querySelector('.st-mini').textContent).toBe('Sky Runner');
    expect(d.getElementById('veil').style.display).toBe('none');
    const frame = d.getElementById('frame');
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { moj: 'game-shown' }, source: frame.contentWindow }));
    expect(stage.classList.contains('leaving')).toBe(true);
    await new Promise((r) => setTimeout(r, 600));
    expect(stage.classList.contains('loading')).toBe(false);
    expect(stage.classList.contains('on')).toBe(false);
  });

  it('a game with no stage keeps its own loading veil', () => {
    const dom = new JSDOM(emitPlayShell(game({ tagline: 'go' }), LEVELS), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
    const d = dom.window.document;
    [...d.querySelectorAll('#front .fx-menu button')].find((b) => /start|play/i.test(b.textContent)).click();
    expect(d.getElementById('stage')).toBeNull();
    expect(d.getElementById('veil').style.display).toBe('flex');
  });
});
