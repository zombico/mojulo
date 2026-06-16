process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { OpsTagRepository } from '@/lib/db/repositories/ops-tags';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { forgeMotionHandler, renderShot } from './motion.js';
import { renderMotion, compileMotionCss, renderRegimeA } from '@/lib/motion';
import { PRESENTATION_THEMES } from '@/lib/visual-language/themes';

let outDir;

// A self-contained manji-tree subject: a small undulating terrain with a camera.
const SUBJECT = {
  kind: 'manji-tree',
  dimensions: '3d',
  physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1 },
  showSlotMarkers: false,
  camera: {
    worldFraming: { cameraPosition: [0, -12, 4], lookAt: [0, 0, 2], horizontalFov: 46 },
    viewBox: { width: 480, height: 400 },
  },
  roomBasis: { xRange: [-8, 8], yRange: [-8, 8], worldExtent: { width: 16, depth: 16, height: 10 } },
  tree: {
    id: 'world',
    spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.01 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
    children: [],
  },
  waveFields: [
    {
      corners: [
        { x: -8, y: 8, z: 0 },
        { x: 8, y: 8, z: 0 },
        { x: 8, y: -8, z: 0 },
        { x: -8, y: -8, z: 0 },
      ],
      displacement: { x: 0, y: 0, z: 1 },
      samples: { u: 10, v: 10 },
      waves: [{ amplitude: 2.2, cycles: { u: 1.5, v: 1.5 }, phase: 0.4 }],
      style: { stroke: '#8a744a', width: 0.5 },
    },
  ],
};

beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-motion-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});

