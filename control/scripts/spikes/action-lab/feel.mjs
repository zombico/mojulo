/**
 * action-lab — FEEL: what a button does, as one card, played by one pure step.
 *
 * The animation-games spike retimed a take on its own clock. A game runs on the player's: THE PRESS IS THE BEAT. This
 * kernel decides the frame of every event (the take-off, the contact, the landing, a hitstop's edges) and the clips are
 * fitted to its frames afterwards (takes.mjs), never the other way. One FEEL card is read three ways: the kernel steps
 * it, the takes are fitted to it, and the frame data is read off it (`frameData`), so the three cannot disagree.
 *
 * A step takes the card (the game) and a BODY (the character: its reach and blow speed per move, its strides, its
 * mass). The same card on another body reaches shorter, hits lighter and strides differently; the same body in another
 * card moves to another game's physics.
 *
 *   realistic    the body on earth: momentum builds and costs, a jump waits for its gather, no holds, a blow's real
 *                momentum, the hit body's own flinch
 *   action       force made visible: top speed at once, a quick gather and a high hang, a light that snaps out in six
 *                frames (the deep wind-up lives inside the startup, never before it), both bodies frozen on the blow,
 *                a string of three cancelled one into the next on an authored stun, a rolling dodge with invincible
 *                frames, the finisher throws
 *   platformer   movement first: no gather, the platform rule's arc (8.5 m/s up on gravity 20, down on 34), the jump
 *                cut short on release, coyote time and a buffer, an air dash, a hit is a boop and then mercy
 *   pinball      speed: momentum that builds long and keeps, steering not turning, every wall a bumper, a boost that
 *                cannot be hurt, a hit ricochets out faster than it came
 *
 * JUMPING ON a body (the card's `land`): realistic and action slide off its top into open space (nobody stands on a
 * head), and action's ENEMY STEP turns a jump pressed while touching a body in the air into a fresh jump; platformer
 * STOMPS (the body is squashed, the stomper bounces, higher with the jump held); pinball's spinning body BOUNCES off it
 * like a bumper and the body ricochets. Bodies never pass into each other: walking into one stops at its side.
 *
 * THE AIR JUMP AND THE WALL (the card's `air` and `cling`), Mega Man X's way: a jump pressed in the air, once it is
 * no coyote jump, no wall jump and no enemy step, is an air jump while the card has one left (reset on landing and on
 * a wall). Falling against a wall with the stick into it SLIDES down it at a constant speed; a jump on the wall (or a
 * few frames after leaving it) KICKS off it, up and away, the stick locked out for the kick's frames, after which
 * holding back toward the wall carries the body back to it: a single wall climbed by repeated wall jumps. The
 * non-realistic feels have both; realistic neither.
 *
 * TWO BUTTONS, TWO GETAWAYS. DODGE is the DIRECTIONAL ROLL (the card's `dodge`): along the stick, the body keeping its
 * facing, so it reads as a roll forward, a roll to the left or the right, or a hop back; the stick at rest is a
 * backstep, shorter. DASH is the dash (the card's `dash`), Mega Man X's: the ground dash, the AIR DASH (gravity off,
 * once an airtime, given back by landing and by a wall), the DASH JUMP (a jump in a ground dash leaves at once and the
 * air keeps the dash's speed), the DASH WALL JUMP (the kick at the dash's speed, kept), and X's dash lasting as long
 * as the button is held. Realistic has no dash (it sprints) and steps rather than rolls.
 *
 * LOCK-ON (the card's `lock`): LOCK takes the dummy as the target when it is in range and lets it go on the next press
 * (or when it walks out past the range). Locked, the body turns to face the target and keeps facing it, so the stick
 * strafes (slower), an attack goes at it, and a roll is read against it: its toward-and-away part along the line to
 * the target and its around part across that line, taken afresh each frame, so a side roll CIRCLES the target at its
 * distance, a roll forward closes, back opens, and a diagonal spirals. Realistic and action lock on; the platformer and
 * pinball do not target.
 *
 * GUARD AND PARRY (the card's `guard`, the attack's ZONES): every enemy attack swings across an ARC, red with an orange
 * segment (some attacks all orange, some all red and unblockable: those must be dodged). GUARD held blocks a hit from
 * the front (no stun: a short blockstun and a push back; a hit from behind still lands); a hit met in ORANGE by a guard
 * pressed within the card's `parry` frames (null: any guard) is PARRIED, the attacker staggered open for a riposte and
 * the guard free at once; met in red, it is only blocked. Realistic's guard spends stamina (empty, it breaks into a stagger);
 * action's PERFECT DODGE, a roll or dash whose invincible frames meet a hit in its first frames, slows the attacker to
 * half speed (Witch Time). The platformer and pinball do not guard (pinball's boost is its defence).
 *
 * HOLD AND RELEASE (the card's `charge`): the attack's press acts at once (the tap is the card's light, never delayed)
 * and holding the button on charges it; RELEASE is the beat of the charged attack, at the level the hold reached
 * (counted from the press, frozen frames not counted), and a release short of the first level fizzles. Realistic and
 * action charge a HEAVY (the haymaker; action's second level a launcher) in a stance once the tap's move ends: a slow
 * walk, no jump, a roll or a guard lets it go. The platformer charges Mega Man X's BUSTER: no stance, the body runs and
 * jumps with the charge held, and the release fires a shot (a small one, then the full charge) from wherever it is.
 * Pinball revs a SPIN DASH, rooted, the stick aiming it, and the release launches it at the level's speed. A hit taken
 * loses the charge.
 *
 * OFFENSE ARMOR (an attack's `armor`, a hit's `tags`): what it takes to interrupt an attack. Every hit is tagged
 * (light or heavy, and its kind: shot, stomp, launcher); an attack with no armor stops at any hit; an armored one, in
 * its armor frames, stops only at a hit carrying one of the tags it names (heavy only; or a TRIGGER, a certain kind of
 * attack: the hook breaks to a heavy or a shot), or at its `hits`th hit (poise: it shrugs off the first); `by: []`
 * is HYPER armor, nothing interrupts it. A hit the armor holds against lands as a clank: no stun, no push, a short
 * freeze, the attack goes on. The dummy's jab stops at a touch, its hook only at a heavy or a shot, its perilous
 * blow never; realistic's haymaker shrugs off one light hit, action's heavy every light one, action's launcher all.
 *
 * THE GLIDER AND THE JETPACK (the card's `glide` and `jet`, the gear the state is given): the jump button, in the
 * air once the air jumps are spent, or held on past the apex. Realistic's glider is BotW's PARAGLIDER (opened by a
 * press from a height, a steady sink and forward speed, steered, folded by a press, its stamina limited) and its
 * jetpack a THRUST that barely beats gravity on a small tank that refills a beat after landing. Action GLIDES as Spyro
 * (held: a sink, a speed it settles on, a quick turn) and HOVERS on its jetpack. The platformer FLOATS as Peach (held,
 * the height kept a second, once a jump) and its jetpack is a strong short burst. Pinball glides as Knuckles (from a
 * slow start building speed, and a glide into a wall grabs it) and flies as Tails (each press a flap, a slow sink
 * between, until it tires). Nothing changes with no gear.
 *
 * RANGED ATTACKS (the card's `ranged`, the patterns in RANGED): the dummy turned shooter telegraphs, then fires a
 * pattern its genre uses. Realistic is the FPS's: HITSCAN, a bullet with no flight to react to, so it is not dodged
 * but denied (cover breaks the line, and the aim trails the target by a reaction, so a body that keeps moving across it
 * is missed; the marksman's aim locks a beat before the shot). Action splits: the ARENA's orbs, fans, rings and homing
 * shots, dodged by the roll's invincible frames or out-run, and the BRAWLER's knife (low and slow: step off its line or
 * jump it) and gun (a long aim, then fast; it knocks down). The platformer's and pinball's shots are slow and cross
 * the room at their own speeds: spreads, aimed shots, lobs that burst, weaving shots, bouncing balls.
 *
 * WHAT A HIT DOES (the card's `hurt` and `life`): the FPS's flinch keeps control and slows the run for a moment; the
 * others stop it, knock the body back (pinball's up and away) and stun it, and then give MERCY frames, invincible, so
 * nobody dies too fast (none in the FPS). A hit takes life: health; pinball's rings (a hit scatters them all, a hit
 * with none is the end); `oneHit` the games where any hit is death. Out of life the body is down, then up again full.
 * Whether a hit knocks the body out of its charge is the card's (`hurt.charge`). MANEUVER ARMOR (the card's
 * `maneuver`): moving in one of its ways (dashing, sprinting, rolling, running past a speed), a hit's stun and knock
 * are cut to the card's shares (0: hyper armor while moving, the body runs on through it), its damage still taken.
 *
 * THE STOMP ATTACK (the card's `pound`): an attack in the air turned downward. Action's PLUNGE (back + attack; the
 * attack alone stays the air jab) drops at once and its landing is a launching blow on a body or a shockwave beside
 * one, then a landing lag. Platformer's GROUND POUND (Mario) flips in place, drops straight, stomps a body harder and
 * always bounces high; on the floor its lag takes a jump as the higher ground-pound jump. Pinball's BOUNCE ATTACK drops
 * with no hang and bounces back up off the floor or a body. Realistic has none.
 *
 * THE LAWS every card keeps (verify.mjs): the same pad gives the same trace; an idle pad moves nothing; every press ends
 * acted on or dropped with its reason; a ground jump leaves on press + commit; a buffered or coyote jump within its
 * window jumps and one frame past it does not; a held jump rises monotonic in the hold and the full hold reaches the
 * card's height; contact on the card's startup; a hitstop freezes both bodies for the same frames; no body passes a
 * wall at any speed.
 *
 *   FPS, DT, BTN, FEELS, FEEL_IDS, ARENA
 *   newState(card, body, { arena, spar, guard }) → state      (the card is held by the state: dials edit it live)
 *   step(state, pad) → state'   pad = [x, y, buttons], or a bare number (buttons, the stick at rest): the stick in −127..127 (+y ahead, +x right), BTN bits
 *   poseOf(state, who) → what the body shows (a clip and a frame in it: takes.mjs bakes them)
 *   frameData(card, body) → per move: startup, active, recovery, total, cancel, and its advantage on hit and on block
 *
 * NO IMPORTS: the page inlines this file's text (lab.mjs), so the gate and the eyes run the same code. Pure and
 * deterministic: no Math.random, no Date. A lab: nothing registers.
 */
export const FPS = 60;
export const DT = 1 / FPS;
export const BTN = Object.freeze({ JUMP: 1, ATTACK: 2, DODGE: 4, SPRINT: 8, DASH: 16, LOCK: 32, GUARD: 64 });
const G = 9.81, RADIUS = 0.3, STEP = 0.12, DEG = Math.PI / 180, HEIGHT = 1.7;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const len2 = (x, y) => Math.hypot(x, y);

/**
 * The cards. Times in frames at 60 fps unless named `s`; speeds m/s; accelerations m/s²; turn deg/s.
 *
 *   ground   walk / run / sprint (stick full is run, SPRINT held is sprint), accel (toward the stick), decel (no stick,
 *            or against it), turn (facing), steer (deg/s: the velocity's heading turns at most this fast, a
 *            projectile's arc; absent: the velocity moves straight to the stick's)
 *   jump     commit (frames from the press on the ground to the take-off: the gather), height (m, the full hold's
 *            apex), gRise, gFall, cut (the rise's speed times this on release; 1: no cut), hang (frames held at the
 *            apex while the button is held), coyote (frames after walking off an edge a jump still takes), buffer
 *            (frames a press in the air waits for the landing), air (the share of ground control in the air), maxFall,
 *            land (frames the landing shows standing), heavy { fall (m/s), lag (frames without control) }
 *   dodge    the directional roll (DODGE): kind (step | roll), frames, speed, iframes [from, to) or null, back
 *            ({ speed, frames }: a roll or a backstep behind the facing, shares of the forward), cancel (out of a move's
 *            recovery). The roll goes along the stick and the body keeps its facing; the stick at rest is a backstep
 *   dash     the dash (DASH), or null: kind (dash | boost), frames, speed, iframes, hold ({ min }: the dash lasts while
 *            the button is held, `frames` at most, `min` at least), jump (a jump in a ground dash is a DASH JUMP: it
 *            leaves at once and the air keeps the dash's speed), wall (a wall jump with the dash held kicks at its
 *            speed and keeps it), air ({ count, speed, frames }: the AIR DASH, gravity off, `count` an airtime, given
 *            back by landing and by a wall; null: none), cancel (out of a move's recovery)
 *   moves    string: the moves a press chains through, each { take, startup, snap (load → contact, inside startup),
 *            active, recovery, wings { wind, after } (how far the wind-up and follow-through go from ready: the clip's,
 *            takes.mjs), lunge (m stepped through startup), finisher, force (over the card's) }; cancel ('none',
 *            'half': half way through recovery, or frames after active), buffer, root (stop: a move plants the feet;
 *            keep: it carries the run), air (moves allowed off the ground)
 *   hit      hitstop { base, perMs, max } or null (frames, both bodies), stun ({ model: 'body' } the flinch the blow
 *            causes; { model: 'rule', base s, decay, min s } combat-hit's combo rule; { model: 'none' }), force
 *            (momentum { gain, lift deg } | boop { push, bounce, hop } | ricochet { restitution, floor }), mercy (frames
 *            a hit body cannot be hit again), alert (frames a free body that saw a hit guards the next)
 *   wall     stop { stagger m/s } | bonk { above, rebound, hop } | bounce { e, cap, soft (m/s: in the air, a slower
 *            contact is a plain wall, so a body can come to rest on it and cling) }
 *   air      the air jump, or null: jumps (in the air, reset on landing and on a wall), mult (× the jump's height)
 *   cling    the wall, or null: slide (m/s down it), toward (the stick's share into the wall that holds it), up (× the
 *            jump's height: the wall jump), away (m/s off the wall), lock (frames the kick ignores the stick), coyote
 *            (frames after leaving the wall a jump still kicks off it)
 *   lock     lock-on, or null: range (m: a target within it can be taken; past it + 3 m the lock is lost), turn
 *            (deg/s: the facing toward the target), strafe (the share of the run the stick gets while locked)
 *   guard    guard and parry, or null: move (the share of the run the stick gets while guarding; 0 rooted), block
 *            { push (m/s back), stun (frames of blockstun) }, parry (frames after the press an orange hit is parried;
 *            null: guarding in orange is enough), riposte
 *            (frames a parried attacker is staggered), stamina ({ max, cost (a block), regen (/s, not guarding), break
 *            (frames staggered when it runs out) } or null), perfect ({ window (a dodge's first frames), witch (frames
 *            the attacker runs at half speed) } or null)
 *   charge   hold and release, or null: kind (heavy: a charged blow | shot: a projectile | spin: the spin dash), levels
 *            (frames held from the press to reach each level), show (frames held before the charge shows: a release
 *            short of it is a plain tap, past it and short of a level it fizzles), stance (once the tap's move ends the
 *            body holds a charging stance: `move` its share of the run, 0 rooted with the stick aiming, no jump; false:
 *            the meter runs while the body does anything, X's), air (it fires off the ground), at (per level: the charged
 *            move, as a string's | the shot { speed, size (m), life (frames), force } | the spin { speed, frames })
 *            A move (a string's, a charged one, the dummy's) may carry `tags` (the hit's kind: absent, a finisher is
 *            heavy and the rest light) and `armor` ({ by: [tags that interrupt it], hits (the hit that interrupts it
 *            whatever its tags; absent: none), frames [from, to) (absent: through startup + active) } or absent: any
 *            hit interrupts it)
 *   glide    the glider, or null: kind (paraglider: opened and folded by a press | glide: held | float: held, the height
 *            kept), min (m above the floor to open one), fall (m/s down), from / speed (m/s: the forward speed it starts
 *            at least at and settles on), accel, turn (deg/s), time (frames: its stamina, or a float's length; null:
 *            none), grab (a glide into a wall grabs it)
 *   jet      the jetpack, or null: kind (thrust: held, upward thrust against the fall's gravity | hover: held, the rise
 *            eased to `rise` | flap: each press a flap of `flap` m/s, the fall slowed to `sink` between), thrust (m/s²),
 *            rise (m/s: the climb's cap), fuel (frames: thrust held, or a flight's length), delay / regen (frames on the
 *            ground before the tank refills, fuel back per frame; a flight refills on landing), air (the share of ground
 *            control while it flies)
 *   ranged   the dummy as a shooter: sets ({ name: [RANGED pattern names] }: the patterns a genre uses, cycled one a
 *            volley), every (frames between volleys)
 *   hurt     what a hit does to the hero: stun (frames; 0: a flinch that keeps control), knock (m/s away), hop (m up),
 *            down (frames: a knockdown pattern's stun), slow ({ frames, share }: a flinch's slowed run), mercy (frames
 *            invincible after a ranged hit), charge (lose | keep: does a stunning hit knock out of the charge)
 *   life     hp, kind (hp | rings: a hit scatters every ring, a hit with none is the end), oneHit (any hit is the
 *            end), ko (frames down before up again, full)
 *   maneuver maneuver armor, or null: on (dash | roll | sprint | run | air: the moving ways it covers), speed (m/s: the
 *            run's threshold), stun and knock (the shares a hit keeps while moving; 0 hyper)
 *   pound    the stomp attack, or null: kind (plunge | pound | bounce), stick (back: back + attack, any: attack),
 *            hang (frames held in the air first), speed (m/s down), radius (m: a plunge's shockwave), force (over the
 *            card's hit force), stun (frames: a pound's stomp), lag (frames on the floor), jump (× the jump's height:
 *            a jump in the pound's lag), bounce (m: the bounce attack's rebound)
 *   land     what coming down on a body does: slide { slide m/s, step { cooldown } } (off its top; `step` the enemy
 *            step) | stomp { low, high (m: the bounce, the jump held for high), stun (frames squashed) } | bounce { min (m:
 *            the least rebound), restitution, floor (the body's ricochet, as hit.force) }
 *   look     squash (the volume-kept squash and stretch at take-off and landing), smear (m a hand jumps a frame)
 */
