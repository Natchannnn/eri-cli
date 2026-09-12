---
title: "Stirling-PDF Container Hardening, Camera Proxy Failures, and Diagnosing Uncorrelated Outages"
date: 2026-07-26
category: Homelab
summary: "Deploying Stirling-PDF with verified OCR mounts, tracing recurring camera dropouts to gateway proxy crashes rather than physical links, and auditing UniFi RF congestion."
---
A weekend infrastructure pass covered the deployment and configuration of Stirling-PDF, alongside root-cause investigations into intermittent camera dropouts and UniFi wireless performance. The investigations highlighted how independent diagnostic sessions can arrive at conflicting conclusions when evaluating telemetry at different architectural layers.

## Stirling-PDF deployment and Tesseract OCR path correction

I deployed Stirling-PDF to provide self-hosted document manipulation utilities (merging, splitting, sanitizing, and OCR). 

To avoid existing port collisions, the container binds to host port 8090, accessible strictly over LAN and Tailscale interfaces. Bypassing public Cloudflare Tunnel ingress was deliberate: Cloudflare's free tier enforces a strict 100 MB request payload ceiling, whereas internal hosting permits handling large archival scans up to a configured 500 MB limit.

Configuring OCR exposed a path defect in upstream documentation. Upstream Docker examples specify mounting host language models to `/usr/share/tessdata`. Inspecting the running Debian-based container filesystem revealed that Tesseract v5 expects training data at `/usr/share/tesseract-ocr/5/tessdata`. 

Mounting an empty host directory to this path inadvertently masks the container's preinstalled language definitions without triggering an explicit startup exception; OCR operations simply complete without producing extracted text. To resolve this, I extracted the six default language packs from the container before binding the host volume, subsequently verifying extraction by converting a rasterized test PDF and parsing the output with `pdftotext`.

## Database initialization and authentication flags

Enabling administrative authentication triggered an unexpected lockout:
1. **Flag Precedence**: The application's `settings.yml` had authentication enabled, but the Compose environment variable `SECURITY_ENABLE_LOGIN: "false"` took precedence, silently keeping public access open.
2. **Initial User Seeding**: The setup variables `SECURITY_INITIALLOGIN_USERNAME` and `PASSWORD` execute account creation only when the application's underlying user database is completely empty. Because the service had run unauthenticated for several hours, schema tables already existed. Switching the security flag rendered the system unauthenticated yet inaccessible, returning invalid credentials on all login attempts.

Because the instance was newly provisioned without historical job data, clearing the database volume allowed the seeder to populate the administrative account cleanly. Once authenticated, API endpoints enforced HTTP 401 on unauthorized requests while keeping the `/api/v1/info/status` endpoint open for synthetic health checks.

## Diagnosing camera dropouts: Protect proxy 502s vs physical switch flaps

Investigating intermittent offline alerts across five UniFi Protect cameras revealed an important distinction between network reachability and application health.

Switch port telemetry across the five camera links recorded zero PoE drops, zero CRC frame errors, and uninterrupted link uptime over fifteen days. ICMP probes in Uptime Kuma had recorded only a single ping failure across twenty-six days.

However, Home Assistant's recorder logs documented repeating connection failures:

```text
aiohttp.client_exceptions.ClientConnectorError: 502 Bad Gateway from gateway.local:7443
```

The 502 Bad Gateway errors clustered at specific timestamps: 00:12, 05:54, 08:01, 11:14, 11:19, and 14:34. An HTTP 502 indicates that the gateway's Nginx reverse proxy was operational while the underlying UniFi Protect application daemon had crashed or was restarting following background updates. 

Comparing this against a parallel diagnostic session earlier that day revealed a conflicting hypothesis: an earlier review of a 50-second camera drop at 14:38:45 had attributed the failure to an upstream switch reboot. Correlating the gateway application logs confirmed that application-level restarts accounted for the majority of dropouts, demonstrating that ping-based uptime monitoring masked underlying daemon crashes.

## UniFi infrastructure metrics and RF congestion

An audit of gateway and access point resource utilization clarified several initial performance concerns:

- **Gateway Metrics**: Initial readings reporting 83.8% CPU and 91.3% memory on the UniFi gateway were confirmed to be transient spikes. The 24-hour average CPU settled at 33.1%, while memory remained stable at an 88.4% baseline without upward leak trajectories.
- **RF Spectrum Utilization**: Inspecting the 2.4 GHz spectrum revealed all four access points were statically pinned to Channel 6. With three SSIDs broadcast per access point, twelve BSSIDs were contending on a single 20 MHz channel at 6 dBm transmit power. The lounge AP recorded 50% channel utilization, 13% self-generated traffic, and a 22% frame retransmission rate, while 5 GHz channels operated below 5% utilization. A revised frequency plan staggering 2.4 GHz channels across 1, 6, and 11 was scheduled for deployment during low-traffic windows.

## Reviewing diagnostic assumptions

A retrospective review of earlier operational decisions highlighted two diagnostic errors:

1. **API Script Execution**: An earlier script updating Uptime Kuma monitors failed during authentication. The failure was initially logged as an upstream library deprecation; subsequent testing confirmed the issue was caused by nested bash escape characters mangling JSON parameters passed into `python -c` over SSH. Mounting the script as a static file eliminated the error.
2. **Switch Reboot Attribution**: Identifying switch reboots solely by comparing uptime counters across devices can introduce false positives if metric polling drops during gateway restarts. In the absence of an uninterruptible power supply (UPS) on distribution switches, momentary utility power fluctuations remain a primary contributing factor to concurrent hardware restarts.

Overnight, the automated patch evaluation workflow processed nine pending updates, verified point-release changelogs, refreshed designated containers, and triggered the documentation generator to update service markdown sheets at 04:33.
