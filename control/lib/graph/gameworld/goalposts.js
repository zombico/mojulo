/**
 * THE FIRST SESSION'S GOALPOSTS — what a good first session leaves, so the making has something to measure against. A
 * game is not done at the end of a session; at the end of a good first one these hold. Each is read from what the book
 * already says (its chapters' states, its main quest, its record), never asked for twice:
 *
 *   game         what game it is: its intent (and its core loop, read from it); a rail picked and no intent yet is
 *                partial, and its move the rail's own cube (rails.js railMoves)
 *   shape        how long it is, where it is set, where the story takes it: the main quest and the world
 *   look         the hero's look and the world's (the cast and the foes when there are any)
 *   play         how it feels to play, and the hero's powers
 *   plan         a plan of what to build: the main quest's beats, its first one buildable, nothing blocking the build
 *   first-plan   a plan of the first level: the first beat's level, written (or laid) and settled
 *   first-level  the first level made and proved by the machine gate, each of its stages; played, the creator's to say
 *                (the eyes gate)
 *
 * Each is met, partial or open, with what it says and, open, the question only the creator answers; `next` is the first
 * not met, with the chapter to work and the move to make. It is where the next session picks up, read from the recipe.
 *
 *   GOALPOSTS                     the table: { id, says, ask, chapter }
 *   goalposts({ world, chapters, parts, mainQuest, made, compile }) → { posts, met, of, next } | null (all met: nothing to say)
 *     chapters    the readout's chapter book ([{ id, state }]); parts its review parts ([{ id, status }])
 *     mainQuest   the readout's main quest report (its plays), or null
 *     made        the record (made.js); compile the pre-compile check, when one ran
 *     playthrough a check's playthrough readout, when one ran ({ levels: [{ level, pass }] }): a stage it won is proved
 *     reqs        the ledger's level reqs ([{ id, unit, status, does, receipt }], reqs.js): with one for the first level,
 *                 goalposts 6 and 7 are its: the plan met once its proposal is kept with its decisions cited, the level
 *                 met once it is received (the machine gate) or accepted; each partial one says the req's failing
 *                 checks, and its move is the req's next
 *
 *   leadNext(next, posts, { mode, quick, made }) → next
 *     the readout's `next` with the first open goalpost's question in it as a step ({ step: 'goalpost', id, ask, … }),
 *     so the list and the goalposts say the same move. A build is cheap, so it is never held back; what changes is
 *     what leads. A game not built yet: a gated world's question goes before its run, an autonomous one's right after
 *     it (it was asked to be made). A game built with design goalposts open is a DRAFT: the question leads, the play
 *     step and the share step say `draft`, and sharing waits behind them. The last goalpost (the first level made and
 *     proved) is the build's own, so there the run leads as before. A world whose creator BROUGHT material (`brought`)
 *     is asked first like a gated one, whatever its mode. A QUICK game is what was asked for, so nothing leads it and
 *     nothing is a draft; once it is built the question rides last (`grow`): how one level becomes their game.
 *   producerSteps(world, { stored? }) → the producer's steps before the goalposts: intake, rail, lock, brief, each with
 *     its one question; producerSays(next) → { seat, ask, step, holds }: the one question this turn asks
 *   startReadout(world) → { readout: 'start', … }
 *     a book with no level yet cannot be stored; the door answers this instead of refusing: every goalpost with its
 *     question, the producer's intake step first, nothing built. The designed path's first call, as cheap as a quick one.
 *     (design_game adds the platformer's rail to it, platformer-game.js platformerStart, where the book points at one)
 *
 * Pure.
 */
import { railMoves, railReport, nearestRails, notYetFor } from './rails.js';
import { resolveGmn, LABOURS, MOTIVATIONS } from './gmn.js';

