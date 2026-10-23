/**
 * FEEL CARDS — what a button does in a game, as one card, and the game templates (poles) a game starts from and is
 * tuned between. Data and pure functions only: the action lab (scripts/spikes/action-lab) plays a card through its
 * kernel and holds it to its laws; a gameworld names a template by its `feel` (lower.js turns the card into the rules
 * the controllable runtime plays). One source: the lab inlines this file into its page, so the card it plays is the
 * card a game is made from.
 *
 *   FEELS, FEEL_IDS      the four feels (realistic, action, platformer, pinball): the cards everything else is laid over
 *   MECH, mechKnobs, mechCard    the heavy-robot rules composed as a mech, laid over a card (a mount)
 *   ARENA, STAGES        the lab's arena and the stages a template is seen on
 *   KATA, fighterCard    versus's all-rounder in its own units, and the lab card made from it (Mojulo Fighter's blend)
 *   POLES, POLE_IDS, VIEWS, variantsOf, poleCard(id, variant?), blendPoles(a, b, t)   the templates
 *
 * Import-free (the lab's page inlines it as text), no dice, no clock.
 */

export const FPS = 60;
const GRAVITY = 9.81;
export const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** a deep copy that keeps Infinity (a card's `turn: Infinity`) */
export const copy = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 'Infinity' : v)), (k, v) => (v === 'Infinity' ? Infinity : v));


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
 *   loadout  the weapons, or null: switchReady (s), slots ([{ name, switchReady?, weapon: { fireClass, auto, rof,
 *            cooldown, burst, burstRof, magazine, reload, reserve, energyMax, energyCost, energyRegen,
 *            energyOverheatRegen, energyUnlockFrac, chargeTime, chargedAmmoCost, chargedImpact, chargedRangeMul,
 *            range, coreAngle, assistAngle, impact, boostFire, projectileSpeed, projectileGravity, lobAngle,
 *            splashRadius, projRadius, proximityRadius, armTime, fuse } }]: MSA's names and meanings)
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
    jump: { commit: 12, height: 0.45, gRise: GRAVITY, gFall: GRAVITY, cut: 1, hang: 0, coyote: 3, buffer: 6, air: 0.1, maxFall: 30, land: 10, heavy: { fall: 5.5, lag: 12 } },
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
    loadout: { switchReady: 1, slots: [   // an FPS's three, from MSA's: the machine gun, the long rifle, the grenade
      { name: 'MACHINE GUN', weapon: { fireClass: 'area', auto: true, rof: 8, magazine: 25, reload: 2.5, coreAngle: 1.5, assistAngle: 1.5, range: 25.6, impact: 12 } },
      { name: 'LONG RIFLE', weapon: { fireClass: 'sight', auto: false, cooldown: 4, magazine: 8, reload: 10, coreAngle: 1.2, range: 38.4, impact: 100 } },
      { name: 'GRENADE', switchReady: 1.33, weapon: { fireClass: 'lob', magazine: 4, cooldown: 0.7, reload: 3.5, projectileSpeed: 26.4, projectileGravity: 9.6, lobAngle: 0, splashRadius: 4.42, projRadius: 0.24, impact: 75, armTime: 0.08, fuse: 5 } },
    ] },
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
    loadout: { switchReady: 1, slots: [   // a mobile suit's, lifted from MSA: the beam rifle (burst, charge), the hyper bazooka, the head vulcan, the V78 energy rifle
      { name: 'BEAM RIFLE', weapon: { fireClass: 'sight', auto: false, burst: 3, burstRof: 9, cooldown: 1.2, magazine: 12, reload: 10, coreAngle: 1.5, range: 38.4, impact: 30, chargeTime: 1.5, chargedImpact: 150, chargedAmmoCost: 3 } },
      { name: 'HYPER BAZOOKA', weapon: { fireClass: 'lob', magazine: 3, cooldown: 5, reload: 10, projectileSpeed: 91.26, projectileGravity: 1.44, lobAngle: 0, splashRadius: 2.04, projRadius: 0.48, proximityRadius: 1.56, impact: 100, armTime: 0.05, fuse: 3 } },
      { name: 'HEAD VULCAN', weapon: { fireClass: 'area', auto: true, rof: 16, magazine: 60, reload: 2.2, coreAngle: 2, assistAngle: 2, range: 28.82, impact: 6 } },
      { name: 'V78 BEAM RIFLE', weapon: { fireClass: 'sight', auto: false, cooldown: 2, magazine: 99, reload: 10, coreAngle: 1.2, range: 38.42, impact: 60, chargedImpact: 100, energyMax: 100, energyCost: 45, energyRegen: 10, energyOverheatRegen: 10, energyUnlockFrac: 1, chargeTime: 1.1, chargedEnergyCost: 75 } },
    ] },
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
    loadout: { switchReady: 0, slots: [   // a run-and-gun's, in MSA's terms: the buster (a straight travelling round, a deep magazine), a special weapon on energy that does not come back
      { name: 'BUSTER', weapon: { fireClass: 'lob', cooldown: 0.12, magazine: 99, reload: 1, projectileSpeed: 12, projectileGravity: 0, projRadius: 0.12, impact: 10, armTime: 0, fuse: 0.9 } },
      { name: 'METAL BLADE', weapon: { fireClass: 'lob', cooldown: 0.2, magazine: 99, reload: 1, projectileSpeed: 10, projectileGravity: 0, projRadius: 0.2, impact: 20, armTime: 0, fuse: 1.2, energyMax: 28, energyCost: 1, energyRegen: 0 } },
    ] },
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
    loadout: null,
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

/**
 * The mech presets, compositions of the heavy-robot rules in the lab's metres (MSA's units ÷ 10, its seconds). HEAVY is
 * mobile-suit-arena's suit (walk 33.6, boost 74, jump 31.2 on gravity 40.8 up / 62.4 down, a 9 s gauge, hover 0.5,
 * inertia 0.5, a 2 s charge to 2.2×, boost armor halving stun, the dodge an overheat). SWIFT is an Armored Core frame:
 * a fast walk, a hard fast boost on a small quick gauge, a quick boost, light landings, a plain jump.
 */
export const MECH = Object.freeze({
  heavy: { size: { height: 2.4 }, ground: { walk: 3.36, accel: 6, decel: 9, turn: 200 }, jump: { speed: 3.12, gRise: 4.08, gFall: 6.24, maxFall: 3.6, air: 0.3 }, armor: 0.5,
    boost: { speed: 7.4, gauge: 9, regen: 5, overheatRegen: 7.5, unlock: 1, jumpCost: 0.8, turnCost: 0.75, inertia: 0.5, dodgeOverheat: true }, hover: { height: 0.05, rise: 3.12 },
    chargeJump: { max: 2, mult: 2.2, dash: 4.08 }, quickBoost: null, gait: { stride: 1.32, lurch: 0.35, shake: 1 }, landing: { per: 4, max: 24 } },
  swift: { size: { height: 2.4 }, ground: { walk: 6, accel: 30, decel: 30, turn: 540 }, jump: { speed: 7, gRise: 14, gFall: 18, maxFall: 12, air: 0.8 }, armor: 0.25,
    boost: { speed: 15, gauge: 4, regen: 1.5, overheatRegen: 3, unlock: 1, jumpCost: 0.3, turnCost: 0.1, inertia: 0.25, dodgeOverheat: false }, hover: { height: 0.15, rise: 6 },
    chargeJump: null, quickBoost: { speed: 26, frames: 10, cost: 0.6, cooldown: 24 }, gait: { stride: 1.6, lurch: 0.12, shake: 0.35 }, landing: { per: 1, max: 8 } },
});
/** the knobs at a weight: each number the presets' blend (1 heavy, 0 swift), a part only one of them has (the charge
 * jump, the quick boost) and a flag taken from the nearer */
export function mechKnobs(weight = 1) {
  const t = Math.max(0, Math.min(1, weight));
  const mix = (h, w) => (typeof h === 'number' && typeof w === 'number' ? r4(w + (h - w) * t)
    : h && w && typeof h === 'object' ? Object.fromEntries(Object.keys(h).map((k) => [k, mix(h[k], w[k])])) : t >= 0.5 ? copy(h) : copy(w));
  return { name: t === 1 ? 'heavy' : t === 0 ? 'swift' : `weight ${t}`, weight: t, ...mix(MECH.heavy, MECH.swift) };
}
/** a card ridden as a mech: its combat kept (moves, hits, guard, loadout, the dodge), its movement the mech's rules */
export function mechCard(card, weight = 1) {
  const K = mechKnobs(weight), c = JSON.parse(JSON.stringify(card, (k, v) => (v === Infinity ? 'Infinity' : v)), (k, v) => (v === 'Infinity' ? Infinity : v)), G = K.ground, J = K.jump;
  return { ...c, says: `${c.says}; riding a mech (${K.name})`,
    ground: { walk: r4(G.walk / 2), run: G.walk, sprint: G.walk, accel: G.accel, decel: G.decel, turn: G.turn },
    jump: { ...c.jump, commit: 0, height: r4((J.speed * J.speed) / (2 * J.gRise)), gRise: J.gRise, gFall: J.gFall, cut: K.chargeJump ? 1 : 0.5, hang: 0, air: J.air, maxFall: J.maxFall, heavy: null, spin: false },
    dash: null, air: null, cling: null, maneuver: { on: ['boost'], stun: K.armor, knock: K.armor },
    boost: K.boost, hover: K.hover, quickBoost: K.quickBoost, chargeJump: K.chargeJump, gait: K.gait, landing: K.landing, size: K.size, mech: { name: K.name, weight: K.weight } };
}


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

/** The stages a pole is seen on: an arena each, shaped for its genre (blocks { x, y, h }, the hero's and the dummy's start). */
export const STAGES = Object.freeze({
  courtyard: { half: 10, blocks: [{ id: 'fountain', x: [-2, 2], y: [3, 5], h: 0.6 }, { id: 'steps', x: [-8, -5], y: [-8, -5], h: 1.2 }, { id: 'wall', x: [5, 8], y: [-2, 1], h: 2.4 }], hero: [0, -4], dummy: [0, 0] },
  ruins: { half: 10, blocks: [{ id: 'pillar-a', x: [-4.4, -3.6], y: [3.6, 4.4], h: 5 }, { id: 'pillar-b', x: [3.6, 4.4], y: [3.6, 4.4], h: 5 }, { id: 'pillar-c', x: [-4.4, -3.6], y: [-4.4, -3.6], h: 5 }, { id: 'pillar-d', x: [3.6, 4.4], y: [-4.4, -3.6], h: 5 }, { id: 'rubble', x: [-7, -5], y: [-0.5, 0.5], h: 0.8 }], hero: [0, -6], dummy: [0, 2] },
  cover: { half: 10, blocks: [{ id: 'wall-l', x: [-6, -2], y: [-1, -0.6], h: 1 }, { id: 'wall-r', x: [2, 6], y: [-1, -0.6], h: 1 }, { id: 'wall-c', x: [-2, 2], y: [3, 3.4], h: 1 }, { id: 'wall-fl', x: [-8, -5], y: [5, 5.4], h: 1 }, { id: 'wall-fr', x: [5, 8], y: [5, 5.4], h: 1 }], hero: [0, -6], dummy: [0, 6] },
  levels: { half: 12, blocks: [{ id: 'tier-l', x: [-12, -6], y: [-12, 12], h: 1.5 }, { id: 'tier-r', x: [6, 12], y: [-12, 12], h: 3 }, { id: 'box', x: [-3, 3], y: [6, 9], h: 1 }], hero: [0, -6], dummy: [0, 4] },
  urban: { half: 14, blocks: [{ id: 'bldg-a', x: [-14, -5], y: [-14, -4], h: 6 }, { id: 'bldg-b', x: [5, 14], y: [-14, -4], h: 6 }, { id: 'bldg-c', x: [-14, -5], y: [4, 14], h: 6 }, { id: 'bldg-d', x: [5, 14], y: [4, 14], h: 6 }, { id: 'crates', x: [-1, 1], y: [0, 1], h: 1.2 }], hero: [0, -9], dummy: [0, 6] },
  compound: { half: 12, blocks: [{ id: 'fence-a', x: [-12, -3], y: [-2, -1.5], h: 2.5 }, { id: 'fence-b', x: [3, 12], y: [-2, -1.5], h: 2.5 }, { id: 'hall-a', x: [-3, -2.5], y: [2, 12], h: 2.5 }, { id: 'hall-b', x: [2.5, 3], y: [-12, -6], h: 2.5 }, { id: 'crate', x: [-8, -3], y: [6, 6.5], h: 2.5 }], hero: [0, -9], dummy: [0, 8] },
  rooftops: { half: 16, blocks: [{ id: 'roof-a', x: [-16, -4], y: [-16, -3], h: 5 }, { id: 'roof-b', x: [-2, 8], y: [-6, 4], h: 7 }, { id: 'roof-c', x: [10, 16], y: [-16, 16], h: 4 }, { id: 'roof-d', x: [-16, -6], y: [2, 16], h: 6 }], hero: [0, -12], dummy: [0, 8] },
  battlefield: { half: 22, blocks: [{ id: 'rock-a', x: [-12, -6], y: [4, 10], h: 6 }, { id: 'rock-b', x: [8, 14], y: [-8, -2], h: 4 }, { id: 'mesa', x: [-3, 3], y: [14, 18], h: 8 }], hero: [0, -10], dummy: [0, 6] },
  platforms: { half: 12, blocks: [{ id: 'step-1', x: [-3, 3], y: [-2, 1], h: 0.8 }, { id: 'step-2', x: [-3, 3], y: [2, 4], h: 1.6 }, { id: 'step-3', x: [-3, 3], y: [5.5, 7], h: 2.6 }, { id: 'step-4', x: [-3, 3], y: [9, 11], h: 1.2 }], hero: [0, -8], dummy: [0, -4] },
  field: { half: 16, blocks: [{ id: 'rock-a', x: [-6, -4], y: [4, 6], h: 1 }, { id: 'rock-b', x: [6, 8], y: [-3, -1], h: 1.4 }], hero: [0, -5], dummy: [0, 3] },
  stage: { half: 9, blocks: [], hero: [0, -2], dummy: [0, 2] },
  highway: { half: 14, blocks: [{ id: 'wall', x: [-1, 1], y: [6, 6.6], h: 4.5 }, { id: 'ledge', x: [-1, 1], y: [-12, -8], h: 1.4 }, { id: 'pillar', x: [-1, 1], y: [11, 11.6], h: 3 }], hero: [0, -1], dummy: [0, 3.5] },
  rail: { half: 14, blocks: [], hero: [0, 0], dummy: [12, -12] },
});

/**
 * KATA: versus's all-rounder (lib/graph/versus) in versus's units (mm, frames; its startup counts the first active
 * frame), held equal to `compileFighter` by the lab's laws. `fighterCard` turns it into the lab card Mojulo Fighter
 * blends with: mm a frame to m/s, versus's own apex sum, the lab's startup the frames before the first active.
 */
export const KATA = Object.freeze({
  walk: { f: 52, b: 40 }, jump: { prejump: 4, vy: 124, g: 6, landing: 3 },
  normals: { L: { startup: 4, active: 2, recovery: 6 }, M: { startup: 7, active: 3, recovery: 14 }, H: { startup: 12, active: 3, recovery: 25 } },
});
export const VS_BUFFER = 4;   // versus-input.js BUFFER: a press is good for this many frames
export function fighterCard(K) {
  const ms = (mmf) => r4((mmf * FPS) / 1000), run = ms(K.walk.f), g = r4((K.jump.g * FPS * FPS) / 1000);
  // versus's apex is its own sum (each frame the gravity, then the rise): n frames up, n the last with the rise still positive
  const n = Math.ceil(K.jump.vy / K.jump.g) - 1, apex = n * K.jump.vy - (K.jump.g * n * (n + 1)) / 2;
  const base = FEELS.action.moves.string, str = ['L', 'M', 'H'].map((k, i) => ({ ...JSON.parse(JSON.stringify(base[Math.min(i, base.length - 1)])), startup: K.normals[k].startup - 1, snap: Math.min(base[Math.min(i, base.length - 1)].snap, K.normals[k].startup - 1), active: K.normals[k].active, recovery: K.normals[k].recovery }));
  return {
    ground: { walk: ms(K.walk.b), run, sprint: run, accel: r4(run * FPS), decel: r4(run * FPS), turn: Infinity },
    jump: { commit: K.jump.prejump, height: r4(apex / 1000), gRise: g, gFall: g, cut: 1, hang: 0, coyote: 0, buffer: VS_BUFFER, air: 0, land: K.jump.landing },
    moves: { string: str, buffer: VS_BUFFER },
  };
}

/**
 * The poles: a game's template, its movement and animation the pole the game is tuned toward. base (a feel), set (the
 * fields it changes, merged over the base: movement, the hit's freeze, the look, the rules it carries), mount (a mech's
 * weight), gear, view { camera, … the camera's own: D (m back), h (m up), off (m right), pitch (rad) }, stage, after (the
 * kind of game it echoes), needs (what it names that the lab has not built).
 */
export const POLES = Object.freeze({
  'fallen-angel': { name: 'Fallen Angel', after: 'Devil May Cry', base: 'action', view: { camera: 'third-person', D: 5, h: 2.6 }, stage: 'courtyard',
    says: 'offense first: twitchy movement, long strings, a hard freeze on every blow, the launcher, the air; the guard and the parry there, but attack is the answer',
    set: { ground: { walk: 2.2, run: 7, sprint: 9.5, accel: 60, decel: 80, turn: 1800 }, jump: { commit: 2, height: 1.5, hang: 6 }, air: { jumps: 1, mult: 0.85 }, hit: { hitstop: { base: 5, perMs: 0.7, max: 16 } }, look: { squash: 0.08, smear: 0.12 }, guard: { parry: 10 } },
    needs: ['melee weapon switching (a moveset a weapon)', 'juggle physics (a floatier air hitstun, combo decay)', 'jump cancel'] },
  'ebon-spirits': { name: 'Ebon Spirits', after: 'God of War, Dark Souls', base: 'realistic', view: { camera: 'shoulder', D: 3.8, h: 2.3, off: 0.55, pitch: 0.16 }, stage: 'ruins',
    says: 'offense and defense, leaning to defense: slower deliberate movement, committed blows with a short freeze, a roll with invincible frames, the lock-on, the parry and stamina',
    set: { ground: { walk: 1.6, run: 4.2, sprint: 6.2, accel: 9, decel: 13, turn: 720 }, jump: { commit: 8, height: 0.5 }, dodge: { kind: 'roll', frames: 26, speed: 5, iframes: [3, 16], back: { speed: 0.7, frames: 0.8 }, cancel: false }, hit: { hitstop: { base: 2, perMs: 0.4, max: 7 } } },
    needs: ['one stamina pool for rolls, attacks and the sprint', 'heals that commit', 'enemy health and poise'] },
  'cogs-of-combat': { name: 'Cogs of Combat', after: 'Gears of War', base: 'realistic', view: { camera: 'shoulder', D: 3.2, h: 2.1, off: 0.75, pitch: 0.14 }, stage: 'cover',
    says: 'Ebon Spirits as a hard shooter: heavy bodies, a roadie run, an evade roll, landings that weigh, the guns',
    set: { ground: { walk: 1.6, run: 3.8, sprint: 7, accel: 9, decel: 12, turn: 540 }, jump: { commit: 10, height: 0.4 }, dodge: { kind: 'roll', frames: 22, speed: 6, iframes: null, back: { speed: 0.7, frames: 0.8 }, cancel: false }, landing: { per: 2, max: 10 } },
    needs: ['cover (snap, blind fire, pop out)', 'aiming apart from the facing', 'active reload', 'the roadie run\'s camera'] },
  'infinity-crisis': { name: 'Infinity Crisis', after: 'arena and hero shooters', base: 'action', gear: 'jet', view: { camera: 'first-person' }, stage: 'levels',
    says: 'movement and abilities over aim: fast, a double jump, a jetpack, dashes, the guns',
    set: { ground: { walk: 2.5, run: 6.5, sprint: 8.5, accel: 70, decel: 70, turn: 1800 }, jump: { commit: 0, height: 1.3, hang: 0, cut: 0.6, air: 0.9 }, air: { jumps: 1, mult: 0.85 }, look: { squash: 0.03, smear: null } },
    needs: ['ability slots with cooldowns and an ultimate', 'air-strafe acceleration', 'shields and healing'] },
  conscription: { name: 'Conscription: Contemporary Combat', after: 'the contemporary FPS', base: 'realistic', view: { camera: 'first-person' }, stage: 'urban',
    says: 'the general FPS: a soldier\'s run and sprint, a short jump, the guns, no lock-on',
    set: { ground: { walk: 1.6, run: 4.6, sprint: 7.2, accel: 16, decel: 20, turn: 1080 }, jump: { commit: 3, height: 0.55, air: 0.3 }, lock: null },
    needs: ['aim-down-sights', 'the sprint-to-fire delay', 'the slide', 'the mantle', 'recoil and spread'] },
  'steel-serpents': { name: 'Steel Serpents', after: 'Metal Gear', base: 'realistic', view: { camera: 'overhead' }, stage: 'compound',
    says: 'stealth action, a stretch of realistic: a careful walk, a dive roll, the counter',
    set: { ground: { walk: 1.3, run: 4.2, sprint: 5.8, accel: 8, decel: 12, turn: 720 }, jump: { commit: 10, height: 0.4 }, dodge: { kind: 'roll', frames: 28, speed: 4, iframes: null, back: { speed: 0.7, frames: 0.8 }, cancel: false }, guard: { parry: 8 } },
    needs: ['crouch and prone', 'enemy senses and alert (mojulo\'s mind.js perception)', 'grab and takedown', 'wall-hug'] },
  'vigilante-justice': { name: 'Vigilante Justice', after: 'superhero games', base: 'action', gear: 'glide', view: { camera: 'third-person', D: 5.5, h: 3.2 }, stage: 'rooftops',
    says: 'action with stealth, toward action: a fast run, a high jump, the cape glide, counters on a lenient window, the lock-on on the crowd',
    set: { ground: { walk: 2, run: 7, sprint: 10, accel: 25, decel: 30, turn: 900 }, jump: { commit: 3, height: 1.6, hang: 4 }, glide: { kind: 'glide', fall: 2.5, speed: 10, accel: 8, turn: 120, time: null }, guard: { parry: 14 }, lock: { range: 10, turn: 1440, strafe: 0.85 } },
    needs: ['free-flow: the lunge from target to target', 'grapple and swing', 'parkour', 'stealth (as Steel Serpents)'] },
  'mech-battle-kai': { name: 'Mech Battle Kai', after: 'mobile-suit-arena', base: 'action', mount: 1, view: { camera: 'mech' }, stage: 'battlefield',
    says: 'MSA\'s principles: the heavy mech, the boost on its gauge, the hover, the charge jump, the landings',
    set: {}, needs: ['the kneel', 'the tackle'] },
  'jumping-giuseppe': { name: 'Jumping Giuseppe', after: 'the mascot platformer', base: 'platformer', view: { camera: 'side' }, stage: 'platforms',
    says: 'the mascot platformer: movement first, a springy squash and stretch, the stomp, the ground pound, the wall jump',
    set: { look: { squash: 0.28, smear: null }, lane: { x: 0, face: false } }, needs: ['context jumps (the long jump, the backflip, the triple jump)', 'power-ups'] },
  'isekai-party': { name: 'Isekai Party', after: 'the RPG', base: 'realistic', view: { camera: 'iso' }, stage: 'field',
    says: 'controlled, not collision: an even walk, no freeze, no knockback, no stun; what lands is resolved, not shoved',
    set: { ground: { walk: 1.6, run: 4.5, sprint: 6, accel: 20, decel: 30, turn: 900 }, jump: { commit: 4, height: 0.5 }, hit: { hitstop: null, stun: { model: 'none' }, force: { model: 'momentum', gain: 0, lift: 0 } }, hurt: { stun: 0, knock: 0, slow: null, mercy: 0, charge: 'keep' } },
    needs: ['targeted resolution (by range and stats, no hit areas)', 'cast bars and a global cooldown', 'the party'] },
  'mojulo-fighter': { name: 'Mojulo Fighter', after: 'the 2D fighter', base: 'action', view: { camera: 'side' }, stage: 'stage',
    says: 'mojulo\'s versus loop itself (lib/graph/versus): a walk forward and back, a fixed jump arc after its prejump, facing the foe, blocking by holding back, high, low and the throw, the specials, meter and the super, rounds; played on the lab\'s keys, watched by the lab\'s gate',
    // the card the lab's kernel plays when the template is blended toward another: Kata's numbers (versus units, below) in the lab's
    set: { ...fighterCard(KATA), air: null, cling: null, lock: null, glide: null, jet: null, lane: { x: 0, face: true } },
    versus: { p1: 'kata', p2: 'brisk', scheme: 'modern' },
    needs: ['the lab\'s baked takes on the versus bodies (they wear the 2D rig)', 'a dropped press that versus reports itself (the lab watches it from outside)', 'hold-release charge moves', 'the lab\'s offense-armor tags on versus moves', 'a ¾ camera that turns with the fighters (2.5D)'] },
  'galaxy-boy': { name: 'Galaxy Boy', after: 'Mega Man X', base: 'platformer', view: { camera: 'side' }, stage: 'highway',
    says: 'the run-and-gun: the buster\'s tap shot (three out at most) and its charge, held through anything, the dash and the dash jump that keeps its speed, the wall slide and the wall kick, the air dash; no stomp, no double jump',
    set: {
      ground: { walk: 1.6, run: 5.5, sprint: 5.5, accel: 120, decel: 120 }, jump: { height: 1.6, cut: 0.35, coyote: 4 }, air: { jumps: 0, mult: 0.9 },
      dash: { kind: 'dash', frames: 28, speed: 10, iframes: null, air: { count: 1, speed: 10, frames: 20 }, cancel: false, hold: { min: 6 }, jump: true, wall: true },
      land: { model: 'slide', slide: 3, step: { cooldown: 12 } }, pound: null,
      charge: { kind: 'shot', levels: [30, 90], show: 14, stance: false, air: true, tap: { speed: 15, size: 0.08, life: 36, max: 3, force: { push: 1 }, tags: ['light', 'shot'] }, at: [
        { speed: 15, size: 0.18, life: 48, force: { push: 4 }, tags: ['light', 'shot'] },
        { speed: 17, size: 0.42, life: 60, force: { push: 7, hop: 0.7 }, tags: ['heavy', 'shot'] },
      ] },
      life: { hp: 16, oneHit: false, ko: 90 }, lane: { x: 0, face: false },
    },
    needs: ['ladders', 'a boss\'s weapon got (a weapon a boss)', 'sub-tanks and heart tanks', 'armor parts (the legs earn the air dash)'] },
  'commuter-rail-runner': { name: 'Commuter Rail Runner', after: 'the infinite runner', base: 'pinball', view: { camera: 'third-person', D: 5.5, h: 2.8, pitch: 0.22 }, stage: 'rail',
    says: 'the endless run, pinball\'s body: the track comes at you faster and faster; on the rails a flick switches lanes, a jump clears a barrier, a roll or a boost goes under an overhead, a train is dodged, coins gathered, a hit stumbles and a second ends it; on the slope the ball steers free between rocks and pillars, one hit and the run is over',
    set: {
      runner: { speed: 9, ramp: 0.08, max: 18, lanes: [-1.6, 0, 1.6], shift: 8, steer: 7, width: 4.5, every: 16, ahead: 90, lead: 30, seed: 11, low: 0.8, kinds: { barrier: 3, overhead: 2, train: 2, coin: 3 }, crash: 'stumble', stumble: { slow: 0.6, mercy: 50, window: 120 } },
      jump: { height: 1.4, gRise: 24, gFall: 30 }, dodge: { kind: 'roll', frames: 24, speed: 10, iframes: null, back: { speed: 0.7, frames: 0.75 }, cancel: true }, lock: null,
    },
    variants: {
      rails: {},
      slope: { runner: { lanes: null, speed: 11, max: 22, kinds: { barrier: 0, overhead: 0, train: 0, coin: 0, rock: 3, pillar: 2, ring: 4 }, crash: 'end', every: 12 } },
    },
    needs: ['the chaser (the guard who catches a second stumble)', 'ramps onto the trains\' roofs', 'power-ups (the magnet, the jetpack, the super sneakers)', 'the track\'s turns (the free runner\'s corners)'] },
});
export const POLE_IDS = Object.freeze(Object.keys(POLES));
/** a pole's variants (its first the default): each the fields it changes over the pole's own */
export const variantsOf = (id) => Object.keys(POLES[id]?.variants ?? {});
/** the viewers a pole may name (the page draws each): ¾ follow, isometric, overhead, side, third-person chase, over-the-shoulder, first-person, the mech's chase */
export const VIEWS = Object.freeze(['three', 'iso', 'overhead', 'side', 'third-person', 'shoulder', 'first-person', 'mech']);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** a deep merge: objects merge, everything else (a number, a list, null) replaces */
export function mergeDeep(a, b) { if (!isObj(a) || !isObj(b)) return copy(b); const o = { ...copy(a) }; for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(a[k]) ? mergeDeep(a[k], v) : copy(v); return o; }
/** a pole's card: its base feel with its fields merged over (a mech mounted), named for the pole */
export function poleCard(id, variant = null) {
  const P = POLES[id], v = variant ?? variantsOf(id)[0], merged = mergeDeep(mergeDeep(FEELS[P.base], P.set ?? {}), (v && P.variants?.[v]) ?? {});
  const card = P.mount != null ? mechCard(merged, P.mount) : merged;
  return { ...card, says: P.says, pole: id, ...(v ? { variant: v } : {}) };
}
/** between two poles: every number blended (`t` 0 the first, 1 the second), anything else (a model, a list, a rule one
 * of them lacks) taken from the nearer; the viewer and the stage the nearer's */
export function blendPoles(a, b, t) {
  const A = poleCard(a), B = poleCard(b), u = Math.max(0, Math.min(1, t)), cp = (v) => (v === undefined ? undefined : copy(v));
  const mix = (x, y) => (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? r4(x + (y - x) * u)
    : isObj(x) && isObj(y) ? Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((k) => [k, k in x && k in y ? mix(x[k], y[k]) : cp(u < 0.5 ? x[k] : y[k])]).filter(([, v]) => v !== undefined))
    : cp(u < 0.5 ? x : y));
  return { ...mix(A, B), says: `between ${POLES[a].name} and ${POLES[b].name} (${u})`, pole: u < 0.5 ? a : b, blend: { a, b, t: u } };
}
