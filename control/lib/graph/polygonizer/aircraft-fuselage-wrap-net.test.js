import { describe, expect, it } from 'vitest';

import {
  compileAircraftFuselageToSurfaceBands,
  computeAircraftFuselagePlateLayout,
  profileRadiusAt,
  resolveAircraftFuselageWrapNet,
  walkAircraftFuselageWrapNet,
} from './aircraft-fuselage-wrap-net.js';

const BASIC = {
  role: 'test-fuselage',
  stations: 4,
  bands: [
    { id: 'top', sectors: 1 },
    { id: 'starboard', sectors: 2 },
  ],
  rhythm: ['skin', 'window'],
  motifs: { skin: 'bare-aluminum', window: 'passenger-window' },
};

describe('aircraft fuselage wrap-net planner', () => {
  it('walks every station for every angular sector', () => {
    const net = resolveAircraftFuselageWrapNet(BASIC);
    const cells = walkAircraftFuselageWrapNet(net);

    expect(net.totalSectors).toBe(3);
    expect(cells).toHaveLength(12);
    expect(cells[0]).toMatchObject({
      station: 0,
      stationT: 0.125,
      band: 'top',
      sectorOnBand: 0,
      sector: 0,
      motif: 'skin',
      motifRef: 'bare-aluminum',
      seamPrev: 'starboard',
      seamNext: 'starboard',
    });
    expect(cells[4]).toMatchObject({
      station: 1,
      band: 'starboard',
      sectorOnBand: 0,
      motif: 'window',
      motifRef: 'passenger-window',
      angleDegBand: [120, 240],
    });
  });

  it('keeps station rhythm continuous across angular bands', () => {
    const cells = walkAircraftFuselageWrapNet({
      ...BASIC,
      stations: 3,
      bands: [
        { id: 'top', sectors: 1 },
        { id: 'starboard', sectors: 1 },
        { id: 'belly', sectors: 1 },
      ],
      rhythm: ['a', 'b', 'c'],
    });

    expect(cells.map((cell) => `${cell.station}:${cell.band}:${cell.motif}`)).toEqual([
      '0:top:a',
      '0:starboard:a',
      '0:belly:a',
      '1:top:b',
      '1:starboard:b',
      '1:belly:b',
      '2:top:c',
      '2:starboard:c',
      '2:belly:c',
    ]);
  });

  it('applies longitudinal zones, markings, and void exclusions with provenance', () => {
    const net = resolveAircraftFuselageWrapNet({
      ...BASIC,
      stations: 6,
      zones: [
        { id: 'nose', stations: [0, 1], motif: 'cockpit-skin' },
        { id: 'tail', stations: [5, 5], motif: 'tail-cone' },
      ],
      markings: [
        { id: 'forward-door', band: 'starboard', sector: 0, stations: [2, 2], motif: 'door' },
      ],
      voids: [
        { id: 'wing-root-keepout', band: 'starboard', sector: 1, stations: [3, 4] },
      ],
    });
    const visible = walkAircraftFuselageWrapNet(net);
    const all = walkAircraftFuselageWrapNet(net, { includeExcluded: true });

    expect(all).toHaveLength(18);
    expect(visible).toHaveLength(16);
    expect(all.find((cell) => cell.station === 0 && cell.band === 'top').motif).toBe('cockpit-skin');
    expect(all.find((cell) => cell.station === 5 && cell.band === 'starboard').motif).toBe('tail-cone');
    expect(all.find((cell) => cell.station === 2 && cell.band === 'starboard' && cell.sectorOnBand === 0).motif).toBe('door');
    const voidCell = all.find((cell) => cell.station === 3 && cell.band === 'starboard' && cell.sectorOnBand === 1);
    expect(voidCell.excluded).toBe(true);
    expect(voidCell.void).toBe('wing-root-keepout');
    expect(voidCell.provenance).toMatchObject({
      role: 'test-fuselage',
      station: 3,
      band: 'starboard',
      sectorOnBand: 1,
    });
  });

  it('groups planned cells by angular band for downstream projection', () => {
    const compiled = compileAircraftFuselageToSurfaceBands(BASIC);

    expect(compiled.bands.map((band) => [band.band, band.cols, band.rows, band.cells.length])).toEqual([
      ['top', 4, 1, 4],
      ['starboard', 4, 2, 8],
    ]);
    expect(compiled.diagnostics.cellsPlanned).toBe(12);
    expect(compiled.diagnostics.bandSectors).toEqual({ top: 1, starboard: 2 });
  });

  it('computes an unwrap plate with one horizontal strip per angular band', () => {
    const layout = computeAircraftFuselagePlateLayout(BASIC, { cellW: 10, cellH: 8, gap: 1, bandGap: 5, labelW: 30 });

    expect(layout.bands).toHaveLength(2);
    expect(layout.bands[0]).toMatchObject({ band: 'top', w: 43, h: 8, stations: 4, sectors: 1 });
    expect(layout.bands[1]).toMatchObject({ band: 'starboard', w: 43, h: 17, stations: 4, sectors: 2 });
    expect(layout.bands[1].y).toBe(layout.bands[0].y + layout.bands[0].h + 5);
    expect(layout.bounds.width).toBe(73);
    expect(layout.bounds.height).toBe(30);
  });

  it('interpolates tapered fuselage radius from profile control points', () => {
    const profile = [
      { t: 0, radius: 0 },
      { t: 0.5, radius: 1 },
      { t: 1, radius: 0.25 },
    ];

    expect(profileRadiusAt(profile, 0.25)).toBeCloseTo(0.5);
    expect(profileRadiusAt(profile, 0.75)).toBeCloseTo(0.625);
  });
});