export const FEELS = Object.freeze({
  realistic: {
    says: 'the body on earth: momentum builds and costs, a jump waits for its gather, no holds, real momentum',
    ground: { walk: 1.4, run: 3.5, sprint: 6.5, accel: 6, decel: 9, turn: 540 },
    jump: { commit: 12, height: 0.45, gRise: G, gFall: G, cut: 1, hang: 0, coyote: 3, buffer: 6, air: 0.1, maxFall: 30, land: 10, heavy: { fall: 5.5, lag: 12 } },
    dodge: { kind: 'step', frames: 22, speed: 3.2, iframes: null, back: { speed: 0.7, frames: 0.8 }, cancel: false },
    dash: null,
    lock: { range: 12, turn: 540, strafe: 0.5 },
    guard: { move: 0.35, block: { push: 1.2, stun: 14 }, parry: 6, riposte: 60, stamina: { max: 100, cost: 40, regen: 40, break: 45 }, perfect: null },
    moves: {
      string: [
        { take: 'jab', startup: 11, snap: 6, active: 2, recovery: 12, wings: { wind: 1, after: 1 }, lunge: 0.08 },
        { take: 'jab', startup: 11, snap: 6, active: 2, recovery: 12, wings: { wind: 1, after: 1 }, lunge: 0.08 },
        { take: 'cross', startup: 15, snap: 8, active: 2, recovery: 16, wings: { wind: 1, after: 1 }, lunge: 0.12 },
      ],
      cancel: 'half', buffer: 8, root: 'stop', air: false,
    },
    hit: { hitstop: null, stun: { model: 'body' }, force: { model: 'momentum', gain: 1, lift: 0 }, mercy: 0, alert: 60 },
    wall: { model: 'stop', stagger: 3.5 },
    land: { model: 'slide', slide: 2 },
    pound: null,
    glide: { kind: 'paraglider', min: 1.2, fall: 1.5, speed: 6, accel: 4, turn: 90, time: 600 },
    jet: { kind: 'thrust', thrust: 15, rise: 3, fuel: 120, delay: 30, regen: 1, air: 0.4 },
    ranged: { sets: { fps: ['rifle', 'marksman'] }, every: 120 },
    hurt: { stun: 0, knock: 0, slow: { frames: 24, share: 0.5 }, mercy: 0, charge: 'keep' },
    life: { hp: 100, ko: 90 },
    maneuver: null,
    charge: { kind: 'heavy', levels: [40], show: 30, stance: true, move: 0.3, air: false, at: [
      { take: 'cross', startup: 14, snap: 8, active: 3, recovery: 24, wings: { wind: 1.35, after: 1.25 }, lunge: 0.35, force: { gain: 1.8 }, tags: ['heavy'], armor: { by: ['heavy'], hits: 2 } },
    ] },
    air: null,
    cling: null,
    look: { squash: 0, smear: null },
  },
  action: {
    says: 'force made visible: top speed at once, a quick gather and a hang, a light that snaps, both bodies frozen on the blow',
    ground: { walk: 2, run: 6.5, sprint: 9, accel: 45, decel: 60, turn: 1440 },
    jump: { commit: 3, height: 1.3, gRise: 28, gFall: 40, cut: 0.45, hang: 5, coyote: 6, buffer: 8, air: 0.85, maxFall: 25, land: 4, heavy: null },
    dodge: { kind: 'roll', frames: 24, speed: 8.5, iframes: [2, 15], back: { speed: 0.7, frames: 0.75 }, cancel: true },
    lock: { range: 14, turn: 1440, strafe: 0.85 },
    guard: { move: 0, block: { push: 2, stun: 10 }, parry: 12, riposte: 50, stamina: null, perfect: { window: 6, witch: 120 } },
    dash: { kind: 'dash', frames: 14, speed: 12, iframes: null, air: { count: 1, speed: 9, frames: 14 }, cancel: true, hold: null, jump: true, wall: true },
    moves: {
      string: [
        { take: 'jab', startup: 6, snap: 2, active: 3, recovery: 14, wings: { wind: 1.6, after: 1.4 }, lunge: 0.3 },
        { take: 'jab', startup: 6, snap: 2, active: 3, recovery: 14, wings: { wind: 1.6, after: 1.4 }, lunge: 0.3 },
        { take: 'cross', startup: 9, snap: 3, active: 3, recovery: 22, wings: { wind: 1.8, after: 1.5 }, lunge: 0.4, finisher: true, force: { gain: 12, lift: 18 } },
      ],
      cancel: 2, buffer: 12, root: 'stop', air: true,
    },
    hit: { hitstop: { base: 4, perMs: 0.6, max: 14 }, stun: { model: 'rule', base: 0.5, decay: 0.85, min: 0.12 }, force: { model: 'momentum', gain: 2, lift: 0 }, mercy: 0, alert: 60 },
    wall: { model: 'stop', stagger: null },
    land: { model: 'slide', slide: 3, step: { cooldown: 12 } },
    air: { jumps: 1, mult: 0.8 },
    cling: { slide: 2.5, toward: 0.3, up: 0.9, away: 4, lock: 6, coyote: 4 },
    pound: { kind: 'plunge', stick: 'back', hang: 4, speed: 22, radius: 1.2, force: { gain: 12, lift: 35 }, lag: 14 },
    glide: { kind: 'glide', fall: 2, speed: 8, accel: 12, turn: 180, time: null },
    jet: { kind: 'hover', thrust: 30, rise: 0.5, fuel: 90, delay: 20, regen: 1.5, air: 1 },
    ranged: { sets: { arena: ['orb', 'fan', 'ring', 'homing'], brawler: ['knife', 'gun'] }, every: 120 },
    hurt: { stun: 24, knock: 3, down: 60, mercy: 40, charge: 'lose' },
    life: { hp: 100, ko: 90 },
    maneuver: { on: ['dash', 'sprint'], stun: 0, knock: 0.25 },
    charge: { kind: 'heavy', levels: [30, 70], show: 26, stance: true, move: 0.4, air: false, at: [
      { take: 'cross', startup: 8, snap: 3, active: 4, recovery: 20, wings: { wind: 2.1, after: 1.6 }, lunge: 0.6, force: { gain: 16, lift: 8 }, tags: ['heavy'], armor: { by: ['heavy'] } },
      { take: 'cross', startup: 8, snap: 3, active: 4, recovery: 26, wings: { wind: 2.4, after: 1.8 }, lunge: 0.9, finisher: true, force: { gain: 20, lift: 42 }, tags: ['heavy', 'launcher'], armor: { by: [] } },
    ] },
    look: { squash: 0.06, smear: 0.09 },
  },
  platformer: {
    says: 'movement first: no gather, the platform rule\'s arc, a cut jump, coyote and buffer, an air dash, a hit is a boop',
    ground: { walk: 2.5, run: 6, sprint: 8, accel: 75, decel: 75, turn: Infinity },
    jump: { commit: 0, height: 1.806, gRise: 20, gFall: 34, cut: 0.5, hang: 0, coyote: 6, buffer: 6, air: 0.7, maxFall: 18, land: 4, heavy: null },
    dodge: { kind: 'roll', frames: 20, speed: 8, iframes: null, back: { speed: 0.7, frames: 0.75 }, cancel: false },
    lock: null,
    guard: null,
    dash: { kind: 'dash', frames: 30, speed: 9, iframes: null, air: { count: 1, speed: 9, frames: 24 }, cancel: false, hold: { min: 6 }, jump: true, wall: true },
    moves: {
      string: [{ take: 'jab', startup: 4, snap: 2, active: 4, recovery: 10, wings: { wind: 1.25, after: 1.2 }, lunge: 0 }],
      cancel: 'none', buffer: 6, root: 'keep', air: true,
    },
    hit: { hitstop: { base: 2, perMs: 0, max: 2 }, stun: { model: 'none' }, force: { model: 'boop', push: 2.5, bounce: 3, hop: 0.3 }, mercy: 60, alert: 0 },
    wall: { model: 'bonk', above: 4.5, rebound: 3, hop: 0.5 },
    land: { model: 'stomp', low: 0.6, high: 1.806, stun: 90 },
    air: { jumps: 1, mult: 0.9 },
    cling: { slide: 2, toward: 0.3, up: 1, away: 5, lock: 8, coyote: 5 },
    pound: { kind: 'pound', stick: 'any', hang: 12, speed: 20, stun: 150, lag: 10, jump: 1.35 },
    glide: { kind: 'float', time: 60 },
    jet: { kind: 'thrust', thrust: 50, rise: 5, fuel: 60, delay: 0, regen: 3, air: 0.9 },
    ranged: { sets: { platformer: ['pellet', 'aimed', 'lob', 'wave'] }, every: 100 },
    hurt: { stun: 20, knock: 2, hop: 0.2, mercy: 90, charge: 'keep' },
    life: { hp: 28, oneHit: false, ko: 90 },
    maneuver: { on: ['dash'], stun: 0.5, knock: 0.5 },
    charge: { kind: 'shot', levels: [24, 66], show: 16, stance: false, air: true, at: [
      { speed: 14, size: 0.15, life: 50, force: { push: 4 }, tags: ['light', 'shot'] },
      { speed: 16, size: 0.4, life: 60, force: { push: 7, hop: 0.7 }, tags: ['heavy', 'shot'] },
    ] },
    look: { squash: 0.22, smear: null },
  },
  pinball: {
    says: 'speed: momentum that builds long and keeps, steering not turning, every wall a bumper, a hit ricochets',
    ground: { walk: 3, run: 12, sprint: 20, accel: 7, decel: 2.5, turn: 720, steer: 200 },
    jump: { commit: 0, height: 1.0, gRise: 15.7, gFall: 15.7, cut: 0.6, hang: 0, coyote: 6, buffer: 6, air: 0.3, maxFall: 30, land: 0, heavy: null, spin: true },
    dodge: { kind: 'roll', frames: 16, speed: 10, iframes: [0, 8], back: { speed: 0.7, frames: 0.75 }, cancel: true },
    lock: null,
    guard: null,
    dash: { kind: 'boost', frames: 20, speed: 8, iframes: [0, 20], air: { count: 1, speed: 8, frames: 16 }, cancel: true, hold: null, jump: true, wall: true },
    moves: {
      string: [{ take: 'jab', startup: 3, snap: 1, active: 3, recovery: 6, wings: { wind: 1, after: 1 }, lunge: 0 }],
      cancel: 'none', buffer: 6, root: 'keep', air: true,
    },
    hit: { hitstop: null, stun: { model: 'none' }, force: { model: 'ricochet', restitution: 1.3, floor: 6 }, mercy: 20, alert: 0 },
    wall: { model: 'bounce', e: 1.3, cap: 20, soft: 3 },
    land: { model: 'bounce', min: 1.0, restitution: 1.3, floor: 6 },
    air: { jumps: 1, mult: 0.7 },
    cling: { slide: 4, toward: 0.3, up: 0.8, away: 8, lock: 6, coyote: 4 },
    pound: { kind: 'bounce', stick: 'any', hang: 0, speed: 25, bounce: 1.6 },
    glide: { kind: 'glide', from: 4, fall: 1, speed: 12, accel: 3, turn: 120, grab: true, time: null },
    jet: { kind: 'flap', flap: 3.5, sink: 1.5, fuel: 480, air: 0.8 },
    ranged: { sets: { pinball: ['buzz', 'burst', 'bouncer'] }, every: 120 },
    hurt: { stun: 30, knock: 4, hop: 0.6, mercy: 120, charge: 'lose' },
    life: { kind: 'rings', hp: 10, ko: 90 },
    maneuver: { on: ['run'], speed: 9, stun: 0, knock: 0 },
    charge: { kind: 'spin', levels: [20, 50], show: 14, stance: true, move: 0, air: false, at: [{ speed: 14, frames: 20 }, { speed: 20, frames: 28 }] },
    look: { squash: 0.1, smear: 0.05 },
  },
});
export const FEEL_IDS = Object.freeze(Object.keys(FEELS));

/** The arena: a square floor walled at ±half, and blocks { x: [x0, x1], y: [y0, y1], h } (a ledge to jump on, a wall). */
export const ARENA = Object.freeze({
  half: 9,
  blocks: [
    { id: 'low', x: [-7, -3], y: [1, 5], h: 0.4 },
    { id: 'ledge', x: [3, 7], y: [2, 4.5], h: 1.1 },
    { id: 'wall', x: [-2, 2], y: [7, 7.6], h: 2.5 },
    { id: 'tower', x: [5.5, 7.5], y: [-7.5, -5.5], h: 5 },
  ],
  hero: [0, -3], dummy: [0, 0],
});

// ─── state ───────────────────────────────────────────────────────────────
const copy = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 'Infinity' : v)), (k, v) => (v === 'Infinity' ? Infinity : v));
function bodyAt(xy, yaw, h = HEIGHT) {
  return { h, charge: null, slowed: 0, hp: null, glide: false, glideT: 0, glideSpent: false, jet: false, flying: false, fuel: 0, jetRest: 0, blockstun: 0, airDashes: 0, carry: 0, airLeft: 0, cling: null, wallN: null, wallCoyote: 0, wallLock: 0, onHead: false, touching: false, stepCd: 0, squash: 0, fresh: false, touched: -99, p: [xy[0], xy[1], 0], v: [0, 0, 0], yaw, grounded: true, coyote: 0, jumped: false, cut: false, hang: 0, apex: null,
    act: null, stop: 0, stun: 0, mercy: 0, lag: 0, alert: 0, combo: 0, lastHit: null, stride: 0, spin: 0,
    tookOff: -99, landed: -99, fallSpeed: 0 };
}
/**
 * A new lab: the card (copied: dials edit the state's own), the body (takes.mjs `bodyOf`: reach and real blow speed
 * per take, strides, mass), the arena. `spar`: the dummy throws a telegraphed jab at a hero in range. `guard`: a free
 * dummy that saw a hit coming guards the next one. `dummyHeight` (m): a short critter (0.8) can be jumped on by
 * every feel's jump; the standing dummy (1.7) is taller than most. `shooter`: the dummy fires these RANGED patterns
 * instead of sparring (one a volley, every `ranged.every` frames). `gear`: 'glide' or 'jet', what the jump does in the
 * air once the air jumps are spent (null: nothing).
 */