export const GOALPOSTS = Object.freeze([
  { id: 'game', says: 'what game it is: its intent and its core loop', ask: 'what game is it? a genre to start from, what the player does again and again, and how it is run: yeoman, auteur or avant-garde', chapter: 'intent' },
  { id: 'shape', says: 'how long it is, where it is set, where the story takes it', ask: 'how long does it play, where is it set, and where does the story take the hero (an ending can wait)?', chapter: 'main-quest' },
  { id: 'look', says: 'the hero\'s look and the world\'s (the cast and the foes when there are any)', ask: 'who is the hero, and how is the world drawn?', chapter: 'hero' },
  { id: 'play', says: 'how it feels to play, and the hero\'s powers', ask: 'how should moving feel, and what can the hero do beyond moving?', chapter: 'actions' },
  { id: 'plan', says: 'a plan of what to build: the main quest\'s beats, its first one buildable, nothing blocking the build', ask: 'what are the acts (or chapters), and which beat is played first?', chapter: 'main-quest' },
  { id: 'first-plan', says: 'a plan of the first level: the first beat\'s level, written (or laid) and settled', ask: 'what happens in the first level, and does its page read right?', chapter: 'levels' },
  { id: 'first-level', says: 'the first level made and proved by the machine gate; played, the creator\'s to say', ask: 'play the first level: is it the game?', chapter: 'build' },
]);
const BY = Object.fromEntries(GOALPOSTS.map((g) => [g.id, g]));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// a chapter's state in the book: settled (approved or the machine gate's), written (no review of its own), open, advised
const stateOf = (chapters, id) => chapters.find((c) => c.id === id)?.state ?? 'empty';
const done = (st) => st === 'settled' || st === 'written';
const begun = (st) => st !== 'empty';

