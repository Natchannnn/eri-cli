---
title: "I Certified the Network at 2.5 Gigabit Then Lost Three Hours to a USB Dongle"
date: 2026-07-16
category: Homelab
summary: "The wired LAN reached its expected 2.5GbE ceiling. An asymmetric USB adapter then consumed three hours before the fault was isolated."
---
Internet speed tests tell you about your ISP. I wanted my LAN numbers, so I set up `iperf3` properly. Started with OpenSpeedTest in a container — cute, did 22.6 Gbps over loopback via curl, but bridge NAT + CPU scheduling pollutes the numbers. Threw it out, ran plain `iperf3` with `--network host`. My server has a real 2.5GbE NIC, so ceiling is ~2.4 Gbps after MTU 1500 framing.

`iperf3 -c <server_ip> -P 8`, both directions:

Desktop on wired 2.5GbE: 2.38 up, 2.37 down. Within 2% of line rate. No gigabit bottleneck hiding in the core switch. Good.

Phone on Wi-Fi 6, 6 GHz: first run said 1.05 Mbps. I stared at that for a minute before remembering default iperf3 UDP throttles to 1 Mbit/s. Reran TCP — 182 Mbps at −64 dBm through a wall, single stream. That's just physics.

M1 MacBook on 5 GHz: 844 Mbps sustained at −38 dBm off an in-wall AP. M1 is capped at 80 MHz / 2x2 (1201 Mbps PHY), so 844 is ~70% efficiency. Normal 802.11ax overhead. Fine.

## The MSI Claw Dongle From Hell

Plugged my MSI Claw 8 AI+ in via a 2.5G USB dongle. Link negotiated 2.5G, DHCP lease on Management VLAN. And then… nothing. No gateway, no routing.

Chased four theories:

MAC whitelist — Management VLAN is default-deny for unknown MACs. Added the dongle's MAC. No change.

ARP — pinging the gateway gave `Destination host unreachable`. Dies before the firewall even sees it. Link/ARP layer.

Checksum offload — gateway showed 284 flows from the dongle's MAC, but no TCP socket ever completed. Classic Realtek offload corruption: packets traverse switches, die on hosts with bad checksums. IP socket tests confirmed handshakes never finished.

Power saving — forced the port to 1.0 Gbps, traffic passed for a few seconds, then locked again. Smells like EEE / 802.3az + Green Ethernet + USB Selective Suspend putting the thing to sleep mid-session.

Fixing that properly means registry surgery on the handheld. Nope. Put the Claw on Wi-Fi 6 and shelved the dongle for bench analysis later.

Also cleaned up while I was in there: my inter-VLAN rule for the handheld landed at index 10010, below the default drops at 10007 in the UI. Panicked briefly — but UniFi's zone matrix doesn't care about display order. Routed fine at 3–14 ms. Tried moving my sim rig off the Flex Mini 1GbE to 2.5GbE, opened the case — motherboard NIC is 1.0 Gbps silicon. Abandoned. And fixed Windows `System error 67` mounts by using exact Samba share names instead of server directory paths. My typo, not Samba's.
