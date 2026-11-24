// THE RPG DUNGEON KITS (dungeon.js, style/dungeon-kits.js): each a chamber and its halls dressed from its card alone:
// every doodad a card names is one the shelf builds; the starter's chamber holds its set piece and its floor's feature;
// the glow lays the light; the grotto no hand lit has no lamp on its walls; the same plan, the same dressing.
import { describe, it, expect } from 'vitest';
import { DUNGEON_DOODADS, dungeonDress, chamberOf, sourceless } from './dungeon.js';
import { PRINCIPLE_LAWS } from './laws.js';
import { DUNGEON_STYLES } from './style/dungeon-kits.js';
import { STAGE_KITS, planStage, buildStageGeometry } from './stage.js';
import { starter } from './entries.js';

const KITS = Object.keys(DUNGEON_STYLES);
const kinds = (D) => [D.centre?.kind, D.lay?.kind, D.ceiling?.kind, ...(D.walls?.kinds ?? []), ...(D.corners?.kinds ?? []), ...(D.hall?.kinds ?? [])].filter(Boolean);

describe('the RPG dungeon kits', () => {
  it('each a room kit whose card names only doodads the shelf builds', () => {
    for (const k of KITS) {
      expect(STAGE_KITS[k].dress).toBe(DUNGEON_STYLES[k]);
      for (const d of kinds(DUNGEON_STYLES[k])) expect(DUNGEON_DOODADS[d], `${k}: ${d}`).toBeTypeOf('function');
    }
  });

  it('a starter is a chamber and its halls: the set piece and the floor\'s feature in the chamber, its glow lit', () => {
    // (one kit a cause: a forge's work light, a grotto's growth, a drowned glow, a vault's crystals; each the same path)
    for (const k of KITS) {
      const plan = planStage({ ...starter(k), seed: 3 }), geom = buildStageGeometry(plan), D = dungeonDress(plan, geom), ch = chamberOf(plan);
      expect(plan.rooms.length, k).toBeGreaterThanOrEqual(3);
      expect(D.anchors.find((a) => a.kind === 'set-piece')).toMatchObject({ room: ch.id, form: DUNGEON_STYLES[k].centre.kind });
      expect(D.anchors.find((a) => a.kind === 'floor')).toMatchObject({ room: ch.id, form: DUNGEON_STYLES[k].lay.kind });
      expect(D.anchors.filter((a) => a.kind === 'thing').length, k).toBeGreaterThan(2);
      expect(D.after.length, k).toBeGreaterThan(0);
      expect(D.after.every((f) => f.emissive && f.group === 'stage:lamp')).toBe(true);
      expect(D.lights.length, k).toBeGreaterThan(2);
      expect(D.lights.every((l) => l.fixture === 'glow' && l.at.every(Number.isFinite))).toBe(true);
      expect(JSON.stringify(dungeonDress(plan, geom).faces)).toBe(JSON.stringify(D.faces));
    }
  });

  it('its principles are counted (laws.js), and the one it adds is measured: every light it lays has its source beside it', () => {
    for (const k of KITS) {
      expect(PRINCIPLE_LAWS[k], k).toHaveLength(DUNGEON_STYLES[k].principles.length);
      expect(PRINCIPLE_LAWS[k].flat(), k).toContain('light-has-a-source');
      const plan = planStage({ ...starter(k), seed: 3 }), D = dungeonDress(plan, buildStageGeometry(plan));
      expect(sourceless(D), k).toEqual([]);
    }
    // (a light laid from nowhere breaks it)
    expect(sourceless({ after: [], lights: [{ at: [0, 0, 1] }] })).toHaveLength(1);
  });

  it('the grotto no hand lit has no lamp on its walls; the forge has its lamps', () => {
    expect(buildStageGeometry(planStage({ ...starter('fungal-grotto'), seed: 3 })).seats.filter((s) => !s.fixture).length).toBe(0);
    expect(buildStageGeometry(planStage({ ...starter('deep-forge'), seed: 3 })).seats.length).toBeGreaterThan(0);
  });
});