export function newState(card, body, { arena = ARENA, spar = false, guard = true, dummyHeight = HEIGHT, sparMoves = null, shooter = null, gear = null } = {}) {
  const S = { f: 0, card: copy(card), body, arena, spar: shooter ? false : spar, guard, sparMoves, sparN: 0, events: [], queue: [], shots: [], shotN: 0, shooter, gear, foes: [], foeN: 0, volleyN: 0, trail: [], held: 0, lock: null, witch: 0,
    hero: bodyAt(arena.hero, 0), dummy: bodyAt(arena.dummy, Math.PI, dummyHeight) };
  S.hero.airLeft = card.air?.jumps ?? 0; S.hero.airDashes = card.dash?.air?.count ?? 0; S.hero.stamina = card.guard?.stamina?.max ?? null; S.hero.hp = card.life?.hp ?? null; S.hero.fuel = card.jet?.fuel ?? 0;
  return S;
}

// ─── the step ───────────────────────────────────────────────────────────
/**
 * One tick. The order: the press edges are read (each acted now, queued for its buffer, or dropped); the queue is
 * tried; each body unfrozen moves (control, its act, gravity, the walls, the ground); the queue is tried again (a press
 * meeting its landing); the hits are tested; the timers run. A frozen body (hitstop) changes nothing at all.
 */
export function step(S0, pad) {
  const S = copy(S0); S.events = [];
  const [px, py, b] = typeof pad === 'number' ? [0, 0, pad] : pad ?? [0, 0, 0];   // a bare number: buttons, the stick at rest
  const pressed = b & ~S.held, released = S.held & ~b; S.held = b;
  const stick = stickOf(px, py);
  const H = S.hero, D = S.dummy;
  for (const [name, bit] of [['jump', BTN.JUMP], ['attack', BTN.ATTACK], ['dodge', BTN.DODGE], ['dash', BTN.DASH], ['lock', BTN.LOCK], ['guard', BTN.GUARD]]) if (pressed & bit) press(S, name, stick);
  if (S.lock && targetDist(S) > S.card.lock.range + 3) { S.lock = null; S.events.push({ f: S.f, who: 'hero', type: 'lock-lost' }); }
  if ((released & BTN.JUMP) && !H.stop) cutJump(S, H);
  if ((released & BTN.ATTACK) && H.charge) H.charge.letGo = true;
  if (H.charge?.letGo && !H.stop) release(S, stick);   // the release is the beat (a frozen hero lets go when it thaws)
  tryQueue(S, stick);
  // Witch Time: the attacker runs at half speed (it skips every other tick: its move, its blow, its timers)
  const slow = S.witch > 0 && S.f % 2 === 1;
  if (S.witch > 0 && --S.witch === 0) S.events.push({ f: S.f, who: 'dummy', type: 'witch-end' });
  if (!H.stop) moveBody(S, H, 'hero', stick, b);
  if (!D.stop && !slow) moveBody(S, D, 'dummy', null, 0);
  if (!H.stop) bodies(S);
  tryQueue(S, stick);
  if (!H.stop) testHit(S, H, D, 'hero');
  if (!D.stop && !slow) { sparThink(S); shooterThink(S); testHit(S, D, H, 'dummy'); }
  flyShots(S); if (!slow) flyFoes(S);
  for (const [w, B] of [['hero', H], ['dummy', D]]) {
    if (w === 'dummy' && slow) continue;
    // a frozen body changes nothing; the tick that struck (or was struck) still shows its own frame and runs on
    if (B.stop && !B.fresh) { B.stop--; continue; }
    B.fresh = false;
    if (B.act) { B.act.shown = B.act.f; B.act.f++; endAct(S, B, w); }
    if (B.stun > 0 && --B.stun === 0) S.events.push({ f: S.f, who: w, type: 'free' });
    if (B.mercy > 0) B.mercy--;
    if (B.alert > 0) B.alert--;
    if (B.lag > 0) B.lag--;
    if (B.stepCd > 0) B.stepCd--;
    if (B.wallLock > 0) B.wallLock--;
    if (B.wallCoyote > 0 && !B.cling && B.leftWall !== S.f) B.wallCoyote--;   // counted from the frame after leaving, as the ground's
    if (B.squash > 0) B.squash--;
    if (B.blockstun > 0) B.blockstun--;
    if (B.slowed > 0) B.slowed--;
    const ST = S.card.guard?.stamina; if (ST && w === 'hero' && B.act?.kind !== 'block') B.stamina = Math.min(ST.max, B.stamina + ST.regen * DT);
    if (w === 'hero' && B.charge) meter(S, B);
    if (w === 'hero' && S.gear === 'jet') {   // the tank: refilled a beat after landing (a flight on landing); a flight's time runs out
      const JT = S.card.jet;
      if (B.grounded) { if (JT.kind === 'flap') B.fuel = JT.fuel; else if (++B.jetRest > JT.delay) B.fuel = Math.min(JT.fuel, B.fuel + JT.regen); }
      else { B.jetRest = 0; if (B.flying && B.fuel > 0 && --B.fuel === 0) S.events.push({ f: S.f, who: 'hero', type: 'tired' }); }
    }
  }
  for (const q of S.queue) if (!H.stop) q.age++;
  S.trail.unshift([H.p[0], H.p[1], H.p[2]]); if (S.trail.length > 40) S.trail.length = 40;   // where the hero was: a shooter's aim trails it
  S.f++;
  return S;
}

function stickOf(px, py) {
  let x = clamp(px, -127, 127) / 127, y = clamp(py, -127, 127) / 127; const m = len2(x, y);
  if (m < 0.2) return { x: 0, y: 0, m: 0 };
  if (m > 1) { x /= m; y /= m; }
  return { x, y, m: Math.min(1, m) };
}

// ─── presses: acted, queued, dropped ─────────────────────────────────────
function press(S, name, stick) {
  S.events.push({ f: S.f, who: 'hero', type: 'press', button: name });
  const why = S.hero.stop ? { reason: 'hitstop', queue: true } : can(S, name, stick);
  if (why === true) return act(S, name, stick, 0);
  const buf = name === 'jump' ? S.card.jump.buffer : name === 'attack' ? S.card.moves.buffer : 0;
  if (buf > 0 && why.queue) { S.queue.push({ button: name, f: S.f, age: 0, buffer: buf, why: why.reason }); S.events.push({ f: S.f, who: 'hero', type: 'buffered', button: name, why: why.reason }); return; }
  S.events.push({ f: S.f, who: 'hero', type: 'dropped', button: name, why: why.reason });
}
function tryQueue(S, stick) {
  if (S.hero.stop) return;
  S.queue = S.queue.filter((q) => {
    if (q.age > q.buffer) { S.events.push({ f: S.f, who: 'hero', type: 'dropped', button: q.button, why: `buffer ran out (${q.buffer} f): ${q.why}`, pressedAt: q.f }); return false; }
    if (can(S, q.button, stick) !== true) return true;
    act(S, q.button, stick, q.age); return false;
  });
}
/** can the hero act on a press now: true, or { reason, queue (may it wait for its buffer) } */
function can(S, name, stick = { x: 0, y: 0, m: 0 }) {
  const H = S.hero, C = S.card, a = H.act;
  if (H.stun > 0) return { reason: 'in hitstun', queue: true };
  if (H.blockstun > 0) return { reason: 'in blockstun', queue: true };
  if (a && (a.kind === 'stagger' || a.kind === 'bonk' || a.kind === 'hurt' || a.kind === 'ko')) return { reason: a.kind === 'ko' ? 'down (out of life)' : `in ${a.kind}`, queue: a.kind !== 'ko' };
  if (H.lag > 0) return { reason: 'landing lag', queue: true };
  if (a?.kind === 'charge' && name !== 'dodge' && name !== 'guard' && name !== 'lock') return { reason: 'charging: release the attack to strike', queue: false };
  if (name === 'jump') {
    if (a?.kind === 'gather') return { reason: 'already gathering', queue: false };
    if (a?.kind === 'poundLag' && C.pound?.jump) return true;   // the ground-pound jump
    if (a?.kind === 'pound') return { reason: 'in a stomp attack', queue: true };
    if (a && a.kind !== 'move' && a.kind !== 'dodge' && a.kind !== 'dash') return { reason: `in ${a.kind}`, queue: true };
    if (a?.kind === 'move' && !cancelOpen(S, a)) return { reason: 'in a move\'s startup or active frames', queue: true };
    if (a?.kind === 'dash') return C.dash.jump && !a.air && H.grounded ? true : { reason: a.air ? 'in an air dash' : 'in a dash', queue: true };
    if (a?.kind === 'dodge') return { reason: 'in a dodge roll', queue: true };
    if (H.grounded || H.coyote > 0) return true;
    if (canWallJump(S) || canStep(S)) return true;
    if (C.air && H.airLeft > 0) return true;
    const g = gearPress(S); if (g) return g;
    return { reason: C.air ? 'in the air, the air jumps spent' : 'in the air', queue: true };
  }
  if (name === 'attack') {
    if (a?.kind === 'pound' || a?.kind === 'poundLag') return { reason: 'in a stomp attack', queue: true };
    if (poundAsked(S, stick) && (!a || a.kind === 'move')) return true;
    if (!H.grounded && !C.moves.air) return { reason: 'no moves in the air in this feel', queue: true };
    if (a?.kind === 'move') {
      if (a.lv) return { reason: 'the charged move ends the string', queue: true };
      if (a.i + 1 >= C.moves.string.length) return { reason: 'the string is spent', queue: true };
      if (!cancelOpen(S, a)) return { reason: 'the move\'s cancel is not open yet', queue: true };
      return true;
    }
    if (a?.kind === 'gather') return { reason: 'gathering a jump', queue: true };
    if (a?.kind === 'dodge') return { reason: 'in a dodge roll', queue: true };
    if (a?.kind === 'dash') return { reason: 'in a dash', queue: true };
    return true;
  }
  if (name === 'dodge') {
    if (!H.grounded) return { reason: 'no dodge roll in the air', queue: false };
    if (a?.kind === 'block' || a?.kind === 'charge') return true;   // out of the guard, out of a charge (it is let go)
    if (a?.kind === 'move') return C.dodge.cancel && pastActive(S, a) ? true : { reason: 'a move commits until its active frames end', queue: false };
    if (a) return { reason: `in ${a.kind}`, queue: false };
    return true;
  }
  if (name === 'guard') {
    if (!C.guard) return { reason: 'no guard in this feel', queue: false };
    if (!H.grounded) return { reason: 'no guard in the air', queue: false };
    if (a?.kind === 'charge') return true;
    if (a?.kind === 'move') return pastActive(S, a) ? true : { reason: 'a move commits until its active frames end', queue: false };
    if (a) return { reason: `in ${a.kind}`, queue: false };
    return true;
  }
  if (name === 'lock') {
    if (!C.lock) return { reason: 'no lock-on in this feel', queue: false };
    if (!S.lock && targetDist(S) > C.lock.range) return { reason: `no target within ${C.lock.range} m`, queue: false };
    return true;
  }
  if (name === 'dash') {
    const DS = C.dash; if (!DS) return { reason: 'no dash in this feel', queue: false };
    if (!H.grounded && !DS.air) return { reason: 'no air dash in this feel', queue: false };
    if (!H.grounded && H.airDashes <= 0) return { reason: 'the air dash is spent', queue: false };
    if (H.cling && D_WALL(S)) return { reason: 'on the wall: dash is held for a dash wall jump', queue: false };
    if (a?.kind === 'move') return DS.cancel && pastActive(S, a) ? true : { reason: 'a move commits until its active frames end', queue: false };
    if (a) return { reason: `in ${a.kind}`, queue: false };
    return true;
  }
  return { reason: 'unknown button', queue: false };
}
/** the move an act plays: a string's, or (`lv`) the charged move of that level */
function moveDef(S, a) { return a.lv ? S.card.charge.at[a.lv - 1] : S.card.moves.string[a.i]; }
function pastActive(S, a) { const m = moveDef(S, a); return a.f >= m.startup + m.active; }
function cancelOpen(S, a) {
  const C = S.card.moves, m = moveDef(S, a), after = m.startup + m.active;
  if (C.cancel === 'none') return false;
  if (C.cancel === 'half') return a.f >= after + Math.ceil(m.recovery / 2);
  return a.f >= after + C.cancel;
}
function act(S, name, stick, waited) {
  const H = S.hero, C = S.card;
  S.events.push({ f: S.f, who: 'hero', type: 'acted', button: name, waited });
  if (name === 'jump') {
    if (!H.grounded) {
      if (H.coyote > 0) { S.events.push({ f: S.f, who: 'hero', type: 'coyote', left: H.coyote }); takeOff(S, H, 'hero'); return; }
      if (canWallJump(S)) return wallJump(S, H);
      if (canStep(S)) { S.events.push({ f: S.f, who: 'hero', type: 'step', off: 'dummy' }); H.stepCd = C.land.step.cooldown; takeOff(S, H, 'hero'); return; }
      if (C.air && H.airLeft > 0) { H.airLeft--; S.events.push({ f: S.f, who: 'hero', type: 'air-jump', left: H.airLeft }); takeOff(S, H, 'hero', C.air.mult); return; }
      return gearAct(S, H);
    }
    if (H.act?.kind === 'dash') {   // the dash jump: it leaves at once, and the air keeps the dash's speed
      const sp = len2(H.v[0], H.v[1]); S.events.push({ f: S.f, who: 'hero', type: 'dash-jump', speed: r4(sp) });
      takeOff(S, H, 'hero'); H.carry = sp; return;
    }
    if (H.act?.kind === 'poundLag') { S.events.push({ f: S.f, who: 'hero', type: 'pound-jump' }); takeOff(S, H, 'hero', C.pound.jump); return; }
    H.act = null;
    if (C.jump.commit > 0) { H.act = { kind: 'gather', f: 0, of: C.jump.commit }; return; }
    takeOff(S, H, 'hero'); return;
  }
  if (name === 'attack') {
    if (poundAsked(S, stick)) { H.act = { kind: 'pound', f: 0, hit: false }; H.jumped = true; S.events.push({ f: S.f, who: 'hero', type: 'pound', kind: C.pound.kind }); return; }
    const i = H.act?.kind === 'move' ? H.act.i + 1 : 0;
    if (S.lock) H.yaw = bearing(S);   // locked: at the target
    else if (stick.m > 0) H.yaw = Math.atan2(stick.x, stick.y);   // the swing's direction from the held stick
    H.act = { kind: 'move', i, f: 0, hit: false }; S.events.push({ f: S.f, who: 'hero', type: 'move', i, take: C.moves.string[i].take });
    // the opener held on charges: the meter runs from this press (the tap above is already acted)
    if (i === 0 && C.charge && (S.held & BTN.ATTACK)) { H.charge = { held: 0, lv: 0, from: S.f }; H.act.charging = true; }
    return;
  }
  if (name === 'guard') { H.act = { kind: 'block', f: 0, pressed: S.f }; S.events.push({ f: S.f, who: 'hero', type: 'guard' }); return; }
  if (name === 'lock') { S.lock = S.lock ? null : { target: 'dummy' }; S.events.push({ f: S.f, who: 'hero', type: S.lock ? 'lock' : 'unlock', on: 'dummy' }); return; }
  if (name === 'dodge') {
    // the directional roll: along the stick, the body keeping its facing (forward, back, left or right of it); with
    // the stick at rest, a backstep
    const D = C.dodge, neutral = stick.m === 0, dir = neutral ? H.yaw + Math.PI : Math.atan2(stick.x, stick.y), rel = angDiff(dir, H.yaw);
    const side = Math.abs(rel) <= Math.PI / 4 ? 'fwd' : Math.abs(rel) >= (3 * Math.PI) / 4 ? 'back' : rel > 0 ? 'right' : 'left';
    const of = side === 'back' ? Math.round(D.frames * D.back.frames) : D.frames;
    // locked, the roll is read against the target: its part along the line to it and its part around it
    let lock = null;
    if (S.lock) { const [rx, ry, d] = fromTarget(S); lock = { r: Math.sin(dir) * rx + Math.cos(dir) * ry, t: Math.sin(dir) * -ry + Math.cos(dir) * rx, rad: d }; }
    H.act = { kind: 'dodge', f: 0, of, dir, rel: side, neutral, lock }; S.events.push({ f: S.f, who: 'hero', type: 'dodge', kind: D.kind, rel: side, neutral, locked: !!lock });
    return;
  }
  if (name === 'dash') {
    const DS = C.dash, dir = stick.m > 0 ? Math.atan2(stick.x, stick.y) : H.yaw;
    if (!H.grounded) {   // the air dash: gravity off, at the air dash's speed, once an airtime
      H.airDashes--; H.act = { kind: 'dash', f: 0, of: DS.air.frames, dir, from: len2(H.v[0], H.v[1]), air: true }; H.v[2] = 0; H.yaw = dir;
      S.events.push({ f: S.f, who: 'hero', type: 'air-dash', left: H.airDashes }); return;
    }
    H.act = { kind: 'dash', f: 0, of: DS.frames, dir, from: len2(H.v[0], H.v[1]) }; H.yaw = dir; S.events.push({ f: S.f, who: 'hero', type: 'dash', kind: DS.kind });
  }
}
function takeOff(S, B, who, mult = 1) {
  const J = S.card.jump; B.act = null; B.grounded = false; B.coyote = 0; B.jumped = true; B.cut = false; B.hang = J.hang; B.apex = null;
  B.v[2] = Math.sqrt(2 * J.gRise * J.height * mult); B.tookOff = S.f; B.from = B.p[2];
  S.events.push({ f: S.f, who, type: 'takeoff', z: r4(B.p[2]) });
}
function cutJump(S, B) {
  if (!B.grounded && B.jumped && !B.cut && B.v[2] > 0) { B.v[2] *= S.card.jump.cut; B.cut = true; if (S.card.jump.cut < 1) S.events.push({ f: S.f, who: 'hero', type: 'cut', vz: r4(B.v[2]) }); }
  B.hang = 0;
}

