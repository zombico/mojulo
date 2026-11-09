/**
 * brawl page — what a brawl's page carries: the pure modules it plays (the fight's it is made of, then the brawl's own),
 * the controls it reads, the client that draws it, and the data a world's `brawl` block hands it. Server side: the
 * brawl channel (scene/channels/brawl.js) inlines what this assembles.
 *
 *   BRAWL_VERSUS_MODULES     the fight's modules a brawl is made of (its records, its compiler, its posing), inlined as
 *                            the fight's page inlines them (versus-page.js versusSource)
 *   BRAWL_PAGE_MODULES       the brawl's own, each in a scope of its own (brawlSource): their helpers share names with
 *                            the fight's core (think, start, separate…), so only each module's exports reach the page
 *   brawlSource(file)        a brawl module as a page fragment: `const { …its exports } = (() => { …; return {…}; })();`
 *   brawlPageSource()        the whole: the fight's modules, the controls (the brawl scheme, the seats), the brawl's, the
 *                            yard's client
 *   brawlYardData(block, bodies?) a world's `brawl` block with its `practice` → what the yard's page reads (the belt,
 *                            the roster its players and dummies pick from, characters among them, the things, the
 *                            yard's screen, each character's body)
 *   BRAWL_ROSTER             the yard's fighters: one of each archetype the fight's solver knows
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { versusSource, rosterEntry } from '../versus/versus-page.js';
import { solveFighter, ARCHETYPES } from '../versus/versus-solver.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES as CONTROL_SCHEMES } from '../controls/schemes.js';
import { buildSeatsKernel } from '../controls/seats-kernel.js';
import { DEVICES } from '../controls/devices.js';
import { yardOf, YARD_SETTINGS } from './brawl-yard.js';
import { BRAWL_STYLES } from './brawl-moves.js';
import { readGun } from './brawl-guns.js';
import { RANGE_GUNS } from './brawl-practice.js';
import { readRangeWaves } from './brawl-waves.js';

const SRC = moduleDir(import.meta.url, 'lib/graph/brawl');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// (the order matters: each module only uses names from the ones before it)
export const BRAWL_VERSUS_MODULES = Object.freeze(['versus-rig.js', 'versus-library.js', 'versus-traditions.js', 'versus-react.js', 'versus-fx.js', 'versus-compile.js', 'versus-input.js', 'versus-cpu.js', 'versus-solver.js', 'versus-figure.js']);
export const BRAWL_PAGE_MODULES = Object.freeze(['brawl-belt.js', 'brawl-things.js', 'brawl-guns.js', 'brawl-core.js', 'brawl-moves.js', 'brawl-gunner.js', 'brawl-crowd.js', 'brawl-waves.js', 'brawl-practice.js', 'brawl-pose.js', 'brawl-yard-read.js']);

/** The names a module exports (one per `export function|const|let|class` line). */
export function exportsOf(src) {
  return [...src.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}
/** A brawl module as a page fragment, in a scope of its own: only its exports reach the page. */
export function brawlSource(file) {
  const src = readFileSync(join(SRC, file), 'utf8');
  const names = exportsOf(src);
  const body = src.replace(/^import[^\n]*\n/gm, '').replace(/^export \{[^\n]*\n/gm, '').replace(/^export /gm, '');
  return `// ── ${file} ──\nconst { ${names.join(', ')} } = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();`;
}

// the controls the yard reads: the kernel, the families it reads, the brawl scheme's bindings, the seats kernel
const brawlControls = () => `const __BR_CTL = (${buildControlsKernel.toString()})();
const __BR_DEV = ${json({ keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad })};
const __BR_BIND = __BR_CTL.resolve(${json(CONTROL_SCHEMES.brawl)}, __BR_DEV);
const __BR_SEATK = (${buildSeatsKernel.toString()})();
`;

export function brawlPageSource() {
  const fight = BRAWL_VERSUS_MODULES.map((f) => `// ── ${f} ──\n${versusSource(f)}`).join('\n');
  const brawl = BRAWL_PAGE_MODULES.map(brawlSource).join('\n');
  // (the client in a scope of its own too: only its frame step reaches the block)
  const client = readFileSync(join(SRC, 'brawl-yard.client.js'), 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
  return `${fight}\n${brawlControls()}${brawl}\n// ── brawl-yard.client.js ──\nconst stepBrawlYard = (() => {\n${client}\nreturn stepBrawlYard;\n})();`;
}

/** The yard's fighters: one of each archetype, each with its style's name. */
export const BRAWL_ROSTER = Object.freeze(Object.keys(ARCHETYPES).map((a, i) => ({
  id: a, name: a.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), style: BRAWL_STYLES[a] ? a : 'all-rounder',
  color: ['#e8502a', '#2a8ae8', '#e8b82a', '#7a4ae8'][i % 4], recipe: { ...solveFighter({ id: a, archetype: a }).recipe, archetype: a },
})));

/** THE ARMED BRAWLER's fighters (a brawl's `armed`): one of each archetype, each its own weapon for the whole game, the
 * weapon fitted to the style (the all-rounder's katana, the rushdown's claws, the zoner's staff, the grappler's axe). */
export const BRAWL_ARMS = Object.freeze({ 'all-rounder': 'katana', rushdown: 'claws', zoner: 'staff', grappler: 'axe' });
export const BRAWL_ARMED_ROSTER = Object.freeze(BRAWL_ROSTER.map((r) => {
  const weapon = BRAWL_ARMS[r.style] ?? 'sword';
  return { ...r, id: `${r.id}-${weapon}`, name: `${r.name} (${weapon})`, recipe: { ...r.recipe, weapon } };
}));

/**
 * What the yard's page reads, from a world's `brawl` block (its belt, register, practice) and its characters' bodies.
 * The practice's `roster` is who can be played and fought: each entry a CHARACTER (`{ hero: { ref }, style? }`, measured
 * from the store before it reaches here: versus-character.js resolveCharacters, as a fight's roster is) or a fighter's
 * intent (`{ archetype }`), either with its own `weapon` (versus-library.js WEAPONS) carried the whole game; absent, one
 * fighter of each archetype. In the ARMED brawler (`block.armed`) every entry carries a weapon (absent, the armed
 * roster) and the street lays none (a hero keeps its own). `players` are roster indices (one to four);
 * `dummies` each `{ mode, fighter?: a roster index | type?: a crowd type, at?, n? }`. `bodies` (versus-character.js
 * characterBodies: { <ref>: its body, played with its clips }) draws each character in its own body; one with none is
 * drawn as the fight's stick figure.
 */
export function brawlYardData(block, bodies = null) {
  const P = block.practice ?? {};
  const Y = yardOf();
  const roster = Array.isArray(P.roster) && P.roster.length
    ? P.roster.map((e, k) => { const r = rosterEntry(e, k); const style = BRAWL_STYLES[r.archetype] ? r.archetype : 'all-rounder'; return { ...r, style, ...(e.weapon ? { recipe: { ...r.recipe, weapon: e.weapon } } : {}) }; })
    : block.armed ? BRAWL_ARMED_ROSTER : BRAWL_ROSTER;
  if (block.armed) {
    roster.forEach((r, k) => { if (!r.recipe.weapon) throw new Error(`brawl: an armed brawl's roster[${k}] (${r.name}) carries no weapon: every hero its own`); });
    (P.things ?? []).forEach((t, k) => { if (t.kind === 'weapon') throw new Error(`brawl: an armed brawl's things[${k}] is a weapon: every hero keeps its own`); });
  }
  const pick = (k, where) => { if (!(Number.isInteger(k) && k >= 0 && k < roster.length)) throw new Error(`brawl: ${where} is a roster index, 0 to ${roster.length - 1}`); return k; };
  const players = (P.players ?? [0]).map((k, i) => pick(k, `practice.players[${i}]`));
  // (an armed brawl's dummies the armed crowd's swordsmen unless it says)
  const dummies = (P.dummies ?? (block.armed ? [{ mode: 'stand', type: 'sword' }, { mode: 'walk', type: 'sword' }, { mode: 'swing', type: 'sword' }] : [{ mode: 'stand' }, { mode: 'walk' }, { mode: 'swing' }])).map((d, i) => {
    if (d.fighter === undefined) return d;
    const k = pick(d.fighter, `practice.dummies[${i}].fighter`), { fighter: _f, ...rest } = d;
    return { ...rest, recipe: roster[k].recipe, roster: k };
  });
  return {
    belt: block.belt, register: block.register ?? null, ...(block.armed ? { armed: true } : {}), ...(block.sun ? { sun: block.sun } : {}),
    roster, players, dummies,
    things: P.things ?? [], health: P.health ?? 'chains',
    // (THE RANGE, the run & gun's: the guns passed in to be tried, read here so a fault is said before the page)
    ...(P.range ? { range: { guns: (P.range.guns ?? RANGE_GUNS).map((g, k) => { readGun(g, `practice.range.guns[${k}]`); return g; }), grenades: P.range.grenades ?? 3,
      // (its waves, read here so a fault is said before the page: the sampler for `true`)
      ...(P.range.waves ? { waves: readRangeWaves(P.range.waves), loop: P.range.loop !== false } : {}), names: (P.range.guns ?? RANGE_GUNS).map((g) => { const G = readGun(g); return G.name ?? G.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '); }) } } : {}),
    ...(bodies ? { bodies } : {}),
    yard: { spec: Y.spec, css: Y.css, settings: YARD_SETTINGS },
  };
}
