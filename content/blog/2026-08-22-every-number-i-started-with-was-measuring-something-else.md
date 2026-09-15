---
title: "Every Number I Started With Was Measuring Something Else"
date: 2026-08-22
category: Homelab
summary: "Migrating Prometheus and Grafana onto a dedicated VM, diagnosing Linux memory page cache metrics, resolving static IP collisions, and patching hypervisor hosts."
---
Four jobs today: move monitoring off the main host, figure out why the host claims 98% RAM, migrate n8n without hitting a ghost, patch both hypervisors. Every starting number I had was wrong in an interesting way.

## Monitoring Gets Its Own VM

Primary host ran ~30 containers, nine of them monitoring the host itself. Moved the stack to a dedicated VM on node two (2 vCPU, 4 GB, 48 GB disk, `x.x.0.36`).

Considered native Debian packages. Nope: prod Prometheus is 3.14.0, bookworm ships 2.53 (downgrade against a 2.6 GB TSDB); Grafana 13 isn't packaged; Debian's `loki` is a pedigree-analysis tool, not Grafana Loki. Docker-in-VM it is.

Migrated root-owned volumes via container-helper tarballs: Prometheus 2.6 GB, Grafana SQLite + dashboards, Loki's 22,139 chunks. Pre-cutover caught two killers: rollback plan would've collided container names + ports on the old host, and `cAdvisor` bound to `127.0.0.1` would've gone dark the second scrapers moved off-host.

Cutover: 4m52s of a 30-min window. All 49 scrape targets green, 171,880 historical samples intact. Two Kuma monitors failed — Prometheus + UniFi poller bound localhost in Compose, exposed them on the VM LAN face, green. Tunnel route proven by watching hits in Grafana's own access log.

## The Host Was Never Out of RAM

Migration rationale #1 was "host sits at 98% of 16 GB." Audit says otherwise: committed active 5.0 of 15.05 GiB, PSI `some avg10=0.00` with 171ms total stall since boot, anon across 28 containers ~3.3 GiB, zero OOM kills. Ever.

98% was `(Total − Free)` ignoring ~10 GiB reclaimable page cache the kernel hands back instantly. Grafana's own math said 33.6% active. It *felt* tight because on Aug 10 the host went from bare metal with 30.6 GiB to a 15.05 GiB VM. Real issue stands though: 27 of 28 containers have no cgroup memory cap. Isolation still matters, just not for the reason on the dashboard.

## n8n Hit a Ghost IP

n8n to an isolated container at `x.x.0.37`: dep installs timing out. 1500-byte ICMP killed the MTU-blackhole theory — upstream latency, pulled the prebuilt image in 49s instead.

Cutover: loopback curl 200 inside, dead from outside. `arp-scan` showed `DUP: 2` on .37 — some unmanaged legacy box squatting the IP with no DHCP lease in UniFi. Moved n8n to .38. 41s cutover, four workflows proven on live webhooks.

## Patching + the Missing onboot

Both hypervisors: 23 packages each. Node 2 clean, ~40s, seven guests blipped. Node 3 ~100s, secondaries down cleanly. Alerting survived because `kuma2` + spare tunnel connector live on the other physical box. That's the redundancy actually working for once.

Caught the new monitoring VM missing `onboot: 1` — first power cut would've left it dark. Fixed. Extended host metrics to all three nodes with per-host-pinned queries (no multi-host aggregation mush), updated scrape configs in place to dodge Docker inode detachment. 49 → 52 targets.

Cleanup: `gzip -t` verified archives, then decommissioned legacy volumes. Docker's "19.03 GB reclaimable" yielded real 9.10 GB, host 65% → 43% (~28 GB freed). Nightly backup script repointed off legacy monitoring paths.

Update-pipeline audit: 3 of 14 guests covered by automation. The two oldest images (373 + 240 days) *were* in the pipeline — upstream moved registries, left legacy tags frozen, digest checks report "current" forever. Trust but verify, I guess.

New endpoint at `x.x.0.90`: Pi 5, 16 GB, Debian 13, kernel 6.12.75, booting off a 238 GB micro-SD. Eyed it for DNS filtering — SQLite logging every 60s would chew flash with no UPS. Plan is tmpfs-backed logging before anything gets installed.

Seedbox accounting: pool is 22 TB, not 26 — `df` showed the shared host volume, not my quota. And 396 GiB of "orphans" was my parser: trailing slashes emptied basename extraction, flagging 11 live series as orphaned. Matched on media IDs — one genuine 4.7 GB uncatalogued file.

Also swept 18,695 workspace files after a dispatcher test printed a private SSH key into transcripts. Key was forced-command + LAN-pinned, blast radius small, rotation scheduled anyway. Confirmed clean.

Buffer cache isn't pressure, `df` isn't quota, digest-equal isn't current, localhost isn't reachable. Day's theme, really. 52 targets green, host breathing room restored, creds clean.
