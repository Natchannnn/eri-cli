---
title: "The Wi-Fi Was Pinned to One Channel by a Network That Was Switched Off"
date: 2026-07-27
category: Homelab
summary: "Resolving site-wide 2.4 GHz channel locking in UniFi, tuning 5 GHz EIRP against regional regulatory limits, optimizing AP channel reuse via floor plans, and staging firewall rules for a secondary Proxmox host."
---
All four of my APs were stuck on 2.4 GHz Channel 6. Tried spreading them across 1/6/11 in the UniFi UI. Every attempt died with `This action could not be completed`. No reason given.

Hit the controller REST API directly. There it was:

```text
api.err.RadioChannelLockedByIot
```

UniFi has an "IoT Channel Optimization" toggle that pins every AP to one 2.4 channel so legacy plugs don't roam and drop. It was enabled inside a secondary IoT SSID — one that was currently disabled. Not broadcasting, no beacons, still enforcing a site-wide lock and silently overriding my channel picks. Turned the toggle off inside the dormant SSID definition. Lock released. Channels finally stuck.

## Australia Caps Your 5 GHz and Won't Tell You Loudly

With the lock gone I dropped 5 GHz widths from 160 MHz to 80 for better SNR. Then noticed my lounge ceiling Pro Max had zero 5 GHz clients — everyone clinging to distant in-wall APs. Both set to `High` power. Telemetry:

- Lounge (ch 36): 17 dBm.
- Office (ch 149): 24 dBm.

That's the AU regulatory domain. Lower UNII-1 (36–48) is capped hard to protect satellite/weather; upper bands get way more EIRP. Swapped to prove it: lounge to 149 jumped to 29 dBm, office to 132 gave 22 dBm vs 15 on 36. Standardized everything upstairs on upper channels. Roaming bias gone, no hardware moved.

## I Paired the Wrong APs on the Same Channel

Four APs, three channels — one pair has to share. I first paired Theatre + Garage on 11. They're on the same side of the house. Garage 2.4 utilization spiked to 75%. Dumb pairing.

Laid AP positions over the actual floor plan: Theatre and Office are diagonal opposite corners. Moved the shared 11 there. Contention cleared. Also dodged outside noise I'd mapped — dashcam at −56 dBm near the garage, printer Wi-Fi Direct at −51 dBm, both polluting 6.

## Kicking Legacy Rates Off the Air

Bumped minimum 2.4 rates to reclaim airtime. API said `success: true` and changed nothing — still 1 Mbps. Because rate mode was `auto`, the controller ignores explicit rate keys until you flip the mode. Gotcha noted.

Final: primary net floor 6 Mbps (kills 802.11b CCK + CTS-to-self overhead outright), IoT net 5.5 Mbps so ancient microcontrollers stay associated. 33 clients observed, all 29 IoT stayed connected. Office AP airtime 40% → 17%, retransmits 16.7% → 3.0%. Same client count.

Cameras blinked during the window — checked: PoE switch steady at 15.6W of 60W, zero link drops. HA logs showed the Protect daemon restarting with 502s at the proxy, ICMP untouched. Same daemon-crash pattern as yesterday. Also found a dead `Allow Cameras to Gateway` rule matching camera MACs against the `Internal` zone — cameras live in isolated `Untrusted`, so it never fires. Cleaned that up.

Bought a second OptiPlex 3070 Micro for `pve02` (Proxmox aux). Pre-work discovery: `x.x.0.5` is hardcoded in eight firewall policies — five mean Home Assistant, others mean the Docker host itself. Moving HA to its own VM breaks that unless I decouple first. Pre-allocated MACs, registered DHCP reservations, staged rules allowing both current and future HA IPs, validated everything in preview mode. Hardware arrives before I commit.
