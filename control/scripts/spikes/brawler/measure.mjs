#!/usr/bin/env node
// brawler measure — A MAP'S FIGHT MEASURED with no page (brawl/brawl-measure.js): a level's belt, the waves and things
// its play type lays (or the brawl's own), fought down by each bot at each tier; the runs and the fight laws printed.
//   node scripts/spikes/brawler/measure.mjs [--level '<json>'] [--play brawl|gun] [--types thug,knife] [--waves '<json>'] [--things '<json>'] [--style all-rounder] [--secs 300] [--json]
import { register } from 'node:module';
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const { brawlLevel } = await import(at('lib/graph/brawl/brawl-levels.js'));
const { streetPlay } = await import(at('lib/graph/gameworld/quick.js'));
const { measureMap } = await import(at('lib/graph/brawl/brawl-measure.js'));
const { solveFighter } = await import(at('lib/graph/versus/versus-solver.js'));
const level = JSON.parse(opt('--level', '{"kind":"greybox","preset":"street"}')), play = opt('--play', 'brawl'), style = opt('--style', 'all-rounder');
const B = brawlLevel(level).brawl, types = opt('--types', null)?.split(',') ?? null;
const J = (k) => (opt(k, null) ? JSON.parse(opt(k)) : undefined);
const S = streetPlay(play, B.belt, { types, setting: B.dress?.setting ?? null, dress: B.dress ?? null, waves: J('--waves'), things: J('--things') });
const street = { belt: B.belt, players: [{ recipe: { ...solveFighter({ id: style, archetype: style }).recipe, archetype: style }, style }], waves: S.waves, things: S.things, ...(S.play === 'gun' ? { gunner: { guns: [S.guns[0]], grenades: S.grenades ?? 3 } } : {}) };
const M = measureMap(street, { secs: Number(opt('--secs', 300)) });
if (argv.includes('--json')) { console.log(JSON.stringify(M, null, 1)); process.exit(0); }
console.log(`${play} on ${JSON.stringify(level)} · ${B.belt.length} m · waves ${S.waves.map((w) => `${w.screen + 1}:${w.crowd.map((c) => `${c.n} ${c.type}`).join('+')}${w.boss ? '+boss' : ''}`).join('  ')}`);
for (const r of M.runs) console.log(`  ${r.tier.padEnd(6)} ${r.bot.padEnd(7)} ${(r.result + ' ' + r.won + '/' + r.takes).padEnd(11)} ${String(r.seconds).padStart(6)} s  health ${String(Math.round(r.health * 100)).padStart(3)}%  ${r.waves.map((w) => (w.reached ? `[${w.screen + 1}: ${w.seconds}s -${Math.round(w.lost * 100)}% ${w.felled}/${w.of}${w.passed ? ' passed' : ''}]` : `[${w.screen + 1}: -]`)).join(' ')}${r.rounds ? `  acc ${r.rounds.accuracy}%` : ''}`);
process.stdout.on('error', () => {});
for (const l of M.laws) console.log(`  ${l.ok ? 'ok  ' : 'FAIL'} ${l.id}${l.ok ? '' : ': ' + l.advice}`);
