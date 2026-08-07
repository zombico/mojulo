// sprite-sheet manifest kind — normalization, the per-frame render-target
// expansion (base frame first, so the bake anchor renders before the variants
// that diff against it), the grid layout, and the scaffold/instructions/params
// branches. The kind rides the image-outcomes render-handoff seam, so the
// load-bearing contract is renderTargets + isImageOutcomesKind + the scaffold.
import { describe, it, expect } from 'vitest';
import {
  normalizeImageOutcomesManifest,
  normalizeSpriteSheetManifest,
  renderTargets,
  isImageOutcomesKind,
  parseSpriteTarget,
  spriteGridLayout,
  KIND_SPRITE_SHEET,
} from './manifest.js';
import { renderScaffoldSvg } from './scaffold.js';
import { buildRenderInstructions } from './instructions.js';
import { buildLocalRenderParams } from './local-render-params.js';

const base = {
  kind: KIND_SPRITE_SHEET,
  title: 'Hero — walk cycle',
  frames: [
    { action: 'idle' },
    { action: 'walk-1' },
    { action: 'walk-2' },
    { action: 'jump' },
  ],
  characters: [{ id: 'hero', description: 'stout knight, red cape, round shield' }],
};

describe('sprite-sheet normalization', () => {
  it('is an image-outcomes kind', () => {
    expect(isImageOutcomesKind(KIND_SPRITE_SHEET)).toBe(true);
  });

  it('pins defaults, register budget, grid, and the contract version', () => {
    const m = normalizeImageOutcomesManifest(base);
    expect(m.contractVersion).toBe('sprite-sheet/v1');
    expect(m.register).toBe('16bit');
    expect(m.bake).toEqual({ grid: [16, 16], budget: 15 });
    expect(m.cell).toEqual({ width: 96, height: 96 });
    // 4 frames → 2 cols → 2 rows
    expect(m.cols).toBe(2);
    expect(m.rows).toBe(2);
    // viewBox tiles cells + gutters
    expect(m.viewBox.width).toBe(2 * 96 + 3 * 8);
  });

  it('defaults the first frame to base when none is flagged', () => {
    const m = normalizeSpriteSheetManifest(base);
    expect(m.frames.filter((f) => f.base)).toHaveLength(1);
    expect(m.frames[0].base).toBe(true);
  });

  it('refuses two base frames', () => {
    expect(() => normalizeSpriteSheetManifest({
      ...base,
      frames: [{ action: 'idle', base: true }, { action: 'walk', base: true }],
    })).toThrow(/exactly one frame may set base/);
  });

  it('derives stable ids from action[-direction] and rejects dup ids', () => {
    const m = normalizeSpriteSheetManifest({
      ...base,
      frames: [{ action: 'walk', direction: 'east' }, { action: 'walk', direction: 'west' }],
    });
    expect(m.frames.map((f) => f.id)).toEqual(['walk-east', 'walk-west']);
    expect(() => normalizeSpriteSheetManifest({
      ...base,
      frames: [{ action: 'walk', id: 'x' }, { action: 'jump', id: 'x' }],
    })).toThrow(/duplicate frame id/);
  });

  it('requires at least one frame and a title', () => {
    expect(() => normalizeSpriteSheetManifest({ ...base, frames: [] })).toThrow(/at least one frame/);
    expect(() => normalizeSpriteSheetManifest({ ...base, title: undefined })).toThrow(/requires title/);
  });

  it('preserves a baked payload across re-normalization', () => {
    const baked = { register: '16bit', grid: [16, 16], sprites: { idle: { size: [16, 16], palette: ['#000000'], cells: [] } } };
    const m = normalizeSpriteSheetManifest({ ...base, baked });
    expect(m.baked).toEqual(baked);
    // round-trip: re-normalizing the normalized form keeps it
    expect(normalizeSpriteSheetManifest(m).baked).toEqual(baked);
  });
});

describe('sprite-sheet render targets', () => {
  it('expands to one target per frame, base first', () => {
    const targets = renderTargets(base);
    expect(targets).toHaveLength(4);
    expect(targets[0]).toBe('frame-idle'); // base
    expect(new Set(targets)).toEqual(new Set(['frame-idle', 'frame-walk-1', 'frame-walk-2', 'frame-jump']));
  });

  it('orders a non-first base ahead of the rest', () => {
    const targets = renderTargets({
      ...base,
      frames: [{ action: 'walk-1' }, { action: 'idle', base: true }, { action: 'jump' }],
    });
    expect(targets[0]).toBe('frame-idle');
  });

  it('parseSpriteTarget resolves a frame to its cell placement', () => {
    const m = normalizeSpriteSheetManifest(base);
    const cell = parseSpriteTarget(m, 'frame-walk-2');
    expect(cell.frame.id).toBe('walk-2');
    // walk-2 is index 2 → col 0, row 1
    expect(cell.col).toBe(0);
    expect(cell.row).toBe(1);
    expect(() => parseSpriteTarget(m, 'frame-nope')).toThrow(/not declared/);
    expect(() => parseSpriteTarget(m, 'page')).toThrow(/not a sprite-sheet render target/);
  });

  it('grid layout places frames left-to-right, top-to-bottom with gutters', () => {
    const layout = spriteGridLayout(normalizeSpriteSheetManifest(base));
    expect(layout[0]).toMatchObject({ col: 0, row: 0, x: 8, y: 8, w: 96, h: 96 });
    expect(layout[1]).toMatchObject({ col: 1, row: 0, x: 8 + 96 + 8, y: 8 });
    expect(layout[2]).toMatchObject({ col: 0, row: 1, y: 8 + 96 + 8 });
  });
});

describe('sprite-sheet scaffold', () => {
  it('renders the whole grid as a deterministic SVG', () => {
    const a = renderScaffoldSvg(base);
    const b = renderScaffoldSvg(base);
    expect(a).toBe(b); // same manifest → same bytes
    expect(a).toContain('<svg');
    expect(a).toContain('walk-1'); // per-cell action label
    expect(a).toContain('·base');
  });

  it('crops to a single cell for a per-frame target', () => {
    const cell = renderScaffoldSvg(base, { panelId: 'frame-jump' });
    // cropped to the cell size (96×96), not the full sheet
    expect(cell).toContain('viewBox="0 0 96 96"');
  });

  it('control variant drops labels and dashes', () => {
    const control = renderScaffoldSvg(base, { control: true });
    expect(control).not.toContain('walk-1'); // labels stripped
    expect(control).not.toContain('stroke-dasharray');
  });
});

describe('sprite-sheet instructions + local params', () => {
  it('scopes the brief to one frame and holds identity', () => {
    const text = buildRenderInstructions(base, { target: 'frame-jump' });
    expect(text).toContain('jump');
    expect(text).toContain('TRANSPARENT');
    expect(text).toContain('stout knight'); // character identity
  });

  it('flags the base frame as canonical', () => {
    const text = buildRenderInstructions(base, { target: 'frame-idle' });
    expect(text).toContain('BASE');
  });

  it('builds diffusion params sized to the cell', () => {
    const p = buildLocalRenderParams(base, 'frame-walk-1');
    expect(p.target).toBe('frame-walk-1');
    expect(p.size.width).toBeGreaterThan(0);
    expect(p.edit.preserve).toBe('sprite');
    expect(p.identity.characters).toEqual(['hero']);
    expect(p.negative.some((n) => /transparent|background|shadow/i.test(n))).toBe(true);
  });
});
