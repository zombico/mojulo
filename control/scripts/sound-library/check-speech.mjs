#!/usr/bin/env node
/**
 * The sound library's speech check: every take of a card that is not a voice, heard by ElevenLabs' speech-to-text, so a
 * take that came back saying words (the sound model reads a prompt aloud as readily as it makes the sound) is found and
 * kept out of the library.
 *
 *   node scripts/sound-library/check-speech.mjs --cards <sets> --out <dir> [--budget <credits>] [--only id,id]
 *
 * Writes <out>/speech.json: { <take's sha256>: { card, take, text, words } }, each take heard once (a re-run hears only
 * the new ones); every call's cost goes to <out>/ledger.jsonl as `kind: 'speech-check'`, inside the same budget as the
 * generator's. A take SPEAKS when it holds a word of two or more letters the model is sure of (logprob above -1);
 * condition.mjs leaves a speaking take out of a card that is not `voice: true`. Prints the takes that speak.
 *
 * The key as generate.mjs takes it (ELEVENLABS_API_KEY, else a proxy's; NODE_USE_ENV_PROXY=1 behind one).
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCards } from './cards/index.js';

const API = 'https://api.elevenlabs.io/v1/speech-to-text';

function args(argv) {
  const a = { cards: null, out: null, budget: Infinity, only: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--cards') a.cards = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--budget') a.budget = Number(argv[++i]);
    else if (k === '--only') a.only = new Set(argv[++i].split(','));
    else throw new Error(`check-speech: unknown argument ${k}`);
  }
  if (!a.out || !a.cards) throw new Error('check-speech: --cards <sets> and --out <dir> are required');
  return a;
}

/** the words a transcript is sure of: two letters or more, logprob above -1 */
export const sureWords = (words) => (words || []).filter((w) => w.type === 'word' && /[a-z]{2,}/i.test(w.text) && (w.logprob ?? 0) > -1).map((w) => w.text.trim());

async function main() {
  const a = args(process.argv.slice(2));
  const cards = (await loadCards(a.cards)).filter((c) => !c.voice && (!a.only || a.only.has(c.id)));
  const ledgerFile = path.join(a.out, 'ledger.jsonl'), speechFile = path.join(a.out, 'speech.json');
  const heard = existsSync(speechFile) ? JSON.parse(readFileSync(speechFile, 'utf8')) : {};
  const ledger = existsSync(ledgerFile) ? readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  let spent = ledger.reduce((t, e) => t + (e.cost || 0), 0), calls = 0;
  const key = process.env.ELEVENLABS_API_KEY || 'proxy-injected';
  if (key === 'proxy-injected' && (process.env.HTTPS_PROXY || process.env.https_proxy) && process.env.NODE_USE_ENV_PROXY !== '1') throw new Error('check-speech: run with NODE_USE_ENV_PROXY=1 behind the proxy');
  for (const c of cards) {
    const dir = path.join(a.out, 'takes', c.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.mp3')).sort()) {
      const file = path.join(dir, f), bytes = readFileSync(file), sha = createHash('sha256').update(bytes).digest('hex');
      if (heard[sha]) continue;
      if (spent + 2 > a.budget) { console.log(`check-speech: stopping at the budget (${spent} spent)`); writeFileSync(speechFile, `${JSON.stringify(heard, null, 1)}\n`); return; }
      const form = new FormData();
      form.append('model_id', 'scribe_v1');
      form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), f);
      const res = await fetch(API, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
      if (!res.ok) throw new Error(`check-speech: ${c.id}/${f} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const d = await res.json(), cost = Number(res.headers.get('character-cost')) || 1;
      heard[sha] = { card: c.id, take: parseInt(f), text: d.text || '', words: sureWords(d.words) };
      appendFileSync(ledgerFile, `${JSON.stringify({ kind: 'speech-check', card: c.id, take: parseInt(f), cost, sha256: sha })}\n`);
      spent += cost; calls++;
    }
  }
  writeFileSync(speechFile, `${JSON.stringify(heard, null, 1)}\n`);
  const speaking = Object.values(heard).filter((h) => h.words.length);
  console.log(`check-speech: ${calls} takes heard (${spent} credits in the ledger); ${speaking.length} speak:`);
  for (const h of speaking.sort((x, y) => (x.card < y.card ? -1 : 1))) console.log(`  ${h.card} #${h.take}: "${h.text.trim()}"`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
