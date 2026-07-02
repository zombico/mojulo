import { describe, expect, it } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import {
  ROOM_FURNITURE_ASSETS,
  getRoomFurnitureAsset,
  buildComputerTableWorkbenchManifest,
  buildDiningChairWorkbenchManifest,
  buildLTableWorkbenchManifest,
  buildModernCouchWorkbenchManifest,
  buildStandingDeskWorkbenchManifest,
  buildStudyTableWorkbenchManifest,
  buildTabletopBowlWorkbenchManifest,
  buildTabletopCupWorkbenchManifest,
  buildTabletopCutleryWorkbenchManifest,
  buildTabletopDeskSetupWorkbenchManifest,
  buildTabletopDesktopTowerWorkbenchManifest,
  buildTabletopEyeglassesWorkbenchManifest,
  buildTabletopKeyboardWorkbenchManifest,
  buildTabletopLaptopWorkbenchManifest,
  buildTabletopMailStackWorkbenchManifest,
  buildTabletopMouseWorkbenchManifest,
  buildTabletopNapkinWorkbenchManifest,
  buildTabletopNotebookWorkbenchManifest,
  buildTabletopPaperStackWorkbenchManifest,
  buildTabletopPencilHolderWorkbenchManifest,
  buildTabletopPlaceSettingWorkbenchManifest,
  buildTabletopPlateWorkbenchManifest,
  buildTabletopVaseWorkbenchManifest,
  buildTabletopWaterBottleWorkbenchManifest,
  buildTabletopWineGlassWorkbenchManifest,
} from './room-assets.js';

// A floor element as the room planner hands it to an asset's buildManifest: a base rectangle
// (w × d) seated on z=0 plus a resolved heightWorld.
const floorElement = (w, d, h) => ({
  heightManji: {
    basePlane: { corners: [[-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]] },
    heightWorld: h,
  },
});

describe('room-assets registry', () => {
  it('resolves the chair asset by id and aliases', () => {
    expect(getRoomFurnitureAsset('chair')?.id).toBe('chair');
    expect(getRoomFurnitureAsset('dining-chair')?.id).toBe('chair');
    expect(getRoomFurnitureAsset('side-chair')?.id).toBe('chair');
  });

  it('still resolves the couch asset (no regression)', () => {
    expect(getRoomFurnitureAsset('modern-couch')?.id).toBe('modern-couch');
    expect(getRoomFurnitureAsset('modern-sofa')?.id).toBe('modern-couch');
  });

  it('resolves workbench-authored table assets by id and aliases', () => {
    expect(getRoomFurnitureAsset('study-desk')?.id).toBe('study-table');
    expect(getRoomFurnitureAsset('adjustable-desk')?.id).toBe('standing-desk');
    expect(getRoomFurnitureAsset('computer-desk')?.id).toBe('computer-table');
    expect(getRoomFurnitureAsset('l-shaped-desk')?.id).toBe('l-table');

    for (const id of ['study-table', 'standing-desk', 'computer-table', 'l-table']) {
      const asset = getRoomFurnitureAsset(id);
      expect(asset.class).toBe('room-furniture');
      expect(asset.tags.roles).toContain('table');
      expect(asset.tags.planeRole).toContain('table-plane');
    }
  });

  it('resolves tabletop assets by id and aliases with table-plane placement tags', () => {
    expect(getRoomFurnitureAsset('dinner-plate')?.id).toBe('plate');
    expect(getRoomFurnitureAsset('mug')?.id).toBe('cup');
    expect(getRoomFurnitureAsset('silverware')?.id).toBe('cutlery');
    expect(getRoomFurnitureAsset('table-setting')?.id).toBe('place-setting');
    expect(getRoomFurnitureAsset('journal')?.id).toBe('notebook');
    expect(getRoomFurnitureAsset('notebook-computer')?.id).toBe('laptop');
    expect(getRoomFurnitureAsset('computer-keyboard')?.id).toBe('keyboard');
    expect(getRoomFurnitureAsset('pencil-cup')?.id).toBe('pencil-holder');
    expect(getRoomFurnitureAsset('computer-mouse')?.id).toBe('mouse');
    expect(getRoomFurnitureAsset('desktop-setup')?.id).toBe('desk-setup');
    expect(getRoomFurnitureAsset('pc-tower')?.id).toBe('desktop-tower');
    expect(getRoomFurnitureAsset('glasses')?.id).toBe('eyeglasses');
    expect(getRoomFurnitureAsset('dark-glasses')?.id).toBe('sunglasses');
    expect(getRoomFurnitureAsset('reusable-bottle')?.id).toBe('water-bottle');
    expect(getRoomFurnitureAsset('wineglass')?.id).toBe('wine-glass');
    expect(getRoomFurnitureAsset('stack-of-paper')?.id).toBe('paper-stack');
    expect(getRoomFurnitureAsset('stack-of-mail')?.id).toBe('mail-stack');

    for (const id of ['plate', 'bowl', 'cup', 'vase', 'napkin', 'cutlery', 'place-setting', 'notebook', 'laptop', 'keyboard', 'pencil-holder', 'mouse', 'desk-setup', 'desktop-tower', 'eyeglasses', 'sunglasses', 'water-bottle', 'wine-glass', 'paper-stack', 'mail-stack']) {
      const asset = getRoomFurnitureAsset(id);
      expect(asset.class).toBe('room-tabletop');
      expect(asset.tags.planeRole).toContain('table-plane');
      expect(asset.tags.placement).toContain('surface-top');
    }
  });

  it('every registered asset builds a manifest that validates and is seated on the grid', () => {
    for (const asset of Object.values(ROOM_FURNITURE_ASSETS)) {
      const manifest = asset.buildManifest(floorElement(0.9, 0.9, 0.8));
      const { stats } = planWorkbench(manifest);
      expect(stats.faces).toBeGreaterThan(0);
      expect(stats.warnings, `${asset.id} should sit on the grid`).toBeUndefined();
    }
  });
});

