import { describe, it, expect } from 'vitest';
import { MADE_PATTERNS, MADE_PATTERN_IDS, MADE_LAWS, MADE_KITS, MADE_RAILS, MADE_SPOTS, madeStyle, designPiece, readMade } from './out-made.js';
import { SWATCHES, madeRamp, accentOf, hexOfRgb } from './style/swatches.js';
import { outIndexHtml } from './out-index-html.js';
import { ISEKAI_STYLES } from './isekai.js';
import { NATURE_STYLES } from './nature.js';

// the outdoor master index: man-made architecture as a cascade (laws → kit → trail → piece) and the swatches every
// outdoor colour comes from (era/out-made.js, era/style/swatches.js, era/out-index-html.js)
describe('out-made', () => {
  it('the swatches are where the kits\' colours come from', () => {
    for (const k of ['isekai-meadow', 'isekai-bamboo', 'isekai-sakura']) expect(ISEKAI_STYLES[k].palette).toBe(SWATCHES[k].land);
    expect(NATURE_STYLES['nature-trail'].accent).toBe(hexOfRgb(accentOf('nature-trail')));
    for (const k of Object.keys(SWATCHES)) {
      for (const n of Object.keys(SWATCHES[k].made)) { const r = madeRamp(k, n); expect(r.length).toBeGreaterThanOrEqual(3); for (const c of r) expect(c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)).toBe(true); }
      // the darkest stop is never black, and a ramp climbs in value
      for (const r of [...Object.values(SWATCHES[k].land || {}), ...Object.keys(SWATCHES[k].made).map((n) => madeRamp(k, n))]) {
        const luma = r.map(([a, b, c]) => 0.3 * a + 0.59 * b + 0.11 * c);
        expect(luma[0]).toBeGreaterThan(20);
        for (let i = 1; i < luma.length; i++) expect(luma[i]).toBeGreaterThan(luma[i - 1]);
      }
    }
    expect(() => madeRamp('isekai-meadow', 'neon')).toThrow(/no ramp 'neon'/);
  });

  it('every pattern names its spots, parts and joints from the index, and each of its laws is a check or a placement', () => {
    for (const id of MADE_PATTERN_IDS) {
      const P = MADE_PATTERNS[id];
      expect(P.at.every((s) => MADE_SPOTS.includes(s))).toBe(true);
      expect(MADE_LAWS.some((l) => l.pattern === id && l.test)).toBe(true);
    }
    expect(MADE_KITS).toEqual(Object.keys(SWATCHES));
  });

  it('a piece in every kit holds its laws', () => {
    for (const k of MADE_KITS) for (const id of MADE_PATTERN_IDS) {
      const d = designPiece(id, madeStyle(k, 8), 8);
      expect(d.laws.filter((l) => l.ok === false)).toEqual([]);
    }
  });

  it('the cascade: a trail narrows a token or re-points a swatch, and the rest falls through unchanged', () => {
    const base = madeStyle('isekai-meadow', 8), ford = madeStyle('isekai-meadow', 8, { tokens: { timber: 'round', hat: [0.8, 0.9] }, swatches: { hat: 'foliage' } });
    expect(ford.tokens.timber).toBe('round');
    expect(ford.tokens.hat).toBeGreaterThanOrEqual(0.8);
    expect(ford.from).toMatchObject({ timber: 'trail', hat: 'trail', joint: 'kit' });
    for (const k of ['joint', 'edge', 'bond', 'relief', 'chunk', 'paint', 'wear']) expect(ford.tokens[k]).toBe(base.tokens[k]);
    expect(ford.swatch.hat).toMatchObject({ ramp: 'foliage', from: 'trail', stops: SWATCHES['isekai-meadow'].land.foliage });
    expect(ford.swatch.timber.from).toBe('kit');
    // tokens stay inside the kit's rails for every seed
    for (let s = 1; s <= 40; s++) { const st = madeStyle('isekai-bamboo', s); expect(MADE_RAILS['isekai-bamboo'].timber).toContain(st.tokens.timber); expect(st.tokens.chunk).toBeGreaterThanOrEqual(0.95); }
  });

  it('a trail cannot loosen a law, leave its kit\'s rails, or put a piece where it does not stand; and says why', () => {
    const m = (made) => () => readMade(made, 'isekai-meadow');
    expect(m({ laws: {} })).toThrow(/cannot loosen a law/);
    expect(m({ tokens: { joint: 'lashed' } })).toThrow(/allows joint pegged \| notched/);
    expect(m({ tokens: { chunk: 2 } })).toThrow(/allows chunk 1.15–1.35/);
    expect(m({ tokens: { colour: 'red' } })).toThrow(/not a token/);
    expect(m({ swatches: { paint: 'neon' } })).toThrow(/no ramp 'neon'/);
    expect(m({ swatches: { glow: 'paint' } })).toThrow(/not a swatch role/);
    expect(m({ pieces: [{ pattern: 'post-fence', at: 'pit', dims: { railTop: 0.7 } }] })).toThrow(/railTop is 0.95–1.05, inside its laws/);
    expect(m({ pieces: [{ pattern: 'inukshuk', from: 0, to: 10 }] })).toThrow(/stands at a spot/);
    expect(m({ pieces: [{ pattern: 'beam-bridge', at: 'trailhead' }] })).toThrow(/stands at crossing, pit/);
    expect(m({ pieces: [{ pattern: 'gazebo', at: 'rest' }] })).toThrow(/not a pattern/);
    expect(m({ walls: [] })).toThrow(/not a layer/);
    expect(readMade({ pieces: [{ pattern: 'paving', from: 4, to: 16 }, { pattern: 'beam-bridge', at: 'crossing', dims: { span: 6 } }] }, 'isekai-meadow').pieces)
      .toEqual([{ pattern: 'paving', from: 4, to: 16, dims: {} }, { pattern: 'beam-bridge', at: 'crossing', dims: { span: 6 } }]);
    expect(() => madeStyle('gothic-stone', 1)).toThrow(/indexed for the outdoor kits/);
  });

  it('a piece is a pure function of its pattern, style and seed', () => {
    const st = madeStyle('isekai-sakura', 3);
    for (const id of MADE_PATTERN_IDS) expect(JSON.stringify(designPiece(id, st, 5))).toBe(JSON.stringify(designPiece(id, madeStyle('isekai-sakura', 3), 5)));
    expect(designPiece('beam-bridge', st, 5, { span: 7.5 }).measures.span).toBe(7.5);
  });

  it('the index page draws every swatch, pattern and kit, and is the same page every time', () => {
    const h = outIndexHtml();
    expect(h).toBe(outIndexHtml());
    for (const id of MADE_PATTERN_IDS) expect(h).toContain(`id="p-${id}"`);
    for (const k of MADE_KITS) expect(h).toContain(`<h3>${k}</h3>`);
    expect(h).toContain(hexOfRgb(SWATCHES['isekai-meadow'].land.grass[2]).slice(1));
    expect(h).not.toContain('BROKEN');
    expect(h).toContain('cannot loosen a law');
  });
});
