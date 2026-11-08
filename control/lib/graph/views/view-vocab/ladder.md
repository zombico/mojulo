---
{
  "id": "ladder",
  "name": "A ladder of scales (one page, from a thing down to its atoms)",
  "family": "science",
  "entry": "create_view",
  "summary": "Several science worlds on one page, top down, each rung at its own scale and saying what it is: simulated (a classical, microscopic, quantum or relativistic model, run and checked), depicted (drawn at true proportions from sourced numbers and held to them) or explained (a cited sentence, where nothing can be drawn honestly). Each rung sits in its own case, magnified and saying by how much; a breadcrumb across the top steps from one to the next, and a lower rung's measurements can feed the rung above.",
  "when": "Reach for this when the question crosses scales: 'what is a steel ball made of, all the way down', 'zoom from the ball to its atoms', 'show why the gel sets: the protein, then the jar', 'how big is a nucleus next to its atom', 'from a dropped brick down to its crystals'. One scale alone is its own kind (classical, microscopic, quantum, relativistic)."
}
---

A ladder is one recipe and one page: **rungs listed top down**, each at its own scale. Every rung says what it is, and
the page never lets one pass for another:

- **simulated**: a science world's model, run by its solver and checked by its gates, exactly as its own kind would
  (`get_view_vocab({ id: 'classical' })` and its siblings for the models);
- **depicted**: drawn at true proportions from sourced numbers, and held to them by a gate (`ladder-depicted`);
- **explained**: a cited sentence where nothing can be drawn honestly. Its `source` names a work and its year.

What is too far out of scale to show in the rung above is a rung of its own: each rung is magnified to its own case,
the panel says by how much, and the breadcrumb says each rung's size and its step from the one above (10⁻⁵ of the
grains). Nothing is approximated silently.

## The recipe

```
params: {
  rungs: [
    { id, label?, simulated: { kind: 'classical' | 'microscopic' | 'quantum' | 'relativistic', model, dress? } },
    { id, label?, depicted: { figure: 'cell', matter } },          a cubic metal's crystal cell (steel, aluminium, lead)
    { id, label?, explained: { text, source, size? } },            source names a work and its year; size is a length
    { below: { rung, body } },                                     a body's matter, down: its grains, cell, atom, nucleus
  ],
  open?: '<rung id>',                                              the rung the page opens on (default the first)
}
```

- List the rungs **top down**: the `ladder-ordered` gate advises when a rung is no smaller than the one above it.
- `below: { rung: '<a simulated classical rung>', body: '<its body with a matter>' }` expands into that body's matter
  ladder from the matter table: each rung simulated, depicted or explained as it honestly can be, ending on the nucleus,
  or on a rung saying nothing further down is sourced yet.
- **A lower rung can feed the one above.** A classical rung's `gelling` law may read
  `from: { rung: '<a microscopic rung below it>', observe: 'aggregated' }` with its `relations`: the liquid's yield and
  viscosity follow the share that rung assembles (data flows up; a rung above cannot be read).
- A rung whose picture is a shader over the whole page (a light world, a quantum plane, an orbital volume, a field
  volume) cannot stand in a case.

## What the page shows

The rungs stand side by side, each in a case tinted by what it is (green simulated, blue depicted, violet explained;
an explained rung's case is empty, beside its sentence). The breadcrumb across the top names every rung; a click moves
the camera there and shows its caption: what it is, its size, its step, and its source. The first simulated rung's
readout shows while that rung is looked at. The panel (**What's real · what's drawn**) lists the ladder, every simulated
rung's model and every check, each rung's id before its checks (`drop/energy-never-gained`).

## Gates

Every simulated rung's own; `ladder-depicted` for a drawn cell; `ladder-cited` (every explained rung names a work and
its year; a rung derived from the one above it counts as cited by it, and one that says nothing is sourced shows as a
gap); `ladder-ordered`; and, where a rung reads another, `handoff-held`. Say which ran and what they saw; nobody has
looked at the page yet.

## Worked examples

A steel ball dropped on concrete, then what it is made of, down to an iron nucleus:

```
{
 "rungs": [
  {
   "id": "drop",
   "label": "A steel ball dropped",
   "simulated": {
    "kind": "classical",
    "model": {
     "bodies": [
      {
       "id": "ball",
       "matter": "steel",
       "radius": "5 cm",
       "at": [
        0,
        0,
        1
       ]
      }
     ],
     "laws": [
      {
       "law": "gravity-uniform"
      },
      {
       "law": "plane",
       "matter": "concrete"
      }
     ],
     "duration": 1.5
    }
   }
  },
  {
   "below": {
    "rung": "drop",
    "body": "ball"
   }
  }
 ]
}
```

A glass bead in water while a protein assembles in it: the microscopic rung's assembled share sets the water's yield, the
bead is held once the gel carries it, and the helix that holds a fibril together is a cited sentence:

```
{
 "rungs": [
  {
   "id": "jar",
   "label": "A bead in setting water",
   "simulated": {
    "kind": "classical",
    "model": {
     "bodies": [
      {
       "id": "bead",
       "matter": "glass",
       "radius": "50 µm",
       "at": [
        0,
        0,
        0
       ]
      }
     ],
     "laws": [
      {
       "law": "gravity-uniform"
      },
      {
       "law": "buoyancy",
       "medium": "water",
       "surface": 1
      },
      {
       "law": "gelling",
       "medium": "water",
       "from": {
        "rung": "protein",
        "observe": "aggregated"
       },
       "relations": [
        {
         "relation": "percolation",
         "top": "20 Pa",
         "onset": 0.2
        },
        {
         "relation": "krieger-dougherty",
         "phi": 0.3
        }
       ]
      }
     ],
     "duration": 30
    }
   }
  },
  {
   "id": "protein",
   "label": "The protein assembling",
   "simulated": {
    "kind": "microscopic",
    "model": {
     "box": {
      "size": [
       "1 µm",
       "1 µm",
       "1 µm"
      ]
     },
     "represents": 20,
     "species": [
      {
       "id": "protein",
       "radius": "2 nm",
       "count": 30
      }
     ],
     "laws": [
      {
       "law": "brownian"
      },
      {
       "law": "aggregation",
       "of": "protein",
       "nucleus": 2,
       "nucleate": 2000,
       "grow": "2e6 /M/s"
      }
     ],
     "duration": "30 s"
    }
   }
  },
  {
   "id": "helix",
   "label": "Why a fibril holds",
   "explained": {
    "text": "A collagen molecule is three chains wound into a triple helix about 1.5 nm wide and 4.4 D long; in a fibril neighbours sit offset by D, about 67 nm, which gives the fibril its banding of gaps and overlaps.",
    "source": "Petruska & Hodge, PNAS 1964",
    "size": "1.5 nm"
   }
  }
 ]
}
```
