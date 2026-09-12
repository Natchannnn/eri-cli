---
title: "Benchmarking 2.5GbE Throughput with iperf3 and Isolating USB NIC Power Quirks"
date: 2026-07-16
category: Homelab
summary: "Benchmarking local LAN throughput across wired 2.5GbE and Wi-Fi 6 endpoints using iperf3, followed by a root-cause isolation pass on an asymmetric USB Ethernet adapter."
---
Rather than relying on internet speed tests bounded by external transit providers, I established an internal network performance baseline using `iperf3`. Testing across wired 2.5GbE infrastructure and Wi-Fi 6 access points validated expected PHY line-rate boundaries, while attempting to onboard a new handheld device over a 2.5G USB Ethernet adapter revealed a complex Layer 1/Layer 2 power management failure mode.

## Replacing OpenSpeedTest with host-networked iperf3

Initial testing began with OpenSpeedTest running as a containerized web service. While wrapping the HTTP payload generator in a CLI curl test demonstrated 22.6 Gbps across the local loopback interface, container bridge networking introduced measurable CPU scheduling and NAT translation overhead.

To eliminate virtualization artifacts, I replaced the HTTP container with standard `iperf3` bound directly to host networking (`--network host`). With the server operating a physical 2.5GbE NIC, the theoretical maximum TCP throughput sits at approximately 2.4 Gbps after standard TCP/IP packet framing and MTU 1500 overhead.

## Benchmarking wired 2.5GbE and Wi-Fi 6 clients

Running bidirectional multi-stream tests (`iperf3 -c <server_ip> -P 8`) across endpoints produced consistent performance baselines:

- **Desktop Workstation (2.5GbE Wired)**:
  - Transmit: 2.38 Gbps
  - Receive: 2.37 Gbps
  - Both figures fall within two percent of theoretical physical saturation, confirming an unconstrained 2.5GbE line rate through the core switch without intermediate gigabit bottlenecks.

- **Mobile Client (Wi-Fi 6, 6 GHz Band)**:
  - An initial run of 1.05 Mbps reflected default iperf3 UDP bandwidth throttling (1 Mbit/s) rather than a network defect.
  - Repeating the test over TCP yielded 182 Mbps at −64 dBm signal strength through an interior partition wall, bounded by single-stream attenuation.

- **M1 MacBook Pro (Wi-Fi 6, 5 GHz Band)**:
  - Sustained 844 Mbps at −38 dBm connected to an in-wall access point.
  - The M1 radio is hardware-limited to an 80 MHz channel width and 2x2 spatial streams (1201 Mbps physical link rate). Achieving 844 Mbps represents approximately 70% channel efficiency, which corresponds to typical MAC layer protocol overhead in real-world 802.11ax conditions.

## Diagnosing asymmetric connectivity on a Realtek 2.5G USB NIC

Connecting an MSI Claw 8 AI+ via an external 2.5G USB Ethernet dongle triggered an unexpected failure state: while the device negotiated a 2.5G link and acquired a DHCP lease on the Management VLAN, external routing and gateway access were completely non-functional.

Over several diagnostic passes, four hypotheses were tested against system telemetry:

1. **Management VLAN Firewall Whitelist**: The UniFi gateway enforces a default-deny policy for non-whitelisted MACs on the Management VLAN. Adding the dongle's MAC address to the allowlist did not restore connectivity.
2. **ARP and Gateway Resolution**: Directly pinging the gateway IP returned `Destination host unreachable`, demonstrating that failures occurred at the link/ARP layer prior to firewall packet inspection.
3. **Realtek Checksum Offload Defects**: The UniFi gateway recorded 284 active connection flows originating from the adapter's MAC address, yet client applications failed to establish TCP sockets. This symptom frequently aligns with hardware checksum offloading corruption, where outbound packets pass through intermediate switches but are silently dropped by target operating systems due to invalid TCP/UDP frame checksums. Direct IP socket tests confirmed that TCP handshakes failed to complete.
4. **Energy-Efficient Ethernet (EEE) and Power Sleep States**: Testing port autonegotiation forced down to 1.0 Gbps temporarily passed traffic for several seconds before the interface locked up again. This asymmetric behavior points to aggressive power-saving timeouts in the USB host controller or Realtek NIC driver: Energy-Efficient Ethernet (EEE / 802.3az), Green Ethernet, and USB Selective Suspend dropping the interface into low-power idle states mid-session.

Because disabling USB power management and driver-level EEE flags required extensive registry adjustments on the handheld console, the device was shifted to the Wi-Fi 6 network as an operational workaround while the hardware dongle remains isolated for bench analysis.

## Firewall rule ordering and storage housekeeping

Finalizing the setup involved establishing necessary routing policies across VLAN boundaries:

- **UniFi Firewall Evaluation**: Adding an inter-VLAN rule allowing the handheld device to reach the NAS on the Management subnet placed the rule at index 10010, appearing beneath default drop blocks (index 10007) in the controller UI. Testing confirmed that UniFi enforces zone-based matrices independently of sequential rule indices, allowing traffic to route with 3–14 ms latency.
- **Hardware Boundary Checks**: A proposal to migrate a dedicated simulator workstation from a 1 GbE Flex Mini switch directly to a 2.5GbE port was abandoned after hardware inspection confirmed the workstation motherboard's integrated NIC is physically capped at 1.0 Gbps.
- **SMB Mapping Precision**: Resolved Windows `System error 67` mounting errors by aligning client connection strings with the exact Samba share names rather than physical directory paths on the server.
