import { describe, it, expect } from 'vitest';
import { renderManjiTreeToSvg } from './manji-svg.js';
import { reskinManjiSvg, rasterSampler, parseViewBox } from './skin-projection.js';

const PHYSICS = { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1, defaultSagFactor: 0.12 };

function polygomer() {
  return {
    kind: 'manji-tree',
    dimensions: '3d',
    physics: PHYSICS,
    showSlotMarkers: false,
    tree: {
      id: 'world',
      spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.1 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'top', position: { x: 0, y: 0, z: 4 } },
        { id: 'base', position: { x: 0, y: 0, z: 0 } },
      ],
    },
    lathes: [
      {
        axisFrom: 'world/slot/top',
        axisTo: 'world/slot/base',
        // STROKE-only style — control mode force-fills it
        profile: [{ t: 0, radius: 0.4 }, { t: 0.5, radius: 0.9 }, { t: 1, radius: 0.4 }],
        crossSections: 16,
        samples: 24,
        style: { stroke: '#777', width: 0.5 },
      },
    ],
    title: 'test',
  };
}

describe('skin-projection', () => {
  it('reskins every face with albedo × the deterministic Lambert shade', () => {
    const control = renderManjiTreeToSvg(polygomer(), { control: true });
    const before = (control.match(/<polygon/g) || []).length;
    expect(before).toBeGreaterThan(0);
    // control scaffolds carry the per-face shade factor for the bake
    expect(control).toMatch(/data-shade="/);

    const { svg, faces } = reskinManjiSvg(control, () => '#ff0000');
    expect(faces).toBe(before);
    // exactly `faces` reskinned fills are RED (albedo kept in the red channel) …
    const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    const redFills = fills.filter((c) => /^#[0-9a-f]{2}0000$/.test(c));
    expect(redFills.length).toBe(faces);
    // … but SHADED — the red channel varies with the face normal (not flat)
    expect(new Set(redFills).size).toBeGreaterThan(1);
    expect(parseViewBox(svg)).toEqual(parseViewBox(control));
  });

  it('returns raw albedo when a face carries no shade factor', () => {
    const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<polygon points="1,1 2,1 2,2 1,2" fill="#123456" stroke="#123456" stroke-width="0.6" stroke-linejoin="round"/></svg>';
    const { svg } = reskinManjiSvg(plain, () => '#ff0000');
    expect(svg).toContain('fill="#ff0000"');
  });

  it('samples the skin by normalized screen position', () => {
    // 2x1 raster: left half red, right half blue
    const data = Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]);
    const sampler = rasterSampler({ data, width: 2, height: 1, channels: 4 });
    expect(sampler(0.0, 0.5)).toBe('#ff0000');
    expect(sampler(0.99, 0.5)).toBe('#0000ff');
  });

  it('throws on a control SVG with no viewBox', () => {
    expect(() => reskinManjiSvg('<svg></svg>', () => '#000')).toThrow(/viewBox/);
  });
});
