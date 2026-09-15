---
title: "The Check Meant to Avoid Touching a Secret Printed It Anyway"
date: 2026-08-25
category: Homelab
summary: "Eliminating plaintext credential fallbacks, isolating shell parameter expansion leaks during interactive debugging, and aligning UTC-local log timelines during appliance reboots."
---
`echo "${TOKEN:-UNSET}"` looks like a safe existence check. It isn't. If the variable is set, that expansion prints the live value to stdout. I ran it during interactive debugging to confirm a token existed — and pasted the live credential straight into the transcript log.

Revoked it at the provider immediately (401s confirmed), provisioned a replacement out-of-band. Then did the exact same thing to a second service's identifiers with the same pattern. Revoked and rotated those too.

Banned the idiom everywhere. Presence checks now use:

```bash
if [ -n "${TOKEN+x}" ]; then echo "Set"; else echo "Unset"; fi
```

`${VAR+x}` asserts defined-ness without expanding contents. Nothing to leak. Updated every runbook and script that used the old form.

## Plaintext Cleanup Across Three Hosts

Legacy cred files had to go. Swept all three cluster hosts, grepping system-wide for live references before deleting anything:

- Host 1: 17 orphaned files → 2.
- Host 2: 19 → 1.
- Host 3: 3 → 0.

Two stragglers only turned up in full-filesystem sweeps: one env file sourced in a shell profile ahead of the non-interactive guards (leaking into batch tasks), one config preserved through an uncatalogued dir move outside my search roots. Both sanitized into the vault now.

## The Eight-Hour Ghost

Backup storage errors wouldn't correlate with appliance instability until I noticed the clocks: backup host logs UTC, appliance logs local (UTC+8). Shifted eight hours, every storage timeout lands exactly on an ungraceful appliance reboot. Neighbors on adjacent hardware: zero power events. Appliance-only problem, not facility power.

Rotated a webhook cred sitting in legacy archives in place — kept all 19 service bindings alive instead of recreating them. Passed secrets over stdin pipes, never CLI args, so nothing lands in `ps aux`.

And before container maintenance, paused Kuma probes via the API pause endpoint instead of config edits. Kuma has that un-transacted delete-then-reinsert bug on interrupted edits — one hiccup mid-edit wipes notification bindings. Probes inspected after: bindings intact.
