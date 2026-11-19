### KO and kill: the sleep dart, knockouts, waking and dragging

- **Two ways down** (worlds/controllable/knockout.js, opt-in on the pilot's `rule.knockout`): a guard is KILLED by a
  gun's round (it falls and fades, as before) or KNOCKED OUT by stun. What stuns: the pilot's melee blows (fists, the
  knife), its takedown (takedown.js: with the knockout it knocks out where it killed), and a round from a slot whose weapon
  says `stun` (the sleep dart). What a stunning blow hurt is given back and stun taken in its place: a blow stuns
  `melee` (30) per point it would have hurt, so a jab, a cross and a hook knock a guard out; a dart stuns its damage, a
  body's whole most, and puts it to sleep after `drowse` (3 s; half a second in the head), the guard looking round
  meanwhile (startle.js). A stun short of a knockout ebbs once the guard has been left alone a while.
- **A sleeper sleeps for good**: on its back where it fell (the page's `e.tumble`), never stepped by its mind, never
  faded (its disposal put by), never counted by the alarm as a body found. A live teammate that SEES it (its reach, its
  cone, a clear line to the body lying there, past the colliders and the tall grass) walks to where it saw it, kneels over
  it (its gesture) for `wake` (2.5 s) and wakes it: it gets up, both search round there, and the team's alarm is raised.
  A sleeper gone from where it was seen when the waker gets there is searched for there instead; a waker that sees the
  pilot drops it for the pilot.
- **Dragging a body** (the action, near a sleeper, where no takedown is to be had): it trails a metre behind, its head
  to the hands that hold it, the pilot slowed to 1.4 m/s and holding its fire; the action again lets go. Dragged into
  tall grass or behind a wall, no guard finds it, so none wakes it.
- **The alarm's body found needs a clear line** (alarm.js): a downed body behind a wall or in tall grass is not found.
- **The sleep dart gun** (gameworld/arms-kit.js `dart`, shown as `dart gun`): a service pistol firing one quiet dart a
  load, four base rounds of stun (twice in the head), on the stealth rail's loadout before its handgun
  (gameworld/loadout.js `steel-serpents`). The operative of the infiltration room carries the knockout.
- **Shown** (scene/channels/controllable/knockout-view.js): z's drifting over a sleeper (growing over a drowsing guard), a
  waker's progress under them, and at the foot of the screen what the action does: drag the body, or let go.
