import { describe, it, expect } from 'vitest';
import { readFlow, defaultFlow, startInPlay, stepFlow, walkFlow, flowStart, FLOW_SPECIALS, SCREEN_EVENTS } from './flow.js';
import { validateGameManifest } from './game-manifest.js';

// A GAME'S FLOW: what plays when, from the first screen to the credits, as data. The reader teaches every fault; a game
// that says no flow gets the one its front, levels, run and map have always made, and walking it replays the play
// shell's own sequence (play-shell.js: home, launch, the outcome handler, the result's buttons). One case per procedure.

// the shell, modelled: what each special lands on (play-shell.js renderResult's next, the front's continue, runs, travel)
const shell = (levels, { exits = {}, links = {}, runOrder = null } = {}) => {
  const S = { cleared: new Set(), run: null };
  const ctx = {
    resolve: (sp, c) => {
      const i = levels.indexOf(c.level);
      if (sp === '$first') return levels[0];
      if (sp === '$again') return c.level;
      if (sp === '$next') return levels[i + 1] || null;
      if (sp === '$picked') return c.picked || null;
      if (sp === '$continue') return levels.find((l) => !S.cleared.has(l)) || null;
      if (sp === '$travel') return (c.exit && (exits[c.level] || {})[c.exit]) || null;
      if (sp === '$door') return (c.door && (links[c.level] || {})[c.door]) || null;
      if (sp === '$run') { S.run = { order: runOrder, at: 0 }; return runOrder[0]; }
      if (sp === '$run-next') { S.run.at += 1; return S.run.order[S.run.at] || null; }
      return null;
    },
    // the game first completed: every level cleared by this win, not before (play-shell.js allCleared, `before`)
    guard: (g, c) => g === 'complete' && c.won && levels.every((l) => S.cleared.has(l) || l === c.level) && !levels.every((l) => S.cleared.has(l)),
  };
  // a win clears its level after the flow has stepped on (the shell applies the outcome, then decides)
  const won = (extra = {}) => ({ event: 'won', won: true, ...extra });
  return { ctx, S, won };
};
// a level step shows the level it plays; a screen or a cinematic its own name
const path = (flow, seen) => seen.map((x) => (x.stuck ? `stuck:${x.stuck}` : flow.steps[x.step].kind === 'level' ? `${x.step}(${x.level})` : x.step));
const walk = (flow, ctx, S, events) => {
  // each win clears its level once the step it leads to is known
  const out = [];
  let at = flowStart(flow, ctx);
  out.push(at);
  for (const e of events) {
    const ev = typeof e === 'string' ? { event: e } : e;
    const next = stepFlow(flow, at.step, ev.event, { ...ctx, ...ev, level: at.level });
    if (ev.won && at.level) S.cleared.add(at.level);
    if (!next) { out.push({ stuck: ev.event }); break; }
    at = next;
    out.push(at);
  }
  return path(flow, out);
};

const LEVELS = ['vale', 'gate', 'keep'];
const authored = () => ({
  start: 'opening',
  steps: {
    opening: { kind: 'cinematic', scene: 'opening', stage: 'vale', next: 'title' },
    title: { kind: 'screen', screen: 'title', on: { play: 'prologue', continue: '$continue', credits: 'credits' }, idle: { after: 30, go: 'opening' } },
    prologue: { kind: 'cinematic', scene: 'prologue', stage: 'vale', next: 'vale', keep: true },
    vale: { kind: 'level', level: 'vale', on: { won: 'beat', lost: 'vale' } },
    beat: { kind: 'hold', for: 1.5, next: '$next' },
    any: { kind: 'level', level: '$any', on: { won: [{ when: 'complete', go: 'ending' }, '$next'], lost: '$again' } },
    ending: { kind: 'cinematic', scene: 'ending', stage: 'keep', next: 'end' },
    end: { kind: 'screen', screen: 'end', next: 'credits' },
    credits: { kind: 'screen', screen: 'credits', next: 'title' },
  },
});

