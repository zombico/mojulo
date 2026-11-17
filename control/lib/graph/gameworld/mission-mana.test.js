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
    expect(Object.keys(S.screens)).toEqual(['briefing', 'pause', 'how', 'controls', 'map', 'debrief']);
    expect(S.hud.children.map((c) => c.use)).toEqual(['peril-edge', 'radar-scope', 'objective-order', 'health-strip', 'weapon-readout', 'subtitles', 'damage-direction']);
  });
  it('draws its HUD as a shooter does, not as a dashboard: no labels, a figure for the rounds, one order, the edge for danger', () => {
    const C = missionMana(UI), S = { ...C.state, ms: { ...C.state.ms, hp: 20, ammo: 4, magazine: 30, reserve: 60, weapon: 'Carbine', mode: 'Auto', peril: 0.7 } };
    const rt = manaUi.runtime(C.spec, { read: (p) => manaUi.readPath(S, p) }), v = rt.view();
    // (no "HP" and no "Ammo" said: the bar's length and the figure are their own label)
    expect(v).not.toMatch(/>HP<|>Ammo</);
    expect(v).toMatch(/class="mana-magazine" data-gun="carbine" data-low="yes"/);
    expect(v).toContain('>Low ammo<');
    expect(v).toContain('data-variant="scrim"');
    expect(v).toContain('--mana-peril:0.7');
    expect(v).toContain(`>1/${UI.tasks.length}<`);
    // (the checklist is the map's, not the HUD's)
    expect(v).not.toContain('☐');
    expect(JSON.stringify(C.spec.screens.map)).toContain('objective.steps');
    expect(C.hud.rest).toBeGreaterThan(0);
  });
  it('carries the radar in its HUD and the map on a screen, a key and the pause menu, each task its place where it has one', () => {
    const S = missionManaSpec(), C = missionMana(UI), radar = S.hud.children.find((c) => c.use === 'radar-scope');
    expect(radar.props).toMatchObject({ markers: { bind: 'ms.radar.marks' }, north: { bind: 'ms.radar.north' } });
    expect(JSON.stringify(S.screens.map)).toContain('"minimap"');
    expect(C.state.ms.menu.map((m) => m.then.open).filter(Boolean)).toContain('map');
    expect(C.radar.range).toBeGreaterThan(0);
    expect(C.mapKey).toBe('KeyM');
    expect(C.state.ms.radar.marks).toEqual([]);
    // (a place to go has its place; a room to clear has none: its foes are the marks)
    for (const t of UI.tasks) { if (t.kind === 'take' || t.kind === 'reach') expect(t.at).toHaveLength(2); if (t.kind === 'clear') expect(t.at).toBeUndefined(); }
    const src = missionChannelSource(UI);
    for (const fn of ['__msRadar', '__msPlanBox', '__msPlanPoint', '__msPlanSvg', '__msThings']) expect(src).toContain(`const ${fn} = `);
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
  it('speaks each order: a task carries its line, and the HUD has a place for who says it', () => {
    const C = missionMana(UI);
    expect(C.tasks.every((t) => typeof t.say === 'string' && t.say.length > 0)).toBe(true);
    expect(JSON.stringify(C.spec.hud)).toContain('ms.radio.line');
    expect(C.state.ms.radio).toEqual({ on: false, who: 'Command', line: '' });
    expect(C.hud.radio).toBeGreaterThan(0);
  });
  it('is every shooter\'s HUD: with no mission in it (`plain`) the same parts and look, and no order, briefing or debrief', () => {
    const plain = { title: 'Bout', theme: MISSION_LOOK, tasks: [], plain: true }, C = missionMana(plain), full = missionMana(UI);
    // (the same spec: one HUD, drawn by the same parts; the order stands only where there is one)
    expect(C.spec).toEqual(full.spec);
    expect(C.plain).toBe(true); expect(full.plain).toBeUndefined();
    expect(C.state.ms.order.on).toBe(false); expect(full.state.ms.order.on).toBe(true);
    expect(C.state.ms.menu.map((m) => m.label)).not.toContain('The briefing');
    expect(C.state.ms.title).toBe('Bout');
    // (its sheet leaves the level's own counters, lines and clock, where a mission's puts them away)
    expect(missionManaCss(C.theme, { plain: true })).not.toContain('.moj-w-counter');
    expect(missionManaCss(full.theme)).toContain('.moj-w-counter');
    // (one radar: the page's own round one is put away wherever this HUD stands, mission or none)
    for (const css of [missionManaCss(C.theme, { plain: true }), missionManaCss(full.theme)]) expect(css).toContain('.moj-c-radar{display:none');
    // (and it takes a game's own look as a mission does: another theme card, another sheet, the same parts)
    const other = Object.keys(THEME_CARDS).find((k) => k !== MISSION_LOOK);
    expect(missionManaCss(missionMana({ ...plain, theme: other }).theme, { plain: true })).not.toBe(missionManaCss(C.theme, { plain: true }));
    expect(() => new Function(missionChannelSource(plain))).not.toThrow();
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
    // (its neighbours are the damage ring and the radar, themselves import-free: damage-ring.test.js, radar.test.js)
    expect(from.filter((f) => f.startsWith('./'))).toEqual(['./damage-ring.js', './radar.js']);
    expect(from.filter((f) => /gameworld|mission\//.test(f))).toEqual([]);
  });
});
