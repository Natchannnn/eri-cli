---
title: "I Sat Down to Add One Button and Rebuilt Half My Smart Home"
date: 2026-07-02
category: Homelab
summary: "One Stream Deck button turned into a Home Assistant audit. By the end, Matter had its own server and fifteen devices had moved to local control."
---
All I wanted was to bind some Home Assistant actions to the dials on my Elgato Stream Deck+. Ended up auditing the whole smart home first, because my containerized HA (not HAOS) had a bunch of stuff half-configured across VLANs.

## Matter Had Nowhere to Talk To

HAOS ships the Matter add-on. Plain Docker HA doesn't. My Matter integration had just been logging websocket failures to an endpoint that didn't exist.

Spun up `matter-server` (`ghcr.io/home-assistant-libs/python-matter-server`) as its own container, pointed HA at `ws://matter-server:5580/ws`. Commissioning pipeline came alive.

## mDNS Doesn't Cross VLANs, Obviously

My layout: Management holds servers, Docker, HA. Home holds workstations, phones, the Apple TV 4K and HomePods doing Thread border router duty. IoT holds plugs, relays, sensors. Strict L3 between them.

Matter/Thread lives on IPv6 link-local multicast + mDNS over UDP 5353. Routers drop that at boundaries by default, so HA couldn't see anything in IoT.

I tried moving the Apple TV onto IoT. Broke every firewall rule tied to its static IP. Moved it back.

What actually worked, two changes in UniFi:
- turned on the global mDNS reflector across Management, Home, IoT
- added a rule letting HA's management IP talk TCP/UDP into the IoT subnet

Isolation intact, discovery works.

## Ditched Matter for meross_lan on Fifteen Devices

My fifteen Meross plugs were onboarded via Matter-through-Apple-Home. Pairings timed out constantly, and the older hardware revisions don't even have Matter firmware.

Deployed the custom `meross_lan` component instead — talks straight to the onboard HTTP/MQTT daemons over LAN. Migrated all fifteen: plugs, LED strips, garage controller, presence sensors.

Better in every way that matters to me. No cloud, no Apple bridge in the middle. And I finally get voltage / current / wattage telemetry that Matter never exposed. Pinned everything to static DHCP leases so renegotiations stop causing timeouts.

## My AC Reports 150°F Because Nobody Put Thermometers In

Ducted AC integration was showing zone temps over 150°F. Thought my parsing was broken. Nope — the controller only knows damper percentages, not room temps. Zones without physical thermistors just get fixed placeholder bytes. Raw telemetry, not a decode bug.

Real per-room temps mean Zigbee or BLE sensors on local hubs. Later problem.

Finished by fixing UniFi Protect auth — the integration had locked its account hammering stale creds, so I made a dedicated read-only local user and streams + motion entities came back. Then renamed forty devices to a strict `<room> <device>` scheme (`sim_rig_plug`, `cinema_light_strips`) so the Stream Deck+ dial mapping isn't guesswork. Dials are unblocked now. Thread locks wait on new radio hardware.