describe('a game\'s flow is read and taught', () => {
  it('a flow that says the whole game, from the opening to the credits, reads clean', () => {
    expect(readFlow(authored(), { levels: LEVELS, scenes: ['opening', 'prologue', 'ending'] })).toEqual([]);
  });
  it('each fault says what it should be', () => {
    const bad = (mutate, opts = {}) => { const f = authored(); mutate(f.steps, f); return readFlow(f, { levels: LEVELS, ...opts }).join('\n'); };
    expect(readFlow('title')[0]).toMatch(/is \{ start, steps/);
    expect(bad((s) => { s.title.kind = 'menu'; })).toMatch(/kind is one of: screen, cinematic, level, hold/);
    expect(bad((s) => { s.title.on.quit = 'end'; })).toMatch(/on.quit: the title screen's events are play, continue, levels, options, credits/);
    expect(bad((s) => { s.title.on.play = 'nowhere'; })).toMatch(/no step 'nowhere'/);
    expect(bad((s) => { s.title.on.play = '$somewhere'; })).toMatch(/'\$somewhere' is not a special \(\$first/);
    expect(bad((s) => { s.any.on.won = '$door'; })).toMatch(/\$door is where a level's door leads, so it stands under on.door/);
    expect(bad((s) => { s.opening.stage = 'moon'; })).toMatch(/stage is the level whose page it plays on \(vale, gate, keep\)/);
    expect(bad((s) => { s.prologue.next = 'title'; })).toMatch(/keep hands the stage on to the level after it/);
    expect(bad((s) => { delete s.beat.for; })).toMatch(/a hold waits for some seconds \(for\) or an event \(until\)/);
    expect(bad((s) => { s.title.idle.after = 2; })).toMatch(/idle is \{ after: 5 to 600 seconds/);
    expect(bad(() => {}, { scenes: ['opening'] })).toMatch(/scene: no scene 'prologue'/);
    expect(bad((s) => { s.spare = { kind: 'screen', screen: 'options', on: { back: 'title' } }; })).toMatch(/steps.spare: nothing reaches it from opening/);
    expect(bad((s) => { s.beat.next = 'any'; })).toMatch(/'any' plays whichever level it is given, so say which: a special/);
    // cinematics that only lead to each other: nothing for the player to press or play
    expect(bad((s) => { s.ending.next = 'opening'; s.opening.next = 'ending'; })).toMatch(/opening → ending → opening loops with nothing for the player to press or play/);
    // a special lands on any level: each level needs a step to play in
    expect(bad((s) => { delete s.any; s.beat.next = 'vale'; s.vale.on.won = '$next'; })).toMatch(/gate, keep has no level step: give each a step, or one with level: '\$any'/);
  });
  it('a game says its flow on the play shell, and its faults are the game\'s', () => {
    const game = (more) => ({ kind: 'game', title: 'x', store: { slices: [{ name: 'progress', kind: 'progression' }] }, levels: LEVELS.map((ref) => ({ ref })), ...more });
    expect(validateGameManifest(game({ shell: 'play', flow: authored() })).errors).toEqual([]);
    expect(validateGameManifest(game({ flow: authored() })).errors.join('\n')).toMatch(/flow is what the play shell runs.*add shell: 'play'/);
    expect(validateGameManifest(game({ shell: 'play', flow: { ...authored(), start: 'nope' } })).errors.join('\n')).toMatch(/flow.start names the first step/);
  });
});

describe('a game that says no flow has the one it always had', () => {
  const read = (g) => readFlow(defaultFlow(g), { levels: (g.levels || []).map((l) => l.ref) });
  const lv = (refs, more = {}) => refs.map((ref) => ({ ref, ...(more[ref] || {}) }));
  it('every shape of play-shell game makes a flow that reads clean', () => {
    const shapes = {
      'one level, no front': { levels: lv(['vale']) },
      'several levels, no front': { levels: lv(LEVELS) },
      'a front with an attract, credits and an end': { levels: lv(LEVELS), front: { press: true, credits: { roll: [{ role: 'made by', names: ['a'] }] } } },
      'a run': { levels: lv(LEVELS), run: { length: 2 }, front: {} },
      'a map with doors and a final level': { levels: lv(LEVELS, { vale: { exits: [{ id: 'east', to: 'gate' }] } }), links: [{ from: { ref: 'vale', door: 'd1' }, to: { ref: 'gate', door: 'd1' } }], final: 'keep' },
    };
    for (const [name, g] of Object.entries(shapes)) expect(read(g), name).toEqual([]);
  });
  it('a front: attract, title, each level and its result in turn, and the first full clear to the end card, the roll and the title', () => {
    const F = defaultFlow({ levels: lv(LEVELS), front: { press: true, credits: { roll: [{ role: 'made by', names: ['a'] }] } } });
    const { ctx, S, won } = shell(LEVELS);
    expect(walk(F, ctx, S, ['press', 'play', won(), 'next', won(), 'next', won(), 'done', 'done'])).toEqual([
      'attract', 'title', 'play(vale)', 'result', 'play(gate)', 'result', 'play(keep)', 'end', 'credits', 'title',
    ]);
    // a loss shows its result; try again plays it again; home is the title
    const T = shell(LEVELS);
    expect(walk(F, T.ctx, T.S, ['press', 'play', 'lost', 'again', 'lost', 'home'])).toEqual(['attract', 'title', 'play(vale)', 'result', 'play(vale)', 'result', 'title']);
  });
  it('several levels and no front: the levels screen is home, a pick plays, a result goes home to it', () => {
    const F = defaultFlow({ levels: lv(LEVELS) });
    const { ctx, S } = shell(LEVELS);
    expect(walk(F, ctx, S, [{ event: 'pick', picked: 'gate' }, 'lost', 'home'])).toEqual(['levels', 'play(gate)', 'result', 'levels']);
    expect(F.steps.levels.on.back).toBeUndefined();       // no front: no title to go back to
  });
  it('a run: a clear goes on through the run\'s order, a fall ends it, and its result starts the next', () => {
    const F = defaultFlow({ levels: lv(LEVELS), run: { length: 2 } });
    const { ctx, S, won } = shell(LEVELS, { runOrder: ['keep', 'vale'] });
    expect(walk(F, ctx, S, ['play', won(), 'lost', 'again'])).toEqual(['title', 'play(keep)', 'play(vale)', 'run-result', 'play(keep)']);
  });
  it('a map: a win by an open exit travels on, a door goes where its link says, the final level\'s clear never travels', () => {
    const levels = lv(LEVELS, { vale: { exits: [{ id: 'east', to: 'gate' }] }, keep: { exits: [{ id: 'west', to: 'vale' }] } });
    const F = defaultFlow({ levels, links: [{ from: { ref: 'gate', door: 'd1' }, to: { ref: 'keep', door: 'd2' } }], final: 'keep' });
    expect(F.steps.play.on.door).toBe('$door');           // the manifest's door pairs give the level a way through its doors
    const { ctx, S, won } = shell(LEVELS, { exits: { vale: { east: 'gate' }, keep: { west: 'vale' } }, links: { gate: { d1: 'keep' } } });
    S.cleared.add('vale'); S.cleared.add('gate');
    expect(walk(F, ctx, S, [{ event: 'pick', picked: 'vale' }, won({ exit: 'east' }), { event: 'door', door: 'd1' }, won({ exit: 'west' })])).toEqual([
      'levels', 'play(vale)', 'play(gate)', 'play(keep)', 'result',
    ]);
  });
});

describe('the story\'s cinematics, placed', () => {
  const CIN = { opening: { scene: 'dawn', stage: 'vale' }, prologue: { scene: 'setting-out', stage: 'vale' }, ending: { scene: 'home-again', stage: 'keep' } };
  const lv = LEVELS.map((ref) => ({ ref }));
  it('the opening on a first boot and as the title\'s attract, the prologue after New Game handing its page to play, the ending before the end card', () => {
    const F = defaultFlow({ levels: lv, front: { credits: { roll: [{ role: 'made by', names: ['a'] }] } }, cinematics: CIN });
    expect(readFlow(F, { levels: LEVELS, scenes: ['dawn', 'setting-out', 'home-again'] })).toEqual([]);
    const { ctx, S, won } = shell(LEVELS), seen = new Set();
    const boot = { ...ctx, guard: (g, c, to) => (g === 'unseen' ? !seen.has(to) : ctx.guard(g, c)) };
    expect(walk(F, boot, S, ['next', 'idle', 'next', 'play', 'next', won(), 'next', won(), 'next', won(), 'next', 'done', 'done'])).toEqual([
      'opening', 'title', 'opening', 'title', 'prologue', 'play(vale)', 'result', 'play(gate)', 'result', 'play(keep)', 'ending', 'end', 'credits', 'title',
    ]);
    seen.add('opening');                                        // a later boot: the title at once
    expect(walk(F, boot, shell(LEVELS).S, [])).toEqual(['title']);
  });
  it('a prologue staged on another level than the first is followed by the first; a run has none, nor an ending', () => {
    const F = defaultFlow({ levels: lv, front: {}, cinematics: { prologue: { scene: 'p', stage: 'gate' } } });
    expect(F.steps.prologue).toEqual({ kind: 'cinematic', scene: 'p', stage: 'gate', next: '$first' });
    const { ctx, S } = shell(LEVELS);
    expect(walk(F, ctx, S, ['play', 'next'])).toEqual(['title', 'prologue', 'play(vale)']);
    const R = defaultFlow({ levels: lv, run: { length: 2 }, front: {}, cinematics: CIN });
    expect([R.steps.prologue, R.steps.ending]).toEqual([undefined, undefined]);
    expect(readFlow(R, { levels: LEVELS })).toEqual([]);
  });
  it('a game with no end card plays its ending before the result of its final level', () => {
    const F = defaultFlow({ levels: lv, final: 'keep', cinematics: { ending: { scene: 'e', stage: 'keep' } } });
    expect(F.steps.ending.next).toBe('result');
    expect(F.steps.play.on.won[0]).toEqual({ when: 'complete', go: 'ending' });
    expect(readFlow(F, { levels: LEVELS })).toEqual([]);
  });
});

describe('the flow is stepped, and walked headless', () => {
  it('an event leads where its step says; an event a step does not take leads nowhere', () => {
    const F = authored();
    expect(stepFlow(F, 'title', 'idle')).toEqual({ step: 'opening', level: 'vale' });   // a cinematic plays its stage
    expect(stepFlow(F, 'opening', 'next')).toEqual({ step: 'title', level: null });
    expect(stepFlow(F, 'prologue', 'next')).toEqual({ step: 'vale', level: 'vale' });
    expect(stepFlow(F, 'title', 'levels')).toBeNull();
    expect(walkFlow(F, ['next', 'nope'])).toEqual([{ step: 'opening', level: 'vale' }, { step: 'title', level: 'vale' }, { stuck: 'nope', at: 'title' }]);
  });
  it('the authored flow plays from the opening to the credits and home', () => {
    const { ctx, S, won } = shell(LEVELS);
    expect(walk(authored(), ctx, S, ['next', 'play', 'next', won(), 'next', won(), won(), 'next', 'done', 'done'])).toEqual([
      'opening', 'title', 'prologue', 'vale(vale)', 'beat', 'any(gate)', 'any(keep)', 'ending', 'end', 'credits', 'title',
    ]);
  });
  it('the words it teaches are its own tables', () => {
    expect(FLOW_SPECIALS.every((s) => s.startsWith('$'))).toBe(true);
    expect(Object.values(SCREEN_EVENTS).every((evs) => evs.length > 0)).toBe(true);
  });
  it('a cutscene is an encapsulated sequence: a video, a directed scene on a stage, or an empty slot; it goes on by its next', () => {
    const flow = (cut) => ({ start: 'opening', steps: { opening: { kind: 'cutscene', ...cut, next: 'vale' }, vale: { kind: 'level', level: 'vale', on: { won: 'opening' } } } });
    for (const cut of [{}, { video: 'media/opening.mp4' }, { scene: 'opening', stage: 'vale' }, { video: 'a.mp4', skip: false }]) expect(readFlow(flow(cut), { levels: LEVELS, scenes: ['opening'] }), JSON.stringify(cut)).toEqual([]);
    const bad = (cut, re) => expect(readFlow(flow(cut), { levels: LEVELS, scenes: ['opening'] }).join('\n')).toMatch(re);
    bad({ video: 'a.mp4', scene: 'opening', stage: 'vale' }, /a video or a directed scene, one or the other/);
    bad({ scene: 'opening' }, /stage is the level whose page its scene plays on/);
    bad({ stage: 'vale' }, /stage is a directed scene's/);
    bad({ scene: 'nowhere', stage: 'vale' }, /no scene 'nowhere'/);
    bad({ video: 7 }, /video is the video it plays/);
    expect(readFlow({ start: 'a', steps: { a: { kind: 'cutscene' } } }, { levels: LEVELS }).join('\n')).toMatch(/next: where it goes as it ends/);
    // a loop of cutscenes alone is nothing for the player to press
    expect(readFlow({ start: 'a', steps: { a: { kind: 'cutscene', next: 'b' }, b: { kind: 'cutscene', next: 'a' } } }, { levels: LEVELS }).join('\n')).toMatch(/loops with nothing for the player/);
    // (stepped: an empty slot and a video carry the level last played; a directed scene is on its stage)
    expect(stepFlow(flow({}), 'opening', 'next', shell(LEVELS).ctx)).toEqual({ step: 'vale', level: 'vale' });
    const F = { start: 'title', steps: { title: { kind: 'screen', screen: 'title', on: { play: 'cut' } }, cut: { kind: 'cutscene', scene: 'opening', stage: 'gate', next: '$first' }, any: { kind: 'level', level: '$any', on: { won: 'title' } } } };
    expect(stepFlow(F, 'title', 'play', shell(LEVELS).ctx)).toEqual({ step: 'cut', level: 'gate' });
  });

  it('a flow started in play: its opening a cutscene, then straight into the game; the title only where quitting goes', () => {
    // one game per shape the default flow has: a plain one, one with a front and the story's prologue, a run
    const shapes = { plain: { levels: LEVELS }, fronted: { levels: LEVELS, front: { press: true, end: { text: 'done' } }, cinematics: { prologue: { scene: 'p', stage: 'vale' }, ending: { scene: 'e', stage: 'keep' } } }, run: { levels: LEVELS, run: { length: 2 } } };
    for (const [name, game] of Object.entries(shapes)) {
      const D = defaultFlow(game), F = startInPlay(D);
      expect(readFlow(F, { levels: LEVELS, scenes: ['p', 'e'] }), name).toEqual([]);
      expect(F.start, name).toBe('opening');
      expect(F.steps.opening.kind, name).toBe('cutscene');
      expect(F.home, name).toBe(D.home);
      // every step the default had is kept but the attract and the prologue: nothing is pressed or played before play
      // but the opening
      expect(Object.keys(F.steps).sort(), name).toEqual([...Object.keys(D.steps).filter((id) => !['prologue', 'attract'].includes(id)), 'opening'].sort());
      expect(D).toEqual(defaultFlow(game));
    }
    // a first boot goes through the empty slot to the first level; a save with progress to where it left off
    const F = startInPlay(defaultFlow(shapes.plain)), fresh = shell(LEVELS);
    expect(walk(F, fresh.ctx, fresh.S, ['next'])).toEqual(['opening', 'play(vale)']);
    const saved = shell(LEVELS); saved.S.cleared.add('vale');
    expect(walk(F, saved.ctx, saved.S, ['next'])).toEqual(['opening', 'play(gate)']);
    // a run begins its run; the cutscene given it is what the slot plays
    const R = shell(LEVELS, { runOrder: ['gate', 'vale'] });
    expect(walk(startInPlay(defaultFlow(shapes.run)), R.ctx, R.S, ['next'])).toEqual(['opening', 'play(gate)']);
    expect(startInPlay(defaultFlow(shapes.plain), { video: 'media/opening.mp4' }).steps.opening).toEqual({ kind: 'cutscene', video: 'media/opening.mp4', next: ['$continue', '$first'] });
    // the title's play no longer goes by a prologue, and nothing idles back to an opening that is not a loop
    const fr = startInPlay(defaultFlow({ ...shapes.fronted, cinematics: { ...shapes.fronted.cinematics, opening: { scene: 'o', stage: 'vale' } } }));
    expect(fr.steps.title.on.play).toBe('$first');
    expect(Object.values(fr.steps).some((s) => s.idle?.go === 'opening')).toBe(false);
  });
});