afterAll(async () => {
  await fs.rm(outDir, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

describe('renderMotion (pure pipeline)', () => {
  it('turntable uses a union viewBox and loops seamlessly (frame count == requested)', () => {
    const r = renderMotion({ manifest: SUBJECT, motion: 'turntable', frames: 8, fps: 10 });
    expect(r.frameSvgs).toHaveLength(8);
    expect(r.meta.viewBoxStrategy).toBe('union');
    for (const svg of r.frameSvgs) expect(svg.startsWith('<svg')).toBe(true);
    expect(r.flipbookSvg).toContain('@keyframes moj-flip');
    expect(r.flipbookSvg).toContain('prefers-reduced-motion');
  });

  it('push_in uses the fixed film frame (camera viewBox)', () => {
    const r = renderMotion({ manifest: SUBJECT, motion: 'push_in', frames: 6 });
    expect(r.meta.viewBoxStrategy).toBe('fixed');
    expect(r.viewBox).toEqual([0, 0, 480, 400]);
  });

  it('is deterministic — same inputs produce byte-identical frames', () => {
    const a = renderMotion({ manifest: SUBJECT, motion: 'turntable', frames: 5 });
    const b = renderMotion({ manifest: SUBJECT, motion: 'turntable', frames: 5 });
    expect(a.frameSvgs).toEqual(b.frameSvgs);
  });

  it('orbit frames differ across the sweep (real re-projection, not a static copy)', () => {
    const r = renderMotion({ manifest: SUBJECT, motion: 'orbit', frames: 6, params: { from: 0, to: 90 } });
    expect(r.frameSvgs[0]).not.toEqual(r.frameSvgs[r.frameSvgs.length - 1]);
  });

  it('flythrough requires keyframes', () => {
    expect(() => renderMotion({ manifest: SUBJECT, motion: 'flythrough', frames: 4 })).toThrow(/keyframes/);
  });

  it('rejects non-manji-tree subjects', () => {
    expect(() =>
      renderMotion({ manifest: { kind: 'painted-landscape' }, motion: 'turntable' }),
    ).toThrow(/manji-tree/);
  });
});

describe('forge_motion (tool + resource group)', () => {
  it('renders an artifact and files a Motion Project (ops tag + subject/recipe stash)', async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });

    const res = await forgeMotionHandler({
      title: 'spin the terrain',
      subject: { sketch_ref: sketch.ref },
      shot: { motion: 'turntable', frames: 6, fps: 10 },
      export: 'both',
    });

    expect(res.ok).toBe(true);
    expect(res.motion_ref).toMatch(/^mo_/);
    expect(res.tag_ref).toMatch(/^ops_/);
    expect(res.stash_ref).toMatch(/^st_/);

    // outcome folder materialized
    const dir = path.join(outDir, res.motion_ref);
    const files = await fs.readdir(dir);
    expect(files).toEqual(expect.arrayContaining(['motion.svg', 'motion.gif', 'recipe.json', 'index.html']));
    const gif = await fs.readFile(path.join(dir, 'motion.gif'));
    expect(gif.subarray(0, 3).toString('latin1')).toBe('GIF');

    // recipe round-trips the subject ref
    const recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
    expect(recipe.subject).toEqual({ sketch_ref: sketch.ref });

    // index.html is a frame-accurate player wired to the all-frames motion.svg
    // via an ABSOLUTE url (relative ./ would 404 at the no-trailing-slash route)
    const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain(`/outcomes/${res.motion_ref}/motion.svg`);
    expect(html).not.toContain('"./motion.svg"');
    expect(html).toContain('requestAnimationFrame');
    expect(html).toContain('id="scrub"');
    // motion.svg carries one addressable group per frame for the player to drive
    const motionSvg = await fs.readFile(path.join(dir, 'motion.svg'), 'utf8');
    expect((motionSvg.match(/class="moj-frame"/g) || []).length).toBe(6);

    // resource group: tag binds the stash AND the motion
    const members = OpsTagRepository.listMembers(res.tag_ref);
    const kinds = members.map((m) => `${m.memberKind}:${m.memberRef}`);
    expect(kinds).toContain(`stash:${res.stash_ref}`);
    expect(kinds).toContain(`motion:${res.motion_ref}`);

    // the stash carries the subject pointer + the recipe
    const full = StashRepository.getFull(res.stash_ref);
    const types = full.items.map((i) => i.type);
    expect(types).toContain('sketch');
    expect(types).toContain('script');
  });

  it('files multiple shots of one subject under an existing tag when tag_ref is passed', async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });
    const first = await forgeMotionHandler({
      title: 'turntable',
      subject: { sketch_ref: sketch.ref },
      shot: { motion: 'turntable', frames: 5 },
      export: 'svg',
    });
    const second = await forgeMotionHandler({
      title: 'push in',
      subject: { sketch_ref: sketch.ref },
      shot: { motion: 'push_in', frames: 5 },
      export: 'svg',
      tag_ref: first.tag_ref,
    });

    expect(second.tag_ref).toBe(first.tag_ref);
    const motions = OpsTagRepository.listMembers(first.tag_ref, { memberKind: 'motion' });
    expect(motions.map((m) => m.memberRef).sort()).toEqual([first.motion_ref, second.motion_ref].sort());

    // export: 'svg' writes the durable flipbook, no gif
    const dir = path.join(outDir, second.motion_ref);
    const files = await fs.readdir(dir);
    expect(files).toContain('motion.svg');
    expect(files).not.toContain('motion.gif');
    expect(second.gif_path).toBeNull();
  });

  it('rejects a sketch_ref whose manifest is not a manji-tree', async () => {
    const landscape = SketchRepository.create({ title: 'land', manifest: { kind: 'painted-landscape' } });
    await expect(
      forgeMotionHandler({
        title: 'nope',
        subject: { sketch_ref: landscape.ref },
        shot: { motion: 'turntable' },
      }),
    ).rejects.toThrow(/manji-tree/);
  });
});

