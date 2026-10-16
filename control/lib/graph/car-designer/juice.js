/**
 * THE RACER'S JUICE AND STATUS — what each game state looks like on a cartoon racer, as data. Every state the drive
 * rule writes (worlds/controllable/rules-drive.js: speed, throttle, braking, steerAngle, skidding, airborne / landed,
 * boosting) and what a game adds (damage, shield, invulnerable, item) has a visual, at an ANCHOR a part provides
 * (parts.js `fx`: an exhaust's tip, a wheel's contact, a lamp, a booster's nozzle), never one floating free.
 *
 *   JUICE    a row per effect: `when` (a trigger over the facts, written as a small expression), `at` (the anchor kind),
 *            `look` (flame, puff, smoke, dust, spark, ring, trail), its colours by tier, its rate (per second), life (s),
 *            size (share of the machine's module D), and the most of it alive at once (its budget)
 *   STATUS   a row per indicator shader: its trigger, the slots that listen (head and brake lamps, the accent: the hero
 *            piece, all, a bubble), the look (glow with a halo, fill by a fact, tier, flash, tint, cycle, pulse, bubble)
 *   FX       the genre's big effects: impact stars, dizzy stars round the head, motion lines at speed, speed lines on
 *            the screen on a surge, a boost's shockwave
 *   MOTION   how the machine itself answers the facts (racer.js bones): the front wheels' steer, the body's squat, dive,
 *            lean and bounce, a mast's wobble; exaggerated past physics (a cartoon's lean is three times a car's)
 *
 * Tiers are the genre's: a drift's charge (blue, then orange, then violet), a boost's flame white-hot at its root.
 *
 * A trigger is a small expression over FACTS (comparisons, &&, ||, !, abs(), *): compileWhen reads it once into a tree
 * the page interprets each frame (never evaluated as code). bakeJuice(rows, anchors, D) → the figure's `juice`: its
 * anchors (on a bone, or on the machine's frame), its rows with their triggers compiled, the module D sizes scale by.
 * Principles: an effect reads in a frame (big, bright, short); it never covers the driver's head; its colour says its
 * tier; the steady state is quiet (an idle puff), the event is loud (a boost). Pure data.
 */

export const DRIFT_TIERS = Object.freeze(['#58b8ff', '#ff9a2e', '#c86bff']);

export const JUICE = Object.freeze({
  idlePuff: { when: 'speed < 2 && throttle < 0.1', at: 'tip', look: 'puff', colours: ['#d8d8d8', '#9a9a9a'], rate: 2.5, life: 0.9, size: 0.28, budget: 8, why: 'the engine is alive at rest: a putt of smoke' },
  throttleFlame: { when: 'throttle > 0.6 && !boosting', at: 'tip', look: 'flame', colours: ['#fff2b0', '#ff8a2a'], flicker: 0.35, size: 0.32, budget: 1, why: 'the throttle open: a short flame flickering at the tip' },
  boostFlame: { when: 'boosting', at: 'tip', look: 'flame', colours: ['#ffffff', '#7ad6ff', '#3a6bff'], flicker: 0.15, size: 0.6, budget: 1, why: 'a boost: a long flame, white-hot at the root, the cool colour of speed' },
  boostNozzle: { when: 'boosting', at: 'boost', look: 'flame', colours: ['#ffffff', '#ffd23a', '#ff5a1a'], flicker: 0.2, size: 1.3, budget: 1, why: 'a booster lit: the biggest flame on the machine' },
  boostTrail: { when: 'boosting && speed > 8', at: 'contact.rear', look: 'trail', colours: ['#7ad6ff'], life: 0.35, size: 0.12, budget: 2, why: 'speed lines off the rear wheels while boosting' },
  driftSpark: { when: 'corner > 0.6 && speed > 6', at: 'contact.rear', look: 'spark', colours: DRIFT_TIERS, tierBy: 'cornerTime', tierAt: [0, 0.8, 1.8], rate: 40, life: 0.3, size: 0.16, budget: 60, why: 'a hard corner charging: sparks from the rear tyres, their colour how long it has held' },
  skidSmoke: { when: 'skidding || corner > 0.9 || (braking && speed > 10)', at: 'contact.rear', look: 'smoke', colours: ['#e6e6e6', '#bdbdbd'], rate: 18, life: 0.9, size: 0.55, budget: 24, why: 'rubber smoke where the tyres slide' },
  surfaceDust: { when: 'speed > 4 && offroad', at: 'contact.rear', look: 'dust', colours: ['#c4a87c', '#9c8462'], rate: 14, life: 0.7, size: 0.35, budget: 20, why: 'off the tarmac the wheels throw the ground they are on' },
  landingRing: { when: 'landed', at: 'contact', look: 'ring', colours: ['#e8dcc0', '#ffffff'], life: 0.4, size: 1.6, budget: 4, why: 'a landing: a ring of dust where the wheels hit' },
  damageSmoke: { when: 'damage > 0.6', at: 'tip', look: 'smoke', colours: ['#3a3a3a', '#6a6a6a'], rate: 8, life: 1.4, size: 0.5, budget: 14, why: 'hurt: black smoke from the engine' },
});

