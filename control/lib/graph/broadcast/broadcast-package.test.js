// The broadcast package: the colour theory holds (sides apart for every eye, ink by contrast, ramps that keep their
// hue), the metal is the metal's (its measured hue, the horizon dark, cel in hard bands), every call the contest kernel
// can make has a cue or is silent by name, and the recipe's word is read and taught.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import {
  BROADCAST_PACKAGES, BROADCAST_PACKAGE_IDS, REGISTER_PACKAGE, SIDE_KITS, LANE_KITS, CALL_CUES,
  readBroadcast, broadcastData, oklab, deltaE, simulateCvd, contrast, inkOn, colorRamp, separateColors, metalStops, inkContrasts, hexRgb,
} from './broadcast-package.js';

const KERNEL = join(moduleDir(import.meta.url, 'lib/graph/broadcast'), '..', 'contest', 'contest-kernel.js');
const hueOf = (h) => { const [, a, b] = oklab(h); return Math.atan2(b, a); };
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('colour', () => {
  it('sets the ink on a colour by contrast, and the kits read at the text floor', () => {
    expect(inkOn('#f0e442')).toBe('#0b0f17');
    expect(inkOn('#0072b2')).toBe('#ffffff');
    const kits = [...SIDE_KITS, ...LANE_KITS];
    for (const k of kits) expect(contrast(k, inkOn(k))).toBeGreaterThanOrEqual(4.5);
  });
  it('sees what a deutan sees: red and green fold together, red and blue stay apart', () => {
    expect(deltaE(simulateCvd('#d7263d'), simulateCvd('#2e8b3a'))).toBeLessThan(deltaE('#d7263d', '#2e8b3a') / 2);
    expect(deltaE(simulateCvd(SIDE_KITS[0]), simulateCvd(SIDE_KITS[1]))).toBeGreaterThan(0.14);
  });
  it('keeps colours apart for every eye: a clash wears its alternate, distinct kits are untouched', () => {
    expect(separateColors([...SIDE_KITS]).clash).toEqual([]);
    expect(separateColors([...LANE_KITS], 0.12).clash).toEqual([]);
    const { colors, clash } = separateColors(['#d7263d', '#2e8b3a']);   // a red and a green: apart in colour, one to a deutan
    expect(clash).toEqual([1]);
    for (const kind of ['deutan', 'protan']) expect(deltaE(simulateCvd(colors[0], kind), simulateCvd(colors[1], kind))).toBeGreaterThan(0.14 * 0.6);
  });
  it('ramps a colour at its own hue, light to dark', () => {
    const h = SIDE_KITS[1], r = colorRamp(h), L = (c) => oklab(c)[0];
    expect(L(r.hi)).toBeGreaterThan(L(r.base));
    expect(L(r.base)).toBeGreaterThan(L(r.lo));
    expect(L(r.lo)).toBeGreaterThan(L(r.deep));
    for (const c of [r.hi, r.lo]) expect(turn(hueOf(c), hueOf(h))).toBeLessThan(0.12);
    expect(colorRamp('#111111', BROADCAST_PACKAGES.network.glass[1]).key).toBe(true);   // a black kit on the dark glass is keylined
    expect(colorRamp(h, BROADCAST_PACKAGES.network.glass[1]).key).toBeUndefined();
  });
});

describe('metal', () => {
  it('is the metal\'s colour: gold warm, chrome neutral, the horizon the dark band below the middle', () => {
    const gold = metalStops('gold').map(([, c]) => hexRgb(c)), chrome = metalStops('chrome').map(([, c]) => hexRgb(c));
    for (const [r, g, b] of gold) { expect(r).toBeGreaterThan(g); expect(g).toBeGreaterThan(b); }
    for (const [r, g, b] of chrome) expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(0.08);
    const lum = (c) => c[0] + c[1] + c[2], dark = chrome.reduce((k, c, i) => (lum(c) < lum(chrome[k]) ? i : k), 0);
    expect(metalStops('chrome')[dark][0]).toBeGreaterThan(0.5);
  });
  it('bands hard in a cel package, and is the same bytes every time', () => {
    const cel = metalStops('gold', { cel: true });
    const offs = cel.map(([o]) => o);
    expect(new Set(offs).size).toBeLessThan(offs.length);   // a hard stop is two colours at one offset
    expect(JSON.stringify(broadcastData('arcade'))).toBe(JSON.stringify(broadcastData('arcade')));
  });
});

describe('the cues', () => {
  it('has a cue, or a silence by name, for every call the contest kernel makes', () => {
    const src = readFileSync(KERNEL, 'utf8');
    const kinds = new Set([...src.matchAll(/calls\.push\(\{ kind: '([a-z-]+)'/g)].map((m) => m[1]));
    expect(kinds.size).toBeGreaterThan(10);
    for (const k of kinds) expect(Object.keys(CALL_CUES), `the kernel calls '${k}': give it a cue (or null) in CALL_CUES`).toContain(k);
    expect(src).toMatch(/calls\.push\(\{ kind: L\[i\]\.unit/);   // a scoring unit's call: the `unit` cue
    expect(CALL_CUES.unit).toBeTruthy();
  });
});

describe('the recipe\'s word', () => {
  it('lets the register pick the package and the recipe override it', () => {
    for (const [reg, id] of Object.entries(REGISTER_PACKAGE)) expect(broadcastData(undefined, { register: reg }).package).toBe(id);
    expect(broadcastData('clean', { register: 'action' }).package).toBe('clean');
    expect(BROADCAST_PACKAGE_IDS).toEqual(Object.keys(BROADCAST_PACKAGES));
  });
  it('carries the recipe\'s kits, names and closeups, a kit per place', () => {
    const d = broadcastData({ sides: ['#FFCC00', '#003399'], names: ['Ana', 'Bo'], closeups: false, accent: 'silver' }, { count: 2 });
    expect(d.colors.map((c) => c.base)).toEqual(['#ffcc00', '#003399']);
    expect(d.names).toEqual(['Ana', 'Bo']);
    expect(d.card.closeups).toBe(false);
    expect(broadcastData(undefined, { count: 8, kind: 'lanes' }).colors).toHaveLength(8);
    expect(Math.min(...inkContrasts(broadcastData(undefined, { count: 8, kind: 'lanes' })))).toBeGreaterThanOrEqual(4.5);
    expect(broadcastData('clean').metal.rim).toBeNull();
  });
  it('teaches on a bad word', () => {
    expect(readBroadcast('stadium')).toEqual({ package: 'stadium' });
    expect(() => readBroadcast('tv', 'court')).toThrow(/court: broadcast package 'tv' is one of network, stadium, arcade, table, clean/);
    expect(() => readBroadcast({ logo: 1 })).toThrow(/has no 'logo'/);
    expect(() => readBroadcast({ sides: ['red'] })).toThrow(/#rrggbb/);
    expect(() => readBroadcast({ names: ['a name far too long for a strap'] })).toThrow(/1 to 18 characters/);
    expect(() => readBroadcast({ closeups: 'yes' })).toThrow(/true or false/);
    expect(() => readBroadcast({ accent: 'unobtanium' })).toThrow(/is a metal/);
  });
});
