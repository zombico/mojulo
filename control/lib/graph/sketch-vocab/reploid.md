---
{ "id": "reploid", "name": "Reploid (toy-like friendly-face android design language)", "summary": "a sibling mobile-suit language to g-series and z-series, native to the manji-tree + lathe substrate: toy-like androids whose every appendage is an honest cylinder, cone, or sphere — watermelon helmet opened into a face window showing a cream humanoid face with real two-eye construction (white sclera + blue iris + dark lids + mouth slit), spherical shoulder/knee joints, cylinder forearms with donut cuffs, tapered boot cones over half-egg phi feet, one horizontal barrel chest — hero red / armor white / graphite frame palette roles, rockman-inspired. Protoform: the Humanoid-Face line; reference unit reploid-0 = sk_mech_hero_phi_feet", "when": "build a reploid / reploid-1, reploid-2, the next reploid unit / a toy-like robot boy or android character / a rockman- or astro-boy-inspired robot / a friendly-faced mech with cylindrical cone-like limbs — when the target is a CHARACTER TOY with a real face rather than heroic box-chamfer armor (g-series), a mono-eye field machine (z-series), or a job platform (mobile-worker)", "tier": "recipe", "marks": ["manjiTree", "lathe"], "phase": "p1" }
---

The reploid series is the third design language codified inside the
[[mobile-suit]] register — sibling to [[g-series]] (heroic box-chamfer armor)
and [[z-series]] (mono-eye rounded real-robot) — but unlike those two it is
**native to the original manji-tree + lathe substrate**, not the workbench +
assembler grammar: one tree, one zenith→nadir spine, lathes swept between
slots or literal axes. Its protoform is the **Humanoid-Face line**
(2026-07-15, ~50 segment + assembly sketches); the reference unit is

