// No dead pointers: what the agent reads never tells it to call a tool it cannot reach.
//
// A tool registered listed:false and homed in no pack (a deprecated alias, a folded name, a per-op name behind a door,
// a retired pack's member) is not in tools/list and no pack dispatcher accepts it, so a host that calls only what it
// lists cannot call it; only a compiled plan step can. A fold or a retirement therefore rewrites every pointer to the
// old name (CLAUDE.md, the MCP tool surface). This guard makes that mechanical: it reads the surfaces the agent is handed
// (the catalysts, the routing cards, the vocab cards, and the prose strings the tools and their helpers return: the
// descriptions, the `next` and `submit` hints, the errors) and fails on any of them that names an unreachable tool.
//
// Allowed: prose that says the name is retired ("formerly", "retired", "deprecated", "alias", "folded" on the same
// line), a view card's `retired_tool:` metadata, a bare name as data (a table key, a list entry: a string that is the
// name and nothing else), and the files that register or alias the name themselves. KNOWN_DEAD is shrink-only: a
// pointer fixed comes off it, and a new one is fixed rather than added.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ensureToolsRegistered, listRegisteredToolNames, isToolListed } from '@/lib/mcp/server';
import { PACKS, SPINE, FOLDED, RETIRED_TOOLS, dispatchTargets, isPackId } from '@/lib/mcp/packs';
import { ROLES_ADMIN_TOOLS } from '@/lib/roles/enforce';

const CONTROL = path.resolve(__dirname, '..', '..');
const rel = (f) => path.relative(CONTROL, f).split(path.sep).join('/');

// The surfaces the agent is handed. Prose files are read line by line; code files for their string literals.
const PROSE_DIRS = ['lib/mcp/catalysts', 'lib/mcp/routing-cards'];
const VOCAB_ROOT = 'lib/graph';
const CODE_DIRS = ['lib/mcp', 'lib/graph', 'app/api'];
const CODE_FILES = ['scripts/orient-mcp.mjs'];
// Tools a host lists only under its own switch (the roles pack's admin keys, the MCP-apps preview).
const SWITCHED = new Set([...ROLES_ADMIN_TOOLS, 'preview_world']);
// A line that says the name is gone is history, not an instruction.
const HISTORY = /formerly|retired|deprecated|\balias|folded|was renamed|no longer/i;

// Names deleted from the registry: an agent told to call one meets an unknown tool. Frozen; a fold that deletes names
// adds them here, so a pointer to a deleted name fails like one to an unreachable name.
const GONE = [
  'create_action_world', 'create_assembler', 'create_atmosphere_view', 'create_atom_view', 'create_black_hole_view',
  'create_carved_solid', 'create_cascade_view', 'create_cellular_view', 'create_cherenkov_view', 'create_comet_view',
  'create_complete_square_view', 'create_complex_view', 'create_conics_view', 'create_controllable_world',
  'create_derivative_view', 'create_dna_process', 'create_dna_view', 'create_double_slit_view', 'create_edifice',
  'create_energy_cycle', 'create_field_flow_view', 'create_field_view', 'create_figure', 'create_fission_view',
  'create_fluid_view', 'create_fractal_city', 'create_ftc_view', 'create_fusion_view', 'create_galaxy_view',
  'create_gravity_wave_view', 'create_heat_sphere_view', 'create_lightning_storm_view', 'create_manji_tree',
  'create_mechanics_view', 'create_molecule_view', 'create_ocean_view', 'create_orbit_view',
  'create_painted_landscape', 'create_parallel_transport_view', 'create_planetary', 'create_plasma_globe_view',
  'create_polygonized_sketch', 'create_probability_view', 'create_pulsar_view', 'create_pythagoras_view',
  'create_quadratic_view', 'create_reactor_view', 'create_saturn_view', 'create_series_view',
  'create_solid_turntable', 'create_star_birth_view', 'create_star_surface_view', 'create_surface_view',
  'create_transform_view', 'create_transformer_view', 'create_transportation_hub', 'create_trig_circle_view',
  'create_vector_match_view', 'create_wavepacket_view', 'create_windmill_view', 'create_workbench', 'emote_figure',
  'get_polygonizer_packet', 'get_skin_packet', 'preview_vehicle_instance', 'sketch_polygomer', 'skin_polygomer',
  'submit_polygonizer_manifest',
  // the office wing's least-used leftovers, deleted outright (1111-mcp-cleanup)
  'get_deliberation_overview', 'list_daemons', 'list_runners', 'meta_context_analyze', 'restart_daemon', 'start_daemon',
  'status_daemon', 'stop_daemon',
];

// Pointers known dead when the guard landed, to be fixed by the tool-surface sweep. Shrink-only: `file::tool`.
const KNOWN_DEAD = [
  // the Blender art pack's return step names the mesh handoff's per-op names (the engine handoff's area)
  'lib/graph/scene/blender-project.js::accept_mesh_render',
  'lib/graph/scene/blender-project.js::request_mesh_render',
  'lib/graph/scene/blender-project.js::submit_mesh_render',
  // forward_context's dashboard map still names the image handoff's per-op names
  'lib/mcp/tools/context.js::accept_image_render',
  'lib/mcp/tools/context.js::pull_image_render',
  'lib/mcp/tools/context.js::reject_image_render',
];

