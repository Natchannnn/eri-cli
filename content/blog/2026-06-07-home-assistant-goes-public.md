---
title: "The 502 Was Just a Typo in Trusted Proxies"
date: 2026-06-07
category: Homelab
summary: "Exposing Home Assistant remotely using a Cloudflare Tunnel without open firewall ports, debugging container DNS resolution, and correcting reverse proxy headers."
---
I wanted remote access to my Home Assistant instance without punching holes in my router's firewall. The standard plan was running `cloudflared` alongside Home Assistant in Docker, routing `ha.n5hq.me` directly to the local web interface.

Naturally, the first thing I ran into was a 502 Bad Gateway.

## The 502 and Docker Host Networking

In the Cloudflare Zero Trust tunnel configuration, I had pointed the tunnel target at `http://homeassistant:8123` using the container name. But both `cloudflared` and Home Assistant were running with `network_mode: host`. On host networking, Docker's internal embedded DNS bridge does not intercept container names, so `cloudflared` could never resolve `homeassistant`.

Switching the tunnel target to `http://localhost:8123` solved the transport issue, but requests immediately began failing with HTTP 400 Bad Request while `cloudflared` remained silent in access logs. 

Running the tunnel daemon with `--protocol http2 --loglevel debug` confirmed that traffic was reaching the host, but Home Assistant core was explicitly dropping every incoming request.

## Fixing the Reverse Proxy Headers

Checking `home-assistant.log` revealed the real culprit: Home Assistant was logging *"A request from a reverse proxy was received from 127.0.0.1, but your HTTP integration is not set-up for reverse proxies."*

Two separate configuration mistakes were blocking the tunnel:

1. `use_x_forwarded_for: true` was missing from the `http:` section in `configuration.yaml`, telling Home Assistant to reject any forwarded client traffic.
2. In my `trusted_proxies` list, I had made a dumb typo: `172.0.0.1` instead of `127.0.0.1`, alongside an old Docker bridge IP leftover from months ago.

Once I set `use_x_forwarded_for: true`, added both `127.0.0.1` and `::1` under `trusted_proxies`, and restarted the container, all 400 errors disappeared. External requests through the Cloudflare Tunnel connected immediately without port forwarding.