describe('dining chair manifest', () => {
  it('bakes legs + seat + back parts, seated, at the requested total height', () => {
    const manifest = buildDiningChairWorkbenchManifest({ w: 0.46, d: 0.5, h: 0.92 });
    const { stats } = planWorkbench(manifest);
    expect(stats.lathes).toBe(4);        // four legs
    expect(stats.extrudes).toBe(5);      // seat + 2 posts + top rail + mid slat
    expect(stats.warnings).toBeUndefined();
    expect(stats.size.h).toBeCloseTo(0.92, 1);
  });

  it('rectangularChairManifest reads w/d/h from the planner element frame', () => {
    const manifest = getRoomFurnitureAsset('chair').buildManifest(floorElement(0.46, 0.5, 0.92));
    const { stats } = planWorkbench(manifest);
    expect(stats.size.w).toBeCloseTo(0.46, 1);
    expect(stats.size.h).toBeCloseTo(0.92, 1);
    expect(stats.warnings).toBeUndefined();
  });
});

describe('table family manifests', () => {
  const cases = [
    ['study-table', () => buildStudyTableWorkbenchManifest()],
    ['standing-desk', () => buildStandingDeskWorkbenchManifest()],
    ['computer-table', () => buildComputerTableWorkbenchManifest()],
    ['l-table', () => buildLTableWorkbenchManifest()],
  ];

  it.each(cases)('%s bakes as seated workbench furniture', (_name, build) => {
    const { stats } = planWorkbench(build());
    expect(stats.faces).toBeGreaterThan(0);
    expect(stats.warnings).toBeUndefined();
    expect(stats.extrudes).toBeGreaterThan(0);
  });

  it('standing desk is taller than a standard study table', () => {
    const study = planWorkbench(buildStudyTableWorkbenchManifest()).stats;
    const standing = planWorkbench(buildStandingDeskWorkbenchManifest()).stats;
    expect(standing.size.h).toBeGreaterThan(study.size.h);
  });
});

describe('tabletop prop manifests', () => {
  const cases = [
    ['plate', () => buildTabletopPlateWorkbenchManifest()],
    ['bowl', () => buildTabletopBowlWorkbenchManifest()],
    ['cup', () => buildTabletopCupWorkbenchManifest()],
    ['vase', () => buildTabletopVaseWorkbenchManifest()],
    ['napkin', () => buildTabletopNapkinWorkbenchManifest()],
    ['cutlery', () => buildTabletopCutleryWorkbenchManifest()],
    ['place-setting', () => buildTabletopPlaceSettingWorkbenchManifest()],
    ['notebook', () => buildTabletopNotebookWorkbenchManifest()],
    ['laptop', () => buildTabletopLaptopWorkbenchManifest()],
    ['keyboard', () => buildTabletopKeyboardWorkbenchManifest()],
    ['pencil-holder', () => buildTabletopPencilHolderWorkbenchManifest()],
    ['mouse', () => buildTabletopMouseWorkbenchManifest()],
    ['desk-setup', () => buildTabletopDeskSetupWorkbenchManifest()],
    ['desktop-tower', () => buildTabletopDesktopTowerWorkbenchManifest()],
    ['eyeglasses', () => buildTabletopEyeglassesWorkbenchManifest()],
    ['sunglasses', () => buildTabletopEyeglassesWorkbenchManifest({ sunglasses: true })],
    ['water-bottle', () => buildTabletopWaterBottleWorkbenchManifest()],
    ['wine-glass', () => buildTabletopWineGlassWorkbenchManifest()],
    ['paper-stack', () => buildTabletopPaperStackWorkbenchManifest()],
    ['mail-stack', () => buildTabletopMailStackWorkbenchManifest()],
  ];

  it.each(cases)('%s bakes as seated workbench geometry', (_name, build) => {
    const { stats } = planWorkbench(build());
    expect(stats.faces).toBeGreaterThan(0);
    expect(stats.warnings).toBeUndefined();
    expect(stats.monomers).toBeGreaterThan(0);
  });

  it('composes a place setting from dishes, linen, cup, and cutlery', () => {
    const { stats } = planWorkbench(buildTabletopPlaceSettingWorkbenchManifest());
    expect(stats.lathes).toBeGreaterThanOrEqual(5);
    expect(stats.extrudes).toBeGreaterThanOrEqual(6);
    expect(stats.sweeps).toBeGreaterThanOrEqual(4);
    expect(stats.warnings).toBeUndefined();
  });

  it('composes a desk setup from computer gear, paper, and a pencil holder', () => {
    const { stats } = planWorkbench(buildTabletopDeskSetupWorkbenchManifest());
    expect(stats.lathes).toBeGreaterThanOrEqual(4);
    expect(stats.extrudes).toBeGreaterThanOrEqual(35);
    expect(stats.sweeps).toBeGreaterThanOrEqual(2);
    expect(stats.warnings).toBeUndefined();
  });
});

describe('modern couch manifest (regression after buildLeg extraction)', () => {
  it('still bakes 5 lathe legs and validates with no warnings', () => {
    const { stats } = planWorkbench(buildModernCouchWorkbenchManifest({ w: 3.6, d: 1.32, h: 0.82 }));
    expect(stats.lathes).toBe(5);
    expect(stats.faces).toBeGreaterThan(0);
    expect(stats.warnings).toBeUndefined();
  });
});