export const STATUS = Object.freeze({
  headlamps: { when: '1', slots: ['head'], look: 'glow', colours: ['#fff6d0'], amount: 0.35, halo: 0.5, why: 'the face lit' },
  brakeLamps: { when: 'braking', slots: ['brake'], look: 'glow', colours: ['#ff2a1a'], amount: 1, halo: 0.9, why: 'the brake lamps flare red' },
  boostReady: { when: 'charge > 0', by: 'charge', slots: ['accent'], look: 'fill', colours: ['#7ad6ff', '#ffffff'], why: 'the hero piece fills with charge; full, it pulses white' },
  driftTier: { when: 'cornerTime > 0', by: 'cornerTime', tierAt: [0, 0.8, 1.8], slots: ['brake', 'accent'], look: 'tier', colours: DRIFT_TIERS, amount: 0.55, why: 'the corner\'s tier in the lamps and the hero piece' },
  hit: { when: 'hit || impact', slots: ['all'], look: 'flash', colours: ['#ffffff'], amount: 0.85, duration: 0.14, why: 'a hit: the machine flashes white' },
  damaged: { when: 'damage > 0.3', by: 'damage', slots: ['all'], look: 'tint', colours: ['#3a2a2a'], amount: 0.45, flicker: 0.5, why: 'damage darkens and flickers the paint' },
  shield: { when: 'shield', slots: ['bubble'], look: 'bubble', colours: ['#8fe6ff'], amount: 0.8, why: 'a shield: a bright-rimmed bubble round the machine' },
  invulnerable: { when: 'invulnerable', slots: ['all'], look: 'cycle', colours: ['#ff4b4b', '#ffd23a', '#5dff7a', '#4bc3ff', '#c86bff'], amount: 0.55, rate: 8, why: 'a star: the colours cycling' },
  itemHeld: { when: 'item', slots: ['accent'], look: 'pulse', colours: ['#ffffff'], amount: 0.5, rate: 2, why: 'an item held: the hero piece pulses' },
});

/** The genre's big effects, beyond the machine's own juice: what an impact, speed and a surge look like.
 *   stars        a burst of cartoon stars from where it was hit
 *   orbit        stars circling over the driver's head (dizzy)
 *   streak       motion lines: white streaks beside and over the machine, along its way, at speed
 *   screen       speed lines: streaks from the screen's edges toward its middle (the pilot's own, on a surge)
 *   shock        a ring of air thrown back from where a boost starts */
export const FX = Object.freeze({
  impactStars: { when: 'impact || hit', at: 'body', look: 'stars', colours: ['#fff36b', '#ffffff', '#ffb02e'], count: 7, life: 0.55, size: 0.38, why: 'a bump or a hit: stars burst from it' },
  dizzy: { when: 'impact', at: 'driver', look: 'orbit', colours: ['#fff36b', '#ffffff'], count: 4, life: 1.3, size: 0.2, why: 'knocked silly: stars round the head' },
  motionLines: { when: 'topShare > 0.82 || boosting', at: 'body', look: 'streak', colours: ['#ffffff'], rate: 26, life: 0.22, size: 1.6, budget: 22, why: 'flat out: the air streaks past' },
  speedLines: { when: 'boosting || accel > 5', at: 'screen', look: 'screen', colours: ['#ffffff'], by: 'surge', count: 46, why: 'a surge: speed lines rush in from the screen\'s edges' },
  boostShock: { when: 'boostStart', at: 'tip', look: 'shock', colours: ['#bfe9ff', '#ffffff'], life: 0.32, size: 1.5, why: 'a boost\'s first instant: a ring of air thrown back' },
});

/** How the machine answers the facts: the bone, the fact, the gain (exaggerated), the limit, the return (s). */
export const MOTION = Object.freeze({
  steer: { bone: 'steerF', fact: 'steerAngle', gain: 1.6, limit: 0.6, why: 'the front wheels turn more than the road needs: the turn reads' },
  lean: { bone: 'body', fact: 'steerAngle * speed', gain: 0.08, limit: 0.22, why: 'the body leans out of a turn, three times a car\'s' },
  squat: { bone: 'body', fact: 'throttle', gain: 0.1, limit: 0.1, settle: 0.25, why: 'the nose lifts and the tail squats on the throttle' },
  dive: { bone: 'body', fact: 'braking', gain: 0.12, limit: 0.12, settle: 0.2, why: 'the nose dives on the brake' },
  bounce: { bone: 'body', fact: 'landed', gain: 0.25, limit: 0.25, settle: 0.45, why: 'a landing: the body squashes and springs back' },
  wobble: { bone: 'mast', fact: 'speed', gain: 0.03, limit: 0.35, why: 'a mast whips behind as it goes' },
});

