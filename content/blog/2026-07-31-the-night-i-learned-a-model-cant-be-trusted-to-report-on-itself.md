---
title: "Testing Agent Harness Assumptions and Model Self-Reporting Boundaries"
date: 2026-07-31
category: Homelab
summary: "Validating agent harness isolation, comparing model self-reporting against mechanical hook logs, and deploying Bazarr subtitle sidecars."
---
I was about to be away for a week with no reliable way to reach the lab remotely. Anything left undecided by morning would sit blocked for seven days, so between just after midnight and quarter to six I worked through the backlog of architectural questions. The session picked up threads from earlier and resumed after a roughly five-hour quiet gap, where the first task was reconciling work already completed in a parallel worker.

The primary objective was Phase 0 validation—a battery of verification checks for n5-board, the Kanban board harness intended for automated agent workflows. Before proceeding with development, I needed empirical proof for key operating assumptions: verifying whether shared token background refresh interferes with concurrent sessions, testing API key longevity a day after generation, verifying host-level network sandboxing, confirming argv-based execution blocks shell injection, checking harness model resolution reporting, and validating project CLAUDE.md context loading.

## Sandbox isolation and kernel restrictions

The network-fencing test—executed by a parallel background worker—attempted to validate the sandbox and encountered three separate host-level blockers.

First, socat was missing from the host. Supplying it from userspace uncovered the underlying constraint: kernel.apparmor_restrict_unprivileged_userns=1 restricted the nested user namespace required by the sandbox seccomp helper, returning apply-seccomp: write /proc/self/setgroups... Permission denied. A second attempt inside a throwaway privileged container on the second node, intended to isolate allowlist mechanics with namespace restrictions removed, encountered apply-seccomp: write /proc/self/uid_map: Operation not permitted due to an AppArmor profile denial. The agent correctly avoided loosening the container profile to unconfined because harness classification flagged it as an unsafe bypass.

At 03:47 I made the decision to deprecate the user-space sandbox layer and rely on host nftables rules for egress control. This change resolved a latent issue where a failing sandbox previously reported is_error:false while child commands failed silently, leaving workers in an undetectable fail-open state.

## Model self-reporting vs. mechanical logging

During harness validation, relying on model self-reporting produced unverifiable or conflicting claims when contrasted with deterministic runtime telemetry.

The first instance involved CLAUDE.md context loading. An initial verification round asked the model to self-report whether instructions were present in context—an approach prone to confabulation, scored by the evaluator at 3.6/5 for weak empirical grounding. The second round replaced self-reporting with an execution hook logging file loads directly. With deterministic event logging, 13 InstructionsLoaded events appeared under default settings, while zero events occurred across three runs with --setting-sources user, confirming the flag suppressed context loading without relying on model assertions.

The second instance occurred during model resolution testing. A subagent invoked with a retired model identifier received an HTTP 404, prompting the orchestrator to retry silently on an active model. The task completed successfully, yet the system/init stream event continued reporting the requested model identifier rather than the active executing model. Inspecting modelUsage and persisted message.model records provided the only accurate confirmation of which model served the request. The test also clarified that fallback configuration did not apply to subagents with explicitly pinned models.

A third check attempted to verify context integrity via model self-hashing, which proved non-deterministic. Across all three checks, the operational takeaway was clear: avoid asking language models to self-report context or runtime status, and rely on external hooks, file markers, and harness-level telemetry.

## Background token-refresh soak

Testing token-refresh safety under concurrent loads required a standalone background soak rather than dispatching agent workers, avoiding artificial competition for session resources. The harness initiated three concurrent calls every 150 seconds across the token's estimated 4.77-hour lifespan.

At round 13 of 130, one of the three concurrent calls encountered an AUTH failure prior to the scheduled refresh window. Because the test criteria required zero auth drops across the full duration, the test terminated early and logged INDETERMINATE due to quota limits, leaving concurrent refresh characteristics unverified under production conditions.

## Stale process and session discovery

Inspecting the host environment revealed a tmux session that had run continuously since Tuesday with relaxed permission checks, under an account with root SSH privileges to the second node. The session and its supervisor were stopped and disabled at the systemd level to eliminate uncontrolled background execution, trading off the Discord !start control path for stricter access control.

## Subtitle sidecar indexing and provider limits

Later in the morning, Bazarr was added to the media stack to retrieve English subtitle sidecars for media ingested without embedded text tracks. Deployment followed the existing remote filesystem mount after Sonarr, following a clean container backup. An initial stale FUSE handle returned "Socket not connected", resolved by restarting the container to rebind the mount.

Initial indexing at 04:14 reported 67 wanted items, which appeared to show high coverage from embedded tracks checked via ffprobe. However, checking runtime progress at 04:42 showed that only 836 of 13,375 releases (6.3%) had been processed; the wanted count had simply captured an early slice of an ongoing scan. By 05:43, scan coverage reached 14.1%, and wanted items climbed to 166 in one library and 120 in another as previously unscanned media were cataloged. Additionally, an apparent Cloudflare block on a provider proved to be a missing browser user-agent string in Bazarr's configuration, which was resolved by supplying the header and clearing the rate-limit backoff.

Evaluating embedded subtitle extraction showed that enabling subtitle demuxing across the library would force multi-terabyte processing over the network mount to produce redundant sidecars, so the setting remained disabled. The remaining wanted items were primarily constrained by provider matching score thresholds (e.g., candidate scores of 61 vs. a 90 minimum requirement) rather than missing indexer entries.

Across both the harness validation suite and the subtitle indexing pass, written plans and self-reported agent statuses repeatedly diverged from actual system state. Verifying against the running host—checking nftables rules, monitoring real log hooks, inspecting socket states, and inspecting live index progress—provided the only reliable signal before leaving the infrastructure unattended.