// ─── moving a body ──────────────────────────────────────────────────────
function moveBody(S, B, who, stick, buttons) {
  const C = S.card, Gd = C.ground, a = B.act;
  B.z0 = B.p[2];   // the feet at the frame's start: a fast fall crosses a body's top in one frame
  const free = !(a && (a.kind === 'stagger' || a.kind === 'bonk' || a.kind === 'hurt' || a.kind === 'ko')) && B.stun === 0;
  // the stick's ask: a speed toward a heading
  let want = null;
  if (stick && free && stick.m > 0) {
    let top = (buttons & BTN.SPRINT) ? Gd.sprint : Gd.run;
    if (!B.grounded && B.carry > top) top = B.carry;   // a dash jump's air holds the dash's speed
    if (who === 'hero' && S.lock && B.grounded) top *= C.lock.strafe;   // locked: a strafe
    if (a?.kind === 'block') top *= C.guard.move;   // guarding: a walk, or rooted
    if (a?.kind === 'charge') top *= C.charge.move;   // the charging stance: a slow walk, or rooted
    if (B.slowed > 0) top *= C.hurt.slow.share;   // a flinch: the run slowed a moment
    want = top > 0 ? { x: stick.x * top, y: stick.y * top, heading: Math.atan2(stick.x, stick.y), speed: stick.m * top } : null;
  }
  const rooted = a?.kind === 'move' && C.moves.root === 'stop' && B.grounded;
  if (who === 'hero' && S.gear) gearHold(S, B, free);
  if (a?.kind === 'pound') { B.v[0] = 0; B.v[1] = 0; B.v[2] = a.f < C.pound.hang ? 0 : -C.pound.speed; }
  else if (a?.kind === 'charge' && !C.charge.move) { B.v[0] = 0; B.v[1] = 0; if (stick?.m > 0) B.yaw = turnToward(B.yaw, Math.atan2(stick.x, stick.y), Gd.turn * DEG * DT); }   // rooted: crouched, the stick aims
  else if (a?.kind === 'poundLag') { B.v[0] = 0; B.v[1] = 0; }
  else if (a?.kind === 'dodge') rollVelocity(S, B);
  else if (a?.kind === 'dash') dashVelocity(S, B);
  else if (rooted) { const m = moveDef(S, a); const speed = a.f < m.startup ? m.lunge / (m.startup * DT) : 0; B.v[0] = Math.sin(B.yaw) * speed; B.v[1] = Math.cos(B.yaw) * speed; }
  else if (a?.kind === 'block' && !want) slide(B);   // the guard's push back slides out on the soles
  else if (B.grounded && (!stick || !free)) slide(B);
  else if (B.glide && C.glide.kind !== 'float') glideSteer(S, B, stick);
  else if (B.wallLock > 0 && !B.grounded) { /* the wall jump's kick: fixed, the stick locked out */ }
  else if (B.grounded || want) control(B, want, Gd, B.grounded ? 1 : (B.jet || B.flying) ? C.jet.air : C.jump.air);
  // the wall: falling against one with the stick into it slides down it (the hero's, a card with `cling`)
  const CL = who === 'hero' ? C.cling : null;
  let clung = null;
  if (CL && !B.grounded && B.v[2] <= 0 && free && !a && stick && stick.m > 0) {
    const n = wallNear(S, B);
    if (n && -(stick.x * n[0] + stick.y * n[1]) > CL.toward * stick.m) clung = n;
  }
  // facing follows the stick (a move keeps its own, set at the press)
  if (who === 'hero' && S.lock) { /* locked: the facing is set on the target after the frame's move, below */ }
  else if (want && free && a?.kind !== 'move' && a?.kind !== 'dodge' && a?.kind !== 'dash' && a?.kind !== 'block' && a?.kind !== 'charge' && (B.grounded || C.jump.air > 0.5)) B.yaw = turnToward(B.yaw, want.heading, Gd.turn * DEG * DT);
  // the gather: the body waits on the ground for its take-off
  if (a?.kind === 'gather' && a.f >= a.of && B.grounded) takeOff(S, B, who);
  // gravity, exact for a constant pull, split at the apex (the rise's gravity and the fall's)
  if (a?.kind === 'pound') { B.p[2] += B.v[2] * DT; if (C.pound.kind === 'pound' && a.f < C.pound.hang) B.spin = (2 * Math.PI * (a.f + 1)) / C.pound.hang; }   // a straight drop, no gravity's curve
  else if (clung) { B.v[2] = -CL.slide; B.p[2] -= CL.slide * DT; }   // down the wall at a constant speed
  else if (B.glide) { B.v[2] = C.glide.kind === 'float' ? 0 : -C.glide.fall; B.p[2] += B.v[2] * DT; }   // the glider's steady sink, the float's held height
  else if (B.jet) jetLift(S, B);
  else if (!B.grounded && !(a?.kind === 'dash' && (a.air || C.dash.kind === 'dash'))) { fall(S, B, who); if (B.flying && B.v[2] < -C.jet.sink) B.v[2] = -C.jet.sink; }
  // the floor plane: substeps no longer than 8 cm against the walls
  const sp = len2(B.v[0], B.v[1]); const n = Math.max(1, Math.ceil((sp * DT) / 0.08));
  let wallHit = null;
  for (let i = 0; i < n; i++) {
    B.p[0] += (B.v[0] * DT) / n; B.p[1] += (B.v[1] * DT) / n;
    const hit = resolveWalls(S, B); if (hit && !wallHit) { wallHit = hit; wallResponse(S, B, who, hit); }
  }
  if (a?.kind === 'dodge' && a.lock) {   // a locked roll keeps its distance to the target but for its own along-part
    const D = S.dummy, dx = B.p[0] - D.p[0], dy = B.p[1] - D.p[1], d = len2(dx, dy);
    if (d > 1e-6) { B.p[0] = D.p[0] + (dx / d) * a.lock.rad; B.p[1] = D.p[1] + (dy / d) * a.lock.rad; resolveWalls(S, B); }
  }
  ground(S, B, who);
  if (who === 'hero' && S.lock && free && a?.kind !== 'dash') B.yaw = turnToward(B.yaw, bearing(S), C.lock.turn * DEG * DT);   // locked: on the target where it is now
  if (clung && !B.grounded) {
    if (!B.cling) S.events.push({ f: S.f, who, type: 'cling', n: clung.map(r4), z: r4(B.p[2]) });
    B.cling = clung; B.wallN = clung; B.wallCoyote = CL.coyote; B.yaw = Math.atan2(clung[0], clung[1]);   // faces out, as X does
    B.v[0] = 0; B.v[1] = 0; if (C.air) B.airLeft = C.air.jumps; B.airDashes = C.dash?.air?.count ?? 0; B.carry = 0;
  } else if (B.cling && B.grabbed !== S.f) { B.cling = null; B.leftWall = S.f; }   // (a grab this frame holds until the next reads the stick)
  // the stride: a cycle at the ground's rate (strides a second = speed ÷ the travel of a stride at that speed)
  if (B.grounded) B.stride = (B.stride + strideRate(S, len2(B.v[0], B.v[1])) * DT) % 1;
  if ((a?.kind === 'charge' && C.charge.kind === 'spin') || a?.spin) B.spin = (B.spin + 0.5 + 0.35 * (B.charge?.lv ?? 2)) % (2 * Math.PI);   // the spin dash revs, then rolls
  if (!B.grounded && C.jump.spin && B.jumped) B.spin += Math.min(2 * Math.PI / 8, (2 * len2(B.v[0], B.v[1]) / 0.45) * DT);
}
function control(B, want, Gd, share) {
  const vx = B.v[0], vy = B.v[1], speed = len2(vx, vy);
  if (Gd.steer && speed > 0.5 && want) {
    // a projectile steers: the heading turns at most `steer`, the speed builds or brakes along it
    const h = Math.atan2(vx, vy), against = Math.abs(angDiff(want.heading, h)) > 120 * DEG;
    const nh = against ? h : turnToward(h, want.heading, Gd.steer * DEG * DT * share);
    const ns = against ? Math.max(0, speed - Gd.decel * 3 * DT * share) : moveTo(speed, want.speed, (want.speed > speed ? Gd.accel : Gd.decel) * DT * share);
    B.v[0] = Math.sin(nh) * ns; B.v[1] = Math.cos(nh) * ns; return;
  }
  const tx = want ? want.x : 0, ty = want ? want.y : 0;
  const dx = tx - vx, dy = ty - vy, d = len2(dx, dy); if (d < 1e-9) return;
  const speeding = want && len2(tx, ty) >= speed - 1e-9 && (tx * vx + ty * vy) >= 0;
  const rate = (speeding ? Gd.accel : Gd.decel) * DT * share;
  const k = Math.min(1, rate / d); B.v[0] = vx + dx * k; B.v[1] = vy + dy * k;
}
/** a body nobody drives (the dummy, a hit or staggered hero) slides on its soles, friction 0.8 */
function slide(B) { const s = len2(B.v[0], B.v[1]); if (s < 1e-9) return; const k = Math.max(0, s - 0.8 * G * DT) / s; B.v[0] *= k; B.v[1] *= k; }
/** the directional roll's speed: easing off through it (a backstep shorter), the body's facing kept */
function rollVelocity(S, B) {
  const D = S.card.dodge, a = B.act, t = a.f / a.of, k = a.rel === 'back' ? D.back.speed : 1;
  const speed = D.speed * k * (1 - 0.7 * t);
  if (a.lock) {   // locked: along the line to the target and around it, each against where the body is now
    const [rx, ry] = fromTarget(S), tx = -ry, ty = rx;
    B.v[0] = (rx * a.lock.r + tx * a.lock.t) * speed; B.v[1] = (ry * a.lock.r + ty * a.lock.t) * speed;
    a.lock.rad = Math.max(2 * RADIUS, a.lock.rad + a.lock.r * speed * DT);
    return;
  }
  B.v[0] = Math.sin(a.dir) * speed; B.v[1] = Math.cos(a.dir) * speed;
}
/** the target (the dummy): its distance, the bearing to it (a yaw), and the unit line from it to the hero */
function targetDist(S) { return len2(S.dummy.p[0] - S.hero.p[0], S.dummy.p[1] - S.hero.p[1]); }
function bearing(S) { return Math.atan2(S.dummy.p[0] - S.hero.p[0], S.dummy.p[1] - S.hero.p[1]); }
function fromTarget(S) { const dx = S.hero.p[0] - S.dummy.p[0], dy = S.hero.p[1] - S.dummy.p[1], d = len2(dx, dy) || 1e-9; return [dx / d, dy / d, d]; }
/** the dash's speed: X's constant dash (gravity off), the boost on top of the run, the air dash */
function dashVelocity(S, B) {
  const D = S.card.dash, a = B.act, t = a.f / a.of;
  let speed;
  if (a.spin) speed = a.from;   // the spin dash: the level's speed, held, gravity as ever
  else if (a.air) { speed = D.kind === 'boost' ? Math.min(S.card.wall.cap ?? Infinity, Math.max(a.from, S.card.ground.run) + D.air.speed * (1 - t)) : D.air.speed; B.v[2] = 0; }
  else if (D.kind === 'boost') speed = Math.min(S.card.wall.cap ?? Infinity, Math.max(a.from, S.card.ground.run) + D.speed * (1 - t));
  else { speed = D.speed; B.v[2] = 0; }
  B.v[0] = Math.sin(a.dir) * speed; B.v[1] = Math.cos(a.dir) * speed; B.yaw = a.dir;
}
function fall(S, B, who) {
  const J = S.card.jump; let t = DT;
  if (B.v[2] > 0) {
    const ta = B.v[2] / J.gRise;
    if (ta >= t) { B.p[2] += B.v[2] * t - 0.5 * J.gRise * t * t; B.v[2] -= J.gRise * t; return; }
    B.p[2] += B.v[2] * ta - 0.5 * J.gRise * ta * ta; B.v[2] = 0; t -= ta; apexAt(S, B, who);
    if (B.hang > 0 && (S.held & BTN.JUMP)) { B.hang--; return; }
  } else if (B.v[2] === 0 && B.hang > 0 && B.jumped && (S.held & BTN.JUMP) && who === 'hero') { B.hang--; return; }
  B.p[2] += B.v[2] * t - 0.5 * J.gFall * t * t; B.v[2] = Math.max(-J.maxFall, B.v[2] - J.gFall * t);
}
function apexAt(S, B, who) { if (B.apex == null) { B.apex = r4(B.p[2] - (B.from ?? 0)); S.events.push({ f: S.f, who, type: 'apex', height: B.apex }); } }

