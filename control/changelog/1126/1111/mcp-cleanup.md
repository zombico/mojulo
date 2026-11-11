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
- **Eight leftover tools are deleted.** These were already off the list since the office wing left in 3.1.0, and
  nothing pointed at them: the five daemon tools (`list_daemons`, `status_daemon`, `start_daemon`, `stop_daemon`,
  `restart_daemon`), `list_runners`, `get_deliberation_overview` and `meta_context_analyze`, with the drift audit
  behind the last one. Unlike the retirements above, these are gone: a compiled plan or a script that names one now
  gets "unknown tool". The daemon host itself and the trigger tools that use it are untouched. `update_game_project`
  was on the same shortlist and stays, because it is the only way to change a stored game project's status. Deleting
  the overview also removed sixteen pointers to unreachable tools that the dead-pointer guard had been carrying.
