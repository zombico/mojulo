import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  IMAGE_OUTCOME_CONTRACT,
  SEQUENTIAL_ART_CONTRACT,
  isImageOutcomesKind,
  normalizeImageOutcomesManifest,
  renderTargets,
} from './manifest.js';
import { renderScaffoldSvg } from './scaffold.js';
import { buildRenderInstructions } from './instructions.js';
import {
  cityBlockoutFixture,
  mangaSignalPageFixture,
  roomInteriorFixture,
} from './fixtures.js';

describe('manifest normalization', () => {
  it('normalizes an image-outcome fixture to the v1 contract', () => {
    const m = normalizeImageOutcomesManifest(cityBlockoutFixture());
    expect(m.contractVersion).toBe(IMAGE_OUTCOME_CONTRACT);
    expect(m.forms.map((f) => f.depthRank)).toEqual([...m.forms.map((f) => f.depthRank)].sort((a, b) => a - b));
    expect(m.forms.every((f) => ['strict', 'guided', 'loose'].includes(f.preserve))).toBe(true);
    expect(m.renderBrief.mustPreserve.length).toBeGreaterThan(0);
  });

  it('normalizes a sequential-art fixture with the per-panel default strategy', () => {
    const m = normalizeImageOutcomesManifest(mangaSignalPageFixture());
    expect(m.contractVersion).toBe(SEQUENTIAL_ART_CONTRACT);
    expect(m.renderStrategy).toBe('per-panel');
    expect(m.panels).toHaveLength(4);
    // the spike brief's `preserve` key maps onto mustPreserve
    expect(m.renderBrief.mustPreserve).toContain('device position');
    // lettering survives normalization for the composite pass
    expect(m.panels[0].bubbleZones[0].lettering).toBe('What is that light…?');
  });

  it('is idempotent and deterministic', () => {
    const a = normalizeImageOutcomesManifest(mangaSignalPageFixture());
    const b = normalizeImageOutcomesManifest(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('rejects bad inputs', () => {
    expect(() => normalizeImageOutcomesManifest({ kind: 'nope' })).toThrow(/unknown image-outcomes kind/);
    expect(() => normalizeImageOutcomesManifest({ kind: 'image-outcome', title: 'x' })).toThrow(/intent/);
    expect(() => normalizeImageOutcomesManifest({ kind: 'image-outcome', title: 'x', intent: 'y', forms: [] })).toThrow(/at least one form/);
    expect(() =>
      normalizeImageOutcomesManifest({ ...mangaSignalPageFixture(), renderStrategy: 'freestyle' })
    ).toThrow(/renderStrategy/);
    const dupe = mangaSignalPageFixture();
    dupe.panels[1].id = 'p1';
    expect(() => normalizeImageOutcomesManifest(dupe)).toThrow(/duplicate panel id/);
  });

  it('exposes the kind predicate', () => {
    expect(isImageOutcomesKind('image-outcome')).toBe(true);
    expect(isImageOutcomesKind('sequential-art')).toBe(true);
    expect(isImageOutcomesKind('orbit-view')).toBe(false);
  });
});

describe('scaffold svg', () => {
  it('same manifest, same bytes', () => {
    for (const fixture of [cityBlockoutFixture(), roomInteriorFixture(), mangaSignalPageFixture()]) {
      expect(renderScaffoldSvg(fixture)).toBe(renderScaffoldSvg(fixture));
    }
  });

  it('renders the single-shot scaffold with forms and zones', () => {
    const svg = renderScaffoldSvg(cityBlockoutFixture());
    expect(svg).toContain('City Blockout To Cinematic Street');
    expect(svg).toContain('optional title zone');
    expect(svg).toContain('crosswalk-zone');
  });

  it('renders the page scaffold with panels, poses, and bubbles', () => {
    const svg = renderScaffoldSvg(mangaSignalPageFixture());
    expect(svg).toContain('p3 low-angle-hero');
    expect(svg).toContain('clip-p1');
    expect(svg).toContain('stroke-dasharray="10 8"');
  });

  it('crops to a single panel viewBox for the per-panel payload', () => {
    const svg = renderScaffoldSvg(mangaSignalPageFixture(), { panelId: 'p3' });
    expect(svg).toContain('viewBox="760 580 696 820"');
    expect(svg).toContain('clip-p3');
    expect(svg).not.toContain('clip-p1');
    expect(() => renderScaffoldSvg(mangaSignalPageFixture(), { panelId: 'p9' })).toThrow(/unknown panel/);
  });

  it('never leaks lettering into the scaffold', () => {
    const svg = renderScaffoldSvg(mangaSignalPageFixture());
    expect(svg).not.toContain('What is that light');
  });
});

describe('render instructions', () => {
  it('states scaffold-as-source-of-truth and preservation levels for a shot', () => {
    const text = buildRenderInstructions(cityBlockoutFixture());
    expect(text).toContain('composition source of truth');
    expect(text).toContain('- strict: left-near');
  });

  it('states the art-layer-only rule for a page', () => {
    const text = buildRenderInstructions(mangaSignalPageFixture());
    expect(text).toContain('ART LAYER ONLY');
    expect(text).toContain('no panel borders');
    expect(text).toContain('no readable text');
    expect(text).toContain('Render strategy: per-panel');
    expect(text).toContain('p3: Low-angle dramatic pose');
  });

  it('scopes to one panel', () => {
    const text = buildRenderInstructions(mangaSignalPageFixture(), { panelId: 'p2' });
    expect(text).toContain('panel p2');
    expect(text).toContain('Insert shot');
    expect(text).not.toContain('Low-angle dramatic pose');
  });

  it('NEVER includes bubble lettering (composite-only data)', () => {
    const full = buildRenderInstructions(mangaSignalPageFixture());
    const scoped = buildRenderInstructions(mangaSignalPageFixture(), { panelId: 'p1' });
    expect(full).not.toContain('What is that light');
    expect(scoped).not.toContain('What is that light');
  });
});

describe('camera + pose vocabularies (I2)', () => {
  it('rejects a freeform camera kind', () => {
    const bad = mangaSignalPageFixture();
    bad.panels[0].camera = { kind: 'dutch-tilt-dramatic' };
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/unknown camera kind 'dutch-tilt-dramatic'/);
  });

  it('rejects a pose outside the vocabulary', () => {
    const bad = mangaSignalPageFixture();
    bad.panels[0].figures[0].pose = 'backflip';
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/pose 'backflip' is not a pose vocabulary entry/);
  });

  it('exposes audit dials on every camera entry', async () => {
    const { CAMERA_KINDS, cameraEntry } = await import('./cameras.js');
    expect(CAMERA_KINDS.length).toBeGreaterThanOrEqual(6);
    for (const kind of CAMERA_KINDS) {
      const entry = cameraEntry(kind);
      expect(entry.phrase.length).toBeGreaterThan(10);
      expect(entry).toHaveProperty('horizonBand');
      expect(Array.isArray(entry.subjectHeightFrac)).toBe(true);
    }
    expect(() => cameraEntry('vibes')).toThrow(/unknown camera kind/);
  });

  it('emits a distinct silhouette for every pose entry', async () => {
    const { POSE_KINDS, poseFigure } = await import('./poses.js');
    expect(POSE_KINDS.length).toBeGreaterThanOrEqual(12);
    const seen = new Set();
    for (const pose of POSE_KINDS) {
      const svg = poseFigure({ x: 100, y: 100, pose });
      expect(svg).toContain('<circle');
      seen.add(svg);
    }
    expect(seen.size).toBe(POSE_KINDS.length);
  });

  it('renders camera and pose phrasings into instructions', () => {
    const text = buildRenderInstructions(mangaSignalPageFixture());
    expect(text).toContain('low-angle-hero (low-angle hero shot');
    expect(text).toContain('hero — reaching upward');
    const shot = buildRenderInstructions(cityBlockoutFixture());
    expect(shot).toContain('Camera: wide-establishing — wide establishing shot');
  });
});

describe('style presets (render-brief tuning)', () => {
  function withPreset(preset, dials) {
    const m = mangaSignalPageFixture();
    m.renderBrief = { preset, ...(dials ? { dials } : {}) };
    return m;
  }

  it('fills brief defaults from the preset and merges its negatives', () => {
    const m = normalizeImageOutcomesManifest(withPreset('gpen-shonen'));
    expect(m.renderBrief.preset).toBe('gpen-shonen');
    expect(m.renderBrief.style).toContain('G-pen');
    expect(m.renderBrief.dials.stylization).toBe(0.5); // default filled
    expect(m.renderBrief.negative).toContain('no photorealistic rendering or 3D-render look');
    // kind defaults still merged in (caller gave no negative of its own)
    expect(m.renderBrief.negative).toContain('no readable text');
  });

  it('leaves the freeform max-capability path untouched when no preset is given', () => {
    const m = normalizeImageOutcomesManifest(mangaSignalPageFixture());
    expect(m.renderBrief.preset).toBeUndefined();
    expect(m.renderBrief.negative).not.toContain('no photorealism');
  });

  it('is idempotent with a preset + dials', () => {
    const a = normalizeImageOutcomesManifest(withPreset('hard-boiled', { tone: 'red' }));
    const b = normalizeImageOutcomesManifest(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('rejects unknown presets, unknown dials, and out-of-vocabulary dial values', () => {
    expect(() => normalizeImageOutcomesManifest(withPreset('watercolor'))).toThrow(/unknown style preset/);
    expect(() => normalizeImageOutcomesManifest(withPreset('steamboat', { grit: 1 }))).toThrow(/unknown dial 'grit'/);
    expect(() => normalizeImageOutcomesManifest(withPreset('gpen-shonen', { stylization: 1.5 }))).toThrow(/\[0, 1\]/);
    expect(() => normalizeImageOutcomesManifest(withPreset('hard-boiled', { tone: 'magenta' }))).toThrow(/one of: none, red, yellow, blue/);
  });

  it('renders a Style Lock section with the dial register phrased by band', () => {
    const low = buildRenderInstructions(withPreset('gpen-shonen', { stylization: 0.1 }));
    expect(low).toContain('## Style Lock');
    expect(low).toContain('preset: gpen-shonen (G-pen shonen)');
    expect(low).toContain('realism register');
    const high = buildRenderInstructions(withPreset('gpen-shonen', { stylization: 0.95 }));
    expect(high).toContain('enlarged heads and eyes');
    expect(high).not.toContain('realism register');
  });

  it('gpen palette dial: flat ink color by default, bw-tones on request', () => {
    const m = normalizeImageOutcomesManifest(withPreset('gpen-shonen'));
    expect(m.renderBrief.dials.palette).toBe('ink-color');
    const color = buildRenderInstructions(withPreset('gpen-shonen'));
    expect(color).toContain('flat ink color fills under the tones');
    const bw = buildRenderInstructions(withPreset('gpen-shonen', { palette: 'bw-tones' }));
    expect(bw).toContain('black and white with tones — no color anywhere');
    expect(bw).not.toContain('flat ink color fills');
    expect(() => normalizeImageOutcomesManifest(withPreset('gpen-shonen', { palette: 'sepia' })))
      .toThrow(/one of: ink-color, bw-tones/);
  });

  it('shojo-soft: eyes/hair/mouth/elongation lock, ornament bands, shared palette dial', () => {
    const m = normalizeImageOutcomesManifest(withPreset('shojo-soft'));
    expect(m.renderBrief.dials).toEqual({ ornament: 0.5, palette: 'ink-color' });
    const mid = buildRenderInstructions(withPreset('shojo-soft'));
    expect(mid).toContain('eyes are the focal instrument');
    expect(mid).toContain('flowing strand groups');
    expect(mid).toContain('mouths stay small and delicate');
    expect(mid).toContain('elongated and graceful');
    expect(mid).toContain('classic shojo ornament');
    const max = buildRenderInstructions(withPreset('shojo-soft', { ornament: 1, palette: 'bw-tones' }));
    expect(max).toContain('full efflorescence');
    expect(max).toContain('black and white with tones');
    expect(max).toContain('no heavy G-pen action linework');
    const min = buildRenderInstructions(withPreset('shojo-soft', { ornament: 0.1 }));
    expect(min).toContain('restrained ornament');
    expect(min).not.toContain('full efflorescence');
  });

  it('crosshatch: line-is-value lock, technique/density/ink dials', () => {
    const m = normalizeImageOutcomesManifest(withPreset('crosshatch'));
    expect(m.renderBrief.dials).toEqual({ technique: 'pen', density: 0.5, ink: 'black' });
    const mid = buildRenderInstructions(withPreset('crosshatch'));
    expect(mid).toContain('ALL value is line');
    expect(mid).toContain('hatch lines follow the form');
    expect(mid).toContain('free pen-and-ink hatching');
    expect(mid).toContain('classically worked');
    expect(mid).toContain('no screentones or halftone dots');
    const plate = buildRenderInstructions(withPreset('crosshatch', { technique: 'engraving', density: 0.95, ink: 'sepia' }));
    expect(plate).toContain('copperplate engraving discipline');
    expect(plate).toContain('densely worked — deep blacks');
    expect(plate).toContain('sepia / iron-gall brown ink');
    expect(plate).not.toContain('free pen-and-ink hatching');
    expect(() => normalizeImageOutcomesManifest(withPreset('crosshatch', { technique: 'mezzotint' })))
      .toThrow(/one of: pen, engraving, woodcut/);
  });

  it('ukiyo-e: flat-block lock, palette variants, weathering bands', () => {
    const m = normalizeImageOutcomesManifest(withPreset('ukiyo-e'));
    expect(m.renderBrief.dials).toEqual({ palette: 'nishiki', weathering: 0.3 });
    const fresh = buildRenderInstructions(withPreset('ukiyo-e'));
    expect(fresh).toContain('carved keyblock contour line');
    expect(fresh).toContain('bokashi is the only gradient');
    expect(fresh).toContain('full nishiki-e polychrome');
    expect(fresh).toContain('fresh impression');
    const aged = buildRenderInstructions(withPreset('ukiyo-e', { palette: 'aizuri', weathering: 1 }));
    expect(aged).toContain('aizuri-e');
    expect(aged).toContain('Prussian-blue');
    expect(aged).toContain('registration drift');
    expect(aged).not.toContain('nishiki-e polychrome');
    expect(() => normalizeImageOutcomesManifest(withPreset('ukiyo-e', { palette: 'gouache' })))
      .toThrow(/one of: nishiki, aizuri, sumi/);
  });

  it('louvrijks: oil-paint lock, anti-photo negatives, school/drama/patina dials', () => {
    const m = normalizeImageOutcomesManifest(withPreset('louvrijks'));
    expect(m.renderBrief.dials).toEqual({ school: 'dutch', drama: 0.5, patina: 0.3 });
    const dutch = buildRenderInstructions(withPreset('louvrijks'));
    expect(dutch).toContain('this is OIL PAINT');
    expect(dutch).toContain('light is painted, not photographed');
    expect(dutch).toContain('Rembrandt and Vermeer');
    expect(dutch).toContain('classic chiaroscuro');
    expect(dutch).toContain('no lens optics: no HDR, bloom, lens flare, bokeh');
    const italian = buildRenderInstructions(withPreset('louvrijks', { school: 'italian', drama: 1, patina: 0.9 }));
    expect(italian).toContain('Leonardo and Titian');
    expect(italian).toContain('deep tenebrism');
    expect(italian).toContain('craquelure');
    expect(italian).not.toContain('Rembrandt and Vermeer');
    // the painterly preset must NOT inherit the shelf's anti-painterly negative
    expect(dutch).not.toContain('no painterly brushwork');
    expect(() => normalizeImageOutcomesManifest(withPreset('louvrijks', { school: 'flemish' })))
      .toThrow(/one of: dutch, italian/);
  });

  it('tv-cartoon: outline-separation invariant, cel layers, register bands', () => {
    const m = normalizeImageOutcomesManifest(withPreset('tv-cartoon'));
    expect(m.renderBrief.dials).toEqual({ register: 0.5 });
    const mid = buildRenderInstructions(withPreset('tv-cartoon'));
    expect(mid).toContain('CHARACTERS STAY DISTINCT VIA THEIR OUTLINES');
    expect(mid).toContain('two-tone cel shade');
    expect(mid).toContain('WITHOUT outlines, so the outlined characters pop');
    expect(mid).toContain('animation-budget fidelity is the rule');
    expect(mid).toContain('saturday-action register');
    const hero = buildRenderInstructions(withPreset('tv-cartoon', { register: 1 }));
    expect(hero).toContain('mutant-hero register');
    expect(hero).toContain('nothing hyper-rendered');
    const sitcom = buildRenderInstructions(withPreset('tv-cartoon', { register: 0.1 }));
    expect(sitcom).toContain('sitcom-family register');
    expect(sitcom).not.toContain('mutant-hero register');
    expect(() => normalizeImageOutcomesManifest(withPreset('tv-cartoon', { register: 2 })))
      .toThrow(/\[0, 1\]/);
  });

  it('silver-age: brush ink + four-color lock, romance/pulp-hero and print dials', () => {
    const m = normalizeImageOutcomesManifest(withPreset('silver-age'));
    expect(m.renderBrief.dials).toEqual({ register: 0.5, print: 0.3 });
    const mid = buildRenderInstructions(withPreset('silver-age'));
    expect(mid).toContain('brush-and-nib ink over pencils');
    expect(mid).toContain('Ben-Day dot tone only where a gradation is genuinely needed');
    // plain by default: ordinary builds, crisp press, no blanket filters
    expect(mid).toContain('everyday register — plain-clothes figures with ordinary builds');
    expect(mid).toContain('crisp press');
    expect(mid).toContain('no blanket halftone, print-grain, or aging filter');
    const hero = buildRenderInstructions(withPreset('silver-age', { register: 1, print: 1 }));
    expect(hero).toContain('pulp-hero register');
    expect(hero).toContain('Kirby-energy poses');
    expect(hero).toContain('aged newsprint — yellowed pulp paper');
    const romance = buildRenderInstructions(withPreset('silver-age', { register: 0.1, print: 0.2 }));
    expect(romance).toContain('romance register');
    expect(romance).toContain('tearful close-ups');
    expect(romance).toContain('crisp press');
    expect(romance).not.toContain('pulp-hero register');
    // deliberately looser than tv-cartoon: a shorter lock
    expect(mid).not.toContain('CHARACTERS STAY DISTINCT');
  });

  it('antiquity: artifact lock, tradition variants, surface weathering', () => {
    const m = normalizeImageOutcomesManifest(withPreset('antiquity'));
    expect(m.renderBrief.dials).toEqual({ tradition: 'egyptian', surface: 0.5 });
    const egyptian = buildRenderInstructions(withPreset('antiquity'));
    expect(egyptian).toContain('IS a period artifact');
    expect(egyptian).toContain('composite view (head and legs in profile');
    expect(egyptian).toContain('depth by convention');
    expect(egyptian).toContain('NON-LEGIBLE');
    expect(egyptian).toContain('no Renaissance-or-later shading');
    const cave = buildRenderInstructions(withPreset('antiquity', { tradition: 'cave', surface: 1 }));
    expect(cave).toContain('ochre, charcoal, and hematite');
    expect(cave).toContain('hand stencils');
    expect(cave).toContain('weathered ruin — flaked and faded');
    expect(cave).not.toContain('composite view');
    const greco = buildRenderInstructions(withPreset('antiquity', { tradition: 'greco-roman', surface: 0.1 }));
    expect(greco).toContain('red-figure vase');
    expect(greco).toContain('fresh commission');
    expect(() => normalizeImageOutcomesManifest(withPreset('antiquity', { tradition: 'aztec' })))
      .toThrow(/one of: egyptian, cave, greco-roman/);
  });

  it('ink-brush: brush-and-water lock, sumi-e/ink-wash poles, literati tint', () => {
    const m = normalizeImageOutcomesManifest(withPreset('ink-brush'));
    expect(m.renderBrief.dials).toEqual({ register: 0.5, tint: 'none' });
    const mid = buildRenderInstructions(withPreset('ink-brush'));
    expect(mid).toContain('the brush is the whole instrument');
    expect(mid).toContain('emptiness is composition');
    expect(mid).toContain('flying-white (kasure)');
    expect(mid).toContain('balanced brush register');
    expect(mid).toContain('pure ink — no color anywhere');
    const sumie = buildRenderInstructions(withPreset('ink-brush', { register: 0.1 }));
    expect(sumie).toContain('sumi-e register — radical economy');
    expect(sumie).not.toContain('ink-wash register');
    const wash = buildRenderInstructions(withPreset('ink-brush', { register: 1, tint: 'pale' }));
    expect(wash).toContain('ink-wash register — layered tonal washes');
    expect(wash).toContain('literati manner');
    expect(() => normalizeImageOutcomesManifest(withPreset('ink-brush', { tint: 'gold' })))
      .toThrow(/one of: none, pale/);
  });

  it('art-nouveau: whiplash lock, illustration/glass-pane medium, gilding', () => {
    const m = normalizeImageOutcomesManifest(withPreset('art-nouveau'));
    expect(m.renderBrief.dials).toEqual({ medium: 0.3, gilding: 'none' });
    const poster = buildRenderInstructions(withPreset('art-nouveau'));
    expect(poster).toContain('the whiplash line rules');
    expect(poster).toContain('ornament is structural');
    expect(poster).toContain('Mucha-manner lithograph poster');
    expect(poster).toContain('no metallic accents');
    const glass = buildRenderInstructions(withPreset('art-nouveau', { medium: 1, gilding: 'gold' }));
    expect(glass).toContain('glass-pane register — stained glass');
    expect(glass).toContain('heavy dark leading');
    expect(glass).toContain('gilded accents — gold halos');
    expect(glass).not.toContain('Mucha-manner lithograph poster');
    expect(() => normalizeImageOutcomesManifest(withPreset('art-nouveau', { gilding: 'silver' })))
      .toThrow(/one of: none, gold/);
  });

  it('photo-realism: opts into max fidelity, photograph/3d-engine poles', () => {
    const m = normalizeImageOutcomesManifest(withPreset('photo-realism'));
    expect(m.renderBrief.dials).toEqual({ medium: 0.5 });
    const mid = buildRenderInstructions(withPreset('photo-realism'));
    expect(mid).toContain('opts INTO the maximum-detail register');
    expect(mid).toContain('cinematic hybrid register');
    expect(mid).toContain('no illustration, ink, or painterly stylization');
    const photo = buildRenderInstructions(withPreset('photo-realism', { medium: 0.1 }));
    expect(photo).toContain('looks captured, not made');
    expect(photo).not.toContain('3d-engine register');
    const cg = buildRenderInstructions(withPreset('photo-realism', { medium: 1 }));
    expect(cg).toContain('clearly CG and proud of it');
    expect(cg).toContain('AAA key-art polish');
    expect(() => normalizeImageOutcomesManifest(withPreset('photo-realism', { medium: -0.2 })))
      .toThrow(/\[0, 1\]/);
  });

  it('phrases the hard-boiled spot tone and the strict b/w default', () => {
    const bw = buildRenderInstructions(withPreset('hard-boiled'));
    expect(bw).toContain('strictly black and white');
    const red = buildRenderInstructions(withPreset('hard-boiled', { tone: 'red' }));
    expect(red).toContain('exactly one spot-color tone: red');
    expect(red).toContain('no full-color palette');
  });

  it('locks the steamboat cartoon discipline', () => {
    const text = buildRenderInstructions(withPreset('steamboat'));
    expect(text).toContain('rubber-hose');
    expect(text).toContain('squash, stretch');
    expect(text).toContain('no realistic anatomy or proportions');
  });

  it('caller brief fields override preset defaults; lock lines still render', () => {
    const m = withPreset('gpen-shonen');
    m.renderBrief.mood = 'quiet dread';
    const normalized = normalizeImageOutcomesManifest(m);
    expect(normalized.renderBrief.mood).toBe('quiet dread');
    const text = buildRenderInstructions(m);
    expect(text).toContain('mood: quiet dread');
    expect(text).toContain('G-pen ink — tapered pressure strokes');
  });

  it('presets work on image-outcome single shots too', () => {
    const shot = cityBlockoutFixture();
    shot.renderBrief = { preset: 'hard-boiled', dials: { tone: 'yellow' } };
    const m = normalizeImageOutcomesManifest(shot);
    expect(m.renderBrief.preset).toBe('hard-boiled');
    expect(buildRenderInstructions(shot)).toContain('spot-color tone: yellow');
  });
});

describe('page recipes (panel-blocking paradigms ported from the vexar pipeline)', () => {
  function boundless(pageRecipe, beats) {
    return {
      kind: 'sequential-art',
      title: 'Layout test',
      intent: 'auto-laid page',
      pageRecipe,
      panels: beats.map((beat, i) => ({ id: `p${i + 1}`, beat })),
    };
  }

  it('lays out a boundless manga page: 5 panels, landing panel dominant, RTL default', () => {
    const m = normalizeImageOutcomesManifest(
      boundless('manga-high-eye-control', ['open', 'cut one', 'cut two', 'rise', 'landing']),
    );
    expect(m.readingFlow).toBe('right-to-left, top-to-bottom');
    const areas = m.panels.map((p) => p.bounds.w * p.bounds.h);
    expect(new Set(m.panels.map((p) => JSON.stringify(p.bounds))).size).toBe(5); // distinct bounds
    expect(Math.max(...areas)).toBe(areas[4]); // the emotional landing panel is the big one
    // deterministic + idempotent (bounds are pinned after the first pass)
    expect(JSON.stringify(normalizeImageOutcomesManifest(m))).toBe(JSON.stringify(m));
  });

  it('explicit readingFlow and explicit bounds always win over the recipe', () => {
    const m = normalizeImageOutcomesManifest({
      ...boundless('manga-high-eye-control', ['a', 'b', 'c', 'd', 'e']),
      readingFlow: 'left-to-right, top-to-bottom',
    });
    expect(m.readingFlow).toBe('left-to-right, top-to-bottom');
    const raw = mangaSignalPageFixture();
    const fixture = normalizeImageOutcomesManifest(raw);
    expect(fixture.panels[0].bounds).toEqual(raw.panels[0].bounds); // untouched
  });

  it('other paradigms lay out too, and off-count pages fall back to the comic grid', () => {
    const sunday = normalizeImageOutcomesManifest(boundless('sunday-comic', ['1', '2', '3', '4', '5', '6']));
    expect(sunday.panels).toHaveLength(6);
    expect(sunday.readingFlow).toBe('left-to-right, top-to-bottom');
    const wide = normalizeImageOutcomesManifest(boundless('american-comic-widescreen-panels', ['a', 'b', 'c']));
    const widths = new Set(wide.panels.map((p) => p.bounds.w));
    expect(widths.size).toBe(1); // full-width letterbox rows
    const offCount = normalizeImageOutcomesManifest(boundless('manga-high-eye-control', ['a', 'b', 'c']));
    expect(offCount.panels).toHaveLength(3); // comicPageBounds fallback, no throw
  });

  it('boundless panels under an unknown recipe are rejected with the paradigm list', () => {
    expect(() => normalizeImageOutcomesManifest(boundless('sequential-page', ['a', 'b'])))
      .toThrow(/set pageRecipe to one of: manga-high-eye-control/);
    // a freeform recipe label stays fine when every panel has bounds
    const labeled = mangaSignalPageFixture();
    labeled.pageRecipe = 'my-custom-page';
    expect(normalizeImageOutcomesManifest(labeled).pageRecipe).toBe('my-custom-page');
  });

  it('renders the eye-line into the page brief AND every panel brief (the worker pull)', () => {
    const m = boundless('manga-high-eye-control', ['a', 'b', 'c', 'd', 'e']);
    const text = buildRenderInstructions(m);
    expect(text).toContain('eye-line: high vertical read with narrow reaction cuts and a large emotional landing panel');
    expect(text).toContain('Reading flow: right-to-left, top-to-bottom');
    const panel = buildRenderInstructions(m, { panelId: 'p2' });
    expect(panel).toContain('eye-line: high vertical read');
    expect(panel).toContain('Reading flow: right-to-left, top-to-bottom — compose the shot to lean with it');
  });
});

describe('characters (identity metadata + reference sheets)', () => {
  function withCharacters() {
    const m = mangaSignalPageFixture();
    m.characters = [
      {
        id: 'hero',
        name: 'Aki',
        description: 'wiry courier in her twenties; short asymmetric black hair, small scar over the left eyebrow',
        outfits: [
          { id: 'street', description: 'hooded courier jacket, fingerless gloves, knee wraps' },
          { id: 'rooftop-gear', description: 'harness over the jacket, climbing rig, goggles up on the forehead' },
        ],
      },
      { id: 'watcher', description: 'broad silhouetted figure in a long coat, face always in shadow' },
    ];
    m.panels[0].figures[0] = { id: 'hero', x: 386, y: 630, pose: 'stand', character: 'hero', outfit: 'street' };
    m.panels[2].figures[0] = { id: 'hero', x: 1110, y: 1165, scale: 1.85, pose: 'reach', character: 'hero', outfit: 'rooftop-gear' };
    return m;
  }

  it('normalizes characters + outfit references and keeps them as metadata', () => {
    const m = normalizeImageOutcomesManifest(withCharacters());
    expect(m.characters.map((c) => c.id)).toEqual(['hero', 'watcher']);
    expect(m.characters[0].outfits.map((o) => o.id)).toEqual(['street', 'rooftop-gear']);
    expect(m.panels[0].figures[0].character).toBe('hero');
    expect(m.panels[2].figures[0].outfit).toBe('rooftop-gear');
    // idempotent with characters
    expect(JSON.stringify(normalizeImageOutcomesManifest(m))).toBe(JSON.stringify(m));
  });

  it('rejects undeclared characters, unknown outfits, orphan outfits, and duplicates', () => {
    const badChar = withCharacters();
    badChar.panels[0].figures[0].character = 'villain';
    expect(() => normalizeImageOutcomesManifest(badChar)).toThrow(/'villain' is not declared/);
    const badOutfit = withCharacters();
    badOutfit.panels[0].figures[0].outfit = 'gala';
    expect(() => normalizeImageOutcomesManifest(badOutfit)).toThrow(/outfit 'gala' is not declared on character 'hero'/);
    const orphan = withCharacters();
    delete orphan.panels[0].figures[0].character;
    expect(() => normalizeImageOutcomesManifest(orphan)).toThrow(/outfit requires a character reference/);
    const dupe = withCharacters();
    dupe.characters.push({ id: 'hero', description: 'someone else' });
    expect(() => normalizeImageOutcomesManifest(dupe)).toThrow(/duplicate character id: hero/);
    const noDesc = withCharacters();
    delete noDesc.characters[1].description;
    expect(() => normalizeImageOutcomesManifest(noDesc)).toThrow(/description is required/);
  });

  it('page instructions carry the characters section and identity-bound figure phrases', () => {
    const text = buildRenderInstructions(withCharacters());
    expect(text).toContain('## Characters (identity metadata');
    expect(text).toContain('hero (Aki): wiry courier');
    expect(text).toContain('Outfits: street, rooftop-gear.');
    expect(text).toContain('[character hero, outfit rooftop-gear — match the reference sheet exactly]');
    // panel scope keeps the full character roster for continuity
    const scoped = buildRenderInstructions(withCharacters(), { panelId: 'p1' });
    expect(scoped).toContain('## Characters');
    expect(scoped).toContain('[character hero, outfit street');
  });

  it('builds a neutral-lighting sheet brief per character, one row per outfit, style-locked', async () => {
    const { buildCharacterSheetInstructions } = await import('./instructions.js');
    const m = withCharacters();
    m.renderBrief = { preset: 'gpen-shonen', dials: { palette: 'bw-tones' } };
    const sheet = buildCharacterSheetInstructions(m, 'hero');
    expect(sheet).toContain('Character reference sheet — Aki');
    expect(sheet).toContain('front, three-quarter, side, and back');
    expect(sheet).toContain('NEUTRAL PRESENTATION (overrides the page mood/lighting)');
    expect(sheet).toContain('One horizontal row per outfit (street, rooftop-gear)');
    expect(sheet).toContain('ONLY the outfit changes');
    expect(sheet).toContain('## Style Lock');
    expect(sheet).toContain('G-pen');
    expect(sheet).toContain('no text, labels, or annotations on the sheet');
    // a character with no outfits gets the implicit default row
    const solo = buildCharacterSheetInstructions(m, 'watcher');
    expect(solo).toContain('One horizontal row per outfit (default)');
    expect(() => buildCharacterSheetInstructions(m, 'villain')).toThrow(/unknown character id/);
    // image-outcome casts characters now (picture-book adoption) — an
    // uncast one still refuses a sheet brief, but as a roster miss.
    expect(() => buildCharacterSheetInstructions(cityBlockoutFixture(), 'hero')).toThrow(/unknown character id/);
  });

  it('image-outcome single shots cast characters too (the picture-book page case)', async () => {
    const { buildCharacterSheetInstructions } = await import('./instructions.js');
    const shot = cityBlockoutFixture();
    shot.characters = [
      {
        id: 'hero',
        name: 'Aki',
        description: 'wiry courier in her twenties; short asymmetric black hair',
        outfits: [{ id: 'street', description: 'hooded courier jacket' }],
      },
    ];
    shot.figures = [{ id: 'hero', x: 760, y: 780, pose: 'stand', character: 'hero', outfit: 'street' }];
    const m = normalizeImageOutcomesManifest(shot);
    expect(m.characters.map((c) => c.id)).toEqual(['hero']);
    expect(m.figures[0].character).toBe('hero');
    expect(m.figures[0].outfit).toBe('street');
    expect(JSON.stringify(normalizeImageOutcomesManifest(m))).toBe(JSON.stringify(m)); // idempotent

    const text = buildRenderInstructions(shot);
    expect(text).toContain('## Characters (identity metadata');
    expect(text).toContain('condition every shot on them');
    expect(text).toContain('[character hero, outfit street — match the reference sheet exactly]');

    // the sheet brief works from the single-shot manifest as well
    const sheet = buildCharacterSheetInstructions(shot, 'hero');
    expect(sheet).toContain('Character reference sheet — Aki');
    expect(sheet).toContain('NEUTRAL PRESENTATION');

    // binding validation matches sequential-art's
    const bad = cityBlockoutFixture();
    bad.figures = [{ x: 10, y: 10, character: 'ghost' }];
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/'ghost' is not declared/);
    const badOutfit = cityBlockoutFixture();
    badOutfit.characters = [{ id: 'hero', description: 'courier' }];
    badOutfit.figures = [{ x: 10, y: 10, character: 'hero', outfit: 'gala' }];
    expect(() => normalizeImageOutcomesManifest(badOutfit)).toThrow(/outfit 'gala' is not declared/);
  });

  it('a characterless page is unchanged (no characters section, empty metadata)', () => {
    const m = normalizeImageOutcomesManifest(mangaSignalPageFixture());
    expect(m.characters).toEqual([]);
    expect(buildRenderInstructions(mangaSignalPageFixture())).not.toContain('## Characters');
  });
});

describe('character-sheet kind (the reusable identity primitive)', () => {
  function sheetManifest() {
    return {
      kind: 'character-sheet',
      title: 'Aki — courier',
      character: {
        id: 'aki',
        name: 'Aki',
        description: 'wiry courier, short asymmetric black hair',
        outfits: [
          { id: 'street', description: 'hooded courier jacket' },
          { id: 'rooftop-gear', description: 'harness and goggles' },
        ],
      },
      renderBrief: { preset: 'gpen-shonen' },
    };
  }

  it('normalizes to the v1 contract with a per-row viewBox and neutral brief defaults', () => {
    const m = normalizeImageOutcomesManifest(sheetManifest());
    expect(m.contractVersion).toBe('character-sheet/v1');
    expect(m.viewBox).toEqual({ width: 1536, height: 1024 }); // 512 per outfit row
    expect(m.renderBrief.negative).toContain('no scene, props, or background art');
    expect(m.renderBrief.preset).toBe('gpen-shonen');
    expect(isImageOutcomesKind('character-sheet')).toBe(true);
    // idempotent
    expect(JSON.stringify(normalizeImageOutcomesManifest(m))).toBe(JSON.stringify(m));
  });

  it('requires an inline character and rejects ref-bearing ones', () => {
    expect(() => normalizeImageOutcomesManifest({ kind: 'character-sheet', title: 'x' }))
      .toThrow(/characters\[0\] must be an object/);
    const bad = sheetManifest();
    bad.character.ref = 'sk_other';
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/refs point AT sheets/);
  });

  it('renders the turnaround-strip scaffold: four view columns, one row per outfit', () => {
    const svg = renderScaffoldSvg(sheetManifest());
    expect(svg).toContain('>front<');
    expect(svg).toContain('>three-quarter<');
    expect(svg).toContain('>back<');
    expect(svg).toContain('outfit: street');
    expect(svg).toContain('outfit: rooftop-gear');
    expect(renderScaffoldSvg(sheetManifest())).toBe(svg); // deterministic
  });

  it('dispatches instructions to the sheet brief, style-locked', () => {
    const text = buildRenderInstructions(sheetManifest());
    expect(text).toContain('Character reference sheet — Aki');
    expect(text).toContain('NEUTRAL PRESENTATION');
    expect(text).toContain('One horizontal row per outfit (street, rooftop-gear)');
    expect(text).toContain('## Style Lock');
  });

  it('routes through sketch integration: svg render mode, illustration bucket', async () => {
    const { validateSketchManifest, sketchRenderMode, classifyBucket } = await import('../sketch/sketch-manifest.js');
    expect(validateSketchManifest(sheetManifest()).ok).toBe(true);
    expect(sketchRenderMode({ kind: 'character-sheet' })).toBe('svg');
    expect(classifyBucket({ kind: 'character-sheet' })).toBe('illustration');
  });
});

describe('rig figures (protoform high-fidelity posing)', () => {
  function rigVariant() {
    const m = mangaSignalPageFixture();
    m.panels[2].figures[0] = {
      id: 'hero',
      x: 1110,
      y: 1165,
      scale: 1.85,
      rig: {
        pose: { shR: { pitch: 150, yaw: 20 }, elbowR: 10, head: { pitch: -20 }, spine: { sagittal: 12, axial: 10 } },
        proto: { sex: 'male' },
        view: 'three-quarter',
        note: 'reaching high toward the signal, back arched, gaze up',
      },
    };
    return m;
  }

  it('normalizes a rig alongside the stick vocabulary', () => {
    const m = normalizeImageOutcomesManifest(rigVariant());
    const hero = m.panels[2].figures[0];
    expect(hero.rig.view).toBe('three-quarter');
    expect(hero.pose).toBe('stand'); // stick default retained; scaffold prefers rig
  });

  it('rejects malformed rigs', () => {
    const bad = rigVariant();
    bad.panels[2].figures[0].rig = ['nope'];
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/rig must be an object/);
    const badView = rigVariant();
    badView.panels[2].figures[0].rig = { view: { az: 1 } };
    expect(() => normalizeImageOutcomesManifest(badView)).toThrow(/rig.view/);
  });

  it('embeds the posed protoform into the panel scaffold, deterministically', () => {
    const svg = renderScaffoldSvg(rigVariant());
    expect(svg).toMatch(/<svg x="[\d.-]+" y="[\d.-]+" width="[\d.-]+" height="370"/); // 200 × 1.85
    expect(svg).toContain('preserveAspectRatio="xMidYMax meet"');
    expect(renderScaffoldSvg(rigVariant())).toBe(svg);
    // panel crop carries the rig figure too
    expect(renderScaffoldSvg(rigVariant(), { panelId: 'p3' })).toContain('xMidYMax');
  });

  it('instructions defer to the rig silhouette, via the note', () => {
    const text = buildRenderInstructions(rigVariant());
    expect(text).toContain('hero — reaching high toward the signal');
    expect(text).not.toContain('hero — reaching upward/outward');
  });

  it('samples the motion vocabulary at a phase (walk gait, not hand-authored angles)', () => {
    const m = mangaSignalPageFixture();
    m.panels[0].figures[0] = {
      id: 'hero', x: 386, y: 630, scale: 1.25,
      rig: { motion: 'walk', phase: 0.3, view: 'lateral' },
    };
    const svgA = renderScaffoldSvg(m);
    expect(svgA).toContain('preserveAspectRatio="xMidYMax meet"');
    expect(renderScaffoldSvg(m)).toBe(svgA); // deterministic
    m.panels[0].figures[0].rig.phase = 0.8;  // opposite stride
    expect(renderScaffoldSvg(m)).not.toBe(svgA);
    const text = buildRenderInstructions(m);
    expect(text).toContain("hero — mid-'walk' at phase 0.8");
  });

  it('explicit pose keys override the sampled motion', async () => {
    const { sampleMotionPose } = await import('../polygonizer/figure-render.js');
    const sampled = sampleMotionPose('walk', 0.3);
    expect(sampled).toBeTruthy();
    const m = mangaSignalPageFixture();
    m.panels[0].figures[0] = {
      id: 'hero', x: 386, y: 630, scale: 1.25,
      rig: { motion: 'walk', phase: 0.3, pose: { head: { pitch: 25 } }, view: 'lateral' },
    };
    const withOverride = renderScaffoldSvg(m);
    delete m.panels[0].figures[0].rig.pose;
    expect(renderScaffoldSvg(m)).not.toBe(withOverride);
  });

  it('rejects phase without motion and out-of-range phase', () => {
    const bad = mangaSignalPageFixture();
    bad.panels[0].figures[0] = { id: 'hero', x: 386, y: 630, rig: { phase: 0.5 } };
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/rig.phase requires rig.motion/);
    bad.panels[0].figures[0].rig = { motion: 'walk', phase: 1.5 };
    expect(() => normalizeImageOutcomesManifest(bad)).toThrow(/rig.phase must be a number/);
  });

  it('image-outcome single shots take figures too', () => {
    const shot = cityBlockoutFixture();
    shot.figures = [{ id: 'walker', x: 768, y: 780, scale: 0.9, pose: 'walk' }];
    const m = normalizeImageOutcomesManifest(shot);
    expect(m.figures[0].pose).toBe('walk');
    expect(renderScaffoldSvg(shot)).toContain('<circle cx="768"');
    expect(buildRenderInstructions(shot)).toContain('walker — walking, easy gait');
  });
});

