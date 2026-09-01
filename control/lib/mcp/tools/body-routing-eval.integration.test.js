// Body-grounded routing eval — gate 2b of forward-context-grammar.plan.md.
//
// The sibling retrieval eval (routing-cards/routing-eval.integration.test.js,
// gate 2a) tests the semantic_search hop over routing cards. This gate tests
// the hop that plan actually changes: a model READS the forward_context studio
// body and names the entry tool for a user phrasing (routing rows), or names
// the correct next move mid-session (behavioral rows: revise-vs-remint,
// advisory posture, needs-vocab hop, modeler-lingo guard, ask-one-question).
//
// Mechanics: each case is one headless `claude -p` subprocess (the operator's
// own logged-in CLI — no API-key plumbing; model pinned via
// MOJULO_BODY_EVAL_MODEL, default sonnet). Calls run from the OS tmpdir so the
// nested session does NOT load this repo's CLAUDE.md (repo knowledge would
// contaminate the eval). LLM-in-the-loop: slow (~2 min) and billed, so DOUBLY
// gated — set MOJULO_BODY_EVAL=1 to run; auto-skips when the claude CLI is
// absent. Directional harness, not CI: one model, modest N, no host context.
//
// Comparing bodies: by default the eval reads the LIVE studio body
// (buildForwardContextBody({mode:'studio'})). Point MOJULO_BODY_EVAL_BODY_FILE
// at a candidate body file (e.g. the grammar draft) to score it against the
// same fixture — the recorded-baseline vs candidate comparison IS the phase-1
// merge gate; the in-test floor below is only a regression net.
//
// Scoring: routing rows assert an aggregate floor. Behavioral rows are
// REPORT-ONLY (logged + written to the report JSON) — they diagnose, they
// don't gate; the needs-vocab row in particular is EXPECTED to fail until
// pointer discipline lands on creative-tool error copy (see the plan's
// proxy-pilot section).

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildForwardContextBody } from './context.js';
import { FIXTURE, COLLISION_FIXTURE } from '../routing-cards/routing-eval.fixture.js';

const enabled = process.env.MOJULO_BODY_EVAL === '1';
const cliPresent = (() => {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
})();

const MODEL = process.env.MOJULO_BODY_EVAL_MODEL || 'sonnet';
const CONCURRENCY = 6;
const ROUTING_FLOOR = 0.75; // regression net only — the real gate is baseline vs candidate
const REPORT_PATH = join(tmpdir(), 'mojulo-body-eval-report.json');

const body = process.env.MOJULO_BODY_EVAL_BODY_FILE
  ? readFileSync(process.env.MOJULO_BODY_EVAL_BODY_FILE, 'utf8')
  : buildForwardContextBody({ mode: 'studio' });

// Tools the first-tool grader recognizes in a reply. Superset of fixture
// expectations plus plausible confusions (drawers, verbs-mistaken-as-tools
// land as null → miss).
const KNOWN_TOOLS = new Set([
  ...FIXTURE.map(([, t]) => t),
  ...COLLISION_FIXTURE.map(([, t]) => t),
  'update_sketch', 'update_beats', 'edit_solid', 'get_beats', 'annotate_beats', 'diff_beats',
  'create_game_project', 'semantic_search', 'get_creative_toolset', 'get_sketch_vocab',
  'get_view_vocab', 'get_beats_vocab', 'get_voice_vocab', 'get_solid_vocab',
  'get_worked_example', 'get_tool_index', 'get_register_kit', 'get_substrate',
  'forge_publications', 'gather', 'cook', 'export_model', 'export_game', 'export_beats',
  'bake_sprite_sheet', 'translate_modeler_lingo', 'verify_machina', 'forward_context',
  'capture_reference', 'mint_diagram', 'create_cover', 'create_sprite_sheet',
]);

// Body-eval grain differs from card grain: the shared fixture's expected tool
// is the CARD-level entry, but from the body some phrasings have a second
// correct first-move (the reference card's photo → part-graph flow LANDS in
// mint_solid; naming reference_protocol first is right, not a miss). Extra
// accepted tools per phrasing — additive to the fixture expectation.
const ACCEPT_OVERRIDES = new Map([
  ['turn this concept art of an espresso machine into a 3d model piece by piece', ['reference_protocol']],
  ['rebuild my drawing of a bicycle as a real 3d model one segment at a time', ['reference_protocol']],
]);

const routingPrompt = (phrasing) => `You are an agent driving the mojulo MCP server on the operator's machine. You have read this orientation:

<orientation>
${body}
</orientation>

The user says: "${phrasing}"

Which mojulo tool do you call FIRST for this ask? Reply with ONLY the tool name, nothing else. Do not invoke any tools — answer in plain text.`;

