---
title: "Home Assistant Occupancy Automation, Gateway Ingress Audit, and Blind CSS Refactoring"
date: 2026-07-12
category: Homelab
summary: "Implementing presence-based lighting automations in Home Assistant, auditing gateway firewall rules for ISP migration readiness, and refactoring portfolio styles without headless visual feedback."
---
A Sunday afternoon engineering session covered three distinct operational domains: tuning Home Assistant room occupancy automations based on event recorder history, auditing gateway egress rules in anticipation of an ISP migration, and refactoring portfolio styles where automated contrast audits contrasted with the absence of visual verification tooling.

## Tuning occupancy timeouts from recorder event history

The initial objective was creating automated turn-off routines for the theatre room (controlling two downlights and two accent light strips) and the office. Rather than adopting an arbitrary timeout, I queried the Home Assistant SQLite recorder database to analyze the mmWave presence sensor's raw event history across prior sessions.

The logs revealed:
- Transient false-negative dropouts lasting up to two minutes while an occupant was stationary.
- Genuine room vacancies spanning twenty-five minutes or more.

Setting the automation vacancy timeout to five minutes provided a sufficient buffer above the two-minute sensor noise floor while preventing lights from remaining active during extended absences. Accounting for the physical sensor's onboard hardware cooldown period, the effective elapsed time before state execution is the hardware delay plus five minutes.

## Reconciling device registry IDs and entity naming

Configuring the office automation required mapping four target entities: two ceiling downlights, a desk lamp, and an air purifier. Identifying the correct entities exposed discrepancies in Home Assistant's underlying entity registry:

- The air purifiers registered under two separate domains (a `fan` entity and a `switch` entity) identified solely by OEM hardware identifiers and ambiguous labels (`big` and `small`). The only unambiguous attribute was the physical area mapping (`area_id: office` vs `area_id: lounge`).
- The theatre room presence sensor possessed a device-tracker entity historically mislabeled with an adjacent room name, requiring a join between the device registry and area registry to resolve the correct entity ID.

To prevent invalid automation syntax from crashing the daemon, the configuration workflow followed a strict verification pipeline:
1. Created a timestamped snapshot of `automations.yaml`.
2. Appended the validated YAML automation blocks.
3. Executed `ha core check_config` via the CLI container.
4. Restarted the Home Assistant container and queried the SQLite database directly to verify `automation.theatre_lights_off` and `automation.office_lights_off` reported active status.

## ISP migration audit and outbound tunnel architecture

In preparation for a potential residential ISP transition with dynamic IP assignments, I conducted an infrastructure audit to map all external dependencies. Resolving public DNS records and reviewing service connections confirmed that the homelab maintains zero direct inbound bindings:

- **Public Web Ingress**: Reverse proxy domains (`n5hq.me`) route through Cloudflare Tunnels (`cloudflared`), which establish outbound persistent TLS tunnels on port 443.
- **Node Interconnects**: Cross-node and administrative traffic routes via Tailscale overlay tunnels.
- **Offsite Seedbox Mounts**: Storage shares mount via outbound SSH tunnels (`sshfs`).
- **Static Portfolio**: Assets deploy to external edge CDNs.

Because no public DNS A/AAAA records point directly to the residential gateway WAN address, changing ISPs—even onto connections governed by Carrier-Grade NAT (CGNAT)—requires no DNS propagation adjustments or dynamic DNS updaters. The gateway cutover is isolated to updating WAN authentication credentials (PPPoE/VLAN tags) on the primary interface.

## Gateway ingress rule audit

While reviewing the UniFi gateway configuration, an audit of the IPv4 firewall table revealed an obsolete port forwarding rule left over from a legacy service deployed prior to adopting Cloudflare tunnels. The rule forwarded inbound traffic from a high WAN port to an internal host that had since been repurposed. Because the service was defunct, the rule served no operational purpose and was removed from the active firewall policy.

## CSS accessibility refactoring and headless verification limits

Later that evening, I ran an automated styling audit against the portfolio codebase served on local port 3003 (isolated via a git worktree). The automated audit flagged several accessibility and semantic issues:

- Text contrast on small secondary metadata sat at 3.82:1 against the dark background, failing WCAG AA (4.5:1). Adjusting the hsl lightness values elevated the lowest contrast ratio to 4.77:1.
- Missing canonical URLs and OpenGraph metadata across all seventeen template pages.
- CSS reveal classes initialized page elements at `opacity: 0` via inline styles, rendering the entire document below the hero invisible if JavaScript failed to execute. This was addressed by introducing `<noscript>` visibility overrides.

While automated linters confirmed passing contrast ratios, valid HTML trees, and HTTP 200 response codes, the development server lacked a headless Chromium or Playwright installation. Consequently, extensive CSS restyling—replacing high-saturation glow treatments with desaturated inset highlights—was conducted without visual inspection tools, demonstrating the operational risk of refactoring presentation layers solely through static code parsers.
