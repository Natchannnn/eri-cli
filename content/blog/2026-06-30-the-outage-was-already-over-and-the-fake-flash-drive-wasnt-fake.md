---
title: "I Moved One WAN Cable and Lost Three Minutes of Edge"
date: 2026-06-30
category: Homelab
summary: "Moving a gateway WAN link caused a transient 3-minute Cloudflare tunnel reconnect cycle, followed by troubleshooting a Windows diskpart VDS concurrency lock on a 256 GB USB drive."
---
Moved my UniFi gateway's WAN uplink off the 10GbE SFP+ port down to plain RJ45. Wanted the fast ports free for local stuff. Public IP didn't change. Still cost me three minutes of edge.

At 04:41, right after the swap, `sonarr`, `radarr`, `nas`, `immich` all started returning 530 / 1033. Cloudflare couldn't reach my connector.

The `cloudflared` container never restarted, though. Logs show the whole thing:

04:37–04:39, all four outbound TLS sessions to Perth and Melbourne PoPs timed out on the flap. 04:40 the backoff kicked in, redialing out over 443. 04:41:45, four sessions registered again.

By 04:42 my curl probes were 200 on `immich`, 302 on `radarr`, 307 on `nas`. Three minutes of real downtime. My browser kept showing cached 1033 pages until I hard-refreshed — client-side socket cache, not the tunnel. And since `cloudflared` is outbound-only, no firewall pinholes broke. That part just worked.

## My Probe Script Lied to Me

Wrote a quick script to check all eight subdomains. It resolved the apex, thennailed every check against that IP.

Problem: my apex points at static hosting, not the tunnel ingress. That origin knows nothing about my homelab names. Everything came back 000. Felt like a second outage. It wasn't — the script was wrong. Repointed it at each subdomain's own CNAME via Cloudflare resolvers, all eight green.

## diskpart Locked Itself

Later that morning I was prepping a 256 GB Kingston DataTraveler for a transfer. Three OEM partitions on it, wouldn't format to exFAT in the GUI.

`diskpart`, `list disk` — Disk 2, Online, 231 GB. Real NAND size, at least it wasn't counterfeit.

Ran `clean`, `create partition primary`, tried to format. Got:

```text
There is no volume selected.
Please select a volume and try again.
```

Right — `clean` wipes diskpart's context. Needed `select partition 1` first. My mistake.

Then I formatted without `quick` (`format fs=exfat`) on 231 GB like an idiot. That's a full zero pass. Got impatient, hit Ctrl+C. VDS wedged itself:

```text
Virtual Disk Service error:
A concurrent second call is made on an object before the first is completed.
```

`net stop vds` refused — "not valid for this service." The handle was stuck in the kernel. Rebooted the workstation to clear it. Drive is sitting there cleaned and partitioned, still waiting on its quick format.

Checked UniFi later: around 06:20 every AP and in-wall switch rebooted at once. Gateway and core switch never dropped. They're all PoE off the same bank, so that smells like a power blip, not a network event. Not chasing it tonight.
