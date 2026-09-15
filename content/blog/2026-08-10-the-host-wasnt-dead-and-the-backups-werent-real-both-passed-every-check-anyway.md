---
title: "The Host Wasn't Dead and the Backups Weren't Real, Both Passed Every Check Anyway"
date: 2026-08-10
category: Homelab
summary: "Expanding the Proxmox cluster to three nodes, diagnosing an e1000e transmit hang on pve02, and fixing a vzdump monitoring hook that reported false positives."
---
`pve03` joined as node 3 — `pvecm add x.x.0.20 --use_ssh 1 --link0 x.x.0.25`. Quorum now 2-of-3, 3 expected votes. Every guest stayed up through the join, no migrations needed. Network bond mirrors `pve01` (2.5G USB primary, onboard 1GbE failover), config backed up to `/root/interfaces.bak-2026-08-10` first. Same pass removed an unauthenticated enterprise apt repo that was locking updates.

Retired `n5ubuntu` from voting. Three real nodes now.

## The Crash That Was a NIC Nap

11:29 `pve02` vanished off LAN, VM 200 (n5ubuntu) with it. Corosync on `pve01`: link 0 dead 11:29:18, token lost :19, node gone :24. Looks exactly like a dead host.

It wasn't. Kernel logs show the box alive — the onboard Intel `e1000e` hit a transmit-unit hang. Host up, NIC asleep.

Plugged a spare 2.5G USB NIC into `pve02`, bonded active-backup, failover test with zero loss, whitelisted the new MAC in UniFi, cleared a transient IP conflict from the onboard interface. Moving on.

## The Backup Hook That Never Failed (Because It Never Checked)

`vzdump-kuma-hook` had reported success on every backup since 2026-07-28. Including the failed ones. It pushed to Kuma on `job-end` — which fires whether the job lived or died. `job-abort` never fires in this Proxmox release's hook sequence. So failures looked green for two weeks.

Rewrote the hook to parse exit status directly, deployed to all three nodes with per-node push tokens, `maxretries: 0` so retries can't mask first-attempt failures. Validated with real backups and deliberate failures. Also unpinned `ugnas01-backup` from single-node to cluster-wide so every node writes direct.

## Moving Off n5ubuntu

Migrating services ahead of decommissioning it. Main Claude workspace moved to an unprivileged Debian 13 LXC (`n5claude`, CT 109, `x.x.0.9`) on `pve01`. Five consumers repointed (`n5-update-judge.sh`, `n5-doc-stack.sh`, internal proxies). Cred exposure + perms issues found in the move logged to `runsheets/BACKLOG-n5claude-followups.md`.

Tailscale subnet router (`1.102.2` at `x.x.27.67`) moved to `pve01`. VM 200 memory gate formalized: host ≥ 23 GiB, 16 GiB allocation verified under load. No new hardware needed.
