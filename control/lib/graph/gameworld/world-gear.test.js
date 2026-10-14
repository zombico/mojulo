import { describe, it, expect } from 'vitest';
import { gearStyle, mirrorEntry, contrastEntry, augmentTiers, populateGear, gearOrders, gearFaces, GEAR_MOTIFS, MADE_ROLES, CONTRAST_OF } from './world-gear.js';
import { HALDEN_REACH, MEADOWMARK_HERO, resolveWorld, readGameworld, characterBibleHtml } from './index.js';
import { runSteps } from './runner.js';
import { readMade } from './made.js';
import { validateStyleCard, SEEDED_STYLES } from '../equipment/styles.js';
import { validateGear } from '../polygonizer/hero-gear.js';
import { MOTIF_IDS, TEAM_COLOURS } from './tech-direction.js';

const world = (populate) => ({ ...HALDEN_REACH, characters: MEADOWMARK_HERO.characters, equipment: { ...(MEADOWMARK_HERO.equipment ?? {}), ...(populate !== undefined ? { populate } : {}) } });
const G = resolveWorld(world(true)).world;

describe('world gear: a civilization\'s gear speaks its technology\'s language', () => {
  it('its motif picks the card, its setting the metals, its element the stone, its team colour the grip and the board', () => {
    expect(Object.keys(GEAR_MOTIFS).sort()).toEqual([...MOTIF_IDS].sort());
    for (const c of Object.values(GEAR_MOTIFS)) expect(SEEDED_STYLES[c]).toBeTruthy();
    for (const [a, b] of Object.entries(CONTRAST_OF)) expect(CONTRAST_OF[b]).toBe(a);
    const S = gearStyle(G, 'survey-corps');
    expect(validateStyleCard(S.card)).toEqual([]);
    expect(S.card.roles.wrap).toEqual(['matte', TEAM_COLOURS[0]]);
    expect(S.card.language.shield.board).toEqual(['matte', TEAM_COLOURS[0]]);
    expect(S.card.roles.blade).toEqual(MADE_ROLES['steel-and-rubber'].blade);
    expect(S.card.gem.gem).toBe('amethyst');
    expect(S.from).toMatchObject({ base: expect.stringMatching(/^anime-hero/), roles: 'its setting (steel-and-rubber)', gem: 'its element (lightning)' });
    // every motif and every setting makes a card the kernel takes
    for (const motif of MOTIF_IDS) expect(validateStyleCard(gearStyle(G, 'survey-corps', { motif }).card), motif).toEqual([]);
    for (const made of Object.keys(MADE_ROLES)) expect(validateStyleCard({ ...S.card, roles: { ...S.card.roles, ...MADE_ROLES[made] } }), made).toEqual([]);
  });

  it('a mirror keeps the class, slot and tiers in the rival\'s language; a contrast turns the motif; an augment grows tiers within bounds', () => {
    const e = { id: 'hero-sword', class: 'sword', slot: 'right', build: { item: 'sword', style: 'elven' }, tiers: { mid: { dials: { ornament: 2 } } } };
    const m = mirrorEntry(e, G, 'dome-growers');
    expect(m).toMatchObject({ source: 'mirror', of: 'hero-sword', class: 'sword', slot: 'right', tiers: e.tiers, civilization: 'dome-growers' });
    expect(m.build.style.roles.wrap[1]).toBe(TEAM_COLOURS[1]);
    const c = contrastEntry({ ...e, build: { item: 'sword', style: gearStyle(G, 'survey-corps').card } }, G, 'survey-corps');
    expect(c.build.style.id).toBe('survey-corps-spiked');
    expect(c.why).toMatch(/turned spiked/);
    const t = augmentTiers({ item: 'shield', style: 'historical' }, 'left');
    expect(t.mid.dials.ornament).toBe(1);
    expect(t.late.dials.ornament).toBe(2);
    expect(augmentTiers({ item: 'shield', style: 'elven' }, 'left').late.dials.ornament).toBe(3);
    expect(augmentTiers({ item: 'shield', style: 'elven' }, 'left')).toEqual(augmentTiers({ item: 'shield', style: 'elven' }, 'left'));
  });

  it('the starter list is read from the world: the hero\'s gear, the civilizations\', mirrors, contrasts; what no class builds is a task', () => {
    const P = populateGear(G), by = (s) => P.entries.filter((e) => e.source === s);
    expect(by('hero').length).toBeGreaterThan(0);
    expect(by('civilization').map((e) => e.id)).toEqual(['survey-corps-shield']);
    expect(by('civilization')[0]).toMatchObject({ class: 'shield', slot: 'left', augmented: true });
    expect(by('mirror')).toHaveLength(by('hero').length * 2);
    expect(by('contrast').map((e) => e.of)).toEqual(['survey-corps-shield']);
    for (const e of P.entries) { expect(e.errors, e.id).toBeUndefined(); expect(validateGear({ [e.slot]: e.build })).toEqual([]); }
    expect(P.tasks.map((t) => `${t.civilization}/${t.id}`)).toEqual(['survey-corps/carbine', 'dome-growers/lance']);
    // the transforms are the world's to turn off
    const off = populateGear(resolveWorld(world({ mirrors: false, contrasts: false })).world);
    expect(off.entries.some((e) => e.source === 'mirror' || e.source === 'contrast')).toBe(false);
    expect(() => readGameworld(world({ shadows: true }))).toThrow(/populate is true, or/);
  });

  it('absent, nothing runs: no stock in the bible, no steps in the run', () => {
    const G0 = resolveWorld(world()).world;
    expect(populateGear(G0)).toBeNull();
    expect(gearOrders(G0, { ready: true })).toEqual({ waiting: [], mints: [], planned: [] });
    expect(characterBibleHtml(world())).not.toContain('Starter gear');
    expect(runSteps(world(), { ref: 'gw' }).some((s) => s.key.startsWith('stock-'))).toBe(false);
  }, 120000);

  it('wired in: the bible shows the starter gear, the run plans its mints on the equipment step', () => {
    const html = characterBibleHtml(world(true));
    expect(html).toContain('Starter gear');
    expect(html).toContain('mirror-survey-corps-sword');
    expect(html).toContain('survey-corps/carbine');
    const steps = runSteps(world(true), { ref: 'gw' }).filter((s) => s.key.startsWith('stock-'));
    expect(steps.length).toBe(populateGear(G).entries.length);
    expect(steps[0].order).toMatchObject({ kind: 'equipment' });
    // the run record takes every step the run makes (a stock- key once threw after its sketches were minted)
    expect(() => readMade(Object.fromEntries(steps.map((s) => [s.key, { ref: s.ref, order: '0123abcd', stored: '0123abcd' }])))).not.toThrow();
  }, 120000);

  it('the gear is drawn from its build, shaded, each face its metal\'s colour', () => {
    const f = gearFaces({ item: 'dagger', style: gearStyle(G, 'survey-corps').card });
    expect(f.length).toBeGreaterThan(100);
    expect(f.every((x) => /^#[0-9a-f]{6}$/.test(x.base) && x.cornerNormals)).toBe(true);
  }, 60000);
});
