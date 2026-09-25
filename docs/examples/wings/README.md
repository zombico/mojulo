# Wings: one grammar from membrane to feather

Every flying vertebrate wing is the same forelimb chain with a different fan at its end. This example builds both
patterns with one species-free wing op and installs them on two creatures.

| Pattern | Chain | What fans | Surface | Trailing edge |
| --- | --- | --- | --- | --- |
| Bat / dragon | humerus → forearm | digits II–V from the wrist, a clawed thumb, and a body ray down the flank | ONE membrane, anchored along the arm and at the wrist | deep scallops: few rays, big sag |
| Bird / vulture | humerus → ulna → hand | tertials, 16 secondaries, 10 primaries (the outer ones emarginated into slots), coverts in rows | SEPARATE vanes, shingled | fine serration; slots at the tip |

A pterosaur (one enormous digit IV) is the same data with one ray.

## The wing as a waveform

The trailing edge between neighbouring ray tips is a waveform: `edge(σ) = envelope · (1 − a · |sin(π N σ)|^γ)`. A
membrane AUTHORS it (its sag between rays); vanes make it EMERGE (rounded, narrowing tips). `waveform.svg` plots the
measured edges of both and the analytic family between them.

## Rules

1. The wing op names no animal; the dragon and the vulture differ only in data and where they install it.
2. Everything rides a bone: a vane is rigid on its anchor bone; a membrane point's weights are the interpolation
   weights of the two rays it lies between.
3. Folding is one dial: elbow and wrist angles interpolate between spread and folded, ray angles compress with them,
   and the wing plane rolls against the body.
4. Installation by address: the dragon's wing root is on the torso's back behind the shoulder blades (a second girdle);
   the vulture's wing IS its forelimb.
5. Both sides of a surface are named groups: the membrane has a thickness profile (thick at the root, cushioned along
   the bones), a dark back, a lighter underside with veins, and a rim; vanes have upper and under faces, alternating
   related tones (seeded, so rows never read as stripes) and pale covert tips (the griffon's wing bar).

The vulture is a ring plan (body, neck chain, head, legs, toes) expanded by the core, with a beak, eyes, a neck ruff
(the head's tile op), talons and a tail fan of vanes.

## Checks

`test-wings.mjs`: closure spread, half and folded; determinism; bone lengths kept under the fold; membrane weights sum
to 1; every vane on one bone; the membrane's measured edge has one scallop per gap.

Not certified: the folded membrane passes through itself; the wings are not bound to the rig and have no flap clip.

## Reproduce

```sh
node --test docs/examples/wings/test-wings.mjs
node docs/examples/wings/wings.mjs   # wings.png, waveform.svg, planform.svg, stats.json in the spike tree
```