// Behavioral rows — the moves the grammar plan makes expressible. Transcript-
// style: the model is mid-session and must name the next move.
const BEHAVIORAL = [
  {
    id: 'revise-vs-remint',
    transcript: `Earlier this session you minted a tune: create_beats(...) → ref 'forest-theme', playable at /beats/forest-theme. The user says: "love it, but make it slower."`,
    question: `What is your next tool call?`,
    // get_beats first is the documented flow (get_beats → update_beats) —
    // correct; only re-minting via create_beats is the failure being probed.
    grade: (out) => /(update_beats|get_beats)/i.test(out) && !/create_beats/i.test(out),
    expects: 'update_beats (or get_beats first) on the SAME ref — never re-mint to change a thing',
  },
  {
    id: 'advisory-not-failure',
    transcript: `The user asked you to make their minted wine glass (ref 'wine-glass') printable. You called export_model({ref:'wine-glass'}) and it replied: "Export complete with findings: wall thickness 0.4mm is below the 0.8mm recommended minimum for FDM printing; 2 non-manifold edges were auto-repaired. STL written to exports/wine-glass.stl (mm, z-up)."`,
    question: `What do you do next?`,
    // Pass = report the shipped file + findings (offering a fix afterwards is
    // fine); fail = LEAD with a repair call, treating the advisory as failure.
    grade: (out) =>
      !/^\s*`?(export_model|edit_solid|mint_solid|update_sketch)/i.test(out.trim()) &&
      /(stl|finding|wall|ready|written|print|ship)/i.test(out),
    expects: 'ship the file + surface the findings — advisory is not failure',
  },
  {
    id: 'needs-vocab-hop',
    // Reply text mirrors sketch-mint.js's REAL error copy since pointer
    // discipline landed (2026-09-01) — the eval measures the shipped system.
    transcript: `The user wants a tap-through motion comic. You called create_sketch({kind:'motion-comic', manifest:{panels_list:[/* ... */]}}) and it replied: "Invalid manifest: unknown field 'panels_list' — manifest manual: get_sketch_vocab({ id: 'motion-comic' })."`,
    question: `What is your next tool call?`,
    grade: (out) => /(get_sketch_vocab|sketch_vocab|semantic_search)/i.test(out),
    expects: 'read the sketch vocab before retrying (the reply now carries the pointer)',
  },
  {
    id: 'modeler-lingo-guard',
    transcript: `The user says: "can you retopo my blockout of the castle and kitbash in some towers?"`,
    question: `What is your next tool call?`,
    grade: (out) => /translate_modeler_lingo/i.test(out),
    expects: 'translate_modeler_lingo (3D-modeler dialect → mojulo terms)',
  },
  {
    id: 'ask-one-question',
    transcript: `The user says: "do something with these bike photos I'm showing you."`,
    question: `What do you do next — a tool call, or something else?`,
    grade: (out) => /\?/.test(out) && !/^`?(mint_solid|create_sketch|reference_protocol)\b/i.test(out.trim()),
    expects: 'underdetermined form — ask ONE routing question before minting',
  },
];

const behavioralPrompt = (c) => `You are an agent driving the mojulo MCP server on the operator's machine. You have read this orientation:

<orientation>
${body}
</orientation>

Session so far: ${c.transcript}

${c.question} Reply in at most two lines of plain text: either the single next tool call you would make (tool name + key args), or what you would say to the user. Do not actually invoke any tools — just state the move.`;

function callClaude(prompt) {
  return new Promise((resolve) => {
    const child = execFile(
      'claude',
      ['-p', '--model', MODEL, '--output-format', 'text'],
      { timeout: 120000, maxBuffer: 1024 * 1024, cwd: tmpdir() },
      (err, stdout) => resolve({ out: (stdout || '').trim(), err: err ? String(err.message) : null }),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function pool(jobs) {
  const results = new Array(jobs.length);
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const idx = i++;
      results[idx] = { ...jobs[idx], ...(await callClaude(jobs[idx].prompt)) };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

const firstTool = (out) => {
  const tokens = out.toLowerCase().match(/[a-z_]{3,}/g) || [];
  return tokens.find((t) => KNOWN_TOOLS.has(t)) || null;
};

describe.skipIf(!enabled || !cliPresent)(
  'body-grounded routing eval (gate 2b — LLM-in-the-loop, MOJULO_BODY_EVAL=1)',
  () => {
    it(
      'the studio body routes the shared fixture + reports the behavioral moves',
      async () => {
        const routingRows = [...FIXTURE, ...COLLISION_FIXTURE];
        const jobs = [
          ...routingRows.map(([phrasing, expected]) => ({
            kind: 'routing',
            phrasing,
            expected,
            prompt: routingPrompt(phrasing),
          })),
          ...BEHAVIORAL.map((c) => ({ kind: 'behavioral', case: c, prompt: behavioralPrompt(c) })),
        ];
        const results = await pool(jobs);

        const routing = results.filter((r) => r.kind === 'routing');
        const misses = [];
        for (const r of routing) {
          const got = firstTool(r.out);
          const accepted = new Set([r.expected, ...(ACCEPT_OVERRIDES.get(r.phrasing) || [])]);
          if (!accepted.has(got)) {
            misses.push({ phrasing: r.phrasing, expected: r.expected, got, raw: r.out.slice(0, 160) });
          }
        }
        const score = (routing.length - misses.length) / routing.length;

        const behavioral = results
          .filter((r) => r.kind === 'behavioral')
          .map((r) => ({
            id: r.case.id,
            pass: r.case.grade(r.out),
            expects: r.case.expects,
            raw: r.out.slice(0, 240),
          }));

        const report = {
          when: new Date().toISOString(),
          model: MODEL,
          bodySource: process.env.MOJULO_BODY_EVAL_BODY_FILE || 'live studio body',
          bodyChars: body.length,
          routing: { score, correct: routing.length - misses.length, total: routing.length, misses },
          behavioral,
        };
        writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
        // eslint-disable-next-line no-console
        console.log(`[body-eval] report → ${REPORT_PATH}\n${JSON.stringify(report, null, 2)}`);

        expect(
          score,
          `routing score ${score.toFixed(2)} below floor ${ROUTING_FLOOR}; misses:\n${misses
            .map((m) => `"${m.phrasing}" wanted ${m.expected} got ${m.got} — ${m.raw}`)
            .join('\n')}`,
        ).toBeGreaterThanOrEqual(ROUTING_FLOOR);
      },
      900_000,
    );
  },
);
