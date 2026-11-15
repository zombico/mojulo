// THE MISSION ON MANA-UI (mission-mana.js): the page's side of a mission. Its spec is one mana-ui reads; its config is
// built from the manifest's `mission` alone; its sheet carries no screen-wide overlay; and the module stays the page's:
// it imports nothing of the gameworld (the scene's emitter reads it through its mission channel).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { missionManaSpec, missionMana, missionManaCss, missionChannelSource, MISSION_LOOK } from './mission-mana.js';
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
    expect(S.hud.children.map((c) => c.use)).toEqual(['region', 'objective-tracker', 'region', 'ammo-counter']);
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
    expect(from.filter((f) => f.startsWith('./'))).toEqual([]);
    expect(from.filter((f) => /gameworld|mission\//.test(f))).toEqual([]);
  });
});
