---
title: "Proxmox Secondary Node Provisioning, Network Bonding, and Security Audit"
date: 2026-07-28
category: Homelab
summary: "Provisioning a second Proxmox node with active-backup network bonding, migrating Home Assistant to a dedicated HAOS VM, and conducting a security audit that identified an unauthenticated webhook endpoint."
---
An extensive infrastructure expansion focused on eliminating single points of failure across my homelab. The work encompassed provisioning a Dell OptiPlex 3070 Micro as a secondary Proxmox VE hypervisor, establishing active-backup network interface bonding, migrating Home Assistant from a container to a dedicated Home Assistant OS (HAOS) virtual machine, and performing a rigorous security and network configuration audit.

## Node provisioning and active-backup interface bonding

To distribute core workloads away from the primary server—which previously concentrated thirty-two containerized services and home automation on a single physical host—I deployed a Dell OptiPlex 3070 Micro (Intel Core i5-9500T, 16 GB RAM, 256 GB NVMe) running Proxmox VE 9.2.5 at static IP `x.x.0.20`.

During initial network initialization, the Proxmox bridge interface `vmbr0` failed to bind to its designated physical adapter. Physical inspection isolated the failure to an unseated USB 2.5GbE NIC.

To prevent physical connector or cable disconnections from dropping the hypervisor offline, I configured an active-backup Linux network bond (`bond0`):
- **Primary Interface**: Realtek USB 2.5GbE NIC.
- **Standby Interface**: Integrated Intel I219-LM 1GbE NIC.
- **Failover Verification**: Manually disabling the primary interface (`ip link set <dev> down`) yielded zero packet loss during continuous ICMP streams. When the link re-established, the bond restored the 2.5GbE adapter as primary automatically. Throughput testing via `iperf3` sustained 2.35 Gbps bidirectional transfer rates, compared to 944 Mbps across the standalone gigabit interface.

## Diagnosing asymmetric routing and DHCP default metric conflicts

Following the successful bond deployment on `pve02`, I initiated the same network bonding architecture on the primary server. After physically connecting the server's onboard gigabit NIC to an available switch port, cross-VLAN communication halted abruptly:

- Intra-subnet traffic on the management VLAN and local SSH sessions remained fully responsive.
- Inter-VLAN traffic to the Home, IoT, and Camera subnets dropped completely, severing Home Assistant's connectivity to smart plugs, the Philips Hue bridge (`x.x.1.182`), and local cameras.

Inspecting the host routing table revealed the root cause: the onboard gigabit NIC still held a legacy dynamic DHCP configuration. Upon detecting physical carrier, it acquired a DHCP lease (`x.x.0.201`) and installed a default gateway route with metric 100, overriding the static 2.5GbE interface's default route at metric 1024. Because outbound inter-VLAN packets routed using the unexpected `x.x.0.201` source address, the UniFi gateway firewall dropped the packets against default inter-VLAN drop rules.

## Automated rollback timers and YAML indentation pitfalls

Resolving the routing failure surfaced two procedural configuration issues:

1. **Rollback Watchdog Timeout**: To prevent permanent lockouts during remote network configuration, I maintain a safety script that schedules a 120-second rollback watchdog unless a local confirmation file is updated. Due to a delay in committing the bond changes, the timer expired before the confirmation timestamp (logged at 08:09), quietly reverting the bond definition. When the host was rebooted at 08:14, it reloaded the legacy unbonded interface state.
2. **Editor Formatting Corruption**: Editing network configuration files interactively in `nano` introduced trailing whitespace characters across all lines, expanding file size from 551 bytes to 808 bytes. In whitespace-sensitive configurations, these invisible characters can cause silent parsing failures. Standardizing on staging configurations in a scratch directory and moving them via `install -m 644` eliminated editor formatting artifacts.

Rebooting at 08:45 with an explicit MAC address pin on the bond interface bound the host to its static reservation `x.x.0.5` under a single default route, restoring cross-VLAN routing.

## Migrating Home Assistant to HAOS and resolving duplicate address detection

With network stability verified, Home Assistant was migrated from a Docker container on the primary server to a dedicated HAOS virtual machine on `pve02`, providing native supervisor management, automated add-on lifecycle control, and dedicated USB passthrough.