/** The facts a trigger may read: the drive rule's (speed, throttle, braking, steer, skidding, landed), what the page
 *  keeps (skidTime: seconds into a slide; corner: the share of the tyres' grip a turn asks, v² tan|steer| / wheelbase
 *  over grip·g, and cornerTime: seconds above 0.6 of it — a cartoon drift is a hard corner, not a slide; accel: the
 *  speed's change, m/s²; topShare: the speed over the machine's top; surge: 0–1, a boost or a hard pull; impact: an edge,
 *  a bump that took more speed in an instant than the brakes could; boostStart: a boost's first frame), what the ground says (offroad: its grip under the tarmac's), what a game sets
 *  (boosting, damage 0–1, hit: an edge, charge 0–1, shield, invulnerable, item). */
export const FACTS = Object.freeze(['speed', 'throttle', 'braking', 'steer', 'skidding', 'skidTime', 'corner', 'cornerTime', 'landed', 'boosting', 'boostStart', 'accel', 'topShare', 'surge', 'impact', 'offroad', 'damage', 'hit', 'charge', 'shield', 'invulnerable', 'item']);

/** A trigger read into a tree: ['or'|'and', a, b] ['not', a] ['cmp', op, a, b] ['mul', a, b] ['abs', a] ['num', v]
 *  ['fact', name]. Throws on what it cannot read. */
export function compileWhen(src) {
  const toks = String(src).match(/\s*(\d+\.?\d*|&&|\|\||<=|>=|==|!=|[<>!()*]|[a-zA-Z]+)/g)?.map((t) => t.trim()) ?? [];
  if (toks.join('') !== String(src).replace(/\s+/g, '')) throw new Error(`juice: cannot read '${src}'`);
  let i = 0;
  const peek = () => toks[i], eat = (t) => { if (toks[i] !== t) throw new Error(`juice: '${src}': expected ${t} at ${toks[i] ?? 'the end'}`); i++; };
  const or = () => { let a = and(); while (peek() === '||') { i++; a = ['or', a, and()]; } return a; };
  const and = () => { let a = not(); while (peek() === '&&') { i++; a = ['and', a, not()]; } return a; };
  const not = () => (peek() === '!' ? (i++, ['not', not()]) : cmp());
  const cmp = () => { const a = mul(); const op = peek(); if (['<', '>', '<=', '>=', '==', '!='].includes(op)) { i++; return ['cmp', op, a, mul()]; } return a; };
  const mul = () => { let a = atom(); while (peek() === '*') { i++; a = ['mul', a, atom()]; } return a; };
  const atom = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error(`juice: '${src}' ends early`);
    if (t === '(') { const a = or(); eat(')'); return a; }
    if (/^\d/.test(t)) return ['num', Number(t)];
    if (t === 'abs') { eat('('); const a = or(); eat(')'); return ['abs', a]; }
    if (!FACTS.includes(t)) throw new Error(`juice: '${src}': '${t}' is not a fact (${FACTS.join(', ')})`);
    return ['fact', t];
  };
  const tree = or();
  if (i !== toks.length) throw new Error(`juice: '${src}': left over at ${toks[i]}`);
  return tree;
}

/** The figure's juice: anchors [{ kind, bone (null: the machine's frame), at, dir }] and rows with compiled triggers;
 *  its status rows (the slots a machine has: head, brake, accent, all, bubble) and its FX, triggers compiled too. */
export function bakeJuice(rows, anchors, D, { slots = {}, status = STATUS, fx = FX } = {}) {
  const has = (sl) => sl === 'all' || sl === 'bubble' || !!slots[sl];
  return {
    D, slots,
    status: Object.entries(status).filter(([, r]) => r.slots.some(has)).map(([id, r]) => ({ id, when: compileWhen(r.when), slots: r.slots.filter(has), look: r.look, colours: r.colours, ...(r.by ? { by: r.by } : {}), ...(r.tierAt ? { tierAt: r.tierAt } : {}), ...['amount', 'halo', 'duration', 'flicker', 'rate'].reduce((o, k) => (r[k] !== undefined ? { ...o, [k]: r[k] } : o), {}) })),
    fx: Object.entries(fx).filter(([, r]) => r.at === 'screen' || anchors.some((a) => a.kind === r.at || a.kind.split('.')[0] === r.at)).map(([id, r]) => ({ id, when: compileWhen(r.when), at: r.at, look: r.look, colours: r.colours, ...['count', 'life', 'size', 'rate', 'budget', 'by'].reduce((o, k) => (r[k] !== undefined ? { ...o, [k]: r[k] } : o), {}) })),
    anchors: anchors.map((a) => ({ kind: a.kind, bone: a.bone ?? null, at: a.at, dir: a.dir })),
    rows: rows.map((j) => ({ id: j.id, when: compileWhen(j.when), at: j.at, look: j.look, colours: j.colours, ...(j.rate ? { rate: j.rate } : {}), ...(j.life ? { life: j.life } : {}), size: j.size, budget: j.budget, ...(j.flicker ? { flicker: j.flicker } : {}), ...(j.tierBy ? { tierBy: j.tierBy, tierAt: j.tierAt } : {}) })),
  };
}
