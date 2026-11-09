/**
 * flow — a game's FLOW as data: what plays when, from the first screen to the credits. The game director's page (the
 * main agent's, beside intent, the main quest and the build), run by the flow runner in the play shell. The steps'
 * content stays with the departments that own it: screens are the interface's, cinematics the story's, levels the
 * worlds'. Pure: no page, no clock; the runner (play-shell.js) and the headless walk (walkFlow) both step it.
 *
 *   flow: {
 *     start: target,              the first step (a step, or alts: the opening on a first boot, else the title)
 *     home?: '<screen step>',     where quitting a level and resetting progress go (else the first screen past an attract)
 *     steps: { <id>: step },
 *   }
 *
 *   step, by kind:
 *     screen     { screen, on?: { <event>: target }, next?, idle?: { after: seconds, go: target } }
 *                a front screen, left by what the player picks there (its events: SCREEN_EVENTS); `next` stands for
 *                its one event; `idle` goes on by itself when the player leaves it alone (an attract loop)
 *     cinematic  { scene, stage, next, keep?, skip? }
 *                a scene (a story moment's id, or any scene the stage level has) played on that level's page
 *                (`stage`, asked of it by game-init params.__stage) with control held, left as the level says it
 *                ends (game-scene-end; at once when it has no such scene); `keep` hands the stage on to the level step after it, the page kept (the game-start
 *                animation: the prologue ends and the player has control); `skip: false` makes it unskippable
 *     level      { level: '<level ref>' | '$any', on: { won?, lost?, left?, door? } }
 *                a level, left by its outcome (won, lost, left) or a door; `$any` is the step any level plays in
 *     hold       { for?: seconds, until?: '<event>', next }   a beat, or a wait for an event
 *
 *   target: a step id | a special | [alt, …] (the first alt that resolves) where an alt is a target or
 *           { when: <guard>, go: target }
 *   specials (each resolves to a level, or to nothing, when the next alt is tried):
 *     $first     the first level                  $next      the level after this one, if it is open
 *     $again     this level again                 $continue  the save's continue level
 *     $picked    the level picked on the levels screen   $travel   where the exit the level was left by leads
 *     $door      where the door the level was left by leads
 *     $run       a new run, its first level       $run-next  the run's next level, while the run goes on
 *   guards:  complete   this clear first completed the game
 *            unseen     the step it goes to has never been entered in this save (an opening on the first boot)
 *
 *   FLOW_KINDS · FLOW_SCREENS · SCREEN_EVENTS · LEVEL_EVENTS · FLOW_SPECIALS · FLOW_GUARDS
 *   readFlow(flow, { levels, scenes?, where? })  → errors[] (teaching): shape, events, targets, reach, exits, loops
 *   defaultFlow(game)                            → the flow a play-shell game has always had (its front, its levels,
 *                                                  its run, its map, its final level), so a game that says none
 *                                                  plays as it did; with game.cinematics ({ opening?, prologue?,
 *                                                  ending?: { scene, stage } }) the story's placed in it
 *   buildFlowKernel()                            → { stepFlow, levelStep, homeOf, walkFlow }: self-contained, inlined
 *                                                  in the play shell by toString(); node uses the same
 *   stepFlow(flow, at, event, ctx)               → { step, level } the event leads to (null: nowhere)
 *   flowHome(flow)                               → the screen quitting and resetting go back to
 *   walkFlow(flow, events, ctx)                  → the steps a run of events visits (the headless walk); the level
 *                                                  last played carries through the steps that play none
 *   ctx: { level?, resolve(special, ctx) → level ref | null, guard(name, ctx) → bool }
 */
import { frontConfig } from './play-front.js';

export const FLOW_KINDS = Object.freeze(['screen', 'cinematic', 'level', 'hold']);
// the screens a play shell draws, and what the player can do on each
export const SCREEN_EVENTS = Object.freeze({
  attract: Object.freeze(['press']),
  title: Object.freeze(['play', 'continue', 'levels', 'options', 'credits']),
  levels: Object.freeze(['pick', 'back']),
  options: Object.freeze(['back']),
  credits: Object.freeze(['done']),
  end: Object.freeze(['done']),
  result: Object.freeze(['next', 'again', 'home']),
  'run-result': Object.freeze(['again', 'home', 'credits']),
});
export const FLOW_SCREENS = Object.freeze(Object.keys(SCREEN_EVENTS));
export const LEVEL_EVENTS = Object.freeze(['won', 'lost', 'left', 'door']);
export const FLOW_SPECIALS = Object.freeze(['$first', '$next', '$again', '$continue', '$picked', '$travel', '$door', '$run', '$run-next']);
export const FLOW_GUARDS = Object.freeze(['complete', 'unseen']);
// the story's cinematics a default flow places (gameworld/story.js GAME_SLOTS): before the title, after New Game, after
// the game's first full clear
export const FLOW_CINEMATICS = Object.freeze(['opening', 'prologue', 'ending']);

