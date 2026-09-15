---
title: "A Repo Containing the CLI but Not the Deployment Is Half of It"
date: 2026-08-07
category: Homelab
summary: "Deploying the Planka-backed n5-board system, separating CLI code from infrastructure units, auditing false-positive leak alarms, and scoping a public client package."
---
Back on n5-board after a week away. Nightly automations ran clean the whole time, so I had a stable floor to promote it from scripts to real infra.

## Two Checks Left From the Spike

API key longevity: its timer container had been stopped, so I'd never run it. Started it, ran the suite by hand — 33 mixed API calls, zero auth failures, eight days after generation. Planka stays. No fallback needed.

Token-refresh soak: 66 calls over six and a half hours to Discord + vault, never caught a natural refresh before quota died. Still indeterminate. I'm not assuming resilience; it stays on the unverified list.

## Prod Board

Backend went into an unprivileged container on node two — Ubuntu 26.04, Planka 2.1.1, Postgres. Fixed an upstream image tag omission in my own plan (embarrassing), bound the listener to the container's private IP only. DOCKER-USER allowlist: two host IPs, nothing else.

CLI lives at `~/n5-board/` in its own Python 3.14.4 venv, pip bootstrapped via get-pip.py for non-root. Verified meanly: 125 test cards across six lists, dry-run diffs with zero drift, full wipe-and-regen reproducing an identical board hash, doctor checks all green.

Monitoring: three Kuma HTTP probes across both nodes. Learned to verify probe attachments against the SQLite rows directly — failed API registrations look attached in the UI when they aren't. Cloudflare exposure stays parked until I review it by hand.

## The Leak Alarm That Wasn't

Security check halted, screaming API key leak in the vault runsheet. Looked myself: the check pipes grep into head, which exits 0 whether or not anything matched. Runsheet held an eight-char non-sensitive prefix. Check bug, not a leak.

## The Review That Saved the Repo

Split the project into its Forgejo repo. Two review passes before committing, both earned their keep.

Review one: my plan tracked CLI source but forgot every deployment manifest — Compose files, systemd units, DB backup scripts, hypervisor firewall rules. CLI without its deployment is unrepeatable. Unified both into the repo.

Review two caught: doc-sync drift detector stamping dynamic UTC timestamps into headers every run (false diffs on untouched files), and the credential pre-scan allowlist firing on substrings (`_PAT` inside plain English nouns, `TOKEN` inside variable names).

Fixed both pre-init. Private repo: 44 files, 228 KB, zero real leaks. GitHub mirror deferred — my PAT can't create remote repos.

Remote access over Tailscale just worked, by the way. Gateway SNATs tailnet traffic to its LAN address, landing clients inside the allowlist automatically. Restricted rules intact, no manual creds shuffle.

Evening: started scoping the public client (`plankamd`) for third-party use. Boundaries so far: Forgejo can't do anonymous clones (site-wide auth), so public lives on GitHub. Backlog parser is coupled to brittle heading parsing — slight format drift drops items silently. Tried abstracting branding off lab paths, hit a wall: CLI parses args before loading config, needs a two-phase parser for dynamic subcommands.

Closed with the isolated public build initialized at 23:34:01, clean boundary from the live private repo. Renames and parser refactors pending.