/** the floor under a point: the highest block top it stands over, else the floor */
function groundAt(S, x, y) { let h = 0; for (const k of S.arena.blocks) if (x >= k.x[0] && x <= k.x[1] && y >= k.y[0] && y <= k.y[1]) h = Math.max(h, k.h); return h; }
function ground(S, B, who) {
  const g = groundAt(S, B.p[0], B.p[1]);
  if (B.grounded) {
    if (g < B.p[2] - 1e-6) { B.grounded = false; B.jumped = false; B.coyote = S.card.jump.coyote; B.v[2] = 0; B.from = B.p[2]; B.apex = null; S.events.push({ f: S.f, who, type: 'edge', z: r4(B.p[2]) }); }
    else B.p[2] = g;
    return;
  }
  if (B.coyote > 0) B.coyote--;
  if (B.p[2] <= g && B.v[2] <= 0) {
    const fallSpeed = -B.v[2]; B.p[2] = g; B.v[2] = 0; B.grounded = true; B.coyote = 0; B.jumped = false; B.hang = 0; B.landed = S.f; B.spin = 0; B.onHead = false; B.cling = null; B.wallCoyote = 0; B.wallLock = 0; B.glide = false; B.glideT = 0; B.glideSpent = false; B.jet = false; B.flying = false; if (S.card.air && who === 'hero') B.airLeft = S.card.air.jumps; if (who === 'hero') { B.airDashes = S.card.dash?.air?.count ?? 0; B.carry = 0; }
    const J = S.card.jump; if (J.heavy && fallSpeed > J.heavy.fall && who === 'hero') B.lag = J.heavy.lag;
    if (B.act?.kind === 'move' && !S.card.moves.air) B.act = null;
    S.events.push({ f: S.f, who, type: 'land', fall: r4(fallSpeed) });
    if (B.act?.kind === 'pound') poundFloor(S, B, who);
  }
}
/** push a body out of the arena's walls and every block taller than a step above its feet; the first wall's normal */
function resolveWalls(S, B) {
  let hit = null; const A = S.arena, lim = A.half - RADIUS;
  for (const [i, s] of [[0, 1], [0, -1], [1, 1], [1, -1]]) if (B.p[i] * s > lim) { B.p[i] = lim * s; hit = hit ?? (i === 0 ? [-s, 0] : [0, -s]); }
  for (const k of A.blocks) {
    if (k.h <= B.p[2] + STEP) continue;
    const cx = clamp(B.p[0], k.x[0], k.x[1]), cy = clamp(B.p[1], k.y[0], k.y[1]), dx = B.p[0] - cx, dy = B.p[1] - cy, d = len2(dx, dy);
    if (d >= RADIUS) continue;
    let nx, ny;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; } else {
      const e = [[B.p[0] - k.x[0], -1, 0], [k.x[1] - B.p[0], 1, 0], [B.p[1] - k.y[0], 0, -1], [k.y[1] - B.p[1], 0, 1]].sort((a, b) => a[0] - b[0])[0];
      nx = e[1]; ny = e[2];
    }
    B.p[0] = cx + nx * RADIUS; B.p[1] = cy + ny * RADIUS; hit = hit ?? [nx, ny];
  }
  return hit;
}
function wallResponse(S, B, who, n) {
  const W = S.card.wall, into = -(B.v[0] * n[0] + B.v[1] * n[1]); if (into <= 0) return;
  if (B.glide && S.card.glide.grab && S.card.cling) {   // Knuckles: a glide into a wall grabs it
    B.glide = false; B.cling = n; B.wallN = n; B.wallCoyote = S.card.cling.coyote; B.v[0] = 0; B.v[1] = 0; B.yaw = Math.atan2(n[0], n[1]); B.airLeft = S.card.air?.jumps ?? 0;
    B.grabbed = S.f; S.events.push({ f: S.f, who, type: 'cling', n: n.map(r4), z: r4(B.p[2]), grab: true }); return;
  }
  const leaning = B.touched === S.f - 1; B.touched = S.f;   // pressed on into a wall it already touched: no new event
  if (W.model === 'bounce' && !(W.soft && !B.grounded && into < W.soft)) {
    B.v[0] += n[0] * (1 + W.e) * into; B.v[1] += n[1] * (1 + W.e) * into;
    const s = len2(B.v[0], B.v[1]); if (s > W.cap) { B.v[0] *= W.cap / s; B.v[1] *= W.cap / s; }
    S.events.push({ f: S.f, who, type: 'wall', response: 'bounce', into: r4(into), out: r4(Math.min(W.cap, s)) }); return;
  }
  B.v[0] += n[0] * into; B.v[1] += n[1] * into;   // the normal part stops: the body slides along
  if (W.model === 'bonk' && into > W.above && B.grounded) {
    B.v[0] = n[0] * W.rebound; B.v[1] = n[1] * W.rebound; B.grounded = false; B.jumped = false; B.v[2] = Math.sqrt(2 * S.card.jump.gRise * W.hop); B.from = B.p[2];
    B.act = { kind: 'bonk', f: 0, of: 24 }; S.events.push({ f: S.f, who, type: 'wall', response: 'bonk', into: r4(into) }); return;
  }
  if (W.model === 'stop' && W.stagger != null && into > W.stagger) { B.act = { kind: 'stagger', f: 0, of: 30 }; S.events.push({ f: S.f, who, type: 'wall', response: 'stagger', into: r4(into) }); return; }
  if (!leaning) S.events.push({ f: S.f, who, type: 'wall', response: 'stop', into: r4(into) });
}
function endAct(S, B, who) {
  const a = B.act; if (!a) return;
  if (a.kind === 'move') {
    const m = moveDef(S, a); if (a.f < m.startup + m.active + m.recovery) return;
    B.act = null; S.events.push({ f: S.f, who, type: 'end', what: 'move' });
    // the tap's move over with the attack still held: the charging stance (a card whose meter runs free has none)
    if (a.charging && B.charge && !B.charge.letGo && S.card.charge.stance) B.act = { kind: 'charge', f: 0 };
    return;
  }
  if (a.kind === 'spar') { const m = sparMove(a); if (a.f >= m.startup + m.active + m.recovery) B.act = null; return; }
  if (a.kind === 'ko') { if (a.f >= a.of) { B.act = null; B.hp = S.card.life.hp; B.mercy = Math.max(60, S.card.hurt?.mercy ?? 0); S.events.push({ f: S.f, who, type: 'up', hp: B.hp }); } return; }
  if (a.kind === 'block') { if (!(S.held & BTN.GUARD) && !B.blockstun) { B.act = null; S.events.push({ f: S.f, who, type: 'end', what: 'block' }); } return; }
  const D = S.card.dash;
  const letGo = a.kind === 'dash' && who === 'hero' && D?.hold && !(S.held & BTN.DASH) && a.f >= D.hold.min;   // X's dash: as long as it is held
  if ((a.of != null && a.f >= a.of && a.kind !== 'gather') || letGo) {
    if (a.kind === 'dash' && a.air) B.carry = Math.max(B.carry, len2(B.v[0], B.v[1]));   // out of an air dash the air keeps its speed
    B.act = null; S.events.push({ f: S.f, who, type: 'end', what: a.kind, ...(letGo ? { released: true } : {}) });
  }
}
function strideRate(S, speed) {
  const g = S.body.strides; if (speed < 0.05) return 0;
  let travel = speed <= g[0].v ? g[0].travel : g.at(-1).travel;
  for (let i = 1; i < g.length; i++) if (speed > g[i - 1].v && speed <= g[i].v) travel = g[i - 1].travel + ((g[i].travel - g[i - 1].travel) * (speed - g[i - 1].v)) / (g[i].v - g[i - 1].v);
  let rate = speed / travel; const top = g.at(-1).v;
  if (speed > top) rate *= 1 + 0.5 * (speed / top - 1);   // past the sprint the legs outrun the ground (pinball's wheel)
  return Math.min(FPS / 4, rate);
}

// ─── bodies: walking into one, jumping on one ──────────────────────────
/**
 * The hero against the dummy, two upright cylinders (RADIUS across, `h` tall). Coming down onto the dummy's top (the
 * feet within a quarter metre of it, not rising) is the card's `land`; any other overlap pushes the hero out to the
 * dummy's side and takes the part of its velocity that went in (the dummy stands its ground: a training post).
 */
function bodies(S) {
  const H = S.hero, D = S.dummy, C = S.card;
  const dx = H.p[0] - D.p[0], dy = H.p[1] - D.p[1], d = len2(dx, dy), top = D.p[2] + D.h;
  const over = d < 2 * RADIUS && H.p[2] < top && H.p[2] + H.h > D.p[2];
  if (!over) { H.touching = false; H.onHead = false; return; }
  const nx = d > 1e-6 ? dx / d : -Math.sin(H.yaw), ny = d > 1e-6 ? dy / d : -Math.cos(H.yaw);
  if (H.v[2] <= 0 && (H.p[2] >= top - 0.25 || (H.z0 ?? H.p[2]) >= top - 1e-6)) return landOn(S, H, D, top, nx, ny);
  H.p[0] = D.p[0] + nx * 2 * RADIUS; H.p[1] = D.p[1] + ny * 2 * RADIUS;
  const into = -(H.v[0] * nx + H.v[1] * ny); if (into > 0) { H.v[0] += nx * into; H.v[1] += ny * into; }
  if (!H.touching) S.events.push({ f: S.f, who: 'hero', type: 'bump', into: r4(Math.max(0, into)) });
  H.touching = true;
}
function landOn(S, H, D, top, nx, ny) {
  const C = S.card, L = C.land, J = C.jump, falling = -H.v[2];
  if (H.act?.kind === 'pound' && !H.act.hit) return poundBody(S, H, D, top, nx, ny);
  const spun = L.model === 'bounce' && J.spin && H.jumped;
  if (L.model === 'stomp' || spun) {
    H.p[2] = top; H.grounded = false; H.jumped = true; H.cut = false; H.apex = null; H.from = top; H.hang = J.hang; H.coyote = 0; H.onHead = false;
    if (L.model === 'stomp') H.v[2] = Math.sqrt(2 * J.gRise * ((S.held & BTN.JUMP) ? L.high : L.low));
    else H.v[2] = Math.max(falling, Math.sqrt(2 * J.gRise * L.min));
    const type = L.model === 'stomp' ? 'stomp' : 'bounce-off';
    if (D.mercy > 0) { S.events.push({ f: S.f, who: 'hero', type, on: 'dummy', vz: r4(H.v[2]), immune: true }); S.events.push({ f: S.f, who: 'dummy', type: 'immune', mercy: D.mercy }); return; }
    if (armorHolds(S, H, D, 'hero', ['light', 'stomp'], 0)) return;   // an armored attack shrugs off a stomp too
    const stop = hitstop(S, 0); H.stop = D.stop = stop; H.fresh = D.fresh = stop > 0;
    D.mercy = C.hit.mercy; D.lastHit = { take: 'cross', f: S.f, finisher: false }; D.combo = 0;
    if (L.model === 'stomp') { D.squash = L.stun; D.stun = L.stun; D.act = null; }
    else {
      const sp = Math.max(L.floor, len2(H.v[0], H.v[1])) * L.restitution, hx = len2(H.v[0], H.v[1]) > 1e-6 ? H.v[0] / len2(H.v[0], H.v[1]) : -nx, hy = len2(H.v[0], H.v[1]) > 1e-6 ? H.v[1] / len2(H.v[0], H.v[1]) : -ny;
      D.v[0] = hx * sp; D.v[1] = hy * sp; D.v[2] = 2; D.grounded = false; D.jumped = false; D.from = D.p[2];
    }
    S.events.push({ f: S.f, who: 'hero', type, on: 'dummy', vz: r4(H.v[2]), fell: r4(falling), held: !!(S.held & BTN.JUMP), hitstop: stop });
    return;
  }
  // slide: the top holds the feet but is no floor; the body slides off it, outward, and falls beside
  H.p[2] = top; H.v[2] = 0;
  H.p[0] += nx * L.slide * DT; H.p[1] += ny * L.slide * DT;
  if (!H.onHead) S.events.push({ f: S.f, who: 'hero', type: 'slide', on: 'dummy', fell: r4(falling) });
  H.onHead = true;
}
// ─── the stomp attack ─────────────────────────────────────────────────
/** does this attack press ask for the card's stomp attack: in the air, high enough to drop, the stick as it wants */
function poundAsked(S, stick) {
  const P = S.card.pound, H = S.hero; if (!P || H.grounded) return false;
  if (H.p[2] - groundAt(S, H.p[0], H.p[1]) < 0.3) return false;
  if (P.stick === 'back') return stick.m > 0 && stick.x * Math.sin(H.yaw) + stick.y * Math.cos(H.yaw) < -0.5 * stick.m;
  return true;
}
/** the stomp attack meets the floor: a plunge's shockwave and lag, a pound's lag (a jump in it goes higher), a bounce */
function poundFloor(S, B, who) {
  const P = S.card.pound, D = S.dummy;
  if (P.kind === 'bounce') {
    B.act = null; B.grounded = false; B.jumped = true; B.cut = true; B.apex = null; B.from = B.p[2]; B.hang = 0;
    B.v[2] = Math.sqrt(2 * S.card.jump.gRise * P.bounce); S.events.push({ f: S.f, who, type: 'pound-bounce', off: 'floor' }); return;
  }
  const hit = B.act.hit; B.act = { kind: 'poundLag', f: 0, of: P.lag };
  if (P.kind === 'plunge' && !hit && P.radius && len2(D.p[0] - B.p[0], D.p[1] - B.p[1]) <= P.radius && Math.abs(D.p[2] - B.p[2]) < 0.5) {
    const d = len2(D.p[0] - B.p[0], D.p[1] - B.p[1]), dir = d > 1e-6 ? [(D.p[0] - B.p[0]) / d, (D.p[1] - B.p[1]) / d] : [Math.sin(B.yaw), Math.cos(B.yaw)];
    strike(S, B, D, who, { take: 'cross', dv: S.body.dv.cross, force: P.force, finisher: true, shock: true, tags: ['heavy', 'stomp'] }, dir);
  }
}
/** the stomp attack comes down on a body: a plunge's blow (then it slides off, and lags on the floor), a pound's stomp
 * (harder, always the high bounce), a bounce attack's rebound off it with the ricochet */
function poundBody(S, H, D, top, nx, ny) {
  const P = S.card.pound, L = S.card.land, J = S.card.jump; H.act.hit = true;
  if (P.kind === 'plunge') { H.p[2] = top; H.v[2] = 0; strike(S, H, D, 'hero', { take: 'cross', dv: S.body.dv.cross, force: P.force, finisher: true, tags: ['heavy', 'stomp'] }, [-nx, -ny]); return; }   // the feet on its top; it slides off below
  H.p[2] = top; H.grounded = false; H.jumped = true; H.cut = false; H.apex = null; H.from = top; H.hang = J.hang; H.coyote = 0; H.act = null; H.spin = 0;
  H.v[2] = Math.sqrt(2 * J.gRise * (P.kind === 'pound' ? L.high : P.bounce));
  const type = P.kind === 'pound' ? 'stomp' : 'bounce-off';
  if (D.mercy > 0) { S.events.push({ f: S.f, who: 'hero', type, on: 'dummy', pound: true, vz: r4(H.v[2]), immune: true }); S.events.push({ f: S.f, who: 'dummy', type: 'immune', mercy: D.mercy }); return; }
  if (armorHolds(S, H, D, 'hero', P.kind === 'pound' ? ['heavy', 'stomp'] : ['light', 'stomp'], 0)) return;
  const stop = hitstop(S, 0) + (P.kind === 'pound' ? 2 : 0); H.stop = D.stop = stop; H.fresh = D.fresh = stop > 0;
  D.mercy = S.card.hit.mercy; D.lastHit = { take: 'cross', f: S.f, finisher: false }; D.combo = 0;
  if (P.kind === 'pound') { D.squash = P.stun; D.stun = P.stun; D.act = null; }
  else { const sp = L.floor * L.restitution; D.v[0] = -nx * sp; D.v[1] = -ny * sp; D.v[2] = 2; D.grounded = false; D.jumped = false; D.from = D.p[2]; }
  S.events.push({ f: S.f, who: 'hero', type, on: 'dummy', pound: true, vz: r4(H.v[2]), hitstop: stop });
}

// ─── the wall: sliding down it, kicking off it ─────────────────────────
/** the normal of a wall the body is against (within 3 cm): the arena's edge or a block taller than a step, else null */
function wallNear(S, B) {
  const A = S.arena, lim = A.half - RADIUS - 0.03;
  for (const [i, s] of [[0, 1], [0, -1], [1, 1], [1, -1]]) if (B.p[i] * s >= lim) return i === 0 ? [-s, 0] : [0, -s];
  for (const k of A.blocks) {
    if (k.h <= B.p[2] + STEP) continue;
    const cx = clamp(B.p[0], k.x[0], k.x[1]), cy = clamp(B.p[1], k.y[0], k.y[1]), dx = B.p[0] - cx, dy = B.p[1] - cy, d = len2(dx, dy);
    if (d > 1e-9 && d <= RADIUS + 0.03) return [dx / d, dy / d];
  }
  return null;
}
const D_WALL = (S) => !!(S.card.dash?.wall && S.card.cling);
function canWallJump(S) { const H = S.hero; return !!(S.card.cling && !H.grounded && H.wallN && (H.cling || H.wallCoyote > 0)); }
/** the kick: up (the card's share of the jump) and away from the wall, the stick locked out for `lock` frames */
function wallJump(S, H) {
  const CL = S.card.cling, D = S.card.dash, n = H.wallN;
  const dash = !!(D?.wall && (S.held & BTN.DASH)), away = dash ? (D.kind === 'boost' ? S.card.ground.run : D.speed) : CL.away;   // the dash wall jump
  S.events.push({ f: S.f, who: 'hero', type: 'wall-jump', n: n.map(r4), z: r4(H.p[2]), coyote: !H.cling, dash });
  takeOff(S, H, 'hero', CL.up);
  H.v[0] = n[0] * away; H.v[1] = n[1] * away; H.yaw = Math.atan2(n[0], n[1]); H.carry = dash ? away : 0;
  H.wallLock = CL.lock; H.cling = null; H.wallCoyote = 0;
}

/** the enemy step: a jump in the air off a body the hero touches (beside it or on it), if the card has one */
function canStep(S) {
  const H = S.hero, D = S.dummy, st = S.card.land.step;
  if (!st || H.stepCd > 0 || H.grounded) return false;
  const d = len2(H.p[0] - D.p[0], H.p[1] - D.p[1]), z = H.p[2] - D.p[2];
  return d < 2 * RADIUS + 0.15 && z > 0.2 && z <= D.h + 0.05;
}

// ─── hold and release: the charge ──────────────────────────────────────
/**
 * The meter, once a tick the hero is not frozen: frames held since the press, a level reached on the frame its count
 * is met (a release on the next tick fires it). A stance card's charge lives only in the opener's move and the stance:
 * anything else the body takes up (a roll, a guard, a jump, a stagger) lets it go.
 */