// Two minimal chart slides (marks-only sketches, NOT manji-tree). The text is
// the load-bearing content — bar labels and titles must survive into the deck.
const SLIDE_A = {
  title: 'Intro',
  viewBox: { width: 800, height: 480 },
  marks: [
    { kind: 'text', x: 60, y: 200, value: 'Quarterly Review', size: 40, weight: 700, color: '#e6edf3' },
    { kind: 'line', x1: 60, y1: 230, x2: 360, y2: 230, stroke: '#14b8a6' },
  ],
};
const SLIDE_B = {
  title: 'Revenue',
  viewBox: { width: 800, height: 480 },
  marks: [
    { kind: 'text', x: 60, y: 80, value: 'Revenue by channel', size: 24, weight: 700, color: '#e6edf3' },
    { kind: 'rect', x: 80, y: 200, w: 90, h: 180, fill: '#14b8a6' },
    { kind: 'rect', x: 220, y: 260, w: 90, h: 120, fill: '#a855f7' },
    { kind: 'text', x: 80, y: 420, value: 'Direct', size: 13, color: '#93a1b1' },
  ],
};

describe('forge_motion — DECK family (charts/slides as a slideshow)', () => {
  it('renders an inline deck into a flipbook + GIF, keeping text, filed as a Motion Project', async () => {
    const res = await forgeMotionHandler({
      title: 'Q2 deck',
      subject: { deck: [SLIDE_A, SLIDE_B] },
      shot: { motion: 'deck', params: { seconds_per_slide: 2 } },
      export: 'both',
    });

    expect(res.ok).toBe(true);
    expect(res.frames).toBe(2);

    const dir = path.join(outDir, res.motion_ref);
    const motionSvg = await fs.readFile(path.join(dir, 'motion.svg'), 'utf8');
    // one addressable group per slide
    expect((motionSvg.match(/class="moj-frame"/g) || []).length).toBe(2);
    // text SURVIVED the strip (the manji stripper would have dropped it)
    expect(motionSvg).toContain('Quarterly Review');
    expect(motionSvg).toContain('Revenue by channel');

    // gif encoded
    const gif = await fs.readFile(path.join(dir, 'motion.gif'));
    expect(gif.subarray(0, 3).toString('latin1')).toBe('GIF');

    // recipe records the deck subject + deck motion
    const recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
    expect(recipe.shot.motion).toBe('deck');
    expect(Array.isArray(recipe.subject.deck)).toBe(true);

    // resource group binds the motion
    const members = OpsTagRepository.listMembers(res.tag_ref).map((m) => `${m.memberKind}:${m.memberRef}`);
    expect(members).toContain(`motion:${res.motion_ref}`);
  });

  it('a named presentation theme unifies slide ink, backdrop, and player chrome', async () => {
    const paper = PRESENTATION_THEMES.paper;
    const res = await forgeMotionHandler({
      title: 'paper deck',
      subject: { deck: [SLIDE_A, SLIDE_B] },
      shot: { motion: 'deck', params: { theme: 'paper' } },
      export: 'both',
    });
    expect(res.ok).toBe(true);

    const dir = path.join(outDir, res.motion_ref);
    const motionSvg = await fs.readFile(path.join(dir, 'motion.svg'), 'utf8');
    // backdrop is the theme's bg (not the dark DECK_BG)
    expect(motionSvg).toContain(`fill="${paper.bg}"`);
    expect(motionSvg).not.toContain('#0b0f16');
    // light-surface ink reached the marks: the paper theme re-tints --foreground
    // to dark ink, so no default white text vars survive as #ffffff.
    expect(motionSvg).not.toContain('fill="#ffffff"');

    // the player chrome matches the theme + flips to a light color-scheme
    const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain('color-scheme: light');
    expect(html).toContain(paper.chrome.pageBg);

    // recipe carries the token so a regen is faithful
    const recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
    expect(recipe.shot.params.theme).toBe('paper');
  });

  it('rejects an unknown presentation theme with the allowed list', async () => {
    await expect(
      forgeMotionHandler({
        title: 'bad theme',
        subject: { deck: [SLIDE_A, SLIDE_B] },
        shot: { motion: 'deck', params: { theme: 'neon' } },
      }),
    ).rejects.toThrow(/unknown presentation theme 'neon'/);
  });

  it('builds a deck from a stash of sketch items in gather order; motion defaults to deck', async () => {
    const a = SketchRepository.create({ title: 'a', manifest: SLIDE_A });
    const b = SketchRepository.create({ title: 'b', manifest: SLIDE_B });
    const stash = StashRepository.mint({ title: 'deck stash' });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', title: 's1', metadata: { sketch_ref: a.ref, label: 'one' } });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', title: 's2', metadata: { sketch_ref: b.ref, label: 'two' } });

    // shot.motion omitted — a deck subject implies the slideshow motion
    const res = await forgeMotionHandler({
      title: 'from stash',
      subject: { stash_ref: stash.stashRef },
      shot: {},
      export: 'svg',
    });

    expect(res.ok).toBe(true);
    expect(res.frames).toBe(2);
    const recipe = JSON.parse(await fs.readFile(path.join(outDir, res.motion_ref, 'recipe.json'), 'utf8'));
    expect(recipe.subject).toEqual({ stash_ref: stash.stashRef });
    expect(recipe.shot.motion).toBe('deck');
  });

  it('expands a reveal-annotated slide into a paced build (one slide → many frames)', async () => {
    // A single slide that REVEALS its content in sequence is a valid animated
    // deck — reveal is expressed through the slide interface, not a new verb.
    const revealSlide = {
      title: 'Build',
      viewBox: { width: 800, height: 480 },
      marks: [
        { kind: 'text', x: 60, y: 90, value: 'Three reasons', size: 28, weight: 700, color: '#e6edf3' },
        { kind: 'text', x: 60, y: 160, value: 'It types on', size: 20, color: '#cdd6e0', reveal: { step: 0, enter: 'type-on' } },
        { kind: 'text', x: 60, y: 210, value: 'It flies in', size: 20, color: '#cdd6e0', reveal: { step: 1, enter: 'fly-in', from: 'right' } },
        { kind: 'text', x: 60, y: 260, value: 'It fades up', size: 20, color: '#cdd6e0', reveal: { step: 2, enter: 'fade-up', dwell: 1 } },
      ],
    };

    const res = await forgeMotionHandler({
      title: 'reveal build',
      subject: { deck: [revealSlide] }, // ONE slide, animates because it has reveals
      shot: { motion: 'deck', fps: 12 },
      export: 'svg',
    });

    expect(res.ok).toBe(true);
    // one logical slide expanded into many sub-frames
    expect(res.frames).toBeGreaterThan(12);

    const motionSvg = await fs.readFile(path.join(outDir, res.motion_ref, 'motion.svg'), 'utf8');
    expect((motionSvg.match(/class="moj-frame"/g) || []).length).toBe(res.frames);
    // base title is present from the first frame; the last reveal text is present by the end
    expect(motionSvg).toContain('Three reasons');
    expect(motionSvg).toContain('It fades up');
  });

  it('rejects a single still slide, a camera motion on a deck subject, and deck on a camera subject', async () => {
    await expect(
      forgeMotionHandler({ title: 'x', subject: { deck: [SLIDE_A] }, shot: { motion: 'deck' } }),
    ).rejects.toThrow(/at least 2|reveals/);

    await expect(
      forgeMotionHandler({ title: 'x', subject: { deck: [SLIDE_A, SLIDE_B] }, shot: { motion: 'turntable' } }),
    ).rejects.toThrow(/slideshow/);

    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });
    await expect(
      forgeMotionHandler({ title: 'x', subject: { sketch_ref: sketch.ref }, shot: { motion: 'deck' } }),
    ).rejects.toThrow(/deck subject/);
  });
});

