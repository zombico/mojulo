// The broadcast client, run headless on a stub canvas: a kernel call raises the plate a referee's word reads as, a
// plate holds the frame by weight, the cut lays a closeup over the arena's shot and gives it back, the names number the
// computer's places, and a frame of every contest shape's feed draws. Every contest page inlines the client before its
// arena and draws through it: a new sport's page is broadcast or this fails.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { graphSource, COURT_PAGE_MODULES, matchArenaData } from '../contest/match-arena.js';
import { TURNS_PAGE_MODULES, turnsArenaData } from '../contest/turn-arena.js';
import { PITCH_PAGE_MODULES, teamArenaData } from '../contest/team-arena.js';
import { meetArenaData } from '../contest/meet-arena.js';
import { MEET_PAGE_MODULES } from '../scene/channels/contest.js';
import { broadcastData } from './broadcast-package.js';

const API = ['newBroadcast', 'tvNames', 'tvAdvance', 'tvCall', 'tvPlate', 'tvStrap', 'tvOpen', 'tvBoard', 'tvPanel', 'tvCut', 'tvShot', 'tvDraw'];
const lib = new Function(`${graphSource('broadcast/broadcast.client.js')}\nreturn { ${API.join(', ')} };`)();
// a 2D context that records what is written and draws nothing
function stubCanvas() {
  const said = [];
  const grad = { addColorStop() {} };
  const g = new Proxy({ said, letterSpacing: '0px', globalAlpha: 1, measureText: (s) => ({ width: String(s).length * 10 }), createLinearGradient: () => grad, fillText: (s) => said.push(String(s)), strokeText() {} }, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return g;
}
const step = (TV, n) => { for (let i = 0; i < n; i++) lib.tvAdvance(TV); };
const NAMES = { side: (s) => ({ name: s === 'a' ? 'P1' : 'CPU', color: s === 'a' ? 0 : 1 }), who: (id) => ({ name: id.toUpperCase(), color: 0 }), unit: (k) => (k === 'score' ? 'goal' : k), round: (c) => `frame ${c.round}`, gutter: () => true };

describe('the broadcast client', () => {
  it('raises a kernel call as its plate, in the words a referee\'s reason reads as', () => {
    const TV = lib.newBroadcast(broadcastData());
    const said = (c) => lib.tvCall(TV, c, NAMES);
    expect(said({ kind: 'point', side: 'b', why: 'double-bounce' })).toMatchObject({ text: 'NOT UP', sub: 'POINT CPU', tone: 'side' });
    expect(said({ kind: 'game', side: 'a', score: [4, 2] })).toMatchObject({ text: 'GAME', unit: true, tone: 'gold', cut: 'winner' });
    expect(said({ kind: 'set' })).toMatchObject({ text: 'SET', unit: false });   // the starter's, not a tennis set
    expect(said({ kind: 'score', side: 'a' })).toMatchObject({ text: 'GOAL!' });
    expect(said({ kind: 'holed', who: 's1', strokes: 3, par: 4, toPar: -1 })).toMatchObject({ text: 'BIRDIE', tone: 'gold' });
    expect(said({ kind: 'roll', who: 's2', down: 0, mark: null })).toMatchObject({ text: 'GUTTER', tone: 'warn' });
    expect(said({ kind: 'foul', foul: 'offside', side: 'b', cost: 'free' })).toMatchObject({ text: 'OFFSIDE', sub: 'FREE · CPU' });
    expect(said({ kind: 'serve', who: 'a1' })).toBeNull();   // silent by name
    expect(said({ kind: 'finish', who: 'r1', t: 10.4 })).toMatchObject({ text: '10.40' });
    expect(said({ kind: 'finish', who: 'r2', t: 10.5 })).toBeNull();   // the winner's time only
  });
  it('holds the frame by weight: the decisive call takes it, a lighter word waits its turn', () => {
    const TV = lib.newBroadcast(broadcastData()), g = stubCanvas();
    lib.tvPlate(TV, { text: 'STRIKE!', tone: 'gold' });
    lib.tvPlate(TV, { text: 'CPU TO PLAY', tone: 'neutral' });
    expect([TV.plate.text, TV.queued.text]).toEqual(['STRIKE!', 'CPU TO PLAY']);
    lib.tvPlate(TV, { text: 'OUT', tone: 'side' });   // the weightier word waits in its place
    lib.tvPlate(TV, { text: 'LET', tone: 'neutral' });
    expect([TV.plate.text, TV.queued.text]).toEqual(['STRIKE!', 'OUT']);
    lib.tvPlate(TV, { text: 'GAME', tone: 'gold' });   // an equal weight waits until the plate on screen is read
    expect(TV.plate.text).toBe('STRIKE!');
    step(TV, TV.P.in + 30);
    lib.tvPlate(TV, { text: 'GAME', tone: 'gold' });
    expect(TV.plate.text).toBe('GAME');
    expect(TV.queued).toBeNull();   // GAME outweighed the waiting OUT, and is not shown twice
    step(TV, TV.P.in + TV.plate.hold + TV.P.out + 2);
    lib.tvDraw(TV, g, 1280, 720, null); lib.tvDraw(TV, g, 1280, 720, null);
    expect(TV.plate).toBeNull();
  });
  it('raises nothing over the open: a call waits for the title card to go', () => {
    const TV = lib.newBroadcast(broadcastData());
    lib.tvOpen(TV, { title: 'tennis', rows: [] });
    lib.tvPlate(TV, { text: 'LET', tone: 'neutral' });
    expect(TV.plate.at).toBeGreaterThan(TV.f + TV.open.hold);
  });
  it('lays the closeup over the arena\'s shot and gives the shot back', () => {
    const TV = lib.newBroadcast(broadcastData());
    const cam = { fov: 44, position: { x: 0, y: -20, z: 6, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, lookAt() {}, updateProjectionMatrix() {} };
    const wide = () => { cam.position.set(0, -20, 6); cam.fov = 44; };
    lib.tvCut(TV, { on: [2, 5, 0], hold: 30 });
    step(TV, 40); wide(); lib.tvShot(TV, cam, [0, 0, 0]);
    expect(Math.hypot(cam.position.x - 2, cam.position.y - 5)).toBeLessThan(8);
    expect(cam.fov).toBeLessThan(44);
    step(TV, 40); wide(); lib.tvShot(TV, cam, [0, 0, 0]);
    expect(TV.cut).toBeNull();
    expect(cam.position.y).toBe(-20);
    const clean = lib.newBroadcast(broadcastData('clean'));
    lib.tvCut(clean, { on: [0, 0, 0], strap: { name: 'P1', color: 0 } });
    expect(clean.cut).toBeNull();   // the world feed cuts nothing: the strap alone
    expect(clean.strap.name).toBe('P1');
  });
  it('names the places: the recipe\'s, else P1 … and the computer\'s numbered when it holds more than one', () => {
    expect(lib.tvNames(broadcastData(), 2, 1)).toEqual(['P1', 'CPU']);
    expect(lib.tvNames(broadcastData(), 3, 0)).toEqual(['CPU 1', 'CPU 2', 'CPU 3']);
    expect(lib.tvNames(broadcastData({ names: ['Ana'] }), 2, 2)).toEqual(['Ana', 'P2']);
  });
  it('draws a frame of every contest shape\'s feed, in every package', () => {
    const feeds = [
      { title: 'tennis', cols: ['SETS', 'GAMES', 'PTS'], hot: 2, rows: [{ name: 'P1', color: 0, cells: [0, 3, 'AD'], mark: 'serve' }, { name: 'CPU', color: 1, cells: [0, 2, '40'] }], tab: 'advantage P1' },
      { title: '100 m', rows: Array.from({ length: 8 }, (_, i) => ({ name: `L${i}`, color: i, cells: ['10.01'] })), clock: '10.01', period: 'race' },
      { title: 'bowling', cols: ['1', '2', 'TOT'], hot: 2, rows: [{ name: 'P1', color: 0, cells: ['X', '7/', '37'], mark: 'turn' }], meter: { share: 0.95, label: 'release!', color: 0 } },
      { title: 'soccer', rows: [{ name: 'P1', color: 0, cells: [1] }, { name: 'CPU', color: 1, cells: [0] }], hot: 0, clock: '1:23', period: '2nd', hint: 'W A S D run' },
    ];
    for (const pkg of ['network', 'stadium', 'arcade', 'table', 'clean']) {
      const TV = lib.newBroadcast(broadcastData(pkg, { count: 8, kind: 'lanes' })), g = stubCanvas();
      lib.tvOpen(TV, { title: 'the open', rows: [{ name: 'P1', color: 0 }, { name: 'CPU', color: 1 }] });
      step(TV, 400);
      lib.tvCall(TV, { kind: 'over', winner: 'a', score: { a: [0, 0, 1], b: [0, 0, 0] } }, NAMES);
      lib.tvStrap(TV, { name: 'P1', line: 'the match', tag: '1', color: 0 });
      lib.tvBoard(TV, { title: 'final', rows: [{ place: 1, name: 'P1', color: 0, value: '1' }, { place: 2, name: 'CPU', color: 1, value: '0' }], foot: 'press start' });
      step(TV, 30);
      for (const f of feeds) { step(TV, 1); lib.tvDraw(TV, g, 1280, 720, f); }
      step(TV, 200);
      lib.tvDraw(TV, g, 1280, 720, feeds[0]);
      expect(g.said).toContain('P1 WINS');
      expect(g.said).toContain('FINAL');
    }
  });
});

describe('the stats panel', () => {
  it('draws the stats head to head at a break, the lead lit, then goes; the results board takes its place', () => {
    const TV = lib.newBroadcast(broadcastData()), g = stubCanvas();
    lib.tvPanel(TV, { title: 'tennis · changeover', cols: [{ name: 'P1', color: 0 }, { name: 'CPU', color: 1 }], rows: [{ words: 'aces', cells: ['3', '1'], lead: 0 }, { words: '1st serve in', cells: ['64%', '70%'], lead: 1 }] });
    step(TV, TV.P.in * 4);
    lib.tvDraw(TV, g, 1280, 720, null);
    for (const w of ['TENNIS · CHANGEOVER', 'P1', 'CPU', 'ACES', '3', '1', '1ST SERVE IN', '64%', '70%']) expect(g.said).toContain(w);
    step(TV, TV.panel.hold + TV.P.in + TV.P.out + 2);
    lib.tvDraw(TV, g, 1280, 720, null);
    expect(TV.panel).toBeNull();
    lib.tvPanel(TV, { title: 'x', cols: [], rows: [{ words: 'a', cells: ['1'] }] });
    lib.tvBoard(TV, { title: 'final', rows: [] });
    expect(TV.panel).toBeNull();
    lib.tvPanel(TV, { title: 'x', cols: [], rows: [{ words: 'a', cells: ['1'] }] });
    expect(TV.panel).toBeNull();   // nothing over the board
  });
});

describe('every contest page is broadcast', () => {
  const CONTEST = join(moduleDir(import.meta.url, 'lib/graph/broadcast'), '..', 'contest');
  it('inlines the client before its arena and draws through it', () => {
    const lists = { 'meet-arena.client.js': MEET_PAGE_MODULES, 'match-arena.client.js': COURT_PAGE_MODULES, 'turn-arena.client.js': TURNS_PAGE_MODULES, 'team-arena.client.js': PITCH_PAGE_MODULES };
    const clients = readdirSync(CONTEST).filter((f) => f.endsWith('-arena.client.js'));
    expect(clients.sort()).toEqual(Object.keys(lists).sort());   // a new arena's page joins this table
    for (const [client, mods] of Object.entries(lists)) {
      const at = (end) => mods.findIndex((m) => m.endsWith(end));
      expect(at('broadcast/broadcast.client.js'), client).toBeGreaterThanOrEqual(0);
      expect(at('broadcast/broadcast.client.js')).toBeLessThan(at(client));
      const src = readFileSync(join(CONTEST, client), 'utf8');
      for (const use of ['newBroadcast(', 'tvCall(', 'tvDraw(', 'tvShot(', 'tvAdvance(']) expect(src, `${client} uses ${use}`).toContain(use);
    }
  });
  it('carries the package in each arena\'s page data', () => {
    expect(matchArenaData({ sport: 'tennis', broadcast: 'stadium' }).broadcast.package).toBe('stadium');
    expect(meetArenaData({ event: 'sprint', lanes: 6 }).broadcast.colors).toHaveLength(6);
    expect(turnsArenaData({ sport: 'golf', seats: 3, register: 'platformer' }).broadcast.package).toBe('arcade');
    expect(teamArenaData({ sport: 'soccer', broadcast: { names: ['Reds', 'Blues'] } }).broadcast.names).toEqual(['Reds', 'Blues']);
  });
  it('carries each contest\'s stats coverage, the recipe\'s rows over it, or none; every page folds and shows them', () => {
    expect(matchArenaData({ sport: 'tennis' }).broadcast.stats).toMatchObject({ at: 'changeover', panel: expect.arrayContaining(['aces']) });
    expect(teamArenaData({ sport: 'soccer', broadcast: { stats: { panel: ['possession'] } } }).broadcast.stats).toMatchObject({ at: 'period', panel: ['possession'] });
    expect(meetArenaData({ event: 'sprint', broadcast: { stats: false } }).broadcast.stats).toBeNull();
    expect(() => matchArenaData({ sport: 'tennis', broadcast: { stats: { panel: 'aces' } } })).toThrow(/stats.panel is a list of up to 10 row ids/);
    expect(() => matchArenaData({ sport: 'tennis', broadcast: { stats: { when: 'now' } } })).toThrow(/stats has no 'when'/);
    expect(broadcastData(undefined, { where: 'tabletop' }).stats).toBeUndefined();   // a page without coverage carries none
    const lists = { 'meet-arena.client.js': MEET_PAGE_MODULES, 'match-arena.client.js': COURT_PAGE_MODULES, 'turn-arena.client.js': TURNS_PAGE_MODULES, 'team-arena.client.js': PITCH_PAGE_MODULES };
    for (const [client, mods] of Object.entries(lists)) {
      const at = (end) => mods.findIndex((m) => m.endsWith(end));
      expect(at('contest-stats.js'), client).toBeGreaterThanOrEqual(0); expect(at('contest-stats.js')).toBeLessThan(at(client));
      const src = readFileSync(join(moduleDir(import.meta.url, 'lib/graph/broadcast'), '..', 'contest', client), 'utf8');
      for (const use of ['contestStats(', 'statCompact(', 'BC.stats'].map((u) => (client === 'match-arena.client.js' || client === 'turn-arena.client.js' ? u : u.replace('BC.stats', '.broadcast.stats')))) expect(src, `${client} uses ${use}`).toContain(use);
    }
  });
});