function walk(dir, keep, out = []) {
  const abs = path.join(CONTROL, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(abs, e.name);
    if (e.isDirectory()) walk(path.join(dir, e.name), keep, out);
    else if (keep(e.name, rel(p))) out.push(p);
  }
  return out;
}

/** Tools a host that calls only what it lists cannot reach: registered but unreachable, or deleted. */
function unreachableTools() {
  const reachable = new Set([...SPINE, ...FOLDED, ...SWITCHED, ...PACKS.flatMap((p) => dispatchTargets(p))]);
  const unreachable = listRegisteredToolNames().filter((n) => !isPackId(n) && !isToolListed(n) && !reachable.has(n));
  return [...new Set([...unreachable, ...GONE])];
}

/** Strip // and block comments from source, keeping line breaks so line numbers hold. */
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += d ?? ''; i += 2; continue; }
      if (c === q) q = null;
      i++;
      continue;
    }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    out += c;
    i++;
  }
  return out;
}

/** The string literals in a source, each with its line (a template's text between its `${}`s counts). */
function stringLiterals(src) {
  const code = stripComments(src), out = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gs;
  for (const m of code.matchAll(re)) out.push({ text: m[0].slice(1, -1), line: code.slice(0, m.index).split('\n').length });
  return out;
}

function findDeadPointers() {
  const dead = unreachableTools();
  const deadSet = new Set(dead), registeredNames = new Set(listRegisteredToolNames());
  const token = new RegExp(`(?<![A-Za-z0-9_])(${dead.join('|')})(?![A-Za-z0-9_])`, 'g');
  const found = new Map(); // `file::tool` → first line
  const hit = (file, tool, line) => { const k = `${file}::${tool}`; if (!found.has(k)) found.set(k, line); };

  const md = (n) => n.endsWith('.md') && !n.endsWith('.plan.md') && n !== 'README.md';
  const prose = [
    // the catalyst loader reads the shelf and its techniques only (catalysts/loader.js), so those are what an agent gets
    ...PROSE_DIRS.flatMap((d) => fs.readdirSync(path.join(CONTROL, d)).filter(md).map((n) => path.join(CONTROL, d, n))),
    ...walk(VOCAB_ROOT, (n, r) => md(n) && /-vocab\//.test(r)),
  ];
  for (const f of new Set(prose)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
      if (HISTORY.test(text) || /^\s*retired_tool:/.test(text)) return;
      for (const m of text.matchAll(token)) hit(rel(f), m[1], i + 1);
    });
  }

  const code = [
    ...CODE_DIRS.flatMap((d) => walk(d, (n) => /\.(m?js|jsx)$/.test(n) && !/\.test\.m?js$/.test(n) && !/\.fixture\.js$|\.holdout\.js$/.test(n))),
    ...CODE_FILES.map((f) => path.join(CONTROL, f)).filter((f) => fs.existsSync(f)),
  ];
  for (const f of code) {
    const src = fs.readFileSync(f, 'utf8');
    if (!token.test(src)) continue;
    token.lastIndex = 0;
    // a file that registers or aliases a name may name it; a file whose own tools are all unreachable is a retired
    // tool's own text, which an agent reads only by calling that tool by name, so it may name its siblings
    const own = new Set([...src.matchAll(/name:\s*['"]([a-z0-9_]+)['"]/g)].map((m) => m[1]));
    const registered = [...own].filter((n) => registeredNames.has(n));
    if (registered.length && registered.every((n) => deadSet.has(n))) continue;
    for (const s of stringLiterals(src)) {
      if (HISTORY.test(s.text)) continue;
      for (const m of s.text.matchAll(token)) {
        if (own.has(m[1])) continue;
        if (s.text.trim() === m[1]) continue; // a bare name is data: a table key, a list entry, a lookup
        if (rel(f) === 'lib/mcp/packs.js' && RETIRED_TOOLS.includes(m[1])) continue; // a retired pack's own description
        hit(rel(f), m[1], s.line);
      }
    }
  }
  return found;
}

describe('no dead pointers: the agent is never told to call a tool it cannot reach', () => {
  it('every catalyst, card and returned prose names a reachable tool, or KNOWN_DEAD says it is being fixed', async () => {
    await ensureToolsRegistered();
    const found = findDeadPointers();
    const known = new Set(KNOWN_DEAD);
    const fresh = [...found].filter(([k]) => !known.has(k)).map(([k, line]) => `${k.replace('::', `:${line} names `)}`);
    expect(fresh, 'a surface the agent reads names an unlisted, unhomed tool: name the door that owns it instead').toEqual([]);
    const fixed = KNOWN_DEAD.filter((k) => !found.has(k));
    expect(fixed, 'fixed: take these off KNOWN_DEAD (it only shrinks)').toEqual([]);
  }, 120000);
});
