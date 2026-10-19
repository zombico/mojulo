---
{
  "id": "physics-demo-for-a-class",
  "name": "Physics demo for a class",
  "summary": "Turn a teacher's ask into a classical science world composed from Newton's laws: the claim the lesson makes goes in the model and is checked, the picture goes in the dress, every exaggeration is declared; mint it with create_view (kind 'classical'), read its gates, measure the numbers the lesson cites, and film it (run, slowed replay, end card) to MP4.",
  "valueHook": "A teacher says what the class should see; they get an interactive demo and a short film whose physics is checked against conservation laws and the textbook answer, and which says on screen what is real and what is drawn.",
  "version": 1,
  "category": "explainer",
  "tier": "design",
  "parameters": [
    { "name": "ask", "prompt": "What should the class see or understand? (e.g. 'why a heavier pendulum doesn't swing faster', 'a ball bouncing lower each time', 'how the Moon stays up')" },
    { "name": "audience", "prompt": "Who is it for (age or course)? It sets the callouts' words, never the physics.", "default": "secondary school" },
    { "name": "output", "prompt": "page (the interactive demo) | film (an MP4 for a slide or a video) | both", "default": "both" }
  ],
  "mcpTools": { "mojulo": ["semantic_search", "get_view_vocab", "create_view", "measure_view", "update_sketch", "forge_motion"] },
  "outputContract": { "summary": "One classical-view sketch (the interactive demo) and, when output includes film, one forge_motion MP4 of its film; plus a report naming the gates that ran and what they saw, the liberties the demo takes, and the numbers it cites.", "fields": ["worldRef", "worldUrl", "motionRef", "gates", "liberties"] }
}
---

# Physics demo for a class

The organizing principle: **decide the one claim the lesson makes, put exactly what proves it in the model, and let
everything else be dress, declared.** A teacher's ask mixes three things: the physics that must be right (the
period does not depend on the mass), what makes it readable (a big brass bob, a slow replay), and the words (a
caption at the moment it happens). A classical science world keeps them apart. The `model` is dimension-checked,
stepped and examined; the `dress` only changes how it looks and never reaches the solver; anything drawn rather
than real is a liberty the page and the film show. Spend the effort on the model. The dress is cheap and
reversible.

## Is it classical? (decide before writing anything)

The classical scale is bounded by Newton's laws, not by size: a falling ball, a pendulum, a planet's orbit and a
charge curling in a magnet are all classical, and two regime gates say when a model leaves that ground. Read the
ask for what the explanation needs to resolve:

| The ask needs… | Scale | What to do |
|---|---|---|
| bodies moving under forces, contacts, springs, orbits, fields on charges | classical | compose it (this catalyst) |
| molecules moving, colliding, binding, being counted; cells; diffusion | microscopic | compose it the same way: kind `microscopic`, card `get_view_vocab({ id: 'microscopic' })` |
| energy levels, tunnelling, orbitals, spin and measurement, half-life | quantum | compose it the same way: kind `quantum`, card `get_view_vocab({ id: 'quantum' })`; why a bond forms is not in its table yet (the curated `molecule` kind) |
| a black hole's light, Mercury's turning orbit, clocks slowed by gravity, GPS | relativistic | compose it the same way: kind `relativistic`, card `get_view_vocab({ id: 'relativistic' })`; a spinning hole, gravitational waves and special relativity are not in its table (the curated `black-hole` / `gravity-wave` kinds) |