function meter(S, B) {
  const CH = S.card.charge, c = B.charge; if (c.letGo) return;
  if (CH.stance && !(B.act?.kind === 'charge' || (B.act?.kind === 'move' && B.act.charging))) return loseCharge(S, B, B.act ? `into ${B.act.kind}` : 'the stance left');
  c.held++;
  if (c.held === CH.show) S.events.push({ f: S.f, who: 'hero', type: 'charge', kind: CH.kind });
  const k = CH.levels.indexOf(c.held); if (k >= 0) { c.lv = k + 1; S.events.push({ f: S.f, who: 'hero', type: 'charge-level', lv: c.lv, held: c.held }); }
}
function loseCharge(S, B, why) {
  if (B.charge.held >= S.card.charge.show) S.events.push({ f: S.f, who: 'hero', type: 'charge-lost', why, held: B.charge.held });
  B.charge = null; if (B.act?.kind === 'charge') B.act = null;
}
/** the release: the level the hold reached fires now (short of the first level a shown charge fizzles, a tap is a tap) */
function release(S, stick) {
  const H = S.hero, CH = S.card.charge, c = H.charge; H.charge = null;
  const stance = H.act?.kind === 'charge'; if (stance) H.act = null;
  const fizzle = (why) => { if (c.held >= CH.show) S.events.push({ f: S.f, who: 'hero', type: 'charge-fizzle', held: c.held, why }); };
  if (!c.lv) return fizzle(`${CH.levels[0] - c.held} f short of the first level`);
  if (H.stun > 0 || H.blockstun > 0 || (H.act && ['hurt', 'stagger', 'bonk'].includes(H.act.kind))) return fizzle(`in ${H.act?.kind ?? 'hitstun'}`);
  if (!H.grounded && !CH.air) return fizzle('in the air: no charged attack off the ground');
  const at = CH.at[c.lv - 1];
  if (S.lock) H.yaw = bearing(S);
  else if (CH.kind === 'heavy' && stick.m > 0) H.yaw = Math.atan2(stick.x, stick.y);   // the heavy swings where the stick holds; the spin was aimed in its stance
  S.events.push({ f: S.f, who: 'hero', type: 'release', kind: CH.kind, lv: c.lv, held: c.held, top: c.lv === CH.levels.length });
  if (CH.kind === 'heavy') { H.act = { kind: 'move', i: 0, lv: c.lv, f: 0, hit: false }; return; }
  if (CH.kind === 'spin') { H.act = { kind: 'dash', f: 0, of: at.frames, dir: H.yaw, from: at.speed, spin: c.lv }; return; }
  const fx = Math.sin(H.yaw), fy = Math.cos(H.yaw);   // the shot: from the chest, along the facing
  S.shots.push({ id: S.shotN++, lv: c.lv, f: 0, p: [H.p[0] + fx * (RADIUS + 0.15), H.p[1] + fy * (RADIUS + 0.15), H.p[2] + 1.2], v: [fx * at.speed, fy * at.speed, 0], size: at.size, life: at.life });
}
/** the shots fly straight, a wall or a block ends one, the dummy's body takes one as a blow (8 cm substeps) */
function flyShots(S) {
  if (!S.shots.length) return;
  const A = S.arena, lim = A.half, D = S.dummy, CH = S.card.charge;
  S.shots = S.shots.filter((sh) => {
    const n = Math.max(1, Math.ceil((len2(sh.v[0], sh.v[1]) * DT) / 0.08));
    for (let i = 0; i < n; i++) {
      sh.p[0] += (sh.v[0] * DT) / n; sh.p[1] += (sh.v[1] * DT) / n;
      const wall = Math.abs(sh.p[0]) > lim || Math.abs(sh.p[1]) > lim || A.blocks.some((k) => k.h > sh.p[2] && sh.p[0] >= k.x[0] && sh.p[0] <= k.x[1] && sh.p[1] >= k.y[0] && sh.p[1] <= k.y[1]);
      if (wall) { S.events.push({ f: S.f, who: 'hero', type: 'shot-wall', lv: sh.lv }); return false; }
      const dx = D.p[0] - sh.p[0], dy = D.p[1] - sh.p[1], d = len2(dx, dy);
      if (d <= RADIUS + sh.size && sh.p[2] >= D.p[2] - sh.size && sh.p[2] <= D.p[2] + D.h + sh.size) {
        const at = CH.at[sh.lv - 1];
        strike(S, sh, D, 'hero', { take: 'cross', dv: S.body.dv.cross, force: at.force, finisher: sh.lv === CH.levels.length, shot: sh.lv, tags: at.tags ?? ['light', 'shot'] }, [sh.v[0] / len2(sh.v[0], sh.v[1]), sh.v[1] / len2(sh.v[0], sh.v[1])]);
        return false;
      }
    }
    sh.f++; return sh.f < sh.life;
  });
}

// ─── the glider and the jetpack ─────────────────────────────────────────
/** a jump pressed in the air (no coyote, wall, step or air jump to take it): what the gear does with it, true, a
 * reason it cannot, or null (the press is the air's as ever: buffered for the landing) */
function gearPress(S) {
  const H = S.hero, C = S.card;
  if (S.gear === 'glide' && C.glide) {
    if (H.glide) return true;   // folded
    if (H.glideSpent) return null;
    if (C.glide.kind === 'paraglider') return H.p[2] - groundAt(S, H.p[0], H.p[1]) >= C.glide.min ? true : null;
    return H.v[2] <= 0 ? true : null;
  }
  if (S.gear === 'jet' && C.jet) return H.fuel > 0 ? true : { reason: C.jet.kind === 'flap' ? 'in the air, too tired to fly' : 'in the air, the jetpack out of fuel', queue: true };
  return null;
}
function gearAct(S, H) {
  const C = S.card;
  if (S.gear === 'glide') return H.glide ? endGlide(S, H, 'folded') : startGlide(S, H);
  if (C.jet.kind === 'flap') { H.flying = true; H.v[2] = Math.max(H.v[2], C.jet.flap); H.apex = null; S.events.push({ f: S.f, who: 'hero', type: 'flap', fuel: H.fuel }); return; }
  H.jet = true; S.events.push({ f: S.f, who: 'hero', type: 'jet', kind: C.jet.kind, fuel: H.fuel });
}
function startGlide(S, H) { H.glide = true; H.glideT = 0; H.carry = 0; S.events.push({ f: S.f, who: 'hero', type: 'glide', kind: S.card.glide.kind }); }
function endGlide(S, H, why) { H.glide = false; if (S.card.glide.kind === 'float' || why === 'out of stamina') H.glideSpent = true; S.events.push({ f: S.f, who: 'hero', type: 'glide-end', why }); }
/** once a tick, the hero's gear: anything it takes up (a move, a dash, a hit) or a wall ends a flight; a held glider
 * opens on the way down and closes when let go; the stamina or a float runs out; a held jetpack burns while there is fuel */
function gearHold(S, B, free) {
  const C = S.card, held = !!(S.held & BTN.JUMP), a = B.act;
  if (B.grounded) return;
  if (!free || a || B.cling) {
    const why = !free ? 'hit' : B.cling ? 'on the wall' : `into ${a.kind}`;
    if (B.glide) endGlide(S, B, why);
    if (B.jet) { B.jet = false; S.events.push({ f: S.f, who: 'hero', type: 'jet-end', why }); }
    if (!free) B.flying = false;
    return;
  }
  if (S.gear === 'glide' && C.glide) {
    const GL = C.glide, hold = GL.kind !== 'paraglider';
    if (B.glide && hold && !held) endGlide(S, B, 'let go');
    else if (!B.glide && hold && held && B.v[2] <= 0 && !B.glideSpent) startGlide(S, B);
    if (B.glide && GL.time != null && B.glideT++ >= GL.time) endGlide(S, B, GL.kind === 'float' ? 'the float is spent' : 'out of stamina');
  }
  if (S.gear === 'jet' && C.jet && C.jet.kind !== 'flap') {
    if (B.jet && (!held || B.fuel <= 0)) { B.jet = false; S.events.push({ f: S.f, who: 'hero', type: 'jet-end', why: B.fuel <= 0 ? 'out of fuel' : 'let go' }); }
    else if (!B.jet && held && B.fuel > 0 && B.v[2] <= 0) { B.jet = true; S.events.push({ f: S.f, who: 'hero', type: 'jet', kind: C.jet.kind, fuel: B.fuel }); }
  }
}
/** the glider's flight: the heading turned toward the stick at its rate, the speed settling on its own */
function glideSteer(S, B, stick) {
  const GL = S.card.glide, sp = len2(B.v[0], B.v[1]), h = sp > 0.1 ? Math.atan2(B.v[0], B.v[1]) : B.yaw;
  const nh = stick?.m > 0 ? turnToward(h, Math.atan2(stick.x, stick.y), GL.turn * DEG * DT) : h, ns = moveTo(Math.max(sp, GL.from ?? 0), GL.speed, GL.accel * DT);
  B.v[0] = Math.sin(nh) * ns; B.v[1] = Math.cos(nh) * ns; B.yaw = nh;
}
/** the jetpack's lift: a thrust against the fall's gravity up to its climb, or a hover easing the climb to `rise`; a
 * frame of fuel each */
function jetLift(S, B) {
  const JT = S.card.jet, g = S.card.jump.gFall;
  if (JT.kind === 'thrust') B.v[2] = B.v[2] > JT.rise ? B.v[2] - g * DT : Math.min(JT.rise, B.v[2] + (JT.thrust - g) * DT);
  else B.v[2] = moveTo(B.v[2], JT.rise, JT.thrust * DT);
  B.p[2] += B.v[2] * DT; B.fuel--; B.apex = null;
}

// ─── ranged attacks: the dummy as a shooter ────────────────────────────
/**
 * The enemy's patterns, by the genre that uses them. telegraph (frames aiming before the first shot), speed (m/s;
 * Infinity: hitscan), burst / gap (shots, frames apart), lag (frames the aim trails the target: a reaction), lock
 * (frames before the shot the aim freezes: the glint), count / spread (deg; 360 all round), z (m above the feet it
 * flies at; 1.1), size (m), life (frames), home (deg/s it turns after the target), lob ({ flight s, g }: a ballistic
 * throw at where the target stood), blast (m: it bursts on the floor), bounce (restitution: it bounces on), wave
 * ({ amp m, hz }: it weaves), damage, down (it knocks down), sight (a laser shows the aim), blockable (false: a guard
 * does not stop it).
 */
