---
title: "The Reboot That Fixed It Once Before and Didn't the Second Time"
date: 2026-09-05
category: Homelab
summary: "Diagnosing a NAS btrfs pool failure, evacuating dependent Proxmox guests and containers to node-local storage under HA, and validating restore integrity."
---
Four services died looking like four separate faults. One root cause: a NAS storage pool went read-only, taking a home automation VM, a container, a backup datastore, and a backup target with it. Fix was diagnose the pool, evacuate everything off it under HA, land it all on node-local storage.

I assumed metadata damage first. Pool logged parent transid verify failed plus 150 corruption errors — smells like metadata. Scrub said otherwise: metadata clean, real damage 8 uncorrectable checksum errors in two archived video files. No rescue mount, no `--repair` — array has no redundancy to repair against anyway. Both drives SMART-passed, so not a dying disk either.

Firmware reboot brought the pool writable. Didn't trust it: the same reboot "fixed" this pool once before, and it went read-only again three days later.

Evacuation had to go through HA — plain `qm stop` / `pct stop` gets reverted by the manager restarting the guest. Every stop was `ha-manager set --state disabled` first. Home automation VM + model-proxy VM restored from backup to node-local, each verified before renumbering back: HTTP 200, data mount read-write, service bridge listening, both monitors up inside 45 seconds. Restore caught a stale config too — proxy VM running 12,288 MB against a config file claiming 8,192 (live-applied, never saved). Kept the true value.

Container side was a journal abort, not a dead disk — `pct fsck` clean (exit 0), move to local, original volume kept as forensic copy. All four workflows confirmed in logs, not just marked active.

Every backup off that datastore got `zstd -t` before use. Backups pulled through a degraded filesystem can finish green with rotten source.

One self-inflicted wound: early manual copy off the dying pool ran under `sudo -i`, which dropped my destination variable mid-command and dumped the copy onto the NAS root overlay — 100%, hung. Reran it properly, worked.

Everything that lived on that pool is node-local now. Pool's writable again. Watching it, not calling it fixed.
