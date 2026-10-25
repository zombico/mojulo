---
{
  "id": "distilled-rulebook",
  "name": "Distilled rulebook — a sport written out for the contest kernel",
  "summary": "Take a sport's rules (the operator's words, a rulebook they hand you, or one found through whatever search or document MCP they have) and DISTIL them into what mojulo's primitives can play: the contest kernel's data (the court's regions, the scoring ladder, the serve, the rally, the clock, the fouls, the outs, offside, the turn), the ball card and the hit's verbs, the shape's sim (the court, the course, the pitch) and its dials. What the rulebook says that the primitives cannot carry is written down by name as `omits`, never approximated in silence. The product is a written-out sport `design_game({ quick: { goal: 'contest', sport: { … } } })` plays at once, idempotent on the sport and its variant, with the kernel's own read as the gate.",
  "valueHook": "Any sport whose rules can be stated becomes a playable game in one call — the referee is the kernel, every point, out, foul and restart called by data you can read, and the rules it cannot carry are a list you can see, not a surprise in play.",
  "version": 1,
  "category": "game-design",
  "tier": "ride",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "sport", "prompt": "Which sport, and which variant? ('pickleball', 'handball', 'mini golf, nine holes', 'tennis doubles')" },
    { "name": "source", "prompt": "Where the rules come from: the operator's words, a document they attach, or a search MCP they have connected (name it). Nothing is guessed from memory alone: a rule the source does not state is asked for or left out by name.", "default": "the operator's words" },
    { "name": "register", "prompt": "Where on the ladder it plays: realistic (the sport's own ball in real air) | action | platformer | pinball (the arcade: the ball card and the body change, the rulebook does not)", "default": "realistic" }
  ],
  "mcpTools": { "mojulo": ["get_game_vocab", "design_game", "semantic_search", "update_sketch"] },
  "outputContract": { "summary": "A written-out sport (the `sport` object the contest quick goal takes), its `omits` list, the quick game minted from it, and the kernel's read on the result.", "fields": ["sport", "omits", "game_ref", "shape"] }
}
---

# Distilled rulebook — operating instructions

You are the transcriber, not the referee. A published game asked for by name is written out from the rules the
person explains or hands you, never guessed; the **contest kernel** (`lib/graph/contest/contest-kernel.js`) then
calls every point, fault, out, foul, goal, roll and restart from that data. Your whole job is the distillation:
which of the rulebook's sentences are the kernel's, which are the ball's or the body's, which the primitives cannot
carry at all. The last kind is written down by name. Nothing is approximated in silence.

The book's own sports are the worked examples: read `lib/graph/contest/sports.js` through
`get_game_vocab({ id: 'gameworld-quick-contest' })` and the kernel's shape through the error it throws when a spec
is wrong (it teaches). Tennis is a net game written out, golf and bowling are turn sports, soccer and hockey are
team goal games. A new sport is one of those three shapes, or it is not yet a sport mojulo plays — and that is the
first thing you say.

## The invariants — read first

- **The primitives decide what is a rule.** The kernel carries: a court of named regions (rectangles and circles in
  metres, mirrored for the other side), a ladder of scoring units (points into games into sets, named counts), a
  serve (into which region, how many faults, a let, who serves next), a rally (bounces a side, touches a side, the
  same player twice), a clock (periods, seconds, overtime), fouls (what each costs: a fault, the point, a free, a
  warning), a goal game's outs (a throw-in, a corner, a goal kick) and offside against the ball, a turn sport's
  rounds, shots, tee, cup, penalties and tenpin's frames. The ball card carries mass, size, bounce, friction and
  real air. The hit carries the verbs (forehand, backhand, serve, kick, drive, iron, putt, roll …) with their arc,
  spin and power. The sims carry the bodies: a court with a net, a course with lies, a pitch with goals and a
  keeper. **If a rule is none of these, it is an `omits` line.**
- **The kernel's read is the gate.** `contestRead(spec)` refuses what it cannot read and says why, in its own
  words. A written-out sport that the kernel refuses is not done; a sport the kernel reads is correct as data,
  whatever you think of the rulebook. Never work around a refusal by dropping the rule: name it in `omits` and
  say so to the operator.
