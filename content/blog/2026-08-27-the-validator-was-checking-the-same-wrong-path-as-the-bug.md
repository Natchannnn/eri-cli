---
title: "The Validator Was Checking the Same Wrong Path as the Bug"
date: 2026-08-27
category: Homelab
summary: "A misplaced YAML key disabled the model gateway's spend cap. The validator passed because it looked up the same wrong path as the runtime code."
---
My model proxy was running with no spend cap and telling me everything was fine. `max_budget` sat as a sibling of `parameters` instead of nested under it. Parser wanted `parameters.max_budget`, found nothing, initialized unconstrained — no syntax error, no startup warning. Silent unlimited spend.

My validator missed it too. It checked for `max_budget` at the same wrong sibling path. Same bug in both files, both agreeing with each other. Fixed the config (nested under `parameters`), fixed the validator to assert the enforced schema path, queried the live API — $20 and $10 tiers present in runtime config. Whether rejection actually fires at the boundary is still untested. Not pretending otherwise.

## Killed My Own Admin UI

Hardening pass: restricted public `/docs` and `/schema`. Used the broad disable flag first — which also killed the management interface showing keys, spend, cache rates. The thing I need to watch the thing I just changed.

Redid it granular: docs + schema 404, admin UI 200. Attack surface down, visibility intact.

## The Vault Went Away for Two Hours

External secret service died for two hours during boot testing. Proxy startup pulls provider keys from the vault at boot — vault unreachable, container can't start. That's the trade I made moving secrets out of host files: less exposure, hard runtime coupling to an external network.

Mitigation going in: encrypted local secret store as offline fallback for boot. Central vault stays primary. Booting doesn't depend on someone else's uptime anymore.

## CLAUDE.md Surgery

Root instructions hit ~11,000 words. Splitting into a hot tier (fast load, routine sessions) and cold tier (reference). Nearly introduced lies doing it — paraphrasing status lines turned live production services into "untested" in my summaries. New rule: status markers and project states move verbatim. Never paraphrased.

Also corrupted a container image with `qm reboot` mid-layer-commit on the proxy VM. Ungraceful reboot + Docker writing layers = rebuild from clean. Procedure now: `docker compose down` before any VM reboot. Filesystems unmount, layers settle, then reboot.
