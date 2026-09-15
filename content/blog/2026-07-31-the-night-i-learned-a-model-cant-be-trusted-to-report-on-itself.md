---
title: "The Night I Learned a Model Can't Be Trusted to Report on Itself"
date: 2026-07-31
category: Homelab
summary: "Validating agent harness isolation, comparing model self-reporting against mechanical hook logs, and deploying Bazarr subtitle sidecars."
---
I was about to be gone a week with no reliable remote access. Anything undecided by morning sits blocked for seven days. So from just after midnight to 05:45 I ground through the architectural backlog. Picked up threads from earlier, plus a five-hour quiet gap I had to reconcile against a parallel worker first.

Main job: Phase 0 validation for n5-board, my Kanban harness for agent workflows. Needed real proof for the operating assumptions before building on them — does shared token refresh break concurrent sessions, do API keys survive a day, does host sandboxing hold, does argv execution actually block injection, does the harness report models honestly, does project CLAUDE.md even load.

## The Sandbox Died Three Ways Before Breakfast

Network-fencing test ran in a background worker. Hit three host-level walls.

socat wasn't on the host. Installed it from userspace, hit the real wall: `kernel.apparmor_restrict_unprivileged_userns=1` killed the nested user namespace the seccomp helper needs — `apply-seccomp: write /proc/self/setgroups... Permission denied`. Tried again in a throwaway privileged container on the second node to isolate the allowlist mechanics — AppArmor denied the profile again, `write /proc/self/uid_map: Operation not permitted`. The agent correctly refused to go `unconfined`. Harness flagged that as an unsafe bypass. Good call.

At 03:47 I killed the userspace sandbox layer entirely. Host nftables for egress now. This also buried a nasty latent bug: the old sandbox reported `is_error:false` while its child commands failed silently. Fail-open, undetectable. Gone.

## Stop Asking the Model, Read the Logs

Three times tonight self-reporting lied and hooks told the truth.

CLAUDE.md loading: first I asked the model "are the instructions in context?" Evaluator scored that 3.6/5 — weak grounding, confabulation-prone. Obvious in hindsight. Replaced it with an exec hook logging file loads. Result: 13 `InstructionsLoaded` events by default, zero across three runs with `--setting-sources user`. Flag suppresses loading. Proven, no asking required.

Model resolution: subagent called with a retired model ID got HTTP 404, orchestrator silently retried on a live model. Task succeeded. But the system/init stream kept reporting the *requested* model name. Only `modelUsage` + persisted `message.model` showed who actually served it. Also learned fallback config doesn't cover explicitly pinned subagent models.

Context integrity via model self-hashing: non-deterministic garbage.

Rule from tonight: never ask the model about its own runtime state. Hooks, file markers, harness telemetry. That's it.

## The Soak That Ended Indeterminate

Token-refresh concurrency needed a standalone soak — three concurrent calls every 150s across the token's ~4.77h life — not agent workers competing for sessions. Round 13 of 130, one leg threw AUTH before the refresh window. Criteria demanded zero drops, so the run logged INDETERMINATE on quota limits. Refresh-under-load still unverified for production. Annoying, but honest.

Found a tmux session running since Tuesday with relaxed perms under an account holding root SSH to node two. Killed the session, disabled its supervisor in systemd. Lost the Discord `!start` path. Worth it.

## Bazarr, FUSE Handles, and User-Agent Strings

Morning: added Bazarr for English sidecars on media missing embedded tracks. Clean container backup first, then deploy after Sonarr on the same remote mount. First start: stale FUSE handle, `Socket not connected`. Container restart rebound it.

04:14 indexing said 67 wanted — looked like great embedded coverage via ffprobe. 04:42 reality: 836 of 13,375 releases processed (6.3%). The 67 was just an early slice of a running scan. By 05:43 coverage hit 14.1%, wanted climbed to 166 in one library, 120 in another. What looked like a Cloudflare provider block was a missing browser user-agent in Bazarr config — set the header, cleared backoff, done.

Left subtitle demuxing off: it would churn terabytes over the mount to make redundant sidecars. Remaining wanteds are provider score thresholds (61 vs 90 minimum), not missing indexers.

Theme of the night, both tracks: plans and self-reports diverge from the host. `nftables` rules, hook logs, socket states, live index counts — that's the signal. Everything else is a story. Left the lab unattended with that.
