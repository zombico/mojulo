---
name: mojulo
description: Create, edit, export and resume Mojulo 3D objects, worlds and games in ChatGPT through connected Mojulo tools or a shell-enabled Work box. Use for Mojulo requests and procedural 3D recipe workflows; not for generic image generation or unrelated coding.
---

# Mojulo in ChatGPT

Use Mojulo as the recipe engine; ChatGPT authors and revises the recipe.

## Pick the available path

- **Mojulo MCP tools are connected:** call `forward_context`, then `get_adapter`
  with `id: 'chatgpt'` if available. Follow the routing index and relevant vocabulary.
  Use the existing server and recipe refs. A server without the ChatGPT card can
  still run Mojulo: use these instructions for handoff rather than install a second
  copy merely to obtain a card. Do not execute the shell bootstrap on this path.
- **No connected Mojulo, but a shell-enabled Work box exists:** read
  [the Work-box workflow](references/work-box.md). Its runner pins the package and
  sets host and storage paths on every call; it does not depend on shell state.
- **Neither is available:** explain the missing execution capability. This package
  cannot create a box or guarantee that switching modes provisions one.

## Make and refine

Use the routing index and `help`/tool schemas rather than memorizing tool lists.
Mint once; edit the same ref with `update_sketch` or `edit_solid`. Inspect a rendered
preview when the runtime supports it and distinguish automated checks from the
operator's visual approval. Use native image tools only if present and if their
output can actually reach Mojulo's binding tools.

## Deliver and resume

Deliver the requested export plus its editable recipe and exact Mojulo version.
A Work-box file goes through that session's supported file/attachment mechanism.
An MCP-server file needs an authorized transfer or a reachable download URL supplied
by the deployment. A relative `/outcomes` URL, loopback URL or arbitrary disk path
is not a ChatGPT download. Do not invent sandbox URLs or claim an HTML attachment
renders inline. Use direct model/zip downloads where supported; Muse's HTML courier
is not a requirement here.

For Work-box recovery, the runner can checkpoint an exported manifest and restore it
through `create_sketch`; see the reference for limits and version/build verification.
For an existing persistent MCP recipe, retrieve and edit that recipe in place using
the connected tools. Keep external assets and referenced recipes with the recipe
when needed. Do not reconstruct missing data from conversation memory and call it
an exact restoration.
