// animation-games combo verify: 3- and 5-hit strings (fists and a sword) and hitstun in the four registers; PASS/FAIL
// per concept, and the notes the gate measures but does not judge. The machine gate only.
//   node scripts/spikes/animation-games/combo-verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const K = await import('./combo.mjs');

const cast = process.argv[2] ?? 'male';
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const REG = Object.keys(K.COMBO_REGISTERS), STR = Object.keys(K.STRINGS);
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (s, m) => console.log(`note  ${s}  ${JSON.stringify(m)}`);

const C = {}, G = {};
for (const s of STR) for (const r of REG) { C[`${s} ${r}`] = K.comboRun(R, { string: s, register: r }); G[`${s} ${r}`] = K.comboSignature(C[`${s} ${r}`]); }
const g = (s, r) => G[`${s} ${r}`];
console.log('\nverdict per hit (hit · blocked · immune · whiff), the stun each landed hit left (s), and the frames of advantage the next move had');
console.table(Object.fromEntries(Object.entries(G).map(([k, x]) => [k, { true: `${x.trueCombo}/${x.of}`, verdicts: x.verdicts.join(' '), stuns: x.stuns.map((v) => v ?? '–').join(' '), advantage: x.advantages.map((v) => v ?? '–').join(' '), seconds: x.seconds, victim: x.victimTravel, lying: x.lying }])));
console.log();

// ── hitstun: the law every register keeps ──
const law = []; for (const [k, c] of Object.entries(C)) c.hits.forEach((h, j) => { const nx = c.hits[j + 1]; if (h.verdict === 'hit' && nx && ['hit', 'blocked'].includes(nx.verdict)) law.push([k, j, h.advantage, nx.verdict]); });
check('a hit links exactly when it lands inside the last hit\'s stun: the next is a hit when the advantage is ≥ 0, blocked when it is < 0', law.length > 0 && law.every(([, , adv, v]) => (adv >= 0) === (v === 'hit')), law.filter(([, , adv, v]) => (adv >= 0) !== (v === 'hit')));
check('every move\'s striking point lands where the move puts it at its contact, chained and cancelled (< 1 mm)', Object.values(G).every((x) => x.pointErr < 0.001), Math.max(...Object.values(G).map((x) => x.pointErr)));

// ── realistic ──
check('realistic: the stun is the body\'s (0.22 s of reaction + the flinch the blow causes); a jab string sits on its edge (every advantage within ±3 frames: it lands or drops by a frame, by the body)', ['fist3', 'fist5'].every((s) => g(s, 'realistic').trueCombo >= 2 && g(s, 'realistic').advantages.filter((a) => a != null).every((a) => Math.abs(a) <= 3)) && g('fist5', 'realistic').stuns.filter((t) => t != null).every((t) => t > 0.22 && t < 0.62),
  { advantage: g('fist5', 'realistic').advantages, stuns: g('fist5', 'realistic').stuns, verdicts: g('fist5', 'realistic').verdicts });
check('realistic: a sword is slower than a reaction — after the first cut the victim blocks', ['sword3', 'sword5'].every((s) => g(s, 'realistic').trueCombo === 1 && g(s, 'realistic').verdicts.slice(1).every((v) => v === 'blocked')), g('sword5', 'realistic').verdicts);

// ── action ──
check('action: the stun shrinks hit by hit (0.5 s × 0.85^(n−1)), the fist strings land whole and the advantage falls with it', ['fist3', 'fist5'].every((s) => g(s, 'action').trueCombo === g(s, 'action').of) && g('fist5', 'action').stuns.every((t, i, a) => !i || t < a[i - 1]) && g('fist5', 'action').advantages.slice(0, -1).every((a, i, arr) => !i || a < arr[i - 1]),
  { stuns: g('fist5', 'action').stuns, advantage: g('fist5', 'action').advantages });
check('action: the finisher launches — the string ends with the victim off its feet and lying, metres away', ['fist3', 'fist5', 'sword3'].every((s) => g(s, 'action').lying && g(s, 'action').victimTravel > 1), ['fist3', 'fist5', 'sword3'].map((s) => [g(s, 'action').victimTravel, g(s, 'action').lying]));
check('action: every landed hit freezes both bodies', Object.values(C).filter((c) => c.register === 'action').every((c) => c.hits.filter((h) => h.verdict === 'hit').every((h) => h.hitstop > 0)) && Object.values(C).filter((c) => c.register === 'action').every((c) => c.hits.filter((h) => h.verdict !== 'hit').every((h) => h.hitstop === 0)));
const statics = K.comboSignature(K.comboRun(R, { string: 'sword5', register: 'action', stun: () => 0.5 }));
check('action: the decay is what drops the sword\'s 5th hit (its finisher blocked by a frame); a stun that does not decay lands it whole', g('sword5', 'action').trueCombo === 4 && g('sword5', 'action').verdicts[4] === 'blocked' && statics.trueCombo === 5, { decaying: g('sword5', 'action').advantages, static: statics.verdicts });

// ── platformer and pinball: no combo ──
check('platformer: no stun — a hit, then mercy invincibility (1 s): the hits inside it pass through, a hit after it lands fresh', ['fist3', 'fist5'].every((s) => g(s, 'platformer').trueCombo === 1 && g(s, 'platformer').verdicts.slice(1, 3).every((v) => v === 'immune')) && g('fist5', 'platformer').verdicts[4] === 'hit',
  g('fist5', 'platformer').verdicts);
check('pinball: no stun — the first hit ricochets the victim out of reach (> 10 m) and the rest whiff', STR.every((s) => g(s, 'pinball').trueCombo === 1 && g(s, 'pinball').verdicts.slice(1).every((v) => v === 'whiff') && g(s, 'pinball').victimTravel > 10), STR.map((s) => g(s, 'pinball').victimTravel));

// ── footwork ──
check('the attacker steps in to keep its range (a move short of the chest slides it on, half a step at most)', Object.values(C).every((c) => c.stepped <= 0.45 * c.hits.length + 1e-6) && g('fist5', 'action').steps > 0, { action: [g('fist5', 'action').steps, g('fist5', 'action').stepped], realistic: [g('fist5', 'realistic').steps, g('fist5', 'realistic').stepped] });

// ── determinism ──
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
check('a string is byte-identical run to run', ['action', 'platformer'].every((r) => hash(K.comboRun(R, { string: 'fist3', register: r })) === hash(C[`fist3 ${r}`])));

note('a string\'s length in seconds, by register (the cancel and the entry decide it: action chains, platformer plays each move out)', Object.fromEntries(STR.map((s) => [s, Object.fromEntries(REG.map((r) => [r, g(s, r).seconds]))])));
console.log(`\n${fails ? `${fails} FAILED` : 'all held'} (machine gate; the eyes gate is open: run combo-preview.mjs and look)`);
process.exitCode = fails ? 1 : 0;