The migration completed within a ten-minute cutover window (11:25:05 to 11:35:26). The preexisting container was stopped and retained as a cold standby.

During guest network assignment, the VM's static IP configuration repeatedly timed out, dropping the interface into an unassigned link-down state. Reviewing internal system logs within the guest isolated the failure to NetworkManager's Duplicate Address Detection (DAD):

```text
NetworkManager: ipv4: duplicate address detected for x.x.0.x on interface eth0
```

The selected static IP had collided with an access point. Because UniFi access points are categorized as network infrastructure rather than DHCP clients, they did not appear in standard active client lease tables. Conducting a full ARP ping sweep across the subnet identified active leases and resolved the collision. Once assigned a verified free address, the guest completed an initial 2.25 GB system backup in 49 seconds.

## Unplanned power-off failsafe validation

An accidental power interruption at 15:37 caused an unplanned cold shutdown of the primary host during rack hardware maintenance. 

Upon host reboot at 15:40:23, systemd dependencies and storage mounts were validated under true failure conditions:
- The static network watchdog script executed cleanly, validating gateway reachability without triggering emergency fallbacks.
- Network storage mounts to the NAS initialized before the Docker daemon spawned containers, preventing the photo server from binding empty directories.
- Thirty-one of thirty-two containers resumed operational status, and all external reverse proxy endpoints validated.

## Security audit: Gating unauthenticated webhook endpoints

Later that afternoon, a thorough read-only audit across homelab exposure points identified an unauthenticated operational webhook.

The automated package triage system utilized an HTTP webhook URL to receive human approval callbacks before executing package upgrades or system reboots. While the URL included an internal token identifier, the endpoint was publicly exposed via the reverse proxy without upstream identity authentication, creating a vulnerability where automated crawlers or unauthorized actors could trigger host restarts.

The endpoint was immediately migrated behind a Cloudflare Access zero-trust identity gate enforcing short-lived 24-hour authentication sessions, restricting webhook invocation to verified identities while preserving internal API reachability.

## UniFi control plane telemetry and memory baseline review

Investigating an alert where 35 wireless clients disconnected concurrently over a 2-second window revealed critical characteristics of the UniFi gateway:

- **Load Spikes vs Metric Collection**: The gateway reported a brief load average surge to 38.72. However, concurrent external Uptime Kuma monitors recorded 1,761 uninterrupted ICMP heartbeats with zero packet loss across thirty targets. Furthermore, wired hypervisor and storage connections experienced zero interruption. The discrepancy indicated a temporary stall in the UniFi controller's local reporting daemon rather than a failure of the underlying Linux network packet-forwarding plane.
- **Kernel Memory Accounting**: Analysis of gateway memory utilization fluctuating between 90% and 95% confirmed that the reporting metric reflected combined active and page-cache allocations. A six-day telemetry review showed a negligible memory drift of 0.29%, confirming absence of a memory leak. A proposal to deploy a candidate Release Candidate firmware build was rejected in favor of maintaining official stable releases on edge routing infrastructure.

## Multi-reviewer consensus audit on UniFi configuration

A collaborative audit evaluating thirty-seven proposed UniFi configuration recommendations against live network state resulted in ten unanimous approvals:

- **Withdrawn Recommendations**: Several plausible proposals were rejected upon inspecting empirical telemetry. A recommendation to enable IGMP snooping was withdrawn after airtime analysis demonstrated multicast traffic represented under 6% of channel capacity. Similarly, unverified minimum data rate changes were dismissed due to lack of vendor documentation support.
- **Snapshot Limitations**: The audit revealed the limitation of evaluating static snapshots without historical operational context. A recommendation claiming the `RadioChannelLockedByIot` constraint did not exist was disproven by historical logs showing the flag had been intentionally cleared earlier that morning to restore manual channel allocation.
- **Search Flag Parsing**: An automated search attempting to verify transcript entries failed to return results because directory names beginning with leading hyphens (`-`) were interpreted by `grep` as command-line flags. Passing explicit double-hyphen delimiters (`--`) resolved 185 matching entries, preventing false-negative escalation.
- **Controller API Verification**: Attempting to disable mDNS reflection on specific subnets via the API reported success while leaving stored database values unchanged. The setting was updated and verified directly in the web UI, followed by disabling obsolete VPN services and unused protocol helper modules.
