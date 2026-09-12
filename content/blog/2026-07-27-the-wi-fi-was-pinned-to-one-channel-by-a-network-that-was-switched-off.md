---
title: "UniFi RF Optimization: RadioChannelLockedByIot, Regulatory Power Caps, and Staged Node Firewall Rules"
date: 2026-07-27
category: Homelab
summary: "Resolving site-wide 2.4 GHz channel locking in UniFi, tuning 5 GHz EIRP against regional regulatory limits, optimizing AP channel reuse via floor plans, and staging firewall rules for a secondary Proxmox host."
---
A comprehensive RF restructuring of my wireless network began with an investigation into why all four access points were statically pinned to 2.4 GHz Channel 6. The debugging process uncovered a site-wide constraint enforced by a disabled SSID, measured substantial EIRP disparities across Australian regulatory domains, and established a phased firewall plan for an incoming secondary Proxmox node.

## Isolating the hidden RadioChannelLockedByIot constraint

Attempting to distribute 2.4 GHz channels across non-overlapping channels (1, 6, and 11) repeatedly failed in the UniFi Network web interface with a generic error: `This action could not be completed`.

Submitting the configuration update directly through the UniFi Network controller REST API exposed the underlying error key:

```text
api.err.RadioChannelLockedByIot
```

UniFi includes an "IoT Channel Optimization" setting intended to lock all access points to a single 2.4 GHz channel to prevent legacy smart plugs from scanning and disconnecting. This setting had been enabled inside a secondary IoT SSID that was currently set to disabled. Even when disabled and not actively broadcasting beacons, the controller continued to enforce the global channel lock site-wide, silently overriding manual channel assignments.

Disabling the setting within the dormant SSID definition released the lock, permitting independent channel configurations across all four access points.

## Regional regulatory domains and 5 GHz EIRP disparities

With channel locks removed, I reduced 5 GHz channel widths from 160 MHz to 80 MHz to improve signal-to-noise ratios and lessen interference. However, client telemetry showed the central ceiling-mounted UniFi Pro Max in the lounge carried zero 5 GHz clients, with clients associating instead with distant in-wall access points.

Both access points were configured to `High` transmit power. Yet telemetry showed:
- **Lounge AP (Channel 36)**: 17 dBm radiated power.
- **Office AP (Channel 149)**: 24 dBm radiated power.

This 7–12 dB disparity (representing a fourfold to sixteen-fold difference in effective isotropic radiated power, or EIRP) is enforced by the Australian (AU) regulatory domain. In Australia, the UNII-1 lower 5 GHz band (channels 36–48) is restricted to lower maximum EIRP limits to protect satellite and meteorological services, whereas upper UNII-2C and UNII-3 channels permit significantly higher transmit power.

Swapping channels confirmed the regulatory behavior:
- Relocating the Lounge AP to Channel 149 immediately elevated its output to 29 dBm.
- Shifting the Office AP to Channel 132 yielded 22 dBm, compared to 15 dBm on Channel 36.

Standardizing active 5 GHz channels on the upper UNII bands effectively resolved client roaming biases without altering physical hardware placements.

## RF channel reuse and architectural floor plan alignment

Covering four access points across three non-overlapping 2.4 GHz channels (1, 6, 11) requires one pair of access points to share a channel. 

Initial assignment paired the Theatre and Garage access points on Channel 11. However, reviewing the architectural layout showed both rooms occupy the same structural elevation of the residence, resulting in an immediate surge in co-channel contention (Garage AP 2.4 GHz channel utilization peaked at 75%).

Overlaying access point coordinates onto the true architectural floor plan identified the Theatre and Office as the diagonal opposing corners of the single-story building. Reassigning Channel 11 to the Theatre and Office APs eliminated direct co-channel interference. Furthermore, the revised plan isolated external RF noise, avoiding Channel 6 interference caused by an onboard vehicle dashcam (−56 dBm near the garage) and a printer's Wi-Fi Direct beacon (−51 dBm).

## Minimum data rates and airtime reclamation

To reduce management frame overhead and force fast client handoffs, I adjusted the minimum 2.4 GHz data rate:

1. **API Automation Quirk**: Updating the rate via the API returned `success: true` while leaving the underlying rate unchanged at 1000 kbps (1 Mbps). Because the network's rate selection mode was set to `auto`, the controller silently ignored explicit rate keys until the mode was explicitly adjusted in the controller settings.
2. **Rate Floors**:
   - **Primary Network**: Set to 6 Mbps. A 6 Mbps floor disables legacy 802.11b CCK modulation entirely, eliminating 802.11b CTS-to-self protection frames and freeing substantial airtime.
   - **IoT Network**: Set to 5.5 Mbps to maintain backward compatibility with legacy 2.4 GHz microcontrollers.

Over an observation window with 33 connected clients, all 29 IoT endpoints retained stable associations. Airtime utilization on the Office AP dropped from 40% to 17% while client count remained steady, and frame retransmission rates declined from 16.7% to 3.0%.

## Camera Protect telemetry boundaries

During the wireless maintenance window, UniFi Protect cameras exhibited brief offline events. Network telemetry confirmed that the physical infrastructure was fully nominal: the dedicated PoE switch delivered a stable 15.6W out of a 60W power budget with zero port link drops.

Correlating this with Home Assistant recorder logs confirmed that the gateway's Protect application daemon had been restarting in the background, emitting HTTP 502 Bad Gateway responses at the reverse proxy layer while ICMP connectivity remained continuous. An audit of the firewall table also identified an obsolete rule titled `Allow Cameras to Gateway` that matched camera MACs against the `Internal` zone, failing to execute because the camera interfaces reside strictly within the isolated `Untrusted` camera VLAN.

## Staging firewall architecture for a secondary Proxmox node

To introduce hypervisor redundancy and isolate development workloads, I acquired a secondary OptiPlex 3070 Micro to deploy as an auxiliary Proxmox host (`pve02`). 

An audit of existing firewall rules revealed a major architectural coupling: the static IP `x.x.0.5` was hardcoded across eight distinct firewall policies. In five rules, it represented Home Assistant; in others, it represented the physical Docker host. Migrating Home Assistant into an independent VM on `pve02` would break these automations unless IP assignments and firewall policies were cleanly decoupled prior to host provisioning.

To manage the migration cleanly:
- Pre-allocated static MAC addresses for incoming virtual machines and staging containers, registering them in DHCP reservation tables.
- Staged inter-VLAN firewall rules permitting administrative and IoT traffic to both the current and pending Home Assistant IPs concurrently.
- Validated all staged firewall rule changes in preview mode without committing writes until physical deployment begins.
