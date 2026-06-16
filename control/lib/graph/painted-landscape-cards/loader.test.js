import { describe, it, expect } from 'vitest';
import { HEARTBEATS, SPLATCHES, CAMERAS } from './loader.js';

describe('painted-landscape-cards/loader', () => {
  it('loads at least the seeded heartbeats from card files', () => {
    for (const id of ['gentle-pulse', 'breathing', 'chop', 'ridge-step']) {
      expect(HEARTBEATS[id], `heartbeat ${id} loaded`).toBeTruthy();
    }
  });

  it('loads at least the seeded splatches from card files', () => {
    for (const id of ['meadow-trio', 'dusk-trio', 'glacier-trio', 'firelight-trio', 'bone-trio', 'verdure-trio']) {
      expect(SPLATCHES[id], `splatch ${id} loaded`).toBeTruthy();
    }
  });

  it('frozen heartbeat entries carry the expected fields', () => {
    const gp = HEARTBEATS['gentle-pulse'];
    expect(gp.intent).toBeTruthy();
    expect(Array.isArray(gp.aliases)).toBe(true);
    expect(gp.samples).toEqual({ u: 16, v: 24 });
    expect(gp.defaultLight).toEqual({ x: 0.30, y: 0.55, z: 0.78 });
    expect(gp.waves).toHaveLength(2);
    expect(gp.waves[0].amp).toEqual([1.0, 1.6]);
    expect(gp.waves[0].cu).toEqual([0.6, 1.0]);
    expect(gp.waves[0].cv).toEqual([0.5, 0.8]);
    // Frozen at every level
    expect(() => { gp.waves.push({}); }).toThrow();
    expect(() => { gp.waves[0].amp[0] = 999; }).toThrow();
  });

  it('frozen splatch entries carry the expected fields', () => {
    const meadow = SPLATCHES['meadow-trio'];
    expect(meadow.intent).toBeTruthy();
    expect(meadow.seeds).toEqual(['#3d4824', '#9b863e', '#e8e0c2']);
    expect(Array.isArray(meadow.aliases)).toBe(true);
    // Frozen at every level
    expect(() => { meadow.seeds[0] = '#000000'; }).toThrow();
  });

  it('the loaded registries are themselves frozen', () => {
    expect(() => { HEARTBEATS['new'] = {}; }).toThrow();
    expect(() => { SPLATCHES['new'] = {}; }).toThrow();
    expect(() => { CAMERAS['new'] = {}; }).toThrow();
  });

  it('loads at least the seeded cameras with frozen payloads', () => {
    for (const id of ['medium-survey', 'wide-cinematic', 'close-up-detail', 'low-angle-hero', 'top-down-survey']) {
      expect(CAMERAS[id], `camera ${id} loaded`).toBeTruthy();
    }
    const med = CAMERAS['medium-survey'];
    expect(med.camera.vanishingPoints.left).toEqual([-220, 245]);
    expect(med.camera.vanishingPoints.right).toEqual([1180, 245]);
    expect(med.roomBasis.xRange).toEqual([-18, 18]);
    expect(() => { med.camera.verticalAxis[0] = 99; }).toThrow();
    expect(() => { med.roomBasis.xRange[0] = 99; }).toThrow();
  });
});
