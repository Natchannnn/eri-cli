---
title: "Monitoring Relocation, Linux Memory Pressure Analysis, and Hypervisor Maintenance"
date: 2026-08-22
category: Homelab
summary: "Migrating Prometheus and Grafana onto a dedicated VM, diagnosing Linux memory page cache metrics, resolving static IP collisions, and patching hypervisor hosts."
---
Homelab engineering on August 22 encompassed four distinct operational tasks: migrating monitoring services off the main container host, analyzing Linux memory pressure metrics, resolving network address collisions during an n8n migration, and patching cluster hypervisors.

## Moving monitoring services to a dedicated VM

The primary host previously ran approximately 30 containers, including nine dedicated to monitoring. To decouple telemetry collectors from the workload host they supervise, the monitoring stack was migrated to a dedicated virtual machine on the secondary hypervisor node (2 vCPUs, 4 GB RAM, 48 GB local storage, static IP `x.x.0.36`).

Container versus native packaging was evaluated during architecture review. The proposal to install native Debian packages was rejected after inspecting upstream package repositories:
- The production Prometheus deployment was running 3.14.0, whereas Debian bookworm shipped 2.53 (a significant downgrade against a 2.6 GB TSDB).
- Grafana 13 was not packaged in the distribution repository.
- The Debian package named `loki` was an unrelated pedigree analysis tool rather than Grafana Loki.

Consequently, Docker inside a dedicated VM was selected. Root-owned data volumes were migrated by tarring them through a container helper with access permissions:
- Prometheus TSDB: 2.6 GB
- Grafana: SQLite and dashboard state
- Loki: 22,139 log chunk archives

Pre-cutover review identified two critical configuration blockers:
1. The rollback strategy risked container name and port collisions on the old host.
2. `cAdvisor` was bound to `127.0.0.1`, which would have halted metric collection the moment scrapers moved off-host.

The cutover concluded in 4 minutes 52 seconds (against a 30-minute maintenance window). All 49 scrape targets came up healthy, with 171,880 historical telemetry samples preserved. Two uptime monitors initially failed because Prometheus and the UniFi poller were bound to localhost in Compose; exposing them on the VM LAN interface restored health checks. The public Cloudflare Tunnel route was verified by inspecting incoming requests directly in Grafana's local access log.

## Analyzing Linux memory pressure metrics

An initial rationale for aggressive service migration was that the primary host consistently operated above 98% memory utilization on 16 GB of RAM. A telemetry audit across Linux kernel counters disproved active memory exhaustion:
- Active committed memory was 5.0 GiB of 15.05 GiB total.
- Kernel PSI (Pressure Stall Information) metrics reported `some avg10=0.00` with only 171 milliseconds of cumulative stall time since host boot.
- Anonymous memory utilization across 28 containers totaled ~3.3 GiB.
- The system had logged zero kernel out-of-memory container kills.

The 98% metric was an artifact of calculating `(Total - Free)` without accounting for reclaimable page cache and buffer memory (~10 GiB), which the Linux kernel reallocates instantaneously upon process demand. Grafana dashboards correctly computed active memory usage at 33.6%. The host felt tighter because it had transitioned on August 10 from bare metal with 30.6 GiB RAM to a VM with 15.05 GiB. While memory exhaustion was ruled out, container isolation remains a priority since 27 of 28 containers lacked hard cgroup memory limits.

## Resolving static IP collisions during n8n migration

Migrating n8n to an isolated container at `x.x.0.37` encountered repeated network timeouts during dependency installation. MTU black-holing on the bridge was disproven via 1500-byte ICMP probes; the issue was transient upstream latency, resolved by pulling the pre-built Docker image in 49 seconds.

During cutover, pre-flight checks inside the container returned HTTP 200 via loopback curl, but external clients could not connect. Running `arp-scan` detected duplicate ARP responses (`DUP: 2`) on `.37`, revealing an unmanaged legacy hardware device sharing the static IP without an active DHCP lease in the UniFi controller. Shifting n8n to `.38` resolved the collision, completing cutover in 41 seconds with four active workflows verified via live webhook triggers.

## Hypervisor security patching and boot flags

Cluster maintenance continued with upgrading Proxmox hypervisor nodes (23 pending packages each).
- Node 2 upgraded cleanly with ~40 seconds of downtime across seven guest services.
- Node 3 required approximately 100 seconds, taking down secondary workloads cleanly.
- Alerting remained operational during hypervisor maintenance because `kuma2` and the secondary Cloudflare Tunnel connector were located on an alternate physical node.

A review of hypervisor guest definitions caught an omitted configuration: the newly provisioned monitoring VM lacked the `onboot: 1` flag, which would have prevented automated recovery after a power outage. Host metrics were extended to all three hypervisor nodes, pinning metric queries per host to avoid multi-host aggregation errors and updating scrape configurations in place to avoid Docker inode detachment. Targets expanded from 49 to 52 endpoints.

## Post-migration storage cleanup

Data volumes on the legacy host were decommissioned following verification via `gzip -t` on archive backups. Pruning stale Docker images recovered 9.10 GB of physical storage (contrasting with Docker's 19.03 GB reclaimable estimate), reducing host disk utilization from 65% to 43% (~28 GB recovered). The nightly backup script was updated to replace legacy monitoring directory paths with active agent directories.

## Container update pipeline audit

Auditing container image currency revealed that out of 14 cluster guests, only three were covered by automated update pipelines. Furthermore, the two oldest container images in the environment (373 and 240 days old) were inside the update pipeline: upstream maintainers had relocated images to new registry namespaces while leaving legacy tags static, causing digest comparisons to report current status indefinitely.

## Raspberry Pi hardware inspection

Reconnaissance on a newly discovered network endpoint (`x.x.0.90`) identified a Raspberry Pi 5 (16 GB RAM, Debian 13, kernel 6.12.75) booted from a 238 GB micro-SD card. Evaluating the device for local DNS filtering concluded that running standard SQLite query logging (flushed every 60 seconds) would rapidly exhaust flash endurance without a UPS. Planning shifted to memory-backed logging (`tmpfs`) before provisioning software.

## Seedbox quota and library storage accounting

Auditing media library storage clarified two measurement discrepancies:
- The seedbox storage pool is 22 TB, not 26 TB; `df` reported the shared hosting volume rather than account-specific quotas.
- An apparent 396 GiB of orphaned media directories was traced to a path parsing error: directory strings with trailing slashes caused basename extraction to return empty strings, misidentifying 11 active series as orphans. Matching against media IDs reduced genuine uncataloged files to a single 4.7 GiB entry.

## Credential containment

During automated dispatcher testing, a worker script transferred a private SSH key into local transcript logs. While the key's authorized ingress was strictly pinned to a forced command and local LAN source, 18,695 workspace files were swept to confirm complete removal of plaintext key material, and key rotation was scheduled.

Across the day's migrations and updates, operational metrics required careful isolation: distinguishing buffer cache from true memory pressure, separating mount filesystem space from slot quotas, and validating ARP tables with active network scans. The monitoring stack relocation reduced blast radius on the primary host, hypervisor maintenance concluded cleanly with 52 scrape targets active, and credential hygiene sweeps cleared private key leaks from local transcripts.
