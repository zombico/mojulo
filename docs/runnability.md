# Runnability: how heavy a World page is in Chrome

Mojulo ships its World pages for Chrome. Runnability is how much a page asks of Chrome, in two gates that are never
conflated ([bicycles.md](bicycles.md)).

## Machine gate: the counts (automated, any machine)

`control/scripts/runnability.mjs` opens a page in headless Chrome, hooks WebGL2 and counts:

| Measure | What it predicts |
|---|---|
| triangles per frame, every pass (shadows, the AO prepass, the main pass) | the GPU's vertex load |
| draw calls per frame | the CPU's cost to submit a frame |
| shader programs linked | compile stalls the first time a view shows them |
| texture bytes (an upper bound: a render target counts four bytes a texel) and buffer bytes | GPU memory |
| JS heap after load | the tab's memory |
| page size | download and parse |
| time to first frame | startup (only comparable between runs on one machine) |

```bash
cd control
node scripts/runnability.mjs <page.html> --cams cams.json            # per camera, through the capture bridge
node scripts/runnability.mjs <page.html> --cams cams.json --view pov # the form grass's camera mode first
node scripts/runnability.mjs <page.html> --json                      # one JSON line, for a log or a diff
```

The counts are exact on any machine, a container with software GL included; the times are not, so a container's times
are compared only with its own. Report the worst camera's triangles and draws, with the held memory, when asked how
heavy a page is, and the same counts before and after a change when a change is meant to make one lighter. The form
grass's camera modes (`POV_GRASS` in `scene/channels/form-grass.js`) are the reason `--view` exists: gameplay's POV and a
cutscene's aerial view draw different amounts of grass.

## Hardware gate: frame time on a real GPU (the operator's Chrome)

What the counts cost in milliseconds depends on the GPU, so only a run on real hardware says whether a page holds 60 fps.
That is the operator's to run and to report; never claim it from the counts. The counts become a budget once frame times
from two or three machines say where they break.
