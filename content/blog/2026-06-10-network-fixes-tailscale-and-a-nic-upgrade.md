---
title: "My Doorbell Was on the Wrong VLAN and My Printer Was on the Wrong Subnet"
date: 2026-06-10
category: Homelab
summary: "Resolving cross-VLAN firewall routing for an Aqara doorbell and network printer, consolidating redundant Tailscale installations on Ubuntu, and migrating host networking to 2.5GbE."
---
My Aqara G410 doorbell at `x.x.10.9` (VLAN 80, Camera net) stopped showing video in HomeKit and the Aqara app. mDNS repeating was on across all VLANs, so that wasn't it. Packet capture showed the camera phoning home — little 76-byte UDP bursts out to Aqara's relay — but the return video stream never started.

Turned out to be my own firewall rule. I had an "Allow IoT to Apple TV" rule scoped only to VLAN 70. The doorbell lives on VLAN 80. So it could never reach my Apple TV hub at `x.x.1.112`. Widened the source to include VLAN 80 and traffic started flowing.

Of course by then the HomeKit pairing had timed out, so I had to remove the accessory and re-pair it in Apple Home. Annoying.

## My Printer Had a Management IP for No Reason

My Canon G4610 fell off after I segmented the network. Found two dumb mistakes in the UniFi controller.

It was sitting on the 2.4 GHz IoT SSID (VLAN 70) with an override pointing it at VLAN 30, but holding a reservation of `x.x.0.99` — that's Management, not Home. And there was no firewall rule letting my desktop actually open TCP to it.

I moved the reservation to `x.x.1.5` inside VLAN 30 and added a rule allowing my desktop's MAC to talk to `x.x.1.5`. Immediately saw 1.3 MB of print traffic flow. Still need to repoint the driver port on the workstation, left that for later.

## Three Tailscales Running at Once

I found three Tailscales on my OptiPlex: a Snap (`1.92.5`), a Docker container, and an Apt package. The Snap was the one actually holding `tailscale0`. The Docker one was just sitting there redundantly.

Ripped out Snap and Docker, kept the Apt version under systemd. Checked `n5ubuntu` (`x.x.149.70`) and my workstation (`x.x.153.21`) — both on the tailnet. Samba via `smb://x.x.149.70/shared` works over it.

## Moved the Host to 2.5GbE

Swapped the OptiPlex from onboard 1GbE (`eno1`) to a USB-C 2.5GbE dongle (`enx74****5c7c`). Pinned `x.x.0.5` in UniFi. Left `eno1` unassigned in Netplan — keeping it free for Proxmox clustering down the road. Haven't load-tested the new link properly yet.
