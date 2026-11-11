### The tool list, trimmed: the research book and the stash links

Ten tools leave the list your agent reads, and nothing you have made stops working. Built on this branch:

- **The research book is retired for the stash.** Starting a research book, binding items into it, reading and listing
  books, sketching one and synthesizing an abstract were the gathering tools from before the stash, and their own
  guidance already said to prefer the stash: it checks every item's type as it comes in, and it is the only thing a
  cook reads. The seven tools are no longer listed or routed to. They stay callable by name, so a book you already
  have, a compiled plan that names one and a delegate key granted the research pack keep working, and the Research
  page still shows your books. To gather now: `mint_stash`, `gather`, then `cook`.
- **The stash links are retired.** Linking a stash to a plan or a cook, unlinking it and listing the links wrote rows
  that no build, cook or page ever read, so an agent could spend calls on them for nothing. The three tools are no
  longer listed and stay callable by name; a cook names its stashes in its own `slices`.
- **Variations no longer need a research book.** `run_experiment_sweep` moves beside the plan tools (plans and sweeps),
  and its mechanics experiment (`base`, `param`, `values`) now puts the runs and the plot of the outcome in one folder
  and answers the table of outcomes, with no book to start first. Passing the `research_ref` of a book you already have
  still binds the runs into it as before.
- **The numerical experiment notebook keeps its notebook in a stash.** The catalyst poses the question, sweeps, gathers
  each run by its ref, and cooks the finding. One thing is given up: synthesizing an abstract with `review: true` used
  to re-check every bound experiment against its stored copy automatically. The notebook now holds a pointer to each
  run instead of a copy, so there is no copy to drift, and the catalyst has the agent re-read each cited run with
  `get_exhibit({ ref })` before it writes the finding. That re-read is a step the agent takes, not a check the server
  runs.
- **A shorter list.** The flat tool list goes from 212,165 to 199,558 bytes (ten tools fewer) and the packs list to
  31,771 bytes; both pins are lowered. The research and link code, their tables and the Research page are
  untouched.
- **Machina's manual moves to a card.** `verify_machina` (can this mechanism move this load within these limits?) had
  the longest description on the list for a tool few sessions call. Its description now says what it is for and when
  to reach for it, and the full manual (every machine and its parameters, the units, the limits, what comes back, a
  worked example) is the `machina` card, read with `get_solid_vocab({ id: 'machina' })` and found by
  `semantic_search` from a question like "how many pulleys do I need". The tool takes the same recipe and gives the
  same verdict; a malformed recipe is sent to the card. The flat tool list drops again, to 195,837 bytes.
- **Three small reads fold onto the tool they served.** The list of host adapters is `get_adapter({ list: true })`, the
  author's guide for writing a catalyst is `mint_catalyst({ guide: true })`, and a world's theme packs are
  `get_view_vocab({ themes: true })` (or a family: `themes: 'scifi'`). The old names (`list_adapters`,
  `custom_catalyst`, `list_world_themes`) are off the list and still answer by name with the same result.
- **The tools that record your other MCPs say less.** Declaring which MCP servers you have, and recording and reading
  what one of them can do, keep working exactly as before and stay on the list, because a catalyst that reaches
  Blender or another MCP is matched through them. Their descriptions and argument notes are cut to what an agent needs
  to pick the call; the shape of a capability body is taught by the `research-mcp-vendor` catalyst, as it was.
- **The always-listed orientation tools say less.** The glossary and refusal legend, the dashboard map, the worked
  examples, the update check and the tool-call ledger are listed for every host in both list modes, so their wording is
  paid on every connect. Their descriptions and argument notes are cut to what an agent needs to pick the call; each
  returns what it did. The packs-mode list, the default for most hosts, drops from 31,771 to 29,805 bytes.
- **A delegate key keeps its reach.** With the roles pack on, a key is granted packs by name. A tool that folds or
  retires moves to another pack, so a key granted its old pack would have been refused the old name; it now still runs
  it. Nothing changes for a key that was never granted that pack.
- **The plan tools say less, and the inbox is one read.** `get_plan` with no `plan_ref` lists your plans (by
  `status`, nothing marked read), so `list_plans` is off the list and still answers by name. Forging, revising,
  sketching, compiling and executing a plan work as before; their descriptions and argument notes are cut to what an
  agent needs to pick the call.