const KEYS = {
  screen: ['kind', 'screen', 'on', 'next', 'idle'],
  cinematic: ['kind', 'scene', 'stage', 'next', 'keep', 'skip'],
  level: ['kind', 'level', 'on'],
  hold: ['kind', 'for', 'until', 'next'],
};
const ID = /^[a-z][a-z0-9-]{0,40}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

// every exit a step has: [event, target] (a screen's or a level's events, `next`, an idle's go)
function exitsOf(s) {
  const out = [];
  if (isObj(s.on)) for (const [e, t] of Object.entries(s.on)) out.push([e, t]);
  if (s.next !== undefined) out.push(['next', s.next]);
  if (isObj(s.idle) && s.idle.go !== undefined) out.push(['idle', s.idle.go]);
  return out;
}
// the alts of a target, flattened: [{ to, when? }]
function altsOf(t) {
  return (Array.isArray(t) ? t : [t]).map((a) => (isObj(a) ? { to: a.go, when: a.when } : { to: a }));
}

/** A flow as written: every fault said, with what it should be. */
export function readFlow(flow, { levels = [], scenes = null, where = 'flow' } = {}) {
  if (!isObj(flow)) return [`${where} is { start, steps: { <id>: step } }: the game's flow, what plays when from the first screen to the credits`];
  const errors = [];
  for (const k of Object.keys(flow)) if (!['start', 'home', 'steps'].includes(k)) errors.push(`${where}.${k}: a flow is { start, home?, steps }`);
  if (!isObj(flow.steps) || !Object.keys(flow.steps).length) return [...errors, `${where}.steps is { <id>: step }, at least one (a step is a ${FLOW_KINDS.join(', ')})`];
  const steps = flow.steps, ids = Object.keys(steps), refs = new Set(levels);
  const startAlts = flow.start === undefined ? [] : altsOf(flow.start);
  if (!startAlts.length || !startAlts.every((a) => isStr(a.to) && steps[a.to] && (a.when === undefined || FLOW_GUARDS.includes(a.when)))) errors.push(`${where}.start names the first step (${ids.join(', ')}), or alts of them ([{ when: 'unseen', go: 'opening' }, 'title'])`);
  if (flow.home !== undefined && !(isStr(flow.home) && steps[flow.home] && steps[flow.home].kind === 'screen')) errors.push(`${where}.home names the screen quitting and resetting go back to (${ids.filter((id) => isObj(steps[id]) && steps[id].kind === 'screen').join(', ') || 'no screens'})`);

  // a target: a step, a special, or alts; checked where it stands
  const target = (t, at, event, from) => {
    if (t === undefined) return errors.push(`${at}: a target is a step (${ids.join(', ')}), a special (${FLOW_SPECIALS.join(', ')}), or [alts]`);
    for (const { to, when } of altsOf(t)) {
      if (when !== undefined && !FLOW_GUARDS.includes(when)) errors.push(`${at}: when '${when}' is a guard (${FLOW_GUARDS.join(', ')})`);
      if (Array.isArray(to) || isObj(to)) { errors.push(`${at}: an alt goes to a step or a special, not a list`); continue; }
      if (!isStr(to)) { errors.push(`${at}: a target is a step (${ids.join(', ')}), a special (${FLOW_SPECIALS.join(', ')}), or [alts]`); continue; }
      if (to.startsWith('$')) {
        if (!FLOW_SPECIALS.includes(to)) errors.push(`${at}: '${to}' is not a special (${FLOW_SPECIALS.join(', ')})`);
        else if (to === '$door' && event !== 'door') errors.push(`${at}: $door is where a level's door leads, so it stands under on.door`);
        else if (to === '$picked' && event !== 'pick') errors.push(`${at}: $picked is the level picked on the levels screen, so it stands under its on.pick`);
      } else if (!steps[to]) errors.push(`${at}: no step '${to}' (${ids.join(', ')})`);
      else if (steps[to].kind === 'level' && steps[to].level === '$any' && !(from && from.kind === 'cinematic')) errors.push(`${at}: '${to}' plays whichever level it is given, so say which: a special (${FLOW_SPECIALS.filter((x) => x !== '$door' && x !== '$picked').join(', ')})`);
    }
  };

  for (const id of ids) {
    const s = steps[id], at = `${where}.steps.${id}`;
    if (!ID.test(id)) errors.push(`${at}: a step's id is lower case, digits and hyphens`);
    if (!isObj(s) || !FLOW_KINDS.includes(s.kind)) { errors.push(`${at}.kind is one of: ${FLOW_KINDS.join(', ')}`); continue; }
    for (const k of Object.keys(s)) if (!KEYS[s.kind].includes(k)) errors.push(`${at}.${k}: a ${s.kind} step takes ${KEYS[s.kind].filter((x) => x !== 'kind').join(', ')}`);
    if (s.on !== undefined && !isObj(s.on)) errors.push(`${at}.on is { <event>: target }`);
    if (s.kind === 'screen') {
      if (!SCREEN_EVENTS[s.screen]) { errors.push(`${at}.screen is one of: ${FLOW_SCREENS.join(', ')}`); continue; }
      const evs = SCREEN_EVENTS[s.screen];
      if (isObj(s.on)) for (const e of Object.keys(s.on)) if (!evs.includes(e)) errors.push(`${at}.on.${e}: the ${s.screen} screen's events are ${evs.join(', ')}`);
      if (s.next !== undefined && evs.length > 1 && !isObj(s.on)) errors.push(`${at}.next stands for a screen's one event; the ${s.screen} screen has ${evs.length} (${evs.join(', ')}): say them in on`);
      if (s.idle !== undefined && !(isObj(s.idle) && num(s.idle.after, 5, 600) && s.idle.go !== undefined && Object.keys(s.idle).every((k) => k === 'after' || k === 'go'))) errors.push(`${at}.idle is { after: 5 to 600 seconds, go: target }: where the screen goes when the player leaves it alone`);
      if (s.on === undefined && s.next === undefined) errors.push(`${at}: a screen needs a way out (on, or next for its one event)`);
    } else if (s.kind === 'cinematic') {
      if (!isStr(s.scene)) errors.push(`${at}.scene names the scene it plays (a story moment's id)`);
      else if (scenes && !scenes.includes(s.scene)) errors.push(`${at}.scene: no scene '${s.scene}' (${scenes.join(', ') || 'none'})`);
      if (!isStr(s.stage) || !refs.has(s.stage)) errors.push(`${at}.stage is the level whose page it plays on (${levels.join(', ') || 'no levels'})`);
      if (s.next === undefined) errors.push(`${at}.next: where it goes as it ends`);
      for (const k of ['keep', 'skip']) if (s[k] !== undefined && typeof s[k] !== 'boolean') errors.push(`${at}.${k} is true or false`);
      // kept: the stage goes on to the level step after it, the same page
      if (s.keep === true && s.next !== undefined) {
        const to = steps[s.next];
        if (!(isStr(s.next) && to && to.kind === 'level' && (to.level === s.stage || to.level === '$any'))) errors.push(`${at}.keep hands the stage on to the level after it: next is a level step playing ${s.stage}`);
      }
    } else if (s.kind === 'level') {
      if (!(s.level === '$any' || (isStr(s.level) && refs.has(s.level)))) errors.push(`${at}.level is a level (${levels.join(', ') || 'none'}) or $any (the step any level plays in)`);
      if (!isObj(s.on) || !Object.keys(s.on).length) errors.push(`${at}.on: where its outcomes go (${LEVEL_EVENTS.join(', ')})`);
      else for (const e of Object.keys(s.on)) if (!LEVEL_EVENTS.includes(e)) errors.push(`${at}.on.${e}: a level is left by ${LEVEL_EVENTS.join(', ')}`);
    } else if (s.kind === 'hold') {
      if (s.for === undefined && s.until === undefined) errors.push(`${at}: a hold waits for some seconds (for) or an event (until)`);
      if (s.for !== undefined && !num(s.for, 0.1, 60)) errors.push(`${at}.for is 0.1 to 60 seconds`);
      if (s.until !== undefined && !isStr(s.until)) errors.push(`${at}.until names the event it waits for`);
      if (s.next === undefined) errors.push(`${at}.next: where it goes once it has waited`);
    }
    // (a cinematic's next may name the $any step by id: its stage is the level it plays)
    for (const [e, t] of exitsOf(s)) target(t, `${at}.${e === 'next' ? 'next' : e === 'idle' ? 'idle.go' : `on.${e}`}`, e, s);
  }
  if (errors.length) return errors;

  // a special that lands on a level needs a step that plays it
  const anyStep = ids.some((id) => steps[id].kind === 'level' && steps[id].level === '$any');
  const usesSpecial = ids.some((id) => exitsOf(steps[id]).some(([, t]) => altsOf(t).some((a) => a.to.startsWith('$'))));
  if (usesSpecial && !anyStep) {
    const played = new Set(ids.filter((id) => steps[id].kind === 'level').map((id) => steps[id].level));
    const missing = levels.filter((r) => !played.has(r));
    if (missing.length) errors.push(`${where}: a special lands on any level, and ${missing.join(', ')} has no level step: give each a step, or one with level: '$any'`);
  }
  // every step reached from the start (a special may land on any level step)
  const seen = new Set(), todo = startAlts.map((a) => a.to);
  const levelSteps = ids.filter((id) => steps[id].kind === 'level');
  while (todo.length) {
    const id = todo.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const [, t] of exitsOf(steps[id])) for (const { to } of altsOf(t)) (to.startsWith('$') ? levelSteps : [to]).forEach((x) => todo.push(x));
  }
  for (const id of ids) if (!seen.has(id)) errors.push(`${where}.steps.${id}: nothing reaches it from ${startAlts.map((a) => a.to).join(' or ')}`);
  // no loop of cinematics and holds alone: something in every loop is the player's to press or play
  const auto = (id) => ['cinematic', 'hold'].includes(steps[id].kind);
  const state = {};
  const loop = (id, path) => {
    if (state[id] === 'done') return null;
    if (state[id] === 'on') return [...path.slice(path.indexOf(id)), id];
    state[id] = 'on';
    for (const [, t] of exitsOf(steps[id])) for (const { to } of altsOf(t)) if (!to.startsWith('$') && auto(to)) { const c = loop(to, [...path, id]); if (c) return c; }
    state[id] = 'done';
    return null;
  };
  for (const id of ids) if (auto(id)) { const c = loop(id, []); if (c) { errors.push(`${where}: ${c.join(' → ')} loops with nothing for the player to press or play; put a screen or a level in it`); break; } }
  return errors;
}

