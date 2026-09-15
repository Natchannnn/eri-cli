---
title: "Everything Redundant Turned Out to Share Something"
date: 2026-08-11
category: Homelab
summary: "I moved VM 200 and proved a restore from the new backup server. The dependency audit then found how much of the cluster still shared one failure path."
---
Three big jobs today: move VM 200 between nodes, stand up Proxmox Backup Server with proven restores, and audit every shared dependency my "redundant" systems quietly share.

## Shrinking VM 200 to Move It

VM 200 shrunk in place 00:23–00:41, 18 minutes planned downtime. `sda` to 150G, root 136G, swap live, 30 containers restarted, systemd clean. pve02 local storage 38.41% → 26.57%.

That made migration cheap: `qm migrate 200 pve03 --online --with-local-disks` moved 150 GiB instead of 477, 16m27s, zero disruption. Uptime counter never broke (25 min post-transfer), Immich 200s throughout. pve02 fell to 1.98%, pve03 settled 25.56%.

Catch: pve03 did the whole transfer on its 1GbE standby. The 2.5G primary (`enx74****5c7c`) sat uninitialized in the bond — zero link errors, just never enslaved. Throughput held ~110 MB/s, i.e. gigabit line rate. Fixed the bond later today.

## PBS Is Real Now

Proxmox Backup Server as VM 144 on pve02 (PBS 4.2.5-1, `x.x.0.44`), registered cluster-wide as `pbs-n5hq`. Datastore is a 1 TiB thick iSCSI LUN off the NAS SSD pool — deliberately not the HDD pool, which ate unrecoverable btrfs metadata corruption on Aug 9 after lost writes in an unclean shutdown.

Dedup works: third backup of CT140 moved 32 bytes of 647.413 MiB in 0.98s. First nightly scheduled 01:00 Aug 12.

Kept the old routines running in parallel — `n5-backup.sh` plus the 02:30 vzdump-to-CIFS. That 02:30 run was the first true cluster-wide vzdump across all three nodes, finally snapshotting guests that never had automation (portal, stirling-pdf, forgejo on pve02, VM 200 on pve03).

Restore drills, all three passed:
1. `pct restore` CT140 → VMID 199.
2. `qmrestore` VM 200 → VMID 299: 49 GB archive → 161 GB (44.3% sparse), 13 min, booted.
3. PBS CT140 restore: 4.8s at 135 MiB/s.

One honesty note: CT140 restore "verified" on file count (16,875) without live-checksum rigor. Future drills get stricter — count parity isn't integrity.

## NFS Async: 17× Faster, 30 Seconds of Nerves

Shared storage via NFS off the NAS SSD pool, mounted all three nodes as `nas-vm`, `--content images` (no container rootfs). Chose NFS over iSCSI+LVM because LVM thin snapshots break my `pct rollback 133` flow.

Async vs sync: sequential 95.3 → 227 MB/s, 4k fsync 849 kB/s → 14.4 MB/s (17×, latency 4.8ms → 0.28ms). Price: ~30s window, ~1.5 GB volatile cache, on ungraceful NAS death. Took the tradeoff. Node disk benches consistent: 13.2 / 14.0 / 13.0 MB/s. VM 200 stays on local NVMe — Postgres, Prometheus, Loki don't get network fsync latency. Non-negotiable.

## The Audit: My Redundancy Shares Everything

Read-only passes over live state (pve-manager 9.2.10, 3/3 quorum, zero NVMe errors, no HA yet):

- `kuma1` + `kuma2` are separate instances alerting to the same Discord webhook. Webhook dies, both go quiet.
- Fallback guests sit on pve01 next to primaries. Host dies, both die.
- PBS datastore lives on the NAS it's supposed to hedge against.
- PBS encryption key: both copies in the physical lab. Fire takes both.

Also caught a live regression mid-migration: after the 00:24:59 reboot, four retired origin containers auto-started next to their pve02 replacements, dual-running until I killed them 05:12–05:47. stirling-pdf's H2 diverged (73,728 vs 106,496 bytes). Stopped the originals, noted the divergence.

## Drift Detection + Monitor Audit

Docs now regenerate from reality: `gen-cluster-state.sh` hourly rebuilds `~/docs/cluster-state.md` from Proxmox CLI, `docs-drift-check.sh` daily 06:30, `drift-checks.sh` asserts 14 facts against live infra (already caught wrong VM placements + stale HTTP codes in my own docs).

63 monitors audited (48 kuma1, 15 kuma2), ugly findings:
- backup monitors at `maxretries=1` sit PENDING on first failure — two straight days of dead backups before anyone's paged.
- WAN/gateway alerts fire into the void when the path is down — no local queue, no retry.
- 13 monitors accept 401/403 as "up."
- Kuma's `updateMonitorNotification()` deletes before re-inserting with no transaction — error mid-update loses notifications silently.

SSD wear footnote: pve01 NVMe's 130 unsafe shutdowns and pve02 SSD's 755 power losses / 5.06 years are lifetime counters from previous owners, not my power. Verified under-five ungraceful events on my watch. Still need a UPS — just not for the reason the SMART page implies at first glance.

Migration live, PBS proven, restores timed. The coupling list is now backlog, prioritized, with verified capability separated from pending resilience. That's the honest state.