- **reploid-0** = `sk_mech_hero_phi_feet` ("Humanoid-Face mech - head tucked
  back") — 334 slots, 229 lathes (222 shaped), walkable at
  `/api/sketches/sk_mech_hero_phi_feet/world`. Predecessor color pass:
  `sk_mech_hero_3d` (v11w, "hero red/white/gunmetal").

## The thesis — a reploid is a TOY with a face

Where a g-series unit is a war machine and a z-series unit is a field machine,
a reploid is a **friendly android character**. Two commitments define the
language:

1. **Cylinder-cone honesty.** Every appendage reads as the primitive it is —
   cylinder forearm, tapered boot cone, sphere shoulder, half-egg foot. No
   chamfered housings, no greebles, no inset service cuts. The toy read comes
   from the silhouette decomposing visibly into cylinders, cones, spheres,
   and eggs.
2. **A real face.** The head is a rounded helmet opened into a face window,
   and inside it is a cream humanoid face with true two-eye construction and
   a mouth. The face — not a visor, not a mono-eye — is the identity center.

## Protoform trail (the Humanoid-Face line, all refs live in `sketches`)

Segment sheets first (the [[mobile-suit]] method), then assemblies:

- **Head** — `sk_hqcab2x9h2` (rounded helmet + face pod) → `sk_t8qsuxn1ml`
  ("clean friendly face window") → `sk_headmelon01` (raised cut-open helmet
  shell) → `sk_headmelon02` ("rounded watermelon helmet shell").
- **Arm** — `sk_ra5qfnsjks` (cylinder forearm, glove hand) →
  `sk_jmqnx8gn60` ("thin forearm donut cuffs").
- **Lower leg / foot** — v1→v10, `sk_gty4ubl1j9` (calf cylinder + rounded
  boot) through `sk_kxntdk72he` ("split half-egg foot") to `sk_4xed7kc4e4`
  ("smooth long half-egg foot").
- **Torso / pelvis** — v1→v15, rounded core → `sk_o4las13efb` ("round chest
  orb") → `sk_sf2tgxl8zl` ("horizontal barrel chest") → `sk_xtbddvq8y4`
  ("tucked paired hip cylinder joints").
- **Assemblies** — connected legs v1–v3 (`sk_etnky6yoxl`, "superposition
  knee ball joint"), full assembly v1–v10 (`sk_izl53t6kax` …
  `sk_colorpass01`), then the hero color pass (`sk_mech_hero_3d`) and the
  final proportion/tilt passes → **reploid-0**.

## 1. Palette — colors are ROLES, not decoration

Census of reploid-0 (229 lathes):

| Role | Hexes (canonical) | Where it is ALLOWED |
|---|---|---|
| Face cream | `#ecd6bd` | the face pod ONLY — visible skin inside the helmet window |
| Hero red (identity armor) | `#c23a2a`, panel `#d9503c`, deep `#b72d26`, oxide shadow `#6f1715` `#7f2016` `#7d1715` | helmet shell, chest barrel, shoulder enclosures, boots + feet |
| Armor white | `#ede7db`, bright `#f4f0e8` | thighs, joint spheres, collar ring, helmet brow/support volumes |
| Frame graphite | `#181c20` `#343a40` `#3a434a` `#262c31` `#101010` | neck cylinder, sockets, soles, face micro-detail (lids, mouth slit) |
| Trim gold | `#d9a51f` | waist + boot trims, 1–2 small emblem points |
| Eyes + gem | iris `#2f8dff` over sclera `#ffffff`, lens cyan `#48cfea` | the two eyes and the helmet gem, nothing else |

Reploid is the **only language in the register with a Face role** — real eyes
built as white sclera + blue iris + dark lid strokes, plus a centered mouth
slit. Face cream, sclera/iris, and frame never re-hue; the hero red family is
the swap axis (a rockman-style "weapon-change" variant re-hues red → any
saturated family while white, face, and gold hold). Role placement is the
series; do not move a role to a new region.

## 2. Spine canon — the z-stack of reploid-0

One zenith→nadir spine, feet at z≈0, helmet crown ≈ z 5.34:

```
half-egg feet + boot cones 0–1.5 · knee ball ≈1.5 · thighs 1.54–2.34
pelvis + tucked hip cylinders 2.46–2.56 · abdomen connector 2.3–3.4
horizontal barrel chest at z 3.86 (axis along x, ±0.73, maxR 0.54)
shoulder spheres x ±0.8–1.0 at z 3.86 · collar ring + neck 4.1–4.4
head 4.36–5.34 (face pod 4.48–4.93) · legs at x ±0.4 · arms x ±0.62–1.48
```

The head is ~18% of total height — **toy proportion, keep it big**. Two
canonical late passes are part of the canon: the abdomen/lower-leg +20%
lengthening (proportion pass) and the **head tucked back** tilt (≈ −6.5°
around the collar) so the face pod's pointed bottom disappears into the
collar ring.

## 3. Form idioms (the moves that say "reploid")

- **Cylinder-cone appendages** (the key trait): limbs are single honest
  lathes — smooth cylinder forearms, tapered boot cones with rear volume,
  calf cylinders. Shape does the detail; surfaces stay smooth.
- **Sphere joints**: compact spherical shoulders seated in red enclosures,
  superposition knee ball — articulation shows as balls, like a doll.
- **Donut cuffs**: wrist and ankle transitions are torus beads, not seams.
- **Half-egg phi feet**: long, low half-egg feet, flush and rear-set, red
  over graphite soles.
- **Watermelon helmet + face window**: rounded helmet shell cut open at the
  face; cream face pod inside with eyes (vertical-ellipse irises), mouth
  slit repurposed from dark micro-detail, small blue gem + white support at
  the top-front.
- **Horizontal barrel chest**: the chest is ONE x-axis barrel lathe — not a
  yoke, not a box.
- **Superposition, softly**: parts interpenetrate (knee balls, hip
  cylinders, helmet volumes) but the read stays rounded-toy, never
  plated-armor.

## 4. Building reploid-N

Author on the manji-tree substrate (see [[mobile-suit]] §3 for the lathe
grammar): segment sheets in their own sketches, one named decision per
version, mirror one side, assemble last.

- **Hold fixed:** the Face role + two-eye construction, cylinder-cone
  honesty, sphere joints, big-head proportion, role placement, the barrel
  chest, half-egg feet.
- **Swap freely:** identity armor hue (the red family, wholesale), helmet
  crest / ear pods / gem shape, hands (glove ↔ buster ↔ tool), boot cone
  profile, chest emblem, trim placement.
- **Fork, don't restyle:** copy reploid-0's manifest, change one region per
  version, title as changelog (`reploid-1 v1 - teal armor buster arm`).
- **Skin seam:** the assembled unit takes the polygomer skin seam
  (`get_skin_packet` → paint → `skin_polygomer`) for decals and finish;
  single-view limitation applies (front/¾ strong, side/back weak).

## Do / don't

- DO build the face first — the protoform line spent most of its versions on
  head + face, and that is where the identity lives.
- DO keep every silhouette element nameable as cylinder / cone / sphere /
  egg — if a part needs a compound description, it has drifted.
- DON'T add greebles, panel lines, or color doodads — toy surfaces are
  smooth; color roles and shape contrast do all the work.
- DON'T close the face window into a visor (that drifts to [[g-series]]) or
  reduce the eyes to one lens (that is [[z-series]]).
- DON'T port to workbench + assembler casually — reploid is manji-tree
  native; a substrate port is a new fork, not a new unit.

Pairs with [[mobile-suit]] (the parent register and method — reploid is its
manji-tree-native language), [[g-series]] and [[z-series]] (sibling
languages; route by shell: face → reploid, box-chamfer hero → g, mono-eye
field → z), and [[mobile-worker]] when the concept is job-first instead of
character-first.
