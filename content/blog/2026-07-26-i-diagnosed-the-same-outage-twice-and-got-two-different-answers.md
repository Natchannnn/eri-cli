---
title: "I Diagnosed the Same Outage Twice and Got Two Different Answers"
date: 2026-07-26
category: Homelab
summary: "Deploying Stirling-PDF with verified OCR mounts, tracing recurring camera dropouts to gateway proxy crashes rather than physical links, and auditing UniFi RF congestion."
---
Weekend infra pass: stood up Stirling-PDF, chased camera dropouts, stared at UniFi RF numbers. The cameras taught me something — I diagnosed the same outage twice in one day and blamed two different layers. Both times I was confident. Once I was wrong.

## Stirling-PDF Fights You on OCR Paths

Needed self-hosted PDF tools — merge, split, sanitize, OCR. Bound it to host port 8090, LAN + Tailscale only. Deliberately not behind Cloudflare Tunnel: free tier caps bodies at 100 MB, I want up to 500 MB for big scans internally.

OCR broke on paths. Upstream docs say mount language models at `/usr/share/tessdata`. The actual Debian container with Tesseract v5 wants `/usr/share/tesseract-ocr/5/tessdata`. Mount an empty host dir on that path and you mask the preinstalled languages with no startup error — OCR just returns nothing. Extracted the six default packs out of the container first, then bound the volume. Verified by rasterizing a test PDF and running `pdftotext` on the output. Text came out.

Auth locked me out next. `settings.yml` said login on, but Compose had `SECURITY_ENABLE_LOGIN: "false"` — env wins silently, so it stayed public. Then the seed vars (`SECURITY_INITIALLOGIN_USERNAME` / `PASSWORD`) only fire on an empty user DB. I'd already run it open for hours, tables existed, so flipping the flag gave me a locked box that rejected every login. New instance, no job history worth keeping — wiped the DB volume, seeder created the admin clean. `/api/v1/info/status` stays open for healthchecks, everything else 401s without auth now.

## The Cameras Weren't Down. The Proxy Was.

Five UniFi Protect cameras flapping offline. Switch ports: zero PoE drops, zero CRC errors, fifteen days solid link. Uptime Kuma ICMP: one ping fail in twenty-six days. Physically fine.

But HA recorder kept logging:

```text
aiohttp.client_exceptions.ClientConnectorError: 502 Bad Gateway from gateway.local:7443
```

Clustered at 00:12, 05:54, 08:01, 11:14, 11:19, 14:34. 502 from Nginx means the proxy is up and the Protect daemon behind it is dead or restarting after background updates.

Here's the embarrassing part: that same morning I'd blamed a 50-second drop at 14:38 on an upstream switch reboot. Correlated the gateway app logs later — nope, daemon restarts explain nearly all of them. Ping monitoring completely masked it. ICMP was green while the app was crashing.

## RF Is a Mess on 2.4

Gateway CPU read 83.8% / mem 91.3% at first glance. Scary until you look at 24h averages: CPU 33.1%, mem flat at 88.4% baseline, no leak slope. Transient spike.

2.4 GHz though: all four APs pinned to Channel 6. Three SSIDs each = twelve BSSIDs fistfighting over one 20 MHz channel at 6 dBm. Lounge AP at 50% utilization, 13% self-traffic, 22% retransmits. 5 GHz sits under 5%. Staggering 1/6/11 during a quiet window — scheduled, not tonight.

Two more confessions: my Uptime Kuma monitor-update script failed auth and I logged it as "upstream lib deprecation." It was nested bash escapes mangling JSON inside `python -c` over SSH. Mounted the script as a file, error gone. And comparing switch uptimes to claim reboots can lie if polling drops during gateway restarts — with no UPS on the distribution switches, utility blips are still suspect number one for simultaneous restarts.

Overnight the patch workflow chewed through nine updates, refreshed containers, and rewrote service docs at 04:33. At least something had a quiet night.
