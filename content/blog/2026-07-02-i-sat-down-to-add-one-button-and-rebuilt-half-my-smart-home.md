---
title: "Home Assistant Integration Alignment: Matter Server, Meross LAN, and Cross-VLAN Discovery"
date: 2026-07-02
category: Homelab
summary: "Preparing Home Assistant for physical Stream Deck+ hardware control required deploying a standalone Matter Server container, enabling UniFi mDNS reflection, and migrating fifteen devices to meross_lan."
---
Before binding smart home automations to rotary dials on an Elgato Stream Deck+, I conducted an audit of my Home Assistant environment. Because the instance runs as a containerized deployment rather than a full Home Assistant OS appliance, several integrations had remained unconfigured across network boundaries. Resolving these required deploying an external Matter server container, configuring cross-VLAN mDNS discovery on UniFi, and switching device integration strategies for local network reliability.

## Standalone Matter Server container deployment

Home Assistant runs as a vanilla Docker container in my environment rather than Home Assistant OS (HAOS). HAOS automatically orchestrates the official Matter add-on; containerized deployments require running `matter-server` (`ghcr.io/home-assistant-libs/python-matter-server`) as an independent container.

Prior to this pass, the native Matter integration repeatedly logged connection failures attempting to reach a local websocket endpoint that did not exist. Deploying the standalone container and pointing the Home Assistant integration to `ws://matter-server:5580/ws` established the missing RPC interface, enabling Matter device commissioning pipelines.

## Cross-VLAN discovery and UniFi mDNS reflection

The homelab network enforces strict Layer 3 network isolation:
- **Management VLAN**: Core server infrastructure, Docker hosts, and Home Assistant.
- **Home VLAN**: User workstations, mobile devices, and Apple TV 4K / HomePods acting as Thread border routers.
- **IoT VLAN**: Wi-Fi smart plugs, relays, and environmental sensors.

Matter and Thread commissioning rely heavily on IPv6 link-local multicast and mDNS (Multicast DNS) advertising over UDP port 5353, which routers discard at subnet boundaries by default. Home Assistant was consequently unable to discover smart plugs and Thread devices residing in the IoT subnet.

Rather than collapsing the network architecture into a flat subnet, I applied two targeted changes within UniFi Network:
1. Enabled the global **mDNS reflector** across the Management, Home, and IoT VLANs to proxy multicast discovery frames across interfaces.
2. Created a firewall rule permitting outbound TCP/UDP traffic from Home Assistant's static management IP into the IoT VLAN subnet.

An initial attempt to relocate the Apple TV directly onto the IoT subnet broke existing firewall rules bound to its static IP allocation; keeping devices on their designated subnets while bridging discovery via mDNS maintained both isolation and visibility.

## Migrating fifteen devices to meross_lan

Initial onboarding of Meross smart plugs utilized Matter sharing via Apple Home. In practice, this multi-hop commissioning chain suffered from frequent handshake timeouts and failed pairings, and excluded several older hardware revisions that lacked Matter firmware entirely.

To establish reliable local control, I bypassed the Matter/Apple Home bridge by deploying the custom `meross_lan` component. This integration communicates directly with the devices' onboard HTTP/MQTT daemons over local LAN sockets.

Migrating the entire fleet of fifteen devices—including smart plugs, ambient LED light strips, the garage door controller, and presence sensors—to `meross_lan` provided several functional benefits:
- Eliminated external cloud and bridge dependencies.
- Exposed detailed power monitoring telemetry (voltage, current, active wattage) that Matter endpoints omitted.
- Bound all devices to reserved static DHCP leases, preventing control timeouts from lease renegotiations.

## Diagnosing placeholder readings in HVAC zone telemetry

The ducted air conditioning integration reported ambient zone temperatures exceeding 150°F. Tracing the underlying API payload revealed that the physical AC controller operates purely on zone damper percentage apertures rather than closed-loop thermostatic feedback in individual rooms.

The hardware controller transmits fixed placeholder byte values for zones lacking physical thermistors. What appeared to be a decoding defect was simply raw placeholder telemetry. Tracking true per-room temperatures will require deploying dedicated Zigbee or BLE temperature sensors linked to local hubs.

## Entity standardization and UniFi Protect account reset

To finalize the integration pass, I resolved authentication errors against the UniFi Protect controller. The integration had locked its service account due to repeated automated retries against stale credentials. Provisioning a dedicated local read-only account within UniFi OS restored video stream proxies and motion detection entities.

Finally, I standardized entity naming across forty active devices, adopting a strict `<room> <device>` schema (e.g., `sim_rig_plug`, `cinema_light_strips`) to ensure consistent mapping when generating Stream Deck+ dial layouts. Physical hardware dial mapping is now unblocked, while dedicated Thread lock integrations remain scheduled for subsequent radio hardware additions.
