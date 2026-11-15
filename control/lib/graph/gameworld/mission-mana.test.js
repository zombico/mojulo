// THE MISSION ON MANA-UI (mission-mana.js): the page's side of a mission. Its spec is one mana-ui reads; its config is
// built from the manifest's `mission` alone; its sheet carries no screen-wide overlay; and the module stays the page's:
// it imports nothing of the gameworld (the scene's emitter reads it through its mission channel).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { missionManaSpec, missionMana, missionManaCss, missionChannelSource, MISSION_LOOK, hitBearing, RING } from './mission-mana.js';
import { missionLevel } from './mission-level.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { manaUi } from '../../mana-ui/index.js';
import { THEME_CARDS } from '../playscape/ui/theme-cards/loader.js';
import { missionChannelScript } from '../scene/channels/mission.js';

const UI = missionLevel({ id: 'ui-test', name: 'UI test', feel: Object.keys(TEMPLATE_LOADOUTS)[0] }, { quiet: true }).manifest.mission;

describe('the mission on mana-ui', () => {
  it('has a spec mana-ui reads: a briefing, a pause, how to play, the controls, a debrief, and a HUD', () => {
    const S = missionManaSpec();
    expect(() => manaUi.readSpec(S)).not.toThrow();
    expect(Object.keys(S.screens)).toEqual(['briefing', 'pause', 'how', 'controls', 'debrief']);
    expect(S.hud.children.map((c) => c.use)).toEqual(['region', 'objective-tracker', 'region', 'ammo-counter', 'damage-direction']);
  });
  it('builds its page from the manifest\'s `mission`: the tasks tracked, the briefing in tabs, the look named', () => {
    const C = missionMana(UI);
    expect(C.tasks.map((t) => t.id)).toEqual(UI.tasks.map((t) => t.id));
    expect(C.state.ms.objective.steps.map((s) => s.text)).toEqual(UI.tasks.map((t) => t.text));
    expect(C.state.ms.brief.map((t) => t.label).slice(0, 3)).toEqual(['The mission', 'The kit', 'What it teaches']);
    expect(new Set(C.state.ms.brief.map((t) => t.label)).size).toBe(C.state.ms.brief.length);
    expect(UI.theme).toBe(MISSION_LOOK);
    expect(THEME_CARDS[MISSION_LOOK]).toBeTruthy();
    expect(C.theme.overlay).toBe('none');
    // (a look with an overlay across the screen is read without it: the HUD lies over the sights)
    expect(missionMana({ ...UI, theme: 'mecha' }).theme.overlay).toBe('none');
    expect(missionManaCss(C.theme)).toContain('.mana-root');
  });
  it('marks the damage ring by where a hit came from, turning with the body', () => {
    // (a body at the origin facing +x: ahead the top of the ring, its right a quarter round, behind the bottom, its left)
    const at = [0, 0, 0];
    expect([[10, 0, 0], [0, -10, 0], [-10, 0, 0], [0, 10, 0]].map((from) => hitBearing(at, 0, from))).toEqual([0, 90, 180, 270]);
    // turned to face +y, what was on its left is ahead and what was ahead is on its right
    expect([hitBearing(at, Math.PI / 2, [0, 10, 0]), hitBearing(at, Math.PI / 2, [10, 0, 0])]).toEqual([0, 90]);
    // it is where the hit came from, not how far: the same bearing near and far, whole degrees, 0 to 359
    expect(hitBearing(at, 0, [1, -1, 0])).toBe(hitBearing(at, 0, [50, -50, 0]));
    expect(hitBearing([3, 4, 0], 7 * Math.PI, [9, 4, 0])).toBe(180);
    // the ring is drawn only while a mark stands, and the page is told how long one does
    const S = missionManaSpec(), ring = S.hud.children.find((c) => c.use === 'damage-direction'), C = missionMana(UI);
    expect(ring.when).toEqual({ bind: 'ms.ring.on' });
    expect(C.state.ms.ring).toEqual({ on: false, hits: [] });
    expect(C.ring).toEqual({ life: RING.life, most: RING.most });
    expect(C.state.ms.how.map((t) => t.label)).toContain('Under fire');
  });
  it('is one block on the page, the same from the same mission, and publishes its probe', () => {
    const a = missionChannelScript(UI);
    expect(a).toBe(missionChannelScript(UI));
    expect(a).toContain('window.__mojMission');
    expect(() => new Function(a.replace(/^\s*\/\/.*$/m, ''))).not.toThrow();
    expect(missionChannelSource(UI).length).toBeGreaterThan(1000);
  });
  it('imports nothing of the gameworld but the page\'s own pieces', () => {
    const src = readFileSync(fileURLToPath(new URL('./mission-mana.js', import.meta.url)), 'utf8');
    const from = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    // (its one neighbour is the damage ring, itself import-free: damage-ring.test.js)
    expect(from.filter((f) => f.startsWith('./'))).toEqual(['./damage-ring.js']);
    expect(from.filter((f) => /gameworld|mission\//.test(f))).toEqual([]);
  });
});
