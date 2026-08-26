# Sessions

Per-person working notes. Each person gets a folder with two files:

| File | Purpose |
|---|---|
| `NEXT-SESSION.md` | Where to pick up. Rewritten at the end of each session; only ever describes what's next, not what happened. |
| `HISTORY.md` | Append-only log of what changed each session, at a high level. Newest entry at the top. |

## Why per-person

These are working notes, not shared source of truth. Two people working in parallel will have different next steps and different context, and merging that into one file produces something neither person trusts. Decisions and designs belong in `spec/` and `documents/` — those are shared and authoritative. These files are just "what was I doing."

## Conventions

- **History entries stay high level.** One line per meaningful change, linking to the spec or doc that holds the detail. If an entry needs a paragraph to explain, that paragraph belongs in a spec and the entry should link to it.
- **Record decisions and their reasoning where they belong**, not here — `documents/HLDs/` for design decisions, `documents/POC-baseline/known-issues.md` for tracked gaps. History says *that* something was decided and where to read about it.
- **Starting fresh:** copy this structure into `sessions/<yourname>/`.