/**
 * The flow a play-shell game has always had, from what it says: its front (attract, title, its menu, the end card and
 * the credits), its levels (one; several, a levels screen; a map, travel by exits), its run, its final level. The
 * shell's own sequence (play-shell.js: home, launch, the outcome handler, the result's buttons), written as a flow.
 */
export function defaultFlow(game) {
  const levels = (game.levels || []).map((l) => (typeof l === 'string' ? l : l.ref)), many = levels.length > 1;
  // a map travels on by its levels' exits (store-kernel isMap); doors go wherever the game's links say
  const run = game.run !== undefined && game.run !== null, map = (game.levels || []).some((l) => isObj(l) && Array.isArray(l.exits) && l.exits.length);
  // links: the manifest's door pairs ([{ from, to }]), or the shell's table of them ({ <level>: { <door>: … } })
  const doors = Array.isArray(game.links) ? game.links.length > 0 : isObj(game.links) && Object.keys(game.links).length > 0;
  const F = game.front ? frontConfig(game.front, null, { levels: levels.length, run }) : null;
  const steps = {}, home = F ? 'title' : run ? 'title' : many ? 'levels' : 'title';
  // the title: the front's menu, else a run's title, else a plain title whose play goes on to the levels or the level
  if (F) {
    const on = {};
    for (const m of F.menu) {
      if (m === 'play') on.play = run ? '$run' : '$first';
      else if (m === 'continue') on.continue = '$continue';
      else if (m === 'levels' && !run && many) on.levels = 'levels';
      else if (m === 'options') on.options = 'options';
      else if (m === 'credits' && F.credits) on.credits = 'credits';
    }
    if (F.press) steps.attract = { kind: 'screen', screen: 'attract', on: { press: 'title' } };
    steps.title = { kind: 'screen', screen: 'title', on };
    if (on.options) steps.options = { kind: 'screen', screen: 'options', on: { back: 'title' } };
  } else if (run || !many) steps.title = { kind: 'screen', screen: 'title', on: { play: run ? '$run' : '$first' } };
  if (!run && many) steps.levels = { kind: 'screen', screen: 'levels', on: { pick: '$picked', ...(F ? { back: 'title' } : {}) } };
  if (F && F.credits) steps.credits = { kind: 'screen', screen: 'credits', on: { done: 'title' } };
  // a level: a run goes on through its order or ends; else the game first completed is its end, a map travels on by
  // its exit, and anything else shows the result
  if (run) {
    steps.play = { kind: 'level', level: '$any', on: { won: ['$run-next', 'run-result'], lost: 'run-result', left: 'run-result', ...(doors ? { door: '$door' } : {}) } };
    steps['run-result'] = { kind: 'screen', screen: 'run-result', on: { again: '$run', home, ...(F && F.credits ? { credits: 'credits' } : {}) } };
  } else {
    const end = F && F.end;
    // the final level's clearing win never travels on (its end, else its result)
    const finalStop = end ? [{ when: 'complete', go: 'end' }] : map && game.final ? [{ when: 'complete', go: 'result' }] : [];
    steps.play = { kind: 'level', level: '$any', on: { won: [...finalStop, ...(map ? ['$travel'] : []), 'result'], lost: 'result', left: 'result', ...(doors ? { door: '$door' } : {}) } };
    steps.result = { kind: 'screen', screen: 'result', on: { next: '$next', again: '$again', home } };
    if (end) steps.end = { kind: 'screen', screen: 'end', on: { done: end.credits ? 'credits' : 'title' } };
  }
  // THE STORY's cinematics (game.cinematics: { opening?, prologue?, ending?: { scene, stage } }, gameworld/story.js
  // GAME_SLOTS), each where a game plays it
  const C = isObj(game.cinematics) ? game.cinematics : {}, first = steps.attract ? 'attract' : home;
  let start = first;
  // the opening: before the first screen on a first boot (unseen), and again as the attract loop when the first screen
  // is left alone
  if (C.opening) {
    steps.opening = { kind: 'cinematic', scene: C.opening.scene, stage: C.opening.stage, next: first };
    start = [{ when: 'unseen', go: 'opening' }, first];
    steps[first] = { ...steps[first], idle: { after: 45, go: 'opening' } };
  }
  // the prologue: after New Game (the title's play), before control; on the first level's own page it hands that page
  // straight on to the level (keep), elsewhere the first level follows it
  if (C.prologue && !run && steps.title && steps.title.on && steps.title.on.play === '$first') {
    const keep = C.prologue.stage === levels[0];
    steps.prologue = { kind: 'cinematic', scene: C.prologue.scene, stage: C.prologue.stage, next: keep ? 'play' : '$first', ...(keep ? { keep: true } : {}) };
    steps.title = { ...steps.title, on: { ...steps.title.on, play: 'prologue' } };
  }
  // the ending: after the game's first full clear, before the end card (a game with no end card: before its result)
  if (C.ending && !run && ((F && F.end) || game.final)) {
    steps.ending = { kind: 'cinematic', scene: C.ending.scene, stage: C.ending.stage, next: F && F.end ? 'end' : 'result' };
    const won = steps.play.on.won.filter((a) => !(isObj(a) && a.when === 'complete'));
    steps.play = { ...steps.play, on: { ...steps.play.on, won: [{ when: 'complete', go: 'ending' }, ...won] } };
  }
  return { start, home, steps };
}

