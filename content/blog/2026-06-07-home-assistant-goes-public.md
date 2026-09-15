---
title: "The 502 Was Just a Typo in Trusted Proxies"
date: 2026-06-07
category: Homelab
summary: "Exposing Home Assistant remotely using a Cloudflare Tunnel without open firewall ports, debugging container DNS resolution, and correcting reverse proxy headers."
---
I wanted remote access to my Home Assistant dashboard without punching holes in my router's firewall. The obvious move was spinning up a Cloudflare Tunnel alongside it in Docker, routing `ha.n5hq.me` straight at the local web UI.

Naturally, the first thing I got was a 502 Bad Gateway.

## The 502 and Docker Host Networking

I'd pointed the tunnel at `http://homeassistant:8123`. Sounded right. Except both `cloudflared` and Home Assistant were on `network_mode: host`, so Docker's internal DNS wasn't resolving anything. Container names mean nothing on host networking. Took me longer than I'd like to admit to remember that.

Switched the target to `http://localhost:8123`. Tunnel went green. And then every request started dying with HTTP 400.

I ran the tunnel with `--protocol http2 --loglevel debug` thinking Cloudflare was eating something. It wasn't. Traffic was hitting the box fine. Home Assistant was just dropping it all on the floor.

`home-assistant.log` had the answer:

*"A request from a reverse proxy was received from 127.0.0.1, but your HTTP integration is not set-up for reverse proxies."*

Two problems in my `configuration.yaml`. I'd forgotten `use_x_forwarded_for: true` entirely. And my `trusted_proxies` list had a typo — `172.0.0.1` instead of `127.0.0.1` — plus some ancient Docker bridge IP I'd left in there months ago and never cleaned out.

Fixed both, added `127.0.0.1` and `::1`, restarted the container. Tunnel connected immediately. No port forwards.
