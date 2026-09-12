---
title: "WAN Link Migration Edge Recovery and Windows Diskpart Formatting Lockups"
date: 2026-06-30
category: Homelab
summary: "Moving a gateway WAN link caused a transient 3-minute Cloudflare tunnel reconnect cycle, followed by troubleshooting a Windows diskpart VDS concurrency lock on a 256 GB USB drive."
---
Migrating the physical WAN uplink on my UniFi gateway off a 10GbE SFP+ port down to an RJ45 port freed up high-bandwidth interfaces for local interconnects. While the public IP remained unchanged, the momentary interface drop initiated an edge reconnection cycle across all Cloudflare Tunnel hostnames. Investigating the subsequent alerts highlighted how outbound-only tunnels recover, alongside a separate troubleshooting session dealing with Windows Virtual Disk Service (VDS) locking during flash drive partitioning.

## Cloudflare Tunnel reconnect cycle during WAN failover

Immediately following the cable swap at 04:41, public endpoints (`sonarr`, `radarr`, `nas`, `immich`) returned HTTP 530 / Cloudflare Error 1033, indicating that Cloudflare's edge could not establish a route to the local connector.

Reviewing `cloudflared` container logs showed the connector remained continuously running without a daemon restart. The logs documented the link bounce and reconnect sequence:

- **04:37:36 - 04:39:01**: All four outbound TLS connections to Cloudflare edge points of presence (PoPs in Perth and Melbourne) timed out following the physical interface flap.
- **04:40:13**: The connector's automated retry backoff initiated new outbound dials over TCP port 443.
- **04:41:45**: Four redundant edge sessions successfully registered, resuming traffic forwarding.

By 04:42, direct automated curl probes returned HTTP 200 on `immich`, 302 on `radarr`, and 307 on `nas`. The physical link drop had caused approximately three minutes of true edge unavailability. Local browser sessions continued to display cached 1033 error pages until a hard refresh bypassed client-side socket caching. Because `cloudflared` operates entirely via outbound-initiated tunnels, no static firewall pinholes or port forwarding rules were disrupted by the WAN port change.

## DNS probe misconfiguration and apex routing

During post-recovery verification, an automated script was run to validate all eight subdomains. Rather than querying authoritative DNS records directly, the script attempted to resolve endpoints by binding requests against the IP returned for the apex domain.

Because the apex domain resolves to an external static hosting platform rather than the Cloudflare Tunnel ingress, the requests were routed to an origin that possessed no routing context for internal homelab subdomains. Every endpoint returned HTTP 000 (connection refused/empty response). Once the probe script was corrected to query each subdomain's distinct CNAME target directly against Cloudflare edge resolvers, all eight hostnames validated cleanly.

## Windows Diskpart partitioning and VDS concurrency lock

Later that morning, I prepared a 256 GB Kingston DataTraveler USB 3.0 flash drive for external data transfer. The drive contained three preexisting OEM volumes and refused to format as exFAT via the standard GUI.

Executing `diskpart` on the attached Windows system allowed inspecting the disk layout:

```text
DISKPART> list disk

  Disk ###  Status         Size     Free     Dyn  Gpt
  --------  -------------  -------  -------  ---  ---
  Disk 2    Online          231 GB      0 B
```

The drive showed 231 GB of usable capacity, confirming genuine NAND geometry despite the legacy partition layout. After running `clean` and `create partition primary`, attempting an immediate format failed:

```text
There is no volume selected.
Please select a volume and try again.
```

Because `clean` resets diskpart's active context, the newly created primary partition required explicit selection via `select partition 1`. 

During the subsequent format attempt, the command was initiated without the `quick` flag (`format fs=exfat`). On a 231 GB volume, a full format executes a continuous block-zeroing pass. Terminating the running process via Ctrl+C left Windows Virtual Disk Service (VDS) in a deadlock:

```text
Virtual Disk Service error:
A concurrent second call is made on an object before the first is completed.
```

The background service retained a lock on the volume handle. Attempting to restart the service via `net stop vds` returned:

```text
The requested pause, continue, or stop is not valid for this service.
```

To release the stuck kernel handle without forcing low-level driver crashes, the workstation was rebooted to clear the VDS deadlock, leaving the drive cleaned and partitioned awaiting a quick format cycle.

## Synchronized access point reboots

Cross-referencing uptime metrics across the UniFi controller later revealed that around 06:20, all wireless access points and in-wall switches rebooted simultaneously, whereas the core switch and gateway maintained continuous uptime. Because the affected devices exclusively draw power via Power-over-Ethernet (PoE) from a shared distribution bank, the clustered timestamp pointed to a momentary PoE power supply fluctuation rather than network-level link failures.