- **Register is simplification by name, never a second kernel.** An arcade variant (the cartoon tennis, the mini
  golf) is the same rulebook with named omissions and the register's ball card and body: no lets, a shorter
  ladder, no offside, a growing rally. Write the omissions into `omits` ("no let: the arcade serves straight
  through"); never write a different scoring law to make it feel arcade.
- **One sport, one id; a variant its own id.** `tennis` is the book's and cannot be written out again;
  `tennis-doubles` and `mini-golf` are their own. The same rulebook and variant always distil to the same object
  (idempotent: the operator can diff two readings).
- **The agent never adjudicates.** If the operator asks you to "just call it" during play, the answer is the
  kernel's call, read from the game's display, not your opinion.

## The loop

1. **Find the rules.** The operator's words first. A rulebook they attach, or one found through a document or
   search MCP they have connected, next: read the sections on the field, the scoring, the serve or the start, the
   ball out of play, the fouls, the clock. Quote the sentence you distil from in a comment beside each field (the
   operator reviews the reading, not your memory). A rule the source does not state: ask, or leave it out by name.
2. **Name the shape.** Sides that never mix across a net → `match` on the court (tennis, pickleball, badminton,
   volleyball). One shot at a time, the ball's rest the shot's end → `turns` on the course (golf, mini golf,
   bowling, bocce by its shape). Teams that intermix with a goal and a clock → `team` on the pitch (soccer,
   handball, hockey, futsal). Anything else (basketball's hoop, cricket's wicket, a racket game off a wall) is not
   a shape the sims play yet: say so, stop, and offer the nearest shape with its `omits` if the operator wants
   that anyway.
3. **Distil the kernel's data.** Write `spec` field by field: the court's frame from the rulebook's dimensions,
   its regions for side a (the other side is the mirror: `half-turn` when the diagonal matters, `reflect` when it
   does not), the ladder from the lowest unit up, the serve or the clock, the rally's counts, the fouls and what
   each costs, a goal game's outs and offside, a turn sport's rounds and turn. Call `contestRead` through the quick
   goal (`design_game({ quick: { goal: 'contest', sport } })` reads it first and refuses with the kernel's words)
   until it reads clean.
4. **Distil the dials.** The ball (a book ball by name, or `{ mass, radius, restitution?, friction? }` from the
   rulebook's numbers: a non-sphere rides the sphere's card and `omits` says so), the strokes or the kick by the
   hit's verbs, the net's height, where the server and the receiver stand, a course's clubs and lies and cup, a
   pitch's goal and homes. Copy the shape's dials from the book's sport and change the numbers the rulebook gives.
5. **Write `omits`.** Every rule the source states that the fields above do not carry, one line each, in the
   rulebook's words: "the second-last defender's offside line (the kernel reads offside against the ball)", "a
   shuttle's flight (a sphere's card stands in)", "the let on the serve in the arcade". This list is the honest
   edge of the game; it goes to the operator unasked.
6. **Mint and read.** `design_game({ quick: { goal: 'contest', sport, players, register, level, … } })`. Open the
   game, play an exhibition (`players: 0`), and read the kernel's calls off the display: a serve that never lands
   in its box, a goal that never comes, a round that never ends is a number to fix in the dials, never a rule to
   bend. Then hand the operator the sport object, the `omits`, and the game.

## Mapping decisions that are not obvious

- **A foul against an out.** A foul has a restart that follows (a free, a fault, the point); an out ends the rally
  or hands the ball over by the outs rule. Soccer's handball is a foul (`free`); tennis's ball long is the rally's
  own out, never a foul. Write a foul only for something a player did.
- **The body's numbers are not rules.** How fast a player runs, how far a drive carries, how high a bounce is: the
  register's body and ball card, never the spec. A rulebook sentence about speed or reach is an `omits` line, not
  a field.
- **The court is the rulebook's, in metres, for side a.** Side a's end is y < 0; the net or the halfway line is y
  = 0. A region that is the same for both sides (the pitch, the centre circle) is `shared: true`.
- **Scoring is a ladder.** Rally points into games into sets (tennis); goals decided by the clock (soccer: a unit
  with no `to`); frames with tenpin's marks (bowling: the kernel's own). A sport whose scoring is none of these
  (cricket's innings, basketball's shot clock) is the shape question again.
- **Hot-seat against local pads.** A turn sport is one pad passed round (`seats`); a match or a team game two pads
  (`players`); the computer takes what nobody holds, at the mind's level. Split screen and online play are out of
  scope: say so when asked.

## What not to do

- Do not write a sport from memory when a source is asked for and none is given. Ask, or write the distillation
  with every unstated rule in `omits` and say it is from memory.
- Do not invent a kernel field. If `contestRead` has no word for it, it is an omission, and the way in is a code
  change to the kernel by a maintainer (`CONTRIBUTING.md`), not a workaround in the spec.
- Do not claim the eyes gate. The machine gate is the kernel's read and an exhibition that ends; whether it plays
  well is the operator's to see.