/** The goalposts as the book stands; null when every one is met (the first session's work is done). */
export function goalposts({ world = {}, chapters = [], parts: parts_ = [], mainQuest = null, made = {}, compile = null, reqs = [], playthrough = null } = {}) {
  const posts = [];
  // (a met goalpost is its id and its state; an open or partial one says what is missing, the question and the move)
  // (only the next one's move is said: it is the one to make now)
  const moves = {};
  // (a question something already answered is not asked again: a picked rail, a written brief change what is asked)
  const post = (id, status, why, move, ask) => { if (move) moves[id] = move; posts.push(status === 'met' ? { id, status } : { id, status, says: why ?? BY[id].says, ask: ask ?? BY[id].ask }); };
  const st = (id) => stateOf(chapters, id);
  // (a picked rail pre-answers two moves: the cube its game starts from, the feel it plays: rails.js)
  const rail = railMoves(world), picked = world.rail !== undefined && world.rail !== null;

  // 1 what game it is
  const intent = world.intent !== undefined || isObj(world.quick);
  post('game', intent ? 'met' : picked ? 'partial' : 'open', intent ? null : picked ? 'a rail is picked; no intent written yet' : 'no intent written: what game it is is read from the brief alone', rail.game ?? 'write intent (gameworld-intent), and the loop if the book does not say it',
    picked ? 'where does their game leave the template: its levels, its action, its hero, its world? and how is it run: yeoman, auteur or avant-garde' : undefined);

  // 2 its length, its setting, where its story goes
  const Q = isObj(world.mainQuest) ? world.mainQuest : null;
  const parts = Q ? Q.chapters ?? Q.acts ?? [] : [];
  const shaped = Q && Q.length !== undefined && parts.length > 0, set = done(st('world'));
  // (the Game Brief, gmn.js, has decided the stakes and the structure when it is written: the question left is its
  // length and whether its spine reads right, never the shape again)
  const B = (() => { try { const g = world.gameBrief; return isObj(g) ? g.resolved ?? (isObj(g.gmn) ? resolveGmn(g.gmn) : null) : null; } catch { return null; } })();
  const briefed = B && (B.labour || B.motivation) ? [B.motivation ? MOTIVATIONS[B.motivation].name : null, B.labour ? `${LABOURS[B.labour].name} (${B.structure.shape})` : null].filter(Boolean).join(', ') : null;
  post('shape', shaped && set ? 'met' : Q || set || briefed ? 'partial' : 'open',
    shaped && set ? null : [briefed && !Q ? `the brief decided ${briefed}; no main quest is written from it` : !Q ? 'no main quest' : Q.length === undefined ? 'the main quest says no length' : null, !set ? 'the world is not settled' : null].filter(Boolean).join('; '),
    briefed && !Q ? 'write the main quest from the brief\'s spine (the readout\'s intent.gameBrief; gameworld-main-quest): its length, its acts; settle the world' : 'write the main quest (gameworld-main-quest): its length, its acts or chapters; settle the world',
    briefed && !Q ? 'how long does it play, and does the brief\'s spine read right as its acts (an ending can wait)?' : undefined);

  // 3 the look
  // (an adopted hero is the creator's own row: its look is theirs already)
  const adopted = !!world.characters?.hero?.ref;
  const lookOpen = ['direction', 'hero', 'world'].filter((c) => !(adopted && c !== 'world') && !done(st(c)));
  const lookNote = begun(st('foes')) || begun(st('cast')) ? '' : ' (the cast and the foes when there are any)';
  post('look', !lookOpen.length ? 'met' : ['direction', 'hero', 'world'].some((c) => begun(st(c))) ? 'partial' : 'open', !lookOpen.length ? null : `${lookOpen.join(', ')} still open${lookNote}`, 'show the creator the character bible and the world\'s, and take their verdicts');

  // 4 play: the feel and the powers
  const playChapters = ['motion', 'actions'].map(st), felt = world.feel !== undefined && world.feel !== null;
  // (a game whose every level is a scroll stage plays as its stages say: the ship on the d-pad, its gears and its
  // arsenal, gameworld/scroll-stage/: its play is written by them, its hp, lives and pods its stage's words)
  const L0 = isObj(world.levels) ? Object.values(world.levels) : [], staged = L0.length > 0 && L0.every((L) => isObj(L?.airspace?.scroll));
  const playMet = staged || (playChapters.every(done) && felt);
  post('play', playMet ? 'met' : playChapters.some(begun) || felt ? 'partial' : 'open', playMet ? null : [...['motion', 'actions'].filter((c, i) => !done(playChapters[i])).map((c) => `${c} open`), ...(felt ? [] : ['no feel written'])].join('; '), (!felt && rail.play) || 'write the motion and the actions, and a feel (gameworld-feel)');

  // 5 the plan: the quest's beats, the first buildable, nothing blocking
  const first = parts[0]?.beats?.[0] ?? null;
  const firstBuilt = first && first.built !== false;
  const blocked = compile?.blockers?.length ?? 0;
  const planMet = Q && parts.length > 0 && firstBuilt && !blocked;
  post('plan', planMet ? 'met' : Q ? 'partial' : 'open', planMet ? null : !Q ? 'no main quest: no plan of what to build' : !firstBuilt ? 'the first beat is planned, not built: there is nothing to build first' : `${blocked} blocker${blocked === 1 ? '' : 's'} in the pre-compile check`, 'write the beats; read the build chapter (its pre-compile check and estimate)');

  // 6 the first level's plan: the first beat's level (or the world's first, with no quest), written or laid, settled
  const levels = isObj(world.levels) ? Object.keys(world.levels) : [];
  const firstLevel = (first && mainQuest?.plays?.[first.id]) ?? (Q ? null : levels[0] ?? null);
  const laid = firstLevel && !levels.includes(firstLevel);
  // (the ledger's req for the first level, when the director asked for it: reqs.js; its receipt is the machine's word)
  const R = firstLevel ? reqs.find((r) => r.unit === `level:${firstLevel}`) ?? null : null;
  const failing = (ids) => (R?.receipt?.checks ?? []).filter((c) => ids.includes(c.check) && !c.holds).map((c) => `${c.check}: ${c.says}`);
  const worked = R && (R.status === 'received' || R.status === 'accepted' || !failing(['proposal', 'cited']).length);
  // (its own review part: approved, or settled by the machine gate in autonomous mode; a level with no part is settled)
  const part = parts_.find((p) => p.id === `level:${firstLevel}`), levelOpen = !!part && part.status !== 'approved' && part.status !== 'auto';
  const planOfFirst = firstLevel && !laid && !levelOpen;
  if (R) post('first-plan', worked ? 'met' : 'partial', worked ? null : `${R.id} (${R.status}): ${failing(['proposal', 'cited']).join('; ')}`, `${R.id}: ${R.does}`);
  else post('first-plan', planOfFirst ? 'met' : firstLevel ? 'partial' : 'open', planOfFirst ? null : !firstLevel ? 'no first level yet' : laid ? `the first level '${firstLevel}' is laid at the next run` : `the first level '${firstLevel}' is not settled`, firstLevel ? `show the creator the level's page (level:${firstLevel}) and take their verdict` : 'name the first beat\'s level');

  // 7 the first level: every stage of it made and proved (machine); played, the creator's. A level is its stages (a trail,
  // then a climb: level-<id>-0, -1 …), so the first level is proved only when each of its stages is
  const stages = firstLevel ? Object.keys(made).filter((k) => k.startsWith(`level-${firstLevel}-`)).sort() : [];
  const walks = stages.map((k) => made[`audit-${k}`] ?? null);
  const unwalked = stages.filter((k, i) => !walks[i]), failed = walks.filter((a) => a && a.verdict?.completable !== true);
  // (a level played through by the scripted player, a check's `playthrough`: each of its stages won by the basic one and
  // not by the still one is proved as a walked one is; a street has no walk, so this is its proof)
  const played = new Map((playthrough?.levels ?? []).map((l) => [l.level, l.pass === true]));
  const playedAll = stages.length > 0 && stages.every((k) => (made[`audit-${k}`]?.verdict?.completable === true) || played.get(k) === true);
  const proved = stages.length > 0 && ((!unwalked.length && !failed.length) || playedAll);
  const received = R && (R.status === 'received' || R.status === 'accepted');
  // (why a check walked none: the plan's first finding, else the first stage the walk cannot prove: level-plan.js)
  const notWalked = compile?.walk ? (compile.walk.plan?.[0]?.says ?? compile.walk.unwalked?.[0]?.why ?? null) : null;
  if (R) post('first-level', received ? 'met' : 'partial', received ? null : `${R.id} (${R.status}): ${failing(['critics', 'laws', 'probe']).join('; ') || 'not received yet'}`, `${R.id}: ${R.does}`);
  else post('first-level', proved ? 'met' : stages.length ? 'partial' : 'open',
    proved ? null : !stages.length ? 'not made yet' : failed.length ? `made; ${failed.length} of its ${stages.length} stage${stages.length === 1 ? '' : 's'} not proved (${failed[0].verdict.note})` : `made, ${unwalked.length} of its ${stages.length} stage${stages.length === 1 ? '' : 's'} not yet walked: ${notWalked ?? 'run with check: true'}`,
    stages.length ? 'run with check: true, then hand the creator the play link' : 'prove its chapter (design_game { ref, chapter: \'levels\', run: true }), then run');

  const met = posts.filter((p) => p.status === 'met').length;
  if (met === posts.length) return null;
  const n = posts.find((p) => p.status !== 'met');
  // (the first level's goalposts, when the ledger works it, are its req's: the next move is the req's)
  const viaReq = R && (n.id === 'first-plan' || n.id === 'first-level');
  return { met, of: posts.length, posts, next: { goalpost: n.id, chapter: BY[n.id].chapter, ...(moves[n.id] ? { move: moves[n.id] } : {}), ...(viaReq ? { req: R.id } : {}) } };
}

