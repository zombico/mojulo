#!/usr/bin/env node
// brawler street (sim) — THE STREET fought down with no page: the greybox street's belt, a wave a held screen and the
// boss's, one player on the brawler's native kit (brawl-moves.js) played by a bot that walks at the nearest body on the
// street, lines up and presses attack. What it answers: does a street play from its start to its boss on the brawl's
// own sim (streetOf / stepStreet), how long, and what the player has left.
//   node scripts/spikes/brawler/street-sim.mjs [--style all-rounder] [--secs 240] [--verbose]
import { register } from 'node:module';
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { brawlPreset } = await import(at('lib/graph/brawl/brawl-levels.js'));
const { streetOf, stepStreet, CROWD_TYPE_IDS, CROWD_TYPES } = await import(at('lib/graph/brawl/brawl-crowd.js'));
const { newReader, readButtons } = await import(at('lib/graph/brawl/brawl-moves.js'));
const { solveFighter, ARCHETYPES } = await import(at('lib/graph/versus/versus-solver.js'));
const style = opt('--style', 'all-rounder'), secs = Number(opt('--secs', 240));
const P = brawlPreset('street'), belt = P.belt;
const recipe = { ...solveFighter({ id: style, archetype: style }).recipe, archetype: style };
const boss = { ...solveFighter({ id: 'boss', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'boss' };
const T = CROWD_TYPE_IDS;
const waves = [{ screen: 1, crowd: [{ type: T[0], n: 4 }] }, { screen: 2, crowd: [{ type: T[0], n: 3 }, { type: T[1] ?? T[0], n: 2 }] }, { screen: 3, crowd: [{ type: T[0], n: 2 }], boss: { recipe: boss, plays: ['chain', 'strong'], cpu: Object.keys((await import(at('lib/graph/versus/versus-cpu.js'))).CPU_LEVELS)[0], hp: 400 } }];
let street = streetOf({ belt, players: [{ recipe, style }], waves });
let reader = newReader();
console.log('belt', belt.length, 'm;', belt.screens.map((s) => `${s.length}${s.gate ? 'g' : ''}${s.boss ? 'B' : ''}`).join(' '), '· crowd types', T.join(', '), '· bodies', street.s.bodies.length);
const log = [];
let f = 0, done = null;
for (; f < secs * 60 && !done; f++) {
  const me = street.s.bodies[0], F = street.ctx.fighters[me.fi];
  const foes = street.s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko && b.st !== 'wait' && b.st !== 'hide');
  const near = foes.sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.z - me.z) - Math.abs(b.x - me.x) - Math.abs(b.z - me.z))[0];
  const buttons = near ? { x: Math.abs(near.x - me.x) > 700 ? Math.sign(near.x - me.x) : 0, z: Math.abs(near.z - me.z) > 150 ? Math.sign(near.z - me.z) : 0, a: Math.abs(near.x - me.x) < 1000 && Math.abs(near.z - me.z) < 300 && f % 6 < 3 } : { x: 1, z: 0 };
  const [pad, r2] = readButtons(reader, buttons, me, F); reader = r2;
  street = stepStreet(street, [pad]);
  if (f % 300 === 0 || opt('--verbose', null) !== null && f % 60 === 0) log.push({ t: +(f / 60).toFixed(0), x: +(me.x / 1000).toFixed(1), cam: +(street.s.cam / 1000).toFixed(1), hp: me.hp, cleared: street.s.cleared.join(','), wave: street.mind.wave, on: foes.length, st: me.st });
  const crowd = street.s.bodies.filter((b) => b.side === 'crowd');
  if (me.ko) done = 'lost';
  else if (belt.screens.every((sc, i) => !(sc.gate || sc.boss) || street.s.cleared.includes(i))) done = 'won';
}
for (const l of log) console.log(JSON.stringify(l));
const me = street.s.bodies[0];
console.log(JSON.stringify({ done, secs: +(f / 60).toFixed(1), hp: me.hp, cleared: street.s.cleared, bodyKeys: Object.keys(me).join(' '), sKeys: Object.keys(street.s).join(' ') }));
