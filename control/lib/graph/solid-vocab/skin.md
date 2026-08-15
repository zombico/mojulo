---
{
  "id": "skin",
  "name": "Skin (paint a polygomer)",
  "family": "edit",
  "entry": "edit_solid",
  "summary": "Make a manji-tree / workbench / assembler polygomer or a figure WEAR a painted skin — a two-phase handshake (packet then apply) that binds a painted PNG as a deterministic screen-space skin.",
  "when": "Reach for this on 'paint / skin / texture this model, make it wear a finished look, give it a painted skin'."
}
---

Make a manji-tree, workbench, or assembler polygomer — or a figure — WEAR a painted skin: the deterministic approximation of a diffusion render. This is an EDIT over an already-minted solid, and it runs as a TWO-PHASE handshake. Phase one pulls a packet: the FILLED control scaffold to paint over plus a one-line paint brief — the whole procedure carried as DATA so the driving agent needs no memorized rules. You then paint a finished subject over that scaffold with your image generator, keeping its silhouette and massing. Phase two hands the painted PNG back to be applied. Because the skin was painted over the scaffold from a fixed camera, it is already registered to the render in screen space — every filled face samples the skin at its screen centroid, so there is no UV unwrap — yielding a DETERMINISTIC render that wears the skin's colours, snapshotted append-only into the outcome folder. The recipe stays sovereign and remains the deliverable; the skin is a bound render with provenance. Single-view (front-facing); full wrap-around is the turntable multi-view bake, not this op.

Skinnable kinds are `manji-tree`, `workbench`, `assembler`, and `figure`; any other kind is refused. Reach for this on 'paint / skin / texture this model, make it wear a finished look, give it a painted skin'.

## Spec shape

The target model is named by the top-level `ref`; the op params go in `spec`. `spec.phase` selects which half of the handshake runs.

```
{
  ref,                 // top-level — the sketch ref of the model to skin (`sk_…`)
  spec: {
    phase,             // 'packet' — pull the scaffold + brief; 'apply' — bind the painted PNG
    image_path,        // phase 'apply': absolute path to the painted PNG on this host
    image_base64       // phase 'apply': base64 PNG bytes (fallback for a remote worker)
  }
}
```

### Phase 'packet' — pull the scaffold + brief

Returns the handoff needed to paint the model, all as data:

- `scaffold.url` — the FILLED control render to paint directly OVER, matching its silhouette, proportions, and part layout. It is the lit solid silhouette (`?control=1`), NOT the wireframe — a wireframe fragments a diffusion skin into many objects.
- `scaffold.note` — restates that you paint over the filled silhouette, not the wireframe.
- `brief` — the one-line paint instruction: paint ONE coherent subject that keeps the scaffold's silhouette and massing, with no wireframe / ring / dot / diagram language and no text.
- `submit` / `then` — pointers naming the apply phase and the downstream export.
- `alreadySkinned` (present only when a skin is already bound) — its slot number and the current skin URL.

### Phase 'apply' — bind the painted PNG

Hand the painted PNG back. Provide EXACTLY ONE of:

- `image_path` — absolute path to the painted skin PNG on this host (painted over the `?control=1` scaffold).
- `image_base64` — base64-encoded PNG bytes (the fallback for remote workers).

The bytes must be a real PNG (the painted render over the scaffold, not the SVG). Faces whose centroid misses the subject take the mean skin colour instead of a stray background pixel (this kills pale-edge dots). Returns `{ ok, ref, n, faces, url, path, bytes }` — `url` is `/api/sketches/<ref>/skin.png`, the model wearing the skin deterministically. The INPUT painted PNG is retained too, so the turnable `/world` + `.glb` model can bake the same skin into its 3D vertex colours.

## Worked example

Skin a minted manji-tree polygomer in two calls — pull the packet, paint, then apply. Both calls carry `ref: 'sk_frostwyrm'` at the top level; only `spec` changes between phases.

```
// Phase 1 — pull the scaffold + brief
spec: { phase: 'packet' }
// → { scaffold: { url: '/api/sketches/sk_frostwyrm/png?control=1&inline=1&scale=2', note },
//     brief: 'Paint a finished "frost wyrm" over the scaffold: ONE coherent subject…', submit, then }

// …paint a finished frost wyrm OVER scaffold.url with your image generator,
//    keeping its silhouette + massing, and save it to a PNG on this host…

// Phase 2 — bind the painted PNG
spec: { phase: 'apply', image_path: '/abs/path/to/frostwyrm-skin.png' }
// → { ok: true, ref: 'sk_frostwyrm', n, faces, url: '/api/sketches/sk_frostwyrm/skin.png', path, bytes }
```

For a `figure`, the applied skin URL is the figure wearing the skin deterministically (albedo × its own form shading); baking that painted skin into the figure's GLB is a follow-up. For a `manji-tree` / `workbench` / `assembler`, the export path bakes the skin straight into the model's vertex colours, and the live turntable at `/api/sketches/<ref>/world` shows it turning.
