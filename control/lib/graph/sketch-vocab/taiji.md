---
{ "id": "taiji", "name": "taiji ☯ — the chirality primitive (yin-yang, double helix)", "summary": "a handed coupling of two opposites that orbit a shared axis — the structural dual of the vajra; a yin-yang made volumetric, and a double helix expressed as a single relation", "when": "chiral / handed forms where the sense of rotation matters: a double helix or DNA-like twin strands, a twist with a definite left/right winding, two intertwined opposites that exchange (yin-yang, taijitu ☯), a coil or vine with handedness, or winding a handed circulation onto a vajra bond — anywhere the form's identity IS its chirality", "tier": "render-primitive", "marks": ["taiji"], "phase": "p1" }
---

For chiral, handed forms — where two opposites orbit a shared axis and the
*sense of winding* is the point — prefer `taiji` over hand-pairing two
helix wave-manji. A taiji IS a double helix as a single relation. It is the
rotation-symmetric dual of the mirror-symmetric `vajra`: a vajra says which
points are bonded; a taiji says which way the bond spins.

3D only. Authored as a top-level `taijis: [...]` array on the manji-tree
manifest, OR as an in-tree `{ kind: "taiji", id, ... }` leaf child of a
manji (which emits `self/slot/<id>-yin|-center|-yang` slots back onto the
enclosing manji, just like a vajra emits its beads).

## Shape

```
taijis: [{
  yin,            // pole A — endpoint path or {x,y,z}
  yang,           // pole B — endpoint path or {x,y,z}
  center?,        // hub / crossing; default = midpoint(yin, yang).
                  // off the yin–yang line bends the axis (quadratic Bézier)
  twist?,         // SIGNED turns yin→yang. sign = CHIRALITY. default 0.5
  radius?,        // lobe radius around the axis. default 1
  profile?,       // "spindle" (teardrop tips; default) | "capsule" (constant)
  crossSections?, // partition slices along the axis. default 24, min 2
  samples?,       // vertices per partition divider. default 48, min 8
  showEnvelope?,  // also emit the outer bounding rings. default false
  style?          // { partitionStroke, envelopeStroke, yinStroke, yangStroke, width, strandWidth }
}]
```

## The chirality is the signed twist

`twist` is the one knob that carries the form's identity. Every
cross-section perpendicular to the yin→yang axis is the taijitu glyph
rotated by `2π · twist · t`, so the dividing surface sweeps a **helicoid**
and the two glyph eyes sweep the two pole-**strands** (a double helix).

- `twist > 0` — right-handed about yin→yang.
- `twist < 0` — left-handed (the exact mirror).
- `twist = 0` — the **achiral degenerate**: a straight-extruded glyph, two
  parallel strands, no winding. The proof that the twist *is* the chirality.
- `|twist|` is the number of turns: `0.5` reads as a single S end-on, `1` is
  a full double-helix turn.

## What it expands into (wave-space face)

The taiji paints no world-space surface of its own — like the vajra, its
output lives in wave-space and a later skin/drape pass can consume it
(chirality is invisible in the rotationally-symmetric envelope; it lives in
the partition and strands):

- A silver **partition helicoid** — the stack of rotating taijitu dividers.
- Two **pole-strands**, two-toned (yin teal, yang gold) — the double helix.
- An optional outer **envelope** ring stack when `showEnvelope: true`.

## When to reach for it

- A **double helix / DNA strand**, a chiral coil, a handed vine or horn.
- A **yin-yang** that needs to be a volume, not a flat glyph.
- Giving a **vajra bond a handedness**: bind `yin`/`center`/`yang` to a
  vajra's `<id>-proximal`/`<id>-center`/`<id>-distal` slots so the static
  bond gains a handed circulation around the same axis.
- NOT for a mirror-symmetric bond among points — that is the `vajra`.
- NOT for a single climbing coil with no partner strand — that is the
  `helix` wave-manji archetype. The taiji is specifically the *coupled,
  handed pair*.