export const RANGED = Object.freeze({
  rifle: { genre: 'fps', says: 'a rifle burst: hitscan, the aim a reaction behind; keep moving across it, or break the line', telegraph: 36, speed: Infinity, burst: 3, gap: 6, lag: 10, damage: 12, sight: true, blockable: false },
  marksman: { genre: 'fps', says: 'a marksman: hitscan, the aim locks a beat before the shot (the glint): move then', telegraph: 90, speed: Infinity, lock: 12, damage: 60, sight: true, blockable: false },
  orb: { genre: 'arena', says: 'an orb at the hero', telegraph: 24, speed: 9, size: 0.25, damage: 10 },
  fan: { genre: 'arena', says: 'a fan of five', telegraph: 30, speed: 7, size: 0.2, count: 5, spread: 60, damage: 8 },
  ring: { genre: 'arena', says: 'a ring of twelve, low: jump it, or roll through it', telegraph: 40, speed: 5, size: 0.25, count: 12, spread: 360, z: 0.6, damage: 8 },
  homing: { genre: 'arena', says: 'a homing orb: it turns after the hero; out-turn it', telegraph: 30, speed: 5, size: 0.25, home: 100, life: 240, damage: 12 },
  knife: { genre: 'brawler', says: 'a thrown knife, low and slow: step off its line or jump it', telegraph: 20, speed: 8, size: 0.12, z: 0.8, damage: 10 },
  gun: { genre: 'brawler', says: 'a gunshot: a long aim, then fast; it knocks down', telegraph: 45, speed: 20, size: 0.1, damage: 20, down: true, sight: true },
  pellet: { genre: 'platformer', says: 'a three-way spread of slow pellets', telegraph: 24, speed: 4.5, size: 0.15, count: 3, spread: 50, damage: 3 },
  aimed: { genre: 'platformer', says: 'one shot at where the hero is', telegraph: 20, speed: 6, size: 0.15, damage: 3 },
  lob: { genre: 'platformer', says: 'a grenade lobbed at where the hero stood: it bursts on the floor', telegraph: 30, lob: { flight: 1, g: 20 }, blast: 0.9, size: 0.2, damage: 4 },
  wave: { genre: 'platformer', says: 'a slow shot that weaves', telegraph: 24, speed: 3.5, size: 0.2, wave: { amp: 0.8, hz: 1.2 }, life: 300, damage: 3 },
  buzz: { genre: 'pinball', says: 'a slow shot at the hero', telegraph: 40, speed: 3.5, size: 0.25, damage: 1 },
  burst: { genre: 'pinball', says: 'eight slow shots all round', telegraph: 40, speed: 3, size: 0.2, count: 8, spread: 360, damage: 1 },
  bouncer: { genre: 'pinball', says: 'a spiked ball bounced at the hero: it keeps bouncing', telegraph: 30, lob: { flight: 0.8, g: 15 }, bounce: 0.75, size: 0.3, life: 300, damage: 1 },
});
const rangedOf = (name) => ({ name, burst: 1, gap: 0, ...RANGED[name] });
/** where the hero was `k` frames ago (the aim's reaction) */
function trailAt(S, k) { return k > 0 && S.trail.length ? S.trail[Math.min(k - 1, S.trail.length - 1)] : S.hero.p; }
function shooterThink(S) {
  const D = S.dummy, H = S.hero; if (!S.shooter) return;
  if (D.act?.kind === 'aim') {
    const a = D.act, P = rangedOf(a.name);
    if (!(P.lock && a.f >= P.telegraph - P.lock)) { const t = trailAt(S, P.lag ?? 0); a.aim = [t[0], t[1], t[2] + 1.2]; }   // tracking, until the lock
    D.yaw = Math.atan2(a.aim[0] - D.p[0], a.aim[1] - D.p[1]);
    for (let k = 0; k < P.burst; k++) if (a.f === P.telegraph + k * P.gap) fire(S, D, P, a);
    return;
  }
  if (D.act || D.stun || !D.grounded || S.f % S.card.ranged.every) return;
  const name = S.shooter[S.volleyN++ % S.shooter.length], P = rangedOf(name);
  D.act = { kind: 'aim', f: 0, of: P.telegraph + (P.burst - 1) * P.gap + 12, name, aim: [H.p[0], H.p[1], H.p[2] + 1.2] };
  D.yaw = Math.atan2(H.p[0] - D.p[0], H.p[1] - D.p[1]);
  S.events.push({ f: S.f, who: 'dummy', type: 'aim', name, telegraph: P.telegraph, genre: P.genre, hitscan: P.speed === Infinity });
}
function fire(S, D, P, a) {
  if (P.speed === Infinity) return hitscan(S, D, P, a.aim);
  const z = D.p[2] + (P.z ?? 1.1), mk = (dir, v) => ({ id: S.foeN++, name: P.name, f: 0, life: P.life ?? 240, size: P.size, g: P.lob?.g ?? 0, b: [D.p[0] + dir[0] * 0.4, D.p[1] + dir[1] * 0.4, z], p: [D.p[0] + dir[0] * 0.4, D.p[1] + dir[1] * 0.4, z], v });
  const dx = a.aim[0] - D.p[0], dy = a.aim[1] - D.p[1], d = len2(dx, dy) || 1e-9, base = Math.atan2(dx, dy);
  if (P.lob) {   // a ballistic throw landing where the target stood, `flight` seconds on
    const T = P.lob.flight, g = P.lob.g, tz = groundAt(S, a.aim[0], a.aim[1]) + P.size, dir = [dx / d, dy / d];
    S.foes.push(mk(dir, [(dx - dir[0] * 0.4) / T, (dy - dir[1] * 0.4) / T, (tz - z + 0.5 * g * T * T) / T]));
  } else {
    const n = P.count ?? 1, sp = (P.spread ?? 0) * DEG;
    for (let k = 0; k < n; k++) {
      const ang = n === 1 ? base : P.spread >= 360 ? base + (k * 2 * Math.PI) / n : base + (k / (n - 1) - 0.5) * sp, dir = [Math.sin(ang), Math.cos(ang)];
      S.foes.push(mk(dir, [dir[0] * P.speed, dir[1] * P.speed, 0]));
    }
  }
  S.events.push({ f: S.f, who: 'dummy', type: 'fire', name: P.name, count: P.lob ? 1 : P.count ?? 1, speed: P.speed ?? null });
}
/** a hitscan shot: the ray walked in 5 cm steps, a block above its height is cover, the hero's body a hit */
function hitscan(S, D, P, aim) {
  const H = S.hero, o = [D.p[0] + Math.sin(D.yaw) * 0.35, D.p[1] + Math.cos(D.yaw) * 0.35, D.p[2] + 1.3];
  const d = [aim[0] - o[0], aim[1] - o[1], aim[2] - o[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, u = d.map((x) => x / L), half = S.arena.half;
  let result = 'out', at = o;
  for (let t = 0; t < 80; t += 0.05) {
    const p = [o[0] + u[0] * t, o[1] + u[1] * t, o[2] + u[2] * t]; at = p;
    if (S.arena.blocks.some((k) => k.h > p[2] && p[0] >= k.x[0] && p[0] <= k.x[1] && p[1] >= k.y[0] && p[1] <= k.y[1])) { result = 'cover'; break; }
    if (Math.abs(p[0]) > half || Math.abs(p[1]) > half || p[2] < 0) break;
    if (len2(p[0] - H.p[0], p[1] - H.p[1]) <= RADIUS && p[2] >= H.p[2] && p[2] <= H.p[2] + H.h) { result = 'hit'; break; }
  }
  S.events.push({ f: S.f, who: 'dummy', type: 'fire', name: P.name, hitscan: true, result, from: o.map(r4), to: at.map(r4) });
  if (result === 'hit') { const k = len2(u[0], u[1]) || 1; meet(S, P, [u[0] / k, u[1] / k], o); }
}
/** the enemy's shots in flight: homing turns, gravity on a lob, the weave about its line, the floor (a burst, a
 * bounce), the walls, the hero's body (8 cm substeps) */
function flyFoes(S) {
  if (!S.foes.length) return;
  const H = S.hero, A = S.arena;
  S.foes = S.foes.filter((q) => {
    const P = rangedOf(q.name);
    if (P.home) { const h = Math.atan2(q.v[0], q.v[1]), sp = len2(q.v[0], q.v[1]), nh = turnToward(h, Math.atan2(H.p[0] - q.b[0], H.p[1] - q.b[1]), P.home * DEG * DT); q.v[0] = Math.sin(nh) * sp; q.v[1] = Math.cos(nh) * sp; }
    if (q.g) q.v[2] -= q.g * DT;
    const n = Math.max(1, Math.ceil((Math.hypot(q.v[0], q.v[1], q.v[2]) * DT) / 0.08));
    for (let i = 0; i < n; i++) {
      for (const k of [0, 1, 2]) q.b[k] += (q.v[k] * DT) / n;
      q.p = q.b.slice();
      if (P.wave) { const t = (q.f + (i + 1) / n) / FPS, off = P.wave.amp * Math.sin(2 * Math.PI * P.wave.hz * t), sp = len2(q.v[0], q.v[1]) || 1; q.p[0] += (q.v[1] / sp) * off; q.p[1] += (-q.v[0] / sp) * off; }
      const g0 = groundAt(S, q.p[0], q.p[1]);
      if (q.p[2] - q.size <= g0 && q.v[2] < 0) {
        if (P.bounce) { q.b[2] = g0 + q.size; q.v[2] = -q.v[2] * P.bounce; if (q.v[2] < 1.5) { q.v[2] = 0; q.g = 0; } }
        else {
          if (P.blast && len2(H.p[0] - q.p[0], H.p[1] - q.p[1]) <= P.blast + RADIUS && H.p[2] - g0 < 0.6) { const dd = len2(H.p[0] - q.p[0], H.p[1] - q.p[1]) || 1; S.events.push({ f: S.f, who: 'dummy', type: 'burst', name: q.name }); meet(S, P, [(H.p[0] - q.p[0]) / dd, (H.p[1] - q.p[1]) / dd], q.p); }
          return false;
        }
      }
      if (Math.abs(q.p[0]) > A.half || Math.abs(q.p[1]) > A.half || A.blocks.some((k) => k.h > q.p[2] - q.size && q.p[0] >= k.x[0] && q.p[0] <= k.x[1] && q.p[1] >= k.y[0] && q.p[1] <= k.y[1])) return false;
      if (!q.passed && len2(q.p[0] - H.p[0], q.p[1] - H.p[1]) <= RADIUS + q.size && q.p[2] >= H.p[2] - q.size && q.p[2] <= H.p[2] + H.h + q.size) {
        const sp = len2(q.v[0], q.v[1]) || 1;
        if (meet(S, P, [q.v[0] / sp, q.v[1] / sp], q.p) !== 'pass') return false;
        q.passed = true;   // through it, on the invincible frames or the mercy: it flies on past
      }
    }
    q.f++; return q.f < q.life;
  });
}
/** a ranged hit meets the hero: through invincible frames (a perfect dodge's witch time too) or mercy it passes;
 * a guard from the front stops a blockable one; else it hurts */
function meet(S, P, dir, from) {
  const H = S.hero, C = S.card;
  if (iframed(S, H)) {
    S.events.push({ f: S.f, who: 'hero', type: 'evaded', by: H.act.kind === 'dash' ? C.dash.kind : C.dodge.kind, ranged: P.name });
    const PF = C.guard?.perfect; if (PF && H.act.f < PF.window && !S.witch) { S.witch = PF.witch; S.events.push({ f: S.f, who: 'hero', type: 'perfect', witch: PF.witch, at: H.act.f }); }
    return 'pass';
  }
  if (H.mercy > 0 || H.act?.kind === 'ko') return 'pass';
  const G = C.guard;
  if (H.act?.kind === 'block' && G && P.blockable !== false && (from[0] - H.p[0]) * Math.sin(H.yaw) + (from[1] - H.p[1]) * Math.cos(H.yaw) > 0) {
    H.blockstun = G.block.stun; H.v[0] = dir[0] * G.block.push; H.v[1] = dir[1] * G.block.push;
    if (G.stamina) { H.stamina -= G.stamina.cost; if (H.stamina < 0) { H.stamina = 0; H.blockstun = 0; H.act = { kind: 'stagger', f: 0, of: G.stamina.break }; S.events.push({ f: S.f, who: 'hero', type: 'guard-break', by: 'dummy', stagger: G.stamina.break }); return 'hit'; } }
    S.events.push({ f: S.f, who: 'hero', type: 'block', by: 'dummy', ranged: P.name, blockstun: G.block.stun, stamina: H.stamina }); return 'hit';
  }
  hurtHero(S, P, dir);
  return 'hit';
}
/** what a ranged hit does, the card's `hurt`: a flinch (control kept, the run slowed) or a stop (knocked back, up,
 * stunned, out of the charge if the card says), maneuver armor cutting the stun and the knock, mercy after, life taken */
function hurtHero(S, P, dir) {
  const H = S.hero, C = S.card, HU = C.hurt, MA = maneuverOf(S, H);
  const stun = Math.round((P.down ? HU.down : HU.stun) * (MA ? MA.stun : 1)), knock = HU.knock * (MA ? MA.knock : 1);
  H.mercy = HU.mercy;
  S.events.push({ f: S.f, who: 'hero', type: 'hurt', by: P.name, damage: P.damage, stun, maneuver: !!MA, down: !!P.down && stun > 0 });
  if (stun > 0) {
    H.stun = stun; H.act = { kind: 'hurt', f: 0, of: stun }; H.lastHit = { take: P.down ? 'cross' : 'jab', f: S.f, finisher: false };
    H.v[0] = dir[0] * knock; H.v[1] = dir[1] * knock;
    if (HU.hop) { H.v[2] = Math.sqrt(2 * C.jump.gRise * HU.hop); H.grounded = false; H.jumped = false; H.from = H.p[2]; H.apex = null; }
    if (H.charge && HU.charge !== 'keep') loseCharge(S, H, 'hit');
  } else {
    H.v[0] += dir[0] * knock; H.v[1] += dir[1] * knock;
    if (!MA && HU.slow) H.slowed = HU.slow.frames;
  }
  loseLife(S, H, P.damage);
}
/** maneuver armor: is the body moving in one of the card's ways (then a hit's stun and knock are cut to its shares) */
function maneuverOf(S, B) {
  const M = S.card.maneuver; if (!M) return null;
  const a = B.act, sp = len2(B.v[0], B.v[1]);
  const on = (w) => (w === 'dash' ? a?.kind === 'dash' : w === 'roll' ? a?.kind === 'dodge' : w === 'sprint' ? B.grounded && !a && !!(S.held & BTN.SPRINT) && sp > S.card.ground.run : w === 'run' ? B.grounded && !a && sp >= (M.speed ?? S.card.ground.run * 0.9) : w === 'air' ? !B.grounded : false);
  return M.on.some(on) ? M : null;
}
/** life taken: health down (any hit the end with `oneHit`); rings all scattered, or the end with none; the end is down
 * for `ko` frames, then up again full */
function loseLife(S, B, dmg) {
  const L = S.card.life; if (!L || !(dmg > 0) || B.act?.kind === 'ko') return false;
  if (L.kind === 'rings') { if (B.hp > 0) { S.events.push({ f: S.f, who: 'hero', type: 'rings', lost: B.hp }); B.hp = 0; return false; } }
  else { B.hp = L.oneHit ? 0 : Math.max(0, B.hp - dmg); if (B.hp > 0) return false; }
  B.hp = 0; B.act = { kind: 'ko', f: 0, of: L.ko ?? 90 }; B.stun = 0; B.mercy = 0; B.v[0] = 0; B.v[1] = 0; B.charge = null; S.queue = [];
  S.events.push({ f: S.f, who: 'hero', type: 'ko', oneHit: !!L.oneHit });
  return true;
}

// ─── hits ───────────────────────────────────────────────────────────────
/** the dummy's sparring jab: a telegraph (its startup is long so the hero can read it and dodge) */
/**
 * The sparring dummy's attacks, cycled in turn: each a telegraph (its startup), an ARC (degrees off its facing, + to
 * its right) and the ZONES on it: `zone` the whole arc's ('orange': parryable; 'red'), or `orange` [from, to] the
 * share of the arc that is (the rest red). A SWEEP crosses its arc over its active frames and meets a body on the frame
 * it reaches the body's angle; a thrust (no sweep) is live across its whole arc on every active frame. `unblockable`:
 * a guard does not stop it (a perilous attack: dodge it). `armor`: what interrupts it in its telegraph (the jab any
 * hit, the hook a heavy or a shot, the perilous blow nothing).
 */
export const SPAR = Object.freeze({
  every: 90, range: 2.2,
  moves: Object.freeze([
    Object.freeze({ name: 'jab', take: 'jab', startup: 30, active: 4, recovery: 20, reach: 1.0, arc: [-10, 10], sweep: false, zone: 'orange', tags: ['light'], damage: 8 }),
    Object.freeze({ name: 'hook', take: 'cross', startup: 36, active: 10, recovery: 24, reach: 1.1, arc: [-70, 70], sweep: true, orange: [0.35, 0.65], tags: ['heavy'], armor: { by: ['heavy', 'shot'] }, damage: 15 }),
    Object.freeze({ name: 'perilous', take: 'cross', startup: 48, active: 6, recovery: 30, reach: 1.3, arc: [-30, 30], sweep: false, zone: 'red', unblockable: true, tags: ['heavy'], armor: { by: [] }, damage: 40 }),
  ]),
});
export const sparMove = (a) => SPAR.moves.find((m) => m.name === a?.name) ?? SPAR.moves[0];
function sparThink(S) {
  const D = S.dummy, H = S.hero; if (!S.spar || D.act || D.stun || !D.grounded) return;
  const dx = H.p[0] - D.p[0], dy = H.p[1] - D.p[1];
  if (len2(dx, dy) > SPAR.range || S.f % SPAR.every) return;
  const pool = S.sparMoves ? SPAR.moves.filter((m) => S.sparMoves.includes(m.name)) : SPAR.moves, m = pool[S.sparN++ % pool.length];
  D.yaw = Math.atan2(dx, dy); D.act = { kind: 'spar', f: 0, hit: false, name: m.name };
  S.events.push({ f: S.f, who: 'dummy', type: 'move', take: m.take, name: m.name, telegraph: m.startup, arc: m.arc, zone: m.zone ?? null, orange: m.orange ?? null, unblockable: !!m.unblockable });
}
function moveOf(S, B) {
  if (B.act?.kind === 'move') { const m = moveDef(S, B.act); return { ...m, reach: S.body.reach[m.take], dv: S.body.dv[m.take] }; }
  if (B.act?.kind === 'spar') { const m = sparMove(B.act); return { ...m, dv: S.body.dv[m.take], spar: true }; }
  return null;
}
/** the zone a spar attack meets a body in: the angle off the attacker's facing as a share of the arc */
function zoneAt(m, ang) {
  if (m.zone) return m.zone;
  const u = (ang - m.arc[0]) / (m.arc[1] - m.arc[0]);
  return u >= m.orange[0] && u <= m.orange[1] ? 'orange' : 'red';
}
function testHit(S, A, V, who) {
  const m = moveOf(S, A); if (!m || A.act.hit) return;
  if (A.act.f < m.startup || A.act.f >= m.startup + m.active) return;
  if (m.spar) {   // the arc: the body's angle off the attacker's facing, inside what the swing covers on this frame
    const dx = V.p[0] - A.p[0], dy = V.p[1] - A.p[1], d = len2(dx, dy), ang = angDiff(Math.atan2(dx, dy), A.yaw) / DEG;
    const k = A.act.f - m.startup, span = m.arc[1] - m.arc[0];
    const lo = m.sweep ? m.arc[0] + (span * k) / m.active : m.arc[0], hi = m.sweep ? m.arc[0] + (span * (k + 1)) / m.active : m.arc[1];
    const inside = d <= m.reach + RADIUS && Math.abs(V.p[2] - A.p[2]) <= 0.9 && ang >= lo - 1e-9 && ang <= hi + 1e-9;
    if (!inside) { if (A.act.f === m.startup + m.active - 1) S.events.push({ f: S.f, who, type: 'whiff', i: null, short: r4(Math.max(0, d - m.reach - RADIUS)) }); return; }
    A.act.hit = true;
    return strike(S, A, V, who, { ...m, zone: zoneAt(m, ang), angle: r4(ang) }, [dx / (d || 1), dy / (d || 1)]);
  }
  const dx = V.p[0] - A.p[0], dy = V.p[1] - A.p[1], fx = Math.sin(A.yaw), fy = Math.cos(A.yaw);
  const ahead = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx), up = Math.abs(V.p[2] - A.p[2]);
  if (ahead < 0 || ahead > m.reach + RADIUS || side > 0.45 || up > 0.9) { if (A.act.f === m.startup + m.active - 1) S.events.push({ f: S.f, who, type: 'whiff', i: A.act.i ?? null, short: r4(Math.max(0, ahead - m.reach - RADIUS)) }); return; }
  A.act.hit = true;
  strike(S, A, V, who, m, [fx, fy]);
}
/** a blow landed by A on V (a move's, a plunge's): evaded, immune, guarded, or a hit pushing V along `dir` */
function strike(S, A, V, who, m, [fx, fy]) {
  const vic = who === 'hero' ? 'dummy' : 'hero', inv = vic === 'hero' ? iframed(S, V) : false, guarding = V.act?.kind === 'block';
  if (inv) {
    S.events.push({ f: S.f, who: vic, type: 'evaded', by: V.act.kind === 'dash' ? S.card.dash.kind : S.card.dodge.kind });
    const PF = S.card.guard?.perfect;   // the perfect dodge: the hit met in the dodge's first frames, the attacker slowed
    if (PF && V.act.f < PF.window) { S.witch = PF.witch; S.events.push({ f: S.f, who: vic, type: 'perfect', witch: PF.witch, at: V.act.f }); }
    return;
  }
  if (vic === 'hero' && V.act?.kind === 'block' && S.card.guard && !m.unblockable) {
    const G = S.card.guard, front = (A.p[0] - V.p[0]) * Math.sin(V.yaw) + (A.p[1] - V.p[1]) * Math.cos(V.yaw) > 0;
    const orange = m.zone !== 'red', timed = G.parry == null || S.f - V.act.pressed < G.parry;
    if (front && orange && timed) {   // the parry: met in orange, the guard in time; the attacker staggered open
      const stop = 10; A.stop = V.stop = stop; A.fresh = V.fresh = true;
      A.act = { kind: 'stagger', f: 0, of: G.riposte }; A.stun = G.riposte; A.alert = 0; A.lastHit = { take: 'cross', f: S.f, finisher: false };
      S.events.push({ f: S.f, who: vic, type: 'parry', by: who, at: S.f - V.act.pressed, zone: m.zone ?? null, riposte: G.riposte, hitstop: stop }); return;
    }
    if (front) {   // the block: no stun, a blockstun and a push back, stamina spent
      const stop = hitstop(S, m.dv * 0.5); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
      V.blockstun = G.block.stun; V.v[0] = fx * G.block.push; V.v[1] = fy * G.block.push;
      if (G.stamina) {
        V.stamina -= G.stamina.cost;
        if (V.stamina < 0) { V.stamina = 0; V.blockstun = 0; V.act = { kind: 'stagger', f: 0, of: G.stamina.break }; S.events.push({ f: S.f, who: vic, type: 'guard-break', by: who, stagger: G.stamina.break }); return; }
      }
      S.events.push({ f: S.f, who: vic, type: 'block', by: who, zone: m.zone ?? null, blockstun: G.block.stun, hitstop: stop, stamina: V.stamina }); return;
    }
  }
  if (V.mercy > 0) { S.events.push({ f: S.f, who: vic, type: 'immune', mercy: V.mercy }); return; }
  if (armorHolds(S, A, V, who, tagsOf(m), m.dv)) return;
  const free = V.stun === 0;
  if (vic === 'dummy' && S.guard && free && V.alert > 0 && !V.act) {
    V.alert = S.card.hit.alert; V.combo = 0; const stop = hitstop(S, m.dv * 0.5); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
    V.act = { kind: 'guard', f: 0, of: 12 }; S.events.push({ f: S.f, who: vic, type: 'blocked', i: A.act?.i ?? null, hitstop: stop }); return;
  }
  const advantage = free ? null : V.stun;
  const MA = vic === 'hero' ? maneuverOf(S, V) : null, v0 = V.v.slice();   // maneuver armor: read before the hit moves the body
  V.combo = free ? 1 : V.combo + 1;
  const F = { ...S.card.hit.force, ...(m.force ?? {}) };
  const fx2 = fx, fy2 = fy; let dv, lift = 0;
  if (F.model === 'momentum') { dv = m.dv * F.gain; lift = F.lift ?? 0; }
  else if (F.model === 'boop') dv = F.push;
  else dv = Math.max(F.floor, len2(A.v[0], A.v[1])) * F.restitution;
  const stop = hitstop(S, dv); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
  const along = dv * Math.cos(lift * DEG), up2 = dv * Math.sin(lift * DEG);
  V.v[0] = fx2 * along; V.v[1] = fy2 * along; if (up2 > 0) { V.v[2] = up2; V.grounded = false; V.jumped = false; V.from = V.p[2]; }
  if (F.model === 'boop') { A.v[0] = -fx * F.bounce; A.v[1] = -fy * F.bounce; V.v[2] = Math.sqrt(2 * S.card.jump.gRise * F.hop); V.grounded = false; V.jumped = false; V.from = V.p[2]; }
  if (F.model === 'ricochet') { A.v[0] *= 0.1; A.v[1] *= 0.1; }
  V.stun = stunOf(S, m, dv, V.combo); V.mercy = S.card.hit.mercy; V.alert = S.card.hit.alert; V.lastHit = { take: m.take, f: S.f, finisher: !!m.finisher };
  if (MA) { V.stun = Math.round(V.stun * MA.stun); V.v[0] = v0[0] + (V.v[0] - v0[0]) * MA.knock; V.v[1] = v0[1] + (V.v[1] - v0[1]) * MA.knock; if (!MA.knock) V.v[2] = v0[2]; }
  const shrugged = MA && V.stun === 0;   // hyper armor while moving: the body goes on with what it was doing
  if (!shrugged) V.act = vic === 'hero' ? { kind: 'hurt', f: 0, of: Math.max(12, V.stun) } : null;
  if (V.charge && !shrugged && (vic !== 'hero' || S.card.hurt?.charge !== 'keep')) loseCharge(S, V, 'hit');
  S.events.push({ f: S.f, who: vic, type: 'hit', by: who, i: A.act?.i ?? null, ...(A.act?.kind === 'pound' || A.act?.kind === 'poundLag' ? { pound: S.card.pound.kind } : {}), take: m.take, ...(A.act?.lv ? { charged: A.act.lv } : {}), ...(m.shot ? { shot: m.shot } : {}), ...(m.spar ? { attack: m.name, zone: m.zone, unblockable: !!m.unblockable, guarding } : {}), dv: r4(dv), powerscale: r4(dv / m.dv), hitstop: stop, stun: V.stun, combo: V.combo, advantage, finisher: !!m.finisher, ...(MA ? { maneuver: true } : {}), ...(vic === 'hero' && m.damage ? { damage: m.damage } : {}) });
  if (vic === 'hero') loseLife(S, V, m.damage ?? 0);
}
/** a hit's tags: its own, or a finisher heavy and the rest light */
function tagsOf(m) { return m.tags ?? (m.finisher ? ['heavy'] : ['light']); }
/** the armor a body's attack has on this frame (its window: `frames`, or startup through active), or null */
function armorOf(S, B) {
  const a = B.act; if (!a || (a.kind !== 'move' && a.kind !== 'spar')) return null;
  const m = a.kind === 'spar' ? sparMove(a) : moveDef(S, a), AR = m.armor; if (!AR) return null;
  const [from, to] = AR.frames ?? [0, m.startup + m.active], f = a.shown ?? a.f;
  return f >= from && f < to ? AR : null;
}
/** does V's attack's armor hold against this hit: a tag it names breaks it, so does its `hits`th hit; held, the hit
 * clanks (a short freeze on both, no stun, no push) and the attack goes on */
function armorHolds(S, A, V, who, tags, dv) {
  const AR = armorOf(S, V); if (!AR) return false;
  const n = (V.act.absorbed ?? 0) + 1, vic = who === 'hero' ? 'dummy' : 'hero';
  if (tags.some((t) => AR.by.includes(t)) || (AR.hits != null && n >= AR.hits)) { S.events.push({ f: S.f, who: vic, type: 'armor-break', by: who, tags, hits: n }); return false; }
  V.act.absorbed = n;
  const stop = Math.ceil(hitstop(S, dv) / 2); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
  S.events.push({ f: S.f, who: vic, type: 'armor', by: who, tags, hits: n, of: AR.hits ?? null, breaks: AR.by, hitstop: stop });
  return true;
}
function iframed(S, B) {
  const k = B.act?.kind, I = k === 'dodge' ? S.card.dodge.iframes : k === 'dash' ? S.card.dash?.iframes : null;
  return !!(I && B.act.f >= I[0] && B.act.f < I[1]);
}
function hitstop(S, dv) { const h = S.card.hit.hitstop; return h ? Math.min(h.max, Math.round(h.base + h.perMs * dv)) : 0; }
/** frames of hitstun: the body's own flinch (the reaction time and a flinch scaled by the blow), the combo rule, or none */
function stunOf(S, m, dv, n) {
  const st = S.card.hit.stun;
  if (st.model === 'body') return Math.round((0.22 + 0.4 * Math.min(1, dv / 1.2)) * FPS);
  if (st.model === 'rule') return m.finisher ? Math.round(1.2 * FPS) : Math.round(Math.max(st.min, st.base * st.decay ** (n - 1)) * FPS);
  return 0;
}

// ─── what a body shows ─────────────────────────────────────────────────
/**
 * The clip and the frame in it a body shows on this tick: a move at its frame (a hitstop holds it, since the frame does
 * not advance), the jump's gather, the air by vertical speed (rising → the apex → falling: `u` 0 → 0.5 → 1) or a spin,
 * the landing, a dodge, a reaction, the stride cycle by speed and phase, idle. `scale` the squash and stretch about the
 * feet at take-off and landing (the card's `look.squash`).
 */
export function poseOf(S, who) {
  const B = S[who], C = S.card, a = B.act ? { ...B.act, f: B.act.shown ?? B.act.f } : null, v = len2(B.v[0], B.v[1]);
  const since = (f) => (S.f - f) / FPS; const sq = C.look.squash;
  const pulse = (t) => Math.exp(-((t / 0.05) ** 2));
  let s = 0; if (sq) { s += sq * pulse(since(B.tookOff)); s -= sq * pulse(since(B.landed) - 0.03); }
  let scale = Math.abs(s) < 1e-3 ? null : [1 / Math.sqrt(1 + s), 1 / Math.sqrt(1 + s), 1 + s];
  // a short body is the figure drawn short and broad; a stomped one, flattened for its stun
  const kz = (B.h / HEIGHT) * (B.squash > 0 ? 0.35 : 1);
  if (kz !== 1) { const kx = B.squash > 0 ? 1.5 : 1 / Math.sqrt(kz); scale = [(scale ? scale[0] : 1) * kx, (scale ? scale[1] : 1) * kx, (scale ? scale[2] : 1) * kz]; }
  const base = { p: B.p.slice(), yaw: B.yaw, scale, held: B.stop > 0, charge: B.charge && B.charge.held >= C.charge.show ? { held: B.charge.held, lv: B.charge.lv } : null, gear: B.glide ? C.glide.kind : B.jet ? 'jet' : B.flying ? 'flap' : null };
  if (a?.kind === 'move') return { ...base, clip: 'move', i: a.i, at: a.f, ...(a.lv ? { lv: a.lv } : {}) };
  if (a?.kind === 'charge') return C.charge.kind === 'spin' ? { ...base, clip: 'spin', spin: B.spin, crouch: true } : { ...base, clip: 'charge', at: a.f };
  if (a?.kind === 'dash' && a.spin) return { ...base, clip: 'spin', spin: B.spin, iframes: iframed(S, B) };
  if (a?.kind === 'spar') return { ...base, clip: 'spar', name: a.name, at: a.f };
  if (a?.kind === 'aim') return { ...base, clip: 'aim', name: a.name, at: a.f };
  if (a?.kind === 'gather') return { ...base, clip: 'gather', at: a.f, of: a.of };
  if (a?.kind === 'pound') return { ...base, clip: C.pound.kind === 'plunge' ? 'air' : 'spin', u: 1, spin: C.pound.kind === 'bounce' ? (S.f % 8) * (Math.PI / 4) : B.spin };
  if (a?.kind === 'poundLag') return { ...base, clip: 'land', at: Math.min(a.f, Math.max(0, (C.jump.land || 1) - 1)), of: a.of };
  if (a?.kind === 'dodge') return { ...base, clip: 'dodge', kind: C.dodge.kind, rel: a.rel, at: a.f, of: a.of, speed: v, iframes: iframed(S, B) };
  if (a?.kind === 'dash') return { ...base, clip: 'dash', kind: a.air ? 'dash' : C.dash.kind, air: !!a.air, at: a.f, of: a.of, speed: v, iframes: iframed(S, B) };
  if (a?.kind === 'guard') return { ...base, clip: 'guard', at: a.f };
  if (a?.kind === 'block') return { ...base, clip: 'guard', at: B.blockstun > 0 ? C.guard.block.stun - B.blockstun : 0, block: true };
  if (B.stun > 0 || a?.kind === 'hurt' || a?.kind === 'stagger' || a?.kind === 'bonk' || a?.kind === 'ko') {
    const at = B.lastHit && (B.stun > 0 || a?.kind === 'hurt') ? S.f - B.lastHit.f : a?.f ?? 0;
    return { ...base, clip: 'react', take: a?.kind === 'stagger' || a?.kind === 'bonk' || a?.kind === 'ko' ? 'cross' : B.lastHit?.take ?? 'jab', at, air: !B.grounded, ko: a?.kind === 'ko' };
  }
  if (B.cling) return { ...base, clip: 'air', u: 0.85, cling: true };
  if (B.glide || B.jet || B.flying) return { ...base, clip: 'air', u: B.glide ? 0.5 : 0.4 };   // the glider and the jetpack fly the apex's pose
  if (!B.grounded) {
    const v0 = Math.sqrt(2 * C.jump.gRise * C.jump.height);
    return { ...base, clip: C.jump.spin && B.jumped ? 'spin' : 'air', u: clamp((v0 - B.v[2]) / (2 * v0), 0, 1), spin: B.spin };
  }
  if (C.jump.land && S.f - B.landed < C.jump.land && v < C.ground.walk) return { ...base, clip: 'land', at: S.f - B.landed, of: C.jump.land };
  if (v > 0.05) return { ...base, clip: 'loco', speed: v, phase: B.stride };
  return { ...base, clip: 'idle' };
}

// ─── frame data, read off the card ─────────────────────────────────────
/**
 * Per move: startup (the press frame to the first active frame), active, recovery, total, where the next move may
 * cancel in, the stun it leaves (the card's model, against a fresh victim), and the frames of advantage that leaves:
 * on hit, stun + hitstop − (the frames after contact the attacker still owes before it can act); on block, the guard
 * minus the same. What a fighting game's move list prints, here for any feel.
 */
export function frameData(card, body) {
  const S = { card, body };
  return card.moves.string.map((m, i) => {
    const dv = body.dv[m.take], F = { ...card.hit.force, ...(m.force ?? {}) };
    const shown = F.model === 'momentum' ? dv * F.gain : F.model === 'boop' ? F.push : F.floor * F.restitution;
    const stun = stunOf(S, m, shown, i + 1), stop = card.hit.hitstop ? Math.min(card.hit.hitstop.max, Math.round(card.hit.hitstop.base + card.hit.hitstop.perMs * shown)) : 0;
    const owes = m.active + m.recovery - 1;
    const cancel = card.moves.cancel === 'none' || i + 1 >= card.moves.string.length ? null : card.moves.cancel === 'half' ? m.startup + m.active + Math.ceil(m.recovery / 2) : m.startup + m.active + card.moves.cancel;
    // the link: the stun left when the next move, pressed in time and cancelled in at the earliest, connects (the
    // hitstop freezes both, so it neither adds nor costs)
    const next = cancel == null ? null : card.moves.string[i + 1];
    const link = next ? stun - (cancel - m.startup + next.startup) : null;
    return { take: m.take, startup: m.startup, active: m.active, recovery: m.recovery, total: m.startup + m.active + m.recovery, cancel,
      reach: r4(body.reach[m.take]), dv: r4(shown), stun, hitstop: stop, link, onHit: stun - owes, onBlock: 12 - owes, finisher: !!m.finisher, armor: armorText(m) };
  }).concat(card.charge?.kind === 'heavy' ? card.charge.at.map((m, k) => {   // the charged moves: startup counted from the release
    const dv = body.dv[m.take], F = { ...card.hit.force, ...(m.force ?? {}) }, shown = F.model === 'momentum' ? dv * F.gain : F.model === 'boop' ? F.push : F.floor * F.restitution;
    const stun = stunOf(S, m, shown, 1), stop = card.hit.hitstop ? Math.min(card.hit.hitstop.max, Math.round(card.hit.hitstop.base + card.hit.hitstop.perMs * shown)) : 0, owes = m.active + m.recovery - 1;
    return { take: m.take, charge: k + 1, held: card.charge.levels[k], startup: m.startup, active: m.active, recovery: m.recovery, total: m.startup + m.active + m.recovery, cancel: null,
      reach: r4(body.reach[m.take]), dv: r4(shown), stun, hitstop: stop, link: null, onHit: stun - owes, onBlock: 12 - owes, finisher: !!m.finisher, armor: armorText(m) };
  }) : []);
}
/** an attack's armor in words: none, heavy (what breaks it), hyper; ×n its poise */
function armorText(m) { const A = m.armor; if (!A) return 'none'; const by = A.by.length ? A.by.join(' / ') : 'hyper'; return A.hits ? `${by}, or hit ${A.hits}` : by; }
/** helpers the page and the gate share */
export const util = { stickOf, groundAt, angDiff, RADIUS, HEIGHT, bearing, targetDist, sparMove, zoneAt, armorOf, maneuverOf, rangedOf };
function moveTo(a, b, step) { return a < b ? Math.min(b, a + step) : Math.max(b, a - step); }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function turnToward(a, b, max) { const d = angDiff(b, a); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; }
