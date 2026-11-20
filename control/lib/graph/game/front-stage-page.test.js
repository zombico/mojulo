import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { stageConfig, stageCss } from './front-stage-page.js';
import { emitPlayShell } from './play-shell.js';
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