describe('forge_motion — Regime A (render once, animate by transform)', () => {
  it('compileMotionCss emits @keyframes + class rules + a deterministic bake', () => {
    const marks = [
      { kind: 'rect', x: 100, y: 200, w: 60, h: 160, fill: '#14b8a6', animate: { channel: 'grow' } },
      { kind: 'circle', cx: 400, cy: 200, r: 40, fill: '#a855f7', animate: { channel: 'spin' } },
    ];
    const c = compileMotionCss([{ idx: 0, channel: 'grow' }, { idx: 1, channel: 'spin' }], marks, { fps: 12 });
    expect(c.style).toContain('@keyframes moj-grow');
    expect(c.style).toContain('@keyframes moj-rot');
    expect(c.style).toContain('.moj-mark[data-idx="0"]');
    expect(c.style).toContain('prefers-reduced-motion');
    // bake differs across the timeline; grow starts at ~scaleY 0
    expect(c.bake(0)).not.toEqual(c.bake(0.9));
    expect(c.bake(0).find((s) => s.idx === 0).transform).toMatch(/^matrix\(1,0,0,0/);
  });

  it('renders a single animate slide as Regime A — live css svg + baked gif', async () => {
    const slide = {
      title: 'animated', viewBox: { width: 800, height: 480 },
      marks: [
        { kind: 'text', x: 60, y: 90, value: 'Quarterly growth', size: 26, weight: 700, color: '#e6edf3' },
        { kind: 'rect', x: 120, y: 240, w: 90, h: 180, fill: '#14b8a6', animate: { channel: 'grow' } },
        { kind: 'rect', x: 260, y: 300, w: 90, h: 120, fill: '#a855f7', animate: { channel: 'grow', delay: 0.2 } },
        { kind: 'circle', cx: 600, cy: 300, r: 46, fill: '#f59e0b', animate: { channel: 'spin' } },
      ],
    };
    const res = await forgeMotionHandler({ title: 'regime a', subject: { deck: [slide] }, shot: { motion: 'deck' }, export: 'both' });
    expect(res.ok).toBe(true);

    const dir = path.join(outDir, res.motion_ref);
    // motion.svg is the LIVE css-animated svg: @keyframes + addressable groups
    const live = await fs.readFile(path.join(dir, 'motion.svg'), 'utf8');
    expect(live).toContain('@keyframes moj-grow');
    expect(live).toContain('class="moj-mark"');
    expect(live).toContain('data-idx="1"');
    // recipe records Regime A; the bg title text survives (structured-emit additive)
    const recipe = JSON.parse(await fs.readFile(path.join(dir, 'recipe.json'), 'utf8'));
    expect(recipe.meta.regime).toBe('A');
    expect(live).toContain('Quarterly growth');
    // gif baked from the single render
    const gif = await fs.readFile(path.join(dir, 'motion.gif'));
    expect(gif.subarray(0, 3).toString('latin1')).toBe('GIF');
  });

  it('bake stamps the transform onto the addressable group (regex matches React emit order)', async () => {
    const slide = {
      viewBox: { width: 600, height: 400 },
      marks: [{ kind: 'rect', x: 100, y: 200, w: 60, h: 160, fill: '#14b8a6', animate: { channel: 'grow' } }],
    };
    const r = await renderRegimeA(slide, { fps: 10 });
    expect(r.meta.regime).toBe('A');
    // first baked frame: scaleY≈0 stamped right after data-idx="0"; last: scaleY≈1
    expect(r.frameSvgs[0]).toMatch(/data-idx="0" transform="matrix\(1,0,0,0/);
    expect(r.frameSvgs[r.frameSvgs.length - 1]).toMatch(/data-idx="0" transform="matrix\(1,0,0,1/);
  });
});

// EFFECT family — carved-solid materialize / transfigure. Exercised through the
// pure renderShot with INLINE carved subjects, so no DB/sketch rows are needed.
describe('forge_motion — EFFECT family (carved materialize/transfigure)', () => {
  const STAR = { shape: { path: 'M 0 -0.5 L 0.12 -0.16 L 0.48 -0.16 L 0.19 0.06 L 0.29 0.4 L 0 0.2 L -0.29 0.4 L -0.19 0.06 L -0.48 -0.16 L -0.12 -0.16 Z' } };
  const SQUARE = { shape: { path: 'M -0.4 -0.4 L 0.4 -0.4 L 0.4 0.4 L -0.4 0.4 Z' } };

  it('materialize: a single carved_solid → a composed flipbook + GIF frames', async () => {
    const { isEffect, motion, result } = await renderShot({
      subject: { carved_solid: { ...STAR, material: 'chrome' } },
      shot: { motion: 'materialize', frames: 10 },
    });
    expect(isEffect).toBe(true);
    expect(motion).toBe('materialize');
    expect(typeof result.flipbookSvg).toBe('string');
    expect(result.flipbookSvg.startsWith('<svg')).toBe(true);
    expect(result.frameSvgs.length).toBe(2 * 10 - 2); // ping-pong
    expect(result.meta).toMatchObject({ motion: 'materialize', frames: 18 });
    expect(result.viewBox).toEqual([0, 0, 960, 540]);
  });

  it('materialize supports doom scan-plane and transporter particle classes', async () => {
    const doom = await renderShot({
      subject: { carved_solid: { ...STAR, material: 'chrome' } },
      shot: { motion: 'materialize', params: { class: 'doom' }, frames: 8 },
    });
    expect(doom.result.frameSvgs.some((s) => s.includes('class="cm-scan-plane"'))).toBe(true);

    const transporter = await renderShot({
      subject: { carved_solid: { ...STAR, material: 'chrome' } },
      shot: { motion: 'materialize', params: { class: 'transporter' }, frames: 8 },
    });
    expect(transporter.result.frameSvgs.some((s) => s.includes('class="cm-particles"'))).toBe(true);
  });

  it('transfigure: a from→to pair morphs A into B', async () => {
    const { motion, result } = await renderShot({
      subject: { from: { ...SQUARE, material: 'gold' }, to: { ...STAR, material: 'gold' } },
      shot: { motion: 'transfigure', frames: 12 },
    });
    expect(motion).toBe('transfigure');
    expect(result.frameSvgs.every((s) => s.startsWith('<svg'))).toBe(true);
    expect(result.meta.motion).toBe('transfigure');
  });

  it('transfigure supports liquid-metal carrier morphs', async () => {
    const { result } = await renderShot({
      subject: { from: { ...SQUARE, material: 'gold' }, to: { ...STAR, material: 'gold' } },
      shot: { motion: 'transfigure', params: { class: 'liquid-metal', liquid: { carrier: '#c7d2fe', blobRandomness: 0.4, highlightBias: 0.6 } }, frames: 12 },
    });
    const mid = result.frameSvgs[6];
    expect(mid).toContain('class="cm-liquid-metal"'); // chrome carrier reskin of the carved solid
    expect(mid).not.toContain('filter="url(#cm-glow)"'); // not the galvatron wireframe
  });

  it('rejects a carved subject paired with a camera motion', async () => {
    await expect(renderShot({ subject: { carved_solid: STAR }, shot: { motion: 'turntable' } }))
      .rejects.toThrow(/carved subjects animate as an effect/);
  });

  it('materialize rejects a from/to pair; transfigure rejects a lone subject', async () => {
    await expect(renderShot({ subject: { from: SQUARE, to: STAR }, shot: { motion: 'materialize' } }))
      .rejects.toThrow(/materialize takes a single carved subject/);
    await expect(renderShot({ subject: { carved_solid: STAR }, shot: { motion: 'transfigure' } }))
      .rejects.toThrow(/transfigure takes a pair/);
  });

  it('transfigure requires BOTH from and to', async () => {
    await expect(renderShot({ subject: { from: SQUARE }, shot: { motion: 'transfigure' } }))
      .rejects.toThrow(/needs BOTH subject.from and subject.to/);
  });
});
