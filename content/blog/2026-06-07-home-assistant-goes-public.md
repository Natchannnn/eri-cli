---
title: "Home Assistant Remote Access via Cloudflare Tunnel"
date: 2026-06-07
category: Homelab
summary: "Exposing Home Assistant remotely using a Cloudflare Tunnel without open firewall ports, debugging container DNS resolution, and correcting proxy headers."
---
Exposing Home Assistant for secure external access without forwarding router ports led to deploying `cloudflared` alongside Home Assistant in Docker, routing `ha.n5hq.me` to the local web interface.

## The 502 Bad Gateway

The initial deployment returned a 502 Bad Gateway. In the Cloudflare Zero Trust tunnel configuration, the service URL was set to `http://homeassistant:8123` using the Docker container name. Because both containers ran with `network_mode: host`, Docker's internal bridge DNS was not active, preventing container name resolution. Updating the tunnel target to `http://localhost:8123` and restarting the tunnel resolved transport to the host.

However, requests continued to fail with 502 while `cloudflared` produced no access logs. Restarting the tunnel daemon with `--protocol http2 --loglevel debug` revealed that incoming requests were reaching the host, but Home Assistant was actively returning HTTP 400 Bad Request.

## Resolving Reverse Proxy Configuration

Three separate configuration issues inside Home Assistant were rejecting the proxied requests:

1. `trusted_proxies` in `configuration.yaml` was set to `x.x.0.3`, an obsolete Docker bridge IP from an earlier installation.
2. When attempting to correct the IP address, a typographical error (`172.0.0.1` instead of `127.0.0.1`) kept the reverse proxy untrusted after a restart.
3. `external_url` was unconfigured, causing Home Assistant's HTTP integration to drop requests where the incoming `Host` header (`ha.n5hq.me`) did not match any permitted domain.

Correcting `trusted_proxies` to include `127.0.0.1` and `::1`, setting `use_x_forwarded_for: true`, defining `external_url: "https://ha.n5hq.me"`, and restarting Home Assistant cleared all 400 errors. External requests through the Cloudflare Tunnel established clean connections immediately.

## Next Steps

With external transport established, subsequent work involves configuring Cloudflare Access policies for multi-factor authentication in front of the tunnel and exposing Immich using the same `cloudflared` instance.
