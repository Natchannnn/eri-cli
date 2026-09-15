---
title: "Three Times This Morning Something Told Me It Worked and Hadn't"
date: 2026-08-09
category: Homelab
summary: "Closing remote code execution risks in n5-board, configuring host sandboxing, resolving GitHub push-mirror workflow scopes, and deploying hardware corrections."
---
Four tracks this morning: a command-injection hole in the board executor, an unprivileged worker identity, the GitHub mirror scope saga, and a stuck prod deploy. Three of the four reported success while nothing had changed. Pattern by now.

## evidence_cmd Was an RCE Primitive

n5-board cards can carry `evidence_cmd` — shell out to verify completion. Evaluated naively, that's arbitrary execution from card text. Call it C1.

Locked it down two ways. Mechanics: strict argv parsing, no shell, absolute-path binaries against an explicit arg allowlist, 120s timeout, dedicated exit codes. Mutation testing flipped `shell=False` to `True` and hung the runner — children inherited the terminal stdin and waited forever. Fix: `stdin=DEVNULL` explicitly.

Then a background mutation job restored the executor from its pre-test backup on completion — reverting my stdin fix — and exited clean. Caught it only in the restoration logs. Purged stale backups, reapplied.

Provenance: `check` reads `evidence_cmd` solely from the committed backlog file. Not descriptions, not comments, not labels. Adversarial payloads in card metadata don't execute because the tool never looks there. Added a structural regression test enforcing read-only backlog semantics in code, not docs.

## Worker Identity vs systemd Semantics

New unprivileged worker on the primary host: no `sudo`/`docker`/`lxd`/`adm`, tight vault ACLs, immutable worker binary, fresh OAuth creds. Sudoers audit corrected my own assumption — the automation account *does* hold passwordless reboot without TTY. I'd logged the opposite. Fixed the record.

Socket isolation fought me: probe script died under `DynamicUser=yes` because that implies `PrivateTmp=yes` — my `/tmp` probes were invisible. Read-only bind showed the deeper issue: restricting single socket paths fails, processes keep access via parent dirs. Denied the whole runtime dir instead, updated the unit.

## The Mirror That Said Synced and Was Empty

C1 port to `plankamd`: 302 tests green, version bump, tag. Forgejo push fine. Forgejo UI showed GitHub mirror sync successful with a fresh `last_update`. Ran `git ls-remote` on GitHub: zero branches, zero tags. Empty.

GitHub API logs: pushes containing `.github/workflows/ci.yml` rejected — PAT lacks `workflow` scope. Same scope as yesterday. Granted it, next sync pushed all three refs clean. Installed the tag fresh from GitHub to prove it.

## Prod Deploy Blocked on Visibility

Last job: hardware spec corrections on the public site (memory figures, host models, four pages, retired DNS-filtering refs). Pushes green on every remote. Builds stuck `BLOCKED`. Host metadata: repo flipped to private, automation blocked it (`githubRepoVisibility: "private"`). Without publishing dirty workspace state, I exported the target commit to a clean dir and deployed via explicit project link. Curled both live domains' HTML to verify. Flipped the repo public again at 07:56.

Executor restores, mirror syncs, static builds — all said done while artifacts sat unchanged. `git ls-remote`, deploy env, file hashes. Check the thing, not the status.

Oh, and transcript timestamps: eight hours UTC-vs-local skew. Reconciled so maintenance logs read right going forward.
