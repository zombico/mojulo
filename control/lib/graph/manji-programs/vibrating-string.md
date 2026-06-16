---
{
  "id": "vibrating-string",
  "label": "Vibrating string (oscillating line)",
  "family": "line-oscillating",
  "aliases": ["string", "vibrating line", "oscillation", "wave line", "signal trace", "frequency", "harmonic", "sine wave"],
  "intents": ["line", "oscillation", "two-point-narrative", "signal-or-frequency"],
  "topology": {
    "primitive": "connection",
    "shape": "multi-cycle-sine",
    "sag-direction": "perpendicular"
  },
  "reasoningUse": [
    "a multi-cycle sine wave between two named points — vibrating string, signal trace, harmonic line",
    "the wave oscillates perpendicular to gravity so the wave shape reads regardless of endpoint orientation",
    "use when the line itself signals frequency, oscillation, or harmonic content; for static links use 'taut-wire'"
  ],
  "boundaryContract": {
    "slots": ["start", "end"],
    "displacement": "perpendicular-to-gravity"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "connection",
        "from": "self/slot/start",
        "to": "self/slot/end",
        "wavelengths": 4,
        "relativeSag": 0.06,
        "plane": { "x": 0, "y": 0, "z": 1 },
        "samples": 96,
        "style": { "stroke": "#2a4488", "width": 1.0 }
      }
    ]
  }
}
---

# Vibrating string (oscillating line)

A 4-cycle sine wave between two named points, oscillating
perpendicular to gravity. The amplitude is 6% of the span so the wave
stays compact and reads as oscillation rather than as a flopping
rope. Plane override (`{0,0,1}`) means the wave bulges along world-Z
regardless of segment direction — a horizontal string visibly waves
up and down, a slanted one waves in the same vertical plane.

## Use when

Reach for `vibrating-string` when the line itself carries frequency
or oscillation meaning. Specific intents:

- **Music diagrams** — a string between two anchors, a guitar tone
  visualization, a tuning-fork stem.
- **Signal traces** — an oscillograph track between two scope probes,
  a sine signal between input/output, a clock waveform.
- **Energy / wave indicators** — diagrammatic wave between two energy
  sources, harmonic resonance between two coupled systems.

When the line is static (rope, wire, beam) use `taut-wire` or
`slack-rope`. For non-sinusoidal waveforms (square, sawtooth)
compose multiple connections or wait for a terminal-vocabulary
extension.

## Slot contract

Two slot names on the host: `start` and `end`. Use `pathBindings`
to alias if the host's natural slot names differ.

## Composition example

A string between two posts with the perpendicular wave showing
oscillation:

```json
{
  "tree": {
    "id": "monochord",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "slots": [
      { "id": "post-L", "position": { "x": -8, "y": -8, "z": 2 } },
      { "id": "post-R", "position": { "x":  8, "y": -8, "z": 2 } },
      { "id": "fill",   "position": { "x":  0, "y":  0, "z": 0 } }
    ],
    "children": [
      { "slot": "fill", "node": { "programRef": "vibrating-string",
        "pathBindings": { "self/slot/start": "monochord/slot/post-L", "self/slot/end": "monochord/slot/post-R" } } }
    ]
  }
}
```

## Provenance and influences

The 4-cycle default is a compromise — high enough that the wave
reads as oscillating (not as a single arc), low enough that even a
short segment doesn't look like noise. Tuning-fork visualizations
often use 5-8 cycles; signal traces use whatever the actual
frequency demands. For specific frequency targets author
`wavelengths` inline.

## Stays bespoke when

- The signal is **non-sinusoidal** (square wave, sawtooth, pulse
  train). The substrate's wave is pure sin; non-sinusoidal shapes
  need different math.
- The amplitude must **decay** along the length (damped oscillation).
  Currently the wave amplitude is constant; decay is a future
  sampler extension.
- The wave needs to **carry a label** (frequency value, amplitude
  tag). Connection leaves are pure geometry; annotations belong
  to a separate text-mark family.