// the steps that keep their lead over a goalpost: where it is seen, the ledger's open req, the creator's open verdicts
const LEADS = new Set(['workshop', 'req', 'review', 'ask', 'intake', 'rail', 'lock', 'brief', 'hand-off']);
/** The readout's `next` with the first open goalpost's question placed in it (the doc above). */
export function leadNext(next = [], posts = null, { mode = 'gated', quick = false, made = false, brought = false } = {}) {
  if (!posts || posts.next?.goalpost === 'first-level' || (quick && !made)) return next;
  const n = posts.posts.find((p) => p.id === posts.next.goalpost);
  const step = { step: 'goalpost', id: n.id, met: posts.met, of: posts.of, ask: n.ask, chapter: posts.next.chapter, ...(posts.next.move ? { move: posts.next.move } : {}), ...(quick ? { grow: true } : made ? { draft: true } : {}), card: 'gameworld-next' };
  if (quick) return [...next, step];
  const head = [], rest = [...next];
  while (rest.length && LEADS.has(rest[0].step)) head.push(rest.shift());
  if (made) {
    const draft = (s) => (s.step === 'play' || s.step === 'share' ? { ...s, draft: true } : s);
    return [...head, step, ...rest.filter((s) => s.step !== 'share').map(draft), ...rest.filter((s) => s.step === 'share').map(draft)];
  }
  const at = mode === 'autonomous' && !brought ? rest.findIndex((s) => s.step === 'run') + 1 : 0;
  return [...head, ...rest.slice(0, at), step, ...rest.slice(at)];
}

