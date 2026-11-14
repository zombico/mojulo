/**
 * brawl street — a street's screen: mana-ui over the street being fought down (brawl-crowd.js streetOf), in the
 * brawler's look. What the game shows, not what the practice yard measures: the player's health, the street's held
 * screens as pips, the crowd left on this one (or the boss's bar while it stands), the moments (GO, the boss's name),
 * and the two ends (the street cleared, the player down), each with a way to fight it again.
 *
 *   streetSpec()        the spec: the HUD and its screens (`won`, `lost`, and `moves`, the brawler's move list)
 *   streetScreenOf()    → { spec, css, theme } for the street's page
 *   readStreet(street, belt, where?) → the settled `{ players, waves, things? }` of a world's `brawl.street` (throws
 *                       naming the fault before the page is made)
 *
 * The state it reads (the page writes it from brawl-street-read.js streetRead): brawl.street { hp, hpMax, name,
 * cleared, of, left, boss { on, name, hp, hpMax }, moments [], time, moves [] }.
 *
 * Pure: no clock, no dice.
 */
import { IDIOMS } from '../../mana-ui/idioms.js';
import { manaCss } from '../../mana-ui/css.js';
import { themeCss } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { readWaves } from './brawl-crowd.js';

const b = (path) => ({ bind: `brawl.street.${path}` });
const end = (title, sub) => ({ use: 'screen', props: { layer: 'overlay', place: 'center', title }, children: [{ use: 'stack', props: { dir: 'column', gap: 'normal', align: 'center' }, children: [
  { use: 'text', props: { value: sub, role: 'label' } },
  { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [{ use: 'stat', props: { label: 'time', value: b('time') } }, { use: 'stat', props: { label: 'health', value: b('hp'), max: b('hpMax') } }, { use: 'stat', props: { label: 'rank', value: b('rank') } }] },
  { use: 'button', props: { label: 'Fight it again' }, on: { accept: { emit: 'street:again' } } },
] }] });

export function streetSpec() {
  return {
    defs: { 'command-list': { params: IDIOMS['command-list'].params, node: IDIOMS['command-list'].node } },
    hud: { use: 'hud', children: [
      { use: 'region', props: { at: 'top-left' }, children: [{ use: 'stack', props: { dir: 'column', gap: 'tight', align: 'start' }, children: [
        { use: 'text', props: { value: b('name'), role: 'label' } },
        { use: 'bar', props: { value: b('hp'), max: b('hpMax'), variant: 'hp', size: 'large', figures: false } }] }] },
      { use: 'region', props: { at: 'top' }, children: [{ use: 'pips', props: { value: b('cleared'), max: b('of'), shape: 'square', label: 'street' } }] },
      { use: 'region', props: { at: 'top-right' }, children: [{ use: 'counter', props: { label: 'left', value: b('left'), icon: 'skull' } }] },
      // (the boss's bar along the foot, clear of the corners' readouts)
      { use: 'region', props: { at: 'bottom' }, when: b('boss.on'), children: [{ use: 'bar', props: { value: b('boss.hp'), max: b('boss.hpMax'), variant: 'boss', size: 'large', label: b('boss.name'), figures: false } }] },
      { use: 'region', props: { at: 'center', variant: 'bare' }, children: [{ use: 'moments', props: { rows: b('moments'), as: 'banner', hold: 1.1, read: 0.4 } }] },
    ] },
    screens: {
      won: end('Street cleared', 'every screen beaten'),
      lost: end('Down', 'the street is still theirs'),
      moves: { use: 'command-list', props: { title: 'Moves', kinds: b('moves') } },
    },
  };
}

export function streetScreenOf() {
  return { spec: streetSpec(), css: `${manaCss()}\n${themeCss(cardTheme('brawl-yard'))}`, theme: 'brawl-yard' };
}

/** A world's `brawl.street`, settled: who plays (roster indices, one to four), the waves a held screen (read against
 * the belt, so a fault is said before the page), the things on it. */
export function readStreet(street, belt, where = 'brawl.street') {
  if (!street || typeof street !== 'object' || Array.isArray(street)) throw new Error(`brawl: ${where} is { players?, roster?, waves: [{ screen, crowd: [{ type, n }], boss? }], things? }`);
  for (const k of Object.keys(street)) if (!['players', 'roster', 'waves', 'things'].includes(k)) throw new Error(`brawl: ${where}.${k} is not a street's word (players, roster, waves, things)`);
  if (!Array.isArray(street.waves) || !street.waves.length) throw new Error(`brawl: ${where}.waves is a list of { screen, crowd: [{ type, n }] }, at least one: a street with no wave is a walk`);
  readWaves(street.waves, belt);
  return { players: street.players ?? [0], waves: street.waves, things: street.things ?? [], ...(street.roster ? { roster: street.roster } : {}) };
}