/**
 * THE FLOW KERNEL: stepping a flow, self-contained so the play shell inlines it with toString() (the store kernel's
 * emit discipline: real, parseable JavaScript, references nothing outside itself). Node uses the same instance.
 */
export function buildFlowKernel() {
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const altsOf = (t) => (Array.isArray(t) ? t : [t]).map((a) => (isObj(a) ? { to: a.go, when: a.when } : { to: a }));
  // a special or a step id, resolved: the step it lands on (a special's level plays in its own step, else in $any's).
  // The level last played carries through the steps that play none (a result's next and again step on from it)
  function land(flow, to, ctx) {
    const last = ctx.level || null;
    // (a cinematic plays its stage: the level step it hands on to by id plays that level)
    // ($any named by id plays the level it is handed: a kept cinematic's stage)
    if (to.charAt(0) !== '$') { const s = flow.steps[to]; return s ? { step: to, level: s.kind === 'level' ? (s.level === '$any' ? last : s.level) : s.kind === 'cinematic' ? s.stage : last } : null; }
    const ref = ctx.resolve ? ctx.resolve(to, ctx) : null;
    if (!ref) return null;
    const ids = Object.keys(flow.steps);
    const own = ids.find((id) => flow.steps[id].kind === 'level' && flow.steps[id].level === ref) || ids.find((id) => flow.steps[id].kind === 'level' && flow.steps[id].level === '$any');
    return own ? { step: own, level: ref } : null;
  }
  // where an event on a step leads: { step, level } (level: the level a level step plays, else the last played), or
  // null (nowhere). A screen with no `on` takes `next` for its one event; a cinematic and a hold go on by `next`
  function stepFlow(flow, at, event, ctx) {
    const c = ctx || {}, s = flow.steps[at];
    if (!s) return null;
    const t = event === 'idle' ? s.idle && s.idle.go : s.on && s.on[event] !== undefined ? s.on[event] : event === 'next' || (s.kind === 'screen' && !s.on) ? s.next : undefined;
    if (t === undefined) return null;
    return pick(flow, t, c);
  }
  // the first alt of a target that resolves (a guard is asked with the step its alt goes to)
  function pick(flow, t, c) {
    for (const a of altsOf(t)) {
      if (a.when !== undefined && !(c.guard && c.guard(a.when, c, a.to))) continue;
      const got = land(flow, a.to, c);
      if (got) return got;
    }
    return null;
  }
  // where the game starts: the start's first alt that holds (an opening unseen, else the title)
  function startOf(flow, ctx) { return pick(flow, flow.start, ctx || {}) || { step: altsOf(flow.start).slice(-1)[0].to, level: null }; }
  // a level's own step (its own, else $any's), the way into it without an event (a playtest's start level)
  function levelStep(flow, ref) {
    const ids = Object.keys(flow.steps);
    const id = ids.find((x) => flow.steps[x].kind === 'level' && flow.steps[x].level === ref) || ids.find((x) => flow.steps[x].kind === 'level' && flow.steps[x].level === '$any');
    return id ? { step: id, level: ref } : null;
  }
  // home: the flow's own (`home`), else the first screen its start reaches (where quitting and resetting go)
  function homeOf(flow) {
    if (flow.home && flow.steps[flow.home]) return flow.home;
    const seen = {}, todo = altsOf(flow.start).map((a) => a.to);
    while (todo.length) {
      const id = todo.shift();
      if (seen[id] || !flow.steps[id]) continue;
      seen[id] = 1;
      const s = flow.steps[id];
      if (s.kind === 'screen' && s.screen !== 'attract') return id;
      const outs = [];
      if (isObj(s.on)) for (const k in s.on) outs.push(s.on[k]);
      if (s.next !== undefined) outs.push(s.next);
      for (const t of outs) for (const a of altsOf(t)) if (typeof a.to === 'string' && a.to.charAt(0) !== '$') todo.push(a.to);
    }
    return altsOf(flow.start).slice(-1)[0].to;
  }
  // the headless walk: from the start, each event in turn (a string, or { event, ...what that moment knows)
  function walkFlow(flow, events, ctx) {
    let at = startOf(flow, ctx);
    const seen = [at];
    for (const e of events) {
      const ev = typeof e === 'string' ? { event: e } : e;
      const next = stepFlow(flow, at.step, ev.event, Object.assign({}, ctx || {}, ev, { level: at.level }));
      if (!next) { seen.push({ stuck: ev.event, at: at.step }); break; }
      at = next;
      seen.push(at);
    }
    return seen;
  }
  return { stepFlow, startOf, levelStep, homeOf, walkFlow, altsOf };
}
const FK = buildFlowKernel();

/** Where an event on a step leads: { step, level } (level: the level a level step plays), or null (nowhere). */
export const stepFlow = (flow, at, event, ctx = {}) => FK.stepFlow(flow, at, event, ctx);
/** The headless walk: the steps a run of events visits; stops where an event leads nowhere ({ stuck: event }). */
export const walkFlow = (flow, events, ctx = {}) => FK.walkFlow(flow, events, ctx);
/** Where the game starts: the start's first alt that holds ({ step, level }). */
export const flowStart = (flow, ctx = {}) => FK.startOf(flow, ctx);
/** Where quitting and resetting go: the flow's `home`, else the first screen its start reaches (past an attract). */
export const flowHome = (flow) => FK.homeOf(flow);