/** What a draft's share offer says in place of "the game is complete" (share-offer.js `ask`). */
export const draftAsk = (posts) => `A draft, not the game yet: ${posts.met} of ${posts.of} first-session goalposts met. Show it (the play step), then ask the next goalpost's question (next: goalpost). Share it when the creator asks; never export unasked.`;

// ══════════ the producer's steps: what is asked before the goalposts, one question a turn ══════════

const INTAKE_ASK = 'do you have drawings, plans or documents for this game?';
const wordsOf = (world) => [typeof world.brief === 'string' ? world.brief : world.brief?.prompt, world.name].filter((w) => typeof w === 'string').join(' ');

/**
 * The producer's steps for a book as it stands (the client talks to the producer; the producer hands the director the
 * work): the intake while nobody has asked, then the RAIL placed (the nearest templates its words point at, and any
 * type not made yet, said before anything is built), the pitch LOCKED once the person has heard it back, and for a
 * designed game the Game BRIEF. Each carries the one question it asks. `stored`: the book is a row already.
 */
export function producerSteps(world = {}, { stored = false } = {}) {
  const steps = [];
  const pitch = (() => { try { return railReport(world); } catch { return null; } })();
  if (!stored && world.intake === undefined) steps.push({ step: 'intake', ask: INTAKE_ASK, card: 'gameworld-producer' });
  if (!pitch) {
    if (!stored) {
      const near = nearestRails(wordsOf(world)), notYet = notYetFor(wordsOf(world));
      steps.push({ step: 'rail', ask: 'what kind of game is it, and how big: one level, or a game of several with a hero and a world of their own?', ...(near.length ? { nearest: near } : {}), ...(notYet.length ? { notYet } : {}), move: 'place it on a rail and call its size (gameworld-rails), then write rail: { from, size }', card: 'gameworld-rails' });
    }
    return steps;
  }
  if (!pitch.locked) steps.push({ step: 'lock', ask: `said back: their game, started from ${pitch.name}; what it keeps, where it departs, what the template does not do yet. Is this the game?`, move: stored ? 'with their yes, write /rail/locked: true' : 'with their yes, write rail.locked: true: the rail\'s starter first level is laid and the pitch is stored (nothing is built)', card: pitch.card });
  if ((pitch.size ?? 'designed') === 'designed' && world.gameBrief === undefined && !world.quick) steps.push({ step: 'brief', ask: 'why does the hero go on, and what does the game ask of the player?', card: 'gameworld-brief' });
  return steps;
}

/** The producer's word on a readout: the seat, and the ONE question this turn asks (the rest of `next` waits). */
export function producerSays(next = []) {
  const lead = next.find((s) => typeof s.ask === 'string');
  return lead ? { seat: 'producer', ask: lead.ask, step: lead.step, holds: 'one question a turn: say this, wait for the answer, keep the rest of `next` and the chapters\' detail for the director' } : null;
}

/** The designed path's first call (the doc above): a book with no level yet, answered with what to ask. Not stored. */
export function startReadout(world = {}) {
  const posts = goalposts({ world, chapters: [] });
  const n = posts.posts.find((p) => p.id === posts.next.goalpost);
  // (the pitch, when a rail is picked: said back, with the rail's sheet to pull; a malformed one is the door's to refuse)
  const pitch = railReport(world);
  // (the producer's steps lead, each with its one question: the intake, the rail, the lock, the brief; then the goalpost)
  const next = [...producerSteps(world), { step: 'goalpost', id: n.id, met: posts.met, of: posts.of, ask: n.ask, chapter: posts.next.chapter, card: 'gameworld-next' }];
  return {
    ok: true, readout: 'start', stored: false,
    says: 'Nothing is stored or built yet: a book begins with its first level. You are the PRODUCER here: ask one question a turn (`producer.ask`), what the creator brought first (intake), then place the game on a rail and call its size (gameworld-rails), say the pitch back and lock it, then each open goalpost\'s question. When the first level can be named, write the world with its `levels` (gameworld-guide), or lay a first reading from a sentence (`compose: { prompt }`) and edit it. A build is fast: build to show a draft, then go on asking.',
    ...(pitch ? { rail: pitch } : {}),
    goalposts: posts,
    producer: producerSays(next),
    next,
    cards: ['gameworld-guide', 'gameworld-studio', 'gameworld-producer', ...(pitch ? [pitch.card] : ['gameworld-rails'])],
  };
}
