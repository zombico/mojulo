import { describe, expect, it } from 'vitest';

import { projectTwoPoint } from './pure-mandala.js';
import { buildFurnitureNet } from './furniture-net.js';
import {
  FURNITURE_NETS,
  getFurnitureFaceCard,
  listFurnitureNetTypes,
} from './furniture-cards.js';
import {
  ROOM_SCENE_ELEMENT_PRESETS,
  projectRoomHeightManjis,
  resolveRoomSceneElementPlan,
} from './room-scene-elements.js';

const ROOM_BASIS = {
  worldExtent: { width: 12, depth: 8, height: 3 },
  xRange: [0, 12],
  yRange: [0, 8],
  frontY: 8,
  backY: 0,
  verticalUnit: 84,
};

const CAMERA_POSITION = [-3, 13, 3.4];
const CAMERA = {
  kind: 'two-point',
  viewBox: { width: 1280, height: 720 },
  worldFraming: {
    cameraPosition: CAMERA_POSITION,
    lookAt: [6, 4, 0.9],
    horizontalFov: 64,
    pictureCenter: [640, 380],
  },
};

function project(world) {
  const p = projectTwoPoint(world, CAMERA, ROOM_BASIS);
  return { x: p[0], y: p[1] };
}

function elementForType(type, index) {
  const preset = ROOM_SCENE_ELEMENT_PRESETS[type] || {};
  return {
    type,
    surface: preset.surface || 'floor',
    anchor: preset.surface === 'backWall'
      ? [0.22 + (index % 4) * 0.18, 0.42]
      : [0.18 + (index % 4) * 0.2, 0.32 + Math.floor(index / 4) * 0.16],
    ...(preset.surface === 'backWall'
      ? { w: 0.13, h: 0.14 }
      : { w: 0.12, h: 0.10 }),
    ...(preset.supportPattern ? { supportPattern: preset.supportPattern } : {}),
    ...(Number.isFinite(preset.height) ? { heightWorld: preset.height } : {}),
  };
}

describe('furniture card registry', () => {
  it('keeps every net descriptor pointed at registered face cards', () => {
    for (const [type, net] of Object.entries(FURNITURE_NETS)) {
      expect(net.conceptId, `${type} conceptId`).toBeTruthy();
      expect(net.faces, `${type} faces`).toBeTruthy();
      for (const [slot, cardId] of Object.entries(net.faces)) {
        expect(getFurnitureFaceCard(cardId), `${type}.${slot} -> ${cardId}`).toBeTruthy();
      }
    }
  });

  it('renders every registered preset-backed net into primitive marks', () => {
    const types = listFurnitureNetTypes().filter((type) => ROOM_SCENE_ELEMENT_PRESETS[type]);
    const elements = types.map(elementForType);
    const plan = resolveRoomSceneElementPlan({ elements, roomBasis: ROOM_BASIS }, ROOM_BASIS);
    const manjis = projectRoomHeightManjis(plan, CAMERA, ROOM_BASIS);

    expect(manjis).toHaveLength(types.length);
    for (const manji of manjis) {
      const marks = buildFurnitureNet({
        type: manji.element.type,
        manji,
        project,
        cameraPosition: CAMERA_POSITION,
        style: 'shaded',
      });
      expect(marks.length, `${manji.element.type} should render marks`).toBeGreaterThan(0);
      expect(
        marks.every((mark) => mark.kind === 'polygon' || mark.kind === 'line'),
        `${manji.element.type} should lower to primitive marks`,
      ).toBe(true);
    }
  });
});
