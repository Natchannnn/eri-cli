---
title: "UniFi VLAN Firewall Rules, Tailscale Consolidation, and 2.5GbE NIC Upgrade"
date: 2026-06-10
category: Homelab
summary: "Resolving cross-VLAN firewall routing for an Aqara doorbell and network printer, consolidating redundant Tailscale installations on Ubuntu, and migrating host networking to 2.5GbE."
---
Diagnosing cross-VLAN communication failures across the UniFi network resolved issues with an Aqara doorbell and Canon network printer, while server networking was upgraded to a 2.5GbE interface.

## UniFi Firewall Rules: Aqara G410 Doorbell

The Aqara G410 doorbell at `x.x.10.9` (Camera Network, VLAN 80) was unreachable from HomeKit and the vendor application. Network inspection confirmed that mDNS repeating was active across all local VLANs. Packet analysis revealed that the camera established outbound UDP signalling to Aqara relay servers via 76-byte packets, but no inbound video stream would initialize.

Tracing firewall telemetry identified the root cause: the existing "Allow IoT to Apple TV" rule was scoped solely to the IoT Network (VLAN 70), blocking the Camera Network (VLAN 80) from reaching the Apple TV HomeKit hub at `x.x.1.112`. Modifying the rule source to include VLAN 80 restored cross-subnet routing. Because the HomeKit pairing session had expired during the blockage, the accessory required removal and re-pairing within the Apple Home app.

## UniFi Subnet Isolation: Canon Network Printer

The Canon G4610 printer had dropped offline after initial network segmentation. It was associated with the 2.4 GHz IoT SSID (VLAN 70) using a virtual network override pointing to VLAN 30 (Home Network).

An audit of the UniFi controller revealed two configuration errors:
1. The device held a fixed IP reservation of `x.x.0.99`, placing it within the Management Network subnet rather than the Home Network range.
2. No firewall rule permitted workstation endpoints to initiate TCP sessions toward the printer IP.

The static assignment was reconfigured to `x.x.1.5` within VLAN 30, and a dedicated firewall rule was applied allowing the primary desktop MAC address to communicate with `x.x.1.5`. Network telemetry confirmed 1.3 MB of active TCP print traffic flowing upon rule application. Driver port reassignment to `x.x.1.5` was scheduled for the client endpoint.

## Consolidating Redundant Tailscale Services

An inventory of host network daemons revealed three concurrent Tailscale installations on the OptiPlex: a Snap package (`1.92.5`), a Docker container, and an Apt system package. The Snap package actively bound the `tailscale0` network interface, while the Docker container ran redundantly.

The environment was cleaned by removing both the Snap and Docker instances, retaining the Apt package running under systemd. The host (`n5ubuntu`, `x.x.149.70`) and workstation (`x.x.153.21`) confirmed active tailnet connectivity, allowing remote access to Samba file shares via `smb://x.x.149.70/shared`.

## Host Migration to 2.5GbE

The OptiPlex network link was transitioned from the integrated 1GbE NIC (`eno1`) to an external 2.5GbE USB-C network adapter (`enx74****5c7c`). The host IP reservation was pinned to `x.x.0.5` in the UniFi controller. Retaining the onboard interface in Netplan unassigned preserves an isolated interface for upcoming Proxmox clustering.

## Pending Verification

- Re-pair the Aqara doorbell within HomeKit.
- Update local workstation printer ports to `x.x.1.5`.
- Verify persistent 2.5GbE link throughput under sustained network load.
