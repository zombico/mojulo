#!/usr/bin/env node
/**
 * The sound library's generator: generation cards in, recorded takes out, under a credit budget.
 *
 *   node scripts/sound-library/generate.mjs --cards spike --out <dir> [--budget 5000] [--only id,id] [--dry]
 *
 * Maintainer tooling, not shipped (not in package.json `files`) and never called by mojulo's runtime: mojulo itself
 * calls no generation API. Each take lands at <out>/takes/<card>/<n>.mp3; a take that exists is skipped, so a re-run
 * only fills what is missing. Every call is appended to <out>/ledger.jsonl ({ card, take, cost, bytes, sha256, seconds,
 * request }), the cost read from the response's `character-cost` header; the budget is the ledger's sum, and a call
 * whose estimate would cross it is not made. `--dry` prints the plan and its estimate and calls nothing.
 *
 * The key: ELEVENLABS_API_KEY, else the placeholder `proxy-injected` for a session whose network proxy adds the
 * real key to requests to api.elevenlabs.io (the header is overwritten there). Never write a key into a file. Node's
 * built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 (Node >= 22.21): without it a proxied session's
 * placeholder goes out as the key and comes back 401, so the script refuses to start in that case.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCards } from './cards/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://api.elevenlabs.io/v1/sound-generation';
const MODEL = 'eleven_text_to_sound_v3';
const FORMAT = 'mp3_44100_128';
const EST_PER_SECOND = 10;   // observed on v3 (a 0.5 s take cost 5); the ledger's real costs refine it

function args(argv) {
  const a = { cards: 'spike', out: null, budget: 5000, only: null, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry') a.dry = true;
    else if (k === '--cards') a.cards = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--budget') a.budget = Number(argv[++i]);
    else if (k === '--only') a.only = new Set(argv[++i].split(','));
    else throw new Error(`generate: unknown argument ${k}`);
  }
  if (!a.out) throw new Error('generate: --out <dir> is required (the takes are the operator\'s, never the repo\'s)');
  return a;
}

const readLedger = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

// a card's PROMPT, read before a credit is spent. The sound model reads a prompt as words to say as readily as a sound
// to make: a take asked for "an intruder spotted … over a radio" came back saying "No intruder spotted". So a card that is
// not a voice (`voice: true`: a guard's wordless grunt) names the SOUND (beeps, a klaxon, a synth hit, a door's hiss) and
// never a scene, a message or a sayer: none of these words, and no quoted words. A cue (`role: 'cue'`, a stinger: being
// spotted, an objective done) follows its prompt closely (prompt_influence 0.85 unless it says).
export const SPEECH_WORDS = /\b(radio|announcer|announcement|intercom|loudspeaker|speaker|narrat\w*|says?|saying|spoken|speech|voice ?over|dialog(ue)?|message|report(s|ed)?|spotted|reached|complete[ds]?|confirmed|warning that)\b|["“”]/i;
export function promptErrors(c) {
  if (c.voice) return [];
  const m = String(c.prompt).match(SPEECH_WORDS);
  return m ? [`${c.id}: '${m[0]}' invites a spoken take (name the sound, not the scene; a voice says voice: true)`] : [];
}
export const influenceOf = (c) => c.influence ?? (c.role === 'cue' ? 0.85 : 0.5);

function rate(ledger) {
  ledger = ledger.filter((e) => !e.kind);
  const s = ledger.reduce((t, e) => t + (e.seconds || 0), 0), c = ledger.reduce((t, e) => t + (e.cost || 0), 0);
  return s > 0 ? Math.max(EST_PER_SECOND, c / s) : EST_PER_SECOND;
}

async function take(card, key) {
  const body = { text: card.prompt, duration_seconds: card.seconds, prompt_influence: influenceOf(card), loop: !!card.loop, model_id: MODEL };
  const res = await fetch(`${API}?output_format=${FORMAT}`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`generate: ${card.id} → HTTP ${res.status}: ${bytes.toString('utf8').slice(0, 300)}`);
  const cost = Number(res.headers.get('character-cost'));
  return { bytes, cost: Number.isFinite(cost) ? cost : null, request: res.headers.get('request-id'), body };
}

async function main() {
  const a = args(process.argv.slice(2));
  const CARDS = await loadCards(a.cards);
  const cards = CARDS.filter((c) => !a.only || a.only.has(c.id));
  // (the API takes 0.5 to 30 seconds: a card outside them is refused here, before a credit is spent)
  const bad = cards.filter((c) => !(c.seconds >= 0.5 && c.seconds <= 30));
  if (bad.length) throw new Error(`generate: seconds must be 0.5..30: ${bad.map((c) => `${c.id} (${c.seconds})`).join(', ')}`);
  const said = cards.flatMap(promptErrors);
  if (said.length) throw new Error(`generate: a prompt that would be spoken:\n - ${said.join('\n - ')}`);
  const ledgerFile = path.join(a.out, 'ledger.jsonl');
  mkdirSync(a.out, { recursive: true });
  let ledger = readLedger(ledgerFile);
  let spent = ledger.reduce((t, e) => t + (e.cost || 0), 0);

  const todo = [];
  for (const c of cards) for (let n = 1; n <= c.takes; n++) {
    const file = path.join(a.out, 'takes', c.id, `${n}.mp3`);
    if (!existsSync(file)) todo.push({ c, n, file });
  }
  const est = todo.reduce((t, { c }) => t + c.seconds * rate(ledger), 0);
  console.log(`generate: ${cards.length} cards, ${todo.length} takes to make, ~${Math.round(est)} credits estimated; ${spent} spent of ${a.budget}`);
  if (a.dry) { for (const { c, n } of todo) console.log(`  ${c.id} #${n}  ${c.seconds}s${c.loop ? ' loop' : ''}  "${c.prompt}"`); return; }

  const key = process.env.ELEVENLABS_API_KEY || 'proxy-injected';
  if (key === 'proxy-injected' && (process.env.HTTPS_PROXY || process.env.https_proxy) && process.env.NODE_USE_ENV_PROXY !== '1') {
    throw new Error('generate: no ELEVENLABS_API_KEY and fetch would bypass the proxy that adds it; run with NODE_USE_ENV_PROXY=1');
  }
  let made = 0;
  for (const { c, n, file } of todo) {
    const next = c.seconds * rate(ledger);
    if (spent + next > a.budget) { console.log(`generate: stopping at the budget (${spent} spent, next ~${Math.round(next)})`); break; }
    const t = await take(c, key);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, t.bytes);
    const entry = { card: c.id, take: n, cost: t.cost, bytes: t.bytes.length, sha256: createHash('sha256').update(t.bytes).digest('hex'), seconds: c.seconds, model: MODEL, format: FORMAT, request: t.request, body: t.body };
    appendFileSync(ledgerFile, `${JSON.stringify(entry)}\n`);
    ledger.push(entry);
    spent += t.cost ?? Math.round(next);
    made++;
    console.log(`  ${c.id} #${n}  ${t.bytes.length} bytes  cost ${t.cost}  (spent ${spent})`);
  }
  console.log(`generate: ${made} takes made; ${spent} credits spent in the ledger`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
