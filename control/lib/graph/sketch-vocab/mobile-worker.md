---
{ "id": "mobile-worker", "name": "Mobile worker (utility platform, swappable locomotion)", "summary": "workbench + assembler grammar for FUNCTION-FIRST utility robots — construction bots, loader drones, service platforms, spider-tanks — one work identity (livery + tool loadout + sensor-pod head) carried across interchangeable locomotion families (biped pylons / wheeled chassis / replicated wheel-legs); tool modules grounded in real mechanics-view references, NOT the character-first mobile-suit register", "when": "build a worker robot / utility robot / construction bot / loader drone / service platform / spider-tank / wheeled robot / walking work machine: a machine defined by its JOB (lift, clamp, jack, haul, inspect) rather than its silhouette — especially when you want the SAME robot in several locomotion forms (legs vs wheels vs multi-leg crawler)", "tier": "recipe", "marks": ["lathe"], "phase": "p1" }
---

`kind = "workbench"` segments + `kind = "assembler"` composition is the
utility-machine grammar. This is the **function-first sibling** of
[[mobile-suit]]: a mobile suit is a *character* (silhouette, palette taxonomy,
skin bake); a mobile worker is a *platform* (job modules, livery, swappable
locomotion). If the target has a face and a hero pose, route to mobile-suit; if
it has a tool loadout and a duty cycle, it belongs here.

Proven end-to-end 2026-07-16 by the Yellow Construction Utility Worker session:
one identity carried through THREE locomotion morphologies — biped
(`sk_243cilugfy`, `sk_4atbz4qgfg`), wheeled platform (`sk_qyf60ylpj8`), and
spider-tank (`sk_49p4u0f407`, v5 of 5) — with the upper tool modules reused
across all three.

## Step 0 — Identity = livery + job list (not a face)

Lock the platform in one line: **livery + core + tool loadout + sensor head**.
e.g. *"safety-yellow shells, black mechanical core, clamp/pry + screw-jack
loadout, spherical three-dot camera head."* Two rules that keep it a worker:

- The head is a **sensor pod** (camera dots, mast, visor slit), never a face.
- The palette is a **safety livery** (one saturated work color over a dark
  frame), not a character taxonomy.

## Step 1 — Ground every tool module in a real mechanism

Before styling anything, mint `mechanics-view` references for the machine's
actual jobs — the worker session pulled **crane lift, screw jack, slider
crank** (`sk_mkxrhjqkj8`, `sk_pze6pnt8um`, `sk_3pd2m5lc0q`) and read them
before lathing. A clamp arm built off a real
slider-crank reads as a machine; a greebled arm reads as decoration. This is
the register's distinctive move — mobile-suit anchors on a precedent *mech*,
mobile-worker anchors on precedent *mechanisms*.

## Step 2 — Function segments, each its OWN workbench sketch

Decompose by JOB, not anatomy, and name the segment after the job:
*screw-jack stabilizer boot · clamp-and-pry arm module · torso work core +
tool bay · protected sensor head · knee-lift leg pylon*. Each is a separate
`create_workbench` on the measured grid (literal scale — a worker has real
dimensions), iterated with the decision in the title ("b — heavy braced",
"c — front utility chest"). Gate: the segment must read as its mechanism
head-on before it joins.

## Step 3 — Assemble on the ground plane, replicate instead of sculpting

Compose with `create_assembler`: items placed `on: "ground"` with
`at / rotate / scale`. The load-bearing habit is **replication with pose
variance** — author ONE module, instance it per station. The spider-tank's six
legs are one curved wheel-leg module at six stations
(`±x` × front/mid/back), mirrored splay via `rotate: [0,0,±10]` and a `scale`
bump on the mid pair:

```
items: [
  { id:"legRFront", at:[ 1.08,  1.2, 0], rotate:[0,0, 10] },
  { id:"legRMid",   at:[ 1.18,  0,   0], scale:1.03 },
  { id:"legRBack",  at:[ 1.08, -1.2, 0], rotate:[0,0,-10] },
  { id:"legLFront", at:[-1.08,  1.2, 0], rotate:[0,0,-10] },
  { id:"legLMid",   at:[-1.18,  0,   0], scale:1.03 },
  { id:"legLBack",  at:[-1.08, -1.2, 0], rotate:[0,0, 10] },
  { id:"body",      at:[0, 0, 0] },
  { id:"camera",    at:[0, 1.8, 1.68], scale:0.95 },
]
```

## Step 4 — Locomotion is a swappable module family

The platform's morphology axis is the chassis, and ONLY the chassis. Keep the
work identity (torso core, tool arms, sensor head, livery) fixed and swap:

- **biped** — leg pylons + stabilizer boots (the walking site worker)
- **wheeled** — utility chassis with hub wheels; pairs naturally with platform
  accessories (service-mast head, rear battery backpack)
- **spider-tank / multi-leg** — one wheel-leg or leg module replicated per
  station over a low thorax/abdomen body; iterate leg *pose* (bent/tucked
  angles) and body *tilt* across assembly versions, not new leg geometry

Each variant is its own assembler sketch; the family stays coherent because
the modules travel, not because the versions descend from one file.

## Step 5 — Iterate the assembly, title as changelog

v1→vN on the assembled platform with one named decision per version
("bent-up wheel-leg pose", "low tapered abdomen", "rear-tilted flat abdomen").
Judge at body scale: leg splay, stance width, body tilt, and head placement do
more than any segment detail.

## Do / don't

- DO mint the mechanics references first — the jobs are the design.
- DO reuse tool modules verbatim across locomotion variants; that reuse IS the
  family resemblance.
- DON'T give it a face or a hero palette — that's [[mobile-suit]] territory,
  and the two registers read wrong when mixed.
- DON'T sculpt six unique legs — one module, six stations, pose variance.

Pairs with [[mobile-suit]] (the character-first sibling — route by "does it
have a job or a face"), [[compositional-balance]] for the assembled mass
check, and `preview_vehicle_instance` when a variant graduates into a vehicle
family. Assembled workers take the polygomer skin seam (`get_skin_packet` →
paint decals/wear flat over the scaffold → `skin_polygomer`) — hazard stripes
and unit markings without touching the geometry recipe.