describe('sketch integration (I1)', () => {
  it('validates through validateSketchManifest and routes render/bucket', async () => {
    const { validateSketchManifest, sketchRenderMode, classifyBucket } = await import('../sketch/sketch-manifest.js');
    expect(validateSketchManifest(mangaSignalPageFixture()).ok).toBe(true);
    expect(validateSketchManifest(cityBlockoutFixture()).ok).toBe(true);
    const bad = validateSketchManifest({ kind: 'image-outcome', title: 'x', intent: 'y', forms: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toMatch(/at least one form/);
    for (const kind of ['image-outcome', 'sequential-art']) {
      expect(sketchRenderMode({ kind })).toBe('svg');
      expect(classifyBucket({ kind })).toBe('illustration');
    }
  });

  it('renders through the stored-sketch dispatcher', async () => {
    const { renderStoredSketchSvg } = await import('../sketch/stored-sketch-svg.js');
    const svg = await renderStoredSketchSvg({ manifest: mangaSignalPageFixture() });
    expect(svg).toContain('clip-p1');
  });
});

describe('final page composite (I5) + render targets', () => {
  function twoPanelPage() {
    return {
      kind: 'sequential-art',
      title: 'Final test',
      intent: 'composite check',
      viewBox: { width: 300, height: 400 },
      panels: [
        {
          id: 'p1',
          beat: 'opening',
          bounds: { x: 20, y: 20, w: 260, h: 170 },
          bubbleZones: [{ x: 40, y: 40, w: 180, h: 60, lettering: 'It begins tonight.' }],
        },
        { id: 'p2', beat: 'closing', bounds: { x: 20, y: 210, w: 260, h: 170 } },
      ],
    };
  }

  async function tinyPng(color) {
    const { default: sharp } = await import('sharp');
    return sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toBuffer();
  }

  it('renderTargets mirrors the strategy for every kind', () => {
    expect(renderTargets(cityBlockoutFixture())).toEqual(['page']);
    expect(renderTargets(mangaSignalPageFixture())).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(renderTargets({ ...mangaSignalPageFixture(), renderStrategy: 'whole-page' })).toEqual(['page']);
    expect(renderTargets({ ...mangaSignalPageFixture(), renderStrategy: 'hybrid' })).toEqual(['page', 'p1', 'p2', 'p3', 'p4']);
  });

  it('the overlay carries borders, bubbles, and LETTERING — and none of the scaffold language', async () => {
    const { renderPageOverlaySvg } = await import('./final-page.js');
    const overlay = renderPageOverlaySvg(twoPanelPage());
    expect(overlay).toContain('It begins');
    expect(overlay).toContain('tonight.');
    expect(overlay).toContain('stroke-width="6"'); // panel borders
    expect(overlay).not.toContain('<circle'); // no stick figures
    expect(overlay).not.toContain('p1 wide-establishing'); // no scaffold labels
  });

  it('composites per-panel renders + overlay into a deterministic final page', async () => {
    const { compositeFinalPage } = await import('./final-page.js');
    const renders = { p1: await tinyPng({ r: 200, g: 40, b: 40 }), p2: await tinyPng({ r: 40, g: 40, b: 200 }) };
    const final = await compositeFinalPage(twoPanelPage(), renders);
    expect(final.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(await compositeFinalPage(twoPanelPage(), renders)).toEqual(final); // stable
    // the I5 exit criterion: a lettering-only edit changes final.png
    // without touching the generative layer
    const relettered = twoPanelPage();
    relettered.panels[0].bubbleZones[0].lettering = 'It ends tonight.';
    expect(await compositeFinalPage(relettered, renders)).not.toEqual(final);
    await expect(compositeFinalPage(twoPanelPage(), { p1: renders.p1 })).rejects.toThrow(/missing bound renders.*p2/);
  });
});

describe('module invariants', () => {
  it('contains no wall-clock or dice calls (timeless recipes)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(here).filter((f) => f.endsWith('.js') && !f.includes('.test.'));
    for (const file of sources) {
      const text = readFileSync(path.join(here, file), 'utf8');
      expect(text, `${file} must not use wall-clock/dice`).not.toMatch(/new Date\(|Date\.now\(|Math\.random\(/);
    }
  });
});
