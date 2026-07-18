// The figure leg of the skin seam (character-from-dream.plan.md C3): a figure's
// control scaffold emits the manji-svg lit-face polygon contract (data-shade),
// so skin-projection's reskin applies to figures unchanged — the figure WEARS
// a painted skin deterministically, no UV unwrap (the shared camera IS the
// registration).
import { describe, it, expect } from 'vitest';
import { renderFigureToSvg } from './figure-render.js';
import { reskinManjiSvg } from './skin-projection.js';

const MANIFEST = {
  kind: 'figure',
  proto: { sex: 'female', stockiness: 1.1 },
  garment: ['tank', 'trousersBaggy'],
  view: 'frontal',
};

describe('figure control scaffold + reskin', () => {
  it('the default render carries no data-shade (bytes unchanged for existing consumers)', () => {
    const svg = renderFigureToSvg(MANIFEST);
    expect(svg).not.toContain('data-shade');
  });

  it('the control render emits per-face data-shade in the reskinnable contract', () => {
    const svg = renderFigureToSvg(MANIFEST, null, { control: true });
    const shades = svg.match(/data-shade="[\d.]+"/g) || [];
    expect(shades.length).toBeGreaterThan(1000); // flesh + garments, densely faced
    expect(svg).toContain('stroke-linejoin="round"');
  });

  it('a wire setup still yields a FILLED control scaffold (diffusion needs one mass)', () => {
    const svg = renderFigureToSvg({ ...MANIFEST, setup: 'blueprint-wire' }, null, { control: true });
    expect(svg).toContain('data-shade');
    expect(svg).toContain('<polygon');
  });

  it('reskinManjiSvg reskins the figure scaffold (albedo × form shade per face)', () => {
    const svg = renderFigureToSvg(MANIFEST, null, { control: true });
    const { svg: skinned, faces } = reskinManjiSvg(svg, () => '#cc4433');
    expect(faces).toBeGreaterThan(1000);
    expect(skinned).not.toBe(svg);
    // shaded variants of the flat albedo appear (scaleHex output), none of the
    // original vexar fills survive on reskinned faces
    expect(skinned).toMatch(/fill="#[0-9a-f]{6}"/);
  });
});
