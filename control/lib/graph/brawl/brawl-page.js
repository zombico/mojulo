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
 *   brawlYardData(block)     a world's `brawl` block with its `practice` → what the yard's page reads (the belt, the
 *                            roster its players pick from, the dummies, the things, the yard's screen)
 *   BRAWL_ROSTER             the yard's fighters: one of each archetype the fight's solver knows
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { versusSource } from '../versus/versus-page.js';
import { solveFighter, ARCHETYPES } from '../versus/versus-solver.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES as CONTROL_SCHEMES } from '../controls/schemes.js';
import { buildSeatsKernel } from '../controls/seats-kernel.js';
import { DEVICES } from '../controls/devices.js';
import { yardOf, YARD_SETTINGS } from './brawl-yard.js';
import { BRAWL_STYLES } from './brawl-moves.js';

const SRC = moduleDir(import.meta.url, 'lib/graph/brawl');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// (the order matters: each module only uses names from the ones before it)
export const BRAWL_VERSUS_MODULES = Object.freeze(['versus-rig.js', 'versus-library.js', 'versus-traditions.js', 'versus-react.js', 'versus-fx.js', 'versus-compile.js', 'versus-input.js', 'versus-cpu.js', 'versus-solver.js', 'versus-figure.js']);
export const BRAWL_PAGE_MODULES = Object.freeze(['brawl-belt.js', 'brawl-things.js', 'brawl-core.js', 'brawl-moves.js', 'brawl-crowd.js', 'brawl-practice.js', 'brawl-pose.js', 'brawl-yard-read.js']);

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

/** What the yard's page reads, from a world's `brawl` block (its belt, register, practice). */
export function brawlYardData(block) {
  const P = block.practice ?? {};
  const Y = yardOf();
  return {
    belt: block.belt, register: block.register ?? null,
    roster: BRAWL_ROSTER, players: P.players ?? [0],
    dummies: P.dummies ?? [{ mode: 'stand' }, { mode: 'walk' }, { mode: 'swing' }],
    things: P.things ?? [], health: P.health ?? 'chains',
    yard: { spec: Y.spec, css: Y.css, settings: YARD_SETTINGS },
  };
}