A ready-made kind is quicker when it already *is* the demo (the mechanics kind's simple machines and engines, the
orbit kind's solar system, the rocket and airplane missions). Compose when the setup is the teacher's own, or
should change ("what if the pendulum were on the Moon", "three balls, not two").

## Steps

1. **Read the card.** `get_view_vocab({ id: 'classical' })` holds the law table (each law's parameters, units,
   what it leaves out, a smallest example), the dress, the film dress and worked examples. Do not compose from
   memory: the table is the vocabulary, and a law it lacks comes back as a gap.

2. **Write the claim as a measurable quantity.** "A heavier pendulum doesn't swing faster" is *the period of two
   pendulums, masses 1 kg and 5 kg, same length*. "It bounces lower each time" is *the height after each bounce*.
   The quantity goes in `model.observe` (`{ quantity: 'period', of: 'heavy' }`, `'energy'`, `'momentum'`), and is
   what the readout shows, the mint reports and the film's callouts cite.

3. **Write the smallest model that proves it.** Bodies with real masses and sizes in real units (`'500 g'`,
   `'2 m'`, `'36 km/h'`; the solver checks dimensions), the laws that act (from the table), a duration that shows
   the claim at least twice (two periods, three bounces). Real values, not convenient ones: if the class should
   see a real ball, use a real ball's mass, radius and restitution. Two setups side by side ("heavy and light")
   are two bodies in one model, each with its own laws. Leave out what the claim does not need (air drag for a
   pendulum's period); the page lists what the model leaves out, so the teacher can say it.

4. **Dress the page lightly.** Colours and labels that match how the teacher talks about the bodies, `vectors:
   true` when the lesson is about velocity or force, a `camera` that shows the motion's plane, `playback` when the
   real run is too fast or too slow to watch. The interactive page is explored, not narrated: no captions there.

5. **Mint and read the gates.** `create_view({ kind: 'classical', params: { model, dress, liberties }, title })`.
   The response carries every gate, `{ id, want, ok, value, detail }`:
   - `closed-form:*` (the textbook answer: a period, a range, a terminal speed, a collision's outcome) is the
     sharpest check that the demo shows what physics says. When the setup has one, it should hold.
   - `energy-conserved` / `energy-never-gained`, `momentum-conserved`, `constraints-held`, `no-tunnelling`,
     `dt-resolves`: the run is numerically sound.
   - `newtonian-regime`, `classical-regime`: the model is still classical.
   - `gaps`: a law the table lacks, with the scale that owns it.
   A gate that advises is about the **model**: fix the model (a shorter duration, a smaller step, real units),
   never the dress. A gate is never hidden by a caption.

6. **Measure what the lesson cites.** `measure_view({ ref })` returns every body's samples and the system's
   energy and momentum in SI. Take the numbers the callouts and the teacher will quote from here (the mint's
   `observed` covers the common ones), never from the picture.

7. **Iterate in place.** `update_sketch({ ref, patch })` on the same ref to change a mass, a law or the dress;
   the gates come back with it. Re-mint only for a side-by-side variant the teacher wants to keep.

8. **Film it** (when `output` includes film). Add `dress.film.callouts` on the model's clock: a few short captions
   at the moments that carry the claim, worded for the `audience`, citing measured numbers ("period 2.01 s, both
   pendulums"), `on: '<body>'` to pin one beside a body. `dress.film.replay.at` picks the moment to slow down
   when the solver's choice (the sharpest change in motion, else the fastest moment) is not the lesson's. Then
   `forge_motion({ subject: { world_ref: <ref> }, shot: { motion: 'plan' }, export: 'mp4' })`: a wide shot of
   the run, the slowed replay, and the end card (what is real, what was checked, what is drawn).

9. **Report honestly.** Name the gates that ran and what they saw (with the numbers), every liberty (the page's
   and the film's), any gap, and say plainly that **nobody has looked at it yet**: the eyes gate is the teacher's
   (does it read as the phenomenon to their class?). Hand them the `worldUrl` and the MP4.

## Worked example: "a heavier pendulum doesn't swing faster"

```
create_view({ kind: 'classical', title: 'Heavy and light pendulums', params: {
  model: {
    bodies: [{ id: 'light', mass: '200 g', radius: '3 cm', at: [0.5, 0, 0.134] },
             { id: 'heavy', mass: '2 kg',  radius: '5 cm', at: [0.5, 1, 0.134] }],
    laws: [{ law: 'gravity-uniform' },
           { law: 'rod', between: ['light', [0, 0, 1]] }, { law: 'rod', between: ['heavy', [0, 1, 1]] }],
    duration: 6,
    observe: ['energy', { quantity: 'period', of: 'light', axis: [1, 0, 0] }, { quantity: 'period', of: 'heavy', axis: [1, 0, 0] }] },
  dress: { camera: 'angle', bodies: { light: { label: '200 g' }, heavy: { label: '2 kg' } },
           film: { callouts: [{ at: [1, 3], text: 'Ten times the mass, the same swing' }] } } } })
```

The two periods in `observed` are equal (both 2.04 s for a 1 m rod released at 30°, against 2.01 s for a small swing), the energy gate holds, the
rods hold; the film's caption cites the measured period. The closed-form pendulum gate does not run here (it
checks a single pendulum), so cite the two measured periods side by side instead.

## Pitfalls

- **An exaggeration put in the model.** A bigger ball "so it shows" changes drag, contacts and buoyancy. Leave
  the real size in the model: the page draws a too-small body larger by itself and says so.
- **A claim the run does not show.** A caption that says "energy is conserved" over a run with friction is wrong
  on screen. Write callouts from the gates and the measured numbers, not from the ask.
- **A long run of a fast system.** A year of a Moon orbiting at a fine step hits the step budget and the
  `dt-resolves` gate advises. Shorten the duration or let the playback speed it up.
- **Chaos read as error.** A double pendulum or three bodies diverge from tiny differences; the run is still
  sound (the energy gate holds). Say "this is chaotic" rather than presenting one run as the only outcome.
- **The regime edge.** An electron at a large fraction of light speed, or in a nanometre box, leaves classical
  physics; the regime gates advise. Do not caption over it; compose it as a quantum world.
- **Slow motion unannounced.** The film tags its slowed replay and lists it on the end card. A recipe's own shoot
  plan with a `speed` keeps that honesty; do not cut a slowed shot in as if it were real time.
- **Claiming the eyes gate.** The machine gate is the solver's; whether it teaches is a person looking at it.
