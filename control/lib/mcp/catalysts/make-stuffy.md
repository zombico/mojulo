---
{
  "id": "make-stuffy",
  "name": "Make a stuffy — a cute character, furred in Blender",
  "summary": "Shape a plush body with create_character (a chibi doll, a bear, an invented plushie: big head, stubby limbs, a simple face), look at it, then hand it to Blender for fur: the operator's Blender MCP when one is connected, mojulo's own blender-bake --fur when not. The recipe never changes; the fur comes back as stills, a turntable and a .blend.",
  "valueHook": "A cuddly toy you can see and keep working on: the body is an editable recipe you revise by word, and the fur is a real Blender pile rendered from three angles, with the .blend handed over for the next pass.",
  "version": 1,
  "category": "object-design",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "intent", "prompt": "The stuffy in words (e.g. 'a little boy doll in a blue jumper', 'a honey teddy bear', 'a round green dragon plushie')." },
    { "name": "fur", "prompt": "The pile: short velvet (0.012), plush (0.02, default) or shaggy (0.04), as a fraction of the toy's size.", "default": "0.02" }
  ],
  "mcpTools": { "mojulo": ["create_character", "update_sketch", "get_solid_vocab", "export_model", "meta_context_declare_inventory"] },
  "outputContract": { "summary": "A character ref whose recipe reads as plush, and its fur finish under `data/outcomes/<ref>/fur/`: front, three-quarter and back stills, an optional turntable.gif, the .blend, and fur.json recording the source, the parameters and the worker.", "fields": ["ref", "stills", "turntable", "blend", "fur"] }
}
---

# Make a stuffy — a cute character, furred in Blender

A Workflows loop that reaches past mojulo: mojulo makes the body, Blender makes the fur. The two never mix. The
body stays a recipe you can revise, print smooth or put in a game; the fur is a finish rendered on top of it, the
way a Cycles render is. glTF cannot carry hair strands, so fur never travels in an export: the outputs are pictures
and a `.blend`.

## 1. Shape the body (create_character)

A stuffy is a silhouette first: a big head, a short soft body, stubby limbs, a simple face. Pick the door that
already has the shape:

- **A doll** (a person): `create_character({ as: 'hero', spec: { cast: 'chibi', register: 'round', head: 'anime', headScale: 1.5, palette: { … } } })`.
  `chibi` gives the short body, `round` the soft rings, the anime head the simple cute face, `headScale` the plush
  head. Name the palette in toy colours (`Skin`, `Top`, `Bottom`, `Shoes`, `Hair`): the fur takes each group's
  colour, so the palette IS the fabric.
- **An animal** (a teddy bear, a bunny): `create_character({ as: 'animal', spec: { species: 'grizzly' } })`, then
  soften it in place with `update_sketch` on `/plan/...` and `/dials/<name>` (shorter legs, a rounder head). The
  roster is `get_solid_vocab({ id: 'animals' })`.
- **An invented plushie** (a round dragon, a blob monster): `create_character({ as: 'creature', spec: { plan } })`
  with a ring plan of fat spheres and short segments; the manual is `get_solid_vocab({ id: 'layered' })`.

Look before you fur: open the result's World page with the operator. Fix the SHAPE here, by word, in place
(`update_sketch`); fur hides detail but never a wrong silhouette. Never re-mint to change it.

## 2. Find the Blender road

- **The operator's Blender MCP, first.** If the host has a Blender MCP connected (its tools are in your session;
  record them with `meta_context_declare_inventory` when the operator wants mojulo to know), use it: it runs in
  the operator's own Blender, so the result lands in their scene. Export the body with
  `export_model({ ref, format: 'glb' })`, import that file in Blender through the MCP, and grow the fur with the
  same recipe mojulo's script uses (below): particle hair on every mesh except the eyes, mouth and nose, a
  matte-sheen material in each part's palette colour, a soft three-light rig.
- **mojulo's own script, otherwise.** With a local Blender (or `MOJULO_BLENDER` naming one):
  `mojulo script blender-bake --ref <ref> --fur` (from a checkout: `node scripts/blender-bake.mjs --ref <ref> --fur`).
  It exports the body itself, one node per palette group, and grows the fur only on the furred groups.
- **No Blender at all:** stop at step 1 and say so. The body is the deliverable; the fur waits for a Blender.
  Absence degrades the loop, never breaks it.

## 3. The fur knobs

| knob | default | what it does |
|---|---|---|
| `--fur-length` | `0.02` | strand length as a fraction of the toy's size: `0.012` velvet, `0.04` shaggy |
| `--fur-density` | `9000` | guide strands per size² of furred surface |
| `--fur-short Skin` | none | a felt nap (a third of the length) on those groups: a doll's face and hands |
| `--fur-skip A,B` | eyes, mouth, nose, claws, horns | groups left smooth (replaces the default list) |
| `--fur-clump` / `--fur-fuzz` | `0.15` / `0.012` | tufting and waviness |
| `--views name:az,…` | front, three-quarter, back | angles around the toy (az 0 = its front) |
| `--turntable 24` | off | 24 frames around it, joined into `turntable.gif` |
| `--blend` | off | save the furred scene as `stuffy.blend` to keep working in |
| `--exposure=-0.7` | `-0.7` | the plush rig's exposure; raise it for dark fabric |

A doll reads best with `--fur-short Skin` (a felt face) and the default pile on its clothes; an animal with the
default pile all over.

## 4. The machine gate, then the eyes gate

The script's result line and `fur.json` are the machine gate: they name every still, the `.blend`, the parameters
and the source export's hash, and Blender's `MOJ_FUR` log line lists what grew (no eye or mouth group should be on
it). That measures that fur exists; it cannot say the toy is cute.

The eyes gate is the operator's: show the stills (and the turntable). Ask whether it reads as plush and what to
change. Shape notes go back to step 1 (`update_sketch`), fur notes to step 3. Never claim the eyes gate passed.

## Pitfalls

- A realistic face under fur reads as a furry person, not a toy. Use the anime head or a felt nap (`--fur-short Skin`).
- A light palette clips under the plush rig; lower `--exposure`. A dark one goes muddy; raise it.
- Two palette groups that share a colour share a fate: the colour goes to the furred one.
- The fur is not in the `.glb`, the game export or the print. Say so when the operator asks for a furry game
  character: the game keeps the smooth body; the fur is for pictures and for the next pass in Blender.
